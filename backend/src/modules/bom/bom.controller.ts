import { Request, Response, NextFunction } from 'express';
import { BOMService } from './bom.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class BOMController {
  public static async createBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await BOMService.createBOM(req.body, req.user!.userId);
      sendCreated(res, bom, 'BOM created successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async listBOMs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const result = await BOMService.listBOMs(page, limit);
      sendSuccess(res, result.data, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  public static async getBOM(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const bom = await BOMService.getBOMById(id!);
      sendSuccess(res, bom);
    } catch (error) {
      next(error);
    }
  }

  public static async addComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const component = await BOMService.addComponent(id!, req.body);
      sendCreated(res, component, 'Component added to BOM');
    } catch (error) {
      next(error);
    }
  }

  public static async removeComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const componentId = Array.isArray(req.params.componentId) ? req.params.componentId[0] : req.params.componentId;
      await BOMService.removeComponent(id!, componentId!);
      sendSuccess(res, { removed: true }, 'Component removed from BOM');
    } catch (error) {
      next(error);
    }
  }
}
