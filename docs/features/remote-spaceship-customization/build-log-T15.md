# Build log — T15 — Hangar tabs + form/finish picker + preview

Task: T15 (2026-11-18)
Files changed: `src/frontend/src/ui/hangar-tabs.ts`, `src/frontend/src/ui/hangar-tabs.test.ts`, `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx`, `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx`, `src/frontend/src/ui/SpaceshipPreview.tsx`, `src/frontend/src/ui/SpaceshipPreview.test.tsx`, `src/frontend/src/ui/game-view.css`, `src/frontend/src/ui/game-view.css.test.ts`, `src/frontend/src/App.test.tsx`, `docs/features/remote-spaceship-customization/build-log-T15.md` (this log)
Branch: `feat/remote-spaceship-customization` (HEAD before the task commit: `c496600`)
Commit: `e437a93` — `feat: add hangar tabs and form picker` (feature + this log; the hash record lands in a follow-up `docs:` commit, mirroring T1/T2/T9/T10/T11/T14 — not pushed)

## Finish-round note

The implementation, tests and CSS were completed by the prior builder (green at 83 files / 2,704 tests) before it hit its step cap. This run did **not** redo or change behaviour: the only lint finding (an unused `catalogForSlot` import in `SpaceshipCustomizationPanel.test.tsx`) was already removed in the tree, so no source/test/CSS edit was needed here. This round re-ran `npm run lint` on the current tree, re-ran the full T15 verify recipe from a clean state (only the nine T15 files modified), wrote this log with the recorded raw evidence, and committed.

## What changed & why

- **`ui/hangar-tabs.ts`** now defines the six v3 tabs — `frame` (`hull`, `tail-fin`), `front` (`nose`, `cockpit`), `wings`, `engines`, `ignitions` and `shots` (`shot`) — in `SLOT_CATALOG_V3` order, with `HANGAR_DEFAULT_TAB === 'frame'`, the map `HANGAR_TAB_LOOTABLE_TOTALS` (`244` per ship tab, `120` for `Shots`), `tabForSlot` (throws `unknown slot: <id>`) and `tabOwnedCount` (normalizes through `normalizePartMapV3`, counts only owned lootable v3 rows). The old scalar `HANGAR_TAB_LOOTABLE_TOTAL = 4` is gone.
- **`ui/SpaceshipCustomizationPanel.tsx`** switches its whole boundary to the v3 catalog (`normalizePartMapV3`/`normalizeAppearanceV3`/`isValidPartIdV3`/`partDefinitionV3`/`catalogForSlot`/`catalogForSlotForm`/`defaultPartForSlotV3`) and adds the sixth tab, per-slot owned counts and the form/finish picker: an eleven-button `.customization-forms` strip per row (per-strip roving tabindex, arrow/Home/End selection) and a 3-cell (`classic` ship slot), 1-cell (`shot` classic) or 12-cell (generated form) `.customization-variants` grid, keyed by the selected form. Tab badges now read `owned/<total>` (244/120); the reveal branch, preview identity, 44 px targets and single scroll container are unchanged.
- **`ui/SpaceshipPreview.tsx`** maps through `appearanceToShipParamsV3`: ten `data-preview-slot-<shipSlot>` attributes carry v3 ids, the `shot` entry is ignored for geometry and publishes no attribute, and the five legacy `data-*-color` attributes are derived from the same v3 mapping (hull→body, nose→nose, wing-left→wings, cockpit→cockpit, ignition-left→engine).
- **`ui/game-view.css`** adds the wrapping 44 px form-chip strip (hover, `aria-pressed` underline cue and `:focus-visible` ring), the three-column finish grid and a phone-fit override, with no nested scroll container.
- **Tests**: `hangar-tabs.test.ts` pins the six-tab table, the 11-slot set equality, 244/120 totals, `tabForSlot` and `tabOwnedCount` (including legacy bilateral ids and a full 1,351-row inventory); the panel tests add six-tab ARIA/badge contracts, form selection and keyboard, exact control matrices (26/13, 30/13, 48/24), v3 slot rows and 44 px targets; the preview tests pin the ten v3 attributes, the ignored `shot` entry and v3-derived legacy colours; the CSS tests pin the new rules, the cascade and the single-scroller guard. `App.test.tsx` rewrites the two stale five-tab/`1 of 4` assertions to the six-tab `1 of 244` contract.

## Decisions

