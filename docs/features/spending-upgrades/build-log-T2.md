# Build log — T2 — Migration + repository upgrades methods

Task: T2 (2026-10-30)
Files changed: src/backend/src/db/migrations/003_upgrades.sql, src/backend/src/db/schema.sql, src/backend/src/auth/economy-repository.ts, src/backend/src/auth/economy-repository.test.ts
What changed & why: Added migration 003 adding `upgrades JSONB NOT NULL DEFAULT '{}'` to `user_economy` and mirrored it in schema.sql. Extended `EconomyRepository` with `findUpgradesByUserId` (defaults to `{}` for no row) and `purchaseUpgrade` (conditional UPDATE only, no insert/upsert, with a level guard, returning `null` on insufficient funds / stale level / no row) in both in-memory and Postgres implementations. Updated in-memory store to track upgrades alongside economy.
Decisions: Stored economy+upgrades together in the in-memory store to keep credit upserts preserving upgrades. Postgres `purchaseUpgrade` interpolates the validated upgrade id into the JSONB key literal and uses a parameterized text[] path for `jsonb_set`. `parseUpgrades` coerces JSONB (object or string) into `UpgradeState`.
Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck` → pass (no output)
- `npm test --workspace @cubeclicker/backend` → 21 test files, 567 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → All files 95.21% stmts / 86.16% branches / 99.63% funcs / 95.21% lines (economy-repository.ts 98.8% / 90.58%)
Acceptance audit: AC-8 (conditional UPDATE, level guard, null on failure) → met (tests + SQL); AC-11 (findUpgrades default {}) → met; AC-23 (no container changes) → met (git diff on container paths empty).
Deviations from spec: none