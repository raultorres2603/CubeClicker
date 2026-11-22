# Build log — T9 — Verify & integrate

Task: T9 (2026-11-22)
Feature: `brevo-smtp-email-delivery` (spec r4, tasks r4)
Files changed by T9: `docs/features/brevo-smtp-email-delivery/build-log-T9.md` (new).
Integration commit (this task) stages the still-untracked orchestrator-authored artifacts — `spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/spec-r1.md`, `reviews/spec-r2.md` — plus this log, with no edits to them. No production source, config, test or documentation file is modified by T9.

## What changed & why (verification-only task)
- Ran the complete T9 verify list verbatim and in order (31 pinned commands) on top of the T0–T8 tree: lint, typecheck, tests, coverage, build, compose config, clean-stack hostile-env Mailpit smoke, compose-network asset serving, asset `--check`, both OpenCode config checks, the credential guard self-test and every credential audit, plus actionlint / Vercel / Render config checks.
- The hostile smoke proves **Mailpit, not Brevo**, delivered the verification mail: the smoke backend resolves `SMTP_HOST=mailpit` even under exported Brevo values, and Mailpit's API holds the one verification message the smoke extracts its token from.
- The serving proof returns `200` + `image/png` + PNG signature for all four `/email/*.png` URLs from both the Vite dev server (`frontend:5173`) and the nginx prod image (`frontend-prod:8080`).
- Every AC-1…AC-21 clause was walked against the current run; all are met (see the audit below).
- Integrated the orchestrator artifacts and this evidence into the feature branch commit.

Feature branch range: `origin/main..HEAD` = 9 commits (T0–T8: `97cab2f`, `17107c2`, `602ef2f`, `9c906ef`, `0c96658`, `2214e97`, `941862d`, `6eb14b5`, `36d6aa8`); T9 adds the integration commit on top.

## Decisions and environment notes
1. **Stale local prod image (environment-only refresh).** The first execution of the pinned compose-network serving command failed for the prod origin: `http://frontend-prod:8080/email/cubeclicker-hero.png content-type text/html`. The local `cubeclicker-frontend:prod-smoke` image predated T2's committed PNGs (its `/usr/share/nginx/html` had no `email/` directory), and the compose provider does not auto-rebuild an existing image. The image was rebuilt from the current tree (`podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod`, then `up -d --force-recreate frontend-prod`) and the pinned command then passed. No repository file changed; a fresh clone/CI build includes `public/email/` through the existing `npm run build` (the Dockerfile copies `src/frontend` and runs `vite build`). Raw failure and raw rerun are both recorded below. This is the documented build step already noted in `compose.smoke.yaml` lines 3–5.
2. **actionlint SELinux label.** The pinned `podman run --rm -v "$PWD:/repo" …` form exited `3` with `could not read ".github/workflows/deploy.yml": … permission denied` because the host is SELinux-enforcing and the bind mount carried different MCS categories. The same actionlint `1.7.12` image over the same files with `--security-opt label=disable` exited `0` with no findings (workflows are unchanged by this feature). Both raw results are recorded below; the check is not weakened.
3. **Two read-only extra proofs were added to the hostile-smoke evidence** (no code change): the running backend container's non-secret SMTP env (`SMTP_HOST/PORT/SECURE/FROM` plus set/unset flags for USER/PASS — no credential value is read) and Mailpit's `/api/v1/messages` (total, subject, recipient only). Together they prove the smoke mail went to Mailpit while the host exported Brevo values.
4. **T8's documentation greps were re-run as the final-gate proof** for AC-13/14/16(d)/20 (36/36 pass), because T9's own pinned list does not repeat them and T9 owns the full-AC gate.
5. No secret was printed, read or recorded. `.env*` files were not touched. Nothing was pushed.

## Evidence

### Host toolchain
- Node 24 LTS (project runtime), npm workspaces.
- Podman `6.1.3` with the external compose provider `docker-compose v5.6.0` (`podman compose`), SELinux `Enforcing`.

### Pinned T9 verify commands (verbatim, in task order)

Each block records the exact command from `tasks.md` § T9, its exit code and its raw output (ANSI colour codes stripped from compose-provider output; nothing else changed).

#### [1/31]

```sh
npm run lint
```

exit `0`

```text

> lint
> eslint .
```

#### [2/31]

```sh
npm run typecheck
```

exit `0`

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

#### [3/31]

```sh
npm test
```

exit `0`

```text
> test
> npm run test --workspaces --if-present
> test
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
 Test Files  40 passed (40)
      Tests  1773 passed (1773)
> test
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 Test Files  83 passed (83)
      Tests  2844 passed (2844)
```

#### [4/31]

```sh
npm run coverage
```

