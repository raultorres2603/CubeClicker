---
feature: server-live-leaderboard
revision: 2
---
# Plan — Server Live Leaderboard

## Architecture

Five layers, all inside the existing single-process backend and the existing frontend SPA; no new service, dependency, database or persistence.

1. **Leaderboard core (backend, pure).**
   - `src/backend/src/game/leaderboard.ts` owns the ranking, the snapshot builder and the per-server flush scheduler. It imports only protocol types/constants; it does not import the hub, peers or message shapes.
   - `LEADERBOARD_INTERVAL_MS = 1000`, `LEADERBOARD_TOP_LIMIT = 5` (the limit is also exported by both protocol mirrors).
   - `buildLeaderboardSnapshot(serverId, at, members, limit = LEADERBOARD_TOP_LIMIT)` takes the server's members **in registry/slot order** and returns `{ serverId, at, entries, totals }`: totals are summed over every input member; a copy is sorted by `cubesCompleted` desc, `clicks` desc, then original index asc (the explicit equivalent of stable sort, so the final tie-break is slot order); the first `limit` entries are mapped to fresh `{ playerId, name, cubesCompleted, clicks }` objects. It never mutates the input and never reads the clock.
   - `createLeaderboardCoalescer({ intervalMs, timers, flush })` follows the `createEconomyCoalescer`/`createRemovalBatcher` shape (injected `TimerFns`, no wall clock): `markDirty(serverId)` sets one `setTimeout(flush, intervalMs)` per server if none is pending; `dropServer(serverId)` clears that server's timer; `discard()` clears every timer and makes the instance terminal; `pendingServers()` exposes the timer count for tests. At the callback the timer entry is deleted before `flush(serverId)` runs, so a callback that marks the same server dirty again starts a fresh window.
   - No snapshot is cached: the hub builds it at flush time from the live members, so the ranking and totals can never be stale relative to the roster/counters.

2. **Wire catalog (backend + frontend mirrors).**
   - `src/backend/src/game/protocol.ts` defines `LEADERBOARD_TOP_LIMIT = 5`, `LeaderboardEntry`, `LeaderboardSnapshot`, `parseLeaderboardSnapshot(value)`, `copyLeaderboardSnapshot(snapshot)` and `leaderboardUpdateMessage(snapshot)`. Both mirrors implement the spec's **Protocol validation matrix** exactly: positive-integer `serverId`; finite non-negative `at`; 0…5 entries; non-empty `playerId`/`name`; non-negative-integer `cubesCompleted`/`clicks`; a `totals` object with three non-negative-integer counters; unknown extra fields dropped; every result a fresh copy. The builder throws `TypeError` on an invalid payload. The exact representative frame is pinned in the spec and tested.
   - `Placement` gains `leaderboard?: LeaderboardSnapshot`; `placementPayload` copied it into `welcome`/`worldEntered` and preserves absence (legacy fixtures). The `ServerMessage` union gains `{ type: 'leaderboardUpdate'; leaderboard: LeaderboardSnapshot }`; the client catalog is unchanged.
   - `src/frontend/src/multiplayer/protocol.ts` mirrors the constant, types, parser, copier and builder, and decodes `leaderboard` in `parsePlacement`: absent → omit/`null`; non-object, over-long, invalid entry, or a `leaderboard.serverId` different from the enclosing `serverId` → `bad_message`. The parity test replays the backend valid/invalid fixture table.

