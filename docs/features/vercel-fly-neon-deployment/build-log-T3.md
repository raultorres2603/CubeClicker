# Build log — T3 — Vercel/Fly configs, migration runner, image migrations

Task: T3 (2026-11-13) — `docs/features/vercel-fly-neon-deployment/tasks.md`
Files changed:
- `src/frontend/vercel.json` (new)
- `fly.config.toml` (new)
- `src/backend/src/db/migrate-runner.ts` (new)
- `src/backend/src/db/migrate-runner.test.ts` (new)
- `src/backend/src/db/migrate-cli.ts` (new)
- `src/backend/src/db/migrate-cli.test.ts` (new)
- `src/backend/src/server.ts`
- `src/backend/package.json`
- `src/backend/Dockerfile`
- `docs/features/vercel-fly-neon-deployment/build-log-T3.md` (this log)

What changed & why (≤5 lines):
- Added the exact plan contracts 5–6: `fly.config.toml` (one parameterized app, port 8080, always-on single machine, `/healthz` check, 512 MB shared CPU, no `app`/region key) and `src/frontend/vercel.json` (Vite build/output, SPA rewrite that leaves `/assets/*` a real 404, immutable asset cache, `no-cache` shell).
- Added `migrate-runner.ts`: direct-URL preference, one dedicated `pg.Client` per run, `BEGIN`/statements/`COMMIT` on that connection, `end()` in `finally`, and `runStartupMigrations` returning `null` before any client exists when no DB URL is configured.
- Rebased `migrate-cli.ts` on the runner (`--list` without a DB connection, applied-name logging, exit code 1 on failure) and rewired `server.ts` to `await runStartupMigrations(process.env)` before `buildApp`.
- Added the `db:migrate` script and packaged `src/db/migrations` into `/app/src/backend/dist/db/migrations` in the `prod` image stage.
- Added unit tests for URL precedence, the dedicated-client transaction, failure propagation, the CLI run/list paths and the no-database startup regression.

Decisions:
- `runMigrationsAgainst` takes an optional `createClient` seam (`MigrationRunnerDeps`), so tests pin the single-client contract without a live database; the default factory is `new Client({ connectionString })`.
- `end()` is best-effort (`catch` inside `finally`): a close failure never masks the migration result or error. `connect()` still runs inside the `try`, so a failed connect also ends the client.
- `MigrationClient.connect()` is typed `Promise<unknown>` because `pg`'s `Client.connect()` resolves with the client; awaiting it keeps the same behavior.
- `runStartupMigrations` resolves `DIRECT_DATABASE_URL` → `DATABASE_URL` and returns `null` **before** constructing a client, so the host-only in-memory path is untouched (`select` never runs). The CLI keeps the throwing `resolveMigrationUrl` contract.
- `runMigrateCli(argv, env, deps)` returns an exit code instead of exiting, making the CLI path unit-testable; the module entrypoint (`import.meta.url === pathToFileURL(argv[1]).href`) assigns `process.exitCode` so `node dist/db/migrate-cli.js` and `tsx .../migrate-cli.ts` both exit 1 on failure.
- The Fly file comments name the workflow flags but spell the region flag `--primary-region`; the literal `primary_region` token appears nowhere, satisfying the config anchor.
- No new dependency; `src/backend/src/db/migrate.ts` is reused unchanged; compose/nginx/smoke files were not touched.

## Evidence

### `npm run lint` → exit 0

```
> lint
> eslint .

```

### `npm run typecheck` → exit 0

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

### `npm test -w @cubeclicker/backend` → exit 0 (1110 tests, 32 files)

```
> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/migrate-runner.test.ts (14 tests) 15ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 22ms
 ...
 Test Files  32 passed (32)
      Tests  1110 passed (1110)
```

### `npm run coverage -w @cubeclicker/backend` → exit 0 (thresholds ≥ 80 on all four metrics)

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.25 |    88.68 |   99.53 |   95.25 |
 src/db            |   98.02 |    93.67 |     100 |   98.02 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

Aggregate 95.25 / 88.68 / 99.53 / 95.25 — all above 80. The uncovered `migrate-cli.ts:82-83` lines are the module-entrypoint guard (not executed when the file is imported by tests); `migrate-runner.ts:107-108` is the best-effort `end()` catch. Neither is production behavior left untested: the run path, list path, URL resolution, failure propagation and the no-database branch are all pinned.

### `npm run build` → exit 0

```
✓ built in 1.46s
...
Bundle budget OK.
```

### Vercel config parse and anchors

