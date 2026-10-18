# Build log — T5 — Timings, easings and burst math

Task: T5 (2026-10-18) — `docs/features/cube-game-frontend/tasks.md`
Build-start revision: `8dfcd30` (T4) — branch `main`
Files changed:
- `src/frontend/src/game/effects.ts` (new, 162 lines)
- `src/frontend/src/game/effects.test.ts` (new, 189 lines, 18 tests, 35 assertions)
- `docs/features/cube-game-frontend/build-log-T5.md` (this file)

## What changed & why (≤ 5 lines)

1. Implemented `game/effects.ts` exactly per plan § Interfaces: `Timings`, `DEFAULT_TIMINGS` (2500/2500/300/350/400), `REDUCED_TIMINGS` (150/150/0/0/100), `timingsFor`, `easeOutCubic`, `easeInOutQuad`.
2. Added `Burst`/`BurstParticle` plus `createBurst(random, particleCount = 24)`: five injected draws per particle (direction → speed → size), unit-normalised direction with a degenerate-vector fallback, lifetime `DEFAULT_TIMINGS.explosionMs` (350 ms).
3. Pinned the non-grid constants as this module's single home (F2): `STAR_COUNT` 1200, `EXPLOSION_PARTICLE_COUNT` 24, `PARTICLE_POOL_CAP` = 3 × 24 = 72, `TAP_DRAG_THRESHOLD_PX` 40, `PIXEL_RATIO_CAP` 2.
4. Tests assert exact floats for both easings at t = 0/0.25/0.5/0.75/1 (and that they reproduce the AC-22 camera positions), the exact values of every pinned constant, and the exact first particle + draw cadence of `createBurst` with injected randomness.
5. `game/**` stays DOM-free and node-testable; no other file touched (parallel batch T3/T4 own their own paths).

## Decisions

- **Burst direction**: three draws mapped to `[-1, 1)` and normalised to a unit vector; a draw triple too short to normalise (`length < 1e-6`) uses the fixed fallback `(0, 0, 1)`. Chosen because it needs no trig (exact floats are assertable without a `closeTo` exception) and every particle is reproducible from the injected `random`. Speed ∈ [1, 3), point size ∈ [0.02, 0.07) — internal (non-pinned) ranges, module-local constants.
- **Draw order is part of the contract** (`direction`, then `speed`, then `size`; five draws per particle) and is pinned by test, so `particles.ts` (T9) can rely on a reproducible burst for a given seed.
- **`lifetimeMs` = `DEFAULT_TIMINGS.explosionMs` (350)**: bursts exist only in the default profile — under reduced motion the engine hides the mini-cube without creating one (`explosionMs` 0), so `createBurst` needs no timings parameter.
- **`timingsFor` returns the shared profile objects** (identity preserved), asserted with `toBe`.
- **Integration-test tier exception (documented, per skill § Testing bar):** `effects.ts` is a pure leaf math module — no I/O, no cross-module boundary exists at T5. Its integration is delivered by its consumers' integration tests: `render/particles.ts` (T9) consumes `createBurst`/`PARTICLE_POOL_CAP`, `render/starfield.ts` (T7) consumes `STAR_COUNT`, `render/scene.ts` (T12) consumes the easings/timings against real three.js objects, `game/engine.ts` (T6) consumes `timingsFor`. As partial consumer-contract coverage the T5 suite asserts the eased values against the AC-22 camera math (`60 - 48 × easeOutCubic`, `12 + 78 × easeInOutQuad`), which is what `scene.ts` (T12) will interpolate. No test-content exception was needed for assertions: **0** bounded-exception (`closeTo`) usages in this task.
- No dependency, config, spec, plan, tasks or status change; no coverage exclusion; thresholds untouched.

## Evidence

### `npm run typecheck --workspace @cubeclicker/frontend` → exit 0

```
> typecheck
> tsc --noEmit
```
(no diagnostics emitted)

### `npm run lint` → exit 0

```
> lint
> eslint .
```
(no diagnostics emitted)

### `npm test --workspace @cubeclicker/frontend` → exit 0

