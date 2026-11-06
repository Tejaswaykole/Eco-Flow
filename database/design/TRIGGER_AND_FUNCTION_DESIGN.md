# Trigger and Function Design Specification

This document details the exact PostgreSQL trigger functions, constraint triggers, parameters, event bindings, error codes, and concurrency safeguards required to enforce all ECOFlow database invariants.

> **Status:** Unexecuted Design Specification (Targeted for Milestone 3.2 Migrations).

---

## 1. Primary Role Triggers

### A. BEFORE Mutation Trigger: `trg_user_roles_lock_users_before_mutation`
- **Function Name:** `fn_lock_users_for_role_mutation()`
- **Trigger Name:** `trg_user_roles_lock_users_before_mutation`
- **Target Table:** `user_roles`
- **Timing & Event:** `BEFORE INSERT OR UPDATE OR DELETE`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Acquires exclusive row locks on affected `users` rows in deterministic UUID order (`MIN(user_id)` then `MAX(user_id)`) to serialize concurrent role modifications and prevent deadlocks during role reassignments.

```sql
CREATE OR REPLACE FUNCTION public.fn_lock_users_for_role_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_found_count INT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM 1 FROM public.users WHERE id = NEW.user_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Foreign key violation: Referenced user % does not exist or is invisible under RLS',
        NEW.user_id
        USING ERRCODE = '23503';
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM 1 FROM public.users WHERE id = OLD.user_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referential integrity violation: Cannot delete role for missing or invisible user %',
        OLD.user_id
        USING ERRCODE = '23503';
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.user_id = NEW.user_id) THEN
      PERFORM 1 FROM public.users WHERE id = NEW.user_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Referential integrity violation: Target user % does not exist or is invisible',
          NEW.user_id
          USING ERRCODE = '23503';
      END IF;
    ELSE
      -- Deterministic sorted lock order to prevent cross-reassignment deadlocks
      IF (OLD.user_id < NEW.user_id) THEN
        PERFORM 1 FROM public.users WHERE id = OLD.user_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Reassignment violation: Source user % does not exist or is invisible',
            OLD.user_id
            USING ERRCODE = '23503';
        END IF;

        PERFORM 1 FROM public.users WHERE id = NEW.user_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Reassignment violation: Target user % does not exist or is invisible',
            NEW.user_id
            USING ERRCODE = '23503';
        END IF;
      ELSE
        PERFORM 1 FROM public.users WHERE id = NEW.user_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Reassignment violation: Target user % does not exist or is invisible',
            NEW.user_id
            USING ERRCODE = '23503';
        END IF;

        PERFORM 1 FROM public.users WHERE id = OLD.user_id FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Reassignment violation: Source user % does not exist or is invisible',
            OLD.user_id
            USING ERRCODE = '23503';
        END IF;
      END IF;
    END IF;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app_private, pg_temp;

ALTER FUNCTION public.fn_lock_users_for_role_mutation() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_user_roles_lock_users_before_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.fn_lock_users_for_role_mutation();
```

---

### B. Deferred Constraint Trigger: `trg_user_roles_validate_primary_deferred`
- **Function Name:** `fn_validate_primary_role_deferred()`
- **Trigger Name:** `trg_user_roles_validate_primary_deferred`
- **Target Table:** `user_roles`
- **Timing & Event:** `AFTER INSERT OR UPDATE OR DELETE`
- **Constraint Mode:** `DEFERRABLE INITIALLY DEFERRED`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Validates that every `ACTIVE` user affected by a role assignment, deletion, or reassignment possesses **exactly one** primary role at transaction commit time. Both `OLD.user_id` and `NEW.user_id` are evaluated on reassignment.