exit `0`

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.59 |    90.54 |    99.6 |   96.59 |                   
 src               |   96.72 |    91.45 |     100 |   96.72 |                   
  app.ts           |   95.74 |     88.5 |     100 |   95.74 | ...18-319,367-369 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 src/auth          |   96.17 |    83.69 |     100 |   96.17 |                   
  auth-routes.ts   |    81.4 |     55.3 |     100 |    81.4 | ...61-363,369-370 
  auth-service.ts  |     100 |    81.87 |     100 |     100 | ...97,402,419,507 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847 
  email-cli.ts     |    98.3 |    80.55 |     100 |    98.3 | 176-177           
  ...l-template.ts |     100 |      100 |     100 |     100 |                   
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
 src/game          |   96.25 |    94.92 |   99.13 |   96.25 |                   
  activity.ts      |     100 |      100 |     100 |     100 |                   
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   91.36 |    89.09 |   98.59 |   91.36 | ...1833,1920-1923 
  leaderboard.ts   |     100 |      100 |     100 |     100 |                   
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts-v3.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   99.36 |     99.2 |   97.77 |   99.36 | 477-478,1088-1089 
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290           
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/observability |   99.67 |     96.5 |     100 |   99.67 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  db-metrics.ts    |     100 |      100 |     100 |     100 |                   
  logging.ts       |     100 |      100 |     100 |     100 |                   
  metrics-route.ts |     100 |      100 |     100 |     100 |                   
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252           
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57                
-------------------|---------|----------|---------|---------|-------------------

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.15 |    96.75 |   98.36 |   97.15 |                   
 src               |   88.38 |    86.06 |   95.65 |   88.38 |                   
  App.tsx          |   86.72 |    83.25 |   96.42 |   86.72 | ...35-437,459-460 
  browser-env.ts   |   93.65 |      100 |   92.85 |   93.65 | 76-79             
  config.ts        |     100 |      100 |     100 |     100 |                   
 src/auth          |   96.85 |     86.2 |   96.15 |   96.85 |                   
  api.ts           |   96.44 |     87.5 |     100 |   96.44 | ...61-162,170,222 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   97.02 |    99.51 |   99.16 |   97.02 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.48 |      100 |     100 |   99.48 | 987-988,1297-1298 
  motion.ts        |     100 |      100 |     100 |     100 |                   
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts-v3.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  reveal-motion.ts |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   91.51 |    98.96 |   97.61 |   91.51 | ...1852,1989-1990 
  ship-forms.ts    |     100 |      100 |     100 |     100 |                   
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   95.77 |    97.56 |   98.03 |   95.77 |                   
  ...y-lifetime.ts |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   93.47 |    97.41 |   95.65 |   93.47 | ...1706,1710-1721 
  server-state.ts  |   97.97 |    96.15 |     100 |   97.97 | ...44,446-447,510 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200               
 src/perf          |     100 |      100 |     100 |     100 |                   
  overlay.ts       |     100 |      100 |     100 |     100 |                   
 src/render        |   98.68 |    98.84 |   98.98 |   98.68 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |      100 |     100 |      99 | 299-300           
  cube-view.ts     |   99.29 |      100 |     100 |   99.29 | 344-345           
  cursor-ship.ts   |   99.58 |    98.18 |     100 |   99.58 | 228-229           
  ...ct-effects.ts |   98.64 |      100 |     100 |   98.64 | ...49-350,474-475 
  ...box-reveal.ts |     100 |      100 |     100 |     100 |                   
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  preview.ts       |     100 |      100 |     100 |     100 |                   
  quality.ts       |   98.31 |      100 |     100 |   98.31 | 316-317,400-401   
  remote-ship.ts   |     100 |    97.93 |     100 |     100 | 509,516           
  scene.ts         |   97.32 |      100 |      96 |   97.32 | ...1202,1210-1211 
  ship-motion.ts   |     100 |      100 |     100 |     100 |                   
  shot-visuals.ts  |     100 |      100 |     100 |     100 |                   
  ...ship-model.ts |     100 |      100 |     100 |     100 |                   
  spaceship.ts     |   96.33 |      100 |   97.29 |   96.33 | ...23-724,750-753 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  targeting.ts     |   95.78 |      100 |     100 |   95.78 | ...64-166,178-179 
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   97.56 |    90.98 |     100 |   97.56 | ...09-510,544-545 
 src/ui            |   97.38 |    94.93 |   97.27 |   97.38 |                   
  ActivityFeed.tsx |     100 |      100 |     100 |     100 |                   
  AuthForms.tsx    |     100 |    99.07 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   91.66 |    86.66 |     100 |   91.66 | 60-61,66-67       
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  Leaderboard.tsx  |     100 |      100 |     100 |     100 |                   
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...boxReveal.tsx |   98.24 |    94.89 |     100 |   98.24 | 154-155,275-276   
  PerfOverlay.tsx  |   98.52 |      100 |     100 |   98.52 | 84                
  ...tionPanel.tsx |   96.35 |    91.33 |     100 |   96.35 | ...05-406,435-436 
  ...ipPreview.tsx |   86.99 |    77.41 |      75 |   86.99 | ...27-128,133-134 
  ...adesPanel.tsx |    97.1 |    91.89 |     100 |    97.1 | 84-85,103-104     
  UserPanel.tsx    |     100 |      100 |     100 |     100 |                   
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  hangar-tabs.ts   |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

#### [5/31]

```sh
npm run build
```

exit `0`

```text

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 117 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-laKoxB0N.css                        45.63 kB │ gzip:   8.21 kB
dist/assets/cursor-ship-CYbML0fs.js                    8.41 kB │ gzip:   2.74 kB
dist/assets/SpaceshipCustomizationPanel-DZfa07sQ.js   17.90 kB │ gzip:   6.38 kB
dist/assets/browser-env-wuGf4aCr.js                   57.26 kB │ gzip:  20.84 kB
dist/assets/index-CouI9G8n.js                        108.81 kB │ gzip:  33.03 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-Ddozhxko.js                        610.56 kB │ gzip: 154.65 kB
✓ built in 1.62s
entry index assets/index-CouI9G8n.js raw=108805 gzip=33034
initial files=2 raw=330504 gzip=101990 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
total files=6 raw=1024637 gzip=286599 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-DZfa07sQ.js raw=17903 gzip=6382 initial=false
chunk browser-env assets/browser-env-wuGf4aCr.js raw=57261 gzip=20844 initial=false
chunk cursor-ship assets/cursor-ship-CYbML0fs.js raw=8406 gzip=2736 initial=false
chunk index assets/index-CouI9G8n.js raw=108805 gzip=33034 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-Ddozhxko.js raw=610563 gzip=154647 initial=false

Bundle budget OK.
```

