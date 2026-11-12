import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class DashboardController {
  public static async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userRoles = req.user?.roles || [];
      const metrics = await DashboardService.getMetrics(userRoles);
      res.json({
        success: true,
        data: metrics,
      });
    } catch (err) {
      next(err);
    }
  }
}

