# Build log — T1 — Protocol `miniCubesRemoved` frame in both mirrors

Task: T1 (2026-11-13)

Files changed:
- `src/backend/src/game/protocol.ts`
- `src/backend/src/game/protocol.test.ts`
- `src/frontend/src/multiplayer/protocol.ts`
- `src/frontend/src/multiplayer/protocol.test.ts`
- `docs/features/realtime-broadcast-batching/build-log-T1.md`

What changed & why:
- Both `ServerMessage` mirrors gain the additive `{ type: 'miniCubesRemoved'; playerId: string; ids: MiniCubeId[] }` union member; the legacy `miniCubeRemoved { playerId, id }` shape and every existing builder are untouched.
- The backend `miniCubesRemovedMessage(playerId, ids)` validates at runtime before copying — non-empty `playerId`, `Array.isArray(ids)`, non-empty `ids`, every id a non-empty string — and throws `TypeError('invalid miniCubesRemoved payload')` on any violation; the returned `ids` array is always a fresh copy.
- The frontend `parseServerMessage` gains the `miniCubesRemoved` case with the same presence/type bar and a copied `ids: MiniCubeId[]`, returning `{ ok: false, error: 'bad_message' }` on any malformed frame.
- The frontend mirror gains the parity builder `miniCubesRemovedMessage` with the identical validation/copy contract; both module header comments document the new frame and the unchanged legacy one.
- Tests pin the exact encoded frame, the legacy byte shape, the full invalid set in both mirrors, the decoder/builder copy, and the 30-id frame-size bound.

