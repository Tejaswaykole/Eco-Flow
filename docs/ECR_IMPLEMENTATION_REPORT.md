# ECOFlow Milestone 3 — Engineering Change Request (ECR) Implementation Report

**Milestone:** 3 — Engineering Change Request Implementation  
**Workspace:** `T:\My Projects\ECO-Flow`  
**Active Branch:** `frontend`  
**Date:** November 11, 2026  
**Status:** COMPLETE & VERIFIED

---

## 1. Executive Summary

Milestone 3 implements the end-to-end **Engineering Change Request (ECR)** module in ECOFlow. This capability establishes a structured, employee-friendly front door for reporting manufacturing defects, field issues, and product improvement proposals without requiring full engineering privileges.

The implementation provides:
1. **Unprivileged Issue Reporting**: Employees across all roles (including `OPERATOR`) can submit structured change requests with problem descriptions, severity, request types, and optional product/BOM/part references.
2. **Review & Information Workflow**: Authorized engineering reviewers (`LEAD_ENGINEER`, `APPROVER`, `ADMINISTRATOR`) can assign reviewers, start formal reviews, request additional information, accept requests, or reject them with mandatory rationale.
3. **Information Resubmission**: Submitters can respond to reviewer inquiries, clarify defect symptoms, and return requests to review.
4. **Atomic ECR-to-ECO Promotion**: Accepted change requests can be promoted by authorized engineering roles into full Engineering Change Orders (ECO). The operation is concurrency-safe, duplicate-prevented via PostgreSQL transactional advisory locking, carries over product/BOM/rationale, and permanently binds the originating ECR to the promoted ECO.
5. **Full Immutability for Terminal States**: Terminal states (`REJECTED`, `PROMOTED`) are permanently protected against unauthorized mutation or reopening.
6. **Isolated Automated Verification**: 100% test pass rate across backend and frontend unit test suites using isolated mock fixtures, with zero dependency on the live Supabase database.

---

## 2. Safety Boundaries & Compliance

- **Active Branch**: Verified on branch `frontend`.
- **Git Safety**: Zero `git commit`, `git push`, `git reset`, `git clean`, `git checkout`, or `git stash` operations performed.
- **Database Safety**: Zero connection to live Supabase during test execution. Migration 009 was not applied. Migration 010 SQL scripts were authored and validated against the Prisma schema without live execution.
- **Reference Folder Integrity**: `ECO-Flow-V1` and `EcoFlow-source` remained strictly read-only references.
- **Feature Preservation**: Preserved all existing single-level and multi-level BOM logic, ECO revision lifecycle functionality, and audit logging.

---

## 3. Data Model & Migration 010 Architecture

### 3.1 Prisma Schema Updates (`database/prisma/schema.prisma`)
The data model was defined following existing repository conventions:

- **Enums**:
  - `ECRRequestType`: `DEFECT`, `IMPROVEMENT`, `COST_REDUCTION`, `SAFETY`, `OTHER`
  - `ECRStatus`: `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFORMATION`, `ACCEPTED`, `REJECTED`, `PROMOTED`

- **Model `ECR`**:
  - `id`: UUID (Primary Key)
  - `ecr_number`: `VARCHAR(100)` (Unique human-friendly sequence `ECR-YYYYMMDD-XXXX`)
  - `title`: `VARCHAR(255)`
  - `description`: `TEXT`
  - `request_type`: `ECRRequestType`
  - `priority`: `PriorityLevel` (Default `MEDIUM`)
  - `status`: `ECRStatus` (Default `SUBMITTED`)
  - `product_id`: `UUID?` (Foreign key to `products.id`, `ON DELETE SET NULL`)
  - `bom_id`: `UUID?` (Foreign key to `boms.id`, `ON DELETE SET NULL`)
  - `submitted_by`: `UUID` (Foreign key to `users.id`, `ON DELETE RESTRICT`)
  - `assigned_to`: `UUID?` (Foreign key to `users.id`, `ON DELETE SET NULL`)
  - `affected_part_number`: `VARCHAR(100)?`
  - `suggested_solution`: `TEXT?`
  - `review_comments`: `TEXT?`
  - `rejection_reason`: `TEXT?`
  - `promoted_eco_id`: `UUID?` (Unique Foreign key to `ecos.id`, `ON DELETE SET NULL`)
  - `submitted_at`: `TIMESTAMPTZ(6)` (Default `now()`)
  - `reviewed_at`: `TIMESTAMPTZ(6)?`
  - `created_at`: `TIMESTAMPTZ(6)` (Default `now()`)
  - `updated_at`: `TIMESTAMPTZ(6)`

