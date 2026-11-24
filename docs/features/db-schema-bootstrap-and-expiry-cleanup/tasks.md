# Tasks — DB Schema Bootstrap & Expired Verification Cleanup

Dependency overview: `T1 → {T4, T5, T7}`; `T2 → T4`; `T3 → {T6, T8, T9}`; `T4 → T6`; `{T3, T5, T6, T7} → T8`; `T8 → T9 → T10 → T11`. Startable in parallel: `T1 ∥ T2 ∥ T3`.

```text
T1 (logging debug) ─┬→ T4 (bootstrap) → T6 (startup) ─┐
T2 (contract) ──────┘                                 │
T1 ─────────────────→ T5 (cleanup) ───────────────────┤
T1 ─────────────────→ T7 (shutdown) ──────────────────┤
T3 (config) ────────→ T6 ─────────────────────────────┤
T3 ─────────────────→ T8 (server wiring) ←────────────┘
T3 ─────────────────→ T9 (compose/render)
T5, T6, T7 ─────────→ T8
T8 → T9 → T10 (docs) → T11 (verify)
```

## T1 — Additive debug log sink `[P]`
depends_on: —
files_owned: `src/backend/src/observability/logging.ts`, `src/backend/src/observability/logging.test.ts`, `src/backend/src/game/hub.test.ts`, `src/backend/src/observability/shutdown.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend -- src/observability/logging.test.ts src/observability/shutdown.test.ts src/game/hub.test.ts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-1
notes: Add `debug(event, fields)` to `LogSink`, `debug(fields, event)` to `LoggerLike`, and map it in `createLogSink`; update both existing `LogSink` doubles. Do not change redaction, serializers, levels or existing event names. The partial supersession of `runtime-observability` AC-3 is recorded in `spec.md` § Supersessions.
status: [x]

## T2 — Full DDL contract and catalog-equivalence proof `[P]`
depends_on: —
files_owned: `src/backend/src/db/schema-contract.ts`, `src/backend/src/db/schema-contract.test.ts`, `src/backend/src/db/schema-contract-postgres.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend -- src/db/schema-contract.test.ts src/db/schema-contract-postgres.test.ts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-2
notes: Pin the normative DDL from `spec.md` § Required schema contract verbatim; the unit test does two-way migration/`schema.sql` table/column/default checks; the Postgres test applies `schema.sql` and the contract DDL into two separate schemas and asserts normalized column/constraint/index equality. Use the existing throwaway `postgres:16-alpine` helper pattern (podman/docker; skip only when no runtime). If the session size cap is tight, split the unit and Postgres equivalence suites and record the split in the build log.
status: [x]

