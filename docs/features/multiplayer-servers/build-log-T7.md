# Build log — T7 — Frontend multiplayer core: codec, world-state reducer, spectate machine

Task: T7 (2026-10-22)
Files changed: `src/frontend/src/multiplayer/protocol.ts`, `protocol.test.ts`,
`src/frontend/src/multiplayer/server-state.ts`, `server-state.test.ts`,
`src/frontend/src/multiplayer/spectate.ts`, `spectate.test.ts`,
`docs/features/multiplayer-servers/build-log-T7.md` (this log)

## Sketch (≤5 lines)

Three pure, DOM-free modules. `protocol.ts` mirrors the backend catalog and codecs verbatim
(client decode parity + a server-frame decoder the transport will use). `server-state.ts`
reduces `ServerMessage` into `{ serverId, maxUsers, self, members (slot order), pendingWorldSwap }`
with branch-level referential stability, plus `applyWorldSwap`. `spectate.ts` is a small
`none | traveling | viewing | returning` machine whose only inputs are server-assigned positions
and member ids; no timers, storage, sockets or DOM.

## What changed & why

- **`multiplayer/protocol.ts`** — the frontend half of the wire catalog: the exact backend
  `ClientMessage`/`ServerMessage` unions, `CubeState`/`MemberState`/`Position`/`ErrorCode`,
  `MAX_MESSAGE_BYTES = 1024`, `parseClientMessage` (behaviourally identical to T4: presence +
  type validation only, extra fields dropped, value semantics left to the server),
  `parseServerMessage` (the transport's decode path: every catalog frame validated, unknown
  types / malformed fields / non-JSON → `bad_message`, defensive copies of nested
  arrays/objects), and `encodeClientMessage`. Type-only import of `FaceId`/`MiniCubeId` from
  the accepted `game/types.ts` keeps the id vocabulary single-sourced.
- **`multiplayer/server-state.ts`** — pure reducer over decoded server messages. `welcome`
  seeds the server id/capacity/own placement/roster (self split out of `members`);
  `memberJoined`/`memberLeft` maintain the roster; `miniCubeRemoved` appends an id to the
  owner's board (idempotent, so the origin's ack is a no-op when the optimistic local play
  already applied it); `levelAdvanced` replaces a member's cube + position; `stateSync`
  replaces a board authoritatively; `worldEntered` records `pendingWorldSwap` (server id,
  capacity, placement, next cube, roster); `applyWorldSwap` consumes it exactly once (AC-12).
  Untouched branches keep their reference; real changes return a new state.
- **`multiplayer/spectate.ts`** — `createSpectateController()` returning
  `get/requestTravel/arrive/requestReturn/arrivedHome/onMemberLeft/reset`. One flight at a
  time (`requestTravel` is refused while `traveling` **or** `returning`), `arrive` lands a
  member flight in `viewing` and a return flight in `none`, `requestReturn` works only from
  `viewing`, `onMemberLeft` reports (and clears) the auto-return for the viewed/travelled
  target, `reset` clears every mode for reconnect.

### Slot-order correction (T1b interaction)

`MemberState` carries no slot index — only the server-assigned ring position — and since T1b
a join fills the **lowest free slot**, so arrival order can differ from slot order after a
hole (e.g. p3 is in slot 3, p4 joins into slot 2). The reducer therefore orders `members` by
the slot derived from the position (`round(atan2(y, x) / 2π · X) mod X`, ties keep input
order), which is exactly the `worldPosition` formula T1/T1b pin. This makes the roster the
panel consumes (T14) real slot order, not join order.

## Decisions

