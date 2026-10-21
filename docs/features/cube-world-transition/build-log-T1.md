# Build log — T1 — Game layer: random mini-cube counts, travel direction and the snapshot contract

Task: T1 (`cube-world-transition`, 2026-10-21)
Files changed: `src/frontend/src/game/types.ts`, `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`, `src/frontend/src/game/board.test.ts`, `src/frontend/src/game/session.ts`, `src/frontend/src/game/session.test.ts`, `src/frontend/src/App.test.tsx` (test fixture only), `docs/product/glossary.md`, `docs/features/cube-world-transition/build-log-T1.md`

## What changed & why

- `types.ts` adds the per-level grid range (`MINI_CUBE_GRID_MIN = 3`, `MINI_CUBE_GRID_MAX = 7`), `TravelDirection` and the pinned `TRAVEL_DIRECTIONS = ['left', 'right', 'top', 'bottom']` (draw index `⌊draw · 4⌋` → constant 0.5 selects `top`).
- `engine.ts` draws `N = 3 + ⌊draw · 5⌋` once at creation and once per level advance (skipped entirely when `gridSize` is injected), draws the travel direction once at `startTravel` and clears it when `travel` ends, and exposes both through `EngineSnapshot` (`gridSize`, `travelDirection`). The `options.random ?? Math.random` fallback becomes a private fixed-seed LCG (seed 1, 1664525, 1013904223, mod 2³²), and `setRandomSource` is added so the session can inject the host RNG at attach.
- `session.ts` `attach` now calls `engine.setRandomSource(env.random)` and builds the scene with the engine snapshot's `style` **and** `gridSize`, both read from one snapshot.
- Tests pin the new contract: `board.test.ts` covers N ∈ {3,4,5,6,7} (9/16/25/36/49 per face), `engine.test.ts` pins the LCG fallback, draw counts, the 0.5 → N 5 / `top` mapping, a seed-19 per-level/per-travel sequence, the override draw-free path and `setRandomSource`; `session.test.ts` proves the attach-time injection, the scene grid pass-through and the travel-only direction field. `App.test.tsx` only gains the two fixture fields.
- `glossary.md` updates **cube level**, **face**, **mini-cube** to the random-N model and adds **cube world position**.

## Decisions

- Kept `GRID_SIZE = 5` as the documented default/injected value; it is no longer the per-level size. No existing export was removed or re-shaped.
- `setRandomSource` only redirects future draws; the published snapshot keeps its identity (asserted with `expect(engine.getSnapshot()).toBe(beforeSwap)`), preserving snapshot referential stability.
- Draw order is pinned exactly: creation grid draw → burst draws → travel-start direction draw → midpoint grid draw. Tests use a scripted source that throws on extra draws, so an accidental extra/missing draw fails loudly.
- `travelDirection` is nulled at the `travel → playing` transition (and is `null` in `intro`), so it is non-null exactly during `travel`.

## Evidence

Raw commands, run in the repository root on 2026-10-21.

### 1. `npm test --workspace @cubeclicker/frontend` → exit 0

```
 Test Files  20 passed (20)
      Tests  306 passed (306)
   Start at  14:52:31
   Duration  600ms (transform 1.56s, setup 0ms, collect 3.77s, tests 535ms, environment 4ms, prepare 1.65s)
```

Changed test files in that run:

```
 ✓ src/game/board.test.ts (18 tests) 30ms
 ✓ src/game/engine.test.ts (45 tests) 30ms
 ✓ src/game/session.test.ts (23 tests) 82ms
 ✓ src/App.test.tsx (4 tests) 15ms
```

### 2. `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (COVERAGE_EXIT=0)

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.32 |    99.37 |     100 |   99.32 |
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
 Test Files  20 passed (20)
      Tests  306 passed (306)
   Start at  14:52:39
   Duration  807ms (transform 1.75s, setup 0ms, collect 4.22s, tests 628ms, environment 4ms, prepare 1.90s)
