import { prisma } from '../../config/database.js';
import { Decimal } from 'decimal.js';

export class DashboardService {
  public static async getMetrics(userRoles: string[] = []) {
    const isRestrictedRole = userRoles.includes('OPERATOR') || (!userRoles.includes('ADMINISTRATOR') && !userRoles.includes('LEAD_ENGINEER'));
    const [
      productsCount,
      bomsCount,
      pendingEcrsCount,
      activeEcosCount,
      issuedEcnsCount,
      openPosCount,
      activeWosCount,
      openNcrsCount,
      ecoStatusGroup,
      poStatusGroup,
      woStatusGroup,
      ncrSeverityGroup,
      inventoryItems,
      purchaseOrders,
      recentLogs,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.bOM.count(),
      prisma.eCR.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION'] } } }),
      prisma.eCO.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      prisma.eCN.count({ where: { status: 'ISSUED' } }),
      prisma.purchaseOrder.count({ where: { status: { in: ['SUBMITTED', 'ORDERED', 'PARTIALLY_RECEIVED'] } } }),
      prisma.workOrder.count({ where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
      prisma.qualityNonConformance.count({ where: { status: { in: ['OPEN', 'UNDER_INVESTIGATION', 'CAPA_REQUIRED'] } } }),
      prisma.eCO.groupBy({ by: ['status'], _count: true }),
      prisma.purchaseOrder.groupBy({ by: ['status'], _count: true }),
      prisma.workOrder.groupBy({ by: ['status'], _count: true }),
      prisma.qualityNonConformance.groupBy({ by: ['severity'], _count: true }),
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
      prisma.purchaseOrder.findMany({
        where: { status: { notIn: ['CANCELLED', 'DRAFT'] } },
        select: { total_amount: true },
      }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        include: { user: { select: { id: true, first_name: true, last_name: true, email: true } } },
      }),
    ]);

    // Calculate low-stock items and total inventory valuation in INR
    let lowStockCount = 0;
    let totalInventoryValuation = new Decimal(0);

    for (const item of inventoryItems) {
      const onHand = new Decimal(item.quantity_on_hand.toString());
      const minThreshold = new Decimal(item.min_threshold.toString());

      if (onHand.lessThanOrEqualTo(minThreshold) || onHand.isZero()) {
        lowStockCount++;
      }

      // Unit cost from latest transaction or fallback to 0
      const unitCost = item.transactions.length > 0 && item.transactions[0].unit_cost
        ? new Decimal(item.transactions[0].unit_cost.toString())
        : new Decimal(0);

      totalInventoryValuation = totalInventoryValuation.plus(onHand.times(unitCost));
    }

    // Total PO Spend in INR
    let totalPOSpend = new Decimal(0);
    for (const po of purchaseOrders) {
      if (po.total_amount) {
        totalPOSpend = totalPOSpend.plus(new Decimal(po.total_amount.toString()));
      }
    }

    const pendingApprovalsCount = pendingEcrsCount + activeEcosCount + openPosCount + openNcrsCount;

    return {
      kpis: {
        products: productsCount,
        activeBOMs: bomsCount,
        pendingECRs: pendingEcrsCount,
        activeECOs: activeEcosCount,
        pendingApprovals: pendingApprovalsCount,
        issuedECNs: issuedEcnsCount,
        openPOs: openPosCount,
        lowStockAlerts: lowStockCount,
        activeWOs: activeWosCount,
        openNCRs: openNcrsCount,
        inventoryValuationINR: isRestrictedRole ? '0.00' : totalInventoryValuation.toFixed(2),
        poSpendINR: isRestrictedRole ? '0.00' : totalPOSpend.toFixed(2),
        currency: 'INR',
        currencySymbol: '₹',
      },
      charts: {
        ecoDistribution: ecoStatusGroup.map((g) => ({ status: g.status, count: g._count })),
        poDistribution: poStatusGroup.map((g) => ({ status: g.status, count: g._count })),
        woDistribution: woStatusGroup.map((g) => ({ status: g.status, count: g._count })),
        ncrSeverity: ncrSeverityGroup.map((g) => ({ severity: g.severity, count: g._count })),
      },
      recentActivity: recentLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        createdAt: log.created_at,
        user: log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System',
      })),
    };
  }
}