```sql
CREATE OR REPLACE FUNCTION public.fn_validate_primary_role_deferred()
RETURNS TRIGGER AS $$
DECLARE
  v_user_ids UUID[];
  v_uid UUID;
  v_user_status public."UserStatus";
  v_primary_count INT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_user_ids := ARRAY[NEW.user_id];
  ELSIF (TG_OP = 'DELETE') THEN
    v_user_ids := ARRAY[OLD.user_id];
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.user_id = NEW.user_id) THEN
      v_user_ids := ARRAY[NEW.user_id];
    ELSE
      -- Validate BOTH previous and new owner on reassignment
      v_user_ids := ARRAY[OLD.user_id, NEW.user_id];
    END IF;
  END IF;

  FOREACH v_uid IN ARRAY v_user_ids LOOP
    SELECT status INTO v_user_status FROM public.users WHERE id = v_uid;
    IF (v_user_status = 'ACTIVE') THEN
      SELECT COUNT(*) INTO v_primary_count
      FROM public.user_roles
      WHERE user_id = v_uid AND is_primary = true;

      IF (v_primary_count <> 1) THEN
        RAISE EXCEPTION 'Constraint violation: ACTIVE user % must have exactly 1 primary role (found %)',
          v_uid, v_primary_count
          USING ERRCODE = '23514'; -- check_violation
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_validate_primary_role_deferred() OWNER TO ecoflow_schema_owner;

CREATE CONSTRAINT TRIGGER trg_user_roles_validate_primary_deferred
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_primary_role_deferred();
```

---

### C. Deferred Constraint Trigger on User Activation: `trg_users_validate_activation_deferred`
- **Function Name:** `fn_validate_user_activation_deferred()`
- **Trigger Name:** `trg_users_validate_activation_deferred`
- **Target Table:** `users`
- **Timing & Event:** `AFTER INSERT OR UPDATE`
- **Constraint Mode:** `DEFERRABLE INITIALLY DEFERRED`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Prevents activating a user or inserting a new active user unless exactly one primary role is associated with that user at transaction commit.

```sql
CREATE OR REPLACE FUNCTION public.fn_validate_user_activation_deferred()
RETURNS TRIGGER AS $$
DECLARE
  v_primary_count INT;
BEGIN
  -- Perform status check inside function body to respect valid PostgreSQL syntax
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NULL;
  END IF;

  IF (NEW.status = 'ACTIVE') THEN
    SELECT COUNT(*) INTO v_primary_count
    FROM public.user_roles
    WHERE user_id = NEW.id AND is_primary = true;

    IF (v_primary_count <> 1) THEN
      RAISE EXCEPTION 'Constraint violation: Cannot set user % to ACTIVE without exactly 1 primary role (found %)',
        NEW.id, v_primary_count
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_validate_user_activation_deferred() OWNER TO ecoflow_schema_owner;

CREATE CONSTRAINT TRIGGER trg_users_validate_activation_deferred
AFTER INSERT OR UPDATE ON public.users
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_user_activation_deferred();
```

---

## 2. Active Revision & Lifecycle Invariant Triggers

### A. ECO Active Revision Pointer Composite Foreign Key (DDL)
- **Constraint Name:** `fk_ecos_active_revision`
- **Target Table:** `ecos`
- **Referenced Table:** `eco_revisions (eco_id, revision_number)`
- **Constraint Timing:** `DEFERRABLE INITIALLY DEFERRED`
- **Purpose:** Guarantees that `ecos(id, active_revision_no)` points to an existing revision belonging to that exact same ECO, completely eliminating pointer cross-wiring. Deferrability allows creating the ECO header and Revision 1 within the same transaction.

```sql
ALTER TABLE ecos
ADD CONSTRAINT fk_ecos_active_revision
FOREIGN KEY (id, active_revision_no)
REFERENCES eco_revisions (eco_id, revision_number)
ON UPDATE RESTRICT
ON DELETE RESTRICT
DEFERRABLE INITIALLY DEFERRED;
```

---

