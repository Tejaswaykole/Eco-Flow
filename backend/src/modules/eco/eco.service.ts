import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, AppError, ForbiddenError } from '../../utils/errors.js';
import {
  CreateECOInput,
  AddChangeInput,
  ApproveECOInput,
  CreateRevisionInput,
  UpdateChangeInput,
} from './eco.schema.js';
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
          ecn: { select: { id: true, ecn_number: true, status: true } },
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
            changes: {
              orderBy: { created_at: 'asc' },
            },
            snapshot: true,
            approval: {
              include: {
                approver: { select: { id: true, first_name: true, last_name: true, email: true } },
              },
            },
          },
        },
        eco_changes: {
          orderBy: { created_at: 'asc' },
        },
        eco_comments: {
          include: { user: { select: { id: true, first_name: true, last_name: true } } },
          orderBy: { created_at: 'asc' },
        },
        ecn: {
          select: { id: true, ecn_number: true, status: true, effective_date: true },
        },
      },
    });

    if (!eco) throw new NotFoundError('ECO', id);
    return eco;
  }

  public static async createRevision(
    ecoId: string,
    input: CreateRevisionInput,
    userId: string,
    userRoles: string[] = []
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Transaction-scoped advisory lock to serialize revision creation on lock ID 4200000001002
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(4200000001002);`;

      // 2. Fetch ECO with all existing revisions and their changes
      const eco = await tx.eCO.findUnique({
        where: { id: ecoId },
        include: {
          eco_revisions: {
            orderBy: { revision_number: 'desc' },
            include: {
              changes: true,
              snapshot: true,
              approval: true,
            },
          },
        },
      });

      if (!eco) throw new NotFoundError('ECO', ecoId);

      // 3. Authorization verification
      const isAuthorized =
        eco.created_by === userId ||
        userRoles.includes('ADMINISTRATOR') ||
        userRoles.includes('LEAD_ENGINEER');
      if (!isAuthorized) {
        throw new ForbiddenError('Only the ECO author or authorized engineering leads can create a new revision');
      }

      // 4. Validate active revision status: strictly require CHANGES_REQUESTED
      const activeRev = eco.eco_revisions.find((r) => r.revision_number === eco.active_revision_no);
      if (!activeRev) {
        throw new AppError(`Active revision ${eco.active_revision_no} not found for ECO`, 404);
      }

      if (activeRev.status !== 'CHANGES_REQUESTED') {
        throw new AppError(
          `Cannot create revision: Current active revision ${eco.active_revision_no} has status '${activeRev.status}'. New revisions can only be created when changes are requested.`,
          400
        );
      }

      // 5. Calculate next revision number and prevent concurrent duplicates
      const nextRevNo = eco.active_revision_no + 1;
      const existingNext = eco.eco_revisions.find((r) => r.revision_number === nextRevNo);
      if (existingNext) {
        throw new ConflictError(`Revision ${nextRevNo} already exists for ECO '${eco.eco_number}'`);
      }

      // 6. Create new revision in DRAFT status
      const newRev = await tx.eCORevision.create({
        data: {
          eco_id: ecoId,
          revision_number: nextRevNo,
          change_summary: input.changeSummary || `Revision ${nextRevNo} - Addressing reviewer feedback`,
          status: 'DRAFT',
          created_by: userId,
        },
      });

      // 7. Clone previous revision's change items with new UUID identities
      const clonedChanges = [];
      for (const change of activeRev.changes) {
        const cloned = await tx.eCOChange.create({
          data: {
            id: randomUUID(),
            eco_id: ecoId,
            revision_number: nextRevNo,
            change_type: change.change_type,
            change_target: change.change_target,
            field_name: change.field_name,
            old_value: change.old_value,
            new_value: change.new_value,
            impact_type: change.impact_type,
            justification: change.justification,
          },
        });
        clonedChanges.push(cloned);
      }

      // 8. Atomically update ECO active revision pointer and status
      const updatedEco = await tx.eCO.update({
        where: { id: ecoId },
        data: {
          active_revision_no: nextRevNo,
          status: 'DRAFT',
        },
      });

      // 9. Record structured audit event
      await AuditService.log(
        {
          userId,
          action: 'ECO_REVISION_CREATED',
          entityType: 'ECO',
          entityId: ecoId,
          newValues: {
            previousRevision: activeRev.revision_number,
            newRevision: nextRevNo,
            clonedChangesCount: clonedChanges.length,
            changeSummary: newRev.change_summary,
          },
        },
        tx
      );

      return {
        eco: updatedEco,
        revision: {
          ...newRev,
          changes: clonedChanges,
        },
      };
    });
  }

  public static async updateChange(
    ecoId: string,
    changeId: string,
    input: UpdateChangeInput,
    userId: string,
    userRoles: string[] = []
  ) {
    const eco = await prisma.eCO.findUnique({ where: { id: ecoId } });
    if (!eco) throw new NotFoundError('ECO', ecoId);

    if (eco.status !== 'DRAFT') {
      throw new AppError(
        `Cannot modify change item: ECO is in '${eco.status}' status. Only DRAFT revisions can be modified.`,
        400
      );
    }

    const isAuthorized =
      eco.created_by === userId ||
      userRoles.includes('ADMINISTRATOR') ||
      userRoles.includes('LEAD_ENGINEER');
    if (!isAuthorized) {
      throw new ForbiddenError('You are not authorized to edit changes on this ECO');
    }

    const change = await prisma.eCOChange.findUnique({ where: { id: changeId } });
    if (!change) throw new NotFoundError('ECOChange', changeId);

    if (change.eco_id !== ecoId) {
      throw new AppError(`Change item '${changeId}' does not belong to ECO '${ecoId}'`, 400);
    }

    if (change.revision_number !== eco.active_revision_no) {
      throw new AppError(
        `Cannot modify change item from historical revision ${change.revision_number}. Active revision is ${eco.active_revision_no}.`,
        400
      );
    }

    const updated = await prisma.eCOChange.update({
      where: { id: changeId },
      data: {
        ...(input.changeType && { change_type: input.changeType as any }),
        ...(input.changeTarget && { change_target: input.changeTarget as any }),
        ...(input.fieldName !== undefined && { field_name: input.fieldName }),
        ...(input.oldValue !== undefined && { old_value: input.oldValue }),
        ...(input.newValue !== undefined && { new_value: input.newValue }),
        ...(input.impactType && { impact_type: input.impactType as any }),
        ...(input.justification !== undefined && { justification: input.justification }),
      },
    });

    await AuditService.log({
      userId,
      action: 'ECO_CHANGE_UPDATED',
      entityType: 'ECOChange',
      entityId: changeId,
      oldValues: {
        changeType: change.change_type,
        changeTarget: change.change_target,
        fieldName: change.field_name,
        oldValue: change.old_value,
        newValue: change.new_value,
      },
      newValues: input,
    });

    return updated;
  }

  public static async removeChange(
    ecoId: string,
    changeId: string,
    userId: string,
    userRoles: string[] = []
  ) {
    const eco = await prisma.eCO.findUnique({ where: { id: ecoId } });
    if (!eco) throw new NotFoundError('ECO', ecoId);

    if (eco.status !== 'DRAFT') {
      throw new AppError(
        `Cannot delete change item: ECO is in '${eco.status}' status. Only DRAFT revisions can be modified.`,
        400
      );
    }

    const isAuthorized =
      eco.created_by === userId ||
      userRoles.includes('ADMINISTRATOR') ||
      userRoles.includes('LEAD_ENGINEER');
    if (!isAuthorized) {
      throw new ForbiddenError('You are not authorized to delete changes on this ECO');
    }

    const change = await prisma.eCOChange.findUnique({ where: { id: changeId } });
    if (!change) throw new NotFoundError('ECOChange', changeId);

    if (change.eco_id !== ecoId) {
      throw new AppError(`Change item '${changeId}' does not belong to ECO '${ecoId}'`, 400);
    }

    if (change.revision_number !== eco.active_revision_no) {
      throw new AppError(
        `Cannot delete change item from historical revision ${change.revision_number}. Active revision is ${eco.active_revision_no}.`,
        400
      );
    }

    await prisma.eCOChange.delete({ where: { id: changeId } });

    await AuditService.log({
      userId,
      action: 'ECO_CHANGE_DELETED',
      entityType: 'ECOChange',
      entityId: changeId,
      oldValues: {
        ecoId,
        revisionNumber: change.revision_number,
        changeType: change.change_type,
        fieldName: change.field_name,
      },
    });

    return { id: changeId, deleted: true };
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

    // Validate that all referenced sub-assemblies have an eligible released version
    for (const comp of eco.bom.components) {
      if (comp.sub_assembly_bom_id) {
        const childVersions = await prisma.bOMVersion.findMany({
          where: { bom_id: comp.sub_assembly_bom_id },
        });
        if (childVersions.length === 0) {
          throw new AppError(
            `Cannot submit ECO: Referenced sub-assembly component '${comp.part_number}' (BOM: ${comp.sub_assembly_bom_id}) has no released version. Release child BOM first.`,
            400
          );
        }
        if (comp.sub_assembly_version) {
          const match = childVersions.find((v) => v.version_number === comp.sub_assembly_version);
          if (!match) {
            throw new AppError(
              `Cannot submit ECO: Pinned version ${comp.sub_assembly_version} for component '${comp.part_number}' does not exist or is not released.`,
              400
            );
          }
        }
      }
    }

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

        // 1. Build deep frozen snapshot of components with exact resolved sub-assembly versions
        const frozenComponents = await Promise.all(
          eco.bom.components.map(async (c) => {
            let subSnapshot = null;
            let resolvedVersion = c.sub_assembly_version;

            if (c.sub_assembly_bom_id) {
              const childVersions = await tx.bOMVersion.findMany({
                where: { bom_id: c.sub_assembly_bom_id },
                orderBy: { version_number: 'desc' },
              });
              if (childVersions.length === 0) {
                throw new AppError(
                  `Cannot release ECO: Referenced sub-assembly component '${c.part_number}' (BOM: ${c.sub_assembly_bom_id}) has no released version. Release child BOM first.`,
                  400
                );
              }

              let targetChildVer = childVersions[0];
              if (c.sub_assembly_version) {
                const match = childVersions.find((v) => v.version_number === c.sub_assembly_version);
                if (!match) {
                  throw new AppError(
                    `Cannot release ECO: Pinned version ${c.sub_assembly_version} for component '${c.part_number}' does not exist or is not released.`,
                    400
                  );
                }
                targetChildVer = match;
              } else {
                resolvedVersion = targetChildVer.version_number;
              }

              const childSnap = targetChildVer.snapshot_data as any;
              subSnapshot = {
                bom_id: targetChildVer.bom_id,
                bom_number: childSnap?.bom?.bom_number || 'UNKNOWN',
                version_number: targetChildVer.version_number,
                components: childSnap?.components || [],
              };
            }

            return {
              id: c.id,
              part_number: c.part_number,
              name: c.name,
              component_type: c.component_type,
              quantity: c.quantity.toString(),
              unit_of_measure: c.unit_of_measure,
              unit_cost: c.unit_cost.toString(),
              total_cost: c.total_cost.toString(),
              sub_assembly_bom_id: c.sub_assembly_bom_id,
              sub_assembly_version: resolvedVersion,
              is_cost_overridden: c.is_cost_overridden,
              cost_override_reason: c.cost_override_reason,
              sub_assembly: subSnapshot,
            };
          })
        );

        // 2. Persist resolved version pins if any dynamic references existed
        for (const comp of frozenComponents) {
          if (comp.sub_assembly_bom_id && comp.sub_assembly_version) {
            await tx.bOMComponent.update({
              where: { id: comp.id },
              data: { sub_assembly_version: comp.sub_assembly_version },
            });
          }
        }

        const bomSnapshotData = {
          bom: {
            id: eco.bom.id,
            bom_number: eco.bom.bom_number,
            version_number: nextBomVer,
          },
          product: {
            id: eco.product.id,
            part_number: eco.product.part_number,
            name: eco.product.name,
          },
          components: frozenComponents,
          released_at: new Date().toISOString(),
          released_by: userId,
        };

        const bomVersion = await tx.bOMVersion.create({
          data: {
            id: randomUUID(),
            bom_id: eco.bom_id,
            product_id: eco.product_id,
            eco_id: eco.id,
            revision_number: eco.active_revision_no,
            version_number: nextBomVer,
            snapshot_data: bomSnapshotData,
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
