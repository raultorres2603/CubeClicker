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

---

# Stage B — hub encode-once fan-out, registry wiring, removal batching, economy coalescing, shutdown guards

Task: T3 stage B (2026-11-13)

Stage B sketch:
- `HubDeps.registry` seam; the hub drops every `registry.servers()` call and uses `locationOf`/`forEachMember`.
- `deliver`/`send`/`broadcast`/`broadcastAccount`: encode once, fan out the same text; a throwing peer terminates only itself; an account fan-out with no recipients is encode-free.
- `createRemovalBatcher` (40 ms): one-id legacy `miniCubeRemoved`, multi-id `miniCubesRemoved`; boundary flushes before completion/join/rejoin/removal; close discards.
- `createEconomyCoalescer` (250 ms): absolute totals, highest revision wins; credits queue, join idle credit and purchase force a flush; two independent revision guards.
- `closed` guard: late frames/continuations/attaches are inert; `close()` disarms both schedulers, clears hub timers and both revision maps; test-only `revisionStateForTesting()`.

Files changed:
- `src/backend/src/game/hub.ts`
- `src/backend/src/game/hub.test.ts`
- `src/backend/src/app.test.ts` (compatibility-only; see Deviations)
- `docs/features/realtime-broadcast-batching/build-log-T3.md` (this log)

What changed & why:
- Encode-once: one `JSON.stringify` per broadcast, byte-identical fan-out (AC-1/AC-3), and the registry's visitor/index replace the deep-copied snapshot on hot paths (AC-7).
- Send isolation: a throwing peer is terminated through the normal close path; the rest of the fan-out continues (AC-2).
- Removal batching at the accepted 40 ms window with acceptance order, per-server recording and boundary flushes (AC-8…AC-12, AC-14); a one-id flush keeps the legacy shape (AC-9).
- Economy coalescing: absolute totals at 4 Hz, 30 clicks → one frame with 30 DB writes (AC-19/AC-20); join idle credit and purchases flush immediately (AC-21); a no-recipient flush encodes nothing (AC-22).
- Ordering/shutdown: two revision guards drop late older results (AC-29); `closed` makes late frames, late credit/purchase/join continuations and attaches inert (AC-15/AC-30).

Decisions:
- Purchase frames keep the accepted pre-feature order (`economyUpdate` then `upgradesUpdate`) while applying the two guards independently; frame order is not pinned by an AC and this avoids a client-visible ordering change.
- `sendToPlayer` was removed: it re-encoded per recipient; `broadcast` now fans out the pre-encoded text through `forEachMember`.
- `close()` clears `members`, `tokens`, `openingMembers`, both revision maps, grace/heartbeat timers and connections; `attach` after close closes the peer.
- `revisionStateForTesting()` is the only test-only seam added; it has no production caller.

Evidence:

- `npx vitest run src/game/hub.test.ts` → exit 0
```
 Test Files  1 passed (1)
      Tests  121 passed (121)
```

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
      Tests  959 passed (959)
```

- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (all four thresholds ≥ 80)
```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.63 |    87.35 |   99.46 |   94.63 |
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
 src/game          |   94.62 |    92.79 |    98.8 |   94.62 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   89.16 |    86.04 |   98.07 |   89.16 | ...1306,1314-1315
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   98.86 |    98.55 |   96.66 |   98.86 | 238-239,553-554
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
-------------------|---------|----------|---------|---------|-------------------
```

Test design (unit + integration tiers):
- **Integration (`hub.test.ts`):** real hub + real registry + real protocol builders + in-memory repository through fake peers; encode counts via a `JSON.stringify` spy; deferred repositories hold credit/purchase/join-read results so async writes resolve out of order; fake timers only, no sleeps.
- **Integration (`app.test.ts`):** live-socket `/ws` tests updated to the batch frame shape (30-click one-batch and level-sized one-batch); the legacy single-id `miniCubeRemoved` live-socket test is unchanged and green.
- **Concrete assertions:** exact frame literals/objects, exact revision totals, exact timer counts; no wildcard matchers.

## Acceptance audit (stage B scope)

- **AC-1 — met.** Ten-member removal broadcast serialized once; all ten peers receive byte-identical text; `memberLeft` also encodes once.
- **AC-2 — met.** A throwing middle peer is closed/removed; the other nine peers receive the batch.
- **AC-3 — met.** Three account connections; each of `economyUpdate`, `upgradesUpdate`, `customizationUpdate` serialized once and byte-identical.
- **AC-7 — met.** Injected counting registry reports 0 `servers()` calls across join/explode+flush/completion/rotate/grace removal.
- **AC-8 — met.** Exact two-id `miniCubesRemoved` literal in acceptance order; no `miniCubeRemoved` for those ids.
- **AC-9 — met.** One pending id emits the legacy `miniCubeRemoved` frame.
- **AC-10 — met.** 30-click burst → 1 frame; two members → one group frame each.
- **AC-11 — met.** Boundary order pinned before `levelAdvanced`, `memberJoined` and `memberLeft`.
- **AC-12 — met.** A mover batch flushes to the old server before `worldEntered` and is never delivered to the new server.
- **AC-13 — met.** Missed batch then rejoin: `welcome.self.removedIds` and the roster carry every accepted removal.
- **AC-14 (hub half) — met.** A 30-id batch frame is ≤ 1024 bytes; the protocol half was T1.
- **AC-15 — met.** `close()` discards both schedulers, clears every hub timer, and advancing after close yields zero sends.
- **AC-19 — met.** 30 clicks → one absolute frame (`coins 3`, `clicks 30`, `facesDestroyed 3`) and 30 `creditWithRevision` calls.
- **AC-20 — met.** Updates at t=0/t=100 produce one frame; a later window produces a second.
- **AC-21 — met.** Purchase flushes immediately, no duplicate at the deadline; join idle credit is an immediate pre-`welcome` frame; an older purchase never overwrites the newer upgrade map.
- **AC-22 — met.** No-recipient flush: 0 encodes and 0 sends; join/rejoin welcomes carry the latest applied totals, including a join read older than an already-applied revision on another tab.
- **AC-23 — met.** One credit write per accepted click and one purchase write; the revision is a stamp on the same statement.
- **AC-29 — met.** Later credit before earlier; purchase after a newer credit; two purchases out of order with a later click using the newer multiplier (0.12); credit after a newer purchase flush; final frame equals the repository's final absolute totals.
- **AC-30 — met.** Pending removal/economy discarded; deferred credit, deferred join, late frames and late attach all inert; both revision maps are 0 after close.
- **AC-25 (after half) / AC-26 — deferred to stage C** (benchmark and smoke) per the task split.

## Deviations from spec (stage B)

- `src/backend/src/app.test.ts` (not in T3's `files_owned`) needed a compatibility-only adaptation: two live-socket
  tests asserted one `miniCubeRemoved` per click (a 30-frame list and level-sized lists). They now assert the single
  `miniCubesRemoved` batch with the same flattened ids and order; no assertion was weakened, no production behavior was
  changed for them, and the legacy single-click live-socket test is untouched. This mirrors the stage A
  `migration-006.test.ts` compatibility fix.
- No other out-of-scope file was touched. No protocol, frontend, smoke, compose, CI, Dockerfile, `package.json`,
  lockfile or `.env*` change was made; stage C (benchmark + smoke) and T4 remain untouched.
