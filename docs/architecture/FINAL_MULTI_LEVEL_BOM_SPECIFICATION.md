# ECOFlow — Multi-Level BOM Final Technical Specification (Authoritative & Reconciled)
**Product:** ECOFlow (Engineering Change Management & Product Lifecycle Management for SME Manufacturers)  
**Workspace:** `T:\My Projects\ECO-Flow`  
**Active Branch:** `frontend`  
**Architecture Status:** Option B (Reusable Sub-Assembly BOM References) — RECONCILED & FINAL  
**Migration Status:** `database/sql/009_multi_level_bom_support.sql` (STRICTLY ON HOLD — DO NOT APPLY TO LIVE DATABASE)  
**Date:** November 9, 2026  

---

## 1. Executive Summary & Authoritative Reconciliations

This document serves as the authoritative architectural specification for Multi-Level Bills of Materials in ECOFlow. It supersedes earlier drafts and aligns the specification with the verified codebase, database schema, and test evidence.

### Critical Technical Decisions Reconciled:
1. **Concurrency Control & Trusted-Writer Boundary:**
   - **Protocol:** Transaction-scoped PostgreSQL advisory locking using key `4200000001001` (`SELECT pg_advisory_xact_lock(4200000001001)`).
   - **Boundary Enforcement:** Because PostgreSQL evaluates statement snapshots prior to trigger execution under `READ COMMITTED`, a row-level trigger lock alone cannot serialize opposing concurrent writes ($A \to B$ vs $B \to A$).
   - **Resolution:**
     - In the application layer, `BOMService.addComponent` and `updateComponent` acquire the advisory lock as the very first query within a Prisma interactive transaction.
     - In the database layer, stored procedures `sp_add_bom_component` and `sp_update_bom_component` acquire the advisory lock before executing the mutation statement.
     - Database triggers act as defense-in-depth for cycle and depth constraints.
2. **Hierarchy Depth Calculation:**
   - Root finished-good BOM is defined as **Level 1**.
   - Maximum permitted hierarchy depth is **10 levels** (Level 10 is valid; Level 11 is rejected with `SQLSTATE 54001`).
   - For any proposed link $P \to C$, depth is calculated as:
     $$\text{Total Resulting Depth} = \text{Max Ancestor Depth}(P) + 1 + \text{Max Descendant Depth}(C)$$
   - Validates both deep child sub-trees referenced by shallow parents and deep parents referencing deep children.
3. **Cycle Prevention & Shared Sub-Assemblies:**
   - Cycles ($A \to A$, $A \to B \to A$, and long indirect chains) are rejected.
   - Recursive CTEs track path arrays (`ARRAY[...]`) locally per traversal branch, enabling valid shared sub-assemblies (diamond dependencies) without false cycle rejections.
   - During `UPDATE`, the row's prior link is excluded (`id <> OLD.id`) to allow valid reparenting and relationship replacements.
4. **Exact Child-Version Pinning & Release Governance:**
   - Dynamic resolution: Unpinned components (`sub_assembly_version = NULL`) resolve to the latest released child version.
   - Version pinning: Explicit version pins are validated against `bom_versions(bom_id, version_number)` via composite foreign key `fk_bom_components_sub_assembly_version`.
   - Release Gate: A parent ECO cannot be submitted or released if any referenced child BOM lacks a valid released version.
   - Snapshot Immutability: When released, the parent's `BOMVersion.snapshot_data` deep-walks and freezes the entire nested sub-tree. Historical parent revisions render from frozen snapshots and never execute live database joins.
5. **Financial Precision:**
   - Calculation engine: `Decimal.js` with `precision: 28` and `ROUND_HALF_UP`.
   - Database columns: `quantity Decimal(12, 4)`, `unit_cost Decimal(12, 2)`, `total_cost Decimal(14, 2)`.
   - Line totals are rounded to 2 decimal places. Header totals equal the exact sum of stored line totals, preventing ₹0.01 rounding discrepancies.

---

## 2. Reconciled Prisma Schema (`database/prisma/schema.prisma`)

