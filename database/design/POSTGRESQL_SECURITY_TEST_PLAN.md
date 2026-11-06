# PostgreSQL Security Test Plan & Adversarial Verification

**Document Version:** 1.1.0
**Status:** Design Test Plan Specification (Milestone 3.2.1.6 Extended)
**Target Engine:** PostgreSQL 15+ / Supabase Managed PostgreSQL

---

## 1. Overview & Verification Strategy

This document defines the formal adversarial security and privilege verification test suite for ECOFlow's PostgreSQL database implementation. It validates that:
- Untrusted roles (`PUBLIC`, `anon`, `authenticated`, or runtime backend roles) cannot create objects in system or application schemas.
- Temporary tables or functions cannot shadow permanent objects (`search_path` hijacking).
- Direct function execution is strictly prohibited across all trigger routines via explicit signature revocations.
- Trigger creation is restricted exclusively to table owners (`ecoflow_admin`), preventing unauthorized users from attaching malicious hooks.
- Cross-table `SECURITY INVOKER` functions fail safely and close when calling roles lack table or RLS visibility.
- `SECURITY DEFINER` functions execute under non-superuser, non-BYPASSRLS ownership and evaluate target table RLS policies.
- Audit tables remain strictly append-only across direct DML, statement truncation, and table owner manipulation via `FORCE ROW LEVEL SECURITY`.
- Inherited privileges through role membership do not leak unexpected write or administrative grants.

> **Execution Note:** These tests are specifications intended for execution in Milestone 3.2+ against a live PostgreSQL / Supabase test harness. **No database connections or tests have been executed in Milestone 3.2.1.6.**

---

## 2. Extended Test Specifications by Security Domain

### Category 1: Schema Security & Object Creation Controls

#### Test SEC-1.1: Schema CREATE Restrictions on `app_private`
- **Objective:** Verify that untrusted roles cannot create objects inside the trusted `app_private` schema.
- **Execution Identity:** `authenticated` / `ecoflow_api_user` (without admin grants)
- **Setup:** Connect to database under non-owner role.
- **Operation:**
  ```sql
  CREATE TABLE app_private.malicious_shadow (id int);
  ```
- **Expected Result:** Query fails immediately with SQLSTATE `42501` (`insufficient_privilege`: "permission denied for schema app_private").
- **Failure Condition:** Table is created inside `app_private`.

#### Test SEC-1.2: Public Schema Object Creation Restrictions
- **Objective:** Verify that `PUBLIC` cannot create functions or tables in the `public` schema (PostgreSQL 15+ default hardening).
- **Execution Identity:** `anon` / `authenticated`
- **Setup:** Connect as client-facing role.
- **Operation:**
  ```sql
  CREATE FUNCTION public.fake_clock_timestamp() RETURNS timestamp AS $$ SELECT now(); $$ LANGUAGE sql;
  ```
- **Expected Result:** Query fails with SQLSTATE `42501` (`permission denied for schema public`).
- **Failure Condition:** Object is created in `public`.

#### Test SEC-1.3: Temporary Object Shadowing Resistance (`pg_temp`)
- **Objective:** Verify that creating a temporary table or function with the same name as a domain entity does not hijack internal function queries.
- **Execution Identity:** `ecoflow_api_user`
- **Setup:**
  1. Create temporary table in session:
     ```sql
     CREATE TEMP TABLE users (id uuid, status text);
     INSERT INTO pg_temp.users VALUES ('00000000-0000-0000-0000-000000000000', 'ACTIVE');
     ```
  2. Invoke `public.fn_lock_users_for_role_mutation()` via inserting into `public.user_roles`.
- **Operation:**
  ```sql
  INSERT INTO public.user_roles (id, user_id, role_id, is_primary, assigned_at)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', gen_random_uuid(), true, now());
  ```
- **Expected Result:** Function locks `public.users` because `public.fn_lock_users_for_role_mutation()` explicitly references `public.users` and uses `SET search_path = pg_catalog, app_private, pg_temp;` (where `public` is omitted and `pg_temp` is last). It does NOT lock `pg_temp.users`.
- **Failure Condition:** Function queries or locks the temporary session table `pg_temp.users`.

---

### Category 2: Function Execution Privileges & Direct Calling Revocations

#### Test SEC-2.1: Direct Invocation of Privileged Trigger Functions
- **Objective:** Verify that neither `PUBLIC` nor the runtime backend role `ecoflow_api_user` can directly call trigger functions via SQL.
- **Execution Identity:** `ecoflow_api_user`
- **Setup:** Connect as runtime API role.
- **Operation:**
  ```sql
  SELECT public.fn_lock_users_for_role_mutation();
  SELECT public.fn_sync_eco_header_from_active_revision();
  ```
