---
feature: live-activity-feed
revision: 2
status: draft
created: 2026-11-15
updated: 2026-11-15
---
# Spec — Live Activity Feed

## Summary

CubeClicker is online, real-time and server-authoritative, but a client currently learns about other players only through raw board deltas (`miniCubeRemoved`/`miniCubesRemoved`, `cubeRotated`, `levelAdvanced`) and membership frames (`memberJoined`/`memberLeft`). There is no readable, low-rate stream of notable server events. This feature adds a small, shippable **per-server activity feed**: the hub derives a closed set of structured events from transitions it has already validated (cube completion, fast clear, level milestone, epic loot, join, leave), rate-limits them to at most one event per second per server, keeps the latest 20 in a bounded in-memory ring per server, broadcasts an additive `activityEvent` frame through the existing encode-once fan-out, and includes the ring in `welcome` (join and reconnect) and `worldEntered` (cross-server move). The frontend decodes the frame, keeps the feed in the world reducer (`WorldState.activity`), and renders a non-interactive `ActivityFeed` ticker with accessible, non-live markup and a reduced-motion variant. No persistence, new service, dependency, identity change or protocol version bump is added. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one" and "continue"; this is the next approved feature in the audit queue.

## Context and audit evidence

Verified against the current tree at planning time:

- `src/backend/src/game/hub.ts` `handleCompletion` — an accepted completion already computes `elapsedMs` and the speed-bonus boolean (`elapsedMs <= (thresholdSeconds(previousGridSize) + speedWindowSeconds(member.upgrades)) * 1000`), replaces the cube, executes the planned move and broadcasts `levelAdvanced` or `worldEntered`/`memberLeft (moved)`/`memberJoined`. Those are the exact validated transitions a completion event can be derived from; no new validation is needed.
- `src/backend/src/game/hub.ts` `handleJoin` / `handleRejoin` — both build the shared `placementFor(member)` payload; `welcomeMessage`/`worldEnteredMessage` share `placementPayload` in `src/backend/src/game/protocol.ts`, so one additive `activity` field on that payload covers join, reconnect and cross-server entry.
- `src/backend/src/game/hub.ts` `removeMember` — a final grace-expiry removal broadcasts `memberLeft (left)`; `registry.removeMember` reports `serverDestroyed`. A socket close (grace start) is not a leave.
- `src/backend/src/game/servers.ts` `moveMember` — the old server is destroyed when its last member moves away; the hub currently does not observe that destruction, so the feed must prune the old buffer explicitly.
- `src/backend/src/game/hub.ts` `handleOpenLootbox` — a successful account open has a drawn `partId` and its catalog rarity (`partDefinition(partId).rarity`); only accounts can produce this server event (guest opens are client-local).
- `src/backend/src/game/protocol.ts` — one `ServerMessage` catalog, one `encodeServerMessage`, and the server-to-client direction only; the client catalog has no event-submission message.
- `src/backend/src/game/hub.ts` `broadcast` — the existing encode-once fan-out (`realtime-broadcast-batching`) is the correct delivery path; a new `activityEvent` must not reintroduce per-recipient encoding or add a timer.
- `src/backend/src/observability/metrics.ts` — `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total` have a closed `type` allow-list; an unlisted `activityEvent` label value would throw at runtime, so the catalog must be extended by exactly two allow-list entries (no new metric).
- `src/frontend/src/multiplayer/server-state.ts` — `WorldState` is the single store for everything the server broadcasts about a client's server; `welcome` replaces it, `worldEntered` records a pending swap, and `applyWorldSwap` applies the target world at the travel midpoint. A per-server feed belongs in the same store and follows the same server-switch semantics.
- `src/frontend/src/App.tsx` — the shell has exactly one live region, `.phase-announcement` (`role="status"`, `aria-live="polite"`); the feed must not add a second one. Existing panels are `main > section` (HUD), `.user-panel`, `.upgrades-panel` (bottom-right) and `.customization-toggle` (bottom-left).
- `src/frontend/src/ui/game-view.css` — the rounded gameplay chrome and the existing `@media (prefers-reduced-motion: reduce)` block; the feed follows those conventions rather than adopting a new styling system.
- `tests/e2e/smoke.mjs` `checkMultiplayerFlow` — already runs A/B/C clients with `maxUsers 2` and a 1 s grace: A joins, B joins (A receives `memberJoined`), C overflows to the next server, A explodes/bursts, then B closes and A receives `memberLeft (left)` after the grace window. This is the natural containerized proof for join and leave events with no new wait.
- The stack is one backend process, in-memory rooms, Postgres only for accounts/economy; no Redis, queue or microservice exists, and none is added.

## User stories

- As a player, I want a compact ticker of notable things happening on my server, so the world feels alive without reading raw cube deltas.
- As a returning player, I want the recent activity of my server after a reconnect, so I do not rejoin into a silent world.
- As a player on a crowded server, I want the feed to stay calm and bounded, so it never floods my screen or the socket.
- As a screen-reader user, I want the feed to be readable on demand without interrupting the game's single live announcement region.
- As a player who prefers reduced motion, I want new feed entries to appear without animation.
- As a maintainer, I want the feed to be derived only from validated server transitions, per server, bounded in memory and rate, and provable by unit, integration and containerized tests.

## Event catalog and thresholds

Every event has the same envelope:

| Field | Type | Rule |
| --- | --- | --- |
| `id` | positive integer | Per-server sequence stored in that server's own state; each server starts at 1; assigned only on acceptance; dropped candidates consume no id. |
| `at` | finite number ≥ 0 | The hub's injected clock (`HubDeps.now`) at acceptance; never a client value. |
| `serverId` | positive integer | The server that owns the event; also the reducer's cross-server guard. |
| `type` | closed union | One of the six types below. |
| `playerId` | non-empty string | The server-issued member id (already public in the roster). |
| `name` | non-empty string | The server-issued display name at event time (`Player N` for guests, the username for accounts). |

