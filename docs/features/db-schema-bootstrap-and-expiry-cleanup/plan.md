---
feature: db-schema-bootstrap-and-expiry-cleanup
revision: 3
---
# Plan — DB Schema Bootstrap & Expired Verification Cleanup

## Architecture

Two lifecycle services inside the existing backend process, each with a pure, injectable core. The logging foundation gains one additive method; the schema contract is pinned in full and proven equivalent to `schema.sql` plus real inserts.

```text
observability/logging.ts  (T1)  LogSink/LoggerLike/createLogSink + debug(event, fields)
                                  │
server.ts (T8, composition/entrypoint)
  ├─ loadAuthConfig(env) → createPool(DATABASE_URL)
  ├─ buildApp(env, { auth: { pool } })          // Fastify + Pino + hub + routes
  ├─ createLogSink(app.log)                     // event-first sink, existing redaction/levels + debug
  ├─ loadDbLifecycleConfig(env)                 // three strict env names
  ├─ runDatabaseStartup(env, { config, log })   // BEFORE listen
  │    └─ one dedicated pg.Client (DIRECT_DATABASE_URL | direct DATABASE_URL)
  │         ├─ pg_try_advisory_lock(KEY)        // bounded wait, session-scoped
  │         ├─ runMigrations(client)            // existing numbered runner
  │         ├─ runSchemaBootstrap(client, { log })  // if DB_SCHEMA_BOOTSTRAP_ENABLED
  │         └─ pg_advisory_unlock(KEY) + end()  // finally
  ├─ app.listen({ host, port })                 // clients can now connect
  ├─ createVerificationCleanupScheduler({ repository: PgVerificationTokenRepository(pool), intervalMs, log })
  │    └─ start()                               // immediate run, then setTimeout chain after settle
  └─ installShutdownHandlers({ app, metrics, log, beforeClose: () => cleanup.stop() })
```

- **State ownership.** Neon owns the durable schema and auth rows; the backend process owns the cleanup timer and the advisory-lock session. No game/room state moves to Postgres. The schema bootstrap does not own schema evolution: the existing numbered migration runner remains the authority; the bootstrap is a post-migration presence check/repair and a log trace.
- **Logging foundation.** `LogSink`/`LoggerLike` gain `debug`; `createLogSink` maps it to `logger.debug(fields, event)`. The existing `info`/`warn`/`error` behavior, redaction, serializers and event names are untouched. This is a partial supersession of `runtime-observability` AC-3, recorded in `spec.md`; T1 owns `logging.ts`, `logging.test.ts` and the two existing `LogSink` doubles (`game/hub.test.ts`, `observability/shutdown.test.ts`). The debug rows stay debug; production's default `info` shows created/outdated/summary/failure lines, while development (`debug`) shows per-table present and zero-delete runs.
- **Startup ordering.** Build app → load lifecycle config → `runDatabaseStartup` → `listen` → start cleanup → install shutdown handlers. Building the app first gives the startup phase the real Pino logger (and its redaction/serializers) without a second logging configuration. A startup failure is logged through that logger, the app is closed (which closes the pool and hub), and the process exits `1`; `listen` is never called, so no client can join a schema-incomplete DB.
- **Why one client for migrations + bootstrap.** The migration runner already requires a dedicated `pg.Client` on the direct URL so `BEGIN`/statements/`COMMIT` share one connection and bypass PgBouncer transaction pooling. The startup phase reuses that pattern and holds one session-level advisory lock across both steps, so concurrent instance starts serialize the DDL phase and the lock auto-releases on `end()`/disconnect. The fallback `DATABASE_URL` must be a direct/session-capable URL; on Neon, `DIRECT_DATABASE_URL` is set and wins (Q-5).
- **Cleanup ownership.** The scheduler is constructed in `server.ts` over the same pool through a fresh `PgVerificationTokenRepository` (stateless; the auth service has its own instance over the same pool). It starts only after `listen`, so cleanup work never delays readiness. `beforeClose` stops it before `app.close()` closes the pool, preventing queries against an ended pool.
- **No new deployable.** Both services are modules in `src/backend`; no compose service, Dockerfile stage, image, port, route, provider command or workflow step is added. This preserves the one-free-Render-service topology and the local `podman compose up` contract.

### Bootstrap algorithm

