---
feature: hangar-tabs-and-menu-motion
revision: 2
---
# Plan — Hangar Tabs & Menu Motion

## Base state

This plan is rebased on the **game-feel-overhaul review fixes (`544cce8`)**. That base already ships:

- `<main data-customization-open=… data-reduced-motion="true|false">` on the game main (`App.tsx`).
- The SSR/jsdom `data-reduced-motion` assertions in `App.test.tsx`.
- A top-level `main[data-reduced-motion='true']` session block in `game-view.css` (its selector list covers the HUD, the dots, the toggle/buy transitions, the reveal spotlight and the coin pop).

Consequences: **`App.tsx` and `App.test.tsx` are not edited by this feature**, and the session block is **extended**, never duplicated. Only `ui/game-view.css` + `ui/game-view.css.test.ts` (plus the panel, the tab module, the tokens and the docs) change.

## Architecture

Three presentation layers change; no state, protocol, persistence or container path does.

```text
game/parts-v2.ts  (SLOT_CATALOG, partsForSlot, normalizePartMap — unchanged, catalog authority)
        │
        ▼
ui/hangar-tabs.ts  (NEW, pure: 5 tab groups + tabForSlot + tabOwnedCount)
        │
        ▼
ui/SpaceshipCustomizationPanel.tsx  (tab state, tablist/tabpanel, one preview)
        │        │
        │        └──────────────► ui/SpaceshipPreview.tsx (unchanged, one instance)
        ▼
ui/game-view.css  (tab chrome, menu boot keyframes, scrollbars, crew pill,
        │          HUD minimize, preview heights, scoped reduced-motion selectors)
        ▼
App.tsx  (UNCHANGED — base 544cce8 already puts data-reduced-motion on <main>)
```

`game/motion.ts` gains the four tokens; `game-view.css` mirrors them as `--motion-*` on `main`, alongside the 17 accepted mappings.

### State ownership

