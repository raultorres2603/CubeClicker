# Build log — T4 — Frontend consumption of batched removals

Task: T4 (2026-11-13)

Sketch:
- `server-state.ts`: fold `withRemovedId` over `msg.ids`; same-reference when every id is already present.
- `session.ts`: self-only `miniCubesRemoved` → `applyAuthoritativeRemoval` for every id; no remote engine work.
- `render/world.ts`: `miniCubesRemoved` → `applyRemoval` for every id on the member's live cube.
- Tests: reducer batch/idempotence, transport raw-frame decode, session self/duplicate/remote, world batch/pop/duplicate/unknown, and the AC-18 real-transport → real reducer → real session → real `WorldView` chain.

Files changed:
- `src/frontend/src/multiplayer/server-state.ts`
- `src/frontend/src/multiplayer/server-state.test.ts`
- `src/frontend/src/multiplayer/transport.test.ts`
- `src/frontend/src/game/session.ts`
- `src/frontend/src/game/session.test.ts`
- `src/frontend/src/render/world.ts`
- `src/frontend/src/render/world.test.ts`
- `docs/features/realtime-broadcast-batching/build-log-T4.md` (this log)

What changed & why:
- `reduceWorldState` now folds `withRemovedId` over every id of a `miniCubesRemoved` batch in acceptance order. Each id is applied exactly once, duplicate ids and replayed frames return the same state reference, and untouched branches keep their identity — the same contract as the accepted single-id path (AC-17).
- The session's new `handleMiniCubesRemoved` calls `applyAuthoritativeRemoval` for every id **only** when the batch belongs to the self player; remote batches stay presentation-only and perform no engine work (AC-17/AC-18).
- `WorldView.applyMessage` now applies every batch id to the member's live cube through the existing `applyRemoval`, so each tile starts its 140 ms pop and burst; the already-hidden guard makes duplicates/unknown members no-ops (AC-17).
- No visual/effect/timing change, no protocol change, no new dependency. The legacy `miniCubeRemoved` paths are untouched.
- Tests cover the reducer (self, remote, mixed, all-present, duplicate-in-batch, unknown, referential stability), the transport decode (`transport.test.ts`), session reconciliation (self batch, duplicate batch, remote batch), the world view (two-id pops, duplicate no-restart, unknown member), and the AC-18 end-to-end chain: a real `createTransport` over a fake WebSocket socket → real `parseServerMessage` → real session reducer → real session self-reconciliation → a fake scene whose `applyWorldMessage` delegates to a real `createWorldView({ maxUsers: 10, random: () => 0.5 }).applyMessage` (self, remote, duplicate, unknown, malformed `ids: []`).

Decisions:
- The reducer fold is the only new state transition: it reuses `withRemovedId`, so batch and single-id semantics can never drift.
- The AC-18 test uses the exact backend frame literals (`{"type":"miniCubesRemoved",...}`) and raw JSON welcome frames; no pre-decoded message or mocked decoder/reducer enters the chain.
- The fake scene delegates `enterWorld` to `WorldView.applyRoster` and `applyWorldMessage` to `WorldView.applyMessage`; every other `SceneView` member is inert because the test never ticks the frame loop.

Evidence:

Focused suites (new/changed test files):

`npx vitest run src/multiplayer/server-state.test.ts src/multiplayer/transport.test.ts src/render/world.test.ts src/game/session.test.ts` → exit 0
```
 Test Files  4 passed (4)
      Tests  192 passed (192)
```

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