3. **Hub counters and publication (backend game layer).**
   - `Member` gains `sessionStats: { clicks: number; facesDestroyed: number; cubesCompleted: number }`, initialized to zeros at `handleJoin` beside `economy`/`upgrades`/`customization`. It survives grace and moves with the member and is deleted with the member; no separate map or persistence.
   - Increment points, after the existing validation (never before):
     - `handleExplode`: after `validateExplode` succeeds and the id is added to `removedIds`, `clicks += 1`; after the existing face loop, `facesDestroyed += 1` when `faceCleared`; then mark the member's current server dirty. Invalid/rate-limited/oversized/pre-join paths return before the increments.
     - `handleCompletion`: after `isComplete` succeeds, capture `completedLevel`/`elapsedMs`/`bonus`, increment `cubesCompleted` once, then after the move/broadcast branch mark the affected server(s) dirty. Same-server completion → `previous.serverId`. Cross-server move → if the old server still has members, mark it dirty; otherwise `leaderboard.dropServer(previous.serverId)`; then mark the new `location.serverId` dirty. The increment happens before the snapshot is built at flush, so the target entry includes the completion and the old totals exclude the mover.
     - `handleJoin`: after the welcome/memberJoined/activity sequence and `recomputePlan`, mark `assignment.serverId` dirty (the joiner appears with zeros; the welcome snapshot is already sent).
     - `removeMember`: on `removal.left && location !== null`, if `serverDestroyed` call `leaderboard.dropServer(location.serverId)`, else mark it dirty. A no-op removal and a socket close/grace start mark nothing.
     - `handleRejoin`, `handleRotate`, `handlePurchaseUpgrade`, `handleOpenLootbox`, `handleEquipPart`, `handleUnequipPart`: no counter change, no mark.
   - `placementFor(member)` adds `leaderboard: buildLeaderboardSnapshot(location.serverId, deps.now(), collectLeaderboardMembers(location.serverId))`, so every fresh join, rejoin and `worldEntered` carries the current snapshot.
   - `collectLeaderboardMembers(serverId)` walks `registry.forEachMember` (slot order) and maps each `members.get(playerId)` to `{ playerId, name, clicks, facesDestroyed, cubesCompleted }`; a missing member is skipped defensively.
   - `publishLeaderboard(serverId)` (the coalescer `flush`): if `closed` or `!serverHasMembers(serverId)`, return; otherwise `broadcast(serverId, leaderboardUpdateMessage(snapshotFor(serverId)))` through the existing encode-once path (no `except`; the origin is included because the snapshot is a server-wide view).
   - `createGameHub` creates one coalescer with `{ intervalMs: LEADERBOARD_INTERVAL_MS, timers, flush: publishLeaderboard }`. `hub.close()` calls `leaderboard.discard()` in the shutdown block (alongside the removal batcher, economy coalescer and activity feed).
   - `src/backend/src/observability/metrics.ts` adds `leaderboardUpdate` to the `type` allow-lists of `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total`; no metric definition changes.

4. **Frontend state and session.**
   - `src/frontend/src/multiplayer/server-state.ts`: `WorldState` gains `leaderboard: LeaderboardSnapshot | null`; `PendingWorldSwap` gains `leaderboard: LeaderboardSnapshot | null`. `createWorldState()` starts `leaderboard: null`. `welcome` sets it from the message (deep copy; absent → `null`) and replaces any previous snapshot. `worldEntered` copies the message's `leaderboard` into the pending swap without touching the current snapshot. `applyWorldSwap` replaces the current snapshot with the pending one (or `null`). A `leaderboardUpdate` case routes by server: while a swap is pending, a snapshot matching `pendingWorldSwap.serverId` replaces the pending snapshot and leaves the current one untouched; a snapshot matching `state.serverId` replaces the current snapshot; any other `serverId` returns the same state. A deep-equality check (`leaderboardsEqual`) returns the same reference for an identical snapshot; a change replaces only the leaderboard branch (`self`, `members`, `activity` keep identity).
   - `src/frontend/src/game/session.ts`: `handleServerMessage` adds an explicit `leaderboardUpdate` case with no engine/scene action (the reducer owns the panel; `publishMultiplayer()` already runs). No new store or listener.

