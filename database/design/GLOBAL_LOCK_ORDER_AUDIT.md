# Global Lock Order Audit & Deadlock Prevention

This document audits all transaction workflows, lock-acquiring statements, and trigger executions in ECOFlow against the complete global hierarchy:

$$\mathbf{IdempotencyKeys} \longrightarrow \mathbf{Users} \longrightarrow \mathbf{UserRoles} \longrightarrow \mathbf{Products} \longrightarrow \mathbf{BOMs} \longrightarrow \mathbf{ECOs} \longrightarrow \mathbf{ECORevisions} \longrightarrow \mathbf{ECOChanges / Snapshots}$$

---

## 1. Global Lock Order Inventory by Workflow

### Workflow 1: Idempotency Phase A (Reservation & Reclaim)
- **Scope:** Independent, atomic short transaction before business payload execution.
- **Statements Executed:**
  ```sql
  -- Attempt 1: Atomic insertion
  INSERT INTO idempotency_keys (
    id, scope, key, actor_id, resource_id, request_hash,
    status, claim_token, lease_expires, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), $1, $2, $3::uuid, $4, $5,
    'PROCESSING', $6::uuid, clock_timestamp() + make_interval(secs => $7::double precision),
    clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (scope, key) DO NOTHING
  RETURNING *;

  -- Attempt 2 (On conflict): Atomic reclaim if lease expired
  UPDATE idempotency_keys
  SET claim_token = $claim_token::uuid,
      lease_expires = clock_timestamp() + make_interval(secs => $lease_duration::double precision),
      updated_at = clock_timestamp()
  WHERE scope = $scope
    AND key = $key
    AND status = 'PROCESSING'
    AND lease_expires < clock_timestamp()
    AND claim_token = $existing_claim_token::uuid
  RETURNING *;
  ```
- **Order Observed:** `IdempotencyKeys` exclusively. Does not touch any application tables.
- **Deadlock Analysis:** Phase A never holds business locks and completes in $< 5$ milliseconds.

---

### Workflow 2: User Role Mutation (`user_roles` INSERT / UPDATE / DELETE)
- **Initiator:** Administrator assigning, updating, or removing user roles.
- **Application Transaction Protocol (Strict Pre-DML Lock Acquisition):**
  > **Crucial Engine Invariant:** A `BEFORE ROW` trigger on `user_roles` is **not sufficient by itself** to establish the canonical global lock order (`Users` $\to$ `UserRoles`). During `UPDATE` or `DELETE`, PostgreSQL's execution engine acquires an exclusive tuple lock on the target `user_roles` row *before* firing the `BEFORE ROW` trigger. If the trigger then executes `SELECT ... FROM users FOR UPDATE`, an inverted dependency (`UserRoles` $\to$ `Users`) is created against concurrent transactions locking `Users` then `UserRoles`.
  >
  > **Therefore, all application write paths MUST acquire User locks in the application transaction prior to executing UserRoles DML:**
  1. **Resolve Affected User IDs**:
     - Single-user mutation (INSERT / DELETE / UPDATE in-place): Determine target `user_id`.
     - Reassignment across users ($U_{old} \ne U_{new}$): Identify both `OLD.user_id` and `NEW.user_id`.
  2. **Acquire Deterministic Row Locks on Users in Ascending UUID Order**:
     - Single user: `SELECT id FROM public.users WHERE id = $user_id FOR UPDATE;`
     - Reassignment:
       ```sql
       SELECT id FROM public.users
       WHERE id IN ($user_a, $user_b)
       ORDER BY id ASC
       FOR UPDATE;
       ```
     - Verifies that all referenced users exist and are visible. If a user is missing or deactivated, aborts immediately.
  3. **Execute `user_roles` DML**:
     - Perform `INSERT`, `UPDATE`, or `DELETE` on `public.user_roles`.
     - Defensive trigger `fn_lock_users_for_role_mutation()` acts as a secondary failsafe (e.g. for direct DB scripts), but application transactions guarantee zero lock inversion.
  4. **Commit-Time Deferred Invariant**:
     - Constraint trigger `trg_user_roles_validate_primary_deferred` validates that every affected `ACTIVE` user possesses exactly 1 primary role.
  5. **Commit**.
- **Order Observed:** `Users` $\longrightarrow$ `UserRoles`.
- **Deadlock Analysis:** The sorted lock acquisition order (`MIN(UUID)` then `MAX(UUID)`) mathematically guarantees that two concurrent cross-reassignments ($U_1 \to U_2$ and $U_2 \to U_1$) will always acquire $U_1$ before $U_2$, completely eliminating circular wait deadlock conditions.

