# Database Integration Test Plan

This test plan defines the complete verification suite for all ECOFlow database invariants, triggers, constraints, concurrency paths, and error conditions.

---

## 1. Test Suite Categories & Execution Status

| Category | Description | Status | Target Environment |
|---|---|---|---|
| **Cat 1: Domain & Unit Contracts** | Schema validation, Decimal.js monetary precision, RFC 4122 UUID v5 test vector, snapshot transformation invariants | **Executed & Passing** (38/38 tests) | Local Vitest test runner |
| **Cat 2: Schema Syntax & AST** | Prisma schema format, relational consistency, composite keys, PostgreSQL types | **Executed & Passing** | Prisma CLI compiler |
| **Cat 3: PostgreSQL Database Invariants** | Constraint triggers, partial indexes, immutability triggers, lock ordering, role grants | **Designed (Unexecuted)** | Requires live PostgreSQL / Supabase instance (Milestone 3.2+) |
| **Cat 4: Concurrent Collision Scenarios** | Competing lease reclaimers, concurrent role reassignment, concurrent version counter increments | **Designed (Unexecuted)** | Multi-connection integration harness against live PostgreSQL instance |

---

## 2. Live Database Integration Test Specifications (Category 3 & 4)

### Group A: Primary-Role Invariants
1. **Test A1 (Zero Primary Roles at Commit)**:
   - Insert user with `status = 'ACTIVE'`.
   - Attempt transaction commit without inserting into `user_roles`.
   - **Expected Result:** Deferred trigger `trg_users_validate_activation_deferred` raises `23514` exception; transaction aborts.
2. **Test A2 (Two Primary Roles Immediate Rejection)**:
   - Insert primary role for user.
   - Insert second row into `user_roles` with `is_primary = true` for the same user.
   - **Expected Result:** Partial unique index `idx_user_roles_one_primary_per_user` throws unique violation (`23505`); transaction aborts.
3. **Test A3 (Concurrent Cross-User Role Reassignment)**:
   - User 1 has Role A (primary). User 2 has Role B (primary).
   - Connection 1 attempts to reassign Role A to User 2.
   - Connection 2 attempts to reassign Role B to User 1.
   - **Expected Result:** `trg_user_roles_lock_users_before_mutation` acquires locks on User 1 and User 2 in sorted UUID order; one transaction waits cleanly without circular deadlock. Both validate at commit.

---

### Group B: ECO Revision & Change Protection
1. **Test B1 (Change Insertion into Submitted Revision)**:
   - Create ECO with Revision 1 in `SUBMITTED` status.
   - Attempt to insert new row into `eco_changes` for Revision 1.
   - **Expected Result:** `trg_eco_changes_enforce_draft_revision` raises `23514` exception (`Cannot INSERT ECOChange: revision status is SUBMITTED (must be DRAFT)`); row is rejected.
2. **Test B2 (Cross-ECO / Cross-Revision Reassignment)**:
   - Insert change on Revision 1.
   - Attempt `UPDATE eco_changes SET revision_number = 2 WHERE id = $id`.
   - **Expected Result:** Trigger raises `23514` exception (`ECOChange cannot be moved to another ECO or revision`); update is rejected.
3. **Test B3 (Concurrent Submission and Change Insertion)**:
   - Connection 1 runs submission transaction (acquires row lock on ECO and Revision 1).
   - Connection 2 attempts to insert a change into Revision 1.
   - **Expected Result:** Connection 2 blocks on revision row lock. When Connection 1 commits `SUBMITTED`, Connection 2 unblocks, reads `status = 'SUBMITTED'`, and fails cleanly.
4. **Test B4 (Active Revision Pointer Cross-Wiring)**:
   - Attempt `UPDATE ecos SET active_revision_no = 99 WHERE id = $eco_id;`.
   - **Expected Result:** Composite foreign key `fk_ecos_active_revision` aborts commit with foreign key violation `23503`.
5. **Test B5 (ECO Revision Lifecycle Violation)**:
   - Revision is in `DRAFT`. Attempt `UPDATE eco_revisions SET status = 'APPROVED'`.
   - **Expected Result:** Trigger `trg_eco_revisions_enforce_lifecycle` raises `22023` exception (`DRAFT revision can only transition to SUBMITTED or CANCELLED`).
6. **Test B6 (ECO Header Status Desynchronization Guard)**:
   - Revision 1 is `DRAFT`. Attempt direct `UPDATE ecos SET status = 'SUBMITTED' WHERE id = $eco_id`.
   - **Expected Result:** Trigger `trg_ecos_guard_header_revision_consistency` raises `23514` exception (`ECO header status contradicts active revision status`).
7. **Test B7 (Automatic Header Synchronization on Revision Status Update)**:
   - Revision 1 is active. Update `eco_revisions.status = 'UNDER_REVIEW'`.
   - Query `ecos.status`.
   - **Expected Result:** `trg_eco_revisions_sync_header_status` automatically synchronizes `ecos.status = 'UNDER_REVIEW'` in the same transaction.
8. **Test B8 (Automatic Header Synchronization on Pointer Change)**:
   - Revision 1 is `CHANGES_REQUESTED`. Revision 2 is created in `DRAFT`.
   - Update `ecos.active_revision_no = 2`.
   - **Expected Result:** `trg_ecos_sync_on_pointer_change` automatically updates `ecos.status = 'DRAFT'`.

---

