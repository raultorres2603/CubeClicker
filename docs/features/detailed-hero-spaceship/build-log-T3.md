# Build log — T3 — Verify & integrate

Task: T3 (`docs/features/detailed-hero-spaceship/tasks.md`, plan r2, spec r2), 2026-11-08
Files changed: `README.md` (one procedural-visual sentence), `docs/features/detailed-hero-spaceship/build-log-T3.md` (this file), `docs/features/detailed-hero-spaceship/evidence/t3-*.png` (14 files: the 12 normal-path matrix captures plus `t3-reduced-motion-a.png`/`t3-reduced-motion-b.png`).
T4 dependency: commit `42d998a` (`fix: freeze starfield swirl under reduced motion`) is the approved fix for the only T3 blocker; it changes `src/frontend/src/render/starfield.ts` (swirl freezes when `reducedMotion === true`), adds five `starfield.test.ts` tests and updates the one approved `scene.test.ts` reduced-motion assertion. The frontend suite is now 1,356 tests.
What changed & why (sketch, ≤5 lines):
1. Re-ran the full final gates on the T4 tree: lint, typecheck, full tests (700 backend + 1,356 frontend), coverage (both workspaces), build, amended protected-path gates, bundle/import gate.
2. Re-ran the AC-17 reduced-motion A/B proof fresh after T4: the frame is pixel-identical (0/19,200 crop pixels > 8/255; full frame 0/921,600; max channel difference 0).
3. Reused the valid 12-cell normal-path visual matrix and the 12 clean AC-14 frame runs (T4 gates only the reduced-motion swirl branch; the normal path is unchanged) and recorded the measured boxes/clearances and performance table.
4. Updated the root README procedural-visual sentence and recorded the documentation/index pass. **All AC-1…AC-19 are met.**
5. No application source, test, CSS, config, container, backend, spec, plan, tasks, status or `docs/features/README.md` edit in T3.

## BASE and HEAD

- `BASE = da3625e3fe03e1a9f25ca80cd2c3dd00ba1265a9` (`Specs and fixtures`), the **pre-feature fork point** and parent of T1 commit `faf12fd`; verified with `git rev-parse faf12fd^`.
- `HEAD = 42d998a40c9de75dba3b485f97a0d0e57b4ea4fd` (`fix: freeze starfield swirl under reduced motion`, T4).
- The literal `git merge-base main HEAD` resolves to `42d998a` because the feature commits are on `main` (as in the T15 precedent); the recorded fork point above is used for every diff gate.
- Environment: Node v24.22.0, npm 11.19.1; Podman 5.8.9 with docker-compose 5.6.0; running `podman compose` stack (frontend `localhost:5173`, backend `localhost:8080`, Postgres, Mailpit, Adminer). Manual captures used headless Google Chrome 157.0.8103.38 over CDP with hardware `ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA GeForce RTX 5070 Laptop GPU))`.

## Verification commands — raw output (current T4 tree)

### `npm run lint` → exit 0

```text
$ npm run lint

> lint
> eslint .

LINT_EXIT=0
```

### `npm run typecheck` → exit 0

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### `npm test` → exit 0 (backend 700 tests / 22 files; frontend 1,356 tests / 54 files)

```text
$ npm test

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/parts.test.ts (19 tests) 8ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 8ms
 ✓ src/game/config.test.ts (13 tests) 10ms
 ✓ src/db/pool.test.ts (10 tests) 7ms
 ✓ src/game/cubes.test.ts (24 tests) 11ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/game/economy.test.ts (20 tests) 8ms
 ✓ src/auth/config.test.ts (25 tests) 14ms
 ✓ src/auth/user-repository.test.ts (40 tests) 15ms
 ✓ src/auth/session-repository.test.ts (35 tests) 19ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 17ms
 ✓ src/db/migrate.test.ts (10 tests) 12ms
 ✓ src/auth/economy-repository.test.ts (69 tests) 14ms
 ✓ src/game/servers.test.ts (38 tests) 9ms
 ✓ src/auth/email.test.ts (12 tests) 7ms
 ✓ src/game/players.test.ts (13 tests) 12ms
 ✓ src/game/hub.test.ts (78 tests) 83ms
 ✓ src/game/protocol.test.ts (102 tests) 12ms
 ✓ src/auth/password.test.ts (17 tests) 303ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 676ms
 ✓ src/auth/auth-service.test.ts (50 tests) 909ms
 ✓ src/app.test.ts (20 tests) 1457ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1035ms

 Test Files  22 passed (22)
      Tests  700 passed (700)
   Start at  11:23:42
   Duration  2.07s (transform 2.24s, setup 0ms, collect 4.89s, tests 3.62s, environment 3ms, prepare 1.45s)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/game-view.css.test.ts (28 tests) 11ms
 ✓ src/ui/app.css.test.ts (83 tests) 23ms
 ✓ src/auth/api.test.ts (28 tests) 17ms
 ✓ src/ws/connection.test.ts (10 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 12ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 19ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/game/board.test.ts (18 tests) 18ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 9ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 7ms
 ✓ src/ui/icons.test.tsx (16 tests) 23ms
 ✓ src/render/particles.test.ts (20 tests) 18ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 20ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 105ms
 ✓ src/render/spaceship.test.ts (34 tests) 48ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 15ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 23ms
 ✓ src/input/gestures.test.ts (27 tests) 36ms
 ✓ src/render/starfield.test.ts (28 tests) 104ms
 ✓ src/render/picking.test.ts (12 tests) 99ms
 ✓ src/render/cube-view.test.ts (33 tests) 141ms
 ✓ src/game/engine.test.ts (101 tests) 83ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 209ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/browser-env.test.ts (6 tests) 13ms
 ✓ src/render/world.test.ts (27 tests) 160ms
 ✓ src/auth/store.test.ts (31 tests) 18ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 17ms
 ✓ src/game/parts.test.ts (23 tests) 13ms
 ✓ src/render/webgl.test.ts (17 tests) 17ms
 ✓ src/game/effects.test.ts (28 tests) 12ms
 ✓ src/game/economy.test.ts (7 tests) 4ms
 ✓ src/render/postprocessing.test.ts (10 tests) 10ms
 ✓ src/game/upgrades.test.ts (20 tests) 14ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 16ms
 ✓ src/game/progression.test.ts (21 tests) 12ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/docs/links.test.ts (1 test) 3ms
 ✓ src/ui/theme.test.ts (11 tests) 8ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 11ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 132ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 292ms
 ✓ src/render/nebula.test.ts (11 tests) 534ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  450ms
 ✓ src/render/scene.test.ts (85 tests) 881ms
 ✓ src/ui/Hud.test.tsx (16 tests) 135ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 228ms
 ✓ src/game/session.test.ts (71 tests) 829ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 149ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 204ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 454ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 801ms
 ✓ src/App.test.tsx (26 tests) 468ms

 Test Files  54 passed (54)
      Tests  1356 passed (1356)
   Start at  11:23:44
   Duration  2.43s (transform 5.14s, setup 0ms, collect 14.52s, tests 6.54s, environment 3.39s, prepare 4.68s)

TEST_EXIT=0
```

### `npm run coverage` → exit 0 (backend 94.34/85.93/99.68/94.34; frontend 95.8/95.37/96.61/95.8; thresholds ≥ 80 all four)

