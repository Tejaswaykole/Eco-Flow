-- Migration 010 Rollback: Engineering Change Request (ECR) Support
-- Workspace: T:\My Projects\ECO-Flow\database
-- Milestone 3: Engineering Change Request Implementation

BEGIN;

-- 1. Remove Permissions Mappings
DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id FROM public.permissions WHERE module = 'ecr'
);

-- 2. Remove ECR Permissions
DELETE FROM public.permissions WHERE module = 'ecr';

-- 3. Drop ecr_id Column from ecos Table
ALTER TABLE public.ecos DROP CONSTRAINT IF EXISTS fk_ecos_ecr_id;
DROP INDEX IF EXISTS public.ecos_ecr_id_idx;
ALTER TABLE public.ecos DROP COLUMN IF EXISTS ecr_id;

-- 4. Drop ecrs Table
DROP TABLE IF EXISTS public.ecrs CASCADE;

-- 5. Drop ECR Enums
DROP TYPE IF EXISTS "ECRStatus";
DROP TYPE IF EXISTS "ECRRequestType";

COMMIT;

