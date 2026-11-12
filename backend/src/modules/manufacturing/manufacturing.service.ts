import { prisma } from '../../config/database.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { AuditService } from '../../services/audit.service.js';
import { CreateWorkOrderInput, ConsumeMaterialInput, CompleteWorkOrderInput } from './manufacturing.schema.js';
import { Decimal } from 'decimal.js';
import crypto from 'crypto';

export class ManufacturingService {
  private static generateWONumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `WO-${today}-${suffix}`;
  }

  public static async listWorkOrders(page = 1, limit = 50, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [total, workOrders] = await Promise.all([
      prisma.workOrder.count({ where }),
      prisma.workOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product: { select: { id: true, part_number: true, name: true } },
          bom: { select: { id: true, bom_number: true } },
          creator: { select: { id: true, email: true, first_name: true, last_name: true } },
          _count: { select: { allocations: true, inspections: true } },
        },
      }),
    ]);

    return {
      workOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getWorkOrder(id: string) {
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        product: true,
        bom: { include: { components: true } },
        bom_version: true,
        creator: { select: { id: true, email: true, first_name: true, last_name: true } },
        allocations: {
          include: { product: true },
        },
        inspections: true,
      },
    });

    if (!wo) throw new NotFoundError('WorkOrder', id);
    return wo;
  }

  public static async createWorkOrder(input: CreateWorkOrderInput, userId: string) {
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundError('Product', input.productId);

    const bom = await prisma.bOM.findUnique({
      where: { id: input.bomId },
      include: { components: true },
    });
    if (!bom) throw new NotFoundError('BOM', input.bomId);

    const woNumber = this.generateWONumber();
    const targetQty = new Decimal(input.targetQuantity);

    return await prisma.$transaction(async (tx) => {
      // Calculate material allocations from BOM components
      const allocationCreates = [];

      for (const comp of bom.components) {
        const compUnitQty = new Decimal(comp.quantity.toString());
        const requiredQty = targetQty.times(compUnitQty).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
        const unitCost = new Decimal(comp.unit_cost.toString());
        const lineTotalCost = requiredQty.times(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        // Find matching product in catalog by part_number if exists, else associate with parent product
        let compProd = await tx.product.findUnique({ where: { part_number: comp.part_number } });
        const targetProdId = compProd ? compProd.id : input.productId;

        allocationCreates.push({
          product_id: targetProdId,
          required_quantity: requiredQty.toFixed(4) as any,
          allocated_quantity: '0.0000',
          consumed_quantity: '0.0000',
          unit_of_measure: comp.unit_of_measure,
          unit_cost: unitCost.toFixed(2) as any,
          total_cost: lineTotalCost.toFixed(2) as any,
        });
      }

      const wo = await tx.workOrder.create({
        data: {
          wo_number: woNumber,
          product_id: input.productId,
          bom_id: input.bomId,
          bom_version_id: input.bomVersionId || null,
          target_quantity: targetQty.toFixed(4) as any,
          completed_quantity: '0.0000',
          rejected_quantity: '0.0000',
          status: 'PLANNED',
          start_date: input.startDate ? new Date(input.startDate) : null,
          end_date: input.endDate ? new Date(input.endDate) : null,
          created_by: userId,
          notes: input.notes || null,
          allocations: {
            create: allocationCreates,
          },
        },
        include: { allocations: true },
      });

      await AuditService.log({
        userId,
        action: 'WORK_ORDER_CREATED',
        entityType: 'WORK_ORDER',
        entityId: wo.id,
        newValues: { woNumber: wo.wo_number, targetQuantity: wo.target_quantity },
      });

      await AuditService.notify({
        userId: wo.created_by,
        type: 'SYSTEM_ALERT',
        title: `Work Order ${wo.wo_number} Created`,
        message: `Work Order ${wo.wo_number} created with target quantity ${wo.target_quantity}.`,
        link: `/manufacturing/work-orders`,
      });

      return wo;
    });
  }

  public static async startWorkOrder(id: string, userId: string) {
    const wo = await prisma.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundError('WorkOrder', id);

    if (wo.status !== 'PLANNED' && wo.status !== 'DRAFT') {
      throw new AppError(`Cannot start work order in status ${wo.status}`, 400);
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        start_date: wo.start_date || new Date(),
      },
    });

    await AuditService.log({
      userId,
      action: 'WORK_ORDER_STARTED',
      entityType: 'WORK_ORDER',
      entityId: id,
    });

    return updated;
  }

  public static async consumeMaterial(id: string, input: ConsumeMaterialInput, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUnique({
        where: { id },
        include: { allocations: true },
      });
      if (!wo) throw new NotFoundError('WorkOrder', id);

      if (wo.status !== 'IN_PROGRESS') {
        throw new AppError('Work order must be IN_PROGRESS to consume materials', 400);
      }

      const allocation = wo.allocations.find((a) => a.id === input.allocationId);
      if (!allocation) throw new NotFoundError('WorkOrderAllocation', input.allocationId);

      const consumeQty = new Decimal(input.quantity);
      const currentConsumed = new Decimal(allocation.consumed_quantity.toString());
      const newConsumed = currentConsumed.plus(consumeQty);

      // 1. Decrement inventory stock on hand (ISSUE)
      const invItem = await tx.inventoryItem.findUnique({
        where: {
          product_id_warehouse_id: {
            product_id: allocation.product_id,
            warehouse_id: input.warehouseId,
          },
        },
      });

      if (!invItem) {
        throw new AppError('Component not present in selected inventory warehouse', 400);
      }

      const onHand = new Decimal(invItem.quantity_on_hand.toString());
      if (onHand.lessThan(consumeQty)) {
        throw new AppError(`Insufficient inventory on hand. Available: ${onHand.toFixed(4)}, Required: ${consumeQty.toFixed(4)}`, 400);
      }

      const newOnHand = onHand.minus(consumeQty);
      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: { quantity_on_hand: newOnHand.toFixed(4) as any },
      });

      // 2. Record inventory transaction
      const unitCost = new Decimal(allocation.unit_cost.toString());
      const totalCost = consumeQty.times(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      await tx.inventoryTransaction.create({
        data: {
          item_id: invItem.id,
          type: 'ISSUE',
          quantity: consumeQty.toFixed(4) as any,
          unit_cost: unitCost.toFixed(2) as any,
          total_cost: totalCost.toFixed(2) as any,
          reference_type: 'WORK_ORDER',
          reference_id: wo.id,
          notes: `Consumed for Work Order ${wo.wo_number}`,
          performed_by: userId,
        },
      });

      // 3. Update allocation
      const updatedAllocation = await tx.workOrderAllocation.update({
        where: { id: input.allocationId },
        data: { consumed_quantity: newConsumed.toFixed(4) as any },
      });

      await AuditService.log({
        userId,
        action: 'MATERIAL_CONSUMED',
        entityType: 'WORK_ORDER',
        entityId: id,
        newValues: { allocationId: input.allocationId, quantity: consumeQty.toString() },
      });

      return updatedAllocation;
    });
  }

  public static async completeWorkOrder(id: string, input: CompleteWorkOrderInput, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUnique({ where: { id } });
      if (!wo) throw new NotFoundError('WorkOrder', id);

      if (wo.status !== 'IN_PROGRESS') {
        throw new AppError(`Cannot complete work order in status ${wo.status}`, 400);
      }

      const completedQty = new Decimal(input.completedQuantity);
      const rejectedQty = new Decimal(input.rejectedQuantity);

      // 1. Automatically increment finished product inventory in destination warehouse
      let invItem = await tx.inventoryItem.findUnique({
        where: {
          product_id_warehouse_id: {
            product_id: wo.product_id,
            warehouse_id: input.warehouseId,
          },
        },
      });

      if (!invItem) {
        invItem = await tx.inventoryItem.create({
          data: {
            product_id: wo.product_id,
            warehouse_id: input.warehouseId,
            quantity_on_hand: 0,
            quantity_reserved: 0,
          },
        });
      }

      const newOnHand = new Decimal(invItem.quantity_on_hand.toString()).plus(completedQty);
      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: { quantity_on_hand: newOnHand.toFixed(4) as any },
      });

      // Record finished goods receipt transaction
      await tx.inventoryTransaction.create({
        data: {
          item_id: invItem.id,
          type: 'RECEIPT',
          quantity: completedQty.toFixed(4) as any,
          unit_cost: '0.00',
          total_cost: '0.00',
          reference_type: 'WORK_ORDER',
          reference_id: wo.id,
          notes: `Finished goods manufactured under Work Order ${wo.wo_number}`,
          performed_by: userId,
        },
      });

      // 2. Mark work order completed
      const updatedWO = await tx.workOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completed_quantity: completedQty.toFixed(4) as any,
          rejected_quantity: rejectedQty.toFixed(4) as any,
          end_date: new Date(),
          notes: input.notes ? (wo.notes ? `${wo.notes}\n${input.notes}` : input.notes) : wo.notes,
        },
        include: { allocations: true },
      });

      await AuditService.log({
        userId,
        action: 'WORK_ORDER_COMPLETED',
        entityType: 'WORK_ORDER',
        entityId: id,
        newValues: {
          status: 'COMPLETED',
          completedQuantity: completedQty.toString(),
          rejectedQuantity: rejectedQty.toString(),
        },
      });

      await AuditService.notify({
        userId: wo.created_by,
        type: 'SYSTEM_ALERT',
        title: `Work Order ${wo.wo_number} Completed`,
        message: `Work Order ${wo.wo_number} completed. Completed: ${completedQty.toString()}, Rejected: ${rejectedQty.toString()}.`,
        link: `/manufacturing/work-orders`,
      });

      return updatedWO;
    });
  }
}
