import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, AppError } from '../../utils/errors.js';
import { CreateBOMInput, AddBOMComponentInput, UpdateBOMComponentInput } from './bom.schema.js';
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';

export class BOMService {
  public static async createBOM(input: CreateBOMInput, userId: string) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) throw new NotFoundError('Product', input.productId);

    const existing = await prisma.bOM.findFirst({
      where: { bom_number: input.bomNumber },
    });
    if (existing) throw new ConflictError(`BOM number '${input.bomNumber}' already exists`);

    return await prisma.bOM.create({
      data: {
        id: randomUUID(),
        product_id: input.productId,
        bom_number: input.bomNumber,
        created_by: userId,
        status: 'DRAFT',
      },
      include: {
        product: true,
      },
    });
  }

  public static async listBOMs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const [total, boms] = await Promise.all([
      prisma.bOM.count(),
      prisma.bOM.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          components: true,
        },
      }),
    ]);

    return {
      data: boms,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getBOMById(id: string) {
    const bom = await prisma.bOM.findFirst({
      where: { id },
      include: {
        product: true,
        components: {
          orderBy: { part_number: 'asc' },
        },
        bom_versions: {
          orderBy: { version_number: 'desc' },
        },
      },
    });

    if (!bom) throw new NotFoundError('BOM', id);
    return bom;
  }

  public static async addComponent(bomId: string, input: AddBOMComponentInput, userId?: string) {
    const bom = await prisma.bOM.findFirst({
      where: { id: bomId },
    });
    if (!bom) throw new NotFoundError('BOM', bomId);

    if (bom.status !== 'DRAFT') {
      throw new AppError('Cannot add components to non-draft BOM directly; submit an Engineering Change Order (ECO)', 400);
    }

    const qty = new Decimal(input.quantity);
    const cost = new Decimal(input.unitCost);
    const totalCost = qty.times(cost).toDecimalPlaces(2);

    const component = await prisma.bOMComponent.create({
      data: {
        id: randomUUID(),
        bom_id: bomId,
        part_number: input.partNumber,
        name: input.name,
        component_type: input.componentType as any,
        quantity: qty.toFixed(4) as any,
        unit_of_measure: input.unitOfMeasure,
        unit_cost: cost.toFixed(2) as any,
        total_cost: totalCost.toFixed(2) as any,
      },
    });

    // Record Audit Trail
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        user_id: userId || bom.created_by,
        action: 'BOM_COMPONENT_ADDED',
        entity_type: 'BOM',
        entity_id: bomId,
        new_values: {
          componentId: component.id,
          partNumber: component.part_number,
          name: component.name,
          componentType: component.component_type,
          quantity: component.quantity.toString(),
          unitCost: component.unit_cost.toString(),
          totalCost: component.total_cost.toString(),
          unitOfMeasure: component.unit_of_measure,
          notes: input.notes,
        },
      },
    });

    return component;
  }

  public static async updateComponent(
    bomId: string,
    componentId: string,
    input: UpdateBOMComponentInput,
    userId?: string
  ) {
    const bom = await prisma.bOM.findFirst({ where: { id: bomId } });
    if (!bom) throw new NotFoundError('BOM', bomId);

    if (bom.status !== 'DRAFT') {
      throw new AppError('Cannot modify components in non-draft BOM directly; submit an Engineering Change Order (ECO)', 400);
    }

    const oldComp = await prisma.bOMComponent.findFirst({
      where: { id: componentId, bom_id: bomId },
    });
    if (!oldComp) throw new NotFoundError('BOM Component', componentId);

    const qty = input.quantity !== undefined ? new Decimal(input.quantity) : new Decimal(oldComp.quantity.toString());
    const cost = input.unitCost !== undefined ? new Decimal(input.unitCost) : new Decimal(oldComp.unit_cost.toString());
    const totalCost = qty.times(cost).toDecimalPlaces(2);

    const updated = await prisma.bOMComponent.update({
      where: { id: componentId },
      data: {
        ...(input.partNumber && { part_number: input.partNumber }),
        ...(input.name && { name: input.name }),
        ...(input.componentType && { component_type: input.componentType as any }),
        quantity: qty.toFixed(4) as any,
        unit_cost: cost.toFixed(2) as any,
        total_cost: totalCost.toFixed(2) as any,
        ...(input.unitOfMeasure && { unit_of_measure: input.unitOfMeasure }),
      },
    });

    // Record Audit Trail
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        user_id: userId || bom.created_by,
        action: 'BOM_COMPONENT_MODIFIED',
        entity_type: 'BOM',
        entity_id: bomId,
        old_values: {
          partNumber: oldComp.part_number,
          name: oldComp.name,
          componentType: oldComp.component_type,
          quantity: oldComp.quantity.toString(),
          unitCost: oldComp.unit_cost.toString(),
          totalCost: oldComp.total_cost.toString(),
          unitOfMeasure: oldComp.unit_of_measure,
        },
        new_values: {
          partNumber: updated.part_number,
          name: updated.name,
          componentType: updated.component_type,
          quantity: updated.quantity.toString(),
          unitCost: updated.unit_cost.toString(),
          totalCost: updated.total_cost.toString(),
          unitOfMeasure: updated.unit_of_measure,
          notes: input.notes,
        },
      },
    });

    return updated;
  }

  public static async removeComponent(bomId: string, componentId: string, userId?: string) {
    const bom = await prisma.bOM.findFirst({ where: { id: bomId } });
    if (!bom) throw new NotFoundError('BOM', bomId);

    if (bom.status !== 'DRAFT') {
      throw new AppError('Cannot remove components from non-draft BOM directly; submit an Engineering Change Order (ECO)', 400);
    }

    const comp = await prisma.bOMComponent.findFirst({
      where: { id: componentId, bom_id: bomId },
    });
    if (!comp) throw new NotFoundError('BOM Component', componentId);

    await prisma.bOMComponent.delete({
      where: { id: componentId },
    });

    // Record Audit Trail
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        user_id: userId || bom.created_by,
        action: 'BOM_COMPONENT_REMOVED',
        entity_type: 'BOM',
        entity_id: bomId,
        old_values: {
          componentId: comp.id,
          partNumber: comp.part_number,
          name: comp.name,
          componentType: comp.component_type,
          quantity: comp.quantity.toString(),
          unitCost: comp.unit_cost.toString(),
          totalCost: comp.total_cost.toString(),
          unitOfMeasure: comp.unit_of_measure,
        },
      },
    });
  }

  public static async getBOMHistory(bomId: string) {
    return await prisma.auditLog.findMany({
      where: {
        entity_type: 'BOM',
        entity_id: bomId,
      },
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            user_roles: {
              select: {
                role: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  }
}
