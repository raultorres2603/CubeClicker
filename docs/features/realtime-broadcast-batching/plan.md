---
feature: realtime-broadcast-batching
revision: 3
---
# Plan — Real-Time Broadcast Batching

## Architecture

The feature changes the hub's **outbound path only**. Game state, authority, identity, persistence timing and the container path stay where they are.

**Current hot path (baseline).**

```
explode ──► validate ──► member.cube.removedIds.add(id)
                         └─► broadcast(serverId, miniCubeRemoved)
                               └─► registry.servers()            (deep copy of every server)
                                   └─► find(serverId)
                                       └─► for each member
                                             └─► send() ──► JSON.stringify (once PER member)

account credit ──► repo.credit (one write) ──► members.economy = result
                                              └─► broadcastEconomyUpdate
                                                    └─► for each account connection
                                                          └─► JSON.stringify (once PER connection)
```

`locationOf` and `rosterFor` each call `registry.servers()` again, so a click plus a broadcast deep-copies the registry at least twice.

**New hot path.**

```
explode ──► validate ──► member.cube.removedIds.add(id)          (authority first, unchanged)
                         └─► removalBatcher.enqueue(serverId, playerId, id)

40 ms timer / boundary ──► flushRemovalBatches()
                              └─► for each group
                                    ├─ 1 id  → miniCubeRemoved   (legacy shape)
                                    └─ ≥2 ids → miniCubesRemoved (new shape)
                                        └─► broadcast(serverId, message)
                                              ├─► encodeServerMessage  (ONCE)
                                              └─► registry.forEachMember(serverId, ...)
                                                    └─► deliver(connection, text)
                                                          ├─ isOpen() check
                                                          └─ try peer.send(text) catch → terminate(peer)

account credit ──► repo.creditWithRevision (one write, unchanged)
                     └─► { economy, revision }
                           └─► if revision > lastAppliedRevision:
                                 members.economy = economy
                                 economyCoalescer.queue(accountId, revision, economy)

250 ms per account ──► flushEconomy(accountId)
                         └─► broadcastAccount(accountId, economyUpdateMessage(highestRevision))
                               ├─► early return if no joined connection matches (no encode)
                               ├─► encode (ONCE)
                               └─► fan out to every joined connection of the account
```

`hub.close()` flips a `closed` flag before `discard()`; late frames, late attaches and late async continuations are inert.

**State ownership.**

- `servers.ts` owns membership and the derived index. `servers` (the array) remains the truth for planning; `locations` and `serversById` are private derived indexes. `servers()` remains a defensive snapshot; `locationOf`/`forEachMember` are read-only views.
- `hub.ts` owns policy: which events queue, when to flush, what a boundary is, and which connections receive a message. It remains the single authority for boards, economy and membership.
- `broadcast.ts` (new) owns only timing/aggregation: a removal buffer keyed by player (with the server recorded at enqueue) and a per-account economy buffer keyed by the highest write revision. It has no peers, no game state and no knowledge of message shapes; it invokes injected callbacks. `discard()` makes both inert.
- `hub.ts` owns the per-account `lastAppliedRevision` (economy) and `lastAppliedUpgradeRevision` (purchase upgrades) guards plus the `closed` shutdown guard; `auth/economy-repository.ts` owns the atomic revision bump and returns it with the absolute result.
- `protocol.ts` owns the wire catalog and codecs on both sides.
- The frontend `server-state.ts` reducer owns the client's world state; `session.ts` owns engine reconciliation; `render/world.ts` owns the remote-cube visuals. All three consume the new frame; none gains authority.

## Interfaces / contracts

### Protocol (backend `src/backend/src/game/protocol.ts`, mirrored in `src/frontend/src/multiplayer/protocol.ts`)

```ts
// ServerMessage union addition
| { type: 'miniCubesRemoved'; playerId: string; ids: MiniCubeId[] }

// Builder (both mirrors, for parity tests; the hub uses the backend one)
export function miniCubesRemovedMessage(
  playerId: string,
  ids: readonly MiniCubeId[],
): ServerMessage;
```

Rules:

