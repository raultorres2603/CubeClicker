---
feature: spending-upgrades
revision: 3
---
# Plan — Spending & Upgrades (coin sinks, earn faster)

## Architecture

### Module ownership

- **Backend pure logic:** `src/backend/src/game/upgrades.ts` — pinned catalog (`UPGRADE_CATALOG`), cost formula (`upgradeCost`), multipliers (`miniCubeMultiplier`, `cubeMultiplier`, `speedWindowSeconds`), max levels, validation helpers. Pure, no I/O. Mirrored by a frontend module.
- **Backend economy (extended):** `src/backend/src/game/economy.ts` — unchanged constants; upgrade multipliers are applied at credit sites in the hub using `upgrades.ts`.
- **Backend persistence:** `src/backend/src/auth/economy-repository.ts` — gains `findUpgradesByUserId` (returns `UpgradeState`, defaulting to `{}`) and `purchaseUpgrade` (atomic conditional update, no insert). `EconomyState` shape unchanged.
- **Backend integration:** `src/backend/src/game/hub.ts` — `Member` gains `upgrades: UpgradeState`; `handleJoin` (async) loads upgrades alongside economy; `handleExplode`/`handleCompletion` apply upgrade multipliers and speed-window to credits; new `handlePurchaseUpgrade` reloads upgrades, recomputes cost/currentLevel, validates, debits, increments, broadcasts `economyUpdate` + `upgradesUpdate`; `placementFor` includes `upgrades` (always for accounts, possibly `{}`).
- **Backend wiring:** `src/backend/src/app.ts` — unchanged (repo already wired); no new wiring.
- **Backend protocol:** `src/backend/src/game/protocol.ts` — `UpgradeState` type, `upgrades?` field on `Placement`, `upgradesUpdate` server message, `purchaseUpgrade` client message, codec validation (integer levels), builders, new error codes.
- **Frontend types:** `src/frontend/src/game/types.ts` — add `UpgradeState` type (and re-export). `GameStats` unchanged.
- **Frontend upgrades:** `src/frontend/src/game/upgrades.ts` — mirrored catalog/costs/multipliers.
- **Frontend engine:** `src/frontend/src/game/engine.ts` — holds `upgrades`, applies multipliers in `explode`/completion, exposes `adoptUpgrades` (optional seam), carries `upgrades` in snapshot (optional base, required in `OnlineEngineSnapshot`).
- **Frontend protocol:** `src/frontend/src/multiplayer/protocol.ts` — mirror.
- **Frontend session:** `src/frontend/src/game/session.ts` — adopt upgrades on welcome/worldEntered/upgradesUpdate; send `purchaseUpgrade` via `session.purchaseUpgrade` (account path) or apply the local guest debit (guest path); handle errors; `OnlineGameSession.purchaseUpgrade` added. Tracks `joinedMode: 'guest' | 'account'` (default `'guest'`) updated on every `join(mode)` and exposes it as `mode` on `MultiplayerSnapshot` (cache invalidation extended to `mode`); no change to `server-state.ts`.
- **Frontend UI:** `src/frontend/src/ui/UpgradesPanel.tsx` — shop panel; `Hud.tsx` unchanged (coins line retained).

### Data flow

1. Account joins → hub awaits `findByUserId` + `findUpgradesByUserId` → loads persisted economy + upgrades into `Member` → `welcome` carries `economy` + `upgrades` → session adopts into engine → UI shows persisted totals/levels.
2. Explode (valid, account) → engine awards `roundCoins(COINS_PER_MINI_CUBE * miniCubeMultiplier(upgrades))` locally (optimistic) → session forwards `explode` → hub validates, detects face clear, credits account with upgrade-aware amount + click + facesDestroyed via atomic increment, updates `member.economy`/`member.upgrades`, sends `economyUpdate` (+ no upgrades change) to all joined account connections → session adopts absolute totals.
3. Completion → engine awards `roundCoins(COINS_PER_CUBE * cubeMultiplier(upgrades) * (2 if speed bonus else 1))` + increments cubesDestroyed → session sends `cubeCompleted` → hub computes speed bonus using `thresholdSeconds(gridSize) + speedWindowSeconds(upgrades)` seconds (inclusive) and server clock, credits, persists, sends `economyUpdate`.
4. Purchase (account) → shop calls `session.purchaseUpgrade(id)` → session sends `purchaseUpgrade { upgradeId }` → hub reloads upgrades, recomputes cost/currentLevel, validates catalog/balance/max level, atomically debits + increments level (level-guarded conditional UPDATE, no insert), persists, broadcasts `economyUpdate` + `upgradesUpdate` to all joined account connections → session adopts both → engine uses new multipliers for future earnings.
5. Purchase (guest, Q-5 default) → shop calls `session.purchaseUpgrade(id)` → session validates against the mirrored catalog/cost using the engine snapshot, then calls `engine.adoptEconomy` with the debited coin total and `engine.adoptUpgrades` with the incremented level; no message is sent and no DB write/broadcast occurs.
6. Reconnect → `welcome` re-sends persisted totals + upgrades → session adopts.
7. Guest → same client-side awards using local upgrades; local purchase debits local coins and increments local upgrades (no server); no broadcast.

