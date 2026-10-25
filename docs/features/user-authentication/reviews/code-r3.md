---
feature: user-authentication
phase: code
iteration: 3
verdict: approved
blocking: 0
nonblocking: 0
---

# Code Review — r3

## Summary

✅ approved — Final round (build_round 3). F12 is fixed: `src/frontend/src/auth/store.test.ts` now has zero banned-matcher occurrences (weak existentials replaced with `typeof …getSnapshot === 'function'`; argument-unchecked `toHaveBeenCalled()` replaced with concrete `toHaveBeenCalledWith(...)` fetch-arg assertions). Full verification suite re-run independently and passes: lint 0, typecheck 0, tests 492 backend + 728 frontend, coverage backend 94.66/84.32/99.60/94.66 and frontend 92.62/92.36/92.91/92.62, build 0, smoke 12/12. All r1/r2 findings are fixed or waived; no regressions. No new findings.

## Acceptance verification

All AC-1..AC-35 remain met (unchanged by the F12 codefix, which touched only test assertions). Re-verified via the full suite above plus the banned-matcher grep and the AC-12/AC-17 greps recorded below.

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | auth-service.test.ts, user-repository.test.ts; argon2 hash in password.test.ts |
| AC-2 | ✅ | auth-service.test.ts (duplicate username/email → 409) |
| AC-3 | ✅ | auth-service.test.ts (boundary 11/12/128/129) |
| AC-4 | ✅ | hub.test.ts (account_unverified; guest succeeds) |
| AC-5 | ✅ | auth-service.test.ts, verification-token-repository.test.ts, VerifyEmail tests |
| AC-6 | ✅ | auth-service.test.ts, email.test.ts; resend rate-limited 3/hour |
| AC-7 | ✅ | auth-routes.test.ts (200/401/429 + Retry-After) |
| AC-8 | ✅ | auth-service.test.ts (4 failures allowed, 5th locks) |
| AC-9 | ✅ | auth-routes.test.ts (logout clears cookie, /me 401) |
| AC-10 | ✅ | auth-routes.test.ts |
| AC-11 | ✅ | password.test.ts, config.test.ts (OWASP min params) |
| AC-12 | ✅ | logging grep: only server.ts:19 (migration abort) + server.ts:28 (startup banner); no bodies/cookies/tokens (re-run r3) |
| AC-13 | ✅ | parameterized queries in repositories; grep confirmed $1/$2 placeholders |
| AC-14 | ✅ | auth-routes.test.ts with fake timers (5/min register, 10/min login, 3/hour resend) |
| AC-15 | ✅ | mismatched Origin → 403 tested; missing Origin allowed by documented decision (auth-routes.ts comment) |
| AC-16 | ✅ | auth-routes.test.ts (HttpOnly, SameSite=Lax, Path=/, Secure flag, 7-day sliding) |
| AC-17 | ✅ | bundle grep exit 1 (no secrets in src/frontend/dist) (re-run r3) |
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
| AC-28 | ✅ | compose.yaml mailpit service v1.32.0; default SMTP points at mailpit |
| AC-29 | ✅ | no credentials committed; .env* untouched; README documents vars |
| AC-30 | ✅ | migrate.test.ts; server.ts runs migrations before listen; smoke 12/12 |
| AC-31 | ✅ | spec § Supersessions; glossary/vision/realtime-backlog updated; predecessor specs untouched |
| AC-32 | ✅ | coverage both workspaces ≥ 80% (re-run r3; backend 94.66/84.32/99.60/94.66, frontend 92.62/92.36/92.91/92.62) |
| AC-33 | ✅ | auth-service.test.ts, auth-routes.test.ts (revoke prior sessions on login) |
| AC-34 | ✅ | transport.test.ts (deferred join + reconnect rejoin/join) |
| AC-35 | ✅ | hub.test.ts, transport.test.ts (token-based resume, accountId validation) |

## Findings

No new findings. All prior findings are fixed or waived (see Previous round verification below).

## Verification performed

- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`)
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 34 files / 728 tests)
- `npm run coverage` → exit 0 (backend 94.66% stmts / 84.32% branch / 99.60% funcs / 94.66% lines; frontend 92.62 / 92.36 / 92.91 / 92.62)
- `npm run build` → exit 0 (frontend dist 807.52 kB)
- `npm run smoke` → exit 0 (12/12 checks including register→verify→login→guest)
- AC-12 logging grep → only `src/backend/src/server.ts:19` + `server.ts:28`; no bodies/cookies/tokens/hashes
- AC-17 bundle-secret grep → exit 1 (no matches in src/frontend/dist)
- F12 banned-matcher grep on `src/frontend/src/auth/store.test.ts` → 0 occurrences of `toHaveBeenCalled()` / `toBeDefined()` / `expect.any` / `*Containing` / `toMatchObject` / `toBeTruthy()` / `not.toThrow()`
- Project-wide banned-matcher grep → 6 occurrences total, all pre-existing and out of scope (`src/frontend/src/render/webgl.test.ts:91`, `src/frontend/src/browser-env.test.ts:203,223,313`, `src/backend/src/game/hub.test.ts:1407,1435`); zero in new/changed auth tests
- Coverage exclusions inspected: test files + one composition-root entrypoint per workspace (`server.ts`, `main.tsx`) only; `all: true`; no production logic excluded; thresholds unchanged at 80 on all four metrics

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | SQL parameterized; secrets via env; cookies HttpOnly/SameSite; CSRF Origin mismatch → 403 (missing Origin allowed by documented decision); image pinned v1.32.0; makeId requires crypto.randomUUID; atomic failed-login increment |
| Quality | ✅ | Pure logic separated; single connection owner; deferred join; server authority; container contract met (db + mailpit, healthchecks, env config) |
| Testing | ✅ | F12 fixed: banned matchers cleared from store.test.ts; banned-matcher grep clean on new tests; coverage thresholds met both workspaces; no assertion-free/snapshot-only tests in new/changed tests |

## Previous round verification (r1/r2 → r3)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1, MAJOR) | fixed | store.test.ts banned matchers replaced with concrete fetch args (r2) |
| F2 (r1, MAJOR) | fixed | email.test.ts `toBeInstanceOf(SmtpEmailService)` |
| F3 (r1, MAJOR) | fixed | auth-service.test.ts `createAuthService works` now registers and asserts username |
| F4 (r1, MAJOR) | fixed | migrate.test.ts `expect(init?.name).toBe('001_init.sql')` |
| F5 (r1, MAJOR) | fixed | auth-routes.test.ts cookie hex pattern + Retry-After '900' |
| F6 (r1, MINOR) | waived (deferred) | UI file-level coverage <80% but workspace aggregate 92.62 ≥80%; documented in build log |
| F7 (r1, MINOR) | waived (decision) | auth-routes.ts comment documents missing-Origin allowed |
| F8 (r1, MINOR) | fixed | compose.yaml mailpit pinned v1.32.0 |
| F9 (r1, MINOR) | fixed | user-repository.ts atomic UPDATE ... RETURNING |
| F10 (r1, MINOR) | fixed | makeId throws without crypto.randomUUID |
| F11 (r1, MAJOR) | fixed | protocol.ts both sides identity required |
| F12 (r2, MAJOR) | fixed | store.test.ts: 4 banned matchers replaced (weak existentials → `typeof …getSnapshot === 'function'`; `toHaveBeenCalled()` → `toHaveBeenCalledWith` with concrete URL/method/credentials/headers); banned-matcher grep on store.test.ts = 0 (re-run r3); full suite green |

## Notes / backlog (non-blocking)

- F6 and F7 remain waived per documented decisions (deferred UI file-level coverage; missing-Origin allowed). No action required.
- Pre-existing banned matchers in hub.test.ts, webgl.test.ts, browser-env.test.ts are out of scope (unchanged by this feature's diff).
- Wishlist items (OAuth, MFA, passkeys, password reset, roles, leaderboards, account deletion) remain non-goals.
- Q-4..Q-12 open questions resolved at build time with proposed defaults (per status.md).