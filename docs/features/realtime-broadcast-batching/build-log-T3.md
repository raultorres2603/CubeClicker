# Build log — T3 — Hub encode-once fan-out, registry wiring, removal batching, economy coalescing, smoke burst

Task: T3 (2026-11-13) — **stage A only** (economy repository revision snapshots + migration).

Stage A sketch:
- Migration `007_economy_revision.sql` adds the additive `economy_revision BIGINT NOT NULL DEFAULT 0` column; `schema.sql` mirrors it.
- `EconomySnapshot` + `findEconomySnapshot`/`findUpgradesSnapshot`/`creditWithRevision`; `purchaseUpgrade` returns `revision`; `credit`/`findUpgradesByUserId` stay wrappers.
- In-memory `StoredRow` carries `revision`, incremented only by credit/purchase and preserved by every other `store.set`.
- Tests: revision monotonicity/out-of-order results/wrappers in `economy-repository.test.ts`; static + PG migration suite in `migration-007.test.ts`.

Files changed:
- `src/backend/src/db/migrations/007_economy_revision.sql` (new)
- `src/backend/src/db/schema.sql`
- `src/backend/src/auth/economy-repository.ts`
- `src/backend/src/auth/economy-repository.test.ts`
- `src/backend/src/db/migration-007.test.ts` (new)
- `src/backend/src/db/migration-006.test.ts` (compatibility-only fix; see Deviations)
- `docs/features/realtime-broadcast-batching/build-log-T3.md` (this log)

What changed & why:
- Every economy write now carries a monotonic per-account write revision from the same atomic SQL statement
  (`INSERT ... economy_revision = 1` / `ON CONFLICT ... economy_revision = user_economy.economy_revision + 1` /
  `purchaseUpgrade ... economy_revision = economy_revision + 1`), so the hub (stage B) can order async results whose
  promises resolve out of write order. Database writes stay one per event — the revision is a stamp on that write.
- `findEconomySnapshot` (four totals + revision) seeds the economy guard on join; `findUpgradesSnapshot`
  (`upgrades` + the same row revision in one SELECT) seeds the upgrade guard from one atomic read.
- The in-memory repository mirrors the contract: `StoredRow.revision` bumps on `creditWithRevision`/`purchaseUpgrade`
  and is preserved through every other write (`touchLastSeen`, customization paths).
- `credit` and `findUpgradesByUserId` delegate to the revision-aware methods and keep their old return shapes, so
  `hub.ts` and every existing caller/test are unchanged.
- Stage B (hub wiring, batching, smoke, benchmark) and the frontend are untouched in this change, per the task split.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

- `npm run test --workspace @cubeclicker/backend` → exit 0
```
 Test Files  26 passed (26)
      Tests  931 passed (931)
```
(931 = 903 T2 baseline + 17 new `EconomySnapshot revisions` tests + 11 `migration-007` tests.)

- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (all four thresholds ≥ 80)
```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.52 |    88.16 |   99.72 |   95.52 |
 src               |   80.54 |    84.44 |     100 |   80.54 |
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243
 src/auth          |   95.67 |    81.92 |     100 |   95.67 |
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |    86.14 |     100 |   95.74 | ...69-770,826-839
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |     100 |      100 |     100 |     100 |
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   96.56 |    95.32 |   99.36 |   96.56 |
  broadcast.ts     |   97.12 |    95.45 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   92.98 |    90.57 |     100 |   92.98 | ...1005,1037-1038
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   98.86 |    98.55 |   96.66 |   98.86 | 238-239,553-554
  servers.ts       |   99.01 |    98.68 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
-------------------|---------|----------|---------|---------|-------------------
```

Focused run (new/changed suites, real Postgres container used by the PG tiers):
`npx vitest run src/auth/economy-repository.test.ts src/db/migration-007.test.ts` → exit 0
```
 ✓ src/auth/economy-repository.test.ts (119 tests) 2345ms
 ✓ src/db/migration-007.test.ts (11 tests) 2439ms
 Test Files  2 passed (2)
      Tests  130 passed (130)
```

