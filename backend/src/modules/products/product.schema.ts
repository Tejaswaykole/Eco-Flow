import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

export const createProductSchema = z.object({
  partNumber: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
