import { z } from 'zod';
import { PriorityLevel, ChangeType, ImpactType, ApprovalDecision } from '@ecoflow/domain-types';

export const ECOChangeSchema = z.object({
  changeType: z.nativeEnum(ChangeType, {
    errorMap: () => ({ message: 'Invalid change type specified' }),
  }),
  fieldName: z
    .string({ required_error: 'Field name is required' })
    .min(1, 'Field name cannot be empty')
    .max(100, 'Field name cannot exceed 100 characters'),
  oldValue: z.string().max(1000).nullable().optional(),
  newValue: z.string().max(1000).nullable().optional(),
  impactType: z.nativeEnum(ImpactType, {
    errorMap: () => ({ message: 'Invalid impact type specified' }),
  }),
});

export const CreateECOSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .uuid('Invalid product ID format'),
  bomId: z.string({ required_error: 'BOM ID is required' }).uuid('Invalid BOM ID format'),
  title: z
    .string({ required_error: 'Title is required' })
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z.string().max(3000, 'Description cannot exceed 3000 characters').optional(),
  reason: z.string().max(2000, 'Reason cannot exceed 2000 characters').optional(),
  priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.LOW),
  changes: z.array(ECOChangeSchema).optional(),
});

export const SubmitECOSchema = z.object({
  changes: z
    .array(ECOChangeSchema, { required_error: 'ECO submission requires changes' })
    .min(1, 'An ECO must have at least one change record before submitting'),
});

export const UpdateECOSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(3000).optional(),
  reason: z.string().max(2000).optional(),
  priority: z.nativeEnum(PriorityLevel).optional(),
});

export const AddECOCommentSchema = z.object({
  comment: z
    .string({ required_error: 'Comment cannot be empty' })
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment cannot exceed 2000 characters'),
});

export const ProcessApprovalSchema = z
  .object({
    decision: z.nativeEnum(ApprovalDecision, {
      errorMap: () => ({ message: 'Invalid approval decision' }),
    }),
    reviewNotes: z.string().max(2000, 'Review notes cannot exceed 2000 characters').optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.decision === ApprovalDecision.REJECTED ||
        data.decision === ApprovalDecision.CHANGES_REQUESTED) &&
      (!data.reviewNotes || data.reviewNotes.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewNotes'],
        message: 'Review notes are mandatory when rejecting or requesting changes',
      });
    }
  });

export type ECOChangeInput = z.infer<typeof ECOChangeSchema>;
export type CreateECOInput = z.infer<typeof CreateECOSchema>;
export type SubmitECOInput = z.infer<typeof SubmitECOSchema>;
export type UpdateECOInput = z.infer<typeof UpdateECOSchema>;
export type AddECOCommentInput = z.infer<typeof AddECOCommentSchema>;
export type ProcessApprovalInput = z.infer<typeof ProcessApprovalSchema>;
