# Build log — T14 — `shot` support in the reveal path

Task: T14 (2026-11-18)
Files changed: `src/frontend/src/game/reveal-motion.ts`, `src/frontend/src/game/reveal-motion.test.ts`, `src/frontend/src/render/lootbox-reveal.ts`, `src/frontend/src/render/lootbox-reveal.test.ts`, `src/frontend/src/ui/LootboxReveal.tsx`, `src/frontend/src/ui/LootboxReveal.test.tsx`, `docs/features/remote-spaceship-customization/build-log-T14.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `feat: support shot parts in lootbox reveal` (feature + this log; hash recorded in the follow-up `docs:` commit, mirroring T1/T2)

## What changed & why

- `REVEAL_SLOT_YAW_RAD` is now `Record<SlotIdV3, number>` with exactly eleven keys: the accepted ten values are untouched and `shot: 0.9` is added; `revealStagePose`/`slotYawFor` take the v3 slot, so a shot grant yaws to `0.9` on the unchanged 1290 ms timeline.
- `render/lootbox-reveal.ts` resolves the grant through the v3 catalog (`partDefinitionV3`) and normalizes the try-on copy with `normalizeAppearanceV3`; the wire `slot` is still never read. A `shot` part has no model mesh, so the stage records `grantedIndex = -1`, stages the `shot` entry only, adds no mesh/slot group and never pulses a ship slot.
- `ui/LootboxReveal.tsx` switches `isValidPartId`/`partDefinition`/`normalizeAppearance`/`SLOT_CATALOG` to their v3 counterparts, so a shot grant renders `data-slot="shot"`, the slot display name `Shot` and the catalog part name (e.g. `Solar Kite Bolt`) with unchanged focus, Equip/Dismiss, reduced-motion and WebGL-fallback behaviour.
- Tests pin the eleven yaw values and the ten unchanged ones, a v3 shot grant at `420`/`970`/`1290` ms (0.9 rad, no slot pulse, ship signature identical to a non-shot stage), v2 byte-equivalence, a generated v3 id resolved through its catalog slot (wire slot `shot` ignored), the unknown-part fallback, the shot card/fallback/reduced-motion paths, and the v3-only imports of both production modules.

## Decisions

- **`shot` is a slot with a yaw but no model slot.** Instead of fabricating a shot group, `grantedIndex` stays `-1` for `shot`; the pulse row of `revealStagePose` is still computed (1.1 at 970 ms) but multiplies no group, which is exactly the AC-31 "staged ship unchanged (no mesh)" contract and survives T9's v3 cursor-model widening.
- **v3 types only at the reveal boundary.** `reveal-motion.ts` widens its slot parameter to `SlotIdV3` (pure type import from `game/parts-v3.ts`); no runtime coupling beyond the already-pure catalog module, and `render/**`/`ui/**` consume the v3 API directly. The source-level regression test (`resolves reveal ids through the v3 catalog, never the v2 catalog`) guards both production files against a silent fallback to `parts-v2`.
- **No new test seam.** Every shot assertion runs through the existing seams (`createRevealStage` in the render tier, `createRenderer`/`createStage` in the component tier, the real stage in the single-context test), so no production API was added for testability.
- **Evidence isolation.** T9 was editing `src/frontend/src/render/cursor-ship.ts` and adding `game/ship-forms.ts` in the shared checkout while this task ran (its untracked files appeared at 16:20–16:21). The final verify recipe was therefore run in an isolated `git worktree` at `36117b9` (the feature branch HEAD) with exactly this task's six source files applied, so the recorded numbers describe T14 alone and are reproducible after T9 lands. The same full suite had already passed in the shared checkout before T9's first edit landed (80 files / 2,588 tests, `EXIT:0`); the live checkout's later lint/typecheck failure is entirely in T9's in-flight `cursor-ship.ts`/`ship-forms.test.ts` (6 unused-symbol lint errors, missing `PartVisual`/`chassisScale` type errors), not in the files of this task.
- **No integration exception needed.** Unit tier: `reveal-motion.test.ts` (pure pose table). Integration tiers: `lootbox-reveal.test.ts` (real three.js scene graph through the stage factory) and `LootboxReveal.test.tsx` (React render in jsdom with a stubbed RAF, including the real stage behind the single fake renderer).

## Evidence

All four commands were run in `/tmp/opencode/t14-wt` — a `git worktree` at `36117b9` with this task's six files copied in — to avoid the concurrent T9 edits in the shared checkout.

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
 ✓ src/render/lootbox-reveal.test.ts (20 tests) 97ms
 ✓ src/game/reveal-motion.test.ts (47 tests) 14ms
 ✓ src/ui/LootboxReveal.test.tsx (45 tests) 527ms
 Test Files  80 passed (80)
      Tests  2588 passed (2588)
   Duration  4.16s (transform 10.81s, setup 0ms, collect 27.29s, tests 16.19s, environment 12.22s, prepare 6.71s)

EXIT:0
```

2,588 tests vs. T2's 2,576: +12 new tests (reveal-motion +2, lootbox-reveal +4, LootboxReveal +6); no existing assertion changed except the v2→v3 slot type in `reveal-motion.test.ts`.

### `npm run coverage --workspace @cubeclicker/frontend`

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.96 |    96.61 |   98.1 |   96.96 |
...
  reveal-motion.ts |     100 |      100 |     100 |     100 |
  ...box-reveal.ts |     100 |      100 |     100 |     100 |
  ...boxReveal.tsx |   98.24 |    94.89 |     100 |   98.24 | 154-155,275-276
...
-------------------|---------|----------|---------|---------|-------------------

EXIT:0
```

Frontend coverage: **statements 96.96 / branches 96.61 / functions 98.1 / lines 96.96**; thresholds (≥ 80 on all four) passed. The three task files are at 100 % except `LootboxReveal.tsx`'s two pre-existing defensive branches (`canvas === null` guard, `handleEquip`'s disabled-button guard), unchanged by this task.

### Corroborating run in the shared checkout (before T9's first write landed)

```
 ✓ src/App.test.tsx (62 tests) 1323ms
 Test Files  80 passed (80)
      Tests  2588 passed (2588)
   Duration  4.21s ...
EXIT:0
```

## Acceptance audit

- **AC-31 (reveal half) — met.** `REVEAL_SLOT_YAW_RAD` has exactly eleven keys, `shot: 0.9`, and a separate test pins the ten accepted values unchanged (`reveal-motion.test.ts`). A v3 shot grant renders `data-slot="shot"`, slot name `Shot`, the catalog part name `Solar Kite Bolt`, rarity `Epic`, owned count, Equip/Dismiss and the fallback path (`LootboxReveal.test.tsx`); the stage stages only `shot`, adds no mesh (`21` meshes / `10` slot groups / `776` triangles), keeps the grant's ring colour and leaves the ship signature identical to a non-shot stage (`lootbox-reveal.test.ts`). The timeline is the unchanged `420 + 250 + 120 + 360 + 140` ms pose table (`1290` rest row) and is asserted for shot at 420/970/1290 ms and under reduced motion. Unknown/invalid ids still fall back before any GPU resource is built (`unknown part: <id>`; component `Unknown part` card).
- **AC-31 (preview half) — not in this task's scope.** The preview mapping (`appearanceToShipParamsV3`, ten v3-valued `data-preview-slot-*` attributes, legacy colour attributes) is owned by T9 (`render/preview.ts`) and T15 (`ui/SpaceshipPreview.tsx`); T14 owns only `reveal-motion`, `render/lootbox-reveal` and `ui/LootboxReveal`. No preview file was touched.
- **Wire-slot independence — met.** A grant `{ partId: 'hull-dart-chrome', slot: 'shot' }` stages `{ hull: 'hull-dart-chrome' }` and yaws to the hull value `0.35`, never the shot yaw; a shot grant with wire slot `hull` renders `data-slot="shot"`.

## Deviations from spec

None. No new dependency, no schema/migration, no protocol, backend, container, `package.json`/lockfile, `parts-v2`, `render/cursor-ship.ts`, `render/preview.ts`, `game/ship-forms.ts`, `render/spaceship.ts`, `ui/SpaceshipCustomizationPanel.tsx`, `ui/SpaceshipPreview.tsx` or `.env*` edit. The remaining files under this feature's untracked orchestrator artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`) are untouched.