### B. ECO Revision State Machine Trigger: `trg_eco_revisions_enforce_lifecycle`
- **Function Name:** `fn_enforce_eco_revision_lifecycle()`
- **Trigger Name:** `trg_eco_revisions_enforce_lifecycle`
- **Target Table:** `eco_revisions`
- **Timing & Event:** `BEFORE UPDATE`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Enforces the strict lifecycle state machine and blocks modifications to terminal revisions.

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_eco_revision_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is not changing, permit update only if revision is still DRAFT
  IF (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    IF (OLD.status IN ('APPROVED', 'REJECTED', 'CANCELLED')) THEN
      RAISE EXCEPTION 'Modification rejected: ECORevision (%, %) is terminal (%) and immutable',
        OLD.eco_id, OLD.revision_number, OLD.status
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Validate permitted status transitions
  IF (OLD.status = 'DRAFT') THEN
    IF (NEW.status NOT IN ('SUBMITTED', 'CANCELLED')) THEN
      RAISE EXCEPTION 'Invalid transition: DRAFT revision can only transition to SUBMITTED or CANCELLED (attempted %)',
        NEW.status
        USING ERRCODE = '22023';
    END IF;
  ELSIF (OLD.status = 'SUBMITTED') THEN
    IF (NEW.status NOT IN ('UNDER_REVIEW', 'CANCELLED')) THEN
      RAISE EXCEPTION 'Invalid transition: SUBMITTED revision can only transition to UNDER_REVIEW or CANCELLED (attempted %)',
        NEW.status
        USING ERRCODE = '22023';
    END IF;
  ELSIF (OLD.status = 'UNDER_REVIEW') THEN
    IF (NEW.status NOT IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED')) THEN
      RAISE EXCEPTION 'Invalid transition: UNDER_REVIEW revision can only transition to APPROVED, REJECTED, CHANGES_REQUESTED, or CANCELLED (attempted %)',
        NEW.status
        USING ERRCODE = '22023';
    END IF;
  ELSIF (OLD.status = 'CHANGES_REQUESTED') THEN
    IF (NEW.status NOT IN ('CANCELLED')) THEN
      RAISE EXCEPTION 'Invalid transition: CHANGES_REQUESTED revision is frozen and can only transition to CANCELLED. Work must continue in a new revision.',
        NEW.status
        USING ERRCODE = '22023';
    END IF;
  ELSIF (OLD.status IN ('APPROVED', 'REJECTED', 'CANCELLED')) THEN
    RAISE EXCEPTION 'Invalid transition: Status % is terminal and cannot be transitioned to %',
      OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_enforce_eco_revision_lifecycle() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_eco_revisions_enforce_lifecycle
BEFORE UPDATE ON public.eco_revisions
FOR EACH ROW
EXECUTE FUNCTION public.fn_enforce_eco_revision_lifecycle();
```

---

### C. Active Revision-to-Header Status Synchronizer: `trg_eco_revisions_sync_header_status`
- **Function Name:** `fn_sync_eco_header_from_active_revision()`
- **Trigger Name:** `trg_eco_revisions_sync_header_status`
- **Target Table:** `eco_revisions`
- **Timing & Event:** `AFTER INSERT OR UPDATE ON eco_revisions`
- **Granularity:** `FOR EACH ROW`
- **Execution Order:** Fires after revision validation.
- **Purpose:** Automatically synchronizes `ecos.status` when the active revision's status is updated, or when a new revision is inserted with the matching active revision number. Only synchronizes the active revision; historical revisions never alter the ECO header status.

```sql
CREATE OR REPLACE FUNCTION public.fn_sync_eco_header_from_active_revision()
RETURNS TRIGGER AS $$
DECLARE
  v_active_rev_no INT;
BEGIN
  -- Re-read active_revision_no from parent ECO (which was locked top-down by application transaction)
  SELECT active_revision_no INTO v_active_rev_no
  FROM public.ecos
  WHERE id = NEW.eco_id;

  -- Strictly synchronize if and only if this revision IS the active revision
  -- Guarantees historical revisions (NEW.revision_number <> v_active_rev_no) never project status
  IF (v_active_rev_no IS NOT NULL AND v_active_rev_no = NEW.revision_number) THEN
    -- Synchronize ECO header status; IS DISTINCT FROM prevents redundant updates
    UPDATE public.ecos
    SET status = NEW.status,
        updated_at = clock_timestamp()
    WHERE id = NEW.eco_id
      AND status IS DISTINCT FROM NEW.status;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, app_private, pg_temp;

ALTER FUNCTION public.fn_sync_eco_header_from_active_revision() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_eco_revisions_sync_header_status
AFTER INSERT OR UPDATE OF status ON public.eco_revisions
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_eco_header_from_active_revision();
```

---

### D. Header Consistency Guard Trigger: `trg_ecos_guard_header_revision_consistency`
- **Function Name:** `fn_guard_eco_header_consistency()`
- **Trigger Name:** `trg_ecos_guard_header_revision_consistency`
- **Target Table:** `ecos`
- **Timing & Event:** `AFTER INSERT OR UPDATE ON ecos`
- **Constraint Mode:** `DEFERRABLE INITIALLY DEFERRED`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Rejects direct or conflicting updates to `ecos.status` that contradict the status of `eco_revisions(eco_id, active_revision_no)`. Deferrability allows atomic multi-row updates within a transaction while strictly enforcing consistency at commit.

```sql
CREATE OR REPLACE FUNCTION public.fn_guard_eco_header_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_rev_status public."ECOStatus";
BEGIN
  -- Look up status of the active revision pointed to by active_revision_no
  SELECT status INTO v_rev_status
  FROM public.eco_revisions
  WHERE eco_id = NEW.id AND revision_number = NEW.active_revision_no;

  IF (v_rev_status IS NULL) THEN
    RAISE EXCEPTION 'Consistency violation: Active revision % does not exist on ECO %',
      NEW.active_revision_no, NEW.id
      USING ERRCODE = '23503';
  END IF;

  -- Guard against header status contradicting the active revision
  IF (NEW.status IS DISTINCT FROM v_rev_status) THEN
    RAISE EXCEPTION 'Consistency violation: ECO header status (%) contradicts active revision % status (%)',
      NEW.status, NEW.active_revision_no, v_rev_status
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_guard_eco_header_consistency() OWNER TO ecoflow_schema_owner;

CREATE CONSTRAINT TRIGGER trg_ecos_guard_header_revision_consistency
AFTER INSERT OR UPDATE ON public.ecos
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_eco_header_consistency();
```

---

### E. ECO Header Pointer Update Synchronizer: `trg_ecos_sync_on_pointer_change`
- **Function Name:** `fn_sync_eco_status_on_pointer_change()`
- **Trigger Name:** `trg_ecos_sync_on_pointer_change`
- **Target Table:** `ecos`
- **Timing & Event:** `BEFORE UPDATE OF active_revision_no ON ecos`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** When `active_revision_no` is updated on `ecos` (e.g., advancing to a new revision), this trigger automatically aligns `NEW.status` with the status of the newly designated active revision.

```sql
CREATE OR REPLACE FUNCTION public.fn_sync_eco_status_on_pointer_change()
RETURNS TRIGGER AS $$
DECLARE
  v_target_rev_status public."ECOStatus";
BEGIN
  IF (OLD.active_revision_no IS DISTINCT FROM NEW.active_revision_no) THEN
    SELECT status INTO v_target_rev_status
    FROM public.eco_revisions
    WHERE eco_id = NEW.id AND revision_number = NEW.active_revision_no;

    IF (v_target_rev_status IS NOT NULL) THEN
      NEW.status := v_target_rev_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_sync_eco_status_on_pointer_change() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_ecos_sync_on_pointer_change
BEFORE UPDATE OF active_revision_no ON public.ecos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_eco_status_on_pointer_change();
```

---

### F. ECO Product/BOM Immutability Trigger: `trg_eco_product_bom_immutable`
- **Function Name:** `fn_protect_eco_product_bom_immutability()`
- **Trigger Name:** `trg_eco_product_bom_immutable`
- **Target Table:** `ecos`
- **Timing & Event:** `BEFORE UPDATE`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Enforces that an ECO's parent `product_id` and `bom_id` can never be reassigned after initial creation.

```sql
CREATE OR REPLACE FUNCTION public.fn_protect_eco_product_bom_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.product_id IS DISTINCT FROM NEW.product_id OR OLD.bom_id IS DISTINCT FROM NEW.bom_id) THEN
    RAISE EXCEPTION 'Security violation: ECO product_id and bom_id are strictly immutable after creation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_protect_eco_product_bom_immutability() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_eco_product_bom_immutable
BEFORE UPDATE ON public.ecos
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_eco_product_bom_immutability();
```

---

### G. ECOChange Immutability & Draft Revision Enforcement Trigger: `trg_eco_changes_enforce_draft_revision`
- **Function Name:** `fn_protect_eco_changes()`
- **Trigger Name:** `trg_eco_changes_enforce_draft_revision`
- **Target Table:** `eco_changes`
- **Timing & Event:** `BEFORE INSERT OR UPDATE OR DELETE`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Locks parent ECO and target ECORevision in top-down hierarchy. Rejects change creation, modification, or removal unless the target revision is in `DRAFT` status. Forbids moving change rows across revisions or ECOs.

```sql
CREATE OR REPLACE FUNCTION public.fn_protect_eco_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_eco_id UUID;
  v_revision_number INT;
  v_revision_status public."ECOStatus";
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_eco_id := NEW.eco_id;
    v_revision_number := NEW.revision_number;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.eco_id IS DISTINCT FROM NEW.eco_id OR OLD.revision_number IS DISTINCT FROM NEW.revision_number) THEN
      RAISE EXCEPTION 'Security violation: ECOChange cannot be moved to another ECO or revision'
        USING ERRCODE = '23514';
    END IF;
    v_eco_id := NEW.eco_id;
    v_revision_number := NEW.revision_number;
  ELSIF (TG_OP = 'DELETE') THEN
    v_eco_id := OLD.eco_id;
    v_revision_number := OLD.revision_number;
  END IF;

  -- Lock parent ECO header then exact ECORevision in top-down hierarchy
  PERFORM 1 FROM public.ecos WHERE id = v_eco_id FOR UPDATE;

  SELECT status INTO v_revision_status
  FROM public.eco_revisions
  WHERE eco_id = v_eco_id AND revision_number = v_revision_number
  FOR UPDATE;

  IF (v_revision_status IS NULL) THEN
    RAISE EXCEPTION 'Target revision % does not exist on ECO %', v_revision_number, v_eco_id
      USING ERRCODE = '23503';
  END IF;

  IF (v_revision_status <> 'DRAFT') THEN
    RAISE EXCEPTION 'Cannot % ECOChange on revision % of ECO %: revision status is % (must be DRAFT)',
      TG_OP, v_revision_number, v_eco_id, v_revision_status
      USING ERRCODE = '23514';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_protect_eco_changes() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_eco_changes_enforce_draft_revision
