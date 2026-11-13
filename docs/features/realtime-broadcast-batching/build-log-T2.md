# Build log — T2 — Registry index, broadcast schedulers, and benchmark harness

Task: T2 (2026-11-13)
Files changed:
- `tests/bench/realtime-broadcast.mjs` (new, written and run before `servers.ts` was edited)
- `src/backend/src/game/servers.ts`
- `src/backend/src/game/servers.test.ts`
- `src/backend/src/game/broadcast.ts` (new)
- `src/backend/src/game/broadcast.test.ts` (new)
- `docs/features/realtime-broadcast-batching/build-log-T2.md`

What changed & why (≤5 lines):
- Added the zero-dependency benchmark harness first, then measured the untouched baseline
  (commit `b38d71b`) in both modes and recorded the raw JSON below.
- `servers.ts` gains the private `locations`/`serversById` indexes behind `locationOf` (fresh
  object) and `forEachMember` (ascending occupied slots, primitives only); `servers()`,
  `plan()`, `computeMovePlan`, capacity/ring rules and the ascending-id invariant are unchanged.
- `broadcast.ts` gains the 40 ms removal batcher (one per-player group, server pinned on first
  enqueue, one timer, manual/boundary flush, inert after discard) and the 250 ms per-account
  economy coalescer (highest-revision-wins absolute state, per-account timer, inert after discard).
- Both modules are unit-tested with fake timers and deterministic fixtures; the 200-operation
  registry property test compares `locationOf` with the `servers()` snapshot after every step.

## Baseline (measured before editing `servers.ts`)

Environment: same machine; backend container `cubeclicker-backend-1` started with
`podman compose up -d backend`; `GET /healthz` → `200 {"status":"ok"}`. Three runs per mode;
commands are the pinned ones (`--json` on every invocation).

### In-process baseline — raw JSON (3 runs)

`node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json`

Run 1:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":10,"registrySnapshotsPerBroadcast":null,"registrySnapshots":null,"removalFramesPer100Clicks":100,"economyFramesPer100Clicks":100,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":59,"removalEncodesInWindow":1000,"totalEncodesInWindow":1100,"removalBroadcastFramesOnClicker":100,"totalFramesPer100Clicks":200,"economyWriteMethod":"credit","registrySnapshotSource":"static baseline: HubDeps.registry seam lands in T3; 2 servers() copies per accepted click (broadcast + locationOf)"}
```
Run 2:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":10,"registrySnapshotsPerBroadcast":null,"registrySnapshots":null,"removalFramesPer100Clicks":100,"economyFramesPer100Clicks":100,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":59,"removalEncodesInWindow":1000,"totalEncodesInWindow":1100,"removalBroadcastFramesOnClicker":100,"totalFramesPer100Clicks":200,"economyWriteMethod":"credit","registrySnapshotSource":"static baseline: HubDeps.registry seam lands in T3; 2 servers() copies per accepted click (broadcast + locationOf)"}
```
Run 3:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":10,"registrySnapshotsPerBroadcast":null,"registrySnapshots":null,"removalFramesPer100Clicks":100,"economyFramesPer100Clicks":100,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":59,"removalEncodesInWindow":1000,"totalEncodesInWindow":1100,"removalBroadcastFramesOnClicker":100,"totalFramesPer100Clicks":200,"economyWriteMethod":"credit","registrySnapshotSource":"static baseline: HubDeps.registry seam lands in T3; 2 servers() copies per accepted click (broadcast + locationOf)"}
```

Medians (identical runs): `encodeCallsPerBroadcast` 10, `registrySnapshotsPerBroadcast` null
(static baseline: 2 `servers()` copies per accepted click — `broadcast` + `locationOf`),
`removalFramesPer100Clicks` 100, `economyFramesPer100Clicks` 100,
`dbCreditsPer100Clicks` 100, `maxRemovalFrameBytes` 59.

### Wire baseline — raw JSON (3 runs)

`node tests/bench/realtime-broadcast.mjs --mode wire --json`

Run 1:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"countersResetAfterSetup":true,"setupFrames":[3,2],"p95AckLatencyMs":2.52,"removalFramesPer100Clicks":100,"removalFramesPerRecipient":[100,100],"maxRemovalFrameBytes":60,"errors":[],"baselineComparison":null}
```
Run 2:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"countersResetAfterSetup":true,"setupFrames":[2,2],"p95AckLatencyMs":2.45,"removalFramesPer100Clicks":100,"removalFramesPerRecipient":[100,100],"maxRemovalFrameBytes":60,"errors":[],"baselineComparison":null}
```
Run 3:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"countersResetAfterSetup":true,"setupFrames":[3,2],"p95AckLatencyMs":1.27,"removalFramesPer100Clicks":100,"removalFramesPerRecipient":[100,100],"maxRemovalFrameBytes":60,"errors":[],"baselineComparison":null}
```