The derivation conditions below define **candidates**. Every candidate is then offered to the per-server gate (§ Cadence); an accepted candidate becomes exactly one event, and a dropped candidate emits no frame, consumes no id and never enters the ring. The derivation ACs therefore say "when the per-server gate accepts it".

| Event type | Candidate at | Exact condition | Type-specific fields |
| --- | --- | --- | --- |
| `levelMilestone` | accepted `cubeCompleted` | Completed 1-based cube number is a multiple of 5 (`ACTIVITY_MILESTONE_EVERY = 5`) | `level` (the completed cube number) |
| `fastClear` | accepted `cubeCompleted` | Not a milestone, and the completion meets the existing speed-bonus predicate: `elapsedMs <= (thresholdSeconds(previousGridSize) + speedWindowSeconds(member.upgrades)) * 1000` | `level`, `elapsedMs` (server-measured) |
| `cubeCleared` | accepted `cubeCompleted` | Not a milestone and not a fast clear | `level` |
| `epicLoot` | successful account `openLootbox` | Drawn part rarity is exactly `epic` (duplicate or new; `rare` never qualifies; failed/in-flight opens never qualify; guest local opens are not server events) | `partId` (catalog part id) |
| `memberJoined` | fresh `join` (move-in suppressed) | Recorded after the `welcome`/`memberJoined` transition and subject to the gate; a move-in join is suppressed for any move that carries a completion (a move only occurs on completion — see § Attribution on a move); a `rejoin` (resume) never qualifies | none |
| `memberLeft` | final grace-expiry removal or move-out | Recorded after the `memberLeft` broadcast and subject to the gate. For a grace-expiry removal: `registry.removeMember` reports `left: true` and the server still has at least one member. For a move-out: `registry.moveMember` succeeds and the old server's `serverHasMembers` probe returns true after the move (otherwise the old buffer is dropped). | none |

**One event per completion.** A completion produces exactly one **candidate** event; precedence is `levelMilestone` > `fastClear` > `cubeCleared`. The per-server gate then accepts or drops that candidate (§ Cadence); when accepted it is exactly one event, when dropped none is emitted. The fast-clear predicate is the same boolean that doubles the completion's coins, so the feed and the economy can never disagree about what a "fast" clear is.

**Attribution on a move.** A cross-server completion is attributed to the server the member occupies after the completion resolves (the target server), because the member has already left the old server. The completion is the **sole new-server activity candidate** (recorded before the move-in join would be considered). The move-in `memberJoined` activity is **suppressed for the move**, whether the completion is accepted or dropped: a move only exists because of a completion, and the completion is the meaningful new-server event. When the gate accepts the completion, the new server gets exactly one completion event; when the gate drops it (window closed), the move adds no new-server event. The existing protocol `memberJoined` broadcast is unchanged — only the activity join is suppressed. The old server's `memberLeft` is a separate candidate on its own server and does not share the new server's window. Target-server `activityEvent` frames received while the swap is pending update `pendingWorldSwap.activity` and are present after the swap (see AC-17).

**Cadence.** Each server accepts at most one event in any trailing 1000 ms window (`ACTIVITY_MIN_INTERVAL_MS = 1000`); the boundary is inclusive (`now - lastAcceptedAt >= 1000`). A candidate inside the window is dropped, not queued: it sends no frame, consumes no id, does not enter the ring and does not move the window. A continuous stream therefore yields one event per second, and a quiet server's first event is always accepted. Two servers have independent windows.

**Buffer.** Each server keeps at most 20 accepted events (`ACTIVITY_FEED_LIMIT = 20`), newest first (`index 0` is the newest). The buffer is created lazily on the first accepted event, is defensively copied on every read, and is deleted when the server is destroyed (last member removed or moved away) and by `hub.close()`. No timer is created by the feed.

**Reconnect.** `welcome` (fresh join and rejoin) and `worldEntered` carry the target server's current ring as `activity` (newest first, ≤ 20). A member that was disconnected during events receives the current ring in the rejoin `welcome`, which includes the missed events when they fit; if more than 20 events occurred while away, the oldest missed events are evicted by the ring by design. The hub keeps no per-client outbound queue and never replays individual missed frames.

### Protocol validation matrix

Both mirrors enforce the same rules. The backend builder throws `TypeError` on any invalid payload; the frontend decoder returns `bad_message` and drops the frame. Unknown extra fields are dropped, and the parsed object is always a fresh copy of the pinned shape.

| Field | Valid rule | Invalid examples |
| --- | --- | --- |
| `id` | positive integer | missing, `0`, `-1`, `1.5`, `"1"`, `null` |
| `at` | finite number ≥ 0 | missing, `-1`, `NaN`, `Infinity`, `"0"`, `null` |
| `serverId` | positive integer | missing, `0`, `-1`, `1.5`, `"1"`, `null` |
| `type` | exactly one of the six event types | missing, `"cubeCleared "`, `"unknown"`, `null` |
| `playerId`, `name` | non-empty string | missing, `""`, `null`, a number |
| `level` (cube types) | positive integer; required for `cubeCleared`, `fastClear`, `levelMilestone` | missing, `0`, `-1`, `1.5`, `null` |
| `elapsedMs` (`fastClear` only) | finite number ≥ 0; required for `fastClear` | missing, `-1`, `NaN`, `Infinity`, `null` |
| `partId` (`epicLoot` only) | non-empty string; required for `epicLoot` | missing, `""`, `null` |
| `activity` snapshot | array of 0…20 valid events | non-array, 21 entries, an invalid entry |