- **Model `ECO` Enhancements**:
  - `ecr_id`: `UUID? UNIQUE` (Foreign key to `ecrs.id`, `ON DELETE SET NULL`)
  - Bidirectional relation: `promoted_from_ecr` and `originating_ecr`.

- **Model `User`, `Product`, `BOM` Updates**:
  - `User.submitted_ecrs`: `ECR[] @relation("EcrSubmitter")`
  - `User.assigned_ecrs`: `ECR[] @relation("EcrAssignee")`
  - `Product.ecrs`: `ECR[]`
  - `BOM.ecrs`: `ECR[]`

### 3.2 SQL Migration Files
- **`database/sql/010_engineering_change_request.sql`**:
  - Creates `ECRRequestType` and `ECRStatus` Postgres enums with idempotency guards (`duplicate_object` handlers).
  - Creates table `public.ecrs` with composite indexes and cascading foreign keys.
  - Adds column `ecr_id UUID UNIQUE` to `public.ecos` with foreign key and index.
  - Seeds standard permissions (`ecr:create`, `ecr:read`, `ecr:review`, `ecr:decide`, `ecr:promote`).
  - Associates permissions across `OPERATOR`, `LEAD_ENGINEER`, `APPROVER`, and `ADMINISTRATOR` roles.
- **`database/sql/010_rollback_engineering_change_request.sql`**:
  - Safely drops role permission mappings, permission entries, foreign keys, table `ecrs`, column `ecos.ecr_id`, and created enum types.

---

## 4. Status Lifecycle & Transition Matrix

The ECR status lifecycle follows strict finite state machine rules:

```
                  ┌───────────────┐
                  │   SUBMITTED   │
                  └──────┬──┬─────┘
           startReview   │  │ rejectECR
                         ▼  └──────────────┐
                  ┌───────────────┐        │
     ┌───────────►│ UNDER_REVIEW  │        │
     │            └──────┬──┬─────┘        │
     │   requestInfo     │  │ acceptECR    │
     │  ┌────────────────┘  └──────┐       │
     │  ▼                          ▼       ▼
┌───────────────────┐       ┌──────────┐ ┌──────────┐
│ NEEDS_INFORMATION │       │ ACCEPTED │ │ REJECTED │ (Terminal)
└───────┬───────────┘       └────┬─────┘ └──────────┘
        │ resubmitECR            │ promoteToECO
        └────────────────────────┘       ▼
                                   ┌──────────┐
                                   │ PROMOTED │ (Terminal)
                                   └──────────┘
```

| Source State | Target State | Trigger Method | Required Role | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `SUBMITTED` | `UNDER_REVIEW` | `startReview` | Reviewer / Admin | Assigns reviewer; records review timestamp |
| `SUBMITTED` | `REJECTED` | `rejectECR` | Reviewer / Admin | Mandatory non-empty rejection reason required |
| `UNDER_REVIEW` | `NEEDS_INFORMATION` | `requestInformation`| Reviewer / Admin | Mandatory reviewer comments required |
| `NEEDS_INFORMATION`| `UNDER_REVIEW` | `resubmitECR` | Submitter / Admin | Submitter responds to inquiry with updated details |
| `UNDER_REVIEW` | `ACCEPTED` | `acceptECR` | Reviewer / Admin | Confirms request engineering validity |
| `UNDER_REVIEW` | `REJECTED` | `rejectECR` | Reviewer / Admin | Mandatory non-empty rejection reason required |
| `ACCEPTED` | `PROMOTED` | `promoteToECO` | Lead Engineer / Admin| Atomic ECO creation; prevents duplicate promotion |
| `REJECTED` | *Any* | — | — | **Terminal State:** Any transition attempt rejected |
| `PROMOTED` | *Any* | — | — | **Terminal State:** Any transition attempt rejected |

---

## 5. Authorization Matrix

