---
feature: server-live-leaderboard
revision: 2
status: draft
created: 2026-11-16
updated: 2026-11-16
---
# Spec — Server Live Leaderboard

## Summary

CubeClicker is online, real-time and server-authoritative, but a member currently has no shared, at-a-glance view of how the people on the same **game server** are doing. The roster (`memberJoined`/`memberLeft`) says who is present and the activity feed says what just happened; neither ranks anyone. This feature adds a small, shippable **per-server live leaderboard**: the hub keeps session counters for every member (accepted clicks, faces cleared, cubes completed) derived only from transitions it has already validated, ranks the server's current members by cubes completed then clicks with a deterministic tie-break, shows the top five plus server-wide totals, and publishes an additive `leaderboardUpdate` snapshot at most once per second per server through the existing encode-once fan-out. `welcome` (join and reconnect) and `worldEntered` (cross-server move) carry the current snapshot, so a member never waits for the next tick to see the ranking. The frontend stores the snapshot in `WorldState.leaderboard`, routes target-server updates into `pendingWorldSwap` during travel, and renders a non-interactive `Leaderboard` panel with accessible, non-live markup and a reduced-motion variant. Only session counters are used: guests and accounts compete on exactly the same basis, no persisted account totals are read, no coins are ranked or exposed, and nothing is persisted. No new service, dependency, database, protocol version or identity change is added. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one" and "Proceed with server-live-leaderboard"; this is the next approved feature in the audit queue after `live-activity-feed`.

## Context and audit evidence

Verified against the current tree at planning time:

- `src/backend/src/game/hub.ts` `handleExplode` — a click is admitted only after the trailing-second rate limit and `validateExplode`; the accepted id is added to `member.cube.removedIds` synchronously and the existing face-clear predicate (`faceCleared`) already computes whether the clicked face is fully removed. These are the exact accepted-click and face-clear points a per-member counter can increment from; invalid, rate-limited, oversized and `not_joined` attempts never reach them.
- `src/backend/src/game/hub.ts` `handleCompletion` — `isComplete` gates an accepted full-board completion, `member.cube.levelIndex + 1` is the completed 1-based cube number, and a cross-server move executes through `registry.moveMember` (the member's `playerId`, token and `Member` record survive). The completion is the exact point a `cubesCompleted` counter increments; a completion that moves must attribute the counter to the member, not to a server.
- `src/backend/src/game/hub.ts` `handleJoin` / `handleRejoin` / `removeMember` / `handleClose` — a member is created on `join`, survives a socket close through `RECONNECT_GRACE_MS`, resumes on `rejoin`, and is finally removed on grace expiry (or moves away on a completion). Counters therefore belong on the `Member` record, which already outlives grace and travels with a move; the server roster (`registry.forEachMember`) is the only list that defines who is on a server.
- `src/backend/src/game/hub.ts` `broadcast` — the existing encode-once fan-out (feature `realtime-broadcast-batching`) is the correct delivery path; a `leaderboardUpdate` must not reintroduce per-recipient encoding or a per-client queue. `broadcast` emits one `messages_encoded` increment and one `frames_sent` increment per recipient.
- `src/backend/src/game/broadcast.ts` — `createRemovalBatcher` (one 40 ms timer, per-player groups) and `createEconomyCoalescer` (one timer per account, highest revision wins) are the established coalescing pattern with injected `TimerFns`; the leaderboard reuses the same shape (one timer per dirty server) rather than a global tick or a per-click frame.
- `src/backend/src/game/activity.ts` — the per-server activity feed proves the per-server snapshot + `welcome`/`worldEntered` carrier pattern and the "no cross-server state" rule. The leaderboard uses the same snapshot carrier but a **coalescing timer** instead of the feed's drop-not-queue gate, because a leaderboard must publish the final state after the last change; it does not modify the feed.
- `src/backend/src/game/protocol.ts` — one `ServerMessage` catalog, one `encodeServerMessage`, one shared `placementPayload` for `welcome`/`worldEntered`, and a client catalog with no leaderboard message. `Placement` already carries an optional `activity` field; the leaderboard adds an optional `leaderboard` field beside it.
- `src/backend/src/observability/metrics.ts` — `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total` have a closed `type` allow-list; an unlisted `leaderboardUpdate` label value throws at runtime, so the catalog needs exactly two allow-list entries and no new metric.
- `src/frontend/src/multiplayer/server-state.ts` — `WorldState` is the single store for everything the server broadcasts about a client's server; `welcome` replaces it, `worldEntered` records a pending swap, `applyWorldSwap` applies the target world at the travel midpoint, and `activityEvent` demonstrates server-keyed routing. The leaderboard follows the same server-switch semantics.
- `src/frontend/src/game/session.ts` — `handleServerMessage` reduces every frame into `world` and calls `publishMultiplayer()`; `activityEvent` already has an explicit no-op engine/scene case. A `leaderboardUpdate` needs the same explicit case and no engine/scene action.
- `src/frontend/src/ui/ActivityFeed.tsx` / `src/frontend/src/App.tsx` — the shell has exactly one live region, `.phase-announcement` (`role="status"`, `aria-live="polite"`); the feed is a non-interactive `<aside aria-live="off">`. The leaderboard must follow that accessibility pattern and must not add a second live region.
- `src/frontend/src/ui/game-view.css` / `src/frontend/src/ui/app.css` — the occupied screen bands are: HUD top-left, connection banner top-center, activity feed top-center below the banner (`top: 4.25rem`; `top: 10rem` on mobile), Users on Server top-right, customization toggle bottom-left, upgrades panel bottom-right (full-width on mobile), phase announcement bottom-center. The leaderboard takes the free left band below the HUD on desktop and below the activity feed on mobile; it changes no existing selector's placement.
- `src/frontend/src/ui/UpgradesPanel.tsx` — the upgrades panel is always rendered when welcomed, so the mobile leaderboard must not claim the bottom band; it is placed above it and is visual-only (non-interactive, `pointer-events: none`).
- `tests/e2e/smoke.mjs` `checkMultiplayerFlow` — already runs A/B/C clients with `maxUsers 2` and a 1 s grace: A joins, B joins, C overflows, A sends one accepted `explode` and a two-id burst, B closes and A receives `memberLeft`. This is the natural containerized proof for the welcome snapshot and a live coalesced leaderboard frame with no new fixed wait.
- The stack is one backend process with in-memory rooms; Postgres exists only for accounts/economy. No Redis, queue, microservice or leaderboard persistence exists, and none is added. The Vercel/Fly/Neon deployment feature is blocked at T7 and is not touched.

## User stories

- As a player, I want to see who is leading on my server right now, so I can compare my progress with the people whose cubes I can see.
- As a guest, I want to compete on the same leaderboard as accounts, so I am not excluded for not having an account.
- As a returning or reconnecting player, I want the current ranking in my `welcome`, so I do not rejoin into a stale or empty panel.
- As a player on a busy server, I want at most one calm ranking update per second, never a frame per click, so the panel does not flood the socket or the screen.
- As a screen-reader user, I want the ranking readable on demand as a normal list without a second live region interrupting the game.
- As a player who prefers reduced motion, I want ranking changes to appear without animation.
- As a maintainer, I want the ranking derived only from validated server counters, keyed per server, bounded in memory and rate, and provable by unit, integration and containerized tests.

## Metric definitions and ranking

All counters are **session counters**: they start at 0 when the member is created on `join`, survive a socket close and `rejoin` inside the grace window, and are removed with the member on final removal or lost with the process on restart. They are never read from or written to `user_economy`, and they are identical in shape for guests and accounts.

| Counter | Exact increment point | Exact rule |
| --- | --- | --- |
| `clicks` | `handleExplode`, after the rate limit admits the attempt and `validateExplode` succeeds | +1 per accepted `explode`. An invalid click (`invalid_click`), a rate-limited attempt, an oversized/malformed frame and a pre-join message never increment. A click on a face's last remaining mini-cube increments both `clicks` and `facesDestroyed`. |
| `facesDestroyed` | `handleExplode`, after the accepted id is added to the member's `removedIds` | +1 iff the existing face-clear predicate is true (all `N²` ids of the clicked face are now in `removedIds`). At most 6 per cube; a click that clears the cube's last face also increments `clicks`, and the following completion increments `cubesCompleted`. |
| `cubesCompleted` | `handleCompletion`, after `isComplete` succeeds and the completed 1-based cube number is captured | +1 per accepted `cubeCompleted`, including a completion that executes a cross-server move. An `invalid_completion` and an incomplete board never increment. |

**Coins are deliberately excluded.** Coin income is upgrade-scaled (`miniCubeMultiplier`/`cubeMultiplier`) and only server-authoritative for accounts; a guest's coins live locally, and the server does not know the guest's local upgrade levels. A coin column would therefore compare an account's persisted, upgrade-inflated income with a guest's local income, would leak a value that is currently private to each account, and would rank upgrades rather than play. The leaderboard ranks and totals no coins at all; account persisted totals (`member.economy`, `user_economy`) are never read. A future coin metric would need a product decision on guest coins and upgrade normalization, not a leaderboard change.

**Ranking.** The server ranks the server's **current members** (the registry's occupied slots, including members inside the reconnect grace window) with the following total order:

1. `cubesCompleted` descending;
2. `clicks` descending;
3. ascending server slot order (the deterministic order in which `registry.forEachMember` visits occupied slots; the registry assigns lower free slots first, so a fresh server's equal-score members are in `playerId` order).

The top `LEADERBOARD_TOP_LIMIT = 5` entries are sent, in rank order. Server **totals** are the sums of `cubesCompleted`, `clicks` and `facesDestroyed` over **all current members**, not just the top five. A member outside the top five still contributes to the totals. Ties at the top-five cutoff are resolved by the same total order (slot order), never by arrival of a frame or by name collation.

**Membership semantics.** A member in reconnect grace keeps their rank and counters (the roster already keeps them). A member who moves to another server takes their own session counters with them: the target server's snapshot includes them and the old server's totals are recomputed without them. A member who is finally removed drops out of the ranking and totals. No server ever reads another server's ranking or totals, and no global/all-time aggregate exists.

**Coalescing cadence.** A counter or membership change marks that server dirty and schedules exactly one flush at `LEADERBOARD_INTERVAL_MS = 1000` if no flush is already pending for that server. Further changes inside the window are included in the pending flush; they do not schedule another. At the flush the hub builds the snapshot from the server's live members at that moment and broadcasts one `leaderboardUpdate` through the existing encode-once path. A quiet server emits no frame; a rejoin, rotate, purchase, loot open or equip is not a counter change and emits nothing. A change after a flush starts a new window. `welcome` and `worldEntered` carry the current snapshot immediately, so the panel is never empty at join, reconnect or cross-server entry.

## Wire contract (pinned)

```ts
export const LEADERBOARD_TOP_LIMIT = 5;

export interface LeaderboardEntry {
  playerId: string;          // server-issued, already public in the roster
  name: string;              // guest `Player N` or the account username, already public
  cubesCompleted: number;    // non-negative integer, session
  clicks: number;            // non-negative integer, session
}

export interface LeaderboardSnapshot {
  serverId: number;          // positive integer; the cross-server guard
  at: number;                // finite non-negative hub clock value
  entries: LeaderboardEntry[]; // ranked, 0…5 entries, server order preserved
  totals: {
    cubesCompleted: number;  // non-negative integer, over all current members
    clicks: number;          // non-negative integer, over all current members
    facesDestroyed: number;  // non-negative integer, over all current members
  };
}

// ServerMessage addition (server-to-client only; the client catalog is unchanged)
| { type: 'leaderboardUpdate'; leaderboard: LeaderboardSnapshot }

// Placement (welcome + worldEntered)
leaderboard?: LeaderboardSnapshot; // optional in the type for legacy decode; always emitted by the backend
```

The pinned representative frame is:

```json
{"type":"leaderboardUpdate","leaderboard":{"serverId":1,"at":1000,"entries":[{"playerId":"p1","name":"Player 1","cubesCompleted":2,"clicks":40}],"totals":{"cubesCompleted":2,"clicks":40,"facesDestroyed":3}}}
```

### Protocol validation matrix

Both mirrors enforce the same rules. The backend builder throws `TypeError` on any invalid payload; the frontend decoder returns `bad_message` and drops the frame. Unknown extra fields are dropped, and the parsed object is always a fresh copy of the pinned shape.

| Field | Valid rule | Invalid examples |
| --- | --- | --- |
| `serverId` | positive integer | missing, `0`, `-1`, `1.5`, `"1"`, `null` |
| `at` | finite number ≥ 0 | missing, `-1`, `NaN`, `Infinity`, `"0"`, `null` |
| `entries` | array of 0…5 valid entries | missing, non-array, 6 entries, an invalid entry |
| `entries[].playerId` | non-empty string | missing, `""`, `null`, a number |
| `entries[].name` | non-empty string | missing, `""`, `null`, a number |
| `entries[].cubesCompleted` | non-negative integer | missing, `-1`, `1.5`, `NaN`, `"1"`, `null` |
| `entries[].clicks` | non-negative integer | missing, `-1`, `1.5`, `NaN`, `"1"`, `null` |
| `totals` | object with the three counters | missing, `null`, an array |
| `totals.cubesCompleted` / `totals.clicks` / `totals.facesDestroyed` | non-negative integer | missing, `-1`, `1.5`, `NaN`, `"1"`, `null` |
| `leaderboard` inside `welcome`/`worldEntered` | absent → `null`; present → valid snapshot whose `serverId` equals the enclosing placement's `serverId` | non-object, over-long entries, mismatched `serverId` |

## Acceptance criteria

### Counters and authority

- **AC-1 — Accepted click counters.** A valid accepted `explode` increments that member's `clicks` by exactly 1 and increments `facesDestroyed` by exactly 1 iff the click clears the last remaining mini-cube of its face (the existing `faceCleared` predicate). An `invalid_click`, a rate-limited attempt, an oversized/malformed frame and a pre-join message increment neither counter; the existing `error`/`stateSync` replies are unchanged. A click that clears a face increments both `clicks` and `facesDestroyed`; a click that does not clear a face increments only `clicks`.
- **AC-2 — Accepted completion counter.** A valid accepted `cubeCompleted` increments that member's `cubesCompleted` by exactly 1, including a completion that executes a cross-server move. An `invalid_completion` and an incomplete board increment nothing. The mover's target entry carries the incremented count; the old server's entries/totals no longer include the mover.
- **AC-3 — Guest/account parity and no account totals.** A guest and an account that perform the same accepted actions on the same server have identical counters, ranks and entries regardless of `accountId`. The snapshot is built only from the `Member` session counters; it never reads `member.economy`, `user_economy`, coins, upgrades or customization, and two members with the same accepted actions and slot order produce the same snapshot in both guest and account modes.
- **AC-4 — No client counter input.** The client catalog contains no message that creates, sets, adds or names a leaderboard counter. A client frame with `type: 'leaderboardUpdate'` (or any unknown type) decodes to `bad_message` and changes no counter, snapshot or state.

### Snapshot and ranking

- **AC-5 — Snapshot shape, top-five and totals.** A server with more than five current members returns a snapshot whose `entries` is exactly the five highest-ranked members in rank order (never six) and whose `totals` are the sums of `cubesCompleted`, `clicks` and `facesDestroyed` over **all** current members, including those outside the top five and those inside reconnect grace. A server with fewer than five members returns every current member. `serverId` is the server's id and `at` is the hub's injected clock value at build time.
- **AC-6 — Ranking and tie-breaks.** Entries sort by `cubesCompleted` descending, then `clicks` descending, then ascending server slot order. A member with 1 cube and 0 clicks ranks above a member with 0 cubes and 100 clicks; a member with 1 cube and 5 clicks ranks above one with 1 cube and 4 clicks; two members with equal cubes and clicks rank in slot order (the lower slot first). At a tie for the fifth/sixth place, the lower-slot member is included and the higher-slot member is omitted.
- **AC-7 — `welcome` and reconnect snapshot.** `welcome` on a fresh join and on a rejoin carries `leaderboard` = the server's current snapshot as a deep copy. A fresh join's snapshot includes the joiner with zero counters and every existing member's current counters; a rejoin after a disconnect carries the counters accumulated by all members while the socket was closed, and the rejoiner's own counters are unchanged. A legacy `welcome` without `leaderboard` decodes with `leaderboard: null`.
- **AC-8 — `worldEntered` snapshot and travel window.** `worldEntered` carries the target server's current snapshot; the mover's entry includes the completion that caused the move. The pending swap stores it; a target-server `leaderboardUpdate` received between `worldEntered` and `applyWorldSwap` replaces `pendingWorldSwap.leaderboard` (deep copy) and leaves the current snapshot untouched; `applyWorldSwap` applies the pending snapshot. An old-server `leaderboardUpdate` received during travel applies to the current snapshot (when its `serverId` matches the current server) and never to the pending target snapshot.

### Cadence and delivery

- **AC-9 — One coalesced flush per server per second.** An accepted counter or membership change at `t` with no pending flush marks the server dirty and schedules exactly one flush at `t + 1000` (`LEADERBOARD_INTERVAL_MS`). With a manual clock and fake timers, a change at `t` plus changes at `t + 500` produce no frame at `t + 999` and exactly one `leaderboardUpdate` at `t + 1000`, carrying the latest counters and `at = t + 1000`; a further change at `t + 1001` schedules a second flush at `t + 2001`. Ten accepted changes at 0, 100, …, 900 ms produce exactly one frame at 1000 ms with all ten counted, never ten frames.
- **AC-10 — Quiet servers and non-counter changes.** A server with no counter or membership change after a snapshot emits no `leaderboardUpdate` (only the `welcome`/`worldEntered` snapshot). A fresh join is a membership change and produces one coalesced frame; a rejoin, a rotate, a purchase, a loot open and an equip produce no leaderboard frame. A socket close (grace start) produces no frame and the member stays in the ranking; a final grace-expiry removal marks the server dirty, and the next flush drops the member and reduces the totals.
- **AC-11 — Encode-once and non-regression.** Every `leaderboardUpdate` is encoded exactly once (`JSON.stringify` spy count 1) and the identical text is delivered to every member of that server with an open socket, including the origin. The existing 40 ms removal batching and 250 ms economy coalescing produce the same pending state, timer behavior and frames before and after a leaderboard flush; no per-client queue, per-click frame or new tick is introduced.
- **AC-12 — Per-server isolation.** Snapshots are keyed by `serverId` and delivered only through that server's registry slot visitor. A client never receives another server's snapshot; the reducer ignores a `leaderboardUpdate` whose `serverId` matches neither `world.serverId` nor a pending swap's `serverId` with the same state reference. Two servers' snapshots never mix, and a mover receives the target snapshot and no old-server leaderboard after the move.
- **AC-13 — Cleanup and shutdown.** `dropServer(serverId)` clears that server's pending flush timer; a server destroyed by its last member's removal or move clears its leaderboard timer; `hub.close()` discards every leaderboard timer and state, no callback or frame occurs after close, and `vi.getTimerCount()` is 0 after close. The coalescer's `discard()` is terminal (`markDirty` and `dropServer` are no-ops afterwards). The number of pending flush timers never exceeds the number of live servers with a pending flush.

### Protocol

- **AC-14 — Backend builder and validator.** `leaderboardUpdateMessage(snapshot)` returns `{ type: 'leaderboardUpdate', leaderboard: <deep copy> }` with every field validated, and throws `TypeError` for any payload violating the shared validation matrix. `parseLeaderboardSnapshot(value)` accepts exactly the pinned shape, drops unknown extra fields and returns a fresh copy, and returns `null` for every invalid variant. `placementPayload` copies `leaderboard` into `welcome`/`worldEntered` and preserves absence (legacy fixtures omit it). The exact representative encoded frame is the one pinned in § Wire contract.
- **AC-15 — Mirror parity.** The backend and frontend mirrors expose the same `LEADERBOARD_TOP_LIMIT = 5`, `LeaderboardEntry`, `LeaderboardSnapshot`, the `leaderboardUpdate` server message, `parseLeaderboardSnapshot`, `copyLeaderboardSnapshot` and `leaderboardUpdateMessage`. The frontend parses every backend-encoded valid snapshot and rejects every invalid variant in the shared matrix with `bad_message`; a `welcome`/`worldEntered` with an invalid, over-long or server-mismatched `leaderboard` is `bad_message`; a legacy placement without `leaderboard` still decodes. A parity test replays the backend builder's valid and invalid fixtures rather than maintaining a separate list.
- **AC-16 — Metrics allow-list.** With a metrics-injected hub, one broadcast `leaderboardUpdate` increments `cubeclicker_ws_messages_encoded_total{type="leaderboardUpdate"}` by 1 and `cubeclicker_ws_frames_sent_total{type="leaderboardUpdate"}` by the recipient count without throwing. The catalog adds only those two `type` allow-list values and no new metric; an unlisted type still throws.

### Frontend state

- **AC-17 — `WorldState` snapshot.** `createWorldState()` starts with `leaderboard: null`. `welcome` sets `leaderboard` from the message as a deep copy, or `null` when the field is absent, and replaces any previous snapshot. `worldEntered` stores the target snapshot in `pendingWorldSwap.leaderboard` without changing the current snapshot. `applyWorldSwap` replaces the current snapshot with the pending one (or `null`) and clears the pending swap.
- **AC-18 — `leaderboardUpdate` reduction.** While a swap is pending, a snapshot whose `serverId` equals `pendingWorldSwap.serverId` replaces `pendingWorldSwap.leaderboard` (deep copy) and leaves the current snapshot untouched. A snapshot whose `serverId` equals `state.serverId` replaces `state.leaderboard` (deep copy). A snapshot matching neither returns the same state reference. An identical snapshot (same `serverId`, `at`, entries and totals) returns the same state reference, and a change replaces only the leaderboard branch (`self`, `members` and `activity` keep their identity).
- **AC-19 — Session chain.** With a fake WebSocket, the exact backend-encoded `welcome` (carrying `leaderboard`) and a subsequent `leaderboardUpdate` frame pass through the real transport decoder, the real `reduceWorldState` and the session's multiplayer snapshot; `getMultiplayerSnapshot().world.leaderboard` is the expected snapshot. A cross-server `worldEntered` followed by a target-server `leaderboardUpdate` before the travel midpoint updates `pendingWorldSwap.leaderboard`, and the travel-midpoint `applyWorldSwap` applies it. `leaderboardUpdate` produces no engine or scene action.

### UI and accessibility

- **AC-20 — Panel markup and text.** With a non-null snapshot, `Leaderboard` renders exactly one `<aside class="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion="true|false" data-server-id="…">` containing `<h2 class="leaderboard-title">Leaderboard</h2>`, an `<ol class="leaderboard-list">` of at most the five server-ranked `<li data-rank="1…5" data-player-id="…">` rows in server order, each with `#<rank>`, the name and the exact score text (`2 cubes · 40 clicks`, `1 cube · 1 click`, `0 cubes · 0 clicks`), plus a `<p class="leaderboard-totals">` with the exact text `Server totals: 2 cubes · 40 clicks · 3 faces`. A `null` snapshot or an empty `entries` array renders `null`. The component does not re-sort entries.
- **AC-21 — Single live region and no interaction.** The panel contributes no live-region semantics: its markup contains no `role="status"`, `role="alert"` or `role="log"` and no `aria-live` other than `off`. It has no focusable control. App SSR with a populated leaderboard contains exactly one polite/assertive live region, the existing `.phase-announcement` (`role="status"`, `aria-live="polite"`); the leaderboard's `aria-live="off"` does not count.
- **AC-22 — Reduced motion.** With `reducedMotion` true the panel root has `data-reduced-motion="true"` and `.leaderboard li` has no animation; with false, newly mounted rows use the 160 ms entry animation. `game-view.css` disables the animation independently for `.leaderboard[data-reduced-motion='true'] li` and for `.leaderboard li` inside `@media (prefers-reduced-motion: reduce)`. The content remains fully readable in both variants.
- **AC-23 — Placement and short-viewport behavior.** `game-view.css` adds `.leaderboard` to the rounded-chrome and pseudo-element reset groups and places it as a non-interactive left rail (`pointer-events: none`) below the HUD: `top: calc(12.5rem + env(safe-area-inset-top, 0px))`, `left: calc(1rem + env(safe-area-inset-left, 0px))`, `width: min(17rem, calc(100vw - 2rem))`, `max-height: 40vh`. Under `max-width: 720px` it moves below the activity feed: `top: calc(17rem + env(safe-area-inset-top, 0px))`, `width: min(14rem, calc(100vw - 2rem))`, `max-height: 18vh`. A short-viewport rule (`@media (max-width: 720px) and (max-height: 600px)`) caps it at `max-height: 12vh` with a smaller font. The panel does not overlap the HUD, connection banner, activity feed or user panel at any width. On very short mobile viewports the lower rows may be visually clipped behind the upgrades panel, which paints above the leaderboard; all five rows and the totals remain in the DOM and the accessibility tree, and the upgrades panel keeps its placement. The existing `.hud-panel`, `.connection-banner`, `.activity-feed`, `.user-panel`, `.customization-toggle`, `.upgrades-panel` and `.phase-announcement` placements are unchanged; there is no `!important` and the file keeps one trailing newline.

### Privacy, proof and gates

- **AC-24 — Privacy and authority.** Every snapshot originates from the hub's validated transitions and carries only `serverId`, `at`, server-issued `playerId`/`name` and integer session counters. No `leaderboardUpdate` frame and no `leaderboard` object inside `welcome`/`worldEntered` contains `accountId`, token, email, IP, coins, upgrade levels, appearance, free text or any client-supplied string. An encoded scan restricted to those frames/objects contains none of the test token/email/accountId values (the `welcome` envelope's own `token` and `identity.accountId` are exempt and unchanged). The client catalog still has no leaderboard message.
- **AC-25 — Containerized proof and documentation.** `tests/e2e/smoke.mjs` extends the existing `checkMultiplayerFlow`: A's `welcome.leaderboard` is a one-entry snapshot for A with zero counters and zero totals on A's server; B's `welcome.leaderboard` has exactly A and B with zero counters and zero totals; after A's single and two-id burst explodes, A receives a coalesced `leaderboardUpdate` whose `serverId` is A's server, whose A entry has `clicks >= 3`, whose B entry has `clicks = 0`, whose both entries have `cubesCompleted = 0`, and whose totals have `clicks >= 3`; every existing smoke check stays green. `docs/architecture/realtime.md` gains a `## Live leaderboard` section documenting the counters, ranking and tie-breaks, the 1 s coalescing, the `welcome`/`worldEntered` snapshot, grace/move semantics, per-server isolation, privacy, accessibility and rollback; `docs/product/glossary.md` gains a `### live leaderboard` entry. Every relative link resolves; `docs/features/README.md` is proposed to the orchestrator but not edited; `README.md`, `compose.yaml`, `compose.smoke.yaml`, the Dockerfiles and the package files are unchanged.
- **AC-26 — Quality gates.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (statements, branches, functions and lines all ≥ 80 per workspace), `npm run build` and `npm run smoke` all exit 0. No new npm dependency is added; `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`, `package.json` and `package-lock.json` are unchanged.