## Acceptance criteria

### Event derivation

- **AC-1 — Cube completion.** When the per-server gate accepts the candidate, a validated full-board completion whose completed 1-based cube number is not a multiple of 5 and which does not meet the fast-clear predicate emits exactly one `cubeCleared` event with the envelope fields plus `level` = the completed cube number; the event's `serverId` is the server the member occupies after the completion resolves. When the gate drops the candidate, no `cubeCleared` event, frame or id is produced. An `invalid_completion` and an incomplete board create no candidate.
- **AC-2 — Fast clear.** A completion that meets the existing speed-bonus predicate is a `fastClear` candidate; when the gate accepts it, it emits exactly one `fastClear` instead of `cubeCleared`, with the same `level`/`playerId`/`name`/`serverId` and `elapsedMs` equal to the hub-measured completion time. When the gate drops it, no event, frame or id is produced. A completion at exactly the threshold is a `fastClear` candidate and receives the coin bonus; one 1 ms above is a `cubeCleared` candidate and receives no bonus.
- **AC-3 — Level milestone.** A completion whose completed cube number is a multiple of 5 is a `levelMilestone` candidate and is not a `cubeCleared`/`fastClear` candidate. When the gate accepts it, it emits exactly one `levelMilestone` with `level` = that number and no `cubeCleared`/`fastClear` for that completion, even when the clear is fast. When the gate drops it, none is emitted. The first milestone is the 5th completed cube; a fast 10th completion is a milestone candidate.
- **AC-4 — Epic loot.** A successful account `openLootbox` whose drawn part has rarity `epic` is an `epicLoot` candidate; when the gate accepts it, it emits exactly one `epicLoot` with `partId` = the drawn part id, on the member's current server, for both a new and a duplicate epic. When the gate drops it, no event, frame or id is produced. A `rare` draw, a failed open (`no_lootbox`/`no_key`), an in-flight duplicate open and a guest local open create no candidate.
- **AC-5 — Join.** A fresh `join` is a `memberJoined` candidate. When the gate accepts it, it emits exactly one `memberJoined` on the assigned server, recorded after the `welcome` and `memberJoined` broadcast, with the server-issued `playerId` and `name`. The live frame excludes the joining member, but the event is in the ring for later joiners. When the gate drops it, no event, frame or id is produced. A `rejoin` (resume) creates no candidate.
- **AC-6 — Leave.** A final grace-expiry removal for which `registry.removeMember` reports `left: true` and whose server still has at least one member is a `memberLeft` candidate. When the gate accepts it, it emits exactly one `memberLeft` on the server, recorded after the `memberLeft (left)` broadcast. When the gate drops it, no event, frame or id is produced. A no-op removal (`left: false`) creates no candidate, a socket close (grace start) creates none, and a removal that destroys the server creates none and deletes that server's buffer.
- **AC-7 — Move.** A cross-server move makes the old server's `memberLeft` a candidate on the old server (accepted → event; dropped → none; the old buffer is deleted when the move destroys the old server) and attributes the completion to the new server. On the new server the completion is the sole new-server activity candidate (recorded before the move-in join would be considered) and the move-in `memberJoined` activity is suppressed for that move (no event, id or frame), whether the completion is accepted or dropped. When the gate accepts the completion, it emits the milestone/fast/cleared event; when the gate drops it, the move adds no new-server event. The mover receives the target `worldEntered` snapshot; target-server `activityEvent` frames received between `worldEntered` and `applyWorldSwap` update `pendingWorldSwap.activity` and are present after the swap; no old-server event is applied to the new feed.
- **AC-8 — No client-supplied events.** The client catalog contains no message that creates, names or modifies an activity event. A client frame with `type: 'activityEvent'` (or any unknown type) decodes to `bad_message` and changes no feed state.

### Cadence and buffer

- **AC-9 — Per-server cadence.** A server accepts the first candidate, drops a candidate 999 ms later, accepts one at exactly 1000 ms after the last acceptance, and continues at one accepted event per trailing second. A dropped candidate consumes no `id`, sends no frame, does not enter the ring and does not move the acceptance window. Two different servers each accept one event in the same second.
- **AC-10 — Ring buffer.** Each server keeps at most 20 accepted events newest first (`index 0` is the newest); `nextId` lives in that server's own state and starts at 1, so two different servers' first accepted events each have `id: 1`. After 25 accepted events (25 s with a manual clock) the ring and a later `welcome` carry exactly `[event 25, event 24, …, event 6]` (25 down to 6, newest first). `snapshot(serverId)` returns a fresh array of fresh event objects; `snapshot` for a server with no accepted events or an unknown server returns `[]`.
- **AC-11 — Lifecycle and bounded memory.** Each server's buffer is deleted when the server is destroyed and `hub.close()` clears every buffer. `clear()` sets a closed flag on that feed instance: after it, `record` returns `null`, `snapshot` returns `[]`, `dropServer` is a no-op, a second `clear()` is a no-op, and no frame or timer callback occurs; the hub's `recordActivity`/`placementFor` paths are likewise inert after close. The number of buffers never exceeds the number of live servers. The feed creates no timer in any path.

### Protocol and fan-out