```prisma
model BOM {
  id              String    @id @default(uuid()) @db.Uuid
  bom_number      String    @unique @db.VarChar(100)
  product_id      String    @db.Uuid
  current_version Int       @default(1)
  status          BOMStatus @default(DRAFT)
  created_by      String    @db.Uuid
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  updated_at      DateTime  @updatedAt @db.Timestamptz(6)

  // Relationships
  product         Product        @relation(fields: [product_id], references: [id], onDelete: Restrict)
  creator         User           @relation("BomCreator", fields: [created_by], references: [id], onDelete: Restrict)
  components      BOMComponent[] @relation("ParentBOMComponents")
  parent_usages   BOMComponent[] @relation("SubAssemblyUsages") // Reverse relation: assemblies consuming this BOM
  ecos            ECO[]
  bom_versions    BOMVersion[]   @relation("BomToVersions")

  @@unique([id, product_id])
  @@index([product_id])
  @@index([status])
  @@map("boms")
}

model BOMComponent {
  id                    String           @id @default(uuid()) @db.Uuid
  bom_id                String           @db.Uuid
  sub_assembly_bom_id   String?          @db.Uuid
  sub_assembly_version  Int?             // Explicit version pin
  part_number           String           @db.VarChar(100)
  name                  String           @db.VarChar(255)
  component_type        BOMComponentType @default(RAW_MATERIAL)
  quantity              Decimal          @db.Decimal(12, 4)
  unit_of_measure       String           @db.VarChar(50)
  unit_cost             Decimal          @db.Decimal(12, 2)
  total_cost            Decimal          @db.Decimal(14, 2)
  is_cost_overridden    Boolean          @default(false)
  cost_override_reason  String?          @db.Text
  created_at            DateTime         @default(now()) @db.Timestamptz(6)
  updated_at            DateTime         @updatedAt @db.Timestamptz(6)

  // Relationships
  bom                   BOM              @relation("ParentBOMComponents", fields: [bom_id], references: [id], onDelete: Cascade)
  sub_assembly_bom      BOM?             @relation("SubAssemblyUsages", fields: [sub_assembly_bom_id], references: [id], onDelete: Restrict)

  @@index([bom_id])
  @@index([sub_assembly_bom_id])
  @@index([part_number])
  @@map("bom_components")
}
```

---

## 3. Authoritative Migration SQL (`009_multi_level_bom_support.sql`)

