---
feature: game-feel-overhaul
revision: 3
---
# Plan — Game-Feel Overhaul

## Architecture

### Layers and ownership

```text
backend (unchanged)
  openLootbox ──> applyLootboxOpenV2 ──> lootboxOpened (opener only)
                                      └─> customizationUpdate (account-wide)
        │
        ▼
frontend session (game/session.ts)
  handleLootboxOpened ──> engine.adoptCustomization + engine.adoptLootboxGrant
  welcome / non-connected status ──> engine.clearLootboxGrant
        │
        ▼
frontend engine (game/engine.ts, unchanged public contract)
  lastLootboxGrant { partId, slot, rarity, duplicate, sequence }
        │
        ▼
App.tsx
  <DeferredSpaceshipCustomizationPanel> (deferred chunk)
        │
        ▼
SpaceshipCustomizationPanel
  grant === null  ──> normal panel: title, chips, slots, SpaceshipPreview
  grant !== null  ──> LootboxReveal only (one canvas, one context, data-reveal-active on the section)
        │
        ▼
LootboxReveal (ui/LootboxReveal.tsx)
  role="group" aria-live="off"; owns WebGLRenderer + one rAF loop (30 fps max, hidden-tab pause)
        │
        ▼
createRevealStage (render/lootbox-reveal.ts)
  createCursorShipModel + appearanceToCursorShipParams + one rarity ring
        │
        ▼
revealStagePose (game/reveal-motion.ts, pure, allocation-free)
```

- **Server authority** stays entirely in the existing backend path. This feature changes no backend file, message, schema or metric.
- **`game/**` stays pure.** `reveal-motion.ts` has no DOM, three.js, timers or randomness; it is plain arithmetic plus the pinned angle/colour tables.
- **`render/**` stays three.js-only.** `lootbox-reveal.ts` imports named three.js classes and the pure game helpers; it owns no renderer and no rAF loop.
- **The component owns the browser boundary.** `LootboxReveal` creates exactly one `WebGLRenderer`, one `ResizeObserver`, one visibility listener and one rAF loop, and disposes them in reverse order (stage → renderer). It takes optional `createRenderer`/`createStage` seams so tests never need a real WebGL context. It is a non-live `role="group" aria-live="off"` region; it does not add a live region.
- **The panel owns the reveal state machine.** It keeps the accepted `revealPhase` timers (420/250/120/360/140), passes `phase` to the component for `data-reveal-phase`, and renders the reveal branch instead of the normal branch. `phase` may be `idle` on the first grant render; the component maps `idle → charge` (or `idle → rest` under reduced motion) so the DOM phase is never `idle`. It is a single component instance across the branch, so slot-flash state survives an `Equip` dismissal.
- **CSS ownership.** `app.css` owns the `--gf-*` tokens, the single shared Neon Forge frame rule (including gameplay selectors so the pre-welcome stats panel is framed), the auth restyle, the connection/phase chrome and the 480 px block. `game-view.css` owns the gameplay layout details, HUD resources, pips, medals, swatches, ambience, reveal spotlight, the epic flourish, the 720/721 px rules and the motion custom-property map. `app.css` is imported first; `game-view.css` overrides only where the gameplay surfaces need it. No new `!important`.
- **No outer shadow on clipped panels.** The shared frame uses inset depth/glow only and declares no `filter`; the clipped panels therefore never claim an outer shadow that `clip-path` would cut away. The accent pseudo-elements are inset and clipped-safe.
- **No new render pass, light, post-processing parameter or quality-tier input in the main scene.** The main scene and the adaptive policy are untouched. The reveal context is small (one model, one ring, two lights) and exists only while the customization panel is open with a grant.

### Reveal data flow details

1. **Account.** `handleOpenLootbox` (hub) captures one draw from the hub RNG, calls `applyLootboxOpenV2`, updates every member of the account, broadcasts `customizationUpdate`, and sends `lootboxOpened` to the opening connection only. This is unchanged.
2. **Client.** `handleLootboxOpened` adopts the absolute state first (so `parts[partId]` already includes the new count), then advances `lootboxSequence` and calls `engine.adoptLootboxGrant`. `publish` makes the new snapshot visible to `App` and the panel.
3. **Guest.** `engine.openLootbox()` performs the same draw, increments `parts`, decrements counts, advances `lootboxSequence`, sets `lastLootboxGrant`, invalidates and returns the grant. No message is sent.
4. **Stage.** The panel computes `resolvedSlot = partDefinition(grant.partId).slot` for a valid grant and `stageAppearance = { ...normalizeAppearance(appearance), [resolvedSlot]: grant.partId }`, then passes it to `createRevealStage`. The stage calls `model.applyAppearance(stageAppearance)` once and records each slot group's base transform after the apply. An invalid part never reaches the stage.
5. **Frame.** `LootboxReveal` measures `elapsedMs` from the first frame, calls `stage.update(elapsedMs, reducedMotion)` and renders. The stage writes `model.group.rotation.y = pose.yawRad`; for the granted slot group it sets `scale = baseScale * pose.slotPulse`; it sets the ring's scale/opacity and the key light intensity to `baseIntensity * (1 + pose.flashOpacity)`. The DOM `.lootbox-flash` remains the CSS flash; the 3D flash is the key-light lift. At `elapsed >= 1290` the rest pose is stable.
6. **Dismiss.** `onDismiss` clears the grant through the session (`dismissLootboxReveal`). The panel re-renders the normal branch, restores focus to `Open lootbox` for an in-panel dismissal, and the preview remounts. `Equip` calls `onEquip` first (server/guest path) then `onDismiss`; the slot flash plays on the reappearing row. Closing the panel via the still-clickable customization toggle unmounts the panel, which calls `onDismissReveal`; no focus restoration to the absent `Open lootbox` is attempted (the toggle or body keeps focus).

