# Build log — T10 — Documentation pass

Task: T10 (2026-11-24)
Files changed: `README.md`, `docs/architecture/observability.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/containerization.md`

What changed & why:
- `README.md`: the three lifecycle variables with their exact defaults (`true`, `true`, `3600000`) in the Configuration table, plus a § Database lifecycle section naming `db_schema_bootstrap_completed`, `db_verification_cleanup_run`, the direct/session-capable startup URL requirement and the opt-outs.
- `docs/architecture/observability.md`: documents `LogSink.debug` as the additive fourth sink method and lists all 18 DB lifecycle events (including the debug rows) with fields and levels, the error-field/no-SQL/no-secret rules, and the statement that the catalog stays at exactly 30 metrics.
- `docs/architecture/deployment.md`: records migrations → schema bootstrap → listen under one dedicated direct/session-capable `pg.Client` holding a session advisory lock (250 ms retry, 30 s cap), fail-fast vs warn-and-continue, the in-process best-effort cleanup, and reconciles Render's old/new overlap with "not zero-downtime for clients".
- `docs/architecture/vercel-render-neon.md`: the three committed Render defaults in the environment catalog, the Neon direct/session-capable contract, the failure/cleanup troubleshooting events, and the overlap wording reconciled with `deployment.md`.
- `docs/architecture/containerization.md`: the three compose pass-throughs and that no service/image/Dockerfile/port/volume/healthcheck/route was added ("no new service").

Decisions:
- Documentation-only change. No source, test, compose/render, workflow or `.env*` edit; no new dependency. There is no behavior to unit-test, so the test boundary is the existing frontend documentation link test plus the five-doc link script (integration tier over the repository docs tree), both run below.
- The provider statement "Render uses zero-downtime deploys" is retained as a provider-level statement in `vercel-render-neon.md`; both documents now additionally state that a deploy is not application-level zero-downtime for clients (WebSocket close + in-memory room reset) and that the session advisory lock serializes the overlapping startup phases.
- Event field/level wording mirrors `spec.md` § Log contract exactly; no metric or public surface is claimed. `docs/features/README.md` is untouched and the proposed row diff is recorded below for the orchestrator.

Exact verify commands (from `tasks.md` § T10):

```text
grep -F 'DB_SCHEMA_BOOTSTRAP_ENABLED' README.md
grep -F 'DB_EXPIRED_TOKEN_CLEANUP_ENABLED' README.md
grep -F 'DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS' README.md
grep -F 'db_schema_bootstrap_completed' README.md
grep -F 'db_verification_cleanup_run' README.md
node -e '<README default assertion>'
grep -F 'LogSink.debug' docs/architecture/observability.md
grep -F 'exactly 30' docs/architecture/observability.md
for e in <18 event names>; do grep -F "$e" docs/architecture/observability.md || exit 1; done
grep -F 'schema bootstrap' docs/architecture/deployment.md
grep -F 'advisory lock' docs/architecture/deployment.md
grep -F 'session-capable' docs/architecture/deployment.md
grep -F 'zero-downtime' docs/architecture/deployment.md
grep -F 'DB_SCHEMA_BOOTSTRAP_ENABLED' docs/architecture/vercel-render-neon.md
grep -F 'DB_EXPIRED_TOKEN_CLEANUP_ENABLED' docs/architecture/vercel-render-neon.md
grep -F 'DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS' docs/architecture/vercel-render-neon.md
grep -F 'db_schema_bootstrap_failed' docs/architecture/vercel-render-neon.md
grep -F 'db_verification_cleanup_failed' docs/architecture/vercel-render-neon.md
grep -F 'DB_SCHEMA_BOOTSTRAP_ENABLED' docs/architecture/containerization.md
grep -F 'DB_EXPIRED_TOKEN_CLEANUP_ENABLED' docs/architecture/containerization.md
grep -F 'DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS' docs/architecture/containerization.md
grep -F 'no new service' docs/architecture/containerization.md
node -e '<five-doc relative-link resolution>'
npm run test --workspace @cubeclicker/frontend -- src/docs/links.test.ts
git status --porcelain -- docs/features/README.md
```

