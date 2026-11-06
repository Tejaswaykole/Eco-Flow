import { ChangeType, ChangeTarget } from '@ecoflow/domain-types';
import { Decimal } from 'decimal.js';
import { createHash } from 'node:crypto';

// Configure Decimal.js precision and deterministic rounding
// Round half-up (ROUND_HALF_UP = 4) standard for financial and accounting calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface SnapshotComponent {
  id: string;
  part_number: string;
  name: string;
  component_type: string;
  quantity: string;
  unit_of_measure: string;
  unit_cost: string;
  total_cost: string;
  material_type?: string;
  notes?: string | null;
}

export interface FrozenSnapshot {
  product: {
    id: string;
    part_number: string;
    name: string;
    description?: string | null;
    [key: string]: any;
  };
  bom: {
    id: string;
    bom_number: string;
    current_version: number;
    description?: string | null;
    [key: string]: any;
  };
  components: SnapshotComponent[];
}

export interface SnapshotChange {
  id: string;
  change_type: ChangeType;
  change_target: ChangeTarget;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: Date;
}

/**
 * Standard RFC 4122 Predefined Namespaces
 */
export const RFC4122_DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Dedicated Permanent ECOFlow Root Component Namespace UUID.
 * Generated from RFC 4122 DNS namespace with name 'ecoflow.internal.components'.
 */
export const ECOFLOW_COMPONENT_NAMESPACE = '4a5e9f82-3d71-5b2c-9a10-2f8e4c6b8d0a';

/**
 * Authoritative Single Source of Truth for Specification Target Allowlists.
 * Maps ChangeTarget to allowed mutable property names.
 * Primary keys, part numbers, version counters, ownership, and system audit fields are forbidden.
 */
export const SPECIFICATION_ALLOWLIST: Record<ChangeTarget, ReadonlySet<string>> = {
  [ChangeTarget.PRODUCT]: new Set(['name', 'description']),
  [ChangeTarget.BOM]: new Set(['name', 'description']),
  [ChangeTarget.COMPONENT]: new Set(['material_type', 'notes']),
};

/**
 * Standard RFC 4122 UUID Version 5 implementation using SHA-1.
 * Complies strictly with RFC 4122 section 4.3.
 */
