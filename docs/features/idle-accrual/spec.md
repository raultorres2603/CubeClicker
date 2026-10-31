---
feature: idle-accrual
revision: 2
status: draft
created: 2026-10-30
updated: 2026-10-30
---

# Spec — Idle Accrual

## Summary

Add idle (offline) accrual to CubeClicker for authenticated accounts: while an account has no active connection, coins accrue at a server-defined idle rate and are credited in bulk on the next successful join, so returning players are rewarded for time away. Guests remain first-class but receive no idle accrual (no persistence exists for them). The feature builds on the persistent coin balance, upgrades and Postgres path from `coin-economy` and `spending-upgrades`; it introduces no new service, image, port or dependency — only a new numbered migration adding a `last_seen_at` timestamp to `user_economy`. All accrual is server-authoritative: the server computes elapsed time from its own clock and a stored `last_seen_at`, applies the rate and cap, credits atomically, and delivers the resulting totals through the existing `welcome` economy field. Eligibility for accrual is decided atomically by a compare-and-swap on `last_seen_at` so concurrent joins cannot both credit. Design decisions that need user approval (rate, cap, away threshold, upgrade/level interaction) are flagged as open questions with proposed defaults.

## User stories

- As an account holder, I want to earn coins while I am away, so returning to the game feels rewarding.
- As an account holder, I want my idle earnings to reflect my upgrades, so investing in upgrades keeps paying off.
- As a guest, I want to keep playing and earning without an account, so entry stays frictionless (idle accrual is simply not available without persistence).
- As a player with multiple tabs, I want idle accrual to start only when I am truly away, so a background tab does not forfeit progress.

## Acceptance criteria

Verification notes: "backend" = `src/backend`, "frontend" = `src/frontend`. Evidence per AC: a test file asserting concrete values, a command, or an observable step. All tests use concrete expected values (no banned matchers, no useless tests). Commands from `AGENTS.md`.

### Persistence & trigger

- **AC-1 — `last_seen_at` column.** `user_economy` gains `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()` via migration `004_idle_accrual.sql` (mirrored in `schema.sql`); existing rows get a single statement-level timestamp so no retroactive accrual is granted on deploy. Evidence: migration file + `migrate.test.ts`/repository tests.
- **AC-2 — Accrual on join (accounts).** When an account joins and `now − last_seen_at ≥ IDLE_MIN_AWAY_MS`, the server credits `idleCoins(elapsed, upgrades)` to that account before sending `welcome`, and `welcome.economy` carries the post-accrual totals. Evidence: `hub.test.ts`, `app.test.ts`.
- **AC-3 — No accrual for short gaps.** If `now − last_seen_at < IDLE_MIN_AWAY_MS`, no credit occurs (and `idleCoins` yields `0`) and no `economyUpdate` is broadcast; `welcome.economy` equals the persisted totals. Evidence: `hub.test.ts`.
- **AC-4 — Cap.** Elapsed time beyond `IDLE_CAP_MS` does not accrue further; `idleCoins(IDLE_CAP_MS + x, …) === idleCoins(IDLE_CAP_MS, …)`. Evidence: `economy.test.ts`, `hub.test.ts`.
- **AC-5 — Server authority.** `last_seen_at`, elapsed time, rate, cap and the credited amount are computed entirely server-side from the injected clock and the stored timestamp; no client input, message field or cookie value can influence them. Evidence: `hub.test.ts` (forged payloads ignored).

### Rate & interactions

- **AC-6 — Idle rate helper.** `idleCoins(elapsedMs, upgrades)` returns `0` when `elapsedMs < IDLE_MIN_AWAY_MS` (including non-positive elapsed); otherwise it returns `roundCoins(min(elapsedMs, IDLE_CAP_MS) / 1000 * IDLE_COINS_PER_SECOND * idleMultiplier(upgrades))`. Evidence: `economy.test.ts`.
- **AC-7 — Upgrades interaction.** Under the proposed default, `idleMultiplier(upgrades) === miniCubeMultiplier(upgrades)` (Click Power applies; Cube Bonus and speed window do not). Evidence: `economy.test.ts`, `hub.test.ts`.
- **AC-8 — Level interaction.** Under the proposed default, the idle rate does not depend on the current cube level (level resets on reconnect); only upgrades affect it. Evidence: `economy.test.ts`.

### Coins & guests

- **AC-9 — Coins only.** Idle accrual credits `coins` only; `clicks`, `facesDestroyed` and `cubesDestroyed` are unchanged by idle accrual. Evidence: `hub.test.ts`.
- **AC-10 — Guests.** A guest join performs no database write, no accrual and no `economyUpdate` broadcast; `welcome.economy` is present with zero totals for guests (existing behaviour retained) and idle accrual adds nothing for them. Evidence: `hub.test.ts`.

