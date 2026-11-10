import { Response, NextFunction } from 'express';
import { ECRService } from './ecr.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class ECRController {
  public static async createECR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ecr = await ECRService.createECR(req.body, req.user!.userId);
      sendCreated(res, ecr, 'Engineering Change Request submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async listECRs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string | undefined;
      const requestType = req.query.requestType as string | undefined;
      const priority = req.query.priority as string | undefined;
      const search = req.query.search as string | undefined;
      const myRequests = req.query.myRequests === 'true';

      const result = await ECRService.listECRs(
        { page, limit, status, requestType, priority, search, myRequests },
        req.user!
      );
      sendSuccess(res, result.ecrs, undefined, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  public static async getECR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecr = await ECRService.getECRById(id!, req.user!);
      sendSuccess(res, ecr);
    } catch (error) {
      next(error);
    }
  }

  public static async assignECR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecr = await ECRService.assignECR(id!, req.body, req.user!.userId);
      sendSuccess(res, ecr, 'ECR assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async startReview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecr = await ECRService.startReview(id!, req.body, req.user!.userId);
      sendSuccess(res, ecr, 'ECR review started');
    } catch (error) {
      next(error);
    }
  }

  public static async requestInformation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecr = await ECRService.requestInformation(id!, req.body, req.user!.userId);
      sendSuccess(res, ecr, 'Additional information requested');
    } catch (error) {
      next(error);
    }
  }

  public static async resubmitECR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecr = await ECRService.resubmitECR(id!, req.body, req.user!.userId, req.user!);
      sendSuccess(res, ecr, 'Information provided and ECR returned to review');
    } catch (error) {
      next(error);
    }
  }

  public static async acceptECR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecr = await ECRService.acceptECR(id!, req.body, req.user!.userId);
      sendSuccess(res, ecr, 'ECR accepted');
    } catch (error) {
      next(error);
    }
  }

  public static async rejectECR(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ecr = await ECRService.rejectECR(id!, req.body, req.user!.userId);
      sendSuccess(res, ecr, 'ECR rejected');
    } catch (error) {
      next(error);
    }
  }

  public static async promoteToECO(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ECRService.promoteToECO(id!, req.body, req.user!.userId);
      sendCreated(res, result, 'ECR promoted to Engineering Change Order');
    } catch (error) {
      next(error);
    }
  }
}