- **Expected Result:** Both calls fail immediately with SQLSTATE `42501` ("permission denied for function fn_...").
- **Failure Condition:** Function executes and returns a trigger record or throws an internal plpgsql trigger context error.

#### Test SEC-2.2: Direct Invocation of Immutable Rejection Triggers
- **Objective:** Verify that `fn_reject_update_or_delete()` and `fn_reject_truncate()` cannot be called directly to harvest database error signatures.
- **Execution Identity:** `authenticated`
- **Setup:** Attempt direct function invocation.
- **Operation:**
  ```sql
  SELECT public.fn_reject_update_or_delete();
  ```
- **Expected Result:** Rejected by `REVOKE EXECUTE ... FROM PUBLIC` (`42501`).
- **Failure Condition:** Function executes without permission check.

---

### Category 3: Trigger Creation & Modification Authorization

#### Test SEC-3.1: Trigger Creation by Unauthorized Non-Owner Role
- **Objective:** Verify that non-owner roles (e.g. `ecoflow_api_user`, `ecoflow_schema_owner`) cannot create or attach triggers to existing tables.
- **Execution Identity:** `ecoflow_api_user`
- **Setup:** Connect as runtime role.
- **Operation:**
  ```sql
  CREATE TRIGGER trg_malicious_hook
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_user_activation_deferred();
  ```
- **Expected Result:** Statement fails with SQLSTATE `42501` ("must be owner of table users").
- **Failure Condition:** Trigger is attached to table by non-owner.

#### Test SEC-3.2: Trigger Alteration / Disabling by Runtime Identity
- **Objective:** Verify that the runtime backend role cannot disable or drop integrity triggers.
- **Execution Identity:** `ecoflow_api_user`
- **Operation:**
  ```sql
  ALTER TABLE public.audit_logs DISABLE TRIGGER trg_audit_logs_immutable;
  DROP TRIGGER trg_ecos_guard_header_revision_consistency ON public.ecos;
  ```
- **Expected Result:** Statements rejected with SQLSTATE `42501` ("must be owner of table audit_logs" / "must be owner of table ecos").
- **Failure Condition:** Trigger is disabled or dropped.

---

### Category 4: Cross-Table Invoker Privileges & RLS Failsafe Behavior

#### Test SEC-4.1: Cross-Table Trigger Firing under SECURITY INVOKER with Missing Read Grant
- **Objective:** Verify that if `ecoflow_api_user` lacks `SELECT` on `user_roles`, `fn_validate_primary_role_deferred()` fails safely rather than bypassing the invariant.
- **Execution Identity:** `ecoflow_api_user` with temporarily revoked `SELECT` on `public.user_roles`.
- **Setup:** User assigns role.
- **Operation:**
  ```sql
  INSERT INTO public.user_roles (id, user_id, role_id, is_primary, assigned_at)
  VALUES (gen_random_uuid(), $uid, $rid, true, now());
  ```
- **Expected Result:** Transaction fails at deferred commit with SQLSTATE `42501` ("permission denied for table user_roles"). The transaction rolls back cleanly, preventing unverified role states.
- **Failure Condition:** Invariant check silently passes or bypasses missing table grant.

#### Test SEC-4.2: Cross-Table Row Filtering via RLS under SECURITY INVOKER
- **Objective:** Verify that if an active user's role assignment is filtered by RLS, `fn_validate_primary_role_deferred()` reads `COUNT = 0` and aborts rather than permitting the transaction.
- **Execution Identity:** `ecoflow_api_user` operating under tenant-scoped RLS session.
- **Setup:** User is `ACTIVE`. RLS policy hides `user_roles` from current tenant session.
- **Operation:** Commit transaction.
- **Expected Result:** Trigger reads `v_primary_count = 0` for `ACTIVE` user, raises SQLSTATE `23514` ("Constraint violation: ACTIVE user must have exactly 1 primary role"), and aborts.
- **Failure Condition:** Transaction commits without detecting missing visible primary role.

---

### Category 5: SECURITY DEFINER RLS Evaluation & Privilege Isolation

