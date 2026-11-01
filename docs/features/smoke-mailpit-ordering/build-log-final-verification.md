# Build log — T3 — Full verification sweep & evidence consolidation

Task: T3 (2026-11-01)
Files changed: docs/features/smoke-mailpit-ordering/build-log-final-verification.md
What changed & why: Recorded the full verification gate suite and AC walk for `smoke-mailpit-ordering`. No source code changed; this is the final verification/evidence task.
Decisions: Evidence captured from the live host (stack left running per constraint). `git diff --name-only` is empty because T1/T2 changes are already committed; the in-scope files are confirmed via `git show`/tracked state (compose.smoke.yaml, tests/e2e/smoke.mjs). The only untracked artifacts are the feature's spec/plan/tasks/status/reviews plus this build log.
Evidence:

## Gate suite

### `npm run lint` (exit 0)
```
> lint
> eslint .
EXIT=0
```

### `npm run typecheck` (exit 0)
```
> typecheck
> npm run typecheck --workspaces --if-present
> tsc --noEmit   (backend)
> tsc --noEmit   (frontend)
EXIT=0
```

### `npm test` (exit 0)
```
Test Files  44 passed (44)
Tests       1099 passed (1099)
Duration    2.06s
EXIT=0
```

### `npm run coverage` (exit 0; thresholds ≥ 80% per workspace)
```
backend  All files | % Stmts 94.97 | % Branch 86.19 | % Funcs 99.65 | % Lines 94.97
frontend All files | % Stmts 95.19 | % Branch 95.09 | % Funcs 96.89 | % Lines 95.19
EXIT=0
```

### `npm run build` (exit 0)
```
backend: tsc (no emit errors)
frontend: vite build — ✓ built in 1.40s
EXIT=0
```

### `podman compose -f compose.yaml -f compose.smoke.yaml config` (exit 0)
```
smoke.depends_on:
  backend:  { condition: service_started, required: true }
  frontend: { condition: service_started, required: true }
  mailpit:  { condition: service_started, required: true }
EXIT=0
```

### One-shot (unprimed) `npm run smoke` (exit 0)
```
SMOKE PASS (12/12 checks)
EXIT=0
```
(checks: backend healthz, frontend html, 2x websocket hello, multiplayer join/overflow/explode/leave, auth register/verify/login/guest — all PASS)

### Primed (regression) `podman compose ... up -d mailpit` then `npm run smoke` (exit 0)
```
Container cubeclicker-mailpit-1 Running
SMOKE PASS (12/12 checks)
EXIT=0
```

### `node --check tests/e2e/smoke.mjs` (exit 0)
```
EXIT=0
```

### `grep -n "mailpit" compose.smoke.yaml` (exit 0)
```
27:      mailpit:
```

### `git diff --name-only` (exit 0)
```
(no tracked modifications — T1/T2 changes already committed)
```

### `git status --porcelain` (exit 0)
```
?? docs/features/smoke-mailpit-ordering/plan.md
?? docs/features/smoke-mailpit-ordering/reviews/
?? docs/features/smoke-mailpit-ordering/spec.md
?? docs/features/smoke-mailpit-ordering/status.md
?? docs/features/smoke-mailpit-ordering/tasks.md
?? docs/features/smoke-mailpit-ordering/build-log-final-verification.md
```

## Acceptance audit

- AC-1 — met. `npm run smoke` (one-shot, no prior `up -d mailpit`) → `SMOKE PASS (12/12 checks)`, exit 0 (evidence above).
- AC-2 — met. `compose.smoke.yaml` `smoke.depends_on` includes `mailpit: condition: service_started` (grep line 27; merged config confirms).
- AC-3 — met. Primed run (`up -d mailpit` then `npm run smoke`) → `SMOKE PASS (12/12 checks)`, exit 0; CI workflow (`.github/workflows/ci.yml`) untouched and still declares the Mailpit pre-start step before the run.
- AC-4 — met. `podman compose -f compose.yaml -f compose.smoke.yaml config` exit 0.
- AC-5 — met. No `src/` files changed; `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` all exit 0.
- AC-6 — met. `node --check tests/e2e/smoke.mjs` exit 0.
- AC-7 — met. `checkAuthFlow()` polls `MAILPIT_URL + '/'` via `pollUntilReady` before `POST /auth/register` (tests/e2e/smoke.mjs lines ~593-605); on failure sets `registerProblem = "Mailpit not ready: ..."` and skips verify/login.

Deviations from spec: none.