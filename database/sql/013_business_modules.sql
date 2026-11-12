-- Migration 013: Business Modules (Suppliers, Inventory, Purchasing, Manufacturing, Quality)
-- Forward-only additive migration.

BEGIN;

-- 1. Custom Domain Enums
DO $$ BEGIN
  CREATE TYPE public."SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_QUALIFICATION', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."InventoryTransactionType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'SCRAP', 'TRANSFER', 'RESERVATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."WorkOrderStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."InspectionType" AS ENUM ('RECEIVING', 'IN_PROCESS', 'FINAL', 'FIRST_ARTICLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."InspectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CONDITIONALLY_PASSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."NCRSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public."NCRStatus" AS ENUM ('OPEN', 'UNDER_INVESTIGATION', 'CAPA_REQUIRED', 'CLOSED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  status "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
  contact_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  rating DECIMAL(3,2) DEFAULT 5.00,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_part_number VARCHAR(100),
  lead_time_days INTEGER DEFAULT 7,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  minimum_order_qty DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_supplier_product UNIQUE (supplier_id, product_id)
);

-- 3. Warehouses & Inventory
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  status "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity_on_hand DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  quantity_reserved DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  min_threshold DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  max_threshold DECIMAL(12,4),
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'PCS',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_product_warehouse UNIQUE (product_id, warehouse_id),
  CONSTRAINT chk_inventory_qty_positive CHECK (quantity_on_hand >= 0 AND quantity_reserved >= 0)
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  type "InventoryTransactionType" NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  performed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Purchasing Management
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  order_date TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_delivery_date TIMESTAMPTZ(6),
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_ordered DECIMAL(12,4) NOT NULL,
  quantity_received DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(14,2) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'PCS',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_po_line UNIQUE (po_id, line_number)
);

-- 5. Manufacturing Management
CREATE TABLE IF NOT EXISTS public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number VARCHAR(50) UNIQUE NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE RESTRICT,
  bom_version_id UUID REFERENCES public.bom_versions(id) ON DELETE SET NULL,
  target_quantity DECIMAL(12,4) NOT NULL,
  completed_quantity DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  rejected_quantity DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  status "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
  start_date TIMESTAMPTZ(6),
  end_date TIMESTAMPTZ(6),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.work_order_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  required_quantity DECIMAL(12,4) NOT NULL,
  allocated_quantity DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  consumed_quantity DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  unit_of_measure VARCHAR(50) NOT NULL DEFAULT 'PCS',
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Quality Management
CREATE TABLE IF NOT EXISTS public.quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_number VARCHAR(50) UNIQUE NOT NULL,
  type "InspectionType" NOT NULL,
  status "InspectionStatus" NOT NULL DEFAULT 'PENDING',
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  inspector_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sample_size DECIMAL(12,4) NOT NULL DEFAULT 1.0000,
  passed_quantity DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  failed_quantity DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  notes TEXT,
  conducted_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.quality_non_conformances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_number VARCHAR(50) UNIQUE NOT NULL,
  inspection_id UUID REFERENCES public.quality_inspections(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  severity "NCRSeverity" NOT NULL DEFAULT 'MINOR',
  status "NCRStatus" NOT NULL DEFAULT 'OPEN',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  root_cause TEXT,
  disposition VARCHAR(100),
  capa_plan TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Seed Permissions for Business Modules
INSERT INTO public.permissions (id, code, description, module, created_at, updated_at)
VALUES
  ('b0000000-0000-0000-0000-000000000031', 'supplier:read', 'Read supplier profiles and catalogs', 'supplier', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000032', 'supplier:write', 'Create and modify supplier profiles', 'supplier', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000033', 'inventory:read', 'Read inventory items and balances', 'inventory', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000034', 'inventory:transact', 'Execute inventory movements and adjustments', 'inventory', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000035', 'purchasing:read', 'Read purchase orders and requisitions', 'purchasing', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000036', 'purchasing:write', 'Create and edit purchase orders', 'purchasing', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000037', 'purchasing:approve', 'Approve purchase orders', 'purchasing', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000038', 'manufacturing:read', 'Read work orders and production progress', 'manufacturing', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000039', 'manufacturing:write', 'Create and execute work orders', 'manufacturing', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000040', 'quality:read', 'Read quality inspections and NCRs', 'quality', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000041', 'quality:inspect', 'Record inspection results and findings', 'quality', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000042', 'quality:decide', 'Approve inspection sign-offs and close NCRs', 'quality', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Map permissions to roles
-- Administrator: full access to all new permissions
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', p.id, NOW()
FROM public.permissions p WHERE p.module IN ('supplier', 'inventory', 'purchasing', 'manufacturing', 'quality')
ON CONFLICT DO NOTHING;

-- Lead Engineer: full supplier, inventory, manufacturing, quality, purchasing:read
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', p.id, NOW()
FROM public.permissions p WHERE p.code IN (
  'supplier:read', 'supplier:write',
  'inventory:read', 'inventory:transact',
  'purchasing:read', 'purchasing:write',
  'manufacturing:read', 'manufacturing:write',
  'quality:read', 'quality:inspect', 'quality:decide'
)
ON CONFLICT DO NOTHING;

-- Approver: purchasing:read, purchasing:approve, quality:read, quality:decide
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', p.id, NOW()
FROM public.permissions p WHERE p.code IN ('purchasing:read', 'purchasing:approve', 'quality:read', 'quality:decide', 'inventory:read', 'supplier:read', 'manufacturing:read')
ON CONFLICT DO NOTHING;

-- Operator: inventory:read, manufacturing:read, quality:read
INSERT INTO public.role_permissions (id, role_id, permission_id, created_at)
SELECT gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', p.id, NOW()
FROM public.permissions p WHERE p.code IN ('inventory:read', 'manufacturing:read', 'quality:read')
ON CONFLICT DO NOTHING;

-- 8. Seed Default Warehouse
INSERT INTO public.warehouses (id, code, name, location, status)
VALUES ('f0000000-0000-0000-0000-000000000001', 'WH-MAIN', 'Primary Manufacturing Facility', 'Building A - Plant 1', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

COMMIT;

