# ECOFlow Monorepo Architecture

**Workspace Root:** `T:\My Projects\ECO-Flow`
**Package Manager:** `pnpm@12.18.0`
**Build System:** `Turborepo`

---

## 1. Directory Structure

```text
ECO-Flow/
│
├── frontend/
│   ├── web/                     # React + Vite web application
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json         # @ecoflow/web
│   │
│   └── mobile/                  # React Native + Expo application (planned)
│       ├── src/
│       └── package.json         # @ecoflow/mobile
│
├── backend/                     # Express + TypeScript API server
│   ├── src/
│   │   ├── modules/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── routes/
│   │   └── utils/
│   ├── tests/
│   └── package.json             # @ecoflow/backend
│
├── database/                    # Centralized database workspace
│   ├── prisma/
│   │   ├── schema.prisma        # Canonical Prisma Schema
│   │   ├── migrations/          # Planned migration history
│   │   └── seed.ts              # System initialization seeds
│   │
│   ├── sql/
│   │   ├── functions/           # Raw PL/pgSQL functions
│   │   ├── triggers/            # Trigger declarations
│   │   ├── policies/            # Row-Level Security policies
│   │   └── indexes/             # Custom partial & composite indexes
│   │
│   ├── design/                  # Consolidated architectural specifications
│   │   ├── DATABASE_INVARIANT_MATRIX.md
│   │   ├── TRIGGER_AND_FUNCTION_DESIGN.md
│   │   ├── GLOBAL_LOCK_ORDER_AUDIT.md
│   │   ├── MIGRATION_SEQUENCE.md
│   │   ├── DATABASE_INTEGRATION_TEST_PLAN.md
│   │   ├── POSTGRESQL_SQL_COMPATIBILITY_AUDIT.md
│   │   ├── POSTGRESQL_SECURITY_PRIVILEGE_AUDIT.md
│   │   ├── POSTGRESQL_SECURITY_TEST_PLAN.md
│   │   └── FINAL_DATABASE_ARCHITECTURE_READINESS_REPORT.md
│   │
│   └── package.json             # @ecoflow/database
│
├── packages/                    # Shared core monorepo packages
│   ├── domain-types/            # Canonical domain models & enums
│   ├── validations/             # Zod schemas & deterministic transformers
│   ├── eslint-config/           # Monorepo ESLint configurations
│   └── tsconfig/                # Base TypeScript configurations
│
├── docs/                        # Architectural documentation
├── scripts/                     # Automation & CI/CD scripts
│
├── package.json                 # Monorepo root scripts
├── pnpm-workspace.yaml          # Workspace definitions
├── pnpm-lock.yaml               # Pnpm dependency lockfile
├── turbo.json                   # Turborepo task pipeline
├── tsconfig.base.json           # Monorepo TypeScript base options
├── .gitignore                   # Monorepo secret & build ignores
├── .env.example                 # Sanitized environment template
└── README.md                    # Project documentation
```

---

## 2. Workspace Responsibilities

1. **`frontend/web` (`@ecoflow/web`)**:
   - Single-Page Web application built with React and Vite.
   - Responsible for UI rendering, engineering workflows, approval portals, and browser routing.
   - Consumes `@ecoflow/domain-types` and `@ecoflow/validations`.
2. **`frontend/mobile` (`@ecoflow/mobile`)**:
   - Mobile application intended for iOS/Android (field operators and reviewers).
   - Planned architecture; workspace scaffolded to maintain consistent monorepo package discovery.
3. **`backend` (`@ecoflow/backend`)**:
   - Node.js API built with Express / NestJS and TypeScript.
   - Implements authentication, authorization, idempotency filters, and business transaction workflows.
   - Connects to PostgreSQL using `@prisma/client`.
4. **`database` (`@ecoflow/database`)**:
   - Owns the canonical `schema.prisma` file, migration sequences, raw SQL DDL, and database design documents.
   - Provides commands: `pnpm run prisma:validate`, `pnpm run prisma:format`, and `pnpm run prisma:generate`.
5. **Shared Packages (`packages/*`)**:
   - **`@ecoflow/domain-types`**: Pure TypeScript enums and data interfaces with zero runtime dependencies.
   - **`@ecoflow/validations`**: Zod validation schemas, Decimal.js financial calculations, and deterministic RFC 4122 UUID v5 snapshot transformation utilities.
