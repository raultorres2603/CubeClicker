# Build log — T6 — Frontend session + browser env

Task: T6 (`presence-and-activity-liveness`, 2026-11-16)
Files changed:

- `src/frontend/src/browser-env.ts` (edit: `pagehide` → `PageLifecycleSource`)
- `src/frontend/src/browser-env.test.ts` (edit: subscription/unsubscribe/`persisted` tests)
- `src/frontend/src/game/session.ts` (edit: pagehide leave, synchronous prune wiring, 250 ms fallback, swap/visibility/dispose)
- `src/frontend/src/game/session.test.ts` (edit: pagehide conditions, expiry timing, travel/rejoin/tombstone, visibility, dispose)
- `docs/features/presence-and-activity-liveness/build-log-T6.md`

## Sketch (≤5 lines)

1. `browser-env.ts`: a `pageLifecycle` source on the `pagehide` event forwarding `event.persisted === true`; optional on `SessionEnvironment` for source compatibility.
2. `session.ts`: the session-owned `ActivityLifetime`; every world reduction runs `reduceWorldState → observe → synchronous pruneActivity → message switch/handler publish`, and both `applyWorldSwap` paths run `swap → observe → prune` before their publish.
3. One 250 ms `ACTIVITY_EXPIRY_TICK_MS` interval per online attach cycle is the fallback for time passing without a reduction; visibility resume prunes before the next frame; `teardown` clears the interval and the lifetime.
4. A non-bfcache `pagehide` while welcomed and connected sends `{ type: 'leave' }` through `try/catch`; every other path (bfcache, pre-welcome, disconnected, disposed) sends nothing.
5. Tests: exact pagehide matrix + throwing fake socket, 4999/5000 expiry, the split travel/rejoin/tombstone timelines (including the immediate 5001 `[]`, before any tick), visibility, and no callback/publish after dispose.

## What changed & why

### `browser-env.ts`

- New `PageLifecycleSource` (`subscribe(cb: (persisted: boolean) => void)`) reads the window's
  `pagehide` event:
  `const handler = (event: PageTransitionEvent) => cb(event.persisted === true)`.
  The strict comparison makes an absent flag (`undefined`) forward `false`, so only a real
  bfcache transition is treated as "not a close".
- The source is returned as `env.pageLifecycle`; `SessionEnvironment.pageLifecycle` is
  optional, so custom environments (including every existing test env) keep type-checking.

### `session.ts`

- **Display lifetime.** One `activityLifetime = createActivityLifetime({ ttlMs: ACTIVITY_EVENT_TTL_MS })`
  per session; `clear()` on teardown. It is fed the current feed plus, while travelling, the
  pending target feed.
