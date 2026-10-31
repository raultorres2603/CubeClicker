---
feature: spending-upgrades
revision: 3
status: draft
created: 2026-10-30
updated: 2026-10-30
---
# Spec — Spending & Upgrades (coin sinks, earn faster)

## Summary

Add the spending half of the core loop to CubeClicker: players spend persistent coins on upgrades that make them earn faster, building on the coin-economy feature (coins, stats, server authority, Postgres persistence). The server remains authoritative for account balances, upgrade levels, costs and effect application; clients compute previews and apply effects optimistically where already established, reconciling on server messages. Guests remain first-class: whether guests may spend ephemeral coins is flagged as an open question (proposed default: yes, session-only). Idle accrual is explicitly out of scope (separate subsequent feature). No new service, image, port or dependency is introduced; upgrades reuse the existing `user_economy` table via a new numbered migration.

## User stories

- As a player, I want to spend coins on upgrades, so my effort turns into lasting earning power.
- As a player, I want upgrade effects to apply to future earnings, so each purchase has a clear payoff.
- As an account holder, I want my upgrades to persist and sync across tabs, so progress is never lost or stale.
- As a guest, I want to try upgrades without an account, so entry stays frictionless.
- As a player, I want to see my coin balance and upgrade levels, so I can decide what to buy next.

## Acceptance criteria

Verification notes: "backend" = `src/backend`, "frontend" = `src/frontend`. Evidence per AC: a test file asserting concrete values, a command, or an observable step. All tests use concrete expected values (no banned matchers, no useless tests). Commands from `AGENTS.md`.

### Upgrade catalog & effects

- **AC-1 — Pinned catalog.** The upgrade catalog is a fixed, pinned list of three upgrades: `mini_cube_value` ("Click Power", +10% coins per mini-cube per level, max 10), `cube_value` ("Cube Bonus", +10% coins per cube per level, max 10), `speed_window` ("Quick Hands", +2 s to the speed-bonus threshold per level, max 5). Evidence: `upgrades.test.ts` (both workspaces).
- **AC-2 — Effect on mini-cube rewards.** An account/guest with `mini_cube_value` level L earns `roundCoins(COINS_PER_MINI_CUBE * (1 + 0.1 * L))` per destroyed mini-cube. Evidence: `engine.test.ts`, `hub.test.ts`.
- **AC-3 — Effect on cube rewards.** With `cube_value` level L, the per-cube reward is `roundCoins(COINS_PER_CUBE * (1 + 0.1 * L) * (2 if speed bonus else 1))`. Evidence: `engine.test.ts`, `hub.test.ts`.
- **AC-4 — Effect on speed window.** With `speed_window` level L, the speed-bonus threshold becomes `thresholdSeconds(gridSize) + 2 * L` seconds, and the speed bonus applies when `cubeElapsedMs <= (thresholdSeconds(gridSize) + speedWindowSeconds(upgrades)) * 1000` (inclusive boundary). Evidence: `engine.test.ts`, `hub.test.ts`.
- **AC-5 — Effects apply to future earnings only.** Purchasing an upgrade does not change coins already earned; only subsequent credits use the new multiplier. Evidence: `engine.test.ts`, `hub.test.ts`.

### Spending (server authority)

