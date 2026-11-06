# Tasks — Realistic Lighting & Materials

Dependency overview: T1 → (T2 ∥ T3 ∥ T4) → T5

Documentation impact: frontend-only visual change; no README/architecture/container changes required. The orchestrator updates the `docs/features/README.md` row on acceptance (orchestrator-owned).

## T1 — Post-processing pipeline module `[seq]`
depends_on: —
files_owned: src/frontend/src/render/postprocessing.ts, src/frontend/src/render/postprocessing.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-4, AC-5
status: [x]

## T2 — Renderer tone mapping, soft shadows, and realistic renderer wiring `[seq]`
depends_on: T1
files_owned: src/frontend/src/render/webgl.ts, src/frontend/src/render/webgl.test.ts, src/frontend/src/browser-env.ts, src/frontend/src/browser-env.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-1, AC-6
status: [>]

## T3 — Scene shadow quality upgrade `[P]`
depends_on: T1
files_owned: src/frontend/src/render/scene.ts, src/frontend/src/render/scene.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-2
status: [>]

## T4 — PBR material upgrade (cube + spaceship) `[P]`
depends_on: T1
files_owned: src/frontend/src/render/cube-view.ts, src/frontend/src/render/cube-view.test.ts, src/frontend/src/render/spaceship.ts, src/frontend/src/render/spaceship.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-3
status: [>]

## T6 — Fix AC-3 test evidence + scene cast cleanup `[seq]`
depends_on: T4
files_owned: src/frontend/src/render/cube-view.test.ts, src/frontend/src/render/spaceship.test.ts, src/frontend/src/render/scene.ts, src/frontend/src/render/scene.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-3, AC-2
status: [x]