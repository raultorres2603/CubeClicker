# Build log — T4 — Backend protocol catalog and codecs

Task: T4 (2026-10-21)
Files changed: `src/backend/src/game/protocol.ts`, `src/backend/src/game/protocol.test.ts`,
`docs/features/multiplayer-servers/build-log-T4.md`

## What changed & why

- `protocol.ts` (new, pure: JSON in / JSON out, no I/O, no deps) owns the multiplayer wire
  catalog for both directions: `ClientMessage` (`join`, `rejoin`, `explode`,
  `cubeCompleted`), `ServerMessage` (`hello`, `welcome`, `worldEntered`, `memberJoined`,
  `memberLeft`, `miniCubeRemoved`, `levelAdvanced`, `stateSync`, `error`), the shared shapes
  (`MemberState`, `CubeState`, `Position`, `MiniCubeId`/`FaceId`, `ErrorCode`) and
  `MAX_MESSAGE_BYTES = 1024` (spec § 8, § Pinned constants, plan § Protocol).
- `parseClientMessage(text)` → `{ ok: true, message } | { ok: false, error: 'bad_message' }`:
  non-JSON text, a non-object frame, an unknown/missing `type`, a missing required field or a
  wrong field type are all rejected; extra fields are dropped (never forwarded). Field
  *values* (`explode.id/level`, `cubeCompleted.level`) pass through untouched because the hub
  owns semantic validation (`invalid_click`/`invalid_completion`, AC-14/AC-15).
- Server-message builders (`welcomeMessage`, `worldEnteredMessage`, `memberJoinedMessage`,
  `memberLeftMessage`, `miniCubeRemovedMessage`, `levelAdvancedMessage`, `stateSyncMessage`,
  `errorMessage`) plus `encodeServerMessage` (single JSON text frame) — the exact shapes the
  hub (T5) sends. Builders copy their inputs so later hub mutations cannot rewrite an
  already-built frame; `levelAdvanced` always carries `removedIds: []` (fresh board).
- `hello` is **not** rebuilt here: the catalog only declares its exact shape, and the test
  asserts `encodeServerMessage(helloMessage(...))` is byte-shape-identical to the accepted
  `app.ts` envelope. `app.ts` is untouched.
- Tests pin every codec branch with concrete payloads: 4 happy paths, whitespace tolerance,
  extra-field dropping, value pass-through, 11 non-JSON/non-object frames, 8 unknown/missing/
  mistyped `type` frames, 4 missing-field cases, 12 wrong-field-type cases, every builder's
  exact object, `toStrictEqual` where the absence of `detail`/presence of `removedIds: []`
  matters, encoder output strings, and input-copy behaviour.

## Exported catalog (as shipped)

```ts
// src/backend/src/game/protocol.ts
export const MAX_MESSAGE_BYTES = 1024;
export type { Position };                       // re-exported from servers.ts ({ x, y })

export type FaceId = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export type MiniCubeId = `${FaceId}:${number}:${number}`;
export interface CubeState { levelIndex: number; gridSize: number; styleId: string; removedIds: string[] }
export interface MemberState { playerId: string; name: string; position: Position;
                               levelIndex: number; gridSize: number; styleId: string; removedIds: string[] }
export type ErrorCode = 'bad_message' | 'not_joined' | 'rate_limited'
                      | 'invalid_click' | 'invalid_completion' | 'resume_failed';

export type ClientMessage =
  | { type: 'join' }
  | { type: 'rejoin'; token: string }
  | { type: 'explode'; id: MiniCubeId; level: number }
  | { type: 'cubeCompleted'; level: number };

export type ServerMessage =
  | { type: 'hello'; serverTime: string }
  | { type: 'welcome'; playerId: string; name: string; token: string; serverId: number;
      maxUsers: number; position: Position; self: CubeState; roster: MemberState[] }
  | { type: 'worldEntered'; /* same placement shape */ }
  | { type: 'memberJoined'; member: MemberState }
  | { type: 'memberLeft'; playerId: string; reason: 'left' | 'moved' }
  | { type: 'miniCubeRemoved'; playerId: string; id: MiniCubeId }
  | { type: 'levelAdvanced'; playerId: string; levelIndex: number; gridSize: number;
      styleId: string; position: Position; removedIds: [] }
  | { type: 'stateSync'; playerId: string; levelIndex: number; gridSize: number;
      styleId: string; removedIds: string[] }
  | { type: 'error'; code: ErrorCode; detail?: string };

export type ClientMessageParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: 'bad_message' };
export function parseClientMessage(text: string): ClientMessageParseResult;

export interface Placement { playerId: string; name: string; token: string; serverId: number;
                              maxUsers: number; position: Position; self: CubeState; roster: MemberState[] }
export interface LevelAdvance { playerId: string; levelIndex: number; gridSize: number;
                                styleId: string; position: Position }
export interface CubeSync { playerId: string; levelIndex: number; gridSize: number;
                            styleId: string; removedIds: string[] }

export function welcomeMessage(placement: Placement): ServerMessage;
export function worldEnteredMessage(placement: Placement): ServerMessage;
export function memberJoinedMessage(member: MemberState): ServerMessage;
export function memberLeftMessage(playerId: string, reason: 'left' | 'moved'): ServerMessage;
export function miniCubeRemovedMessage(playerId: string, id: MiniCubeId): ServerMessage;
export function levelAdvancedMessage(advance: LevelAdvance): ServerMessage;
export function stateSyncMessage(cube: CubeSync): ServerMessage;
export function errorMessage(code: ErrorCode, detail?: string): ServerMessage;
export function encodeServerMessage(message: ServerMessage): string;
```

