# Build log — T3 — Frontend protocol mirror, reducer and session chain

Task: T3 (2026-11-16)

Files changed:
- `src/frontend/src/multiplayer/protocol.ts` (edit)
- `src/frontend/src/multiplayer/protocol.test.ts` (edit)
- `src/frontend/src/multiplayer/server-state.ts` (edit)
- `src/frontend/src/multiplayer/server-state.test.ts` (edit)
- `src/frontend/src/game/session.ts` (edit)
- `src/frontend/src/game/session.test.ts` (edit)
- `src/frontend/src/App.test.tsx` (fixture-only, authorized)
- `docs/features/server-live-leaderboard/build-log-T3.md` (this file)

Sketch (before implementation):
1. Mirror the backend's leaderboard catalog in `multiplayer/protocol.ts`: constant, types, parser, copier, builder, the `leaderboardUpdate` server message and the optional `leaderboard` placement field with the `serverId` cross-check.
2. Add `leaderboard` to `WorldState`/`PendingWorldSwap`, seed it from `welcome`, carry the target snapshot through `worldEntered`/`applyWorldSwap`, and route `leaderboardUpdate` by server with deep-equality no-ops and a cross-server guard.
3. Add the explicit no-action `leaderboardUpdate` case in the session (the reducer owns the panel) and pin the behavior with protocol, reducer and real-transport integration tests.

What changed & why:
- `protocol.ts`: `LEADERBOARD_TOP_LIMIT = 5`, `LeaderboardEntry`, `LeaderboardSnapshot`, `parseLeaderboardSnapshot` (positive-integer `serverId`; finite non-negative `at`; 0…5 entries; non-empty `playerId`/`name`; non-negative-integer `cubesCompleted`/`clicks`; a `totals` object with three non-negative-integer counters; unknown fields dropped; fresh copies), `copyLeaderboardSnapshot` and `leaderboardUpdateMessage` (re-validate + copy, `TypeError` on invalid) mirror the backend verbatim. `ServerMessage` gains the server-only `leaderboardUpdate` union; `welcome`/`worldEntered` gain `leaderboard?`. `parsePlacement` decodes the optional snapshot, omits it when absent (legacy) and returns `bad_message` when present but non-object/over-long/invalid or when `leaderboard.serverId` differs from the enclosing placement's `serverId`. The client catalog has no leaderboard message.
- `server-state.ts`: `WorldState.leaderboard` and `PendingWorldSwap.leaderboard` (both `LeaderboardSnapshot | null`); `createWorldState()` starts `null`. `welcome` deep-copies the snapshot (absent → `null`) and replaces any previous one. `worldEntered` copies the target snapshot into `pendingWorldSwap` without touching the current snapshot. `leaderboardUpdate` checks the pending target first (replace `pendingWorldSwap.leaderboard`, current untouched), then the current server (replace `state.leaderboard`), otherwise returns the same state; a deep-equal snapshot returns the same state reference and only the leaderboard branch is replaced. `applyWorldSwap` applies the pending snapshot (or `null`) and clears the swap. `self`/`members`/`activity` keep their identity on every update.
- `session.ts`: explicit `leaderboardUpdate` case with no engine/scene action; `publishMultiplayer()` already notifies the store when the reducer changed. The travel-window behavior is the existing `applyWorldSwap` midpoint path, now carrying the pending ranking.
- Tests: `protocol.test.ts` replays the backend's valid/invalid fixture table verbatim (AC-15), pins the exact representative frame, client rejection, malformed decoder frames, placement decode/legacy/rejection and deep copies; `server-state.test.ts` covers the null seed, welcome seed/replace/absent, five-entry server-order preservation, update/no-op/mismatch identity, pending/old-server travel routing, midpoint swap, pending-null swap and guest/account parity; `session.test.ts` runs the exact `welcome` + `leaderboardUpdate` frames through the real transport decoder, real reducer and multiplayer snapshot, asserts no engine events, and covers the `worldEntered` → target update → old-server update → `applyWorldSwap` chain.

Decisions:
- The frontend keeps the server order verbatim; the reducer never re-sorts and never recomputes totals (server-authoritative values).
- `leaderboardUpdate` checks the pending target before the current server, matching `activityEvent` and preventing a target snapshot from touching the old server's panel.
- Deep equality (`serverId`, `at`, entries in order, totals) gates the same-reference no-op; a new snapshot is always copied before entering the store.
- `App.test.tsx` received a one-line fixture-only change (`leaderboard: null`) because `WorldState` now requires the field; the same minimal-fixture precedent as T2's authorized `app.test.ts` change. No production code or assertion in that file changed.

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

`npm run test --workspace @cubeclicker/frontend` → exit 0
```
 Test Files  73 passed (73)
      Tests  2229 passed (2229)
   Start at  09:06:33
   Duration  3.57s (transform 7.59s, setup 0ms, collect 23.46s, tests 12.27s, environment 8.61s, prepare 6.88s)
EXIT:0
```
(`protocol.test.ts` +472 lines, `server-state.test.ts` grew from 64 to 79 tests, `session.test.ts` +2 integration tests; frontend total 2228 → 2229 with the added pending-duplicate no-op case.)

