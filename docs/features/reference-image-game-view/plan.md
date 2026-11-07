---
feature: reference-image-game-view
revision: 4
---

# Plan — Reference-image game view

## Architecture

The feature is split into two independent visual layers; neither changes the engine, session, multiplayer reducer, server, or persistence.

### 1. Gameplay HUD (React + CSS)

- **New stylesheet `ui/game-view.css`, imported after `ui/app.css`** in `App.tsx`. It owns every reference-style gameplay restyle: `.hud-panel`, `.user-panel > .users-badge`, `.user-panel .users-list`, `.upgrades-panel`, `.upgrade-row`, `.upgrade-buy`, `.customization-toggle`, `.customization-panel`. It does **not** own the four base corner placements: those remain in unchanged `app.css` (`main > section` top-left, `.user-panel` top-right, `.customization-toggle` bottom-left, `.upgrades-panel` bottom-right). `game-view.css` owns only the `@media (max-width: 720px)` overrides (bottom-band stacking/hide plus the T17 top-band sizing reserves). Auth/menu/banner/announcement surfaces are untouched and keep the accepted metallic frames.
- **Specificity contract (no `!important`).** The selectors are chosen so later import order is not the only defence:

  | `game-view.css` selector | Specificity | `app.css` rule it must beat | Specificity |
  | --- | --- | --- | --- |
  | `.user-panel > .users-badge` | (0,2,0) | `.user-panel > button` | (0,1,1) |
  | `.user-panel > .users-badge:hover` | (0,3,0) | `.user-panel > button:hover` | (0,2,1) |
  | `.user-panel .users-list` | (0,2,0) | `.user-panel section` | (0,1,1) |
  | `.user-panel .users-list::before` | (0,2,1) | `.user-panel section::before` | (0,1,2) |
  | `.upgrades-panel`, `.customization-panel`, `.hud-panel` | (0,1,0) | `main > section` | (0,0,2) |

  A plain `.users-badge` (0,1,0) would lose to `.user-panel > button` (0,1,1), so the descendant form is mandatory. A plain `.users-list::before` (0,1,1) would lose to `.user-panel section::before` (0,1,2), so the descendant form is mandatory.
- **`ui/theme.ts` gains nine additive tokens** mirroring the nine `:root` values (`PANEL_BACKGROUND_TOP`, `PANEL_BACKGROUND_BOTTOM`, `PANEL_BORDER`, `PANEL_GLOW`, `PANEL_RADIUS`, `USERS_BADGE_TOP`, `USERS_BADGE_BOTTOM`, `COIN_GOLD`, `UPGRADE_GREEN`). Existing pinned constants (`HUD_TEXT`, `HUD_BACKGROUND`, `ACCENT`, `PAGE_BACKGROUND`) stay byte-identical. The file header comment ("the canvas is black…") is corrected to describe the nebula backdrop in the same task. `ui/theme.test.ts` computes WCAG contrast against both black and white worst-case backdrops, so a bright nebula cannot silently destroy readability.
- **New `ui/icons.tsx`** with small inline SVG components (`CursorIcon`, `CubeIcon`, `CoinIcon`, `ServerIcon`, `GroupIcon`, `GearIcon`, `ShipIcon`, `DiamondIcon`, `UpgradeClickIcon`, `UpgradeCubeIcon`, `UpgradeSpeedIcon`). Every icon renders `<svg aria-hidden="true" focusable="false" data-icon="...">` and uses `currentColor`; no image files, no external URLs.
- **Markup additions only where needed**: `Hud.tsx` gains `class="hud-panel"`, five `p class="hud-row" data-row=...` rows and icons; `UserPanel.tsx` gains `users-badge`/`users-list` classes and the group icon; `UpgradesPanel.tsx` gains row icons, cost diamonds and `upgrade-buy`; the customization toggle becomes a new `ui/CustomizationToggle.tsx` component used by `App.tsx`; the game-shell `<main>` gains `data-customization-open={customizationOpen ? 'true' : 'false'}` for the ≤720px hide rule. Labels, `data-stat`/`data-upgrade` hooks, aria semantics, disabled logic and callbacks are unchanged.
- **Responsive/reduced-motion**: `game-view.css` adds a `@media (max-width: 720px)` block. At ≤720px the bottom band is stacked: the toggle stays at the `app.css` bottom-left position, `.upgrades-panel` spans left/right above it (`bottom: calc(5rem + env(safe-area-inset-bottom, 0px))`, `max-height: 35vh`, internal scroll), the open `.customization-panel` occupies the same slot (`bottom: calc(5rem + …)`, `max-height: 45vh`, internal scroll), and `main[data-customization-open='true'] .upgrades-panel { display: none; }` prevents the two panels overlapping. At >720px the base `.upgrades-panel { max-width: min(22rem, calc(50vw - 1.5rem)); }` keeps the bottom-left and bottom-right controls apart (768×1024 check). The same block keeps the **top band** clear (T17): `.hud-panel` gains `box-sizing: border-box;` (so `max-width` includes its padding and 2px border — there is no global `box-sizing` reset) and `max-width: calc(100vw - 2rem - 9rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));`, `.user-panel` is capped at `8.5rem`, and `.users-badge` drops to `padding: 0.5rem 0.5rem; font-size: 0.8rem;` so the 9rem reserve exceeds the pill cap by 0.5rem (8 px) at every width ≤720 px and any safe-area inset. These are sizing/typography declarations only — no `position`/`top`/`right`/`bottom`/`left` is added, so the base corners stay owned by `app.css` (AC-2) and the HUD/pill rectangles cannot intersect at 375×667/320×568. A `prefers-reduced-motion` block covers any new transitions. The existing 480 px block and safe-area offsets remain in `app.css`.