#### [6/31]

```sh
env -u SMTP_HOST -u SMTP_PORT -u SMTP_USER -u SMTP_PASS -u SMTP_SECURE -u SMTP_FROM -u SMTP_CONNECTION_TIMEOUT_MS podman compose --env-file /dev/null -f compose.yaml config | node -e "let s='';process.stdin.on('data',(d)=>{s+=d}).on('end',()=>{const yaml=require('js-yaml');const c=yaml.load(s);const e=c.services.backend.environment||{};const get=(k)=>Array.isArray(e)?(e.find((x)=>x.startsWith(k+'='))||'').slice(k.length+1):e[k];const host=get('SMTP_HOST');const port=String(get('SMTP_PORT'));if(host!=='mailpit'||port!=='1025')throw new Error('backend SMTP must resolve to mailpit:1025 without SMTP env; got '+JSON.stringify({host,port}));console.log('compose backend SMTP resolves to mailpit:1025 with no SMTP env')})"
```

exit `0`

```text
compose backend SMTP resolves to mailpit:1025 with no SMTP env
```

#### [7/31]

```sh
podman compose -f compose.yaml -f compose.smoke.yaml down --remove-orphans
```

exit `0`

```text
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-frontend-1 Stopping 
 Container cubeclicker-backend-1 Stopping 
 Container cubeclicker-mailpit-1 Stopping 
 Container cubeclicker-frontend-1 Stopped 
 Container cubeclicker-frontend-1 Removing 
 Container cubeclicker-mailpit-1 Stopped 
 Container cubeclicker-mailpit-1 Removing 
 Container cubeclicker-backend-1 Stopped 
 Container cubeclicker-backend-1 Removing 
 Container cubeclicker-mailpit-1 Removed 
 Container cubeclicker-backend-1 Removed 
 Container cubeclicker-db-1 Stopping 
 Container cubeclicker-db-1 Stopped 
 Container cubeclicker-db-1 Removing 
 Container cubeclicker-frontend-1 Removed 
 Container cubeclicker-db-1 Removed 
 Network cubeclicker_default Removing 
 Network cubeclicker_default Removed
```

#### [8/31]

```sh
podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit
```

exit `0`

```text
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Network cubeclicker_default Creating 
 Network cubeclicker_default Creating 
 Network cubeclicker_default Created 
 Network cubeclicker_default Created 
 Container cubeclicker-mailpit-1 Creating 
 Container cubeclicker-mailpit-1 Created 
 Container cubeclicker-mailpit-1 Starting 
 Container cubeclicker-mailpit-1 Started
```

#### [9/31]

```sh
SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_USER=hostile SMTP_PASS=hostile SMTP_SECURE=false npm run smoke
```

exit `0`

```text

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-mailpit-1 Running 
 Container cubeclicker-frontend-prod-1 Creating 
 Container cubeclicker-db-1 Creating 
 Container cubeclicker-frontend-1 Creating 
 Container cubeclicker-db-1 Created 
 Container cubeclicker-backend-1 Creating 
 Container cubeclicker-frontend-1 Created 
 Container cubeclicker-frontend-prod-1 Created 
 Container cubeclicker-backend-1 Created 
 Container cubeclicker-frontend-prod-1 Starting 
 Container cubeclicker-frontend-1 Starting 
 Container cubeclicker-db-1 Starting 
 Container cubeclicker-frontend-prod-1 Started 
 Container cubeclicker-frontend-1 Started 
 Container cubeclicker-db-1 Started 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-backend-1 Starting 
 Container cubeclicker-backend-1 Started 
 Container cubeclicker-smoke-run-e047c4de4f45 Creating 
 Container cubeclicker-smoke-run-e047c4de4f45 Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 1; memberJoined id 1 for p1
PASS appearance projection: guest B's 11-slot setAppearance yields exactly one memberAppearance on guest A, and an unknown slot key yields bad_message without a broadcast — playerId p2; 11 slots; unknown slot key rejected with bad_message; 1 memberAppearance frame(s) seen by A
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p2
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 0ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 1; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=9 cubeclicker_ws_messages_received_total{type="join"}=7 cubeclicker_ws_frames_sent_total{type="hello"}=9
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-2Putw1vD.js is served gzip with immutable caching — content-encoding gzip; 115778 B decompressed
PASS prod /assets/three-BpzJmJxA.js is served gzip with immutable caching — content-encoding gzip; 610571 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (29/29 checks)
```

#### [10/31]

```sh
podman compose -f compose.yaml -f compose.smoke.yaml up -d frontend frontend-prod
```

exit `0`

```text
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-frontend-prod-1 Running 
 Container cubeclicker-frontend-1 Running
```

#### [11/31]

```sh
podman compose -f compose.yaml -f compose.smoke.yaml run --rm --no-deps smoke node -e "const urls=['http://frontend:5173/email/cubeclicker-hero.png','http://frontend:5173/email/cubeclicker-cube.png','http://frontend-prod:8080/email/cubeclicker-hero.png','http://frontend-prod:8080/email/cubeclicker-cube.png'];const check=async(u)=>{const r=await fetch(u);if(r.status!==200)throw new Error(u+' status '+r.status);const ct=(r.headers.get('content-type')||'').split(';')[0].trim();if(ct!=='image/png')throw new Error(u+' content-type '+ct);const b=Buffer.from(await r.arrayBuffer());if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(u+' is not a PNG');console.log('PASS '+u+' 200 image/png '+b.length+' bytes')};(async()=>{for(const u of urls){await check(u)}})().catch((e)=>{console.error(e.message);process.exit(1)})"
```