### Last-seen lifecycle

- **AC-11 — Touch on join.** After a successful `join` (whether or not accrual occurred, including a join after grace expiry), the account's `last_seen_at` is set to the server's join time. `rejoin` never touches `last_seen_at`. Evidence: repository tests, `hub.test.ts`.
- **AC-12 — Touch on final disconnect.** When an account's last active connection closes, `last_seen_at` is set to the disconnect time; if another connection for the same account is still active, `last_seen_at` is not changed. Evidence: `hub.test.ts`.
- **AC-13 — Grace expiry.** A member that expires out of the grace window does not overwrite `last_seen_at` set at disconnect (so the away interval includes the grace period). Evidence: `hub.test.ts`.
- **AC-14 — Rejoin within grace.** A rejoin inside the grace window performs no idle accrual (the member is still in memory) and reconciles via the existing `welcome`; it does not touch `last_seen_at`. Evidence: `hub.test.ts`.

### Multi-client & sync

- **AC-15 — Broadcast after accrual.** When accrual credits coins, the server broadcasts `economyUpdate` (absolute totals) to all joined connections of that account, including the joining connection. Evidence: `hub.test.ts`.
- **AC-16 — Reconnect reconciles.** A reconnecting account receives its post-accrual totals in `welcome` and adopts them via the existing client path. Evidence: `session.test.ts` (existing adoption; no client change).

### Concurrency

- **AC-19 — Atomic eligibility (concurrent joins).** Idle eligibility is decided atomically: `touchLastSeen(userId, nowMs, expectedMs)` performs a compare-and-swap on `last_seen_at` (updates only where `last_seen_at IS NOT DISTINCT FROM expectedMs`; inserts when `expectedMs` is `null` and no row exists) and returns whether the row was actually updated. The hub credits idle coins only when the touch succeeds; a concurrent join that loses the race credits nothing. Disconnect touches are unconditional. Evidence: `economy-repository.test.ts`, `hub.test.ts`.

### Containers & coverage

- **AC-17 — No containerization impact.** No new service, image, port, env var, health signal, Dockerfile or compose change; the feature runs in the existing backend container and reuses the existing Postgres service and migration runner. The only artifact is `004_idle_accrual.sql` (plus the `schema.sql` mirror), applied on boot (idempotent). Evidence: `git diff` on container paths empty (plus migration file).
- **AC-18 — Coverage gate.** `npm run coverage` meets ≥ 80% statements/branches/functions/lines in both workspaces with the new modules included and no coverage exclusions. Evidence: coverage report at final gate.

## Non-goals

- No idle accrual for guests (no persistence for guests).
- No client-side idle computation or timer; the server is the only authority.
- No idle accrual of stats (`clicks`, `facesDestroyed`, `cubesDestroyed`) — coins only (open question Q-6).
- No new message type; accrual reuses the existing `welcome.economy` and `economyUpdate` channels.
- No UI/toast for "welcome back" earnings (open question Q-9).
- No changes to active-play earning rules, upgrades effects, or cube logic.
- No persistence of the current cube level/board (game state stays in-memory and resets on restart).
- No new dependency, service, port or image.
- No leaderboards, global counters or cross-account transfers.

## Boundaries

- ✅ Always: server authority over `last_seen_at`, elapsed time, rate, cap and credited amount; parameterized SQL only; concrete test assertions; run lint/typecheck/tests/coverage before reporting done; stage only `files_owned` per task; keep `game/**` pure and DOM-free.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation (`IDLE_COINS_PER_SECOND`, `IDLE_CAP_MS`, `IDLE_MIN_AWAY_MS`, `idleMultiplier`, rounding); the idle constants are approval-gated and T2/T4 must not start with a changed value without approval; touching files outside a task's `files_owned` (especially `compose.yaml`, `compose.smoke.yaml`, Dockerfiles, `app.ts` wiring); any coverage exclusion or threshold change; editing `docs/product/vision.md`.
- 🚫 Never: weaken assertions; trust client-supplied timing/last-seen values; persist guest data; edit predecessor feature specs/plans/tasks; push; change ACs unilaterally.

## Security considerations

