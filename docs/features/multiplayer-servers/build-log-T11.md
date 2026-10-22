# Build log — T11 — Spectate travel flight math

Task: T11 (2026-10-22)
Files changed: `src/frontend/src/render/spectate-travel.ts` (new),
`src/frontend/src/render/spectate-travel.test.ts` (new),
`docs/features/multiplayer-servers/build-log-T11.md` (this log)

## Sketch (≤5 lines)

Pure `travelCameraPose(origin, destination, p)` returning `{ position, lookTarget }`:
lateral `easeInOutQuad(p) · (destination − origin)`, depth `12 + 78 · travelSwing(p)`,
target `(x(p), y(p), 0)`, progress clamped, coincident lateral endpoints held at the rest
pose. No three.js objects, no DOM, no state. Exact pose tables pinned in tests.

## What changed & why

- **`spectate-travel.ts` — the pure flight pose.** T12 needs the accepted flight shape for
  `spectate`/`return` camera flights without duplicating the formula in `scene.ts`. The new
  module imports `easeInOutQuad` and `travelSwing` from `game/effects.ts` (it does not
  re-derive either easing), clamps progress to `[0, 1]`, and returns plain `{ x, y, z }`
  points so it stays a pure math module with no renderer dependency.
- **`spectate-travel.ts` — coincident endpoints.** When the lateral delta is zero the
  function returns the rest pose at every progress instead of a 78-unit pull-back with no
  lateral movement. This is the task's pinned `origin === destination` behaviour.
- **`spectate-travel.test.ts` — 7 unit tests.** Exact literals for both required pose
  tables, identity quaternion verified against a real `PerspectiveCamera`, progress
  clamping, the coincident-endpoint rest pose, the pure `+y` table (single-axis branch),
  and the endpoint-`z`-is-unused contract.

## Reused formula — exact source lines

The implementation is the accepted directional-travel formula, unchanged except that the
offset comes from the destination instead of a drawn direction:

| Piece | Accepted implementation | What this task reuses |
| --- | --- | --- |
| progress clamp | `src/frontend/src/render/scene.ts:160` — `Math.min(1, Math.max(0, progress))` | identical clamp (`spectate-travel.ts:75`) |
| lateral easing | `src/frontend/src/render/scene.ts:161` calls `easeInOutQuad` (defined `src/frontend/src/game/effects.ts:74-80`) | the same imported function (`spectate-travel.ts:31`), applied at `:86-88` |
| lateral offset | `src/frontend/src/render/scene.ts:163-164` — `fromX + offset.x * lateral`, `fromY + offset.y * lateral` | `origin.x + dx · lateral`, `origin.y + dy · lateral` with `dx = destination.x − origin.x`, `dy = destination.y − origin.y` (`:76-77`, `:87-88`) |
| depth | `src/frontend/src/render/scene.ts:166` — `REST_Z + (TRAVEL_END_Z − REST_Z) · travelSwing(clamped)`; `REST_Z = 12` at `:82`, `TRAVEL_END_Z = 90` at `:85` | `REST_Z + TRAVEL_RISE_Z · travelSwing(clamped)` with `REST_Z = 12`, `TRAVEL_RISE_Z = 78` (`spectate-travel.ts:34-37`, `:91`) — same 12 → 90 → 12 table |
| look target | `src/frontend/src/render/scene.ts:167` — `outTarget.set(x, y, 0)` | `lookTarget: { x, y, z: 0 }` (`:82`, `:92`) |
| pose table cross-check | `src/frontend/src/render/scene.test.ts:386-405` (right-direction table: `(0,0,12)`, `(3,0,51)`, `(12,0,90)`, `(21,0,51)`, `(24,0,12)`) | horizontal and pure-`+y` tables in `spectate-travel.test.ts` match these rows exactly |

No easing, depth constant, or coordinate convention was invented for this task.

## Pinned pose tables (unit tests, exact literals)

`identity` = camera quaternion `[0, 0, 0, 1]` after `PerspectiveCamera.lookAt(lookTarget)`;
asserted at every row of both tables.

### A — axis-aligned `(0, 0, 12)` → `(24, 0, 12)`

| p | position | lookTarget | quaternion |
| --- | --- | --- | --- |
| 0 | `(0, 0, 12)` | `(0, 0, 0)` | identity |
| 0.25 | `(3, 0, 51)` | `(3, 0, 0)` | identity |
| 0.5 | `(12, 0, 90)` | `(12, 0, 0)` | identity |
| 0.75 | `(21, 0, 51)` | `(21, 0, 0)` | identity |
| 1 | `(24, 0, 12)` | `(24, 0, 0)` | identity |

