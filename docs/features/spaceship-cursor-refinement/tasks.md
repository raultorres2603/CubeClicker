# Tasks — Spaceship Cursor Refinement

Dependency overview: T1 → T2 → T3

## T1 — Update spaceship scale and left offset constants `[seq]`
depends_on: —
files_owned: src/frontend/src/game/effects.ts, src/frontend/src/game/effects-spaceship.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-1
status: [x]

## T2 — Update target-position expected vector and scale assertion `[seq]`
depends_on: T1
files_owned: src/frontend/src/render/spaceship.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-2, AC-3, AC-4, AC-5, AC-6
status: [x]

## T3 — Verify & integrate `[seq]`
depends_on: T1, T2
files_owned: (none — verification only)
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke` (where environment allows); `git diff -- compose.yaml compose.smoke.yaml src/backend 'src/backend/**' '**/Dockerfile'` must be empty (AC-8)
acceptance: AC-7, AC-8
status: [x]