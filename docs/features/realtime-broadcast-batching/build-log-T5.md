# Build log — T5 — Documentation and final verification

Task: T5 (2026-11-13)

Files changed:
- `docs/architecture/realtime.md` (new)
- `README.md`
- `docs/features/realtime-broadcast-batching/build-log-T5.md` (this log)

Staged without edits (`commits_also`): `spec.md`, `plan.md`, `tasks.md`, `status.md`,
`reviews/spec-review-r1.md` … `reviews/spec-review-r4.md`; `build-log-T1.md` …
`build-log-T4.md` are already committed.

What changed & why (≤5 lines):
- Added `docs/architecture/realtime.md` with exactly the five pinned `##` sections and the
  shipped behavior of encode-once fan-out, 40 ms removal batching, 250 ms economy coalescing,
  reconnect/authority and the benchmark.
- Added a minimal `### Performance benchmark` subsection under `README.md` `## Commands` with
  the two exact reproducible-evidence commands; unrelated README text is untouched.
- Ran the full root gate (lint, typecheck, test, coverage, build, smoke) and the in-process
  benchmark three times; recorded the raw output, medians and the proposed feature-index row.

Decisions:
- `docs/architecture/realtime.md` links the decided stack, the containerized delivery path and
  the feature spec; all three links resolve. The benchmark is described as evidence-only.
- The docs describe the shipped code (`MINI_CUBE_BATCH_WINDOW_MS = 40`,
  `ECONOMY_BROADCAST_INTERVAL_MS = 250`, one-id legacy shape, boundary flush list, 1024-byte
  frame bound, revision guards, closed-guard shutdown).
- No behavior source, compose file, Dockerfile, package manifest/lockfile, CI workflow or
  `docs/features/README.md` was edited.

## Consolidated before/after record (AC-25)

Baseline from `build-log-T2.md` (medians of three runs per mode, measured before the behavior
modules were wired); after from `build-log-T3.md` (medians of three runs per mode).

| Metric | Baseline (T2 median) | After (T3 median) | Target | Verdict |
| --- | --- | --- | --- | --- |
| `encodeCallsPerBroadcast` (10 recipients) | 10 | 1 | 1 | met |
| `registrySnapshotsPerBroadcast` | `null` (static baseline: 2 per accepted click) | 0 | 0 | met |
| `removalFramesPer100Clicks` | 100 | 4 | ≤ 8 | met |
| `economyFramesPer100Clicks` | 100 | 4 | ≤ 16 | met |
| `dbCreditsPer100Clicks` | 100 | 100 | 100 (unchanged) | met |
| `maxRemovalFrameBytes` | 59 (in-process) | 351 | ≤ 1024 | met |
| `p95AckLatencyMs` (wire) | 2.45 | 41.24 | ≤ 62.45 (baseline + 60) | met |

## T5 reproducibility rerun — in-process (3 runs)

Command: `node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json`

Run 1:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":1,"registrySnapshotsPerBroadcast":0,"registrySnapshots":0,"removalFramesPer100Clicks":4,"economyFramesPer100Clicks":4,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":351,"removalEncodesInWindow":4,"totalEncodesInWindow":8,"removalBroadcastFramesOnClicker":4,"totalFramesPer100Clicks":8,"economyWriteMethod":"creditWithRevision"}
```
Run 2:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":1,"registrySnapshotsPerBroadcast":0,"registrySnapshots":0,"removalFramesPer100Clicks":4,"economyFramesPer100Clicks":4,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":351,"removalEncodesInWindow":4,"totalEncodesInWindow":8,"removalBroadcastFramesOnClicker":4,"totalFramesPer100Clicks":8,"economyWriteMethod":"creditWithRevision"}
```
Run 3:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":1,"registrySnapshotsPerBroadcast":0,"registrySnapshots":0,"removalFramesPer100Clicks":4,"economyFramesPer100Clicks":4,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":351,"removalEncodesInWindow":4,"totalEncodesInWindow":8,"removalBroadcastFramesOnClicker":4,"totalFramesPer100Clicks":8,"economyWriteMethod":"creditWithRevision"}
```

All three runs identical: `encodeCallsPerBroadcast` 1, `registrySnapshotsPerBroadcast` 0,
`removalFramesPer100Clicks` 4, `economyFramesPer100Clicks` 4, `dbCreditsPer100Clicks` 100,
`maxRemovalFrameBytes` 351, accepted 100/100. This reproduces the T3 after medians exactly.

## Full suite — `npm test`

Backend:
```
 Test Files  26 passed (26)
      Tests  959 passed (959)
