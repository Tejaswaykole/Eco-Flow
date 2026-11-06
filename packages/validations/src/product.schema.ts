import { z } from 'zod';
import { ProductStatus } from '@ecoflow/domain-types';

export const CreateProductCategorySchema = z.object({
  name: z
    .string({ required_error: 'Category name is required' })
    .min(2, 'Category name must be at least 2 characters')
    .max(100, 'Category name cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
});

export const UpdateProductCategorySchema = CreateProductCategorySchema.partial();

export const CreateProductSchema = z.object({
  productCode: z
    .string({ required_error: 'Product code is required' })
    .min(2, 'Product code must be at least 2 characters')
    .max(50, 'Product code cannot exceed 50 characters')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Product code may only contain alphanumeric characters, hyphens, and underscores',
    ),
  productName: z
    .string({ required_error: 'Product name is required' })
    .min(2, 'Product name must be at least 2 characters')
    .max(200, 'Product name cannot exceed 200 characters'),
  categoryId: z
    .string({ required_error: 'Category ID is required' })
    .uuid('Invalid category ID format'),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional(),
  imageUrl: z.string().url('Invalid image URL format').max(1000).optional(),
});

export const UpdateProductSchema = z.object({
  productName: z.string().min(2).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().max(1000).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
});

export type CreateProductCategoryInput = z.infer<typeof CreateProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof UpdateProductCategorySchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
