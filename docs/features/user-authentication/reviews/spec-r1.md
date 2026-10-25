---
feature: user-authentication
phase: spec
iteration: 1
verdict: changes_requested
blocking: 21
nonblocking: 9
---

# Spec Review — r1

## Summary

❌ changes requested — The spec/plan/tasks are thorough and well-structured, but several real-time identity gaps (account vs. ephemeral guest in the hub, deferred join vs. the intro menu) are guaranteed mid-build dead ends, the frontend protocol mirror and verification-token consumption have no owning task, and a cookie-parsing dependency plus sliding-session and composition wiring are unspecified. Dependency/service decisions (Q-1, Q-2, Q-3, Q-6) and user-owned file edits (vision.md, compose files) still need explicit approval before build.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | spec.md § Real-time / online (AC-21, AC-23, AC-25); plan.md § Data flow (WS), § Interfaces (Repository/protocol) | Account identity integration with the multiplayer hub is underspecified. The plan says `hub.attach(peer, accountId)` and `join { mode }`, but never defines how an account member is created vs. resumed, how `accountId` maps to the hub's ephemeral `playerId`/slot/grace/move-plan model, or how display name becomes the username. The current hub manages members by `p<N>` with in-memory tokens and grace windows; accounts are cookie-based and stable. Without this, account play cannot be implemented. | Add a protocol/state section specifying the account member lifecycle: `accountId` carried on `Connection` and `Member` (null for guests), resume-by-account within grace, display name = username, stable identity across reconnects, and the guest path unchanged. Required before build. | open |
| F2 | BLOCKER | plan.md § Frontend data flow; spec.md AC-18, AC-19, AC-23; transport.ts (existing) | The transport auto-sends `join` on the first `hello`, but the intro menu requires the join mode to be chosen *after* hello (Login / Register / Play as guest). Auto-joining before the choice either locks the user into the wrong identity or requires a forbidden second `join` (→ `bad_message`). | Redefine the transport handshake to defer `join` until the session explicitly requests it with a mode; expose a `join(mode)` method on `Transport`; update session.ts and the transport tests. | open |
| F3 | BLOCKER | tasks.md (no task owns `src/frontend/src/multiplayer/protocol.ts`) | The frontend's mirrored protocol (`join` mode, `identity` on welcome/worldEntered, `account_unverified`/`not_authenticated` error codes) has no owning task, yet T11 is backend-only. The frontend protocol will not be updated, breaking codec parity and the frontend build. | Assign ownership (extend T11 to include the frontend mirror, or add a task) and add parity tests against the backend fixtures. | open |
| F4 | MAJOR | plan.md § File inventory (`src/backend/package.json`) | `@fastify/cookie` (needed to read the session cookie on HTTP requests and on the WS upgrade) is missing from the proposed dependency list; only `argon2`/`pg`/`nodemailer`/types are listed. Cookie-based auth cannot be implemented without it. | Add `@fastify/cookie` to the dependency list and to T1; flag for user approval (⚠️ Ask first). | open |
| F5 | MAJOR | plan.md § Interfaces (SessionRepository) | AC-16 requires a 7-day *sliding* expiry, but `SessionRepository` has no `touch`/`refreshExpiry` method, so sliding expiry cannot be implemented or tested. | Add a `touch(id, ttlMs)` (or `refreshExpiry`) method to the interface and both impls; cover in `session-repository.test.ts`. | open |
| F6 | MAJOR | spec.md AC-25; plan.md § Real-time impact | "Reconnecting within the grace window (or a new connection carrying the valid cookie) resumes the same account identity and cube state" conflates two cases: within grace the full cube state survives, but after grace the member was removed and the cube state is gone. The wording promises cube-state resume outside grace. | Clarify: within grace = full resume (identity + cube state); outside grace = new member with the same account identity (new cube/slot), subject to the normal join path. | open |
| F7 | MAJOR | spec.md § Assumptions | "A user may hold at most one active session per login (new login revokes prior sessions)" is listed as proposed/open. This conflicts with multi-tab account play (two tabs share one cookie/session; a re-login logs out every tab) and is unresolved, yet it drives login/logout behavior. | Resolve before build: either allow multiple concurrent sessions or document the single-session eviction explicitly as intended and add an AC. | open |
| F8 | MAJOR | spec.md § Open questions (Q-1, Q-2, Q-3, Q-6) | Four blocking dependency/service decisions (DB engine, email provider, Argon2 package, migration tooling) are left open. The build cannot start (T1, T3, T7, T17 depend on them) until they are resolved. | User approves the proposed defaults (Postgres 16, pluggable SMTP + Mailpit, `@node-rs/argon2`, in-repo SQL runner) or alternatives before build; record in spec revision. | open |
| F9 | MAJOR | plan.md § Architecture (backend); plan.md § File inventory (`app.ts` edit) | Composition is unspecified: `buildApp` currently takes only `env` + options and builds the hub from config. The auth layer needs a DB pool, repositories, an auth service, cookie parsing, and WS-upgrade session resolution, but none of this wiring is described, and `GameConfig` (consumed by the hub) is the wrong home for DB/SMTP config. | Specify composition order (config → pool → migrate → repositories → auth service → routes → hub with a session resolver), and define a separate `AuthConfig` (or clearly extend `GameConfig`) for DB/email/session env vars. | open |
| F10 | MAJOR | plan.md § Frontend file inventory; spec.md AC-5 | There is no frontend component/route to consume the verification token from the email link (`POST /auth/verify`). `VerificationPending` only handles resend. The activation flow is incomplete. | Add a verify screen (or query-param handling in `App.tsx`) that extracts the token and calls `POST /auth/verify`, with tests; add to the file inventory and a task (T14 or T15). | open |
| F11 | MAJOR | tasks.md | AC-17 ("no secrets in the bundle") is not mapped to any task's acceptance list, so it will not be verified per-task. | Add AC-17 to T_final (and optionally T1) acceptance and verify with `npm run build` + grep at the final gate. | open |
| F12 | MAJOR | tasks.md T17 | T17 edits `compose.yaml`, `compose.smoke.yaml`, and `README.md`, which AGENTS.md flags "⚠️ Ask first" (especially compose files). The task is scheduled without explicit user approval. | Obtain user approval before executing T17; record the approval in the build log. | open |
| F13 | MAJOR | tasks.md T18 | T18 edits `docs/product/vision.md`, which AGENTS.md marks user-owned ("⚠️ Ask first: editing docs/product/vision.md"). It is scheduled as a no-dependency `[P]` task with no approval gate. | Obtain user approval before executing T18; keep predecessor specs unedited (supersession ledger only). | open |
| F14 | MAJOR | spec.md § Real-time / online (AC-24); plan.md § WS protocol changes | The `join` message gains `mode`, but the transport's join is currently automatic on `hello` (F2) and the auth store (T13) is not available to the transport. How the mode is resolved at hello time is unspecified. | Specify a mode resolver/injection (or deferred join per F2) so `join { mode }` is only sent with a deliberate, auth-aware choice. | open |
| F15 | MAJOR | plan.md § Interfaces (rate-limit.ts); spec.md AC-6, AC-14 | The rate limiter is described as a generic token-bucket/fixed-window limiter, but AC-6 needs a per-account resend limit (3/hour) *and* a per-IP limit, and AC-14 needs per-IP per-endpoint limits. The keyed (by IP/account/endpoint) API is unspecified, so the limiter cannot be implemented or tested against the ACs. | Specify the limiter's keying API (e.g., `allow(key, limit, windowMs)`) and add tests for per-key isolation. | open |
| F16 | MAJOR | spec.md § Open questions (Q-12); plan.md § Real-time impact | The intro menu does not pause the cinematic, but it is unspecified what happens to the menu when the intro is skipped (click/any key): does the menu remain, or does the game proceed as a guest? This affects AC-18/AC-19. | Clarify skip vs. menu interaction in the spec (and Q-12) before build. | open |
| F17 | MAJOR | plan.md § WS protocol changes; spec.md AC-26 | The new `not_authenticated` error code is listed but never tied to a trigger (e.g., `join { mode: 'account' }` with no valid session). Its semantics are undefined. | Define when `not_authenticated` is returned (vs. `account_unverified`) and add a test case. | open |
| F18 | MAJOR | plan.md § DB schema (PostgreSQL) | Username/email uniqueness is described as case-insensitive via functional unique indexes, but the schema snippet declares `UNIQUE` on the raw column. The two statements conflict on whether `Alice` and `alice` collide. | Reconcile: remove the raw `UNIQUE` constraints and rely on the functional indexes on `lower(username)`/`lower(email)`, or document why both are kept. | open |
| F19 | MAJOR | spec.md § Security considerations (enumeration) | Registration returns `409` for a duplicate username/email, which is an enumeration vector; the spec's enumeration-resistance statement covers only login and resend-verification. Either accept this explicitly or change registration to always `202`. | State explicitly in the security section that registration enumeration via `409` is an accepted trade-off (or redesign to `202`), so the behavior is intentional and tested. | open |
| F20 | MAJOR | plan.md § Architecture (backend); spec.md § Testing strategy | The `pg`/`nodemailer` adapters and the migration runner must run against a real DB in CI to satisfy AC-30 and the optional real-Postgres suite, but the compose `db` service and `DATABASE_URL` are only added by T17. Until T17 lands, AC-30 cannot be exercised in containers. | Sequence T17 before T19/T20 in practice and ensure the smoke test (T20) runs migrations against the compose `db`; document the gated test env var. | open |
| F21 | MAJOR | spec.md § Security considerations (logging) | AC-12 forbids writing the password hash / session / verification tokens to logs, but no logging policy is specified (Fastify's default request logger logs URLs; error handlers may log request bodies). | Specify that request bodies and auth headers are never logged, and add a grep/assertion check at the final gate. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All requested capabilities (accounts, registration + email activation, password hashing, guest play, intro menu, dockerized DB + email, WS auth) are covered by ACs; non-goals listed. |
| Testability | ❌ | Most ACs are binary-testable, but AC-25 (resume outside grace) and AC-18 (skip vs. menu) are ambiguous; F6, F16. |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ❌ | Acyclic, but AC-17 unmapped (F11) and frontend protocol mirror unowned (F3); T17/T18 need approval gates (F12, F13). |
| Parallel safety | ✅ | The four `[P]` tasks (T2, T7, T8, T18) have disjoint `files_owned`. |
| Security | ❌ | Cookie dependency missing (F4); enumeration trade-off undocumented (F19); logging policy missing (F21); sliding expiry unimplemented (F5). |
| Testing | ✅ | Strategy present with unit + integration tiers; `npm run coverage` with ≥ 80% thresholds named; assertion bar referenced. |
| Consistency | ❌ | Conflicts with decided stack/compose conventions on user-owned files (F12, F13) and with multiplayer's ephemeral-identity model (F1). |
| Real-time | ❌ | Account vs. guest identity in the hub (F1), deferred join vs. intro menu (F2), resume semantics (F6), and single-session assumption (F7) are unresolved. |
| Containers | ❌ | DB/email services and compose edits are specified but gated on user approval (F8, F12); secrets-via-env and WS endpoint exposure are addressed. |

## Previous round verification (if iteration > 1)

n/a (r1).

## Notes / backlog (non-blocking)

- MINOR — `src/backend/src/game/config.ts` is the planned home for auth/db/email/session env parsing, but `GameConfig` is consumed by the hub; consider a separate `AuthConfig` (F9). 
- MINOR — The rate limiter's per-key API and injectable clock are already implied by T8; ensure the interface is documented (F15).
- MINOR — `not_authenticated` vs. `account_unverified` semantics (F17).
- MINOR — Username/email case-insensitive uniqueness reconciliation (F18).
- MINOR — Verification link handling and `APP_BASE_URL` route (F10).
- MINOR — Intro skip vs. menu dismissal (F16).
- MINOR — Logging policy for auth data (F21).
- INFO — Q-4 (validation library), Q-5 (session store), Q-7 (username policy), Q-8 (auto-login after verify), Q-9 (password reset), Q-10 (CSRF depth), Q-11 (Mailpit), Q-12 (intro UX) are lower-risk open questions; resolve at build time with the proposed defaults.
- INFO — Wishlist items (OAuth, MFA, passkeys, password reset, roles, display names, leaderboards, account deletion) are correctly listed as non-goals.