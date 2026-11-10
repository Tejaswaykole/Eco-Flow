-- Rollback Migration 009: Multi-Level BOM & Sub-Assembly Governance
-- Path: database/sql/009_rollback_multi_level_bom.sql

BEGIN;

-- 1. Drop stored procedures and triggers
DROP FUNCTION IF EXISTS public.sp_update_bom_component(UUID, VARCHAR, VARCHAR, public."BOMComponentType", NUMERIC, VARCHAR, NUMERIC, NUMERIC, UUID, INT, BOOLEAN, TEXT, BOOLEAN, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.sp_update_bom_component;
DROP FUNCTION IF EXISTS public.sp_add_bom_component(UUID, UUID, VARCHAR, VARCHAR, public."BOMComponentType", NUMERIC, VARCHAR, NUMERIC, NUMERIC, UUID, INT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.sp_add_bom_component;
DROP TRIGGER IF EXISTS trg_bom_components_cycle_guard ON public.bom_components;
DROP FUNCTION IF EXISTS public.fn_validate_bom_component_cycle();

-- 2. Drop constraints
ALTER TABLE public.bom_components
  DROP CONSTRAINT IF EXISTS chk_bom_component_sub_version_positive,
  DROP CONSTRAINT IF EXISTS chk_bom_component_type_subassembly,
  DROP CONSTRAINT IF EXISTS chk_bom_component_cost_override,
  DROP CONSTRAINT IF EXISTS fk_bom_components_sub_assembly_version,
  DROP CONSTRAINT IF EXISTS fk_bom_components_sub_assembly;

-- 3. Drop indexes
DROP INDEX IF EXISTS public.idx_bom_components_parent_child;
DROP INDEX IF EXISTS public.idx_bom_components_sub_version;
DROP INDEX IF EXISTS public.idx_bom_components_sub_assembly_bom_id;

-- 4. Drop columns (CAUTION: Verify data backup before executing in production)
ALTER TABLE public.bom_components
  DROP COLUMN IF EXISTS cost_override_reason,
  DROP COLUMN IF EXISTS is_cost_overridden,
  DROP COLUMN IF EXISTS sub_assembly_version,
  DROP COLUMN IF EXISTS sub_assembly_bom_id;

COMMIT;

