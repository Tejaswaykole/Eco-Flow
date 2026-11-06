# ECOFlow Backend Security Verification

## Security Architecture & Controls

### 1. Password Hashing & Key Derivation
- Passwords are encrypted using **Argon2id** (`argon2.hash(password, { type: argon2.argon2id })`), resisting side-channel GPU attacks.
- Plaintext passwords are never logged, returned in API bodies, or saved to the database.

### 2. Session Management & Token Rotation
- Access tokens are HMAC SHA-256 JWTs signed with a high-entropy secret.
- Expiration is capped at 15 minutes to minimize the replay window.
- Refresh tokens are generated using cryptographically secure random bytes (`crypto.randomBytes(32).toString('hex')`).
- Tokens in the database are stored as **SHA-256 digests**. Even if the `refresh_tokens` table is leaked, tokens cannot be forged or replayed.
- Single-use token rotation:
  - Each refresh invocation marks the presented token as replaced by the newly issued token ID.
  - If a token is presented that was already marked replaced, **Token Family Compromise Detection** immediately revokes all descendant tokens in that family.

### 3. Role-Based Access Control (RBAC)
- Multi-tier role permissions:
  - `ADMINISTRATOR`: Superuser capability (`admin:all`, overrides).
  - `LEAD_ENGINEER`: ECO creation, draft editing, submission, and BOM updates.
  - `APPROVER`: Formal review decisions (`APPROVED`, `REJECTED`, `CHANGES_REQUESTED`).
  - `OPERATOR`: Read-only access to released entities.
- Permissions are verified per route via `requirePermission(code)` and `requireRole(name)`.

### 4. Injection & Parameter Pollution Defenses
- All requests pass through strict Zod schemas with type-coercion, length limits, and enum validation.
- Prisma ORM constructs parameterized SQL queries, eliminating SQL injection.
- Security headers are applied globally via `helmet`.
- Unique request tracing via `X-Request-Id` headers.
- Input validation failures return `422 Unprocessable Entity` with granular parameter error paths.

### 5. Append-Only Audit Logging
- Security events (failed logins, credential logins, token family revocations) and operational events (ECO submissions, reviews, releases) trigger append-only database inserts into `audit_logs`.
- PostgreSQL triggers prevent `UPDATE`, `DELETE`, and `TRUNCATE` operations on `audit_logs`.
