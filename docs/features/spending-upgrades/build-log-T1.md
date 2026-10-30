# Build log — T1 (Backend upgrades constants + helpers)

## Files changed
- `src/backend/src/game/upgrades.ts` (new)
- `src/backend/src/game/upgrades.test.ts` (new)

## Verification
- `npm run lint` — exit 0
- `npm run typecheck` — exit 0
- `npm test --workspace @cubeclicker/backend` — 21 files, 551 tests passed (upgrades.test.ts 20 tests)
- `npm run coverage --workspace @cubeclicker/backend` — exit 0; upgrades.ts 94.44% stmts / 93.33% branches / 100% funcs / 94.44% lines

## Notes
- Constants approved defaults (Q-1/Q-2/Q-3): catalog mini_cube_value/cube_value/speed_window; base costs 10/50/25; max levels 10/10/5; cost = baseCost*(currentLevel+1); upgradeCost returns Infinity at max.
- Pure module; no I/O.
