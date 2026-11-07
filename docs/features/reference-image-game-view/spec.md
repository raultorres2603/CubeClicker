---
feature: reference-image-game-view
revision: 2
status: draft
created: 2026-11-07
updated: 2026-11-07
---

# Spec — Reference-image game view

## Summary

Adapt the running game view so it closely matches the user's reference image: a vivid purple/blue/pink nebula with stars, asteroids, meteor trails and a large orange comet; a glossy green cube wall with glowing destruction effects; a stylized blue/orange ship on the right; and four rounded, translucent, cyan-bordered HUD surfaces in the reference layout (stats top-left, users-on-server top-right, spaceship customization bottom-left, upgrades bottom-right). The raw request is *"I would like you to enhance the game's view. I would like you to adapt game to look like this image: [Image 1]. Is it possible for you?"*

**Feasibility statement.** Yes, it is possible as a visual adaptation of the existing codebase. The stack already provides everything required (React, CSS, three.js with `RoundedBoxGeometry`/post-processing examples, inline SVG), and every HUD value in the reference is backed by existing data: `Clicks`, `Faces destroyed`, `Coins`, `Cube` and `Server` come from `GameStats`/`levelIndex`/`serverId`; `Users on Server` comes from the live roster; the three upgrade rows (`Click Power`, `Cube Bonus`, `Quick Hands`) and their effects/costs already exist in `UPGRADE_CATALOG`. No new dependency, service, protocol, or external image asset is needed.

Two approximations are explicit rather than hidden: (1) the reference's roughly 10-column × 12-row wall cannot be reproduced literally because the game's board is a six-faced cube with a 3–7 mini-cube grid per face; the feature keeps the accepted cube topology and makes the front face read as a glossy green wall instead. (2) The painterly nebula/comet artwork cannot be pixel-identical without an external image; it is approximated procedurally in code. Both are recorded as non-goals/open questions. The reference's green debris is represented by the existing green tile pop; sparks are tinted gold, and no separate green debris particle system is added (Q-1).

## Reference mapping

| Reference element | Existing backing / component | Classification | This feature |
| --- | --- | --- | --- |
| Wide ~2:1 arcade viewport | `fullscreen-responsive-layout`; `App.tsx`, `GameCanvas.tsx`, `app.css` | Existing behavior | Retained; verify at 2:1 and mobile sizes |
| Vivid purple/blue/pink nebula | `scene.background` black + `render/starfield.ts` | **New visual** (no backing) | Procedural `DataTexture` nebula with exported purple/blue/pink stops |
| Scattered stars | `render/starfield.ts` (1200 stars, twinkle, travel expansion) | Existing behavior | Retained unchanged |
| Small asteroids | None | **New decorative** | 7 procedural meshes in a backdrop group |
| Glowing meteor trails | `render/background-life.ts` shooting stars (small white spheres) | Existing partial | Add 3 procedural glowing meteors; keep shooting stars |
| Large orange comet on the right | None | **New decorative** | 1 procedural comet (orange head + tail) at a pinned right-side position |
| Glossy green cube wall (~10×12) | `render/cube-view.ts` cube (body + six `InstancedMesh` faces, 3–7 grid), `game/progression.ts` first style | Existing behavior + **restyle** | Retune first style to emerald green; add beveled tile geometry; **10×12 topology not replicated** (Q-2) |
| Shattering cubes, golden spark bursts, green debris | `hideMiniCube` pop/shrink, `render/particles.ts` burst, `render/world.ts` remote removals | Existing behavior | Retain; tint sparks gold; green tile pop represents the debris (no new debris particles) |
| White cursor with click burst | `render/spaceship.ts` spaceship cursor + particle burst | Existing behavior (different design) | Retain spaceship cursor; do not add a white OS cursor |
| Top-left HUD: Clicks / Faces destroyed / Coins / Cube / Server | `ui/Hud.tsx`; `GameStats`, `levelIndex`, `serverId` | Existing data | Restyle panel; add row icons |
| Top-right "Users on Server" red/orange pill | `ui/UserPanel.tsx`, live `world.members` roster | Existing data | Restyle as orange/red pill; group icon |
| Bottom-left "Spaceship customization" button | `App.tsx` toggle + `SpaceshipCustomizationPanel` | Existing behavior | New `CustomizationToggle` with gear + ship icons; restyle |
| Bottom-right upgrades rows | `ui/UpgradesPanel.tsx`, `UPGRADE_CATALOG`, `upgradeCost` | Existing data (names, levels, effects, costs 10/50/25) | Restyle; add row/cost icons and green circular `+` |
| Blue/orange spaceship flying right | `render/background-life.ts` distant ships + spaceship cursor | Existing partial | Add one decorative hero ship at a pinned right-side position; no gameplay effect |
| `Cube 1` / `Server 1` values | `levelIndex + 1` / `world.serverId` | Existing data | Retained |
| `Faces destroyed` / `Coins` / `Clicks` values | `GameStats.clicks`, `.facesDestroyed`, `.coins` | Existing data | Retained |
| `Click Power`, `Cube Bonus`, `Quick Hands` | `UPGRADE_CATALOG` (`mini_cube_value`, `cube_value`, `speed_window`) | Existing behavior/data | Retained; no balance change |

## User stories

- As a player, I see a colorful, alive space backdrop with a nebula, stars, asteroids, meteors and a comet, so the game view matches the reference's arcade sci-fi mood.
- As a player, the cube reads as a glossy green wall of beveled mini-cubes with golden destruction sparks, so clicking feels impactful and matches the reference.
- As a player, I see a stylized blue/orange ship on the right and a matching spaceship cursor, so the scene reads as a spaceship game.
- As a player, the stats HUD, users badge, customization button and upgrades panel are rounded, translucent, cyan-bordered surfaces with icons, so the HUD matches the reference and stays readable.
- As a player who prefers reduced motion, all new decorative motion freezes and existing reduced-motion behavior is preserved.
- As a keyboard/screen-reader player, labels, focus rings, tap targets and contrast remain intact, so the visual overhaul does not reduce accessibility.

## Acceptance criteria

Verification notes: "frontend" means `src/frontend`; "gameplay surfaces" means `.hud-panel`, `.user-panel > .users-badge`, `.user-panel .users-list`, `.upgrades-panel`, `.upgrade-row`, `.upgrade-buy`, `.customization-toggle`, `.customization-panel`. "CSS guard" means a source-reading assertion in `game-view.css.test.ts` (the workspace runs Vitest in `node`, so CSS is verified by source guards, not computed styles); selector and value matches are whitespace-tolerant. Evidence per AC is a named test file, a command, or an observable manual step recorded in the build log. Tests use concrete expected values; no wildcard matchers, snapshot-only tests, or assertion-free tests. Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace), `npm run build`, `npm run smoke` where the container environment allows.

