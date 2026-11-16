# Build log — T5 — Frontend activity lifetime + prune helper

Task: T5 (`presence-and-activity-liveness`, 2026-11-16)
Files changed:

- `src/frontend/src/multiplayer/activity-lifetime.ts` (new)
- `src/frontend/src/multiplayer/activity-lifetime.test.ts` (new)
- `src/frontend/src/multiplayer/server-state.ts` (edit: pure `pruneActivity`)
- `src/frontend/src/multiplayer/server-state.test.ts` (edit: prune tests)
- `docs/features/presence-and-activity-liveness/build-log-T5.md`

## Sketch (≤5 lines)

1. `activity-lifetime.ts`: per-server maps of first-seen display deadlines (`serverId` → `eventId` → `now + ttl`) plus tombstones; `observe` records first-seen only, converts expired deadlines to tombstones, prunes expired tombstones and drops servers no longer in the current/pending feeds; `isExpired`, `dropServer`, `clear`, `size`; `ACTIVITY_EXPIRY_TICK_MS = 250`.
2. `server-state.ts`: pure `pruneActivity(state, isExpired)` filtering the current and pending-travel feeds, same `WorldState` reference on a no-op, untouched branch identity preserved.
3. Tests: the three T5 scenarios (current+pending travel with no post-seed welcome; same-server rejoin with no pending swap; tombstone/no-reappearance/stale-server cleanup) at exact local times, plus prune reference stability and bounded size.

## What changed & why

1. **`activity-lifetime.ts`** — the client display-lifetime bookkeeping the session (T6) will own:
   - deadlines and tombstones are keyed by `serverId` then event `id` (server ids are never reused; ids restart at 1 per server), so numeric-id collisions across servers never alias;
   - `observe(feeds, nowMs)` sets `now + ttlMs` **only on first sight** — a re-seed (`welcome` after a same-server rejoin) keeps the remaining lifetime;
   - an observed deadline at/before `nowMs` moves to a tombstone (`nowMs + ttlMs`); while it is active `isExpired` is `true`, so a boundary re-seed is filtered by the synchronous prune and never enters the published feed;
   - a live server's deadline is retained even after its line leaves the feed, so a prune-only fallback tick cannot lose the expiry — the next `observe` converts it before the re-seed is considered;
   - servers that are neither current nor pending are dropped (deadlines and tombstones) on every `observe`; tombstones are pruned when their window elapses, so `size()` is bounded by the two feeds plus one TTL of tombstones;
   - `ACTIVITY_EXPIRY_TICK_MS = 250` is exported as data for the session's fallback scheduler; the module creates no timer and reads no clock.
2. **`server-state.ts`** — `pruneActivity(state, isExpired)`: filters `state.activity` against `state.serverId` and `pendingWorldSwap.activity` against the pending `serverId` independently. No-op returns the same `WorldState` reference; a current-only removal keeps `pendingWorldSwap` (and its arrays) identical and vice versa; surviving events keep their identity (filter, no copy).
3. **Tests** — 18 new tests in `activity-lifetime.test.ts` (deadline boundaries, injected TTL, no extension, tombstones, stale cleanup, `dropServer`/`clear`, bounded size, the three AC scenarios) and 7 new tests in `server-state.test.ts` (`pruneActivity` reference stability, branch identity, per-server scoping, no-pending and empty-feed no-ops).

## Decisions

- **Tombstone anchor:** `nowMs + ttlMs` at the observation that detects the expiry, not `deadline + ttlMs`. The detection lag (≤ 250 ms) can never shorten the suppression window; the window is exclusive (`now < until` is active), matching the deadline's inclusive expiry (`now >= deadline` is expired), so a key is released exactly one TTL after expiry is observed.
- **Deadline retention:** deadlines of live servers are not dropped just because their line disappeared from the feed; they are only converted (tombstone) or dropped with the server. This makes the AC-17 guarantee independent of whether the caller's fallback prune called `observe`.
- **`size()` semantics:** number of live deadlines + tombstones; converting a deadline to a tombstone does not grow it. For two full feeds it is exactly `2 * ACTIVITY_FEED_LIMIT` (40) and returns to 0 one TTL after expiry. Keys live at most two TTL windows from first sight while their server stays live (deadline, then tombstone), so the tracker is bounded by the events observed in that window rather than by session length.
- **Injected TTL, not an import:** `createActivityLifetime` requires `{ ttlMs }` per the plan; T6 passes `ACTIVITY_EVENT_TTL_MS`. A test with `ttlMs: 1000` proves the lifetime is not hard-coded.
- **No copies in `pruneActivity`:** expiry is a removal, not a re-encode; surviving events keep their object identity so React memoisation is not invalidated by a prune that removes another line.

