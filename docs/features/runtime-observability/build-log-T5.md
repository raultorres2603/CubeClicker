# Build log — T5 — Documentation and final verification

Task: T5 (2026-11-15)

Files changed:
- `docs/architecture/observability.md` (new) — canonical logging/metrics/exposure/overlay/verification reference
- `README.md` — `## Operations` section and `LOG_LEVEL` / `METRICS_ENABLED` / `VITE_PERF_OVERLAY` configuration rows
- `docs/architecture/deployment.md` — internal-only `/metrics` routing sentence; the supersession-ledger row is no longer "paused"
- `compose.yaml` — backend `LOG_LEVEL` / `METRICS_ENABLED` and frontend `VITE_PERF_OVERLAY` environment pass-throughs
- `tests/e2e/smoke.mjs` — joined-state `checkMetrics` scrape
- `docs/features/runtime-observability/build-log-T5.md` (this file)

What changed & why (≤5 lines):
1. `docs/architecture/observability.md` documents the shipped logging contract (levels/events/fields/redaction/serializers, no bodies), the 30-metric catalog and its allow-listed labels, the internal-only `GET /metrics` exposure and retention model, the dev-only overlay/RTT protocol, and the verification commands; it has exactly the five pinned `##` sections and all seven relative links resolve.
2. `README.md` gains an `## Operations` section with `podman compose logs backend`, `curl http://localhost:8080/metrics`, the three override commands and configuration-table rows for `LOG_LEVEL` (compose default `debug`), `METRICS_ENABLED` (default `true`) and `VITE_PERF_OVERLAY` (default `false`).
3. `compose.yaml` passes the three documented variables to the existing services with safe defaults; no service, port, image or healthcheck changes, so local behavior is unchanged.
4. `tests/e2e/smoke.mjs` opens one client, reads `hello`, joins, waits for `welcome`, scrapes `http://backend:8080/metrics` while joined, asserts the Prometheus content type and the pinned live gauges/counters, then closes and settles.
5. `docs/architecture/deployment.md` states that `/metrics` is intentionally not routed by the public edge (the historical ALB and the current Vercel + Fly target add no `/metrics` route).

Decisions:
- **Documentation reconciled with the current deployment target.** The approved spec predates the `vercel-fly-neon-deployment` migration, so the doc names the historical ALB/CloudWatch path explicitly as historical while documenting the current Fly stdout/`fly logs` path; the required sentence "not routed by the public edge" and the required CloudWatch `awslogs` + 30-day-retention reference are both present. The stale ledger row in `deployment.md` (`paused, assumptions stale`) is updated to "resumed on this target"; that is the only extra deployment-doc edit and keeps the doc internally consistent.
- **Internal-only is a network-boundary rule.** The backend serves `/metrics` on its own port 8080. The repository adds no ALB/Vercel/Fly route, but on the current single-machine Fly target the backend host is the API host; `observability.md` therefore states that exposure is a boundary rule and that `METRICS_ENABLED=false` is the kill switch. No behavior/infra source was changed by T5.
- **Two entry hashes are recorded.** The host `npm run build` entry is `assets/index-Bu2ZFvtA.js` (raw 90584 / gzip 28356). The `frontend-prod` image build sets the Dockerfile's `VITE_WS_URL` ARG at build time, so its served entry is `assets/index-3NFOIfzV.js` (raw 90650 / gzip 28382); the smoke test reads the served `bundle-report.json` dynamically and passed with that hash.
- **The smoke check is additive and self-contained.** It uses the existing `SmokeSocket`/`connectAndJoin`/`waitForMessage` helpers, targets `BACKEND_URL + '/metrics'` (default `http://backend:8080/metrics`), asserts exactly the AC-9 conditions, closes the client and waits the existing `SMOKE_SETTLE_MS`; every existing check/label/message is unchanged.
- **Compose pass-throughs only.** The diff is exactly the three documented variables with safe defaults; `compose.smoke.yaml`, both Dockerfiles, `infra/terraform`, `package.json`, `package-lock.json` and `.github/**` are unchanged.
- **Feature index not edited.** `docs/features/README.md` is orchestrator-owned; the proposed row is recorded below.

Evidence:

