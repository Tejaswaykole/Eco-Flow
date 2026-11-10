import { z } from 'zod';
import { ECRRequestType, PriorityLevel } from '@ecoflow/domain-types';

export const CreateECRSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title cannot exceed 255 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .min(10, 'Description must be at least 10 characters'),
  requestType: z.nativeEnum(ECRRequestType, {
    errorMap: () => ({ message: 'Invalid request type specified' }),
  }),
  priority: z
    .nativeEnum(PriorityLevel, {
      errorMap: () => ({ message: 'Invalid priority level specified' }),
    })
    .default(PriorityLevel.MEDIUM),
  productId: z.string().uuid('Invalid product ID format').nullable().optional(),
  bomId: z.string().uuid('Invalid BOM ID format').nullable().optional(),
  affectedPartNumber: z.string().max(100, 'Part number cannot exceed 100 characters').nullable().optional(),
  suggestedSolution: z.string().nullable().optional(),
});

export const AssignECRSchema = z.object({
  assignedTo: z.string({ required_error: 'Assignee ID is required' }).uuid('Invalid user ID format'),
});

export const StartReviewECRSchema = z.object({
  comments: z.string().max(2000).optional(),
});

export const RequestInformationECRSchema = z.object({
  comments: z
    .string({ required_error: 'Review comments explaining requested information are mandatory' })
    .min(3, 'Review comments must be at least 3 characters')
    .max(2000, 'Review comments cannot exceed 2000 characters'),
});

export const ResubmitECRSchema = z.object({
  comments: z.string().max(2000).optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').optional(),
  suggestedSolution: z.string().optional(),
});

export const AcceptECRSchema = z.object({
  reviewComments: z.string().max(2000).optional(),
});

export const RejectECRSchema = z.object({
  rejectionReason: z
    .string({ required_error: 'Rejection reason is mandatory' })
    .min(3, 'Rejection reason must be at least 3 characters')
    .max(2000, 'Rejection reason cannot exceed 2000 characters'),
});

export const PromoteECRSchema = z.object({
  ecoNumber: z
    .string({ required_error: 'ECO number is required' })
    .min(3, 'ECO number must be at least 3 characters')
    .max(100, 'ECO number cannot exceed 100 characters'),
  productId: z.string().uuid('Invalid product ID format').optional(),
  bomId: z.string().uuid('Invalid BOM ID format').optional(),
  changeSummary: z.string().max(2000).optional(),
});

export type CreateECRInput = z.infer<typeof CreateECRSchema>;
export type AssignECRInput = z.infer<typeof AssignECRSchema>;
export type StartReviewECRInput = z.infer<typeof StartReviewECRSchema>;
export type RequestInformationECRInput = z.infer<typeof RequestInformationECRSchema>;
export type ResubmitECRInput = z.infer<typeof ResubmitECRSchema>;
export type AcceptECRInput = z.infer<typeof AcceptECRSchema>;
export type RejectECRInput = z.infer<typeof RejectECRSchema>;
export type PromoteECRInput = z.infer<typeof PromoteECRSchema>;