exit `0`

```text
INITIAL RUN (before the prod image rebuild) — exit 1:
  PASS http://frontend:5173/email/cubeclicker-hero.png 200 image/png 4357 bytes
  PASS http://frontend:5173/email/cubeclicker-cube.png 200 image/png 582 bytes
  http://frontend-prod:8080/email/cubeclicker-hero.png content-type text/html
  Error: … exit status 1

RERUN after `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` + force-recreate — exit 0:
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-smoke-run-e615cb81b57b Creating 
 Container cubeclicker-smoke-run-e615cb81b57b Created 
PASS http://frontend:5173/email/cubeclicker-hero.png 200 image/png 4357 bytes
PASS http://frontend:5173/email/cubeclicker-cube.png 200 image/png 582 bytes
PASS http://frontend-prod:8080/email/cubeclicker-hero.png 200 image/png 4357 bytes
PASS http://frontend-prod:8080/email/cubeclicker-cube.png 200 image/png 582 bytes
```

#### [12/31]

```sh
podman compose -f compose.yaml -f compose.smoke.yaml down --remove-orphans
```

exit `0`

```text
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-frontend-1 Stopping 
 Container cubeclicker-mailpit-1 Stopping 
 Container cubeclicker-backend-1 Stopping 
 Container cubeclicker-frontend-prod-1 Stopping 
 Container cubeclicker-backend-1 Stopped 
 Container cubeclicker-backend-1 Removing 
 Container cubeclicker-frontend-prod-1 Stopped 
 Container cubeclicker-frontend-prod-1 Removing 
 Container cubeclicker-backend-1 Removed 
 Container cubeclicker-db-1 Stopping 
 Container cubeclicker-frontend-prod-1 Removed 
 Container cubeclicker-frontend-1 Stopped 
 Container cubeclicker-frontend-1 Removing 
 Container cubeclicker-frontend-1 Removed 
 Container cubeclicker-db-1 Stopped 
 Container cubeclicker-db-1 Removing 
 Container cubeclicker-db-1 Removed 
 Container cubeclicker-mailpit-1 Stopped 
 Container cubeclicker-mailpit-1 Removing 
 Container cubeclicker-mailpit-1 Removed 
 Network cubeclicker_default Removing 
 Network cubeclicker_default Removed
```

#### [13/31]

```sh
podman run --rm -v "$PWD:/repo" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
```

exit `0`

```text
INITIAL RUN (pinned form) — exit 3:
  could not read ".github/workflows/deploy.yml": open .github/workflows/deploy.yml: permission denied

SAME CHECK with `--security-opt label=disable` (actionlint 1.7.12, same files) — exit 0, no findings:
  (no output)
```

#### [14/31]

```sh
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
```

exit `0`

```text
vercel.json: valid JSON
```

#### [15/31]

```sh
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));const s=b.services[0];const names=['SMTP_SECURE','SMTP_CONNECTION_TIMEOUT_MS'];for(const n of names){const e=(s.envVars||[]).filter((v)=>v.key===n);if(e.length!==1||e[0].sync!==false||'value' in e[0])throw new Error(n+' must be sync:false without value')}console.log('render.yaml: valid')"
```

exit `0`

```text
render.yaml: valid
```

#### [16/31]

```sh
node src/frontend/scripts/generate-email-assets.mjs --check
```

exit `0`

```text
PASS src/frontend/public/email/cubeclicker-hero.png 4357 B 3295b14d0583df835cfe000788636475321d78408b6f2f21edd95901e49d9c24
PASS src/frontend/public/email/cubeclicker-cube.png 582 B e6b346a8977eb63bd193a7f80da4fe4a413c17314ec14b46c83564c79988bb80
email assets: 2/2 OK
```

#### [17/31]

```sh
node -e "const fs=require('node:fs');const spec=[['src/frontend/public/email/cubeclicker-hero.png',600,200,61440],['src/frontend/public/email/cubeclicker-cube.png',72,72,15360]];for(const [p,w,h,max] of spec){const b=fs.readFileSync(p);if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(p+' is not a PNG');const W=b.readUInt32BE(16),H=b.readUInt32BE(20);if(W!==w||H!==h)throw new Error(p+' is '+W+'x'+H+', expected '+w+'x'+h);if(b.length>max)throw new Error(p+' is '+b.length+' bytes, max '+max);console.log(p+' '+W+'x'+H+' '+b.length+' bytes')}"
```

exit `0`

```text
src/frontend/public/email/cubeclicker-hero.png 600x200 4357 bytes
src/frontend/public/email/cubeclicker-cube.png 72x72 582 bytes
```

#### [18/31]

