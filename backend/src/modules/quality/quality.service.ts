import { prisma } from '../../config/database.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { AuditService } from '../../services/audit.service.js';
import { CreateInspectionInput, RecordInspectionResultInput, CreateNCRInput, UpdateNCRInput } from './quality.schema.js';
import { Decimal } from 'decimal.js';
import crypto from 'crypto';

export class QualityService {
  private static generateInspectionNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `INS-${today}-${suffix}`;
  }

  private static generateNCRNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `NCR-${today}-${suffix}`;
  }

  public static async listInspections(page = 1, limit = 50, status?: string, type?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [total, inspections] = await Promise.all([
      prisma.qualityInspection.count({ where }),
      prisma.qualityInspection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product: { select: { id: true, part_number: true, name: true } },
          work_order: { select: { id: true, wo_number: true } },
          purchase_order: { select: { id: true, po_number: true } },
          inspector: { select: { id: true, email: true, first_name: true, last_name: true } },
        },
      }),
    ]);

    return {
      inspections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getInspection(id: string) {
    const ins = await prisma.qualityInspection.findUnique({
      where: { id },
      include: {
        product: true,
        bom: true,
        work_order: true,
        purchase_order: true,
        inspector: { select: { id: true, email: true, first_name: true, last_name: true } },
        non_conformances: true,
      },
    });

    if (!ins) throw new NotFoundError('QualityInspection', id);
    return ins;
  }

  public static async createInspection(input: CreateInspectionInput, userId: string) {
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundError('Product', input.productId);

    const inspectionNumber = this.generateInspectionNumber();

    const ins = await prisma.qualityInspection.create({
      data: {
        inspection_number: inspectionNumber,
        type: input.type,
        status: 'PENDING',
        product_id: input.productId,
        bom_id: input.bomId || null,
        work_order_id: input.workOrderId || null,
        po_id: input.poId || null,
        inspector_id: userId,
        sample_size: new Decimal(input.sampleSize).toFixed(4) as any,
        notes: input.notes || null,
      },
    });

    await AuditService.log({
      userId,
      action: 'QUALITY_INSPECTION_CREATED',
      entityType: 'QUALITY_INSPECTION',
      entityId: ins.id,
      newValues: { inspectionNumber: ins.inspection_number, type: ins.type },
    });

    return ins;
  }

  public static async recordInspectionResult(id: string, input: RecordInspectionResultInput, userId: string) {
    const ins = await prisma.qualityInspection.findUnique({ where: { id } });
    if (!ins) throw new NotFoundError('QualityInspection', id);

    const updated = await prisma.qualityInspection.update({
      where: { id },
      data: {
        status: input.status,
        passed_quantity: new Decimal(input.passedQuantity).toFixed(4) as any,
        failed_quantity: new Decimal(input.failedQuantity).toFixed(4) as any,
        conducted_at: new Date(),
        inspector_id: userId,
        notes: input.notes ? (ins.notes ? `${ins.notes}\n${input.notes}` : input.notes) : ins.notes,
      },
      include: { product: true },
    });

    await AuditService.log({
      userId,
      action: 'QUALITY_INSPECTION_COMPLETED',
      entityType: 'QUALITY_INSPECTION',
      entityId: id,
      newValues: { status: input.status, passed: input.passedQuantity, failed: input.failedQuantity },
    });

    if (input.status === 'FAILED') {
      await AuditService.notify({
        userId,
        type: 'SYSTEM_ALERT',
        title: `Quality Inspection FAILED: ${ins.inspection_number}`,
        message: `Inspection ${ins.inspection_number} failed with ${input.failedQuantity} defect(s).`,
        link: `/quality/inspections`,
      });
    }

    return updated;
  }

  public static async listNCRs(page = 1, limit = 50, status?: string, severity?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const [total, ncrs] = await Promise.all([
      prisma.qualityNonConformance.count({ where }),
      prisma.qualityNonConformance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product: { select: { id: true, part_number: true, name: true } },
          creator: { select: { id: true, email: true, first_name: true, last_name: true } },
          assignee: { select: { id: true, email: true, first_name: true, last_name: true } },
        },
      }),
    ]);

    return {
      ncrs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getNCR(id: string) {
    const ncr = await prisma.qualityNonConformance.findUnique({
      where: { id },
      include: {
        product: true,
        inspection: true,
        creator: { select: { id: true, email: true, first_name: true, last_name: true } },
        assignee: { select: { id: true, email: true, first_name: true, last_name: true } },
      },
    });

    if (!ncr) throw new NotFoundError('QualityNonConformance', id);
    return ncr;
  }

  public static async createNCR(input: CreateNCRInput, userId: string) {
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundError('Product', input.productId);

    const ncrNumber = this.generateNCRNumber();

    const ncr = await prisma.qualityNonConformance.create({
      data: {
        ncr_number: ncrNumber,
        product_id: input.productId,
        inspection_id: input.inspectionId || null,
        severity: input.severity,
        status: 'OPEN',
        title: input.title,
        description: input.description,
        root_cause: input.rootCause || null,
        disposition: input.disposition || null,
        capa_plan: input.capaPlan || null,
        assigned_to: input.assignedTo || null,
        created_by: userId,
      },
    });

    await AuditService.log({
      userId,
      action: 'NCR_CREATED',
      entityType: 'NCR',
      entityId: ncr.id,
      newValues: { ncrNumber: ncr.ncr_number, title: ncr.title, severity: ncr.severity },
    });

    if (input.assignedTo) {
      await AuditService.notify({
        userId: input.assignedTo,
        type: 'APPROVAL_REQUESTED',
        title: `NCR Assigned: ${ncr.ncr_number}`,
        message: `You have been assigned NCR ${ncr.ncr_number}: ${ncr.title} (${ncr.severity}).`,
        link: `/quality/non-conformances`,
      });
    }

    if (userId !== input.assignedTo) {
      await AuditService.notify({
        userId,
        type: 'SYSTEM_ALERT',
        title: `NCR Logged: ${ncr.ncr_number}`,
        message: `NCR ${ncr.ncr_number} logged successfully with severity ${ncr.severity}.`,
        link: `/quality/non-conformances`,
      });
    }

    return ncr;
  }

  public static async updateNCR(id: string, input: UpdateNCRInput, userId: string) {
    const oldNCR = await prisma.qualityNonConformance.findUnique({ where: { id } });
    if (!oldNCR) throw new NotFoundError('QualityNonConformance', id);

    const updated = await prisma.qualityNonConformance.update({
      where: { id },
      data: {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.rootCause !== undefined && { root_cause: input.rootCause }),
        ...(input.disposition !== undefined && { disposition: input.disposition }),
        ...(input.capaPlan !== undefined && { capa_plan: input.capaPlan }),
        ...(input.assignedTo !== undefined && { assigned_to: input.assignedTo }),
      },
    });

    await AuditService.log({
      userId,
      action: 'NCR_UPDATED',
      entityType: 'NCR',
      entityId: id,
      oldValues: { status: oldNCR.status },
      newValues: { status: updated.status, disposition: updated.disposition },
    });

    if (updated.assigned_to) {
      await AuditService.notify({
        userId: updated.assigned_to,
        type: 'SYSTEM_ALERT',
        title: `NCR Updated: ${updated.ncr_number}`,
        message: `NCR ${updated.ncr_number} updated: status is now ${updated.status}.`,
        link: `/quality/non-conformances`,
      });
    }

    return updated;
  }
}
