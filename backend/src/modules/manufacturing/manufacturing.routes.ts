import { Router } from 'express';
import { ManufacturingController } from './manufacturing.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createWorkOrderSchema, consumeMaterialSchema, completeWorkOrderSchema } from './manufacturing.schema.js';

export const manufacturingRouter = Router();

manufacturingRouter.use(authenticate);

manufacturingRouter.get('/', requirePermission('manufacturing:read'), ManufacturingController.listWorkOrders);
manufacturingRouter.get('/orders', requirePermission('manufacturing:read'), ManufacturingController.listWorkOrders);
manufacturingRouter.get('/:id', requirePermission('manufacturing:read'), ManufacturingController.getWorkOrder);
manufacturingRouter.get('/orders/:id', requirePermission('manufacturing:read'), ManufacturingController.getWorkOrder);
manufacturingRouter.post('/', requirePermission('manufacturing:write'), validate(createWorkOrderSchema), ManufacturingController.createWorkOrder);
manufacturingRouter.post('/orders', requirePermission('manufacturing:write'), validate(createWorkOrderSchema), ManufacturingController.createWorkOrder);
manufacturingRouter.post('/:id/start', requirePermission('manufacturing:execute'), ManufacturingController.startWorkOrder);
manufacturingRouter.post('/orders/:id/start', requirePermission('manufacturing:execute'), ManufacturingController.startWorkOrder);
manufacturingRouter.post('/:id/consume', requirePermission('manufacturing:execute'), validate(consumeMaterialSchema), ManufacturingController.consumeMaterial);
manufacturingRouter.post('/orders/:id/consume', requirePermission('manufacturing:execute'), validate(consumeMaterialSchema), ManufacturingController.consumeMaterial);
manufacturingRouter.post('/:id/complete', requirePermission('manufacturing:execute'), validate(completeWorkOrderSchema), ManufacturingController.completeWorkOrder);
manufacturingRouter.post('/orders/:id/complete', requirePermission('manufacturing:execute'), validate(completeWorkOrderSchema), ManufacturingController.completeWorkOrder);