- **AC-6 — `purchaseUpgrade` client message.** The client→server catalog gains `purchaseUpgrade { upgradeId: string }`; the codec validates `upgradeId` as a non-empty string. Evidence: `protocol.test.ts` (both workspaces).
- **AC-7 — Server validates.** On a `purchaseUpgrade` for an account member, the server rejects with `error` code `insufficient_funds` when the balance is below the cost; `unknown_upgrade` when the id is not in the catalog; `max_level` when the upgrade is already at max. A `null` result from the repository's `purchaseUpgrade` (insufficient funds, stale level, or missing row) is reported as `insufficient_funds`. No DB write and no broadcast occur on rejection. Evidence: `hub.test.ts`.
- **AC-8 — Atomic debit + level increment.** On an approved purchase the server reloads the account's current upgrade levels from the repository at the start of `handlePurchaseUpgrade`, recomputes `cost` and `currentLevel` from that DB value, then atomically debits the cost and increments the level by exactly 1 in a single conditional update with no insert/upsert: `UPDATE user_economy SET coins = coins - $cost, upgrades = jsonb_set(upgrades, $path, to_jsonb(($currentLevel + 1)::int)), updated_at = now() WHERE user_id = $1 AND coins >= $cost AND COALESCE((upgrades->>'<id>')::int, 0) = $currentLevel RETURNING coins, clicks, faces_destroyed, cubes_destroyed, upgrades`. The update returns `null` (no row) on insufficient funds, a stale level, or a missing account row; no half-applied state is possible. Evidence: `economy-repository.test.ts`, `hub.test.ts`.
- **AC-9 — Server totals authoritative.** After an approved purchase the server broadcasts `economyUpdate` (new coin total) and `upgradesUpdate` (new upgrade levels) to all joined account connections (including origin); clients adopt both as absolute values. Evidence: `hub.test.ts`, `session.test.ts`.
- **AC-10 — Guests.** Guests (no account session) never trigger a DB write or broadcast on `purchaseUpgrade`. Under the Q-5 default (yes, session-only), a guest purchase validates against the mirrored catalog/cost and then calls `engine.adoptEconomy` with the debited coin total and `engine.adoptUpgrades` with the incremented level, with no message sent; if Q-5 resolves to "no", the panel is disabled for guests via the session-owned mode signal (`MultiplayerSnapshot.mode === 'guest'`). The mode signal is populated from the last successful `join(mode)` and does not require changes to `server-state.ts` or its tests. Evidence: `hub.test.ts`, `engine.test.ts`, `session.test.ts`.

### Persistence & sync

- **AC-11 — Upgrades persisted per account.** An account's upgrade levels are loaded from the DB on join and delivered in `welcome`/`worldEntered` via an `upgrades` field (`Record<string, number>`), which is always present for accounts (possibly `{}`) and optional only for guests. Evidence: `hub.test.ts`, `protocol.test.ts`.
- **AC-12 — `upgradesUpdate` message.** The server catalog gains `upgradesUpdate { upgrades: Record<string, number> }`; the codec validates `upgrades` as an object mapping non-empty string keys to integer levels. Evidence: `protocol.test.ts` (both workspaces).
- **AC-13 — Client adopts `upgradesUpdate`.** Receiving `upgradesUpdate` replaces the engine's upgrade levels with the carried absolute map; in-flight play is not interrupted; future earnings use the new levels. Evidence: `session.test.ts`, `engine.test.ts`.
- **AC-14 — Multi-tab sync.** All joined connections of an account receive `upgradesUpdate` after an approved purchase (best-effort; a mid-grace connection receives levels via `welcome` on resume). Evidence: `hub.test.ts`.
- **AC-15 — Reconnect reconciles.** A reconnecting account receives its persisted upgrade levels in `welcome` and adopts them. Evidence: `session.test.ts`, `hub.test.ts`.

### Engine & UI

- **AC-16 — Engine tracks upgrades.** The engine holds an `upgrades: Record<string, number>` map, applies it to earning (AC-2..AC-4), and exposes `adoptUpgrades(upgrades)` (optional seam on the base contract, always implemented by `createEngine`). Evidence: `engine.test.ts`.
- **AC-17 — Upgrade levels in snapshot.** `EngineSnapshot` carries `upgrades` (optional on the base contract for fake compatibility; `createEngine` always populates it, and `OnlineEngineSnapshot` requires it) so the UI can render levels and compute cost previews. Evidence: `engine.test.ts`.
- **AC-18 — Cost formula.** `upgradeCost(id, currentLevel)` returns the cost of the next level: `baseCost * (currentLevel + 1)` with base costs 10 / 50 / 25 coins for `mini_cube_value` / `cube_value` / `speed_window`. Returns `Infinity` when `currentLevel >= maxLevel`; `Infinity` is a client-only preview sentinel and is never persisted or serialized. Evidence: `upgrades.test.ts` (both workspaces).

- **AC-19 — Shop UI.** The frontend renders an upgrades panel listing each upgrade's name, level/max, effect preview and cost, with a buy button that calls `session.purchaseUpgrade(id)` when affordable. The panel receives a `mode: 'guest' | 'account'` prop sourced from `MultiplayerSnapshot.mode` (session-owned, populated from the last successful `join(mode)`); under Q-5 "no" it is disabled for guests. Evidence: `UpgradesPanel.test.tsx`, `App.test.tsx`.
- **AC-20 — HUD coins.** The HUD continues to render `Coins <value>` to 2 decimals (already shipped; unchanged). Evidence: `Hud.test.tsx`.

