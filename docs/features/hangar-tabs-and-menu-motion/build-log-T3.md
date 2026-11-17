# Build log — T3 — Hangar tabs in the panel

Task: T3 (2026-11-17), feature `hangar-tabs-and-menu-motion`, branch
`feat/hangar-tabs-and-menu-motion` (base `adcb7f2`).
Status: **complete** — implementation, tests, amendment and all task gates green.

Files changed:

- `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx` (owned)
- `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx` (owned)
- `src/frontend/src/App.test.tsx` (owned after the approved r2a scope extension)
- `docs/features/hangar-tabs-and-menu-motion/build-log-T3.md` (this log)
- `docs/features/hangar-tabs-and-menu-motion/tasks.md` (r2a amendment)
- `docs/features/hangar-tabs-and-menu-motion/spec.md` (r2a amendment)
- `docs/features/hangar-tabs-and-menu-motion/plan.md` (r2a amendment)

## Amendment (r2a) — test ownership correction, no design change

The first pass implemented the tabbed panel and hit a genuine spec conflict: AC-3/AC-10 render
only the active group's two rows, while two pre-existing assertions in
`src/frontend/src/App.test.tsx` pinned the ten-row panel, and AC-29/T5 required that file
byte-identical. The orchestrator approved **option A**: T3 owns those two assertions.

Documentation amended in this change (no AC added or renumbered, no design/scope change to the
feature):

- `tasks.md` — `src/frontend/src/App.test.tsx` added to T3 `files_owned`; T3 notes record the
  two forced rewrites; T5's `git diff --exit-code`/`git status` gates and the Base note no
  longer list `App.test.tsx` as untouched; the ownership note states T3 owns it for those two
  assertions only.
- `spec.md` — revision `2a`; AC-29 no longer requires `App.test.tsx` byte-identical and names
  the two T3-owned assertions; AC-17 keeps its `<main data-reduced-motion>` assertions and
  states only the two pre-tab panel assertions change; the base note, non-goals, boundaries
  and testing strategy aligned; revision-history line
  `r2a — test ownership correction (App.test.tsx assertions follow the tab UI; no design change)`.
- `plan.md` — base-state note and file inventory record the two edits; `App.test.tsx` removed
  from "untouched on purpose".

## What changed & why

1. The normal branch keeps the title, the two `gf-chip` counts and `Open lootbox` untouched,
   then adds `.customization-tabs[role="tablist"]` (five `role="tab"` buttons in `HANGAR_TABS`
   order, roving `tabIndex`, badge, accessible name) and exactly one keyed
   `role="tabpanel"` (`id="customization-tabpanel"`, `aria-labelledby="customization-tab-<active>"`,
   no `tabindex`) holding only the active group's two `SLOT_CATALOG` rows; `SpaceshipPreview`
   stays below it, mounted once. The section carries `data-active-tab` in the normal state only.
2. Selection is panel-local state (`frame` on mount). Click selects; `ArrowRight`/`ArrowLeft`
   (wrap)/`Home`/`End` select **and** move focus, each calling `event.preventDefault()` (the
   panel is the 60vh scroll container); any other key returns untouched. No tab carries
   `aria-controls`.
3. Badges come from `tabOwnedCount(tab, parts)` (approved argument order) over the already
   normalized map; accessible name `<Label>, <owned> of 4 parts owned`.
4. Post-reveal landing is a render-phase derivation (React "adjust state during render"): a
   `renderedSequence` state plus a `previousGrantRef` cache the departing grant and set
   `activeTab` before the commit leaves the reveal branch, so no `frame` rows paint and the
   keyed panel fades once (AC-6/AC-15). An unknown/invalid part lands on `frame` through the
   `isValidPartId` guard before `partDefinition` (which throws on unknown ids).
5. The reveal branch is untouched (no tablist/tabpanel/tab/preview and no `data-active-tab`
   while revealing), and the `data-equipping` flash, dismissal paths, focus restore, 1290 ms
   timeline and reduced-motion behaviour are unchanged.