- **Server-frame decoding lives in the frontend catalog.** T4 only decodes client frames
  (the server never receives `hello`/`welcome`/…); the frontend needs the mirror direction for
  T9. `parseServerMessage` validates the complete catalog (including the closed `ErrorCode`
  set and `levelAdvanced`'s pinned empty `removedIds`) and never throws.
- **`pendingWorldSwap` is a superset of the plan's pinned shape.** The plan lists
  `{ serverId, position, roster }`; a mover never receives a `levelAdvanced` for the target
  level, so the swap also carries `maxUsers` and the `self` cube from `worldEntered`. Without
  them `applyWorldSwap` could not seed the target world exactly like a `welcome` (AC-12).
- **`worldEntered` does not mutate the current world.** It only records the pending swap;
  the old world stays rendered until the session applies the swap at the travel midpoint
  (AC-12), and the swap is consumed exactly once.
- **Spectate has an extra `returning` variant and `onMemberLeft` returns a boolean.** The
  plan's three-mode sketch has no way to represent the flight home; `returning` keeps the
  "one travel at a time" rule enforceable during that flight. `onMemberLeft` answers whether
  the session must dispatch the return flight (it cannot start one itself — the controller
  holds no own position), then drops to `none`. Semantics of the pinned methods hold.
- **No `MAX_MESSAGE_BYTES` size check in the codec.** Same split as the backend: the constant
  is exported and the caller (transport, T9) drops oversized frames before decoding.

## Testing tiers

These three modules are pure logic with **no integration boundary of their own** (no socket,
no DOM, no storage, no timers). The tier-1 suites below are therefore unit tests, and the
cross-end wire contract is covered by the parity run (both codecs over the T4 fixture set) plus
the downstream integration suites T9 (transport over a fake connection) and T13 (session over
the real store). Documented exception per the `web-implementation` testing bar; no assertion
was weakened to avoid an integration seam.

## Parity evidence (AC-20)

`protocol.test.ts` pins the **same client fixture set** as the backend: the three
`invalidFrames` arrays (11 non-JSON/non-object, 8 unknown/mistyped type, 12 wrong field types)
are copied verbatim, and the happy-path frames + expected results match. In addition, the
following script (run from the repository root, Node 24 type-stripping imports both TS
modules) re-extracts both fixture sets and asserts both codecs return identical results:

```js
// /tmp/t7-parity.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = await import('/var/home/raultorraco/Documents/Projects/CubeClicker/src/backend/src/game/protocol.ts');
const frontend = await import('/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/multiplayer/protocol.ts');

const fixtures = [
  // happy paths
  '{"type":"join"}',
  '{"type":"rejoin","token":"0123456789abcdef0123456789abcdef"}',
  '{"type":"explode","id":"front:2:3","level":4}',
  '{"type":"cubeCompleted","level":0}',
  '  {"type":"join"}\n',
  '{"type":"explode","id":"left:0:0","level":1,"playerId":"p9","nested":{"a":[1,2]}}',
  '{"type":"join","token":"smuggled"}',
  '{"type":"explode","id":"top:1:1","level":99}',
  // non-JSON / non-object
  '', '   ', 'join', '{"type":"join"', "{'type':'join'}", 'null', 'true', '42', '"join"', '[]', '[{"type":"join"}]',
  // unknown / missing / mistyped type
  '{}', '{"type":7}', '{"type":null}', '{"type":"JOIN"}', '{"type":"join "}',
  '{"type":"hello","serverTime":"2026-10-21T12:00:00.000Z"}', '{"type":"welcome"}',
  '{"type":"error","code":"bad_message"}',
  // missing required fields
  '{"type":"rejoin"}', '{"type":"explode","level":0}', '{"type":"explode","id":"front:0:0"}',
  '{"type":"cubeCompleted"}',
  // wrong field types
  '{"type":"rejoin","token":7}', '{"type":"rejoin","token":null}', '{"type":"rejoin","token":""}',
  '{"type":"rejoin","token":{"value":"0123456789abcdef"}}',
  '{"type":"explode","id":7,"level":0}', '{"type":"explode","id":"","level":0}',
  '{"type":"explode","id":null,"level":0}', '{"type":"explode","id":["front:0:0"],"level":0}',
  '{"type":"explode","id":"front:0:0","level":"0"}', '{"type":"explode","id":"front:0:0","level":null}',
  '{"type":"cubeCompleted","level":"0"}', '{"type":"cubeCompleted","level":false}',
];

let compared = 0;
for (const text of fixtures) {
  assert.deepStrictEqual(
    frontend.parseClientMessage(text),
    backend.parseClientMessage(text),
    `parity mismatch for ${JSON.stringify(text)}`,
  );
  compared += 1;
}
assert.equal(frontend.MAX_MESSAGE_BYTES, backend.MAX_MESSAGE_BYTES);
assert.equal(frontend.MAX_MESSAGE_BYTES, 1024);

// Extract the `const invalidFrames ... [` blocks from both test files and require the
// literal sets to match, so the pinned parity fixtures cannot drift silently.
function fixturesFrom(path) {
  const source = readFileSync(path, 'utf8');
  const blocks = [...source.matchAll(/const invalidFrames: readonly string\[\] = \[([\s\S]*?)\n  \];/g)];
  return blocks.map(([, body]) =>
    [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(([, s]) => s.replace(/\\'/g, "'")),
  );
}
const backendSets = fixturesFrom('/var/home/raultorraco/Documents/Projects/CubeClicker/src/backend/src/game/protocol.test.ts');
const frontendSets = fixturesFrom('/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/multiplayer/protocol.test.ts');
assert.deepStrictEqual(frontendSets, backendSets);

console.log(`parity OK: ${compared} client fixtures decode identically; MAX_MESSAGE_BYTES=${frontend.MAX_MESSAGE_BYTES}`);
console.log(`fixture-array parity OK: backend ${backendSets.length} arrays / ${backendSets.flat().length} literals, frontend ${frontendSets.length} arrays / ${frontendSets.flat().length} literals`);
```

```
$ node /tmp/t7-parity.mjs
parity OK: 43 client fixtures decode identically; MAX_MESSAGE_BYTES=1024
fixture-array parity OK: backend 3 arrays / 32 literals, frontend 3 arrays / 32 literals
parity exit=0
```

Server-frame decoding has no backend counterpart (the backend never decodes `ServerMessage`),
so its codec matrix is pinned locally in `protocol.test.ts`: every catalog message happy path,
unknown/foreign types, non-object frames, missing fields, wrong field types, out-of-catalog
`error` codes and a non-empty `levelAdvanced.removedIds`.

## Evidence (raw command output)

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/ui/theme.test.ts (2 tests) 3ms
 ✓ src/game/effects.test.ts (28 tests) 14ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 7ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 20ms
 ✓ src/game/progression.test.ts (10 tests) 13ms
 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 14ms
 ✓ src/browser-env.test.ts (6 tests) 21ms
 ✓ src/render/webgl.test.ts (5 tests) 13ms
 ✓ src/game/board.test.ts (18 tests) 25ms
 ✓ src/input/gestures.test.ts (21 tests) 6ms
 ✓ src/input/keyboard.test.ts (13 tests) 6ms
 ✓ src/game/engine.test.ts (45 tests) 41ms
 ✓ src/ui/Hud.test.tsx (3 tests) 9ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/render/particles.test.ts (19 tests) 19ms
 ✓ src/render/cube-view.test.ts (32 tests) 37ms
 ✓ src/render/picking.test.ts (12 tests) 23ms
 ✓ src/render/starfield.test.ts (15 tests) 76ms
 ✓ src/App.test.tsx (4 tests) 16ms
 ✓ src/game/session.test.ts (25 tests) 70ms
 ✓ src/render/scene.test.ts (51 tests) 105ms

 Test Files  23 passed (23)
      Tests  502 passed (502)
test exit=0
```

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  23 passed (23)
      Tests  502 passed (502)

 % Coverage report from v8
------------------|---------|----------|---------|---------|-------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
------------------|---------|----------|---------|---------|-------------------
All files         |   99.41 |    99.28 |     100 |   99.41 |                   
 src              |     100 |      100 |     100 |     100 |                   
  App.tsx         |     100 |      100 |     100 |     100 |                   
  browser-env.ts  |     100 |      100 |     100 |     100 |                   
 src/game         |     100 |    99.6 |     100 |     100 |                   
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
 src/multiplayer  |   99.64 |    98.97 |     100 |   99.64 |                   
  protocol.ts     |     100 |      100 |     100 |     100 |                   
  server-state.ts |   99.18 |    96.87 |     100 |   99.18 | 119-120            
  spectate.ts     |     100 |      100 |     100 |     100 |                   
 src/render       |     100 |      100 |     100 |     100 |                   
  cube-view.ts    |     100 |      100 |     100 |     100 |                   
  particles.ts    |     100 |      100 |     100 |     100 |                   
  picking.ts      |     100 |      100 |     100 |     100 |                   
  scene.ts        |     100 |      100 |     100 |     100 |                   
  starfield.ts    |     100 |      100 |     100 |     100 |                   
  webgl.ts        |     100 |      100 |     100 |     100 |                   
 src/ui           |   79.48 |      100 |     100 |   79.48 |                   
  GameCanvas.tsx  |    61.9 |      100 |     100 |    61.9 | 23-30              
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws           |   95.34 |    92.59 |     100 |   95.34 |                   
  connection.ts   |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100      
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

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled|not\.toThrow" src/frontend/src/multiplayer/*.test.ts
banned-matcher grep exit=1 (no matches)

$ grep -nE "document|window|setTimeout|setInterval|Date\.now|Math\.random|localStorage|sessionStorage|fetch\(|WebSocket|process\." src/frontend/src/multiplayer/protocol.ts src/frontend/src/multiplayer/server-state.ts src/frontend/src/multiplayer/spectate.ts
purity grep exit=1 (no matches)
```

## Coverage

| Scope | % Stmts | % Branch | % Funcs | % Lines | Gate (≥ 80) |
| --- | --- | --- | --- | --- | --- |
| `src/multiplayer/protocol.ts` | 100 | 100 | 100 | 100 | pass |
| `src/multiplayer/server-state.ts` | 99.18 | 96.87 | 100 | 99.18 | pass |
| `src/multiplayer/spectate.ts` | 100 | 100 | 100 | 100 | pass |
| frontend workspace (all files) | 99.41 | 99.28 | 100 | 99.41 | pass |

No exclusions added, no thresholds changed. The only uncovered `server-state.ts` lines are the
defensive `maxUsers <= 0` guard in `slotIndex` (a member cannot join before `welcome` in the
real flow); the pre-existing `GameCanvas.tsx`/`ws/connection.ts` residuals are unchanged.

## Acceptance audit

- **AC-12 (reducer scope) — client-visible move effect. met.** `server-state.test.ts >
  worldEntered and applyWorldSwap (AC-12)` runs `memberLeft (moved)` → `worldEntered` → swap
  and asserts the exact target world (server 2, `maxUsers` 10, own `(30.902172888029035,
  22.45174281092734)`, cube level 3 / N 7 / `violet-nebula` / empty board, members
  `[p2 @ slot 1]`, `pendingWorldSwap: null`), plus exactly-once consumption. The scene/session
  halves of AC-12 are owned by T12/T13.
- **AC-17 (machine scope) — spectate travel. met.** `spectate.test.ts` asserts: `none` at
  rest; `requestTravel` → `{ traveling, target, destination }`; a second selection mid-flight
  is refused with `false` and the same status reference; `arrive` → `viewing`; `arrive` at
  rest/viewing is a same-reference no-op; switching targets while viewing is allowed;
  `requestReturn` only from `viewing`; return and member flights are mutually exclusive
  (`requestTravel` while `returning` → `false`); `arrive` on a return flight → `none`. Flight
  math is T11, input gating is T8, scene rendering is T12.
- **AC-19 (machine edge cases) — auto-return and reconnect reset. met.** `onMemberLeft` for
  the viewed target and for the in-flight target returns `true` and drops to `none` (a/b);
  another member's departure or a departure at rest / while flying home returns `false` and
  keeps the same reference; `reset()` clears `traveling`, `viewing` and `returning` and is
  idempotent at rest (d). Live remote play (e), same-server rebuild (c) belong to T10/T12.
- **AC-20 (codec parity) — frontend catalog matches the backend. met.** `protocol.test.ts`
  replays the T4 client fixture set verbatim (same 32 invalid literals in the same three
  arrays, same happy paths) and the parity script above asserts 43 client frames decode
  identically on both ends, `MAX_MESSAGE_BYTES` equal on both ends. The server-frame matrix is
  pinned locally (all catalog messages + rejection matrix).

## Deviations from spec

1. **`SpectateStatus` adds `returning`** (`{ mode: 'returning'; destination }`) and
   `onMemberLeft` returns `boolean` instead of `void`. Reason: the plan's three-mode sketch has
   no representation for the flight home, so "one travel at a time" could not be enforced
   during it; the boolean is how the session learns it must dispatch the auto-return (the
   controller has no own position). All pinned transitions/semantics hold; downstream is T13.
2. **`pendingWorldSwap` carries `maxUsers` + `self`** on top of the plan's pinned
   `{ serverId, position, roster }`, so the swap can seed the target world like a `welcome`
   (a mover gets no `levelAdvanced` for that level). Additive fields only.
3. **Roster slot ordering derives the slot from the position** (no slot index on the wire).
   This resolves the T1b hole-refill case; it does not change any wire shape.

No pinned constant, protocol message or acceptance criterion was altered.

## Open questions

- Q-T7-1: T13/T14 may prefer `onMemberLeft` to leave the machine in a `returning` state (the
  controller would need the own position passed in). Current contract: it returns `true` +
  `none`, and the session dispatches the engine return flight directly; revisit only if the
  session flow reads worse.
- Q-T7-2: `server-state` orders by position angle, which assumes positions are exactly the
  `worldPosition` ring (true for every server message by construction). If a future message
  ever carries non-ring positions, ordering would need an explicit slot field.
