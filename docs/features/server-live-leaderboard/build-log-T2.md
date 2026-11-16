# Build log — T2 — Hub counters, snapshot delivery, coalescing and metrics

Task: T2 (2026-11-16)

Files changed:
- `src/backend/src/game/hub.ts` (edit)
- `src/backend/src/game/hub.test.ts` (edit)
- `src/backend/src/observability/metrics.ts` (edit)
- `src/backend/src/observability/metrics.test.ts` (edit)
- `src/backend/src/app.test.ts` (fixture-only, authorized)
- `docs/features/server-live-leaderboard/build-log-T2.md` (this file)

Sketch (before implementation):
1. Put the three session counters on `Member` and increment them only at the hub's already-validated click/completion points; mark that server dirty there and on join/leave transitions.
2. Build every snapshot at flush time from `registry.forEachMember` + `sessionStats`; add it to `placementFor` for fresh/rejoin `welcome` and `worldEntered`.
3. Create one per-server coalescer (1000 ms) whose flush encodes one `leaderboardUpdate` through the existing encode-once `broadcast` (no `except`), drop a destroyed server's timer, and `discard()` on `hub.close()`.
4. Extend only the two metrics `type` allow-lists; pin the counters, cadence, ordering, isolation, privacy, encode-once, non-regression and shutdown behavior in the hub integration suite.