- **AC-1 — Visual-only scope.** With `BASE` recorded in the build log (`BASE=$(git merge-base main HEAD)` or the pre-feature fork-point commit), all of the following hold for `<unchanged>` = `src/backend`, `compose.yaml`, `compose.smoke.yaml`, every `**/Dockerfile`, root `package.json`, `package-lock.json`, `src/frontend/package.json`, `src/backend/package.json`, `src/frontend/src/game/engine.ts`, `src/frontend/src/game/session.ts`, `src/frontend/src/multiplayer`:
  1. `git diff --exit-code "$BASE"...HEAD -- <unchanged>` exits 0.
  2. `test -z "$(git status --porcelain -- <unchanged>)"` succeeds (no staged, unstaged, or untracked change).
  3. `git diff --exit-code "$BASE"...HEAD -- 'src/frontend/src/game/**' ':(exclude)src/frontend/src/game/progression.ts' ':(exclude)src/frontend/src/game/progression.test.ts'` exits 0.
  4. `test -z "$(git status --porcelain -- 'src/frontend/src/game/**' ':(exclude)src/frontend/src/game/progression.ts' ':(exclude)src/frontend/src/game/progression.test.ts')"` succeeds.

  The only production non-test `src/frontend/src/game/**` change is palette data in `progression.ts` (the `CUBE_STYLES[0]` literal and its display name); `progression.test.ts` may change only for those exact expectations. Evidence: final build log with `BASE` and the pasted output of all four commands plus `git diff "$BASE"...HEAD -- src/frontend/src/game/progression.ts` showing changes confined to that literal.

- **AC-2 — Reference layout retained.** The shell keeps the canvas full-viewport and the four gameplay surfaces in their reference corners: `.hud-panel` top-left, `.users-badge`/`.user-panel` top-right, `.customization-toggle` bottom-left, `.upgrades-panel` bottom-right; the phase announcement stays bottom-center. Base corner placement is owned by unchanged `app.css` (`main > section` top-left for the HUD, `.user-panel` top-right, `.customization-toggle` bottom-left, `.upgrades-panel` bottom-right), and every offset uses `env(safe-area-inset-*)`. `game-view.css` does not duplicate those base position declarations; its only position declarations are the `@media (max-width: 720px)` bottom-band overrides (AC-18). `App.test.tsx` asserts the rendered order/classes, and `game-view.css.test.ts` reads `app.css` for the four corner declarations and asserts base `game-view.css` rules for the four surfaces contain no `position`/`top`/`right`/`bottom`/`left` declarations. Evidence: `App.test.tsx`, `game-view.css.test.ts`.

- **AC-3 — Rounded HUD chrome and token contract.** `src/frontend/src/ui/game-view.css` contains exactly one `:root` block declaring exactly these nine custom properties with these exact values: `--panel-bg-top: rgba(5, 11, 24, 0.86);`, `--panel-bg-bottom: rgba(10, 22, 44, 0.8);`, `--panel-border: rgba(124, 246, 255, 0.62);`, `--panel-glow: rgba(124, 246, 255, 0.35);`, `--panel-radius: 1rem;`, `--users-badge-top: #d63a2f;`, `--users-badge-bottom: #a51f1f;`, `--coin-gold: #ffcc66;`, `--upgrade-green: #16a34a;`. A single grouped rule with selector list `.hud-panel, .upgrades-panel, .customization-panel, .user-panel .users-list` declares exactly `border: 2px solid var(--panel-border);`, `border-image: none;`, `border-radius: var(--panel-radius);`, `background: linear-gradient(180deg, var(--panel-bg-top), var(--panel-bg-bottom));`, `box-shadow: 0 0 24px var(--panel-glow);`, `-webkit-backdrop-filter: blur(12px) saturate(1.2);`, `backdrop-filter: blur(12px) saturate(1.2);`, `clip-path: none;`, and `filter: none;`. A single grouped rule whose selector list is `.hud-panel::before, .hud-panel::after, .upgrades-panel::before, .upgrades-panel::after, .customization-panel::before, .customization-panel::after, .user-panel .users-list::before` declares `content: none;` so the metallic sheen/scanline do not paint over the rounded gameplay panels; no `.users-list::after` reset is required because `app.css` paints no `.user-panel section::after`. The nine literal values are mirrored 1:1 by exported `ui/theme.ts` constants (`PANEL_BACKGROUND_TOP`, `PANEL_BACKGROUND_BOTTOM`, `PANEL_BORDER`, `PANEL_GLOW`, `PANEL_RADIUS`, `USERS_BADGE_TOP`, `USERS_BADGE_BOTTOM`, `COIN_GOLD`, `UPGRADE_GREEN`). Evidence: `game-view.css.test.ts`, `theme.ts`/`theme.test.ts`.

- **AC-4 — HUD rows, icons and data.** `Hud` renders `class="hud-panel"` and exactly five `<p class="hud-row" data-row="...">` rows in order: `clicks`, `faces-destroyed`, `coins`, `cube`, `server`. Each row contains one inline SVG with `aria-hidden="true"`, `focusable="false"` and `data-icon` equal to `cursor`, `cube`, `coin`, `cube-level`, `server` respectively. The existing label text (`Clicks:`, `Faces destroyed:`, `Coins`, `Cube`, `Server`) and `data-stat` spans (`clicks`, `faces-destroyed`, `coins`, `cube`, `server`) are preserved; values remain `stats.clicks`, `stats.facesDestroyed`, `(stats.coins ?? 0).toFixed(2)`, `levelIndex + 1`, `serverId`. The optional minimize button remains the last child with `aria-label="Toggle HUD"` and `aria-expanded`. Evidence: `Hud.test.tsx`.

