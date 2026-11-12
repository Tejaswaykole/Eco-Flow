-- Migration 016: Refined Domain RBAC & Least Privilege Boundary Enforcement
-- Workspace: T:\My Projects\ECO-Flow\database
-- Purpose: Introduce granular permissions (bom:release, inventory:write, manufacturing:execute, quality:write)
--          and strictly separate authoring, execution, and approval authorities across all roles.

BEGIN;

-- 1. Insert New Granular Domain Permissions
INSERT INTO public.permissions (id, code, description, module, created_at, updated_at)
VALUES
  ('b0000000-0000-0000-0000-000000000060', 'bom:release', 'Release and freeze bills of materials versions', 'bom', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000061', 'inventory:write', 'Manage warehouses and inventory threshold configurations', 'inventory', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000062', 'manufacturing:execute', 'Execute work order operations, allocate and consume materials', 'manufacturing', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000063', 'quality:write', 'Create and log non-conformance reports (NCR)', 'quality', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  module = EXCLUDED.module,
  updated_at = NOW();

-- Also ensure conflict handling by code if ID differed
INSERT INTO public.permissions (id, code, description, module, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'bom:release', 'Release and freeze bills of materials versions', 'bom', NOW(), NOW()),
  (gen_random_uuid(), 'inventory:write', 'Manage warehouses and inventory threshold configurations', 'inventory', NOW(), NOW()),
  (gen_random_uuid(), 'manufacturing:execute', 'Execute work order operations, allocate and consume materials', 'manufacturing', NOW(), NOW()),
  (gen_random_uuid(), 'quality:write', 'Create and log non-conformance reports (NCR)', 'quality', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- 2. Clear existing non-admin role permissions to rebuild precise, uncompromised role boundaries
DELETE FROM public.role_permissions
WHERE role_id IN (
  'a0000000-0000-0000-0000-000000000002', -- LEAD_ENGINEER
  'a0000000-0000-0000-0000-000000000003', -- APPROVER
  'a0000000-0000-0000-0000-000000000004'  -- OPERATOR
);

-- 3. Associate Administrator Role with ALL Permissions (🟢 FULL System Access)
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', p.id, NOW()
FROM public.permissions p
ON CONFLICT DO NOTHING;

-- 4. Map LEAD_ENGINEER Permissions (✏️ Engineering Management & Operations Authoring)
-- Authorized: Products, BOMs + Release, ECRs (all), ECOs (author/submit/cancel), ECNs (all), Suppliers,
--             Inventory (manage warehouses + transact), Purchasing (create/submit/receive),
--             Manufacturing (create work orders + execute), Quality (inspect + create NCR),
--             Reports, Approvals, Audit.
-- Restricted: System Admin (user/role/permission/health), ECO Approval (eco:approve), PO Approval (purchasing:approve), NCR Decision (quality:decide).
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', p.id, NOW()
FROM public.permissions p
WHERE p.code IN (
  'product:read', 'product:write',
  'bom:read', 'bom:write', 'bom:release',
  'ecr:read', 'ecr:create', 'ecr:review', 'ecr:decide', 'ecr:promote',
  'eco:read', 'eco:create', 'eco:edit', 'eco:submit', 'eco:cancel', 'eco:write',
  'ecn:read', 'ecn:generate', 'ecn:issue', 'ecn:acknowledge', 'ecn:disposition', 'ecn:complete',
  'supplier:read', 'supplier:write',
  'inventory:read', 'inventory:write', 'inventory:transact',
  'purchasing:read', 'purchasing:write',
  'manufacturing:read', 'manufacturing:write', 'manufacturing:execute',
  'quality:read', 'quality:inspect', 'quality:write',
  'reports:read',
  'approvals:read',
  'audit:read'
)
ON CONFLICT DO NOTHING;

-- 5. Map APPROVER Permissions (✅ Independent Review, Signoff & Approval Authority)
-- Authorized: Read all engineering masters (products, boms, ecos, ecns, suppliers, inventory, pos, wos, quality).
--             Decide ECRs, Approve ECO revisions, Acknowledge ECNs, Approve POs, Decide Quality NCRs.
--             View Reports, Approvals workspace, Audit timeline.
-- Restricted: ALL authoring (cannot create/modify products, BOMs, ECRs, ECOs, ECNs, POs, WOs, Suppliers, Warehouses).
--             Cannot release BOMs. Cannot execute manufacturing or inventory. Cannot manage users/roles.
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', p.id, NOW()
FROM public.permissions p
WHERE p.code IN (
  'product:read',
  'bom:read',
  'ecr:read', 'ecr:review', 'ecr:decide',
  'eco:read', 'eco:approve',
  'ecn:read', 'ecn:acknowledge',
  'supplier:read',
  'inventory:read',
  'purchasing:read', 'purchasing:approve',
  'manufacturing:read',
  'quality:read', 'quality:decide',
  'reports:read',
  'approvals:read',
  'audit:read'
)
ON CONFLICT DO NOTHING;

-- 6. Map OPERATOR Permissions (⚙️ Shop-Floor Operations, Execution & Data Entry)
-- Authorized: Read permitted engineering masters (products, boms, ecos, ecns, suppliers, inventory, pos).
--             Create and read ECRs (field issue reports). Acknowledge assigned ECN notices.
--             Execute inventory movements (transact). Execute work orders (start/consume/complete).
--             Record quality inspections. View notifications, personal approvals queue, and activity audit.
-- Restricted: Cannot create or modify BOMs, products, ECOs, ECNs, POs, WOs, or NCRs.
--             Cannot approve ECOs, POs, or decide NCRs. Cannot release BOMs.
--             Cannot create warehouses or change inventory thresholds.
--             Cannot view restricted engineering/inventory/purchasing reports. Cannot manage users or system.
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', p.id, NOW()
FROM public.permissions p
WHERE p.code IN (
  'product:read',
  'bom:read',
  'ecr:read', 'ecr:create',
  'eco:read',
  'ecn:read', 'ecn:acknowledge',
  'supplier:read',
  'inventory:read', 'inventory:transact',
  'purchasing:read',
  'manufacturing:read', 'manufacturing:execute',
  'quality:read', 'quality:inspect',
  'approvals:read',
  'audit:read'
)
ON CONFLICT DO NOTHING;

COMMIT;