### Real-time & persistence invariants

- **AC-21 — Server clock for effects.** Upgrade-affected speed bonuses still use the server clock (`cubeStartedAtMs`, `now()`); client-supplied timing/level values cannot change the bonus or credits. Evidence: `hub.test.ts`.
- **AC-22 — No trust in client coin/level values.** The server derives costs, levels and credits from its own catalog and DB state; client-supplied `upgradeId` is validated against the catalog only. Evidence: `hub.test.ts`.

### Containers & coverage

- **AC-23 — No containerization impact.** No new service, image, port, env var, health signal, Dockerfile or compose change; the feature runs in the existing backend container and reuses the existing Postgres service and migration runner. The only artifact is a new numbered migration `003_upgrades.sql` (plus `schema.sql` mirror) applied on boot. Evidence: `git diff` on container paths empty (plus migration file).
- **AC-24 — Coverage gate.** `npm run coverage` meets ≥ 80% statements/branches/functions/lines in both workspaces with the new modules included and no coverage exclusions. Evidence: coverage report at final gate.

## Non-goals

- No idle/offline accrual (separate subsequent feature).
- No leaderboards, global counters, cross-account transfers, refunds, or transaction history.
- No new currency or premium currency.
- No persistence of the current cube level/board (game state stays in-memory and resets on restart, per `multiplayer-servers` AC-4); only coins/stats/upgrades persist.
- No changes to game rules, cube logic, multiplayer rebalance, or spectating.
- No new dependency, service, port, or image.
- No monetization, real-money purchases, or external payment.
- No upgrade effect beyond earning rate (no cosmetic, no board-size, no auto-click) in v1.

## Boundaries

- ✅ Always: server authority over every economy/upgrade value for accounts; parameterized SQL only; atomic conditional updates for spending; concrete test assertions; run lint/typecheck/tests/coverage before reporting done; stage only `files_owned` per task; keep `game/**` pure and DOM-free.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation (catalog, costs, effects, max levels, base costs); touching files outside a task's `files_owned` (especially `compose.yaml`, `compose.smoke.yaml`, Dockerfiles, `app.ts` wiring); any coverage exclusion or threshold change; editing `docs/product/vision.md`.
- 🚫 Never: weaken assertions; trust client-supplied coin/level/timing values; persist guest data; edit predecessor feature specs/plans/tasks; push; change ACs unilaterally.

## Security considerations

- **User-controlled data:** `upgradeId` from the client is validated against the pinned catalog; no free text reaches SQL. All SQL parameterized. No new auth inputs.
- **Persistence integrity:** upgrades stored as JSONB on `user_economy` (existing table, FK cascade). Migration is numbered, idempotent (`ADD COLUMN IF NOT EXISTS`), applied on boot before listening; a failed migration aborts startup. Repositories are the only DB access path. Spending uses a single atomic conditional `UPDATE ... WHERE coins >= $cost AND COALESCE((upgrades->>'<id>')::int, 0) = $currentLevel` (no insert/upsert), never read-modify-write, so concurrent multi-tab purchases cannot overdraw, clobber a level increment, or exceed `maxLevel`. The account's current upgrades are reloaded from the repository at the start of `handlePurchaseUpgrade` before cost/level are derived.
- **Secrets:** no new secrets; DB credentials already come from env. No upgrade secrets in the bundle.
- **Abuse bounds:** purchases happen only after server validation against the catalog and DB balance; rate limits on the WS already bound message frequency; no client can self-credit or self-level.
- **Client safety:** frontend computes cost previews and effects from mirrored constants but server totals/levels reconcile; no coin or level value is trusted from the client. `Infinity` is a client-only preview sentinel for `upgradeCost` at max level and is never persisted or serialized.

## Testing strategy

