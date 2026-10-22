# Build log — T10 — World view: remote cube views, ring layout, broadcast application

Task: T10 (2026-10-22)
Files changed: `src/frontend/src/render/world.ts`, `src/frontend/src/render/world.test.ts`,
`docs/features/multiplayer-servers/build-log-T10.md` (this log)

## Sketch (≤5 lines)

`createWorldView({ maxUsers, random? })` builds one `createCubeView` per **remote** member at
the server-reported position and reconciles the roster (add → build, remove → dispose once,
same cube signature → reposition/apply snapshot ids, new level → rebuild). `applyMessage`
applies the remote-cube subset of the catalog: `miniCubeRemoved` (exact tile pop + the accepted
burst at the tile origin), derived face clears on the 0-remaining transition (accepted
`faceFadeMs` countdown), `levelAdvanced` (dispose once + rebuild), `memberJoined`/`memberLeft`.
`update` advances pops, face countdowns and the pooled particles; `dispose` releases
everything and detaches. Picking is isolated by construction: the world exposes no pick
handle — the scene ever passes only its own `cubeView` to `pickMiniCube`.

## What changed & why

- **`render/world.ts` (new).** Owns the remote half of a server world: `group` (member cube
  groups + one pooled particle system), `particles`, `applyRoster`, `applyMessage`, `update`,
  `views()` and `dispose()`. Every position, grid size, style id and removed-id set comes
  from the server state (`MemberState`), never from client-side layout math — the scene keeps
  the local cube and the session keeps authority.
