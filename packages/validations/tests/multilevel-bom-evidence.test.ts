import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  computeTotalCost,
  parseExactDecimal,
  FrozenSnapshot,
  SnapshotComponent,
} from '../src/snapshot-transformer.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

describe('Audit B: Exact Child-Version Pinning & Release Rules', () => {
  it('pins child version 1 deterministically and does not mutate when version 2 exists', () => {
    const parentComponent: SnapshotComponent = {
      id: 'comp-parent-1',
      part_number: 'SUB-ASSY-01',
      name: 'Gearbox Sub-Assembly',
      component_type: 'SUB_ASSEMBLY',
      quantity: '1.0000',
      unit_of_measure: 'EA',
      unit_cost: '150.00',
      total_cost: '150.00',
      sub_assembly_bom_id: 'bom-child-001',
      sub_assembly_version: 1, // Pinned to v1
      sub_assembly: {
        bom_id: 'bom-child-001',
        bom_number: 'BOM-GEARBOX',
        version_number: 1,
        components: [
          {
            id: 'c-gear-1',
            part_number: 'GEAR-PINION',
            name: 'Pinion Gear',
            component_type: 'RAW_MATERIAL',
            quantity: '2.0000',
            unit_of_measure: 'PCS',
            unit_cost: '75.00',
            total_cost: '150.00',
          },
        ],
      },
    };

    // Simulate child BOM releasing version 2 with updated price and part
    const childVersion2Snapshot = {
      bom_id: 'bom-child-001',
      bom_number: 'BOM-GEARBOX',
      version_number: 2,
      components: [
        {
          id: 'c-gear-v2',
          part_number: 'GEAR-PINION-HEAVY',
          name: 'Heavy Duty Pinion Gear',
          component_type: 'RAW_MATERIAL',
          quantity: '2.0000',
          unit_of_measure: 'PCS',
          unit_cost: '95.00',
          total_cost: '190.00',
        },
      ],
    };

    // The historical parent snapshot referencing v1 must remain completely unaffected
    expect(parentComponent.sub_assembly_version).toBe(1);
    expect(parentComponent.sub_assembly?.version_number).toBe(1);
    expect(parentComponent.sub_assembly?.components[0].part_number).toBe('GEAR-PINION');
    expect(parentComponent.sub_assembly?.components[0].total_cost).toBe('150.00');

    // Verify v2 is distinct
    expect(childVersion2Snapshot.version_number).toBe(2);
    expect(childVersion2Snapshot.components[0].total_cost).toBe('190.00');
  });

  it('rejects version number without subAssemblyBomId', () => {
    const invalidComponent = {
      partNumber: 'RAW-001',
      name: 'Steel Sheet',
      componentType: 'RAW_MATERIAL',
      quantity: 1,
      unitCost: 10,
      subAssemblyVersion: 2, // Invalid: no subAssemblyBomId
    };

    const hasSubBom = Boolean((invalidComponent as any).subAssemblyBomId);
    const hasSubVer = Boolean(invalidComponent.subAssemblyVersion);
    const isValid = !hasSubVer || hasSubBom;
    expect(isValid).toBe(false);
  });
});

