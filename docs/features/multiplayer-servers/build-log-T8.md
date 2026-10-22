# Build log — T8 — Engine online seams: held level advance, travel kinds, spectating gate

Task: T8 (2026-10-22)
Files changed: `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`,
`docs/features/multiplayer-servers/build-log-T8.md` (this log)

## Sketch (≤5 lines)

Additive engine seams only: `EngineOptions.online` makes the sixth-face travel hold at
progress 0 with no `travelStarted`/draw until `completeNextLevel` supplies the server's
`gridSize`/`style`/`destination`; a new `travelTo` event runs camera-only `spectate`/
`return` flights; `setSpectating` gates every gameplay event; the snapshot exposes
`travelKind`, `travelDestination` and `spectating` with referential stability. Offline
defaults untouched.

## What changed & why

- **`game/engine.ts` — online level hold.** With `online: true`, `startTravel` still runs
  after the retained face fade but enters `travel` with `phaseElapsedMs = 0`, no
  `travelStarted`, no direction draw and `travelKind = 'nextLevel'`; `advanceTravel`
  returns without touching the clock until `completeNextLevel` releases it. The server's
  data replaces `advanceLevel`'s local grid draw and style-cycle lookup; stats are carried
  by the existing `advanceProgression`. `completeNextLevel` also accepts data that arrives
  during the face fade (T13/real-network case), keeping it until `startTravel` releases the
  flight after the fade.
