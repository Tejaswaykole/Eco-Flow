import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, AppError, ForbiddenError } from '../../utils/errors.js';
import { CreateECOInput, AddChangeInput, ApproveECOInput } from './eco.schema.js';
import { AuditService } from '../../services/audit.service.js';
import { randomUUID } from 'crypto';
import crypto from 'crypto';

export class ECOService {
  public static async createECO(input: CreateECOInput, userId: string) {
    const existing = await prisma.eCO.findFirst({
      where: { eco_number: input.ecoNumber },
    });
    if (existing) throw new ConflictError(`ECO number '${input.ecoNumber}' already exists`);

    const bom = await prisma.bOM.findFirst({
      where: { id: input.bomId, product_id: input.productId },
    });
    if (!bom) throw new NotFoundError('BOM associated with Product', `${input.bomId} / ${input.productId}`);

    const ecoId = randomUUID();

    return await prisma.$transaction(async (tx) => {
      const eco = await tx.eCO.create({
        data: {
          id: ecoId,
          eco_number: input.ecoNumber,
          product_id: input.productId,
          bom_id: input.bomId,
          title: input.title,
          description: input.description,
          priority: input.priority as any,
          status: 'DRAFT',
          active_revision_no: 1,
          created_by: userId,
        },
      });

      const revision = await tx.eCORevision.create({
        data: {
          eco_id: ecoId,
          revision_number: 1,
          change_summary: input.changeSummary,
          status: 'DRAFT',
          created_by: userId,
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECO_CREATED',
          entityType: 'ECO',
          entityId: ecoId,
          newValues: { ecoNumber: input.ecoNumber, title: input.title },
        },
        tx
      );

      return { ...eco, activeRevision: revision };
    });
  }

  public static async listECOs(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [ecos, total] = await Promise.all([
      prisma.eCO.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
          creator: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      }),
      prisma.eCO.count({ where }),
    ]);