- **The tab table stays literal, not derived.** `HANGAR_TABS` is written out and a set-union test proves it covers all eleven `SLOT_CATALOG_V3` ids exactly once, in catalog order — a catalog change fails the test instead of silently regrouping the panel.
- **`tabOwnedCount` normalizes its own input.** Legacy bilateral ids (`wings-silver`, `engine-blue`) therefore count for both slots and unknown/zero-count entries are dropped, matching the panel's `parts` normalization; standard parts never count, so the badge maximum equals the tab's lootable total.
- **Selected forms are panel-local, per slot.** Every slot starts at `classic` on mount, each row keeps its own selection for the panel's lifetime, and the variant list is keyed by the form id so a 3→12 cell change replaces the list subtree (the test asserts the new element identity).
- **One roving tab stop per form strip.** Only the selected form button has `tabIndex=0` (the others `-1`); `ArrowRight`/`ArrowLeft` wrap in `FORM_CATALOG` order, `Home`/`End` select `classic`/`kite`, focus moves with the selection, and all four keys call `preventDefault()` because the panel is the 60vh scroll container. Selection never calls a command callback.
- **Landing tab derivation is preserved.** The existing render-time landing logic now resolves the grant through `partDefinitionV3(...).slot` → `tabForSlot(...)`, so a `shot` grant lands on `Shots` and an unknown/invalid id lands on `frame` in the same commit, with no default-tab commit or second fade.
- **The preview keeps the accepted canvas contract.** Class, accessible name, single renderer/context, 30 fps cap, reduced-motion pose and WebGL fallback are untouched; only the source mapping and attribute values change, and `shot` deliberately has no preview geometry/attribute.
- **CSS wraps in place.** The form strip flex-wraps and the finish cells use a three-column grid, so the panel stays the only scroller (the CSS test asserts no `overflow` on the new picker rules); the phone override compacts chips without dropping the 44 px targets.
- **Test tiers.** Unit: `hangar-tabs.test.ts` exercises the pure grouping/arithmetic (plus a source-purity check: only `../game/parts-v3`, no timers/randomness/DOM). Integration: the panel and preview tests render the real React components in jsdom through their public props (real catalog, real CSS injected for the computed-style assertions), and the CSS tests parse the real stylesheet and assert the jsdom cascade. There is no backend or WebSocket boundary in this task, so no network/container tier applies.

## Evidence

All commands ran in the shared checkout at `c496600` with exactly the nine T15 source/test/CSS/App files modified (the untracked feature artifacts belong to the orchestrator). Raw output:

### `npm run lint`

```
> lint
> eslint .

EXIT:0
```

### `npm run typecheck`

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT:0
```

### `npm test --workspace @cubeclicker/frontend`

```
 ✓ src/ui/hangar-tabs.test.ts (17 tests) 30ms
 ✓ src/ui/SpaceshipPreview.test.tsx (16 tests) 98ms
 ✓ src/ui/game-view.css.test.ts (103 tests) 627ms
 ✓ src/App.test.tsx (62 tests) 1289ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (75 tests) 1659ms

 Test Files  83 passed (83)
      Tests  2704 passed (2704)
   Start at  17:10:37
   Duration  4.33s (transform 8.91s, setup 0ms, collect 27.81s, tests 16.79s, environment 12.00s, prepare 7.13s)

EXIT:0
```

Test counts: panel `66 → 75` (+9), preview `12 → 16` (+4), CSS `99 → 103` (+4), `hangar-tabs` `17 → 17` (rewritten for v3), `App.test.tsx` 62 (two assertions rewritten). Total after T11 was 2,687; this task adds **+17** = **2,704**.

### `npm run coverage --workspace @cubeclicker/frontend`

```
 Test Files  83 passed (83)
      Tests  2704 passed (2704)
All files          |   97.08 |    96.64 |   98.19 |    97.08 |
  hangar-tabs.ts   |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   96.35 |    91.33 |     100 |   96.35 |
  ...ipPreview.tsx |   86.99 |    77.41 |      75 |   86.99 |

