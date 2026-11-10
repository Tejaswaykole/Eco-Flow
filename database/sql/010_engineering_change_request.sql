-- Migration 010: Engineering Change Request (ECR) Support
-- Workspace: T:\My Projects\ECO-Flow\database
-- Milestone 3: Engineering Change Request Implementation

BEGIN;

-- 1. Create Enums for ECR
DO $$ BEGIN
  CREATE TYPE "ECRRequestType" AS ENUM ('DEFECT', 'IMPROVEMENT', 'COST_REDUCTION', 'SAFETY', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ECRStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'ACCEPTED', 'REJECTED', 'PROMOTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create ecrs Table
CREATE TABLE IF NOT EXISTS public.ecrs (
    id UUID NOT NULL,
    ecr_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    request_type "ECRRequestType" NOT NULL,
    priority "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    status "ECRStatus" NOT NULL DEFAULT 'SUBMITTED',
    product_id UUID,
    bom_id UUID,
    submitted_by UUID NOT NULL,
    assigned_to UUID,
    affected_part_number VARCHAR(100),
    suggested_solution TEXT,
    review_comments TEXT,
    rejection_reason TEXT,
    promoted_eco_id UUID,
    submitted_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ecrs_pkey PRIMARY KEY (id),
    CONSTRAINT ecrs_ecr_number_key UNIQUE (ecr_number),
    CONSTRAINT ecrs_promoted_eco_id_key UNIQUE (promoted_eco_id),
    CONSTRAINT fk_ecrs_submitted_by FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ecrs_assigned_to FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ecrs_product_id FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ecrs_bom_id FOREIGN KEY (bom_id) REFERENCES public.boms(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ecrs_promoted_eco_id FOREIGN KEY (promoted_eco_id) REFERENCES public.ecos(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3. Add ecr_id Column to ecos Table
DO $$ BEGIN
  ALTER TABLE public.ecos ADD COLUMN ecr_id UUID UNIQUE;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.ecos ADD CONSTRAINT fk_ecos_ecr_id FOREIGN KEY (ecr_id) REFERENCES public.ecrs(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS ecrs_status_idx ON public.ecrs(status);
CREATE INDEX IF NOT EXISTS ecrs_submitted_by_idx ON public.ecrs(submitted_by);
CREATE INDEX IF NOT EXISTS ecrs_assigned_to_idx ON public.ecrs(assigned_to);
CREATE INDEX IF NOT EXISTS ecrs_product_id_idx ON public.ecrs(product_id);
CREATE INDEX IF NOT EXISTS ecrs_bom_id_idx ON public.ecrs(bom_id);
CREATE INDEX IF NOT EXISTS ecos_ecr_id_idx ON public.ecos(ecr_id);

-- 5. Seed ECR Permissions
INSERT INTO public.permissions (id, code, description, module, created_at, updated_at)
VALUES
  ('b0000000-0000-0000-0000-000000000011', 'ecr:create', 'Create engineering change requests', 'ecr', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000012', 'ecr:read', 'Read engineering change requests', 'ecr', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000013', 'ecr:review', 'Review and request info on change requests', 'ecr', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000014', 'ecr:decide', 'Accept or reject change requests', 'ecr', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000015', 'ecr:promote', 'Promote accepted change requests to ECO', 'ecr', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Map Permissions to Roles
-- Administrator: Full ECR access
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', p.id, NOW()
FROM public.permissions p WHERE p.module = 'ecr'
ON CONFLICT DO NOTHING;

-- Lead Engineer: Create, Read, Review, Decide, Promote
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', p.id, NOW()
FROM public.permissions p WHERE p.code IN ('ecr:create', 'ecr:read', 'ecr:review', 'ecr:decide', 'ecr:promote')
ON CONFLICT DO NOTHING;

-- Approver: Create, Read, Review, Decide
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', p.id, NOW()
FROM public.permissions p WHERE p.code IN ('ecr:create', 'ecr:read', 'ecr:review', 'ecr:decide')
ON CONFLICT DO NOTHING;

-- Operator: Create, Read
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', p.id, NOW()
FROM public.permissions p WHERE p.code IN ('ecr:create', 'ecr:read')
ON CONFLICT DO NOTHING;

COMMIT;

