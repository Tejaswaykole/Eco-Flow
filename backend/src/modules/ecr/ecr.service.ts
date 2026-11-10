import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors.js';
import {
  CreateECRInput,
  AssignECRInput,
  StartReviewECRInput,
  RequestInfoECRInput,
  ResubmitECRInput,
  AcceptECRInput,
  RejectECRInput,
  PromoteECRInput,
} from './ecr.schema.js';
import { AuditService } from '../../services/audit.service.js';
import { TokenPayload } from '../../services/security.service.js';
import { randomUUID } from 'crypto';
import crypto from 'crypto';

export class ECRService {
  /**
   * Generates a readable, unique human-friendly ECR identifier:
   * ECR-YYYYMMDD-XXXX (e.g. ECR-20261110-A1B2)
   */
  private static generateECRNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `ECR-${today}-${suffix}`;
  }

  /**
   * Submit a new Engineering Change Request
   */
  public static async createECR(input: CreateECRInput, userId: string) {
    if (input.productId) {
      const product = await prisma.product.findUnique({
        where: { id: input.productId },
      });
      if (!product) throw new NotFoundError('Product', input.productId);
    }

    if (input.bomId) {
      const bomWhere: any = { id: input.bomId };
      if (input.productId) {
        bomWhere.product_id = input.productId;
      }
      const bom = await prisma.bOM.findFirst({ where: bomWhere });
      if (!bom) throw new NotFoundError('BOM', input.bomId);
    }

    const ecrId = randomUUID();
    const ecrNumber = this.generateECRNumber();

    return await prisma.$transaction(async (tx) => {
      const ecr = await tx.eCR.create({
        data: {
          id: ecrId,
          ecr_number: ecrNumber,
          title: input.title,
          description: input.description,
          request_type: input.requestType as any,
          priority: input.priority as any,
          status: 'SUBMITTED',
          product_id: input.productId || null,
          bom_id: input.bomId || null,
          affected_part_number: input.affectedPartNumber || null,
          suggested_solution: input.suggestedSolution || null,
          submitted_by: userId,
        },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECR_CREATED',
          entityType: 'ECR',
          entityId: ecrId,
          newValues: { ecrNumber, title: input.title, requestType: input.requestType, priority: input.priority },
        },
        tx
      );

      return ecr;
    });
  }

  /**
   * List ECRs with filtering, pagination, search, and submitter role awareness
   */
  public static async listECRs(
    params: {
      page?: number;
      limit?: number;
      status?: string;
      requestType?: string;
      priority?: string;
      search?: string;
      myRequests?: boolean;
    },
    user: TokenPayload
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Submitter role scoping: Non-privileged users (like OPERATOR) only see their own submissions
    const isPrivileged =
      user.roles.includes('ADMINISTRATOR') ||
      user.roles.includes('LEAD_ENGINEER') ||
      user.roles.includes('APPROVER') ||
      user.permissions.includes('ecr:review') ||
      user.permissions.includes('admin:all');

    if (!isPrivileged || params.myRequests) {
      where.submitted_by = user.userId;
    }

    if (params.status) {
      where.status = params.status as any;
    }

    if (params.requestType) {
      where.request_type = params.requestType as any;
    }

    if (params.priority) {
      where.priority = params.priority as any;
    }

    if (params.search) {
      const term = params.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { ecr_number: { contains: term, mode: 'insensitive' } },
        { affected_part_number: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [ecrs, total] = await Promise.all([
      prisma.eCR.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
          promoted_eco: { select: { id: true, eco_number: true, status: true } },
        },
      }),
      prisma.eCR.count({ where }),
    ]);

    return {
      ecrs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ECR detail by ID with visibility checks
   */
  public static async getECRById(id: string, user: TokenPayload) {
    const ecr = await prisma.eCR.findUnique({
      where: { id },
      include: {
        submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
        assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
        product: { select: { id: true, name: true, part_number: true } },
        bom: { select: { id: true, bom_number: true } },
        promoted_eco: {
          select: {
            id: true,
            eco_number: true,
            title: true,
            status: true,
            active_revision_no: true,
            created_at: true,
          },
        },
      },
    });

    if (!ecr) throw new NotFoundError('Engineering Change Request', id);

    const isPrivileged =
      user.roles.includes('ADMINISTRATOR') ||
      user.roles.includes('LEAD_ENGINEER') ||
      user.roles.includes('APPROVER') ||
      user.permissions.includes('ecr:review') ||
      user.permissions.includes('admin:all');

    if (!isPrivileged && ecr.submitted_by !== user.userId) {
      throw new ForbiddenError('You do not have permission to view this change request');
    }

    return ecr;
  }

  /**
   * Assign reviewer to an ECR
   */
  public static async assignECR(id: string, input: AssignECRInput, userId: string) {
    const ecr = await prisma.eCR.findUnique({ where: { id } });
    if (!ecr) throw new NotFoundError('Engineering Change Request', id);

    if (ecr.status === 'REJECTED' || ecr.status === 'PROMOTED') {
      throw new ConflictError(`Cannot reassign an ECR in terminal status: ${ecr.status}`);
    }

    const assignee = await prisma.user.findUnique({ where: { id: input.assignedTo } });
    if (!assignee) throw new NotFoundError('Assignee User', input.assignedTo);

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.eCR.update({
        where: { id },
        data: { assigned_to: input.assignedTo },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECR_ASSIGNED',
          entityType: 'ECR',
          entityId: id,
          oldValues: { assignedTo: ecr.assigned_to },
          newValues: { assignedTo: input.assignedTo },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Start reviewing an ECR (SUBMITTED -> UNDER_REVIEW)
   */
  public static async startReview(id: string, input: StartReviewECRInput, userId: string) {
    const ecr = await prisma.eCR.findUnique({ where: { id } });
    if (!ecr) throw new NotFoundError('Engineering Change Request', id);

    if (ecr.status !== 'SUBMITTED') {
      throw new ConflictError(`Can only start review on an ECR in SUBMITTED status (current: ${ecr.status})`);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.eCR.update({
        where: { id },
        data: {
          status: 'UNDER_REVIEW',
          reviewed_at: new Date(),
          assigned_to: ecr.assigned_to || userId,
          review_comments: input.comments ?? ecr.review_comments,
        },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECR_REVIEW_STARTED',
          entityType: 'ECR',
          entityId: id,
          oldValues: { status: 'SUBMITTED' },
          newValues: { status: 'UNDER_REVIEW', comments: input.comments },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Request more information from submitter (UNDER_REVIEW -> NEEDS_INFORMATION)
   */
  public static async requestInformation(id: string, input: RequestInfoECRInput, userId: string) {
    const ecr = await prisma.eCR.findUnique({ where: { id } });
    if (!ecr) throw new NotFoundError('Engineering Change Request', id);

    if (ecr.status !== 'UNDER_REVIEW') {
      throw new ConflictError(`Can only request information on an ECR in UNDER_REVIEW status (current: ${ecr.status})`);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.eCR.update({
        where: { id },
        data: {
          status: 'NEEDS_INFORMATION',
          reviewed_at: new Date(),
          review_comments: input.comments,
        },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECR_INFORMATION_REQUESTED',
          entityType: 'ECR',
          entityId: id,
          oldValues: { status: 'UNDER_REVIEW' },
          newValues: { status: 'NEEDS_INFORMATION', comments: input.comments },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Submitter responds to information request (NEEDS_INFORMATION -> UNDER_REVIEW)
   */
  public static async resubmitECR(id: string, input: ResubmitECRInput, userId: string, user: TokenPayload) {
    const ecr = await prisma.eCR.findUnique({ where: { id } });
    if (!ecr) throw new NotFoundError('Engineering Change Request', id);

    const isPrivileged =
      user.roles.includes('ADMINISTRATOR') || user.roles.includes('LEAD_ENGINEER');

    if (!isPrivileged && ecr.submitted_by !== userId) {
      throw new ForbiddenError('Only the original submitter or an administrator can respond to information requests');
    }

    if (ecr.status !== 'NEEDS_INFORMATION') {
      throw new ConflictError(`Can only resubmit an ECR in NEEDS_INFORMATION status (current: ${ecr.status})`);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.eCR.update({
        where: { id },
        data: {
          status: 'UNDER_REVIEW',
          description: input.description || ecr.description,
          suggested_solution: input.suggestedSolution ?? ecr.suggested_solution,
          review_comments: input.comments
            ? `${ecr.review_comments || ''}\n\n[Submitter Response (${new Date().toISOString()})]: ${input.comments}`.trim()
            : ecr.review_comments,
        },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECR_RESUBMITTED',
          entityType: 'ECR',
          entityId: id,
          oldValues: { status: 'NEEDS_INFORMATION' },
          newValues: { status: 'UNDER_REVIEW', comments: input.comments },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Accept an ECR (UNDER_REVIEW -> ACCEPTED)
   */
  public static async acceptECR(id: string, input: AcceptECRInput, userId: string) {
    const ecr = await prisma.eCR.findUnique({ where: { id } });
    if (!ecr) throw new NotFoundError('Engineering Change Request', id);

    if (ecr.status !== 'UNDER_REVIEW') {
      throw new ConflictError(`Can only accept an ECR in UNDER_REVIEW status (current: ${ecr.status})`);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.eCR.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          reviewed_at: new Date(),
          review_comments: input.reviewComments ?? ecr.review_comments,
        },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECR_ACCEPTED',
          entityType: 'ECR',
          entityId: id,
          oldValues: { status: 'UNDER_REVIEW' },
          newValues: { status: 'ACCEPTED', reviewComments: input.reviewComments },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Reject an ECR (SUBMITTED | UNDER_REVIEW -> REJECTED)
   * Mandatory rejection reason required.
   */
  public static async rejectECR(id: string, input: RejectECRInput, userId: string) {
    const ecr = await prisma.eCR.findUnique({ where: { id } });
    if (!ecr) throw new NotFoundError('Engineering Change Request', id);

    if (ecr.status !== 'SUBMITTED' && ecr.status !== 'UNDER_REVIEW') {
      throw new ConflictError(`Can only reject an ECR in SUBMITTED or UNDER_REVIEW status (current: ${ecr.status})`);
    }

    if (!input.rejectionReason || !input.rejectionReason.trim()) {
      throw new ConflictError('A non-empty rejection reason is mandatory to reject a change request');
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.eCR.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejection_reason: input.rejectionReason,
          reviewed_at: new Date(),
        },
        include: {
          submitter: { select: { id: true, first_name: true, last_name: true, email: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          product: { select: { id: true, name: true, part_number: true } },
          bom: { select: { id: true, bom_number: true } },
        },
      });

      await AuditService.log(
        {
          userId,
          action: 'ECR_REJECTED',
          entityType: 'ECR',
          entityId: id,
          oldValues: { status: ecr.status },
          newValues: { status: 'REJECTED', rejectionReason: input.rejectionReason },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Promote an ACCEPTED ECR to an ECO (ACCEPTED -> PROMOTED)
   * Transactional, concurrency-safe, duplicate-prevented.
   */
  public static async promoteToECO(id: string, input: PromoteECRInput, userId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Transactional advisory lock to prevent concurrent duplicate promotion attempts
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4200000001003);`;

      // 2. Fetch fresh ECR record within transaction
      const ecr = await tx.eCR.findUnique({
        where: { id },
        include: { product: true, bom: true, promoted_eco: true },
      });
      if (!ecr) throw new NotFoundError('Engineering Change Request', id);

      // 3. Status Invariant: Must be in ACCEPTED state
      if (ecr.status !== 'ACCEPTED') {
        throw new ConflictError(`Only ACCEPTED change requests can be promoted to an ECO (current status: ${ecr.status})`);
      }

      // 4. Duplicate Promotion Prevention: Check both ECR link and ECO link
      if (ecr.promoted_eco_id) {
        throw new ConflictError(`Change request ${ecr.ecr_number} has already been promoted to an ECO (ECO ID: ${ecr.promoted_eco_id})`);
      }

      // 5. Check uniqueness of proposed ECO number
      const existingEco = await tx.eCO.findFirst({
        where: { eco_number: input.ecoNumber },
      });
      if (existingEco) {
        throw new ConflictError(`ECO number '${input.ecoNumber}' already exists`);
      }

      // 6. Resolve Target Product and BOM
      const productId = input.productId || ecr.product_id;
      const bomId = input.bomId || ecr.bom_id;

      if (!productId || !bomId) {
        throw new ConflictError('A target product and BOM are required to generate an ECO from this change request');
      }

      const bom = await tx.bOM.findFirst({
        where: { id: bomId, product_id: productId },
      });
      if (!bom) {
        throw new NotFoundError('BOM associated with Product', `${bomId} / ${productId}`);
      }

      // 7. Initialize ECO with originating ECR link
      const ecoId = randomUUID();
      const ecoTitle = `[${ecr.ecr_number}] ${ecr.title}`;
      const ecoDescription = `Originating ECR: ${ecr.ecr_number}\nRequest Type: ${ecr.request_type}\nPriority: ${ecr.priority}\n\nProblem Description:\n${ecr.description}${
        ecr.affected_part_number ? `\nAffected Part: ${ecr.affected_part_number}` : ''
      }${ecr.suggested_solution ? `\n\nSuggested Solution:\n${ecr.suggested_solution}` : ''}${
        ecr.review_comments ? `\n\nReview Notes:\n${ecr.review_comments}` : ''
      }`;

      const eco = await tx.eCO.create({
        data: {
          id: ecoId,
          eco_number: input.ecoNumber,
          product_id: productId,
          bom_id: bomId,
          title: ecoTitle.slice(0, 255),
          description: ecoDescription,
          priority: ecr.priority,
          status: 'DRAFT',
          active_revision_no: 1,
          created_by: userId,
          ecr_id: ecr.id,
        },
      });

      // 8. Initialize Draft Revision 1
      const revision = await tx.eCORevision.create({
        data: {
          eco_id: ecoId,
          revision_number: 1,
          change_summary: input.changeSummary || `Initial draft revision promoted from ECR ${ecr.ecr_number}`,
          status: 'DRAFT',
          created_by: userId,
        },
      });

      // 9. Update ECR status to PROMOTED and link promoted_eco_id
      const updatedEcr = await tx.eCR.update({
        where: { id: ecr.id },
        data: {
          status: 'PROMOTED',
          promoted_eco_id: ecoId,
        },
      });

      // 10. Audit logging for both entities within the atomic transaction
      await AuditService.log(
        {
          userId,
          action: 'ECR_PROMOTED_TO_ECO',
          entityType: 'ECR',
          entityId: ecr.id,
          oldValues: { status: 'ACCEPTED' },
          newValues: { status: 'PROMOTED', promotedEcoId: ecoId, ecoNumber: input.ecoNumber },
        },
        tx
      );

      await AuditService.log(
        {
          userId,
          action: 'ECO_CREATED',
          entityType: 'ECO',
          entityId: ecoId,
          newValues: { ecoNumber: input.ecoNumber, title: ecoTitle, originatingEcrId: ecr.id },
        },
        tx
      );

      return {
        eco: { ...eco, activeRevision: revision },
        ecr: updatedEcr,
      };
    });
  }
}
