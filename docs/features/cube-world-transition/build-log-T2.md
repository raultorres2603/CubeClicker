# Build log — T2 — Render layer: flush mini-cube-built surface + directional world travel

Task: T2 (`cube-world-transition`, 2026-10-21)
Status: **completed** — all verify commands green (328/328 tests, coverage 99.33 / 99.4 / 100 / 99.33,
typecheck 0, lint 0, plate grep empty, banned-matcher grep empty).

Files changed: `src/frontend/src/render/cube-view.ts`, `src/frontend/src/render/cube-view.test.ts`,
`src/frontend/src/render/picking.test.ts`, `src/frontend/src/render/scene.ts`,
`src/frontend/src/render/scene.test.ts`, `src/frontend/src/game/session.test.ts` (ratified one-line
test-only re-pin, tasks.md r3), `docs/features/cube-world-transition/build-log-T2.md`.

## What changed & why (≤5 lines)

- **Surface (AC-2):** `MINI_CUBE_TILE_RATIO = 1` and the plates/materials/`PLATE_OFFSET` are deleted;
  `CubeView` is `body + one InstancedMesh per live face` (7 children), the body is the dark interior, and
  `removeFace` disposes the face's geometry + material once with no opacity write.
- **Picking:** multi-size cases for 3×3 / 7×7 (the `√count` decode stays exact for square grids); flush
  tiles leave no gaps, so the former gap coordinates now pick a tile on both sides.
- **World model + travel (AC-3):** `CUBE_SPACING = 24`, pinned `TRAVEL_DIRECTION_OFFSETS`, pure
  `travelCameraPose`; the scene tracks `cubePosition` / captured `travelFrom` / `pendingLevelChanged` and
  rebuilds exactly once per level change, placing the new cube one spacing step in the drawn direction.
- **Face clearing (AC-2):** instead of a plate fade, a `faceCleared` intent starts a
  `timingsFor(reducedMotion).faceFadeMs` countdown (400 / 100 ms) — long enough for the last 160 ms pop —
  then detaches and disposes the face.
- **Tests:** the plate-era render groups are rewritten (flush tiling N = 3/5/7, plate-free children,
  countdown, four-direction pose tables with targets, travelFrom regression, pending-rebuild per
  direction, chained travel, framing/coverage gates, reduced instant swap, aspect stability).

## Original blocker (r1) — resolved by spec r2

The r1 spec pinned `travelCameraPose` twice with two value sets: the formula (`x = dx·easeInOutQuad(p)`,
`z = 12 + 78·travelSwing(p)`) and a § 3 pose table whose `p = 0.25` z was `21.75` and whose `p = 0.75`
lateral was `18`. Recomputed with the shipped easings: z@0.25 = **51** (`travelSwing(0.25) = 0.5`) and
lateral@0.75 = **21** (`easeInOutQuad(0.75) = 0.875`), i.e. the table disagreed with the formula in two
cells per direction and could not be produced by the pinned easings. Spec r2 makes the formula
authoritative and corrects the table to `p = 0.25 → (3, 0, 51)` / `p = 0.75 → (21, 0, 51)` (mirrored);
`tasks.md`'s regression literal becomes `(21, 0, 51)`. Ruling (a) approved; ruling (b) (new easings,
breaking the camera↔starfield `travelSwing` coupling) rejected.

## Ratified re-pin (r3) — the one cross-layer literal

`src/frontend/src/game/session.test.ts:696` pinned the **superseded** predecessor tile extent
(`Math.fround(0.9 * 1.016)`), so T2's full-workspace gate could not pass inside T2's original
`files_owned`. `tasks.md` r3 adds that test file to T2's `files_owned` for this single literal; the change
is exactly one line and nothing else in the file was touched:

```diff
-    expect(popping.elements[0]).toBe(Math.fround(0.9 * 1.016));
+    expect(popping.elements[0]).toBe(Math.fround(1 * 1.016));
```