```sh
node -e "const ts=require('typescript');const fs=require('node:fs');const path='opencode.jsonc';const parsed=ts.parseConfigFileTextToJson(path,fs.readFileSync(path,'utf8'));if(parsed.error)throw new Error('invalid JSONC: '+ts.flattenDiagnosticMessageText(parsed.error.messageText,' '));const entries=parsed.config.mcp?.servers??parsed.config.mcp??parsed.config.mcpServers;if(entries===null||typeof entries!=='object'||Array.isArray(entries))throw new Error('opencode.jsonc must define an MCP entry map (mcp.servers, mcp, or mcpServers)');const names=Object.keys(entries);const brevo=names.filter((n)=>n.toLowerCase()==='brevo');if(brevo.length!==1)throw new Error('expected exactly one brevo entry, got '+JSON.stringify(names));const entry=entries[brevo[0]];const got=Object.keys(entry).sort();for(const refName of ['vercel','Neon']){const ref=entries[refName];if(ref===null||typeof ref!=='object')throw new Error('reference entry '+refName+' missing');const want=Object.keys(ref).sort();if(JSON.stringify(got)!==JSON.stringify(want))throw new Error('brevo entry keys '+JSON.stringify(got)+' must match '+refName+' keys '+JSON.stringify(want))}if(Object.hasOwn(entry,'headers'))throw new Error('brevo entry must not carry headers in the repo copy');if(typeof entry.type!=='string'||typeof entry.url!=='string')throw new Error('brevo entry must reference the server with type/url');if(/xkeysib-[A-Za-z0-9]{20,}|xsmtpsib-[A-Za-z0-9]{15,}/.test(JSON.stringify(entry)))throw new Error('brevo entry still carries a credential');console.log('opencode.jsonc: valid JSONC; entries '+JSON.stringify(names)+'; exactly one brevo with the vercel/Neon reference shape (keys '+JSON.stringify(got)+', no headers, no credential)')"
```

exit `0`

```text
opencode.jsonc: valid JSONC; entries ["vercel","Neon","brevo"]; exactly one brevo with the vercel/Neon reference shape (keys ["type","url"], no headers, no credential)
```

#### [19/31]

```sh
node -e "const ts=require('typescript');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const dir=path.join(os.homedir(),'.config','opencode');const candidates=['opencode.json','opencode.jsonc'].map((f)=>path.join(dir,f)).filter((f)=>fs.existsSync(f));if(candidates.length!==1)throw new Error('expected exactly one global OpenCode config (opencode.json or opencode.jsonc), found '+JSON.stringify(candidates));const file=candidates[0];const parsed=ts.parseConfigFileTextToJson(file,fs.readFileSync(file,'utf8'));if(parsed.error)throw new Error('global config is not valid JSONC: '+ts.flattenDiagnosticMessageText(parsed.error.messageText,' '));const entries=parsed.config.mcp?.servers??parsed.config.mcp??parsed.config.mcpServers;if(entries===null||typeof entries!=='object'||Array.isArray(entries))throw new Error('global config has no MCP entry map');const names=Object.keys(entries);const brevo=names.filter((n)=>n.toLowerCase()==='brevo');if(brevo.length!==1)throw new Error('global config must carry exactly one brevo entry, got '+JSON.stringify(names));const headers=entries[brevo[0]].headers??{};const auth=Array.isArray(headers.Authorization)?headers.Authorization.join(' '):String(headers.Authorization??'');if(!/xkeysib-[A-Za-z0-9]{20,}|xsmtpsib-[A-Za-z0-9]{15,}/.test(auth))throw new Error('global brevo entry does not carry headers.Authorization with a key');console.log('global '+file+': entries '+JSON.stringify(names)+'; brevo present with headers.Authorization (value not printed)')"
```

exit `0`

```text
global /home/raultorraco/.config/opencode/opencode.json: entries ["context7","github","render","brevo"]; brevo present with headers.Authorization (value not printed)
```

#### [20/31]

```sh
test "$(git show HEAD:opencode.jsonc | grep -cE 'xkeysib-[A-Za-z0-9]{20,}')" -eq 0
```

exit `0`

```text
(no output — exit 0)
```

#### [21/31]

```sh
test "$(git show HEAD:opencode.jsonc | grep -cE 'xsmtpsib-[A-Za-z0-9]{15,}')" -eq 0
```

exit `0`

```text
(no output — exit 0)
```

#### [22/31]

```sh
! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
```

exit `0`

```text
(no output — exit 0)
```

#### [23/31]

```sh
! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
```

exit `0`

```text
(no output — exit 0)
```

#### [24/31]

```sh
! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
```

exit `0`

```text
(no output — exit 0)
```

#### [25/31]

```sh
! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
```

exit `0`

```text
(no output — exit 0)
```

#### [26/31]

```sh
test -z "$(git log origin/main..HEAD --name-only --pretty=format: | grep -E '^\.env')"
```

exit `0`

```text
(no output — exit 0)
```

#### [27/31]

```sh
git diff origin/main...HEAD --numstat -- opencode.jsonc
```

exit `0`

```text
4	0	opencode.jsonc
```

#### [28/31]

```sh
! git diff origin/main...HEAD -- opencode.jsonc | grep -qE 'xkeysib-|xsmtpsib-'
```

exit `0`

```text
(no output — exit 0)
```

#### [29/31]

```sh
node -e "const cases=[['xsmtpsib-15','xsmtpsib-'+ 'a'.repeat(15),/xsmtpsib-[A-Za-z0-9]{15,}/],['xkeysib-24','xkeysib-'+'b'.repeat(24),/xkeysib-[A-Za-z0-9]{20,}/],['assigned-15','SMTP_PASS='+'c'.repeat(15),/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/]];for(const [label,value,re] of cases){if(!re.test(value))throw new Error('guard pattern misses '+label)}const allowed=['SMTP_USER=<your-smtp-login>','SMTP_PASS=<SMTP key>','SMTP_USER=hostile'];for(const value of allowed){if(/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/.test(value))throw new Error('guard rejects a documented placeholder')}console.log('credential guard self-test: key formats matched, documented placeholders allowed')"
```

exit `0`

```text
credential guard self-test: key formats matched, documented placeholders allowed
```

#### [30/31]

```sh
test -f docs/features/brevo-smtp-email-delivery/build-log-T9.md
```

exit `0`

```text
SEE Post-write confirmation below (this file must exist for the check).
```

#### [31/31]

```sh
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T9.md
```

exit `0`

