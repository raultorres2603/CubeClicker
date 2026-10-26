---
feature: user-authentication
phase: code
iteration: corrective-3
verdict: approved
blocking: 0
nonblocking: 4
---

# Code Review — corrective r3

## Summary

✅ approved — The minor-backlog round (F2/F4/F7) is implemented correctly and safely: verification now hydrates the client store best-effort without masking a successful verification; the full-viewport backdrop trade-off is documented in both CSS and UI with a keyboard-skip hint; and the README documents the Vite dev proxy, `BACKEND_URL`, `changeOrigin: false`, and CSRF origin matching. Lint, typecheck, tests (backend 492, frontend 758), coverage (backend 94.66/84.32/99.60/94.66; frontend 93.96/93.32/96.21/93.96), and build all pass; thresholds intact at 80/80/80/80; no banned matchers; exclusions unchanged. No BLOCKER or MAJOR. F6 is effectively already guarded in code (see F4 below). Residual items are MINOR/INFO test-coverage and polish notes.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-5 | ✅ | `VerifyEmail.tsx:62-87` consumes token via store/api, then best-effort hydrates the store (`bootstrap`→`me`→`refresh`, first available) at `VerifyEmail.tsx:73-87`; success preserved on bootstrap failure. Tests: `VerifyEmail.test.tsx` "calls store bootstrap after a successful verification…" and "shows an error when verification fails". |
| AC-19 | ✅ | Trade-off documented in `app.css:233-248` (full-viewport backdrop kept to block pre-choice input; keyboard skip via Space/Enter/Escape remains); skip hint rendered in `AuthMenu.tsx:123` (`Press any key to skip the intro`). No regression to input blocking (`.auth-menu`/`.auth-forms` still `pointer-events: auto`, `inset: 0`). |
| AC-32 | ✅ | `npm run coverage` exit 0 both workspaces; thresholds 80/80/80/80 intact; exclusions only `main.tsx`/`server.ts` (justified composition roots). |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/frontend/src/ui/VerifyEmail.tsx:62-87`; `src/frontend/src/ui/VerifyEmail.test.tsx` | Bootstrap failure is swallowed (correct) but untested: no test exercises verify-succeeds-then-bootstrap-throws to prove `success` is still shown and `onVerified` fires. The `me`/`refresh` bootstrap branches and the api-only verify path are also unexercised (coverage: `VerifyEmail.tsx` 85.88/75/100/85.88). The success test also uses a weak existential (`toBeTruthy()` on `findByText` result, line 53) where a concrete text assertion is available. | Add tests for (a) bootstrap throwing → success still renders + `onVerified` called, (b) api-only verify + no store, (c) `me`/`refresh` selection; replace `toBeTruthy()` with an explicit `textContent`/`toHaveTextContent` assertion. | open |
| F2 | INFO | `src/frontend/src/ui/VerifyEmail.tsx:64-68` | `verify` is optional: if neither `store.verify` nor `api.verify` exists, the component still flips to `success` after (optional) bootstrap. Pre-existing behavior, not introduced by this round; client-side only, server remains authoritative. | Either document as mount-only/controlled usage or gate success on a verification call; low priority. | open |
| F3 | INFO | `src/frontend/src/ui/AuthMenu.tsx:123` | The new skip hint (`Press any key to skip the intro`) is not asserted by any test, so a removal would not fail the suite. | Optionally add a render assertion containing the hint text. | open |
| F4 | INFO | `src/frontend/src/App.tsx:274-279` | F6 (r1) asked for a `closed()` guard in `verificationRequired`; the guard is already present in current code (`if (closed()) return;`). The build-log "open" status is stale. No action needed. | Update the backlog/build-log status to "fixed"; no code change. | waived (fixed in code) |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 34 files / 758 tests).
- `npm run coverage` → exit 0:
  - backend: statements 94.66, branches 84.32, functions 99.60, lines 94.66.
  - frontend: statements 93.96, branches 93.32, functions 96.21, lines 93.96.
  - thresholds 80/80/80/80 intact both workspaces.
- `npm run build` → exit 0 (frontend dist 820.92 kB).
- Banned-matcher grep over `src/` (`expect.any`, `expect.anything`, `toMatchSnapshot`, `toMatchInlineSnapshot`) → no matches.
- Coverage exclusions unchanged: `src/server.ts` (backend), `src/main.tsx` (frontend) only (justified composition roots); `all: true` so un-imported modules count.
- `git show d5b6778 --stat` → matches build-log file list (README.md, build-log-minor-backlog.md, AuthMenu.tsx, VerifyEmail.tsx, VerifyEmail.test.tsx, app.css).
- `vite.config.ts` proxy (`target: process.env.BACKEND_URL ?? 'http://backend:8080'`, `changeOrigin: false`) matches the README dev-proxy section (F7 ✅).
- Security spot-check: no token/secret added to client bundle; verification token is already spec-accepted in the URL (AC-5); bootstrap uses the HttpOnly session cookie via `credentials: 'include'`; bootstrap failure is swallowed so a successful verification is never masked; no `innerHTML`/`eval`.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No secrets; errors React-escaped; session cookie untouched by JS; bootstrap best-effort with failure swallowed; CSRF relies on SameSite+Origin; verification token in URL is spec-accepted (AC-5). |
| Quality | ✅ | TypeScript strict passes; store/api created once via `useState`; no double side-effects beyond the intentional verify→bootstrap hydration; CSS responsive; input blocking preserved. |
| Testing | ✅ | Thresholds met both workspaces; interaction coverage from r1 F1 present (AuthMenu/AuthForms interaction suites); residual test gaps for bootstrap failure branches are MINOR (F1). |

## Previous round verification (corrective r1)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1, MAJOR) | fixed | `AuthMenu.test.tsx` "AuthMenu — interaction" and `AuthForms.test.tsx` "AuthForms — interaction" drive rendered buttons/forms (`userEvent.click`/`type`) and assert bound callbacks fire. |
| F2 (r1, MINOR) | fixed | `VerifyEmail.tsx:73-87` hydrates store on success; tests added. |
| F3 (r1, MINOR) | open (not in scope) | Focus management unchanged; remains in backlog. |
| F4 (r1, MINOR) | fixed | `app.css:233-248` documents trade-off; `AuthMenu.tsx:123` skip hint; backdrop retained. |
| F5 (r1, MINOR) | open (not in scope) | `initialError` still captured only in `useState` initializer. |
| F6 (r1, MINOR) | fixed (in code) | `App.tsx:274-279` contains `if (closed()) return;`. |
| F7 (r1, INFO) | fixed | README "Vite dev proxy (host-only runs)" section matches `vite.config.ts`. |
| F8 (r1, INFO) | open (not in scope) | `autoFocus` on menu `Login` button unchanged. |

## Notes / backlog (non-blocking)

- F3/F5/F8 from r1 remain open and are out of scope for this round (polish/a11y); none blocks.
- F1 (this round) is the only actionable test gap; recommended but not blocking because the bootstrap call itself is covered by the success test (`bootstrap` called once).
- F6 status in build-log should be corrected to "fixed". No source changes made by this review.