# Build log — T2 — Hangar tab catalog module

Task: T2 (2026-11-17), feature `hangar-tabs-and-menu-motion`, branch
`feat/hangar-tabs-and-menu-motion` (base `36de001`, concurrent with T1 which landed as
`bc41e9a`), acceptance AC-1 (module) and AC-5 (badge-count source of truth).

Files changed (only `files_owned`):

- `src/frontend/src/ui/hangar-tabs.ts` (new)
- `src/frontend/src/ui/hangar-tabs.test.ts` (new)
- `docs/features/hangar-tabs-and-menu-motion/build-log-T2.md`

## What changed & why

1. New pure module `ui/hangar-tabs.ts`: `HangarTabId`, `HangarTab`, the literal
   `HANGAR_TABS` table (5 tabs × 2 slots in `SLOT_CATALOG` order), `HANGAR_DEFAULT_TAB`
   (`'frame'`), `HANGAR_TAB_LOOTABLE_TOTAL` (`4`), `tabForSlot` and `tabOwnedCount`.
2. `tabForSlot` returns the owning tab for the ten catalog slots and throws
   ``unknown slot: <id>`` for anything else (legacy categories, labels, display names,
   empty string).
3. `tabOwnedCount(tab, parts?)` counts **owned lootable** parts only (`rarity !==
   'standard'` and `parts[id] > 0`), ignores unknown ids and counts a missing map as `0`.
   It consumes the map the panel already normalizes through `normalizePartMap`, so a
   bilateral legacy id is two keys and `wings-silver` counts `2` (AC-5).
4. `hangar-tabs.test.ts` pins the exact table, proves the union equals the ten
   `SLOT_CATALOG` ids (set equality + length 10 + no foreign id) and that each tab keeps
   catalog order, pins the four lootable ids per tab via `partsForSlot`, the throw cases,
   the default tab, and the count matrix (empty/missing/partial/full/standard/zero/unknown/
   the three legacy shapes).
5. A module-purity guard reads the module source and asserts it imports only
   `../game/parts-v2` and contains no timer, randomness or DOM access.

## Pinned table (matches spec § Tab set and `SLOT_CATALOG`)

| # | `id` / `data-tab` | `label` | `slots` (catalog order) | Lootable ids (`partsForSlot`, non-standard) | Lootable |
| --- | --- | --- | --- | --- | --- |
| 1 | `frame` | `Frame` | `hull`, `tail-fin` | `hull-obsidian`, `hull-gold`, `tail-fin-split`, `tail-fin-comet` | 4 |
| 2 | `front` | `Front` | `nose`, `cockpit` | `nose-crimson`, `nose-emerald`, `cockpit-amber`, `cockpit-oracle` | 4 |
| 3 | `wings` | `Wings` | `wing-left`, `wing-right` | `wing-left-silver`, `wing-left-gold`, `wing-right-silver`, `wing-right-gold` | 4 |
| 4 | `engines` | `Engines` | `engine-left`, `engine-right` | `engine-left-vector`, `engine-left-nova`, `engine-right-vector`, `engine-right-nova` | 4 |
| 5 | `ignitions` | `Ignitions` | `ignition-left`, `ignition-right` | `ignition-left-blue`, `ignition-left-plasma`, `ignition-right-blue`, `ignition-right-plasma` | 4 |

`HANGAR_DEFAULT_TAB === 'frame'`; `HANGAR_TAB_LOOTABLE_TOTAL === 4` = the badge max of
every tab.

## Count matrix pinned by the tests (AC-1/AC-5)

