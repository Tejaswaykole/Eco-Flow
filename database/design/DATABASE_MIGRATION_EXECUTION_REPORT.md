# ECOFlow — Database Migration Execution Report

**Workspace:** `T:\My Projects\ECO-Flow`  
**Target Environment:** Isolated Supabase PostgreSQL (`aws-0-ap-south-1.pooler.supabase.com`)  
**Execution Timestamp:** November 7, 2026  
**Status:** MIGRATIONS 001 THROUGH 008 EXECUTED AND VERIFIED  

---

## 1. Migration Execution Summary

All eight migration stages were compiled and executed against the live PostgreSQL database.

| Stage | Script File | Target Artifacts | Direct Execution Output |
| :---: | :--- | :--- | :--- |
| **001** | `database/sql/001_core_schema.sql` | 15 Enums, 26 Relational Tables, Composite Keys | `Created tables count: 26. All tables, composite PKs, FKs, and enums instantiated.` |
| **002** | `database/sql/002_primary_role_invariants.sql` | Partial Unique Index, Deterministic UUID Lock Trigger, Deferred Activation Triggers | `✓ 002_primary_role_invariants.sql applied successfully.` |
| **003** | `database/sql/003_eco_revision_protection.sql` | `fk_ecos_active_revision`, Revision Lifecycle & Header Status Triggers, DRAFT Guard | `✓ 003_eco_revision_protection.sql applied successfully.` |
| **004** | `database/sql/004_snapshot_integrity.sql` | Snapshot Immutability Trigger, Deferred Snapshot Validation Trigger | `✓ 004_snapshot_integrity.sql applied successfully.` |
| **005** | `database/sql/005_approval_and_version_integrity.sql` | Immutability on Approvals, Product/BOM Versions; Release State Machine Trigger | `✓ 005_approval_and_version_integrity.sql applied successfully.` |
| **006** | `database/sql/006_idempotency_lease_constraints.sql` | Active Lease Partial Index, Idempotency Identity Protection Trigger | `✓ 006_idempotency_lease_constraints.sql applied successfully.` |
| **007** | `database/sql/007_audit_immutability_and_roles.sql` | Audit UPDATE/DELETE/TRUNCATE Rejection Triggers, RLS Enabled on All Tables | `✓ 007_audit_immutability_and_roles.sql applied successfully.` |
| **008** | `database/sql/008_system_initialization_seed.sql` | System Roles, Core Permissions, Role-Permission Mappings, Initial Admin User | `✓ 008_system_initialization_seed.sql applied successfully.` |

---

## 2. Table & Model Inventory (Verified)

1. `users` (User accounts, authentication status)
2. `roles` (System & custom authorization roles)
3. `permissions` (Granular permission codes)
4. `user_roles` (Join table with partial unique index for primary role)
5. `role_permissions` (Join table mapping permissions to roles)
6. `sessions` (JWT session management)
7. `refresh_tokens` (Refresh token rotation with family tracking)
8. `product_categories` (Hierarchical product categorizations)
9. `products` (Product headers and version counters)
10. `product_attachments` (File attachments linked to products)
11. `boms` (Bill of Materials headers with composite product association)
12. `bom_components` (Line items with exact decimal quantities and costs)
13. `ecos` (Engineering Change Orders with active revision pointer)
14. `eco_revisions` (Composite PK `(eco_id, revision_number)`)
15. `eco_changes` (Granular field changes on products/BOMs/components)
16. `eco_revision_snapshots` (Frozen JSON snapshots of submitted revisions)
17. `eco_comments` (Discussion thread on change orders)
18. `eco_attachments` (Documentation and specification uploads)
19. `approvals` (Immutable sign-off decisions with justifications)
20. `product_versions` (Immutable released product historical baselines)
21. `bom_versions` (Immutable released BOM historical baselines)
22. `version_releases` (State-controlled release schedule)
23. `idempotency_keys` (Atomic mutation locks and lease expiration)
24. `audit_logs` (Append-only security and operational audit trail)
25. `login_audits` (Append-only authentication and session attempt log)
26. `notifications` (User notification inbox)
