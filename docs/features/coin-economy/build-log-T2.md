# Build log — T2 — Economy repository + migration

Task: T2 (2026-10-28)
Files changed:
- src/backend/src/auth/economy-repository.ts
- src/backend/src/auth/economy-repository.test.ts
- src/backend/src/db/migrations/002_economy.sql
- src/backend/src/db/schema.sql
- docs/features/coin-economy/build-log-T2.md

What changed & why: Added `EconomyRepository` interface with `InMemoryEconomyRepository` and `PgEconomyRepository` following `user-repository.ts`; `credit` uses atomic SQL increments (`INSERT ... ON CONFLICT (user_id) DO UPDATE SET ... = user_economy.<col> + EXCLUDED.<col>`), never read-modify-write. Added migration `002_economy.sql` and mirrored `user_economy` table in `schema.sql`.

Decisions:
- `EconomyState` fields: coins, clicks, facesDestroyed, cubesDestroyed.
- In-memory credit rounds coins via `roundCoins` (2 decimals, half-up); Pg relies on NUMERIC(18,2).
- `EconomyDelta = Partial<EconomyState>`; missing fields default to 0.
- No compose/Dockerfile changes (AC-19).

Evidence:
- `npm run lint` → exit 0
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0
- `npm test --workspace @cubeclicker/backend` → exit 0 (518 tests passed incl. 17 new)
- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds met; all files ≥ 80% statements/branches/functions/lines)

Acceptance audit:
- AC-9 → met: credit atomic upsert + face/click deltas (repository layer).
- AC-10 → met: cubesDestroyed delta supported; speed bonus credit is caller's multiplier (hub T3).
- AC-13 → met: repository is DB-only; guest no-persist enforced by callers (hub T3).
- AC-19 → met: only new migration file + schema.sql mirror; no container changes.

Deviations from spec: none.