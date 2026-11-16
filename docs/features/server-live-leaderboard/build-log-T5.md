# Build log — T5 — Documentation and final verification

Task: T5 (2026-11-16)

Files changed:
- `docs/architecture/realtime.md` (edit — new `## Live leaderboard` section before `## Benchmark`)
- `docs/product/glossary.md` (edit — new `### live leaderboard` entry between `key` and `lootbox`)
- `docs/features/server-live-leaderboard/build-log-T5.md` (this file)

Staged, not edited (`commits_also`): `docs/features/server-live-leaderboard/spec.md`, `plan.md`,
`tasks.md`, `status.md`, `reviews/spec-review-r1.md`, `reviews/spec-review-r2.md`, and
`build-log-T1.md` … `build-log-T4.md` (the T1–T4 logs were already tracked by their task commits).

Sketch (before implementation):
1. Add one `## Live leaderboard` section to `realtime.md` covering counters, ranking/totals, 1 s coalescing, placement snapshots, grace/moves/cleanup, isolation/client guard, metrics, accessibility, privacy and rollback.
2. Add the `### live leaderboard` glossary entry in alphabetical position with the session-scoped/no-coins/no-persistence definition.
3. Run the root gate: lint, typecheck, all-workspace tests, coverage, build, `frontend-prod` rebuild, smoke, the docs grep checks and the protected-file/README checks.
4. Record the raw evidence, doc excerpts, proposed feature-index row and final repository state here.

What changed & why:
- `docs/architecture/realtime.md`: new `## Live leaderboard` section (added by feature
  `server-live-leaderboard`, 2026-11-16) before `## Benchmark`. It documents the three session
  counters and their exact accepted-transition increment points (`handleExplode` after the rate
  limit + `validateExplode` and the accepted id, the `faceCleared` predicate, `handleCompletion`
  after `isComplete`); the deliberate coin exclusion and no-account-totals rule; the
  cubes → clicks → slot-order total order, `LEADERBOARD_TOP_LIMIT = 5` entries and totals over
  **all** current members; `LEADERBOARD_INTERVAL_MS = 1000` per-server coalescing (one timer per
  dirty server, no quiet-server/non-counter frames, unchanged 40 ms removal and 250 ms economy
  paths); the `welcome`/rejoin/`worldEntered` immediate snapshot and travel-window replacement;
  grace retention and counters-follow-the-mover; `dropServer`/`hub.close()` cleanup; per-server
  isolation and the `serverId` client guard; the two metrics `type` allow-list values and no new
  metric; the single-live-region/`aria-live="off"`/reduced-motion/left-rail accessibility
  contract; privacy; and additivity/rollback. The section links to the feature spec and the
  glossary anchor (both resolve).
- `docs/product/glossary.md`: new `### live leaderboard` entry between `### key` and `### lootbox`,
  defining the per-game-server session-scoped ranking, the accepted-action counters, the ~1/s
  coalesced updates, the top-five + totals display, the `welcome` snapshot, and the
  no-persistence/no-coins/no-account-totals rule, with a guest/account parity example.
- No behavior source, test, compose, Dockerfile, package or workflow file was touched. No new
  dependency, command, port, image or environment variable exists, so `README.md` is unchanged and
  `docs/features/README.md` stays orchestrator-owned and untouched.

Decisions:
- The section follows the existing `realtime.md` pattern (Activity feed): one contract section with
  links to the feature spec and glossary, not a new architecture document.
- Everything documented was re-checked against the shipped code: `src/backend/src/game/leaderboard.ts`,
  `hub.ts` (`sessionStats`, increment/mark points, `placementFor`, `publishLeaderboard`,
  `removeMember`, `hub.close()`), `observability/metrics.ts`, `src/frontend/src/multiplayer/protocol.ts`,
  `server-state.ts`, `ui/Leaderboard.tsx` and `ui/game-view.css`.