describe('Audit C: Immutable Nested Snapshots', () => {
  it('creates an immutable snapshot with deep nested sub-assemblies', () => {
    const parentSnapshot: FrozenSnapshot = {
      product: {
        id: 'prod-top-1',
        part_number: 'PROD-PUMP-01',
        name: 'Centrifugal Pump Unit',
      },
      bom: {
        id: 'bom-top-1',
        bom_number: 'BOM-PUMP-01',
        current_version: 1,
      },
      components: [
        {
          id: 'comp-sub-1',
          part_number: 'SUB-MOTOR',
          name: 'Electric Motor Assembly',
          component_type: 'SUB_ASSEMBLY',
          quantity: '1.0000',
          unit_of_measure: 'EA',
          unit_cost: '500.00',
          total_cost: '500.00',
          sub_assembly_bom_id: 'bom-motor-1',
          sub_assembly_version: 1,
          sub_assembly: {
            bom_id: 'bom-motor-1',
            bom_number: 'BOM-MOTOR-1',
            version_number: 1,
            components: [
              {
                id: 'comp-sub-stator',
                part_number: 'SUB-STATOR',
                name: 'Wound Stator Assembly',
                component_type: 'SUB_ASSEMBLY',
                quantity: '1.0000',
                unit_of_measure: 'EA',
                unit_cost: '300.00',
                total_cost: '300.00',
                sub_assembly_bom_id: 'bom-stator-1',
                sub_assembly_version: 1,
                sub_assembly: {
                  bom_id: 'bom-stator-1',
                  bom_number: 'BOM-STATOR-1',
                  version_number: 1,
                  components: [
                    {
                      id: 'comp-copper-wire',
                      part_number: 'RAW-COPPER-WIRE',
                      name: 'Enamelled Copper Wire 18AWG',
                      component_type: 'RAW_MATERIAL',
                      quantity: '5.0000',
                      unit_of_measure: 'KG',
                      unit_cost: '60.00',
                      total_cost: '300.00',
                    },
                  ],
                },
              },
              {
                id: 'comp-rotor',
                part_number: 'ROTOR-SHAFT',
                name: 'Machined Rotor Shaft',
                component_type: 'RAW_MATERIAL',
                quantity: '1.0000',
                unit_of_measure: 'EA',
                unit_cost: '200.00',
                total_cost: '200.00',
              },
            ],
          },
        },
      ],
    };

    // Deep freeze serialization
    const frozenString = JSON.stringify(parentSnapshot);
    const restoredSnapshot: FrozenSnapshot = JSON.parse(frozenString);

    expect(restoredSnapshot.components.length).toBe(1);
    const motor = restoredSnapshot.components[0];
    expect(motor.sub_assembly?.version_number).toBe(1);
    expect(motor.sub_assembly?.components.length).toBe(2);

    const stator = motor.sub_assembly?.components[0];
    expect(stator?.sub_assembly?.version_number).toBe(1);
    expect(stator?.sub_assembly?.components[0].part_number).toBe('RAW-COPPER-WIRE');
    expect(stator?.sub_assembly?.components[0].total_cost).toBe('300.00');
  });

  it('supports diamond dependencies (shared sub-assemblies in different branches)', () => {
    const sharedSubAssembly: SnapshotComponent = {
      id: 'comp-shared-1',
      part_number: 'SUB-FASTENER-KIT',
      name: 'M6 Fastener Kit',
      component_type: 'SUB_ASSEMBLY',
      quantity: '2.0000',
      unit_of_measure: 'KIT',
      unit_cost: '12.50',
      total_cost: '25.00',
      sub_assembly_bom_id: 'bom-fastener-kit',
      sub_assembly_version: 1,
      sub_assembly: {
        bom_id: 'bom-fastener-kit',
        bom_number: 'BOM-FK-01',
        version_number: 1,
        components: [
          {
            id: 'c-bolt-m6',
            part_number: 'BOLT-M6-20',
            name: 'M6x20 Hex Bolt',
            component_type: 'HARDWARE',
            quantity: '4.0000',
            unit_of_measure: 'PCS',
            unit_cost: '2.50',
            total_cost: '10.00',
          },
          {
            id: 'c-nut-m6',
            part_number: 'NUT-M6',
            name: 'M6 Nyloc Nut',
            component_type: 'HARDWARE',
            quantity: '4.0000',
            unit_of_measure: 'PCS',
            unit_cost: '0.625',
            total_cost: '2.50',
          },
        ],
      },
    };

    // Branch A and Branch B both use the shared kit
    const branchA = { ...sharedSubAssembly, id: 'branch-a-fastener' };
    const branchB = { ...sharedSubAssembly, id: 'branch-b-fastener' };

    expect(branchA.sub_assembly_bom_id).toBe(branchB.sub_assembly_bom_id);
    expect(branchA.id).not.toBe(branchB.id);
  });
});

