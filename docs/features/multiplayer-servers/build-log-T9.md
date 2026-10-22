# Build log — T9 — Frontend transport: join/rejoin/token/send over the retry connection

Task: T9 (2026-10-22)
Files changed: `src/frontend/src/multiplayer/transport.ts`,
`src/frontend/src/multiplayer/transport.test.ts`,
`docs/features/multiplayer-servers/build-log-T9.md` (this log)

## Sketch (≤5 lines)

One module wrapping the unchanged `ws/connection.ts` with an injected socket factory. The
retry connection keeps connect/open/drop/backoff; the transport owns the session handshake
(one `hello` per socket → `join` or `rejoin {token}`; `resume_failed` → `join`), the
memory-only token learned from `welcome`, decoded frames via `parseServerMessage` (malformed
dropped), the send gate, and the `connecting | connected | disconnected | exhausted` status
mirror (exhaustion derived from the same attempt cap). Tests drive a fake socket factory
through the full sequences with exact frame assertions.

## What changed & why

- **`multiplayer/transport.ts`** (new) — `createTransport(options)` per plan § Interfaces:
  - `connect()` builds one `createConnection` (the accepted retry wrapper) with the resolved
    URL, the retry parameters and a wrapped socket factory. The wrapper is where the
    transport attaches its own `onmessage` (the connection never sets one), records the
    current socket and resets the per-socket handshake latch.
  - On every connection's first `hello`: `rejoin { token }` when a token is held, else
    `join`. The latch resets per socket (not only per `connect()`), so a reconnect always
    answers its own hello exactly once.
  - `welcome` stores its `token` in the closure; `error resume_failed` forgets the dead
    token and sends `join` on that socket. No storage API is read or written (AC-6).
  - Received text frames decode with `parseServerMessage`; non-JSON, unknown-type,
    malformed-payload and non-text frames are dropped, never thrown. Decoded frames
    (including `hello`) are forwarded to `onMessage` subscribers after the transport's own
    reaction.
  - Statuses map `connecting → connecting`, `connected → connected`, and
    `disconnected → disconnected` while the retry budget lasts; once the drop count passes
    the mirrored attempt cap the status becomes `exhausted` (the pinned `Retry` path is
    `close()` then `connect()`). A deliberate `close()` publishes nothing; a late
    subscriber receives the current status immediately.
  - `send(message)` encodes with `encodeClientMessage` and is a no-op until a socket is open
    (before the first open, between attempts, after `close()`).
- **`multiplayer/transport.test.ts`** (new) — 14 tests: 11 unit tests (status mapping,
  exhaustion/Retry, send gate, teardown, frame dropping, URL resolution, seeded token,
  re-entrant teardown) and 3 integration tests over the real retry connection + codec
  (join → welcome → drop → rejoin; resume_failed → fresh join → rejoin with the new token;
  duplicate hello + frame forwarding).

## Connection sequence (pinned by the integration tests)

```
connect()
  └─ createConnection → status connecting
       └─ open → status connected
            └─ server hello → send {"type":"join"}  |  {"type":"rejoin","token":…}
                 └─ welcome → token := welcome.token
socket drops
  └─ status disconnected → backoff → status connecting → new socket → open
       └─ hello → rejoin (token from the last welcome) → welcome (resume)
error resume_failed
  └─ token := null → send {"type":"join"} on the same socket → welcome → token := new
retry budget spent
  └─ status exhausted → Retry = close() + connect() → connecting → …
```

Status mapping table (transport status ← connection status):

| `ws/connection.ts` | `transport.ts` |
| --- | --- |
| `connecting` | `connecting` |
| `connected` | `connected` |
| `disconnected` (attempts left) | `disconnected` |
| `disconnected` (attempts exhausted) | `exhausted` |

The transport is given the same `maxAttempts` it hands to `createConnection` (default 10,
both sides), and counts consecutive drops since the last open — the connection resets its
attempt counter on open, the transport resets its drop counter on `connected`, so
`exhausted` fires on exactly the failure after which the connection schedules no retry.

