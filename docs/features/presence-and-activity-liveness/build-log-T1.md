# Build log — T1 — Backend wire: `leave`, TTL constant, received allow-list

Task: T1 (2026-11-16)
Branch: `feat/presence-and-activity-liveness` (created from `main` @ `294b302`)
Files changed:

- `src/backend/src/game/protocol.ts`
- `src/backend/src/game/protocol.test.ts`
- `src/backend/src/observability/metrics.ts`
- `src/backend/src/observability/metrics.test.ts`

## What changed & why

- `ACTIVITY_EVENT_TTL_MS = 5000` added to the backend protocol catalog (exact name/type/value per spec § Temporal activity contract; the frontend mirror is T4). It is the eligibility boundary: fresh iff `serverNow - event.at < 5000`.
- `{ type: 'leave' }` added to `ClientMessage` and a `case 'leave'` to `parseClientMessage` returning exactly `{ ok: true, message: { type: 'leave' } }`; extra fields (including a forged `playerId`) are dropped like every catalog message. No `ServerMessage` variant, no wire-shape change, no protocol version bump.
- `'leave'` added to `cubeclicker_ws_messages_received_total`'s closed `type` allow-list (`Metrics.inc` throws for an unlisted label value; the hub's T3 `inc` would otherwise throw).
- Tests: exact `leave` fixture, extra-field dropping, exact re-encoded frame, malformed/case-mismatched/unknown rejection, server-only `memberLeft` rejection, TTL constant pin, byte-identical representative `welcome` frame, and the received allow-list acceptance with the outbound allow-lists proven unchanged.

## Decisions

- `leave` is placed after `ping` (end of the client catalog) and before `invalid`/`oversized` in the received allow-list, so the decoded types stay grouped ahead of the two failure labels.
- **Integration-tier exception (documented per the testing bar).** T1 touches only pure catalog/codec modules and the in-process metrics registry: there is no route, socket or server↔client boundary inside T1's `files_owned` to drive. The integration evidence is assigned by `tasks.md`: the real hub leave path (frames, peer close, gauges, close reason) in T3 `hub.test.ts`, and the real wire path in the containerized smoke T7.
- Documentation is the T8 pass: `docs/architecture/observability.md` line 52 (received `type` allow-list) still needs `leave`; recorded here so T8 does not miss it. No doc file is edited in T1 per the task constraints.

## Evidence

### Focused tests (new/changed suites)

```text
$ npm test --workspace @cubeclicker/backend -- src/game/protocol.test.ts src/observability/metrics.test.ts

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/observability/metrics.test.ts (33 tests) 8ms
 ✓ src/game/protocol.test.ts (467 tests) 26ms

 Test Files  2 passed (2)
      Tests  500 passed (500)
```

### `npm run lint`

```text
$ npm run lint

> lint
> eslint .

(exit 0, no diagnostics)
```

### `npm run typecheck`

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

(exit 0, both workspaces)
```

### `npm test --workspace @cubeclicker/backend`

```text
$ npm test --workspace @cubeclicker/backend

 ✓ src/observability/metrics.test.ts (33 tests) 16ms
 ✓ src/game/protocol.test.ts (467 tests) 35ms
 ✓ src/game/hub.test.ts (181 tests) 302ms
 ✓ src/app.test.ts (38 tests) 2419ms
 ...
 Test Files  37 passed (37)
      Tests  1520 passed (1520)
```

### `npm run coverage --workspace @cubeclicker/backend`

Exit 0 (thresholds enforced by the workspace Vitest config: 80 statements/branches/functions/lines).

```text
$ npm run coverage --workspace @cubeclicker/backend

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 Test Files  37 passed (37)
      Tests  1520 passed (1520)

-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.15 |    89.81 |   99.57 |   96.15 |
 ...
  protocol.ts      |   99.28 |     99.1 |   97.56 |   99.28 | 386-387,987-988
 ...
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 248-249
-------------------|---------|----------|---------|---------|-------------------
```

```text
$ echo "exit=$?"
exit=0
```

### Working-tree hygiene

```text
$ git status --porcelain
 M src/backend/src/game/protocol.test.ts
 M src/backend/src/game/protocol.ts
 M src/backend/src/observability/metrics.test.ts
 M src/backend/src/observability/metrics.ts
?? docs/features/game-feel-overhaul/
?? docs/features/presence-and-activity-liveness/

$ git diff --check
(no output — no whitespace errors)

$ git diff --stat
 src/backend/src/game/protocol.test.ts         | 61 +++++++++++++++++++++++++++
 src/backend/src/game/protocol.ts              | 22 +++++++++-
 src/backend/src/observability/metrics.test.ts | 21 +++++++++
 src/backend/src/observability/metrics.ts      |  1 +
 4 files changed, 104 insertions(+), 1 deletion(-)
```

## Acceptance audit

- **AC-8 — `leave` is server-authoritative and self-only.** T1 part **met**: `parseClientMessage('{"type":"leave"}')` decodes to exactly `{ ok: true, message: { type: 'leave' } }`; `{"type":"leave","playerId":"p2","reason":"left","nested":{...}}` decodes to `{ type: 'leave' }` and re-encodes to exactly `{"type":"leave"}`; malformed, case-mismatched and unknown removal-shaped frames (`memberLeft` with a valid-looking payload) are `bad_message`, so the client catalog still has no message that can remove another member. Evidence: `src/backend/src/game/protocol.test.ts` § `client leave — additive self-only frame (AC-8)`. The hub enforcement (`not_joined`, self-only removal, peer close) is T3.
- **AC-9 — Metrics and close reason.** T1 part **met**: `cubeclicker_ws_messages_received_total` accepts `type="leave"` and renders exactly `cubeclicker_ws_messages_received_total{type="leave"} 1`; the encoded/frames allow-lists do not contain `leave` and the catalog stays at exactly 30 metrics. Evidence: `src/backend/src/observability/metrics.test.ts` § `accepts the leave type on the received counter and creates its series`. The hub increments/gauges/`reason="client"` close evidence is T3.
- **AC-10 — No wire-shape change and no protocol version bump.** T1 part **met**: no `ServerMessage`/`MemberState`/`LeaderboardSnapshot`/`ActivityEvent` edit (only the `ClientMessage` union and the decoder), no presence/connected field, the representative `welcome` frame is asserted byte-identical, and no version constant exists/changed. Evidence: `protocol.test.ts` § `keeps the representative welcome frame byte-identical (AC-10)` plus the `protocol.ts` diff. Old-client/new-client behavior is deployment-level (the wire is unchanged) and the smoke evidence is T7/T9.
- **AC-11 — TTL constant and server boundary.** T1 part **met**: `ACTIVITY_EVENT_TTL_MS === 5000` is pinned in `protocol.test.ts`; the `snapshot` 4999/5000 boundary and tail pruning are T2, the frontend mirror constant is T4.

## Deviations from spec

None. No dependency, coverage exclusion, assertion weakening, container/package edit, or out-of-scope file change. The only deferred items are the ones `tasks.md` assigns to T2/T3/T4/T7/T8/T9.