BEFORE INSERT OR UPDATE OR DELETE ON public.eco_changes
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_eco_changes();
```

---

### H. Submitted Revision Snapshot Requirement Trigger: `trg_eco_revisions_require_snapshot_deferred`
- **Function Name:** `fn_check_submitted_revision_snapshot()`
- **Trigger Name:** `trg_eco_revisions_require_snapshot_deferred`
- **Target Table:** `eco_revisions`
- **Timing & Event:** `AFTER INSERT OR UPDATE`
- **Constraint Mode:** `DEFERRABLE INITIALLY DEFERRED`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Verifies that whenever an `ECORevision` transitions to `SUBMITTED`, exactly one frozen snapshot row exists in `eco_revision_snapshots` for that exact `(eco_id, revision_number)`.

```sql
CREATE OR REPLACE FUNCTION public.fn_check_submitted_revision_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_snapshot_count INT;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NULL;
  END IF;

  IF (NEW.status = 'SUBMITTED') THEN
    SELECT COUNT(*) INTO v_snapshot_count
    FROM public.eco_revision_snapshots
    WHERE eco_id = NEW.eco_id AND revision_number = NEW.revision_number;

    IF (v_snapshot_count <> 1) THEN
      RAISE EXCEPTION 'Constraint violation: ECORevision (%, %) is SUBMITTED but has % snapshots (must be exactly 1)',
        NEW.eco_id, NEW.revision_number, v_snapshot_count
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_check_submitted_revision_snapshot() OWNER TO ecoflow_schema_owner;

