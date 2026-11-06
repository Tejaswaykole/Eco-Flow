# ECOFlow Backend Test Report

## Test Execution Summary
- **Framework**: Vitest v3.2.7 with Supertest
- **Target Environment**: Live Supabase PostgreSQL (`wzfppspkmvymoakobmsj`)
- **Status**: **11 passed, 0 failed (100% PASS)**
- **Test File**: `backend/tests/api.test.ts`

---

## Test Cases & Results

| # | Test Suite | Test Scenario | Expected Result | Result |
|---|---|---|---|---|
| 1 | Health & System Status | `GET /health` | Status 200, uptime & system status | **PASS** |
| 2 | Health & System Status | `GET /ready` | Status 200, database connected | **PASS** |
| 3 | Authentication | Failed login attempt | Status 401, audit log recorded | **PASS** |
| 4 | Authentication | Refresh token rotation & reuse prevention | Status 200 on first call, 401 on token reuse | **PASS** |
| 5 | Products & BOM | Category & Product creation | Status 201, unique part numbers generated | **PASS** |
| 6 | Products & BOM | BOM creation & line item component calculation | Status 201, Decimal cost precision verified | **PASS** |
| 7 | ECO Lifecycle | Draft ECO & initial revision creation | Status 201, status `DRAFT`, active rev 1 | **PASS** |
| 8 | ECO Lifecycle | Add granular changes to draft ECO | Status 201, change recorded in database | **PASS** |
| 9 | ECO Lifecycle | Submit ECO, freeze snapshot & lock mutations | Status 200, status `SUBMITTED`, post-submit changes 400 | **PASS** |
| 10 | ECO Lifecycle | Review & approve ECO, generate version releases | Status 200, version incremented to 2 | **PASS** |
| 11 | Idempotency Protection | Duplicate request with `Idempotency-Key` header | Status 201 cached replay, same ID returned | **PASS** |

---

## Type-Check & Build Verification
- `pnpm --filter @ecoflow/backend run type-check`: **Exit code 0 (Clean)**
- `pnpm --filter @ecoflow/backend run build`: **Exit code 0 (Clean)**
