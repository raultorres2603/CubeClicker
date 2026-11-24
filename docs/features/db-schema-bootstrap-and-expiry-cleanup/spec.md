---
feature: db-schema-bootstrap-and-expiry-cleanup
revision: 3
status: draft
created: 2026-11-24
updated: 2026-11-24
---
# Spec — DB Schema Bootstrap & Expired Verification Cleanup

## Summary

CubeClicker already applies numbered SQL migrations at backend startup (`src/backend/src/server.ts` runs `runStartupMigrations` before `listen`) and CI applies them against Neon before a Render deploy, but nothing verifies that the required tables actually exist after that phase, creates a table that is missing while the migration ledger claims otherwise, or records what happened. Separately, `verification_tokens` rows with `expires_at` in the past are never removed: `PgVerificationTokenRepository.deleteExpired` exists and is tested, but no scheduler calls it, so the table grows for every expired verification link.

This feature adds two in-process database lifecycle services to the existing backend process — no new deployable:

1. **Schema bootstrap.** After the migration phase and before the server listens, a dedicated direct-URL connection (the same kind the migration runner already uses) acquires a Postgres advisory lock, checks the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`) against `information_schema`, creates any missing table and its indexes with idempotent `CREATE ... IF NOT EXISTS` DDL, detects required columns missing from an existing table without altering it, and emits one structured log event per check/creation plus a summary. A failure fails startup; an outdated shape is reported and does not block startup.
2. **Expired verification cleanup.** After the server listens, an in-process scheduler deletes only `verification_tokens` rows whose `expires_at <= now` once immediately and then at a configurable interval (default one hour), with one structured log event per run, non-fatal failures, an in-flight overlap guard, and a stop-before-pool-close shutdown path.

Both services log through the existing Fastify/Pino `LogSink`, extended additively with a `debug` method so the per-table/per-run diagnostics do not have to be promoted to `info` (a partial supersession of runtime-observability AC-3, recorded below). The schema contract pins the complete DDL for all five tables and is proven equivalent to the consolidated `schema.sql` plus a post-bootstrap repository-insert round-trip, so a recreated table cannot silently lack `DEFAULT gen_random_uuid()` or the NOT NULL/default set the application relies on. No new dependency, table, column, HTTP route, metric series, container, port, image, or deploy-pipeline step is added; the runtime observability catalog stays at exactly 30 metrics.

The raw request: "When we deploy this project, for example, on Neon, we should add a service that checks if the required tables for this project are created on our PostgreSQL database. If the tables are not created, we should be able to create them automatically. With some logging aswell in order to see the traces. ... Also, for accounts that link for verification are expired, we should add a new service that removes the entries on DB that are expired."

## Context and current state (grounding)

- `src/backend/src/server.ts:11-24` runs `runStartupMigrations(process.env)` on a dedicated `pg.Client` before `buildApp`/`listen`, and aborts startup on failure. `src/backend/src/db/migrate.ts:60-105` applies numbered `.sql` files in lexicographic order, records them in `schema_migrations`, and skips already-recorded names.
- The durable schema is migrations `001_init.sql` … `007_economy_revision.sql` plus the consolidated `src/backend/src/db/schema.sql`: `users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`. The accumulation includes additive columns from migrations 002–007 (economy counters, upgrades, idle accrual, lootboxes/keys/parts/appearance, `customization_version`, `economy_revision`).
- `src/backend/src/auth/verification-token-repository.ts:265-272` implements `PgVerificationTokenRepository.deleteExpired(nowMs)` as `DELETE FROM verification_tokens WHERE expires_at <= $1`; `grep` shows no production caller — only its own unit tests. Verification tokens are issued with a 24 h TTL (`src/backend/src/auth/config.ts:54-56`), consumed only when unused and unexpired (`consume` rejects `usedAt !== null` and `expiresAt <= now`), and a resend issues a new token and invalidates the previous one (user-authentication AC-5/AC-6).
- `src/backend/src/observability/logging.ts:53-82` defines the event-first `LogSink` with only `info`/`warn`/`error`, and `createLogSink` maps exactly those three. `src/backend/src/observability/shutdown.ts:56-95` closes the app once on `SIGTERM`/`SIGINT`. There is no startup-phase logger before `buildApp` and no cleanup hook before `app.close()`. The `LogSink` doubles in `src/backend/src/game/hub.test.ts:4779-4797` and `src/backend/src/observability/shutdown.test.ts:18-28` implement the same three methods.
- The runtime observability catalog is fixed at exactly 30 metrics (`src/backend/src/observability/metrics.ts`, `docs/architecture/observability.md`); log lines must not contain SQL text, query parameters, bodies, cookies, emails, tokens or error messages/stacks. `LOG_LEVEL` may be `debug`; production defaults to `info`, development to `debug`.
- `docs/architecture/vercel-render-neon.md:27-35` pins one Render free Docker web service (750 h/month shared budget, 15-minute idle spin-down, 30–60 s cold start) and describes Render's old/new deploy overlap. `docs/architecture/deployment.md:95` separately says the application is **not** zero-downtime for clients (every restart closes WebSockets and resets in-memory rooms). The advisory-lock design is safe under either wording; T10 reconciles the two documents.
- On Neon, `DATABASE_URL` is the pooled `-pooler` URL and `DIRECT_DATABASE_URL` is the direct URL used by migrations on a dedicated `pg.Client` (never a `pg.Pool` through PgBouncer). Local compose sets only `DATABASE_URL`, which points directly at the compose Postgres.

## Decisions

These resolve the open design questions up front; the acceptance criteria encode them.

| # | Decision | Rationale | Alternatives considered (rejected) |
| --- | --- | --- | --- |
| D1 | **Bootstrap runs in the backend startup phase**, after migrations and before `listen`, in the existing process. Cleanup also runs in that process (after `listen`). No one-shot job, no separate Render service, no Render pre-deploy command. | Reuses the existing startup migration seam; works identically under `podman compose up`, host-only runs and Render; keeps one free Render service (a second always-on service would contend for the 750 h budget); a provider pre-deploy command would be Render-specific and duplicate the path. | A one-shot container/job (new image/entrypoint and deploy wiring); a separate Render web/cron service (second deployable, provider wiring); a Render `preDeployCommand` (provider coupling, not exercised locally). |
| D2 | **Plain idempotent SQL, no migration framework and no new dependency.** Bootstrap uses `CREATE TABLE IF NOT EXISTS` / `CREATE ... INDEX IF NOT EXISTS` from an in-repo TypeScript contract whose DDL is pinned in § Required schema contract and proven equivalent to the normalized `schema.sql` plus a repository-insert round-trip; the existing numbered runner stays the migration authority. | The request is table presence/creation, not schema evolution; `pg` is already a dependency; a framework (`node-pg-migrate`) would be an ASK-FIRST dependency and duplicate `schema_migrations`. Column-name-only checks would let a recreated table omit `DEFAULT gen_random_uuid()` and fail real inserts (review F2). | A migration framework (dependency + second ledger); parsing `schema.sql` at runtime (brittle parser and an extra file to package); replaying migrations to derive DDL (data rewrites, not a pure schema description). |
| D3 | **Required set = the five tables above; create missing tables only; detect required columns on existing tables and log a warning, never `ALTER`.** | Matches "required tables"; avoids creating a second schema authority beside the migrations; keeps the feature honest about not repairing column types, indexes, constraints or data. | Auto-`ALTER TABLE ... ADD COLUMN` (defaults/backfills/`NOT NULL` history make it unsafe); create-only without column detection (less diagnostic, hides drift). |
| D4 | **Concurrency safety = one dedicated direct-URL client + session-level advisory lock + per-table transaction + idempotent DDL.** The startup fallback `DATABASE_URL` must also be a direct/session-capable URL; on Neon both URLs are set and the direct one wins. | Safe if two instances start or restart together; the direct URL avoids PgBouncer transaction pooling for `BEGIN`/DDL; the lock is released on `end()` even if unlock fails. A pooled fallback cannot carry a session advisory lock (Q-5). | Relying on `IF NOT EXISTS` alone (not race-free on `pg_type`/index creation); no lock and provider luck; running DDL through the pooled URL. |
| D5 | **Fail-fast on connect, lock, migration and create failures; warn-and-continue for an outdated shape; non-fatal cleanup failures.** | A database that cannot be made schema-complete must not serve traffic; a missing column is an actionable migration/recovery problem but not a reason to take the service down; token cleanup is off the request path. | Warn-and-continue on failed creates (serves a broken DB); fail-fast on drift (a second schema authority, avoidable outage). |
| D6 | **Logging = the existing Pino `LogSink`, additively extended with `debug(event, fields)`; one event per table/check/creation and one per cleanup run plus a summary; no SQL text, rows, user identifiers, messages or stacks.** Debug events stay debug (not promoted to info) and are visible only at `LOG_LEVEL=debug`/development; production's default `info` shows the created/outdated/summary/failure lines. | The request asks for traces; the existing sink provides JSON, levels, redaction and serializers. Per-table "present" and zero-delete runs are diagnostic noise at `info`; the additive `debug` method is the smallest contract extension and keeps the existing log-level rules. | Dropping debug events and logging everything at `info` (noisy production logs, loses per-table detail); `console.log` (unstructured); a second logging path (duplicates redaction); OpenTelemetry (new infrastructure). |
| D7 | **Cleanup runs in-process: one immediate run after `listen`, then each subsequent run `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` after the previous run settles (default 3,600,000 ms = 1 h), using a `setTimeout` chain with an in-flight guard, `unref()`ed timers and a `stop()` awaited before the pool closes.** | A single `DELETE` needs no dedicated worker; a new cron/worker would be a second deployable; a `setInterval` can overlap on a slow DB; scheduling after settlement makes overlap impossible from the timer and keeps the cadence drift bounded by the run duration; `unref()` keeps tooling/tests from hanging. Render free spin-down means cleanup is best-effort; the immediate run catches up on restart. | `setInterval` (overlap); fixed-rate scheduling with a guard (drift-free but still needs the guard); startup-only cleanup (unbounded growth while the instance stays up); Render cron/worker (second deployable); `pg_cron` (extension/availability). |
| D8 | **Delete only `verification_tokens` rows with `expires_at <= now`; do not touch `users` or `sessions`; used-but-unexpired rows remain until expiry.** | The request says "entries … that are expired"; `consume` already rejects expired rows, so the delete changes no auth outcome; the account stays `verified = false` and the resend path remains (`POST /auth/resend-verification` issues a new token). Re-registration with the same username/email is still blocked by the existing unique indexes (user-authentication AC-2); that is unchanged. | Deleting used tokens immediately (extra behavior, not requested); deleting unverified accounts (destructive, out of scope); cascading account state (deleting a token has no FK path to a user). |
| D9 | **Expiry uses the process clock passed to the existing `deleteExpired(now)`; app/DB clocks are assumed NTP-aligned.** | No repository interface churn; token TTL is 24 h, so seconds of skew cannot change a meaningful outcome; the repository method and its tests already exist. | A new `DELETE ... WHERE expires_at <= now()` method (database-clock authority, marginal benefit, more interface/coverage surface). |
| D10 | **Configuration lives in a new `db/lifecycle-config.ts`: `DB_SCHEMA_BOOTSTRAP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (default `3600000`, 60,000–86,400,000 ms).** Invalid values (including empty strings) fail startup naming the variable. | Mirrors the existing `METRICS_ENABLED`/`LOG_LEVEL` strict parsing; keeps DB lifecycle settings out of `AuthConfig`; gives an operator escape hatch without a code change. | Extending `AuthConfig` (couples lifecycle to auth); compose-only flags (no host-only/Render control). |
| D11 | **`server.ts` builds the app first (logger + pool), runs the DB startup phase with the app logger, then listens; a startup failure logs, closes the app and exits 1.** | The bootstrap/cleanup logs then use the same Pino instance, levels, redaction and serializers as the rest of the backend; no second logger or duplicated redaction config. | Keeping the current order and using `console.error` (unstructured, outside the contract); a temporary Fastify instance just for logging (wasteful). |
| D12 | **No new metric; the 30-metric catalog is unchanged. No HTTP route, no public trigger, no deploy-workflow change.** | The request asks for logging/traces; a new metric would reopen the fixed catalog and its cardinality contract; a route would add a public surface for an internal operation. | Adding `db_bootstrap_*`/`db_cleanup_*` counters (catalog/docs churn, not requested); a diagnostic HTTP endpoint (public surface). |
| D13 | **Existing-table index/constraint drift is not detected or repaired.** Only missing columns are reported. | Keeps D3 honest; a `users` table missing the functional unique indexes would not enforce case-insensitive uniqueness, but repairing/detecting indexes is a migration concern, not a table-presence check. The migrations/CI are the repair path. | A warn-only index check (extra catalog queries, more scope); auto-`CREATE INDEX` (second schema authority). |
| D14 | **`src/server.ts` stays under the pre-existing composition-root coverage exclusion; all other new modules are covered.** `server.test.ts` asserts every wiring/failure/skip path but is not counted toward `server.ts` coverage. | The exclusion is sanctioned by `testing-criteria` and `src/backend/vitest.config.ts`; `startServer` is composition wiring. Moving behavior-heavy logic into a covered module would be a follow-up if it grows. | Removing the exclusion (changes a project-wide policy for a composition root); leaving the wiring untested (worse). |