CREATE CONSTRAINT TRIGGER trg_eco_revisions_require_snapshot_deferred
AFTER INSERT OR UPDATE ON public.eco_revisions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_submitted_revision_snapshot();
```

---

## 3. Idempotency State Machine & Identity Protection Trigger

### A. Idempotency Identity & State Protection Trigger: `trg_idempotency_keys_protect_identity`
- **Function Name:** `fn_protect_idempotency_identity()`
- **Trigger Name:** `trg_idempotency_keys_protect_identity`
- **Target Table:** `idempotency_keys`
- **Timing & Event:** `BEFORE UPDATE`
- **Granularity:** `FOR EACH ROW`
- **Purpose:**
  1. Enforces strict immutability of identity fields: `scope`, `key`, `actor_id`, `resource_id`, `request_hash`, `created_at`.
  2. Enforces permitted state transition: `PROCESSING` $\longrightarrow$ `COMPLETED` only.
  3. Prohibits transitioning `COMPLETED` back to `PROCESSING` or modifying `response_body` after completion.

```sql
CREATE OR REPLACE FUNCTION public.fn_protect_idempotency_identity()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Validate identity immutability
  IF (
    OLD.id IS DISTINCT FROM NEW.id OR
    OLD.scope IS DISTINCT FROM NEW.scope OR
    OLD.key IS DISTINCT FROM NEW.key OR
    OLD.actor_id IS DISTINCT FROM NEW.actor_id OR
    OLD.resource_id IS DISTINCT FROM NEW.resource_id OR
    OLD.request_hash IS DISTINCT FROM NEW.request_hash OR
    OLD.created_at IS DISTINCT FROM NEW.created_at
  ) THEN
    RAISE EXCEPTION 'Security violation: Idempotency reservation identity fields are strictly immutable'
      USING ERRCODE = '23514';
  END IF;

  -- 2. State transition enforcement: PROCESSING -> COMPLETED
  IF (OLD.status = 'PROCESSING') THEN
    IF (NEW.status NOT IN ('PROCESSING', 'COMPLETED')) THEN
      RAISE EXCEPTION 'State violation: PROCESSING reservation can only transition to COMPLETED (attempted %)',
        NEW.status
        USING ERRCODE = '22023';
    END IF;
  ELSIF (OLD.status = 'COMPLETED') THEN
    IF (NEW.status IS DISTINCT FROM 'COMPLETED') THEN
      RAISE EXCEPTION 'State violation: COMPLETED reservation is terminal and cannot transition to %',
        NEW.status
        USING ERRCODE = '22023';
    END IF;
    IF (OLD.response_body IS DISTINCT FROM NEW.response_body) THEN
      RAISE EXCEPTION 'State violation: Stored idempotency response body is strictly immutable after completion'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_protect_idempotency_identity() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_idempotency_keys_protect_identity
