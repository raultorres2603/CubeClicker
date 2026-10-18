# Build log — T7 — Starfield (galaxy backdrop)

Task: T7 (2026-10-18)
Files changed: `src/frontend/src/render/starfield.ts` (new), `src/frontend/src/render/starfield.test.ts` (new), `docs/features/cube-game-frontend/build-log-T7.md` (new)

## What changed & why (sketch, ≤5 lines)

- `createStarfield(random)` builds exactly `STAR_COUNT` stars (imported from `game/effects.ts` — no local constant) into one `THREE.Points`: 4 draws per star in `x → y → z → brightness` order, mapped onto the star disk box `x ∈ [-70, 70]`, `y ∈ [-40, 40]`, `z ∈ [-60, -8]` (stars stay inside the camera `far` plane even at the travel extreme `z = 90`), greyscale vertex colours from the brightness draws.
- `update(dtMs)` applies the slow drift — `rotation.y += dtMs * 2⁻¹⁶` rad (a power of two, so integer `dtMs` scales exactly and tests pin exact angles) — and nothing else.
- `update(dtMs, travelProgress?)` additionally sets the AC-3 travel streak: axis-aligned elongation of the disk along the travel axis `z`, `scale = (1, 1, 1 + 0.5·clamp(progress, 0, 1))` → bounded in `[1, 1.5]`; an omitted `travelProgress` keeps the current streak (the frame loop advances drift every frame, the scene feeds progress only while `travel` runs).
- `dispose()` releases the geometry and the material of the starfield.
- Tests run in `node` against the real three.js objects (no mocks, no jsdom), with a replayed-draw random for hand-computed exact coordinates and a seeded LCG for the deterministic seeded stream.

## Decisions

- **One home for the count.** `starfield.ts:20 import { STAR_COUNT } from '../game/effects';` — the module contains no literal `1200` (grep below). The `1200` literal appears once in the test as the AC-3 pin (the constants file pins the constant itself in `effects.test.ts`).
- **Streak = axis-aligned elongation along the travel axis.** `PointsMaterial` sprites are square, so a per-star sprite streak would need a custom shader; the plan's contract asks for a *streak input* with axis-aligned elongation, so the star disk is stretched along `z` (the axis the camera travels on) by a bounded factor. Max elongation `0.5` (scale `1.5`) is chosen so that, with `far = 200` and the camera at the travel extreme `(0, 0, 90)`, even the far corner stars stay inside the frustum (`√(180² + 70² + 40²) ≈ 197.2 < 200`).
- **Exact float pins over tolerance.** The drift rate is `2⁻¹⁶` rad/ms and the star box coordinates are dyadic-rational, so every assertion is an exact `toBe`/`toEqual` on real values — no `closeTo`, no bounded exceptions used (0 of 1 allowed).
- **`update` keeps the last streak when the progress argument is omitted** — the pinned signature is `update(dtMs, travelProgress?)`, so the drift-only frame call must not silently reset the travel effect.
- **No extra module surface.** Only `Starfield` + `createStarfield` are exported, exactly the plan § Render interfaces contract (T12 consumes `points` / `update` / `dispose`).

## Testing tiers (skill § Testing bar)

- **Unit:** `starfield.test.ts` — 10 tests over the real three.js objects with injected random sources.
- **Integration:** documented exception — `starfield.ts` is a render *leaf* module (plan § Architecture layer 2): it has no external boundary (no I/O, no timing source, no DOM, no wire) and its only integration point is `render/scene.ts`, which is **not** in T7's `files_owned` (it is T12's, and T12's task text owns the `starfield` attachment/travel-progress integration assertions: `scene.test.ts` — "background value, starfield attached, travel-progress applied"). Nothing cross-module could be exercised without editing T12's files.

## Evidence

All commands run from the repository root, in a parallel batch (T3/T6/T8/T9 artefacts landed in the same tree during the window).

```
$ npm test --workspace @cubeclicker/frontend            # exit=0
 ✓ src/game/effects.test.ts (18 tests) 5ms
 ✓ src/game/progression.test.ts (10 tests) 5ms
 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/game/board.test.ts (14 tests) 15ms
 ✓ src/render/starfield.test.ts (10 tests) 18ms
 ✓ src/game/rotation.test.ts (31 tests) 8ms
 ✓ src/App.test.tsx (1 test) 7ms
 ✓ src/game/engine.test.ts (33 tests) 28ms
 ✓ src/render/cube-view.test.ts (23 tests) 27ms
 ✓ src/render/particles.test.ts (19 tests) 19ms

 Test Files  10 passed (10)
      Tests  169 passed (169)
```

```
$ npm run coverage --workspace @cubeclicker/frontend      # exit=0
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |    99.3 |    99.34 |     100 |    99.3 |
 src             |      84 |      100 |     100 |    84 |
  App.tsx        |      84 |      100 |     100 |    84 | 19-22
 src/game        |     100 |      100 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
  engine.ts      |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  rotation.ts    |     100 |      100 |     100 |     100 |
  types.ts       |     100 |      100 |     100 |     100 |
 src/render      |     100 |      100 |     100 |     100 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |      <-- this task
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
```

