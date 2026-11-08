# Build log — T4 — Repository v2 methods + normalization

Task: T4 (2026-11-08)
Files changed: `src/backend/src/auth/economy-repository.ts`, `src/backend/src/auth/economy-repository.test.ts`, `docs/features/spaceship-cursor-loot-animations/build-log-T4.md`

What changed & why: Added `applyLootboxOpenV2` (one conditional atomic statement: locked CTE → decrement both counts, increment the part, `duplicate` from the pre-increment parts map) and `setSlotAppearance` (one-key `jsonb_set`/`-` UPDATE with zero-row upsert) to both repository implementations. All customization reads now normalize through `normalizeCustomizationState` (legacy keys/ids mapped, unknown/mismatched entries dropped), which makes `findCustomizationByUserId` the v2 read path regardless of `customization_version` (F15/N5). Legacy `applyLootboxOpen`/`setAppearance` and their signatures/SQL remain for the current hub. `parseParts` now rejects non-number JSON values so malformed/overflow maps normalize to valid state only.

Decisions:
- **Read normalization is unconditional** (idempotent for canonical v2 state): it satisfies AC-16's "legacy present regardless of version" and "version < 2" triggers in one path, covers "unknown ids dropped" for every read, and follows spec-r2 N5's resolution (`findCustomizationByUserId` normalizes always; legacy writers remain for compatibility).
- **Duplicate is exact pre-increment presence.** The Postgres statement uses a `target` CTE with `FOR UPDATE` that captures `parts` before the update; `t.previous_parts ? $3` is returned as `duplicate`, so concurrent opens cannot misreport it and a zero-count entry still counts as "present" (literal AC-17). In-memory uses `hasOwnProperty`.
- **Fail order** is `no_lootbox` then `no_key` in both implementations; a missing row reports `no_lootbox`. The fallback SELECT only runs after the atomic UPDATE returns no row.
- **Writes stay raw; reads normalize.** Old `applyLootboxOpen`/`setAppearance` keep writing their stored shape, but their returned state goes through the same normalized read mapper as Postgres, so both implementations stay shape/value-parity.
- **Integration tier:** a real `postgres:16-alpine` (Podman/Docker-detected, skipped when absent) suite executes the actual JSONB/CTE SQL for the AC-33 restored row, atomic open/duplicate, slot set/delete and zero-row upserts; fake-`pg` tests pin statement text/params.

Evidence:

- `npm run lint` → **owned files clean**: `npx eslint src/backend/src/auth/economy-repository.ts src/backend/src/auth/economy-repository.test.ts` exit 0. The workspace-wide `npm run lint` is transiently red from a concurrently edited out-of-scope file (`src/frontend/src/render/cube-view.ts`, T9 work in another agent) — raw output below; it was green at the start of this task and is not caused by T4.

```
> lint
> eslint .

/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/render/cube-view.ts
  321:41  error  '_instant' is assigned a value but never used  @typescript-eslint/no-unused-vars
  344:19  error  '_dtMs' is defined but never used              @typescript-eslint/no-unused-vars

✖ 2 problems (2 errors, 0 warnings)
```

The first T4 run of `npm run lint` (before the concurrent T9 edits landed) exited 0 with no output; a later retry still showed the two `cube-view.ts` errors, so the failure is independent of T4. `npx eslint src/backend/src/auth/economy-repository.ts src/backend/src/auth/economy-repository.test.ts` exits 0.

- `npm run typecheck --workspace @cubeclicker/backend` → exit 0.

```
> typecheck
> tsc --noEmit
```

- `npm test --workspace @cubeclicker/backend` → 24 files passed, 851 tests passed (economy repository: 97 unit/parity + 5 real-PostgreSQL = 102).

```
 Test Files  24 passed (24)
      Tests  851 passed (851)
   Duration  3.15s
 ✓ src/auth/economy-repository.test.ts (102 tests) 2430ms
```

- `npm run coverage --workspace @cubeclicker/backend` → exit 0; thresholds ≥ 80% met (95.34 stmts / 87.48 branch / 99.69 funcs / 95.34 lines; economy repository 95.5 / 84.61 / 100 / 95.5). The uncovered lines `681-682, 738-751` are pre-existing legacy `grantCustomization`/`setAppearance` fallbacks, not T4 code.

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.34 |    87.48 |   99.69 |   95.34 |
 src/auth          |   95.61 |    81.41 |     100 |   95.61 |
  ...repository.ts |    95.5 |    84.61 |     100 |    95.5 | ...81-682,738-751
 src/db            |     100 |      100 |     100 |     100 |
 src/game          |   96.37 |    95.14 |   99.23 |   96.37 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

Acceptance audit:
- AC-16 → **met**. `findCustomizationByUserId` returns normalized defensive copies from both implementations; missing rows return the zero state; legacy keys/ids normalize regardless of version; unknown part ids, unknown slots, slot/part mismatches and malformed/overflow counts are dropped; in-memory and Postgres agree on the AC-33 fixture. Evidence: `customization read normalization (T4)` (in-memory fixture, unknown/mismatch drop, grant normalization, PG version-2 fixture, version-1 drop, malformed JSON, overflow/invalid values, defensive copy, PG grant normalization) + real-PG restored-row test.
- AC-17 → **met**. Atomic conditional open: both counts decrement by exactly 1 and `parts[partId]` increments in one statement; `duplicate` is pre-increment presence; `no_lootbox` precedes `no_key`; no state change on failure; counts never negative; in-memory mirrors the contract. Evidence: `InMemoryEconomyRepository v2 lootbox/appearance`, `PgEconomyRepository v2 lootbox/appearance`, real-PG open/duplicate tests.
- AC-22 → **met**. `setSlotAppearance` sets one slot with `jsonb_set` or deletes it with `jsonb -`, leaving other slots untouched, with a zero-row upsert; in-memory mirrors it. Evidence: set/delete/upsert tests in both implementations + real-PG set-then-delete test.
- AC-33 → **met** for the repository layer. The exact restored fixture (`parts={"wings-silver":2,"engine-blue":1,"body-gold":1}`, `appearance={"wings":"wings-silver","engine":"engine-blue","body":"body-gold"}`, `customization_version=2`) reads as the pinned v2 parts/appearance in-memory, via a fake `pg` row and against real PostgreSQL; a version-1 row also normalizes. Hub/session/smoke evidence is T5/T14.

Deviations from spec: none. (Root `npm run lint` currently fails only on concurrent out-of-scope T9 frontend edits; T4-owned files are clean.)