---

### Workflow 3: User Status Activation (`users` UPDATE of `status`)
- **Initiator:** Administrator activating a user (`PENDING` $\to$ `ACTIVE`).
- **Statements Executed:**
  1. `UPDATE users SET status = 'ACTIVE' WHERE id = $id;` (Acquires exclusive row lock on `users`).
  2. At commit, deferred constraint trigger `trg_users_validate_activation_deferred` executes `SELECT COUNT(*) FROM user_roles WHERE user_id = NEW.id AND is_primary = true;`.
- **Order Observed:** `Users` $\longrightarrow$ `UserRoles` (read-only validation).
- **Deadlock Analysis:** Compatible with Workflow 2. Does not acquire any subsequent engineering locks.

---

### Workflow 4: ECO Change Mutation (`eco_changes` INSERT / UPDATE / DELETE)
- **Initiator:** Engineer creating, modifying, or removing a change on a draft revision.
- **Canonical Top-Down Lock Sequence (Application Protocol):**
  1. Discovery read: `SELECT product_id, bom_id FROM public.ecos WHERE id = $eco_id;`
  2. Lock Product: `SELECT id FROM public.products WHERE id = $product_id FOR UPDATE;`
  3. Lock BOM: `SELECT id FROM public.boms WHERE id = $bom_id AND product_id = $product_id FOR UPDATE;`
  4. Lock ECO Header: `SELECT id, active_revision_no, status FROM public.ecos WHERE id = $eco_id FOR UPDATE;`
  5. Lock Target ECORevision: `SELECT revision_number, status FROM public.eco_revisions WHERE eco_id = $eco_id AND revision_number = $rev_no FOR UPDATE;`
  6. Revalidate: Check `eco.product_id = $product_id`, `eco.bom_id = $bom_id`, and `revision.status = 'DRAFT'`.
  7. Mutate `eco_changes` row.
- **Order Observed:** `Products` $\longrightarrow$ `BOMs` $\longrightarrow$ `ECOs` $\longrightarrow$ `ECORevisions` $\longrightarrow$ `ECOChanges`.
- **Deadlock Analysis:** Consistent canonical top-down hierarchy. Prevents any inversion between Product/BOM modifications and revision change updates.

---

### Workflow 5: ECO Revision Status Mutation & Submission (`eco_revisions` Status Transition)
- **Initiator:** Author submitting an ECO draft (`DRAFT` $\to$ `SUBMITTED`), reviewer advancing status (`SUBMITTED` $\to$ `UNDER_REVIEW`), or reviewer requesting changes / rejecting.
- **Canonical Top-Down Lock Sequence (Application Protocol):**
  1. **Reserve Idempotency Key** (if triggered via client mutation request):
     Acquires exclusive row lock in Phase B on `idempotency_keys` reservation row.
  2. **Resolve Immutable Product/BOM Associations**:
     `SELECT product_id, bom_id FROM public.ecos WHERE id = $eco_id;`
  3. **Lock Product**:
     `SELECT id FROM public.products WHERE id = $product_id FOR UPDATE;`
  4. **Lock BOM**:
     `SELECT id FROM public.boms WHERE id = $bom_id AND product_id = $product_id FOR UPDATE;`
  5. **Lock ECO Header**:
     `SELECT id, active_revision_no, status FROM public.ecos WHERE id = $eco_id FOR UPDATE;`
     *(Revalidates `eco.product_id = $product_id` and `eco.bom_id = $bom_id`)*.
  6. **Lock Exact ECORevision**:
     `SELECT revision_number, status FROM public.eco_revisions WHERE eco_id = $eco_id AND revision_number = $rev_no FOR UPDATE;`
  7. **Revalidate Active Revision Pointer & Permitted State Machine**:
     - Asserts `eco_revisions.status` is in valid precursor state for requested transition.
     - For submission (`DRAFT` $\to$ `SUBMITTED`): Generates and inserts frozen snapshot into `eco_revision_snapshots`.
  8. **Execute Revision Mutation**:
     `UPDATE public.eco_revisions SET status = $target_status, updated_at = clock_timestamp() WHERE eco_id = $eco_id AND revision_number = $rev_no;`
  9. **Header Synchronization via AFTER Trigger**:
     Trigger `trg_eco_revisions_sync_header_status` fires. Because the parent ECO row was **already locked at Step 5**, the trigger's `SELECT active_revision_no FROM public.ecos` reads the locked state without establishing new locks. If `active_revision_no = NEW.revision_number`, it updates `ecos.status = NEW.status`.
  10. **Commit-Time Deferred Invariant Verification**:
      Deferred constraint triggers `trg_ecos_guard_header_revision_consistency` and `trg_eco_revisions_require_snapshot_deferred` assert state consistency at commit.