| Input (map handed to `tabOwnedCount`) | `frame` | `front` | `wings` | `engines` | `ignitions` |
| --- | --- | --- | --- | --- | --- |
| `{}` / missing map / `undefined` | 0 | 0 | 0 | 0 | 0 |
| `{ hull-gold: 2, nose-crimson: 1, cockpit-oracle: 1, wing-left-silver: 1, engine-right-nova: 3, ignition-right-blue: 1, ignition-right-plasma: 1 }` | 1 | 2 | 1 | 1 | 2 |
| one owned part per tab | 1 | 1 | 1 | 1 | 1 |
| `{ hull-obsidian: 1, hull-gold: 1, tail-fin-split: 1, tail-fin-comet: 1 }` | **4** | 0 | 0 | 0 | 0 |
| all ten `*-default` standard ids + `nose-crimson: 0` + `cockpit-oracle: 0` + `not-a-part: 5` + `wings: 5` | 0 | 0 | 0 | 0 | 0 |
| `normalizePartMap({ 'wings-silver': 1 })` → `{ wing-left-silver: 1, wing-right-silver: 1 }` | 0 | 0 | **2** | 0 | 0 |
| `normalizePartMap({ 'engine-blue': 3 })` → `{ ignition-left-blue: 3, ignition-right-blue: 3 }` | 0 | 0 | 0 | 0 | **2** |
| `normalizePartMap({ 'body-obsidian': 1 })` → `{ hull-obsidian: 1 }` | **1** | 0 | 0 | 0 | 0 |

## Decisions

