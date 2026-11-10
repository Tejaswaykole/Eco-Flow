import { Router } from 'express';
import { ECNController } from './ecn.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
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
ecnRouter.get('/', ECNController.listECNs);
ecnRouter.get('/:id', ECNController.getECN);

// 2. Generation (from ECO ID)
ecnRouter.post(
  '/generate/:id',
  requireRole('LEAD_ENGINEER', 'ADMINISTRATOR'),
  validate(generateECNSchema),
  ECNController.generateECN
);

// 3. Lifecycle Transitions
ecnRouter.post(
  '/:id/issue',
  requireRole('LEAD_ENGINEER', 'ADMINISTRATOR'),
  validate(issueECNSchema),
  ECNController.issueECN
);

ecnRouter.post(
  '/:id/complete',
  requireRole('LEAD_ENGINEER', 'ADMINISTRATOR'),
  validate(completeECNSchema),
  ECNController.completeECN
);

ecnRouter.post(
  '/:id/cancel',
  requireRole('LEAD_ENGINEER', 'ADMINISTRATOR'),
  validate(cancelECNSchema),
  ECNController.cancelECN
);

// 4. Department Acknowledgement
ecnRouter.post(
  '/:id/distributions/:distributionId/acknowledge',
  validate(acknowledgeDistributionSchema),
  ECNController.acknowledgeDistribution
);

// 5. Material Dispositions
ecnRouter.post(
  '/:id/dispositions',
  requireRole('LEAD_ENGINEER', 'ADMINISTRATOR'),
  validate(createMaterialDispositionSchema),
  ECNController.addDisposition
);

