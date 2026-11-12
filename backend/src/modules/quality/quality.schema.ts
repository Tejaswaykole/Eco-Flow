import { z } from 'zod';

export const createInspectionSchema = z.object({
  type: z.enum(['RECEIVING', 'IN_PROCESS', 'FINAL', 'FIRST_ARTICLE']),
  productId: z.string().uuid(),
  bomId: z.string().uuid().optional(),
  workOrderId: z.string().uuid().optional(),
  poId: z.string().uuid().optional(),
  sampleSize: z.number().positive().default(1),
  notes: z.string().optional(),
});

export const recordInspectionResultSchema = z.object({
  status: z.enum(['PASSED', 'FAILED', 'CONDITIONALLY_PASSED']),
  passedQuantity: z.number().nonnegative(),
  failedQuantity: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const createNCRSchema = z.object({
  productId: z.string().uuid(),
  inspectionId: z.string().uuid().optional(),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).default('MINOR'),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  rootCause: z.string().optional(),
  disposition: z.string().max(100).optional(),
  capaPlan: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
});

export const updateNCRSchema = z.object({
  status: z.enum(['OPEN', 'UNDER_INVESTIGATION', 'CAPA_REQUIRED', 'CLOSED', 'REJECTED']).optional(),
  rootCause: z.string().optional(),
  disposition: z.string().max(100).optional(),
  capaPlan: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
});

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type RecordInspectionResultInput = z.infer<typeof recordInspectionResultSchema>;
export type CreateNCRInput = z.infer<typeof createNCRSchema>;
export type UpdateNCRInput = z.infer<typeof updateNCRSchema>;

