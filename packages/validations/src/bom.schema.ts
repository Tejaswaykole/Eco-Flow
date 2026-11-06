import { z } from 'zod';
import { BOMStatus } from '@ecoflow/domain-types';

export const BOMComponentSchema = z.object({
  componentName: z
    .string({ required_error: 'Component name is required' })
    .min(2, 'Component name must be at least 2 characters')
    .max(150, 'Component name cannot exceed 150 characters'),
  materialType: z
    .string({ required_error: 'Material type is required' })
    .min(2, 'Material type must be at least 2 characters')
    .max(100, 'Material type cannot exceed 100 characters'),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .positive('Quantity must be greater than zero')
    .finite('Quantity must be a finite number'),
  unit: z
    .string({ required_error: 'Unit is required' })
    .min(1, 'Unit is required')
    .max(30, 'Unit cannot exceed 30 characters'),
  unitCost: z
    .number({ required_error: 'Unit cost is required' })
    .nonnegative('Unit cost cannot be negative')
    .finite('Unit cost must be a finite number')
    .multipleOf(0.01, 'Unit cost cannot have more than 2 decimal places'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export const calculateBOMComponentTotal = (quantity: number, unitCost: number): number => {
  // Deterministic monetary precision calculation rounded to 2 decimal places (cents)
  return Math.round(quantity * unitCost * 100) / 100;
};

export const CreateBOMSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .uuid('Invalid product ID format'),
  bomCode: z
    .string({ required_error: 'BOM code is required' })
    .min(2, 'BOM code must be at least 2 characters')
    .max(50, 'BOM code cannot exceed 50 characters')
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'BOM code may only contain alphanumeric characters, hyphens, and underscores',
    ),
  bomName: z
    .string({ required_error: 'BOM name is required' })
    .min(2, 'BOM name must be at least 2 characters')
    .max(200, 'BOM name cannot exceed 200 characters'),
  description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional(),
  components: z.array(BOMComponentSchema).optional(),
});

export const UpdateBOMSchema = z.object({
  bomName: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.nativeEnum(BOMStatus).optional(),
});

export type BOMComponentInput = z.infer<typeof BOMComponentSchema>;
export type CreateBOMInput = z.infer<typeof CreateBOMSchema>;
export type UpdateBOMInput = z.infer<typeof UpdateBOMSchema>;
