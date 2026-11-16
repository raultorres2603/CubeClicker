# Build log — T1 — Leaderboard core and wire catalog (backend)

Task: T1 (2026-11-16)

Files changed:
- `src/backend/src/game/protocol.ts` (edit)
- `src/backend/src/game/protocol.test.ts` (edit)
- `src/backend/src/game/leaderboard.ts` (new)
- `src/backend/src/game/leaderboard.test.ts` (new)
- `docs/features/server-live-leaderboard/build-log-T1.md` (this file)

Sketch (before implementation):
1. Add `LEADERBOARD_TOP_LIMIT`, the snapshot types and the validating parser/copier/builder to the backend wire catalog; carry an optional copied `leaderboard` on `welcome`/`worldEntered`; add the server-only `leaderboardUpdate` frame; no client message, no version bump.
2. Add the pure ranking builder (cubes → clicks → slot order, top five, all-member totals) and the per-server 1 s coalescer (injected `TimerFns`, one timer per dirty server, `dropServer`/terminal `discard`/`pendingServers`).
3. Pin every validation-matrix row, the exact representative frame, placement copy/absence and the client-frame rejection in `protocol.test.ts`; pin ranking/top-five/totals/copies/parity and the coalescer boundary/lifecycle in `leaderboard.test.ts`.
4. Run the workspace gate (root lint + root typecheck + backend tests + backend coverage).

What changed & why:
- `protocol.ts`: `LeaderboardEntry`, `LeaderboardSnapshot`, `parseLeaderboardSnapshot` (positive-integer `serverId`, finite non-negative `at`, 0…5 entries, non-empty `playerId`/`name`, non-negative-integer counters, three-counter `totals`, extras dropped, fresh copies), `copyLeaderboardSnapshot` and `leaderboardUpdateMessage` (re-validate + copy, `TypeError` on invalid), `Placement.leaderboard?` copied by `placementPayload` with absence preserved, and the server-only `leaderboardUpdate` union member. The client catalog and the protocol version are unchanged.
- `leaderboard.ts`: `LEADERBOARD_INTERVAL_MS = 1000`, `LeaderboardMember`, `buildLeaderboardSnapshot` (totals over every input member, copy sorted by cubes desc → clicks desc → original index asc, sliced to `limit`, fresh entries) and `createLeaderboardCoalescer` (one timer per dirty server, entry deleted before `flush`, `dropServer`, terminal `discard`, `pendingServers`). It imports only `TimerFns` and protocol types/constant — no hub, peers or message shapes.
- Tests: the full shared validation matrix (62 invalid variants through the parser and again through the frame builder), valid 0/1/5-entry payloads, extra-field dropping, defensive copies, the exact representative frame, placement copy/absence on both carriers, and client-`leaderboardUpdate` rejection; ranking order and every tie-break, the fifth/sixth cutoff, six-member totals with five entries, 0/1/3/6-member servers, explicit `limit`, guest/account-identical inputs with an exact JSON shape (no account/coin field), and the coalescer's 999/1000 ms boundary, ten-marks-one-flush, second window, per-server independence, re-entrant mark, `dropServer`, terminal `discard` and `vi.getTimerCount() === 0`.

Decisions:
- `copyLeaderboardSnapshot` validates through the same parser and throws `TypeError('invalid leaderboard snapshot')`; `leaderboardUpdateMessage` throws `TypeError('invalid leaderboardUpdate payload')`. Both messages are pinned in tests. This keeps the builder/placement path from ever aliasing or emitting a malformed snapshot.
- The snapshot object is built in the pinned wire key order (`serverId`, `at`, `entries`, `totals`; entry `playerId`, `name`, `cubesCompleted`, `clicks`), so the exact frame assertion is byte-for-byte the spec fixture.
- `leaderboard` sits beside `activity` in `Placement` and in both placement union members; absence stays absent (no `null`, no empty object) so legacy fixtures and mixed versions are unchanged.
- The coalescer deletes the server's timer entry *before* invoking `flush`, so a flush callback that marks the same server dirty starts a fresh full window (pinned by a re-entrant test).
- No backend `leaderboard.serverId` ↔ placement `serverId` cross-check is added: the plan/spec place that guard in the frontend `parsePlacement` (T3); the backend copies the hub-built snapshot verbatim.

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

New/changed test files only:
```
$ cd src/backend && npx vitest run src/game/leaderboard.test.ts src/game/protocol.test.ts
 ✓ src/game/leaderboard.test.ts (23 tests) 11ms
 ✓ src/game/protocol.test.ts (455 tests) 27ms

 Test Files  2 passed (2)
      Tests  478 passed (478)
   Start at  08:47:11
   Duration  699ms (transform 290ms, setup 0ms, collect 529ms, tests 41ms, environment 0ms, prepare 108ms)
```
(`protocol.test.ts` grew from 315 to 455 tests: +140 leaderboard catalog cases; the 23 new `leaderboard.test.ts` cases bring the backend total from 1324 to 1487.)