## Non-goals

- No global, cross-server, all-time, seasonal or account-wide leaderboard; no persisted ranking, database table, file or cache; the ranking is per game server and per backend process.
- No ranking by persisted account totals, lifetime `user_economy` values, coins, upgrades or any account-only metric; no economy change.
- No coin column, coin total or coin payload; coins are excluded for the fairness/privacy reasons in § Metric definitions.
- No new service, queue, worker, image, port, environment variable, health signal, deployable or dependency; the Vercel/Fly/Neon deployment feature stays blocked and untouched.
- No activity-feed changes; no free-text chat, custom names, moderation or user-authored leaderboard text.
- No per-click leaderboard frame, no per-client outbound queue and no global 1 Hz tick that broadcasts to idle servers.
- No protocol version bump; an unknown frame is dropped by an old decoder and a missing field decodes as absent.
- No identity or account change; guests remain first-class and multi-tab accounts remain separate members (one connection = one member).
- No UI redesign, Tailwind, navigation, interactive leaderboard controls or mobile-only interaction; the panel is read-only and non-interactive.
- No change to the upgrades panel or activity feed to reserve space on short mobile viewports; the leaderboard yields visually to the existing panels while all of its content stays in the DOM and the accessibility tree.
- No new metric, dashboard or alert; only the two `type` allow-list values required to avoid a production throw.
- No new smoke wait/timing assumption beyond the existing 1 s grace flow and the 1 s coalescing window.
- No self-rank highlight, personal best or history; the panel shows the top five and server totals only.