### 2. Scene presentation (three.js)

- **New `render/nebula.ts`**: pure procedural `createNebulaTexture(random): DataTexture` (256×128 RGBA, 8-bit, linear filtering, sRGB). It builds a seeded value-noise field with four octaves, maps it through a pinned purple/blue/pink palette, and returns a `DataTexture`. Palette stops and hue ranges are exported (`NEBULA_PURPLE`, `NEBULA_BLUE`, `NEBULA_PINK`, `NEBULA_DARK`, `NEBULA_HUE_RANGES`, `NEBULA_MIN_HUE_PIXELS`, `NEBULA_MIN_CHANNEL_VARIANCE`). No canvas/DOM, so it runs in the node test environment.
- **New `render/cosmic-backdrop.ts`**: `createCosmicBackdrop(random)` owns one `Group` named `cosmic-backdrop` containing exactly 28 objects (group + 7 asteroids + 3 meteor groups with 6 meshes + 1 comet group with 2 meshes + 1 hero-ship group with 7 meshes). The comet and hero ship use exported colour/position constants and sit on the right (`x > 0`) behind the cube (`z < -4`). All objects are procedural meshes; no shadow casting, no picking, no gameplay effect. `update(dtMs, reducedMotion)` animates them and freezes under reduced motion; `dispose()` releases every geometry/material and the texture exactly once.
- **`render/scene.ts`** creates exactly one cosmic backdrop **after** `createStarfield(random)` and `createBackgroundLife(random)` so the seeded starfield density and background-life sequences keep their draws; the cosmic group is appended as the ninth `scene.children` entry (after `background-life`), keeping the light indices 0/1 stable. It sets `scene.background = cosmic.nebulaTexture`, forwards `update` from `SceneView.update`, and on `dispose()` sets `scene.background = null` before disposing the backdrop. There is no camera-anchored plane fallback: if the texture is invisible through the composer, T11 reports blocked and a spec revision decides the fallback. **T16 (B-1):** `SceneView.update` sets the group's `position` to the live camera `x`/`y` plus the pinned presentation offsets `COSMIC_ANCHOR_OFFSET_X = 6` and `COSMIC_ANCHOR_OFFSET_Y = 4` (with `z = 0`) — the same camera-anchoring contract the starfield uses for its `Points`, extended with a screen-right/up composition offset — and construction sets the same initial anchor, so the comet/hero keep a fixed screen composition from every server slot. The offsets put the comet at a camera-relative screen angle `atan((7.5 + 6) / 30) = 24.23°` (outside the measured `14.7°–16.6°` cube silhouette) and the hero at cube-relative `(15, 1.5, −14)`, whose 1280×720 projection centres at ≈`(1085, 316)` with a lower edge ≈`334 px` — right of the cube and ≈`26 px` above the upgrades panel's measured top edge (≈`360 px`). This is not the AC-10-rejected background plane: `scene.background` remains the single nebula texture and only the decorative group's transform follows the camera; local child positions/rotations/colours/counts, the pinned `z < -4` depth, the seeded random sequence, the camera rest/travel constants and the disposal contract are unchanged, and the offsets carry no game or protocol state.
- **`render/cube-view.ts`** uses `RoundedBoxGeometry` (shipped with `three`) for each face's instanced tile geometry; the body stays a `BoxGeometry`. Existing pop/removal matrix math is geometry-agnostic and stays unchanged.
- **`game/progression.ts`** retunes the first cube style (`id: 'obsidian-neon'`, name `Emerald Neon`) to the reference green; ids/order remain the multiplayer wire contract. The old style-0 literals in `world.test.ts`, `cube-view.test.ts` and `scene.test.ts` are updated by the tasks that own those files (T12/T13/T11).
- **`render/particles.ts`** tints the shared burst material gold (`PARTICLE_COLOR = 0xffcc66`); the pool, fade and lifetime logic are untouched.

### Data flow / state ownership

Unchanged. The engine remains the single writer of game state; the scene and React still read values. The cosmic backdrop is render-local and seeded from the same injected `random` already passed to `createSceneView` (created after the existing consumers, as above). HUD state remains React-local; shared values (roster, coins, upgrades, customization) still arrive through the existing session/server paths. `data-customization-open` is ephemeral local UI state. The cosmic group's per-frame `x`/`y` anchor is the live camera pose plus the two pinned presentation offsets — no stored game state and no `random` draw — so it cannot shift the seeded sequence or any shared value. No new store, event, protocol message, or persistence.

## Interfaces / contracts

