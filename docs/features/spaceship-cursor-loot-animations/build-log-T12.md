# Build log — T12 — UI integration: panel, App, CSS, HUD, upgrades, banner

Task: T12 (2026-11-08)
Files changed:
- `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx`
- `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx`
- `src/frontend/src/App.tsx`
- `src/frontend/src/App.test.tsx`
- `src/frontend/src/ui/app.css`
- `src/frontend/src/ui/app.css.test.ts`
- `src/frontend/src/ui/game-view.css`
- `src/frontend/src/ui/game-view.css.test.ts`
- `src/frontend/src/ui/Hud.tsx`
- `src/frontend/src/ui/Hud.test.tsx`
- `src/frontend/src/ui/UpgradesPanel.tsx`
- `src/frontend/src/ui/UpgradesPanel.test.tsx`
- `src/frontend/src/ui/LevelCompleteBanner.tsx`
- `src/frontend/src/ui/LevelCompleteBanner.test.tsx`
- `docs/features/spaceship-cursor-loot-animations/build-log-T12.md`

Sketch:
- Panel: ten `SLOT_CATALOG` rows with three variants, owned/locked/equipped, equip/unequip,
  `pendingOpen`, the 1290 ms reveal state machine and the 260 ms `data-equipping` flash.
- App: pass the session `pendingLootboxOpen`/`lastLootboxGrant`/dismiss/unequip, own the
  three-slot coin queue (1100 ms / 600 ms reduced) and the 1600 ms level-banner window.
- HUD/Upgrades: presentational `+delta` popups and a single 260 ms purchase row pulse.
- Banner: 16 gold + 8 cyan rays, 3 rings, 12 stars, 20 coins, halo, reduced variant.
- CSS: the 13 AC-34 tokens on `main`, the pinned keyframes, 44 px/focus targets and the
  reduced-motion variants; no shake.

What changed & why:
- `SpaceshipCustomizationPanel.tsx` now renders the v2 granular model instead of the legacy
  12-part list. It normalizes `parts`/`appearance` through `normalizePartMap`/
  `normalizeAppearance` (so restored legacy rows render), resolves each slot's equipped part
  with the standard fallback, and generates exactly ten slot rows in canonical order with
  three variants each. Owned variants expose `.customization-equip` (`aria-pressed`, text
  `Equipped` or the label `Equip <name>`); locked variants render `Locked` text and no button.
  Each row has a `.customization-unequip` with `aria-label="Unequip <slot>"`, disabled at the
  standard part. `pendingOpen` disables `Open lootbox`.
- The reveal uses the `lastLootboxGrant` contract: a `role="status" aria-live="polite"` region
  with `data-reveal-active`, `data-part-id`, `data-slot`, `data-rarity`, `data-duplicate`,
  the part/slot names, `Rare`/`Epic`, `New`/`Duplicate`, an `Equip` button and a `Dismiss`
  button. A panel-owned phase machine drives the pinned 420 + 250 + 120 + 360 + 140 =
  1290 ms timeline (`charge → orb → flash → reveal → settle → rest`); a new grant sequence
  restarts it (the region is keyed by sequence and the effect resets to `charge`), and
  reduced motion starts at the settled `rest` phase with no timers. The orb is inline SVG
  (wireframe sphere + orange core; no satellites).
- The panel owns the equip-row flash: an equip sets `data-equipping="true"` on the slot row
  for `MOTION.equipRowFlashMs = 260 ms`, cleared on timeout/unmount and skipped under
  reduced motion.
- `App.tsx` reads `pendingLootboxOpen` from the multiplayer snapshot and passes it, the
  snapshot `lastLootboxGrant`, `dismissLootboxReveal`, `unequipPart`, and the snapshot
  reduced-motion flag to the panel. It tracks coin increases into a three-entry queue
  (`MOTION.coinMaxConcurrent`), drops the oldest, and removes each entry after
  `MOTION.coinPopMs = 1100 ms` (or the static 600 ms reduced lifetime). It shows
  `LevelCompleteBanner` on a `levelIndex` increase for `MOTION.bannerHoldMs = 1600 ms`,
  restarting the hold if another level completes while visible. No coin HUD pulse is added.