- **User-controlled data:** none new. `last_seen_at` is never accepted from the client; elapsed time is derived server-side from the stored timestamp and the injected clock.
- **Persistence integrity:** new `last_seen_at` column via idempotent migration (`ADD COLUMN IF NOT EXISTS` in final form; see migration); repositories are the only DB access path; all SQL parameterized. Idle credit reuses the existing atomic `credit` increment (`INSERT … ON CONFLICT DO UPDATE SET coins = coins + $delta`), never read-modify-write. Eligibility is gated on a successful compare-and-swap touch of `last_seen_at` (AC-19): `touchLastSeen` updates only where `last_seen_at IS NOT DISTINCT FROM` the value read at load time, and the hub credits only when that touch succeeds, so concurrent joins cannot both credit. `credit` itself remains the single atomic increment path.
- **Secrets:** no new secrets; DB credentials already come from env. No idle data in the client bundle beyond the resulting coin totals.
- **Abuse bounds:** `IDLE_CAP_MS` bounds maximum accrual per gap; `IDLE_MIN_AWAY_MS` prevents farming by rapid reconnect; the connection cap and grace window bound join frequency; no client can self-credit or set `last_seen_at`.

## Testing strategy

- **Backend unit (Vitest, node):** `game/economy.test.ts` (idle constants, `idleCoins` including the below-threshold `0` and cap, rounding, upgrade multiplier, level independence), `auth/economy-repository.test.ts` (findLastSeenAt, touchLastSeen unconditional + CAS, upsert, default now, credit preserves `lastSeenAt`, purchaseUpgrade carries `lastSeenAt`), `game/hub.test.ts` (accrual on join above/below threshold, cap, upgrades, guests, atomic eligibility race, multi-tab touch, grace rejoin, broadcast).
- **Backend integration:** `app.test.ts` extended — verified account join with a stale `last_seen_at` accrues and returns post-accrual totals against an in-memory repo.
- **Frontend:** no code change; existing `session.test.ts` economy adoption covers the resulting totals. No new frontend tests required, but the existing suite must stay green.
- **E2E / container:** no smoke change (AC-17); protocol additions are none.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace; pre-gates per task are workspace-scoped; no exclusions.
- **Assertion bar:** concrete expected values (elapsed boundaries, capped totals, coin totals to 2 decimals, message shapes); no banned wildcard matchers; no snapshot-only or assertion-free tests.

## Real-time impact (contract)

- **Server authority.** The server is the sole authority for `last_seen_at`, elapsed time, rate, cap and credited coins. Clients never compute or report idle progress.
- **Connection lifecycle.** Accrual is evaluated on a successful `join` (including a join after grace expiry) using the stored `last_seen_at`; `last_seen_at` is touched on a successful join (including after grace expiry) and on the final disconnect. A rejoin inside the grace window performs no accrual (the member stays in memory) and never touches `last_seen_at`. Grace expiry does not overwrite `last_seen_at` set at disconnect.
- **Multi-client behavior.** Idle accrual starts only when an account has no active joined connections; closing one tab while another stays active does not touch `last_seen_at`. When accrual credits coins, `economyUpdate` is broadcast to all joined account connections (including origin) so tabs reconcile.
- **Latency behavior.** Accrual adds repository reads/writes to the join path (already async); `welcome` is sent after accrual completes, so the client never sees pre-accrual totals.
- **Out-of-order delivery.** `economyUpdate` messages may arrive out of order across tabs; a stale total may briefly overwrite a newer one; the next `welcome`/`economyUpdate` reconciles (consistent with coin-economy). No monotonic guard in v1.
- **Identity vs. "no accounts".** Accounts are optional and additive; idle accrual is account-only by necessity (no persistence for guests). This is an intentional asymmetry with the vision's "no account required to play" principle and is flagged as open question Q-8 (default: accounts only).

## Containerization impact

No new services, images, ports, env vars, health signals or compose changes. The feature runs in the existing backend container and reuses the existing Postgres service and migration runner. The only artifacts are a new numbered migration `src/backend/src/db/migrations/004_idle_accrual.sql` (plus the `schema.sql` mirror), applied on boot (idempotent). `podman compose up` and `npm run smoke` are unchanged.

## Open questions

Approval-gated (BLOCKING — must be approved before the named task starts; proposed defaults are used in the interim and flagged in the task):

- **Q-1 (BLOCKING, gate before T2/T4).** Idle accrual rate. Proposed default: `IDLE_COINS_PER_SECOND = 0.01`. Alternative: `0.05` / `0.001`. Needs user approval; constant lives in `game/economy.ts`.
- **Q-2 (BLOCKING, gate before T2/T4).** Accrual cap. Proposed default: `IDLE_CAP_MS = 8 * 60 * 60 * 1000` (8 hours). Alternative: 24 hours. Needs approval.
- **Q-3 (BLOCKING, gate before T4).** Minimum away threshold. Proposed default: `IDLE_MIN_AWAY_MS = 60 * 1000` (1 minute). Alternative: 5 minutes. Prevents accrual on brief disconnects/reconnects. Needs approval.
- **Q-4 (BLOCKING, gate before T2/T4).** Upgrades interaction. Proposed default: `idleMultiplier(upgrades) = miniCubeMultiplier(upgrades)` (Click Power applies; Cube Bonus and speed window do not). Alternative: a dedicated idle upgrade or all upgrades. Needs approval.
- **Q-5 (BLOCKING, gate before T4).** Level interaction. Proposed default: idle rate independent of the current cube level (upgrades only), because level resets on reconnect. Alternative: scale by `levelIndex + 1`. Needs approval.

