# Build log — T4 — Schema bootstrap runner and functional PostgreSQL proof

Task: T4 (2026-11-24)
Files changed:
- `src/backend/src/db/schema-bootstrap.ts`
- `src/backend/src/db/schema-bootstrap.test.ts`
- `src/backend/src/db/schema-bootstrap-postgres.test.ts`
- `docs/features/db-schema-bootstrap-and-expiry-cleanup/build-log-T4.md`

What changed & why: added `runSchemaBootstrap(db, { log, tables, now })`, which reads
`information_schema` for the five `REQUIRED_TABLES` (names bound as one constant
`$1::text[]`), creates each missing table plus its indexes in its own `BEGIN`/`COMMIT`
using the pinned idempotent DDL (best-effort `ROLLBACK` + `db_schema_bootstrap_failed`
+ rethrow on failure), and reports pre-existing tables missing required columns as
`db_schema_table_outdated` with `missingColumns` joined in normative DDL order, never
altering them. The recording-sink suite pins every event/field/level plus the failure
traces; the real-Postgres suite proves empty-schema creation, pinned defaults, the two
`users` functional indexes, repository insert round-trips, the zero-DDL second run,
single-table recreation with a post-recreate token insert, and the one/two-column
outdated fixtures.

Decisions:
- Phases follow plan § Bootstrap algorithm: both catalog queries first, then all
  missing-table creations in contract order, then the presence/outdated checks for
  pre-existing tables. A table created in this run is never reported present/outdated.
- `log` stays optional (`log?.…`); the runner is usable without a sink and the unit
  suite runs the default-clock/silent path deterministically via a `Date.now` spy.
- A catalog-query rejection is rethrown with no `db_schema_bootstrap_failed` event:
  the log contract scopes that event to a table creation failure, and the startup
  phase (T6) owns the `db_startup_failed { stage: 'bootstrap' }` trace for it.
