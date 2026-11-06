-- Migration 006: Idempotency Lease Constraints
-- Workspace: T:\My Projects\ECO-Flow\database

-- 1. Partial Index for Active Leases
CREATE INDEX IF NOT EXISTS idx_idempotency_active_leases
ON public.idempotency_keys (scope, lease_expires)
WHERE status = 'PROCESSING';

-- 2. Trigger Function: Protect Idempotency Identity
CREATE OR REPLACE FUNCTION public.fn_protect_idempotency_identity()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.scope != NEW.scope OR OLD.key != NEW.key OR OLD.request_hash != NEW.request_hash OR OLD.actor_id != NEW.actor_id) THEN
    RAISE EXCEPTION 'Immutability violation: Identity columns (scope, key, request_hash, actor_id) cannot be modified'
      USING ERRCODE = '23514';
  END IF;

  -- Once COMPLETED, status and response payload cannot be overwritten
  IF (OLD.status = 'COMPLETED') THEN
    IF (NEW.status != 'COMPLETED' OR OLD.response_payload IS DISTINCT FROM NEW.response_payload) THEN
      RAISE EXCEPTION 'Terminal state violation: Completed idempotency records cannot be modified'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_idempotency_keys_protect_identity ON public.idempotency_keys;
CREATE TRIGGER trg_idempotency_keys_protect_identity
BEFORE UPDATE ON public.idempotency_keys
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_idempotency_identity();
