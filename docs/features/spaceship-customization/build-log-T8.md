## T8 — Engine customization state (guest + adopt)

### npm run lint

> lint
> eslint .

EXIT=0

### npm run typecheck --workspace @cubeclicker/frontend

> typecheck
> tsc --noEmit

EXIT=0

### npm test --workspace @cubeclicker/frontend -- engine

> test
> vitest run engine


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/engine.test.ts (100 tests) 42ms

 Test Files  1 passed (1)
      Tests  100 passed (100)
   Start at  22:06:24
   Duration  404ms (transform 136ms, setup 0ms, collect 160ms, tests 42ms, environment 0ms, prepare 57ms)

EXIT=0

### npm run coverage --workspace @cubeclicker/frontend

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (78 tests) 28ms
 ✓ src/auth/api.test.ts (28 tests) 12ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 8ms
 ✓ src/ws/connection.test.ts (10 tests) 15ms
 ✓ src/multiplayer/protocol.test.ts (146 tests) 24ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/game/board.test.ts (18 tests) 21ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/auth/store.test.ts (31 tests) 20ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 15ms
 ✓ src/render/particles.test.ts (19 tests) 19ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 14ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 17ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 24ms
 ✓ src/render/spaceship.test.ts (29 tests) 38ms
 ✓ src/render/picking.test.ts (12 tests) 27ms
 ✓ src/render/cube-view.test.ts (32 tests) 59ms
 ✓ src/input/gestures.test.ts (27 tests) 23ms
 ✓ src/render/starfield.test.ts (23 tests) 116ms
 ✓ src/game/engine.test.ts (100 tests) 98ms
 ✓ src/render/world.test.ts (27 tests) 81ms
 ✓ src/render/scene-spaceship.test.ts (11 tests) 58ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 47ms
 ✓ src/input/keyboard.test.ts (13 tests) 8ms
 ✓ src/game/effects.test.ts (28 tests) 9ms
 ✓ src/game/progression.test.ts (21 tests) 8ms
 ✓ src/render/webgl.test.ts (6 tests) 13ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 9ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/ui/theme.test.ts (7 tests) 5ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/game/parts.test.ts (23 tests) 12ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/game/economy.test.ts (7 tests) 4ms
 ✓ src/docs/links.test.ts (1 test) 7ms
 ✓ src/render/scene.test.ts (73 tests) 249ms
 ✓ src/game/session.test.ts (62 tests) 332ms
 ✓ src/ui/Hud.test.tsx (15 tests) 195ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 289ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 527ms
 ✓ src/App.test.tsx (23 tests) 482ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 918ms

 Test Files  45 passed (45)
      Tests  1134 passed (1134)
   Start at  22:06:25
   Duration  2.26s (transform 4.23s, setup 0ms, collect 12.63s, tests 3.92s, environment 2.68s, prepare 4.28s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.3 |    95.18 |   96.98 |    95.3 |                   
 src               |   83.29 |    78.14 |   91.89 |   83.29 |                   
  App.tsx          |    82.3 |    75.73 |      92 |    82.3 | ...90,404-406,478 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   95.54 |    99.67 |   98.72 |   95.54 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |    99.7 |      100 |     100 |    99.7 | 882-883           
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   89.76 |    99.59 |   96.36 |   89.76 | ...1087,1100-1101 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.32 |    96.47 |   95.52 |   92.32 |                   
  protocol.ts      |   85.71 |    95.53 |      88 |   85.71 | ...72-783,787-797 
  server-state.ts  |   98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   97.95 |      100 |     100 |   97.95 | 176-178,196       
 src/render        |   98.84 |    95.41 |     100 |   98.84 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  scene.ts         |   98.09 |    96.37 |     100 |   98.09 | ...29-830,854-855 
  spaceship.ts     |   97.78 |     85.1 |     100 |   97.78 | ...77,293,313,324 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   97.06 |    99.09 |    87.5 |   97.06 |                   
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...adesPanel.tsx |    91.3 |      100 |      50 |    91.3 | 75-78             
  UserPanel.tsx    |   90.74 |      100 |   66.66 |   90.74 | 66-67,89-91       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
EXIT=0
