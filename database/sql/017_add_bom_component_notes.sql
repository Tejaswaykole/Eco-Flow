-- Migration 017: Add notes column to bom_components
-- Workspace: T:\My Projects\ECO-Flow\database
-- Purpose: Support engineering notes, tolerances, and impact details on BOM component line items

BEGIN;

ALTER TABLE public.bom_components
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMIT;

