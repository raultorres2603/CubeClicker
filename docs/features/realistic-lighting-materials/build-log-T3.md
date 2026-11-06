# Build Log — T3 (Scene shadow quality upgrade, AC-2)

Date: 2026-11-06T16:01:46Z

## Verify commands

### `npm run lint`

```

> lint
> eslint .


exit code: 0
```

### `npm run typecheck`

```

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit


exit code: 0
```

### `npm test --workspace @cubeclicker/frontend`

```
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 13ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 15ms
 ✓ src/game/session.test.ts (71 tests) 275ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 256ms
 ✓ src/ui/Hud.test.tsx (15 tests) 177ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 381ms
 ✓ src/App.test.tsx (23 tests) 428ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 823ms

 Test Files  48 passed (48)
      Tests  1223 passed (1223)
   Start at  17:01:52
   Duration  1.93s (transform 4.63s, setup 0ms, collect 13.20s, tests 3.61s, environment 2.83s, prepare 4.01s)


exit code: 0
```

### `npm run coverage --workspace @cubeclicker/frontend`

```
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   81.17 |    68.75 |   33.33 |   81.17 | 45-50,52-57,96-99 
  ...ipPreview.tsx |   71.87 |      100 |     100 |   71.87 | 16-24             
  ...adesPanel.tsx |   91.83 |      100 |      50 |   91.83 | 58-61             
  UserPanel.tsx    |   90.74 |      100 |   66.66 |   90.74 | 66-67,89-91       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------

exit code: 0
```

