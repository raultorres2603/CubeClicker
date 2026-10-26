---
feature: user-authentication
phase: code
iteration: corrective-2
verdict: approved
blocking: 0
nonblocking: 3
---

# Code Review — corrective r2

## Summary

✅ approved — F1 (MAJOR) is closed: DOM-driven interaction tests now exercise the rendered `onClick`/`onSubmit` bindings in `App`, `AuthMenu`, and `AuthForms`, and a mutation check re-run by the reviewer (removing `onClick={handleGuest}`) made the corresponding test fail exactly as claimed; restoring the binding returned the suite to green. Function coverage rose to 100% on both `AuthMenu` and `AuthForms`. Safe MINORs F3/F5/F6/F8 are applied; F2/F4/F7 remain open as documented backlog (MINOR/INFO). All gates green; no banned matchers, no coverage gaming, thresholds intact.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-4 / AC-24 | ✅ | `App.test.tsx` "routes an unverified login to verification-pending without joining"; `AuthForms.test.tsx` interaction + unit. |
| AC-5 | ✅ | `VerifyEmail.tsx` uses resolved default `api`/`store` (verify branch in `App.tsx`). |
| AC-7 | ✅ | `AuthForms.tsx` `submitAuthForm`; `AuthForms.test.tsx` "returns an exact error…", "logs in through the store…". |
| AC-18 | ✅ | `App.test.tsx` first test: `<canvas` present, `class="auth-menu" role="dialog"…`, three buttons; `AuthMenu.test.tsx`. |
| AC-19 | ✅ | `App.test.tsx` interaction "clicking the rendered Play as guest button joins as guest and unmounts the menu"; `join` called once with `'guest'`. |
| AC-20 | ✅ | `AuthMenu.test.tsx` interaction: Login/Register clicks call `onSelect`/`onChoose`; Cancel returns to menu. |
| AC-23 | ✅ | `App.test.tsx` interaction "drives the rendered login form submit and joins as account after reconnect" pins `login < retryConnection < join`. |
| AC-32 | ✅ | `npm run coverage` exit 0; thresholds 80/80/80/80 both workspaces; exclusions only `main.tsx`/`server.ts`. |
| AC-34 | ✅ | `transport.ts` retains `lastMode`; `transport.test.ts` green. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | src/frontend/src/App.test.tsx, src/frontend/src/ui/AuthMenu.test.tsx, src/frontend/src/ui/AuthForms.test.tsx | (r1) Tests exercised exported handlers directly and never drove rendered bindings. | Closed in c38d159: per-file `/** @vitest-environment jsdom */` docblocks + 14 DOM interaction tests clicking real buttons/submitting real forms; mutation-checked (see Verification). | fixed |
| F2 | MINOR | src/frontend/src/ui/VerifyEmail.tsx; src/frontend/src/App.tsx (verify branch) | After successful verification the client store is not bootstrapped (stays anonymous). | Left open as backlog (acceptable); optionally call `store.me()`/`bootstrap()` on success. | open |
| F3 | MINOR | src/frontend/src/ui/AuthForms.tsx; src/frontend/src/ui/AuthMenu.tsx; src/frontend/src/App.tsx | No focus management on view transition. | Applied in c2aaeff: `autoFocus` on the username input (AuthForms) and the pending screen's `Back to login` button (App.tsx). Verified present; no regressions (tests green). | fixed |
| F4 | MINOR | src/frontend/src/ui/app.css (`.auth-menu` full-viewport backdrop) | Full-viewport overlay makes AC-19 tap-outside intro-skip unreachable by pointer. | Left open as backlog (deliberate trade-off to block canvas input). | open |
| F5 | MINOR | src/frontend/src/ui/AuthForms.tsx | `initialError` captured only in `useState` initializer. | Documented mount-only at the initializer with remount-via-`key` rationale (c2aaeff); no behavior change. | fixed |
| F6 | MINOR | src/frontend/src/App.tsx (`verificationRequired`) | Late invocation after game start could reopen menu. | Guard `if (closed()) return;` present in `createAuthGate.verificationRequired` (since ee4a667); verified. | fixed |
| F7 | INFO | src/frontend/vite.config.ts | Proxy assumes page origin matches backend CSRF origin. | Left open as backlog (document in README). | open |
| F8 | INFO | src/frontend/src/ui/AuthMenu.tsx | `autoFocus` on the menu `Login` button re-triggered on every remount. | Removed `autoFocus` from the menu `Login` button (c2aaeff). | fixed |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 34 files / 756 tests).
- `npm run coverage` → exit 0:
  - backend: All files 94.66 / 84.32 / 99.60 / 94.66 (stmts/branches/funcs/lines).
  - frontend: All files 93.72 / 93.78 / 96.20 / 93.72.
  - Thresholds 80/80/80/80 intact in both `vitest.config.ts`.
