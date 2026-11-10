-- Migration 011 Rollback: Engineering Change Notice (ECN) Support
-- Workspace: T:\My Projects\ECO-Flow\database
-- Milestone 4: Engineering Change Notice Implementation

BEGIN;

-- 1. Remove Permissions Mappings
DELETE FROM public.role_permissions
WHERE permission_id IN (
  SELECT id FROM public.permissions WHERE module = 'ecn'
);

-- 2. Remove ECN Permissions
DELETE FROM public.permissions WHERE module = 'ecn';

-- 3. Drop ECN Tables
DROP TABLE IF EXISTS public.ecn_material_dispositions CASCADE;
DROP TABLE IF EXISTS public.ecn_distributions CASCADE;
DROP TABLE IF EXISTS public.ecns CASCADE;

-- 4. Drop ECN Enums
DROP TYPE IF EXISTS "MaterialDispositionType";
DROP TYPE IF EXISTS "ECNAcknowledgementStatus";
DROP TYPE IF EXISTS "ECNDepartment";
DROP TYPE IF EXISTS "ECNStatus";

COMMIT;

