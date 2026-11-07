# Build log — T1 — Add reference HUD theme tokens

Task: T1 (2026-11-07)
Files changed: `src/frontend/src/ui/theme.ts`, `src/frontend/src/ui/theme.test.ts`, `docs/features/reference-image-game-view/build-log-T1.md`

## What changed & why

- Added the nine AC-3 reference HUD tokens as exported literals (`PANEL_BACKGROUND_TOP`, `PANEL_BACKGROUND_BOTTOM`, `PANEL_BORDER`, `PANEL_GLOW`, `PANEL_RADIUS`, `USERS_BADGE_TOP`, `USERS_BADGE_BOTTOM`, `COIN_GOLD`, `UPGRADE_GREEN`) so the gameplay stylesheet (T2) can mirror them 1:1 via `game-view.css.test.ts`.
- Kept `HUD_TEXT`, `HUD_BACKGROUND`, `ACCENT` and `PAGE_BACKGROUND` byte-identical.
- Replaced the outdated "canvas is black" file header with an accurate description of the procedural nebula backdrop and the black/white worst-case contrast gates.
- Extended `theme.test.ts` with exact-literal assertions for the nine tokens and the AC-19 contrast math computed from the exported constants: `HUD_TEXT` over both panel stops composited over black and `#ffffff` (≥ 4.5), `#ffffff` over both badge stops (≥ 4.5), and white over `UPGRADE_GREEN` (≥ 3.0). Exact rounded ratios are pinned alongside the thresholds so a token edit cannot silently slide toward the floor.

## Decisions

- No CSS parsing added for the new tokens: T2 owns `game-view.css` and its source guard; T1 only pins the TypeScript literals and contrast in `theme.test.ts` per the task notes.
- Contrast cases are table-driven with per-combination exact ratios (18.03 / 12.49 / 17.03 / 8.81; 4.66 / 7.46; 3.3) plus the ≥ 4.5 / ≥ 3.0 thresholds.

## Evidence

Environment: repository root `/var/home/raultorraco/Documents/Projects/CubeClicker`, Node.js/npm via host tooling, frontend workspace `@cubeclicker/frontend`.

### `npm run lint` — exit 0

```
> lint
> eslint .
```

### `npm run typecheck` — exit 0

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

### `npm test --workspace @cubeclicker/frontend` — exit 0

```
> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/ws/connection.test.ts (10 tests) 14ms
 ✓ src/auth/api.test.ts (28 tests) 17ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 15ms
 ✓ src/browser-env.test.ts (6 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 26ms
 ✓ src/render/webgl.test.ts (17 tests) 14ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 15ms
 ✓ src/auth/store.test.ts (31 tests) 19ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/render/particles.test.ts (19 tests) 18ms
 ✓ src/game/board.test.ts (18 tests) 25ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 14ms
 ✓ src/render/spaceship.test.ts (34 tests) 27ms
 ✓ src/ui/UpgradesPanel.test.tsx (9 tests) 17ms
 ✓ src/render/cube-view.test.ts (33 tests) 64ms
 ✓ src/render/starfield.test.ts (23 tests) 101ms
 ✓ src/render/picking.test.ts (12 tests) 33ms
 ✓ src/input/gestures.test.ts (27 tests) 16ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 20ms
 ✓ src/render/world.test.ts (27 tests) 54ms
 ✓ src/game/parts.test.ts (23 tests) 10ms
 ✓ src/game/engine.test.ts (101 tests) 89ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 51ms
 ✓ src/render/postprocessing.test.ts (10 tests) 13ms
 ✓ src/ui/app.css.test.ts (83 tests) 19ms
 ✓ src/input/keyboard.test.ts (13 tests) 11ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 39ms
 ✓ src/ui/theme.test.ts (11 tests) 8ms
 ✓ src/game/progression.test.ts (21 tests) 9ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 10ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 10ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 9ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/render/scene.test.ts (77 tests) 251ms
 ✓ src/ui/Hud.test.tsx (15 tests) 190ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 246ms
 ✓ src/game/session.test.ts (71 tests) 263ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 367ms
 ✓ src/App.test.tsx (23 tests) 390ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 847ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  309ms

 Test Files  48 passed (48)
      Tests  1229 passed (1229)
   Start at  21:33:37
   Duration  1.83s (transform 5.31s, setup 0ms, collect 14.16s, tests 3.44s, environment 2.15s, prepare 3.57s)
```

