# Build log — T5 — Backend hub: connection lifecycle, broadcasts, limits, heartbeat; `/ws` wiring

Task: T5 (2026-10-21)
Files changed: `src/backend/src/game/hub.ts` (new), `src/backend/src/game/hub.test.ts` (new),
`src/backend/src/app.ts` (edit), `src/backend/src/app.test.ts` (edit),
`docs/features/multiplayer-servers/build-log-T5.md` (this log)

## Sketch (≤5 lines)

App sends the retained `hello` then `hub.attach(socket)` → hub registers message/close/pong +
heartbeat → `join` issues identity/assignment/cube → `welcome` (+`memberJoined` to others) →
`explode` validates against the authoritative board → broadcast to the server incl. origin, or
`error` + `stateSync` to the origin (rate-limited 30/s, one error/s) → completion draws the next
cube, executes the plan through the registry's re-validation, and broadcasts the same-server or
cross-server sequence; close → grace timer → expiry removes/starts plan again.

## What changed & why

- **`game/hub.ts` (new).** The single owner of socket attachments and every shared value:
  - `attach(peer)` registers `message`/`close`/`pong`, starts the per-connection heartbeat and
    enforces `config.maxConnections` (extra sockets are closed before any state exists). The hub
    does **not** send `hello` — `app.ts` does, so exactly one hello precedes everything (see
    Decisions / deviations).
  - `join`: monotonic counter → `createPlayerRecord` (`p<N>`, `Player <N>`, 32-hex token) →
    `registry.assign` (lowest-id free slot / fresh id) → `createNextCube(null, styleForLevel,
    random)` → `welcome` (placement + self-inclusive roster) → `memberJoined` to the other
    members → plan recompute.
  - `rejoin`: token lookup → live-socket guard → grace check → fresh `welcome` with the same
    `playerId`/server/cube (removed ids preserved) and no visible membership change; unknown,
    live or expired token → `error resume_failed` (an expired token also finalises the removal).
  - `explode`: rate window (30 attempts per trailing 1000 ms; excess dropped; `rate_limited` at
    most once per second) → `validateExplode` → `miniCubeRemoved` to every member of the server
    **including the origin**, or `error invalid_click` + `stateSync` (full board) to the origin only.
  - `cubeCompleted`: `isComplete` → `createNextCube` (one injected RNG draw) → planned target
    re-validated by `registry.moveMember` → same server (or rejected move) `levelAdvanced` to all
    members incl. the mover; cross-server `worldEntered` to the mover, `memberLeft (moved)` to the
    vacated server, `memberJoined` (next-cube state) to the target. `moveMember` destroys an
    emptied server.
  - close: member retained, `grace.begin`, expiry scheduled at exactly `expiresAt − now`; expiry
    removes the member, broadcasts `memberLeft (left)`, lets the registry destroy an emptied
    server, recomputes the plan. A timer that fires early reschedules instead of removing.
  - heartbeat: ping every `WS_HEARTBEAT_INTERVAL_MS`; a ping still unanswered on the next tick is
    a missed pong; the socket is closed at `WS_MISSED_PONGS_LIMIT` (2); any pong resets both
    counters. Pings at 30/60/90 s, close at 90 s.
  - `close()` (additive lifecycle seam) clears every hub timer; `app.ts` runs it from the
    `onClose` hook so no interval/timeout outlives the app.
- **`app.ts`.** `buildApp(env = process.env)` loads `loadGameConfig`, builds one hub
  (`Date.now`, `Math.random`, real timers) and the `/ws` route sends the retained
  `JSON.stringify(helloMessage())` and then `hub.attach(toPeer(socket))`. `toPeer` is the only
  place that knows about `ws` (`send`/`close`/`ping`/`readyState`/events). `/healthz` unchanged;
  `server.ts` untouched.
