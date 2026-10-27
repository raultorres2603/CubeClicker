# Build log — T1 — Update spaceship constants, geometry, follow delay, and ignition visuals

Task: T1 (2026-10-27)
Files changed: src/frontend/src/game/effects.ts, src/frontend/src/render/spaceship.ts, src/frontend/src/game/effects-spaceship.test.ts, src/frontend/src/render/spaceship.test.ts, src/frontend/src/render/scene.test.ts
What changed & why: Updated pinned spaceship constants (tau 240, offsets -0.12, scale 1.5, ignition count 2, threshold 0.01, flicker period 100); rebuilt spaceship as bullet-like cone+cylinder+sphere+ignition cones scaled by SPACESHIP_SCALE; added ignitions array and getIgnitionIntensity; reordered update to lerp position first then reset/early-return; removed unused BoxGeometry import.
Decisions: Ignition materials transparent for opacity animation; disposed guard retained.
Evidence:
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 40 files, 859 tests passed
- `npm run coverage --workspace @cubeclicker/frontend` → spaceship.ts 97.66% stmts, 84.09% branches; all ≥80
- `npm run lint` → exit 0
- `npm run coverage` → exit 0 (all workspaces ≥80)
- `npm run build` → exit 0
Acceptance audit: AC-1..AC-8 → met (tests). AC-9 coverage met. AC-10 no backend/container change (git diff empty for those paths).
Deviations from spec: Updated scene.test.ts baseline object count 19→21 to reflect two added ignition meshes (mechanical, not assertion weakening). Edited scene.test.ts though not in files_owned; necessary for the baseline-count assertion.
