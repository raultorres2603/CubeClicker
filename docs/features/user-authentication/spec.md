---
feature: user-authentication
revision: 3
status: draft
created: 2026-10-25
updated: 2026-10-25
---

# Spec — User Authentication (Login, Registration & Guest Play)

## Summary

Add optional accounts to CubeClicker: a player may register with a username, email and password, verify the email before the account can be used to play, log in and out, or continue to play as a guest with no account. On entry, while the intro cinematic runs in the background, the player is prompted with a menu offering `Login`, `Register` and `Play as guest`. Passwords are hashed with Argon2id; sessions are opaque, server-side, carried in an `HttpOnly` cookie; email verification uses single-use, hashed, expiring tokens. A dockerized PostgreSQL container (and a dev-only Mailpit container for email capture) join the existing compose stack. This feature resolves the project's standing "no accounts required" stance by making accounts optional and additive: guest play remains first-class and no account is ever required to play. All auth state is server-authoritative; the existing ephemeral guest identity and multiplayer behavior are retained. Account identity is resolved from the session cookie on the server (never from client-supplied ids or flags); join mode is chosen client-side but validated server-side.

## User stories

- As a new player, I want to register with a username, email and password, so I can keep a stable identity across sessions.
- As a registrant, I want an email with an activation link, so only verified email owners can play as that account.
- As a returning player, I want to log in with username and password, so I can resume my account identity.
- As a player who does not want an account, I want to play as a guest, so I can start instantly with no friction.
- As a player, I want to choose Login / Register / Play as guest while the intro cinematic plays, so entry stays fast and cinematic.
- As a player with an unverified account, I want to be told I must verify before playing, and to resend the email, so I am not stuck.

## Acceptance criteria

Verification notes: backend = `src/backend`, frontend = `src/frontend`. Evidence per AC: a test asserting concrete values, a command, or an observable step. All tests use concrete expected values (no banned matchers, no useless tests).

### Accounts & registration

- **AC-1 — Registration creates an unverified account.** `POST /auth/register` with a valid `{ username, email, password }` returns `202` and persists a user with `verified = false`; the password is stored only as an Argon2id hash (the stored value verifies with `argon2.verify` against the plaintext, and the plaintext never appears in the DB, logs, or response). Evidence: `auth-service.test.ts`, `user-repository.test.ts`.
- **AC-2 — Username and email are unique.** Registering with a username or email already in use returns `409` with a generic message and creates no new row. Evidence: `auth-service.test.ts` (both duplicate cases).
- **AC-3 — Password policy.** Passwords shorter than 12 or longer than 128 characters are rejected with `400`; a 12-character password is accepted. (No arbitrary complexity rules; length is the policy.) Evidence: `auth-service.test.ts` (boundary values 11/12/128/129).
- **AC-4 — Unverified accounts cannot play.** A connection presenting a valid but unverified account session cannot join the game as an account: the WS `join { mode: 'account' }` is rejected with `error { code: 'account_unverified' }`; guest play (`join { mode: 'guest' }`) still succeeds. Evidence: `hub.test.ts`.
- **AC-5 — Verification activates the account.** Consuming a valid, unexpired, single-use verification token sets `verified = true` and creates a session (cookie set). A reused, expired, or unknown token returns `400`/`401` and changes no state. Evidence: `auth-service.test.ts`, `verification-token-repository.test.ts`, frontend `VerifyEmail` tests.
- **AC-6 — Verification email is sent.** Registration triggers exactly one email to the registered address containing a verification link that carries the raw token; `POST /auth/resend-verification` issues a new token, invalidates the previous one, and sends a new email. Resend is rate-limited to 3 per hour per account and per IP. Evidence: `auth-service.test.ts`, `email.test.ts`.

### Authentication & sessions