- The glossary states the player-facing rule (cubes → clicks → slot, ~1/s, top five + totals,
  session-only, no coins) rather than repeating the wire shape, per `docs/architecture/documentation.md`.

Evidence:

`npm run lint` → exit 0
```
> lint
> eslint .
```

`npm run typecheck` (root, both workspaces) → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

`npm test` (root, all workspaces) → exit 0
```
> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/leaderboard.test.ts (23 tests) 20ms
 ✓ src/game/protocol.test.ts (455 tests) 59ms
 ✓ src/game/hub.test.ts (181 tests) 316ms
 ✓ src/observability/metrics.test.ts (32 tests) 15ms
 ...
 Test Files  37 passed (37)
      Tests  1506 passed (1506)
   Start at  09:16:30
   Duration  3.74s (transform 5.54s, setup 0ms, collect 15.40s, tests 14.57s, environment 10ms, prepare 4.97s)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/multiplayer/server-state.test.ts (80 tests) 29ms
 ✓ src/multiplayer/protocol.test.ts (540 tests) 73ms
 ✓ src/ui/Leaderboard.test.tsx (8 tests) 20ms
 ✓ src/game/session.test.ts (110 tests) 1778ms
 ✓ src/App.test.tsx (50 tests) 1089ms
 ✓ src/ui/game-view.css.test.ts (58 tests) 41ms
 ...
 Test Files  74 passed (74)
      Tests  2248 passed (2248)
   Start at  09:16:34
   Duration  3.98s (transform 9.24s, setup 0ms, collect 26.55s, tests 13.31s, environment 9.19s, prepare 7.00s)
```

