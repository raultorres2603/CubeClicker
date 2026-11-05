# Build log — T9 — Spaceship render parameterized by appearance + scene apply

Task: T9 (2026-11-05)
Files changed: src/frontend/src/render/spaceship.ts, src/frontend/src/render/spaceship.test.ts, src/frontend/src/render/scene.ts, src/frontend/src/render/scene-spaceship.test.ts
What changed & why: `createSpaceship` now accepts appearance params (record or color params) and applies derived colors to materials; `SceneView.applySnapshot` re-applies appearance when `snapshot.customization.appearance` changes and retains a shallow copy (`lastAppearance`/aliases). Tests added for material colors and scene re-apply.
Decisions: Material update in place (no spaceship recreation) to preserve in-flight shots; appearance normalized from either category->partId record or direct color params.

Evidence:
- `npm run lint` → exit 0
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0
- `npm test --workspace @cubeclicker/frontend -- spaceship` → Test Files 4 passed, Tests 58 passed
- `npm run coverage --workspace @cubeclicker/frontend` → Test Files 45 passed, Tests 1166 passed; All files 95.27% stmts, 95.08% branches, 96.61% funcs, 95.27% lines

Acceptance audit: AC-13 → met (appearance params applied to materials, default + equipped); AC-14 → met (SceneView re-applies appearance on snapshot change, retains last applied appearance).
Deviations from spec: none