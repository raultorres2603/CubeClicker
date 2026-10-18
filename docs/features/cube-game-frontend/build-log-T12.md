# Build log — T12 — Scene composition, camera flights, intent application

Task: T12 (2026-10-18)
Files changed: `src/frontend/src/render/scene.ts` (new), `src/frontend/src/render/scene.test.ts` (new)
Commit: `feat: add scene composition with camera flights (T12)`

## Sketch (before coding)

1. `createSceneView({style, gridSize?, random?})` → `Scene` (black background) + 2 lights + starfield `Points` + cube view group + pooled particle group + pinned `PerspectiveCamera` (FOV 50 / 0.1 / 200, rest `(0,0,12)` looking at the origin).
2. `applyIntents`: `explosion` → `hideMiniCube` + burst at the tile's world origin (instance matrix premultiplied by the cube group's world matrix); `faceCleared` → opacity fade over the active profile's `faceFadeMs`, then `removeFace`; `levelChanged` → dispose the old cube view, build a fresh one in the new style; `travelStarted` → nothing (snapshot-driven).
3. `applySnapshot`: camera flights (intro `60 → 12` `easeOutCubic`, travel `12 → 90` `easeInOutQuad`, reduced motion → rest), streak input from `phaseProgress`, orientation via `interpolateRotation` → `rotation.set(pitch, yaw, 0)` (T3's pinned frame), cursor highlight, style reconciliation.
4. `update(dtMs)`: starfield drift + streak, particle aging, face fades. `dispose()`: starfield + cube view + particles exactly once, scene emptied; idempotent.
5. `scene.test.ts`: real three.js scene graph + fake `RendererAdapter`; AC-22 coordinates asserted verbatim at the pinned progress fractions.

## What changed & why

- New `render/scene.ts` — the composition root of the render layer: it owns the scene, the pinned camera, the two lights and the three landed render pieces (`starfield.ts` T7, `cube-view.ts` T8, `particles.ts` T9), and is the only place that converts engine `EffectIntent`s / `EngineSnapshot` values into three.js state (AC-3, AC-9, AC-10, AC-15, AC-16, AC-22).
- New `render/scene.test.ts` — 22 integration tests over real three.js objects (node, no GL) plus one fake `RendererAdapter` recording what the loop would hand the renderer.

## Decisions

- **Intents vs snapshot.** One-shot effects (explosion, face clear, level change) arrive through `applyIntents`; everything continuous (camera flights, orientation, cursor, streak, style reconciliation) is derived from the snapshot, so a dropped one-shot cannot leave the cube permanently inconsistent — a style that changes without its `levelChanged` is reconciled by the snapshot path (test: `rebuilds the cube when the snapshot style changes without its levelChanged intent`).
- **Face fade ownership.** `cube-view.removeFace` moves straight to the end state ("the scene drives the fade by lowering `opacity`"), so the scene keeps a `Map<FaceId, {elapsedMs, durationMs}>`, lowers `plate.material.opacity` linearly in `update`, and calls `removeFace` when the fade completes (400 ms default / 100 ms reduced — the same values `game/effects.ts` pins). A repeated `faceCleared` never restarts a running fade.
- **Explosion origin.** Read from the tile's `InstancedMesh` matrix (`row * gridSize + col`), premultiplied by the cube group's `matrixWorld`, so a rotated cube spawns the burst where the tile actually is (`+1` yaw maps the front row-0/col-0 tile `(-2, 2, 2.625)` to `(2.625, 2, 2)`, asserted). `hideMiniCube` runs first — it validates the id and only zero-scales the tile — so the position is still readable and no NaN can reach the pool.
- **Streak persistence.** `applySnapshot` stores the streak input (`phaseProgress` while travelling, else 0) and `update(dtMs)` feeds it to `starfield.update` on every frame, so frames that only advance time keep the current streak; leaving `travel` (or reduced motion) resets it to 0.
- **Reduced motion.** A reduced snapshot pins the camera to `(0,0,12)` for `intro` *and* `travel` and zeroes the streak input, so the whole fly-through collapses without a branch inside the flight formulas.
- **`applySnapshot` frame time.** The pinned `SceneView` signature carries `nowMs` (the loop passes it); the scene's snapshot application is a pure function of snapshot values (flights read `phaseProgress`, fades are `dt`-driven in `update`), so the implementation does not consume it. The interface keeps the two-parameter contract; the object literal implements the one parameter it uses (TS-legal) rather than declaring an unused argument that `@typescript-eslint/no-unused-vars` rejects.
- **Disposal.** `dispose()` releases starfield + cube view + particles exactly once (each `geometry.dispose`/`material.dispose` asserted once), then empties the scene; a second call is a no-op. `renderer.dispose()` is *not* called — the renderer belongs to the session (T13), asserted with the fake adapter.
- **No new constants beyond the AC-22 pins.** Camera/lens values are module constants; `GRID_SIZE`, `STAR_COUNT`, `PARTICLE_POOL_CAP`, the timings and the styles all come from the landed `game/**` modules (F2 constant homes).

## Evidence

### `npm test --workspace @cubeclicker/frontend` → 0

```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/progression.test.ts (10 tests) 6ms
 ✓ src/ws/connection.test.ts (10 tests) 14ms
 ✓ src/game/effects.test.ts (18 tests) 8ms
 ✓ src/game/rotation.test.ts (31 tests) 8ms
 ✓ src/game/board.test.ts (14 tests) 25ms
 ✓ src/game/engine.test.ts (33 tests) 18ms
 ✓ src/input/gestures.test.ts (21 tests) 5ms
 ✓ src/input/keyboard.test.ts (11 tests) 9ms
 ✓ src/render/starfield.test.ts (10 tests) 15ms
 ✓ src/render/particles.test.ts (19 tests) 20ms
 ✓ src/App.test.tsx (1 test) 10ms
 ✓ src/render/cube-view.test.ts (23 tests) 42ms
 ✓ src/render/picking.test.ts (9 tests) 28ms
 ✓ src/render/scene.test.ts (22 tests) 37ms

 Test Files  14 passed (14)
      Tests  232 passed (232)
```

### `npm run coverage --workspace @cubeclicker/frontend` → 0 (pre-gate, four metrics ≥ 80)

```
 Test Files  14 passed (14)
      Tests  232 passed (232)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.27 |     99.2 |     100 |   99.27 |
 src             |      84 |      100 |     100 |      84 |
  App.tsx        |      84 |      100 |     100 |      84 | 19-22
 src/game        |     100 |      100 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
  engine.ts      |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  rotation.ts    |     100 |      100 |     100 |     100 |
  types.ts       |     100 |      100 |     100 |     100 |
 src/input       |     100 |      100 |     100 |     100 |
  gestures.ts    |     100 |      100 |     100 |     100 |
  keyboard.ts    |     100 |      100 |     100 |     100 |
 src/render      |   99.66 |    99.21 |     100 |   99.66 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  picking.ts     |   93.54 |     87.5 |     100 |   93.54 | 88-89
  scene.ts       |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
```

`picking.ts` is T10's concurrent in-flight file (not this task's); the final run above is green with it present and `scene.ts` clears all four metrics at 100%. Early in this task the workspace run was red only inside `picking.test.ts` (a parallel builder mid-write, `error TS2552: Cannot find name 'Raycaster'` at the time); it settled before the runs recorded here.