Decisions:
- Validation happens before the array copy, so an invalid payload can never produce a message object (mirrors `lootboxOpenedMessage`'s fail-fast).
- No protocol version field and no changes to `MAX_MESSAGE_BYTES`, `MAX_STEPS` or any existing message shape (spec § Non-goals; plan § Protocol).
- The test fixtures use the task-pinned literal `{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0","front:0:1"]}`; the backend suite pins it through `encodeServerMessage`, and the frontend suite decodes that exact wire text and re-encodes it through its parity builder.
- Tier note: the builders/validators are unit-tested per mirror; the wire boundary itself is exercised by the backend encoder → pinned JSON literal → frontend decoder path (the cross-mirror contract). The socket-level integration chain is T3/T4 by task design (`files_owned` here contains only the two protocol modules and their suites).

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

- `npm test` → exit 0 (both workspaces)
```
> test
> npm run test --workspaces --if-present


> test
> vitest run
...
 Test Files  24 passed (24)
      Tests  881 passed (881)


> test
> vitest run
...
 Test Files  69 passed (69)
      Tests  1833 passed (1833)
```

- `npm run coverage` → exit 0 (both workspaces, thresholds ≥ 80 pass)
```
> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
...
 Test Files  24 passed (24)
      Tests  881 passed (881)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.45 |    87.79 |    99.7 |   95.45 |
...
  protocol.ts      |   98.86 |    98.55 |   96.66 |   98.86 | 238-239,553-554


> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
...
 Test Files  69 passed (69)
      Tests  1833 passed (1833)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.43 |    96.12 |   97.54 |   96.43 |
...
  protocol.ts      |   89.13 |    96.02 |   90.32 |   89.13 | ...1076,1080-1090
```

- Focused new-test runs (verbose, exact names):

`npx vitest run src/game/protocol.test.ts --reporter=verbose` (from `src/backend`) → exit 0
```
 ✓ src/game/protocol.test.ts > server-message builders > builds miniCubesRemoved with an ordered copy of the ids
 ✓ src/game/protocol.test.ts > encodeServerMessage > keeps the legacy miniCubeRemoved frame byte-identical
 ✓ src/game/protocol.test.ts > encodeServerMessage > encodes miniCubesRemoved as one pinned JSON frame
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects a missing playerId
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects an empty playerId
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects a non-string playerId
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects missing ids
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects null ids
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects non-array ids
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects empty ids
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects a non-string id
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > rejects an empty id
 ✓ src/game/protocol.test.ts > miniCubesRemovedMessage — runtime validation > keeps a 30-id batch frame under the 1024-byte cap
```

`npx vitest run src/multiplayer/protocol.test.ts --reporter=verbose` (from `src/frontend`) → exit 0
```
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — catalog happy paths > decodes miniCubesRemoved with a fresh copy of the ids
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — missing required fields > rejects "{\"type\":\"miniCubesRemoved\",\"playerId\":\"p1\"}" with bad_message
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — missing required fields > rejects "{\"type\":\"miniCubesRemoved\",\"ids\":[\"front:0:0\"]}" with bad_message
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — wrong field types and out-of-catalog values > rejects "{\"type\":\"miniCubesRemoved\",\"playerId\":\"\",\"ids\":[\"front:0:0\"]}" with bad_message
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — wrong field types and out-of-catalog values > rejects "{\"type\":\"miniCubesRemoved\",\"playerId\":\"p1\",\"ids\":null}" with bad_message
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — wrong field types and out-of-catalog values > rejects "{\"type\":\"miniCubesRemoved\",\"playerId\":\"p1\",\"ids\":\"front:0:0\"}" with bad_message
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — wrong field types and out-of-catalog values > rejects "{\"type\":\"miniCubesRemoved\",\"playerId\":\"p1\",\"ids\":[]}" with bad_message
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — wrong field types and out-of-catalog values > rejects "{\"type\":\"miniCubesRemoved\",\"playerId\":\"p1\",\"ids\":[\"front:0:0\",7]}" with bad_message
 ✓ src/multiplayer/protocol.test.ts > parseServerMessage — wrong field types and out-of-catalog values > rejects "{\"type\":\"miniCubesRemoved\",\"playerId\":\"p1\",\"ids\":[\"\"]}" with bad_message
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > builds the batch with a copy of the ids
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects a missing playerId
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects an empty playerId
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects a non-string playerId
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects missing ids
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects null ids
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects non-array ids
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects empty ids
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects a non-string id
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > rejects an empty id
 ✓ src/multiplayer/protocol.test.ts > miniCubesRemovedMessage > encodes as one JSON frame
```

- Frame-size measurement (same `allIds(7).slice(0, 30)` batch the test pins), raw:
```
$ node --import tsx --input-type=module -e "import { miniCubesRemovedMessage, encodeServerMessage } from './src/backend/src/game/protocol.ts'; import { allIds } from './src/backend/src/game/cubes.ts'; const ids = allIds(7).slice(0, 30); const encoded = encodeServerMessage(miniCubesRemovedMessage('p1', ids)); console.log(JSON.stringify({ idCount: ids.length, bytes: Buffer.byteLength(encoded, 'utf8') }));"
{"idCount":30,"bytes":411}
```

Exact tests added:

Backend (`src/backend/src/game/protocol.test.ts`, 13 new cases):
- `server-message builders` → `builds miniCubesRemoved with an ordered copy of the ids`
- `encodeServerMessage` → `keeps the legacy miniCubeRemoved frame byte-identical`
- `encodeServerMessage` → `encodes miniCubesRemoved as one pinned JSON frame`
- `miniCubesRemovedMessage — runtime validation` → `rejects a missing playerId`, `rejects an empty playerId`, `rejects a non-string playerId`, `rejects missing ids`, `rejects null ids`, `rejects non-array ids`, `rejects empty ids`, `rejects a non-string id`, `rejects an empty id` (each asserts `TypeError('invalid miniCubesRemoved payload')`), and `keeps a 30-id batch frame under the 1024-byte cap`.

Frontend (`src/frontend/src/multiplayer/protocol.test.ts`, 20 new cases):
- `parseServerMessage — catalog happy paths` → `decodes miniCubesRemoved with a fresh copy of the ids` (exact pinned literal, two decodes with distinct `ids` arrays)
- `parseServerMessage — missing required fields` → two-row `it.each` extension for a missing `playerId` and missing `ids` (both `bad_message`)
- `parseServerMessage — wrong field types and out-of-catalog values` → six-row `it.each` extension: empty `playerId`, `null` ids, string ids, empty ids, non-string entry, empty-string entry (all `bad_message`)
- `miniCubesRemovedMessage` → `builds the batch with a copy of the ids`, the same nine invalid payloads (`TypeError('invalid miniCubesRemoved payload')`), and `encodes as one JSON frame`.

Acceptance audit:
- AC-8 (frame shape) → met: the union member exists in both mirrors; the backend builder returns exactly `{ type: 'miniCubesRemoved', playerId, ids }`; the pinned encoded frame is asserted in both suites.
- AC-9 (legacy shape untouched) → met: `miniCubeRemovedMessage` is unchanged and a new test pins its byte-identical encoding; no existing shape/builder was edited.
- AC-14 (frame-size bound) → met: the 30-id `allIds(7).slice(0, 30)` batch encodes to 411 bytes, asserted `<= 1024`; `MAX_MESSAGE_BYTES`/`MAX_STEPS` unchanged.
- AC-16 (mirror agreement, validation, copy) → met: the backend builder throws `TypeError` for missing/empty `playerId`, missing/`null`/non-array/empty `ids`, and non-string/empty ids; the frontend decoder rejects the same set with `bad_message`; both copies are asserted; no protocol version bump.

Deviations from spec: none. T2–T5 were not started: no batching scheduler, hub, registry, economy, session, reducer or render file was touched.
