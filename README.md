# ECOFlow — Modern Engineering Change Management & PLM Platform

ECOFlow is an enterprise-grade Product Lifecycle Management (PLM) and Engineering Change Management platform designed for agile hardware, discrete manufacturing, and product engineering teams.

It delivers closed-loop traceability across every phase of the engineering lifecycle:
- **Engineering Change Requests (ECR)**: Rapid defect reporting and improvement suggestions accessible to shop-floor operators and cross-functional staff.
- **Engineering Change Orders (ECO)**: Formal engineering review, multi-level BOM impact analysis, iterative revision authoring, and reviewer sign-offs.
- **Bills of Materials (BOM)**: Single-level and recursive multi-level BOM structures with sub-assembly version pinning, cycle detection, and cost rollup.
- **Version Releases**: Immutable point-in-time product and BOM snapshots preserving historical traceability.
- **Engineering Change Notices (ECN)**: Formal cross-departmental distribution (`ENGINEERING`, `QUALITY`, `PRODUCTION`, `PROCUREMENT`, `INVENTORY`, `MANAGEMENT`), material disposition directives (`SCRAP`, `REWORK`, `USE_AS_IS`), and sign-off tracking.

---

## 1. Technology Stack

- **Monorepo Architecture:** Turborepo + pnpm workspaces
- **Backend API:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL
- **Frontend Application:** React 18, TypeScript, Vite, Tailwind CSS, TanStack React Query, Lucide Icons
- **Domain & Shared Validation:** `@ecoflow/domain-types` (tsup), `@ecoflow/validations` (Zod)
- **Database Engine:** PostgreSQL 15+ with pg_advisory_xact_lock concurrency controls, foreign-key cascade protections, and row-level security
- **Authentication & Security:** Argon2id password hashing, rotating JWT refresh tokens, database-backed session revocation, and fine-grained Role-Based Access Control (RBAC)

---

## 2. Monorepo Structure

```
ECO-Flow/
├── backend/                  # Express REST API, Prisma integration, business modules
│   ├── src/
│   │   ├── modules/          # auth, users, products, categories, boms, eco, ecr, ecn
│   │   ├── middleware/       # JWT auth, RBAC authorization, error handling
│   │   └── services/         # AuditService, IdempotencyService, SecurityService
│   └── tests/                # Automated backend unit & integration tests
├── database/                 # Prisma schema, SQL migrations, seed scripts
│   ├── prisma/
│   │   └── schema.prisma     # Authoritative Prisma schema definition
│   └── sql/                  # Numbered SQL migrations (001–011) and rollbacks
├── frontend/
│   └── web/                  # Vite + React single-page application
│       ├── src/
│       │   ├── pages/        # Dashboard, Products, Categories, BOMs, ECOs, ECRs, ECNs
│       │   ├── components/   # UI primitives, Layout, Navigation, Badges, Modals
│       │   └── services/     # Axios API client integrations
│       └── tests/            # Automated frontend UI and workflow unit tests
├── packages/
│   ├── domain-types/         # Shared TypeScript interfaces, types, and enums
│   └── validations/          # Shared Zod validation schemas and snapshot transformers
└── docs/                     # Authoritative architecture, SME audits, and milestone reports
```

---

## 3. Environment Setup & Configuration

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **pnpm**: v9.0.0 or higher (`corepack enable && corepack prepare pnpm@latest --activate`)
- **PostgreSQL**: PostgreSQL 15+ (local instance or cloud database such as Supabase)

### Environment Files
Copy the provided environment templates:
```bash
# Root template (used for database connections and backend defaults)
cp .env.example .env

# Frontend web template
cp frontend/web/.env.example frontend/web/.env
```

Configure your `.env` with appropriate values:
```env
# Database connection pooler (for runtime queries)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct database connection (for DDL schema migrations)
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[HOST]:5432/postgres"

# Application Server
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# JWT Secrets (replace with secure random 32+ character strings)
JWT_ACCESS_SECRET="your_secure_random_jwt_access_secret_key_here_32_chars"
JWT_REFRESH_SECRET="your_secure_random_jwt_refresh_secret_key_here_32_chars"
```

