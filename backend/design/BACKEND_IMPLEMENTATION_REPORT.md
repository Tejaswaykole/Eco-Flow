# ECOFlow Backend Implementation Report

## Executive Summary
This document summarizes the complete implementation of the ECOFlow backend API service on the `backend` branch. The system provides production-grade endpoints for authentication, role-based authorization (RBAC), user session tracking, product cataloging, hierarchical Bills of Materials (BOM), Engineering Change Orders (ECO) revision lifecycle, approval workflows, immutable audit logging, and concurrency control using idempotent keys.

All functionality connects directly to the dedicated ECOFlow Supabase PostgreSQL database project (`wzfppspkmvymoakobmsj`).

---

## Architecture Overview

The backend uses a modular layered architecture in `backend/src`:
- **Config (`src/config/`)**: Environment validation (`env.ts`) and Prisma client configuration (`database.ts`).
- **Middleware (`src/middleware/`)**:
  - `requestId.ts`: Attaches unique UUIDs to every HTTP request.
  - `auth.ts`: Bearer JWT token verification, user role and granular permission gating.
  - `validate.ts`: Strict Zod schema validation for request payloads.
  - `error.ts`: Global structured error handling mapping operational AppErrors, Zod validation errors, and PostgreSQL constraint violations.
- **Services (`src/services/`)**:
  - `security.service.ts`: Argon2id password hashing and verification, cryptographic random token generation, SHA-256 token hashing, and signed JWT issuance.
  - `idempotency.service.ts`: Atomic reservation, payload hash validation, lease timeout recovery, and cached response replaying.
  - `audit.service.ts`: Append-only audit trail logging for security and operational actions.
- **Domain Modules (`src/modules/`)**:
  - `auth`: Registration, credential authentication, single-use refresh token rotation, token family tracking, reuse detection, and session revocation.
  - `users`: User profiles, status queries, and primary role inspection.
  - `products`: Product categories, products, and versioned release histories.
  - `bom`: Bills of materials creation, revision line items, and Decimal precision cost calculations.
  - `eco`: Engineering change order state machines, draft revisions, change tracking, snapshot freezing on submission, and multi-signature/admin review release flows.
- **Application Core (`src/app.ts` & `src/server.ts`)**:
  - Helmet headers, CORS policies, cookie parsing, structured JSON error serialization.
  - Health checks: `/health` (uptime, version) and `/ready` (live PostgreSQL ping).

---

## Key Invariants & Safeguards Implemented

1. **Authentication & Token Lifecycle**:
   - Access tokens are short-lived JWTs (15m expiry).
   - Refresh tokens are cryptographically random (64 hex characters) and persisted strictly as SHA-256 hashes in the database.
   - When a refresh token is presented, a new family child token is generated while marking the previous token as replaced.
   - If an already replaced token is presented again, token reuse is detected and the entire token family is revoked to neutralize session hijacking.
2. **Deterministic Locking & Invariant Ordering**:
   - Primary role enforcement triggers and transactional updates follow UUID lock ordering.
3. **Immutable ECO Revisions and State Machine**:
   - Submissions freeze an exact immutable snapshot of product definition, BOM components, and change diffs.
   - Status transitions strictly adhere to the PostgreSQL database trigger state machine:
     `DRAFT -> SUBMITTED -> UNDER_REVIEW -> (APPROVED | REJECTED | CHANGES_REQUESTED)`.
4. **Idempotency Leases**:
   - Mutation requests accepting `Idempotency-Key` create an atomic reservation. Subsequent identical requests replay the cached response; modified payloads under the same key fail with 409 Conflict.