### Session lifecycle changes

- `handleWelcome` clears a present grant before publishing. A rejoin never replays the reveal.
- The transport-status handler clears a present grant when the status is not `connected`, then calls `publish(engine.getSnapshot())` and `publishMultiplayer()` so the engine snapshot (and `App`) observes the clear before the status publish.
- No other session behavior changes; `pendingLootboxOpen` and the existing error/welcome clearing are kept.
- The panel's unmount-only cleanup calls `onDismissReveal` when the latest grant (read through a ref updated each render) is still present, so closing the customization panel (via the clickable toggle) is a dismissal. It must not fire on a grant-to-grant replacement; the cleanup does not restore focus.

### CSS architecture

1. **Tokens.** `app.css :root` keeps the accepted `--hud-*` values and adds the `--gf-*` palette; the accepted `--panel-*` values stay in `game-view.css :root`. The `--frame-*` metal tokens and their `border-image`/`clip-path` metal rules are removed from `app.css`; nothing else consumes them.
2. **Shared frame (inset-only, clip-safe).** One grouped rule in `app.css` (selector list from spec AC-18, ending with `main > section`) paints the graphite gradient + grid, 1 px rim, chamfer, `color: var(--gf-text)`, inset highlight and **inset-only** depth/glow (`inset 0 0 40px var(--gf-shadow)`, `inset 0 0 24px var(--gf-panel-glow)`), plus the backdrop blur. It declares **no `filter` and no outer `box-shadow`**: `clip-path` clips an element's own outer shadow/filter, so the depth/glow must be inset and the spec never claims an unachievable outer shadow. It deliberately declares no `position`, so it cannot override the absolute HUD/pre-welcome placement. A separate rule gives `.auth-panel`, `.auth-error` and `.user-panel .users-list` `position: relative` for their pseudo-elements. The `::before` top edge is exactly `content:''; position:absolute; left:var(--gf-chamfer); right:0; top:0; height:1px; background:linear-gradient(90deg, transparent 0%, var(--gf-rim-strong) 50%, transparent 100%); pointer-events:none;`. The `::after` rail is exactly `content:''; position:absolute; left:0; top:var(--gf-chamfer); width:2px; height:40%; background:linear-gradient(180deg, var(--gf-rim-strong) 0%, transparent 100%); box-shadow:inset -2px 0 8px var(--gf-rim-strong); pointer-events:none;`. `.auth-panel` retargets the chamfer/radius; `.connection-banner`/`.phase-announcement` use a smaller chamfer. `.phase-announcement:empty` resets `padding: 0`, border, background, box-shadow, filter, clip-path and both pseudo-elements.
3. **Gameplay specifics.** `game-view.css` removes the old rounded grouped rule and old `::before/::after` resets that are no longer needed, then adds:
   - panel layout (`pointer-events`, scroll, widths, z-index), the non-modal reveal spotlight and the 721 px desktop override (`right:auto; bottom:auto; max-width:min(34rem, calc(100vw - 2rem)); z-index:20`) plus the 720 px bottom-sheet override with `left:calc(1rem + env(safe-area-inset-left, 0px))`, `right:calc(1rem + env(safe-area-inset-right, 0px))`, `bottom:calc(5rem + env(safe-area-inset-bottom, 0px))` and `z-index:20`;
   - HUD header/resource/grid layout, the minimized `.hud-grid { display: none; }` rule and coin-pop positioning;
   - upgrade pips/affordability, buy-button chamfer;
   - customization title/chips/swatch/rarity, reveal branch and the epic 8-ray flourish;
   - feed/leaderboard live dots, rank medals/bars, event glyphs;
   - users `Crew` heading, count badge and list cards; connection dot colours;
   - ambience layers (no scrim);
   - the 720 px block and the short-viewport leaderboard cap;
   - the `main { --motion-* }` map (13 accepted + 4 new CSS-mapped tokens);
   - the reduced-motion block.
