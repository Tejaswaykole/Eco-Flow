import { z } from 'zod';

export const createECRSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255, 'Title cannot exceed 255 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  requestType: z.enum(['DEFECT', 'IMPROVEMENT', 'COST_REDUCTION', 'SAFETY', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  productId: z.string().uuid().nullable().optional(),
  bomId: z.string().uuid().nullable().optional(),
  affectedPartNumber: z.string().max(100).nullable().optional(),
  suggestedSolution: z.string().nullable().optional(),
});

export const assignECRSchema = z.object({
  assignedTo: z.string().uuid('Valid user UUID required for assignee'),
});

export const startReviewECRSchema = z.object({
  comments: z.string().max(2000).optional(),
});

export const requestInfoECRSchema = z.object({
  comments: z.string().min(3, 'Review comments explaining requested information are mandatory').max(2000),
});

export const resubmitECRSchema = z.object({
  comments: z.string().max(2000).optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').optional(),
  suggestedSolution: z.string().optional(),
});

export const acceptECRSchema = z.object({
  reviewComments: z.string().max(2000).optional(),
});

export const rejectECRSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason is mandatory').max(2000),
});

export const promoteECRSchema = z.object({
  ecoNumber: z.string().min(3, 'ECO number must be at least 3 characters').max(100),
  productId: z.string().uuid().optional(),
  bomId: z.string().uuid().optional(),
  changeSummary: z.string().max(2000).optional(),
});

export type CreateECRInput = z.infer<typeof createECRSchema>;
export type AssignECRInput = z.infer<typeof assignECRSchema>;
export type StartReviewECRInput = z.infer<typeof startReviewECRSchema>;
export type RequestInfoECRInput = z.infer<typeof requestInfoECRSchema>;
export type ResubmitECRInput = z.infer<typeof resubmitECRSchema>;
export type AcceptECRInput = z.infer<typeof acceptECRSchema>;
export type RejectECRInput = z.infer<typeof rejectECRSchema>;
export type PromoteECRInput = z.infer<typeof promoteECRSchema>;