```ts
// render/nebula.ts
export const NEBULA_WIDTH = 256;
export const NEBULA_HEIGHT = 128;
export const NEBULA_OCTAVES = 4;
export const NEBULA_PURPLE = 0x5b21b6;
export const NEBULA_BLUE = 0x1d4ed8;
export const NEBULA_PINK = 0xdb2777;
export const NEBULA_DARK = 0x070a1a;
export const NEBULA_HUE_RANGES = { purple: [250, 280], blue: [205, 240], pink: [310, 345] } as const;
export const NEBULA_MIN_HUE_PIXELS = 100;
export const NEBULA_MIN_CHANNEL_VARIANCE = 100;
export function createNebulaTexture(random: () => number): DataTexture;

// render/cosmic-backdrop.ts
export const COSMIC_ASTEROID_COUNT = 7;
export const COSMIC_METEOR_COUNT = 3;
export const COSMIC_BACKDROP_OBJECT_COUNT = 28;
export const COMET_HEAD_COLOR = 0xff8a3d;
export const HERO_HULL_COLOR = 0x2f6fd6;
export const HERO_FLAME_COLOR = 0xff9a3c;
export const COMET_POSITION = { x: 7.5, y: 2.2, z: -18 } as const;
export const HERO_SHIP_POSITION = { x: 9, y: -2.5, z: -14 } as const;
export interface CosmicBackdrop {
  readonly group: Group;                 // group.name === 'cosmic-backdrop'; 28 objects total
  readonly nebulaTexture: DataTexture;   // 256 x 128 RGBA, SRGBColorSpace
  readonly asteroids: readonly Mesh[];   // length 7
  readonly meteors: readonly Group[];    // length 3 (head + tail each)
  readonly comet: Group;                 // name === 'comet'; comet-head/comet-tail
  readonly heroShip: Group;              // name === 'hero-ship'; seven meshes, rotation.y = PI/2
  update(dtMs: number, reducedMotion?: boolean): void;
  dispose(): void;
}
export function createCosmicBackdrop(random: () => number): CosmicBackdrop;

// render/cube-view.ts (additive)
export const MINI_CUBE_BEVEL_SEGMENTS = 2;
export const MINI_CUBE_BEVEL_RADIUS = 0.08;

// render/particles.ts (additive)
export const PARTICLE_COLOR = 0xffcc66;

// render/scene.ts (additive)
export const COSMIC_ANCHOR_OFFSET_X = 6;   // presentation-only screen-right anchor offset
export const COSMIC_ANCHOR_OFFSET_Y = 4;   // presentation-only screen-up anchor offset
export interface SceneView {
  // ...existing members unchanged...
  readonly cosmicBackdrop: CosmicBackdrop;
}

// ui/icons.tsx
export interface IconProps { className?: string }
// each icon renders <svg aria-hidden="true" focusable="false" data-icon="<name>">
```

**CSS contract (pinned tokens, `game-view.css` `:root` — exactly one block, nine declarations):**

```css
--panel-bg-top: rgba(5, 11, 24, 0.86);
--panel-bg-bottom: rgba(10, 22, 44, 0.8);
--panel-border: rgba(124, 246, 255, 0.62);
--panel-glow: rgba(124, 246, 255, 0.35);
--panel-radius: 1rem;
--users-badge-top: #d63a2f;
--users-badge-bottom: #a51f1f;
--coin-gold: #ffcc66;
--upgrade-green: #16a34a;
```

`ui/theme.ts` exports the same nine literal values as `PANEL_BACKGROUND_TOP`, `PANEL_BACKGROUND_BOTTOM`, `PANEL_BORDER`, `PANEL_GLOW`, `PANEL_RADIUS`, `USERS_BADGE_TOP`, `USERS_BADGE_BOTTOM`, `COIN_GOLD`, `UPGRADE_GREEN`; `game-view.css.test.ts` reads both and asserts equality. `HUD_TEXT`, `HUD_BACKGROUND`, `ACCENT`, `PAGE_BACKGROUND` remain exactly as pinned by predecessor features.

**Panel contract (one grouped rule, exact declarations):**

```css
.hud-panel,
.upgrades-panel,
.customization-panel,
.user-panel .users-list {
  border: 2px solid var(--panel-border);
  border-image: none;
  border-radius: var(--panel-radius);
  background: linear-gradient(180deg, var(--panel-bg-top), var(--panel-bg-bottom));
  box-shadow: 0 0 24px var(--panel-glow);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  backdrop-filter: blur(12px) saturate(1.2);
  clip-path: none;
  filter: none;
}
```

**Pseudo-element reset (one grouped rule, exact selector list):**

```css
.hud-panel::before,
.hud-panel::after,
.upgrades-panel::before,
.upgrades-panel::after,
.customization-panel::before,
.customization-panel::after,
.user-panel .users-list::before {
  content: none;
}
```

**Badge contract (specificity-safe, exact declarations):**