## Local gates

`npm run lint` → exit 0

```text
> lint
> eslint .
```

`npm run typecheck` → exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

`npm test` → exit 0 (backend 35 files / 1137 tests; frontend 72 files / 1902 tests)

```text
 Test Files  35 passed (35)
      Tests  1137 passed (1137)

 Test Files  72 passed (72)
      Tests  1902 passed (1902)
```

`npm run coverage` → exit 0 (thresholds 80/80/80/80 per workspace)

Backend coverage:

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.88 |    89.03 |   99.54 |   95.88 |
 src               |   97.56 |    90.42 |     100 |   97.56 |
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
 src/game          |   94.63 |    93.22 |   98.85 |   94.63 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   89.98 |    87.74 |   98.27 |   89.98 | ...1506,1636-1637
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   98.89 |    98.61 |   96.87 |   98.89 | 248-249,571-572
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/observability |   99.66 |     96.5 |     100 |   99.66 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.44 |    93.54 |     100 |   99.44 | 243-244
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57
-------------------|---------|----------|---------|---------|-------------------
```

Frontend coverage:

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.54 |    96.21 |   97.74 |   96.54 |
 src               |   87.93 |    85.08 |   95.45 |   87.93 |
  App.tsx          |    86.3 |     82.1 |   96.42 |    86.3 | ...33-435,457-458
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77
  config.ts        |     100 |      100 |     100 |     100 |
 src/auth          |   96.85 |     86.2 |   96.15 |   96.85 |
  api.ts           |   96.44 |     87.5 |     100 |   96.44 | ...61-162,170,222
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193
 src/game          |   96.34 |    99.38 |      99 |   96.34 |
  board.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |   99.47 |      100 |     100 |   99.47 | 958-959,1250-1251
  motion.ts        |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   90.83 |    98.78 |   97.29 |   90.83 | ...1545,1665-1666
  types.ts         |     100 |      100 |     100 |     100 |
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   93.48 |    96.66 |      96 |   93.48 |
  protocol.ts      |   89.36 |    96.16 |    90.9 |   89.36 | ...1111,1115-1125
  server-state.ts  |   98.19 |    95.09 |     100 |   98.19 | ...19,321-322,380
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
  scene.ts         |   97.26 |    99.39 |   95.34 |   97.26 | ...1076,1084-1085
  ship-motion.ts   |     100 |      100 |     100 |     100 |
  ...ship-model.ts |     100 |      100 |     100 |     100 |
  spaceship.ts     |   96.16 |      100 |   97.05 |   96.16 | ...63-664,690-693
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  targeting.ts     |   95.78 |      100 |     100 |   95.78 | ...64-166,178-179
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |   98.46 |       92 |     100 |   98.46 | 231-234,453
 src/ui            |   96.79 |    94.21 |    94.8 |   96.79 |
  AuthForms.tsx    |     100 |    99.07 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   91.66 |      87.5 |     100 |   91.66 | 60-61,66-67
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63
  Hud.tsx          |     100 |      100 |     100 |     100 |
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

`npm run build` → exit 0 (bundle budget output; host entry hash is the AC-26 recorded hash)

```text
entry index assets/index-Bu2ZFvtA.js raw=90584 gzip=28356
initial files=2 raw=312283 gzip=97312 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=987075 gzip=275342 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-CAub-nio.js raw=9537 gzip=3339 initial=false
chunk browser-env assets/browser-env-DlGieUPC.js raw=49189 gzip=18158 initial=false
chunk cursor-ship assets/cursor-ship-CBwqa_uz.js raw=6729 gzip=2210 initial=false
chunk index assets/index-Bu2ZFvtA.js raw=90584 gzip=28356 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
```

`podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` → exit 0

```text
entry index assets/index-3NFOIfzV.js raw=90650 gzip=28382
initial files=2 raw=312349 gzip=97341 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154326 budget=165000
total files=6 raw=987141 gzip=275373 budget=300000
...
[3/3] COMMIT docker.io/library/cubeclicker-frontend:prod-smoke
--> 4e3e894f0a3d
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
Successfully built 4e3e894f0a3d
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
```

Image id: `4e3e894f0a3d9e21b271eb256e9df3d7040feea7516b6cca84b0b058a0d6b9f3`. The served entry hash differs from the host build because the image's build stage sets `VITE_WS_URL` (Dockerfile ARG) while the host build does not; the smoke assertions are dynamic against the served `bundle-report.json`.

`npm run smoke` → exit 0 (22/22 checks, including the new joined-state metrics check)

```text
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
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1004ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=7 cubeclicker_ws_messages_received_total{type="join"}=5 cubeclicker_ws_frames_sent_total{type="hello"}=7
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-3NFOIfzV.js is served gzip with immutable caching — content-encoding gzip; 90650 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (22/22 checks)
```

## Endpoint and log evidence

`GET http://localhost:8080/metrics` after the smoke run, captured with Node's built-in `fetch` against the same loopback port (the documented `curl` equivalent) → `200`