4. **Cascade safety.** No `!important`; the shared rule lives before `game-view.css`, so gameplay-specific rules win by order at equal specificity. The shared rule omits `position`, so it cannot override the absolute HUD/pre-welcome placement; the separate `position: relative` rule targets only `.auth-panel`, `.auth-error` and `.user-panel .users-list`. The shared rule has no `filter`, so the old `hud-blink` filter animation and the new inset depth/glow do not fight an outer drop shadow. Focus rings inside chamfered/clipped controls use inset `box-shadow` plus an outer outline where the element is not clipped. The auth markup tests stay unmodified; only `app.css.test.ts` assertions are rewritten to the new declarations.
5. **No layout re-architecture.** Positions, safe-area offsets, breakpoints, 44 px targets and the mobile hide rule stay as accepted; the reveal's 720 px override explicitly keeps the three safe-area offsets and `z-index: 20` (AC-21/AC-30). The only positional additions are the non-modal reveal centring (desktop) / bottom-sheet (mobile), the ambience layer and the leaderboard/feed live dots. There is **no full-screen scrim** and no `data-reveal-active` on `<main>`; the customization toggle remains clickable while revealing.

### Motion

- `game/motion.ts` gains the 12 tokens from spec AC-32; the 13 existing CSS mappings stay.
- `game-view.css` maps the four new durations to `--motion-ui-*-ms` on `main`; `game-view.css.test.ts` imports `MOTION` and asserts each `${token}ms`.
- The reveal pose is pure arithmetic over the accepted durations; the panel's DOM phase timers and the stage clock both start at mount, so they stay within a frame.
- All new UI animations use `--motion-ui-*`; the reduced-motion block disables them, and `data-reduced-motion='true'` disables the session-preference variants (feed/leaderboard rows, reveal, ambience, HUD dot pulses).

### Accessibility and responsive behavior

- Every new control is native `<button>`, ≥ 44 px, with a visible `:focus-visible` ring; decorative glyphs/dots/medals/bars/swatches are `aria-hidden`.
- The reveal is a non-live `role="group" aria-live="off"` region labelled `Lootbox reveal: <part name>`; it does not add a live region. In the settled welcomed shell the single `.phase-announcement` polite live region is untouched; the existing deferred-runtime loading/error `role="status"`/`role="alert"` states **and the deferred customization panel's loading/error states are exempt** and only present while loading/failed.
- The reveal is non-modal: the game remains visible and interactive, focus may leave the reveal and is never trapped, and the customization toggle stays clickable. In-panel dismissal restores focus to `Open lootbox`; panel-close/unmount does not restore to the absent button (the toggle or body keeps focus).
- The 720 px block keeps the four corners and the bottom-band stack; the reveal becomes a bottom sheet; the 480 px auth/HUD padding stays.
- Contrast is computed from the actual translucent surfaces over black and white worst cases (spec AC-31).

### Containers

No change. The frontend image absorbs the diff; `/ws`, `GET /healthz`, `podman compose up` and the bundle-budget build stage are unchanged.

## Interfaces / contracts

### Reveal motion (`src/frontend/src/game/reveal-motion.ts`)

```ts
import type { SlotId } from './parts-v2';
import type { LootboxGrant } from './types';

export const REVEAL_SLOT_YAW_RAD: Readonly<Record<SlotId, number>>;
export const REVEAL_START_YAW_RAD: 0.55;
export const REVEAL_RARITY_HEX: Readonly<{ rare: '#60a5fa'; epic: '#c084fc' }>;
export type RevealStagePhase = 'charge' | 'orb' | 'flash' | 'reveal' | 'settle' | 'rest';
export type RevealUiPhase = 'idle' | RevealStagePhase;

export interface RevealStagePose {
  phase: RevealStagePhase;
  yawRad: number;
  scale: number;
  slotPulse: number;
  ringScale: number;
  ringOpacity: number;
  flashOpacity: number;
}

export function createRevealStagePose(): RevealStagePose;
export function revealStagePose(
  elapsedMs: number,
  slot: SlotId,
  reducedMotion: boolean,
  out: RevealStagePose,
): RevealStagePose;
```

`revealStagePose` writes into `out` and returns the same reference. `elapsedMs` is clamped to `[0, 1290]`; non-finite/negative becomes `0`; `>= 1290` is rest. `slot` is already validated by the caller; an unknown slot falls back to `REVEAL_SLOT_YAW_RAD.hull` (defensive, no throw).

### Reveal stage (`src/frontend/src/render/lootbox-reveal.ts`)

```ts
import type { LootboxGrant } from '../game/types';
import type { CursorShipModel } from './cursor-ship';
import type { RevealStagePose } from '../game/reveal-motion';

export interface RevealStage {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly model: CursorShipModel;
  readonly stageAppearance: Readonly<Record<string, string>>;
  readonly ring: Mesh;
  update(elapsedMs: number, reducedMotion: boolean): RevealStagePose;
  dispose(): void;
}

export function createRevealStage(
  appearance: Record<string, string>,
  grant: LootboxGrant,
): RevealStage;
```

