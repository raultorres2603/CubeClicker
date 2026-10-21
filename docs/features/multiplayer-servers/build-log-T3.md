# Build log — T3 — Backend cube state: validation and next-cube draws

Task: T3 (2026-10-21)
Files changed: `src/backend/src/game/cubes.ts`, `src/backend/src/game/cubes.test.ts`,
`docs/features/multiplayer-servers/build-log-T3.md`

Sketch (≤5 lines): mirror the accepted frontend id scheme + style cycle → `allIds` /
`styleForLevel` / private `drawGridSize` → `validateExplode` and `isComplete` over the
authoritative removed set → `createNextCube(prev, styleFor, random)` → unit tests with exact
values for N = 3 and N = 7 and the pinned draws.

What changed & why:
- `cubes.ts` (new, pure): `CubeState` (levelIndex/gridSize/styleId/removedIds `Set<string>`),
  `allIds(gridSize)` (the `6·N²` `face:row:col` ids), `styleForLevel`, `createNextCube`,
  `validateExplode`, `isComplete`, plus the mirrored pinned constants (`FACE_IDS`,
  `MIN_GRID_SIZE`, `MAX_GRID_SIZE`, `CUBE_STYLE_IDS`). No timers, no DOM, no I/O,
  randomness only through the injected `random` (spec § 5, § Pinned constants, AC-14/AC-15).
- `cubes.test.ts` (new, 24 tests): the exact 54-id 3×3 level literal, the 7×7 order indices
  and 294-id uniqueness, the style cycle for levels 0…6 and across two advances, the pinned
  draws (`0.0 → 3`, `0.5 → 5`, `0.9999 → 7`, plus the floor edges `0.2 → 4`, `0.6 → 6`),
  one-draw-per-cube, the validation matrix for N = 3 and N = 7 (accept / removed / unknown /
  malformed / wrong level), the completion boundaries (53/54 and 293/294) and the
  coverage-not-size rule.
- No other file touched (`config.ts`, `servers.ts`, `app.ts`, package files, frontend all
  unchanged).

## Mirrored engine citations (nothing invented)

| Backend element | Mirrored source (accepted feature) | What it pins |
| --- | --- | --- |
| `allIds` format | `src/frontend/src/game/board.ts:12-14` `miniCubeId(faceId,row,col) => \`${faceId}:${row}:${col}\`` | id scheme `face:row:col` |
| `allIds` order | `src/frontend/src/game/board.ts:17-25` `createFace` (rows ascending, then columns; faces from `FACE_IDS`) | canonical id order |
| `FACE_IDS` | `src/frontend/src/game/types.ts:17` `['front','back','left','right','top','bottom']` | face order |
| `MIN_GRID_SIZE`/`MAX_GRID_SIZE` | `src/frontend/src/game/types.ts:26-30` `MINI_CUBE_GRID_MIN = 3`, `MINI_CUBE_GRID_MAX = 7` | grid bounds |
| `drawGridSize` | `src/frontend/src/game/engine.ts:196-201` `N = MIN + ⌊draw·(MAX−MIN+1)⌋` = `3 + ⌊draw·5⌋` | server draw formula |
| `CUBE_STYLE_IDS` | `src/frontend/src/game/progression.ts:16-62` `CUBE_STYLES` ids | the five style ids |
| `styleForLevel` | `src/frontend/src/game/progression.ts:75-78` `currentStyle` = `CUBE_STYLES[levelIndex % 5]` | cycle + wrap |
| cycle pin | `src/frontend/src/game/progression.test.ts` (ids list; 7-level wrap) | identical sequence |

Level-advance semantics (one draw, fresh board, style by the advanced level) copy
`engine.ts:488-503` (`advanceLevel`: progression +1 → `drawGridSize(random)` →
`currentStyle(progression)`).

## Decisions

- **`createNextCube(null, …)` → `levelIndex 0`.** The plan says "`levelIndex + 1`" and types
  `prev` as `CubeState | null`; `null` is the member's first cube, so its level is 0 and
  every later cube is exactly `prev.levelIndex + 1`. Asserted concretely.
- **The server-side style cycle lives in `cubes.ts`** (`CUBE_STYLE_IDS` + `styleForLevel`)
  although the plan's interface list only mentions `createNextCube(…, styleFor, …)`. Reason:
  the task requires a *concrete* style-id sequence across two advances; asserting that with a
  test-local lookup would re-assert the test's own mock (a tautology). `cubes.ts` is the home
  of the level draw, so the mirrored cycle sits beside it; `createNextCube` still takes the
  lookup as a parameter exactly as the plan pins, and T5 may pass `styleForLevel`.
- **`validateExplode` validates against `allIds(cube.gridSize)` membership.** This is exactly
  the frontend "id exists on the board" semantics, so malformed ids (`front:0`, `front:00:0`,
  `front:0:3` at N = 3, `FRONT:0:0`, trailing space) are rejected with no hand-rolled parser
  to drift. Cost: one array of ≤ 294 ids per validated click — bounded by the 30/s rate limit
  and negligible against the broadcast fan-out (plan § Capacity analysis).
- **`isComplete` requires *coverage*, not set size.** A set of 54 entries that misses one
  canonical id (e.g. holds `front:9:9`) is rejected; extra ids can never substitute.