- **`hub.test.ts` (new, 29 tests).** Fake `Peer` sockets with recorded frames/pings/close, a
  harness with an injected clock (`clock += ms` before `vi.advanceTimersByTime(ms)`, so the grace
  boundary is exact), injected RNG (draw queue) and the fake timers. Covers: attach/no-unsolicited
  frame, `not_joined`, `bad_message` matrix (malformed/unknown/missing field/oversized/non-object/
  non-string frame), join placement + roster + positions + token format, `memberJoined`, overflow,
  second join/rejoin, grace retention, expiry at exactly the grace (and −1 ms), early-timer
  reschedule, resume (identity/server/cube, no roster change, cancelled timer), resume at exactly
  the deadline, unknown/live tokens, shutdown timer cleanup, dropped broadcasts to grace members,
  heartbeat (30/60/90, two misses, pong reset), connection cap, explode broadcast sets incl.
  origin + server scoping, invalid click/`stateSync`, oversized-but-valid click, the 30/s window
  boundaries and one-error-per-second, same-server `levelAdvanced`, incomplete/wrong-level
  completion, the full AC-11 X = 2 scenario, and the X = 3 cross-server `memberLeft (moved)` /
  `memberJoined` / `worldEntered` sequence.
- **`app.test.ts`.** The four existing hello tests are untouched and pass. Added: the full
  handshake over a real ephemeral-port listener with Node's global `WebSocket`
  (hello → join → `welcome` → second client's `welcome` → first client's `memberJoined`), two
  independent `buildApp({})` worlds (AC-4), and a `toPeer` adapter contract test
  (send/close/ping/readyState/three events) so the transport seam is pinned without a new dep.

## Hub state machine (as implemented)

```
socket attach ──> (cap exceeded? close) ──> connection { playerId: null }
   │ message
   ├─ bad JSON / unknown type / >1024 B ─────────────────────────> error bad_message
   ├─ join  (playerId === null)  ──> identity + assign + cube ───> welcome / memberJoined(others)
   │         (playerId !== null) ────────────────────────────────> error bad_message
   ├─ rejoin (playerId === null) ── token? ── grace? ────────────> welcome | error resume_failed
   │         (playerId !== null) ────────────────────────────────> error bad_message
   ├─ explode / cubeCompleted (playerId === null) ───────────────> error not_joined
   └─ explode / cubeCompleted (joined) ──> validate ─┬─ ok ──────> broadcast (server-scoped)
                                                     └─ invalid ─> error + stateSync (origin)
socket close ──> member.connection = null, grace.begin, schedule expiry, plan recompute
   expiry at deadline ──> removeMember ──> memberLeft(left), destroy-if-empty, plan recompute
   rejoin within grace ──> cancel grace, welcome, plan recompute
completion (accepted) ──> next cube + movePlan.get(id) ──> registry.moveMember (re-validates)
   moved === null ──> levelAdvanced to all members (incl. origin)
   moved !== null ──> worldEntered(mover) + memberLeft(moved)(old) + memberJoined(target)
heartbeat tick ──> ping; unanswered previous ping ⇒ missedPongs++; limit reached ⇒ peer.close()
pong ──> missedPongs = 0, awaitingPong = false
```

## Decisions