- **AC-7 — Login.** `POST /auth/login` with valid credentials returns `200`, sets the session cookie, and returns `{ user: { id, username, email, verified } }`. Invalid credentials return `401` with a generic message (no user enumeration). A locked account returns `429` with `Retry-After`. Evidence: `auth-routes.test.ts`.
- **AC-8 — Account lockout.** Five consecutive failed logins lock the account for 15 minutes; a successful login resets the counter. Evidence: `auth-service.test.ts` (boundary: 4 failures still allowed, 5th locks).
- **AC-9 — Logout revokes the session.** `POST /auth/logout` invalidates the server-side session and clears the cookie; a following `GET /auth/me` returns `401`. Evidence: `auth-routes.test.ts`.
- **AC-10 — Current user.** `GET /auth/me` returns the authenticated user when a valid session cookie is present, otherwise `401`. Evidence: `auth-routes.test.ts`.
- **AC-11 — Password hashing.** Passwords are hashed with Argon2id using at least OWASP's minimum (memory ≥ 19 MiB, iterations ≥ 2, parallelism ≥ 1); verification uses the library's constant-time routine. Evidence: `password.test.ts`, `config.test.ts`.
- **AC-12 — No plaintext secrets and no auth data in logs.** The plaintext password, password hash, session token, verification token, request bodies, and `Cookie`/`Authorization` headers are never returned by any endpoint or written to logs. Evidence: route tests + grep at final gate.
- **AC-33 — Single active session.** A successful login revokes all prior sessions for that account; a request carrying a revoked session cookie returns `401`. Evidence: `auth-service.test.ts`, `auth-routes.test.ts`.
- **AC-34 — Reconnect under deferred join.** The first connection sends no `join`/`rejoin` on `hello` until an explicit `transport.join(mode)` call. On a subsequent `hello` (reconnect), the transport sends `rejoin { token }` when it holds a token from a previous `welcome`, otherwise `join { mode }` using the last chosen mode. Evidence: `transport.test.ts`.
- **AC-35 — Account resume selection.** Account resume within the grace window is token-based (`rejoin { token }`), identical to guest resume; the hub verifies the token maps to an account member whose `accountId` equals the connection's authenticated `userId` (and that the session is verified), otherwise `resume_failed`. `join { mode: 'account' }` always creates a new member and never resumes a grace member by `accountId`, removing multi-tab ambiguity (one token per tab). Evidence: `hub.test.ts`, `transport.test.ts`.

### Security

- **AC-13 — SQL injection prevention.** All database access uses parameterized queries; no user input is interpolated into SQL. Evidence: repository tests assert bound parameters; grep at final gate.
- **AC-14 — Rate limiting.** `POST /auth/register`, `POST /auth/login`, and `POST /auth/resend-verification` are rate-limited per IP (5/min, 10/min, and 3/hour respectively) and return `429` when exceeded. Evidence: `auth-routes.test.ts` with fake timers.
- **AC-15 — CSRF protection.** State-changing auth endpoints reject requests whose `Origin` header does not match the configured allowed origin with `403`, and rely on `SameSite=Lax` cookies. Evidence: `auth-routes.test.ts`.
- **AC-16 — Secure session cookie.** The session cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, with a 7-day sliding expiry; it is not readable from JavaScript. Evidence: `auth-routes.test.ts` (Set-Cookie assertions).

### Guest play & intro menu

- **AC-17 — No secrets in the bundle.** `DATABASE_URL`, SMTP credentials, and password/verification/session hashes are absent from the frontend bundle. Evidence: `npm run build` + grep at final gate.
- **AC-18 — Intro menu overlay.** While the intro cinematic plays, an overlay renders three buttons with the exact labels `Login`, `Register`, and `Play as guest`; the cinematic keeps animating behind the overlay (no pause). Evidence: `AuthMenu.test.tsx`, `App.test.tsx`.
- **AC-19 — Play as guest.** Selecting `Play as guest` dismisses the menu and proceeds with an ephemeral guest identity; the intro skip behavior is unchanged. Intro skip (keyboard any key, or a tap outside the overlay) advances the cinematic only and does not select an auth mode or dismiss the menu. Evidence: `App.test.tsx`, `session.test.ts`.
- **AC-20 — Login/Register forms.** Selecting `Login` or `Register` opens the corresponding form overlay; canceling returns to the three-button menu. Evidence: `AuthMenu.test.tsx`.

### Real-time / online

- **AC-21 — Authenticated join.** A verified account session can join the game as an account; the member's display name equals the username and the identity is stable across reconnects (same account id). Evidence: `hub.test.ts`, `session.test.ts`.
- **AC-22 — Guest identity retained.** Guest play uses the ephemeral identity exactly as before (`p<N>`, in-memory token, grace window); all multiplayer ACs still pass. Evidence: existing multiplayer tests unchanged.
- **AC-23 — WS auth via cookie.** The backend resolves the account session from the upgrade request's cookie; connections without a valid session are guests. Evidence: `app.test.ts`, `hub.test.ts`.
- **AC-24 — Unverified join rejected.** (see AC-4) WS `join { mode: 'account' }` for an unverified session returns `error account_unverified`. Evidence: `hub.test.ts`.
- **AC-25 — Reconnect preserves account identity.** Within the grace window, a reconnecting socket (one that retains the in-memory member token) resumes the same member (identity + cube state) via `rejoin { token }` — for both guests and accounts. Outside the grace window, a new connection carrying the valid cookie creates a new member with the same account identity (new cube/slot) and follows the normal join path. A page reload loses the in-memory token and therefore creates a new member even inside the grace window. Evidence: `hub.test.ts`, `session.test.ts`, `transport.test.ts`.
- **AC-26 — Server authority.** All account, verification, and identity state is server-authoritative; client-supplied account ids or verified flags are ignored. Evidence: `hub.test.ts` (forged payloads rejected).

