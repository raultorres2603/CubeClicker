# Build log — T1 — Additive debug log sink

Task: T1 (2026-11-24)
Feature: db-schema-bootstrap-and-expiry-cleanup
Files changed:
- `src/backend/src/observability/logging.ts`
- `src/backend/src/observability/logging.test.ts`
- `src/backend/src/game/hub.test.ts`
- `src/backend/src/observability/shutdown.test.ts`
- `docs/features/db-schema-bootstrap-and-expiry-cleanup/build-log-T1.md`

What changed & why:
- `LogSink` gains `debug(event, fields)`; `LoggerLike` gains `debug(fields, event)`; `createLogSink` maps `debug` to Pino's object-first `logger.debug(fields, event)` (AC-1). The module doc comment now names the four event-first methods.
- Nothing else in `logging.ts` changed: `REDACT_PATHS`, `REDACT_CENSOR`, `buildLoggerOptions`, level resolution, the `req`/`res`/`err` serializers and the existing `info`/`warn`/`error` mappings are byte-identical (the diff is additive plus the comment).
- `logging.test.ts`: a new real Fastify/Pino test asserts `sink.debug('db_schema_table_present', { table: 'users' })` with `LOG_LEVEL=debug` writes exactly one JSON line with `level: 20`, `msg` and `table`; the fake-logger mapping test now also drives and pins the `debug` call object-first. All pre-existing assertions are unchanged.
- The two existing `LogSink` doubles implement `debug`: `game/hub.test.ts` `LogRecorder` (`RecordedLog.level` union gains `'debug'`) and `observability/shutdown.test.ts` `createLogRecorder` (`LogEntry.level` union gains `'debug'`). No existing assertion in either suite changed.

Decisions:
- `debug` is a required method, not optional: the sink contract stays total so a call site can never silently drop a diagnostic. The two doubles above are the only implementations outside `createLogSink` (grep of `LogSink` in `src/backend`).
  Note: `src/backend/tsconfig.json` excludes `src/**/*.test.ts`, so the repo `npm run typecheck` does not itself compile the doubles. Interface satisfaction was additionally checked with a one-off test-inclusive `tsc --noEmit` program (temporary config outside the repo, evidence below): it reports no `LogSink`/`debug`-related error and no error in `shutdown.test.ts`.
- Test tiers: unit = `createLogSink` over a fake `LoggerLike` asserting exact `toHaveBeenCalledWith({ table: 'users' }, 'db_schema_table_present')`; integration = a real in-process Fastify/Pino logger over a capture stream producing one JSON line at `level: 20`. The change has no other integration boundary (no route/pool/wire change), so no coverage exception applies.
- No new test was added to `hub.test.ts`/`shutdown.test.ts`: those files only needed the required interface method; the existing exact-entry assertions still prove their event behavior is unchanged, and both suites pass. A test that manually calls a test double's `debug` would be a useless test.
- Coverage note: a parallel worker's T3 files (`src/backend/src/db/lifecycle-config.ts` + test) were present untracked in the working tree during the coverage run, so all-files semantics included them (they pass). This task staged none of them.
- `docs/architecture/observability.md` is T10-owned; the `LogSink.debug` documentation lands there, not in this task.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0 (both workspaces; production sources only — the backend tsconfig excludes `*.test.ts`)
```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

- Supplementary typecheck over backend sources **including tests** (one-off temporary config in `/tmp`, not committed): `npx tsc --noEmit -p /tmp/opencode/tsconfig.backend-tests.json` → exit 2 from pre-existing errors in excluded test files; the run contains no `LogSink`/`debug`-related diagnostic and no `src/observability/shutdown.test.ts` error, so both doubles satisfy the widened `LogSink`. (Pre-existing, untouched: `hub.test.ts` has 33 unrelated errors — `yawSteps`, `welcome.economy`, `TimerHarness`, etc. — and `logging.test.ts` line 2 has a pre-existing `PinoLoggerOptions` import error; the repo does not typecheck test files, and T1 did not introduce or change any of them.)
```
src/game/hub.test.ts(787,9): error TS2353: Object literal may only specify known properties, and 'yawSteps' does not exist in type 'CubeFields'.
...
src/observability/logging.test.ts(2,37): error TS2305: Module '"fastify"' has no exported member 'PinoLoggerOptions'.
```
  Filtered check: `grep -E "logging\.test|shutdown\.test|LogSink|debug"` matched only the pre-existing `PinoLoggerOptions` line; no `shutdown.test.ts` line and no missing-`debug` error.

- `npm run test --workspace @cubeclicker/backend -- src/observability/logging.test.ts src/observability/shutdown.test.ts src/game/hub.test.ts` → exit 0
```
> test
> vitest run src/observability/logging.test.ts src/observability/shutdown.test.ts src/game/hub.test.ts

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/observability/shutdown.test.ts (7 tests) 10ms
 ✓ src/observability/logging.test.ts (29 tests) 88ms
 ✓ src/game/hub.test.ts (212 tests) 331ms

 Test Files  3 passed (3)
      Tests  248 passed (248)
   Start at  09:15:32
   Duration  1.03s (transform 509ms, setup 0ms, collect 856ms, tests 429ms, environment 1ms, prepare 304ms)