BEFORE UPDATE ON public.idempotency_keys
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_idempotency_identity();
```

---

## 4. Immutability & Lifecycle Triggers

### A. Generic Rejection Trigger: `fn_reject_update_or_delete()`
- **Function Name:** `fn_reject_update_or_delete()`
- **Target Tables:** `eco_revision_snapshots`, `product_versions`, `bom_versions`, `approvals`, `audit_logs`, `login_audits`
- **Timing & Event:** `BEFORE UPDATE OR DELETE`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Strictly blocks any modification or deletion on append-only and frozen tables.

```sql
CREATE OR REPLACE FUNCTION public.fn_reject_update_or_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Security violation: Table % is strictly immutable. % operation rejected.',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_reject_update_or_delete() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_eco_revision_snapshots_immutable
BEFORE UPDATE OR DELETE ON public.eco_revision_snapshots
FOR EACH ROW EXECUTE FUNCTION public.fn_reject_update_or_delete();

CREATE TRIGGER trg_product_versions_immutable
BEFORE UPDATE OR DELETE ON public.product_versions
FOR EACH ROW EXECUTE FUNCTION public.fn_reject_update_or_delete();

CREATE TRIGGER trg_bom_versions_immutable
BEFORE UPDATE OR DELETE ON public.bom_versions
FOR EACH ROW EXECUTE FUNCTION public.fn_reject_update_or_delete();

CREATE TRIGGER trg_approvals_immutable
BEFORE UPDATE OR DELETE ON public.approvals
FOR EACH ROW EXECUTE FUNCTION public.fn_reject_update_or_delete();

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_reject_update_or_delete();

