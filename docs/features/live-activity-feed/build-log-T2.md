# Build log — T2 — Hub derivation, welcome/reconnect, metrics allow-list

Task: T2 (2026-11-15)

Files changed:
- `src/backend/src/game/hub.ts` (edit)
- `src/backend/src/game/hub.test.ts` (edit: 13 existing exact expectations + 28-test activity suite)
- `src/backend/src/observability/metrics.ts` (edit: two `type` allow-list values)
- `src/backend/src/observability/metrics.test.ts` (edit: allow-list pins + one acceptance test)
- `src/backend/src/app.test.ts` (fixture-only: pinned clock + two activity frames — see Deviations)
- `docs/features/live-activity-feed/build-log-T2.md` (this file)

What changed & why:
- One `createActivityFeed({ now: deps.now })` per hub; `placementFor` adds `activity: activity.snapshot(location.serverId)`, so fresh `welcome`, rejoin `welcome` and `worldEntered` carry the target ring as a defensive copy. `recordActivity(serverId, input, except?)` records a candidate and broadcasts `activityEventMessage(event)` only on acceptance, through the existing encode-once `broadcast` (the fresh join passes `except = member.playerId`).
- Derivation at the validated points only: `handleJoin` records `memberJoined` after `welcome`/`memberJoined`; `handleRejoin` records nothing; `handleCompletion` captures the completed 1-based cube, `elapsedMs` and `bonus`, then records exactly one `levelMilestone` (multiple of 5) → `fastClear` (bonus) → `cubeCleared`, on the post-move server; a move records the old server's `memberLeft` only when it still has members (otherwise `activity.dropServer`), the completion is the sole new-server candidate, and the move-in join is never recorded; `removeMember` records `memberLeft` only for `removal.left && !removal.serverDestroyed` (destroy deletes the buffer, a no-op removal records nothing); `handleOpenLootbox` records `epicLoot` only for an epic rarity on a live server. `hub.close()` calls the terminal `activity.clear()` and the closed guard keeps late paths inert.
- `metrics.ts` adds exactly `activityEvent` to the `type` allow-lists of `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total`; no metric definition is added or changed (the catalog stays 30).
- Tests: 13 pre-existing exact expectations gained the additive activity frames/ring entries; the new `server activity feed (live-activity-feed)` suite has 28 tests covering every derivation type, dropped counterparts, gate boundaries, move precedence, ring/reconnect, isolation, encode-once, metrics, privacy, batching non-regression and shutdown.

Decisions:
- `recordCompletion` is one local helper (milestone > fastClear > cubeCleared) so the completion precedence exists in exactly one place.
- `serverHasMembers` is a `registry.forEachMember` probe (no registry API change), per plan key decision 12.
- The old-server `memberLeft` is recorded right after the `memberLeft (moved)` broadcast; the new-server completion is recorded after the `memberJoined` broadcast, so a move-in join can never consume the target window.
- The 28-test suite asserts full rings via later `welcome` snapshots where a dropped candidate is invisible on the wire: the snapshot pins exact ids (`…, 2, 1`), which proves a dropped candidate consumed no id and never entered the ring.
- Existing fixtures were updated with exact activity frames only; no assertion was loosened, skipped or removed.

Evidence:

`npm run lint` (root) → exit 0
```
> lint
> eslint .
```

`npm run typecheck` (root, both workspaces) → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

`npm run test --workspace @cubeclicker/backend` → exit 0
```
 Test Files  36 passed (36)
      Tests  1324 passed (1324)
   Start at  21:16:25
   Duration  3.33s (transform 3.07s, setup 0ms, collect 10.42s, tests 13.23s, environment 6ms, prepare 3.67s)
```
(The live-socket three-server flow runs green inside it: `✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3) 1114ms`.)

Targeted T2 files: `npx vitest run src/game/hub.test.ts src/observability/metrics.test.ts src/app.test.ts` → exit 0
```
 ✓ src/observability/metrics.test.ts (31 tests) 9ms
 ✓ src/game/hub.test.ts (163 tests) 136ms
 ✓ src/app.test.ts (37 tests) 2335ms
 Test Files  3 passed (3)
      Tests  231 passed (231)
```

`npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds 80 statements/branches/functions/lines)
```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   96.13 |    89.58 |   99.55 |   96.13 |
 src/game          |   95.33 |    93.94 |   98.94 |   95.33 |
  activity.ts      |     100 |      100 |     100 |     100 |
  hub.ts           |   90.76 |    88.45 |   98.36 |   90.76 | ...1585,1636-1639
 src/observability |   99.66 |     96.5 |     100 |   99.66 |
  metrics.ts       |   99.44 |    93.54 |     100 |   99.44 | 245-246
