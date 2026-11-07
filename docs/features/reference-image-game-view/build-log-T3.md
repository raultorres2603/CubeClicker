# Build log — T3 — Inline SVG icon set

Task: T3 (2026-11-07)
Files changed: `src/frontend/src/ui/icons.tsx`, `src/frontend/src/ui/icons.test.tsx`
What changed & why: New dependency-free icon module exporting twelve decorative inline SVG components for the HUD, users badge, upgrades panel and customization toggle; each renders `aria-hidden`/`focusable="false"` with `data-icon`, `viewBox="0 0 24 24"`, `currentColor` and an optional `className`.
Decisions: One private `Icon` frame keeps the accessibility/size contract identical across all twelve icons; PascalCase component names (`CursorIcon`, `CubeIcon`, …, `UpgradeSpeedIcon`) follow the plan's component contract and map 1:1 to the pinned `data-icon` slugs.

## Implementation sketch

- `IconProps { className?: string }`; private frame renders the shared `<svg>` attributes and accepts children.
- Twelve exported presentational components, one per pinned slug, with plain inline `path`/`circle`/polygon shapes only.
- SSR test renders every icon, asserting `data-icon`, `aria-hidden`, `focusable`, `viewBox`, `currentColor`, an exact non-empty shape child, className forwarding and no external-resource markup.

## Evidence

### `npm run lint`

```text
> lint
> eslint .

EXIT=0
```

### `npm run typecheck`

```text
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT=0
```

### `npm test --workspace @cubeclicker/frontend`

```text
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/app.css.test.ts (83 tests) 18ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/auth/api.test.ts (28 tests) 11ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 23ms
 ✓ src/render/webgl.test.ts (17 tests) 16ms
 ✓ src/render/background-life.test.ts (14 tests) 15ms
 ✓ src/game/board.test.ts (18 tests) 26ms
 ✓ src/auth/store.test.ts (31 tests) 13ms
 ✓ src/render/particles.test.ts (19 tests) 20ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 11ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/render/starfield.test.ts (23 tests) 73ms
 ✓ src/render/cube-view.test.ts (33 tests) 44ms
 ✓ src/render/spaceship.test.ts (34 tests) 42ms
 ✓ src/ui/UpgradesPanel.test.tsx (9 tests) 23ms
 ✓ src/render/picking.test.ts (12 tests) 41ms
 ✓ src/input/gestures.test.ts (27 tests) 21ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 22ms
 ✓ src/game/engine.test.ts (101 tests) 81ms
 ✓ src/render/world.test.ts (27 tests) 66ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/game/parts.test.ts (23 tests) 11ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 70ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/ui/icons.test.tsx (16 tests) 24ms
 ✓ src/game/rotation.test.ts (15 tests) 6ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 9ms
 ✓ src/game/progression.test.ts (21 tests) 13ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 12ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 15ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/docs/links.test.ts (1 test) 3ms
 ✓ src/game/upgrades.test.ts (20 tests) 14ms
 ✓ src/ui/theme.test.ts (11 tests) 7ms
 ✓ src/render/postprocessing.test.ts (10 tests) 13ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 41ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/ui/Hud.test.tsx (15 tests) 208ms
 ✓ src/render/scene.test.ts (77 tests) 234ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 253ms
 ✓ src/game/session.test.ts (71 tests) 251ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 402ms
 ✓ src/App.test.tsx (23 tests) 406ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 827ms

 Test Files  49 passed (49)
      Tests  1245 passed (1245)
   Start at  21:34:33
   Duration  1.80s (transform 4.40s, setup 0ms, collect 13.77s, tests 3.50s, environment 2.32s, prepare 4.89s)

EXIT=0
```

### `npm run coverage --workspace @cubeclicker/frontend`