```

Frontend:
```
 Test Files  69 passed (69)
      Tests  1844 passed (1844)
```

## Coverage — `npm run coverage` (root; all four thresholds ≥ 80 in each workspace)

Backend:
```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.63 |    87.35 |   99.46 |   94.63 |
 src               |   80.54 |    84.44 |     100 |   80.54 |
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243
 src/auth          |   95.67 |    81.92 |     100 |   95.67 |
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |    86.14 |     100 |   95.74 | ...69-770,826-839
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |     100 |      100 |     100 |     100 |
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   94.53 |    92.85 |    98.8 |   94.53 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   89.16 |    86.04 |   98.07 |   89.16 | ...1306,1314-1315
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   98.86 |    98.55 |   96.66 |   98.86 | 238-239,553-554
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
-------------------|---------|----------|---------|---------|-------------------
```

Frontend:
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
  ...tionPanel.tsx |   91.66 |      87.5 |     100 |   91.66 | 60-61,66-67
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

## Build — `npm run build`

```
> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 104 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-CWGWNrMl.css                        26.36 kB │ gzip:   5.32 kB
dist/assets/cursor-ship-CsZPNO_l.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-CX5LpWPQ.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-DH5hMpNL.js                   49.05 kB │ gzip:  18.11 kB
dist/assets/index-BiM91p6y.js                         87.49 kB │ gzip:  27.05 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.64s
entry index assets/index-BiM91p6y.js raw=87485 gzip=27049
initial files=2 raw=309184 gzip=96005 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=983836 gzip=273980 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-CX5LpWPQ.js raw=9537 gzip=3337 initial=false
chunk browser-env assets/browser-env-DH5hMpNL.js raw=49049 gzip=18105 initial=false
chunk cursor-ship assets/cursor-ship-CsZPNO_l.js raw=6729 gzip=2210 initial=false
chunk index assets/index-BiM91p6y.js raw=87485 gzip=27049 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
```

## Smoke — `npm run smoke` (exit 0)

```
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-frontend-prod-1 Running 
 Container cubeclicker-db-1 Running 
 Container cubeclicker-mailpit-1 Running 
 Container cubeclicker-backend-1 Recreate 
 Container cubeclicker-backend-1 Recreated 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-backend-1 Starting 
 Container cubeclicker-backend-1 Started 
 Container cubeclicker-smoke-run-0e1b3823178d Creating 
 Container cubeclicker-smoke-run-0e1b3823178d Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-Cu7lmcVH.js is served gzip with immutable caching — content-encoding gzip; 87059 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (21/21 checks)