### B — non-axis-aligned `(24, 0, 12)` → `(0, 24, 12)`

| p | position | lookTarget | quaternion |
| --- | --- | --- | --- |
| 0 | `(24, 0, 12)` | `(24, 0, 0)` | identity |
| 0.25 | `(21, 3, 51)` | `(21, 3, 0)` | identity |
| 0.5 | `(12, 12, 90)` | `(12, 12, 0)` | identity |
| 0.75 | `(3, 21, 51)` | `(3, 21, 0)` | identity |
| 1 | `(0, 24, 12)` | `(0, 24, 0)` | identity |

All lateral values are dyadic-exact (`easeInOutQuad` = `0, 0.125, 0.5, 0.875, 1`;
`travelSwing` = `0, 0.5, 1, 0.5, 0`), so every cell is compared with `toEqual` and no
tolerance/`toBeCloseTo` is used.

### C — coincident endpoints

`travelCameraPose({ x: 24, y: 0, z: 12 }, <same lateral point>, p)` for
`p ∈ {0, 0.25, 0.5, 0.75, 1}` → position `(24, 0, 12)`, lookTarget `(24, 0, 0)` at every
`p` (constant rest pose; the depth does not rise to 90). Both the same object and a
distinct equal literal are exercised.

## Testing tiers

- **Unit (tier 1):** `spectate-travel.test.ts` exercises the pure function directly with
  exact literals, including all clamp and degeneracy branches (100 % line/branch coverage
  of the module).
- **Integration (documented exception):** `spectate-travel.ts` is a pure arithmetic
  function with no I/O, framework, timer, or renderer boundary of its own — the same
  situation documented in `build-log-T8.md`. Its real integration boundary is T12, which
  owns `scene.ts`/`scene.test.ts` and applies the pose to the camera each frame; that task
  will pin the spectate-flight camera positions in its scene tests. To keep this task
  honest about the camera-facing half of the contract, the identity-quaternion test applies
  every pose to a real three.js `PerspectiveCamera` (the exact object T12 will use) and
  asserts `[0, 0, 0, 1]` — so the target-is-directly-below-position guarantee is verified,
  not assumed. No integration assertion was weakened or skipped.

## Evidence (raw command output)

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/progression.test.ts (10 tests) 7ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/ws/connection.test.ts (10 tests) 14ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/render/webgl.test.ts (5 tests) 12ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 15ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 14ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 8ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/game/board.test.ts (18 tests) 35ms
 ✓ src/render/particles.test.ts (19 tests) 16ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 20ms
 ✓ src/ui/Hud.test.tsx (3 tests) 11ms
 ✓ src/input/keyboard.test.ts (13 tests) 15ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 15ms
 ✓ src/input/gestures.test.ts (21 tests) 13ms
 ✓ src/render/cube-view.test.ts (32 tests) 81ms
 ✓ src/game/engine.test.ts (58 tests) 86ms
 ✓ src/render/picking.test.ts (12 tests) 61ms
 ✓ src/render/starfield.test.ts (15 tests) 129ms
 ✓ src/render/world.test.ts (19 tests) 69ms
 ✓ src/App.test.tsx (4 tests) 16ms
 ✓ src/game/session.test.ts (25 tests) 115ms
 ✓ src/render/scene.test.ts (51 tests) 149ms

 Test Files  26 passed (26)
      Tests  555 passed (555)
test exit=0
```

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  26 passed (26)
      Tests  555 passed (555)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.51 |    98.87 |     100 |   99.51 |
 src               |     100 |      100 |     100 |     100 |
  App.tsx          |     100 |      100 |     100 |     100 |
  browser-env.ts   |     100 |      100 |     100 |     100 |
 src/game          |     100 |    99.65 |     100 |     100 |
  board.ts         |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |     100 |    98.18 |     100 |     100 | 175
  types.ts         |     100 |      100 |     100 |     100 |
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   99.73 |    99.22 |     100 |   99.73 |
  protocol.ts      |     100 |      100 |     100 |     100 |
  server-state.ts  |   99.18 |    96.87 |     100 |   99.18 | 119-120
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |     100 |      100 |     100 |     100 |
 src/render        |     100 |    98.08 |     100 |     100 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  scene.ts         |     100 |      100 |     100 |     100 |
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |     100 |    93.15 |     100 |     100 | ...85,193,271-274
 src/ui            |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx          |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
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
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled|not\.toThrow" src/frontend/src/render/spectate-travel.test.ts
banned-matcher grep exit=1 (no matches)
```

## Coverage