What changed & why:
- `hub.ts`: `Member.sessionStats { clicks; facesDestroyed; cubesCompleted }` starts at zero on `join`, survives grace and travels with a move. `handleExplode` increments `clicks` after `validateExplode` succeeds and the id is in `removedIds`, increments `facesDestroyed` iff the existing `faceCleared` predicate is true, then marks the member's server dirty. `handleCompletion` increments `cubesCompleted` exactly once after `isComplete` (before the target snapshot is built); a same-server completion marks that server, a move marks the old server when it still has members (otherwise `leaderboard.dropServer`) and marks the target server. `handleJoin` marks the assignment server; `removeMember` drops a destroyed server's timer or marks a surviving server; rejoin/rotate/purchase/lootbox/equip/unequip, socket close and grace start mark nothing.
- `hub.ts`: `collectLeaderboardMembers(serverId)` maps the registry's slot order to `{ playerId, name, clicks, facesDestroyed, cubesCompleted }`; `snapshotFor(serverId)` calls `buildLeaderboardSnapshot(serverId, deps.now(), …)` at build time (no cache); `placementFor` adds `leaderboard`, so fresh/rejoin `welcome` and `worldEntered` carry the current snapshot. One `createLeaderboardCoalescer({ intervalMs: LEADERBOARD_INTERVAL_MS, timers, flush: publishLeaderboard })` publishes one `leaderboardUpdateMessage(snapshotFor(serverId))` through the existing encode-once `broadcast` (no `except`); `publishLeaderboard` returns when `closed` or the server has no members. `hub.close()` calls `leaderboard.discard()`.
- `metrics.ts`: `leaderboardUpdate` added to the `type` allow-lists of `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total` only; no metric definition, bucket or label changed.
- `hub.test.ts`: the existing suites gained exact `leaderboard` objects on the move `worldEntered` fixtures and an explicit `messagesWithoutLeaderboard`/`sentTextsWithoutLeaderboard` filter where a test asserts unrelated protocol frames and a timer advance now legitimately yields a coalesced ranking frame (no assertion was weakened; the leaderboard's own presence/cadence/payload is pinned by the new suite). 17 new integration tests cover the T2 acceptance surface.
- `metrics.test.ts`: the two pinned allow-list arrays include `leaderboardUpdate` and a new case proves both outbound counters accept the type and create their series, with the catalog still exactly 30 metrics.

Decisions:
- The counters live on `Member` (not a server ledger), so a mover keeps them, a grace member keeps them and final removal deletes them with the member — the same lifecycle as `playerId`/`name`.
- No cached snapshot: the flush and every `welcome`/`worldEntered` build from live members, so a move/removal cannot leave a stale rank or total.
- The target snapshot is built after `member.cube` is replaced and `cubesCompleted` incremented, so `worldEntered.leaderboard` includes the completion that caused the move.
- `publishLeaderboard` has a no-members guard as a backstop; the normal path drops a destroyed server's timer (`dropServer`) and `hub.close()` discards all of them.
- `app.test.ts` received the authorized fixture-only change: a `nextWithoutLeaderboard` helper used only in the live-socket packing test, because the additive 1 s frame can interleave with the protocol frames that test pins. No production code and no other app test changed.
- Existing activity-feed/economy assertions keep their exact arrays; only frames of the additive type are filtered out in tests that do not assert the ranking.

Evidence:

`npm run lint` (root) → exit 0
```
> lint
> eslint .

EXIT:0
```

`npm run typecheck` (root, both workspaces) → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT:0
```

`npm run test --workspace @cubeclicker/backend` → exit 0
```
 Test Files  37 passed (37)
      Tests  1506 passed (1506)
   Start at  08:59:41
   Duration  3.49s (transform 4.32s, setup 0ms, collect 12.44s, tests 13.82s, environment 7ms, prepare 3.83s)
EXIT:0
```
(`hub.test.ts` grew from 163 to 181 tests: +18 leaderboard integration cases; `metrics.test.ts` from 31 to 32; backend total 1487 → 1506.)

New T2 suite (filtered run, all 18 passing):
```
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > counts only accepted clicks and a face clear at the existing boundary (AC-1)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > increments facesDestroyed only once the whole face is removed (AC-1)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > increments cubesCompleted once per accepted completion only (AC-2)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > ranks guests and accounts identically from the same accepted actions (AC-3)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > carries one zero entry in a fresh welcome and the current ranking on rejoin (AC-7)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > keeps a grace member ranked, then drops them and their totals on removal (AC-10)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > attributes a completion to the mover and drops the old server totals (AC-2/AC-8)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > publishes a join snapshot at 999 ms and the coalesced frame at 1000 ms (AC-9)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > coalesces ten accepted clicks into one frame and starts a new window after it (AC-9)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > publishes top five entries and totals over all current members (AC-5/AC-6)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > encodes one frame once and fans the same bytes to every member with metrics (AC-11/AC-16)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > keeps two servers isolated and addresses a snapshot to its own server (AC-12)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > emits nothing on a quiet server, a rotate or a rejoin (AC-10)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > emits nothing for a purchase, a loot open or an equip (AC-10)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > leaves the 40 ms removal and 250 ms economy paths unchanged (AC-11)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > keeps every leaderboard counter and the token out of the snapshot frames (AC-24)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > drops a destroyed server timer on a last-member move and never flushes it (AC-13)
 ✓ src/game/hub.test.ts > server live leaderboard (server-live-leaderboard) > discards every pending flush on close and never sends afterwards (AC-13)

 Test Files  1 passed (1)
      Tests  18 passed | 163 skipped (181)
```

`npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds 80/80/80/80)
```
 Test Files  37 passed (37)
      Tests  1506 passed (1506)
```
(Full table from the final run: All files 96.19/89.83/99.57/96.19; `hub.ts` 90.84/88.28/98.46/90.84; `leaderboard.ts` 100/100/100/100; `metrics.ts` 99.45/93.54/100/99.45.)

Exact leaderboard frame asserted by the encode-once/metrics test (`first` and `second` both receive this text):
```
{"type":"leaderboardUpdate","leaderboard":{"serverId":1,"at":1000,"entries":[{"playerId":"p1","name":"Player 1","cubesCompleted":0,"clicks":0},{"playerId":"p2","name":"Player 2","cubesCompleted":0,"clicks":0}],"totals":{"cubesCompleted":0,"clicks":0,"facesDestroyed":0}}}
```