```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/progression.test.ts (10 tests) 5ms
 ✓ src/game/effects.test.ts (18 tests) 5ms
 ✓ src/ws/connection.test.ts (10 tests) 9ms
 ✓ src/game/board.test.ts (14 tests) 12ms
 ✓ src/App.test.tsx (1 test) 6ms

 Test Files  5 passed (5)
      Tests  53 passed (53)
```
(`effects.test.ts` = 18 tests; the other four files belong to T2/T4/`ws` and are reported because the command runs the whole workspace.)

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   97.19 |    96.87 |     100 |   97.19 |
 src             |      84 |      100 |     100 |      84 | 19-22
  App.tsx        |      84 |      100 |     100 |      84 | 19-22
 src/game        |     100 |      100 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  types.ts       |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
   tests: 53 passed (5 files)
```
`effects.ts`: 100 / 100 / 100 / 100. Workspace aggregate 97.19 / 96.87 / 100 / 97.19 — all four metrics ≥ 80 with no exclusions added.

### Banned-matcher grep (T5 test file) → no matches

```
$ grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchObject|toHaveBeenCalled|toBeTruthy|toBeDefined|toThrow|toMatchInlineSnapshot|toMatchSnapshot|closeTo" src/frontend/src/game/effects.test.ts
(no output; exit 1)
```
All 35 assertions use exact expected values (`toEqual` on fully pinned structures, `toBe` on exact numbers/identities).

### Scope check

```
$ git status --short
?? docs/features/cube-game-frontend/plan.md        (planning artifacts, pre-existing untracked)
?? docs/features/cube-game-frontend/reviews/
?? docs/features/cube-game-frontend/spec.md
?? docs/features/cube-game-frontend/status.md
?? docs/features/cube-game-frontend/tasks.md
?? src/frontend/src/game/effects.test.ts           (T5)
?? src/frontend/src/game/effects.ts                (T5)

$ git diff --stat
(empty — no tracked file modified)
```
Commit stages exactly the three `files_owned` paths explicitly (no `git add .`/`-A`); no parallel-batch file (T3/T4) staged.

## Acceptance audit

- **AC-12 (values) → met.** `effects.test.ts` pins `DEFAULT_TIMINGS` = `{2500, 2500, 300, 350, 400}` and `REDUCED_TIMINGS` = `{150, 150, 0, 0, 100}` (whole-object `toEqual`), the reduced profile's instant rotation (`rotationMs` 300 → 0) and instant explosion (`explosionMs` 350 → 0), and `timingsFor(false/true)` returning the respective shared profiles. The reduced full-path behaviour is engine/session evidence (T6/T13).
- **AC-5 / AC-13 constants → met.** `EXPLOSION_PARTICLE_COUNT` 24 and `TAP_DRAG_THRESHOLD_PX` 40 asserted with exact values; `createBurst()` defaults to exactly 24 particles (asserted via `toHaveLength(24)` and `toHaveLength(EXPLOSION_PARTICLE_COUNT)`) with `lifetimeMs` 350 = `DEFAULT_TIMINGS.explosionMs`.
- **AC-16 (`PARTICLE_POOL_CAP`) → met.** Asserted exactly 72, and equal to `3 * EXPLOSION_PARTICLE_COUNT` (ratio 3) — the cap semantics (recycle oldest at the ceiling) are T9's behaviour; T5 owns the constant.
- **AC-3 constant (`STAR_COUNT`) → met.** Asserted exactly 1200; T7 (starfield) imports it from this module.
- **AC-22 easing curves → met at the math level.** Exact values at t = 0/0.25/0.5/0.75/1 plus the pinned camera positions (`easeOutCubic` → 60/18/12; `easeInOutQuad` → 21.75/51/90); the camera-flight assertions themselves are `scene.test.ts` (T12).
- **AC-17 (test bar) → met for this task.** Coverage evidence above; banned-matcher grep empty; two documented exceptions (integration-tier absence, 0 `closeTo`).
- **Pinned `PIXEL_RATIO_CAP` value (AC-13 consumer) → met.** Asserted exactly 2.

## Deviations from spec

- None in values or contracts. Two additive exports beyond the plan's `effects.ts` listing: `BurstParticle` (the element type of `Burst.particles`, which the plan declares inline) and internal module-local range constants (`BURST_SPEED_MIN/RANGE`, `BURST_SIZE_MIN/RANGE`, normalisation guard) that the plan does not pin — plan § Interfaces allows wording/semantics-preserving variation, and no AC-visible value is introduced.
- Integration-tier exception documented above (no integration boundary exists in T5).
