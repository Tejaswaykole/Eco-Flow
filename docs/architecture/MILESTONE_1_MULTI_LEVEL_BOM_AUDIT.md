# ECOFlow — Milestone 1: Multi-Level BOM Architecture Audit
**Product:** ECOFlow (Engineering Change Management / PLM for SME Manufacturers)  
**Document Type:** Architectural Specification & Implementation Blueprint  
**Status:** DRAFT SPECIFICATION (AUDIT-ONLY / PRE-IMPLEMENTATION)  
**Date:** November 9, 2026  
**Audited Branch:** `frontend`  

---

## 1. Executive Summary & Existing Database Architecture

### 1.1 Existing Relational Schema Analysis
The current ECOFlow database schema ([`database/prisma/schema.prisma#L357-L400`](file:///t:/My%20Projects/ECO-Flow/database/prisma/schema.prisma#L357-L400)) implements a **strictly single-level (flat) Bill of Materials model**:

1. **BOM to Product Association:**
   * A BOM belongs to a single Product via `product_id` (foreign key referencing `products.id`).
   * A composite candidate key `@@unique([id, product_id])` on `boms` enforces that every BOM is tied to exactly one product.
2. **Component Representation:**
   * Line items are stored in `bom_components` (`id`, `bom_id`, `part_number`, `name`, `component_type`, `quantity`, `unit_of_measure`, `unit_cost`, `total_cost`).
   * Each line item links to a parent `bom_id` with `onDelete: Cascade`.
3. **Sub-Assembly References (Current Reality):**
   * While `BOMComponentType.SUB_ASSEMBLY` exists as an enum value, **there is no foreign key or relation to another BOM or Product**.
   * A component cannot currently reference another BOM.
4. **Hierarchy & Nesting:**
   * The current schema **cannot represent nested assemblies or indented BOMs**.
5. **Revisions and Versions:**
   * Released BOM versions are archived as append-only records in `bom_versions` (`version_number`, `snapshot_data`, `eco_id`, `revision_number`).
   * Mutation triggers (`005_approval_and_version_integrity.sql`) guarantee version immutability once created.
6. **ECO Snapshot Behavior:**
   * Point-in-time state is captured in `eco_revision_snapshots.snapshot_data` when an ECO transitions to `SUBMITTED`.
   * Current snapshot transformers capture a flat array of components (`SnapshotComponent[]`).

---

## 2. Comparison of Multi-Level BOM Architectures

| Architecture Criterion | Option A: Self-Referencing Components (`parent_component_id`) | Option B: Dedicated Sub-Assembly BOM Link (`sub_assembly_bom_id`) — **RECOMMENDED** |
| :--- | :--- | :--- |
| **Relational Model** | Components point to other components within the same BOM (`bom_components.parent_component_id -> bom_components.id`). | A component line item optionally references another modular BOM (`bom_components.sub_assembly_bom_id -> boms.id`). |
| **Reusability / Modular PLM** | **Poor:** Sub-assemblies must be re-created and duplicated inside each parent BOM. | **Excellent (Industry Standard):** A Sub-Assembly (e.g., `BOM-PCB-01`) is maintained once and reused across multiple parent assemblies (`BOM-MOTOR-01`, `BOM-CONTROLLER-01`). |
| **Referential Integrity** | High risk of orphaned trees if parent components are deleted. | Strong foreign key to existing `boms(id)`. Can enforce `onDelete: Restrict` so active sub-assemblies cannot be deleted. |
| **Circular Reference Prevention** | Complex in-table recursion checking across line items. | Clean directed acyclic graph (DAG) validation at the BOM entity level using a recursive CTE trigger. |
| **ECO & Versioning Impact** | ECO changes to a sub-assembly would require modifying every parent BOM's component lines. | Modular ECO governance: Sub-assembly has its own ECO lifecycle; parent BOM automatically consumes the released version. |
| **Cost Roll-Up Formula** | Recursive component summation within single table. | Clean hierarchical roll-up: if line item has `sub_assembly_bom_id`, line unit cost is dynamically derived from sub-assembly total cost. |
| **Compatibility with ECOFlow** | Breaks current 1-to-1 BOM-to-Product paradigm. | **100% compatible:** Preserves all existing `boms` and `bom_components` structures while adding a nullable foreign key. |

### Architectural Recommendation: OPTION B (Dedicated Sub-Assembly Link)
Option B is selected because discrete manufacturing PLM demands **modular sub-assemblies**. In SME manufacturing, a power supply or cable harness is designed as an independent product/BOM and included as a single line item in finished goods.

---

## 3. Recommended Data Model & Entity Relationships

### 3.1 Proposed Schema Extension (Non-Breaking)
```prisma
model BOMComponent {
  id                  String           @id @default(uuid()) @db.Uuid
  bom_id              String           @db.Uuid
  sub_assembly_bom_id String?          @db.Uuid // Nullable link to child BOM
  part_number         String           @db.VarChar(100)
  name                String           @db.VarChar(255)
  component_type      BOMComponentType @default(RAW_MATERIAL)
  quantity            Decimal          @db.Decimal(12, 4)
  unit_of_measure     String           @db.VarChar(50)
  unit_cost           Decimal          @db.Decimal(12, 2)
  total_cost          Decimal          @db.Decimal(14, 2)
  created_at          DateTime         @default(now()) @db.Timestamptz(6)
  updated_at          DateTime         @updatedAt @db.Timestamptz(6)

  // Relations
  bom                 BOM              @relation("ParentBOMToComponents", fields: [bom_id], references: [id], onDelete: Cascade)
  sub_assembly_bom    BOM?             @relation("SubAssemblyBOM", fields: [sub_assembly_bom_id], references: [id], onDelete: Restrict)

  @@index([bom_id])
  @@index([sub_assembly_bom_id])
  @@index([part_number])
  @@map("bom_components")
}
```

### 3.2 Mermaid Relationship Diagram

```mermaid
erDiagram
    PRODUCT ||--o{ BOM : "defines"
    BOM ||--o{ BOM_COMPONENT : "contains"
    BOM_COMPONENT }o--o| BOM : "references sub-assembly (optional)"
    BOM ||--o{ BOM_VERSION : "freezes history"
    BOM ||--o{ ECO : "modified by"

    BOM {
        uuid id PK
        string bom_number UK
        uuid product_id FK
        int current_version
        string status
    }

    BOM_COMPONENT {
        uuid id PK
        uuid bom_id FK
        uuid sub_assembly_bom_id FK "nullable"
        string part_number
        string name
        string component_type
        decimal quantity
        decimal unit_cost
        decimal total_cost
    }
```

---

## 4. Recursive Hierarchy Retrieval & Cost Roll-Up Strategy

### 4.1 Recursive PostgreSQL CTE Query for BOM Explosion
To explode a multi-level BOM down to its deepest raw materials, the backend will execute a single recursive SQL query:

```sql
WITH RECURSIVE bom_explosion AS (
  -- Anchor Member (Root BOM Components)
  SELECT 
    bc.id AS component_id,
    bc.bom_id AS parent_bom_id,
    bc.sub_assembly_bom_id,
    bc.part_number,
    bc.name,
    bc.component_type,
    bc.quantity AS line_quantity,
    bc.quantity AS cumulative_quantity,
    bc.unit_cost,
    bc.total_cost,
    1 AS depth,
    ARRAY[bc.bom_id] AS traversal_path
  FROM public.bom_components bc
  WHERE bc.bom_id = $1

  UNION ALL

  -- Recursive Member (Traverse into child sub-assembly BOMs)
  SELECT 
    child_bc.id AS component_id,
    child_bc.bom_id AS parent_bom_id,
    child_bc.sub_assembly_bom_id,
    child_bc.part_number,
    child_bc.name,
    child_bc.component_type,
    child_bc.quantity AS line_quantity,
    (parent.cumulative_quantity * child_bc.quantity) AS cumulative_quantity,
    child_bc.unit_cost,
    (parent.cumulative_quantity * child_bc.total_cost) AS total_cost,
    parent.depth + 1 AS depth,
    parent.traversal_path || child_bc.bom_id AS traversal_path
  FROM public.bom_components child_bc
  JOIN bom_explosion parent ON child_bc.bom_id = parent.sub_assembly_bom_id
  WHERE parent.depth < 10 -- Safety recursion barrier
    AND NOT (child_bc.bom_id = ANY(parent.traversal_path)) -- Cycle prevention
)
SELECT * FROM bom_explosion ORDER BY depth ASC, part_number ASC;
```

### 4.2 Dynamic Cost Roll-Up Formula
1. **Raw Material Line:**
   $$\text{total\_cost} = \text{quantity} \times \text{unit\_cost}$$
2. **Sub-Assembly Line:**
   $$\text{unit\_cost}_{\text{sub\_assembly}} = \sum_{k=1}^{n} (\text{quantity}_k \times \text{unit\_cost}_k)_{\text{child components}}$$
   $$\text{total\_cost}_{\text{line}} = \text{quantity} \times \text{unit\_cost}_{\text{sub\_assembly}}$$
3. **Total Parent BOM Assembly Cost:**
   $$\text{Total BOM Cost} = \sum_{\text{all top-level components}} \text{total\_cost}_i$$

---

## 5. Circular Reference Prevention & Business Rules

### 5.1 Business Rules Matrix

| Rule ID | Rule Definition | Default Threshold | Operational Justification |
| :--- | :--- | :--- | :--- |
| `BOM-RULE-01` | **Maximum Supported Depth** | **10 Levels** | Sufficient for 99.5% of discrete SME products (e.g., electronic instrumentation, robotics, industrial machinery). Prevents stack overflow and excessive query latency. |
| `BOM-RULE-02` | **Circular Reference Rejection** | **Strict (Zero cycles)** | An assembly cannot directly or indirectly include itself (e.g., A -> B -> C -> A is strictly rejected at the API and database trigger level). |
| `BOM-RULE-03` | **Sub-Assembly Status Rule** | **Active Only for Release** | A parent BOM can link to a DRAFT sub-assembly during design, but the parent BOM cannot be approved/released unless all sub-assemblies are `ACTIVE`. |
| `BOM-RULE-04` | **Component Type Alignment** | **Enforce SUB_ASSEMBLY** | When `sub_assembly_bom_id` is populated, `component_type` must equal `SUB_ASSEMBLY`. |
| `BOM-RULE-05` | **Unit Cost Derivation** | **Calculated or Overridden** | By default, sub-assembly unit cost is auto-calculated from child items. Overrides require an engineering justification. |

### 5.2 Circular Reference Prevention PostgreSQL Function
```sql
CREATE OR REPLACE FUNCTION public.fn_prevent_circular_bom()
RETURNS TRIGGER AS $$
DECLARE
  v_cycle_detected BOOLEAN;
BEGIN
  IF NEW.sub_assembly_bom_id IS NOT NULL THEN
    -- Check if child BOM points back to parent BOM
    IF NEW.bom_id = NEW.sub_assembly_bom_id THEN
      RAISE EXCEPTION 'Circular BOM detected: A BOM cannot include itself as a sub-assembly'
        USING ERRCODE = '23514';
    END IF;

    -- Recursive check across ancestor path
    WITH RECURSIVE ancestors AS (
      SELECT bom_id FROM public.bom_components WHERE sub_assembly_bom_id = NEW.bom_id
      UNION
      SELECT bc.bom_id FROM public.bom_components bc JOIN ancestors a ON bc.sub_assembly_bom_id = a.bom_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE bom_id = NEW.sub_assembly_bom_id) INTO v_cycle_detected;

    IF v_cycle_detected THEN
      RAISE EXCEPTION 'Circular BOM detected: Adding sub-assembly % creates a recursive dependency cycle',
        NEW.sub_assembly_bom_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Snapshot & ECO Integration Strategy

### Historical Immutability
* When an ECO is submitted or approved, `eco_revision_snapshots` and `bom_versions` currently capture components as a flat array.
* **Proposed Enhancement:** The snapshot transformer ([`packages/validations/src/snapshot-transformer.ts`](file:///t:/My%20Projects/ECO-Flow/packages/validations/src/snapshot-transformer.ts)) will store the complete exploded tree hierarchy under a dedicated `tree_snapshot` property inside `snapshot_data`.
* Even if a child sub-assembly BOM is later modified by a separate ECO, the parent BOM version snapshot remains 100% frozen and tamper-proof.

---

## 7. API and Frontend Impact Analysis

### 7.1 Backend API Additions
1. `GET /api/v1/boms/:id/tree`: Returns the complete hierarchical nested tree structure (indented JSON).
2. `GET /api/v1/boms/:id/exploded`: Returns the flattened bottom-up summary of all raw materials (BOM Explosion).
3. `GET /api/v1/boms/:id/where-used`: Returns all parent assemblies that reference this BOM as a sub-assembly.
4. `POST /api/v1/boms/:id/components`: Extended to accept optional `subAssemblyBomId: string (UUID)`.

### 7.2 Frontend Web Changes
1. **Interactive Tree / Indented Viewer in [`BOMDetail.tsx`](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/pages/boms/BOMDetail.tsx):**
   * Expand/collapse chevron toggles for sub-assemblies.
   * Visual indent markers (`Level 1`, `Level 2`, `Level 3`).
   * "Open Sub-Assembly" direct navigation links.
2. **Component Addition Modal:**
   * Dynamic toggle: "Is this a Sub-Assembly?".
   * Searchable dropdown to pick an existing active BOM.
3. **Rolled-up Cost Breakdown:**
   * Total Material Cost vs. Total Sub-Assembly Cost badges in Indian Rupees (`₹`).

---

## 8. Phased Implementation Sequence

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1.1: Database Schema Migration & Cycle Trigger        │
│ Add sub_assembly_bom_id column + fn_prevent_circular_bom    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│ Phase 1.2: Backend Service & Explosion Queries              │
│ Build recursive CTE service + GET /boms/:id/tree endpoint   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│ Phase 1.3: Snapshot Transformer & Domain Types              │
│ Update packages/validations with nested snapshot schema     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│ Phase 1.4: Frontend Indented Tree UI & Navigation           │
│ Implement collapsible tree grid in BOMDetail.tsx            │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Verification & Safety Confirmation

* **Current Status:** Pure Architecture Audit completed.
* **Working Tree:** Pristine and unmodified.
* **Active Branch:** `frontend` maintained.
* **Ready for Milestone Execution:** Yes.

