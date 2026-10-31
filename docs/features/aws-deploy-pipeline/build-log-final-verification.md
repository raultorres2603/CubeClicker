# Build log — T-final — Full verification sweep & evidence consolidation
Task: T-final (2026-10-31)
Files changed: docs/features/aws-deploy-pipeline/build-log-final-verification.md
What changed & why: Ran the entire verification gate suite end-to-end (npm ci/lint/typecheck/test/coverage/build, Mailpit-primed containerized smoke, terraform fmt/init/validate wrappers including bootstrap, actionlint, SHA-pin/credential/inventory/AC-22 audits) and recorded raw output; walked AC-1..AC-22 with met/unmet + evidence pointers.
Decisions: Used -w /repo/infra/terraform (and bootstrap) for terraform init/validate because the 1.15.9 CLI does not accept a positional directory (T1 precedent); fmt/init/validate all exit 0. Smoke stack left running (no down -v).

## Evidence

### npm ci
Command: `npm ci`

```
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 399 packages, and audited 402 packages in 3s

102 packages are looking for funding
  run `npm fund` for details

18 vulnerabilities (16 moderate, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
EXIT=0
```

### npm run lint
Command: `npm run lint`

```

> lint
> eslint .

EXIT=0
```

### npm run typecheck
Command: `npm run typecheck`

```

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT=0
```

### npm test
Command: `npm test`

```

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/pool.test.ts (10 tests) 5ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 7ms
 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/db/migrate.test.ts (10 tests) 10ms
 ✓ src/auth/session-repository.test.ts (35 tests) 15ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/auth/user-repository.test.ts (40 tests) 18ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 24ms
 ✓ src/auth/config.test.ts (25 tests) 9ms
 ✓ src/game/economy.test.ts (20 tests) 5ms
 ✓ src/game/cubes.test.ts (24 tests) 15ms
 ✓ src/game/players.test.ts (13 tests) 9ms
 ✓ src/auth/economy-repository.test.ts (55 tests) 15ms
 ✓ src/auth/email.test.ts (12 tests) 8ms
 ✓ src/game/servers.test.ts (38 tests) 9ms
 ✓ src/game/hub.test.ts (59 tests) 75ms
 ✓ src/game/protocol.test.ts (84 tests) 17ms
 ✓ src/auth/password.test.ts (17 tests) 372ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 668ms
 ✓ src/auth/auth-service.test.ts (50 tests) 996ms
 ✓ src/app.test.ts (20 tests) 1433ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1021ms

 Test Files  21 passed (21)
      Tests  630 passed (630)
   Start at  18:37:35
   Duration  2.01s (transform 1.80s, setup 0ms, collect 4.12s, tests 3.73s, environment 3ms, prepare 1.57s)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/app.css.test.ts (78 tests) 21ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/game/effects.test.ts (28 tests) 14ms
 ✓ src/game/progression.test.ts (21 tests) 14ms
 ✓ src/auth/api.test.ts (28 tests) 20ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 13ms
 ✓ src/render/webgl.test.ts (6 tests) 6ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/ui/theme.test.ts (7 tests) 4ms
 ✓ src/multiplayer/protocol.test.ts (146 tests) 18ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/ws/connection.test.ts (10 tests) 13ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 8ms
 ✓ src/render/background-life.test.ts (14 tests) 19ms
 ✓ src/auth/store.test.ts (31 tests) 19ms
 ✓ src/game/board.test.ts (18 tests) 28ms
 ✓ src/render/particles.test.ts (19 tests) 22ms
 ✓ src/render/spaceship.test.ts (29 tests) 35ms
 ✓ src/render/picking.test.ts (12 tests) 44ms
 ✓ src/input/gestures.test.ts (27 tests) 25ms
 ✓ src/render/cube-view.test.ts (32 tests) 74ms
 ✓ src/input/keyboard.test.ts (13 tests) 20ms
 ✓ src/render/starfield.test.ts (23 tests) 129ms
 ✓ src/render/world.test.ts (27 tests) 86ms
 ✓ src/game/engine.test.ts (88 tests) 108ms
 ✓ src/render/scene-spaceship.test.ts (11 tests) 77ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 45ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 3ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 8ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 15ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 11ms
 ✓ src/render/scene.test.ts (73 tests) 270ms
 ✓ src/game/session.test.ts (62 tests) 298ms
 ✓ src/ui/Hud.test.tsx (15 tests) 118ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 220ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 337ms
 ✓ src/App.test.tsx (23 tests) 420ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 774ms

 Test Files  44 passed (44)
      Tests  1099 passed (1099)
   Start at  18:37:37
   Duration  2.23s (transform 5.30s, setup 0ms, collect 11.92s, tests 3.42s, environment 2.36s, prepare 3.67s)

EXIT=0
```