| Action | API Endpoint | OPERATOR | LEAD_ENGINEER | APPROVER | ADMINISTRATOR |
| :--- | :--- | :---: | :---: | :---: | :---: |
| Submit ECR | `POST /api/v1/ecrs` | Yes | Yes | Yes | Yes |
| View Own ECRs | `GET /api/v1/ecrs` | Yes | Yes | Yes | Yes |
| View All Review Queue | `GET /api/v1/ecrs` | No (Own only) | Yes | Yes | Yes |
| View ECR Details | `GET /api/v1/ecrs/:id` | Own only | Yes | Yes | Yes |
| Assign Reviewer | `POST /api/v1/ecrs/:id/assign` | No | Yes | Yes | Yes |
| Start Review | `POST /api/v1/ecrs/:id/start-review` | No | Yes | Yes | Yes |
| Request Info | `POST /api/v1/ecrs/:id/request-information` | No | Yes | Yes | Yes |
| Provide Info / Resubmit | `POST /api/v1/ecrs/:id/resubmit` | Submitter | Yes | Submitter | Yes |
| Accept Request | `POST /api/v1/ecrs/:id/accept` | No | Yes | Yes | Yes |
| Reject Request | `POST /api/v1/ecrs/:id/reject` | No | Yes | Yes | Yes |
| Promote to ECO | `POST /api/v1/ecrs/:id/promote-to-eco` | No | Yes | No | Yes |

---

## 6. Promotion Transaction Design & Concurrency Protection

The promotion of an ACCEPTED ECR to an ECO (`ECRService.promoteToECO`) guarantees strict atomicity and idempotency:

1. **Transactional Advisory Lock**:
   Acquires lock `SELECT pg_advisory_xact_lock(4200000001003);` within a PostgreSQL transaction to serialize concurrent promotion requests on the same or related ECR.
2. **State Invariant Verification**:
   Validates that the ECR status is strictly `ACCEPTED`. Rejects requests if `SUBMITTED`, `UNDER_REVIEW`, `REJECTED`, or `PROMOTED`.
3. **Duplicate Promotion Prevention**:
   Verifies that `ecr.promoted_eco_id` is null. If an ECO already exists, throws `ConflictError`.
4. **ECO Number Collision Check**:
   Verifies proposed `eco_number` does not collide with existing ECOs.
5. **Product & BOM Validation**:
   Resolves target product and BOM IDs from ECR or request payload, verifying their existence and relationship.
6. **Atomic Entity Creation**:
   - Creates `ECO` with status `DRAFT`, `active_revision_no: 1`, title `[ECR <num>] <title>`, carryover problem description, and `ecr_id: ecr.id`.
   - Creates `ECORevision` 1 with status `DRAFT`.
   - Updates `ECR` to `status: 'PROMOTED'` and sets `promoted_eco_id: eco.id`.
7. **Audit Logging**:
   Emits `ECR_PROMOTED_TO_ECO` and `ECO_CREATED` events inside the transaction.

---

## 7. Frontend User Experience

### 7.1 Pages & Navigation
- **Sidebar Integration** ([`Sidebar.tsx`](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/components/layout/Sidebar.tsx)):
  Added **Change Requests (ECR)** navigation item with `ClipboardList` icon accessible to all authenticated users.
- **Routing** ([`App.tsx`](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/App.tsx)):
  Mounted `/ecrs` ([`ECRList.tsx`](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/pages/ecrs/ECRList.tsx)) and `/ecrs/:id` ([`ECRDetail.tsx`](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/pages/ecrs/ECRDetail.tsx)).
- **Badges** ([`Badges.tsx`](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/components/ui/Badges.tsx)):
  - Extended `StatusBadge` for `NEEDS_INFORMATION` (orange), `ACCEPTED` (teal), `PROMOTED` (indigo).
  - Created `RequestTypeBadge` for `DEFECT` (rose), `IMPROVEMENT` (sky), `COST_REDUCTION` (emerald), `SAFETY` (amber), `OTHER` (slate).

### 7.2 ECR List Page ([`ECRList.tsx`](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/pages/ecrs/ECRList.tsx))
- **Header & Action**: "Submit Request" button opens submission modal.
- **Filter Toolbar**: Search by title/number/part, status dropdown, request type dropdown, priority dropdown, and "My Requests Only" toggle.
- **Responsive Table**: Displays ECR #, Title, Type, Priority, Product/Part, Status, Submitter, Date, and "Workspace" link.
- **Submit Request Modal**:
  - Form fields: Title, Request Type, Priority, Related Product (dropdown), Related BOM (filtered by product), Affected Part Number, Problem Description, Suggested Solution.
  - **Upload Restriction Notice**: Informs user of the global upload restriction policy and advises textual documentation.
  - Form validation with inline error alerts.