- **`game/engine.ts` — camera-only travel.** `GameEvent` gains `travelTo { kind:
  'spectate' | 'return', destination }`. It enters `travel` with the destination in the
  snapshot, drains one `travelStarted`, never advances a level at the midpoint (the old
  level's board/stats/orientation are kept), and switches back to `playing` at
  `timings.travelMs`.
- **`game/engine.ts` — spectating gate.** `setSpectating(true)` flips the snapshot flag;
  `dispatch` returns before the gameplay switch for every event except `travelTo` (the
  return flight must stay reachable). Board, stats, orientation and intents are untouched
  by gated input. `setSpectating` is idempotent (same snapshot when unchanged).
- **`game/engine.ts` — snapshot contract.** `travelKind`, `travelDestination` and
  `spectating` are stored once (destinations copied at the seam, never rebuilt per frame),
  so the snapshot keeps its referential-stability contract. Offline level travel keeps
  `travelKind: null` and `travelDestination: null` and still draws N and a direction.
- **`game/engine.test.ts` — 13 new tests** (45 pre-existing tests unchanged and passing):
  the hold, the release sequence (intent order, provenance, single midpoint advance,
  duplicate/late data), early data during the fade, zero online draws, no-op guards,
  both camera kinds, one-travel-at-a-time, the face-fade travel guard, offline travel
  fields, and the full spectating gate.

### Hold/release sequence (default timings, pinned by tests)

| Step | Phase | Progress | Level | Intents |
| --- | --- | --- | --- | --- |
| Sixth face cleared | `playing` | 1 | 0 | 150 explosions + 6 faceCleared |
| `advance(faceFadeMs)` | `travel` | 0 | 0 | none (held, no draw) |
| `advance(10 000)` during hold | `travel` | 0 | 0 | none (snapshot identity unchanged) |
| `completeNextLevel({ N: 3, style: violet-nebula, destination: (24, 0) })` | `travel` | 0 | 0 | `travelStarted` (once) |
| `advance(1249)` | `travel` | 1249/2500 | 0 | none |
| `advance(1)` | `travel` | 0.5 | 1 (N 3, stats carried) | `levelChanged` (once) |
| `advance(1250)` | `playing` | 1 | 1 (N 3) | none |

Camera travel: `travelTo` → `travel` at progress 0 with kind/destination and one
`travelStarted`; midpoint crossing emits nothing; at `travelMs` → `playing`, kind and
destination `null`, board/stats/orientation unchanged.

## Decisions

- **`travelKind` is `'nextLevel'` already during the pre-data hold**, with
  `travelDestination: null`. The kind is known at the fade end; the destination is not. This
  gives T12 a way to distinguish an online hold from the offline direction-driven travel
  (which keeps `travelKind: null`).
- **Early server data is kept across the face fade.** A real server answers
  `cubeCompleted` within milliseconds, before the 400 ms fade; dropping that first answer
  would deadlock the hold. The data is stored (invisible in the snapshot) and released by
  `startTravel`, preserving the retained face-fade pacing.
- **`travelTo` is ignored while a sixth-face advance is pending** (face fade or online
  hold). The fade/hold already owns the next transition, and clearing the held server data
  would strand the level advance. One transition at a time, including this window.
- **`travelStarted` is emitted for camera-only flights too.** It is documented as "a travel
  transition begins"; the current scene ignores the intent (travel is snapshot-driven), and
  T12 gets the same marker for every flight.
- **Compatibility surface (see Deviations):** `EngineSnapshot`'s new fields and
  `GameEngine`'s new methods are optional in the base interfaces so the pre-existing
  snapshot/engine fakes (owned by T13/T14) still typecheck without out-of-scope edits;
  `createEngine` returns `OnlineGameEngine`/`OnlineEngineSnapshot` where all three fields
  and both methods are required. The runtime behaviour is identical for every engine
  created by `createEngine`.

## Testing tiers

The engine is a pure, DOM-free state machine with no I/O boundary of its own: the tier-1
suite exercises it directly with injected time/randomness (no fake clock sleeps). The
integration boundary arrives with T12 (scene consumes `travelKind`/`travelDestination`) and
T13 (session drives `completeNextLevel`/`setSpectating`/`travelTo` over the multiplayer
store); this task records that exception explicitly and pins the contract those tasks
consume. All new assertions use concrete values; no banned matchers are present (grep
below).

## Evidence (raw command output)

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/progression.test.ts (10 tests) 8ms
 ✓ src/ws/connection.test.ts (10 tests) 12ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/game/effects.test.ts (28 tests) 13ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 11ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/game/rotation.test.ts (15 tests) 5ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 17ms
 ✓ src/browser-env.test.ts (6 tests) 14ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 13ms
 ✓ src/game/board.test.ts (18 tests) 26ms
 ✓ src/game/engine.test.ts (58 tests) 42ms
 ✓ src/ui/Hud.test.tsx (3 tests) 12ms
 ✓ src/input/gestures.test.ts (21 tests) 6ms
 ✓ src/input/keyboard.test.ts (13 tests) 11ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/render/cube-view.test.ts (32 tests) 50ms
 ✓ src/render/particles.test.ts (19 tests) 19ms
 ✓ src/render/starfield.test.ts (15 tests) 67ms
 ✓ src/render/picking.test.ts (12 tests) 32ms
 ✓ src/App.test.tsx (4 tests) 12ms
 ✓ src/game/session.test.ts (25 tests) 55ms
 ✓ src/render/world.test.ts (19 tests) 49ms
 ✓ src/render/scene.test.ts (51 tests) 93ms

 Test Files  25 passed (25)
      Tests  548 passed (548)
test exit=0
```

T9 (`0f8a7c3`) and T10 (`67b6efb`) landed in the workspace while this task ran; their
files are included in the run above and pass. `engine.test.ts` runs 45 pre-existing tests
unmodified plus 13 new ones.

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 Test Files  25 passed (25)
      Tests  548 passed (548)

 % Coverage report from v8
------------------|---------|----------|---------|---------|--------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|--------------------
All files         |   99.51 |    98.86 |     100 |   99.51 |
 src/game         |     100 |    99.65 |     100 |     100 |
  engine.ts       |     100 |      100 |     100 |     100 |
  session.ts      |     100 |    98.18 |     100 |     100 | 175
 src/multiplayer  |   99.73 |    99.22 |     100 |   99.73 |
  protocol.ts     |     100 |      100 |     100 |     100 |
  server-state.ts |   99.18 |    96.87 |     100 |   99.18 | 119-120
  spectate.ts     |     100 |      100 |     100 |     100 |
  transport.ts    |     100 |      100 |     100 |     100 |
 src/render       |     100 |    98.05 |     100 |     100 |
  world.ts        |     100 |    93.15 |     100 |     100 | ...185,193,271-274
 src/ui           |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx  |    61.9 |      100 |     100 |    61.9 | 23-30
 src/ws           |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts   |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
------------------|---------|----------|---------|---------|--------------------
coverage exit=0
```

(Table excerpt keeps the changed file and the pre-existing residuals; the full report is in
the command transcript above it. No exclusions or thresholds were changed.)

```
$ npm run typecheck --workspace @cubeclicker/frontend
> typecheck
> tsc --noEmit

typecheck exit=0
```

```
$ npm run lint
> lint
> eslint .

lint exit=0
```

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled|not\.toThrow" src/frontend/src/game/engine.test.ts
banned-matcher grep exit=1 (no matches)
```

## Coverage

| Scope | % Stmts | % Branch | % Funcs | % Lines | Gate (≥ 80) |
| --- | --- | --- | --- | --- | --- |
| `src/game/engine.ts` | 100 | 100 | 100 | 100 | pass |
| frontend workspace (all files) | 99.51 | 98.86 | 100 | 99.51 | pass |

No exclusions, no threshold changes. The pre-existing `GameCanvas.tsx` and
`ws/connection.ts` residuals are unchanged from T7.

## Acceptance audit

- **AC-14 — optimistic own-cube play retained. met.** `dispatch` still applies
  `explodeMiniCube` synchronously (stats + board before any server round-trip); all 45
  pre-existing engine tests pass unmodified. The new gate only applies while
  `spectating` is true.
- **AC-17 — spectating input gating / view-only mode. met (engine half).**
  `engine.test.ts > spectating input gate (AC-17)` asserts a valid `front:0:0` click and
  yaw/pitch rotations dispatched while spectating leave the snapshot object identical:
  `stats { clicks: 0, facesDestroyed: 0 }`, front face still 25 mini-cubes,
  `orientation { yawSteps: 0, pitchSteps: 0 }`, `rotationFrom: null`, no intents; the
  return `travelTo` still works and input resumes after `setSpectating(false)`
  (`clicks: 1`, 24 mini-cubes, one explosion intent). Camera flights: `travelTo`
  `spectate`/`return` enter `travel` with the destination, no level advance at the
  midpoint, `playing` on completion, and a second selection is ignored. Pose tables/scene
  rendering remain T11/T12.
- **AC-23 — intro hold seam. met (engine invariants retained).** All pre-existing intro
  tests pass unmodified: the intro still starts at progress 0 and is only skipped by
  `introSkip`; the online hold is strictly after the face fade. The session-side "intro
  starts only on welcome" wiring is T13.
- **AC-24 — no weakening / offline defaults. met.** Offline mode still draws N per level
  and one direction per travel, keeps `travelDirection` semantics, and reports
  `travelKind: null`/`travelDestination: null`/`spectating: false`; all pre-existing
  engine/scene/session/App tests pass. Snapshot referential stability is covered by the
  existing tests plus the new identity assertions (hold across 10 s, duplicate release,
  idempotent `setSpectating`).
- **T8 task bullets.** Hold (progress 0, no intent until complete) — met; released
  sequence (one `travelStarted`, one midpoint `levelChanged`, server N/style, stats
  carried) — met; travel-kind behaviours — met; spectating gate — met; offline draws
  unchanged — met.

## Deviations from spec

1. **Base-interface compatibility optionals.** The plan pins
   `EngineSnapshot.travelKind/travelDestination/spectating` and
   `GameEngine.completeNextLevel/setSpectating` as required. Declaring them required makes
   the workspace `npm run typecheck` fail in two pre-existing files outside this task's
   `files_owned`: `App.test.tsx` (snapshot literal) and `session.test.ts` (snapshot literal
   + fake `GameEngine`), both owned by T14/T13. To keep the verify gate honestly green
   without out-of-scope edits, the fields/methods are optional in the *base* interfaces and
   required in `OnlineEngineSnapshot`/`OnlineGameEngine`, which `createEngine` returns. The
   real engine always populates them; downstream can either narrow to `OnlineGameEngine`
   or coalesce (`snapshot.travelKind ?? null`, `engine.completeNextLevel?.(…)`). If the
   orchestrator prefers strict required fields, T13/T14 should add the three fields and two
   methods to their fakes and this compatibility layer can be removed.
2. **`travelTo` is ignored while a sixth-face advance is pending** (face fade or hold).
   Not spelled out in the task; it enforces "one travel at a time" over the transition
   window and prevents discarding the held server data. Pinned by a test.
3. **`travelKind` is `'nextLevel'` during the pre-data hold** with
   `travelDestination: null`; the plan's comment only guarantees non-null "with a known
   destination". Chosen so T12 can tell the online hold from an offline direction travel.
4. **`travelStarted` is emitted for camera-only flights** as well as level travels. The
   plan does not forbid it; the scene currently ignores the marker and reads the snapshot.

No pinned constant, protocol message, offline pose/phase convention or acceptance
criterion was altered.

## Open questions

- **Q-T8-1:** Should the strict required-field surface be restored once T13/T14 update
  their fakes, or is the `OnlineEngineSnapshot`/`OnlineGameEngine` split the preferred
  permanent contract? Candidate A: keep the split (no churn). Candidate B: make the base
  fields required in a follow-up that owns the two fakes.
- **Q-T8-2:** T12 currently plans destination-driven flights keyed on
  `travelKind === 'nextLevel'`; during the hold the destination is `null`, so the flight
  must stay at the rest pose until the release. The snapshot supports this; confirm the
  scene treats `travelDestination === null` as "hold at progress 0".
- **Q-T8-3:** Should a spectate request during the 400 ms face fade instead queue after the
  level travel (rather than be dropped)? Current contract drops it (one transition at a
  time); T13/T14 may prefer the session to disable the panel for that window.
