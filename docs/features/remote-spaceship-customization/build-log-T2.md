# Build log — T2 — Frontend catalog v3 mirror + renderer mapping

Task: T2 (2026-11-18)
Files changed: `src/frontend/src/game/parts-v3.ts` (new), `src/frontend/src/game/parts-v3.test.ts` (new), `docs/features/remote-spaceship-customization/build-log-T2.md` (this log)
Branch: `feat/remote-spaceship-customization` (created from `e4fe4b8`, T1's commits already on `main`; no history rewrite)
Commit: _pending_ — `feat: add frontend spaceship catalog v3`

## What changed & why

- Mirrored T1's pure v3 catalog into the frontend workspace: 11 slots, 1,351 rows (10 × 123 ship + 121 `shot`), classic v2 rows verbatim, 10 generated forms × 12 finishes, `FORM_CATALOG`/`FINISH_CATALOG`/`SLOT_NOUN`, `PART_CATALOG_VERSION === 3`, `CATALOG_ROW_COUNT`/`LOOTABLE_ROW_COUNT`, `CATALOG_ROWS_HASH`.
- Mirrored the behavior functions: `isValidSlotIdV3`/`isValidPartIdV3`/`partDefinitionV3`/`catalogForSlot`/`catalogForSlotForm`/`defaultPartForSlotV3`, `selectLootPartV3` (one draw, clamp map, rare 3 / epic 1), `shotStyleForPart` (form shot profile + `muzzle`), and the v1/v2/v3 normalizers.
- Added the frontend-only `appearanceToShipParamsV3` renderer mapping (11 entries in `SLOT_CATALOG_V3` order, `shot` included, `form` carried for T9's chassis/form resolution); classic v2 ids produce the accepted v2 `PartVisual` values, missing/unknown/wrong-slot entries fall back to the slot standard.
- Kept `game/**` pure: no DOM, no three.js, no `render/**` imports; the visual shape is the pure `PartVisual` type from `game/parts-v2.ts` (widened locally for v3 ids).
- Added 71 unit tests pinning counts, order, ids/names, both pinned rows, v2 preservation, the pinned hash, loot boundaries/weights, normalizers, `shotStyleForPart`, the 11-key mapping, v2 mapping parity for all 30 classic rows, generated color/accent/shape for all 1,320 generated rows, and standards/defaults.

## Decisions

- **Mirror built from the frontend's own `parts-v2.ts`** (same as T1's backend approach): the 30 classic rows are imported and re-wrapped with `form`/`finish: 'classic'`, so AC-3 verbatim preservation is structural rather than re-transcribed.
- **`CATALOG_ROWS_HASH === '4a8df5e0'`** is pinned in the test and matches T1's recorded literal byte-for-byte (hash comparison below). The module is an independent transcription (it imports only the frontend `parts-v2.ts`), so the equal hash is the cross-workspace proof.
- **`PartVisualV3`** is `Omit<PartVisual, 'partId' | 'slot'> & { partId: string; slot: SlotIdV3; form: FormId }`: the plan's `PartVisual & { partId: string }` intersection would keep the v2 `partId` union (an intersection narrows, it does not widen) and reject generated ids. The pure `PartVisual` source is `game/parts-v2.ts` (not `render/`), so no render-layer import is introduced. **T9 seam:** `render/cursor-ship.ts` consumes the ten ship-slot entries of this record and must widen `applySlotVisual`'s v2 `PartVisual` parameter to the v3 shape (or accept the compatible structural subset); T10/T11 consume the `shot` entry for shot style only.
- **No integration tier for T2:** the task adds a pure, deterministic constants/normalizer/mapping module with no I/O or boundary; its consumer integration (protocol, engine, cursor model, preview, panel, scene) is owned by T7/T8/T9/T15/T18. The documented exception is recorded here per the testing bar.
- `game/parts-v2.ts`, `parts-v2.test.ts`, `render/**`, `multiplayer/**`, `ui/**`, `package.json` and the container assets were not touched.

## Evidence

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
 ✓ src/game/parts-v3.test.ts (71 tests) 429ms
 Test Files  80 passed (80)
      Tests  2576 passed (2576)
   Duration  3.60s (transform 8.95s, setup 0ms, collect 23.21s, tests 14.91s, environment 11.26s, prepare 6.12s)

EXIT:0
```

Focused run: `npx vitest run src/frontend/src/game/parts-v3.test.ts --root src/frontend` →
`Test Files  1 passed (1)` / `Tests  71 passed (71)` / `EXIT:0`.

### `npm run coverage --workspace @cubeclicker/frontend`

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.96 |    96.61 |   98.1 |   96.96 |
...
 src/game          |   97.01 |    99.47 |   99.11 |   97.01 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------

EXIT:0
```

Frontend coverage: **statements 96.96 / branches 96.61 / functions 98.1 / lines 96.96**,
thresholds (≥ 80 on all four) passed; `src/game/parts-v3.ts` is **100 %** on all four metrics.

### Hash comparison (AC-6)

- T1 backend literal (`docs/features/remote-spaceship-customization/build-log-T1.md`):
  `4a8df5e0`.
- T2 frontend literal, computed independently from the frontend catalog:

```
$ npx tsx -e "import { CATALOG_ROWS_HASH, PART_CATALOG_V3 } from './src/frontend/src/game/parts-v3.ts'; console.log(CATALOG_ROWS_HASH, PART_CATALOG_V3.length);"
4a8df5e0 1351
EXIT:0
```

The two literals are byte-identical (`4a8df5e0`), and `parts-v3.test.ts` pins
`expect(CATALOG_ROWS_HASH).toBe('4a8df5e0')` plus the FNV-1a sanity vectors
(`811c9dc5` empty payload, `7b95907e` for `a|hull|b|rare|c|d|classic|classic`).

### Scope / diff checks

- `git status --porcelain` shows only the two new source files, this build log and the
  orchestrator-owned untracked feature artifacts (`spec.md`, `plan.md`, `tasks.md`,
  `status.md`, `reviews/`); nothing else was modified.
- `diff -u src/backend/src/game/parts-v3.ts src/frontend/src/game/parts-v3.ts` shows only the
  header comment, the `PartVisual`/`CustomizationState` imports and the appended
  `PartVisualV3` + `appearanceToShipParamsV3` block — every table and behavior function is
  identical to T1.
- No dependency, schema, migration, protocol, hub, repository, metrics, compose/Docker,
  `.env*`, `parts-v2` or `render/**` file was touched.

## Acceptance audit

- **AC-1 — met.** `parts-v3.test.ts` pins 11 slots in order, 1,351 rows / 1,340 lootable,
  per-slot counts (123 × 10 + 121), 11 standard / 670 rare / 670 epic, the 11 standard ids,
  `SLOT_NOUN`, and `PART_CATALOG_VERSION === 3`.
- **AC-2 — met.** Tests pin generated `slot-form-finish` ids and `Finish Form Noun` names,
  1,351 unique ids and names, longest id 30 (`ignition-right-bulwark-crimson`), 11 forms / 12
  finishes, `catalogForSlotForm` 3/1 classic and 12 generated in finish order, the verbatim
  `hull-dart-chrome` row, every `form` in `FORM_CATALOG`, and every classic `shape` among the
  13 v2 keys.
- **AC-3 — met (module scope).** The classic subset computed by the frontend module equals the
  frontend `PART_CATALOG_V2` rows with `form`/`finish: 'classic'` in v2 order, and each slot's
  classic block is first; `parts-v2.ts`/`parts-v2.test.ts` are untouched (final byte-identical
  diff gate is T18).
- **AC-4 — met.** Tests pin one rng draw, `0 → hull-obsidian`,
  `0.999999/1/2/Infinity → shot-kite-solar`, `NaN/-0.5/-Infinity → hull-obsidian`, the first
  rare/epic boundary, all 1,340 lootable ids selected with per-id counts (rare 3, epic 1),
  aggregate rare 2,010/2,680 = 0.75, no standard id ever returned, and different parts on two
  successive seeded draws.
- **AC-5 — met (catalog module scope).** Tests cover v1 fixtures, v2 ids retained, v3
  generated ids and `shot` retained, wrong-slot/unknown/non-string drops,
  canonical-over-legacy precedence, legacy aliases carrying v3 values, duplicate sum,
  invalid/negative/non-integer/overflow counts, zero counts, 11-entry output,
  `SLOT_CATALOG_V3` key order, idempotence, defensive copy, and a version-2-origin state with
  v3 ids. Consumer wiring is owned by T7/T8/T9/T15.
- **AC-6 — met.** `CATALOG_ROWS_HASH === '4a8df5e0'` is pinned in the test and matches T1's
  recorded literal byte-for-byte (hash comparison above); `computeCatalogRowsHash` is exported
  as the reproducible test seam.
- **AC-23 — met (catalog scope).** `shotStyleForPart` tests pin `shot-default`
  (`bolt`/1/`spark`, `#fff1c8`/`#ffd27a`), generated shot rows through their form profile
  (including the `muzzle` kind), every generated form's shot profile, the classic fallback
  for any non-shot part, and `unknown part: <id>` for unknown ids.
- **Mapping task acceptance — met.** Tests pin all 11 mapping keys in catalog order, `shot`
  inclusion and its standard row, exact generated colour/accent/rarity/shape/form for the
  `hull-dart-chrome`, `ignition-right-bulwark-crimson`, `tail-fin-kite-ivory` and
  `shot-orca-violet` rows, every generated row resolved without fallback, field-for-field
  parity with `appearanceToCursorShipParams` for all 30 classic v2 rows, the full ten-slot v2
  appearance, and standard fallbacks for missing/unknown/wrong-slot values.

## Deviations from spec

None. No new dependency, no schema/migration change, no out-of-scope edits. The only
implementation-level note is the `PartVisualV3` type shape (`Omit` instead of the plan's
narrowing intersection), recorded under Decisions with its T9 seam.