export function generateUuidV5(namespaceUuid: string, name: string): string {
  const cleanNamespace = namespaceUuid.replace(/-/g, '');
  if (cleanNamespace.length !== 32) {
    throw new Error('Invalid namespace UUID length: must be 32 hex characters');
  }
  const namespaceBytes = Buffer.from(cleanNamespace, 'hex');

  // SHA-1(namespaceBytes || UTF-8(name))
  const hash = createHash('sha1')
    .update(namespaceBytes)
    .update(Buffer.from(name, 'utf8'))
    .digest();

  // Set version to 5 in octet 6 (bits 4-7 = 0101)
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  // Set variant to 1 (RFC 4122) in octet 8 (bits 6-7 = 10)
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;

  const hex = hash.toString('hex').substring(0, 32);
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

/**
 * Deterministically generates an RFC 4122 UUID v5 for newly added components.
 */
export function generateDeterministicComponentId(
  ecoId: string,
  revisionNumber: number,
  changeId: string,
  partNumber: string
): string {
  const seed = `ECO:${ecoId}:REV:${revisionNumber}:CHANGE:${changeId}:PART:${partNumber}`;
  return generateUuidV5(ECOFLOW_COMPONENT_NAMESPACE, seed);
}

/**
 * Strict Decimal.js parsing and precision validation.
 * Quantity scale: exactly 4 decimal places.
 * Unit cost scale: exactly 2 decimal places.
 */
export function parseExactDecimal(
  val: string | number | null | undefined,
  maxScale: number,
  fieldName: string
): Decimal {
  if (val === null || val === undefined || val === '') {
    throw new Error(`Numeric field ${fieldName} cannot be empty`);
  }
  const str = String(val).trim();
  if (str === 'NaN' || str === 'Infinity' || str === '-Infinity') {
    throw new Error(`Numeric field ${fieldName} must be a valid finite number (found ${val})`);
  }

  let d: Decimal;
  try {
    d = new Decimal(str);
  } catch (err: any) {
    throw new Error(`Invalid numeric decimal value for ${fieldName}: ${val}`);
  }

  if (!d.isFinite() || d.isNaN()) {
    throw new Error(`Numeric field ${fieldName} must be a valid finite number (found ${val})`);
  }

  // Enforce scale limit
  const decimalPlaces = d.decimalPlaces();
  if (decimalPlaces > maxScale) {
    throw new Error(
      `Numeric field ${fieldName} exceeds maximum scale of ${maxScale} decimal places (found ${decimalPlaces})`
    );
  }

  return d;
}

/**
 * Exact deterministic total cost computation using Decimal.js:
 * total_cost = quantity * unit_cost (rounded to 2 decimal places with ROUND_HALF_UP).
 */
export function computeTotalCost(quantityStr: string, unitCostStr: string): string {
  const qty = parseExactDecimal(quantityStr, 4, 'quantity');
  const unitCost = parseExactDecimal(unitCostStr, 2, 'unit_cost');
  return qty.mul(unitCost).toFixed(2, Decimal.ROUND_HALF_UP);
}

/**
 * Validates baseline frozen snapshot data structure, uniqueness, and invariants.
 */
export function validateFrozenSnapshotStructure(snapshot: FrozenSnapshot): void {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Invalid snapshot structure: must be an object');
  }
  if (!snapshot.product || typeof snapshot.product !== 'object' || !snapshot.product.id || !snapshot.product.part_number) {
    throw new Error('Invalid snapshot structure: missing product identity');
  }
  if (!snapshot.bom || typeof snapshot.bom !== 'object' || !snapshot.bom.id || !snapshot.bom.bom_number) {
    throw new Error('Invalid snapshot structure: missing BOM identity');
  }
  if (!Array.isArray(snapshot.components)) {
    throw new Error('Invalid snapshot structure: components array is required');
  }

  const seenIds = new Set<string>();
  const seenParts = new Set<string>();

  for (const comp of snapshot.components) {
    if (!comp.id || typeof comp.id !== 'string') {
      throw new Error('Component missing stable UUID identifier');
    }
    if (seenIds.has(comp.id)) {
      throw new Error(`Duplicate component identifier in snapshot: ${comp.id}`);
    }
    seenIds.add(comp.id);

    if (!comp.part_number || typeof comp.part_number !== 'string' || comp.part_number.trim().length === 0) {
      throw new Error('Component missing part_number');
    }
    if (seenParts.has(comp.part_number)) {
      throw new Error(`Duplicate component part_number in snapshot: ${comp.part_number}`);
    }
    seenParts.add(comp.part_number);

    const qty = parseExactDecimal(comp.quantity, 4, `${comp.part_number}.quantity`);
    const unitCost = parseExactDecimal(comp.unit_cost, 2, `${comp.part_number}.unit_cost`);
    if (qty.lte(0)) throw new Error(`Component ${comp.part_number} quantity must be > 0`);
    if (unitCost.lt(0)) throw new Error(`Component ${comp.part_number} unit_cost must be >= 0`);

    const expectedTotal = computeTotalCost(comp.quantity, comp.unit_cost);
    const actualTotal = parseExactDecimal(comp.total_cost, 2, `${comp.part_number}.total_cost`).toFixed(2);
    if (actualTotal !== expectedTotal) {
      throw new Error(
        `Component ${comp.part_number} total cost mismatch (expected ${expectedTotal}, found ${comp.total_cost})`
      );
    }
  }
}

/**
 * Applies approved ECO changes deterministically to a frozen snapshot.
 * Guarantees snapshot immutability, deterministic repeatable IDs, and sequential change semantics.
 */
