# Build log — T1 — Backend v2 catalog module (additive)

Task: T1 (2026-11-08)
Files changed: `src/backend/src/game/parts-v2.ts`, `src/backend/src/game/parts-v2.test.ts`, `docs/features/spaceship-cursor-loot-animations/build-log-T1.md`
What changed & why: Added the additive v2 catalog (10 slots, 30 parts), version marker, validation helpers, 20-part weighted loot selection, and legacy inventory/appearance normalizers. Legacy `parts.ts`/tests untouched so existing backend consumers stay green.
Decisions:
- Catalog and slot order are pinned to spec r4; `PART_IDS_V2` is table order; `partsForSlot` filters table order (standard→rare→epic).
- `partDefinition` is exported in addition to the T1 function list because AC-11 pins its `unknown part: <id>` behavior.
- `selectLootPart` draws exactly once, clamps into `[0, 1]`, walks rare(3)/epic(1) weights (total 40) and falls back to the last part for a `1` draw.
- Normalizers emit canonical catalog/slot order, sum legacy→v2 collisions, accept counts `0..2147483647` integer (mirrors migration 006 bounds), and drop unknown ids/keys, non-integer/negative/overflow counts, and slot/part mismatches. Canonical slot keys take precedence over legacy aliases.
- `CustomizationState` is defined structurally in `parts-v2.ts` so the pure module has no protocol/repository import; it is assignable to the existing protocol/repository shape.
- Integration tier: no integration boundary exists in T1 — the additive module is not yet imported by any production consumer (T4/T5/T10 wire it). Full backend suite remains green; documented exception per the web-implementation skill.

Acceptance audit:
- AC-10 → met: `SlotId`, `SLOT_CATALOG` (10 exact slots/names), `isValidSlotId` accepted/rejected matrix, legacy module untouched (`git diff` empty), full backend suite green.
- AC-11 → met: 30-row `PART_CATALOG_V2` pinned exactly against the spec table; 10/10/10 rarity counts; 3 per slot; `PART_CATALOG_VERSION === 2`; `PART_IDS_V2` order; `isValidPartId` accepts exactly 30; `partDefinition`/`partSlot` throw `unknown part: <id>`; `partsForSlot` order and `defaultPartForSlot` pinned.
- AC-12 (module scope) → met: every slot resolves its standard part via `defaultPartForSlot`; standard parts carry weight 0 and are excluded from `selectLootPart`, so they can never be granted. Consumer equip enforcement lands in T5/T10 as specified.
- AC-13 → met: one rng draw (asserted with a draw counter), 20 lootable parts, weights 3/1, total 40, 10 rare/10 epic; 40-midpoint sweep pins 3/40 per rare and 1/40 per epic (75 %/25 % aggregate); `hull-obsidian` at 0, `tail-fin-comet` at 0.999999 and 1; no standard returned.

Evidence (raw):

```
$ npm run lint
> lint
> eslint .
```
(exit 0, no findings)

```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit
```
(exit 0, no diagnostics)

```
$ npm test --workspace @cubeclicker/backend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 10ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 8ms
 ✓ src/game/upgrades.test.ts (20 tests) 13ms
 ✓ src/game/parts.test.ts (19 tests) 10ms
 ✓ src/auth/config.test.ts (25 tests) 8ms
 ✓ src/game/servers.test.ts (38 tests) 9ms
 ✓ src/db/pool.test.ts (10 tests) 7ms
 ✓ src/game/economy.test.ts (20 tests) 7ms
 ✓ src/auth/user-repository.test.ts (40 tests) 16ms
 ✓ src/db/migrate.test.ts (10 tests) 13ms
 ✓ src/game/cubes.test.ts (24 tests) 9ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 21ms
 ✓ src/auth/session-repository.test.ts (35 tests) 18ms
 ✓ src/game/parts-v2.test.ts (40 tests) 21ms
 ✓ src/game/players.test.ts (13 tests) 13ms
 ✓ src/auth/email.test.ts (12 tests) 7ms
 ✓ src/auth/economy-repository.test.ts (69 tests) 16ms
 ✓ src/game/hub.test.ts (78 tests) 92ms
 ✓ src/game/protocol.test.ts (102 tests) 12ms
 ✓ src/auth/password.test.ts (17 tests) 243ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 713ms
 ✓ src/auth/auth-service.test.ts (50 tests) 946ms
 ✓ src/app.test.ts (20 tests) 1477ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1019ms

 Test Files  23 passed (23)
      Tests  740 passed (740)
```

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/auth/rate-limit.test.ts (16 tests) 5ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/game/cubes.test.ts (24 tests) 13ms
 ✓ src/game/economy.test.ts (20 tests) 4ms
 ✓ src/db/pool.test.ts (10 tests) 5ms
 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/game/parts.test.ts (19 tests) 11ms
 ✓ src/auth/user-repository.test.ts (40 tests) 12ms
 ✓ src/auth/session-repository.test.ts (35 tests) 17ms
 ✓ src/game/parts-v2.test.ts (40 tests) 21ms
 ✓ src/auth/economy-repository.test.ts (69 tests) 15ms
 ✓ src/db/migrate.test.ts (10 tests) 13ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 15ms
 ✓ src/game/servers.test.ts (38 tests) 9ms
 ✓ src/auth/config.test.ts (25 tests) 13ms
 ✓ src/game/players.test.ts (13 tests) 14ms
 ✓ src/auth/email.test.ts (12 tests) 15ms
 ✓ src/game/hub.test.ts (78 tests) 95ms
 ✓ src/game/protocol.test.ts (102 tests) 12ms
 ✓ src/auth/password.test.ts (17 tests) 332ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 673ms
 ✓ src/auth/auth-service.test.ts (50 tests) 858ms
 ✓ src/app.test.ts (20 tests) 1486ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1031ms

 Test Files  23 passed (23)
      Tests  740 passed (740)
   Start at  18:55:32
   Duration  2.35s (transform 2.12s, setup 0ms, collect 5.43s, tests 3.65s, environment 4ms, prepare 2.18s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.63 |    86.63 |   99.69 |   94.63 |
 src               |   80.54 |    84.44 |     100 |   80.54 |
  app.ts           |   80.54 |    84.44 |     100 |   80.54 |
 src/auth          |   94.42 |    80.15 |     100 |   94.42 |
  auth-routes.ts   |      80 |    47.54 |     100 |      80 |
  auth-service.ts  |     100 |    80.53 |     100 |     100 |
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   90.27 |    79.61 |     100 |   90.27 |
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 |
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 |
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 |
 src/db            |     100 |      100 |     100 |     100 |
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   96.21 |    94.77 |   99.22 |   96.21 |
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   92.21 |     89.6 |     100 |   92.21 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   98.46 |    97.72 |   96.29 |   98.46 |
  servers.ts       |     100 |      100 |     100 |     100 |
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 |
-------------------|---------|----------|---------|---------|-------------------
```
(coverage gate ≥ 80 statements/branches/functions/lines: green; new `parts-v2.ts` 100 % on all four metrics)

Additional focused run before the full suite:

```
$ npx vitest run src/game/parts-v2.test.ts --coverage.enabled=false
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/parts-v2.test.ts (40 tests) 11ms

 Test Files  1 passed (1)
      Tests  40 passed (40)
```

Deviations from spec: none.
