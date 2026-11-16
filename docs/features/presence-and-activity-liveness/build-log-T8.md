# Build log — T8 — Documentation pass

Task: T8 — Documentation pass `[P]` (2026-11-16)
Files changed: `docs/architecture/realtime.md`, `docs/architecture/observability.md`,
`docs/architecture/frontend-rendering.md`, `docs/product/glossary.md`,
`docs/features/presence-and-activity-liveness/build-log-T8.md`

What changed & why: `realtime.md` gains `## Presence and explicit leave` (self-only `leave` on a
non-bfcache `pagehide`, immediate finalization through `removeMember`, retained abrupt-close grace
and token rejoin, multi-tab, reload residual, metrics/rollback) and an activity `### Lifetime`
subsection (`ACTIVITY_EVENT_TTL_MS = 5000`, snapshot eligibility, receipt-anchored client expiry,
tombstones, 250 ms fallback). `observability.md` adds `leave` to the received `type` allow-list,
states the explicit-leave vs grace `members_active` semantics, and corrects the pre-existing
`cubeclicker_ws_messages_encoded_total`/`frames_sent_total` rows to include `activityEvent` and
`leaderboardUpdate` (matching `src/backend/src/observability/metrics.ts`). `frontend-rendering.md`
records the `pagehide` page-lifecycle seam, the session's `leave` send and the
`ACTIVITY_EXPIRY_TICK_MS` (250 ms) fallback with synchronous prune on every reduction.
`glossary.md` adds `### presence` and aligns `### activity feed` and `### server member`.

Documentation-only task: no source or test changes; no coverage delta (T9 runs the root gate).

## Changed sections (exact)

### `docs/architecture/realtime.md`

- New `## Presence and explicit leave`, placed after `## Reconnect and authority` and before
  `## Activity feed`, with `### Explicit leave vs abrupt close` covering: the additive
  `{ type: 'leave' }` shape and extra-field dropping; `error not_joined` before join; finalization
  of only the sender's member through the existing `removeMember` path; immediate `memberLeft
  (left)`, destroy-if-empty, ring/leaderboard cleanup; `closeReason = 'client'` and the peer close;
  token deletion (`rejoin` → `error resume_failed`); the unchanged abrupt-close grace
  (`RECONNECT_GRACE_MS` 30 000 ms, heartbeat 30 s / 2 missed pongs, token rejoin); immediate
  `memberLeft` vs coalesced `leaderboardUpdate` (≤1000 ms); `members_active` semantics; per-tab
  multi-tab removal; the best-effort reload ordering and its accepted residual; bfcache, tab
  switch and `dispose()` sending nothing; the exception-safe `pagehide` send; the received
  allow-list `leave` value, the unchanged encoded/frames catalog, the `reason="client"` close
  metric and the code-only rollback.
- New `### Lifetime` under `## Activity feed` (after `### Ring buffer`, before
  `### Welcome, reconnect and worldEntered`): freshness `serverNow - event.at < 5000`; the
  snapshot filter and expired-tail pruning with `nextId`/`lastAcceptedAt` invariance; the 0–5
  snapshot size under the 1/s cadence and 5 s TTL with the 20-event ring retained; unchanged live
  `activityEvent` frames; receipt-anchored client deadlines (first sight only, no `event.at`),
  first-seen-only deadlines, synchronous `observe → pruneActivity → publish` on every reduction and
  after `applyWorldSwap` (including handler-specific publishes); tombstone window and stale-server
  cleanup; the `ACTIVITY_EXPIRY_TICK_MS = 250` fallback, visibility-resume prune and `dispose()`
  cleanup; mixed-version behavior, no exit animation/no live region, and rollback.
- Corrected the `memberLeft` event-catalog row from "final grace-expiry removal or move-out" to
  "final removal (explicit `leave` or grace expiry) or move-out".