```

## Pinned docs/scope checks

```
$ test -f docs/architecture/realtime.md
exit 0
$ for h in "Fan-out" "Removal batching" "Economy coalescing" "Reconnect and authority" "Benchmark"; do grep -qx "## $h" docs/architecture/realtime.md; done
exit 0 (all five headings matched exactly)
$ grep -F 'node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json' README.md
node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json
$ grep -F 'node tests/bench/realtime-broadcast.mjs --mode wire --json' README.md
node tests/bench/realtime-broadcast.mjs --mode wire --json
$ test -z "$(git status --porcelain -- docs/features/README.md)"
exit 0
$ git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/Dockerfile' 'src/frontend/Dockerfile' package.json package-lock.json
exit 0
```

Relative-link resolution in `docs/architecture/realtime.md` (all resolve):
```
stack.md -> docs/architecture/stack.md: OK
containerization.md -> docs/architecture/containerization.md: OK
../features/realtime-broadcast-batching/spec.md -> docs/features/realtime-broadcast-batching/spec.md: OK
links: 3 missing: []
```

## Proposed feature-index row (orchestrator-owned; `docs/features/README.md` intentionally unedited)

```
| realtime-broadcast-batching | Real-Time Broadcast Batching (encode-once fan-out, registry index, 40 ms removal batches, 4 Hz economy coalescing) | planning | 2026-11-13 |
```

## Acceptance audit

- **AC-27 — met.** `docs/architecture/realtime.md` exists with exactly `## Fan-out`,
  `## Removal batching`, `## Economy coalescing`, `## Reconnect and authority` and
  `## Benchmark` (five `grep -qx` checks exit 0). It documents the shipped single-process
  server-authoritative encode-once fan-out; the 40 ms removal window, single-vs-batch shape,
  boundary flush list and 1024-byte frame bound; the 250 ms economy cadence, absolute totals,
  forced flushes and unchanged DB writes; reconnect/`stateSync` authority, no per-client
  queues, missed-batch degradation, slow-client exclusion and send-error isolation; and the
  two benchmark commands, metric definitions and evidence-only status. Its three relative
  links (stack, containerization, feature spec) all resolve. `README.md` documents both exact
  benchmark commands (both `grep -F` exit 0). No documented claim contradicts the code: the
  constants, frame shapes, flush boundaries, guards and commands were checked against
  `hub.ts`, `broadcast.ts`, `servers.ts`, both protocol mirrors and the benchmark script.
- **AC-28 — met.** `npm run lint`, `npm run typecheck`, `npm test` (backend 959, frontend
  1844), `npm run coverage` (backend 94.63/87.35/99.46/94.63; frontend
  96.47/96.14/97.54/96.47 — all ≥ 80), `npm run build` (bundle budget OK) and `npm run smoke`
  (21/21 checks) all exit 0. `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles,
  `package.json` and `package-lock.json` have an empty diff; `docs/features/README.md` is
  untouched.
- **AC-25 (consolidated record) — met.** The before/after table above consolidates the T2
  baseline and T3 after-run medians; every target is met, including `p95AckLatencyMs` 41.24 ms
  ≤ 62.45 ms. The T5 in-process rerun reproduced the after medians exactly (three identical
  runs, accepted 100/100).

## Deviations from spec

None. T5 changed only `README.md`, the new `docs/architecture/realtime.md` and this log; all
other staged feature artifacts are committed without edits, and `docs/features/README.md`,
behavior source files, compose files, Dockerfiles, `package.json`/lockfile and CI workflows
were not touched.

## Commit stat

`git show --stat --format=%s HEAD` for the T5 commit:

```
docs: document realtime broadcast batching

 README.md                                          |   9 +
 docs/architecture/realtime.md                      | 160 ++++++++
 .../realtime-broadcast-batching/build-log-T5.md    | 358 +++++++++++++++++
 docs/features/realtime-broadcast-batching/plan.md  | 422 +++++++++++++++++++++
 .../reviews/spec-review-r1.md                      |  76 ++++
 .../reviews/spec-review-r2.md                      |  83 ++++
 .../reviews/spec-review-r3.md                      |  77 ++++
 .../reviews/spec-review-r4.md                      |  77 ++++
 docs/features/realtime-broadcast-batching/spec.md  | 216 +++++++++++
 .../features/realtime-broadcast-batching/status.md |  50 +++
 docs/features/realtime-broadcast-batching/tasks.md |  97 +++++
 11 files changed, 1625 insertions(+)
