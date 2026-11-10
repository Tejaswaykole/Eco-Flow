import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ECRService } from '../src/modules/ecr/ecr.service.js';
import { prisma } from '../src/config/database.js';
import { AuditService } from '../src/services/audit.service.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../src/utils/errors.js';
import { TokenPayload } from '../src/services/security.service.js';

describe('Engineering Change Request (ECR) Module Test Suite (Milestone 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEcrId = 'ecr-1111-2222-3333-444444444444';
  const mockSubmitterId = 'user-operator-uuid-1';
  const mockReviewerId = 'user-engineer-uuid-2';
  const mockAdminId = 'user-admin-uuid-9';
  const mockProductId = 'prod-1111-2222-3333-444444444444';
  const mockBomId = 'bom-1111-2222-3333-444444444444';

  const operatorToken: TokenPayload = {
    userId: mockSubmitterId,
    email: 'operator@ecoflow.internal',
    sessionId: 'session-1',
    roles: ['OPERATOR'],
    permissions: ['ecr:create', 'ecr:read'],
  };

  const engineerToken: TokenPayload = {
    userId: mockReviewerId,
    email: 'engineer@ecoflow.internal',
    sessionId: 'session-2',
    roles: ['LEAD_ENGINEER'],
    permissions: ['ecr:create', 'ecr:read', 'ecr:review', 'ecr:decide', 'ecr:promote'],
  };

  const adminToken: TokenPayload = {
    userId: mockAdminId,
    email: 'admin@ecoflow.internal',
    sessionId: 'session-3',
    roles: ['ADMINISTRATOR'],
    permissions: ['admin:all'],
  };

  describe('1. ECR Submission & Validation', () => {
    it('TC-ECR-01: Successfully creates an ECR with generated ecr_number and SUBMITTED status', async () => {
      vi.spyOn(prisma.product, 'findUnique').mockResolvedValue({ id: mockProductId } as any);
      vi.spyOn(prisma.bOM, 'findFirst').mockResolvedValue({ id: mockBomId, product_id: mockProductId } as any);

      const mockCreated = {
        id: mockEcrId,
        ecr_number: 'ECR-20261110-A1B2',
        title: 'Chassis bolt clearance interference',
        description: 'Encountered interference during Station 4 sub-assembly mounting',
        request_type: 'DEFECT',
        priority: 'HIGH',
        status: 'SUBMITTED',
        product_id: mockProductId,
        bom_id: mockBomId,
        affected_part_number: 'BRK-402',
        suggested_solution: 'Increase counterbore depth by 0.5mm',
        submitted_by: mockSubmitterId,
        submitter: { id: mockSubmitterId, first_name: 'John', last_name: 'Operator', email: 'op@ecoflow.internal' },
        product: { id: mockProductId, name: 'Chassis', part_number: 'CHS-01' },
        bom: { id: mockBomId, bom_number: 'BOM-CHS-01' },
      };

      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);
      const txMock = {
        eCR: {
          create: vi.fn().mockResolvedValue(mockCreated),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb(txMock);
      });

      const result = await ECRService.createECR(
        {
          title: 'Chassis bolt clearance interference',
          description: 'Encountered interference during Station 4 sub-assembly mounting',
          requestType: 'DEFECT',
          priority: 'HIGH',
          productId: mockProductId,
          bomId: mockBomId,
          affectedPartNumber: 'BRK-402',
          suggestedSolution: 'Increase counterbore depth by 0.5mm',
        },
        mockSubmitterId
      );

      expect(result.status).toBe('SUBMITTED');
      expect(txMock.eCR.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Chassis bolt clearance interference',
            status: 'SUBMITTED',
            submitted_by: mockSubmitterId,
          }),
        })
      );
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECR_CREATED',
          entityType: 'ECR',
          entityId: expect.any(String),
        }),
        txMock
      );
    });

    it('TC-ECR-02: Throws NotFoundError when referenced product or BOM does not exist', async () => {
      vi.spyOn(prisma.product, 'findUnique').mockResolvedValue(null);

      await expect(
        ECRService.createECR(
          {
            title: 'Invalid product test',
            description: 'Testing product validation failure',
            requestType: 'DEFECT',
            productId: 'non-existent-product-id',
          },
          mockSubmitterId
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('2. Visibility & Query Scoping', () => {
    it('TC-ECR-03: Operators only see their own submissions; Reviewers see all', async () => {
      const findManySpy = vi.spyOn(prisma.eCR, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.eCR, 'count').mockResolvedValue(0);

      // Operator query: restricted to submitted_by
      await ECRService.listECRs({ page: 1, limit: 10 }, operatorToken);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ submitted_by: mockSubmitterId }),
        })
      );

      // Engineer query: unrestricted
      findManySpy.mockClear();
      await ECRService.listECRs({ page: 1, limit: 10 }, engineerToken);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ submitted_by: mockSubmitterId }),
        })
      );
    });

    it('TC-ECR-04: Operator is forbidden from viewing other users private ECRs', async () => {
      vi.spyOn(prisma.eCR, 'findUnique').mockResolvedValue({
        id: mockEcrId,
        submitted_by: 'another-user-uuid',
      } as any);

      await expect(ECRService.getECRById(mockEcrId, operatorToken)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('3. Status Lifecycle State Machine', () => {
    it('TC-ECR-05: Valid transition: SUBMITTED -> UNDER_REVIEW (startReview)', async () => {
      const mockEcr = {
        id: mockEcrId,
        status: 'SUBMITTED',
        assigned_to: null,
      };

      vi.spyOn(prisma.eCR, 'findUnique').mockResolvedValue(mockEcr as any);
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const txMock = {
        eCR: {
          update: vi.fn().mockResolvedValue({
            ...mockEcr,
            status: 'UNDER_REVIEW',
            assigned_to: mockReviewerId,
          }),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      const updated = await ECRService.startReview(mockEcrId, { comments: 'Starting line review' }, mockReviewerId);

      expect(updated.status).toBe('UNDER_REVIEW');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECR_REVIEW_STARTED',
          oldValues: { status: 'SUBMITTED' },
          newValues: expect.objectContaining({ status: 'UNDER_REVIEW' }),
        }),
        txMock
      );
    });

    it('TC-ECR-06: Valid transition: UNDER_REVIEW -> NEEDS_INFORMATION (requestInformation)', async () => {
      const mockEcr = {
        id: mockEcrId,
        status: 'UNDER_REVIEW',
      };

      vi.spyOn(prisma.eCR, 'findUnique').mockResolvedValue(mockEcr as any);
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const txMock = {
        eCR: {
          update: vi.fn().mockResolvedValue({
            ...mockEcr,
            status: 'NEEDS_INFORMATION',
            review_comments: 'Please verify torque reading on Station 4',
          }),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      const updated = await ECRService.requestInformation(
        mockEcrId,
        { comments: 'Please verify torque reading on Station 4' },
        mockReviewerId
      );

      expect(updated.status).toBe('NEEDS_INFORMATION');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECR_INFORMATION_REQUESTED',
          newValues: expect.objectContaining({ status: 'NEEDS_INFORMATION' }),
        }),
        txMock
      );
    });

    it('TC-ECR-07: Valid transition: NEEDS_INFORMATION -> UNDER_REVIEW (resubmitECR)', async () => {
      const mockEcr = {
        id: mockEcrId,
        status: 'NEEDS_INFORMATION',
        submitted_by: mockSubmitterId,
        description: 'Original description',
      };

      vi.spyOn(prisma.eCR, 'findUnique').mockResolvedValue(mockEcr as any);
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const txMock = {
        eCR: {
          update: vi.fn().mockResolvedValue({
            ...mockEcr,
            status: 'UNDER_REVIEW',
            description: 'Updated with torque reading 35Nm',
          }),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      const updated = await ECRService.resubmitECR(
        mockEcrId,
        { comments: 'Verified 35Nm torque reading', description: 'Updated with torque reading 35Nm' },
        mockSubmitterId,
        operatorToken
      );

      expect(updated.status).toBe('UNDER_REVIEW');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECR_RESUBMITTED',
          oldValues: { status: 'NEEDS_INFORMATION' },
          newValues: expect.objectContaining({ status: 'UNDER_REVIEW' }),
        }),
        txMock
      );
    });

    it('TC-ECR-08: Valid transition: UNDER_REVIEW -> ACCEPTED (acceptECR)', async () => {
      const mockEcr = {
        id: mockEcrId,
        status: 'UNDER_REVIEW',
      };

      vi.spyOn(prisma.eCR, 'findUnique').mockResolvedValue(mockEcr as any);
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const txMock = {
        eCR: {
          update: vi.fn().mockResolvedValue({
            ...mockEcr,
            status: 'ACCEPTED',
          }),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      const updated = await ECRService.acceptECR(mockEcrId, { reviewComments: 'Approved for ECO promotion' }, mockReviewerId);

      expect(updated.status).toBe('ACCEPTED');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECR_ACCEPTED',
          newValues: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
        txMock
      );
    });

    it('TC-ECR-09: Valid transition: SUBMITTED or UNDER_REVIEW -> REJECTED requires mandatory rejection reason', async () => {
      const mockEcr = {
        id: mockEcrId,
        status: 'UNDER_REVIEW',
      };

      vi.spyOn(prisma.eCR, 'findUnique').mockResolvedValue(mockEcr as any);

      // Missing or empty rejection reason throws ConflictError
      await expect(
        ECRService.rejectECR(mockEcrId, { rejectionReason: '   ' }, mockReviewerId)
      ).rejects.toThrow(ConflictError);

      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);
      const txMock = {
        eCR: {
          update: vi.fn().mockResolvedValue({
            ...mockEcr,
            status: 'REJECTED',
            rejection_reason: 'Outside allowable tolerance specs',
          }),
        },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      const updated = await ECRService.rejectECR(
        mockEcrId,
        { rejectionReason: 'Outside allowable tolerance specs' },
        mockReviewerId
      );

      expect(updated.status).toBe('REJECTED');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECR_REJECTED',
          newValues: expect.objectContaining({ status: 'REJECTED' }),
        }),
        txMock
      );
    });

    it('TC-ECR-10: Rejects invalid transitions and forbids mutating terminal states', async () => {
      // Cannot accept a SUBMITTED ECR without UNDER_REVIEW
      vi.spyOn(prisma.eCR, 'findUnique').mockResolvedValue({
        id: mockEcrId,
        status: 'SUBMITTED',
      } as any);

      await expect(ECRService.acceptECR(mockEcrId, {}, mockReviewerId)).rejects.toThrow(ConflictError);

      // Cannot modify terminal REJECTED ECR
      vi.spyOn(prisma.eCR, 'findUnique').mockResolvedValue({
        id: mockEcrId,
        status: 'REJECTED',
      } as any);

      await expect(
        ECRService.assignECR(mockEcrId, { assignedTo: mockReviewerId }, mockReviewerId)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('4. ECR-to-ECO Promotion & Concurrency Safety', () => {
    it('TC-ECR-11: Successfully promotes ACCEPTED ECR to ECO with atomic linking and advisory lock', async () => {
      const mockEcr = {
        id: mockEcrId,
        ecr_number: 'ECR-20261110-A1B2',
        title: 'Chassis bolt clearance interference',
        description: 'Interference encountered at Station 4',
        request_type: 'DEFECT',
        priority: 'HIGH',
        status: 'ACCEPTED',
        product_id: mockProductId,
        bom_id: mockBomId,
        promoted_eco_id: null,
      };

      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        eCR: {
          findUnique: vi.fn().mockResolvedValue(mockEcr),
          update: vi.fn().mockImplementation(({ data }: any) => ({ ...mockEcr, ...data })),
        },
        eCO: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }: any) => ({ ...data })),
        },
        bOM: {
          findFirst: vi.fn().mockResolvedValue({ id: mockBomId, product_id: mockProductId }),
        },
        eCORevision: {
          create: vi.fn().mockImplementation(({ data }: any) => ({ ...data })),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      const result = await ECRService.promoteToECO(
        mockEcrId,
        {
          ecoNumber: 'ECO-20261110-0001',
          changeSummary: 'Implementing clearance fix from ECR',
        },
        mockReviewerId
      );

      // Verify advisory lock was acquired with code 4200000001003
      expect(txMock.$executeRaw).toHaveBeenCalled();

      // Verify ECO created with ecr_id reference
      expect(txMock.eCO.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eco_number: 'ECO-20261110-0001',
            product_id: mockProductId,
            bom_id: mockBomId,
            status: 'DRAFT',
            ecr_id: mockEcrId,
            created_by: mockReviewerId,
          }),
        })
      );

      // Verify initial revision 1 created in DRAFT
      expect(txMock.eCORevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            revision_number: 1,
            status: 'DRAFT',
            created_by: mockReviewerId,
          }),
        })
      );

      // Verify ECR transitioned to PROMOTED with promoted_eco_id
      expect(txMock.eCR.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockEcrId },
          data: expect.objectContaining({
            status: 'PROMOTED',
            promoted_eco_id: expect.any(String),
          }),
        })
      );

      // Verify audit logs generated for both entities
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECR_PROMOTED_TO_ECO',
          entityId: mockEcrId,
        }),
        txMock
      );

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECO_CREATED',
        }),
        txMock
      );

      expect(result.ecr.status).toBe('PROMOTED');
    });

    it('TC-ECR-12: Duplicate promotion prevention: Rejects promotion if ECR already promoted or not ACCEPTED', async () => {
      // 1. Not ACCEPTED
      const unacceptedEcr = {
        id: mockEcrId,
        ecr_number: 'ECR-20261110-A1B2',
        status: 'UNDER_REVIEW',
        promoted_eco_id: null,
      };

      const txMock1 = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        eCR: { findUnique: vi.fn().mockResolvedValue(unacceptedEcr) },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock1));

      await expect(
        ECRService.promoteToECO(mockEcrId, { ecoNumber: 'ECO-001' }, mockReviewerId)
      ).rejects.toThrow(ConflictError);

      // 2. Already Promoted
      const alreadyPromotedEcr = {
        id: mockEcrId,
        ecr_number: 'ECR-20261110-A1B2',
        status: 'ACCEPTED',
        promoted_eco_id: 'existing-eco-uuid-999',
      };

      const txMock2 = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        eCR: { findUnique: vi.fn().mockResolvedValue(alreadyPromotedEcr) },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock2));

      await expect(
        ECRService.promoteToECO(mockEcrId, { ecoNumber: 'ECO-002' }, mockReviewerId)
      ).rejects.toThrow(ConflictError);
    });

    it('TC-ECR-13: Prevents promotion if proposed ECO number already exists', async () => {
      const mockEcr = {
        id: mockEcrId,
        ecr_number: 'ECR-20261110-A1B2',
        status: 'ACCEPTED',
        product_id: mockProductId,
        bom_id: mockBomId,
        promoted_eco_id: null,
      };

      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        eCR: { findUnique: vi.fn().mockResolvedValue(mockEcr) },
        eCO: { findFirst: vi.fn().mockResolvedValue({ id: 'existing-eco' }) },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      await expect(
        ECRService.promoteToECO(mockEcrId, { ecoNumber: 'ECO-ALREADY-TAKEN' }, mockReviewerId)
      ).rejects.toThrow(ConflictError);
    });
  });
});