---

## 4. Installation & Development Commands

```bash
# 1. Install all monorepo dependencies
pnpm install

# 2. Build shared packages (domain-types and validations)
pnpm --filter @ecoflow/domain-types run build
pnpm --filter @ecoflow/validations run build

# 3. Generate Prisma client
pnpm --filter @ecoflow/database run generate

# 4. Start backend and frontend development servers concurrently
pnpm run dev
```

The services will be available at:
- **Frontend Web UI:** `http://localhost:5173`
- **Backend API:** `http://localhost:4000/api/v1`

---

## 5. Testing & Verification Commands

```bash
# Run validations test suite (45 tests)
pnpm --filter @ecoflow/validations test

# Run backend test suite (43 tests)
pnpm --filter @ecoflow/backend exec vitest run

# Run frontend test suite (29 tests)
pnpm --filter @ecoflow/web run test

# Run production builds
pnpm --filter @ecoflow/backend run build
pnpm --filter @ecoflow/web run build
```

---

## 6. Database Migration Architecture & Current Execution Status

All database changes are authored as idempotent SQL scripts in `database/sql/` paired with comprehensive rollback scripts.

### Baseline Schema Migrations (Executed)
The following migrations establish the baseline PLM schema and have been applied to the development database:
- `001_core_schema.sql`: Core tables (`users`, `products`, `boms`, `bom_components`, `ecos`, `version_releases`).
- `002_primary_role_invariants.sql`: Role-based access control invariants.
- `003_eco_revision_protection.sql`: ECO revision protection triggers.
- `004_snapshot_integrity.sql`: Snapshot integrity constraints.
- `005_approval_and_version_integrity.sql`: Version release and approval integrity rules.
- `006_idempotency_lease_constraints.sql`: Concurrency lease locks on mutations.
- `007_audit_immutability_and_roles.sql`: Immutable append-only audit trail.
- `008_system_initialization_seed.sql`: Default permissions, roles, and demo accounts.

### Pending Feature Migrations (Unapplied Source Artifacts)
> [!IMPORTANT]
> The following migrations are included as **source artifacts only**. They have **NOT** yet been executed against the remote or live database:
> - **`009_multi_level_bom_support.sql`** (Rollback: `009_rollback_multi_level_bom.sql`): Multi-Level BOM schema, sub-assembly version pinning, and cycle-detection triggers.
> - **`010_engineering_change_request.sql`** (Rollback: `010_rollback_engineering_change_request.sql`): Engineering Change Request (ECR) tables, relations, and permissions.
> - **`011_engineering_change_notice.sql`** (Rollback: `011_rollback_engineering_change_notice.sql`): Engineering Change Notice (ECN) tables, distributions, material dispositions, and permissions.

To execute pending migrations against a new or target PostgreSQL instance:
```bash
# Apply migrations sequentially using psql or your migration runner:
psql "$DIRECT_URL" -f database/sql/009_multi_level_bom_support.sql
psql "$DIRECT_URL" -f database/sql/010_engineering_change_request.sql
psql "$DIRECT_URL" -f database/sql/011_engineering_change_notice.sql
```

---

## 7. Role-Based Access Control (RBAC) & Demo Accounts

ECOFlow comes seeded with standard PLM personas for evaluation:

| Email | Default Role | Primary Capabilities |
|---|---|---|
| `admin@ecoflow.io` | `ADMINISTRATOR` | Full system control, user management, override approvals |
| `lead.engineer@ecoflow.io` | `LEAD_ENGINEER` | Product/BOM authoring, ECO revisions, ECR promotion, ECN issuance |
| `approver@ecoflow.io` | `APPROVER` | ECO review signoffs, approval/rejection decisions |
| `operator@ecoflow.io` | `OPERATOR` | Defect/improvement ECR submission, distribution acknowledgement |

---

## 8. License

Proprietary and confidential. Internal engineering PLM platform.

