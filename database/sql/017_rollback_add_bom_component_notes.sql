-- Rollback Migration 017: Remove notes column from bom_components
-- Workspace: T:\My Projects\ECO-Flow\database

BEGIN;

ALTER TABLE public.bom_components
DROP COLUMN IF EXISTS notes;

COMMIT;

