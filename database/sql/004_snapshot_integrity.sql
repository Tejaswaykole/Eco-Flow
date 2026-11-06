-- Migration 004: Snapshot Integrity & Existence
-- Workspace: T:\My Projects\ECO-Flow\database

-- 1. Generic Immutability Trigger Function (Rejects UPDATE and DELETE)
CREATE OR REPLACE FUNCTION public.fn_reject_update_or_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutability violation: Rows in table % are strictly append-only and cannot be updated or deleted',
    TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

-- 2. Apply immutability trigger to eco_revision_snapshots
DROP TRIGGER IF EXISTS trg_eco_revision_snapshots_immutable ON public.eco_revision_snapshots;
CREATE TRIGGER trg_eco_revision_snapshots_immutable
BEFORE UPDATE OR DELETE ON public.eco_revision_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.fn_reject_update_or_delete();

-- 3. Trigger Function: Require snapshot for submitted revisions (Deferred check)
CREATE OR REPLACE FUNCTION public.fn_check_submitted_revision_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_snapshot_count INT;
BEGIN
  -- When a revision moves into SUBMITTED or any downstream review/approval status, a snapshot must exist
  IF (NEW.status IN ('SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED')) THEN
    SELECT COUNT(*) INTO v_snapshot_count
    FROM public.eco_revision_snapshots
    WHERE eco_id = NEW.eco_id AND revision_number = NEW.revision_number;

    IF (v_snapshot_count = 0) THEN
      RAISE EXCEPTION 'Precondition violation: Revision % of ECO % cannot transition to % without a frozen snapshot',
        NEW.revision_number, NEW.eco_id, NEW.status
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_eco_revisions_require_snapshot_deferred ON public.eco_revisions;
CREATE CONSTRAINT TRIGGER trg_eco_revisions_require_snapshot_deferred
AFTER INSERT OR UPDATE ON public.eco_revisions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_submitted_revision_snapshot();