Default-with-notice (resolved as proposed defaults; no approval gate, but flagged):

- **Q-6 (default with notice).** Idle scope. Default: coins only; `clicks`, `facesDestroyed`, `cubesDestroyed` are not incremented by idle. Alternative: also increment stats at a derived rate.
- **Q-7 (default with notice).** Multi-connection away detection. Default: accrual starts only when an account has no active joined connections; `last_seen_at` is touched on the final disconnect. Alternative: per-connection timers.
- **Q-8 (default with notice).** Guest behaviour. Default: guests receive no idle accrual (no persistence); no client-side timer. Alternative: local-only idle while a tab stays open (not "away").
- **Q-9 (default with notice).** UI. Default: no new UI; accrued totals arrive via the existing `welcome.economy` adoption. Alternative: a "welcome back" toast showing accrued coins.
- **Q-10 (default with notice).** Rounding. Default: round the total idle credit once (half-up, 2 decimals), not per second. Alternative: per-second rounding.
- **Q-11 (default with notice).** Active-credit touching. Default: active play credits do not update `last_seen_at` (it is touched only on join and final disconnect). Alternative: touch on every credit. Note: under this default a non-graceful termination (crash) can over-credit up to `IDLE_CAP_MS` for time that was actually active play; this is accepted. A heartbeat-based touch is a possible future improvement.

## Assumptions

- Accounts are optional and additive (user-auth); guest play remains first-class. Idle accrual is account-only.
- Game state (board, level, position) stays in-memory and resets on restart; only coins/stats/upgrades persist (idle accrual adds `last_seen_at`).
- Existing Postgres container and migration runner are reused; no new service.
- Rate constants are pinned in backend `game/economy.ts` (not env) unless the user asks for env configurability; the frontend does not compute idle.
- `last_seen_at` defaults to `now()` for new and migrated rows, so deploy grants no retroactive accrual.
- Idle accrual is evaluated on `join` only; `rejoin` inside the grace window performs none.
- `credit` remains the single atomic increment path; idle accrual reuses it.
- `last_seen_at` is touched only on a successful `join` (including after grace expiry) and on the final disconnect; `rejoin` never touches it; grace expiry does not overwrite it.
- Rate constants (`IDLE_COINS_PER_SECOND`, `IDLE_CAP_MS`, `IDLE_MIN_AWAY_MS`, `idleMultiplier`, rounding) are approval-gated; T2/T4 must not start with a changed value without approval.
- A non-graceful termination (crash) can leave `last_seen_at` at the last touch, so the next join may over-credit idle coins for time that was actually active play, up to `IDLE_CAP_MS`; this is accepted under Q-11's default. A heartbeat-based touch is a possible future improvement.

## Supersessions of accepted behaviors

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| `coin-economy` non-goal "No offline/idle coin accrual while away" (Q-7 deferred) | Coins accrue only during active play | Idle accrual for accounts on join (AC-2..AC-4, AC-19) | Active-play earning rules unchanged; guests still receive no accrual |
| `spending-upgrades` non-goal "No idle/offline accrual" (Q-11 deferred) | No idle accrual | Idle accrual for accounts on join (AC-2..AC-4) | Spending/upgrade rules unchanged; idle rate uses `miniCubeMultiplier` by default (Q-4) |

Predecessor specs/plans/tasks are not edited; supersessions are recorded here by AC/term.

## Revision history

- r1 — 2026-10-30 — initial draft (planning phase).
- r2 — 2026-10-30 — address spec review r1 findings F1..F13: F1 atomic eligibility via compare-and-swap touch (AC-19); F2 guest `welcome.economy` retained with zeros (AC-10); F3 `idleCoins` returns 0 below threshold (AC-6); F4 in-memory credit preserves `lastSeenAt`; F5 `StoredRow.lastSeenAt: number | null` + repo signatures/conversion; F6 supersessions section; F7 T2 depends_on T1; F8 touch only on successful join/final disconnect, rejoin never; F9 shared clock note; F10 statement-level migration timestamp; F11 touch→credit→broadcast→welcome ordering; F12 approval-gated constants note; F13 crash over-credit note in Q-11/Assumptions.