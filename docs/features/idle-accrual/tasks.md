# Tasks — Idle Accrual

Dependency overview: T1 → T2, T3; T2 ∥ T3 (both after T1); T4 after T2+T3; T5 after T4; T6 after T1–T5.

## T1 — Migration & schema for idle accrual `[seq]`
depends_on: —
files_owned: src/backend/src/db/migrations/004_idle_accrual.sql, src/backend/src/db/schema.sql
verify: `npm run typecheck`, `npm run test --workspace=src/backend`
acceptance: AC-1, AC-17
status: [x]
notes: Use the statement-level timestamp approach (F10): add the column nullable, `UPDATE user_economy SET last_seen_at = now() WHERE last_seen_at IS NULL`, then `SET NOT NULL` + `DEFAULT now()`. Mirror the final column in `schema.sql`.

## T2 — Idle constants and helpers `[P]`
depends_on: T1
files_owned: src/backend/src/game/economy.ts, src/backend/src/game/economy.test.ts
verify: `npm run test --workspace=src/backend`, `npm run coverage --workspace=src/backend`
acceptance: AC-3, AC-4, AC-6, AC-7, AC-8
status: [x]
notes: `idleCoins` returns `0` when `elapsedMs < IDLE_MIN_AWAY_MS` (F3); approval-gated constants must not change without approval (F12). Gate before T2/T4 per Q-1..Q-5.

## T3 — Repository last-seen support `[seq]`
depends_on: T1
files_owned: src/backend/src/auth/economy-repository.ts, src/backend/src/auth/economy-repository.test.ts
verify: `npm run test --workspace=src/backend`, `npm run coverage --workspace=src/backend`
acceptance: AC-1, AC-11, AC-19
status: [x]
notes: `StoredRow.lastSeenAt: number | null` (optional on insert); carry it through `credit` and `purchaseUpgrade` (F4). Add `findLastSeenAt` and `touchLastSeen(userId, nowMs, expectedMs?)` returning `boolean` (compare-and-swap; F1/F5). Pg conversion via `to_timestamp($2/1000.0)` / `Date` parse. Tests assert `findLastSeenAt` unchanged after `credit` and CAS win/lose. Inject the shared clock (F9).

## T4 — Hub idle accrual and last-seen lifecycle `[seq]`
depends_on: T2, T3
files_owned: src/backend/src/game/hub.ts, src/backend/src/game/hub.test.ts
verify: `npm run test --workspace=src/backend`, `npm run coverage --workspace=src/backend`
acceptance: AC-2, AC-3, AC-4, AC-5, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-19
status: [x]
notes: Order: `touchLastSeen` (CAS) → `credit` (if eligible) → update in-memory members → broadcast `economyUpdate` → send `welcome` (F11). Touch only on successful join (incl. after grace expiry) and final disconnect; `rejoin` never touches; grace expiry does not touch (F8). Shared clock in `HubDeps.now` and repo `now` (F9). Approval-gated constants (F12).

## T5 — Integration coverage `[seq]`
depends_on: T4
files_owned: src/backend/src/app.test.ts
verify: `npm run test --workspace=src/backend`, `npm run coverage --workspace=src/backend`
acceptance: AC-2, AC-5, AC-16, AC-18
status: [x]
notes: Account join with a stale `last_seen_at` accrues and returns post-accrual totals against an in-memory repo. Inject one shared clock into `HubDeps.now` and the repository's `now` option (F9).

## T6 — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4, T5
files_owned: (none — verification gate only)
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`
acceptance: AC-17, AC-18
status: [x]