Test design (unit + integration tiers):
- **Unit (in-memory):** revision starts at 1 and increments per write; absolute totals per snapshot; snapshot copy
  semantics; `credit`/`findUpgradesByUserId` wrapper return shapes; purchase bumps the shared revision and a later
  credit continues it; revision preserved through `touchLastSeen` (all branches exercised) and every customization
  write; last-seen-only row starts at 0 and the first credit bumps to 1.
- **Unit (PG, fake `EconomyDb`):** SQL shape for `creditWithRevision` (INSERT literal `1`, conflict `+ 1`, RETURNING
  `economy_revision`), `findEconomySnapshot`, `findUpgradesSnapshot` (one SELECT of both), purchase `+ 1`/RETURNING,
  BIGINT-string → number mapping, no-row behavior, wrappers. The out-of-order test defers two `creditWithRevision`
  promises, resolves the newer write first, and asserts each result carries its own write revision (1 vs 2) so a
  consumer that keeps the max can never regress.
- **Integration (PG, `migration-007.test.ts`):** applies 001–006, proves `economy_revision` is absent, applies 007,
  asserts `{ bigint, NO, '0' }` metadata, existing rows read `'0'`, new rows default to `'0'`, direct re-execution of
  the migration body is idempotent, then drives the shipped `PgEconomyRepository` against the migrated schema:
  insert path revision 1 → conflict revision 2, `findEconomySnapshot`/`findUpgradesSnapshot` agreement at revision 2,
  purchase revision 3 with the upgrade map, wrapper credit revision 4 verified in the stored row (`'4'`), and a first
  purchase on a pre-existing migrated row starting at revision 1.

## Acceptance audit (stage A scope)

- **AC-19 (repository half) — met.** `creditWithRevision` is exactly one `INSERT ... ON CONFLICT DO UPDATE` statement
  per call (no read-modify-write, no second write), returning the absolute totals and the revision; the benchmark's
  `dbCreditsPer100Clicks` contract in T2 already counts this method. Coalescing/one-frame-per-window is T2 (done) and
  the hub wiring is stage B by task split.
- **AC-21 (repository half) — met.** `purchaseUpgrade` bumps the same revision space inside its single conditional
  UPDATE and returns `revision`, so the hub (stage B) can force a flush only when the purchase revision is newer and
  suppress an older purchase's economy/upgrades. Purchase/upgrade guard behavior itself is stage B.
- **AC-29 (repository half) — met.** Every economy write atomically increments `user_economy.economy_revision` and
  returns it (PG statement asserted for credit and purchase; real-PG integration proves 1→2→3→4 monotonicity).
  `findEconomySnapshot` and `findUpgradesSnapshot` read the same row revision in one query each. The two hub guards,
  the two-purchase race, the later-credit race and the under-credit proof are stage B.
- **AC-23 (repository half) — met.** Write count/timing unchanged: one `creditWithRevision` call per accepted
  click/completion (same call sites; hub still uses the `credit` wrapper until stage B) and one `purchaseUpgrade`
  call per purchase; the revision is stamped by that same statement.
- **AC-28 (stage-A gate) — met.** `npm run lint`, `npm run typecheck`, backend tests and backend coverage all exit 0
  with the raw output above; coverage is ≥ 80 on all four metrics.

## Deviations from spec

- `src/backend/src/db/migration-006.test.ts` (not in T3's `files_owned`) needed a compatibility-only fix: its PG
  suite applied "all migrations except 006", so once 007 exists it picked 007 into `appliedInitial`/`appliedSix`/
  `appliedAgain` and failed by construction. The fix pins its migration universe to 001–006 (three call sites) and
  changes no assertion or behavior under test. No other out-of-scope file was touched.
- Everything else matches the plan's § Economy repository revision: additive migration, mirrored schema, snapshot
  reads, revision on purchase, wrappers, in-memory preservation. No dependency, container, compose, CI, lockfile,
  `package.json`, `.env*`, hub, protocol, frontend, smoke or benchmark changes were made (stage B/T4 own those).
