-- Rollback for Migration 018

DROP TABLE IF EXISTS "quotation_negotiation_events" CASCADE;
DROP TABLE IF EXISTS "supplier_quotations" CASCADE;
DROP TABLE IF EXISTS "rfq_suppliers" CASCADE;
DROP TABLE IF EXISTS "rfq_items" CASCADE;
DROP TABLE IF EXISTS "rfqs" CASCADE;

ALTER TABLE "supplier_products" DROP COLUMN IF EXISTS "status";
ALTER TABLE "supplier_products" DROP COLUMN IF EXISTS "valid_until";

DROP TYPE IF EXISTS "NegotiationEventType";
DROP TYPE IF EXISTS "SupplierQuotationStatus";
DROP TYPE IF EXISTS "RFQSupplierStatus";
DROP TYPE IF EXISTS "RFQStatus";

