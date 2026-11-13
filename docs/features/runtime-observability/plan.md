---
feature: runtime-observability
revision: 2
---
# Plan — Runtime Observability

## Architecture

Four layers, all inside the existing single-process backend unless noted:

1. **Observability core (backend, no Fastify/DB dependency).**
   - `observability/metrics.ts` owns a small in-process registry: metric definitions (name, type, help, label allow-lists, histogram buckets), counters, gauges, histograms, label validation and Prometheus-text rendering. It imports nothing from `game/**`, `auth/**` or `db/**`.
   - `observability/config.ts` parses `LOG_LEVEL` and `METRICS_ENABLED` from the environment with the existing `readInteger`/`readBoolean` style: invalid values throw naming the variable.
   - `observability/logging.ts` builds Fastify/Pino logger options: level by `NODE_ENV`/`LOG_LEVEL`, redaction paths/censor, and `req`/`res`/`err` serializers that exclude bodies, headers, IPs, query strings, messages and stacks.
2. **Hub instrumentation (backend game layer).**
   - `game/hub.ts` accepts an optional `metrics` registry and an optional `LogSink` in `HubDeps`. `LogSink` is an event-first contract (`info(event, fields)`, `warn(event, fields)`); `observability/logging.ts` provides `createLogSink(logger)` which adapts Pino's object-first API (`logger.info(fields, event)`), so fields are never dropped. The hub increments connection/message/broadcast/room/flush/rate-limit/revision counters, sets gauges at the same points, observes the four histograms, logs connection lifecycle events with the request id passed to `attach`, and records bounded counts without touching the encode-once fan-out.
   - The diagnostic `ping`/`pong` pair lives in both protocol mirrors. The hub answers a `ping` with `pongMessage(t)` at most once per 1000 ms per connection; later pings are dropped and counted. No member/game state is read or written by this path.
3. **Backend wiring and exposure (composition root).**
   - `app.ts` creates the metrics registry, builds Fastify with the logger options, creates the hub with the metrics registry and `createLogSink(app.log)`, instruments the runtime pool, registers the internal `/metrics` route, logs WS open/close/rejection with `req.id`, and increments the HTTP limiter drop metric via the rate limiter's optional `onDenied`.
   - `observability/metrics-route.ts` renders the registry after a `collect()` hook samples the pool gauges; it registers only when `METRICS_ENABLED` is true, sets `cache-control: no-store`, and never changes the ALB or port.
   - `observability/db-metrics.ts` wraps the promise-returning `query` of the structural `Queryable` pool surface (duration/outcome only, original `this` preserved with `apply`) and samples `totalCount`/`idleCount`/`waitingCount` on scrape.
   - `observability/shutdown.ts` installs one-shot `SIGTERM`/`SIGINT` handlers that log through the same `LogSink`, count, close the app and exit; `server.ts` installs them after `listen`.
4. **Frontend dev overlay (client-local).**
   - `perf/overlay.ts` resolves the strict build-time flag `VITE_PERF_OVERLAY === 'true'` and exports the small `PerfStats`/`PerfSource` types.
   - `game/session.ts` keeps the latest frame time, quality tier and `renderer.info` values from the frame loop (`getPerfStats`) and measures RTT with a diagnostic `ping`/`pong` (`measureRtt`). These are optional methods so existing session fakes keep type-checking.
   - `render/webgl.ts` exposes optional `stats()` on the renderer adapter, reading `renderer.info.render.calls/triangles`. `info.autoReset` is disabled and `info.reset()` runs once at the start of each adapter render, so post-processing passes accumulate into one frame total without changing rendered output.
   - `ui/PerfOverlay.tsx` polls the session at 250 ms (stats) and 1000 ms (RTT); `App.tsx` renders it only when `isPerfOverlayEnabled()` is true. No CSS file, dependency or production UI change.

### Data flow

```
HTTP request ──► Fastify + Pino (redacted structured log)
                     │
GET /metrics ────────┼──► metrics.collect() ──► db pool gauges
                     │        └──► metrics.render() (Prometheus text)
                     │
WS upgrade /ws ──────┼──► app logs open (connectionId = req.id)
                     │        └──► hub.attach(peer, session, req.id)
                     │                 ├── connection counters/gauges
                     │                 ├── hub.log(opened/closed/heartbeat/rejected)
                     │                 └── hub.handleMessage
                     │                        ├── parsed type counter
                     │                        ├── send/broadcast encode/frame/fan-out
                     │                        ├── removal/economy pending gauges
                     │                        ├── rate-limit drop counters
                     │                        └── revision rejection counters
                     │
DB query ────────────┴──► instrumented pool.query ──► duration/outcome metrics

Frontend (dev only):
session frame ──► frameMs/tier/renderer.info ──► getPerfStats() ──► PerfOverlay (250 ms poll)
session.measureRtt() ──► transport.send(ping) ──► hub pong ──► RTT ──► PerfOverlay (1 s poll)
```

