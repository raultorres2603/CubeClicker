# Build log — T9 — Cursor model v3, form/chassis math, preview mapping

Task: T9 (2026-11-18)
Files changed: `src/frontend/src/game/ship-forms.ts` (new), `src/frontend/src/game/ship-forms.test.ts` (new), `src/frontend/src/render/cursor-ship.ts`, `src/frontend/src/render/cursor-ship.test.ts`, `src/frontend/src/render/preview.ts`, `src/frontend/src/render/preview.test.ts`, `docs/features/remote-spaceship-customization/build-log-T9.md` (this log)
Branch: `feat/remote-spaceship-customization` (from `965c4c9`; T14 committed `17c62ff` + `965c4c9` first, disjoint files)

## What changed & why

- Added the pure `game/ship-forms.ts`: `FORM_RECIPES` (derived from the pinned `FORM_CATALOG` — no
  second numeric table), `isGeneratedFormId`, `slotFormTransform(slot, form)` implementing the plan
  formula exactly (classic and the `shot` slot are identity) and `chassisPose(form)` (classic
  `[1, 1, 1]`). Imports only `./parts-v3.js`; no three.js, no `render/**`, no DOM/timers/randomness.
- `render/cursor-ship.ts` resolves v3 part ids through `appearanceToShipParamsV3`/`PartVisualV3`,
  resolves each slot transform in the pinned order (v2 `CURSOR_SLOT_SHAPE_TRANSFORMS` entry →
  generated `slotFormTransform` → `standard`), writes the slot-group position too, stores the hull
  form's chassis triple and exposes `applyPulseScale(pulseScale)` as the model group scale's only
  writer (`chassis × pulse`). `applyAppearance` applies both; a repeated identical application is a
  no-op (signature early return before any material/transform write).
- `render/preview.ts` resolves through `appearanceToShipParamsV3` and applies the ten ship slots of
  the 11-entry record, skipping `shot` (shot style only, no preview geometry), so the preview's
  chassis/slot transforms match the cursor model.
- Tests: 19 new (`ship-forms`), +13 `cursor-ship`, +3 `preview` (48/10 total in those files), all
  concrete-valued; no assertion was weakened or deleted (only the three `applySlotVisual` fixtures
  gained the now-required `form: 'classic'` field).

## Decisions

- **`FORM_RECIPES` is derived from `FORM_CATALOG`** (`Object.fromEntries` over the recipe-bearing
  entries, one documented cast). The spec's "no second source of truth for the slot/form/finish
  tables" rule wins; the test pins all ten recipes field-for-field against the spec table, so an
  edit to `parts-v3.ts` is caught.
- **Tail-fin roll = `+0.5 · Srad`.** The plan writes `[0, 0, ∓0.5Srad]` "(left +, right −)" but the
  model has a single centred `tail-fin` slot, so the positive/port branch applies. Pinned in
  `ship-forms.test.ts` (every form) and in the cursor model (`tail-fin-kite-ivory` →
  `0.5 · 38 · π / 180`).
- **v2 table wins over the formula for a shared shape key.** `lance` is both a v2 nose shape
  (`nose-crimson`) and a generated form id; the plan's resolution order makes the accepted v2 entry
  win, so generated `nose-lance-*` renders `[0.9, 0.9, 1.18]`. This is deliberate (preserves every
  v2 visual exactly) and pinned by its own test alongside `nose-needle-*` taking the formula.
- **Pulse memory.** The model stores the last `pulseScale`; a hull/chassis change re-applies
  `chassisPose(form) × storedPulse`, so an equip that changes the hull mid-pulse cannot drop the
  accepted equip feedback. `applyPulseScale` is the single writer of `group.scale` inside the model
  and `visualSignature` includes `form` (chassis-only change detection).
- **`applySlotVisual` widened to `PartVisualV3`** (T2 seam) and a `shot` entry is an explicit
  `false` no-op, so there is never a `slot-shot` group (the model keeps 10 groups / 21 meshes).