`npm run test --workspace @cubeclicker/backend` → exit 0
```
 Test Files  37 passed (37)
      Tests  1487 passed (1487)
   Start at  08:47:16
   Duration  3.34s (transform 4.05s, setup 0ms, collect 11.19s, tests 13.49s, environment 6ms, prepare 3.51s)

EXIT:0
```

`npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds 80/80/80/80)
```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.22 |    89.87 |   99.56 |   96.22 |                   
 src/game          |   95.59 |     94.3 |      99 |   95.59 |                   
  activity.ts      |     100 |      100 |     100 |     100 |                   
  leaderboard.ts   |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   99.28 |    99.09 |   97.56 |   99.28 | 372-373,967-968   
 src/observability |   99.66 |     96.5 |     100 |   99.66 |                   
 ... (unchanged files omitted)
-------------------|---------|----------|---------|---------|-------------------
EXIT:0
```
The two uncovered `protocol.ts` ranges are pre-existing and unrelated to this task: `372-373` is the `join` `mode` branch and `967-968` is `purchaseUpgradeMessage`. The new `leaderboard.ts` is 100% on all four metrics and every new `protocol.ts` function is exercised.

Exact representative frame asserted by `protocol.test.ts`:
```
{"type":"leaderboardUpdate","leaderboard":{"serverId":1,"at":1000,"entries":[{"playerId":"p1","name":"Player 1","cubesCompleted":2,"clicks":40}],"totals":{"cubesCompleted":2,"clicks":40,"facesDestroyed":3}}}
```

Acceptance audit (T1 scope only, per `tasks.md` T1):
- AC-4 (protocol half) → met: the client catalog has no counter/leaderboard message; a client `leaderboardUpdate` frame (with a full payload, with no payload, and with a stray `clicks` field) decodes to `{ ok: false, error: 'bad_message' }` and no builder is reachable from `parseClientMessage` (`protocol.test.ts` "never accepts a client leaderboardUpdate frame").
- AC-5 (builder) → met: six members return exactly five entries in rank order with totals over all six (`cubesCompleted 11`, `clicks 205`, `facesDestroyed 15`), fewer than five return every member, and an empty server returns `entries: []` with zero totals; `serverId`/`at` are echoed exactly (`leaderboard.test.ts` "top five and all-member totals").
- AC-6 (builder) → met: cubes desc beats 100 clicks, clicks desc breaks a cube tie (5 > 4), equal cubes/clicks rank by lower slot, and the fifth/sixth tie keeps `p5` and omits `p6`; the input array keeps its slot order (`leaderboard.test.ts` "ranking").
- AC-9 (coalescer unit) → met: no flush at 999 ms, exactly one at 1000 ms; ten marks at 0…900 ms produce one flush at 1000 ms; further marks inside the window do not reschedule; a change at `t+1001` flushes at `t+2001` (`leaderboard.test.ts` "cadence").
- AC-13 (coalescer unit) → met: `dropServer` clears only that server (unknown server is a no-op), `discard()` is terminal (`markDirty`/`dropServer`/second `discard` inert) and leaves `vi.getTimerCount() === 0`; `pendingServers()` is exactly the number of dirty servers at every step (`leaderboard.test.ts` "cleanup").
- AC-14 → met: `leaderboardUpdateMessage` validates + deep-copies and throws `TypeError` for all 62 invalid matrix variants; `parseLeaderboardSnapshot` accepts exactly the pinned shape (0/1/5 entries, zero and fractional `at`), drops unknown fields at every level and returns fresh nested copies; `placementPayload` copies `leaderboard` into `welcome`/`worldEntered` and preserves its absence; the exact representative encoded frame is pinned.
- AC-15 (backend half) → met: the backend exports `LEADERBOARD_TOP_LIMIT = 5` (pinned equal to the builder default), `LeaderboardEntry`, `LeaderboardSnapshot`, the `leaderboardUpdate` server message, `parseLeaderboardSnapshot`, `copyLeaderboardSnapshot` and `leaderboardUpdateMessage`. The frontend mirror/parity replay is T3.
- AC-24 (builder half) → met: the builder shape is exactly `serverId`/`at`/`server-issued playerId`/`name`/integer counters + three integer totals; guest and "account" inputs with extra runtime `accountId`/`coins`/`economy` fields produce an identical snapshot whose exact JSON carries none of them, and extra wire fields are dropped by the parser. No client message exists (AC-4 test).

Out of T1 scope by `tasks.md` (T2 `files_owned` excludes T1): the hub accepted-only increments (AC-1), completion/mover/grace counter attribution (AC-2/AC-3 hub half), the 1 s hub integration frames (AC-9 hub), snapshots on `welcome`/`worldEntered` from the hub (AC-7/AC-8), metrics allow-lists (AC-16) and the privacy scan of real hub frames (AC-24 hub half). No hub, metrics, frontend, compose or architecture file was touched.

Deviations from spec: none. `protocol.ts` gained only the additive catalog surface; no version bump, no client message, coins stay excluded, and the existing 40 ms/250 ms paths are untouched.
