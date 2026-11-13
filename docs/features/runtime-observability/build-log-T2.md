# Build log — T2 — Hub instrumentation and diagnostic ping/pong

Task: T2 (2026-11-13)
Files changed:
- `src/backend/src/game/protocol.ts` / `protocol.test.ts` — additive `ping`/`pong` plus `pongMessage(t)`
- `src/backend/src/auth/rate-limit.ts` / `rate-limit.test.ts` — optional `onDenied(key)` callback
- `src/backend/src/game/hub.ts` / `hub.test.ts` — metrics/log instrumentation and the ping handler
- `docs/features/runtime-observability/build-log-T2.md` (this file)

No app/router, DB, frontend, compose, Terraform, package or env file was touched.

What changed & why (≤5 lines):
1. Both protocol mirrors gain the additive diagnostic pair `{type:'ping',t}` / `{type:'pong',t}`: `t` is accepted only as a finite number (so `1e999` → `Infinity` and a missing/string/boolean `t` are `bad_message`), and `pongMessage(t)` emits the exact echo. No existing frame, cap or payload changed.
2. `HubDeps` gains optional `metrics?: Metrics` and `log?: LogSink` (event-first); `attach` gains an optional third `connectionId` (the Fastify request id in T3). Every connection tracks `connectionId`, `wasJoined`, `attachedAtMs`, `closeReason` and the last accepted ping time.
3. Instrumentation lands at the pinned points: attach/close/heartbeat/capacity (AC-10); parsed message type after `parseClientMessage` plus `invalid`/`oversized` (AC-11); one encode in `send`/`broadcast`/`broadcastAccount`, per-recipient delivery in `deliver`, server-broadcast fan-out only in `broadcast` (AC-11); room/member/capacity gauges after membership changes and on close (AC-12); removal/economy pending+flush cadence (AC-13); explode/rotate/ping drops (AC-14); stale economy/upgrade revision rejections (AC-15).
4. The hub answers `ping` before `memberFor` (pre-join RTT is measurable), accepts at most one per 1000 ms per connection, drops later pings into `rate_limit_drops_total{scope="ping"}` and sends the exact `pong` otherwise. It touches no membership, board or economy state.
5. Lifecycle logs are exactly `ws_connection_opened`, `ws_connection_closed`, `ws_heartbeat_timeout`, `ws_connection_rejected` and `hub_closed`, with only the fields pinned by spec § Log fields and levels; no player/account/username/IP/payload value can reach a log line.

Decisions:
- A direct `attach` without a request id logs the constant `connectionId: 'unknown'`; production/T3 always passes `req.id`, and the field stays present for every lifecycle line.
- `hub.close()` marks each still-attached connection `reason: 'server'`, counts/observes/logs its close, then logs `hub_closed` with the pre-clear connection/member/server counts. The AC-13 reset afterwards changes only gauges (`removal_batch_pending_groups`, `economy_pending_accounts`, `ws_connections_open`, `members_active`, `servers_active` → `0`); counters keep their process totals and no registry equality is asserted after close.
- `ws_broadcasts_total` and `ws_broadcast_fanout` are server `broadcast` only. Account broadcasts (`broadcastAccount`) still count one encode and one frame per recipient, as the task note scopes fan-out to server broadcasts.
- Fan-out observes successful per-recipient deliveries: `deliver` returns `true` only after `peer.send` succeeds, so the histogram equals the `frames_sent` delta for the same broadcast. A throwing peer is excluded from the fan-out and closes with `reason: 'error'`.
- `onDenied` fires exactly once for every `allow` that returns `false` (including a `limit <= 0` denial); the key is handed only to the callback, which T3 will use to count `scope="http"` and discard it.
- `PING_RATE_LIMIT_MS = 1000` is exported for the T4 mirror/tests; the boundary is inclusive (a ping at exactly `last + 1000 ms` is accepted).
- Tier note: T2's hub suite is a unit suite in the project taxonomy (fake peers/timers) but it exercises the real `Metrics` registry, the real `LogSink` contract and the real encode/send path end to end; the app/route integration boundary (`/metrics`, `req.id`, real sockets) is deliberately T3, and the frontend mirror is T4.

Evidence:

`npm run lint` → exit 0

```text
> lint
> eslint .
```

`npm run typecheck` → exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

`npm run test --workspace @cubeclicker/backend` → exit 0 (29 files, 1061 tests)

```text
 ✓ src/auth/rate-limit.test.ts (19 tests) 10ms
 ✓ src/game/protocol.test.ts (182 tests) 37ms
 ✓ src/game/hub.test.ts (135 tests) 185ms

 Test Files  29 passed (29)
      Tests  1061 passed (1061)
   Start at  14:30:43
   Duration  3.29s
```

`npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds 80/80/80/80)

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.13 |    88.21 |   99.51 |   95.13 |
 src/auth          |   95.68 |    81.99 |     100 |   95.68 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
 src/game          |   94.63 |    93.21 |   98.85 |   94.63 |
  hub.ts           |   89.98 |    87.71 |   98.27 |   89.98 | ...1506,1636-1637
  protocol.ts      |   98.89 |    98.61 |   96.87 |   98.89 | 248-249,571-572
 src/observability |   99.59 |       96 |     100 |   99.59 |
  metrics.ts       |   99.44 |    93.54 |     100 |   99.44 | 243-244
-------------------|---------|----------|---------|---------|-------------------
```

