# Build log — T11 — Input mapping (gestures, keyboard)

Task: T11 (2026-10-18) — `docs/features/cube-game-frontend/tasks.md`
Build-start revision: `c212968` (T8 post-commit re-run) — branch `main`
Files changed:
- `src/frontend/src/input/gestures.ts` (new, 86 lines)
- `src/frontend/src/input/gestures.test.ts` (new, 210 lines, 21 tests)
- `src/frontend/src/input/keyboard.ts` (new, 70 lines)
- `src/frontend/src/input/keyboard.test.ts` (new, 183 lines, 11 tests)
- `docs/features/cube-game-frontend/build-log-T11.md` (this file)

## What changed & why (≤ 5 lines)

1. `input/gestures.ts`: `PointerGesture` + `classifyPointer(start, current, rect)` exactly per plan § Input interfaces — Euclidean travel ≤ `TAP_DRAG_THRESHOLD_PX` (imported from `game/effects.ts`, never redefined) → `tap` with the NDC position; beyond it → `drag` on the dominant axis; degenerate rect + tap → `null`.
2. Sign convention pinned: `direction` is the sign of the displacement on the dominant axis, so the grabbed content follows the pointer (drag right = `yaw +1` = `+90°` about `+Y`, per `rotation.ts`; drag down = `pitch +1`); an exact `|dx| = |dy|` tie takes the horizontal (`yaw`) axis.
3. `input/keyboard.ts`: `mapKey(key, phase)` as one `ReadonlyMap` table — `intro` → `introSkip` for any key, `travel` → `null`, `playing` → arrows (yaw ±1, pitch ±1), case-insensitive WASD cursor steps, `Enter`/`' '` → `explodeCursor`, everything else `null`.
4. Both modules are DOM-free and node-testable (plain numbers in, events/gestures out; no listeners, no globals) — `game/**`/`input/**` never read browser state.
5. Tests pin the threshold boundary (39/40 tap, 41 drag, plus a 32/24 diagonal = exactly 40), dominant-axis diagonals and the axis tie, exact NDC floats for the 800 × 600 rect, the full key table, and an integration tier driving the *real* engine through `mapKey`/gesture output.

## Decisions

- **Threshold is inclusive: 40 px is a tap.** Three sources agree — plan § Input interfaces ("exactly at threshold is a tap"), AC-6's boundary cases, and the task brief (39 px → tap, 40 px → tap, 41 px → drag) — and the tests pin those literal pixel offsets. **Discrepancy flagged:** the one-line comment beside the landed `TAP_DRAG_THRESHOLD_PX` in `game/effects.ts` reads "below which a gesture is a tap, at/above which it is a drag", i.e. the exclusive form. `effects.ts` is T5's file (out of `files_owned`) and the comment does not change any test, so it was left untouched; the plan/AC reading wins. Reported to the orchestrator as a doc-only mismatch.
- **`null` has exactly one producer: a tap on a degenerate rect.** The plan's `PointerGesture` union includes `null`; the reachable case is a `tap` whose `rect.width`/`height` is ≤ 0, where the NDC position is undefined (real `getBoundingClientRect()` returns 0 × 0 before first layout, so the session can genuinely hit it) — the gesture is `null` and the session dispatches nothing. A `drag` needs no rect and is still classified on a degenerate rect, and a zero-travel press/release is a `tap` (travel 0 ≤ threshold), not `null`. Both are test-pinned.
- **NDC comes from the current (release) position**, rect-relative: `ndcX = x / width * 2 - 1`, `ndcY = 1 - y / height * 2` (screen y up). The plan's `rect` carries only `width`/`height`, so the session (T13) is expected to pass positions already offset by the rect origin; pinned by the half-size-rect test. `[-1, 1]` holds for pointers inside the rect; a release outside the rect maps beyond `±1` and is **not** clamped (a pick there must miss rather than snap to an edge) — test-pinned.
- **Dominant axis and direction.** Dominant = larger `|dx|`/`|dy|`, exact tie → `yaw` (deterministic, documented in the module doc). `direction` = sign of the dominant component, which is self-consistent with `rotation.ts`'s frame: a rightward drag is `yaw +1` (front face slides to the player's right) and a downward drag is `pitch +1` (front face slides down as `top` tilts in). Note the arrows are the same cube rotations read as view tilts: `ArrowUp` = `pitch +1` equals a *downward* drag — both mappings are pinned by the plan's tables, and both are documented in `keyboard.ts`.
- **Only the plan's names are exported** (`PointerGesture`, `classifyPointer`, `mapKey`). No `toNdc` helper was added: `rect` has no origin in the plan contract, taps already carry their NDC, and nothing in the landed code consumes a standalone converter (YAGNI). The `playing` table holds shared immutable event objects (the engine only reads them) so mapping allocates nothing.
- **Integration tier.** Both modules are pure, but their outputs are consumed by the real engine, so each test file drives `createEngine` (`game/engine.ts`, T6) end-to-end: `gestures.test.ts` → classified drag → `rotate` → exact `yawSteps 1` target, `rotationProgress` 0 → 0.5 → 1 and a settled `rotationFrom null`; `keyboard.test.ts` → `Escape` intro skip, `w` + `Enter` cursor/explode path (stats `{ clicks: 1, facesDestroyed: 0 }`, 24 remaining on `front`, re-anchored cursor `front:0:2`, the `explosion` intent for `front:1:2` with 24 particles), WASD clamping at the grid edge, all six faces reached with arrows alone, and the exact orientation counters per arrow. The tap arm's consumers are `pickMiniCube` (T10, not landed at build time) and the phase-gated dispatch (T13), so no local wiring existed to exercise it — the exact NDC values are pinned directly instead.
- **Bounded exceptions:** **0** `closeTo` usages — every asserted float is exact (dyadic fractions of the 800 × 600 / 400 × 300 rects; `Math.hypot(32, 24) === 40` verified before pinning the diagonal boundary). No banned matchers, no snapshot assertions, no existentials.
- No dependency, config, spec, plan, tasks or status change; no coverage exclusion; thresholds untouched; `game/**` untouched.