### State ownership

- **Server (accounts):** coins + stats + upgrades in `user_economy` (upgrades JSONB). Authoritative. Also in-memory `Member.upgrades` and `Member.cubeStartedAtMs`.
- **Client engine:** optimistic coins/stats/upgrades for HUD/shop responsiveness; reconciled by `adoptEconomy`/`adoptUpgrades`.
- **Reducer (`server-state.ts`):** carries `self.economy` from server messages (unchanged); upgrades are engine-owned (not in WorldState).

## Interfaces / contracts

### Backend upgrades module (`game/upgrades.ts`)

```ts
export type UpgradeId = 'mini_cube_value' | 'cube_value' | 'speed_window';
export interface UpgradeDef { id: UpgradeId; name: string; baseCost: number; maxLevel: number; }
export const UPGRADE_CATALOG: readonly UpgradeDef[]; // pinned
export const UPGRADE_IDS: readonly UpgradeId[];
export type UpgradeState = Record<string, number>;

export function upgradeCost(id: UpgradeId, currentLevel: number): number; // baseCost * (currentLevel + 1), Infinity at max
export function upgradeLevel(upgrades: UpgradeState, id: UpgradeId): number;
export function miniCubeMultiplier(upgrades: UpgradeState): number; // 1 + 0.1 * level
export function cubeMultiplier(upgrades: UpgradeState): number; // 1 + 0.1 * level
export function speedWindowSeconds(upgrades: UpgradeState): number; // 2 * level
export function isValidUpgradeId(id: string): id is UpgradeId;
```

### Backend economy repository (extended)

```ts
// existing: findByUserId, credit
findUpgradesByUserId(userId: string): Promise<UpgradeState>; // defaults to {} for no row
purchaseUpgrade(userId: string, upgradeId: UpgradeId, cost: number, currentLevel: number):
  Promise<{ economy: EconomyState; upgrades: UpgradeState } | null>;
// null => insufficient funds, stale level, or no row; newLevel = currentLevel + 1 is written
```

`purchaseUpgrade` Pg implementation (no insert, level-guarded):

```sql
UPDATE user_economy
SET coins = coins - $cost,
    upgrades = jsonb_set(upgrades, $path, to_jsonb(($currentLevel + 1)::int)),
    updated_at = now()
WHERE user_id = $1
  AND coins >= $cost
  AND COALESCE((upgrades->>'<id>')::int, 0) = $currentLevel
RETURNING coins, clicks, faces_destroyed, cubes_destroyed, upgrades;
```

Returns `null` when no row is returned. The in-memory implementation mirrors this: it mutates the stored row only when it exists, `coins >= cost` and the stored level equals `currentLevel`; otherwise it returns `null` without creating a row. `upgrades` JSONB is parsed into `UpgradeState` (default `{}`).

### DB migration (`003_upgrades.sql`)