- Corrected the `### Welcome, reconnect and worldEntered` heading section from "current ring … at most 20" to
  the fresh-only snapshot ("0–5 by the 1 s cadence and the 5000 ms TTL; § Lifetime"), so the doc
  matches the shipped T2/T3 behavior.

### `docs/architecture/observability.md`

- `cubeclicker_ws_messages_received_total` `type` allow-list gains `leave` (after `ping`, before
  `invalid`).
- `cubeclicker_ws_messages_encoded_total` `type` allow-list gains `activityEvent` and
  `leaderboardUpdate` before `error` (the frames row follows "same as encoded").
- `cubeclicker_members_active` meaning now states: "An explicit leave drops the member
  immediately; an abrupt close keeps the grace-window member counted until expiry."
- Added the allow-list paragraph after the catalog table: the received `leave` increment, the
  `members_active` semantics and the encoded/frames `activityEvent`/`leaderboardUpdate` values with
  the encode-once/per-recipient counting rule.

### `docs/architecture/frontend-rendering.md`

- Attach list now includes the page-lifecycle `pagehide` subscription and the session's
  activity-expiry interval.
- New **Page-lifecycle leave** paragraph: the optional `pageLifecycle` source in `browser-env.ts`,
  `event.persisted` forwarding, subscribe on attach / unsubscribe in `dispose()`, the
  welcomed+connected non-bfcache `leave` with its exception-safe send, and the bfcache / tab switch
  / dropped socket / `dispose()` no-send cases.
- New **Activity display expiry** paragraph: every reduction and the travel-midpoint
  `applyWorldSwap` run observe → synchronous `pruneActivity` → publish; one session-owned
  `setInterval(pruneExpiredActivity, ACTIVITY_EXPIRY_TICK_MS)` (250 ms) per attach cycle is the
  fallback only; visibility resume prunes before the next frame; `dispose()` clears the interval.

### `docs/product/glossary.md`

- New `### presence` (alphabetical: between `prestige` and `save`): present = owns a slot as a
  server member; the two sub-states (connected / in grace, visually identical); explicit leave
  (non-bfcache `pagehide`) vs abrupt close (grace + rejoin); per-connection multi-tab; the
  best-effort unload residual.
- `### activity feed` now states the five-second live window (`ACTIVITY_EVENT_TTL_MS = 5000`),
  fresh-only `welcome`/`worldEntered` snapshots, client-side receipt expiry, at most five live
  events (1/s cadence), and the explicit-leave/grace-expiry `memberLeft` candidate.
- `### server member` now opens on a member who owns a slot (not only a connected one) and states
  the explicit-leave immediate end vs the abrupt-close grace retention.

## Decisions

- **Exact sentences from the plan.** The observability checks need unambiguous strings, so the docs
  use the plan's pinned sentences verbatim ("The received `type` allow-list includes `leave`…",
  "An explicit leave drops `members_active` immediately…", "The encoded and frame-sent allow-lists
  include `activityEvent` and `leaderboardUpdate`…").
- **Activity `### Lifetime` placement.** It sits directly after `### Ring buffer` so the TTL filter
  reads as a property of the ring and immediately precedes the `### Welcome, reconnect and
  worldEntered` section, which now points at it.
- **Minimal-accuracy edits beyond the new sections.** Only two pre-existing statements were
  factually stale after T2/T3 (the `memberLeft` candidate row and the "at most 20" welcome
  snapshot); both were corrected in place rather than adding a contradiction.
- **No `README.md` / `containerization.md` / `docs/features/README.md` edit.** The run, container
  and index docs are unchanged; the feature-index row stays orchestrator-owned (candidate row
  recorded below, T9 owns the final proposal).
- **No source changes and no coverage delta.** This is a documentation-only task; T9 runs the root
  lint/typecheck/test/coverage/build/smoke gate.

## Evidence

