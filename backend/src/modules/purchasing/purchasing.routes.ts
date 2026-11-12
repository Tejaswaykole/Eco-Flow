import { Router } from 'express';
import { PurchasingController } from './purchasing.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createPurchaseOrderSchema, receiveGoodsSchema } from './purchasing.schema.js';

export const purchasingRouter = Router();

purchasingRouter.use(authenticate);

purchasingRouter.get('/', requirePermission('purchasing:read'), PurchasingController.listPurchaseOrders);
purchasingRouter.get('/orders', requirePermission('purchasing:read'), PurchasingController.listPurchaseOrders);
purchasingRouter.get('/:id', requirePermission('purchasing:read'), PurchasingController.getPurchaseOrder);
purchasingRouter.get('/orders/:id', requirePermission('purchasing:read'), PurchasingController.getPurchaseOrder);
purchasingRouter.post('/', requirePermission('purchasing:write'), validate(createPurchaseOrderSchema), PurchasingController.createPurchaseOrder);
purchasingRouter.post('/orders', requirePermission('purchasing:write'), validate(createPurchaseOrderSchema), PurchasingController.createPurchaseOrder);
purchasingRouter.post('/:id/submit', requirePermission('purchasing:write'), PurchasingController.submitPurchaseOrder);
purchasingRouter.post('/orders/:id/submit', requirePermission('purchasing:write'), PurchasingController.submitPurchaseOrder);
purchasingRouter.post('/:id/approve', requirePermission('purchasing:approve'), PurchasingController.approvePurchaseOrder);
purchasingRouter.post('/orders/:id/approve', requirePermission('purchasing:approve'), PurchasingController.approvePurchaseOrder);
purchasingRouter.post('/:id/receive', requirePermission('purchasing:write'), validate(receiveGoodsSchema), PurchasingController.receiveGoods);
purchasingRouter.post('/orders/:id/receive', requirePermission('purchasing:write'), validate(receiveGoodsSchema), PurchasingController.receiveGoods);