5. **UI and styles.**
   - `src/frontend/src/ui/Leaderboard.tsx`: `LEADERBOARD_VISIBLE_COUNT = 5`, `pluralize(count, singular, plural)`, `leaderboardEntryText(entry)` (`2 cubes · 40 clicks`, `1 cube · 1 click`, `0 cubes · 0 clicks`) and `leaderboardTotalsText(totals)` (`Server totals: 2 cubes · 40 clicks · 3 faces`). A stateless `<aside class="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion="…" data-server-id="…">` with `<h2>` and an `<ol>` of at most five `<li data-rank data-player-id>` rows (rank badge, name, score text) plus a `<p class="leaderboard-totals">`. Returns `null` for a null/empty snapshot. No `role="status"`/`alert`/`log`, no focusable control, no timestamps, no re-sorting.
   - `src/frontend/src/App.tsx`: render `<Leaderboard snapshot={world.leaderboard} reducedMotion={snapshot.reducedMotion} />` in the welcomed branch beside `ActivityFeed`; the existing `.phase-announcement` stays the only polite/assertive live region.
   - `src/frontend/src/ui/game-view.css`: add `.leaderboard` to the rounded-chrome and pseudo-element reset groups; place it as a non-interactive left rail below the HUD (`top: calc(12.5rem + env(safe-area-inset-top, 0px))`, `left: calc(1rem + env(safe-area-inset-left, 0px))`, `width: min(17rem, calc(100vw - 2rem))`, `max-height: 40vh`, `pointer-events: none`), style the title/list/rows/totals compactly, add a 160 ms row-entry animation, disable it under `data-reduced-motion='true'` and `@media (prefers-reduced-motion: reduce)`, and under `max-width: 720px` move it below the activity feed (`top: calc(17rem + env(safe-area-inset-top, 0px))`, `width: min(14rem, calc(100vw - 2rem))`, `max-height: 18vh`, smaller font). Add a `@media (max-width: 720px) and (max-height: 600px)` rule that caps the panel at `max-height: 12vh` with a smaller font. The panel must not overlap the HUD, connection banner, activity feed or user panel; on very short mobile viewports its lower rows may be visually clipped behind the upgrades panel (which paints above), while all five rows and the totals stay in the DOM/accessibility tree. No `!important`, no new tokens, no changes to existing selectors' placements.

### Data flow

```
hub validated transition
  ├─ handleExplode (admitted + valid) ──► member.sessionStats.clicks +1; faces +1 if faceCleared ─┐
  ├─ handleCompletion (isComplete) ─────► member.sessionStats.cubesCompleted +1 ────────────────┤
  ├─ handleJoin ────────────────────────► member created with zeros ────────────────────────────┤
  └─ removeMember (left) ───────────────► member removed ───────────────────────────────────────┤
                                                                                                ▼
                                                    mark server(s) dirty (per-server coalescer)
                                                                                                │
                                              setTimeout(1000) per dirty server (one timer)     │
                                                                                                ▼
                              build snapshot at flush from registry.forEachMember + Member stats
                                                                                                │
                                   broadcast(serverId, leaderboardUpdateMessage(snapshot))
                                          (encode once; same bytes to every member)
                                                                                                │
frontend: transport decoder ──► parseLeaderboardSnapshot / parsePlacement.leaderboard
          ──► reduceWorldState ──► WorldState.leaderboard (or pendingWorldSwap.leaderboard during travel)
          ──► App ──► Leaderboard (top five + totals)

welcome / worldEntered ──────────► placementPayload.leaderboard ──► same reducer/UI path (immediate snapshot)
```

## Interfaces / contracts

