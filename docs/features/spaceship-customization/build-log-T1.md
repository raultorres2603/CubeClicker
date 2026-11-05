# Build log — T1 (Backend parts catalog)

Date: 2026-11-05 17:36:41 UTC

## Verify commands

### npm run lint

> lint
> eslint .

exit_code=0

### npm run typecheck --workspace @cubeclicker/backend

> typecheck
> tsc --noEmit

exit_code=0

### npm test --workspace @cubeclicker/backend -- parts

> test
> vitest run parts


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/parts.test.ts (19 tests) 6ms

 Test Files  1 passed (1)
      Tests  19 passed (19)
   Start at  18:36:45
   Duration  262ms (transform 41ms, setup 0ms, collect 41ms, tests 6ms, environment 0ms, prepare 48ms)

exit_code=0

### npm run coverage --workspace @cubeclicker/backend (tail)
 src/auth          |   95.74 |    80.97 |     100 |   95.74 |                   
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354 
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.42 |       85 |     100 |   96.42 | ...05-206,211-212 
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315         
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68             
 src/db            |     100 |      100 |     100 |     100 |                   
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
 src/game          |   95.89 |    94.21 |   99.09 |   95.89 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   92.36 |    89.32 |     100 |   92.36 | ...99-801,805-807 
  parts.ts         |     100 |      100 |     100 |     100 |                   
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   98.29 |    97.43 |      96 |   98.29 | 217-218,386-387   
  servers.ts       |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
-------------------|---------|----------|---------|---------|-------------------
exit_code=0
