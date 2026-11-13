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

---

# Stage C — after benchmark, smoke burst, final T3 acceptance

Task: T3 stage C (2026-11-13)

Stage C sketch:
- Run the after benchmark: in-process ×3, `podman compose restart backend`, wire ×3; record the raw JSON and medians
  against the T2 baseline.
- Extend `tests/e2e/smoke.mjs`: keep the `front:0:0` single-click check and add the one-turn `front:0:1` /
  `front:0:2` burst, which must arrive as exactly one ordered `miniCubesRemoved` batch on A and B and never as
  single `miniCubeRemoved` frames on either client.
- Run `npm run smoke` plus the full T3 verify gate and append the consolidated acceptance audit.

Files changed (stage C):
- `tests/e2e/smoke.mjs`
- `docs/features/realtime-broadcast-batching/build-log-T3.md` (this log)

What changed & why:
- The new smoke check proves AC-26 end-to-end on two real WebSocket clients; it pins the exact batch ids/order,
  requires exactly one matching batch per client, and rejects any per-id fallback frame.
- `SmokeSocket` now keeps every parsed frame in arrival order (`history`), so the negative assertion observes all
  frames on the connection, not only the frame a waiter consumed; a 100 ms settle lets a hypothetically split flush
  land before the assertion.
- The pre-existing single-click `miniCubeRemoved` check is unchanged and still passes; no smoke check was weakened.
- No production, protocol, frontend, compose, Dockerfile, package-script or config file changed in stage C.

## After benchmark — in-process (3 runs)

Environment: same machine as the T2 baseline; run on the host with the existing `tsx` dev dependency. Every counter
is reset after the ten joins/`welcome` setup, so only the 100-click burst is measured.

`node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json`

Run 1:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":1,"registrySnapshotsPerBroadcast":0,"registrySnapshots":0,"removalFramesPer100Clicks":4,"economyFramesPer100Clicks":4,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":351,"removalEncodesInWindow":4,"totalEncodesInWindow":8,"removalBroadcastFramesOnClicker":4,"totalFramesPer100Clicks":8,"economyWriteMethod":"creditWithRevision"}
```
Run 2:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":1,"registrySnapshotsPerBroadcast":0,"registrySnapshots":0,"removalFramesPer100Clicks":4,"economyFramesPer100Clicks":4,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":351,"removalEncodesInWindow":4,"totalEncodesInWindow":8,"removalBroadcastFramesOnClicker":4,"totalFramesPer100Clicks":8,"economyWriteMethod":"creditWithRevision"}
```
Run 3:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":1,"registrySnapshotsPerBroadcast":0,"registrySnapshots":0,"removalFramesPer100Clicks":4,"economyFramesPer100Clicks":4,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":351,"removalEncodesInWindow":4,"totalEncodesInWindow":8,"removalBroadcastFramesOnClicker":4,"totalFramesPer100Clicks":8,"economyWriteMethod":"creditWithRevision"}
```

In-process medians (all three runs identical): `encodeCallsPerBroadcast` 1,
`registrySnapshotsPerBroadcast` 0, `removalFramesPer100Clicks` 4, `economyFramesPer100Clicks` 4,
`dbCreditsPer100Clicks` 100, `maxRemovalFrameBytes` 351; accepted 100/100 in every run.

## After benchmark — wire (3 runs)

Environment: `podman compose restart backend` → `cubeclicker-backend-1` restarted; `GET /healthz` →
`200 {"status":"ok"}` before the runs. Same compose backend/host as the T2 baseline.

`node tests/bench/realtime-broadcast.mjs --mode wire --json`

Run 1:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"countersResetAfterSetup":true,"setupFrames":[2,2],"p95AckLatencyMs":41.1,"removalFramesPer100Clicks":4,"removalFramesPerRecipient":[4,4],"totalFramesPerRecipient":[4,4],"frameTypes":{"miniCubesRemoved":4},"maxRemovalFrameBytes":351,"errors":[],"baselineComparison":null}
```
Run 2:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"countersResetAfterSetup":true,"setupFrames":[2,2],"p95AckLatencyMs":41.39,"removalFramesPer100Clicks":4,"removalFramesPerRecipient":[4,4],"totalFramesPerRecipient":[4,4],"frameTypes":{"miniCubesRemoved":4},"maxRemovalFrameBytes":351,"errors":[],"baselineComparison":null}
```
Run 3:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"countersResetAfterSetup":true,"setupFrames":[3,2],"p95AckLatencyMs":41.24,"removalFramesPer100Clicks":5,"removalFramesPerRecipient":[5,5],"totalFramesPerRecipient":[6,6],"frameTypes":{"miniCubesRemoved":5,"levelAdvanced":1},"maxRemovalFrameBytes":341,"errors":[],"baselineComparison":null}
```

