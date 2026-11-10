import { z } from 'zod';

export const createECOSchema = z.object({
  productId: z.string().uuid(),
  bomId: z.string().uuid(),
  ecoNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  reason: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  changeSummary: z.string().min(1).default('Initial revision'),
});

export const addChangeSchema = z.object({
  changeType: z.enum(['QUANTITY_CHANGE', 'MATERIAL_CHANGE', 'COST_CHANGE', 'COMPONENT_ADDITION', 'COMPONENT_REMOVAL', 'SPECIFICATION_CHANGE']),
  changeTarget: z.enum(['PRODUCT', 'BOM', 'COMPONENT']),
  fieldName: z.string().min(1).max(100),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  description: z.string().optional(),
});

export const approveECOSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
  comments: z.string().optional(),
  overrideReason: z.string().optional(),
});

export const createRevisionSchema = z.object({
  changeSummary: z.string().min(1, 'Change summary cannot be empty').max(1000).optional(),
});

export const updateChangeSchema = z.object({
  changeType: z.enum(['QUANTITY_CHANGE', 'MATERIAL_CHANGE', 'COST_CHANGE', 'COMPONENT_ADDITION', 'COMPONENT_REMOVAL', 'SPECIFICATION_CHANGE']).optional(),
  changeTarget: z.enum(['PRODUCT', 'BOM', 'COMPONENT']).optional(),
  fieldName: z.string().min(1).max(100).optional(),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  impactType: z.enum(['COST', 'MATERIAL', 'MANUFACTURING', 'QUALITY', 'COMPLIANCE']).optional(),
  justification: z.string().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type CreateECOInput = z.infer<typeof createECOSchema>;
export type AddChangeInput = z.infer<typeof addChangeSchema>;
export type ApproveECOInput = z.infer<typeof approveECOSchema>;
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
export type UpdateChangeInput = z.infer<typeof updateChangeSchema>;
