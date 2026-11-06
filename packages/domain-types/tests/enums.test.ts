import { describe, it, expect } from 'vitest';
import {
  UserStatus,
  ECOStatus,
  PriorityLevel,
  ChangeType,
  ImpactType,
  ApprovalDecision,
  ProductStatus,
  BOMStatus,
} from '../src/index.js';

describe('Domain Types Enums', () => {
  it('should define correct UserStatus enums', () => {
    expect(UserStatus.PENDING).toBe('PENDING');
    expect(UserStatus.ACTIVE).toBe('ACTIVE');
    expect(UserStatus.INACTIVE).toBe('INACTIVE');
    expect(UserStatus.SUSPENDED).toBe('SUSPENDED');
  });

  it('should define correct ECOStatus enums', () => {
    expect(ECOStatus.DRAFT).toBe('DRAFT');
    expect(ECOStatus.SUBMITTED).toBe('SUBMITTED');
    expect(ECOStatus.UNDER_REVIEW).toBe('UNDER_REVIEW');
    expect(ECOStatus.CHANGES_REQUESTED).toBe('CHANGES_REQUESTED');
    expect(ECOStatus.APPROVED).toBe('APPROVED');
    expect(ECOStatus.REJECTED).toBe('REJECTED');
    expect(ECOStatus.CANCELLED).toBe('CANCELLED');
  });

  it('should define correct PriorityLevel enums', () => {
    expect(PriorityLevel.LOW).toBe('LOW');
    expect(PriorityLevel.MEDIUM).toBe('MEDIUM');
    expect(PriorityLevel.HIGH).toBe('HIGH');
    expect(PriorityLevel.CRITICAL).toBe('CRITICAL');
  });

  it('should define correct ChangeType enums', () => {
    expect(ChangeType.QUANTITY_CHANGE).toBe('QUANTITY_CHANGE');
    expect(ChangeType.MATERIAL_CHANGE).toBe('MATERIAL_CHANGE');
    expect(ChangeType.COST_CHANGE).toBe('COST_CHANGE');
    expect(ChangeType.COMPONENT_ADDITION).toBe('COMPONENT_ADDITION');
    expect(ChangeType.COMPONENT_REMOVAL).toBe('COMPONENT_REMOVAL');
    expect(ChangeType.SPECIFICATION_CHANGE).toBe('SPECIFICATION_CHANGE');
  });

  it('should define correct ImpactType enums', () => {
    expect(ImpactType.COST).toBe('COST');
    expect(ImpactType.MATERIAL).toBe('MATERIAL');
    expect(ImpactType.MANUFACTURING).toBe('MANUFACTURING');
    expect(ImpactType.QUALITY).toBe('QUALITY');
    expect(ImpactType.COMPLIANCE).toBe('COMPLIANCE');
  });

  it('should define correct ApprovalDecision enums', () => {
    expect(ApprovalDecision.APPROVED).toBe('APPROVED');
    expect(ApprovalDecision.REJECTED).toBe('REJECTED');
    expect(ApprovalDecision.CHANGES_REQUESTED).toBe('CHANGES_REQUESTED');
  });

  it('should define correct ProductStatus and BOMStatus enums', () => {
    expect(ProductStatus.DRAFT).toBe('DRAFT');
    expect(ProductStatus.ACTIVE).toBe('ACTIVE');
    expect(ProductStatus.ARCHIVED).toBe('ARCHIVED');
    expect(BOMStatus.DRAFT).toBe('DRAFT');
  });
});