- **AC-5 — Users-on-Server badge.** The `UserPanel` toggle carries `class="users-badge"`, retains the exact text `Users on Server` and `aria-expanded`, and contains one group SVG (`data-icon="group"`, `aria-hidden="true"`, `focusable="false"`). The open list section carries `class="users-list"`. `game-view.css` declares, with the specificity-safe selector `.user-panel > .users-badge`, exactly `border: 2px solid var(--panel-border);`, `border-image: none;`, `border-radius: 999px;`, `background: linear-gradient(180deg, var(--users-badge-top), var(--users-badge-bottom));`, `color: #ffffff;`, `clip-path: none;`, `filter: none;`, `min-height: 44px;`, and `padding: 0.5rem 1rem;`. It also declares `.user-panel > .users-badge:hover` with `color: #ffffff;`, `box-shadow: none;`, `filter: brightness(1.08);` and `.user-panel > .users-badge:focus-visible` with `outline: 2px solid var(--accent);` and `outline-offset: 2px;` so the `app.css` `.user-panel > button` frame, hover colour and focus rules cannot repaint the pill. The users list gets the grouped panel treatment (AC-3). Member rows, the disabled own row, `Return to my cube`, and all callbacks are unchanged. Evidence: `UserPanel.test.tsx`, `game-view.css.test.ts`, `theme.test.ts`.

- **AC-6 — Upgrades panel rows and buy control.** Each `UpgradesPanel` `<li>` carries `class="upgrade-row"` and keeps `data-upgrade`, the `data-name`/`data-level`/`data-effect`/`data-cost` spans, and their exact texts (`Click Power`, `Cube Bonus`, `Quick Hands`; `0/10`, `0/10`, `0/5`; effects; costs `10`, `50`, `25` at level 0). Each row gains a decorative row icon (`data-icon` = `upgrade-click`, `upgrade-cube`, `upgrade-speed`), a decorative cost diamond (`data-icon="diamond"`), and a buy button with `class="upgrade-buy"`, `aria-label="Buy"`, and the existing enabled/disabled affordability and max-level semantics. `.upgrades-panel` receives the grouped panel treatment (AC-3) and additionally declares `pointer-events: auto;`, `overflow-x: hidden;`, `overflow-y: auto;`, `max-height: 60vh;`, and base `max-width: min(22rem, calc(50vw - 1.5rem));` (the auto pointer events make the internal scroll and the panel surface receive input instead of passing clicks through to the canvas). `.upgrade-buy` declares `border-radius: 50%;`, `border: 1px solid var(--upgrade-green);`, `background: var(--upgrade-green);`, `color: #ffffff;`, `min-width: 44px;`, `min-height: 44px;` and a disabled state declaring `background: rgba(22, 163, 74, 0.35);`, `color: rgba(255, 255, 255, 0.6);`, `cursor: not-allowed;`. Evidence: `UpgradesPanel.test.tsx`, `game-view.css.test.ts`.

- **AC-7 — Spaceship customization control.** New `ui/CustomizationToggle.tsx` renders `<button type="button" class="customization-toggle" aria-expanded={open}>` containing a gear SVG (`data-icon="gear"`), a ship SVG (`data-icon="ship"`), and the exact label `Spaceship customization`; clicking calls `onToggle` exactly once. `App` uses it in the welcomed branch, and `SpaceshipCustomizationPanel` still opens/closes with the same state and keeps its `aria-label="Spaceship customization"` and behaviour. `.customization-toggle` declares exactly `border: 2px solid var(--panel-border);`, `border-image: none;`, `border-radius: var(--panel-radius);`, `background: linear-gradient(180deg, var(--panel-bg-top), var(--panel-bg-bottom));`, `color: var(--hud-text);`, `clip-path: none;`, `filter: none;`, `min-height: 44px;` and `.customization-toggle:focus-visible` with the accent outline; its base placement remains the unchanged `app.css` bottom-left rule (AC-2). `.customization-panel` receives the grouped panel treatment (AC-3) and declares `pointer-events: auto;` so its scroll and controls receive input. Evidence: `CustomizationToggle.test.tsx`, `App.test.tsx`, `game-view.css.test.ts`.

- **AC-8 — Auth chrome remains metallic and sharp.** The existing `app.css` "no rounded chrome" guard continues to pass unchanged: every `border-radius` declaration in `app.css` is `0`. The new nonzero radii exist only in `game-view.css` on the gameplay surfaces listed in AC-3/AC-5/AC-6/AC-7. `game-view.css` contains no `.auth-panel`, `.auth-button`, `.auth-input`, `.verification-pending`, `.connection-banner`, or `.phase-announcement` selector (source-guard regex on selector names, not comment text), so the banner and phase announcement are not restyled. Evidence: `app.css.test.ts` unchanged, `game-view.css.test.ts`.

- **AC-9 — Procedural nebula texture.** `render/nebula.ts` exports `createNebulaTexture(random: () => number): DataTexture` and the named palette constants `NEBULA_PURPLE = 0x5b21b6`, `NEBULA_BLUE = 0x1d4ed8`, `NEBULA_PINK = 0xdb2777`, `NEBULA_DARK = 0x070a1a`, `NEBULA_HUE_RANGES = { purple: [250, 280], blue: [205, 240], pink: [310, 345] }`, `NEBULA_MIN_HUE_PIXELS = 100`, and `NEBULA_MIN_CHANNEL_VARIANCE = 100`. The returned texture has `width === NEBULA_WIDTH === 256`, `height === NEBULA_HEIGHT === 128`, `format === RGBAFormat`, `type === UnsignedByteType`, `minFilter === LinearFilter`, `magFilter === LinearFilter`, `colorSpace === SRGBColorSpace`, and an RGBA byte array of length `256 × 128 × 4`. Every alpha byte is `255`. The same random sequence twice produces identical `Uint8Array`s; two different sequences produce at least one differing byte. The HSL hue of each exported stop lies in its pinned range (purple 250–280°, blue 205–240°, pink 310–345°), and the generated texture contains at least `NEBULA_MIN_HUE_PIXELS` pixels in each range with saturation ≥ 0.35 and lightness in `[0.15, 0.85]` (representative signature pixels, not monochrome noise). Each RGB channel's variance exceeds `NEBULA_MIN_CHANNEL_VARIANCE = 100`. Evidence: `nebula.test.ts`.

- **AC-10 — Scene uses the nebula background.** `createSceneView` exposes `readonly cosmicBackdrop: CosmicBackdrop`, sets `scene.background` to that backdrop's `DataTexture` (`scene.background === view.cosmicBackdrop.nebulaTexture`), replacing the black `Color`, and adds exactly one `Group` named `cosmic-backdrop` to the scene. `SceneView.dispose()` sets `scene.background = null` before disposing the backdrop. No camera-anchored background plane or other fallback is added in v1: if the texture is not visible through the existing post-processing composer, the task reports blocked and a spec revision decides the fallback. Evidence: `scene.test.ts`.

