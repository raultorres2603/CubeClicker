# Build log — T12 — Scene online integration: own position, server destinations, world swap, spectate flights

Task: T12 (2026-10-22)
Files changed: `src/frontend/src/render/scene.ts`,
`src/frontend/src/render/scene.test.ts`,
`docs/features/multiplayer-servers/build-log-T12.md` (this log)

## Sketch (≤5 lines)

Own cube/rest/intro move to `ownPosition` (default `(0,0)`); `nextLevel` travels
interpolate from `travelFrom` to `travelDestination` with the accepted formula (hold at
rest when `null`); the level midpoint applies a queued `worldEntered` world swap (old
`WorldView` disposed exactly once); `spectate`/`return` render the T11 pose from the
current rest; reduced motion is an instant positional swap for every kind.

## What changed & why

- **Own position.** `createSceneView` gains `{ ownPosition?: Position }`; the own cube
  group starts at `(px, py, 0)`, the initial camera at `(px, py, 12)`, and the intro dolly
  is translated by `(px, py)` — offline (`ownPosition` absent) every value is the accepted
  origin table `(0,0,60) → (0,0,12)` (AC-24).
- **Destination-driven level travel.** The lateral part of the accepted formula was
  extracted into `writeTravelPose(progress, fromX, fromY, dx, dy, …)`; the offline
  `travelCameraPose` now delegates to it with the drawn direction's offset, so the four
  directional tables are unchanged. Online `travelKind === 'nextLevel'` uses
  `dx = destination.x − travelFrom.x`, `dy = destination.y − travelFrom.y` and retains the
  `12 + 78·travelSwing(p)` depth table. When `travelDestination` is `null` (online hold
  before `worldEntered`), the camera stays at the current rest with `travelProgress = 0`
  and the starfield does not expand (Q-T8-2).
- **Midpoint world swap.** `SceneWorld = { maxUsers, ownPosition, roster }` describes the
  authoritative server world (values only). `enterWorld` builds a fresh `WorldView` from
  `maxUsers` first, then disposes the previous world exactly once, moves the own cube to
  `ownPosition`, clears any pending swap and resets the spectate rest. `queueWorldSwap`
  stores a copy; at a pending `levelChanged` rebuild the new world is built first, the old
  world is detached and disposed exactly once, the new roster is rendered and the own cube
  is placed at the server-assigned destination. A style/grid-only reconciliation rebuild
  does **not** apply the swap. `worldView` and `applyWorldMessage` expose the live world
  for remote broadcasts.
- **Spectate / return.** `spectate`/`return` use T11's `travelCameraPose` (imported as
  `spectateTravelPose`) from the current rest to `travelDestination`, with no cube rebuild.
  A spectate target is captured at travel start and the `playing` rest pose is
  `(tx, ty, 12)` while `snapshot.spectating`; a return (or a second selection while
  spectating) starts from the current spectate rest. Reduced motion jumps the camera to the
  destination rest immediately (AC-17).
- **Lifecycle.** `world?.update(dtMs)` advances remote pops after the own removals;
  `disposeWorld()` runs in `dispose()` before `scene.clear()`; `enterWorld` after disposal
  is a no-op. No new dependencies, no renderer contract changes.

## Exact positions pinned by the tests

All literals are dyadic-exact (`easeInOutQuad` = `0, 0.125, 0.5, 0.875, 1`;
`travelSwing` = `0, 0.5, 1, 0.5, 0`), compared with `toEqual` / `toHaveBeenCalledTimes`;
no tolerance and no `toBeCloseTo` anywhere.

### A — own position and intro (AC-23/AC-24)

`ownPosition = (24, 0)`: cube `(24, 0, 0)`, initial rest camera `(24, 0, 12)`, look target
`(24, 0, 0)`, quaternion `[0, 0, 0, 1]`. Intro dolly positions at
`p = 0 / 0.5 / 0.75 / 1` → `(24, 0, 60)`, `(24, 0, 18)`, `(24, 0, 12.75)`,
`(24, 0, 12)`, always targeting `(24, 0, 0)`. Offline (no option): cube `(0,0,0)`, rest
camera `(0,0,12)` — the accepted level-0 pose.

