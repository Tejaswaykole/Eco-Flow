import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { PurchasingService } from './purchasing.service.js';

export class PurchasingController {
  public static async listPurchaseOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      const result = await PurchasingService.listPurchaseOrders(page, limit, status);
      res.status(200).json({ status: 'success', data: result.orders, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  public static async getPurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const po = await PurchasingService.getPurchaseOrder(req.params.id as string);
      res.status(200).json({ status: 'success', data: po });
    } catch (err) {
      next(err);
    }
  }

  public static async createPurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const po = await PurchasingService.createPurchaseOrder(req.body, req.user!.userId);
      res.status(201).json({ status: 'success', data: po });
    } catch (err) {
      next(err);
    }
  }

  public static async submitPurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const po = await PurchasingService.submitPurchaseOrder(req.params.id as string, req.user!.userId);
      res.status(200).json({ status: 'success', data: po });
    } catch (err) {
      next(err);
    }
  }

  public static async approvePurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const po = await PurchasingService.approvePurchaseOrder(req.params.id as string, req.user!.userId);
      res.status(200).json({ status: 'success', data: po });
    } catch (err) {
      next(err);
    }
  }

  public static async receiveGoods(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const po = await PurchasingService.receiveGoods(req.params.id as string, req.body, req.user!.userId);
      res.status(200).json({ status: 'success', data: po });
    } catch (err) {
      next(err);
    }
  }
}
