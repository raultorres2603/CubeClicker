# Build log — T1 — Activity feed core and wire catalog (backend)

Task: T1 (2026-11-15)

Files changed:
- `src/backend/src/game/protocol.ts` (edit)
- `src/backend/src/game/protocol.test.ts` (edit)
- `src/backend/src/game/activity.ts` (new)
- `src/backend/src/game/activity.test.ts` (new)
- `src/backend/src/game/hub.test.ts` (3 additive fixture lines — see Deviations)
- `docs/features/live-activity-feed/build-log-T1.md` (this file)

What changed & why:
- Added the additive server-only `activityEvent` frame, the six-variant `ActivityEvent` union, `ACTIVITY_FEED_LIMIT = 20`, `parseActivityEvent` (the shared validation matrix), `copyActivityEvent` and `activityEventMessage` (re-validate + copy, `TypeError` on invalid) to the backend wire catalog; `Placement`/`welcome`/`worldEntered` carry an optional `activity` ring that `placementPayload` always emits as a copied array (absent → `[]`). No client message and no protocol version bump.
- Added `game/activity.ts`: one `createActivityFeed({ now, limit?, minIntervalMs? })` per hub with lazy per-server `{ nextId, lastAcceptedAt, events }`, `nextId` starting at 1 per server, an inclusive 1000 ms drop-not-queue gate, a newest-first 20-event ring, defensive `snapshot` copies, `dropServer` and a terminal `clear()`; no timer anywhere.
- Tests pin the exact 999/1000 ms boundary, the 0..4500 ms ten-candidate sequence, per-server id/window isolation, the 25-event ring `[25 … 6]`, copy semantics, lifecycle/closed-flag inertness, the zero-timer guarantee, every validation-matrix row, the exact representative encoded frame and the client-`activityEvent` rejection.

Decisions:
- `record` returns a defensive copy of the accepted event; the ring stores its own object, so a caller cannot mutate feed state.
- `clear()` clears every ring and closes the instance (terminal); `dropServer` after close is a no-op.
- Unknown extra event fields are dropped, not rejected, per the shared matrix ("pinned shape only").
- The whole `welcome`/`worldEntered` expectation is unchanged except for the additive `activity: []`; no existing message shape was renamed or removed.

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
      Tests  1295 passed (1295)
   Start at  21:02:30
   Duration  3.63s (transform 3.70s, setup 0ms, collect 9.47s, tests 14.09s, environment 6ms, prepare 3.28s)
```

Targeted new tests:
```
$ cd src/backend && npx vitest run src/game/activity.test.ts src/game/protocol.test.ts -t "activity"
 ✓ src/game/activity.test.ts (19 tests | 18 skipped) 2ms
 ✓ src/game/protocol.test.ts (315 tests | 249 skipped) 10ms
 Test Files  2 passed (2)
      Tests  67 passed | 267 skipped (334)
```

`npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds 80/80/80/80)
```
 % Coverage report from v8
All files          |   96.06 |    89.46 |   99.55 |   96.06 |
  activity.ts      |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.18 |    98.93 |   97.29 |   99.18 | 327-328,817-818
```
(The uncovered `protocol.ts` lines are pre-existing `join`-mode and `purchaseUpgradeMessage` lines, not the new activity code.)

Exact representative frame asserted by `protocol.test.ts`:
```
{"type":"activityEvent","event":{"id":1,"at":1000,"serverId":1,"type":"cubeCleared","playerId":"p2","name":"Player 2","level":3}}
```

Acceptance audit:
- AC-8 → met: the client catalog is unchanged; `parseClientMessage` on a client `activityEvent` frame (with or without a payload) returns `{ ok: false, error: 'bad_message' }` (`protocol.test.ts` "never accepts a client activityEvent frame").
- AC-9 (unit) → met: first candidate accepted, 999 ms dropped, exactly 1000 ms accepted, 1999 dropped, 2000 accepted; the 0..4500 ms sequence yields accepted ids/ats `[1,0], [2,1000], [3,2000], [4,3000], [5,4000]`; dropped candidates consume no id and do not move the window (`activity.test.ts` "1/s per-server gate").
- AC-10 → met: 25 acceptances leave ids `[25,24,…,6]` newest first with `at` 24000/5000 at the ends; each server starts at id 1 with an independent window; `snapshot` returns fresh arrays/objects and `[]` for unknown/empty servers.
- AC-12 (builder half) → met: `activityEventMessage` re-validates and copies every event type, throws `TypeError('invalid activityEvent payload')` for all 56 invalid matrix rows, and the exact representative encoded frame is pinned. (Metrics increments are T2.)
- AC-15 (backend half) → met: backend exports `ACTIVITY_FEED_LIMIT`, the six-variant union, `parseActivityEvent`, `copyActivityEvent` and `activityEventMessage` with the full validation matrix; the frontend mirror + parity table are T3.
- AC-24 (builder half) → met: every event field is server-issued (`id`/`at`/`serverId`/`playerId`/`name`/`level`/`elapsedMs`/`partId`); no account id, token, email, IP or free text exists in the shape (the frame builder drops unknown extras), and the client catalog still has no activity message. (The encoded privacy scan is T2.)
- AC-11 (T1 half) → met: `dropServer` deletes one ring, `clear()` is terminal (`record` null, `snapshot` `[]`, `dropServer` and a second `clear()` no-ops), and a fake-timer `getTimerCount()` assertion proves the feed schedules no timer.

Deviations from spec:
- `src/backend/src/game/hub.test.ts` is outside T1's `files_owned`, but the pinned `placementPayload` contract (always emit `activity`, absent → `[]`) makes three exact `worldEntered` tests fail (four fixture objects: one in each of the first two tests, two in the packing test). I added only the additive `activity: []` line to those four expected objects; no production hub code, assertion strength or other test content was changed. This is fixture churn caused by the pinned additive field and should be acknowledged by T2, which owns `hub.test.ts`.
- Everything else follows `tasks.md` T1: no hub derivation, metrics, frontend, compose, package or env change.

Out-of-scope files untouched: `src/backend/src/game/hub.ts`, `src/backend/src/app.ts`, `src/backend/src/observability/*`, `src/frontend/**`, `compose*.yaml`, both Dockerfiles, `package.json`, `package-lock.json`, `.env*`.