Pinned scene: `reveal-ambient` (`AmbientLight 0xbcd6ff`, `1.1`), `reveal-key-light` (`DirectionalLight 0xffffff`, base intensity `3.0`, position `[2.5, 3.5, 4]`; each `update` sets intensity `3.0 * (1 + pose.flashOpacity)`), `cursor-ship-model`, `reveal-slot-ring` (`RingGeometry(0.86, 0.9, 48)`, `MeshBasicMaterial` with `REVEAL_RARITY_HEX` colour, transparent, `depthWrite: false`, `side: DoubleSide`, `rotation.x = -Math.PI / 2`, `position.y = -0.25`). Camera `PerspectiveCamera(32, 1, 0.1, 20)` at `[0, 0.42, 2.35]` looking at `[0, 0.03, 0]`. No shadows, no textures, no loaders, no random.

The stage stores each slot group's base scale/rotation after `applyAppearance` and restores the base rotation every frame; the pulse multiplies only the granted slot's scale. It never mutates `appearance`.

### Reveal component (`src/frontend/src/ui/LootboxReveal.tsx`)

```ts
export interface LootboxRevealProps {
  grant: LootboxGrant;
  appearance: Record<string, string>;
  parts: Record<string, number>;
  /** The panel's phase; may be `idle` on the first grant render. */
  phase: RevealUiPhase;
  reducedMotion?: boolean;
  onEquip?: (partId: string) => void;
  onDismiss: () => void;
  /** Test seams; production uses WebGLRenderer + createRevealStage. */
  createRenderer?: (canvas: HTMLCanvasElement) => WebGLRenderer;
  createStage?: (appearance: Record<string, string>, grant: LootboxGrant) => RevealStage;
}
```

- `effectivePhase = phase === 'idle' ? (reducedMotion ? 'rest' : 'charge') : phase`; `data-reveal-phase` uses `effectivePhase` and is never `idle`. AC-9's reduced-motion first render is therefore `rest` even when the panel prop is `idle`.
- `REVEAL_MAX_FPS = 30`, `REVEAL_FRAME_INTERVAL_MS = 1000 / 30`, `REVEAL_MAX_PIXEL_RATIO = 2`.
- One effect for the renderer/stage/loop, keyed by `grant.sequence`; no separate appearance effect is needed because the stage is built with the staged appearance at mount.
- Hidden tab: skip rendering and stop scheduling while `document.hidden`; on `visibilitychange` to visible, reset the frame baseline and schedule one frame.
- Reduced motion: render one frame and do not schedule a loop.
- Construction failure: set `stageStatus = 'unavailable'`, render the inline SVG fallback, keep the card and controls.
- A `ResizeObserver` (guarded) resizes the canvas; a `max(1, clientWidth/Height)` guard prevents zero-size renders.

### Panel (`src/frontend/src/ui/SpaceshipCustomizationPanel.tsx`)

- `data-reveal-active` on the section.
- Normal branch: header (`h2.customization-title`), counts chips, open button (ref), slot list, preview; the pre-welcome stats section is owned by `App`, not this panel.
- Reveal branch: `<LootboxReveal grant={grant} appearance={appearance} parts={parts} phase={revealPhase} reducedMotion={reducedMotion} onEquip={handleEquip} onDismiss={handleDismiss} />`.
- `handleDismiss` calls `props.onDismissReveal?.()` and arms the focus-restoration effect (in-panel dismissal only).
- An unmount-only cleanup calls `props.onDismissReveal?.()` iff the latest grant (read through a ref updated each render) is present; it must not fire on a normal grant-to-grant replacement and it does not restore focus.
- `handleEquip` keeps `flashSlot` then `onEquip`; the reveal's Equip path adds `onDismissReveal` after `onEquip`.
- `LootboxReveal` validates `grant.partId` and derives `resolvedSlot = partDefinition(partId).slot`; it never calls `createRevealStage` for an invalid part/slot and renders the `data-reveal-3d="unavailable"` card with `data-part-id="unknown"`, `data-slot=""` and `data-owned-count="0"` instead.

### Session (`src/frontend/src/game/session.ts`)

- `handleWelcome`: `engine.clearLootboxGrant?.()` before `publish`.
- `handleStatus` (any non-`connected` status): `engine.clearLootboxGrant?.()`, then `publish(engine.getSnapshot())`, then `publishMultiplayer()`, so the cleared grant is observable to the engine-snapshot subscribers and `App` before the status publish.
- No signature changes on `OnlineGameSession`; the existing `dismissLootboxReveal` remains.

### Shell markup

