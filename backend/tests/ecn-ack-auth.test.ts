import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ECNService } from '../src/modules/ecn/ecn.service.js';
import { prisma } from '../src/config/database.js';
import { AuditService } from '../src/services/audit.service.js';
import { ForbiddenError, ConflictError } from '../src/utils/errors.js';
import { TokenPayload } from '../src/services/security.service.js';

describe('ECN Acknowledgement Comprehensive Authorization Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const mockEcnId = 'ecn-1111-2222-3333-444444444444';
  const adminId = 'user-admin';
  const engineerId = 'user-engineer';
  const approverId = 'user-approver';
  const operatorId = 'user-operator';
  const otherUserId = 'user-other';

  const adminToken: TokenPayload = {
    userId: adminId,
    email: 'admin@ecoflow.internal',
    sessionId: 's-admin',
    roles: ['ADMINISTRATOR'],
    permissions: ['admin:all'],
  };

  const engineerToken: TokenPayload = {
    userId: engineerId,
    email: 'engineer@ecoflow.internal',
    sessionId: 's-eng',
    roles: ['LEAD_ENGINEER'],
    permissions: ['ecn:read', 'ecn:acknowledge'],
  };

  const approverToken: TokenPayload = {
    userId: approverId,
    email: 'approver@ecoflow.internal',
    sessionId: 's-appr',
    roles: ['APPROVER'],
    permissions: ['ecn:read', 'ecn:acknowledge'],
  };

  const operatorToken: TokenPayload = {
    userId: operatorId,
    email: 'operator@ecoflow.internal',
    sessionId: 's-oper',
    roles: ['OPERATOR'],
    permissions: ['ecn:read', 'ecn:acknowledge'],
  };

  function createMockEcn(distribution: any) {
    return {
      id: mockEcnId,
      status: 'ISSUED',
      distributions: [distribution],
    };
  }

  function mockPrismaTx() {
    const txMock = {
      eCNDistribution: {
        update: vi.fn().mockImplementation(async ({ data }: any) => ({
          ...data,
          acknowledgement_status: 'ACKNOWLEDGED',
          acknowledged_at: new Date(),
        })),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));
    vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as any);
    return txMock;
  }

  // 1. Administrator + assigned distribution
  it('1. Administrator + assigned distribution: SUCCEEDS', async () => {
    const dist = { id: 'd-1', department: 'QUALITY', assigned_to: adminId, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    const res = await ECNService.acknowledgeDistribution(mockEcnId, 'd-1', {}, adminId, adminToken);
    expect(res.acknowledgement_status).toBe('ACKNOWLEDGED');
    expect(tx.eCNDistribution.update).toHaveBeenCalled();
  });

  // 2. Administrator + unassigned distribution
  it('2. Administrator + unassigned distribution: SUCCEEDS (supervisory override)', async () => {
    const dist = { id: 'd-2', department: 'MANUFACTURING', assigned_to: null, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    const res = await ECNService.acknowledgeDistribution(mockEcnId, 'd-2', {}, adminId, adminToken);
    expect(res.acknowledgement_status).toBe('ACKNOWLEDGED');
    expect(tx.eCNDistribution.update).toHaveBeenCalled();
  });

  // 3. Lead Engineer + assigned distribution
  it('3. Lead Engineer + assigned distribution: SUCCEEDS', async () => {
    const dist = { id: 'd-3', department: 'ENGINEERING', assigned_to: engineerId, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    const res = await ECNService.acknowledgeDistribution(mockEcnId, 'd-3', {}, engineerId, engineerToken);
    expect(res.acknowledgement_status).toBe('ACKNOWLEDGED');
    expect(tx.eCNDistribution.update).toHaveBeenCalled();
  });

  // 4. Lead Engineer + unassigned distribution
  it('4. Lead Engineer + unassigned distribution: SUCCEEDS (authorized supervisor)', async () => {
    const dist = { id: 'd-4', department: 'PRODUCTION', assigned_to: null, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    const res = await ECNService.acknowledgeDistribution(mockEcnId, 'd-4', {}, engineerId, engineerToken);
    expect(res.acknowledgement_status).toBe('ACKNOWLEDGED');
    expect(tx.eCNDistribution.update).toHaveBeenCalled();
  });

  // 5. Approver + assigned to self
  it('5. Approver + assigned to self: SUCCEEDS', async () => {
    const dist = { id: 'd-5', department: 'QUALITY', assigned_to: approverId, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    const res = await ECNService.acknowledgeDistribution(mockEcnId, 'd-5', {}, approverId, approverToken);
    expect(res.acknowledgement_status).toBe('ACKNOWLEDGED');
    expect(tx.eCNDistribution.update).toHaveBeenCalled();
  });

  // 6. Approver + assigned to another user
  it('6. Approver + assigned to another user: FORBIDDEN (403)', async () => {
    const dist = { id: 'd-6', department: 'QUALITY', assigned_to: otherUserId, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    await expect(
      ECNService.acknowledgeDistribution(mockEcnId, 'd-6', {}, approverId, approverToken)
    ).rejects.toThrow(ForbiddenError);
    expect(tx.eCNDistribution.update).not.toHaveBeenCalled();
  });

  // 7. Approver + unassigned distribution
  it('7. Approver + unassigned distribution: FORBIDDEN (403 - cannot sign unassigned)', async () => {
    const dist = { id: 'd-7', department: 'PURCHASING', assigned_to: null, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    await expect(
      ECNService.acknowledgeDistribution(mockEcnId, 'd-7', {}, approverId, approverToken)
    ).rejects.toThrow(ForbiddenError);
    expect(tx.eCNDistribution.update).not.toHaveBeenCalled();
  });

  // 8. Operator + assigned to self
  it('8. Operator + assigned to self: SUCCEEDS', async () => {
    const dist = { id: 'd-8', department: 'PRODUCTION', assigned_to: operatorId, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    const res = await ECNService.acknowledgeDistribution(mockEcnId, 'd-8', {}, operatorId, operatorToken);
    expect(res.acknowledgement_status).toBe('ACKNOWLEDGED');
    expect(tx.eCNDistribution.update).toHaveBeenCalled();
  });

  // 9. Operator + assigned to another user
  it('9. Operator + assigned to another user: FORBIDDEN (403)', async () => {
    const dist = { id: 'd-9', department: 'PRODUCTION', assigned_to: otherUserId, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    await expect(
      ECNService.acknowledgeDistribution(mockEcnId, 'd-9', {}, operatorId, operatorToken)
    ).rejects.toThrow(ForbiddenError);
    expect(tx.eCNDistribution.update).not.toHaveBeenCalled();
  });

  // 10. Operator + unassigned distribution
  it('10. Operator + unassigned distribution: FORBIDDEN (403 - unassigned blocked)', async () => {
    const dist = { id: 'd-10', department: 'TOOLING', assigned_to: null, acknowledgement_status: 'PENDING' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    await expect(
      ECNService.acknowledgeDistribution(mockEcnId, 'd-10', {}, operatorId, operatorToken)
    ).rejects.toThrow(ForbiddenError);
    expect(tx.eCNDistribution.update).not.toHaveBeenCalled();
  });

  // 11. Duplicate acknowledgement
  it('11. Duplicate acknowledgement on already ACKNOWLEDGED distribution: CONFLICT (409)', async () => {
    const dist = { id: 'd-11', department: 'QUALITY', assigned_to: adminId, acknowledgement_status: 'ACKNOWLEDGED' };
    vi.spyOn(prisma.eCN, 'findUnique').mockResolvedValue(createMockEcn(dist) as any);
    const tx = mockPrismaTx();

    await expect(
      ECNService.acknowledgeDistribution(mockEcnId, 'd-11', {}, adminId, adminToken)
    ).rejects.toThrow(ConflictError);
    expect(tx.eCNDistribution.update).not.toHaveBeenCalled();
  });
});

