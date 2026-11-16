---
feature: presence-and-activity-liveness
revision: 3
---
# Plan — Presence & Activity Liveness

## Architecture

The feature keeps the single-process, in-memory, server-authoritative architecture. It adds one additive client frame and one server-side eligibility filter; it adds no service, database write, dependency, timer on the server or wire field.

### Presence: explicit leave vs abrupt close

```text
pagehide (persisted === false)
        │
        ▼
session.onPageHide ──► transport.send({ type: 'leave' })
        │                      │
        │                      ▼
        │             hub.handleMessage ──► hub.handleLeave(connection, member)
        │                      │
        │                      ▼
        │             removeMember(playerId)          ← the existing final-removal path
        │               ├─ flushRemovalBatches()
        │               ├─ registry.removeMember()  → slot freed; server destroyed if empty
        │               ├─ members.delete / tokens.delete
        │               ├─ memberLeft { reason: 'left' } to the remaining members
        │               ├─ activity.record(memberLeft) if the server survives
        │               ├─ leaderboard.markDirty(server) or dropServer(server)
        │               └─ recomputePlan() / refreshRoomGauges()
        │             peer.close()  (closeReason = 'client')
        ▼
     page unloads; when this leave reached the server before the reload's `join`, the old
     member is gone and the reload is one fresh member; a lost/late frame or an already-
     disconnected socket falls back to the grace path below (the accepted residual)

socket close without leave
        │
        ▼
hub.handleClose → member.connection = null → grace.begin + scheduleExpiry
        │
        ├─ roster/leaderboard/panel keep the member (accepted)
        └─ rejoin { token } before the deadline resumes exactly
```

The hub reuses `removeMember` for both grace expiry and explicit leave: the outcome for a surviving server is identical (`memberLeft (left)`, activity candidate, leaderboard dirty), and for a destroyed server it is identical (no recipients, ring/leaderboard state dropped). The only new logic is the `leave` dispatch, the `closeReason = 'client'` assignment and the peer close. `handleClose` already returns early when the member no longer exists.

### Activity: server eligibility + client display expiry

```text
backend
  activity.record(serverId, candidate)
    ├─ 1 s per-server gate (unchanged; dropped candidates consume no id)
    ├─ prune the expired tail (age >= ACTIVITY_EVENT_TTL_MS)
    ├─ unshift accepted event; keep newest 20
    └─ return a fresh copy → hub broadcasts `activityEvent` immediately (encode-once)

  activity.snapshot(serverId)
    ├─ prune the expired tail (now - event.at >= 5000)
    ├─ return fresh copies of the fresh events (0…5 by cadence + TTL)
    └─ used by `welcome` (join/rejoin) and `worldEntered` (move)

frontend
  session receives welcome/worldEntered/activityEvent (any reduction)
    ├─ reduceWorldState (unchanged shapes)
    ├─ observe(current feed + pending feed, currentNow())
    │    ├─ set deadline serverId:id → now + 5000 only on first sight
    │    ├─ keep the remaining deadline across a same-server rejoin
    │    ├─ tombstone a locally expired key for 5000 ms (no re-display)
    │    └─ drop keys of servers that are neither current nor pending
    ├─ synchronous pruneActivity(world, lifetime.isExpired)   ← before publish
    └─ publishMultiplayer()  (a tombstoned/expired seed never enters the feed)
  one attach-cycle interval (250 ms) + visibility-resume prune
    └─ fallback for time passing without a reduction; same prune → publish if changed
```

The server filter is the **eligibility** guarantee (an event older than 5 s never travels in a snapshot); the client deadline is the **display** guarantee (a line disappears without needing another frame). Both are needed: a snapshot-only rule never removes a live line, and a client-only rule would replay expired events on reconnect.

## Interfaces / contracts

### Wire additions (no version bump)

```ts
// Both protocol mirrors: backend `game/protocol.ts` and frontend `multiplayer/protocol.ts`.
export const ACTIVITY_EVENT_TTL_MS = 5000;

// Client → server only; no fields; extra fields dropped by the decoder.
export type ClientMessage =
  | /* existing */ …
  | { type: 'leave' };
```

