import { Response, NextFunction } from 'express';
import { ECNService } from './ecn.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class ECNController {
  public static async generateECN(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ecoId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecn = await ECNService.generateECN(ecoId!, req.body, req.user!.userId);
      sendCreated(res, ecn, 'Engineering Change Notice generated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async listECNs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string | undefined;
      const department = req.query.department as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await ECNService.listECNs({ page, limit, status, department, search }, req.user!);
      sendSuccess(res, result.ecns, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  public static async getECN(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecn = await ECNService.getECNById(id!, req.user!);
      sendSuccess(res, ecn);
    } catch (error) {
      next(error);
    }
  }

  public static async issueECN(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecn = await ECNService.issueECN(id!, req.body, req.user!.userId);
      sendSuccess(res, ecn, 'ECN issued to target departments');
    } catch (error) {
      next(error);
    }
  }

  public static async completeECN(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecn = await ECNService.completeECN(id!, req.body, req.user!.userId);
      sendSuccess(res, ecn, 'ECN marked as completed');
    } catch (error) {
      next(error);
    }
  }

  public static async cancelECN(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecn = await ECNService.cancelECN(id!, req.body, req.user!.userId);
      sendSuccess(res, ecn, 'ECN cancelled');
    } catch (error) {
      next(error);
    }
  }

  public static async acknowledgeDistribution(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ecnId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const distributionId = Array.isArray(req.params.distributionId)
        ? req.params.distributionId[0]
        : req.params.distributionId;

      const dist = await ECNService.acknowledgeDistribution(
        ecnId!,
        distributionId!,
        req.body,
        req.user!.userId,
        req.user!
      );
      sendSuccess(res, dist, 'Department distribution acknowledged');
    } catch (error) {
      next(error);
    }
  }

  public static async addDisposition(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const disp = await ECNService.addMaterialDisposition(id!, req.body, req.user!.userId);
      sendCreated(res, disp, 'Material disposition recorded');
    } catch (error) {
      next(error);
    }
  }
}

