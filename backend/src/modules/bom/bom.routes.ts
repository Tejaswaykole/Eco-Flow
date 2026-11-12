import { Router } from 'express';
import { BOMController } from './bom.controller.js';
import { validate } from '../../middleware/validate.js';
import { createBOMSchema, addBOMComponentSchema, updateBOMComponentSchema } from './bom.schema.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();

router.post('/', authenticate, requirePermission('bom:write'), validate(createBOMSchema), BOMController.createBOM);
router.get('/', authenticate, requirePermission('bom:read'), BOMController.listBOMs);
router.get('/:id', authenticate, requirePermission('bom:read'), BOMController.getBOM);
router.get('/:id/tree', authenticate, requirePermission('bom:read'), BOMController.getBOMTree);
router.get('/:id/exploded', authenticate, requirePermission('bom:read'), BOMController.getBOMExploded);
router.get('/:id/where-used', authenticate, requirePermission('bom:read'), BOMController.getBOMWhereUsed);
router.get('/:id/history', authenticate, requirePermission('bom:read'), BOMController.getHistory);
router.post('/:id/components', authenticate, requirePermission('bom:write'), validate(addBOMComponentSchema), BOMController.addComponent);
router.post('/:id/release', authenticate, requirePermission('bom:release'), BOMController.releaseBOM);
router.patch('/:id/components/:componentId', authenticate, requirePermission('bom:write'), validate(updateBOMComponentSchema), BOMController.updateComponent);
router.delete('/:id/components/:componentId', authenticate, requirePermission('bom:write'), BOMController.removeComponent);

export const bomRouter = router;
