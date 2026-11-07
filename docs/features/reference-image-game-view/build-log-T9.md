# Build log — T9 — Procedural nebula texture

Task: T9 (2026-11-07)
Files changed: `src/frontend/src/render/nebula.ts`, `src/frontend/src/render/nebula.test.ts`, `docs/features/reference-image-game-view/build-log-T9.md`

## What changed & why

- Added the pure `createNebulaTexture(random): DataTexture` module (256 × 128 RGBA, 8-bit, linear filtering, sRGB) with the pinned palette/hue/threshold constants from AC-9.
- Four seeded value-noise octaves (4×2, 8×4, 16×8, 32×16 lattice cells) build the cloud density and warp the purple → blue → pink band selector; brightness, dark voids, white filament highlights and a fine green chroma grain complete the palette mapping.
- Every pixel is opaque (`alpha = 255`); the injected random source is the only entropy (no `Math.random`, DOM, canvas, or timers), and `needsUpdate = true` is set before returning.
- `nebula.test.ts` pins dimensions/format/filters/colour space, four-octave draw count, determinism (same sequence identical, different sequence differing), per-channel variance, all-alpha-255, and the AC-9 saturated pixel counts per pinned hue range with an independent HSL conversion.

## Decisions

- The band selector is a triangle-weighted blend of the three exported stops, so family interiors keep their pinned hue while boundaries stay painterly; density gates brightness and dark voids.
- White filament highlights plus the finest octave's green chroma keep every RGB channel's variance comfortably above `NEBULA_MIN_CHANNEL_VARIANCE` across seeds (observed green variance 210–845 on seeds 1/2/7/11/13/17/42), without moving family hues out of their ranges.
- Integration-tier exception: this is a pure procedural data module with no I/O/UI/network boundary (its boundary is `DataTexture` construction, exercised against the real `three` class in the test); scene integration is owned by T10/T11, which will exercise it through `scene.background`.

## Evidence

Raw output of the T9 verify commands:

