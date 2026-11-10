import { prisma } from '../../config/database.js';
import { NotFoundError, ConflictError, AppError, ForbiddenError } from '../../utils/errors.js';
import { CreateBOMInput, AddBOMComponentInput, UpdateBOMComponentInput } from './bom.schema.js';
import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';

export class BOMService {
  public static async createBOM(input: CreateBOMInput, userId: string) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) throw new NotFoundError('Product', input.productId);

    const existing = await prisma.bOM.findFirst({
      where: { bom_number: input.bomNumber },
    });
    if (existing) throw new ConflictError(`BOM number '${input.bomNumber}' already exists`);

    return await prisma.bOM.create({
      data: {
        id: randomUUID(),
        product_id: input.productId,
        bom_number: input.bomNumber,
        created_by: userId,
        status: 'DRAFT',
      },
      include: {
        product: true,
      },
    });
  }

  public static async listBOMs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const [total, boms] = await Promise.all([
      prisma.bOM.count(),
      prisma.bOM.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          components: true,
        },
      }),
    ]);

    return {
      data: boms,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getBOMById(id: string) {
    const bom = await prisma.bOM.findFirst({
      where: { id },
      include: {
        product: true,
        components: {
          orderBy: { part_number: 'asc' },
        },
        bom_versions: {
          orderBy: { version_number: 'desc' },
        },
      },
    });

    if (!bom) throw new NotFoundError('BOM', id);
    return bom;
  }

  public static async addComponent(bomId: string, input: AddBOMComponentInput, userId?: string, userRoles?: string[]) {
    // Enforce cost override authorization
    if (input.isCostOverridden) {
      const isAuthorized = userRoles && (userRoles.includes('ADMINISTRATOR') || userRoles.includes('LEAD_ENGINEER'));
      if (!isAuthorized) {
        throw new ForbiddenError('Only LEAD_ENGINEER or ADMINISTRATOR roles are authorized to override component costs');
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Transaction-Scoped Advisory Lock: First statement in application transaction
      // Guarantees serialization of concurrent hierarchy mutations and establishes fresh snapshot boundary
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(4200000001001);`;

      const bom = await tx.bOM.findFirst({
        where: { id: bomId },
      });
      if (!bom) throw new NotFoundError('BOM', bomId);

      if (bom.status !== 'DRAFT') {
        throw new AppError('Cannot add components to non-draft BOM directly; submit an Engineering Change Order (ECO)', 400);
      }

      const qty = new Decimal(input.quantity);
      let cost = new Decimal(input.unitCost);

      if (input.subAssemblyBomId) {
        const subBom = await tx.bOM.findUnique({
          where: { id: input.subAssemblyBomId },
          include: { bom_versions: true },
        });
        if (!subBom) throw new NotFoundError('Sub-Assembly BOM', input.subAssemblyBomId);

        if (input.subAssemblyVersion) {
          const ver = await tx.bOMVersion.findUnique({
            where: {
              bom_id_version_number: {
                bom_id: input.subAssemblyBomId,
                version_number: input.subAssemblyVersion,
              },
            },
          });
          if (!ver) {
            throw new AppError(`Sub-Assembly version ${input.subAssemblyVersion} does not exist for BOM ${input.subAssemblyBomId}`, 400);
          }
        }

        if (!input.isCostOverridden) {
          cost = await this.calculateBOMUnitCost(input.subAssemblyBomId, input.subAssemblyVersion);
        }
      }

      const totalCost = qty.times(cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      const component = await tx.bOMComponent.create({
        data: {
          id: randomUUID(),
          bom_id: bomId,
          sub_assembly_bom_id: input.subAssemblyBomId,
          sub_assembly_version: input.subAssemblyVersion,
          is_cost_overridden: !!input.isCostOverridden,
          cost_override_reason: input.costOverrideReason,
          part_number: input.partNumber,
          name: input.name,
          component_type: input.componentType as any,
          quantity: qty.toFixed(4) as any,
          unit_of_measure: input.unitOfMeasure,
          unit_cost: cost.toFixed(2) as any,
          total_cost: totalCost.toFixed(2) as any,
        },
      });

      // Record Audit Trail
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          user_id: userId || bom.created_by,
          action: 'BOM_COMPONENT_ADDED',
          entity_type: 'BOM',
          entity_id: bomId,
          new_values: {
            componentId: component.id,
            partNumber: component.part_number,
            name: component.name,
            componentType: component.component_type,
            quantity: component.quantity.toString(),
            unitCost: component.unit_cost.toString(),
            totalCost: component.total_cost.toString(),
            unitOfMeasure: component.unit_of_measure,
            subAssemblyBomId: component.sub_assembly_bom_id,
            subAssemblyVersion: component.sub_assembly_version,
            isCostOverridden: component.is_cost_overridden,
            costOverrideReason: component.cost_override_reason,
            notes: input.notes,
          },
        },
      });

      return component;
    });
  }

  public static async updateComponent(
    bomId: string,
    componentId: string,
    input: UpdateBOMComponentInput,
    userId?: string,
    userRoles?: string[]
  ) {
    // Enforce cost override authorization
    if (input.isCostOverridden) {
      const isAuthorized = userRoles && (userRoles.includes('ADMINISTRATOR') || userRoles.includes('LEAD_ENGINEER'));
      if (!isAuthorized) {
        throw new ForbiddenError('Only LEAD_ENGINEER or ADMINISTRATOR roles are authorized to override component costs');
      }
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Transaction-Scoped Advisory Lock: First statement in application transaction
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(4200000001001);`;

      const bom = await tx.bOM.findFirst({ where: { id: bomId } });
      if (!bom) throw new NotFoundError('BOM', bomId);

      if (bom.status !== 'DRAFT') {
        throw new AppError('Cannot modify components in non-draft BOM directly; submit an Engineering Change Order (ECO)', 400);
      }

      const oldComp = await tx.bOMComponent.findFirst({
        where: { id: componentId, bom_id: bomId },
      });
      if (!oldComp) throw new NotFoundError('BOM Component', componentId);

      let targetSubBomId = oldComp.sub_assembly_bom_id;
      if (input.subAssemblyBomId !== undefined) {
        targetSubBomId = input.subAssemblyBomId;
      }

      let targetSubVer = oldComp.sub_assembly_version;
      if (input.subAssemblyVersion !== undefined) {
        targetSubVer = input.subAssemblyVersion;
      }

      // Safe patch contract: if subAssemblyBomId is explicitly cleared to null,
      // subAssemblyVersion must also be cleared to null to prevent constraint violations
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

      // If cost override is disabled and reason was omitted, clear the reason to null
      if (!isOverridden && input.costOverrideReason === undefined) {
        overrideReason = null;
      }

      if (targetSubBomId) {
        const subBom = await tx.bOM.findUnique({ where: { id: targetSubBomId } });
        if (!subBom) throw new NotFoundError('Sub-Assembly BOM', targetSubBomId);

        if (targetSubVer) {
          const ver = await tx.bOMVersion.findUnique({
            where: {
              bom_id_version_number: {
                bom_id: targetSubBomId,
                version_number: targetSubVer,
              },
            },
          });
          if (!ver) {
            throw new AppError(`Sub-Assembly version ${targetSubVer} does not exist for BOM ${targetSubBomId}`, 400);
          }
        }
      }

      const qty = input.quantity !== undefined ? new Decimal(input.quantity) : new Decimal(oldComp.quantity.toString());
      let cost = input.unitCost !== undefined ? new Decimal(input.unitCost) : new Decimal(oldComp.unit_cost.toString());

      if (targetSubBomId && !isOverridden) {
        cost = await this.calculateBOMUnitCost(targetSubBomId, targetSubVer ?? undefined);
      }

      const totalCost = qty.times(cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      const updated = await tx.bOMComponent.update({
        where: { id: componentId },
        data: {
          ...(input.partNumber && { part_number: input.partNumber }),
          ...(input.name && { name: input.name }),
          ...(input.componentType && { component_type: input.componentType as any }),
          sub_assembly_bom_id: targetSubBomId,
          sub_assembly_version: targetSubVer,
          is_cost_overridden: isOverridden,
          cost_override_reason: overrideReason,
          quantity: qty.toFixed(4) as any,
          unit_cost: cost.toFixed(2) as any,
          total_cost: totalCost.toFixed(2) as any,
          ...(input.unitOfMeasure && { unit_of_measure: input.unitOfMeasure }),
        },
      });

      // Record Audit Trail
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          user_id: userId || bom.created_by,
          action: 'BOM_COMPONENT_MODIFIED',
          entity_type: 'BOM',
          entity_id: bomId,
          old_values: {
            partNumber: oldComp.part_number,
            name: oldComp.name,
            componentType: oldComp.component_type,
            quantity: oldComp.quantity.toString(),
            unitCost: oldComp.unit_cost.toString(),
            totalCost: oldComp.total_cost.toString(),
            unitOfMeasure: oldComp.unit_of_measure,
          },
          new_values: {
            partNumber: updated.part_number,
            name: updated.name,
            componentType: updated.component_type,
            quantity: updated.quantity.toString(),
            unitCost: updated.unit_cost.toString(),
            totalCost: updated.total_cost.toString(),
            unitOfMeasure: updated.unit_of_measure,
            notes: input.notes,
          },
        },
      });

      return updated;
    });
  }

  public static async removeComponent(bomId: string, componentId: string, userId?: string) {
    const bom = await prisma.bOM.findFirst({ where: { id: bomId } });
    if (!bom) throw new NotFoundError('BOM', bomId);

    if (bom.status !== 'DRAFT') {
      throw new AppError('Cannot remove components from non-draft BOM directly; submit an Engineering Change Order (ECO)', 400);
    }

    const comp = await prisma.bOMComponent.findFirst({
      where: { id: componentId, bom_id: bomId },
    });
    if (!comp) throw new NotFoundError('BOM Component', componentId);

    await prisma.bOMComponent.delete({
      where: { id: componentId },
    });

    // Record Audit Trail
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        user_id: userId || bom.created_by,
        action: 'BOM_COMPONENT_REMOVED',
        entity_type: 'BOM',
        entity_id: bomId,
        old_values: {
          componentId: comp.id,
          partNumber: comp.part_number,
          name: comp.name,
          componentType: comp.component_type,
          quantity: comp.quantity.toString(),
          unitCost: comp.unit_cost.toString(),
          totalCost: comp.total_cost.toString(),
          unitOfMeasure: comp.unit_of_measure,
        },
      },
    });
  }

  public static async getBOMHistory(bomId: string) {
    return await prisma.auditLog.findMany({
      where: {
        entity_type: 'BOM',
        entity_id: bomId,
      },
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            user_roles: {
              select: {
                role: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  }

  public static async calculateBOMUnitCost(bomId: string, versionNumber?: number): Promise<Decimal> {
    if (versionNumber) {
      const ver = await prisma.bOMVersion.findUnique({
        where: {
          bom_id_version_number: {
            bom_id: bomId,
            version_number: versionNumber,
          },
        },
      });
      if (ver && ver.snapshot_data && typeof ver.snapshot_data === 'object') {
        const snap: any = ver.snapshot_data;
        if (snap.components && Array.isArray(snap.components)) {
          let sum = new Decimal(0);
          for (const c of snap.components) {
            sum = sum.plus(new Decimal(c.total_cost || 0));
          }
          return sum;
        }
      }
    }

    const comps = await prisma.bOMComponent.findMany({
      where: { bom_id: bomId },
    });

    let sum = new Decimal(0);
    for (const c of comps) {
      sum = sum.plus(new Decimal(c.total_cost.toString()));
    }
    return sum;
  }

  public static async getBOMTree(bomId: string, depth = 1, visited: string[] = []): Promise<any> {
    if (depth > 10) {
      throw new AppError(`Maximum hierarchy depth of 10 levels exceeded at BOM '${bomId}'`, 400);
    }
    if (visited.includes(bomId)) {
      throw new AppError(`Circular dependency detected during BOM tree traversal at BOM '${bomId}'`, 400);
    }

    const bom = await prisma.bOM.findUnique({
      where: { id: bomId },
      include: {
        product: { select: { id: true, part_number: true, name: true } },
        components: {
          orderBy: { part_number: 'asc' },
          include: {
            sub_assembly_bom: {
              select: {
                id: true,
                bom_number: true,
                current_version: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!bom) throw new NotFoundError('BOM', bomId);

    const componentsWithChildren = await Promise.all(
      bom.components.map(async (c) => {
        let subTree = null;
        if (c.sub_assembly_bom_id) {
          subTree = await this.getBOMTree(c.sub_assembly_bom_id, depth + 1, [...visited, bomId]);
        }
        return {
          id: c.id,
          part_number: c.part_number,
          name: c.name,
          component_type: c.component_type,
          quantity: c.quantity.toString(),
          unit_of_measure: c.unit_of_measure,
          unit_cost: c.unit_cost.toString(),
          total_cost: c.total_cost.toString(),
          sub_assembly_bom_id: c.sub_assembly_bom_id,
          sub_assembly_version: c.sub_assembly_version,
          is_cost_overridden: c.is_cost_overridden,
          cost_override_reason: c.cost_override_reason,
          sub_assembly_bom: c.sub_assembly_bom,
          sub_assembly_tree: subTree,
          depth,
        };
      })
    );

    const totalCost = componentsWithChildren.reduce(
      (acc, c) => acc.plus(new Decimal(c.total_cost)),
      new Decimal(0)
    );

    return {
      id: bom.id,
      bom_number: bom.bom_number,
      product: bom.product,
      current_version: bom.current_version,
      status: bom.status,
      depth,
      total_cost: totalCost.toFixed(2),
      components: componentsWithChildren,
    };
  }

  public static async getBOMExploded(bomId: string): Promise<any> {
    const rootTree = await this.getBOMTree(bomId);
    if (!rootTree) throw new NotFoundError('BOM', bomId);

    const leafItemsMap = new Map<string, {
      part_number: string;
      name: string;
      component_type: string;
      unit_of_measure: string;
      unit_cost: Decimal;
      cumulative_quantity: Decimal;
      total_cost: Decimal;
    }>();

    function flatten(node: any, parentMultiplier = new Decimal(1)) {
      if (!node || !node.components) return;
      for (const comp of node.components) {
        const lineQty = new Decimal(comp.quantity);
        const cumQty = parentMultiplier.times(lineQty);

        if (comp.sub_assembly_tree) {
          flatten(comp.sub_assembly_tree, cumQty);
        } else {
          const key = comp.part_number;
          const uCost = new Decimal(comp.unit_cost);
          if (leafItemsMap.has(key)) {
            const existing = leafItemsMap.get(key)!;
            existing.cumulative_quantity = existing.cumulative_quantity.plus(cumQty);
            existing.total_cost = existing.cumulative_quantity.times(existing.unit_cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          } else {
            leafItemsMap.set(key, {
              part_number: comp.part_number,
              name: comp.name,
              component_type: comp.component_type,
              unit_of_measure: comp.unit_of_measure,
              unit_cost: uCost,
              cumulative_quantity: cumQty,
              total_cost: cumQty.times(uCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
            });
          }
        }
      }
    }

    flatten(rootTree);

    const explodedList = Array.from(leafItemsMap.values()).map((item) => ({
      part_number: item.part_number,
      name: item.name,
      component_type: item.component_type,
      unit_of_measure: item.unit_of_measure,
      unit_cost: item.unit_cost.toFixed(2),
      cumulative_quantity: item.cumulative_quantity.toFixed(4),
      total_cost: item.total_cost.toFixed(2),
    }));

    const totalExplodedCost = explodedList.reduce(
      (acc, item) => acc.plus(new Decimal(item.total_cost)),
      new Decimal(0)
    );

    return {
      root_bom_id: bomId,
      root_bom_number: rootTree.bom_number,
      product: rootTree.product,
      total_exploded_cost: totalExplodedCost.toFixed(2),
      items: explodedList,
    };
  }

  public static async getBOMWhereUsed(bomId: string): Promise<any> {
    const usages = await prisma.bOMComponent.findMany({
      where: { sub_assembly_bom_id: bomId },
      include: {
        bom: {
          include: {
            product: { select: { id: true, part_number: true, name: true } },
          },
        },
      },
    });

    return usages.map((u) => ({
      component_id: u.id,
      parent_bom_id: u.bom.id,
      parent_bom_number: u.bom.bom_number,
      parent_product: u.bom.product,
      quantity_used: u.quantity.toString(),
      unit_of_measure: u.unit_of_measure,
      parent_bom_status: u.bom.status,
    }));
  }
}