```sql
ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS upgrades JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Mirror in `schema.sql`.

### Protocol (backend)

```ts
export type UpgradeState = Record<string, number>;
// Placement gains: upgrades?: UpgradeState  (always present for accounts, possibly {}; optional for guests)
// ServerMessage gains:
//   { type: 'upgradesUpdate'; upgrades: UpgradeState }
// ClientMessage gains:
//   { type: 'purchaseUpgrade'; upgradeId: string }
// ErrorCode gains: 'insufficient_funds' | 'unknown_upgrade' | 'max_level'
```

Codec: `upgrades` on Placement validated as an object mapping non-empty string keys to integer levels (optional); `upgradesUpdate.upgrades` required integer levels; `purchaseUpgrade.upgradeId` non-empty string. `upgradesUpdateMessage(upgrades)` builder. `placementPayload` includes `upgrades` when present (defensive copy). `upgradesUpdateMessage` builder added.

### Member (hub)

```ts
interface Member {
  ...
  upgrades: UpgradeState;
}
```

`handleJoin` is async: it awaits `findByUserId` and `findUpgradesByUserId` (account + repo) before creating the member and sending `welcome`. `handlePurchaseUpgrade(member, connection, upgradeId)` is async: if `member.accountId === null` (guest) it returns immediately with no repo call and no broadcast (silent no-op); otherwise it reloads upgrades via `findUpgradesByUserId` first, then derives `currentLevel`/`cost` from that DB value, then validates the catalog (`unknown_upgrade`) and max level (`max_level`), then calls `purchaseUpgrade` (any `null` result → `insufficient_funds`), and on success updates every member with the same `accountId` and broadcasts `economyUpdate` + `upgradesUpdate` to joined account connections.
### Frontend types

```ts
export type UpgradeState = Record<string, number>;
// EngineSnapshot gains: upgrades?: UpgradeState (always populated by createEngine; required in OnlineEngineSnapshot)
```

### Engine

```ts
// holds upgrades (init {}); apply multipliers in explode/completion
adoptUpgrades?(upgrades: UpgradeState): void; // optional seam, always implemented by createEngine
// snapshot.upgrades
```

Speed-bonus comparison in the engine: `cubeElapsedMs <= (thresholdSeconds(gridSize) + speedWindowSeconds(upgrades)) * 1000`.

### Session

```ts
purchaseUpgrade(upgradeId: string): void; // OnlineGameSession; inert no-op offline
// MultiplayerSnapshot gains: mode: 'guest' | 'account' (session-owned, default 'guest')
```

On `upgradesUpdate` server message: `engine.adoptUpgrades(msg.upgrades)` + publish. On `welcome`/`worldEntered`: adopt upgrades when present.

Guest path (Q-5 default): validate against the mirrored catalog/cost using the engine snapshot; on success call `engine.adoptEconomy` with the debited coin total and `engine.adoptUpgrades` with the incremented level; no message sent. The guest branch is selected using the session-owned `joinedMode === 'guest'` (mirrored as `MultiplayerSnapshot.mode`), not `world.self.identity.kind`.
Mode signal for UI gating: `MultiplayerSnapshot` gains a session-owned `mode: 'guest' | 'account'` field, populated from the last successful `join(mode)` (default `'guest'` before the first join); `server-state.ts` and its tests are unchanged. Exposed to `UpgradesPanel` as a `mode` prop. The session also tracks the same value internally (`joinedMode`) and uses it in `purchaseUpgrade` to select the account vs guest path.

In-flight purchase disabling is deferred to a later pass (F16): `UpgradesPanel` has no `pendingId` prop and `session.purchaseUpgrade` remains `void`; repeated clicks are guarded server-side by the level guard. (Q-9 default partially deferred; recorded as default-with-notice.)
## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/upgrades.ts` | New | Catalog + cost + multipliers |
| `src/backend/src/game/upgrades.test.ts` | New | Unit tests |
| `src/backend/src/db/migrations/003_upgrades.sql` | New | Migration |
| `src/backend/src/db/schema.sql` | Edit | Mirror column |
| `src/backend/src/auth/economy-repository.ts` | Edit | findUpgradesByUserId, purchaseUpgrade |
| `src/backend/src/auth/economy-repository.test.ts` | Edit | Tests |
| `src/backend/src/game/protocol.ts` | Edit | UpgradeState, upgrades field, upgradesUpdate, purchaseUpgrade, error codes |
| `src/backend/src/game/protocol.test.ts` | Edit | Codec matrix |
| `src/backend/src/game/hub.ts` | Edit | upgrades on Member, load, multipliers, handlePurchaseUpgrade, placement upgrades, broadcast, routing |
| `src/backend/src/game/hub.test.ts` | Edit | Purchase/validation/sync tests |
| `src/backend/src/app.test.ts` | Edit | Integration coverage |
| `src/frontend/src/game/upgrades.ts` | New | Mirrored catalog/costs/multipliers |
| `src/frontend/src/game/upgrades.test.ts` | New | Unit tests |
| `src/frontend/src/game/types.ts` | Edit | UpgradeState type |
| `src/frontend/src/game/engine.ts` | Edit | upgrades state, multipliers, adoptUpgrades, snapshot |
| `src/frontend/src/game/engine.test.ts` | Edit | Tests |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirror |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Parity |
| `src/frontend/src/game/session.ts` | Edit | adopt upgrades, purchaseUpgrade, upgradesUpdate handling, guest path |
| `src/frontend/src/game/session.test.ts` | Edit | Tests |
| `src/frontend/src/ui/UpgradesPanel.tsx` | New | Shop panel |
| `src/frontend/src/ui/UpgradesPanel.test.tsx` | New | Tests |
| `docs/product/glossary.md` | Edit | Add "upgrades" term |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Reuse `user_economy` table via JSONB `upgrades` column (migration 003) | Single row per account; atomic update across coins+upgrades; no new table/container | Separate `user_upgrades` table (open Q-8) |
| 2 | Server credits use upgrade multipliers from loaded Member.upgrades | Server authority; consistent with coin-economy | Client-only multipliers (rejected: no persistence/auth) |
| 3 | Separate `upgrades` field + `upgradesUpdate` message | Keeps coin-economy's `EconomyState` 4-field shape and its tests intact | Fold into EconomyState (rejected: breaks coin-economy) |
| 4 | Purchase is server-authoritative round-trip (no optimistic debit) for accounts | Simpler; server is authority; avoids overdraw races | Optimistic debit (open Q-9) |
| 5 | Atomic conditional UPDATE for spending, no insert/upsert, with a level guard | Prevents overdraw and lost increments under concurrent multi-tab purchases; no DB write on rejection | Read-modify-write (rejected: loses updates); insert-then-update (rejected: F1) |
| 6 | Reload the account's upgrades from the repository at the start of `handlePurchaseUpgrade` before deriving cost/currentLevel | Avoids stale in-memory levels producing wrong costs or clobbering concurrent increments | Trust in-memory Member.upgrades (rejected: F2) |
| 7 | Guest spending follows Q-5 resolution (default: session-only local debit via adoptEconomy + adoptUpgrades) | Keeps guest first-class | Account-only (open Q-5) |
| 8 | Flat upgrade list, no prerequisites | Minimal v1; matches "spend to earn faster" loop | Upgrade tree (deferred Q-13) |
| 9 | `adoptUpgrades` optional on base contract | Source compat with engine fakes (mirrors `adoptEconomy`) | Required (rejected: breaks fakes) |
| 10 | `EngineSnapshot.upgrades` optional on base contract, always populated by `createEngine` | Source compat with snapshot fakes (F9) | Required (rejected: breaks fakes) |
| 11 | `findUpgradesByUserId` returns `UpgradeState` (default `{}`) | Single, non-null load path; mirrors economy zero-default (F7) | Nullable return (rejected: F7) |
| 12 | `purchaseUpgrade` added to `OnlineGameSession` with inert offline no-op | UI can call it uniformly (F5) | Account-only method (rejected: F5) |
| 13 | Wire contract: `upgrades` always present on welcome/worldEntered for accounts (possibly `{}`), optional only for guests | Single assertable shape (F6) | Always optional (rejected: F6) |
| 14 | `upgradeCost` sentinel pinned to `Infinity` (client-only, never persisted/serialized) | Binary-testable AC (F10) | Unspecified sentinel (rejected: F10) |
| 15 | Codec validates upgrade levels as integers | Rejects malformed levels at the boundary (F12) | Accept any number (rejected: F12) |
| 16 | UI mode signal is session-owned `MultiplayerSnapshot.mode` | Avoids touching `server-state.ts`/its tests and files outside task ownership (F14) | Add `identity` to `SelfState`/`PendingWorldSwap` (rejected: F14) |
| 17 | `handlePurchaseUpgrade` early-returns for guests | No repo call / broadcast for guest frames (F15) | Throw or send `not_authenticated` (deferred) |
| 18 | In-flight purchase disabling deferred (F16) | Keeps `session.purchaseUpgrade` `void` and avoids a pending seam in v1 | Add `pendingId` prop + status (deferred) |
| 19 | All `purchaseUpgrade` `null` results surface as `insufficient_funds` | Keeps the closed `ErrorCode` set small; mapping documented (F17) | Add `stale_level` code (deferred) |
## Risks & mitigations

