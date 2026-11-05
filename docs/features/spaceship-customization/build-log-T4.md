# Build log — T4 — Hub: grant, open lootbox, equip part, broadcast

Task: T4 (2026-11-05)
Files changed: src/backend/src/game/hub.ts, src/backend/src/game/hub.test.ts
What changed & why: Added server-authoritative customization to the hub: `Member.customization` loaded on account join; `+1` lootbox + `+1` key granted on cube completion with scoped `customizationUpdate` broadcast; `openLootbox` handler consuming a lootbox+key for a random part (lootboxes-first validation); `equipPart` handler validating catalog + ownership then updating appearance; `broadcastCustomizationUpdate` scoped to the owning account's joined connections; `placementFor` carries `customization` for accounts. Guests are no-ops.
Decisions: Mirrored the upgrades pattern (reload from repo on equip via findCustomizationByUserId; update every member with matching accountId before broadcast). RNG for the granted part comes from `deps.random()` (randomPartId). Fire-and-forget grant on completion mirrors the economy credit path.
Evidence:
- `npm run lint` → exit 0 (no output)
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0 (no output)
- `npm test --workspace @cubeclicker/backend -- hub` → 78 tests passed (1 file)
- `npm run coverage --workspace @cubeclicker/backend` → exit 0; All files 94.34% stmts / 85.93% branch / 99.68% funcs / 94.34% lines; src/game/hub.ts 92.21% stmts / 89.6% branch / 100% funcs / 92.21% lines
- AC-18 container paths unchanged: `git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile src/backend/src/server.ts` → exit 0
Acceptance audit:
- AC-1 → met: `handleCompletion` calls `economyRepo.grantCustomization(accountId, { lootboxes: 1, keys: 1 })`, updates every member with that accountId, broadcasts `customizationUpdate` to joined account connections (test "grants lootbox+key on cube completion and broadcasts customizationUpdate to joined account connections").
- AC-2 → met: account completion path grants via server; guest completion is a no-op on the server (guest has no accountId) and the engine handles local grant (engine.test.ts). Hub test "guest completion does not broadcast customizationUpdate".
- AC-3 → met: `handleOpenLootbox` decrements lootbox+key, grants a catalog part, updates members, broadcasts (test "openLootbox success decrements counts and grants a part"; granted id `nose-default` ∈ catalog).
- AC-4 → met: `applyLootboxOpen` discriminated result; lootboxes checked first → `no_lootbox`/`no_key`, no state change (tests "openLootbox with no lootbox sends no_lootbox...", "openLootbox with no key sends no_key...", "openLootbox with zero of both sends no_lootbox first").
- AC-6 → met: `handleEquipPart` validates ownership, sets `appearance[category]=partId`, updates members, broadcasts (tests "equipPart success updates appearance and broadcasts", "equipPart broadcasts to all joined account connections").
- AC-7 → met: unknown part → `unknown_part`; unowned → `not_owned`; no state change (tests "equipPart unknown part sends unknown_part", "equipPart unowned part sends not_owned", "equipPart forged unowned part yields not_owned (authority)").
- AC-10 → met: account join loads `findCustomizationByUserId` into `member.customization` and `welcome` carries `customization` for accounts; guests get undefined (tests "account join loads persisted customization into welcome", "guest join welcome has no customization", "rejoin within grace returns updated customization after open").
- AC-15 → met: `broadcastCustomizationUpdate` filters by `accountSession.userId` and open socket; guests receive nothing (tests "scoped broadcast: guest connection receives nothing on account grant", "openLootbox broadcasts to all joined account connections").
- AC-16 → met: forged `equipPart` for unowned part yields `not_owned`; server validates ownership via repo (test "equipPart forged unowned part yields not_owned (authority)").
Deviations from spec: none.

## Raw verification evidence

### npm run lint

```
> lint
> eslint .

```
exit_code=0

### npm run typecheck --workspace @cubeclicker/backend

```
> typecheck
> tsc --noEmit

```
exit_code=0

### npm test --workspace @cubeclicker/backend -- hub

```
> test
> vitest run hub


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/hub.test.ts (78 tests) 53ms

 Test Files  1 passed (1)
      Tests  78 passed (78)
   Start at 18:48:14
   Duration  417ms (transform 123ms, setup 0ms, collect 144ms, tests 53ms, environment 0ms, prepare 52ms)
```
exit_code=0

### npm run coverage --workspace @cubeclicker/backend

```
> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/game/cubes.test.ts (24 tests) 7ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 3ms
 ✓ src/auth/user-repository.test.ts (40 tests) 16ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 15ms
 ✓ src/game/economy.test.ts (20 tests) 6ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/db/pool.test.ts (10 tests) 7ms
 ✓ src/game/parts.test.ts (19 tests) 10ms
 ✓ src/game/players.test.ts (13 tests) 8ms
 ✓ src/game/servers.test.ts (38 tests) 12ms
 ✓ src/auth/config.test.ts (25 tests) 12ms
 ✓ src/db/migrate.test.ts (10 tests) 13ms
 ✓ src/auth/session-repository.test.ts (35 tests) 16ms
 ✓ src/auth/economy-repository.test.ts (69 tests) 15ms
 ✓ src/auth/email.test.ts (12 tests) 9ms
 ✓ src/game/hub.test.ts (78 tests) 82ms
 ✓ src/game/protocol.test.ts (102 tests) 13ms
 ✓ src/auth/password.test.ts (17 tests) 336ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 625ms
 ✓ src/auth/auth-service.test.ts (50 tests) 883ms
 ✓ src/app.test.ts (20 tests) 1462ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1030ms

 Test Files  22 passed (22)
      Tests  700 passed (700)
   Start at 18:48:15
   Duration  2.21s (transform 1.76s, setup 0ms, collect 4.48s, tests 3.57s, environment 4ms, prepare 2.02s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.34 |    85.93 |   99.68 |   94.34 |
 src               |   80.54 |    84.44 |     100 |   80.54 |
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243
 src/auth          |   94.42 |    80.15 |     100 |   94.42 |
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   90.27 |    79.61 |     100 |   90.27 | ...85-586,642-655
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |     100 |      100 |     100 |     100 |
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   95.66 |    94.02 |   99.13 |   95.66 |
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   92.21 |     89.6 |     100 |   92.21 | ...91-892,895-896
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   98.46 |    97.72 |   96.29 |   98.46 | 224-225,434-435
  servers.ts       |     100 |      100 |     100 |     100 |
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
-------------------|---------|----------|---------|---------|-------------------
```
exit_code=0