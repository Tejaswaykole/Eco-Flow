# ECOFlow — Database Integration Test Report

**Workspace:** `T:\My Projects\ECO-Flow`  
**Test Suite:** `database/tests/integration.test.cjs`  
**Database Engine:** PostgreSQL 15+ (Supabase Dedicated Instance `wzfppspkmvymoakobmsj`)  
**Execution Timestamp:** November 7, 2026  
**Status:** 10 / 10 TESTS PASSED (100% SUCCESS RATE)  

---

## 1. Test Execution Matrix

| # | Test Suite & Scenario | Target Tables / Objects | Trigger / Index Exercised | Result |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **User Activation Primary Role Guard** | `public.users` | `trg_users_validate_activation_deferred` | **PASS** |
| **2** | **Duplicate Primary Role Prevention** | `public.user_roles` | `idx_user_roles_one_primary_per_user` | **PASS** |
| **3** | **Audit Log UPDATE Rejection** | `public.audit_logs` | `trg_audit_logs_immutable` | **PASS** |
| **4** | **Audit Log DELETE Rejection** | `public.audit_logs` | `trg_audit_logs_immutable` | **PASS** |
| **5** | **Audit Log TRUNCATE Rejection** | `public.audit_logs` | `trg_audit_logs_no_truncate` | **PASS** |
| **6** | **DRAFT-Only ECO Changes Guard** | `public.eco_changes` | `trg_eco_changes_enforce_draft` | **PASS** |
| **7** | **Snapshot UPDATE/DELETE Guard** | `public.eco_revision_snapshots` | `trg_eco_revision_snapshots_immutable` | **PASS** |
| **8** | **Idempotency Identity Immutability** | `public.idempotency_keys` | `trg_idempotency_keys_protect_identity` | **PASS** |
| **9** | **Terminal Revision Lifecycle Guard** | `public.eco_revisions` | `trg_eco_revisions_enforce_lifecycle` | **PASS** |
| **10** | **Product & BOM Header Immutability** | `public.ecos` | `trg_ecos_protect_product_bom` | **PASS** |

---

## 2. Execution Evidence Log

```
--- RUNNING LIVE POSTGRESQL INTEGRATION TESTS ---

✓ PASS: Invariant: Reject activating user without a primary role
✓ PASS: Invariant: Reject multiple primary roles for same user
✓ PASS: Audit Immutability: Reject UPDATE on audit_logs
✓ PASS: Audit Immutability: Reject DELETE on audit_logs
✓ PASS: Audit Immutability: Reject TRUNCATE on audit_logs
✓ PASS: ECO Lifecycle: Reject ECO changes when ECO is not in DRAFT
✓ PASS: Snapshot Integrity: Reject UPDATE and DELETE on eco_revision_snapshots
✓ PASS: Idempotency Protection: Reject changing scope, key, or actor_id
✓ PASS: ECO Revision Lifecycle: Reject modifying terminal revision
✓ PASS: ECO Immutability: Reject changing product_id or bom_id on established ECO

========================================
TOTAL INTEGRATION TESTS: 10
PASSED:                 10
FAILED:                 0
========================================
```
