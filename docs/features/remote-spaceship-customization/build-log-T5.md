# Build log — T5 — Repository v3 widening and read normalization

Task: T5 (2026-11-19)
Files changed: `src/backend/src/auth/economy-repository.ts`, `src/backend/src/auth/economy-repository.test.ts`, `docs/features/remote-spaceship-customization/build-log-T5.md`
Branch: `feat/remote-spaceship-customization`
Commit: `7637179` — `feat: widen economy repository to catalog v3` (not pushed; hash recorded in this follow-up `docs:` commit)

## What changed & why

- `normalizeRead()` now calls `normalizeCustomizationStateV3` instead of the v2 normalizer. That is
  the single read shape of both implementations, so every `findCustomizationByUserId`,
  `grantCustomization`, `applyLootboxOpen*` and `setSlotAppearance` return keeps v3 ids while v1/v2
  rows normalize exactly as before (AC-5, R2).
- `EconomyRepository.applyLootboxOpenV2` and `setSlotAppearance` are widened to `PartIdV3` /
  `SlotIdV3` in the interface, the in-memory repository and the Postgres repository (v2 ids remain
  assignable, so every existing caller compiles unchanged).
- Storage shape, SQL strings, schema, migrations and the legacy
  `applyLootboxOpen`/`setAppearance` methods are untouched; `customization_version` stays `2`
  (AC-36).
- Tests add a persisted v3 fixture (11-slot appearance + generated inventory ids), a
  find → `setSlotAppearance` → find round trip (in-memory, fake `EconomyDb`, and real PostgreSQL),
  a v3 duplicate-grant case, and the v3 duplicate/wrong-slot/invalid-count read rules.

## Decisions

- **Read-side widening only.** Writes stay unvalidated in the repository (the hub validates part ids
  and ownership before calling it), matching the accepted behavior; no new query and no change to
  the SQL text.
- **Real catalog ids in the fixture** (`hull-dart-chrome`, `shot-kite-solar`, …) so the fixture is
  exactly the data a v3 row persists. The v2 normalizer drops all of them, which makes the round
  trip a direct guard against R2.
- **Fixture reuse is concrete, not tautological:** every expectation lists the full 11-entry
  appearance / parts map, so dropping or rewriting any id fails the assertion. Expectations are
  built from two literal module constants (`V3_SHIP_APPEARANCE`, `V3_APPEARANCE`, `V3_PARTS`).
- **Suite names renamed for accuracy** — `InMemoryEconomyRepository v2 lootbox/appearance` →
  `… (v2 + v3)`, `PgEconomyRepository v2 lootbox/appearance` → `… (v2 + v3)`, and the PostgreSQL
  integration suite `PgEconomyRepository v2 against PostgreSQL` → `PgEconomyRepository
  customization against PostgreSQL`. Cosmetic only: no assertion was changed.
- **Both test tiers.** Unit: in-memory repository and the fake `EconomyDb` Postgres tests.
  Integration: a new case in the existing real-PostgreSQL suite (`podman` + `postgres:16-alpine`,
  `dbDescribe`), which seeds a v3 row over SQL and re-reads it through the repository. No tier
  exception is needed.
- **No documentation update:** this is internal persistence read widening with no user-facing
  behavior, config, command or term change; the feature's documentation pass is T17. A grep of
  `docs/architecture`, `docs/product` and `README.md` for the repository normalizer found no
  statement that this change makes stale.
- The R1 sequencing gate was released 2026-11-18 (`status.md`); `coin-economy` is `accepted`.

## Evidence

### `npm run lint`

```

> lint
> eslint .

EXIT:0
```

### `npm run typecheck`

```

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT:0
```

### `npm test --workspace @cubeclicker/backend`

```
 ✓ src/auth/economy-repository.test.ts (124 tests) 2466ms
 ✓ src/db/migration-006.test.ts (13 tests) 2566ms

 Test Files  38 passed (38)
      Tests  1676 passed (1676)
   Start at  09:45:58
   Duration  3.37s (transform 4.83s, setup 0ms, collect 13.30s, tests 13.48s, environment 6ms, prepare 3.21s)

EXIT:0
```

`economy-repository.test.ts` grew from 119 to 124 tests (5 new); all 38 backend files pass.

### `npm run coverage --workspace @cubeclicker/backend`

