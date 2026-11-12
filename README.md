# ECOFlow — Modern Engineering Change Management & PLM Platform

ECOFlow is an enterprise-grade Product Lifecycle Management (PLM) and Engineering Change Management platform designed for agile hardware, discrete manufacturing, and product engineering teams.

It delivers closed-loop traceability across every phase of the engineering lifecycle:
- **Engineering Change Requests (ECR)**: Rapid defect reporting and improvement suggestions accessible to shop-floor operators and cross-functional staff.
- **Engineering Change Orders (ECO)**: Formal engineering review, multi-level BOM impact analysis, iterative revision authoring, and reviewer sign-offs.
- **Bills of Materials (BOM)**: Single-level and recursive multi-level BOM structures with 18 component types, sub-assembly version pinning, cycle detection, and cost rollup in Indian Rupees (INR, ₹).
- **Version Releases**: Immutable point-in-time product and BOM snapshots preserving historical traceability.
- **Engineering Change Notices (ECN)**: Formal cross-departmental distribution (`ENGINEERING`, `QUALITY`, `PRODUCTION`, `PROCUREMENT`, `INVENTORY`, `MANAGEMENT`), material disposition directives (`SCRAP`, `REWORK`, `USE_AS_IS`), and sign-off tracking.
- **Operations & Business Modules**: Suppliers, Purchase Orders with 3-way line item receipt, multi-warehouse Inventory Management, Work Orders with BOM component reservations, and Quality Assurance with Non-Conformance Reports (NCR) and CAPA workflows.
- **Enterprise Governance**: Unified Approvals Inbox, Real-Time Analytics Dashboard, Financial & Operational Reports with RFC-4180 CSV Export, System Audit Log Timeline, and User Administration Workspace.

---

## 1. Technology Stack

- **Monorepo Architecture:** Turborepo + pnpm workspaces
- **Backend API:** Node.js 20+, Express, TypeScript, Prisma ORM, PostgreSQL 18
- **Frontend Application:** React 18, TypeScript, Vite, Tailwind CSS, TanStack React Query, Lucide Icons (route-level code splitting)
- **Domain & Shared Validation:** `@ecoflow/domain-types` (tsup), `@ecoflow/validations` (Zod)
- **Database Engine:** PostgreSQL 15+ (tested on PostgreSQL 18.6) with `pg_advisory_xact_lock` concurrency controls, foreign-key cascade protections, row-level security, and immutable audit triggers
- **Currency & Precision:** Indian Rupee (INR, `₹`) with Decimal.js precision 28
- **Authentication & Security:** Argon2id password hashing, rotating JWT refresh tokens with theft detection, sliding-window IP rate limiting, database-backed session revocation, and fine-grained Role-Based Access Control (RBAC)

---

## 2. Monorepo Structure

```
ECO-Flow/
├── backend/                  # Express REST API, Prisma integration, business modules
│   ├── src/
│   │   ├── config/           # Database, environment, security configuration
│   │   ├── middleware/       # Auth (JWT/Argon2id), RBAC, Rate Limiting, Error Handling
│   │   ├── modules/          # auth, admin, approvals, audit, boms, dashboard,
│   │   │                     # ecn, eco, ecr, inventory, manufacturing, notifications,
│   │   │                     # products, purchasing, quality, reports, suppliers, users
│   │   └── services/         # SecurityService, AuditService, IdempotencyService
│   └── tests/                # Automated backend test suites
├── database/                 # Prisma schema, SQL migrations, seed scripts
│   ├── prisma/
│   │   └── schema.prisma     # Authoritative Prisma schema definition
│   └── sql/                  # Numbered SQL migrations (001–013) and rollbacks
├── frontend/
│   └── web/                  # Vite + React single-page application
│       ├── src/
│       │   ├── pages/        # Dashboard, Products, BOMs, ECOs, ECRs, ECNs, Suppliers,
│       │   │                 # Purchasing, Inventory, Manufacturing, Quality,
│       │   │                 # Approvals, Notifications, Reports, Admin, Users
│       │   ├── components/   # Layout, Sidebar, Header, UI Primitives, Badges, Modals
│       │   └── services/     # Typed API clients and React Query hooks
│       └── dist/             # Production distribution bundle (code-split)
├── packages/
│   ├── domain-types/         # Shared TypeScript interfaces, types, and enums
│   └── validations/          # Shared Zod validation schemas and transformers
└── docs/                     # Deployment runbooks, architecture, backup/restore, API docs
```

---

## 3. Environment Setup & Configuration

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **pnpm**: v9.0.0 or higher (`corepack enable && corepack prepare pnpm@latest --activate`)
- **PostgreSQL**: PostgreSQL 15+ (tested on PostgreSQL 18.6)

