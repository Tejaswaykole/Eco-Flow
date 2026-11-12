import { Router } from 'express';
import { ActivityController } from './activity.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

export const activityRouter = Router();

activityRouter.use(authenticate);
activityRouter.use(requirePermission('audit:read'));

activityRouter.get('/', ActivityController.listActivities);
activityRouter.get('/:entityType/:entityId', ActivityController.getEntityTimeline);