#### Test SEC-5.1: SECURITY DEFINER Function Evaluates Target Table RLS
- **Objective:** Verify that `public.fn_lock_users_for_role_mutation()` evaluates RLS on `public.users` because `ecoflow_schema_owner` does not own `users` and does not possess `BYPASSRLS`.
- **Execution Identity:** Trigger invocation via `ecoflow_api_user` mutating `user_roles`.
- **Setup:** `public.users` has RLS enabled with policy `pol_users_lock_for_schema_owner`.
- **Operation:** Mutate role for User $U_1$.
- **Expected Result:** Function acquires row lock via policy `pol_users_lock_for_schema_owner`. If policy is dropped or disabled for `ecoflow_schema_owner`, query returns 0 rows and fails closed.
- **Failure Condition:** Function accesses or locks rows without policy evaluation.

#### Test SEC-5.2: SECURITY DEFINER Non-Superuser & No-BYPASSRLS Assertion
- **Objective:** Verify that `ecoflow_schema_owner` is strictly non-superuser and non-BYPASSRLS.
- **Execution Identity:** Inspection query
- **Operation:**
  ```sql
  SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
  FROM pg_roles
  WHERE rolname = 'ecoflow_schema_owner';
  ```
- **Expected Result:**
  - `rolsuper = false`
  - `rolbypassrls = false`
  - `rolcanlogin = false`
- **Failure Condition:** Any flag is true.

---

### Category 6: Audit Log Ownership, FORCE RLS & Mutation Resistance

#### Test SEC-6.1: Direct UPDATE Rejection via Table Grants
- **Objective:** Verify that `UPDATE` on `public.audit_logs` is rejected at the grant level for runtime identities.
- **Execution Identity:** `ecoflow_api_user`
- **Operation:**
  ```sql
  UPDATE public.audit_logs SET action = 'TAMPERED' WHERE id = $audit_id;
  ```
- **Expected Result:** Statement fails with SQLSTATE `42501` ("permission denied for table audit_logs").
- **Failure Condition:** Statement executes or proceeds to trigger evaluation.

#### Test SEC-6.2: Direct DELETE Rejection via Trigger Fallback
- **Objective:** Verify that even if an administrator or misconfigured role attempts `DELETE`, trigger `trg_audit_logs_immutable` aborts.
- **Execution Identity:** Table owner / Maintenance role
- **Operation:**
  ```sql
  DELETE FROM public.audit_logs WHERE id = $audit_id;
  ```
- **Expected Result:** Rejected with SQLSTATE `23514` ("Security violation: Table audit_logs is strictly immutable").
- **Failure Condition:** Audit row is deleted.

#### Test SEC-6.3: Table Truncation Rejection on Audit & Version Tables
- **Objective:** Verify that `TRUNCATE` is rejected by statement-level triggers.
- **Execution Identity:** `ecoflow_api_user`
- **Operation:**
  ```sql
  TRUNCATE TABLE public.audit_logs;
  TRUNCATE TABLE public.product_versions;
  ```
- **Expected Result:** Rejected with SQLSTATE `42501` ("Security violation: Table ... cannot be truncated").
- **Failure Condition:** Any table is truncated.

#### Test SEC-6.4: FORCE ROW LEVEL SECURITY on Audit Tables
- **Objective:** Verify that `FORCE ROW LEVEL SECURITY` is enabled on `audit_logs` and `login_audits`.
- **Execution Identity:** Inspection query
- **Operation:**
  ```sql
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
  WHERE relname IN ('audit_logs', 'login_audits');
  ```
- **Expected Result:**
  - `relrowsecurity = true`
  - `relforcerowsecurity = true`
- **Failure Condition:** `relforcerowsecurity = false`.

---

### Category 7: Role Inheritance & Effective Runtime Privileges

#### Test SEC-7.1: Client-Facing Role Isolation (`anon` / `authenticated`)
- **Objective:** Verify that client roles inherit zero administrative or direct table write permissions on system schemas.
- **Execution Identity:** `anon`, `authenticated`
- **Operation:**
  ```sql
  SELECT has_table_privilege('authenticated', 'public.audit_logs', 'INSERT');
  SELECT has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE');
  SELECT has_table_privilege('authenticated', 'public.user_roles', 'DELETE');
  SELECT has_table_privilege('anon', 'public.ecos', 'INSERT');
  ```
- **Expected Result:** All privilege checks return `false`.
- **Failure Condition:** Any check returns `true`.

