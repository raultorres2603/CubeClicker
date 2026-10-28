# Build log — T4 — Backend protocol economy fields + codec
Task: T4 (2026-10-28)
Files changed: src/backend/src/game/protocol.ts, src/backend/src/game/protocol.test.ts
What changed & why: Added `EconomyState` interface and `economy?` field on `Placement`; added `economyUpdate` variant to `ServerMessage`; `placementPayload` defensively copies `economy` when present; added `economyUpdateMessage` builder (EconomyState/object or positional numbers); updated tests with concrete economy payloads.
Decisions: `Placement.economy` kept optional so `hub.ts` (T3-owned) still typechecks until T3 populates it; `placementPayload` conditionally includes economy to avoid breaking pre-T3 callers/tests.
Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0
- `npm test --workspace @cubeclicker/backend` → 20 files, 521 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (all files 94.87% stmts, 84.35% branches, 99.62% funcs, 94.87% lines; protocol.ts 95.81/95.52)
Acceptance audit: AC-14 → met (economy field on Placement, copied in placementPayload); AC-15 → met (economyUpdate server message + builder; codec type present)
Deviations from spec: none