## Boundaries

- ✅ Always: keep the hub the only authority; increment counters only after the existing validation succeeds; keep counters on the `Member` record so grace and moves are consistent; key every snapshot and flush by `serverId`; use the injected clock and timers (fake timers in tests); coalesce to one frame per server per second; build the snapshot at flush time from live members; include the top-five snapshot in `welcome` and `worldEntered`; keep the shell's single live region; honor reduced motion; update docs in the same change; run the full gate.
- ⚠️ Ask first: changing the 1 s interval, the top-five cap, the ranking order or tie-breaks, the coin exclusion, the grace/move semantics, the totals scope, the `leaderboard`/`leaderboardUpdate` wire shape, the placement values; adding a dependency, npm script or CI gate; changing the smoke flow's timing.
- 🚫 Never: accept a client-supplied counter or name; rank by persisted account totals or coins; put `accountId`, tokens, emails, IPs, coins, upgrades or free text in the snapshot; add a per-client queue or persistence; add a second live region; regress the encode-once fan-out or the 40 ms/250 ms paths; edit `.env*` or commit secrets; weaken assertions or exclude the new modules from coverage; `git push`.

## Security considerations

- **User-controlled data.** The only strings in the snapshot are the server-issued `playerId` and the member's display name (guest `Player N` or the account username already broadcast in the roster). There is no free text, and the client catalog has no leaderboard message.
- **Decoder integrity.** The frontend validates every field, bounds `entries` to five, requires non-negative integers, drops unknown fields and hands the reducer a fresh copy. React renders names as text (no `innerHTML`).
- **Persistence integrity.** There is no persistence, migration or stored state; a restart clears every counter and snapshot. No client input reaches a database write because of this feature.
- **Memory and amplification.** At most five entries plus three totals per snapshot; at most one frame per server per second; one timer per dirty server, cleared on server destruction and hub close; no per-client queue. The number of timers is bounded by the live server count, which is bounded by the connection cap and per-server capacity.
- **Privacy.** No `accountId`, token, email, IP, query string, coins, upgrade levels, appearance or free text; only server-issued public names, ids and integer activity counters. Guests and accounts expose exactly the same fields.
- **Dependencies/secrets.** No new dependency, secret or environment variable; the metrics change is an allow-list addition only.

