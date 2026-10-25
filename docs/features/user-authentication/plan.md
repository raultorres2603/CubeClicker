---
feature: user-authentication
revision: 3
---
# Plan — User Authentication (Login, Registration & Guest Play)

## Architecture

Two workspaces, one authority. The backend gains an auth layer (config, DB access, repositories, services, HTTP routes) alongside the existing game hub; the frontend gains an auth client/store and an intro-menu overlay. The database is the only new runtime service. Game state remains in-memory (multiplayer non-goal retained); only identity/credential data persists.

Auth configuration is kept separate from game configuration: `GameConfig` (capacity, grace, heartbeat, etc.) is consumed by the hub and is unchanged in shape; a new `AuthConfig` owns DB/email/session/env parsing so the hub never sees DB or SMTP settings (F9).

### Backend (`src/backend/src`)

```
game/config.ts (unchanged shape) — game env parsing + validation
auth/config.ts                 — AuthConfig: DB/email/session/argon/cookie env parsing + validation
db/pool.ts                     — pg Pool factory (env-driven, testable)
db/migrate.ts                  — numbered .sql runner tracked in schema_migrations
db/schema.sql                  — users, sessions, verification_tokens, schema_migrations
db/migrations/001_init.sql     — initial migration
auth/password.ts               — Argon2id hash/verify (injectable params)
auth/user-repository.ts        — interface + in-memory impl + pg impl
auth/session-repository.ts     — interface + in-memory impl + pg impl (+ touch)
auth/verification-token-repository.ts — interface + in-memory + pg
auth/email.ts                  — EmailService interface + SMTP (nodemailer) + fake
auth/rate-limit.ts             — keyed fixed-window limiter (injectable clock)
auth/auth-service.ts           — orchestration: register/login/verify/resend/logout/me/lockout/single-session
auth/auth-routes.ts            — Fastify plugin exposing /auth/* with cookies/Origin checks
app.ts (edit)                  — composition root: config → pool → repos → auth service → cookie plugin → routes → hub with session resolver; WS upgrade session resolution
server.ts (edit)               — run migrations before listen
```

- **State ownership:** the DB owns accounts/sessions/tokens; the hub owns in-memory game state and resolves account identity from the session at connection/join time. Repositories are the only DB access path; services are pure over repository interfaces; routes are thin.
- **Composition order (F9):** `loadGameConfig` + `loadAuthConfig` → (if `DATABASE_URL`) create pool → (server.ts) run migrations → build repositories (pg when a pool exists, else in-memory for tests) → build `AuthService` → register `@fastify/cookie` → register auth routes → create hub with an injected `SessionResolver` (`(cookieHeader) => AccountSession | null`). `buildApp(env, options)` keeps test seams: `options.auth` (repos + service + resolver) overrides construction; `options.config` still overrides game config.
- **Data flow (register):** route → `AuthService.register` → validate input → uniqueness check → `UserRepository.create` (password hashed) → `VerificationTokenRepository.issue` → `EmailService.sendVerification` → 202.
- **Data flow (login):** route → `AuthService.login` → fetch user → lockout check → `password.verify` → on success revoke prior sessions (AC-33) → `SessionRepository.create` → set cookie → 200; on failure increment counter / maybe lock.
- **Data flow (WS):** upgrade request cookie → `SessionResolver` → `AccountSession` (or null) → `hub.attach(peer, accountSession)` stored on `Connection`; `join { mode }` validates mode against the session; account mode requires a verified session else `account_unverified` (or `not_authenticated` when no session).
- **Account member lifecycle in the hub (F1):**
  - `Connection.accountSession: AccountSession | null` (`{ userId, username, verified }`), resolved from the cookie and never from client input.
  - `Member.accountId: string | null` (null for guests); `Member.name` is the username for accounts and `p<N>` for guests.
  - `join { mode: 'guest' }` (or a default guest join) runs the existing guest path unchanged: new `p<N>` member, in-memory token, grace window.
  - `join { mode: 'account' }`:
    - no `accountSession` → `error { code: 'not_authenticated' }`, no member created;
    - session present but `verified === false` → `error { code: 'account_unverified' }`, no member created;
    - verified session → create a new member with that `accountId`, `name = username`, a new `playerId` (`p<N>`), a new cube and token. `join { mode: 'account' }` never resumes a grace member by `accountId` (multi-tab ambiguity avoided); resume is performed only via `rejoin { token }`.
  - `rejoin { token }` (guest or account): if the token maps to a member currently in grace (connection null, not expired), reattach and send `welcome` (full resume, identity + cube state). For an authenticated connection, the member's `accountId` must equal the connection's `accountSession.userId` and the session must be verified, otherwise `resume_failed`. For an unauthenticated connection, the member must be a guest (`accountId === null`), otherwise `resume_failed`. Unknown/dead/duplicate tokens → `resume_failed` with no state change.
  - Two connections sharing one account cookie are two distinct members (multi-tab), each with its own slot/cube and its own member token; the account identity is shared but membership is per-connection. Each tab resumes its own member via its own token.
  - After grace expiry the member is removed; a later `join { mode: 'account' }` with the same account cookie creates a new member with the same `accountId` (new playerId/cube) and follows the normal join path (AC-25).
  - `welcome` and `worldEntered` carry `identity` so the client can distinguish account vs. guest (see protocol changes).

