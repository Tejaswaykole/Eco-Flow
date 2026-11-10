import { Request, Response, NextFunction } from 'express';
import { ECOService } from './eco.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { IdempotencyService } from '../../services/idempotency.service.js';

export class ECOController {
  public static async createECO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      if (idempotencyKey) {
        const result = await IdempotencyService.execute(
          {
            scope: 'CREATE_ECO',
            key: idempotencyKey,
            actorId: req.user!.userId,
            requestPayload: req.body,
          },
          () => ECOService.createECO(req.body, req.user!.userId)
        );
        sendCreated(res, result.data, result.isCached ? 'ECO retrieved from idempotency cache' : 'ECO created successfully');
        return;
      }

      const eco = await ECOService.createECO(req.body, req.user!.userId);
      sendCreated(res, eco, 'ECO created successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async listECOs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string | undefined;

      const result = await ECOService.listECOs(page, limit, status);
      sendSuccess(res, result.ecos, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  public static async getECO(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const eco = await ECOService.getECOById(id!);
      sendSuccess(res, eco);
    } catch (error) {
      next(error);
    }
  }

  public static async addChange(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const change = await ECOService.addChange(id!, req.body, req.user!.userId);
      sendCreated(res, change, 'Change added to ECO');
    } catch (error) {
      next(error);
    }
  }

  public static async createRevision(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ECOService.createRevision(id!, req.body, req.user!.userId, req.user!.roles);
      sendCreated(res, result, `Revision ${result.revision.revision_number} initialized successfully in DRAFT`);
    } catch (error) {
      next(error);
    }
  }

  public static async updateChange(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const changeId = Array.isArray(req.params.changeId) ? req.params.changeId[0] : req.params.changeId;
      const updated = await ECOService.updateChange(id!, changeId!, req.body, req.user!.userId, req.user!.roles);
      sendSuccess(res, updated, 'Change item updated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async removeChange(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const changeId = Array.isArray(req.params.changeId) ? req.params.changeId[0] : req.params.changeId;
      const result = await ECOService.removeChange(id!, changeId!, req.user!.userId, req.user!.roles);
      sendSuccess(res, result, 'Change item deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async submitECO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ECOService.submitECO(id!, req.user!.userId);
      sendSuccess(res, result, 'ECO submitted for review');
    } catch (error) {
      next(error);
    }
  }

  public static async reviewECO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ECOService.reviewECO(id!, req.body, req.user!.userId, req.user!.roles);
      sendSuccess(res, result, `ECO decision '${result.newStatus}' applied successfully`);
    } catch (error) {
      next(error);
    }
  }
}
