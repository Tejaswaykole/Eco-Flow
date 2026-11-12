import { Router } from 'express';
import { QualityController } from './quality.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createInspectionSchema, recordInspectionResultSchema, createNCRSchema, updateNCRSchema } from './quality.schema.js';

export const qualityRouter = Router();

qualityRouter.use(authenticate);

// Inspections
qualityRouter.get('/inspections', requirePermission('quality:read'), QualityController.listInspections);
qualityRouter.get('/inspections/:id', requirePermission('quality:read'), QualityController.getInspection);
qualityRouter.post('/inspections', requirePermission('quality:inspect'), validate(createInspectionSchema), QualityController.createInspection);
qualityRouter.post('/inspections/:id/results', requirePermission('quality:inspect'), validate(recordInspectionResultSchema), QualityController.recordInspectionResult);
qualityRouter.post('/inspections/:id/result', requirePermission('quality:inspect'), validate(recordInspectionResultSchema), QualityController.recordInspectionResult);

// Non-Conformance Reports (NCR)
qualityRouter.get('/ncrs', requirePermission('quality:read'), QualityController.listNCRs);
qualityRouter.get('/ncrs/:id', requirePermission('quality:read'), QualityController.getNCR);
qualityRouter.post('/ncrs', requirePermission('quality:write'), validate(createNCRSchema), QualityController.createNCR);
qualityRouter.patch('/ncrs/:id', requirePermission('quality:decide'), validate(updateNCRSchema), QualityController.updateNCR);