Raw transcript (the runner echoes `$*`, so the quoting differs from the list above; each command was run exactly as pinned in `tasks.md`):

```text
$ grep -F DB_SCHEMA_BOOTSTRAP_ENABLED README.md
| `DB_SCHEMA_BOOTSTRAP_ENABLED` | `true` | startup schema bootstrap: after migrations and before `listen`, check the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`) and create any missing one; `false` keeps migrations and skips only the bootstrap |
- **Opt-outs and no-database mode.** `DB_SCHEMA_BOOTSTRAP_ENABLED=false` still applies migrations and skips the bootstrap; `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=false` starts no cleanup scheduler. With neither database URL set (host-only runs), both services are skipped and the backend uses the in-memory repositories. An invalid or empty value fails startup naming the variable.
DB_SCHEMA_BOOTSTRAP_ENABLED=false podman compose up
exit=0
---
$ grep -F DB_EXPIRED_TOKEN_CLEANUP_ENABLED README.md
| `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` | `true` | in-process expired-verification cleanup: after `listen`, delete `verification_tokens` rows with `expires_at <= now`; `false` starts no scheduler |
- **Opt-outs and no-database mode.** `DB_SCHEMA_BOOTSTRAP_ENABLED=false` still applies migrations and skips the bootstrap; `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=false` starts no cleanup scheduler. With neither database URL set (host-only runs), both services are skipped and the backend uses the in-memory repositories. An invalid or empty value fails startup naming the variable.
exit=0
---
$ grep -F DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS README.md
| `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` | `3600000` | delay in ms between cleanup runs, measured from the previous run's settlement; integer 60000–86400000 (default one hour) |
- **After listen: expired-verification cleanup.** The in-process scheduler deletes only `verification_tokens` rows with `expires_at <= now` once immediately and then `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` after each run settles (default one hour; 60,000–86,400,000 ms). Each run logs `db_verification_cleanup_run` (`deleted`, `durationMs`; `info` when rows were deleted, `debug` when none); a failed run logs `db_verification_cleanup_failed` and never stops the next scheduled run. `SIGTERM`/`SIGINT` stops the scheduler before the pool closes.
DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=600000 podman compose up
exit=0
---
$ grep -F db_schema_bootstrap_completed README.md
- **Startup: migrations → schema bootstrap → listen.** On one dedicated direct-URL `pg.Client`, the backend acquires a session-level Postgres advisory lock (retrying every 250 ms for at most 30 s), applies pending numbered migrations, then checks the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`). A missing table and its indexes are created with idempotent `CREATE ... IF NOT EXISTS` DDL in one transaction per table; a required column missing from an existing table is logged as `db_schema_table_outdated` and never altered. `db_schema_bootstrap_completed` (`checked`, `created`, `outdated`, `durationMs`) summarizes the check and `db_startup_completed` closes the phase. A connect, lock, migration or table-creation failure logs `db_startup_failed` and exits `1` without listening. `DIRECT_DATABASE_URL` wins on Neon; when it is absent, the fallback `DATABASE_URL` must be direct/session-capable (the local compose Postgres is direct, while a pooled `-pooler` URL cannot carry a session advisory lock).
exit=0
---
$ grep -F db_verification_cleanup_run README.md
- **After listen: expired-verification cleanup.** The in-process scheduler deletes only `verification_tokens` rows with `expires_at <= now` once immediately and then `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` after each run settles (default one hour; 60,000–86,400,000 ms). Each run logs `db_verification_cleanup_run` (`deleted`, `durationMs`; `info` when rows were deleted, `debug` when none); a failed run logs `db_verification_cleanup_failed` and never stops the next scheduled run. `SIGTERM`/`SIGINT` stops the scheduler before the pool closes.
exit=0
---
$ node -e const fs=require("node:fs");const lines=fs.readFileSync("README.md","utf8").split("\n");for(const [v,d] of [["DB_SCHEMA_BOOTSTRAP_ENABLED","true"],["DB_EXPIRED_TOKEN_CLEANUP_ENABLED","true"],["DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS","3600000"]]){const row=lines.find((l)=>l.includes("| `"+v+"` |"));if(!row||!row.includes("| `"+d+"` |"))throw new Error("README default missing: "+v+"="+d);}console.log("README defaults OK")
README defaults OK
exit=0
---
$ grep -F LogSink.debug docs/architecture/observability.md
- **Adapter.** The hub, shutdown and database-lifecycle code log through the event-first `LogSink` (`debug(event, fields)`, `info(event, fields)`, `warn(event, fields)`, `error(event, fields)`); `createLogSink` calls Pino object-first (`logger.debug(fields, event)`, `logger.info(fields, event)`, …), so the structured fields are emitted instead of dropped. `LogSink.debug` is the additive fourth method: the existing `info`/`warn`/`error` mapping, redaction paths, serializers, levels and event names are unchanged, and debug rows appear only when the configured level is `debug` (the development default, or `LOG_LEVEL=debug`).
exit=0
---
$ grep -F exactly 30 docs/architecture/observability.md
- **No new metric.** This feature adds no metric series and the fixed catalog below stays at exactly 30 metrics: no `cubeclicker_db_bootstrap*` or `cubeclicker_db_cleanup*` series exists, and `/metrics` continues to serve only the catalog entries listed in § Metrics catalog.
exit=0
---
$ for e in db_startup_lock_wait db_startup_lock_acquired db_migrations_applied db_migrations_up_to_date db_schema_bootstrap_started db_schema_table_present db_schema_table_created db_schema_table_outdated db_schema_bootstrap_completed db_schema_bootstrap_skipped db_schema_bootstrap_failed db_startup_completed db_startup_failed db_verification_cleanup_started db_verification_cleanup_skipped db_verification_cleanup_run db_verification_cleanup_failed db_verification_cleanup_stopped; do grep -F "$e" docs/architecture/observability.md || exit 1; done
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
- **Visibility.** `db_schema_bootstrap_skipped { reason: 'no_database' }` and `db_verification_cleanup_skipped { reason: 'no_database' }` are debug lines for host-only runs without a database; the `disabled` variants are info lines because an operator turned a service off explicitly.
| `db_schema_bootstrap_failed` | `table`, `errorType`, optional string `code` | error |
| `db_startup_completed` | `migrated`, `created`, `outdated`, `durationMs` | info |
| `db_startup_failed` | `stage` (`connect`/`lock`/`migrations`/`bootstrap`), `errorType`, optional string `code` | error |
| `db_verification_cleanup_started` | `intervalMs` | info |
| `db_verification_cleanup_skipped` | `reason`: `no_database` (debug), `disabled` (info) or `in_flight` (debug) | debug / info |
- **Visibility.** `db_schema_bootstrap_skipped { reason: 'no_database' }` and `db_verification_cleanup_skipped { reason: 'no_database' }` are debug lines for host-only runs without a database; the `disabled` variants are info lines because an operator turned a service off explicitly.
| `db_verification_cleanup_run` | `deleted`, `durationMs` | info when `deleted > 0`, debug when `0` |
| `db_verification_cleanup_failed` | `errorType`, optional string `code` | error |
| `db_verification_cleanup_stopped` | — | info |
exit=0
---
$ grep -F schema bootstrap docs/architecture/deployment.md
- **Render runtime configuration** is committed for the non-secret values in `render.yaml` (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, `METRICS_ENABLED=false`, `MAX_USERS_PER_SERVER=10`, `DB_SCHEMA_BOOTSTRAP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000`) and set in the Render dashboard for the remaining `sync: false` names (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `CORS_ORIGIN`, `ALLOWED_ORIGIN`, `APP_BASE_URL`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`); `render.yaml` keeps `sync: false` and no value for every name. The seven SMTP names are synced from the GitHub Environment, while those remaining `sync: false` names `stay dashboard-owned` and are `never synced`. `DATABASE_URL` (pooled) serves application queries and `DIRECT_DATABASE_URL` (direct) serves the startup phase (advisory lock, migrations and schema bootstrap). Secrets are never baked into the image or echoed in logs.
- `DATABASE_URL` is the pooled `-pooler` URL for the Render service's runtime queries. `DIRECT_DATABASE_URL` is the direct URL for the CI migration job and the Render startup phase (advisory lock, migrations and schema bootstrap), which runs on a dedicated `pg.Client` so `BEGIN`, every statement and `COMMIT` share one connection (PgBouncer transaction pooling is not used for migrations).
- Ordering is fixed: **migrate (CI) → schema bootstrap → listen → backend deploy → frontend deploy**. CI runs `npx --no-install tsx src/backend/src/db/migrate-cli.ts` with `DIRECT_DATABASE_URL` before triggering Render; the image also packages `dist/db/migrations`, so the startup phase's migration step is an idempotent safety net and a no-op after CI. `node dist/db/migrate-cli.js --list` lists migration names without opening a connection. The startup schema bootstrap then verifies the five required tables before the process accepts traffic.
## Database startup phase and schema bootstrap
The backend runs the database lifecycle phase itself at every boot, before it accepts traffic: build the app (logger + pool) → one dedicated direct-URL `pg.Client` → acquire a session-level Postgres advisory lock (retrying every 250 ms for at most 30 s) → apply pending migrations → run the schema bootstrap → best-effort unlock and end the client → `listen`. The bootstrap checks the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`), creates any missing table and its indexes with idempotent `CREATE ... IF NOT EXISTS` DDL in one transaction per table, and reports required columns missing from an existing table without altering it. The numbered migrations remain the only schema-evolution authority; a table recreated by the bootstrap uses the final consolidated shape.
- A deploy or cold start restarts the process and closes every WebSocket. Clients reconnect automatically (10 attempts, 500 ms → 5 s backoff) and in-memory rooms reset; there is no zero-downtime deploy, by design and by the room model. Render's brief old/new instance overlap during a deploy does not change this: the provider may run both processes for a moment, but clients still lose and re-establish their sockets and the new instance starts with empty rooms (§ Database startup phase and schema bootstrap records the advisory-lock safety of that overlap).
exit=0
---
$ grep -F advisory lock docs/architecture/deployment.md
- **Render runtime configuration** is committed for the non-secret values in `render.yaml` (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, `METRICS_ENABLED=false`, `MAX_USERS_PER_SERVER=10`, `DB_SCHEMA_BOOTSTRAP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000`) and set in the Render dashboard for the remaining `sync: false` names (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `CORS_ORIGIN`, `ALLOWED_ORIGIN`, `APP_BASE_URL`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`); `render.yaml` keeps `sync: false` and no value for every name. The seven SMTP names are synced from the GitHub Environment, while those remaining `sync: false` names `stay dashboard-owned` and are `never synced`. `DATABASE_URL` (pooled) serves application queries and `DIRECT_DATABASE_URL` (direct) serves the startup phase (advisory lock, migrations and schema bootstrap). Secrets are never baked into the image or echoed in logs.
- `DATABASE_URL` is the pooled `-pooler` URL for the Render service's runtime queries. `DIRECT_DATABASE_URL` is the direct URL for the CI migration job and the Render startup phase (advisory lock, migrations and schema bootstrap), which runs on a dedicated `pg.Client` so `BEGIN`, every statement and `COMMIT` share one connection (PgBouncer transaction pooling is not used for migrations).
The backend runs the database lifecycle phase itself at every boot, before it accepts traffic: build the app (logger + pool) → one dedicated direct-URL `pg.Client` → acquire a session-level Postgres advisory lock (retrying every 250 ms for at most 30 s) → apply pending migrations → run the schema bootstrap → best-effort unlock and end the client → `listen`. The bootstrap checks the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`), creates any missing table and its indexes with idempotent `CREATE ... IF NOT EXISTS` DDL in one transaction per table, and reports required columns missing from an existing table without altering it. The numbered migrations remain the only schema-evolution authority; a table recreated by the bootstrap uses the final consolidated shape.
- **URL requirement: direct/session-capable.** The phase prefers `DIRECT_DATABASE_URL` and falls back to `DATABASE_URL`. The fallback must be a direct/session-capable URL: the advisory lock is session-scoped and DDL must not cross PgBouncer transaction boundaries. On Neon both URLs are set and the direct one wins; local compose points directly at the compose Postgres, so the fallback works there. A deployment that sets only the pooled `-pooler` URL cannot use the lock/DDL phase (the runner does not sniff provider hostnames): provide the direct URL or set `DB_SCHEMA_BOOTSTRAP_ENABLED=false` and rely on the CI migration.
- **Advisory-lock safety under Render's old/new overlap.** On a deploy Render builds first and then starts the new instance before the old one is fully retired (see `vercel-render-neon.md` § Architecture). Both processes may therefore run the startup phase concurrently; the session advisory lock serializes them, so the second instance waits (bounded at 30 s) until the first releases the lock and then finds the schema complete. That provider-level overlap is **not** application-level zero-downtime for clients: when traffic switches, the old instance's WebSockets close, clients follow the bounded reconnect policy and rejoin, and the new instance starts with empty in-memory rooms (§ Single-instance trade-off). The advisory lock makes the DDL phase safe under either provider behavior; it does not make a deploy invisible to connected clients.
exit=0
---
$ grep -F session-capable docs/architecture/deployment.md
- **URL requirement: direct/session-capable.** The phase prefers `DIRECT_DATABASE_URL` and falls back to `DATABASE_URL`. The fallback must be a direct/session-capable URL: the advisory lock is session-scoped and DDL must not cross PgBouncer transaction boundaries. On Neon both URLs are set and the direct one wins; local compose points directly at the compose Postgres, so the fallback works there. A deployment that sets only the pooled `-pooler` URL cannot use the lock/DDL phase (the runner does not sniff provider hostnames): provide the direct URL or set `DB_SCHEMA_BOOTSTRAP_ENABLED=false` and rely on the CI migration.
exit=0
---
$ grep -F zero-downtime docs/architecture/deployment.md
- **Advisory-lock safety under Render's old/new overlap.** On a deploy Render builds first and then starts the new instance before the old one is fully retired (see `vercel-render-neon.md` § Architecture). Both processes may therefore run the startup phase concurrently; the session advisory lock serializes them, so the second instance waits (bounded at 30 s) until the first releases the lock and then finds the schema complete. That provider-level overlap is **not** application-level zero-downtime for clients: when traffic switches, the old instance's WebSockets close, clients follow the bounded reconnect policy and rejoin, and the new instance starts with empty in-memory rooms (§ Single-instance trade-off). The advisory lock makes the DDL phase safe under either provider behavior; it does not make a deploy invisible to connected clients.
- A deploy or cold start restarts the process and closes every WebSocket. Clients reconnect automatically (10 attempts, 500 ms → 5 s backoff) and in-memory rooms reset; there is no zero-downtime deploy, by design and by the room model. Render's brief old/new instance overlap during a deploy does not change this: the provider may run both processes for a moment, but clients still lose and re-establish their sockets and the new instance starts with empty rooms (§ Database startup phase and schema bootstrap records the advisory-lock safety of that overlap).
exit=0
---
$ grep -F DB_SCHEMA_BOOTSTRAP_ENABLED docs/architecture/vercel-render-neon.md
| `DB_SCHEMA_BOOTSTRAP_ENABLED` | value `true` | startup schema bootstrap after migrations and before `listen`: check the five required tables and create a missing one; `false` keeps migrations and skips only the bootstrap |
- **Table creation is denied:** `db_schema_bootstrap_failed { table, errorType, code }` means the startup role cannot create the table (usually `CREATE` on `public`). Grant DDL to the direct-URL role or set `DB_SCHEMA_BOOTSTRAP_ENABLED=false` and rely on the CI migration. `db_schema_table_outdated { table, missingColumns }` at `warn` is schema drift: apply the missing migration; the bootstrap never alters an existing table.
- **Changed only where this feature required it.** Same WebSocket protocol, heartbeat/reconnect/grace, server authority, room model, auth model and database schema; `compose.yaml` gained the two SMTP pass-throughs (`SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`) and the three DB lifecycle pass-throughs (`DB_SCHEMA_BOOTSTRAP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS`), and `compose.smoke.yaml` pins the smoke backend to Mailpit. The nginx config, frontend Dockerfile and `tests/e2e/smoke.mjs` are unchanged, and Vercel hosts the static SPA, not a Fastify process or a serverless WebSocket.
exit=0
---
$ grep -F DB_EXPIRED_TOKEN_CLEANUP_ENABLED docs/architecture/vercel-render-neon.md
| `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` | value `true` | in-process expired-verification cleanup after `listen`; `false` starts no scheduler |
- **Changed only where this feature required it.** Same WebSocket protocol, heartbeat/reconnect/grace, server authority, room model, auth model and database schema; `compose.yaml` gained the two SMTP pass-throughs (`SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`) and the three DB lifecycle pass-throughs (`DB_SCHEMA_BOOTSTRAP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS`), and `compose.smoke.yaml` pins the smoke backend to Mailpit. The nginx config, frontend Dockerfile and `tests/e2e/smoke.mjs` are unchanged, and Vercel hosts the static SPA, not a Fastify process or a serverless WebSocket.
exit=0
---
$ grep -F DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS docs/architecture/vercel-render-neon.md
| `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` | value `3600000` | cleanup cadence in ms, measured from the previous run's settlement; integer 60000–86400000 |
- **Changed only where this feature required it.** Same WebSocket protocol, heartbeat/reconnect/grace, server authority, room model, auth model and database schema; `compose.yaml` gained the two SMTP pass-throughs (`SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`) and the three DB lifecycle pass-throughs (`DB_SCHEMA_BOOTSTRAP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS`), and `compose.smoke.yaml` pins the smoke backend to Mailpit. The nginx config, frontend Dockerfile and `tests/e2e/smoke.mjs` are unchanged, and Vercel hosts the static SPA, not a Fastify process or a serverless WebSocket.
exit=0
---
$ grep -F db_schema_bootstrap_failed docs/architecture/vercel-render-neon.md
- **Table creation is denied:** `db_schema_bootstrap_failed { table, errorType, code }` means the startup role cannot create the table (usually `CREATE` on `public`). Grant DDL to the direct-URL role or set `DB_SCHEMA_BOOTSTRAP_ENABLED=false` and rely on the CI migration. `db_schema_table_outdated { table, missingColumns }` at `warn` is schema drift: apply the missing migration; the bootstrap never alters an existing table.
exit=0
---
$ grep -F db_verification_cleanup_failed docs/architecture/vercel-render-neon.md
- **Cleanup fails or deletes nothing:** `db_verification_cleanup_failed { errorType, code? }` is non-fatal; the scheduler keeps running and the next interval retries. `db_verification_cleanup_run { deleted, durationMs }` confirms a run (an `info` line when it deleted rows, `debug` when zero). Cleanup only touches expired `verification_tokens` rows; it never changes `users.verified` or sessions.
exit=0
---
$ grep -F DB_SCHEMA_BOOTSTRAP_ENABLED docs/architecture/containerization.md
- **DB lifecycle environment pass-throughs (no new service).** `compose.yaml` passes `DB_SCHEMA_BOOTSTRAP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` (default `true`) and `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (default `3600000`, one hour) to the existing `backend` service. The startup schema bootstrap and the expired-verification cleanup are in-process modules compiled into the existing backend image, so there is no new service, image, Dockerfile stage, port, volume, healthcheck or route: the backend still `depends_on` the healthy `db` service, `GET /healthz` still returns `{"status":"ok"}`, and `GET /ws` stays on port `8080` (connectable only after the schema phase completes). A missing table is created with idempotent DDL under a Postgres advisory lock before the process listens; cleanup runs after `listen` over the existing pool and stops before the pool closes. The three names are non-secret, defaulted identically in `compose.yaml` and `render.yaml`, and are the per-container opt-outs (`false` disables the bootstrap or the scheduler) without a code change.
exit=0
---
$ grep -F DB_EXPIRED_TOKEN_CLEANUP_ENABLED docs/architecture/containerization.md
- **DB lifecycle environment pass-throughs (no new service).** `compose.yaml` passes `DB_SCHEMA_BOOTSTRAP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` (default `true`) and `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (default `3600000`, one hour) to the existing `backend` service. The startup schema bootstrap and the expired-verification cleanup are in-process modules compiled into the existing backend image, so there is no new service, image, Dockerfile stage, port, volume, healthcheck or route: the backend still `depends_on` the healthy `db` service, `GET /healthz` still returns `{"status":"ok"}`, and `GET /ws` stays on port `8080` (connectable only after the schema phase completes). A missing table is created with idempotent DDL under a Postgres advisory lock before the process listens; cleanup runs after `listen` over the existing pool and stops before the pool closes. The three names are non-secret, defaulted identically in `compose.yaml` and `render.yaml`, and are the per-container opt-outs (`false` disables the bootstrap or the scheduler) without a code change.
exit=0
---
$ grep -F DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS docs/architecture/containerization.md
- **DB lifecycle environment pass-throughs (no new service).** `compose.yaml` passes `DB_SCHEMA_BOOTSTRAP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` (default `true`) and `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (default `3600000`, one hour) to the existing `backend` service. The startup schema bootstrap and the expired-verification cleanup are in-process modules compiled into the existing backend image, so there is no new service, image, Dockerfile stage, port, volume, healthcheck or route: the backend still `depends_on` the healthy `db` service, `GET /healthz` still returns `{"status":"ok"}`, and `GET /ws` stays on port `8080` (connectable only after the schema phase completes). A missing table is created with idempotent DDL under a Postgres advisory lock before the process listens; cleanup runs after `listen` over the existing pool and stops before the pool closes. The three names are non-secret, defaulted identically in `compose.yaml` and `render.yaml`, and are the per-container opt-outs (`false` disables the bootstrap or the scheduler) without a code change.
exit=0
---
$ grep -F no new service docs/architecture/containerization.md
- **DB lifecycle environment pass-throughs (no new service).** `compose.yaml` passes `DB_SCHEMA_BOOTSTRAP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` (default `true`) and `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (default `3600000`, one hour) to the existing `backend` service. The startup schema bootstrap and the expired-verification cleanup are in-process modules compiled into the existing backend image, so there is no new service, image, Dockerfile stage, port, volume, healthcheck or route: the backend still `depends_on` the healthy `db` service, `GET /healthz` still returns `{"status":"ok"}`, and `GET /ws` stays on port `8080` (connectable only after the schema phase completes). A missing table is created with idempotent DDL under a Postgres advisory lock before the process listens; cleanup runs after `listen` over the existing pool and stops before the pool closes. The three names are non-secret, defaulted identically in `compose.yaml` and `render.yaml`, and are the per-container opt-outs (`false` disables the bootstrap or the scheduler) without a code change.
- **Verification-email assets.** `src/frontend/public/email/cubeclicker-hero.png` and `cubeclicker-cube.png` are committed static files in the frontend `public/` tree, so the existing frontend origins serve `/email/*.png` with no new service, port, route, volume or Dockerfile change: Vite on 5173 in `dev`, this nginx `prod` image and Vercel in deployment. The T9 serving proof fetches both files over the compose network from the Vite dev server and the nginx image (`200`, `image/png`, PNG signature); the deployed-origin check is a documented recipe in `docs/architecture/vercel-render-neon.md` § SMTP and email. The backend image is unchanged and sends no attachments.
exit=0
---
$ node -e const fs=require("node:fs");const path=require("node:path");const docs=["README.md","docs/architecture/observability.md","docs/architecture/deployment.md","docs/architecture/vercel-render-neon.md","docs/architecture/containerization.md"];const bad=[];for(const d of docs){const t=fs.readFileSync(d,"utf8");for(const m of t.matchAll(/\]\(([^)\s]+)\)/g)){const l=m[1];if(/^(https?:|#|mailto:)/.test(l))continue;const p=path.resolve(path.dirname(d),l.split("#")[0]);if(!fs.existsSync(p))bad.push(d+" -> "+l);}}if(bad.length)throw new Error("broken links: "+bad.join(", "));console.log("five-doc relative links OK")
five-doc relative links OK
exit=0
---
$ npm run test --workspace @cubeclicker/frontend -- src/docs/links.test.ts

> test
> vitest run src/docs/links.test.ts


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/docs/links.test.ts (1 test) 2ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  10:08:47
   Duration  233ms (transform 21ms, setup 0ms, collect 18ms, tests 2ms, environment 0ms, prepare 62ms)

exit=0
---
$ git status --porcelain -- docs/features/README.md
exit=0
---
```

All 25 verify commands exited `0`. The five-doc link script printed `five-doc relative links OK`; the frontend link suite passed `1 passed (1)`; `git status --porcelain -- docs/features/README.md` printed nothing.

Additional scope evidence (only the five owned docs are modified; `docs/features/README.md` untouched):

```text
$ git status --porcelain
 M README.md
 M docs/architecture/containerization.md
 M docs/architecture/deployment.md
 M docs/architecture/observability.md
 M docs/architecture/vercel-render-neon.md
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/plan.md
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/reviews/
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/spec.md
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/status.md
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/tasks.md

$ git diff --stat
 README.md                               | 20 ++++++++++++++++++++
 docs/architecture/containerization.md   |  1 +
 docs/architecture/deployment.md         | 20 +++++++++++++++-----
 docs/architecture/observability.md      | 32 +++++++++++++++++++++++++++++++-
 docs/architecture/vercel-render-neon.md | 19 +++++++++++++------
 5 files changed, 80 insertions(+), 12 deletions(-)
```

(The untracked feature artifacts pre-date T10 and are orchestrator-owned; none was edited or staged by this task.)

## Proposed `docs/features/README.md` row (orchestrator applies; builder does not edit)

```diff
--- a/docs/features/README.md
+++ b/docs/features/README.md
@@ -64,5 +64,6 @@ Feature work runs through the agent workflow (see `AGENTS.md`). Every feature li
 | remote-spaceship-customization | Remote Spaceship Customization (other players' ships + 1,351 chassis/form/shot options) | accepted | 2026-11-19 |
 | brevo-smtp-email-delivery | Brevo SMTP Email Delivery & Branded Verification Email (Brevo SMTP for development/production with TLS/timeout config and SMTP-key vs REST-API-key guidance, branded table email with public PNG assets and image-blocked fallback, user-owned delivery CLI, Mailpit-pinned smoke) | accepted | 2026-11-22 |
 | deploy-brevo-env-placeholders | Deployment Brevo Environment Placeholders (GitHub development/production env vars+secrets, strict placeholder guard, GitHub→Render SMTP sync, Mailpit kept local) | accepted | 2026-11-23 |
+| db-schema-bootstrap-and-expiry-cleanup | DB Schema Bootstrap & Expired Verification Cleanup (in-process required-table check/create with advisory lock, structured traces, hourly expired verification-token cleanup) | accepted | 2026-11-24 |
 
 States: `planning` · `spec_review` · `awaiting_approval` · `building` · `code_review` · `accepted` · `blocked` · `escalated`
```

Exact row text:

```text
| db-schema-bootstrap-and-expiry-cleanup | DB Schema Bootstrap & Expired Verification Cleanup (in-process required-table check/create with advisory lock, structured traces, hourly expired verification-token cleanup) | accepted | 2026-11-24 |
```

The `accepted` state/date is the row for the acceptance transition; if the orchestrator applies the index before acceptance, the same row with `building` (or the current state) is the only change.

Acceptance audit:
- AC-26 → met. `README.md` lists all three variables with defaults `true`, `true`, `3600000` (README default assertion printed `README defaults OK`) and names `db_schema_bootstrap_completed` and `db_verification_cleanup_run`; `observability.md` documents `LogSink.debug`, contains all 18 event names (including the debug rows) and states the catalog stays at exactly 30 metrics; `deployment.md` records schema bootstrap, advisory lock, session-capable startup URL, fail-fast, in-process cleanup and reconciles `zero-downtime` with the "not zero-downtime for clients" statement; `vercel-render-neon.md` records the three committed defaults (`true`/`true`/`3600000`) and the `db_schema_bootstrap_failed`/`db_verification_cleanup_failed` troubleshooting events; `containerization.md` records all three compose pass-throughs and `no new service`; every relative link in the five docs resolves (`five-doc relative links OK`, frontend `src/docs/links.test.ts` 1/1 green); `docs/features/README.md` is untouched (empty `git status --porcelain` for it) and only the row diff above is proposed.

Deviations from spec: none.
