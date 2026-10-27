# Tasks — Spaceship Cursor

Dependency overview: T1 → T2 → T3 → T4

## T1 — Add spaceship/shot constants and pure follow/target/shot math `[seq]`
depends_on: —
files_owned: src/frontend/src/game/effects.ts, src/frontend/src/render/spaceship.ts, src/frontend/src/game/effects-spaceship.test.ts, src/frontend/src/render/spaceship.test.ts
verify: `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-2, AC-3
status: [x]

## T2 — Integrate spaceship, pointer target, and deferred shots into the scene `[seq]`
depends_on: T1
files_owned: src/frontend/src/render/scene.ts, src/frontend/src/render/scene-spaceship.test.ts
verify: `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-1, AC-4, AC-5, AC-6, AC-8
status: [x]

## T3 — Track pointer movement in the session and expose setPointerTarget `[seq]`
depends_on: T2
files_owned: src/frontend/src/game/session.ts, src/frontend/src/game/session-spaceship.test.ts
verify: `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-7
status: [x]

## T4 — Verify & integrate `[seq]`
depends_on: T1, T2, T3
files_owned: (none)
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`
acceptance: AC-9, AC-10
status: [x]