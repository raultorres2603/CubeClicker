---
feature: coin-economy
revision: 2
status: draft
created: 2026-10-28
updated: 2026-10-28
---

# Spec — Coin Economy & Persistent In-Game Stats

## Summary

Add an in-game economy to CubeClicker: destroying a mini-cube awards a small amount of coins, completing a cube awards a larger amount, and completing a cube quickly (within a size-dependent time limit) doubles that cube's reward. Coins and the in-game statistics (clicks, faces destroyed, cubes destroyed) become per-user and persistent for authenticated accounts, instead of resetting every game session. Guest play remains first-class: guests still earn coins and stats locally for the session, but nothing is persisted and no account is required. The feature reuses the existing Postgres container and migration path from `user-authentication`; no new service, image, port or dependency is introduced. All economy values are server-authoritative for accounts: the server credits coins, computes the speed bonus from its own clock, and reconciles connected clients over the existing WebSocket.

## User stories

- As a player, I want to earn coins by destroying mini-cubes and completing cubes, so progress has a tangible reward.
- As a player, I want a bonus for clearing a cube quickly, so skilled play is rewarded.
- As an account holder, I want my coins and stats to persist across sessions, so my progress is never lost.
- As a guest, I want to play and earn without an account, so entry stays frictionless.
- As a player with multiple tabs, I want my coin total to stay in sync, so I never see stale balances.

## Acceptance criteria

Verification notes: "backend" = `src/backend`, "frontend" = `src/frontend`. Evidence per AC: a test file asserting concrete values, a command, or an observable step. All tests use concrete expected values (no banned matchers, no useless tests). Commands from `AGENTS.md`.

### Economy (earning)

- **AC-1 — Per mini-cube reward.** Destroying one mini-cube increases the player's coin total by `COINS_PER_MINI_CUBE` (proposed default `0.1`), rounded to 2 decimals. Evidence: `engine.test.ts`, `progression.test.ts`.
- **AC-2 — Per cube reward.** Completing a cube (clearing the sixth face) increases the coin total by `COINS_PER_CUBE` (proposed default `5`), or by `2 × COINS_PER_CUBE` when the speed bonus applies (AC-3). Evidence: `engine.test.ts`.
- **AC-3 — Speed bonus.** If a cube is completed within `thresholdSeconds(gridSize)` seconds of that cube's start, the per-cube reward for that cube is doubled (×2). Evidence: `engine.test.ts` with controlled elapsed time (boundary: exactly at the threshold qualifies).
- **AC-4 — Size-dependent threshold.** `thresholdSeconds(gridSize)` increases with `gridSize`; the proposed default is `gridSize × 5` seconds (grid 3 → 15 s, grid 7 → 35 s). Evidence: `hub.test.ts`, `engine.test.ts`.
- **AC-5 — Coins in HUD.** The HUD renders a pinned line `Coins <value>` with the value formatted to 2 decimals. Evidence: `Hud.test.tsx`.

### Stats

- **AC-6 — Persistent stats for accounts.** For authenticated play, the session's `clicks`, `facesDestroyed`, `cubesDestroyed` and `coins` start from the server-persisted values delivered in `welcome` (not from zero), and subsequent play increments them. Evidence: `session.test.ts`, `engine.test.ts`.
- **AC-7 — Guest stats stay session-local.** Guests start at zero and nothing is persisted; a reload resets them (existing behaviour retained). Evidence: existing tests unchanged.
- **AC-8 — Cubes destroyed counter.** Each completed cube increments `cubesDestroyed` by exactly 1, for both guests and accounts. Evidence: `engine.test.ts`.

### Server authority & persistence