### `npm run typecheck --workspace @cubeclicker/frontend` → 0

```
> typecheck
> tsc --noEmit
```
(exit 0; a filter `npx tsc --noEmit -p src/frontend/tsconfig.json | grep -E "scene\.(ts|test\.ts)"` returns no lines.)

### `npm run lint` → 0

```
> lint
> eslint .
```
(exit 0.)

### Banned-matcher grep over `scene.test.ts` → no matches

```
$ grep -nE "expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toBeTruthy|toBeDefined|toBeFalsy|not\.toThrow|toBeCloseTo|toHaveBeenCalled\(\)" src/frontend/src/render/scene.test.ts
grep exit: 1 (no matches)
```

No bounded exception used: every assertion is an exact value (`toEqual([0, 0, 21.75])`, `toBe(Math.PI / 4)`, `toHaveBeenCalledTimes(1)`, `getHexString()` …), including the Y-rotated origin `[2.625, 2, 2]` — V8's `sin(π/2)`/`cos(π/2)` error is absorbed by the float64 rounding of the ~2.6 values, so no tolerance is needed.

### Scope check

```
$ git status --short            # before commit
?? docs/features/cube-game-frontend/plan.md      (pre-existing untracked artifacts, not staged)
?? docs/features/cube-game-frontend/reviews/
?? docs/features/cube-game-frontend/spec.md
?? docs/features/cube-game-frontend/status.md
?? docs/features/cube-game-frontend/tasks.md
?? src/frontend/src/render/scene.test.ts
?? src/frontend/src/render/scene.ts
?? docs/features/cube-game-frontend/build-log-T12.md
$ git commit --only -- src/frontend/src/render/scene.ts src/frontend/src/render/scene.test.ts docs/features/cube-game-frontend/build-log-T12.md
$ git show --stat HEAD          # exactly the three files above (recorded post-commit below)
```

