import { z } from 'zod';

export const createWorkOrderSchema = z.object({
  productId: z.string().uuid(),
  bomId: z.string().uuid(),
  bomVersionId: z.string().uuid().optional(),
  targetQuantity: z.number().positive('Target quantity must be greater than zero'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const consumeMaterialSchema = z.object({
  allocationId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const completeWorkOrderSchema = z.object({
  completedQuantity: z.number().positive('Completed quantity must be greater than zero'),
  rejectedQuantity: z.number().nonnegative().default(0),
  warehouseId: z.string().uuid('Warehouse required to store finished goods'),
  notes: z.string().optional(),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type ConsumeMaterialInput = z.infer<typeof consumeMaterialSchema>;
export type CompleteWorkOrderInput = z.infer<typeof completeWorkOrderSchema>;