## Testing tiers

- **Unit:** the transport with an injected socket factory — status mapping/exhaustion, send
  gating, message dropping, URL resolution (ambient `WebSocket` stub), seeded token,
  re-entrant teardown. No timers other than Vitest fake timers controlling the wrapped
  connection's backoff.
- **Integration:** the transport + the real `ws/connection.ts` state machine + the real
  `multiplayer/protocol.ts` codec over a fake socket (the factory is the plan-pinned
  injection seam; there is no browser/OS socket in the node test env). These are the
  join/rejoin/resume_failed sequences the task requires, with exact sent-frame assertions.

Both tiers live in `transport.test.ts` under separate `describe` blocks.

## Decisions

- **The per-socket handshake latch resets in the socket factory.** A reconnect is a new
  socket whose first frame is a new `hello`; resetting only in `connect()` would silently
  drop every rejoin after a retry (caught by the integration tests).
- **Exhaustion is mirrored, not invented.** `ws/connection.ts` has no `exhausted` status and
  its attempt constants are private, so the transport passes the same cap through and
  counts drops (`drops > maxAttempts`). The two defaults are pinned to the connection's
  values; changing one without the other would mislabel the last failure.
- **Late `onStatus` subscribers get the current status replayed.** The banner (T14) may
  mount after the session already connected; without a replay it could stay on its initial
  value forever. `close()` clears the stored status, so a disposed transport replays
  nothing.
- **The token survives `close()`/`connect()`** (only `resume_failed` clears it), because
  the pinned `Retry` path is close + connect and the grace window is still open at that
  point.