- **`hello` ownership: `app.ts`, not the hub.** The T5 task prose says "`attach` sends exactly
  `hello` first", but the same task's scope, plan § Interfaces (`app.ts … hands each socket to
  the hub after sending hello`) and spec § 8/AC-20 ("exactly one `hello`" and "no message
  precedes it") require a single hello from the route. Sending it in both places would violate
  AC-20, and a hub → `app.ts` import would be a cycle. Resolved as: route sends the retained
  `helloMessage`, then attaches; `hub.test.ts` asserts attach sends nothing, `app.test.ts` asserts
  hello is first over a real socket. (Deviation log below; no semantic change to the AC.)
- **Plan recompute triggers are exactly spec § 7's table** (join, close, expiry, successful
  resume) — not completion. A move therefore reads a plan that can be stale, and the registry's
  re-validation is the safety net ("if the target is gone/full, the member stays"). The
  strictly-lower guard in `moveMember` also makes "never twice for one trigger" structural: after
  a move the stored target equals the new server id, so a repeat is rejected.
- **Rate window:** fixed 1000 ms window per member, counting **attempts** (valid or not), plus a
  separate `lastLimitedAt` timestamp for the "at most one `rate_limited` per second" rule. At
  exactly +1000 ms the quota is fresh again (pinned by the test: dropped at +999, accepted at
  +1000).
- **Grace boundary:** expiry is a scheduled `setTimeout(deadline − now)` whose callback re-checks
  `grace.expired(playerId, now())`. At exactly the deadline that is `true` (tracker semantics from
  T2); a timer that fires early reschedules the remainder (tested) instead of dropping the member.
  `rejoin` also checks the deadline, so a resume exactly at the boundary fails and finalises the
  removal even before the timer runs.
- **Second join/rejoin** means "after a successful join/rejoin": `join` after a failed `rejoin` is
  the pinned client flow (spec § 8), so only a joined connection answers `bad_message`.
- **Identity is per connection, positions are derived, never cached:** `locationOf` scans the
  registry on demand, so a slot/position can never drift from the authoritative membership. The
  welcome/`worldEntered`/roster all read through it.
- **Roster always includes the receiver** (spec § 8 pins "full roster incl. self"); the frontend
  reducer excludes self later (T7).
- **Tokens:** a `token → playerId` map for O(1) resume, deleted on removal. A rejoin with the
  token of a member whose socket is still open is refused (`resume_failed`) rather than stealing
  the session.
- **`MAX_CONNECTIONS`:** checked before creating any state; the extra socket is closed without a
  frame. `MAX_MESSAGE_BYTES` is read from `GameConfig.maxMessageBytes` (both homes are 1024 and
  T4 pins parity), measured on the raw frame (`Buffer.byteLength` for strings, `byteLength` for
  the Buffer the `ws` transport hands over) and checked **before** decoding.
- **`toPeer` adapter in `app.ts`** (not in the hub) keeps `game/hub.ts` transport-free and avoids
  importing the untyped `ws` package types; the adapter is unit-tested.
- **`GameHub.close()`** is an additive lifecycle method (the plan's interface is "wording may
  vary"): without it, a 30 s grace timeout or a heartbeat interval could outlive `app.close()`.
  `app.ts` calls it from `onClose`.
- **No dependencies, no persistence, no `fs`, no wall-clock reads in `hub.ts`** (clock, RNG and
  timers are injected; `Date.now`/`Math.random` only appear at the `app.ts` composition root).

## Evidence (raw command output)

```
$ npm test --workspace @cubeclicker/backend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 5ms
 ✓ src/game/cubes.test.ts (24 tests) 9ms
 ✓ src/game/servers.test.ts (30 tests) 11ms
 ✓ src/game/players.test.ts (13 tests) 11ms
 ✓ src/game/hub.test.ts (29 tests) 24ms
 ✓ src/game/protocol.test.ts (56 tests) 6ms
 ✓ src/app.test.ts (7 tests) 114ms

 Test Files  7 passed (7)
      Tests  172 passed (172)
   Start at  22:46:50
   Duration  449ms (transform 339ms, setup 0ms, collect 645ms, tests 178ms, environment 1ms, prepare 374ms)