### Frontend (`src/frontend/src`)

```
auth/api.ts                  — fetch wrappers for /auth/* (credentials: 'include'), incl. verify + resend
auth/store.ts                — external store: status (anonymous|loading|authenticated), user, verified
ui/AuthMenu.tsx              — overlay: Login / Register / Play as guest
ui/AuthForms.tsx             — Login + Register forms with validation
ui/VerificationPending.tsx   — "check your email" + resend
ui/VerifyEmail.tsx           — consumes ?token=... from the email link and calls POST /auth/verify
App.tsx (edit)               — render AuthMenu during intro until a choice is made; handle verify route/query param
game/session.ts (edit)       — auth store subscription, deferred join(mode), account identity handling
multiplayer/transport.ts (edit) — remove auto-join on hello; expose join(mode); account_unverified/not_authenticated handling
multiplayer/protocol.ts (edit) — mirrored protocol (join mode, identity, new error codes)
```

- **Data flow:** `AuthMenu` calls `auth/api`; on success store updates. The session no longer joins automatically on `hello`: it waits for an explicit choice and calls `transport.join(mode)` with `'account'` (verified session) or `'guest'`. The transport retains `lastMode` and the last `welcome` token: on the first connection it sends nothing on `hello` until `join(mode)` is called; on a reconnect (new socket) it sends `rejoin { token }` when a token exists, otherwise `join { mode: lastMode }`. Verification screen handles resend; `VerifyEmail` consumes the token from the email link.

## Interfaces / contracts

### HTTP API

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ username, email, password }` | `202 { message }` |
| POST | `/auth/login` | `{ username, password }` | `200 { user }` + Set-Cookie |
| POST | `/auth/logout` | — | `204` + clear cookie |
| GET | `/auth/me` | — | `200 { user }` or `401` |
| POST | `/auth/verify` | `{ token }` | `200 { user }` + Set-Cookie (or `400`/`401`) |
| POST | `/auth/resend-verification` | `{ email }` | `202 { message }` (always, no enumeration) |

`user = { id: string; username: string; email: string; verified: boolean }`.

### WebSocket protocol changes (additive)

- `join` payload gains optional `mode: 'account' | 'guest'` (default resolved server-side: `'account'` if a verified session exists else `'guest'`). An invalid present value decodes to `bad_message`.
- `welcome` / `worldEntered` gain `identity: { kind: 'account'; accountId: string; username: string } | { kind: 'guest'; playerId: string }` (carried inside the placement payload).
- New error codes: `account_unverified`, `not_authenticated`.
  - `not_authenticated`: `join { mode: 'account' }` received on a connection with no valid account session.
  - `account_unverified`: `join { mode: 'account' }` received on a connection with a valid but unverified session.
- `hello` envelope stays exactly `{ type: 'hello', serverTime }`.

Type definitions (backend `src/backend/src/game/protocol.ts` and frontend mirror `src/frontend/src/multiplayer/protocol.ts` must stay in sync; parity tests cover them):

```ts
// client -> server
export type ClientMessage =
  | { type: 'join'; mode?: 'account' | 'guest' }
  | { type: 'rejoin'; token: string }
  | { type: 'explode'; id: MiniCubeId; level: number }
  | { type: 'cubeCompleted'; level: number }
  | { type: 'rotate'; yawSteps: number; pitchSteps: number };

