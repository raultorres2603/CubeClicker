# Build log — T15 — Fix lootbox reveal layout (AC-41)

Task: T15 (2026-11-09)
Feature: `spaceship-cursor-loot-animations` (spec r4, plan r4, tasks r4)
Branch: `main`, parent commit `512c01b` (`docs: document granular parts and motion`)
Files changed:
- `src/frontend/src/ui/game-view.css`
- `src/frontend/src/ui/game-view.css.test.ts`
- `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx`
- `docs/features/spaceship-cursor-loot-animations/build-log-T15.md` (this file)

What changed & why: the reveal collapsed to 18 px because it was a `flex-shrink: 1` +
`overflow: hidden` child of the `max-height: 60vh` / `overflow-y: auto` customization panel.
The reveal and its card now use `flex: 0 0 auto`, the reveal has an 18 rem floor and
`overflow: visible`, and the orb has a fixed 5 rem flex-none box. The panel scrolls the
full-height reveal instead of compressing it; the 1290 ms sequence, copy, ARIA/live region,
reduced-motion rules and 44 px controls were not touched. A CSS guard test plus a
jsdom-cascade panel test pin the non-shrinking/unclipped layout at the reveal phase.

## Decisions

- Kept `.customization-panel` as the single scroll container (no DOM restructure in
  `SpaceshipCustomizationPanel.tsx`); `overflow-y: auto` already lets the panel scroll.
- `min-height: 18rem` is the full orb (5 rem) + 0.4 rem gap + ~12 rem card floor at rest.
  Actual reveal height is 306 px at 1280×720 (288 px content floor + 16 px padding + 2 px
  border) and fits the panel's 428 px client height without scrolling; longer content still
  scrolls.
- Removed `overflow: hidden` from the reveal instead of keeping a clip and relying on the
  floor, so the 8 % card overshoot is never clipped; the absolutely positioned flash already
  stays inside via `inset: 0`.
- Panel test injects the real `app.css` + `game-view.css` into jsdom and asserts computed
  style values, so the assertions fail if a selector stops matching the rendered panel (not
  just if the stylesheet text changes).

## Before / after layout measurements

Harness: the T14 CDP harness (`/tmp/opencode/t14/reveal-layout.mjs`, in-memory dev-server
scene hook only) with the live `podman compose` stack, headless Chrome 157, 5 ms phase
polling. Screenshots are written under `/tmp/opencode/t14/evidence` (outside the repository;
no T15 evidence files added). The "before" runs were produced by temporarily restoring the
committed `game-view.css` from git and then restoring the fixed file from a `/tmp` copy.

### 1280×720

Before (clipped):

```text
PANEL_GEOM {"panel":{"top":224,"height":432,"scrollTop":0,"scrollHeight":1970},"preview":{"w":303,"h":153,"top":2030.71875,"label":"Spaceship preview"},"counts":"1"}
REVEAL_GEOM 100 {"phase":"charge","rect":{"top":327.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":198.09567260742188,"cardOpacity":"0"}
REVEAL_GEOM 430 {"phase":"orb","rect":{"top":327.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":198.09567260742188,"cardOpacity":"0"}
REVEAL_GEOM 700 {"phase":"settle","rect":{"top":327.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":198.09567260742188,"cardOpacity":"1"}
REVEAL_GEOM 850 {"phase":"rest","rect":{"top":327.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 1200 {"phase":"rest","rect":{"top":327.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 1400 {"phase":"rest","rect":{"top":327.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":183.421875,"cardOpacity":"1"}
```

After (fully visible):

