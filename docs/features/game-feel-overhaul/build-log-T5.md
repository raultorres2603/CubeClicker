# Build log — T5 — Customization panel reveal integration

Task: T5 (2026-11-16)
Branch: `feat/game-feel-overhaul` (checked out at `3acba32`; T1 `4421351`, T4 `f01c8b0`,
T2 `cfb7d96`, T3 `3acba32`). Not pushed.
Files changed:
- `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx` (edit — reveal branch, section
  `data-reveal-active`, catalog variants with `data-rarity` + swatch, dismiss/focus lifecycle)
- `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx` (edit — 43 panel tests, was 28)
- `docs/features/game-feel-overhaul/build-log-T5.md` (this file)

## What changed & why

1. The panel now has two branches keyed by `lastLootboxGrant`: the reveal branch renders
   `<LootboxReveal>` **only** (no title/counts/open control/slot rows/preview, so the panel
   owns one WebGL context) and the normal branch renders the `Spaceship hangar` title, the
   two `.gf-chip` counts, `Open lootbox` as `customization-open gf-cta`, the ten slot rows
   and the `SpaceshipPreview`.
2. The section always carries `data-reveal-active="true|false"` (AC-13/AC-21); the reveal
   branch passes the player's real `appearance` + `parts` + the panel `revealPhase` to
   `LootboxReveal`, which stages the catalog slot internally (see D-2).
3. The panel keeps the accepted 1290 ms phase machine (420/250/120/360/140, reduced motion →
   `rest`) and the accepted `data-equipping` row flash (`MOTION.equipRowFlashMs` = 260 ms,
   suppressed under reduced motion). `Equip` in the reveal calls the panel `handleEquip`
   (slot flash + `onEquip`) and then `onDismissReveal` — LootboxReveal already sequences
   those two calls, so the panel passes its handlers straight through.
4. Dismissal/focus: an **unmount-only** cleanup (empty deps) reads the latest grant and the
   latest `onDismissReveal` through refs and calls it once iff a grant is still present, so a
   grant-to-grant replacement never dismisses. An **in-panel** dismissal (Dismiss/Escape/
   Equip) arms a focus-restoration effect that focuses `Open lootbox` after the grant clears;
   unmount never restores focus (the button is gone, body keeps it).
5. Every catalog variant gained `data-rarity` and one `aria-hidden` `.customization-swatch`
   with the catalog `color` as its inline `background`.

## Decisions

