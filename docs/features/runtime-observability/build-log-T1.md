# Build log — T1 — Observability core: metrics registry, config, logging/redaction

Task: T1 (2026-11-13)
Files changed:
- `src/backend/src/observability/metrics.ts` (new)
- `src/backend/src/observability/metrics.test.ts` (new)
- `src/backend/src/observability/config.ts` (new)
- `src/backend/src/observability/config.test.ts` (new)
- `src/backend/src/observability/logging.ts` (new)
- `src/backend/src/observability/logging.test.ts` (new)
- `docs/features/runtime-observability/build-log-T1.md` (new)

What changed & why (≤5 lines):
1. Added the fixed 30-metric Prometheus registry with allow-listed labels, cumulative histograms, reserved `le`, deterministic sorted rendering, exactly one trailing newline, and an exported `escapeLabelValue`.
2. Added `loadObservabilityConfig` resolving `NODE_ENV`/`LOG_LEVEL` defaults and `METRICS_ENABLED` (default true), with invalid values throwing naming the variable.
3. Added Fastify/Pino logger options: AC-2 redaction paths with `[REDACTED]`, safe `req`/`res`/`err` serializers, optional captured-stream test seam, and the event-first `LogSink` adapter backed by Pino object-first calls.
4. Added unit tests for the catalog/renderer/escape/validation, config defaults/overrides, redaction through a real Fastify/Pino logger, serializers, and `createLogSink`.
5. No app/hub/protocol/frontend/compose/Terraform edits; T1 is the observability core only.

Decisions:
- `METRIC_DEFINITIONS` is the single catalog source (30 entries); `MetricName` is its key union. Unlabeled counters/gauges/histograms initialise to a zero series; labeled metrics appear on the first valid sample. Histogram bucket counts are stored cumulatively and `_bucket{le="+Inf"}` uses the observation count; `le` is renderer-generated and rejected as a catalog label.
- Metric type enforcement: `inc` accepts counters/gauges (negative deltas allowed for gauges), `set` accepts gauges only, `observe` accepts histograms only; non-finite values throw.
- `loadObservabilityConfig` owns the AC-1 default resolution (`production`→`info`, `development`→`debug`, test/unset→`false`, explicit `LOG_LEVEL` overrides). `buildLoggerOptions` returns `false` when disabled and otherwise the Pino options object.
- Pino redaction is defence-in-depth: the `req`/`res` serializers drop headers and bodies entirely, and the AC-2 paths/censor are also wired into `redact`. `err` emits `{ type, code? }` only.
- `VITE_PERF_OVERLAY` is intentionally not in T1: `tasks.md` assigns it to T4 (`src/frontend/src/perf/overlay.ts`); T1's `files_owned` is backend-observability only.
- Tier exception note: T1 has no route/app/hub integration boundary (T3 adds `/metrics` and app wiring). The logging unit suite nevertheless exercises the real Fastify/Pino boundary with a captured stream, including redaction, serializers and the `LogSink` adapter; metrics/config are pure modules with no I/O boundary.

Evidence:

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

`npm test` → exit 0 (backend 29 files / 1041 tests; frontend 69 files / 1844 tests)

```text
 ✓ src/observability/config.test.ts (24 tests) 9ms
 ✓ src/observability/metrics.test.ts (30 tests) 16ms
 ✓ src/observability/logging.test.ts (28 tests) 205ms

 Test Files  29 passed (29)
      Tests  1041 passed (1041)
   Start at  14:09:44
   Duration  3.41s (transform 3.71s, setup 0ms, collect 10.11s, tests 13.14s, environment 6ms, prepare 3.12s)

 Test Files  69 passed (69)
      Tests  1844 passed (1844)
   Start at  14:09:48
   Duration  3.75s (transform 8.35s, setup 0ms, collect 24.83s, tests 12.43s, environment 8.35s, prepare 7.01s)
```

`npm run coverage` → exit 0 (both workspaces; thresholds 80/80/80/80)

Backend coverage report:

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.1 |    87.84 |    99.5 |    95.1 |
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
 src/observability |   99.59 |       96 |     100 |   99.59 |
  config.ts        |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.44 |    93.54 |     100 |   99.44 | 243-244
-------------------|---------|----------|---------|---------|-------------------
```

Frontend coverage aggregate (no frontend source changed in T1):

```text
All files          |   96.47 |   96.14 |   97.54 |   96.47 |
```

`npm run test --workspace @cubeclicker/backend` → exit 0 (29 files, 1041 tests)
`npm run coverage --workspace @cubeclicker/backend` → exit 0 (same backend table above; observability files: config 100/100/100/100, logging 100/100/100/100, metrics 99.44/93.54/100/99.44)

Acceptance audit:
- AC-1 (T1 unit half) → met: `config.test.ts` pins `production`→`info`, `development`→`debug`, test/unset→`false`, explicit `LOG_LEVEL` for all seven values, invalid `LOG_LEVEL` throws naming the variable; `logging.test.ts` pins the same table through `buildLoggerOptions`.
- AC-2 (T1 unit half) → met: `logging.test.ts` pins the full AC-2 redaction path list/censor, captures real Pino JSON lines with top-level and nested email/password/pass/token/sessionToken/verificationToken/cookie/authorization values all `[REDACTED]` and absent raw; the req/res serializer test proves headers/bodies/query strings never emit.
- AC-4 → met: `serializeError` tests pin `{ type: 'Error' }`, a custom name, a string code, a dropped numeric code, and no message/stack; a captured Pino line confirms the serialized `err` has exactly `['type']`.
- AC-6 (T1 unit half) → met: exact full fresh-registry render (sorted HELP/TYPE blocks, zero samples, cumulative histogram buckets, `+Inf`, final newline), exact seeded histogram blocks (`1,2,5` cumulative and `0.012` fractional), sorted label/series output, and `escapeLabelValue('a"b\\c') === 'a\\"b\\\\c'` plus newline/backslash cases.
- AC-7 (catalog) → met: exact 30-name list, exact allow-lists for every labeled metric, histogram bucket arrays, only `reason|result|scope|signal|type` label names, no `le` catalog label, unknown metric/undeclared label/missing label/invalid value/non-finite/wrong-type errors, and the injected `type: 'attacker-controlled'` rejection leaves no series.
- AC-25/AC-26 (T1 scope) → not applicable beyond the quality gates; documentation and the root final gate are T5. T1 leaves app/hub/protocol/frontend/compose/Terraform untouched.

Deviations from spec: none. (`VITE_PERF_OVERLAY` is T4-owned per `tasks.md`, not a T1 config file; no frontend file was created.)
