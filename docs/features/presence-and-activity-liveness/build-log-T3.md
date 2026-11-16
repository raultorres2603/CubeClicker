# Build log — T3 — Backend hub explicit leave

Task: T3 — Backend hub explicit leave (2026-11-16)
Files changed: `src/backend/src/game/hub.ts`, `src/backend/src/game/hub.test.ts`, `docs/features/presence-and-activity-liveness/build-log-T3.md`
What changed & why: the hub now dispatches the additive client frame `{ type: 'leave' }`; a joined connection's handler finalizes **only its own** member through the existing `removeMember` final-removal path (immediate `memberLeft(left)`, activity/leaderboard cleanup, destroy-if-empty), pins `closeReason = 'client'` and closes the peer. `handleClose`, the grace tracker, the heartbeat and token rejoin are untouched for every close without an accepted `leave`. The five T2-reported pre-TTL `hub.test.ts` expectations (plus one masked follow-on in the same test) are re-pinned to the approved ≤5-fresh-event welcome/`worldEntered` contract (AC-13), and the new explicit-leave integration suite is added.

## Decisions

- **Handler placement.** `leave` is dispatched after the `join`/`rejoin` cases and before `memberFor`; `handleLeave` reuses `memberFor`, so a non-joined connection gets the existing `error not_joined` and removes nothing. No new state, timer, message or dependency.
- **Final-removal reuse.** `handleLeave` calls `removeMember(member.playerId)` and then `connection.peer.close()`. The following close event finds no member (the member/token are already deleted) and starts no grace; `handleClose` itself is unchanged. `closeReason` is set to `'client'` before removal so the close metric/log use the pinned deliberate-close label.
- **Terminal socket.** Per the Q-9 decision the server closes the peer after the leave, so no orphan connection can `join` again; the token is deleted with the member, so `rejoin` returns `resume_failed`.
- **Re-pin scope.** The T2 log listed five failing test cases; the third one (`re-plans after every executed move…`) aborted at its first stale `worldEntered.activity` assertion, hiding a sixth `at: 0` seed later in the same test body (line 1590 at HEAD). It is the same superseded `live-activity-feed` AC-10/AC-13 payload, so it is re-pinned in the same change; no expectation was weakened (the expired element is removed, every remaining value stays exact).
- **No production timer, no coverage exclusion, no dependency.**

## The re-pins (superseded `live-activity-feed` AC-10/AC-13 → this feature's AC-13)

All now assert only events younger than `ACTIVITY_EVENT_TTL_MS` (5000 ms); an event at `at` is fresh iff `snapshotNow - at < 5000`.

| Location (pre-change line) | Old expectation | New expectation |
| --- | --- | --- |
| `hub.test.ts:1282` | `worldEntered.activity` at 31 000 = `[memberLeft p1 @30 000, memberJoined p1 @0]` | `[memberLeft p1 @30 000]` — the `at: 0` join is 31 000 ms old |
| `hub.test.ts:1408` | `worldEntered.activity` at 31 000 = `[memberLeft p2 @30 000, memberJoined p1 @0]` | `[memberLeft p2 @30 000]` |
| `hub.test.ts:1526` | `worldEntered.activity` at 31 000 = `[memberLeft p1 @30 000, memberJoined p1 @0]` | `[memberLeft p1 @30 000]` |
| `hub.test.ts:4949` | `welcome.activity` at 16 999 = `[cubeCleared id 2 @16 000, memberJoined id 1 @0]` | `[cubeCleared id 2 @16 000]` — age 999 ms is fresh, `at: 0` is expired |
| `hub.test.ts:5489` | `welcome.activity` ids `[26…7]` (20-event ring), `activity[19] = fastClear id 7 @6000` | ids `[26, 25, 24, 23, 22]` (the five fresh events), `activity[4] = fastClear id 22 @21 000 level 21`; the same-instant verifier join sees the same five. The 20-event ring itself stays proven by `activity.test.ts` with the `ttlMs: 1_000_000` seam (T2) |
| `hub.test.ts:1590` (masked behind the 1526 failure) | fifth member's `worldEntered.activity` at 32 000 = `[memberLeft p3 @31 000, memberJoined p3 @0]` | `[memberLeft p3 @31 000]` |

The test title `keeps a 20-event newest-first ring and serves it on reconnect with eviction (AC-10/AC-13)` is re-titled `serves only the five fresh events from the ring on reconnect (AC-13)` to name the contract the hub now serves.