#### Test SEC-7.2: Backend Service Role Append-Only Verification
- **Objective:** Verify effective privilege bitmap for `ecoflow_api_user` on `audit_logs`.
- **Execution Identity:** `ecoflow_api_user`
- **Operation:**
  ```sql
  SELECT
    has_table_privilege('ecoflow_api_user', 'public.audit_logs', 'SELECT') AS can_select,
    has_table_privilege('ecoflow_api_user', 'public.audit_logs', 'INSERT') AS can_insert,
    has_table_privilege('ecoflow_api_user', 'public.audit_logs', 'UPDATE') AS can_update,
    has_table_privilege('ecoflow_api_user', 'public.audit_logs', 'DELETE') AS can_delete,
    has_table_privilege('ecoflow_api_user', 'public.audit_logs', 'TRUNCATE') AS can_truncate;
  ```
- **Expected Result:**
  - `can_select = true`
  - `can_insert = true`
  - `can_update = false`
  - `can_delete = false`
  - `can_truncate = false`
- **Failure Condition:** Any mutation permission (`UPDATE`, `DELETE`, `TRUNCATE`) evaluates to `true`.

---

### Category 8: Advanced Concurrency, Revision Synchronization & Deadlock Specifications

#### Test SEC-8.1: Concurrent Modifications to Different Revisions of the Same ECO
- **Objective:** Verify that two transactions modifying different revisions of the same ECO follow canonical lock order (`Products` $\to$ `BOMs` $\to$ `ECOs` $\to$ `ECORevisions`) without deadlocks.
- **Execution Identity:** Sessions $S_1$ and $S_2$ under `ecoflow_api_user`.
- **Setup:** ECO $E_1$ with Revision 1 (`CHANGES_REQUESTED`) and Revision 2 (`DRAFT`).
- **Transaction Sequence & Lock Order:**
  - $S_1$ (updating Revision 1): Discovers parent, acquires lock on `products` ($P_1$), `boms` ($B_1$), `ecos` ($E_1$), then `eco_revisions` ($E_1$, Rev 1).
  - $S_2$ (updating Revision 2): Requests lock on $P_1$, $B_1$, then blocks waiting for lock on $E_1$.
  - $S_1$ completes update to Revision 1 and commits.
  - $S_2$ unblocks, acquires $E_1$ lock, locks `eco_revisions` ($E_1$, Rev 2), revalidates, and commits.
- **Expected Result:** Transactions serialize on parent ECO header without deadlocks (`40P01`).
- **Failure Condition:** Transactions lock revisions without parent ECO lock, resulting in deadlock or interleaved header desynchronization.

#### Test SEC-8.2: Active Revision Update Concurrent with Historical Revision Update
- **Objective:** Verify that an update to a historical revision does not overwrite or desynchronize the ECO header status when active revision is updating concurrently.
- **Execution Identity:** Sessions $S_1$ (active Rev 2) and $S_2$ (historical Rev 1).
- **Setup:** ECO $E_1$ has `active_revision_no = 2` (`SUBMITTED`). Revision 1 is `CHANGES_REQUESTED`.
- **Transaction Sequence:**
  - $S_2$ updates historical Revision 1 status to `CANCELLED`. Trigger `trg_eco_revisions_sync_header_status` fires, compares `v_active_rev_no (2) = NEW.revision_number (1)`, finds mismatch, and skips update (`RETURN NULL`).
  - $S_1$ updates active Revision 2 status to `UNDER_REVIEW`. Trigger fires, matches `v_active_rev_no (2) = NEW.revision_number (2)`, and updates `ecos.status = 'UNDER_REVIEW'`.
- **Expected Result:** `ecos.status` remains `'UNDER_REVIEW'`. Historical Revision 1 changes never touch the ECO header.
- **Failure Condition:** `ecos.status` is overwritten with historical status `'CANCELLED'`.

#### Test SEC-8.3: Concurrent ECO Pointer Change and Revision Status Change
- **Objective:** Verify consistency when an ECO advances `active_revision_no` while revision status is being updated.
- **Execution Identity:** Sessions $S_1$ (advancing pointer) and $S_2$ (updating revision).
- **Setup:** ECO $E_1$ with Revision 1 (`CHANGES_REQUESTED`) and Revision 2 (`DRAFT`).
- **Transaction Sequence:**
  - Both transactions serialize on `PERFORM 1 FROM public.ecos WHERE id = $E1_id FOR UPDATE`.
  - Transaction 1 advances `active_revision_no = 2`. Trigger `trg_ecos_sync_on_pointer_change` aligns `ecos.status = 'DRAFT'`.
  - Transaction 2 unblocks, acquires ECO lock, reads `active_revision_no = 2`, and proceeds with Revision 2 operations.