1. Resolve the contract (`REQUIRED_TABLES`, in dependency order) and start the clock; emit `db_schema_bootstrap_started { tables }`.
2. Query `information_schema.tables` for the five names in `public`; query `information_schema.columns` for those names. Both queries bind the constant name array as `$1::text[]` and order deterministically.
3. For each missing table (contract order): `BEGIN`; execute the table's creation statements (table + its indexes) in order; `COMMIT`; emit `db_schema_table_created`. On error: best-effort `ROLLBACK`, emit `db_schema_bootstrap_failed { table, errorType, code? }`, rethrow.
4. For each existing table: compare `information_schema.columns` to the contract's required columns. If every column is present, emit `db_schema_table_present` at `debug`. If any are missing, emit `db_schema_table_outdated { table, missingColumns }` at `warn` with `missingColumns` comma-joined in the normative DDL order (the `RequiredTable.columns` order, not alphabetical); never issue `ALTER`/`DROP`.
5. Emit `db_schema_bootstrap_completed { checked, created, outdated, durationMs }` and return `{ checked, created, outdated, durationMs }`. "checked" is the contract length; "created" is the number of tables created; "outdated" is the number of pre-existing tables with at least one missing required column.

The no-op case is a **second `runSchemaBootstrap` run** on the complete schema (AC-5), not a second full startup: a full startup always executes the migration runner's `CREATE TABLE IF NOT EXISTS schema_migrations` before reading the ledger, so only the standalone bootstrap repeat can assert zero DDL.

The contract DDL is the normative block in `spec.md` § Required schema contract (verbatim `schema.sql` after migration 007), so a table created by the bootstrap is immediately usable; migration 006's legacy-data rewrite is irrelevant to a freshly created empty table. The real-Postgres proof includes a repository-insert round-trip after the bootstrap (and after dropping/recreating `verification_tokens`) to catch a missing `DEFAULT gen_random_uuid()` or a wrong NOT NULL/default.

### Startup algorithm

1. `resolveStartupMigrationUrl(env)` (existing helper): `DIRECT_DATABASE_URL`, else `DATABASE_URL`, else `null`.
2. `null` → emit `db_schema_bootstrap_skipped { reason: 'no_database' }` at `debug`, return `{ skipped: true, applied: [], bootstrap: null }` without creating a client.
3. Create one client; `connect()`; wrap failures as `DatabaseStartupError('connect', cause)`.
4. Acquire the lock with `pg_try_advisory_lock($1::bigint)` every 250 ms until acquired or the 30,000 ms budget expires. Emit `db_startup_lock_wait { waitedMs }` at `debug` on retries and `db_startup_lock_acquired { waitedMs }` at `debug` on success. Timeout/throws → `DatabaseStartupError('lock', cause)`.
5. `runMigrations(client, { migrations?, migrationsDir? })`; emit `db_migrations_applied { count }` at `info` when non-empty, otherwise `db_migrations_up_to_date` at `debug`. Failure → `DatabaseStartupError('migrations', cause)`.
6. If `config.bootstrapEnabled`: `runSchemaBootstrap(client, { log })`; failure → `DatabaseStartupError('bootstrap', cause)`. Else emit `db_schema_bootstrap_skipped { reason: 'disabled' }` at `info` and set `bootstrap: null`.
7. Emit `db_startup_completed { migrated, created, outdated, durationMs }` at `info`.
8. `finally`: best-effort `pg_advisory_unlock` when acquired, then `client.end()`; close errors never mask the result/failure.

The startup-owned events are an acceptance criterion of their own (AC-13): `db_startup_lock_wait`, `db_startup_lock_acquired`, `db_migrations_applied`/`db_migrations_up_to_date`, and `db_startup_completed`, with exact fields and levels; the bootstrap's `started`/`completed` summary appears in the same sequence.

### Cleanup algorithm

`createVerificationCleanupScheduler` uses a recursive `setTimeout` (not `setInterval`), scheduled **after** a run settles, so the timer cannot fire while a run is pending. The in-flight guard still protects direct `runOnce()` calls and duplicate `start()` calls.

1. `start()`: idempotent; set `started`, emit `db_verification_cleanup_started { intervalMs }` at `info`, schedule `runOnce()` at 0 ms. Timer handles are `unref()`ed when the runtime supports it.
2. `runOnce()`: if not started (when invoked by a timer) or a run is in flight, emit `db_verification_cleanup_skipped { reason: 'in_flight' }` at `debug` and return `0`. Otherwise call `repository.deleteExpired(now())`, measure `durationMs`, emit `db_verification_cleanup_run { deleted, durationMs }` at `info` when `deleted > 0` and `debug` when `0`.
3. On rejection: emit `db_verification_cleanup_failed { errorType, code? }` at `error`, resolve `0`, and still schedule the next run.
4. Schedule the next run `intervalMs` after the current run settles (including failures). A run taking D ms shifts the following tick by D; AC-15 asserts the immediately-resolving case at 0, `intervalMs`, `2 × intervalMs`.
5. `stop()`: idempotent; clear the pending timer, set `started = false`, await the in-flight promise, emit `db_verification_cleanup_stopped` at `info` once if a start was active. No run is scheduled or started after `stop()` resolves.