```text
GET /metrics -> 200
content-type: "text/plain; version=0.0.4; charset=utf-8"
cache-control: "no-store"
body-bytes: 7992
ends-with-one-newline: true
```

Selected live samples from the same body (after the smoke run settled; the scrape during the joined check showed `connections_open=1`, `servers_active=1`):

```text
# TYPE cubeclicker_ws_connections_open gauge
cubeclicker_ws_connections_open 0
cubeclicker_ws_connections_total 7
cubeclicker_ws_messages_received_total{type="join"} 5
cubeclicker_ws_frames_sent_total{type="hello"} 7
cubeclicker_servers_active 0
```

Full endpoint body (141 lines; the `le` labels are renderer-generated and exempt from the catalog allow-list):

```text
# HELP cubeclicker_db_pool_idle Postgres pool idle connections at scrape.
# TYPE cubeclicker_db_pool_idle gauge
cubeclicker_db_pool_idle 0
# HELP cubeclicker_db_pool_total Postgres pool total connections at scrape.
# TYPE cubeclicker_db_pool_total gauge
cubeclicker_db_pool_total 0
# HELP cubeclicker_db_pool_waiting Postgres pool waiting requests at scrape.
# TYPE cubeclicker_db_pool_waiting gauge
cubeclicker_db_pool_waiting 0
# HELP cubeclicker_db_queries_total Runtime pool queries, by outcome.
# TYPE cubeclicker_db_queries_total counter
cubeclicker_db_queries_total{result="ok"} 17
# HELP cubeclicker_db_query_duration_seconds Runtime pool query duration in seconds.
# TYPE cubeclicker_db_query_duration_seconds histogram
cubeclicker_db_query_duration_seconds_bucket{le="0.001"} 7
cubeclicker_db_query_duration_seconds_bucket{le="0.005"} 14
cubeclicker_db_query_duration_seconds_bucket{le="0.01"} 16
cubeclicker_db_query_duration_seconds_bucket{le="0.025"} 17
cubeclicker_db_query_duration_seconds_bucket{le="0.05"} 17
cubeclicker_db_query_duration_seconds_bucket{le="0.1"} 17
cubeclicker_db_query_duration_seconds_bucket{le="0.25"} 17
cubeclicker_db_query_duration_seconds_bucket{le="0.5"} 17
cubeclicker_db_query_duration_seconds_bucket{le="1"} 17
cubeclicker_db_query_duration_seconds_bucket{le="2.5"} 17
cubeclicker_db_query_duration_seconds_bucket{le="5"} 17
cubeclicker_db_query_duration_seconds_bucket{le="+Inf"} 17
cubeclicker_db_query_duration_seconds_sum 0.04426253599999972
cubeclicker_db_query_duration_seconds_count 17
# HELP cubeclicker_economy_flushes_total Economy coalescer flushes.
# TYPE cubeclicker_economy_flushes_total counter
cubeclicker_economy_flushes_total 0
# HELP cubeclicker_economy_pending_accounts Accounts with a pending coalesced economy snapshot.
# TYPE cubeclicker_economy_pending_accounts gauge
cubeclicker_economy_pending_accounts 0
# HELP cubeclicker_economy_revision_rejections_total Economy snapshots rejected as stale.
# TYPE cubeclicker_economy_revision_rejections_total counter
cubeclicker_economy_revision_rejections_total 0
# HELP cubeclicker_members_active Joined members (including grace-window members).
# TYPE cubeclicker_members_active gauge
cubeclicker_members_active 0
# HELP cubeclicker_rate_limit_drops_total Dropped frames or requests, by limiter.
# TYPE cubeclicker_rate_limit_drops_total counter
# HELP cubeclicker_removal_batch_pending_groups Removal batcher groups waiting for the 40 ms window.
# TYPE cubeclicker_removal_batch_pending_groups gauge
cubeclicker_removal_batch_pending_groups 0
# HELP cubeclicker_removal_batch_size Ids per flushed player group.
# TYPE cubeclicker_removal_batch_size histogram
cubeclicker_removal_batch_size_bucket{le="1"} 1
cubeclicker_removal_batch_size_bucket{le="2"} 2
cubeclicker_removal_batch_size_bucket{le="5"} 2
cubeclicker_removal_batch_size_bucket{le="10"} 2
cubeclicker_removal_batch_size_bucket{le="20"} 2
cubeclicker_removal_batch_size_bucket{le="30"} 2
cubeclicker_removal_batch_size_bucket{le="+Inf"} 2
cubeclicker_removal_batch_size_sum 3
cubeclicker_removal_batch_size_count 2
# HELP cubeclicker_removal_flushes_total Removal flushes (timer or boundary).
# TYPE cubeclicker_removal_flushes_total counter
cubeclicker_removal_flushes_total 2
# HELP cubeclicker_removal_ids_total Mini-cube ids flushed.
# TYPE cubeclicker_removal_ids_total counter
cubeclicker_removal_ids_total 3
# HELP cubeclicker_server_capacity Configured members per server.
# TYPE cubeclicker_server_capacity gauge
cubeclicker_server_capacity 2
# HELP cubeclicker_servers_active Live servers.
# TYPE cubeclicker_servers_active gauge
cubeclicker_servers_active 0
# HELP cubeclicker_shutdown_total Graceful shutdowns initiated, by signal.
# TYPE cubeclicker_shutdown_total counter
# HELP cubeclicker_upgrade_revision_rejections_total Purchase/upgrade snapshots rejected as stale.
# TYPE cubeclicker_upgrade_revision_rejections_total counter
cubeclicker_upgrade_revision_rejections_total 0
# HELP cubeclicker_ws_broadcast_fanout Recipients per server broadcast.
# TYPE cubeclicker_ws_broadcast_fanout histogram
cubeclicker_ws_broadcast_fanout_bucket{le="1"} 10
cubeclicker_ws_broadcast_fanout_bucket{le="2"} 12
cubeclicker_ws_broadcast_fanout_bucket{le="5"} 12
cubeclicker_ws_broadcast_fanout_bucket{le="10"} 12
cubeclicker_ws_broadcast_fanout_bucket{le="25"} 12
cubeclicker_ws_broadcast_fanout_bucket{le="50"} 12
cubeclicker_ws_broadcast_fanout_bucket{le="100"} 12
cubeclicker_ws_broadcast_fanout_bucket{le="200"} 12
cubeclicker_ws_broadcast_fanout_bucket{le="+Inf"} 12
cubeclicker_ws_broadcast_fanout_sum 6
cubeclicker_ws_broadcast_fanout_count 12
# HELP cubeclicker_ws_broadcasts_total Server broadcasts (one encode per broadcast).
# TYPE cubeclicker_ws_broadcasts_total counter
cubeclicker_ws_broadcasts_total 12
# HELP cubeclicker_ws_connection_duration_seconds Connection lifetime in seconds.
# TYPE cubeclicker_ws_connection_duration_seconds histogram
cubeclicker_ws_connection_duration_seconds_bucket{le="1"} 5
cubeclicker_ws_connection_duration_seconds_bucket{le="5"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="15"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="30"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="60"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="120"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="300"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="600"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="1800"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="3600"} 7
cubeclicker_ws_connection_duration_seconds_bucket{le="+Inf"} 7
cubeclicker_ws_connection_duration_seconds_sum 2.594
cubeclicker_ws_connection_duration_seconds_count 7
# HELP cubeclicker_ws_connections_capacity Configured maximum concurrent connections.
# TYPE cubeclicker_ws_connections_capacity gauge
cubeclicker_ws_connections_capacity 200
# HELP cubeclicker_ws_connections_closed_total Connections closed, by reason.
# TYPE cubeclicker_ws_connections_closed_total counter
cubeclicker_ws_connections_closed_total{reason="client"} 7
# HELP cubeclicker_ws_connections_open Currently attached WebSocket connections.
# TYPE cubeclicker_ws_connections_open gauge
cubeclicker_ws_connections_open 0
# HELP cubeclicker_ws_connections_rejected_total Upgrade attempts rejected before a connection was created.
# TYPE cubeclicker_ws_connections_rejected_total counter
# HELP cubeclicker_ws_connections_total WebSocket connections attached since process start.
# TYPE cubeclicker_ws_connections_total counter
cubeclicker_ws_connections_total 7
# HELP cubeclicker_ws_frames_sent_total Successful per-recipient frame deliveries, by type.
# TYPE cubeclicker_ws_frames_sent_total counter
cubeclicker_ws_frames_sent_total{type="hello"} 7
cubeclicker_ws_frames_sent_total{type="memberJoined"} 1
cubeclicker_ws_frames_sent_total{type="memberLeft"} 1
cubeclicker_ws_frames_sent_total{type="miniCubeRemoved"} 2
cubeclicker_ws_frames_sent_total{type="miniCubesRemoved"} 2
cubeclicker_ws_frames_sent_total{type="welcome"} 5
# HELP cubeclicker_ws_heartbeat_timeouts_total Connections terminated for missing pongs.
# TYPE cubeclicker_ws_heartbeat_timeouts_total counter
cubeclicker_ws_heartbeat_timeouts_total 0
# HELP cubeclicker_ws_messages_encoded_total Server messages encoded once, by type.
# TYPE cubeclicker_ws_messages_encoded_total counter
cubeclicker_ws_messages_encoded_total{type="hello"} 7
cubeclicker_ws_messages_encoded_total{type="memberJoined"} 5
cubeclicker_ws_messages_encoded_total{type="memberLeft"} 5
cubeclicker_ws_messages_encoded_total{type="miniCubeRemoved"} 1
cubeclicker_ws_messages_encoded_total{type="miniCubesRemoved"} 1
cubeclicker_ws_messages_encoded_total{type="welcome"} 5
# HELP cubeclicker_ws_messages_received_total Client frames received, by decoded type.
# TYPE cubeclicker_ws_messages_received_total counter
cubeclicker_ws_messages_received_total{type="explode"} 3
cubeclicker_ws_messages_received_total{type="join"} 5
```