- **AC-12 — `activityEvent` builder.** `activityEventMessage(event)` returns `{ type: 'activityEvent', event }` with every field validated and copied, and throws `TypeError` for any payload that violates the shared validation matrix: a missing, non-integer, zero or negative `id`/`serverId`; a missing, non-integer, zero or negative `level` when applicable; a missing, non-finite or negative `at`; a missing, non-finite or negative `elapsedMs` when applicable; an empty `partId` when applicable; an empty `playerId`/`name`; or a missing/unknown `type`. The exact encoded representative frame is pinned as `{"type":"activityEvent","event":{"id":1,"at":1000,"serverId":1,"type":"cubeCleared","playerId":"p2","name":"Player 2","level":3}}`. With a metrics-injected hub, one accepted event increments `cubeclicker_ws_messages_encoded_total{type="activityEvent"}` by 1 and `cubeclicker_ws_frames_sent_total{type="activityEvent"}` by the recipient count without throwing; the metrics catalog adds only these two allow-list values.
- **AC-13 — Welcome and reconnect snapshot.** `welcome` on a fresh join and on a rejoin, and `worldEntered` on a cross-server move, carry `activity` = the target server's current ring (newest first, ≤ 20) as a defensive copy; a server with no accepted events sends `[]`. A member disconnected while events occur receives the current ring in the rejoin `welcome`, which includes the missed events when they fit; if more than 20 events occurred while away, the oldest missed events are evicted by the ring by design. No per-client queue is used.
- **AC-14 — Encode-once fan-out and move precedence.** An accepted event is serialized exactly once (`JSON.stringify` spy count 1) and the identical text is delivered to every member of that server with an open socket. A `memberJoined` event (fresh join only) excludes that member from the live frame; `cubeCleared`/`fastClear`/`levelMilestone`/`epicLoot`/`memberLeft` include the origin where it is still a member. A move-in `memberJoined` activity is suppressed for the move, and an accepted move completion is the sole new-server activity event for that move; a dropped completion adds none. The existing 40 ms removal batching and 250 ms economy coalescing produce the same pending state and timer behavior before and after an activity event.
- **AC-15 — Protocol parity.** The backend and frontend mirrors expose the same `ActivityEvent` union, `ACTIVITY_FEED_LIMIT = 20` and validation matrix. The frontend decodes every backend-encoded valid event to the pinned shape with copied values and rejects every invalid variant in the shared matrix — a missing, non-integer, zero or negative `id`/`serverId`; a missing, non-integer, zero or negative `level` when applicable; a missing, non-finite or negative `at`; a missing/unknown `type`; an empty `playerId`/`name`; a missing type-specific field; a missing, non-finite or negative `elapsedMs`; an empty `partId` — plus an `activity` array longer than 20, with `bad_message`. A parity table/test replays the backend builder's valid and invalid fixtures. A legacy `welcome` without `activity` still decodes and is treated as an empty feed.

### Frontend state and session

- **AC-16 — Welcome seed.** `createWorldState()` starts with `activity: []`. `welcome` sets `activity` from the message (copied, newest first; absent becomes `[]`) and replaces any previous feed; `worldEntered` stores the target `activity` in `pendingWorldSwap` without changing the current feed; `applyWorldSwap` replaces the feed with the pending activity. While a swap is pending, target-server events update the pending feed per AC-17.
- **AC-17 — `activityEvent` reduction.** While `state.pendingWorldSwap` is non-null, an event whose `serverId` equals `state.pendingWorldSwap.serverId` is copied and prepended to `pendingWorldSwap.activity`, trimmed to 20 newest, without changing the current `activity`; an event whose `serverId` equals `state.serverId` is copied and prepended to `activity`, trimmed to 20 newest; any other `serverId` returns the same state reference. The duplicate-`id` check runs against the destination array (the current feed or the pending feed); a duplicate returns the same reference, as does a no-op. A change replaces only the destination branch (`self` and `members` keep their identity).
- **AC-18 — Session chain.** With a fake WebSocket, the exact backend-encoded `welcome` (carrying `activity`) and a subsequent `activityEvent` frame pass through the real transport decoder, the real `reduceWorldState`, and the session's multiplayer snapshot; `getMultiplayerSnapshot().world.activity` is the expected newest-first array. A cross-server `worldEntered` followed by a target-server `activityEvent` received before the travel midpoint updates `pendingWorldSwap.activity`, and the travel-midpoint `applyWorldSwap` replaces the feed with that updated array.

### UI and accessibility

- **AC-19 — Feed markup and text.** With a non-empty newest-first feed, `ActivityFeed` renders exactly one `<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="false">` containing `<h2 class="activity-feed-title">Server activity</h2>` and an `<ol class="activity-feed-list">` of at most the 5 newest events, each `<li data-event-type="…" data-event-id="…">` with a `<span class="activity-feed-text">` and the exact text: `Player 1 cleared Cube 3`; `Player 1 fast-cleared Cube 4 in 2.5s`; `Player 1 completed 5 cubes` for a milestone at level 5; `Player 1 unboxed an epic part`; `Player 1 joined`; `Player 1 left`. `formatActivitySeconds(2500)` returns `2.5s` and `formatActivitySeconds(999)` returns `1.0s`. An empty feed renders `null`.
- **AC-20 — Single live region.** The feed contributes no live-region semantics: its markup contains no `role="status"`, `role="alert"` or `role="log"` and no `aria-live` other than `off`. App SSR with a populated feed contains exactly one polite/assertive live region, the existing `.phase-announcement` (`role="status"`, `aria-live="polite"`), and the feed's `aria-live="off"` does not count as a live region.
- **AC-21 — Reduced motion.** With `reducedMotion` true the feed root has `data-reduced-motion="true"`; `game-view.css` disables the entry animation for `.activity-feed[data-reduced-motion='true'] li` and, independently, for `.activity-feed li` inside `@media (prefers-reduced-motion: reduce)`. With false, new entries use the 160 ms entry animation. The feed content remains fully readable in both variants.
- **AC-22 — Placement and non-interactivity.** `game-view.css` places `.activity-feed` top-center below the connection banner (`top: calc(4.25rem + env(safe-area-inset-top, 0px))`, `left: 50%`, `transform: translateX(-50%)`), caps it at `min(24rem, calc(100vw - 2rem))` and 30 vh, sets `pointer-events: none`, and under `max-width: 720px` moves it to `top: calc(10rem + env(safe-area-inset-top, 0px))` with a 6 rem max height. The feed adds no focusable control and no `main > section` HUD chrome; the existing bottom-left customization toggle and bottom-right upgrades panel placements are unchanged.

