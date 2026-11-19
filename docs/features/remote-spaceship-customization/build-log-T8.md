# Build log — T8 — Engine v3 guest customization + appearance adoption

Task: T8 (2026-11-19)
Files changed: `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`, `docs/features/remote-spaceship-customization/build-log-T8.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `a8acd76` — `feat: adopt v3 guest appearance in the engine` (feature + this log, committed on `feat/remote-spaceship-customization`, not pushed; this hash record lands in the follow-up `docs:` commit, mirroring T1/T2)
Follow-up (2026-11-19): the guest loot draw now uses the v3 catalog (`selectLootPartV3`) — see § Follow-up below.

## Sketch (≤5 lines)

- `equipPart`/`unequipPart` resolve, validate and default through the v3 catalog
  (`isValidPartIdV3`/`partDefinitionV3`/`isValidSlotIdV3`/`defaultPartForSlotV3`); generated v3
  ids equip when owned, unknown/unowned stay no-ops, the 11 standard parts stay implicitly owned.
- `adoptCustomization` normalizes with `normalizeCustomizationStateV3` so generated v3 ids survive
  the account restore/`customizationUpdate` path.
- Add `adoptAppearance(appearance)`: re-normalize with `normalizeAppearanceV3`, replace **only**
  `customization.appearance`, invalidate the snapshot; identical record (any key order) is a no-op.
- Tests: generated hull/shot equip + unequip, standard defaults, unowned/unknown no-ops, v3
  adoption (legacy aliases, wrong-slot/unknown drops), empty/identical/non-empty adoption,
  snapshot publication, stats/board untouched.
- Run lint/typecheck/frontend tests/frontend coverage; record raw output below.

## What changed & why

- `engine.ts` now imports the v3 catalog functions for every guest equip/unequip decision:
  `resolveEquipTargets` accepts any `isValidPartIdV3` id (the ten ship slots and `shot`), the legacy
  `body-*`/`wings-*`/`engine-*` map resolves to classic **v3** ids, `ownsPart` checks
  `partDefinitionV3(id).rarity === 'standard'` or a positive catalog count, and `unequipPart`
  validates the eleven-slot union and compares against `defaultPartForSlotV3` (so `shot-default` is
  the `shot` default).
- `adoptCustomization` switched from `normalizeCustomizationState` (v2) to
  `normalizeCustomizationStateV3`: a restored/`customizationUpdate` row keeps generated v3 ids in
  both `parts` and `appearance` while every accepted legacy rule still applies.
- `adoptAppearance(appearance)` (AC-13 b) is the guest rejoin/reload seam: it normalizes the
  roster record at the engine boundary (unknown ids, wrong-slot values and legacy aliases are
  resolved exactly like the rest of the client), replaces only `customization.appearance`, keeps
  lootbox/key counts, the parts map, the level, the board and the session-local stats, and
  invalidates the cached snapshot. `sameAppearance` compares slot→part mappings without key-order
  sensitivity, so a repeated/identical adoption (or an empty record over an empty one) returns the
  same snapshot reference.
- `GameEngine.adoptAppearance?` is optional for engine-fake source compatibility (the accepted
  pattern of `adoptCubeState?`/`adoptEconomy?`); `OnlineGameEngine` requires it and `createEngine`
  always implements it.
- No board, economy, wave, shot, travel or phase behaviour changed; the guest loot draw
  (`openLootbox` → `selectLootPart`) is untouched (see Decision 1).

## Decisions

1. **The guest loot draw stays the accepted v2 draw (explicit scope).** T8's brief changes
   equip/unequip validation, defaults and appearance handling only and says every other engine
   behaviour (economy included) remains. The accepted `session.test.ts` guest-open fixture
   (T13-owned, out of this task's `files_owned`) pins the grant `engine-left-vector`, which a
   switch to `selectLootPartV3` would break. The consequence — guests still draw from the 30
   classic rows — is a product/ownership question, not a T8 change; it is flagged under Open
   questions for the feature review.
2. **The engine replaces; the session guards.** `adoptAppearance` follows the `adopt*` family
   semantics (absolute replacement of the named state only, per plan § Interfaces): it does not
   inspect whether the local record is empty. T13 owns the AC-13 b "adopt only when the local
   record is empty" condition and the single conditional `setAppearance` send.
3. **Normalize at the engine boundary.** The roster record is already server-normalized, but the
   engine re-normalizes so a legacy/future-shaped record can never reach the renderers and so
   legacy aliases behave exactly as in `equipPart`/`adoptCustomization` (AC-5).
4. **Order-independent equality.** `normalizeAppearanceV3` emits catalog order while `equipPart`
   builds insertion order; comparing entries rather than serialized strings keeps "identical
   adoption is a no-op" true for both (no spurious snapshot churn for React consumers).
5. **Legacy expansion stays local to the engine.** `parts-v3.ts` does not export an id-expansion
   helper (only the full-appearance normalizer), so the engine keeps its accepted
   `LEGACY_EQUIP_TARGETS` table with v3 classic targets; all-or-nothing multi-slot ownership is
   unchanged.
6. **Testing tiers.** The engine is a pure state machine with no I/O boundary; its integration
   boundary (session `welcome` adoption → one `setAppearance`, live `memberAppearance`) is
   `game/session.test.ts`, owned by T13. This task therefore documents the unit-tier exception for
   the integration tier: all new behaviour is exercised through the engine's public seams with
   real v3 catalog data, and T13 carries the session-level integration proof.

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
 Test Files  83 passed (83)
      Tests  2829 passed (2829)
   Duration  4.04s (transform 10.85s, setup 0ms, collect 27.32s, tests 15.70s, environment 11.35s, prepare 6.25s)

EXIT:0
```

