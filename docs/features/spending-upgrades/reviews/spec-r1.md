---
feature: spending-upgrades
phase: spec
iteration: 1
verdict: changes_requested
blocking: 5
nonblocking: 8
---

# Spec Review — r1

## Summary

❌ changes requested — 5 blocking findings (1 BLOCKER, 4 MAJOR) plus 8 non-blocking. The spec/plan is largely complete and consistent with coin-economy, but the planned spending SQL contradicts AC-7 (a row is inserted even on rejection), purchase concurrency/level derivation is under-specified, the T8 speed-window formula is mistyped, guest spending has no concrete owner, and `purchaseUpgrade` is not exposed on the session interface the UI will call.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | plan.md § Interfaces / economy repository (Pg `purchaseUpgrade` SQL); tasks.md T2 | The specified SQL begins with `INSERT INTO user_economy ... ON CONFLICT DO NOTHING` before the conditional `UPDATE`. That insert is a DB write that happens even when the purchase is rejected for `insufficient_funds`, directly violating spec AC-7 ("No DB write and no broadcast occur on rejection") and AC-23's no-side-effect expectation. | Rewrite `purchaseUpgrade` to perform only the conditional `UPDATE ... WHERE user_id = $1 AND coins >= $cost RETURNING ...` (no insert), returning `null` when no row is returned; ensure the in-memory implementation mirrors this (no row creation on failure). | open |
| F2 | MAJOR | spec.md § Acceptance criteria AC-8/AC-22; plan.md § Interfaces (hub); tasks.md T4 | The specified atomic update only guards `coins >= $cost`; it does not guard the current upgrade level, and T4 derives `cost`/`newLevel` from the in-memory `Member.upgrades`, which can be stale across tabs or under concurrent requests. A race can therefore overwrite a level (lost increment) or exceed `maxLevel`, and a stale level produces the wrong cost. | Amend AC-8/plan to (a) reload the account's current upgrades from the repository at the start of `handlePurchaseUpgrade`, (b) recompute `cost`/`currentLevel` from that DB value, and (c) add a level guard to the conditional UPDATE (`AND COALESCE((upgrades->>'<id>')::int, 0) = $currentLevel`) so a concurrent purchase cannot clobber the increment. | open |
| F3 | MAJOR | tasks.md T8 (Engine upgrades) | The speed-bonus comparison is mistyped as `speedBonusApplies(cubeElapsedMs, gridSize + speedWindowSeconds(upgrades)*1000)`, i.e. it adds seconds to `gridSize` instead of to the threshold. This would compute the wrong boundary and silently break AC-4. | Correct T8 to compare `cubeElapsedMs <= (thresholdSeconds(gridSize) + speedWindowSeconds(upgrades)) * 1000` (inclusive), and update any helper signature accordingly. | open |
| F4 | MAJOR | spec.md AC-10; plan.md § Data flow 6; tasks.md T9/T10 | Guest spending (Q-5 default "yes, session-only") has no concrete owner: T9 only says guests are "handled locally", but no task states how the engine's coins/upgrades are debited and re-adopted for a guest, nor how the UI learns the current mode to disable the panel if Q-5 resolves to "no". As written, a guest buy button could be a no-op. | Add explicit guest handling to T9 (and T10): on a guest purchase, validate against the mirrored catalog/cost, then call `engine.adoptEconomy` with the debited coin total and `engine.adoptUpgrades` with the incremented level (no message sent); document the mode signal the UI uses to gate the panel. | open |
| F5 | MAJOR | plan.md § Interfaces (Session); tasks.md T9/T11 | `session.purchaseUpgrade(id)` is required by T11's `App.tsx` wiring, but it is not added to `OnlineGameSession` (or an inert offline implementation), so the call will not type-check against the interface the UI consumes. | Add `purchaseUpgrade(upgradeId: string): void` to `OnlineGameSession` with an inert no-op for offline sessions, and route it in `session.ts`. | open |
| F6 | MINOR | spec.md AC-11; plan.md § Protocol (Placement); tasks.md T3/T4 | It is unclear whether `upgrades` is required on `welcome`/`worldEntered` for accounts. `Placement.upgrades?` is optional and the frontend adopts it conditionally, but AC-11 reads as a delivered field; tests cannot assert a single shape. | Pin the wire contract: `upgrades` is always present on `welcome`/`worldEntered` for accounts (possibly `{}`) and optional only for guests, with the frontend adopting it when present. | open |
| F7 | MINOR | plan.md § Interfaces (repository); tasks.md T2 | `findUpgradesByUserId` has no specified return for a missing row (`null` vs `{}`), yet T4's load path and tests depend on it. | Specify the return as `Promise<UpgradeState>` defaulting to `{}` for "no row", and have the hub treat `{}` as "no upgrades" (mirroring the economy zero-default). | open |
| F8 | MINOR | tasks.md T4 | T4's acceptance covers `purchaseUpgrade` validation/broadcast, but the task text does not explicitly require routing the new `purchaseUpgrade` client message in `handleMessage`'s switch, risking a dropped message. | Add an explicit line to T4: route `message.type === 'purchaseUpgrade'` to `handlePurchaseUpgrade(member, connection, message.upgradeId)`. | open |
| F9 | MINOR | plan.md § Interfaces (Engine); spec.md AC-16/AC-17 | `EngineSnapshot.upgrades` is specified as a required field, but `adoptUpgrades` and `adoptEconomy` are optional seams for fake compatibility. Requiring `upgrades` in every snapshot will break pre-existing snapshot fakes that do not carry it. | Either make `EngineSnapshot.upgrades` optional (with `createEngine` always populating it, mirroring `travelKind`/`adoptEconomy`) or explicitly list the snapshot-fake updates in T8. | open |
| F10 | MINOR | spec.md AC-18 | `upgradeCost` returns "Infinity (or a sentinel)" at max level — the parenthetical leaves the sentinel unspecified, so tests cannot assert a single value. | Pin the sentinel to `Infinity` (and state it is never persisted/serialized). | open |
| F11 | MINOR | tasks.md T12; docs/architecture/documentation.md | T12's verification only greps the glossary and its `files_owned` omits the doc-gate evidence (README/architecture/container paths) even though the documentation pass requires confirming no changes there. | Extend T12's verify to include the container diff gate and a "no change" note for `README.md`/`docs/architecture/*`, per `docs/architecture/documentation.md`. | open |
| F12 | INFO | spec.md AC-12; plan.md § Protocol | The codec validates `upgrades` values as "numbers" but upgrade levels are integral; a non-integer level would pass the codec and only fail later. | Optionally tighten the codec to require integer levels (or document that non-integers are rejected by the server as `bad_message`/`max_level`). | open |
| F13 | INFO | tasks.md dependency overview | T4 bundles loading, multipliers, purchase handling, broadcast and placement changes into one task; it is large for a single builder session but feasible. | Consider splitting T4 into "load + multipliers" and "purchase + broadcast" if build time becomes a risk; not required for approval. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks (catalog, effects, spending, persistence, sync, UI, guest, containers, coverage) are covered by ACs or explicit non-goals. |
| Testability | ❌ | AC-18's "Infinity (or a sentinel)" is not binary (F10); AC-7's no-write guarantee is contradicted by the planned SQL (F1). |
| Boundaries | ✅ | Three tiers present; non-goals listed (idle accrual, leaderboards, refunds, etc.). |
| Dependency graph | ✅ | Acyclic; dependencies point at earlier tasks; every AC mapped; T4/T9 are large but acceptable. |
| Parallel safety | ✅ | All `[P]` tasks (T6, T8, T10) own disjoint files; no shared-file contact. |
| Security | ❌ | Planned purchase SQL writes on rejection (F1); level concurrency/stale derivation not guarded (F2). |
| Testing | ✅ | Unit + integration tiers named; commands from `AGENTS.md`; coverage thresholds ≥ 80% referenced; assertion bar stated. |
| Consistency | ❌ | T8 speed-window formula is mistyped (F3); guest flow and session interface gaps (F4, F5). |
| Real-time | ✅ | Connection lifecycle, reconnect, multi-client and server authority are specified; out-of-order risk documented consistently with coin-economy. |
| Containers | ✅ | No new service/image/port/env; migration 003 + schema mirror; container diff gate in T_final. |

## Previous round verification (if iteration > 1)

N/A (iteration 1).

## Notes / backlog (non-blocking)

- Q-1..Q-5 remain approval-gated before T1/T2/T6; proposed defaults are used in the interim and flagged in tasks.
- The documentation pass (T12) should remain minimal (glossary term + proposed feature-index row) per `docs/architecture/documentation.md`; no README/architecture changes are required for this feature.