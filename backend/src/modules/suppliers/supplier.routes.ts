import { Router } from 'express';
import { SupplierController } from './supplier.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  addSupplierProductSchema,
  bulkMapProductsSchema,
  updateSupplierProductSchema,
  importPreviewSchema,
  importCommitSchema,
  createRFQSchema,
  createQuotationSchema,
  negotiateQuotationSchema,
} from './supplier.schema.js';

export const supplierRouter = Router();

supplierRouter.use(authenticate);

// Phase 1: Dashboard Stats & Global Search
supplierRouter.get('/dashboard-stats', requirePermission('supplier:read'), SupplierController.getDashboardStats);
supplierRouter.get('/export', requirePermission('supplier:read'), SupplierController.exportData);
supplierRouter.get('/', requirePermission('supplier:read'), SupplierController.listSuppliers);
supplierRouter.get('/:id', requirePermission('supplier:read'), SupplierController.getSupplier);
supplierRouter.post('/', requirePermission('supplier:write'), validate(createSupplierSchema), SupplierController.createSupplier);
supplierRouter.patch('/:id', requirePermission('supplier:write'), validate(updateSupplierSchema), SupplierController.updateSupplier);

// Phase 2: Product Mapping (Single, Bulk, Update, Delete & Price Comparison)
supplierRouter.get('/products/:productId/comparison', requirePermission('supplier:read'), SupplierController.getProductSuppliersComparison);
supplierRouter.post('/:id/products', requirePermission('supplier:write'), validate(addSupplierProductSchema), SupplierController.addSupplierProduct);
supplierRouter.post('/:id/products/bulk', requirePermission('supplier:write'), validate(bulkMapProductsSchema), SupplierController.bulkMapProducts);
supplierRouter.patch('/:id/products/:productId', requirePermission('supplier:write'), validate(updateSupplierProductSchema), SupplierController.updateSupplierProduct);
supplierRouter.delete('/:id/products/:productId', requirePermission('supplier:write'), SupplierController.removeSupplierProduct);

// Phase 3: Import Wizard
supplierRouter.post('/:id/import-preview', requirePermission('supplier:write'), validate(importPreviewSchema), SupplierController.previewImport);
supplierRouter.post('/:id/import-commit', requirePermission('supplier:write'), validate(importCommitSchema), SupplierController.commitImport);

// Phase 4: RFQs, Quotations, Bargaining & PO Conversion
supplierRouter.get('/rfqs/list', requirePermission('supplier:read'), SupplierController.listRFQs);
supplierRouter.post('/rfqs', requirePermission('supplier:write'), validate(createRFQSchema), SupplierController.createRFQ);
supplierRouter.post('/quotations', requirePermission('supplier:write'), validate(createQuotationSchema), SupplierController.createQuotation);
supplierRouter.post('/quotations/:id/negotiate', requirePermission('supplier:write'), validate(negotiateQuotationSchema), SupplierController.negotiateQuotation);
supplierRouter.post('/quotations/:id/convert-to-po', requirePermission('purchasing:write'), SupplierController.convertQuotationToPO);

// Phase 5: Supplier Performance Analytics
supplierRouter.get('/:id/performance', requirePermission('supplier:read'), SupplierController.getSupplierPerformance);