The rendered pop now produces `Math.fround(1 * 1.016) = 1.0160000324249268` (the flush tile extent is
`CUBE_SIZE / gridSize`; for the session's 5×5 board one cell = 1 world unit).

## Evidence

Raw commands run in the repository root on 2026-10-21.

### 1. `npm test --workspace @cubeclicker/frontend` → exit 0

```
 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/ui/theme.test.ts (2 tests) 3ms
 ✓ src/game/effects.test.ts (28 tests) 15ms
 ✓ src/render/webgl.test.ts (5 tests) 7ms
 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/ws/connection.test.ts (10 tests) 18ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/game/board.test.ts (18 tests) 22ms
 ✓ src/game/engine.test.ts (45 tests) 30ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/input/gestures.test.ts (21 tests) 7ms
 ✓ src/input/keyboard.test.ts (8 tests) 9ms
 ✓ src/ui/Hud.test.tsx (3 tests) 12ms
 ✓ src/render/particles.test.ts (19 tests) 15ms
 ✓ src/render/cube-view.test.ts (32 tests) 57ms
 ✓ src/render/picking.test.ts (11 tests) 29ms
 ✓ src/render/starfield.test.ts (15 tests) 77ms
 ✓ src/App.test.tsx (4 tests) 17ms
 ✓ src/game/session.test.ts (23 tests) 67ms
 ✓ src/render/scene.test.ts (51 tests) 113ms
 Test Files  20 passed (20)
      Tests  328 passed (328)
   Duration  613ms (transform 1.38s, setup 0ms, collect 3.64s, tests 537ms, environment 4ms, prepare 1.95s)
TEST_EXIT=0
```

### 2. `npm run coverage --workspace @cubeclicker/frontend` → exit 0

```
 Test Files  20 passed (20)
      Tests  328 passed (328)
   Start at  15:13:30
   Duration  817ms (transform 1.57s, setup 0ms, collect 4.30s, tests 645ms, environment 4ms, prepare 1.89s)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.33 |     99.4 |     100 |   99.33 |
 src             |     100 |      100 |     100 |     100 |
  App.tsx        |     100 |      100 |     100 |     100 |
  browser-env.ts |     100 |      100 |     100 |     100 |
 src/game        |     100 |     99.6 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
  engine.ts      |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  rotation.ts    |     100 |      100 |     100 |     100 |
  session.ts     |     100 |    98.18 |     100 |     100 | 173
  types.ts       |     100 |      100 |     100 |     100 |
 src/input       |     100 |      100 |     100 |     100 |
  gestures.ts    |     100 |      100 |     100 |     100 |
  keyboard.ts    |     100 |      100 |     100 |     100 |
 src/render      |     100 |      100 |     100 |     100 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  picking.ts     |     100 |      100 |     100 |     100 |
  scene.ts       |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
  webgl.ts       |     100 |      100 |     100 |     100 |
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx        |     100 |      100 |     100 |     100 |
  theme.ts       |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

Per-metric (workspace aggregate): **statements 99.33 · branches 99.4 · functions 100 · lines 99.33** —
all ≥ the pinned 80; no exclusion or threshold was changed. The two changed render modules are at
100/100/100/100 (`cube-view.ts`, `scene.ts`); the residual uncovered lines are the accepted pre-existing
ones (`ui/GameCanvas.tsx`, `ws/connection.ts`, `session.ts:173`).

### 3. `npm run typecheck --workspace @cubeclicker/frontend` → 0 and `npm run lint` → 0

```
$ npm run typecheck --workspace @cubeclicker/frontend   → TYPECHECK_EXIT=0
$ npm run lint                                          → LINT_EXIT=0
```

### 4. Greps

```
$ grep -n "plateMeshes\|Plate" src/frontend/src/render/cube-view.ts src/frontend/src/render/scene.ts
PLATE_EXIT=1                    # no matches — plates fully removed from both files
$ grep -n "opacity" src/frontend/src/render/scene.ts
OPACITY_EXIT=1                  # no matches — no material transparency write anywhere
$ grep -nE "expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toBeTruthy|toBeDefined|not\.toThrow|toHaveBeenCalled\(\)" src/frontend/src/render/{cube-view,picking,scene}.test.ts src/frontend/src/game/session.test.ts
BANNED_EXIT=1                   # no matches
```

### 5. Pinned spot checks asserted by the tests

- Flush tiling: N = 3 → tile extent `Math.fround(5/3) = 1.6666666269302368`, adjacent centre steps
  `1.6666666269302368`; N = 7 → extent `Math.fround(5/7) = 0.7142857313156128`, centre steps
  `0.7142856121063232 / 0.7142857313156128×4 / 0.7142856121063232` (the two outermost pairs sit one
  float32 ulp below because the instance matrix is a `Float32Array`; the exact double spacing is `5/7`);
  N = 5 → first/last centres `(−2, 2, 2.625)` / `(2, −2, 2.625)`; outermost outer faces reach `±2.5` on
  all six faces.
- Pose table (`travelCameraPose`, exact literals): `right` →
  `(0,0,12) / (3,0,51) / (12,0,90) / (21,0,51) / (24,0,12)` with targets
  `(0,0,0) / (3,0,0) / (12,0,0) / (21,0,0) / (24,0,0)`; `left`/`top`/`bottom` mirrored; identity
  quaternion at every pinned p.
- Rebuild placement: `right (24,0,0)`, `top (0,24,0)`, `left (−24,0,0)`, `bottom (0,−24,0)`; pending
  change with a null direction rebuilds in place `(0,0,0)`; chained `right` → `(48,0,0)` and rest
  `(48,0,12)`; travelFrom regression p = 0.75 → `(21,0,51)` (a double count would give `(45,0,51)`).
- Countdown: face still present at 399 ms and removed at 400 ms (default), present at 99 ms and removed
  at 100 ms (reduced); the material's `opacity` stays 1 throughout and the disposal spies fire once.

## Acceptance audit

- **AC-2 — mini-cube-built surface:** **met.** `cube-view.test.ts` (32 tests): ratio 1, exact child list
  `[body, 6 × InstancedMesh]`, no `plateMeshes` key, flush extents/spacing/edges for N = 3/5/7, body =
  `style.cubeColor`, pop timeline on a flush tile, idle colour, reduced instant hide, `removeFace`
  disposal exactly once, idempotent `dispose()`. `scene.test.ts`: 400/100 ms countdown, removal on
  completion, no opacity writes (asserted + grep).
- **AC-3 — directional travel (scene parts):** **met.** `scene.test.ts` (51 tests): four-direction pose
  tables (positions + targets, identity quaternion), captured `travelFrom` regression, pending rebuild
  exactly once per level with per-direction placement and the snapshot's style/grid size, follow-ups
  rebuild nothing, chained second travel, departure/arrival framing gates × aspects {2/3, 16/9, 7/3},
  level-0 rest `(0,0,12)` + continuity at p = 1, reduced instant positional swap, starfield anchor at the
  lateral poses, retained + extended corner-ray coverage gates, aspect stability.
- **AC-4 — regression gate (partial, render-side):** **met.** Full workspace green (328/328), coverage
  ≥ 80 × 4, lint/typecheck 0, plate grep empty, no banned matchers, no new dependencies; the only
  accepted-behaviour literal changed is the ratified tile-extent re-pin (AC-2's supersession ledger).

## Deviations from spec

None. The implementation follows the formula-authoritative r2 pose table; the only cross-layer edit is the
ratified r3 one-line test re-pin.