### Isolation, privacy and bounds

- **AC-23 — Cross-server isolation.** Buffers and events are keyed by `serverId`; an event is delivered only to that server's members. A client never receives another server's event; an `activityEvent` whose `serverId` matches neither `world.serverId` nor a pending `world.serverId` is ignored by the reducer with the same state reference. While a swap is pending, a target-server event updates `pendingWorldSwap.activity`, not the old feed. A mover receives the target feed and no old-server event after the move; the old buffer is deleted when its server is destroyed.
- **AC-24 — Privacy and authority.** Every event originates from a validated server transition; no event carries `accountId`, `token`, `email`, IP, free text or any client-supplied string beyond the server-issued `name` (guest `Player N` or the account username already present in the roster). An encoded scan **restricted to the `activityEvent` frames and the `activity` arrays inside `welcome`/`worldEntered`** contains none of the test token/email/accountId values; the `welcome` envelope's `token` and `identity.accountId` fields are exempt, are part of the accepted protocol, and are unchanged. The client catalog still has no activity message. No dependency, secret or `.env*` change is added.
- **AC-25 — Bounded output and move precedence.** Ten candidates at 0, 500, 1000, …, 4500 ms produce exactly five accepted events and five frames per recipient, never ten. A move produces at most one new-server activity event: the completion when accepted; none when the completion is dropped, because the move-in join is suppressed. The feed adds no timer, no per-client queue and no new metric; the existing encode-once fan-out, 40 ms removal window and 250 ms economy cadence are unchanged, and `hub.close()` leaves no pending feed state.

### Documentation and gates

- **AC-26 — Documentation.** `docs/architecture/realtime.md` gains a `## Activity feed` section documenting the event catalog and thresholds, the 1/s per-server cadence, the 20-event ring, the `welcome`/`worldEntered` snapshot, cross-server isolation, accessibility, privacy and rollback; `docs/product/glossary.md` gains a `### activity feed` entry. Every relative link resolves, `docs/features/README.md` is proposed to the orchestrator but not edited by the builder, and `README.md`/`compose.yaml`/`compose.smoke.yaml`/Dockerfiles/package files are unchanged (no command, port, image or environment change).
- **AC-27 — Containerized proof.** `tests/e2e/smoke.mjs` extends the existing `checkMultiplayerFlow`: A's `welcome.activity` is `[]` on the clean run, B's `welcome.activity` contains exactly A's `memberJoined` event (matching `serverId`, `playerId`, `name`, positive integer `id` and finite `at`), and after B's socket closes and the existing 1 s grace expires, A receives the existing `memberLeft (left)` and, using a predicate on `event.type === 'memberLeft'` that skips any earlier matching activity frame, an `activityEvent` with `event.type === 'memberLeft'`, `event.playerId === B.playerId`, `event.name === B.name`, `event.serverId === A.serverId` and `event.id > firstId`. The check adds no wait beyond the existing grace and the existing smoke checks stay green.
- **AC-28 — Quality gates.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (statements, branches, functions and lines all ≥ 80 per workspace), `npm run build` and `npm run smoke` all exit 0. `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`, `package.json` and `package-lock.json` are unchanged; no new npm dependency is added.

## Non-goals

- No free-text chat, voice, moderation, reactions or user-authored messages; every event is server-derived from a closed catalog.
- No persistence or history across restarts; no database table, file or cache; the ring is process memory only.
- No cross-server, global or account-wide feed; the feed is strictly per game server and per process.
- No new service, queue, worker, image, port, environment variable, health signal, deployable or dependency.
- No batching/economy changes: the 40 ms removal window, 250 ms economy coalescing, encode-once fan-out, click/rotate limits, heartbeat, grace, capacity and ring layout stay as shipped.
- No UI redesign or Tailwind adoption; the feed is a small ticker using the existing tokens and chrome, with no new interaction or navigation.
- No account/identity change; guests remain first-class and use their server-issued names; no account-only gating of the feed; no new PII on the wire.
- No client-authoritative events, custom event names or client-supplied text.
- No metrics dashboard, alert or new metric; only the two `type` allow-list values needed to avoid a production throw.
- No new smoke wait/timing assumption beyond the existing 1 s grace flow.
- No mobile-specific interaction; the feed is non-interactive and hidden by overflow, not by removing content from the accessibility tree.

## Boundaries

- ✅ Always: keep the hub the only authority; derive events only after the existing validation succeeds; key every buffer/event by `serverId`; use the injected clock (`HubDeps.now`) and fake timers in tests; deliver through the existing `broadcast` (encode once); bound the ring (20) and the rate (1/s); keep the shell's single live region; honor reduced motion; update docs in the same change; run the full gate.
- ⚠️ Ask first: changing the 1 s cadence, the 20-event ring, the 5-item display, the milestone cadence, the event catalog/precedence or the `activity`/`activityEvent` wire shape; adding a dependency, npm script or CI gate; changing the smoke flow's timing.
- 🚫 Never: accept a client-supplied event or name; put free text, `accountId`, tokens, emails, IPs or secrets in the feed; add a per-client queue or persistence; create a second live region; regress the encode-once fan-out or the 40 ms/250 ms paths; edit `.env*` or commit secrets; weaken assertions or exclude the new modules from coverage; `git push`.

## Security considerations

