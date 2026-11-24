# Build log — T8 — Server wiring: build-first, startup, cleanup lifecycle, exit path

Task: T8 (2026-11-24)
Feature: db-schema-bootstrap-and-expiry-cleanup
Files changed:
- `src/backend/src/server.ts`
- `src/backend/src/server.test.ts` (new)
- `src/backend/src/db/migrate-runner.ts`
- `src/backend/src/db/migrate-runner.test.ts`
- `docs/features/db-schema-bootstrap-and-expiry-cleanup/build-log-T8.md`

Sketch (≤5 lines):
- Export `startServer(env, { exit })`; build the app first, run `runDatabaseStartup` with the app-bound `createLogSink(app.log)`.
- On a `DatabaseStartupError`: log `db_startup_failed` from `stage`/`errorType`/optional `code` only, `app.close()`, `exit(1)`, return `{started:false}` and never `listen`.
- After `listen`: no pool → debug skip; disabled → info skip; enabled → `createVerificationCleanupScheduler` over `new PgVerificationTokenRepository(pool)` + `start()`.
- `installShutdownHandlers({ … beforeClose: () => cleanup?.stop() })`; return `{started, app, cleanup}`; add the direct-invocation guard.
- Remove `runStartupMigrations` + its five tests atomically; add the module-mocked `server.test.ts` wiring suite.

What changed & why:
- `server.ts` is now the composition root for the whole DB lifecycle (D11). Order:
  `loadAuthConfig` → `createPool` → `loadDbLifecycleConfig` → `buildApp` (pool handed in, so
  exactly one pool) → `createLogSink(app.log)` → `runDatabaseStartup(env, { config, log })` →
  `listen` → cleanup scheduler → shutdown handlers. A startup failure logs one
  `db_startup_failed` line (`stage`, `errorType`, optional string `code`; never the cause
  message/stack), awaits `app.close()` (pool + hub; a close failure is swallowed so it cannot
  mask the startup failure), calls `exit(1)` and returns before `listen` (AC-22). No database
  keeps the existing in-memory repositories and skips the phase (AC-10).
- Cleanup wiring (AC-21): no pool → `db_verification_cleanup_skipped {reason:'no_database'}` at
  debug and no scheduler; pool + `cleanupEnabled:false` → the same event with
  `{reason:'disabled'}` at info; pool + defaults → a scheduler over the same pool through
  `PgVerificationTokenRepository`, started only after `listen`, with
  `beforeClose: () => cleanup?.stop()` so shutdown stops it before the pool closes (AC-20).
- `startServer` is exported with `StartServerDeps.exit` (defaults to `process.exit`) and returns
  `{ started, app, cleanup }`; the `import.meta.url === pathToFileURL(process.argv[1]).href`
  guard keeps importing the module side-effect free (verified with both `tsx` and `tsx watch`).
- `migrate-runner.ts` drops `runStartupMigrations` in the same change (the startup phase now
  owns the conditional skip); `resolveStartupMigrationUrl`, `resolveMigrationUrl`,
  `runMigrationsAgainst` and their tests stay. `migrate-runner.test.ts` drops exactly the five
  `runStartupMigrations` cases (URL precedence/no-database remain covered by `startup.test.ts`).
- `server.test.ts` (6 tests) module-mocks `app`, `pool`, `startup`, `verification-cleanup`,
  `shutdown` and `PgVerificationTokenRepository`, but runs the real `createLogSink` over a fake
  `app.log` and the real `loadAuthConfig`/`loadDbLifecycleConfig`, so the exact event
  name/level/field triples and the real env parsing are pinned.

Decisions:
- The result includes `app` in addition to `{ started, cleanup }` because the plan's
  `StartServerResult` interface pins it; tests assert `result.app` identity.
- `HOST`/`PORT` are resolved from the injected `env` (defaults `0.0.0.0`/`8080`) instead of
  module-level `process.env`, so the wiring suite is deterministic; production passes
  `process.env`, so behavior is unchanged.