- **Integration tier — documented exception.** `cubes.ts` is a pure module with no I/O
  boundary: it has no route, socket, component or wire to exercise until T5 wires the hub
  (`hub.test.ts` owns the `explode`/`cubeCompleted` message sequences per spec AC-14/AC-15).
  This task ships the unit tier only; the module is fully exercised through its public API.
  No mocks other than the injected `random`/`styleFor` seams the plan specifies.

## Evidence

Note: tasks T2 and T4 landed in this workspace concurrently; their files
(`players.ts`/`players.test.ts`, `protocol.ts`/`protocol.test.ts`) appear in the run output
below. No failure was transient or attributable to them; every command exited 0.

```
$ npx vitest run src/game/cubes.test.ts   (src/backend)
 ✓ src/game/cubes.test.ts (24 tests) 9ms

 Test Files  1 passed (1)
      Tests  24 passed (24)
```
(One assertion in the 7×7 order test initially indexed `back:6:6` at 98 instead of 97 — my
own off-by-one in the test fixture, fixed to `ids[97] = 'back:6:6'`, `ids[98] = 'left:0:0'`;
the implementation was correct.)

```
$ npm test --workspace @cubeclicker/backend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/servers.test.ts (30 tests) 6ms
 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/game/cubes.test.ts (24 tests) 11ms
 ✓ src/game/players.test.ts (13 tests) 12ms
 ✓ src/game/protocol.test.ts (56 tests) 7ms
 ✓ src/app.test.ts (4 tests) 139ms

 Test Files  6 passed (6)
      Tests  140 passed (140)
   Start at  22:36:40
   Duration  554ms
```

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 Test Files  6 passed (6)
      Tests  140 passed (140)

 % Coverage report from v8
--------------|---------|----------|---------|---------|-------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------|---------|----------|---------|---------|-------------------
All files     |     100 |      100 |     100 |     100 |
 src          |     100 |      100 |     100 |     100 |
  app.ts      |     100 |      100 |     100 |     100 |
 src/game     |     100 |      100 |     100 |     100 |
  config.ts   |     100 |      100 |     100 |     100 |
  cubes.ts    |     100 |      100 |     100 |     100 |
  players.ts  |     100 |      100 |     100 |     100 |
  protocol.ts |     100 |      100 |     100 |     100 |
  servers.ts  |     100 |      100 |     100 |     100 |
--------------|---------|----------|---------|---------|-------------------
```

Coverage table (gate ≥ 80 on all four metrics, per workspace):

| Scope | Stmts | Branch | Funcs | Lines | Result |
| --- | --- | --- | --- | --- | --- |
| `cubes.ts` | 100 | 100 | 100 | 100 | pass |
| backend workspace (all files) | 100 | 100 | 100 | 100 | pass |

```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit
(exit 0, no output)

$ npm run lint
> lint
> eslint .
(exit 0, no output)
```

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled" src/backend/src/game/cubes.test.ts
(no matches, exit 1)

$ grep -n "Math.random\|document\|window\|from 'fs'" src/backend/src/game/cubes.ts
(no matches, exit 1)
```

## Acceptance audit

- **AC-14 (validation matrix, module level) → met.** `validateExplode` accepts an existing,
  unremoved id of the current level and rejects removed ids, unknown/malformed ids and wrong
  levels; matrices asserted for N = 3 (13 malformed/unknown cases + accept/removed/level
  cases) and N = 7 (accept/removed/out-of-range/level cases), plus the cross-grid flip
  (`front:0:3` rejected at N = 3, accepted at N = 4). Hub-level broadcast sets and the rate
  limit remain T5's evidence.
- **AC-15 (completion boundary + server-drawn levels, module level) → met.**
  `isComplete` false at 53/54 and 293/294 removals, true at full coverage, false for another
  level and for a same-size set missing a canonical id; `createNextCube` advances exactly one
  level, pins `N = 3 + ⌊draw·5⌋` (`0.0 → 3`, `0.5 → 5`, `0.9999 → 7`, floor edges 4/6),
  consumes exactly one draw, assigns the style from the accepted `levelIndex % 5` cycle
  (`obsidian-neon → crimson-alloy → emerald-crystal`, wrap at 5) and starts with an empty
  removed set. `levelAdvanced`/`worldEntered` delivery is T5's evidence.

## Deviations from spec

- **Extra exports** (`CUBE_STYLE_IDS`, `styleForLevel`, `FACE_IDS`, `MIN_GRID_SIZE`,
  `MAX_GRID_SIZE`) beyond the plan's interface listing — same semantics, needed to assert the
  style cycle and id bounds concretely instead of restating test mocks (see Decisions).
  `createNextCube`'s signature is unchanged from the plan.
- **`prev === null` → level 0** — the plan does not spell out the `null` case (see Decisions).
- **No integration-tier test in this task** — documented exception above (pure module, the
  boundary is T5's `hub.test.ts`).

## Open questions

- Q-T3-1: T5 may either import `styleForLevel`/`CUBE_STYLE_IDS` from `cubes.ts` (my
  recommendation — one backend home for the cycle) or pass its own identical lookup. Both
  satisfy the pinned cycle; the ids are asserted here.
- Q-T3-2: `createNextCube` trusts the injected `styleFor` without checking that the returned
  id is one of the five pinned ids (the plan types it as `(levelIndex) => string`). Should the
  hub validate style ids on the way out, or is the injected-function contract (internal,
  never client-driven) sufficient?
