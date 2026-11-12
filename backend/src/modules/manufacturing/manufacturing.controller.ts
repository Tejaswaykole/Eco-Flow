import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { ManufacturingService } from './manufacturing.service.js';

export class ManufacturingController {
  public static async listWorkOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      const result = await ManufacturingService.listWorkOrders(page, limit, status);
      res.status(200).json({ status: 'success', data: result.workOrders, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  public static async getWorkOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const wo = await ManufacturingService.getWorkOrder(req.params.id as string);
      res.status(200).json({ status: 'success', data: wo });
    } catch (err) {
      next(err);
    }
  }

  public static async createWorkOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const wo = await ManufacturingService.createWorkOrder(req.body, req.user!.userId);
      res.status(201).json({ status: 'success', data: wo });
    } catch (err) {
      next(err);
    }
  }

  public static async startWorkOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const wo = await ManufacturingService.startWorkOrder(req.params.id as string, req.user!.userId);
      res.status(200).json({ status: 'success', data: wo });
    } catch (err) {
      next(err);
    }
  }

  public static async consumeMaterial(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const allocation = await ManufacturingService.consumeMaterial(req.params.id as string, req.body, req.user!.userId);
      res.status(200).json({ status: 'success', data: allocation });
    } catch (err) {
      next(err);
    }
  }

  public static async completeWorkOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const wo = await ManufacturingService.completeWorkOrder(req.params.id as string, req.body, req.user!.userId);
      res.status(200).json({ status: 'success', data: wo });
    } catch (err) {
      next(err);
    }
  }
}