## Interfaces / contracts

```ts
// observability/metrics.ts
type MetricType = 'counter' | 'gauge' | 'histogram';
interface MetricDefinition {
  type: MetricType;
  help: string;
  labels?: Readonly<Record<string, readonly string[]>>; // allow-list per label
  buckets?: readonly number[];                          // histogram only
}
export const METRIC_DEFINITIONS: Readonly<Record<MetricName, MetricDefinition>>;
export type MetricName = keyof typeof METRIC_DEFINITIONS;
export class Metrics {
  inc(name: MetricName, labels?: Record<string, string>, value?: number): void;
  set(name: MetricName, value: number, labels?: Record<string, string>): void;
  observe(name: MetricName, value: number): void;        // histogram; no labels in catalog
  render(): string;                                      // deterministic Prometheus text
}
export function createMetrics(): Metrics;
export function escapeLabelValue(value: string): string; // testable, used by render()

// observability/config.ts
interface ObservabilityConfig {
  logLevel: 'fatal'|'error'|'warn'|'info'|'debug'|'trace'|'silent'|false;
  metricsEnabled: boolean;                               // default true
}
export function loadObservabilityConfig(env: Record<string, string | undefined>): ObservabilityConfig;

// observability/logging.ts
export interface LogSink {
  info(event: string, fields: Record<string, string | number | boolean>): void;
  warn(event: string, fields: Record<string, string | number | boolean>): void;
  error(event: string, fields: Record<string, string | number | boolean>): void;
}
export function createLogSink(logger: {
  info(fields: object, event: string): void;
  warn(fields: object, event: string): void;
  error(fields: object, event: string): void;
}): LogSink;
export function buildLoggerOptions(
  env: Record<string, string | undefined>,
  stream?: { write(line: string): void },               // test seam only
): FastifyServerOptions['logger'] | false;
export const REDACT_PATHS: readonly string[];

// game/hub.ts (additive)
interface HubDeps {
  // …existing config/now/random/timers/economy/registry…
  metrics?: Metrics;
  log?: LogSink;
}
interface GameHub {
  attach(peer: Peer, accountSession?: AccountSession | null, connectionId?: string): void;
  // …existing methods…
}

// game/protocol.ts + frontend mirror
type ClientMessage = … | { type: 'ping'; t: number };
type ServerMessage = … | { type: 'pong'; t: number };
export function pongMessage(t: number): ServerMessage;
// parseClientMessage accepts t only when typeof t === 'number' && Number.isFinite(t)

// observability/metrics-route.ts
interface MetricsRouteOptions {
  metrics: Metrics;
  enabled: boolean;
  collect?: () => void;
}
export const metricsRoutes: FastifyPluginAsync<MetricsRouteOptions>;

// observability/db-metrics.ts
interface Queryable {
  query: (...args: unknown[]) => unknown;                // pg.Pool satisfies it
}
export function instrumentPool<T extends Queryable>(
  pool: T, metrics: Metrics, now?: () => number,
): T;                                                    // binds original, uses apply(pool,args), symbol guard
export function collectPoolMetrics(
  pool: { totalCount?: number; idleCount?: number; waitingCount?: number } | null,
  metrics: Metrics,
): void;

// observability/shutdown.ts
export function installShutdownHandlers(options: {
  app: { close(): Promise<void> };
  metrics: Metrics;
  log: LogSink;
  process?: { on(signal: string, listener: () => void): unknown; exit(code: number): void };
  signals?: readonly string[];                           // default SIGTERM, SIGINT
}): void;

// auth/rate-limit.ts (additive)
constructor(now?: Clock, onDenied?: (key: string) => void);
export function createRateLimiter(now?: Clock, onDenied?: (key: string) => void): RateLimiter;

// game/session.ts (additive, all optional in the shared UI contract)
interface PerfStats {
  frameMs: number;
  tier: QualityTier;
  drawCalls: number;
  triangles: number;
}
interface RendererAdapter {
  // …existing…
  stats?(): { calls: number; triangles: number };        // mirrors renderer.info.render
}
getPerfStats?(): PerfStats | null;                       // session maps calls → drawCalls
measureRtt?(): Promise<number | null>;                   // flag-agnostic; App gates the caller

// perf/overlay.ts
export function isPerfOverlayEnabled(env?: Record<string, unknown>): boolean;
```

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/observability/metrics.ts` | New | Metric definitions, registry, label validation, Prometheus renderer. |
| `src/backend/src/observability/metrics.test.ts` | New | Registry/render/allow-list unit tests. |
| `src/backend/src/observability/config.ts` | New | `LOG_LEVEL` / `METRICS_ENABLED` parsing. |
| `src/backend/src/observability/config.test.ts` | New | Config parsing and invalid-value tests. |
| `src/backend/src/observability/logging.ts` | New | Logger options, redaction paths, req/res/err serializers, `LogSink` adapter. |
| `src/backend/src/observability/logging.test.ts` | New | Level table, redaction, serializer tests. |
| `src/backend/src/observability/metrics-route.ts` | New | Internal `GET /metrics` Fastify plugin. |
| `src/backend/src/observability/metrics-route.test.ts` | New | Route format, content type, disabled 404. |
| `src/backend/src/observability/db-metrics.ts` | New | Pool query wrapper and scrape-time pool gauges. |
| `src/backend/src/observability/db-metrics.test.ts` | New | Query latency/outcome and pool-gauge tests. |
| `src/backend/src/observability/shutdown.ts` | New | One-shot signal handlers, shutdown log/metric/exit. |
| `src/backend/src/observability/shutdown.test.ts` | New | Signal, double-signal and close-failure tests. |
| `src/backend/src/game/protocol.ts` | Edit | `ping` client frame and `pong` server frame + builder/parser. |
| `src/backend/src/game/protocol.test.ts` | Edit | Ping/pong validation and exact encoded frame. |
| `src/backend/src/game/hub.ts` | Edit | Metrics/log instrumentation, ping handler, connection ids, gauges. |
| `src/backend/src/game/hub.test.ts` | Edit | Metric/log/lifecycle/ping assertions. |
| `src/backend/src/auth/rate-limit.ts` | Edit | Optional `onDenied` callback. |
| `src/backend/src/auth/rate-limit.test.ts` | Edit | Callback and unchanged allow behavior. |
| `src/backend/src/app.ts` | Edit | Logger, metrics instance, `/metrics`, hub/pool wiring, WS logs, HTTP limiter metric. |
| `src/backend/src/app.test.ts` | Edit | Captured-log privacy, endpoint, correlation, metrics integration. |
| `src/backend/src/server.ts` | Edit | Graceful shutdown installation; default dev `NODE_ENV` for logging. |
| `tests/e2e/smoke.mjs` | Edit | Containerized `/metrics` check. |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Frontend ping/pong mirror. |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Mirror validation and parity. |
| `src/frontend/src/game/session.ts` | Edit | `getPerfStats`, `measureRtt`, pong handling, frame stats. |
| `src/frontend/src/game/session.test.ts` | Edit | Stats/RTT tests and existing behavior preserved. |
| `src/frontend/src/render/webgl.ts` | Edit | Renderer `stats()` and per-frame `info` reset. |
| `src/frontend/src/render/webgl.test.ts` | Edit | Stats accessor and reset assertions. |
| `src/frontend/src/perf/overlay.ts` | New | Strict `VITE_PERF_OVERLAY` flag and perf types. |
| `src/frontend/src/perf/overlay.test.ts` | New | Flag truth table. |
| `src/frontend/src/ui/PerfOverlay.tsx` | New | Dev overlay component. |
| `src/frontend/src/ui/PerfOverlay.test.tsx` | New | Labels, polling, placeholders, cleanup. |
| `src/frontend/src/App.tsx` | Edit | Render overlay only when the flag is true. |
| `src/frontend/src/App.test.tsx` | Edit | Flag-gated rendering and no calls when absent. |
| `README.md` | Edit | `## Operations`, log/metrics/overlay configuration table rows. |
| `compose.yaml` | Edit | Backend `LOG_LEVEL`/`METRICS_ENABLED` and frontend `VITE_PERF_OVERLAY` environment pass-throughs with safe defaults (no service/port change). |
| `docs/architecture/observability.md` | New | Canonical logging/metrics/exposure/overlay documentation. |
| `docs/architecture/deployment.md` | Edit | One sentence: `/metrics` is not ALB-routed. |
| `docs/features/runtime-observability/build-log-T5.md` | New | Final verification evidence. |