    return {
      ecos,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getECOById(id: string) {
    const eco = await prisma.eCO.findUnique({
      where: { id },
      include: {
        product: true,
        bom: { include: { components: true } },
        creator: { select: { id: true, first_name: true, last_name: true, email: true } },
        eco_revisions: {
          orderBy: { revision_number: 'desc' },
          include: {
            changes: true,
            snapshot: true,
            approval: {
              include: {
                approver: { select: { id: true, first_name: true, last_name: true, email: true } },
              },
            },
          },
        },
        eco_comments: {
          include: { user: { select: { id: true, first_name: true, last_name: true } } },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!eco) throw new NotFoundError('ECO', id);
    return eco;
  }

  public static async addChange(ecoId: string, input: AddChangeInput, _userId: string) {
    const eco = await prisma.eCO.findUnique({ where: { id: ecoId } });
    if (!eco) throw new NotFoundError('ECO', ecoId);

    if (eco.status !== 'DRAFT') {
      throw new AppError('Changes can only be added when ECO is in DRAFT status', 400);
    }

    return await prisma.eCOChange.create({
      data: {
        id: randomUUID(),
        eco_id: ecoId,
        revision_number: eco.active_revision_no,
        change_type: input.changeType as any,
        change_target: input.changeTarget as any,
        field_name: input.fieldName,
        old_value: input.oldValue,
        new_value: input.newValue,
      },
    });
  }

  public static async submitECO(ecoId: string, userId: string) {
    const eco = await prisma.eCO.findUnique({
      where: { id: ecoId },
      include: {
        product: true,
        bom: { include: { components: true } },
        eco_revisions: { where: { status: 'DRAFT' } },
        eco_changes: true,
      },
    });

    if (!eco) throw new NotFoundError('ECO', ecoId);
    if (eco.status !== 'DRAFT') throw new AppError(`ECO cannot be submitted from status ${eco.status}`, 400);

    const activeRev = eco.eco_revisions.find((r) => r.revision_number === eco.active_revision_no);
    if (!activeRev) throw new AppError('Active draft revision not found', 404);

    const snapshotPayload = {
      product: eco.product,
      bom: eco.bom,
      changes: eco.eco_changes,
      submittedAt: new Date().toISOString(),
      submittedBy: userId,
    };

    const snapshotHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(snapshotPayload))
      .digest('hex');

    return await prisma.$transaction(async (tx) => {
      await tx.eCORevisionSnapshot.create({
        data: {
          id: randomUUID(),
          eco_id: ecoId,
          revision_number: activeRev.revision_number,
          snapshot_data: snapshotPayload,
        },
      });

      const updatedRev = await tx.eCORevision.update({
        where: {
          eco_id_revision_number: {
            eco_id: ecoId,
            revision_number: activeRev.revision_number,
          },
        },
        data: {
          status: 'SUBMITTED',
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECO_SUBMITTED',
          entityType: 'ECO',
          entityId: ecoId,
          newValues: { status: 'SUBMITTED', snapshotHash },
        },
        tx
      );

      return updatedRev;
    });
  }

  public static async reviewECO(ecoId: string, input: ApproveECOInput, userId: string, userRoles: string[]) {
    const eco = await prisma.eCO.findUnique({
      where: { id: ecoId },
      include: {
        product: true,
        bom: { include: { components: true } },
      },
    });

    if (!eco) throw new NotFoundError('ECO', ecoId);

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(eco.status)) {
      throw new AppError(`Cannot evaluate decision on ECO in status '${eco.status}'`, 400);
    }

    const isApprover = userRoles.includes('APPROVER') || userRoles.includes('ADMINISTRATOR');
    if (!isApprover) {
      throw new ForbiddenError('Only assigned APPROVERs or ADMINISTRATORs can decide ECOs');
    }

    const isAdminOverride = !userRoles.includes('APPROVER') && userRoles.includes('ADMINISTRATOR');
    if (isAdminOverride && !input.overrideReason) {
      throw new AppError('Administrative override requires a documented justification reason', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const approval = await tx.approval.create({
        data: {
          id: randomUUID(),
          eco_id: ecoId,
          revision_number: eco.active_revision_no,
          approver_id: userId,
          decision: input.decision as any,
          comments: input.comments,
        },
      });

      let newStatus: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' = 'CHANGES_REQUESTED';
      if (input.decision === 'APPROVED') newStatus = 'APPROVED';
      else if (input.decision === 'REJECTED') newStatus = 'REJECTED';

      // Lifecycle trigger: SUBMITTED must transition to UNDER_REVIEW before terminal states (APPROVED/REJECTED/CHANGES_REQUESTED)
      if (eco.status === 'SUBMITTED') {
        await tx.eCORevision.update({
          where: {
            eco_id_revision_number: {
              eco_id: ecoId,
              revision_number: eco.active_revision_no,
            },
          },
          data: { status: 'UNDER_REVIEW' },
        });
      }

      await tx.eCORevision.update({
        where: {
          eco_id_revision_number: {
            eco_id: ecoId,
            revision_number: eco.active_revision_no,
          },
        },
        data: { status: newStatus as any },
      });

      if (newStatus === 'APPROVED') {
        const nextProdVer = eco.product.current_version + 1;
        const nextBomVer = eco.bom.current_version + 1;

        const prodVersion = await tx.productVersion.create({
          data: {
            id: randomUUID(),
            product_id: eco.product_id,
            eco_id: eco.id,
            revision_number: eco.active_revision_no,
            version_number: nextProdVer,
            snapshot_data: { product: eco.product },
            created_by: userId,
          },
        });

        const bomVersion = await tx.bOMVersion.create({
          data: {
            id: randomUUID(),
            bom_id: eco.bom_id,
            product_id: eco.product_id,
            eco_id: eco.id,
            revision_number: eco.active_revision_no,
            version_number: nextBomVer,
            snapshot_data: { bom: eco.bom },
            created_by: userId,
          },
        });

        await tx.versionRelease.create({
          data: {
            id: randomUUID(),
            eco_id: eco.id,
            product_id: eco.product_id,
            product_version_id: prodVersion.id,
            bom_version_id: bomVersion.id,
            release_status: 'RELEASED',
            released_by: userId,
          },
        });

        await tx.product.update({
          where: { id: eco.product_id },
          data: { current_version: nextProdVer, status: 'ACTIVE' },
        });

        await tx.bOM.update({
          where: { id: eco.bom_id },
          data: { current_version: nextBomVer, status: 'ACTIVE' },
        });
      }

      await AuditService.log(
        {
          userId,
          action: `ECO_${newStatus}`,
          entityType: 'ECO',
          entityId: ecoId,
          newValues: { decision: input.decision, approvalId: approval.id },
        },
        tx
      );

      return { approval, newStatus };
    });
  }
}