### npm run coverage
Command: `npm run coverage`

```

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/auth/rate-limit.test.ts (16 tests) 4ms
 ✓ src/game/cubes.test.ts (24 tests) 8ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/auth/user-repository.test.ts (40 tests) 12ms
 ✓ src/auth/session-repository.test.ts (35 tests) 12ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 13ms
 ✓ src/game/economy.test.ts (20 tests) 7ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/auth/config.test.ts (25 tests) 15ms
 ✓ src/game/servers.test.ts (38 tests) 16ms
 ✓ src/db/migrate.test.ts (10 tests) 13ms
 ✓ src/game/players.test.ts (13 tests) 14ms
 ✓ src/auth/economy-repository.test.ts (55 tests) 18ms
 ✓ src/auth/email.test.ts (12 tests) 11ms
 ✓ src/game/hub.test.ts (59 tests) 97ms
 ✓ src/game/protocol.test.ts (84 tests) 23ms
 ✓ src/auth/password.test.ts (17 tests) 365ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 714ms
 ✓ src/auth/auth-service.test.ts (50 tests) 888ms
 ✓ src/app.test.ts (20 tests) 1503ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1025ms

 Test Files  21 passed (21)
      Tests  630 passed (630)
   Start at  18:37:40
   Duration  2.31s (transform 1.91s, setup 0ms, collect 4.70s, tests 3.76s, environment 4ms, prepare 1.97s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.97 |    86.19 |   99.65 |   94.97 |                   
 src               |   80.54 |    84.44 |     100 |   80.54 |                   
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243 
 src/auth          |   95.74 |    80.97 |     100 |   95.74 |                   
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354 
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.42 |       85 |     100 |   96.42 | ...05-206,211-212 
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315         
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68             
 src/db            |     100 |      100 |     100 |     100 |                   
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
 src/game          |   95.63 |    93.97 |   99.01 |   95.63 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   92.36 |    89.32 |     100 |   92.36 | ...99-801,805-807 
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   98.29 |    97.43 |      96 |   98.29 | 217-218,386-387   
  servers.ts       |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
-------------------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (78 tests) 23ms
 ✓ src/ws/connection.test.ts (10 tests) 17ms
 ✓ src/auth/api.test.ts (28 tests) 20ms
 ✓ src/game/effects.test.ts (28 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (146 tests) 30ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 16ms
 ✓ src/game/progression.test.ts (21 tests) 9ms
 ✓ src/game/board.test.ts (18 tests) 18ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 15ms
 ✓ src/auth/store.test.ts (31 tests) 18ms
 ✓ src/render/background-life.test.ts (14 tests) 19ms
 ✓ src/render/particles.test.ts (19 tests) 16ms
 ✓ src/render/spaceship.test.ts (29 tests) 37ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/input/keyboard.test.ts (13 tests) 13ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 24ms
 ✓ src/render/cube-view.test.ts (32 tests) 49ms
 ✓ src/render/picking.test.ts (12 tests) 37ms
 ✓ src/input/gestures.test.ts (27 tests) 23ms
 ✓ src/render/starfield.test.ts (23 tests) 129ms
 ✓ src/game/engine.test.ts (88 tests) 104ms
 ✓ src/render/world.test.ts (27 tests) 105ms
 ✓ src/render/scene-spaceship.test.ts (11 tests) 73ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 63ms
 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/browser-env.test.ts (6 tests) 13ms
 ✓ src/game/economy.test.ts (7 tests) 3ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/game/upgrades.test.ts (20 tests) 7ms
 ✓ src/render/webgl.test.ts (6 tests) 12ms
 ✓ src/ui/theme.test.ts (7 tests) 5ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 17ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 18ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 11ms
 ✓ src/render/scene.test.ts (73 tests) 269ms
 ✓ src/game/session.test.ts (62 tests) 277ms
 ✓ src/ui/Hud.test.tsx (15 tests) 150ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 226ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 413ms
 ✓ src/App.test.tsx (23 tests) 477ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 890ms

 Test Files  44 passed (44)
      Tests  1099 passed (1099)
   Start at  18:37:43
   Duration  2.37s (transform 3.85s, setup 0ms, collect 11.08s, tests 3.70s, environment 3.06s, prepare 4.44s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.19 |    95.09 |   96.89 |   95.19 |                   
 src               |   83.29 |    78.14 |   91.89 |   83.29 |                   
  App.tsx          |    82.3 |    75.73 |      92 |    82.3 | ...90,404-406,478 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   95.17 |    99.66 |   98.61 |   95.17 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.68 |      100 |     100 |   99.68 | 861-862           
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
```