- **Handoff to T10 (by plan/tasks):** `render/spaceship.ts` still calls
  `model.group.scale.setScalar(pulseScale)`; T10 (depends on T9) changes `applyPulse` to call
  `applyPulseScale`. Until then the own cursor's chassis is overwritten on the first `update`; the
  model API, the composition tests and the rest/peak values are in place here, and T9 does not own
  `spaceship.ts`. `spaceship.test.ts`/`scene.test.ts` own-ship rest/peak evidence is T10/T12.
- **Testing tiers.** Unit: `game/ship-forms.test.ts` and `render/cursor-ship.test.ts` (pure model
  over real three.js objects, no DOM). Integration: `render/preview.test.ts` exercises the real
  `createPreviewScene` (lights + camera + model) with an 11-entry v3 appearance, and the unchanged
  `ui/SpaceshipPreview.test.tsx` (jsdom + real scene) still passes against the v3 behaviour.

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
 ✓ src/App.test.tsx (62 tests) 1249ms

 Test Files  81 passed (81)
      Tests  2624 passed (2624)
   Start at  16:26:02
   Duration  4.05s (transform 8.46s, setup 0ms, collect 25.58s, tests 15.91s, environment 11.96s, prepare 7.55s)

EXIT:0
```

Baseline at the post-T14 tree (`965c4c9`): 2,588 tests (derived: 2,624 − 36 T9 tests). Delta:
+1 file (`ship-forms.test.ts`, 19 tests), `cursor-ship.test.ts` 34 → 48, `preview.test.ts` 7 → 10.

Focused run (`npx vitest run src/game/ship-forms.test.ts src/render/cursor-ship.test.ts
src/render/preview.test.ts --root src/frontend`):

```
 Test Files  3 passed (3)
      Tests  77 passed (77)
EXIT:0
```

### `npm run coverage --workspace @cubeclicker/frontend`

```
 Test Files  81 passed (81)
      Tests  2624 passed (2624)
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.99 |    96.65 |   98.12 |   96.99 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  ship-forms.ts    |     100 |      100 |     100 |     100 |
  cursor-ship.ts   |   99.58 |    98.18 |     100 |   99.58 | 228-229
  preview.ts       |     100 |      100 |     100 |     100 |
EXIT:0
```

Frontend coverage: **statements 96.99 / branches 96.65 / functions 98.12 / lines 96.99** —
thresholds (≥ 80 on all four) passed. `ship-forms.ts` and `preview.ts` are 100 % on all four;
`cursor-ship.ts`'s only uncovered lines (228-229) are the pre-existing non-indexed
`countGeometryTriangles` branch, untouched by T9.

### Pinned-value proof (AC-17 decimals)

```
$ npx tsx -e "... slotFormTransform / chassisPose ..."
slotFormTransform(hull, dart) = {"scale":[0.85,0.9,1.15],"rotation":[0,0,0],"position":[0,0,0.02]}
slotFormTransform(wing-left, manta).rotation.y = 0.5585053606381855
chassisPose(dart) = [0.95,0.9,1.25]
chassis x pulse(1.04) = [0.988,0.936,1.3]
chassisPose(classic) = [1,1,1]
EXIT:0
```

`0.5585053606381855 === (32 · π) / 180`. The pulse composition prints the AC-17 decimals
(`[0.988, 0.936, 1.3]`); the tests additionally assert exact `chassis · 1.04` doubles plus the
`1e-9` decimal bounds.

## Acceptance audit

- **AC-2 — met (v3 id resolution scope).** `cursor-ship.test.ts` applies an 11-entry v3 appearance
  (`hull-dart-chrome`, `nose-needle-ember`, `cockpit-kite-jade`, `wing-left-manta-jade`,
  `wing-right-manta-steel`, `engine-left/right-arrow-azure`,
  `ignition-left-hauler-plasma`, `ignition-right-hauler-steel`, `tail-fin-kite-ivory`,
  `shot-orca-violet`) and pins generated colours (`#c9d4e2`, `#c2410c`, `#15803d`, `#e7e5e4`,
  `#64748b`/`#cbd5e1`), transforms (dart hull `[0.85, 0.9, 1.15]` + `z 0.02`, manta wing sweep
  `±(32·π)/180`, kite tail `[1.05, 1.1, 0.9]` roll `0.5·38·π/180`, needle nose `z 0.1`) and that all
  ten ship slots change; the 30 classic rows are asserted verbatim through their v2 shape transforms
  and colours. Catalog counts/ids/names are T2's evidence.
