# Build log — T5 (Verify & integrate)

## Scope

No code changes. Full verification suite run for the `realistic-lighting-materials` feature (AC-7, AC-8, AC-9).

## AC-7 — Reduced motion / static pass params

Covered by existing tests (no new animation introduced):

- `src/frontend/src/render/postprocessing.test.ts`: `keeps pass parameters unchanged after render() calls (AC-7)` asserts SSAO (`kernelRadius`, `minDistance`, `maxDistance`) and bloom (`strength`, `radius`, `threshold`) equal their pinned constants after 3 `render()` calls.
- `src/frontend/src/render/starfield.test.ts`: twinkle amplitude behaviour and `keeps opacity at base when reducedMotion is true`.
- `src/frontend/src/ui/app.css.test.ts`: `@media (prefers-reduced-motion: reduce)` blocks disabling transitions/animations.

## Verify evidence

### `npm run lint`

```
> lint
> eslint .

EXIT: 0
```

### `npm run typecheck`

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT: 0
```

### `npm test`

```
backend: Test Files 22 passed (22); Tests 700 passed (700)
frontend: Test Files 48 passed (48); Tests 1223 passed (1223)
EXIT: 0
```

### `npm run coverage` (full, both workspaces)

```
backend All files | 94.34 | 85.93 | 99.68 | 94.34
frontend All files | 95    | 94.94 | 95.75 | 95
EXIT: 0
```

Per-workspace thresholds (≥ 80% statements/branches/functions/lines) met.

### `npm run build`

```
✓ built in 1.37s
EXIT: 0
```

### AC-8 — container/backend diff gate

```
$ git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'
EXIT: 0
```

No changes to compose, backend, or any Dockerfile.

### `npm run smoke` (containerized end-to-end)

```
SMOKE PASS (12/12 checks)
EXIT: 0
```