- **AC-11 — Cosmic backdrop contents.** `createCosmicBackdrop(random)` returns an object with a `Group` named `cosmic-backdrop` containing exactly `COSMIC_BACKDROP_OBJECT_COUNT === 28` objects (counted with the group itself), `nebulaTexture`, exactly `COSMIC_ASTEROID_COUNT === 7` asteroids (`Mesh`), exactly `COSMIC_METEOR_COUNT === 3` meteors (each a `Group` with a head and a tail mesh), one comet (`Group` named `comet`) at `COMET_POSITION = { x: 7.5, y: 2.2, z: -18 }` (right side, `x > 0`, behind the cube, `z < -4`) containing a `comet-head` mesh whose colour is `COMET_HEAD_COLOR = 0xff8a3d` and a `comet-tail` mesh, and one hero ship (`Group` named `hero-ship`) at `HERO_SHIP_POSITION = { x: 9, y: -2.5, z: -14 }` (right side, `x > 0`, `z < -4`) with `rotation.y === Math.PI / 2`, containing exactly seven meshes: `hero-hull` with `HERO_HULL_COLOR = 0x2f6fd6`, `hero-nose`, `hero-wing-left`, `hero-wing-right`, `hero-cockpit`, and two `hero-engine` flame meshes with `HERO_FLAME_COLOR = 0xff9a3c`. All geometry/materials are procedural three.js; no loader, URL, or external asset is used besides the generated nebula `DataTexture`. No backdrop object casts shadows. Evidence: `cosmic-backdrop.test.ts`, `scene.test.ts`.

- **AC-12 — Cosmic motion, reduced motion and disposal.** `update(dtMs, reducedMotion?)` clamps `dtMs` with `Math.max(0, dtMs)`. With `reducedMotion` false and a positive `dtMs`, every asteroid, meteor, the comet and the hero ship change at least one position or rotation value; with `reducedMotion` true, none change. `dispose()` releases every geometry and material it owns, disposes the nebula texture exactly once, and removes the group from its parent. `SceneView.dispose()` sets `scene.background = null`, leaves `scene.children` empty, and is idempotent. Evidence: `cosmic-backdrop.test.ts`, `scene.test.ts`.

- **AC-13 — Green reference cube palette.** `CUBE_STYLES[0]` keeps `id: 'obsidian-neon'` (the multiplayer wire id) and becomes exactly `{ id: 'obsidian-neon', name: 'Emerald Neon', cubeColor: '#0a2418', miniCubeColor: '#2ee27f', accentColor: '#b6ffd9', metalness: 0.3, roughness: 0.18 }`. `CUBE_STYLES[1..4]` and the id order are unchanged; the backend `CUBE_STYLE_IDS` list is unchanged. Evidence: `progression.test.ts` (frontend), `world.test.ts`, `cube-view.test.ts`, `scene.test.ts` (the old `#0b0b12`/`#1de9b6`/`0.6`/`0.35` literals are updated to the new style in the tasks named in `tasks.md`), existing backend style tests.

- **AC-14 — Beveled glossy mini-cubes.** Every face `InstancedMesh` in `render/cube-view.ts` uses `RoundedBoxGeometry(1, 1, 1, MINI_CUBE_BEVEL_SEGMENTS, MINI_CUBE_BEVEL_RADIUS)` with exported `MINI_CUBE_BEVEL_SEGMENTS === 2` and `MINI_CUBE_BEVEL_RADIUS === 0.08`. The cube body remains a `BoxGeometry`. Tile and body materials remain `MeshPhysicalMaterial` with the pinned clearcoat constants; hidden/pop/remove-face behavior is unchanged. Evidence: `cube-view.test.ts`.

- **AC-15 — Golden spark bursts.** `render/particles.ts` exports `PARTICLE_COLOR === 0xffcc66`; its `PointsMaterial.color.getHex() === PARTICLE_COLOR`. Vertex fade, pool cap, recycling and lifetime behavior are unchanged. Evidence: `particles.test.ts`.

- **AC-16 — Starfield and background life retained.** The scene still contains exactly one starfield `Points` with `STAR_COUNT === 1200` stars, the starfield twinkle/expansion behavior is unchanged, and exactly one `Group` named `background-life` with 5 shooting stars and 3 ships. Existing `starfield.test.ts`, `background-life.test.ts`, and the retained scene assertions pass without weakening. Evidence: those test files.

- **AC-17 — Wide composition does not obscure the cube.** At 1280×720, 1920×1080, 2560×1280 (the reference-like 2:1 size), and additionally 2560×1080 (21:9), with the local environment running, no gameplay panel covers the central cube's front face: the four surfaces stay in their corners and the cube's front face remains fully clickable. The check is recorded pass/fail per size with a screenshot in the build log. Evidence: build log manual verification.

- **AC-18 — Responsive fit and bottom-band separation.** `game-view.css` contains a `@media (max-width: 720px)` block that reduces `.hud-panel` padding/font size, clamps `.upgrades-panel`, and stacks the bottom band: `.upgrades-panel` declares `left: calc(1rem + env(safe-area-inset-left, 0px));`, `right: calc(1rem + env(safe-area-inset-right, 0px));`, `bottom: calc(5rem + env(safe-area-inset-bottom, 0px));`, `max-width: none;`, `max-height: 35vh;`, `overflow-y: auto;`; `.customization-panel` declares `left: calc(1rem + env(safe-area-inset-left, 0px));`, `right: calc(1rem + env(safe-area-inset-right, 0px));`, `bottom: calc(5rem + env(safe-area-inset-bottom, 0px));`, `max-width: none;`, `max-height: 45vh;`, `overflow-y: auto;`; and `main[data-customization-open='true'] .upgrades-panel` declares `display: none;`. `App` sets `data-customization-open={customizationOpen ? 'true' : 'false'}` on the game-shell `<main>` so the mobile hide rule is state-driven without `:has()`. At 375×667 and 320×568, with the customization panel closed, the four surfaces stay within the viewport, no horizontal scrollbar appears, the canvas remains clickable outside the panels, the `.customization-toggle` never overlaps `.upgrades-panel`, and an upgrade row is clickable; with the customization panel open at ≤720px the upgrades panel is hidden (not overlapped) and the customization panel fits or scrolls within the viewport. At 768×1024 all four surfaces stay within the viewport and the bottom-left and bottom-right controls do not overlap thanks to the base `.upgrades-panel` `max-width`. The existing `@media (max-width: 480px)` block in `app.css` is retained unchanged. Evidence: `game-view.css.test.ts`, `App.test.tsx`, build-log manual check at 375×667, 320×568 and 768×1024.

