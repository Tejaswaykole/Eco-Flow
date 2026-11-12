import { Router } from 'express';
import { ECRController } from './ecr.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createECRSchema,
  assignECRSchema,
  startReviewECRSchema,
  requestInfoECRSchema,
  resubmitECRSchema,
  acceptECRSchema,
  rejectECRSchema,
  promoteECRSchema,
} from './ecr.schema.js';

export const ecrRouter = Router();

// All ECR routes require authenticated sessions
ecrRouter.use(authenticate);

// 1. Submission & Listing
ecrRouter.post('/', requirePermission('ecr:create'), validate(createECRSchema), ECRController.createECR);
ecrRouter.get('/', requirePermission('ecr:read'), ECRController.listECRs);
ecrRouter.get('/:id', requirePermission('ecr:read'), ECRController.getECR);

// 2. Review Workflow Actions (Authorized reviewers & admins)
ecrRouter.post(
  '/:id/assign',
  requirePermission('ecr:review'),
  validate(assignECRSchema),
  ECRController.assignECR
);

ecrRouter.post(
  '/:id/start-review',
  requirePermission('ecr:review'),
  validate(startReviewECRSchema),
  ECRController.startReview
);

ecrRouter.post(
  '/:id/request-information',
  requirePermission('ecr:review'),
  validate(requestInfoECRSchema),
  ECRController.requestInformation
);

ecrRouter.post(
  '/:id/resubmit',
  requirePermission('ecr:create'),
  validate(resubmitECRSchema),
  ECRController.resubmitECR
);

ecrRouter.post(
  '/:id/accept',
  requirePermission('ecr:decide'),
  validate(acceptECRSchema),
  ECRController.acceptECR
);

ecrRouter.post(
  '/:id/reject',
  requirePermission('ecr:decide'),
  validate(rejectECRSchema),
  ECRController.rejectECR
);

// 3. Promotion to ECO (Authorized engineering roles with ECO creation capability)
ecrRouter.post(
  '/:id/promote-to-eco',
  requirePermission('ecr:promote'),
  validate(promoteECRSchema),
  ECRController.promoteToECO
);