Log excerpt (`podman compose logs --no-color backend | grep -F '"level"' | tail -12`; JSON on stdout, request lines carry method/path/host only, lifecycle lines carry `connectionId`/`reason`/`durationMs`/`wasJoined`, and the metrics scrape is `req-c`/`req-e`):

```text
backend-1  | {"level":30,"time":1794760705419,"pid":32,"hostname":"6c11bbee5f65","reqId":"req-a","req":{"method":"GET","url":"/ws","host":"backend:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794760705420,"pid":32,"hostname":"6c11bbee5f65","connectionId":"req-a","msg":"ws_connection_opened"}
backend-1  | {"level":30,"time":1794760705421,"pid":32,"hostname":"6c11bbee5f65","connectionId":"req-a","reason":"client","durationMs":1,"wasJoined":true,"msg":"ws_connection_closed"}
backend-1  | {"level":30,"time":1794760706926,"pid":32,"hostname":"6c11bbee5f65","reqId":"req-b","req":{"method":"GET","url":"/ws","host":"backend:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794760706927,"pid":32,"hostname":"6c11bbee5f65","connectionId":"req-b","msg":"ws_connection_opened"}
backend-1  | {"level":30,"time":1794760706934,"pid":32,"hostname":"6c11bbee5f65","reqId":"req-c","req":{"method":"GET","url":"/metrics","host":"backend:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794760706936,"pid":32,"hostname":"6c11bbee5f65","reqId":"req-c","res":{"statusCode":200},"responseTime":1.7039260000001377,"msg":"request completed"}
backend-1  | {"level":30,"time":1794760706940,"pid":32,"hostname":"6c11bbee5f65","connectionId":"req-b","reason":"client","durationMs":13,"wasJoined":true,"msg":"ws_connection_closed"}
backend-1  | {"level":30,"time":1794760711770,"pid":32,"hostname":"6c11bbee5f65","reqId":"req-d","req":{"method":"GET","url":"/healthz","host":"127.0.0.1:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794760711770,"pid":32,"hostname":"6c11bbee5f65","reqId":"req-d","res":{"statusCode":200},"responseTime":0.21092200000020966,"msg":"request completed"}
backend-1  | {"level":30,"time":1794760714934,"pid":32,"hostname":"6c11bbee5f65","reqId":"req-e","req":{"method":"GET","url":"/metrics","host":"localhost:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794760714934,"pid":32,"hostname":"6c11bbee5f65","reqId":"req-e","res":{"statusCode":200},"responseTime":0.48331300000063493,"msg":"request completed"}
```

