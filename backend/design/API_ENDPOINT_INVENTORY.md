# ECOFlow API Endpoint Inventory

All endpoints are versioned under `/api/v1` except root system health probes.

## System Endpoints
| Method | Path | Auth / Role | Description |
|---|---|---|---|
| GET | `/health` | Public | Service uptime, timestamp, environment |
| GET | `/ready` | Public | Live database connectivity verification |

---

## Authentication (`/api/v1/auth`)
| Method | Path | Auth / Permission | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Register new user account with default OPERATOR role |
| POST | `/api/v1/auth/login` | Public | Authenticate user credentials, emit JWT and refresh token |
| POST | `/api/v1/auth/refresh` | Public | Single-use refresh token rotation with reuse detection |
| POST | `/api/v1/auth/logout` | Authenticated | Revoke active refresh token / session |
| POST | `/api/v1/auth/logout-all`| Authenticated | Revoke all active refresh sessions for user |
| GET | `/api/v1/auth/me` | Authenticated | Retrieve authenticated user identity, roles, permissions |

---

## Users (`/api/v1/users`)
| Method | Path | Auth / Permission | Description |
|---|---|---|---|
| GET | `/api/v1/users/me` | Authenticated | View current profile and primary role |
| GET | `/api/v1/users` | Authenticated (`admin:all`) | List paginated user accounts |

---

## Products & Categories (`/api/v1/products`)
| Method | Path | Auth / Permission | Description |
|---|---|---|---|
| POST | `/api/v1/products/categories` | `product:write` | Create product category |
| GET | `/api/v1/products/categories` | `product:read` | List product categories |
| POST | `/api/v1/products` | `product:write` | Create product specification |
| GET | `/api/v1/products` | `product:read` | List paginated products |
| GET | `/api/v1/products/:id` | `product:read` | Retrieve product details with version history |

---

## Bills of Materials (`/api/v1/boms`)
| Method | Path | Auth / Permission | Description |
|---|---|---|---|
| POST | `/api/v1/boms` | `bom:write` | Create initial BOM for product |
| GET | `/api/v1/boms/:id` | `bom:read` | Retrieve BOM header and component items |
| POST | `/api/v1/boms/:id/components` | `bom:write` | Add line item component to BOM draft |

---

## Engineering Change Orders (`/api/v1/ecos`)
| Method | Path | Auth / Permission | Description |
|---|---|---|---|
| POST | `/api/v1/ecos` | `eco:create` | Create draft ECO with active revision 1 |
| GET | `/api/v1/ecos` | Authenticated | List paginated ECO change orders |
| GET | `/api/v1/ecos/:id` | Authenticated | Retrieve ECO, revisions, changes, and approvals |
| POST | `/api/v1/ecos/:id/changes` | `eco:edit` | Record change item on draft revision |
| POST | `/api/v1/ecos/:id/submit` | `eco:submit` | Submit draft revision and capture frozen snapshot |
| POST | `/api/v1/ecos/:id/review` | `eco:approve` | Approve/reject revision, triggering release versions |