- `Hud.tsx` renders at most the supplied popups as `+<delta>` (two decimals) inside the coins
  row with `aria-hidden`, while the numeric value stays the same-frame snapshot value; no
  `data-blinking` is set for coins. `UpgradesPanel.tsx` compares successive upgrade levels
  and sets `data-purchased="true"` on the changed row for `MOTION.upgradePulseMs = 260 ms`
  (skipped under reduced motion); the panel itself is never transformed.
- `LevelCompleteBanner.tsx` is the full-screen DOM burst: exactly 16 gold + 8 cyan rays,
  3 ring spans, 12 star glyphs and 20 coin glyphs inside an `aria-hidden` burst, the
  `LEVEL COMPLETE` title, the 1-based `Cube <n>` line and a halo span. It intentionally is
  not a live region so the shell keeps its single announcement stream; App owns visibility.
- `app.css` adds the panel scroll contract (`box-sizing: border-box`, `max-height: 60vh`,
  `overflow-x: hidden`, `overflow-y: auto`) plus the slot/variant layout and the shared
  44×44 px target rule for open/equip/unequip/reveal controls.
- `game-view.css` declares exactly the 13 AC-34 CSS-mapped motion tokens on `main` (no
  `:root` change) and the pinned animations: `lootbox-reveal 1290ms` with the charge/
  overshoot/flash/card-reveal/settle children, `coin-pop 1100ms` (scale 0.7→1 over 80 ms,
  45 px rise over 220 ms, then fade), `level-burst 760ms`, `level-banner` (peak 1.08 at
  250 ms, settle 450 ms, ±2° wobble), `banner-halo 250ms`, `equip-row-flash 260ms` and
  `upgrade-purchased 260ms`. It adds the accent `:focus-visible` rings, the panel/table
  reduced-motion data variants and adds every new animation to the reduced-motion block.
  There is no shake token, camera offset, or transform on `main`, `.hud-panel`,
  `.upgrades-panel` or `.customization-panel`.

Decisions:
- The panel owns the 1290 ms reveal phase machine (exact boundary timers at 420/670/790/
  1150/1290 ms) while CSS owns the visual envelopes; this makes the sequence observable in
  deterministic fake-timer tests and keeps the CSS keyframe total pinned at 1290 ms.
- The `data-equipping` flash owner is the panel (F11): CSS only styles the attribute, and
  reduced motion never sets it.
- The coin queue lives in App because only App sees the previous and current snapshot coin
  values; HUD stays presentational and its zero-pop markup is byte-identical to the previous
  HUD, so the existing exact-markup tests remain valid.
- The level banner window lives in App; the component renders the visible frame only. The
  banner is deliberately not a second `role="status"` live region (the shell's single
  announcement stream stays intact); the reveal is the AC-32-mandated live region.
- Reduced-motion variant behavior: the global `@media (prefers-reduced-motion: reduce)`
  block disables every new base animation, while the higher-specificity
  `[data-reduced-motion='true']` rules provide the AC-40 reduced variants (150 ms ≤15 %
  level overlay, 120 ms banner fade at scale 1/0°, static reveal/orb). The component flag
  comes from the engine snapshot, so the variants apply even when the media query and the
  snapshot agree.
- No documentation outside this build log was changed: T13 owns `README.md`,
  `docs/product/glossary.md` and the `docs/features/README.md` proposal. Pre-existing
  modified feature docs and `reviews/` were left untouched and are not staged.
- Only the T12-owned paths above were changed; no dependency, lockfile, container, backend,
  render, session, protocol, preview or parts edits.

Evidence:
- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .

  ```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > typecheck
  > tsc --noEmit

  ```