## User stories

- As a maintainer deploying to Neon, I want the backend to verify that the required tables exist with their required defaults and create any missing one before it serves traffic, so a partially provisioned or restored database does not surface as runtime `500`s.
- As an operator, I want one structured log line per table check/creation and a summary, plus one per cleanup run, so I can see what happened in the Render logs without reading SQL.
- As a security reviewer, I want the startup and cleanup logs to carry no secrets, SQL text, row data, emails, tokens or error messages, and no new public surface.
- As a player, I want expired verification links to be cleaned up and the resend path to keep working, so an expired link is recoverable without manual database work.
- As a developer, I want the cleanup and bootstrap to be unit-testable with fake clocks/clients and provable against a throwaway Postgres 16 container, including a real insert after a recreated table, so I do not need a live Neon instance.

## Acceptance criteria

Evidence tiers and commands are defined in § Testing strategy. Every assertion uses concrete expected values (no wildcard matchers, no snapshots).

### Logging foundation

- **AC-1 — Additive debug log sink.** `LogSink` exposes `debug(event, fields)` alongside `info`/`warn`/`error`; `LoggerLike` exposes `debug(fields, event)`; `createLogSink(logger)` returns a sink whose `debug` calls `logger.debug(fields, event)`. A real Fastify/Pino sink emits one JSON line with `level: 20`, `msg` equal to the event and the structured fields for `sink.debug('db_schema_table_present', { table: 'users' })`. The two existing `LogSink` doubles (`game/hub.test.ts` `LogRecorder`, `observability/shutdown.test.ts` `createLogRecorder`) implement `debug`; the existing `info`/`warn`/`error` mapping, redaction paths, serializers, levels and event names are unchanged. Evidence: `logging.test.ts` (adapter, level 20, existing three methods), `npm run typecheck` (doubles satisfy the interface), `hub.test.ts`/`shutdown.test.ts` still green.

### Schema contract and bootstrap

