# Build log — T11 — Scene integration of the cosmic backdrop

Task: T11 (2026-11-07)
Files changed: `src/frontend/src/render/scene.ts`, `src/frontend/src/render/scene.test.ts`, `docs/features/reference-image-game-view/build-log-T11.md`

## What changed & why

- `createSceneView` creates exactly one `createCosmicBackdrop(random)` after `createStarfield(random)`, `createParticleSystem(random)` and `createBackgroundLife(random)`, so every pre-existing seeded draw sequence (starfield, particle pool, background life) is unchanged.
- `SceneView.cosmicBackdrop` exposes the backdrop; `scene.background = cosmic.nebulaTexture` replaces the old black `Color` (the `Color` import and `BACKGROUND_COLOR` constant are removed); `cosmic.group` is appended last as the ninth scene child (after `background-life`), keeping the light indices 0/1 stable.
- `SceneView.update` forwards `cosmicBackdrop.update(dtMs, reducedMotion)`; `dispose()` sets `scene.background = null` before `cosmicBackdrop.dispose()` (then the existing disposals and `scene.clear()`), and remains idempotent.
- `scene.test.ts` updates every child/object count (8→9, 9→10 with one remote world, `baselineObjects` 32→60), the two style-0 body literals (`0b0b12`→`0a2418`), replaces the black-background assertions with the nebula-texture identity, and adds exactly-one-group/no-rebuild/update-forwarding/dispose-order coverage.
- No camera, travel, picking or gameplay behavior changed; no camera-anchored plane was added.

## Decisions

- The backdrop is constructed after the particle pool and background life (not only after the starfield), so no existing random consumer's sequence shifts; only the nebula generator consumes the new draws.
- `scene.background` references the backdrop-owned texture (no copy): `SceneView.dispose()` clears the scene reference before releasing the backdrop, so a disposed texture can never stay attached to the scene.
- Manual browser visibility through the post-processing composer: no browser binary is available in this build environment and the feature's visual matrix is T15's manual step. The composer binds `RenderPass(scene, camera)` and `SSAOPass(scene, camera)` to the same scene (`render/postprocessing.ts:56,58`), so `scene.background` follows the standard three.js background path; there is no evidence of invisibility and no fallback plane was added.

## Evidence

### `npm run lint`

```text

> lint
> eslint .

LINT_EXIT=0
```

### `npm run typecheck`

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### `npm test --workspace @cubeclicker/frontend`

```text

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/app.css.test.ts (83 tests) 29ms
 ✓ src/auth/api.test.ts (28 tests) 22ms
 ✓ src/render/webgl.test.ts (17 tests) 11ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 31ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/game/board.test.ts (18 tests) 24ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 18ms
 ✓ src/ui/icons.test.tsx (16 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 14ms
 ✓ src/render/spaceship.test.ts (34 tests) 33ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 12ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 24ms
 ✓ src/render/picking.test.ts (12 tests) 68ms
 ✓ src/input/gestures.test.ts (27 tests) 31ms
 ✓ src/render/starfield.test.ts (23 tests) 105ms
 ✓ src/game/engine.test.ts (101 tests) 65ms
 ✓ src/render/cube-view.test.ts (33 tests) 136ms
 ✓ src/render/cosmic-backdrop.test.ts (13 tests) 152ms
 ✓ src/render/background-life.test.ts (14 tests) 15ms
 ✓ src/game/effects.test.ts (28 tests) 12ms
 ✓ src/render/particles.test.ts (20 tests) 18ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 10ms
 ✓ src/ui/game-view.css.test.ts (25 tests) 15ms
 ✓ src/render/world.test.ts (27 tests) 183ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/input/keyboard.test.ts (13 tests) 10ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 8ms
 ✓ src/browser-env.test.ts (6 tests) 14ms
 ✓ src/auth/store.test.ts (31 tests) 22ms
 ✓ src/game/economy.test.ts (7 tests) 6ms
 ✓ src/ws/connection.test.ts (10 tests) 20ms
 ✓ src/game/parts.test.ts (23 tests) 12ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/game/progression.test.ts (21 tests) 13ms
 ✓ src/game/upgrades.test.ts (20 tests) 11ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 253ms
 ✓ src/render/nebula.test.ts (11 tests) 496ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  410ms
 ✓ src/ui/theme.test.ts (11 tests) 9ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 273ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 157ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 233ms
 ✓ src/render/postprocessing.test.ts (10 tests) 10ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/docs/links.test.ts (1 test) 3ms
 ✓ src/ui/Hud.test.tsx (16 tests) 272ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 280ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 426ms
 ✓ src/render/scene.test.ts (81 tests) 877ms
 ✓ src/game/session.test.ts (71 tests) 816ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 863ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  337ms
 ✓ src/App.test.tsx (26 tests) 476ms

 Test Files  53 passed (53)
      Tests  1310 passed (1310)
   Start at  21:53:13
   Duration  1.95s (transform 5.81s, setup 0ms, collect 14.70s, tests 6.66s, environment 3.37s, prepare 4.12s)

TEST_EXIT=0
```

