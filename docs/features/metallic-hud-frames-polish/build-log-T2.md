# Build Log — T2 — Verify & integrate (metallic-hud-frames-polish)

Task: T2 (2026-10-28)
Files changed: none (verification only); docs/features/metallic-hud-frames-polish/tasks.md, status.md updated to mark T2 [x].

What changed & why: Full verification pass over T1's two-file change (trailing newline in app.css; anchored mask-composite guard). No application code changes. All gates green; smoke passes on a clean run.

Decisions: BASE pinned to the fork point recorded in build-log-T1.md (dc96473f856d61ffe78d57a440238638c499368e), since `main` has since advanced past it. Smoke run required the `mailpit` service to be up (auth register sends a verification email); a clean run with mailpit up passes 12/12.

## BASE
`BASE=dc96473f856d61ffe78d57a440238638c499368e` (`git merge-base main HEAD` before the first feature commit, recorded in build-log-T1.md).

## Evidence

### lint
Command: `npm run lint`
Result: exit 0 (no output).

### typecheck
Command: `npm run typecheck`
Result: exit 0.

### tests (full suite)
Command: `npm test`
Result: exit 0 — backend Test Files 18 passed (18), Tests 492 passed (492); frontend Test Files 41 passed (41), Tests 986 passed (986); total 1478 passed.

### coverage
Command: `npm run coverage`
Result: exit 0.
- backend: All files 94.66% stmts / 84.32% branches / 99.60% funcs / 94.66% lines (≥ 80%).
- frontend: All files 95.05% stmts / 94.84% branches / 96.46% funcs / 95.05% lines (≥ 80%).

### build
Command: `npm run build`
Result: exit 0 (backend tsc; frontend vite build).

### protected-path diff gate (1) — markup/theme
Command: `git diff --exit-code "$BASE"...HEAD -- src/frontend/src/App.tsx src/frontend/src/ui/Hud.tsx src/frontend/src/ui/UserPanel.tsx src/frontend/src/ui/AuthMenu.tsx src/frontend/src/ui/AuthForms.tsx src/frontend/src/ui/ConnectionBanner.tsx src/frontend/src/ui/VerificationPending.tsx src/frontend/src/ui/VerifyEmail.tsx src/frontend/src/ui/theme.ts src/frontend/src/ui/theme.test.ts`
Result: exit 0 (no diff).
Command: `test -z "$(git status --porcelain -- src/frontend/src/App.tsx src/frontend/src/ui/Hud.tsx src/frontend/src/ui/UserPanel.tsx src/frontend/src/ui/AuthMenu.tsx src/frontend/src/ui/AuthForms.tsx src/frontend/src/ui/ConnectionBanner.tsx src/frontend/src/ui/VerificationPending.tsx src/frontend/src/ui/VerifyEmail.tsx src/frontend/src/ui/theme.ts src/frontend/src/ui/theme.test.ts)"`
Result: exit 0 (empty).

### protected-path diff gate (2) — container/backend
Command: `git diff --exit-code "$BASE"...HEAD -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'`
Result: exit 0 (no diff).
Command: `test -z "$(git status --porcelain -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile')"`
Result: exit 0 (empty).

### app.css diff (AC-1)
Command: `git diff "$BASE"...HEAD -- src/frontend/src/ui/app.css`
Result: only the EOF newline changed (`-}` `\ No newline at end of file` → `+}`); content otherwise byte-identical.

### anchored mask guard (AC-2)
`app.css.test.ts` "mask-composite declarations follow their shorthands" test uses declaration-start anchors (`/^\s*-webkit-mask:/m`, `/^\s*-webkit-mask-composite:/m`, `/^\s*mask:/m`, `/^\s*mask-composite:/m`) and passed in the full suite (986 frontend tests).

### smoke
Command: `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (clean run, mailpit up)
Result: PASS 12/12 checks (backend healthz, frontend html, two websockets + hello, multiplayer join/overflow/sync/leave, auth register/verify/login, guest welcome).

## Acceptance audit
- AC-1 (trailing newline) → met: trailing-newline guard passes; git diff shows only EOF newline.
- AC-2 (mask guard anchored) → met: anchors in place; guard passes.
- AC-3 (no other files changed) → met: both protected-path diff/status gates exit 0.
- AC-4 (full verification suite) → met: lint/typecheck/tests/coverage/build all exit 0; coverage ≥ 80% per workspace.

Deviations from spec: none.