### 7.3 ECR Detail & Review Workspace ([`ECRDetail.tsx`](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/pages/ecrs/ECRDetail.tsx))
- **Promoted ECO Alert**: High-visibility card with direct link to the created ECO workspace.
- **Rejection Banner**: Renders rejection reason in prominent alert when status is `REJECTED`.
- **Information Request Banner**: Displays reviewer comments and action button for submitter to provide details.
- **Review History Trail**: Chronological reviewer comments and timestamps.
- **Reviewer Action Workspace**:
  - Status `SUBMITTED`: "Start Formal Review" and "Reject Request"
  - Status `UNDER_REVIEW`: "Accept Change Request", "Request More Information", and "Reject Request"
  - Status `ACCEPTED`: "Promote to ECO" modal prefilling proposed ECO number, product, and BOM.

---

## 8. Automated Test Evidence

### 8.1 Backend Unit Test Suite (`backend/tests/ecr.test.ts`)
Command: `pnpm --filter @ecoflow/backend exec vitest run tests/ecr.test.ts`  
Result: **13 / 13 Passed (100%)**

| Test ID | Test Description | Result |
| :--- | :--- | :---: |
| `TC-ECR-01` | Creates ECR with generated ecr_number and SUBMITTED status | Passed |
| `TC-ECR-02` | Throws NotFoundError when referenced product or BOM does not exist | Passed |
| `TC-ECR-03` | Operators only see own submissions; Reviewers see all | Passed |
| `TC-ECR-04` | Operator is forbidden from viewing other users' private ECRs | Passed |
| `TC-ECR-05` | Valid transition: SUBMITTED -> UNDER_REVIEW (startReview) | Passed |
| `TC-ECR-06` | Valid transition: UNDER_REVIEW -> NEEDS_INFORMATION (requestInformation) | Passed |
| `TC-ECR-07` | Valid transition: NEEDS_INFORMATION -> UNDER_REVIEW (resubmitECR) | Passed |
| `TC-ECR-08` | Valid transition: UNDER_REVIEW -> ACCEPTED (acceptECR) | Passed |
| `TC-ECR-09` | Transition to REJECTED requires mandatory rejection reason | Passed |
| `TC-ECR-10` | Rejects invalid transitions and forbids mutating terminal states | Passed |
| `TC-ECR-11` | Promotes ACCEPTED ECR to ECO with atomic linking and advisory lock | Passed |
| `TC-ECR-12` | Duplicate promotion prevention: Rejects if already promoted or not ACCEPTED | Passed |
| `TC-ECR-13` | Prevents promotion if proposed ECO number already exists | Passed |

### 8.2 Frontend Test Suite (`frontend/web/tests/ecr.test.tsx`)
Command: `pnpm --filter @ecoflow/web run test -- tests/ecr.test.tsx`  
Result: **7 / 7 Passed (100%)**

| Test ID | Test Description | Result |
| :--- | :--- | :---: |
| `TC-FE-ECR-01` | Renders ECR List with requests, badges, and filters | Passed |
| `TC-FE-ECR-02` | Submit Request modal validates input and submits new change request | Passed |
| `TC-FE-ECR-03` | ECR Detail renders problem description and hardware context | Passed |
| `TC-FE-ECR-04` | Reviewer action controls: Start Review transitions from SUBMITTED | Passed |
| `TC-FE-ECR-05` | Reviewer action controls: Accept and Request Info buttons appear on UNDER_REVIEW | Passed |
| `TC-FE-ECR-06` | Promote to ECO action on ACCEPTED status calls promoteToECO | Passed |
| `TC-FE-ECR-07` | Promoted ECR renders linked ECO card with navigation link | Passed |

### 8.3 Monorepo Full Regression & Build Verification