- **AC-9 — Server credits mini-cubes for accounts.** On a validated `explode` for an account member, the server credits `COINS_PER_MINI_CUBE` to that account, increments `clicks` by 1, and increments `facesDestroyed` by 1 when that explode cleared a face (all `N²` ids of that face now removed); persists the new coin total, click count and `facesDestroyed` via an atomic SQL increment (`INSERT … ON CONFLICT (user_id) DO UPDATE SET … = user_economy.<col> + $delta`), and never credits on an invalid/stale explode. Evidence: `hub.test.ts`, `economy-repository.test.ts`.
- **AC-10 — Server credits completion with speed bonus.** On a validated `cubeCompleted` for an account member, the server computes the elapsed time since that cube started using its own clock (and that cube's `gridSize` for the threshold); credits `COINS_PER_CUBE × (2 if elapsed ≤ threshold else 1)`; increments `cubesDestroyed` by 1 and persists. Evidence: `hub.test.ts`.
- **AC-11 — Server totals are authoritative.** `welcome`/`worldEntered`/`economyUpdate` carry the server's persisted totals; the client adopts them as absolute values and never inflates them client-only. Out-of-order delivery of `economyUpdate` messages is an accepted transient risk: a stale (lower) total may briefly overwrite a newer one; the next `welcome` or `economyUpdate` reconciles. No monotonic guard is applied in v1. Evidence: `session.test.ts`, `server-state.test.ts`.
- **AC-12 — Speed bonus uses server clock.** The server uses `cubeStartedAt` (server timestamp) and `now()`; client-supplied timing or level values cannot change the bonus. Evidence: `hub.test.ts` (forged payloads rejected / ignored).
- **AC-13 — Guests are not persisted.** A validated explode/completion for a guest (no account session) performs no database write and no `economyUpdate` broadcast. Evidence: `hub.test.ts`.

### Real-time sync

- **AC-14 — Economy in placement messages.** `welcome` and `worldEntered` carry an `economy: { coins, clicks, facesDestroyed, cubesDestroyed }` field (numbers, 2-decimal coins). Evidence: `protocol.test.ts` (both workspaces).
- **AC-15 — `economyUpdate` message.** The server catalog gains `economyUpdate { coins, clicks, facesDestroyed, cubesDestroyed }`; codec validates all four as numbers. Evidence: `protocol.test.ts` (both workspaces).
- **AC-16 — Client adopts `economyUpdate`.** Receiving `economyUpdate` updates the engine's coins and stats to the carried absolute values; in-flight play is not interrupted. Evidence: `session.test.ts`.
- **AC-17 — Multi-connection sync.** All joined connections of an account (`playerId !== null`), including the originating connection, receive the `economyUpdate` after a credit (best-effort; a connection that is mid-grace receives it on resume via `welcome`). Evidence: `hub.test.ts`.
- **AC-18 — Reconnect reconciles.** A reconnecting account receives its persisted totals in `welcome` and adopts them. Evidence: `session.test.ts`, `hub.test.ts`.

### Containers

- **AC-19 — No containerization impact.** No new service, image, port, env var, health signal, Dockerfile or compose change; the feature runs in the existing backend container and reuses the existing Postgres service and migration path. The only artifact is a new numbered migration file `002_economy.sql` applied on boot. Evidence: `git diff` on container paths empty (plus migration file).

### Testing & coverage

- **AC-20 — Coverage gate.** `npm run coverage` meets ≥ 80% statements/branches/functions/lines in both workspaces with the new modules included and no coverage exclusions. Evidence: coverage report at final gate.

### Guest earning

- **AC-21 — Guests earn locally.** Guests earn coins and increment stats in the session using the same rules (AC-1..AC-4, AC-8); values are session-only. Evidence: `engine.test.ts`.

## Non-goals

- No spending, shop, or upgrades (currency sinks are a future feature).
- No leaderboards, global counters, or cross-account transfers.
- No persistence for guests (no account = no persistence).
- No offline/idle coin accrual while away (coins accrue only during active play in v1).
- No transaction history, receipts, or refunds.
- No multi-currency or premium currency.
- No persistence of the current cube level/board (game state stays in-memory and resets on restart, per `multiplayer-servers` AC-4); only stats/coins persist.
- No changes to game rules, cube logic, multiplayer rebalance, or spectating.
- No new dependency, service, port, or image.

## Boundaries

- ✅ Always: server authority over every economy value for accounts; parameterized SQL only; concrete test assertions; run lint/typecheck/tests/coverage before reporting done; stage only `files_owned` per task; keep `game/**` pure and DOM-free.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation (`COINS_PER_MINI_CUBE`, `COINS_PER_CUBE`, threshold formula, rounding); touching files outside a task's `files_owned` (especially `compose.yaml`, `compose.smoke.yaml`, Dockerfiles, `app.ts` wiring); any coverage exclusion or threshold change; editing `docs/product/vision.md`.
- 🚫 Never: weaken assertions; trust client-supplied timing/coin values; persist guest data; edit predecessor feature specs/plans/tasks; push; change ACs unilaterally.

## Security considerations

- **User-controlled data:** none new beyond the existing auth inputs; economy values are server-derived from validated game events. Client-reported `explode`/`cubeCompleted` are validated against authoritative boards (existing AC-14/AC-15); timing for the speed bonus is server-side only.
- **Persistence integrity:** new `user_economy` table keyed by `user_id` (FK, cascade delete); migration is numbered, idempotent (`CREATE TABLE IF NOT EXISTS`) and applied on boot before listening; a failed migration aborts startup. Repositories are the only DB access path; all SQL parameterized. `credit` MUST use atomic SQL increments (`INSERT … ON CONFLICT (user_id) DO UPDATE SET coins = user_economy.coins + $delta, clicks = user_economy.clicks + $delta, faces_destroyed = user_economy.faces_destroyed + $delta, cubes_destroyed = user_economy.cubes_destroyed + $delta`), never read-modify-write, so concurrent multi-tab credits accumulate (F5).
- **Secrets:** no new secrets; DB credentials already come from env (user-auth). No economy secrets in the bundle.
- **Abuse bounds:** coin credits happen only after server validation; rate limits on explode (30/s) already bound credit frequency; no client can self-credit.
- **Client safety:** frontend computes coins optimistically for UX but server totals reconcile; no coin value is trusted from the client.

## Testing strategy

- **Backend unit (Vitest, node):** `game/economy.test.ts` (constants, threshold formula, rounding helpers), `auth/economy-repository.test.ts` (in-memory + mocked `pg`: CRUD, credit, upsert, atomic increment, concurrency), `game/hub.test.ts` (credit on valid explode/completion, face-clear increments `facesDestroyed`, no credit on invalid, speed bonus boundary with fake clock, multi-connection broadcast including origin, joined-connection filter, guest no-persist), `game/protocol.test.ts` (economy fields + `economyUpdate` codec matrix).
- **Backend integration:** `app.test.ts` extended — account join loads persisted economy; verified-account credit round-trips against an in-memory repo.
- **Frontend unit (Vitest, node):** `game/progression.test.ts` (coins/cubesDestroyed, initial stats), `game/engine.test.ts` (per-mini and per-cube awards, speed bonus timing, adoptEconomy), `multiplayer/protocol.test.ts` (parity), `multiplayer/server-state.test.ts` (economy in welcome/worldEntered/economyUpdate, referential stability, pending swap), `ui/Hud.test.tsx` (coins line).
- **Frontend integration:** `session.test.ts` (welcome adopts economy, economyUpdate updates engine, worldEntered adopts economy, reconnect reconciles).
- **E2E / container:** no smoke change (AC-19); protocol additions are additive and the smoke stays focused on join/overflow/explode/leave.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace; pre-gates per task are workspace-scoped; no exclusions.
- **Assertion bar:** concrete expected values (coin totals to 2 decimals, threshold boundaries, message shapes); no banned wildcard matchers; no snapshot-only or assertion-free tests. GameStats's new fields (`coins`, `cubesDestroyed`) are optional and default to 0 at read sites; tasks that own test files update their expected stat assertions to include the new fields where coins/cubesDestroyed are asserted.

## Real-time impact (contract)

- **Server authority.** The server is the single authority for persisted coins/stats for accounts: it credits on validated events, computes the speed bonus from its own clock, and reconciles clients. Clients compute coins optimistically for UX but never authoritatively.
- **Connection lifecycle.** On join, an account receives persisted totals in `welcome`; on completion/credit, connected account sockets receive `economyUpdate`; on reconnect within grace, `welcome` re-sends persisted totals; grace expiry leaves persistence untouched.
- **Multi-client behavior.** All joined connections of an account receive `economyUpdate` (multi-tab sync), including the originating connection. Concurrent events are serialized server-side in arrival order; credits accumulate via atomic SQL increments.
- **Latency behavior.** Optimistic local coin increments keep the HUD responsive; server totals reconcile on the next `economyUpdate`/`welcome` without interrupting play.
- **Out-of-order delivery.** `economyUpdate` messages may arrive out of order across tabs; a stale (lower) total may briefly overwrite a newer one. This is an accepted transient risk in v1; the next `welcome`/`economyUpdate` reconciles. No monotonic guard is applied (F9).

## Containerization impact

No new services, images, ports, env vars, health signals or compose changes. The feature runs in the existing backend container and reuses the existing Postgres service and migration runner. The only artifact is a new numbered migration file `src/backend/src/db/migrations/002_economy.sql`, applied on boot (idempotent). `podman compose up` and `npm run smoke` are unchanged.

## Open questions

Approval-gated (BLOCKING — must be approved before the named task starts; proposed defaults are used in the interim and flagged in the task):

- **Q-1 (BLOCKING, gate before T1).** Per mini-cube coin amount. Proposed default: `COINS_PER_MINI_CUBE = 0.1`. Alternative: `0.05` / `0.25`. Needs user approval; constant lives in `game/economy.ts`.
- **Q-2 (BLOCKING, gate before T1).** Per cube coin amount. Proposed default: `COINS_PER_CUBE = 5`. Alternative: `10`. Needs approval.
- **Q-3 (BLOCKING, gate before T1).** Speed bonus threshold formula. Proposed default: `thresholdSeconds(gridSize) = gridSize × 5` seconds. Alternative: a tile-count-based formula `(6·gridSize²) / 10` seconds. Needs approval.
- **Q-5 (BLOCKING, gate before T6).** Persisted stats scope. Proposed default: persist `coins`, `clicks`, `facesDestroyed`, `cubesDestroyed`; reset `levelIndex`/board each session. Alternative: also persist `levelIndex`. Needs approval (affects restart UX).

Default-with-notice (resolved as proposed defaults; no approval gate, but flagged):

- **Q-4 (default with notice).** Speed bonus scope. Default: the bonus doubles only the per-cube completion reward (`COINS_PER_CUBE`), not the mini-cube coins already earned during that cube. Alternative: double the entire cube's earned coins.
- **Q-6 (default with notice).** Guest earning. Default: guests earn coins/stats locally and ephemerally (same rules). Alternative: disable economy entirely for guests.
- **Q-8 (default with notice).** Coin precision. Default: 2 decimal places, rounded half-up on every credit. Alternative: integer "cents" internally.
- **Q-10 (default with notice).** `economyUpdate` frequency. Default: server pushes `economyUpdate` after every validated explode and completion for accounts. Alternative: push only on completion (mini-cube credits persisted silently).
- **Q-11 (default with notice).** Multi-tab conflict resolution. Default: server totals are absolute and overwrite local on `economyUpdate`/`welcome`. Alternative: delta merge.

Deferred / non-goal:

- **Q-7 (deferred).** Offline/idle accrual: out of scope for v1 (coins accrue only during active play). Alternative: idle progress for accounts. Deferred to a follow-up.
- **Q-9 (non-goal).** Spending/upgrades: out of scope (non-goal); tracked as a future feature.

## Assumptions

- Accounts are optional and additive (user-auth); guest play remains first-class. Economy persists only for accounts.
- Game state (board, level, position) stays in-memory and resets on restart; only coins/stats persist (AC-19's migration aside).
- The existing Postgres container and migration runner are reused; no new service.
- `COINS_PER_MINI_CUBE`, `COINS_PER_CUBE` and the threshold formula are pinned constants in `game/economy.ts` (not env) unless the user asks for env configurability.
- The frontend's optimistic coin awards use the same constants mirrored in a frontend economy module to keep UX consistent; server totals reconcile.
- `cubesDestroyed` is a cumulative count across sessions for accounts, and a session count for guests.
- Coin rounding uses 2 decimals (half-up) on both client and server.
- `GameStats.coins` and `GameStats.cubesDestroyed` are optional (default 0) to avoid a typecheck ripple across existing literals; read sites coalesce with `?? 0`.

## Supersessions of accepted behaviors

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| `multiplayer-servers` § 5 (stats session-local) | Stats are session-local HUD values, no shared counters | For accounts, stats/coins persist and reload on join (AC-6, AC-9); guests keep session-local | Stats remain HUD values, never shared across members |
| `multiplayer-servers` non-goal "no economy" | Economy explicitly out of scope | Economy added as this feature | All other non-goals |

Predecessor specs/plans/tasks are not edited; supersessions are recorded here by AC/term.

## Revision history

- r1 — 2026-10-28 — initial draft (planning phase).
- r2 — 2026-10-28 — address spec review r1 findings F1..F13: AC-9 now credits `facesDestroyed` on face clear; open questions consolidated (Q-1/Q-2/Q-3/Q-5 approval-gated, Q-4/Q-6/Q-8/Q-10/Q-11 default-with-notice); credit pinned to atomic SQL increments; `Member.economy` + async join load; `economyUpdate` to all joined account connections including origin; `PendingWorldSwap.economy`; `SelfState.economy`; `adoptEconomy` optional; `GameStats` new fields optional; cube-start timestamp ordering and transient out-of-order risk documented; T9 size and docs-pass ownership notes.