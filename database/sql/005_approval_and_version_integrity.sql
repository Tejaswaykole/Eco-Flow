-- Migration 005: Version, Approval & Release Integrity
-- Workspace: T:\My Projects\ECO-Flow\database

-- 1. Approvals Immutability (Decision and justification are frozen once recorded)
DROP TRIGGER IF EXISTS trg_approvals_immutable ON public.approvals;
CREATE TRIGGER trg_approvals_immutable
BEFORE UPDATE OR DELETE ON public.approvals
FOR EACH ROW
EXECUTE FUNCTION public.fn_reject_update_or_delete();

-- 2. Product Versions Immutability (Generated versions are strictly append-only)
DROP TRIGGER IF EXISTS trg_product_versions_immutable ON public.product_versions;
CREATE TRIGGER trg_product_versions_immutable
BEFORE UPDATE OR DELETE ON public.product_versions
FOR EACH ROW
EXECUTE FUNCTION public.fn_reject_update_or_delete();

-- 3. BOM Versions Immutability (Generated BOM versions are strictly append-only)
DROP TRIGGER IF EXISTS trg_bom_versions_immutable ON public.bom_versions;
CREATE TRIGGER trg_bom_versions_immutable
BEFORE UPDATE OR DELETE ON public.bom_versions
FOR EACH ROW
EXECUTE FUNCTION public.fn_reject_update_or_delete();

-- 4. Controlled Version Release Lifecycle
CREATE OR REPLACE FUNCTION public.fn_protect_version_releases()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'Immutability violation: Version release records cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Identity references cannot be modified
    IF (OLD.eco_id != NEW.eco_id OR OLD.product_id != NEW.product_id OR
        OLD.product_version_id != NEW.product_version_id OR OLD.bom_version_id != NEW.bom_version_id) THEN
      RAISE EXCEPTION 'Immutability violation: Identity columns of a version release cannot be modified'
        USING ERRCODE = '23514';
    END IF;

    -- Release lifecycle transitions: SCHEDULED -> RELEASED -> DEPRECATED
    IF (OLD.status = 'SCHEDULED' AND NEW.status NOT IN ('SCHEDULED', 'RELEASED')) THEN
      RAISE EXCEPTION 'Invalid release transition from SCHEDULED to %', NEW.status
        USING ERRCODE = '23514';
    END IF;

    IF (OLD.status = 'RELEASED' AND NEW.status NOT IN ('RELEASED', 'DEPRECATED')) THEN
      RAISE EXCEPTION 'Invalid release transition from RELEASED to %', NEW.status
        USING ERRCODE = '23514';
    END IF;

    IF (OLD.status = 'DEPRECATED' AND OLD.status != NEW.status) THEN
      RAISE EXCEPTION 'Terminal status: DEPRECATED releases cannot be transitioned'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_version_releases_controlled_mutation ON public.version_releases;
CREATE TRIGGER trg_version_releases_controlled_mutation
BEFORE UPDATE OR DELETE ON public.version_releases
FOR EACH ROW
EXECUTE FUNCTION public.fn_protect_version_releases();
