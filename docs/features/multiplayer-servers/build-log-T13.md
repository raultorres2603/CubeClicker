# Build log — T13 — Session wiring: transport, authority application, disconnect gating

Task: T13 (2026-10-22)
Files changed: `src/frontend/src/game/session.ts`, `src/frontend/src/game/session.test.ts`,
`docs/features/multiplayer-servers/build-log-T13.md` (this log)
Base: `main` @ `dd85387` (T12)

## Sketch (≤5 lines)

`GameSessionOptions.transport?` (absent = inert transport + unchanged offline defaults; present =
online protocol). The session is the composition root: transport → `server-state` reducer +
`spectate` machine → the real engine/scene. Welcome holds the intro (no `advance`, engine rebuilt
at the server's level-0 grid) and enters the world; user explosions forward as `explode`; the
sixth face sends `cubeCompleted`; self authority releases `completeNextLevel` / reconciles the
board; spectate flights drive `travelTo`; disconnected freezes the engine and gates every input;
dispose closes the transport. The session also exposes a `MultiplayerSnapshot` + spectate/retry
commands for T14.

## Implementation summary

### Session composition and lifecycle

- `createGameSession(options)` now returns `OnlineGameSession` (`GameSession` + the T14 surface):
  `getMultiplayerSnapshot()`, `subscribeMultiplayer(listener)`, `spectateMember(playerId)`,
  `returnToOwnCube()`, `retryConnection()`. `MultiplayerSnapshot` is
  `{ status: TransportStatus; world: WorldState; spectate: SpectateStatus }`; the object is
  referentially stable until one of the three branches changes.
- `online = options.transport !== undefined`. Without a transport nothing is connected, reduced
  or gated (`canRun()` is always `true`), and the whole online surface is inert: status
  `connecting`, empty `WorldState`, commands return `false`, `retryConnection()` is a no-op.
  Existing offline tests therefore run against the same behaviour as before.
- `attach` is the only place that touches the transport lifecycle: it subscribes
  `onMessage`/`onStatus` first, then calls `transport.connect()`. `dispose` removes the two
  transport handlers, closes the transport, resets the spectate controller and
  `setSpectating(false)`, then disposes scene/renderer. A second `attach` reconnects once. The
  transport owns token/join/rejoin; the session writes no handshake (asserted: `wire.sent` is
  empty after `welcome`).
- `retryConnection()` publishes `connecting`, then `transport.close()` + `transport.connect()`;
  the transport's own retry/budget semantics are unchanged.

### Intro hold and welcome (AC-23)

- `canRun() = !online || (status === 'connected' && welcomed)`. The online engine already holds
  the intro at progress 0 (T8); while `!canRun()` the frame loop still renders but never calls
  `engine.advance`, so the intro stays at 0 (and any travel holds) until `welcome`.
- The session-created engine is provisional: it exists before `welcome`, so it had to draw its
  own level-0 grid. On the first `welcome`, if the session owns the engine and the engine is
  still at level 0, it is replaced with `createEngine({ online: true, gridSize: welcome.self.gridSize,
  reducedMotion, random: env.random })` so the server's level-0 grid/style is adopted. An injected
  engine is never replaced. The replacement happens before `enterWorld`, and input is gated until
  the first welcome, so no user progress can be lost.
- `handleWelcome` detects a resume by `previousSelfId === message.playerId`. On resume it calls
  `spectate.reset()` and `engine.setSpectating(false)` **before** `reconcileCube`, because a
  spectating engine ignores removals. It then reconciles the own board, sets `welcomed`, clears
  the completion latch and pending auto-return, and calls
  `scene.enterWorld({ maxUsers, ownPosition: world.self.position, roster: world.members })` — an
  instant view reset with no flight (AC-19 d / AC-22). A fresh join has nothing to reset.
- A new attach clears `welcomed`, so an old connection's welcome can never release a new cycle.

### Own-cube authority (AC-14)

- Pointer/keyboard gestures still dispatch through the engine; only a successful user
  `explodeMiniCube` (stats.clicks grew) is forwarded as
  `explode { id, level: after.levelIndex }`. Local play stays optimistic and instantaneous.
- `miniCubeRemoved` for self: `applyAuthoritativeRemoval(id)` — absent id = no-op (consistent ack);
  present id = `engine.dispatch({ type: 'explodeMiniCube', id })` without forwarding, so the ack
  reconciles but never echoes.
- `stateSync` for self: `reconcileCube(message)` dispatches every authoritative `removedIds` entry
  still on the local board. Stats are session-local and are never rolled back. A `stateSync` for a
  different `levelIndex`/`gridSize` is ignored (no engine level/add seam — see Deviations).
- Remote authority never touches the own engine; it lives in `world.members` and the scene's
  remote views.
- `completionLevel` latches the level whose `cubeCompleted` was sent; spectate is refused until
  authority data arrives (Q-T8-3), and a second `cubeCompleted` for the same level is impossible.

### Level advance and cross-server move (AC-12)

- Sixth-face clear: after forwarding the explode, if every face is empty and the level is not
  already latched, send `cubeCompleted { level }`. The online engine holds the `nextLevel` travel
  at progress 0 with a null destination (T8) until authority data arrives.
- `levelAdvanced` for self: clear the latch and `engine.completeNextLevel({ gridSize,
  style: resolveStyle(styleId, levelIndex), destination: message.position })`. The scene rebuild at
  the midpoint is T12; the session applies `applyWorldSwap(world)` at the exact frame the engine's
  `levelIndex` changes (before `applyIntents`/`applySnapshot`), so a queued cross-server swap is
  current for the midpoint rebuild.
- `worldEntered` while a `nextLevel` travel/completion is waiting: the scene swap is queued from
  `world.pendingWorldSwap` (`maxUsers`, `position`, roster minus self) before the midpoint, then
  the held travel is released with `completeNextLevel` using the message's grid/style/position
  (Q-T12-1: update before the midpoint, swap at it). Order is reducer → queue → release.
- `worldEntered` with no waiting travel (protocol violation): `applyWorldSwap(world)` and
  `scene.enterWorld(...)` immediately, then `completeNextLevel`; defensive path pinned by a test.

### Spectate (AC-18, AC-19)

- `spectateMember(playerId)` requires online + `canRun`, engine `playing`, not already spectating,
  no completion latch, not self, and a member in `world.members`. It calls
  `spectate.requestTravel(playerId, destination)`, then dispatches
  `travelTo { kind: 'spectate', destination }`. If the engine refuses the camera-only travel, the
  controller is reset and the command returns `false`.
- Arrival is detected in the session's frame loop: a `travel → playing` transition with
  `before.travelKind === 'spectate'` calls `spectate.arrive()` + `engine.setSpectating(true)`.
  While spectating, the engine gates taps and key rotations (T8); the session also exposes the
  device state to the UI.
- `returnToOwnCube()` requires mode `viewing`; `spectate.requestReturn(ownPosition)` then
  `travelTo { kind: 'return', destination: ownPosition }`; arrival calls `spectate.arrive()` +
  `setSpectating(false)` and normal play resumes.
- `memberLeft` of the target: viewing → `startOwnReturn()` immediately (mode was moved to `none`
  by `onMemberLeft`); traveling → `pendingAutoReturn` (the engine cannot cancel a flight), processed
  at the start of the next frame once the flight lands in `playing`, then the return flight starts.
  Both `left` and `moved` reasons take the same path (the reducer removes the member first).

### Connection gating (AC-22)

- Any status other than `connected` clears `welcomed` and publishes; `canRun()` closes. Every
  gameplay dispatch (`dispatchAndPublish`, pointer, keyboard, spectate/return commands) is gated;
  `engine.advance` is skipped, so a running travel freezes at its current progress while the scene
  keeps rendering. Coming back to `connected` is not enough: the gate reopens only on `welcome`,
  which re-syncs the board and resets the view.
- `dispose`/teardown also clears `welcomed`, the completion latch, pending auto-return and spectate
  state.

### Multiplayer store

- `getMultiplayerSnapshot` rebuilds only when `status`, `world` (reducer identity) or `spectate`
  (controller identity) changed; `publishMultiplayer` only notifies on a new object. The tests pin
  that `hello`/unrelated `memberLeft` do not publish and that unsubscribe stops delivery.

## Tests

Tier split (session is the composition root, so both tiers are through its boundary):

- **Unit (injected fake engine + fake transport/env):** phase policy, dispatch forwarding, gating,
  store identity/lifecycle — the session is isolated from the engine/scene.
- **Integration (real engine + real three.js scene + fake host environment + fake transport):**
  intro hold/adoption, resume reconcile, level midpoint, world swap, spectate flights, auto-return,
  connection hold.

25 pre-existing session tests are unmodified; the only pre-existing-test changes are the fake
surface: the import lines (adding the online types/builders), the `FakeEngine` recording fields
(`nextLevels`, `spectatingCalls`, `mutateExplosions`) and the `createFakeEngine` declaration line.
No existing assertion or test body changed. 16 online tests were added (41 total in the file):

1. holds the intro at progress 0 until welcome, then adopts the server grid and own slot
2. resumes the own cube, resets spectate and re-enters the world on a resume welcome
3. forwards a successful explode, reports the sixth face and releases the held travel
4. treats a consistent ack as a no-op and reconciles stateSync without rollback
5. releases the held online travel with levelAdvanced and advances at the midpoint (AC-12)
6. queues the worldEntered swap for the midpoint and applies the new world (AC-12)
7. enters a worldEntered world immediately when no travel is waiting (defensive)
8. flies to a member, gates play while viewing, and flies home on return
9. auto-returns with the flight when the viewed member leaves (AC-19 a/b)
10. reverses home after landing when the target leaves mid-flight
11. refuses unknown, own and offline selections (inert session surface)
12. resets the state machine when the engine refuses a camera-only travel
13. gates every input while disconnected and resumes after welcome
14. holds a running camera flight while the transport is down
15. publishes the multiplayer store only when status/world/spectate change
16. connects on attach, closes on dispose and reconnects on retry

Concrete values pinned include: grid 6 adoption and own slot `(24,0)`; resume stats `1` after the
`front:0:0` reconcile; explode/cubeCompleted envelopes; `completeNextLevel` arguments
`{ gridSize: 4, style: CUBE_STYLES[1], destination: { x: 24, y: 0 } }`; midpoint camera `[12,0,90]`
and cube `(24,0,0)`; worldEntered server 2 with roster `['p3']`; spectate camera literals
`[24,0,12]`, `[12,0,90]`, `[0,0,12]`; frozen flight `[7.6800000000000015, 0, 83.76]` at p=0.4;
transport handler counts `1 → 0 → 1` across dispose/attach. No banned matchers, no `toBeCloseTo`,
no wildcard/argument-unchecked assertions.

## Decisions

- Only an explicit transport enables protocol wiring; `undefined` keeps the legacy offline path.
- Session-created engines are replaced once on the first welcome to adopt the server grid; injected
  engines are not (test seams stay in control).
- Reconcile is remove-only through the public engine dispatch seam; no new engine API was added in
  T13 (out of `files_owned`).
- `worldEntered` builds the scene's target roster from `world.pendingWorldSwap` because the current
  world still describes the old server until the midpoint; self is filtered out (the scene's world
  view renders remote members only).
- Spectate arrival is detected by the session from the engine snapshot (`travel → playing` +
  `travelKind`), because T8 exposes no arrival callback.
- Resume resets spectating before reconciling, so the engine accepts the removed tiles.

## Evidence

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/theme.test.ts (2 tests) 2ms
 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/ws/connection.test.ts (10 tests) 15ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 11ms
 ✓ src/browser-env.test.ts (6 tests) 18ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 14ms
 ✓ src/render/webgl.test.ts (5 tests) 11ms
 ✓ src/game/effects.test.ts (28 tests) 12ms
 ✓ src/game/rotation.test.ts (15 tests) 11ms
 ✓ src/game/board.test.ts (18 tests) 33ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 8ms
 ✓ src/ui/Hud.test.tsx (3 tests) 12ms
 ✓ src/game/engine.test.ts (58 tests) 48ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 20ms
 ✓ src/input/gestures.test.ts (21 tests) 8ms
 ✓ src/input/keyboard.test.ts (13 tests) 13ms
 ✓ src/render/particles.test.ts (19 tests) 23ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 11ms
 ✓ src/render/picking.test.ts (12 tests) 40ms
 ✓ src/render/cube-view.test.ts (32 tests) 72ms
 ✓ src/render/world.test.ts (19 tests) 59ms
 ✓ src/render/starfield.test.ts (15 tests) 111ms
 ✓ src/App.test.tsx (4 tests) 19ms
 ✓ src/render/scene.test.ts (68 tests) 154ms
 ✓ src/game/session.test.ts (41 tests) 152ms

 Test Files  26 passed (26)
      Tests  588 passed (588)
   Start at  10:05:11
   Duration  965ms (transform 6.02s, setup 0ms, collect 10.52s, tests 894ms, environment 5ms, prepare 2.96s)
```

```
$ npm run coverage --workspace @cubeclicker/frontend
 Test Files  26 passed (26)
      Tests  588 passed (588)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.16 |    98.24 |     100 |   99.16 |
 src               |     100 |      100 |     100 |     100 |
  App.tsx          |     100 |      100 |     100 |     100 |
  browser-env.ts   |     100 |      100 |     100 |     100 |
 src/game          |   98.98 |     98.1 |     100 |   98.98 |
  board.ts         |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   97.71 |    95.65 |     100 |   97.71 | ...21-622,626-629
  types.ts         |     100 |      100 |     100 |     100 |
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   99.73 |    99.24 |     100 |   99.73 |
  protocol.ts      |     100 |      100 |     100 |     100 |
  server-state.ts  |   99.18 |    97.18 |     100 |   99.18 | 119-120
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |     100 |      100 |     100 |     100 |
 src/render        |   99.83 |    97.84 |     100 |   99.83 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  scene.ts         |   99.54 |    98.41 |     100 |   99.54 | 757-758
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |     100 |     93.5 |     100 |     100 | ...85,193,271-274
 src/ui            |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx          |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
```

The workspace aggregate is above the 80 gate on all four metrics (99.16 / 98.24 / 100 / 99.16);
the per-file `GameCanvas.tsx` figure is pre-existing and does not affect the per-workspace gate.
Command exit code: 0.

```
$ npm run typecheck --workspace @cubeclicker/frontend
> typecheck
> tsc --noEmit
exit: 0 (no diagnostics)

$ npm run lint
> lint
> eslint .
exit: 0 (no diagnostics)
```

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeDefined\(|toBeTruthy\(|toBeCloseTo|toHaveBeenCalled\(\)" src/frontend/src/game/session.test.ts
NO BANNED MATCHERS
```

Pre-commit diff stat (owned files only):

```
$ git diff --stat -- src/frontend/src/game/session.ts src/frontend/src/game/session.test.ts
 src/frontend/src/game/session.test.ts | 942 +++++++++++++++++++++++++++++++++-
 src/frontend/src/game/session.ts      | 561 ++++++++++++++++++++-
 2 files changed, 1489 insertions(+), 14 deletions(-)
```

Typecheck note: the one typecheck failure found after the test extension was test-only (the
offline-surface assertions were reading `OnlineGameSession` members from `createRealSession`,
which returns `GameSession`). It was fixed in `session.test.ts` by creating the offline session
with `createGameSession({ env })`; no production-code defect was revealed and `session.ts` needed
no change for typecheck.

## Acceptance audit

- **AC-12 — client-visible move effect (wiring).** MET. `levelAdvanced` test: after clearing all
  25 tiles except `front:2:2`, the tap sends `explode { id: 'front:2:2', level: 0 }` +
  `cubeCompleted { level: 0 }`; the held travel has `travelDestination: null`/progress 0; after
  `levelAdvanced` the destination is `{ x: 24, y: 0 }` and at 1250 ms the engine is level 1/grid 3,
  the scene cube is `(24,0,0)` with 9 front instances and camera `[12,0,90]`. `worldEntered` test:
  the reducer's `pendingWorldSwap` is server 2 with roster `['p1','p3']`; at the midpoint the world
  is server 2, `self.position` `(0,24)`, members `['p3']`, the scene cube is `(0,24,0)` and camera
  `[0,12,90]`. The reducer/scene tiers ship in `server-state.test.ts`/`scene.test.ts` (T9/T12); T13
  pins the session wiring and ordering (queue before midpoint, `applyWorldSwap` in the same frame).
- **AC-14 — server-authoritative board, optimistic play.** MET. `miniCubeRemoved` for self is a
  no-op when the board already lacks the id (same snapshot identity, stats unchanged) and removes a
  missing tile via the engine otherwise; `stateSync` removes `front:0:0..2` with stats going to 3
  (never rolled back) and sends nothing back; a different-level `stateSync` is ignored; remote
  `stateSync` leaves the own engine untouched (`world.members[0].removedIds` carries it). The
  server-side matrix/broadcast/rate-limit tiers are T4/T5 and unchanged.
- **AC-18 — return to my cube.** MET. `spectateMember('p2')` → `{ mode: 'traveling', target: 'p2',
  destination: { x: 24, y: 0 } }`, engine travel `spectate`; arrival sets `spectating: true` and
  `{ mode: 'viewing' }`; taps/ArrowRight dispatch nothing; `returnToOwnCube()` → `{ mode:
  'returning', destination: { x: 0, y: 0 } }`, travel `return`; arrival is `playing`, mode `none`,
  `spectating: false`, camera `[0,0,12]`, and the next tap explodes (`clicks` 1). UI markup belongs
  to T14.
- **AC-19(d) — spectator reconnect resets instantly.** MET. After a disconnected status and a
  resume `welcome` (self `removedIds: ['front:0:0']`), spectate is `{ mode: 'none' }`,
  `spectating: false`, the board is reconciled, stats stay `1`, and the next rendered frame is
  `[0,0,12]` (no flight); the next tap then sends `{ type: 'explode', id: 'front:2:3', level: 0 }`.
- **AC-22 — gating and resume.** MET. While disconnected a tap, ArrowRight,
  `spectateMember('p2')` and `returnToOwnCube()` all do nothing (clicks stay 1, orientation
  `{0,0}`, no extra sends); `connected` without `welcome` is still gated; after `welcome` the tap
  counts and the next tap sends the exact explode. A running spectate flight freezes at
  `phaseProgress 0.4` with camera `[7.6800000000000015, 0, 83.76]` while disconnected. Attach
  connects with 1 message + 1 status handler; retry closes and reconnects (`connecting`); dispose
  closes and removes both handlers; re-attach restores exactly one of each.
- **AC-23 — intro after welcome.** MET. With no `welcome`, two frames leave `phase: 'intro'`,
  progress 0, camera `[0,0,60]`, and a tap cannot skip. After `welcome` (grid 6, own `(24,0)`) the
  grid is adopted (`gridSize: 6`, front count 36), the scene cube is `(24,0,0)`, `wire.sent` is
  empty, and the next frame advances the intro by exactly `16 / 2500`.
- **Inert offline surface.** MET. Without a transport the new commands return `false`, status stays
  `connecting`, `world.self.playerId` is `''`, and subscribing yields no synthetic publication.

## Deviations from spec

1. **Session-owned engine is replaced on the first welcome.** The spec says "hold the engine in
   intro ... then start the intro clock and set the scene's own position", but the server draws
   level 0's grid (AC-14) and the engine is created before `welcome`. The only public seam to adopt
   the grid is a fresh `createEngine({ gridSize })`; therefore a session-owned engine at level 0 is
   rebuilt once on the first welcome, carrying `reducedMotion` and the environment's random source.
   Injected engines are never rebuilt. No clicks can happen before welcome (input gated), so no
   user state is lost.
2. **`stateSync` reconciliation is remove-only.** The engine exposes `explodeMiniCube` but no add
   or level-replacement seam, and T13's `files_owned` excludes `engine.ts`. Authoritative removed
   ids still present locally are dispatched without echoing; a local id the authority lacks cannot
   be restored, and a `stateSync` for a different level/grid is ignored rather than corrupting the
   board. Stats are intentionally not rolled back. A future engine seam (restore/add + adopt
   level/grid) would close this; tracked below.
3. **Extra session surface.** `createGameSession` now returns `OnlineGameSession` with
   `MultiplayerSnapshot`, `subscribeMultiplayer`, `spectateMember`, `returnToOwnCube` and
   `retryConnection` (needed by T14). `GameSession` itself is unchanged, so existing callers and
   the `App.test.tsx` fake stay valid. Offline sessions expose the same surface inertly.
4. **Mid-flight reconnect cannot reset the view instantly.** The engine has no travel-cancel
   teleport seam. AC-19(d) is met for a landed spectator (the resume `welcome` calls
   `scene.enterWorld`, an instant reset). If the reconnect lands while a spectate flight is still
   in `travel`, the engine cannot be stopped; the camera completes the flight and the deferred
   return/normal state follows. This is a limitation of the T8 seam, not a test weakening.
5. **Defensive `worldEntered` path.** A `worldEntered` with no waiting travel (protocol violation)
   is applied immediately (`applyWorldSwap` + `enterWorld`) instead of being ignored, so the client
   never keeps rendering an old server.
6. **`worldEntered` scene roster excludes self.** The reducer's pending roster includes the mover
   (the store needs it); the scene's `WorldView` expects remote members only, so the session filters
   `world.self.playerId` when queuing the swap.

No new dependencies, no storage APIs, no changes outside the three owned files.

## Open questions

- Should a later task add an engine seam for authoritative restores (`add`/level adoption) so a
  `stateSync` at a different level/grid and locally-ahead tiles can be reconciled exactly? T13
  documents the gap instead of widening `files_owned`.
- Should the engine expose a travel cancel/teleport so a mid-flight reconnect can satisfy the
  "instant view reset" wording for every phase, or is the landed-spectator reading of AC-19(d)
  sufficient? The current implementation only guarantees the instant reset when the engine is not
  mid-flight.
- Should T14 render `world.pendingWorldSwap` during the cross-server flight (e.g., a "moving"
  hint), or is the previous server's roster the intended copy until the midpoint? The store keeps
  both until the swap.
