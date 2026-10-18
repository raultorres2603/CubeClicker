# Build log — T2 — Domain model, board logic & glossary terms

Task: T2 (2026-10-18)
Files changed: `src/frontend/src/game/types.ts` (new), `src/frontend/src/game/board.ts` (new), `src/frontend/src/game/board.test.ts` (new), `docs/product/glossary.md` (edit), `docs/features/cube-game-frontend/build-log-T2.md` (new)
What changed & why: Implemented the plan § Domain model contract verbatim — `types.ts` (FaceId/FACE_IDS/GRID_SIZE/MiniCubeId/MiniCube/Face/Board/GameStats/CubeStyle/Phase) and `board.ts` (`createBoard`, `removeMiniCube`, `remainingOnFace`), both DOM-free and node-testable. `board.test.ts` pins counts, ids, uniqueness, immutability, the no-op path and the `faceCleared`/`allCleared` transitions with concrete values. Glossary gained **cube level**, **face** and **mini-cube** in the existing definition+example format, worded to match the implemented board behavior.

Sketch (≤5 lines): `types.ts` = types + the two pinned constants (`FACE_IDS`, `GRID_SIZE`) only. `board.ts` = private `miniCubeId`/`createFace` helpers, then the three pinned exports; removal is copy-on-write over `board.faces` and returns transition flags. `removeMiniCube` scans faces, no-ops (`removed: false`, same board reference) when the id is absent; `faceCleared` = the face just emptied; `allCleared` = every face empty after that removal. `remainingOnFace` counts a face's mini-cubes (loop, so no unreachable defensive branch). Tests: constants pin, creation shape/ids, removal semantics, full clear.

Decisions:
- **No extra exports.** Exactly the pinned API (`createBoard`, `removeMiniCube`, `remainingOnFace`); the `face:row:col` format is built in one private helper and the removal result type is declared inline, so no contract has been widened for downstream tasks.
- **Flag semantics on a no-op.** Plan line 44: no-op → `removed: false`; `faceCleared` "true only on the transition to 0"; `allCleared` "true when every face has 0". I implement both as transition flags, so a no-op returns `{ removed: false, faceCleared: false, allCleared: false }` and the *same* board reference (nothing changed). This keeps the two flags symmetric and is what the engine needs (it only reads them after a successful removal); a literal alternative (`allCleared` recomputed on a no-op, which can only be `true` for an already-empty board) would report a "clear" for an event that removed nothing — recorded here as an interpretation, `board.test.ts` pins the chosen one.
- **`remainingOnFace` uses a loop rather than `find(...) ?? 0`** so every branch the function contains is reachable and test-covered (both outcomes of `face.id === faceId` are exercised by calls on `front` and `bottom`); the behavior is the same (absent face → 0).
- **Unit tier only, documented exception.** `game/**` is pure domain logic with no integration boundary (no I/O, no framework, nothing to cross) — the integration tiers for this behavior land in T6 (`engine.ts`, board→engine→intents) and T13 (`session.ts`, engine→scene). This is the skill's documented-exception case ("a change with no integration boundary"), recorded here rather than inventing a contrived boundary.
- **Mutation sanity check** (not a verify line, but the honest-failure evidence for "no useless tests"): flipping `faceCleared` to a constant `false`, and `GRID_SIZE` to 6, each breaks tests (2 and 11 failures respectively) — see § 6.

## What was run (raw evidence)

Baseline **before** this task's files existed (same command, empty `src/game/`):
```
 $ npm run coverage --workspace @cubeclicker/frontend
 % Coverage report from v8
----------------|---------|----------|---------|---------|-------------------
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------|---------|----------|---------|---------|-------------------
All files       |   92.79 |    92.85 |     100 |   92.79 |
 src            |      84 |      100 |     100 |      84 |
  App.tsx       |      84 |      100 |     100 |      84 | 19-22
 src/ws         |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
----------------|---------|----------|---------|---------|-------------------
```

### 1. `npm test --workspace @cubeclicker/frontend` → 0
```
$ npm test --workspace @cubeclicker/frontend

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ws/connection.test.ts (10 tests) 9ms
 ✓ src/game/board.test.ts (14 tests) 11ms
 ✓ src/App.test.tsx (1 test) 6ms

 Test Files  3 passed (3)
      Tests  25 passed (25)
   Start at  19:55:34
   Duration  293ms (transform 107ms, setup 0ms, collect 157ms, tests 26ms, environment 0ms, prepare 167ms)

exit=0
```
14 new tests in `src/game/board.test.ts`; the 11 pre-existing tests are untouched.