Wire medians: `p95AckLatencyMs` 41.24 ms (baseline median 2.45 ms; allowed ≤ 62.45 ms),
`removalFramesPer100Clicks` 4, `maxRemovalFrameBytes` 351, accepted 100/100 in every run. The extra removal frame
and `levelAdvanced` in run 3 come from a board completion in the load shape, not from a per-click frame.

## Before/after comparison (AC-25)

| Metric | Baseline (T2 median) | After (T3 stage C median) | Target | Verdict |
| --- | --- | --- | --- | --- |
| `encodeCallsPerBroadcast` (10 recipients) | 10 | 1 | 1 | met |
| `registrySnapshotsPerBroadcast` | 2 per click (static baseline; metric `null`) | 0 | 0 | met |
| `removalFramesPer100Clicks` | 100 | 4 | ≤ 8 | met |
| `economyFramesPer100Clicks` | 100 | 4 | ≤ 16 | met |
| `dbCreditsPer100Clicks` | 100 | 100 | 100 (unchanged) | met |
| `maxRemovalFrameBytes` (30-id window bound) | n/a (30 frames) | 351 | ≤ 1024 | met |
| `p95AckLatencyMs` | 2.45 | 41.24 | ≤ baseline + 60 = 62.45 | met |

## Smoke (AC-26) — `npm run smoke`

Backend/frontend/DB/Mailpit/prod-frontend running through `podman compose`; the smoke override recreated the backend
with `MAX_USERS_PER_SERVER=2` / `RECONNECT_GRACE_MS=1000`. Raw output:

```
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Container cubeclicker-frontend-prod-1 Running 
 Container cubeclicker-db-1 Running 
 Container cubeclicker-mailpit-1 Running 
 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-backend-1 Recreate 
 Container cubeclicker-backend-1 Recreated 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-backend-1 Starting 
 Container cubeclicker-backend-1 Started 
 Container cubeclicker-smoke-run-301fc862024f Creating 
 Container cubeclicker-smoke-run-301fc862024f Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1005ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-Cu7lmcVH.js is served gzip with immutable caching — content-encoding gzip; 87059 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (21/21 checks)
```

The new checks run after the pre-existing single-click `miniCubeRemoved` check (still green) and before the leave
check; both new lines are required PASSes. The run drains its members through the 1 s grace window before exit.