Workspace aggregate **99.3 statements / 99.34 branches / 100 functions / 99.3 lines** — all four metrics ≥ 80; `starfield.ts` itself is 100/100/100/100.

```
$ npm run typecheck --workspace @cubeclicker/frontend     # exit=0
> tsc --noEmit
(no output)

$ npm run lint                                            # exit=0
> eslint .
(no output)
```

Single-home constant (no local redefinition; the module has zero `1200` literals):

```
$ grep -c "1200" src/frontend/src/render/starfield.ts
0
$ grep -n "STAR_COUNT" src/frontend/src/render/starfield.ts
20:import { STAR_COUNT } from '../game/effects';
80:  const positions = new Float32Array(STAR_COUNT * 3);
81:  const colors = new Float32Array(STAR_COUNT * 3);
83:  for (let index = 0; index < STAR_COUNT; index += 1) {
```

Banned-matcher grep over the new test file (exit 1 = no matches):

```
$ grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toBeTruthy|toBeDefined|toBeFalsy|toThrow\(" src/frontend/src/render/starfield.test.ts
(no output; exit=1)
```

Scope check (only this task's paths are untracked/modified by this task; the other untracked entries in `git status` belong to the concurrent tasks):

```
$ git status --porcelain=v1 -- <my three paths>
?? src/frontend/src/render/starfield.ts
?? src/frontend/src/render/starfield.test.ts
```

Evidence of the assertions themselves (exact values, excerpts):

```
$ npx vitest run src/render/starfield.test.ts            # exit=0
 ✓ src/render/starfield.test.ts (10 tests) 13ms
```

### Parallel-batch note (transparency, not a T7 failure)

Two intermediate workspace runs during the batch failed **exclusively** on other tasks' in-flight files, and both passed again once those files settled:

- `20:07:21` run: `npm run coverage --workspace @cubeclicker/frontend` → exit 1 with `All files 68.57%`, caused by `src/game/engine.ts` (T6) sitting at `0%` (its test file had not landed yet); `src/render/starfield.ts` was already `100%` in that same report.
- `20:04:36` run: `npm test` → 8 failures, all in `src/render/cube-view.test.ts` (T8, mid-write).
- One earlier coverage run inside this window (`20:06:28`) already passed at `82.29 / 98.63 / 100 / 82.29`, exit 0, before the T6/T9 files landed.

The final run above (all four commands, exit 0) is the gate evidence; no file outside T7 was touched to obtain it.

## Acceptance audit

- **AC-3 (galaxy starfield backdrop)** → **met**:
  - "exactly one starfield `THREE.Points` object containing exactly `STAR_COUNT` stars" → `createStarfield` returns a single `Points` (test: `toBeInstanceOf(Points)`), `position.count === STAR_COUNT` and `=== 1200` (tests 1); the object is never rebuilt across frames.
  - "at deterministic positions (asserted with a seeded fake random)" → test 3 pins the first star `(0, 0, -34)` and the last star `(70, -40, -60)` from replayed draws; test 5 pins seed 7's exact first `(-36.570682525634766, 33.07946014404297, -39.84956741333008)` and last `(-42.426448822021484, -39.72283935546875, -9.103534698486328)` stars plus full-array equality for the same seed and inequality for another seed; test 4 pins exactly 4 draws per star.
  - "exposes a travel-progress input (0..1) … (streak)" → `update(dtMs, travelProgress?)`; tests: 0 → scale `[1,1,1]`, 0.5 → `[1,1,1.25]`, 1 → `[1,1,1.5]`, out-of-range inputs clamped to `[1,1,1.5]`/`[1,1,1]`, and the streak survives a progress-less frame.
  - "no starfield is rebuilt across frames" → test 6: same `Points`, same geometry, same position attribute object and byte-identical position values after three updates (drift + travel).
  - *Not in this task's files:* the scene-side driving of the input (background value, attachment, `travelProgress` during `travel`) is `scene.test.ts` evidence owned by T12 (§ Interfaces: `applySnapshot` "starfield travel-progress").
- **AC-16 (bounded rendering resources — one starfield `Points`)** → **met**: one `Points` object with one geometry + one material for the whole backdrop, `dispose()` releases both exactly once (`toHaveBeenCalledTimes(1)` on both spies — no leak across the T12 level rebuilds); star count is the pinned constant `STAR_COUNT`.
- **Drift (`update(dtMs)`)** → **met**: exact angles `0.0152587890625` after 1000 ms, `0.030517578125` after 2000 ms, unchanged by `update(0)`, `0.91552734375` after one minute (< 1 rad → "slow"), and `rotation.x`/`rotation.z` stay exactly `0`.

## Deviations from spec

None. Interface surface, constant home, determinism and disposal follow plan § Render interfaces / § Constant homes; the only unpinned values (star box extents, point size, drift rate, max elongation) are internal to the module and pinned by tests.
