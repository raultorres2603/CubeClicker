---
feature: coin-economy
revision: 2
---

# Plan — Coin Economy & Persistent In-Game Stats

## Architecture

### Module ownership

- **Backend pure logic:** `src/backend/src/game/economy.ts` — pinned constants (`COINS_PER_MINI_CUBE`, `COINS_PER_CUBE`, `SPEED_BONUS_MULTIPLIER`, `thresholdSeconds(gridSize)`), rounding helper, speed-bonus decision helper. Pure, no I/O. Mirrored (values only) by a frontend module.
- **Backend persistence:** `src/backend/src/auth/economy-repository.ts` — `EconomyRepository` interface + `InMemoryEconomyRepository` + `PgEconomyRepository`, following the `user-repository.ts` pattern (parameterized SQL, `UserDb`-style injected pool, optional clock). New migration `src/backend/src/db/migrations/002_economy.sql`.
- **Backend integration:** `src/backend/src/game/hub.ts` — `Member` gains `cubeStartedAtMs` and `economy: EconomyState`; `handleJoin` is async and awaits `findByUserId` before creating the member/sending `welcome`; `handleExplode` credits mini-cube coins + clicks + `facesDestroyed` (on face clear) for accounts; `handleCompletion` computes the speed bonus from server clock, credits coins, increments `cubesDestroyed`; broadcasts `economyUpdate` to all joined connections of the account (including origin); `placementFor` includes `economy` from `member.economy`.
- **Backend wiring:** `src/backend/src/app.ts` — construct `InMemoryEconomyRepository`/`PgEconomyRepository` (based on pool) and pass to `createGameHub` via `HubDeps.economy`.
- **Backend protocol:** `src/backend/src/game/protocol.ts` — `EconomyState` type, `economy` field on `Placement`, `economyUpdate` server message, codec validation.
- **Frontend types:** `src/frontend/src/game/types.ts` — extend `GameStats` with optional `cubesDestroyed` and `coins` (default 0 at read sites); add `EconomyState`.
- **Frontend progression:** `src/frontend/src/game/progression.ts` — `coins`/`cubesDestroyed` in stats; `createProgression(initial?)`; `recordCoins`, `recordCubeDestroyed` helpers (or fold into engine).
- **Frontend engine:** `src/frontend/src/game/engine.ts` — track `cubeElapsedMs` (reset on level advance, incremented in `advancePlaying`); award coins on explode/completion with speed bonus; `adoptEconomy` (optional seam); extend `AuthoritativeCubeState`? economy separate; add method `adoptEconomy`.
- **Frontend protocol:** `src/frontend/src/multiplayer/protocol.ts` — mirror.
- **Frontend reducer:** `src/frontend/src/multiplayer/server-state.ts` — `SelfState.economy`, `PendingWorldSwap.economy`, `WorldState` (self carries it), handle `welcome`/`worldEntered`/`economyUpdate`.
- **Frontend session:** `src/frontend/src/game/session.ts` — adopt economy on welcome/worldEntered/economyUpdate; forward to engine.
- **Frontend UI:** `src/frontend/src/ui/Hud.tsx` — coins line.

### Data flow