`parseClientMessage` adds:

```ts
case 'leave':
  return { ok: true, message: { type: 'leave' } };
```

No `ServerMessage` variant is added. `memberLeft { playerId, reason: 'left' }` is reused. `MemberState`, `LeaderboardSnapshot`, `ActivityEvent`, `welcome` placement and `worldEntered` placement are unchanged.

### Backend feed

```ts
export function createActivityFeed(options: {
  now: () => number;
  limit?: number;          // default ACTIVITY_FEED_LIMIT (20)
  minIntervalMs?: number;  // default ACTIVITY_MIN_INTERVAL_MS (1000)
  ttlMs?: number;          // default ACTIVITY_EVENT_TTL_MS (5000); tests may pin a long TTL
}): ActivityFeed;
```

`ActivityFeed` keeps its existing `record` / `snapshot` / `dropServer` / `clear` surface. `snapshot` filters `now() - event.at < ttlMs`, prunes the expired tail, and returns fresh copies. `record` prunes the expired tail before/after accepting but never changes `nextId` or `lastAcceptedAt` because of pruning. `clear` remains terminal.

### Hub handler

```ts
function handleLeave(connection: Connection, member: Member): void {
  // 1. removeMember(member.playerId) — the existing final-removal path
  // 2. connection.playerId = null; connection.closeReason = 'client'; connection.peer.close()
}
```

Dispatch in `handleMessage` after `memberFor` (so `not_joined` is preserved):

```ts
if (message.type === 'leave') {
  handleLeave(connection, member);
  return;
}
```

Metrics: add `'leave'` to the `cubeclicker_ws_messages_received_total` `type` allow-list in `src/backend/src/observability/metrics.ts`.

`handleLeave` relies on the normal close path (`handleClose`) to clear the connection's heartbeat interval; it introduces no new timer or shutdown path. If a `close` event were delayed, the existing heartbeat would run until its next tick — unchanged behavior (F14).

### Frontend page lifecycle

```ts
export interface PageLifecycleSource {
  /** Calls back on pagehide with `event.persisted` (true = entering bfcache). */
  subscribe(cb: (persisted: boolean) => void): () => void;
}

export interface SessionEnvironment {
  …
  /** Optional for source compatibility; the browser environment always provides it. */
  pageLifecycle?: PageLifecycleSource;
}
```

`browser-env.ts`:

```ts
const pageLifecycle: PageLifecycleSource = {
  subscribe(cb) {
    const handler = (event: PageTransitionEvent) => cb(event.persisted === true);
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  },
};
```

`session.ts` in `start()` subscribes (and `teardown` unsubscribes through `unsubscribers`):

```ts
function onPageHide(persisted: boolean): void {
  if (persisted || !welcomed || status !== 'connected' || transport === undefined) return;
  try {
    transport.send({ type: 'leave' });
  } catch {
    // Best-effort during unload: a CLOSING/CLOSED socket may throw; no other frame is sent
    // and the handler must complete so teardown/navigation is unaffected (AC-7).
  }
}
```

`dispose()` deliberately sends nothing. The `try`/`catch` is required because `transport.send` writes to the live socket without its own guard, and `WebSocket.send` throws once the socket is closing/closed (F9).

### Frontend activity lifetime

```ts
// src/frontend/src/multiplayer/activity-lifetime.ts
export const ACTIVITY_EXPIRY_TICK_MS = 250;

export interface ActivityFeedSlice {
  serverId: number;
  events: readonly ActivityEvent[];
}

export interface ActivityLifetime {
  /** Track first-seen deadlines, move expired deadlines to tombstones, prune tombstone expiries, drop keys of servers not in `feeds`. */
  observe(feeds: readonly ActivityFeedSlice[], nowMs: number): void;
  /** True when the key has a deadline at/before now, or is tombstoned. */
  isExpired(serverId: number, eventId: number, nowMs: number): boolean;
  /** Drop a server's deadlines/tombstones (server left/destroyed). */
  dropServer(serverId: number): void;
  /** Clear everything (session teardown). */
  clear(): void;
  /** Test/observability: number of live deadlines + tombstones. */
  size(): number;
}

export function createActivityLifetime(options: { ttlMs: number }): ActivityLifetime;
```

