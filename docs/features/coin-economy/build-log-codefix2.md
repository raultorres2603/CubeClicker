# Build log — codefix (review r1 F1–F4)

Task: code review r1 follow-up (2026-10-30)
Files changed:
- src/frontend/src/game/engine.test.ts
- src/backend/src/game/hub.test.ts
- docs/features/coin-economy/status.md

What changed & why:
- F1: Added direct `engine.test.ts` cases for per-mini reward, per-cube reward with/without speed bonus, threshold boundary (grid 3 and grid 7), guest earning path, and `adoptEconomy` absolute adoption.
- F2: Restored `coins`/`cubesDestroyed` paired assertions on all 38 stats-touching engine tests (concrete expected values, including undefined where optional fields are absent).
- F3: Replaced 5 weak `expect(...).toBeDefined()` guards in `hub.test.ts` with concrete `.type` assertions (`'stateSync'`, `'memberJoined'`, `'economyUpdate'`).
- F4: Updated status.md Blockers/open questions to note Q-1..Q-5 resolved with approved defaults.

Evidence:
- `npm run lint` → exit 0 (no errors)
- `npm run typecheck` → exit 0 (both workspaces)
- `npm test` → backend 531 passed, frontend 1037 passed
- `npm run coverage` → exit 0 (backend 95.17/85.82/99.62/95.17; frontend thresholds met)
- `npm run build` → exit 0

Acceptance audit: AC-1,AC-2,AC-3,AC-4,AC-6,AC-8,AC-21 strengthened via direct engine tests; AC-9/AC-10 hub guards made concrete; doc status reconciled. Deviations from spec: none.
