import { z } from 'zod';
import { ECNDepartment, MaterialDispositionType } from '@ecoflow/domain-types';

export const MaterialDispositionItemSchema = z.object({
  productId: z.string().uuid('Invalid product UUID').optional().nullable(),
  partNumber: z.string().max(100).optional().nullable(),
  dispositionType: z.nativeEnum(MaterialDispositionType, {
    errorMap: () => ({ message: 'Invalid material disposition type specified' }),
  }),
  quantity: z.number().positive('Quantity must be positive').optional().nullable(),
  instructions: z.string().min(3, 'Disposition instructions are required and must be at least 3 characters'),
  responsibleDepartment: z.nativeEnum(ECNDepartment, {
    errorMap: () => ({ message: 'Invalid responsible department specified' }),
  }),
});

export const GenerateECNSchema = z.object({
  effectiveDate: z
    .string({ required_error: 'Effective date is required' })
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Valid effective date format required' }),
  targetDepartments: z
    .array(
      z.nativeEnum(ECNDepartment, {
        errorMap: () => ({ message: 'Invalid target department' }),
      })
    )
    .min(1, 'At least one target department is required for ECN distribution'),
  changeSummary: z.string().min(3, 'Change summary must be at least 3 characters').max(2000).optional(),
  reasonForChange: z.string().max(2000).optional(),
  initialDispositions: z.array(MaterialDispositionItemSchema).optional(),
});

export const IssueECNSchema = z.object({
  effectiveDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Valid effective date format required' })
    .optional(),
  targetDepartments: z.array(z.nativeEnum(ECNDepartment)).min(1).optional(),
  notes: z.string().max(2000).optional(),
});

export const CompleteECNSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const CancelECNSchema = z.object({
  cancellationReason: z
    .string({ required_error: 'Cancellation reason is mandatory' })
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(2000, 'Cancellation reason cannot exceed 2000 characters'),
});

export const AcknowledgeDistributionSchema = z.object({
  comments: z.string().max(2000).optional(),
});

export const CreateMaterialDispositionSchema = MaterialDispositionItemSchema;

export type GenerateECNInput = z.infer<typeof GenerateECNSchema>;
export type IssueECNInput = z.infer<typeof IssueECNSchema>;
export type CompleteECNInput = z.infer<typeof CompleteECNSchema>;
export type CancelECNInput = z.infer<typeof CancelECNSchema>;
export type AcknowledgeDistributionInput = z.infer<typeof AcknowledgeDistributionSchema>;
export type CreateMaterialDispositionInput = z.infer<typeof CreateMaterialDispositionSchema>;

