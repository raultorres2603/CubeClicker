# Build log — T6 — Startup phase with advisory lock, migrations, bootstrap and traces

Task: T6 (2026-11-24)
Files changed:
- `src/backend/src/db/startup.ts`
- `src/backend/src/db/startup.test.ts`
- `docs/features/db-schema-bootstrap-and-expiry-cleanup/build-log-T6.md`

What changed & why: added `runDatabaseStartup(env, deps)`, which resolves
`DIRECT_DATABASE_URL` → `DATABASE_URL` (skipping the phase with a debug
`db_schema_bootstrap_skipped {reason:'no_database'}` when neither is set), opens one
dedicated `pg.Client`, takes a session advisory lock with a 250 ms retry and a 30 s
budget (`db_startup_lock_wait`/`db_startup_lock_acquired`), runs the existing
`runMigrations` runner on that same client (`db_migrations_applied` at info /
`db_migrations_up_to_date` at debug), runs `runSchemaBootstrap` unless
`DB_SCHEMA_BOOTSTRAP_ENABLED=false` (`db_schema_bootstrap_skipped {reason:'disabled'}`
at info), emits `db_startup_completed`, then unlocks and ends the client in a
`finally`; every failure is rethrown as `DatabaseStartupError(stage, cause)` exposing
`stage`, `errorType` and an optional string `code`. The suite drives a recording fake
client/clock/sleep/sink and pins the exact statement order, URL precedence, bounded
lock wait, skip/disable paths, all four error stages, close-failure isolation and the
exact AC-13 event sequence, plus a mocked `pg` proof that the default factory builds
exactly one `Client` and never a `Pool`.

Decisions:
- `runMigrations(client, …)` (the function `runMigrationsAgainst` wraps) is called on
  the phase's single client instead of `runMigrationsAgainst`, which would open a
  second `pg.Client`; AC-9 requires exactly one client and one session-level advisory
  lock spanning migrations and bootstrap (plan § Startup algorithm step 5).
- `db_startup_failed` is **not** emitted here: the plan § Server wiring and AC-22 assign
  that event to `startServer` (T8), which owns closing the app and `exit(1)`. Emitting
  it here too would duplicate the line. `DatabaseStartupError` exposes exactly the
  fields T8 logs (`stage`, `errorType`, optional `code`).
- `deps.config` is optional; when omitted the module parses `env` with
  `loadDbLifecycleConfig`, so a standalone caller still honors
  `DB_SCHEMA_BOOTSTRAP_ENABLED=false`. T8 passes the config it already loaded.
- The lock-wait clock is separate from the phase clock: `db_startup_lock_acquired.waitedMs`
  measures time inside the lock loop, while `db_startup_completed.durationMs` covers
  connect + lock + migrations + bootstrap.
- An attempt that finds the budget exhausted throws instead of logging
  `db_startup_lock_wait`, because the contract scopes `wait` to "will retry". A full
  30 s budget is therefore 121 attempts / 120 retries at 250 ms.
- Bootstrap's `durationMs` comes from `Date.now` (T4 seam); startup tests pin it to 0
  with a `Date.now` spy and drive the startup clock through the injected `sleep`.
- `runStartupMigrations` and `migrate-runner.test.ts` were left untouched (T8 removes
  them atomically with the `server.ts` rewire); no `server.ts` edit was made.

Evidence (raw):

```
$ npm run lint
> lint
> eslint .

(exit 0)
```

```
$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

(exit 0)
```

