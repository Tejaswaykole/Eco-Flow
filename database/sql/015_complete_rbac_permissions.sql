-- Migration 015: Complete RBAC Permissions & Role Boundaries
-- Workspace: T:\My Projects\ECO-Flow\database
-- Purpose: Complete granular domain permissions and establish strict least-privilege role boundaries matching ECOFlow RBAC Cheat Sheet

BEGIN;

-- 1. Insert Missing Domain Permissions
INSERT INTO public.permissions (id, code, description, module, created_at, updated_at)
VALUES
  ('b0000000-0000-0000-0000-000000000050', 'eco:read', 'Read engineering change orders and revisions', 'eco', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000051', 'eco:write', 'Modify engineering change order proposals', 'eco', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000052', 'approvals:read', 'View approval queues and workflow metrics', 'approvals', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000053', 'reports:read', 'View and export operational reports and analytics', 'reports', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000054', 'audit:read', 'View system audit logs and activity timeline', 'audit', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000055', 'user:read', 'View system user profiles and team directory', 'users', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000056', 'user:write', 'Manage users, activations, and assignments', 'users', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000057', 'role:read', 'View system roles and permission matrices', 'roles', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000058', 'role:write', 'Manage system roles and permissions', 'roles', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Clear existing non-admin role permissions to re-establish clean boundaries
DELETE FROM public.role_permissions
WHERE role_id IN (
  'a0000000-0000-0000-0000-000000000002', -- LEAD_ENGINEER
  'a0000000-0000-0000-0000-000000000003', -- APPROVER
  'a0000000-0000-0000-0000-000000000004'  -- OPERATOR
);

-- 3. Associate Administrator Role with ALL Permissions (🟢 FULL)
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', p.id, NOW()
FROM public.permissions p
ON CONFLICT DO NOTHING;

-- 4. Map LEAD_ENGINEER Permissions (✏️ MANAGE / 👁️ VIEW)
-- Manage products, BOMs, ECRs, ECOs, ECNs, suppliers, inventory, purchasing, manufacturing, quality inspection, reports.
-- Explicitly barred from user/role administration, ECO approval (eco:approve), PO signoff (purchasing:approve), and NCR closing (quality:decide).
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', p.id, NOW()
FROM public.permissions p
WHERE p.code IN (
  'product:read', 'product:write',
  'bom:read', 'bom:write',
  'ecr:create', 'ecr:read', 'ecr:review', 'ecr:decide', 'ecr:promote',
  'eco:read', 'eco:create', 'eco:edit', 'eco:submit', 'eco:cancel', 'eco:write',
  'ecn:read', 'ecn:generate', 'ecn:issue', 'ecn:acknowledge', 'ecn:disposition', 'ecn:complete',
  'supplier:read', 'supplier:write',
  'inventory:read', 'inventory:transact',
  'purchasing:read', 'purchasing:write',
  'manufacturing:read', 'manufacturing:write',
  'quality:read', 'quality:inspect',
  'reports:read',
  'audit:read',
  'approvals:read'
);

-- 5. Map APPROVER Permissions (✅ APPROVE / 👁️ VIEW)
-- Decision and signoff authority for ECOs, ECRs, POs, Quality NCRs. Read-only on engineering masters.
-- Explicitly barred from engineering authoring (bom:write, eco:create, ecn:generate, ecn:issue), inventory movements, PO authoring, user admin.
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', p.id, NOW()
FROM public.permissions p
WHERE p.code IN (
  'approvals:read',
  'eco:read', 'eco:approve',
  'ecr:read', 'ecr:review', 'ecr:decide', 'ecr:create',
  'ecn:read', 'ecn:acknowledge',
  'purchasing:read', 'purchasing:approve',
  'quality:read', 'quality:decide',
  'product:read', 'bom:read',
  'supplier:read',
  'inventory:read',
  'manufacturing:read',
  'reports:read',
  'audit:read'
);

-- 6. Map OPERATOR Permissions (⚙️ EXECUTE / 👁️ VIEW / ✏️ CREATE ECR)
-- Shop-floor execution and reporting: view products, BOMs, ECOs, ECNs, suppliers, POs.
-- Execute inventory movements & work orders; record quality inspections; create and view ECRs; view permitted reports & audit.
-- Explicitly barred from BOM/ECO revision release, ECO approval, ECN issuance, PO approval, NCR close, and user administration.
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', p.id, NOW()
FROM public.permissions p
WHERE p.code IN (
  'product:read',
  'bom:read',
  'eco:read',
  'ecr:create', 'ecr:read',
  'ecn:read', 'ecn:acknowledge',
  'supplier:read',
  'inventory:read', 'inventory:transact',
  'purchasing:read',
  'manufacturing:read', 'manufacturing:write',
  'quality:read', 'quality:inspect',
  'approvals:read',
  'audit:read'
);

COMMIT;