```ts
// protocol mirrors (backend + frontend)
export const LEADERBOARD_TOP_LIMIT = 5;

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  cubesCompleted: number; // non-negative integer
  clicks: number;         // non-negative integer
}

export interface LeaderboardSnapshot {
  serverId: number;
  at: number;
  entries: LeaderboardEntry[]; // ranked, 0…5, server order preserved
  totals: { cubesCompleted: number; clicks: number; facesDestroyed: number };
}

// ServerMessage addition (server-only)
| { type: 'leaderboardUpdate'; leaderboard: LeaderboardSnapshot }
// Placement addition
leaderboard?: LeaderboardSnapshot;

export function parseLeaderboardSnapshot(value: unknown): LeaderboardSnapshot | null;
export function copyLeaderboardSnapshot(snapshot: LeaderboardSnapshot): LeaderboardSnapshot;
export function leaderboardUpdateMessage(snapshot: LeaderboardSnapshot): ServerMessage; // validates + copies; throws TypeError

// backend game/leaderboard.ts
export const LEADERBOARD_INTERVAL_MS = 1000;
export interface LeaderboardMember {
  playerId: string;
  name: string;
  clicks: number;
  facesDestroyed: number;
  cubesCompleted: number;
}
export function buildLeaderboardSnapshot(
  serverId: number,
  at: number,
  members: readonly LeaderboardMember[], // registry/slot order
  limit?: number,                        // default LEADERBOARD_TOP_LIMIT
): LeaderboardSnapshot;

export interface LeaderboardCoalescer {
  markDirty(serverId: number): void;  // one timer per server; no-op when one is pending
  dropServer(serverId: number): void; // clears that server's timer
  discard(): void;                    // terminal: clears every timer
  pendingServers(): number;           // tests/observability
}
export function createLeaderboardCoalescer(options: {
  intervalMs: number;
  timers: TimerFns;                   // { setTimeout, clearTimeout } from broadcast.ts
  flush: (serverId: number) => void;  // invoked after the timer entry is cleared
}): LeaderboardCoalescer;

// exact representative encoded frame (field order pinned):
// {"type":"leaderboardUpdate","leaderboard":{"serverId":1,"at":1000,"entries":[{"playerId":"p1","name":"Player 1","cubesCompleted":2,"clicks":40}],"totals":{"cubesCompleted":2,"clicks":40,"facesDestroyed":3}}}

// frontend multiplayer/server-state.ts
export interface WorldState { /* …existing… */ leaderboard: LeaderboardSnapshot | null; }
export interface PendingWorldSwap { /* …existing… */ leaderboard: LeaderboardSnapshot | null; }
export function reduceWorldState(state: WorldState, msg: ServerMessage): WorldState; // adds welcome/worldEntered/leaderboardUpdate handling
export function applyWorldSwap(state: WorldState): WorldState;                        // applies the pending leaderboard

// frontend ui/Leaderboard.tsx
export const LEADERBOARD_VISIBLE_COUNT = 5;
export function pluralize(count: number, singular: string, plural: string): string;
export function leaderboardEntryText(entry: LeaderboardEntry): string;   // "2 cubes · 40 clicks"
export function leaderboardTotalsText(totals: LeaderboardSnapshot['totals']): string;
export function Leaderboard(props: {
  snapshot: LeaderboardSnapshot | null;
  reducedMotion?: boolean;
}): ReactElement | null;
```

### Pinned display text

| Element | Text |
| --- | --- |
| Entry score | `{pluralize(cubesCompleted, 'cube', 'cubes')} · {pluralize(clicks, 'click', 'clicks')}` |
| Totals | `Server totals: {cubes} · {clicks} · {pluralize(facesDestroyed, 'face', 'faces')}` |

`pluralize(0, 'cube', 'cubes')` → `0 cubes`; `pluralize(1, 'cube', 'cubes')` → `1 cube`; `pluralize(2, 'click', 'clicks')` → `2 clicks`.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/leaderboard.ts` | New | Pure ranking/snapshot builder and per-server coalescer; no hub/peer imports. |
| `src/backend/src/game/leaderboard.test.ts` | New | Ranking/tie-break/top-five/totals/copy unit tests; coalescer timing/drop/discard/pending tests. |
| `src/backend/src/game/protocol.ts` | Edit | `LEADERBOARD_TOP_LIMIT`, snapshot types, parser/copier/builder, `Placement.leaderboard`, `leaderboardUpdate` message. |
| `src/backend/src/game/protocol.test.ts` | Edit | Builder/validator matrix, exact frame, placement copy/absence and serverId cross-check, no client message. |
| `src/backend/src/game/hub.ts` | Edit | `Member.sessionStats`, increments, dirty marks, placement snapshot, coalescer creation/cleanup, publish. |
| `src/backend/src/game/hub.test.ts` | Edit | Counter/threshold/grace/move/join/reconnect/cadence/isolation/privacy/non-regression/shutdown integration tests. |
| `src/backend/src/observability/metrics.ts` | Edit | `leaderboardUpdate` in the two `type` allow-lists only. |
| `src/backend/src/observability/metrics.test.ts` | Edit | Catalog accepts the new type values; no new metric. |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirror constant/types/parser/copier/builder; `leaderboard` in `parsePlacement`. |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Valid/invalid snapshots, five-entry bound, serverId mismatch, legacy welcome, parity. |
| `src/frontend/src/multiplayer/server-state.ts` | Edit | `WorldState.leaderboard`, pending-swap leaderboard, welcome/worldEntered/leaderboardUpdate reduction, equal/no-op rules. |
| `src/frontend/src/multiplayer/server-state.test.ts` | Edit | Seed/replace/pending/swap/update/duplicate/mismatch/identity/travel-window tests. |
| `src/frontend/src/game/session.ts` | Edit | Explicit `leaderboardUpdate` case with no engine/scene action. |
| `src/frontend/src/game/session.test.ts` | Edit | Real transport + decoder + reducer snapshot chain; travel-window replacement. |
| `src/frontend/src/ui/Leaderboard.tsx` | New | Non-live `<aside>` panel with exact text, top-five cap, reduced-motion attribute. |
| `src/frontend/src/ui/Leaderboard.test.tsx` | New | Exact markup/text/plurals, null/empty, reduced motion, no live roles. |
| `src/frontend/src/App.tsx` | Edit | Render the panel in the welcomed shell; keep the single live region. |
| `src/frontend/src/App.test.tsx` | Edit | Populated/pre-welcome panel and single-live-region SSR assertions. |
| `src/frontend/src/ui/game-view.css` | Edit | Rounded chrome, left-rail placement, mobile placement, 160 ms entry, reduced-motion disables. |
| `src/frontend/src/ui/game-view.css.test.ts` | Edit | Placement/chrome/short-viewport/reduced-motion/no-`!important`/trailing-newline assertions. |
| `tests/e2e/smoke.mjs` | Edit | Welcome snapshots and the coalesced update check in `checkMultiplayerFlow`. |
| `docs/architecture/realtime.md` | Edit | `## Live leaderboard` contract and constants. |
| `docs/product/glossary.md` | Edit | `### live leaderboard` definition. |
| `docs/features/server-live-leaderboard/build-log-T5.md` | New | Final verification evidence. |

