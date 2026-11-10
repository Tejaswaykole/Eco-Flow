import { z } from 'zod';

export const createBOMSchema = z.object({
  productId: z.string().uuid(),
  bomNumber: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const addBOMComponentSchema = z.object({
  partNumber: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  componentType: z.enum([
    'RAW_MATERIAL',
    'SUB_ASSEMBLY',
    'HARDWARE',
    'ELECTRONIC',
    'MECHANICAL',
    'ELECTRICAL',
    'OPTICAL',
    'CHEMICAL',
    'FASTENER',
    'PLASTIC_MOLDED',
    'SHEET_METAL',
    'CONSUMABLE',
    'LABEL_PRINTING',
    'CABLE_WIRE',
    'TOOLING',
    'SOFTWARE_FIRMWARE',
    'PACKAGING',
    'OTHER',
  ]),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1).max(20).default('PCS'),
  unitCost: z.number().nonnegative(),
  materialType: z.string().optional(),
  notes: z.string().optional(),
  subAssemblyBomId: z.string().uuid().optional(),
  subAssemblyVersion: z.number().int().positive().optional(),
  isCostOverridden: z.boolean().optional(),
  costOverrideReason: z.string().optional(),
}).refine(
  (data) => {
    if (data.isCostOverridden && (!data.costOverrideReason || data.costOverrideReason.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'costOverrideReason is required when isCostOverridden is true',
    path: ['costOverrideReason'],
  }
).refine(
  (data) => {
    if (data.subAssemblyBomId && data.componentType !== 'SUB_ASSEMBLY') {
      return false;
    }
    return true;
  },
  {
    message: "componentType must be 'SUB_ASSEMBLY' when subAssemblyBomId is provided",
    path: ['componentType'],
  }
).refine(
  (data) => {
    if (data.subAssemblyVersion !== undefined && !data.subAssemblyBomId) {
      return false;
    }
    return true;
  },
  {
    message: 'subAssemblyVersion cannot be provided without subAssemblyBomId',
    path: ['subAssemblyVersion'],
  }
);

export type CreateBOMInput = z.infer<typeof createBOMSchema>;
export type AddBOMComponentInput = z.infer<typeof addBOMComponentSchema>;

export const updateBOMComponentSchema = z.object({
  partNumber: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(255).optional(),
  componentType: z.enum([
    'RAW_MATERIAL',
    'SUB_ASSEMBLY',
    'HARDWARE',
    'ELECTRONIC',
    'MECHANICAL',
    'ELECTRICAL',
    'OPTICAL',
    'CHEMICAL',
    'FASTENER',
    'PLASTIC_MOLDED',
    'SHEET_METAL',
    'CONSUMABLE',
    'LABEL_PRINTING',
    'CABLE_WIRE',
    'TOOLING',
    'SOFTWARE_FIRMWARE',
    'PACKAGING',
    'OTHER',
  ]).optional(),
  quantity: z.number().positive().optional(),
  unitOfMeasure: z.string().min(1).max(20).optional(),
  unitCost: z.number().nonnegative().optional(),
  materialType: z.string().optional(),
  notes: z.string().optional(),
  subAssemblyBomId: z.string().uuid().nullable().optional(),
  subAssemblyVersion: z.number().int().positive().nullable().optional(),
  isCostOverridden: z.boolean().optional(),
  costOverrideReason: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.isCostOverridden && (!data.costOverrideReason || data.costOverrideReason.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'costOverrideReason is required when isCostOverridden is true',
    path: ['costOverrideReason'],
  }
).refine(
  (data) => {
    if (data.subAssemblyBomId === null && data.subAssemblyVersion && data.subAssemblyVersion !== null) {
      return false;
    }
    return true;
  },
  {
    message: 'subAssemblyVersion cannot be provided when subAssemblyBomId is explicitly set to null',
    path: ['subAssemblyVersion'],
  }
);

export type UpdateBOMComponentInput = z.infer<typeof updateBOMComponentSchema>;