```text
SEE Post-write confirmation below (this file must not match any key/assignment pattern).
```

## Extra proofs (feature-appropriate, not part of the pinned 31)

### Mailpit — not Brevo — received the hostile-smoke mail (AC-11(b))
The hostile smoke was started from a clean stack (command 7 removed the pre-existing plain stack), Mailpit was started alone (command 8), then command 9 ran with the host exporting `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, non-empty `SMTP_USER`/`SMTP_PASS` and `SMTP_SECURE=false`. `compose.smoke.yaml` pinned those six fields to Mailpit. Three read-only checks prove the delivery path:

```text
$ podman exec cubeclicker-backend-1 printenv SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_FROM
mailpit
1025
false
no-reply@cubeclicker.local

$ podman exec cubeclicker-backend-1 node -e "<set/unset flags only>"
SMTP_USER_SET=no SMTP_PASS_SET=no

$ node -e "<GET http://127.0.0.1:8025/api/v1/messages, print total/subject/to>"
Mailpit total=1 returned=1
subject="Verify your CubeClicker email" to=smoke17953466283202y6kzl@example.com
```

`tests/e2e/smoke.mjs` only knows `MAILPIT_URL` (`http://mailpit:8025`): it polls `/api/v1/messages`, reads `/api/v1/message/<ID>` and extracts `/token=([A-Za-z0-9]+)/` from the delivered message (the branded HTML carries the raw token). Its `PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account` line is therefore direct proof that Mailpit — the in-stack container, with no auth and no TLS — received and served the mail, while the host environment pointed at Brevo.

### Merged smoke config under a hostile host environment (AC-11(a), re-confirmed at the final gate)
```sh
$ env SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_USER=hostile SMTP_PASS=hostile SMTP_SECURE=true SMTP_FROM=hostile@example.com \
    podman compose --env-file /dev/null -f compose.yaml -f compose.smoke.yaml config | node -e "<pinned six-field assertion>"
compose.smoke backend SMTP pins to Mailpit under a hostile host env
exit 0
```

### T8 documentation greps re-run (AC-13, AC-14, AC-16(d), AC-20)
T8's 36 pinned `grep`/`node` assertions were re-executed against the current tree: **36/36 exit `0`**, only output:

```text
documented deployed-origin asset recipe present
```