- A non-`DatabaseStartupError` rejection (an internal contract violation) is still fail-closed:
  `startupFailureFields` logs `stage:'connect'`-class fields with only `errorType`
  (`'unknown'` for a non-Error) rather than a message or stack. In practice
  `runDatabaseStartup` wraps every failure.
- Coverage scope: `src/backend/src/server.ts` remains under the pre-existing composition-root
  exclusion (`src/backend/vitest.config.ts`, D14/AC-27); `server.test.ts` is behavioral, not
  coverage-counted. All other touched modules stay covered (see table).
- Test tier: the spec assigns server wiring to the module-mocked unit suite
  (`spec.md` § Testing strategy) and the real process/container boundary to the T9/T11 stack
  smoke, so no extra in-process server spawn was added; `server.test.ts` still exercises the
  real config parsers and the real log adapter across the mocked boundaries.
- No documentation edit in this task: it adds no user-facing config/route/behavior; the new
  events (`db_startup_failed`, `db_verification_cleanup_skipped`) and the lifecycle wiring are
  documented by the T10 pass per `docs/architecture/documentation.md`.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .

lint exit=0
```

- `npm run typecheck` → exit 0 (both workspaces)
```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

typecheck exit=0
```

- `npm run test --workspace @cubeclicker/backend -- src/server.test.ts src/app.test.ts src/db/migrate-runner.test.ts src/db/migrate-cli.test.ts` → exit 0 (65 tests)
```
> test
> vitest run src/server.test.ts src/app.test.ts src/db/migrate-runner.test.ts src/db/migrate-cli.test.ts

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/migrate-runner.test.ts (9 tests) 6ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 6ms
 ✓ src/server.test.ts (6 tests) 14ms
 ✓ src/app.test.ts (42 tests) 2406ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1120ms

 Test Files  4 passed (4)
      Tests  65 passed (65)
   Start at  09:49:13
   Duration  3.02s (transform 342ms, setup 0ms, collect 700ms, tests 2.43s, environment 0ms, prepare 235ms)

