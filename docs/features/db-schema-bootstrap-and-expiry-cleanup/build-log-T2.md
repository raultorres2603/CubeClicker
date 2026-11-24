# Build log — T2 — Full DDL contract and catalog-equivalence proof

Task: T2 (2026-11-24)
Feature: db-schema-bootstrap-and-expiry-cleanup
Files changed:
- `src/backend/src/db/schema-contract.ts`
- `src/backend/src/db/schema-contract.test.ts`
- `src/backend/src/db/schema-contract-postgres.test.ts`
- `docs/features/db-schema-bootstrap-and-expiry-cleanup/build-log-T2.md`

What changed & why:
- New compile-time `RequiredTable` contract with `REQUIRED_TABLES` for exactly `users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations` in dependency order, carrying the normative DDL from `spec.md` § Required schema contract verbatim (seven `IF NOT EXISTS` statements: five tables plus the two `users` functional unique indexes; `users.statements` holds all three of its statements).
- `columns` follows the normative DDL column order (drives AC-7's DDL-order `missingColumns`); no runtime `.sql` file is loaded.
- `schema-contract.test.ts` parses the contract, every `migrations/*.sql` and the consolidated `schema.sql` into normalized column/index metadata and proves two-way table/column/default/NOT NULL/PK/FK/unique/index coverage, plus a pinned-attribute assertion for every row in the spec's defaults/NOT NULL table.
- `schema-contract-postgres.test.ts` applies `schema.sql` and the contract DDL into two separate schemas of a throwaway `postgres:16-alpine` (existing podman/docker helper pattern) and asserts normalized catalog equality: columns (`data_type`, `is_nullable`, `column_default`, numeric precision/scale), primary/foreign/unique constraints and index definitions modulo schema qualification.

Decisions:
- **Verbatim pinning was checked mechanically.** A one-off TSX script (in `/tmp/opencode`, not committed) extracted the fenced SQL block from `spec.md` § Required schema contract, stripped comments/whitespace, split on `;`, and compared the seven statements with `REQUIRED_TABLES.flatMap(statements)`: `expected statements: 7`, `actual statements: 7`, `verbatim mismatches: []` (exit 0).
- **Small test-local DDL parser, not a production parser.** The unit test parses `CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `ALTER COLUMN ... SET NOT NULL` and `SET DEFAULT` (plus the `UPDATE`s in 004/006 are ignored because they are data rewrites). This is what makes the effective post-007 migration shape comparable with the final consolidated DDL (`customization_version DEFAULT 1 → 2`, `last_seen_at` added nullable then `SET NOT NULL DEFAULT now()`). The parser lives only in the test; production loads no SQL text.
- **Semantic nullability.** A column is recorded `nullable: false` when it has `NOT NULL` **or** is a primary key (Postgres semantics), so `users.id`/`schema_migrations.name` compare cleanly between the DDL text and expectations.
- **Postgres normalization.** Each schema is populated with `SET search_path TO <schema>` and the catalog is read after `SET search_path TO pg_catalog`, which forces `pg_get_constraintdef`/`pg_get_indexdef` to qualify every user-schema object; the snapshot then strips the specific schema prefix and collapses whitespace. That makes the two applications structurally comparable without hiding differences in type, nullability, defaults, FK actions, uniqueness or the `lower(...)` index expressions.
- **Skip semantics match the established pattern.** `detectContainerRuntime()` probes `podman` then `docker` with `info`; `describe.skip` applies only when neither is ready. An available runtime that fails to start the container throws and fails the suite rather than silently skipping the proof. The real suite ran here (see evidence), so no skip is claimed.
- **No session-size split needed.** The task permits splitting unit/Postgres suites when the session cap is tight; the two suites are already separate files (as `files_owned` specifies) and both fit in this session, so no further split or deferral was recorded.
- **Test tiers.** Unit = parser/drift/pinned-attribute suite with no I/O. Integration = the real `postgres:16-alpine` catalog-equivalence suite (a real database boundary); no exception needed.
- **Test files are outside `npm run typecheck`.** `src/backend/tsconfig.json` excludes `src/**/*.test.ts`, so the required typecheck does not compile them; a supplementary strict `tsc --noEmit` run over both test files (with their imports) exits 0 (evidence below). No wildcard matchers, snapshots or wall-clock assertions are used.
- **Parallel workers.** T1 (`0fa79d0`) and T3 (`afa81c6`) had already committed; T7's `shutdown.ts`, `shutdown-before-close.test.ts` and build log were present uncommitted in the working tree during the coverage run (they pass and are visible in the all-files table). This task staged none of them and did not edit any file outside its `files_owned`.
- **Shared-index collision, resolved without scope bleed.** While T2's four files were staged, an interim parallel T7 commit recorded the whole shared index and briefly included them. T7 re-committed as `d6e1231` with only its three files (`git show --name-only d6e1231`: `build-log-T7.md`, `shutdown-before-close.test.ts`, `shutdown.ts`), returning T2's files to the working tree. T2 then committed its four owned paths through an isolated temporary index (`GIT_INDEX_FILE=/tmp/opencode/t2-index` seeded with `git read-tree HEAD`), so unrelated staged entries could not be captured again; the shared index was left untouched.

Evidence (raw):

`npm run lint` → exit 0

```text

> lint
> eslint .

LINT_EXIT=0
```

`npm run typecheck` → exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

Supplementary test-file typecheck (tests are excluded from the repo typecheck):

```text
$ cd src/backend && npx tsc --noEmit --strict --skipLibCheck --module nodenext --moduleResolution nodenext --target ES2023 --types node src/db/schema-contract.test.ts src/db/schema-contract-postgres.test.ts
TEST_TSC_EXIT=0
```

`npm run test --workspace @cubeclicker/backend -- src/db/schema-contract.test.ts src/db/schema-contract-postgres.test.ts --reporter=verbose` → exit 0

```text

> test
> vitest run src/db/schema-contract.test.ts src/db/schema-contract-postgres.test.ts --reporter=verbose


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/schema-contract.test.ts > schema contract tables > declares exactly the five required tables in dependency order 1ms
 ✓ src/db/schema-contract.test.ts > schema contract tables > declares every required column in the normative DDL order 0ms
 ✓ src/db/schema-contract.test.ts > schema contract tables > uses only idempotent creation statements (no ALTER, DROP or DML) 1ms
 ✓ src/db/schema-contract.test.ts > schema contract versus schema.sql > covers the same tables in both directions 0ms
 ✓ src/db/schema-contract.test.ts > schema contract versus schema.sql > covers the same columns with identical types, nullability and defaults 1ms
 ✓ src/db/schema-contract.test.ts > schema contract versus schema.sql > covers the same primary, foreign and unique constraints 0ms
 ✓ src/db/schema-contract.test.ts > schema contract versus schema.sql > covers the same index definitions 0ms
 ✓ src/db/schema-contract.test.ts > schema contract versus migrations 001-007 > covers every migration table and column in both directions 1ms
 ✓ src/db/schema-contract.test.ts > schema contract versus migrations 001-007 > covers every migration index in both directions 0ms
 ✓ src/db/schema-contract.test.ts > schema contract pinned attributes > pins the id defaults, NOT NULL constraints and every application-critical default 0ms
 ✓ src/db/schema-contract.test.ts > schema contract pinned attributes > pins the foreign keys and the nullable FK column 0ms
 ✓ src/db/schema-contract-postgres.test.ts > schema contract catalog equivalence on PostgreSQL > creates the same five tables in both schemas 1ms
 ✓ src/db/schema-contract-postgres.test.ts > schema contract catalog equivalence on PostgreSQL > produces identical normalized columns 1ms
 ✓ src/db/schema-contract-postgres.test.ts > schema contract catalog equivalence on PostgreSQL > produces identical normalized primary, foreign and unique constraints 0ms
 ✓ src/db/schema-contract-postgres.test.ts > schema contract catalog equivalence on PostgreSQL > produces identical normalized index definitions, including the functional users indexes 0ms

 Test Files  2 passed (2)
      Tests  15 passed (15)
   Start at  09:20:17
   Duration  2.25s (transform 63ms, setup 0ms, collect 215ms, tests 1.89s, environment 0ms, prepare 108ms)

TEST_EXIT=0
```

Real-Postgres suite status: **ran, not skipped**. `podman info` is ready in this environment and `docker.io/library/postgres:16-alpine` is present locally; the suite's four tests took 1.89 s (the unit file takes ~6 ms), started a throwaway container named `cubeclicker-schema-contract-<pid>-<epoch>` on an ephemeral loopback port and removed it in `afterAll`. Post-run check: `podman ps -a --format '{{.Names}}' | grep cubeclicker-schema-contract` → `no leftover schema-contract container`.

`npm run coverage --workspace @cubeclicker/backend` → exit 0

```text
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8
...
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    96.7 |    90.89 |   99.62 |    96.7 |                   
 src               |   96.72 |    91.45 |     100 |   96.72 |                   
 src/db            |    98.8 |    94.89 |     100 |    98.8 |                   
  ...cle-config.ts |     100 |      100 |     100 |     100 |                   
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83             
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108           
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
  ...a-contract.ts |     100 |      100 |     100 |     100 |                   
 src/observability |    99.67 |    96.64 |     100 |    99.67 |                   
...
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

The truncated `...a-contract.ts` row is `schema-contract.ts` (the only `*contract.ts` file under `src/db`); it reports 100 on statements, branches, functions and lines. An unambiguous supplemental read (JSON summary reporter written to `/tmp`, not the repo) confirms it: `{"lines":{"total":71,"covered":71,"pct":100},"functions":{"total":0,"covered":0,"pct":100},"statements":{"total":71,"covered":71,"pct":100},"branches":{"total":0,"covered":0,"pct":100}}`. The workspace aggregate is far above the 80/80/80/80 gate; no threshold error was printed and the command exited 0.

AC-2 acceptance audit → **met**:
- Five tables in dependency order → `declares exactly the five required tables in dependency order`.
- Complete DDL, all `IF NOT EXISTS` → `uses only idempotent creation statements` (statement counts `users 3 / others 1`, prefixes, trailing semicolons, no `ALTER`/`DROP`/DML).
- Normative DDL column order and `columns` agreement → `declares every required column in the normative DDL order`.
- Two-way coverage of every migration and `schema.sql` (table, column, type, nullability, default, PK/FK/unique) → `covers the same tables/columns/constraints` (schema.sql) and `covers every migration table and column` (migrations 001–007).
- Pinned defaults/NOT NULL/PK/unique/indexes, including the `users` functional indexes and the ids' `DEFAULT gen_random_uuid()` → `pins the id defaults, NOT NULL constraints and every application-critical default`, `pins the foreign keys and the nullable FK column`, `covers the same index definitions`.
- Real-Postgres normalized catalog equivalence (columns `data_type`/`is_nullable`/`column_default`, PK/FK/unique constraints, index definitions modulo schema qualification) → the four `schema contract catalog equivalence on PostgreSQL` tests, which ran against `postgres:16-alpine`.
- A regression that removes `sessions.id`/`verification_tokens.id`'s default, changes a NOT NULL/default, drops a unique/FK or renames an index fails at least one of the pinned and two-way assertions above.

Deviations from spec: none.

Notes for downstream tasks:
- T4/T6 consume `REQUIRED_TABLES` and `RequiredTable` from `src/backend/src/db/schema-contract.ts`; `statements` are ordered per table with `users` carrying its two index statements, so a missing-table transaction runs table-then-indexes. Each statement is a single SQL statement ending in `;` and can be sent to `pg` individually.
- `columns` is in DDL order (`user_economy`: `user_id`, `coins`, `clicks`, `faces_destroyed`, `cubes_destroyed`, `economy_revision`, `upgrades`, `lootboxes`, `keys`, `parts`, `appearance`, `customization_version`, `last_seen_at`, `updated_at`), matching AC-7's `failed_login_attempts,locked_until` expectation.
- The contract is compile-time TypeScript: no Dockerfile copy or runtime `.sql` load is needed.
