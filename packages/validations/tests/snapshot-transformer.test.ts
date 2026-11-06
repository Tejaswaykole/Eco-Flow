import { describe, it, expect } from 'vitest';
import {
  applyChangesToFrozenSnapshot,
  generateDeterministicComponentId,
  generateUuidV5,
  RFC4122_DNS_NAMESPACE,
  ECOFLOW_COMPONENT_NAMESPACE,
  SPECIFICATION_ALLOWLIST,
  computeTotalCost,
  parseExactDecimal,
  FrozenSnapshot,
  SnapshotChange,
} from '../src/snapshot-transformer.js';
import { ChangeType, ChangeTarget } from '@ecoflow/domain-types';

describe('Milestone 3.1.9: Final UUID, Decimal & Contract Consistency Audit', () => {
  const baseSnapshot: FrozenSnapshot = {
    product: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      part_number: 'PROD-001',
      name: 'Industrial Valve Assembly',
      description: 'Heavy duty flow valve',
    },
    bom: {
      id: '223e4567-e89b-12d3-a456-426614174000',
      bom_number: 'BOM-001',
      current_version: 1,
      description: 'Standard Bill of Materials',
    },
    components: [
      {
        id: '323e4567-e89b-12d3-a456-426614174000',
        part_number: 'COMP-100',
        name: 'Steel Flange',
        component_type: 'HARDWARE',
        quantity: '2.0000',
        unit_of_measure: 'PCS',
        unit_cost: '25.00',
        total_cost: '50.00',
        material_type: 'Steel 316L',
        notes: 'Initial component',
      },
      {
        id: '423e4567-e89b-12d3-a456-426614174000',
        part_number: 'COMP-200',
        name: 'O-Ring Seal',
        component_type: 'RAW_MATERIAL',
        quantity: '4.0000',
        unit_of_measure: 'PCS',
        unit_cost: '1.50',
        total_cost: '6.00',
        material_type: 'Viton',
      },
    ],
  };

  const ecoId = '923e4567-e89b-12d3-a456-426614174000';
  const revisionNumber = 1;

  describe('1. UUID v5 Standard Test Vectors & RFC 4122 Compliance', () => {
    it('matches known official RFC 4122 UUID v5 test vector for python.org', () => {
      // Official RFC 4122 Appendix B test vector:
      // Namespace: 6ba7b810-9dad-11d1-80b4-00c04fd430c8 (DNS namespace)
      // Name: "python.org"
      // Expected UUID v5: "886313e1-3b8a-5372-9b90-0c9aee199e5d"
      const vectorResult = generateUuidV5(RFC4122_DNS_NAMESPACE, 'python.org');
      expect(vectorResult).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
    });

    it('produces standard RFC 4122 UUID v5 with correct version (5) and variant (RFC 4122) bits', () => {
      const id1 = generateDeterministicComponentId(ecoId, 1, 'change-1', 'COMP-NEW');
      const id2 = generateDeterministicComponentId(ecoId, 1, 'change-1', 'COMP-NEW');

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(id1.charAt(14)).toBe('5'); // Octet 6 version = 5
      expect(['8', '9', 'a', 'b']).toContain(id1.charAt(19)); // Octet 8 variant = 1
    });

    it('generates different UUIDs for different revisions and change IDs', () => {
      const idRev1 = generateDeterministicComponentId(ecoId, 1, 'change-1', 'COMP-NEW');
      const idRev2 = generateDeterministicComponentId(ecoId, 2, 'change-1', 'COMP-NEW');
      const idDiffChange = generateDeterministicComponentId(ecoId, 1, 'change-2', 'COMP-NEW');
      const idDiffPart = generateDeterministicComponentId(ecoId, 1, 'change-1', 'COMP-OTHER');

      expect(idRev1).not.toBe(idRev2);
      expect(idRev1).not.toBe(idDiffChange);
      expect(idRev1).not.toBe(idDiffPart);
    });
  });

  describe('2. Exact Decimal.js Monetary Arithmetic & Rounding Invariants', () => {
    it('calculates total cost accurately without floating point representation drift', () => {
      // Classic IEEE-754 binary floating point precision error: 0.1 + 0.2 !== 0.3 or 19.99 * 3 = 59.970000000000006
      const qty = '3.0000';
      const unitCost = '19.99';
      const total = computeTotalCost(qty, unitCost);
      expect(total).toBe('59.97');
    });

    it('enforces exact ROUND_HALF_UP rounding rules on fractional cents', () => {
      // 1.0005 * 1.00 = 1.0005 -> rounds to 1.00
      expect(computeTotalCost('1.0005', '1.00')).toBe('1.00');
      // 1.0050 * 1.00 = 1.0050 -> rounds to 1.01
      expect(computeTotalCost('1.0050', '1.00')).toBe('1.01');
      // 2.5 * 0.05 = 0.125 -> rounds to 0.13
      expect(computeTotalCost('2.5000', '0.05')).toBe('0.13');
      // 2.5 * 0.03 = 0.075 -> rounds to 0.08
      expect(computeTotalCost('2.5000', '0.03')).toBe('0.08');
    });

    it('rejects values exceeding allowed maximum scale (scale 4 for qty, scale 2 for cost)', () => {
      expect(() => parseExactDecimal('2.12345', 4, 'quantity')).toThrow(
        /exceeds maximum scale of 4 decimal places/
      );
      expect(() => parseExactDecimal('10.999', 2, 'unit_cost')).toThrow(
        /exceeds maximum scale of 2 decimal places/
      );
    });

    it('rejects NaN, Infinity, -Infinity, and invalid non-numeric strings', () => {
      expect(() => parseExactDecimal('NaN', 4, 'quantity')).toThrow(/must be a valid finite number/);
      expect(() => parseExactDecimal('Infinity', 2, 'unit_cost')).toThrow(/must be a valid finite number/);
      expect(() => parseExactDecimal('-Infinity', 2, 'unit_cost')).toThrow(/must be a valid finite number/);
      expect(() => parseExactDecimal('abc', 2, 'unit_cost')).toThrow(/Invalid numeric decimal value/);
      expect(() => parseExactDecimal('', 2, 'unit_cost')).toThrow(/cannot be empty/);
    });
  });

  describe('3. Sequential Change Semantics & Conflict Detection', () => {
    it('applies sequential quantity updates where subsequent old_value matches intermediate state', () => {
      const sequentialChanges: SnapshotChange[] = [
        {
          id: 'step-1',
          change_type: ChangeType.QUANTITY_CHANGE,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-100',
          old_value: '2.0000',
          new_value: '5.0000',
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: 'step-2',
          change_type: ChangeType.QUANTITY_CHANGE,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-100',
          old_value: '5.0000',
          new_value: '8.0000',
          created_at: new Date('2026-01-01T10:05:00Z'),
        },
      ];

      const result = applyChangesToFrozenSnapshot(baseSnapshot, sequentialChanges, ecoId, revisionNumber);
      const comp = result.components.find((c) => c.part_number === 'COMP-100')!;
      expect(comp.quantity).toBe('8.0000');
      expect(comp.total_cost).toBe('200.00'); // 8.0000 * 25.00
    });

    it('rejects sequential change when intermediate old_value does not match preceding result', () => {
      const invalidSequence: SnapshotChange[] = [
        {
          id: 'step-1',
          change_type: ChangeType.QUANTITY_CHANGE,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-100',
          old_value: '2.0000',
          new_value: '5.0000',
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: 'step-2',
          change_type: ChangeType.QUANTITY_CHANGE,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-100',
          old_value: '2.0000', // Stale! Intermediate is now 5.0000
          new_value: '10.0000',
          created_at: new Date('2026-01-01T10:05:00Z'),
        },
      ];

      expect(() => applyChangesToFrozenSnapshot(baseSnapshot, invalidSequence, ecoId, revisionNumber)).toThrow(
        /Precondition failed: Expected old value 2.0000 for COMP-100.quantity, found 5.0000/
      );
    });

    it('allows component addition followed by modification in the same revision', () => {
      const addThenModify: SnapshotChange[] = [
        {
          id: 'add-1',
          change_type: ChangeType.COMPONENT_ADDITION,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-300',
          old_value: null,
          new_value: JSON.stringify({
            part_number: 'COMP-300',
            name: 'Check Valve',
            component_type: 'HARDWARE',
            quantity: '1.0000',
            unit_of_measure: 'PCS',
            unit_cost: '10.00',
          }),
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: 'mod-1',
          change_type: ChangeType.QUANTITY_CHANGE,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-300',
          old_value: '1.0000',
          new_value: '3.0000',
          created_at: new Date('2026-01-01T10:05:00Z'),
        },
      ];

      const result = applyChangesToFrozenSnapshot(baseSnapshot, addThenModify, ecoId, revisionNumber);
      const addedComp = result.components.find((c) => c.part_number === 'COMP-300')!;
      expect(addedComp.quantity).toBe('3.0000');
      expect(addedComp.total_cost).toBe('30.00'); // 3.0000 * 10.00
    });

    it('rejects modification after component removal within same revision', () => {
      const removeThenModify: SnapshotChange[] = [
        {
          id: 'rem-1',
          change_type: ChangeType.COMPONENT_REMOVAL,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-100',
          old_value: null,
          new_value: null,
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: 'mod-after-rem',
          change_type: ChangeType.COST_CHANGE,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-100',
          old_value: '25.00',
          new_value: '30.00',
          created_at: new Date('2026-01-01T10:05:00Z'),
        },
      ];

      expect(() => applyChangesToFrozenSnapshot(baseSnapshot, removeThenModify, ecoId, revisionNumber)).toThrow(
        /was removed earlier in this revision/
      );
    });
  });

  describe('4. Specification Target Allowlist Consistency & Rejections', () => {
    it('allows valid specification changes on PRODUCT and BOM allowlisted fields', () => {
      const validSpecChanges: SnapshotChange[] = [
        {
          id: 'prod-desc',
          change_type: ChangeType.SPECIFICATION_CHANGE,
          change_target: ChangeTarget.PRODUCT,
          field_name: 'description',
          old_value: 'Heavy duty flow valve',
          new_value: 'Updated high-pressure flow valve',
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
        {
          id: 'bom-desc',
          change_type: ChangeType.SPECIFICATION_CHANGE,
          change_target: ChangeTarget.BOM,
          field_name: 'description',
          old_value: 'Standard Bill of Materials',
          new_value: 'Standard Bill of Materials Rev B',
          created_at: new Date('2026-01-01T10:05:00Z'),
        },
      ];

      const result = applyChangesToFrozenSnapshot(baseSnapshot, validSpecChanges, ecoId, revisionNumber);
      expect(result.product.description).toBe('Updated high-pressure flow valve');
      expect(result.bom.description).toBe('Standard Bill of Materials Rev B');
    });

    it('rejects disallowed system fields and cross-target modifications', () => {
      const disallowedField: SnapshotChange[] = [
        {
          id: 'disallow-id',
          change_type: ChangeType.SPECIFICATION_CHANGE,
          change_target: ChangeTarget.PRODUCT,
          field_name: 'id',
          old_value: baseSnapshot.product.id,
          new_value: '423e4567-e89b-12d3-a456-426614174999',
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
      ];

      expect(() => applyChangesToFrozenSnapshot(baseSnapshot, disallowedField, ecoId, revisionNumber)).toThrow(
        /Field id is not in the PRODUCT specification change allowlist/
      );

      const disallowedBomVersion: SnapshotChange[] = [
        {
          id: 'disallow-bom-ver',
          change_type: ChangeType.SPECIFICATION_CHANGE,
          change_target: ChangeTarget.BOM,
          field_name: 'current_version',
          old_value: '1',
          new_value: '2',
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
      ];

      expect(() => applyChangesToFrozenSnapshot(baseSnapshot, disallowedBomVersion, ecoId, revisionNumber)).toThrow(
        /Field current_version is not in the BOM specification change allowlist/
      );
    });
  });

  describe('5. Baseline Snapshot Validation & Immutability', () => {
    it('rejects snapshots with duplicate component identifiers or duplicate part numbers', () => {
      const duplicateIds: FrozenSnapshot = JSON.parse(JSON.stringify(baseSnapshot));
      duplicateIds.components[1].id = duplicateIds.components[0].id;

      expect(() => applyChangesToFrozenSnapshot(duplicateIds, [], ecoId, revisionNumber)).toThrow(
        /Duplicate component identifier in snapshot/
      );

      const duplicateParts: FrozenSnapshot = JSON.parse(JSON.stringify(baseSnapshot));
      duplicateParts.components[1].part_number = duplicateParts.components[0].part_number;

      expect(() => applyChangesToFrozenSnapshot(duplicateParts, [], ecoId, revisionNumber)).toThrow(
        /Duplicate component part_number in snapshot/
      );
    });

    it('never mutates the input snapshot object', () => {
      const snapshotCopy = JSON.parse(JSON.stringify(baseSnapshot));
      const changes: SnapshotChange[] = [
        {
          id: 'c-mod',
          change_type: ChangeType.QUANTITY_CHANGE,
          change_target: ChangeTarget.COMPONENT,
          field_name: 'COMP-100',
          old_value: '2.0000',
          new_value: '100.0000',
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
      ];

      applyChangesToFrozenSnapshot(baseSnapshot, changes, ecoId, revisionNumber);
      expect(JSON.stringify(baseSnapshot)).toBe(JSON.stringify(snapshotCopy));
    });
  });
});