## Real-time contract

**Server authority.** The hub increments every counter after its existing validation succeeds (an admitted and valid `explode`, a full-board `cubeCompleted`) and builds every snapshot from its own `Member` records. There is no client message that sets, adds or names a counter, and the client uses the server order verbatim.

**Connection lifecycle.** A member's counters exist from `join` until final removal. A socket close starts the existing reconnect grace and emits no leaderboard frame; the member keeps their counters and rank during grace. A successful `rejoin` restores the same member and counters and sends the current snapshot in `welcome`. Grace expiry marks the server dirty and the next coalesced frame drops the member and recomputes the totals. A fresh join marks the server dirty and the joiner's `welcome` already includes them with zero counters.

**Reconnection.** The hub keeps no per-client outbound queue. The only history is the current snapshot; a rejoin `welcome` carries it, including every counter change that occurred while the member was disconnected. A coalesced frame missed during the disconnect is not replayed individually; the next flush or the rejoin snapshot is sufficient. This is the same "snapshot, not a replay log" contract as the removal batch and the activity feed.

**Multi-client behavior.** Every member of a server with an open socket receives the same encoded `leaderboardUpdate` bytes, including the origin. The snapshot is a server-wide view, not a per-client delta. A multi-tab account is two members (the established one-connection-one-member rule), so it appears as two rows with the same display name; no account identity is merged or exposed.