### `npm run coverage --workspace @cubeclicker/frontend` — exit 0

```
> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (83 tests) 17ms
 ✓ src/render/postprocessing.test.ts (10 tests) 8ms
 ✓ src/auth/api.test.ts (28 tests) 19ms
 ✓ src/ws/connection.test.ts (10 tests) 15ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 15ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 29ms
 ✓ src/render/webgl.test.ts (17 tests) 16ms
 ✓ src/auth/store.test.ts (31 tests) 17ms
 ✓ src/game/board.test.ts (18 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 20ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/render/particles.test.ts (19 tests) 18ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 13ms
 ✓ src/ui/UpgradesPanel.test.tsx (9 tests) 28ms
 ✓ src/render/cube-view.test.ts (33 tests) 63ms
 ✓ src/render/picking.test.ts (12 tests) 43ms
 ✓ src/render/spaceship.test.ts (34 tests) 53ms
 ✓ src/input/gestures.test.ts (27 tests) 23ms
 ✓ src/render/starfield.test.ts (23 tests) 120ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 26ms
 ✓ src/render/world.test.ts (27 tests) 66ms
 ✓ src/game/engine.test.ts (101 tests) 108ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 75ms
 ✓ src/game/parts.test.ts (23 tests) 12ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 12ms
 ✓ src/game/effects.test.ts (28 tests) 17ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 15ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 67ms
 ✓ src/input/keyboard.test.ts (13 tests) 13ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 15ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/game/progression.test.ts (21 tests) 11ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 11ms
 ✓ src/ui/theme.test.ts (11 tests) 9ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 15ms
 ✓ src/render/scene.test.ts (77 tests) 289ms
 ✓ src/ui/Hud.test.tsx (15 tests) 184ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 349ms
 ✓ src/game/session.test.ts (71 tests) 387ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 457ms
 ✓ src/App.test.tsx (23 tests) 475ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 964ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  307ms

 Test Files  48 passed (48)
      Tests  1229 passed (1229)
   Start at  21:33:41
   Duration  2.41s (transform 5.88s, setup 0ms, collect 13.98s, tests 4.18s, environment 2.57s, prepare 4.88s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.01 |    94.94 |   95.75 |   95.01 |
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
 src/render        |   98.73 |    95.48 |    98.4 |   98.73 |
  ...round-life.ts |     100 |      100 |     100 |     100 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  ...processing.ts |     100 |      100 |     100 |     100 |
  scene.ts         |   97.41 |    96.17 |   94.73 |   97.41 | ...95-896,920-921
  spaceship.ts     |   98.25 |    85.45 |     100 |   98.25 | ...44,360,380,391
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442
 src/ui            |   94.33 |    97.04 |   79.48 |   94.33 |
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26
  Hud.tsx          |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   81.17 |    68.75 |   33.33 |   81.17 | 45-50,52-57,96-99
  ...ipPreview.tsx |   71.87 |      100 |     100 |   71.87 | 16-24
  ...adesPanel.tsx |   91.83 |      100 |    50 |   91.83 | 58-61
  UserPanel.tsx    |   90.74 |      100 |   66.66 |   90.74 | 66-67,89-91
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
```

Coverage gate: exit 0; all-files 95.01% statements / 94.94% branches / 95.75% functions / 95.01% lines (≥ 80 thresholds); `theme.ts` 100% on all four metrics.

## Acceptance audit

- AC-3 → met for the `theme.ts` half: the nine exported tokens carry the exact pinned literals and `theme.test.ts` pins them (`pins the nine reference HUD tokens (AC-3)`). The `game-view.css` `:root` half belongs to T2.
- AC-5 → met for the token half: `USERS_BADGE_TOP`/`USERS_BADGE_BOTTOM` are the pinned badge stops and `#ffffff` contrast is asserted over both (4.66:1 / 7.46:1). The badge CSS/markup half belongs to T2/T5.
- AC-19 → met for the theme half: `HUD_TEXT` ≥ 4.5 over both panel stops on both black and white worst-case backdrops (18.03/12.49/17.03/8.81), `#ffffff` ≥ 4.5 over both badge stops (4.66/7.46), white over `UPGRADE_GREEN` ≥ 3.0 (3.3). SVG/target/reduced-motion clauses belong to T2/T3/T10.

## Deviations from spec

None.