### Containerization

- **AC-27 — DB container.** `compose.yaml` adds a `db` service (PostgreSQL 16) with a named volume and healthcheck; the backend `depends_on` the db being healthy; `DATABASE_URL` is passed via env with a default pointing at `db`; `podman compose up` still starts the whole stack with defaults. Evidence: compose diff.
- **AC-28 — Dev email capture.** `compose.yaml` adds a `mailpit` service; default dev SMTP points at it; no real email is sent in dev. Evidence: compose diff.
- **AC-29 — Secrets via env only.** No credentials are committed; `.env*` is untouched; README documents the new variables. Evidence: git diff / grep.
- **AC-30 — Migrations on startup.** The backend applies pending SQL migrations on boot before listening; the operation is idempotent and a failure aborts startup. Evidence: `migrate.test.ts`, smoke transcript.

### Supersession

- **AC-31 — Supersession recorded.** This spec records the supersession of the project's "no accounts" stance (vision principle, multiplayer Q-10, glossary `server member`, realtime-backlog open tension) in § Supersessions; predecessor feature specs/plans/tasks are not edited. Evidence: this spec + ledger.

### Testing & coverage

- **AC-32 — Coverage.** `npm run coverage` meets ≥ 80% statements/branches/functions/lines in both workspaces with the new modules included and no coverage exclusions. Evidence: coverage report at final gate.

## Non-goals

- No OAuth / social login, no MFA, no passkeys, no password reset flow (deferred; open question Q-9).
- No roles, permissions, or admin surfaces.
- No user-chosen display names beyond the username (the username *is* the display name).
- No shared/global counters, leaderboards, or economy changes.
- No changes to game rules, cube logic, or multiplayer rebalance policy.
- No multi-process or multi-container backend; the DB is the only new service.
- No TLS termination design (deployment-time, per containerization.md).
- No production email provider commitment (pluggable interface; default dev = Mailpit).
- No account deletion or data export (deferred).

## Boundaries

- ✅ Always: keep `game/**` and `multiplayer/**` pure and DOM-free where sensible; server authority over every shared/auth value; parameterized SQL only; concrete test assertions; run lint/typecheck/tests/coverage before reporting done; record evidence in build logs; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (`@fastify/cookie`, `argon2`/`@node-rs/argon2`, `pg`, `nodemailer`, `zod`); any pinned-constant deviation; touching files outside a task's `files_owned` (especially `compose.yaml`, `compose.smoke.yaml`, `smoke.mjs`); any coverage exclusion or threshold change; editing `docs/product/vision.md` (user-owned vision).
- 🚫 Never: weaken assertions; commit secrets or `.env*` edits; store plaintext passwords; trust client-supplied identity/verified flags; edit predecessor feature specs/plans/tasks; push; change ACs unilaterally.

## Security considerations

- **User-controlled data:** username, email, password (registration); login identifier; verification token (URL); session cookie. All validated server-side (length/charset for username, email format, password length). Usernames are constrained to `[a-zA-Z0-9_-]{3,24}`; emails are validated with a conservative regex and normalized (lowercase, trim).
- **Persistence integrity:** accounts/sessions/tokens persisted in Postgres; migrations are versioned and idempotent; a failed migration aborts startup so a half-migrated DB is never served. Repositories are the only DB access path.
- **Secrets:** passwords hashed with Argon2id (memory-hard). Session and verification tokens are 32-byte CSPRNG values stored only as SHA-256 hashes; the raw value is sent once (cookie / email link). SMTP/DB credentials come from env at runtime and are never committed or baked into images.
- **Abuse bounds:** per-IP rate limits on register/login/resend; account lockout after 5 failures; verification tokens single-use with 24h expiry; sessions 7-day sliding expiry with server-side revocation.
- **Client safety:** no secrets in the bundle; the frontend holds no password after submit; session is `HttpOnly` so JS cannot read it.
- **Enumeration resistance:** login and resend-verification return generic messages and identical status codes regardless of whether the account exists. Registration returns `409` for a duplicate username/email; this enumeration vector is an accepted trade-off for UX clarity and is documented here intentionally (AC-2).
- **Logging hygiene:** request bodies, `Cookie`/`Authorization` headers, password hashes, session tokens, and verification tokens are never written to logs; Fastify request logging for `/auth/*` is disabled or redacted to the route and status code only.
- **Rendering safety:** all DOM text is React-escaped; no `dangerouslySetInnerHTML`.