### Server wiring

```text
startServer(env, { exit? }):
  authConfig = loadAuthConfig(env)
  pool = createPool(authConfig.databaseUrl)
  dbConfig = loadDbLifecycleConfig(env)
  app = buildApp({ ...env, NODE_ENV: env.NODE_ENV ?? 'development' }, pool ? { auth: { pool } } : {})
  log = createLogSink(app.log)
  result = await runDatabaseStartup(env, { config: dbConfig, log })
  on failure:
    log.error('db_startup_failed', { stage: error.stage, errorType: error.errorType, ...(error.code ? { code: error.code } : {}) })
    await app.close().catch(() => undefined)
    exit(1)
    return { started: false, app, cleanup: null }
  await app.listen({ host: HOST, port: PORT })
  cleanup = pool === null
    ? log.debug('db_verification_cleanup_skipped', { reason: 'no_database' }) / null
    : dbConfig.cleanupEnabled
      ? createVerificationCleanupScheduler({ repository: new PgVerificationTokenRepository(pool), intervalMs, log }); cleanup.start()
      : log.info('db_verification_cleanup_skipped', { reason: 'disabled' }) / null
  installShutdownHandlers({ app, metrics: app.metrics, log, beforeClose: () => cleanup?.stop() })
  return { started: true, app, cleanup }
```

`server.ts` keeps a direct-invocation guard (`import.meta.url === pathToFileURL(process.argv[1]).href`) so `server.test.ts` can import `startServer` without starting a server. The existing `console.log` listening line may stay; the DB lifecycle events use Pino. `server.ts` remains under the pre-existing composition-root coverage exclusion (`src/backend/vitest.config.ts`, `testing-criteria`); `server.test.ts` asserts every wiring/failure/skip path, but its coverage is behavioral, not counted.

## Interfaces / contracts

### Logging extension

```ts
export type LogFields = Record<string, string | number | boolean>; // existing, unchanged

export interface LogSink {
  debug(event: string, fields: LogFields): void; // NEW, additive
  info(event: string, fields: LogFields): void;
  warn(event: string, fields: LogFields): void;
  error(event: string, fields: LogFields): void;
}

export interface LoggerLike {
  debug(fields: object, event: string): void; // NEW
  info(fields: object, event: string): void;
  warn(fields: object, event: string): void;
  error(fields: object, event: string): void;
}

export function createLogSink(logger: LoggerLike): LogSink;
```

- The two existing `LogSink` doubles must add `debug` (T1 owns both files): `game/hub.test.ts:4779-4797` `LogRecorder` and `observability/shutdown.test.ts:18-28` `createLogRecorder`.
- No redaction path, serializer, level resolution or existing event name changes. `runtime-observability` AC-3 is partially superseded in `spec.md`.

### Schema contract

```ts
export interface RequiredTable {
  readonly name: string;
  /** Normative DDL order; `missingColumns` preserves this order. */
  readonly columns: readonly string[];
  /** Idempotent statements executed in order inside one transaction. */
  readonly statements: readonly string[];
}

export const REQUIRED_TABLES: readonly RequiredTable[]; // users, sessions, verification_tokens, user_economy, schema_migrations
```

- `statements` are the normative DDL in `spec.md` § Required schema contract split per table; every statement begins `CREATE TABLE IF NOT EXISTS` or `CREATE [UNIQUE] INDEX IF NOT EXISTS`.
- No runtime file loading: the contract is compiled TypeScript, so no Dockerfile copy is needed and the builder cannot forget to package a `.sql` file.
- `schema-contract.test.ts` checks the two-way table/column/migration coverage and pinned defaults/constraints; `schema-contract-postgres.test.ts` applies `schema.sql` and the contract DDL into two separate schemas and compares normalized catalog metadata (columns/type/nullability/default, PK/FK/unique, indexes). That is AC-2's equivalence proof.

### Bootstrap