```css
.user-panel > .users-badge {
  border: 2px solid var(--panel-border);
  border-image: none;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--users-badge-top), var(--users-badge-bottom));
  color: #ffffff;
  clip-path: none;
  filter: none;
  min-height: 44px;
  padding: 0.5rem 1rem;
}
.user-panel > .users-badge:hover {
  color: #ffffff;
  box-shadow: none;
  filter: brightness(1.08);
}
.user-panel > .users-badge:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

**Layout contract:** base corners are owned by unchanged `app.css`: `.hud-panel` via `main > section` (top-left), `.user-panel` (top-right), `.customization-toggle` (bottom-left), `.upgrades-panel` (bottom-right); phase announcement bottom-center; all offsets keep `env(safe-area-inset-*)`. `game-view.css` owns only the ≤720px bottom-band overrides (stacking + `main[data-customization-open='true'] .upgrades-panel { display: none; }`), the base `.upgrades-panel { max-width: min(22rem, calc(50vw - 1.5rem)); }`, and the T17 mobile top-band reserves (`.hud-panel` `max-width` with a 9rem pill reserve including both safe-area insets, `.user-panel { max-width: 8.5rem; }`, mobile `.users-badge` padding/font) — no position declarations are added. The four panels must not cover the cube's front face at ≥1280×720, and the HUD and users pill must not intersect at ≤720px.

**Scene contract:** `SceneView` exposes `readonly cosmicBackdrop: CosmicBackdrop`; `scene.background` is that backdrop's `DataTexture`; `cosmic-backdrop` is one child group appended ninth; starfield (`Points`) and `background-life` group remain one each; `scene.children` is 9 without a world and 10 with one remote world; `countObjects(scene)` baseline is 60; disposal leaves `scene.children === []` and `scene.background === null`. The group's `position` is the live camera `x`/`y` plus `COSMIC_ANCHOR_OFFSET_X = 6` / `COSMIC_ANCHOR_OFFSET_Y = 4` on every `update` (construction included) with `z = 0`; its children keep the pinned local `COMET_POSITION`/`HERO_SHIP_POSITION` values, so the comet projects at a 24.23° camera-relative screen angle (outside the measured cube silhouette) and the hero's world `x` stays right of the cube and its world `z` stays `< -4` from every slot (T16). The offsets are presentation-only constants: no random draw, game state or protocol value.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/ui/theme.ts` | Edit | Additive nine reference panel/badge/coin/upgrade tokens; correct the black-canvas header comment |
| `src/frontend/src/ui/theme.test.ts` | Edit | Contrast gates over black and white worst-case backdrops; nine token literals |
| `src/frontend/src/ui/game-view.css` | New | Rounded cyan gameplay HUD chrome, pills/circles, responsive stacking/hide, mobile top-band reserve (T17), reduced motion |
| `src/frontend/src/ui/game-view.css.test.ts` | New | CSS source guards for tokens, selectors/specificity, exact declarations, corners from `app.css`, stacking, mobile top-band reserve (T17), absence guard |
| `src/frontend/src/ui/icons.tsx` | New | Inline SVG icon set |
| `src/frontend/src/ui/icons.test.tsx` | New | Icon accessibility/name contract |
| `src/frontend/src/ui/Hud.tsx` | Edit | HUD panel class, five icon rows, data hooks preserved |
| `src/frontend/src/ui/Hud.test.tsx` | Edit | New SSR golden markup and icon/data assertions |
| `src/frontend/src/ui/UserPanel.tsx` | Edit | Orange pill badge, group icon, rounded list class |
| `src/frontend/src/ui/UserPanel.test.tsx` | Edit | Updated golden markup; behavior retained |
| `src/frontend/src/ui/UpgradesPanel.tsx` | Edit | Row/cost icons, circular buy button class |
| `src/frontend/src/ui/UpgradesPanel.test.tsx` | Edit | Updated markup + existing affordability/max-level assertions |
| `src/frontend/src/ui/CustomizationToggle.tsx` | New | Gear + ship icon customization button |
| `src/frontend/src/ui/CustomizationToggle.test.tsx` | New | Label, icons, aria-expanded, callback |
| `src/frontend/src/App.tsx` | Edit | Import `game-view.css` after `app.css`; use `CustomizationToggle`; `data-customization-open` |
| `src/frontend/src/App.test.tsx` | Edit | Full-shell golden markup/layout/CSS wiring/attribute |
| `src/frontend/src/render/nebula.ts` | New | Procedural `DataTexture` nebula and palette constants |
| `src/frontend/src/render/nebula.test.ts` | New | Dimensions/format/determinism/hue ranges/variance |
| `src/frontend/src/render/cosmic-backdrop.ts` | New | Asteroids, meteors, comet, hero ship, nebula ownership |
| `src/frontend/src/render/cosmic-backdrop.test.ts` | New | Counts/names/colours/positions/motion/reduced-motion/disposal |
| `src/frontend/src/render/scene.ts` | Edit | Wire cosmic backdrop, background texture, update/dispose; pin the `COSMIC_ANCHOR_OFFSET_X`/`_Y` presentation offsets and camera-anchor the group x/y (T16) |
| `src/frontend/src/render/scene.test.ts` | Edit | Background/child/object counts/retained starfield/background-life/disposal/palette literals; camera+offset anchor, comet screen-angle, hero offset and right-side/behind-cube assertions (T16) |
| `src/frontend/src/game/progression.ts` | Edit | Retune first style to emerald green |
| `src/frontend/src/game/progression.test.ts` | Edit | Pin exact palette; ids/order unchanged |
| `src/frontend/src/render/world.test.ts` | Edit | Update style-0 body/tile/fallback literals (T12) |
| `src/frontend/src/render/cube-view.ts` | Edit | Rounded tile geometry |
| `src/frontend/src/render/cube-view.test.ts` | Edit | Pin `RoundedBoxGeometry`, radius/segments, body unchanged, style-0 literals |
| `src/frontend/src/render/particles.ts` | Edit | Gold burst material color |
| `src/frontend/src/render/particles.test.ts` | Edit | Pin `PARTICLE_COLOR`; pool/fade unchanged |
| `README.md` | Edit (docs pass) | Only if the visual presentation needs a README note |
| `docs/features/README.md` | Propose only (orchestrator applies) | T15 records the row diff in `build-log-T15.md`; not edited by the builder |

T16/T17 add **no new files and no new dependencies**: they re-open the already-listed `scene.ts`/`scene.test.ts` (T16, depends on completed T11) and `game-view.css`/`game-view.css.test.ts` (T17, depends on completed T2). `spec.md` remains untouched at r2.

