# Build log — T4 — Progression, stats and cube styles

Task: T4 (2026-10-18)
Branch: `main` (parallel batch with T3/T5; only T4-owned paths staged)
Files changed:
- `src/frontend/src/game/progression.ts` (new)
- `src/frontend/src/game/progression.test.ts` (new)
- `docs/features/cube-game-frontend/build-log-T4.md` (new, this file)

## What changed & why

- Added the pinned 5-style list `CUBE_STYLES` (`obsidian-neon`, `crimson-alloy`, `emerald-crystal`, `solar-gold`, `violet-nebula`) with the exact ids/names/colours/metalness/roughness from plan § Pinned style list — the single home for style values (F2).
- Added `Progression` (`levelIndex` + `GameStats`) and `createProgression` (level 0, counters 0).
- Added `currentStyle` → `CUBE_STYLES[levelIndex % CUBE_STYLES.length]` (cycles every 5 levels).
- Added immutable `recordClick` / `recordFaceDestroyed` (one counter each) and `advanceLevel` (level +1, stats carried by reference, never re-zeroed).
- Tests pin exact style values, the 7-level id sequence with wrap, incremental/immutable stat updates, and stats unchanged by `advanceLevel`.

## Decisions

- **Immutable, pure reducers.** Every function returns a new `Progression` (and a new `stats` object for stat writes) — the engine (T6) can rely on referential change to drive snapshot stability (AC-11), and no caller can mutate shared state.
- **`advanceLevel` carries the *same* `stats` object** (not a copy): the stats are explicitly unchanged, so sharing the reference documents that and keeps snapshot identity cheap.
- **No input validation / clamping** — per plan the engine only calls these with a valid progression; adding speculative guards would be untasked surface (YAGNI). `levelIndex % 5` cycles gracefully for any non-negative level anyway.
- **No DOM/three/timers**; module sits in `game/**` and is node-testable (`AC-17`).

## Evidence

### `npm test --workspace @cubeclicker/frontend` → exit 0

```
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ws/connection.test.ts (10 tests) 8ms
 ✓ src/game/progression.test.ts (10 tests) 8ms
 ✓ src/game/board.test.ts (14 tests) 13ms
 ✓ src/App.test.tsx (1 test) 7ms

 Test Files  4 passed (4)
      Tests  35 passed (35)
   Start at  19:58:04
   Duration  329ms (transform 172ms, setup 0ms, collect 256ms, tests 36ms, environment 1ms, prepare 235ms)
```

`progression.test.ts` = 10 tests: CUBE_STYLES (1), createProgression (2), currentStyle (2), recordClick (2), recordFaceDestroyed (1), advanceLevel (2).

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0, four metrics ≥ 80

```
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ws/connection.test.ts (10 tests) 9ms
 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/App.test.tsx (1 test) 13ms
 ✓ src/game/board.test.ts (14 tests) 23ms

 Test Files  4 passed (4)
      Tests  35 passed (35)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   96.39 |    96.22 |     100 |   96.39 |
 src             |      84 |      100 |     100 |      84 |
  App.tsx        |      84 |      100 |     100 |      84 | 19-22
 src/game        |     100 |      100 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  types.ts       |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

Workspace aggregate: statements 96.39, branches 96.22, functions 100, lines 96.39 — all ≥ 80. `progression.ts` itself: 100 on all four metrics.

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
$ grep -nE "expect\.(anything|any)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toBeDefined|toBeTruthy|toBeFalsy|toHaveBeenCalled\(\)" src/frontend/src/game/progression.test.ts
BANNED_GREP_EXIT=1   # 1 = no match
```

No banned matcher, no snapshot-only assertion, no assertion-free test; every assertion pins an exact value (`toEqual` on full objects/arrays, `toBe` on exact ids/counts/references). No bounded float exception used.

### Scope check

```
$ git status --short
?? docs/features/cube-game-frontend/plan.md      (planning artifacts, not owned by T4)
?? docs/features/cube-game-frontend/reviews/
?? docs/features/cube-game-frontend/spec.md
?? docs/features/cube-game-frontend/status.md
?? docs/features/cube-game-frontend/tasks.md
?? src/frontend/src/game/progression.test.ts     ← T4
?? src/frontend/src/game/progression.ts          ← T4
```

Only `progression.ts` / `progression.test.ts` created; no tracked file modified. Staged explicitly: `git add src/frontend/src/game/progression.ts src/frontend/src/game/progression.test.ts docs/features/cube-game-frontend/build-log-T4.md`.

## Acceptance audit

- **AC-10 — All faces gone → travel → next styled cube (style cycling / stats carry).** Met at module scope: `currentStyle` cycles `obsidian-neon → crimson-alloy → emerald-crystal → solar-gold → violet-nebula → obsidian-neon → crimson-alloy` across 7 levels (asserted in `currentStyle` > "cycles the style ids across seven levels"; the next id always differs from the previous), and `advanceLevel` increments `levelIndex` while carrying `stats` unchanged (same object reference asserted). Full-sequence evidence (intents, timing) is the engine's (T6).
- **AC-11 — Live HUD stats (increment semantics + immutability).** Met at module scope: `recordClick` increments `clicks` by exactly 1 and `recordFaceDestroyed` increments `facesDestroyed` by exactly 1, each returning fresh objects and leaving the input untouched — the pure increment path the engine uses to keep the snapshot stable for the HUD. Stability + HUD markup evidence land in T6 (`engine.test.ts`) and T14 (`Hud.test.tsx`).
- **AC-17 (supporting) — concrete assertions / no banned matchers.** Verified by the grep above; no exclusions or thresholds changed.

## Deviations from spec

None. `roughness: 0.3` / `0.4` are the JS representations of the plan's `0.30` / `0.40` (identical values).