```
$ node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8')); console.log('vercel.json: valid JSON')"
vercel.json: valid JSON

$ grep -nF '"framework": "vite"' src/frontend/vercel.json
3:  "framework": "vite",
$ grep -nF '"buildCommand": "npm run build"' src/frontend/vercel.json
4:  "buildCommand": "npm run build",
$ grep -nF '"outputDirectory": "dist"' src/frontend/vercel.json
5:  "outputDirectory": "dist",
$ grep -nF '"source": "/((?!assets/).*)"' src/frontend/vercel.json
7:    { "source": "/((?!assets/).*)", "destination": "/index.html" }
$ grep -nF '"destination": "/index.html"' src/frontend/vercel.json
7:    { "source": "/((?!assets/).*)", "destination": "/index.html" }
$ grep -nF 'public, max-age=31536000, immutable' src/frontend/vercel.json
12:      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
$ grep -nF '"Cache-Control", "value": "no-cache"' src/frontend/vercel.json
16:      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
20:      "headers": [{ "key": "Cache-Control", "value": "no-cache" }]

$ grep -nE '"functions"|"builds"|"handle": "filesystem"|serverless' src/frontend/vercel.json
(no match; exit 1)
```

### Fly config parse and anchors

```
$ python3 -c "import tomllib; tomllib.load(open('fly.config.toml','rb')); print('fly.config.toml: valid TOML')"
fly.config.toml: valid TOML

$ grep -nE 'internal_port = 8080|force_https = true|auto_stop_machines = "off"|auto_start_machines = false|min_machines_running = 1|path = "/healthz"|type = "connections"|memory = "512mb"' fly.config.toml
15:  internal_port = 8080
16:  force_https = true
17:  auto_stop_machines = "off"
18:  auto_start_machines = false
19:  min_machines_running = 1
22:    type = "connections"
30:    path = "/healthz"
36:  memory = "512mb"

$ grep -nE 'primary_region' fly.config.toml
(no match; exit 1)
```

### `grep -nE 'runStartupMigrations|no database' src/backend/src/db/migrate-runner.ts src/backend/src/db/migrate-runner.test.ts`

```
src/backend/src/db/migrate-runner.ts:10: * `runStartupMigrations` is the conditional startup seam: with no database URL
src/backend/src/db/migrate-runner.ts:29:/** Inputs accepted by {@link runMigrationsAgainst} and {@link runStartupMigrations}. */
src/backend/src/db/migrate-runner.ts:69: * Resolves the startup migration URL, or `null` when no database is configured.
src/backend/src/db/migrate-runner.ts:126:export async function runStartupMigrations(
src/backend/src/db/migrate-runner.test.ts:84:  runStartupMigrations,
src/backend/src/db/migrate-runner.test.ts:243:describe('runStartupMigrations', () => {
src/backend/src/db/migrate-runner.test.ts:244:  it('returns null without creating a client when no database URL is configured', async () => {
src/backend/src/db/migrate-runner.test.ts:249:    const result = await runStartupMigrations({}, { createClient });
...
```

### Prod image build and migration listing (AC-9)

```
$ podman build --format docker --target prod -f src/backend/Dockerfile -t cubeclicker-backend:verify .
...
[4/4] STEP 7/11: COPY --from=build /app/src/backend/src/db/migrations ./dist/db/migrations
...
Successfully tagged localhost/cubeclicker-backend:verify

$ podman run --rm cubeclicker-backend:verify node dist/db/migrate-cli.js --list
001_init.sql
002_economy.sql
003_upgrades.sql
004_idle_accrual.sql
005_spaceship_customization.sql
006_granular_spaceship_parts.sql
007_economy_revision.sql
exit=0
```

### No-database startup in the prod image (AC-20 host-only regression, extended)

```
$ podman run -d --name cubeclicker-t3-nodb -p 127.0.0.1:18080:8080 cubeclicker-backend:verify
70a54285bab3b116ccbff42b3869d6d10c4f4628426efff20853bfd1f75fe78b
$ node -e "fetch('http://127.0.0.1:18080/healthz').then(async (r) => { console.log(r.status, await r.text()); })"
200 {"status":"ok"}
$ podman logs cubeclicker-t3-nodb
CubeClicker backend listening on http://0.0.0.0:8080 (WebSocket ws://0.0.0.0:8080/ws)
```

No `DATABASE_URL`/`DIRECT_DATABASE_URL` was provided; `runStartupMigrations` returned `null` and `buildApp` stayed on the in-memory repositories.

### CLI on the CI path (`tsx`, no prior build) and missing-URL failure

```
$ npx tsx src/backend/src/db/migrate-cli.ts --list
001_init.sql
002_economy.sql
003_upgrades.sql
004_idle_accrual.sql
005_spaceship_customization.sql
006_granular_spaceship_parts.sql
007_economy_revision.sql
exit=0

$ env -u DIRECT_DATABASE_URL -u DATABASE_URL npx tsx src/backend/src/db/migrate-cli.ts
...
pipeline_exit=1
```

### Scope audit

