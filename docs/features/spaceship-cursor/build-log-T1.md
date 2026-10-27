# Build log — T1 — Add spaceship/shot constants and pure follow/target/shot math

Task: T1 (2026-10-27)
Files changed: src/frontend/src/game/effects.ts, src/frontend/src/render/spaceship.ts, src/frontend/src/game/effects-spaceship.test.ts, src/frontend/src/render/spaceship.test.ts
What changed & why: Added pinned spaceship/shot constants to effects.ts and created spaceship.ts with pure follow/target helpers plus the spaceship/shot manager.
Decisions: Implemented createSpaceship with group named 'spaceship', shotsGroup, and Shot list; updateShots disposes completed shot meshes.

Evidence:
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 832 passed, 0 failed
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds met)
- `npm run lint` → exit 0
- `npm run build` → success

Acceptance audit: AC-2 → met (spaceshipFollowFactor + tests); AC-3 → met (spaceshipTargetPosition matches pinned vector within 1e-6)
Deviations from spec: none