import { Router } from 'express';
import { ECRController } from './ecr.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
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
ecrRouter.post('/', validate(createECRSchema), ECRController.createECR);
ecrRouter.get('/', ECRController.listECRs);
ecrRouter.get('/:id', ECRController.getECR);

// 2. Review Workflow Actions (Authorized reviewers & admins)
ecrRouter.post(
  '/:id/assign',
  requireRole('LEAD_ENGINEER', 'APPROVER', 'ADMINISTRATOR'),
  validate(assignECRSchema),
  ECRController.assignECR
);

ecrRouter.post(
  '/:id/start-review',
  requireRole('LEAD_ENGINEER', 'APPROVER', 'ADMINISTRATOR'),
  validate(startReviewECRSchema),
  ECRController.startReview
);

ecrRouter.post(
  '/:id/request-information',
  requireRole('LEAD_ENGINEER', 'APPROVER', 'ADMINISTRATOR'),
  validate(requestInfoECRSchema),
  ECRController.requestInformation
);

ecrRouter.post(
  '/:id/resubmit',
  validate(resubmitECRSchema),
  ECRController.resubmitECR
);

ecrRouter.post(
  '/:id/accept',
  requireRole('LEAD_ENGINEER', 'APPROVER', 'ADMINISTRATOR'),
  validate(acceptECRSchema),
  ECRController.acceptECR
);

ecrRouter.post(
  '/:id/reject',
  requireRole('LEAD_ENGINEER', 'APPROVER', 'ADMINISTRATOR'),
  validate(rejectECRSchema),
  ECRController.rejectECR
);

// 3. Promotion to ECO (Authorized engineering roles with ECO creation capability)
ecrRouter.post(
  '/:id/promote-to-eco',
  requireRole('LEAD_ENGINEER', 'ADMINISTRATOR'),
  validate(promoteECRSchema),
  ECRController.promoteToECO
);