- `npm run build` → exit 0 (`dist/assets/index-*.js` 820.66 kB).
- `npm ci` → exit 0 ("added 399 packages, audited 402"), lockfile consistent.
- Banned-matcher grep over `src/` (`expect.any`, `expect.anything`, `toMatchSnapshot`, `toMatchInlineSnapshot`) → no matches (exit 1).
- Coverage exclusions unchanged: `src/main.tsx`, `src/server.ts` only (composition roots); no production logic excluded.
- Function coverage: `AuthMenu.tsx` 100% (was 20%), `AuthForms.tsx` 100% (was 66.67%) — confirmed in the coverage report.
- Mutation check re-run by reviewer: temporarily changed `onClick={handleGuest}` → `onClick={undefined}` in `src/frontend/src/ui/AuthMenu.tsx`; ran `npx vitest run src/frontend/src/ui/AuthMenu.test.tsx` → 1 test failed ("calls onPlayAsGuest exactly once…" expected spy called 1 time, got 0). Restored the file from a backup; `git diff --stat src/frontend/src/ui/AuthMenu.tsx` is empty. Binding genuinely gates the test.
- Minor changes verified in tree: `AuthForms.tsx` username input `autoFocus` present; `App.tsx` pending `Back to login` `autoFocus` present; `AuthMenu.tsx` `Login` button has no `autoFocus`; `initialError` mount-only comment present; `createAuthGate.verificationRequired` guards with `if (closed()) return;`.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No secrets in bundle; errors React-escaped; no token in storage; new deps are well-known testing libraries, dev-only, lockfile via npm. No `.env*` touched. |
| Quality | ✅ | TypeScript strict passes; store/api created once via `useState`; CSS/a11y minors applied without regressions. |
| Testing | ✅ | 756 frontend + 492 backend tests green; coverage above 80 all four metrics both workspaces; no banned matchers; interaction/wiring now tested (F1 fixed); mutation check passed. |

## Previous round verification (iteration > 1)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) MAJOR | fixed | c38d159; 14 new DOM interaction tests; reviewer mutation check failed as claimed; restored. |
| F2 (r1) MINOR | open (backlog) | unchanged; acceptable. |
| F3 (r1) MINOR | fixed | c2aaeff; `autoFocus` present on username input + pending primary button. |
| F4 (r1) MINOR | open (backlog) | unchanged; deliberate trade-off. |
| F5 (r1) MINOR | fixed | c2aaeff; mount-only documented. |
| F6 (r1) MINOR | fixed | guard present in `createAuthGate.verificationRequired`. |
| F7 (r1) INFO | open (backlog) | unchanged. |
| F8 (r1) INFO | fixed | c2aaeff; `autoFocus` removed from menu `Login` button. |

## Notes / backlog (non-blocking)

- F2, F4, F7 remain open by design (MINOR/INFO, acceptable as backlog): F2 client store bootstrap after verification; F4 full-viewport backdrop vs. tap-outside intro skip; F7 Vite proxy/CSRF origin documentation.
- The mutation check modified and restored `AuthMenu.tsx` only; no source file retains changes from this review.
- No source, tests, specs, or logs were modified by this review.