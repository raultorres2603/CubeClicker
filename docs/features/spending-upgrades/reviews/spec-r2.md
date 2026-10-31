---
feature: spending-upgrades
phase: spec
iteration: 2
verdict: changes_requested
blocking: 1
nonblocking: 4
---

# Spec Review — r2

## Summary

❌ changes requested — r1's 5 blocking findings (F1–F5) and all 8 non-blocking findings (F6–F13) are addressed in revision 2. One new MAJOR remains: the pinned UI mode signal `multiplayerSnapshot.world.self.identity.kind` references a field that does not exist in `WorldState`, and adopting it would break the stated "server-state tests unchanged" assumption and touch files outside any task's `files_owned`. Four minor/info ambiguities also remain.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F14 | MAJOR | plan.md § Interfaces (Session) mode signal; tasks.md T9/T11; spec.md AC-10/AC-19 | The pinned mode signal `multiplayerSnapshot.world.self.identity.kind` references a field that does not exist: `WorldState.SelfState` stores only `playerId`/`name`/`position`/`cube`/`economy` and has no `identity` property, and `identity` is a wire-level `Placement` field the reducer does not persist (see `src/frontend/src/multiplayer/server-state.ts`). Storing it would require adding `identity` to `SelfState`/`PendingWorldSwap` and rewriting the reducer, which conflicts with the plan's "multiplayer/server-state tests unchanged" assumption and would modify files not in any task's `files_owned` (T9 owns `session.ts`, T11 owns `App.tsx`). | Pin a feasible, session-owned mode signal that does not require changing `server-state.ts` — e.g. add a `mode: 'guest' \| 'account'` field to `MultiplayerSnapshot` populated from the last successful `join(mode)`, or expose the joined mode on `OnlineGameSession` — and update the plan's file inventory, T9/T11 acceptance and spec AC-10/AC-19 wording accordingly. | open |
| F15 | MINOR | plan.md § Interfaces (hub) `handlePurchaseUpgrade`; tasks.md T4 | A guest-originated `purchaseUpgrade` frame is unspecified: `handlePurchaseUpgrade` assumes an account member (it reloads upgrades and calls the repo), with no early guard for `member.accountId === null`. As written, a guest sending the message would reach the repository path (or throw) instead of the required no-write/no-broadcast behavior. | Add to T4: `handlePurchaseUpgrade` returns immediately (no repo call, no broadcast; optionally a silent no-op or `error not_authenticated`) when `member.accountId === null`. | open |
| F16 | MINOR | spec.md AC-19; plan.md § Session; tasks.md T10/T11 | Q-9's default (buy button disabled while a purchase request is in flight) requires tracking a pending purchase, but no state or prop is specified for `UpgradesPanel` or the session, and `session.purchaseUpgrade` returns `void`. | Either specify an in-flight seam (`UpgradesPanel` accepts `pendingId?: string \| null` and the session exposes purchase status) or explicitly defer in-flight disabling to a later pass; record the choice in the plan. | open |
| F17 | MINOR | spec.md AC-7; plan.md § Interfaces (hub); tasks.md T4 | The repository's `purchaseUpgrade` returns `null` for three distinct causes (insufficient funds, stale level, missing row), but the hub maps every `null` to `insufficient_funds`. The closed `ErrorCode` set has no concurrency/stale-level code, so a lost race is reported as `insufficient_funds`, which is misleading and not independently testable. | Either add a `stale_level` (or `purchase_conflict`) code to the `ErrorCode` union and the spec's closed set, or document that all `null` results surface as `insufficient_funds`; update AC-7 and the codec matrix accordingly. | open |
| F18 | INFO | tasks.md T4 | T4's prose validates catalog/max-level before mentioning the reload, while the stated invariant is "reload at the start"; the ordering could let an implementation derive `currentLevel`/`cost` from the stale in-memory value. | Reorder T4's bullet so it reads explicitly: reload via `findUpgradesByUserId` first, then derive `currentLevel`/`cost`, then validate catalog/max-level, then call `purchaseUpgrade`. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks (catalog, effects, spending, persistence, sync, UI, guest, containers, coverage) covered by ACs or explicit non-goals. |
| Testability | ✅ | AC-18 sentinel pinned to `Infinity`; AC-7 no-write guarantee now matches the conditional UPDATE; AC-4 boundary inclusive. |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ✅ | Acyclic; dependencies point at earlier tasks; every AC mapped; T4 size noted (F13). |
| Parallel safety | ✅ | `[P]` tasks T6/T8/T10 own disjoint files. |
| Security | ✅ | Conditional UPDATE only (no insert), level guard, reload-before-derive, parameterized SQL. |
| Testing | ✅ | Unit + integration tiers named; commands from `AGENTS.md`; coverage thresholds ≥ 80% referenced; assertion bar stated. |
| Consistency | ❌ | Mode signal references a non-existent `WorldState.SelfState.identity` field (F14). |
| Real-time | ✅ | Connection lifecycle, reconnect, multi-client sync and server authority specified; out-of-order behavior documented consistently with coin-economy. |
| Containers | ✅ | No new service/image/port/env; migration 003 + schema mirror; container diff gate in T12/T_final. |

