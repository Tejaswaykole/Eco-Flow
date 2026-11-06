import { Router } from 'express';
import { BOMController } from './bom.controller.js';
import { validate } from '../../middleware/validate.js';
import { createBOMSchema, addBOMComponentSchema } from './bom.schema.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();

router.post('/', authenticate, requirePermission('bom:write'), validate(createBOMSchema), BOMController.createBOM);
router.get('/:id', authenticate, BOMController.getBOM);
router.post('/:id/components', authenticate, requirePermission('bom:write'), validate(addBOMComponentSchema), BOMController.addComponent);
router.delete('/:id/components/:componentId', authenticate, requirePermission('bom:write'), BOMController.removeComponent);

export const bomRouter = router;