### `npm run coverage --workspace @cubeclicker/frontend`

```text

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ws/connection.test.ts (10 tests) 15ms
 ✓ src/ui/game-view.css.test.ts (25 tests) 15ms
 ✓ src/auth/api.test.ts (28 tests) 12ms
 ✓ src/ui/app.css.test.ts (83 tests) 19ms
 ✓ src/game/progression.test.ts (21 tests) 7ms
 ✓ src/game/parts.test.ts (23 tests) 7ms
 ✓ src/browser-env.test.ts (6 tests) 9ms
 ✓ src/game/board.test.ts (18 tests) 29ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 13ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 20ms
 ✓ src/auth/store.test.ts (31 tests) 16ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 17ms
 ✓ src/ui/icons.test.tsx (16 tests) 28ms
 ✓ src/render/particles.test.ts (20 tests) 23ms
 ✓ src/render/spaceship.test.ts (34 tests) 53ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 14ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 25ms
 ✓ src/render/starfield.test.ts (23 tests) 113ms
 ✓ src/input/gestures.test.ts (27 tests) 65ms
 ✓ src/game/engine.test.ts (101 tests) 110ms
 ✓ src/render/picking.test.ts (12 tests) 154ms
 ✓ src/render/cube-view.test.ts (33 tests) 279ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/render/webgl.test.ts (17 tests) 14ms
 ✓ src/render/cosmic-backdrop.test.ts (13 tests) 364ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 10ms
 ✓ src/game/rotation.test.ts (15 tests) 12ms
 ✓ src/render/postprocessing.test.ts (10 tests) 14ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 12ms
 ✓ src/input/keyboard.test.ts (13 tests) 15ms
 ✓ src/ui/theme.test.ts (11 tests) 7ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 6ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 20ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 17ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/render/world.test.ts (27 tests) 377ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 245ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 472ms
 ✓ src/render/nebula.test.ts (11 tests) 901ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  719ms
 ✓ src/ui/Hud.test.tsx (16 tests) 172ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 178ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 188ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 318ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 535ms
 ✓ src/App.test.tsx (26 tests) 619ms
 ✓ src/render/scene.test.ts (81 tests) 1979ms
 ✓ src/game/session.test.ts (71 tests) 1884ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 883ms

 Test Files  53 passed (53)
      Tests  1310 passed (1310)
   Start at  21:53:18
   Duration  3.19s (transform 4.70s, setup 0ms, collect 14.14s, tests 10.36s, environment 4.01s, prepare 5.39s)

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
  scene.ts         |   97.43 |    96.17 |   94.73 |   97.43 | ...14-915,939-940 
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
COVERAGE_EXIT=0
```

## Acceptance audit

- AC-10 → met: `scene.test.ts` asserts exactly one `cosmic-backdrop` group as the ninth child after `background-life`, `scene.background === view.cosmicBackdrop.nebulaTexture`, that the group/backdrop survive a `levelChanged` rebuild, and that `dispose()` clears the background before disposing the backdrop exactly once (captured by a wrapped spy) and leaves the scene empty.
- AC-12 → met: `scene.test.ts` forwards `dtMs` (exact asteroid rotation, meteor x, comet y and hero-ship y after `update(100)`) and `reducedMotion` (the same transforms frozen on a later frame); the existing idempotent resource-disposal test now also asserts the nebula texture is disposed once, `scene.background === null` and `scene.children === []`.
- AC-13 → met: the two style-0 body literals in `scene.test.ts` are `0a2418`; no style/progression behavior was touched.
- AC-16 → met: the starfield `Points` (1200 stars) and `background-life` group assertions are unchanged and passing; the seeded starfield cell tests pass untouched (exact totals `302` / `5` and their cell arrays), proving the backdrop did not shift the seeded draws.

## Deviations from spec

None. Manual wide/mobile visual confirmation is T15's manual matrix; the scene-wiring evidence is `scene.test.ts` per AC-10.