- **Backend unit (Vitest, node):** `game/upgrades.test.ts` (catalog, cost formula, multipliers, max levels), `auth/economy-repository.test.ts` extended (findUpgrades, purchaseUpgrade atomic conditional with level guard, insufficient funds, stale-level, concurrency, no row creation on failure), `game/hub.test.ts` extended (purchase validation, broadcast, guest no-persist, reconnect loads upgrades, speed window effect, reload-before-purchase), `game/protocol.test.ts` (upgrades fields + `upgradesUpdate` + `purchaseUpgrade` codec matrix, integer levels).
- **Backend integration:** `app.test.ts` extended — account join loads persisted upgrades; verified-account purchase round-trips against an in-memory repo.
- **Frontend unit (Vitest, node):** `game/upgrades.test.ts` (mirror), `game/progression.test.ts` (unchanged mostly), `game/engine.test.ts` (upgrades in awards, adoptUpgrades, snapshot), `multiplayer/protocol.test.ts` (parity), `multiplayer/server-state.test.ts` (unchanged — upgrades live in engine), `ui/UpgradesPanel.test.tsx`, `ui/Hud.test.tsx` (coins line retained).
- **Frontend integration:** `session.test.ts` (welcome/worldEntered adopt upgrades, upgradesUpdate updates engine, reconnect reconciles, purchaseUpgrade sends message, guest local purchase adopts debited coins + level).
- **E2E / container:** no smoke change (AC-23); protocol additions are additive.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace; pre-gates per task are workspace-scoped; no exclusions.
- **Assertion bar:** concrete expected values (coin totals to 2 decimals, upgrade levels, costs, message shapes); no banned wildcard matchers; no snapshot-only or assertion-free tests.

## Real-time impact (contract)

- **Server authority.** The server is the single authority for coins, stats and upgrade levels for accounts: it validates purchases, debits, increments levels, computes effect-aware credits from its own clock, and reconciles clients. Clients compute previews/optimistic effects but never authoritatively.
- **Connection lifecycle.** On join, an account receives persisted totals and upgrade levels in `welcome`; on purchase, connected account sockets receive `economyUpdate` + `upgradesUpdate`; on reconnect within grace, `welcome` re-sends persisted values; grace expiry leaves persistence untouched.
- **Multi-client behavior.** All joined connections of an account receive `upgradesUpdate` (multi-tab sync), including the origin. Concurrent purchases are serialized server-side and guarded by atomic conditional updates (no overdraw, no lost increment, no level beyond max).
- **Latency behavior.** Cost previews render instantly from mirrored constants; purchase round-trips reconcile via `economyUpdate`/`upgradesUpdate` without interrupting play.
- **Out-of-order delivery.** `economyUpdate`/`upgradesUpdate` may arrive out of order across tabs; a stale total/level may briefly overwrite a newer one; the next `welcome`/update reconciles. No monotonic guard in v1 (consistent with coin-economy).

## Containerization impact

No new services, images, ports, env vars, health signals or compose changes. The feature runs in the existing backend container and reuses the existing Postgres service and migration runner. The only artifacts are a new numbered migration `src/backend/src/db/migrations/003_upgrades.sql` (plus the `schema.sql` mirror), applied on boot (idempotent). `podman compose up` and `npm run smoke` are unchanged.

## Open questions

Approval-gated (BLOCKING — must be approved before the named task starts; proposed defaults used in the interim and flagged in the task):

- **Q-1 (BLOCKING, gate before T1).** Upgrade catalog & effects. Proposed default: three upgrades `mini_cube_value`, `cube_value`, `speed_window` with effects +10%/level (max 10), +10%/level (max 10), +2 s/level (max 5). Alternative: different set/effects. Needs user approval; constants live in `game/upgrades.ts`.
- **Q-2 (BLOCKING, gate before T1).** Cost formula. Proposed default: `cost = baseCost * (currentLevel + 1)` with base costs 10 / 50 / 25. Alternative: exponential `baseCost * 2^currentLevel`. Needs approval.
- **Q-3 (BLOCKING, gate before T1).** Max levels. Proposed defaults 10 / 10 / 5. Alternative: 5 / 5 / 3. Needs approval.
- **Q-4 (BLOCKING, gate before T2).** Spending atomicity scope. Proposed default: single atomic conditional UPDATE on `user_economy` (coins + upgrades JSONB) with a level guard, no insert/upsert. Alternative: separate transaction across two tables. Needs approval (affects migration shape).
- **Q-5 (BLOCKING, gate before T6).** Guest spending. Proposed default: guests may spend ephemeral coins locally (upgrades session-only, no persistence/broadcast). Alternative: upgrades are account-only (guests see the panel but cannot buy, or no panel). Needs approval (affects guest UX and engine state).

Default-with-notice (resolved as proposed defaults; no approval gate, but flagged):