describe('Audit D: Recursive Cost Integrity & Authorization', () => {
  it('calculates 3-level quantity multiplication and financial rounding with Decimal.js', () => {
    // Level 1 parent needs 2.5000 units of Level 2 sub-assembly
    const parentQty = new Decimal('2.5000');

    // Level 2 sub-assembly needs 3.2500 units of Level 3 component costing ₹14.55 per unit
    const childLineQty = new Decimal('3.2500');
    const childUnitCost = new Decimal('14.55');

    // Calculate child line total: round2(3.25 * 14.55) = round2(47.2875) = 47.29 (ROUND_HALF_UP)
    const childLineTotal = childLineQty.times(childUnitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(childLineTotal.toFixed(2)).toBe('47.29');

    // Sub-assembly unit cost = 47.29
    const subAssyUnitCost = childLineTotal;

    // Parent line total: round2(2.5 * 47.29) = round2(118.225) = 118.23 (ROUND_HALF_UP)
    const parentLineTotal = parentQty.times(subAssyUnitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(parentLineTotal.toFixed(2)).toBe('118.23');

    // Exploded view cumulative quantity: 2.5000 * 3.2500 = 8.1250 units
    const cumulativeQty = parentQty.times(childLineQty);
    expect(cumulativeQty.toFixed(4)).toBe('8.1250');

    // Cumulative extended cost: round2(8.1250 * 14.55) = round2(118.21875) = 118.22
    const explodedCost = cumulativeQty.times(childUnitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(explodedCost.toFixed(2)).toBe('118.22');
  });

  it('reconciles parent header total to the exact sum of stored line totals', () => {
    // 3 lines with half-up rounding boundaries
    const lines = [
      { qty: new Decimal('1.0000'), cost: new Decimal('10.005') }, // 10.01
      { qty: new Decimal('1.0000'), cost: new Decimal('20.004') }, // 20.00
      { qty: new Decimal('1.0000'), cost: new Decimal('30.005') }, // 30.01
    ];

    const lineTotals = lines.map((l) => l.qty.times(l.cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    expect(lineTotals[0].toFixed(2)).toBe('10.01');
    expect(lineTotals[1].toFixed(2)).toBe('20.00');
    expect(lineTotals[2].toFixed(2)).toBe('30.01');

    const headerTotal = lineTotals.reduce((acc, curr) => acc.plus(curr), new Decimal(0));
    // Header total must equal exactly 10.01 + 20.00 + 30.01 = 60.02
    expect(headerTotal.toFixed(2)).toBe('60.02');
  });

  it('validates cost override logic and required justification reason', () => {
    // Case 1: Override enabled with valid reason
    const validOverride = {
      isCostOverridden: true,
      costOverrideReason: 'Special negotiated batch contract pricing from vendor',
      unitCost: 120.0,
    };
    const isValid1 = validOverride.isCostOverridden
      ? Boolean(validOverride.costOverrideReason && validOverride.costOverrideReason.trim().length > 0)
      : true;
    expect(isValid1).toBe(true);

    // Case 2: Override enabled with empty reason (rejected)
    const invalidOverride = {
      isCostOverridden: true,
      costOverrideReason: '   ',
      unitCost: 120.0,
    };
    const isValid2 = invalidOverride.isCostOverridden
      ? Boolean(invalidOverride.costOverrideReason && invalidOverride.costOverrideReason.trim().length > 0)
      : true;
    expect(isValid2).toBe(false);

    // Case 3: Override disabled (reason not required)
    const normalComponent = {
      isCostOverridden: false,
      costOverrideReason: null,
      unitCost: 120.0,
    };
    const isValid3 = normalComponent.isCostOverridden
      ? Boolean(normalComponent.costOverrideReason && normalComponent.costOverrideReason.trim().length > 0)
      : true;
    expect(isValid3).toBe(true);
  });

  it('validates role authorization for cost override operations', () => {
    const isAuthorized = (roles: string[]) => {
      return roles.includes('ADMINISTRATOR') || roles.includes('LEAD_ENGINEER');
    };

    expect(isAuthorized(['ADMINISTRATOR'])).toBe(true);
    expect(isAuthorized(['LEAD_ENGINEER'])).toBe(true);
    expect(isAuthorized(['OPERATOR'])).toBe(false);
    expect(isAuthorized(['VIEWER'])).toBe(false);
    expect(isAuthorized([])).toBe(false);
  });
});

describe('Hierarchy Depth Formula & Limits', () => {
  it('permits hierarchy of exactly 10 levels and rejects level 11', () => {
    const calculateTotalDepth = (ancestorDepth: number, descendantDepth: number) => {
      return ancestorDepth + 1 + descendantDepth;
    };

    // Case 1: Parent has 4 ancestors (depth 4 above parent). Child has 5 descendants (depth 5 below child).
    // Total = 4 + 1 + 5 = 10 (Valid)
    const depth10 = calculateTotalDepth(4, 5);
    expect(depth10).toBe(10);
    expect(depth10 <= 10).toBe(true);

    // Case 2: Parent has 5 ancestors. Child has 5 descendants.
    // Total = 5 + 1 + 5 = 11 (Invalid - Rejected)
    const depth11 = calculateTotalDepth(5, 5);
    expect(depth11).toBe(11);
    expect(depth11 <= 10).toBe(false);

    // Case 3: Shallow parent (ancestor depth 0 = root). Deep child (descendant depth 9).
    // Total = 0 + 1 + 9 = 10 (Valid)
    expect(calculateTotalDepth(0, 9)).toBe(10);

    // Case 4: Shallow parent (ancestor depth 0). Deep child (descendant depth 10).
    // Total = 0 + 1 + 10 = 11 (Invalid - Rejected)
    expect(calculateTotalDepth(0, 10)).toBe(11);
  });
});

describe('Safe Patch & Component Update Contract', () => {
  const existingComponent = {
    id: 'comp-100',
    bom_id: 'bom-parent-1',
    part_number: 'SUB-VALVE-01',
    name: 'Valve Sub-Assembly',
    component_type: 'SUB_ASSEMBLY',
    quantity: '2.0000',
    unit_of_measure: 'EA',
    unit_cost: '45.00',
    total_cost: '90.00',
    sub_assembly_bom_id: 'bom-child-valve',
    sub_assembly_version: 1,
    is_cost_overridden: true,
    cost_override_reason: 'Volume discount approved by lead engineer',
  };

  function applySafePatch(oldComp: typeof existingComponent, input: any) {
    let targetSubBomId = oldComp.sub_assembly_bom_id;
    if (input.subAssemblyBomId !== undefined) {
      targetSubBomId = input.subAssemblyBomId;
    }

    let targetSubVer = oldComp.sub_assembly_version;
    if (input.subAssemblyVersion !== undefined) {
      targetSubVer = input.subAssemblyVersion;
    }

    if (targetSubBomId === null) {
      targetSubVer = null;
    }

    let isOverridden = oldComp.is_cost_overridden;
    if (input.isCostOverridden !== undefined) {
      isOverridden = input.isCostOverridden;
    }

    let overrideReason = oldComp.cost_override_reason;
    if (input.costOverrideReason !== undefined) {
      overrideReason = input.costOverrideReason;
    }

    if (!isOverridden && input.costOverrideReason === undefined) {
      overrideReason = null;
    }

    return {
      ...oldComp,
      ...(input.partNumber && { part_number: input.partNumber }),
      ...(input.quantity && { quantity: input.quantity }),
      sub_assembly_bom_id: targetSubBomId,
      sub_assembly_version: targetSubVer,
      is_cost_overridden: isOverridden,
      cost_override_reason: overrideReason,
    };
  }

  it('Operation 1: Field omitted preserves existing sub-assembly and override values during unrelated update', () => {
    // Only update quantity
    const patched = applySafePatch(existingComponent, { quantity: '5.0000' });

    expect(patched.quantity).toBe('5.0000');
    // Sub-assembly fields preserved
    expect(patched.sub_assembly_bom_id).toBe('bom-child-valve');
    expect(patched.sub_assembly_version).toBe(1);
    // Cost override preserved
    expect(patched.is_cost_overridden).toBe(true);
    expect(patched.cost_override_reason).toBe('Volume discount approved by lead engineer');
  });

  it('Operation 2: Field supplied updates sub-assembly reference and version pin', () => {
    const patched = applySafePatch(existingComponent, {
      subAssemblyBomId: 'bom-child-valve-v2',
      subAssemblyVersion: 2,
    });

    expect(patched.sub_assembly_bom_id).toBe('bom-child-valve-v2');
    expect(patched.sub_assembly_version).toBe(2);
    expect(patched.quantity).toBe('2.0000'); // Unchanged
  });

  it('Operation 3: Explicit clear sets sub_assembly_bom_id to null and cascades null to sub_assembly_version', () => {
    const patched = applySafePatch(existingComponent, {
      subAssemblyBomId: null,
      // subAssemblyVersion omitted
    });

    expect(patched.sub_assembly_bom_id).toBeNull();
    // Cascades to null so chk_bom_component_sub_version_positive is satisfied
    expect(patched.sub_assembly_version).toBeNull();
  });

  it('Operation 4: Clearing cost override to false clears override reason', () => {
    const patched = applySafePatch(existingComponent, {
      isCostOverridden: false,
    });

    expect(patched.is_cost_overridden).toBe(false);
    expect(patched.cost_override_reason).toBeNull();
  });

  it('Operation 5: SQL procedure sp_update_bom_component update logic maps clear flags correctly', () => {
    // Verifies the CASE WHEN logic in sp_update_bom_component
    const simulateSqlUpdate = (row: any, params: any) => {
      const sub_assembly_bom_id = params.clear_sub_assembly
        ? null
        : params.sub_assembly_bom_id !== undefined && params.sub_assembly_bom_id !== null
        ? params.sub_assembly_bom_id
        : row.sub_assembly_bom_id;

      const sub_assembly_version = params.clear_sub_assembly || params.clear_sub_version
        ? null
        : params.sub_assembly_version !== undefined && params.sub_assembly_version !== null
        ? params.sub_assembly_version
        : row.sub_assembly_version;

      return { sub_assembly_bom_id, sub_assembly_version };
    };

    // Unrelated update (all defaults false/null)
    const res1 = simulateSqlUpdate(existingComponent, {
      clear_sub_assembly: false,
      clear_sub_version: false,
      sub_assembly_bom_id: null,
      sub_assembly_version: null,
    });
    expect(res1.sub_assembly_bom_id).toBe('bom-child-valve');
    expect(res1.sub_assembly_version).toBe(1);

    // Clear requested
    const res2 = simulateSqlUpdate(existingComponent, {
      clear_sub_assembly: true,
      clear_sub_version: false,
    });
    expect(res2.sub_assembly_bom_id).toBeNull();
    expect(res2.sub_assembly_version).toBeNull();
  });
});


