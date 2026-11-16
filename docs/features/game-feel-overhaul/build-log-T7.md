# Build log — T7 — Neon Forge gameplay CSS, ambience and reveal spotlight

Task: T7 (2026-11-16), feature `game-feel-overhaul`, branch `feat/game-feel-overhaul` at
`0680393` (`feat: apply Neon Forge tokens, shared frame and auth shell chrome`).

Files changed (only `files_owned`):

- `src/frontend/src/ui/game-view.css`
- `src/frontend/src/ui/game-view.css.test.ts`
- `docs/features/game-feel-overhaul/build-log-T7.md`

## What changed & why

1. Removed the retired rounded grouped rule, the `content: none` pseudo-element resets and
   every `border-image` / `clip-path: none` / `filter: none` panel reset, so the single
   `app.css` Neon Forge frame is the only gameplay frame. Removed the duplicate
   `.activity-feed-title` / `.leaderboard-title` typography so `app.css` keeps the whole
   AC-29 block.
2. Added the gameplay layout/chrome: HUD header + level chip + resource strip + stat grid,
   the exact minimized `.hud-grid { display: none; }` rule, crew cards/count badge, upgrade
   balance/pips/affordability, hangar chips/swatch/rarity names and the connection dot.
3. Added the non-modal reveal spotlight: layer 20 on desktop (721 px complete override)
   and as a safe-area bottom sheet at 720 px, `.customization-toggle` at layer 21, no
   scrim and no `data-reveal-active` on `<main>`. Added the epic-only 8-ray flourish and
   the reveal stage/card chrome.
4. Added the procedural ambience layer (scanline, vignette, corner glow) and the complete
   z-index contract: canvas 0, ambience 2, panels/controls 3, level 5, reveal 20, toggle 21,
   auth 100.
5. Mapped the four new UI durations on `main`, used them for the spotlight/press/live-dot/
   connection/ambience animations, and extended the single reduced-motion block. Rewrote
   `game-view.css.test.ts` to the new exact declarations with no banned matchers.

## Decisions

- **Frame ownership is absolute.** `game-view.css` never re-declares a border, background,
  shadow, clip-path or backdrop filter on a shared surface element; the AC-18 frame lives
  only in `app.css`. A source guard filters every shared-surface selector and fails on any
  frame property; the old six-surface grouped selector no longer exists.
- **The layering group precedes the specific overrides.** The z-index 3 group is declared
  before the reveal (20), toggle (21) and level (5) rules so both specificity *and*
  document order agree; jsdom (used by the integration test) resolves the winning rule by
  document order for equal-property overlaps, and real browsers use specificity.
- **No scrim, no main attribute.** The reveal is a sibling layer inside the still-interactive
  game; the toggle is 21 so it stays clickable while the layer-20 panel is open.
- **Epic flourish is CSS only.** It lives on the stage pseudo-element with the 45° period
  (8 rays), a radial mask and the `--motion-loot-reveal-ms` duration; both
  `data-reduced-motion='true'` and `prefers-reduced-motion` remove it (`animation: none;
  opacity: 0;`).
- **Dead 2D orb chrome removed.** `LootboxReveal` no longer renders an orb
  (`lootbox-orb`/`lootbox-orb-core` and their keyframes had no consumer); the flash, card
  and 1290 ms phase timing remain.
- **Runtime chrome restyled on its own rule.** AC-27 requires `.game-runtime-status`/
  `.game-runtime-error` at layer 3 and the per-surface table asks for the Neon Forge
  surface; they are deliberately not added to the shared AC-18 frame list.
- **Two test tiers for a CSS change.** The source guard is the unit tier; the jsdom block
  mounts real HUD/ambience/toggle/reveal markup with both shipped stylesheets and asserts
  computed frame/layer/minimized values through the real cascade (integration tier).
  Pseudo-element shapes (the flourish mask) stay source-guarded because jsdom does not
  compute `::before` styles.

## Raw source evidence

### Tokens and motion map

`game-view.css:18` keeps exactly the accepted nine `:root` tokens:

```css
:root {
  --panel-bg-top: rgba(5, 11, 24, 0.86);
  --panel-bg-bottom: rgba(10, 22, 44, 0.8);
  --panel-border: rgba(124, 246, 255, 0.62);
  --panel-glow: rgba(124, 246, 255, 0.35);
  --panel-radius: 1rem;
  --users-badge-top: #d63a2f;
  --users-badge-bottom: #a51f1f;
  --coin-gold: #ffcc66;
  --upgrade-green: #16a34a;
}
```

