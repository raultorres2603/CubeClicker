# Build log — T16 — Camera-anchored cosmic composition

Task: T16 (2026-11-07)
Files changed: `src/frontend/src/render/scene.ts`, `src/frontend/src/render/scene.test.ts`
What changed & why:
- `SceneView.update` now sets `cosmicBackdrop.group.position.set(camera.position.x, camera.position.y, 0)` immediately before `cosmicBackdrop.update(dtMs, reducedMotion)`; construction sets the same anchor after the camera is built, so the first rendered frame is already anchored (plan B-1 / T16).
- The group keeps `z = 0`, and `createCosmicBackdrop`, its constants/child transforms/colours/counts, the `CosmicBackdrop` interface, camera rest/travel constants, picking, scene child order/counts and disposal are unchanged. `scene.background` remains the single nebula `DataTexture`; the anchor consumes no `random` and adds no import/dependency.
- `scene.test.ts` adds the construction anchor, slot 1 (+7.64), slot 2 (−7.64), 10-user ring (38.2) and travel (x = 12) anchor assertions plus the world-x/z composition checks. All pre-existing seeded-starfield, background-life, child-count/order, update-forwarding and disposal assertions are untouched and green.

Decisions:
- Implemented the T16 anchor exactly as specified (camera `x`/`y` copied, `z` fixed at 0) and pinned it with concrete values; no constant or scope improvisation.
- The manual composition matrix (below) surfaced a contradiction between the prescribed anchor and the T16 manual expectation: the camera-anchored comet offset (local `x = 7.5` at `z = −18`) stays inside the cube silhouette at every wide size, so the comet remains occluded by the cube, and the 1280×720 hero ship stays behind the upgrades panel. All automated T16 assertions pass, but the manual "orange comet upper-right, not behind the cube" check fails. Reported blocked with actual values instead of changing constants/scope.

## Evidence — verify commands

### `npm run lint` → exit 0

```text

> lint
> eslint .

```

### `npm run typecheck` → exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

### `npm test --workspace @cubeclicker/frontend` → exit 0

```text

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/game-view.css.test.ts (25 tests) 16ms
 ✓ src/ui/app.css.test.ts (83 tests) 26ms
 ✓ src/game/upgrades.test.ts (20 tests) 7ms
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/ui/theme.test.ts (11 tests) 5ms
 ✓ src/render/postprocessing.test.ts (10 tests) 7ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 23ms
 ✓ src/auth/store.test.ts (31 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/render/background-life.test.ts (14 tests) 18ms
 ✓ src/render/particles.test.ts (20 tests) 22ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 11ms
 ✓ src/game/board.test.ts (18 tests) 34ms
 ✓ src/ui/icons.test.tsx (16 tests) 23ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 18ms
 ✓ src/render/spaceship.test.ts (34 tests) 70ms
 ✓ src/render/starfield.test.ts (23 tests) 109ms
 ✓ src/render/cosmic-backdrop.test.ts (13 tests) 127ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 26ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 10ms
 ✓ src/render/picking.test.ts (12 tests) 93ms
 ✓ src/input/gestures.test.ts (27 tests) 40ms
 ✓ src/game/engine.test.ts (101 tests) 77ms
 ✓ src/render/cube-view.test.ts (33 tests) 184ms
 ✓ src/game/parts.test.ts (23 tests) 21ms
 ✓ src/game/progression.test.ts (21 tests) 11ms
 ✓ src/input/keyboard.test.ts (13 tests) 17ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 11ms
 ✓ src/render/world.test.ts (27 tests) 195ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/render/webgl.test.ts (17 tests) 16ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 8ms
 ✓ src/game/economy.test.ts (7 tests) 4ms
 ✓ src/auth/api.test.ts (28 tests) 23ms
 ✓ src/docs/links.test.ts (1 test) 3ms
 ✓ src/browser-env.test.ts (6 tests) 20ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 14ms
 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 277ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 137ms
 ✓ src/render/nebula.test.ts (11 tests) 570ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  470ms
 ✓ src/render/scene.test.ts (84 tests) 894ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 247ms
 ✓ src/game/session.test.ts (71 tests) 857ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 189ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 175ms
 ✓ src/ui/Hud.test.tsx (16 tests) 206ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 371ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 803ms
 ✓ src/App.test.tsx (26 tests) 534ms

 Test Files  53 passed (53)
      Tests  1313 passed (1313)
   Start at  22:19:37
   Duration  2.78s (transform 5.83s, setup 0ms, collect 15.94s, tests 6.64s, environment 4.06s, prepare 4.88s)

```

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0