- **AC-2 — Full DDL contract is pinned and equivalent to the consolidated schema.** `REQUIRED_TABLES` contains exactly `users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations` in that dependency order, and its statements are the complete DDL in § Required schema contract (types, NOT NULL, defaults, PK/FK/unique, indexes), every one using `IF NOT EXISTS`. `schema-contract.test.ts` parses every `src/backend/src/db/migrations/*.sql` and `src/backend/src/db/schema.sql` and asserts two-way table/column coverage plus the presence of every pinned default/constraint. `schema-contract-postgres.test.ts` applies `schema.sql` and the contract DDL into two separate schemas of a throwaway `postgres:16-alpine` and asserts normalized catalog equality: columns (`data_type`, `is_nullable`, `column_default`), primary/foreign/unique constraints and index definitions (modulo schema qualification). Evidence: both tests; this AC fails if `sessions.id`/`verification_tokens.id` lack `DEFAULT gen_random_uuid()` or any pinned default/NOT NULL differs.
- **AC-3 — An empty database is functionally bootstrapped.** Against an empty `public` schema in `postgres:16-alpine`, `runSchemaBootstrap` creates all five tables and the two `users` functional unique indexes; the catalog reports the pinned defaults (`users.id`, `sessions.id` and `verification_tokens.id` default `gen_random_uuid()`; `verified` NOT NULL DEFAULT FALSE; `failed_login_attempts` NOT NULL DEFAULT 0; `created_at`/`updated_at`/`last_seen_at` NOT NULL DEFAULT now(); `expires_at` NOT NULL; `user_economy` 0/`{}`/2 defaults). On that bootstrapped schema, `PgUserRepository.create` (insert omitting `id`), `PgSessionRepository.create` (omitting `id`), `PgVerificationTokenRepository.create` (omitting `id`) and a raw `INSERT INTO user_economy (user_id)` all succeed; returned ids are UUID strings, the session/token expiry matches the injected clock, and the economy row reads `coins 0`, `clicks 0`, `faces_destroyed 0`, `cubes_destroyed 0`, `upgrades {}`, `lootboxes 0`, `keys 0`, `parts {}`, `appearance {}`, `customization_version 2`, `economy_revision 0`. Evidence: `schema-bootstrap-postgres.test.ts`.
- **AC-4 — Each table and the summary are traced.** On the empty-database run, the recording `LogSink` receives exactly one `db_schema_bootstrap_started { tables: 5 }` at `info`, exactly one `db_schema_table_created { table }` at `info` per created table, no `db_schema_table_present`, and one `db_schema_bootstrap_completed { checked: 5, created: 5, outdated: 0, durationMs: 0 }` at `info` with an injected clock. Evidence: `schema-bootstrap.test.ts` (recording sink) plus AC-3 for the real database.
- **AC-5 — A second bootstrap run is a no-op.** A second `runSchemaBootstrap` run on the complete schema issues zero `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `DROP` and `UPDATE` statements, emits one `db_schema_table_present { table }` at `debug` per table, and one `db_schema_bootstrap_completed { checked: 5, created: 0, outdated: 0 }` at `info`. This is a repeat of the bootstrap, not a full startup (a full startup always executes the migration runner's `CREATE TABLE IF NOT EXISTS schema_migrations` before the ledger read). Evidence: `schema-bootstrap-postgres.test.ts` with a recording wrapper around the real client.
- **AC-6 — Only a missing table is recreated, and the recreated table accepts real inserts.** Starting from a complete schema with fixture rows in `users`, `sessions` and `user_economy`, drop `verification_tokens`; the next run creates exactly that table (one `db_schema_table_created` event, `db_schema_table_present` for the other four), leaves the fixture rows unchanged, and reports `created: 1`. Immediately after recreation, `PgVerificationTokenRepository.create({ userId, tokenHash, expiresAt })` succeeds with a generated UUID id and the expected expiry, proving the recreated table accepts the application's real insert shape; AC-2's catalog equivalence covers the FK/unique constraints. Evidence: `schema-bootstrap-postgres.test.ts`.
- **AC-7 — An outdated shape is reported, not altered.** Starting from a complete schema, drop `users.locked_until` (the users table is empty in this fixture); the run emits `db_schema_table_outdated { table: 'users', missingColumns: 'locked_until' }` at `warn`, issues no `ALTER TABLE`/`DROP`, leaves the table unchanged, and reports `outdated: 1` in the summary. A second fixture drops both `users.failed_login_attempts` and `users.locked_until`; the event reads `missingColumns: 'failed_login_attempts,locked_until'`, pinned to the DDL order (not alphabetical). Evidence: `schema-bootstrap-postgres.test.ts`.
- **AC-8 — A failed creation fails the bootstrap with a trace.** With a fake database that reports no existing tables and rejects the `CREATE TABLE ... sessions` statement, `runSchemaBootstrap` rejects with that error, emits `db_schema_bootstrap_failed { table: 'sessions', errorType: 'Error' }` at `error`, and emits no `db_schema_bootstrap_completed`. Evidence: `schema-bootstrap.test.ts`.

### Startup phase

- **AC-9 — One dedicated client, advisory lock, migrations, then bootstrap.** `runDatabaseStartup` resolves `DIRECT_DATABASE_URL` over `DATABASE_URL`, creates exactly one `pg.Client` (never a `pg.Pool`), connects, issues `SELECT pg_try_advisory_lock($1::bigint) AS locked` before any migration statement, runs pending migrations, then the bootstrap, issues `SELECT pg_advisory_unlock($1::bigint)` in a `finally`, and always ends the client. Evidence: `startup.test.ts` with a fake client asserting the exact statement order.
- **AC-10 — No database skips the phase.** With neither URL configured (or both empty), `runDatabaseStartup` returns `{ skipped: true }` without creating a client and emits `db_schema_bootstrap_skipped { reason: 'no_database' }` at `debug`; `startServer` then listens with the existing in-memory repositories. The `startup.test.ts` assertion covers the module half; `server.test.ts` covers the `startServer` half (no-database → `listen`). Evidence: `startup.test.ts`, `server.test.ts`.
- **AC-11 — Lock contention is bounded and fails startup.** When `pg_try_advisory_lock` returns `false` for the whole 30,000 ms budget (injected clock/sleep), `runDatabaseStartup` rejects with a `DatabaseStartupError` whose `stage` is `'lock'`, issues no migration statement, and ends the client; `startServer` does not call `listen`. The `startup.test.ts` assertion covers the module half; `server.test.ts` covers the `startServer` half (lock-stage `DatabaseStartupError` → no `listen`). Evidence: `startup.test.ts`, `server.test.ts`.
- **AC-12 — Bootstrap can be disabled without disabling migrations.** With `DB_SCHEMA_BOOTSTRAP_ENABLED=false`, `runDatabaseStartup` still applies pending migrations, emits `db_schema_bootstrap_skipped { reason: 'disabled' }` at `info`, returns `bootstrap: null`, and issues no `information_schema` query. Evidence: `startup.test.ts`.
- **AC-13 — The startup phase traces its events.** On a successful run with one lock retry and one applied migration (injected clock/sleep), the recording sink receives the startup-owned events and the bootstrap summary in order: `db_startup_lock_wait { waitedMs: 0 }` at `debug`, `db_startup_lock_acquired { waitedMs: 250 }` at `debug`, `db_migrations_applied { count: 1 }` at `info`, `db_schema_bootstrap_started { tables: 5 }` at `info`, `db_schema_bootstrap_completed { checked: 5, created: 0, outdated: 0, durationMs: 0 }` at `info`, and `db_startup_completed { migrated: 1, created: 0, outdated: 0, durationMs: 250 }` at `info`. With no pending migration the run emits `db_migrations_up_to_date` at `debug` instead of `db_migrations_applied`. Evidence: `startup.test.ts` exact entries.

### Expired verification cleanup

- **AC-14 — Lifecycle configuration is validated.** `loadDbLifecycleConfig({})` returns `{ bootstrapEnabled: true, cleanupEnabled: true, cleanupIntervalMs: 3_600_000 }`; `true`/`1` and `false`/`0` are accepted for the two booleans; an integer `60000`–`86400000` is accepted for the interval; `DB_SCHEMA_BOOTSTRAP_ENABLED=maybe`, `DB_SCHEMA_BOOTSTRAP_ENABLED=''`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=yes`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=''`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=59999`, `=86400001` and `=''` each throw an `Error` naming the exact variable. Evidence: `lifecycle-config.test.ts`.
- **AC-15 — Cleanup runs immediately, then after each run settles.** With fake timers and an immediately-resolving fake repository, `start()` emits `db_verification_cleanup_started { intervalMs: 3_600_000 }` at `info`, calls `deleteExpired(now)` at 0 ms, then at 3,600,000 ms, then at 7,200,000 ms (each next timer is scheduled `intervalMs` after the previous run settles, so a run taking D ms shifts the next tick by D); each run emits `db_verification_cleanup_run { deleted, durationMs }` at `info` when `deleted > 0` and `debug` when `0`; `stop()` clears the next timer and emits `db_verification_cleanup_stopped` once at `info`. Evidence: `verification-cleanup.test.ts`.
- **AC-16 — Only expired verification rows are deleted.** Against real Postgres with a verified user and an unverified user, tokens `expired` (`expires_at = now - 1 s`), `unexpired` (`now + 1 h`) and `used-unexpired` (`used_at = now - 1 s`, `expires_at = now + 1 h`): one run deletes only the expired row and reports `deleted: 1`; the other two rows remain; both `users.verified` values and every `sessions` row are unchanged; a second run reports `0`. Evidence: `verification-cleanup-postgres.test.ts`.
- **AC-17 — Cleanup is concurrency-safe and idempotent.** Two cleanup runs sharing one database, started concurrently, both complete without error; the sum of their deleted counts equals the number of expired rows (each row is deleted once); a subsequent run deletes `0`. Evidence: `verification-cleanup-postgres.test.ts`.
- **AC-18 — A cleanup failure is isolated.** When `deleteExpired` rejects with `new Error('cleanup boom')`, `runOnce` emits `db_verification_cleanup_failed { errorType: 'Error' }` at `error`, resolves with `0`, and the next interval is still scheduled; `GET /healthz` and the auth routes are untouched. Evidence: `verification-cleanup.test.ts`, `app.test.ts` (unchanged health).
- **AC-19 — Runs never overlap; the guard is exercised directly.** Because the recursive timer is scheduled only after a run settles, the timer cannot itself fire while a run is pending. Calling `runOnce()` while an earlier `runOnce()` is still pending (deferred promise) issues no second `deleteExpired`, emits `db_verification_cleanup_skipped { reason: 'in_flight' }` at `debug`, resolves the second call with `0`, and the pending run's completion schedules the next timer; a duplicate `start()` is idempotent and schedules no second chain. Evidence: `verification-cleanup.test.ts` with a deferred promise.