- Error traces carry only `table`, `errorType` (an `Error`'s `name`, else `unknown`)
  and an optional string `code`; messages/stacks/SQL never reach a field.
- Real-Postgres isolation uses `DROP SCHEMA public CASCADE` + `CREATE SCHEMA public`
  per test in one throwaway `postgres:16-alpine` container (the search path stays
  `public`, which is the only schema the bootstrap reads).
- The two run statements for the no-op proof are asserted as exactly two `SELECT`s
  (stronger than the AC's zero-DDL list) so an accidental `BEGIN`/`COMMIT` also fails.

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
$ npm run test --workspace @cubeclicker/backend -- src/db/schema-bootstrap.test.ts src/db/schema-bootstrap-postgres.test.ts
> test
> vitest run src/db/schema-bootstrap.test.ts src/db/schema-bootstrap-postgres.test.ts

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/schema-bootstrap.test.ts (12 tests) 7ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 2695ms

 Test Files  2 passed (2)
      Tests  19 passed (19)
   Start at  09:31:29
   Duration  3.10s (transform 97ms, setup 0ms, collect 249ms, tests 2.70s, environment 0ms, prepare 91ms)

(exit 0)
```

Real-Postgres status: **ran** (podman available; `schema-bootstrap-postgres.test.ts`
7/7 in 2.7 s). No suite self-skipped.

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/db/verification-cleanup.test.ts (10 tests) 18ms
 ✓ src/db/schema-contract.test.ts (11 tests) 12ms
 ✓ src/db/migrate-runner.test.ts (14 tests) 15ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 14ms
 ✓ src/db/migrate.test.ts (11 tests) 18ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 15ms
 ✓ src/db/pool.test.ts (10 tests) 13ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 10ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 2803ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 2867ms
 ✓ src/db/migration-006.test.ts (13 tests) 2890ms
 ✓ src/db/migration-007.test.ts (11 tests) 2646ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3193ms
 Test Files  50 passed (50)
      Tests  1907 passed (1907)
   Duration  4.32s (transform 5.11s, setup 0ms, collect 16.73s, tests 25.66s, environment 13ms, prepare 5.14s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.78 |    91.05 |   99.63 |   96.78 |
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
  ...repository.ts |    98.8 |    89.65 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.66 |     100 |   97.29 | 63-68
 src/db            |   99.24 |    96.47 |     100 |   99.24 |
  ...cle-config.ts |     100 |      100 |     100 |     100 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
  ...-bootstrap.ts |     100 |     97.5 |     100 |     100 | 181
  ...a-contract.ts |     100 |      100 |     100 |     100 |
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

Notes on the coverage run: it executes the whole backend workspace, so the parallel
T5 cleanup suites and the pre-existing real-Postgres suites also ran and passed (50
files, 1,907 tests). `schema-bootstrap.ts` is at 100 % statements/functions/lines and
97.5 % branches; the single uncovered branch is the defensive
`existingColumns.get(table) ?? new Set()` fallback, unreachable from a real catalog
(a table listed by `information_schema.tables` always reports its columns).

Acceptance audit:
- AC-3 → met. `schema-bootstrap-postgres.test.ts` "empty database" group: creation
  result/events, five tables, both `users` functional unique indexes, the 25 pinned
  column/default/NOT NULL rows plus `coins` precision 18/2, and
  `PgUserRepository.create` / `PgSessionRepository.create` /
  `PgVerificationTokenRepository.create` / raw `INSERT INTO user_economy (user_id)`
  round-trips with the exact economy defaults (`coins '0.00'`, zero bigint counters,
  `{}` JSONB, `customization_version 2`, `economy_revision '0'`).
- AC-4 → met. Unit "empty database" test: exact entry list — one
  `db_schema_bootstrap_started {tables:5}` at info, one `db_schema_table_created`
  per table at info, no `db_schema_table_present`, one
  `db_schema_bootstrap_completed {checked:5,created:5,outdated:0,durationMs:0}` at
  info with a constant injected clock; per-table `BEGIN`/DDL/`COMMIT` order pinned.
- AC-5 → met. Unit no-op test (all tables + one extra `legacy_extra` column) and
  Postgres second-run test (recording wrapper): zero DDL, exactly two `SELECT`s,
  five `db_schema_table_present` at debug in contract order, completed
  `{checked:5,created:0,outdated:0}`.
- AC-6 → met. Postgres test seeds `users`/`sessions`/`user_economy`, drops
  `verification_tokens`, then asserts one `db_schema_table_created`, present events
  for the other four, `created:['verification_tokens']`, byte-identical fixture rows
  before/after (including timestamps), and a succeeding
  `PgVerificationTokenRepository.create` with a UUID v4 id, expected expiry and
  `usedAt: null`.
- AC-7 → met. Postgres fixtures drop `users.locked_until` and then
  `failed_login_attempts,locked_until`: warn
  `db_schema_table_outdated {table:'users',missingColumns:'locked_until'}` and
  `{missingColumns:'failed_login_attempts,locked_until'}` (DDL order), `outdated:1`,
  no `ALTER`/`DROP`/`CREATE`/`UPDATE` statement recorded, and the `users` columns
  unchanged. Unit test additionally scrambles the catalog column order to prove the
  DDL order comes from `RequiredTable.columns`, not the catalog.
- AC-8 → met. Fake DB rejects the `sessions` CREATE: rejects with the same error,
  emits `db_schema_bootstrap_failed {table:'sessions',errorType:'Error'}` at error
  after rolling back, emits no `db_schema_bootstrap_completed`; a rollback failure
  does not mask the original error.
- AC-23 → met. Every event is asserted with a full `toEqual` on
  `{level, event, fields}`, so no extra field can appear; failure events carry only
  `table`, `errorType` and the optional string `code` (`42P07` fixture) or
  `errorType: 'unknown'` for a non-`Error` rejection. No message, stack, SQL text,
  identifier, token or email is logged.

Deviations from spec: none. (`db_schema_bootstrap_skipped` is intentionally not in
this module — it belongs to the startup phase, T6.)