## Testing strategy

- **Backend unit (Vitest, node):** `config.test.ts` and `auth/config.test.ts` (new env vars + boundaries), `password.test.ts` (hash/verify, OWASP params, wrong password fails, distinct salts), `user-repository.test.ts` and `session-repository.test.ts` and `verification-token-repository.test.ts` (in-memory + mocked `pg` Pool: CRUD, uniqueness, expiry, single-use, `touch`), `auth-service.test.ts` (register/login/verify/resend/lockout/single-session with faked repos + email + clock), `rate-limit.test.ts` (per-key isolation), `migrate.test.ts` (idempotent apply, failure aborts), `auth-routes.test.ts` (HTTP status codes, cookies, Origin/CSRF, rate limits, sliding expiry, logging with fake timers).
- **Backend integration (node):** `app.test.ts` extended — real app on an ephemeral port with Node 24's global `WebSocket`, cookie-based WS auth, `join` modes, verification gating, `not_authenticated` vs `account_unverified`; optional real-Postgres suite gated on `DATABASE_URL`.
- **Frontend unit (Vitest, node):** `auth/api.test.ts`, `auth/store.test.ts`, `AuthMenu.test.tsx`, `AuthForms.test.tsx`, `VerificationPending.test.tsx`, `VerifyEmail.test.tsx`, plus `App.test.tsx`, `session.test.ts`, `transport.test.ts`, and protocol parity tests.
- **E2E / container:** `smoke.mjs` extended (optional) to exercise register→verify→login over the container network.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace; pre-gates per task are workspace-scoped. No exclusions. The `pg`/`nodemailer` adapters are unit-tested with mocked drivers.
- **Assertion bar:** concrete expected values everywhere (exact status codes, cookie attributes, message objects); no banned matchers, no snapshot-only/assertion-free tests.

## Open questions

- **Q-1 — Database engine (BLOCKING).** Proposed default: **PostgreSQL 16** (`postgres:16-alpine` container, `pg` driver). Alternatives: MySQL 8 (similar ops), SQLite (no separate container — conflicts with the request for a dockerized DB). Decision needed from the user (⚠️ Ask first: new service + dependency) before T1/T3/T17.
- **Q-2 — Email provider (production) (BLOCKING).** Proposed default: pluggable `EmailService` with an SMTP implementation (`nodemailer`); dev uses a **Mailpit** container capturing all mail. Production provider (Resend/Postmark/SES) chosen via env. Decision needed (⚠️ Ask first: dependency + vendor).
- **Q-3 — Argon2 package (BLOCKING).** Proposed default: **`@node-rs/argon2`** (prebuilt binaries, faster) with OWASP-minimum params (m=19456 KiB, t=2, p=1) or stronger (recommended m=65536, t=3, p=1). Alternative: `argon2` (node-argon2). Decision needed (⚠️ Ask first: dependency).
- **Q-4 — Validation library.** Proposed default: manual validation (no new dep). Alternative: `zod`. Decision needed.
- **Q-5 — Session store.** Proposed default: server-side sessions in Postgres (opaque token, hashed at rest, 7-day sliding expiry). Alternative: stateless signed JWT in cookie (harder to revoke). Recommended: server-side.
- **Q-6 — Migration tooling (BLOCKING).** Proposed default: a tiny in-repo runner applying numbered `.sql` files tracked in `schema_migrations`. Alternative: `node-pg-migrate`. Decision needed (⚠️ Ask first: dependency).
- **Q-7 — Username policy.** Proposed: `[a-zA-Z0-9_-]{3,24}`, case-insensitive uniqueness. Open to change.
- **Q-8 — Auto-login after verification.** Proposed default: yes (set session cookie on verify) for UX. Alternative: require explicit login. Decision needed.
- **Q-9 — Password reset.** Out of scope for v1 (non-goal). If wanted, it reuses the verification-token machinery; flag for a follow-up.
- **Q-10 — CSRF depth.** Proposed: `SameSite=Lax` + `Origin` check (no CSRF token). If the frontend and backend end up cross-site in production, upgrade to double-submit CSRF tokens.
- **Q-11 — Mailpit in compose.** Proposed: include Mailpit as a dev service. If the user prefers no extra service, SMTP can point at an external sandbox instead.
- **Q-12 — Intro menu vs intro skip.** Proposed resolution: the menu does not pause the cinematic; skip (keyboard any key or tap outside the overlay) advances the cinematic only and does not select a mode or dismiss the menu. Confirm this matches the desired UX.