Wire median `p95AckLatencyMs` = 2.45 ms; 100 removal frames per recipient; accepted 100/100.

## After-implementation evidence (T2 modules only)

The hub is not wired to the new registry index or the schedulers in T2 (that is T3), so the
end-to-end benchmark numbers are expected to stay at the baseline after this task; the
module-level proof is the unit suite. The same script will measure the after-wiring targets
(encode 1, registry copies 0, removal frames ≤ 8, economy frames ≤ 16) in T3.

Final script: `tests/bench/realtime-broadcast.mjs` with the full flag set (`--mode`,
`--clients`, `--clicks`, `--burst`, `--interval-ms`, `--ws`/`--url`/`BACKEND_WS_URL`,
`--json`, `--baseline`, `--max-p95-delta-ms`). Counters are reset after the ten joins and
their `welcome`/setup frames; wire mode fails when fewer than all requested clicks are
acknowledged within 5 s.

### In-process after T2 — raw JSON (3 runs)

`node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json`

Run 1:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":10,"registrySnapshotsPerBroadcast":null,"registrySnapshots":null,"removalFramesPer100Clicks":100,"economyFramesPer100Clicks":100,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":59,"removalEncodesInWindow":1000,"totalEncodesInWindow":1100,"removalBroadcastFramesOnClicker":100,"totalFramesPer100Clicks":200,"economyWriteMethod":"credit","registrySnapshotSource":"static baseline: HubDeps.registry seam lands in T3; 2 servers() copies per accepted click (broadcast + locationOf)"}
```
Run 2:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":10,"registrySnapshotsPerBroadcast":null,"registrySnapshots":null,"removalFramesPer100Clicks":100,"economyFramesPer100Clicks":100,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":59,"removalEncodesInWindow":1000,"totalEncodesInWindow":1100,"removalBroadcastFramesOnClicker":100,"totalFramesPer100Clicks":200,"economyWriteMethod":"credit","registrySnapshotSource":"static baseline: HubDeps.registry seam lands in T3; 2 servers() copies per accepted click (broadcast + locationOf)"}
```
Run 3:
```json
{"mode":"in-process","ok":true,"members":10,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"gridSize":7,"countersResetAfterSetup":true,"setupFrames":[10,9,8,7,6,5,4,3,2,1],"encodeCallsPerBroadcast":10,"registrySnapshotsPerBroadcast":null,"registrySnapshots":null,"removalFramesPer100Clicks":100,"economyFramesPer100Clicks":100,"dbCreditsPer100Clicks":100,"maxRemovalFrameBytes":59,"removalEncodesInWindow":1000,"totalEncodesInWindow":1100,"removalBroadcastFramesOnClicker":100,"totalFramesPer100Clicks":200,"economyWriteMethod":"credit","registrySnapshotSource":"static baseline: HubDeps.registry seam lands in T3; 2 servers() copies per accepted click (broadcast + locationOf)"}
```

Medians: identical to the baseline (10 encodes/broadcast, registry metric `null` until the T3
seam, 100 removal frames, 100 economy frames, 100 DB credits, 59-byte max removal frame).

### Wire after T2 — raw JSON (3 runs)

`podman compose up -d backend` → exit 0 (`cubeclicker-backend-1` Running, DB healthy).
`node tests/bench/realtime-broadcast.mjs --mode wire --json`

