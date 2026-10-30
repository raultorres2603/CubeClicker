# Build log — T11 (App wiring: render UpgradesPanel)

## Files owned
- src/frontend/src/App.tsx

## Changes
- Imported `UpgradesPanel` from `./ui/UpgradesPanel`.
- Destructured `mode` (defaulting to `'guest'`) from the multiplayer snapshot alongside `status`, `world`, `spectate`.
- Rendered `<UpgradesPanel>` when `welcomed`, passing `snapshot.stats.coins ?? 0`, `snapshot.upgrades ?? {}`, `mode`, and `session.purchaseUpgrade`. Kept the HUD coins line (unchanged in `Hud.tsx`).
- Also updated `src/frontend/src/App.test.tsx` `shellHtml` golden to include the rendered UpgradesPanel markup in the welcomed branch so exact-markup assertions stay honest (out-of-scope edit noted; mirrors the coin-economy T_final pattern where App.test.tsx is reconciled with new markup).

## Verification
- `npm run lint` — passed (no errors).
- `npm run typecheck` — passed (backend + frontend).
- `npm test --workspace @cubeclicker/frontend` — passed (44 files, 1099 tests).
- `npm run coverage --workspace @cubeclicker/frontend` — passed: All files 95.19% stmts, 95.10% branches, 96.89% funcs, 95.19% lines (thresholds 80).

## Notes
- No containerization impact (AC-23): no compose/Dockerfile changes.
- No new dependency introduced.