### 2. `npm run coverage --workspace @cubeclicker/frontend` → 0, all four metrics ≥ 80
```
$ npm run coverage --workspace @cubeclicker/frontend

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ws/connection.test.ts (10 tests) 9ms
 ✓ src/game/board.test.ts (14 tests) 14ms
 ✓ src/App.test.tsx (1 test) 8ms

 Test Files  3 passed (3)
      Tests  25 passed (25)
   Start at  19:55:34
   Duration  380ms (transform 109ms, collect 159ms, tests 31ms, environment 0ms, prepare 197ms)

 % Coverage report from v8
----------------|---------|----------|---------|---------|-------------------
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------|---------|----------|---------|---------|-------------------
All files       |      95 |    95.83 |     100 |      95 |
 src            |      84 |      100 |     100 |      84 |
  App.tsx       |      84 |      100 |     100 |      84 | 19-22
 src/game       |     100 |      100 |     100 |     100 |
  board.ts      |     100 |      100 |     100 |     100 |
  types.ts      |     100 |      100 |     100 |     100 |
 src/ws         |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
----------------|---------|----------|---------|---------|-------------------
exit=0
```
Workspace aggregate **95 / 95.83 / 100 / 95** (thresholds 80); both new files are **100 / 100 / 100 / 100**. The remaining uncovered lines are pre-existing (`App.tsx` 19-22, `connection.ts` 53-54/99-100) and untouched by this task; no file was excluded and no threshold was changed.

### 3. `npm run typecheck --workspace @cubeclicker/frontend` → 0
```
$ npm run typecheck --workspace @cubeclicker/frontend

> typecheck
> tsc --noEmit

exit=0
```

### 4. `npm run lint` → 0 (whole workspace)
```
$ npm run lint

> lint
> eslint .

exit=0
```

### 5. `grep -n "mini-cube\|cube level\|### face" docs/product/glossary.md` (all three terms present)
```
$ grep -n "mini-cube\|cube level\|### face" docs/product/glossary.md
18:### cube level
20:**Definition:** A single cube in the run, made of six **faces** of 25 **mini-cubes** each (150 mini-cubes per cube level). Clearing every face completes the cube level: the game travels to the next cube level, which is a fresh cube in a new style while the player's stats carry over.
21:**Example:** Destroying the last mini-cube of the sixth face completes the cube level and travels to the next cube.
23:### face
25:**Definition:** One of the six flat sides of the cube — front, back, left, right, top and bottom — each a 5×5 grid of **mini-cubes**. A face is cleared (and disappears from the cube) when its last mini-cube is destroyed.
26:**Example:** Destroying every mini-cube on the front face clears that face, and the remaining five faces stay playable.
33:### mini-cube
35:**Definition:** A single clickable tile of a **face**: one of the 25 cells of that face's 5×5 grid, identified as `face:row:col` with 0-based rows and columns (for example `front:0:0`). Destroying a mini-cube removes it from its face for good; it is the unit of destruction for the cube.
36:**Example:** The mini-cube `front:0:0` is the top-left tile of the front face, and destroying it leaves 24 mini-cubes on the front face.
exit=0
```
`git diff docs/product/glossary.md` is **additions only** (15 insertions, 0 deletions): the three new entries are slotted in alphabetical order (after `cube`; after `idle progress`) and no existing term is redefined.

### 6. Mutation sanity check (tests fail on real regressions)
```
--- mutation 1: faceCleared always false ---
 ❯ src/game/board.test.ts (14 tests | 2 failed) 19ms
 Test Files  1 failed | 2 passed (3)
      Tests  2 failed | 23 passed (25)
--- mutation 2: GRID_SIZE = 6 ---
 ❯ src/game/board.test.ts (14 tests | 11 failed) 25ms
 Test Files  1 failed | 2 passed (3)
      Tests  11 failed | 14 passed (25)
--- restored ---
 Test Files  3 passed (3)
      Tests  25 passed (25)
```
Both mutants were reverted immediately (`cp` from a backup taken before each mutation); the post-restore run is the `npm test` transcript in § 1.