```text
PANEL_GEOM {"panel":{"top":224,"height":432,"scrollTop":0,"scrollHeight":1970},"preview":{"w":303,"h":153,"top":2030.71875,"label":"Spaceship preview"},"counts":"1"}
REVEAL_GEOM 100 {"phase":"charge","rect":{"top":327.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2313,"orbHeight":80,"cardHeight":198.09567260742188,"cardOpacity":"0"}
REVEAL_GEOM 430 {"phase":"flash","rect":{"top":327.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2313,"orbHeight":100.1669921875,"cardHeight":198.09567260742188,"cardOpacity":"0"}
REVEAL_GEOM 700 {"phase":"settle","rect":{"top":327.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":198.09567260742188,"cardOpacity":"1"}
REVEAL_GEOM 850 {"phase":"rest","rect":{"top":327.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 1200 {"phase":"rest","rect":{"top":327.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 1400 {"phase":"rest","rect":{"top":327.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":428,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":183.421875,"cardOpacity":"1"}
```

Reveal box: top 327.28 + height 306 = 633.28 px; panel bottom = 224 + 432 = 656 px, so the
whole region and the card are inside the panel viewport at `scrollTop: 0`.

### 1920×1080

Before (clipped):

```text
PANEL_GEOM {"panel":{"top":368,"height":648,"scrollTop":0,"scrollHeight":1970},"preview":{"w":303,"h":153,"top":2174.71875,"label":"Spaceship preview"},"counts":"1"}
REVEAL_GEOM 100 {"phase":"charge","rect":{"top":471.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":198.09567260742188,"cardOpacity":"0"}
REVEAL_GEOM 430 {"phase":"flash","rect":{"top":471.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":198.09567260742188,"cardOpacity":"0"}
REVEAL_GEOM 700 {"phase":"rest","rect":{"top":471.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 850 {"phase":"rest","rect":{"top":471.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 1200 {"phase":"rest","rect":{"top":471.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 1400 {"phase":"rest","rect":{"top":471.28125,"height":18,"width":301},"display":"flex","flexShrink":"1","minHeight":"auto","overflow":"hidden","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2025,"orbHeight":0,"cardHeight":183.421875,"cardOpacity":"1"}
```

After (fully visible):

```text
PANEL_GEOM {"panel":{"top":368,"height":648,"scrollTop":0,"scrollHeight":1970},"preview":{"w":303,"h":153,"top":2174.71875,"label":"Spaceship preview"},"counts":"1"}
REVEAL_GEOM 100 {"phase":"charge","rect":{"top":471.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2313,"orbHeight":80,"cardHeight":198.09564208984375,"cardOpacity":"0"}
REVEAL_GEOM 430 {"phase":"reveal","rect":{"top":471.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":198.09564208984375,"cardOpacity":"0.473569"}
REVEAL_GEOM 700 {"phase":"rest","rect":{"top":471.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 850 {"phase":"rest","rect":{"top":471.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 1200 {"phase":"rest","rect":{"top":471.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":183.421875,"cardOpacity":"1"}
REVEAL_GEOM 1400 {"phase":"rest","rect":{"top":471.28125,"height":306,"width":301},"display":"flex","flexShrink":"0","minHeight":"288px","overflow":"visible","panelScrollTop":0,"panelClientHeight":644,"panelScrollHeight":2313,"orbHeight":100,"cardHeight":183.421875,"cardOpacity":"1"}
```

Reveal box: top 471.28 + height 306 = 777.28 px; panel bottom = 368 + 648 = 1016 px.
Phase polling at 1280/1920 lands on different frames because the browser round-trip drives
the sample times; the component timer test still pins the exact 420 + 250 + 120 + 360 + 140
sequence (and the component itself was not edited).

## Raw verification

### `npm run lint`

```text
> lint
> eslint .

LINT_EXIT=0
```

### `npm run typecheck --workspace @cubeclicker/frontend`