## Test scenarios (exact local times)

Pipeline under test is the session order pinned by the plan: `reduceWorldState` → `lifetime.observe(feeds, now)` → synchronous `pruneActivity` → (only then would the session publish). The scenario harness also drives `applyWorldSwap` at the travel midpoint.

### AC-15 — current + pending travel without a post-seed welcome

| t (ms) | Frame / action | Current feed | Pending feed | Tracked keys |
| --- | --- | --- | --- | --- |
| 0 | `welcome` server 1, `[e1]` | `[e1]` (deadline 5000) | — | 1 |
| 1000 | `worldEntered` server 2, `[e2]` | `[e1]` | `[e2]` (deadline 6000) | 2 |
| 3000 | `activityEvent` e3 (server 2) | `[e1]` | `[e3, e2]` (e3 deadline 8000) | 3 |
| 4999 | observe → prune | `[e1]` | `[e3, e2]` | 3 |
| 5000 | observe → prune | `[]` (e1 tombstoned until 10000) | `[e3, e2]` — same `pendingWorldSwap` reference | 3 |
| 6000 | observe → prune | `[]` — same array reference | `[e3]` (e2 tombstoned until 11000) | 3 |
| 7000 | `applyWorldSwap` → observe → prune | `[e3]` (deadline 8000 preserved) | — | 2 (server 1 keys dropped) |
| 8000 | observe → prune | `[]` | — | — |

### AC-16 — same-server rejoin, no pending swap

1. t = 0: `welcome` server 1 seeds e1; `isExpired(1, 1, 4999) === false`, `isExpired(1, 1, 5000) === true`.
2. t = 1000: abrupt socket drop — no world reduction; the fallback prune keeps `[e1]`.
3. t = 4000: same-server rejoin `welcome` re-seeds `[e2, e1]` (new id 2). e1 is still current and its deadline is **not** extended (e1 expires at 5000, not 9000); e2 is anchored at 9000.
4. t = 4999: `[e2, e1]`; t = 5000: `[e2]`; t = 8999: `[e2]`; t = 9000: `[]`.

### AC-17 — tombstone/no-reappearance/stale-server cleanup

1. t = 0: `welcome` server 1 seeds e1 (deadline 5000). t = 5000: e1 is removed and tombstoned (`size() === 1`).
2. t = 5001: `welcome` server 1 re-seeds e1 → the reduction's synchronous prune returns `[]` **immediately** (no 250 ms tick); `isExpired(1, 1, 5001) === true`.
3. t = 6000 and t = 9999: further re-seeds stay `[]`; the feed remains empty.
4. t = 10000: the tombstone (observed expiry 5000 + 5000) is released; the next seed is fresh (deadline 15000; expired at exactly 15000).
5. t = 5001 (separate scene): `welcome` server 2 drops server 1's tombstone; server 2's id 1 is a new key with deadline 10001 (colliding numeric id tracked independently). At 10001 it becomes a tombstone; at 15001 `size() === 0`.
6. Bounded: two full feeds (20 + 20 distinct `serverId:id` keys) → `size() === 40`; re-observing both feeds at 4000 adds nothing; all deadlines become tombstones at 5000 (`size() === 40`); observing at 10000 → `size() === 0`.

## Test tiers

- **Unit:** both modules are pure (no clock, no timers, no DOM); every boundary is asserted with the caller-injected `nowMs`, including the 4999/5000 and 14999/15000 boundaries.
- **Integration (module seam):** the three scenarios drive the real reducer (`reduceWorldState` over `welcome`/`worldEntered`/`activityEvent`) and the real `applyWorldSwap` through the lifetime and prune in the session's pinned order, so the two new/changed modules are exercised together, not only in isolation.
- **Documented exception for the socket/session boundary:** this task owns no session or transport file. The real `Session`/WebSocket boundary of this behavior is implemented and tested by T6 (`session.ts`, `session.test.ts`) and proven end-to-end by T7/T9 (containerized smoke). No production code is excluded from coverage.

## Verify — raw output

```
$ npm run lint

> lint
> eslint .

lint EXIT=0
```

