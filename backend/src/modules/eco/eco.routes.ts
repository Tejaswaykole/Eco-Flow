import { Router } from 'express';
import { ECOController } from './eco.controller.js';
import { validate } from '../../middleware/validate.js';
import { createECOSchema, addChangeSchema, approveECOSchema } from './eco.schema.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

const router = Router();

router.get('/', authenticate, ECOController.listECOs);
router.post('/', authenticate, requirePermission('eco:create'), validate(createECOSchema), ECOController.createECO);
router.get('/:id', authenticate, ECOController.getECO);
router.post('/:id/changes', authenticate, requirePermission('eco:edit'), validate(addChangeSchema), ECOController.addChange);
router.post('/:id/submit', authenticate, requirePermission('eco:submit'), ECOController.submitECO);
router.post('/:id/review', authenticate, requirePermission('eco:approve'), validate(approveECOSchema), ECOController.reviewECO);

export const ecoRouter = router;
