# Runtime Observability

CubeClicker exposes runtime observability without adding infrastructure: Fastify/Pino structured JSON logs with strict redaction and request/connection correlation; a fixed, low-cardinality in-process Prometheus metrics registry; a `GET /metrics` route on the backend's existing port `8080` that is disabled by default in the deployed Render environment and enabled on the local compose loopback; Postgres pool/query instrumentation; graceful-shutdown accounting; and a dev-only frontend performance overlay behind `VITE_PERF_OVERLAY`. There is no Prometheus, Grafana, Loki, OpenTelemetry or external SaaS, no new service or listen port, and no historical metric store: every metric is a per-process aggregate that resets on restart.

The application stack is decided in [stack](stack.md), the delivery path in [containerization](containerization.md), the deployment target in [deployment](deployment.md), the outbound WebSocket path in [realtime](realtime.md), and the full contract with acceptance criteria in the [runtime-observability feature spec](../features/runtime-observability/spec.md).

## Structured logging

Fastify is configured with its built-in Pino logger and writes one JSON object per line to stdout; there is no pretty-printing transport. `LOG_LEVEL` overrides the `NODE_ENV` default and accepts exactly `fatal|error|warn|info|debug|trace|silent`; an invalid value fails startup with an error naming `LOG_LEVEL`.

| Environment | Default level |
| --- | --- |
| `NODE_ENV=production` | `info` |
| `NODE_ENV=development` | `debug` |
| `NODE_ENV=test` | disabled unless `LOG_LEVEL` is set |
| unset `NODE_ENV` | disabled unless `LOG_LEVEL` is set |

The event and field contract is fixed. Log lines never contain request/response bodies, query strings, cookies, authorization headers, passwords, emails, verification/session tokens, SQL text, remote IPs, player ids, account ids or usernames.

| Event / log | Fields | Level |
| --- | --- | --- |
| Fastify request/response | `reqId`, `req.method`, `req.url` (path only, query stripped), `req.host`, `res.statusCode`, `responseTime` | info |
| `ws_connection_opened` | `connectionId` | info |
| `ws_connection_closed` | `connectionId`, `reason` (`client`/`heartbeat`/`error`/`server`), `durationMs`, `wasJoined` | info |
| `ws_heartbeat_timeout` | `connectionId`, `wasJoined` | warn |
| `ws_connection_rejected` | `connectionId`, `reason: 'capacity'` | warn |
| `hub_closed` | `connections`, `members`, `servers` | info |
| `shutdown_started` / `shutdown_complete` | `signal` | info |
| `shutdown_failed` | `signal`, `errorType` | error |
| Error object (`err`) | `type`, optional string `code` only | error |

