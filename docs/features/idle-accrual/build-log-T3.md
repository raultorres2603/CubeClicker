# Build log — T3 — Repository last-seen support

Task: T3 (2026-10-30)
Files changed: src/backend/src/auth/economy-repository.ts, src/backend/src/auth/economy-repository.test.ts
What changed & why: Added `lastSeenAt: number | null` to `StoredRow`; carried it through in-memory `credit` and `purchaseUpgrade`; added `findLastSeenAt` and `touchLastSeen(userId, nowMs, expectedMs?)` to the `EconomyRepository` interface and both in-memory and Postgres implementations (compare-and-swap). Postgres converts via `to_timestamp($2/1000.0)` / `Date` parse. Clock already injected via existing `now` option.
Decisions: In-memory credit leaves `lastSeenAt` null for newly inserted rows; Postgres credit relies on column default `now()` and does not touch `last_seen_at`. Touch with `expectedMs === undefined` is an unconditional upsert.
Evidence:
- `npm run typecheck` → pass (no errors)
- `npm run lint` → pass (no errors)
- `npm run test --workspace=src/backend` → 606 tests passed, 21 files
- `npm run coverage --workspace=src/backend` → All files 94.77% stmts / 85.72% branches / 99.3% funcs / 94.77% lines; economy-repository.ts 97.29% stmts / 91.57% branches / 100% funcs / 97.29% lines
Acceptance audit: AC-1 (column already via T1) → met (migration exists); AC-11 (touch on join via repo) → repo support met; AC-19 (CAS touch) → met (win/lose tests). Deviations from spec: none.