No change: `compose.smoke.yaml`, both Dockerfiles, `infra/terraform/**`, `.github/**`, `package.json`, `package-lock.json`, `docs/features/README.md` (orchestrator-owned). `compose.yaml` changes only the three environment pass-through entries described above. The smoke script is edited in T5 (after T4), not in T3.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Prometheus text format, self-implemented | De-facto standard, zero dependency, easy to grep; a fixed catalog keeps the renderer small. | JSON endpoint (no ecosystem support); `prom-client` dependency (forbidden by task). |
| 2 | Internal-only `/metrics` on port 8080 | The ALB does not route it; no new port/service; `METRICS_ENABLED` is a kill switch. | Public ALB route with auth (user-owned infra); separate metrics port (new port). |
| 3 | Fixed label allow-list in the registry | Makes PII/high-cardinality leaks impossible at the API boundary, not just by convention. | Code review only; runtime string labels (unsafe). |
| 4 | Fastify's built-in Pino | Already present via Fastify; no new dependency; JSON to stdout is captured by the existing `awslogs` path. | `pino-pretty` transport (new dependency, dev-only noise); custom logger (more code). |
| 5 | Custom `req`/`res`/`err` serializers + redaction | Default serializers can include headers/IPs; custom ones log only method/path/host/status and error type/code. | Default Fastify serializers + redaction only (IP/query leakage risk). |
| 6 | Cycle-level error serializer `{type, code?}` | Error messages can contain user input (emails, SQL fragments); metrics/logs stay safe. | Log message only in debug (new switch, not requested). |
| 7 | Per-process counters/gauges | Single-process architecture; no Redis/DB metrics store; resets documented. | Durable metrics store (new infra). |
| 8 | Diagnostic `ping`/`pong` for RTT | Browsers expose no WS ping API; one small additive frame is the only way to measure live RTT. 1 Hz limit bounds replies. | No RTT; ack-latency proxy (incorrect for non-click traffic); HTTP `/healthz` timing (not WS). |
| 9 | `renderer.info.autoReset = false` + per-frame reset | Makes draw-call/triangle counts a full frame total including composer passes. | Read `info` as-is (last pass only); GPU timer queries (new API/complexity). |
| 10 | Overlay as a small static component | Flag false renders nothing; tiny bundle cost; no new dependency; no Three.js import. | Lazy chunk (extra loading state for a dev tool); imperative DOM (off-pattern). |
| 11 | Graceful shutdown via `app.close()` | Reuses existing `onClose` hub/pool teardown and closes WS clients through the plugin; logs the event. | No signal handler (current console-only behavior); custom socket close loop. |
| 12 | Reuse existing CloudWatch `awslogs` + 30-day retention | Already configured in Terraform; no new observability stack or docs drift. | New log shipper/retention config (new infra). |
| 13 | Event-first `LogSink` adapter, Pino object-first inside | The hub/shutdown call `info(event, fields)`; `createLogSink` calls `logger.info(fields, event)`, so fields are never dropped and both surfaces share one contract. | Passing `app.log` directly (drops fields); Pino order everywhere (more error-prone call sites). |

