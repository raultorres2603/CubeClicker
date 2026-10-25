---
feature: user-authentication
phase: code
iteration: 2
verdict: changes_requested
blocking: 1
nonblocking: 1
---

# Code Review — r2

## Summary

❌ changes requested — Verification suite passes (lint 0, typecheck 0, tests 492 backend + 728 frontend, coverage backend 94.66/84.32/99.60/94.66 and frontend 92.62/92.36/92.91/92.62, build 0, smoke 12/12). One new MAJOR (F12): four banned-matcher occurrences remain in `src/frontend/src/auth/store.test.ts` without justification. All r1 findings F1–F5, F8–F11 are fixed; F6 and F7 are waived (deferred decision documented). Verdict is changes_requested.

## Previous-round verification (r1 → r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1, MAJOR) | fixed | store.test.ts banned matchers replaced with concrete fetch args |
| F2 (r1, MAJOR) | fixed | email.test.ts `toBeInstanceOf(SmtpEmailService)` |
| F3 (r1, MAJOR) | fixed | auth-service.test.ts `createAuthService works` now registers and asserts username |
| F4 (r1, MAJOR) | fixed | migrate.test.ts `expect(init?.name).toBe('001_init.sql')` |
| F5 (r1, MAJOR) | fixed | auth-routes.test.ts cookie hex pattern + Retry-After '900' |
| F6 (r1, MINOR) | waived (deferred) | build-log-codefix.md; UI file-level coverage <80% but workspace aggregate 92.62 ≥80% |
| F7 (r1, MINOR) | waived (decision) | auth-routes.ts comment documents missing-Origin allowed |
| F8 (r1, MINOR) | fixed | compose.yaml mailpit pinned v1.32.0 |
| F9 (r1, MINOR) | fixed | user-repository.ts atomic UPDATE ... RETURNING |
| F10 (r1, MINOR) | fixed | makeId throws without crypto.randomUUID |
| F11 (r1, MAJOR) | fixed | protocol.ts both sides identity required |

## New finding (r2)

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F12 | MAJOR | src/frontend/src/auth/store.test.ts:385-386, 405, 423 | New tests still use banned matchers without justification: `expect(defaultStore).toBeDefined()` / `expect(authStore).toBeDefined()` (weak existentials) and two unchecked `expect(fetchMock).toHaveBeenCalled()` (argument-unchecked spy calls). | Replace with concrete assertions (e.g. `expect(defaultStore).toHaveProperty('getSnapshot')`, or remove redundant `toHaveBeenCalled()` given the status assertion) OR add a reviewer-approved in-test exception comment. | open |

## Acceptance verification
All AC-1..AC-35 met per r1 (unchanged by codefix); re-verified via tests (492 backend + 728 frontend) + smoke 12/12. AC-12 logging + AC-17 bundle-secret greps clean. AC-32 coverage met both workspaces.

## Verification performed
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (backend + frontend)
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 34 files / 728 tests)
- `npm run coverage` → exit 0 (backend 94.66% / 84.32% / 99.60% / 94.66%; frontend 92.62 / 92.36 / 92.91 / 92.62)
- `npm run build` → exit 0 (frontend dist 807.52 kB)
- `npm run smoke` → exit 0 (12/12 checks)
- AC-17 bundle-secret grep → exit 1 (no matches)
- AC-12 logging grep → only src/backend/src/server.ts:19 + server.ts:28
- Banned-matcher grep → 10 occurrences; 4 in NEW tests (store.test.ts) unaddressed; 6 pre-existing

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | SQL parameterized; secrets via env; cookies HttpOnly/SameSite; CSRF Origin mismatch →403 (missing Origin allowed by documented decision); image pinned |
| Quality | ✅ | Pure logic separated; single connection owner; deferred join; server authority; container contract met |
| Testing | ❌ | 4 banned-matcher occurrences remain in new tests (F12) without justification |

## Notes / backlog
- F6 deferred (UI file-level coverage <80%, aggregate passes) and F7 decision documented — both confirmed as requested.
- Pre-existing banned matchers in hub.test.ts, webgl.test.ts, browser-env.test.ts are out of scope.
- Wishlist items (OAuth, MFA, passkeys, password reset, roles, leaderboards, account deletion) remain non-goals.