## Static verification (T5 verify greps and diff gates)

```text
test -f docs/architecture/observability.md                                        → exit 0
for h in "Structured logging" "Metrics catalog" "Exposure and retention" \
  "Frontend performance overlay" "Verification"; do grep -qx "## $h" …; done      → exits 0 for all five
grep -F 'podman compose logs backend' README.md                                   → match
grep -F 'curl http://localhost:8080/metrics' README.md                            → match
grep -F 'VITE_PERF_OVERLAY' README.md                                             → match
grep -F 'LOG_LEVEL' README.md                                                     → match
grep -F 'METRICS_ENABLED' README.md                                               → match
grep -F 'VITE_PERF_OVERLAY' compose.yaml                                          → match
grep -F 'LOG_LEVEL' compose.yaml                                                  → match
grep -F 'METRICS_ENABLED' compose.yaml                                            → match
grep -F 'not routed' docs/architecture/deployment.md                              → match
! grep -R -F '"/metrics"' infra/terraform                                         → no match (exit 1, negated to 0)
test -z "$(git status --porcelain -- docs/features/README.md)"                    → exit 0 (empty)
test -n "$(grep -oE '"file": ?"assets/index-[^"]*"' src/frontend/dist/bundle-report.json | head -n 1)" → exit 0 (`"file": "assets/index-Bu2ZFvtA.js"`)
git diff --exit-code -- compose.smoke.yaml src/backend/Dockerfile \
  src/frontend/Dockerfile infra/terraform package.json package-lock.json          → exit 0 (no output)
```

