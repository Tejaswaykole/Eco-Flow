-- Migration 002: Primary-Role Invariants
-- Workspace: T:\My Projects\ECO-Flow\database

-- 1. Partial Unique Index: Exactly one primary role per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_one_primary_per_user
ON public.user_roles (user_id)
WHERE is_primary = true;

-- 2. Trigger Function: Lock users in sorted UUID order before role mutations
CREATE OR REPLACE FUNCTION public.fn_lock_users_for_role_mutation()
RETURNS TRIGGER AS $$
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
      -- Sort UUIDs to prevent cross-reassignment deadlocks
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
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_user_roles_lock_users_before_mutation ON public.user_roles;
CREATE TRIGGER trg_user_roles_lock_users_before_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.fn_lock_users_for_role_mutation();

-- 3. Trigger Function: Validate primary role deferred invariant
CREATE OR REPLACE FUNCTION public.fn_validate_primary_role_deferred()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_status public."UserStatus";
  v_primary_count INT;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT status INTO v_user_status
  FROM public.users
  WHERE id = v_user_id;

  -- Invariant applies to ACTIVE, SUSPENDED, and INACTIVE users (only PENDING may have 0 primary roles)
  IF (v_user_status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')) THEN
    SELECT COUNT(*) INTO v_primary_count
    FROM public.user_roles
    WHERE user_id = v_user_id AND is_primary = true;

    IF (v_primary_count = 0) THEN
      RAISE EXCEPTION 'Invariant violation: User % in status % must have exactly one primary role',
        v_user_id, v_user_status
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_user_roles_validate_primary_deferred ON public.user_roles;
CREATE CONSTRAINT TRIGGER trg_user_roles_validate_primary_deferred
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_primary_role_deferred();

-- 4. Trigger Function: Validate user activation deferred invariant
CREATE OR REPLACE FUNCTION public.fn_validate_user_activation_deferred()
RETURNS TRIGGER AS $$
DECLARE
  v_primary_count INT;
BEGIN
  IF (NEW.status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')) THEN
    SELECT COUNT(*) INTO v_primary_count
    FROM public.user_roles
    WHERE user_id = NEW.id AND is_primary = true;

    IF (v_primary_count = 0) THEN
      RAISE EXCEPTION 'Invariant violation: Cannot transition user % to % status without a primary role',
        NEW.id, NEW.status
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_users_validate_activation_deferred ON public.users;
CREATE CONSTRAINT TRIGGER trg_users_validate_activation_deferred
AFTER INSERT OR UPDATE ON public.users
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_user_activation_deferred();
