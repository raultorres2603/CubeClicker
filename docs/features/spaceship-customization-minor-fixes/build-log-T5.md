# Build log — T5 — Verify & integrate

Task: T5 (2026-11-06)
Files changed: docs/features/spaceship-customization-minor-fixes/build-log-T5.md

## What changed & why
Final verification sweep for spaceship-customization-minor-fixes: ran lint, typecheck, tests, coverage, build, and the container diff gate. All green. No source edits.

## Decisions
- No source edits; verification only.
- Container assets and `src/backend/src/server.ts` unchanged (AC-5 container gate).

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
frontend: Test Files  47 passed (47); Tests  1192 passed (1192)
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
frontend: vite build — ✓ built in 1.30s
EXIT 0
```

### git diff --exit-code (container gate)
```
git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile src/backend/src/server.ts
EXIT 0 (no changes)
```

## Acceptance audit
- AC-1 → met: backend `welcome`/`worldEntered` declare `customization?: CustomizationState`; typecheck exit 0.
- AC-2 → met: frontend `welcome`/`worldEntered` declare `customization?: CustomizationState`; typecheck exit 0.
- AC-3 → met: `session.ts` has no `(message as { customization?: CustomizationState })` casts.
- AC-4 → met: engine grant builds `parts`/`appearance` as new objects; tests assert reference inequality.
- AC-5 → met: lint/typecheck/tests/coverage pass; coverage ≥ 80% both workspaces.

## Deviations from spec
none