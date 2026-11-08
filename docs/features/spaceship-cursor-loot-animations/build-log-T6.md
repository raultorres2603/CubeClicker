# Build log — T6 — Frontend v2 catalog module (additive)

Task: T6 (2026-11-08)
Files changed: `src/frontend/src/game/parts-v2.ts`, `src/frontend/src/game/parts-v2.test.ts`,
`docs/features/spaceship-cursor-loot-animations/build-log-T6.md`

What changed & why: added the additive frontend catalog v2 mirroring backend T1 — 10 slots,
exact 30-row table, `PART_CATALOG_VERSION = 2`, slot/part validators, rarity weights and the
one-draw `selectLootPart` (75/25 aggregate), exact legacy part/appearance normalizers, and
`appearanceToCursorShipParams` returning 10 `PartVisual`s. The legacy `parts.ts`,
`appearanceToSpaceshipParams` and `SpaceshipVisualParams` are untouched.

Decisions:
- Mirrored T1 exactly (strict legacy whitelist, catalog/slot-order normalizer output, NaN draw
  → `0`, `rarityWeight` throws on unknown rarity); verified table + normalizer + loot parity
  against `src/backend/src/game/parts-v2.ts` with a runtime deep-equality check.
- `CustomizationState` is imported type-only from `game/types.ts`; the module stays pure and
  import-free at runtime.
- `appearanceToCursorShipParams` normalizes legacy keys/values internally, then falls back to
  each slot's standard part for missing/invalid/mismatched entries; always exactly 10 keys in
  `SLOT_CATALOG` order.
- **Integration-tier exception:** T6 is a pure, additive catalog module with no consumer yet
  (T9/T10/T11/T12 own consumption); there is no integration boundary to exercise, so the
  full existing frontend suite (57 files) is the regression tier. Documented per the skill's
  testing bar.

Evidence:
- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .
  ```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > typecheck
  > tsc --noEmit
  ```
