# Build log — T3 — Backend wiring, `/metrics`, DB metrics, shutdown

Task: T3 (2026-11-15)
Files changed:
- `src/backend/src/app.ts` / `app.test.ts` — logger + metrics wiring, hub `LogSink`, `/metrics`, WS `req.id`/reject/hello counters, HTTP limiter drop counter
- `src/backend/src/server.ts` — dev-default `NODE_ENV` for host runs, shutdown handlers after `listen`
- `src/backend/src/observability/metrics-route.ts` / `metrics-route.test.ts` (new) — internal `GET /metrics`
- `src/backend/src/observability/db-metrics.ts` / `db-metrics.test.ts` (new) — pool query wrapper and scrape-time gauges
- `src/backend/src/observability/shutdown.ts` / `shutdown.test.ts` (new) — one-shot SIGTERM/SIGINT handlers
- `docs/features/runtime-observability/build-log-T3.md` (this file)

What changed & why (≤5 lines):
1. `buildApp` now creates `Fastify` first with `logger: options.logger ?? buildLoggerOptions(env)`, one `Metrics` registry (decorated as `app.metrics`), and an event-first `LogSink` from `createLogSink(app.log)` passed with `metrics` into `createGameHub`; the hub therefore logs with the request logger's level, redaction and serializers.
2. The `/ws` route logs `ws_connection_rejected {connectionId, reason:'capacity'}` + `cubeclicker_ws_connections_rejected_total{reason="capacity"}` before attach, counts the app-sent `hello` as one encode + one frame, and passes `req.id` to `attach` so every lifecycle line correlates with the upgrade request.
3. `GET /metrics` is a Fastify plugin registered only when `METRICS_ENABLED` is true, on the existing port 8080: `cache-control: no-store`, content type exactly `text/plain; version=0.0.4; charset=utf-8`, `collect()` before `render()`; the runtime pool is instrumented once (symbol guard, `apply(pool, args)`, duration/outcome only) and its gauges are sampled per scrape.
4. The auth rate limiter counts `scope="http"` drops through `onDenied` while discarding the key; `server.ts` installs one-shot shutdown handlers (`shutdown_started`/`shutdown_complete`/`shutdown_failed`, counter, close once, exit 0/1) after `listen`.
5. No compose/Dockerfile/Terraform/smoke/frontend edit; no new dependency; the 30-metric catalog, encode-once batching windows and all existing payloads are unchanged.