```ts
export interface SchemaBootstrapDb {
  query(text: string, values?: unknown[]): Promise<{
    rows: Array<Record<string, unknown>>;
    rowCount?: number | null;
  }>;
}

export interface SchemaBootstrapOptions {
  log?: LogSink;
  tables?: readonly RequiredTable[]; // test seam; defaults to REQUIRED_TABLES
  now?: () => number;                // test seam; defaults to Date.now
}

export interface OutdatedTable {
  table: string;
  missingColumns: readonly string[];
}

export interface SchemaBootstrapResult {
  checked: number;
  created: readonly string[];
  outdated: readonly OutdatedTable[];
  durationMs: number;
}

export function runSchemaBootstrap(
  db: SchemaBootstrapDb,
  options?: SchemaBootstrapOptions,
): Promise<SchemaBootstrapResult>;
```

The unit test uses a fake `SchemaBootstrapDb`; the real-Postgres suite uses the real client wrapped in a recorder and then runs `PgUserRepository.create`, `PgSessionRepository.create`, `PgVerificationTokenRepository.create` and a raw `INSERT INTO user_economy (user_id)` to prove the defaults.

### Lifecycle configuration

```ts
export const DEFAULT_CLEANUP_INTERVAL_MS = 3_600_000;
export const MIN_CLEANUP_INTERVAL_MS = 60_000;
export const MAX_CLEANUP_INTERVAL_MS = 86_400_000;

export interface DbLifecycleConfig {
  bootstrapEnabled: boolean;
  cleanupEnabled: boolean;
  cleanupIntervalMs: number;
}

export function loadDbLifecycleConfig(
  env: Record<string, string | undefined>,
): DbLifecycleConfig;
```

Env names: `DB_SCHEMA_BOOTSTRAP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS`. Booleans accept exactly `true|false|1|0`; empty/invalid values throw an `Error` naming the variable (matching `METRICS_ENABLED`). The interval accepts a base-10 integer in `[60000, 86400000]`; empty/invalid values throw naming the variable.

### Startup phase

```ts
export const STARTUP_ADVISORY_LOCK_KEY = 7_284_571_001;
export const STARTUP_LOCK_TIMEOUT_MS = 30_000;
export const STARTUP_LOCK_RETRY_MS = 250;

export type DatabaseStartupStage = 'connect' | 'lock' | 'migrations' | 'bootstrap';

export class DatabaseStartupError extends Error {
  readonly stage: DatabaseStartupStage;
  /** `cause.name` (or `'unknown'`), so the caller can log the actionable type. */
  readonly errorType: string;
  /** `cause.code` only when it is a string. */
  readonly code?: string;
  constructor(stage: DatabaseStartupStage, cause: unknown);
}

export interface DatabaseStartupDeps {
  config?: DbLifecycleConfig;
  log?: LogSink;
  createClient?: (connectionString: string) => MigrationClient;
  migrations?: MigrationFile[];
  migrationsDir?: string;
  lockTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type DatabaseStartupResult =
  | { skipped: true; applied: readonly []; bootstrap: null }
  | { skipped: false; applied: readonly string[]; bootstrap: SchemaBootstrapResult | null };

export function runDatabaseStartup(
  env: Record<string, string | undefined>,
  deps?: DatabaseStartupDeps,
): Promise<DatabaseStartupResult>;
```

`MigrationClient` stays in `db/migrate-runner.ts` (`connect`, `query`, `end`). `runStartupMigrations` is **kept intact through T6** (so `server.ts` still typechecks) and is removed by **T8** in the same change that rewires `server.ts` to `runDatabaseStartup`; T8 owns `migrate-runner.ts` and `migrate-runner.test.ts` and drops the old helper's tests then. The partial supersession of `vercel-fly-neon-deployment` AC-10 is recorded in `spec.md` § Supersessions of accepted behaviors. `resolveStartupMigrationUrl` and `resolveMigrationUrl` stay (the CLI still uses the latter) and their tests stay. The fallback URL caveat is documented in the spec (Q-5), not enforced by hostname sniffing.

### Cleanup scheduler

```ts
export interface VerificationCleanupScheduler {
  start(): void;
  stop(): Promise<void>;
  runOnce(): Promise<number>;
}

export interface VerificationCleanupOptions {
  repository: Pick<VerificationTokenRepository, 'deleteExpired'>;
  intervalMs: number;
  log: LogSink;
  now?: () => number;
  timers?: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
}

export function createVerificationCleanupScheduler(
  options: VerificationCleanupOptions,
): VerificationCleanupScheduler;
```

