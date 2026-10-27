# Build log — T1 — Update spaceship scale and left offset constants

Task: T1 (2026-10-27)
Files changed: src/frontend/src/game/effects.ts, src/frontend/src/game/effects-spaceship.test.ts

What changed & why: Changed `SPACESHIP_SCALE` 1.5 → 1.2 and `SPACESHIP_CURSOR_NDC_OFFSET_X` -0.12 → -0.16 in effects.ts; updated pinned assertions in effects-spaceship.test.ts to the new values. All other constants untouched.

Decisions: Smallest coherent change per plan D-1/D-2; no geometry or logic edits.

Evidence:
- `npm run lint` → exit 0 (no output)
- `npm run typecheck` → exit 0 (both workspaces)
- `npm test --workspace @cubeclicker/frontend` → 860 passed, 2 failed in src/render/spaceship.test.ts (out-of-scope file owned by T2; stale expected values for the old offset). T1-owned effects-spaceship.test.ts: 5 passed.
- `npm run coverage --workspace @cubeclicker/frontend` → failed only due to the same 2 out-of-scope spaceship.test.ts failures; T1-owned code paths unchanged in coverage terms.

Acceptance audit: AC-1 → met (effects-spaceship.test.ts asserts SPACESHIP_SCALE === 1.2, SPACESHIP_CURSOR_NDC_OFFSET_X === -0.16, and unchanged constants).

Deviations from spec: none. The two spaceship.test.ts failures are expected and will be resolved by T2 (files_owned for T2: src/frontend/src/render/spaceship.test.ts).