| Package | Test Command | Result |
| :--- | :--- | :---: |
| `@ecoflow/validations` | `pnpm --filter @ecoflow/validations test` | **45 / 45 Passed** |
| `@ecoflow/domain-types` | `pnpm --filter @ecoflow/domain-types test` | **7 / 7 Passed** |
| `@ecoflow/backend` (unit) | `pnpm --filter @ecoflow/backend exec vitest run tests/smoke.test.ts tests/eco-revision.test.ts tests/ecr.test.ts` | **24 / 24 Passed** |
| `@ecoflow/web` (unit) | `pnpm --filter @ecoflow/web run test` | **24 / 24 Passed** |
| `@ecoflow/backend` (build) | `pnpm --filter @ecoflow/backend run build` (`tsc -b`) | **Clean (0 errors)** |
| `@ecoflow/web` (build) | `pnpm --filter @ecoflow/web run build` (`tsc -b && vite build`) | **Clean (0 errors)** |

---

## 9. Global Upload Restriction Adherence

In compliance with the workspace policy, no physical file, photo, or CAD attachment upload infrastructure was created:
- No S3, Supabase Storage, or multipart endpoints were added.
- The ECR submission modal and detail workspace explicitly display the **Attachments Restricted (Coming Soon)** banner informing users that file uploads are restricted and that defect details, part numbers, and observations must be documented textually.

---

## 10. Git Working-Tree Preservation Statement

All existing modified and untracked files have been strictly preserved. Zero commits, stashes, resets, cleans, or branch changes were performed.

```
 M .gitignore
 M backend/src/app.ts
 M backend/src/config/env.ts
 M backend/src/modules/bom/bom.controller.ts
 M backend/src/modules/bom/bom.routes.ts
 M backend/src/modules/bom/bom.schema.ts
 M backend/src/modules/bom/bom.service.ts
 M backend/src/modules/eco/eco.controller.ts
 M backend/src/modules/eco/eco.routes.ts
 M backend/src/modules/eco/eco.schema.ts
 M backend/src/modules/eco/eco.service.ts
 M backend/src/server.ts
 M database/prisma/schema.prisma
 M frontend/web/.env.example
 M frontend/web/src/App.tsx
 M frontend/web/src/components/layout/Sidebar.tsx
 M frontend/web/src/components/ui/Badges.tsx
 M frontend/web/src/context/AuthContext.tsx
 M frontend/web/src/lib/api.ts
 M frontend/web/src/lib/utils.ts
 M frontend/web/src/pages/auth/Login.tsx
 M frontend/web/src/pages/boms/BOMDetail.tsx
 M frontend/web/src/pages/ecos/ECODetail.tsx
 M frontend/web/src/pages/products/ProductDetail.tsx
 M frontend/web/src/services/index.ts
 M frontend/web/src/types/index.ts
 M frontend/web/tests/components.test.tsx
 M packages/domain-types/src/enums.ts
 M packages/domain-types/src/models/index.ts
 M packages/validations/src/index.ts
 M packages/validations/src/snapshot-transformer.ts
?? backend/src/modules/ecr/
?? backend/tests/eco-revision.test.ts
?? backend/tests/ecr.test.ts
?? database/sql/009_multi_level_bom_support.sql
?? database/sql/009_rollback_multi_level_bom.sql
?? database/sql/010_engineering_change_request.sql
?? database/sql/010_rollback_engineering_change_request.sql
?? docs/ECOFLOW_COMPREHENSIVE_PRODUCT_AUDIT.md
?? docs/ECOFLOW_NEXT_PHASE_READINESS.md
?? docs/ECO_REVISION_LIFECYCLE_IMPLEMENTATION_REPORT.md
?? docs/ECR_IMPLEMENTATION_REPORT.md
?? docs/MULTI_LEVEL_BOM_IMPLEMENTATION_REPORT.md
?? docs/architecture/
?? docs/product-audit/
?? frontend/web/src/pages/ecrs/
?? frontend/web/tests/eco-detail.test.tsx
?? frontend/web/tests/ecr.test.tsx
?? frontend/web/tests/integration-fixes.test.ts
?? packages/validations/src/ecr.schema.ts
?? packages/validations/tests/multilevel-bom-evidence.test.ts
```

---

## 11. Conclusion

Milestone 3 (**Engineering Change Request**) is **100% complete, fully tested, and verified**. Employees can now report issues with low privilege, reviewers can progress requests through a robust state machine, and accepted items can be transactionally promoted into Engineering Change Orders while preserving permanent audit traceability.