- `npm test --workspace @cubeclicker/frontend` → exit 0:
  ```
  ✓ src/game/parts-v2.test.ts (50 tests) 17ms

   Test Files  57 passed (57)
        Tests  1441 passed (1441)
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0:
  ```
   % Coverage report from v8
  -------------------|---------|----------|---------|---------|-------------------
  File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
  -------------------|---------|----------|---------|---------|-------------------
  All files          |   96.13 |    95.62 |    96.8 |   96.13 |
   src               |   84.16 |     79.5 |    92.1 |   84.16 |
    App.tsx          |   83.33 |    77.39 |    92.3 |   83.33 | ...03,417-419,505
    browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72
   src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |
    api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209
    store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193
   src/game          |   96.45 |    99.72 |   98.88 |   96.45 |
    board.ts         |     100 |      100 |     100 |     100 |
    economy.ts       |     100 |      100 |     100 |     100 |
    effects.ts       |     100 |      100 |     100 |     100 |
    engine.ts        |    99.7 |      100 |     100 |    99.7 | 882-883
    motion.ts        |     100 |      100 |     100 |     100 |
    parts-v2.ts      |     100 |      100 |     100 |     100 |
    parts.ts         |     100 |      100 |     100 |     100 |
    progression.ts   |     100 |      100 |     100 |     100 |
    rotation.ts      |     100 |      100 |     100 |     100 |
    session.ts       |   89.85 |    99.61 |   96.55 |   89.85 | ...1140,1153-1154
    types.ts         |     100 |      100 |     100 |     100 |
    upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
   src/input         |     100 |      100 |     100 |     100 |
    gestures.ts      |     100 |      100 |     100 |     100 |
    keyboard.ts      |     100 |      100 |     100 |     100 |
   src/multiplayer   |   92.47 |    96.05 |   95.71 |   92.47 |
    protocol.ts      |   87.09 |     94.9 |   89.28 |   87.09 | ...94-905,909-919
    server-state.ts  |   98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377
    spectate.ts      |     100 |      100 |     100 |     100 |
    transport.ts     |   97.95 |      100 |     100 |   97.95 | 176-178,196
   src/render        |   99.07 |    97.01 |   98.75 |   99.07 |
    ...round-life.ts |     100 |      100 |     100 |     100 |
    ...c-backdrop.ts |      99 |       96 |     100 |      99 | 299-300
    cube-view.ts     |     100 |      100 |     100 |     100 |
    nebula.ts        |     100 |      100 |     100 |     100 |
    particles.ts     |     100 |      100 |     100 |     100 |
    picking.ts       |     100 |      100 |     100 |     100 |
    ...processing.ts |     100 |      100 |     100 |     100 |
    scene.ts         |   97.48 |    96.17 |   94.73 |   97.48 | ...48-949,973-974
    ship-motion.ts   |     100 |      100 |     100 |     100 |
    ...ship-model.ts |     100 |      100 |     100 |     100 |
    spaceship.ts     |   98.25 |    94.54 |     100 |   98.25 | ...44,360,380,391
    ...ate-travel.ts |     100 |      100 |     100 |     100 |
    starfield.ts     |     100 |      100 |     100 |     100 |
    webgl.ts         |     100 |      100 |     100 |     100 |
    world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442
   src/ui            |   96.45 |    97.26 |   88.67 |   96.45 |
    AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219
    AuthMenu.tsx     |     100 |      100 |     100 |     100 |
    ...ionBanner.tsx |     100 |      100 |     100 |     100 |
    ...ionToggle.tsx |     100 |      100 |     100 |     100 |
    GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26
    Hud.tsx          |     100 |      100 |     100 |     100 |
    ...tionPanel.tsx |   81.17 |    68.75 |      50 |   81.17 | 45-50,52-57,96-99
    ...ipPreview.tsx |   93.75 |      100 |     100 |   93.75 | 18-19
    ...adesPanel.tsx |     100 |      100 |     100 |     100 |
    UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95
    ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37
    VerifyEmail.tsx  |     100 |      100 |     100 |     100 |
    icons.tsx        |     100 |      100 |     100 |     100 |
    theme.ts         |     100 |      100 |     100 |     100 |
   src/ws            |   95.34 |    92.85 |     100 |   95.34 |
    connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
  -------------------|---------|----------|---------|---------|-------------------
  ```
  Thresholds are ≥80 on all four metrics; `parts-v2.ts` is 100/100/100/100.
- Backend T1 ↔ frontend T6 parity check (node type-strip import of both modules):
  ```
  catalog equal: true
  slots equal: true
  ids equal: true
  partmap: true (×4 fixtures)
  appearance: true (×5 fixtures)
  loot 0 hull-obsidian hull-obsidian true
  loot 0.075 hull-gold hull-gold true
  loot 0.5 engine-left-vector engine-left-vector true
  loot 0.999999 tail-fin-comet tail-fin-comet true
  loot 1 tail-fin-comet tail-fin-comet true
  loot NaN hull-obsidian hull-obsidian true
  ```

Acceptance audit:
- AC-7 → met for T6 scope: `appearanceToCursorShipParams` returns exactly 10 `PartVisual`s
  (slot, partId, colour, accent, rarity, shape), legacy-aware and defaulting per slot; the
  spaceship application/idempotence assertions are T9's `Spaceship.applyAppearance` scope.
- AC-10 → met: exports `SlotId`/`SLOT_CATALOG` with the exact 10 slots/names; `isValidSlotId`
  accepts all ten and rejects `wings`, `engine`, `body`, ``, `Hull`; legacy module untouched.
- AC-11 → met: exact 30-row table/ids, 10/10/10 rarity counts, three parts per slot in
  standard→rare→epic order, `PART_CATALOG_VERSION === 2`, `isValidPartId` exactly 30 ids,
  `partDefinition`/`partSlot` throw `unknown part: <id>`, `defaultPartForSlot` returns the
  standard id; table identical to backend T1 (parity check above).
- AC-12 → met for module scope: standard parts are non-lootable and resolve as each slot's
  default in `appearanceToCursorShipParams`; equip acceptance is enforced in T5/T10.
- AC-13 → met: one weighted draw over the 20 lootable parts, weights 3/1 (total 40,
  75%/25%, 7.5%/2.5% per part), rng 0 → `hull-obsidian`, rng 0.999999 and 1 →
  `tail-fin-comet`, one rng call, never a standard part.
- AC-15 → met: `normalizePartMap` expands `body-*`→`hull-*`, `wings-*`→both wings,
  `engine-*`→both ignitions, sums collisions, drops unknown/invalid/overflow counts;
  `normalizeAppearance` maps the AC-33 fixture exactly and drops unknown/mismatched entries.
- AC-16 → met for the frontend normalizer surface: `normalizeCustomizationState` applies both
  normalizers to any restored state and returns defensive copies; repository read wiring is T4.
- AC-28 → met for module scope: frontend legacy normalizer maps legacy values to the new slot
  keys before rendering; server-side legacy equip/ownership is T5.

Deviations from spec: none.