- **User-controlled data.** The event `name` is the server's member name (guest names are server-generated `Player N`; account usernames are already broadcast in the roster), and `playerId`/`serverId`/`partId` are server identifiers from the catalog. No client frame can create, name or modify an event, and no free text exists in the shape.
- **Decoder integrity.** The frontend decoder validates every field, enforces the closed type union and the 20-entry array bound, drops unknown fields, and hands the reducer a copied object. React renders `name` as text (no `innerHTML`), so no markup is interpreted.
- **Persistence integrity.** There is no persistence, migration or stored state; a restart clears the feed. No client input reaches a database write because of this feature.
- **Memory and amplification.** 20 small events per live server, deleted on server destruction and hub close; at most one frame per server per second; no per-client queue or timer. The per-server buffer count is bounded by the live server count, which is bounded by the connection cap and server capacity.
- **Privacy.** No `accountId`, token, email, IP, query string or free text; the event carries only what the roster already exposes plus the catalog `partId` and numeric level/time fields.
- **Dependencies/secrets.** No new dependency, secret or environment variable; the metrics change is an allow-list addition only.

## Real-time contract

**Server authority.** The hub generates every event after the existing validation succeeds (full-board completion, successful loot draw, accepted membership transition). A client value never becomes an event. The event time is the hub's injected clock and the event name is the hub's member record.

**Connection lifecycle.** An event is generated only while its server has members. A socket close starts the existing reconnect grace and emits no leave event; the final grace-expiry removal is a `memberLeft` candidate (accepted per the gate). A fresh join is a `memberJoined` candidate; a rejoin (resume) creates none.

**Reconnection.** The hub keeps no per-client outbound queue. The per-server ring is the only history; a rejoin `welcome` carries the current ring (including events that occurred while the member was disconnected when they fit; older missed events are evicted by the 20-event ring by design), and an event missed before the reconnect is not replayed individually. This is the same "presentation delta, not state" contract as the removal batch.

**Multi-client behavior.** Every member of a server with an open socket receives the same encoded `activityEvent` bytes; the origin of a completion/loot/leave is included, while a joining member is excluded from their own accepted join frame (the event remains in the ring). A move-in `memberJoined` activity is suppressed for the move whether the completion is accepted or dropped (the protocol `memberJoined` broadcast is unchanged). Multi-tab accounts see the feed of the server each tab is on; the feed is not account-scoped.

**Per-server isolation.** Each buffer and event is keyed by `serverId`; a broadcast uses the server's existing slot visitor, so no other server's members receive it. The event carries `serverId`, and the reducer ignores an event matching neither the current server nor a pending target server. A mover's `worldEntered` carries the target ring; target-server events during the swap are folded into `pendingWorldSwap.activity`, and the old server's buffer is deleted if the move destroys it.

**Identity and "no accounts".** No conflict: guests are first-class and use their server-issued names; accounts use their username (already visible in the roster); the feed never carries `accountId`, tokens or email. No identity, session or account-resolution behavior changes.

**No persistence.** The feed is in-memory per process; a backend restart starts every server's feed empty.

**Slow clients and shutdown.** There is no user-space outbound queue; the transport (`ws`/TCP) owns buffering/backpressure, as shipped. `hub.close()` clears the feed and its buffers; no send or timer callback happens after close.

## Accessibility and reduced motion

- **One live region.** The shell's `.phase-announcement` remains the only polite/assertive live region. The feed is a complementary landmark (`<aside aria-label="Server activity">`) with `aria-live="off"` and no `role="status"`/`role="alert"`/`role="log"`; a screen reader can read it on demand via the landmark and list navigation.
- **Semantics.** `<h2>` names the panel, `<ol>`/`<li>` preserve newest-first order, and every item has a full text sentence; there are no icon-only items, no color-only meaning and no focusable controls.
- **Reduced motion.** The component exposes `data-reduced-motion` and the CSS disables the 160 ms entry animation both for the session preference and for `prefers-reduced-motion: reduce`; content is unchanged, not hidden.
- **Responsive/non-interactive.** The ticker is top-center, capped at 5 visible items, `pointer-events: none`, with a mobile offset below the HUD; it adds no keyboard stop and does not overlap the bottom-left/right control bands (the existing panels keep their positions).

## Containerization impact

No new service, image, deployable, port, host mapping, environment variable or health signal is added. The feed travels over the existing `GET /ws` WebSocket endpoint on backend port 8080; the backend container keeps `GET /healthz` and the WebSocket upgrade unchanged. `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile` and `src/frontend/Dockerfile` are unchanged, and `podman compose up` remains the single-command local environment. The new containerized proof reuses the existing `tests/e2e/smoke.mjs` backend and the existing 1 s grace flow; no compose service or timing knob changes. Per `docs/architecture/containerization.md`, this feature reopens no settled convention.

## Testing strategy