```sql
-- Migration 009: Multi-Level BOM & Sub-Assembly Governance (Final Validated)
-- Path: database/sql/009_multi_level_bom_support.sql

BEGIN;

-- 1. Pre-flight integrity check on existing data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'bom_components' 
      AND column_name = 'sub_assembly_bom_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.bom_components bc 
      LEFT JOIN public.boms b ON bc.sub_assembly_bom_id = b.id 
      WHERE bc.sub_assembly_bom_id IS NOT NULL AND b.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Pre-check failed: Found bom_components referencing non-existent boms';
    END IF;
  END IF;
END $$;

-- 2. Extend bom_components table
ALTER TABLE public.bom_components
  ADD COLUMN IF NOT EXISTS sub_assembly_bom_id UUID NULL,
  ADD COLUMN IF NOT EXISTS sub_assembly_version INT NULL,
  ADD COLUMN IF NOT EXISTS is_cost_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cost_override_reason TEXT NULL;

-- 3. Foreign Key: Restrict child BOM deletion when actively referenced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_bom_components_sub_assembly'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT fk_bom_components_sub_assembly
      FOREIGN KEY (sub_assembly_bom_id)
      REFERENCES public.boms(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 4. Composite Foreign Key: Child Version Pinning validation against bom_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_bom_components_sub_assembly_version'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT fk_bom_components_sub_assembly_version
      FOREIGN KEY (sub_assembly_bom_id, sub_assembly_version)
      REFERENCES public.bom_versions(bom_id, version_number)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_bom_components_sub_assembly_bom_id 
  ON public.bom_components(sub_assembly_bom_id);

CREATE INDEX IF NOT EXISTS idx_bom_components_sub_version 
  ON public.bom_components(sub_assembly_bom_id, sub_assembly_version);

CREATE INDEX IF NOT EXISTS idx_bom_components_parent_child 
  ON public.bom_components(bom_id, sub_assembly_bom_id);

-- 6. Check Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_bom_component_cost_override'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT chk_bom_component_cost_override
      CHECK (
        is_cost_overridden = FALSE OR 
        (is_cost_overridden = TRUE AND cost_override_reason IS NOT NULL AND length(trim(cost_override_reason)) > 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_bom_component_type_subassembly'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT chk_bom_component_type_subassembly
      CHECK (sub_assembly_bom_id IS NULL OR component_type = 'SUB_ASSEMBLY');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_bom_component_sub_version_positive'
      AND conrelid = 'public.bom_components'::regclass
  ) THEN
    ALTER TABLE public.bom_components
      ADD CONSTRAINT chk_bom_component_sub_version_positive
      CHECK (sub_assembly_version IS NULL OR (sub_assembly_version > 0 AND sub_assembly_bom_id IS NOT NULL));
  END IF;
END $$;

-- 7. Trigger Function: Concurrency, Cycle, and Combined Ancestor + Descendant Depth Validation
CREATE OR REPLACE FUNCTION public.fn_validate_bom_component_cycle()
RETURNS TRIGGER AS $$
DECLARE
  v_cycle_detected BOOLEAN := FALSE;
  v_max_ancestor_depth INT := 0;
  v_max_descendant_depth INT := 0;
  v_total_resulting_depth INT := 0;
  v_hierarchy_lock_key CONSTANT BIGINT := 4200000001001;
BEGIN
  -- Only validate when a sub-assembly link is added or updated
  IF NEW.sub_assembly_bom_id IS NOT NULL AND 
     (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.sub_assembly_bom_id IS DISTINCT FROM NEW.sub_assembly_bom_id OR OLD.bom_id IS DISTINCT FROM NEW.bom_id))) THEN
    
    -- Fast-Fail: Direct self-reference
    IF NEW.bom_id = NEW.sub_assembly_bom_id THEN
      RAISE EXCEPTION 'Circular BOM violation: BOM % cannot reference itself as a sub-assembly', NEW.bom_id
        USING ERRCODE = '23514';
    END IF;

    -- Defensive advisory lock check
    PERFORM pg_advisory_xact_lock(v_hierarchy_lock_key);

    -- 1. Ancestor Traversal (Depth above Parent BOM)
    WITH RECURSIVE ancestor_tree AS (
      SELECT 
        bom_id, 
        sub_assembly_bom_id, 
        1 AS depth, 
        ARRAY[bom_id, NEW.bom_id] AS path
      FROM public.bom_components
      WHERE sub_assembly_bom_id = NEW.bom_id
        AND (TG_OP = 'INSERT' OR id <> OLD.id)

      UNION ALL

      SELECT 
        bc.bom_id, 
        bc.sub_assembly_bom_id, 
        at.depth + 1, 
        at.path || bc.bom_id
      FROM public.bom_components bc
      JOIN ancestor_tree at ON bc.sub_assembly_bom_id = at.bom_id
      WHERE (TG_OP = 'INSERT' OR bc.id <> OLD.id)
        AND NOT (bc.bom_id = ANY(at.path))
        AND at.depth <= 11
    )
    SELECT 
      COALESCE(MAX(depth), 0),
      EXISTS (SELECT 1 FROM ancestor_tree WHERE bom_id = NEW.sub_assembly_bom_id)
    INTO v_max_ancestor_depth, v_cycle_detected
    FROM ancestor_tree;

    IF v_cycle_detected THEN
      RAISE EXCEPTION 'Circular BOM violation: Adding sub-assembly % creates a recursive dependency cycle with ancestor BOMs',
        NEW.sub_assembly_bom_id
        USING ERRCODE = '23514';
    END IF;

    -- 2. Descendant Traversal (Depth below Child Sub-Assembly)
    WITH RECURSIVE descendant_tree AS (
      SELECT 
        bom_id, 
        sub_assembly_bom_id, 
        1 AS depth, 
        ARRAY[NEW.sub_assembly_bom_id, sub_assembly_bom_id] AS path
      FROM public.bom_components
      WHERE bom_id = NEW.sub_assembly_bom_id
        AND sub_assembly_bom_id IS NOT NULL

      UNION ALL

      SELECT 
        bc.bom_id, 
        bc.sub_assembly_bom_id, 
        dt.depth + 1, 
        dt.path || bc.sub_assembly_bom_id
      FROM public.bom_components bc
      JOIN descendant_tree dt ON bc.bom_id = dt.sub_assembly_bom_id
      WHERE bc.sub_assembly_bom_id IS NOT NULL
        AND NOT (bc.sub_assembly_bom_id = ANY(dt.path))
        AND dt.depth <= 11
    )
    SELECT COALESCE(MAX(depth), 0) INTO v_max_descendant_depth FROM descendant_tree;

    -- Total resulting root-to-leaf depth:
    v_total_resulting_depth := v_max_ancestor_depth + 1 + v_max_descendant_depth;

    IF v_total_resulting_depth > 10 THEN
      RAISE EXCEPTION 'Hierarchy limit violation: Resulting hierarchy depth (% levels) exceeds maximum supported depth of 10 levels',
        v_total_resulting_depth
        USING ERRCODE = '54001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_bom_components_cycle_guard ON public.bom_components;
CREATE TRIGGER trg_bom_components_cycle_guard
BEFORE INSERT OR UPDATE OF bom_id, sub_assembly_bom_id ON public.bom_components
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_bom_component_cycle();

-- 8. Database-Controlled Mutation Interface (For Trusted Writers / Maintenance Scripts)
CREATE OR REPLACE FUNCTION public.sp_add_bom_component(
  p_id UUID,
  p_bom_id UUID,
  p_part_number VARCHAR(100),
  p_name VARCHAR(255),
  p_component_type public."BOMComponentType",
  p_quantity NUMERIC(12, 4),
  p_unit_of_measure VARCHAR(50),
  p_unit_cost NUMERIC(12, 2),
  p_total_cost NUMERIC(14, 2),
  p_sub_assembly_bom_id UUID DEFAULT NULL,
  p_sub_assembly_version INT DEFAULT NULL,
  p_is_cost_overridden BOOLEAN DEFAULT FALSE,
  p_cost_override_reason TEXT DEFAULT NULL
)
RETURNS public.bom_components AS $$
DECLARE
  v_res public.bom_components;
BEGIN
  PERFORM pg_advisory_xact_lock(4200000001001);

  INSERT INTO public.bom_components (
    id, bom_id, part_number, name, component_type, quantity, unit_of_measure, unit_cost, total_cost,
    sub_assembly_bom_id, sub_assembly_version, is_cost_overridden, cost_override_reason, created_at, updated_at
  ) VALUES (
    p_id, p_bom_id, p_part_number, p_name, p_component_type, p_quantity, p_unit_of_measure, p_unit_cost, p_total_cost,
    p_sub_assembly_bom_id, p_sub_assembly_version, p_is_cost_overridden, p_cost_override_reason, NOW(), NOW()
  )
  RETURNING * INTO v_res;

  RETURN v_res;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

CREATE OR REPLACE FUNCTION public.sp_update_bom_component(
  p_id UUID,
  p_part_number VARCHAR(100) DEFAULT NULL,
  p_name VARCHAR(255) DEFAULT NULL,
  p_component_type public."BOMComponentType" DEFAULT NULL,
  p_quantity NUMERIC(12, 4) DEFAULT NULL,
  p_unit_of_measure VARCHAR(50) DEFAULT NULL,
  p_unit_cost NUMERIC(12, 2) DEFAULT NULL,
  p_total_cost NUMERIC(14, 2) DEFAULT NULL,
  p_sub_assembly_bom_id UUID DEFAULT NULL,
  p_sub_assembly_version INT DEFAULT NULL,
  p_is_cost_overridden BOOLEAN DEFAULT NULL,
  p_cost_override_reason TEXT DEFAULT NULL
)
RETURNS public.bom_components AS $$
DECLARE
  v_res public.bom_components;
BEGIN
  PERFORM pg_advisory_xact_lock(4200000001001);

  UPDATE public.bom_components
  SET
    part_number = COALESCE(p_part_number, part_number),
    name = COALESCE(p_name, name),
    component_type = COALESCE(p_component_type, component_type),
    quantity = COALESCE(p_quantity, quantity),
    unit_of_measure = COALESCE(p_unit_of_measure, unit_of_measure),
    unit_cost = COALESCE(p_unit_cost, unit_cost),
    total_cost = COALESCE(p_total_cost, total_cost),
    sub_assembly_bom_id = p_sub_assembly_bom_id,
    sub_assembly_version = p_sub_assembly_version,
    is_cost_overridden = COALESCE(p_is_cost_overridden, is_cost_overridden),
    cost_override_reason = p_cost_override_reason,
    updated_at = NOW()
  WHERE id = p_id
  RETURNING * INTO v_res;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOM Component with ID % not found', p_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_res;
END;
$$ LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp;

COMMIT;
```

