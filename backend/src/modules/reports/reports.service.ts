import { prisma } from '../../config/database.js';
import { Decimal } from 'decimal.js';

export class ReportsService {
  public static async getEngineeringReport() {
    const [boms, ecrs, ecos] = await Promise.all([
      prisma.bOM.findMany({
        include: {
          product: { select: { part_number: true, name: true } },
          components: true,
        },
      }),
      prisma.eCR.findMany({
        select: { id: true, ecr_number: true, status: true, priority: true, created_at: true, updated_at: true },
      }),
      prisma.eCO.findMany({
        select: { id: true, eco_number: true, status: true, priority: true, created_at: true, updated_at: true },
      }),
    ]);

    // BOM Cost Analysis in INR
    const bomSummaries = boms.map((bom) => {
      let totalCost = new Decimal(0);
      for (const c of bom.components) {
        const qty = new Decimal(c.quantity.toString());
        const cost = new Decimal(c.unit_cost.toString());
        totalCost = totalCost.plus(qty.times(cost));
      }
      return {
        id: bom.id,
        bomNumber: bom.bom_number,
        productPartNumber: bom.product.part_number,
        productName: bom.product.name,
        componentCount: bom.components.length,
        totalCostINR: totalCost.toFixed(2),
      };
    });

    // ECR turnaround times
    let totalTurnaroundHours = 0;
    let completedEcrCount = 0;
    for (const ecr of ecrs) {
      if (['ACCEPTED', 'REJECTED', 'PROMOTED'].includes(ecr.status)) {
        const diffMs = ecr.updated_at.getTime() - ecr.created_at.getTime();
        totalTurnaroundHours += diffMs / (1000 * 60 * 60);
        completedEcrCount++;
      }
    }
    const avgTurnaroundDays = completedEcrCount > 0 ? (totalTurnaroundHours / (completedEcrCount * 24)).toFixed(1) : '0.0';

    return {
      boms: bomSummaries,
      ecrStats: {
        total: ecrs.length,
        avgTurnaroundDays,
        byStatus: ecrs.reduce((acc: any, e) => {
          acc[e.status] = (acc[e.status] || 0) + 1;
          return acc;
        }, {}),
      },
      ecoStats: {
        total: ecos.length,
        byStatus: ecos.reduce((acc: any, e) => {
          acc[e.status] = (acc[e.status] || 0) + 1;
          return acc;
        }, {}),
      },
    };
  }