- **Order Observed:** `IdempotencyKeys` $\longrightarrow$ `Products` $\longrightarrow$ `BOMs` $\longrightarrow$ `ECOs` $\longrightarrow$ `ECORevisions` $\longrightarrow$ `ECORevisionSnapshots`.
- **Deadlock Analysis:** Complies strictly with the global hierarchy. The AFTER trigger never establishes locks on its own; all locks are acquired deterministically top-down by the application transaction prior to writing.

---

### Workflow 6: ECO Approval & Version Release (`executeApprovalWorkflow`)
- **Initiator:** Designated lead approver or administrator.
- **Statements Executed (Unified Atomic Transaction):**
  1. **Phase B Row Lock on Idempotency Key**:
     `SELECT * FROM idempotency_keys WHERE id = $reservation_id FOR UPDATE;`
     *(Validates claim token and `clock_timestamp() < lease_expires`)*.
  2. **Lock Approver User**:
     `SELECT * FROM users WHERE id = $actor_id FOR UPDATE;`
     *(Validates user is `ACTIVE` and cannot be concurrently deactivated)*.
  3. **Read Parent Identifiers without Lock**:
     `SELECT product_id, bom_id FROM ecos WHERE id = $eco_id;`
  4. **Lock Product**:
     `SELECT * FROM products WHERE id = $product_id FOR UPDATE;`
  5. **Lock BOM**:
     `SELECT * FROM boms WHERE id = $bom_id AND product_id = $product_id FOR UPDATE;`
  6. **Lock ECO Header**:
     `SELECT * FROM ecos WHERE id = $eco_id FOR UPDATE;`
     *(Revalidation: Asserts `eco.product_id === $product_id` and `eco.bom_id === $bom_id`)*.
  7. **Lock Active ECORevision**:
     `SELECT * FROM eco_revisions WHERE eco_id = $eco_id AND revision_number = $active_revision_no FOR UPDATE;`
  8. **Atomic Version Counter Increments (In-Place)**:
     - Increment Product version counter:
       `UPDATE products SET current_version = current_version + 1 WHERE id = $product_id RETURNING current_version;`
     - Increment BOM version counter:
       `UPDATE boms SET current_version = current_version + 1 WHERE id = $bom_id AND product_id = $product_id RETURNING current_version;`
  9. **Create Immutable Versions**:
     - Insert `ProductVersion` with returned `current_version`.
     - Insert `BOMVersion` with returned `current_version`.
  10. **Create VersionRelease**:
     - Insert `VersionRelease` linking the new product and BOM version IDs with status `'RELEASED'`.
  11. **Write Audit Record**:
     - Insert `AuditLog` row with authoritative action name (e.g. `ECO_APPROVAL_APPROVED`).
  12. **Finalize Idempotency Key within Same Transaction**:
     ```sql
     UPDATE idempotency_keys
     SET status = 'COMPLETED',
         response_body = $payload::jsonb,
         claim_token = NULL,
         lease_expires = NULL,
         completed_at = clock_timestamp(),
         updated_at = clock_timestamp()
     WHERE id = $reservation_id::uuid
       AND status = 'PROCESSING'
       AND claim_token = $claim_token::uuid;
     ```
- **Order Observed:** `IdempotencyKeys` $\longrightarrow$ `Users` $\longrightarrow$ `Products` $\longrightarrow$ `BOMs` $\longrightarrow$ `ECOs` $\longrightarrow$ `ECORevisions`.
- **Deadlock Analysis:** Complies strictly with the top-down hierarchy.

---

## 2. In-Depth Concurrency & Race Condition Analysis

