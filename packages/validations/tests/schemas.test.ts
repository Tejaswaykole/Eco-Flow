import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  CreateProductSchema,
  BOMComponentSchema,
  calculateBOMComponentTotal,
  CreateECOSchema,
  SubmitECOSchema,
  ProcessApprovalSchema,
} from '../src/index.js';
import { PriorityLevel, ChangeType, ImpactType, ApprovalDecision } from '@ecoflow/domain-types';

describe('Validation Schemas', () => {
  describe('LoginSchema', () => {
    it('validates correct login credentials', () => {
      const valid = LoginSchema.safeParse({
        email: 'engineer@ecoflow.com',
        password: 'Password123!',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects invalid email formats', () => {
      const invalid = LoginSchema.safeParse({
        email: 'not-an-email',
        password: 'Password123!',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain('Invalid email');
      }
    });

    it('rejects short passwords', () => {
      const invalid = LoginSchema.safeParse({
        email: 'test@ecoflow.com',
        password: 'short',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain('at least 8 characters');
      }
    });
  });

  describe('CreateProductSchema', () => {
    it('validates well-formed product payload', () => {
      const valid = CreateProductSchema.safeParse({
        productCode: 'PRD-001',
        productName: 'Hydraulic Valve System',
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
        description: 'Industrial high-pressure valve assembly',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects invalid product code characters', () => {
      const invalid = CreateProductSchema.safeParse({
        productCode: 'PRD #001 invalid!',
        productName: 'Hydraulic Valve System',
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain('alphanumeric');
      }
    });
  });

  describe('BOMComponentSchema', () => {
    it('validates valid component and calculates cost requirements', () => {
      const valid = BOMComponentSchema.safeParse({
        componentName: 'Titanium Bolt M8',
        materialType: 'Titanium Grade 5',
        quantity: 12,
        unit: 'pcs',
        unitCost: 4.5,
      });
      expect(valid.success).toBe(true);
    });

    it('rejects negative or zero quantities', () => {
      const invalid = BOMComponentSchema.safeParse({
        componentName: 'Titanium Bolt M8',
        materialType: 'Titanium Grade 5',
        quantity: 0,
        unit: 'pcs',
        unitCost: 4.5,
      });
      expect(invalid.success).toBe(false);
    });

    it('rejects negative unit costs', () => {
      const invalid = BOMComponentSchema.safeParse({
        componentName: 'Titanium Bolt M8',
        materialType: 'Titanium Grade 5',
        quantity: 5,
        unit: 'pcs',
        unitCost: -1.5,
      });
      expect(invalid.success).toBe(false);
    });

    it('rejects unit costs with more than 2 decimal places (fractional cents)', () => {
      const invalid = BOMComponentSchema.safeParse({
        componentName: 'Titanium Bolt M8',
        materialType: 'Titanium Grade 5',
        quantity: 5,
        unit: 'pcs',
        unitCost: 1.234,
      });
      expect(invalid.success).toBe(false);
    });

    it('calculates deterministic component total cost with monetary precision', () => {
      expect(calculateBOMComponentTotal(3, 10.25)).toBe(30.75);
      expect(calculateBOMComponentTotal(7, 1.33)).toBe(9.31);
      // Floating-point edge cases (e.g., 0.1 + 0.2 = 0.30000000000000004)
      expect(calculateBOMComponentTotal(3, 0.1)).toBe(0.3);
      expect(calculateBOMComponentTotal(19, 0.07)).toBe(1.33);
    });
  });

  describe('CreateECOSchema and SubmitECOSchema', () => {
    it('validates a complete ECO draft creation payload', () => {
      const valid = CreateECOSchema.safeParse({
        productId: '123e4567-e89b-12d3-a456-426614174000',
        bomId: '223e4567-e89b-12d3-a456-426614174000',
        title: 'Upgrade valve casing to high-temp alloy',
        reason: 'Customer reported wear at elevated temperatures in harsh environments',
        priority: PriorityLevel.HIGH,
        changes: [
          {
            changeType: ChangeType.MATERIAL_CHANGE,
            fieldName: 'materialType',
            oldValue: 'Steel 316L',
            newValue: 'Inconel 718',
            impactType: ImpactType.MATERIAL,
          },
        ],
      });
      expect(valid.success).toBe(true);
    });

    it('rejects title shorter than 3 characters', () => {
      const invalid = CreateECOSchema.safeParse({
        productId: '123e4567-e89b-12d3-a456-426614174000',
        bomId: '223e4567-e89b-12d3-a456-426614174000',
        title: 'Up',
      });
      expect(invalid.success).toBe(false);
    });

    it('enforces at least one change for ECO submission', () => {
      const invalid = SubmitECOSchema.safeParse({
        changes: [],
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain('at least one change record');
      }

      const valid = SubmitECOSchema.safeParse({
        changes: [
          {
            changeType: ChangeType.QUANTITY_CHANGE,
            fieldName: 'quantity',
            oldValue: '2',
            newValue: '4',
            impactType: ImpactType.MANUFACTURING,
          },
        ],
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('ProcessApprovalSchema', () => {
    it('allows approval without mandatory notes', () => {
      const valid = ProcessApprovalSchema.safeParse({
        decision: ApprovalDecision.APPROVED,
        reviewNotes: 'Looks solid, approved for production release.',
      });
      expect(valid.success).toBe(true);
    });

    it('requires review notes when rejecting', () => {
      const invalid = ProcessApprovalSchema.safeParse({
        decision: ApprovalDecision.REJECTED,
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain('Review notes are mandatory');
      }
    });

    it('requires review notes when requesting changes', () => {
      const invalid = ProcessApprovalSchema.safeParse({
        decision: ApprovalDecision.CHANGES_REQUESTED,
        reviewNotes: '   ',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain('Review notes are mandatory');
      }
    });
  });
});