```

Four metrics ≥ 80: statements **99.32**, branches **99.37**, functions **100**, lines **99.32**.
No coverage exclusions or threshold changes were introduced in this task; the pre-existing uncovered
lines (`GameCanvas.tsx` 23-30, `connection.ts` 53-54/99-100, `session.ts` 173) are the accepted
residuals recorded for T3, not new ones from T1 (`engine.ts`, `types.ts`, `board.ts` are 100%).

### 3. `npm run typecheck --workspace @cubeclicker/frontend` → exit 0

```
> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### 4. `npm run lint` → exit 0

```
> lint
> eslint .

LINT_EXIT=0
```

### 5. `grep -n "Math\.random" src/frontend/src/game` → no matches (exit 1)

```
--- Math.random in game/ ---
EXIT=1 (1 = no matches)
```

### 6. `grep -n "window\|document\|localStorage\|sessionStorage" src/frontend/src/game` → no matches (exit 1)

```
--- DOM globals in game/ ---
EXIT=1 (1 = no matches)
```

### 7. Glossary terms present

```
$ grep -n "mini-cube\|### face\|cube level\|cube world position" docs/product/glossary.md
18:### cube level
20:**Definition:** A single cube in the run, made of six **faces** of N² **mini-cubes** each (6N² mini-cubes per cube level), where N is the level's random grid size — every cube level draws its own N in 3 to 7. Clearing every face completes the cube level: the game travels to the next cube level, which spawns at a random **cube world position** — left, right, above or below the finished cube, 24 world units away — as a fresh cube in a new style and with its own random grid size, while the player's stats carry over (online occupancy of those positions is a future feature).
21:**Example:** Destroying the last mini-cube of the sixth face completes the cube level and travels to the next cube.
23:### cube world position
25:**Definition:** The fixed position of a **cube level** in the game's flat world plane. The first cube level sits at the origin; each new cube level spawns at the previous cube's world position plus the travel-direction offset of 24 world units (left, right, above or below), so the walk accumulates across levels. The camera always rests above the current cube's world position, looking at it. Future online play will assign positions with occupancy checks, so that no two players' cubes share a position — that is out of scope for now.
26:**Example:** A cube level that travels to the right puts the next cube at 24 world units to the right of the finished one, and two consecutive rightward travels land at 48 world units.
28:### face
30:**Definition:** One of the six flat sides of the cube — front, back, left, right, top and bottom — each an N×N grid of **mini-cubes**, where N is the cube level's random grid size (3 to 7), identical on all six faces. A face is cleared (and disappears from the cube) when its last mini-cube is destroyed.
31:**Example:** Destroying every mini-cube on the front face clears that face, and the remaining five faces stay playable.
38:### mini-cube
40:**Definition:** A single clickable tile of a **face**: one of the N² cells of that face's N×N grid (N is the cube level's random grid size, 3 to 7), identified as `face:row:col` with 0-based rows and columns (for example `front:0:0`). The tiles sit flush edge-to-edge, so the cube's surface reads as one giant cube built from mini-cubes; destroying a mini-cube removes it from its face for good and exposes the dark interior behind it. It is the unit of destruction for the cube.
41:**Example:** The mini-cube `front:0:0` is the top-left tile of the front face; on a 5×5 face destroying it leaves 24 mini-cubes on that face.
```

### 8. Banned-matcher grep over the changed test files → no matches (exit 1)

```
$ grep -n "expect\.anything\|expect\.any\|objectContaining\|arrayContaining\|stringContaining\|stringMatching\|toMatchObject\|toBeCloseTo\|toBeDefined\|toBeTruthy" \
    src/frontend/src/game/engine.test.ts src/frontend/src/game/board.test.ts src/frontend/src/game/session.test.ts src/frontend/src/App.test.tsx
EXIT=1 (1 = none)
```

