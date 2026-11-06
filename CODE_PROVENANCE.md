# ECOFlow — Code Provenance Register

**Repository**: `T:\My Projects\ECO-Flow`
**Reference Repository (READ-ONLY)**: `T:\My Projects\EcoFlow-source` (Team Legacy Implementation)
**Date Established**: November 6, 2026
**Purpose**: Rigorously record the origin, adaptation, independent invention, and exclusion of all modules and components across the rebuild.

---

## 1. Classification Definitions

- **Adapted**: Core domain ideas, schemas, or algorithms referenced from `EcoFlow-source`, restructured, modernized, type-strengthened, or refactored for the clean architecture.
- **Independent**: Freshly engineered logic, types, infrastructure, or design patterns created exclusively for this standalone implementation with no legacy predecessor.
- **Excluded**: Legacy code, mock utilities, or outdated packages deliberately omitted due to low utility, poor structure, or severe technical/security debt.

---

## 2. Milestone 1: Shared Packages Provenance Matrix

| Target Package & File in `ECO-Flow`            | Original Reference in `EcoFlow-source`                        | Classification  | Specific Modifications & Individual Contributions                                                                                                                                                                                                                 |
| :--------------------------------------------- | :------------------------------------------------------------ | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain-types/src/enums.ts`           | `packages/shared-types/src/index.ts` (lines 15, 45, 117, 142) | **Adapted**     | Replaced fragile string union types with first-class TypeScript Enums matching target PostgreSQL enums (`UserStatus`, `ECOStatus`, `PriorityLevel`, `ChangeType`, `ImpactType`, `ApprovalDecision`, `ProductStatus`, `BOMStatus`).                                |
| `packages/domain-types/src/models/index.ts`    | `packages/shared-types/src/index.ts` (lines 1-385)            | **Adapted**     | Modernized domain interfaces. Added hardened session attributes (`tokenFamily`, `refreshTokenHash`, `isRevoked`, `replacedByTokenHash`) for token rotation and reuse detection. Added immutable versioning and audit trail contracts. Eliminated `any`.           |
| `packages/domain-types/src/contracts/index.ts` | Scattered ad-hoc in backend controllers                       | **Independent** | Built standardized API contracts: generic response envelopes (`ApiResponse<T>`, `ApiErrorResponse`, `PaginatedResponse<T>`), authentication DTOs (`LoginRequest`, `LoginResponse`, `RefreshTokenRequest`), filter query params, and approval processing payloads. |
| `packages/domain-types/src/index.ts`           | `packages/shared-types/src/index.ts`                          | **Independent** | Clean barrel export providing encapsulated package boundaries.                                                                                                                                                                                                    |
| `packages/validations/src/auth.schema.ts`      | `packages/shared-validations/src/index.ts` (lines 3-30)       | **Adapted**     | Added password complexity regex (`^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)`), maximum character boundaries, and dedicated `RefreshTokenSchema`. Reused `UserStatus` enum directly.                                                                                         |
| `packages/validations/src/product.schema.ts`   | `packages/shared-validations/src/index.ts` (lines 54-106)     | **Adapted**     | Enforced regex pattern `/^[A-Za-z0-9_-]+$/` on product codes to block special characters. Added URL format validation for image assets.                                                                                                                           |
| `packages/validations/src/bom.schema.ts`       | `packages/shared-validations/src/index.ts` (lines 108-140)    | **Adapted**     | Enforced strictly positive component quantities (`quantity > 0`), non-negative costs (`unitCost >= 0`), and code regex pattern.                                                                                                                                   |
| `packages/validations/src/eco.schema.ts`       | `packages/shared-validations/src/index.ts` (lines 142-226)    | **Adapted**     | Added conditional Zod `superRefine` validation: review notes are strictly mandatory if an ECO approval decision is `REJECTED` or `CHANGES_REQUESTED`. Added minimum 1 change requirement for ECO submissions.                                                     |
| `packages/validations/src/index.ts`            | `packages/shared-validations/src/index.ts`                    | **Independent** | Clean barrel export of all schemas and inferred TypeScript types.                                                                                                                                                                                                 |
| `packages/shared-constants/*`                  | `packages/shared-constants/src/index.ts`                      | **Excluded**    | Excluded static object with only 2 roles and 4 routes; consolidated into domain-types enums.                                                                                                                                                                      |
| `packages/shared-ui/*`                         | `packages/shared-ui/src/index.tsx`                            | **Excluded**    | Excluded bare unstyled HTML wrappers (`<button>`, `<div>`). Client applications will use dedicated UI component libraries.                                                                                                                                        |
| `apps/backend/src/check_*.ts`, `test_*.ts`     | `apps/backend/src/*.ts`                                       | **Excluded**    | Excluded loose manual script files; automated Vitest/Supertest test suites are used instead.                                                                                                                                                                      |