- **Expected Result:** Commit succeeds; at commit, deferred constraint trigger `trg_ecos_guard_header_revision_consistency` asserts `ecos.status = eco_revisions.status` for the newly active revision.
- **Failure Condition:** Header status contradicts new active revision status at commit time.

#### Test SEC-8.4: User Deactivation Concurrent with Role Mutation
- **Objective:** Verify that user deactivation (`status = 'INACTIVE'`) concurrent with role assignment serializes safely.
- **Execution Identity:** Session $S_1$ (deactivating User $U_1$) and Session $S_2$ (assigning role to $U_1$).
- **Transaction Sequence:**
  - $S_1$ executes `UPDATE users SET status = 'INACTIVE' WHERE id = $U1_id;` (locks $U_1$).
  - $S_2$ executes `INSERT INTO user_roles (user_id, ...) VALUES ($U1_id, ...);` (Trigger `fn_lock_users_for_role_mutation()` requests `FOR UPDATE` on $U_1$ and blocks).
  - $S_1$ commits.
  - $S_2$ unblocks, reads `status = 'INACTIVE'`, inserts role. At deferred commit, `trg_user_roles_validate_primary_deferred` checks $U_1$, sees `status = 'INACTIVE'`, and safely allows commit (inactive users are not required to hold primary roles).
- **Expected Result:** Execution serializes cleanly without deadlock or inconsistent role count.
- **Failure Condition:** Invariant check fails to detect deactivated status or deadlocks.

#### Test SEC-8.5: Missing or RLS-Hidden User During Role Mutation
- **Objective:** Verify that assigning a role to a non-existent or RLS-hidden user immediately aborts.
- **Execution Identity:** `ecoflow_api_user`
- **Operation:**
  ```sql
  INSERT INTO public.user_roles (id, user_id, role_id, is_primary, assigned_at)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-999999999999', gen_random_uuid(), true, now());
  ```
- **Expected Result:** Trigger `fn_lock_users_for_role_mutation()` checks `IF NOT FOUND` and raises SQLSTATE `23503` ("Foreign key violation: Referenced user ... does not exist or is invisible under RLS").
- **Failure Condition:** Trigger succeeds or defers failure to generic foreign key constraint.

---

## 3. Summary of Security Test Matrix

| Test ID | Target Component | Threat / Risk Addressed | Expected SQLSTATE / Outcome |
| :--- | :--- | :--- | :--- |
| **SEC-1.1** | `app_private` Schema | Unauthorized object creation in private schema | `42501` (permission denied) |
| **SEC-1.2** | `public` Schema | Arbitrary function injection by untrusted client | `42501` (permission denied) |
| **SEC-1.3** | Function `search_path` | Temporary object shadowing (`pg_temp` hijacking) | Secure execution against `public` |
| **SEC-2.1** | Trigger Direct Call | Direct execution of trigger routines by runtime API role | `42501` (permission denied) |
| **SEC-2.2** | Rejection Functions | Metadata harvesting via rejection functions | `42501` (permission denied) |
| **SEC-3.1** | Trigger Creation | Unauthorized attachment of triggers by non-owner | `42501` (must be table owner) |
| **SEC-3.2** | Trigger Alteration | Disabling or dropping triggers by runtime role | `42501` (must be table owner) |
| **SEC-4.1** | Cross-Table INVOKER | Missing read grant under invoker mode | `42501` / Transaction aborts |
| **SEC-4.2** | Cross-Table RLS | RLS hiding required rows under invoker mode | `23514` / Transaction fails closed |
| **SEC-5.1** | DEFINER RLS Evaluation | DEFINER bypassing table RLS without policy | Evaluated under `ecoflow_schema_owner` |
| **SEC-5.2** | Function Owner Privileges | Over-privileged function owner | `rolsuper = false`, `rolbypassrls = false` |
| **SEC-6.1** | `audit_logs` UPDATE | Audit trail tampering via table grants | `42501` (insufficient privilege) |
| **SEC-6.2** | `audit_logs` DELETE | Audit trail purging via trigger | `23514` (table is immutable) |
| **SEC-6.3** | Audit/Version TRUNCATE | Bulk erasure of audit/version history | `42501` (cannot be truncated) |
| **SEC-6.4** | FORCE RLS | Table owner bypassing RLS on audit tables | `relforcerowsecurity = true` |
| **SEC-7.1** | `anon` / `authenticated` | Direct DML privilege leakage to client roles | All permissions `false` |
| **SEC-7.2** | `ecoflow_api_user` | Non-append-only privileges on audit logs | `UPDATE`, `DELETE`, `TRUNCATE = false` |