EXIT:0
```

Frontend coverage: **statements 97.08 / branches 96.64 / functions 98.19 / lines 97.08** — all four thresholds (≥ 80) passed. `hangar-tabs.ts` is 100 % on all four metrics; `SpaceshipCustomizationPanel.tsx` is 100 % functions; `SpaceshipPreview.tsx`'s uncovered arms are the pre-existing WebGL-unavailable and ResizeObserver fallbacks plus the defensive media-query paths, not the new v3 mapping (the SSR and live-model tests cover both).

### `npm run build`

```
> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 116 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-laKoxB0N.css                        45.63 kB │ gzip:   8.21 kB
dist/assets/cursor-ship-BJ4Uk1ol.js                   14.81 kB │ gzip:   4.74 kB
dist/assets/SpaceshipCustomizationPanel-CXm4xFuc.js   17.90 kB │ gzip:   6.38 kB
dist/assets/browser-env-HC9fht0F.js                   50.62 kB │ gzip:  18.79 kB
dist/assets/index-jxzpgQnq.js                        101.36 kB │ gzip:  30.90 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-Ddozhxko.js                        610.56 kB │ gzip: 154.65 kB
✓ built in 1.50s
entry index assets/index-jxzpgQnq.js raw=101356 gzip=30903
initial files=2 raw=323055 gzip=99859 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
total files=6 raw=1016945 gzip=284420 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-CXm4xFuc.js raw=17903 gzip=6383 initial=false
chunk browser-env assets/browser-env-HC9fht0F.js raw=50619 gzip=18787 initial=false
chunk cursor-ship assets/cursor-ship-BJ4Uk1ol.js raw=14805 gzip=4744 initial=false
chunk index assets/index-jxzpgQnq.js raw=101356 gzip=30903 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-Ddozhxko.js raw=610563 gzip=154647 initial=false

Bundle budget OK.
```

## Bundle report / budget check

| Bucket | Measured gzip | Ceiling | Headroom |
| --- | --- | --- | --- |
| initial (index + react) | **99,859 B** | 150,000 B | 50,141 B |
| three | **154,647 B** | 165,000 B | 10,353 B |
| total (6 files) | **284,420 B** | 300,000 B | 15,580 B |

The picker ships in the existing deferred `SpaceshipCustomizationPanel` chunk (`17,903 B raw / 6,383 B gzip`, `initial=false`), so the entry is unchanged by the new UI; the budget script exits 0 with `Bundle budget OK.` This matches the T15 expected baseline exactly (99,859 / 154,647 / 284,420).

## Acceptance audit

- **AC-5 — met (T15 consumer scope).** The panel and the preview now consume the v3 module only: panel `normalize` uses `normalizePartMapV3`/`normalizeAppearanceV3`, `equippedPart` uses `isValidPartIdV3` + `partDefinitionV3`, rows use `catalogForSlot`/`catalogForSlotForm`, and the preview uses `appearanceToShipParamsV3`; `grep` finds no `parts-v2`/`game/parts` import in any of the nine files. Tests `normalizes legacy direct props into the v3 slot rows`, `keeps a v3 inventory and appearance intact (never normalizing to {})`, `keeps a generated v3 part id per slot (never normalizing to defaults)` and `counts a bilateral legacy wing id…` prove the v1/v2 rules still apply and v3 ids survive. (Module layering is T9; the engine/repository consumers are T8/T5, still gated — see Deviations.)
- **AC-27 — met.** `HANGAR_TABS` is exactly the six pinned tabs in order with `frame→(hull,tail-fin)`, `front→(nose,cockpit)`, `wings`, `engines`, `ignitions`, `shots→(shot)`; the union is exactly the eleven `SLOT_CATALOG_V3` ids, each tab's slots keep catalog order, `HANGAR_DEFAULT_TAB === 'frame'`, `tabForSlot` maps all eleven and throws `unknown slot: <id>` for legacy/display/empty keys, `HANGAR_TAB_LOOTABLE_TOTALS` is exactly `{244,244,244,244,244,120}`, and `tabOwnedCount` returns 0 for `{}`, the tab max for a full 1,351-row inventory, counts legacy bilateral ids for both slots and never counts standard/zero/unknown entries. Evidence: `hangar-tabs.test.ts` (17 tests).
- **AC-28 — met.** Each tab renders one `li.customization-slot[data-slot]` per slot in catalog order (two rows, one on `Shots`) with `data-owned` (owned lootable) and `data-total` (122 ship / 120 shot) on the header, one `button.customization-unequip` disabled at the standard part, an eleven-button `.customization-forms` group (`data-form`, `aria-pressed`, label text and name, `min-height: 44px`) and a `.customization-variants` list of exactly 3 (`classic` ship), 1 (`shot` classic) or 12 (generated form) `li.customization-variant` cells carrying `data-part`/`data-finish`/`data-rarity`/`data-owned`/`data-locked`/`data-equipped`, an `aria-hidden` swatch whose inline background equals the catalog colour, and either an equip button (`aria-pressed`, `Equipped` text or `Equip <part name>`) or the `Locked` text. Every rendered panel control is computed at 44×44 px and the new form chip has a `:focus-visible` ring. Evidence: `SpaceshipCustomizationPanel.test.tsx` (`slots`, `form picker`, `44px minimum pointer target`), `game-view.css.test.ts` (four new tests).
- **AC-29 — met.** Selection defaults to `classic`, is per-slot and persists for the panel lifetime (a sibling row stays `classic`); a click changes `aria-pressed`, the row `data-form` and the variant list in the same commit, with the list keyed by the form id (new element identity). Each strip keeps exactly one `tabindex="0"`; `ArrowRight`/`ArrowLeft` wrap (`classic→kite→classic`), `Home`/`End` land on `classic`/`kite`, focus follows, all four keys `preventDefault()` (the section `scrollTop` stays 40) and no command callback fires. The preview element identity is unchanged across selections. Evidence: `form picker` tests incl. `moves form selection and focus with …`, `selects the shot classic (1 cell) and a generated shot form (12 cells)`.
- **AC-30 — met.** Exact control counts: empty inventory → **26** per ship tab / **13** `Shots`; all-owned classic → **30** / **13**; all-owned with a generated form selected on every row → **48** / **24**. The panel keeps `aria-label="Spaceship customization"`, `data-mode`, the `data-lootboxes`/`data-keys` chips, the `Open lootbox` enable rules, exactly one `[role="tabpanel"]` (`id="customization-tabpanel"`, `aria-labelledby` resolving to the selected tab), no `aria-controls`, exactly one `SpaceshipPreview`, and only the active tab's rows in the DOM. Evidence: `control matrix` and `hangar tabs` tests.
- **AC-31 — met (T15 half; reveal path from T14 unchanged).** The preview resolves through `appearanceToShipParamsV3`, keeps exactly the ten `data-preview-slot-<shipSlot>` attributes with v3 ids, publishes no `shot` attribute, and derives all five legacy colours from v3 (defaults `#88aaff`/`#8f9bad`/`#4466cc`/`#0b2f38`/`#ff6600`, generated `hull-dart-chrome → #c9d4e2`); the live model applies the generated hull/slot/chassis values. The panel renders the `shot` row with the catalog slot name `Shot` and the catalog part name, 1 classic cell and 12 generated cells, lands on `Shots` after a shot grant in the single post-reveal commit, and keeps the reveal branch tests green. `REVEAL_SLOT_YAW_RAD.shot`, the 1290 ms timeline and the reveal card are T14's verified change; the T15 scope does not touch `reveal-motion.ts`/`lootbox-reveal.ts`/`LootboxReveal.tsx` (see the diff check). Evidence: `SpaceshipPreview.test.tsx` (16 tests), panel `slots`/`form picker`/`post-reveal landing`, `hangar-tabs` shot grouping.

