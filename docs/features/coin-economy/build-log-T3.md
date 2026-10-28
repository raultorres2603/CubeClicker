# Build log — T3 — Hub integration (credit + speed bonus + broadcast)
Task: T3 (2026-10-28)
Files changed: src/backend/src/game/hub.ts, src/backend/src/game/hub.test.ts
What changed & why: Added `economy?: EconomyRepository | null` to `HubDeps`; `Member` gains `cubeStartedAtMs` and `economy`. `handleJoin` is now async, awaiting `findByUserId` for accounts before creating the member/sending `welcome`, seeding `member.economy` (zeros for guests/absent). `placementFor` includes `economy`. `handleExplode` detects face clear and fire-and-forget credits mini-cube coins + click (+facesDestroyed on clear), updating all account members' economy and broadcasting `economyUpdate` to joined account connections. `handleCompletion` computes speed bonus from server clock (previous cube gridSize) before reset, credits cube coins (×2 if fast) + cubesDestroyed, resets `cubeStartedAtMs`, and broadcasts `economyUpdate`. Guests perform no repo call/broadcast. Added account-economy tests.
Decisions: `broadcastEconomyUpdate` iterates all connections filtered by matching verified accountSession.userId and playerId !== null, including origin. Multi-member account economy updated to the repo's returned total. Fire-and-forget credits; tests flush microtasks.
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/backend` → 20 files, 528 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (all files 95.12% stmts, 85% branches, 99.62% funcs, 95.12% lines; hub.ts 93.29/90.85)
Acceptance audit: AC-9 → met (credit on valid explode, face clear increments facesDestroyed, no credit on invalid); AC-10 → met (completion credit with speed bonus from server clock); AC-12 → met (server clock only); AC-13 → met (guest no persist/broadcast); AC-15 → met (economyUpdate codec/builder used); AC-17 → met (broadcast to all joined account connections incl origin); AC-18 → met (rejoin returns member.economy in welcome)
Deviations from spec: none