```text
$ npm run coverage

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/auth/config.test.ts (25 tests) 9ms
 ✓ src/auth/user-repository.test.ts (40 tests) 12ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 4ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 23ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/game/config.test.ts (13 tests) 5ms
 ✓ src/db/migrate.test.ts (10 tests) 8ms
 ✓ src/game/parts.test.ts (19 tests) 11ms
 ✓ src/db/pool.test.ts (10 tests) 6ms
 ✓ src/auth/session-repository.test.ts (35 tests) 17ms
 ✓ src/game/cubes.test.ts (24 tests) 11ms
 ✓ src/game/economy.test.ts (20 tests) 4ms
 ✓ src/auth/email.test.ts (12 tests) 8ms
 ✓ src/game/servers.test.ts (38 tests) 16ms
 ✓ src/game/players.test.ts (13 tests) 8ms
 ✓ src/auth/economy-repository.test.ts (69 tests) 26ms
 ✓ src/game/protocol.test.ts (102 tests) 16ms
 ✓ src/game/hub.test.ts (78 tests) 96ms
 ✓ src/auth/password.test.ts (17 tests) 287ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 677ms
 ✓ src/auth/auth-service.test.ts (50 tests) 879ms
 ✓ src/app.test.ts (20 tests) 1479ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1024ms

 Test Files  22 passed (22)
      Tests  700 passed (700)
   Start at  11:23:52
   Duration  2.30s (transform 1.61s, setup 0ms, collect 4.99s, tests 3.61s, environment 4ms, prepare 2.14s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.34 |    85.93 |   99.68 |   94.34 |                   
 src               |   80.54 |    84.44 |     100 |   80.54 |                   
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243 
 src/auth          |   94.42 |    80.15 |     100 |   94.42 |                   
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354 
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   90.27 |    79.61 |     100 |   90.27 | ...85-586,642-655 
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315         
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68             
 src/db            |     100 |      100 |     100 |     100 |                   
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
 src/game          |   95.66 |    94.02 |   99.13 |   95.66 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   92.21 |     89.6 |     100 |   92.21 | ...91-892,895-896 
  parts.ts         |     100 |      100 |     100 |     100 |                   
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   98.46 |    97.72 |   96.29 |   98.46 | 226-227,436-437   
  servers.ts       |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
-------------------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (83 tests) 17ms
 ✓ src/auth/api.test.ts (28 tests) 13ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 5ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/browser-env.test.ts (6 tests) 14ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 9ms
 ✓ src/render/webgl.test.ts (17 tests) 10ms
 ✓ src/auth/store.test.ts (31 tests) 20ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 18ms
 ✓ src/game/board.test.ts (18 tests) 22ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/ui/icons.test.tsx (16 tests) 27ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 19ms
 ✓ src/render/particles.test.ts (20 tests) 17ms
 ✓ src/render/spaceship.test.ts (34 tests) 62ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 19ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 23ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 159ms
 ✓ src/input/gestures.test.ts (27 tests) 65ms
 ✓ src/game/engine.test.ts (101 tests) 105ms
 ✓ src/render/starfield.test.ts (28 tests) 156ms
 ✓ src/render/picking.test.ts (12 tests) 150ms
 ✓ src/game/parts.test.ts (23 tests) 19ms
 ✓ src/game/effects.test.ts (28 tests) 14ms
 ✓ src/game/progression.test.ts (21 tests) 9ms
 ✓ src/render/cube-view.test.ts (33 tests) 321ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 7ms
 ✓ src/input/keyboard.test.ts (13 tests) 14ms
 ✓ src/game/economy.test.ts (7 tests) 4ms
 ✓ src/ui/game-view.css.test.ts (28 tests) 20ms
 ✓ src/render/postprocessing.test.ts (10 tests) 10ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 13ms
 ✓ src/ui/theme.test.ts (11 tests) 9ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 15ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 24ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 17ms
 ✓ src/render/world.test.ts (27 tests) 371ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 476ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 248ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 549ms
 ✓ src/render/nebula.test.ts (11 tests) 907ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  706ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 163ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 266ms
 ✓ src/ui/Hud.test.tsx (16 tests) 252ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 257ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 480ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 912ms
 ✓ src/App.test.tsx (26 tests) 600ms
 ✓ src/game/session.test.ts (71 tests) 1993ms
 ✓ src/render/scene.test.ts (85 tests) 2460ms

 Test Files  54 passed (54)
      Tests  1356 passed (1356)
   Start at  11:23:55
   Duration  3.67s (transform 6.25s, setup 0ms, collect 15.95s, tests 11.41s, environment 3.89s, prepare 5.63s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.8 |    95.37 |   96.61 |    95.8 |                   
 src               |   84.16 |     79.5 |    92.1 |   84.16 |                   
  App.tsx          |   83.33 |    77.39 |    92.3 |   83.33 | ...03,417-419,505 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   95.44 |    99.68 |   98.75 |   95.44 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |    99.7 |      100 |     100 |    99.7 | 882-883           
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   89.85 |    99.61 |   96.55 |   89.85 | ...1140,1153-1154 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.47 |    96.05 |   95.71 |   92.47 |                   
  protocol.ts      |   87.09 |     94.9 |   89.28 |   87.09 | ...94-905,909-919 
  server-state.ts  |   98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   97.95 |      100 |     100 |   97.95 | 176-178,196       
 src/render        |   99.03 |    96.77 |   98.63 |   99.03 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |       96 |     100 |      99 | 299-300           
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  scene.ts         |   97.48 |    96.17 |   94.73 |   97.48 | ...48-949,973-974 
  ...ship-model.ts |     100 |      100 |     100 |     100 |                   
  spaceship.ts     |   98.25 |    94.54 |     100 |   98.25 | ...44,360,380,391 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   96.45 |    97.26 |   88.67 |   96.45 |                   
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   81.17 |    68.75 |      50 |   81.17 | 45-50,52-57,96-99 
  ...ipPreview.tsx |   93.75 |      100 |     100 |   93.75 | 18-19             
  ...adesPanel.tsx |     100 |      100 |     100 |     100 |                   
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

### `npm run build` → exit 0

```text
$ npm run build

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 93 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.42 kB │ gzip:   0.28 kB
dist/assets/index-CWWRLHaK.css   17.08 kB │ gzip:   3.66 kB
dist/assets/index-hGlZqrLG.js   935.79 kB │ gzip: 258.63 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.41s
BUILD_EXIT=0
```

Initial JS gzip total: **258.63 kB** (`dist/assets/index-hGlZqrLG.js`, the only initial JS chunk) ≤ 350 kB; CSS gzip 3.66 kB; `BUILD_EXIT=0`.

`npm run smoke` was **not run**: the task marks it optional, this resume scope pins the four verify commands plus the manual/performance/docs proofs, and the diff contains no container/compose/Dockerfile change (AC-1 gate below).

## Protected-path diff gates (AC-1 / AC-15)

`$BASE` = `da3625e3fe03e1a9f25ca80cd2c3dd00ba1265a9`. The **amended** byte-identical set is the tasks.md protected list with `src/frontend/src/render/starfield.ts` and `src/frontend/src/render/starfield.test.ts` removed (T4 changed exactly those two paths for the approved AC-17 fix). `src/frontend/src/render/scene.test.ts` is separately diff-guarded (T4 approved one test assertion change; the T2 60→102 baseline change is also present vs BASE); `src/frontend/src/render/scene.ts` remains separately guarded as comment-only.

### Byte-identical amended set + working tree

```text
BASE=da3625e3fe03e1a9f25ca80cd2c3dd00ba1265a9
HEAD=42d998a40c9de75dba3b485f97a0d0e57b4ea4fd

$ git diff --exit-code "$BASE"...HEAD -- <protected set minus starfield.ts/starfield.test.ts/scene.test.ts>
DIFF_EXIT=0

$ test -z "$(git status --porcelain -- <same set>)"
STATUS_CLEAN=yes
```

### Separate guards for the T4-approved paths

`starfield.ts` diff vs BASE: only the header/interface comments and the `if (!motion)` gate around `swirlAngle += ...`; `const motion` moved earlier so the original opacity branch is unchanged. `starfield.test.ts`: only the new `reduced-motion swirl freeze (AC-17)` describe (five tests). `scene.test.ts` vs BASE additionally contains T2’s approved 60→102 baseline change; the T4-only diff (`111f00c...HEAD`) is the single approved reduced-motion test assertion shown after this block.

```text
$ git diff "$BASE"...HEAD -- src/frontend/src/render/starfield.ts
diff --git a/src/frontend/src/render/starfield.ts b/src/frontend/src/render/starfield.ts
index 5edd8e5..088e428 100644
--- a/src/frontend/src/render/starfield.ts
+++ b/src/frontend/src/render/starfield.ts
@@ -20,9 +20,12 @@
  *
  * **Anchor and swirl (spec AC-1).** `update` re-anchors the `Points` to the caller's camera
  * pose: `position = anchor.position`, `quaternion = anchor.quaternion × RotZ(swirlAngle)`