New tests (concrete assertions only; no wildcard/snapshot/argument-unchecked matchers):
- `protocol.test.ts` — `parseClientMessage` decodes ping `123`/`0`/`-4.5` and drops extra fields; rejects missing, `null`, string, boolean, `NaN` (unparseable JSON) and `1e999` (`Infinity`); `pongMessage(123)` equals `{type:'pong',t:123}` and encodes `{"type":"pong","t":123}`.
- `rate-limit.test.ts` — `onDenied` called once per denied allow with the key, never on admitted calls, per key and per window reset; `limit <= 0` notifies once per call; `createRateLimiter` binds it.
- `hub.test.ts` — exact metric samples and exact log entries for attach/capacity rejection/client close/duration; heartbeat miss (timeout counter, `reason:'heartbeat'`, 90 s observation, warn log); send failure (`reason:'error'`, fan-out continues); `hub_closed` counts plus `reason:'server'` closes; `unknown` fallback id; AC-11 baseline/deltas (2 joins → removal: broadcasts +1, one encode, two frame sends, fan-out count +1/sum +2, `invalid` and `oversized`); room/member/capacity gauges across joins, grace removal, completion move/server destroy and final leave; removal pending/flush/ids/batch-size; economy pending/cadence and the close reset; 31st explode and 21st rotate drops with received totals intact; pre-join ping echo, 1 Hz drop; stale economy/purchase rejections vs a closed-hub rejection; no PII/payload values in the lifecycle log.

Acceptance audit:
- AC-3 (hub logging half) → met: `hub.test.ts` pins `ws_connection_opened {connectionId}`, `ws_connection_closed {connectionId, reason, durationMs, wasJoined}`, `ws_heartbeat_timeout {connectionId, wasJoined}`, `ws_connection_rejected {connectionId, reason:'capacity'}` and `hub_closed {connections, members, servers}` as exact field objects; no log line contains the account id, username, player id or exploded cube id. The app-side `req.id` correlation and real-socket logs are T3.
- AC-10 → met: two attaches → `connections_open 2` / `connections_total 2` (and the configured capacity); capacity rejection → `{reason="capacity"} 1`; client close → open 1, `{reason="client"} 1`; heartbeat miss → `heartbeat_timeouts_total 1`, `{reason="heartbeat"} 1`, duration count/sum observed; send failure → `{reason="error"}`; duration histogram observed on every close.
- AC-11 → met: post-join baseline 2 broadcasts / fan-out count 2 / sum 1; one accepted explode produces broadcasts +1, `messages_encoded_total{miniCubeRemoved} 1`, `frames_sent_total{miniCubeRemoved} 2`, fan-out count +1/sum +2; `messages_received_total{join} 2`, `{explode} 1`; malformed → `{invalid}` and oversized → `{oversized}`; existing encode-once/cap behavior unchanged (all pre-existing tests green).
- AC-12 → met: `servers_active`/`members_active`/`server_capacity`/`ws_connections_capacity` equal 2/3/2/200 after joins (X=2), 2/2 after grace removal, 1/2 after the completion move + server destroy, and 0/0/open 0 after the final leaves; no post-close registry equality is asserted.
- AC-13 → met: after enqueue pending groups 1, after the 40 ms window 0 with flushes 1, ids 2, batch-size count 1/sum 2; after economy queue pending accounts 1, after the 250 ms cadence 0 with flushes 1; `hub.close()` zeroes pending/removal/economy/open/member/server gauges.
- AC-14 (hub/limiter half) → met: 3 received explodes with a 2/s cap → `{scope="explode"} 1`; 21 received rotates with the pinned 20/s cap → `{scope="rotate"} 1` and 20 encoded `cubeRotated`; a second ping within 1 s → `{scope="ping"} 1`; `onDenied` fires once per denied auth `allow`. The app-level `{scope="http"}` wiring is T3.
- AC-15 → met: a late economy snapshot increments `economy_revision_rejections_total` by 1; a late purchase increments both `upgrade_revision_rejections_total` and `economy_revision_rejections_total` by 1; a result rejected only by `closed` leaves both counters unchanged.
- AC-23 (backend half) → met: both backend codecs parse/validate `ping`, `pongMessage(123)` encodes exactly `{"type":"pong","t":123}`, the hub echoes a pre-join ping exactly, a second ping within 1000 ms sends no pong and increments `rate_limit_drops_total{scope="ping"}`, and a ping at +1000 ms is accepted. The frontend mirror is T4.
- AC-26 (T2 scoped gates) → met: lint, typecheck, backend tests and backend coverage all exit 0; coverage is ≥ 80 on all four metrics for the workspace and for every touched file.

Deviations from spec: none. `/metrics`, app/Pino wiring, DB/shutdown instrumentation and the frontend overlay remain untouched (T3/T4).