Acceptance audit (T2 scope per `tasks.md`):
- AC-1 → met: accepted/invalid/rate-limited/oversized/pre-join click test and the face-clear boundary (8 clicks → `facesDestroyed 0`; 9th → `clicks 9`, `facesDestroyed 1`), with the existing `error`/`stateSync` replies pinned exactly.
- AC-2 → met: accepted completion → `cubesCompleted 1` (+54 clicks, 6 faces); invalid/incomplete/wrong-level completions add nothing; the mover's `worldEntered` snapshot carries the increment and the old server's snapshot excludes the mover.
- AC-3 → met: a guest and an account with identical accepted actions produce the identical snapshot object (same counters, rank and totals, different public name only); no economy/account value is read.
- AC-4 (hub) → met at the protocol layer in T1; the hub accepts no client leaderboard message (the client catalog is unchanged) and only the server emits `leaderboardUpdate`.
- AC-5 (hub) → met: six members → exactly five entries in rank order with totals over all six (`clicks 21` while the entries sum to 20).
- AC-6 (hub) → met: the six-member test pins clicks-descending rank with slot-order ties; the rejoin test pins the click tie-break above slot order.
- AC-7 → met: fresh `welcome` has one zero entry; the second join sees both; a rejoin at 500 ms carries counters accumulated while the socket was closed, with the rejoiner's own count unchanged.
- AC-8 (backend) → met: `worldEntered` carries the target snapshot including the completion; a target-server `leaderboardUpdate` is the same builder output (the client-side travel window is T3).
- AC-9 (hub) → met: no frame at 999 ms, exactly one at 1000 ms; ten accepted clicks → one frame with all ten; a change after the flush starts a new window at 2001 ms.
- AC-10 → met: quiet server, rotate, rejoin, purchase, loot open and equip emit no frame; a socket close emits no frame and the member stays ranked, then the grace-expiry removal marks the server and the next frame drops them and their totals.
- AC-11 → met: one `JSON.stringify` call per `leaderboardUpdate`, identical text on both recipients, metrics encoded=1/frames=2; the 40 ms removal and 250 ms economy paths keep their exact boundaries and frames.
- AC-12 (backend) → met: two servers on separate ids; each snapshot only reaches its own member; a mover's target snapshot is the only one applied to the mover.
- AC-13 (hub) → met: `hub.close()` discards pending flushes (`vi.getTimerCount() === 0`), no frame after close, a second close is inert; a destroyed server's pending click timer is dropped on the last-member move (exact timer count without it) and `publishLeaderboard` skips a memberless server; T1 pins the coalescer's `dropServer`.
- AC-16 → met: one broadcast increments `cubeclicker_ws_messages_encoded_total{type="leaderboardUpdate"}` by 1 and `cubeclicker_ws_frames_sent_total{type="leaderboardUpdate"}` by the recipient count without throwing; the catalog still has exactly 30 metrics and the metrics unit test pins both allow-lists; an unlisted value still throws (existing case).
- AC-24 (hub) → met: the welcome and update frames parse to exactly `serverId`/`at`/`entries[playerId,name,cubesCompleted,clicks]`/`totals`; the encoded scans contain neither the account user id, the token, `coins`, `economy`, `accountId` nor `upgrades`.

Out of T2 scope by `tasks.md` (owned by T3–T5): the frontend protocol mirror/reducer/session, the `Leaderboard` panel/CSS, the `tests/e2e/smoke.mjs` welcome/update checks, `docs/architecture/realtime.md`, `docs/product/glossary.md` and the final root gate. No frontend, compose, Dockerfile, workflow or package file was touched.

Deviations from spec: none in behavior. One authorized test-fixture deviation: `src/backend/src/app.test.ts` (not in T2's `files_owned`) gained a `nextWithoutLeaderboard` helper used only by the existing live-socket packing test, because the required additive `leaderboardUpdate` frame can interleave with the protocol frames that test pins; no production code and no other assertion in that file changed. `hub.test.ts` also records the new exact `leaderboard` fixture on four move `worldEntered` expectations and filters only the additive frame in tests that assert unrelated protocol/activity frames.
