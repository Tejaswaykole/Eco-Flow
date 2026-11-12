import { Request, Response, NextFunction } from 'express';
import { ActivityService } from './activity.service.js';

export class ActivityController {
  public static async listActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const userId = req.query.userId as string | undefined;
      const action = req.query.action as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      const result = await ActivityService.listActivities({
        page,
        limit,
        entityType,
        entityId,
        userId,
        action,
        dateFrom,
        dateTo,
      });

      res.json({
        success: true,
        data: result.activities,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getEntityTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const entityType = Array.isArray(req.params.entityType) ? req.params.entityType[0] : req.params.entityType;
      const entityId = Array.isArray(req.params.entityId) ? req.params.entityId[0] : req.params.entityId;
      const result = await ActivityService.getEntityTimeline(entityType!, entityId!);
      res.json({
        success: true,
        data: result.activities,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }
}