Focused leaderboard run (91 passed):
```
npx vitest run src/multiplayer/protocol.test.ts src/multiplayer/server-state.test.ts src/game/session.test.ts -t "leaderboard" --reporter=verbose
...
✓ src/game/session.test.ts > live leaderboard over the wire (AC-15, AC-19) > passes the exact welcome.leaderboard and leaderboardUpdate frames through the real decoder and reducer 52ms
✓ src/game/session.test.ts > live leaderboard over the wire (AC-15, AC-19) > routes the target update during travel and applies it at the midpoint swap 37ms
Tests  91 passed | 639 skipped (730)
```

`npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80/80/80/80)
```
 Test Files  73 passed (73)
      Tests  2229 passed (2229)
...
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.62 |    96.33 |   97.79 |   96.62 |
  protocol.ts      |   91.82 |    97.14 |   92.85 |   91.82 | ...1554,1558-1568
  server-state.ts  |   97.65 |    95.23 |     100 |   97.65 | ...88,390-391,454
EXIT:0
```
(The remaining uncovered `protocol.ts` lines are the pre-existing `cubeRotatedMessage`/`stateSyncMessage` helpers; the remaining `server-state.ts` lines are the pre-existing self-rotation and economy-equality branches. The new leaderboard branch — including the pending duplicate no-op — is fully covered.)

Exact representative frame asserted byte-for-byte:
```
{"type":"leaderboardUpdate","leaderboard":{"serverId":1,"at":1000,"entries":[{"playerId":"p1","name":"Player 1","cubesCompleted":2,"clicks":40}],"totals":{"cubesCompleted":2,"clicks":40,"facesDestroyed":3}}}
```

Acceptance audit (T3 scope per `tasks.md`):
- AC-7 (legacy decode) → met: the pinned legacy `welcome` (without `leaderboard`) decodes with the field omitted (`expect(...).toBeUndefined()` and `not.toHaveProperty('leaderboard')`), and the reducer maps the absent field to `leaderboard: null`; a fresh welcome deep-copies the snapshot and a rejoin welcome replaces/refreshes it.
- AC-8 (frontend) → met: `worldEntered` stores the target snapshot in `pendingWorldSwap` without changing the current snapshot; a target-server update before the midpoint replaces only the pending snapshot; the midpoint `applyWorldSwap` applies it. An old-server update during travel applies to the current snapshot and leaves the pending one untouched.
- AC-12 (frontend guard) → met: `leaderboardUpdate` for a `serverId` matching neither the current server nor a pending target returns the same state reference (tested directly and through the real transport); the placement decoder rejects a `leaderboard.serverId` that differs from the enclosing `serverId` with `bad_message`.
- AC-15 (frontend) → met: the frontend exposes the same `LEADERBOARD_TOP_LIMIT = 5`, `LeaderboardEntry`, `LeaderboardSnapshot`, `leaderboardUpdate` message, `parseLeaderboardSnapshot`, `copyLeaderboardSnapshot` and `leaderboardUpdateMessage`; the test file replays the backend's valid/invalid fixture table copied verbatim, the exact representative frame matches byte-for-byte, every invalid matrix row decodes to `bad_message`/`null`, and over-long/placement-mismatched snapshots are rejected.
- AC-17 → met: `createWorldState()` starts `leaderboard: null`; `welcome` deep-copies the snapshot or sets `null` when absent and replaces any previous value; `worldEntered` stores the target in `pendingWorldSwap.leaderboard`; `applyWorldSwap` replaces the current snapshot (or `null`) and clears the pending swap.
- AC-18 → met: a pending-target snapshot replaces only `pendingWorldSwap.leaderboard`; a current-server snapshot replaces only `state.leaderboard`; neither-server returns the same state; an identical snapshot returns the same state reference; a change replaces only the leaderboard branch (`self`, `members`, `activity` identity asserted) and the stored snapshot is a deep copy.
- AC-19 → met: with a real `createTransport` and a fake WebSocket, the exact `welcome` (carrying `leaderboard`) and a subsequent `leaderboardUpdate` frame pass through the real decoder, real `reduceWorldState` and `getMultiplayerSnapshot().world.leaderboard`; the `worldEntered` → target update → midpoint `applyWorldSwap` chain applies the updated target snapshot; `leaderboardUpdate` produces no engine events (recording engine `events` stays `[]`) and no scene action (the session has no scene work for the type).

Out of T3 scope by `tasks.md` (owned by T4–T5): the `Leaderboard` panel/App wiring/CSS, `tests/e2e/smoke.mjs`, `docs/architecture/realtime.md`, `docs/product/glossary.md` and the final root gate. No backend, UI/CSS, smoke, compose, Dockerfile, workflow or package file was touched.

Deviations from spec: none in behavior. One authorized fixture-only deviation: `src/frontend/src/App.test.tsx` (not in T3's `files_owned`) gained `leaderboard: null` in its `worldFor()` fixture because `WorldState` now requires the field; no production code, no other test fixture and no assertion changed. The single `-t leaderboard` run additionally exercises the pending-duplicate no-op branch added after the first coverage pass.
