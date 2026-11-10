-- Migration 009: Multi-Level BOM & Sub-Assembly Governance (Final Validated)
-- Path: database/sql/009_multi_level_bom_support.sql

BEGIN;

-- 1. Pre-flight integrity check on existing data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'bom_components' 
      AND column_name = 'sub_assembly_bom_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.bom_components bc 
      LEFT JOIN public.boms b ON bc.sub_assembly_bom_id = b.id 
      WHERE bc.sub_assembly_bom_id IS NOT NULL AND b.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Pre-check failed: Found bom_components referencing non-existent boms';
    END IF;
  END IF;
END $$;

-- 2. Extend bom_components table with sub-assembly references and cost override controls
ALTER TABLE public.bom_components
  ADD COLUMN IF NOT EXISTS sub_assembly_bom_id UUID NULL,
  ADD COLUMN IF NOT EXISTS sub_assembly_version INT NULL,
  ADD COLUMN IF NOT EXISTS is_cost_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cost_override_reason TEXT NULL;

-- 3. Foreign Key: Restrict child BOM deletion when actively used as a sub-assembly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_bom_components_sub_assembly'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT fk_bom_components_sub_assembly
      FOREIGN KEY (sub_assembly_bom_id)
      REFERENCES public.boms(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 4. Composite Foreign Key: Child Version Pinning validation against bom_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_bom_components_sub_assembly_version'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT fk_bom_components_sub_assembly_version
      FOREIGN KEY (sub_assembly_bom_id, sub_assembly_version)
      REFERENCES public.bom_versions(bom_id, version_number)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bom_components_sub_assembly_bom_id 
  ON public.bom_components(sub_assembly_bom_id);

CREATE INDEX IF NOT EXISTS idx_bom_components_sub_version 
  ON public.bom_components(sub_assembly_bom_id, sub_assembly_version);

CREATE INDEX IF NOT EXISTS idx_bom_components_parent_child 
  ON public.bom_components(bom_id, sub_assembly_bom_id);

-- 6. Check Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_bom_component_cost_override'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT chk_bom_component_cost_override
      CHECK (
        is_cost_overridden = FALSE OR 
        (is_cost_overridden = TRUE AND cost_override_reason IS NOT NULL AND length(trim(cost_override_reason)) > 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_bom_component_type_subassembly'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT chk_bom_component_type_subassembly
      CHECK (sub_assembly_bom_id IS NULL OR component_type = 'SUB_ASSEMBLY');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_bom_component_sub_version_positive'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT chk_bom_component_sub_version_positive
      CHECK (sub_assembly_version IS NULL OR (sub_assembly_version > 0 AND sub_assembly_bom_id IS NOT NULL));
  END IF;
END $$;

-- 7. Trigger Function: Concurrency, Cycle, and Combined Ancestor + Descendant Depth Validation
CREATE OR REPLACE FUNCTION public.fn_validate_bom_component_cycle()
RETURNS TRIGGER AS $$
DECLARE
  v_cycle_detected BOOLEAN := FALSE;
  v_max_ancestor_depth INT := 0;
  v_max_descendant_depth INT := 0;
  v_total_resulting_depth INT := 0;
  v_hierarchy_lock_key CONSTANT BIGINT := 4200000001001;
BEGIN
  -- Only validate when a sub-assembly link is added or updated
  IF NEW.sub_assembly_bom_id IS NOT NULL AND 
     (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.sub_assembly_bom_id IS DISTINCT FROM NEW.sub_assembly_bom_id OR OLD.bom_id IS DISTINCT FROM NEW.bom_id))) THEN
    
    -- Fast-Fail: Direct self-reference
    IF NEW.bom_id = NEW.sub_assembly_bom_id THEN
      RAISE EXCEPTION 'Circular BOM violation: BOM % cannot reference itself as a sub-assembly', NEW.bom_id
        USING ERRCODE = '23514';
    END IF;

    -- Defensive advisory lock check
    PERFORM pg_advisory_xact_lock(v_hierarchy_lock_key);

    -- 1. Ancestor Traversal (Depth above Parent BOM)
    -- Tracks paths per branch to allow diamond dependencies without false cycle flags
    WITH RECURSIVE ancestor_tree AS (
      SELECT 
        bom_id, 
        sub_assembly_bom_id, 
        1 AS depth, 
        ARRAY[bom_id, NEW.bom_id] AS path
      FROM public.bom_components
      WHERE sub_assembly_bom_id = NEW.bom_id
        AND (TG_OP = 'INSERT' OR id <> OLD.id)

      UNION ALL

      SELECT 
        bc.bom_id, 
        bc.sub_assembly_bom_id, 
        at.depth + 1, 
        at.path || bc.bom_id
      FROM public.bom_components bc
      JOIN ancestor_tree at ON bc.sub_assembly_bom_id = at.bom_id
      WHERE (TG_OP = 'INSERT' OR bc.id <> OLD.id)
        AND NOT (bc.bom_id = ANY(at.path)) -- Visited protection prevents runaway recursion
        AND at.depth <= 11
    )
    SELECT 
      COALESCE(MAX(depth), 0),
      EXISTS (SELECT 1 FROM ancestor_tree WHERE bom_id = NEW.sub_assembly_bom_id)
    INTO v_max_ancestor_depth, v_cycle_detected
    FROM ancestor_tree;

    IF v_cycle_detected THEN
      RAISE EXCEPTION 'Circular BOM violation: Adding sub-assembly % creates a recursive dependency cycle with ancestor BOMs',
        NEW.sub_assembly_bom_id
        USING ERRCODE = '23514';
    END IF;

    -- 2. Descendant Traversal (Depth below Child Sub-Assembly)
    WITH RECURSIVE descendant_tree AS (
      SELECT 
        bom_id, 
        sub_assembly_bom_id, 
        1 AS depth, 
        ARRAY[NEW.sub_assembly_bom_id, sub_assembly_bom_id] AS path
      FROM public.bom_components
      WHERE bom_id = NEW.sub_assembly_bom_id
        AND sub_assembly_bom_id IS NOT NULL

      UNION ALL

      SELECT 
        bc.bom_id, 
        bc.sub_assembly_bom_id, 
        dt.depth + 1, 
        dt.path || bc.sub_assembly_bom_id
      FROM public.bom_components bc
      JOIN descendant_tree dt ON bc.bom_id = dt.sub_assembly_bom_id
      WHERE bc.sub_assembly_bom_id IS NOT NULL
        AND NOT (bc.sub_assembly_bom_id = ANY(dt.path))
        AND dt.depth <= 11
    )
    SELECT COALESCE(MAX(depth), 0) INTO v_max_descendant_depth FROM descendant_tree;

    -- Total resulting root-to-leaf depth:
    -- Max Ancestor Depth of Parent + 1 (new edge) + Max Descendant Depth of Child
    v_total_resulting_depth := v_max_ancestor_depth + 1 + v_max_descendant_depth;

    IF v_total_resulting_depth > 10 THEN
      RAISE EXCEPTION 'Hierarchy limit violation: Resulting hierarchy depth (% levels) exceeds maximum supported depth of 10 levels',
        v_total_resulting_depth
        USING ERRCODE = '54001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_bom_components_cycle_guard ON public.bom_components;
CREATE TRIGGER trg_bom_components_cycle_guard
BEFORE INSERT OR UPDATE OF bom_id, sub_assembly_bom_id ON public.bom_components
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_bom_component_cycle();

-- 8. Database-Controlled Mutation Interface (For Trusted Writers / Maintenance Scripts)
CREATE OR REPLACE FUNCTION public.sp_add_bom_component(
  p_id UUID,
  p_bom_id UUID,
  p_part_number VARCHAR(100),
  p_name VARCHAR(255),
  p_component_type public."BOMComponentType",
  p_quantity NUMERIC(12, 4),
  p_unit_of_measure VARCHAR(50),
  p_unit_cost NUMERIC(12, 2),
  p_total_cost NUMERIC(14, 2),
  p_sub_assembly_bom_id UUID DEFAULT NULL,
  p_sub_assembly_version INT DEFAULT NULL,
  p_is_cost_overridden BOOLEAN DEFAULT FALSE,
  p_cost_override_reason TEXT DEFAULT NULL
)
RETURNS public.bom_components AS $$
DECLARE
  v_res public.bom_components;
BEGIN
  -- Explicitly acquire transaction-scoped advisory lock before mutation statement
  PERFORM pg_advisory_xact_lock(4200000001001);

  INSERT INTO public.bom_components (
    id, bom_id, part_number, name, component_type, quantity, unit_of_measure, unit_cost, total_cost,
    sub_assembly_bom_id, sub_assembly_version, is_cost_overridden, cost_override_reason, created_at, updated_at
  ) VALUES (
    p_id, p_bom_id, p_part_number, p_name, p_component_type, p_quantity, p_unit_of_measure, p_unit_cost, p_total_cost,
    p_sub_assembly_bom_id, p_sub_assembly_version, p_is_cost_overridden, p_cost_override_reason, NOW(), NOW()
  )
  RETURNING * INTO v_res;

  RETURN v_res;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

CREATE OR REPLACE FUNCTION public.sp_update_bom_component(
  p_id UUID,
  p_part_number VARCHAR(100) DEFAULT NULL,
  p_name VARCHAR(255) DEFAULT NULL,
  p_component_type public."BOMComponentType" DEFAULT NULL,
  p_quantity NUMERIC(12, 4) DEFAULT NULL,
  p_unit_of_measure VARCHAR(50) DEFAULT NULL,
  p_unit_cost NUMERIC(12, 2) DEFAULT NULL,
  p_total_cost NUMERIC(14, 2) DEFAULT NULL,
  p_sub_assembly_bom_id UUID DEFAULT NULL,
  p_sub_assembly_version INT DEFAULT NULL,
  p_is_cost_overridden BOOLEAN DEFAULT NULL,
  p_cost_override_reason TEXT DEFAULT NULL,
  p_clear_sub_assembly BOOLEAN DEFAULT FALSE,
  p_clear_sub_version BOOLEAN DEFAULT FALSE,
  p_clear_cost_override BOOLEAN DEFAULT FALSE
)
RETURNS public.bom_components AS $$
DECLARE
  v_res public.bom_components;
BEGIN
  -- Explicitly acquire transaction-scoped advisory lock before mutation statement
  PERFORM pg_advisory_xact_lock(4200000001001);

  UPDATE public.bom_components
  SET
    part_number = COALESCE(p_part_number, part_number),
    name = COALESCE(p_name, name),
    component_type = COALESCE(p_component_type, component_type),
    quantity = COALESCE(p_quantity, quantity),
    unit_of_measure = COALESCE(p_unit_of_measure, unit_of_measure),
    unit_cost = COALESCE(p_unit_cost, unit_cost),
    total_cost = COALESCE(p_total_cost, total_cost),
    -- Sub-assembly reference update logic:
    -- 1. If explicit clear requested: set to NULL
    -- 2. If new value supplied: update to supplied value
    -- 3. If omitted (NULL & clear=FALSE): preserve existing value
    sub_assembly_bom_id = CASE 
      WHEN p_clear_sub_assembly THEN NULL
      WHEN p_sub_assembly_bom_id IS NOT NULL THEN p_sub_assembly_bom_id
      ELSE sub_assembly_bom_id
    END,
    sub_assembly_version = CASE
      WHEN p_clear_sub_assembly OR p_clear_sub_version THEN NULL
      WHEN p_sub_assembly_version IS NOT NULL THEN p_sub_assembly_version
      ELSE sub_assembly_version
    END,
    is_cost_overridden = CASE
      WHEN p_clear_cost_override THEN FALSE
      WHEN p_is_cost_overridden IS NOT NULL THEN p_is_cost_overridden
      ELSE is_cost_overridden
    END,
    cost_override_reason = CASE
      WHEN p_clear_cost_override THEN NULL
      WHEN p_cost_override_reason IS NOT NULL THEN p_cost_override_reason
      ELSE cost_override_reason
    END,
    updated_at = NOW()
  WHERE id = p_id
  RETURNING * INTO v_res;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOM Component with ID % not found', p_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_res;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

COMMIT;

