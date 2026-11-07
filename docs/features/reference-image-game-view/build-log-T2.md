# Build log — T2 — Gameplay HUD stylesheet

Task: T2 (2026-11-07)
Files changed: `src/frontend/src/ui/game-view.css`, `src/frontend/src/ui/game-view.css.test.ts`, `docs/features/reference-image-game-view/build-log-T2.md`

## What changed & why

- Added `game-view.css` with exactly one `:root` block declaring the nine AC-3 tokens (mirrored 1:1 from `ui/theme.ts`) plus the single grouped rounded-panel rule, the grouped `content: none` metallic-sheen reset, the users pill/list, upgrades rows/buy control, customization toggle/panel, the `@media (max-width: 720px)` bottom band and a `prefers-reduced-motion` block.
- Added `game-view.css.test.ts`, a node-environment source guard that reads `game-view.css`, `theme.ts` and `app.css` and pins the whole CSS contract with exact declaration arrays (tokens and theme mirror, grouped selectors/declarations, specificity-safe badge reset, corners owned by `app.css`, no base position duplication, 720px stacking/hide, focus rings, 44 px targets, reduced motion and the auth/banner/announcement absence guard).
- Base corner placement is untouched: `app.css` still owns `main > section`, `.user-panel`, `.customization-toggle` and `.upgrades-panel`; `game-view.css` declares no base `position/top/right/bottom/left` for the gameplay surfaces.

## Decisions