## Evidence

### `npm test --workspace @cubeclicker/frontend` → exit 0

```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/game/effects.test.ts (18 tests) 7ms
 ✓ src/game/progression.test.ts (10 tests) 11ms
 ✓ src/game/board.test.ts (14 tests) 12ms
 ✓ src/game/rotation.test.ts (31 tests) 10ms
 ✓ src/input/gestures.test.ts (21 tests) 5ms
 ✓ src/input/keyboard.test.ts (11 tests) 7ms
 ✓ src/App.test.tsx (1 test) 7ms
 ✓ src/game/engine.test.ts (33 tests) 25ms
 ✓ src/render/starfield.test.ts (10 tests) 15ms
 ✓ src/render/particles.test.ts (19 tests) 11ms
 ✓ src/render/cube-view.test.ts (23 tests) 44ms

 Test Files  12 passed (12)
      Tests  201 passed (201)
```
Focused run of the T11 files only: `npx vitest run --root src/frontend src/input` → `Test Files 2 passed (2) / Tests 32 passed (32)`.

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.33 |    99.39 |     100 |   99.33 |
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
 src/render      |     100 |      100 |     100 |     100 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
   tests: 201 passed (12 files)
```
`gestures.ts` and `keyboard.ts`: 100 / 100 / 100 / 100. Workspace aggregate 99.33 / 99.39 / 100 / 99.33 — all four metrics ≥ 80, no exclusions added. (This run was green on the first attempt; no mid-build red run to attribute to a concurrent task.)

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

### Banned-matcher grep (T11 test files) → no matches

```
$ grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchObject|toHaveBeenCalled|toBeTruthy|toBeDefined|toThrow|toMatchInlineSnapshot|toMatchSnapshot|closeTo|toEqual\(expect" src/frontend/src/input/gestures.test.ts src/frontend/src/input/keyboard.test.ts
(no output; exit 1)
```
All 32 tests assert exact expected values: whole `toEqual` objects for gestures/events (never a partial matcher), exact px offsets at the boundary, exact NDC floats (`-1`, `-0.5`, `0.5`, `1`, `-0.25`, `1.25`, `-1.25`), exact engine state (`orientation`, `rotationProgress`, `stats`, `cursor`, intent `id`/`faceId`, `burst.particles` length 24), `toBeNull()` on the `null` arms, and `throw new Error(...)` helpers that fail the test when a `null`/non-drag arrives where an exact value is required.

### DOM-globals grep under `input/**` → no matches

```
$ grep -nE "window|document|matchMedia|requestAnimationFrame|performance|localStorage|innerHTML|setTimeout|setInterval|addEventListener" src/frontend/src/input/gestures.ts src/frontend/src/input/keyboard.ts
(no output; exit 1)
```
Both modules take plain data in and return classified results/events: no globals, no listeners, no timers.

### Scope check

```
$ git status --short
?? docs/features/cube-game-frontend/plan.md      (planning artifacts, pre-existing untracked)
?? docs/features/cube-game-frontend/reviews/
?? docs/features/cube-game-frontend/spec.md
?? docs/features/cube-game-frontend/status.md
?? docs/features/cube-game-frontend/tasks.md
?? src/frontend/src/input/                      (T11 — this task's two modules + two test files)

$ git diff --stat
(empty — no tracked file modified)
```
The commit stages exactly the five `files_owned` paths with `git commit --only -- <paths>` (no `git add .`, no `git commit -a`, no `--amend`); no other file is included.

## Acceptance audit

- **AC-6 (pointer click vs drag classification, one step per gesture) → met for this task's scope.** `gestures.test.ts` pins 39 px → `tap`, 40 px → `tap` (threshold inclusive), 41 px → `drag`, the diagonal boundary (`dx 32 / dy 24` = exactly 40 px → `tap`; `33/24` → `drag`), the dominant axis for horizontal and vertical diagonals, the `|dx| = |dy|` tie → `yaw`, and both directions per axis with the exact `{ axis, direction }` objects. Rotation duration/settle, queue ≤ 1 and the front-face-gated pick belong to `rotation.test.ts` (T3), `engine.test.ts` (T6), `picking.test.ts` (T10) and `session.test.ts` (T13).
- **AC-7 (keyboard rotation reaches every face) → met for this task's scope.** `keyboard.test.ts` pins the exact key→event table (`ArrowLeft` yaw −1, `ArrowRight` yaw +1, `ArrowUp` pitch +1, `ArrowDown` pitch −1; `Space`/`Enter` do **not** rotate — they map to `explodeCursor`), unknown keys → `null`, and the integration block drives the real engine with arrow presses alone until `frontFace` is each of the six faces (`front`, `left`, `back`, `right`, `top`, `bottom`) with the exact settled orientation counters (`yawSteps` 0/3/0, `pitchSteps` 0/1/0) and `rotationFrom null` / `rotationProgress 1`. `rotation.test.ts` (T3) owns the geometry re-derivation.
- **AC-8 (keyboard selection cursor) → met for this task's scope.** WASD (lower and upper case) map to the four `cursorMove` events with the exact `{ dx, dy }` values; the integration test moves the real cursor from the front-face centre (`front:2:2`) to `front:1:2` with `w`, clamps at the grid edge after `GRID_SIZE` presses of `a` (`front:2:0`), steps back right (`d` → col 1) and down with an upper-case `S` (`front:3:1`), and `Enter` explodes the highlighted mini-cube through the click-identical path (stats `{ clicks: 1, facesDestroyed: 0 }`, 24 mini-cubes left on `front`, one `explosion` intent for `front:1:2` with a 24-particle burst, cursor re-anchored to `front:0:2`).
- **AC-2 (intro phase and skip; "press any key") → met for this task's scope.** `mapKey(key, 'intro')` returns `{ type: 'introSkip' }` for every key tested, bound or not (`a`, `W`, `d`, `ArrowLeft`, `ArrowUp`, `Enter`, `' '`, `Escape`, `F5`, `?`, `''`), and the integration test proves an unbound key (`Escape`) really moves the engine from `intro` to `playing`. Session-level pointer wiring (tap → `introSkip`, drag → nothing) is T13.
- **AC-13 (single input path) → met for this task's scope.** Both modules work on plain `{ x, y }`/`rect` numbers and `KeyboardEvent.key` strings, i.e. one path for mouse and touch — no pointer-type branching anywhere (`gestures.ts`/`keyboard.ts` contain no event-type or device checks); the `touch-action: none` style and canvas size/ratio assertions are T13/T14.
- **AC-17 (test bar / DOM freedom) → met for this task.** Coverage evidence above (workspace aggregate ≥ 80 on all four metrics; `gestures.ts`/`keyboard.ts` 100/100/100/100, no exclusions added); banned-matcher grep empty; DOM-globals grep empty; integration tier exercised (documented note above about the tap arm's consumers being T10/T13); **0** bounded exceptions.

## Deviations from spec

- None in behaviour or values. Three implementation-level choices the artifacts leave open are pinned by test and documented above: (a) `null` is produced only by a tap on a degenerate rect (the only reachable "cannot classify" case); (b) NDC is taken from the release position and is deliberately unclamped outside the rect; (c) an exact `|dx| = |dy|` diagonal tie resolves to the horizontal `yaw` axis.
- **Doc-only mismatch flagged (no code change):** the constant comment in `game/effects.ts` ("below … at/above …") contradicts the inclusive threshold implemented per plan/AC-6/the task brief. `effects.ts` is T5's file and out of this task's write scope.
- Integration-tier note: the `tap` arm's real consumers (`picking.ts`, T10; session dispatch, T13) were not landed at build time, so that arm is pinned by exact values rather than through a boundary; the `drag` and keyboard arms are exercised end-to-end against the real engine.