```

- `npx vitest run src/observability/logging.test.ts --reporter=verbose` (workdir `src/backend`) → exit 0; new/changed tests green, every pre-existing redaction/serializer/level test green:
```
 ✓ src/backend/src/observability/logging.test.ts > buildLoggerOptions log levels > uses debug for NODE_ENV=development 0ms
 ✓ src/backend/src/observability/logging.test.ts > buildLoggerOptions redaction and serializers > pins every top-level, request/response and wildcard redaction path 0ms
 ✓ src/backend/src/observability/logging.test.ts > buildLoggerOptions redaction and serializers > wires the redaction censor and paths into the options 0ms
 ✓ src/backend/src/observability/logging.test.ts > buildLoggerOptions redaction and serializers > wires the safe req, res and err serializers 0ms
 ✓ src/backend/src/observability/logging.test.ts > captured JSON lines > redacts top-level and nested secrets in a real Pino line 2ms
 ✓ src/backend/src/observability/logging.test.ts > createLogSink > emits the structured fields through a real Fastify/Pino logger 1ms
 ✓ src/backend/src/observability/logging.test.ts > createLogSink > emits a debug event at level 20 through a real Fastify/Pino logger 1ms
 ✓ src/backend/src/observability/logging.test.ts > createLogSink > calls Pino object-first with fields then the event name 2ms

 Test Files  1 passed (1)
      Tests  29 passed (29)
   Start at  09:15:36
   Duration  396ms (transform 56ms, setup 0ms, collect 93ms, tests 83ms, environment 0ms, prepare 49ms)
```

- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds ≥ 80 statements/branches/functions/lines; exit 0 is the gate pass)
```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/observability/logging.test.ts (29 tests) 197ms
 ✓ src/observability/shutdown.test.ts (7 tests) 12ms

 Test Files  43 passed (43)
      Tests  1856 passed (1856)
   Duration  3.78s (transform 5.49s, setup 0ms, collect 16.29s, tests 15.28s, environment 10ms, prepare 4.77s)

All files          |   96.67 |    90.88 |   99.62 |   96.67 |
 src/observability |   99.67 |    96.52 |     100 |   99.67 |
  logging.ts       |     100 |      100 |     100 |     100 |
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57
```

- Diff scope (`git diff --stat` for the four touched source files):
```
 src/backend/src/game/hub.test.ts               |  5 ++++-
 src/backend/src/observability/logging.test.ts  | 25 +++++++++++++++++++++++++
 src/backend/src/observability/logging.ts       |  9 ++++++---
 src/backend/src/observability/shutdown.test.ts |  3 ++-
 4 files changed, 37 insertions(+), 5 deletions(-)
```

Acceptance audit:
- AC-1 → met:
  - `LogSink` exposes `debug(event, fields)` alongside `info`/`warn`/`error`; `LoggerLike` exposes `debug(fields, event)` (`logging.ts`).
  - `createLogSink(logger).debug('db_schema_table_present', { table: 'users' })` calls `logger.debug({ table: 'users' }, 'db_schema_table_present')`, pinned by `toHaveBeenCalledWith`.
  - A real Fastify/Pino sink writes one JSON line with `level: 20`, `msg: 'db_schema_table_present'` and `table: 'users'` (new test; `LOG_LEVEL=debug`).
  - Both existing doubles implement `debug` (`LogRecorder` in `game/hub.test.ts`, `createLogRecorder` in `observability/shutdown.test.ts`); the test-inclusive one-off `tsc` program reports no missing-`debug` error and no `shutdown.test.ts` error, and `hub.test.ts` (212) / `shutdown.test.ts` (7) pass unchanged.
  - Existing `info`/`warn`/`error` mapping, redaction paths/censor, serializers, level resolution and every existing event name are unchanged: the diff touches none of them, and the pinned tests for each (plus the real 30/40/50 logger test) pass in the same run.
- Unit tier: fake `LoggerLike` mapping in `logging.test.ts`. Integration tier: real in-process Fastify/Pino capture stream in `logging.test.ts`. Both green.

Deviations from spec: none.

Out-of-scope confirmation: only the four owned source/test files and this build log are committed. `tasks.md`, `status.md`, `docs/features/README.md`, `.env*`, compose/render files, shared config and the parallel workers' files were not modified or staged by this task.
