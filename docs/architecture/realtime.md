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

## Presence and explicit leave

Added by feature `presence-and-activity-liveness` (2026-11-16); the full contract and acceptance
criteria are in the [feature spec](../features/presence-and-activity-liveness/spec.md), and the
player-facing term is in the [glossary](../product/glossary.md#presence). Presence stays
server-authoritative: a member is present iff the hub's registry holds them in one of a server's
occupied slots. There are exactly two present sub-states — **connected** (a joined socket is
attached) and **in grace** (the socket closed abruptly and `now < expiresAt`) — and no presence
field is added to `MemberState`, `welcome.roster`, `LeaderboardEntry` or `memberJoined`, so a
grace member looks identical to a connected one in every derived view.

### Explicit leave vs abrupt close

The only new client frame is the additive, self-only `leave`:

```ts
| { type: 'leave' }
```

`parseClientMessage` accepts exactly `{ "type": "leave" }` and drops extra fields like every
catalog message; a `leave` before a successful `join`/`rejoin` returns the existing
`error not_joined` and removes nothing. The hub finalizes **only that connection's member**
through the existing final-removal path (`removeMember`): the slot is freed, `members` and
`tokens` lose the member, `memberLeft { playerId, reason: 'left' }` is broadcast to the remaining
members (the leaver receives none), the server is destroyed immediately when it was the last
member, and the ring and leaderboard state get the same cleanup as grace expiry. The handler then
sets the connection's close reason to `client` and closes the socket, so the later close event
finds no member and starts no grace. The token is deleted: `rejoin { token }` returns
`error resume_failed` and the next connection uses `join`.

A socket close **without** an accepted `leave` is unchanged: `handleClose` still starts the
reconnect grace (`RECONNECT_GRACE_MS`, 30 000 ms), the member stays in the roster,
`Users on Server`, the leaderboard entries/totals and `cubeclicker_members_active` for the window,
the cube freezes, and `rejoin { token }` inside the window resumes the same member, slot, cube and
session counters with a fresh `welcome`. The heartbeat (30 s, 2 missed pongs) and the grace
duration are unchanged.

- **Immediate vs coalesced.** `memberLeft` is the next frame to every remaining member, so the
  roster and `Users on Server` drop the member at once. The leaderboard is coalesced and drops the
  member at its next `leaderboardUpdate` (at most 1000 ms later); a `welcome` built in that window
  is already correct because the snapshot reads live members.
- **`members_active`.** The gauge is `members.size`: an explicit leave decrements it immediately
  and a last-member leave also drops `cubeclicker_servers_active`; an abrupt close keeps the grace
  member counted until expiry.
- **Multi-tab.** One connection is one member. A `leave` removes only the sending connection's
  member; the account's other tabs keep their sockets, slots and leaderboard rows.
- **Reload.** The client sends `leave` on a non-bfcache `pagehide`, so when the frame reaches the
  server before the reloaded page's `join` the old member is finalized and the reload produces one
  member and reuses the freed slot. The frame is best-effort during unload: if it is lost or late,
  or the socket was already closed, the server sees an abrupt close and the accepted grace path
  applies, so the old member and the new page's member can coexist until expiry (and a full server
  can overflow). That is the accepted residual, not a new state.
- **Never a leave.** A tab switch (`visibilitychange` hidden), a backgrounded tab that keeps the
  socket open, a bfcache `pagehide` (`event.persisted === true`) and `dispose()` (StrictMode or a
  route teardown) send nothing; a remount inside grace reconnects with the token. The `pagehide`
  send is exception-safe: a CLOSING/CLOSED socket can throw from `WebSocket.send`, and the session
  swallows it without sending another frame.