```
 ✓ src/auth/economy-repository.test.ts (124 tests) 2472ms
 ✓ src/db/migration-007.test.ts (11 tests) 2503ms

 Test Files  38 passed (38)
      Tests  1676 passed (1676)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.48 |    90.43 |   99.59 |   96.48 |
 src               |   96.78 |    90.56 |     100 |   96.78 |
  app.ts           |   95.85 |    86.84 |     100 |   95.85 |
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   95.74 |    83.13 |     100 |   95.74 |
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 |
  auth-service.ts  |     100 |    81.75 |     100 |     100 |
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 |
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 |
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 |
 src/db            |   98.02 |    93.75 |     100 |   98.02 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 |
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 |
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   96.28 |    94.94 |   99.11 |   96.28 |
  activity.ts      |     100 |      100 |     100 |     100 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 |
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   91.12 |    88.69 |   98.48 |   91.12 |
  leaderboard.ts   |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.36 |     99.2 |   97.77 |   99.36 |
  servers.ts       |    99.01 |    98.71 |     100 |   99.01 |
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 |
 src/observability |   99.67 |     96.5 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 |
  shutdown.ts      |     100 |    92.85 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
EXIT:0
```

Thresholds (≥ 80 on statements/branches/functions/lines) passed. The `src/auth/...repository.ts`
row with `95.74 / 86.2 / 100 / 95.74` is `economy-repository.ts` (confirmed by the focused run
below).

Focused file coverage (extra evidence, thresholds disabled for this diagnostic run):

`npx vitest run src/auth/economy-repository.test.ts --coverage --coverage.include='src/auth/economy-repository.ts'`

```
 Test Files  1 passed (1)
      Tests  124 passed (124)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.74 |    84.14 |     100 |   95.74 |
 ...-repository.ts |   95.74 |    84.14 |     100 |   95.74 | ...77-778,834-847
-------------------|---------|----------|---------|---------|-------------------
```

### Regression sensitivity (mutation check)

Temporarily restoring the v2 call inside `normalizeRead` (backup/restore around the run) and running
only the new cases:

`npx vitest run src/auth/economy-repository.test.ts -t "v3"`

```
 Test Files  1 failed (1)
      Tests  5 failed | 19 passed | 100 skipped (124)
```

Exactly the five new v3 assertions fail under the v2 normalizer (the 19 passes are the other tests
of the renamed `(v2 + v3)` Postgres suite, whose names the filter also matches); the file was then
restored and the full recipe re-run above. This proves the round-trip fixtures fail on the R2
regression instead of passing tautologically.

### Scope / diff checks

- `git diff --name-only -- src/backend/src/db package.json package-lock.json
  src/backend/package.json src/frontend/package.json compose.yaml compose.smoke.yaml` → empty
  (no schema, migration, dependency, lockfile or container change).
- `git status --porcelain` showed only this task's two source files plus the untouched
  pre-existing feature artifacts/other parallel tasks' files; the commit stages only
  `economy-repository.ts`, `economy-repository.test.ts` and this log.
- No edit to `hub.ts`/`hub.test.ts`, `protocol.ts`/test, `metrics.ts`/test, `src/backend/src/db/**`,
  frontend files, `package.json`, lockfiles, compose/Docker or `.env*`.

## Acceptance audit

- **AC-5 — met (repository scope).** Both implementations return v3-normalized state through
  `normalizeRead`: the 11-entry `V3_APPEARANCE` (generated ids on all ten ship slots plus `shot`)
  survives find → `setSlotAppearance` → find with ids intact, and the v3 read test pins
  canonical-over-legacy precedence, wrong-slot drop (`nose: 'hull-dart-chrome'`), unknown id drop
  (`nonsense-lance-azure`), invalid-count drop (`-1`, `1.5`) and duplicate sum
  (`wings-silver: 4` + `wing-right-silver: 1` → `wing-right-silver: 5`). The repository no longer
  imports the v2 normalizer; the existing v1/v2 fixtures
  (`in-memory read normalizes the AC-33 legacy fixture…`, `pg read normalizes a restored version-2
  row with legacy ids`, `pg read normalizes a version-1 row…`) still pass unchanged.
- **AC-36 — met.** No schema/migration/package/compose change (empty diff above); storage shape is
  the same `CustomizationState` JSONB columns and the same SQL; `customization_version` stays `2`
  and is asserted post-write in the real-PostgreSQL test; a pre-feature row loads unchanged (the
  existing legacy integration test asserts the stored row is byte-for-byte the seeded one); a v3
  row round-trips through `findCustomizationByUserId` → `setSlotAppearance` → `findCustomizationByUserId`
  in-memory, through the fake DB, and against real PostgreSQL with the ids intact.
- Rollback note: an older build's v2 normalizer drops v3 ids (appearance falls back to classics,
  inventory entries are ignored) without error — the accepted degradation; the mutation check above
  demonstrates exactly that behavior.

## Deviations from spec

None. No new dependency, no schema/migration change, no out-of-scope edits. The three suite-name
changes are cosmetic (documented under Decisions).
