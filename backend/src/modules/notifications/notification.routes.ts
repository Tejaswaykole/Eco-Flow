import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate } from '../../middleware/auth.js';

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get('/', NotificationController.listNotifications);
notificationRouter.get('/unread-count', NotificationController.getUnreadCount);
notificationRouter.patch('/:id/read', NotificationController.markAsRead);
notificationRouter.post('/mark-all-read', NotificationController.markAllAsRead);
notificationRouter.delete('/:id', NotificationController.dismissNotification);