### A. Authorization Concurrency Policy (Approver Deactivation vs. Approval)
- **Scenario:** Administrator deactivates user $U_1$ while $U_1$ submits an approval decision.
- **Resolution:**
  - Deactivation transaction acquires exclusive row lock on `users` where `id = U_1`.
  - Approval transaction executes step 2: `SELECT * FROM users WHERE id = U_1 FOR UPDATE`.
  - The database serializes the two transactions on the $U_1$ row lock.
  - If deactivation commits first, approval acquires the lock, reads `status = 'INACTIVE'`, and immediately aborts with HTTP 403 Forbidden.
  - If approval commits first, the approval was legitimately recorded before the deactivation committed.

### B. Two ECOs Approving for the Same Product Concurrently
- **Scenario:** $ECO_A$ and $ECO_B$ modify the same Product $P_1$ and both receive approval requests at the same instant.
- **Resolution:**
  - Both transactions reach Step 4: `SELECT * FROM products WHERE id = P_1 FOR UPDATE`.
  - Transaction 1 acquires the lock on $P_1$. Transaction 2 blocks.
  - Transaction 1 executes `UPDATE products SET current_version = current_version + 1 ... RETURNING current_version` (incrementing from 1 to 2), generates `ProductVersion` (version 2), and commits.
  - Transaction 2 unblocks, reads $P_1$'s updated `current_version = 2`, increments to 3, generates `ProductVersion` (version 3), and commits.
  - **Result:** Version numbers are guaranteed strictly monotonic and gapless; unique composite constraint `@@unique([product_id, version_number])` is never violated. `COUNT(*) + 1` is explicitly prohibited.

### C. ECO Product/BOM Reassignment Race
- **Scenario:** Can an ECO change its `product_id` while an approval transaction is discovering and locking rows?
- **Resolution:**
  - First defense: `trg_eco_product_bom_immutable` rejects any `UPDATE` to `product_id` or `bom_id` on `ecos`.
  - Second defense (belt-and-suspenders): The approval workflow re-verifies `eco.product_id === product.id` and `eco.bom_id === bom.id` after acquiring the ECO lock; if mismatched, it throws a `ConcurrencyError` and rolls back.

---

## 3. Potential Inversion Checklist & Mitigation Summary

| Potential Inversion Point | Potential Risk | Mitigation Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **`idempotency_keys` $\longleftrightarrow$ Business tables** | Locking reservation before business execution | Idempotency lock is acquired first in Phase B; business transaction never acquires an idempotency lock after acquiring engineering locks. | **Safe** |
| **`user_roles` $\longleftrightarrow$ `users`** | Role trigger locking `users` while user activation queries `user_roles` | Role trigger locks `users` BEFORE row mutation; user activation only reads `user_roles` at deferred commit time after locking `users`. | **Safe** |
| **Cross-User Reassignment** | User A $\to$ User B vs User B $\to$ User A | Sorted UUID lock ordering (`MIN(id)` before `MAX(id)`) enforced by application transaction protocol before DML; defensive trigger acts as secondary guard. | **Safe** |
| **`ecos` $\longleftrightarrow$ `boms`** | Reading ECO to find BOM vs locking BOM before ECO | Unlocked discovery read to find IDs, followed by strict hierarchical locking: `Products` $\to$ `BOMs` $\to$ `ECOs`. Revalidation checks after locking. | **Safe** |

---

## 4. Trusted-Writer Boundary & Authorization Protocol

ECOFlow enforces a strict trusted-writer boundary to guarantee that uncoordinated or direct database writes cannot violate the global lock hierarchy or the revision lifecycle:

1. **Service Identity & Execution Boundary**:
   - Only the NestJS backend application (`@ecoflow/api`) running with the database identity `ecoflow_api_user` is authorized to mutate `eco_revisions` status.
   - Client applications (`anon`, `authenticated`) have **zero direct database connectivity**. Client requests are authenticated via JWT, authorized via server-side RBAC/permissions, and executed through application service methods.
2. **Application Transaction Isolation**:
   - Direct manual DML against `eco_revisions` is blocked by design in production environments (table ownership held by `ecoflow_admin`; runtime identity `ecoflow_api_user` operates exclusively through NestJS Prisma repositories).
   - All revision mutation routines (draft editing, submission, reviewer progression, decisioning) are encapsulated in dedicated service transactions that execute the complete top-down lock protocol before performing DML.
3. **Database Trigger Guardrails as Defensive Backstops**:
   - While application services establish the canonical lock order, database triggers (`trg_eco_revisions_enforce_lifecycle`, `trg_eco_changes_enforce_draft_revision`, `trg_ecos_guard_header_revision_consistency`) serve as immutable backstops that abort any out-of-order or invalid status transition even if an uncoordinated write path were attempted.