### npm run build
Command: `npm run build`

```

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 69 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.42 kB │ gzip:   0.28 kB
dist/assets/index-I6cGnLOq.css   12.11 kB │ gzip:   2.79 kB
dist/assets/index-Beh71vST.js   836.04 kB │ gzip: 228.42 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.29s
EXIT=0
```

### Smoke regression (Mailpit pre-start then npm run smoke)
Command: `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit && npm run smoke`

```

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

[4m>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

[0m Container cubeclicker-db-1 Running 
 Container cubeclicker-backend-1 Running 
 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-smoke-run-21bca6e3b99b Creating 
 Container cubeclicker-smoke-run-21bca6e3b99b Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 10
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 11
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
SMOKE PASS (12/12 checks)
EXIT=0
```

### terraform fmt -check -recursive
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform`

```
EXIT=0
```

### terraform init -backend=false (root)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false`

```
[0m[1mInitializing modules...[0m

[0m[1mInitializing provider plugins...[0m
- Reusing previous version of hashicorp/aws from the dependency lock file
- Using previously-installed hashicorp/aws v6.71.0


[0m[1m[32mTerraform has been successfully initialized![0m[32m[0m
[0m[32m
You may now begin working with Terraform. Try running "terraform plan" to see
any changes that are required for your infrastructure. All Terraform commands
should now work.

If you ever set or change modules or backend configuration for Terraform,
rerun this command to reinitialize your working directory. If you forget, other
commands will detect it and remind you to do so if necessary.[0m
EXIT=0
```

### terraform validate (root)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate`

```
[32m[1mSuccess![0m The configuration is valid.
[0m
EXIT=0
```

### terraform init -backend=false (bootstrap)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 init -backend=false`

```
[0m[1mInitializing provider plugins...[0m
- Reusing previous version of hashicorp/aws from the dependency lock file
- Using previously-installed hashicorp/aws v6.71.0


[0m[1m[32mTerraform has been successfully initialized![0m[32m[0m
[0m[32m
You may now begin working with Terraform. Try running "terraform plan" to see
any changes that are required for your infrastructure. All Terraform commands
should now work.

If you ever set or change modules or backend configuration for Terraform,
rerun this command to reinitialize your working directory. If you forget, other
commands will detect it and remind you to do so if necessary.[0m
EXIT=0
```

### terraform validate (bootstrap)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap docker.io/hashicorp/terraform:1.15.9 validate`

```
[32m[1mSuccess![0m The configuration is valid.
[0m
EXIT=0
```

### actionlint
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml`

```
EXIT=0
```

### SHA-pin audit
Command: `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml`

```
EXIT=1
```

### Credential audit
Command: `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"`

```
docs/features/containerized-workflow/reviews/code-r1.md:67:- Forbidden-technology scan of aggregate added lines (`git diff 8b34eff..HEAD … | grep '^+' | grep -oiE 'react|…|aws|azure|gcp'`) → only "AWS" within example-only ECS Fargate framing; `git grep -n "ECS Fargate" HEAD` outside docs/features → 4 occurrences, all example-only/no-commitment; secret-pattern scan of the aggregate diff (`api_key|secret|token|password|bearer|AKIA|ghp_|sk-` …) → only guidance sentences, no real secrets.
EXIT=0
```

### Inventory/state audit
Command: `git ls-files '*.tfstate*' '*.tfplan*' ; git ls-files '*terraform.lock.hcl'`