- `npm run test --workspace @cubeclicker/frontend` → exit 0
```
 Test Files  69 passed (69)
      Tests  1844 passed (1844)
```
(1844 = 1833 T1 baseline + 11 new tests: 6 reducer batch tests, 1 transport decode test, 2 session batch tests, 2 world-view batch tests.)

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (all four metrics ≥ 80)
```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.47 |    96.14 |   97.54 |   96.47 |                   
 src               |   86.83 |    83.25 |      95 |   86.83 |                   
  App.tsx          |   86.22 |    81.91 |   96.42 |   86.22 | ...31-433,455-456 
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   96.19 |    99.36 |   98.46 |   96.19 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.47 |      100 |     100 |   99.47 | 958-959,1250-1251 
  motion.ts        |     100 |      100 |     100 |     100 |                   
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   90.07 |    98.67 |   95.65 |   90.07 | ...1430,1549-1550 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |    93.4 |    96.62 |   95.89 |    93.4 |                   
  protocol.ts      |   89.13 |    96.04 |   90.32 |   89.13 | ...1076,1080-1090 
  server-state.ts  |   98.19 |    95.09 |     100 |   98.19 | ...19,321-322,380 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   99.48 |      100 |     100 |   99.48 | 196               
 src/render        |   98.58 |    98.96 |   98.79 |   98.58 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |      100 |     100 |      99 | 299-300           
  cube-view.ts     |   99.24 |      100 |     100 |   99.24 | 336-337           
  cursor-ship.ts   |   99.54 |    97.61 |     100 |   99.54 | 208-209           
  ...ct-effects.ts |   98.64 |      100 |     100 |   98.64 | ...49-350,474-475 
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  preview.ts       |     100 |      100 |     100 |     100 |                   
  quality.ts       |   98.31 |      100 |     100 |   98.31 | 316-317,400-401   
  scene.ts         |   97.26 |    99.39 |   95.34 |   97.26 | ...1076,1084-1085 
  ship-motion.ts   |     100 |      100 |     100 |     100 |                   
  ...ship-model.ts |     100 |      100 |     100 |     100 |                   
  spaceship.ts     |   96.16 |      100 |   97.05 |   96.16 | ...63-664,690-693 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  targeting.ts     |   95.78 |      100 |     100 |   95.78 | ...64-166,178-179 
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.46 |       92 |     100 |   98.46 | 231-234,453       
 src/ui            |   96.71 |    93.95 |   94.59 |   96.71 |                   
  AuthForms.tsx    |     100 |    99.07 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   91.66 |     87.5 |     100 |   91.66 | 60-61,66-67       
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   96.84 |    88.99 |     100 |   96.84 | ...09-210,216-217 
  ...ipPreview.tsx |    87.2 |    77.41 |      75 |    87.2 | ...24-125,130-131 
  ...adesPanel.tsx |   96.74 |    90.62 |     100 |   96.74 | 77-78,96-97       
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

## Acceptance audit

- **AC-16 (decoder/codec consumption) — met.** `transport.test.ts` feeds the raw text
  `{"type":"miniCubesRemoved","playerId":"p2","ids":["back:1:1","top:0:0"]}` through the real transport and asserts the exact forwarded message with the copied id array. The AC-18 chain also uses real `parseServerMessage` for the welcome and both batch literals.
- **AC-17 — met.**
  - `reduceWorldState`: `server-state.test.ts` proves a self batch and a remote batch apply every id in order, mixed batches add only the new ids, duplicate ids inside a batch apply once, an all-present batch returns the same reference, an unknown member returns the same reference, and untouched branches keep their identity.
  - `WorldView.applyMessage`: `world.test.ts` proves both ids of a two-id batch hide their tiles and start their own 140 ms pops/bursts, a replayed batch does not restart the effect, and an unknown member is a complete no-op.
  - Session: `session.test.ts` proves every self id reaches `applyAuthoritativeRemoval` in order, a duplicate self batch performs no engine work and publishes no new store, and a remote batch performs no engine work.
- **AC-18 — met.** One integration test drives the exact backend frames through a real `createTransport` with a fake WebSocket socket, the real `parseServerMessage` decoder, the real session reducer and self-reconciliation, and a fake scene whose `applyWorldMessage` delegates to a real `createWorldView({ maxUsers: 10, random: () => 0.5 }).applyMessage`. It covers self and remote two-id batches, a duplicate frame (same store reference, no effect restart), an unknown member (same reference, no state change) and a malformed `ids: []` frame dropped by the decoder with no state change.
- **AC-28 (T4-scoped gate) — met.** `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/frontend` (1844) and `npm run coverage --workspace @cubeclicker/frontend` (96.47/96.14/97.54/96.47 ≥ 80) all exit 0 with the raw output above.

## Deviations from spec

None. Only T4's `files_owned` files and this log changed. No backend, protocol, smoke, compose, Dockerfile, package-script, lockfile, CI, `.env*` or unrelated documentation file was touched; T5 was not started.