- **Remote-cube broadcasts.** `miniCubeRemoved` reads the tile's world origin from its
  instance matrix (`mesh.getMatrixAt` premultiplied by the cube group's world matrix), starts
  the accepted pop-then-shrink (`hideMiniCube`), and spawns the shared `createBurst` effect
  at `origin + BURST_ORIGIN_OFFSET · faceNormal` through the pooled particle system. Duplicate
  ids are no-ops (ack safety). When the last tile of a face is hidden, the face's
  0-remaining transition starts the accepted `faceFadeMs` (400 ms) countdown; `removeFace`
  then detaches and disposes the face exactly once, so the last tile's 160 ms pop and burst
  still play.
- **Lifecycle.** `applyRoster` reconciles by player id; a removed member's `CubeView.dispose`
  runs exactly once, an unchanged member keeps its handle (and running pops), a changed cube
  signature rebuilds (old disposed once, new at the reported position). `levelAdvanced`
  rebuilds at the (possibly new) position; `memberJoined`/`memberLeft` upsert/remove one view.
  `dispose` is idempotent, clears the map, disposes every view + the particle system and
  detaches the group, returning the scene graph to its pre-world object count.
- **Drawable bound.** One view per remote member, capacity `X − 1` (the scene owns the own
  cube) → `(X − 1) × 7` meshes. At X = 10 with a full roster (9 remote cubes, N = 7) the world
  contains exactly **63 meshes** (`9 × 7`); `applyRoster` rejects an over-capacity roster with
  a concrete `RangeError` instead of rendering unbounded.
- **Indicator of the local/remote split.** The world view never receives the own cube handle
  and exposes no picking entry point. A real `Raycaster` aimed at a remote cube's front grid
  hits it (instance 12), while `pickMiniCube(camera, ownCubeView, …)` on the same ray returns
  `null`.

## Decisions

1. **Positions are server-assigned; no local ring math.** The slot→position formula lives in
   `game/servers.ts` (backend) and every `MemberState` carries the resulting position. The
   world view places groups at exactly that position (tested with the X = 10 ring literals
   for slots 2–10), so `SLOT_SPACING` is not duplicated in `render/world.ts` — a second copy
   could drift from the authority and would be untested dead code. (`plan.md`'s pinned
   constant table mentions a mirror; see Deviations.)
2. **Face clears use the accepted fade countdown.** `removeFace` fires when the derived
   0-remaining transition's 400 ms `faceFadeMs` ends, not in the same frame, so the last
   tile's accepted pop and burst are visible (spec § 5: "the accepted pop/burst plays on
   remote cubes too"). The transition itself is derived purely from the hidden-tile count.
3. **Unknown style ids fall back to the pinned first style.** The wire codec validates that
   `styleId` is a non-empty string, not membership in the style cycle; a renderer must not
   crash on an unknown id, so `styleFor` uses `CUBE_STYLES[0]` (tested).
4. **Roster snapshots never replay effects.** Removed ids present in `applyRoster`/
   `memberJoined` are hidden instantly with no pop/burst (state, not events); only
   `miniCubeRemoved` plays the effect.
5. **Capacity enforcement on `applyRoster`.** A pull of the full roster is rejected when it
   exceeds the remote capacity, which keeps AC-13's drawable bound honest. `memberJoined`
   deltas are applied as authoritative server events (a server at capacity never sends one).

## Testing tiers

- **Unit:** `world.test.ts` drives `WorldView` directly against real three.js objects — no
  mocked collaborators — and asserts scene-graph positions, instance matrices, materials,
  particle-buffer values, drawable counts and disposal from the public API. 19 tests.
- **Integration:** the picker isolation test composes the world with the own cube view, a real
  `PerspectiveCamera`, a real `Raycaster` and the production `pickMiniCube` path, proving the
  ray hits only the remote view while the own handle resolves `null`. The burst origin is
  asserted against the real `createParticleSystem` buffer.
- No test uses a banned matcher (grep below); the only float accommodation is the accepted
  `Math.fround` pattern for three.js float32 instance/particle buffers. Concrete expected
  values only (exact ring literals, exact mesh/object counts, exact instance scales).

## Evidence — implementation

- **Views / layout:** full X = 10 roster → `views().size === 9`; every group at the exact
  server ring position (slot 2 `(30.902172888029035, 22.45174281092734)`, slot 3
  `(11.803579717001593, 36.32768297475154)`, slot 9 `(11.803579717001586,
  -36.32768297475154)`, …); each view has 6 faces × 49 instances at N = 7.
- **Drawable bound:** `countMeshes(world.group) === 63` and `≤ 9 × 7` / `≤ 10 × 7`.
- **Disposal:** one removed member → `BufferGeometry.dispose` on its body called exactly once
  across repeated reconciles; scene object count goes `baseline (9) → world added → dispose →
  9`, group detached and emptied; `dispose()` again is a no-op.
- **Pop/burst:** `miniCubeRemoved` at `front:1:2` on a member at slot 2 (N = 5) hides exactly
  that tile, leaves its neighbour visible, spawns 24 fragments at the f32 origin
  `(30.902172088623047, 23.45174217224121, 3.125)`, settles the popped instance to
  `[0, 0, 0]` after 160 ms while the neighbour stays `[0.949999988079071,
  0.949999988079071, 0.25]`, and releases the pool after 350 ms. Repeated/foreign ids do not
  re-spawn.
- **Derived face clear:** 9th `front` removal leaves the face present for 399 ms, then
  `removeFace` at 400 ms; face geometry disposed once; `faces.size` drops 6 → 5.
- **`levelAdvanced`:** old body geometry disposed once; new view at the reported position,
  N = 7, violet style, same view count.
- **Picker isolation:** ray at the remote cube's front grid hits instance 12; the same ray
  through the own-handle `pickMiniCube` is `null`; over the own cube the own handle returns
  `front:2:2`.

## Evidence (raw command output)

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/theme.test.ts (2 tests) 3ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 7ms
 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/game/progression.test.ts (10 tests) 8ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 17ms
 ✓ src/game/effects.test.ts (28 tests) 13ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/game/board.test.ts (18 tests) 19ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/input/gestures.test.ts (21 tests) 6ms
 ✓ src/render/particles.test.ts (19 tests) 20ms
 ✓ src/input/keyboard.test.ts (13 tests) 11ms
 ✓ src/game/engine.test.ts (45 tests) 36ms
 ✓ src/ui/Hud.test.tsx (3 tests) 9ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/render/cube-view.test.ts (32 tests) 39ms
 ✓ src/render/picking.test.ts (12 tests) 25ms
 ✓ src/render/starfield.test.ts (15 tests) 77ms
 ✓ src/render/world.test.ts (19 tests) 51ms
 ✓ src/App.test.tsx (4 tests) 14ms
 ✓ src/game/session.test.ts (25 tests) 68ms
 ✓ src/render/scene.test.ts (51 tests) 110ms

 Test Files  25 passed (25)
      Tests  535 passed (535)
   Start at  08:54:49
   Duration  626ms (transform 2.05s, setup 0ms, collect 5.36s, tests 618ms, environment 4ms, prepare 2.18s)
test exit=0
```

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  25 passed (25)
      Tests  535 passed (535)

 % Coverage report from v8
------------------|---------|----------|---------|---------|--------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s  
------------------|---------|----------|---------|---------|--------------------
All files         |   97.43 |    97.77 |   97.83 |   97.43 |                    
 src              |     100 |      100 |     100 |     100 |                    
  App.tsx         |     100 |      100 |     100 |     100 |                    
  browser-env.ts  |     100 |      100 |     100 |     100 |                    
 src/game         |   93.37 |    96.25 |   94.11 |   93.37 |                    
  board.ts        |     100 |      100 |     100 |     100 |                    
  effects.ts      |     100 |      100 |     100 |     100 |                    
  engine.ts       |   86.23 |    93.43 |   88.09 |   86.23 | ...801-819,822-827 
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
 src/render       |     100 |    98.05 |     100 |     100 |                    
  cube-view.ts    |     100 |      100 |     100 |     100 |                    
  particles.ts    |     100 |      100 |     100 |     100 |                    
  picking.ts      |     100 |      100 |     100 |     100 |                    
  scene.ts        |     100 |      100 |     100 |     100 |                    
  starfield.ts    |     100 |      100 |     100 |     100 |                    
  webgl.ts        |     100 |      100 |     100 |     100 |                    
  world.ts        |     100 |    93.15 |     100 |     100 | ...185,193,271-274 
 src/ui           |   79.48 |      100 |     100 |   79.48 |                    
  GameCanvas.tsx  |    61.9 |      100 |     100 |    61.9 | 23-30              
  Hud.tsx          |     100 |      100 |     100 |     100 |                    
  theme.ts         |     100 |      100 |     100 |     100 |                    
 src/ws           |   95.34 |    92.85 |     100 |   95.34 |                    
  connection.ts   |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100       
------------------|---------|----------|---------|---------|--------------------
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
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled\(\)|not\.toThrow" src/frontend/src/render/world.test.ts
banned-matcher grep exit=1 (no matches)
```

### Concurrent-task note (T8)

At 08:50, while T8 was mid-edit (`src/frontend/src/game/engine.ts` uncommitted), the
workspace-wide `typecheck`/`lint` failed **only** on T8's in-flight engine changes
(`EngineSnapshot` missing `travelKind`/`travelDestination`/`spectating`, `GameEngine` missing
`completeNextLevel`/`setSpectating`, unused `online`/`travelKind`/… locals). T10's own files
were clean (`npx eslint src/frontend/src/render/world.ts src/frontend/src/render/world.test.ts`
→ exit 0). After T8's file reached a consistent state the full commands above passed; no
assertion or threshold was weakened for the transient failure. The coverage table's
`engine.ts` 86.23% reflects T8's uncommitted work at the time of the run, not T10 code.

## Coverage

| Scope | % Stmts | % Branch | % Funcs | % Lines | Gate (≥ 80) |
| --- | --- | --- | --- | --- | --- |
| `src/render/world.ts` | 100 | 93.15 | 100 | 100 | pass |
| frontend workspace (all files) | 97.43 | 97.77 | 97.83 | 97.43 | pass |

No exclusions added, no thresholds changed. The remaining `world.ts` branches are defensive
unreachable paths: a duplicate id in a roster snapshot (covered now), the `?? 0` fallbacks for
the six-entry per-face count map, and a small-enumerable removal on a face that was already
detached (a valid broadcast can never target a face whose every tile is already hidden). The
pre-existing `GameCanvas.tsx`/`ws/connection.ts` residuals are unchanged.

## Acceptance audit

- **AC-13 (world scope) — world layout & remote cubes. met.** One cube view per remote member
  at the exact server ring position (`applyRoster > builds one cube view per member at the
  exact server-assigned ring position`; full-roster slots 2–10), one view per member with the
  right grid/style (`face.count` 9/25/49, material colours `0b0b12` / `1de9b6` / `140a1f`).
  Remote views are non-pickable: `picker isolation > resolves null for a ray that hits only a
  remote cube view` (real `Raycaster`: remote hit instance 12; own handle → `null`). Broadcast
  application: `miniCubeRemoved` exact tile + pop/burst at the tile origin; derived
  `removeFace` on the 0-remaining transition after the accepted fade; `levelAdvanced` disposes
  the old view once and rebuilds at the new position; `memberJoined`/`memberLeft` add/remove.
  Drawable bound: 63 meshes for the 9 remote views of a full X = 10 roster (`≤ 9 × 7`, `≤
  10 × 7`); roster removal disposes exactly once; object count returns to baseline (9) after
  `dispose`. The server-side formula half of AC-13 is T1 (`servers.test.ts`).
- **AC-19(e) — live remote play visible. met.** `applyMessage > hides the exact tile, starts
  its pop and spawns the burst at the tile origin` asserts the exact hidden instance, its
  settled matrix, the neighbour untouched and the 24-fragment burst at the tile origin. The
  same-server rebuild (AC-19(c)) is `applyMessage > rebuilds a member on levelAdvanced exactly
  once…`; auto-return (a/b/d) is T7/T13.
- **AC-16 (drawable cap, world half). met.** Full X = 10 roster → 9 remote views / 63 meshes,
  one pooled `Points` particle drawable; disposal returns the scene to baseline.
- **Task constraints — met.** TypeScript strict, no new dependencies, no out-of-scope files;
  unit + integration tests; concrete values only (banned-matcher grep exit 1); coverage gate
  green with no exclusions/threshold changes.

## Deviations from spec

1. **`SLOT_SPACING` is not mirrored in `render/world.ts`.** The plan's constant table mentions
   a mirror, but the plan's own world interface and the T10 brief require positions from the
   server state; a local ring formula would be client-invented shared state (and dead code).
   The world places groups at the wire positions; the ring literals are pinned in the test.
2. **Derived face clear waits the accepted `faceFadeMs` (400 ms).** The 0-remaining transition
   schedules `removeFace` instead of detaching in the same frame, so the last tile's accepted
   pop/burst remains visible (spec § 5); the removal itself is still derived solely from the
   hidden-tile count, and the test pins 399 ms present / 400 ms removed.
3. **Additive API beyond the plan sketch:** `group`, `particles`, `update(dtMs)` and the
   `random` option (deterministic bursts/particles) are exposed for the scene integration
   (T12) and tests; the pinned `applyRoster`/`applyMessage`/`views`/`dispose` contract is
   unchanged in shape. `applyRoster` takes the remote roster (own cube excluded by design) and
   enforces the `X − 1` capacity.

No pinned constant, protocol message or acceptance criterion was altered.

## Open questions

- Q-T10-1: T12 decides when to create the first `WorldView` (after `welcome`, when
  `maxUsers` is authoritative). The constructor accepts `maxUsers: 0` for the pre-`welcome`
  case (empty roster only), so either construction order works; an over-capacity roster
  throws by design.
- Q-T10-2: if a future reduced-motion profile is meant to apply to **remote** pops, the world
  needs a `setReducedMotion` seam (the scene knows the preference; the wire does not). Not
  required by T10 and deliberately not added speculatively.
