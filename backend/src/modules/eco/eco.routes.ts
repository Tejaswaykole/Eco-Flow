import { Router } from 'express';
import { ECOController } from './eco.controller.js';
import { validate } from '../../middleware/validate.js';
import {
  createECOSchema,
  addChangeSchema,
  approveECOSchema,
  createRevisionSchema,
  updateChangeSchema,
} from './eco.schema.js';
import { authenticate, requirePermission, requireRole } from '../../middleware/auth.js';
import { ECNController } from '../ecn/ecn.controller.js';
import { generateECNSchema } from '../ecn/ecn.schema.js';

const router = Router();

router.get('/', authenticate, ECOController.listECOs);
router.post('/', authenticate, requirePermission('eco:create'), validate(createECOSchema), ECOController.createECO);
router.get('/:id', authenticate, ECOController.getECO);
router.post('/:id/changes', authenticate, requirePermission('eco:edit'), validate(addChangeSchema), ECOController.addChange);
router.patch('/:id/changes/:changeId', authenticate, requirePermission('eco:edit'), validate(updateChangeSchema), ECOController.updateChange);
router.delete('/:id/changes/:changeId', authenticate, requirePermission('eco:edit'), ECOController.removeChange);
router.post('/:id/revisions', authenticate, requirePermission('eco:edit'), validate(createRevisionSchema), ECOController.createRevision);
router.post('/:id/submit', authenticate, requirePermission('eco:submit'), ECOController.submitECO);
router.post('/:id/review', authenticate, requirePermission('eco:approve'), validate(approveECOSchema), ECOController.reviewECO);
router.post(
  '/:id/generate-ecn',
  authenticate,
  requireRole('LEAD_ENGINEER', 'ADMINISTRATOR'),
  validate(generateECNSchema),
  ECNController.generateECN
);

export const ecoRouter = router;