- `Hud` props add `keys?: number` and `lootboxes?: number` (default `0`); `App` passes `snapshot.customization?.keys ?? 0` and `.lootboxes ?? 0`. `Hud` keeps the minimized contract (header + `.hud-resources` visible, `.hud-grid` hidden) and the `blinking`/`data-blinking` behaviour.
- `App` renders `.game-ambience` with `aria-hidden="true"` and `data-reduced-motion`, passes the HUD counts, and keeps the pre-welcome `<section aria-label="Game statistics">` with the three `data-stat` rows; it does **not** set `data-reveal-active` on `<main>` and renders no scrim.
- `ConnectionBanner` adds `data-status` and the dot.
- `UserPanel` adds the `<h2 class="users-list-title">Crew</h2>` heading, the count badge and live dot.
- `UpgradesPanel` adds the title, balance, affordability attribute and pips.
- `ActivityFeed`/`Leaderboard` add the live dot; `Leaderboard` adds the medal/bar spans; both stay `aria-live="off"`.
- `icons.tsx` adds `KeyIcon` and `LootboxIcon` (and keeps every existing icon unchanged).

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/game/motion.ts` | Edit | 12 new tokens (3D stage + UI); accepted tokens unchanged |
| `src/frontend/src/game/motion.test.ts` | Edit | Pin the new token values |
| `src/frontend/src/game/reveal-motion.ts` | New | `REVEAL_SLOT_YAW_RAD`, `REVEAL_START_YAW_RAD`, `REVEAL_RARITY_HEX`, pose function |
| `src/frontend/src/game/reveal-motion.test.ts` | New | Pose timeline, table, clamping, reduced motion, allocation-free `out` |
| `src/frontend/src/render/lootbox-reveal.ts` | New | Reveal stage factory (cursor model, ring, lights, pose application) |
| `src/frontend/src/render/lootbox-reveal.test.ts` | New | Stage contract, staged appearance, disposal, no textures/shadows |
| `src/frontend/src/ui/LootboxReveal.tsx` | New | Non-live `role="group"`, canvas/renderer/rAF component, fallback, card, Escape/focus, `idle`→`charge`/`rest` mapping |
| `src/frontend/src/ui/LootboxReveal.test.tsx` | New | DOM contract, focus, Escape, reduced motion, fallback, one context, invalid attributes, no live region |
| `src/frontend/src/game/session.ts` | Edit | Clear grant on welcome/non-connected status and publish the engine snapshot |
| `src/frontend/src/game/session.test.ts` | Edit | Reconnect/status publish/multi-tab one-shot tests |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx` | Edit | Reveal branch, catalog slot, title/chips/swatches, spotlight attribute, unmount dismiss |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx` | Edit | Branch, in-panel focus restoration vs no unmount restore, props, dismissal |
| `src/frontend/src/ui/app.css` | Edit | `--gf-*` tokens, inset-only Neon Forge frame, auth/shell chrome, connection/phase, 480 |
| `src/frontend/src/ui/app.css.test.ts` | Edit | Rewritten CSS guards for the new shell/auth contract |
| `src/frontend/src/ui/theme.ts` | Edit | New `GF_*` constants; accepted constants unchanged |
| `src/frontend/src/ui/theme.test.ts` | Edit | Token mirrors + contrast gates |
| `src/frontend/src/ui/game-view.css` | Edit | Gameplay chrome, HUD resources, minimized rule, pips/medals/swatches, ambience, non-modal reveal spotlight, 721/720, epic flourish, motion map |
| `src/frontend/src/ui/game-view.css.test.ts` | Edit | Rewritten CSS guards for gameplay/reveal/ambience, no scrim, epic flourish, 721 override |
| `src/frontend/src/ui/Hud.tsx` | Edit | Header, level chip, resources (`role="group"`), three stat rows, minimized |
| `src/frontend/src/ui/Hud.test.tsx` | Edit | Exact DOM/resource/minimized contract |
| `src/frontend/src/ui/UpgradesPanel.tsx` | Edit | Title, balance, affordability, pips |
| `src/frontend/src/ui/UpgradesPanel.test.tsx` | Edit | Exact markup/state contract |
| `src/frontend/src/ui/UserPanel.tsx` | Edit | `Crew` heading, count badge, live dot, level data |
| `src/frontend/src/ui/UserPanel.test.tsx` | Edit | Crew/count/level/spectate contract |
| `src/frontend/src/ui/ConnectionBanner.tsx` | Edit | `data-status`, dot |
| `src/frontend/src/ui/ConnectionBanner.test.tsx` | Edit | Status/dot/copy contract |
| `src/frontend/src/ui/ActivityFeed.tsx` | Edit | Live dot only |
| `src/frontend/src/ui/ActivityFeed.test.tsx` | Edit | Live dot + unchanged text/semantics |
| `src/frontend/src/ui/Leaderboard.tsx` | Edit | Live dot, medal, bar |
| `src/frontend/src/ui/Leaderboard.test.tsx` | Edit | Medal/bar/rank contract |
| `src/frontend/src/ui/icons.tsx` | Edit | `KeyIcon`, `LootboxIcon` |
| `src/frontend/src/ui/icons.test.tsx` | Edit | New icon contract |
| `src/frontend/src/App.tsx` | Edit | Ambience element, HUD counts, pre-welcome stats; no `data-reveal-active`/scrim |
| `src/frontend/src/App.test.tsx` | Edit | Shell/reveal/ambience/status-close/pre-welcome/single-live-region integration |
| `README.md` | Edit | 3D reveal controls + Neon Forge replacement sentences |
| `docs/architecture/frontend-rendering.md` | Edit | `## Lootbox reveal stage`, `## Game shell layering`, single-loop qualification |
| `docs/product/glossary.md` | Edit | Updated `lootbox reveal` + `### reveal stage` |
| `docs/features/game-feel-overhaul/build-log-T1.md` … `build-log-T11.md` | New | Per-task raw evidence; T11 records the full gate and proposed index row |