## Assumptions

- The existing multiplayer ephemeral identity remains the fallback for guests; accounts are additive.
- Game state remains in-memory and resets on backend restart; only auth data persists.
- The frontend and backend are same-site in production (so `SameSite=Lax` cookies flow to the WS upgrade); dev uses localhost (same site).
- Verification links use `APP_BASE_URL` (env) to build the absolute URL.
- A user holds at most one active session at a time: a successful login revokes all prior sessions for that account (AC-33). Tabs sharing one cookie share that session; a re-login elsewhere evicts them. This is intentional.
- Multi-tab account play creates one member per connection (one connection = one member); the account identity is shared but membership is per-connection.
- `verified` is a hard gate for account play; unverified users can still browse the menu and resend verification.
- Account member identity is resolved server-side from the cookie; the client never supplies an account id or verified flag.
- A join with `mode: 'account'` and no valid session returns `not_authenticated`; with a valid but unverified session returns `account_unverified`.
- Reconnect resume is token-based for both guests and accounts: a socket drop retains the in-memory member token and the transport sends `rejoin { token }` on the next `hello`; a page reload loses the token and the player creates a new member via `join { mode }` (consistent with guest behavior). The first connection never auto-joins on `hello`.
- Account resume within the grace window never matches by `accountId` alone (multi-tab ambiguity); `join { mode: 'account' }` always creates a new member, and resume is performed only via `rejoin { token }`, with the hub validating that the token's member `accountId` matches the connection's authenticated `userId`.

## Supersessions of accepted behaviors

Predecessor specs are never edited; supersessions are recorded here by AC/term.

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| **vision.md principle** ("no accounts required" / "Instant fun: … no accounts required") | Accounts are forbidden by product principle | Accounts become optional and additive; guest play remains first-class and no account is ever required to play (AC-19, AC-22) | Instant fun (play within seconds), idle-friendly, persistence principles |
| **multiplayer-servers Q-10** (identity vs "no accounts" open tension) | Ephemeral identity is the only identity model | Accounts are an optional identity layer on top of ephemeral guest identity; the tension is resolved (AC-21, AC-23) | Ephemeral guest identity, no persistence of game state |
| **glossary: server member** ("identity is ephemeral … no account") | Member identity is exclusively ephemeral | Member identity is either an account (verified session) or an ephemeral guest; accounts are optional (AC-21, AC-22) | Slot/cube/membership semantics |
| **realtime-backlog.md** open tension "Identity vs. no accounts required" | Unresolved tension | Resolved by this feature (accounts optional) | Other backlog items remain provisional |
| **multiplayer-servers AC-6** (ephemeral identity, no storage) | No cookies/localStorage by the game | Auth adds an `HttpOnly` session cookie (AC-16) for account identity; game still writes nothing to `localStorage`/`sessionStorage` | Ephemeral guest token stays in memory only |

## Review findings (r1) — disposition

