# Build log — T4 — Verify & integrate

Task: T4 (2026-11-06)
Files changed: docs/features/upgrades-panel-bottom-right/build-log-T4.md
What changed & why: Full verification run (lint, typecheck, test, coverage, build) for the upgrades-panel-bottom-right feature; no source edits. All gates green.
Decisions: Verification only; documentation pass deferred to acceptance per docs/architecture/documentation.md.

## Evidence

### npm run lint

```
> lint
> eslint .

EXIT 0
```

### npm run typecheck

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT 0
```

### npm test

```
backend: Test Files  22 passed (22); Tests  700 passed (700)
frontend: Test Files  47 passed (47); Tests  1196 passed (1196)
EXIT 0
```

### npm run coverage

```
backend  All files: % Stmts 94.34 | % Branch 85.93 | % Funcs 99.68 | % Lines 94.34
frontend All files: % Stmts 94.89 | % Branch 94.89 | % Funcs 95.65 | % Lines 94.89
EXIT 0 (thresholds >= 80 met in both workspaces)
```

### npm run build

```
backend: tsc (exit 0)
frontend: vite build — ✓ built in 1.40s
EXIT 0
```

### AC-5 scope check (git diff --stat, feature commits)

```
src/frontend/src/App.test.tsx                      |  2 +-
src/frontend/src/ui/UpgradesPanel.test.tsx         | 11 ++++++
src/frontend/src/ui/UpgradesPanel.tsx              |  6 +++-
src/frontend/src/ui/app.css                        |  9 +++++
src/frontend/src/ui/app.css.test.ts                | 13 +++++++
```

Production (non-test) changes limited to `src/frontend/src/ui/UpgradesPanel.tsx` and `src/frontend/src/ui/app.css`; test changes limited to `UpgradesPanel.test.tsx`, `App.test.tsx`, and `app.css.test.ts`.

## Acceptance audit

- AC-1 — met: `.upgrades-panel` rule declares `position: absolute`, `bottom: calc(1rem + env(safe-area-inset-bottom, 0px))`, `right: calc(1rem + env(safe-area-inset-right, 0px))`, `top: auto`, `left: auto` (verified by app.css.test.ts CSS guard + manual inspection).
- AC-2 — met: root `<section>` carries `class="upgrades-panel"` (UpgradesPanel.test.tsx, App.test.tsx).
- AC-3 — met: rule uses `env(safe-area-inset-bottom, 0px)` and `env(safe-area-inset-right, 0px)`.
- AC-4 — met: lint, typecheck, test, coverage, build all pass (evidence above).
- AC-5 — met: production scope limited to the two owned files (git diff --stat).

Deviations from spec: none.