```ts
// src/frontend/src/multiplayer/server-state.ts
export function pruneActivity(
  state: WorldState,
  isExpired: (serverId: number, eventId: number) => boolean,
): WorldState;
```

`pruneActivity` filters `activity` and `pendingWorldSwap.activity` independently, returns the same `WorldState` reference when nothing expired, and preserves the untouched branch's identity. `session.ts` builds the feed slices (`world.serverId`/`world.activity` and, when present, `pendingWorldSwap.serverId`/`pendingWorldSwap.activity`) and applies this **exact order on every world reduction** and after the travel-midpoint `applyWorldSwap`:

1. reduce/replace `world` — in `handleServerMessage`, immediately after `world = reduceWorldState(world, message)` and **before the message switch**, so `handleWelcome`/`handleWorldEntered`'s own `publishMultiplayer()` calls see the pruned world;
2. `const now = currentNow(); lifetime.observe(feeds, now);`
3. `world = pruneActivity(world, (serverId, eventId) => lifetime.isExpired(serverId, eventId, now));`
4. run the switch and its handler-specific publishes; the reduction's final `publishMultiplayer()` also sees the pruned world.

For the `applyWorldSwap` paths (the travel midpoint in the frame loop and the defensive `handleWorldEntered` fallback), the same order applies: `world = applyWorldSwap(world)` → `lifetime.observe(...)` → synchronous `pruneActivity` → the subsequent `publishMultiplayer()`. The publish therefore never exposes a tombstoned or newly expired seed, even for one tick. The 250 ms `setInterval(pruneExpiredActivity, ACTIVITY_EXPIRY_TICK_MS)` is only the fallback for time passing without a reduction; `onVisibilityChange(false)` calls the same prune before `scheduleFrame()`. `teardown` clears the interval.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/protocol.ts` | Edit | `ACTIVITY_EVENT_TTL_MS`; `leave` client message + decoder case; doc comment. |
| `src/backend/src/game/protocol.test.ts` | Edit | `leave` fixture matrix, exact encoded frame, TTL constant, unchanged `welcome` fixture. |
| `src/backend/src/game/activity.ts` | Edit | TTL option, snapshot filtering and tail pruning; ids/cadence unchanged. |
| `src/backend/src/game/activity.test.ts` | Edit | 4999/5000 boundary, `ttlMs` seam, 25-event snapshots, ring/cadence invariance. |
| `src/backend/src/game/hub.ts` | Edit | `handleLeave` dispatch/handler, peer close, close reason; reuse `removeMember`. |
| `src/backend/src/game/hub.test.ts` | Edit | Explicit leave vs abrupt close, rejoin after leave, last member, multi-tab, derived views, activity/leaderboard, metrics, timer hygiene. |
| `src/backend/src/observability/metrics.ts` | Edit | Add `leave` to the received `type` allow-list. |
| `src/backend/src/observability/metrics.test.ts` | Edit | Allow-list acceptance; no other catalog change. |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | `ACTIVITY_EVENT_TTL_MS`; `leave` client message + decoder case. |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | `leave` parity + extra-field dropping, TTL mirror, unchanged server catalog. |
| `src/frontend/src/multiplayer/activity-lifetime.ts` | New | Deadline/tombstone bookkeeping for current + pending feeds. |
| `src/frontend/src/multiplayer/activity-lifetime.test.ts` | New | First-seen, no extension, tombstone, stale-server cleanup, bounded size. |
| `src/frontend/src/multiplayer/server-state.ts` | Edit | Pure `pruneActivity` helper. |
| `src/frontend/src/multiplayer/server-state.test.ts` | Edit | `pruneActivity` reference stability and copy semantics. |
| `src/frontend/src/game/session.ts` | Edit | Page-lifecycle subscription/leave send; observe → synchronous prune → publish on every reduction and after `applyWorldSwap`; 250 ms interval fallback; visibility prune; teardown. |
| `src/frontend/src/game/session.test.ts` | Edit | Pagehide conditions, expiry timing, travel, rejoin remaining lifetime, tombstones (immediate 5001 `welcome` feed `[]`), visibility, dispose. |
| `src/frontend/src/browser-env.ts` | Edit | `pagehide` → `PageLifecycleSource`. |
| `src/frontend/src/browser-env.test.ts` | Edit | Subscription/unsubscribe/`persisted` forwarding. |
| `tests/e2e/smoke.mjs` | Edit | Keep B's abrupt-close grace check; add D's explicit-leave check and E's freed-slot join. |
| `docs/architecture/realtime.md` | Edit | Presence/explicit-leave contract; activity lifetime. |
| `docs/architecture/observability.md` | Edit | Received allow-list `leave`; explicit-leave gauge semantics; correct the pre-existing encoded/frames rows (`activityEvent`, `leaderboardUpdate`). |
| `docs/architecture/frontend-rendering.md` | Edit | Page-lifecycle subscription; session `ACTIVITY_EXPIRY_TICK_MS` expiry timer and visibility prune. |
| `docs/product/glossary.md` | Edit | New `presence`; update `activity feed` and `server member`. |
| `docs/features/presence-and-activity-liveness/build-log-T9.md` | New (final task) | Raw final gate + smoke evidence; proposed feature-index diff. |
| `docs/features/README.md` | Not edited | Orchestrator-owned row proposal only. |
| `README.md`, `compose.yaml`, `compose.smoke.yaml`, `src/*/Dockerfile`, `package.json`, `package-lock.json` | Unchanged | No run, container or dependency change. |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Add a self-only client `leave` frame and reuse `removeMember`. | Distinguishes a deliberate close from an abrupt one without changing identity, grace or any server shape; testable with fake peers; no HTTP route. | Infer from WS close codes (browser-inconsistent); HTTP `sendBeacon` (new route/CSRF surface, rejected in the spec's close-transport decision); shorten grace (breaks reconnect). |
| D-2 | Send `leave` on non-bfcache `pagehide` only. | `pagehide` is the modern unload signal; `visibilitychange` is a tab switch, not a close; `persisted` protects bfcache. The send is wrapped in `try`/`catch` so a closing socket cannot throw out of the unload handler (F9). | `beforeunload` (unreliable/blockable); always leave on visibility hidden (would remove backgrounded players). |
| D-3 | No leave on `dispose()`. | React StrictMode/remount and route teardown are not deliberate closes; the accepted grace must handle a socket close during remount. | Send leave on dispose (would break reconnect and duplicate-removal tests). |
| D-4 | Server `snapshot` filters at 5000 ms and prunes the ring tail. | An expired event can never travel on join/rejoin/move; the ring stays bounded and ids/cadence are untouched. | Client-only expiry (expired events replay on reconnect); a timer-based server sweep (unnecessary state/timer). |
| D-5 | Client expiry anchored at local receipt, keyed by `serverId:id`, with tombstones. | No clock-skew dependency; five seconds on screen is deterministic; a same-server rejoin preserves the remaining lifetime; a locally expired key cannot reappear at a boundary. | Server `at` + `hello` offset (clock machinery, Q-5); reset the deadline on every welcome (re-display of old lines). |
| D-6 | Synchronous prune on every reduction + one 250 ms interval fallback + pure prune helper. | A tombstoned or newly expired seed never enters the published feed (observe → prune → publish); the interval only covers time passing without a reduction. Bounded, simple, testable with fake timers. | Interval-only prune (up to 250 ms re-display, fails AC-17); per-event `setTimeout` (more handles, cross-server key bookkeeping); prune in the frame loop (stops when hidden; wasted 60 Hz work). |
| D-7 | Keep the 20-event ring, 5-visible cap and 1 s cadence. | Accepted bounds and tests remain meaningful; with 1/s + 5 s TTL at most five are fresh, so the display cap aligns. | Reduce the ring to 5 (protocol-visible constant change, no real benefit). |
| D-8 | No presence field or grace marker. | Grace members may resume and are already the roster's presence; adding a field is a new product state and wire surface. | Additive `presence: 'connected' \| 'grace'` + UI marker (Q-2). |
| D-9 | Keep the heartbeat (30 s / 2) and grace (30 s) unchanged. | The explicit path bypasses them; shortening either reopens accepted liveness timing and false-disconnect risk. | Shorter heartbeat (faster abnormal cleanup, more false positives). |
| D-10 | The server closes the socket after a `leave`. | The member is terminal; no orphan connection can re-join; the close event finds no member and starts no grace. | Keep the socket open for a re-join (extra state, no unload benefit). |
| D-11 | Explicit leave records the normal `memberLeft` activity candidate. | "Player left" is meaningful presence information and the accepted gate already bounds the rate; destroying the last server still emits no event. | No activity event on explicit leave (quieter, omits a real leave). |
| D-12 | Documentation in `realtime.md` + glossary + observability + `frontend-rendering.md`. | The outbound/presence contract already lives in `realtime.md`; the session seam belongs in the rendering doc; no new doc. The observability pass also corrects the pre-existing `activityEvent`/`leaderboardUpdate` allow-list omissions (F13). | A new presence architecture doc (fragments the contract). |
| D-13 | The `pagehide` send is exception-safe. | `transport.send` writes to the socket without its own guard; `WebSocket.send` throws on a closing/closed socket, and an unload handler must not throw. | Guard inside the transport (a broader transport contract change) or rely on the browser (uncaught during unload). |
| D-14 | The reload guarantee is best-effort and ordering-dependent. | The leave and the new page's join race over different transports; normal ordering finalizes the old member, while a lost/late frame falls back to the accepted grace. Promising an unconditional single member would be false. | Reduce grace on a close (breaks reconnect); add an HTTP beacon (rejected close-transport alternative). |

## Risks & mitigations

- **`pagehide` frame can be lost during unload** → the server treats it as an abrupt close and applies the accepted grace; the residue is bounded by `RECONNECT_GRACE_MS` and the behavior degrades to today's. The smoke and session tests prove the frame when delivered; the close-transport decision records the more reliable (but larger) beacon alternative as rejected.
- **Reload ordering race** → the leave is sent on the old page's `pagehide` while the new page's `join` travels on a new socket; when the leave arrives first the old member is finalized, otherwise the old member stays in grace and the new page can coexist (and overflow) until expiry. Documented as the accepted best-effort residual (F6); no unconditional single-member promise is made.
- **Exception during unload** → the `pagehide` handler wraps `transport.send` in `try`/`catch`; a fake socket whose `send` throws is tested to send no other frame and complete without an uncaught exception (F9).
- **bfcache return** → `persisted === true` sends nothing; the transport's existing reconnect/`rejoin` path handles a socket that was closed. Tested in `session.test.ts` and `browser-env.test.ts`.
- **StrictMode/remount dispose** → no leave on dispose; the server keeps grace and the remount reconnects with the token. Tested.
- **Hidden-tab timer throttling** → the interval may run late while hidden, but `onVisibilityChange(false)` prunes synchronously before the next frame. Tested with a fake visibility source.
- **Clock skew** → client deadlines use receipt time, not `event.at`; the server filter uses only server time. No cross-clock comparison is introduced.
- **Boundary re-seed of a locally expired event** → the bounded tombstone (`ACTIVITY_EVENT_TTL_MS`) suppresses re-display, and the synchronous prune on the reducing frame filters the seed before publish; tombstone/deadline state is dropped for servers that are no longer current or pending.
- **Mixed versions** → old client + new backend: no `leave`, old presence/grace behavior; it receives the smaller ≤5-event activity snapshot and does not expire live lines locally (documented in the spec's § Mixed versions). New client + old backend: `leave` → `bad_message` (harmless on unload), no server TTL filter (client still expires live lines; old snapshots may seed older lines once). No wire shape changed; no version bump.
- **Existing activity tests pinned to 20-event snapshots** → the `ttlMs` seam keeps the 20-ring test meaningful with a long TTL; the default-TTL test re-pins the snapshot to the five fresh events with the same concrete values (no weakened assertion).
- **Smoke timing / flakiness** → B's existing abrupt-close check keeps its `>= 900 ms` bound and label; D's explicit-leave check uses `< 900 ms`; E's join proves the freed slot; no new 5 s wait is added. The run drains through the existing settle.
- **Leaderboard transient after leave** → the roster is immediate; the leaderboard can show the leaver for up to 1 s (accepted coalescing). Documented in the presence contract; no cadence change.
- **Activity snapshot shrinks from ≤20 to ≤5** → product-intended (five-second window) and documented; the decoder's 20 bound remains valid.
- **Session test surface grows** → the expiry interval is one handle per attach cycle; the lifetime map is keyed by live/pending server ids and bounded by the feeds; `size()` is exposed for tests.

## Verification

Per-task pre-gates are the workspace-scoped commands. The final task runs the root gates and records raw output:

```bash
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod
npm run smoke
git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json
```

The smoke transcript, coverage tables, build output and the proposed `docs/features/README.md` row live in `build-log-T9.md`. No wall-clock performance assertion is added; the TTL tests use a manual clock and fake timers.

The documentation task's checks are precise and currently-absent: `grep -F "## Presence and explicit leave" docs/architecture/realtime.md`, `grep -F "### Lifetime" docs/architecture/realtime.md`, `grep -F "ACTIVITY_EVENT_TTL_MS" docs/architecture/realtime.md`, `grep -F "allow-list includes" docs/architecture/observability.md`, `grep -F "An explicit leave drops" docs/architecture/observability.md`, `grep -F "The encoded and frame-sent allow-lists" docs/architecture/observability.md`, `grep -F "pagehide" docs/architecture/frontend-rendering.md`, `grep -F "ACTIVITY_EXPIRY_TICK_MS" docs/architecture/frontend-rendering.md`, and `grep -F "### presence" docs/product/glossary.md`. To make the observability checks unambiguous, the docs pass uses the exact sentences "The received `type` allow-list includes `leave`; `cubeclicker_ws_messages_received_total{type=\"leave\"}` increments once per accepted client frame.", "An explicit leave drops `members_active` immediately; a grace close keeps the member until expiry.", and "The encoded and frame-sent allow-lists include `activityEvent` and `leaderboardUpdate`." A dependency-free `node -e` link check resolves every relative link in the four edited docs; `git diff --check` catches whitespace and `git diff --exit-code -- README.md docs/architecture/containerization.md docs/features/README.md` protects the unchanged docs.

## Open questions

See `spec.md` § Open questions (Q-1, Q-2, Q-4…Q-14; Q-3 is decided in the spec). The approval checkpoint is Q-1 (TTL), Q-2 (grace display) and Q-4 (multi-tab); Q-3 (close transport) is decided in the spec's § Protocol and additivity (WS `leave`, residual documented) and is not a user checkpoint. Q-11 is a recommended default mentioned as a note, not a blocker.

## Revision history

- r2 — 2026-11-16 — spec-review r1 revision: aligns the plan with the spec's F1–F15 dispositions (observable AC evidence, split activity scenarios, decided close transport, best-effort reload, retained B smoke check plus D/E explicit-leave/slot-reuse, exception-safe pagehide send, precise doc checks, observability row correction, heartbeat note).
- r3 — 2026-11-16 — r2a targeted fix (spec-review r2 F1–F4): the session's exact order is reduce → `lifetime.observe` → synchronous `pruneActivity` → `publishMultiplayer` on every world reduction and after `applyWorldSwap`; the 250 ms interval is the fallback only. Session/file-inventory notes pin the immediate 5001 `welcome` empty feed, the `vi.getTimerCount()` evidence (AC-1/AC-4) and the rejoin counter observation (AC-2). No design change.