- The pinned `.user-panel > .users-badge` (0,2,0) and `.user-panel .users-list::before` (0,2,1) selectors are used with the full metallic resets and no `!important`; a plain `.users-badge` rule is explicitly absent from the stylesheet (asserted).
- The `.upgrade-buy` white `+` is the inherited glyph from the unchanged `app.css` `.upgrades-panel button::before` rule, coloured by `.upgrade-buy { color: #ffffff; }`; no glyph duplication is added.
- Icon sizing is added for the T3 inline SVGs (`1.15rem`, `flex: none`, `vertical-align: middle`) because the icon components rely on stylesheet sizing; the coin stat uses the `--coin-gold` token.
- Test tiers: a stylesheet has no executable boundary in this workspace (Vitest runs in `node`, per the spec's CSS-guard definition), so the source guard is the feature-appropriate unit/contract evidence; no integration surface exists until T8 imports the stylesheet.
- No `app.css` / `app.css.test.ts` edit, no dependency change, no `!important`.

## Evidence

Environment: repository root `/var/home/raultorraco/Documents/Projects/CubeClicker`; frontend workspace `@cubeclicker/frontend`; node via host tooling.

### `npm run lint` — exit 0

```text

> lint
> eslint .

EXIT=0
```

### `npm run typecheck` — exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT=0
```

### `npm test --workspace @cubeclicker/frontend` — exit 0

```text

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/app.css.test.ts (83 tests) 21ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 9ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 14ms
 ✓ src/auth/store.test.ts (31 tests) 14ms
 ✓ src/render/background-life.test.ts (14 tests) 16ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/render/particles.test.ts (19 tests) 15ms
 ✓ src/ui/icons.test.tsx (16 tests) 19ms
 ✓ src/game/board.test.ts (18 tests) 36ms
 ✓ src/ui/UpgradesPanel.test.tsx (9 tests) 25ms
 ✓ src/render/spaceship.test.ts (34 tests) 44ms
 ✓ src/render/picking.test.ts (12 tests) 37ms
 ✓ src/input/keyboard.test.ts (13 tests) 13ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 12ms
 ✓ src/render/cube-view.test.ts (33 tests) 72ms
 ✓ src/input/gestures.test.ts (27 tests) 19ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 25ms
 ✓ src/render/starfield.test.ts (23 tests) 111ms
 ✓ src/game/engine.test.ts (101 tests) 61ms
 ✓ src/render/world.test.ts (27 tests) 77ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 60ms
 ✓ src/game/parts.test.ts (23 tests) 12ms
 ✓ src/game/effects.test.ts (28 tests) 8ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 15ms
 ✓ src/game/progression.test.ts (21 tests) 10ms
 ✓ src/render/postprocessing.test.ts (10 tests) 11ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 7ms
 ✓ src/auth/api.test.ts (28 tests) 19ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 18ms
 ✓ src/browser-env.test.ts (6 tests) 10ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/game/upgrades.test.ts (20 tests) 11ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 16ms
 ✓ src/render/webgl.test.ts (17 tests) 14ms
 ✓ src/ui/game-view.css.test.ts (25 tests) 14ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/render/nebula.test.ts (11 tests) 412ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  349ms
 ✓ src/render/scene.test.ts (77 tests) 238ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/ui/theme.test.ts (11 tests) 8ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 7ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 42ms
 ✓ src/ui/Hud.test.tsx (15 tests) 181ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 254ms
 ✓ src/game/session.test.ts (71 tests) 298ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 385ms
 ✓ src/App.test.tsx (23 tests) 420ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 798ms

 Test Files  51 passed (51)
      Tests  1281 passed (1281)
   Start at  21:38:41
   Duration  1.87s (transform 4.40s, setup 0ms, collect 14.05s, tests 3.97s, environment 2.45s, prepare 3.90s)

EXIT=0
```

### `npm run coverage --workspace @cubeclicker/frontend` — exit 0

```text

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (83 tests) 23ms
 ✓ src/ui/game-view.css.test.ts (25 tests) 18ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 6ms
 ✓ src/auth/api.test.ts (28 tests) 19ms
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/render/background-life.test.ts (14 tests) 16ms
 ✓ src/game/board.test.ts (18 tests) 26ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 15ms
 ✓ src/render/webgl.test.ts (17 tests) 18ms
 ✓ src/ui/icons.test.tsx (16 tests) 26ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 14ms
 ✓ src/ui/UpgradesPanel.test.tsx (9 tests) 23ms
 ✓ src/render/particles.test.ts (19 tests) 23ms
 ✓ src/render/picking.test.ts (12 tests) 40ms
 ✓ src/render/cube-view.test.ts (33 tests) 54ms
 ✓ src/render/spaceship.test.ts (34 tests) 48ms
 ✓ src/input/gestures.test.ts (27 tests) 23ms
 ✓ src/render/starfield.test.ts (23 tests) 129ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 23ms
 ✓ src/render/world.test.ts (27 tests) 72ms
 ✓ src/game/engine.test.ts (101 tests) 103ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 61ms
 ✓ src/game/parts.test.ts (23 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 29ms
 ✓ src/input/keyboard.test.ts (13 tests) 10ms
 ✓ src/auth/store.test.ts (31 tests) 21ms
 ✓ src/game/upgrades.test.ts (20 tests) 10ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 30ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/browser-env.test.ts (6 tests) 16ms
 ✓ src/render/postprocessing.test.ts (10 tests) 14ms
 ✓ src/game/progression.test.ts (21 tests) 13ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 18ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/game/rotation.test.ts (15 tests) 14ms
 ✓ src/ui/theme.test.ts (11 tests) 8ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 13ms
 ✓ src/render/scene.test.ts (77 tests) 256ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/game/economy.test.ts (7 tests) 10ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 13ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 7ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 15ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 17ms
 ✓ src/game/session.test.ts (71 tests) 374ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 330ms
 ✓ src/render/nebula.test.ts (11 tests) 783ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  618ms
 ✓ src/ui/Hud.test.tsx (15 tests) 200ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 495ms
 ✓ src/App.test.tsx (23 tests) 479ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 991ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  305ms

 Test Files  51 passed (51)
      Tests  1281 passed (1281)
   Start at  21:38:44
   Duration  2.51s (transform 4.79s, setup 0ms, collect 14.39s, tests 4.99s, environment 2.75s, prepare 5.08s)

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
EXIT=0
```

Coverage gate: exit 0; aggregate 95.2% statements / 95% branches / 95.93% functions / 95.2% lines (thresholds ≥ 80 for all four metrics); the new `game-view.css.test.ts` is itself 25 passing tests.

## Acceptance audit

- AC-2 → met for the stylesheet half: `game-view.css.test.ts` reads the four corner placements and their `env(safe-area-inset-*)` offsets from unchanged `app.css`, and asserts zero base `position/top/right/bottom/left` declarations in `game-view.css` for `.hud-panel`, `.user-panel`, `.users-badge`, `.users-list`, `.customization-toggle`, `.upgrades-panel`, `.customization-panel`. `App.test.tsx` shell order/classes are T8's half.
- AC-3 → met: exactly one `:root` with the nine exact tokens (and a 1:1 `theme.ts` literal mirror), the one grouped panel rule with exactly the nine pinned declarations, and the one grouped `content: none` reset including `.user-panel .users-list::before` with no `.users-list::after`.
- AC-5 → met for the CSS half: the exact specificity-safe `.user-panel > .users-badge` reset (nine declarations), hover (three) and focus-visible (two; accent outline) are pinned; the list gets the grouped panel/reset treatment. Markup is T5's half.
- AC-6 → met for the CSS half: `.upgrades-panel` has pointer-events/width/height/overflow, `.upgrade-row` is styled, and `.upgrade-buy` is the green 50% circle with white text, 44 px minimums, disabled dimming and an accent focus ring. Markup is T6's half.
- AC-7 → met for the CSS half: `.customization-toggle` has exactly the eight pinned declarations (44 px min-height) plus the accent focus-visible outline; `.customization-panel` declares `pointer-events: auto` and gets the grouped rounded treatment. Base placement stays in `app.css`. Markup is T7/T8's half.
- AC-8 → met for the stylesheet half: no `.auth-*`, `.verification-pending`, `.connection-banner` or `.phase-announcement` selectors (comments stripped before matching); unchanged `app.css.test.ts` passes in the same run.
- AC-18 → met for the source contract: exactly one `@media (max-width: 720px)` block (no 480px block), reduced `.hud-panel` padding/font, both bottom panels stacked with the pinned safe-area offsets and clamps, and `main[data-customization-open='true'] .upgrades-panel { display: none; }`; the attribute/markup half is T8's.
- AC-19 → met for the CSS half: accent `:focus-visible` rings for the badge, buy control and customization toggle; 44 px minimum targets; reduced-motion block disables transition/animation for the gameplay surfaces. Contrast/SVG halves are T1/T3.

## Deviations from spec

None. `ui/game-view.css` and `ui/game-view.css.test.ts` are the only source files created; `app.css`, `app.css.test.ts` and all component/config/container files are untouched.