```text
> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### `npm test --workspace @cubeclicker/frontend`

The pre-existing jsdom canvas/WebGL stderr warnings are omitted from this excerpt; result
lines are verbatim:

```text
> test
> vitest run
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/game/parts.test.ts (23 tests) 8ms
 ✓ src/game/parts-v2.test.ts (50 tests) 18ms
 ✓ src/render/quality.test.ts (23 tests) 41ms
 ✓ src/browser-env.test.ts (6 tests) 14ms
 ✓ src/multiplayer/protocol.test.ts (236 tests) 30ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 17ms
 ✓ src/game/board.test.ts (18 tests) 18ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/auth/store.test.ts (31 tests) 18ms
 ✓ src/render/particles.test.ts (24 tests) 18ms
 ✓ src/render/preview.test.ts (7 tests) 38ms
 ✓ src/ui/icons.test.tsx (16 tests) 29ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 17ms
 ✓ src/render/impact-effects.test.ts (15 tests) 35ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 144ms
 ✓ src/render/picking.test.ts (16 tests) 106ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 138ms
 ✓ src/render/targeting.test.ts (11 tests) 73ms
 ✓ src/render/starfield.test.ts (28 tests) 137ms
 ✓ src/render/cube-view.test.ts (32 tests) 138ms
 ✓ src/input/gestures.test.ts (27 tests) 47ms
 ✓ src/render/spaceship.test.ts (31 tests) 123ms
 ✓ src/game/engine.test.ts (113 tests) 109ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 220ms
 ✓ src/ui/game-view.css.test.ts (42 tests) 26ms
 ✓ src/render/world.test.ts (27 tests) 206ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/render/webgl.test.ts (17 tests) 14ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 12ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 10ms
 ✓ src/auth/api.test.ts (28 tests) 20ms
 ✓ src/ui/app.css.test.ts (87 tests) 24ms
 ✓ src/game/effects.test.ts (25 tests) 7ms
 ✓ src/render/postprocessing.test.ts (10 tests) 11ms
 ✓ src/input/keyboard.test.ts (13 tests) 9ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/theme.test.ts (11 tests) 6ms
 ✓ src/render/ship-motion.test.ts (24 tests) 11ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 12ms
 ✓ src/game/motion.test.ts (11 tests) 8ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 19ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/render/nebula.test.ts (11 tests) 477ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  388ms
 ✓ src/game/progression.test.ts (21 tests) 12ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 197ms
 ✓ src/render/scene-spaceship.test.ts (24 tests) 483ms
 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 68ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 223ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 228ms
 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 98ms
 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 215ms
 ✓ src/render/scene.test.ts (85 tests) 1226ms
 ✓ src/game/session.test.ts (81 tests) 1183ms
 ✓ src/ui/Hud.test.tsx (20 tests) 218ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 366ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 595ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 820ms
 ✓ src/App.test.tsx (38 tests) 727ms
 Test Files  63 passed (63)
      Tests  1697 passed (1697)
   Start at  18:42:44
   Duration  3.00s (transform 6.34s, setup 0ms, collect 17.81s, tests 9.15s, environment 5.19s, prepare 6.36s)

