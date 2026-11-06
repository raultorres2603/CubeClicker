## T2 verify evidence

### npm run lint

> lint
> eslint .

EXIT: 0

### npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT: 0

### npm test --workspace @cubeclicker/frontend
 ✓ src/App.test.tsx (23 tests) 410ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 817ms

 Test Files  48 passed (48)
      Tests  1219 passed (1219)
   Start at  16:59:49
   Duration  1.79s (transform 5.19s, setup 0ms, collect 12.84s, tests 3.40s, environment 2.38s, prepare 3.65s)

EXIT: 0

### npm run coverage --workspace @cubeclicker/frontend
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
EXIT: 0

### npm run coverage (full)
 ✓ src/ui/theme.test.ts (7 tests) 7ms
 ✓ src/game/session.test.ts (71 tests) 307ms
 ✓ src/ui/Hud.test.tsx (15 tests) 228ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 295ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 423ms
 ✓ src/App.test.tsx (23 tests) 508ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 952ms
All files          |   94.97 |    94.94 |   95.75 |   94.97 |                   
EXIT: 0

### npm run build
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.34s
EXIT: 0

### AC-8 container/backend diff gate
git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'
EXIT: 0