Explicitly not touched: `ui/app.css`, `ui/app.css.test.ts` (auth/metallic chrome and base corners stay), `game/engine.ts`, `game/session.ts`, `multiplayer/**`, `src/backend/**`, compose files, Dockerfiles, lockfiles.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Split gameplay chrome into a new `game-view.css` imported after `app.css` | Keeps the accepted metallic auth surfaces untouched, isolates the new visual system, avoids rewriting a heavily guarded 824-line stylesheet, and makes rollback one import removal | Rewrite `app.css` in place (high test churn/regression risk); inline styles (not maintainable/testable) |
| 2 | Use specificity-safe class/descendant selectors instead of `!important` | `.user-panel > .users-badge` (0,2,0) beats `.user-panel > button` (0,1,1); `.user-panel .users-list::before` (0,2,1) beats `.user-panel section::before` (0,1,2); `.upgrades-panel`/`.customization-panel`/`.hud-panel` beat `main > section`. The exact selectors and declarations are pinned in AC-3/AC-5 and guarded by `game-view.css.test.ts` | `!important` (rejected: hard to override later); plain `.users-badge`/`.users-list::before` (rejected: lose the cascade) |
| 3 | Procedural `DataTexture` nebula rather than an image asset | No dependency/licensing review, deterministic in node tests, offline, tiny (256×128), and the reference is painterly rather than a precise asset | External nebula image (asset/licensing; Q-6); CSS gradients behind an opaque canvas (invisible); shader background (harder to test) |
| 4 | One `cosmic-backdrop` group owning asteroids/meteors/comet/hero ship | Bounded drawables (28 objects), one update/dispose seam, easy scene assertions; keeps `background-life` untouched | Extend `background-life` (would rewrite accepted tests); many scene children (harder to test) |
| 5 | `RoundedBoxGeometry` from `three/examples/jsm` for tiles only | Delivers the reference's beveled glossy look with no new npm package, following the existing post-processing examples precedent; body stays cheap `BoxGeometry` | Keep sharp `BoxGeometry` (less fidelity); custom bevel geometry (more code/risk) |
| 6 | Retune `obsidian-neon` palette, keep its id | The first level must read green immediately; the wire id and level cycle stay stable, so multiplayer/saved style ids remain valid | Add/rename a style (changes the server style sequence and tests); change level order (gameplay-visible) |
| 7 | Decorative hero ship on the right, cursor ship retained | Matches the reference composition without changing input/picking; the accepted spaceship cursor and customization remain | Replace cursor ship (regression); broadcast ship state (protocol work) |
| 8 | Keep camera rest/travel and centred cube | Avoids changing picking, spectate, intro and travel contracts; composition fidelity comes from HUD/backdrop | Camera look-offset / closer rest pose (would ripple through accepted camera tests) |
| 9 | Manual wide/mobile/frame-time visual evidence, no browser automation | Matches project precedent and non-goals; composition/overlap/performance is inherently visual | Add Playwright/perceptual tooling (new dependency/scope) |
| 10 | Auth surfaces stay sharp/metallic | The request is about the game view; keeps theme/auth tests stable and limits scope | Restyle all menus too (Q-4; broader change) |
| 11 | Mobile bottom band stacks and hides the upgrades panel while customization is open | Guarantees no panel-to-panel overlap at 375×667/320×568 without `:has()`; the hide is driven by the local `data-customization-open` attribute and the customization panel is dismissible via the always-visible toggle | Accepted overlap limitation (weaker, user-visible); `:has()` (browser support risk); two-column shared sheet (complex) |
| 12 | No camera-anchored plane fallback for the nebula | Keeps AC-10/AC-11 exact (one texture-backed `scene.background`, no extra drawable); an invisible texture is a genuine unknown that a spec revision should decide, not a task-level improvisation | Add a plane and loosen AC-10/AC-11 (extra drawable, two sources of background truth) |
| 13 | Camera-anchor the `cosmic-backdrop` group's `x`/`y` each update with pinned presentation offsets (T16, B-1) | The camera follows the player's slot, so a world-fixed backdrop changes screen position per slot and occludes the comet/hero at slot 1. Anchoring the group to `camera + (COSMIC_ANCHOR_OFFSET_X, COSMIC_ANCHOR_OFFSET_Y, 0)` with pinned `6`/`4` (T16 second attempt; the zero-offset anchor left the comet at 14.0°, inside the 14.7°–16.6° silhouette, and the hero under the 1280×720 panel) gives a screen-stable composition: the comet at 24.23° camera-relative and the hero at cube-relative `(15, 1.5, −14)`, whose 1280×720 projection clears the panel top while staying right of the cube. `z` stays 0 so world depth is unchanged; no camera/picking change, no new dependency, no random draw; AC-11 local positions/constants and the `z < -4` depth remain pinned | Move the comet/hero constants per slot (breaks for arbitrary `maxUsers`/ring positions); zero-offset camera anchor (T16 first attempt: comet occluded at every wide size, hero under the panel at 1280); offset the camera (Q-8 contract change, picking/spectate ripple); broadcast a per-client backdrop (Q-10, protocol work) |
| 14 | Mobile top band: resize both surfaces, never reposition them (T17, B-2) | A `box-sizing: border-box` HUD with a 9rem reserve in its `max-width` (including both safe-area insets) plus an 8.5rem `.user-panel` cap and slightly reduced badge padding/font guarantees an 8 px horizontal gap at 320/375 and any safe area, with no `position`/`top`/`right`/`bottom`/`left` declaration — so `app.css` keeps the four corners (AC-2) and the desktop layout (768×1024+) is untouched; the guarantees are source-testable | Move the pill below the HUD (`top`/`margin` override — position-like, HUD-height dependent); shrink text only (not guaranteed at 320); hide the pill (AC-5 regression); two-row redesign (scope) |

## Risks & mitigations

