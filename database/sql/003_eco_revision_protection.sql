-- Migration 003: ECO Revision Lifecycle & Change Protection
-- Workspace: T:\My Projects\ECO-Flow\database

-- 1. Deferrable Composite Foreign Key: ecos.active_revision_no -> eco_revisions (eco_id, revision_number)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ecos_active_revision'
  ) THEN
    ALTER TABLE public.ecos
    ADD CONSTRAINT fk_ecos_active_revision
    FOREIGN KEY (id, active_revision_no)
    REFERENCES public.eco_revisions (eco_id, revision_number)
    ON UPDATE RESTRICT ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- 2. Trigger Function: Enforce eco_revisions lifecycle & submitted revision immutability
CREATE OR REPLACE FUNCTION public.fn_enforce_eco_revision_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
  -- Revisions in terminal or submitted states cannot have their core definition altered
  IF (OLD.status IN ('SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED')) THEN
    IF (OLD.eco_id != NEW.eco_id OR OLD.revision_number != NEW.revision_number) THEN
      RAISE EXCEPTION 'Immutability violation: Identity columns (eco_id, revision_number) cannot be modified'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Revision status state machine transitions
  IF (OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'SUBMITTED', 'CANCELLED')) THEN
    RAISE EXCEPTION 'Invalid lifecycle transition: DRAFT revision can only transition to SUBMITTED or CANCELLED'
      USING ERRCODE = '23514';
  END IF;

  IF (OLD.status = 'SUBMITTED' AND NEW.status NOT IN ('SUBMITTED', 'UNDER_REVIEW', 'CANCELLED')) THEN
    RAISE EXCEPTION 'Invalid lifecycle transition: SUBMITTED revision can only transition to UNDER_REVIEW or CANCELLED'
      USING ERRCODE = '23514';
  END IF;

  IF (OLD.status = 'UNDER_REVIEW' AND NEW.status NOT IN ('UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED')) THEN
    RAISE EXCEPTION 'Invalid lifecycle transition from UNDER_REVIEW to %', NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF (OLD.status IN ('APPROVED', 'REJECTED', 'CANCELLED') AND OLD.status != NEW.status) THEN
    RAISE EXCEPTION 'Terminal state violation: Cannot modify revision in terminal status %', OLD.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_eco_revisions_enforce_lifecycle ON public.eco_revisions;
CREATE TRIGGER trg_eco_revisions_enforce_lifecycle
BEFORE UPDATE ON public.eco_revisions
FOR EACH ROW
EXECUTE FUNCTION public.fn_enforce_eco_revision_lifecycle();

-- 3. Trigger Function: Sync ECO header status from active revision
CREATE OR REPLACE FUNCTION public.fn_sync_eco_header_from_active_revision()
RETURNS TRIGGER AS $$
DECLARE
  v_active_rev INT;
BEGIN
  -- Fetch the current active revision number for the parent ECO
  SELECT active_revision_no INTO v_active_rev
  FROM public.ecos
  WHERE id = NEW.eco_id;

  -- Synchronize only if the mutated revision is currently the active revision
  IF (v_active_rev = NEW.revision_number) THEN
    UPDATE public.ecos
    SET status = NEW.status,
        updated_at = clock_timestamp()
    WHERE id = NEW.eco_id
      AND status IS DISTINCT FROM NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_eco_revisions_sync_header_status ON public.eco_revisions;
CREATE TRIGGER trg_eco_revisions_sync_header_status
AFTER INSERT OR UPDATE ON public.eco_revisions
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_eco_header_from_active_revision();

-- 4. Trigger Function: Sync ECO status on pointer change
CREATE OR REPLACE FUNCTION public.fn_sync_eco_status_on_pointer_change()
RETURNS TRIGGER AS $$
DECLARE
  v_rev_status public."ECOStatus";
BEGIN
  IF (OLD.active_revision_no IS DISTINCT FROM NEW.active_revision_no) THEN
    SELECT status INTO v_rev_status
    FROM public.eco_revisions
    WHERE eco_id = NEW.id AND revision_number = NEW.active_revision_no;

    IF FOUND THEN
      NEW.status := v_rev_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_ecos_sync_status_on_pointer_change ON public.ecos;
CREATE TRIGGER trg_ecos_sync_status_on_pointer_change
BEFORE UPDATE OF active_revision_no ON public.ecos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_eco_status_on_pointer_change();

-- 5. Trigger Function: Protect ECO Product and BOM immutability
CREATE OR REPLACE FUNCTION public.fn_protect_eco_product_bom_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.product_id != NEW.product_id) THEN
    RAISE EXCEPTION 'Immutability violation: Cannot modify product_id of an established ECO'
      USING ERRCODE = '23514';
  END IF;

  IF (OLD.bom_id != NEW.bom_id) THEN
    RAISE EXCEPTION 'Immutability violation: Cannot modify bom_id of an established ECO'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_ecos_protect_product_bom ON public.ecos;
CREATE TRIGGER trg_ecos_protect_product_bom
BEFORE UPDATE OF product_id, bom_id ON public.ecos
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_eco_product_bom_immutability();

-- 6. Trigger Function: Protect ECO Changes (Modifications allowed only in DRAFT)
CREATE OR REPLACE FUNCTION public.fn_protect_eco_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_eco_id UUID;
  v_eco_status public."ECOStatus";
BEGIN
  v_eco_id := COALESCE(NEW.eco_id, OLD.eco_id);

  SELECT status INTO v_eco_status
  FROM public.ecos
  WHERE id = v_eco_id;

  IF (v_eco_status != 'DRAFT') THEN
    RAISE EXCEPTION 'Precondition violation: ECO changes can only be inserted, updated, or deleted while ECO is in DRAFT status (current status: %)',
      v_eco_status
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
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_eco_changes_enforce_draft ON public.eco_changes;
CREATE TRIGGER trg_eco_changes_enforce_draft
BEFORE INSERT OR UPDATE OR DELETE ON public.eco_changes
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_eco_changes();