## New explicit-leave integration suite

`describe('explicit leave (presence-and-activity-liveness)')` — a metrics-injected, manual-clock, fake-timer hub over the real registry/protocol builders and fake peers:

- **AC-1:** A/B joined (capacity 2): timers 3→2 on leave (no grace timer for p1); B receives exactly `memberLeft(left)` then the accepted `activityEvent memberLeft`; A receives nothing and its peer recorded exactly one `close()`; gauges 2→1 members and 1→1 servers; after advancing 30 000 ms there is still exactly one `memberLeft` for p1.
- **AC-2:** A clears a full 3×3 level (54 clicks / 6 faces), drops without `leave`, no `memberLeft` before the deadline; at `grace − 1` a `rejoin` returns the same `p1`/server 1/slot-1 position/`removedIds`, roster `[A, B]`, and the resumed `welcome.leaderboard` entries `p1 clicks 54`, `p2 clicks 0`, `totals.facesDestroyed 6`. Second test: no rejoin → exactly one `memberLeft(left)` + activity at exactly `t + 30 000`, and the next join takes slot 1 as `p3`.
- **AC-3:** after leave, two `rejoin {token}` attempts get `resume_failed`; the following `join` creates `p3` / `Player 3` in slot 1 with a new token and roster `[p3, p2]`.
- **AC-4:** last-member leave: timers 2→0, gauges 0/0, peer closed once, no `memberLeft`/`activityEvent` to any peer, token no longer resolves, next join creates server 2; abrupt close of the last member keeps `servers_active = 1` through the grace and drops it to 0 at the deadline (ring teardown is pinned by the existing `activity.test.ts` `drops only the named server buffer` / `is terminal after clear()` tests, green in this run).
- **AC-5:** after A's click + leave, the next coalesced `leaderboardUpdate` is exactly `entries [p2]`, `totals` zero; C joins into slot 1, `welcome.roster = [C, B]` (slot order), `welcome.position = A's slot-1 position`, `welcome.leaderboard.entries = [p3, p2]` with zero totals.
- **AC-6:** two joined account tabs `u1`; tab 1's leave removes only `p1`, sends `memberLeft(left)` to tab 2, keeps tab 2 open/joined, the next snapshot has exactly `[p2 alice]` with zero totals, and tab 2's accepted `explode` is still broadcast.
- **AC-8:** a `leave` from a never-joined connection gets exactly `error not_joined`, closes nothing, removes nothing, and the joined member's click still works.
- **AC-9:** one leave increments `cubeclicker_ws_messages_received_total{type="leave"}` to 1; gauges `members_active` 1 / `servers_active` 1 / `ws_connections_open` 1; `ws_connections_closed_total{reason="client"}` 1; `ws_messages_encoded_total{type="leave"}` absent (no server message type was added).
- **AC-13:** rejoin `welcome` at 4999 carries both the `at: 0` and `at: 1000` events; at exactly 5000 only the `at: 1000` event; a fresh join at 6000 carries `[]`; a `worldEntered` at 5500 carries only the target server's fresh `memberLeft @1000` (its own `at: 0` join expired, and the source server's fresh `at: 1000` join does not travel).
- **AC-14 (hub side):** the pre-existing `server activity feed` test `encodes an accepted event once and fans the identical text to every member (AC-14)` is unchanged and green (one `JSON.stringify` per accepted event, identical bytes to every recipient).

The fake peer gained a `closeCalls` counter (incremented only by a hub-initiated `close()`; an abrupt test `drop()` does not) so AC-1/AC-4/AC-6 assert the exact `close()` call, not just `closed`.

## Evidence

### `npm run lint` — exit 0

```text
> lint
> eslint .
```

### `npm run typecheck` — exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

### `npm test --workspace @cubeclicker/backend` — exit 0

```text
 Test Files  37 passed (37)
      Tests  1537 passed (1537)
   Duration  3.32s (transform 3.80s, setup 0ms, collect 11.39s, tests 13.62s, environment 6ms, prepare 3.65s)
```

Focused suite (during development):

```text
 ✓ src/game/hub.test.ts (193 tests) 163ms
 Test Files  1 passed (1)
      Tests  193 passed (193)
```

### `npm run coverage --workspace @cubeclicker/backend` — exit 0

```text
 Test Files  37 passed (37)
      Tests  1537 passed (1537)
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    96.2 |    89.92 |   99.57 |    96.2 |
 src/game          |   95.64 |    94.35 |   99.03 |   95.64 |
  activity.ts      |     100 |      100 |     100 |     100 |
  hub.ts           |    91.1 |    88.69 |   98.48 |    91.1 | ...1716,1767-1770
