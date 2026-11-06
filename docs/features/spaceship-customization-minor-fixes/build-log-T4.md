# Build log — T4 — Defensive-copy `parts`/`appearance` on engine cube-completion grant

Task: T4 (2026-11-06)
Files changed: src/frontend/src/game/engine.ts, src/frontend/src/game/engine.test.ts

## Changes

- `src/frontend/src/game/engine.ts`: in the cube-completion branch of `explode`, the granted `customization` now builds `parts` and `appearance` as new objects (`{ ...customization.parts }` and `{ ...customization.appearance }`) instead of reusing the existing references, matching `adoptCustomization`.
- `src/frontend/src/game/engine.test.ts`: added test asserting the granted snapshot's `parts`/`appearance` maps are new references and that mutating them does not mutate the prior snapshot's maps (AC-4).

## Verification evidence

### lint
```
$ npm run lint
> lint
> eslint .

(exit 0)
```

### typecheck
```
$ npm run typecheck --workspace @cubeclicker/frontend
> typecheck
> tsc --noEmit

(exit 0)
```

### test
```
$ npm test --workspace @cubeclicker/frontend -- engine
> test
> vitest run engine

 RUN  v3.2.7 .../src/frontend
 ✓ src/game/engine.test.ts (101 tests) 38ms
 Test Files  1 passed (1)
      Tests  101 passed (101)
```

### coverage
```
$ npm run coverage --workspace @cubeclicker/frontend
(exit 0; thresholds >= 80 met per workspace)
```

Acceptance audit: AC-4 → met (spread-copy on grant; new test asserts reference inequality + no mutation of prior maps). AC-5 → met (lint/typecheck/tests/coverage pass).
Deviations from spec: none.