### 7. Constraints self-check (banned matchers, DOM-freedom)
```
$ grep -nE "expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled\(" src/frontend/src/game/board.test.ts
exit=1 (1 = no matches)

$ grep -nE "window|document|requestAnimationFrame|performance|matchMedia|localStorage|sessionStorage|fetch\(" src/frontend/src/game/types.ts src/frontend/src/game/board.ts
exit=1 (1 = no matches)
```
No banned matcher appears in the new test file; `game/types.ts` and `game/board.ts` read no browser global (and import no three.js), so `game/**` stays DOM-free and node-testable. Both new test-fail-able assertions use concrete values (`toEqual` on exact ids/flag arrays, `toBe` on exact counts, `.toContain`/`.not.toContain` on exact ids) — no bounded exception was needed (0 of ≤ 1 used).

### 8. Scope check
```
$ wc -l src/frontend/src/game/*.ts
  248 src/frontend/src/game/board.test.ts
   75 src/frontend/src/game/board.ts
   64 src/frontend/src/game/types.ts
  387 total

$ git status --short
 M docs/product/glossary.md
?? docs/features/cube-game-frontend/plan.md      (planner artifact, not staged)
?? docs/features/cube-game-frontend/reviews/     (planner artifact, not staged)
?? docs/features/cube-game-frontend/spec.md      (planner artifact, not staged)
?? docs/features/cube-game-frontend/status.md    (orchestrator bookkeeping, not staged)
?? docs/features/cube-game-frontend/tasks.md     (planner artifact, not staged)
?? src/frontend/src/game/
```
Only the five `files_owned` paths are staged for this commit (`git add src/frontend/src/game/types.ts src/frontend/src/game/board.ts src/frontend/src/game/board.test.ts docs/product/glossary.md docs/features/cube-game-frontend/build-log-T2.md`); the untracked planner artifacts and `status.md` are left for the orchestrator. No config, container, backend, `App.tsx`, `main.tsx` or `ws/` file was touched.

## Acceptance audit
- **AC-4 (cube level structure)** → **met (board half; scene-view half is T8)**: `createBoard()` produces six faces in the pinned order, each with exactly `GRID_SIZE²` = 25 mini-cubes, ids `face:row:col` covering every row/col exactly once (asserted against the literal 150-id list), uniqueness pinned by `new Set(...).size === 150` plus the per-cube `id === \`${faceId}:${row}:${col}\`` check, and the explicit `createBoard(3)` case exercises the parameterized grid. Evidence: `board.test.ts` § "creates six faces …", "ids every mini-cube …", "gives every mini-cube a unique id …", "accepts an explicit grid size". The plan's node-level `InstancedMesh` position half of AC-4 is T8's evidence.
- **AC-9 (face destruction — board flags)** → **met (board-flag half)**: `faceCleared` is `false` for the 24 removals and `true` for exactly the removal that empties `front`, with `allCleared: false` and the other five faces still at 25 (asserted `[false × 24, true]`, `remainingOnFace(front) === 0`, six faces retained, `remainingOnFace(back) === 25`); clearing all 150 sets `allCleared` exactly once (`allCleared.filter(flag => flag)` has length 1, `faceCleared.filter(...)` has length 6) and leaves six empty faces. The engine-level stat/intent/auto-rotate half of AC-9 is T6's evidence; plate-removal is T8's. Evidence: `board.test.ts` § "flags `faceCleared` …", "flags `allCleared` exactly once …".
- **AC-18 (glossary terms)** → **met**: the three terms (**mini-cube**, **face**, **cube level**) are present in the existing definition+example format (§ 5 grep), worded to match implemented behavior (6 faces × 25 = 150 per cube level; `front:0:0` id format; a face clears when its last mini-cube is destroyed, other faces stay playable — all pinned by `board.test.ts`). `git diff` on `docs/product/glossary.md` shows additions only: no existing term (including `click`) is redefined and no economy term is touched.
- Acceptance line from tasks.md ("AC-4, AC-9 (flags), AC-18") → met at this task's scope; the parenthetical "(flags)" matches the AC-9 half delivered here.

## Deviations from spec
None. The plan § Domain model contract is implemented as pinned (`createBoard(gridSize = GRID_SIZE)`, `removeMiniCube(board, id) → { board, removed, faceCleared, allCleared }`, `remainingOnFace(board, faceId)`); the only interpretive point is documented under § Decisions (transition semantics for `faceCleared`/`allCleared` on a no-op) and pinned by tests. No dependency, config, exclusion or threshold change.