- **Token source is `welcome` only**, as the task pins ("in-memory token from the last
  `welcome`"); `worldEntered` carries the same identity token per spec, so it does not
  re-issue it.
- **No inbound frame-size cap.** The backend's `MAX_MESSAGE_BYTES` (1024) guards *its*
  receive path (client → server, `hub.ts` rejects oversized frames). A `welcome` or
  `stateSync` carries a whole roster plus removed-id sets and legitimately exceeds 1024
  bytes; dropping server frames by that cap would break populated servers. All client
  catalog frames are far below the cap. This is a deliberate deviation from T7's note that
  "the transport drops oversized frames" — see Deviations.
- **A `hello` is forwarded to `onMessage` like every decoded frame.** The world reducer
  ignores it; subscribers that only care about authority messages are unaffected.

## Evidence (raw command output)

Final run (started 08:49, after T8's `engine.ts` and T10's `world.ts` were present in the
workspace; the suite therefore includes their tests and my 14):

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/multiplayer/spectate.test.ts (23 tests) 5ms
 ✓ src/game/progression.test.ts (10 tests) 8ms
 ✓ src/ui/theme.test.ts (2 tests) 5ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/render/webgl.test.ts (5 tests) 8ms
 ✓ src/browser-env.test.ts (6 tests) 13ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 18ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 13ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 14ms
 ✓ src/game/board.test.ts (18 tests) 29ms
 ✓ src/input/gestures.test.ts (21 tests) 5ms
 ✓ src/input/keyboard.test.ts (13 tests) 7ms
 ✓ src/game/engine.test.ts (45 tests) 51ms
 ✓ src/ui/Hud.test.tsx (3 tests) 14ms
 ✓ src/render/particles.test.ts (19 tests) 14ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 16ms
 ✓ src/render/cube-view.test.ts (32 tests) 41ms
 ✓ src/render/picking.test.ts (12 tests) 40ms
 ✓ src/render/starfield.test.ts (15 tests) 87ms
 ✓ src/render/world.test.ts (17 tests) 60ms
 ✓ src/App.test.tsx (4 tests) 20ms
 ✓ src/game/session.test.ts (25 tests) 72ms
 ✓ src/render/scene.test.ts (51 tests) 142ms

 Test Files  25 passed (25)
      Tests  533 passed (533)
test exit=0
```

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  25 passed (25)
      Tests  533 passed (533)

 % Coverage report from v8
------------------|---------|----------|---------|---------|-------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|-------------------
All files         |   99.35 |    98.45 |     100 |   99.35 |
 src              |     100 |      100 |     100 |     100 |
  App.tsx         |     100 |      100 |     100 |     100 |
  browser-env.ts  |     100 |      100 |     100 |     100 |
 src/game         |     100 |     99.6 |     100 |     100 |
  board.ts        |     100 |      100 |     100 |     100 |
  effects.ts      |     100 |      100 |     100 |     100 |
  engine.ts       |     100 |      100 |     100 |     100 |
  progression.ts  |     100 |      100 |     100 |     100 |
  rotation.ts     |     100 |      100 |     100 |     100 |
  session.ts      |     100 |    98.18 |     100 |     100 | 175
  types.ts        |     100 |      100 |     100 |     100 |
 src/input        |     100 |      100 |     100 |     100 |
  gestures.ts     |     100 |      100 |     100 |     100 |
  keyboard.ts     |     100 |      100 |     100 |     100 |
 src/multiplayer  |   99.73 |    99.22 |     100 |   99.73 |
  protocol.ts     |     100 |      100 |     100 |     100 |
  server-state.ts |   99.18 |    96.87 |     100 |   99.18 | 119-120
  spectate.ts     |     100 |      100 |     100 |     100 |
  transport.ts    |     100 |      100 |     100 |     100 |
 src/render       |     100 |      100 |     100 |     100 |
  cube-view.ts    |     100 |      100 |     100 |     100 |
  particles.ts    |     100 |      100 |     100 |     100 |
  picking.ts      |     100 |      100 |     100 |     100 |
  scene.ts        |     100 |      100 |     100 |     100 |
  starfield.ts    |     100 |      100 |     100 |     100 |
  webgl.ts        |     100 |      100 |     100 |     100 |
  world.ts        |     100 |      100 |     100 |     100 |
 src/ui           |     100 |      100 |     100 |     100 |
  GameCanvas.tsx  |     100 |      100 |     100 |     100 |
  Hud.tsx         |     100 |      100 |     100 |     100 |
  theme.ts        |     100 |      100 |     100 |     100 |
 src/ws           |    95.34 |    92.85 |     100 |   95.34 |
  connection.ts   |    95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
------------------|---------|----------|---------|---------|-------------------
coverage exit=0
```

```
$ npm run typecheck --workspace @cubeclicker/frontend
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

Banned-matcher and purity guards:

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled|not\.toThrow" src/frontend/src/multiplayer/transport.test.ts
banned-matcher grep exit=1 (no matches)

$ grep -nE "localStorage[.[]|sessionStorage[.[]|document\.[a-zA-Z]|window\.[a-zA-Z]|fetch\(|Math\.random\(|Date\.now\(|setTimeout\(|setInterval\(|process\.env" src/frontend/src/multiplayer/transport.ts
code purity/storage grep exit=1 (no matches)
```

Isolated compile of exactly the two owned TypeScript files (used while T10's untracked
`world.ts` was mid-write; see the transient-failure note below):

```
$ npx tsc --noEmit --strict --skipLibCheck --target ES2022 --lib DOM,DOM.Iterable,ESNext \
    --module ESNext --moduleResolution bundler --types vite/client --isolatedModules \
    src/multiplayer/transport.ts src/multiplayer/transport.test.ts
isolated typecheck exit=0
```

### Transient cross-task failure (recorded, not claimed as green)

At 08:47 the workspace typecheck failed on a file outside this task:

```
src/render/world.ts(182,34): error TS2345: Argument of type 'string' is not assignable to
parameter of type '`front:${number}:${number}` | …'
typecheck exit=2
```

`src/render/world.ts` is T10's in-flight file (untracked at that moment); the isolated
compile above proved this task's files were clean. T10's tests landed at 08:48, and the
08:49 re-run recorded at the top of this section is green (`typecheck exit=0`, 533 tests).

## Coverage

| Scope | % Stmts | % Branch | % Funcs | % Lines | Gate (≥ 80) |
| --- | --- | --- | --- | --- | --- |
| `src/multiplayer/transport.ts` | 100 | 100 | 100 | 100 | pass |
| frontend workspace (all files, 25 test files / 533 tests) | 99.35 | 98.45 | 100 | 99.35 | pass |

No exclusions added, no thresholds changed.

## Acceptance audit

- **AC-22 (transport scope) — connection states, join/rejoin flow. met.**
  - `transport.test.ts > creates…` pins the status mapping: `connecting` at connect,
    `connected` on open, `disconnected` on a drop while retries remain, `exhausted` after
    the capped attempts; the `Retry` path (`close()` + `connect()`) restarts the cycle
    (`['connecting','disconnected','connecting','disconnected','connecting','exhausted',
    'connecting','connected']` asserted). Banner strings/button are T14's files.
  - Join/rejoin: fresh transport sends exactly `{"type":"join"}` on the first `hello`;
    after `welcome` with token `4f1c…8899` and a drop, the retried connection sends exactly
    `{"type":"rejoin","token":"4f1c…8899"}` (and the first socket only ever sent `join`).
    A seeded `token` option rejoins on the first hello.
  - `resume_failed`: the exact frame sequence is asserted — `rejoin(token1)` then
    `join` on the same socket; without a welcome the next connection sends `join` (the dead
    token is not retried); after `welcome(token2)` the following connection sends
    `rejoin(token2)`.
  - `send` is a no-op before open / after a drop and writes the exact encoded frame while
    connected.
  - Malformed frames (`'not json'`, foreign type, array, number, object, binary) are dropped
    without throwing and without a protocol reaction.
  - Token memory-only: the full join → welcome → drop → rejoin cycle runs with
    `localStorage`/`sessionStorage` traps installed and asserts zero property accesses;
    the source grep above shows no storage/global calls.
  - Session-side gating, resume reconciliation and the instant view reset are T13; the
    banner and Retry button markup are T14.

## Deviations from spec/plan

1. **`TransportOptions.url` is optional** and resolved at `connect()` time from
   `import.meta.env.VITE_WS_URL`, falling back to `ws://localhost:8080/ws`. The plan's
   interface sketch had `url: string` required, but the T9 brief explicitly pins the env
   resolution (and `vite.config.ts` already defines the same default); an explicit `url`
   still wins.
2. **Additive retry options** (`maxAttempts`, `baseDelayMs`, `maxDelayMs`) on
   `TransportOptions`. They are forwarded to `createConnection` unchanged; `maxAttempts` is
   also what makes `exhausted` detectable at all. Defaults mirror `ws/connection.ts`.
3. **`onStatus` replays the latest status on subscription** (additive behavior, pinned by a
   test). Needed so a banner mounted after `connect()` is not stuck on a stale initial
   value; `close()` clears the replay.
4. **No inbound `MAX_MESSAGE_BYTES` enforcement**, deviating from T7's build-log note that
   "the transport drops oversized frames". The cap is the backend's client→server guard
   (`hub.ts:533`); server frames with a full roster/removed-id sets can exceed 1024 bytes,
   so enforcing it on receipt would discard valid authority messages. Client frames are all
   far below the cap; the codec itself is unbounded by design (T7, same split).
5. **The token is learned from `welcome` only**, per the T9 brief; `worldEntered` carries
   the same identity token by spec, so it is not treated as a second issuer.

No pinned constant, message shape or acceptance criterion was altered.

## Open questions

- Q-T9-1: If the backend ever re-issues the token on a cross-server move (`worldEntered`),
  the transport would keep the old one and the next resume would fail once. Currently the
  spec states identity (and therefore the token) is stable across moves, so `welcome`-only
  is correct; revisiting is a one-line addition if the protocol changes.
- Q-T9-2: `error resume_failed` is forwarded to `onMessage` as a decoded `error` frame (no
  consumer today). If T13 wants to surface "session expired" copy, the frame is already
  there; otherwise it stays harmless.
