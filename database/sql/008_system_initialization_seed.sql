-- Migration 008: System Initialization Seed Data
-- Workspace: T:\My Projects\ECO-Flow\database

-- Run as single atomic transaction to satisfy primary role deferred triggers
BEGIN;

-- 1. Seed System Roles
INSERT INTO public.roles (id, name, description, is_system, created_at, updated_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'ADMINISTRATOR', 'Full system administrative authority', true, NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000002', 'LEAD_ENGINEER', 'Author and manage engineering change orders and revisions', true, NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000003', 'APPROVER', 'Review and approve/reject ECO change submissions', true, NOW(), NOW()),
  ('a0000000-0000-0000-0000-000000000004', 'OPERATOR', 'Read-only access to released products and BOMs', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Standard Permissions
INSERT INTO public.permissions (id, code, description, module, created_at, updated_at)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'admin:all', 'Complete administrative capability', 'admin', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000002', 'eco:create', 'Create new engineering change orders', 'eco', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000003', 'eco:edit', 'Edit draft change orders', 'eco', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000004', 'eco:submit', 'Submit change orders for approval', 'eco', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000005', 'eco:approve', 'Approve or reject submitted changes', 'eco', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000006', 'eco:cancel', 'Cancel change orders', 'eco', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000007', 'product:read', 'Read products and versions', 'product', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000008', 'product:write', 'Create and modify draft products', 'product', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000009', 'bom:read', 'Read bills of materials and versions', 'bom', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000010', 'bom:write', 'Create and modify draft BOMs', 'bom', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Associate Permissions to Administrator Role
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000001',
  p.id,
  NOW()
FROM public.permissions p
ON CONFLICT DO NOTHING;

-- Associate Permissions to Lead Engineer Role
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000002',
  p.id,
  NOW()
FROM public.permissions p
WHERE p.code IN ('eco:create', 'eco:edit', 'eco:submit', 'eco:cancel', 'product:read', 'bom:read', 'bom:write')
ON CONFLICT DO NOTHING;

-- Associate Permissions to Approver Role
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000003',
  p.id,
  NOW()
FROM public.permissions p
WHERE p.code IN ('eco:approve', 'product:read', 'bom:read')
ON CONFLICT DO NOTHING;

-- Associate Permissions to Operator Role
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000004',
  p.id,
  NOW()
FROM public.permissions p
WHERE p.code IN ('product:read', 'bom:read')
ON CONFLICT DO NOTHING;

-- 4. Seed Initial System Root User (with exactly one primary role to satisfy deferred trigger)
INSERT INTO public.users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'system.admin@ecoflow.internal',
  '$2b$10$wZ4BqA9L9hE1d1JzJzJzJuWzFpPspKmvyMoakobMsjExamplePlaceholder',
  'System',
  'Administrator',
  'ACTIVE',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (id, user_id, role_id, is_primary, created_at)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  true,
  NOW()
) ON CONFLICT (id) DO NOTHING;

COMMIT;