```
=== tfstate/tfplan ===
EXIT=0
=== lockfiles ===
infra/terraform/.terraform.lock.hcl
```

### AC-22 route audit
Command: `grep -n "infra/\*\*" .opencode/agents/builder.md && grep -n ".github/\*\*" .opencode/agents/builder.md`

```
68:    resource: "infra/**"
71:    resource: ".github/**"
```

## AC walk (AC-1 .. AC-22)

| AC | Status | Evidence |
|---|---|---|
| AC-1 | met | infra/terraform/versions.tf: required_version = ">= 1.11.0", aws provider ~> 6.0, aws_region default us-east-1; terraform fmt exit 0. |
| AC-2 | met | terraform init -backend=false (root + bootstrap) exit 0; validate (root + bootstrap) exit 0; no creds. |
| AC-3 | met | git ls-files '*.tfstate*' '*.tfplan*' empty; no .terraform/ tracked; only infra/terraform/.terraform.lock.hcl tracked. |
| AC-4 | met | edge module: idle_timeout = 90; backend TG path /healthz matcher 200; frontend TG path / matcher 200; /ws routed to backend. |
| AC-5 | met | ECS backend: port 8080; env vars NODE_ENV=production, DATABASE_URL, MAX_USERS_PER_SERVER, APP_BASE_URL, ALLOWED_ORIGIN, SESSION_COOKIE_SECURE, SMTP_HOST/PORT/USER/PASS/FROM; secrets via valueFrom. |
| AC-6 | met | ECR repos cubeclicker-backend/frontend; ECS frontend port 8080 default TG; image URIs SHA-tagged vars; no latest. |
| AC-7 | met | data module: engine_version = 16, publicly_accessible = false, use_external_database_url toggle; AWS-managed master user secret. |
| AC-8 | met | OIDC IdP token.actions.githubusercontent.com; roles GitHubActionsCubeCI + GitHubActionsCubeDeploy; deploy sub = environment:production; no aws_iam_access_key. |
| AC-9 | met | backend.tf key = env/production/terraform.tfstate, use_lockfile = true; envs/production.tfvars environment=production; no dynamodb/staging. |
| AC-10 | met | ci.yml: PR+push main+workflow_call; jobs verify-app/smoke-e2e/verify-infra; Mailpit up -d before smoke; verify-infra fmt/init/validate. |
| AC-11 | met | ci.yml workflow-level permissions: contents: read; no id-token; setup-node node 24 cache: npm; all uses SHA-pinned. |
| AC-12 | met | deploy.yml: push main, concurrency deploy-production, verify via workflow_call, build/push SHA-tagged images with VITE_WS_URL build-arg, OIDC deploy role, terraform init/plan/apply, deploy services wait-for-stability. |
| AC-13 | met | environment: production on build-and-push/infra/deploy-services; OIDC trust environment:production. |
| AC-14 | met | actionlint ci.yml+deploy.yml exit 0; dependabot github-actions weekly ci: prefix limit 5. |
| AC-15 | met (caveat) | No workflow sets static AWS keys. Raw `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` prints one line, but it is a documentation reference to the audit pattern in docs/features/containerized-workflow/reviews/code-r1.md, not a credential; out of scope to edit (files_owned = build log only). |
| AC-16 | met | AGENTS.md proof-of-working rule present; stack sentence amended to AWS+Terraform selected 2026-10-31. |
| AC-17 | met | builder.md verify rule includes feature-appropriate proof + raw evidence. |
| AC-18 | met | reviewer.md evidence rule reruns feature-appropriate proof; un-recorded/unreproducible = unmet. |
| AC-19 | met | orchestrator.md + playbook proof-of-working gate; state set unchanged (6 code_review anchors; awaiting_approval present). |
| AC-20 | met | web-implementation DoD recorded verification evidence item; code-review skill step 3 lists proof commands. |
| AC-21 | met | README Deployment section; deployment.md created; containerization.md + stack.md provider-neutral amendments; no 'no provider is chosen' remains. |
| AC-22 | met | Route (a): builder.md permissions block has exactly two allow entries infra/** and .github/** before .env* deny. |

## Deviations from spec
none

## Final verdict
All 22 ACs met functionally (AC-15 has a documented non-secret documentation false positive in a prior feature's review artifact; no credential present). Smoke stack left running (no down -v).
