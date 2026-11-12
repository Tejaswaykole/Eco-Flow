import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service.js';

export class AdminController {
  public static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const roleId = req.query.roleId as string | undefined;

      const result = await AdminService.listUsers(page, limit, search, status, roleId);
      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user.id;
      const user = await AdminService.createUser(req.body, actorId);
      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { status } = req.body;
      const actorId = (req as any).user.id;
      const user = await AdminService.updateUserStatus(id!, status, actorId);
      res.json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateUserRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { roleIds } = req.body;
      const actorId = (req as any).user.id;
      const user = await AdminService.updateUserRoles(id!, roleIds, actorId);
      res.json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await AdminService.listRoles();
      res.json({
        success: true,
        data: roles,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const permissions = await AdminService.listPermissions();
      res.json({
        success: true,
        data: permissions,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const result = await AdminService.listAuditLogs({
        page,
        limit,
        entityType: req.query.entityType as string,
        entityId: req.query.entityId as string,
        userId: req.query.userId as string,
        action: req.query.action as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
      });
      res.json({
        success: true,
        data: result.activities,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSystemHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const health = await AdminService.getSystemHealth();
      res.json({
        success: true,
        data: health,
      });
    } catch (err) {
      next(err);
    }
  }
}