-------------------|---------|----------|---------|---------|-------------------
```

(The omitted rows are the unrelated `src/auth`, `src/db`, `src/observability` and root files from the same run; every workspace aggregate is above the 80 threshold in all four metrics and the command exited 0 with the V8 thresholds enabled.)

### `git diff --check` — exit 0

```text
(no output)
```

## Acceptance audit

- **AC-1 — Explicit leave removes presence immediately → met.** Test `removes the member immediately on leave, closes the peer and leaves no grace timer (AC-1)`: B receives exactly `{"type":"memberLeft","playerId":"p1","reason":"left"}` then the accepted `memberLeft` activity event; A receives nothing; `first.closeCalls === 1`; `vi.getTimerCount()` 3 → 2; `members_active` 2 → 1 and `servers_active` 1; after `advance(RECONNECT_GRACE_MS)` exactly one `memberLeft` for p1 remains.
- **AC-2 — Abrupt close keeps grace and reconnect → met.** `keeps the accepted grace and resumes identity, cube and counters on rejoin (AC-2)` (no `memberLeft` before the deadline; same `playerId`/`serverId`/`position`/`self.removedIds`, roster `[A, B]`, resumed `leaderboard.entries` `p1 clicks 54`/`cubesCompleted 0`, `totals.facesDestroyed 6`) and `finalizes an unrejoined abrupt close exactly at the grace deadline and frees the slot (AC-2)` (exactly one `memberLeft(left)` + activity at the deadline, then p3 takes slot 1).
- **AC-3 — Rejoin after leave fails; fresh join succeeds → met.** `fails rejoin after leave and creates a fresh member in the freed slot (AC-3)`: two `resume_failed` errors, then `p3` / `Player 3` at A's slot-1 position, a new token and roster `[p3, p2]`.
- **AC-4 — Last-member leave destroys the server immediately → met.** `destroys the last member server immediately on leave and starts no grace (AC-4)` (`vi.getTimerCount()` 2 → 0, `servers_active`/`members_active` 0, one peer close, no frames, token fails, next join server 2) and `keeps an abruptly closed last member server alive through the grace window (AC-4)`; activity ring teardown is the existing `activity.test.ts` `dropServer`/`clear` evidence, green in this run.
- **AC-5 — Derived views agree after leave → met.** `rebuilds roster and leaderboard inputs from the surviving members after leave (AC-5)`: next coalesced snapshot exactly `[p2]` with zero totals; C fills slot 1; `welcome.roster` exactly `[C, B]`, `welcome.position` equals A's old slot-1 position, `welcome.leaderboard.entries` exactly `[p3, p2]` with zero totals. (The frontend `reduceWorldState` memberLeft case is an existing reducer assertion outside this task's files; the backend integration inputs it consumes are pinned here.)
- **AC-6 — Multi-tab leave is per connection → met.** `leaves only the sending tab and keeps the account other tab playing (AC-6)`: only tab 1's member leaves, tab 2 stays open/joined, the next snapshot has one `p2 alice` row with zero totals, and tab 2's accepted `explode` is broadcast.
- **AC-9 — Metrics and close reason → met.** `counts the leave frame and the client close reason exactly once (AC-9)`: received `leave` 1, `members_active` 1, `servers_active` 1, `ws_connections_open` 1, closed `reason="client"` 1, encoded `leave` absent.
- **AC-13 — Snapshots never carry expired events → met.** `carries only unexpired events on welcome across the 4999/5000 boundary (AC-13)` and `carries only the target server unexpired events on worldEntered (AC-13)`; plus the five/six re-pinned welcome/`worldEntered` expectations.
- **AC-14 — Live frame unchanged → met.** The unchanged `encodes an accepted event once and fans the identical text to every member (AC-14)` test is green; no live-frame code was touched.
- **AC-8 (task test list: no leave before join) → met.** `rejects leave from a connection that never joined and removes nothing (AC-8)`.

Deviations from spec: none in production behavior. The only change beyond the five listed re-pins is the sixth masked assertion in the same test body (same superseded payload, recorded above), and the fake peer's `closeCalls` test-only counter. Documentation for presence/explicit leave is T8-owned (`docs/architecture/realtime.md`, `docs/architecture/observability.md`); no docs were edited here.
