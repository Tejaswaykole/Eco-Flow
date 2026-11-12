import { Router } from 'express';
import { ECNController } from './ecn.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  generateECNSchema,
  issueECNSchema,
  completeECNSchema,
  cancelECNSchema,
  acknowledgeDistributionSchema,
  createMaterialDispositionSchema,
} from './ecn.schema.js';

export const ecnRouter = Router();

// All ECN routes require authenticated session
ecnRouter.use(authenticate);

// 1. Retrieval
ecnRouter.get('/', requirePermission('ecn:read'), ECNController.listECNs);
ecnRouter.get('/:id', requirePermission('ecn:read'), ECNController.getECN);

// 2. Generation (from ECO ID)
ecnRouter.post(
  '/generate/:id',
  requirePermission('ecn:generate'),
  validate(generateECNSchema),
  ECNController.generateECN
);

// 3. Lifecycle Transitions
ecnRouter.post(
  '/:id/issue',
  requirePermission('ecn:issue'),
  validate(issueECNSchema),
  ECNController.issueECN
);

ecnRouter.post(
  '/:id/complete',
  requirePermission('ecn:complete'),
  validate(completeECNSchema),
  ECNController.completeECN
);

ecnRouter.post(
  '/:id/cancel',
  requirePermission('ecn:complete'),
  validate(cancelECNSchema),
  ECNController.cancelECN
);

// 4. Department Acknowledgement
ecnRouter.post(
  '/:id/distributions/:distributionId/acknowledge',
  requirePermission('ecn:acknowledge'),
  validate(acknowledgeDistributionSchema),
  ECNController.acknowledgeDistribution
);

// 5. Material Dispositions
ecnRouter.post(
  '/:id/dispositions',
  requirePermission('ecn:disposition'),
  validate(createMaterialDispositionSchema),
  ECNController.addDisposition
);

