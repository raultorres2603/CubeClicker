# Build log — T6 — Game engine: phases, events, intents, snapshot

Task: T6 (2026-10-18) — `docs/features/cube-game-frontend/tasks.md`
Build-start revision: `6494791` (T9) — branch `main` (other builders committed T8/T9 while this task ran; only the three `files_owned` paths are staged)
Files changed:
- `src/frontend/src/game/engine.ts` (new, 560 lines)
- `src/frontend/src/game/engine.test.ts` (new, 751 lines, 33 tests, 220 assertions)
- `docs/features/cube-game-frontend/build-log-T6.md` (this file)

## What changed & why (≤ 5 lines)

1. Implemented `game/engine.ts` exactly per plan § Engine Interfaces: `GameEvent`, `EffectIntent`, `EngineOptions`, `EngineSnapshot`, `GameEngine`, `createEngine` — no extra export, `game/**` stays DOM-free with no timers (time only through `advance(dtMs)`, randomness only through the injected `random`).
2. Phase gating per the pinned invariants: `intro` honours `introSkip` only, `travel` ignores every event, `playing` honours the rest; repeat clicks on a removed id are no-ops; `clicks`/`facesDestroyed` increment synchronously in `dispatch`; `drainIntents` is order-preserving and clears the queue.
3. Rotation machine: one animated step (settled `orientation` = target, `rotationFrom` = the settled state it started from, `rotationProgress` 0..1, 1 when idle) with queue depth ≤ 1; auto-rotation after every settle/removal walks one step at a time toward the face that is fewest steps away (ties by `FACE_IDS` order), re-evaluated after each step.
4. Travel: sixth face clear → `faceFadeMs` → phase `travel` + `travelStarted` → `travelMs` → level advance (fresh board, next style, default orientation/cursor, stats carried) + `levelChanged`; `getSnapshot()` is referentially stable until a value changes; `setReducedMotion` switches profiles live and collapses a rotation in flight.
5. Fully deterministic tests: injected `advance(dtMs)`, injected random (constant `0.5` → a literal 24-particle burst; seeded LCG for the pass-through test) and both timing profiles (`timingsFor` via `reducedMotion` plus an explicit injected profile).

## Decisions

- **`orientation` is the settled target.** During an animation the snapshot carries the *target* orientation plus `rotationFrom`/`rotationProgress`, which is exactly what `scene.applySnapshot` (T12) interpolates with `interpolateRotation`; while idle `rotationFrom` is `null` and `rotationProgress` is `1`. The frame convention is T3's (a `+1` yaw step is `+90°` about `+Y`, `frontFace` = the camera-facing face) — the engine never re-derives another one.
- **Auto-rotation metric.** "Fewest steps" is computed as `yawDistance (0..2) + |Δpitch| (0..2)` to the nearest orientation *showing* a face (poles keep the current yaw), face selection iterates `FACE_IDS` with strict `<` so a tie keeps the first face in that order. Each step strictly reduces the distance to the current nearest face, so the walk is finite (≤ 4 steps) without a loop guard; a pitch step is taken first when both axes must move. The direction on an exact half turn prefers `+1`; `yaw 0 → right` takes the single `-1` step (test-pinned).
- **Auto-rotation trigger.** The front face is re-checked after every rotation settle *and* after every successful removal that emptied it (spec § Face destruction), including the instant/reduced path, which collapses a whole chain inside one `dispatch`. A clear of a non-front face starts nothing (test-pinned).
- **Cursor re-anchor.** `reanchorCursor(board, orientation, cursor)` runs after every board change (`explode`) and every orientation change (`applyStep`), and keeps the cursor *object identity* when the cell is unchanged (no snapshot churn). Consequence pinned by test: once a face clear emptied the front face the cursor is absent, so the next front face re-anchors with no hint — `reanchorCursor`'s board order (lowest row, then lowest column). No hidden "last position" state was invented.
- **Explosion burst.** Default profile: `createBurst(random)` (24 particles, `lifetimeMs` 350, draw cadence owned by T5). Reduced motion: `{ particles: [], lifetimeMs: timings.explosionMs }` — the zero-particle path documented in `effects.ts` (`REDUCED_TIMINGS.explosionMs` 0 = instant removal), and the intent still drains so the scene hides the instance (AC-12).
- **`phaseProgress`.** `1` while `playing` (including the `faceFadeMs` window before `travel`), `min(1, elapsed/duration)` during `intro`/`travel`, `1` when the profile's duration is ≤ 0 (injected zero-duration profile, test-pinned). `advance(dtMs)` with `dtMs ≤ 0` is a no-op ("no time passed, nothing can change").
- **`advance` never carries a remainder** across a phase boundary (an overshooting `dt` completes the phase and drops the rest). Frame loops pass real frame deltas; tests use exact durations — the behaviour is deterministic either way.
- **Integration-tier exception (documented, per skill § Testing bar).** `engine.ts` is a pure module with no I/O boundary of its own: the suite drives the *real* `board`, `rotation`, `progression` and `effects` modules through the engine (no fakes, only injected time/random), which is this task's cross-module tier; the session boundary that consumes `createEngine` is T13's `session.test.ts` (browser/loop/pointer wiring), and the intent/snapshot consumers are T12's `scene.test.ts`. No test-content exception was needed: **0** bounded-exception (`closeTo`) usages.
- No dependency, config, spec, plan, tasks or status change; no coverage exclusion; thresholds untouched; `game/**` unchanged elsewhere.