tests exit=0
```

- `npm run coverage --workspace @cubeclicker/backend` → exit 0; thresholds ≥ 80 statements/branches/functions/lines met for the workspace
```
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
 Test Files  52 passed (52)
      Tests  1926 passed (1926)
   Start at  09:49:20
   Duration  4.29s (transform 4.86s, setup 0ms, collect 16.03s, tests 25.61s, environment 11ms, prepare 6.23s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.81 |    91.16 |   99.63 |   96.81 |
 src               |   96.72 |    91.45 |     100 |   96.72 |
  app.ts           |   95.74 |     88.5 |     100 |   95.74 | ...18-319,367-369
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   96.17 |    83.58 |     100 |   96.17 |
  auth-routes.ts   |    81.4 |     55.3 |     100 |    81.4 | ...61-363,369-370
  auth-service.ts  |     100 |    81.87 |     100 |     100 | ...97,402,419,507
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847
  email-cli.ts     |    98.3 |    80.55 |     100 |   98.3 | 176-177
  ...l-template.ts |     100 |      100 |     100 |     100 |
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    84.37 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    89.65 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.66 |     100 |   97.29 | 63-68
 src/db            |   99.07 |    96.44 |     100 |   99.07 |
  ...cle-config.ts |     100 |      100 |     100 |     100 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |   96.61 |    95.45 |     100 |   96.61 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
  ...-bootstrap.ts |     100 |    97.56 |     100 |     100 | 181
  ...a-contract.ts |     100 |      100 |     100 |     100 |
  startup.ts       |    98.5 |    96.29 |     100 |   98.5 | 162-163
  ...on-cleanup.ts |     100 |      100 |     100 |     100 |
 src/deploy        |   98.09 |    98.75 |     100 |   98.09 |
  ...er-env-cli.ts |      95 |    96.15 |     100 |      95 | 160-164
  render-env.ts    |     100 |      100 |     100 |     100 |
 src/game          |   96.25 |    94.92 |   99.13 |   96.25 |
  activity.ts      |     100 |      100 |     100 |     100 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  leaderboard.ts   |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.36 |     99.2 |   97.77 |   99.36 | 477-478,1088-1089
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/observability |   99.67 |    96.64 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252
  shutdown.ts      |     100 |    94.73 |     100 |     100 | 74
-------------------|---------|----------|---------|---------|-------------------
coverage exit=0
```

Coverage notes: the backend run executes the whole workspace, so the real-Postgres suites
also ran (52 files, 1,926 tests; none self-skipped — `schema-bootstrap-postgres` 7,
`verification-cleanup-postgres` 2, `schema-contract-postgres` 4, `migration-006` 13,
`migration-007` 11). `migrate-runner.ts` moved from 97.1 % to 96.61 % because the removed
`runStartupMigrations` lines were covered; the only uncovered lines (107–108) are the
`migrationsDir` pass-through. `startup.ts` remains 98.5 % (lines 162–163, same seam).

Acceptance audit:
- AC-10 → met (server half). `server.test.ts` "builds first, listens with in-memory
  repositories and creates no scheduler": with `env={}`, `createPool` is called with `null`,
  `buildApp` is called with `{NODE_ENV:'development'}` and `{}` (in-memory repositories),
  `runDatabaseStartup` receives the app-bound sink and the phase resolves `{skipped:true}`,
  then `app.listen({host:'0.0.0.0',port:8080})` runs and the result is `{started:true,…}`.
  The startup-module half (debug `no_database` skip without a client) is T6's
  `startup.test.ts`.
- AC-11 → met (server half). `server.test.ts` "logs the lock stage, closes the app, exits 1
  and never listens": a `DatabaseStartupError('lock', …)` produces exactly one
  `db_startup_failed {stage:'lock', errorType:'Error', code:'55P03'}` at error,
  `app.close()` once, `exit(1)` once, zero `app.listen` calls and no scheduler/shutdown.
  The startup-module half (30 s bounded wait, `stage:'lock'`) is T6's `startup.test.ts`.
- AC-21 → met. No pool: `db_verification_cleanup_skipped {reason:'no_database'}` at debug,
  no repository/scheduler construction, `cleanup:null` (test A). Pool + disabled: the same
  event with `{reason:'disabled'}` at info, no scheduler (test D). Pool + defaults: event order
  `buildApp → startup → listen → repository → cleanupFactory → cleanupStart → shutdown`; the
  repository receives the same pool; the factory receives `intervalMs:3_600_000` and the same
  app-bound sink; `beforeClose()` calls `stop()` exactly once and its promise stays pending
  until the stop promise resolves; the returned `cleanup` is the scheduler (test E).
- AC-22 → met. `server.test.ts` "logs the bootstrap stage without a code and never listens":
  `DatabaseStartupError('bootstrap', new Error('CREATE TABLE users failed'))` yields exactly
  `db_startup_failed {stage:'bootstrap', errorType:'Error'}` at error (no `code` key, no SQL
  text), `app.close()` before `exit(1)`, and zero `app.listen` calls; the close-rejection test
  proves the failure path still exits 1 when `app.close()` rejects.
- AC-23 → met. Every `server.test.ts` log assertion is a full `toEqual` on exact
  `{level,event,fields}` entries; the lock fixture embeds an email, a message and a
  `postgres://` URL in the cause and the suite asserts none of them (nor `SELECT`/`CREATE
  TABLE`/the cause message) appears in the serialized entries. Error events carry only
  `stage`, `errorType` and, when present, a string `code`.
- Atomic removal → met. `grep runStartupMigrations` finds no production/test reference;
  `migrate-runner.test.ts` still has its 9 `resolveMigrationUrl`/`runMigrationsAgainst` tests
  green, and `migrate-cli.test.ts` (8 tests) is unchanged and green.

Scope check: only `server.ts`, `server.test.ts`, `migrate-runner.ts`, `migrate-runner.test.ts`
and this log are modified/added; `compose.yaml`, `render.yaml`, docs, `tasks.md`, `status.md`,
`docs/features/README.md` and `.env*` were not touched. No dependency or lockfile change.

Deviations from spec: none.