| ID | Severity | Disposition | What changed |
| --- | --- | --- | --- |
| F1 | BLOCKER | Fixed | Plan § Architecture defines account member lifecycle (`Connection.accountSession`, `Member.accountId`, account resume, multi-tab, post-grace re-join); AC-21/AC-25. |
| F2 | BLOCKER | Fixed | Transport no longer auto-joins on `hello`; `transport.join(mode)` exposed and called after an explicit menu choice (T16); plan § Frontend data flow. |
| F3 | BLOCKER | Fixed | Frontend protocol mirror (`src/frontend/src/multiplayer/protocol.ts`) added to T11 `files_owned` with parity tests. |
| F4 | MAJOR | Fixed | `@fastify/cookie` added to dependency list and T1 (approval-gated). |
| F5 | MAJOR | Fixed | `SessionRepository.touch(id, ttlMs)` added to interface/impls and T5; sliding expiry in routes (T10). |
| F6 | MAJOR | Fixed | AC-25 rewritten: within-grace full resume vs. post-grace new member with same account identity. |
| F7 | MAJOR | Fixed | Single-session made explicit and intentional with AC-33; assumption updated. |
| F8 | MAJOR | Open (approval) | Q-1, Q-2, Q-3, Q-6 marked BLOCKING; proposed defaults require user approval before T1/T3/T7/T17. |
| F9 | MAJOR | Fixed | Composition order specified; separate `AuthConfig` (`auth/config.ts`); T1/T11 updated. |
| F10 | MAJOR | Fixed | `VerifyEmail` component + route handling added (T14/T15); AC-5 evidence updated. |
| F11 | MAJOR | Fixed | AC-17 added to T_final (and final gate grep). |
| F12 | MAJOR | Fixed | T17 marked approval-gated before execution. |
| F13 | MAJOR | Fixed | T18 marked approval-gated before editing `vision.md`. |
| F14 | MAJOR | Fixed | Mode resolution specified via deferred `transport.join(mode)` and server-side validation. |
| F15 | MAJOR | Fixed | Rate limiter `allow(key, limit, windowMs)` keying specified; tests per-key. |
| F16 | MAJOR | Fixed | Q-12/AC-19 clarify skip advances cinematic only and does not select a mode or dismiss the menu. |
| F17 | MAJOR | Fixed | `not_authenticated` (no session) vs. `account_unverified` (unverified session) semantics defined; AC-4/AC-24 and tests. |
| F18 | MAJOR | Fixed | Schema reconciled: functional unique indexes only; raw `UNIQUE` removed. |
| F19 | MAJOR | Fixed (accepted trade-off) | Registration enumeration via `409` documented as accepted in Security considerations. |
| F20 | MAJOR | Fixed | T17 sequenced before T19/T20; T19 depends on T17. |
| F21 | MAJOR | Fixed | Logging hygiene specified in Security considerations and AC-12; final gate grep. |

MINOR/INFO items from r1 are folded in where noted (AuthConfig separation, rate-limiter keying docs, `not_authenticated` semantics, uniqueness reconciliation, verification link handling, intro skip/menu, logging policy) or remain as backlog in § Open questions (Q-4, Q-5, Q-7, Q-8, Q-9, Q-10, Q-11, Q-12).

## Review findings (r2) — disposition

| ID | Severity | Disposition | What changed |
| --- | --- | --- | --- |
| F22 | MAJOR | Fixed | Reconnect under deferred join specified: transport retains `lastMode` and `token`; on a subsequent `hello` it sends `rejoin { token }` when a token exists else `join { mode: lastMode }`; first connection sends nothing until `transport.join(mode)`. New AC-34; transport tests. |
| F23 | MAJOR | Fixed | Account resume selection defined as token-based `rejoin { token }` (same as guests); hub validates token maps to an account member whose `accountId` matches the cookie's `userId` (else `resume_failed`); `join { mode: 'account' }` always creates a new member. New AC-35; hub/transport tests. |
| F24 | MINOR | Fixed (note) | T11 and T14 recorded as large; builder may split and record in build log; tasks.md notes added. |
| F25 | MINOR | Fixed | WS protocol type definitions (`mode` on `join`, `identity` on `welcome`/`worldEntered`, `account_unverified`/`not_authenticated` error codes) added to plan.md § Interfaces and T11 notes; parity tests. |
| F26 | INFO | Open (approval) | Blocking dependency/service decisions Q-1/Q-2/Q-3/Q-6 and approval gates T17/T18 remain pending user approval (recorded in build log). |
| F27 | MINOR | Fixed | `game/config.ts` and its test removed from T1 `files_owned`; GameConfig stays untouched (AuthConfig is separate). |

## Revision history

- r1 — 2026-10-25 — initial draft (planning phase).
- r2 — 2026-10-25 — spec review r1: account vs. guest member lifecycle clarified; deferred join; frontend protocol mirror ownership; `@fastify/cookie` dependency; sliding session `touch`; resume semantics; single-session made explicit (AC-33); dependency/service decisions marked blocking; composition/AuthConfig; verification-token consumption UI; AC-17 mapping; approval gates for T17/T18; join-mode resolution; rate-limiter keying; intro-skip/menu clarification; `not_authenticated` semantics; case-insensitive uniqueness reconciliation; registration enumeration accepted trade-off; container sequencing; logging policy.
- r3 — 2026-10-25 — spec review r2: reconnect-resume mechanism under deferred join (AC-34); multi-tab account resume selection via token-based rejoin (AC-35); protocol type definitions (F25); T1 files_owned clarification (F27); T11/T14 sizing note (F24).