- **Float drift in multiplied rewards** → round to 2 decimals on every credit (client + server) and store as NUMERIC.
- **Async purchase in sync hub** → handlePurchaseUpgrade is async (DB write + reload); tests flush microtasks; broadcasts after resolve.
- **Concurrent purchases overdraw / lost increment / level beyond max** → atomic conditional UPDATE with level guard `AND COALESCE((upgrades->>'<id>')::int,0) = $currentLevel` plus reload-before-derive; returns null on conflict.
- **Stale in-memory upgrades producing wrong cost** → reload from repository at start (F2).
- **No DB row on rejection** → conditional UPDATE only, no insert/upsert (F1); returns null.
- **Upgrade/catalog drift between workspaces** → mirrored modules with parity tests.
- **Coverage regression from new files** → each task owns its test files and runs workspace coverage pre-gate.
- **Protocol parity** → backend + frontend codecs updated together; parity tests.
- **Engine multiplier staleness** → adoptUpgrades replaces the whole map; future credits use new levels.
- **Engine snapshot fake compatibility** → `upgrades` optional on base contract (F9).
- **T4 size** → single task owns `hub.ts` (exclusive file ownership prevents splitting the same file); flagged as large but feasible; reviewer may split only if build time becomes a risk (F13, not required).

## Open questions

See spec.md § Open questions (Q-1..Q-13). Q-1..Q-5 are approval-gated before T1/T2/T6; Q-6..Q-10 and Q-12 are default-with-notice; Q-11/Q-13 deferred.

## Assumptions

See spec.md § Assumptions.