- **Active tab** — panel-local `useState<HangarTabId>(HANGAR_DEFAULT_TAB)`. It never leaves the panel, is never persisted, and resets on every mount (a closed panel unmounts).
- **Post-reveal landing** — derived **during render**, not in an effect. The panel keeps a `prevSequence` state plus a `prevGrantRef`; when `sequence` transitions `non-null → null` it calls `setActiveTab(tabForSlot(partDefinition(prevGrant.partId).slot))` **in the render body** (React's documented "adjust state when props change" pattern). React discards the in-progress output and re-renders before committing, so the commit that leaves the reveal branch already carries the landing tab: no `frame` flash and exactly one `tab-panel-in` run. No loop is possible because the adjustment fires only on that transition (the `prevSequence` state is updated in the same block).
- **Badge counts** — derived per render from the already-normalized `parts` map (`normalizePartMap`); no new state, no memo (the map is tiny).
- **Reduced motion** — still owned by the session (`snapshot.reducedMotion`) mirrored on `<main>` by the **base**, and by the panel's prop for its row flash. This feature only adds scoped selectors to the two existing blocks.
- **Motion** — CSS only. No timer, no `requestAnimationFrame`, no JS state machine; the animation restarts because the element mounts.

### Panel lifecycle (normal state)

```text
mount ──► activeTab = 'frame'
  ├─ click/arrow on a tab ──► setActiveTab(next) ──► tabpanel remounts (key = id)
  ├─ equip/unequip ──► callback (unchanged) + row flash on the active tab
  ├─ Open lootbox ──► callback (unchanged)
  └─ grant arrives ──► reveal branch (no tabs, no preview)
          └─ grant cleared while mounted ──► render-phase adjustment ──► single commit
                  └─ activeTab = tabForSlot(granted slot) (frame for an unknown part)
```

## Interfaces / contracts

### `src/frontend/src/ui/hangar-tabs.ts` (new, pure)

```ts
import type { SlotId } from '../game/parts-v2';

export type HangarTabId = 'frame' | 'front' | 'wings' | 'engines' | 'ignitions';

export interface HangarTab {
  readonly id: HangarTabId;
  /** Tab-strip label, sentence case in the DOM (`Frame`, `Front`, …). */
  readonly label: string;
  /** The group's slots, in `SLOT_CATALOG` order (always exactly two). */
  readonly slots: readonly SlotId[];
}

export const HANGAR_TABS: readonly HangarTab[];
export const HANGAR_DEFAULT_TAB: HangarTabId; // 'frame'
export const HANGAR_TAB_LOOTABLE_TOTAL = 4;

/** The owning tab of a slot; throws `unknown slot: <id>` for anything else. */
export function tabForSlot(slot: SlotId): HangarTabId;

/** Owned lootable (non-standard) parts of the group, 0…4 (bilateral legacy ids count twice). */
export function tabOwnedCount(tab: HangarTab, parts: Record<string, number>): number;
```

`HANGAR_TABS` is a literal table asserted against `SLOT_CATALOG` by `hangar-tabs.test.ts` with **set equality** (union = the ten ids, no duplicate, no omission) plus per-tab catalog order — no cross-tab concatenation claim, because `frame = [hull, tail-fin]` cannot concatenate in catalog order.

`tabOwnedCount` receives the **normalized** map (`normalizePartMap`), so `wings-silver` is already two keys and the `wings` badge reads 2.

### `SpaceshipCustomizationPanel` additions

```ts
// Section attribute (normal state only):
//   data-active-tab="frame" | "front" | "wings" | "engines" | "ignitions"

<div className="customization-tabs" role="tablist" aria-label="Spaceship part groups">
  <button type="button" role="tab" className="customization-tab"
          id="customization-tab-wings" data-tab="wings"
          aria-selected={active === 'wings'} tabIndex={active === 'wings' ? 0 : -1}
          aria-label="Wings, 1 of 4 parts owned">
    Wings
    <span className="customization-tab-badge" data-owned="1" data-total="4" aria-hidden="true">
      1/4
    </span>
  </button>
  {/* … four more, HANGAR_TABS order — no `aria-controls` on any of them … */}
</div>
<div className="customization-tabpanel" role="tabpanel" key={activeTab}
     id="customization-tabpanel" data-tabpanel="wings"
     aria-labelledby="customization-tab-wings">
  <ul className="customization-slots">{/* exactly two rows */}</ul>
</div>
<SpaceshipPreview appearance={appearance} />
```

**ARIA choice.** One panel exists, so `aria-controls` is **omitted** (no tab references an id that is not in the document); the panel points back with `aria-labelledby` to the selected tab's stable `id`. `key={activeTab}` restarts `tab-panel-in`; the strip and the preview live outside the keyed subtree, so neither remounts.

Keyboard handler on the tablist:

```ts
ArrowRight → index + 1 (mod 5)   ArrowLeft → index - 1 (mod 5)
Home       → 0                   End       → 4
// every handled key calls event.preventDefault() so the 60vh panel does not scroll
// selection + focus move together; any other key returns without a state change
```

### `game/motion.ts` additions

```ts
menuBootMs: 320,
menuFlickerMs: 120,
menuChromaMs: 90,
tabSwitchMs: 140,
```

### `ui/game-view.css` contract (new blocks)

```css
main {
  --motion-menu-boot-ms: 320ms;
  --motion-menu-flicker-ms: 120ms;
  --motion-menu-chroma-ms: 90ms;
  --motion-tab-switch-ms: 140ms;
}

/* Hangar tabs */
.customization-tabs { position: sticky; top: 0; z-index: 1; display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr)); gap: 0.25rem;
  padding: 0.15rem 0 0.35rem;
  background: linear-gradient(180deg, var(--gf-surface-top), var(--gf-surface-bottom)); }
.customization-tab {
  /* inline-flex (label + badge), padding: 0.25rem 0.4rem, gap: 0.25rem,
     min-height: 44px, font-size: 0.68rem, letter-spacing: 0.06em,
     white-space: nowrap, --gf-* only */
}
.customization-tab[aria-selected='true'] { /* rim + inset 0 -2px 0 underline */ }
.customization-tab:hover { border-color: var(--gf-rim-strong); color: var(--gf-text); }
.customization-tab:focus-visible { outline: 2px solid var(--gf-focus); outline-offset: 2px; }
.customization-tab-badge { /* min-width: 1.1rem; height: 1.1rem; padding: 0 0.2rem;
                               font-size: 0.6rem; white-space: nowrap; --gf-void / --gf-rim-strong */ }
.customization-tabpanel { animation: tab-panel-in var(--motion-tab-switch-ms) ease-out both; }
.customization-panel .spaceship-preview { height: min(12rem, 26vh); }

/* Menu boot: exactly the two user-opened menus (declared BEFORE the reduced-motion blocks) */
.customization-panel:not([data-reveal-active='true']),
.user-panel .users-list { animation: menu-boot var(--motion-menu-boot-ms) linear both; }
.customization-panel:not([data-reveal-active='true'])::before,
.user-panel .users-list::before { animation: menu-scan var(--motion-menu-boot-ms) linear both; }
.customization-panel:not([data-reveal-active='true'])::after,
.user-panel .users-list::after { animation: menu-rail var(--motion-menu-flicker-ms) steps(2, end) both; }
.customization-panel:not([data-reveal-active='true']) .customization-title,
.user-panel .users-list .users-list-title {
  animation: menu-chroma var(--motion-menu-chroma-ms) steps(3, end) both; }

/* Polish: additive scrollbar rule (no existing body changes) */
.customization-panel, .upgrades-panel, .user-panel .users-list {
  scrollbar-width: thin; scrollbar-color: var(--gf-rim) transparent; }
.customization-panel::-webkit-scrollbar, … { width: 6px; height: 6px; }
.user-panel > .users-badge { /* glass + --gf-rim */ }
.users-count { background: linear-gradient(180deg, var(--users-badge-top), var(--users-badge-bottom)); }
.hud-panel > button { align-self: flex-end; width: 1.5rem; height: 1.5rem; /* … */ }

@media (max-height: 760px) { .customization-panel .spaceship-preview { height: 8rem; } }

/* inside the existing 720px block: stacked label/badge so IGNITIONS fits */
.customization-tab { flex-direction: column; gap: 0.1rem; padding: 0.25rem 0.3rem;
  font-size: 0.66rem; letter-spacing: 0.04em; }
```

Keyframes use exactly the stops pinned in spec § Sequence (`menu-boot` 0/12/22/34/46/60/100, `menu-scan` 0/45/70/100, `menu-rail` 0/100, `menu-chroma` 0/50/100, `tab-panel-in` 0/100) and animate **only** `opacity`, `border-color`, `text-shadow`, `::before` `right` and `::after` `height`/`opacity`.

### Reduced-motion scoping (specificity-critical)

The boot rules out-specify a bare `.customization-panel`, so both blocks take the **scoped** selectors:

```css
/* inside the existing single @media (prefers-reduced-motion: reduce) block */
.customization-panel:not([data-reveal-active='true']),
.customization-panel:not([data-reveal-active='true'])::before,
.customization-panel:not([data-reveal-active='true'])::after,
.customization-panel:not([data-reveal-active='true']) .customization-title,
.customization-panel[data-reveal-active='true'],          /* the existing reveal-spotlight gap */
.customization-tabs,
.customization-tab,
.customization-tabpanel,
.user-panel .users-list,
.user-panel .users-list::before,
.user-panel .users-list::after,
.user-panel .users-list .users-list-title {
  animation: none;
  transition: none;
}
```

```css
/* the EXISTING top-level session block (line ~1446, base 544cce8) — extend its selector list */
main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true']),
main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true'])::before,
main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true'])::after,
main[data-reduced-motion='true'] .customization-panel:not([data-reveal-active='true']) .customization-title,
main[data-reduced-motion='true'] .customization-tabs,
main[data-reduced-motion='true'] .customization-tab,
main[data-reduced-motion='true'] .customization-tabpanel,
main[data-reduced-motion='true'] .user-panel .users-list,
main[data-reduced-motion='true'] .user-panel .users-list::before,
main[data-reduced-motion='true'] .user-panel .users-list::after,
main[data-reduced-motion='true'] .user-panel .users-list .users-list-title { /* + the accepted list */
  animation: none;
  transition: none;
}
```

Rules: every animation rule above is written **before** the media block; each scoped reduced-motion selector has **equal or higher** specificity than its producing rule (`.customization-panel:not(…)` 0,2,0 vs 0,2,0 → source order wins; the `main[…]`-prefixed variants are 0,3,x). The `reveal-spotlight` rule (0,2,0) now also has a (0,2,0) media selector, closing the pre-existing OS-preference gap.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/ui/hangar-tabs.ts` | New | Pure five-group tab catalog, `tabForSlot`, `tabOwnedCount` |
| `src/frontend/src/ui/hangar-tabs.test.ts` | New | Set-union closure, per-tab order, throw case, default, counts |
| `src/frontend/src/game/motion.ts` | Edit | `menuBootMs`, `menuFlickerMs`, `menuChromaMs`, `tabSwitchMs` |
| `src/frontend/src/game/motion.test.ts` | Edit | Four new tokens + unchanged accepted tokens |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx` | Edit | Tab strip/tabpanel, roving tabindex + `preventDefault`, badges, render-phase landing, keyed tabpanel; reveal branch untouched |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx` | Edit | Rewritten per-tab suite + tab/badge/keyboard/landing/reveal/control-count assertions |
| `src/frontend/src/ui/game-view.css` | Edit | Tab chrome, preview heights, menu boot keyframes/rules, scrollbars, crew pill, HUD minimize, scoped reduced-motion selectors in **both** existing blocks |
| `src/frontend/src/ui/game-view.css.test.ts` | Edit | Token map, keyframes, animated-surface sweep, reduced-motion scoping/order/specificity, no-transform, polish declarations, computed 44 px |
| `src/frontend/src/ui/UserPanel.test.tsx` | Edit | Crew list still mounts/unmounts with no timer; badge markup unchanged |
| `README.md` | Edit | `tabbed spaceship hangar`, `glitch boot animation` |
| `docs/architecture/frontend-rendering.md` | Edit | `## Menu motion` section (five keyframes, four tokens, tab structure) |
| `docs/product/glossary.md` | Edit | `### hangar tab`; `motion token` counts |
| `docs/features/hangar-tabs-and-menu-motion/build-log-T1..T5.md` | New | Raw evidence per task |

Untouched on purpose: `src/frontend/src/ui/app.css`, `src/frontend/src/ui/app.css.test.ts`, `src/frontend/src/App.tsx`, `src/frontend/src/App.test.tsx`, `ui/SpaceshipPreview.tsx`, `render/**`, `game/engine.ts`, `multiplayer/**`, `src/backend/**`, container assets, package manifests, `docs/features/README.md`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Five two-slot groups rather than ten per-slot tabs | Two rows is exactly "a smaller menu"; the strip is an auto-fit grid (three + two at the desktop width, three + two at 375 px and 320 px); the union is the catalog with no orphan | Ten per-slot tabs (too many tab stops, a full extra row of chrome); two tabs of five rows (still a long scroll) |
| 2 | Grouping lives in a pure `ui/hangar-tabs.ts`, derived from `SLOT_CATALOG` | One source of truth for "which slot is in which tab"; unit-testable without DOM; a catalog change fails a set-union test | Inline array in the component (untested, drifts); a backend/shared module (unneeded, no wire use) |
| 3 | One tabpanel at a time; the panel keeps one scroll container | Matches the APG tabs pattern, keeps the panel short, avoids nested scrollbars | Five panels with `hidden` — keeps ten rows mounted, pushes the preview down and adds four idle panels |
| 4 | No `aria-controls`; the panel carries `aria-labelledby` | One panel exists, so any per-tab `aria-controls` would be a dangling IDREF; the label direction is enough and axe-clean | `aria-controls` on all five pointing at one stable id (valid but redundant); `aria-controls` only on the selected tab |
| 5 | Preview outside the keyed tabpanel | One WebGL context, no remount per switch, the ship stays visible while browsing tabs | Preview inside the tab (remount churn, a second context lifecycle to guard) |
| 6 | `key={activeTab}` on the tabpanel | Restarts the 140 ms fade without JS timers; the strip and the preview stay mounted | A `data-switch` counter + manual class removal (more state, a timer); no tab motion |
| 7 | Landing tab derived during render | React's adjust-state-during-render commits once, so no `frame` flash and a single fade; testable with a MutationObserver | A `useEffect` (wrong-tab commit + double fade); remembering the last tab globally |
| 8 | Boot animation is four CSS keyframes over existing elements | No new DOM, no JS, no rAF, no dependency; the pseudo-elements already exist for the Neon Forge frame | A DOM overlay div per panel (new markup, new tests in every component); a JS-driven Web Animations sequence (bundle + timers) |
| 9 | Boot gated to `:not([data-reveal-active='true'])` | The reveal keeps its own 260 ms spotlight and must never run two entries at once | Removing the reveal spotlight and reusing the boot (changes an accepted animation) |
| 10 | Animate `opacity`/`border-color`/`text-shadow` on the panel and only `right`/`height` on the two tiny pseudo-elements — never `transform`/`filter` | The panel is `clip-path`-chamfered, uses `backdrop-filter`, and the reveal state relies on `transform: translate(-50%, -50%)` | A translateY rise (breaks the reveal centring, adds a containing block) |
| 11 | Both reduced-motion blocks carry **scoped** selectors, animations declared before them | The boot rules are (0,2,0) and would beat a bare `.customization-panel` (0,1,0); equal specificity + later source wins, and the same fix closes the pre-existing `reveal-spotlight` OS gap | Higher-specificity `!important` (banned); `:where()` wrappers (rebuilds the whole block) |
| 12 | The session block is the **existing** one (base `544cce8`), extended | Avoids a second block and a second owner; the App hook and its tests already ship and are not edited | Adding a second session block (duplicate off-switches, two owners); re-adding the App attribute (no-op) |
| 13 | No close animation; open-only | Closing unmounts (React), so an exit animation needs a closing state machine, delayed teardown and focus juggling | A 120 ms closing state (new timers, focus edge cases) |
| 14 | Polish lives in `game-view.css`, `app.css` untouched | The file already owns gameplay chrome, the motion map and both reduced-motion blocks; a single ownership keeps the DAG disjoint and keeps the base `app.css` assertions valid | Editing `app.css` (shared base rules, a second owner, a second test file) |
| 15 | The crew pill keeps the warm tokens but moves them to the count badge | Satisfies `game-feel-overhaul` AC-17 (values preserved and consumed) while the shell reads cyan/amber | Deleting the tokens (breaks AC-17); leaving the red pill (the screenshot defect) |
| 16 | HUD minimize stays 24 px but becomes a compact chevron via a `game-view.css` override | The screenshot shows a stretched bar; the accepted AC keeps the 24 px target and forbids promoting it to 44 px; the override avoids touching `app.css` | Making it 44 px (supersedes AC-19/AC-31); editing the base rule in `app.css` |
| 17 | Scrollbar declarations go in a **new** grouped rule | No existing `.customization-panel`/`.upgrades-panel`/`.user-panel .users-list` body changes, so the base exact-body assertions stay valid and only the crew/`main`/reduced-motion assertions are rewritten | Merging into the existing rules (forces three extra rewrites and blurs the owner) |

## Risks & mitigations

- **Reduced-motion specificity** → both blocks repeat the scoped selectors and the animations precede the media block; AC-17's source guard asserts order + specificity per selector, and the manual matrix includes an OS-preference row for the boot **and** the reveal spotlight. This is the F4 failure mode, now pinned.
- **Dangling IDREFs** → `aria-controls` is omitted entirely; AC-2 asserts its absence and AC-3 asserts the single `aria-labelledby` resolves to the selected tab's id.
- **Landing flash** → the render-phase adjustment commits once; AC-6's MutationObserver proof forbids a `frame` value in the transition and requires a single tabpanel in that commit.
- **Longest label fit (`IGNITIONS`)** → `minmax(5rem, 1fr)` tracks, `white-space: nowrap`, pinned padding/badge metrics, and the ≤720 px stacked label-above-badge layout; the manual matrix checks no clipped label/badge at 375/320.
- **Sticky inside a clipped, scrolling panel** → verified in the manual matrix; if a browser misbehaves the strip falls back to a static block (recorded, no AC change).
- **Opacity animation creates a temporary stacking context** → the panel's `z-index` and the layer table are unchanged and the animation ends at `opacity: 1`; AC-18 asserts no lasting style and the manual matrix checks the reveal still paints above the panels mid-sequence.
- **Boot vs. reveal spotlight collision** → gated by `:not([data-reveal-active='true'])`; AC-12/AC-14 sweep both selectors; a grant can only exist while the panel is mounted, so the two never share a mount.
- **Panel-height regression at 720p** → preview `min(12rem, 26vh)` + `8rem` under 760 px, single scroll container, sticky strip; `scrollHeight`/`clientHeight` recorded with a concrete ≤ 140 px bound; worst case the panel scrolls.
- **Broad test rewrite in the panel suite** → every removed assertion is replaced by a per-tab equivalent plus the union-of-ten and both control-count fixtures; the flash, focus, reveal and control assertions are untouched (AC-10).
- **`game-view.css.test.ts` forced rewrites** → the crew-pill bodies, the two reduced-motion selector lists, the `main` token list and the session-cascade markup test are rewritten as **replacement** assertions (named in the build log); the scrollbar rule is additive so three existing bodies stay untouched, and HUD sizing lives in `app.css` (untouched, its assertions keep passing).
- **Badge accessible name vs. visible label** → the accessible name starts with the visible label (`Wings, 1 of 4 parts owned`), preserving label-in-name; asserted in AC-5.
- **Tab ids colliding** → one panel instance per page, ids are constant per tab; no `useId` needed, and the test asserts a single tablist and a single `customization-tabpanel` id.
- **`scrollbar-width`/`::-webkit-scrollbar` portability** → both declarations ship; unsupported engines keep the platform scrollbar (cosmetic only).
- **Motion in tests** → jsdom has no animation engine, so the contract is asserted at the CSS-source level (keyframes/declarations/order/specificity) plus the DOM facts (mount/unmount, keyed remount, mutation records, zero timers); the visual proof is the manual matrix, as the project's no-browser-automation convention requires.
- **Bundle creep** → the tab module and the panel code are inside the deferred chunk; `npm run build` enforces 150,000 / 165,000 / 300,000 B and the report's `initial.files` membership; a miss blocks and the ceiling is not raised.

## Verification

Per-task pre-gate (every behavior-change task):

```bash
npm run lint
npm run typecheck
npm run test --workspace @cubeclicker/frontend
npm run coverage --workspace @cubeclicker/frontend
```

Final gate (T5): `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke` (recorded; `not applicable` if Podman is unavailable and no cross-service path changed), plus the scope gates from spec AC-23/AC-27/AC-28/AC-29 and the documentation greps from AC-26. Manual matrix (1920×1000 plus 1280×720 / 768×1024 / 375×667 / 320×568), `scrollHeight`/`clientHeight`, the accepted 10 s idle/active traces at 1280×720 and 1920×1080, budget bytes and the rollback note are recorded in `build-log-T5.md`; `BASE` is recorded as `BASE=$(git merge-base main HEAD)` and the base commit `544cce8` is named.

## Open questions

Q-1…Q-15 are listed with proposed defaults in the spec § Open questions; the approval checkpoint covers tab set/order/labels, default tab, preview placement, badge semantics, animation style/duration, animated surfaces, close animation, tab motion, crew pill, scrollbars, HUD minimize, panel height/preview size, mobile strip and the polish scope. **The checkpoint precedes the build**: a default is a local edit (tab table, token values, one rule block) only for Q-2…Q-6, Q-9…Q-14; changing **Q-1** (ten tabs), **Q-7** (more animated surfaces) or **Q-8** (a close animation) is a structural change that requires re-planning before the DAG is executed.
