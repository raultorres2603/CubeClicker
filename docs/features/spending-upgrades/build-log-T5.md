# Build log — T5 — Backend integration tests

Task: T5 (2026-10-30)
Files changed: src/backend/src/app.test.ts

What changed & why: Extended `app.test.ts` with a `spending upgrades integration (T5)` describe block: account join with a seeded upgrades repo returns persisted levels in `welcome.upgrades`; an account `purchaseUpgrade` debits coins and broadcasts `economyUpdate` + `upgradesUpdate` (with persisted repo state); an insufficient-funds purchase sends `error insufficient_funds` and persists nothing; a guest purchase sends no message and performs no DB write.

Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck` → exit 0 (both workspaces)
- `npm test --workspace @cubeclicker/backend` → 21 test files, 584 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (All files 94.83% stmts / 85.99% branches / 99.29% funcs / 94.83% lines; all files ≥ 80%)

Acceptance audit: AC-9, AC-11, AC-23 → met.