The scheduler calls the existing `deleteExpired(nowMs)` (SQL: `DELETE FROM verification_tokens WHERE expires_at <= $1`) and does not add a repository method. The next timer is scheduled after the current run settles; `runOnce()` is the public seam the overlap test uses directly.

### Shutdown and server

```ts
export interface InstallShutdownHandlersOptions {
  app: ShutdownApp;
  metrics: Metrics;
  log: LogSink;
  beforeClose?: () => void | Promise<void>; // NEW; awaited before app.close()
  process?: ShutdownProcess;
  signals?: readonly ShutdownSignal[];
}
```

```ts
export interface StartServerDeps {
  exit?: (code: number) => void; // test seam; defaults to process.exit
}

export type StartServerResult =
  | { started: true; app: FastifyInstance; cleanup: VerificationCleanupScheduler | null }
  | { started: false; app: FastifyInstance; cleanup: null };

export function startServer(
  env: NodeJS.ProcessEnv,
  deps?: StartServerDeps,
): Promise<StartServerResult>;
```

### SQL used

```sql
-- advisory lock (dedicated direct client, session-scoped)
SELECT pg_try_advisory_lock($1::bigint) AS locked
SELECT pg_advisory_unlock($1::bigint)

-- presence checks (constant name array bound as one text[] parameter)
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name = ANY($1::text[])
 ORDER BY table_name

SELECT table_name, column_name
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = ANY($1::text[])
 ORDER BY table_name, column_name

-- cleanup (existing repository method, parameterized instant)
DELETE FROM verification_tokens WHERE expires_at <= $1
```

## File inventory

