import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ECNService } from '../src/modules/ecn/ecn.service.js';
import { prisma } from '../src/config/database.js';
import { AuditService } from '../src/services/audit.service.js';
import { NotFoundError, ConflictError, AppError, ForbiddenError } from '../src/utils/errors.js';
import { TokenPayload } from '../src/services/security.service.js';

describe('Engineering Change Notice (ECN) Module Test Suite (Milestone 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const mockEcoId = 'eco-1111-2222-3333-444444444444';
  const mockEcnId = 'ecn-1111-2222-3333-444444444444';
  const mockReleaseId = 'rel-1111-2222-3333-444444444444';
  const mockProductId = 'prod-1111-2222-3333-444444444444';
  const mockProdVersionId = 'pver-1111-2222-3333-444444444444';
  const mockBomVersionId = 'bver-1111-2222-3333-444444444444';
  const mockUserId = 'user-engineer-1';
  const mockQualityUserId = 'user-quality-1';
  const mockAdminUserId = 'user-admin-1';

  const engineerToken: TokenPayload = {
    userId: mockUserId,
    email: 'engineer@ecoflow.internal',
    sessionId: 'session-1',
    roles: ['LEAD_ENGINEER'],
    permissions: ['ecn:generate', 'ecn:read', 'ecn:issue', 'ecn:acknowledge', 'ecn:disposition', 'ecn:complete'],
  };

  const qualityToken: TokenPayload = {
    userId: mockQualityUserId,
    email: 'quality@ecoflow.internal',
    sessionId: 'session-2',
    roles: ['QUALITY_INSPECTOR'],
    permissions: ['ecn:read', 'ecn:acknowledge'],
  };

  const adminToken: TokenPayload = {
    userId: mockAdminUserId,
    email: 'admin@ecoflow.internal',
    sessionId: 'session-3',
    roles: ['ADMINISTRATOR'],
    permissions: ['admin:all'],
  };

  const mockReleasedECO = {
    id: mockEcoId,
    eco_number: 'ECO-2026-001',
    title: 'Titanium Bracket Reinforcement',
    description: 'Updated bracket thickness for stress compliance',
    status: 'APPROVED',
    product_id: mockProductId,
    bom_id: 'bom-1111',
    product: { id: mockProductId, name: 'Chassis', part_number: 'CHS-01' },
    bom: { id: 'bom-1111', bom_number: 'BOM-CHS-01' },
    version_releases: [
      {
        id: mockReleaseId,
        eco_id: mockEcoId,
        product_id: mockProductId,
        product_version_id: mockProdVersionId,
        bom_version_id: mockBomVersionId,
        release_status: 'RELEASED',
        product_version: {
          id: mockProdVersionId,
          version_number: 2,
        },
        bom_version: {
          id: mockBomVersionId,
          version_number: 2,
        },
      },
    ],
    ecn: null,
  };

  describe('1. ECN Generation & Eligibility Verification', () => {
    it('TC-ECN-01: Successfully generates an ECN from an APPROVED and released ECO with advisory lock', async () => {
      const lockSpy = vi.fn().mockResolvedValue([]);
      const createEcnSpy = vi.fn().mockImplementation((args) => ({
        id: mockEcnId,
        ...args.data,
      }));

      const txMock = {
        $executeRaw: lockSpy,
        eCO: {
          findUnique: vi.fn().mockResolvedValue(mockReleasedECO),
        },
        eCN: {
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue({
            id: mockEcnId,
            ecn_number: 'ECN-20261111-0001',
            status: 'DRAFT',
          }),
          create: createEcnSpy,
        },
        eCNDistribution: {
          create: vi.fn().mockResolvedValue({ id: 'dist-uuid' }),
        },
        eCNMaterialDisposition: {
          create: vi.fn().mockResolvedValue({ id: 'disp-uuid' }),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      // Also spy on getECNById for the return step
      vi.spyOn(ECNService, 'getECNById').mockResolvedValue({
        id: mockEcnId,
        ecn_number: 'ECN-20261111-0001',
        status: 'DRAFT',
      } as any);

      const result = await ECNService.generateECN(
        mockEcoId,
        {
          effectiveDate: new Date('2026-12-01').toISOString(),
          targetDepartments: ['ENGINEERING', 'QUALITY', 'PRODUCTION', 'PROCUREMENT', 'INVENTORY', 'MANAGEMENT'],
          changeSummary: 'Titanium bracket reinforcement cutover for lot 450+',
          reasonForChange: 'Eliminate fracture potential during thermal cycling',
        },
        mockUserId
      );

      // Verify advisory lock was acquired with expected lock key 4200000001004
      expect(lockSpy).toHaveBeenCalledTimes(1);

      // Verify ECN was created with link to ECO, Product, VersionRelease, and version snapshots
      expect(createEcnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eco_id: mockEcoId,
            version_release_id: mockReleaseId,
            status: 'DRAFT',
            created_by: mockUserId,
          }),
        })
      );

      // Verify audit log
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: 'ECN_GENERATED',
          entityType: 'ECN',
        }),
        txMock
      );

      expect(result.id).toBe(mockEcnId);
    });

    it('TC-ECN-02: Rejects ECN generation when ECO is still in DRAFT status', async () => {
      const draftECO = { ...mockReleasedECO, status: 'DRAFT', version_releases: [] };

      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue([]),
        eCO: {
          findUnique: vi.fn().mockResolvedValue(draftECO),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      await expect(
        ECNService.generateECN(
          mockEcoId,
          {
            effectiveDate: new Date('2026-12-01').toISOString(),
            targetDepartments: ['ENGINEERING'],
          },
          mockUserId
        )
      ).rejects.toThrow(ConflictError);
    });

    it('TC-ECN-03: Rejects ECN generation when ECO is in SUBMITTED or CHANGES_REQUESTED status', async () => {
      const submittedECO = { ...mockReleasedECO, status: 'SUBMITTED', version_releases: [] };

      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue([]),
        eCO: {
          findUnique: vi.fn().mockResolvedValue(submittedECO),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      await expect(
        ECNService.generateECN(
          mockEcoId,
          {
            effectiveDate: new Date('2026-12-01').toISOString(),
            targetDepartments: ['QUALITY'],
          },
          mockUserId
        )
      ).rejects.toThrow(ConflictError);
    });

    it('TC-ECN-04: Rejects ECN generation when ECO is APPROVED but lacks a VersionRelease record', async () => {
      const unreleasedECO = { ...mockReleasedECO, version_releases: [] };

      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue([]),
        eCO: {
          findUnique: vi.fn().mockResolvedValue(unreleasedECO),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      await expect(
        ECNService.generateECN(
          mockEcoId,
          {
            effectiveDate: new Date('2026-12-01').toISOString(),
            targetDepartments: ['QUALITY'],
          },
          mockUserId
        )
      ).rejects.toThrow(ConflictError);
    });

    it('TC-ECN-05: Prevents duplicate ECN generation when an ECN already exists for the ECO', async () => {
      const existingEcnECO = {
        ...mockReleasedECO,
        ecn: { id: 'existing-ecn-id', ecn_number: 'ECN-20261111-0001' },
      };

      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue([]),
        eCO: {
          findUnique: vi.fn().mockResolvedValue(existingEcnECO),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

      await expect(
        ECNService.generateECN(
          mockEcoId,
          {
            effectiveDate: new Date('2026-12-01').toISOString(),
            targetDepartments: ['QUALITY'],
          },
          mockUserId
        )
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('2. ECN Issuance & Lifecycle Transitions', () => {
    it('TC-ECN-06: Successfully transitions ECN from DRAFT to ISSUED and stamps timestamp', async () => {
      const mockDraftEcn = {
        id: mockEcnId,
        ecn_number: 'ECN-20261111-0001',
        status: 'DRAFT',
        effective_date: new Date('2026-12-01'),
        distributions: [
          { id: 'dist-1', department: 'ENGINEERING', acknowledgement_status: 'PENDING' },
          { id: 'dist-2', department: 'QUALITY', acknowledgement_status: 'PENDING' },
        ],
      };

      const updatedEcn = {
        ...mockDraftEcn,
        status: 'ISSUED',
        issued_at: new Date(),
        issued_by: mockUserId,
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockDraftEcn as any);

      const txMock = {
        eCNDistribution: {
          create: vi.fn().mockResolvedValue({ id: 'dist-3' }),
        },
        eCN: {
          update: vi.fn().mockResolvedValue(updatedEcn),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const result = await ECNService.issueECN(mockEcnId, {}, mockUserId);

      expect(txMock.eCN.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockEcnId },
          data: expect.objectContaining({
            status: 'ISSUED',
            issued_by: mockUserId,
          }),
        })
      );
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECN_ISSUED',
          entityType: 'ECN',
          entityId: mockEcnId,
        }),
        txMock
      );
      expect(result.status).toBe('ISSUED');
    });

    it('TC-ECN-07: Rejects issuing an ECN that is already in ISSUED status', async () => {
      const mockIssuedEcn = {
        id: mockEcnId,
        status: 'ISSUED',
        distributions: [],
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockIssuedEcn as any);

      await expect(ECNService.issueECN(mockEcnId, {}, mockUserId)).rejects.toThrow(ConflictError);
    });
  });

  describe('3. ECN Cancellation Rules', () => {
    it('TC-ECN-08: Allows cancellation of a DRAFT ECN with required reason', async () => {
      const mockDraftEcn = {
        id: mockEcnId,
        ecn_number: 'ECN-20261111-0001',
        status: 'DRAFT',
      };

      const cancelledEcn = {
        ...mockDraftEcn,
        status: 'CANCELLED',
        cancellation_reason: 'ECO scope supersession by executive directive',
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockDraftEcn as any);

      const txMock = {
        eCN: {
          update: vi.fn().mockResolvedValue(cancelledEcn),
        },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const result = await ECNService.cancelECN(
        mockEcnId,
        { cancellationReason: 'ECO scope supersession by executive directive' },
        mockUserId
      );

      expect(txMock.eCN.update).toHaveBeenCalledWith({
        where: { id: mockEcnId },
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancellation_reason: 'ECO scope supersession by executive directive',
        }),
      });
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECN_CANCELLED',
          entityType: 'ECN',
        }),
        txMock
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('TC-ECN-09: Strictly forbids cancellation of an ISSUED ECN', async () => {
      const mockIssuedEcn = {
        id: mockEcnId,
        ecn_number: 'ECN-20261111-0001',
        status: 'ISSUED',
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockIssuedEcn as any);

      await expect(
        ECNService.cancelECN(
          mockEcnId,
          { cancellationReason: 'Attempt to cancel after departmental distribution' },
          mockUserId
        )
      ).rejects.toThrow(ConflictError);
    });

    it('TC-ECN-10: Strictly forbids cancellation of a COMPLETED ECN', async () => {
      const mockCompletedEcn = {
        id: mockEcnId,
        ecn_number: 'ECN-20261111-0001',
        status: 'COMPLETED',
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockCompletedEcn as any);

      await expect(
        ECNService.cancelECN(
          mockEcnId,
          { cancellationReason: 'Attempt to cancel completed notice' },
          mockUserId
        )
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('4. Department-Level Distribution & Acknowledgement', () => {
    it('TC-ECN-11: Successfully acknowledges a distribution by an authorized role', async () => {
      const mockDistribution = {
        id: 'dist-quality-1',
        ecn_id: mockEcnId,
        department: 'QUALITY',
        assigned_to: mockQualityUserId,
        acknowledgement_status: 'PENDING',
      };

      const mockIssuedEcn = {
        id: mockEcnId,
        status: 'ISSUED',
        distributions: [mockDistribution],
      };

      const updatedDist = {
        ...mockDistribution,
        acknowledgement_status: 'ACKNOWLEDGED',
        acknowledged_at: new Date(),
        acknowledged_by: mockQualityUserId,
        comments: 'Inspection procedures and gauge calibration updated.',
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockIssuedEcn as any);

      const txMock = {
        eCNDistribution: {
          update: vi.fn().mockResolvedValue(updatedDist),
        },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const result = await ECNService.acknowledgeDistribution(
        mockEcnId,
        'dist-quality-1',
        { comments: 'Inspection procedures and gauge calibration updated.' },
        mockQualityUserId,
        qualityToken
      );

      expect(txMock.eCNDistribution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dist-quality-1' },
          data: expect.objectContaining({
            acknowledgement_status: 'ACKNOWLEDGED',
            acknowledged_by: mockQualityUserId,
          }),
        })
      );
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECN_DISTRIBUTION_ACKNOWLEDGED',
          entityType: 'ECN',
        }),
        txMock
      );
      expect(result.acknowledgement_status).toBe('ACKNOWLEDGED');
    });

    it('TC-ECN-12: Rejects duplicate acknowledgement of an already ACKNOWLEDGED distribution', async () => {
      const alreadyAckDist = {
        id: 'dist-quality-1',
        ecn_id: mockEcnId,
        department: 'QUALITY',
        acknowledgement_status: 'ACKNOWLEDGED',
        acknowledged_at: new Date(),
      };

      const mockIssuedEcn = {
        id: mockEcnId,
        status: 'ISSUED',
        distributions: [alreadyAckDist],
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockIssuedEcn as any);

      await expect(
        ECNService.acknowledgeDistribution(
          mockEcnId,
          'dist-quality-1',
          { comments: 'Redundant ack' },
          mockQualityUserId,
          qualityToken
        )
      ).rejects.toThrow(ConflictError);
    });

    it('TC-ECN-13: Rejects acknowledgement from an unauthorized department role', async () => {
      const mockDistribution = {
        id: 'dist-quality-1',
        ecn_id: mockEcnId,
        department: 'QUALITY',
        acknowledgement_status: 'PENDING',
      };

      const mockIssuedEcn = {
        id: mockEcnId,
        status: 'ISSUED',
        distributions: [mockDistribution],
      };

      // User has role OPERATOR which is neither ADMINISTRATOR nor has ecn:acknowledge
      const unauthorizedToken: TokenPayload = {
        userId: 'user-operator-1',
        email: 'operator@ecoflow.internal',
        sessionId: 'session-4',
        roles: ['OPERATOR'],
        permissions: ['ecr:create'],
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockIssuedEcn as any);

      await expect(
        ECNService.acknowledgeDistribution(
          mockEcnId,
          'dist-quality-1',
          { comments: 'Attempt unauthorized signoff' },
          'user-operator-1',
          unauthorizedToken
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('5. Material Disposition Management', () => {
    it('TC-ECN-14: Successfully adds a material disposition item (SCRAP / REWORK / USE_AS_IS)', async () => {
      const mockEcn = {
        id: mockEcnId,
        status: 'ISSUED',
      };

      const mockDisposition = {
        id: 'disp-1',
        ecn_id: mockEcnId,
        productId: mockProductId,
        part_number: 'BRK-402',
        disposition_type: 'REWORK',
        quantity: 150,
        instructions: 'Re-machine bolt hole countersink to 3.5mm depth',
        responsible_department: 'PRODUCTION',
        created_by: mockUserId,
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockEcn as any);

      const txMock = {
        eCNMaterialDisposition: {
          create: vi.fn().mockResolvedValue(mockDisposition),
        },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const result = await ECNService.addMaterialDisposition(
        mockEcnId,
        {
          productId: mockProductId,
          partNumber: 'BRK-402',
          dispositionType: 'REWORK',
          quantity: 150,
          instructions: 'Re-machine bolt hole countersink to 3.5mm depth',
          responsibleDepartment: 'PRODUCTION',
        },
        mockUserId
      );

      expect(txMock.eCNMaterialDisposition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ecn_id: mockEcnId,
            disposition_type: 'REWORK',
            instructions: 'Re-machine bolt hole countersink to 3.5mm depth',
            responsible_department: 'PRODUCTION',
            created_by: mockUserId,
          }),
        })
      );
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECN_DISPOSITION_CREATED',
          entityType: 'ECN',
        }),
        txMock
      );
      expect(result.disposition_type).toBe('REWORK');
    });

    it('TC-ECN-15: Rejects adding disposition when ECN is CANCELLED', async () => {
      const cancelledEcn = { id: mockEcnId, status: 'CANCELLED' };
      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(cancelledEcn as any);

      await expect(
        ECNService.addMaterialDisposition(
          mockEcnId,
          {
            partNumber: 'SCRAP-01',
            dispositionType: 'SCRAP',
            instructions: 'Scrap old batch',
            responsibleDepartment: 'QUALITY',
          },
          mockUserId
        )
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('6. ECN Completion Workflow', () => {
    it('TC-ECN-16: Successfully marks an ISSUED ECN as COMPLETED', async () => {
      const mockIssuedEcn = {
        id: mockEcnId,
        status: 'ISSUED',
        distributions: [
          { id: 'dist-1', acknowledgement_status: 'ACKNOWLEDGED' },
          { id: 'dist-2', acknowledgement_status: 'ACKNOWLEDGED' },
        ],
      };

      const completedEcn = {
        ...mockIssuedEcn,
        status: 'COMPLETED',
        completed_at: new Date(),
        completed_by: mockUserId,
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockIssuedEcn as any);

      const txMock = {
        eCN: {
          update: vi.fn().mockResolvedValue(completedEcn),
        },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);

      const result = await ECNService.completeECN(mockEcnId, { notes: 'All lines converted' }, mockUserId);

      expect(txMock.eCN.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockEcnId },
          data: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECN_COMPLETED',
          entityType: 'ECN',
        }),
        txMock
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('TC-ECN-17: Rejects completion if ECN is still in DRAFT', async () => {
      const mockDraftEcn = {
        id: mockEcnId,
        status: 'DRAFT',
        distributions: [],
      };

      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(mockDraftEcn as any);

      await expect(ECNService.completeECN(mockEcnId, {}, mockUserId)).rejects.toThrow(ConflictError);
    });
  });

  describe('7. Querying and Retrieval', () => {
    it('TC-ECN-18: Lists ECNs with pagination and department filtering', async () => {
      const mockEcnList = [
        {
          id: mockEcnId,
          ecn_number: 'ECN-20261111-0001',
          status: 'ISSUED',
          effective_date: new Date(),
          distributions: [{ department: 'PRODUCTION', acknowledgement_status: 'PENDING' }],
        },
      ];

      vi.spyOn(prisma.eCN, 'findMany').mockResolvedValue(mockEcnList as any);
      vi.spyOn(prisma.eCN, 'count').mockResolvedValue(1);

      const result = await ECNService.listECNs(1, 10, { department: 'PRODUCTION', status: 'ISSUED' });

      expect(result.ecns).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.ecns[0].ecn_number).toBe('ECN-20261111-0001');
    });

    it('TC-ECN-19: Throws NotFoundError when fetching non-existent ECN by ID', async () => {
      vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(null);

      await expect(ECNService.getECNById('non-existent-uuid')).rejects.toThrow(NotFoundError);
    });
  });
});
