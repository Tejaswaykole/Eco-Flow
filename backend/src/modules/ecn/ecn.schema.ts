import { z } from 'zod';

export const materialDispositionSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  partNumber: z.string().max(100).optional().nullable(),
  dispositionType: z.enum(['SCRAP', 'REWORK', 'USE_AS_IS']),
  quantity: z.number().positive().optional().nullable(),
  instructions: z.string().min(3, 'Disposition instructions are required'),
  responsibleDepartment: z.enum(['ENGINEERING', 'QUALITY', 'PRODUCTION', 'PROCUREMENT', 'INVENTORY', 'MANAGEMENT']),
});

export const generateECNSchema = z.object({
  effectiveDate: z
    .string({ required_error: 'Effective date is required' })
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Valid date required' }),
  targetDepartments: z
    .array(z.enum(['ENGINEERING', 'QUALITY', 'PRODUCTION', 'PROCUREMENT', 'INVENTORY', 'MANAGEMENT']))
    .min(1, 'At least one target department is required'),
  changeSummary: z.string().min(3).max(2000).optional(),
  reasonForChange: z.string().max(2000).optional(),
  initialDispositions: z.array(materialDispositionSchema).optional(),
});

export const issueECNSchema = z.object({
  effectiveDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Valid date required' })
    .optional(),
  targetDepartments: z
    .array(z.enum(['ENGINEERING', 'QUALITY', 'PRODUCTION', 'PROCUREMENT', 'INVENTORY', 'MANAGEMENT']))
    .min(1)
    .optional(),
  notes: z.string().max(2000).optional(),
});

export const completeECNSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const cancelECNSchema = z.object({
  cancellationReason: z.string().min(3, 'Cancellation reason is mandatory').max(2000),
});

export const acknowledgeDistributionSchema = z.object({
  comments: z.string().max(2000).optional(),
});

export const createMaterialDispositionSchema = materialDispositionSchema;

export type GenerateECNInput = z.infer<typeof generateECNSchema>;
export type IssueECNInput = z.infer<typeof issueECNSchema>;
export type CompleteECNInput = z.infer<typeof completeECNSchema>;
export type CancelECNInput = z.infer<typeof cancelECNSchema>;
export type AcknowledgeDistributionInput = z.infer<typeof acknowledgeDistributionSchema>;
export type CreateMaterialDispositionInput = z.infer<typeof createMaterialDispositionSchema>;