- **Signature order follows the approved spec/plan.** AC-1 and plan § Interfaces pin
  `tabOwnedCount(tab, parts)`; the task brief's shorthand wrote `tabOwnedCount(parts,
  tab)`. The approved contract wins — the module exports `tabOwnedCount(tab, parts?)`, and
  T3 must call it in that order. Recorded under "Deviations" below; no scope change.
- **The table is literal, not derived.** `HANGAR_TABS` is written out instead of mapping
  `SLOT_CATALOG`, so a catalog change fails the set-union/order tests (drift guard). No
  cross-tab concatenation is asserted, because `frame = [hull, tail-fin]` deliberately
  breaks `SLOT_CATALOG` order across tabs (spec § Tab set note).
- **Optional `parts` parameter.** The spec pins "missing map = 0" for the count; accepting
  `undefined` (optional parameter) expresses that without a non-null assertion at the call
  site. The panel already normalizes its `parts` prop (`normalizePartMap`), so the module
  does **not** re-normalize internally — documented in the module doc comment and pinned by
  the three legacy tests that normalize explicitly before counting.
- **Filter, don't special-case.** `tabForSlot` scans `HANGAR_TABS`, so the table remains
  the single source of truth for ownership; the throw message is exactly
  ``unknown slot: <id>`` (same shape as `defaultPartForSlot`'s error).
- **No integration tier in this task (documented exception).** T2 is a pure data/arithmetic
  module with no I/O, no framework, no timer and no wire boundary; its only consumer is
  `SpaceshipCustomizationPanel` in T3, which owns the integration suite
  (`SpaceshipCustomizationPanel.test.tsx`, AC-2…AC-6/AC-10). The unit tier plus the
  source-purity guard is the complete boundary available to this `files_owned` set, and
  the plan's testing strategy lists only the unit file for this module.

## Raw evidence

Module export surface and table (line numbers = current file):

```text
$ grep -nE "^export (type|interface|const|function)|^  \{ id:" src/frontend/src/ui/hangar-tabs.ts
20:export type HangarTabId = 'frame' | 'front' | 'wings' | 'engines' | 'ignitions';
23:export interface HangarTab {
32:export const HANGAR_TABS: readonly HangarTab[] = [
33:  { id: 'frame', label: 'Frame', slots: ['hull', 'tail-fin'] },
34:  { id: 'front', label: 'Front', slots: ['nose', 'cockpit'] },
35:  { id: 'wings', label: 'Wings', slots: ['wing-left', 'wing-right'] },
36:  { id: 'engines', label: 'Engines', slots: ['engine-left', 'engine-right'] },
37:  { id: 'ignitions', label: 'Ignitions', slots: ['ignition-left', 'ignition-right'] },
41:export const HANGAR_DEFAULT_TAB: HangarTabId = 'frame';
44:export const HANGAR_TAB_LOOTABLE_TOTAL = 4;
47:export function tabForSlot(slot: SlotId): HangarTabId {
63:export function tabOwnedCount(
```

Focused suite (17 tests):

```text
$ npx vitest run src/ui/hangar-tabs.test.ts --reporter=verbose
 ✓ src/ui/hangar-tabs.test.ts > HANGAR_TABS (AC-1) > pins the five tabs in tab-strip order with their exact ids, labels and slots 1ms
 ✓ src/ui/hangar-tabs.test.ts > HANGAR_TABS (AC-1) > covers every catalog slot exactly once (set equality, no duplicate, no foreign id) 1ms
 ✓ src/ui/hangar-tabs.test.ts > HANGAR_TABS (AC-1) > keeps each tab slots in SLOT_CATALOG order 0ms
 ✓ src/ui/hangar-tabs.test.ts > HANGAR_TABS (AC-1) > exposes exactly four lootable parts per tab (rare + epic of both slots) 1ms
 ✓ src/ui/hangar-tabs.test.ts > HANGAR_TABS (AC-1) > defaults to the frame tab 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabForSlot (AC-1) > returns the owning tab for all ten catalog slots 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabForSlot (AC-1) > throws `unknown slot: <id>` for legacy keys, display names and empty ids 1ms
 ✓ src/ui/hangar-tabs.test.ts > tabOwnedCount (AC-1, AC-5) > counts 0 for every tab when the parts map is empty or missing 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabOwnedCount (AC-1, AC-5) > counts only owned lootable parts, per tab 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabOwnedCount (AC-1, AC-5) > counts one owned part per tab as 1 across the strip 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabOwnedCount (AC-1, AC-5) > counts both rare and both epic parts of both slots as the badge max 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabOwnedCount (AC-1, AC-5) > never counts standard parts, zero counts or unknown ids 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabOwnedCount (AC-1, AC-5) > counts a bilateral legacy id twice after normalizePartMap (wings-silver → 2) 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabOwnedCount (AC-1, AC-5) > counts the legacy engine id for both ignitions after normalizePartMap (engine-blue → 2) 0ms
 ✓ src/ui/hangar-tabs.test.ts > tabOwnedCount (AC-1, AC-5) > counts a single-slot legacy id once after normalizePartMap (body-obsidian → frame 1) 0ms
 ✓ src/ui/hangar-tabs.test.ts > module purity (AC-1) > imports only ../game/parts-v2 0ms
 ✓ src/ui/hangar-tabs.test.ts > module purity (AC-1) > has no timer, randomness or DOM access 0ms

 Test Files  1 passed (1)
      Tests  17 passed (17)
   Duration  257ms (transform 51ms, setup 0ms, collect 53ms, tests 6ms, environment 0ms, prepare 57ms)
EXIT=0
```

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

Frontend test suite (all files):

```text
$ npm test --workspace @cubeclicker/frontend

 ✓ src/ui/hangar-tabs.test.ts (17 tests) 10ms
 ... (79 test files)
 Test Files  79 passed (79)
      Tests  2457 passed (2457)
   Duration  3.74s (transform 7.70s, setup 0ms, collect 23.25s, tests 13.78s, environment 11.11s, prepare 6.48s)
EXIT=0
```

Frontend coverage (unchanged 80/80/80/80 thresholds, no exclusion edit):

```text
$ npm run coverage --workspace @cubeclicker/frontend

 Test Files  79 passed (79)
      Tests  2457 passed (2457)

 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   96.85 |    96.52 |   98.04 |   96.85 |
  hangar-tabs.ts   |     100 |      100 |     100 |     100 |
EXIT=0
```

Whitespace / scope checks:

```text
$ git diff --check
(no output)
EXIT=0

$ git status --porcelain            # before staging: only my two new files + T1/orchestrator edits
 M docs/features/hangar-tabs-and-menu-motion/status.md
 M docs/features/hangar-tabs-and-menu-motion/tasks.md
?? src/frontend/src/ui/hangar-tabs.test.ts
?? src/frontend/src/ui/hangar-tabs.ts

$ git add src/frontend/src/ui/hangar-tabs.ts src/frontend/src/ui/hangar-tabs.test.ts
$ git diff --cached --check         # checks the two new files (git diff --check cannot see untracked paths)
(no output)
EXIT=0

$ git status --porcelain            # after staging my files only
 M docs/features/hangar-tabs-and-menu-motion/status.md
 M docs/features/hangar-tabs-and-menu-motion/tasks.md
A  src/frontend/src/ui/hangar-tabs.test.ts
A  src/frontend/src/ui/hangar-tabs.ts
```

The two modified `status.md`/`tasks.md` files are T1/orchestrator board updates, not mine;
they are **not** staged or committed by T2 (verified in the staged set above).

## Assertion integrity

- Concrete assertions only: exact `toEqual` table/lists/records, `toBe('frame')`,
  `toBe(4)`, `toHaveLength(10)`, exact throw messages, and source-level `toEqual`/`not.toMatch`
  guards. No `expect.anything()`/`expect.any()`, no
  `objectContaining`/`arrayContaining`/`stringContaining`, no `toMatchObject`, no snapshot,
  no argument-unchecked `toHaveBeenCalled()`, no `toBeTruthy`/`toBeDefined`/`not.toThrow`
  stand-ins. No bounded float exception was needed.
- No assertion was deleted or weakened: both files are new; nothing pre-existing was edited.
- Every test can fail on a real regression: a changed label/slot/order fails the table pin;
  a dropped or foreign slot fails the union test; a catalog regrouping fails per-tab order;
  a rarity change fails the lootable-id pins; a wrong owner or missing throw fails
  `tabForSlot`; a counting bug (standard counted, quantity counted twice, zero/unknown
  counted, legacy double count lost) fails the matrix; a new React/timer/DOM import fails
  the purity guards.

## Acceptance audit

- **AC-1 — met.** `hangar-tabs.ts` exports exactly `HangarTabId`, `HangarTab`,
  `HANGAR_TABS`, `HANGAR_DEFAULT_TAB`, `HANGAR_TAB_LOOTABLE_TOTAL` (4), `tabForSlot` and
  `tabOwnedCount`. `HANGAR_TABS` has 5 entries in the § Tab set order with the pinned
  `id`/`label`/`slots` (exact `toEqual` + explicit id/label/slots arrays); the union of all
  tabs equals the 10 `SLOT_CATALOG` ids (length 10, `Set` size 10, sorted equality, no
  foreign id) and each tab's slots are in catalog order; `tabForSlot` maps all ten slots
  (`['frame','front','front','wings','wings','engines','engines','ignitions','ignitions','frame']`)
  and throws ``unknown slot: <id>`` for `wings`/`engine`/`body`/`''`/`Hull`/`tail_fin`;
  `HANGAR_DEFAULT_TAB === 'frame'`; each tab exposes exactly 4 lootable parts (exact ids
  per tab); `tabOwnedCount` returns `0` for empty/missing, `4` for both rare + both epic of
  both slots, and counts owned lootable parts only; the module imports only
  `../game/parts-v2` and has no React/DOM/timer/randomness dependency (source guard).
  Evidence: the focused suite above, coverage `hangar-tabs.ts 100/100/100/100`.
- **AC-5 (catalog half) — met.** Badge counts derive from `tabOwnedCount` over the
  normalized map: standard parts never count; unknown ids are ignored; legacy ids count
  after `normalizePartMap` — `wings-silver` → `wings` = 2, `engine-blue` → `ignitions` = 2,
  `body-obsidian` → `frame` = 1, all other tabs `0`. The DOM/`data-owned` half of AC-5 is
  T3's panel integration and is out of this `files_owned` set.

## Deviations from spec

- **Argument order vs. the task brief.** The brief wrote `tabOwnedCount(parts, tab)`; the
  approved spec AC-1 and plan § Interfaces pin `tabOwnedCount(tab, parts)`. Implemented the
  approved contract (`tabOwnedCount(tab, parts?)`). No other divergence.
- No other deviation: no dependency, no lockfile, no CSS, no protocol/server/persistence/
  container change, no coverage exclusion or threshold change, no `!important`, no docs
  outside this build log (T5 owns the documentation pass).