- **D-1 — Section mirror of the reveal identity (documented deviation).** The section
  renders the four sanitised grant attributes (`data-part-id`, `data-slot`, `data-rarity`,
  `data-duplicate`) next to `data-reveal-active` while a grant is present, using the same
  catalog-derived slot and the same `unknown`/`''` sanitisation as the reveal. Reason: the
  pre-existing App integration assertion in `src/frontend/src/App.test.tsx` resolves
  `document.querySelector('[data-reveal-active="true"]')` and then reads those four
  attributes from the first match; once AC-21 puts `data-reveal-active` on the section, the
  section is the first match and that test (owned by T8, outside T5's `files_owned`) reads
  the section instead of `.lootbox-reveal`. Options were (a) edit `App.test.tsx` outside
  `files_owned`, (b) leave the frontend suite red, or (c) mirror the attributes. (c) keeps
  the T5 gate green and keeps the App assertion meaningful; T8 rewrites that App-level
  assertion for AC-13 and can retarget it to `.lootbox-reveal`. The mirror is sanitised
  (never copies the raw wire `slot`/`partId`) and is covered by the panel invalid-part test
  plus the App integration test.
- **D-2 — The panel passes the real appearance; `LootboxReveal` stages it.** Passing a
  pre-staged appearance (granted part written into the catalog slot) would make the
  component's `isEquipped` check true and disable `Equip`. T3's component owns
  `stageAppearance = { ...normalizeAppearance(appearance), [resolvedSlot]: grant.partId }`
  and `createRevealStage` applies it once (AC-5 evidence in `lootbox-reveal.test.ts`).
- **D-3 — Phase timers stay in the panel.** The accepted 420/250/120/360/140 `setTimeout`
  chain stays in the panel and is passed as the `phase` prop (the component's `idle →
  charge/rest` mapping covers the first grant render), so the DOM phase and the stage clock
  start together.
- **D-4 — No new prop surface.** The panel keeps its accepted props (including `onOpen`/
  `onEquipPart` legacy aliases) and does not expose LootboxReveal's test seams; the panel
  reveal tests exercise the real component in jsdom, where the absent WebGL context exercises
  the inline-SVG fallback path (`data-reveal-3d="unavailable"`).

## Branch / dismissal / focus evidence

Panel tests (`src/ui/SpaceshipCustomizationPanel.test.tsx`, 43 tests) assert:

- **Branches (AC-13/AC-21).** Normal: section `data-reveal-active="false"`, no
  `.lootbox-reveal`, no section grant attributes, 10 slot rows, preview present. Reveal:
  section `data-reveal-active="true"`, exactly one `.lootbox-reveal`, and **no** `h2`,
  `.customization-counts`, `button.customization-open`, `.customization-slots`,
  `li.customization-slot` or `.spaceship-preview`; no `[role="dialog"]`, no
  `[aria-modal="true"]`, no scrim element.
- **Reveal DOM (AC-7/AC-14).** Rare/new: `role="group"`, `aria-live="off"`,
  `aria-label="Lootbox reveal: Port Silver Wing"`, `data-reveal-sequence="1"`,
  `data-reveal-phase="charge"`, `data-part-id="wing-left-silver"`,
  `data-slot="wing-left"`, `data-rarity="rare"`, `data-duplicate="false"`,
  `data-owned-count="2"`, texts `Rare` / `Port Silver Wing` / `Port Wing` / `New` /
  `Owned ×2`, and the two reveal buttons. Epic duplicate: `data-rarity="epic"`,
  `data-duplicate="true"`, `Epic` / `Gold Hull` / `Hull` / `Duplicate` / `Owned ×3`.
  Unknown part: `data-part-id="unknown"`, `data-slot=""`, `data-owned-count="0"`,
  `data-reveal-3d="unavailable"`, `aria-label="Lootbox reveal: Unknown part"`, and a DOM
  scan proves neither `mystery-part` nor `warp-core` appears in any attribute or text.
  Wire slot `hull`, `warp-core` and `''` all render catalog `data-slot="wing-left"`.
- **Timeline.** Exact boundaries at 419/420, 669/670, 789/790, 1149/1150 and 1289/1290 →
  `charge → orb → flash → reveal → settle → rest`; a new sequence restarts at `charge`.
  Reduced motion is `rest` immediately, `data-reduced-motion="true"`, with
  `vi.getTimerCount() === 0` for the phase timers (only `setTimeout`/`clearTimeout` faked;
  React's scheduler message loop is not a phase timer) and stays `rest` after 1290 ms.
- **Equip.** Call log is exactly `['equip:wing-left-silver', 'dismiss']` (one `onEquip` with
  the granted id, then one `onDismissReveal`); after the parent clears the grant the
  reappearing `li[data-slot="wing-left"]` has `data-equipping="true"` and loses it after
  exactly `MOTION.equipRowFlashMs` (260 ms).
- **Dismiss/Escape.** Dismiss click → `onDismissReveal` once; Escape from the focused Equip
  → once; 10,000 fake ms with no input → still mounted, zero dismissals (no auto-dismiss).
- **Focus.** Mount focuses `Equip Port Silver Wing`; after Dismiss and after Escape with the
  grant cleared, `document.activeElement` is the `Open lootbox` button.
- **Unmount (AC-13).** Unmounting while revealing calls `onDismissReveal` exactly once
  (0 before unmount); reopening renders the normal branch, `data-reveal-active="false"`, no
  reveal, and does not dismiss again. A grant-to-grant replacement (sequence 1 → 2, epic
  hull) calls it 0 times before unmount and exactly once on unmount.
- **No unmount focus restore.** Focus is on the reveal Equip before unmount;
  `document.activeElement === document.body` after unmount and still body after rendering
  the normal panel again (never the absent `Open lootbox`).
- **AC-5.** The `appearance` object passed by the parent is deep-equal before/after mounting
  and running the reveal (1290 ms advanced); after clearing the grant the normal rows still
  show the real equipped parts (`Gold Hull` hull, standard `Port Wing` wing), never the
  staged grant.

## Raw verify output

```
$ npm run lint
> lint
> eslint .

EXIT=0
```

```
$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT=0
```

```
$ npm test --workspace @cubeclicker/frontend
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 Test Files  77 passed (77)
      Tests  2385 passed (2385)
   Duration  3.58s (transform 9.71s, setup 0ms, collect 24.02s, tests 12.56s, environment 8.55s, prepare 6.56s)
EXIT=0
```

Baseline before T5 was 2370 tests; this task adds 15 (28 → 43 panel tests). Includes
`src/ui/LootboxReveal.test.tsx` (39), `src/App.test.tsx` (50) and
`src/ui/DeferredSpaceshipCustomizationPanel.test.tsx` (5) unchanged and green.

```
$ npm run coverage --workspace @cubeclicker/frontend
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 Test Files  77 passed (77)
      Tests  2385 passed (2385)
All files          |   96.74 |    96.44 |   97.86 |   96.74 |
  ...tionPanel.tsx |    96.9 |    91.89 |     100 |    96.9 | ...71-272,278-279
  ...boxReveal.tsx |   98.24 |    94.94 |     100 |   98.24 | 152-153,273-274
EXIT=0
```

Thresholds are 80 statements/branches/functions/lines per workspace; all four are green. The
two covered rows are `SpaceshipCustomizationPanel.tsx` (96.9 / 91.89 / 100 / 96.9; the
uncovered lines are the pre-existing legacy `handleEquip` invalid-id return and the
`onEquipPart` alias) and `LootboxReveal.tsx` (unchanged, T3). No exclusion or threshold was
changed.

```
$ git diff --check
(no output)
EXIT=0
```

## Acceptance audit

- **AC-5 — Try-on appearance, no mutation: met (panel share).** The panel passes the real
  `appearance`/`parts`; `LootboxReveal`/`createRevealStage` derive the catalog slot and stage
  `{ ...normalizeAppearance(appearance), [resolvedSlot]: grant.partId }` (T2/T3 tests). The
  panel test proves the parent's `appearance` object is unchanged and the normal branch
  keeps the real equipped parts; the wire slot never reaches the stage (`data-slot` stays
  catalog-derived for `hull`/`warp-core`/`''`). `game/customization.appearance` is only
  changed by equip/unequip (engine tests, T3/T4 untouched).
- **AC-7 — Reveal DOM and card contract: met (panel share).** The panel renders the T3
  component unmodified; tests pin `role="group" aria-live="off"`, the catalog label, the
  never-`idle` phase, the catalog-derived `data-part-id`/`data-slot`, rarity/duplicate/owned
  data, the card text and the two accessible buttons, including the fixed invalid values and
  the no-raw-string scan. No live region is added. (The exhaustive attribute map is T3's
  `LootboxReveal.test.tsx`.)
- **AC-8 — Dismiss and equip behaviour: met (panel share).** Mount/sequence focus → Equip;
  Escape → once; Dismiss → once; Equip → `onEquip` then `onDismiss` once each, with the row
  flash; no auto-dismiss after 10 s; in-panel dismissal restores focus to `Open lootbox`.
- **AC-13 — Panel close is a dismissal: met (panel share).** Unmount calls `onDismissReveal`
  exactly once, reopening renders the normal branch with no reveal, `data-reveal-active`
  false/true, no focus restore on unmount (body). The App-level toggle-click assertion is
  T8's.
- **AC-14 — Rarity, duplicate and epic flourish: met (panel share).** `data-rarity` and
  `data-duplicate` plus the exact `Rare`/`Epic`/`New`/`Duplicate`/`Owned ×N` copy; the
  section mirror exposes the epic channel hook. The 8-ray flourish CSS is T7's.
- **AC-21 — Customization markup and spotlight: met (panel share).** Section
  `data-reveal-active`, `h2.customization-title` `Spaceship hangar`, two `.gf-chip` counts
  with `Lootboxes:`/`Keys:` text and `data-lootboxes`/`data-keys`, `Open lootbox` as
  `customization-open gf-cta`, 10 slot rows × 3 variants with `data-rarity` and one
  `aria-hidden` `.customization-swatch` (inline `background` = catalog `color`, asserted as
  `rgb(...)`), `SpaceshipPreview` in the normal branch, reveal branch = `LootboxReveal` only,
  no scrim/dialog; the accepted row flash and reduced-motion behaviour are retained. The
  desktop/mobile spotlight CSS and its boundary test are T7's.

## Deviations from spec

- **D-1 (section mirror)** as described above: four extra sanitised attributes on the panel
  section while revealing, required to keep the pre-existing, T8-owned `App.test.tsx`
  integration assertion resolving the granted identity without editing a file outside
  `files_owned`. No AC is weakened: the `.lootbox-reveal` region stays the AC-7 authority and
  the mirror is catalog-derived/sanitised.
- No other deviation. No dependency, protocol, backend, container, package or CSS change; no
  assertion weakened or deleted without a concrete replacement; `App.tsx`, `app.css` and
  `game-view.css` untouched.