Catalog/documentation cross-check: the 30 metric names in `docs/architecture/observability.md` are identical to the 30 keys in `src/backend/src/observability/metrics.ts` (`diff` empty; 30/30). Relative-link check: 7 relative links in `observability.md`, 0 broken.

`git diff -- compose.yaml` (the only compose change; three environment pass-throughs):

```diff
@@ -48,6 +48,8 @@ services:
       - "127.0.0.1:${BACKEND_PORT:-8080}:8080"
     environment:
       NODE_ENV: development
+      LOG_LEVEL: "${LOG_LEVEL:-debug}"
+      METRICS_ENABLED: "${METRICS_ENABLED:-true}"
       MAX_USERS_PER_SERVER: "${MAX_USERS_PER_SERVER:-10}"
       DATABASE_URL: "${DATABASE_URL:-postgres://cubeclicker:cubeclicker@db:5432/cubeclicker}"
       SMTP_HOST: "${SMTP_HOST:-mailpit}"
@@ -75,6 +77,7 @@ services:
     environment:
       NODE_ENV: development
       VITE_WS_URL: "${VITE_WS_URL:-ws://localhost:8080/ws}"
+      VITE_PERF_OVERLAY: "${VITE_PERF_OVERLAY:-false}"
     volumes:
       - "./src/frontend:/app/src/frontend:z"
```

Staged/commit stat (`git diff --cached --stat` before the commit; identical to `git show --stat` afterward):

