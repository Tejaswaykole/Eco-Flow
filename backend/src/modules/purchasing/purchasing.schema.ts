import { z } from 'zod';

export const createPOLineSchema = z.object({
  productId: z.string().uuid(),
  quantityOrdered: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().nonnegative(),
  unitOfMeasure: z.string().min(1).max(50).default('PCS'),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  expectedDeliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  lines: z.array(createPOLineSchema).min(1, 'Purchase order must have at least one line item'),
});

export const receiveGoodsLineSchema = z.object({
  lineId: z.string().uuid(),
  quantityReceived: z.number().positive(),
  warehouseId: z.string().uuid(),
});

export const receiveGoodsSchema = z.object({
  lines: z.array(receiveGoodsLineSchema).min(1),
  notes: z.string().optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;

