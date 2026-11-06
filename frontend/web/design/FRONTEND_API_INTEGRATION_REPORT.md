# ECOFlow Frontend API Integration Report

## Centralized Client Configuration
- **Base URL**: Configured via `VITE_API_BASE_URL` (defaulting to `/api/v1` via Vite proxy).
- **Credentials**: `withCredentials: true` with Bearer JWT injection in `Authorization` header.
- **Service Layer**: [src/services/index.ts](file:///t:/My%20Projects/ECO-Flow/frontend/web/src/services/index.ts)

---

## Integration Endpoints Mapped

### 1. Authentication
- `POST /api/v1/auth/login` — Sign in with credentials, store access and refresh tokens.
- `POST /api/v1/auth/register` — Create user account with default OPERATOR role.
- `GET /api/v1/auth/me` — Verify session and load roles & permissions.
- `POST /api/v1/auth/refresh` — Rotate single-use refresh token with concurrency queue.
- `POST /api/v1/auth/logout` — Terminate active session and clear storage.

### 2. Products & Categories
- `GET /api/v1/products` — Paginated catalog listing with search query support.
- `GET /api/v1/products/:id` — Product specification and version release history.
- `POST /api/v1/products` — Create new manufactured part.
- `GET /api/v1/products/categories` — Category list for categorization dropdowns.
- `POST /api/v1/products/categories` — Register new part classification category.

### 3. Bills of Materials (BOM)
- `GET /api/v1/boms/:id` — BOM header, component items, and cost aggregation.
- `POST /api/v1/boms` — Initialize BOM for product.
- `POST /api/v1/boms/:id/components` — Add line item component with Decimal precision calculation.

### 4. Engineering Change Orders (ECO)
- `GET /api/v1/ecos` — Paginated change orders filtered by status.
- `GET /api/v1/ecos/:id` — Detail view with active revisions, change diffs, and signoffs.
- `POST /api/v1/ecos` — Create draft change order with `Idempotency-Key` header.
- `POST /api/v1/ecos/:id/changes` — Record change modifications during draft status.
- `POST /api/v1/ecos/:id/submit` — Submit revision and lock snapshot.
- `POST /api/v1/ecos/:id/review` — Review decision (`APPROVED`, `REJECTED`, `CHANGES_REQUESTED`) with mandatory justification for admin overrides.

### 5. Users & Administration
- `GET /api/v1/users` — User accounts, primary roles, and active statuses (restricted to `ADMINISTRATOR`).