Run 1:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"countersResetAfterSetup":true,"setupFrames":[3,2],"p95AckLatencyMs":2.65,"removalFramesPer100Clicks":100,"removalFramesPerRecipient":[100,100],"totalFramesPerRecipient":[100,100],"frameTypes":{"miniCubeRemoved":100},"maxRemovalFrameBytes":60,"errors":[],"baselineComparison":null}
```
Run 2:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"countersResetAfterSetup":true,"setupFrames":[3,2],"p95AckLatencyMs":4.48,"removalFramesPer100Clicks":100,"removalFramesPerRecipient":[100,100],"totalFramesPerRecipient":[100,100],"frameTypes":{"miniCubeRemoved":100},"maxRemovalFrameBytes":60,"errors":[],"baselineComparison":null}
```
Run 3:
```json
{"mode":"wire","ok":true,"url":"ws://localhost:8080/ws","clients":2,"clicks":100,"acceptedClicks":100,"bursts":4,"clicksPerBurst":25,"burstGapMs":1100,"countersResetAfterSetup":true,"setupFrames":[2,3],"p95AckLatencyMs":2.87,"removalFramesPer100Clicks":100,"removalFramesPerRecipient":[100,100],"totalFramesPerRecipient":[101,101],"frameTypes":{"miniCubeRemoved":100,"levelAdvanced":1},"maxRemovalFrameBytes":61,"errors":[],"baselineComparison":null}
```

Wire median `p95AckLatencyMs` = 2.87 ms; 100 removal frames per recipient; accepted 100/100
in all three runs. (`levelAdvanced` and the extra total frame in run 3 come from a board
completion in the load shape, not from a removal frame.)

## Final verification (raw)

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
 Test Files  25 passed (25)
      Tests  903 passed (903)
```

- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (all four thresholds ≥ 80)
```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.49 |       88 |   99.72 |   95.49 |                   
 src               |   80.54 |    84.44 |     100 |   80.54 |                   
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243 
 src/auth          |   95.61 |    81.43 |     100 |   95.61 |                   
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354 
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |    95.5 |    84.68 |     100 |    95.5 | ...81-682,738-751 
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
  protocol.ts      |   98.86 |    98.55 |    96.66 |   98.86 | 238-239,553-554   
  servers.ts       |   99.01 |    98.68 |     100 |   99.01 | 289-290           
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
-------------------|---------|----------|---------|---------|-------------------
```

- `node --check tests/bench/realtime-broadcast.mjs` → exit 0 (no output)
- `podman compose up -d backend` → exit 0 (backend Running, `GET /healthz` → 200 `{"status":"ok"}`)
- `node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json` → exit 0
  (three runs, raw JSON above)
- `node tests/bench/realtime-broadcast.mjs --mode wire --json` → exit 0
  (three runs, raw JSON above)

Focused new-test run — `npx vitest run src/game/broadcast.test.ts src/game/servers.test.ts
--reporter=verbose` → exit 0, 60 tests passed:
```
 ✓ createRemovalBatcher > buffers one player’s ids in acceptance order and flushes once at the window boundary
 ✓ createRemovalBatcher > keeps one group per player in first-enqueue order and pins the server of the first enqueue
 ✓ createRemovalBatcher > flush() emits pending groups synchronously and cancels the window
 ✓ createRemovalBatcher > does not invoke the callback when flush() has nothing pending
 ✓ createRemovalBatcher > starts a fresh window after a flush, including an enqueue from the flush callback
 ✓ createRemovalBatcher > discard() clears the timer and makes later enqueue/flush inert
 ✓ createRemovalBatcher > schedules exactly one injected timer with the configured window and clears it on flush
 ✓ createEconomyCoalescer > flushes only the highest revision, once per interval
 ✓ createEconomyCoalescer > ignores a lower revision queued before or after the flush
 ✓ createEconomyCoalescer > flushes immediately on purchase and drops an older late purchase result
 ✓ createEconomyCoalescer > keeps one independent timer per account
 ✓ createEconomyCoalescer > discard() clears every pending account and makes queue/flush inert
 ✓ createEconomyCoalescer > schedules exactly one injected timer per account with the configured interval
 ✓ registry index (T2) > returns the snapshot location for a live member and a fresh object every call
 ✓ registry index (T2) > returns null for an unknown member
 ✓ registry index (T2) > keeps survivors on their slots across a hole and tracks the member that refills it
 ✓ registry index (T2) > tracks an executed move and clears the member’s old slot
 ✓ registry index (T2) > drops the index and the server entry when an emptied server is destroyed
 ✓ registry index (T2) > visits occupied slots ascending, skipping holes, and passes primitives only
 ✓ registry index (T2) > visits nothing for an unknown server id
 ✓ registry index (T2) > keeps locationOf equal to every servers() snapshot location over 200 seeded operations
 ✓ registry index (T2) > keeps the defensive servers() contract against entry mutation