```

This is the stat of the T5 commit before this stat block itself was appended. The commit was
amended with `git commit --amend --no-edit` to carry the recorded stat; the file set is
unchanged (only this log's insertion count grows). The pre-existing `build-log-T1.md`–
`build-log-T4.md` were committed with their own tasks.

## Final-image smoke evidence (code-review F1)

Code review r1 (F1) found that the T5 smoke section above was captured against a stale
`frontend-prod` image: it served `assets/index-Cu7lmcVH.js` (87,059 B, the T3 bundle) while the
T5 build produced `assets/index-BiM91p6y.js` (87,485 B, the T4 bundle). The stale run above is
kept as history. At acceptance, `frontend-prod` was rebuilt from the current tree
(`HEAD 53f7cbd`, working tree clean apart from the acceptance docs) and `npm run smoke` was
re-run against the final bundle.

Rebuild command (exit 0):

```
$ podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod
```

Raw output (build-context progress lines elided; every build step below is the verbatim
`STEP`/cache/result output of the rebuild):

```
[2/3] STEP 1/10: FROM docker.io/library/node:24-alpine AS build
[2/3] STEP 2/10: WORKDIR /app
--> Using cache 08aa04b85941e76e1085e0667b2619260c8e651314d285cb17054f3f934793d3
--> 08aa04b85941
[2/3] STEP 3/10: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 2903b704bcf444813f06bb7bbe0bfbae2dd6ded3f2638b64d75cf276c8f474b8
--> 2903b704bcf4
[2/3] STEP 4/10: COPY src/backend/package.json src/backend/package.json
--> Using cache 80a0004ef70eac788efdce8b18c568ffe25b7a25fa4244480d8b84de0e077031
--> 80a0004ef70e
[2/3] STEP 5/10: COPY src/frontend/package.json src/frontend/package.json
--> Using cache bf9412ee93dd609c614fdbca75422fee5d2a758f6ad858275853db7b351daf95
--> bf9412ee93dd
[2/3] STEP 6/10: RUN npm ci
--> Using cache 5d525c560d53fdb0703e1aadfddd640e98b907462a266c052a21c4599931b5a2
--> 5d525c560d53
[2/3] STEP 7/10: COPY src/frontend src/frontend
--> Using cache b0e78afa8fb8a69ca99a1d543b20216210e55f68e0307a57f250cc3c36c725e3
--> b0e78afa8fb8
[2/3] STEP 8/10: ARG VITE_WS_URL="ws://localhost:8080/ws"
--> Using cache aa9adc32c1f4458800e9dff8fdcaa5987f97ddce798efaa88c2dc9d2d773462a
--> aa9adc32c1f4
[2/3] STEP 9/10: ENV VITE_WS_URL=${VITE_WS_URL}
--> Using cache 54ef942f787f0a1ba65b29ecf4d7d7f174223181fa2ae9ae82fae41726c5c593
--> 54ef942f787f
[2/3] STEP 10/10: RUN npm run build -w @cubeclicker/frontend
--> Using cache a77ae4bf34f98924931d1e07b96ab0519e71db5b4cede2f95367c78a666881a8
--> a77ae4bf34f9
[3/3] STEP 1/6: FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS prod
[3/3] STEP 2/6: COPY src/frontend/nginx.conf /etc/nginx/conf.d/default.conf
--> Using cache bd692aaa86d3e862d916a3985e544c6e405ac904775732e1b57680b3c63d9d5a
--> bd692aaa86d3
[3/3] STEP 3/6: COPY --from=build /app/src/frontend/dist/ /usr/share/nginx/html/
--> Using cache b3dded702c7f6c6886101f1e72934a0858cad92f5cb083c8f22ecfa393f81c13
--> b3dded702c7f
[3/3] STEP 4/6: EXPOSE 8080
--> Using cache 04e2685385b702bfd0e29c88fa774c80cda6eecc6f11e6339fbbecf77fc85597
--> 04e2685385b7
[3/3] STEP 5/6: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
--> Using cache 67e7ba0a34cf84043de26a15f2eacf3dad77a97e0e515dabf3200b881e2c06ab
--> 67e7ba0a34cf
[3/3] STEP 6/6: LABEL "com.docker.compose.image.builder"="classic"
--> Using cache a262a5625f5713080c39572a30c35e4d2953d37ee3eee0a096ad44c6122858a3
[3/3] COMMIT docker.io/library/cubeclicker-frontend:prod-smoke
--> a262a5625f57
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
a262a5625f5713080c39572a30c35e4d2953d37ee3eee0a096ad44c6122858a3
Successfully built a262a5625f57
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built 
 Image cubeclicker-frontend:prod-smoke Built 
