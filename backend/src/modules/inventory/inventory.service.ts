import { prisma } from '../../config/database.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { AuditService } from '../../services/audit.service.js';
import { CreateWarehouseInput, UpdateWarehouseInput, TransactStockInput, SetThresholdInput } from './inventory.schema.js';
import { Decimal } from 'decimal.js';

export class InventoryService {
  public static async listWarehouses() {
    return await prisma.warehouse.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { inventory_items: true } },
      },
    });
  }

  public static async createWarehouse(input: CreateWarehouseInput) {
    return await prisma.warehouse.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        location: input.location || null,
        status: input.status,
      },
    });
  }

  public static async listItems(warehouseId?: string, search?: string, lowStockOnly = false) {
    const where: any = {};
    if (warehouseId) where.warehouse_id = warehouseId;
    if (search) {
      where.product = {
        OR: [
          { part_number: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        product: { select: { id: true, part_number: true, name: true, status: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { product: { part_number: 'asc' } },
    });

    if (lowStockOnly) {
      return items.filter((item) => new Decimal(item.quantity_on_hand.toString()).lessThanOrEqualTo(new Decimal(item.min_threshold.toString())));
    }

    return items;
  }

  public static async getItem(id: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        product: true,
        warehouse: true,
        transactions: {
          orderBy: { created_at: 'desc' },
          take: 20,
          include: {
            performer: { select: { id: true, email: true, first_name: true, last_name: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundError('InventoryItem', id);
    return item;
  }

  public static async setThresholds(id: string, input: SetThresholdInput, userId: string) {
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('InventoryItem', id);

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(input.minThreshold !== undefined && { min_threshold: input.minThreshold }),
        ...(input.maxThreshold !== undefined && { max_threshold: input.maxThreshold }),
      },
    });

    await AuditService.log({
      userId,
      action: 'INVENTORY_THRESHOLD_UPDATED',
      entityType: 'INVENTORY_ITEM',
      entityId: id,
      newValues: { minThreshold: input.minThreshold, maxThreshold: input.maxThreshold },
    });

    return updated;
  }

  public static async transactStock(input: TransactStockInput, userId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Find or create the InventoryItem row
      let item = await tx.inventoryItem.findUnique({
        where: {
          product_id_warehouse_id: {
            product_id: input.productId,
            warehouse_id: input.warehouseId,
          },
        },
      });

      if (!item) {
        // Automatically provision inventory item record for product in warehouse
        item = await tx.inventoryItem.create({
          data: {
            product_id: input.productId,
            warehouse_id: input.warehouseId,
            quantity_on_hand: 0,
            quantity_reserved: 0,
          },
        });
      }

      const currentOnHand = new Decimal(item.quantity_on_hand.toString());
      const currentReserved = new Decimal(item.quantity_reserved.toString());
      const qty = new Decimal(input.quantity);
      const unitCost = new Decimal(input.unitCost);
      const totalCost = qty.times(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      let newOnHand = currentOnHand;
      let newReserved = currentReserved;

      switch (input.type) {
        case 'RECEIPT':
          newOnHand = currentOnHand.plus(qty);
          break;

        case 'ISSUE':
        case 'SCRAP':
          if (currentOnHand.lessThan(qty)) {
            throw new AppError(`Insufficient stock on hand. Available: ${currentOnHand.toFixed(4)}, Requested: ${qty.toFixed(4)}`, 400);
          }
          newOnHand = currentOnHand.minus(qty);
          break;

        case 'RESERVATION':
          const available = currentOnHand.minus(currentReserved);
          if (available.lessThan(qty)) {
            throw new AppError(`Insufficient unreserved stock. Available: ${available.toFixed(4)}, Requested: ${qty.toFixed(4)}`, 400);
          }
          newReserved = currentReserved.plus(qty);
          break;

        case 'ADJUSTMENT':
          newOnHand = qty; // direct adjustment to new absolute level
          break;

        case 'TRANSFER':
          if (currentOnHand.lessThan(qty)) {
            throw new AppError(`Insufficient stock for transfer. Available: ${currentOnHand.toFixed(4)}`, 400);
          }
          newOnHand = currentOnHand.minus(qty);
          break;
      }

      // Update inventory item
      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity_on_hand: newOnHand.toFixed(4) as any,
          quantity_reserved: newReserved.toFixed(4) as any,
        },
      });

      // Record transaction
      const transaction = await tx.inventoryTransaction.create({
        data: {
          item_id: item.id,
          type: input.type,
          quantity: qty.toFixed(4) as any,
          unit_cost: unitCost.toFixed(2) as any,
          total_cost: totalCost.toFixed(2) as any,
          reference_type: input.referenceType || null,
          reference_id: input.referenceId || null,
          notes: input.notes || null,
          performed_by: userId,
        },
      });

      await AuditService.log({
        userId,
        action: 'INVENTORY_STOCK_TRANSACTED',
        entityType: 'INVENTORY_ITEM',
        entityId: item.id,
        newValues: {
          type: input.type,
          quantity: qty.toString(),
          newOnHand: newOnHand.toString(),
          referenceType: input.referenceType,
        },
      });

      return {
        item: updatedItem,
        transaction,
      };
    });
  }

  public static async listTransactions(itemId?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = itemId ? { item_id: itemId } : {};

    const [total, transactions] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          item: {
            include: {
              product: { select: { id: true, part_number: true, name: true } },
              warehouse: { select: { id: true, code: true, name: true } },
            },
          },
          performer: { select: { id: true, email: true, first_name: true, last_name: true } },
        },
      }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