- * with `swirlAngle += max(0, dtMs) · DRIFT_RADIANS_PER_MS`. The swirl is about the **view
- * axis**, under which the square is rotation-invariant in the coverage sense (every
- * direction within its inradius is inside), so coverage can never degrade over time (the
+ * with `swirlAngle += max(0, dtMs) · DRIFT_RADIANS_PER_MS`. Under reduced motion
+ * (`reducedMotion === true`, spec AC-17) the swirl angle is frozen and the starfield keeps
+ * its current orientation; `pulseTimeMs`, the snapped anchor and the base opacity still
+ * apply. The swirl is about the **view axis**, under which the square is rotation-invariant
+ * in the coverage sense (every direction within its inradius is inside), so coverage can never
+ * degrade over time (the
  * predecessor's world-y drift rotated a bounded disk until one side of the frame went
  * starless — the reported defect; r1's rectangular cone failed the same way at 45° and was
  * corrected to the square in r2). With no anchor the starfield anchors to the
@@ -128,7 +131,9 @@ export interface Starfield {
    * travel scale.
    *
    * - Swirl: `swirlAngle += max(0, dtMs) · DRIFT_RADIANS_PER_MS`; the anchored quaternion is
-   *   `anchor.quaternion × RotZ(swirlAngle)` (no anchor → the world-identity pose).
+   *   `anchor.quaternion × RotZ(swirlAngle)` (no anchor → the world-identity pose). With
+   *   `reducedMotion === true` the swirl angle does not advance: the current orientation is
+   *   kept, while `pulseTimeMs`, the anchor position and the base opacity still apply.
    * - Anchor: `points.position` copies `anchor.position` (no anchor → the origin).
    * - Scale: `travelProgress` (0..1, clamped) drives the uniform in-plane scale
    *   `(S, S, 1)` with `S = 1 + (TRAVEL_STARFIELD_SCALE − 1) · travelSwing(progress)`; `z`
@@ -209,8 +214,13 @@ export function createStarfield(random: () => number): Starfield {
       return averageBrightness;
     },
     update(dtMs: number, travelProgress?: number, anchor?: StarfieldAnchor, reducedMotion?: boolean): void {
+      const motion = reducedMotion === true;
       pulseTimeMsValue += Math.max(0, dtMs);
-      swirlAngle += Math.max(0, dtMs) * DRIFT_RADIANS_PER_MS;
+      // Reduced motion freezes the decorative swirl only: the anchor, pulse and opacity
+      // paths below keep their existing semantics (spec AC-17).
+      if (!motion) {
+        swirlAngle += Math.max(0, dtMs) * DRIFT_RADIANS_PER_MS;
+      }
 
       const anchorPosition = anchor?.position ?? WORLD_IDENTITY_POSITION;
       const anchorQuaternion = anchor?.quaternion ?? WORLD_IDENTITY_QUATERNION;
@@ -226,7 +236,6 @@ export function createStarfield(random: () => number): Starfield {
         points.scale.set(expansion, expansion, 1);
       }
 
-      const motion = reducedMotion === true;
       if (motion) {
         points.material.opacity = STARFIELD_OPACITY_BASE;
       } else {

$ git diff "$BASE"...HEAD -- src/frontend/src/render/starfield.test.ts
diff --git a/src/frontend/src/render/starfield.test.ts b/src/frontend/src/render/starfield.test.ts
index 60f1713..a273585 100644
--- a/src/frontend/src/render/starfield.test.ts
+++ b/src/frontend/src/render/starfield.test.ts
@@ -255,6 +255,101 @@ describe('view-axis swirl (AC-1)', () => {
   });
 });
 
+describe('reduced-motion swirl freeze (AC-17)', () => {
+  it('starts frozen at the anchor orientation on a fresh reduced-motion update', () => {
+    const starfield = createStarfield(seededRandom(12));
+    const anchorQuaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
+    const anchor = createAnchor([3, 4, 5], anchorQuaternion);
+    const position = starfield.points.geometry.getAttribute('position');
+    const starsBefore = Float32Array.from(position.array as Float32Array);
+
+    starfield.update(1000, 0.5, anchor, true);
+
+    expect(starfield.pulseTimeMs).toBe(1000);
+    expect(starfield.points.position.toArray()).toEqual([3, 4, 5]);
+    // Zero swirl: the anchored quaternion is exactly the anchor's Y rotation.
+    expect(starfield.points.quaternion.toArray()).toEqual([
+      0, 0.7071067811865475, 0, 0.7071067811865476,
+    ]);
+    expect(starfield.points.rotation.z).toBe(0);
+    // The travel scale is still applied under reduced motion.
+    expect(starfield.points.scale.toArray()).toEqual([8, 8, 1]);
+    expect(starfield.points.material.opacity).toBe(STARFIELD_OPACITY_BASE);
+    expect(Array.from(position.array as Float32Array)).toEqual(Array.from(starsBefore));
+  });
+
+  it('leaves the swirled orientation and star positions unchanged under reduced motion', () => {
+    const starfield = createStarfield(seededRandom(13));
+    starfield.update(1000);
+    const quaternionBefore = starfield.points.quaternion.toArray();
+    const rotationBefore = starfield.points.rotation.z;
+    const position = starfield.points.geometry.getAttribute('position');
+    const starsBefore = Float32Array.from(position.array as Float32Array);
+
+    // The normal update advanced the swirl to the pinned orientation first.
+    expect(quaternionBefore).toEqual([0, 0, 0.007629320516597103, 0.9999708963107151]);
+    expect(rotationBefore).toBe(0.015258789062499998);
+
+    starfield.update(1000, 0.5, createAnchor([1, 2, 3], new Quaternion()), true);
+
+    expect(starfield.points.position.toArray()).toEqual([1, 2, 3]);
+    expect(starfield.points.quaternion.toArray()).toEqual(quaternionBefore);
+    expect(starfield.points.rotation.z).toBe(rotationBefore);
+    expect(starfield.points.scale.toArray()).toEqual([8, 8, 1]);
+    expect(starfield.points.material.opacity).toBe(STARFIELD_OPACITY_BASE);
+    expect(starfield.pulseTimeMs).toBe(2000);
+    expect(Array.from(position.array as Float32Array)).toEqual(Array.from(starsBefore));
+  });
+
+  it('keeps advancing pulseTimeMs and base opacity while the swirl stays frozen', () => {
+    const starfield = createStarfield(seededRandom(14));
+
+    starfield.update(1000, undefined, undefined, true);
+    expect(starfield.pulseTimeMs).toBe(1000);
+    expect(starfield.points.material.opacity).toBe(STARFIELD_OPACITY_BASE);
+    expect(starfield.points.quaternion.toArray()).toEqual([0, 0, 0, 1]);
+    const rotationAfterFirstUpdate = starfield.points.rotation.z;
+
+    starfield.update(1000, undefined, undefined, true);
+    expect(starfield.pulseTimeMs).toBe(2000);
+    // Without the freeze this would be 0.9 (the twinkle trough at the 2000 ms pulse).
+    expect(starfield.points.material.opacity).toBe(STARFIELD_OPACITY_BASE);
+    expect(starfield.points.quaternion.toArray()).toEqual([0, 0, 0, 1]);
+    expect(starfield.points.rotation.z).toBe(rotationAfterFirstUpdate);
+  });
+
+  it('retains the normal swirl, twinkle, expansion and 1200-star layout', () => {
+    const starfield = createStarfield(seededRandom(7));
+
+    starfield.update(1000, 0.5);
+
+    expect(starfield.points.quaternion.toArray()).toEqual([
+      0, 0, 0.007629320516597103, 0.9999708963107151,
+    ]);
+    expect(starfield.points.rotation.z).toBe(0.015258789062499998);
+    expect(starfield.points.material.opacity).toBe(0.95);
+    expect(starfield.points.scale.toArray()).toEqual([8, 8, 1]);
+    const position = starfield.points.geometry.getAttribute('position');
+    expect(position.count).toBe(1200);
+    // Seed 7's first star still sits exactly where construction placed it.
+    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([
+      -69.12860107421875, 109.4261703491211, -105.74883270263672,
+    ]);
+  });
+
+  it('consumes no random draws during updates, reduced motion included', () => {
+    const seeded = countingRandom(seededRandom(16));
+    const starfield = createStarfield(seeded.random);
+    expect(seeded.calls()).toBe(4 * STAR_COUNT);
+
+    starfield.update(1000);
+    starfield.update(1000, 0.5, undefined, true);
+    starfield.update(0, 1, createAnchor([1, 2, 3], new Quaternion()), true);
+
+    expect(seeded.calls()).toBe(4 * STAR_COUNT);
+  });
+});
+
 describe('travel expansion (AC-3)', () => {
   it('follows the symmetric expand → contract scale table, leaving z at 1', () => {
     const starfield = createStarfield(seededRandom(6));

$ git diff "$BASE"...HEAD -- src/frontend/src/render/scene.test.ts
diff --git a/src/frontend/src/render/scene.test.ts b/src/frontend/src/render/scene.test.ts
index a85a12d..dc57ad0 100644
--- a/src/frontend/src/render/scene.test.ts
+++ b/src/frontend/src/render/scene.test.ts
@@ -715,7 +715,7 @@ describe('intro dolly through the scene (AC-2)', () => {
     expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
   });
 
-  it('keeps the view-axis swirl turning under reduced motion (AC-1)', () => {
+  it('freezes the view-axis swirl under reduced motion (AC-17)', () => {
     const view = createView();
     applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.5, reducedMotion: true }));
 
@@ -723,11 +723,9 @@ describe('intro dolly through the scene (AC-2)', () => {
 
     expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
     expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
-    // RotZ(0.0152587890625): the exact composed doubles; the euler round-trip is one ulp
-    // below the ideal angle (see `starfield.test.ts`).
-    expect(starfieldPoints(view).quaternion.toArray()).toEqual([
-      0, 0, 0.007629320516597103, 0.9999708963107151,
-    ]);
+    // The swirl is frozen under reduced motion: the identity camera anchor composes with
+    // RotZ(0), so the starfield keeps the identity orientation while pulse/anchor still update.
+    expect(starfieldPoints(view).quaternion.toArray()).toEqual([0, 0, 0, 1]);
   });
 });
 
@@ -1660,10 +1658,10 @@ describe('frame updates and lifecycle', () => {
     const starfield = starfieldPoints(view);
     const particles = particlePoints(view);
 
-    // The 32 pre-backdrop objects plus the cosmic backdrop's 28
-    // (`COSMIC_BACKDROP_OBJECT_COUNT`) = 60 (AC-10, AC-11).
+    // The 32 pre-backdrop objects plus the cosmic backdrop's 70
+    // (`COSMIC_BACKDROP_OBJECT_COUNT`) = 102 (AC-10, AC-11).
     expect(baselineObjects).toBe(32 + COSMIC_BACKDROP_OBJECT_COUNT);
-    expect(baselineObjects).toBe(60);
+    expect(baselineObjects).toBe(102);
     expect(cubeGroup(view).children).toHaveLength(7);
 
     for (let cycle = 0; cycle < 10; cycle += 1) {

$ git diff "$BASE"...HEAD -- src/frontend/src/render/scene.ts
diff --git a/src/frontend/src/render/scene.ts b/src/frontend/src/render/scene.ts
index e6cf3c7..4466c9e 100644
--- a/src/frontend/src/render/scene.ts
+++ b/src/frontend/src/render/scene.ts
@@ -44,7 +44,7 @@
  * owns every three.js object it creates, so `dispose()` can release them exactly once
  * (AC-15). Drawables stay bounded: one starfield `Points`, one cube view (body + ≤ 6
  * `InstancedMesh`), one pooled particle `Points`, one background-life group, one
- * `cosmic-backdrop` group (28 objects) owning the nebula `DataTexture` used as
+ * `cosmic-backdrop` group (70 objects) owning the nebula `DataTexture` used as
  * `scene.background`, and, online, one remote world of ≤ (X − 1) cube views (AC-10,
  * AC-16). The backdrop group is camera-relative anchored like the starfield, extended with
  * the pinned presentation-only offsets {@link COSMIC_ANCHOR_OFFSET_X} and

$ git status --porcelain
 M README.md
?? docs/features/detailed-hero-spaceship/build-log-T3.md
?? docs/features/detailed-hero-spaceship/evidence/
?? docs/features/detailed-hero-spaceship/plan.md
?? docs/features/detailed-hero-spaceship/reviews/
?? docs/features/detailed-hero-spaceship/spec.md
?? docs/features/detailed-hero-spaceship/status.md
?? docs/features/detailed-hero-spaceship/tasks.md

$ git diff --stat "$BASE"...HEAD
 .../detailed-hero-spaceship/build-log-T1.md        | 161 ++++
 .../detailed-hero-spaceship/build-log-T2.md        | 302 ++++++++
 .../detailed-hero-spaceship/build-log-T4.md        | 417 +++++++++++
 src/frontend/src/render/cosmic-backdrop.test.ts    | 222 +++++-
 src/frontend/src/render/cosmic-backdrop.ts         | 134 +---
 src/frontend/src/render/scene.test.ts              |  16 +-
 src/frontend/src/render/scene.ts                   |   2 +-
 src/frontend/src/render/spaceship-model.test.ts    | 830 +++++++++++++++++++++
 src/frontend/src/render/spaceship-model.ts         | 668 +++++++++++++++++
 src/frontend/src/render/starfield.test.ts          |  95 +++
 src/frontend/src/render/starfield.ts               |  21 +-
 11 files changed, 2712 insertions(+), 156 deletions(-)
```

### T4 one-test `scene.test.ts` diff (`111f00c...HEAD`)

```text
$ git diff 111f00c...HEAD -- src/frontend/src/render/scene.test.ts
diff --git a/src/frontend/src/render/scene.test.ts b/src/frontend/src/render/scene.test.ts
index dc5d3a9..dc57ad0 100644
--- a/src/frontend/src/render/scene.test.ts
+++ b/src/frontend/src/render/scene.test.ts
@@ -715,7 +715,7 @@ describe('intro dolly through the scene (AC-2)', () => {
     expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
   });
 
-  it('keeps the view-axis swirl turning under reduced motion (AC-1)', () => {
+  it('freezes the view-axis swirl under reduced motion (AC-17)', () => {
     const view = createView();
     applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.5, reducedMotion: true }));
 
@@ -723,11 +723,9 @@ describe('intro dolly through the scene (AC-2)', () => {
 
     expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
     expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
-    // RotZ(0.0152587890625): the exact composed doubles; the euler round-trip is one ulp
-    // below the ideal angle (see `starfield.test.ts`).
-    expect(starfieldPoints(view).quaternion.toArray()).toEqual([
-      0, 0, 0.007629320516597103, 0.9999708963107151,
-    ]);
+    // The swirl is frozen under reduced motion: the identity camera anchor composes with
+    // RotZ(0), so the starfield keeps the identity orientation while pulse/anchor still update.
+    expect(starfieldPoints(view).quaternion.toArray()).toEqual([0, 0, 0, 1]);
   });
 });
 
T4_SCENE_TEST_EXIT=0
```

## Bundle / import gate (AC-15)

Current-tree import scan (the T4 fix is in `starfield.ts`, which adds no import):

```text
$ grep -nE "GLTFLoader|FileLoader|TextureLoader|fetch\\(|http://|https://" src/frontend/src/render/spaceship-model.ts src/frontend/src/render/cosmic-backdrop.ts
GREP_EXIT=1

$ grep -nE "^import \\*|from .three." src/frontend/src/render/spaceship-model.ts src/frontend/src/render/cosmic-backdrop.ts
src/frontend/src/render/spaceship-model.ts:47:} from 'three';
src/frontend/src/render/cosmic-backdrop.ts:40:} from 'three';
IMPORT_SCAN_EXIT=0
```

The scan returns no matches (`GREP_EXIT=1`) for `GLTFLoader|FileLoader|TextureLoader|fetch\(|http://|https://`; both modules import only named symbols from `three` plus workspace-relative modules (`./nebula`, `./spaceship-model`) and the palette is re-exported from `spaceship-model.ts`; no `import *` and no external asset URL.

## Manual visual matrix (AC-16)

Method: running `podman compose` stack. Backend recreated with `MAX_USERS_PER_SERVER=2` for slot 1/slot 2 (`self.x = ±7.639437268410976`) and `MAX_USERS_PER_SERVER=10` for the 10-user ring (`self.x = 38.197186342054884`). Fresh headless Chrome page per slot; guest login; intro skipped with a real Space key event; 4 s settle; the named viewport was applied and the canvas inline size cleared plus a `resize` event dispatched (the pre-existing attach-only canvas behavior). The 2560×1280/2560×1080 slot-1 files were re-captured on fresh pages sized from load after a transient black-canvas frame on the concurrent two-page run; the 12 final files are the valid fresh captures.

**Reuse note.** The 12 captures were recorded on the T3 attempt before T4. T4 changes only the `reducedMotion === true` swirl branch in `starfield.ts`; the normal path (`reducedMotion` false/undefined) still advances the swirl, pulse, anchor, scale and opacity exactly as before. Per the T3 resume instruction the valid non-reduced captures are reused unchanged.

Measurement: the full-ship pixel box is measured on each PNG with one rule for every capture — palette mask (blue hull/navy, teal canopy, orange/warm accents, white cores, light gray panels) plus 4-neighbour edge pixels (`> 18/255`), connected components, then the union of the components around the largest ship cluster (≥ 4 px vertical overlap, horizontal centre within 150 px left / 30 px right). The cube box is the union of green components (`area > 3000`); the panel top is the live `.upgrades-panel` DOM y. The exact projected full-ship box from the shipped model vertices and the pinned camera pose is shown for comparison (`project-ship.mjs`): 1280×720 224.4 px, 1920×1080 336.5 px, 2560×1280 398.9 px, 2560×1080 336.5 px.

| Size | Slot | Screenshot | Hero pixel box | Len (px) | Accepted range | Projected box | Cube right | Ship clear x | Panel top | Ship clear panel | Palette px B/T/O/W/G | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1280x720 | slot1 | `t3-1280x720-slot1.png` | `[948, 273, 1171, 336]` | 224 | 160–280 | `[948.1,272.2,1172.5,349.0]` | 861 | 87 | 362.5 | 26.5 | 707/41/693/256/553 | PASS |
| 1920x1080 | slot1 | `t3-1920x1080-slot1.png` | `[1422, 409, 1757, 501]` | 336 | — | `[1422.2,408.3,1758.7,523.5]` | 1292 | 130 | 722.5 | 221.5 | 1541/90/1456/507/1122 | PASS |
| 2560x1280 | slot1 | `t3-2560x1280-slot1.png` | `[1820, 485, 2225, 614]` | 406 | 320–560 | `[1827.8,483.9,2226.6,620.5]` | 1674 | 146 | 922.5 | 308.5 | 2199/74/2183/1482/2578 | PASS |
| 2560x1080 | slot1 | `t3-2560x1080-slot1.png` | `[1742, 415, 2078, 509]` | 337 | 300–450 | `[1742.2,408.3,2078.7,523.5]` | 1612 | 130 | 722.5 | 213.5 | 1590/55/1583/950/1556 | PASS |
| 1280x720 | slot2 | `t3-1280x720-slot2.png` | `[943, 283, 1174, 349]` | 232 | 160–280 | `[948.1,272.2,1172.5,349.0]` | 861 | 82 | 362.5 | 13.5 | 775/45/708/317/641 | PASS |
| 1920x1080 | slot2 | `t3-1920x1080-slot2.png` | `[1412, 429, 1766, 522]` | 355 | — | `[1422.2,408.3,1758.7,523.5]` | 1291 | 121 | 722.5 | 200.5 | 1722/85/1594/930/1583 | PASS |
| 2560x1280 | slot2 | `t3-2560x1280-slot2.png` | `[1817, 488, 2231, 600]` | 415 | 320–560 | `[1827.8,483.9,2226.6,620.5]` | 1673 | 144 | 922.5 | 322.5 | 2111/69/2236/1296/2242 | PASS |
| 2560x1080 | slot2 | `t3-2560x1080-slot2.png` | `[1732, 410, 2078, 505]` | 347 | 300–450 | `[1742.2,408.3,2078.7,523.5]` | 1611 | 121 | 722.5 | 217.5 | 1523/58/1577/725/1349 | PASS |
| 1280x720 | ring10 | `t3-1280x720-ring10.png` | `[948, 277, 1171, 340]` | 224 | 160–280 | `[948.1,272.2,1172.5,349.0]` | 861 | 87 | 362.5 | 22.5 | 730/28/753/249/516 | PASS |
| 1920x1080 | ring10 | `t3-1920x1080-ring10.png` | `[1422, 425, 1759, 518]` | 338 | — | `[1422.2,408.3,1758.7,523.5]` | 1292 | 130 | 722.5 | 204.5 | 1668/47/1673/552/1113 | PASS |
| 2560x1280 | ring10 | `t3-2560x1280-ring10.png` | `[1828, 510, 2225, 620]` | 398 | 320–560 | `[1827.8,483.9,2226.6,620.5]` | 1673 | 155 | 922.5 | 302.5 | 2377/50/2262/799/1553 | PASS |
| 2560x1080 | ring10 | `t3-2560x1080-ring10.png` | `[1742, 427, 2087, 527]` | 346 | 300–450 | `[1742.2,408.3,2078.7,523.5]` | 1612 | 130 | 722.5 | 195.5 | 1698/55/1751/690/1244 | PASS |

All 12 captures pass the composition and size gates: the ship is right of the cube (clear x 82–155 px), fully above the upgrades panel (minimum clearance 13.5 px at 1280×720 slot 2; the exact bob-worst-case projected bottom is 349.0 vs panel top 362.5 = 13.5 px), on-screen, and within the length ranges (224–232 px at 1280, 398–415 px at 2560×1280, 337–347 px at 2560×1080; 336–355 px at 1920×1080 where no range is pinned).

Visual pass (contact sheet of all 12 ship crops inspected, plus full-frame 1280/1920/2560 captures): cobalt/royal-blue upper hull with panel seams and dorsal spine; light-gray stepped underplate and gray wing leading edges; dark navy tail fins and trim; vivid orange wingtips, fin tips and hull stripes; dark teal canopy with a light highlight; gray pointed nose; two ribbed cylindrical nacelles with dark nozzles; two orange flames with white-hot cores; seam/greeble/vent detail reads at 1280×720; the layered-armor read (stepped two-tier underplate + spine + three hull seams) is visible at every size; no z-fighting, flicker or coplanar artefact was visible in any capture.

## Reduced-motion proof (AC-17) — PASS

Fresh capture after T4. Method: fresh headless page at 1280×720; `Emulation.setEmulatedMedia` with `prefers-reduced-motion: reduce` applied before `Page.reload`; `matchMedia(...).matches === true` before and after; guest login + intro skip; the engine snapshot read through the React fiber returns `{ reducedMotion: true, phase: "playing" }`; 2 s settle after the 4 s entry settle; screenshot A, 1.5 s wait, screenshot B. Evidence: `t3-reduced-motion-a.png` / `t3-reduced-motion-b.png`.

| Pair | Viewport | Hero A box | Hero B box | Boxes identical | Union + 8 px crop | Crop px | Diff > 8/255 px | Diff % | Max channel diff | Result (≤ 1%) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `t3-reduced-motion-a/b.png` | 1280×720 | `[948, 279, 1171, 342]` | `[948, 279, 1171, 342]` | YES | `[940, 271, 1179, 350]` | 19200 | 0 | **0.0%** | 0 | **PASS** |

Full-frame cross-check: **0/921,600** pixels differ > 8/255, max channel difference **0** — the two screenshots are byte-identical in the rendered frame. The hero bounding box is identical `[948, 279, 1171, 342]`; the 8 px union crop is `[940, 271, 1179, 350]` and the per-channel difference is 0.0%, far below the 1% bar. The prior blocker was entirely the starfield swirl; T4 freezes it under reduced motion while keeping `pulseTimeMs`, anchor and base opacity semantics.

Raw reduced-motion evidence:

```text
REDUCED {"reducedBefore":true,"reducedAfter":true,"session":{"status":"connected","serverId":1,"maxUsers":2,"self":{"x":7.639437268410976,"y":0},"members":[]},"renderer":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","visibility":"visible"},"metrics":{"viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"x":0,"y":0,"w":1280,"h":720},"panels":{"hud":{"x":16,"y":16,"w":214.359375,"h":178.40625,"right":230.359375,"bottom":194.40625,"display":"flex"},"pill":{"x":1090.71875,"y":16,"w":173.28125,"h":44,"right":1264,"bottom":60,"display":"block"},"upgrades":{"x":876,"y":362.5,"w":388,"h":341.5,"right":1264,"bottom":704,"display":"flex"},"toggle":{"x":16,"y":660,"w":200.21875,"h":44,"right":216.21875,"bottom":704,"display":"block"}},"matchReduced":true}}
DONE
```

```text
SNAPSHOT {"reducedBefore":true,"reducedAfter":true,"session":{"status":"connected","serverId":2,"maxUsers":2,"self":{"x":7.639437268410976,"y":0},"members":[]},"snapshot":{"reducedMotion":true,"phase":"playing"},"renderer":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","visibility":"visible"},"metrics":{"viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"x":0,"y":0,"w":1280,"h":720},"panels":{"hud":{"x":16,"y":16,"w":214.359375,"h":178.40625,"right":230.359375,"bottom":194.40625,"display":"flex"},"pill":{"x":1090.71875,"y":16,"w":173.28125,"h":44,"right":1264,"bottom":60,"display":"block"},"upgrades":{"x":876,"y":362.5,"w":388,"h":341.5,"right":1264,"bottom":704,"display":"flex"},"toggle":{"x":16,"y":660,"w":200.21875,"h":44,"right":216.21875,"bottom":704,"display":"block"}},"matchReduced":true}}
```

```text
{
  "a_box": [
    948,
    279,
    1171,
    342
  ],
  "b_box": [
    948,
    279,
    1171,
    342
  ],
  "boxes_identical": true,
  "union_box": [
    948,
    279,
    1171,
    342
  ],
  "crop_box_8px": [
    940,
    271,
    1179,
    350
  ],
  "crop_pixels": 19200,
  "diff_pixels_gt8": 0,
  "diff_percent": 0.0,
  "max_channel_diff": 0,
  "a_main": [
    948,
    279,
    1171,
    342
  ],
  "b_main": [
    948,
    279,
    1171,
    342
  ],
  "a_components": 1,
  "b_components": 1,
  "pass": true
}
```

```text
full_frame_pixels=921600 diff_gt8=0 pct=0.000000 max_channel_diff=0
```

## Performance evidence (AC-14)

**Reuse note.** These 12 clean runs were recorded on the T3 attempt before T4. T4 only gates the swirl advance behind `reducedMotion === true`; the normal `requestAnimationFrame` path is behavior-identical, so per the T3 resume instruction the clean runs are reused. The T4 test suite and build above are fresh on the current tree.

Protocol: 10 s `requestAnimationFrame` trace per run; fresh page load per run; four measurements (1280×720 idle, 1280×720 rapid at 10 clicks/s, 1920×1080 idle, 1920×1080 rapid), three consecutive clean runs each; rapid dispatches 100 `pointerdown`/`pointerup` pairs at 10 Hz on a 4×4 grid over the cube front face; renderer `ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA GeForce RTX 5070 Laptop GPU))`; viewport = canvas = the named size; `document.visibilityState === "visible"` in every run; host load average 0.37–1.53. No long frames (`> 33 ms`) in any of the 12 runs; all runs report 599 frames (60 Hz cadence).

| Measurement | Run 1 avg / p95 (ms) | Run 2 avg / p95 (ms) | Run 3 avg / p95 (ms) | Median avg / p95 | Worst avg / p95 | Runs meeting both limits | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1280x720-idle | 16.666 / 16.800 | 16.666 / 16.700 | 16.666 / 16.800 | 16.666 / 16.800 | 16.666 / 16.800 | 3/3 | PASS |
| 1280x720-rapid | 16.666 / 16.800 | 16.666 / 16.800 | 16.666 / 16.700 | 16.666 / 16.800 | 16.666 / 16.800 | 3/3 | PASS |
| 1920x1080-idle | 16.666 / 16.700 | 16.666 / 16.700 | 16.666 / 16.700 | 16.666 / 16.700 | 16.666 / 16.700 | 3/3 | PASS |
| 1920x1080-rapid | 16.666 / 16.700 | 16.666 / 16.700 | 16.666 / 16.800 | 16.666 / 16.700 | 16.666 / 16.800 | 3/3 | PASS |

All four measurements pass: every run has average ≤ 16.7 ms and p95 ≤ 33 ms; medians are 16.666/16.800 (1280 idle), 16.666/16.800 (1280 rapid), **16.666/16.700 (1920 idle)** and 16.666/16.700 (1920 rapid). The 1920×1080 idle median headroom is **16.7 − 16.666 = 0.034 ms** (better than the accepted predecessor’s 16.694 ms; no host-hitch caveat is needed). Rapid runs dispatched 100 clicks each and the HUD `Clicks` stat moved to 1–16 destructions; each run’s `max` frame is 16.80 ms and `longFrames` is empty.

Raw frame traces (all runs):

```text
1280x720-idle run 1 {"run":1,"loadBefore":[0.48,0.82,1.24],"loadAfter":[0.37,0.78,1.22],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"frames":599,"avg":16.6661101836394,"p95":16.799999999999272,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10007.99999999106,"clicks":0}
1280x720-idle run 2 {"run":2,"loadBefore":[0.37,0.78,1.22],"loadAfter":[0.43,0.77,1.21],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"frames":599,"avg":16.6661101836394,"p95":16.700000000000728,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10011.20000000596,"clicks":0}
1280x720-idle run 3 {"run":3,"loadBefore":[0.43,0.77,1.21],"loadAfter":[0.71,0.82,1.22],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"frames":599,"avg":16.665943238731217,"p95":16.799999999999272,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10004.50000000596,"clicks":0}
1280x720-rapid run 1 {"run":1,"loadBefore":[0.71,0.82,1.22],"loadAfter":[1.21,0.92,1.25],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"16","visibility":"visible"},"frames":599,"avg":16.665943238731217,"p95":16.799999999999272,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10003.5,"clicks":100}
1280x720-rapid run 2 {"run":2,"loadBefore":[1.21,0.92,1.25],"loadAfter":[1.15,0.93,1.24],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"16","visibility":"visible"},"frames":599,"avg":16.6661101836394,"p95":16.799999999999272,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10008.2,"clicks":100}
1280x720-rapid run 3 {"run":3,"loadBefore":[1.15,0.93,1.24],"loadAfter":[0.9,0.88,1.22],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1280,"h":720,"dpr":1},"canvas":{"w":1280,"h":720},"clicks":"16","visibility":"visible"},"frames":599,"avg":16.665943238731217,"p95":16.700000000000728,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10010.39999999106,"clicks":100}
1920x1080-idle run 1 {"run":1,"loadBefore":[0.9,0.88,1.22],"loadAfter":[0.7,0.84,1.2],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"frames":599,"avg":16.666110183639397,"p95":16.700000000000728,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10007.39999999106,"clicks":0}
1920x1080-idle run 2 {"run":2,"loadBefore":[0.7,0.84,1.2],"loadAfter":[1.28,0.96,1.24],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"frames":599,"avg":16.6661101836394,"p95":16.700000000000728,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10003.00000000298,"clicks":0}
1920x1080-idle run 3 {"run":3,"loadBefore":[1.28,0.96,1.24],"loadAfter":[1.53,1.03,1.26],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"frames":599,"avg":16.6661101836394,"p95":16.700000000000728,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10000.899999994039,"clicks":0}
1920x1080-rapid run 1 {"run":1,"loadBefore":[1.53,1.03,1.26],"loadAfter":[1.33,1.01,1.25],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"4","visibility":"visible"},"frames":599,"avg":16.665943238731217,"p95":16.700000000000728,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10002.400000011921,"clicks":100}
1920x1080-rapid run 2 {"run":2,"loadBefore":[1.33,1.01,1.25],"loadAfter":[1.04,0.96,1.22],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"1","visibility":"visible"},"frames":599,"avg":16.665943238731217,"p95":16.700000000000728,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10007.00000000298,"clicks":100}
1920x1080-rapid run 3 {"run":3,"loadBefore":[1.04,0.96,1.22],"loadAfter":[1.2,1,1.23],"before":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"0","visibility":"visible"},"after":{"renderer":"ANGLE (NVIDIA, Vulkan 1.4.351 (NVIDIA NVIDIA GeForce RTX 5070 Laptop GPU (0x00002D58)), NVIDIA)","vendor":"Google Inc. (NVIDIA)","viewport":{"w":1920,"h":1080,"dpr":1},"canvas":{"w":1920,"h":1080},"clicks":"4","visibility":"visible"},"frames":599,"avg":16.665943238731217,"p95":16.799999999999272,"min":16.5,"max":16.80000000000109,"longFrames":[],"elapsed":10007.09999999106,"clicks":100}
SUMMARY {
  "1280x720-idle": {
    "runs": [
      {
        "run": 1,
        "avg": 16.6661101836394,
        "p95": 16.799999999999272,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 0,
        "longFrames": [],
        "loadBefore": [
          0.48,
          0.82,
          1.24
        ],
        "loadAfter": [
          0.37,
          0.78,
          1.22
        ]
      },
      {
        "run": 2,
        "avg": 16.6661101836394,
        "p95": 16.700000000000728,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 0,
        "longFrames": [],
        "loadBefore": [
          0.37,
          0.78,
          1.22
        ],
        "loadAfter": [
          0.43,
          0.77,
          1.21
        ]
      },
      {
        "run": 3,
        "avg": 16.665943238731217,
        "p95": 16.799999999999272,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 0,
        "longFrames": [],
        "loadBefore": [
          0.43,
          0.77,
          1.21
        ],
        "loadAfter": [
          0.71,
          0.82,
          1.22
        ]
      }
    ],
    "medianAvg": 16.6661101836394,
    "medianP95": 16.799999999999272,
    "worstAvg": 16.6661101836394,
    "worstP95": 16.799999999999272,
    "passCount": 3,
    "pass": true
  },
  "1280x720-rapid": {
    "runs": [
      {
        "run": 1,
        "avg": 16.665943238731217,
        "p95": 16.799999999999272,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 100,
        "longFrames": [],
        "loadBefore": [
          0.71,
          0.82,
          1.22
        ],
        "loadAfter": [
          1.21,
          0.92,
          1.25
        ]
      },
      {
        "run": 2,
        "avg": 16.6661101836394,
        "p95": 16.799999999999272,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 100,
        "longFrames": [],
        "loadBefore": [
          1.21,
          0.92,
          1.25
        ],
        "loadAfter": [
          1.15,
          0.93,
          1.24
        ]
      },
      {
        "run": 3,
        "avg": 16.665943238731217,
        "p95": 16.700000000000728,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 100,
        "longFrames": [],
        "loadBefore": [
          1.15,
          0.93,
          1.24
        ],
        "loadAfter": [
          0.9,
          0.88,
          1.22
        ]
      }
    ],
    "medianAvg": 16.665943238731217,
    "medianP95": 16.799999999999272,
    "worstAvg": 16.6661101836394,
    "worstP95": 16.799999999999272,
    "passCount": 3,
    "pass": true
  },
  "1920x1080-idle": {
    "runs": [
      {
        "run": 1,
        "avg": 16.666110183639397,
        "p95": 16.700000000000728,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 0,
        "longFrames": [],
        "loadBefore": [
          0.9,
          0.88,
          1.22
        ],
        "loadAfter": [
          0.7,
          0.84,
          1.2
        ]
      },
      {
        "run": 2,
        "avg": 16.6661101836394,
        "p95": 16.700000000000728,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 0,
        "longFrames": [],
        "loadBefore": [
          0.7,
          0.84,
          1.2
        ],
        "loadAfter": [
          1.28,
          0.96,
          1.24
        ]
      },
      {
        "run": 3,
        "avg": 16.6661101836394,
        "p95": 16.700000000000728,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 0,
        "longFrames": [],
        "loadBefore": [
          1.28,
          0.96,
          1.24
        ],
        "loadAfter": [
          1.53,
          1.03,
          1.26
        ]
      }
    ],
    "medianAvg": 16.6661101836394,
    "medianP95": 16.700000000000728,
    "worstAvg": 16.6661101836394,
    "worstP95": 16.700000000000728,
    "passCount": 3,
    "pass": true
  },
  "1920x1080-rapid": {
    "runs": [
      {
        "run": 1,
        "avg": 16.665943238731217,
        "p95": 16.700000000000728,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 100,
        "longFrames": [],
        "loadBefore": [
          1.53,
          1.03,
          1.26
        ],
        "loadAfter": [
          1.33,
          1.01,
          1.25
        ]
      },
      {
        "run": 2,
        "avg": 16.665943238731217,
        "p95": 16.700000000000728,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 100,
        "longFrames": [],
        "loadBefore": [
          1.33,
          1.01,
          1.25
        ],
        "loadAfter": [
          1.04,
          0.96,
          1.22
        ]
      },
      {
        "run": 3,
        "avg": 16.665943238731217,
        "p95": 16.799999999999272,
        "frames": 599,
        "max": 16.80000000000109,
        "clicks": 100,
        "longFrames": [],
        "loadBefore": [
          1.04,
          0.96,
          1.22
        ],
        "loadAfter": [
          1.2,
          1,
          1.23
        ]
      }
    ],
    "medianAvg": 16.665943238731217,
    "medianP95": 16.700000000000728,
    "worstAvg": 16.665943238731217,
    "worstP95": 16.799999999999272,
    "passCount": 3,
    "pass": true
  }
}
ALL_PASS true
```

## Documentation pass (AC-19)

Root `README.md` procedural-visual sentence updated to contain the exact phrase **`detailed blue/orange hero spaceship`** and still state **no external image assets**:

```text

$ git diff 111f00c...HEAD -- src/frontend/src/render/starfield.ts src/frontend/src/render/starfield.test.ts
 src/frontend/src/render/starfield.test.ts | 95 +++++++++++++++++++++++++++++++
 src/frontend/src/render/starfield.ts      | 21 +++++--
 2 files changed, 110 insertions(+), 6 deletions(-)

$ git diff "$BASE"...HEAD -- docs/architecture docs/product
ARCH_PRODUCT_DIFF_EXIT=0

$ grep -n "detailed blue/orange hero spaceship" README.md
9:The game view is generated in code (no external image assets): a procedural nebula in purple/blue/pink with asteroids, meteors, an orange comet and a detailed blue/orange hero spaceship (layered hull, swept wings, twin glowing engines), an emerald beveled cube with golden spark bursts, and rounded translucent cyan HUD panels. (Feature: `reference-image-game-view`, see `docs/features/reference-image-game-view/`.)
GREP_EXIT=0

$ git status --porcelain -- docs/architecture docs/product README.md docs/features/README.md
 M README.md

$ git diff -- README.md
diff --git a/README.md b/README.md
index 98dedf5..ea246d3 100644
--- a/README.md
+++ b/README.md
@@ -6,7 +6,7 @@ A web-based, online, real-time, multi-client clicker game — connected clients
 
 Players earn points by clicking the cube and progress through cube levels. Completing a cube grants a **lootbox** and a **key**; opening a lootbox with a key yields a random spaceship **part**. The **Spaceship Customization** menu (appearance editor) shows a live 3D preview and lets players equip owned parts; the in-game spaceship cursor reflects the equipped appearance. Appearance and inventory are persisted per **account**; **guests** keep an ephemeral copy for the session. (Feature: `spaceship-customization`, see `docs/features/spaceship-customization/`.)
 
-The game view is generated in code (no external image assets): a procedural nebula in purple/blue/pink with asteroids, meteors, an orange comet and a decorative spaceship, an emerald beveled cube with golden spark bursts, and rounded translucent cyan HUD panels. (Feature: `reference-image-game-view`, see `docs/features/reference-image-game-view/`.)
+The game view is generated in code (no external image assets): a procedural nebula in purple/blue/pink with asteroids, meteors, an orange comet and a detailed blue/orange hero spaceship (layered hull, swept wings, twin glowing engines), an emerald beveled cube with golden spark bursts, and rounded translucent cyan HUD panels. (Feature: `reference-image-game-view`, see `docs/features/reference-image-game-view/`.)
 
 ## Prerequisites
 
```

`docs/architecture/**` and `docs/product/**` have no diff vs `BASE` (`ARCH_PRODUCT_DIFF_EXIT=0`, empty diff); `docs/features/README.md` is orchestrator-owned and was **not edited** (`git status` shows only `README.md`). Proposed row diff for the orchestrator:

```diff
+| detailed-hero-spaceship | Detailed Hero Spaceship (layered blue/orange procedural hero craft) | code_review | 2026-11-08 |
```

The orchestrator sets the row state to `accepted` when it accepts the feature; T3 does not edit `docs/features/README.md`.

## Acceptance audit (AC-1 … AC-19)

| AC | Verdict | Evidence |
| --- | --- | --- |
| AC-1 — Visual-only scope / protected files | met | Amended byte-identical set: `DIFF_EXIT=0`, `STATUS_CLEAN=yes`; `starfield.ts`/`starfield.test.ts` separately guarded to the T4 reduced-motion branch/tests; `scene.test.ts` separately guarded to the one approved assertion (vs T2); `scene.ts` is the single `(28 objects)` → `(70 objects)` comment hunk; `git status --porcelain` shows only `README.md`, this build log and the evidence directory (plus the untracked feature docs). |
| AC-2 — Factory and object contract | met | T1 build log + `spaceship-model.test.ts` 33 tests; final frontend suite 1,356 green. |
| AC-3 — Named parts (48) | met | T1 build log + exact name→count map test. |
| AC-4 — Palette and material values | met | T1 build log + 11 shared-material values/usage tests. |
| AC-5 — Dimensions/scale | met | T1 build log (3.379999998 × 1.066793883 × 4.55; nose z 2.199999988; flames −2.350000012). |
| AC-6 — Three-quarter attitude | met | T1 build log + `cosmic-backdrop.test.ts` outer group pinned. |
| AC-7 — Cockpit/canopy | met | T1 build log (sphere canopy, bezel containment, highlight above). |
| AC-8 — Wings/tail fins | met | T1 build log (ExtrudeGeometry 1.259999961 × 1.499999970; fins height 0.55; z −1.25; orange tips). |
| AC-9 — Twin engines/flames/cores | met | T1 build log (housings ±1.1, −0.05, −1.0; ribs/nozzles; flames z −2.05 additive; cores z −2.15). |
| AC-10 — Surface detail | met | T1 build log (3 hull seams, 6 wing seams, 2 vents, 2 antennae, 2 greebles, 2 stripes; thinness 0.0208–0.05 ≤ 0.06; offsets 0.015 ≥ 0.012); manual z-fighting pass in AC-16. |
| AC-11 — Backdrop composition/counts | met | T2 build log + `cosmic-backdrop.test.ts` 14 tests (70 objects, 63 meshes, 12 children, hero subtree 50, re-exported palette). |
| AC-12 — Motion/reduced/disposal | met | T2 build log + `cosmic-backdrop.test.ts` (bob-only hero motion, reduced-motion freeze, 63 geometries/26 materials disposed once, model dispose once/idempotent). |
| AC-13 — Scene integration | met | T2 build log + `scene.test.ts` (baseline 102, children 9/10, hero world position `[ownX+15, ownY+1.5, −14]` from slots 1/2/ring 10, anchor 6/4); `scene.ts` comment-only. |
| AC-14 — Performance | met | 4 measurements × 3 clean runs above (reused; normal path unchanged by T4); all averages ≤ 16.7 ms and p95 ≤ 33 ms, 3/3 clean each; 1920 idle median 16.666 ms (0.034 ms headroom); no long frames. |
| AC-15 — Bundle/dependency budget | met | `npm run build` exit 0; initial JS gzip **258.63 kB ≤ 350 kB**; import scan no matches; named `three` imports only; manifests/lockfile/Dockerfiles byte-identical per AC-1. |
| AC-16 — Manual visual matrix | met | 12/12 captures above (reused valid non-reduced captures): size ranges, cube/panel clearance, on-screen, palette/detail/layered-armor read, no z-fighting. |
| AC-17 — Reduced-motion proof | met | Fresh T4 pair at 1280×720: hero boxes identical `[948,279,1171,342]`; 8 px union crop `[940,271,1179,350]`; **0/19,200 pixels** differ > 8/255 (0.0%, max 0); full frame 0/921,600 (max 0). T4 commit `42d998a` freezes the starfield swirl under reduced motion; five new `starfield.test.ts` tests and the one updated `scene.test.ts` assertion are green. |
| AC-18 — Coverage | met | `npm run coverage` exit 0; backend 94.34/85.93/99.68/94.34 and frontend 95.8/95.37/96.61/95.8, all ≥ 80; no exclusion/threshold change. |
| AC-19 — Documentation | met | README grep succeeds with the exact phrase; no `docs/architecture/**` or `docs/product/**` diff; `docs/features/README.md` proposed row recorded, not edited. |

## Final status

**COMPLETED.** All AC-1…AC-19 are met on the current tree. T4 (`42d998a`) resolved the only previous blocker by freezing the starfield swirl under reduced motion; the fresh AC-17 proof is pixel-identical (0/19,200 crop pixels > 8/255, full frame 0/921,600, max 0). Full gates on the T4 tree: lint exit 0, typecheck exit 0, 700 backend + 1,356 frontend tests green, coverage 94.34/85.93/99.68/94.34 (backend) and 95.8/95.37/96.61/95.8 (frontend), build exit 0 with 258.63 kB initial JS gzip. The amended protected gate is green; the T4 starfield diffs are comment + reduced-motion branch/tests only; `scene.test.ts` has only the one approved assertion change vs T2; `scene.ts` is comment-only. Documentation pass complete; the `docs/features/README.md` row is proposed for the orchestrator. No application source, test, CSS, config, container, backend, spec, plan, tasks, status or `docs/features/README.md` edit in T3.