### Environment Files
Configure your `.env` with appropriate values:
```env
# Database connection pooler (for runtime queries)
DATABASE_URL="postgresql://ecoflow_admin:your_secure_password@127.0.0.1:5432/ecoflow_prod?sslmode=prefer"

# Direct database connection (for DDL schema migrations)
DIRECT_URL="postgresql://ecoflow_admin:your_secure_password@127.0.0.1:5432/ecoflow_prod"

# Application Server
PORT=4000
NODE_ENV=production
CORS_ORIGIN=https://ecoflow.yourcompany.internal

# JWT Secrets (Minimum 32 random characters - strictly enforced in production)
JWT_ACCESS_SECRET="a98f1c42e5d6b7c8a1e2f3d4c5b6a789e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5"
JWT_REFRESH_SECRET="f1e2d3c4b5a69788796a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
```

---

## 4. Installation & Production Build Commands

```bash
# 1. Install all monorepo dependencies
pnpm install

# 2. Build shared packages (domain-types and validations)
pnpm --filter @ecoflow/domain-types run build
pnpm --filter @ecoflow/validations run build

# 3. Generate Prisma client
pnpm --filter @ecoflow/database run generate

# 4. Build backend and frontend for production
pnpm --filter @ecoflow/backend run build
pnpm --filter @ecoflow/web run build
```

---

## 5. Verification & Testing

ECOFlow maintains 100% test pass rates across all verification suites:
- **Batch 1 (Milestones 06, 07, 08):** 30/30 tests passed (Backend remediation, frontend integration, business modules).
- **Batch 2 (Milestones 09, 10):** 33/33 tests passed (Workflows, approvals, timeline, dashboards, reports, admin).
- **Batch 3 (Milestone 11):** 33/33 tests passed (Security, rate limiting, RBAC boundaries, advisory locks, invariants, financial precision, teardown safety).

```bash
# Run production verification
node "scratch/run_batch3_verification.cjs"
```

---

## 6. Database Migrations (001–013)

All migrations are fully forward-compatible and include corresponding rollback scripts:
- `001_core_schema.sql`: Core PLM schema (`users`, `products`, `boms`, `ecos`, `version_releases`).
- `002_primary_role_invariants.sql`: Primary role invariants and user state transitions.
- `003_eco_revision_protection.sql`: ECO revision protection triggers and active revision integrity.
- `004_snapshot_integrity.sql`: Immutable point-in-time product/BOM snapshot triggers.
- `005_approval_and_version_integrity.sql`: Approvals immutability (`trg_approvals_immutable`) and release protection.
- `006_idempotency_lease_constraints.sql`: Concurrency lease locks on critical operations.
- `007_audit_immutability_and_roles.sql`: Immutable append-only audit trail and truncate rejection triggers.
- `008_system_initialization_seed.sql`: System roles (`ADMINISTRATOR`, `LEAD_ENGINEER`, `APPROVER`, `OPERATOR`) and permissions.
- `009_multi_level_bom_support.sql`: Multi-level BOM hierarchy, version pinning, and recursion cycle guard (`trg_bom_components_cycle_guard`).
- `010_engineering_change_request.sql`: ECR tables, defect/improvement categorization, and lead engineer reviews.
- `011_engineering_change_notice.sql`: ECN tables, multi-department distribution, and material disposition directives.
- `012_expand_bom_component_type.sql`: Reconciliation of PostgreSQL `BOMComponentType` enum to 18 domain types.
- `013_business_modules.sql`: Suppliers, Inventory Warehouses, Purchase Orders, Work Orders, and Quality Inspections.

---

## 7. Role-Based Access Control (RBAC) Reference

| Role | Description | Access Boundaries |
|---|---|---|
| `ADMINISTRATOR` | Full system governance | User administration, role assignment, system health telemetry, reports export, emergency overrides. |
| `LEAD_ENGINEER` | Engineering authoring & management | ECR review, ECO authoring & revision, BOM editing, ECN generation, engineering reports, audit timeline. |
| `APPROVER` | Change order & purchasing sign-off | ECO approval/rejection, PO approval, unified approvals inbox, quality reviews. |
| `OPERATOR` | Shop-floor execution | ECR submission, work order progress logging, inventory stock viewing. Blocked from admin, reports, and direct BOM edits. |

---

## 8. Documentation Index

- [Architecture & Concurrency Guide](docs/ARCHITECTURE.md)
- [Production Deployment Runbook](docs/DEPLOYMENT.md)
- [Backup, Restore & Disaster Recovery Guide](docs/BACKUP_RESTORE.md)
- [REST API Reference](docs/API_REFERENCE.md)

---

## 9. License

Proprietary and confidential. Internal engineering PLM platform.

