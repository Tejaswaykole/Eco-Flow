import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError, AppError } from '../../utils/errors.js';
import {
  GenerateECNInput,
  IssueECNInput,
  CompleteECNInput,
  CancelECNInput,
  AcknowledgeDistributionInput,
  CreateMaterialDispositionInput,
} from './ecn.schema.js';
import { AuditService } from '../../services/audit.service.js';
import { TokenPayload } from '../../services/security.service.js';
import { randomUUID } from 'crypto';
import crypto from 'crypto';

export class ECNService {
  /**
   * Generates a readable, unique human-friendly ECN identifier:
   * ECN-YYYYMMDD-XXXX (e.g. ECN-20261111-B4A1)
   */
  private static generateECNNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `ECN-${today}-${suffix}`;
  }

  /**
   * Generate an ECN from an approved and released ECO
   */
  public static async generateECN(ecoId: string, input: GenerateECNInput, userId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Concurrency guard using PostgreSQL advisory lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4200000001004);`;

      // 2. Fetch ECO with release context
      const eco = await tx.eCO.findUnique({
        where: { id: ecoId },
        include: {
          product: true,
          bom: true,
          version_releases: {
            where: { release_status: 'RELEASED' },
            include: { product_version: true, bom_version: true },
          },
          ecn: true,
        },
      });

      if (!eco) throw new NotFoundError('ECO', ecoId);

      // 3. Status Invariant: ECO must be APPROVED / RELEASED
      if (eco.status !== 'APPROVED') {
        throw new ConflictError(`Cannot generate an ECN for an unreleased ECO (current status: ${eco.status})`);
      }

      if (!eco.version_releases || eco.version_releases.length === 0) {
        throw new ConflictError('No released version record found for this ECO');
      }

      const release = eco.version_releases[0];

      // 4. Duplicate ECN Prevention
      if (eco.ecn) {
        throw new ConflictError(`An ECN has already been generated for ECO '${eco.eco_number}' (ECN: ${eco.ecn.ecn_number})`);
      }

      const existingEcnForRelease = await tx.eCN.findFirst({
        where: { version_release_id: release.id },
      });
      if (existingEcnForRelease) {
        throw new ConflictError(`An ECN already exists for VersionRelease '${release.id}'`);
      }

      // 5. Generate unique ECN number & fields
      const ecnId = randomUUID();
      const ecnNumber = this.generateECNNumber();
      const title = `[ECN] ${eco.title}`;
      const changeSummary = input.changeSummary || eco.description || `Engineering change notice for ${eco.product.name}`;
      const reasonForChange = input.reasonForChange || null;
      const effectiveDate = new Date(input.effectiveDate);

      // 6. Create ECN Record in DRAFT status
      const createdEcn = await tx.eCN.create({
        data: {
          id: ecnId,
          ecn_number: ecnNumber,
          eco_id: eco.id,
          version_release_id: release.id,
          title: title.slice(0, 255),
          change_summary: changeSummary,
          reason_for_change: reasonForChange,
          effective_date: effectiveDate,
          status: 'DRAFT',
          created_by: userId,
        },
      });

      // 7. Create Target Department Distribution Records
      const uniqueDepartments = Array.from(new Set(input.targetDepartments));
      for (const dept of uniqueDepartments) {
        await tx.eCNDistribution.create({
          data: {
            id: randomUUID(),
            ecn_id: ecnId,
            department: dept as any,
            acknowledgement_status: 'PENDING',
          },
        });
      }

      // 8. Create Initial Material Dispositions if supplied
      if (input.initialDispositions && input.initialDispositions.length > 0) {
        for (const disp of input.initialDispositions) {
          await tx.eCNMaterialDisposition.create({
            data: {
              id: randomUUID(),
              ecn_id: ecnId,
              product_id: disp.productId || eco.product_id,
              part_number: disp.partNumber || null,
              disposition_type: disp.dispositionType as any,
              quantity: disp.quantity || null,
              instructions: disp.instructions,
              responsible_department: disp.responsibleDepartment as any,
              created_by: userId,
            },
          });
        }
      }

      // 9. Record Audit Log
      await AuditService.log(
        {
          userId,
          action: 'ECN_GENERATED',
          entityType: 'ECN',
          entityId: ecnId,
          newValues: {
            ecnNumber,
            ecoId: eco.id,
            versionReleaseId: release.id,
            targetDepartments: uniqueDepartments,
          },
        },
        tx
      );

      // 10. Return fresh ECN with full relations
      return await tx.eCN.findUnique({
        where: { id: ecnId },
        include: {
          eco: { select: { id: true, eco_number: true, title: true, status: true } },
          version_release: {
            include: {
              product_version: true,
              bom_version: true,
              product: { select: { id: true, name: true, part_number: true } },
            },
          },
          distributions: true,
          dispositions: true,
          creator: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      });
    });
  }

  /**
   * List ECNs with filtering and pagination
   */
  public static async listECNs(
    params: {
      page?: number;
      limit?: number;
      status?: string;
      department?: string;
      search?: string;
    },
    _user: TokenPayload
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.status) {
      where.status = params.status as any;
    }

    if (params.department) {
      where.distributions = {
        some: { department: params.department as any },
      };
    }

    if (params.search) {
      const term = params.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { ecn_number: { contains: term, mode: 'insensitive' } },
        { eco: { eco_number: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [ecns, total] = await Promise.all([
      prisma.eCN.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          eco: {
            select: {
              id: true,
              eco_number: true,
              title: true,
              status: true,
              product: { select: { id: true, name: true, part_number: true } },
            },
          },
          version_release: {
            include: {
              product_version: { select: { id: true, version_number: true } },
              bom_version: { select: { id: true, version_number: true } },
            },
          },
          creator: { select: { id: true, first_name: true, last_name: true, email: true } },
          issuer: { select: { id: true, first_name: true, last_name: true, email: true } },
          distributions: true,
          dispositions: true,
        },
      }),
      prisma.eCN.count({ where }),
    ]);

    return {
      ecns,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ECN by ID with all relations
   */
  public static async getECNById(id: string, _user: TokenPayload) {
    const ecn = await prisma.eCN.findUnique({
      where: { id },
      include: {
        eco: {
          include: {
            product: true,
            bom: true,
            creator: { select: { id: true, first_name: true, last_name: true, email: true } },
            originating_ecr: { select: { id: true, ecr_number: true, title: true } },
          },
        },
        version_release: {
          include: {
            product_version: true,
            bom_version: true,
            product: true,
            releaser: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
        },
        creator: { select: { id: true, first_name: true, last_name: true, email: true } },
        issuer: { select: { id: true, first_name: true, last_name: true, email: true } },
        distributions: {
          include: {
            assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
            acknowledger: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
          orderBy: { department: 'asc' },
        },
        dispositions: {
          include: {
            product: { select: { id: true, name: true, part_number: true } },
            creator: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!ecn) throw new NotFoundError('Engineering Change Notice', id);
    return ecn;
  }

  /**
   * Issue ECN to target departments (DRAFT -> ISSUED)
   */
  public static async issueECN(id: string, input: IssueECNInput, userId: string) {
    const ecn = await prisma.eCN.findUnique({
      where: { id },
      include: { distributions: true },
    });

    if (!ecn) throw new NotFoundError('Engineering Change Notice', id);

    if (ecn.status !== 'DRAFT') {
      throw new ConflictError(`Only DRAFT change notices can be issued (current status: ${ecn.status})`);
    }

    if (!ecn.distributions || ecn.distributions.length === 0) {
      if (!input.targetDepartments || input.targetDepartments.length === 0) {
        throw new ConflictError('At least one target distribution department is required before issuing an ECN');
      }
    }

    const effectiveDate = input.effectiveDate ? new Date(input.effectiveDate) : ecn.effective_date;

    return await prisma.$transaction(async (tx) => {
      // Add any additional departments passed in payload
      if (input.targetDepartments && input.targetDepartments.length > 0) {
        for (const dept of input.targetDepartments) {
          const exists = ecn.distributions.some((d) => d.department === dept);
          if (!exists) {
            await tx.eCNDistribution.create({
              data: {
                id: randomUUID(),
                ecn_id: id,
                department: dept as any,
                acknowledgement_status: 'PENDING',
              },
            });
          }
        }
      }

      const updated = await tx.eCN.update({
        where: { id },
        data: {
          status: 'ISSUED',
          effective_date: effectiveDate,
          issued_by: userId,
          issued_at: new Date(),
        },
        include: {
          distributions: true,
          dispositions: true,
          eco: { select: { id: true, eco_number: true, title: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECN_ISSUED',
          entityType: 'ECN',
          entityId: id,
          oldValues: { status: 'DRAFT' },
          newValues: { status: 'ISSUED', issuedAt: updated.issued_at, effectiveDate },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Complete an ECN (ISSUED -> COMPLETED)
   */
  public static async completeECN(id: string, _input: CompleteECNInput, userId: string) {
    const ecn = await prisma.eCN.findUnique({
      where: { id },
      include: { distributions: true },
    });

    if (!ecn) throw new NotFoundError('Engineering Change Notice', id);

    if (ecn.status !== 'ISSUED') {
      throw new ConflictError(`Only ISSUED change notices can be marked COMPLETED (current status: ${ecn.status})`);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.eCN.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
        },
        include: {
          distributions: true,
          dispositions: true,
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECN_COMPLETED',
          entityType: 'ECN',
          entityId: id,
          oldValues: { status: 'ISSUED' },
          newValues: { status: 'COMPLETED', completedAt: updated.completed_at },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Cancel a DRAFT ECN (DRAFT -> CANCELLED)
   * Cancellation of an issued ECN is strictly prohibited.
   */
  public static async cancelECN(id: string, input: CancelECNInput, userId: string) {
    const ecn = await prisma.eCN.findUnique({ where: { id } });
    if (!ecn) throw new NotFoundError('Engineering Change Notice', id);

    if (ecn.status !== 'DRAFT') {
      throw new ConflictError(`Cannot cancel an ECN that has already been issued or completed (current status: ${ecn.status})`);
    }

    if (!input.cancellationReason || !input.cancellationReason.trim()) {
      throw new ConflictError('A non-empty cancellation reason is mandatory');
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.eCN.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelled_at: new Date(),
          cancellation_reason: input.cancellationReason,
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECN_CANCELLED',
          entityType: 'ECN',
          entityId: id,
          oldValues: { status: 'DRAFT' },
          newValues: { status: 'CANCELLED', cancellationReason: input.cancellationReason },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Acknowledge distribution receipt for a department
   */
  public static async acknowledgeDistribution(
    ecnId: string,
    distributionId: string,
    input: AcknowledgeDistributionInput,
    userId: string,
    user: TokenPayload
  ) {
    const ecn = await prisma.eCN.findUnique({
      where: { id: ecnId },
      include: { distributions: true },
    });

    if (!ecn) throw new NotFoundError('Engineering Change Notice', ecnId);

    if (ecn.status !== 'ISSUED') {
      throw new ConflictError(`Department acknowledgement is only valid for ISSUED change notices (current status: ${ecn.status})`);
    }

    const dist = ecn.distributions.find((d) => d.id === distributionId);
    if (!dist) throw new NotFoundError('ECN Distribution Record', distributionId);

    if (dist.acknowledgement_status === 'ACKNOWLEDGED') {
      throw new ConflictError(`Department '${dist.department}' distribution has already been acknowledged`);
    }

    // Permission check: Assigned user, authorized department lead/engineer, or admin
    const isAuthorized =
      dist.assigned_to === userId ||
      user.roles.includes('ADMINISTRATOR') ||
      user.roles.includes('LEAD_ENGINEER') ||
      user.roles.includes('APPROVER') ||
      user.permissions.includes('ecn:acknowledge') ||
      user.permissions.includes('admin:all');

    if (!isAuthorized) {
      throw new ForbiddenError(`You do not have authorization to acknowledge the '${dist.department}' distribution`);
    }

    return await prisma.$transaction(async (tx) => {
      const updatedDist = await tx.eCNDistribution.update({
        where: { id: distributionId },
        data: {
          acknowledgement_status: 'ACKNOWLEDGED',
          acknowledged_by: userId,
          acknowledged_at: new Date(),
          comments: input.comments || null,
        },
        include: {
          acknowledger: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECN_DISTRIBUTION_ACKNOWLEDGED',
          entityType: 'ECN',
          entityId: ecnId,
          newValues: {
            distributionId,
            department: dist.department,
            acknowledgedAt: updatedDist.acknowledged_at,
            comments: input.comments,
          },
        },
        tx
      );

      return updatedDist;
    });
  }

  /**
   * Add a material disposition to an ECN
   */
  public static async addMaterialDisposition(
    ecnId: string,
    input: CreateMaterialDispositionInput,
    userId: string
  ) {
    const ecn = await prisma.eCN.findUnique({ where: { id: ecnId } });
    if (!ecn) throw new NotFoundError('Engineering Change Notice', ecnId);

    if (ecn.status === 'CANCELLED') {
      throw new ConflictError('Cannot add material dispositions to a cancelled ECN');
    }

    const dispositionId = randomUUID();

    return await prisma.$transaction(async (tx) => {
      const disposition = await tx.eCNMaterialDisposition.create({
        data: {
          id: dispositionId,
          ecn_id: ecnId,
          product_id: input.productId || null,
          part_number: input.partNumber || null,
          disposition_type: input.dispositionType as any,
          quantity: input.quantity || null,
          instructions: input.instructions,
          responsible_department: input.responsibleDepartment as any,
          created_by: userId,
        },
        include: {
          product: { select: { id: true, name: true, part_number: true } },
          creator: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECN_DISPOSITION_CREATED',
          entityType: 'ECN',
          entityId: ecnId,
          newValues: {
            dispositionId,
            dispositionType: input.dispositionType,
            responsibleDepartment: input.responsibleDepartment,
          },
        },
        tx
      );

      return disposition;
    });
  }
}