test exit=0
```

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/game/cubes.test.ts (24 tests) 11ms
 ✓ src/game/players.test.ts (13 tests) 13ms
 ✓ src/game/servers.test.ts (30 tests) 12ms
 ✓ src/game/hub.test.ts (29 tests) 24ms
 ✓ src/game/protocol.test.ts (56 tests) 7ms
 ✓ src/app.test.ts (7 tests) 127ms

 Test Files  7 passed (7)
      Tests  172 passed (172)
   Start at  22:46:51
   Duration  552ms (transform 236ms, setup 0ms, collect 583ms, tests 202ms, environment 1ms, prepare 486ms)

 % Coverage report from v8
--------------|---------|----------|---------|---------|------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s      
--------------|---------|----------|---------|---------|------------------------
All files     |    98.4 |    96.91 |     100 |    98.4 |                        
 src          |     100 |      100 |     100 |     100 |                        
  app.ts      |     100 |      100 |     100 |     100 |                        
 src/game     |    98.3 |    96.66 |     100 |    98.3 |                        
  config.ts   |     100 |      100 |     100 |     100 |                        
  cubes.ts    |     100 |      100 |     100 |     100 |                        
  hub.ts      |   96.56 |    92.72 |     100 |   96.56 | ...333,361-362,379-381 
  players.ts  |     100 |      100 |     100 |     100 |                        
  protocol.ts |     100 |      100 |     100 |     100 |                        
  servers.ts  |     100 |      100 |     100 |     100 |                        
--------------|---------|----------|---------|---------|------------------------
coverage exit=0
```

```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit

typecheck exit=0
```

```
$ npm run lint
> lint
> eslint .

lint exit=0
```

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled|not\.toThrow" src/backend/src/game/hub.test.ts src/backend/src/app.test.ts
grep exit=1 (no matches)
```

```
$ grep -n "Math.random" src/backend/src/game/hub.ts
grep exit=1 (no matches)