```
$ npm run test --workspace @cubeclicker/backend -- src/db/startup.test.ts
> test
> vitest run src/db/startup.test.ts

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/startup.test.ts (18 tests) 19ms

 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  09:40:41
   Duration  334ms (transform 80ms, setup 0ms, collect 95ms, tests 19ms, environment 0ms, prepare 63ms)

(exit 0)
```

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/db/startup.test.ts (18 tests) 36ms
 ... (whole backend workspace; see summary below)
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 3054ms
 ✓ src/db/migration-006.test.ts (13 tests) 3103ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 3135ms
 ✓ src/db/migration-007.test.ts (11 tests) 2921ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3528ms

 Test Files  51 passed (51)
      Tests  1925 passed (1925)
   Duration  4.59s (transform 4.96s, setup 0ms, collect 15.16s, tests 27.39s, environment 11ms, prepare 5.65s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.81 |    91.16 |   99.63 |   96.81 |
 src               |   96.72 |    91.45 |     100 |   96.72 |
  app.ts           |   95.74 |     88.5 |     100 |   95.74 | ...18-319,367-369
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   96.17 |    83.56 |     100 |   96.17 |
  auth-routes.ts   |    81.4 |     55.3 |     100 |    81.4 | ...61-363,369-370
  auth-service.ts  |     100 |    81.87 |     100 |     100 | ...97,402,419,507
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847
  email-cli.ts     |    98.3 |    80.55 |     100 |    98.3 | 176-177
  ...l-template.ts |     100 |      100 |     100 |     100 |
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    84.37 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |     98.8 |    89.65 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.66 |     100 |   97.29 | 63-68
 src/db            |   99.09 |    96.49 |     100 |   99.09 |
  ...cle-config.ts |     100 |      100 |     100 |     100 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
  ...-bootstrap.ts |     100 |    97.56 |     100 |     100 | 181
  ...a-contract.ts |     100 |      100 |     100 |     100 |
  startup.ts       |    98.5 |    96.29 |     100 |  98.5 | 162-163
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
  hub.ts           |   91.36 |    89.09 |   98.59 |   91.36 | ...1833,1920-1923
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

(exit 0; thresholds ≥ 80 statements/branches/functions/lines met for the workspace)
```

Notes on the coverage run: it executes the whole backend workspace, so every
real-Postgres suite also ran (51 files, 1,925 tests) — none self-skipped;
`schema-bootstrap-postgres` 7/7, `verification-cleanup-postgres` 2/2,
`schema-contract-postgres` 4/4, `migration-006` 13/13, `migration-007` 11/11.
`startup.ts` is at 98.5 % statements/lines, 100 % functions and 96.29 % branches;
the only uncovered lines (162–163) are the optional `migrationsDir` pass-through in
`migrationOptions` — a seam kept for parity with `RunMigrationsOptions` and not
exercised by the startup suite (the runner's directory loading is covered by
`migrate.test.ts`).

Acceptance audit:
- AC-9 → met. `startup.test.ts` "prefers DIRECT_DATABASE_URL and locks before
  migrating then bootstrapping" asserts one `createClient` call with the direct URL
  (fallback test uses `DATABASE_URL`), the exact step order `connect, lock,
  ledger:create, ledger:select, begin, <migration>, ledger:insert, commit,
  catalog:tables, catalog:columns, unlock, end`, both lock statements bound with
  `[7284571001]`, and exactly one `end()`. The default-wiring test constructs exactly
  one mocked `pg.Client` (`{connectionString: DIRECT_DATABASE_URL}`), ends it, and
  records zero `pg.Pool` constructions. Migration and bootstrap failure tests prove
  the `unlock` + `end` happen on the error paths too.
- AC-10 → met (module half). Both `{}` and `{DIRECT_DATABASE_URL:'',DATABASE_URL:''}`
  return `{skipped:true,applied:[],bootstrap:null}`, emit exactly
  `db_schema_bootstrap_skipped {reason:'no_database'}` at debug, and call
  `createClient` zero times. The `startServer` half is T8's `server.test.ts`.
- AC-11 → met (module half). With the default 30,000 ms budget and injected clock/sleep,
  the lock returning `false` throughout yields exactly 120 `db_startup_lock_wait`
  entries (`waitedMs` 0…29,750 at debug), 121 lock statements, 120 × 250 ms sleeps,
  no migration/catalog statement, `DatabaseStartupError {stage:'lock', errorType:'Error',
  code:undefined}`, unlock not issued, and one `end()`. A lock-query rejection keeps
  its SQLSTATE (`55P03`); a non-`Error` rejection normalizes to `errorType:'unknown'`.
  The `startServer` half is T8's `server.test.ts`.
- AC-12 → met. `DB_SCHEMA_BOOTSTRAP_ENABLED=false` in `env` (config parsed by the
  module) still applies `001_init.sql`, emits
  `db_schema_bootstrap_skipped {reason:'disabled'}` at info, returns `bootstrap:null`,
  and issues zero `information_schema` queries; the exact entry list also includes
  `db_startup_completed {migrated:1,created:0,outdated:0,durationMs:0}`.
- AC-13 → met. Exact full entry list with one retry and one applied migration:
  `db_startup_lock_wait {waitedMs:0}` debug → `db_startup_lock_acquired
  {waitedMs:250}` debug → `db_migrations_applied {count:1}` info →
  `db_schema_bootstrap_started {tables:5}` info → five
  `db_schema_table_present {table}` debug → `db_schema_bootstrap_completed
  {checked:5,created:0,outdated:0,durationMs:0}` info →
  `db_startup_completed {migrated:1,created:0,outdated:0,durationMs:250}` info.
  The no-pending-migration case asserts `db_migrations_up_to_date {}` at debug
  instead of `db_migrations_applied`.
- AC-23 → met. Every recorded entry is asserted with a full `toEqual`, so no extra
  field can appear. The migration-failure fixture embeds an email, `SELECT` and a
  token-looking value plus the configured `DATABASE_URL` in the cause message, and the
  test asserts none of them (nor the connection string) appears in the serialized log
  entries; only `stage`/`errorType`/`code` are exposed on the thrown error for T8 to
  log. No startup event carries SQL, identifiers, rows, messages or stacks.

Deviations from spec: none. Documentation: this task adds an internal module only
(no user-facing behavior, config, container or route change); the feature's
documentation pass is T10 and no doc file is in T6's `files_owned`.
