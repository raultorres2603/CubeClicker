# Build log — T3 — Orientation, front-face and cursor model

Task: T3 (2026-10-18)
Branch: `main` (parallel batch with T4/T5; only T3-owned paths staged)
Files changed:
- `src/frontend/src/game/rotation.ts` (new)
- `src/frontend/src/game/rotation.test.ts` (new)
- `docs/features/cube-game-frontend/build-log-T3.md` (new, this file)

## What changed & why

- Added `rotateStep` (yaw `+direction` mod 4, pitch `+direction` clamped to `-1|0|1`), `frontFace` (yaw `front/left/back/right`, pitch `±1` → `top/bottom` from any yaw) and `interpolateRotation` (radians, shortest yaw way round, exact `PI/2` multiples at `t = 1`).
- Added `createCursor` (front-face center), `moveCursor` (dy/dx, clamped, face-preserving) and `reanchorCursor` (nearest remaining mini-cube on the front face by grid distance, then lowest row, then lowest column; `null` on an empty front face).
- 31 tests assert concrete step counters, exact face ids, exact radian values, concrete cursor ids and every clamp/tie-break/re-anchor case. The module is DOM-free and node-testable (`game/**`).

## Decisions

- **Rotation convention is pinned (free in the spec, so it is documented).** `yaw` = rotation about `+Y` (`rotation.y`), `pitch` = rotation about `+X` (`rotation.x`), applied in three.js' default `'XYZ'` Euler order. A `+1` yaw step is `+90°` about `+Y` (the `front` face slides to the player's right, `left` arrives at the front: `front → left → back → right`); a `+1` pitch step is `+90°` about `+X` (the `top` face arrives). Under exactly this composition, `frontFace(o)` *is* the face pointing at the camera — which the test "agrees with the camera-facing face of the rotation the renderer applies" re-derives numerically for all six faces (`Rx(pitch)·Ry(yaw)` puts the `frontFace` normal at `(0, 0, 1)`).
- **T12 must apply the rotation in the pinned frame** (`rotation.set(pitch, yaw, 0)`); picking's front-face gate (`pickMiniCube(..., frontFace(orientation), ...)`) is only correct together with it. Recorded here because the plan pins neither the sign of `yaw` nor the Euler order.
- **Shortest yaw path.** `interpolateRotation` normalises the yaw delta into `-1|0|1|2`, so `3 → 0` (one `+1` step) animates `+90°` (settling at `4 × PI/2` ≡ `2π`) instead of running backwards `-270°`. At `t = 1` every value is an exact multiple of `PI/2`; the tests assert the exact IEEE values (`1 * (PI/2)`, `0.5 * (PI/2)`, …) rather than approximate ones.
- **"Grid distance" = Manhattan (`|Δrow| + |Δcol|`)** — the plan's wording does not pin the metric; Manhattan is the literal grid (taxicab) distance, and it is explicitly pinned by a discriminating test (`[0,2]` vs `[1,1]`, both at distance 2 from `(2,2)`, resolved by the lowest row). A Chebyshev implementation fails that test. Flagged for the reviewer as a documented interpretation, not a drift.
- **No `preferred` cursor → board order** (lowest row, then lowest column) — the same rule as the final tie-break clause, so the function has a single deterministic ordering for every input; the engine (T6) passes the live cursor anyway.
- **`createCursor` center = `Math.floor(gridSize / 2)`** (5 → 2, 3 → 1, 4 → 2); pinned by tests. `moveCursor` never changes `faceId` (the cursor belongs to the front face; orientation changes go through `reanchorCursor`).
- **Immutable and branch-light.** Every function returns fresh values (tests assert `.not.toBe(input)` and non-mutation of inputs); `reanchorCursor` iterates the board directly (no helper with an unreachable "unknown face" fallback) so there is no dead defensive path.

## Evidence

### `npm test --workspace @cubeclicker/frontend` → exit 0

```
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/progression.test.ts (10 tests) 4ms
 ✓ src/game/effects.test.ts (18 tests) 5ms
 ✓ src/ws/connection.test.ts (10 tests) 12ms
 ✓ src/game/board.test.ts (14 tests) 15ms
 ✓ src/game/rotation.test.ts (31 tests) 8ms
 ✓ src/App.test.tsx (1 test) 7ms

 Test Files  6 passed (6)
      Tests  84 passed (84)

TEST_EXIT=0
```

`rotation.test.ts` = 31 tests: `createOrientation` (1), `rotateStep` (5), `frontFace` (4), `interpolateRotation` (5), `createCursor` (3), `moveCursor` (4), `reanchorCursor` (9).

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0, four metrics ≥ 80

