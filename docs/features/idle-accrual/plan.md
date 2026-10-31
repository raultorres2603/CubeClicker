---
feature: idle-accrual
revision: 2
---

# Plan — Idle Accrual

## Architecture

### Module ownership

- **DB migration:** `src/backend/src/db/migrations/004_idle_accrual.sql` — adds `last_seen_at TIMESTAMPTZ` to `user_economy` (statement-level timestamp for existing rows), mirrored in `src/backend/src/db/schema.sql`.
- **Backend pure logic:** `src/backend/src/game/economy.ts` (edited) — adds idle constants (`IDLE_COINS_PER_SECOND`, `IDLE_CAP_MS`, `IDLE_MIN_AWAY_MS`) and `idleCoins(elapsedMs, upgrades)` plus `idleMultiplier(upgrades)`. Pure, no I/O. `idleCoins` returns `0` when `elapsedMs < IDLE_MIN_AWAY_MS`. No frontend mirror (frontend never computes idle).
- **Backend persistence:** `src/backend/src/auth/economy-repository.ts` (edited) — `StoredRow` gains `lastSeenAt: number | null`; add `findLastSeenAt(userId)` and `touchLastSeen(userId, nowMs, expectedMs?)` (returns `boolean`) to the interface and both implementations. `credit` carries `lastSeenAt` from the existing row (null for a newly inserted row) and never touches it. `purchaseUpgrade` carries `lastSeenAt`. `credit` is unchanged otherwise (it does not touch `last_seen_at`).
- **Backend integration:** `src/backend/src/game/hub.ts` (edited) — `handleJoin` (async) loads `lastSeenAt`, performs a compare-and-swap touch, credits via `economyRepo.credit` only when the touch succeeds and `idleCoins` yields a positive amount, updates in-memory members, broadcasts `economyUpdate` when credited, and sends `welcome` with post-accrual economy. `handleClose` touches `last_seen_at` on the final active connection for an account (unconditional). `handleRejoin` performs no accrual and never touches. Grace expiry (`removeMember`) does not touch `last_seen_at`.
- **Backend wiring:** `src/backend/src/app.ts` — unchanged (repository already wired). The hub clock and the repository clock both derive from `Date.now()`; tests inject one shared clock (F9).
- **Backend protocol:** unchanged; accrual reuses `welcome.economy` and `economyUpdate`.

### Data flow

