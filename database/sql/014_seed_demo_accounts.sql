-- Migration 014: Seed Demo RBAC Accounts
-- Workspace: T:\My Projects\ECO-Flow\database
-- Purpose: Seeds standard demo users matching frontend quick-login credentials with Argon2id password hashes

BEGIN;

-- Pre-computed Argon2id hash for 'Password123!' (m=65536, t=3, p=1)
-- Hash: $argon2id$v=19$m=65536,t=3,p=1$Bd70U3fozPMOOoWY1Izd3w$Irmqid4bEi+ajLZi1TLdRrlLe6kcjLLCRjcYufu84iQ

-- 1. Update initial system root admin account with valid Argon2id hash
UPDATE public.users
SET 
  password_hash = '$argon2id$v=19$m=65536,t=3,p=1$Bd70U3fozPMOOoWY1Izd3w$Irmqid4bEi+ajLZi1TLdRrlLe6kcjLLCRjcYufu84iQ',
  status = 'ACTIVE',
  updated_at = NOW()
WHERE email = 'system.admin@ecoflow.internal';

-- 2. Seed Administrator Demo Account
INSERT INTO public.users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
VALUES (
  'c0000000-0000-0000-0000-000000000002',
  'admin@ecoflow.internal',
  '$argon2id$v=19$m=65536,t=3,p=1$Bd70U3fozPMOOoWY1Izd3w$Irmqid4bEi+ajLZi1TLdRrlLe6kcjLLCRjcYufu84iQ',
  'System',
  'Admin',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = 'ACTIVE',
  updated_at = NOW();

INSERT INTO public.user_roles (id, user_id, role_id, is_primary, created_at)
VALUES (
  'd0000000-0000-0000-0000-000000000002',
  (SELECT id FROM public.users WHERE email = 'admin@ecoflow.internal'),
  'a0000000-0000-0000-0000-000000000001', -- ADMINISTRATOR
  true,
  NOW()
)
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = true;

-- 3. Seed Lead Engineer Demo Account
INSERT INTO public.users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
VALUES (
  'c0000000-0000-0000-0000-000000000003',
  'engineer@ecoflow.internal',
  '$argon2id$v=19$m=65536,t=3,p=1$Bd70U3fozPMOOoWY1Izd3w$Irmqid4bEi+ajLZi1TLdRrlLe6kcjLLCRjcYufu84iQ',
  'Lead',
  'Engineer',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = 'ACTIVE',
  updated_at = NOW();

INSERT INTO public.user_roles (id, user_id, role_id, is_primary, created_at)
VALUES (
  'd0000000-0000-0000-0000-000000000003',
  (SELECT id FROM public.users WHERE email = 'engineer@ecoflow.internal'),
  'a0000000-0000-0000-0000-000000000002', -- LEAD_ENGINEER
  true,
  NOW()
)
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = true;

-- 4. Seed Approver Demo Account
INSERT INTO public.users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
VALUES (
  'c0000000-0000-0000-0000-000000000004',
  'approver@ecoflow.internal',
  '$argon2id$v=19$m=65536,t=3,p=1$Bd70U3fozPMOOoWY1Izd3w$Irmqid4bEi+ajLZi1TLdRrlLe6kcjLLCRjcYufu84iQ',
  'Quality',
  'Approver',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = 'ACTIVE',
  updated_at = NOW();

INSERT INTO public.user_roles (id, user_id, role_id, is_primary, created_at)
VALUES (
  'd0000000-0000-0000-0000-000000000004',
  (SELECT id FROM public.users WHERE email = 'approver@ecoflow.internal'),
  'a0000000-0000-0000-0000-000000000003', -- APPROVER
  true,
  NOW()
)
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = true;

-- 5. Seed Operator Demo Account
INSERT INTO public.users (id, email, password_hash, first_name, last_name, status, created_at, updated_at)
VALUES (
  'c0000000-0000-0000-0000-000000000005',
  'operator@ecoflow.internal',
  '$argon2id$v=19$m=65536,t=3,p=1$Bd70U3fozPMOOoWY1Izd3w$Irmqid4bEi+ajLZi1TLdRrlLe6kcjLLCRjcYufu84iQ',
  'Floor',
  'Operator',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = 'ACTIVE',
  updated_at = NOW();

INSERT INTO public.user_roles (id, user_id, role_id, is_primary, created_at)
VALUES (
  'd0000000-0000-0000-0000-000000000005',
  (SELECT id FROM public.users WHERE email = 'operator@ecoflow.internal'),
  'a0000000-0000-0000-0000-000000000004', -- OPERATOR
  true,
  NOW()
)
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = true;

COMMIT;

