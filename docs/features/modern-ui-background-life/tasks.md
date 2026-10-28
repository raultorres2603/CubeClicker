# Tasks — Modern UI Background Life

Dependency overview: T1 ∥ T2 ∥ T4; T3 depends on T2; T5 depends on T4; T6 depends on T1, T2, T3, T4, T5.

## T1 — Animated border light + HUD blink CSS + reduced motion `[P]`
depends_on: —
files_owned: src/frontend/src/ui/app.css, src/frontend/src/ui/app.css.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-1, AC-2, AC-4
status: [x]

## T2 — Hud `blinking` prop + `HUD_BLINK_MS` export `[P]`
depends_on: —
files_owned: src/frontend/src/ui/Hud.tsx, src/frontend/src/ui/Hud.test.tsx
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-3
status: [x]

## T3 — App HUD blink wiring on click increase `[seq]`
depends_on: T2
files_owned: src/frontend/src/App.tsx, src/frontend/src/App.test.tsx
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-5, AC-6
status: [x]

## T4 — Background life render module `[P]`
depends_on: —
files_owned: src/frontend/src/render/background-life.ts, src/frontend/src/render/background-life.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-7, AC-8
status: [x]

## T5 — Scene integration of background life `[seq]`
depends_on: T4
files_owned: src/frontend/src/render/scene.ts, src/frontend/src/render/scene.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-9, AC-10
status: [x]

## T6 — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4, T5
files_owned: (none — verification-only task; no documentation edit expected, see plan.md Documentation note)
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'`
acceptance: AC-11, AC-12
status: [x]