### B — destination-driven `nextLevel` from `(24, 0)` to `(0, 24)` (AC-12)

| p | camera position | look target |
| --- | --- | --- |
| 0 | `(24, 0, 12)` | `(24, 0, 0)` |
| 0.25 | `(21, 3, 51)` | `(21, 3, 0)` |
| 0.5 | `(12, 12, 90)` | `(12, 12, 0)` |
| 0.75 | `(3, 21, 51)` | `(3, 21, 0)` |
| 1 | `(0, 24, 12)` | `(0, 24, 0)` |

Identity quaternion at every row; starfield scale `(8, 8, 1)` at `p = 0.5`. A same-server
advance (`destination = (24, 0)`) keeps the cube in place while the depth still reaches
`(24, 0, 90)`. Under reduced motion the camera rests at `(24, 0, 12)` before the midpoint
and at `(0, 24, 12)` after the `levelChanged` rebuild.

### C — midpoint world swap (AC-12)

Old world `maxUsers 4`, own `(24, 0)`, roster `p2 @ (12, 12)`. Queued world `maxUsers 2`,
own destination `(0, 24)`, roster `p3 @ (0, 12)` (`levelIndex 1`, `gridSize 7`).
Before the midpoint: old world identity retained, own cube `(24, 0, 0)`, camera
`(21, 3, 51)`. After the `levelChanged` + `p = 0.5` snapshot: own cube `(0, 24, 0)`,
camera `(12, 12, 90)`, new world holds only `p3 @ (0, 12)`, old world `dispose` called
exactly once, old remote body geometry disposed exactly once, scene children remain 6.
Later travel frames do not dispose again; `dispose()` later disposes the new world exactly
once. A broadcast to `p3` reaches the new world; the old world's `applyMessage` is never
called (0 times).

### D — spectate / return flights (AC-17)

Spectate from own `(24, 0)` to target `(0, 24)`: `p = 0 / 0.25 / 0.5 / 0.75 / 1` →
`(24,0,12)`, `(21,3,51)`, `(12,12,90)`, `(3,21,51)`, `(0,24,12)` with targets
`(x, y, 0)` and identity quaternion; the own cube group is the same object at every row
(no rebuild). After arrival (`phase 'playing'`, `spectating: true`) the camera stays at
`(0, 24, 12)`. Return mirrors the table: `(0,24,12)`, `(3,21,51)`, `(12,12,90)`,
`(21,3,51)`, `(24,0,12)`. A second spectate from the viewed rest `(0,24)` to `(12,12)` at
`p = 0.5` is `(6, 18, 90)` (starts from the viewed cube, not the own cube). Reduced
motion: spectate jumps to `(0,24,12)` at `p = 0`; return jumps to `(24,0,12)` at `p = 0`;
rest after arrival holds both; no starfield expansion.

## Testing tiers

- **Unit (tier 1)** — `scene.test.ts`: 68 tests (51 pre-existing + 17 new). New tests pin
  own position, intro translation, destination travel table, hold, midpoint swap/disposal,
  same-server advance, reduced motion, spectate/return tables, second spectate origin,
  reduced-motion instant swaps, the defensive no-destination holds, and the offline origin
  rest pose. Integration through the real three.js objects (camera, scene graph, world
  view) is exercised directly by `applySnapshot`/`applyIntents`/`update`.
- **Integration (tier 2)** — `scene.test.ts` drives the scene through the same
  `applySnapshot` / `applyIntents` / `applyWorldMessage` seams T13 uses, with a real
  T10 `WorldView` and its actual cube/geometry disposal, and with the real T11 flight
  function applied to the real `PerspectiveCamera`. No mock stands in for the renderer or
  the world view. The session-level wiring (transport → engine → scene) is T13 by plan.

