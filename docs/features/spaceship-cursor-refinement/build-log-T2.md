# Build log — T2 — Update target-position expected vector and scale assertion

Task: T2 (2026-10-27)
Files changed: src/frontend/src/render/spaceship.test.ts

What changed & why: Updated `spaceshipTargetPosition` pinned default-camera expected vector to the refined offset result `(-0.445721, -0.334291, 6.025924)` (AC-2). Updated the NDC-z-independence test's manually computed offset from `0.12` to `0.16` for x (y stays `0.12`). Scale assertion already uses `SPACESHIP_SCALE` dynamically, so it picks up 1.2 without edit. All other assertions unchanged.

Decisions: Smallest coherent change per plan; no production code edits.

Evidence:
- `npm run lint` → exit 0 (no output)
- `npm run typecheck` → exit 0 (both workspaces)
- `npm test --workspace @cubeclicker/frontend` → 862 passed (40 test files)
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0; all workspaces ≥ 80% (frontend 94.97% statements)

Acceptance audit: AC-2 → met (expected vector within 1e-6). AC-3 → met (scale dynamic via SPACESHIP_SCALE === 1.2). AC-4, AC-5, AC-6 → preserved (shot/follow/reduced-motion assertions unchanged and passing).

Deviations from spec: none.