### Credential scan of every build log (AC-12(d))
```sh
$ ! grep -qE "<pinned key/assignment pattern>" docs/features/brevo-smtp-email-delivery/build-log-*.md
exit 0
$ ls docs/features/brevo-smtp-email-delivery/build-log-*.md | wc -l
9
```
The nine T0–T8 logs (T9's own log is checked by command 31) carry no key shape and no credential-looking assignment.

### No workflow change / no live provider contact (AC-14, spec non-goals)
```text
$ git diff --name-only origin/main...HEAD | grep -E '^\.github'
(none)
$ grep -Rn "generate-email-assets" package.json src/frontend/package.json src/frontend/vite.config.ts src/backend/package.json
(no build/script wiring)
```
No CI job or workflow contacts Brevo; the asset generator is not wired into `npm run build` (AC-21).

## Acceptance audit — AC-1 … AC-21 (full-AC gate)

Method: each clause is checked against the current tree and this run — `npm test` (backend 1773, frontend 2844 passing), `npm run coverage`, the pinned commands above, the T8 grep rerun and the T0–T8 build logs. Exact test titles and values below are from the current sources.

- **AC-1 — met.** `config.test.ts` § `SMTP_SECURE`: `loadAuthConfig({}).smtpSecure === false`, `SMTP_PORT=1025 → false`, `SMTP_PORT=465 → true`; empty `SMTP_SECURE` keeps derivation (`465 → true`, `1025 → false`); explicit `true`/`1` override on 1025 and `false`/`0` override on 465; `'yes'` and `'TRUE'` throw the pinned message. Config module is 100% statements/branches/functions/lines in the coverage table.
- **AC-2 — met.** `config.test.ts`: default `10000` and `DEFAULT_SMTP_CONNECTION_TIMEOUT_MS === 10000`; `1000`, `120000`, `2500` accepted exactly; `999`, `120001`, `10000.5`, `abc`, `""` rejected with the pinned message including the received value.
- **AC-3 — met.** `config.test.ts` asserts both pinned messages; `app.test.ts` `throws the SMTP_SECURE parse error from buildApp (AC-3)` and `throws the SMTP_CONNECTION_TIMEOUT_MS range error from buildApp (AC-3)` assert the same exact strings from the composition root; `server.ts` calls `loadAuthConfig` before `listen` (unchanged call path).
- **AC-4 — met.** `config.test.ts` § `SMTP credential pairing`: both set accepted; both absent and both empty accepted (null/null); USER-only, PASS-only and mixed-empty pairs throw `SMTP_USER and SMTP_PASS must be provided together (both or neither)`.
- **AC-5 — met.** `email.test.ts` strict-equality objects: Brevo 587 → `{host:'smtp-relay.brevo.com',port:587,secure:false,requireTLS:true,auth:{user,pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:10000}`; 465 → `secure:true, requireTLS:false`; Mailpit → `{host:'mailpit',port:1025,secure:false,requireTLS:false}` with `connectionTimeout`/`greetingTimeout`/`socketTimeout` all `10000` and `Object.hasOwn(options,'auth') === false`; the `2500` override lands in all three timeout fields; the factory is called exactly once with the exact object; `app.test.ts` asserts `buildApp` calls the injected factory once with the exact Brevo object.
- **AC-6 — met.** `config.test.ts` empty environment returns `smtpHost:'mailpit'`, `smtpPort:1025`, `smtpSecure:false`, `smtpUser:null`, `smtpPass:null`, `smtpFrom:'no-reply@cubeclicker.local'`, `smtpConnectionTimeoutMs:10000`; `email.test.ts` builds the plaintext transport with no `auth` and no STARTTLS requirement (strict object above).
- **AC-7 — met.** `email.test.ts` `sends exactly { from, to, subject, text, html }…` asserts `from: 'CubeClicker <no-reply@example.com>'`, subject `Verify your CubeClicker email`, the exact plain text and the rendered HTML, with no `replyTo`/`attachments` (strict object); `email-template.test.ts` `keeps the plain-text body byte-for-byte identical`. `app.test.ts` re-asserts the same envelope through a real registration.
- **AC-8 — met.** `email-cli.test.ts` asserts exactly one send to `user@example.com` and the single stdout line `Test email sent to user@example.com via smtp-relay.brevo.com:587 (secure=false, starttls=required, auth=yes, from="no-reply@example.com")`; the Mailpit-defaults case also prints `Warning: SMTP_FROM is the local default; set it to a verified sender before real delivery.`; the Brevo success case asserts the credential values are absent from the output.
- **AC-9 — met.** Missing `--to`, dangling `--to`, unknown option and invalid address each return `1`, print the pinned line plus usage and construct no service; `--help` returns `0`; config error prints `Invalid email configuration: <sanitized>`; a rejection carrying both credential values and a REST-key-shaped token (assembled at runtime) prints exactly `Failed to send test email via smtp-relay.brevo.com:587: 535 authentication failed for [redacted] ([redacted]) with [redacted]` and returns `1`; a short SMTP-key-shaped token prints `[redacted]` and returns `1`; `redactSecrets` unit cases cover both key patterns.
- **AC-10 — met.** `auth-routes.test.ts` line 592: transport rejection on register → HTTP `500` with body `{ message: 'internal error', code: 'internal_error', error: 'internal_error' }`, no session cookie, account persisted with `verified: false`; resend → `202`, second email with the same `VERIFICATION_TTL_MS` and a fresh token; the first token is rejected with `400 invalid_token` while the new one verifies. `auth-service.test.ts` covers the same failure/resend recovery at the service layer.
- **AC-11 — met.** (a) command 6 (hermetic plain compose: `SMTP_*` unset + `--env-file /dev/null` → `mailpit:1025`) and the merged hostile-config proof above; T7's build log records the same checks. (b) commands 7–9: clean `down --remove-orphans`, Mailpit started alone, hostile-env `npm run smoke` exits `0` with **29/29 PASS** including `PASS auth register`, `PASS auth verify: Mailpit delivers a verification email…`; the Mailpit API proof above shows exactly one message with the pinned subject and the backend's resolved Mailpit config.
- **AC-12 — met.** (a) command 15 (`render.yaml` has both names exactly once with `sync:false` and no `value`). (b) commands 20–28 all exit `0`: HEAD key-pattern counts `0`/`0`; tracked tree, untracked files, branch diff and branch history are silent; no `.env*` file is added in the range. (c) commands 18/19: repo `mcp.servers` entries `["vercel","Neon","brevo"]` with the brevo key set equal to both references (`["type","url"]`, no `headers`, no key); global `~/.config/opencode/opencode.json` entries `["context7","github","render","brevo"]` with `headers.Authorization` (value not printed); numstat `4	0	opencode.jsonc`; the working-copy diff contains no key shape. (d) no `.env*` commit (command 26) and every build log is pattern-free (nine-log scan; command 31 covers this log).
- **AC-13 — met.** T8's 36 greps re-run 36/36: every file (`README.md`, `deployment.md`, `vercel-render-neon.md`) carries `SMTP_SECURE` and `SMTP_CONNECTION_TIMEOUT_MS`; the README env table documents `SMTP_SECURE` as empty → derived (`true` on 465) and `SMTP_CONNECTION_TIMEOUT_MS` default `10000`; the Brevo recipe names `smtp-relay.brevo.com`, `587`/`465`, `Settings → SMTP & API → SMTP`, **SMTP key**, **not the REST API key**, verified sender and the CLI; both catalogs name the SMTP key; the "guest-only"/"placeholders" wording is gone from all three docs; `vercel-render-neon.md` records the two `compose.yaml` pass-throughs and the `compose.smoke.yaml` Mailpit pinning; `containerization.md` no longer claims `compose.yaml` is untouched; the **Secret hygiene** note with both key patterns is present.
- **AC-14 — met.** `README.md` § Test-email CLI (user-owned check) carries the literal `podman compose exec backend`, `npm run email:test -w @cubeclicker/backend -- --to <address>`, `node dist/auth/email-cli.js`, the `Test email sent to` success line, the SMTP login / SMTP key / verified-sender prerequisites and the `user-owned` marker. No workflow or CI job contacts Brevo (no `.github` change; smoke uses Mailpit only). The manual live check itself remains user-owned and unrun by automation.
- **AC-15 — met.** `email-template.test.ts`: four `<table role="presentation">` elements, one 600px panel, no `<style>`/`<link>`/`<script>`/`<svg>`/`@import`/`@font-face`/`url(`; exactly 24 hex tokens whose unique set is the nine pinned literals; preheader, headline `Verify your CubeClicker account`, exactly one `id="verify-cta"` with the escaped URL and text `Verify email`, two anchors total, visible fallback URL equal to the verification URL, footer `CubeClicker — an online cube-clicking game.`, expiry sentence and `If it wasn't you, you can safely ignore this email.`
- **AC-16 — met.** (a) two `<img>` elements only, exact `src`/`width`/`height`/`alt` (`CubeClicker`, `CubeClicker cube`), the HTML's only URLs are the two assets plus the verification URL three times; the `sendMail` envelope is strict-equal with no `attachments`/CID; the CTA is a text/background cell and the URL is visible. (b) both PNGs committed under `src/frontend/public/email/` (command 17 verifies their bytes). (c) command 11: all four compose-network URLs return `200`, `image/png` and the PNG signature, with byte counts 4357/582 matching the committed files. (d) the deployed-origin recipe is documented-not-run (`curl -fsSI`, `200`, `image/png`, `documented-not-run`) — T8 grep rerun passes. (e) `emailAssetUrls` returns the exact relative fallback for `/verify?token=x`, `not a url` and `mailto:`; rendering never throws and keeps the CTA/URL.
- **AC-17 — met.** (a) command 16 prints `PASS … 4357 B <sha256>` and `PASS … 582 B <sha256>` for both files (`email assets: 2/2 OK`); command 17 confirms the 8-byte PNG signature, 600×200 and 72×72, both within 61,440/15,360 bytes; `email-template.test.ts` loads them via `new URL('../../../frontend/public/email/…', import.meta.url)`; T2's log records the pinned palette/determinism. (b) HTML is exactly `4_322` bytes ≤ `20_480`. (c) combined text + HTML + images is exactly `9_448` bytes < `102_400`; the five WCAG pairs are pinned at 16.98, 10.15, 10.99, 15.89 and 9.96 (all ≥ 4.5).
- **AC-18 — met.** (a) plain text is byte-for-byte the previous body (`email-template.test.ts`), and `/token=([A-Za-z0-9]+)/` extracts the same token from the branded HTML (`exposes the same token to the Mailpit extraction regex`). (b) command 9: containerized smoke passes register → Mailpit read → verify → login (`29/29 PASS`).
- **AC-19 — met.** (a) default renders `This link expires in 24 hours.`; `3_600_000` renders `1 hour`; `604_800_000` renders `7 days` (plus whole-hour/day formatting cases). (b) `auth-service.test.ts` asserts `verificationTokenTtlMs` is passed to both register and resend sends and that the rendered HTML carries the configured lifetime; `auth-routes.test.ts` records `VERIFICATION_TTL_MS` on both messages after a failure/resend cycle.
- **AC-20 — met.** `README.md`: branded CubeClicker template with unchanged subject, images under `src/frontend/public/email/` served from the frontend origin (`APP_BASE_URL` literal present), CTA and visible URL work when images are blocked, `SMTP_FROM` should be the literal `CubeClicker <verified sender>`; architecture docs state the images use the existing frontend origin with no new service/port/image (`vercel-render-neon.md` line 178, `containerization.md` line 60). T8 grep rerun passes.
- **AC-21 — met.** `src/frontend/scripts/generate-email-assets.mjs` is committed in the feature diff and is the only authoring source; it uses Node built-ins only, pins the seed/geometry/5×7 font/palette/zlib level, and its `--check` regenerates in memory and compares SHA-256 (`PASS <file> <bytes> B <sha256>`); command 16 passes; `npm run build` does not invoke it (no script/build wiring; build output has no generator step).

## Deviations from spec
None. T9 changes no behavior, no configuration and no documentation content beyond this evidence log; the two environment adjustments (prod-image rebuild, actionlint SELinux label) are recorded above and do not weaken any check.

## Post-write confirmation of commands 30–31
Executed after the evidence above was written (the check therefore sees this file's full content):

```text
$ test -f docs/features/brevo-smtp-email-delivery/build-log-T9.md
exit 0

$ ! grep -qE "<pinned key/assignment pattern>" docs/features/brevo-smtp-email-delivery/build-log-T9.md
exit 0
```

Both commands were re-run after this confirmation was appended (the file changed): both still exit `0`. The untracked-file credential audit (command 23) was also re-run at that point: exit `0`.

## Post-commit confirmation (c8b6186)

The credential audits were re-run against the committed T9 tree — `c8b6186014b8dd21b5f215209de0f5e1fe5fb0ad` (`c8b6186`) — after the integration commit. The guard is the same pinned key/assignment pattern as T9 commands 22–25, 28 and 31, shown here as `"<pinned key/assignment pattern>"` so this log stays pattern-free as command 31 requires. No secret value was printed or read.

```text
$ git grep -nE "<pinned key/assignment pattern>"
no matches (exit 1)

$ git grep --untracked -nE "<pinned key/assignment pattern>"
no matches (exit 1)

$ git diff origin/main...HEAD | grep -cE "<pinned key/assignment pattern>"
0

$ git log -p origin/main..HEAD | grep -cE "<pinned key/assignment pattern>"
0

$ git log origin/main..HEAD --name-only --pretty=format: | grep -cE '^\.env'
0

$ git status --porcelain=v1
?? .agents/
?? skills-lock.json
```

Audit 1 covers the tracked tree at `HEAD`; audit 2 covers untracked non-ignored files (`.agents/` and `skills-lock.json` are the only untracked paths). Audits 3 and 4 are count-only (`grep -c`), so no diff or patch line could be printed. Audit 5 confirms no `.env*` path appears in any branch commit. Audit 6 is the expected pre-existing untracked state: `.agents/` and `skills-lock.json` only, never staged, and no tracked file modified.

The T9 commit was then amended with `build-log-T9.md` staged alone (`git commit --amend --no-edit`); the amended hash is recorded in the one-line follow-up commit below.

Amended T9 commit: `fbadccffd308ce2f34b24a55a349e491e38aa229` (`fbadccf`) — the evidence above was written against `c8b6186` and applies unchanged to this tree.