- **AC-5 — met (module layering).** `ship-forms.test.ts` reads the module source and asserts the
  only import specifier is `./parts-v3.js` (no `three`, no `render/**`) plus no
  timer/random/DOM/storage access; `ship-forms.ts` is pure `game/**`.
- **AC-17 — met (T9 scope).** Classic fixture `{hull: 'hull-obsidian', wing-left: 'wing-left-gold'}`
  → hull colour `#1a2333`, port wing `#ccaa44`, hull slot transform = the v2 `armored`
  `[1.06, 1.1, 1.02]`; `{hull: 'hull-dart-chrome'}` → hull slot `[0.85, 0.9, 1.15]` and chassis
  `[0.95, 0.9, 1.25]` (rest scale); `applyPulseScale` at rest `[0.95, 0.9, 1.25]` and at
  `shipEquipPulseScale(130) === 1.04` → `[0.988, 0.936, 1.3]`; classic `[1,1,1] → [1.04,1.04,1.04]`
  and back to `[1,1,1]` at 260 ms; 30/30 classic rows keep their v2 shape transform and colours;
  a source guard pins `applyPulseScale` as the model group scale's only writer (no `setScalar`).
  Live re-skin / remote ship / own-ship `applyPulse` are T11/T12/T10.
- **AC-18 — met (cursor-model half; review M4).** Repeating the same generated appearance writes no
  material `color.set`, no slot scale/rotation/position write and no chassis write (19 colour spies,
  10×3 transform spies, 1 chassis spy, all 0 calls), and returns `[]`. Missing/`{}`/unknown/
  wrong-slot entries fall back to the standard part without throwing. The remote-ship evidence is
  T11's.
- **AC-31 — met (preview scope).** `preview.test.ts` pins an 11-entry v3 appearance on the ten ship
  slots (`#c9d4e2`, `#15803d`, `#e7e5e4`, ignition `#2f6fd6`/`#7cf6ff`), the hull chassis
  `[0.95, 0.9, 1.25]` and hull slot `[0.85, 0.9, 1.15]`/`z 0.02`, that a shot-only appearance
  selects no geometry (10 groups, all identity), and unknown/wrong-slot fallbacks. The reveal yaw and
  the `SpaceshipPreview` attributes are T14/T15.

## Scope / diff checks

- `git status --porcelain` after the change lists only the six T9 files plus this log; the
  orchestrator-owned feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`)
  were already untracked and were not edited.
- Untouched: `render/spaceship.ts`, `game/reveal-motion.ts`, `render/lootbox-reveal.ts`,
  `ui/LootboxReveal.tsx`, `ui/SpaceshipCustomizationPanel.tsx`, `ui/SpaceshipPreview.tsx`,
  `multiplayer/**`, `game/engine.ts`, `game/session.ts`, `App.tsx`, `parts-v2.ts`/test, backend,
  `package.json`/lockfiles, compose/Docker, `.env*`.
- No new dependency, no schema/migration change.

## Deviations from spec

None. The tail-fin roll sign is an interpretation of the plan's single-slot `∓` (positive/port
branch) recorded under Decisions; no scope, dependency or contract changed.
