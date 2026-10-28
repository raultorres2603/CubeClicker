# Tasks — Futuristic HUD Blue

Revision: r2 (addresses spec review r1 F1–F9).

Dependency overview: T1 → T2

## T1 — Futuristic blue technologic HUD CSS + guards `[seq]`
depends_on: —
files_owned: src/frontend/src/ui/app.css, src/frontend/src/ui/app.css.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11
status: [x]

## T2 — Verify & integrate `[seq]`
depends_on: T1
files_owned: (none — verification only)
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'`
acceptance: AC-1, AC-10, AC-12, AC-13
status: [x]