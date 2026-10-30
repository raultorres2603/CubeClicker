# Build log — T10 (UpgradesPanel UI)

## Files owned
- src/frontend/src/ui/UpgradesPanel.tsx
- src/frontend/src/ui/UpgradesPanel.test.tsx

## Changes
- Added `UpgradesPanel` component rendering one entry per pinned upgrade (name, level/max, effect preview, cost, buy button).
- Buy button is enabled only when `coins >= cost` and `level < maxLevel`; otherwise disabled. Calls `onPurchase(id)` on click when affordable.
- Accepts `upgrades`, `coins`, `mode` (`'guest' | 'account'`), `onPurchase`. Mode is retained for Q-5 gating (approved default "yes", so guests are not locked out).

## Verification
- `npm run lint` — passed (no errors).
- `npm run typecheck` — passed (backend + frontend).
- `npm test --workspace @cubeclicker/frontend` — passed (44 files, 1093 tests; UpgradesPanel 8 tests).
- `npm run coverage --workspace @cubeclicker/frontend` — passed: All files 95.24% stmts, 95.04% branches, 96.65% funcs, 95.24% lines (thresholds 80).

## Notes
- No containerization impact (AC-23): no compose/Dockerfile changes.
- No new dependency introduced.
