-- Migration 018: Add RFQ, Supplier Quotation, and Quotation Negotiation tables for Procurement & Sourcing
-- Additive migration preserving all existing schema and data.

-- 1. Create Enums if not exist
DO $$ BEGIN
    CREATE TYPE "RFQStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RFQSupplierStatus" AS ENUM ('INVITED', 'RESPONDED', 'DECLINED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SupplierQuotationStatus" AS ENUM ('DRAFT', 'REQUESTED', 'QUOTED', 'COUNTER_OFFERED', 'REVISED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "NegotiationEventType" AS ENUM ('COUNTER_OFFER', 'REVISED_OFFER', 'ACCEPTED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add additive columns to supplier_products if not present
ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "valid_until" TIMESTAMPTZ(6);

-- 3. Create RFQ Table
CREATE TABLE IF NOT EXISTS "rfqs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rfq_number" VARCHAR(50) UNIQUE NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" "RFQStatus" NOT NULL DEFAULT 'OPEN',
    "submission_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_date" TIMESTAMPTZ(6),
    "delivery_date" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create RFQ Items Table
CREATE TABLE IF NOT EXISTS "rfq_items" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rfq_id" UUID NOT NULL REFERENCES "rfqs"("id") ON DELETE CASCADE,
    "product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
    "quantity_required" DECIMAL(12, 4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create RFQ Suppliers Table
CREATE TABLE IF NOT EXISTS "rfq_suppliers" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rfq_id" UUID NOT NULL REFERENCES "rfqs"("id") ON DELETE CASCADE,
    "supplier_id" UUID NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
    "status" "RFQSupplierStatus" NOT NULL DEFAULT 'INVITED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_rfq_supplier" UNIQUE ("rfq_id", "supplier_id")
);

-- 6. Create Supplier Quotations Table
CREATE TABLE IF NOT EXISTS "supplier_quotations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "quotation_number" VARCHAR(50) UNIQUE NOT NULL,
    "rfq_id" UUID REFERENCES "rfqs"("id") ON DELETE SET NULL,
    "supplier_id" UUID NOT NULL REFERENCES "suppliers"("id") ON DELETE RESTRICT,
    "product_id" UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
    "supplier_part_number" VARCHAR(100),
    "offered_quantity" DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
    "unit_price" DECIMAL(12, 2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "tax_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "shipping_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(14, 2) NOT NULL,
    "lead_time_days" INT DEFAULT 7,
    "minimum_order_quantity" DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
    "valid_until" TIMESTAMPTZ(6),
    "terms_conditions" TEXT,
    "status" "SupplierQuotationStatus" NOT NULL DEFAULT 'QUOTED',
    "converted_po_id" UUID REFERENCES "purchase_orders"("id") ON DELETE SET NULL,
    "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create Quotation Negotiation Events Table
CREATE TABLE IF NOT EXISTS "quotation_negotiation_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL REFERENCES "supplier_quotations"("id") ON DELETE CASCADE,
    "event_type" "NegotiationEventType" NOT NULL,
    "actor_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "offered_price" DECIMAL(12, 2) NOT NULL,
    "counter_price" DECIMAL(12, 2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "message" TEXT,
    "previous_status" "SupplierQuotationStatus" NOT NULL,
    "new_status" "SupplierQuotationStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Add Indexes
CREATE INDEX IF NOT EXISTS "idx_rfqs_status" ON "rfqs"("status");
CREATE INDEX IF NOT EXISTS "idx_rfq_items_rfq_id" ON "rfq_items"("rfq_id");
CREATE INDEX IF NOT EXISTS "idx_rfq_items_product_id" ON "rfq_items"("product_id");
CREATE INDEX IF NOT EXISTS "idx_rfq_suppliers_rfq_id" ON "rfq_suppliers"("rfq_id");
CREATE INDEX IF NOT EXISTS "idx_rfq_suppliers_supplier_id" ON "rfq_suppliers"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_quotations_supplier_id" ON "supplier_quotations"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_quotations_product_id" ON "supplier_quotations"("product_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_quotations_rfq_id" ON "supplier_quotations"("rfq_id");
CREATE INDEX IF NOT EXISTS "idx_quotation_negotiation_events_quotation_id" ON "quotation_negotiation_events"("quotation_id");

