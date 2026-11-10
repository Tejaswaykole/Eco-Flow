-- Migration 011: Engineering Change Notice (ECN) Support
-- Workspace: T:\My Projects\ECO-Flow\database
-- Milestone 4: Engineering Change Notice Implementation

BEGIN;

-- 1. Create Enums for ECN
DO $$ BEGIN
  CREATE TYPE "ECNStatus" AS ENUM ('DRAFT', 'ISSUED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ECNDepartment" AS ENUM ('ENGINEERING', 'QUALITY', 'PRODUCTION', 'PROCUREMENT', 'INVENTORY', 'MANAGEMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ECNAcknowledgementStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MaterialDispositionType" AS ENUM ('SCRAP', 'REWORK', 'USE_AS_IS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create ecns Table
CREATE TABLE IF NOT EXISTS public.ecns (
    id UUID NOT NULL,
    ecn_number VARCHAR(100) NOT NULL,
    eco_id UUID NOT NULL,
    version_release_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    change_summary TEXT NOT NULL,
    reason_for_change TEXT,
    effective_date TIMESTAMPTZ(6) NOT NULL,
    status "ECNStatus" NOT NULL DEFAULT 'DRAFT',
    issued_by UUID,
    issued_at TIMESTAMPTZ(6),
    completed_at TIMESTAMPTZ(6),
    cancelled_at TIMESTAMPTZ(6),
    cancellation_reason TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ecns_pkey PRIMARY KEY (id),
    CONSTRAINT ecns_ecn_number_key UNIQUE (ecn_number),
    CONSTRAINT ecns_eco_id_key UNIQUE (eco_id),
    CONSTRAINT ecns_version_release_id_key UNIQUE (version_release_id),
    CONSTRAINT fk_ecns_eco_id FOREIGN KEY (eco_id) REFERENCES public.ecos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ecns_version_release_id FOREIGN KEY (version_release_id) REFERENCES public.version_releases(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ecns_issued_by FOREIGN KEY (issued_by) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ecns_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3. Create ecn_distributions Table
CREATE TABLE IF NOT EXISTS public.ecn_distributions (
    id UUID NOT NULL,
    ecn_id UUID NOT NULL,
    department "ECNDepartment" NOT NULL,
    assigned_to UUID,
    acknowledgement_status "ECNAcknowledgementStatus" NOT NULL DEFAULT 'PENDING',
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ(6),
    comments TEXT,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ecn_distributions_pkey PRIMARY KEY (id),
    CONSTRAINT ecn_distributions_ecn_id_department_key UNIQUE (ecn_id, department),
    CONSTRAINT fk_ecn_distributions_ecn_id FOREIGN KEY (ecn_id) REFERENCES public.ecns(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ecn_distributions_assigned_to FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ecn_distributions_acknowledged_by FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 4. Create ecn_material_dispositions Table
CREATE TABLE IF NOT EXISTS public.ecn_material_dispositions (
    id UUID NOT NULL,
    ecn_id UUID NOT NULL,
    product_id UUID,
    part_number VARCHAR(100),
    disposition_type "MaterialDispositionType" NOT NULL,
    quantity NUMERIC(12, 4),
    instructions TEXT NOT NULL,
    responsible_department "ECNDepartment" NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ecn_material_dispositions_pkey PRIMARY KEY (id),
    CONSTRAINT fk_ecn_dispositions_ecn_id FOREIGN KEY (ecn_id) REFERENCES public.ecns(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ecn_dispositions_product_id FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ecn_dispositions_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS ecns_status_idx ON public.ecns(status);
CREATE INDEX IF NOT EXISTS ecns_effective_date_idx ON public.ecns(effective_date);
CREATE INDEX IF NOT EXISTS ecns_created_by_idx ON public.ecns(created_by);
CREATE INDEX IF NOT EXISTS ecns_eco_id_idx ON public.ecns(eco_id);
CREATE INDEX IF NOT EXISTS ecns_version_release_id_idx ON public.ecns(version_release_id);

CREATE INDEX IF NOT EXISTS ecn_distributions_ecn_id_idx ON public.ecn_distributions(ecn_id);
CREATE INDEX IF NOT EXISTS ecn_distributions_department_idx ON public.ecn_distributions(department);
CREATE INDEX IF NOT EXISTS ecn_distributions_status_idx ON public.ecn_distributions(acknowledgement_status);

CREATE INDEX IF NOT EXISTS ecn_dispositions_ecn_id_idx ON public.ecn_material_dispositions(ecn_id);
CREATE INDEX IF NOT EXISTS ecn_dispositions_type_idx ON public.ecn_material_dispositions(disposition_type);
CREATE INDEX IF NOT EXISTS ecn_dispositions_dept_idx ON public.ecn_material_dispositions(responsible_department);

-- 6. Seed ECN Permissions
INSERT INTO public.permissions (id, code, description, module, created_at, updated_at)
VALUES
  ('b0000000-0000-0000-0000-000000000021', 'ecn:generate', 'Generate change notice from released ECO', 'ecn', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000022', 'ecn:read', 'Read engineering change notices', 'ecn', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000023', 'ecn:issue', 'Issue change notice to target departments', 'ecn', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000024', 'ecn:acknowledge', 'Acknowledge change notice receipt', 'ecn', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000025', 'ecn:disposition', 'Define material dispositions', 'ecn', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000026', 'ecn:complete', 'Close and complete change notice', 'ecn', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 7. Map Permissions to Roles
-- Administrator: Full ECN access
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', p.id, NOW()
FROM public.permissions p WHERE p.module = 'ecn'
ON CONFLICT DO NOTHING;

-- Lead Engineer: Generate, Read, Issue, Acknowledge, Disposition, Complete
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', p.id, NOW()
FROM public.permissions p WHERE p.module = 'ecn'
ON CONFLICT DO NOTHING;

-- Approver: Read, Acknowledge
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', p.id, NOW()
FROM public.permissions p WHERE p.code IN ('ecn:read', 'ecn:acknowledge')
ON CONFLICT DO NOTHING;

-- Operator: Read, Acknowledge
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', p.id, NOW()
FROM public.permissions p WHERE p.code IN ('ecn:read', 'ecn:acknowledge')
ON CONFLICT DO NOTHING;

COMMIT;