| Path | New/Edit | Owner / purpose |
| --- | --- | --- |
| `src/backend/src/observability/logging.ts` | Edit | T1: add `debug` to `LogSink`/`LoggerLike`/`createLogSink`; no other change. |
| `src/backend/src/observability/logging.test.ts` | Edit | T1: debug adapter mapping/level 20, existing three methods unchanged. |
| `src/backend/src/game/hub.test.ts` | Edit | T1: `LogRecorder` implements `debug`; existing tests unchanged. |
| `src/backend/src/observability/shutdown.test.ts` | Edit | T1: recorder implements `debug`; existing shutdown tests unchanged. |
| `src/backend/src/db/schema-contract.ts` | New | T2: `RequiredTable`, `REQUIRED_TABLES`, normative DDL for the five tables and the two users indexes. |
| `src/backend/src/db/schema-contract.test.ts` | New | T2: two-way contract ↔ migrations/`schema.sql` drift test; pinned defaults/constraints; DDL shape. |
| `src/backend/src/db/schema-contract-postgres.test.ts` | New | T2: normalized catalog equivalence between `schema.sql` and the contract DDL in two schemas. |
| `src/backend/src/db/schema-bootstrap.ts` | New | T4: catalog check, create-missing, outdated detection, per-table/summary logs. |
| `src/backend/src/db/schema-bootstrap.test.ts` | New | T4: fake-database unit tests (events, failure, no-op, outdated, clock). |
| `src/backend/src/db/schema-bootstrap-postgres.test.ts` | New | T4: empty schema + repository inserts, re-run, single-table recreation + token insert, outdated column. |
| `src/backend/src/db/lifecycle-config.ts` | New | T3: strict parsing of the three lifecycle env names. |
| `src/backend/src/db/lifecycle-config.test.ts` | New | T3: defaults, boolean forms, interval bounds, empty strings, exact errors. |
| `src/backend/src/db/startup.ts` | New | T6: `runDatabaseStartup`, advisory lock, migration + bootstrap orchestration, `DatabaseStartupError`. |
| `src/backend/src/db/startup.test.ts` | New | T6: URL precedence, statement order, lock timeout, skip/disable, stages, startup trace events, client cleanup. |
| `src/backend/src/db/migrate-runner.ts` | Edit | T8: remove `runStartupMigrations` in the same change that rewires `server.ts`; keep `resolveStartupMigrationUrl`, `resolveMigrationUrl`, `runMigrationsAgainst`. |
| `src/backend/src/db/migrate-runner.test.ts` | Edit | T8: drop the `runStartupMigrations` cases; URL/no-database behavior remains covered by `startup.test.ts`, and the runner/CLI-adjacent coverage stays. |
| `src/backend/src/db/verification-cleanup.ts` | New | T5: scheduler: immediate + recursive timeout after settle, overlap guard, failure isolation, stop. |
| `src/backend/src/db/verification-cleanup.test.ts` | New | T5: fake timers/clock/repository: schedule, events, direct-runOnce overlap, failure, stop, idempotence. |
| `src/backend/src/db/verification-cleanup-postgres.test.ts` | New | T5: real-Postgres expired-only deletion, account/session preservation, concurrent idempotence. |
| `src/backend/src/observability/shutdown.ts` | Edit | T7: optional awaited `beforeClose` before `app.close()`. |
| `src/backend/src/observability/shutdown-before-close.test.ts` | New | T7: `beforeClose` ordering/rejection; existing behavior stays in T1-owned `shutdown.test.ts`. |
| `src/backend/src/server.ts` | Edit | T8: build app first; run startup with app logger; fail-fast close/exit; start cleanup after listen; `beforeClose`; direct-invocation guard + `startServer` export; remove the old `runStartupMigrations` import/call atomically with the `migrate-runner` edit. |
| `src/backend/src/server.test.ts` | New | T8: module-mocked wiring/order, no-database → listen, lock-stage error → no listen, bootstrap-stage failure → no listen/exit, cleanup skip/start, shutdown wiring, return value. |
| `compose.yaml` | Edit | T9: three backend env pass-throughs with safe defaults; no service/port/volume/healthcheck change. |
| `render.yaml` | Edit | T9: three committed non-secret values on the one service. |
| `README.md` | Edit | T10: configuration table (three names/defaults) and Operations log-event guidance. |
| `docs/architecture/observability.md` | Edit | T10: new event/field/level rows, `LogSink.debug`, catalog stays at 30, no new metric. |
| `docs/architecture/deployment.md` | Edit | T10: migrations → bootstrap → listen, advisory lock, direct URL, fail-fast, in-process cleanup, Render downtime wording reconciliation. |
| `docs/architecture/vercel-render-neon.md` | Edit | T10: Render env defaults; troubleshooting log events; Neon contract note; downtime wording reconciliation. |
| `docs/architecture/containerization.md` | Edit | T10: three compose pass-throughs; no new service/image/port; WS/health unchanged. |
| `docs/features/README.md` | Orchestrator-owned | Builder proposes only this feature's row diff in the build log; never edits the file. |
| `src/backend/src/app.ts`, `src/backend/src/observability/metrics.ts`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`, `.github/workflows/deploy.yml` | Unchanged | No route/metric/image/workflow change; proven by `git diff --exit-code` in T11. |

## Key decisions

| # | Decision | Rationale | Alternatives |
| --- | --- | --- | --- |
| 1 | In-process startup bootstrap + in-process cleanup scheduler (D1) | Existing startup seam, one free Render service, identical local/cloud path | One-shot job, separate service, Render pre-deploy |
| 2 | Typed in-repo contract with the full normative DDL; no migration framework (D2) | No dependency; migrations remain the only evolution authority; packaged by `tsc`; full DDL prevents the missing-default class of bug | `node-pg-migrate`, runtime SQL parsing, column-name-only contract |
| 3 | Create missing tables; warn on missing columns; never alter (D3) | Honest "required tables" scope; no second schema authority; no unsafe backfills | Auto-`ALTER`, create-only silence |
| 4 | One dedicated client + advisory lock across migrations and bootstrap (D4) | Safe concurrent starts; direct connection avoids PgBouncer; lock auto-releases | `IF NOT EXISTS` alone, pooled fallback |
| 5 | Fail-fast on connect/lock/migration/create; warn on drift; non-fatal cleanup (D5) | Never serve a schema-incomplete DB; keep the request path unaffected | Warn on all, fail on drift |
| 6 | Per-table transaction for creation statements | Table + indexes are atomic; a failure leaves earlier created tables committed and re-runnable | One global transaction (all-or-nothing, larger lock window) |
| 7 | Recursive `setTimeout` scheduled after settlement + in-flight guard + `unref` (D7) | No timer overlap; cadence drift bounded by run duration; guard covers direct `runOnce()`/duplicate `start()` | `setInterval`, fixed-rate scheduling without a guard |
| 8 | Delete only `expires_at <= now`; no user/session changes (D8) | Matches request; expired tokens already unusable; resend remains | Delete used tokens, cascade account state |
| 9 | Existing `deleteExpired(now)` instead of a new DB-clock method (D9) | No interface churn; TTL makes skew immaterial | New `DELETE ... now()` method |
| 10 | New `db/lifecycle-config.ts` (D10) | Strict parsing consistent with `METRICS_ENABLED`; separate from auth config | Extend `AuthConfig` |
| 11 | Build app before startup to reuse `app.log` (D11) | Same Pino level/redaction/serializers; one logging path | `console.error`, temporary logger |
| 12 | Logs only, no metric/route/workflow change (D12) | Keeps the fixed 30-metric catalog and the public surface; request asks for logs | New counters, diagnostics route |
| 13 | Bind the table-name array as `$1::text[]`; statements are constants | Parameterized catalog queries; no user input; no SQL text logged | String interpolation (rejected) |
| 14 | `beforeClose` hook in shutdown instead of stopping cleanup after `close()` | Guarantees the scheduler stops before the pool ends; testable ordering | Separate signal handler, timer `unref` alone (does not prevent post-close queries) |
| 15 | Module-mocked `server.test.ts` for wiring; `server.ts` stays composition-excluded | `server.ts` is coverage-excluded by the pre-existing `testing-criteria` policy; behavior still needs an order/exits test | Removing the exclusion (project-wide policy change), leaving wiring untested |
| 16 | Additive `debug` on `LogSink`/`LoggerLike`/`createLogSink`; owning task updates the two doubles (F1) | Keeps per-table/zero-delete runs at debug instead of noisy info; smallest sink extension; explicit partial supersession of `runtime-observability` AC-3 | Promote all events to info (noisy, loses detail); optional `debug?` (silently drops events); second logging path (duplicates redaction) |
| 17 | Full DDL contract + catalog-equivalence test + repository-insert proofs (F2) | A recreated table missing `DEFAULT gen_random_uuid()`/NOT NULL would pass column-name checks and fail real inserts; the equivalence test pins types/defaults/constraints | Column-name-only contract (the r1 gap); parser-only test (fragile) |
| 18 | Startup fallback must be a direct/session-capable URL; no hostname sniffing (F12/Q-5) | Neon sets both URLs and direct wins; local compose is direct; a pooled-only deployment is unsupported for the lock/DDL phase | Provider-specific `-pooler` hostname detection (fragile); requiring `DIRECT_DATABASE_URL` always (breaks local direct fallback) |
| 19 | Existing-table index/constraint drift is not detected (F9/D13) | Keeps D3's honest scope; migrations/CI are the repair path | Warn-only index check (extra scope); auto-`CREATE INDEX` (second authority) |
| 20 | `.env*` is a stated manual boundary, not a git check (F4) | `.env*` is gitignored, so `git status` cannot prove untouched ignored files; every task is forbidden to edit them | A fake/vacuous git check |
| 21 | Keep `runStartupMigrations` through T6; T8 removes it atomically with the server rewire (R2-F1) | `server.ts` still imports the helper, so removing the export in T6 would fail root `typecheck` while only T8 may edit `server.ts`; T8 owns both `migrate-runner.*` and `server.*` and runs root `typecheck` | Removing it in T6 and moving `server.ts` into T6 (changes the task split); a delegating wrapper (would create a `migrate-runner`↔`startup` import cycle) |

## Risks & mitigations

- **Contract drifts from migrations** → `schema-contract.test.ts` parses every migration and `schema.sql` in both directions; `schema-contract-postgres.test.ts` compares normalized catalog metadata; any schema change must update the contract in the same commit.
- **A recreated table lacks a required default/NOT NULL** → AC-2 compares the full DDL/catalog against `schema.sql`; AC-3 and AC-6 include repository-insert round-trips after bootstrap and after recreation; the three `id DEFAULT gen_random_uuid()` columns and the NOT NULL/default set are pinned in the spec table.
- **Runtime role lacks DDL** → fail-fast with `db_startup_failed { stage: 'bootstrap' }`; documented `DB_SCHEMA_BOOTSTRAP_ENABLED=false` escape hatch and Q-2; the CI migration remains the primary path.
- **Pooled fallback URL** → documented in Security/Q-5; Neon sets `DIRECT_DATABASE_URL` and the direct URL wins; local compose is direct. No hostname sniffing.
- **Concurrent instance starts race on DDL** → session advisory lock across migrations + bootstrap; per-table transactions; idempotent statements; the pinned single-instance topology is unchanged.
- **A dropped table is recreated empty (data loss)** → creation is logged loudly; this repair restores the schema, not data; Neon PITR/branch restore is the documented recovery path for data. The bootstrap never drops or rewrites rows.
- **Outdated columns are not repaired** → warn with the exact `missingColumns`; migrations are the repair path; the run continues so `/healthz` and unrelated features stay available.
- **Existing-table index/constraint drift is invisible** → explicit non-goal/limitation (D13); the migrations/CI are the repair path. A future warn-only index check is a separate feature.
- **Startup waits on a stuck advisory lock** → 30 s cap; `DatabaseStartupError('lock')`; process exits and the deploy health poll fails visibly.
- **Cleanup table scan** → one bounded `DELETE` per hour at the current development scale; `expires_at` has no index by design (non-goal); add a migration later if volume justifies it.
- **Render free spin-down misses runs** → best-effort schedule; the immediate run on restart catches up; no durable missed-run accounting is claimed.
- **Cleanup overlaps or outlives the pool** → timer scheduled after settlement + in-flight guard for direct calls; `stop()` awaited through `beforeClose` before `app.close()`.
- **Logs leak secrets or SQL** → `LogSink` fields are constants/counts; error helper emits `errorType`/`code` only; existing Pino redaction; AC-23 exact-field tests + T11 source audit.
- **`debug` extension breaks a sink double** → T1 owns `logging.ts`, `logging.test.ts`, `hub.test.ts` and `shutdown.test.ts`; typecheck + those tests gate the change; no other task edits those files.
- **Server startup failure leaves resources open** → `startServer` closes the app (hub + pool) before `exit(1)`; `runDatabaseStartup` always ends its client.
- **Real-Postgres suites skip silently** → the skip is the established `migration-006/007` pattern; unit tests still cover the logic; CI's Ubuntu docker runtime executes the DB suites; the build log records whether they ran.
- **`app.close()` before `listen`** → tested in `server.test.ts`; Fastify tolerates closing a not-yet-listened instance; any close failure is swallowed before exit so it cannot mask the startup error.
- **Coverage exclusion hides `startServer`** → explicit D14/AC-27 wording; `server.test.ts` asserts every failure/skip path; if the logic grows, move it to a covered module.
- **Compose change accidentally adds a service/port** → AC-25/T9 machine-check the exact service set and the backend `ports`/`volumes`/`depends_on`/absence of `healthcheck`, plus the smoke run.
- **Docs overclaim or drift** → AC-26/T10 greps every variable and key event, runs the docs link test, reconciles the Render downtime wording, and leaves `docs/features/README.md` to the orchestrator.
- **A future schema adds a table** → AC-2 fails until the contract is updated; the failure is intentional and caught in CI.
- **Removing `runStartupMigrations` before rewiring `server.ts` breaks typecheck** → T6 keeps the helper and its tests intact; T8 owns `migrate-runner.ts`/`migrate-runner.test.ts` and `server.ts`, removes the import/call and the export in one change, and runs root `npm run typecheck` plus the migrate-runner/migrate-cli tests.

## Open questions

See `spec.md` § Open questions (Q-1…Q-5, all non-blocking). The implementation defaults are encoded in `lifecycle-config.ts` and the advisory-lock constants; changing the cleanup cadence or disabling bootstrap is an environment change, not a code change. Q-5 records the direct/session-capable startup URL requirement; the runner does not sniff provider hostnames.

## Revision history

- r1 — 2026-11-24 — initial plan: in-process startup phase (dedicated client + advisory lock + migrations + bootstrap), typed schema contract, structured log contract, post-listen cleanup scheduler with overlap/shutdown semantics, server wiring, container/doc/config surface.
- r2 — 2026-11-24 — spec review r1: `debug` sink extension with explicit ownership of `logging.ts`/`logging.test.ts` and both existing doubles; full normative DDL + catalog-equivalence + repository-insert proofs; new startup-trace AC and task coverage; cleanup cadence stated after-settle with the direct-`runOnce()` overlap test; shutdown and server wiring split; container AC now includes the stack smoke and service/port/volume/healthcheck checks; coverage exclusion, index-drift limitation, pooled-fallback caveat, empty-string config cases, docs greps and `.env*` manual boundary recorded; task graph renumbered to 11 tasks with the config→container edge (T3→T9) included in the overview.
- r3 — 2026-11-24 — spec review r2 (mechanical): `runStartupMigrations` kept through T6 and removed by T8 atomically with the `server.ts` rewire (T8 owns `migrate-runner.ts`/test, runs root typecheck + those tests); T8 explicitly accepts AC-10/AC-11 with the no-database → listen and lock-stage → no-listen server assertions; `missingColumns` pinned to the normative DDL order with a two-column AC-7 fixture; AC-5 is a second `runSchemaBootstrap`; AC-25 gets the 18-key environment allow-list plus diff-review evidence; AC-26 gets a five-doc link script and README default assertions. No AC renumbering.