CREATE TRIGGER trg_login_audits_immutable
BEFORE UPDATE OR DELETE ON public.login_audits
FOR EACH ROW EXECUTE FUNCTION public.fn_reject_update_or_delete();
```

---

### B. Truncate Rejection Trigger: `fn_reject_truncate()`
- **Function Name:** `fn_reject_truncate()`
- **Target Tables:** `audit_logs`, `login_audits`, `version_releases`, `product_versions`, `bom_versions`
- **Timing & Event:** `BEFORE TRUNCATE`
- **Granularity:** `FOR EACH STATEMENT`

```sql
CREATE OR REPLACE FUNCTION public.fn_reject_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Security violation: Table % cannot be truncated. Operation blocked.',
    TG_TABLE_NAME
    USING ERRCODE = '42501'; -- insufficient_privilege
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_reject_truncate() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_audit_logs_no_truncate
BEFORE TRUNCATE ON public.audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.fn_reject_truncate();

CREATE TRIGGER trg_login_audits_no_truncate
BEFORE TRUNCATE ON public.login_audits
FOR EACH STATEMENT EXECUTE FUNCTION public.fn_reject_truncate();
```

---

### C. VersionRelease Controlled Mutation Trigger: `trg_version_releases_controlled_mutation`
- **Function Name:** `fn_protect_version_releases()`
- **Trigger Name:** `trg_version_releases_controlled_mutation`
- **Target Table:** `version_releases`
- **Timing & Event:** `BEFORE UPDATE OR DELETE`
- **Granularity:** `FOR EACH ROW`
- **Purpose:** Protects release identity and references using NULL-safe comparisons (`IS DISTINCT FROM`), while permitting only valid lifecycle transitions: `SCHEDULED -> RELEASED -> DEPRECATED`.

```sql
CREATE OR REPLACE FUNCTION public.fn_protect_version_releases()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'Security violation: VersionRelease records are permanent and cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Identity and referential immutability check
    IF (
      OLD.id IS DISTINCT FROM NEW.id OR
      OLD.eco_id IS DISTINCT FROM NEW.eco_id OR
      OLD.product_id IS DISTINCT FROM NEW.product_id OR
      OLD.product_version_id IS DISTINCT FROM NEW.product_version_id OR
      OLD.bom_version_id IS DISTINCT FROM NEW.bom_version_id OR
      OLD.released_by IS DISTINCT FROM NEW.released_by OR
      OLD.released_at IS DISTINCT FROM NEW.released_at
    ) THEN
      RAISE EXCEPTION 'Security violation: VersionRelease identity and reference keys are strictly immutable'
        USING ERRCODE = '23514';
    END IF;

    -- Strict lifecycle transitions: SCHEDULED -> RELEASED -> DEPRECATED
    IF (OLD.release_status = 'SCHEDULED') THEN
      IF (NEW.release_status NOT IN ('SCHEDULED', 'RELEASED')) THEN
        RAISE EXCEPTION 'Invalid transition: SCHEDULED can only transition to RELEASED (cannot transition directly to %)',
          NEW.release_status
          USING ERRCODE = '22023';
      END IF;
    ELSIF (OLD.release_status = 'RELEASED') THEN
      IF (NEW.release_status NOT IN ('RELEASED', 'DEPRECATED')) THEN
        RAISE EXCEPTION 'Invalid transition: RELEASED can only transition to DEPRECATED (attempted %)',
          NEW.release_status
          USING ERRCODE = '22023';
      END IF;
    ELSIF (OLD.release_status = 'DEPRECATED') THEN
      IF (NEW.release_status IS DISTINCT FROM 'DEPRECATED') THEN
        RAISE EXCEPTION 'Invalid transition: DEPRECATED is a terminal status and cannot be changed'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, app_private, public, pg_temp;

ALTER FUNCTION public.fn_protect_version_releases() OWNER TO ecoflow_schema_owner;

CREATE TRIGGER trg_version_releases_controlled_mutation
BEFORE UPDATE OR DELETE ON public.version_releases
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_version_releases();
```