## Decisions

- **Rows come from the catalog, filtered by the tab**: `SLOT_CATALOG.filter((slot) =>
  activeTab.slots.includes(slot.id))` keeps catalog order for the two active rows without a
  second grouping table (the tab table stays the only grouping source).
- **`key={activeTab}` on the tabpanel only**: the strip and the preview are outside the keyed
  subtree, so every switch mounts a new panel element (fade restarts) while the strip and the
  single preview canvas keep their identity (verified by node identity).
- **Focus via a ref map**: the five buttons always exist, so the key handler focuses the next
  button directly; no effect, no timer, no delayed focus (AC-15/AC-16).
- **Landing test proof**: a `MutationObserver` records `data-active-tab` (with
  `attributeOldValue`) plus tabpanel insertions on the grant→null rerender; the wings case
  asserts exactly one record whose old value is `null`, no `frame` value and exactly one
  inserted tabpanel, so an effect-based landing (two commits / two fades) fails the test.
- **Fixtures are pinned literals** (five-tab table, slot names, standard part names, control
  counts); the component tests never read `hangar-tabs` for expected values, so a grouping
  change fails the test instead of rewriting it. `SLOT_CATALOG` is used only as the AC-3 union
  target and as the catalog for rarity/swatch pins.
- **No CSS** in this task (AC-9/AC-12/AC-15's animations are T4); the tab tests assert the DOM
  contract only.

## Applied `App.test.tsx` patch (exact)

```diff
@@ describe('App — customization panel integration (AC-29, AC-32, AC-43)')
-    fireEvent.click(await screen.findByRole('button', { name: 'Equip Port Silver Wing' }));
+    // The Wings row is only mounted on its tab, so activate it before the equip click; the
+    // Unequip Hull control stays on the default Frame tab.
     fireEvent.click(await screen.findByRole('button', { name: 'Unequip Hull' }));
+    fireEvent.click(await screen.findByRole('tab', { name: 'Wings, 1 of 4 parts owned' }));
+    fireEvent.click(await screen.findByRole('button', { name: 'Equip Port Silver Wing' }));

@@ describe('App — reveal ownership and shell accessibility …')
-    expect(document.querySelectorAll('.customization-panel .customization-variant')).toHaveLength(30);
+    // The tabbed panel mounts only the default tab's two rows: 2 rows x 3 variants.
+    expect(document.querySelectorAll('.customization-panel .customization-variant')).toHaveLength(6);
```

Every other assertion in `App.test.tsx` is untouched: the one-call-each `unequipPart('hull')` /
`equipPart('wing-left-silver')` assertions, the deferred-panel, live-region and
`data-reduced-motion` assertions all stay as they were. The fixture for the equip test is
`parts: { 'hull-gold': 1, 'wing-left-silver': 1 }`, so the Wings tab's accessible name is
`Wings, 1 of 4 parts owned`.

## Raw evidence

Lint (root, whole repo):

```text
$ npm run lint

> lint
> eslint .

EXIT=0
```

Typecheck (all workspaces):

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT=0
```

Focused panel suite (66 tests):

```text
$ npx vitest run src/ui/SpaceshipCustomizationPanel.test.tsx --reporter=basic

 Test Files  1 passed (1)
      Tests  66 passed (66)
   Duration  2.57s (transform 237ms, setup 0ms, collect 430ms, tests 1.25s, environment 456ms, prepare 128ms)
EXIT=0
```

App suite after the r2a patch (62 tests, including the two rewritten assertions):

```text
$ npx vitest run src/App.test.tsx --reporter=basic

 Test Files  1 passed (1)
      Tests  62 passed (62)
EXIT=0
```

Frontend workspace suite (the task gate):

```text
$ npm test --workspace @cubeclicker/frontend

 Test Files  79 passed (79)
      Tests  2479 passed (2479)
   Duration  3.33s (transform 6.70s, setup 0ms, collect 21.87s, tests 15.04s, environment 12.21s, prepare 6.04s)
EXIT=0
```

Frontend coverage (thresholds unchanged at 80/80/80/80, no exclusion added):

```text
$ COLUMNS=220 npm run coverage --workspace @cubeclicker/frontend

 Test Files  79 passed (79)
      Tests  2479 passed (2479)

 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.86 |   96.52 |   98.06 |   96.86 |
 src/ui            |   97.55 |   95.21 |   97.11 |   97.55 |
  ...tionPanel.tsx |   91.66 |   86.66 |     100 |   91.66 | 60-61,66-67
  ...tionPanel.tsx |   97.06 |       92 |     100 |   97.06 | ...28-329,335-336
  hangar-tabs.ts   |     100 |     100 |     100 |     100 |
EXIT=0
```

(The first `...tionPanel.tsx` is `DeferredSpaceshipCustomizationPanel.tsx`; the second is
`SpaceshipCustomizationPanel.tsx`. The uncovered panel lines are the invariant guards —
`tabDefinition`'s impossible `throw` and `landingTabFor`'s defensive absent-grant branch.)

Whitespace / tree state:

```text
$ git diff --check
(no output)
EXIT=0
```

## Assertion integrity

- Concrete assertions only: exact `toEqual` arrays/tables, exact attribute strings and numbers,
  `toBe` node identity, `toHaveBeenCalledWith`/`toHaveBeenCalledTimes(n)`. No
  `expect.anything()`/`expect.any()`, no `objectContaining`/`arrayContaining`/`stringContaining`,
  no `toMatchObject`, no snapshots, no argument-unchecked `toHaveBeenCalled()`, no
  `toBeTruthy`/`toBeDefined`/`not.toThrow` stand-ins. No bounded float exception was needed.
- No pre-feature assertion was deleted: the ten-row/twenty-control assertions were replaced by
  per-tab assertions plus the union-of-ten check and the 20/40 control matrix; the reveal,
  dismissal, focus, flash, preview and mode assertions are unchanged (two were adjusted only
  where the landing tab moves the row: the appearance-mutation test now reads the landed wings
  row then Frame, and the flash test activates Wings first).
- The two `App.test.tsx` rewrites are forced replacements for the same contract (AC-3/AC-10):
  the Wings equip control is reached through its tab, and the default tab mounts 6 variants;
  every other assertion in that file is intact.
- Every new test can fail on a real regression: a dropped/renamed tab, a missing badge field, a
  wrong `tabindex`, an `aria-controls`, a stray non-active row, a wrong owner, a landing
  regression (two mutations / a `frame` value), a focus or `preventDefault` regression, a
  preview remount, a count regression or a legacy-count regression each break a named
  assertion.

## Acceptance audit

- **AC-2 — met**. One `div.customization-tabs[role="tablist"]`
  `aria-label="Spaceship part groups"` with exactly five `button[role="tab"].customization-tab`
  in `HANGAR_TABS` order; exact `id`/`data-tab`/`aria-selected`/`tabindex`/`aria-label`
  (`Frame, 0 of 4 parts owned` …), text content `Frame0/4` … (label text node + one
  `span[aria-hidden="true"].customization-tab-badge[data-owned][data-total="4"]` whose text is
  `<owned>/4`); exactly one `aria-selected="true"` and one `tabindex="0"`, the same element; no
  `aria-controls` anywhere; strip is not a live region; SSR and jsdom both asserted; with a
  grant: no `data-active-tab`, no tablist, no tab buttons.
- **AC-3 — met**. Exactly one `div.customization-tabpanel[role="tabpanel"]`
  `id="customization-tabpanel"` with `data-tabpanel`, `aria-labelledby`, no `tabindex`, wrapping
  `<ul class="customization-slots">` with exactly the active group's two rows in catalog order;
  the IDREF resolves to the selected button (id unique); all five tabs yield 2 rows each, three
  variants per row with `data-part`/`data-rarity`/`data-owned`/`data-locked`/`data-equipped` and
  the `aria-hidden` swatch, and the union of `data-slot` values equals the ten `SLOT_CATALOG`
  ids (length 10 + `Set` equality).
- **AC-4 — met**. Click selection updates `aria-selected`, `tabindex`, section
  `data-active-tab`, tabpanel `data-tabpanel`/`aria-labelledby` and the rows in the same commit;
  `ArrowRight` steps with wrap (`ignitions → frame`), `ArrowLeft` mirrors it, `Home`/`End`
  select the ends, focus follows selection, every handled key returns
  `defaultPrevented === true`, an unhandled key (`a`, `ArrowDown`) changes nothing and is not
  prevented, the panel's pinned `scrollTop` stays 40, and none of the six command callbacks is
  called. The `.spaceship-preview` canvas and the strip keep node identity across switches.
- **AC-5 — met**. `data-owned`/`data-total`/badge text/accessible name for every tab:
  empty → all `0`, partial matrix `['1','2','1','1','2']`, frame full → `4/4`, standard/zero/
  unknown ignored, legacy `wings-silver` → wings `2`, `engine-blue` → ignitions `2`,
  `body-obsidian` → frame `1`.
- **AC-6 — met**. Mount lands on `frame`; a full reveal cycle re-opens on `frame`; the
  `wing-left-silver` → `wings` rerender records **one** `data-active-tab` mutation with old
  value `null` and new value `wings` (no `frame` value) and **one** inserted tabpanel;
  `hull-gold` → `frame` in one mutation; `mystery-part` → `frame`.
- **AC-8 — met**. All reveal assertions unchanged and green (pinned attributes/copy, catalog
  slot, 3D-unavailable, 1290 ms timeline, reduced-motion settle, Dismiss/Escape/Equip,
  unmount dismissal once, focus restore), plus new assertions that while revealing the section
  has no `data-active-tab`, tablist, tabpanel, tab button or preview (jsdom and SSR).
- **AC-10 — met**. Title, `data-mode`, both chips with `data-lootboxes`/`data-keys`,
  `Open lootbox` disabled at zero lootboxes / zero keys / `pendingOpen`, the `onOpen` alias,
  three variants per row with catalog ids/rarities/swatches, `aria-pressed` +
  `Equipped`/`Equip <name>`, `Unequip <slot name>` disabled at the standard part,
  `data-equipping` 260 ms flash + its absence under reduced motion, legacy normalization,
  44 px controls on every tab, `onUnequip` once with `hull`, and the two pinned control
  fixtures: **empty inventory = 2 equip + 2 unequip per tab, 10 + 10 = 20**; **all-owned =
  6 equip + 2 unequip per tab, 30 + 10 = 40**. The two App-level panel assertions follow the
  same contract (r2a).
- **AC-15 — met** (component half; CSS is T4). A new tabpanel element per switch (including
  back to a previously visited tab) while the strip and preview keep identity; no timer is
  added (`vi.getTimerCount() === 0` before and after two switches); focus stays on the
  activated tab for keyboard selection.
- **AC-16 — met** (component half). No closing state (`data-closing`/`[data-closing]` absent),
  no timers on a switch, no delayed unmount; the dismissal paths and the reveal's own
  behaviour are unchanged.
- **AC-29 (T3 half) — met**. Only the files listed in `tasks.md` change for this task;
  `App.tsx`, `app.css`, `app.css.test.ts` and the other pinned paths are untouched (see the
  commit's file list); `App.test.tsx` changes exactly the two T3-owned panel assertions as
  recorded in the amendment.

## Deviations from spec

- None. The only recorded divergence — the two `App.test.tsx` assertion rewrites — is now the
  approved r2a amendment in `spec.md`/`tasks.md`/`plan.md` (test ownership correction, no
  design change).
