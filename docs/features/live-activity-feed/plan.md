---
feature: live-activity-feed
revision: 2
---
# Plan — Live Activity Feed

## Architecture

Five layers, all inside the existing single-process backend and the existing frontend SPA; no new service, dependency or persistence.

1. **Feed core (backend, pure).**
   - `src/backend/src/game/activity.ts` owns timing, the per-server ring and event ids. It imports only the `ActivityEvent` type from the protocol. `createActivityFeed({ now, limit?, minIntervalMs? })` returns `record`, `snapshot`, `dropServer` and `clear`; the default limit is `ACTIVITY_FEED_LIMIT` (20) and the default window is `ACTIVITY_MIN_INTERVAL_MS` (1000). Per-server state is explicit: `{ nextId: number; lastAcceptedAt: number | null; events: ActivityEvent[] }`. `nextId` starts at 1 **per server** (not per feed), so two servers' first accepted events both have `id: 1`. The facade is analogous to `createRemovalBatcher`/`createEconomyCoalescer` in `broadcast.ts`: pure state over injected time, no peers, no message shapes, no ticks. It creates **no timer** — the gate is a timestamp comparison on the low-frequency candidate paths.
   - `record(serverId, input)` creates the server's state lazily, checks `lastAcceptedAt`, assigns `id = nextId` only on acceptance, stamps `at = now()`, unshifts the event and trims to the limit. A dropped candidate returns `null` and changes nothing (no id, no ring, no window move). `snapshot(serverId)` returns `[]` for an unknown server and a fresh array of fresh objects otherwise, newest first (`index 0` newest). `clear()` sets a closed flag: after it `record` returns `null`, `snapshot` returns `[]`, `dropServer` is a no-op, a second `clear()` is a no-op, and no state/frame can be produced. `dropServer(serverId)` deletes only that server's state.
   - `ACTIVITY_MILESTONE_EVERY = 5` is exported here because it is a feed rule, not a wire constant.

2. **Wire catalog (backend + frontend mirrors).**
   - `src/backend/src/game/protocol.ts` defines `ActivityEvent` (a discriminated union), `ACTIVITY_FEED_LIMIT`, `activityEventMessage(event)` (validates and copies, throws `TypeError` on an invalid payload), `parseActivityEvent(value)` (the shared validator) and `copyActivityEvent(event)`. Both mirrors implement the spec's **Protocol validation matrix** exactly: positive-integer `id`/`serverId`/`level`; finite non-negative `at`/`elapsedMs`; non-empty `playerId`/`name`/`partId`; the closed six-type union; type-specific required fields; a 0…20 `activity` array; unknown extra fields dropped. The builder's representative exact frame is `{"type":"activityEvent","event":{"id":1,"at":1000,"serverId":1,"type":"cubeCleared","playerId":"p2","name":"Player 2","level":3}}` (field order pinned in the `ActivityEvent` construction). `Placement` gains `activity?: ActivityEvent[]`; `placementPayload` copies it into `welcome`/`worldEntered` and defaults an absent value to `[]`. The `ServerMessage` union gains `{ type: 'activityEvent'; event: ActivityEvent }`. The client catalog is unchanged.
   - `src/frontend/src/multiplayer/protocol.ts` mirrors the union, the constant, `parseActivityEvent`, `activityEventMessage` (parity helper), the same validation matrix and the `activity` parsing in `parsePlacement`: an absent field is `[]`; a non-array, a length > 20 or any invalid entry is `bad_message`. The parity test replays the backend builder's valid/invalid fixture table rather than maintaining a separate list.