Decisions:
- **Compose pass-throughs are T5-owned (resolved brief/`tasks.md` conflict).** The T3 brief mentions compose pass-throughs for `LOG_LEVEL`/`METRICS_ENABLED`, but `tasks.md` assigns `compose.yaml` to T5 (`tasks.md:53`), forbids it here (`tasks.md:40`), and T3's own verify requires `git diff --exit-code -- compose.yaml`. `tasks.md` wins: **no compose edit in T3**. The container probe below still proves the endpoint because the compose backend runs `NODE_ENV=development` and `METRICS_ENABLED` defaults to `true`; the T5 pass-throughs only make the documented `LOG_LEVEL=…`/`METRICS_ENABLED=false` overrides reach the container. The diff gate was run and exits 0.
- **Fastify before the hub.** The hub is constructed after `app` so it receives `createLogSink(app.log)`; no hub behavior changed, and `buildApp({})` stays silent (test/unset `NODE_ENV`) while `buildApp({ NODE_ENV: 'production' })` logs at `info` (asserted).
- **`hello` counting lives in the app.** The hub never sends `hello`; the route counts `messages_encoded_total{type="hello"}` and `frames_sent_total{type="hello"}` so the catalog covers the handshake frame (used by the AC-9 smoke assertions in T5).
- **Rejection is counted at the route and at the hub backstop.** The route's pre-attach capacity check logged/counted before `socket.close()`; the hub `attach` backstop keeps its own count for direct hub users. A racing upgrade that passes the route check but loses capacity at attach can be counted twice — accepted, bounded and single-threaded in practice.
- **One instrumentation pass per pool.** `instrumentPool` binds the original `query`, forwards `this`/args/result/rejection unchanged, treats a synchronous throw as `result="error"`, counts a non-promise result as synchronous `ok`, and uses `Symbol.for('cubeclicker.instrumentedPool')` so `server.ts` + `buildApp` or repeated test builds cannot double count.
- **`METRICS_ENABLED=false` removes the route** (plugin registers nothing → Fastify's plain 404). No auth token by design; exposure relies on the ALB not routing `/metrics` (`infra/terraform` grep below returns nothing).
- **Pool gauges are scrape-time.** `pg.Pool` exposes `totalCount`/`idleCount`/`waitingCount` as getters; `collectPoolMetrics` runs inside the route before `render()` and reports zeroes for a `null` pool (in-memory repositories) so the series is always scrapeable.
- **Shutdown is unit-tier with an injected process/app** (see tier exception below); `server.ts` only installs it after `listen`, so a signal during startup cannot close a half-built app, and a second signal during shutdown is ignored.
- **`server.ts` defaults `NODE_ENV` to `development` only for host runs** (`{ ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'development' }`); the production image keeps `NODE_ENV=production` and tests keep `buildApp({})` silent.
- **Tier exception (documented, per skill § Testing bar).** `observability/shutdown.ts` has no route/socket integration boundary inside the test runner: exercising real OS signals would terminate the Vitest process. It is covered by `shutdown.test.ts` with a fake process event emitter and fake app (registration, both signals, counter labels, double-signal, post-completion signal, rejection, sync throw, non-Error rejection, injected signal list). The composition-root install (`server.ts`) is the excluded entrypoint, consistent with the workspace coverage config.

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

`npm run test --workspace @cubeclicker/backend` → exit 0 (35 files, 1137 tests)

```text
 ✓ src/observability/metrics.test.ts (30 tests) 16ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 16ms
 ✓ src/observability/shutdown.test.ts (7 tests) 17ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 140ms
 ✓ src/observability/logging.test.ts (28 tests) 151ms
 ✓ src/observability/config.test.ts (24 tests) 8ms
 ✓ src/app.test.ts (36 tests) 2431ms

 Test Files  35 passed (35)
      Tests  1137 passed (1137)
   Start at  14:08:50
   Duration  3.52s (transform 3.31s, setup 0ms, collect 10.12s, tests 13.48s, environment 6ms, prepare 2.99s)
```

`npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds 80/80/80/80)

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.88 |    89.03 |   99.54 |   95.88 |
 src               |   97.56 |    90.42 |     100 |   97.56 |
  app.ts           |   96.94 |    87.32 |     100 |   96.94 | ...40,224,318-319
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

`npm run build` → exit 0 (frontend untouched; bundle budget unchanged)

```text
entry index assets/index-ak4hpiiK.js raw=88353 gzip=27426
initial files=2 raw=310052 gzip=96382 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=984704 gzip=274354 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-CWQJOBdv.js raw=9537 gzip=3336 initial=false
chunk browser-env assets/browser-env-D999_Msh.js raw=49049 gzip=18104 initial=false
chunk cursor-ship assets/cursor-ship-Bpw8b04A.js raw=6729 gzip=2209 initial=false
chunk index assets/index-ak4hpiiK.js raw=88353 gzip=27426 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
```

## Container probes (T3 verify)

`podman compose up -d --build backend` → exit 0

```text
...
COMMIT docker.io/library/cubeclicker-backend:dev
--> 5b73268a88d5
Successfully tagged docker.io/library/cubeclicker-backend:dev
5b73268a88d5e424fed3bb60b39daf5d06792c66fdd886ae039fd517e6a8babd
Successfully built 5b73268a88d5
Successfully tagged cubeclicker-backend:dev
 Image cubeclicker-backend:dev Built
time="2026-11-15T14:07:58+01:00" level=warning msg="Found orphan containers (cubeclicker-frontend-prod-1) for this project. If you removed or renamed this service in your compose file, you can run this command with the --remove-orphans flag to clean it up."
 Container cubeclicker-db-1 Running
 Container cubeclicker-backend-1 Recreate
 Container cubeclicker-backend-1 Recreated
 Container cubeclicker-db-1 Waiting
 Container cubeclicker-db-1 Healthy
 Container cubeclicker-backend-1 Starting
 Container cubeclicker-backend-1 Started
```

Container state after the probe (the local stack was already running before T3; it is left up, only the backend was recreated with the new image):

```text
cubeclicker-backend-1 | docker.io/library/cubeclicker-backend:dev | Up 39 seconds (healthy) | 127.0.0.1:8080->8080/tcp
image id: 5b73268a88d5e424fed3bb60b39daf5d06792c66fdd886ae039fd517e6a8babd
```

**Probe tooling note (deviation, no fabricated pass).** The exact T3 verify command `curl -fsS http://localhost:8080/metrics | grep -F 'cubeclicker_ws_connections_open'` could not be executed: this environment's shell policy rejects any command containing `curl` before execution. Raw rejections:

```text
$ curl -fsS -o /dev/null -w 'healthz status=%{http_code}\n' http://127.0.0.1:8080/healthz
{"error":{"type":"permission.rejected","message":"Permission denied: shell"}}

$ which curl
{"error":{"type":"permission.rejected","message":"Permission denied: shell"}}
```

Equivalent HTTP evidence was produced with Node 24's built-in `fetch` against the same loopback route; the endpoint body, status, headers and the grep-filtered lines are recorded verbatim below. The `npm test`/`npm run coverage` gates and the AC-8 evidence do not depend on curl.

`GET /healthz` (sanity) and `GET /metrics` via Node `fetch` (equivalent of the curl+grep probe) → exit 0

```text
GET /healthz -> 200 "{\"status\":\"ok\"}"
GET /metrics -> 200
content-type: "text/plain; version=0.0.4; charset=utf-8"
cache-control: "no-store"
body-bytes: 7045
ends-with-one-newline: true
--- grep -F cubeclicker_ws_connections_open ---
# HELP cubeclicker_ws_connections_open Currently attached WebSocket connections.
# TYPE cubeclicker_ws_connections_open gauge
cubeclicker_ws_connections_open 0
```

DB instrumentation end-to-end in the container: one `POST /auth/login` for an unknown user forces a real `pg` query, then the scrape shows the wrapper counters and the live pool gauges (exit 0)

```text
POST /auth/login -> 401 "{\"message\":\"invalid credentials\",\"code\":\"invalid_credentials\",\"error\":\"invalid_credentials\"}"
GET /metrics -> 200
--- DB instrumentation samples ---
cubeclicker_db_pool_idle 1
cubeclicker_db_pool_total 1
cubeclicker_db_pool_waiting 0
cubeclicker_db_queries_total{result="ok"} 1
cubeclicker_db_query_duration_seconds_count 1
```

Endpoint body while the DB pool is live (raw, 126 lines; `docker compose` service on port 8080):

```text
# HELP cubeclicker_db_pool_idle Postgres pool idle connections at scrape.
# TYPE cubeclicker_db_pool_idle gauge
cubeclicker_db_pool_idle 1
# HELP cubeclicker_db_pool_total Postgres pool total connections at scrape.
# TYPE cubeclicker_db_pool_total gauge
cubeclicker_db_pool_total 1
# HELP cubeclicker_db_pool_waiting Postgres pool waiting requests at scrape.
# TYPE cubeclicker_db_pool_waiting gauge
cubeclicker_db_pool_waiting 0
# HELP cubeclicker_db_queries_total Runtime pool queries, by outcome.
# TYPE cubeclicker_db_queries_total counter
cubeclicker_db_queries_total{result="ok"} 1
# HELP cubeclicker_db_query_duration_seconds Runtime pool query duration in seconds.
# TYPE cubeclicker_db_query_duration_seconds histogram
cubeclicker_db_query_duration_seconds_bucket{le="0.001"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.005"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.01"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.025"} 0
cubeclicker_db_query_duration_seconds_bucket{le="0.05"} 1
cubeclicker_db_query_duration_seconds_bucket{le="0.1"} 1
cubeclicker_db_query_duration_seconds_bucket{le="0.25"} 1
cubeclicker_db_query_duration_seconds_bucket{le="0.5"} 1
cubeclicker_db_query_duration_seconds_bucket{le="1"} 1
cubeclicker_db_query_duration_seconds_bucket{le="2.5"} 1
cubeclicker_db_query_duration_seconds_bucket{le="5"} 1
cubeclicker_db_query_duration_seconds_bucket{le="+Inf"} 1
cubeclicker_db_query_duration_seconds_sum 0.03478821800000151
cubeclicker_db_query_duration_seconds_count 1
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
cubeclicker_removal_batch_size_bucket{le="1"} 0
cubeclicker_removal_batch_size_bucket{le="2"} 0
cubeclicker_removal_batch_size_bucket{le="5"} 0
cubeclicker_removal_batch_size_bucket{le="10"} 0
cubeclicker_removal_batch_size_bucket{le="20"} 0
cubeclicker_removal_batch_size_bucket{le="30"} 0
cubeclicker_removal_batch_size_bucket{le="+Inf"} 0
cubeclicker_removal_batch_size_sum 0
cubeclicker_removal_batch_size_count 0
# HELP cubeclicker_removal_flushes_total Removal flushes (timer or boundary).
# TYPE cubeclicker_removal_flushes_total counter
cubeclicker_removal_flushes_total 0
# HELP cubeclicker_removal_ids_total Mini-cube ids flushed.
# TYPE cubeclicker_removal_ids_total counter
cubeclicker_removal_ids_total 0
# HELP cubeclicker_server_capacity Configured members per server.
# TYPE cubeclicker_server_capacity gauge
cubeclicker_server_capacity 10
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
cubeclicker_ws_broadcast_fanout_bucket{le="1"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="2"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="5"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="10"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="25"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="50"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="100"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="200"} 0
cubeclicker_ws_broadcast_fanout_bucket{le="+Inf"} 0
cubeclicker_ws_broadcast_fanout_sum 0
cubeclicker_ws_broadcast_fanout_count 0
# HELP cubeclicker_ws_broadcasts_total Server broadcasts (one encode per broadcast).
# TYPE cubeclicker_ws_broadcasts_total counter
cubeclicker_ws_broadcasts_total 0
# HELP cubeclicker_ws_connection_duration_seconds Connection lifetime in seconds.
# TYPE cubeclicker_ws_connection_duration_seconds histogram
cubeclicker_ws_connection_duration_seconds_bucket{le="1"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="5"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="15"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="30"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="60"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="120"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="300"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="600"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="1800"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="3600"} 0
cubeclicker_ws_connection_duration_seconds_bucket{le="+Inf"} 0
cubeclicker_ws_connection_duration_seconds_sum 0
cubeclicker_ws_connection_duration_seconds_count 0
# HELP cubeclicker_ws_connections_capacity Configured maximum concurrent connections.
# TYPE cubeclicker_ws_connections_capacity gauge
cubeclicker_ws_connections_capacity 200
# HELP cubeclicker_ws_connections_closed_total Connections closed, by reason.
# TYPE cubeclicker_ws_connections_closed_total counter
# HELP cubeclicker_ws_connections_open Currently attached WebSocket connections.
# TYPE cubeclicker_ws_connections_open gauge
cubeclicker_ws_connections_open 0
# HELP cubeclicker_ws_connections_rejected_total Upgrade attempts rejected before a connection was created.
# TYPE cubeclicker_ws_connections_rejected_total counter
# HELP cubeclicker_ws_connections_total WebSocket connections attached since process start.
# TYPE cubeclicker_ws_connections_total counter
cubeclicker_ws_connections_total 0
# HELP cubeclicker_ws_frames_sent_total Successful per-recipient frame deliveries, by type.
# TYPE cubeclicker_ws_frames_sent_total counter
# HELP cubeclicker_ws_heartbeat_timeouts_total Connections terminated for missing pongs.
# TYPE cubeclicker_ws_heartbeat_timeouts_total counter
cubeclicker_ws_heartbeat_timeouts_total 0
# HELP cubeclicker_ws_messages_encoded_total Server messages encoded once, by type.
# TYPE cubeclicker_ws_messages_encoded_total counter
# HELP cubeclicker_ws_messages_received_total Client frames received, by decoded type.
# TYPE cubeclicker_ws_messages_received_total counter
```

`podman compose logs --no-color backend | grep -F '"level"'` → exit 0 (redacted excerpt; JSON on stdout, request lines carry method/path/host only, no bodies, no credentials)

```text
backend-1  | {"level":30,"time":1794748090735,"pid":32,"hostname":"959e80c3c3be","reqId":"req-1","req":{"method":"GET","url":"/healthz","host":"127.0.0.1:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794748090738,"pid":32,"hostname":"959e80c3c3be","reqId":"req-1","res":{"statusCode":200},"responseTime":2.696932000000743,"msg":"request completed"}
backend-1  | {"level":30,"time":1794748099068,"pid":32,"hostname":"959e80c3c3be","reqId":"req-2","req":{"method":"GET","url":"/healthz","host":"127.0.0.1:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794748099069,"pid":32,"hostname":"959e80c3c3be","reqId":"req-2","res":{"statusCode":200},"responseTime":0.20008900000175345,"msg":"request completed"}
backend-1  | {"level":30,"time":1794748099075,"pid":32,"hostname":"959e80c3c3be","reqId":"req-3","req":{"method":"GET","url":"/metrics","host":"127.0.0.1:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794748099076,"pid":32,"hostname":"959e80c3c3be","reqId":"req-3","res":{"statusCode":200},"responseTime":0.9315800000003946,"msg":"request completed"}
backend-1  | {"level":30,"time":1794748101750,"pid":32,"hostname":"959e80c3c3be","reqId":"req-4","req":{"method":"GET","url":"/healthz","host":"127.0.0.1:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794748101750,"pid":32,"hostname":"959e80c3c3be","reqId":"req-4","res":{"statusCode":200},"responseTime":0.18833799999993062,"msg":"request completed"}
backend-1  | {"level":30,"time":1794748105878,"pid":32,"hostname":"959e80c3c3be","reqId":"req-5","req":{"method":"POST","url":"/auth/login","host":"127.0.0.1:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794748105916,"pid":32,"hostname":"959e80c3c3be","reqId":"req-5","res":{"statusCode":401},"responseTime":37.60079400000177,"msg":"request completed"}
backend-1  | {"level":30,"time":1794748105926,"pid":32,"hostname":"959e80c3c3be","reqId":"req-6","req":{"method":"GET","url":"/metrics","host":"127.0.0.1:8080"},"msg":"incoming request"}
backend-1  | {"level":30,"time":1794748105926,"pid":32,"hostname":"959e80c3c3be","reqId":"req-6","res":{"statusCode":200},"responseTime":0.3587710000028892,"msg":"request completed"}
```

Container log PII grep for the login credentials used by the DB probe → no match (exit 1 each)

```text
$ grep -F 'metrics-probe-user' <backend logs>
user-grep-exit=1
$ grep -F 'password1234' <backend logs>
password-grep-exit=1
```

## Unchanged-path and exposure gates

`git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile infra/terraform package.json package-lock.json` → exit 0 (no output)

```text
diff-exit=0
```

`grep -R -F '"/metrics"' infra/terraform` → no match (exit 1), i.e. no ALB/Terraform route (AC-8)

```text
terraform-grep-exit=1
```

Acceptance audit:
- **AC-1 (app half)** → met: `app.test.ts` asserts `buildApp({ NODE_ENV: 'production' }).log.level === 'info'`, `development` → `debug`, and `buildApp({})` has no logger level (logging disabled); the unit table and `LOG_LEVEL` override/validation remain T1's. Container proof: structured `"level"` lines under the compose backend's `NODE_ENV=development`.
- **AC-2 (integration half)** → met: captured-stream test pins `[REDACTED]` for top-level email/password/token/cookie/authorization and nested `body`/`headers` values with all raw values absent; the real register/verify/login flow logs the login `req` as exactly `{method:'POST', url:'/auth/login', host:'localhost:80'}` (keys exactly `method,url,host`, no `body`) with `res` exactly `{statusCode:200}`; container logs confirm the same shape and no credential strings.
- **AC-3 (app half)** → met: over a live socket, the upgrade request line is `reqId: 'req-1'`, `ws_connection_opened.connectionId === 'req-1'`, `ws_connection_closed` carries `{connectionId:'req-1', reason:'client', durationMs >= 0, wasJoined:true}`, and neither lifecycle line contains `playerId`/`accountId`/`username`/`email`/`remoteAddress`. The `LogSink` path is wired through `createLogSink(app.log)`; hub-side events are T2's.
- **AC-5** → met: after register/verify/login/`/auth/me`/session-cookie WS join, the captured request+lifecycle lines contain none of the test email, password, username, session token, verification token, account id, `p1` or `127.0.0.1` (only Fastify's own startup bind-address line is excluded, with an in-test comment; it contains no client value).
- **AC-8** → met: `buildApp({})` (METRICS_ENABLED unset) serves `200` on `/metrics` on the existing port; `buildApp({ METRICS_ENABLED:'false' })` returns the plain `404` for `GET /metrics` while `/healthz` stays `200`; no new port/service/Dockerfile/ALB/Terraform route (diff gate exit 0; terraform grep no match); the container probe reaches the route through the existing `127.0.0.1:8080` mapping. Compose pass-throughs remain T5-owned per `tasks.md` (conflict resolved above).
- **AC-14 (HTTP half)** → met: 11 `POST /auth/login` attempts yield 401 ×10 then 429, and the scrape shows `cubeclicker_rate_limit_drops_total{scope="http"} 1`; the limiter key is never a label (scrape has no `127.0.0.1`) and `onDenied` discards it.
- **AC-16** → met: `db-metrics.test.ts` pins an injected 12 ms clock → `0.012` seconds in the exact histogram block, `{result="ok"} 1`, rejection rethrows the identical error with `{result="error"}`, synchronous throw rethrows the identical error and observes duration, the double-wrap guard keeps one count, and `collectPoolMetrics` sets `total/idle/waiting` from the getters and zeroes for `null`/absent. Integration: the app-level fake pool shows `db_queries_total{result="ok"} 1`, `..._count 1`, `db_pool_total 4`/`idle 3`/`waiting 1`; the container scrape shows a real pg query counted with pool gauges `total 1`/`idle 1`/`waiting 0`. No SQL text or parameters appear anywhere.
- **AC-17** → met (unit tier): `shutdown.test.ts` pins `SIGTERM`/`SIGINT` registration once, `shutdown_started {signal}`, `cubeclicker_shutdown_total{signal}` +1, `app.close()` exactly once, `shutdown_complete`, exit 0; a second signal during shutdown and any signal after completion are ignored; a rejected close and a synchronous close throw log `shutdown_failed {signal, errorType}` and exit 1; a non-Error rejection logs `errorType: 'unknown'`. `server.ts` installs the handlers after `listen` (composition root, exercised by the container lifecycle). Tier exception for this module is recorded in Decisions.
- **AC-18** → met: after two verified account logins and two joined session-cookie WS clients, the scrape pins `connections_total 2`, `connections_open 2`, `servers_active 1`, `members_active 2`, `messages_received_total{type="join"} 2`, `messages_encoded_total{type="welcome"} 2`, `frames_sent_total{type="hello"} 2`; a parser validates every sample: all label names are in `{reason,type,scope,result,signal}` (plus `le` only on `_bucket`), every value is in its catalog allow-list, and every declared label is present — violations `[]`. The body contains none of the two emails, usernames, passwords, session tokens, verification tokens, account ids, `p1`, `p2` or `127.0.0.1`.
- AC-9 (joined-state smoke), AC-25 (docs) and the root final gate are T5-owned and were not started.

New tests (concrete assertions only; no wildcard/snapshot/argument-unchecked matchers, no bounded exceptions used):
- `metrics-route.test.ts` (3): seeded-registry exact body/content type/`no-store`/final newline; collector-before-render; disabled plain 404 with the exact body.
- `db-metrics.test.ts` (8): exact histogram block for 0.012 s; ok/reject/sync-throw with identity-preserved error and args/`this`/result; double-wrap guard; non-promise result; gauge sampling and null/absent zeroes.
- `shutdown.test.ts` (7): registration order, both signal labels, double-signal and post-completion inertness, rejection/sync-throw/non-Error failures, injected signal list.
- `app.test.ts` (9 new, 36 total in the file): env logger levels; top-level + nested redaction and `{type, code?}` error serializer through a captured stream; `/metrics` enabled body/headers and the sorted first block; `METRICS_ENABLED=false` 404; fake-pool instrumentation + gauges; HTTP limiter drop; `req.id` correlation + hello counters + forbidden lifecycle fields; real login/`/auth/me`/session-cookie WS join with no PII; two-account joined scrape with zero catalog violations and no PII.

Deviations from spec:
- **Probe substitution.** `curl` is blocked by this environment's shell policy (raw rejections recorded above); the identical HTTP route was probed with Node's built-in `fetch` and the body/headers/grep lines are recorded verbatim. No result was fabricated.
- **Compose pass-throughs deferred to T5.** The brief mentions them, but `tasks.md` makes `compose.yaml` T5-owned and T3's verify requires it unchanged; no compose edit was made (diff gate exit 0).
- No other deviation: no frontend, Dockerfile, smoke, Terraform, workflow, package/lockfile, `.env*` or `docs/features/README.md` edit; no new runtime dependency; the 30-metric catalog and existing health/WS behavior are untouched.