## Decisions

- `Position` is re-exported from `servers.ts` (T1) instead of being declared twice in the
  backend; the import is type-only, so the module stays pure. The wire `CubeState` here is
  deliberately *not* the internal `cubes.ts` state: the wire carries `removedIds: string[]`,
  the authoritative in-memory state carries a `Set<string>` (T3).
- `explode.id` decodes as "a non-empty string" narrowed to `MiniCubeId` (documented in the
  code): enforcing the `face:row:col` text shape here would turn an unknown/removed id into
  `bad_message`, contradicting AC-14's `invalid_click` + `stateSync` path. Existence and grid
  bounds stay the hub's `validateExplode` check.
- `level` is type-checked only (`number`); JSON cannot carry `NaN`/`Infinity`, and a stale or
  out-of-range level is a semantic (`invalid_*`) error, not a decode error.
- Empty strings are rejected for required strings (`token`, `id`) — `""` can never be a valid
  identity or mini-cube id.
- Oversized frames are the caller's job (spec assigns the byte check to the hub): only the
  constant lives here, and a test pins it equal to `loadGameConfig({}).maxMessageBytes` so the
  two homes of 1024 cannot drift (closes T1's Q-T1-2 concern without editing `config.ts`).
- `hello` variants: `ServerMessage` declares `{ type: 'hello'; serverTime: string }`
  structurally identical to `app.ts`'s `HelloMessage`; no second hello builder exists.

## Evidence

```
$ npm test --workspace @cubeclicker/backend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 4ms
 ✓ src/game/cubes.test.ts (24 tests) 7ms
 ✓ src/game/servers.test.ts (30 tests) 7ms
 ✓ src/game/players.test.ts (13 tests) 12ms
 ✓ src/game/protocol.test.ts (56 tests) 11ms
 ✓ src/app.test.ts (4 tests) 95ms

 Test Files  6 passed (6)
      Tests  140 passed (140)
   Start at  22:36:53
   Duration  403ms
```

```
$ npx vitest run src/game/protocol.test.ts --root src/backend
 ✓ src/game/protocol.test.ts (56 tests) 6ms

 Test Files  1 passed (1)
      Tests  56 passed (56)
```

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 6ms
 ✓ src/game/servers.test.ts (30 tests) 6ms
 ✓ src/game/cubes.test.ts (24 tests) 7ms
 ✓ src/game/players.test.ts (13 tests) 10ms
 ✓ src/game/protocol.test.ts (56 tests) 9ms
 ✓ src/app.test.ts (4 tests) 108ms

 Test Files  6 passed (6)
      Tests  140 passed (140)

 % Coverage report from v8
--------------|---------|----------|---------|---------|-------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------|---------|----------|---------|---------|-------------------
All files     |     100 |      100 |     100 |     100 |
 src          |     100 |      100 |     100 |     100 |
  app.ts      |     100 |      100 |     100 |     100 |
 src/game     |     100 |      100 |     100 |     100 |
  config.ts   |     100 |      100 |     100 |     100 |
  cubes.ts    |     100 |      100 |     100 |     100 |
  players.ts  |     100 |      100 |     100 |     100 |
  protocol.ts |     100 |      100 |     100 |     100 |
  servers.ts  |     100 |      100 |     100 |     100 |
--------------|---------|----------|---------|---------|-------------------
(exit 0)
```

```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit
(exit 0, no output)
```

```
$ npm run lint
> lint
> eslint .
(exit 0, no output)
```

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled" src/backend/src/game/protocol.test.ts
(no matches, exit 1)
```

Coverage table (task bar: ≥ 80 on all four metrics, unchanged thresholds, no exclusions):

| File | % Stmts | % Branch | % Funcs | % Lines |
| --- | --- | --- | --- | --- |
| All files (backend workspace) | 100 | 100 | 100 | 100 |
| `src/game/protocol.ts` | 100 | 100 | 100 | 100 |

## Acceptance audit

- **AC-20 (codec matrix)** → met for this task's codec half: `protocol.test.ts` pins every
  `ClientMessage` happy path (`join`, `rejoin`, `explode`, `cubeCompleted`), the
  unknown-type / non-JSON / non-object / missing-field / wrong-type `bad_message` matrix, the
  extra-field dropping rule and the `MAX_MESSAGE_BYTES = 1024` constant (plus its parity with
  `loadGameConfig`). The remaining AC-20 obligations — hello-first ordering, server-scoped
  broadcast sets, `not_joined`, second `join`/`rejoin`, oversized-frame drop — are the hub's
  and are owned by T5 (`hub.test.ts`, `app.test.ts`); this task supplies the constant and the
  codec they consume.
- **hello unchanged** → met: `encodeServerMessage(helloMessage(new Date('2026-10-21T12:34:56.789Z')))`
  is asserted to equal `{"type":"hello","serverTime":"2026-10-21T12:34:56.789Z"}`; `app.ts`
  was not modified (see `git diff --stat` in the commit).
- **Scope** → met: only `src/backend/src/game/protocol.ts`,
  `src/backend/src/game/protocol.test.ts` and this log changed.

## Deviations from spec

- **Integration tier (documented exception).** `protocol.ts` is a pure codec with no I/O
  boundary of its own, so there is no socket to stand up inside this task's `files_owned`
  (`app.ts`/`hub.ts` belong to T5). The integration evidence shipped here is compositional:
  (a) the retained `app.ts` `helloMessage` through the new `encodeServerMessage`, and (b) the
  pinned constant against `loadGameConfig({}).maxMessageBytes`. The real wire-level
  integration (hello-first over a live socket, join/welcome) lands in T5's `app.test.ts`/
  `hub.test.ts`, and the cross-service tier in T15's smoke test.
- **`explode.id` is not format-validated at decode time** (non-empty string only), on purpose:
  AC-14 requires unknown/removed ids to yield `invalid_click` + `stateSync`, not
  `bad_message`. Documented in the module and above.
- No other deviation; no dependency added, no config/threshold change, no exclusions.

## Transient findings from concurrent tasks (not T4)

- At 22:36:35 the workspace suite failed once in `src/game/cubes.test.ts`
  (`allIds > lists all 294 ids of a 7×7 level…`: expected `back:6:6` at index 98, received
  `left:0:0`). That file belongs to T3, which was mid-write in the same workspace; my
  `protocol.test.ts` was already green in isolation. The failing assertion cleared by
  22:36:53 with no change on my side, and the final run above is green. No T4 file is
  implicated.

## Open questions

- Q-T4-1: should the codec also enforce the `face:row:col` text shape for `explode.id`
  (`bad_message` for a malformed id) instead of forwarding it for `invalid_click`? Current
  choice follows AC-14; a reviewer decision here would only change one guard and two tests.
- Q-T4-2: T5 will need the byte-length check; `MAX_MESSAGE_BYTES` is exported but no helper
  (the hub can use `Buffer.byteLength(text)`). If the reviewer prefers a shared
  `isOversizedMessage(text)` in `protocol.ts`, it is a small additive follow-up in T5's
  scope — not added here to avoid speculative API.
