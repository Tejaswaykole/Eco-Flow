import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';

export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(requirePermission('admin:all'));

adminRouter.get('/users', AdminController.listUsers);
adminRouter.post('/users', AdminController.createUser);
adminRouter.patch('/users/:id/status', AdminController.updateUserStatus);
adminRouter.put('/users/:id/roles', AdminController.updateUserRoles);

adminRouter.get('/roles', AdminController.listRoles);
adminRouter.get('/permissions', AdminController.listPermissions);
adminRouter.get('/audit-logs', AdminController.listAuditLogs);
adminRouter.get('/system-health', AdminController.getSystemHealth);
