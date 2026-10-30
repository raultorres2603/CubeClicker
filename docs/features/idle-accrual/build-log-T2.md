# Build log — T2 (Idle constants and helpers)

## Changed files
- `src/backend/src/game/economy.ts` — added idle constants `IDLE_COINS_PER_SECOND`, `IDLE_CAP_MS`, `IDLE_MIN_AWAY_MS`, `idleMultiplier`, `idleCoins`.
- `src/backend/src/game/economy.test.ts` — added tests for idle constants, `idleMultiplier`, `idleCoins` (threshold, cap, rounding, upgrades, level independence).

## Verification evidence
- `npm run test --workspace=src/backend`: 21 test files, 617 tests passed.
- `npm run typecheck`: tsc --noEmit clean (backend + frontend).
- `npm run lint`: clean.
- `npm run coverage --workspace=src/backend`: economy.ts 100% statements/branches/functions/lines; workspace totals ≥ 80%.

## Notes
- Constants use approved defaults: 0.01 / 8h / 1min; `idleMultiplier` delegates to `miniCubeMultiplier`.
- `idleCoins` returns 0 when `elapsedMs < IDLE_MIN_AWAY_MS` (including non-positive).