**Protected / not touched:** `src/backend/**`, `src/frontend/src/render/{preview,cursor-ship,spaceship,scene,webgl,postprocessing}.ts`, `src/frontend/src/game/engine.ts` (behavior unchanged; only the session calls the existing clear method), `src/frontend/src/multiplayer/**`, `src/frontend/src/main.tsx`, `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles, root and workspace package files, `.env*`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Reuse `lootboxOpened`; do not diff `customizationUpdate` | It is already server-authoritative, opener-only and carries `partId/slot/rarity/duplicate`; diffing is ambiguous with concurrent tabs, duplicates and coalesced updates | New additive `lootboxReveal` message (unnecessary version/protocol surface); diffing (rejected) |
| 2 | Keep the reveal in the deferred customization chunk | The panel already owns the three.js preview; the entry graph stays Three-free and the bundle gate stays green | App-level reveal (would pull three into the entry); a new top-level overlay chunk (more loading states) |
| 3 | One panel context: unmount the preview while revealing | The main scene keeps its own context; the panel has exactly one canvas/context, avoiding a second simultaneous panel WebGL context and the associated GPU/memory cost | Two panel contexts (preview + stage) running together |
| 4 | Centre the panel with absolute positioning, not `position: fixed` | The panel's `backdrop-filter` creates a containing block for fixed descendants; absolute centring is reliable and keeps the reveal inside the panel's DOM contract | A portal/fixed modal (SSR/portal complexity, focus trap) |
| 5 | Try-on appearance, no mutation, catalog-derived slot | The player sees the part on their ship before choosing; `Equip` remains the only mutation and stays server-authoritative; the catalog slot defeats a mismatched wire slot | Auto-equip on grant (changes the accepted inventory/equip semantics); trusting the wire slot |
| 6 | Pure pose with an `out` object | One source for the timeline, exact boundary tests and no per-frame allocation | A three.js animation mixer/clock (new state, harder tests) |
| 7 | Keep the accepted 1290 ms timeline | Continuity with the accepted reveal and its tests; the 3D stage is a new presentation of the same beats | A longer cinematic (would change accepted timing) |
| 8 | Clear the reveal on `welcome`, non-connected status and panel unmount | A reconnect must never replay a stale animation; closing the panel is a dismissal; the grant is one-shot; the status path publishes the engine snapshot so `App` observes the clear | Persisting/replaying the grant (rejected) |
| 9 | Additive `--gf-*` tokens; keep `--panel-*`; inset-only depth | Existing contrast gates and the accepted nine-token mirror stay valid; inset depth/glow is `clip-path`-safe | Replacing the accepted tokens (would weaken existing contracts); outer drop shadows on clipped panels (unachievable) |
| 10 | Shared frame in `app.css`, gameplay specifics in `game-view.css` | One grouped rule satisfies the visual contract; import order lets gameplay rules win without `!important`; the pre-welcome stats panel is framed too; no outer shadow on the clipped surface | One stylesheet rewrite (larger diff, more cascade risk) |
| 11 | CSS ambience layer, no scene change | Adds game feel without touching the renderer/tier/budget; transform-only scanline is compositor-friendly | Adding scene fog/particles (render cost, tier impact) |
| 12 | No new dependency or asset | Meets the request with the existing three.js/React/CSS stack and keeps the bundle/security surface flat | A web font, texture pack or audio sample (approval/licensing/budget) |
| 13 | HUD resource strip with coins/keys/lootboxes, three stat rows | Elevates currency/inventory to the primary HUD and removes the duplicate Cube row; matches game-HUD hierarchy | Keeping the five-row HUD and hiding keys/lootboxes in the panel |
| 14 | CSS-only auth restyle, markup unchanged | Removes the sharp-metal vs rounded-glass split without risking the auth flow or its tests | A markup redesign of auth (larger scope, new tests) |
| 15 | Non-modal reveal: no scrim, no focus trap, toggle stays clickable at `z-index: 21` | Keeps the accepted "game stays playable" feel, avoids an unclickable toggle and hidden-focus trap, and makes panel-close a real dismiss path | A true `<dialog>`-style modal with scrim/inert/focus trap (Q-6 alternative) |
| 16 | Reveal is `role="group" aria-live="off"`, not a live region | Preserves `live-activity-feed` AC-20 and `server-live-leaderboard` AC-21 exactly-one-polite-region invariants; focus + the readable card carry the result | A second polite live region (conflicts with both accepted ACs) |
| 17 | Epic 8-ray flourish is CSS in T7 | Keeps the flourish out of the stage/three.js and gives it a source-guard owner (`game-view.css.test.ts`) with exact selector/values/reduced-motion | Removing the flourish (less game feel) or an unowned CSS effect (orphaned) |

## Risks & mitigations

- **`clip-path` vs outer shadow (F1)** → the shared frame is inset-only and declares no `filter`/outer `box-shadow`; AC-18 and both CSS guards pin that, and the manual matrix checks the depth/glow. No unachievable outer shadow is claimed.
- **30 fps cap vs the old 16.7 ms interval metric (F2)** → AC-15 measures per-frame work (`stage.update()` + `renderer.render()`), mean ≤ 16.7 ms / p95 ≤ 33 ms, at least 2 of 3 runs; the ≈33.3 ms interval is recorded only to prove the cap. The build-log template names the quantity.
- **Protected-file ledger (F3)** → the ledger releases `game/**` (motion/session/reveal-motion), `ui/**` (theme/App/components) and `theme.ts`, and supersedes `reference-image-game-view` AC-8; T11 gates the protected backend/container/package/multiplayer/main/render/auth set with the recorded `BASE`.
- **Two WebGL contexts / leaked contexts** → the main scene keeps its own context; the panel preview is unmounted in the reveal branch so the panel has exactly one canvas/context in addition to the main scene; `LootboxReveal` disposes the stage then the renderer; `SpaceshipCustomizationPanel.test.tsx` asserts one panel canvas and `LootboxReveal.test.tsx` asserts dispose-once. Manual check with the browser's canvas/context inspection.
- **Cascade conflict with the accepted metallic/rounded rules** → old `--frame-*`/metal rules and the old rounded grouped rule are removed; the shared rule lives in `app.css` and gameplay specifics in `game-view.css`; no `!important`; both CSS test files are rewritten to the new exact declarations.
- **`clip-path` clips focus rings** → controls inside clipped panels use inset `box-shadow` focus rings and an outer outline where not clipped; 44 px targets; manual keyboard pass.
- **Non-modal focus/pointer** → the scrim is removed, the toggle stays clickable and panel-close dismisses; focus may leave the reveal and is visible; AC-13/T8/T11 tests cover toggle-click close and the absent `Open lootbox` target on unmount.
- **Second live region** → the reveal is `role="group" aria-live="off"`; `App.test.tsx` asserts exactly one polite live region with and without a grant; the feed/leaderboard `aria-live="off"` is unchanged.
- **Contrast regression on the new translucent surfaces** → `theme.test.ts` composites both surface stops over black and white and checks text, muted, CTA, rarity/success/danger and the rim; any miss blocks.
- **Mobile overflow/overlap and the 34 rem spotlight** → the 720 px block keeps the accepted stacking/hide rule and the reveal's three safe-area offsets + `z-index: 20`; the desktop override includes `bottom: auto`/`max-width` and a 721 px boundary test; the manual matrix covers 320×568, 375×667 and 768×1024.
- **App-level test ownership** → T8 owns `App.test.tsx` and the App-level AC-2/AC-11/AC-13 assertions; T4/T5 are scoped to session/panel tests, so no task edits a file outside its `files_owned`.
- **Reveal/DOM timing drift** → both the DOM phase and the stage clock derive from the same `MOTION` values; pose boundary tests pin the exact numbers; the `idle → charge/rest` mapping is tested; the visual matrix checks charge/flash/settle.
- **Epic flourish ownership** → AC-14 is in T7's acceptance and `game-view.css.test.ts` pins the exact selector/values/reduced-motion; no orphaned effect.
- **Workspace-manifest drift** → AC-1/AC-33/T11 gate `package.json`, `package-lock.json`, `src/frontend/package.json` and `src/backend/package.json`.
- **`backdrop-filter`/`mix-blend-mode` cost** → the panel blur count is not increased (14 px on the same surfaces); the ambience animates `transform` only, one layer, low opacity; the traces cover the panel open and the reveal.
- **Bundle-budget regression** → the reveal stays in the deferred chunk; `npm run build` fails on the 150/165/300 kB ceilings; the final task records `dist/bundle-report.json`.
- **Stale reveal after reconnect** → `welcome` and non-connected status clear the grant and publish the engine snapshot; `session.test.ts`/`App.test.tsx` pin both.
- **Auth regressions** → auth markup is unchanged and its tests run unmodified; only CSS guards change in `app.css.test.ts`.
- **Minimized/pre-welcome regressions** → AC-19 pins both states; `Hud.test.tsx`, `App.test.tsx` and `game-view.css.test.ts` assert the visible/hidden sets.
- **Stale documentation** → AC-35 replaces the README cyan-panel and charge-orb sentences and qualifies the single-rAF sentence; T11 greps new and stale strings.
- **Test deletion** → superseded CSS assertions are rewritten to the new pinned declarations; no assertion-free replacement; coverage thresholds unchanged.

## Verification

### Automated

```bash
npm run lint
npm run typecheck
npm test
npm run coverage          # >= 80 statements/branches/functions/lines per workspace
npm run build             # Vite build + bundle-budget gate
npm run smoke             # run/record; not a cross-service acceptance gate here
```

Per-task pre-gate: `npm run test --workspace @cubeclicker/frontend` and `npm run coverage --workspace @cubeclicker/frontend`. The final task records raw output in `build-log-T11.md`, plus the `BASE` diff/status gates for backend/container/package files (`package.json`, `package-lock.json`, `src/frontend/package.json`, `src/backend/package.json`) and the protected frontend set (`preview`, `cursor-ship`, `spaceship`, `scene`, `webgl`, `postprocessing`, `engine`, `multiplayer`, `main.tsx`, the four auth components).

### Manual visual/motion matrix (T11)

With `podman compose up` (or `npm run dev`), capture screenshots and pass/fail rows:

| Size | Checks |
| --- | --- |
| 1280×720 | HUD resources + `Resources` group, minimized HUD, upgrades pips, feed/leaderboard dots/medals, `Crew` heading, connection chip, auth menu, pre-welcome stats, reveal charge/flash/settle, epic 8-ray flourish, non-modal (toggle still clickable), no overlap |
| 1920×1080 | Same, plus the reveal stage ship length/legibility and the 3D slot pulse |
| 2560×1280 | Panel proportions, no stretched controls, reveal centred at the 34 rem cap |
| 768×1024 | Four corners, bottom band, no overlap |
| 375×667 | HUD resources wrap, users pill, bottom band, reveal bottom sheet, no horizontal scroll |
| 320×568 | Same as 375 with the tightest HUD; upgrade row clickable; reveal scrolls |
| 720/721 px boundary | At 720 the reveal is a bottom sheet with `left/right: calc(1rem + env(safe-area-inset-left/right, 0px))`, `bottom: calc(5rem + env(safe-area-inset-bottom, 0px))` and `z-index: 20`; at 721 it is the centred spotlight with `bottom: auto`, the 34 rem `max-width` and `z-index: 20` |

States: account + guest; rare + epic + new + duplicate; reduced motion on/off; WebGL blocked (fallback); keyboard-only Tab/Escape/Enter with focus visibly able to leave the reveal; exactly one polite live region; no screen shake.

### Performance (T11)

- Reveal: three clean 10 s runs at 1280×720 and 1920×1080; the measured quantity is per-frame work (`performance.now()` around `stage.update()` + `renderer.render()`, excluding the scheduler wait); a run passes at mean `workMs ≤ 16.7` and p95 `workMs ≤ 33`; a size passes when at least two of three runs pass, and the median run is named. Record the inter-frame interval (expected ≈33.3 ms, the 30 fps cap) only as cap evidence, plus draw calls (≤ 24) and triangles (≤ 2596).
- Main scene with the customization panel open: average ≤ 16.7 ms and p95 ≤ 33 ms; record that no new rAF loop/render pass/light exists **in the main scene** (the reveal has its own loop and two lights).
- Build report: initial/three/total gzip bytes and the budget constants.

### Documentation

- `README.md`: replace the `lootbox opening uses a wireframe charge-orb reveal` sentence with the `animated 3D lootbox reveal` and controls; replace `rounded translucent cyan HUD panels` with `chamfered graphite-glass HUD panels with cyan energy rims and amber reward accents`; add `Neon Forge HUD`; preserve `granular spaceship parts` and `detailed blue/orange hero spaceship`; the stale phrases must be absent.
- `docs/architecture/frontend-rendering.md`: `## Lootbox reveal stage` (module, one-context/30 fps rule, deferred chunk, reduced motion/WebGL fallback) and `## Game shell layering` (canvas 0, ambience 2, panels/controls 3, level 5, reveal 20, customization toggle 21, auth 100); replace the unqualified `The session owns the only requestAnimationFrame loop` with a sentence beginning `The session owns the requestAnimationFrame loop for the Three.js game scene` and containing `one additional bounded 30 fps loop` and the deferred/disposal rule.
- `docs/product/glossary.md`: update `lootbox reveal`; add `### reveal stage`; keep `motion token` current (the CSS map grows from 13 to 17).
- `docs/features/README.md`: not edited; the T11 build log records the proposed row.

## Rollback

Client-only revert of the frontend image/commit. No migration, schema, protocol, persisted preference or data repair. The old client's 2D reveal remains compatible with the same `lootboxOpened` payload; the new client without the reveal still grants the part and updates the inventory. If the reveal chunk fails to load, the existing deferred-panel error/retry state applies; if the stage fails, the inline fallback applies. No server or data action is required.

## Open questions

See `spec.md` § Open questions Q-1…Q-18. The plan uses the proposed defaults; the approval checkpoint must confirm them before T1 starts. Any change to Q-1…Q-18 adjusts the named stage/card/CSS/markup tasks before they begin.