- **Pixel fidelity is subjective / reference unseen by the planner** → pin every measurable token/count/colour/position in ACs, record manual screenshots at named sizes, and keep Q-1 open for approval-time correction.
- **CSS specificity/import-order regressions** → exact specificity-safe selectors pinned in AC-3/AC-5 and the table above; guards assert the selector forms and exact declarations (`border-image: none`, `clip-path: none`, `filter: none`, `content: none` on sheen/scanline).
- **Contrast over a bright nebula** → panels use ≥0.8-alpha dark fills; `theme.test.ts` computes contrast over both black and white backdrops, not just the old black page.
- **`scene.background` texture not visible through the post-processing composer** → manual check in T11; if invisible, T11 reports blocked with evidence and a spec revision decides the fallback. No plane is added under this plan.
- **Scene test churn from the new child group/background and palette** → T11 owns `scene.test.ts` and updates every exact child/object count (8→9, 9→10, `baselineObjects` 32→60) and the two style-0 literals in one pass; T12/T13 own the `world.test.ts`/`cube-view.test.ts` literals. Starfield/background-life helpers stay intact, and `createCosmicBackdrop` is constructed after them so the seeded sequences do not shift.
- **Rounded instanced geometry cost** → segments pinned to 2 and only tile geometry rounded; body stays `BoxGeometry`; `COSMIC_BACKDROP_OBJECT_COUNT` fixed at 28. AC-22 records the actual frame time.
- **Hero ship/comet overlap remote cubes or HUD** → fixed decorative z-depth behind the cube plane (`z < -4`), pinned local right-side positions, no picking; T16 anchors the group to `camera + (6, 4, 0)` so the screen composition holds from every slot; the new numeric composition clears the cube silhouette (comet 24.23°) and the 1280×720 upgrades panel (hero projection lower edge ≈334 px vs the panel top ≈360 px); manual 1280/1920/2560 check from slot 1, slot 2 and the 10-user ring.
- **Cosmic composition regresses per slot after T16** → the group's `x`/`y` follows the live camera plus the pinned presentation offsets each `update` (construction included), so the comet/hero keep their screen-right/up composition from every slot; `scene.test.ts` pins the anchored position at the observed ±7.64 slots, a 10-user ring slot and a travel frame, and asserts the comet's ≥20° screen angle, the hero's exact cube-relative `(15, 1.5)` offset and world `z < -4`; the existing seeded starfield/background-life/child-count assertions must stay green (no random draw is added).
- **Mobile top-band fix reflows the reference corners** → T17 adds only `box-sizing`/`max-width`/`padding`/`font-size` in the existing ≤720px block (no position declaration); `game-view.css.test.ts` asserts the exact rules, the 9rem − 8.5rem = 0.5rem reserve arithmetic and the absence of position declarations, while the base `app.css` corner reads and every AC-5 base rule stay exact; manual 375/320/768 checks confirm the gap and the unchanged desktop corners.
- **AC-22 measurement noise** → the B-3 protocol below: three clean runs per measurement, report every run plus median/worst, and a host-hitch caveat only with corroborating evidence and median compliance; otherwise T15 stays blocked. AC-22 is never edited.
- **Strict SSR golden strings** → `App.test.tsx` centralizes the shell in `shellHtml`; update that helper once in T8, then all derived tests stay exact (no wildcard matchers).
- **Coverage drop from new modules** → every new module ships its test file in the same task; final `npm run coverage` gates both workspaces.
- **Scope creep into gameplay** → AC-1/AC-20 diff gates on engine/session/multiplayer/backend/containers plus every other `game/**` file; cube topology and camera contracts stay pinned.
- **Mobile hide rule surprises** → Q-11 records the choice; the toggle stays visible, the customization panel is dismissible, and the upgrades panel returns on close. Manual checks at 375×667 and 320×568.

## Build-discovered amendments (T15)

T15's manual verification (evidence under `docs/features/reference-image-game-view/evidence/`) found three issues the approved acceptance criteria cover only in substance. The spec stays at r2 and `spec.md` is **not edited**; AC-1 … AC-22 remain authoritative and are not relaxed. T16 closes B-1 (its first attempt with a zero-offset camera anchor blocked; the amended T16 adds pinned camera-relative offsets), T17 closes B-2, and T15's re-run closes B-3.

### B-1 — The cosmic composition is world-anchored while the camera follows the player

**Root cause.** `createSceneView` leaves the `cosmic-backdrop` group at the world origin; `createCosmicBackdrop` pins the comet at local `(7.5, 2.2, -18)` and the hero ship at `(9, -2.5, -14)`. The camera rests over the player's server slot (`applyRestPose` → `(ownX, ownY, 12)`), so the backdrop's screen position depends on the slot. At the observed 2-user local ring (own slot `(±7.64, 0)`) the comet sits at world `x = 7.5` for slot 1 — directly behind the cube — and the hero at `x = 9` is occluded too at 1280/1920/2560 (`1280x720.png`, `1920x1080.png`, `2560x1280.png`); from slot 2 (`slot2-1920x1080.png`) both render on the right. With the default 10-user ring (`radius = 10 · 24 / 2π ≈ 38.2`) the group is pushed far left/off-screen. A world-fixed backdrop cannot satisfy the reference composition for every slot.

**Decision (T16 — camera-relative cosmic composition).** Follow the same camera-anchoring contract the starfield uses for its `Points`, plus pinned presentation offsets: in `SceneView.update`, set `cosmicBackdrop.group.position.set(camera.position.x + COSMIC_ANCHOR_OFFSET_X, camera.position.y + COSMIC_ANCHOR_OFFSET_Y, 0)`, and set the same initial anchor at construction so the first rendered frame is already correct. The pinned offsets are `COSMIC_ANCHOR_OFFSET_X = 6` and `COSMIC_ANCHOR_OFFSET_Y = 4`.

**Why the offsets (T16 second attempt).** The first attempt copied only the camera `x`/`y` (`offset = 0`). That made every slot identical, but the comet stayed at camera-relative `(7.5, 2.2, −18)`: at depth 30 its screen angle is `atan(7.5 / 30) = 14.0°`, inside the measured `14.7°–16.6°` cube silhouette at every wide size, and the 1280×720 hero centre ≈`(907, 434)` sat under the upgrades panel (`x ≥ 875`, `y ≥ 360`). Evidence: `build-log-T16.md`, `evidence/t16-slot1-*.png`, `t16-slot2-*.png`, `t16-ring10-*.png`. The pinned offsets clear both: the comet angle is `atan((7.5 + 6) / 30) = 24.23°` (7.6° beyond the widest measured silhouette edge), and the hero moves to camera-relative `(15, 1.5, −14)`, whose 1280×720 projection centres at ≈`(1085, 316)` with a lower edge ≈`334 px` — right of the cube (cube right edge ≤≈870 px) and ≈26 px above the panel top (≈360 px); at 1920/2560 the panel top is lower in the frame, so the ship stays above it.