`game-view.css:36` maps 17 durations on `main` (13 accepted + 4 new, AC-32):

```css
main {
  --motion-coin-pop-ms: 1100ms;
  --motion-loot-charge-ms: 420ms;
  --motion-loot-orb-ms: 250ms;
  --motion-loot-flash-ms: 120ms;
  --motion-loot-reveal-ms: 360ms;
  --motion-loot-settle-ms: 140ms;
  --motion-level-burst-ms: 760ms;
  --motion-banner-peak-ms: 250ms;
  --motion-banner-settle-ms: 450ms;
  --motion-banner-halo-ms: 250ms;
  --motion-equip-row-ms: 260ms;
  --motion-equip-pulse-ms: 260ms;
  --motion-upgrade-pulse-ms: 260ms;
  --motion-ui-panel-enter-ms: 220ms;
  --motion-ui-button-press-ms: 90ms;
  --motion-ui-glow-pulse-ms: 2400ms;
  --motion-ui-reveal-spotlight-ms: 260ms;
}
```

`game-view.css.test.ts` imports `MOTION` and asserts each declaration equals
`${MOTION.<token>}ms` (13 accepted + `uiPanelEnterMs`, `uiButtonPressMs`,
`uiGlowPulseMs`, `uiRevealSpotlightMs`). `:root` contains no `--motion-` declaration.

### Old gameplay frame removed

```text
$ grep -nE 'border-image|content: none|clip-path: none' src/frontend/src/ui/game-view.css
(no matches)
```

The old grouped selector
`.hud-panel, .upgrades-panel, .customization-panel, .activity-feed, .leaderboard,
.user-panel .users-list` no longer exists as a rule. The source guard walks every shared
surface and asserts none declares `border`, `border-radius`, `background`, `box-shadow`,
`clip-path` or `backdrop-filter`. `game-view.css.test.ts` also asserts `app.css` still
contains the exact 11-selector frame rule and the six-title AC-29 block.

### HUD and minimized contract

```css
.hud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.hud-resources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.15rem;
}

.hud-resources [data-resource] {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 1.6rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--gf-rim);
  border-radius: 999px;
  background: var(--gf-surface-raised);
  white-space: nowrap;
}

.hud-resources [data-stat='coins'] {
  color: var(--gf-gold);
}

.hud-panel .hud-grid {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.15rem;
}

.hud-panel[data-minimized='true'] .hud-grid {
  display: none;
}
```

The obsolete `main > section[data-minimized='true'] p` rule is absent from both
stylesheets (asserted). Coin popups anchor inside the coins chip:
`.hud-panel [data-resource='coins'] { position: relative; }`.

### Non-modal reveal spotlight (AC-21/AC-27/AC-30)

Base reveal state (`game-view.css:480`):

```css
.customization-panel[data-reveal-active='true'] {
  z-index: 20;
  animation: reveal-spotlight var(--motion-ui-reveal-spotlight-ms) ease-out both;
}
```

Desktop boundary (`game-view.css:495`):

```css
@media (min-width: 721px) {
  .customization-panel[data-reveal-active='true'] {
    top: 50%;
    left: 50%;
    right: auto;
    bottom: auto;
    transform: translate(-50%, -50%);
    width: min(34rem, calc(100vw - 2rem));
    max-width: min(34rem, calc(100vw - 2rem));
    max-height: min(88vh, 42rem);
    z-index: 20;
  }
}
```

Mobile bottom sheet inside the one `max-width: 720px` block:

```css
.customization-panel[data-reveal-active='true'] {
  top: auto;
  left: calc(1rem + env(safe-area-inset-left, 0px));
  right: calc(1rem + env(safe-area-inset-right, 0px));
  bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
  transform: none;
  width: auto;
  max-width: none;
  max-height: 60vh;
  z-index: 20;
}
```

The toggle is `z-index: 21` (`game-view.css:456`); the test asserts `21 > 20`. There is
no `scrim` token/selector and no `main[data-reveal-active…]` selector. The reveal animation
is opacity-only, so it never clobbers the `translate(-50%, -50%)` centring.

### Epic 8-ray flourish (AC-14)

```css
.lootbox-reveal[data-rarity='epic'] .lootbox-stage::before {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  width: 18rem;
  height: 18rem;
  transform: translate(-50%, -50%);
  background: repeating-conic-gradient(from 0deg, var(--gf-epic) 0deg 2deg, transparent 2deg 45deg);
  -webkit-mask: radial-gradient(circle, transparent 0 28%, #000 32% 62%, transparent 66%);
  mask: radial-gradient(circle, transparent 0 28%, #000 32% 62%, transparent 66%);
  opacity: 0;
  animation: epic-ray-burst var(--motion-loot-reveal-ms) ease-out both;
  pointer-events: none;
}

@keyframes epic-ray-burst {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6) rotate(0deg); }
  30% { opacity: 0.9; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2) rotate(22.5deg); }
}
```