- **AC-19 — Accessibility and contrast.** Every new SVG has `aria-hidden="true"` and `focusable="false"`. Every new interactive control has a `:focus-visible` outline using the accent token and a minimum 44×44 px target. `theme.test.ts` asserts `HUD_TEXT` contrast ≥ 4.5:1 over both `PANEL_BACKGROUND_TOP` and `PANEL_BACKGROUND_BOTTOM` composited over both black and white worst-case backdrops; `#ffffff` over both users-badge stops ≥ 4.5:1; and the green buy-button surface against white ≥ 3.0:1 (non-text UI contrast). Reduced motion freezes all cosmic motion (AC-12) and existing CSS motion remains disabled under `prefers-reduced-motion: reduce`. Evidence: `theme.test.ts`, `game-view.css.test.ts`, `cosmic-backdrop.test.ts`, `icons.test.tsx`.

- **AC-20 — No backend, container or dependency change.** With `BASE` recorded, `git diff --exit-code "$BASE"...HEAD -- src/backend compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' package.json package-lock.json src/frontend/package.json src/backend/package.json src/frontend/src/game/engine.ts src/frontend/src/game/session.ts src/frontend/src/multiplayer` exits 0 and `test -z "$(git status --porcelain -- <same paths>)"` succeeds. No new import outside React, existing workspace modules, `three`, and `three/examples/jsm/*` is introduced; named imports only, no namespace import. The existing `three/examples/jsm/postprocessing/*` precedent covers the added `three/examples/jsm/geometries/RoundedBoxGeometry.js` (see Superseded predecessor criteria); the 350 KB gzip budget remains. Evidence: final build log.