```text

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (83 tests) 18ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/ui/game-view.css.test.ts (25 tests) 14ms
 ✓ src/auth/api.test.ts (28 tests) 13ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 7ms
 ✓ src/render/webgl.test.ts (17 tests) 15ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 22ms
 ✓ src/render/background-life.test.ts (14 tests) 15ms
 ✓ src/game/parts.test.ts (23 tests) 12ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 15ms
 ✓ src/game/board.test.ts (18 tests) 22ms
 ✓ src/auth/store.test.ts (31 tests) 21ms
 ✓ src/ui/icons.test.tsx (16 tests) 28ms
 ✓ src/render/particles.test.ts (20 tests) 28ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 18ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 20ms
 ✓ src/render/spaceship.test.ts (34 tests) 32ms
 ✓ src/render/starfield.test.ts (23 tests) 84ms
 ✓ src/input/keyboard.test.ts (13 tests) 17ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 26ms
 ✓ src/input/gestures.test.ts (27 tests) 60ms
 ✓ src/game/engine.test.ts (101 tests) 115ms
 ✓ src/render/picking.test.ts (12 tests) 147ms
 ✓ src/game/progression.test.ts (21 tests) 10ms
 ✓ src/render/cube-view.test.ts (33 tests) 307ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 16ms
 ✓ src/game/effects.test.ts (28 tests) 12ms
 ✓ src/render/cosmic-backdrop.test.ts (13 tests) 386ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/ws/connection.test.ts (10 tests) 14ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 8ms
 ✓ src/game/upgrades.test.ts (20 tests) 11ms
 ✓ src/game/economy.test.ts (7 tests) 6ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 7ms
 ✓ src/docs/links.test.ts (1 test) 14ms
 ✓ src/ui/theme.test.ts (11 tests) 14ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 18ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 12ms
 ✓ src/render/postprocessing.test.ts (10 tests) 21ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 21ms
 ✓ src/render/world.test.ts (27 tests) 395ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 262ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 524ms
 ✓ src/render/nebula.test.ts (11 tests) 890ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  722ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 233ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 328ms
 ✓ src/ui/Hud.test.tsx (16 tests) 237ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 281ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 579ms
 ✓ src/App.test.tsx (26 tests) 626ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 1039ms
 ✓ src/render/scene.test.ts (84 tests) 2288ms
 ✓ src/game/session.test.ts (71 tests) 2199ms

 Test Files  53 passed (53)
      Tests  1313 passed (1313)
   Start at  22:19:42
   Duration  3.75s (transform 4.84s, setup 0ms, collect 15.63s, tests 11.53s, environment 4.55s, prepare 7.31s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.6 |    95.31 |   96.55 |    95.6 |                   
 src               |   84.16 |     79.5 |    92.1 |   84.16 |                   
  App.tsx          |   83.33 |    77.39 |    92.3 |   83.33 | ...03,417-419,505 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   95.44 |    99.68 |   98.75 |   95.44 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |    99.7 |      100 |     100 |    99.7 | 882-883           
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   89.85 |    99.61 |   96.55 |   89.85 | ...1140,1153-1154 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.47 |    96.05 |   95.71 |   92.47 |                   
  protocol.ts      |   87.09 |     94.9 |   89.28 |   87.09 | ...94-905,909-919 
  server-state.ts  |   98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   97.95 |      100 |     100 |   97.95 | 176-178,196       
 src/render        |   98.88 |    96.58 |   98.55 |   98.88 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |   99.28 |    96.29 |     100 |   99.28 | 380-381           
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  scene.ts         |   97.44 |    96.17 |   94.73 |   97.44 | ...24-925,949-950 
  spaceship.ts     |   98.25 |    94.54 |     100 |   98.25 | ...44,360,380,391 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   96.45 |    97.26 |   88.67 |   96.45 |                   
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   81.17 |    68.75 |      50 |   81.17 | 45-50,52-57,96-99 
  ...ipPreview.tsx |   93.75 |      100 |     100 |   93.75 | 18-19             
  ...adesPanel.tsx |     100 |      100 |     100 |     100 |                   
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

Coverage gate: `All files 95.6% statements / 95.31% branches / 96.55% functions / 95.6% lines` (thresholds ≥ 80 all four). 53 test files, 1313 tests passed.

## Manual composition check (T16 notes)

Environment: the running `podman compose` stack (`backend` restarted with `MAX_USERS_PER_SERVER=2` for the observed 2-user ring, then restored to `2`; briefly `10` for the ring-slot capture), headless Google Chrome over CDP, fresh page load per slot. Screenshots are in `docs/features/reference-image-game-view/evidence/`.

| Size | Slot | Self position | Screenshot | Comet (orange) | Hero ship (blue/orange) |
| --- | --- | --- | --- | --- | --- |
| 1280×720 | slot 1 | `(7.639437268410976, 0)` | `t16-slot1-1280x720.png` | **FAIL** — occluded behind the cube (projected head ≈`(833, 303)`; cube silhouette right edge ≈`x 870`; no comet-orange pixels outside the cube) | **FAIL** — center ≈`(907, 434)` under the upgrades panel (`x ≥ 875`, `y ≥ 360`); only the left engine flame at `(862–867, 426–429)` is visible |
| 1920×1080 | slot 1 | `(7.639437268410976, 0)` | `t16-slot1-1920x1080.png` | **FAIL** — occluded behind the cube (projected head ≈`(1249, 455)`; cube right edge ≈`x 1306`) | PASS — visible lower-right (`x ≈ 1292–1440`, `y ≈ 630–665`), left of the upgrades panel |
| 2560×1280 | slot 1 | `(7.639437268410976, 0)` | `t16-slot1-2560x1280.png` | **FAIL** — occluded behind the cube (projected head ≈`(1623, 540)`; cube right edge ≈`x 1688`) | PASS — visible lower-right (engine flame component at `(1674–1704, 772–795)`) |
| 2560×1080 | slot 1 | `(7.639437268410976, 0)` | `t16-slot1-2560x1080.png` | **FAIL** — occluded behind the cube (projected head ≈`(1569, 455)`; cube right edge ≈`x 1624`) | PASS — visible lower-right (engine flame component at `(1624–1638, 651–671)`) |
| 1280×720 | slot 2 | `(−7.639437268410976, 9.4e−16)` | `t16-slot2-1280x720.png` | **FAIL** — occluded behind the cube (the camera-anchored group makes slot 2 identical to slot 1; the pre-T16 slot-2 view had the comet visible at ≈`(1029, 296)`) | **FAIL** — same upgrades-panel occlusion as slot 1 (only the engine sliver visible) |
| 1920×1080 | slot 2 | `(−7.639437268410976, 9.4e−16)` | `t16-slot2-1920x1080.png` | **FAIL** — occluded behind the cube | PASS — visible lower-right |
| 2560×1280 | slot 2 | `(−7.639437268410976, 9.4e−16)` | `t16-slot2-2560x1280.png` | **FAIL** — occluded behind the cube | PASS — visible lower-right |
| 2560×1080 | slot 2 | `(−7.639437268410976, 9.4e−16)` | `t16-slot2-2560x1080.png` | **FAIL** — occluded behind the cube | PASS — visible lower-right |
| 1280×720 | 10-user ring slot 1 | `(38.197186342054884, 0)` | `t16-ring10-1280x720.png` | **FAIL** — occluded behind the cube | **FAIL** — upgrades-panel occlusion |
| 1920×1080 | 10-user ring slot 1 | `(38.197186342054884, 0)` | `t16-ring10-1920x1080.png` | **FAIL** — occluded behind the cube | PASS — visible lower-right (engine flame component at `(1304–1318, 642–662)`) |
| 2560×1280 | 10-user ring slot 1 | `(38.197186342054884, 0)` | `t16-ring10-2560x1280.png` | **FAIL** — occluded behind the cube | PASS — visible lower-right (engine flame component at `(1688–1704, 770–794)`) |
| 2560×1080 | 10-user ring slot 1 | `(38.197186342054884, 0)` | `t16-ring10-2560x1080.png` | **FAIL** — occluded behind the cube | PASS — visible lower-right (engine flame component at `(1624–1638, 652–672)`) |

Projection basis: camera rest `(selfX, 0, 12)`, vertical FOV 50°, comet local `(7.5, 2.2, −18)` → relative offset `7.5` at depth `30`, i.e. ≈`14.0°`; cube front-right silhouette extends to ≈`14.7°–16.6°` at depth `9.25–9.5`. The camera-anchored comet therefore stays inside the cube silhouette at every listed aspect. The automated assertions (world `x` of comet/hero greater than the cube, world `z` `−18`/`−14` `< −4`, local positions pinned) pass; this is a visual-occlusion failure, not a world-position failure.

## Acceptance audit

- **AC-10 → met**: `scene.background` remains `view.cosmicBackdrop.nebulaTexture`; one `cosmic-backdrop` group; no plane/child added; disposal clears the background before releasing the texture (existing tests + full suite green).
- **AC-11 → met for the pinned backdrop contract**: 28 objects, pinned comet/hero local positions/colours/counts, no shadow casting (unchanged `cosmic-backdrop.test.ts` and `scene.test.ts`). The manual composition expectation is **unmet**: the comet remains occluded by the cube under the prescribed camera anchor.
- **AC-17 → met for the panel/cube contract**: no panel/camera change; the central cube stays fully visible/clickable in the manual captures. The T16 manual cosmic-composition check is **unmet for the comet** (see table); the hero ship is visible at 1920/2560 sizes.

## Blockers / open question

**Blocked — T16 manual composition expectation contradicts the prescribed anchor.** The camera-anchored group (`group.x = camera.x`, `z = 0`) keeps the comet at a fixed `7.5`-unit relative offset at depth `30`, which projects inside the cube's silhouette at 1280×720, 1920×1080, 2560×1280 and 2560×1080 (and the 10-user ring). The T16 manual note requires "the orange comet is upper-right ... neither behind the cube nor off-screen", which fails at every captured size; slot 2's pre-T16 comet visibility is also lost (the anchor makes both slots identical).

Candidate answers:
1. Amend T16/plan with a pinned camera-anchor **screen-right offset** (e.g. `BACKDROP_ANCHOR_OFFSET_X`) large enough for the comet to clear the cube silhouette at all wide sizes; pin the new constant in `scene.test.ts`.
2. Amend AC-11/T10 to move `COMET_POSITION.x` (and possibly `HERO_SHIP_POSITION.x`) further right while keeping the camera anchor; this changes the pinned backdrop constants.
3. Accept the camera-anchored composition as-is (comet present at its pinned world position but occluded by the cube; hero visible at 1920/2560) and revise the T16/T15 manual wording to judge the cosmic composition by the hero ship only.

No constants were changed and no test was weakened. The implementation and all automated gates are green; the decision above is required before T15 can claim the cosmic composition pass.

## Deviations from spec

None in code: the anchor is exactly the T16 two-call change, the header comment is updated, and no out-of-scope file was edited. The manual visual expectation could not be met by the prescribed change (details above), so the task is reported blocked rather than completed.
