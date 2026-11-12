import { Request, Response, NextFunction } from 'express';
import { ApprovalsService } from './approvals.service.js';

export class ApprovalsController {
  public static async listPending(req: Request, res: Response, next: NextFunction) {
    try {
      const domain = req.query.domain as string | undefined;
      const overdueOnly = req.query.overdue === 'true';
      const result = await ApprovalsService.listPendingApprovals(domain, overdueOnly);
      res.json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          overdueCount: result.overdueCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await ApprovalsService.getApprovalStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async sendReminders(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ApprovalsService.sendReminders();
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