```text
$ npm run lint

> lint
> eslint .


$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit


$ npm test --workspace @cubeclicker/frontend

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/auth/api.test.ts (28 tests) 15ms
 ✓ src/render/webgl.test.ts (17 tests) 12ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/browser-env.test.ts (6 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 26ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 10ms
 ✓ src/auth/store.test.ts (31 tests) 19ms
 ✓ src/game/board.test.ts (18 tests) 32ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/render/particles.test.ts (19 tests) 20ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 13ms
 ✓ src/ui/icons.test.tsx (16 tests) 18ms
 ✓ src/ui/UpgradesPanel.test.tsx (9 tests) 16ms
 ✓ src/render/cube-view.test.ts (33 tests) 44ms
 ✓ src/render/spaceship.test.ts (34 tests) 38ms
 ✓ src/render/starfield.test.ts (23 tests) 83ms
 ✓ src/input/gestures.test.ts (27 tests) 15ms
 ✓ src/render/picking.test.ts (12 tests) 34ms
 ✓ src/game/engine.test.ts (101 tests) 75ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 21ms
 ✓ src/render/world.test.ts (27 tests) 60ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 66ms
 ✓ src/ui/app.css.test.ts (83 tests) 21ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/ws/connection.test.ts (10 tests) 14ms
 ✓ src/game/progression.test.ts (21 tests) 12ms
 ✓ src/render/postprocessing.test.ts (10 tests) 13ms
 ✓ src/input/keyboard.test.ts (13 tests) 9ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 5ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/render/background-life.test.ts (14 tests) 13ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 8ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 11ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 11ms
 ✓ src/docs/links.test.ts (1 test) 3ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 32ms
 ✓ src/game/parts.test.ts (23 tests) 12ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 15ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/ui/theme.test.ts (11 tests) 9ms
 ✓ src/render/scene.test.ts (77 tests) 209ms
 ✓ src/render/nebula.test.ts (11 tests) 459ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  374ms
 ✓ src/ui/Hud.test.tsx (15 tests) 192ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 274ms
 ✓ src/game/session.test.ts (71 tests) 266ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 430ms
 ✓ src/App.test.tsx (23 tests) 396ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 806ms

 Test Files  50 passed (50)
      Tests  1256 passed (1256)
   Start at  21:36:57
   Duration  1.84s (transform 5.18s, setup 0ms, collect 14.99s, tests 3.92s, environment 2.29s, prepare 3.86s)


$ npm run coverage --workspace @cubeclicker/frontend

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (83 tests) 23ms
 ✓ src/auth/api.test.ts (28 tests) 19ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 22ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 16ms
 ✓ src/game/board.test.ts (18 tests) 28ms
 ✓ src/ws/connection.test.ts (10 tests) 13ms
 ✓ src/auth/store.test.ts (31 tests) 12ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/ui/icons.test.tsx (16 tests) 19ms
 ✓ src/render/particles.test.ts (19 tests) 22ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 17ms
 ✓ src/render/background-life.test.ts (14 tests) 20ms
 ✓ src/ui/UpgradesPanel.test.tsx (9 tests) 26ms
 ✓ src/render/cube-view.test.ts (33 tests) 54ms
 ✓ src/render/picking.test.ts (12 tests) 37ms
 ✓ src/render/spaceship.test.ts (34 tests) 52ms
 ✓ src/input/gestures.test.ts (27 tests) 24ms
 ✓ src/render/starfield.test.ts (23 tests) 111ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 23ms
 ✓ src/game/engine.test.ts (101 tests) 85ms
 ✓ src/render/world.test.ts (27 tests) 73ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 86ms
 ✓ src/game/effects.test.ts (28 tests) 9ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 14ms
 ✓ src/render/webgl.test.ts (17 tests) 13ms
 ✓ src/game/parts.test.ts (23 tests) 9ms
 ✓ src/game/progression.test.ts (21 tests) 11ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 31ms
 ✓ src/render/postprocessing.test.ts (10 tests) 14ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 17ms
 ✓ src/game/rotation.test.ts (15 tests) 6ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/render/scene.test.ts (77 tests) 230ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 10ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/ui/theme.test.ts (11 tests) 8ms
 ✓ src/input/keyboard.test.ts (13 tests) 17ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 9ms
 ✓ src/game/economy.test.ts (7 tests) 8ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 15ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 13ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 8ms
 ✓ src/ui/Hud.test.tsx (15 tests) 203ms
 ✓ src/game/session.test.ts (71 tests) 374ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 312ms
 ✓ src/render/nebula.test.ts (11 tests) 761ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  635ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 417ms
 ✓ src/App.test.tsx (23 tests) 477ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 1044ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  364ms

 Test Files  50 passed (50)
      Tests  1256 passed (1256)
   Start at  21:36:59
   Duration  2.52s (transform 5.03s, setup 0ms, collect 13.85s, tests 4.86s, environment 2.78s, prepare 5.27s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.2 |       95 |   95.93 |    95.2 |                   
 src               |   82.95 |    78.34 |   89.47 |   82.95 |                   
  App.tsx          |   81.98 |    76.05 |   88.46 |   81.98 | ...17,486-491,507 
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
 src/render        |   98.82 |     95.6 |   98.49 |   98.82 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  scene.ts         |   97.41 |    96.17 |   94.73 |   97.41 | ...95-896,920-921 
  spaceship.ts     |   98.25 |    85.45 |     100 |   98.25 | ...44,360,380,391 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   95.08 |     97.2 |   84.61 |   95.08 |                   
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   81.17 |    68.75 |   33.33 |   81.17 | 45-50,52-57,96-99 
  ...ipPreview.tsx |   71.87 |      100 |     100 |   71.87 | 16-24             
  ...adesPanel.tsx |   91.83 |      100 |      50 |   91.83 | 58-61             
  UserPanel.tsx    |   90.74 |      100 |   66.66 |   90.74 | 66-67,89-91       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

Coverage gate: `All files 95.2% statements / 95% branches / 95.93% functions / 95.2% lines` (thresholds 80); `src/render/nebula.ts` 100% on all four metrics.

## Acceptance audit

- AC-9 → **met.** `nebula.ts` exports `createNebulaTexture(random): DataTexture` plus `NEBULA_WIDTH = 256`, `NEBULA_HEIGHT = 128`, `NEBULA_OCTAVES = 4`, `NEBULA_PURPLE = 0x5b21b6`, `NEBULA_BLUE = 0x1d4ed8`, `NEBULA_PINK = 0xdb2777`, `NEBULA_DARK = 0x070a1a`, `NEBULA_HUE_RANGES = { purple: [250, 280], blue: [205, 240], pink: [310, 345] }`, `NEBULA_MIN_HUE_PIXELS = 100`, `NEBULA_MIN_CHANNEL_VARIANCE = 100`. Tests pin the texture's 256×128 dimensions, `RGBAFormat`, `UnsignedByteType`, both `LinearFilter` filters, `SRGBColorSpace`, the 131072-byte data length, `version === 1` (`needsUpdate = true`), all-255 alpha, same-sequence byte equality and different-sequence difference, per-channel variance > 100, stop hues inside their pinned ranges, and ≥ 100 saturated (S ≥ 0.35, L ∈ [0.15, 0.85]) pixels in each purple/blue/pink range.
- AC-19 (relevant part) → **not in this task's surface.** The module adds no SVG, interactive control, CSS or reduced-motion behavior; AC-19 evidence is owned by T1/T2/T3/T10.

## Deviations from spec

None. No dependencies, configs, lockfiles, scene integration, CSS, or container files were touched.