Focused run: `npx vitest run src/frontend/src/game/engine.test.ts --root src/frontend` →
`Test Files 1 passed (1)` / `Tests 125 passed (125)` / `EXIT:0` (115 pre-existing + 10 new; the
frontend workspace total grew from 2,819 to 2,829).

> Note: an earlier `npm run lint` pass in this session saw a transient
> `@typescript-eslint/no-unused-vars` error in `src/backend/src/auth/economy-repository.ts`, a file
> written concurrently by the parallel T5 builder (out of this task's scope). It cleared on its
> own when that builder finished; the final workspace-wide lint above is clean and no backend file
> was touched by T8.

### `npm run coverage --workspace @cubeclicker/frontend`

```
 Test Files  83 passed (83)
      Tests  2829 passed (2829)
   Start at  09:47:13
   Duration  5.71s (transform 8.01s, setup 0ms, collect 27.18s, tests 25.50s, environment 12.74s, prepare 7.85s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.16 |    96.69 |   98.35 |   97.16 |
 src/game          |    97.1 |    99.49 |   99.14 |    97.1 |
  engine.ts        |   99.48 |      100 |     100 |   99.48 | 986-987,1296-1297
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   91.31 |    98.84 |   97.43 |   91.31 | ...1684,1819-1820
-------------------|---------|----------|---------|---------|-------------------

EXIT:0
```

Frontend aggregate **97.16 / 96.69 / 98.35 / 97.16** vs. the ≥ 80 statements/branches/functions/
lines gate; `engine.ts` is **99.48 / 100 / 100 / 99.48**. The two uncovered `engine.ts` ranges are
pre-existing branches unrelated to T8 (`flushBoardReplay`'s cleaned-face loop at 986-987 and
`openLootbox`'s defensive standard-grant guard at 1296-1297).

## Acceptance audit

- **AC-5 (engine consumer half) — met.** The engine's guest validation, defaults and both
  normalizers are the v3 module: generated ids equip/unequip, `shot` is a first-class slot with
  `shot-default` as its default, legacy ids/fixtures still expand (existing AC-33 test untouched
  and green), wrong-slot/unknown values are dropped by `normalizeAppearanceV3` /
  `normalizeCustomizationStateV3`, and an adopted v3 state keeps its ids. Evidence: the
  `engine customization v3 (AC-5, AC-13)` tests (10) plus the unchanged legacy/adopt tests.
- **AC-13 (b) (engine half) — met.** `adoptAppearance(appearance)` replaces only
  `customization.appearance`, publishes a new snapshot (`not.toBe(before)`), preserves the previous
  `stats` object, `levelIndex`, `board`, lootbox/key counts and `parts` map, and returns the same
  snapshot for an empty-over-empty or identical adoption (including a different key order). The
  adopted record is normalized (legacy aliases expand, wrong-slot/unknown entries drop). The
  session-owned "adopt when empty, then send once iff different" orchestration is T13's
  `session.test.ts`, outside this task's files.
- **Snapshot publication — met.** `equipPart`, `unequipPart` and `adoptAppearance` all invalidate
  on an accepted change and keep the reference on a no-op (`toBe(before)` pins).
- **No account-path change — met.** `adoptCustomization` still replaces the whole state
  (exact `toEqual`), still advances the snapshot, and now retains generated v3 ids so the
  server-restored account path keeps working; `adoptEconomy`/`adoptUpgrades`/`adoptCubeState` and
  every gameplay behaviour are untouched (diff shows only the customization seams).
- **AC-32 (coverage, T8 contribution) — met.** Frontend aggregate 97.16 / 96.69 / 98.35 / 97.16,
  no exclusion or threshold change.

## Deviations from spec

None. Decisions 1 (guest loot draw unchanged) and 6 (documented integration-tier exception for a
pure engine module) are recorded above; no new dependency, no schema/migration, no
`parts-v2`/`session`/`multiplayer`/`render`/`ui`/backend/container/`.env*` edit.

## Open questions

- **Guest loot draw (for the feature review).** With `openLootbox` intentionally unchanged, a guest
  can never own a generated v3 part through gameplay, so 1,340 catalog rows are account-only in
  practice. If guest parity is wanted, a follow-up task should switch the engine draw to
  `selectLootPartV3` and update the T13-owned guest-open fixture (`session.test.ts` pins
  `engine-left-vector`). This task does not change it because T8's brief excludes economy/loot
  behaviour and the owning test file is outside `files_owned`.

## Follow-up — guest loot draw over the v3 catalog (2026-11-19)

Task: T8 follow-up (gap recorded in § Decisions 1 and § Open questions above).

Files changed: `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`,
`src/frontend/src/game/session.test.ts` (fixture-only, T13-owned deviation), this log.

Branch: `feat/remote-spaceship-customization`; commit: `feat: use the v3 catalog for guest lootboxes`
(not pushed).

### Sketch (≤5 lines)

- `openLootbox` swaps the v2 `selectLootPart`/`partDefinition` pair for
  `selectLootPartV3`/`partDefinitionV3`: one draw over the 1,340 lootable v3 rows, v3 ids in the
  grant and the parts map.
- Counts/keys gate and the no-op rules are byte-identical; only the draw source changes.
- Engine tests: draw `0` → `hull-obsidian`, `0.5` → generated `engine-left-hauler-violet`, `0.999999`
  and `1` → `shot-kite-solar`, second/third opens, and no draw consumed when a count is missing.
- Session fixture (T13-owned): the same injected `0.5` draw now expects the v3 result; no session
  production code touched.
- Run lint/typecheck/frontend tests/frontend coverage; raw output below.

### What changed & why

- The T8 review gap: guest `openLootbox` still drew from the 20 lootable `parts-v2` rows, so a guest
  could never acquire any of the 1,340 generated v3 rows. The engine now draws with
  `selectLootPartV3` (AC-4) and reads the grant metadata from `partDefinitionV3`, so the accepted
  guest path can grant generated ids (`engine-left-hauler-violet`) and the `shot` slot
  (`shot-kite-solar`) as well as the classic rows.
- The accepted guards are unchanged: opening still requires `lootboxes >= 1` and `keys >= 1`, one
  lootbox and one key are consumed per accepted open, the part count increments, `duplicate` is
  computed from the prior count, `sequence` advances once per grant and the snapshot is invalidated
  on success only. The defensive standard-rarity guard stays (the v3 draw never returns a standard
  row; it is unreachable by construction, exactly like the v2 guard it replaces).
- `engine.ts` no longer imports `parts-v2`; the v3 module remains the single catalog consumer
  (AC-5 layering).
- Tests (engine tier): the pre-existing draw-0 test is retitled to v3 and still pins
  `hull-obsidian`; three new tests pin the generated draw, the boundary/one-draw-per-open rule and
  the "no draw consumed without both counts" rule. The `scriptedRandom` helper throws on an extra
  draw, so "exactly one draw per open" is enforced, not merely observed.

### Decisions

1. **The engine keeps its defensive rarity guard.** `selectLootPartV3` only walks lootable rows, so
   the guard cannot trigger; keeping it preserves the accepted `openLootbox` shape (and the existing
   coverage picture) instead of adding an untestable removal to this follow-up.
2. **T13-owned fixture deviation (mechanical).** The two guest-open tests in `session.test.ts` inject
   `fixedRandom = () => 0.5`; that draw resolves to `engine-left-hauler-violet` (epic, `engine-left`)
   in the v3 table, so the pinned v2 grant `engine-left-vector` was replaced by that exact v3 value
   in both tests (including `duplicate` and the final parts map). No session production code,
   assertion shape or other session test changed.
3. **Transport proof stays in the session tier.** The engine has no transport seam; "no transport is
   sent" for a guest open remains the T13 `session.test.ts` proof (`wire.sent` stays `[]` for guest
   opens and insufficient counts, both still green). The engine tier adds the equivalent draw-level
   proof: an insufficient open consumes no RNG draw and returns the same snapshot.
4. **Guest catalog now fully reachable.** With the engine drawing from `selectLootPartV3`, all 1,340
   lootable rows are reachable through guest gameplay, not only account lootboxes; the guest draw
   keeps the accepted single-draw 75 %/25 % aggregate (AC-4).

### Evidence

#### `npm run lint`

```
> lint
> eslint .

EXIT:0
```

#### `npm run typecheck`

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT:0
```

#### `npm test --workspace @cubeclicker/frontend`

```
 Test Files  83 passed (83)
      Tests  2832 passed (2832)
   Duration  4.06s (transform 10.82s, setup 0ms, collect 26.79s, tests 15.92s, environment 11.17s, prepare 6.71s)

EXIT:0
```

Focused run: `npx vitest run src/frontend/src/game/engine.test.ts src/frontend/src/game/session.test.ts --root src/frontend`
→ `Test Files 2 passed (2)` / `Tests 260 passed (260)` (`engine.test.ts` 128 — 125 + 3 new;
`session.test.ts` 132 unchanged in count). The frontend workspace total grew from 2,829 to 2,832.

#### `npm run coverage --workspace @cubeclicker/frontend`

```
 Test Files  83 passed (83)
      Tests  2832 passed (2832)
   Duration  5.85s (transform 10.16s, setup 0ms, collect 27.19s, tests 25.33s, environment 12.89s, prepare 8.15s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.15 |    96.69 |   98.35 |   97.15 |
 src/game          |    97.1 |    99.49 |   99.14 |    97.1 |
  engine.ts        |   99.48 |      100 |     100 |   99.48 | 987-988,1297-1298
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   91.31 |    98.84 |   97.43 |   91.31 | ...1684,1819-1820
-------------------|---------|----------|---------|---------|-------------------

EXIT:0
```

Frontend aggregate **97.15 / 96.69 / 98.35 / 97.15** vs. the ≥ 80 gate; `engine.ts`
**99.48 / 100 / 100 / 99.48**. The two uncovered `engine.ts` ranges are the same pre-existing ones
(`flushBoardReplay`'s cleaned-face loop at 987-988 and the unreachable standard-grant guard at
1297-1298); no exclusion or threshold changed.

### Acceptance audit

- **AC-4 (engine consumer half) — met.** Guest opens draw through `selectLootPartV3`: one draw per
  open (`scriptedRandom` throws on an extra draw), `0` → `hull-obsidian`, `0.999999`/`1` →
  `shot-kite-solar`, `0.5` → generated `engine-left-hauler-violet`, never a standard row (guard kept).
  Counts/keys gate and one-per-open consumption pinned by the retitled draw-0 test, the boundary test
  and the no-draw-without-both-counts test.
- **AC-5 (engine consumer) — met.** `engine.ts` no longer reads `parts-v2`; v3 catalog functions own
  equip/unequip/normalization/loot. `isValidPartIdV3('engine-left-hauler-violet')` is `true` and
  `isValidPartId('engine-left-hauler-violet')` is `false`, proving the grant is v3-only.
- **AC-13 (guest path) — met.** A guest with `lootboxes: 1, keys: 1` opens and receives the pinned
  v3 grant with `sequence: 1`; repeated opens advance the sequence and flag duplicates; insufficient
  counts return `null` without consuming a draw or changing the snapshot. `session.test.ts` still
  proves the guest open sends nothing over the wire.
- **AC-32 (coverage, T8 contribution) — met.** Frontend aggregate 97.15 / 96.69 / 98.35 / 97.15,
  no exclusion or threshold change.
- **Guest catalog reachability — met.** All 1,340 lootable v3 rows (670 rare / 670 epic, total weight
  2,680) are selectable by the guest engine draw; generated rows and the `shot` slot are reachable.

### Deviations from spec

- **Fixture-only, T13-owned:** `src/frontend/src/game/session.test.ts` guest-open expectations
  changed from the v2 grant `engine-left-vector` to the v3 result `engine-left-hauler-violet` for the
  same injected `0.5` draw (two tests, mechanical consequence of the draw switch; no production
  session code touched). Recorded here as the T8 log entry for that deviation.
- No new dependency, no schema/migration, no `parts-v2`/`parts-v3`/`session`/`multiplayer`/`render`/
  `ui`/backend/container/`.env*` edit; no assertion weakened (no wildcard matchers added).
