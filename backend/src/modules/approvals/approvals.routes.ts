import { Router } from 'express';
import { ApprovalsController } from './approvals.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

export const approvalsRouter = Router();

approvalsRouter.use(authenticate);

// Listing approvals and reading approval statistics requires approvals:read
approvalsRouter.get('/pending', requirePermission('approvals:read'), ApprovalsController.listPending);
approvalsRouter.get('/stats', requirePermission('approvals:read'), ApprovalsController.getStats);

// Triggering workflow reminders to assignees requires approvals:remind (Administrators and Lead Engineers)
approvalsRouter.post('/remind', requirePermission('approvals:remind'), ApprovalsController.sendReminders);