## Risks & mitigations

- **A new log call leaks a body/header/token** → serializers exclude them, redaction is defense-in-depth, and `app.test.ts` asserts exact absent values after a real login/WS flow; review checks every added log call.
- **A metric label grows unbounded** → registry rejects undeclared labels and out-of-list values; the catalog is the single source; the AC-18 parser checks every emitted sample.
- **`/metrics` becomes public** → no Terraform/ALB change, grep proof, docs state the rule, `METRICS_ENABLED` can disable the route.
- **Hot-path overhead** → map increments and gauges only; no per-recipient labels; the encode-once path, batching windows and DB writes are unchanged.
- **DB wrapper changes failure semantics** → it preserves the original promise/throw, rethrows the same error, and is unit-tested for resolve/reject/sync throw.
- **Shutdown hangs with open sockets** → `app.close()` runs the existing `@fastify/websocket` close path; the platform stop timeout bounds it. A custom timeout is out of scope and would be a separate hardening feature.
- **Overlay regresses the bundle budget** → static small component, no Three import, `npm run build` remains a gate; flag off renders nothing.
- **Ping spam** → 1 Hz per connection, dropped pings counted, no state/identity; frame is capped by the existing 1024-byte message limit.
- **Real renderer info differs from mocks** → `webgl.test.ts` pins calls/triangles and reset count with a fake renderer; the real adapter calls the documented Three.js `info` API only.
- **Repeated logging config on every test app** → `buildApp({})`/`NODE_ENV=test` defaults to logging off, so existing suites stay quiet; tests that need logs pass a captured stream explicitly.
- **Log volume/cost** → production logs one request/response pair per HTTP request at `info` (including the 10-second `/healthz` probe and `/metrics` scrapes) plus one lifecycle line per WebSocket connection; the volume is bounded and the 30-day CloudWatch retention is unchanged. No sampling or shipper is added; a future level/health-suppression change would be a separate follow-up.
- **Compose pass-throughs accidentally enabled in production** → the compose defaults are dev-safe (`LOG_LEVEL=debug`, `METRICS_ENABLED=true`, `VITE_PERF_OVERLAY=false`); the deployed image does not use compose, production remains `NODE_ENV=production`/`info`, and the production frontend build has no `VITE_PERF_OVERLAY` arg.

