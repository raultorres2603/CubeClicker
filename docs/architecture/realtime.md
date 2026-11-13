# Real-Time Broadcast Path

This document describes the shipped outbound WebSocket path of the backend hub
(feature `realtime-broadcast-batching`, 2026-11-13). The application stack is decided in
[stack](stack.md), the delivery path in [containerization](containerization.md), and the
feature contract with its acceptance criteria in the
[feature spec](../features/realtime-broadcast-batching/spec.md).

CubeClicker runs a single backend process that owns the authoritative in-memory game servers;
there is no Redis, queue or microservice. The hub is the only authority for boards, membership
and economy, and the outbound path only decides when and in what shape a notification is sent.
No client-reported value becomes authoritative.

## Fan-out

A server broadcast is encoded **once** and the same string is delivered to every recipient.
`broadcast(serverId, message)` calls `encodeServerMessage` once, then walks the server's
occupied slots through `registry.forEachMember` and hands the identical text to `deliver`.
The origin receives its own frame, as before; an optional `except` player id is the only
recipient filter (used by `memberJoined`). Account broadcasts follow the same rule:
`broadcastAccount(userId, message)` first collects the account's joined, open connections,
returns before encoding when there are none, and otherwise encodes once and delivers the same
text to every connection — so multiple tabs of one account see byte-identical frames.

The registry backs this path with an O(1) `locationOf` index and a no-copy `forEachMember`
visitor that yields occupied slots in ascending order and only primitives. Hot paths no longer
call `registry.servers()`, whose defensive deep-copy snapshot survives for tests and external
callers. Encoding is not repeated per recipient anywhere in the hub.

Per-socket order follows the hub's call order: Node's `ws` writes frames in order per socket,
and frames for a server are emitted in the order `broadcast` is called. The visitor's slot
order is deterministic, so all recipients of one broadcast receive the same bytes in the same
relative position. `deliver` enforces a `closed` guard and an `isOpen()` check, and catches a
synchronous `send` throw: only the throwing peer is terminated through the normal close path,
so the rest of the fan-out continues and no connection leaks.

## Removal batching

An accepted mini-cube removal is written to the member's authoritative
`member.cube.removedIds` synchronously at acceptance; only the notification is batched. The
hub buffers accepted ids in a single removal batcher with **one timer and a 40 ms window**
(`MINI_CUBE_BATCH_WINDOW_MS = 40`). A group is keyed by player, records the server of its
first enqueue, and keeps ids in acceptance order.

At flush time one group becomes exactly one frame per recipient:

- a single pending id uses the legacy shape `miniCubeRemoved { playerId, id }`, byte-identical
  to the pre-batching frame, so a lone click and an older client still see the accepted message;
- two or more pending ids use `miniCubesRemoved { playerId, ids }`, for example
  `{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0","front:0:1"]}`.

Boundary flushes keep each recipient's order deterministic — the removal batch precedes the
message that depends on the removed set:

- the 40 ms window timer;
- a successful cube completion, after validation and before the cube is replaced and before
  `levelAdvanced`, `worldEntered`, `memberLeft (moved)` and `memberJoined`;
- a join before `welcome` and the `memberJoined` broadcast;
- a rejoin before the authoritative `welcome`;
- a final removal after reconnect-grace expiry, before `memberLeft (left)`;
- `hub.close()`, which discards pending ids without sending.

A rotation does not flush: orientation is independent of the removed set. An invalid click
does not flush either; its `stateSync` carries the complete authoritative board, and a later
batch for already-removed ids is an idempotent no-op in the client reducer.

A group never crosses servers: the server is pinned on the first enqueue, and membership
boundaries flush before a move or removal. The accepted rate limit of 30 clicks per member per
trailing second bounds one window to at most 30 ids. A 30-id batch is at most 1024 bytes
(pinned by a protocol test); `MAX_MESSAGE_BYTES` (1024) and every client-frame limit stay
unchanged. No additional batch-size split is applied because the rate limiter already bounds
the window.

## Economy coalescing

Credit-driven economy notifications are coalesced per account to a **250 ms cadence**
(`ECONOMY_BROADCAST_INTERVAL_MS = 250`, at most 4 automatic `economyUpdate` frames per second
per account). The coalescer keeps one absolute `EconomyState` snapshot and one timer per
account; the frame always carries totals, never a delta, and the highest write revision wins.