export function applyChangesToFrozenSnapshot(
  rawSnapshot: FrozenSnapshot,
  changes: SnapshotChange[],
  ecoId: string,
  revisionNumber: number
): FrozenSnapshot {
  if (!ecoId || typeof ecoId !== 'string') {
    throw new Error('Valid ecoId is required for snapshot transformation');
  }
  if (!revisionNumber || revisionNumber < 1 || !Number.isInteger(revisionNumber)) {
    throw new Error('Valid positive integer revisionNumber is required for snapshot transformation');
  }

  // Baseline input validation
  validateFrozenSnapshotStructure(rawSnapshot);

  // Deep clone to guarantee input snapshot immutability
  const cloned: FrozenSnapshot = JSON.parse(JSON.stringify(rawSnapshot));

  // Deterministic processing order: created_at ASC, id ASC
  const sortedChanges = [...changes].sort((a, b) => {
    const timeCmp = a.created_at.getTime() - b.created_at.getTime();
    return timeCmp !== 0 ? timeCmp : a.id.localeCompare(b.id);
  });

  const processedChangeIds = new Set<string>();
  const removedPartNumbers = new Set<string>();

  for (const change of sortedChanges) {
    if (processedChangeIds.has(change.id)) {
      throw new Error(`Duplicate change application detected: ${change.id}`);
    }
    processedChangeIds.add(change.id);

    // Validate target discriminator compatibility
    if (
      [
        ChangeType.QUANTITY_CHANGE,
        ChangeType.COST_CHANGE,
        ChangeType.MATERIAL_CHANGE,
        ChangeType.COMPONENT_ADDITION,
        ChangeType.COMPONENT_REMOVAL,
      ].includes(change.change_type) &&
      change.change_target !== ChangeTarget.COMPONENT
    ) {
      throw new Error(`${change.change_type} requires change_target to be COMPONENT`);
    }

    if (
      change.change_type === ChangeType.SPECIFICATION_CHANGE &&
      change.change_target === ChangeTarget.COMPONENT
    ) {
      throw new Error('SPECIFICATION_CHANGE target must be PRODUCT or BOM');
    }

    switch (change.change_type) {
      case ChangeType.QUANTITY_CHANGE: {
        const partNumber = change.field_name;
        if (removedPartNumbers.has(partNumber)) {
          throw new Error(
            `Cannot modify quantity of component ${partNumber}: component was removed earlier in this revision`
          );
        }
        const matches = cloned.components.filter((c) => c.part_number === partNumber);
        if (matches.length === 0 || !matches[0]) throw new Error(`Target component ${partNumber} not found for QUANTITY_CHANGE`);
        if (matches.length > 1) throw new Error(`Ambiguous component target: multiple components found with part_number ${partNumber}`);
        const comp = matches[0];

        // Sequential precondition validation against current intermediate snapshot
        if (change.old_value !== null && change.old_value !== undefined) {
          const expectedQty = parseExactDecimal(change.old_value, 4, 'old_value').toFixed(4);
          if (comp.quantity !== expectedQty) {
            throw new Error(
              `Precondition failed: Expected old value ${expectedQty} for ${partNumber}.quantity, found ${comp.quantity}`
            );
          }
        }

        const newQty = parseExactDecimal(change.new_value, 4, 'new_value');
        if (newQty.lte(0)) throw new Error(`Quantity must be > 0 (found ${change.new_value})`);

        comp.quantity = newQty.toFixed(4);
        comp.total_cost = computeTotalCost(comp.quantity, comp.unit_cost);
        break;
      }

      case ChangeType.COST_CHANGE: {
        const partNumber = change.field_name;
        if (removedPartNumbers.has(partNumber)) {
          throw new Error(
            `Cannot modify cost of component ${partNumber}: component was removed earlier in this revision`
          );
        }
        const matches = cloned.components.filter((c) => c.part_number === partNumber);
        if (matches.length === 0 || !matches[0]) throw new Error(`Target component ${partNumber} not found for COST_CHANGE`);
        if (matches.length > 1) throw new Error(`Ambiguous component target: multiple components found with part_number ${partNumber}`);
        const comp = matches[0];

        // Sequential precondition validation against current intermediate snapshot
        if (change.old_value !== null && change.old_value !== undefined) {
          const expectedCost = parseExactDecimal(change.old_value, 2, 'old_value').toFixed(2);
          if (comp.unit_cost !== expectedCost) {
            throw new Error(
              `Precondition failed: Expected old value ${expectedCost} for ${partNumber}.unit_cost, found ${comp.unit_cost}`
            );
          }
        }

        const newCost = parseExactDecimal(change.new_value, 2, 'new_value');
        if (newCost.lt(0)) throw new Error(`Unit cost must be >= 0 (found ${change.new_value})`);

        comp.unit_cost = newCost.toFixed(2);
        comp.total_cost = computeTotalCost(comp.quantity, comp.unit_cost);
        break;
      }

      case ChangeType.MATERIAL_CHANGE: {
        const partNumber = change.field_name;
        if (removedPartNumbers.has(partNumber)) {
          throw new Error(
            `Cannot modify material of component ${partNumber}: component was removed earlier in this revision`
          );
        }
        const matches = cloned.components.filter((c) => c.part_number === partNumber);
        if (matches.length === 0 || !matches[0]) throw new Error(`Target component ${partNumber} not found for MATERIAL_CHANGE`);
        if (matches.length > 1) throw new Error(`Ambiguous component target: multiple components found with part_number ${partNumber}`);
        const comp = matches[0];

        if (change.old_value !== null && change.old_value !== undefined) {
          if (comp.material_type !== change.old_value) {
            throw new Error(
              `Precondition failed: Expected old value "${change.old_value}" for ${partNumber}.material_type, found "${comp.material_type}"`
            );
          }
        }

        if (!change.new_value || change.new_value.trim().length === 0) {
          throw new Error('Material specification cannot be empty');
        }
        comp.material_type = change.new_value.trim();
        break;
      }

      case ChangeType.COMPONENT_ADDITION: {
        const payload = JSON.parse(change.new_value || '{}');
        const partNumber = payload.part_number || change.field_name;
        if (!partNumber || !payload.name) {
          throw new Error('COMPONENT_ADDITION requires valid part_number and name');
        }
        if (cloned.components.some((c) => c.part_number === partNumber)) {
          throw new Error(`Component with part_number ${partNumber} already exists`);
        }

        const qty = parseExactDecimal(payload.quantity || '1', 4, 'addition.quantity');
        const unitCost = parseExactDecimal(payload.unit_cost || '0', 2, 'addition.unit_cost');
        if (qty.lte(0) || unitCost.lt(0)) {
          throw new Error('Invalid quantity or cost for component addition');
        }

        const deterministicId = generateDeterministicComponentId(
          ecoId,
          revisionNumber,
          change.id,
          partNumber
        );

        cloned.components.push({
          id: deterministicId,
          part_number: partNumber,
          name: payload.name,
          component_type: payload.component_type || 'RAW_MATERIAL',
          quantity: qty.toFixed(4),
          unit_of_measure: payload.unit_of_measure || 'PCS',
          unit_cost: unitCost.toFixed(2),
          total_cost: computeTotalCost(qty.toFixed(4), unitCost.toFixed(2)),
          material_type: payload.material_type || undefined,
          notes: payload.notes || null,
        });
        break;
      }

      case ChangeType.COMPONENT_REMOVAL: {
        const partNumber = change.field_name;
        const index = cloned.components.findIndex((c) => c.part_number === partNumber);
        if (index === -1) {
          throw new Error(`Target component ${partNumber} not found for COMPONENT_REMOVAL`);
        }
        cloned.components.splice(index, 1);
        removedPartNumbers.add(partNumber);
        break;
      }

      case ChangeType.SPECIFICATION_CHANGE: {
        const allowedFields = SPECIFICATION_ALLOWLIST[change.change_target];
        if (!allowedFields || !allowedFields.has(change.field_name)) {
          throw new Error(
            `Field ${change.field_name} is not in the ${change.change_target} specification change allowlist`
          );
        }

        const targetObj =
          change.change_target === ChangeTarget.PRODUCT ? cloned.product : cloned.bom;

        if (change.old_value !== null && change.old_value !== undefined) {
          const currentVal = targetObj[change.field_name] || null;
          if (currentVal !== change.old_value) {
            throw new Error(
              `Precondition failed: Expected old value "${change.old_value}" for ${change.change_target}.${change.field_name}, found "${currentVal}"`
            );
          }
        }

        targetObj[change.field_name] = change.new_value;
        break;
      }

      default:
        throw new Error(`Unsupported change type: ${change.change_type}`);
    }
  }

  // Post-transformation structural & invariant validation
  validateFrozenSnapshotStructure(cloned);

  return cloned;
}