## Rollback

- **Logging**: remove/revert the `logger` option in `app.ts`; the default `Fastify()` behavior returns. No data/schema impact.
- **Metrics**: set `METRICS_ENABLED=false` to remove the route; revert the observability modules and hub/app increments. Counters are in-memory, so rollback loses only diagnostic data.
- **Overlay**: leave `VITE_PERF_OVERLAY` unset (default) or revert the `App.tsx` conditional/component; no production behavior change.
- **Compose pass-throughs**: remove the three `LOG_LEVEL`/`METRICS_ENABLED`/`VITE_PERF_OVERLAY` environment lines; the code defaults still apply.
- **Ping/pong**: revert the additive protocol frames and the session RTT method; no client/server game message changes, so mixed-version exposure is limited to the dev overlay (which is off by default).
- **Shutdown**: remove the `installShutdownHandlers` call in `server.ts`; the prior console-only shutdown behavior returns.
- There is no schema migration, no persistent state and no container/infrastructure change to roll back.

## Containerization impact

- No new service, image, deployable, port, host mapping or healthcheck. `/metrics` is an HTTP route on the existing backend container port 8080; the ALB continues to route only `/ws`, `/auth*` and `/healthz`.
- `compose.yaml` adds three environment pass-throughs: backend `LOG_LEVEL: "${LOG_LEVEL:-debug}"` and `METRICS_ENABLED: "${METRICS_ENABLED:-true}"`, frontend `VITE_PERF_OVERLAY: "${VITE_PERF_OVERLAY:-false}"`. `LOG_LEVEL=warn podman compose up`, `METRICS_ENABLED=false podman compose up` and `VITE_PERF_OVERLAY=true podman compose up` therefore work; no service, port or image is added. `compose.smoke.yaml`, `src/backend/Dockerfile` and `src/frontend/Dockerfile` are unchanged; `podman compose up` remains the single local command.
- Local proof: `podman compose up -d --build backend`, then `curl -fsS http://localhost:8080/metrics`; `podman compose logs --no-color backend` shows JSON lines.
- Containerized proof (T5, after T4): `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` then `npm run smoke`; `tests/e2e/smoke.mjs` opens a dedicated joined client and fetches `http://backend:8080/metrics` while it is joined, asserting `connections_open >= 1` and `servers_active >= 1` before closing it and settling. The current `assets/index-*.js` entry hash is recorded in the T5 build log.
- Configuration is environment-based with safe defaults: `LOG_LEVEL` (default by `NODE_ENV`), `METRICS_ENABLED` (default `true`), `VITE_PERF_OVERLAY` (default `false`, dev-only). No secret is added.
- Log volume remains bounded by request traffic plus one lifecycle line per WebSocket connection; the existing `awslogs` driver and 30-day retention are reused, with no sampling or shipper.
- Deployment: the existing `awslogs` driver and `/ecs/cubeclicker-production/backend` log group with 30-day retention are reused; no Terraform change.

## Open questions

See `spec.md` § Open questions. The three approval items are Q-1 (Prometheus text), Q-2 (internal-only exposure) and Q-3 (dev overlay + ping/pong RTT); all other choices are builder defaults recorded in the plan's key decisions.
