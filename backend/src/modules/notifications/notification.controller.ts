import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { NotificationService } from './notification.service.js';

export class NotificationController {
  public static async listNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const result = await NotificationService.listNotifications(req.user!.userId, {
        unreadOnly,
        page,
        limit,
      });

      res.status(200).json({
        status: 'success',
        data: result.notifications,
        unreadCount: result.unreadCount,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const count = await NotificationService.getUnreadCount(req.user!.userId);
      res.status(200).json({
        status: 'success',
        data: { unreadCount: count },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const notification = await NotificationService.markAsRead(req.params.id as string, req.user!.userId);
      res.status(200).json({
        status: 'success',
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await NotificationService.markAllAsRead(req.user!.userId);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async dismissNotification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await NotificationService.dismissNotification(req.params.id as string, req.user!.userId);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