// server -> client (welcome/worldEntered gain `identity` inside Placement)
export type Identity =
  | { kind: 'account'; accountId: string; username: string }
  | { kind: 'guest'; playerId: string };

export interface Placement {
  playerId: string;
  name: string;
  token: string;
  serverId: number;
  maxUsers: number;
  position: Position;
  self: CubeState;
  roster: MemberState[];
  identity: Identity; // NEW
}

// error codes (additive)
export type ErrorCode =
  | 'bad_message' | 'not_joined' | 'rate_limited' | 'invalid_click'
  | 'invalid_completion' | 'resume_failed'
  | 'account_unverified' | 'not_authenticated'; // NEW
```

Transport interface addition (frontend):

```ts
export interface Transport {
  connect(): void;
  close(): void;
  send(message: ClientMessage): void;
  join(mode: 'guest' | 'account'): void; // NEW — deferred join entry point
  onMessage(handler: (message: ServerMessage) => void): () => void;
  onStatus(handler: (status: TransportStatus) => void): () => void;
}
```

### Repository interfaces (TypeScript)

```ts
interface UserRepository {
  create(input: { username; email; passwordHash }): Promise<User>;
  findByUsername(username): Promise<User | null>;
  findByEmail(email): Promise<User | null>;
  findById(id): Promise<User | null>;
  setVerified(id, verified): Promise<void>;
  recordFailedLogin(id): Promise<{ attempts; lockedUntil: number | null }>;
  resetFailedLogin(id): Promise<void>;
  updatePasswordHash(id, hash): Promise<void>;
}
interface SessionRepository {
  create(userId: string | null, ttlMs: number): Promise<{ id; token; expiresAt }>;
  findByToken(token: string): Promise<Session | null>;
  touch(id: string, ttlMs: number): Promise<{ expiresAt: number }>; // sliding expiry (AC-16)
  revoke(id): Promise<void>;
  revokeAllForUser(userId): Promise<void>;
}
interface VerificationTokenRepository {
  issue(userId: string, ttlMs: number): Promise<{ token: string; expiresAt: number }>;
  consume(token: string): Promise<{ userId: string } | null>; // single-use, expiry-checked
  invalidateForUser(userId): Promise<void>;
}
```

Tokens are generated as 32 random bytes (hex) and stored only as SHA-256 hashes.

### Rate limiter interface

```ts
interface RateLimiter {
  allow(key: string, limit: number, windowMs: number): boolean; // fixed window, injectable clock
}
```

Keys are caller-supplied and namespaced, e.g. `ip:${ip}:register`, `ip:${ip}:login`, `ip:${ip}:resend`, `account:${userId}:resend`. Per-key isolation is required and tested.

### DB schema (PostgreSQL)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_lower_uq ON users (lower(username));
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
```