## Stage C / full T3 verification (raw)

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
  auth-service.ts  |     100 |    80.53 |     100 |     100 |
  config.ts        |     100 |    100 |     100 |     100 |
  ...repository.ts |   95.74 |    86.14 |     100 |   95.74 | ...69-770,826-839
  email.ts         |     100 |    100 |     100 |     100 |
  password.ts      |     100 |    100 |     100 |     100 |
  rate-limit.ts    |     100 |    100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |     100 |    100 |     100 |     100 |
  migrate.ts       |     100 |    100 |     100 |     100 |
  pool.ts          |     100 |    100 |     100 |     100 |
 src/game          |   94.53 |    92.85 |    98.8 |   94.53 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |    100 |     100 |     100 |
  cubes.ts         |     100 |    100 |     100 |     100 |
  economy.ts       |     100 |    100 |     100 |     100 |
  hub.ts           |   89.16 |    86.04 |   98.07 |   89.16 | ...1306,1314-1315
  parts-v2.ts      |     100 |    100 |     100 |     100 |
  parts.ts         |     100 |    100 |     100 |     100 |
  players.ts       |     100 |    100 |     100 |     100 |
  protocol.ts      |   98.86 |    98.55 |   96.66 |   98.86 | 238-239,553-554
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
-------------------|---------|----------|---------|---------|-------------------
```

- `node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json` → exit 0 (three runs, raw JSON above)
- `podman compose restart backend` → exit 0; `GET /healthz` → `200 {"status":"ok"}`
- `node tests/bench/realtime-broadcast.mjs --mode wire --json` → exit 0 (three runs, raw JSON above)
- `npm run smoke` → exit 0, `SMOKE PASS (21/21 checks)` (raw output above)

## Final T3 acceptance audit (all assigned ACs)

- **AC-1 — met.** Hub integration test: one ten-member removal broadcast serializes exactly once, all ten peers
  receive byte-identical text; benchmark `encodeCallsPerBroadcast` 1 on ten recipients.
- **AC-2 — met.** Throwing middle peer is closed/removed; the other nine receive the batch.
- **AC-3 — met.** Three account connections: each of `economyUpdate`, `upgradesUpdate`, `customizationUpdate`
  serializes once and is byte-identical.
- **AC-7 — met.** Counting registry reports 0 `servers()` calls across join/explode+flush/completion/rotate/grace
  removal; benchmark `registrySnapshotsPerBroadcast` 0.
- **AC-8 — met.** Batch frame with two ids in acceptance order, no single frames for those ids (hub test); smoke
  emits exactly one `miniCubesRemoved` `["front:0:1","front:0:2"]` on both real clients.
- **AC-9 — met.** One pending id emits the legacy `miniCubeRemoved` shape (hub test); the pre-existing smoke
  single-click check still receives it on A and B.
- **AC-10 — met.** 30-click burst → one frame; benchmark's four 25-click bursts → 4 removal frames (one per burst),
  far below the ≤ 8 target and the 100 baseline.
- **AC-11 — met.** Boundary order pinned before `levelAdvanced`, `memberJoined` and `memberLeft`.
- **AC-12 — met.** A mover's batch flushes to the old server before `worldEntered` and never reaches the new server.
- **AC-13 — met.** Missed batch then rejoin: `welcome.self.removedIds` and the roster carry every accepted removal.
- **AC-14 — met.** Protocol frame-size test (T1) plus hub 30-id window; benchmark max removal frame 351 B ≤ 1024.
- **AC-15 — met.** `close()` discards both schedulers, clears every hub timer, sends nothing after close.
- **AC-19 — met.** 30 clicks → one absolute economy frame (`coins 3`, `clicks 30`, `facesDestroyed 3`) with 30
  `creditWithRevision` writes; benchmark economy frames 4 (one per burst window) with 100 DB credits.
- **AC-20 — met.** t=0/t=100 → one frame; a later window → a second; benchmark ~3.3 s → 4 frames ≤ 16.
- **AC-21 — met.** Purchase flushes immediately and cancels the pending window; an older purchase never overwrites
  the newer upgrade map; join idle credit stays immediate.
- **AC-22 — met.** No-recipient flush does 0 encodes/0 sends; join/rejoin welcomes carry the latest applied economy
  and upgrades; close sends nothing.
- **AC-23 — met.** One `creditWithRevision` write per accepted click/completion and one `purchaseUpgrade` per
  purchase; benchmark `dbCreditsPer100Clicks` 100 unchanged.
- **AC-25 (after half) — met.** Raw after JSON (3 + 3 runs) and medians recorded above; every target met, including
  p95 41.24 ms ≤ 62.45 ms (baseline 2.45 + 60).
- **AC-26 — met.** `npm run smoke` passes 21/21 with the new one-turn batch check on A and B and the negative
  single-frame assertion; the single-click `miniCubeRemoved` check is unchanged and green.
- **AC-29 — met.** Later credit before earlier; purchase after a newer credit; two purchases out of order with the
  newer map/frame winning and a later click using the newer multiplier; final frame equals the repository's final
  absolute totals.
- **AC-30 — met.** Pending removal/economy discarded; deferred credit, deferred join, late frames and late attach
  inert; both revision maps are 0 after close; schedulers inert after `discard()`.
- **AC-28 (T3-scoped gate) — met.** `npm run lint`, `npm run typecheck`, backend tests (959) and backend coverage
  (94.63/87.35/99.46/94.63 ≥ 80) exit 0; `npm run smoke` exits 0.

## Deviations from spec (stage C)

None. Stage C changed only `tests/e2e/smoke.mjs` and this log. No production, protocol, frontend, hub, repository,
compose, Dockerfile, package-script, lockfile, CI or `.env*` file was touched; T4/T5 were not started.