- `playerId` is a non-empty string; `ids` is a non-empty array of non-empty strings (the same presence/type bar as `miniCubeRemoved`; the `face:row:col` range is not re-validated because the hub generates ids from the authoritative board).
- The builder validates at runtime — `typeof playerId === 'string' && playerId.length > 0`, `Array.isArray(ids)`, `ids.length > 0`, every entry `typeof id === 'string' && id.length > 0` — copies `ids` defensively, and throws `TypeError('invalid miniCubesRemoved payload')` on any violation (mirroring `lootboxOpenedMessage`'s fail-fast). The TypeScript signature stays `readonly MiniCubeId[]`; tests cast malformed arrays to exercise the runtime guard.
- The frontend `parseServerMessage` returns a copied `ids` array and rejects the same malformed shapes with `{ ok: false, error: 'bad_message' }`.
- No version field is added; the frame is additive. A one-id flush uses the existing `miniCubeRemoved` shape, so a single click never exposes the new type.

### Registry (`src/backend/src/game/servers.ts`)

```ts
export interface ServerLocation {
  serverId: number;
  slot: number;
}

export interface ServerRegistry {
  // existing: serverCount, servers, assign, removeMember, moveMember, plan

  /** O(1) live location from the maintained index; `null` for an unknown member. */
  locationOf(playerId: string): ServerLocation | null;

  /**
   * Visits the occupied slots of one server in ascending slot order.
   * No slot table escapes; the visitor receives primitives only.
   */
  forEachMember(serverId: number, visit: (playerId: string, slot: number) => void): void;
}
```

Implementation: a private `locations: Map<string, ServerLocation>` and `serversById: Map<number, ServerState>`, updated by `assign`, `removeMember` and `moveMember`; `serversById` entries are added/removed with server creation/destruction. `locationOf` returns a fresh `{ serverId, slot }` object. `servers()` and `plan()` are unchanged; `computeMovePlan` keeps reading the internal array. Invariant: `locations` and `serversById` are derived from `servers` and must agree after every mutation (pinned by a 200-operation test).

### Broadcast schedulers (`src/backend/src/game/broadcast.ts`, new)

```ts
export interface TimerFns {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

export interface RemovalGroup {
  serverId: number;
  playerId: string;
  ids: MiniCubeId[];
}

export interface RemovalBatcher {
  /** Adds one accepted id; starts the window on the first enqueue. */
  enqueue(serverId: number, playerId: string, id: MiniCubeId): void;
  /** Flushes every pending group now and clears the timer (boundary flush). */
  flush(): void;
  /** Clears the timer and drops pending ids (hub shutdown). */
  discard(): void;
  /** Number of pending groups (tests/benchmark observability). */
  pendingGroups(): number;
}

export function createRemovalBatcher(options: {
  windowMs: number;
  timers: TimerFns;
  flush: (groups: readonly RemovalGroup[]) => void;
}): RemovalBatcher;

export interface EconomyCoalescer {
  /**
   * Records the latest absolute state with its write revision.
   * Ignores a revision <= the account's highest queued revision.
   */
  queue(userId: string, revision: number, economy: EconomyState): void;
  /** Sends the highest-revision pending state now, cancels that account's timer. */
  flush(userId: string): void;
  /** Clears every account timer and pending state and makes the coalescer inert. */
  discard(): void;
  /** Number of accounts with a pending state (tests/benchmark observability). */
  pendingAccounts(): number;
}

export function createEconomyCoalescer(options: {
  intervalMs: number;
  timers: TimerFns;
  flush: (userId: string, revision: number, economy: EconomyState) => void;
}): EconomyCoalescer;
```

Both schedulers use a map keyed by player/account. `createRemovalBatcher` tracks a `discarded` flag; `createEconomyCoalescer` tracks `lastRevision: Map<string, number>` (highest queued) plus a `discarded` flag. `queue` ignores `revision <= lastRevision[userId]`; a higher revision replaces the pending state. A flush copies the pending entries, clears the maps/timer, then invokes the callback synchronously. `flush(userId)` with no pending entry is a no-op. `discard()` clears all timers/buffers, resets the flags, and makes later `enqueue`/`queue`/`flush` no-ops. The callback never re-enters the scheduler in a way that loses an update: the maps are cleared before the callback, so an enqueue during the callback starts a fresh window.

### Economy repository revision (`src/backend/src/auth/economy-repository.ts`)

```ts
export interface EconomySnapshot {
  /** Absolute post-write totals for this write. */
  economy: EconomyState;
  /** Monotonic per-account write revision (1, 2, 3, ...). */
  revision: number;
}

export interface EconomyRepository {
  // existing methods stay; `credit` remains a convenience wrapper returning `.economy`
  findByUserId(userId: string): Promise<EconomyState | null>;
  /** Read the absolute totals and the current revision for a join baseline. */
  findEconomySnapshot(userId: string): Promise<EconomySnapshot | null>;
  /** Read the upgrade levels and the revision of the same row in one atomic read. */
  findUpgradesSnapshot(userId: string): Promise<{ upgrades: UpgradeState; revision: number }>;
  /** One atomic write; bumps `economy_revision` and returns the absolute result. */
  creditWithRevision(userId: string, delta: EconomyDelta): Promise<EconomySnapshot>;
  credit(userId: string, delta: EconomyDelta): Promise<EconomyState>; // delegates, returns .economy
  purchaseUpgrade(...): Promise<{
    economy: EconomyState;
    upgrades: UpgradeState;
    /** Same monotonic revision space as creditWithRevision. */
    revision: number;
  } | null>;
  // remaining customization/last-seen methods unchanged
}
```

SQL: `007_economy_revision.sql` adds `economy_revision BIGINT NOT NULL DEFAULT 0` to `user_economy` (and `schema.sql` matches). `creditWithRevision` inserts `economy_revision = 1` for a new row and `SET economy_revision = user_economy.economy_revision + 1` on conflict, returning it with the four totals. `purchaseUpgrade` adds `economy_revision = economy_revision + 1` and returns it. `findEconomySnapshot` selects the four totals plus `economy_revision`; `findUpgradesSnapshot` selects `upgrades` plus the same `economy_revision` in one query, so the join seeds both guards from the same row revision. The in-memory repository keeps `revision` in `StoredRow` (0 when absent, incremented on credit/purchase, preserved by `touchLastSeen` and all row copies). `credit` and `findUpgradesByUserId` remain wrappers so existing callers/tests keep their return types; the hub uses `creditWithRevision` and `findUpgradesSnapshot`.

### Hub (`src/backend/src/game/hub.ts`)

```ts
/** New pinned policy constants (exported for tests/benchmark). */
export const MINI_CUBE_BATCH_WINDOW_MS = 40;
export const ECONOMY_BROADCAST_INTERVAL_MS = 250;

export interface HubDeps {
  // existing: config, now, random, timers, economy
  /**
   * Test/benchmark seam: a registry matching `config.maxUsersPerServer`.
   * Production omits it and the hub creates its own.
   */
  registry?: ServerRegistry;
}
```

Hub helpers after the change:

```ts
function deliver(connection: Connection, text: string): void;
function send(connection: Connection, message: ServerMessage): void;       // encode once for one peer
function sendToPlayer(playerId: string, message: ServerMessage): void;     // unchanged semantics
function broadcast(serverId: number, message: ServerMessage, except?: string): void; // encode once + forEachMember
function broadcastAccount(userId: string, message: ServerMessage): void;   // early return if no recipient, then encode once
function flushRemovalBatches(): void;                                      // batcher.flush()
function flushEconomy(userId: string): void;                               // coalescer.flush()
function applyEconomySnapshot(accountId: string, snapshot: EconomySnapshot): boolean; // economy revision guard
function applyUpgradeSnapshot(accountId: string, revision: number, upgrades: UpgradeState): boolean; // purchase revision guard
```

State inside `createGameHub`: `let closed = false;`, `const economyRevisions = new Map<string, number>();`, `const upgradeRevisions = new Map<string, number>();`, and the two scheduler instances. `deliver` returns immediately when `closed`; otherwise it keeps the `isOpen()` guard and adds `try { peer.send(text) } catch { terminate(connection) }`. `terminate` clears the heartbeat and closes the peer; the existing close handler removes the connection, so a failed send cannot abort the fan-out or leak a connection.

`broadcast` uses `registry.forEachMember(serverId, (playerId) => { if (playerId !== except) sendToMemberEncoded(playerId, text); })`. `sendToMemberEncoded` resolves `members.get(playerId)?.connection` and calls `deliver`; a member in grace (`connection === null`) is skipped, as today.

`broadcastAccount` first collects the joined connections of the account (`playerId !== null`, `accountSession.userId === userId`, `peer.isOpen()`), **returns before any `encodeServerMessage` call when the list is empty**, then encodes once and delivers to each collected connection. This makes AC-22's no-recipient flush encode-free as well as send-free.

`applyEconomySnapshot(accountId, snapshot)` returns `false` when `snapshot.revision <= (economyRevisions.get(accountId) ?? 0)`; otherwise it stores the revision, sets `m.economy = snapshot.economy` for every member with that account, and returns `true`. It is the authoritative ordering guard for totals; the coalescer's own highest-revision check is the last line of defense.

`applyUpgradeSnapshot(accountId, revision, upgrades)` is a **separate** guard with the same shape but its own map: it returns `false` when `revision <= (upgradeRevisions.get(accountId) ?? 0)`; otherwise it stores the revision, sets `m.upgrades = upgrades` for every member with that account, and returns `true`. It is called only for `purchaseUpgrade` results (a credit never changes upgrades). The caller broadcasts `upgradesUpdate` only when this returns `true`, so two purchases resolving out of order cannot let the older absolute upgrade map overwrite the newer one or reach the wire; because `miniCubeMultiplier`/`cubeMultiplier` read `member.upgrades`, keeping the newer map also keeps later credit deltas correct.

## Removal batching lifecycle

1. **Accept.** `handleExplode` validates the rate window and `validateExplode` exactly as today, adds the id to `member.cube.removedIds`, computes the face-clear credit synchronously, then calls `removalBatcher.enqueue(location.serverId, member.playerId, id)`. No removal frame is sent synchronously. Rate-limited/invalid clicks enqueue nothing.
2. **Accumulate.** The first enqueue in an empty batcher starts `setTimeout(flush, MINI_CUBE_BATCH_WINDOW_MS)` with the injected timers. Later enqueues append to the same group (per player, with the server recorded on the first enqueue). A group's `ids` are in acceptance order; the same id cannot repeat because `validateExplode` rejects an already-removed id.
3. **Flush.** At the timer or a boundary, the batcher hands the groups to the hub. For each group: one id → `miniCubeRemovedMessage`; two or more → `miniCubesRemovedMessage`. The hub broadcasts each once to the recorded server. Order across groups follows first-enqueue order; order within a group is acceptance order.
4. **Boundary flush.** `flushRemovalBatches()` is called synchronously before the following messages:
   - `handleCompletion`: after validation (so an invalid completion changes nothing) and **before** `createNextCube`, the cube reset, `levelAdvanced`, `worldEntered`, `memberLeft (moved)` and `memberJoined`.
   - `handleJoin`: before `welcome` and the `memberJoined` broadcast.
   - `handleRejoin`: before `welcome`.
   - `removeMember` (grace expiry / final removal): before `memberLeft (left)`.
   - `hub.close()`: `discard()`, no sends.
   - `handleRotate` does **not** flush: orientation is independent of the removed set.
5. **Reconnect.** A member has no per-client queue. If its socket is closed, the flush skips it (`deliver` sees a null connection or a closed peer). On `rejoin`, `welcome` carries `self.removedIds` and the roster built from the authoritative `member.cube.removedIds`; the client replaces the board. An invalid click's `stateSync` is equally authoritative. A missed batch is presentation-only.

**Why a global batcher (not per server).** One map + one timer is simpler to reason about and test; a boundary flush of one server also flushes other servers' pending removals, which only delivers them slightly earlier and never changes ordering within a server. A per-server timer would add N timers and no correctness benefit.

**Ordering argument.** The batcher's callback runs synchronously inside the 40 ms timer callback or the boundary handler. Every frame for a server is emitted by `broadcast` in call order; a boundary call happens before the boundary message's `broadcast` call, so the batch precedes it in every recipient's socket. The origin's own ack is included, as today.

**Frame size.** A member can be admitted at most 30 times per trailing second, so a 40 ms window holds at most 30 ids; the worst-case `miniCubesRemoved` frame is well below 1024 bytes (pinned by AC-14). No extra cap is needed; a `MAX_BATCH_IDS` split would add a second message on a path the rate limiter already bounds.

## Economy coalescing lifecycle

1. **Authority first.** On every economy write result, the hub calls `applyEconomySnapshot(accountId, snapshot)`. The guard accepts only `snapshot.revision > economyRevisions.get(accountId)`; on acceptance it stores the revision and sets `m.economy = snapshot.economy` for every member of that account. A late older result is dropped before it can touch member state.
2. **Queue.** Accepted updates call `economyCoalescer.queue(accountId, snapshot.revision, snapshot.economy)`. The coalescer keeps only the highest-revision pending snapshot per account (a lower revision is ignored) and starts one `setTimeout(flush, 250)` per account. States are never accumulated: the frame always carries absolute totals.
3. **Flush.** At 250 ms, `broadcastAccount(accountId, economyUpdateMessage(highestRevisionSnapshot))` returns early if no joined connection matches (no encode, no send), otherwise encodes once and sends to every joined connection of the account. The pending entry is cleared before the send, so a new credit during the send starts a new window.
4. **Forced flushes / purchase ordering.** `handlePurchaseUpgrade` applies the result in two independent parts:
   - **Upgrades:** call `applyUpgradeSnapshot(accountId, result.revision, result.upgrades)`. Only when it returns `true` (the purchase is newer than the last applied purchase) are the account's `member.upgrades` updated and `broadcastAccount(accountId, upgradesUpdateMessage(result.upgrades))` sent immediately. When it returns `false` (an older purchase resolved late), the older absolute upgrade map is dropped before it can overwrite `member.upgrades` or emit an older `upgradesUpdate`; the newer map — which feeds `miniCubeMultiplier`/`cubeMultiplier` for later credits — stays in place.
   - **Economy:** call `applyEconomySnapshot(accountId, { economy: result.economy, revision: result.revision })`; only when it returns `true` are the totals applied, queued and `flushEconomy(accountId)` called. An economy result older than an applied credit is suppressed, but that does not suppress a newest purchase's upgrades (the two guards are independent).
   A pending automatic economy window is cancelled by a forced economy flush, so no duplicate arrives at its deadline. `handleJoin`'s idle-credit path uses `creditWithRevision`, applies the snapshot, and keeps today's immediate pre-`welcome` broadcast.
5. **Upgrades/customization.** `upgradesUpdate` and `customizationUpdate` remain immediate; only their encoding changes (once, then fan out), and `broadcastUpgradesUpdate` goes through the same single-encode `broadcastAccount` path. The completion path's two broadcasts stay separate messages; see Key decisions #6.
6. **No open connections.** `broadcastAccount` collects matching joined connections first and returns before encoding when the list is empty. `hub.close()` discards all pending timers/states. A rejoin during a pending window gets the latest applied absolute totals and upgrades in `welcome`; it does not need the missing frame.
7. **Database writes.** Unchanged in count and timing: `creditWithRevision` is called once per accepted click and once per completion, `grantCustomization` once per completion, and `purchaseUpgrade` once per purchase. The revision is bumped inside that same statement; the coalescer only batches the broadcast of results.

**Out-of-order contract.** `credit()` and `purchaseUpgrade()` are async `UPDATE ... RETURNING` writes: two concurrent writes can resolve in either order, and the late result can be an older absolute state. Promise-resolution order is therefore not write order. The `economy_revision` column is bumped atomically by the same `UPDATE`/`INSERT ... ON CONFLICT` (and by `purchaseUpgrade`), so each result carries the actual per-account write order. Two independent guards consume it: `lastAppliedRevision` for economy totals (with the coalescer's highest-revision rule) and `lastAppliedUpgradeRevision` for upgrade maps. The final economy frame is the result of the highest-revision write, which includes every earlier write to that row; the final upgrades are the newest **purchase**'s map. A failed write produces no result (as today), so the last successful write remains authoritative. `findEconomySnapshot` and `findUpgradesSnapshot` on join seed both guards so an in-flight older result cannot beat the persisted baseline; if another connection of the account already holds a newer applied revision, the joining member starts from that member's economy/upgrades and the read is only the fallback. A subsequent `handleExplode`/completion credit reads the guarded `member.upgrades`, so a late older purchase can never under-credit later cubes.

## Shutdown

- `close()` sets `closed = true` as its first statement, then `discard()`s the removal batcher and economy coalescer, clears grace/heartbeat timers and clears `connections`, `members`, `tokens`, `openingMembers`, `economyRevisions` and `upgradeRevisions`.
- `handleMessage` returns immediately when `closed`, before decoding or rate-limit state changes; a late client frame cannot join, explode, rotate, purchase or queue a removal timer.
- `attach` closes the peer when `closed`.
- `handleJoin` checks `closed` **after every repository await** (economy snapshot/credit, upgrades snapshot, customization, last-seen, touch, idle credit) and returns before `registry.assign`, `members.set`, `tokens.set`, `connection.playerId` or `recomputePlan`; an in-flight join that started before close leaves no member, token, connection, timer or send.
- Every other async continuation (`creditWithRevision`/`purchaseUpgrade` `.then`, `grantCustomization`, `applyLootboxOpenV2`, `setSlotAppearance`) returns immediately when `closed`, before member updates, coalescer queues or sends.
- `deliver`, `broadcast` and `broadcastAccount` also return when `closed` as defense in depth; `discard()` makes the schedulers' `enqueue`/`queue`/`flush` no-ops so no new timer can be created.
- Tests: pending removal + pending economy + `close()` + `advance(1000)` → no sends; a deferred credit resolving after `close()` → no send and no timer; **a deferred `handleJoin` repository resolving after `close()` → no member/token/connection/timer/send**; a late `explode`/`join`/`rotate` frame after `close()` → no send, no membership change, no timer; `attach` after close closes the peer.

## Benchmark methodology

Script: `tests/bench/realtime-broadcast.mjs` (new, zero new dependencies; Node 24 global `WebSocket` in wire mode; the existing `tsx` dev dependency only for the in-process dynamic import of TypeScript modules).

**In-process mode** (`node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json`):

- Builds a real `createGameHub` with a real `createServerRegistry`, a counting proxy around the registry's `servers()` (through the `HubDeps.registry` seam), an `InMemoryEconomyRepository` wrapped to count economy writes (`creditWithRevision` when present, `credit` on the baseline; normalized to one write per click), a manual clock/scheduler implementing `setTimeout`/`clearTimeout`/`setInterval`/`clearInterval`, and fake peers that record frames.
- Creates ten joined members: one account clicker (user `bench`) and nine guests. Sends 100 accepted explodes as four bursts of 25 with a 1100 ms manual-clock gap (each burst is inside the 30/s trailing window), drains microtasks after each burst, advances 40 ms for the removal flush and 250 ms for the economy flush.
- **Resets every counter after the ten joins and their `welcome`/`memberJoined` frames**, then measures only the 100-click burst:
  - `encodeCallsPerBroadcast`: `JSON.stringify` calls whose argument is a `ServerMessage`, divided by the number of broadcasts **in the measurement window** (a `JSON.stringify` wrapper filters out the benchmark's own `explode` frames and setup frames are excluded by the reset);
  - `registrySnapshotsPerBroadcast`: calls to the injected registry's `servers()` divided by the window's broadcasts;
  - `removalFramesPer100Clicks`, `economyFramesPer100Clicks`, `totalFramesPer100Clicks` on the clicker;
  - `dbCreditsPer100Clicks`: the counting repository's economy-write calls;
  - `maxRemovalFrameBytes`: the largest encoded removal frame.
- Because `HubDeps.registry` does not exist at the baseline commit, the baseline run reports `registrySnapshotsPerBroadcast: null` and the log records the static baseline (two `servers()` copies per accepted click: `broadcast` and `locationOf`). The after run reports `0`. `encodeCallsPerBroadcast` is measured on both versions.

**Wire mode** (`node tests/bench/realtime-broadcast.mjs --mode wire --json`, backend running at `ws://localhost:8080/ws`):

- Opens `--clients` (default 2) guest clients, joins each, waits for `welcome`, sends the same four 25-click bursts from one client at 1.1 s intervals, and records every received frame with `performance.now()` timestamps.
- `p95AckLatencyMs` is the 95th percentile of (removal-frame receipt time − click send time) for the clicker, matching each click id to either `miniCubeRemoved.id` or membership in `miniCubesRemoved.ids`.
- Reports removal frames per 100 clicks per recipient and the accepted count (fails if accepted < 100).
- Optional `--baseline <file.json>` compares the medians and exits non-zero when `p95AckLatencyMs > baseline + --max-p95-delta-ms` (default 60).

**Procedure.**

1. At T2, before changing `servers.ts`/`hub.ts`, start the current backend (`podman compose up -d backend`), run the wire baseline three times, and run the in-process baseline three times; store the raw JSON in `build-log-T2.md`.
2. At T3, after the hub wiring, restart the backend (`podman compose restart backend`), rerun both modes three times; store the raw JSON in `build-log-T3.md` and compare medians.
3. At T5, rerun the in-process mode as a reproducibility check and copy the consolidated medians into `build-log-T5.md`.
4. If Podman/the backend cannot run in the builder environment, record wire mode as "not executed — environment" with the exact command; the in-process mode still measures four of the five metrics, and p95 is marked unmeasured.

**Targets** are AC-25; they are evidence gates recorded in build logs, not CI assertions (Q-4). The benchmark script itself exits non-zero on malformed output, a failed join, fewer than 100 accepted clicks, or a `--baseline` overrun.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/protocol.ts` | edit | `miniCubesRemoved` union member, builder with full runtime validation, catalog comment |
| `src/backend/src/game/protocol.test.ts` | edit | builder/encoder/copy/frame-size/full-validation tests |
| `src/frontend/src/multiplayer/protocol.ts` | edit | mirrored union member, decoder, parity builder, header comment |
| `src/frontend/src/multiplayer/protocol.test.ts` | edit | valid/invalid/parity tests |
| `src/backend/src/game/servers.ts` | edit | `locationOf`, `forEachMember`, private indexes |
| `src/backend/src/game/servers.test.ts` | edit | index-vs-snapshot invariant, visitor order/holes, snapshot preservation |
| `src/backend/src/game/broadcast.ts` | new | removal batcher + revision-aware economy coalescer |
| `src/backend/src/game/broadcast.test.ts` | new | scheduler unit tests (highest-revision-wins, inert after discard) |
| `src/backend/src/game/hub.ts` | edit | encode-once fan-out, registry wiring, batching, revision/closed guards, `HubDeps.registry`, constants |
| `src/backend/src/game/hub.test.ts` | edit | flush-aware existing suite + fan-out/batching/economy/ordering/shutdown tests |
| `src/backend/src/auth/economy-repository.ts` | edit | `economy_revision` bump, `EconomySnapshot`, `findEconomySnapshot`, `findUpgradesSnapshot`, `creditWithRevision`, purchase revision |
| `src/backend/src/auth/economy-repository.test.ts` | edit | revision monotonicity, economy/upgrade snapshot-read and two-purchase ordering tests |
| `src/backend/src/db/migrations/007_economy_revision.sql` | new | additive `economy_revision BIGINT NOT NULL DEFAULT 0` |
| `src/backend/src/db/migration-007.test.ts` | new | static migration assertions (and the existing PG `dbDescribe` pattern where available) |
| `src/backend/src/db/schema.sql` | edit | mirror the `economy_revision` column |
| `src/frontend/src/multiplayer/server-state.ts` | edit | `miniCubesRemoved` reducer case (header comment) |
| `src/frontend/src/multiplayer/server-state.test.ts` | edit | batch idempotence/referential stability |
| `src/frontend/src/multiplayer/transport.test.ts` | edit | raw batch frame decode path |
| `src/frontend/src/game/session.ts` | edit | self reconciliation for every batch id (header comment) |
| `src/frontend/src/game/session.test.ts` | edit | self batch reconciliation + the explicit decode→reduce→session→WorldView integration chain |
| `src/frontend/src/render/world.ts` | edit | apply every batch id to the member view (header comment) |
| `src/frontend/src/render/world.test.ts` | edit | batch visual application |
| `tests/e2e/smoke.mjs` | edit | one-burst `miniCubesRemoved` check; comment/label update |
| `tests/bench/realtime-broadcast.mjs` | new | benchmark/load harness |
| `README.md` | edit | benchmark commands subsection |
| `docs/architecture/realtime.md` | new | fan-out, batching, coalescing, reconnect/authority, benchmark |
| `docs/features/realtime-broadcast-batching/build-log-T1..T5.md` | new (builder) | raw verification/benchmark evidence |
| `docs/features/realtime-broadcast-batching/{spec,plan,tasks,status}.md`, `reviews/**` | planner/orchestrator | feature artifacts |

No container, compose, Dockerfile, CI workflow, `package.json` or lockfile changes.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Encode each server message once and fan out the same string | Removes N−1 `JSON.stringify` calls per broadcast; all peers receive byte-identical bytes; per-server call order is unchanged | Cache encoded strings by message identity (no benefit; messages are built fresh); send objects and let each peer stringify (current bug) |
| 2 | O(1) `locationOf` + visitor `forEachMember`, keep `servers()` snapshot | Removes deep copies from broadcast/location/roster paths without letting mutable slot tables escape; the snapshot API stays for tests/callers | Return live arrays (mutation risk); return shallow server objects (still exposes arrays); keep `.find()` scans (no copy but O(servers)) |
| 3 | 40 ms removal window, one-id flush uses legacy `miniCubeRemoved` | A 25-click burst collapses to one frame; remote latency stays below the 140 ms destroy effect; a single click keeps the exact accepted frame and the smoke path | 30 ms (less coalescing), 50 ms (+10 ms latency), always `miniCubesRemoved` (breaks compatibility/smoke), frame-boundary batching (rAF is client-side; the hub has no frame) |
| 4 | Flush all pending groups at every boundary | Deterministic removal-before-level/membership ordering per server; one timer/map is simpler than per-server timers; earlier delivery of another server's batch is harmless | Per-server timers (more state, no ordering gain); flush only the affected server (more branchy, same result) |
| 5 | 250 ms per-account economy coalescing, absolute totals, monotonic per-account revision, forced flush on join credit and purchase | Caps automatic economy traffic at 4 Hz; absolute values keep reconnect/multi-tab correct; the revision guard makes out-of-order async results unable to regress; explicit actions stay immediate | 200 ms (5 Hz), per-connection coalescing (triples frames for multi-tab), delta frames (reconnect-unsafe), resolution-order-only ordering (regresses) |
| 6 | No `economyUpdate`/`customizationUpdate` fusion on completion | Encode-once already removes the per-recipient cost; the completion path is low-frequency; a fused frame adds a compound shape and a reducer branch for little gain | New fused `accountUpdate` message (more protocol surface, more client branches) |
| 7 | No slow-client queue; only synchronous send-error isolation | `ws`/TCP already buffer; a user-space queue needs a bounded drop/close policy and its own tests; closing only the throwing peer keeps the fan-out intact | Drop-oldest queue per peer (unbounded memory unless capped), close on `bufferedAmount` (needs a product decision), `send` to closed peers (current silent skip) |
| 8 | No protocol version bump; additive frame + legacy single-id shape | The frontend/backend deploy together; single-click traffic stays on the old shape, limiting mixed-version exposure; a version bump would add negotiation for no persisted benefit | Version field/negotiation (no consumer), always-batch (old clients drop every removal) |
| 9 | Benchmark: in-process (tsx) + wire (zero-dep), evidence only | In-process exposes encodes/registry copies/DB credits exactly; wire proves real sockets and p95; no new dependency; no machine-dependent CI gate | Vitest bench only (no wire), containerized load generator (new image/service), CI perf job (flaky thresholds) |
| 10 | Optional `HubDeps.registry` seam | Makes the zero-snapshot AC directly testable and powers the benchmark's registry counter, mirroring `now`/`random`/`timers`/`economy` | Code inspection/grep only (not a testable AC) |
| 11 | No batch-size cap beyond the rate limit | A window holds at most 30 ids; adding a split cap would create a second frame on the same path for no measured benefit | `MAX_BATCH_IDS = 16/32` split (extra branch/tests) |
| 12 | Per-account `economy_revision` column bumped in the existing write, with **two** hub guards (`lastAppliedRevision` for totals, `lastAppliedUpgradeRevision` for upgrades) | Promise-resolution order is not write order; an atomic revision returned by the same `UPDATE`/`INSERT` is the only way to drop a late older result without changing the one-write-per-click path. A separate upgrade guard is required because a newer credit can raise the economy revision without changing upgrades, while an older purchase must never overwrite the newer upgrade map that feeds later multipliers | Hub-side issuance order (late older writes still regress), a single shared revision for both values (a newer credit would wrongly suppress a newest purchase's upgrades), per-account write queue/serialization (changes DB concurrency/timing), `updated_at` timestamps (same-microsecond ties are not a strict order) |
| 13 | A `closed` flag plus inert schedulers | `close()` must stop late frames and late async continuations from creating timers or sending; a flag checked before handlers/continuations and a `discard()` that prevents new timers closes both gaps | Only clearing existing timers (late callbacks still schedule), removing listeners (in-flight promises still run) |

## Risks & mitigations

- **Test churn in `hub.test.ts`.** Inserting a 40 ms flush changes when removal frames appear; the suite asserts exact arrays. Mitigation: add a `flushRemovals(harness)` helper using `harness.advanceTimersOnly(MINI_CUBE_BATCH_WINDOW_MS)` so the injected click clock does not move (rate-limit windows stay exact); add `flushRemovals` at the end of `removeLevel`; adapt expected frames to one batch while preserving every accepted-id assertion. No payload loosening.
- **Perceived removal latency.** A remote viewer sees a tile up to 40 ms late. Mitigation: boundary flush before level/membership changes; local play is already optimistic; the destroy animation is 140 ms; p95 target is baseline + 60 ms.
- **Economy spend appears late.** Coalescing could delay the post-purchase HUD. Mitigation: purchase forces an immediate flush when its revision is newest and cancels the window; join idle credit stays immediate; welcome is authoritative.
- **Out-of-order economy results.** A late older `credit` result could overwrite a newer total or regress a coalesced frame. Mitigation: the atomic `economy_revision` is returned with each write; the hub's `applyEconomySnapshot` guard and the coalescer's highest-revision rule drop older results; tests resolve a later credit before an earlier one and race a purchase flush against a credit.
- **Out-of-order purchase upgrades.** A late older `purchaseUpgrade` result could overwrite `member.upgrades` and emit an older `upgradesUpdate`, under-crediting later cubes because the multipliers read that map. Mitigation: `applyUpgradeSnapshot` with a separate `lastAppliedUpgradeRevision` drops older purchase maps; a two-purchase out-of-order test asserts the newer map and frame win and that a subsequent explode credit uses the newer multiplier; the join seeds the guard from one atomic `findUpgradesSnapshot` read.
- **Lost latest economy update.** A timer cleared without a send would lose the last totals. Mitigation: `flush(userId)` sends the highest-revision pending snapshot before clearing, the timer callback clears before invoking the send, and tests cover one-update windows, out-of-order queues and close-before-window.
- **Migration risk.** The `economy_revision` column is additive (`ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT 0`), existing rows read 0, and the pre-feature code ignores it; a static migration test pins the statement and an optional PG suite applies it. No backfill is required.
- **Late activity after `close()`.** A credit promise, an in-flight `handleJoin`, or a client frame arriving after shutdown could schedule a timer, mutate membership or send. Mitigation: the `closed` flag is checked before `handleMessage`, `attach`, `handleJoin` after every await, `deliver`, `broadcast`, `broadcastAccount` and every async continuation; `discard()` makes the schedulers inert; tests cover pending state + close + advance, a deferred credit after close, a deferred join after close, and a late frame after close.
- **Index drift.** A missed update in `assign`/`removeMember`/`moveMember` would misplace a member. Mitigation: all three mutators update both indexes; a deterministic 200-op property test compares `locationOf` against `servers()` after every step; `locationOf` returns null rather than a stale location if the index disagrees.
- **Send-error behavior change.** A throwing peer now closes instead of propagating. Mitigation: only synchronous throws are caught; the close path is the existing one; a test asserts other peers still receive and the connection count drops.
- **Benchmark noise.** p95 on a container host is jittery. Mitigation: three runs, medians, same machine/host, relative +60 ms threshold, raw JSON recorded; wire mode is evidence, not CI.
- **Mixed-version clients.** An old frontend drops `miniCubesRemoved` as `bad_message`. Mitigation: single-id flushes keep the legacy shape; a coordinated deploy is the contract; the architecture doc records the degradation (remote visuals stale until reload/reconnect).
- **Protocol drift between mirrors.** Mitigation: the exact encoded literal is asserted in both suites; the frontend decodes the backend fixture; the parity fixture section is updated in both tests.

## Rollback

- Revert the feature commits (T1–T5) and restart the backend. The only persistence change is the additive `economy_revision` column: it can remain in place (the old code ignores it) or be dropped with a follow-up migration; there is no data backfill, no container/image/port/env change and no protocol version field. Pending removal batches and economy coalescing state live only in memory; a restart discards them. Clients receive a fresh `welcome` (reconnect) and the authoritative board/economy.
- Mixed-version rollback: an old backend never sends `miniCubesRemoved`, so a new frontend is unaffected; a new backend with an old frontend degrades only for multi-id bursts (the old frontend drops the frame; single clicks still use `miniCubeRemoved`), and a reload after the rollback restores normal behavior.
- The benchmark script and `docs/architecture/realtime.md` are inert and may stay or be reverted with the feature; they have no runtime effect.

## Verification

- Per-task commands are in `tasks.md`; behavior-change tasks run the workspace coverage pre-gate, and T5 runs the full root suite.
- Benchmark commands and targets are in § Benchmark methodology; raw output goes to the build logs.
- Container path: no change. The wire benchmark uses the already-published `ws://localhost:8080/ws`; the in-process benchmark runs on the host with the existing `tsx` dev dependency. `compose.yaml`, `compose.smoke.yaml`, Dockerfiles, `package.json` and `package-lock.json` stay untouched (T5 asserts with `git diff --exit-code`).
- Documentation: `docs/architecture/realtime.md` (new) and the `README.md` benchmark subsection; the feature-index row is proposed in the T5 log for the orchestrator to apply.

## Approval checkpoint

The build does not start until the user confirms the five user-visible/scope decisions below in the `awaiting_approval` summary; the queue-level "Proceed with all of them" is not specific approval. The spec's `## Approval checkpoint` is the canonical wording.

1. **Q-1 — 40 ms removal batch window** (remote removal up to 40 ms late; bursts collapse).
2. **Q-2 — 250 ms (4 Hz) economy/HUD coalescing** (absolute totals; purchase and join credit immediate).
3. **Q-3 — slow-client policy out of scope** (no queue/drop/close; only synchronous send-error isolation).
4. **Q-4 — benchmark evidence-only** (build-log proof, no CI gate).
5. **Q-5 — legacy single-id `miniCubeRemoved` shape** for a one-id flush.

Q-6/Q-7/Q-8 are builder defaults and need no separate user decision. The orchestrator records the confirmation in `status.md` before T1 starts.

## Open questions

See `spec.md` § Open questions (Q-1…Q-8). Q-1 (40 ms), Q-2 (250 ms), Q-3 (no slow-client policy), Q-4 (evidence-only benchmark) and Q-5 (legacy single-id shape) require user confirmation per the Approval checkpoint; Q-6 (no message fusion), Q-7 (`HubDeps.registry` seam) and Q-8 (new `docs/architecture/realtime.md`) are builder defaults this plan implements.

## Revision history

- r1 — 2026-11-13 — initial plan from the verified audit evidence; pins the encode-once fan-out, registry index/visitor, 40 ms removal batching with boundary flushes and the legacy single-id shape, 4 Hz absolute economy coalescing, the two-mode benchmark methodology, and the code-only rollback.
- r2 — 2026-11-13 — spec-review r1 revision: adds the five-item Approval checkpoint (F1); the per-account `economy_revision` ordering contract, repository/migration changes and out-of-order/purchase-race tests (F2); the `closed` guard and shutdown tests (F3); the explicit frontend integration chain (F4); fixes the roster citation (F5); full backend builder validation (F6); encode-free no-recipient account flushes (F7); post-setup counter reset and standardized `--json` commands (F8); smoke burst ids/order and the no-single-frame assertion (F9).
- r3 — 2026-11-13 — spec-review r2 revision: adds the separate `lastAppliedUpgradeRevision`/`applyUpgradeSnapshot` purchase guard, `findUpgradesSnapshot`, the two-purchase out-of-order and under-credit proof (F1); extends the shutdown guard to every `handleJoin` await with a deferred-join test (F2); makes the AC-18 integration wiring concrete with a real transport socket and a fake scene delegating to a real `WorldView.applyMessage` (F5).
