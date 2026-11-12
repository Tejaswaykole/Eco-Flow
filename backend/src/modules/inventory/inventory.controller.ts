import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { InventoryService } from './inventory.service.js';

export class InventoryController {
  public static async listWarehouses(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouses = await InventoryService.listWarehouses();
      res.status(200).json({ status: 'success', data: warehouses });
    } catch (err) {
      next(err);
    }
  }

  public static async createWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouse = await InventoryService.createWarehouse(req.body);
      res.status(201).json({ status: 'success', data: warehouse });
    } catch (err) {
      next(err);
    }
  }

  public static async listItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string;
      const search = req.query.search as string;
      const lowStockOnly = req.query.lowStock === 'true';
      const items = await InventoryService.listItems(warehouseId, search, lowStockOnly);
      res.status(200).json({ status: 'success', data: items });
    } catch (err) {
      next(err);
    }
  }

  public static async getItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const item = await InventoryService.getItem(req.params.id as string);
      res.status(200).json({ status: 'success', data: item });
    } catch (err) {
      next(err);
    }
  }

  public static async setThresholds(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await InventoryService.setThresholds(req.params.id as string, req.body, req.user!.userId);
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  }

  public static async transactStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.transactStock(req.body, req.user!.userId);
      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async listTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const itemId = req.query.itemId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await InventoryService.listTransactions(itemId, page, limit);
      res.status(200).json({ status: 'success', data: result.transactions, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }
}