```

Acceptance audit:
- AC-1 → met: `records a cubeCleared for a slow completion` (exact `cubeCleared` at 20 s) and `creates no candidate for an invalid completion` (only `error invalid_completion` + `stateSync`, unchanged ring); the dropped counterpart is `drops a 999 ms cubeCleared candidate without consuming an id`.
- AC-2 → met: `records a fastClear with the hub-measured completion time` pins `elapsedMs: 1000`; `drops a 999 ms fastClear candidate without consuming an id`; the existing `boundary: exactly at threshold qualifies for speed bonus` / slow-completion economy tests remain green.
- AC-3 → met: `prefers levelMilestone over a fast 5th completion and never emits two events` pins the four `fastClear` events then exactly one `levelMilestone` at level 5; `drops a 999 ms levelMilestone candidate without consuming an id` proves the dropped candidate consumes no id.
- AC-4 → met: `records an epicLoot for new and duplicate epics` (both `epicLoot`, `duplicate` true/false), `drops a 999 ms epicLoot candidate…`, `creates no epicLoot for rare, failed or guest opens`, `drops an in-flight duplicate open before any draw or candidate` (one draw, one reveal, one event).
- AC-5 → met: `records a fresh join once and excludes the joiner from its own live frame` (joiner's welcome ring, no live frame, existing member gets the protocol + activity frames) and `drops a 999 ms memberJoined candidate…`; `records no event on rejoin and carries the current ring`.
- AC-6 → met: `records a final grace-expiry leave after the protocol broadcast`, `drops a 999 ms memberLeft candidate…`, `drops the buffer when the leave destroys the server`, `records nothing for a reported no-op removal`.
- AC-7 → met: `move: the accepted completion is the sole new-server event…` (old-server leave after its protocol frame, `worldEntered` target ring, one completion event, no move-in join event) and `move: a dropped completion adds no new-server event…` (no leave id, no completion event, `memberJoined` protocol only).
- AC-9 (integration) → met: `accepts exactly at the inclusive 1000 ms boundary across event types` (999 joins dropped, completion at +1000 accepted, join at +999 dropped, join at +1000 accepted) plus a dropped case for each of the six types.
- AC-11 → met: `drops the buffer when the leave destroys the server` (next server's `welcome.activity` is `[]`), `sends nothing after close and leaves the feed inert` (late join/completion/drop after `hub.close()` produce no frame; a second `close()` is a no-op), and the feed's terminal `clear()` is unit-tested in T1.
- AC-12 (metrics/hub) → met: `increments both metrics with the activityEvent type only` pins broadcasts/fan-out, one encode and per-recipient sent frames; `metrics.test.ts` pins `activityEvent` in both allow-lists, accepts it on both counters and asserts the catalog is still exactly 30 metrics.
- AC-13 → met: fresh join/rejoin rings are pinned, `keeps a 20-event newest-first ring and serves it on reconnect with eviction` pins ids `[26…7]` with 25 events while away, and the move test pins `worldEntered.activity`.
- AC-14 → met: `encodes an accepted event once and fans the identical text to every member` (`JSON.stringify` spy count 1, identical exact text on both peers), the move tests pin precedence, and `leaves the 40 ms removal batching and 250 ms economy cadence unchanged` keeps the 39/1 ms batch flush and the 249/1 ms economy window.
- AC-23 (backend) → met: `isolates two servers: buffers, ids and fan-out` (each server's first event id 2 after its own id 1 join; each peer receives only its own `serverId` frame).
- AC-24 (backend) → met: `keeps the activity frame and welcome snapshot privacy-clean` serializes only `activityEvent` events and `welcome.activity` arrays and asserts the token, `account-9`, `"token"`, `accountId` and `email` are absent, while the exempt welcome envelope still carries the account identity.
- AC-25 (backend) → met: the six per-type dropped cases pin "no frame, no id, no ring entry"; a move adds at most one new-server event (accepted test) or none (dropped test); `sends nothing after close` proves no post-close send; the feed schedules no timer (T1 `getTimerCount()` test) and the batching/economy cadence test proves the existing timers are unchanged.

Deviations from spec:
- `src/backend/src/app.test.ts` is outside T2's `files_owned`; the additive `activityEvent` frames made its live-socket A/B/C flow receive the queued p1-leave and p3-move-out frames before the `memberJoined`/`memberLeft` it expected. The fix is fixture-only: it uses the existing `BuildAppOptions.now` test seam to pin `clock = 1_000_000` for the five joins, waits 250 ms for the server to observe p1's close before pinning the deadline, and then asserts the two now-deterministic activity frames exactly (`id: 2`, `at: 1_001_000`, `memberLeft` p1/p3). This also pins the two 999 ms completion candidates as dropped (the move flow's `memberJoined`/`memberLeft` choreography is unchanged). No production code, assertion strength or other app test changed.
- No other deviation: frontend, compose, Dockerfiles, package files, `.env*` and T3–T5 artifacts are untouched.

Out-of-scope files untouched: `src/frontend/**`, `tests/e2e/**`, `compose*.yaml`, both Dockerfiles, `package.json`, `package-lock.json`, `.env*`, `docs/features/live-activity-feed/{spec,plan,tasks,status}.md`, `docs/features/live-activity-feed/reviews/**`.
