# Build log — T3 — Frontend protocol mirror, reducer and session chain

Task: T3 (2026-11-15)

Files changed:
- `src/frontend/src/multiplayer/protocol.ts` (edit)
- `src/frontend/src/multiplayer/protocol.test.ts` (edit: parity fixture table + activity suites)
- `src/frontend/src/multiplayer/server-state.ts` (edit)
- `src/frontend/src/multiplayer/server-state.test.ts` (edit: fixtures + activity suite)
- `src/frontend/src/game/session.ts` (edit)
- `src/frontend/src/game/session.test.ts` (edit: helpers + two integration tests)
- `src/frontend/src/App.test.tsx` (fixture-only: `activity: []` — see Deviations)
- `src/frontend/src/multiplayer/transport.test.ts` (fixture-only: `activity: []` — see Deviations)
- `docs/features/live-activity-feed/build-log-T3.md` (this file)

What changed & why:
- `protocol.ts` mirrors T1 exactly: `ACTIVITY_FEED_LIMIT = 20`, the six-variant `ActivityEvent`, `parseActivityEvent` (full shared validation matrix), `copyActivityEvent`, `activityEventMessage` (re-validate + copy, `TypeError` on invalid), `activity?: ActivityEvent[]` on `Placement`/`welcome`/`worldEntered`, `{ type: 'activityEvent'; event }` in `ServerMessage`, and `parsePlacement` activity decoding: absent → `[]`, non-array / over 20 / invalid entry → `bad_message`. The client catalog is unchanged, so a client `activityEvent` frame is `bad_message`.
- `server-state.ts` adds `WorldState.activity` and `PendingWorldSwap.activity`, starts `createWorldState()` with `[]`, seeds/replaces the feed from `welcome` (copied, absent → `[]`), copies the target ring into `pendingWorldSwap` without touching the current feed, replaces it in `applyWorldSwap`, and adds the `activityEvent` case: pending-target events go to `pendingWorldSwap.activity`, current-server events to `activity`, both newest-first capped at 20 with the duplicate-`id` check against the destination and the same reference on duplicate/mismatch/no-op; only the destination branch is replaced (`self`/`members` keep identity).
- `session.ts` adds an explicit `activityEvent` case in `handleServerMessage` with no engine/scene action (the reducer owns the feed; `publishMultiplayer()` already runs) and documents the ownership in the module header.
- Tests: the backend valid/invalid fixture table is replayed verbatim on the frontend (all six valid types, every invalid variant, the 20-array bound, legacy welcome, exact frame); the reducer suite covers seed/replace/pending/swap/prepend/cap/order/duplicate/mismatch/identity/travel window; two session integration tests drive a real `createTransport` fake socket through the real decoder and reducer into `getMultiplayerSnapshot().world.activity` (welcome snapshot + live frame + malformed/wrong-server rejection; and `worldEntered` → target event before the midpoint → `applyWorldSwap`).
- One pre-gate frontend run failed on the `transport.test.ts` `WELCOME_1` fixture (decoded welcomes now always carry `activity: []`); the fix is the fixture-only change recorded under Deviations. No assertion was loosened.

Decisions:
- `parsePlacement` always returns an `activity` array (absent → `[]`), so the reducer gets one shape for legacy/mixed versions and the legacy-welcome contract is pinned at the decoder boundary (AC-15).
- `prependActivityEvent` copies only the incoming event and reuses untouched entries; the array is replaced, so referential stability holds per branch (an event change never replaces `self`/`members`).
- `applyWorldSwap` copies the pending ring into the applied feed so the discarded pending object is never aliased as the live feed.

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

`npm run test --workspace @cubeclicker/frontend` → exit 0
```
 Test Files  72 passed (72)
      Tests  2053 passed (2053)
   Start at  21:22:19
   Duration  3.12s (transform 8.58s, setup 0ms, collect 20.77s, tests 11.08s, environment 7.56s, prepare 6.03s)
```
(Targeted runs inside it: `src/multiplayer/protocol.test.ts` 397 tests, `src/multiplayer/server-state.test.ts` 65 tests, `src/game/session.test.ts` 108 tests, `src/App.test.tsx` 43 tests.)

`npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 statements/branches/functions/lines)
```
 Test Files  72 passed (72)
      Tests  2053 passed (2053)