`npm run coverage` (root, all workspaces; thresholds 80/80/80/80 per workspace) → exit 0
```
> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 Test Files  37 passed (37)
      Tests  1506 passed (1506)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.19 |    89.83 |   99.57 |   96.19 |
 src               |   97.65 |    91.08 |     100 |   97.65 |
  app.ts           |   96.94 |    87.32 |     100 |   96.94 | ...40,224,318-319
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   95.74 |    83.13 |     100 |   95.74 |
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 | ...61-363,369-370
  auth-service.ts  |     100 |    81.75 |     100 |     100 | ...95,400,417,503
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...69-770,826-839
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |   98.02 |    93.75 |     100 |   98.02 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   95.53 |    94.18 |   99.02 |   95.53 |
  activity.ts      |     100 |      100 |     100 |     100 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   90.84 |    88.28 |   98.46 |   90.84 | ...1690,1741-1744
  leaderboard.ts   |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.28 |    99.09 |   97.56 |   99.28 | 372-373,967-968
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/observability |   99.67 |     96.5 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 247-248
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57
-------------------|---------|----------|---------|---------|-------------------


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  74 passed (74)
      Tests  2248 passed (2248)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.63 |    96.35 |    97.8 |   96.63 |
 src               |   88.08 |    85.34 |   95.45 |   88.08 |
  App.tsx          |    86.5 |    82.47 |   96.42 |    86.5 | ...35-437,459-460
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77
  config.ts        |     100 |      100 |     100 |     100 |
 src/auth          |   96.85 |     86.2 |   96.15 |   96.85 |
  api.ts           |   96.44 |      87.5 |     100 |   96.44 | ...61-162,170,222
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193
 src/game          |   96.34 |    99.39 |      99 |   96.34 |
  board.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |   99.47 |      100 |     100 |   99.47 | 958-959,1250-1251
  motion.ts        |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   90.86 |    98.78 |   97.29 |   90.86 | ...1561,1681-1682
  types.ts         |     100 |      100 |     100 |     100 |
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   94.51 |    97.11 |   96.55 |   94.51 |
  protocol.ts      |   91.82 |    97.14 |   92.85 |   91.82 | ...1554,1558-1568
  server-state.ts  |   97.65 |    95.23 |     100 |   97.65 | ...88,390-391,454
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200
 src/perf          |     100 |      100 |     100 |     100 |
  overlay.ts       |     100 |      100 |     100 |     100 |
 src/render        |   98.58 |    98.97 |    98.8 |   98.58 |
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
  scene.ts         |   97.26 |     99.4 |   95.34 |   97.26 | ...1076,1084-1085
  ship-motion.ts   |     100 |      100 |     100 |     100 |
  ...ship-model.ts |     100 |      100 |     100 |     100 |
  spaceship.ts     |   96.16 |      100 |   97.05 |   96.16 | ...63-664,690-693
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  targeting.ts     |   95.78 |      100 |     100 |   95.78 | ...64-166,178-179
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |   98.46 |       92 |     100 |   98.46 | 231-234,453
 src/ui            |   96.97 |    94.52 |   95.23 |   96.97 |
  ActivityFeed.tsx |     100 |      100 |     100 |     100 |
  AuthForms.tsx    |     100 |    99.07 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   91.66 |      87.5 |     100 |   91.66 | 60-61,66-67
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63
  Hud.tsx          |     100 |      100 |     100 |     100 |
  Leaderboard.tsx  |     100 |      100 |     100 |     100 |
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |
  PerfOverlay.tsx  |   98.52 |      100 |     100 |   98.52 | 84
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
Both workspaces clear the 80/80/80/80 thresholds on every metric (backend 96.19/89.83/99.57/96.19;
frontend 96.63/96.35/97.8/96.63); `leaderboard.ts` and `Leaderboard.tsx` are 100% on all four.

`npm run build` (root, all workspaces) → exit 0
```
> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 109 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-KuxM9rl7.css                        28.80 kB │ gzip:   5.68 kB
dist/assets/cursor-ship-mW-EKWkQ.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-aFXm8gsD.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-_RsU1Uep.js                   49.19 kB │ gzip:  18.16 kB
dist/assets/index-NkhNsjDs.js                         97.26 kB │ gzip:  29.80 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.62s
entry index assets/index-NkhNsjDs.js raw=97263 gzip=29795
initial files=2 raw=318962 gzip=98751 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=993754 gzip=276782 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-aFXm8gsD.js raw=9537 gzip=3338 initial=false
chunk browser-env assets/browser-env-_RsU1Uep.js raw=49189 gzip=18159 initial=false
chunk cursor-ship assets/cursor-ship-mW-EKWkQ.js raw=6729 gzip=2211 initial=false
chunk index assets/index-NkhNsjDs.js raw=97263 gzip=29795 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
```

`podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` → exit 0
```
[2/3] STEP 1/10: FROM docker.io/library/node:24-alpine AS build
[2/3] STEP 2/10: WORKDIR /app
--> Using cache 08aa04b85941e76e1085e0667b2619260c8e651314d285cb17054f3f934793d3
[2/3] STEP 3/10: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 2903b704bcf444813f06bb7bbe0bfbae2dd6ded3f2638b64d75cf276c8f474b8
[2/3] STEP 4/10: COPY src/backend/package.json src/backend/package.json
--> Using cache d3772f9126bdcb3ed2224d893a2d11411464870a70842f9c51b5f5b2d0896eb9
[2/3] STEP 5/10: COPY src/frontend/package.json src/frontend/package.json
--> Using cache cf62d892269790144d637bd72f970d4dbcb1e6831ea6618d91ec91fb7c73643a
[2/3] STEP 6/10: RUN npm ci
--> Using cache 9ee4c4e2b445bc6d51a115472ee8f3fbbc015b29d4f6dbd89dc04559e5915183
[2/3] STEP 7/10: COPY src/frontend src/frontend
--> Using cache 02aa3eb18490c770498b82ebb12641c7dcd1a0185edc3de1376ce32f6a2fe8b5
[2/3] STEP 8/10: ARG VITE_WS_URL="ws://localhost:8080/ws"
--> Using cache bf43062457516859ba9f4d102e1a0013722c2c4d77a9c48e303bd444d52c797a
[2/3] STEP 9/10: ENV VITE_WS_URL=${VITE_WS_URL}
--> Using cache 8ad2b06c4be44033eaa940d322596e7871142e727f9f59e50283b93eb73db5d0
[2/3] STEP 10/10: RUN npm run build -w @cubeclicker/frontend
--> Using cache 5c88fbf7dcdf4880d945f3525eca142c6262e17948165abe3b329fb2a23771d1
[3/3] STEP 1/6: FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS prod
[3/3] STEP 2/6: COPY src/frontend/nginx.conf /etc/nginx/conf.d/default.conf
--> Using cache bd692aaa86d3e862d916a3985e544c6e405ac904775732e1b57680b3c63d9d5a
[3/3] STEP 3/6: COPY --from=build /app/src/frontend/dist/ /usr/share/nginx/html/
--> Using cache b12ea182ce276359220507da1bb8a91613f9ac80145b8eadd0072b5987e369a5
[3/3] STEP 4/6: EXPOSE 8080
--> Using cache e9f66884286d62d8a9398360e3c4c69d95bca635b75b68240f4c342babe964aa
[3/3] STEP 5/6: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
--> Using cache 5eeb75b557b90582088f014fde2eb55cbf8dc7b93ce4a758d3a5c66a5445c59f
[3/3] STEP 6/6: LABEL "com.docker.compose.image.builder"="classic"
--> Using cache a9af56e40a15e10171cbb25190b67ad687edce0adf91175f06b3de27afc0c799
[3/3] COMMIT docker.io/library/cubeclicker-frontend:prod-smoke
--> a9af56e40a15
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
a9af56e40a15e10171cbb25190b67ad687edce0adf91175f06b3de27afc0c799
Successfully built a9af56e40a15
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
```

`npm run smoke` → exit 0 (26/26 checks)
```
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 5
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 5; memberJoined id 1 for p6
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 5
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 6
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p7
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=14 cubeclicker_ws_messages_received_total{type="join"}=10 cubeclicker_ws_frames_sent_total{type="hello"}=14
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-BY3oMfjV.js is served gzip with immutable caching — content-encoding gzip; 97329 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (26/26 checks)
```

Documentation verify commands → all exit 0 (`DOC_CHECKS_OK`)
```
$ test -f docs/architecture/realtime.md
$ grep -qx '## Live leaderboard' docs/architecture/realtime.md
$ grep -F 'LEADERBOARD_INTERVAL_MS' docs/architecture/realtime.md
$ grep -F 'LEADERBOARD_TOP_LIMIT' docs/architecture/realtime.md
$ grep -F 'leaderboardUpdate' docs/architecture/realtime.md
$ grep -F 'aria-live="off"' docs/architecture/realtime.md
$ grep -F '### live leaderboard' docs/product/glossary.md
$ test -z "$(git status --porcelain -- docs/features/README.md)"      # empty
$ git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json
DOC_CHECKS_OK
```

Doc excerpt — `docs/architecture/realtime.md` (`## Live leaderboard`, line 256):
```
## Live leaderboard

Added by feature `server-live-leaderboard` (2026-11-16); the full contract and acceptance criteria
are in the [feature spec](../features/server-live-leaderboard/spec.md), and the player-facing term
is in the [glossary](../product/glossary.md#live-leaderboard). The leaderboard is a per-server,
session-scoped ranking on a third additive snapshot path: the hub derives three counters from
transitions it has already validated, ranks that server's current members, and publishes one
`leaderboardUpdate` at most once per second per server through the same encode-once fan-out
described in § Fan-out. No client message creates, names or modifies a counter, no protocol
version bump is made, and nothing is persisted.
```
Section subsections present: Session counters; Ranking and totals; Coalescing cadence; Welcome,
reconnect and `worldEntered`; Grace, moves and cleanup; Isolation and client guard; Metrics;
Client presentation and accessibility; Privacy and rollback.