### Wiring, shutdown, logs and surface

- **AC-20 — Shutdown `beforeClose` ordering.** With `installShutdownHandlers({ beforeClose })` where `beforeClose` returns a deferred promise and records its start/end, the first signal logs `shutdown_started`, increments `cubeclicker_shutdown_total{signal}`, awaits `beforeClose`, then calls `app.close()`, then logs `shutdown_complete` and exits `0`; a `beforeClose` rejection logs `shutdown_failed { signal, errorType }` and exits `1` without calling `app.close()`; with no `beforeClose` the existing behavior and tests are unchanged. Evidence: `shutdown-before-close.test.ts`, existing `shutdown.test.ts`.
- **AC-21 — Server wiring and skip paths.** With no pool, `startServer` creates no scheduler and emits `db_verification_cleanup_skipped { reason: 'no_database' }` at `debug`; with a pool and `cleanupEnabled: false`, it emits the skip at `info` with `reason: 'disabled'`; with a pool and defaults, the scheduler starts after `app.listen()` and `installShutdownHandlers` receives a `beforeClose` that awaits `cleanup.stop()` before `app.close()`; `startServer` returns `{ started: true, cleanup }`. Evidence: `server.test.ts`.
- **AC-22 — A startup failure is traced and prevents listening.** When `runDatabaseStartup` rejects with a `DatabaseStartupError` whose `stage` is `'bootstrap'` and whose underlying cause is `new Error(...)`, `startServer` emits `db_startup_failed { stage: 'bootstrap', errorType: 'Error' }` at `error`, calls `app.close()`, calls `exit(1)`, and never calls `app.listen()`. Evidence: `server.test.ts`.
- **AC-23 — New logs carry no secrets, SQL, rows or error messages.** Every new event carries only the fields in § Log contract; no captured line contains an email, password, token/hash value, cookie, authorization value, connection string, SQL text (`SELECT`/`INSERT`/`CREATE`/`ALTER`/`DELETE`), row data, `error.message` or `error.stack`. Error events carry only their listed constant fields (`table` and/or `stage`) plus `errorType` and an optional string `code`. Evidence: exact-field assertions in `logging.test.ts`, `schema-bootstrap.test.ts`, `startup.test.ts`, `verification-cleanup.test.ts`, plus the T11 source audit of `log.*` call sites.
- **AC-24 — No new public surface or metric series.** `src/backend/src/app.ts`, `src/backend/src/observability/metrics.ts` and the route set are unchanged (no bootstrap/cleanup route, no new metric name); a scrape still contains exactly the 30 catalog metrics and no `cubeclicker_db_bootstrap*`/`cubeclicker_db_cleanup*` series; `GET /healthz` still returns exactly `{"status":"ok"}`. Evidence: `git diff --exit-code` for those files plus unchanged `app.test.ts`/`metrics.test.ts` in T11.

### Configuration, containers, documentation, quality