The children keep their local positions, rotations, colours, counts and `z < -4` depth (`COMET_POSITION`/`HERO_SHIP_POSITION` are group-local), so from every slot the comet/hero stay at the same screen composition, behind the cube. The offsets are presentation-only: no `random` draw, no game state, no protocol value, no camera/picking change. The camera rest/travel constants, the nine-child scene graph, the 28-object count and the disposal contract are unchanged. This is **not** the AC-10-rejected camera-anchored background plane: `scene.background` remains the single nebula `DataTexture`; only the decorative group's transform follows the camera. No new dependency, file, or backend/container change.

**AC note (unchanged).** AC-10/AC-11 are unaffected: one group, 28 objects, the same colours and local positions. The two offsets live in `scene.ts` and are applied to the group only; `cosmic-backdrop.ts` and the AC-11 `COMET_POSITION`/`HERO_SHIP_POSITION` constants are untouched. AC-17 remains the wide-screen no-occlusion check. At narrow mobile/tablet widths the pinned 50° lens pushes the right-side decorations out of frame; that follows from the accepted camera/FOV contract (Q-8), not an AC-11 failure, and mobile pass/fail remains AC-18. `spec.md` is not edited.

### B-2 — Mobile top-band overlap at 375×667 / 320×568

**Root cause.** The HUD (`main > section`, top-left, intrinsic width ≈199 px at 375 and ≈184 px at 320) and the users pill (top-right, ≈152 px) both start at `top: 1rem`; their rectangles intersect at both sizes (`375x667.png`, `320x568.png`). AC-18 covers viewport fit and the bottom band but does not name this top-band collision.

**Decision (T17 — mobile top-band spacing).** Keep both reference corners and reserve the pill's width in the top band with **sizing only**. In the existing single `@media (max-width: 720px)` block add:

- `.hud-panel` → `box-sizing: border-box;` (so `max-width` includes its padding and 2px border — there is no global `box-sizing` reset) and `max-width: calc(100vw - 2rem - 9rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));` (alongside the existing padding/font declarations);
- `.user-panel` → `max-width: 8.5rem;`;
- `.user-panel > .users-badge` → `padding: 0.5rem 0.5rem; font-size: 0.8rem;`.

The 9rem reserve exceeds the 8.5rem cap by 0.5rem (8 px), so the HUD's right edge stays at least 8 px left of the pill's left edge at every width ≤720 px and for any safe-area inset; if the pill text wraps at a very narrow width it grows vertically instead of intersecting. No `position`/`top`/`right`/`bottom`/`left` declaration is added, so `app.css` keeps the four corners and AC-2's "only position declarations are the bottom-band overrides" stays literally true. The base badge rule (AC-5's exact declarations), the base `.upgrades-panel` rule, the bottom-band overrides and the hide rule are unchanged; >720 px (including 768×1024) is unaffected.

**AC note (unchanged).** AC-18's text is not edited; the reserve is an additional source-testable fit guarantee for the same "surfaces stay within the viewport / do not overlap" property. AC-2 (base corner ownership) and AC-5 (base badge declarations) remain exactly as approved.

### B-3 — AC-22 evidence protocol

The first T15 run measured 1280×720 averages 16.666/16.666 ms, 1920×1080 averages 16.694 ms (idle) / 16.778 ms (rapid), p95 16.8 ms — a 0.078 ms miss with repeated host hitches. AC-22 is unchanged (average ≤ 16.7 ms, p95 ≤ 33 ms at both sizes). T15's re-run after T16/T17 follows this protocol:

1. Run each of the four measurements (1280×720 idle, 1280×720 rapid, 1920×1080 idle, 1920×1080 rapid) **three consecutive times**, each from a fresh page load, recorder closed, no other heavy process on the host.
2. Record every run's average and p95 plus the median and worst per measurement in `build-log-T15.md`, together with the object/geometry growth AC-22 requires (scene objects 32 → 60, 28 backdrop objects, 22 decorative meshes, rounded tile geometry).
3. A pass may include a documented environment caveat for an outlier run only when the median and at least two of three clean runs meet both limits and the miss is corroborated by a recorded host stall (browser/GC or host scheduling evidence). The caveat must not hide a reproducible regression.
4. If the median misses, or a miss reproduces without a host-stall explanation, T15 stays `blocked` with the measurements; the orchestrator schedules a follow-up optimization task (Q-9 quality tier or a concrete optimization). AC-22 is never relaxed and no measurement is edited.

## Rollback / no-regression strategy

- **No data or protocol migration**: there is nothing to roll back server-side or in persistence. Every change is source/CSS/test.
- **Task-isolated reverts**: reverse dependency order. Removing the `game-view.css` import restores the accepted metallic HUD instantly while leaving all component behavior intact; removing the scene backdrop wiring restores the black background; palette, bevel, particle tint and test-literal updates are independent single-file changes (T12/T13/T11). T16's revert is the `COSMIC_ANCHOR_OFFSET_X`/`_Y` constants plus the one-line anchor formula (construction + `update`): setting both offsets to `0` restores the first-attempt zero-offset camera anchor, and removing the anchor entirely returns the group to world-anchored — both with no data/camera change. T17's revert is the mobile top-band declarations (`.hud-panel` `box-sizing`/`max-width`, `.user-panel` `max-width`, and the badge padding/font); desktop is never affected because they live only in the ≤720px block.
- **Feature branch**: work on `feat/reference-image-game-view`; no merge until accepted; `BASE` recorded for all diff gates.
- **Test-first guards**: `app.css.test.ts` remains unmodified and green (auth chrome and base corners untouched); existing engine/session/multiplayer tests run unchanged; `scene.test.ts` updates are limited to the new child/background/palette expectations.
- **Manual rollback check**: after each visual task, the previous screenshot set remains reproducible so a regression can be attributed to one task.