`git add` was never used; no directory was staged; no `--amend`; the parallel T10 files (`picking.ts`, `picking.test.ts`, `build-log-T10.md`) are untouched by this commit.

## Acceptance audit

- **AC-3 — galaxy backdrop + travel progress:** met. `sets a black background and assembles the starfield, lights, cube and particles` asserts `scene.background` is `Color(0x000000)`, one starfield `Points` with 1200 stars; `drives the streak from the travel progress and keeps it across progress-less frames` asserts scale `[1,1,1.25] → [1,1,1.5] → [1,1,1]`; `drifts the starfield through update and never rebuilds it` asserts the same `Points` object across frames.
- **AC-9 — face destruction in the scene:** met. `fades a cleared face over the pinned 400 ms …` asserts opacity `1 → 0.5 → 0`, plate `visible=false`, geometry/material disposed once, face removed from the group while the other five stay; reduced-motion variant pins the 100 ms fade.
- **AC-10 — level rebuild:** met. `rebuilds the cube view in the new style on levelChanged` asserts the group identity changes, the old group left the scene, its body geometry was disposed exactly once, the new grid is fully visible (tile scale `fround(0.9)`) and the new palette is applied (`1a0b0e` body / `ff4d6d` tiles).
- **AC-15 — disposal:** met. `disposes every resource exactly once and is idempotent` spies all twelve disposals (starfield, particles, body, tiles, plate, highlight) and asserts one call each with no arguments after a double `dispose()`, plus an emptied scene.
- **AC-16 — bounded resources:** met. Composition test pins 1 starfield `Points`, 6 `InstancedMesh` (25 instances each), 1 pooled particle `Points` (72 slots) and exactly 5 scene children; `returns to the baseline object counts after 10 explosion cycles` asserts identical object counts, identical `Points` identities and a released pool (`drawRange.count` 0) after each cycle.
- **AC-22 — camera flights:** met. Rest `[0,0,12]`, quaternion `[0,0,0,1]`, FOV 50 / near 0.1 / far 200; intro `[0,0,60] → [0,0,18] → [0,0,12]`; travel `[0,0,21.75] → [0,0,51] → [0,0,90]` (with the `travelStarted` marker asserted to move nothing); reduced motion keeps `[0,0,12]` at every pinned progress in both phases and resets the streak.
- **AC-12 (reduced path in the render layer):** met for the scene's share — reduced snapshots pin the camera and the streak; face fades use the reduced profile.
- **AC-17 (test bar / coverage):** met for this task's files — no banned matchers, no tolerance matcher, no useless tests, workspace coverage green, `game/**` untouched.

## Deviations from spec / plan

- None in behavior. The single contract nuance: the plan's `applySnapshot(snapshot, nowMs)` keeps its two-parameter signature, but the scene does not consume the frame time (nothing in the snapshot application needs a clock); the implementation therefore declares only the parameter it uses. Documented in the code comment and above.
- No dead-code exclusions, no weak assertions, no changes outside `files_owned`.

## Residual / notes for review

- The scene is exercised against real three.js objects with a fake `RendererAdapter`; there is no GL context in node (the spec's documented residual, mocked at T13's `webgl.ts`).
- Bursts are asserted through the pool's live buffer (`drawRange.count`, position triples), not through GPU output.