- **Exact wiring order (the spec's r3 pinned order).** In `handleServerMessage`, immediately
  after the reduction and **before** the message switch:

  ```ts
  world = reduceWorldState(world, message);
  world = pruneWorldActivity(world, currentNow());   // observe(feeds) → pruneActivity
  switch (message.type) { /* handleWelcome / handleWorldEntered / … */ }
  activeScene?.applyWorldMessage(message);
  publishMultiplayer();
  ```

  `pruneWorldActivity` is `lifetime.observe(activityFeeds(world), now)` followed by
  `pruneActivity(world, (serverId, eventId) => lifetime.isExpired(serverId, eventId, now))`.
  Because the prune runs before the switch, the handler-specific publishes inside
  `handleWelcome` and `handleWorldEntered` (and the reduction's final
  `publishMultiplayer()`) all see the pruned world. A tombstoned or newly expired seed is
  therefore never published — not for one tick, and not before any timer runs.
- **Travel/swap.** Both `applyWorldSwap` sites run the same order before their publish:
  the frame-loop level midpoint (`world = applyWorldSwap(world); world =
  pruneWorldActivity(world, currentNow());`) and the defensive `handleWorldEntered`
  fallback (`applyWorldSwap → pruneWorldActivity → enterWorld → publishMultiplayer`). At the
  midpoint the pending events become current with their original deadlines, so an event that
  expired while travelling is removed before the swap is published.
- **250 ms fallback.** `ACTIVITY_EXPIRY_TICK_MS` (250, imported from the T5 module) drives one
  `setInterval(pruneExpiredActivity, …)` per attach cycle. `pruneExpiredActivity` prunes both
  feeds at `currentNow()` and publishes **only** when `pruneActivity` returned a new
  `WorldState` reference (an empty feed or a no-op prune performs no publish).
- **Visibility resume.** `onVisibilityChange(false)` calls `pruneExpiredActivity()` before
  `frameBaselineMs = env.now()` and `scheduleFrame()`, so a throttled background tab never
  renders a line past its deadline after becoming visible. `terminate`/hide keeps the
  existing frame-loop pause.
- **Pagehide leave.** `env.pageLifecycle.subscribe(onPageHide)` is registered in `start()`
  and removed through the existing `unsubscribers` list. `onPageHide`:

  ```ts
  if (persisted || !active || !welcomed || status !== 'connected' || transport === undefined) return;
  try { transport.send({ type: 'leave' }); } catch { return; }
  ```

  Only a non-bfcache `pagehide` while welcomed and connected sends the additive, self-only
  `leave`; the `try/catch` is required because `WebSocket.send` throws on a CLOSING/CLOSED
  socket and an unload handler must not throw. `dispose()` deliberately sends nothing (a
  StrictMode/remount teardown is not a deliberate close and must keep the grace reconnect).
- **Teardown.** `teardown` clears the expiry interval before the remaining cleanup, and
  `activityLifetime.clear()` releases deadlines/tombstones; `onPageHide` is unsubscribed via
  `unsubscribers`. No interval callback, publish, send or state change can occur after
  `dispose()`.

## Decisions

- **Expiry interval only in online sessions.** A session without a transport never reduces a
  world and its feed is always `createWorldState().activity` (`[]`), so a 250 ms timer would
  be pure waste. `start()` mounts the interval when `online` (a transport was injected) and
  the offline behaviour (frames, listeners, snapshots) is otherwise unchanged. AC-18's
  "per attach cycle" is therefore satisfied for every session that can carry activity; the
  offline branch is asserted with `vi.getTimerCount() === 0` in the new interval test.
- **Defensive `onPageHide` guards.** `!active`, `!welcomed` and `status !== 'connected'`
  each pin a documented non-close path and are covered by tests (escaped callback after
  dispose, pre-welcome pagehide, disconnected pagehide). The `transport === undefined`
  operand is a type-narrowing guard that is unreachable at runtime — `welcomed` and
  `status === 'connected'` can only be reached through a transport — but TypeScript needs it
  to narrow `transport` before `transport.send`; it is retained as the explicit offline
  guard. No test was added for it (unreachable by construction); the branch is recorded here
  as the residual.
- **Lifetime is session-scoped, not attach-scoped.** It is created once and cleared on
  teardown, so a same-server rejoin (a `reconnect` status change plus a `welcome`, no
  dispose) keeps deadlines and tombstones, which is what AC-16/AC-17 require. A disposed and
  re-attached session starts with empty bookkeeping.

## Test scenarios (exact local times)

### AC-7 — pagehide matrix

| Case | Source | Result |
| --- | --- | --- |
| welcome → `pagehide(false)` (real transport + fake socket) | `session.test.ts` | socket frames exactly `['{"type":"join","mode":"guest"}', '{"type":"leave"}']`; the leave frame is byte-exact |
| welcome → `pagehide(true)` | `session.test.ts` | no further frame (bfcache is not a close) |
| connected, **before** welcome → `pagehide(false)` | `session.test.ts` | no frame |
| welcome → status `disconnected` → `pagehide(false)` | `session.test.ts` | no frame |
| `dispose()` alone | `session.test.ts` | no frame; page-lifecycle unsubscribed once |
| callback escaping after `dispose()` | `session.test.ts` | no frame |
| fake socket `send` throws | `session.test.ts` | attempted frame is exactly `[{ type: 'leave' }]`, handler completes, teardown removes both transport handlers, unsubscribes the lifecycle source and leaves `vi.getTimerCount() === 0` |
| environment without `pageLifecycle` | `session.test.ts` | attach works, no subscription, nothing sent |
| `window` `pagehide` forwarding | `browser-env.test.ts` | `{persisted:false}`/`{}`/`{persisted:true}` → `[false,false,true]`; exact `'pagehide'` listener removed on unsubscribe |

### AC-15 — current + pending travel without a post-seed welcome

Session integration test (real engine level travel, real reducer, real `applyWorldSwap` at the
midpoint; no `welcome` after the pending seed):

| t (ms) | Frame / action | Current feed | Pending feed |
| --- | --- | --- | --- |
| 0 | `welcome` server 1 `[e1]` | `[e1]` | — |
| 1000 | `worldEntered` server 2 `[e2]` (travel) | `[e1]` | `[e2]` |
| 3000 | live `activityEvent` e3 (server 2) | `[e1]` | `[e3, e2]` |
| 4999 | fallback tick | `[e1]` | `[e3, e2]` |
| 5000 | fallback tick | `[]` | `[e3, e2]` |
| 6000 | fallback tick | `[]` | `[e3]` |
| 7000 | frame midpoint `applyWorldSwap → observe → prune` | `[e3]`, `serverId 2`, `pendingWorldSwap null` | — |
| 8000 | fallback tick | `[]` | — |

### AC-16 — same-server rejoin, no pending swap

t = 0 `welcome` `[e1]` (deadline 5000) → t = 1000 status `disconnected` (world unchanged) →
t = 4000 same-server rejoin `welcome` re-seeds `[e2, e1]` with `pendingWorldSwap === null`.
`[e2, e1]` at 4999, `[e2]` at 5000 (e1's deadline is **not** extended to 9000), `[e2]` at
8999, `[]` at 9000.

### AC-17 — tombstone/no-reappearance/stale-server cleanup

1. t = 0 `welcome` `[e1]`; t = 5000 tick → `[]` (e1 tombstoned for 5000 ms).
2. t = 5001 same-server `welcome` re-seeds e1. **No timer is advanced**; the reduction's
   synchronous prune publishes `[]`, and a `subscribeMultiplayer` recorder asserts every
   published feed on that frame is `[]` (`publishedFeeds === [[]]`).
3. A re-delivered live `activityEvent` for the tombstoned id is also filtered to `[]`.
4. t = 6000 and t = 9999 re-seeds stay `[]`; t = 10000 the tombstone is released and the seed
   is fresh (expires at 15000).
5. t = 15001 a server-2 `welcome` drops server 1's keys and tracks the colliding numeric id 1
   independently (present until 20000, expired at 20001).

### AC-18 — scheduler/visibility/dispose

- `vi.getTimerCount()` is 1 after an online attach, 0 after `dispose()`, 1 again after a
  re-attach and 0 for an offline attach (interval only in online sessions).
- Four fallback ticks with an empty feed produce no multiplayer publish.
- Hidden at t = 5000 (no tick): `visibility(false)` prunes immediately, publishes once with
  the exact local time, and schedules the next frame (`pending() === 1`).
- After `dispose()`: `vi.getTimerCount() === 0`; 40 interval periods of fake time, an escaped
  visibility callback and an escaped pagehide callback produce no publish, no send, no frame
  and no world change (the last published feed is retained).
- Reference stability of `pruneActivity` and the `ACTIVITY_EXPIRY_TICK_MS === 250` constant
  remain pinned by T5's `activity-lifetime.test.ts`/`server-state.test.ts` (green unchanged).

## Test tiers

- **Unit:** `browser-env.test.ts` stubs the host window and asserts exactly which event is
  subscribed (`'pagehide'`), the forwarded flag values and the exact listener removed.
- **Integration:** `session.test.ts` drives the real `createTransport` over a fake socket
  (exact encoded client frames), the real engine/scene travel, the real reducer and the real
  `applyWorldSwap`, with fake host sources for the page lifecycle, visibility and clock. No
  module is mocked except the pre-existing hover-pick wrapper.
- **Containerized smoke:** not applicable to this task; T7/T9 own the cross-service proof.

## Verify — raw output

```
$ npm run lint

> lint
> eslint .

LINT_EXIT=0
```

```
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

```
$ npm test --workspace @cubeclicker/frontend
 ✓ src/ui/game-view.css.test.ts (58 tests) 26ms
 ✓ src/ui/ActivityFeed.test.tsx (7 tests) 19ms
 ✓ src/browser-env.test.ts (7 tests) 21ms
 ✓ src/game/session.test.ts (123 tests) 2111ms
 ✓ src/App.test.tsx (50 tests) 1041ms

 Test Files  75 passed (75)
      Tests  2301 passed (2301)
   Duration  3.99s (transform 9.08s, setup 0ms, collect 27.45s, tests 13.22s, environment 9.11s, prepare 8.17s)
TEST_EXIT=0
```

Test-count delta vs T5 (75 files / 2287 tests): 75 files / 2301 tests = +14 (13 new
`session.test.ts` tests in the `pagehide leave (AC-7)` and `activity display expiry in the
session` blocks, +1 `browser-env.ts` pagehide test).

```
$ npm run coverage --workspace @cubeclicker/frontend
 Test Files  75 passed (75)
      Tests  2301 passed (2301)
      Duration  6.07s (transform 9.75s, setup 0ms, collect 27.77s, tests 21.59s, environment 10.43s, prepare 10.76s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.68 |    96.43 |   97.85 |   96.68 |
 src               |   88.22 |    85.53 |   95.65 |   88.22 |
  browser-env.ts   |   93.65 |      100 |   92.85 |   93.65 | 76-79
 src/game          |   96.41 |     99.4 |   99.01 |   96.41 |
  session.ts       |   91.29 |    98.84 |   97.43 |   91.29 | ...1670,1805-1806
 src/multiplayer   |   94.88 |    97.35 |   96.87 |   94.88 |
  ...y-lifetime.ts |     100 |      100 |     100 |     100 |
  server-state.ts  |   97.79 |    95.67 |     100 |   97.79 | ...88,390-391,454
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200
COVERAGE_EXIT=0
```

Coverage gate: statements 96.68, branches 96.43, functions 97.85, lines 96.68 — all ≥ 80,
no exclusion and no threshold change. Aggregate is up from T5's 96.66/96.41/97.83/96.66.

Supplementary diagnostic (not a gate change): a second run with the JSON reporter was parsed
to confirm the **new** code is fully covered. The uncovered statements in `session.ts` are
all pre-existing paths (the dynamic browser-environment loader at 270–272, the rotate-throttle
early returns at 727/733/747/766, the removal-only reconcile fallback at 826–828, the
duplicate-RTT settle at 674–675, the async-attach rejection at 1805–1806, …); none of the new
lines 609–668 (feeds/prune/pagehide), the reduction/swap wiring, the interval or the
visibility prune is uncovered. In `browser-env.ts` the only uncovered lines are the
**pre-existing** `orientation` source (76–79); the new `pageLifecycle` source (82–91) is
100% covered and `browser-env.ts` branch coverage is 100%.

```
$ git diff --check

DIFF_CHECK_EXIT=0
```

`git status --porcelain` before the commit shows exactly the four T6-owned files modified
(`browser-env.ts`, `browser-env.test.ts`, `game/session.ts`, `game/session.test.ts`); the
untracked `docs/features/presence-and-activity-liveness/{spec,plan,tasks,status}.md`,
`reviews/` and `docs/features/game-feel-overhaul/` pre-dated this task.

## Acceptance audit

- **AC-7 — Client sends `leave` only on a non-bfcache pagehide while welcomed,
  exception-safe.** Met. `session.test.ts` pins the exact encoded frame
  (`{"type":"leave"}`) through the real transport, bfcache (`pagehide(true)`) silence,
  pre-welcome/disconnected/dispose silence, escaped-callback silence, the throwing-socket
  case (one attempted frame, handler completes, teardown intact) and the no-source attach.
  `browser-env.test.ts` pins the `pagehide` subscription, the strict `persisted` forwarding
  and the exact listener removal.
- **AC-14 — Live frame unchanged; client expiry exact.** Met for the client half: a live event
  at local t = 0 is present at 4999 ms and absent after the 5000 ms tick. The unchanged server
  broadcast/encode-once half remains T3/T1's `hub.test.ts` evidence (backend suite green at
  T5/T6 baseline, no backend file touched here).
- **AC-15 — Current + pending travel expiry (no post-seed welcome).** Met. Exact timeline
  above: e1 removed from current at 5000, e2 at 6000, e3 survives the 7000 midpoint swap and
  expires at 8000; the travel test emits no `welcome` after the pending seed.
- **AC-16 — Same-server rejoin preserves the remaining lifetime.** Met. No pending swap;
  e1's deadline stays 5000 across the 4000 re-seed (present at 4999, absent at 5000); the new
  id 2 expires at 9000.
- **AC-17 — Expired keys tombstoned and synchronously filtered; stale-server state
  dropped.** Met. Immediately after the 5001 same-server `welcome`, with no timer advanced,
  every published feed is `[]`; the feed stays empty through 9999; the key is fresh again at
  10000; a server-2 welcome drops server 1's keys and tracks the colliding id independently.
- **AC-18 — Client scheduler and reducer hygiene.** Met. One 250 ms interval per online
  attach cycle, cleared on dispose; every reduction prunes synchronously before publishing;
  empty feed/no-op prune publish nothing; visibility resume prunes immediately; after dispose
  no callback, publish, send or state change occurs.
- **AC-19 — Accessibility and reduced motion unchanged.** Met by construction and evidence:
  no UI/CSS/component file is touched in this task; `ActivityFeed.test.tsx` (7 tests),
  `App.test.tsx` (50 tests) and `game-view.css.test.ts` (58 tests) are green unchanged in the
  full frontend run (no new live region, no markup, keyframe or transition change).

## Deviations from spec

None. The session follows the plan's pinned order exactly; the only documented decisions are
the online-only interval mount and the retained defensive `onPageHide` guard described above.
No dependency, script, container, protocol or coverage-config change.