Username uniqueness is case-insensitive via the functional unique indexes on `lower(username)`/`lower(email)`; the raw columns carry no `UNIQUE` constraint (F18).

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/package.json` | Edit | Add `@fastify/cookie`, `@node-rs/argon2` (or `argon2`), `pg`, `nodemailer`, types (⚠️ approval) |
| `src/backend/src/game/config.ts` | Unchanged shape | Game config; no auth/db settings |
| `src/backend/src/auth/config.ts` | New | `AuthConfig` + `loadAuthConfig` (DB/email/session/argon/cookie env) |
| `src/backend/src/auth/config.test.ts` | New | Auth config tests |
| `src/backend/src/game/config.test.ts` | Edit | Existing game config tests |
| `src/backend/src/db/pool.ts` | New | pg Pool factory |
| `src/backend/src/db/pool.test.ts` | New | Pool unit tests (mocked) |
| `src/backend/src/db/migrate.ts` | New | Numbered migration runner |
| `src/backend/src/db/migrate.test.ts` | New | Migration tests |
| `src/backend/src/db/schema.sql` | New | DDL (also migration 001) |
| `src/backend/src/db/migrations/001_init.sql` | New | Initial migration |
| `src/backend/src/auth/password.ts` | New | Argon2id hash/verify |
| `src/backend/src/auth/password.test.ts` | New | Password tests |
| `src/backend/src/auth/user-repository.ts` | New | UserRepository + impls |
| `src/backend/src/auth/user-repository.test.ts` | New | Repo tests |
| `src/backend/src/auth/session-repository.ts` | New | SessionRepository + impls (+ touch) |
| `src/backend/src/auth/session-repository.test.ts` | New | Repo tests |
| `src/backend/src/auth/verification-token-repository.ts` | New | Token repo + impls |
| `src/backend/src/auth/verification-token-repository.test.ts` | New | Repo tests |
| `src/backend/src/auth/email.ts` | New | EmailService + SMTP + fake |
| `src/backend/src/auth/email.test.ts` | New | Email tests |
| `src/backend/src/auth/rate-limit.ts` | New | Keyed rate limiter |
| `src/backend/src/auth/rate-limit.test.ts` | New | Rate limit tests |
| `src/backend/src/auth/auth-service.ts` | New | Auth orchestration |
| `src/backend/src/auth/auth-service.test.ts` | New | Service tests |
| `src/backend/src/auth/auth-routes.ts` | New | Fastify auth plugin |
| `src/backend/src/auth/auth-routes.test.ts` | New | Route tests |
| `src/backend/src/app.ts` | Edit | Composition root, cookie parsing, WS session resolution, auth routes |
| `src/backend/src/app.test.ts` | Edit | Extended app tests |
| `src/backend/src/game/hub.ts` | Edit | Join modes, account identity, verification gating, account resume |
| `src/backend/src/game/hub.test.ts` | Edit | Extended hub tests |
| `src/backend/src/game/protocol.ts` | Edit | join mode, identity, new error codes |
| `src/backend/src/game/protocol.test.ts` | Edit | Protocol tests |
| `src/backend/src/server.ts` | Edit | Run migrations before listen |
| `src/frontend/src/auth/api.ts` | New | Auth fetch client |
| `src/frontend/src/auth/api.test.ts` | New | API client tests |
| `src/frontend/src/auth/store.ts` | New | Auth external store |
| `src/frontend/src/auth/store.test.ts` | New | Store tests |
| `src/frontend/src/ui/AuthMenu.tsx` | New | Intro menu overlay |
| `src/frontend/src/ui/AuthMenu.test.tsx` | New | Menu tests |
| `src/frontend/src/ui/AuthForms.tsx` | New | Login/Register forms |
| `src/frontend/src/ui/AuthForms.test.tsx` | New | Form tests |
| `src/frontend/src/ui/VerificationPending.tsx` | New | Verification pending screen |
| `src/frontend/src/ui/VerificationPending.test.tsx` | New | Tests |
| `src/frontend/src/ui/VerifyEmail.tsx` | New | Consumes verification token from email link |
| `src/frontend/src/ui/VerifyEmail.test.tsx` | New | Verify-email tests |
| `src/frontend/src/App.tsx` | Edit | Intro menu integration; verify route/query handling |
| `src/frontend/src/App.test.tsx` | Edit | App tests |
| `src/frontend/src/game/session.ts` | Edit | Auth wiring, deferred join(mode) |
| `src/frontend/src/game/session.test.ts` | Edit | Session tests |
| `src/frontend/src/multiplayer/transport.ts` | Edit | Deferred join, join(mode), error handling |
| `src/frontend/src/multiplayer/transport.test.ts` | Edit | Transport tests |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirrored protocol (join mode, identity, new error codes) |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Protocol parity tests |
| `compose.yaml` | Edit | db + mailpit services, env passthrough (⚠️ approval) |
| `compose.smoke.yaml` | Edit | DB/smoke env (if needed) (⚠️ approval) |
| `README.md` | Edit | Document new env vars |
| `docs/product/glossary.md` | Edit | Update server member identity; add terms (⚠️ approval for vision.md only) |
| `docs/product/vision.md` | Edit | Accounts optional (supersession) (⚠️ user-owned, approval) |
| `docs/product/realtime-backlog.md` | Edit | Resolve tension |
| `tests/e2e/smoke.mjs` | Edit | Optional auth smoke checks |

## Key decisions

| # | Decision | Rationale | Alternatives |
| --- | --- | --- | --- |
| 1 | Argon2id for password hashing | OWASP top recommendation; memory-hard; no input length limit | bcrypt (legacy fallback), scrypt (fallback), PBKDF2 (FIPS only) |
| 2 | Server-side opaque sessions in Postgres | Revocable, no token in JS, simple | Stateless JWT (harder to revoke), in-memory only (lost on restart) |
| 3 | `HttpOnly` cookie for session | XSS-resistant; auto-sent on WS upgrade (same site) | Bearer token in memory (XSS exposure), localStorage (worst) |
| 4 | PostgreSQL 16 in a container | Mature, relational integrity, user asked for dockerized DB | MySQL 8, SQLite (no container) |
| 5 | Pluggable EmailService, SMTP default, Mailpit in dev | Keeps prod provider open; dev captures mail locally | Hard-coded provider (vendor lock-in) |
| 6 | Verification tokens: 32-byte CSPRNG, SHA-256 at rest, 24h, single-use | Standard best practice; limits replay | Long-lived tokens, plaintext storage |
| 7 | Accounts optional; guest play retained | Preserves "instant fun" and avoids forcing friction | Mandatory accounts (breaks vision) |
| 8 | Intro menu does not pause the cinematic | Matches request ("intro happening in background") | Pause intro until choice |
| 9 | Manual input validation (no zod) | Fewer deps; flagged for user approval if preferred | zod |
| 10 | Account lockout 5 failures / 15 min | Balances abuse resistance and UX | Stricter/looser thresholds |
| 11 | Separate `AuthConfig` from `GameConfig` | Hub consumes only game settings; auth/db settings stay in auth layer (F9) | Extend GameConfig (couples hub to DB config) |
| 12 | Deferred join (`transport.join(mode)`) | Intro menu choice happens after `hello`; auto-join would lock identity (F2, F14) | Auto-join with default mode (forbidden second join) |
| 13 | Single active session per account | Security: re-login evicts prior sessions; tabs share one cookie (F7, AC-33) | Multiple concurrent sessions (more complex revocation) |
| 14 | Case-insensitive uniqueness via functional indexes only | `Alice` and `alice` collide; avoids conflicting raw `UNIQUE` (F18) | Raw `UNIQUE` plus functional index (conflicting) |

## Risks & mitigations

- **Native dependency build in containers** (`@node-rs/argon2`/`pg`): use prebuilt binaries; rebuild image on dep change (`podman compose up --build`). Mitigation: keep a fallback to `argon2` if native build fails.
- **Coverage drop from DB adapters:** unit-test adapters with mocked drivers; keep adapters thin.
- **Cookie not sent on WS upgrade in dev:** dev uses localhost (same site); verify in smoke test.
- **Migration failure at boot:** abort startup; log clear error; smoke test catches.
- **Enumeration via timing:** use constant-time verify; generic error messages.
- **Session fixation:** regenerate session id on login (create new row, revoke old for that user) (AC-33).
- **Unverified account play bypass:** server resolves `verified` from DB, not client; forged payloads rejected.
- **Account resume identity drift:** resume-by-account uses the cookie's `accountId` and the grace window; after grace, a new member is created with the same `accountId` (new cube/slot) per AC-25.
- **Deferred join deadlock:** if no choice is ever made, no join is sent and gameplay stays gated; the menu remains available.

## Open questions

See spec.md § Open questions (Q-1…Q-12). Q-1, Q-2, Q-3, Q-6 are blocking and must be approved before T1/T3/T7/T17. All dependency/service choices are flagged ⚠️ Ask first per AGENTS.md.

## Real-time impact

- **Server authority:** accounts, verification, sessions, and identity are server-authoritative; client-reported account ids/verified flags are ignored. Join mode is client-chosen but validated against the session.
- **Connection lifecycle:** WS upgrade resolves the account session from the cookie and stores it on `Connection`; `join` carries mode; reconnect within grace resumes the member (identity + cube state) for both guests (token) and accounts (token-based rejoin, validated against the cookie's `accountId`); after grace, a new connection with the valid cookie creates a new member with the same account identity (new cube/slot) and follows the normal join path.
- **Deferred join & reconnect:** `hello` no longer triggers an automatic join on the first connection; the session calls `transport.join(mode)` after an explicit menu choice. On a reconnect (new socket), the transport sends `rejoin { token }` when it holds a token from a previous `welcome`, otherwise `join { mode }` using the last chosen mode, so reconnects still resume within grace (AC-34).
- **Multi-client:** two tabs with the same account cookie are two distinct members (one connection = one member), each with its own member token; each tab resumes its own member via its token. A re-login evicts all tabs (AC-33). Account resume within grace never matches by `accountId` alone (AC-35).
- **Latency:** login/verify are request/response HTTP; no impact on game loop; WS join waits for server response as before.

## Containerization impact

- **New services:** `db` (Postgres 16, named volume, healthcheck) and `mailpit` (dev email capture). Backend `depends_on: db: condition: service_healthy`. No new ports exposed beyond loopback mappings (5432/1025/8025 optional for dev inspection).
- **Config via env:** `DATABASE_URL`, `SMTP_HOST/PORT/USER/PASS`, `APP_BASE_URL`, `SESSION_COOKIE_SECURE`, `ALLOWED_ORIGIN`. Safe defaults for local dev (db hostname `db`, mailpit host `mailpit`).
- **Secrets:** DB password and SMTP credentials come from env at runtime; never committed; `.env*` untouched.
- **WebSocket endpoint:** unchanged (`GET /ws` on 8080).
- **Health signals:** db healthcheck via `pg_isready`; backend/frontend healthchecks unchanged.
- **Deploy neutrality:** images remain provider-neutral; no provider-specific config.
- **Sequencing:** compose edits (T17) land before server startup migrations (T19) and smoke (T20) so migrations run against the compose `db`; T17/T18 require explicit user approval before execution (AGENTS.md ⚠️ Ask first).

## Revision history

- r1 — 2026-10-25 — initial draft (planning phase).
- r2 — 2026-10-25 — spec review r1 revisions: composition/AuthConfig, deferred join, account member lifecycle, `@fastify/cookie`, sliding `touch`, resume semantics, single session (AC-33), blocking dependency decisions, frontend protocol mirror ownership, verification consumption UI, AC-17 mapping, approval gates, join-mode resolution, rate-limiter keying, intro-skip/menu clarification, `not_authenticated` semantics, case-insensitive uniqueness, registration enumeration trade-off, container sequencing, logging policy.
- r3 — 2026-10-25 — spec review r2: reconnect-resume under deferred join (AC-34) with transport `lastMode`/token retention; multi-tab account resume selection via token-based rejoin with cookie `accountId` validation (AC-35); protocol type definitions for `mode`/`identity`/new error codes and `Transport.join`; plan/real-time impact updated.