import { prisma } from '../../config/database.js';
import { NotFoundError, AppError, ConflictError } from '../../utils/errors.js';
import { AuditService } from '../../services/audit.service.js';
import { CreatePurchaseOrderInput, ReceiveGoodsInput } from './purchasing.schema.js';
import { Decimal } from 'decimal.js';
import crypto from 'crypto';

export class PurchasingService {
  private static generatePONumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `PO-${today}-${suffix}`;
  }

  public static async listPurchaseOrders(page = 1, limit = 50, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [total, orders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          supplier: { select: { id: true, supplier_code: true, name: true } },
          creator: { select: { id: true, email: true, first_name: true, last_name: true } },
          lines: {
            include: {
              product: { select: { id: true, part_number: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getPurchaseOrder(id: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        creator: { select: { id: true, email: true, first_name: true, last_name: true } },
        approver: { select: { id: true, email: true, first_name: true, last_name: true } },
        lines: {
          include: {
            product: true,
          },
          orderBy: { line_number: 'asc' },
        },
      },
    });

    if (!po) throw new NotFoundError('PurchaseOrder', id);
    return po;
  }

  public static async createPurchaseOrder(input: CreatePurchaseOrderInput, userId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new NotFoundError('Supplier', input.supplierId);

    if (supplier.status === 'BLOCKED') {
      throw new AppError('Cannot create purchase order for blocked supplier', 400);
    }

    const poNumber = this.generatePONumber();

    return await prisma.$transaction(async (tx) => {
      let totalAmount = new Decimal(0);

      const lineData = input.lines.map((line, idx) => {
        const qty = new Decimal(line.quantityOrdered);
        const price = new Decimal(line.unitPrice);
        const lineTotal = qty.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        totalAmount = totalAmount.plus(lineTotal);

        return {
          line_number: idx + 1,
          product_id: line.productId,
          quantity_ordered: qty.toFixed(4) as any,
          quantity_received: '0.0000',
          unit_price: price.toFixed(2) as any,
          total_price: lineTotal.toFixed(2) as any,
          unit_of_measure: line.unitOfMeasure,
        };
      });

      const po = await tx.purchaseOrder.create({
        data: {
          po_number: poNumber,
          supplier_id: input.supplierId,
          status: 'DRAFT',
          expected_delivery_date: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
          total_amount: totalAmount.toFixed(2) as any,
          notes: input.notes || null,
          created_by: userId,
          lines: {
            create: lineData,
          },
        },
        include: { lines: true },
      });

      await AuditService.log({
        userId,
        action: 'PURCHASE_ORDER_CREATED',
        entityType: 'PURCHASE_ORDER',
        entityId: po.id,
        newValues: { poNumber: po.po_number, totalAmount: po.total_amount },
      });

      return po;
    });
  }

  public static async submitPurchaseOrder(id: string, userId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundError('PurchaseOrder', id);

    if (po.status !== 'DRAFT') {
      throw new AppError(`Cannot submit purchase order in status ${po.status}`, 400);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    await AuditService.log({
      userId,
      action: 'PURCHASE_ORDER_SUBMITTED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
    });

    await AuditService.notify({
      userId: po.created_by,
      type: 'APPROVAL_REQUESTED',
      title: `Purchase Order ${po.po_number} Submitted`,
      message: `Purchase Order ${po.po_number} has been submitted for approval.`,
      link: `/purchasing/orders`,
    });

    return updated;
  }

  public static async approvePurchaseOrder(id: string, userId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundError('PurchaseOrder', id);

    if (po.status !== 'SUBMITTED') {
      throw new AppError(`Cannot approve purchase order in status ${po.status}`, 400);
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'ORDERED',
        approved_by: userId,
      },
    });

    await AuditService.log({
      userId,
      action: 'PURCHASE_ORDER_APPROVED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
    });

    await AuditService.notify({
      userId: po.created_by,
      type: 'SYSTEM_ALERT',
      title: `Purchase Order ${po.po_number} Approved`,
      message: `Purchase Order ${po.po_number} has been approved and moved to ORDERED status.`,
      link: `/purchasing/orders`,
    });

    return updated;
  }

  public static async receiveGoods(id: string, input: ReceiveGoodsInput, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!po) throw new NotFoundError('PurchaseOrder', id);

      if (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED') {
        throw new AppError(`Cannot receive goods for purchase order in status ${po.status}`, 400);
      }

      for (const item of input.lines) {
        const line = po.lines.find((l) => l.id === item.lineId);
        if (!line) throw new NotFoundError('PurchaseOrderLine', item.lineId);

        const currentRec = new Decimal(line.quantity_received.toString());
        const orderQty = new Decimal(line.quantity_ordered.toString());
        const newlyReceived = new Decimal(item.quantityReceived);
        const updatedRec = currentRec.plus(newlyReceived);

        if (updatedRec.greaterThan(orderQty)) {
          throw new AppError(`Received quantity (${updatedRec.toFixed(4)}) exceeds ordered quantity (${orderQty.toFixed(4)}) for line ${line.line_number}`, 400);
        }

        // 1. Update line received quantity
        await tx.purchaseOrderLine.update({
          where: { id: item.lineId },
          data: { quantity_received: updatedRec.toFixed(4) as any },
        });

        // 2. Integration with Inventory: automatically increment stock on hand in target warehouse
        let invItem = await tx.inventoryItem.findUnique({
          where: {
            product_id_warehouse_id: {
              product_id: line.product_id,
              warehouse_id: item.warehouseId,
            },
          },
        });

        if (!invItem) {
          invItem = await tx.inventoryItem.create({
            data: {
              product_id: line.product_id,
              warehouse_id: item.warehouseId,
              quantity_on_hand: 0,
              quantity_reserved: 0,
            },
          });
        }

        const newOnHand = new Decimal(invItem.quantity_on_hand.toString()).plus(newlyReceived);
        const lineUnitCost = new Decimal(line.unit_price.toString());
        const totalReceivedCost = newlyReceived.times(lineUnitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        await tx.inventoryItem.update({
          where: { id: invItem.id },
          data: { quantity_on_hand: newOnHand.toFixed(4) as any },
        });

        // 3. Record InventoryTransaction
        await tx.inventoryTransaction.create({
          data: {
            item_id: invItem.id,
            type: 'RECEIPT',
            quantity: newlyReceived.toFixed(4) as any,
            unit_cost: lineUnitCost.toFixed(2) as any,
            total_cost: totalReceivedCost.toFixed(2) as any,
            reference_type: 'PURCHASE_ORDER',
            reference_id: po.id,
            notes: `Received from PO ${po.po_number}, line ${line.line_number}`,
            performed_by: userId,
          },
        });
      }

      // Check overall PO status: all lines completed?
      const refreshedLines = await tx.purchaseOrderLine.findMany({ where: { po_id: id } });
      const allDone = refreshedLines.every((l) => new Decimal(l.quantity_received.toString()).greaterThanOrEqualTo(new Decimal(l.quantity_ordered.toString())));

      const nextStatus = allDone ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: { status: nextStatus },
        include: { lines: true },
      });

      await AuditService.log({
        userId,
        action: 'GOODS_RECEIVED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        newValues: { status: nextStatus, receivedItemsCount: input.lines.length },
      });

      await AuditService.notify({
        userId: po.created_by,
        type: 'SYSTEM_ALERT',
        title: `Goods Received: ${po.po_number}`,
        message: `Goods received for PO ${po.po_number}. New status: ${nextStatus}.`,
        link: `/purchasing/orders`,
      });

      return updatedPO;
    });
  }
}
