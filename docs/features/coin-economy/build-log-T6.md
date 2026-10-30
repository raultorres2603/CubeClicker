# Build log — T6 — Frontend types + progression

Task: T6 (2026-10-30)
Files changed: src/frontend/src/game/types.ts, src/frontend/src/game/progression.ts, src/frontend/src/game/progression.test.ts, docs/features/coin-economy/build-log-T6.md
What changed & why: Extended `GameStats` with optional `cubesDestroyed` and `coins` (default 0 at read sites) and added the mirrored `EconomyState` type. `createProgression(initialStats?)` now seeds clicks/facesDestroyed/cubesDestroyed/coins (omitting optional fields when not supplied so existing literals stay valid). Added `recordCoins(p, amount)` (2-decimal half-up rounding) and `recordCubeDestroyed(p)` helpers. Updated progression tests with concrete expected values.
Decisions: `initialStats` typed as `Partial<GameStats> | EconomyState` so both shapes seed. Optional fields omitted unless explicitly supplied (including an explicit 0). `recordCoins` rounds half-up to 2 decimals for float-drift safety. Existing recordClick/recordFaceDestroyed spread stats, so optional fields are preserved.
Evidence:
- `npm run lint` → exit 0 (no output)
- `npm run typecheck` → exit 0 (backend + frontend tsc --noEmit)
- `npm run test --workspace @cubeclicker/frontend` → 41 files / 997 tests passed
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0; All files 95.07% stmts / 94.88% branch / 96.48% funcs / 95.07% lines
Acceptance audit: AC-1 → met (recordCoins helper + progression tests); AC-5 → met (GameStats.coins feeds HUD later); AC-6 → met (createProgression seeds stats from initial values); AC-8 → met (recordCubeDestroyed); AC-21 → met (helpers are account/guest agnostic).
Deviations from spec: none