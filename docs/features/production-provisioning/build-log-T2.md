# Build log — T2 — Neon `production` branch, URLs, migrations and zero-data check

Task: T2 (2026-11-27)
Files changed: `docs/features/production-provisioning/build-log-T2.md` (only; no application code, workflow, `render.yaml`, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: Verified and reused the pre-existing project-default Neon `production` branch `br-floral-dream-zarerhtw` in project `patient-mountain-41401588`, derived and verified the pooled and direct connection strings with real `pg` connections, applied the seven numbered migrations with the migration CLI, and proved the five required tables exist with zero application rows. No branch was created, renamed, deleted or branched from `development`; no application row was written or deleted; no connection string or credential is recorded.
Decisions: Reuse only — the branch is the project default and predates this feature. The pooled/direct pair came from the live endpoint data and was confirmed by real connections, not assumed. Migration values travelled from the mode-600 staging files into the process environment and were never command arguments.
Testing note: T2 is an infrastructure task per `tasks.md` (provider state plus a build log; no application code). The feature-appropriate proof is the branch read-back, the live `pg` connection checks, the migration CLI output and read-only SQL; no unit/integration test boundary exists for repository-external Neon state, so none is added and the full repository suite remains T8's gate.

## Branch read-back

Read live with `tools.Neon.list_branches`, `tools.Neon.get_branch` and `tools.Neon.describe_project` (read-only) on 2026-11-27:

```
branch production
branch id: br-floral-dream-zarerhtw
parent: none (project default)
primary: true
default: true
protected: false
state: ready
creation source: console
not created from development
```

- Project: `patient-mountain-41401588` (`CubeClicker`), region `aws-eu-west-2`, PostgreSQL 18, org `org-silent-poetry-68126144`.
- The live branch list returned exactly two branches: `production` (`br-floral-dream-zarerhtw`, parent `null`/project default, `primary: true`, `default: true`, `protected: false`, `ready`) and `development` (`br-ancient-smoke-za1pdv7w`, parent `br-floral-dream-zarerhtw`). Exactly one branch is named `production`; no duplicate exists.
- The live id equals the T2 target; the drift stop condition was not triggered and no id was substituted.
- `not created from development`: the production branch is the project default (`parent: none`), and `development` is its child. T2 created, renamed and deleted no branch; it never branched from `development`.
- Database/role read-back: database `cubeclicker`, owner and role `cubeclicker_owner` (password authentication; the only non-system role). No password was read or recorded.
- Pre-migration schema read-only check: `to_regclass` returned `null` for `users`, `sessions`, `verification_tokens`, `user_economy` and `schema_migrations`, i.e. no application table existed on the branch before the migration run.

## Connection strings (handled in-process; no value recorded)

`tools.Neon.get_connection_string` returned the role-password URL in-process. The pooled and direct variants were derived in-process (Neon convention: `-pooler` appended to the endpoint id for the pooled host; `get_connection_string` returned the pooled host), and `sslmode=require` was asserted on both. Each value was staged from the in-process value into a mode-600 file under `/tmp/opencode/t2` (never echoed, never a command argument, never in the repository) and then verified with a real `pg` `Client` running `SELECT 1`.

```
pooled host: ep-dawn-silence-zaodnv50-pooler.c-2.eu-west-2.aws.neon.tech (role cubeclicker_owner, password <redacted>)
direct host: ep-dawn-silence-zaodnv50.c-2.eu-west-2.aws.neon.tech (role cubeclicker_owner, password <redacted>)
```

- Pooled host contains `-pooler`; direct host does not.
- Both carry `sslmode=require`.
- Both staging files were mode `600` at verification time.
- Live connections (only these two lines were printed by the checker; exit `0`):

```
DATABASE_URL: connected
DIRECT_DATABASE_URL: connected
```

The checker's stderr carried the `node-postgres` SSL-mode deprecation warning for `sslmode=require` (a library notice, not an error). No host, role, password or connection string is part of that warning.

## Migrations

Applied with the committed CLI, with `DIRECT_DATABASE_URL` supplied only in the process environment (the value was read from the mode-600 file inside the shell; it was never a command argument):

```
DIRECT_DATABASE_URL="$(cat /tmp/opencode/t2/direct.url)" npx --no-install tsx src/backend/src/db/migrate-cli.ts
```

First run (pending migrations applied), exit `0`:

```
Applied 001_init.sql
Applied 002_economy.sql
Applied 003_upgrades.sql
Applied 004_idle_accrual.sql
Applied 005_spaceship_customization.sql
Applied 006_granular_spaceship_parts.sql
Applied 007_economy_revision.sql
```

Second run (idempotency / no pending migrations), exit `0`:

```
No pending migrations.
```

- `schema_migrations: 7`, exactly the seven names in lexicographic order:

```
001_init.sql
002_economy.sql
003_upgrades.sql
004_idle_accrual.sql
005_spaceship_customization.sql
006_granular_spaceship_parts.sql
007_economy_revision.sql
```

- The repository contains exactly seven migration files (`ls src/backend/src/db/migrations/*.sql | wc -l` = 7).

## Read-only SQL checks

`tools.Neon.run_sql` on the `production` branch (database `cubeclicker`), read-only statements only:

- Table existence (`information_schema.tables`, `public`): `schema_migrations`, `sessions`, `user_economy`, `users`, `verification_tokens` — all five required tables are present.
- Row counts:

```
schema_migrations: 7
users: 0
sessions: 0
verification_tokens: 0
user_economy: 0
```

- `schema_migrations` is exempt from the zero-row rule and holds exactly seven rows; the four application tables hold exactly zero rows each.
- No application table contained a row before or after the run. The migrations are DDL plus `UPDATE` statements that matched zero rows, so no row was inserted, updated, deleted or copied, and no development data was inherited.

## Secret handling and cleanup

- No connection string, role password or credential appears in this log, the repository or a command argument; the two required connection outputs print only `connected`.
- The mode-600 staging files, the staging helper script, the staging listener log and the migration stderr capture under `/tmp/opencode/t2` were shredded/deleted after the checks; the staging listener was stopped (see § Verify for the cleanup transcript).
- `.env*` was not touched; no production value was written to any secret store in T2 (the `production` Environment secrets are T5's scope).

## Verify

Command: the exact T2 verify block from `tasks.md` (lines 49–80), extracted to `/tmp/opencode/t2/t2-verify.sh` and run as `bash /tmp/opencode/t2/t2-verify.sh`; `set -euo pipefail` is inside the block. Raw output:

```
$ bash /tmp/opencode/t2/t2-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=0
```

The block is silent on success (every check is a `test` or a `grep -q`/negated `grep`); exit `0` means every assertion passed. Result by area:

| Verify area | Result |
| --- | --- |
| Build log present; `branch production`, exact branch id, parent/primary/default, `not created from development`; no drift/blocked marker | PASS |
| Pooled `-pooler` host, `sslmode=require`, `DATABASE_URL: connected`, `DIRECT_DATABASE_URL: connected` | PASS |
| `schema_migrations: 7`, the seven migration names, and exactly seven repository migration files | PASS |
| `users`, `sessions`, `verification_tokens`, `user_economy` named; exact `users: 0`, `sessions: 0`, `verification_tokens: 0`, `user_economy: 0` lines | PASS |
| Connection-string guard (no credentialed URL) and credential-shaped guard over this file | PASS |

Cleanup transcript (all staging material removed; directory empty):

```
$ cd /tmp/opencode/t2 && shred -u pooled.url direct.url verify-connection.mjs stage-server.mjs && rm -f server.log migrate-second.err t2-verify.sh && ls -la
total 0
drwx------. 2 raultorraco raultorraco 40 Nov 27 12:24 .
drwxr-xr-x. 6 raultorraco raultorraco 480 Nov 27 12:21 ..
$ pgrep -af '[s]tage-server' || echo 'staging listener: stopped'
staging listener: stopped
$ ss -ltn | grep 39479 || echo 'port 39479: closed'
port 39479: closed
```

## Acceptance audit

- **AC-2(a) — one `production` branch with the exact id; the dev branch is different and present.** Met: live `list_branches` returned `production` = `br-floral-dream-zarerhtw` and `development` = `br-ancient-smoke-za1pdv7w`; exactly one branch is named `production`; the live id equals the target and no drift stop was triggered.
- **AC-2(b) — project-default/primary, not created here, not branched from `development`.** Met: `parent: none (project default)`, `primary: true`, `default: true`, `creation source: console`; `development` is its child; T2 made no branch write.
- **AC-2(c) — pooled/direct host shapes and `sslmode=require`, both connect with a real `pg` client.** Met: pooled host contains `-pooler`, direct host does not, both carry `sslmode=require`, and both printed `connected` from a real `pg.Client` `SELECT 1`.
- **AC-2(d) — migration CLI applies the numbered set; `schema_migrations` has the seven names; the five tables exist.** Met: seven `Applied` lines on the first run, `No pending migrations.` on the second, `schema_migrations: 7` with the exact seven names, and all five tables present.
- **AC-2(e) — four application tables have exactly zero rows.** Met: `users: 0`, `sessions: 0`, `verification_tokens: 0`, `user_economy: 0`.
- **AC-2(f) / AC-6(a) — no connection string, role password or credential in any build log.** Met: the T2 verify credential guard and connection-string guard pass over this file; only host shapes with role/password redacted and the two `connected` lines are recorded; no `.env*` change.
- **Scope.** Met: the only changed file is this build log; no branch/project/service was created, renamed, deleted or protected; no development resource was read with a value; no Vercel/Render/GitHub write; no push.

## Deviations from spec

None. The live branch matched the recorded T2 target exactly (id, parent, primary/default, unprotected), so no block applies and no substituted id was recorded. No branch was created or deleted. No application row exists, so no owner decision about deleting rows was needed.