No change: `src/backend/src/app.ts` (the hub creates the coalescer from its existing deps), `src/backend/src/game/config.ts`, `src/backend/src/game/servers.ts`, `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`, `package.json`, `package-lock.json`, `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `docs/architecture/deployment.md`, `docs/features/README.md` (orchestrator-owned; propose the row, never edit), and every `.env*`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Counters live on `Member`, not in a separate map or a server aggregate | The member already survives grace, carries `playerId`/`name` across a move and is deleted on final removal; counters inherit exactly the right lifecycle with no second store to reconcile. | A server-level ledger (breaks on move; double-counts), a separate `Map<playerId, stats>` (a second lifecycle to clean up). |
| 2 | Build the snapshot at flush time from live members; no cached ranking | Totals and ranks can never drift from the roster; a move/removal is reflected in the next flush without invalidation. | Cached snapshots incrementally updated (stale-risk and more state), a client-side ranking (needs all counters on the wire and trusts the client). |
| 3 | One coalescing timer per dirty server at 1000 ms | Bounds output to one frame per server per window, publishes the final state within 1 s of the last change, creates no frame for a quiet server and no global tick; mirrors `createEconomyCoalescer`. | A global 1 Hz sweep (ticks idle servers), leading + trailing throttle (two frames close together), drop-not-queue (final state may never publish). |
| 4 | Rank cubes → clicks → slot order, top five, totals over all current members | Cubes are the achievement, clicks break ties by effort, slot order is deterministic and needs no extra wire field; totals remain a true server total even when the top five is capped. | Clicks-first (grinding), faces-first (odd), totals over the top five only (undercounts). |
| 5 | Exclude coins entirely | Coins are upgrade-scaled and account-only on the server; guest coins are local and guest upgrades are unknown, so a coin column is incomparable, leaks private economy and ranks upgrades. | Account-only coins (guest parity/privacy broken), server-computed pseudo-coins (mismatch with guest local balances). |
| 6 | Counters follow a mover; grace members stay ranked | A move only happens on a completion; resetting would erase that completion and punish rebalancing. Grace retention matches the roster and the retained slot. | Reset on move, drop on socket close (roster/ranking disagreement). |
| 7 | `welcome` and `worldEntered` carry the snapshot; `leaderboard` is optional in the type | Join, reconnect and cross-server entry need an immediate ranking; optional keeps legacy fixtures/mixed versions decoding. | Welcome only (a mover sees an empty/stale panel), required in the type (fixture churn, no runtime benefit). |
| 8 | Snapshot lives in `WorldState`, including `pendingWorldSwap.leaderboard` | One store and one publish path; the reducer already models server switches and the travel midpoint, so the leaderboard follows the same semantics as activity. | A separate session store (duplicates server-switch logic), React-only state (unavailable to reducer tests). |
| 9 | `<aside aria-live="off">`, no live roles, no controls | The shell keeps exactly one polite/assertive live region; the ranking is readable on demand as a normal list without competing announcements. | `role="log"`/`aria-live="polite"` (a second live region), a focusable disclosure (extra interaction for an M feature). |
| 10 | Left rail below the HUD on desktop, below the activity feed on mobile, `pointer-events: none`, with a short-viewport `max-height` cap | Uses the only free band on desktop and stays below the feed's max height on mobile; adds no keyboard stop and changes no existing placement. The `max-height: 600px` rule reduces the very-short-viewport footprint; the upgrades panel may still visually cover the lower rows, but the content stays in the DOM/accessibility tree. | Bottom-left (collides with upgrades on mobile), top-right (collides with the user panel on narrow screens), top-center (competes with the feed), a collapsible panel (extra interaction for an M feature). |
| 11 | `leaderboardUpdate` added to the two metrics `type` allow-lists, no new metric | `broadcast` already increments both with `{ type }`; an unlisted value throws. Allow-listing is the minimal correct change. | A new metric (catalog noise), skipping the increment (a divergent outbound path). |
| 12 | Extend the existing A/B/C smoke flow | Real wire proof of the welcome snapshot and a coalesced update with no new fixed wait; the existing grace and timeouts cover the timing. | Unit/integration only (no wire proof), a dedicated long smoke flow (slower/flakier). |
| 13 | Docs in `realtime.md` + glossary; feature index proposed | The outbound-path contract already lives in `realtime.md`; a new doc would fragment it. The index is orchestrator-owned. | A new architecture document (overhead), editing the index (ownership violation). |
| 14 | No protocol version bump | Additive message + optional field; an old client drops the unknown frame and ignores the extra field, a new client against an old backend renders nothing. | A version bump (coordination overhead for an additive change). |
| 15 | Per-member `facesDestroyed` is summed into totals but not sent in entries | The ranking score is cubes/clicks; a third per-row counter adds UI clutter without changing the order, while the server total still exposes face activity. | Per-entry faces (larger rows), no face counter at all (the scope asks for faces). |

## Risks & mitigations

- **Existing hub tests see extra frames after timer advances** → T2 records the new frame in the affected expectations or filters by `type === 'leaderboardUpdate'` with an explicit helper when the test is not about the leaderboard; no assertion is weakened. Tests that already clear peers before advancing are unaffected. The full backend suite is the gate.
- **Timer leak on server destroy/shutdown** → `dropServer` on a destroying move/removal, `discard()` in `hub.close()`, and an explicit `vi.getTimerCount() === 0` after close; `publishLeaderboard` also returns when the server has no members or the hub is closed.
- **Stale ranking/totals** → no cached snapshot; build at flush from `registry.forEachMember` + `Member.sessionStats`; totals are derived, so a move/removal cannot leave a ghost entry.
- **Double-count or under-count on a move** → increment `cubesCompleted` exactly once after `isComplete`; the old server's snapshot is built without the mover; the new server's snapshot includes the incremented member; tests pin both sides and a destroying move.
- **Guest/account divergence** → both are `Member` records and both use the same increment points; the builder never reads `accountId` or `economy`; a guest/account parity test with identical actions.
- **Coins/privacy leak** → the payload has no coin/account/upgrade fields; a privacy scan restricted to `leaderboardUpdate` and the `leaderboard` placement objects; the welcome envelope's existing `token`/`identity.accountId` are explicitly exempt.
- **Cross-server leak** → every snapshot/flush is keyed by `serverId`; the reducer rejects a mismatched server; a two-server test and a mover test; the old timer is dropped when the old server is destroyed.
- **Second live region / screen-reader fighting** → `aria-live="off"`, no live roles and an App SSR count of polite/assertive regions; the phase announcement remains the only one.
- **CSS conflict with the activity feed/HUD** → the desktop top (`12.5rem`) is below the HUD and the feed's content height; the mobile top (`17rem`) is below the feed's max height (`10rem + 6rem`); CSS tests pin the values and assert existing selectors are unchanged.
- **Short mobile viewport clipping** → the mobile `max-height: 18vh` and the `@media (max-width: 720px) and (max-height: 600px)` `max-height: 12vh` cap reduce, but do not eliminate, the visual overlap with the upgrades panel on very short viewports; the lower rows may be covered by the upgrades panel, which paints above. All five rows and the totals remain in the DOM/accessibility tree, the panel is non-interactive, and the existing upgrades panel keeps its placement. A `game-view.css.test.ts` assertion pins the short-viewport rule; a collapsible mobile variant is a possible follow-up (Q-4 placement alternative), not part of this feature.
- **Protocol drift between mirrors** → both mirrors implement the shared validation matrix; a parity test replays the backend valid/invalid fixtures; the exact representative frame is pinned; the frontend rejects a `leaderboard.serverId` that differs from the enclosing placement.
- **Smoke flakiness** → the new check scans `client.history` first and otherwise waits within the existing `MULTIPLAYER_TIMEOUT_MS`; it asserts `clicks >= 3` rather than an exact count (an earlier coalesced frame with fewer clicks may exist) and never assumes the next frame is the leaderboard frame.
- **Snapshot payload growth** → five entries plus three totals is small; the field is optional in the type for mixed versions; no server frame cap changes.
- **Reducer fixture churn** → `leaderboard` is required in `WorldState` (clear contract) and optional on the wire (legacy); T3 owns the reducer/session fixtures, T4 owns the App fixture; update minimally.
- **Rollback divergence** → the message is additive and the field optional; backend-first and frontend-first deploy orders are both safe.

## Rollback

- **Backend-first rollback**: remove the `leaderboardUpdate` union/builder/parser/copier, the `leaderboard` field from `Placement`/`placementPayload`, `game/leaderboard.ts`, the hub `sessionStats`/increments/marks/coalescer/publish, and the two metrics allow-list values. No schema, persistence, container or config change exists to roll back. An old frontend already drops the unknown frame and ignores the extra field.
- **Frontend-first rollback**: remove the `Leaderboard` component/render/CSS, `WorldState.leaderboard`/`pendingWorldSwap.leaderboard`, and the `leaderboardUpdate` case; a new frontend against an old backend decodes a placement without `leaderboard` as `null` and renders nothing.
- **Operational rollback**: none needed — the leaderboard is process memory only, has no feature flag and no stored data; a restart clears it.
- **Docs**: revert the `## Live leaderboard` section and the glossary entry in the same rollback change; the feature index row is orchestrator-owned.