## Verification strategy

- **Per task**: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (workspace pre-gate). Every behavior-change task owns its test files and adds concrete assertions. T16 owns `scene.ts`/`scene.test.ts`; T17 owns `game-view.css`/`game-view.css.test.ts`.
- **Final gate (`T15`)**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥80% all metrics both workspaces), `npm run build`, after **T16 and T17 are complete** (T15 depends on both).
- **Diff gates (`T15`)**: record `BASE` (`BASE=$(git merge-base main HEAD)` or the pre-feature fork point), then paste the output of both commands for each protected set:
  - engine/session/multiplayer/backend/container/dependency set: `git diff --exit-code "$BASE"...HEAD -- <paths>` and `test -z "$(git status --porcelain -- <paths>)"`;
  - `game/**` excluding `progression.ts`/`progression.test.ts`: the glob+exclude diff and status commands from AC-1;
  - `app.css`/`app.css.test.ts`: the diff and status commands.
- **Manual visual proof**: with `podman compose up` (or `npm run dev`), record screenshots/pass-fail at 1280×720, 1920×1080, 2560×1280, 2560×1080, 375×667, 320×568 and 768×1024; check nebula colours, green cube, rounded panels/icons, no central-cube occlusion on wide screens, panels within the mobile viewport, no bottom-band overlap, a usable upgrade row, focus rings and reduced-motion freeze. The cosmic composition is checked from **slot 1 (own x ≈ +7.64) and slot 2 (x ≈ −7.64)**, plus a 10-user ring slot (radius ≈ 38.2) where the local session allows: the orange comet is upper-right and fully outside the cube silhouette (its camera-relative screen angle is 24.23° vs the measured ≤16.6° silhouette), and the blue/orange hero ship is right of the cube and visible above/right of the upgrades panel at 1280×720 (centre ≈`(1085, 316)`, lower edge ≈334 px vs the panel top ≈360 px), clear at 1920/2560, and never behind the cube or off-screen on the wide sizes. Mobile pass/fail remains the AC-18 fit/overlap check (the narrow-frame note above).
- **Mobile top-band proof (T17)**: at 375×667 and 320×568 with the customization panel closed and open, the HUD's right edge and the users pill's left edge are measured ≥ 8 px apart (screenshot + devtools rects), no horizontal scrollbar appears, all four surfaces stay inside the viewport, the toggle and upgrades panel do not overlap, and an upgrade row is clickable; at 768×1024 and 1280×720 the four base corners and the pill's one-line desktop form are unchanged.
- **Performance proof**: AC-22's 10-second idle/rapid-click `requestAnimationFrame` traces at 1280×720 and 1920×1080 (average ≤ 16.7 ms, p95 ≤ 33 ms) plus the object/geometry growth note in `build-log-T15.md`, measured with the B-3 protocol (three clean runs per measurement, report every run plus median/worst; a host-hitch caveat only with corroborating evidence and median compliance; otherwise blocked).
- **Documentation pass**: T15 confirms/updates `README.md` only if needed and records a proposed `docs/features/README.md` row diff in `build-log-T15.md` for the orchestrator to apply; `docs/architecture/*` and `docs/product/*` need no change (no stack, container, term, or product behavior change). See `docs/architecture/documentation.md`.

## Open questions

See `spec.md` § Open questions (Q-1..Q-11). Planning defaults: keep cube topology/camera; retune first style; procedural art; gameplay HUD rounded while auth stays metallic; local-only visuals; no webfont; manual visual/frame-time evidence; mobile bottom-band stacking with the upgrades panel hidden while customization is open (Q-11).

No new spec-level question is opened by the T15 amendments. B-1/B-2 are implementation fixes inside the approved ACs (T16/T17); B-3 is an evidence-protocol decision (median/worst over clean runs, caveat only with corroboration), and a reproducible miss escalates to a follow-up optimization under Q-9 rather than an AC change. T16's pinned offsets (`6`/`4`) are presentation constants chosen from the projected geometry; they are not a spec-level question and do not change AC-11's local constants.

## Revision history

- r1 — 2026-11-07 — initial plan (planning phase).
- r2 — 2026-11-07 — spec r2 alignment after review r1 (F1–F17), including the scene counts/order, palette test ownership, mobile bottom-band/hide rule and AC-22 frame-time check.
- r3 — 2026-11-07 — T15 build-discovered amendments: T16 camera-anchored cosmic composition (B-1), T17 mobile top-band spacing (B-2), AC-22 evidence protocol with clean-run median/worst (B-3). `spec.md` unchanged at r2; no acceptance criterion altered.
- r4 — 2026-11-07 — T16 amendment after the zero-offset camera anchor blocked: pinned presentation offsets `COSMIC_ANCHOR_OFFSET_X = 6` / `COSMIC_ANCHOR_OFFSET_Y = 4` (comet 24.23° vs the 14.7°–16.6° cube silhouette; 1280×720 hero projection clears the upgrades panel), with the construction/update formula, test expectations and manual/verification wording updated. `spec.md` unchanged at r2; AC-11 local positions/constants and all acceptance criteria unchanged.