`.lootbox-stage { position: relative; … overflow: visible; }` is the containing block.
A 45° period over 360° is exactly eight rays (the test parses the period from the
background and asserts `360 / 45 === 8`). Reduced motion:
`.lootbox-reveal[data-reduced-motion='true'] .lootbox-stage::before { animation: none;
opacity: 0; }` and the same declarations inside the single `prefers-reduced-motion` block.
Rare/epic label channels: `var(--gf-rare)` / `var(--gf-epic)`.

### Ambience and layering (AC-27)

```css
.game-ambience {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, transparent 0 58%, rgba(4, 6, 13, 0.55) 100%), radial-gradient(circle at 14% 86%, rgba(124, 246, 255, 0.14), transparent 38%);
}

.game-ambience::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent 0 2px, var(--gf-scanline) 2px 3px);
  animation: ambience-scanline var(--motion-ui-glow-pulse-ms) ease-in-out infinite alternate;
}
```

Three procedural layers: the scanline (`::before`) plus the vignette and corner-glow
gradients on the element. The z-index contract is source-pinned:

| Layer | Selector | Value |
| --- | --- | --- |
| canvas | `main > canvas` | `position: relative; z-index: 0;` |
| ambience | `.game-ambience` | `z-index: 2;` |
| panels/controls | `.hud-panel, .upgrades-panel, .customization-panel, .activity-feed, .leaderboard, .user-panel .users-list, .connection-banner, .phase-announcement, .user-panel, .game-runtime-status, .game-runtime-error, main > section` | `z-index: 3;` |
| level | `.level-complete` | `z-index: 5;` |
| reveal | `.customization-panel[data-reveal-active='true']` | `z-index: 20;` |
| customization toggle | `.customization-toggle` | `z-index: 21;` |
| auth | `.auth-menu, .auth-forms` (app.css) | `z-index: 100;` |

Reduced motion includes `.game-ambience::before` with `animation: none; transition: none;`
and the static gradients remain.

### Feed, leaderboard, crew and connection chrome

- `.gf-live-dot` is a 0.45 rem success dot with a `--motion-ui-glow-pulse-ms` scale/opacity
  pulse; both `data-reduced-motion='true'` feed/leaderboard variants disable it.
- Activity glyphs: `cubeCleared` green square, `fastClear` amber `»`, `levelMilestone`
  gold 45° diamond, `epicLoot` violet star `clip-path`, `memberJoined` cyan dot,
  `memberLeft` muted dot. The accepted 160 ms entry stays and is disabled under both
  reduced-motion paths.
- Leaderboard: `.leaderboard-medal` + `.leaderboard-bar`; ranks 1/2/3/4-5 use
  gold/`#cbd5e1`/`#d08b4f`/cyan, and the bars are exactly `100% / 80% / 64% / 50% / 40%`.
- `.users-count`, `.users-list-title` spacing, `.user-panel li button` raised cards and the
  `[data-level]::after` level chip. `.users-badge` keeps 44 px/red pill/focus ring.
- `.connection-dot` pulses; `[data-status]` recolours both the dot and the shared chip rim
  (`connecting` cyan, `disconnected` amber, `exhausted` danger).

## Raw verify output

```text
$ npm run lint

> lint
> eslint .
LINT_EXIT=0
```

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

```text
$ npm test --workspace @cubeclicker/frontend

 ✓ src/App.test.tsx (50 tests)
 ...
 Test Files  77 passed (77)
      Tests  2362 passed (2362)
TEST_EXIT=0
```

Focused T7 suite (raw):

```text
$ npx vitest run src/ui/game-view.css.test.ts

 ✓ src/ui/game-view.css.test.ts (70 tests) 213ms

 Test Files  1 passed (1)
      Tests  70 passed (70)
```

```text
$ npm run coverage --workspace @cubeclicker/frontend

      Coverage enabled with v8
 Test Files  77 passed (77)
      Tests  2362 passed (2362)
 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   96.74 |    96.44 |   97.86 |   96.74 |
COVERAGE_EXIT=0
```

Thresholds are the unchanged workspace 80/80/80/80; no exclusion or threshold edit.

```text
$ git diff --check
(no output)
DIFFCHECK_EXIT=0
```

