-- Rollback Migration 013: Business Modules
BEGIN;

DROP TABLE IF EXISTS public.quality_non_conformances CASCADE;
DROP TABLE IF EXISTS public.quality_inspections CASCADE;
DROP TABLE IF EXISTS public.work_order_allocations CASCADE;
DROP TABLE IF EXISTS public.work_orders CASCADE;
DROP TABLE IF EXISTS public.purchase_order_lines CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.supplier_products CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;

DELETE FROM public.role_permissions WHERE permission_id IN (
  SELECT id FROM public.permissions WHERE module IN ('supplier', 'inventory', 'purchasing', 'manufacturing', 'quality')
);
DELETE FROM public.permissions WHERE module IN ('supplier', 'inventory', 'purchasing', 'manufacturing', 'quality');

DROP TYPE IF EXISTS public."NCRStatus";
DROP TYPE IF EXISTS public."NCRSeverity";
DROP TYPE IF EXISTS public."InspectionStatus";
DROP TYPE IF EXISTS public."InspectionType";
DROP TYPE IF EXISTS public."WorkOrderStatus";
DROP TYPE IF EXISTS public."PurchaseOrderStatus";
DROP TYPE IF EXISTS public."InventoryTransactionType";
DROP TYPE IF EXISTS public."WarehouseStatus";
DROP TYPE IF EXISTS public."SupplierStatus";

COMMIT;

