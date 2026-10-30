# Build log — T4 — Hub idle accrual and last-seen lifecycle

Task: T4 (2026-10-30)
Files changed: src/backend/src/game/hub.ts, src/backend/src/game/hub.test.ts
What changed & why: Implemented idle accrual on account join (CAS touch → credit if eligible → update in-memory members → broadcast economyUpdate → welcome) and last-seen touch on final disconnect; rejoin and grace expiry do not touch. Added lifecycle tests.
Decisions: Shared clock via HubDeps.now and repo; fire-and-forget disconnect touch; broadcast only when credited.
Evidence:
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `npm run test --workspace=src/backend` → 627 tests passed
- `npm run coverage --workspace=src/backend` → exit 0 (hub.ts 92.36% stmts, 89.26% branches)
Acceptance audit: AC-2,3,4,5,9,10,11,12,13,14,15,19 → met (hub.test.ts idle accrual suite)
Deviations from spec: none