- **Unit (backend).** `game/activity.test.ts` — first-event acceptance, exact 999/1000 ms boundary, drop consumes no id and does not move the window, continuous stream yields one per second, two-server independence with each server's `nextId` starting at 1, 20-newest-first ring with copy semantics, `snapshot` for unknown/empty, `dropServer`, `clear()` closed-flag inertness (`record` null, `snapshot` `[]`, `dropServer`/second `clear()` no-ops), and no timer. `game/protocol.test.ts` — `activityEventMessage` against every row of the validation matrix (valid and invalid), defensive copy, the exact representative encoded frame, `welcome`/`worldEntered` `activity` copy and absent→`[]`, and no client `activityEvent` acceptance. `observability/metrics.test.ts` — the two `type` allow-lists accept `activityEvent` and no other catalog entry changes.
- **Integration (backend).** `game/hub.test.ts` drives the real hub, real registry, real protocol builders, `InMemoryEconomyRepository` and fake peers with a manual clock: join (own welcome empty, later joiner sees the ring, joiner excluded from the live frame), rejoin (current ring includes events while away, older events evicted at the 20-event boundary, no join event), completion (cleared/fast/milestone precedence, threshold boundary, invalid completion), epic/rare/failed/in-flight loot, leave (grace start vs expiry, no-op removal, destroy), move (completion is the sole new-server activity candidate, recorded before the move-in join would be considered; accepted completion is the sole new-server event; dropped completion adds none; move-in join is suppressed in both cases; old-server leave independent; old buffer deletion), **a positive (open-window) and a dropped (closed-window) case for each of the six event types**, the 1/s gate across event types, 20-event ring and welcome snapshot, two-server isolation, encode-once and metrics increments, privacy scan of `activityEvent` frames and `welcome.activity` only, 40 ms/250 ms non-regression, and shutdown/close.
- **Unit (frontend).** `multiplayer/protocol.test.ts` — every valid event type, every invalid variant in the shared validation matrix, the 20-array bound, exact parity with the backend builder fixture table, and legacy welcome without `activity`. `multiplayer/server-state.test.ts` — welcome seed/replace, `worldEntered` pending feed, `applyWorldSwap` replace, current-feed and pending-feed prepend/cap/duplicate/mismatched-server rules (including a target-server event between `worldEntered` and `applyWorldSwap`), copy semantics and referential stability. `ui/ActivityFeed.test.tsx` — exact markup/text for all six types, 5-visible cap, empty→null, `aria-live="off"`, no live roles, reduced-motion attribute. `ui/game-view.css.test.ts` — the feed placement, `pointer-events: none`, the 160 ms animation, and both reduced-motion disables, with no `!important` and one trailing newline.
- **Integration (frontend).** `game/session.test.ts` — a real `createTransport` with a fake WebSocket passes the exact backend-encoded `welcome` + `activityEvent` frames through the real decoder and reducer into `getMultiplayerSnapshot().world.activity`; the `worldEntered` → target-server `activityEvent` → `applyWorldSwap` chain replaces the feed with the updated target array. `App.test.tsx` — a populated feed renders in the shell, the pre-welcome shell renders none, and the document still has exactly one polite/assertive live region.
- **E2E (containerized).** `npm run smoke` — the `checkMultiplayerFlow` activity assertions in AC-27 on real WebSocket clients (predicate on `event.type === 'memberLeft'`, no assumption that it is the next frame); every existing check stays green.
- **Coverage.** `npm run coverage` — ≥ 80% statements, branches, functions and lines in each workspace. Behavior-change tasks run the workspace-scoped pre-gate (`npm run coverage --workspace @cubeclicker/backend` / `@cubeclicker/frontend`); the final task runs the root command.
- **Assertion bar.** Concrete expected values and exact arrays/objects; no wildcard matchers (`expect.any`, `expect.objectContaining` as a substitute for a pinned payload), no snapshot-only or assertion-free tests; fake timers/manual clock, never real sleeps; no wall-clock performance assertion in unit tests.
- **Commands.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke`; frontend-prod rebuild before smoke per the existing convention.

## Approval checkpoint

This feature needs explicit user confirmation of four product-visible values before building; the blanket "Proceed with all of them, one by one" queue approval is not approval of these values. The orchestrator must present Q-1–Q-4 in the `awaiting_approval` summary and record the confirmed values in `status.md` before T1 starts. The same summary must also state Q-5 (completion precedence) and Q-6 (`worldEntered` snapshot) as the proposed defaults; they are user-visible defaults, not separate approval items.

1. **Q-1 — Milestone cadence.** Every 5th completed cube (first at Cube 5). Alternative: every 10th or 25th.
2. **Q-2 — Cadence policy.** Drop candidates inside the 1 s window (no queue, no timer); one accepted event per server per second.
3. **Q-3 — Buffer and display.** Keep 20 events per server; show the 5 newest in the ticker.
4. **Q-4 — Placement.** A compact top-center ticker below the connection banner, non-interactive, with a mobile offset.

Q-5 (completion precedence), Q-6 (`worldEntered` snapshot), Q-7 (smoke proof), Q-8 (metrics allow-list), Q-9 (rejoin is not a join), Q-10 (duplicate epics count), Q-11 (name snapshot) and Q-12 (ring pruning) are builder defaults recorded below and in the plan.

## Open questions

- **Q-1 — Milestone cadence.** Recommended default **every 5th completed cube** (`ACTIVITY_MILESTONE_EVERY = 5`, first at Cube 5): visible within a normal session and cheap under the 1/s gate. Alternatives: every 10th (rarer, more special) or every 25th (very rare).
- **Q-2 — Cadence policy.** Recommended **drop-not-queue at 1/s per server** with an inclusive 1000 ms boundary. It is deterministic, bounded, needs no timer and never replays stale events. Alternatives: a 1 s coalescing bucket that keeps the latest candidate and flushes once per second (adds a timer and a stale-by-up-to-1 s event); a priority queue (more state and policy for no S-size need).
- **Q-3 — Buffer and display.** Recommended **20 stored / 5 visible**: 20 gives a meaningful reconnect snapshot without a large welcome frame; 5 keeps the ticker compact. Alternatives: 10/3 or 50/8.
- **Q-4 — Placement.** Recommended **top-center ticker below the connection banner** (`top: 4.25rem`, max 24 rem, pointer-events none), with a mobile offset below the HUD. Alternatives: a left rail above the customization toggle (crowds the bottom band) or a bottom-center strip above the phase announcement (competes with travel announcements).
- **Q-5 — Completion precedence.** Recommended **milestone > fastClear > cubeCleared**, one candidate per completion; the gate decides acceptance. User-visible default presented in the approval summary. Alternatives: emit both milestone and fast, but the 1 s gate would drop one anyway; a separate "milestone + fast" type adds a shape for little gain.
- **Q-6 — `worldEntered` snapshot.** Recommended **include `activity`** in `worldEntered` (the shared placement payload already covers it), so a mover enters the new server with its feed; target-server events during travel are folded into the pending feed. User-visible default presented in the approval summary. Alternative: only `welcome`, which would leave a mover's feed empty until the next event.
- **Q-7 — Containerized proof.** Recommended **extend the existing `checkMultiplayerFlow`** with the A/B snapshot and the A-after-B-leave event (no new wait beyond the existing grace). Alternative: unit/integration only, which would leave the real wire fan-out unproven.
- **Q-8 — Metrics allow-list.** Recommended **add `activityEvent` to the two `type` allow-lists, no new metric**. Required: the hub's `broadcast` already increments `messages_encoded_total`/`frames_sent_total` with `{ type }`, and the registry throws for an unlisted value. A new metric would be catalog noise.
- **Q-9 — Rejoin.** Recommended **no join event on rejoin**; only fresh joins produce a `memberJoined` candidate (move-ins are suppressed by completion precedence). Alternative: treat every resume as a join, which would churn the feed on flaky connections.
- **Q-10 — Duplicate epics.** Recommended **duplicate epics are still `epicLoot` candidates** (they consume a draw and are server-validated; the gate decides acceptance). Alternative: only new epics, which would require the duplicate flag in the event and hide a real epic draw.
- **Q-11 — Name snapshot.** Recommended **store the name in the event**; a leaver is already out of the roster by the time the event is read, and the roster name could change. Alternative: resolve names from the roster, which fails for leaves and complicates the reducer.
- **Q-12 — Ring pruning.** Recommended **delete on server destruction and `hub.close()`**, with a `forEachMember` existence probe after a move. Alternative: a lazy TTL sweep (more state and a timer); an unbounded map would violate AC-11.
- **Q-13 — Documentation home.** Recommended **`docs/architecture/realtime.md` § Activity feed** plus a glossary entry; no new document. Alternative: a new architecture doc, which would fragment the outbound-path contract.
- **Q-14 — Welcome field optionality.** Recommended **optional in the TypeScript wire type, always emitted by the server**. It keeps old fixtures/mixed versions decoding (absent → empty) while the server snapshot is unconditional. Alternative: required in the type (more fixture churn, no runtime benefit).

## Assumptions

- One backend process with in-memory rooms; the feed is per process and per server; a restart clears it. No Redis, queue, microservice or persistence is introduced.
- `HubDeps.now` is the only clock for event time and cadence; tests use a manual clock/fake timers and never sleep.
- The per-server gate is authoritative: the derivation ACs use an open-window positive case and a closed-window drop case; no event type is guaranteed to be delivered when another candidate has just been accepted on that server.
- `createActivityFeed`'s `clear()` is terminal for that feed instance (closed flag); the hub calls it once from `hub.close()`, and no later record/snapshot can produce state or a frame.
- A move-in `memberJoined` activity is suppressed for the move whether the completion is accepted or dropped; the existing protocol `memberJoined` broadcast is unchanged.
- Target-server `activityEvent` frames received while a swap is pending are folded into `pendingWorldSwap.activity` and applied at the swap; this is presentation state, not a second authoritative feed.
- `member.name` is already public in the roster (guest `Player N` or the account username); the feed adds no new PII.
- `registry.forEachMember(serverId, visit)` visits nothing for an unknown or destroyed server, so it is a sufficient existence probe after a move; no registry API change is needed.
- `broadcast` is the encode-once path; `activityEvent` is one more server message type and is included in the two metrics `type` allow-lists.
- The frontend and backend deploy together; `activity` is optional in the wire type for mixed versions, and an old client drops an unknown `activityEvent` frame at its decoder without state change.
- A `welcome` with 20 small events is an acceptable payload; the 1024-byte cap applies to client frames only, and the server frame has no cap.
- The smoke backend uses `X = 2` and a 1 s grace, so the existing A/B/C flow proves join and leave events; the activity check does not add a wait.
- The feed is supplementary UI: it is non-interactive, not a live region, and may be visually covered by the ticker's overflow; no content is removed from the accessibility tree on mobile.

## Revision history

- r1 — 2026-11-15 — initial draft from the verified hub/protocol/reducer/UI audit: pins the six derived event types with exact thresholds, the 1 s per-server cadence with drop-not-queue, the 20-event newest-first ring, the additive `activityEvent` frame, the `welcome`/`worldEntered` snapshot, the `WorldState.activity` reducer contract, the single-live-region/reduced-motion UI, the per-server isolation/privacy contract, and the containerized A/B proof.
- r2 — 2026-11-15 — spec-review r1 revision: qualifies AC-1–AC-6 as gate-accepted candidates with per-type drop tests (F1); records the move completion as the sole new-server activity candidate and suppresses the move-in join for the move, so an accepted completion is the sole new-server event and a dropped completion adds none (F2); rewords the reconnect cap and 20-event boundary (F3); adds the shared protocol validation matrix and full frontend invalid list (F4); adds the feed's closed-flag inertness (F5); suppresses the move-in join and pins the fresh-join `except` (F6), and pins the `removal.left` leave predicate (F7); scopes the privacy scan to `activityEvent` frames and `activity` arrays (F8); routes target-server travel-window events through `pendingWorldSwap` (F9); pins newest-first ring order 25→6 (F10); presents Q-5/Q-6 as defaults (F11); pins per-server `nextId` and the representative exact frame (F12).
