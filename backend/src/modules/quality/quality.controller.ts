import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { QualityService } from './quality.service.js';

export class QualityController {
  public static async listInspections(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      const type = req.query.type as string;
      const result = await QualityService.listInspections(page, limit, status, type);
      res.status(200).json({ status: 'success', data: result.inspections, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  public static async getInspection(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ins = await QualityService.getInspection(req.params.id as string);
      res.status(200).json({ status: 'success', data: ins });
    } catch (err) {
      next(err);
    }
  }

  public static async createInspection(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ins = await QualityService.createInspection(req.body, req.user!.userId);
      res.status(201).json({ status: 'success', data: ins });
    } catch (err) {
      next(err);
    }
  }

  public static async recordInspectionResult(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ins = await QualityService.recordInspectionResult(req.params.id as string, req.body, req.user!.userId);
      res.status(200).json({ status: 'success', data: ins });
    } catch (err) {
      next(err);
    }
  }

  public static async listNCRs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      const severity = req.query.severity as string;
      const result = await QualityService.listNCRs(page, limit, status, severity);
      res.status(200).json({ status: 'success', data: result.ncrs, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  public static async getNCR(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ncr = await QualityService.getNCR(req.params.id as string);
      res.status(200).json({ status: 'success', data: ncr });
    } catch (err) {
      next(err);
    }
  }

  public static async createNCR(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ncr = await QualityService.createNCR(req.body, req.user!.userId);
      res.status(201).json({ status: 'success', data: ncr });
    } catch (err) {
      next(err);
    }
  }

  public static async updateNCR(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ncr = await QualityService.updateNCR(req.params.id as string, req.body, req.user!.userId);
      res.status(200).json({ status: 'success', data: ncr });
    } catch (err) {
      next(err);
    }
  }
}
