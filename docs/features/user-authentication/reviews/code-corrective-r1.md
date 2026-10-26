---
feature: user-authentication
phase: code
iteration: corrective-1
verdict: changes_requested
blocking: 1
---

# Code Review — corrective r1

## Summary

❌ changes requested — The reported "static intro on guest" defect is addressed in source (`createAuthGate.playAsGuest` → `session.join('guest')`, `loginSucceeded` reconnects then joins account, registration/unverified login enter the pending screen without joining), and the menu is restyled as a centered button column above the canvas. Lint, typecheck, tests (492 backend + 742 frontend), coverage (backend 94.66/84.32/99.60/94.66; frontend 92.46/91.65/93.67/92.46) and build all pass; no banned matchers and no coverage gaming. One MAJOR remains: the new tests invoke the exported handlers directly and never drive the rendered JSX, so the suite cannot catch a re-introduction of the broken-wiring class of bug (question 4). Several MINOR polish/a11y notes below.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-4 / AC-24 | ✅ | `App.test.tsx` "routes an unverified login to verification-pending without joining" asserts `join`/`retryConnection` called 0 times and pending snapshot; `submitAuthForm` unverified branch. |
| AC-5 | ✅ | `VerifyEmail.tsx` uses resolved default `api`/`store` (App.tsx verify branch); `VerifyEmail.test.tsx`. |
| AC-7 | ✅ | `AuthForms.tsx` `submitAuthForm` login path; `AuthForms.test.tsx` "returns an exact error…", "logs in through the store…". |
| AC-18 | ✅ | `App.test.tsx` first test: `<canvas` present, `class="auth-menu" role="dialog"…`, three buttons; `AuthMenu.test.tsx`. |
| AC-19 | ✅ | `App.test.tsx` "joins as a guest exactly once (even on a double click)" → `join` called once with `'guest'`, `retryConnection` 0, menu gone. |
| AC-20 | ✅ | `AuthMenu.test.tsx` "renders the login form when defaultView is login", "renders the register form when defaultView is register"; cancel returns to menu via `handleCancel`. |
| AC-23 | ✅ | `App.test.tsx` login test pins `login < retryConnection < join` via `invocationCallOrder`. |
| AC-34 | ✅ | `transport.ts` `join`/`hello` handling retains `lastMode`; `transport.test.ts` (suite green). |
| AC-32 | ✅ | `npm run coverage` exit 0, thresholds 80/80/80/80 both workspaces, exclusions only `main.tsx`/`server.ts` (justified). |

## Review questions (with evidence)