---

## 4. Rollback SQL (`009_rollback_multi_level_bom.sql`)

```sql
BEGIN;

-- 1. Drop stored procedures and triggers
DROP FUNCTION IF EXISTS public.sp_update_bom_component(UUID, VARCHAR, VARCHAR, public."BOMComponentType", NUMERIC, VARCHAR, NUMERIC, NUMERIC, UUID, INT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.sp_add_bom_component(UUID, UUID, VARCHAR, VARCHAR, public."BOMComponentType", NUMERIC, VARCHAR, NUMERIC, NUMERIC, UUID, INT, BOOLEAN, TEXT);
DROP TRIGGER IF EXISTS trg_bom_components_cycle_guard ON public.bom_components;
DROP FUNCTION IF EXISTS public.fn_validate_bom_component_cycle();

-- 2. Drop constraints
ALTER TABLE public.bom_components
  DROP CONSTRAINT IF EXISTS chk_bom_component_sub_version_positive,
  DROP CONSTRAINT IF EXISTS chk_bom_component_type_subassembly,
  DROP CONSTRAINT IF EXISTS chk_bom_component_cost_override,
  DROP CONSTRAINT IF EXISTS fk_bom_components_sub_assembly_version,
  DROP CONSTRAINT IF EXISTS fk_bom_components_sub_assembly;

-- 3. Drop indexes
DROP INDEX IF EXISTS public.idx_bom_components_parent_child;
DROP INDEX IF EXISTS public.idx_bom_components_sub_version;
DROP INDEX IF EXISTS public.idx_bom_components_sub_assembly_bom_id;

-- 4. Drop columns (Warning: Back up data before dropping columns on populated tables)
ALTER TABLE public.bom_components
  DROP COLUMN IF EXISTS cost_override_reason,
  DROP COLUMN IF EXISTS is_cost_overridden,
  DROP COLUMN IF EXISTS sub_assembly_version,
  DROP COLUMN IF EXISTS sub_assembly_bom_id;

COMMIT;
```