## Containerization impact

No new service, image, deployable, port, host mapping, environment variable, healthcheck or dependency. The `leaderboardUpdate` frame and the `leaderboard` placement field travel on the existing `GET /ws` WebSocket endpoint on backend port 8080; `GET /healthz` and the upgrade path are unchanged. `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile` and `src/frontend/Dockerfile` are untouched, and `podman compose up` remains the single local command. The containerized proof reuses `tests/e2e/smoke.mjs` and its existing backend/1 s grace; no service or timing knob is added. No settled convention in `docs/architecture/containerization.md` is reopened. The Vercel/Fly/Neon deployment feature remains blocked at T7 and is not touched.

## Open questions

See `spec.md` § Open questions. The four approval items are Q-1 (cubes → clicks → slot order), Q-2 (coins excluded from ranking, wire and totals), Q-3 (counters follow a mover; grace members stay ranked) and Q-4 (left rail below the HUD / below the activity feed on mobile, with the short-viewport cap). Q-5 (top five + all-current-member totals), Q-6 (1 s per-server coalescing), Q-7 (`worldEntered` snapshot), Q-8 (separate multi-tab rows), Q-9 (faces in totals only), Q-10 (metrics allow-list), Q-11 (docs home), Q-12 (containerized proof), Q-13 (no timestamp display) and Q-14 (solo/empty panel) are technical defaults recorded here and in `spec.md`.