- `npm test --workspace @cubeclicker/frontend` → exit 0 (63 files / 1695 tests):
  ```
   ✓ src/ui/app.css.test.ts (87 tests) 21ms
   ✓ src/ui/game-view.css.test.ts (41 tests) 14ms
   ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 65ms
   ✓ src/ui/Hud.test.tsx (20 tests) 175ms
   ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 226ms
   ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (27 tests) 396ms
   ✓ src/App.test.tsx (38 tests) 705ms
   Test Files  63 passed (63)
        Tests  1695 passed (1695)
     Duration  2.83s
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (all four thresholds 80):
  ```
   Test Files  63 passed (63)
        Tests  1695 passed (1695)
  All files          |   96.28 |    95.26 |   97.42 |   96.28 |
    App.tsx          |   86.03 |    81.52 |   92.85 |   86.03 |
    Hud.tsx          |     100 |      100 |     100 |     100 |
    ...eteBanner.tsx |     100 |      100 |     100 |     100 |
    ...tionPanel.tsx |   96.84 |    88.99 |     100 |   96.84 |
    ...adesPanel.tsx |   96.74 |    90.62 |     100 |   96.74 |
  ```
  The only uncovered lines are the optional legacy-handler/optional-callback branches in
  `SpaceshipCustomizationPanel.tsx`, the pre-existing optional paths in `App.tsx`, and the
  optional reduced-motion timer branch in `UpgradesPanel.tsx`; the workspace aggregate is
  far above the gate.
- Focused test evidence: `SpaceshipCustomizationPanel.test.tsx` covers the ten-row/30-variant
  markup, owned/locked/equipped states, 44 px targets, pending open, reveal data/copy, every
  timeline boundary, sequence restart, reduced instant reveal, dismiss/equip routing and the
  260 ms row flash; `App.test.tsx` covers pending, grant/dismiss, equip/unequip routing, the
  coin queue (1100 ms, 600 ms reduced, max 3/oldest dropped) and banner hold/reduced/restart;
  `game-view.css.test.ts` covers each mapped token against `MOTION` and each pinned keyframe.
- Assertion quality: concrete expected values only (slot/part ids, exact counts, exact
  labels, phase boundaries, exact CSS declarations). No wildcard matchers, snapshots or
  assertion-free tests; no existing test was weakened.

Acceptance audit:
- AC-29 → met. Panel renders counts, one `Open lootbox` disabled on zero counts or
  `pendingOpen`, exactly 10 `.customization-slot` rows in `SLOT_CATALOG` order, exactly three
  `.customization-variant` entries per row with `data-owned`/`data-locked`/`data-equipped`,
  the slot/equipped names, owned `.customization-equip` controls (`aria-pressed`, `Equipped`
  or `Equip <name>`) and locked `Locked` text with no button. Every row has
  `.customization-unequip` with the pinned label and standard-part disable. App passes the
  session `pendingOpen`. Evidence: `SpaceshipCustomizationPanel.test.tsx` (slot/controls
  describes), `App.test.tsx` (pending/enabled), full suite.
- AC-30 → met. Every panel command has a 44×44 px target and an accent `:focus-visible`
  rule; native `button type="button"` semantics and accessible names are used; the section
  keeps `aria-label="Spaceship customization"` and `data-mode`; locked entries have no
  button. The panel box is border-box with `max-height: 60vh` and hidden horizontal
  overflow, and the mobile band keeps it within the viewport. Evidence:
  `app.css.test.ts`, `game-view.css.test.ts` (focus/reduced), panel tests; the visual
  manual layout check is part of T14's manual matrix.
- AC-31 → met. The panel still renders `SpaceshipPreview` with the labeled canvas; the
  preview keeps all ten `data-preview-slot-*` attributes and its T11 behavior. Evidence:
  `SpaceshipCustomizationPanel.test.tsx` preview case; T11 tests stay green.
- AC-32 → met. A grant renders the `role="status" aria-live="polite"` region with
  `data-reveal-active`, `data-part-id`, `data-slot`, `data-rarity`, `data-duplicate`, part/
  slot names, `Rare`/`Epic`, `New`/`Duplicate`, an `Equip` and a `Dismiss` control. A new
  sequence restarts the reveal; `customizationUpdate` never clears it (App only passes the
  snapshot grant); `dismissLootboxReveal` clears it through the session. Evidence:
  panel and `App.test.tsx` reveal/dismiss cases.
- AC-39 → met. App creates one popup per coin increase, keeps at most
  `MOTION.coinMaxConcurrent = 3` dropping the oldest, and removes entries at 1100 ms (600 ms
  static under reduced motion). HUD renders the exact `+<delta>` (two decimals) and the
  numeric value from the same snapshot; no coin HUD pulse or shake is added. Evidence:
  `Hud.test.tsx`, `App.test.tsx` coin-queue describe, `game-view.css.test.ts` coin keyframes.
- AC-40 → met. App shows `LevelCompleteBanner` for 1600 ms on a level increase, restarting
  the hold on another completion; the component renders 16 gold + 8 cyan rays, 3 rings, 12
  stars, 20 coins, `LEVEL COMPLETE`, the 1-based Cube number and a halo. CSS pins the 760 ms
  burst, banner entry 0.2/−8°, 1.0 at ≈170 ms, 1.08 at 250 ms, 450 ms settle, ±2° wobble and
  250 ms halo; reduced motion uses the 150 ms ≤15 % overlay and 120 ms static banner. No
  HUD/camera shake. Evidence: `LevelCompleteBanner.test.tsx`, `App.test.tsx` banner describe,
  `game-view.css.test.ts` level cases.
- AC-41 → met. The reveal sequence is exactly 1290 ms
  (420 + 250 + 120 + 360 + 140), driven by the panel phase machine and the CSS keyframes;
  the orb charges 1→1.06→1, overshoots to 1.25, flashes 120 ms, the card reveals 360 ms with
  an 8 % overshoot and settles 140 ms; no satellites on the idle orb. Reduced motion renders
  the settled result instantly with a static orb and no charge/flash. Evidence: panel
  timeline/reduced tests, `game-view.css.test.ts` reveal case.
- AC-43 → met. Equip sets `data-equipping="true"` on the slot row for exactly
  `MOTION.equipRowFlashMs = 260 ms` (no flash under reduced motion), and an upgrade-level
  increase sets `data-purchased="true"` for `MOTION.upgradePulseMs = 260 ms` with one subtle
  row pulse (no pulse under reduced motion). No coin HUD pulse is added. Evidence: panel
  flash tests, `UpgradesPanel.test.tsx`, `App.test.tsx` upgrade case, CSS keyframes.
- AC-44 → met. No shake token or random offset exists; `main`, `.hud-panel`,
  `.upgrades-panel` and `.customization-panel` have no transform/translate/rotate/scale or
  animation declarations. Only child effects animate (coin popup, equip row, upgrade row,
  banner). Evidence: `game-view.css.test.ts` no-shake case, `app.css.test.ts` panel case.
- AC-48 → met for T12's surfaces. Reduced motion: coin popup static for 600 ms; lootbox
  reveal instant/static; equip row flash and upgrade pulse skipped; level overlay 150 ms
  ≤15 % with no rays/rings; banner fades at scale 1/0° in 120 ms with no halo. The CSS
  reduced block disables every new base animation/transition. Evidence: Hud/App reduced
  tests, panel reduced tests, UpgradesPanel reduced test, LevelCompleteBanner reduced case,
  CSS reduced-motion tests.

Deviations from spec: none. The reduced-motion data variants intentionally remain the
prescribed AC-40 reduced animations (higher-specificity `[data-reduced-motion='true']`
rules), while the global reduced block disables all non-reduced motion. No docs outside this
log were changed; T13 owns the documentation pass. Pre-existing modified feature docs and
`reviews/` are untouched and unstaged.