All commands were run from the repository root on `feat/presence-and-activity-liveness`
(`cca6373` + this task's uncommitted doc changes). A post-commit re-run of the nine greps, the
link check and the untouched-documents check on this task's commit returned
`grep_failures=0 linkcheck_exit=0 untouched_exit=0`.

### Nine `grep -F` checks from T8 — all exit 0

```text
$ grep -F "## Presence and explicit leave" docs/architecture/realtime.md
## Presence and explicit leave
exit=0

$ grep -F "### Lifetime" docs/architecture/realtime.md
### Lifetime
exit=0

$ grep -F "ACTIVITY_EVENT_TTL_MS" docs/architecture/realtime.md
`serverNow - event.at < ACTIVITY_EVENT_TTL_MS`, with `ACTIVITY_EVENT_TTL_MS = 5000` in the backend
  `ACTIVITY_EVENT_TTL_MS`, so a boundary re-seed cannot re-display it. Deadlines and tombstones for
exit=0

$ grep -F "allow-list includes" docs/architecture/observability.md
The received `type` allow-list includes `leave`; `cubeclicker_ws_messages_received_total{type="leave"}` increments once per accepted client frame. An explicit leave drops `members_active` immediately; a grace close keeps the member until expiry. The encoded and frame-sent allow-lists include `activityEvent` and `leaderboardUpdate`; one broadcast increments the encoded counter once and the frames-sent counter once per recipient.
exit=0

$ grep -F "An explicit leave drops" docs/architecture/observability.md
| `cubeclicker_members_active` | gauge | — | Joined members. An explicit leave drops the member immediately; an abrupt close keeps the grace-window member counted until expiry. |
The received `type` allow-list includes `leave`; `cubeclicker_ws_messages_received_total{type="leave"}` increments once per accepted client frame. An explicit leave drops `members_active` immediately; a grace close keeps the member until expiry. The encoded and frame-sent allow-lists include `activityEvent` and `leaderboardUpdate`; one broadcast increments the encoded counter once and the frames-sent counter once per recipient.
exit=0

$ grep -F "The encoded and frame-sent allow-lists" docs/architecture/observability.md
The received `type` allow-list includes `leave`; `cubeclicker_ws_messages_received_total{type="leave"}` increments once per accepted client frame. An explicit leave drops `members_active` immediately; a grace close keeps the member until expiry. The encoded and frame-sent allow-lists include `activityEvent` and `leaderboardUpdate`; one broadcast increments the encoded counter once and the frames-sent counter once per recipient.
exit=0

$ grep -F "pagehide" docs/architecture/frontend-rendering.md
**Attach.** When `active` becomes `true`, the effect calls `session.attach(canvas)` and returns `session.dispose()` as cleanup. `attach` is idempotent (`if (active) return`). It creates the scene view, obtains the adapter from the injected environment (production: `createRealisticRenderer` in [`browser-env.ts`](../../src/frontend/src/browser-env.ts)), pushes the starting tier with `adapter.setQuality(view.getQualityTier())` **before** the first `applyViewport()`, applies the viewport, registers the five pointer handlers plus the window key handler, subscribes motion/visibility/resize/orientation and the page-lifecycle `pagehide` source, starts the session's activity-expiry interval, subscribes `transport.onMessage`/`onStatus` **before** calling `transport.connect()`, and schedules exactly one frame.
**Page-lifecycle leave.** The browser environment exposes an optional `pageLifecycle` source ([`browser-env.ts`](../../src/frontend/src/browser-env.ts)) that subscribes to the window's `pagehide` and forwards `event.persisted === true`; the session subscribes while attached and unsubscribes in `dispose()`. A non-bfcache `pagehide` while the session is welcomed and connected sends exactly one additive `{ "type": "leave" }` through the transport, so the hub finalizes the member immediately instead of starting the reconnect grace. The send is exception-safe: a CLOSING/CLOSED socket can throw from `WebSocket.send`, and the handler swallows the error without sending another frame or skipping teardown. A bfcache `pagehide` (`persisted === true`), a tab switch, a dropped socket and `dispose()` (StrictMode/remount or route teardown) send nothing, so a remount inside the grace reconnects with the token.
exit=0

$ grep -F "ACTIVITY_EXPIRY_TICK_MS" docs/architecture/frontend-rendering.md
**Activity display expiry.** Activity lines are temporal. Every world reduction (`welcome`, `worldEntered`, `activityEvent`, `leaderboardUpdate`, any frame) and the travel-midpoint `applyWorldSwap` run observe → synchronous `pruneActivity` → publish, so an event past its receipt-anchored five-second deadline (or a tombstoned `serverId:id` key) never reaches the published feed. One session-owned `setInterval(pruneExpiredActivity, ACTIVITY_EXPIRY_TICK_MS)` per attach cycle, with `ACTIVITY_EXPIRY_TICK_MS = 250` in [`activity-lifetime.ts`](../../src/frontend/src/multiplayer/activity-lifetime.ts), is only the fallback for time passing with no reduction: a line is pruned at the first tick at or after its deadline. Becoming visible prunes immediately before the next scheduled frame, and `dispose()` clears the interval so no callback, publish or state change follows teardown.
exit=0

$ grep -F "### presence" docs/product/glossary.md
### presence
exit=0
```

### Dependency-free relative-link check — exit 0

```text
$ node -e "const fs=require('fs'),p=require('path');for(const f of ['docs/architecture/realtime.md','docs/architecture/observability.md','docs/architecture/frontend-rendering.md','docs/product/glossary.md'])for(const m of fs.readFileSync(f,'utf8').matchAll(/\]\(([^)#]+)/g))if(!/^https?:/.test(m[1])&&!fs.existsSync(p.resolve(p.dirname(f),m[1]))){console.error(f,m[1]);process.exit(1)}"
linkcheck_exit=0
```

### `git diff --check` (four docs) — exit 0

```text
$ git diff --check -- docs/architecture/realtime.md docs/architecture/observability.md docs/architecture/frontend-rendering.md docs/product/glossary.md
diffcheck_exit=0
```

### Unchanged documents — exit 0

```text
$ git diff --exit-code -- README.md docs/architecture/containerization.md docs/features/README.md
untouched_exit=0
```

### Source cross-check (docs vs shipped code)

```text
$ grep -n "leave\|activityEvent\|leaderboardUpdate" src/backend/src/observability/metrics.ts
70:        'leave',
95:        'activityEvent',
96:        'leaderboardUpdate',
121:        'activityEvent',
122:        'leaderboardUpdate',

$ grep -n "ACTIVITY_EVENT_TTL_MS\|ACTIVITY_EXPIRY_TICK_MS" src/backend/src/game/protocol.ts src/frontend/src/multiplayer/protocol.ts src/frontend/src/multiplayer/activity-lifetime.ts
src/backend/src/game/protocol.ts:45: *   connection's member. `ACTIVITY_EVENT_TTL_MS` pins the 5000 ms activity eligibility TTL
src/backend/src/game/protocol.ts:79: * `serverNow - event.at < ACTIVITY_EVENT_TTL_MS`; at exactly 5000 ms it is expired and can
src/backend/src/game/protocol.ts:83:export const ACTIVITY_EVENT_TTL_MS = 5000;
src/frontend/src/multiplayer/protocol.ts:45: *   shared `ACTIVITY_EVENT_TTL_MS` is mirrored here verbatim from `game/protocol.ts`.
src/frontend/src/multiplayer/protocol.ts:84: * `serverNow - event.at < ACTIVITY_EVENT_TTL_MS`; at exactly 5000 ms it is expired and never
src/frontend/src/multiplayer/protocol.ts:89:export const ACTIVITY_EVENT_TTL_MS = 5000;
src/frontend/src/multiplayer/activity-lifetime.ts:5: * `ACTIVITY_EVENT_TTL_MS` (5000 ms), so an expired event can never travel in a
src/frontend/src/multiplayer/activity-lifetime.ts:39: * session's local clock); `ACTIVITY_EXPIRY_TICK_MS` is only the cadence the session uses
src/frontend/src/multiplayer/activity-lifetime.ts:51:export const ACTIVITY_EXPIRY_TICK_MS = 250;
src/frontend/src/multiplayer/activity-lifetime.ts:81:/** Constructor options: the display lifetime, injected from `ACTIVITY_EVENT_TTL_MS`. */
src/frontend/src/multiplayer/activity-lifetime.ts:91: * (the session passes `ACTIVITY_EVENT_TTL_MS`); tests may pin a shorter value to prove it
```

### Diff stat (four docs)

```text
 docs/architecture/frontend-rendering.md |   6 +-
 docs/architecture/observability.md      |   8 ++-
 docs/architecture/realtime.md           | 123 ++++++++++++++++++++++++++++++--
 docs/product/glossary.md                |  11 ++-
 4 files changed, 134 insertions(+), 14 deletions(-)
```

## AC-20 audit

AC-20 has six clauses; each is met:

- **`docs/architecture/realtime.md` gains `## Presence and explicit leave` → met.** The section
  exists (grep exit 0) and documents the presence definition, the self-only `leave`, explicit vs
  abrupt close, multi-tab, reload residual, last member, metrics and rollback.
- **`docs/architecture/realtime.md` gains an activity `### Lifetime` subsection → met.** The
  subsection exists (grep exit 0) and documents `ACTIVITY_EVENT_TTL_MS = 5000` (grep exit 0),
  the server snapshot filter, the receipt-anchored client expiry, tombstones and the 250 ms
  fallback.
- **`docs/architecture/observability.md` lists `leave` in the
  `cubeclicker_ws_messages_received_total` allow-list and states the explicit-leave `members_active`
  behavior → met.** The table row includes `leave`; the `members_active` row and the added
  paragraph state "An explicit leave drops … immediately; an abrupt close keeps the grace-window
  member counted until expiry" (two greps exit 0).
- **`docs/architecture/observability.md` corrects the
  `cubeclicker_ws_messages_encoded_total`/`cubeclicker_ws_frames_sent_total` rows to include
  `activityEvent` and `leaderboardUpdate`, matching `metrics.ts` → met.** The encoded row lists both
  values, the frames row is "same as encoded", the added paragraph states it (grep exit 0), and the
  source cross-check shows `metrics.ts` lines 95/96 (encoded) and 121/122 (frames).
- **`docs/architecture/frontend-rendering.md` records the page-lifecycle subscription and the
  `ACTIVITY_EXPIRY_TICK_MS` session timer → met.** Both greps exit 0; the attach list, the
  **Page-lifecycle leave** paragraph (including the `leave` send and its no-send cases) and the
  **Activity display expiry** paragraph (synchronous prune on every reduction + 250 ms fallback +
  visibility resume + dispose) are present.
- **`docs/product/glossary.md` adds `### presence` and updates `### activity feed` and
  `### server member` → met.** The new term exists (grep exit 0); both existing terms now describe
  the five-second live window/fresh snapshots and explicit leave vs grace.
- **Every relative link resolves (T8 one-liner) → met.** Link check exit 0 over the four edited
  docs.
- **`docs/features/README.md` is proposed but not edited → met.** The file is byte-unchanged
  (`git diff --exit-code` exit 0); the candidate row is recorded below for the orchestrator/T9.
- **`README.md` and `containerization.md` are unchanged → met.** `git diff --exit-code` exit 0.

## Proposed `docs/features/README.md` row (NOT applied)

Candidate row (T9 owns the final proposal and the state/date):

```diff
+| presence-and-activity-liveness | Presence & Activity Liveness (explicit leave on pagehide; five-second activity lifetime) | building | 2026-11-16 |
```

## Deviations from spec

None. Documentation-only task: no production code, no tests, no coverage delta, no container or
package change.