- **AC-25 — Container and Render configuration, proven by a stack run.** `compose.yaml` keeps the exact service set `adminer`, `backend`, `db`, `frontend`, `mailpit`; the backend environment map is exactly the 15 existing keys plus `DB_SCHEMA_BOOTSTRAP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` (default `true`) and `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (default `3600000`) — an 18-key allow-list asserted by name in T9, with the `git diff --unified=0 -- compose.yaml render.yaml` review confirming only those three compose lines and the three render values changed; the backend `ports`, `volumes` and `depends_on` are unchanged and no `healthcheck` is added; `render.yaml` still declares one service with the three committed non-secret values and no `healthCheckPath`; no new image, Dockerfile line, route or deploy-workflow step is added; `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` followed by `npm run smoke` exits 0 (`SMOKE PASS`). Evidence: the exact YAML assertions (including the environment allow-list), the smoke transcript, the diff review, `git diff --exit-code` for the Dockerfiles and `deploy.yml`.
- **AC-26 — Documentation matches the shipped behavior.** `README.md` lists all three variables with their defaults (`true`, `true`, `3600000`) and names `db_schema_bootstrap_completed` and `db_verification_cleanup_run`; `docs/architecture/observability.md` lists every new event (including the debug rows), documents `LogSink.debug`, and states the catalog stays at exactly 30; `docs/architecture/deployment.md` records migrations → schema bootstrap → listen under the advisory lock, fail-fast, the direct/session-capable startup URL and in-process best-effort cleanup, and reconciles the Render old/new-overlap wording with the application-level "not zero-downtime for clients" statement; `docs/architecture/vercel-render-neon.md` records the committed Render defaults and the failure/cleanup troubleshooting events; `docs/architecture/containerization.md` records all three compose pass-throughs and that no service/image/port was added; every relative link in the five touched docs resolves, checked by the T10 five-doc link script (the existing `docs/links.test.ts` remains scoped to `docs/architecture/documentation.md`); `docs/features/README.md` is untouched by the builder. Evidence: the complete greps and README default assertions in T10, the five-doc link check, `npm run test --workspace @cubeclicker/frontend -- src/docs/links.test.ts`, `git status --porcelain -- docs/features/README.md` empty.
- **AC-27 — Quality gates, coverage scope and the env boundary.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, the frontend-prod build and `npm run smoke` all exit 0; `npm run coverage` meets statements/branches/functions/lines ≥ 80 per workspace for every new non-composition module (`logging.ts` extension, `schema-contract.ts`, `schema-bootstrap.ts`, `lifecycle-config.ts`, `startup.ts`, `verification-cleanup.ts`, `shutdown.ts` extension), all included with no new exclusions; `src/server.ts` remains under the pre-existing `testing-criteria` composition-root exclusion and its wiring is asserted by `server.test.ts` (not coverage-counted); `package.json`/`package-lock.json` are unchanged (no new dependency). `.env*` is a manual boundary: it is gitignored, so no git command can prove an ignored file was untouched; no task owns or edits it, and the build log records the manual confirmation. Evidence: T11 build log with raw output and the recorded confirmation.

## Required schema contract

The contract is the five tables below, created in dependency order (`users` first because `sessions`, `verification_tokens` and `user_economy` reference it). The DDL in this section is normative: the TypeScript contract carries it verbatim (split per table, with the two `users` index statements part of the `users` entry) and the equivalence test in AC-2 compares it to the consolidated `schema.sql` at catalog level. The `RequiredTable.columns` array follows the normative DDL column order shown below, and `db_schema_table_outdated.missingColumns` is emitted in that same DDL order (AC-7's two-column fixture pins it; it is not alphabetical).

| Table | Required columns | Creation order |
| --- | --- | --- |
| `users` | `id`, `username`, `email`, `password_hash`, `verified`, `failed_login_attempts`, `locked_until`, `created_at`, `updated_at` | 1 |
| `sessions` | `id`, `user_id`, `token_hash`, `expires_at`, `created_at`, `last_seen_at` | 2 |
| `verification_tokens` | `id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at` | 3 |
| `user_economy` | `user_id`, `coins`, `clicks`, `faces_destroyed`, `cubes_destroyed`, `economy_revision`, `upgrades`, `lootboxes`, `keys`, `parts`, `appearance`, `customization_version`, `last_seen_at`, `updated_at` | 4 |
| `schema_migrations` | `name`, `applied_at` | 5 |

```sql
-- Normative creation contract. Every statement is IF NOT EXISTS and is executed
-- verbatim (per table) by runSchemaBootstrap. Mirrors src/backend/src/db/schema.sql
-- after migration 007.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_economy (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins NUMERIC(18,2) NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  faces_destroyed BIGINT NOT NULL DEFAULT 0,
  cubes_destroyed BIGINT NOT NULL DEFAULT 0,
  economy_revision BIGINT NOT NULL DEFAULT 0,
  upgrades JSONB NOT NULL DEFAULT '{}'::jsonb,
  lootboxes INT NOT NULL DEFAULT 0,
  keys INT NOT NULL DEFAULT 0,
  parts JSONB NOT NULL DEFAULT '{}'::jsonb,
  appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  customization_version INT NOT NULL DEFAULT 2,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The defaults and NOT NULL constraints that must survive a recreated table (AC-2/AC-3/AC-6):

| Table.column | Required attribute | Why the app breaks without it |
| --- | --- | --- |
| `users.id`, `sessions.id`, `verification_tokens.id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | The repositories insert without `id` (`user-repository.ts`, `session-repository.ts`, `verification-token-repository.ts`). |
| `users.verified` | `BOOLEAN NOT NULL DEFAULT FALSE` | Registration inserts without `verified`; the unverified gate reads it. |
| `users.failed_login_attempts` | `INT NOT NULL DEFAULT 0` | Login lockout counters start at 0. |
| `users.created_at`/`updated_at`, `sessions.created_at`/`last_seen_at`, `user_economy.last_seen_at`/`updated_at`, `schema_migrations.applied_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Inserts omit these timestamps. |
| `verification_tokens.expires_at` | `TIMESTAMPTZ NOT NULL` (no default) | `issue()` always writes it; a nullable column would hide bugs. |
| `user_economy.coins/clicks/faces_destroyed/cubes_destroyed/economy_revision` | `NOT NULL DEFAULT 0` | Inserts create the row from `user_id` alone. |
| `user_economy.upgrades/parts/appearance` | `JSONB NOT NULL DEFAULT '{}'::jsonb` | Repositories read these as objects. |
| `user_economy.lootboxes`/`keys` | `INT NOT NULL DEFAULT 0` | Cosmetic/lootbox reads. |
| `user_economy.customization_version` | `INT NOT NULL DEFAULT 2` | Migration 006 sets 2; a fresh row must read the v2 model. |
| `sessions.token_hash`, `verification_tokens.token_hash` | `TEXT NOT NULL UNIQUE` | Token lookups and single-use guarantees. |
| `users` functional indexes | `users_username_lower_uq` / `users_email_lower_uq` on `lower(...)` | Case-insensitive registration uniqueness. |

- Column presence is checked on existing tables; types, nullability, defaults, indexes and constraints are **not** re-verified or repaired there (AC-7). Extra columns are ignored; only missing required columns are reported. Missing indexes/constraints on an existing table (including the `users` functional indexes) are not detected (D13); the migrations are the repair path.
- Creating a missing `user_economy` uses the final consolidated shape above, not the 002 base shape followed by the 003–007 alters; a fresh table has no legacy rows for migration 006's rewrite.
- The contract is compile-time TypeScript; no runtime `.sql` file is loaded, so the Dockerfile needs no new copy (the existing `dist/db/migrations` copy is untouched).

## Log contract

Fields are the `LogSink` fields object (`string | number | boolean`); the event name is the message. No field is user-controlled. `code` is included only when the error has a string `code` (for example a PostgreSQL SQLSTATE). `debug` is the additive sink method from AC-1; debug rows are visible only when the configured level is `debug` (development default; `LOG_LEVEL=debug` in production), while production's default `info` shows the created/outdated/summary/failure rows.

| Event | Fields | Level | When |
| --- | --- | --- | --- |
| `db_startup_lock_wait` | `waitedMs` | debug | A lock attempt returned `false` and the runner will retry. |
| `db_startup_lock_acquired` | `waitedMs` | debug | The advisory lock was acquired. |
| `db_migrations_applied` | `count` | info | One or more migrations were applied. |
| `db_migrations_up_to_date` | — | debug | No migration was pending. |
| `db_schema_bootstrap_started` | `tables` | info | Before the catalog query. |
| `db_schema_table_present` | `table` | debug | An existing table has every required column. |
| `db_schema_table_created` | `table` | info | A missing table and its indexes were created and committed. |
| `db_schema_table_outdated` | `table`, `missingColumns` (comma-joined in the normative DDL column order — the `RequiredTable.columns` order) | warn | An existing table is missing required columns; nothing is altered. |
| `db_schema_bootstrap_completed` | `checked`, `created`, `outdated`, `durationMs` | info | After all tables were checked/created. |
| `db_schema_bootstrap_skipped` | `reason` (`no_database` \| `disabled`) | debug / info | `no_database` at debug; `disabled` at info. |
| `db_schema_bootstrap_failed` | `table`, `errorType`, `code`? | error | A table creation failed; the bootstrap rethrows. |
| `db_startup_completed` | `migrated`, `created`, `outdated`, `durationMs` | info | The whole startup DB phase succeeded. |
| `db_startup_failed` | `stage` (`connect` \| `lock` \| `migrations` \| `bootstrap`), `errorType`, `code`? | error | The startup DB phase failed; `server.ts` closes and exits. |
| `db_verification_cleanup_started` | `intervalMs` | info | `start()` scheduled the first run. |
| `db_verification_cleanup_skipped` | `reason` (`no_database` \| `disabled`) | debug / info | No scheduler in server wiring; `no_database` at debug, `disabled` at info. |
| `db_verification_cleanup_skipped` | `reason: 'in_flight'` | debug | A direct `runOnce()` was called while a run was pending. |
| `db_verification_cleanup_run` | `deleted`, `durationMs` | info when `deleted > 0`, debug when `0` | After each delete attempt. |
| `db_verification_cleanup_failed` | `errorType`, `code`? | error | `deleteExpired` rejected; the scheduler continues. |
| `db_verification_cleanup_stopped` | — | info | `stop()` cleared the timer and awaited any in-flight run. |

- **Not logged:** connection strings, `DATABASE_URL`/`DIRECT_DATABASE_URL`, SQL text, query parameters, row counts beyond the aggregate `deleted`/`created`, emails, usernames, account ids, token hashes or values, cookies, authorization headers, error messages and stacks.
- **No new metric:** the runtime observability catalog remains exactly the 30 metrics in `docs/architecture/observability.md`; this feature adds no `cubeclicker_*` series.

## Non-goals

- No new dependency and no migration framework; the existing numbered `.sql` runner stays the only migration authority.
- No automatic `ALTER TABLE`, column backfill, index/constraint repair, `DROP`, or data repair for an outdated table; no down migrations.
- No detection or repair of missing indexes/constraints on an existing table (including the `users` functional unique indexes); only missing columns are reported (D13). The migrations/CI are the repair path.
- No database creation, role/grant management, extension installation, or schema other than `public`; no multi-tenant schema handling.
- No cleanup of expired `sessions`, used-but-unexpired verification tokens, unverified accounts, or any account/user data. Expired sessions are a future candidate (Q-3), not part of this request.
- No separate service, container, image, port, volume, cron job, Render pre-deploy command or deploy-workflow step; no provider-specific mechanism.
- No new HTTP route, public diagnostics endpoint, auth bypass or browser-reachable trigger for bootstrap/cleanup.
- No new metric series; the 30-metric catalog and its cardinality contract are unchanged.
- No distributed tracing, OpenTelemetry, log shipping, rotation or retention change; "traces" means structured stdout JSON events.
- No change to auth rules, verification-token TTL, resend rate limits, single-session behavior, WS protocol, rooms, economy, customization or server authority.
- No horizontal backend scaling; the pinned single-instance Render topology is retained. Cleanup is concurrency-safe, but that does not authorize a second instance.
- No index on `verification_tokens.expires_at` (a future migration if the table grows beyond the current scale).
- No `.env*` edits and no builder edit of `docs/features/README.md` (orchestrator-owned).

## Boundaries

- ✅ **Always:** add `debug` to the sink additively (no change to the existing three methods, redaction, serializers or event names); update the two existing `LogSink` doubles in the owning task; run the bootstrap after migrations and before `listen`; use one dedicated direct-URL `pg.Client` for the startup phase; acquire/release the advisory lock; keep DDL idempotent (`IF NOT EXISTS`) and pinned to the normative contract; keep catalog queries parameterized with constants only; create only missing tables; log through the existing `LogSink`; fail startup on connect/lock/migration/create errors; keep cleanup failures non-fatal and runs non-overlapping; stop the scheduler before the pool closes; test with fake clients/clocks and a throwaway Postgres 16 container, including a post-bootstrap/post-recreate repository insert; run lint/typecheck/test/coverage/build/smoke; record raw output in the build log; update documentation in the same change.
- ⚠️ **Ask first:** any new dependency (including a migration framework); a new service/container/cron/pre-deploy command; any deploy-workflow or GitHub Environment change; changing the required-table contract beyond what the migrations/schema define; adding a metric series or HTTP route; changing cleanup retention to delete non-expired rows or account data; granting DDL privileges to a restricted runtime role (user-owned provisioning); changing `LogSink` beyond the additive `debug` method; touching files outside a task's `files_owned`.
- 🚫 **Never:** auto-`ALTER`/`DROP`/backfill an existing schema; delete `users`, `sessions`, unexpired tokens (including used-but-unexpired rows), or account data; run DDL through the pooled PgBouncer `DATABASE_URL` pool; log secrets, SQL text, parameters, rows, emails, tokens, cookies, error messages or stacks; weaken or delete existing tests; edit `.env*`; `git push`; edit `docs/features/README.md`.

## Security considerations

- **Privileges.** Bootstrap needs `CREATE` on the `public` schema (and ownership of created objects) for the connection used by `DIRECT_DATABASE_URL` (or the direct-URL fallback). The default Neon role owns the schema; a restricted runtime role is a deployment decision (Q-2). If creation is denied, startup fails fast and the deploy health poll fails; the operator can grant DDL or set `DB_SCHEMA_BOOTSTRAP_ENABLED=false` and rely on the CI migration.
- **Startup URL fallback.** `DIRECT_DATABASE_URL` is preferred. If it is absent, the `DATABASE_URL` used for the advisory-lock/DDL phase must be a direct/session-capable URL. A Neon `-pooler` URL must not be used for this phase: transaction pooling can move `BEGIN`/DDL across backends and does not reliably carry a session advisory lock. On the documented Neon environments both URLs are set, so the direct one wins; the fallback exists for local compose/host-only direct Postgres (Q-5).
- **SQL injection and SQL text.** All bootstrap DDL and catalog queries are constant strings; the only parameter is the constant table-name array bound as `$1::text[]`. No user input reaches the connection. The cleanup reuses the parameterized `DELETE FROM verification_tokens WHERE expires_at <= $1`.
- **Secrets and logs.** The connection string is never logged. New events carry schema metadata (`table`, `missingColumns`), counts, durations, constants (`reason`, `stage`) and error type/code only. Pino's existing redaction covers accidental `email`/`token`/`cookie`/`authorization` fields. PostgreSQL error `detail`/`message`/`hint` may contain SQL or data and is never logged; `errorType` and `code` are the diagnostic surface.
- **Persistence integrity.** Each table creation plus its indexes runs in one transaction and is rolled back on failure. The advisory lock serializes the check/create phase across processes; the lock is session-scoped and released on disconnect. `schema_migrations` is read by the existing runner and never written by the bootstrap. The only destructive statement in the feature is the expired-token `DELETE`, whose predicate is fixed and whose rows are already unusable (`consume` rejects them). Existing-table index/constraint drift is not detected (D13); a `users` table missing the functional unique indexes would not enforce case-insensitive uniqueness, and that is a known limitation repaired by migrations/CI.
- **Abuse and denial of service.** There is no HTTP trigger for bootstrap or cleanup. The cleanup cadence is configurable and bounded (minimum 60 s); each run is one `DELETE` on a table whose growth is bounded by registration/resend rate limits. The `expires_at` predicate currently scans the table; at the expected development scale this is negligible, and an index is explicitly deferred (non-goal). The advisory lock wait is capped at 30 s, so a stuck peer session cannot hang startup indefinitely.
- **Public surface.** No new route, port, listener, container or provider control; `/healthz` body is unchanged, `/metrics` stays default-off on Render, and no bootstrap/cleanup data is exposed.
- **Supply chain.** No new package; `pg` (already direct) provides `Client`, and Fastify's built-in Pino is reused through `app.log`.
- **`.env*`.** The files are gitignored and user-owned; no task edits them. This is a procedural boundary, not a machine-verifiable git check.

## Real-time / multi-client impact

- **No shared or cross-client value changes.** Bootstrap and cleanup are process/database lifecycle operations; they do not read or write rooms, members, cubes, economy, leaderboards, presence or any server-authoritative game value. The WS protocol and `/ws` are unchanged.
- **Connection lifecycle and reconnection.** The schema phase completes before `listen`, so `/ws` is not advertised until the schema is verified. If startup fails, the process exits without accepting clients; clients then follow the existing reconnect policy (10 attempts, 500 ms → 5 s backoff) and `Connection lost` banner. If a Render deploy restarts the instance, the existing disconnect/reconnect behavior and in-memory room reset are unchanged.
- **Multi-client.** Multi-tab/account behavior, single-session revocation, guest identity and server authority are untouched. Cleanup does not invalidate sessions or change `verified`; removing an expired token has no observable effect on an active account because that token was already rejected by `consume`.
- **Identity vs. "no accounts".** No conflict: accounts remain optional and additive, and this feature neither creates nor removes identities. Deleting an expired verification token leaves the account unverified and preserves the resend path; re-registration with the same username/email remains blocked by the existing unique indexes.
- **Multiple instances.** Cleanup is safe to run concurrently (one atomic `DELETE`; each row is deleted once). Bootstrap is serialized by the advisory lock; the lock is safe if the provider overlaps old/new instances during a deploy, which is why D4 does not depend on either wording of the Render downtime statement. The production topology remains one Render instance; this feature does not introduce shared room state or authorize horizontal scaling.

## Containerization impact

Per `docs/architecture/containerization.md`, no new deployable is added; the impact is limited to environment-based configuration:

- **Compose service:** none added. `backend` and `db` are unchanged apart from environment; the backend still `depends_on: db: condition: service_healthy`; the service set stays `adminer`, `backend`, `db`, `frontend`, `mailpit`. `compose.yaml` gains exactly three backend environment pass-throughs with safe defaults (`DB_SCHEMA_BOOTSTRAP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS`).
- **Image:** no new image or Dockerfile change. The new modules compile into the existing `src/backend` `dist`; the contract DDL is TypeScript, so no new `.sql` file must be copied into the runtime image (the existing `dist/db/migrations` copy is untouched).
- **Environment-based config:** the three names above, parsed strictly with defaults; no secret is added. `render.yaml` documents the same non-secret defaults on the one service; the live service falls back to code defaults when they are absent. No GitHub Environment or deploy-workflow sync is added.
- **Health signal:** unchanged `GET /healthz` → `200 {"status":"ok"}` and the existing image `HEALTHCHECK`. A bootstrap failure exits the process; the deploy workflow's `/healthz` poll then fails as it does for a migration failure. No new healthcheck or Render `healthCheckPath`.
- **WebSocket endpoint exposure:** unchanged `GET /ws` on port `8080`; the WebSocket becomes connectable only after the schema phase completes. No proxy, port, host mapping or provider route changes.
- **Deploy neutrality:** the implementation uses plain PostgreSQL DDL through `pg` and Node timers; there is no Render/Fly/AWS-specific mechanism, pre-deploy command or provider hook. `podman compose up` remains the single local command.

## Testing strategy

The bar is concrete, deterministic assertions; no wildcard matchers, no snapshot-only or assertion-free tests, no real sleeps (fake timers/injected clocks), and no wall-clock performance assertions.

- **Unit — logging (`logging.test.ts`, extended):** `debug` adapter mapping (`logger.debug(fields, event)`), real Pino level 20, unchanged `info`/`warn`/`error` mapping, redaction, serializers; `hub.test.ts`/`shutdown.test.ts` doubles implement `debug` and still pass.
- **Unit — schema contract (`schema-contract.test.ts`):** contract table/column set, full DDL `IF NOT EXISTS` shape, pinned defaults/NOT NULL/constraints, two-way comparison with every migration file and `schema.sql`.
- **Unit — bootstrap (`schema-bootstrap.test.ts`):** fake database sequence (catalog query → per-table transaction → summary), exact events/levels/fields, empty schema creation plan, no-op plan, outdated detection without `ALTER`, create failure + rollback + rethrow, duration from an injected clock, custom table list seam.
- **Unit — lifecycle config (`lifecycle-config.test.ts`):** defaults, boolean forms, interval bounds, empty-string and invalid forms, exact error messages naming the variable.
- **Unit — startup (`startup.test.ts`):** URL precedence, one `pg.Client` and never a pool, exact lock/migrate/bootstrap/unlock/end order, no-database skip without a client, lock timeout with injected clock/sleep, bootstrap disabled, `DatabaseStartupError.stage` for connect/lock/migrations/bootstrap, unlock/end called on every path, and the startup trace events (AC-13).
- **Unit — cleanup (`verification-cleanup.test.ts`):** immediate + recursive timeout scheduling with fake timers (0/interval/2×interval for an immediately-resolving repo), cadence-after-settle with a delayed run, exact event fields/levels, `now` injection, direct `runOnce()` overlap skip, failure isolation + next interval, stop clearing the timer and awaiting an in-flight run, start/stop idempotence, `deleted` count and duration.
- **Unit — shutdown (`shutdown-before-close.test.ts`, new; `shutdown.test.ts` keeps its existing coverage and its recorder gains `debug` in T1):** `beforeClose` runs before `app.close()` and is awaited; a `beforeClose` rejection logs `shutdown_failed` and exits 1; existing no-`beforeClose` behavior remains covered by `shutdown.test.ts`.
- **Unit — server wiring (`server.test.ts`, new; module mocks):** build-app-before-startup order, startup failure → `app.close()` + `exit(1)` + no `listen`, success → `listen` → cleanup start → shutdown install, cleanup `beforeClose` wiring, no-pool/disabled skip paths, return value, and the AC-10/AC-11 server halves (no-database → `listen`; lock-stage error → no `listen`). The same T8 change removes `runStartupMigrations` and runs `migrate-runner.test.ts`/`migrate-cli.test.ts` as the atomic-removal regression. `server.ts` stays under the pre-existing composition-root coverage exclusion; this test is behavioral, not coverage-counted.
- **Integration — real PostgreSQL (`schema-contract-postgres.test.ts`, `schema-bootstrap-postgres.test.ts`, `verification-cleanup-postgres.test.ts`):** throwaway `postgres:16-alpine` via `podman`/`docker` (same helper pattern as `migration-006/007.test.ts`; skip only when no runtime is available). Proves full-DDL equivalence against `schema.sql`, empty-schema creation with the pinned defaults, post-bootstrap repository inserts, no-op re-run, single-table recreation plus a post-recreate token insert, outdated-column warning without alteration, expired-only deletion, account/session preservation and concurrent-delete idempotence.
- **Integration — app (`app.test.ts`, `metrics.test.ts` unchanged):** `/healthz` body and the 30-metric catalog are unchanged; no bootstrap/cleanup route or series appears.
- **E2E / container:** `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` then `npm run smoke`; the stack must still start, the backend must still serve `/healthz`, `/ws`, auth and the metrics check. The real-Postgres suites, not the smoke, prove the empty-database creation path (the compose volume persists). T9 runs this recipe for AC-25 and T11 re-runs it for the final gate.
- **Coverage:** `npm run coverage` — Vitest V8 thresholds ≥ 80% statements, branches, functions and lines per workspace, for every new non-composition module; `src/server.ts` remains under the pre-existing composition-root exclusion (`testing-criteria`, `src/backend/vitest.config.ts`) and is asserted behaviorally by `server.test.ts`, not coverage-counted. Behavior-change tasks use the workspace-scoped pre-gate `npm run coverage --workspace @cubeclicker/backend`; T11 runs the root command.
- **Commands:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod`, `npm run smoke`. DB suites additionally need podman or docker; they self-skip otherwise (recorded in the build log).

## Open questions

No blocking question. The decisions above are engineering defaults and are reversible through the listed environment variables.

- **Q-1 — Cleanup cadence (non-blocking, user preference).** Default is one hour. Expired rows are only storage; the value can be changed with `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (60,000–86,400,000 ms) without code. A shorter cadence increases write/scan frequency; a longer one increases retained rows.
- **Q-2 — Runtime DB role privileges (user-owned provisioning).** The bootstrap requires DDL on `public` for the direct-URL role. The default Neon role owns the schema; if a deployment uses a restricted runtime role, choose between granting DDL to that role and setting `DB_SCHEMA_BOOTSTRAP_ENABLED=false` (CI still migrates). This feature does not manage grants.
- **Q-3 — Expired sessions (scope confirmation).** This request covers verification links only; expired `sessions` rows are not purged. A future feature could reuse the same scheduler with a session predicate if desired.
- **Q-4 — Operator-triggered check (future option).** A `db:verify`/`db:bootstrap` CLI with `--check-only`, or a deploy-pipeline pre-check, is not included. The startup phase already checks on every boot; a CLI would add a second code path and is intentionally deferred.
- **Q-5 — Startup URL fallback (non-blocking, deployment-owned).** The startup phase prefers `DIRECT_DATABASE_URL`. A deployment that sets only a session-capable direct `DATABASE_URL` works (local compose); a deployment that sets only a pooled `-pooler` URL is unsupported for the advisory-lock/DDL phase. The runner does not sniff provider hostnames; the operator must provide the direct URL or disable bootstrap. On the documented Neon development/production environments both URLs are set.

## Assumptions

- The five tables and the DDL in § Required schema contract are the complete durable schema at this revision. A future migration that adds/removes a table, column, default or constraint must update `REQUIRED_TABLES` in the same change (AC-2 catches drift).
- All tables are in the `public` schema; there is no multi-tenant/custom schema.
- PostgreSQL 16 provides `gen_random_uuid()` without an extension; no extension is installed by this feature.
- The `DIRECT_DATABASE_URL` (or direct-URL fallback) role owns the `public` schema objects and can create tables/indexes; see Q-2. A pooled `DATABASE_URL` alone is not sufficient for the startup phase (Q-5).
- The backend runs as exactly one Render instance; the single-instance topology (`docs/architecture/deployment.md` § Single-instance trade-off) is unchanged. The advisory lock is safe if the provider overlaps old/new instances, regardless of which document's downtime wording is read.
- The Render free instance spins down after 15 idle minutes; cleanup is best-effort and the immediate run on the next start catches up. There is no missed-run accounting or durable schedule.
- `pg.Pool` is lazy: `buildApp` can be constructed before the startup DB phase without issuing a query; the app's `onClose` closes the pool, and Fastify `app.close()` is safe before `listen`.
- App and database clocks are NTP-aligned within seconds; token TTL is 24 h, so `deleteExpired(now)` with the process clock is semantically equivalent to a database-clock predicate for this purpose.
- `verification_tokens.expires_at` is set at issue time from `now + ttl`; `consume` already rejects `usedAt !== null` and `expiresAt <= now`.
- Deleting an expired token leaves `users.verified = false` and does not free the username/email; `POST /auth/resend-verification` is the recovery path (user-authentication AC-6). Re-registration remains blocked by the unique indexes (user-authentication AC-2).
- `LogSink.debug` is additive and does not change the existing event/field/redaction contract; the two existing doubles are updated by the owning task.
- Existing-table index/constraint drift is out of detection scope (D13); the migrations/CI are the repair path.
- Real-Postgres tests use `postgres:16-alpine` through podman/docker and self-skip when neither runtime is available, matching `migration-006.test.ts`/`migration-007.test.ts`. CI's Ubuntu runner provides docker, so the suites run there.
- The deploy pipeline continues to run the existing migration CLI before Render; this feature adds no workflow step and does not change the ordering "migrate → backend → frontend".
- `.env*` remains user-owned and gitignored; no task edits it, and the final confirmation is procedural (AC-27), not a git state check.

## Supersessions of accepted behaviors

Predecessor specs are never edited; this feature records two partial supersessions.

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| `vercel-fly-neon-deployment` AC-10 — startup seam | `server.ts` calls `runStartupMigrations(process.env)` before `buildApp`; `runStartupMigrations` is the exported conditional startup helper | `server.ts` calls `runDatabaseStartup(env, …)` before `listen`; one dedicated `pg.Client` holds the advisory lock and runs the migrations and (optionally) the schema bootstrap, then is ended (AC-9…AC-13). `runStartupMigrations` and its tests stay intact through T6 and are removed by T8 in the same change that rewires `server.ts`; T8 owns `db/migrate-runner.ts` and `db/migrate-runner.test.ts`. | Dedicated `pg.Client` (never a `pg.Pool`), `DIRECT_DATABASE_URL` → `DATABASE_URL` precedence, no-database skip with in-memory repositories, migration failure aborts startup, CLI (`resolveMigrationUrl`/`runMigrationsAgainst`/`migrate-cli`) unchanged |
| `runtime-observability` AC-3 — `LogSink` surface | The event-first sink and `createLogSink` expose/map only `info`/`warn`/`error` | `LogSink` and `LoggerLike` gain `debug(event, fields)` / `debug(fields, event)` and `createLogSink` maps it; the existing three methods, redaction, serializers, levels and the 30-metric catalog are unchanged; the log-event table gains debug rows (AC-1, § Log contract) | The event-first adapter shape, redaction paths/censor, req/res/err serializers, level resolution and every existing event/field contract |

- **Bookkeeping.** `vercel-fly-neon-deployment` is currently `blocked` at its T7 live proof (T1–T6 done); its AC-10 behavior is implemented and is what this spec partially supersedes, not the whole predecessor feature. `docs/features/README.md` and `status.md` remain orchestrator-owned; the stale "task board empty" line in `status.md` is left for the orchestrator transition.

## Revision history

- r1 — 2026-11-24 — initial draft (planning phase): in-process schema bootstrap after migrations with advisory lock, five-table contract, create-missing/warn-drift posture, structured log contract, in-process expired-verification cleanup with interval/overlap/shutdown semantics, config defaults, container/docs/quality criteria.
- r2 — 2026-11-24 — spec review r1: **F1** additive `debug` on `LogSink`/`LoggerLike`/`createLogSink`, owning task and test doubles, partial supersession of `runtime-observability` AC-3; **F2** normative full DDL for the five tables, catalog-equivalence test against `schema.sql`, post-bootstrap/post-recreate repository-insert proofs, defaults/NOT NULL table; **F3** new startup-trace AC; **F4** container AC now runs the stack smoke, machine-checks the compose service/port/volume/healthcheck shape, completes the docs greps, and replaces the vacuous `.env*` git check with a stated manual boundary; **F5** dependency overview corrected for the new task numbering; **F6** cleanup cadence stated as after-settle and overlap AC triggered by a direct `runOnce()`; **F7** shutdown ordering and server wiring split into two ACs and two tasks; **F8** pre-existing `server.ts` composition-root coverage exclusion stated explicitly; **F9** index/constraint drift recorded as an explicit non-goal/limitation; **F10** supersession bookkeeping notes the predecessor is blocked at its live proof; **F11** Render downtime wording reconciliation assigned to the docs task; **F12/Q-5** direct/session-capable startup URL fallback stated; **F13** empty-string config cases added; **F14** sizing notes on the large tasks.
- r3 — 2026-11-24 — spec review r2 (mechanical, no AC renumbering): **R2-F1** `runStartupMigrations` and its tests stay intact through T6; T8 owns `migrate-runner.ts`/`migrate-runner.test.ts` and removes the helper in the same change that rewires `server.ts`; **R2-F2** T8 explicitly accepts AC-10/AC-11 and `server.test.ts` proves no-database → `listen` and lock-stage error → no `listen`; **R2-F3** `user_economy` table order aligned with the normative DDL, `missingColumns` pinned to DDL order, AC-7 adds a two-column fixture; **R2-F4** AC-26 link clause scoped to the five touched docs with a T10 link script, plus README default assertions; **R2-F5** AC-5 is a second `runSchemaBootstrap`, not a full startup; **R2-F6** AC-25/T9 add an 18-key backend environment allow-list assertion and use the `git diff --unified=0` review as exactness evidence.
