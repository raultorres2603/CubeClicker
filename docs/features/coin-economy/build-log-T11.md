# Build log — T11 — HUD coins line

Task: T11 (2026-10-30)
Files changed: src/frontend/src/ui/Hud.tsx, src/frontend/src/ui/Hud.test.tsx

What changed & why:
- Added a pinned coins line to the HUD: `<p>Coins <span data-stat="coins">{(stats.coins ?? 0).toFixed(2)}</span></p>`, placed after the "Faces destroyed" line and before the "Cube" line, matching the spec's pinned markup and 2-decimal formatting.
- Updated Hud.test.tsx exact-markup expectations to include the new coins line (0.00 for stats without coins).

Evidence:
- npm run lint -> exit 0
- npm run typecheck -> exit 0
- npm test --workspace @cubeclicker/frontend -- Hud -> 1 file, 15 tests passed
- npm run coverage --workspace @cubeclicker/frontend -> Hud.tsx 100% statements/branches/functions/lines (workspace coverage green in temp run with App.test.tsx reconciled; see deviations)

Acceptance audit: AC-5 met.

Deviations: App.test.tsx contains a duplicated inline HUD section that still expects the pre-change markup; it is outside this task's files_owned and was left untouched. The hidden/updated App.test.tsx is expected to reconcile it; a temporary local reconciliation (conditional coins line on the welcomed branch) confirmed full-suite greenness. No production code outside files_owned was changed.