| Scope | % Stmts | % Branch | % Funcs | % Lines | Gate (≥ 80) |
| --- | --- | --- | --- | --- | --- |
| `src/render/spectate-travel.ts` | 100 | 100 | 100 | 100 | pass |
| frontend workspace (all files) | 99.51 | 98.87 | 100 | 99.51 | pass |

No exclusions, threshold changes, or test config edits. The pre-existing `GameCanvas.tsx`
and `ws/connection.ts` residuals are unchanged from T7/T8.

## Acceptance audit

- **AC-17 — spectate flight pose tables. met (math half).** `spectate-travel.test.ts`
  pins both required tables with exact literals: `(0,0,12) → (24,0,12)` at
  `p ∈ {0, 0.25, 0.5, 0.75, 1}` → `(0,0,12)`, `(3,0,51)`, `(12,0,90)`, `(21,0,51)`,
  `(24,0,12)` with targets `(x, y, 0)`; and `(24,0,12) → (0,24,12)` → `(24,0,12)`,
  `(21,3,51)`, `(12,12,90)`, `(3,21,51)`, `(0,24,12)`. Identity quaternion is asserted on
  a real `PerspectiveCamera` at every row. Clamping and coincident endpoints are pinned.
- **AC-17 — gating, view-only mode, one travel at a time. already met by T8**
  (`engine.test.ts`; see `build-log-T8.md`), **machine by T7** (`spectate.test.ts`); the
  camera/reduced-motion integration is T12 (`scene.test.ts`). This task supplies the pose
  math those tasks consume.
- **T11 task bullets:** horizontal table — met; non-axis-aligned second case with
  dyadic-exact literals at `p ∈ {0, 0.25, 0.5, 0.75, 1}` — met; `origin === destination`
  constant rest pose — met; identity quaternion at every `p` — met; reuse of the accepted
  formula without new easing — met (source-line table above); no new dependencies — met.

## Deviations from spec

1. **Endpoint `z` is accepted (optional) and ignored.** The task writes the endpoints as
   3D points (`(0,0,12)`), while T12 also holds 2D server `Position`s (`{ x, y }`). The
   input type therefore allows an optional `z` for pose-shaped call sites; the depth always
   comes from the pinned `12 + 78 · travelSwing(p)` formula (verified by the
   endpoint-`z` test). Output points always carry `z`. This is additive to the plan's
   `(origin, destination, p) → { position, lookTarget }` sketch, not a semantic change.
2. **Two extra `0.75` rows / a pure-`+y` case.** The task's horizontal table lists
   `{0, 0.25, 0.5, 1}` ("e.g."); the tests also pin `0.75` (the accepted table has that
   row) and a `+y`-only flight to cover the single-axis branch. No pinned value changed.
3. **No integration boundary in this task — documented exception.** A pure arithmetic
   module has no I/O/framework seam; T12 owns the scene integration. The camera application
   test uses the real three.js `PerspectiveCamera` to verify the identity-quaternion
   contract that T12 consumes. Same rationale as `build-log-T8.md`.
4. **No `quaternion` field in the returned pose.** The plan pins the return shape as
   `{ position, lookTarget }`; identity follows from the look target being directly below
   the position with camera up `(0,1,0)`, and is asserted through `lookAt` in the tests.
   T12 sets the camera from these two points. (See Q-T11-1 if a direct quaternion is
   preferred.)

No pinned constant, protocol message, offline pose/phase convention, or acceptance
criterion was altered.

## Open questions

- **Q-T11-1:** Should `SpectateTravelPose` also expose the identity quaternion
  (`[0, 0, 0, 1]`) so T12 can assign `camera.quaternion` directly instead of calling
  `lookAt`? Candidate A: keep the plan-shape `{ position, lookTarget }` (current; T12 calls
  `lookAt`). Candidate B: add a `quaternion` field in T12's scene work if the renderer
  prefers direct assignment. No behavior difference.
- **Q-T11-2:** For coincident endpoints the pose is the constant rest pose at every
  progress (pinned by the task). Should T12/T13 also skip starting the travel entirely
  (instant, no `travel` phase) when a selection targets the own/current position? Current
  math supports either; the phase decision belongs to the engine/session.
- **Q-T11-3:** Confirm T12 passes 2D server `Position`s (`{ x, y }`) as endpoints and
  constructs the rest depth itself; the optional `z` on `FlightEndpoint` exists so both
  that call site and the 3D pose-table literals typecheck.

## Commit

`feat: add spectate travel flight math (T11)` — staged explicitly:
`src/frontend/src/render/spectate-travel.ts`, `src/frontend/src/render/spectate-travel.test.ts`,
`docs/features/multiplayer-servers/build-log-T11.md`.
