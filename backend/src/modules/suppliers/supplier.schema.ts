import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(255),
  contactName: z.string().max(100).optional(),
  email: z.string().email('Invalid email address').max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  rating: z.number().min(1).max(5).default(5),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_QUALIFICATION', 'BLOCKED']).optional(),
  contactName: z.string().max(100).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const addSupplierProductSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  supplierPartNumber: z.string().max(100).optional(),
  leadTimeDays: z.number().int().nonnegative().default(7),
  unitPrice: z.number().nonnegative(),
  minimumOrderQty: z.number().positive().default(1),
  currency: z.string().max(10).default('INR'),
  isPreferred: z.boolean().default(false),
  status: z.string().default('ACTIVE').optional(),
  validUntil: z.string().datetime().optional().nullable(),
});

export const bulkMapProductsSchema = z.object({
  mappings: z.array(addSupplierProductSchema).min(1, 'At least one mapping is required'),
});

export const updateSupplierProductSchema = z.object({
  supplierPartNumber: z.string().max(100).optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  minimumOrderQty: z.number().positive().optional(),
  currency: z.string().max(10).optional(),
  isPreferred: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  validUntil: z.string().datetime().optional().nullable(),
});

export const importPreviewSchema = z.object({
  rows: z.array(z.record(z.any())).min(1, 'No data rows provided for import'),
  columnMapping: z.record(z.string()).optional(),
});

export const importCommitSchema = z.object({
  rows: z.array(
    z.object({
      productId: z.string().uuid(),
      supplierPartNumber: z.string().optional().nullable(),
      unitPrice: z.number().nonnegative(),
      currency: z.string().default('INR'),
      leadTimeDays: z.number().int().nonnegative().default(7),
      minimumOrderQty: z.number().positive().default(1),
      isPreferred: z.boolean().default(false),
    })
  ).min(1, 'At least one valid row must be selected for commit'),
});

export const createRFQSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  submissionDate: z.string().datetime().optional(),
  deadlineDate: z.string().datetime().optional().nullable(),
  deliveryDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional(),
  supplierIds: z.array(z.string().uuid()).min(1, 'At least one supplier must be invited'),
  items: z.array(
    z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantityRequired: z.number().positive('Quantity must be greater than zero'),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one product item is required in the RFQ'),
});

export const createQuotationSchema = z.object({
  rfqId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid('Supplier ID is required'),
  productId: z.string().uuid('Product ID is required'),
  supplierPartNumber: z.string().max(100).optional(),
  offeredQuantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  currency: z.string().default('INR'),
  taxAmount: z.number().nonnegative().default(0),
  shippingAmount: z.number().nonnegative().default(0),
  leadTimeDays: z.number().int().nonnegative().default(7),
  minimumOrderQuantity: z.number().positive().default(1),
  validUntil: z.string().datetime().optional().nullable(),
  termsConditions: z.string().optional(),
  status: z.enum(['DRAFT', 'REQUESTED', 'QUOTED', 'COUNTER_OFFERED', 'REVISED', 'ACCEPTED', 'REJECTED', 'EXPIRED']).default('QUOTED'),
});

export const negotiateQuotationSchema = z.object({
  eventType: z.enum(['COUNTER_OFFER', 'REVISED_OFFER', 'ACCEPTED', 'REJECTED']),
  counterPrice: z.number().nonnegative(),
  currency: z.string().default('INR'),
  message: z.string().min(1, 'Negotiation note or message is required'),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type AddSupplierProductInput = z.infer<typeof addSupplierProductSchema>;
export type BulkMapProductsInput = z.infer<typeof bulkMapProductsSchema>;
export type UpdateSupplierProductInput = z.infer<typeof updateSupplierProductSchema>;
export type ImportPreviewInput = z.infer<typeof importPreviewSchema>;
export type ImportCommitInput = z.infer<typeof importCommitSchema>;
export type CreateRFQInput = z.infer<typeof createRFQSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type NegotiateQuotationInput = z.infer<typeof negotiateQuotationSchema>;