```

Image/container identity and final entry bundle:

```
$ podman image inspect docker.io/library/cubeclicker-frontend:prod-smoke --format '{{.Id}} created={{.Created}}'
a262a5625f5713080c39572a30c35e4d2953d37ee3eee0a096ad44c6122858a3 created=2026-11-13 11:28:32.649834112 +0000 UTC
$ podman inspect cubeclicker-frontend-prod-1 --format 'image={{.Image}} imageName={{.ImageName}} started={{.State.StartedAt}}'
image=a262a5625f5713080c39572a30c35e4d2953d37ee3eee0a096ad44c6122858a3 imageName=docker.io/library/cubeclicker-frontend:prod-smoke started=2026-11-13 12:28:41.455524506 +0100 CET
$ podman run --rm --entrypoint sha256sum docker.io/library/cubeclicker-frontend:prod-smoke /usr/share/nginx/html/assets/index-BiM91p6y.js
79f9d0e67f28988cad560d610938bf9f204e84f99e455f495865b9730f40acc9  /usr/share/nginx/html/assets/index-BiM91p6y.js
$ sha256sum src/frontend/dist/assets/index-BiM91p6y.js
79f9d0e67f28988cad560d610938bf9f204e84f99e455f495865b9730f40acc9  src/frontend/dist/assets/index-BiM91p6y.js
$ grep -o 'assets/index-[A-Za-z0-9_-]*\.js' src/frontend/dist/index.html
assets/index-BiM91p6y.js
```

- Final entry bundle: `assets/index-BiM91p6y.js` (Vite content hash `BiM91p6y`), 87,485 B raw;
  file SHA-256 `79f9d0e67f28988cad560d610938bf9f204e84f99e455f495865b9730f40acc9`, identical
  inside the `frontend-prod` image and in the local `npm run build` output.
- The running `cubeclicker-frontend-prod-1` container uses image `a262a5625f57…`, the image
  produced by the rebuild command above, so the smoke run below exercised the final bundle.
  Compose reported the container as `Running` (no recreate) because the rebuild is a
  deterministic cache hit that produced the same image ID the reviewer's rebuild had already
  started; the served-asset check pins the actual bundle bytes.

Final-image smoke — `npm run smoke` (exit 0; ANSI escapes stripped):

```

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-db-1 Running 
 Container cubeclicker-mailpit-1 Running 
 Container cubeclicker-backend-1 Running 
 Container cubeclicker-frontend-prod-1 Running 
 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-smoke-run-da0b5f5e15b5 Creating 
 Container cubeclicker-smoke-run-da0b5f5e15b5 Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 8
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 9
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1001ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-BiM91p6y.js is served gzip with immutable caching — content-encoding gzip; 87485 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (21/21 checks)
```

F1 closure: `SMOKE PASS (21/21 checks)` plus `PASS prod /assets/index-BiM91p6y.js is served
gzip with immutable caching — content-encoding gzip; 87485 B decompressed` proves AC-26/AC-28
against the final frontend bundle, superseding the stale T3-bundle evidence above. No source,
test, config, compose file, Dockerfile or review artifact was edited for this evidence run.