```
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  6 passed (6)
      Tests  84 passed (84)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   97.91 |    97.89 |     100 |   97.91 |
 src             |      84 |      100 |     100 |      84 |
  App.tsx        |      84 |      100 |     100 |      84 | 19-22
 src/game        |     100 |      100 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  rotation.ts    |     100 |      100 |     100 |     100 |
  types.ts       |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

Workspace aggregate: statements 97.91, branches 97.89, functions 100, lines 97.91 — all ≥ 80. `rotation.ts` itself: 100 on all four metrics, no exclusions added, no threshold touched.

### `npm run typecheck --workspace @cubeclicker/frontend` → exit 0

```
> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### `npm run lint` → exit 0

```
> lint
> eslint .

LINT_EXIT=0
```

### Banned-matcher grep over the new test file → no matches

```
$ grep -nE "expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toBeDefined|toBeTruthy|toBeFalsy|toHaveBeenCalled" src/frontend/src/game/rotation.test.ts
BANNED_GREP_EXIT=1   # 1 = no match
$ grep -nE "toBeCloseTo|closeTo" src/frontend/src/game/rotation.test.ts
CLOSE_TO_EXIT=1      # 1 = no match
```

No banned matcher, no snapshot-only assertion, no assertion-free test: every assertion pins exact step counters, exact ids, exact IEEE radian values or exact integer-vector geometry. The one float-sensitive assertion (the Euler-order geometry re-derivation) rounds each axis to the integer it is instead of using an approximate matcher — the **bounded float exception budget is unused (0 of 1)**.

### DOM-free check (`game/**` stays node-testable)

```
$ grep -nE "\b(window|document|requestAnimationFrame|performance|matchMedia|localStorage|navigator)\b" src/frontend/src/game/rotation.ts src/frontend/src/game/rotation.test.ts
DOM_GREP_EXIT=1   # 1 = no match
```

### Scope check

```
$ git status --short
?? docs/features/cube-game-frontend/plan.md      (planning artifacts, not owned by T3)
?? docs/features/cube-game-frontend/reviews/
?? docs/features/cube-game-frontend/spec.md
?? docs/features/cube-game-frontend/status.md
?? docs/features/cube-game-frontend/tasks.md
?? src/frontend/src/game/rotation.test.ts        ← T3
?? src/frontend/src/game/rotation.ts             ← T3
```

Only `rotation.ts` / `rotation.test.ts` created; no tracked file modified, no other task's path touched. Staged explicitly: `git add src/frontend/src/game/rotation.ts src/frontend/src/game/rotation.test.ts docs/features/cube-game-frontend/build-log-T3.md` (never `git add .`/`-A`).

### Integration-tier exception

`rotation.ts` is a pure, DOM-free function module with **no integration boundary of its own** (plan D-2/D-5: no jsdom, no RTL, no I/O). The integration tier for this module is the composition that consumes it: `engine.test.ts` (T6, real board + orientation + cursor in the engine reducer) and `session.test.ts` (T13, input → engine). `rotation.test.ts` does exercise the real `board.ts` boundary (real `createBoard`/`removeMiniCube` graphs feed `reanchorCursor`), so the module-boundary behaviour is covered here; the cross-module boundary is covered by the named later tasks.

## Acceptance audit

- **AC-6 — Rotation settles on exact 90° multiples (radians asserted).** Met at module scope: `frontFace`/`rotateStep` tests pin the four yaw orientations (`front → left → back → right`, wrap after 4 steps) and the pitch poles; `interpolateRotation` tests assert the settle values `0`, `1 × PI/2`, `-1 × PI/2`, `2 × PI/2` (`= PI`), `4 × PI/2` (`= 2π`) and `0.5 × PI/2` mid-step with exact values, plus the yaw-seam shortest path and a per-face settle table. The gesture threshold, animation duration and one-step queue are T11/T6 (`gestures.test.ts`, `engine.test.ts`).
- **AC-7 — Keyboard rotation reaches every face.** Met at module scope: "reaches all six faces through keyboard steps only" builds the six orientations from single `rotateStep` calls (the exact thing the key map dispatches) and asserts `front → left → back → right → top → bottom`; "keeps a pole in front whatever the yaw is" pins the pitch clamp for all four yaw values; the geometric test proves the face reported is the one rendered at the camera. Key→command mapping itself is T11 (`keyboard.test.ts`).
- **AC-8 — Keyboard selection cursor.** Met at module scope: center start (`createCursor` → `front:2:2`), clamped W/A/S/D-equivalent moves at all four edges (concrete ids), deterministic re-anchor on destruction (Manhattan distance, then lowest row, then lowest column — including discriminating tie cases), orientation change re-anchoring onto the new front face (`left` for a yaw step, `top` for a pitch step), `null` on an empty front face and on a fully cleared board, and non-mutation of the board. Explode-through-the-cursor parity with clicks is T6 (`engine.test.ts`).
- **AC-17 (supporting) — concrete assertions / no banned matchers.** Verified by the greps above; no coverage exclusion, no threshold change.

## Deviations from spec

None. One documented interpretation: "grid distance" (plan § Orientation & cursor) is implemented as Manhattan distance and pinned by a discriminating test (see Decisions) — the plan does not name the metric.