- **Correlation.** The `/ws` upgrade passes the Fastify request id to the hub as `connectionId`, so `ws_connection_opened` and `ws_connection_closed` correlate with the matching HTTP upgrade request log.
- **Redaction.** Pino redacts the top-level `email`, `password`, `pass`, `token`, `sessionToken`, `verificationToken`, `cookie` and `authorization` paths; the request/response paths `req.headers.cookie`, `req.headers.authorization`, `req.headers['x-api-key']`, `res.headers['set-cookie']`, `req.body.email`, `req.body.password`, `req.body.pass`, `req.body.token`, `req.body.sessionToken` and `req.body.verificationToken`; and the wildcard forms `*.email`, `*.password`, `*.pass`, `*.token`, `*.sessionToken`, `*.verificationToken`, `*.cookie` and `*.authorization`. Every redacted value is replaced with `[REDACTED]`.
- **No bodies or headers.** Custom serializers reduce a request to `{ method, url, host }` (query string stripped), a response to `{ statusCode }`, and an error to `{ type, code? }` (`code` only when it is a string). Bodies, headers, IPs, messages and stacks never reach a log line.
- **Adapter.** The hub, shutdown and database-lifecycle code log through the event-first `LogSink` (`debug(event, fields)`, `info(event, fields)`, `warn(event, fields)`, `error(event, fields)`); `createLogSink` calls Pino object-first (`logger.debug(fields, event)`, `logger.info(fields, event)`, …), so the structured fields are emitted instead of dropped. `LogSink.debug` is the additive fourth method: the existing `info`/`warn`/`error` mapping, redaction paths, serializers, levels and event names are unchanged, and debug rows appear only when the configured level is `debug` (the development default, or `LOG_LEVEL=debug`).
- **Local access.** `podman compose logs backend` reads the JSON lines from the backend container; on the current Render target the same stdout stream is read from the Render dashboard (service → Logs) or with the Render CLI (`render logs -r srv-dbtcvv9srm7s73au5bag`). The superseded AWS target used the ECS `awslogs` driver into CloudWatch with 30-day retention (see [Exposure and retention](#exposure-and-retention)).

## Database lifecycle events

The startup schema bootstrap and the in-process expired-verification cleanup log through the same `LogSink` and Fastify/Pino instance as the rest of the backend: the startup phase runs after the app is built and before `listen`, and cleanup starts after `listen`. Per-table presence checks, lock waits, up-to-date migrations and zero-delete runs are `debug` (visible only at `LOG_LEVEL=debug`); creations, drift warnings, summaries and failures are visible at the production `info` default.

| Event | Fields | Level |
| --- | --- | --- |
| `db_startup_lock_wait` | `waitedMs` | debug |
| `db_startup_lock_acquired` | `waitedMs` | debug |
| `db_migrations_applied` | `count` | info |
| `db_migrations_up_to_date` | — | debug |
| `db_schema_bootstrap_started` | `tables` | info |
| `db_schema_table_present` | `table` | debug |
| `db_schema_table_created` | `table` | info |
| `db_schema_table_outdated` | `table`, `missingColumns` (comma-joined in the normative DDL column order, not alphabetical) | warn |
| `db_schema_bootstrap_completed` | `checked`, `created`, `outdated`, `durationMs` | info |
| `db_schema_bootstrap_skipped` | `reason`: `no_database` (debug) or `disabled` (info) | debug / info |
| `db_schema_bootstrap_failed` | `table`, `errorType`, optional string `code` | error |
| `db_startup_completed` | `migrated`, `created`, `outdated`, `durationMs` | info |
| `db_startup_failed` | `stage` (`connect`/`lock`/`migrations`/`bootstrap`), `errorType`, optional string `code` | error |
| `db_verification_cleanup_started` | `intervalMs` | info |
| `db_verification_cleanup_skipped` | `reason`: `no_database` (debug), `disabled` (info) or `in_flight` (debug) | debug / info |
| `db_verification_cleanup_run` | `deleted`, `durationMs` | info when `deleted > 0`, debug when `0` |
| `db_verification_cleanup_failed` | `errorType`, optional string `code` | error |
| `db_verification_cleanup_stopped` | — | info |

- **Error fields only.** Failure events carry `errorType` (the error's `name`, or `unknown`) and an optional string SQLSTATE-style `code`; the error message, stack, `detail` and `hint` are never copied into a field, because PostgreSQL can put SQL text or row data there.
- **No SQL, rows or secrets.** The events carry schema metadata (`table`, `missingColumns`), aggregate counts (`tables`, `checked`, `created`, `outdated`, `migrated`, `deleted`), durations, constants (`reason`, `stage`) and the error fields above. No connection string, SQL text, query parameter, email, username, account id, token/hash, cookie, authorization value, error message or stack is logged.
- **No new metric.** This feature adds no metric series and the fixed catalog below stays at exactly 30 metrics: no `cubeclicker_db_bootstrap*` or `cubeclicker_db_cleanup*` series exists, and `/metrics` continues to serve only the catalog entries listed in § Metrics catalog.
- **Visibility.** `db_schema_bootstrap_skipped { reason: 'no_database' }` and `db_verification_cleanup_skipped { reason: 'no_database' }` are debug lines for host-only runs without a database; the `disabled` variants are info lines because an operator turned a service off explicitly.

## Metrics catalog

The registry defines exactly the 30 metrics below. The object key is the metric name and each definition carries its type, help text, label names and **allowed values per label**. `inc`/`set`/`observe` throw for an unknown metric, an undeclared label, a missing declared label or a label value outside its allow-list, so user-controlled strings can never become a Prometheus series. There is no catalog label named `playerId`, `userId`, `accountId`, `email`, `token`, `ip`, `remoteAddress` or `serverId`.

All names are prefixed `cubeclicker_`. Catalog-declared label names are only `reason`, `type`, `scope`, `result` and `signal`. Histogram `_bucket` samples additionally carry the renderer-reserved `le` label, whose bucket bounds are generated from the definition and are exempt from the catalog allow-list. The renderer sorts metric names and label names, escapes label values (backslash, double quote and newline), renders cumulative `_bucket`/`_sum`/`_count` samples with a `+Inf` bucket, and ends the body with exactly one newline.

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `cubeclicker_ws_connections_open` | gauge | — | Currently attached WebSocket connections. |
| `cubeclicker_ws_connections_capacity` | gauge | — | Configured maximum concurrent connections (`config.maxConnections`, 200). |
| `cubeclicker_ws_connections_total` | counter | — | WebSocket connections attached since process start. |
| `cubeclicker_ws_connections_closed_total` | counter | `reason`: `client` `heartbeat` `error` `server` | Connections closed, by reason. |
| `cubeclicker_ws_connections_rejected_total` | counter | `reason`: `capacity` | Upgrade attempts rejected before a connection was created. |
| `cubeclicker_ws_heartbeat_timeouts_total` | counter | — | Connections terminated for missing pongs. |
| `cubeclicker_ws_messages_received_total` | counter | `type`: `join`, `rejoin`, `explode`, `cubeCompleted`, `rotate`, `purchaseUpgrade`, `openLootbox`, `equipPart`, `unequipPart`, `setAppearance`, `ping`, `leave`, `invalid`, `oversized` | Client frames received, by decoded type (or invalid/oversized). |
| `cubeclicker_ws_messages_encoded_total` | counter | `type`: `hello`, `welcome`, `worldEntered`, `memberJoined`, `memberLeft`, `cubeRotated`, `memberAppearance`, `miniCubeRemoved`, `miniCubesRemoved`, `levelAdvanced`, `stateSync`, `economyUpdate`, `upgradesUpdate`, `customizationUpdate`, `lootboxOpened`, `activityEvent`, `leaderboardUpdate`, `error`, `pong` | Server messages encoded once, by type. |
| `cubeclicker_ws_frames_sent_total` | counter | same as encoded | Successful per-recipient frame deliveries. |
| `cubeclicker_ws_broadcasts_total` | counter | — | Server broadcasts (one encode per broadcast). |
| `cubeclicker_ws_broadcast_fanout` | histogram | — | Recipients per server broadcast; buckets `1,2,5,10,25,50,100,200`. |
| `cubeclicker_ws_connection_duration_seconds` | histogram | — | Connection lifetime; buckets `1,5,15,30,60,120,300,600,1800,3600`. |
| `cubeclicker_servers_active` | gauge | — | Live servers/rooms. |
| `cubeclicker_members_active` | gauge | — | Joined members. An explicit leave drops the member immediately; an abrupt close keeps the grace-window member counted until expiry. |
| `cubeclicker_server_capacity` | gauge | — | Configured members per server (`config.maxUsersPerServer`). |
| `cubeclicker_removal_batch_pending_groups` | gauge | — | Removal batcher groups waiting for the 40 ms window. |
| `cubeclicker_removal_flushes_total` | counter | — | Removal flushes (timer or boundary). |
| `cubeclicker_removal_ids_total` | counter | — | Mini-cube ids flushed. |
| `cubeclicker_removal_batch_size` | histogram | — | Ids per flushed player group; buckets `1,2,5,10,20,30`. |
| `cubeclicker_economy_pending_accounts` | gauge | — | Accounts with a pending coalesced economy snapshot. |
| `cubeclicker_economy_flushes_total` | counter | — | Economy coalescer flushes. |
| `cubeclicker_rate_limit_drops_total` | counter | `scope`: `explode`, `rotate`, `ping`, `http` | Dropped frames or requests, by limiter. |
| `cubeclicker_economy_revision_rejections_total` | counter | — | Economy snapshots rejected as stale. |
| `cubeclicker_upgrade_revision_rejections_total` | counter | — | Purchase/upgrade snapshots rejected as stale. |
| `cubeclicker_db_pool_total` | gauge | — | Postgres pool total connections at scrape. |
| `cubeclicker_db_pool_idle` | gauge | — | Postgres pool idle connections at scrape. |
| `cubeclicker_db_pool_waiting` | gauge | — | Postgres pool waiting requests at scrape. |
| `cubeclicker_db_queries_total` | counter | `result`: `ok`, `error` | Runtime pool queries, by outcome. |
| `cubeclicker_db_query_duration_seconds` | histogram | — | Runtime pool query duration; buckets `0.001,0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5`. |
| `cubeclicker_shutdown_total` | counter | `signal`: `SIGTERM`, `SIGINT` | Graceful shutdowns initiated. |

The received `type` allow-list includes `leave`; `cubeclicker_ws_messages_received_total{type="leave"}` increments once per accepted client frame. An explicit leave drops `members_active` immediately; a grace close keeps the member until expiry. The received list also includes the guest `setAppearance` frame, counted once per decoded frame (including a report the hub later drops as rate-limited or unchanged). The encoded and frame-sent allow-lists include `activityEvent` and `leaderboardUpdate`; one broadcast increments the encoded counter once and the frames-sent counter once per recipient. They also include `memberAppearance` — one encoded count per broadcast and one frames-sent count per recipient of the public appearance projection ([realtime](realtime.md#public-appearance-projection)).

The four histograms render cumulative bucket counters plus `_sum` and `_count`. Example scrape lines are `cubeclicker_ws_connections_open 2`, `cubeclicker_ws_messages_received_total{type="join"} 2` and `cubeclicker_db_query_duration_seconds_bucket{le="0.025"} 0`.

Metrics are **per process** and reset on restart; there is no aggregation across restarts, instances, deploys or environments. The DB pool gauges are sampled at scrape time (and report `0` when the backend runs on the in-memory repositories), while query counters and duration are recorded by the runtime pool wrapper (duration and outcome only — never SQL text or parameters).

## Exposure and retention

`GET /metrics` is served by the existing backend on port `8080`, next to `GET /healthz` and the `GET /ws` upgrade. A scrape returns `200` with content type exactly `text/plain; version=0.0.4; charset=utf-8` and `cache-control: no-store`; the body is the deterministic Prometheus text described above, with no JSON or ANSI wrapper. The route runs the pool-gauge collection hook before rendering.

- **Deployed default off.** The Render backend is one public host and Render applies no path filter: every backend path (`/healthz`, `/auth/*`, `/ws` and any other route) is reachable on that host, and there is no ALB or edge routing rule to rely on. The exposure control is therefore the configuration default: `render.yaml` commits `METRICS_ENABLED: 'false'` for the development service, and the live service carries the same value. On a deployed app `GET /metrics` is a plain `404`, while `/healthz` keeps serving `{"status":"ok"}`. `false` (or `0`) always registers no route; an invalid value fails startup naming `METRICS_ENABLED`.
- **Local default on.** `compose.yaml` passes `METRICS_ENABLED: "${METRICS_ENABLED:-true}"` and publishes the backend on `127.0.0.1:8080` only, so `curl http://localhost:8080/metrics` reaches the route on the loopback. Inside the compose network (and the smoke run) the address is `http://backend:8080/metrics`. `METRICS_ENABLED=false podman compose up` removes the route locally too.
- **Never CORS-exposed.** The in-repo CORS hook skips `/metrics` before granting anything: an actual `GET` and a preflight `OPTIONS` from the configured frontend origin receive no `access-control-allow-origin`, no `access-control-allow-credentials` and no preflight method/header grant. A browser on the Vercel frontend therefore cannot read the endpoint even during a temporary enablement. The route has no authentication token by design; CORS is the browser boundary, not an auth mechanism.
- **Temporary internal enablement.** To scrape a deployed app deliberately, set `METRICS_ENABLED=true` on the Render service (dashboard → Environment), let Render restart the instance, scrape the public host, then set it back to `false`. A restart resets the per-process metrics. Render has no path filter, so the short window is reachable by a non-browser HTTP client on the public host; treat it as an audited exception, not an internal-network guarantee, and prefer local compose when that risk is unacceptable.
- **No new exposure surface.** The route is on the existing port and image: no new listen port, host mapping, compose service, Dockerfile, healthcheck, Render route, Vercel route, or Terraform resource is added. The image health check remains `GET /healthz`.
- **Historical AWS boundary.** The superseded AWS target used an ALB routing table that contained only `/ws`, `/auth*` and `/healthz` and no `/metrics` listener rule; `infra/terraform` is archived historical infrastructure and is not provisioned or deployed. That is historical context only: it is not the current boundary and must not be cited as runtime protection on Render. See [deployment](deployment.md) § Superseded AWS deployment (historical).
- **Log retention.** Locally, JSON goes to stdout and is read with `podman compose logs backend`. On the current Render target the same stdout stream is read from the Render dashboard or CLI, and Render retains logs according to the service plan. On the superseded AWS target, the ECS `awslogs` driver shipped stdout to the CloudWatch log group `/ecs/cubeclicker-production/backend` with **30-day retention** (historical only). This feature adds no log shipper, rotation, retention setting, dashboard, alarm or Terraform resource; deployed retention is the platform's setting.
- **No metric persistence.** Metrics exist only in the backend process memory: a restart resets every counter, gauge and histogram, and there is no historical store or cross-instance aggregation. A Prometheus/Grafana stack is out of scope.

## Frontend performance overlay

The overlay is a development-only diagnostic surface. It is enabled by the build-time Vite variable `VITE_PERF_OVERLAY` and is strict: only the exact string `'true'` enables it; unset, empty, `'1'`, `'TRUE'` and `'yes'` all keep it off. Vite inlines the value at build/dev-server start, so enabling or disabling it requires a restart, not a runtime toggle.

```bash
VITE_PERF_OVERLAY=true podman compose up
```

With the flag on, `<PerfOverlay>` renders an `<aside data-testid="perf-overlay" aria-live="off">` in the corner with five rows:

| Row | Meaning |
| --- | --- |
| `Frame <n> ms` | The latest frame delta measured by the session loop. |
| `Quality <tier>` | The current adaptive quality tier (`high`, `medium` or `low`). |
| `Draw calls <n>` | `renderer.info.render.calls` for the frame, including composer passes. |
| `Triangles <n>` | `renderer.info.render.triangles` for the frame. |
| `WS RTT <n> ms` | Round-trip time of the diagnostic WebSocket `ping`/`pong`; `—` when unavailable. |

- **Polling.** Stats refresh every 250 ms; RTT refreshes every 1000 ms (one diagnostic ping per second, matching the server limit). Both intervals and any in-flight measurement are cleaned up on unmount.
- **RTT protocol.** The client sends the additive diagnostic frame `{ "type": "ping", "t": <rounded clock> }` only while the transport is `connected`; the server echoes the same finite numeric `t` as `{ "type": "pong", "t": … }`. A missing pong times out to `—` after 2000 ms. A second ping within 1000 ms per connection is dropped and counted in `cubeclicker_rate_limit_drops_total{scope="ping"}`. The pair is connection-local diagnostics: it changes no membership, board, economy or other game state.
- **No production UI.** With the flag unset the component never mounts, no polling runs and no diagnostic ping is sent. The production frontend build leaves `VITE_PERF_OVERLAY` unset. The overlay adds no dependency and imports no Three.js; it stays inside the pinned bundle budget, so there is no production UI or bundle regression.
- **Renderer accounting.** The WebGL adapter sets `renderer.info.autoReset = false` and resets `renderer.info` once at the start of every adapter frame (both plain and realistic adapters), so draw calls and triangles accumulate across composer passes into one frame total without changing rendered output.

## Verification

The feature's gates are the repository commands:

```bash
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod
npm run smoke
```

`npm run coverage` enforces Vitest V8 thresholds of at least 80% statements, branches, functions and lines per workspace. `npm run build` enforces the frontend gzip bundle budget (150,000 B initial, 165,000 B Three.js, 300,000 B total).

Container probes:

```bash
podman compose up -d --build backend
curl -fsS http://localhost:8080/metrics
podman compose logs --no-color backend
```

Exposure configuration and CORS checks:

```bash
grep -A1 -F "key: METRICS_ENABLED" render.yaml | grep -F "value: 'false'"
npm run test --workspace @cubeclicker/backend -- src/cors.test.ts src/app.test.ts
```

The containerized smoke (`npm run smoke`) adds a joined-state metrics check: it opens one WebSocket client, reads `hello`, sends `join`, waits for `welcome`, and while the client is still joined fetches `http://backend:8080/metrics`. The check asserts `200`, the exact Prometheus content type, the `# TYPE cubeclicker_ws_connections_open gauge` line, `cubeclicker_ws_connections_open >= 1`, `cubeclicker_servers_active >= 1`, `cubeclicker_ws_connections_total >= 3`, `cubeclicker_ws_messages_received_total{type="join"} >= 3` and `cubeclicker_ws_frames_sent_total{type="hello"} >= 3`; the client then closes and the run settles. The raw feature evidence is in [`build-log-T5.md`](../features/runtime-observability/build-log-T5.md); the deployed exposure fix (Render default false, CORS exclusion) is in [`build-log-T6.md`](../features/runtime-observability/build-log-T6.md).