3. **Hub derivation (backend game layer).**
   - `createGameHub` creates one feed with `createActivityFeed({ now: deps.now })`.
   - `placementFor(member)` adds `activity: activity.snapshot(location.serverId)` so every `welcome` (fresh join and rejoin) and every `worldEntered` carries the target ring.
   - A single `recordActivity(serverId, input, except?)` helper records and, when accepted, broadcasts `activityEventMessage(event)` through the existing `broadcast` (encode once, same text to every recipient; `except` is used only for the joining member).
   - Derivation points (every candidate goes through `recordActivity`; only an accepted candidate is broadcast):
     - **Completion** (`handleCompletion`): capture `completedLevel = member.cube.levelIndex + 1` and the existing `elapsedMs`/`bonus` before the cube is replaced. After the existing `levelAdvanced` or `worldEntered`/`memberLeft`/`memberJoined` broadcasts, record the completion as the **sole new-server activity candidate** (before the move-in join would be considered) on `locationOf(member.playerId)` (the post-move server): `levelMilestone` if `completedLevel % 5 === 0`, else `fastClear` if `bonus`, else `cubeCleared`. For a move, record the old server's `memberLeft` after the `memberLeft (moved)` broadcast when `serverHasMembers(oldServerId)`, else `activity.dropServer(oldServerId)`. On the new server, the completion is the sole new-server activity candidate (recorded before the move-in join would be considered); suppress the move-in `memberJoined` activity for the move (no join record, id or frame), whether the completion is accepted or dropped; when accepted, the completion is the sole new-server event, and when dropped the move adds none. The protocol `memberJoined` broadcast is unchanged.
     - **Join** (`handleJoin`): after `send(welcome)` and `broadcast(memberJoined)`, record `memberJoined` on the assignment server with `except = member.playerId`, so the joiner does not receive their own join frame (the event is still in the ring). This is a candidate subject to the gate.
     - **Rejoin** (`handleRejoin`): no candidate; the `welcome` carries the ring.
     - **Leave** (`removeMember`): after the `memberLeft (left)` broadcast, record `memberLeft` only when `removal.left && !removal.serverDestroyed` (the same condition as the broadcast); otherwise drop the buffer. A no-op removal creates no candidate.
     - **Loot** (`handleOpenLootbox`): after the `lootboxOpened` frame, when `partDefinition(partId).rarity === 'epic'` and `locationOf(member.playerId)` is non-null, record `epicLoot` on that server.
   - `serverHasMembers(serverId)` is a small `registry.forEachMember` probe (at most `maxUsersPerServer` visits; unknown/destroyed visits nothing). It avoids changing the registry interface for a destroyed-server return value on `moveMember`.
   - `hub.close()` calls `activity.clear()` after the existing discard/clear block; `clear()` is terminal for the feed (record null, snapshot `[]`, drop no-op), and the hub's closed guard makes any late `recordActivity`/`placementFor` path inert.
   - `src/backend/src/observability/metrics.ts` adds `activityEvent` to the `type` allow-lists of `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total`; no metric definition changes.

4. **Frontend state and session.**
   - `src/frontend/src/multiplayer/server-state.ts`: `WorldState` gains `activity: ActivityEvent[]`; `PendingWorldSwap` gains `activity: ActivityEvent[]`. `createWorldState()` starts `activity: []`. `welcome` sets `activity` from the message (copied; absent → `[]`) and replaces the old feed. `worldEntered` copies the message's `activity` into the pending swap without touching the current feed. `applyWorldSwap` replaces the feed with the pending swap's activity. An `activityEvent` case routes by server: while a swap is pending, an event whose `serverId` matches `pendingWorldSwap.serverId` is prepended to `pendingWorldSwap.activity` (trimmed to `ACTIVITY_FEED_LIMIT`) and the current `activity` is untouched; an event matching `state.serverId` is prepended to `activity`; any other `serverId` returns the same state. The duplicate-`id` check runs against the destination array. Only the destination branch changes; `self`/`members` keep identity, and a no-op/duplicate/mismatch returns the same reference.
   - `src/frontend/src/game/session.ts`: `handleServerMessage` adds an explicit `activityEvent` case with no engine/scene action (the reducer owns the feed; `activeScene?.applyWorldMessage` already falls through unknown types). `publishMultiplayer()` already notifies on the world change; no new store or listener is added.