Extra proof (not in T7's verify list, same CSS through the production pipeline):

```text
$ npm run build

dist/assets/index-D034SwcG.css  38.34 kB │ gzip: 7.23 kB
initial files=2 raw=319179 gzip=98814 budget=150000
three assets/three-4kUmpljF.js raw=610310 gzip=154617 budget=165000
total files=6 raw=1001674 gzip=279550 budget=300000
Bundle budget OK.
BUILD_EXIT=0
```

## Assertion integrity

- No banned matchers: `grep -nE 'anything\\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toHaveBeenCalled\\(\\)'` returns no
  matches; no `toBeTruthy`/`toBeDefined`/`not.toThrow` stand-ins.
- Every assertion is a concrete selector/declaration/value; the CSS parser helper splits
  top-level and media rules, normalizes selector whitespace and compares exact declaration
  lists/maps.
- The jsdom integration block asserts computed values from the shipped `app.css` +
  `game-view.css`: shared chamfer `clip-path`, HUD `position: absolute` at layer 3, minimized
  grid `display: none`, expanded grid `display: flex`, canvas `relative`/0, ambience
  `absolute`/2/`pointer-events: none`, toggle 21, reveal panel 20, normal panel 3, stage
  `position: relative`.
- No test is a tautology or snapshot; each added guard can fail on a real selector/value
  regression (the flourish ray count is derived from the parsed 45° period).

## Acceptance audit

- **AC-14 — met (CSS share).** Rare/epic label channels are `var(--gf-rare)`/
  `var(--gf-epic)`; the epic-only flourish selector, exact 18 rem geometry, 45° period (8
  rays), mask, 0.6→1.2 scale/22.5° keyframes and both reduced-motion off-switches are
  source-pinned, including the `--motion-loot-reveal-ms` duration. Component
  `data-rarity`/`Duplicate`/owned-count evidence stays T5/LootboxReveal.
- **AC-18 — met.** The old rounded grouped rule and all pseudo resets are gone; no shared
  surface declares a border/background/shadow/clip-path/backdrop filter in
  `game-view.css`; the app.css 11-selector frame and AC-29 block are asserted; the
  `.users-badge`/toggle stale resets are replaced by 1 px control chrome. The jsdom test
  proves the shared chamfer clip actually cascades onto `.hud-panel`.
- **AC-19 — met (CSS share).** `.hud-header`, `.hud-level`, `.hud-resources`,
  `[data-resource]` chips, gold coins value, `.hud-grid` and the exact
  `.hud-panel[data-minimized='true'] .hud-grid { display: none; }` rule; the obsolete
  `main > section[data-minimized='true'] p` rule is absent from both stylesheets; jsdom
  asserts hidden/visible.
- **AC-20 — met (CSS share).** Upgrade title/balance spacing, `[data-affordable='true']`
  cost accent, `maxLevel` pips (`data-filled` success), the circular 44 px green buy
  control with the `--gf-success` rim and disabled state; T9 owns the markup/audit.
- **AC-21 — met (CSS share).** `.gf-chip`, `.customization-swatch`, variant rarity
  colours, base reveal state at layer 20, the complete 721 px override (including
  `right: auto`, `bottom: auto`, 34 rem `max-width`) and the complete 720 px bottom sheet
  with all three safe-area offsets and `z-index: 20`; toggle 21. No scrim/main attribute.
- **AC-22 — met (CSS share).** Live dot, all six distinct event glyphs/colours, 160 ms
  entry, `data-reduced-motion` row and dot disables.
- **AC-23 — met (CSS share).** Medal/bar spans styled, rank colour channels and the fixed
  `100/80/64/50/40%` bar widths, live dot, row entry and reduced-motion disables.
- **AC-24 — met (CSS share).** Count badge, live dot, `Crew` heading spacing, scrolling
  list, raised member cards and the `data-level` chip; 44 px pill retained.
- **AC-25 — met (CSS share).** Status dot before the text with the pulse and the exact
  cyan/amber/danger chip + dot channels; the pulse is in the reduced-motion off list.
- **AC-27 — met.** One `.game-ambience` layer (scanline `::before` + vignette + corner
  glow) at `position: absolute; inset: 0; z-index: 2; pointer-events: none;`; canvas 0,
  panels/controls 3, level 5, reveal 20, toggle 21, auth 100; no scrim and no
  `data-reveal-active` on `<main>`; reduced-motion scanline off with static gradients.
- **AC-30 — met.** One 720 px block, one 721 px block, one short-viewport block and no
  480 px block in `game-view.css`; the HUD pill reservation (9 rem vs 8.5 rem) is
  unchanged and re-asserted; resources wrap and the header wraps on mobile; the reveal
  bottom sheet keeps the safe-area offsets; the upgrades panel still hides while
  customization is open; the feed/leaderboard tops and short-viewport cap are unchanged.
- **AC-32 — met.** The four `--motion-ui-*-ms` declarations on `main` equal
  `MOTION.uiPanelEnterMs / uiButtonPressMs / uiGlowPulseMs / uiRevealSpotlightMs`; the 13
  accepted mappings are unchanged; the new animations use the durations and are disabled
  under reduced motion.
- **AC-34 — met (CSS scope).** No rAF/render/light/post-processing/quality change; the
  stylesheet adds only compositor-friendly transform/opacity animations; `npm run build`
  stays within the bundle budget (total 279,550 B gzip vs 300,000 B).

## Deviations from spec

None from the pinned T7 declarations. Two scoped notes:

1. This task is CSS-only; the AC-19/20/21/22/23/24/25 markup/data assertions belong to
   T8/T9/T10 by the task graph. The class/data hooks are styled here and listed in the
   handoff below.
2. The dead 2D orb CSS (`lootbox-orb`, core and three keyframes) was removed because the
   T3 reveal component no longer renders it; the flash/card/timeline presentation is kept.

## Handoff notes (not deviations)

- **T8 `Hud.tsx`** — the CSS expects `.hud-header` (`h2.hud-title` + `span.hud-level`),
  `.hud-resources` with three `[data-resource]` chips, `.hud-resource-value` values
  (`[data-stat='coins']` gets the gold channel), `.hud-grid` with three `.hud-row`s and the
  minimize button. Render coin pops inside `[data-resource='coins']`.
- **T9** — keep `class="users-badge"`, add `.users-count` + `.gf-live-dot`, add
  `data-level` on member buttons, `.upgrades-balance`, `.upgrade-pips`/`.upgrade-pip`
  (`data-filled`), `data-affordable` on each row and `data-status`/`.connection-dot` on
  the banner. `.upgrade-buy` stays circular/44 px.
- **T10** — add `aria-hidden` `.gf-live-dot` inside both titles, `.leaderboard-medal` and
  `.leaderboard-bar` with `data-medal`/`data-bar`; keep row `data-event-type`.
- **T11** — the 720/721 boundary is source-pinned; the visual/motion matrix still owns the
  real browser check (no browser automation is used here). The epic flourish is clipped by
  the panel's own scroll/clip bounds at the edges, as expected for a spotlight inside the
  framed panel.

## Verification checklist

- [x] `npm run lint` (exit 0)
- [x] `npm run typecheck` (exit 0)
- [x] `npm test --workspace @cubeclicker/frontend` (77 files / 2362 tests, exit 0)
- [x] `npm run coverage --workspace @cubeclicker/frontend` (exit 0; 96.74/96.44/97.86/96.74)
- [x] `git diff --check` (exit 0)
- [x] `npm run build` (extra; exit 0, budget OK)
- [x] Source/test changes restricted to `files_owned`; no component, app.css, theme, engine,
      render, multiplayer, backend, compose, Dockerfile or package changes

## Post-T8 fix (session reduced motion on the ambience)

T8 now emits `data-reduced-motion="true|false"` on `.game-ambience` (AC-27), but the T7
stylesheet only disabled `ambience-scanline` inside `@media (prefers-reduced-motion:
reduce)`, so a session preference not mirrored by the OS kept the scanline animating.

Fix (`game-view.css`, top-level and outside the media block):

```css
.game-ambience[data-reduced-motion='true'],
.game-ambience[data-reduced-motion='true']::before {
  animation: none;
  transition: none;
}
```

The scanline `::before` is the only ambience animation; the element selector covers any
future ambience animation and the declarations mirror the accepted media block, which is
kept unchanged. `game-view.css.test.ts` pins the exact selector/declarations with a
top-level `ruleBody` lookup (proving the session rule is not inside the media query); the
focused suite now has 71 tests. No component, app.css or theme file was touched.

Raw evidence (2026-11-16, after the fix):

```text
$ npx vitest run src/ui/game-view.css.test.ts
 ✓ src/ui/game-view.css.test.ts (71 tests) 197ms

 Test Files  1 passed (1)
      Tests  71 passed (71)
```

```text
$ npm run lint
LINT_EXIT=0

$ npm run typecheck
TYPECHECK_EXIT=0

$ git diff --check
DIFFCHECK_EXIT=0
```
