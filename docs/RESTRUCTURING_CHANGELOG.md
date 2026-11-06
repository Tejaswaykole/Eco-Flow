# ECOFlow Restructuring Changelog

**Date:** 2026-11-07
**Status:** Completed in Working Tree (Uncommitted)

---

## 1. Moved & Relocated Files

| Original Location | Target Location | Rationale / Category |
| :--- | :--- | :--- |
| `apps/api/prisma/schema.prisma` | `database/prisma/schema.prisma` | Moved to centralized database workspace. |
| `apps/api/prisma/design/*` (10 documents) | `database/design/*` | Centralized database design, invariant matrix, and security audits. |
| `apps/api/package.json` | Removed / Replaced by `database/package.json` & `backend/package.json` | Separated database tooling (`@ecoflow/database`) from API runtime (`@ecoflow/backend`). |

---

## 2. Newly Created Directories & Files

| New Path | Purpose |
| :--- | :--- |
| `database/package.json` | Database workspace package definition (`@ecoflow/database`) with Prisma scripts. |
| `database/sql/functions/` | Target folder for discrete raw PL/pgSQL function files. |
| `database/sql/triggers/` | Target folder for trigger declarations. |
| `database/sql/policies/` | Target folder for Row-Level Security policy definitions. |
| `database/sql/indexes/` | Target folder for composite & partial index DDL. |
| `backend/package.json` | Backend workspace package definition (`@ecoflow/backend`). |
| `backend/src/{modules,middleware,services,routes,utils}/` | Standardized backend architectural directories. |
| `backend/tests/smoke.test.ts` | Test harness validation smoke test. |
| `frontend/web/package.json` | Web application workspace package definition (`@ecoflow/web`). |
| `frontend/web/src/smoke.test.ts` | Web test harness validation smoke test. |
| `frontend/mobile/package.json` | Mobile application workspace package definition (`@ecoflow/mobile`). |
| `docs/MONOREPO_ARCHITECTURE.md` | Architectural specification document. |
| `docs/GIT_BRANCHING_STRATEGY.md` | Monorepo branch management and synchronization guide. |
| `docs/RESTRUCTURING_CHANGELOG.md` | Comprehensive directory and configuration audit log. |
| `docs/RESTRUCTURING_VALIDATION_REPORT.md` | Local validation command execution and exit code log. |

---

## 3. Modified Configurations

1. **`pnpm-workspace.yaml`**:
   - Replaced `apps/*` with:
     - `'backend'`
     - `'database'`
     - `'frontend/web'`
     - `'frontend/mobile'`
     - `'packages/*'`
2. **`package.json` (Root)**:
   - Updated convenience scripts to target `@ecoflow/database`:
     - `"prisma:validate": "pnpm --filter @ecoflow/database run prisma:validate"`
     - `"prisma:format": "pnpm --filter @ecoflow/database run prisma:format"`
     - `"prisma:generate": "pnpm --filter @ecoflow/database run prisma:generate"`
3. **`pnpm-lock.yaml`**:
   - Updated package links for the new workspace structure via safe local `pnpm install`.
4. **`.gitignore`**:
   - Comprehensive multi-layer secret, environment, and build ignore rules implemented and verified.