Doc excerpt — `docs/product/glossary.md` (`### live leaderboard`):
```
### live leaderboard

**Definition:** A compact, per-**game server** ranking of that server's current **server members** by their session progress: cubes completed, then accepted clicks, then server slot order. The hub counts each member's accepted clicks, faces cleared and cubes completed from transitions it has already validated — never from a client-reported value — and publishes the top five entries plus server-wide totals at most once per second, coalesced per server, so a busy server never receives a frame per click. Fresh joins, reconnects and cross-server moves receive the current snapshot in the `welcome`/`worldEntered` placement. Counters are session-scoped: they follow a member who moves servers, a member in reconnect grace stays ranked until final removal, and a backend restart clears everything. The leaderboard ranks no coins and reads no persisted account totals, so **guests** and accounts compete on exactly the same basis; the panel is non-interactive, not a live region and has a reduced-motion variant.
**Example:** A guest and an account that each completed one cube are ranked by their accepted clicks on the same game server, and the panel shows the five leaders plus `Server totals: 2 cubes · 40 clicks · 3 faces`.
```

Final repository state before this log's commit:
```
$ git status --porcelain
 M docs/architecture/realtime.md
 M docs/product/glossary.md
?? docs/features/server-live-leaderboard/build-log-T5.md
?? docs/features/server-live-leaderboard/plan.md
?? docs/features/server-live-leaderboard/reviews/
?? docs/features/server-live-leaderboard/spec.md
?? docs/features/server-live-leaderboard/status.md
?? docs/features/server-live-leaderboard/tasks.md

$ git diff --stat
 docs/architecture/realtime.md | 142 ++++++++++++++++++++++++++++++++++++++++++
 docs/product/glossary.md      |   5 ++
 2 files changed, 147 insertions(+)
```
(The logs T1–T4 were already committed by their own tasks; this log and the staged feature
artifacts are untracked at this point by design — they are committed by T5.)