$ grep -rn "from 'fs'|from \"fs\"|localStorage|sessionStorage" src/backend/src/game/hub.ts src/backend/src/app.ts
grep exit=1 (no matches)
```

## Coverage

| Scope | % Stmts | % Branch | % Funcs | % Lines | Gate (≥ 80) |
| --- | --- | --- | --- | --- | --- |
| `src/game/hub.ts` | 96.56 | 92.72 | 100 | 96.56 | pass |
| `src/app.ts` | 100 | 100 | 100 | 100 | pass |
| backend workspace (all files) | 98.40 | 96.91 | 100 | 98.40 | pass |

The uncovered `hub.ts` lines are defensive guards that the public protocol cannot reach:
`send` when the peer already closed, `locationOf`/`rosterFor` "not found", a non-string/non-Buffer
frame, `removeMember`/`handleClose` "member already gone", and `heartbeat` on an already-closed
peer (the close event removes the connection first). No exclusions, no threshold changes,
no test files excluded beyond the workspace config's pinned excludes.

## Acceptance audit (hub-level, AC-1…AC-21)

- **AC-1 — First connection creates server 1.** `hub.test.ts > joins with identity, slot 1 …`
  asserts the first `welcome` has `serverId 1`, `maxUsers 2`, slot-1 position and a roster
  containing exactly that member; `app.test.ts` healthz test (retained) and the boot behaviour of
  a fresh hub (no messages, `connectionCount 0`) show `/healthz` creates nothing; the registry
  boot state is T1's `servers.test.ts`. **met.**
- **AC-2 — Fill to X, then overflow.** `places the second member in slot 2 …` (slot-1/slot-2
  positions pinned as exact doubles) and `overflows into the next fresh server …` (X = 2: third
  join → `serverId 2`, slot 1, roster of one, server 1 hears nothing). **met (hub level).**
- **AC-3 — Empty servers destroyed; ids never reused.** `destroys an emptied server at grace
  expiry and never reuses its id` (1 → server 1; expiry; next join → server 2) and the AC-11 test
  (server 2 emptied by the mover → the next join creates server 3). **met (hub level).**
- **AC-4 — In-memory lifecycle.** `keeps each app build independent (AC-4)` joins twice into app A
  (p1/p2) and once into app B (p1, server 1, roster 1); the greps show no `fs`/storage in
  `hub.ts`/`app.ts`. **met (hub/app level).**
- **AC-5 — Capacity config.** Hub consumes `GameConfig` (`maxUsers` in `welcome`, grace override in
  `harness.config.reconnectGraceMs`, `maxConnections` override in the cap test); parsing/boundaries
  are T1's `config.test.ts`. **met (consumption only; parsing is T1).**
- **AC-6 — Ephemeral identity.** `joins …` pins `p1`/`Player 1` and `token` `/^[0-9a-f]{32}$/`;
  the resume test shows the token is the same credential; the AC-11 test asserts the mover's
  `worldEntered` carries the same token. No storage imports. **met (hub level).**
- **AC-7 — Grace & reconnect.** `keeps a disconnected member in the roster …` (slot stays taken →
  third join goes to server 2), `removes the member at exactly the grace deadline …` (−1 ms no
  message, exactly at the deadline `memberLeft left`), `reschedules a grace timer that fires
  early …`, `resumes the same identity, server and cube …` (same playerId/token/server/slot,
  `removedIds ['front:0:0']`, no `memberJoined`/`memberLeft` for others, timer cancelled),
  `fails a resume at exactly the deadline …` (removal finalised, no duplicate `memberLeft`),
  `answers resume_failed for an unknown token …`, `refuses to resume an identity whose socket is
  still open`, `drops broadcasts to a member in grace …`. **met.**
- **AC-8 — Display names.** `Player 1/2/3/4` asserted in welcomes, `memberJoined`s, and in the
  mover's `worldEntered`/target `memberJoined` after a cross-server move (name stable). **met.**
- **AC-9 — Join assignment rule.** Hub overflow/gap behaviour (X = 2) plus T1's exhaustive
  `pickServer` cases. **met (hub consumes T1).**
- **AC-10 — Plan execution only at completion, strictly decreasing, re-validated.** The AC-11 and
  cross-server tests: a close/expiry recreates the plan, no roster/broadcast change happens until
  the mover's `cubeCompleted`, then the move executes (`worldEntered`, `memberLeft (moved)`,
  `memberJoined`); `movePlan` is recomputed only on the pinned triggers and `registry.moveMember`
  re-validates target existence/capacity/strictly-lower (T1 tests). Boundary note: a rejection is
  unreachable through the protocol while the plan is capacity-respecting and recomputed on every
  membership change, so the "stays" path is covered by T1's `moveMember` tests rather than a
  hub-level fixture (see Open questions). **met.**
- **AC-11 — Lone-user merge (X = 2).** One end-to-end test: p1/p2 on server 1, p3 on server 2 →
  p1 disconnect + exact grace → `memberLeft left` to p2 only → p3 completes all 54 ids → p3's
  `worldEntered` (server 1, slot 2, next cube N = 5, style `crimson-alloy`, roster `[p2, p3]`),
  p2's `memberJoined` with the same next-cube member, server 2 destroyed (next join → server 3).
  **met.**
- **AC-12 — Client-visible move effect (server side).** `worldEntered` carries the target
  `serverId`, exact slot position and full roster; `memberLeft (moved)` reaches the vacated
  server's remaining members. Reducer/scene/session are T7/T12/T13. **met (server side).**
- **AC-13 — Ring layout.** Hub sends `worldPosition(slot, X)` exactly (pinned doubles for X = 2
  slots 1/2 and X = 3 slots 1/2/3; X = 10 slot 1 in the app test). Formula/rendering are T1/T10.
  **met (hub emission).**
- **AC-14 — Server-authoritative board, optimistic own play.** `broadcasts a valid explode to
  every member … including the origin` (exact frames, other server receives nothing);
  `rejects unknown, removed and wrong-level clicks …` (`error invalid_click` + exact `stateSync`
  board to the origin, nothing to others); `drops the 31st explode …` (30 accept, 31st
  `rate_limited`, 32nd silent, still limited at +999 ms, accepted at +1000 ms, a second
  `rate_limited` only after another full second); `drops an oversized frame even when … valid`.
  **met.**
- **AC-15 — Completion validation & server-drawn levels.** `rejects incomplete cubes and wrong
  levels …` (`invalid_completion` + full `stateSync`, no `levelAdvanced`); `advances a completed
  cube …` (54 ids → `levelAdvanced` with `levelIndex 1`, `gridSize 5` from draw 0.5,
  `styleId 'crimson-alloy'`, `removedIds: []`, unchanged position; the fresh level accepts level-1
  ids). **met (hub sequence).**
- **AC-16…AC-19 — Spectating UI/panel/travel.** Frontend tasks (T11/T14); no hub surface. **n/a
  for T5.**
- **AC-20 — Catalog, hello-first, scoping, errors.** `app.test.ts` asserts hello is the first
  frame over a real socket and precedes `welcome` (and the second client's hello likewise);
  `hub.test.ts` asserts `not_joined` before join, `bad_message` for malformed/unknown/missing
  field/non-object/oversized frames and for a second join/rejoin, `resume_failed` paths, and
  server-scoped broadcast sets (join and explode cases). **met.**
- **AC-21 — Heartbeat.** `pings every 30 s and terminates at the second missed pong` (pings at
  30/60/90 s, closed at 90 s after two unanswered pings), `resets the missed-pong count on every
  pong`, `keeps a socket alive when a pong arrives after two missed pings`. **met.**

## Deviations from spec

1. **`hello` is sent by `app.ts`, not `hub.attach`** — required by spec § 8/AC-20 ("exactly one
   hello, before anything else"), plan § Interfaces and the T5 scope paragraph. Recorded because
   the T5 task prose sentence contradicts them; no AC semantics changed. `hub.test.ts` asserts
   the hub sends nothing on attach; `app.test.ts` asserts hello-first over the wire.
2. **Heartbeat tick order.** The implementation pings first and then evaluates the previous
   ping's pong, producing pings at 30 s / 60 s / 90 s and closing at 90 s at the second miss —
   the AC-21 parenthetical. The simpler "ping then increment" variant would have closed at 60 s
   with only two pings; the pinned evidence line ruled it out.
3. **Slot compaction after a removal.** The hub derives positions from T1's registry, whose
   `members` array is dense (a removal splices; the next join gets `length + 1`), so remaining
   members' slot positions compact after a member leaves. Spec § 5 says "existing members never
   shuffle"; T1 owns and pinned the dense model (`servers.test.ts > assigns a rejoin to the
   lowest-id free slot after churn`: p2 moves from slot 2 to slot 1 after p1 leaves). Per the
   task constraint ("do not change the acceptance semantics resolved for T1") the hub follows
   T1; flagged as an open question for the reviewer rather than silently changing the registry.
4. **`GameHub.close()`** is an additive method beyond the plan's `attach`/`connectionCount` pair,
   so app shutdown clears grace timeouts/interval timers (no leaks). `app.ts` registers it as an
   `onClose` hook; no protocol/AC impact.
5. **`buildApp(env = process.env)`** gained an optional environment parameter (defaults to
   `process.env`, so `server.ts` is unchanged) purely so the app integration tests pin the
   default capacity deterministically.

## Open questions

- Q-T5-1 (deviations 1): confirm `hello` stays route-owned; the alternative (hub-owned hello +
  route not sending) would move the accepted envelope into the hub and require `helloMessage` to
  move too — no AC benefit.
- Q-T5-2 (deviation 3): should the registry (T1) keep slots stable across removals (holes /
  explicit slot numbers) instead of compacting? That is a T1 contract change; the hub is
  consistent with whatever the registry reports. If "positions never shuffle" is enforced, T1's
  `assign` slot rule and `servers.test.ts` fixtures must change together.
- Q-T5-3: should the plan be recomputed after a completion-move (spec § 7 lists only join, close,
  expiry, resume)? Current choice follows the table and keeps the registry re-validation
  meaningful; recomputing after moves would also be safe but makes the rejection guard harder to
  reach.
- Q-T5-4: rejoin attempts after a failed rejoin are currently allowed (each answers
  `resume_failed`), because the client flow is "rejoin → resume_failed → join". Only a joined
  connection answers `bad_message` for a second join/rejoin. No spec contradiction found.
