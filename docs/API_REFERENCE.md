# ECOFlow — REST API Reference Guide

All API endpoints are served under `/api/v1` and return JSON formatted responses unless streaming CSV export.

---

## 1. Authentication (`/api/v1/auth`)

| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Rate Limited (30/15m) | Register a new user account. |
| `POST` | `/auth/login` | Rate Limited (30/15m) | Authenticate with email and Argon2id password; issues access + refresh JWTs. |
| `POST` | `/auth/refresh` | Public | Rotate refresh token; revokes family if token reuse is detected. |
| `POST` | `/auth/logout` | Authenticated | Revoke the active session. |
| `POST` | `/auth/logout-all` | Authenticated | Revoke all active sessions for the user. |
| `GET` | `/auth/me` | Authenticated | Get current authenticated user profile and roles. |

---

## 2. Products & Categories (`/api/v1/products`)

| Method | Endpoint | Required Permission | Description |
|---|---|---|---|
| `GET` | `/products/categories` | `product:read` | List all product categories. |
| `POST` | `/products/categories` | `product:write` | Create a new product category. |
| `GET` | `/products` | `product:read` | List products with pagination and category filter. |
| `POST` | `/products` | `product:write` | Create a new product. |
| `GET` | `/products/:id` | `product:read` | Get product details, active revision, and released versions. |

---

## 3. Bills of Materials (`/api/v1/boms`)

| Method | Endpoint | Required Permission | Description |
|---|---|---|---|
| `GET` | `/boms` | `bom:read` | List bills of materials. |
| `POST` | `/boms` | `bom:write` | Create a new BOM for a product. |
| `GET` | `/boms/:id` | `bom:read` | Get BOM details and top-level components. |
| `GET` | `/boms/:id/tree` | `bom:read` | Get recursive multi-level BOM hierarchy. |
| `GET` | `/boms/:id/exploded` | `bom:read` | Get flattened exploded BOM with total quantities. |
| `POST` | `/boms/:id/components` | `bom:write` | Add component or sub-assembly to BOM (cycle checked). |
| `PATCH` | `/boms/:id/components/:componentId`| `bom:write` | Update component quantity, cost, or attributes. |
| `DELETE` | `/boms/:id/components/:componentId`| `bom:write` | Remove component from draft BOM. |

---

## 4. Engineering Change Orders (`/api/v1/ecos`)

| Method | Endpoint | Required Permission | Description |
|---|---|---|---|
| `GET` | `/ecos` | Authenticated | List change orders with status filter. |
| `POST` | `/ecos` | `eco:create` | Create a new ECO linked to product and BOM. |
| `GET` | `/ecos/:id` | Authenticated | Get ECO details, active revision, and change lines. |
| `POST` | `/ecos/:id/submit` | `eco:submit` | Submit draft revision for formal review. |
| `POST` | `/ecos/:id/review` | `eco:approve` | Record approval or rejection with comments. |

---

## 5. Operations & Business Modules

### Purchasing (`/api/v1/purchasing`)
- `GET /purchasing/orders`: List purchase orders.
- `POST /purchasing/orders`: Create draft purchase order.
- `POST /purchasing/orders/:id/submit`: Submit PO for manager approval.
- `POST /purchasing/orders/:id/approve`: Approve PO (moves to `ORDERED`).
- `POST /purchasing/orders/:id/receive`: Receive goods by line item into designated warehouse.

### Inventory (`/api/v1/inventory`)
- `GET /inventory/warehouses`: List all inventory warehouses.
- `POST /inventory/warehouses`: Create a new warehouse.
- `GET /inventory/items`: List inventory items with stock levels.
- `POST /inventory/transact`: Execute stock movement (`RECEIPT`, `ISSUE`, `ADJUSTMENT`, `SCRAP`, `TRANSFER`).

### Manufacturing (`/api/v1/manufacturing`)
- `GET /manufacturing/orders`: List work orders.
- `POST /manufacturing/orders`: Create work order with automatic BOM component reservations.
- `POST /manufacturing/orders/:id/start`: Start work order (`IN_PROGRESS`).
- `POST /manufacturing/orders/:id/complete`: Complete work order and transfer finished goods into inventory.

### Quality Assurance (`/api/v1/quality`)
- `GET /quality/inspections`: List quality inspections.
- `POST /quality/inspections`: Create quality inspection.
- `POST /quality/inspections/:id/results`: Record inspection pass/fail verdict.
- `GET /quality/ncrs`: List Non-Conformance Reports.
- `POST /quality/ncrs`: Create Non-Conformance Report.
- `PATCH /quality/ncrs/:id`: Update NCR with root cause analysis and CAPA plan.

---

## 6. Reports & Governance

### Reports Hub (`/api/v1/reports`)
- `GET /reports/engineering`: Rolled-up BOM costs and ECR turnaround metrics.
- `GET /reports/inventory`: Valuation per warehouse in INR and low-stock alerts.
- `GET /reports/purchasing`: Spend per supplier in INR and lead-time analysis.
- `GET /reports/manufacturing`: Work order yield rates and scrap percentages.
- `GET /reports/quality`: First-pass yield, defect Pareto analysis, and CAPA tracking.
- `GET /reports/export?type=:type`: Stream RFC-4180 CSV export for any domain.

### Admin Workspace (`/api/v1/admin`)
- `GET /admin/users`: List users with status and assigned roles.
- `POST /admin/users`: Provision a new user with initial role assignment.
- `PUT /admin/users/:id/roles`: Update user roles.
- `PATCH /admin/users/:id/status`: Update user status (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
- `GET /admin/system-health`: Real-time system health and database telemetry.