TEST_EXIT=0
```

Test-count delta vs the T14 gate: +2 (the CSS layout guard and the panel computed-style
layout test); no test was removed or weakened.

### `npm run coverage --workspace @cubeclicker/frontend`

The pre-existing jsdom canvas/WebGL stderr warnings are omitted from this excerpt; the
summary and full coverage table are verbatim:

```text
> coverage
> vitest run --coverage
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8
 Test Files  63 passed (63)
      Tests  1697 passed (1697)
   Start at  18:42:50
   Duration  4.38s (transform 6.70s, setup 0ms, collect 20.22s, tests 14.80s, environment 6.14s, prepare 7.08s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.28 |    95.26 |   97.42 |   96.28 |                   
 src               |    86.5 |    82.91 |    92.5 |    86.5 |                   
  App.tsx          |   86.03 |    81.52 |   92.85 |   86.03 | ...33,455-456,619 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   96.28 |    99.73 |   98.92 |   96.28 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.47 |      100 |     100 |   99.47 | 958-959,1250-1251 
  motion.ts        |     100 |      100 |     100 |     100 |                   
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   90.03 |    99.63 |   96.77 |   90.03 | ...1277,1290-1291 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.94 |    96.42 |   95.83 |   92.94 |                   
  protocol.ts      |   88.57 |    95.73 |      90 |   88.57 | ...1026,1030-1040 
  server-state.ts  |   98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   97.95 |      100 |     100 |   97.95 | 176-178,196       
 src/render        |    98.3 |    96.02 |   98.71 |    98.3 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |       96 |     100 |      99 | 299-300           
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  cursor-ship.ts   |   99.54 |    97.61 |     100 |   99.54 | 208-209           
  ...ct-effects.ts |   97.24 |    91.76 |     100 |   97.24 | ...83-484,511-512 
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |   97.33 |    90.47 |     100 |   97.33 | 122-123           
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  preview.ts       |     100 |      100 |     100 |     100 |                   
  quality.ts       |   97.68 |    97.05 |     100 |   97.68 | 220-221,301-302   
  scene.ts         |   97.16 |    95.48 |   95.12 |   97.16 | ...1001,1009-1010 
  ship-motion.ts   |     100 |      100 |     100 |     100 |                   
  ...ship-model.ts |     100 |      100 |     100 |     100 |                   
  spaceship.ts     |    94.6 |    95.41 |   96.42 |    94.6 | ...07-516,534-535 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  targeting.ts     |   95.78 |     92.5 |     100 |   95.78 | ...64-166,178-179 
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   96.79 |    94.24 |   94.02 |   96.79 |                   
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   96.84 |    88.99 |     100 |   96.84 | ...09-210,216-217 
  ...ipPreview.tsx |    87.2 |    77.41 |      75 |    87.2 | ...24-125,130-131 
  ...adesPanel.tsx |   96.74 |    90.62 |     100 |   96.74 | 77-78,96-97       
  UserPanel.tsx    |   91.07 |      100 |    66.66 |   91.07 | 69-70,93-95       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------

COVERAGE_EXIT=0
```

Thresholds ≥ 80 on statements/branches/functions/lines are met (96.28/95.26/97.42/96.28).

## Behaviour-preservation checks

- 1290 ms sequence: `SpaceshipCustomizationPanel.test.tsx` still asserts every boundary
  (419/420, 249/250, 119/120, 359/360, 139/140 ms) and the component timer code is
  untouched.
- Copy/ARIA: the existing reveal tests (`role="status"`, `aria-live="polite"`,
  `data-reveal-active`, `data-part-id`, `data-slot`, `data-rarity`, `data-duplicate`,
  Rare/Epic, New/Duplicate, Equip/Dismiss) pass unchanged.
- Reduced motion: the reduced-motion reveal test passes unchanged; the CSS reduced-motion
  block still lists `.lootbox-reveal`, `.lootbox-orb`, `.lootbox-flash`,
  `.lootbox-reveal-card` with `animation: none` (guard test passes).
- 44 px controls: `app.css` control sizing untouched; `game-view.css.test.ts` focus-ring
  test still passes.
- Tokens on `main`, no shake: the exact 13-token test and the "main/panels free of
  transform/translate/rotate/scale" test pass unchanged.

## Acceptance audit

- AC-41 → **met**. Real-browser measurements at 1280×720 and 1920×1080 now show reveal
  306 px (was 18), orb 80–100 px (was 0), card 198/183 px (was clipped by the 18 px parent),
  computed `flex-shrink: 0`, `overflow: visible`, and the full reveal inside the panel
  viewport at `scrollTop: 0`. Exact CSS guard test + computed-style panel test pin it.
  Copy, ARIA, the 1290 ms sequence, the 44 px reveal Equip target, reduced motion and the
  no-shake invariants are unchanged.
- AC-32 → **met**. Reveal state/data attributes/copy/timeline/reduced-motion tests all pass
  unchanged; the T15 change is layout-only.
- AC-48 → **preserved**. No animation/reduced-motion rule was edited; the full frontend
  suite and the reduced-motion CSS guard test pass.

Deviations from spec: none. No source file outside `files_owned` was changed; no dependency,
config, lockfile or container edit.