1. **Guest reaches the running game.** `AuthMenu.handleGuest` → `onPlayAsGuest` (`gate.playAsGuest` in App.tsx) → `session.join('guest')` → `transport.join('guest')`. `transport.join` records `lastMode='guest'` and, if the socket is already open (`helloHandled && sendTarget !== null`), sends `join { mode:'guest' }` immediately; otherwise the mode is retained and sent on the next `hello` (transport.ts: `join` and `hello` case). If the socket is not open when clicked, no packet is sent yet but `lastMode` is retained, so the menu can close safely and the join lands on hello; no silent permanent no-op in the real (transport-injected) session. Double click is blocked by `createAuthGate.closed()` (App.tsx). Residual risk: `transport.join` will not re-send if `joined` is already true on the same socket (mode change on one socket impossible in practice; gate prevents double). → no BLOCKER, see M1 for test coverage.
2. **Login flows.** Verified login: `submitAuthForm` (AuthForms.tsx) awaits `store.login`, reads server user, and (verified) calls `onLoginSuccess` = `gate.loginSucceeded` → `retryConnection()` then `join('account')` with invocation-order assertion passing. Failed login throws inside `store.login` → caught → `{ outcome:'error' }`, no join/reconnect. Unverified → `{ outcome:'verification' }`, calls `onVerificationRequired`, no join. Registration → `onRegisterSuccess` → `gate.verificationRequired(email)` → pending screen, no join; `backToLogin` resets `menuDefaultView='login'`. Post-verification: `VerifyEmail` uses the resolved default client and the route links back to login. → met, with MINOR note on client store bootstrap.
3. **Menu above canvas / column.** `.auth-menu`/`.auth-forms` are `position: fixed; inset: 0; z-index: 100; pointer-events: auto` over the canvas (app.css); `.auth-menu-actions` is `flex-direction: column`; `.auth-panel` centered. Cinematic keeps animating (session renders behind, no pause). → met.
4. **Regression-test quality.** `App.test.tsx` and `AuthForms.test.tsx` call `gate.playAsGuest()` / `submitAuthForm()` directly; no test clicks the rendered `Play as guest`/`Login` buttons or submits the rendered form, so the JSX `onClick`/`onSubmit` bindings are unexercised. A mutation removing `onClick={handleGuest}` (or breaking `handleSubmit`) would still pass. → MAJOR (F1).
5. **Regressions.** No tokens in bundle beyond code strings (AC-17 grep clean); errors are React-escaped; store/api created once via `useState`; `VerifyEmail` effect runs once per `token`. Residual MINOR items below (focus management, tap-outside skip, client store bootstrap, prop staleness).
6. **Build-log claims.** `git show --stat de82df9` / `ee4a667` match the listed files; `npm run lint && npm run typecheck && npm test && npm run coverage` re-run independently → all green; banned-matcher grep over `src/` → no matches; thresholds unchanged at 80/80/80/80; exclusions unchanged (`main.tsx`, `server.ts`).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | src/frontend/src/App.test.tsx, src/frontend/src/ui/AuthForms.test.tsx, src/frontend/src/ui/AuthMenu.test.tsx | Tests exercise exported handlers (`createAuthGate`, `submitAuthForm`) directly and only assert SSR markup; the rendered `onClick`/`onSubmit` bindings (e.g. `AuthMenu.handleGuest` → `onPlayAsGuest`, `AuthForms.handleSubmit` → `submitAuthForm`) are never invoked through the DOM. A re-introduction of the broken-wiring defect (dismissed menu, no `join`) would not fail the suite. Also explains low function coverage on `AuthMenu` (20%) / `AuthForms` (66.67%). | Add interaction-level coverage that drives the real binding — either enable jsdom and click/submit the rendered buttons, or add a lightweight harness asserting the bound callbacks fire. At minimum, assert `AuthMenu`'s guest button calls the injected `onPlayAsGuest` (and forms call `onLogin`/`onRegister`) via a spy. | open |
| F2 | MINOR | src/frontend/src/ui/VerifyEmail.tsx; src/frontend/src/App.tsx (verify branch) | After a successful verification the client store is not bootstrapped (it stays anonymous) even though the server set the session cookie; the user must submit credentials again. | Optionally call `store.me()`/`store.bootstrap()` on success (or on mount when a cookie may exist) so a verified user is recognized; otherwise keep the manual "Continue to login" path (acceptable but document). | open |
| F3 | MINOR | src/frontend/src/ui/AuthForms.tsx; src/frontend/src/ui/AuthMenu.tsx | No focus management on view transition: `autoFocus` only on the menu's `Login` button; switching to the login/register form does not focus the first field, and the pending screen's `Back to login` is not focused. | Add `autoFocus` to the first input of each form and to the pending screen's primary button for keyboard users. | open |
| F4 | MINOR | src/frontend/src/ui/app.css (`.auth-menu` full-viewport backdrop) | The overlay covers the entire viewport, so the AC-19 "tap outside the overlay to skip the intro" affordance is no longer reachable by pointer (only keyboard skip works). This was an intentional trade-off of the fix-menu backdrop to block canvas input, but it narrows AC-19. | Either keep the full backdrop (document the trade-off) or leave a non-interactive margin/region that forwards taps to the canvas for intro-skip. | open |
| F5 | MINOR | src/frontend/src/ui/AuthForms.tsx | `initialError` is captured only in the `useState` initializer, so a later change to the prop is ignored. | Initialize error state from `initialError` on prop change (e.g. `useEffect`) or document as mount-only. | open |
| F6 | MINOR | src/frontend/src/App.tsx (`verificationRequired`) | `verificationRequired` does not check the `closed()` gate before publishing a pending screen, so a late invocation after the game started could reopen the menu. | Guard with `if (closed()) return;` like `playAsGuest`/`loginSucceeded`. | open |
| F7 | INFO | src/frontend/vite.config.ts | Proxy uses `changeOrigin: false` and assumes the page origin matches the backend's allowed CSRF origin; host-only runs require `BACKEND_URL`. | Document in README; consider a dev default that matches. | open |
| F8 | INFO | src/frontend/src/ui/AuthMenu.tsx | `autoFocus` on the `Login` button re-triggers on every remount of the menu (e.g. after `backToLogin`), which can fight screen readers. | Move focus imperatively on mount or remove. | open |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 34 files / 742 tests).
- `npm run coverage` → exit 0 (backend 94.66/84.32/99.60/94.66; frontend 92.46/91.65/93.67/92.46; thresholds 80/80/80/80 intact).
- `npm run build` → exit 0 (frontend dist 820.64 kB).
- `git show --stat de82df9` / `git show --stat ee4a667` → file lists match the brief.
- Banned-matcher grep over `src/` (`expect.any`, `expect.anything`, `toMatchSnapshot`, `toMatchInlineSnapshot`) → no matches.
- Coverage exclusions unchanged: `src/main.tsx`, `src/server.ts` only (justified composition roots).

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No secrets in bundle (AC-17 grep clean); errors React-escaped; no token in localStorage/sessionStorage; session cookie untouched by JS; CSRF relies on SameSite+Origin. Verification token unavoidably in URL (email link, spec AC-5). |
| Quality | ✅ | TypeScript strict passes; store/api created once via `useState`; no double side-effects in effects; CSS responsive. |
| Testing | ❌ | Coverage thresholds met, but interaction/wiring of the auth menu and forms is untested (F1). |

## Previous round verification (if iteration > 1)

N/A — this is the first corrective round after acceptance; previous code review r3 was `approved` with 0 findings.

## Notes / backlog (non-blocking)

- F2–F8 are polish/a11y items; none blocks the reported defect fix.
- The full-viewport backdrop (F4) is a deliberate choice to block canvas input before a choice; revisit only if AC-19 tap-outside is required by the product owner.
- No source files were modified by this review.
