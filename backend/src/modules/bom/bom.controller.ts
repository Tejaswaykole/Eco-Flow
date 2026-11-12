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

  public static async getBOMTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const tree = await BOMService.getBOMTree(id!);
      sendSuccess(res, tree);
    } catch (error) {
      next(error);
    }
  }

  public static async getBOMExploded(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const exploded = await BOMService.getBOMExploded(id!);
      sendSuccess(res, exploded);
    } catch (error) {
      next(error);
    }
  }

  public static async getBOMWhereUsed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const usages = await BOMService.getBOMWhereUsed(id!);
      sendSuccess(res, usages);
    } catch (error) {
      next(error);
    }
  }

  public static async addComponent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const component = await BOMService.addComponent(id!, req.body, req.user?.userId, req.user?.roles);
      sendCreated(res, component, 'Component added to BOM');
    } catch (error) {
      next(error);
    }
  }

  public static async updateComponent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const componentId = Array.isArray(req.params.componentId) ? req.params.componentId[0] : req.params.componentId;
      const component = await BOMService.updateComponent(id!, componentId!, req.body, req.user?.userId, req.user?.roles);
      sendSuccess(res, component, 'Component updated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async removeComponent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const componentId = Array.isArray(req.params.componentId) ? req.params.componentId[0] : req.params.componentId;
      await BOMService.removeComponent(id!, componentId!, req.user?.userId);
      sendSuccess(res, { removed: true }, 'Component removed from BOM');
    } catch (error) {
      next(error);
    }
  }

  public static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const history = await BOMService.getBOMHistory(id!);
      sendSuccess(res, history);
    } catch (error) {
      next(error);
    }
  }

  public static async releaseBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const released = await BOMService.releaseBOM(id!, req.user!.userId);
      sendSuccess(res, released, 'BOM released successfully');
    } catch (error) {
      next(error);
    }
  }
}