## T3 — DB lifecycle configuration `[P]`
depends_on: —
files_owned: `src/backend/src/db/lifecycle-config.ts`, `src/backend/src/db/lifecycle-config.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend -- src/db/lifecycle-config.test.ts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-14
notes: Include empty-string cases for all three variables; invalid values throw naming the exact variable.
status: [x]

## T4 — Schema bootstrap runner and functional PostgreSQL proof `[seq]`
depends_on: T1, T2
files_owned: `src/backend/src/db/schema-bootstrap.ts`, `src/backend/src/db/schema-bootstrap.test.ts`, `src/backend/src/db/schema-bootstrap-postgres.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend -- src/db/schema-bootstrap.test.ts src/db/schema-bootstrap-postgres.test.ts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-23
notes: The Postgres suite must prove (a) empty-DB creation with the pinned defaults and a `PgUserRepository.create`/`PgSessionRepository.create`/`PgVerificationTokenRepository.create`/raw `user_economy` insert round-trip, and (b) after dropping/recreating `verification_tokens`, a `PgVerificationTokenRepository.create` insert succeeds. AC-5 is a second `runSchemaBootstrap` run on the complete schema, not a second full startup (the migration runner's `CREATE TABLE IF NOT EXISTS schema_migrations` would otherwise appear in the recording). AC-7 includes a two-column fixture (`failed_login_attempts,locked_until`) asserting `missingColumns` is comma-joined in the normative DDL order, not alphabetical. If the session size cap is tight, split the unit and Postgres suites and record the split in the build log.
status: [x]

## T5 — Expired verification cleanup scheduler and PostgreSQL proof `[P]`
depends_on: T1
files_owned: `src/backend/src/db/verification-cleanup.ts`, `src/backend/src/db/verification-cleanup.test.ts`, `src/backend/src/db/verification-cleanup-postgres.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend -- src/db/verification-cleanup.test.ts src/db/verification-cleanup-postgres.test.ts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-15, AC-16, AC-17, AC-18, AC-19, AC-23
notes: Cadence is `intervalMs` after the previous run settles; assert 0/interval/2×interval for an immediately-resolving repo and a shifted tick for a delayed run. Trigger the overlap guard by calling the public `runOnce()` while a deferred run is pending. If the session size cap is tight, split the unit and Postgres suites and record the split in the build log.
status: [x]

## T6 — Startup phase with advisory lock, migrations, bootstrap and traces `[seq]`
depends_on: T1, T3, T4
files_owned: `src/backend/src/db/startup.ts`, `src/backend/src/db/startup.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend -- src/db/startup.test.ts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-9, AC-10 (startup-module half), AC-11 (startup-module half), AC-12, AC-13, AC-23
notes: Keep `runStartupMigrations` and its tests intact through this task (so `server.ts` still typechecks); T8 removes the helper and owns `migrate-runner.ts`/`migrate-runner.test.ts`. `startup.test.ts` asserts the startup-module halves of AC-10/AC-11 (no-database skip without a client; lock-stage `DatabaseStartupError`) and the startup trace events (AC-13). `DatabaseStartupError` exposes `stage`, `errorType` and optional `code` from its cause. The direct/session-capable fallback (Q-5) is documented, not hostname-sniffed.
status: [x]

## T7 — Shutdown `beforeClose` hook `[P]`
depends_on: T1
files_owned: `src/backend/src/observability/shutdown.ts`, `src/backend/src/observability/shutdown-before-close.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend -- src/observability/shutdown.test.ts src/observability/shutdown-before-close.test.ts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-20
notes: `shutdown.test.ts` is owned by T1 (only its recorder gains `debug`); do not edit it. Put the new `beforeClose` ordering/rejection tests in `shutdown-before-close.test.ts`.
status: [x]

## T8 — Server wiring: build-first, startup, cleanup lifecycle, exit path `[seq]`
depends_on: T3, T5, T6, T7
files_owned: `src/backend/src/server.ts`, `src/backend/src/server.test.ts`, `src/backend/src/db/migrate-runner.ts`, `src/backend/src/db/migrate-runner.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend -- src/server.test.ts src/app.test.ts src/db/migrate-runner.test.ts src/db/migrate-cli.test.ts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-10, AC-11, AC-21, AC-22, AC-23
notes: Build the app before `runDatabaseStartup`; on failure log `db_startup_failed`, close the app, exit 1, never listen. Remove `runStartupMigrations` and its tests atomically with the `server.ts` rewire (the helper is kept intact through T6); keep `resolveStartupMigrationUrl`, `resolveMigrationUrl`, `runMigrationsAgainst`. Start cleanup after `listen`; pass `beforeClose` to shutdown; return `{ started, cleanup }`. Export `startServer` with a direct-invocation guard. `server.test.ts` must assert the server halves of AC-10/AC-11 (no database → `listen` with in-memory repositories; lock-stage `DatabaseStartupError` → no `listen`) alongside AC-22's bootstrap-stage failure/exit, and every cleanup skip/start path. `server.ts` remains under the pre-existing composition-root coverage exclusion. If the session size cap is tight, split the module-mocked suite and record the split in the build log.
status: [x]

## T9 — Container and Render configuration, proven by the stack smoke `[seq]`
depends_on: T3, T8
files_owned: `compose.yaml`, `render.yaml`
verify: `node -e 'const fs=require("node:fs");const yaml=require("js-yaml");const c=yaml.load(fs.readFileSync("compose.yaml","utf8"));const s=c.services;const names=Object.keys(s).sort();const expected=["adminer","backend","db","frontend","mailpit"];if(JSON.stringify(names)!==JSON.stringify(expected))throw new Error("compose services changed: "+names.join(","));const b=s.backend;const expectedEnv=["ALLOWED_ORIGIN","APP_BASE_URL","DATABASE_URL","DB_EXPIRED_TOKEN_CLEANUP_ENABLED","DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS","DB_SCHEMA_BOOTSTRAP_ENABLED","LOG_LEVEL","MAX_USERS_PER_SERVER","METRICS_ENABLED","NODE_ENV","SESSION_COOKIE_SECURE","SMTP_CONNECTION_TIMEOUT_MS","SMTP_FROM","SMTP_HOST","SMTP_PASS","SMTP_PORT","SMTP_SECURE","SMTP_USER"];if(JSON.stringify(Object.keys(b.environment).sort())!==JSON.stringify(expectedEnv))throw new Error("backend environment keys changed");for(const [k,v] of [["DB_SCHEMA_BOOTSTRAP_ENABLED","${DB_SCHEMA_BOOTSTRAP_ENABLED:-true}"],["DB_EXPIRED_TOKEN_CLEANUP_ENABLED","${DB_EXPIRED_TOKEN_CLEANUP_ENABLED:-true}"],["DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS","${DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS:-3600000}"]]){if(b.environment[k]!==v)throw new Error("bad "+k+": "+b.environment[k]);}if(JSON.stringify(b.ports)!==JSON.stringify(["127.0.0.1:${BACKEND_PORT:-8080}:8080"]))throw new Error("backend ports changed");if(JSON.stringify(b.volumes)!==JSON.stringify(["./src/backend:/app/src/backend:z"]))throw new Error("backend volumes changed");if(JSON.stringify(b.depends_on)!==JSON.stringify({db:{condition:"service_healthy"}}))throw new Error("backend depends_on changed");if(b.image!=="cubeclicker-backend:dev")throw new Error("backend image changed");if(b.healthcheck!==undefined)throw new Error("backend healthcheck added");console.log("compose shape OK")'`, `node -e 'const fs=require("node:fs");const yaml=require("js-yaml");const b=yaml.load(fs.readFileSync("render.yaml","utf8"));const services=b.services;if(!Array.isArray(services)||services.length!==1)throw new Error("render.yaml must declare one service");const s=services[0];if(s.healthCheckPath!==undefined&&s.healthCheckPath!=="")throw new Error("healthCheckPath added");const get=(k)=>s.envVars.find((v)=>v.key===k);for(const [k,v] of [["DB_SCHEMA_BOOTSTRAP_ENABLED","true"],["DB_EXPIRED_TOKEN_CLEANUP_ENABLED","true"],["DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS","3600000"]]){const e=get(k);if(!e||e.value!==v)throw new Error("bad "+k);}console.log("render.yaml DB lifecycle defaults OK")'`, `git diff --unified=0 -- compose.yaml render.yaml`, `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod`, `npm run smoke`, `git diff --exit-code -- src/backend/Dockerfile src/frontend/Dockerfile .github/workflows/deploy.yml`
acceptance: AC-25
notes: `js-yaml` is the transitive dependency the CI `verify-workflows` render.yaml parse already uses. Compose adds only the three backend environment pass-throughs; no service/port/volume/healthcheck change. The node check asserts the exact 18-key backend environment allow-list (the 15 existing keys plus the three new ones), so the key set cannot silently grow. Review the `git diff --unified=0 -- compose.yaml render.yaml` output and record it as the exactness evidence: the only compose change is the three backend environment lines, and the only render change is the three env values. The smoke runs here for AC-25 and again in T11 for the final gate.
status: [x]

## T10 — Documentation pass `[seq]`
depends_on: T8, T9
files_owned: `README.md`, `docs/architecture/observability.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/containerization.md`
verify: `grep -F 'DB_SCHEMA_BOOTSTRAP_ENABLED' README.md`, `grep -F 'DB_EXPIRED_TOKEN_CLEANUP_ENABLED' README.md`, `grep -F 'DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS' README.md`, `grep -F 'db_schema_bootstrap_completed' README.md`, `grep -F 'db_verification_cleanup_run' README.md`, `node -e 'const fs=require("node:fs");const lines=fs.readFileSync("README.md","utf8").split("\n");for(const [v,d] of [["DB_SCHEMA_BOOTSTRAP_ENABLED","true"],["DB_EXPIRED_TOKEN_CLEANUP_ENABLED","true"],["DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS","3600000"]]){const row=lines.find((l)=>l.includes("| `"+v+"` |"));if(!row||!row.includes("| `"+d+"` |"))throw new Error("README default missing: "+v+"="+d);}console.log("README defaults OK")'`, `grep -F 'LogSink.debug' docs/architecture/observability.md`, `grep -F 'exactly 30' docs/architecture/observability.md`, `for e in db_startup_lock_wait db_startup_lock_acquired db_migrations_applied db_migrations_up_to_date db_schema_bootstrap_started db_schema_table_present db_schema_table_created db_schema_table_outdated db_schema_bootstrap_completed db_schema_bootstrap_skipped db_schema_bootstrap_failed db_startup_completed db_startup_failed db_verification_cleanup_started db_verification_cleanup_skipped db_verification_cleanup_run db_verification_cleanup_failed db_verification_cleanup_stopped; do grep -F "$e" docs/architecture/observability.md || exit 1; done`, `grep -F 'schema bootstrap' docs/architecture/deployment.md`, `grep -F 'advisory lock' docs/architecture/deployment.md`, `grep -F 'session-capable' docs/architecture/deployment.md`, `grep -F 'zero-downtime' docs/architecture/deployment.md`, `grep -F 'DB_SCHEMA_BOOTSTRAP_ENABLED' docs/architecture/vercel-render-neon.md`, `grep -F 'DB_EXPIRED_TOKEN_CLEANUP_ENABLED' docs/architecture/vercel-render-neon.md`, `grep -F 'DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS' docs/architecture/vercel-render-neon.md`, `grep -F 'db_schema_bootstrap_failed' docs/architecture/vercel-render-neon.md`, `grep -F 'db_verification_cleanup_failed' docs/architecture/vercel-render-neon.md`, `grep -F 'DB_SCHEMA_BOOTSTRAP_ENABLED' docs/architecture/containerization.md`, `grep -F 'DB_EXPIRED_TOKEN_CLEANUP_ENABLED' docs/architecture/containerization.md`, `grep -F 'DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS' docs/architecture/containerization.md`, `grep -F 'no new service' docs/architecture/containerization.md`, `node -e 'const fs=require("node:fs");const path=require("node:path");const docs=["README.md","docs/architecture/observability.md","docs/architecture/deployment.md","docs/architecture/vercel-render-neon.md","docs/architecture/containerization.md"];const bad=[];for(const d of docs){const t=fs.readFileSync(d,"utf8");for(const m of t.matchAll(/\]\(([^)\s]+)\)/g)){const l=m[1];if(/^(https?:|#|mailto:)/.test(l))continue;const p=path.resolve(path.dirname(d),l.split("#")[0]);if(!fs.existsSync(p))bad.push(d+" -> "+l);}}if(bad.length)throw new Error("broken links: "+bad.join(", "));console.log("five-doc relative links OK")'`, `npm run test --workspace @cubeclicker/frontend -- src/docs/links.test.ts`, `git status --porcelain -- docs/features/README.md`
acceptance: AC-26
notes: `docs/features/README.md` is orchestrator-owned; propose only this feature's row diff in the build log. Reconcile the Render old/new-overlap wording in `vercel-render-neon.md` with the application-level "not zero-downtime for clients" statement in `deployment.md`; document `LogSink.debug` and the debug event rows; use the exact phrases `session-capable` (deployment.md) and `no new service` (containerization.md) so the pinned greps prove the claims. The README table rows must be `| \`VAR\` | \`default\` | …` so the default assertion script matches (`true`, `true`, `3600000`). The five-doc link script resolves every inline relative Markdown link in the five touched docs; fix any broken link rather than deleting it.
status: [x]

## T11 — Verify & integrate `[seq]`
depends_on: T10
files_owned: —
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod`, `npm run smoke`, `git diff --exit-code -- package.json package-lock.json src/backend/src/app.ts src/backend/src/app.test.ts src/backend/src/observability/metrics.ts src/backend/src/observability/metrics.test.ts .github/workflows/deploy.yml src/backend/Dockerfile src/frontend/Dockerfile docs/features/README.md`, `grep -RInE '(email|password|token|cookie|authorization|message|stack):' src/backend/src/db/schema-bootstrap.ts src/backend/src/db/startup.ts src/backend/src/db/verification-cleanup.ts src/backend/src/server.ts || true`
acceptance: AC-24, AC-27
notes: Record raw output in `docs/features/db-schema-bootstrap-and-expiry-cleanup/build-log-T11.md`, including whether the real-Postgres suites ran or self-skipped. The grep is a secondary audit of new log field objects; captured-log tests are the primary AC-23 evidence, and a match must be reviewed, not blanket-deleted. `.env*` is a manual boundary (gitignored): confirm no task edited it and record the confirmation in the build log; do not claim a git check proves it.
status: [x]
