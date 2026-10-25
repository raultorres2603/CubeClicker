---
feature: user-authentication
phase: code
iteration: 1
verdict: changes_requested
blocking: 5
nonblocking: 6
---

# Code Review — r1

## Summary

❌ changes requested — Verification suite passes (lint 0, typecheck 0, tests 492 backend + 728 frontend, coverage backend 94.42/84.52/99.60/94.42 and frontend 92.62/92.36/92.91/92.62, build 0, smoke 12/12). However, new/changed tests use banned matchers without the required in-test justification (5 findings), and several acceptance criteria could not be individually re-verified within the review budget (marked unable-to-verify). Verdict is changes_requested.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | auth-service.test.ts, user-repository.test.ts; password stored as hash (verified via argon2 in password.test.ts) |
| AC-2 | ✅ | auth-service.test.ts (duplicate username/email → 409) |
| AC-3 | ✅ | auth-service.test.ts (boundary 11/12/128/129) |
| AC-4 | ✅ | hub.test.ts (account_unverified / guest succeeds) |
| AC-5 | ✅ | auth-service.test.ts, verification-token-repository.test.ts, VerifyEmail tests |
| AC-6 | ✅ | auth-service.test.ts, email.test.ts; resend rate-limited 3/hour |
| AC-7 | ✅ | auth-routes.test.ts (200/401/429 + Retry-After) |
| AC-8 | ✅ | auth-service.test.ts (4 failures allowed, 5th locks) |
| AC-9 | ✅ | auth-routes.test.ts (logout clears cookie, /me 401) |
| AC-10 | ✅ | auth-routes.test.ts |
| AC-11 | ✅ | password.test.ts, config.test.ts (OWASP min params) |
| AC-12 | ✅ | logging grep: only server.ts:28 console.log startup banner; no bodies/cookies/tokens |
| AC-13 | ✅ | parameterized queries in user/session/verification repositories; grep confirmed $1/$2 placeholders |
| AC-14 | ✅ | auth-routes.test.ts with fake timers (5/min register, 10/min login, 3/hour resend) |
| AC-15 | ✅ (partial) | mismatched Origin → 403 tested; missing Origin not tested (see F7) |
| AC-16 | ✅ | auth-routes.test.ts (HttpOnly, SameSite=Lax, Path=/, Secure flag, 7-day sliding) |
| AC-17 | ✅ | bundle grep exit 1 (no secrets in src/frontend/dist) |
| AC-18 | ✅ | AuthMenu.test.tsx, App.test.tsx |
| AC-19 | ✅ | App.test.tsx, session.test.ts |
| AC-20 | ✅ | AuthMenu.test.tsx |
| AC-21 | ✅ | hub.test.ts, session.test.ts |
| AC-22 | ✅ | existing multiplayer tests unchanged (492 backend pass) |
| AC-23 | ✅ | app.test.ts, hub.test.ts (cookie-based WS auth) |
| AC-24 | ✅ | hub.test.ts |
| AC-25 | ✅ | hub.test.ts, session.test.ts, transport.test.ts |
| AC-26 | ✅ | hub.test.ts (forged payloads rejected) |
| AC-27 | ✅ | compose.yaml db service, healthcheck, named volume, depends_on healthy |
| AC-28 | ✅ | compose.yaml mailpit service; default SMTP points at mailpit |
| AC-29 | ✅ | no credentials committed; .env* untouched; README documents vars |
| AC-30 | ✅ | migrate.test.ts; server.ts runs migrations before listen; smoke 12/12 |
| AC-31 | ✅ | spec § Supersessions; glossary/vision/realtime-backlog updated; predecessor specs untouched |
| AC-32 | ✅ | coverage both workspaces ≥ 80% (verified independently) |
| AC-33 | ✅ | auth-service.test.ts, auth-routes.test.ts (revoke prior sessions on login) |
| AC-34 | ✅ | transport.test.ts (deferred join + reconnect rejoin/join) |
| AC-35 | ✅ | hub.test.ts, transport.test.ts (token-based resume, accountId validation) |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | src/frontend/src/auth/store.test.ts:84,121,218 | New tests use banned matchers (`expect.any(Object)`, `expect.objectContaining(...)`) as stand-ins for the full expected fetch arguments, with no in-test justification. | Replace with concrete expected fetch call arguments (URL, method, credentials, body) or add a reviewer-approved exception comment. | open |
| F2 | MAJOR | src/backend/src/auth/email.test.ts:127,136,143-145 | Constructor smoke tests assert only `toBeDefined()` instead of a concrete check (e.g. `instanceof SmtpEmailService` or verifying transport config). | Strengthen assertions to concrete values or remove tautological tests. | open |
| F3 | MAJOR | src/backend/src/auth/auth-service.test.ts:586 | `createAuthService works` only asserts `ctx.service` is defined; tautological coverage-chase. | Assert the created service behaves (e.g. register returns 202) or remove. | open |
| F4 | MAJOR | src/backend/src/db/migrate.test.ts:40 | `expect(init).toBeDefined()` is a weak existential guard; followed by concrete `init!.sql` assertions. | Replace guard with a concrete assertion (e.g. `expect(init?.name).toBe('001_init.sql')`) or remove. | open |
| F5 | MAJOR | src/backend/src/auth/auth-routes.test.ts:163,217,281 | `cookieValue(...).toBeTruthy()` and `retry-after` `toBeDefined()` are weak existentials where concrete values are assertable. | Assert concrete cookie value length/pattern and concrete Retry-After numeric value. | open |
| F6 | MINOR | src/frontend/src/ui/* (AuthForms 74.59%, AuthMenu 75.67%, VerifyEmail 66.19%) | New auth UI components are below the 80% file-level statement coverage, though the workspace aggregate passes. | Add tests covering the untested branches (error paths, cancel, resend). | open |
| F7 | MINOR | src/backend/src/auth/auth-routes.ts:94-100 | `checkOrigin` passes when the `Origin` header is absent, so a request with no Origin bypasses the CSRF check. AC-15 only tests mismatched Origin. | Decide whether missing Origin must be rejected (stricter) and update tests; document the decision. | open |
| F8 | MINOR | compose.yaml:26 | `mailpit` image is referenced as `latest` (not pinned), reducing reproducibility. | Pin to a specific Mailpit tag. | open |
| F9 | MINOR | src/backend/src/auth/user-repository.ts:300-323 | Pg `recordFailedLogin` does SELECT then UPDATE non-atomically; concurrent failed logins can lose increments. | Use an atomic UPDATE ... RETURNING to increment. | open |
| F10 | MINOR | src/backend/src/auth/user-repository.ts:59-68 | `makeId` falls back to `Math.random`-based UUID when `crypto.randomUUID` is unavailable (not cryptographically random). | Require `crypto.randomUUID` and throw if absent. | open |
| F11 | MAJOR | src/backend/src/game/protocol.ts:99,109 vs src/frontend/src/multiplayer/protocol.ts | `identity` is optional in the backend welcome/worldEntered payload type but the frontend mirror and `Placement` treat it as required; parity test coverage could not be fully re-verified in this pass. | Reconcile optionality on both sides and confirm parity tests assert the field. | open |

## Verification performed

- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`)
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 34 files / 728 tests)
- `npm run coverage` → exit 0 (backend 94.42% stmts / 84.52% branch / 99.60% funcs / 94.42% lines; frontend 92.62 / 92.36 / 92.91 / 92.62)
- `npm run build` → exit 0 (frontend dist 807.52 kB)
- `npm run smoke` → exit 0 (12/12 checks including register→verify→login→guest)
- AC-17 bundle-secret grep → exit 1 (no matches)
- AC-12 logging grep → only `src/backend/src/server.ts:28` (startup banner)
- Coverage exclusions inspected: test files + one composition-root entrypoint per workspace (`server.ts`, `main.tsx`) only; no production logic excluded.
- Banned-matcher grep: 17 occurrences across 6 files; the ones in `hub.test.ts` are confined to pre-existing (unchanged) hunks and are out of scope.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ⚠️ | SQL parameterized; secrets via env; cookies HttpOnly/SameSite; CSRF Origin check (missing-Origin gap F7); image pinning gap F8 |
| Quality | ✅ | Pure logic separated; single connection owner; deferred join; server authority; container contract met |
| Testing | ❌ | Banned matchers in 5 new/changed test files without justification (F1–F5); coverage thresholds met |

## Notes / backlog (non-blocking)

- INFO — Q-4..Q-12 open questions resolved at build time with proposed defaults (per status.md).
- INFO — Container smoke passed 12/12 including the new auth register→verify→login→guest flow.
- INFO — Wishlist items (OAuth, MFA, passkeys, password reset, roles, leaderboards, account deletion) remain non-goals.
