import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { AuditService } from '../../services/audit.service.js';
import { Prisma, SupplierStatus, SupplierQuotationStatus } from '@prisma/client';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
  AddSupplierProductInput,
  BulkMapProductsInput,
  UpdateSupplierProductInput,
  ImportPreviewInput,
  ImportCommitInput,
  CreateRFQInput,
  CreateQuotationInput,
  NegotiateQuotationInput,
} from './supplier.schema.js';
import crypto from 'crypto';

export class SupplierService {
  private static generateSupplierCode(): string {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `SUP-${suffix}`;
  }

  // ==========================================
  // PHASE 1 — DASHBOARD STATS & GLOBAL SEARCH
  // ==========================================

  public static async getDashboardStats() {
    const [
      totalSuppliers,
      activeSuppliers,
      inactiveSuppliers,
      totalMappedProducts,
    ] = await Promise.all([
      prisma.supplier.count(),
      prisma.supplier.count({ where: { status: 'ACTIVE' } }),
      prisma.supplier.count({ where: { status: { in: ['INACTIVE', 'BLOCKED'] } } }),
      prisma.supplierProduct.count(),
    ]);

    const [
      totalPOs,
      completedPOs,
      poSuppliers,
    ] = await Promise.all([
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: 'RECEIVED' } }),
      prisma.purchaseOrder.groupBy({
        by: ['supplier_id'],
        _count: { id: true },
      }),
    ]);

    const [
      pendingRFQs,
      pendingQuotations,
      activeNegotiations,
    ] = await Promise.all([
      prisma.rFQ.count({ where: { status: 'OPEN' } }),
      prisma.supplierQuotation.count({ where: { status: { in: ['REQUESTED', 'QUOTED'] } } }),
      prisma.supplierQuotation.count({ where: { status: { in: ['COUNTER_OFFERED', 'REVISED'] } } }),
    ]);

    const repeatSuppliers = poSuppliers.filter((s) => s._count.id > 1).length;

    return {
      totalSuppliers,
      activeSuppliers,
      inactiveSuppliers,
      totalMappedProducts,
      totalPurchaseOrders: totalPOs,
      completedPurchaseOrders: completedPOs,
      repeatSuppliers,
      pendingRFQs,
      pendingQuotations,
      activeNegotiations,
    };
  }

  public static async listSuppliers(page = 1, limit = 50, search?: string, categoryId?: string, status?: string) {
    const skip = (page - 1) * limit;

    const andConditions: Prisma.SupplierWhereInput[] = [];

    if (status && status !== 'ALL') {
      andConditions.push({ status: status as SupplierStatus });
    }

    if (categoryId && categoryId !== 'ALL') {
      andConditions.push({
        products: {
          some: {
            product: {
              category_id: categoryId,
            },
          },
        },
      });
    }

    if (search && search.trim()) {
      const q = search.trim();
      andConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { supplier_code: { contains: q, mode: 'insensitive' as const } },
          { contact_name: { contains: q, mode: 'insensitive' as const } },
          {
            products: {
              some: {
                OR: [
                  { supplier_part_number: { contains: q, mode: 'insensitive' as const } },
                  {
                    product: {
                      OR: [
                        { name: { contains: q, mode: 'insensitive' as const } },
                        { part_number: { contains: q, mode: 'insensitive' as const } },
                        { description: { contains: q, mode: 'insensitive' as const } },
                        { category: { name: { contains: q, mode: 'insensitive' as const } } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          products: {
            include: {
              product: {
                include: {
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          purchase_orders: {
            select: { id: true, status: true, total_amount: true, created_at: true },
          },
          quotations: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { unit_price: true, currency: true, created_at: true },
          },
        },
      }),
    ]);

    // Enhance suppliers with real metrics
    const enhancedSuppliers = suppliers.map((sup) => {
      const totalPoCount = sup.purchase_orders.length;
      const completedPoCount = sup.purchase_orders.filter((po) => po.status === 'RECEIVED').length;
      const latestQuotation = sup.quotations[0] || null;

      // Average lead time across mapped products
      const leadTimes = sup.products.map((p) => p.lead_time_days).filter((d): d is number => d != null && d > 0);
      const avgLeadTime = leadTimes.length > 0 ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : null;

      return {
        id: sup.id,
        supplier_code: sup.supplier_code,
        name: sup.name,
        contact_name: sup.contact_name,
        email: sup.email,
        phone: sup.phone,
        address: sup.address,
        status: sup.status,
        rating: sup.rating,
        created_at: sup.created_at,
        mappedProductCount: sup.products.length,
        mappedProducts: sup.products.map((sp) => ({
          id: sp.id,
          productId: sp.product_id,
          productName: sp.product.name,
          partNumber: sp.product.part_number,
          categoryName: sp.product.category?.name || 'Uncategorized',
          supplierPartNumber: sp.supplier_part_number,
          unitPrice: Number(sp.unit_price),
          currency: sp.currency,
          leadTimeDays: sp.lead_time_days,
          minimumOrderQty: Number(sp.minimum_order_qty),
          isPreferred: sp.is_preferred,
          status: sp.status,
        })),
        historicalPurchaseOrderCount: totalPoCount,
        completedPurchaseOrderCount: completedPoCount,
        repeatPurchaseCount: totalPoCount > 1 ? totalPoCount - 1 : 0,
        latestQuotedPrice: latestQuotation ? { price: Number(latestQuotation.unit_price), currency: latestQuotation.currency } : null,
        avgLeadTimeDays: avgLeadTime,
      };
    });

    return {
      suppliers: enhancedSuppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getSupplier(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              include: { category: true },
            },
          },
          orderBy: { created_at: 'desc' },
        },
        purchase_orders: {
          include: {
            lines: {
              include: { product: true },
            },
          },
          orderBy: { created_at: 'desc' },
        },
        quotations: {
          include: {
            product: true,
            rfq: true,
            negotiation_events: {
              include: { actor: { select: { id: true, first_name: true, last_name: true, email: true } } },
              orderBy: { created_at: 'asc' },
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!supplier) throw new NotFoundError('Supplier', id);
    return supplier;
  }

  public static async createSupplier(input: CreateSupplierInput, userId: string) {
    const supplierCode = this.generateSupplierCode();

    const supplier = await prisma.supplier.create({
      data: {
        supplier_code: supplierCode,
        name: input.name,
        contact_name: input.contactName || null,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        rating: input.rating,
        created_by: userId,
      },
    });

    await AuditService.log({
      userId,
      action: 'SUPPLIER_CREATED',
      entityType: 'SUPPLIER',
      entityId: supplier.id,
      newValues: { supplierCode: supplier.supplier_code, name: supplier.name },
    });

    return supplier;
  }

  public static async updateSupplier(id: string, input: UpdateSupplierInput, userId: string) {
    const oldSupplier = await prisma.supplier.findUnique({ where: { id } });
    if (!oldSupplier) throw new NotFoundError('Supplier', id);

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.contactName !== undefined && { contact_name: input.contactName }),
        ...(input.email !== undefined && { email: input.email || null }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
        ...(input.address !== undefined && { address: input.address || null }),
        ...(input.rating !== undefined && { rating: input.rating }),
      },
    });

    await AuditService.log({
      userId,
      action: 'SUPPLIER_UPDATED',
      entityType: 'SUPPLIER',
      entityId: id,
      oldValues: { status: oldSupplier.status, name: oldSupplier.name },
      newValues: { status: updated.status, name: updated.name },
    });

    return updated;
  }

  // ==========================================
  // PHASE 2 — PRODUCT MAPPING (BULK & SINGLE)
  // ==========================================

  public static async addSupplierProduct(supplierId: string, input: AddSupplierProductInput, userId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundError('Supplier', supplierId);

    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundError('Product', input.productId);

    const existing = await prisma.supplierProduct.findUnique({
      where: {
        supplier_id_product_id: {
          supplier_id: supplierId,
          product_id: input.productId,
        },
      },
    });

    if (existing) {
      throw new ConflictError('Product already cataloged with this supplier');
    }

    // If marked preferred, unset other preferred suppliers for this product
    if (input.isPreferred) {
      await prisma.supplierProduct.updateMany({
        where: { product_id: input.productId, is_preferred: true },
        data: { is_preferred: false },
      });
    }

    const supplierProduct = await prisma.supplierProduct.create({
      data: {
        supplier_id: supplierId,
        product_id: input.productId,
        supplier_part_number: input.supplierPartNumber || null,
        lead_time_days: input.leadTimeDays,
        unit_price: input.unitPrice,
        minimum_order_qty: input.minimumOrderQty,
        currency: input.currency || 'INR',
        is_preferred: input.isPreferred,
        status: input.status || 'ACTIVE',
        valid_until: input.validUntil ? new Date(input.validUntil) : null,
      },
      include: { product: true },
    });

    await AuditService.log({
      userId,
      action: 'SUPPLIER_PRODUCT_ADDED',
      entityType: 'SUPPLIER_PRODUCT',
      entityId: supplierProduct.id,
      newValues: {
        supplierId,
        productId: input.productId,
        partNumber: input.supplierPartNumber,
        unitPrice: input.unitPrice,
      },
    });

    return supplierProduct;
  }

  public static async bulkMapProducts(supplierId: string, input: BulkMapProductsInput, userId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundError('Supplier', supplierId);

    const results = await prisma.$transaction(async (tx) => {
      const createdMappings = [];

      for (const mapping of input.mappings) {
        const product = await tx.product.findUnique({ where: { id: mapping.productId } });
        if (!product) throw new NotFoundError('Product', mapping.productId);

        const existing = await tx.supplierProduct.findUnique({
          where: {
            supplier_id_product_id: {
              supplier_id: supplierId,
              product_id: mapping.productId,
            },
          },
        });

        if (existing) {
          throw new ConflictError(`Product ${product.part_number} (${product.name}) is already mapped to this supplier`);
        }

        if (mapping.isPreferred) {
          await tx.supplierProduct.updateMany({
            where: { product_id: mapping.productId, is_preferred: true },
            data: { is_preferred: false },
          });
        }

        const sp = await tx.supplierProduct.create({
          data: {
            supplier_id: supplierId,
            product_id: mapping.productId,
            supplier_part_number: mapping.supplierPartNumber || null,
            lead_time_days: mapping.leadTimeDays ?? 7,
            unit_price: mapping.unitPrice,
            minimum_order_qty: mapping.minimumOrderQty ?? 1,
            currency: mapping.currency || 'INR',
            is_preferred: mapping.isPreferred ?? false,
            status: mapping.status || 'ACTIVE',
            valid_until: mapping.validUntil ? new Date(mapping.validUntil) : null,
          },
          include: { product: true },
        });

        createdMappings.push(sp);
      }

      return createdMappings;
    });

    await AuditService.log({
      userId,
      action: 'SUPPLIER_PRODUCTS_BULK_MAPPED',
      entityType: 'SUPPLIER',
      entityId: supplierId,
      newValues: { mappedCount: results.length },
    });

    return results;
  }

  public static async updateSupplierProduct(
    supplierId: string,
    productId: string,
    input: UpdateSupplierProductInput,
    userId: string
  ) {
    const existing = await prisma.supplierProduct.findUnique({
      where: {
        supplier_id_product_id: {
          supplier_id: supplierId,
          product_id: productId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('SupplierProduct', `${supplierId}/${productId}`);
    }

    if (input.isPreferred) {
      await prisma.supplierProduct.updateMany({
        where: { product_id: productId, is_preferred: true, supplier_id: { not: supplierId } },
        data: { is_preferred: false },
      });
    }

    const updated = await prisma.supplierProduct.update({
      where: {
        supplier_id_product_id: {
          supplier_id: supplierId,
          product_id: productId,
        },
      },
      data: {
        ...(input.supplierPartNumber !== undefined && { supplier_part_number: input.supplierPartNumber }),
        ...(input.leadTimeDays !== undefined && { lead_time_days: input.leadTimeDays }),
        ...(input.unitPrice !== undefined && { unit_price: input.unitPrice }),
        ...(input.minimumOrderQty !== undefined && { minimum_order_qty: input.minimumOrderQty }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.isPreferred !== undefined && { is_preferred: input.isPreferred }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.validUntil !== undefined && { valid_until: input.validUntil ? new Date(input.validUntil) : null }),
      },
      include: { product: true },
    });

    await AuditService.log({
      userId,
      action: 'SUPPLIER_PRODUCT_UPDATED',
      entityType: 'SUPPLIER_PRODUCT',
      entityId: existing.id,
      newValues: input,
    });

    return updated;
  }

  public static async removeSupplierProduct(supplierId: string, productId: string, userId: string) {
    const existing = await prisma.supplierProduct.findUnique({
      where: {
        supplier_id_product_id: {
          supplier_id: supplierId,
          product_id: productId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('SupplierProduct', `${supplierId}/${productId}`);
    }

    await prisma.supplierProduct.delete({
      where: {
        supplier_id_product_id: {
          supplier_id: supplierId,
          product_id: productId,
        },
      },
    });

    await AuditService.log({
      userId,
      action: 'SUPPLIER_PRODUCT_REMOVED',
      entityType: 'SUPPLIER_PRODUCT',
      entityId: existing.id,
      oldValues: {
        supplierId,
        productId,
        supplierPartNumber: existing.supplier_part_number,
      },
    });

    return { success: true };
  }

  public static async getProductSuppliersComparison(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });

    if (!product) throw new NotFoundError('Product', productId);

    const suppliers = await prisma.supplierProduct.findMany({
      where: { product_id: productId },
      include: {
        supplier: {
          include: {
            purchase_orders: {
              where: {
                lines: {
                  some: { product_id: productId },
                },
              },
              select: { id: true, status: true, created_at: true },
            },
          },
        },
      },
      orderBy: { unit_price: 'asc' },
    });

    return {
      product: {
        id: product.id,
        part_number: product.part_number,
        name: product.name,
        category: product.category?.name || 'Uncategorized',
      },
      suppliers: suppliers.map((sp) => {
        const poCount = sp.supplier.purchase_orders.length;
        const completedPoCount = sp.supplier.purchase_orders.filter((po) => po.status === 'RECEIVED').length;

        return {
          supplierId: sp.supplier_id,
          supplierCode: sp.supplier.supplier_code,
          supplierName: sp.supplier.name,
          supplierStatus: sp.supplier.status,
          supplierRating: sp.supplier.rating ? Number(sp.supplier.rating) : null,
          supplierPartNumber: sp.supplier_part_number,
          unitPrice: Number(sp.unit_price),
          currency: sp.currency,
          leadTimeDays: sp.lead_time_days,
          minimumOrderQty: Number(sp.minimum_order_qty),
          isPreferred: sp.is_preferred,
          status: sp.status,
          validUntil: sp.valid_until,
          purchaseOrderCount: poCount,
          completedPurchaseOrderCount: completedPoCount,
        };
      }),
    };
  }

  // ==========================================
  // PHASE 3 — IMPORT & EXPORT
  // ==========================================

  public static async previewImport(supplierId: string, input: ImportPreviewInput) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundError('Supplier', supplierId);

    // Fetch existing catalogue products for matching
    const products = await prisma.product.findMany({
      select: { id: true, part_number: true, name: true },
    });
    const productMap = new Map<string, { id: string; name: string }>();
    for (const p of products) {
      productMap.set(p.part_number.trim().toUpperCase(), { id: p.id, name: p.name });
    }

    // Fetch existing mappings for this supplier to detect duplicates
    const existingMappings = await prisma.supplierProduct.findMany({
      where: { supplier_id: supplierId },
      select: { product_id: true },
    });
    const existingProductIds = new Set(existingMappings.map((m) => m.product_id));

    const mapping = input.columnMapping || {};
    const colSku = mapping.product_sku || 'product_sku';
    const colName = mapping.product_name || 'product_name';
    const colPartNo = mapping.supplier_part_number || 'supplier_part_number';
    const colPrice = mapping.unit_price || 'unit_price';
    const colCurrency = mapping.currency || 'currency';
    const colLeadTime = mapping.lead_time_days || 'lead_time_days';
    const colMoq = mapping.minimum_order_quantity || 'minimum_order_quantity';
    const colPref = mapping.preferred_supplier || 'preferred_supplier';

    const seenSkusInFile = new Set<string>();
    const previewRows = [];
    let validCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (let i = 0; i < input.rows.length; i++) {
      const raw = input.rows[i];
      const rowIdx = i + 1;
      const errors: string[] = [];
      const warnings: string[] = [];

      const rawSku = String(raw[colSku] ?? '').trim();
      const rawPrice = raw[colPrice];
      const rawCurrency = String(raw[colCurrency] ?? 'INR').trim().toUpperCase();
      const rawLeadTime = raw[colLeadTime];
      const rawMoq = raw[colMoq];
      const rawPref = raw[colPref];
      const rawSupplierPartNo = raw[colPartNo] ? String(raw[colPartNo]).trim() : null;

      if (!rawSku) {
        errors.push('Missing product SKU/part_number');
      }

      // Check formula injection
      if (rawSku && /^[-+=@]/.test(rawSku)) {
        errors.push('Invalid SKU character: possible formula injection blocked');
      }

      const matchedProduct = rawSku ? productMap.get(rawSku.toUpperCase()) : null;
      if (rawSku && !matchedProduct) {
        errors.push(`Catalogue SKU "${rawSku}" does not exist in product master`);
      }

      if (rawSku) {
        const upperSku = rawSku.toUpperCase();
        if (seenSkusInFile.has(upperSku)) {
          errors.push(`Duplicate SKU "${rawSku}" found multiple times in import file`);
        } else {
          seenSkusInFile.add(upperSku);
        }
      }

      if (matchedProduct && existingProductIds.has(matchedProduct.id)) {
        errors.push(`SKU "${rawSku}" is already mapped to this supplier. Overwriting is not permitted silently.`);
      }

      const numPrice = Number(rawPrice);
      if (rawPrice === undefined || rawPrice === null || rawPrice === '' || isNaN(numPrice) || numPrice < 0) {
        errors.push('Unit price must be a valid non-negative number');
      }

      const numLeadTime = rawLeadTime !== undefined && rawLeadTime !== null && rawLeadTime !== '' ? Number(rawLeadTime) : 7;
      if (isNaN(numLeadTime) || numLeadTime < 0) {
        warnings.push('Invalid lead time; default of 7 days will be used');
      }

      const numMoq = rawMoq !== undefined && rawMoq !== null && rawMoq !== '' ? Number(rawMoq) : 1;
      if (isNaN(numMoq) || numMoq <= 0) {
        warnings.push('Invalid MOQ; default of 1 will be used');
      }

      const isPreferred =
        String(rawPref).toLowerCase() === 'true' ||
        String(rawPref).toLowerCase() === 'yes' ||
        String(rawPref) === '1';

      if (errors.length > 0) {
        errorCount++;
      } else {
        validCount++;
        if (warnings.length > 0) warningCount++;
      }

      previewRows.push({
        rowNumber: rowIdx,
        sku: rawSku,
        productName: matchedProduct ? matchedProduct.name : raw[colName] || 'Unknown',
        productId: matchedProduct ? matchedProduct.id : null,
        supplierPartNumber: rawSupplierPartNo,
        unitPrice: isNaN(numPrice) ? 0 : numPrice,
        currency: rawCurrency || 'INR',
        leadTimeDays: isNaN(numLeadTime) ? 7 : Math.round(numLeadTime),
        minimumOrderQty: isNaN(numMoq) ? 1 : numMoq,
        isPreferred,
        isValid: errors.length === 0,
        errors,
        warnings,
      });
    }

    return {
      supplier: { id: supplier.id, name: supplier.name, code: supplier.supplier_code },
      totalRows: input.rows.length,
      validCount,
      errorCount,
      warningCount,
      rows: previewRows,
    };
  }

  public static async commitImport(supplierId: string, input: ImportCommitInput, userId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundError('Supplier', supplierId);

    const created = await prisma.$transaction(async (tx) => {
      const records = [];

      for (const row of input.rows) {
        // Enforce safe unicity inside transaction
        const existing = await tx.supplierProduct.findUnique({
          where: {
            supplier_id_product_id: {
              supplier_id: supplierId,
              product_id: row.productId,
            },
          },
        });

        if (existing) {
          throw new ConflictError(`Product ${row.productId} is already mapped`);
        }

        if (row.isPreferred) {
          await tx.supplierProduct.updateMany({
            where: { product_id: row.productId, is_preferred: true },
            data: { is_preferred: false },
          });
        }

        const sp = await tx.supplierProduct.create({
          data: {
            supplier_id: supplierId,
            product_id: row.productId,
            supplier_part_number: row.supplierPartNumber || null,
            lead_time_days: row.leadTimeDays,
            unit_price: row.unitPrice,
            minimum_order_qty: row.minimumOrderQty,
            currency: row.currency || 'INR',
            is_preferred: row.isPreferred,
            status: 'ACTIVE',
          },
        });

        records.push(sp);
      }

      return records;
    });

    await AuditService.log({
      userId,
      action: 'SUPPLIER_CATALOGUE_IMPORTED',
      entityType: 'SUPPLIER',
      entityId: supplierId,
      newValues: { importedRows: created.length },
    });

    return {
      success: true,
      importedCount: created.length,
    };
  }

  public static async exportData(type: string, filters: { supplierId?: string; categoryId?: string; search?: string }) {
    if (type === 'suppliers') {
      const suppliers = await prisma.supplier.findMany({
        where: {
          ...(filters.supplierId && { id: filters.supplierId }),
        },
        include: {
          products: {
            include: { product: true },
          },
          purchase_orders: true,
        },
        orderBy: { name: 'asc' },
      });

      return suppliers.map((s) => ({
        SupplierCode: s.supplier_code,
        SupplierName: s.name,
        ContactName: s.contact_name || '',
        Email: s.email || '',
        Phone: s.phone || '',
        Address: s.address || '',
        Status: s.status,
        Rating: s.rating ? Number(s.rating) : 5,
        MappedProducts: s.products.length,
        TotalPurchaseOrders: s.purchase_orders.length,
        CreatedAt: s.created_at.toISOString(),
      }));
    }

    if (type === 'mappings') {
      const mappings = await prisma.supplierProduct.findMany({
        where: {
          ...(filters.supplierId && { supplier_id: filters.supplierId }),
        },
        include: {
          supplier: true,
          product: { include: { category: true } },
        },
        orderBy: [{ supplier: { name: 'asc' } }, { product: { part_number: 'asc' } }],
      });

      return mappings.map((m) => ({
        SupplierCode: m.supplier.supplier_code,
        SupplierName: m.supplier.name,
        ProductSKU: m.product.part_number,
        ProductName: m.product.name,
        Category: m.product.category?.name || 'Uncategorized',
        SupplierPartNumber: m.supplier_part_number || '',
        UnitPrice: Number(m.unit_price),
        Currency: m.currency,
        LeadTimeDays: m.lead_time_days ?? 7,
        MinimumOrderQty: Number(m.minimum_order_qty),
        IsPreferred: m.is_preferred ? 'YES' : 'NO',
        Status: m.status,
      }));
    }

    if (type === 'price_comparison') {
      const mappings = await prisma.supplierProduct.findMany({
        include: {
          supplier: true,
          product: { include: { category: true } },
        },
        orderBy: [{ product: { part_number: 'asc' } }, { unit_price: 'asc' }],
      });

      return mappings.map((m) => ({
        ProductSKU: m.product.part_number,
        ProductName: m.product.name,
        Category: m.product.category?.name || 'Uncategorized',
        SupplierName: m.supplier.name,
        SupplierCode: m.supplier.supplier_code,
        SupplierPartNumber: m.supplier_part_number || '',
        UnitPrice: Number(m.unit_price),
        Currency: m.currency,
        LeadTimeDays: m.lead_time_days ?? 7,
        MOQ: Number(m.minimum_order_qty),
        IsPreferred: m.is_preferred ? 'YES' : 'NO',
      }));
    }

    if (type === 'purchase_orders') {
      const pos = await prisma.purchaseOrder.findMany({
        where: {
          ...(filters.supplierId && { supplier_id: filters.supplierId }),
        },
        include: {
          supplier: true,
          lines: { include: { product: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      return pos.flatMap((po) =>
        po.lines.map((l) => ({
          PONumber: po.po_number,
          SupplierName: po.supplier.name,
          Status: po.status,
          OrderDate: po.order_date.toISOString(),
          ProductSKU: l.product.part_number,
          ProductName: l.product.name,
          QuantityOrdered: Number(l.quantity_ordered),
          QuantityReceived: Number(l.quantity_received),
          UnitPrice: Number(l.unit_price),
          TotalPrice: Number(l.total_price),
          TotalPOAmount: Number(po.total_amount),
        }))
      );
    }

    throw new ValidationError(`Unsupported export type: ${type}`);
  }

  // ==========================================
  // PHASE 4 — RFQ, QUOTATION & BARGAINING
  // ==========================================

  public static async createRFQ(input: CreateRFQInput, userId: string) {
    const rfqNumber = `RFQ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const rfq = await prisma.$transaction(async (tx) => {
      const created = await tx.rFQ.create({
        data: {
          rfq_number: rfqNumber,
          title: input.title,
          status: 'OPEN',
          submission_date: input.submissionDate ? new Date(input.submissionDate) : new Date(),
          deadline_date: input.deadlineDate ? new Date(input.deadlineDate) : null,
          delivery_date: input.deliveryDate ? new Date(input.deliveryDate) : null,
          notes: input.notes || null,
          created_by: userId,
          items: {
            create: input.items.map((item) => ({
              product_id: item.productId,
              quantity_required: item.quantityRequired,
              notes: item.notes || null,
            })),
          },
          suppliers: {
            create: input.supplierIds.map((sId) => ({
              supplier_id: sId,
              status: 'INVITED',
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          suppliers: { include: { supplier: true } },
        },
      });

      return created;
    });

    await AuditService.log({
      userId,
      action: 'RFQ_CREATED',
      entityType: 'RFQ',
      entityId: rfq.id,
      newValues: { rfqNumber, title: rfq.title },
    });

    return rfq;
  }

  public static async listRFQs() {
    return prisma.rFQ.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        items: { include: { product: true } },
        suppliers: { include: { supplier: true } },
        quotations: {
          include: {
            supplier: true,
            product: true,
            negotiation_events: { orderBy: { created_at: 'asc' } },
          },
        },
      },
    });
  }

  public static async createQuotation(input: CreateQuotationInput, userId: string) {
    const quotationNumber = `QUO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const totalAmount = input.unitPrice * input.offeredQuantity + input.taxAmount + input.shippingAmount;

    const quote = await prisma.supplierQuotation.create({
      data: {
        quotation_number: quotationNumber,
        rfq_id: input.rfqId || null,
        supplier_id: input.supplierId,
        product_id: input.productId,
        supplier_part_number: input.supplierPartNumber || null,
        offered_quantity: input.offeredQuantity,
        unit_price: input.unitPrice,
        currency: input.currency || 'INR',
        tax_amount: input.taxAmount,
        shipping_amount: input.shippingAmount,
        total_amount: totalAmount,
        lead_time_days: input.leadTimeDays,
        minimum_order_quantity: input.minimumOrderQuantity,
        valid_until: input.validUntil ? new Date(input.validUntil) : null,
        terms_conditions: input.termsConditions || null,
        status: input.status,
        created_by: userId,
      },
      include: {
        supplier: true,
        product: true,
        rfq: true,
      },
    });

    // If RFQ supplier responded, mark supplier status as RESPONDED
    if (input.rfqId) {
      await prisma.rFQSupplier.updateMany({
        where: { rfq_id: input.rfqId, supplier_id: input.supplierId },
        data: { status: 'RESPONDED' },
      });
    }

    await AuditService.log({
      userId,
      action: 'SUPPLIER_QUOTATION_RECORDED',
      entityType: 'SUPPLIER_QUOTATION',
      entityId: quote.id,
      newValues: { quotationNumber, unitPrice: quote.unit_price, totalAmount },
    });

    return quote;
  }

  public static async negotiateQuotation(quotationId: string, input: NegotiateQuotationInput, userId: string) {
    const quote = await prisma.supplierQuotation.findUnique({
      where: { id: quotationId },
    });

    if (!quote) throw new NotFoundError('SupplierQuotation', quotationId);

    // Terminal status checks
    if (quote.status === 'ACCEPTED' || quote.status === 'REJECTED' || quote.status === 'EXPIRED') {
      throw new ValidationError(`Cannot negotiate a quotation that is already in terminal state: ${quote.status}`);
    }

    if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
      // Mark as EXPIRED
      await prisma.supplierQuotation.update({
        where: { id: quotationId },
        data: { status: 'EXPIRED' },
      });
      throw new ValidationError('Quotation validity has expired; further negotiation is not permitted');
    }

    let nextStatus: SupplierQuotationStatus = quote.status;
    if (input.eventType === 'COUNTER_OFFER') nextStatus = 'COUNTER_OFFERED';
    else if (input.eventType === 'REVISED_OFFER') nextStatus = 'REVISED';
    else if (input.eventType === 'ACCEPTED') nextStatus = 'ACCEPTED';
    else if (input.eventType === 'REJECTED') nextStatus = 'REJECTED';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create immutable negotiation event
      const event = await tx.quotationNegotiationEvent.create({
        data: {
          quotation_id: quotationId,
          event_type: input.eventType,
          actor_id: userId,
          offered_price: quote.unit_price,
          counter_price: input.counterPrice,
          currency: input.currency || quote.currency,
          message: input.message,
          previous_status: quote.status,
          new_status: nextStatus,
        },
        include: {
          actor: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      });

      // 2. Update quotation current status and negotiated price if revised or accepted
      const updatedQuote = await tx.supplierQuotation.update({
        where: { id: quotationId },
        data: {
          status: nextStatus,
          ...(input.eventType === 'REVISED_OFFER' && {
            unit_price: input.counterPrice,
            total_amount: Number(input.counterPrice) * Number(quote.offered_quantity) + Number(quote.tax_amount) + Number(quote.shipping_amount),
          }),
        },
        include: {
          supplier: true,
          product: true,
          negotiation_events: {
            include: { actor: { select: { id: true, first_name: true, last_name: true, email: true } } },
            orderBy: { created_at: 'asc' },
          },
        },
      });

      return { event, quotation: updatedQuote };
    });

    await AuditService.log({
      userId,
      action: `QUOTATION_${input.eventType}`,
      entityType: 'SUPPLIER_QUOTATION',
      entityId: quotationId,
      newValues: {
        eventType: input.eventType,
        previousStatus: quote.status,
        newStatus: nextStatus,
        counterPrice: input.counterPrice,
        message: input.message,
      },
    });

    return result;
  }

  public static async convertQuotationToPO(quotationId: string, userId: string) {
    const poNumber = `PO-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const po = await prisma.$transaction(async (tx) => {
      // Row lock using SELECT ... FOR UPDATE on quotation to eliminate race conditions
      const lockedQuote = await tx.$queryRaw<
        Array<{
          id: string;
          status: SupplierQuotationStatus;
          converted_po_id: string | null;
          supplier_id: string;
          product_id: string;
          unit_price: number;
          offered_quantity: number;
          tax_amount: number;
          shipping_amount: number;
          total_amount: number;
          lead_time_days: number | null;
          quotation_number: string;
          valid_until: Date | null;
          currency: string;
        }>
      >`SELECT id, status, converted_po_id, supplier_id, product_id, unit_price, offered_quantity, tax_amount, shipping_amount, total_amount, lead_time_days, quotation_number, valid_until, currency FROM supplier_quotations WHERE id = ${quotationId}::uuid FOR UPDATE`;

      if (!lockedQuote || lockedQuote.length === 0) {
        throw new NotFoundError('SupplierQuotation', quotationId);
      }

      const quote = lockedQuote[0];

      if (quote.converted_po_id) {
        throw new ConflictError('This quotation has already been converted into a Purchase Order');
      }

      if (quote.status !== 'ACCEPTED') {
        throw new ValidationError(`Only an ACCEPTED quotation can be converted to a Purchase Order. Current status: ${quote.status}`);
      }

      if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
        throw new ValidationError('This quotation has expired and can no longer be converted to a Purchase Order');
      }

      // Calculate delivery date based on lead time
      const expectedDelivery = new Date();
      expectedDelivery.setDate(expectedDelivery.getDate() + (quote.lead_time_days || 7));

      const lineTotal = Number(quote.unit_price) * Number(quote.offered_quantity);
      const poTotal = Number(quote.total_amount);

      const createdPo = await tx.purchaseOrder.create({
        data: {
          po_number: poNumber,
          supplier_id: quote.supplier_id,
          status: 'DRAFT', // Adheres strictly to PO approval workflow (Approver signs off)
          expected_delivery_date: expectedDelivery,
          total_amount: poTotal,
          notes: `Converted from Quotation ${quote.quotation_number} (Currency: ${quote.currency || 'INR'})`,
          created_by: userId,
          lines: {
            create: [
              {
                line_number: 1,
                product_id: quote.product_id,
                quantity_ordered: quote.offered_quantity,
                quantity_received: 0,
                unit_price: quote.unit_price,
                total_price: lineTotal,
                unit_of_measure: 'PCS',
              },
            ],
          },
        },
        include: {
          lines: true,
          supplier: true,
        },
      });

      // Update quotation with pointer to PO
      await tx.supplierQuotation.update({
        where: { id: quotationId },
        data: { converted_po_id: createdPo.id },
      });

      return createdPo;
    });

    await AuditService.log({
      userId,
      action: 'QUOTATION_CONVERTED_TO_PO',
      entityType: 'PURCHASE_ORDER',
      entityId: po.id,
      newValues: { poNumber: po.po_number, quotationId, totalAmount: po.total_amount },
    });

    return po;
  }

  // ==========================================
  // PHASE 5 — SUPPLIER PERFORMANCE & ANALYTICS
  // ==========================================

  public static async getSupplierPerformance(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        purchase_orders: {
          include: {
            lines: true,
            inspections: true,
          },
        },
        products: {
          include: { product: true },
        },
        quotations: true,
      },
    });

    if (!supplier) throw new NotFoundError('Supplier', supplierId);

    const pos = supplier.purchase_orders;
    const totalPOs = pos.length;
    const completedPOs = pos.filter((p) => p.status === 'RECEIVED').length;
    const cancelledPOs = pos.filter((p) => p.status === 'CANCELLED').length;
    const repeatPurchaseOrders = totalPOs > 1 ? totalPOs - 1 : 0;

    const totalPurchasedValue = pos
      .filter((p) => p.status === 'RECEIVED' || p.status === 'ORDERED' || p.status === 'APPROVED')
      .reduce((sum, p) => sum + Number(p.total_amount), 0);

    const lastPurchaseDate = pos.length > 0
      ? pos.map((p) => p.order_date).sort((a, b) => b.getTime() - a.getTime())[0]
      : null;

    // Delivery Performance: inspect completed POs
    let onTimeDeliveryPercentage: number | null = null;
    let onTimeCount = 0;
    let completedWithDates = 0;

    for (const po of pos) {
      if (po.status === 'RECEIVED' && po.expected_delivery_date) {
        completedWithDates++;
        if (po.updated_at <= po.expected_delivery_date) {
          onTimeCount++;
        }
      }
    }
    if (completedWithDates > 0) {
      onTimeDeliveryPercentage = Math.round((onTimeCount / completedWithDates) * 100);
    }

    // Quality Rejections: inspect quality inspections linked to POs
    let totalInspected = 0;
    let totalRejected = 0;
    for (const po of pos) {
      for (const insp of po.inspections) {
        if (insp.sample_size) totalInspected += Number(insp.sample_size);
        if (insp.failed_quantity) totalRejected += Number(insp.failed_quantity);
      }
    }
    const qualityRejectionPercentage =
      totalInspected > 0 ? Number(((totalRejected / totalInspected) * 100).toFixed(1)) : null;

    // Lead Time
    const leadTimes = supplier.products
      .map((p) => p.lead_time_days)
      .filter((d): d is number => d != null && d > 0);
    const averageLeadTimeDays =
      leadTimes.length > 0 ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : null;

    // Transparent Ranking Score Calculation
    let score = 50; // base score
    const scoreBreakdown: string[] = ['Base score: 50 pts'];

    if (completedPOs > 0) {
      const poPts = Math.min(20, completedPOs * 5);
      score += poPts;
      scoreBreakdown.push(`+${poPts} pts: ${completedPOs} completed purchase orders`);
    } else {
      scoreBreakdown.push('0 pts: No completed purchase orders yet');
    }

    if (onTimeDeliveryPercentage !== null) {
      const onTimePts = Math.round((onTimeDeliveryPercentage / 100) * 15);
      score += onTimePts;
      scoreBreakdown.push(`+${onTimePts} pts: ${onTimeDeliveryPercentage}% on-time delivery rate`);
    }

    if (qualityRejectionPercentage !== null) {
      if (qualityRejectionPercentage < 2) {
        score += 15;
        scoreBreakdown.push('+15 pts: Excellent quality (<2% rejection)');
      } else if (qualityRejectionPercentage < 5) {
        score += 10;
        scoreBreakdown.push('+10 pts: Good quality (<5% rejection)');
      } else {
        score -= 10;
        scoreBreakdown.push('-10 pts: Elevated rejection rate (>5%)');
      }
    }

    const openNegotiations = supplier.quotations.filter((q) =>
      ['REQUESTED', 'QUOTED', 'COUNTER_OFFERED', 'REVISED'].includes(q.status)
    ).length;
    const acceptedQuotations = supplier.quotations.filter((q) => q.status === 'ACCEPTED').length;

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierCode: supplier.supplier_code,
      totalPurchaseOrders: totalPOs,
      completedPurchaseOrders: completedPOs,
      cancelledPurchaseOrders: cancelledPOs,
      repeatPurchaseOrders,
      repeatPurchaseFrequency: totalPOs > 1 ? Number((repeatPurchaseOrders / totalPOs).toFixed(2)) : 0,
      totalPurchasedValue,
      currency: 'INR',
      lastPurchaseDate,
      averageLeadTimeDays,
      onTimeDeliveryPercentage,
      inspectedQuantity: totalInspected,
      rejectedQuantity: totalRejected,
      qualityRejectionPercentage,
      openNegotiations,
      acceptedQuotations,
      ranking: {
        score: Math.min(100, Math.max(0, score)),
        grade: score >= 85 ? 'TIER_1_PREFERRED' : score >= 70 ? 'TIER_2_QUALIFIED' : 'TIER_3_STANDARD',
        reasons: scoreBreakdown,
      },
    };
  }
}
