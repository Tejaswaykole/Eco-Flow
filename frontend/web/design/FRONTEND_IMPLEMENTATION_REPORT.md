# ECOFlow Web Application Implementation Report

## Executive Summary
This report details the implementation of the ECOFlow Web Application on the `frontend` branch. The frontend is a modern, responsive single-page application built with React 19, Vite, TypeScript, Tailwind CSS, TanStack Query v5, and React Router v7.

The application interfaces directly with the ECOFlow Express API backend running on the dedicated Supabase PostgreSQL project. It implements real-time data fetching, role-based access gating, complex ECO revision workflows, Bill of Materials tree exploration, and administrative signoffs.

---

## Architectural Highlights

### 1. Technology Stack
- **Framework & Build**: React 19, Vite 6, TypeScript 5.8
- **State & Data Fetching**: TanStack React Query v5 with optimistic queries, background cache updates, and strict cache invalidation on mutations.
- **Routing**: React Router v7 with route-level authentication guards and role/permission gating.
- **Styling & Design System**: Tailwind CSS with enterprise color palettes (slate, brand teal), responsive breakpoints, and dedicated PLM badge and status components.
- **Data Visualization**: Recharts for dynamic workflow distribution charts.
- **Testing**: Vitest + React Testing Library + JSDOM.

### 2. Modular Structure (`frontend/web/src`)
- `components/layout`: `AppLayout`, `Sidebar`, `Header`, `ProtectedRoute`.
- `components/ui`: `Button`, `StatusBadge`, `PriorityBadge`, `StatCard`, `PageHeader`, `EmptyState`.
- `context`: `AuthContext` managing JWT in-memory/session storage, user profile state, and granular permission checkers.
- `lib`: `api.ts` (Axios client with refresh token rotation interceptors and anti-loop safeguards), `utils.ts` (currency & date formatters).
- `pages`:
  - `auth`: `Login`, `Register`
  - `dashboard`: `Dashboard` with summary metrics and ECO status distribution
  - `products`: `ProductsList`, `ProductDetail` with version history
  - `boms`: `BOMList`, `BOMDetail` with Decimal accounting and component creation
  - `ecos`: `ECOList`, `ECODetail` with recorded revision changes and approval signoff modals
  - `approvals`: `ApprovalsWorkspace` queue for design authority review
  - `users`: `UserList` with role inspection

---

## Key Invariants & Safety Measures

1. **Anti-Loop Refresh Token Handling**:
   - Axios response interceptor intercepts HTTP 401.
   - Enqueues pending requests while issuing a single refresh request.
   - Automatically signs out and dispatches `ecoflow:auth:session_expired` if the refresh token is revoked or reuse is detected.
2. **Deterministic Status Synchronization**:
   - Status indicators exactly reflect backend PostgreSQL state machine transitions (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED` / `CHANGES_REQUESTED`).
3. **Financial Decimal Representation**:
   - Unit and total component costs use strict formatting without floating-point inaccuracies.
4. **Idempotency Integration**:
   - ECO creation passes client-generated `Idempotency-Key` headers to protect against network duplication.

