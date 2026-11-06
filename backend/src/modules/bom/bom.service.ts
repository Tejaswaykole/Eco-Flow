import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, AppError } from '../../utils/errors.js';
import { CreateBOMInput, AddBOMComponentInput } from './bom.schema.js';
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

  public static async addComponent(bomId: string, input: AddBOMComponentInput) {
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

    return await prisma.bOMComponent.create({
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
  }

  public static async removeComponent(bomId: string, componentId: string) {
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
  }
}