No `toBeCloseTo`; the bounded-exception budget stays 0 for this task.

## Pinned values the tests assert

- LCG(1) draw 0 = `0.23645552527159452` → level 0 `N = 4` (16 per face); the fallback burst replays the
  same stream advanced by one grid draw (`front:2:2` burst `lifetimeMs` 350; first/last particle literals
  pinned in `engine.test.ts`).
- LCG(42) draw 0 = `0.25234517478384078` → `N = 4`; burst replayed one draw ahead.
- LCG(19) draws → level 0 `N = 4`, direction `left`; level 1 `N = 7`, direction `right`; level 2 `N = 3`
  (9 per face).
- Constant `0.5` → `N = 5` every level and direction `top`.
- Scripted `[0.1, 0.5, 0.7]` → `N = 3` at level 0, direction `top`, `N = 6` at level 1; an extra draw throws.
- Injected `gridSize: 4` consumes **0** grid draws (1 direction draw at travel start).
- Session with bare engine + `env.random = () => 0` → snapshot `gridSize` 4, scene front/right face
  `count` 16, first 4×4 tile centre `[-1.875, 1.875, 2.625]`, travel direction `left`.

## Acceptance audit (T1 scope: AC-1, AC-3 engine + session parts, AC-5)

- **AC-1 — met.** `types.ts` exports `MINI_CUBE_GRID_MIN === 3` / `MINI_CUBE_GRID_MAX === 7`; `board.test.ts`
  covers N ∈ {3,4,5,6,7} with exact per-face counts 9/16/25/36/49, ascending rows/cols and unique ids;
  `engine.test.ts` pins one creation draw, one draw per level advance, `N = 3 + ⌊draw·5⌋`, the 0.5 → 5
  case, the seed-19 per-level sequence, the draw-free override, and `snapshot.gridSize` across
  intro → playing → travel → advance → playing. Every level's six faces carry exactly N² mini-cubes
  (`snapshot.board` length arrays). Retained click/explode/stats tests still pass.
- **AC-3 (engine + session parts) — met.** Exactly one direction draw at `startTravel`
  (`TRAVEL_DIRECTIONS[⌊draw·4⌋]`, 0.5 → `top`, seed 19 → `left`/`right`); `snapshot.travelDirection` is
  the drawn value during `travel` and `null` in `intro`/`playing` (and after the midpoint it still reports
  the running direction); midpoint advance, `levelChanged` once, `travelStarted` once, input gating and
  `dtMs ≤ 0` retained. Session `attach` injects `env.random` (recorded twice across dispose/re-attach),
  builds the scene with the engine's `gridSize` (16 instances on a 4×4 face through the recorded render
  call), and exposes the travel-only direction. The scene/pose/framing parts of AC-3 belong to T2.
- **AC-5 — met.** Glossary grep above shows **cube level**, **face** and **mini-cube** rewritten to the
  random-N model in definition+example format and the new canonical **cube world position** term, with no
  other term redefined.

## Mid-chain honesty (plan D-6)

After T1 and before T2, levels beyond 0 **render at level 0's grid size** (the scene's rebuild closure
does not yet take the snapshot's `gridSize`), and **out-of-range picks no-op** at the board. This is the
accepted, documented mid-chain state resolved by T2; this task claims no rendered/visual behavior for the
new grid or the directional flight. The glossary's "tiles sit flush edge-to-edge" clause is the AC-5
pinned wording for the T2 surface; it is not yet true at T1 and T2 delivers it.

## No out-of-scope edits

`git status --short -- src/frontend/src/render/` is empty: `cube-view.ts`, `scene.ts`, `picking.test.ts`
and `starfield.ts` were not touched by T1. No configs, dependencies, container assets or `.env*` changed.

## Deviations from spec

None. The T1 implementation follows plan § Interfaces and the pinned draw order verbatim; render-layer
work was deliberately left for T2.