```text
 README.md                                          |  29 ++
 compose.yaml                                       |   3 +
 docs/architecture/deployment.md                    |   3 +-
 docs/architecture/observability.md                 | 139 ++++++
 .../features/runtime-observability/build-log-T5.md | 526 +++++++++++++++++++++
 docs/features/runtime-observability/status.md      |  17 +-
 tests/e2e/smoke.mjs                                | 106 ++++-
 7 files changed, 809 insertions(+), 14 deletions(-)
```

## Proposed feature index row (for the orchestrator; `docs/features/README.md` not edited)

```text
| runtime-observability | Runtime Observability (structured logs, internal Prometheus metrics, DB latency, dev-only perf overlay) | planning | 2026-11-15 |
```

## Acceptance audit

- **AC-9 — Containerized endpoint proof while joined** → met. `npm run smoke` (after `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod`) passes 22/22, and the new line is `PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=7 cubeclicker_ws_messages_received_total{type="join"}=5 cubeclicker_ws_frames_sent_total{type="hello"}=7`. `checkMetrics` asserts `200`, the exact Prometheus content type, the `# TYPE cubeclicker_ws_connections_open gauge` line, the two gauges `>= 1` and the three cumulative counters `>= 3`; it closes the client and waits `SMOKE_SETTLE_MS`. All existing checks/labels/messages are unchanged.
- **AC-24 — No production UI or bundle regression (docs/compose half)** → met. `README.md` contains the exact command `VITE_PERF_OVERLAY=true podman compose up` and the configuration rows; `grep -F 'VITE_PERF_OVERLAY' compose.yaml` shows the frontend pass-through with default `false`; the production `frontend-prod` build has no overlay flag. The frontend half (flag off, no polling, bundle budget) was met by T4; the T5 host/container builds stay within 150000/165000/300000 B gzip.
- **AC-25 — Observability documentation** → met. `docs/architecture/observability.md` exists with exactly `## Structured logging`, `## Metrics catalog`, `## Exposure and retention`, `## Frontend performance overlay` and `## Verification` (grep-verified); it documents the log levels/events/fields/redaction/serializers/no-body rule, all 30 metrics with type/labels/meaning and the reserved `le`, the internal-only `GET /metrics`/`METRICS_ENABLED`/no-new-port rule, localhost/compose access, the CloudWatch `awslogs` 30-day-retention historical path and the current Fly stdout path, the per-process reset, the `VITE_PERF_OVERLAY` overlay/250 ms/1000 ms polls/`ping`-`pong` RTT/no-production-UI rule, and the verification commands/smoke assertions. The seven relative links resolve; `README.md` has the `## Operations` commands and configuration rows; `docs/architecture/deployment.md` contains the "not routed" sentence; `docs/features/README.md` is untouched (`git status --porcelain` empty).
- **AC-26 — Quality gates** → met. `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (both workspaces ≥ 80 on all four metrics), `npm run build`, the `frontend-prod` rebuild and `npm run smoke` all exit 0. `compose.yaml` has exactly the three environment pass-throughs; `compose.smoke.yaml`, both Dockerfiles, `package.json`, `package-lock.json`, `.github/**` and `infra/terraform/**` are unchanged (diff exit 0). No new dependency.

## Assertion bar

- The only production test-content change is the e2e smoke check; it uses exact strings, exact numbers and `>=` minimums pinned by AC-9, with no wildcard matchers, snapshots or assertion-free checks.
- No existing smoke check or label was weakened; the metrics check is additive and self-contained.

Deviations from spec:
- **Deployment-doc context update.** `docs/architecture/deployment.md` is now Vercel + Fly + Neon; the required routing sentence keeps the approved "ALB does not route `/metrics`" rule but names it as historical and says the current target adds no public route. The supersession-ledger row was updated from "paused, assumptions stale" to "resumed on this target" so the doc does not contradict the shipped feature. No behavior or infra change.
- **Internal-only boundary note.** Because the current Fly target exposes the backend host itself, `observability.md` documents `/metrics` as internal-only by policy/network boundary and names `METRICS_ENABLED=false` as the kill switch; it does not claim the Fly host is path-filtered. This is a documentation caveat, not a change to the approved exposure decision.
- No other deviation: no `.env*`, `docs/features/README.md`, Dockerfile, `compose.smoke.yaml`, Terraform, workflow, package/lockfile or out-of-scope source edit; no push.