**Per-server isolation.** Each snapshot and flush timer is keyed by `serverId`; the broadcast uses the server's existing slot visitor, so no other server's members receive it. The snapshot carries its `serverId`, and the client reducer ignores a snapshot matching neither the current server nor a pending target server. A mover's `worldEntered` carries the target snapshot; target-server frames during the swap replace the pending snapshot, and the old server's snapshot is never applied after the swap. A member's own session counters travel with the member; no server's aggregate is ever shared with another server.

**Identity and "no accounts".** No conflict: guests and accounts use the same per-member counters, the same ranking and the same snapshot shape. The leaderboard never carries `accountId`, tokens or email and never reads persisted account economy. Account identity resolution, session behavior and guest play are unchanged.

**No persistence.** The leaderboard is process memory only; a backend restart starts every server's counters and snapshot empty. No database table, file or cache is added.

**Slow clients and shutdown.** There is no user-space outbound queue; the transport (`ws`/TCP) owns buffering/backpressure, as shipped. `hub.close()` discards every pending flush timer and snapshot state; no send or timer callback happens after close.

## Accessibility and reduced motion

- **One live region.** The shell's `.phase-announcement` remains the only polite/assertive live region. The leaderboard is a complementary landmark (`<aside aria-label="Server leaderboard">`) with `aria-live="off"` and no `role="status"`/`role="alert"`/`role="log"`; a screen reader can read it on demand via the landmark and list navigation.
- **Semantics.** `<h2>` names the panel, and an `<ol>`/`<li>` preserves the server's rank order; each row has a full text label (`#1 Player 2 3 cubes 120 clicks`) and every value is text, with no icon-only or color-only meaning. There are no focusable controls and no timestamps (the server clock is not the client clock).
- **Reduced motion.** The component exposes `data-reduced-motion` and the CSS disables the 160 ms row-entry animation both for the session preference and for `prefers-reduced-motion: reduce`; content is unchanged, not hidden.
- **Responsive/non-interactive.** The panel is a left rail below the HUD on desktop and moves below the activity feed on mobile, is `pointer-events: none`, adds no keyboard stop and changes no existing panel's placement. On very short mobile viewports (`max-width: 720px` and `max-height: 600px`) a smaller `max-height` caps it; its lower rows may be visually clipped behind the upgrades panel, which paints above it. All five rows and the totals remain in the DOM and the accessibility tree, and the upgrades panel keeps its placement.

## Containerization impact

No new service, image, deployable, port, host mapping, environment variable or health signal is added. The `leaderboardUpdate` frame and the `leaderboard` snapshot travel over the existing `GET /ws` WebSocket endpoint on backend port 8080; the backend container keeps `GET /healthz` and the WebSocket upgrade unchanged. `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile` and `src/frontend/Dockerfile` are unchanged, and `podman compose up` remains the single-command local environment. The containerized proof reuses the existing `tests/e2e/smoke.mjs` backend and its existing 1 s grace flow; no compose service or timing knob changes. Per `docs/architecture/containerization.md`, this feature reopens no settled convention.

## Testing strategy

