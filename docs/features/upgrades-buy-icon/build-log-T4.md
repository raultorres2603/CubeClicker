# Build log — T4 — Verify & integrate

Task: T4 (2026-11-06)
Files changed: docs/features/upgrades-buy-icon/build-log-T4.md
What changed & why: Full verification run (lint, typecheck, test, coverage, build) for the upgrades-buy-icon feature; no source edits. All gates green.
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
frontend: Test Files  47 passed (47); Tests  1198 passed (1198)
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
frontend: vite build — ✓ built in 1.32s
EXIT 0
```

### Scope check (git diff, feature commits vs f3d26c9)

Production (non-test) changes limited to `src/frontend/src/ui/UpgradesPanel.tsx` and `src/frontend/src/ui/app.css`; test changes limited to `UpgradesPanel.test.tsx`, `App.test.tsx`, and `app.css.test.ts`. No backend/container paths changed (AC-7, AC-8).

`grep -n "Buy" src/frontend/src/ui/UpgradesPanel.tsx` matches only `aria-label="Buy"` (line 55); no literal "Buy" text in the button.

## Acceptance audit

- AC-1 — met: buy button contains no "Buy" text; glyph supplied by CSS (UpgradesPanel.test.tsx, App.test.tsx golden string).
- AC-2 — met: each buy button carries `aria-label="Buy"` (SSR markup).
- AC-3 — met: affordability/disabled semantics unchanged (UpgradesPanel.test.tsx maxed/below-cost/affordable/guest cases).
- AC-4 — met: disabled buttons render `disabled=""`; enabled do not (SSR markup).
- AC-5 — met: `.upgrades-panel button::before` rule with `content: '+';` present; CSS guard (app.css.test.ts).
- AC-6 — met: lint, typecheck, test, coverage pass.
- AC-7 — met: production changes limited to UpgradesPanel.tsx and app.css.
- AC-8 — met: no container/backend paths changed.
- AC-9 — met: coverage ≥ 80% in both workspaces.

Deviations from spec: none.