## Evidence

### `npm test --workspace @cubeclicker/frontend` → exit 0

```
 ✓ src/game/effects.test.ts (18 tests) 5ms
 ✓ src/game/progression.test.ts (10 tests) 7ms
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/game/board.test.ts (14 tests) 22ms
 ✓ src/game/rotation.test.ts (31 tests) 13ms
 ✓ src/App.test.tsx (1 test) 7ms
 ✓ src/game/engine.test.ts (33 tests) 32ms
 ✓ src/render/particles.test.ts (19 tests) 11ms
 ✓ src/render/starfield.test.ts (10 tests) 16ms
 ✓ src/render/cube-view.test.ts (23 tests) 39ms

 Test Files  10 passed (10)
      Tests  169 passed (169)
```
(`engine.test.ts` = 33 tests; the other files belong to T2/T3/T4/T5/T7/T9/T8/`ws` and are listed because the command runs the whole workspace.)

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |    99.3 |    99.34 |     100 |    99.3 |
 src             |      84 |      100 |     100 |      84 |
  App.tsx        |      84 |      100 |     100 |      84 | 19-22
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
  starfield.ts   |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
   tests: 169 passed (10 files)
```
`engine.ts`: 100 / 100 / 100 / 100. Workspace aggregate 99.30 / 99.34 / 100 / 99.30 — all four metrics ≥ 80, no exclusions added.

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

### Banned-matcher grep (T6 test file) → no matches

```
$ grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchObject|toHaveBeenCalled|toBeTruthy|toBeDefined|toThrow|toMatchInlineSnapshot|toMatchSnapshot|closeTo|toEqual\(expect" src/frontend/src/game/engine.test.ts
(no output; exit 1)
```
All 220 assertions use exact expected values (`toEqual` on fully pinned structures — intents including the literal 24-particle burst, orientations, cursors, exact stats — and `toBe` on exact numbers, phases and snapshot identities).

### DOM-globals grep under `game/**` → no matches

```
$ grep -nE "window|document|matchMedia|requestAnimationFrame|performance|localStorage|innerHTML|setTimeout|setInterval" src/frontend/src/game/*.ts
(no output; exit 1)
```
`engine.ts` reads no browser global and schedules no timer: time enters only through `advance(dtMs)`, the personality source only through the injected `random` (defaulting to `Math.random`).

### Scope check

```
$ git status --short
 M docs/features/cube-game-frontend/build-log-T9.md     (concurrent T9 builder)
?? docs/features/cube-game-frontend/plan.md             (planning artifacts, pre-existing untracked)
?? docs/features/cube-game-frontend/reviews/
?? docs/features/cube-game-frontend/spec.md
?? docs/features/cube-game-frontend/status.md
?? docs/features/cube-game-frontend/tasks.md
?? src/frontend/src/game/engine.test.ts                 (T6)
?? src/frontend/src/game/engine.ts                      (T6)
?? src/frontend/src/render/cube-view*.ts                (concurrent T8 builder)
?? src/frontend/src/render/starfield*.ts                (concurrent T7 builder)

$ git diff --stat
(empty — no tracked file modified)
```
The commit stages exactly the three `files_owned` paths explicitly (no `git add .`/`-A`); no concurrent-builder file is staged.

## Acceptance audit

- **AC-2 (intro phase and skip) → met.** `engine.test.ts` pins the intro start (`phase 'intro'`, `phaseProgress 0`), `0.4`/`0.5` mid-flight progress, `playing` only after the full `introMs` (`introMs / 2 - 1` still intro, `+1` playing), immediate `introSkip` → `playing` (and `introSkip` ignored while playing), and the full no-op proof for `explodeMiniCube`/`explodeCursor`/`rotate`/`cursorMove` during intro (same snapshot identity, stats/orientation/cursor unchanged, no intents). Session-level pointer wiring (tap → `introSkip`, drag → nothing) is T13.
- **AC-5 (click explodes a mini-cube, instant stats) → met.** Exactly one `explosion` intent carrying `{ id, faceId, burst }` with 24 particles and `lifetimeMs` 350 (literal burst for the constant-`0.5` source; seeded pass-through test), `stats.clicks` incremented synchronously in `dispatch` (asserted before any `advance`), the mini-cube gone from the snapshot board, a repeat click a no-op (identical snapshot object, no intent, board still 149). Scene-side hiding/particle lifetime is T8/T9/T12.
- **AC-6 (queue ≤ 1) → met at the engine level.** One step animates (`rotationProgress` 0 → 0.5 → 1 over `rotationMs`, `rotationFrom` the settled source); a second dispatch queues and a third is ignored (the settled sequence stops at `yawSteps 2`); pitch clamps at `±1`. Threshold/direction classification is T11, pointer dispatch T13.
- **AC-8 (keyboard selection cursor) → met.** Cursor starts at the front-face centre, W/A/S/D steps clamp at the edges (and keep the snapshot identity when nothing moves), `explodeCursor` produces the identical intents/board/cursor as the equivalent `explodeMiniCube` click, and the cursor re-anchors deterministically after a removal (`front:1:1` removed on a 3×3 → `front:0:1`), following the orientation to the new front face on rotation, and is absent (`null`) with `explodeCursor`/`cursorMove` no-ops once the front face is empty.
- **AC-9 (face destruction) → met.** Clearing a face increments `facesDestroyed` exactly once, drains exactly one `faceCleared` after that face's last `explosion`, leaves the other faces playable, and auto-rotates from the cleared front face: one step toward the nearest face (`left` over the four-way tie), the chained two-step case re-evaluated after each settle (`left` empty → `back`), the `FACE_IDS` tie-break (`left` before `top`, both one step away), the pole target (one pitch step to `top`, yaw untouched), and the shortest-way `-1` step onto `right`.
- **AC-10 (all faces gone → travel → next styled cube) → met.** Full two-level path in `engine.test.ts`: 150 clicks → `stats { clicks 150, facesDestroyed 6 }`, 156 intents (150 `explosion` + 6 `faceCleared`, first/last/`155` asserted literally), phase still `playing` during `faceFadeMs` (399 ms → playing, +1 → `travel`, `phaseProgress 0`), one `travelStarted`, every event ignored in `travel` (state and queue unchanged), `phaseProgress 0.5` mid-travel, then `levelIndex 1`, `style` identity `CUBE_STYLES[1]` (`crimson-alloy`), fresh 6 × 25 board, default orientation/cursor, stats carried unchanged, one `levelChanged`, and the second level clearing its front face (`{ clicks 175, facesDestroyed 7 }`).
- **AC-11 (live HUD stats, snapshot stability) → met.** `getSnapshot()` returns the same object across two calls, a new one after a real change, and the *same* object after a no-op frame, a `drainIntents` and no-op events; untouched values keep their identity across a change (`board`/`stats`/`orientation` `toBe`). The HUD binding itself is T14.
- **AC-12 (reduced-motion profile) → met for the engine path.** Reduced profile from construction: `introMs` 150 hand-over, instant rotation (`rotationFrom null`, `rotationProgress 1`, exact settled orientation), zero-particle burst `{ particles: [], lifetimeMs: 0 }` with stats still incrementing, a completed full face clear with the instant auto-rotation and `faceCleared`, a whole level cleared → `faceFadeMs` 100 → `travel` → `travelMs` 150 → level 2 (`crimson-alloy`, stats carried), live `setReducedMotion(true)` collapsing a rotation in flight (progress 0.333… → 1, then animated again after `setReducedMotion(false)`), and a live switch shortening an intro already running. `effects.test.ts` (T5) owns the exact profile values; the session-level motion subscription is T13.
- **AC-17 (test bar / DOM freedom) → met for this task.** Coverage evidence above (workspace aggregate ≥ 80 on all four metrics, `engine.ts` at 100/100/100/100, no exclusions added); banned-matcher grep empty; DOM-globals grep empty; the integration-tier exception is documented above with **0** `closeTo` exceptions.

## Deviations from spec

- None in contracts or pinned values. Two implementation-level behaviours the artifacts leave open are pinned here by test and documented above: (a) when the front face emptied, the cursor is absent, so the *next* front face anchors in board order rather than near the lost cell (a hidden "last position" hint was deliberately not invented); (b) `advance(dtMs ≤ 0)` is a no-op and an overshooting `advance` drops the remainder at a phase boundary.
- Integration-tier exception documented above (no I/O boundary in `engine.ts`); the real wiring lands in T13's `session.test.ts` and T12's `scene.test.ts`.