- **Metrics and rollback.** `leave` is the only new value in the closed `type` allow-list of
  `cubeclicker_ws_messages_received_total` (the counter throws on an unlisted value); no server
  message type is added, so this feature adds no encoded/frames catalog value, and the close is
  counted as `cubeclicker_ws_connections_closed_total{reason="client"}`. Rollback removes `leave`
  from both catalogs and decoders, the hub case/handler, the page-lifecycle source/subscription and
  the send, and the received allow-list value; the unconditional grace path returns and nothing is
  stored.

## Activity feed

Added by feature `live-activity-feed` (2026-11-16); the full contract and acceptance criteria are
in the [feature spec](../features/live-activity-feed/spec.md), and the player-facing term is in the
[glossary](../product/glossary.md#activity-feed). The feed is a small, per-server, read-only stream
of notable server transitions on a second additive path: the hub derives each event from a
transition it has already validated, offers it to that server's gate, and only when the gate
accepts it broadcasts one `activityEvent` frame through the same encode-once fan-out described in
§ Fan-out. No client message creates, names or modifies an event, and the protocol version is
unchanged.

### Event catalog

Every event has the same envelope: a positive-integer `id` (per-server sequence, starting at 1,
assigned only on acceptance), a finite non-negative `at` (the hub's injected clock), a
positive-integer `serverId` (the server that owns the event, also the client's cross-server guard),
a closed `type`, the server-issued `playerId` and the server-issued `name` at event time. Six types
exist, with the type-specific fields below. The catalog defines **candidates**; every candidate is
then offered to the cadence gate, so a candidate is not guaranteed to reach the wire.

| `type` | Candidate at | Exact condition | Extra fields |
| --- | --- | --- | --- |
| `levelMilestone` | accepted full-board completion | the completed 1-based cube number is a multiple of `ACTIVITY_MILESTONE_EVERY` (5), starting at cube 5 | `level` |
| `fastClear` | accepted full-board completion | not a milestone, and the completion meets the existing speed-bonus predicate (`elapsedMs <= (thresholdSeconds(previousGridSize) + speedWindowSeconds(upgrades)) * 1000`) | `level`, `elapsedMs` |
| `cubeCleared` | accepted full-board completion | not a milestone and not a fast clear | `level` |
| `epicLoot` | successful account `openLootbox` | the drawn part's rarity is `epic`, new or duplicate; rare draws, failed/in-flight opens and guest local opens never qualify | `partId` |
| `memberJoined` | fresh `join` | recorded after the `welcome`/`memberJoined` transition; a rejoin and a move-in never qualify | — |
| `memberLeft` | final removal (explicit `leave` or grace expiry) or move-out | recorded after the `memberLeft` broadcast; a socket close (grace start) and a server-destroying removal never qualify | — |

One completion produces exactly one candidate, with precedence `levelMilestone` > `fastClear` >
`cubeCleared`. The fast-clear predicate is the same boolean that doubles the completion's coins,
so the feed and the economy can never disagree about what a fast clear is. An invalid completion
and an incomplete board create no candidate.

**Moves.** A cross-server completion is attributed to the target server, where the member is after
the move resolves. After the existing `worldEntered`/`memberLeft (moved)`/`memberJoined` protocol
broadcasts, the completion is the **sole new-server activity candidate** (recorded before a move-in
join would be considered), and the move-in `memberJoined` activity is suppressed for the move
whether the completion is accepted or dropped; the protocol `memberJoined` broadcast is unchanged.
The old server's `memberLeft` is a separate candidate on its own server and does not share the
target server's window.

### Cadence

Each server accepts at most one event in any trailing `ACTIVITY_MIN_INTERVAL_MS` (1000 ms) window,
with an inclusive boundary (`now - lastAcceptedAt >= 1000`). A candidate inside the window is
**dropped, not queued**: it sends no frame, consumes no `id`, does not enter the ring and does not
move the window. A dropped candidate is forgotten — the feed keeps no pending candidate, no
per-client queue and no timer; the gate is a timestamp comparison on the low-frequency candidate
paths. Two servers have independent windows, so each can accept one event in the same second, and
a quiet server's first candidate is always accepted.

### Ring buffer

Each server keeps at most the newest `ACTIVITY_FEED_LIMIT` (20) accepted events, newest first
(`index 0` is the newest). State is created lazily on the first accepted event and holds
`nextId`/`lastAcceptedAt`/`events`; `nextId` starts at 1 for every server, so two servers' first
accepted events both have `id: 1`. Every read returns a fresh array of fresh event objects.
Retention is bounded by construction: the ring drops its oldest entry when a 21st event arrives.
Cleanup deletes a server's ring when that server is destroyed — its last member is removed or
moves away — and `hub.close()` clears every ring and closes the feed: after close `record` returns
nothing, `snapshot` returns `[]`, and `dropServer` and a second `clear()` are no-ops. The number of
rings never exceeds the number of live servers.

### Lifetime

Added by feature `presence-and-activity-liveness` (2026-11-16). An event is **fresh** iff
`serverNow - event.at < ACTIVITY_EVENT_TTL_MS`, with `ACTIVITY_EVENT_TTL_MS = 5000` in the backend
catalog (`src/backend/src/game/protocol.ts`) and its frontend mirror; at exactly 5000 ms an event
is expired. The 20-event ring, the 1 s cadence and the per-server ids are unchanged: the TTL is an
eligibility filter over the ring, not a new store.

- **Snapshot filter (server eligibility).** `activity.snapshot(serverId)` prunes the expired tail
  of the ring and returns only fresh events, newest first, as fresh copies; `welcome` (fresh join
  and rejoin) and `worldEntered` (cross-server move) use it, so an event that is 5000 ms or older
  at snapshot time can never travel and an expired event cannot reappear on reconnect. `record`
  also prunes the expired tail before accepting. Pruning changes neither `nextId` nor
  `lastAcceptedAt`, so ids keep advancing and the 1 s gate is unaffected.
- **Snapshot size.** Because the cadence is 1/s and the TTL is 5 s, at most five accepted events
  are fresh at any instant, so a snapshot carries 0–5 events. `ACTIVITY_FEED_LIMIT` (20) remains
  the ring bound; the `ttlMs` option is a test seam, not a wire contract.
- **Live frames.** The live `activityEvent` frame is unchanged: it is immediate, encode-once and
  carries the accepted shape. The hub does not re-send or expire live frames.
- **Client display expiry (display guarantee).** The frontend shows each event for 5000 ms from
  its **local receipt** and never uses `event.at` for display (the event clock is the server
  clock). After every world reduction (`welcome`, `worldEntered`, `activityEvent`,
  `leaderboardUpdate`, any frame) and after the travel-midpoint `applyWorldSwap`, the session
  observes the current and pending feeds, records a receipt-anchored deadline for each
  `serverId:id` key on first sight only, and runs the pure `pruneActivity` **synchronously before
  any publish** — including the handler-specific `welcome`/`worldEntered` publish — so a seeded or
  newly expired event never enters the published feed, not even for one tick. A same-server rejoin
  that re-seeds the same event preserves the remaining lifetime instead of restarting it; server
  ids are never reused and per-server ids are monotonic, so the key is unique for the process.
- **Tombstones and the fallback tick.** A key that expired locally is tombstoned for
  `ACTIVITY_EVENT_TTL_MS`, so a boundary re-seed cannot re-display it. Deadlines and tombstones for
  servers that are neither current nor pending are dropped, so the state stays bounded by the
  feeds. One session-owned interval at `ACTIVITY_EXPIRY_TICK_MS = 250` is the fallback for time
  passing without a reduction: when nothing else happens, a line is removed at the first tick at or
  after its deadline (at most 250 ms late). Becoming visible prunes immediately before the next
  frame, and `dispose()` clears the interval so no callback, publish or state change follows.
- **Mixed versions, accessibility and rollback.** No wire field changed. An old client never
  expires lines locally (it keeps up to the 20-event reducer cap) and receives the smaller
  ≤5-event snapshot; a new client against an old backend expires live lines locally and may
  display older snapshot lines once. Expiry is a state removal with no exit animation, no new
  motion token and no second live region, so the feed stays a non-live landmark. Rollback removes
  the constant, the snapshot filter/prune and the whole frontend lifetime module; there is nothing
  to roll back operationally.

### Welcome, reconnect and `worldEntered`

`welcome` (fresh join and rejoin) and `worldEntered` (cross-server move) carry the target server's
fresh events as `activity` (newest first, 0–5 by the 1 s cadence and the 5000 ms TTL; § Lifetime)
as a defensive copy; a server with no fresh events sends `[]`. A member that was disconnected while
events occurred receives the unexpired events in the rejoin `welcome`: an event that is 5000 ms or
older at snapshot time never travels, so a long disconnect cannot replay expired lines. This is the
same "presentation delta, not state" contract as § Removal batching and § Economy coalescing: the
hub keeps no per-client outbound queue and never replays one missed frame.

**Travel window.** `worldEntered` supplies the target ring without changing the mover's current
feed. Target-server `activityEvent` frames received between `worldEntered` and the travel midpoint
are folded into the pending swap feed (newest first, capped at 20); the midpoint `applyWorldSwap`
replaces the feed with that updated target ring. No old-server event is applied to the new feed
once a swap is pending.

### Isolation and authority

Buffers and events are keyed by `serverId`, and an event is delivered only to that server's members
through the server's existing slot visitor; no client ever receives another server's event. The
event carries its `serverId`, and the client reducer ignores an event matching neither the current
server nor a pending target server. Every event originates from an already validated server
transition — a full-board completion, a successful loot draw or an accepted membership transition
— and its time is the hub's injected clock, never a client value.

### Metrics

The encode-once path already counts every broadcast. `activityEvent` is added to the closed `type`
allow-lists of `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total` —
two catalog values, no new metric. The allow-list entry is required, not optional instrumentation:
the counter throws on an unlisted `type` value.

### Client presentation and accessibility

The frontend stores the feed in `WorldState.activity` (and `pendingWorldSwap.activity` during a
travel) and renders a non-interactive `<aside class="activity-feed" aria-label="Server activity"
aria-live="off">` with an `<h2>` heading and an `<ol>` of the five newest events, each with a full
text sentence. The feed contributes no live-region semantics — no `role="status"`, `role="alert"`
or `role="log"` and no live `aria-live` — so `.phase-announcement` stays the shell's only
polite/assertive live region; the feed is readable on demand via its landmark. It has no focusable
control and no timestamp (the server clock is not the client clock). The ticker is placed
top-center below the connection banner with a mobile offset, capped at five visible items, and is
`pointer-events: none`. New entries use a 160 ms entry animation that is disabled both by the
session's reduced-motion preference (`data-reduced-motion="true"`) and independently by
`@media (prefers-reduced-motion: reduce)`; reduced motion changes animation only, and the content
stays fully readable.

### Privacy

Every field is server-issued: ids, the injected-clock timestamp, the catalog `level`/`elapsedMs`
numbers, the catalog `partId`, and the member's `name` as already published in the roster (guest
`Player N` or the account username). No event carries `accountId`, token, email, IP, free text or
any client-supplied string, and the client catalog still has no activity message, so no client
frame can create, name or modify an event.

### Additivity and rollback

The frame is a new `ServerMessage` variant, `activity` is optional in the wire type (absent decodes
to `[]`), and no protocol version bump is made, so both deploy orders are safe: an old client drops
an unknown `activityEvent` frame at its decoder and ignores the extra `activity` field, and a new
client against an old backend renders an empty feed. Backend rollback removes the union/builder,
the `activity` field, the feed module, the hub derivation hooks and the two metrics allow-list
values; frontend rollback removes the component, its render and the reducer case. There is nothing
to roll back operationally: the feed is process memory only, has no feature flag and no stored
data, and a restart clears it.

## Live leaderboard

Added by feature `server-live-leaderboard` (2026-11-16); the full contract and acceptance criteria
are in the [feature spec](../features/server-live-leaderboard/spec.md), and the player-facing term
is in the [glossary](../product/glossary.md#live-leaderboard). The leaderboard is a per-server,
session-scoped ranking on a third additive snapshot path: the hub derives three counters from
transitions it has already validated, ranks that server's current members, and publishes one
`leaderboardUpdate` at most once per second per server through the same encode-once fan-out
described in § Fan-out. No client message creates, names or modifies a counter, no protocol
version bump is made, and nothing is persisted.

### Session counters

Every member carries three session counters that start at zero when the member is created on
`join`: they survive a socket close and a rejoin inside the reconnect grace window, travel with
the member through a cross-server move, and are removed with the member on final removal (a
process restart clears every counter). The hub increments them only after the transition it has
already validated:

| Counter | Increment point | Exact rule |
| --- | --- | --- |
| `clicks` | `handleExplode`, after the trailing-second rate limit admits the attempt and `validateExplode` succeeds | +1 per accepted `explode`. An `invalid_click`, a rate-limited attempt, an oversized/malformed frame and a pre-join message never increment. |
| `facesDestroyed` | `handleExplode`, after the accepted id is added to the member's `removedIds` | +1 iff the existing face-clear predicate is true (all N² ids of the clicked face are removed). At most 6 per cube. |
| `cubesCompleted` | `handleCompletion`, after `isComplete` succeeds and the completed 1-based cube number is captured | +1 per accepted `cubeCompleted`, including a completion that executes a cross-server move. An `invalid_completion` and an incomplete board never increment. |

A click that clears a face increments both `clicks` and `facesDestroyed`; the following completion
increments `cubesCompleted`. Coins are deliberately excluded and no account total is read: coin
income is upgrade-scaled and only server-authoritative for accounts, while a guest's coins and
upgrades are local and unknown to the hub, so a coin column would compare unlike values, leak a
value that is private to each account and rank upgrades rather than play. The snapshot never reads
`member.economy`, `member.appearance`, `user_economy`, coins, upgrades, customization or
`accountId`; guests and accounts compete on exactly the same counters and shape.

### Ranking and totals

The server ranks its **current members** (every occupied slot, including members inside reconnect
grace) with a total order: `cubesCompleted` descending, then `clicks` descending, then ascending
server slot order (the order in which `registry.forEachMember` visits occupied slots). The first
`LEADERBOARD_TOP_LIMIT = 5` members become the `entries` array in rank order; a server with fewer
current members returns all of them, and an empty server returns `entries: []`. Ties at the
top-five cutoff are resolved by the same order — never by arrival of a frame or name collation.

`totals` are the sums of `cubesCompleted`, `clicks` and `facesDestroyed` over **all current
members**, including every member outside the top five and every member in reconnect grace. A
member outside the top five still contributes to the totals. Each flush and every `welcome` /
`worldEntered` builds the snapshot at that moment from the live roster — no snapshot is cached —
so a rank or total can never drift from the counters or membership. The wire shape is
`{ serverId, at, entries, totals }`: `serverId` is the owning server (also the client's
cross-server guard), `at` is the hub's injected clock at build time, each entry carries only the
server-issued `playerId` and `name` plus integer `cubesCompleted`/`clicks`, and per-member
`facesDestroyed` is aggregated into `totals` only.

### Coalescing cadence

A counter or membership change marks that server dirty and schedules exactly one flush at
`LEADERBOARD_INTERVAL_MS = 1000` if no flush is already pending for that server; changes inside
the window are included in the pending flush and do not schedule another. At the flush the hub
builds the snapshot from the server's live members and broadcasts one `leaderboardUpdate` through
the existing encode-once path (no `except`: the ranking is a server-wide view, so the origin is
included). A quiet server emits no frame; a rejoin, rotate, purchase, loot open, equip or unequip
is not a counter change and emits nothing; a socket close (grace start) emits nothing and the
member stays ranked. A change after a flush starts a new window. The existing 40 ms removal
batching and 250 ms economy coalescing are independent and unchanged: no per-click leaderboard
frame, no per-client queue and no global tick is introduced.

### Welcome, reconnect and `worldEntered`

`welcome` (fresh join and rejoin) and `worldEntered` (cross-server move) carry the current snapshot
as `leaderboard`, so the panel is never empty at join, reconnect or entry and no member waits for
the next tick. A fresh join sees themselves with zero counters plus every existing member's
current counters; a rejoin sees every counter accumulated while the socket was closed, and the
rejoiner's own counters are unchanged. `worldEntered` carries the target server's snapshot
including the completion that caused the move. `leaderboard` is optional in the wire type: a
legacy placement without it decodes to `null` and renders no panel.

### Grace, moves and cleanup

A member in reconnect grace keeps their rank and counters (the roster already keeps them); the
final grace-expiry removal marks the server dirty and the next flush drops the member and
recomputes the totals. A member who moves takes their own session counters to the target server;
the target snapshot includes them, and the old server's totals are recomputed without them. When
a move or removal destroys the old server, its pending flush timer is dropped. `hub.close()`
discards every pending leaderboard timer and state, so no callback or frame occurs after close.
The number of pending flush timers never exceeds the number of live servers with a pending flush.

### Isolation and client guard

Snapshots and flush timers are keyed by `serverId`, and a frame is delivered only to that server's
members through the server's existing slot visitor; no client ever receives another server's
snapshot. The snapshot carries its `serverId`, and the frontend reducer ignores an update matching
neither the current server nor a pending swap's target server with the same state reference.
During travel, a target-server frame replaces the pending snapshot and an old-server frame applies
to the current snapshot only; the travel-midpoint `applyWorldSwap` applies the pending snapshot and
no old-server snapshot is applied after the move.

### Metrics

`leaderboardUpdate` is added to the closed `type` allow-lists of
`cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total` — two catalog
values, no new metric. The allow-list entries are required, not optional instrumentation: the
counter throws on an unlisted `type` value. One broadcast increments the encoded counter once and
the frames-sent counter per recipient.

### Client presentation and accessibility

The frontend stores the snapshot in `WorldState.leaderboard` (and `pendingWorldSwap.leaderboard`
during a travel) and renders a non-interactive `<aside class="leaderboard" aria-label="Server
leaderboard" aria-live="off">` with an `<h2>` heading, an `<ol>` of at most the five server-ranked
rows (rank, name, exact `2 cubes · 40 clicks` score text) and a `<p>` with the server totals. The
component does not re-sort or recompute anything and displays no timestamp. It contributes no
live-region semantics — no `role="status"`, `role="alert"` or `role="log"` and no live
`aria-live` — so `.phase-announcement` stays the shell's only polite/assertive live region; the
ranking is readable on demand as a landmark and an ordered list, and there is no focusable
control. The panel is a `pointer-events: none` left rail below the HUD on desktop and below the
activity feed under `max-width: 720px`, with `max-height: 40vh` (18vh on mobile, 12vh under
`max-width: 720px` and `max-height: 600px`). New rows use a 160 ms entry animation that is
disabled both by the session's reduced-motion preference (`data-reduced-motion="true"`) and
independently by `@media (prefers-reduced-motion: reduce)`; reduced motion changes animation only
and the content stays fully readable. On very short mobile viewports the lower rows may be
visually clipped behind the upgrades panel (which paints above), while all five rows and the
totals remain in the DOM and the accessibility tree; the existing panels' placements are
unchanged.

### Privacy and rollback

Every field is server-issued or hub-derived: `serverId`, the injected-clock `at`, the
server-issued `playerId`/`name` already published in the roster (guest `Player N` or the account
username) and integer session counters. No **leaderboard or activity** frame — and no leaderboard
placement field — carries `accountId`, token, email, IP, coins, upgrade levels, appearance, free
text or any client-supplied string. Appearance is carried only by the public appearance projection
(§ Public appearance projection): the `MemberState.appearance` field on server-originated rosters,
the `memberAppearance` server frame and the guest `setAppearance` report; the leaderboard snapshot
never reads or carries it. The client catalog still has no leaderboard message, so no client frame
can create, set, add or name a counter.

The frame is a new `ServerMessage` variant and `leaderboard` is optional in the wire type, with no
protocol version bump, so both deploy orders are safe: an old client drops an unknown
`leaderboardUpdate` frame and ignores the extra `leaderboard` field, and a new client against an
old backend renders no panel. Backend rollback removes the union/parser/copier/builder, the
`leaderboard` field from `Placement`/`placementPayload`, the leaderboard core and hub counters,
marks and coalescer, and the two metrics allow-list values; frontend rollback removes the panel
and its render, `WorldState.leaderboard`/`pendingWorldSwap.leaderboard` and the reducer case.
There is nothing to roll back operationally: the leaderboard is process memory only, has no
feature flag and no stored data, and a restart clears it.

## Public appearance projection

Added by feature `remote-spaceship-customization` (2026-11-19); the full contract and acceptance
criteria are in the [feature spec](../features/remote-spaceship-customization/spec.md), and the
player-facing terms are in the [glossary](../product/glossary.md#appearance).

Every **server member**'s equipped **appearance** is a public presentation value within that
member's server. It travels as an optional `MemberState.appearance` field — a map from the eleven v3
**part slot** ids to part ids — and as one additive update frame, on the existing encode-once path
(§ Fan-out). The projection carries no catalog, inventory count, coin, upgrade, `accountId`, token,
email, IP or free text.

### Field, frames and normalization

`MemberState.appearance?: Record<string, string>` is **optional in the wire type**, so every existing
full-literal fixture and an older client keep working. The backend's `memberState()`/`rosterFor()`
**always** populate it, so every server-originated `welcome.roster[i]`, `worldEntered.roster[i]` and
`memberJoined.member` carries the field (an account's seeded record, a guest's `{}` until it reports).
`stateSync` and `levelAdvanced` gain no field, and their encoded bytes are unchanged.

Every frontend storage/copy path (`copyMember`, `reduceWorldState`, the scene's roster copy) passes
the member through `memberAppearanceOf(member)`, which returns the field when it is a valid record
and `{}` when it is absent, not a plain object, has more than 11 entries, an unknown slot key, or a
non-string/empty/over-40-character value. A renderer therefore never sees an absent or malformed
record.

Wire fidelity is separate from that read gate: the member wire paths — `parseMemberState` in
`multiplayer/protocol.ts` and the backend's `copyMemberState` — preserve an **absent** `appearance`
instead of injecting `{}`, which keeps legacy payloads and the accepted full-literal fixtures
byte-faithful. Absence is resolved at the storage/render boundary: `memberAppearanceOf` reads an
absent or malformed field as `{}`, and the reducer's `copyMember` (used by `welcome`,
`worldEntered` and `memberJoined`) and the scene's roster copy always store
`appearance: memberAppearanceOf(member)`, so every member stored in `WorldState` and every copy the
scene reads carries `{}` or a valid record.

The two frames are additive members of the existing unions:

```ts
// server → client, one per affected member
| { type: 'memberAppearance'; playerId: string; appearance: Record<string, string> }
// client → server, guest loadout report
| { type: 'setAppearance'; appearance: Record<string, string> }
```

`memberAppearanceMessage(playerId, appearance)` copies the record defensively. The backend's
`parseClientMessage` decodes `setAppearance`; the frontend's `multiplayer/protocol.ts` mirrors both
frame types.

### Authority matrix

| Member | Appearance source | Client `setAppearance` |
| --- | --- | --- |
| **Account** | Persisted `user_economy.appearance`, seeded at join and rejoin; `equipPart`/`unequipPart` validate the v3 catalog and ownership, persist, update every member of the account, and keep the account-scoped `customizationUpdate` unchanged | **Silent no-op** — no state change, no frame, no error; a forged loadout is impossible |
| **Guest** | The guest's own report, structurally validated by the codec and normalized against the v3 catalog (unknown and wrong-slot ids are dropped; legacy aliases follow the accepted v1/v2 normalization rules); pinned on the member, never persisted | Accepted within the rate limit; one broadcast only on a real normalized change |

The projection is **equipped appearance only**. Account inventory counts, coins, upgrade levels and
identity stay private; the public record is the same slot→part-id map that is rendered on screen by
definition. Guests have no persisted inventory by accepted design (Q-4), so their report is
cosmetic-only, carries no gameplay advantage and is bounded by the catalog, the entry/size bounds and
the rate limit.

### Bounds and cadence

The appearance codec accepts a plain object (never `null` or an array) with at most
`APPEARANCE_MAX_ENTRIES = 11` entries; keys must be v3 slot ids and values non-empty strings of at
most `APPEARANCE_VALUE_MAX_LENGTH = 40` characters; the encoded object must be at most
`APPEARANCE_JSON_MAX_BYTES = 700` UTF-8 bytes. The pinned worst-case appearance frame measures
492 B for `playerId: 'p1'` (493 B for the longer `p24`) and the pinned 24-guest full-appearance
`welcome` is 16,362 B, both inside this feature's outbound test budgets. `MAX_MESSAGE_BYTES` (1024)
stays an **incoming client-frame** cap; the 700 B bound is this projection's outbound budget, not a
new wire cap.

Guest reports are limited to **10 admitted `setAppearance` frames per member in any true 1000 ms
trailing interval** (`RATE_WINDOW_MS = 1000`). A timestamp is forgotten when
`now − admittedAt <= 1000`; the boundary is pinned: ten frames admitted at `t = 0, 100, …, 900` admit
nothing at `t = 950`, and `t = 0` expires at `t = 1000`, so an attempt at `t = 1000` is accepted.
Dropped attempts are silent: no state change, no broadcast, no error.

### Fan-out, reconnect and loss tolerance

`equipPart`/`unequipPart` first update every member of the account, then emit **one
`memberAppearance` frame per changed member (`playerId`) on that member's server** — two tabs of one
account on the same server are two members and receive two frames; two tabs on two servers receive
one frame each; an unchanged record emits none. Each frame is encoded once per server through
§ Fan-out. A guest change is broadcast to the server's other members only (origin excluded) and only
when the normalized record differs from the stored one. A live `memberAppearance` for the currently
spectated member reaches the mounted ship through `SceneView.setSpectatedAppearance` in the same
message turn, so the spectator's view never waits for a remount.

Appearance is a presentation delta, not game state. A resume inside the reconnect grace restores the
stored record in the new `welcome`; a cross-server move carries it in the target roster; a final
removal discards it and a fresh guest identity starts at `{}`. A missed `memberAppearance` leaves the
last known outfit on screen until the next `welcome`, `memberJoined` or `memberAppearance`; it cannot
corrupt boards, positions, membership, economy or the leaderboard, and the ship never blocks or
throws. A guest adopts `welcome.roster[self].appearance` into its engine when its local record is
empty, then sends exactly one `setAppearance` iff the resulting non-empty record differs, so its own
ship, preview and hangar are never stale.

### Metrics

`memberAppearance` is added to the closed `type` allow-lists of
`cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total`, and `setAppearance`
to `cubeclicker_ws_messages_received_total` — three catalog values, no new metric. The allow-list
entries are required, not optional: the counters throw on an unlisted `type`. One broadcast
increments the encoded counter once and the frames-sent counter per recipient; a decoded
`setAppearance` increments the received counter once, including a report that is later dropped as
rate-limited or unchanged.

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
