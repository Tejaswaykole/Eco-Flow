import { prisma } from '../../config/database.js';
import { AuditService } from '../../services/audit.service.js';

export interface PendingApprovalItem {
  id: string;
  entityType: 'ECO' | 'ECR' | 'ECN' | 'PURCHASE_ORDER' | 'NCR';
  referenceNumber: string;
  title: string;
  status: string;
  priority?: string;
  submittedBy?: { id: string; name: string; email: string };
  assignedTo?: { id: string; name: string; email: string };
  submittedAt: Date;
  dueDate: Date;
  isOverdue: boolean;
  link: string;
}

export class ApprovalsService {
  private static calculateDueDate(createdAt: Date, priority?: string, defaultDays = 7): Date {
    let days = defaultDays;
    if (priority === 'CRITICAL') days = 2;
    else if (priority === 'HIGH') days = 4;
    else if (priority === 'LOW') days = 14;

    const due = new Date(createdAt);
    due.setDate(due.getDate() + days);
    return due;
  }

  public static async listPendingApprovals(domain?: string, overdueOnly?: boolean): Promise<{ items: PendingApprovalItem[]; total: number; overdueCount: number }> {
    const now = new Date();
    const items: PendingApprovalItem[] = [];

    // 1. ECO approvals (SUBMITTED, UNDER_REVIEW)
    if (!domain || domain === 'eco' || domain === 'ECO') {
      const ecos = await prisma.eCO.findMany({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        include: {
          creator: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      for (const eco of ecos) {
        const dueDate = this.calculateDueDate(eco.created_at, eco.priority, 7);
        const isOverdue = now > dueDate;
        if (overdueOnly && !isOverdue) continue;

        items.push({
          id: eco.id,
          entityType: 'ECO',
          referenceNumber: eco.eco_number,
          title: eco.title,
          status: eco.status,
          priority: eco.priority,
          submittedBy: eco.creator ? { id: eco.creator.id, name: `${eco.creator.first_name} ${eco.creator.last_name}`, email: eco.creator.email } : undefined,
          assignedTo: eco.assignee ? { id: eco.assignee.id, name: `${eco.assignee.first_name} ${eco.assignee.last_name}`, email: eco.assignee.email } : undefined,
          submittedAt: eco.created_at,
          dueDate,
          isOverdue,
          link: `/ecos/${eco.id}`,
        });
      }
    }

    // 2. ECR approvals (SUBMITTED, UNDER_REVIEW, NEEDS_INFORMATION)
    if (!domain || domain === 'ecr' || domain === 'ECR') {
      const ecrs = await prisma.eCR.findMany({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION'] } },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      for (const ecr of ecrs) {
        const dueDate = this.calculateDueDate(ecr.created_at, ecr.priority, 7);
        const isOverdue = now > dueDate;
        if (overdueOnly && !isOverdue) continue;

        items.push({
          id: ecr.id,
          entityType: 'ECR',
          referenceNumber: ecr.ecr_number,
          title: ecr.title,
          status: ecr.status,
          priority: ecr.priority,
          submittedBy: ecr.submitter ? { id: ecr.submitter.id, name: `${ecr.submitter.first_name} ${ecr.submitter.last_name}`, email: ecr.submitter.email } : undefined,
          assignedTo: ecr.assignee ? { id: ecr.assignee.id, name: `${ecr.assignee.first_name} ${ecr.assignee.last_name}`, email: ecr.assignee.email } : undefined,
          submittedAt: ecr.created_at,
          dueDate,
          isOverdue,
          link: `/ecrs`,
        });
      }
    }

    // 3. ECN distribution acknowledgements (PENDING)
    if (!domain || domain === 'ecn' || domain === 'ECN') {
      const ecns = await prisma.eCNDistribution.findMany({
        where: { acknowledgement_status: 'PENDING' },
        include: {
          ecn: { select: { id: true, ecn_number: true, title: true, created_at: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      for (const dist of ecns) {
        const dueDate = this.calculateDueDate(dist.created_at, undefined, 5);
        const isOverdue = now > dueDate;
        if (overdueOnly && !isOverdue) continue;

        items.push({
          id: dist.id,
          entityType: 'ECN',
          referenceNumber: dist.ecn.ecn_number,
          title: `${dist.ecn.title} (${dist.department})`,
          status: dist.acknowledgement_status,
          assignedTo: dist.assignee ? { id: dist.assignee.id, name: `${dist.assignee.first_name} ${dist.assignee.last_name}`, email: dist.assignee.email } : undefined,
          submittedAt: dist.created_at,
          dueDate,
          isOverdue,
          link: `/ecns`,
        });
      }
    }

    // 4. Purchase Order approvals (SUBMITTED)
    if (!domain || domain === 'po' || domain === 'purchase_order' || domain === 'PURCHASE_ORDER') {
      const pos = await prisma.purchaseOrder.findMany({
        where: { status: 'SUBMITTED' },
        include: {
          creator: { select: { id: true, first_name: true, last_name: true, email: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      for (const po of pos) {
        const dueDate = this.calculateDueDate(po.created_at, undefined, 5);
        const isOverdue = now > dueDate;
        if (overdueOnly && !isOverdue) continue;

        items.push({
          id: po.id,
          entityType: 'PURCHASE_ORDER',
          referenceNumber: po.po_number,
          title: `Supplier: ${po.supplier.name} - Total: ₹${po.total_amount}`,
          status: po.status,
          submittedBy: po.creator ? { id: po.creator.id, name: `${po.creator.first_name} ${po.creator.last_name}`, email: po.creator.email } : undefined,
          submittedAt: po.created_at,
          dueDate,
          isOverdue,
          link: `/purchasing/orders`,
        });
      }
    }

    // 5. NCR reviews (OPEN, UNDER_INVESTIGATION)
    if (!domain || domain === 'ncr' || domain === 'NCR') {
      const ncrs = await prisma.qualityNonConformance.findMany({
        where: { status: { in: ['OPEN', 'UNDER_INVESTIGATION'] } },
        include: {
          creator: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { part_number: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      });

      for (const ncr of ncrs) {
        const dueDate = this.calculateDueDate(ncr.created_at, ncr.severity, 7);
        const isOverdue = now > dueDate;
        if (overdueOnly && !isOverdue) continue;

        items.push({
          id: ncr.id,
          entityType: 'NCR',
          referenceNumber: ncr.ncr_number,
          title: `${ncr.title} (${ncr.product.part_number})`,
          status: ncr.status,
          priority: ncr.severity,
          submittedBy: ncr.creator ? { id: ncr.creator.id, name: `${ncr.creator.first_name} ${ncr.creator.last_name}`, email: ncr.creator.email } : undefined,
          assignedTo: ncr.assignee ? { id: ncr.assignee.id, name: `${ncr.assignee.first_name} ${ncr.assignee.last_name}`, email: ncr.assignee.email } : undefined,
          submittedAt: ncr.created_at,
          dueDate,
          isOverdue,
          link: `/quality/non-conformances`,
        });
      }
    }

    // Sort by overdue first, then by earliest dueDate
    items.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    const overdueCount = items.filter((i) => i.isOverdue).length;

    return {
      items,
      total: items.length,
      overdueCount,
    };
  }

  public static async getApprovalStats() {
    const all = await this.listPendingApprovals();
    const byDomain = {
      eco: { pending: 0, overdue: 0 },
      ecr: { pending: 0, overdue: 0 },
      ecn: { pending: 0, overdue: 0 },
      po: { pending: 0, overdue: 0 },
      ncr: { pending: 0, overdue: 0 },
    };

    for (const item of all.items) {
      const dKey = item.entityType === 'PURCHASE_ORDER' ? 'po' : (item.entityType.toLowerCase() as 'eco' | 'ecr' | 'ecn' | 'ncr');
      if (byDomain[dKey]) {
        byDomain[dKey].pending++;
        if (item.isOverdue) byDomain[dKey].overdue++;
      }
    }

    return {
      totalPending: all.total,
      totalOverdue: all.overdueCount,
      byDomain,
    };
  }

  public static async sendReminders(): Promise<{ remindersSent: number; timestamp: string }> {
    const all = await this.listPendingApprovals(undefined, false);
    let sent = 0;

    for (const item of all.items) {
      const recipientId = item.assignedTo?.id || item.submittedBy?.id;
      if (!recipientId) continue;

      const urgencyPrefix = item.isOverdue ? '⚠️ OVERDUE: ' : 'Reminder: ';
      await AuditService.notify({
        userId: recipientId,
        type: 'APPROVAL_REQUESTED',
        title: `${urgencyPrefix}${item.entityType} ${item.referenceNumber}`,
        message: `${item.title} requires your attention (Status: ${item.status}, Due: ${item.dueDate.toLocaleDateString()}).`,
        link: item.link,
      });
      sent++;
    }

    return {
      remindersSent: sent,
      timestamp: new Date().toISOString(),
    };
  }
}