```text
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (83 tests) 25ms
 ✓ src/browser-env.test.ts (6 tests) 18ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 36ms
 ✓ src/ws/connection.test.ts (10 tests) 20ms
 ✓ src/game/upgrades.test.ts (20 tests) 10ms
 ✓ src/render/webgl.test.ts (17 tests) 17ms
 ✓ src/game/board.test.ts (18 tests) 27ms
 ✓ src/render/postprocessing.test.ts (10 tests) 13ms
 ✓ src/auth/store.test.ts (31 tests) 16ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 15ms
 ✓ src/ui/UpgradesPanel.test.tsx (9 tests) 27ms
 ✓ src/ui/icons.test.tsx (16 tests) 28ms
 ✓ src/render/background-life.test.ts (14 tests) 16ms
 ✓ src/render/particles.test.ts (19 tests) 22ms
 ✓ src/render/picking.test.ts (12 tests) 44ms
 ✓ src/render/spaceship.test.ts (34 tests) 65ms
 ✓ src/render/cube-view.test.ts (33 tests) 56ms
 ✓ src/input/gestures.test.ts (27 tests) 23ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 19ms
 ✓ src/render/starfield.test.ts (23 tests) 123ms
 ✓ src/game/engine.test.ts (101 tests) 102ms
 ✓ src/render/world.test.ts (27 tests) 82ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 51ms
 ✓ src/game/parts.test.ts (23 tests) 11ms
 ✓ src/game/progression.test.ts (21 tests) 16ms
 ✓ src/game/effects.test.ts (28 tests) 13ms
 ✓ src/auth/api.test.ts (28 tests) 14ms
 ✓ src/input/keyboard.test.ts (13 tests) 13ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 5ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 29ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 13ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 21ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 10ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 7ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 14ms
 ✓ src/ui/theme.test.ts (11 tests) 10ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/render/scene.test.ts (77 tests) 249ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 12ms
 ✓ src/game/session.test.ts (71 tests) 344ms
 ✓ src/ui/Hud.test.tsx (15 tests) 212ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 327ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 476ms
 ✓ src/App.test.tsx (23 tests) 496ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 962ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  303ms

 Test Files  49 passed (49)
      Tests  1245 passed (1245)
   Start at  21:34:36
   Duration  2.44s (transform 5.44s, setup 0ms, collect 14.10s, tests 4.14s, environment 2.63s, prepare 5.31s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.09 |    94.97 |   95.86 |   95.09 |                   
 src               |   82.95 |    78.34 |   89.47 |   82.95 |                   
  App.tsx          |   81.98 |    76.05 |   88.46 |   81.98 | ...17,486-491,507 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |    97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   95.44 |    99.68 |   98.75 |   95.44 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |    99.7 |      100 |     100 |    99.7 | 882-883           
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |    89.85 |    99.61 |   96.55 |   89.85 | ...1140,1153-1154 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |    94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.47 |    96.05 |   95.71 |   92.47 |                   
  protocol.ts      |    87.09 |     94.9 |   89.28 |   87.09 | ...94-905,909-919 
  server-state.ts  |    98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |    97.95 |      100 |     100 |    97.95 | 176-178,196       
 src/render        |   98.73 |    95.48 |    98.4 |   98.73 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  scene.ts         |    97.41 |    96.17 |   94.73 |   97.41 | ...95-896,920-921 
  spaceship.ts     |    98.25 |    85.45 |     100 |   98.25 | ...44,360,380,391 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |    98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   95.08 |    97.2 |   84.61 |   95.08 |                   
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |    90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |    81.17 |    68.75 |   33.33 |   81.17 | 45-50,52-57,96-99 
  ...ipPreview.tsx |    71.87 |      100 |     100 |   71.87 | 16-24             
  ...adesPanel.tsx |    91.83 |      100 |      50 |   91.83 | 58-61             
  UserPanel.tsx    |    90.74 |      100 |   66.66 |   90.74 | 66-67,89-91       
  ...onPending.tsx |    80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |    95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
EXIT=0
```

Coverage gate: aggregate 95.09% statements / 94.97% branches / 95.86% functions / 95.09% lines, above the 80% thresholds; `icons.tsx` itself is 100% on all four metrics.

## Acceptance audit

- AC-4 (HUD row icon contract) → met: the three icons the HUD rows need exist as `cursor`, `cube`, `coin`, `cube-level`, `server` (`CursorIcon`, `CubeIcon`, `CoinIcon`, `CubeLevelIcon`, `ServerIcon`), each with the pinned `data-icon`, decorative aria and a non-empty shape child; `icons.test.tsx` renders all five.
- AC-5 (users-badge group icon) → met: `GroupIcon` renders `data-icon="group"`, `aria-hidden="true"`, `focusable="false"` and inline shapes, covered by `icons.test.tsx`.
- AC-6 (upgrades row/cost icons) → met: `UpgradeClickIcon`, `UpgradeCubeIcon`, `UpgradeSpeedIcon` and `DiamondIcon` exist with the pinned `data-icon` slugs and are covered by `icons.test.tsx`.
- AC-7 (customization toggle icons) → met: `GearIcon` and `ShipIcon` exist with the pinned `data-icon` slugs and are covered by `icons.test.tsx`.
- AC-19 (accessibility) → met: every rendered icon has `aria-hidden="true"`, `focusable="false"` and no `tabindex`/interactive/role markup; the test asserts it for all twelve icons, plus no external-resource markup (`href`, `<use`, `<image`, `<foreignObject`).

## Deviations from spec

- None. `ui/icons.tsx` exports exactly the twelve pinned icon components plus the `IconProps` type; no other file was touched. The plan's component list omits `CubeLevelIcon`, which the HUD row contract (AC-4) requires — it is included here, matching the twelve `data-icon` slugs pinned by T3.