  public static async getInventoryReport() {
    const [warehouses, items, recentTransactions] = await Promise.all([
      prisma.warehouse.findMany(),
      prisma.inventoryItem.findMany({
        include: {
          product: { select: { id: true, part_number: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          transactions: {
            take: 1,
            orderBy: { created_at: 'desc' },
            select: { unit_cost: true },
          },
        },
      }),
      prisma.inventoryTransaction.findMany({
        take: 50,
        orderBy: { created_at: 'desc' },
        include: {
          item: {
            include: {
              product: { select: { part_number: true, name: true } },
              warehouse: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const warehouseSummary: Record<string, { id: string; name: string; code: string; itemCount: number; totalValuationINR: Decimal }> = {};
    for (const w of warehouses) {
      warehouseSummary[w.id] = {
        id: w.id,
        name: w.name,
        code: w.code,
        itemCount: 0,
        totalValuationINR: new Decimal(0),
      };
    }

    const lowStockItems = [];

    for (const item of items) {
      const onHand = new Decimal(item.quantity_on_hand.toString());
      const minThresh = new Decimal(item.min_threshold.toString());
      const unitCost = item.transactions.length > 0 && item.transactions[0].unit_cost ? new Decimal(item.transactions[0].unit_cost.toString()) : new Decimal(0);
      const val = onHand.times(unitCost);

      if (warehouseSummary[item.warehouse_id]) {
        warehouseSummary[item.warehouse_id].itemCount++;
        warehouseSummary[item.warehouse_id].totalValuationINR = warehouseSummary[item.warehouse_id].totalValuationINR.plus(val);
      }

      if (onHand.lessThanOrEqualTo(minThresh)) {
        lowStockItems.push({
          id: item.id,
          partNumber: item.product.part_number,
          productName: item.product.name,
          warehouse: item.warehouse.name,
          quantityOnHand: onHand.toFixed(4),
          minThreshold: minThresh.toFixed(4),
          unitOfMeasure: item.unit_of_measure,
        });
      }
    }

    const formattedWarehouses = Object.values(warehouseSummary).map((w) => ({
      ...w,
      totalValuationINR: w.totalValuationINR.toFixed(2),
    }));

    return {
      warehouses: formattedWarehouses,
      lowStockItems,
      recentMovements: recentTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        partNumber: tx.item.product.part_number,
        productName: tx.item.product.name,
        warehouse: tx.item.warehouse.name,
        quantity: tx.quantity.toString(),
        unitCostINR: tx.unit_cost.toString(),
        totalCostINR: tx.total_cost.toString(),
        referenceType: tx.reference_type,
        createdAt: tx.created_at,
      })),
    };
  }

  public static async getPurchasingReport() {
    const [orders, suppliers] = await Promise.all([
      prisma.purchaseOrder.findMany({
        include: {
          supplier: { select: { id: true, name: true, supplier_code: true } },
          lines: { include: { product: { select: { part_number: true, name: true } } } },
        },
      }),
      prisma.supplier.findMany(),
    ]);

    const supplierSpend: Record<string, { id: string; name: string; code: string; totalSpendINR: Decimal; orderCount: number }> = {};
    for (const s of suppliers) {
      supplierSpend[s.id] = {
        id: s.id,
        name: s.name,
        code: s.supplier_code,
        totalSpendINR: new Decimal(0),
        orderCount: 0,
      };
    }

    const statusBreakdown: Record<string, { count: number; totalINR: Decimal }> = {};

    for (const po of orders) {
      const amount = po.total_amount ? new Decimal(po.total_amount.toString()) : new Decimal(0);

      if (supplierSpend[po.supplier_id]) {
        supplierSpend[po.supplier_id].orderCount++;
        if (po.status !== 'CANCELLED') {
          supplierSpend[po.supplier_id].totalSpendINR = supplierSpend[po.supplier_id].totalSpendINR.plus(amount);
        }
      }

      if (!statusBreakdown[po.status]) {
        statusBreakdown[po.status] = { count: 0, totalINR: new Decimal(0) };
      }
      statusBreakdown[po.status].count++;
      statusBreakdown[po.status].totalINR = statusBreakdown[po.status].totalINR.plus(amount);
    }

    const formattedSuppliers = Object.values(supplierSpend)
      .map((s) => ({
        ...s,
        totalSpendINR: s.totalSpendINR.toFixed(2),
      }))
      .sort((a, b) => parseFloat(b.totalSpendINR) - parseFloat(a.totalSpendINR));

    const formattedStatus = Object.entries(statusBreakdown).map(([status, val]) => ({
      status,
      count: val.count,
      totalINR: val.totalINR.toFixed(2),
    }));

    return {
      supplierSpend: formattedSuppliers,
      statusBreakdown: formattedStatus,
      totalOrders: orders.length,
    };
  }

  public static async getManufacturingReport() {
    const workOrders = await prisma.workOrder.findMany({
      include: {
        product: { select: { part_number: true, name: true } },
        bom: { select: { bom_number: true } },
        allocations: {
          include: { product: { select: { part_number: true, name: true } } },
        },
      },
    });

    let totalPlanned = new Decimal(0);
    let totalCompleted = new Decimal(0);
    let totalRejected = new Decimal(0);

    const statusBreakdown: Record<string, number> = {};

    for (const wo of workOrders) {
      statusBreakdown[wo.status] = (statusBreakdown[wo.status] || 0) + 1;
      totalPlanned = totalPlanned.plus(new Decimal(wo.target_quantity.toString()));
      totalCompleted = totalCompleted.plus(new Decimal(wo.completed_quantity.toString()));
      totalRejected = totalRejected.plus(new Decimal(wo.rejected_quantity.toString()));
    }

    const scrapRate = totalCompleted.plus(totalRejected).isZero()
      ? '0.00'
      : totalRejected.dividedBy(totalCompleted.plus(totalRejected)).times(100).toFixed(2);

    return {
      totalWorkOrders: workOrders.length,
      statusBreakdown,
      quantities: {
        totalPlanned: totalPlanned.toFixed(4),
        totalCompleted: totalCompleted.toFixed(4),
        totalRejected: totalRejected.toFixed(4),
        scrapRatePercent: scrapRate,
      },
      workOrders: workOrders.slice(0, 50).map((wo) => ({
        id: wo.id,
        woNumber: wo.wo_number,
        productPartNumber: wo.product.part_number,
        productName: wo.product.name,
        status: wo.status,
        targetQty: wo.target_quantity.toString(),
        completedQty: wo.completed_quantity.toString(),
        rejectedQty: wo.rejected_quantity.toString(),
        startDate: wo.start_date,
        endDate: wo.end_date,
      })),
    };
  }

  public static async getQualityReport() {
    const [inspections, ncrs] = await Promise.all([
      prisma.qualityInspection.findMany({
        include: { product: { select: { part_number: true, name: true } } },
      }),
      prisma.qualityNonConformance.findMany({
        include: { product: { select: { part_number: true, name: true } } },
      }),
    ]);

    let totalPassedQty = new Decimal(0);
    let totalFailedQty = new Decimal(0);
    const inspectionStatusBreakdown: Record<string, number> = {};

    for (const ins of inspections) {
      inspectionStatusBreakdown[ins.status] = (inspectionStatusBreakdown[ins.status] || 0) + 1;
      if (ins.passed_quantity) totalPassedQty = totalPassedQty.plus(new Decimal(ins.passed_quantity.toString()));
      if (ins.failed_quantity) totalFailedQty = totalFailedQty.plus(new Decimal(ins.failed_quantity.toString()));
    }

    const totalInspected = totalPassedQty.plus(totalFailedQty);
    const passRate = totalInspected.isZero() ? '100.00' : totalPassedQty.dividedBy(totalInspected).times(100).toFixed(2);

    const ncrSeverityBreakdown: Record<string, number> = {};
    const ncrStatusBreakdown: Record<string, number> = {};
    let capaCount = 0;

    for (const ncr of ncrs) {
      ncrSeverityBreakdown[ncr.severity] = (ncrSeverityBreakdown[ncr.severity] || 0) + 1;
      ncrStatusBreakdown[ncr.status] = (ncrStatusBreakdown[ncr.status] || 0) + 1;
      if (ncr.capa_plan) capaCount++;
    }

    return {
      inspections: {
        total: inspections.length,
        statusBreakdown: inspectionStatusBreakdown,
        passRatePercent: passRate,
        passedQty: totalPassedQty.toFixed(4),
        failedQty: totalFailedQty.toFixed(4),
      },
      ncrs: {
        total: ncrs.length,
        severityBreakdown: ncrSeverityBreakdown,
        statusBreakdown: ncrStatusBreakdown,
        capaPlansDefined: capaCount,
      },
    };
  }

  public static async generateCSV(type: string): Promise<string> {
    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '';
      const text = String(str).replace(/"/g, '""');
      return `"${text}"`;
    };

    if (type === 'inventory') {
      const items = await prisma.inventoryItem.findMany({
        include: {
          product: { select: { part_number: true, name: true } },
          warehouse: { select: { name: true, code: true } },
          transactions: {
            take: 1,
            orderBy: { created_at: 'desc' },
            select: { unit_cost: true },
          },
        },
      });

      const header = ['Part Number', 'Product Name', 'Warehouse', 'On Hand', 'Reserved', 'Min Threshold', 'UOM', 'Unit Cost (INR)', 'Total Valuation (INR)'];
      const rows = items.map((item) => {
        const onHand = new Decimal(item.quantity_on_hand.toString());
        const unitCost = item.transactions.length > 0 && item.transactions[0].unit_cost ? new Decimal(item.transactions[0].unit_cost.toString()) : new Decimal(0);
        const val = onHand.times(unitCost);
        return [
          item.product.part_number,
          item.product.name,
          `${item.warehouse.name} (${item.warehouse.code})`,
          item.quantity_on_hand.toString(),
          item.quantity_reserved.toString(),
          item.min_threshold.toString(),
          item.unit_of_measure,
          unitCost.toFixed(2),
          val.toFixed(2),
        ].map(escapeCSV).join(',');
      });

      return [header.join(','), ...rows].join('\r\n');
    }

    if (type === 'purchasing') {
      const orders = await prisma.purchaseOrder.findMany({
        include: {
          supplier: { select: { name: true, supplier_code: true } },
          creator: { select: { first_name: true, last_name: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      const header = ['PO Number', 'Supplier', 'Status', 'Total Amount (INR)', 'Expected Delivery', 'Created By', 'Created At'];
      const rows = orders.map((po) => [
        po.po_number,
        `${po.supplier.name} (${po.supplier.supplier_code})`,
        po.status,
        po.total_amount ? po.total_amount.toString() : '0.00',
        po.expected_delivery_date ? po.expected_delivery_date.toISOString().slice(0, 10) : '',
        po.creator ? `${po.creator.first_name} ${po.creator.last_name}` : '',
        po.created_at.toISOString().slice(0, 10),
      ].map(escapeCSV).join(','));

      return [header.join(','), ...rows].join('\r\n');
    }

    if (type === 'manufacturing') {
      const wos = await prisma.workOrder.findMany({
        include: {
          product: { select: { part_number: true, name: true } },
          bom: { select: { bom_number: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      const header = ['WO Number', 'Part Number', 'Product Name', 'BOM Number', 'Status', 'Target Qty', 'Completed Qty', 'Rejected Qty', 'Start Date', 'End Date'];
      const rows = wos.map((wo) => [
        wo.wo_number,
        wo.product.part_number,
        wo.product.name,
        wo.bom.bom_number,
        wo.status,
        wo.target_quantity.toString(),
        wo.completed_quantity.toString(),
        wo.rejected_quantity.toString(),
        wo.start_date ? wo.start_date.toISOString().slice(0, 10) : '',
        wo.end_date ? wo.end_date.toISOString().slice(0, 10) : '',
      ].map(escapeCSV).join(','));

      return [header.join(','), ...rows].join('\r\n');
    }

    if (type === 'quality') {
      const ncrs = await prisma.qualityNonConformance.findMany({
        include: {
          product: { select: { part_number: true, name: true } },
          assignee: { select: { first_name: true, last_name: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      const header = ['NCR Number', 'Part Number', 'Product Name', 'Severity', 'Status', 'Title', 'Disposition', 'Assigned To', 'Created At'];
      const rows = ncrs.map((ncr) => [
        ncr.ncr_number,
        ncr.product.part_number,
        ncr.product.name,
        ncr.severity,
        ncr.status,
        ncr.title,
        ncr.disposition || '',
        ncr.assignee ? `${ncr.assignee.first_name} ${ncr.assignee.last_name}` : '',
        ncr.created_at.toISOString().slice(0, 10),
      ].map(escapeCSV).join(','));

      return [header.join(','), ...rows].join('\r\n');
    }

    // Default: engineering (BOM summary)
    const boms = await prisma.bOM.findMany({
      include: {
        product: { select: { part_number: true, name: true } },
        components: true,
      },
    });

    const header = ['BOM Number', 'Part Number', 'Product Name', 'Revision', 'Status', 'Component Count', 'Total Cost (INR)'];
    const rows = boms.map((bom) => {
      let cost = new Decimal(0);
      for (const c of bom.components) {
        cost = cost.plus(new Decimal(c.quantity.toString()).times(new Decimal(c.unit_cost.toString())));
      }
      return [
        bom.bom_number,
        bom.product.part_number,
        bom.product.name,
        bom.current_version.toString(),
        bom.status,
        bom.components.length.toString(),
        cost.toFixed(2),
      ].map(escapeCSV).join(',');
    });

    return [header.join(','), ...rows].join('\r\n');
  }
}