1. Account joins → hub awaits `findByUserId` + `findUpgradesByUserId` + `findLastSeenAt` → `touchLastSeen(accountId, now, lastSeenAt)` (compare-and-swap) → if it returns `true`: compute `elapsed = lastSeenAt === null ? 0 : now − lastSeenAt`; if `idleCoins(elapsed, upgrades) > 0`, credit via atomic `credit` → update all in-memory members for that account → broadcast `economyUpdate` → send `welcome` with post-accrual economy. If the touch returns `false` (concurrent join won), skip credit/touch; send `welcome` with loaded totals (the winner's broadcast reconciles). Below threshold → touch (if won) sets `last_seen_at = now`, no credit, send `welcome` with persisted totals.
2. Guest joins → no repository call, no accrual, no touch, no broadcast; `welcome.economy` present with zeros.
3. Final disconnect of an account → touch `last_seen_at = now` (unconditional), only if no other joined connection for that account remains active.
4. Rejoin within grace → no accrual, no touch; member stays in memory; `welcome` reconciles.
5. Grace expiry → remove the member without touching `last_seen_at` (so the away interval includes the grace period).
6. Rejoin after expiry that fails (expired) → `removeMember` without touching.

### State ownership

- **Server (accounts):** `last_seen_at` in `user_economy`, alongside coins/stats/upgrades. Authoritative. In-memory `Member.economy` holds the post-accrual totals for placement.
- **Client:** unchanged adoption via `welcome.economy`/`economyUpdate`; no idle state.

## Interfaces / contracts

### Migration (`004_idle_accrual.sql`)

Existing rows receive one statement-level timestamp (not per-row `now()`), so the migration's duration cannot grant retroactive accrual:

```sql
ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
UPDATE user_economy SET last_seen_at = now() WHERE last_seen_at IS NULL;
ALTER TABLE user_economy ALTER COLUMN last_seen_at SET NOT NULL;
ALTER TABLE user_economy ALTER COLUMN last_seen_at SET DEFAULT now();
```

`schema.sql` mirrors the final column: `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

### Backend economy constants/helpers (`game/economy.ts`, additions)

```ts
export const IDLE_COINS_PER_SECOND = 0.01;
export const IDLE_CAP_MS = 8 * 60 * 60 * 1000;
export const IDLE_MIN_AWAY_MS = 60 * 1000;

export function idleMultiplier(upgrades: UpgradeState): number; // miniCubeMultiplier(upgrades) under default
export function idleCoins(elapsedMs: number, upgrades: UpgradeState): number; // 0 if elapsedMs < IDLE_MIN_AWAY_MS
```

`idleCoins` returns `0` when `elapsedMs < IDLE_MIN_AWAY_MS` (including non-positive); otherwise it clamps elapsed to `IDLE_CAP_MS` and returns `roundCoins(min(elapsedMs, IDLE_CAP_MS) / 1000 * IDLE_COINS_PER_SECOND * idleMultiplier(upgrades))`. The hub's threshold check is therefore redundant-but-harmless.

### Backend repository (`auth/economy-repository.ts`, additions)

```ts
export interface EconomyRepository {
  // existing...
  findLastSeenAt(userId: string): Promise<number | null>; // epoch ms, or null if no row / no timestamp
  touchLastSeen(userId: string, nowMs: number, expectedMs?: number | null): Promise<boolean>;
}
```

- In-memory: `StoredRow` gains `lastSeenAt: number | null`. `findLastSeenAt` returns `row?.lastSeenAt ?? null`. `touchLastSeen`:
  - `expectedMs === undefined`: upsert a row (zero economy/upgrades if absent) with `lastSeenAt = nowMs`; return `true`.
  - `expectedMs` provided: if no row and `expectedMs === null`, insert a row with `lastSeenAt = nowMs` and return `true`; if a row exists and `(row.lastSeenAt ?? null) === expectedMs`, set `lastSeenAt = nowMs` and return `true`; otherwise return `false` (compare-and-swap lost).
  `credit` carries `lastSeenAt` from the existing row and leaves it `null` for a newly inserted row (active play never clobbers the timestamp). `purchaseUpgrade` carries `lastSeenAt`.
- Postgres: `findLastSeenAt` selects `last_seen_at` and converts `TIMESTAMPTZ` to epoch ms (`Date.parse`/`.getTime()`), returning `null` for no row/null. `touchLastSeen`:
  - `expectedMs === undefined`: upsert `last_seen_at = to_timestamp($2 / 1000.0)` (returning the row) → `true`.
  - `expectedMs === null`: `INSERT … ON CONFLICT (user_id) DO NOTHING` with `last_seen_at = to_timestamp($2/1000.0)` → `true` only if a row was inserted.
  - `expectedMs` number: `UPDATE user_economy SET last_seen_at = to_timestamp($2/1000.0), updated_at = now() WHERE user_id = $1 AND last_seen_at = to_timestamp($3/1000.0) RETURNING user_id` → `true` iff a row was updated.
  `credit`'s `ON CONFLICT` does not touch `last_seen_at` (preserving it); a newly inserted row gets the column default `now()`.

### Hub (`game/hub.ts`, additions)

```ts
// in handleJoin, after loading economy + upgrades + lastSeenAt:
const now = deps.now();
let loadedEconomy = ...;
if (isAccount && accountId !== null && economyRepo !== null) {
  const lastSeenAt = await economyRepo.findLastSeenAt(accountId);
  const touched = await economyRepo.touchLastSeen(accountId, now, lastSeenAt);
  if (touched) {
    const elapsed = lastSeenAt === null ? 0 : now - lastSeenAt;
    const coins = idleCoins(elapsed, loadedUpgrades);
    if (coins > 0) {
      loadedEconomy = await economyRepo.credit(accountId, { coins });
    }
    // update in-memory members + broadcast handled below
  }
  if (touched && coins > 0) {
    for (const m of members.values()) {
      if (m.accountId === accountId) m.economy = loadedEconomy;
    }
    broadcastEconomyUpdate(accountId, loadedEconomy);
  }
}
// touch already performed (CAS) above; welcome carries post-accrual economy
```

`handleClose`: after setting `member.connection = null` and if no other connection has a joined member with the same `accountId`, call `void economyRepo?.touchLastSeen(member.accountId, deps.now())` (unconditional; ignore result).

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/db/migrations/004_idle_accrual.sql` | New | `last_seen_at` column (statement-level timestamp) |
| `src/backend/src/db/schema.sql` | Edit | Mirror column |
| `src/backend/src/game/economy.ts` | Edit | Idle constants + helpers |
| `src/backend/src/game/economy.test.ts` | Edit | Idle helper tests |
| `src/backend/src/auth/economy-repository.ts` | Edit | findLastSeenAt, touchLastSeen, carry lastSeenAt |
| `src/backend/src/auth/economy-repository.test.ts` | Edit | Repository tests |
| `src/backend/src/game/hub.ts` | Edit | Accrual on join; touch on disconnect |
| `src/backend/src/game/hub.test.ts` | Edit | Accrual lifecycle tests |
| `src/backend/src/app.test.ts` | Edit | Integration coverage |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Reuse `user_economy` via `last_seen_at` column (migration 004) | Single row per account; no new table/container | Separate `user_idle` table (rejected: over-engineering) |
| 2 | Accrual evaluated on `join` only | `rejoin` inside grace keeps the member in memory; a fresh join after expiry loads from DB | Accrual in `handleRejoin` (rejected: double-count risk) |
| 3 | `last_seen_at` touched on final disconnect | Away interval starts when truly away, not when the session began | Touch on every credit (rejected: resets away timer during active play) |
| 4 | Multi-tab away detection by active connection count | Prevents forfeiting progress when one of several tabs closes | Per-connection timers (open Q-7) |
| 5 | Idle credit reuses atomic `credit` | No new concurrency primitive; consistent with active credits | Dedicated idle table (rejected) |
| 6 | No frontend changes | Accrual arrives through existing `welcome.economy` adoption | New message/toast (open Q-9) |
| 7 | `idleMultiplier` defaults to `miniCubeMultiplier` | Reuses an existing upgrade effect (open Q-4) | Dedicated idle upgrade (rejected for v1) |
| 8 | Idle rate independent of level by default | Level resets on reconnect; idle is baseline automation (open Q-5) | Scale by level (rejected default) |
| 9 | Eligibility via compare-and-swap touch (AC-19) | Prevents concurrent-join double credit without per-account locks | Serialize joins per account; accept bounded risk (rejected) |
| 10 | `idleCoins` returns 0 below threshold | Single testable contract; hub check redundant-but-harmless | Hub-only gating (rejected: ambiguous) |
| 11 | Statement-level migration timestamp | Avoids per-row variation / retroactive accrual | Per-row `now()` (rejected: F10) |

## Risks & mitigations

- **Retroactive accrual on deploy** → `last_seen_at` set to one statement-level `now()` for all existing rows; no accrual on first post-deploy join beyond the threshold.
- **Double credit on concurrent joins** → eligibility gated on a compare-and-swap touch of `last_seen_at` (AC-19); a losing join credits nothing. Tests cover the race.
- **In-memory `lastSeenAt` wipe** → `credit`/`purchaseUpgrade` carry `lastSeenAt` from the existing row; repository test asserts `findLastSeenAt` unchanged after `credit`.
- **Multi-tab false accrual** → active-connection check in `handleClose`; tests pin it.
- **Async join path** → hub tests flush microtasks; `welcome` sent after accrual.
- **Clock alignment** → tests inject one shared clock into `HubDeps.now` and the repository's `now` option; `lastSeenAt` stored/read in the same epoch basis (F9).
- **Coverage regression** → each task owns its test files and runs the workspace coverage pre-gate.
- **No container impact** → migration runner applies `004_idle_accrual.sql` on boot; `podman compose up` unchanged.

## Open questions

See spec.md § Open questions (Q-1..Q-11). Q-1..Q-5 are approval-gated before T2/T4; Q-6..Q-11 are default-with-notice.

## Assumptions

See spec.md § Assumptions.