5. **UI and styles.**
   - `src/frontend/src/ui/ActivityFeed.tsx`: `activityText(event)` (exact copy below), `formatActivitySeconds(elapsedMs)` (`(ms / 1000).toFixed(1) + 's'`), `ACTIVITY_VISIBLE_COUNT = 5`, and the stateless `<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="…">` with an `<h2>` and an `<ol>` of at most 5 `<li>` items. Empty → `null`. No `role="status"`/`alert`/`log`, no interactive controls, no timestamps (server clock ≠ client clock).
   - `src/frontend/src/App.tsx`: render `<ActivityFeed events={world.activity} reducedMotion={snapshot.reducedMotion} />` inside the welcomed branch; the existing `.phase-announcement` stays the only polite/assertive live region.
   - `src/frontend/src/ui/game-view.css`: add `.activity-feed` to the rounded chrome and pseudo-element reset lists; position it top-center below the connection banner, cap it at 24 rem / 30 vh, `pointer-events: none`, with a 160 ms entry animation and a `max-width: 720px` offset below the HUD; disable the animation under `data-reduced-motion="true"` and `@media (prefers-reduced-motion: reduce)`. No new tokens, no Tailwind, no `!important`.

### Data flow

```
hub validated transition
  ├─ handleJoin → welcome (activity snapshot) → memberJoined broadcast → record memberJoined candidate (except joiner) ─┐
  ├─ handleCompletion (capture level/elapsed/bonus) → existing broadcasts → record completion (sole new-server candidate); move-in join suppressed ─┤
  ├─ handleOpenLootbox (epic) → lootboxOpened → record epicLoot candidate ────────────────────────────────────────────────────┤
  ├─ removeMember / move-out → memberLeft broadcast → record memberLeft candidate (left && server alive) or dropServer ──────┤
  └─ rejoin → welcome (activity snapshot), no join candidate ────────────────────────────────────────────────────────────────┤
                                                                                                                            ▼
feed.record(serverId, input) ── 1 s gate ── accepted: per-server id/at + ring unshift/trim ──► broadcast(serverId, activityEvent)
                                                                                              (encode once, per-server fan-out)
                                                                                                                            │
frontend: transport decoder ──► parseActivityEvent / parsePlacement.activity ──► reduceWorldState ──► WorldState.activity (or pendingWorldSwap.activity during travel)
                                                                                                                            │
                                                                                                          App ──► ActivityFeed (5 newest)
```

## Interfaces / contracts

```ts
// protocol mirrors (backend + frontend)
export const ACTIVITY_FEED_LIMIT = 20;

export type ActivityEvent =
  | { id: number; at: number; serverId: number; type: 'cubeCleared'; playerId: string; name: string; level: number }
  | { id: number; at: number; serverId: number; type: 'fastClear'; playerId: string; name: string; level: number; elapsedMs: number }
  | { id: number; at: number; serverId: number; type: 'levelMilestone'; playerId: string; name: string; level: number }
  | { id: number; at: number; serverId: number; type: 'epicLoot'; playerId: string; name: string; partId: string }
  | { id: number; at: number; serverId: number; type: 'memberJoined'; playerId: string; name: string }
  | { id: number; at: number; serverId: number; type: 'memberLeft'; playerId: string; name: string };

// ServerMessage additions
| { type: 'activityEvent'; event: ActivityEvent }
// welcome / worldEntered / Placement:
activity?: ActivityEvent[];            // optional in the type, always emitted by the backend builder

export function activityEventMessage(event: ActivityEvent): ServerMessage; // validates + copies; throws TypeError
export function parseActivityEvent(value: unknown): ActivityEvent | null;   // closed union + field validation
export function copyActivityEvent(event: ActivityEvent): ActivityEvent;

// backend game/activity.ts
export const ACTIVITY_MIN_INTERVAL_MS = 1000;
export const ACTIVITY_MILESTONE_EVERY = 5;
export type ActivityEventInput =
  | { type: 'cubeCleared'; playerId: string; name: string; level: number }
  | { type: 'fastClear'; playerId: string; name: string; level: number; elapsedMs: number }
  | { type: 'levelMilestone'; playerId: string; name: string; level: number }
  | { type: 'epicLoot'; playerId: string; name: string; partId: string }
  | { type: 'memberJoined'; playerId: string; name: string }
  | { type: 'memberLeft'; playerId: string; name: string };
interface FeedState {
  nextId: number;                    // starts at 1 per server
  lastAcceptedAt: number | null;     // gate; only acceptance moves it
  events: ActivityEvent[];           // newest first, at most ACTIVITY_FEED_LIMIT
}
export interface ActivityFeed {
  record(serverId: number, input: ActivityEventInput): ActivityEvent | null; // null = dropped by the gate or closed
  snapshot(serverId: number): ActivityEvent[];                                // newest first, defensive copy; [] after clear()
  dropServer(serverId: number): void;                                         // no-op after clear()
  clear(): void;                                                              // terminal: record null, snapshot [], drop no-op
}
export function createActivityFeed(options: {
  now: () => number;
  limit?: number;            // default ACTIVITY_FEED_LIMIT
  minIntervalMs?: number;    // default ACTIVITY_MIN_INTERVAL_MS
}): ActivityFeed;

// exact representative encoded frame (field order pinned):
// {"type":"activityEvent","event":{"id":1,"at":1000,"serverId":1,"type":"cubeCleared","playerId":"p2","name":"Player 2","level":3}}

// frontend multiplayer/server-state.ts
export interface PendingWorldSwap { /* …existing… */ activity: ActivityEvent[]; }
export interface WorldState { /* …existing… */ activity: ActivityEvent[]; }
export function reduceWorldState(state: WorldState, msg: ServerMessage): WorldState; // adds welcome/worldEntered/activityEvent handling

// frontend ui/ActivityFeed.tsx
export const ACTIVITY_VISIBLE_COUNT = 5;
export function formatActivitySeconds(elapsedMs: number): string; // "2.5s"
export function activityText(event: ActivityEvent): string;
export function ActivityFeed(props: {
  events: readonly ActivityEvent[];
  reducedMotion?: boolean;
}): ReactElement | null;
```