Every economy write (`creditWithRevision` and `purchaseUpgrade`) atomically increments the
per-account `economy_revision` in the same statement and returns the absolute post-write
totals with that revision. This is still exactly one database write per event — a write-order
stamp on the existing write, not write-behind, batching or deferred persistence. The hub keeps
two independent guards: `lastAppliedRevision` for economy totals and
`lastAppliedUpgradeRevision` for purchase upgrades. A result older than the last applied
revision is dropped before it can touch member state or the wire; the coalescer likewise
ignores a revision at or below the highest revision it has seen, and that highest revision is
never reset on flush. Out-of-order async promise resolution therefore cannot regress published
totals or upgrades.

Explicit actions bypass the cadence: a purchase whose economy revision is newest forces an
immediate flush and cancels that account's pending automatic window, and join-time idle credit
keeps today's immediate pre-`welcome` `economyUpdate`. Purchase upgrades apply and broadcast
immediately only when their purchase revision is newer. `upgradesUpdate` and
`customizationUpdate` remain immediate messages, each encoded once through the account
fan-out. A coalesced flush with no joined connection of the account returns before encoding,
so it performs no `JSON.stringify` call and sends nothing.

Database writes are unchanged in count and timing: one `creditWithRevision` per accepted
click and completion (plus the existing join-time idle credit), one `purchaseUpgrade` per
purchase, and `grantCustomization` once per completion.

## Reconnect and authority

Batches and coalesced frames are presentation deltas, not state; the server's removed set and
economy totals are authoritative at all times. The hub keeps **no per-client outbound queue**.
A member whose socket is closed during a removal window receives no batch; on rejoin its
`welcome` carries the authoritative `self.removedIds`, the roster entry and the latest applied
economy and upgrades, and the client replaces its board from that snapshot. `stateSync` after
an invalid click is likewise a full authoritative board. A missed or dropped batch can
therefore leave a remote cube visually stale only until the next authoritative snapshot or
reconnect; it cannot corrupt state.

Slow-client policy is out of scope: there is no user-space outbound queue, no
`bufferedAmount` drop/close threshold and no replace-on-backpressure policy. The transport
(`ws`/TCP) owns buffering and backpressure. The only error behavior is isolation of a
synchronous `peer.send` throw: that one peer is closed through the normal close path and the
remaining fan-out continues.

`hub.close()` sets a closed guard before clearing state. A late client frame is dropped, a
late peer attach is closed, late async continuations return before touching membership,
updating members, scheduling or sending, and both schedulers are discarded so no further
timer is created. No send or timer callback happens after shutdown.

## Benchmark

The feature's before/after evidence is produced by
`tests/bench/realtime-broadcast.mjs`, a zero-dependency Node 24 script with two modes:

```bash
node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json
node tests/bench/realtime-broadcast.mjs --mode wire --json
```

In-process mode drives the real hub, real registry, real protocol codec and the in-memory
economy repository with fake peers and a manual clock: one account clicker and nine guests,
100 accepted clicks as four bursts of 25 spaced 1.1 s apart. Wire mode opens real WebSocket
clients against a running backend at `ws://localhost:8080/ws` and sends the same load shape
from one client. Both modes reset every counter after the joins and their `welcome`/setup
frames, so only the 100-click burst is measured.

| Metric | Mode | Definition |
| --- | --- | --- |
| `encodeCallsPerBroadcast` | in-process | server-message encode calls in the measured window divided by the removal broadcasts observed on the clicker (ten recipients) |
| `registrySnapshotsPerBroadcast` | in-process | `registry.servers()` calls divided by broadcasts in the measured window |
| `removalFramesPer100Clicks` | both | removal frames received by the clicker per 100 accepted clicks |
| `economyFramesPer100Clicks` | in-process | `economyUpdate` frames received by the account clicker per 100 clicks |
| `dbCreditsPer100Clicks` | in-process | economy write calls (`creditWithRevision`, or `credit`) per 100 clicks |
| `maxRemovalFrameBytes` | both | largest encoded removal frame |
| `p95AckLatencyMs` | wire | 95th percentile of click send to removal-frame receipt on the clicker |

The recorded targets are: `encodeCallsPerBroadcast` 1 (baseline 10 on ten members),
`registrySnapshotsPerBroadcast` 0, `removalFramesPer100Clicks` ≤ 8 (baseline 100),
`economyFramesPer100Clicks` ≤ 16 (baseline 100), `dbCreditsPer100Clicks` 100 (unchanged),
`maxRemovalFrameBytes` ≤ 1024, and `p95AckLatencyMs` ≤ baseline + 60 ms. The benchmark is
**reproducible evidence, not a CI gate**: wall-clock numbers are machine-dependent and the raw
JSON is recorded in the feature build logs. The script itself exits non-zero on malformed
output, an unreachable backend, an incomplete join, fewer than 100 accepted clicks, or a
`--baseline` p95 overrun.