```
$ git status --porcelain
 M docs/features/vercel-fly-neon-deployment/status.md   <- orchestrator-owned transition edit, pre-existing before T3
 M src/backend/Dockerfile
 M src/backend/package.json
 M src/backend/src/server.ts
?? fly.config.toml
?? src/backend/src/db/migrate-cli.test.ts
?? src/backend/src/db/migrate-cli.ts
?? src/backend/src/db/migrate-runner.test.ts
?? src/backend/src/db/migrate-runner.ts
?? src/frontend/vercel.json

$ git diff --name-only
docs/features/vercel-fly-neon-deployment/status.md
src/backend/Dockerfile
src/backend/package.json
src/backend/src/server.ts
```

The T3-owned paths are exactly the task's `files_owned` set plus this build log. `status.md` is the orchestrator's T2-completion edit and is deliberately not committed by the builder.

### Credential audit (subset relevant to T3, full audit runs in T7)

```
$ git grep -nE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" -- .github infra src ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx'
(no match; exit 1)
```

No connection string with embedded credentials was added; the tests use `postgres://direct.example:5432/app`-style URLs without userinfo.

## Test coverage of the required cases

- **URL precedence:** `resolveMigrationUrl` prefers `DIRECT_DATABASE_URL`, falls back to `DATABASE_URL`, treats `''` as absent and throws the exact `DIRECT_DATABASE_URL or DATABASE_URL must be set`.
- **Single dedicated connection:** the fake `pg.Client` records the exact event sequence `connect → CREATE TABLE → SELECT applied → BEGIN → migration SQL → INSERT → COMMIT → end`; `clientInstances` is exactly 1 and the mocked `pg.Pool` constructor is never reached (`poolConstructions` is `[]`).
- **Failure propagation:** a failing migration rejects with `migration failed: boom`, issues `ROLLBACK`, never `COMMIT`, and still `end()`s; a failing `connect()` also ends the client; an `end()` failure does not mask a successful run.
- **No-database regression:** `runStartupMigrations({})` resolves `null`, the injected `createClient` is not called and no client is constructed; empty URL values behave the same. Direct/fallback selection and failure propagation are pinned separately.
- **CLI:** `migrateFromEnv` uses the direct URL through the runner; `--list` prints the seven committed names in lexicographic order without calling the client factory; the run path logs `Applied <name>` per migration; empty runs log `No pending migrations.`; a missing URL or a failing migration returns exit code 1 and logs the cause.
- **Config contracts:** JSON/TOML parse checks and exact grep anchors above; the forbidden Vercel keys and the `primary_region` token are absent.

## Acceptance audit

- **AC-8 — met.** `fly.config.toml` parses as TOML and contains `[build] dockerfile = "src/backend/Dockerfile"`, `internal_port = 8080`, `force_https = true`, `auto_stop_machines = "off"`, `auto_start_machines = false`, `min_machines_running = 1`, `connections` concurrency with `hard_limit = 200`, the `/healthz` GET check (`interval 15s`, `timeout 5s`, `grace_period 10s`) and `[[vm]] shared/1/512mb`; it has no `app`, `primary_region` or `release_command` key (grep above returns no match).
- **AC-9 — met.** The `prod` stage copies `src/backend/src/db/migrations` to `dist/db/migrations`; `podman build --target prod` exits 0 and `podman run ... node dist/db/migrate-cli.js --list` exits 0 printing `001_init.sql` … `007_economy_revision.sql` (7 lines, no duplicates).
- **AC-10 — met.** `resolveMigrationUrl`, `runMigrationsAgainst` and `runStartupMigrations` are exported; the runner pins a dedicated `pg.Client`/one connection with `BEGIN`/statements/`COMMIT` and `end()` in `finally`; `runStartupMigrations({})` returns `null` with no client/throw; `server.ts` awaits it before `buildApp` and exits 1 on failure; `migrateFromEnv` and `--list` behave as specified. 14 runner + 8 CLI tests.
- **AC-11 — met.** `src/frontend/vercel.json` parses as JSON and contains exactly the framework/build/output, the single negative-lookahead SPA rewrite, and the asset/app-shell cache headers; it contains no `functions`, `builds`, filesystem `routes` or serverless runtime (grep above).
- **AC-20 (local/no-database portion; full gate in T7) — met.** The no-database startup returns `null` without a client and the prod image serves `200 {"status":"ok"}` with no DB configured; compose/nginx/smoke/`migrate.ts` are untouched, so `podman compose up` and the containerized smoke path keep their existing wiring. `runStartupMigrations` with a URL still migrates on the dedicated connection.
- **AC-14/AC-17/AC-23 — not T3 gates.** T3 adds no secret and no connection string with credentials; the environment catalog and the Neon documentation contract are owned by T5/T6, and the image proves startup/list behavior without a database. The `--list`/runner mechanics AC-17 relies on are in place.

Deviations from spec: none. T4–T7 were not started; no workflow, compose, Terraform, nginx, smoke or architecture-doc file was edited.