### Pinned display text

| Type | Text |
| --- | --- |
| `cubeCleared` | `{name} cleared Cube {level}` |
| `fastClear` | `{name} fast-cleared Cube {level} in {formatActivitySeconds(elapsedMs)}` |
| `levelMilestone` | `{name} completed {level} cubes` |
| `epicLoot` | `{name} unboxed an epic part` |
| `memberJoined` | `{name} joined` |
| `memberLeft` | `{name} left` |

`formatActivitySeconds` is `(elapsedMs / 1000).toFixed(1) + 's'`: `2500 → 2.5s`, `999 → 1.0s`, `0 → 0.0s`.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/activity.ts` | New | Per-server ring, id state, 1 s gate, snapshots, drop/clear, terminal closed flag; no timers. |
| `src/backend/src/game/activity.test.ts` | New | Gate boundary, per-server ids, ring, isolation, closed-flag lifecycle unit tests. |
| `src/backend/src/game/protocol.ts` | Edit | `ActivityEvent`, `ACTIVITY_FEED_LIMIT`, builder/validator/copy, `Placement.activity`, `activityEvent` message. |
| `src/backend/src/game/protocol.test.ts` | Edit | Builder validation/copy/exact frame; welcome activity copy/absent. |
| `src/backend/src/game/hub.ts` | Edit | Feed instance, derivation hooks, welcome/worldEntered snapshots, buffer pruning, close clear. |
| `src/backend/src/game/hub.test.ts` | Edit | End-to-end derivation with accepted/dropped per-type cases, move precedence, reconnect, move/destroy, isolation, metrics, privacy scan, non-regression. |
| `src/backend/src/observability/metrics.ts` | Edit | `activityEvent` in the two `type` allow-lists only. |
| `src/backend/src/observability/metrics.test.ts` | Edit | Catalog accepts the new type values; no new metric. |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirror union/constant/parser/builder; `activity` in `parsePlacement`. |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Valid/invalid events, array bound, parity, legacy welcome. |
| `src/frontend/src/multiplayer/server-state.ts` | Edit | `WorldState.activity`, pending-swap activity, welcome/worldEntered/activityEvent reduction. |
| `src/frontend/src/multiplayer/server-state.test.ts` | Edit | Seed/replace/prepend/cap/duplicate/mismatch/share-identity and travel-window pending-feed tests. |
| `src/frontend/src/game/session.ts` | Edit | Explicit `activityEvent` case with no engine/scene action. |
| `src/frontend/src/game/session.test.ts` | Edit | Real transport + reducer integration; travel-window target event; pending-swap fixture update. |
| `src/frontend/src/ui/ActivityFeed.tsx` | New | Tickered `<aside>` with exact text, 5-visible cap, reduced-motion attribute. |
| `src/frontend/src/ui/ActivityFeed.test.tsx` | New | Exact markup/text, empty→null, aria/live-region assertions. |
| `src/frontend/src/App.tsx` | Edit | Render the feed in the welcomed shell; keep the single live region. |
| `src/frontend/src/App.test.tsx` | Edit | Populated/pre-welcome feed and single-live-region SSR assertions. |
| `src/frontend/src/ui/game-view.css` | Edit | Top-center placement, chrome reset, 160 ms entry, reduced-motion disables. |
| `src/frontend/src/ui/game-view.css.test.ts` | Edit | Placement/reduced-motion/no-`!important` assertions. |
| `tests/e2e/smoke.mjs` | Edit | A/B welcome activity and the A-after-B-leave `activityEvent` check. |
| `docs/architecture/realtime.md` | Edit | `## Activity feed` contract and catalog. |
| `docs/product/glossary.md` | Edit | `### activity feed` definition. |
| `docs/features/live-activity-feed/build-log-T5.md` | New | Final verification evidence. |