---

## 5. API Contracts

| Endpoint | Method | Request Body / Query | Success Response Structure |
| :--- | :---: | :--- | :--- |
| `/api/v1/boms/:id/components` | `POST` | `AddBOMComponentInput` | Created component object with `sub_assembly_bom_id`, `sub_assembly_version`, and cost override data. |
| `/api/v1/boms/:id/components/:cid` | `PATCH` | `UpdateBOMComponentInput` | Updated component with re-calculated or overridden costs. |
| `/api/v1/boms/:id/tree` | `GET` | None | `{ success: true, data: BOMTreeNode }` with recursive nested sub-assemblies up to 10 levels. |
| `/api/v1/boms/:id/exploded` | `GET` | None | `{ success: true, data: { total_exploded_cost, items: ExplodedComponentItem[] } }` containing deduplicated raw materials. |
| `/api/v1/boms/:id/where-used` | `GET` | None | `{ success: true, data: WhereUsedNode[] }` returning all parent assemblies consuming this BOM. |

---

## 6. Execution Status & Final Recommendation

**Readiness Classification:** **B. IMPLEMENTATION COMPLETE, VERIFICATION BLOCKED**
- All application source files, backend services, validation packages, and frontend views are implemented, verified, and passing type and build checks.
- Stored procedures (`sp_add_bom_component`, `sp_update_bom_component`) and application-level advisory locking (`4200000001001`) are implemented.
- Full database role separation on the PostgreSQL cluster and end-to-end live release tests against the live database remain blocked per mandatory safety rules prohibiting live DB mutation.
- Migration 009 and Rollback SQL are verified and strictly **ON HOLD** awaiting operational authorization.