### Group C: Frozen Snapshot Integrity
1. **Test C1 (Submission Without Frozen Snapshot)**:
   - Update `eco_revisions.status = 'SUBMITTED'`.
   - Do not insert corresponding row into `eco_revision_snapshots`.
   - Attempt transaction commit.
   - **Expected Result:** Deferred constraint trigger `trg_eco_revisions_require_snapshot_deferred` raises `23514` exception; transaction aborts.
2. **Test C2 (Snapshot Immutability)**:
   - Insert valid snapshot row.
   - Attempt `UPDATE eco_revision_snapshots SET snapshot_data = '{"tampered": true}'`.
   - **Expected Result:** `trg_eco_revision_snapshots_immutable` throws `23514` exception (`Table eco_revision_snapshots is strictly immutable`).
3. **Test C3 (Snapshot Deletion Rejection)**:
   - Attempt `DELETE FROM eco_revision_snapshots WHERE id = $id`.
   - **Expected Result:** Rejected by trigger.

---

### Group D: Approval Integrity & Governance
1. **Test D1 (Duplicate Decision on Same Revision)**:
   - Insert decision row in `approvals` for Revision 1.
   - Attempt inserting second decision row for Revision 1.
   - **Expected Result:** Unique constraint `approvals_eco_id_revision_number_key` raises `23505`; insert rejected.
2. **Test D2 (Decision Immutability)**:
   - Attempt `UPDATE approvals SET decision = 'APPROVED' WHERE id = $id`.
   - **Expected Result:** Trigger `trg_approvals_immutable` aborts with `23514`.

---

### Group E: Idempotency Concurrency & Lifecycle
1. **Test E1 (Simultaneous First-Time Reservations)**:
   - 10 concurrent connections execute Phase A `INSERT INTO idempotency_keys ... ON CONFLICT (scope, key) DO NOTHING RETURNING *`.
   - **Expected Result:** Exactly 1 connection receives a returned row; 9 connections receive 0 rows and cleanly branch to existing reservation inspection.
2. **Test E2 (Competing Lease Reclaimers on Expired Lease)**:
   - Reservation exists with `status = 'PROCESSING'` and `lease_expires < clock_timestamp()`.
   - 5 concurrent connections attempt atomic `UPDATE ... WHERE status = 'PROCESSING' AND lease_expires < clock_timestamp() AND claim_token = $old_token`.
   - **Expected Result:** Exactly 1 connection gets `affected_rows = 1` and acquires the lease; 4 connections get `affected_rows = 0` and return HTTP 423 Locked.
3. **Test E3 (Idempotency Identity Immutability)**:
   - Attempt `UPDATE idempotency_keys SET actor_id = $hacker_id WHERE id = $id`.
   - **Expected Result:** Trigger `trg_idempotency_keys_protect_identity` aborts with `23514` (`Idempotency reservation identity fields are strictly immutable`).
4. **Test E4 (COMPLETED Status Reversal Attempt)**:
   - Reservation is `COMPLETED`. Attempt `UPDATE idempotency_keys SET status = 'PROCESSING' WHERE id = $id`.
   - **Expected Result:** Trigger `trg_idempotency_keys_protect_identity` aborts with `23514` (`COMPLETED reservation is terminal`).
5. **Test E5 (COMPLETED Response Body Immutability)**:
   - Reservation is `COMPLETED`. Attempt `UPDATE idempotency_keys SET response_body = '{"tampered": true}' WHERE id = $id`.
   - **Expected Result:** Trigger `trg_idempotency_keys_protect_identity` aborts with `23514` (`Stored idempotency response body is strictly immutable`).

---

### Group F: Version Counter Concurrency & Release State Machine
1. **Test F1 (Concurrent Version Counter Increments on Same Product)**:
   - Two ECOs affecting Product 1 are approved simultaneously across two connections.
   - Both workflows execute `UPDATE products SET current_version = current_version + 1 WHERE id = $product_id RETURNING current_version`.
   - **Expected Result:** Second connection waits for first to commit. Generated `ProductVersion` rows have version numbers 2 and 3 with zero gaps or collisions (`COUNT(*) + 1` prohibited).
2. **Test F2 (VersionRelease Transition Skipping)**:
   - Insert release with `release_status = 'SCHEDULED'`.
   - Attempt `UPDATE version_releases SET release_status = 'DEPRECATED'`.
   - **Expected Result:** `trg_version_releases_controlled_mutation` raises `22023` exception (`SCHEDULED can only transition to RELEASED`).
3. **Test F3 (Terminal Release Immutability)**:
   - Transition release to `DEPRECATED`.
   - Attempt `UPDATE version_releases SET release_status = 'RELEASED'`.
   - **Expected Result:** Exception: `DEPRECATED is a terminal status and cannot be changed`.

---

### Group G: Audit Protection & Role Security
1. **Test G1 (Audit Modification Rejection)**:
   - Attempt `UPDATE audit_logs SET user_id = $hacker_id`.
   - **Expected Result:** `trg_audit_logs_immutable` raises exception.
2. **Test G2 (Audit Truncation Rejection)**:
   - Attempt `TRUNCATE TABLE audit_logs;`.
   - **Expected Result:** `trg_audit_logs_no_truncate` raises `42501` exception.
3. **Test G3 (Client Role Direct Write Revocation)**:
   - Connect using Supabase `authenticated` role.
   - Attempt `INSERT INTO audit_logs ...`.
   - **Expected Result:** PostgreSQL engine raises permission denied (`42501`).