- **AC-21 — Coverage.** `npm run coverage` exits 0 with ≥ 80% statements/branches/functions/lines in both workspaces; the frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` is the task-level check. Evidence: final build log.

- **AC-22 — Performance evidence.** With the local environment running at 1280×720 and 1920×1080, record two 10-second browser `requestAnimationFrame` traces per size (one idle, one at 10 clicks/second) and report average frame time and 95th percentile: average ≤ 16.7 ms and p95 ≤ 33 ms at both sizes. Record in `build-log-T15.md` the measured values and the expected growth: scene objects 32 → 60 (`COSMIC_BACKDROP_OBJECT_COUNT === 28`), 22 new decorative meshes (7 asteroids, 6 meteor meshes, 2 comet meshes, 7 hero-ship meshes), and `RoundedBoxGeometry` replacing each face's single `BoxGeometry` tile geometry. If the bar is not met on the reference dev machine, T15 reports blocked with the measurements; a quality tier is a follow-up (Q-9). Evidence: build log manual measurement.

## Non-goals

- No change to game rules, click handling, board topology, grid-size draws, cube faces, progression semantics, scoring, economy, upgrades, customization, engine, session, multiplayer protocol, server authority, persistence, or backend.
- No 10-column × 12-row cube wall and no gameplay grid-size change; the accepted six-face cube with a 3–7 grid is retained (Q-2).
- No exact pixel replication of the reference artwork; the nebula/comet/ship are procedural approximations and the reference image is only available to the planner as a written description (Q-1).
- No separate green debris particle system; the existing green tile pop represents the reference's debris and sparks are gold (accepted approximation, Q-1).
- No external image, texture, font, audio, or webfont assets; no new dependency, no loader, no URL; no licensing review needed because no third-party art is imported.
- No white OS cursor overlay; the accepted spaceship cursor remains the pointer representation.
- No redesign of the auth menu/form/verification/banner/announcement surfaces; they keep the metallic sharp-edged frames (AC-8).
- No camera-anchored background-plane fallback in v1; an invisible nebula texture is a blocked condition requiring a spec revision (AC-10).
- No change to camera rest/travel constants, picking geometry, shot timing, explosion semantics, or deferred-explosion behavior.
- No cross-client visibility of the new backdrop, hero ship, comet, or HUD styling; all new visuals remain local to one client.
- No browser automation, pixel/perceptual snapshot tests, or visual-regression tooling; wide/mobile/frame-time checks are manual and recorded.
- No quality-tier switch in v1; if low-end devices stutter, a quality flag is a follow-up (Q-9).

## Boundaries

- ✅ Always: preserve existing labels, `data-stat`/`data-upgrade` hooks, aria semantics, and button behavior; keep `game/**` pure and DOM-free; use named tree-shakeable `three` imports (including `three/examples/jsm/geometries/RoundedBoxGeometry.js`, following the existing post-processing example precedents); keep all new visuals procedural and local; use the specificity-safe selectors pinned in AC-3/AC-5 (`!important` is not used); include test files with every behavior change; run lint, typecheck, tests, and coverage before reporting done; record manual visual/frame-time evidence in the build log.
- ⚠️ Ask first: any new dependency, external asset, font, or texture; changing `CUBE_STYLES` ids/order or any multiplayer-visible data; changing camera rest/travel constants or picking; changing the pinned `HUD_TEXT`/`ACCENT`/`PAGE_BACKGROUND` theme values; touching `app.css`/auth surfaces, backend, protocols, or container files; adding a second `@media (max-width: 480px)` block; changing the mobile stacking/hide rule (Q-11); any coverage exclusion or threshold change.
- 🚫 Never: change game rules or server authority; weaken assertions (wildcard matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; commit secrets or edit `.env*`; use `dangerouslySetInnerHTML` or external asset URLs; push; rewrite predecessor specs.

## Security considerations

- **No new dependencies or assets.** Only React, existing workspace modules, `three`, and `three/examples/jsm/*`; lockfile untouched; no loaders, external URLs, or third-party art.
- **No user-controlled data.** The new visuals are constants, generated from the existing injected random source; no user input, storage, or network payload is added. Icon SVGs are static React elements, not injected HTML. `data-customization-open` is local UI state.
- **No secrets.** Nothing new is persisted or bundled as a credential; `.env*` untouched.
- **Rendering safety.** Procedural geometry/materials and a generated `DataTexture`; no `innerHTML`, no `eval`, no URL fetch.
- **Resource bounds.** Fixed counts (7 asteroids, 3 meteors, 1 comet, 1 hero ship, 28 backdrop objects), a fixed 256×128 texture, fixed CSS pseudo-elements, and existing disposal contracts; no unbounded growth.
- **Test integrity.** Coverage thresholds and concrete-assertion rules protect unchanged engine, server-authority, and multiplayer paths.

## Real-time impact

**No new shared or cross-client state.** The nebula, cosmic backdrop, hero ship, cube palette/geometry, spark tint and all HUD restyling are client-local presentation. No protocol message, server field, or persistence is added; `data-customization-open` is ephemeral local UI state.

The only live shared data displayed by the restyled surfaces is pre-existing: `world.members` in `UserPanel` (roster/spectate list) and server-authoritative `coins`/`upgrades`/`customization` values already delivered by `welcome`, `economyUpdate`, `upgradeUpdate`, `customizationUpdate` and roster messages. Connection lifecycle, reconnection, multi-client behavior and server authority are unchanged; reconnecting clients still get the same authoritative values and the restyle re-renders them. Identity vs. "no accounts" is unaffected: guest play remains first-class and no new account requirement is introduced.

## Containerization impact

**None.** No new service, image, port, environment variable, health signal, compose entry, or Dockerfile change. The frontend image absorbs the source/CSS diff through the existing Vite build; `podman compose up`, the unchanged WebSocket endpoint `/ws`, and `npm run smoke` remain as documented in `docs/architecture/containerization.md`. AC-20 pins the container/dependency diff gate.

## Testing strategy

- **Unit (Vitest, `node` environment):**
  - `render/nebula.test.ts` — exact dimensions/format/filters/color space; deterministic seed equality; cross-seed difference; alpha `255`; exported palette stops with hue ranges; at least `NEBULA_MIN_HUE_PIXELS` saturated pixels in each purple/blue/pink range; channel variance > 100.
  - `render/cosmic-backdrop.test.ts` — group name; `COSMIC_BACKDROP_OBJECT_COUNT === 28`; exact counts; named hero ship/engines/comet; seven hero meshes; comet/hero colours and pinned right-side positions/rotation; procedural meshes (no loaders); motion under positive `dt`; freeze under reduced motion; disposal exactly once.
  - `render/cube-view.test.ts` — `RoundedBoxGeometry` on every face with exact radius/segments, body `BoxGeometry`, clearcoat retained, hidden/pop behavior unchanged, updated style-0 palette literals.
  - `render/particles.test.ts` — `PARTICLE_COLOR` and material color; pool/fade behavior unchanged.
  - `game/progression.test.ts` — exact green first-style palette, unchanged ids/order/other styles.
  - `render/world.test.ts` — updated style-0 body/tile literals and unknown-style fallback literal (owned by T12).
  - `ui/icons.test.tsx` — every icon renders an `<svg>` with `aria-hidden="true"`, `focusable="false"`, and the expected `data-icon`.
  - `ui/CustomizationToggle.test.tsx` — exact label, classes, icons, `aria-expanded`, click callback once.
  - `ui/theme.test.ts` — panel/users/green contrast math over black and white worst cases; existing pinned theme values retained; nine new token literals asserted.
  - `ui/game-view.css.test.ts` — one `:root` block with the nine exact tokens; grouped panel rule exact declarations; `.user-panel > .users-badge` full reset and hover/focus; `.user-panel .users-list::before` reset; tuned corners read from `app.css`; no base position duplication; 720 block stacking/hide; focus rings; 44 px targets; reduced-motion coverage; auth/banner/announcement absence.
- **Integration (same `node` environment, real modules through their boundaries):**
  - `ui/Hud.test.tsx`, `ui/UserPanel.test.tsx`, `ui/UpgradesPanel.test.tsx` — SSR markup contracts: labels, data hooks, icons, classes, disabled/buy semantics.
  - `App.test.tsx` — full shell markup: layout, CSS import order, `CustomizationToggle` wiring, `data-customization-open` state, all four surfaces in their corners.
  - `render/scene.test.ts` — one `cosmic-backdrop` group, `scene.background` is the nebula texture, child/object counts updated exactly (8→9, 9→10, `baselineObjects` 32→60), construction order retains the seeded starfield/background-life sequences, update forwarding, disposal order and `background = null`.
  - Existing `scene-spaceship.test.ts`, `world.test.ts` (except the palette literals), `session.test.ts`, `multiplayer/**` tests run unchanged (no gameplay/network regression).
- **Manual visual verification (not automated):** with `podman compose up` (or `npm run dev`), record screenshots/pass-fail at 1280×720, 1920×1080, 2560×1280, 2560×1080, 375×667, 320×568 and 768×1024: purple/blue/pink nebula regions visible, green cube readable, orange comet upper-right, blue-hull/orange-flame hero ship lower-right, rounded cyan panels with icons, central cube not covered on wide screens, bottom-band panels non-overlapping (and the upgrades panel hidden while customization is open at ≤720px), focus rings and reduced-motion freeze. Pixel/perceptual automation is a non-goal.
- **Performance (manual, recorded):** AC-22's frame-time traces at 1280×720 and 1920×1080.
- **E2E / container:** no new smoke assertions; the unchanged `npm run smoke` is the container regression check where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` per task. No new exclusions. If a metric cannot honestly clear 80%, the task reports `blocked` — no carve-outs.

## Superseded predecessor criteria

The request explicitly changes the game's visual presentation. Predecessor specs are not edited; they remain authoritative for everything not listed below.

From `cube-game-frontend`:

- **AC-3** — the clause "the scene sets a black background" is superseded by the procedural nebula background (AC-9, AC-10). The starfield `Points` requirement, count, deterministic layout and travel-progress behavior are retained.
- **AC-20** — the "no `three/addons`" clause is superseded for `three/examples/jsm/*` only: the accepted realistic-lighting-materials pipeline already imports `three/examples/jsm/postprocessing/*`, and this feature adds `three/examples/jsm/geometries/RoundedBoxGeometry.js` using the same precedent. Named imports, no namespace import, and the 350 KB gzip budget remain authoritative. The corresponding ⚠️ Boundaries line ("any use of `three/addons`") is superseded by the same `three/examples/jsm/*` precedent recorded here.

From `metallic-hud-frames`:

- **AC-3, AC-4, AC-5, AC-9 and AC-11** (uniform metallic frame, bevel tiers, framed controls, frame sheen, scanline) — retained for the auth/menu/banner/announcement surfaces, but superseded for the gameplay surfaces (`.hud-panel`, `.user-panel > .users-badge`, `.user-panel .users-list`, `.upgrades-panel`, `.upgrade-buy`, `.customization-toggle`, `.customization-panel`), which are restyled by `game-view.css` (AC-3, AC-5, AC-6, AC-7).
- **AC-10** ("no rounded chrome remains") — superseded for the gameplay surfaces only: rounded corners/pills/circles are now required there (AC-3, AC-5, AC-6, AC-7). `app.css` itself remains zero-radius, and auth surfaces stay sharp (AC-8).
- **AC-18** (no markup/component change) — superseded for `Hud.tsx`, `UserPanel.tsx`, `UpgradesPanel.tsx`, `App.tsx` and their test files: icons, classes, `CustomizationToggle`, the `data-customization-open` attribute and the corresponding markup expectations are required (AC-4..AC-7, AC-18). Its `theme.ts` no-change clause is superseded additively by AC-3: the new nine tokens are exported, while the pinned `HUD_TEXT`/`HUD_BACKGROUND`/`ACCENT`/`PAGE_BACKGROUND` values remain byte-identical and `theme.test.ts` keeps its existing assertions (extended with the new contrast/token assertions). The remaining AC-18 protected files (`AuthMenu.tsx`, `AuthForms.tsx`, `ConnectionBanner.tsx`, `VerificationPending.tsx`, `VerifyEmail.tsx`) stay unchanged and remain covered by the final diff gate.
- **AC-1** (pinned theme constants) remains authoritative for the existing constants; only additive exports are allowed (AC-3, AC-19).

From `futuristic-hud-blue`:

- **AC-10** (markup contract unchanged) — superseded for `Hud` by AC-4 (icons/classes added; labels, data hooks and minimize behavior retained).

From `modern-visual-overhaul`:

- **AC-6** (HUD minimize) is retained; its exact markup expectations are updated for the added class/icons, not weakened (AC-4).

From `upgrades-panel-bottom-right`:

- **AC-1/AC-2** (bottom-right placement, `upgrades-panel` class) are retained; row content gains decorative icons/classes (AC-6).
- **§ Boundaries** — the clause "preserve the metallic frame styling inherited from `main > section` for `.upgrades-panel`" is superseded by AC-6/AC-3: the panel is now a rounded cyan surface with `border-image: none; clip-path: none; filter: none;`. The placement/class clauses remain retained.

From `spaceship-customization`:

- **AC-12** (panel uses existing `app.css` classes consistent with `UpgradesPanel`) is retained in behavior; the visual treatment is now the rounded `game-view.css` surface (AC-7).

From `cube-visual-polish`:

- **AC-3** — the retained "Black background" clause in the travel-visual row is superseded by AC-9/AC-10 (procedural nebula `scene.background`). The starfield `Points`, `STAR_COUNT`, deterministic seeded layout, slow drift and never-rebuilt-across-frames requirements remain retained.

From `cube-visual-polish-followup`:

- **AC-3** — the retained "Black background" clause in the cube-game-frontend AC-3 row is superseded by AC-9/AC-10 for the same reason. The seeded determinism, 4-draws-per-star layout, drift/swirl and travel-progress behavior remain retained.

## Review r1 disposition

All F1–F17 findings were re-checked against the current source before adopting the fixes; none were factually wrong and none are rebutted. The file/line claims in the review are confirmed: `world.test.ts:165,168,309`, `cube-view.test.ts:321-326,855-856`, `scene.test.ts:1596,1623,1651`, `app.css:185-195,596-622,639-658,670-687,805-819`, and the `scene.test.ts` child counts at 481, 1689, 1737, 1779 and 1986.

| # | Disposition | Change |
| --- | --- | --- |
| F1 | Fixed | `world.test.ts` is added to T12 `files_owned`; T13 and T11 now depend on T12; every old style-0 literal in `world.test.ts`, `cube-view.test.ts` and `scene.test.ts` is enumerated for update; AC-13 evidence names all four test files; DAG, mermaid, parallel groups and the dependency overview are updated. |
| F2 | Fixed | AC-5/T2 pin the specificity-safe `.user-panel > .users-badge` selector with the full reset (`border-image`, `clip-path`, `background`, `color`, `border-radius`, `min-height`, padding) plus hover/focus overrides; `game-view.css.test.ts` asserts the exact selector and declarations. |
| F3 | Fixed | AC-3/T2 use `.user-panel .users-list::before` (0,2,1) in the `content: none` reset and assert that exact selector; no `.users-list::after` reset is added because `app.css` paints none. |
| F4 | Fixed | AC-3/AC-6/AC-7 pin one grouped panel rule with the complete declaration set (including `border-image: none; clip-path: none; filter: none;`) for `.hud-panel`, `.upgrades-panel`, `.customization-panel` and `.user-panel .users-list`; `game-view.css.test.ts` asserts the exact declarations. |
| F5 | Fixed | AC-3 lists all nine `:root` declarations with exact values in one `:root` block; `theme.ts` mirrors all nine (including `PANEL_RADIUS`); T1/T2 and the CSS guard are updated. |
| F6 | Fixed | AC-1 is scoped to production non-test `game/**`, explicitly allows `progression.ts` palette data and `progression.test.ts` expectation updates, and diffs every other `game/**` file with a `git status --porcelain` protected-set check; T15 carries the commands. |
| F7 | Fixed | The superseded list adds `metallic-hud-frames` AC-18 (`theme.ts` additive tokens), the `.upgrades-panel` metallic-frame preservation clause, both "Black background" retained clauses, and the `cube-game-frontend` no-addons clause with the existing `three/examples/jsm/*` precedent. Predecessor specs are not edited. |
| F8 | Fixed | AC-9 exports nebula palette stops/hue ranges and pins saturated representative-pixel counts; AC-11 exports comet/hero colours and right-side positions/rotation and pins the hero-ship mesh set; the manual checklist names all of them. T9/T10 tests updated. |
| F9 | Fixed | AC-1/AC-20 and T15 use the recorded `BASE` with `git diff --exit-code "$BASE"...HEAD -- <paths>` plus `test -z "$(git status --porcelain -- <paths>)"` for the engine/session/multiplayer/backend/container/dependency set, the `game/**` set and the `app.css`/test set; both outputs are pasted in `build-log-T15.md`. |
| F10 | Fixed | T11 enumerates every exact count (`scene.children` 8→9 at 481/1689/1737, 9→10 at 1779/1986, and `baselineObjects` 32→60 at 1651) and pins `createCosmicBackdrop(random)` after `createStarfield`/`createBackgroundLife` with the cosmic group appended ninth. |
| F11 | Fixed | The camera-anchored-plane fallback is removed; AC-10 requires the texture path, and an invisible texture is a blocked condition requiring a spec revision (plan risk and T11 notes updated). |
| F12 | Fixed | `docs/features/README.md` is removed from T15 `files_owned`; T15 records the proposed row diff in `build-log-T15.md` for the orchestrator to apply. |
| F13 | Fixed | AC-18 adds the ≤720px bottom-band stack (upgrades above the toggle) and the `main[data-customization-open='true'] .upgrades-panel { display: none; }` rule so the open customization panel cannot overlap the upgrades panel; 375×667, 320×568 and 768×1024 checks plus a usable-upgrade-row check are added. |
| F14 | Fixed | AC-17 adds 2560×1280 (2:1) and keeps 2560×1080 as the extra 21:9 case; the manual matrix is updated. |
| F15 | Fixed | AC-8/T2 add `.connection-banner` and `.phase-announcement` to the absence guard (selector-name regex, not comments). |
| F16 | Fixed | AC-2/T2 state that unchanged `app.css` owns the four base corner rules; `game-view.css` adds only restyling and the ≤720px overrides; `game-view.css.test.ts` reads `app.css` for the corners and asserts no base position duplication. |
| F17 | Fixed | New AC-22 records 10-second idle/rapid-click frame-time traces at 1280×720 and 1920×1080 (average ≤ 16.7 ms, p95 ≤ 33 ms) and the expected object/geometry growth in `build-log-T15.md`. |

Non-blocking review notes are folded in: the `theme.ts` header comment is corrected by T1; the green-debris approximation is recorded in the Summary, reference mapping and non-goals; the white-cursor non-goal is retained and remains explicit.

## Open questions

- **Q-1 — Reference image fidelity (user checkpoint).** The planner cannot see the attached image; this spec follows the provided written description. Defaults pin the palette/composition/colours. If the actual image differs (e.g., panel hue, cube hue, comet position), the token/proportion changes are a spec revision. The green-debris simplification (green tile pop, gold sparks) is part of this default.
- **Q-2 — Cube-wall topology (user checkpoint).** Default: keep the accepted six-face cube with a 3–7 grid and make the front face read as a green wall. A literal ~10×12 wall would require a gameplay/board redesign and is out of scope. Choosing it requires a separate feature.
- **Q-3 — First-style palette.** Default: retune `obsidian-neon` (id kept for wire compatibility) to emerald green and rename its display name to `Emerald Neon`. Alternative: keep the palette and add a new style (would change the level cycle/server style sequence).
- **Q-4 — Rounded gameplay chrome vs. metallic auth chrome.** Default: gameplay HUD surfaces become rounded/cyan per the reference; auth/menus keep the accepted metallic frames. If the user wants every menu rounded too, that is a broader restyle and a spec revision.
- **Q-5 — Typography.** Default: keep the existing system font stack with heavier weights/letter-spacing. A bundled arcade/rounded webfont would be a new asset (license review) and is not included.
- **Q-6 — Procedural art vs. external image.** Default: fully procedural nebula/comet/ship (no assets). If the user supplies the reference as a file and wants it used as a background, that is a new asset/dependency decision.
- **Q-7 — Hero ship behavior.** Default: one decorative ship drifting on the right, non-interactive, no gameplay effect, frozen under reduced motion. Alternative: remove it and rely on the cursor spaceship.
- **Q-8 — Camera framing.** Default: keep the accepted camera rest pose/travel and centred cube (gameplay/picking contract). The reference's centre-left cube with a right-side ship is approximated by the backdrop composition; a camera offset would change the pinned camera contract.
- **Q-9 — Performance tier.** Default: fixed decorative counts and one 256×128 texture; AC-22 records the baseline. If low-end devices stutter, a quality flag (disable hero ship/meteors) is a follow-up; not implemented in v1.
- **Q-10 — Cross-client visibility.** Default: all new visuals are local to one client; no broadcast. Broadcasting them would need protocol/server work and a spec revision.
- **Q-11 — Mobile bottom-band behavior.** Default: at ≤720px the upgrades panel stacks above the toggle and is hidden while the customization panel is open (`data-customization-open`), so no gameplay panels overlap. Alternative: keep both visible in a scrollable shared sheet; that is a visible behavior change and would need a spec revision (and is why the hide rule is an ⚠️ Ask-first boundary).

## Assumptions

- The reference description supplied to the planner is an accurate summary of the user's image; the orchestrator can resolve Q-1 during approval.
- `three@0.186.1` / `@types/three@0.186.0` ship `RoundedBoxGeometry` under `three/examples/jsm/geometries/RoundedBoxGeometry.js` (verified in the installed tree at r1); this is not a new dependency and follows the existing `three/examples/jsm/postprocessing/*` precedent.
- The existing `app.css` metallic frames can be overridden on gameplay surfaces by the pinned specificity-safe selectors (`.user-panel > .users-badge`, `.user-panel .users-list`, `.upgrades-panel`, `.customization-panel`) in a later-imported `game-view.css` without `!important`; the base corner placement remains owned by `app.css`, and only the ≤720px bottom-band overrides live in `game-view.css`.
- The existing post-processing composer preserves `scene.background`; if it does not, T11 reports blocked and a spec revision decides the fallback (no plane is added under this revision).
- `createCosmicBackdrop(random)` can be constructed after `createStarfield(random)` and `createBackgroundLife(random)` without changing their random draws, and the cosmic group can be appended as the ninth scene child without changing the light indices; `createParticleSystem(random)` and `createWorldView` do not consume random at construction.
- All HUD/upgrade/user values already exist and remain server-authoritative where they already are; the feature adds no data source.
- The generated nebula `DataTexture` is deterministic under the injected random source, so tests can pin exact byte equality without a browser.
- Manual wide/mobile/frame-time verification is acceptable evidence for composition/overlap/performance; the project has no browser automation tier and prior visual features use the same convention.
- Predecessor specs/plans/tasks remain authoritative for everything not superseded; this spec never edits them.

## Revision history

- r1 — 2026-11-07 — initial draft (planning phase).
- r2 — 2026-11-07 — spec review r1 addressed (F1–F17): cross-task palette test break fixed (F1), cascade-safe badge/users-list/panel selectors and exact declaration sets (F2–F4), nine-token `:root` contract reconciled (F5), achievable `game/**` diff scope (F6), complete supersession list including `theme.ts` and the no-addons precedent (F7), pinned nebula/comet/hero-ship colours and positions (F8), `BASE`-based final gates (F9), exact scene counts and construction order (F10), texture-only background with no fallback plane (F11), orchestrator-owned feature-index proposal (F12), mobile bottom-band stacking/hide and 320×568 (F13), 2:1 viewport case (F14), banner/announcement absence guard (F15), `app.css` corner ownership (F16), and a recorded frame-time check (AC-22, F17). No acceptance criterion was removed or weakened.