Proposed `docs/features/README.md` row (orchestrator applies; not edited by this task):
```
| server-live-leaderboard | Server Live Leaderboard (session counters, top-5 + totals, 1 Hz coalescing, left-rail panel) | planning | 2026-11-16 |
```

Acceptance audit (T5 scope per `tasks.md`):
- AC-25 (docs half) → met: `docs/architecture/realtime.md` gains `## Live leaderboard` before
  `## Benchmark` documenting the counters and their accepted-transition increment points, the coin
  exclusion/no-account-totals rule, cubes → clicks → slot ranking, the top-five entries and
  all-current-member totals, the 1000 ms per-server coalescing and unchanged 40 ms/250 ms paths,
  the `welcome`/rejoin/`worldEntered` snapshot and travel window, grace retention and
  counters-follow-the-mover, cleanup, per-server isolation and the `serverId` guard, the two
  metrics allow-list values, the single-live-region/`aria-live="off"`/reduced-motion/left-rail
  accessibility contract, privacy and rollback; `docs/product/glossary.md` gains
  `### live leaderboard` between `key` and `lootbox`; both new relative links
  (`../features/server-live-leaderboard/spec.md`, `../product/glossary.md#live-leaderboard`)
  resolve; `docs/features/README.md` is proposed here but not edited; `README.md`, `compose.yaml`,
  `compose.smoke.yaml`, the Dockerfiles and the package files are unchanged.
- AC-26 → met: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`
  (≥ 80 on statements, branches, functions and lines in both workspaces), `npm run build`, the
  `frontend-prod` rebuild and `npm run smoke` (26/26) all exit 0; no new npm dependency and no
  change to `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`,
  `src/frontend/Dockerfile`, `package.json` or `package-lock.json`.

Deviations from spec: none. T5 touched only its `files_owned` documentation files; no behavior
source, test, compose, Dockerfile, package or workflow file was changed, and nothing was pushed.