- **Q-6 (default with notice).** Effect timing. Default: effects apply to future earnings only (no retroactive coin change). Alternative: retroactive recompute (rejected: complex).
- **Q-7 (default with notice).** Upgrade sync channel. Default: separate `upgrades` field on `Placement` + `upgradesUpdate` message, separate from `economyUpdate`. Alternative: fold upgrades into `EconomyState` (rejected: changes coin-economy's EconomyState shape and breaks its tests).
- **Q-8 (default with notice).** Persistence shape. Default: JSONB `upgrades` column on `user_economy` (migration 003). Alternative: separate `user_upgrades` table.
- **Q-9 (default with notice).** Purchase UX. Default: server-authoritative round-trip (no optimistic local debit); shop button disabled while a request is in flight. Alternative: optimistic debit with reconcile.
- **Q-10 (default with notice).** Error surface. Default: server sends `error` with codes `insufficient_funds` / `unknown_upgrade` / `max_level`; client logs and leaves state unchanged (no toast in v1). Alternative: toast UI.
- **Q-12 (default with notice).** Codec strictness for upgrade levels. Default: the codec validates `upgrades` values as integers (non-integer levels decode as `bad_message`); non-integer levels never reach the server. Alternative: accept any number and reject server-side (documented only).

Deferred / non-goal:

- **Q-11 (deferred).** Idle accrual: out of scope (separate subsequent feature).
- **Q-13 (deferred).** Upgrade tree/prerequisites and branching: out of scope v1 (flat list).

## Assumptions

- Accounts are optional and additive (user-auth); guest play remains first-class. Upgrades persist only for accounts unless Q-5 resolves to guest-local (session-only).
- Game state (board, level, position) stays in-memory and resets on restart; coins/stats/upgrades persist for accounts.
- Existing Postgres container and migration runner are reused; no new service.
- `COINS_PER_MINI_CUBE`, `COINS_PER_CUBE` and threshold formula remain pinned in `game/economy.ts`; upgrade multipliers live in `game/upgrades.ts` (mirrored on frontend).
- `GameStats.coins` remains optional (default 0); upgrade levels are tracked separately from stats.
- `EconomyState` (coin-economy) keeps its 4-field shape; upgrades travel as a separate `UpgradeState = Record<string, number>`.
- Purchase is server-authoritative: the client never debits coins or levels locally for accounts; it adopts server messages. Guest purchases (Q-5 default) are the only local debit path.
- Error codes are a closed set; new codes are added to both backend and frontend `ErrorCode` unions.
- `findUpgradesByUserId` returns `UpgradeState` defaulting to `{}` for a missing row; the hub treats `{}` as "no upgrades".
- `EngineSnapshot.upgrades` is optional on the base contract (fake compatibility) but always populated by `createEngine`.
- `upgradeCost` returns `Infinity` at max level as a client-only preview sentinel; it is never persisted or serialized.
- In-flight purchase disabling (Q-9 default) is deferred to a later pass: `UpgradesPanel` has no `pendingId` prop and `session.purchaseUpgrade` remains `void` in v1; repeated clicks are guarded server-side by the level guard. Recorded as a default-with-notice choice.
- The session-owned mode signal is `MultiplayerSnapshot.mode: 'guest' | 'account'`, populated from the last successful `join(mode)` (default `'guest'` before the first join); `server-state.ts` and its tests are unchanged.

## Revision history

- r1 — 2026-10-30 — initial draft (planning phase).
- r2 — 2026-10-30 — address spec review r1 findings F1..F13: F1 conditional UPDATE only (no insert) with null on no row; F2 reload upgrades + level guard; F3 speed-window formula pinned inclusive; F4 guest handling made concrete; F5 `purchaseUpgrade` on `OnlineGameSession`; F6 wire contract pinned (upgrades always present for accounts); F7 `findUpgradesByUserId` defaults to `{}`; F8 T4 routing explicit; F9 `EngineSnapshot.upgrades` optional; F10 `Infinity` sentinel pinned; F11 T12 container/doc gate; F12 codec integer levels; F13 T4 size noted.
- r3 — 2026-10-30 — address spec review r2 findings F14..F18: F14 replace pinned UI mode signal `multiplayerSnapshot.world.self.identity.kind` with session-owned `MultiplayerSnapshot.mode: 'guest' | 'account'` (populated from last successful `join(mode)`; no change to server-state.ts/tests); F15 add guest early guard in handlePurchaseUpgrade; F16 defer in-flight purchase disabling (recorded); F17 document null→`insufficient_funds` mapping; F18 reorder T4 reload-first.