import { z } from 'zod';

export const createWarehouseSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  location: z.string().max(255).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  location: z.string().max(255).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const transactStockSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  type: z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT', 'SCRAP', 'TRANSFER', 'RESERVATION']),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitCost: z.number().nonnegative().default(0),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const setThresholdSchema = z.object({
  minThreshold: z.number().nonnegative().optional(),
  maxThreshold: z.number().positive().optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type TransactStockInput = z.infer<typeof transactStockSchema>;
export type SetThresholdInput = z.infer<typeof setThresholdSchema>;

