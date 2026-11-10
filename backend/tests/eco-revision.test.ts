import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ECOService } from '../src/modules/eco/eco.service.js';
import { prisma } from '../src/config/database.js';
import { AuditService } from '../src/services/audit.service.js';
import { AppError, ForbiddenError, NotFoundError, ConflictError } from '../src/utils/errors.js';

describe('ECO Revision Lifecycle & Change Item Editing Suite (Milestone 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEcoId = 'eco-1111-2222-3333-444444444444';
  const mockUserId = 'user-author-uuid-1';
  const mockAdminId = 'user-admin-uuid-9';

  describe('Part A.1: Create Revision (POST /api/v1/ecos/:id/revisions)', () => {
    it('TC-REV-01: Successfully creates Revision 2 when active revision is in CHANGES_REQUESTED', async () => {
      const mockActiveRev = {
        eco_id: mockEcoId,
        revision_number: 1,
        status: 'CHANGES_REQUESTED',
        change_summary: 'Initial revision draft',
        changes: [
          {
            id: 'change-rev1-item1',
            eco_id: mockEcoId,
            revision_number: 1,
            change_type: 'QUANTITY_CHANGE',
            change_target: 'COMPONENT',
            field_name: 'RES-10K',
            old_value: '10',
            new_value: '20',
            impact_type: 'MATERIAL',
            justification: 'Assembly torque specification update',
          },
        ],
      };

      const mockEco = {
        id: mockEcoId,
        eco_number: 'ECO-2026-0001',
        title: 'Gearbox Redesign',
        active_revision_no: 1,
        status: 'CHANGES_REQUESTED',
        created_by: mockUserId,
        eco_revisions: [mockActiveRev],
      };

      const createdRev2 = {
        eco_id: mockEcoId,
        revision_number: 2,
        change_summary: 'Addressed reviewer torque feedback',
        status: 'DRAFT',
        created_by: mockUserId,
      };

      const clonedChange = {
        id: 'new-uuid-for-change-item',
        eco_id: mockEcoId,
        revision_number: 2,
        change_type: 'QUANTITY_CHANGE',
        change_target: 'COMPONENT',
        field_name: 'RES-10K',
        old_value: '10',
        new_value: '20',
        impact_type: 'MATERIAL',
        justification: 'Assembly torque specification update',
      };

      const updatedEco = {
        ...mockEco,
        active_revision_no: 2,
        status: 'DRAFT',
      };

      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        eCO: {
          findUnique: vi.fn().mockResolvedValue(mockEco),
          update: vi.fn().mockResolvedValue(updatedEco),
        },
        eCORevision: {
          create: vi.fn().mockResolvedValue(createdRev2),
        },
        eCOChange: {
          create: vi.fn().mockResolvedValue(clonedChange),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue({} as any);

      const result = await ECOService.createRevision(
        mockEcoId,
        { changeSummary: 'Addressed reviewer torque feedback' },
        mockUserId,
        ['LEAD_ENGINEER']
      );

      // Verify advisory lock acquired inside transaction
      expect(mockTx.$queryRaw).toHaveBeenCalled();

      // Verify revision 2 created in DRAFT
      expect(mockTx.eCORevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eco_id: mockEcoId,
          revision_number: 2,
          change_summary: 'Addressed reviewer torque feedback',
          status: 'DRAFT',
          created_by: mockUserId,
        }),
      });

      // Verify change item was cloned with new revision number 2
      expect(mockTx.eCOChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eco_id: mockEcoId,
          revision_number: 2,
          change_type: 'QUANTITY_CHANGE',
          field_name: 'RES-10K',
        }),
      });

      // Verify ECO active revision pointer updated to 2 and status reset to DRAFT
      expect(mockTx.eCO.update).toHaveBeenCalledWith({
        where: { id: mockEcoId },
        data: {
          active_revision_no: 2,
          status: 'DRAFT',
        },
      });

      // Verify audit event
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: 'ECO_REVISION_CREATED',
          entityId: mockEcoId,
          newValues: expect.objectContaining({
            previousRevision: 1,
            newRevision: 2,
            clonedChangesCount: 1,
          }),
        }),
        mockTx
      );

      expect(result.eco.active_revision_no).toBe(2);
      expect(result.revision.revision_number).toBe(2);
      expect(result.revision.changes).toHaveLength(1);
    });

    it('TC-REV-02: Rejects revision creation when active revision is in invalid status', async () => {
      const invalidStatuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'];

      for (const status of invalidStatuses) {
        const mockEco = {
          id: mockEcoId,
          eco_number: 'ECO-2026-0001',
          active_revision_no: 1,
          status,
          created_by: mockUserId,
          eco_revisions: [
            {
              eco_id: mockEcoId,
              revision_number: 1,
              status,
              changes: [],
            },
          ],
        };

        const mockTx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          eCO: { findUnique: vi.fn().mockResolvedValue(mockEco) },
        };
        vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

        await expect(
          ECOService.createRevision(mockEcoId, { changeSummary: 'Invalid attempt' }, mockUserId, ['LEAD_ENGINEER'])
        ).rejects.toThrow(AppError);
      }
    });

    it('TC-REV-03: Rejects unauthorized user attempting to create revision', async () => {
      const mockEco = {
        id: mockEcoId,
        eco_number: 'ECO-2026-0001',
        active_revision_no: 1,
        status: 'CHANGES_REQUESTED',
        created_by: mockUserId, // Owned by mockUserId
        eco_revisions: [
          {
            eco_id: mockEcoId,
            revision_number: 1,
            status: 'CHANGES_REQUESTED',
            changes: [],
          },
        ],
      };

      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        eCO: { findUnique: vi.fn().mockResolvedValue(mockEco) },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      // Attempt by different user without administrative role
      await expect(
        ECOService.createRevision(mockEcoId, { changeSummary: 'Hacker rev' }, 'unauthorized-user-999', ['OPERATOR'])
      ).rejects.toThrow(ForbiddenError);
    });

    it('TC-REV-04: Prevents duplicate revision creation under race conditions', async () => {
      const mockEco = {
        id: mockEcoId,
        eco_number: 'ECO-2026-0001',
        active_revision_no: 1,
        status: 'CHANGES_REQUESTED',
        created_by: mockUserId,
        eco_revisions: [
          {
            eco_id: mockEcoId,
            revision_number: 1,
            status: 'CHANGES_REQUESTED',
            changes: [],
          },
          {
            eco_id: mockEcoId,
            revision_number: 2, // Revision 2 already exists
            status: 'DRAFT',
            changes: [],
          },
        ],
      };

      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        eCO: { findUnique: vi.fn().mockResolvedValue(mockEco) },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        ECOService.createRevision(mockEcoId, { changeSummary: 'Duplicate attempt' }, mockUserId, ['LEAD_ENGINEER'])
      ).rejects.toThrow(ConflictError);
    });

    it('TC-REV-05: Failed revision creation transaction rolls back cleanly', async () => {
      const mockEco = {
        id: mockEcoId,
        eco_number: 'ECO-2026-0001',
        active_revision_no: 1,
        status: 'CHANGES_REQUESTED',
        created_by: mockUserId,
        eco_revisions: [
          {
            eco_id: mockEcoId,
            revision_number: 1,
            status: 'CHANGES_REQUESTED',
            changes: [{ id: 'ch-1' }],
          },
        ],
      };

      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        eCO: { findUnique: vi.fn().mockResolvedValue(mockEco), update: vi.fn() },
        eCORevision: { create: vi.fn().mockResolvedValue({ id: 'rev-2' }) },
        eCOChange: {
          create: vi.fn().mockRejectedValueOnce(new Error('Simulated Database Deadlock or Constraint Failure')),
        },
      };

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return await cb(mockTx);
      });

      await expect(
        ECOService.createRevision(mockEcoId, { changeSummary: 'Crash test' }, mockUserId, ['LEAD_ENGINEER'])
      ).rejects.toThrow('Simulated Database Deadlock or Constraint Failure');

      // Ensure active revision pointer on ECO was NOT updated
      expect(mockTx.eCO.update).not.toHaveBeenCalled();
    });
  });

  describe('Part A.2: Update Draft Change Item (PATCH /api/v1/ecos/:id/changes/:changeId)', () => {
    it('TC-REV-06: Successfully updates change item while ECO is in DRAFT status', async () => {
      const mockEco = {
        id: mockEcoId,
        status: 'DRAFT',
        active_revision_no: 2,
        created_by: mockUserId,
      };

      const mockChange = {
        id: 'change-item-99',
        eco_id: mockEcoId,
        revision_number: 2, // Belongs to active revision
        change_type: 'QUANTITY_CHANGE',
        field_name: 'RES-10K',
        old_value: '10',
        new_value: '20',
      };

      const updatedChange = {
        ...mockChange,
        new_value: '25',
      };

      vi.spyOn(prisma.eCO, 'findUnique').mockResolvedValue(mockEco as any);
      vi.spyOn(prisma.eCOChange, 'findUnique').mockResolvedValue(mockChange as any);
      vi.spyOn(prisma.eCOChange, 'update').mockResolvedValue(updatedChange as any);
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue({} as any);

      const result = await ECOService.updateChange(
        mockEcoId,
        'change-item-99',
        { newValue: '25' },
        mockUserId,
        ['LEAD_ENGINEER']
      );

      expect(prisma.eCOChange.update).toHaveBeenCalledWith({
        where: { id: 'change-item-99' },
        data: expect.objectContaining({ new_value: '25' }),
      });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECO_CHANGE_UPDATED',
          entityId: 'change-item-99',
        })
      );

      expect(result.new_value).toBe('25');
    });

    it('TC-REV-07: Rejects change item update when ECO is not in DRAFT status', async () => {
      const nonDraftStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'];

      for (const status of nonDraftStatuses) {
        vi.spyOn(prisma.eCO, 'findUnique').mockResolvedValue({
          id: mockEcoId,
          status,
          active_revision_no: 1,
          created_by: mockUserId,
        } as any);

        await expect(
          ECOService.updateChange(mockEcoId, 'change-item-99', { newValue: '50' }, mockUserId, ['LEAD_ENGINEER'])
        ).rejects.toThrow(AppError);
      }
    });

    it('TC-REV-08: Rejects updating a change item from a historical revision', async () => {
      const mockEco = {
        id: mockEcoId,
        status: 'DRAFT',
        active_revision_no: 2, // Active is revision 2
        created_by: mockUserId,
      };

      const historicalChange = {
        id: 'historical-change-item-1',
        eco_id: mockEcoId,
        revision_number: 1, // Historical revision 1!
        change_type: 'QUANTITY_CHANGE',
      };

      vi.spyOn(prisma.eCO, 'findUnique').mockResolvedValue(mockEco as any);
      vi.spyOn(prisma.eCOChange, 'findUnique').mockResolvedValue(historicalChange as any);

      await expect(
        ECOService.updateChange(
          mockEcoId,
          'historical-change-item-1',
          { newValue: '50' },
          mockUserId,
          ['LEAD_ENGINEER']
        )
      ).rejects.toThrow(AppError);
    });
  });

  describe('Part A.3: Delete Draft Change Item (DELETE /api/v1/ecos/:id/changes/:changeId)', () => {
    it('TC-REV-09: Successfully deletes a change item from active draft revision', async () => {
      const mockEco = {
        id: mockEcoId,
        status: 'DRAFT',
        active_revision_no: 2,
        created_by: mockUserId,
      };

      const mockChange = {
        id: 'change-to-delete',
        eco_id: mockEcoId,
        revision_number: 2,
        change_type: 'SPECIFICATION_CHANGE',
        field_name: 'Housing Color',
      };

      vi.spyOn(prisma.eCO, 'findUnique').mockResolvedValue(mockEco as any);
      vi.spyOn(prisma.eCOChange, 'findUnique').mockResolvedValue(mockChange as any);
      vi.spyOn(prisma.eCOChange, 'delete').mockResolvedValue(mockChange as any);
      const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue({} as any);

      const result = await ECOService.removeChange(
        mockEcoId,
        'change-to-delete',
        mockUserId,
        ['LEAD_ENGINEER']
      );

      expect(prisma.eCOChange.delete).toHaveBeenCalledWith({
        where: { id: 'change-to-delete' },
      });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ECO_CHANGE_DELETED',
          entityId: 'change-to-delete',
        })
      );

      expect(result.deleted).toBe(true);
    });

    it('TC-REV-10: Rejects deletion of change item belonging to a different ECO or historical revision', async () => {
      const mockEco = {
        id: mockEcoId,
        status: 'DRAFT',
        active_revision_no: 2,
        created_by: mockUserId,
      };

      const foreignChange = {
        id: 'foreign-change',
        eco_id: 'different-eco-id',
        revision_number: 2,
      };

      vi.spyOn(prisma.eCO, 'findUnique').mockResolvedValue(mockEco as any);
      vi.spyOn(prisma.eCOChange, 'findUnique').mockResolvedValue(foreignChange as any);

      await expect(
        ECOService.removeChange(mockEcoId, 'foreign-change', mockUserId, ['LEAD_ENGINEER'])
      ).rejects.toThrow(AppError);
    });
  });
});