```
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

typecheck EXIT=0
```

```
$ npm test --workspace @cubeclicker/frontend
...
 ✓ src/multiplayer/server-state.test.ts (87 tests) 15ms
 ✓ src/multiplayer/activity-lifetime.test.ts (18 tests) 7ms
...
 Test Files  75 passed (75)
      Tests  2287 passed (2287)
   Duration  3.14s (transform 9.31s, setup 0ms, collect 21.73s, tests 11.07s, environment 7.55s, prepare 5.87s)
test EXIT=0
```

Test-count delta vs T4 (74 files / 2262 tests): 75 files / 2287 tests = +18 new
`activity-lifetime.test.ts` tests and +7 `pruneActivity` tests.

```
$ npm run coverage --workspace @cubeclicker/frontend
...
 ✓ src/multiplayer/server-state.test.ts (87 tests) 32ms
 ✓ src/multiplayer/activity-lifetime.test.ts (18 tests) 21ms
...
 Test Files  75 passed (75)
      Tests  2287 passed (2287)
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.66 |    96.41 |   97.83 |   96.66 |
 src/multiplayer   |   94.88 |    97.35 |   96.87 |   94.88 |
  ...y-lifetime.ts |     100 |      100 |     100 |     100 |
  protocol.ts      |   91.85 |    97.15 |   92.85 |   91.85 |
  server-state.ts  |   97.79 |    95.67 |     100 |   97.79 |
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |   99.49 |      100 |     100 |   99.49 |
coverage EXIT=0
```

Coverage gate: statements 96.66, branches 96.41, functions 97.83, lines 96.66 (all ≥ 80);
`activity-lifetime.ts` 100/100/100/100, `server-state.ts` 97.79/95.67/100/97.79. No
exclusion or threshold change.

```
$ git diff --check

diff-check EXIT=0
```

## Acceptance audit

- **AC-5 — Derived views agree after leave.** Met by the unchanged reducer contract this
  task's prune helper must preserve: `reduceWorldState` on `memberLeft` removes the member
  from `members` (the sole member input to `Users on Server`), pinned in
  `server-state.test.ts` (`removes a left member and preserves the remaining order` →
  `[P3_MEMBER]`). `pruneActivity` never touches `members`/`self`/`leaderboard` (identity
  asserted in the prune tests), so it cannot affect the derived views. The hub/roster/
  leaderboard frame evidence for AC-5 remains T3's (`hub.test.ts`); the frontend suite is
  green unchanged.
- **AC-15 — Current + pending travel expiry (no post-seed welcome).** Met. Exact timeline
  test: e1 removed at 5000, e2 at 6000, e3 survives the 7000 swap and expires at 8000;
  current-only and pending-only removals preserve the other branch's reference (asserted
  with `toBe` on `pendingWorldSwap` and on the current `activity` array).
- **AC-16 — Same-server rejoin preserves the remaining lifetime.** Met. e1's deadline
  stays 5000 across the 4000 re-seed (present at 4999, absent at 5000, not extended to
  9000); the newly seeded id 2 expires at 9000; no pending swap exists throughout.
- **AC-17 — Tombstones, no reappearance, stale-server cleanup, bounded state.** Met. The
  5001 re-seed is filtered synchronously (feed `[]` immediately after the reduction, no
  tick); the feed stays empty through 9999; the key is released at 10000; a different
  server drops server 1's tombstone and tracks the same numeric id independently; `size()`
  is 40 for two full feeds and 0 after the tombstone window.
- **AC-18 — Client scheduler and reducer hygiene (T5 half).** Met for the owned modules:
  `ACTIVITY_EXPIRY_TICK_MS === 250`; an empty feed and a no-expiry prune return the same
  `WorldState` reference (no publish); a current-only or pending-only change preserves the
  untouched branch's identity; `pruneActivity` is pure and reads no clock. The session's
  interval, visibility-resume prune and `dispose()` cleanup are T6's (`session.ts`,
  `session.test.ts`) and will be audited there.

## Deviations from spec

None. The public API matches the plan (`ACTIVITY_EXPIRY_TICK_MS`, `ActivityFeedSlice`,
`ActivityLifetime`, `createActivityLifetime({ ttlMs })`, `pruneActivity(state,
isExpired)`); the options type is exported as `ActivityLifetimeOptions` for the caller.
No dependency, script, container or coverage-config change.