## Previous round verification (r1 → r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) BLOCKER | fixed | spec.md AC-8 now specifies the conditional `UPDATE ... WHERE user_id = $1 AND coins >= $cost AND COALESCE((upgrades->>'<id>')::int, 0) = $currentLevel` with no insert/upsert and `null` on no row; plan.md SQL block and T2 mirror it. |
| F2 (r1) MAJOR | fixed | spec.md AC-8 requires reloading upgrades at the start of `handlePurchaseUpgrade` and recomputing `cost`/`currentLevel` from the DB value; plan.md § Interfaces (hub) and Key decision 6. |
| F3 (r1) MAJOR | fixed | spec.md AC-4 pins `cubeElapsedMs <= (thresholdSeconds(gridSize) + speedWindowSeconds(upgrades)) * 1000` (inclusive); plan.md data flow 3 and T8 repeat the corrected formula. |
| F4 (r1) MAJOR | fixed | spec.md AC-10 now states the guest validates against the mirrored catalog/cost, then calls `engine.adoptEconomy` + `engine.adoptUpgrades` with no message; plan.md data flow 5 and T9. |
| F5 (r1) MAJOR | fixed | plan.md § Interfaces (Session) and T9 add `purchaseUpgrade(upgradeId): void` to `OnlineGameSession` with an inert offline no-op. |
| F6 (r1) MINOR | fixed | spec.md AC-11 pins `upgrades` always present for accounts (possibly `{}`), optional only for guests; plan.md protocol section. |
| F7 (r1) MINOR | fixed | spec.md Assumptions and plan.md state `findUpgradesByUserId` returns `UpgradeState` defaulting to `{}`; T2. |
| F8 (r1) MINOR | fixed | tasks.md T4 now explicitly routes `message.type === 'purchaseUpgrade'` to `handlePurchaseUpgrade`. |
| F9 (r1) MINOR | fixed | spec.md AC-17 and plan.md make `EngineSnapshot.upgrades` optional on the base contract and required in `OnlineEngineSnapshot`; T8. |
| F10 (r1) MINOR | fixed | spec.md AC-18 pins the sentinel to `Infinity` (client-only, never persisted/serialized); assumptions echo it. |
| F11 (r1) MINOR | fixed | tasks.md T12 verify now includes the container diff gate and a "no change" note for `README.md`/`docs/architecture/*`. |
| F12 (r1) INFO | fixed | spec.md AC-12 and plan.md protocol section validate upgrade levels as integers (non-integer → `bad_message`). |
| F13 (r1) INFO | fixed | tasks.md dependency overview and T4 note record the size rationale; plan.md Risks repeats it. |

## Notes / backlog (non-blocking)

- Q-1..Q-5 remain approval-gated before T1/T2/T6; proposed defaults are used in the interim and flagged in tasks.
- The documentation pass (T12) stays minimal (glossary term + proposed feature-index row) per `docs/architecture/documentation.md`; no README/architecture changes required for this feature.
- F14 should be resolved by the planner before building: it determines whether `server-state.ts` and its tests are touched.<|end|><|start|>assist to=bash<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd /var/home/raultorraco/Documents/Projects/CubeClicker && git status --short