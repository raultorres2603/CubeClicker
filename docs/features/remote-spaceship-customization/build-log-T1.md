# Build log — T1 — Backend catalog v3 (1,351 rows, loot draw, normalizers)

Task: T1 (2026-11-18)
Files changed: `src/backend/src/game/parts-v3.ts` (new), `src/backend/src/game/parts-v3.test.ts` (new), `docs/features/remote-spaceship-customization/build-log-T1.md` (this log)
Commit: `b0f32614d7ca492547616d8fa62bbeaf0c463007` — `feat: add backend spaceship catalog v3` (committed on `main`, not pushed)

## What changed & why

- Added the pure backend v3 catalog: 11 slots (`SLOT_CATALOG_V3`), `SLOT_NOUN`, 11 forms
  (`FORM_CATALOG` with pinned recipes/chassis/shot profiles), 12 finishes (`FINISH_CATALOG`), and the
  1,351-row `PART_CATALOG_V3` built as classic v2 rows (verbatim, `form`/`finish: 'classic'`) +
  10 generated forms × 12 finishes per slot, in pinned catalog order.
- Exported `PART_CATALOG_VERSION === 3`, `CATALOG_ROW_COUNT === 1351`,
  `LOOTABLE_ROW_COUNT === 1340`, `CATALOG_ROWS_HASH` (FNV-1a 32-bit per AC-6) and the catalog
  lookups/defaults.
- Added the one-draw weighted loot selection (`rare 3` / `epic 1`, total 2,680) with the pinned
  clamp map (`NaN → 0`, `-Infinity → 0`, `≤ 0 → 0`, `Infinity → 1`, `≥ 1 → 1`), the shot-style
  resolver with the classic fallback, and the v1/v2/v3 normalizers.
- Added 63 unit tests pinning counts, order, ids/names, both pinned rows, the 13 v2 shape keys,
  the hash literal, draw boundaries/weights, all normalizer rules and `shotStyleForPart`.

## Decisions

- **Classic rows are imported from `parts-v2.ts`** (the accepted classic subset) and re-wrapped with
  `form: 'classic'` / `finish: 'classic'`; `shot-default` is the only hand-written classic row
  because v2 has no shot slot. This guarantees the AC-3 verbatim preservation rather than
  re-transcribing 30 rows.
- **`SLOT_CATALOG_V3` derives the ten ship slot ids/names from `SLOT_CATALOG`** and appends
  `{ shot, 'Shot' }`, so the slot display names have one source.
- **`CATALOG_ROWS_HASH === '4a8df5e0'`** (8 lowercase hex digits), pinned in the test. T2 must pin
  the same literal. Hash sanity vectors also pinned in the test: empty payload `811c9dc5` and the
  single synthetic row `a|hull|b|rare|c|d|classic|classic` → `7b95907e`.
- **Test seam:** `computeCatalogRowsHash(rows)` is exported so the hash is reproducible; the
  production constant is computed from `PART_CATALOG_V3` at module load.
- **No integration tier for T1:** the task adds a pure, deterministic constants/normalizer module
  with no I/O or boundary; its consumer integration (protocol/hub/repository/panel/scene) is owned by
  T3/T5/T6/T15/T18. The documented exception is recorded here per the testing bar.

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

### `npm test --workspace @cubeclicker/backend`

```
 ✓ src/game/parts-v3.test.ts (63 tests) 245ms
 ✓ src/game/hub.test.ts (194 tests) 348ms
 ✓ src/auth/economy-repository.test.ts (119 tests) 2428ms
 ...
 Test Files  38 passed (38)
      Tests  1601 passed (1601)
   Start at  13:12:04
   Duration  3.33s (transform 5.55s, setup 0ms, collect 12.52s, tests 13.64s, environment 7ms, prepare 2.96s)

EXIT:0
```

Focused run: `npx vitest run src/backend/src/game/parts-v3.test.ts --root src/backend` →
`Test Files  1 passed (1)` / `Tests  63 passed (63)` / `EXIT:0`.

### `npm run coverage --workspace @cubeclicker/backend`

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.44 |    90.31 |   99.59 |   96.44 |
 src/game          |   96.21 |    94.81 |    99.1 |   96.21 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
EXIT:0
```

Coverage thresholds (statements/branches/functions/lines ≥ 80) passed; `parts-v3.ts` is 100 % on
all four metrics.

### Scope / diff checks

- `git status --porcelain` before the feature commit showed only the two new source files plus the
  untracked feature-artifact directory: `?? src/backend/src/game/parts-v3.test.ts`,
  `?? src/backend/src/game/parts-v3.ts`, `?? docs/features/remote-spaceship-customization/`.
- `src/backend/src/game/parts-v2.ts` and `parts-v2.test.ts` were not modified (they do not appear in
  `git status` / the commit; AC-3 byte-identical gate).
- No dependency, schema, migration, protocol, hub, repository, metrics, compose/Docker or `.env*`
  file was touched.

### Hash literal

`npx tsx -e "import { CATALOG_ROWS_HASH } from './src/game/parts-v3.ts'; console.log(CATALOG_ROWS_HASH);"` →

```
4a8df5e0
```

`CATALOG_ROWS_HASH = '4a8df5e0'` (AC-6 payload: `[id, slot, name, rarity, color, accent, form,
finish].join('|')` per row, rows joined with `\n`, FNV-1a 32-bit, 8 lowercase hex digits). This is the
literal T2 must match byte-for-byte.

## Acceptance audit

- **AC-1 — met.** `parts-v3.test.ts` pins 11 slots in order, 1,351 rows / 1,340 lootable, per-slot
  counts (123 × 10 + 121), 11 standard / 670 rare / 670 epic, the 11 standard ids, `SLOT_NOUN`, and
  `PART_CATALOG_VERSION === 3`.
- **AC-2 — met.** Tests pin generated `slot-form-finish` ids and `Finish Form Noun` names, 1,351
  unique ids and names, longest id 30 (`ignition-right-bulwark-crimson`), 11 forms / 12 finishes,
  `catalogForSlotForm` 3/1 classic and 12 generated in finish order, the verbatim `hull-dart-chrome`
  row, every `form` in `FORM_CATALOG`, and every classic `shape` among the 13 v2 keys.
- **AC-3 — met.** The filtered classic subset equals `PART_CATALOG_V2` with `form`/`finish:
  'classic'` in v2 order, and each slot's classic block is first. v2 files untouched.
- **AC-4 — met.** Tests pin one rng draw, `0 → hull-obsidian`, `0.999999/1/2/Infinity →
  shot-kite-solar`, `NaN/-0.5/-Infinity → hull-obsidian`, the first rare/epic boundary, all 1,340
  lootable ids selected with per-id counts (rare 3, epic 1), aggregate rare 2,010/2,680 = 0.75, no
  standard id ever returned, and different parts on two successive seeded draws.
- **AC-5 — met.** Tests cover v1 fixtures, v2 ids retained, v3 generated ids and `shot` retained,
  wrong-slot/unknown/non-string drops, canonical-over-legacy precedence, legacy aliases carrying v3
  values, duplicate sum, invalid/negative/non-integer/overflow counts, zero counts, 11-entry output,
  `SLOT_CATALOG_V3` key order, idempotence, defensive copy, and a version-2-origin state with v3 ids.
- **AC-6 — met.** `CATALOG_ROWS_HASH === '4a8df5e0'` is pinned in the test, plus the FNV payload
  sanity vectors; the literal is recorded above for T2.

## Deviations from spec

None. No new dependency, no schema/migration change, no out-of-scope edits.
