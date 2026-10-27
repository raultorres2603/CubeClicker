# Build log — T2 — Refresh scene spaceship tests for the new constants

Task: T2 (2026-10-27)
Files changed: src/frontend/src/render/scene-spaceship.test.ts
What changed & why: Updated the follow assertion to use the new pinned delay (240 ms) instead of 120 ms, so the scene-level follow test exercises SPACESHIP_FOLLOW_TAU_MS === 240; other assertions derive offsets/targets at runtime and remain valid.
Decisions: Only the follow test's dt was changed (tau refresh); no production code change. Ignition state stays owned by the spaceship (no new scene-level ignition assertions).
Evidence:
- npm run typecheck --workspace @cubeclicker/frontend -> exit 0
- npm test --workspace @cubeclicker/frontend -> 40 files, 862 tests passed
- npm run coverage --workspace @cubeclicker/frontend -> All files 94.97% stmts, 94.81% branches, 96.39% funcs, 94.97% lines (>=80)
- npm run lint -> exit 0
- npm run coverage -> exit 0 (both workspaces >=80)
- npm run build -> exit 0
Acceptance audit: AC-2 -> met (follow test uses 240 ms and spaceshipFollowFactor(240,false)); AC-7 -> met (shot timing unchanged, midpoint/arrival tests pass); AC-8 -> met (reduced-motion snap test passes).
Deviations from spec: none.