## Scope / diff checks

- Before staging, `git status --porcelain` listed exactly the nine modified T15 files plus the untracked orchestrator artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`) and not this log; after writing the log the only addition is this file. No T12/T7/T8/T13 file, backend file, `parts-v2` file, reveal file, `package.json`, lockfile, compose/Docker file or `.env*` is modified.
- `git diff --numstat`: `App.test.tsx` +2/−2 (two assertion rewrites), panel test +627/−180, panel +163/−57, preview test +59/−4, preview +24/−22, CSS +96/−0, CSS test +157/−0, hangar test +113/−89, hangar +46/−25.
- No new dependency; no schema or migration change; no shared config change.
- Documentation: this feature's user-facing docs (`README.md`, `docs/architecture/*`, `docs/product/glossary.md`) are T17's deliverable; T15 changes no user-facing configuration, so the build log is the only doc artifact here. `docs/features/README.md` is untouched (orchestrator-owned).

## Deviations from spec

- None in behaviour. `HANGAR_TAB_LOOTABLE_TOTAL` (the predecessor scalar) is replaced by the AC-27 map `HANGAR_TAB_LOOTABLE_TOTALS`; that is the specified API, not a deviation.
- AC-5's engine and repository consumers are not landed in this task: T8 and T5 are still gated on the `coin-economy` round (status.md). T15 proves the panel/preview consumer half and the shared v3 normalizer behaviour; T18's final audit owns the whole-AC closure.
- AC-31's reveal-path half was delivered by T14 and is re-exercised here by the unchanged reveal-branch tests; no reveal file is edited by T15.
- The implementation was authored by the prior builder; this finish round only re-ran the recipe and committed (see the finish-round note).