No change: `src/backend/src/app.ts` (the hub creates the feed from its existing `now`), `src/backend/src/game/config.ts`, `src/backend/src/game/servers.ts`, `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles, `package.json`, `package-lock.json`, `docs/features/README.md` (orchestrator-owned; a row is proposed, never edited).

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Server-derived events only; no client activity message | Preserves server authority and the no-free-text rule; every event is a consequence of an already validated transition. | Client-reported events (rejected: authority/privacy); deriving from raw click broadcasts (too noisy). |
| 2 | One feed per server, keyed by `serverId`, in-memory | Matches the single-process in-memory rooms; no cross-server state and no persistence. | Global/account feed (out of scope); per-client queues (unbounded and stale). |
| 3 | 1 s per-server gate, drop-not-queue, no timer | Every candidate from all six event types passes the gate; derivation ACs test both an accepted and a dropped case. Bounded output, deterministic, no timer hygiene, never replays stale events; the existing removal/economy timers stay untouched. | Coalescing bucket with a timer (stale up to 1 s); priority queue (more state for an S feature). |
| 4 | 20-event newest-first ring | A useful reconnect snapshot with a small payload; one constant in both protocol mirrors; `index 0` is the newest so the snapshot/UI order is unambiguous. | 10/50 (smaller/larger snapshot); per-client history (rejected: memory). |
| 5 | One event per completion; `levelMilestone` > `fastClear` > `cubeCleared`; completion is the sole new-server candidate on a move and move-in join suppressed | The 1 s gate would drop a second event anyway; the highest-signal fact wins and the fast predicate matches the coin bonus. A move only exists because of a completion, so the completion is the sole new-server candidate; when accepted it is the one event, when dropped the move adds none. | Emit both fast and milestone (one would be dropped); join first (rejected: the completion is always dropped and AC-7 unobservable); a completion/join race (rejected: clock-dependent); a compound type (needless wire shape). |
| 6 | Event carries `serverId` and a snapshot `name` | `serverId` is the cross-server guard; a leaver is already out of the roster and names can change, so the event must be self-contained. | Resolve names from the roster (fails for leaves); omit `serverId` (cannot reject a stale/mixed frame). |
| 7 | `welcome` and `worldEntered` carry the ring (optional in the type) | Reconnect and cross-server entry need the feed; optional keeps old fixtures/mixed versions decoding (absent → `[]`). | Required in the type (more churn); only `welcome` (a mover enters an empty feed). |
| 8 | Feed state lives in `WorldState`, including `pendingWorldSwap.activity` | One store and one publish path; `welcome` replace and `worldEntered`/`applyWorldSwap` already model a server switch. | A separate session store (duplicates the server-switch logic); a React-only state (unavailable to the reducer tests). |
| 9 | `<aside aria-live="off">`, no live roles | The shell keeps exactly one polite/assertive live region; the feed is readable on demand without competing announcements. | `role="log"`/`aria-live="polite"` (a second live region; rejected by AC-20). |
| 10 | Top-center ticker, 5 visible, `pointer-events: none` | Avoids the bottom-left customization toggle and bottom-right upgrades panel; no new keyboard stop; 5 keeps it compact. | Left rail (crowds the bottom band); bottom-center (competes with the phase announcement). |
| 11 | `activityEvent` added to the two metrics type allow-lists, no new metric | The existing `broadcast` increments both with `{ type }`; an unlisted value throws. Allow-listing is the minimal correct change. | A new metric (catalog noise); skipping the increment (a divergent outbound path). |
| 12 | Delete buffers on server destruction + `hub.close()`; probe the old server after a move; leave records only on `removal.left && !serverDestroyed` | Bounded memory without a registry API change; `removeMember` already reports `serverDestroyed`; `forEachMember` visits nothing for a destroyed server; the leave predicate matches the existing broadcast. | Lazy TTL sweep (more state/timer); changing `moveMember`'s return type (interface/test churn). |
| 13 | Smoke proof in the existing A/B/C flow | Real wire proof of the `welcome` snapshot and a live leave event with no new wait; the existing grace already covers the timing; the predicate matches `event.type === 'memberLeft'`, not the next frame. | Unit/integration only (no wire proof); a dedicated long smoke flow (slower/flakier). |
| 14 | Docs in `realtime.md` + glossary | The outbound-path contract already lives in `realtime.md`; a new doc would fragment it. | A new architecture document (overhead); README (no command/port change). |
| 15 | Route target-server events during travel into `pendingWorldSwap.activity` | The mover's target feed stays current between `worldEntered` and `applyWorldSwap`; the swap applies it, and no second authoritative feed is created. | Drop the travel window (AC-7/16 would document a stale gap); apply target events to the old feed (wrong server). |
| 16 | `clear()` sets a terminal closed flag on the feed | AC-11 becomes directly testable (`record` null, `snapshot` `[]`, `dropServer`/second `clear` no-op) instead of relying on the hub guard alone; no post-close state or frame. | Hub-only inertness (harder to test at the feed boundary); a TTL/empty flag (more state). |

## Risks & mitigations

- **Event flood or frame amplification** → one accepted event per server per second, drop-not-queue, no timer, no per-client queue; all six candidate types pass the same gate and each has an accepted and a dropped test (AC-9/AC-25). The existing 40 ms/250 ms windows are untouched (AC-14).
- **Derivation ACs contradicting the gate** → the derivation ACs say "when the per-server gate accepts it" and separately assert that a dropped candidate emits no event/frame/id; the per-type drop cases are in `hub.test.ts` (AC-1…AC-6, AC-9).
- **Move completion unobservable** → the completion is the sole new-server activity candidate on the new server (recorded before the move-in join would be considered) and the move-in join is suppressed for the move whether the completion is accepted or dropped. The move test asserts the accepted case (one completion, no join) and the dropped case (zero new-server events, no join), with no clock advance inside one `handleCompletion` call (AC-7/AC-14/AC-25).
- **Production throw from the metrics `type` allow-list** → T2 adds `activityEvent` to both lists and a metrics-injected hub test asserts the increments (AC-12); the catalog still has no new metric.
- **Cross-server leak or stale buffer** → every event and buffer is keyed by `serverId`; the reducer rejects an event matching neither the current nor a pending target server (AC-17); the old buffer is deleted on a destroying move and `removeMember` reports `serverDestroyed`; the hub test covers two servers and a mover (AC-23).
- **Travel-window gap** → target-server `activityEvent` frames received between `worldEntered` and `applyWorldSwap` update `pendingWorldSwap.activity`; the swap applies the updated array; a test injects one such event and asserts it is present after the swap (AC-7/AC-17/AC-18).
- **Leave event without a broadcast** → the leave record is gated on `removal.left && !removal.serverDestroyed` (the same condition as the `memberLeft` broadcast); a no-op removal test covers `left: false` (AC-6).
- **Event starvation (join/leave dropped by completions)** → the gate is first-come by design; move-in joins are suppressed by completion precedence, not queued or prioritised; no priority queue is added. The spec qualifies every derivation AC and documents the drop, and the 1 s cadence means at most one visible miss per second.
- **Welcome frame growth** → 20 events of fixed small fields; the field is optional in the type and always a defensive copy; no server frame cap is affected (the 1024-byte cap is client-only). A 20-event snapshot is asserted at the ring cap, including the reconnect-eviction boundary.
- **Second live region / screen-reader fighting** → `aria-live="off"`, no live roles, and an App SSR test counts polite/assertive regions (AC-20); the phase announcement remains the only one.
- **CSS overlap with existing panels** → `aside` (not `main > section`), top-center placement, `pointer-events: none`, mobile offset below the HUD; CSS tests pin the declarations (AC-22); the top-center slot is unused by the existing bottom/left/right panels.
- **Reducer fixture churn** → `activity` is required in `WorldState` (clear contract) and optional in the wire field (old fixtures/mixed versions). T3 owns the reducer tests and the session pending-swap expectation; T4 owns the App fixture. The UI keys items by `event.id` so a prepended event mounts a new node and plays the entry animation.
- **Smoke timing flakiness** → the check matches `event.type === 'memberLeft'` rather than assuming the next frame (B's join may have been accepted if the joins are more than 1 s apart) and asserts `event.id > firstId` (not an exact gap); the unit tests pin the exact 999/1000 ms boundary and the no-id-on-drop rule.
- **Privacy scan false positive** → the scan is restricted to `activityEvent` frames and `welcome`/`worldEntered` `activity` arrays; the `welcome` envelope's legitimate `token`/`identity.accountId` fields are explicitly exempt (AC-24).
- **Validation drift between mirrors** → both mirrors implement the shared validation matrix and a parity test replays the backend builder's valid/invalid fixtures; the exact representative frame is pinned (AC-12/AC-15).
- **Rollback divergence** → the wire field is optional and `activityEvent` is a new type: an old client drops the frame at its decoder, a new client treats an absent `activity` as `[]`. Backend-first and frontend-first deploys are both safe.
- **Protocol naming/type drift** → both protocol mirrors declare the same union and constant and a parity test replays the backend literal; no protocol version bump is made.

## Rollback

- **Backend-first rollback**: remove the `activityEvent` union/builder, the `activity` field in `Placement`/`placementPayload`, the feed module, the hub derivation hooks and the two metrics allow-list values. No schema, persistence, container or config change exists to roll back. An old frontend already ignores the extra `activity` field on `welcome` and drops the unknown frame.
- **Frontend-first rollback**: remove the `ActivityFeed` render/component/CSS and the `activityEvent` case; `WorldState.activity` becomes unused. A new frontend against an old backend decodes `welcome` without `activity` as `[]` and renders nothing.
- **Operational rollback**: none needed — the feed is process memory only, has no feature flag and no stored data; a restart clears it.
- **Docs**: revert the `## Activity feed` section and the glossary entry in the same rollback change; the feature index row is orchestrator-owned.

## Containerization impact

No new service, image, deployable, port, host mapping, environment variable, healthcheck or dependency. The `activityEvent` frame travels on the existing `GET /ws` WebSocket endpoint on backend port 8080; `GET /healthz` and the upgrade path are unchanged. `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile` and `src/frontend/Dockerfile` are untouched, and `podman compose up` remains the single local command. The containerized proof reuses `tests/e2e/smoke.mjs` and its existing backend/1 s grace; no service or timing knob is added. No settled convention in `docs/architecture/containerization.md` is reopened.

## Open questions

See `spec.md` § Open questions. The four approval items are Q-1 (milestone every 5), Q-2 (drop-not-queue at 1/s), Q-3 (20 stored / 5 visible) and Q-4 (top-center ticker). Q-5 (completion precedence) and Q-6 (`worldEntered` snapshot) are user-visible defaults presented in the same approval summary; Q-7…Q-14 are technical defaults recorded in `spec.md` and in this plan's key decisions.
