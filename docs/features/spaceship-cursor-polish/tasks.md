# Tasks — Spaceship Cursor Polish

Dependency overview: T1 → T2 → T3

Note (review r1 F7): T1 bundles constants + geometry + ignitions + tests in one session (sizing risk); may be split if it exceeds one session. T1's ignition reset/no-movement semantics and exact flicker formula are pinned in plan.md (revision r2).
Note (review r2 F1/F2): T1 must implement the reordered ignition block — position lerp (factor = spaceshipFollowFactor) runs first on every pointer path (including reduced motion and dtMs === 0), then the ignition reset and early-return (F1); and must remove the now-unused `BoxGeometry` import from `spaceship.ts` (and any other import made unused by the geometry change) so `npm run lint` stays green (F2). Plan pinned in plan.md (revision r3).

## T1 — Update spaceship constants, geometry, follow delay, and ignition visuals `[seq]`
depends_on: —
files_owned: src/frontend/src/game/effects.ts, src/frontend/src/render/spaceship.ts, src/frontend/src/game/effects-spaceship.test.ts, src/frontend/src/render/spaceship.test.ts
verify: `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
status: [x]

## T2 — Refresh scene spaceship tests for the new constants `[seq]`
depends_on: T1
files_owned: src/frontend/src/render/scene-spaceship.test.ts
verify: `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-2, AC-7, AC-8
status: [x]

## T3 — Verify & integrate `[seq]`
depends_on: T1, T2
files_owned: (none)
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`
acceptance: AC-9, AC-10
status: [x]