```

## Acceptance audit

- **AC-4 — met.** `locationOf` reads the maintained index and returns a fresh `{ serverId, slot }`
  or `null`; the deterministic 200-operation seeded-LCG sequence asserts `locationOf` equals
  the `servers()` snapshot location for every ever-assigned id after every step (live or
  `null`), covering holes, refilled slots, destroyed servers and moves; explicit tests pin the
  fresh-object mutation behavior and the unknown-member `null`.
- **AC-5 — met.** `forEachMember` visits only occupied slots in ascending slot order (holes
  skipped), passes `string`/`number` primitives, and visits nothing for an unknown or destroyed
  server id; pinned by exact visit arrays and the destroyed-server test.
- **AC-6 — met.** The pre-existing `servers()` snapshot test is unchanged; a new test mutates a
  returned snapshot entry (member slot, reversed members, server id) and asserts the registry
  is unchanged. `servers()` itself is untouched.
- **AC-24 (script) — met.** `tests/bench/realtime-broadcast.mjs` is zero-dependency Node 24 and
  supports `--mode in-process --json` and `--mode wire --json` (plus `--clients`, `--clicks`,
  `--burst`, `--interval-ms`, `--ws`/`--url`/`BACKEND_WS_URL`, `--baseline`,
  `--max-p95-delta-ms`). It resets every counter after the ten joins/`welcome` setup, counts
  economy writes through `creditWithRevision` (falling back to `credit` on the baseline),
  and emits `encodeCallsPerBroadcast`, `registrySnapshotsPerBroadcast`,
  `removalFramesPer100Clicks`, `economyFramesPer100Clicks`, `dbCreditsPer100Clicks`,
  `maxRemovalFrameBytes`; wire mode adds `p95AckLatencyMs` and per-client frame counts, and
  fails if fewer than all clicks are acknowledged within 5 s. Six final runs exited 0.
  `registrySnapshotsPerBroadcast` is `null` until T3 wires `HubDeps.registry`, exactly as the
  plan pins for the baseline; the static baseline is 2 `servers()` copies per accepted click.
- **AC-25 (baseline half) — met.** Raw baseline JSON (3 in-process, 3 wire) is recorded above:
  encode 10/broadcast, 100 removal frames, 100 economy frames, 100 DB credits, p95 median
  2.45 ms, max removal frame 59/60 bytes, plus the static 2 registry snapshots per click.
- **AC-29 (coalescer half) — met.** Unit tests pin highest-revision-wins absolute state:
  revision 3 then 1 flushes only 3; a revision 1 queued after 3 (even after the flush) is
  ignored; the purchase-race sequence forces the newest pending snapshot, cancels the pending
  window, and drops an older late purchase result. The repository revision column and the hub
  guards are T3.
- **AC-30 (scheduler half) — met.** Both `discard()` implementations clear their timers/state
  and make later `enqueue`/`queue`/`flush` inert; advancing fake timers after discard produces
  no callback. The hub closed-guard half is T3.

## Deviations from spec

None. T2 implemented only its owned files: the registry index, the two schedulers, their unit
suites, and the benchmark harness. `hub.ts`, `protocol.ts`, the frontend, `tests/e2e/smoke.mjs`,
compose files, Dockerfiles, `package.json`/lockfile and CI were not touched. The after-wiring
benchmark targets (encode 1, registry copies 0, removal frames ≤ 8, economy frames ≤ 16,
p95 ≤ baseline + 60 ms) remain unmeasured by design until T3.