## Evidence (raw command output)

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/multiplayer/spectate.test.ts (23 tests) 8ms
 ✓ src/game/progression.test.ts (10 tests) 6ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/render/webgl.test.ts (5 tests) 8ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/browser-env.test.ts (6 tests) 14ms
 ✓ src/game/effects.test.ts (28 tests) 8ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 7ms
 ✓ src/game/rotation.test.ts (15 tests) 5ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 18ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 13ms
 ✓ src/game/board.test.ts (18 tests) 18ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/game/engine.test.ts (58 tests) 35ms
 ✓ src/input/gestures.test.ts (21 tests) 9ms
 ✓ src/ui/Hud.test.tsx (3 tests) 11ms
 ✓ src/render/particles.test.ts (19 tests) 23ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/render/cube-view.test.ts (32 tests) 58ms
 ✓ src/render/picking.test.ts (12 tests) 31ms
 ✓ src/render/starfield.test.ts (15 tests) 80ms
 ✓ src/render/world.test.ts (19 tests) 38ms
 ✓ src/App.test.tsx (4 tests) 15ms
 ✓ src/game/session.test.ts (25 tests) 73ms
 ✓ src/render/scene.test.ts (68 tests) 137ms

 Test Files  26 passed (26)
      Tests  572 passed (572)
test exit=0
```

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  26 passed (26)
      Tests  572 passed (572)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.48 |    98.73 |     100 |   99.48 |
 src               |     100 |      100 |     100 |     100 |
  App.tsx          |     100 |      100 |     100 |     100 |
  browser-env.ts   |     100 |      100 |     100 |     100 |
 src/game          |     100 |    99.65 |     100 |     100 |
  board.ts         |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |     100 |    98.18 |     100 |     100 | 175
  types.ts         |     100 |      100 |     100 |     100 |
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   99.73 |    99.22 |     100 |   99.73 |
  protocol.ts      |     100 |      100 |     100 |     100 |
  server-state.ts  |   99.18 |    96.87 |     100 |   99.18 | 119-120
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |     100 |      100 |     100 |     100 |
 src/render        |   99.83 |    97.82 |     100 |   99.83 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  scene.ts         |   99.54 |    98.38 |     100 |   99.54 | 757-758
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |     100 |    93.42 |     100 |     100 | ...85,193,271-274
 src/ui            |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx          |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
coverage exit=0
```

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
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toHaveBeenCalled\(\)|not\.toThrow|toBeTruthy|toBeDefined" src/frontend/src/render/scene.test.ts
banned-matcher grep exit=1 (no matches)
```

## Coverage

| Scope | % Stmts | % Branch | % Funcs | % Lines | Gate (≥ 80) |
| --- | --- | --- | --- | --- | --- |
| `src/render/scene.ts` | 99.54 | 98.38 | 100 | 99.54 | pass |
| frontend workspace (all files) | 99.48 | 98.73 | 100 | 99.48 | pass |

No exclusions, threshold changes, or Vitest config edits. The only residual in `scene.ts`
is lines 757–758, the `disposed` guard in `queueWorldSwap` (defensive: the public API is
not called after `dispose()` in the lifecycle; the `enterWorld` equivalent is covered).
The other residuals (`GameCanvas.tsx`, `ws/connection.ts`, `server-state.ts`, `world.ts`)
are pre-existing from T7/T8/T10 and unchanged.

## No pre-existing test changed

`git diff --numstat -- src/frontend/src/render/scene.test.ts` → `655	0`: the file gained
655 lines and lost none, so every pre-existing line (including all 51 original tests and
their assertions) is byte-identical. The suite count for the file moved from 51 to 68; the
full frontend suite passes 572/572 with no test skipped, renamed, or re-pinned.

## Acceptance audit

- **AC-12 (destination + midpoint world swap) — met for the scene half.**
  `travelKind === 'nextLevel'` uses the server `travelDestination` with the accepted
  formula (`(24,0) → (0,24)` table above); the `null` destination holds at rest with
  progress 0 (Q-T8-2); the midpoint `levelChanged` rebuild moves the own cube to the
  destination and applies the queued world swap, disposing the old `WorldView` exactly
  once and rendering the new roster; later frames do not dispose again; broadcasts go to
  the new world only. The reducer is T7 (`server-state.test.ts`) and session wiring is T13
  by plan.
- **AC-17 (flight rendering) — met for the scene half.** Spectate and return render the
  pinned T11 tables with identity quaternion from the current rest (own cube for
  spectate, viewed cube for return/second selection) and never rebuild the own level;
  arrival rests over the target `(0,24,12)`; reduced motion is an instant positional swap.
  Input gating/view-only mode are T8 (`engine.test.ts`) and the machine is T7 by plan.
- **AC-23 (intro target) — met for the scene half.** The intro dolly targets the own
  position: with `ownPosition (24,0)` the exact z table is retained and only x/y are
  translated. Holding the intro until `welcome` is T13's session wiring by plan.
- **AC-24 (scene defaults) — met.** All 51 pre-existing scene tests pass unmodified
  (0 deleted lines); the offline rest is exactly `(0,0,12)` and the intro exactly
  `(0,0,60) → (0,0,12)`; typecheck and lint are clean; no dependency was added.

## Deviations from spec

1. **Additive `SceneWorld` surface.** The task text names the own-position option and the
   travel/swap rendering, but rendering remote cubes and "disposes the old `WorldView`"
   requires a way to receive the authoritative world. Added value-only
   `SceneWorld = { maxUsers, ownPosition, roster }` plus `worldView`, `enterWorld`,
   `queueWorldSwap`, `applyWorldMessage`. No shared state is derived client-side: the
   scene copies exactly what T10's contract needs, and the roster excludes self (T10
   world view owns the remote cubes only).
2. **Swap guarded by the level-change branch.** The world swap is applied only when a
   `levelChanged` rebuild is actually pending, never on a style/grid reconciliation; this
   matches "at the midpoint" and avoids swapping twice on a coalesced frame.
3. **Reduced motion for `nextLevel`.** The camera rests over the *current* cube until the
   midpoint rebuild and then over the destination cube — the accepted offline reduced-
   motion behavior (positional swap at the cube level), extended to the destination. For
   camera-only flights the camera jumps at travel start, as AC-17 requires.
4. **`queueWorldSwap` copies its inputs.** Position and roster are copied so a later
   mutation by the caller cannot change the queued world before the midpoint. No semantic
   change.
5. **`enterWorld` clears the spectate rest.** A reconnect/resume `welcome` resets the view
   to the own cube (AC-22's "view resets to the own cube instantly"); the session calls
   `enterWorld` with the resume payload (T13).

No pinned constant, protocol message, offline pose/phase convention, or acceptance
criterion was altered.

## Open questions

- **Q-T12-1 (T13 ordering):** `queueWorldSwap` must be called after `worldEntered` and
  before the first midpoint snapshot. Candidate A (current): T13 applies the message to
  the reducer and calls `scene.queueWorldSwap(...)` immediately, then
  `engine.completeNextLevel`; the scene applies the swap at the midpoint regardless.
  Candidate B: call `queueWorldSwap` only when the travel snapshot is at/after the
  midpoint — riskier, because the swap would miss the rebuild. Recommend A.
- **Q-T12-2 (resume):** recommend T13 calls `scene.enterWorld({ maxUsers, ownPosition,
  roster })` from the resume `welcome` (builds the fresh world, positions the own cube,
  resets the spectate rest). If the resume has no travel, this is the only path that
  rebuilds the world without a midpoint.
- **Q-T12-3 (defensive `enterWorld` on `worldEntered` without travel):** current design
  says "queue at `worldEntered`". If T13 ever receives `worldEntered` outside a travel
  (protocol violation), `enterWorld` is the safe fallback; confirm the session treats it
  as an immediate world entry rather than a queued swap. No behavior change needed here.
- **Q-T12-4 (coverage residual):** lines 757–758 are the `queueWorldSwap` post-dispose
  guard. Left uncovered intentionally rather than adding a coverage-only test; flag for
  the reviewer if an explicit post-dispose assertion is preferred.

## Commit

`feat: integrate online positions, destinations and spectate flights into the scene (T12)`
— staged explicitly: `src/frontend/src/render/scene.ts`,
`src/frontend/src/render/scene.test.ts`,
`docs/features/multiplayer-servers/build-log-T12.md`.
