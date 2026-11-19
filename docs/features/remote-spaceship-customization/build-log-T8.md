# Build log — T8 — Engine v3 guest customization + appearance adoption

Task: T8 (2026-11-19)
Files changed: `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`, `docs/features/remote-spaceship-customization/build-log-T8.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `a8acd76` — `feat: adopt v3 guest appearance in the engine` (feature + this log, committed on `feat/remote-spaceship-customization`, not pushed; this hash record lands in the follow-up `docs:` commit, mirroring T1/T2)

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