All files          |    96.6 |    96.29 |   97.77 |    96.6 |
 src/game          |   96.34 |    99.39 |      99 |   96.34 |
  session.ts       |   90.85 |    98.78 |   97.29 |   90.85 | ...1553,1673-1674
 src/multiplayer   |   94.27 |    97.09 |   96.34 |   94.27 |
  protocol.ts      |   91.08 |    96.77 |    92.1 |   91.08 | ...1382,1386-1396
  server-state.ts  |   98.38 |    95.79 |     100 |   98.38 | ...47,349-350,411
```

Acceptance audit:
- AC-15 (frontend) → met: `activity feed wire catalog (AC-15)` pins `ACTIVITY_FEED_LIMIT = 20`, the exact representative encoded frame `{"type":"activityEvent","event":{"id":1,"at":1000,"serverId":1,"type":"cubeCleared","playerId":"p2","name":"Player 2","level":3}}`, its decode, the server-only catalog (client `activityEvent` → `bad_message`), and malformed event frames. `parseActivityEvent — valid payloads (parity table)` round-trips all six types from the backend fixture table; `parseActivityEvent — invalid payloads` rejects all 52 matrix variants (missing/non-integer/zero/negative id/serverId/level, missing/non-finite/negative at, missing/unknown type, empty playerId/name, missing type-specific fields, missing/non-finite/negative elapsedMs, empty partId); `copyActivityEvent` and `activityEventMessage` pin copy semantics and `TypeError('invalid activityEvent payload')`; `placement activity ring (AC-15)` accepts exactly 20, rejects non-array/21-entry/invalid entries, and decodes a legacy welcome without `activity` as `[]`.
- AC-16 → met: `createWorldState` starts with `activity: []` (exact object assertion); `welcome seeds a copied, newest-first feed and clears any pending swap`; `welcome replaces a previous feed and an absent ring becomes an empty feed`; `worldEntered stores the target ring in the pending swap without changing the feed`; `applies a target event received between worldEntered and applyWorldSwap at the swap` (feed replaced by the updated pending array).
- AC-17 → met: `prepends a copied event to the current feed and keeps self/members identity`; `copies the event so a later caller mutation cannot leak into the feed`; `trims the current feed to the 20 newest events` (ids 21…2); `ignores a duplicate id against the destination feed` (same reference); `routes a target-server event into the pending feed and leaves the feed untouched` (same `activity` reference); `checks duplicate ids against the pending destination independently of the feed` (pending duplicate → same reference; the same id in the current feed is not a duplicate); `trims the pending feed to the 20 newest target events`; mismatch returns the same reference.
- AC-18 → met: `passes the exact welcome.activity and activityEvent frames through the real decoder and reducer` (real `createTransport` + fake socket, `getMultiplayerSnapshot().world.activity` equals the newest-first array, malformed and wrong-server frames leave the snapshot reference unchanged); `updates the pending feed during travel and applies it at the midpoint swap` (target event between `worldEntered` and `applyWorldSwap` lands in `pendingWorldSwap.activity`, current feed untouched, midpoint swap replaces the feed with `[target event, target welcome ring]`).
- AC-23 (frontend) → met: `ignores an event whose serverId matches neither the current nor the pending server` (same reference, with and without a pending swap); `never folds an old-server event into the pending feed during travel` (old feed only, dropped at the swap); the session test asserts a `serverId: 9` frame leaves the snapshot unchanged; target-server events route only to `pendingWorldSwap.activity`.

Deviations from spec:
- `src/frontend/src/App.test.tsx` is outside T3's `files_owned`; because `WorldState.activity` is required (T3 contract), its `worldFor` fixture needs `activity: []` for typecheck. The change is one fixture line; T3 adds no App assertion and T4 owns the substantive App/feed tests.
- `src/frontend/src/multiplayer/transport.test.ts` is outside T3's `files_owned`; `parsePlacement` now always decodes `activity` (absent → `[]`), so the `welcome()` fixture that the transport compares against the decoded message needs `activity: []`. One fixture line; no transport assertion changed.
- No other deviation: backend, UI/CSS, smoke, compose, Dockerfiles, package files, `.env*` and T4/T5 artifacts are untouched.

Out-of-scope files untouched: `src/backend/**`, `src/frontend/src/ui/**`, `src/frontend/src/App.tsx`, `tests/e2e/**`, `compose*.yaml`, both Dockerfiles, `package.json`, `package-lock.json`, `.env*`, `docs/features/live-activity-feed/{spec,plan,tasks,status}.md`, `docs/features/live-activity-feed/reviews/**`.