1. Account joins → hub awaits `findByUserId` → loads persisted economy into `Member.economy` → `welcome` carries `economy` → session adopts into engine → HUD shows persisted totals.
2. Explode (valid) → engine awards `COINS_PER_MINI_CUBE` locally (optimistic) → session forwards `explode` → hub validates, detects face clear, credits account in DB (atomic increment), updates `member.economy` from repo result, sends `economyUpdate` to all joined account connections (including origin) → session adopts absolute totals.
3. Completion (sixth face) → engine awards `COINS_PER_CUBE × (2 if fast)` locally + increments `cubesDestroyed` → session sends `cubeCompleted` → hub computes speed bonus from server clock (previous cube's `cubeStartedAtMs` and `gridSize` threshold), credits, persists, sends `economyUpdate`.
4. Reconnect → `welcome` re-sends persisted totals → session adopts (reconciles).
5. Guest → same client-side awards, no server persistence, no `economyUpdate`.

### State ownership

- **Server (accounts):** coins + stats totals in `user_economy` table. Authoritative. Also in-memory `Member.cubeStartedAtMs` for speed bonus and `Member.economy` for placement.
- **Client engine:** optimistic coins/stats for HUD responsiveness; reconciled by `adoptEconomy`.
- **Reducer (`server-state.ts`):** carries `self.economy` from server messages (the server's last reported totals) for the store/UI; session bridges to engine.

## Interfaces / contracts

### Backend economy constants (`game/economy.ts`)

```ts
export const COINS_PER_MINI_CUBE = 0.1;
export const COINS_PER_CUBE = 5;
export const SPEED_BONUS_MULTIPLIER = 2;
export function thresholdSeconds(gridSize: number): number; // gridSize * 5
export function roundCoins(value: number): number; // 2 decimals, half-up
export function speedBonusApplies(elapsedMs: number, gridSize: number): boolean;
```

### Backend economy repository (`auth/economy-repository.ts`)

```ts
export interface EconomyState { coins: number; clicks: number; facesDestroyed: number; cubesDestroyed: number; }
export interface EconomyRepository {
  findByUserId(userId: string): Promise<EconomyState | null>;
  credit(userId: string, delta: Partial<EconomyState>): Promise<EconomyState>;
}
// InMemory + Pg implementations; credit upserts with atomic increments.
```

`credit` MUST use atomic SQL increments, never read-modify-write:

```sql
INSERT INTO user_economy (user_id, coins, clicks, faces_destroyed, cubes_destroyed)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id) DO UPDATE SET
  coins = user_economy.coins + EXCLUDED.coins,
  clicks = user_economy.clicks + EXCLUDED.clicks,
  faces_destroyed = user_economy.faces_destroyed + EXCLUDED.faces_destroyed,
  cubes_destroyed = user_economy.cubes_destroyed + EXCLUDED.cubes_destroyed,
  updated_at = now()
RETURNING coins, clicks, faces_destroyed, cubes_destroyed;
```

(The in-memory impl applies the same delta additively under a single synchronous critical section.)

### DB migration (`002_economy.sql`)

```sql
CREATE TABLE IF NOT EXISTS user_economy (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins NUMERIC(18,2) NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  faces_destroyed BIGINT NOT NULL DEFAULT 0,
  cubes_destroyed BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Protocol (backend `protocol.ts`)

```ts
export interface EconomyState { coins: number; clicks: number; facesDestroyed: number; cubesDestroyed: number; }
// Placement gains: economy: EconomyState
// ServerMessage gains: { type: 'economyUpdate'; coins; clicks; facesDestroyed; cubesDestroyed }
```

### Hub deps

```ts
export interface HubDeps {
  ...
  economy?: EconomyRepository | null; // optional; absent => no persistence
}
```

### Member

```ts
interface Member {
  ...
  cubeStartedAtMs: number;
  economy: EconomyState;
}
```

`handleJoin` is async: it awaits `economy.findByUserId(userId)` (when an account and a repo are present) before creating the member and sending `welcome`, so `member.economy` is populated and `placementFor` can include it. Tests flush microtasks.

### Frontend types

```ts
export interface GameStats {
  clicks: number;
  facesDestroyed: number;
  cubesDestroyed?: number;
  coins?: number;
}
export interface EconomyState { coins: number; clicks: number; facesDestroyed: number; cubesDestroyed: number; }
```

### Engine

```ts
export interface GameEngine {
  ...
  adoptEconomy?(economy: EconomyState): void;
}
// EngineSnapshot.stats already carries coins/cubesDestroyed (optional).
// Engine tracks cubeElapsedMs internally (reset on level advance).
```

`adoptEconomy` is optional on the base contract for source compatibility with engine fakes (mirroring `adoptCubeState`); `createEngine` always implements it.

### Frontend protocol mirror

Mirror backend: `EconomyState`, `economy` on `Placement`, `economyUpdate` message.

### Reducer

```ts
export interface SelfState {
  ...
  economy: EconomyState;
}
export interface PendingWorldSwap {
  serverId: number;
  maxUsers: number;
  position: Position;
  self: CubeState;
  roster: MemberState[];
  economy: EconomyState;
}
// WorldState.self carries economy; createWorldState uses zeros.
// reduceWorldState: welcome sets self.economy from msg.economy;
//   worldEntered stores msg.economy in pendingWorldSwap.economy AND sets self.economy
//   immediately; economyUpdate updates self.economy (new reference).
// applyWorldSwap carries pending.economy into self.economy.
```

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/economy.ts` | New | Constants + helpers |
| `src/backend/src/game/economy.test.ts` | New | Unit tests |
| `src/backend/src/auth/economy-repository.ts` | New | Repository interface + impls |
| `src/backend/src/auth/economy-repository.test.ts` | New | Unit tests |
| `src/backend/src/db/migrations/002_economy.sql` | New | Schema |
| `src/backend/src/game/protocol.ts` | Edit | EconomyState, economy field, economyUpdate, codec |
| `src/backend/src/game/protocol.test.ts` | Edit | Codec matrix additions |
| `src/backend/src/game/hub.ts` | Edit | cubeStartedAtMs, economy field, async join, credit, face-clear, broadcast, placement economy |
| `src/backend/src/game/hub.test.ts` | Edit | Economy tests |
| `src/backend/src/app.ts` | Edit | Wire economy repo into hub |
| `src/backend/src/app.test.ts` | Edit | Integration coverage |
| `src/frontend/src/game/types.ts` | Edit | GameStats (optional new fields) + EconomyState |
| `src/frontend/src/game/progression.ts` | Edit | coins/cubesDestroyed, initial stats, helpers |
| `src/frontend/src/game/progression.test.ts` | Edit | Tests |
| `src/frontend/src/game/economy.ts` | New | Mirrored constants |
| `src/frontend/src/game/economy.test.ts` | New | Unit tests |
| `src/frontend/src/game/engine.ts` | Edit | Awards, speed bonus, adoptEconomy, cubeElapsedMs |
| `src/frontend/src/game/engine.test.ts` | Edit | Tests |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirror |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Parity |
| `src/frontend/src/multiplayer/server-state.ts` | Edit | Economy in SelfState/WorldState/PendingWorldSwap/reducer |
| `src/frontend/src/multiplayer/server-state.test.ts` | Edit | Tests |
| `src/frontend/src/game/session.ts` | Edit | Adopt economy |
| `src/frontend/src/game/session.test.ts` | Edit | Tests |
| `src/frontend/src/ui/Hud.tsx` | Edit | Coins line |
| `src/frontend/src/ui/Hud.test.tsx` | Edit | Tests |
| `docs/product/glossary.md` | Edit | Add "coins" term (optional) |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Reuse existing Postgres + migration runner; no new service | user-auth already decided the DB path; minimizes containerization impact | Separate economy service (rejected: over-engineering) |
| 2 | Server credits on validated events; client optimistic | Matches existing optimistic play pattern; server authoritative | Client-only earning (rejected: no persistence/auth) |
| 3 | Speed bonus from server clock (`cubeStartedAt`) | Prevents client forgery; consistent with server authority | Client timing (rejected: forgeable) |
| 4 | `user_economy` separate table (1:1 with users) | Clean separation from auth; cascade delete | Columns on `users` (rejected: mixes concerns) |
| 5 | Absolute totals in `economyUpdate` (not deltas) | Simple reconcile; idempotent | Delta merge (rejected: ordering complexity) |
| 6 | Guests earn locally only | Keeps guest first-class and frictionless | Disable guest earning (open question Q-6, default with notice) |
| 7 | Level/board not persisted | Matches existing in-memory game-state assumption | Persist level (open question Q-5, approval-gated) |
| 8 | Coin rounding to 2 decimals half-up | Avoids float drift; testable | Integer cents (open question Q-8, default with notice) |
| 9 | Atomic SQL increments for credit | Multi-tab concurrency (AC-17); no lost updates | Read-modify-write (rejected: loses updates) |
| 10 | Out-of-order `economyUpdate` accepted as transient risk | Simpler than monotonic guard; next welcome reconciles | Monotonic guard (rejected: added complexity, deferred) |
| 11 | `adoptEconomy` optional on base contract | Source compat with engine fakes (mirrors `adoptCubeState`) | Required (rejected: breaks fakes) |
| 12 | `GameStats` new fields optional (default 0) | Avoids typecheck ripple across existing literals | Required + update all literals (rejected: large churn) |

## Risks & mitigations

- **Float drift in coin totals** → round to 2 decimals on every credit (client + server) and store as NUMERIC.
- **Async persistence in sync hub handlers** → `handleJoin`/credits are async; tests flush microtasks; game broadcasts stay synchronous where possible.
- **Multi-tab double credit** → credits are per event per member; two tabs = two members (existing model); each earns independently; totals accumulate via atomic SQL increments.
- **Speed bonus clock skew** → server clock only; client cannot influence. Elapsed read from previous cube's `cubeStartedAtMs` before reset.
- **Out-of-order `economyUpdate`** → accepted transient risk (F9); next `welcome`/`economyUpdate` reconciles.
- **Coverage regression from new files** → each task owns its test files and runs workspace coverage pre-gate.
- **Protocol parity** → backend + frontend codecs updated together; parity tests.

## Open questions

See spec.md § Open questions (Q-1..Q-11). Q-1, Q-2, Q-3, Q-5 are approval-gated before T1/T6; Q-4, Q-6, Q-8, Q-10, Q-11 are default-with-notice; Q-7 deferred; Q-9 non-goal.

## Assumptions

See spec.md § Assumptions.