- **Unit (backend).** `game/leaderboard.test.ts` — pure ranking: cubes-first, clicks tie-break, slot-order tie-break, top-five cutoff at a tie, totals over all members including non-top-five, guest/account-identical inputs, defensive copies, empty input, one member; coalescer: mark twice yields one timer/frame, 999 ms no flush, 1000 ms flush, a change during the window is included, a change after the flush starts a new window, `dropServer` clears, `discard` is terminal, `pendingServers` count. `game/protocol.test.ts` — `leaderboardUpdateMessage` and `parseLeaderboardSnapshot` against every row of the validation matrix, the exact representative frame, deep-copy semantics, `placementPayload` copy/absence and the welcome/worldEntered serverId cross-check, and no client `leaderboardUpdate` acceptance. `observability/metrics.test.ts` — both `type` allow-lists accept `leaderboardUpdate`, no other catalog entry changes.
- **Integration (backend).** `game/hub.test.ts` drives the real hub, real registry, real protocol builders, `InMemoryEconomyRepository` where relevant and fake peers with a manual clock: accepted click increments clicks and the face predicate; invalid/rate-limited/oversized/pre-join clicks do not; accepted completion increments cubes and an invalid/incomplete one does not; guest/account parity; join snapshot (one entry, zeros), rejoin snapshot (counters while away), grace retention, final removal, move attribution (counters follow the mover, old totals drop, old timer dropped on destroy); welcome/worldEntered snapshots; 1 s coalescing (no frame at 999 ms, one at 1000 ms, no per-click frame, quiet server no frame, join/rejoin/rotate/purchase/loot/equip behavior); encode-once and metrics increments; two-server isolation and the reducer-side guard; privacy scan of `leaderboardUpdate` frames and `leaderboard` placement fields only; 40 ms/250 ms non-regression; close/`vi.getTimerCount() === 0`.
- **Unit (frontend).** `multiplayer/protocol.test.ts` — every valid snapshot variant, every invalid variant in the shared matrix, the five-entry bound, serverId mismatch inside `welcome`/`worldEntered`, legacy welcome without `leaderboard`, exact parity with the backend fixture table. `multiplayer/server-state.test.ts` — null seed, welcome seed/replace/absent, `worldEntered` pending snapshot, `applyWorldSwap` replace, current/pending update, duplicate/no-op reference stability, mismatched-server guard, identity of untouched branches, and an old-server update during travel. `ui/Leaderboard.test.tsx` — exact markup/text/plurals for 0/1/2, top-five cap, null/empty → null, `aria-live="off"`/no live roles, reduced-motion attribute. `ui/game-view.css.test.ts` — rounded-chrome membership, desktop placement values, the `max-width: 720px` mobile block and its short-viewport `(max-height: 600px)` rule (`max-height: 12vh`), 160 ms animation, both reduced-motion disables, no `!important`, one trailing newline, and unchanged activity-feed/HUD selectors.
- **Integration (frontend).** `game/session.test.ts` — a real `createTransport` with a fake WebSocket passes the exact backend-encoded `welcome` + `leaderboardUpdate` frames through the real decoder and reducer into `getMultiplayerSnapshot().world.leaderboard`; the `worldEntered` → target `leaderboardUpdate` → `applyWorldSwap` chain applies the updated target snapshot; no engine/scene action. `App.test.tsx` — a populated leaderboard renders in the shell, the pre-welcome shell renders none, and the document still has exactly one polite/assertive live region.
- **E2E (containerized).** `npm run smoke` — the new `checkMultiplayerFlow` assertions in AC-25 on real WebSocket clients (welcome snapshots and a coalesced update found in history or awaited within the existing timeout; every existing check stays green).
- **Coverage.** `npm run coverage` — ≥ 80% statements, branches, functions and lines in each workspace. Behavior-change tasks run the workspace-scoped pre-gate (`npm run coverage --workspace @cubeclicker/backend` / `@cubeclicker/frontend`); the final task runs the root command.
- **Assertion bar.** Concrete expected values and exact objects/arrays; no wildcard matchers (`expect.any`, `expect.objectContaining` as a substitute for a pinned payload), no snapshot-only or assertion-free tests; fake timers/manual clock, never real sleeps in unit tests; no wall-clock performance assertion.
- **Commands.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke`; rebuild `frontend-prod` before smoke per the existing convention.

## Approval checkpoint

This feature needs explicit user confirmation of four product-visible values before building; the blanket "Proceed with all of them, one by one" queue approval is not approval of these values. The orchestrator must present Q-1–Q-4 in the `awaiting_approval` summary and record the confirmed values in `status.md` before T1 starts. The same summary must also state Q-5…Q-14 as the proposed defaults; they are user-visible defaults, not separate approval items.

1. **Q-1 — Ranking order.** Cubes completed descending, then clicks descending, then slot order. Alternative: clicks first.
2. **Q-2 — Coins.** Excluded from the ranking, the wire and the totals. Alternative: an account-only coin column (rejected).
3. **Q-3 — Move and grace semantics.** Counters follow the member across a move; a member in reconnect grace stays ranked. Alternative: reset counters on a move or drop on a socket close.
4. **Q-4 — Placement.** A non-interactive left rail below the HUD on desktop, below the activity feed on mobile. Alternative: a collapsible panel.

Q-5 (top five entries; totals over all current members), Q-6 (1 s per-server coalescing; no quiet-server frames), Q-7 (`worldEntered` snapshot with travel-window replacement), Q-8 (separate multi-tab rows), Q-9 (no per-member faces on the wire; totals only), Q-10 (metrics allow-list), Q-11 (docs home), Q-12 (containerized proof), Q-13 (no timestamp display) and Q-14 (solo/empty panel) are builder defaults recorded below and in the plan.

## Open questions

- **Q-1 — Ranking order.** Recommended **cubes completed descending → clicks descending → slot order ascending**. Cubes are the meaningful achievement and are less spammy than raw clicks; clicks break a cube tie by effort; slot order makes every tie deterministic without exposing a join timestamp. Alternatives: clicks first (rewards grinding over clearing), faces first (odd at the top), a composite score (invents a formula the player cannot see).
- **Q-2 — Coins.** Recommended **excluded from ranking, wire and totals**. Upgrade-scaled and account-only on the server; guests' coins are local and their upgrades are unknown to the hub, so a coin column would compare unlike values, leak private economy and rank upgrades. Alternatives: account-only coins (breaks guest parity and privacy), server-computed pseudo-coins for everyone (mismatches guest local balances; would need an economy change).
- **Q-3 — Move and grace semantics.** Recommended **counters follow the member** across a cross-server move and **a member in reconnect grace stays ranked** until final removal. A move only happens because of a completion, so resetting would erase the completion that caused it and punish rebalancing; dropping a grace member would disagree with the roster and its retained slot. Alternative: reset counters on a move and/or drop a member at socket close (both would require the panel to disagree with the roster).
- **Q-4 — Placement.** Recommended **a non-interactive left rail below the HUD on desktop and below the activity feed on mobile**, with a short-viewport `max-height` cap and the existing panels' placements unchanged. It uses the only free desktop band, stays below the feed's max height on mobile, adds no keyboard stop and keeps the upgrades panel's placement. Alternative: a collapsible panel (extra interaction for an M feature; possible follow-up if the short-mobile occlusion becomes a product problem).
- **Q-5 — Top five and totals scope.** Recommended **top five entries, totals over all current members** (including non-top-five and grace members). Alternative: totals over the top five only (not a server total; undercounts).
- **Q-6 — Cadence.** Recommended **one coalescing timer per dirty server at 1000 ms**; the first frame is at most 1 s after the first change, the final state always publishes within 1 s of the last change, and a quiet server emits nothing. Alternatives: a leading + trailing throttle (can produce two frames milliseconds apart), a global 1 Hz sweep (ticks idle servers and needs a global timer), the activity feed's drop-not-queue gate (can leave the final state unpublished forever).
- **Q-7 — `worldEntered` snapshot.** Recommended **include `leaderboard`** in `worldEntered` (the shared placement payload already covers it) and replace it with target-server frames during travel, so a mover enters the new server with the current ranking. Alternative: only `welcome` (a mover sees a stale or empty panel until the next flush).
- **Q-8 — Multi-tab accounts.** Recommended **separate rows per member/connection** (the established one-connection-one-member rule), even when two rows share an account username. Merging by account would require account identity in the ranking, break guest parity and expose an account key. Alternative: merge rows server-side (a different identity model, out of scope).
- **Q-9 — Per-member faces on the wire.** Recommended **not in `entries`**; `facesDestroyed` is aggregated in `totals` only. The ranking score is cubes/clicks, so a per-row third counter adds clutter without changing the order. Alternative: include faces per entry (larger rows, more UI text).
- **Q-10 — Metrics allow-list.** Recommended **add `leaderboardUpdate` to the two `type` allow-lists, no new metric**. Required: `broadcast` already increments both counters with `{ type }`, and the registry throws for an unlisted value. A new metric would be catalog noise.
- **Q-11 — Documentation home.** Recommended **`docs/architecture/realtime.md` § Live leaderboard plus a glossary entry**; no new document. Alternative: a new architecture doc, which would fragment the outbound-path contract.
- **Q-12 — Containerized proof.** Recommended **extend the existing `checkMultiplayerFlow`** with the welcome snapshots and a coalesced update found in history or awaited within the existing timeout; no new fixed wait. Alternative: unit/integration only (no wire proof).
- **Q-13 — Timestamp display.** Recommended **do not display `at`**; the server clock is not the client clock, and the panel has no relative time. Alternative: relative time (clock skew and extra state).
- **Q-14 — Solo/empty panel.** Recommended **render the panel when the snapshot has at least one entry**, including a solo member; the server totals are still meaningful and the panel never disappears/appears as the roster changes. Alternative: hide a solo panel (the panel would pop in on the second join).

## Assumptions

- One backend process with in-memory rooms; the leaderboard is per process and per server; a restart clears it. No Redis, queue, microservice or persistence is introduced.
- The `Member` record is the right owner of the counters: it survives grace, carries the `playerId`/`name` across a move, and is removed on final removal.
- `registry.forEachMember` visits occupied slots in ascending order and visits nothing for an unknown/destroyed server; the builder uses that order for the final tie-break and as the membership source.
- The hub's injected `now` is the only clock for `at`; tests use a manual clock/fake timers and never sleep.
- A per-server coalescing timer is acceptable; it is cleared on server destruction and `hub.close()`, and the existing 40 ms/250 ms timers are independent and unchanged.
- The `welcome`/`worldEntered` placement payload is the correct snapshot carrier; `leaderboard` is optional in the wire type (legacy/mixed versions) and always emitted by the backend.
- `broadcast` is the encode-once path; `leaderboardUpdate` is one more server message type and is included in the two metrics `type` allow-lists.
- The frontend and backend deploy together; an old client drops an unknown `leaderboardUpdate` frame and ignores the extra `leaderboard` field, and a new client against an old backend renders no panel.
- The snapshot payload (five entries + three totals) is small enough for `welcome`/`worldEntered`; the 1024-byte cap applies to client frames only, and no server frame cap changes.
- The smoke backend uses `X = 2` and a 1 s grace, so the existing A/B/C flow provides two members, accepted clicks and a coalesced frame; the new check adds no fixed wait.
- Guests and accounts are indistinguishable to the leaderboard: both are `Member` records with `playerId`, `name` and session counters; `accountId` is never needed.
- The panel is supplementary UI: non-interactive, not a live region, and may be visually clipped on very short mobile viewports without being removed from the accessibility tree; the upgrades panel paints above it and the short-viewport CSS rule reduces (but does not eliminate) the clipped area. All five rows and the totals remain in the DOM.

## Revision history

- r1 — 2026-11-16 — initial draft from the verified hub/protocol/reducer/UI audit: pins the three session counters and their exact accepted-transition increment points, the cubes → clicks → slot-order ranking, the top-five + all-member totals scope, the 1 s per-server coalescing timer, the additive `leaderboardUpdate` frame and `leaderboard` `welcome`/`worldEntered` snapshot, the `WorldState.leaderboard` + pending-swap reducer contract, the non-live/reduced-motion panel, the coin exclusion rationale, the per-server isolation/grace/move/privacy contract, and the containerized A/B proof.
- r2 — 2026-11-16 — spec-review r1 revision: unified the approval/default numbering (Q-1 ranking, Q-2 coins, Q-3 move/grace, Q-4 placement; Q-5…Q-14 defaults; removed the duplicate Q-8 and renumbered the remainder); corrected AC-23 from "no conflict" to the explicit short-viewport behavior (lower rows may be visually clipped behind the upgrades panel, all content stays in the DOM/accessibility tree) and added the `max-width: 720px` + `max-height: 600px` CSS rule and its test; no AC count, counter, ranking, coin, cadence, totals or isolation change.
