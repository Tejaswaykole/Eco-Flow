import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { authenticate, requireRole, requirePermission } from '../../middleware/auth.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

// Restricted reports: Engineering, Inventory, Purchasing, and Exports are DENIED to Operator
reportsRouter.get('/engineering', requireRole('ADMINISTRATOR', 'LEAD_ENGINEER', 'APPROVER'), ReportsController.getEngineeringReport);
reportsRouter.get('/inventory', requireRole('ADMINISTRATOR', 'LEAD_ENGINEER', 'APPROVER'), ReportsController.getInventoryReport);
reportsRouter.get('/purchasing', requireRole('ADMINISTRATOR', 'LEAD_ENGINEER', 'APPROVER'), ReportsController.getPurchasingReport);
reportsRouter.get('/export', requireRole('ADMINISTRATOR', 'LEAD_ENGINEER', 'APPROVER'), ReportsController.exportCSV);

// Operational reports: Accessible to Operator, Approver, Lead Engineer, Administrator
reportsRouter.get('/manufacturing', requirePermission('manufacturing:read'), ReportsController.getManufacturingReport);
reportsRouter.get('/quality', requirePermission('quality:read'), ReportsController.getQualityReport);
