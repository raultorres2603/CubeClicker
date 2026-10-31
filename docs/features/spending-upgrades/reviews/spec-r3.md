---
feature: spending-upgrades
phase: spec
iteration: 3
verdict: approved
blocking: 0
nonblocking: 0
---

# Spec Review — r3

## Summary

✅ approved — revision 3 addresses all prior findings (F1–F13 from r1, F14–F18 from r2). The pinned UI mode signal now uses a session-owned `MultiplayerSnapshot.mode` (no `server-state.ts` changes); guest early guard, deferred in-flight disabling, null→`insufficient_funds` mapping, and reload-first ordering in T4 are all specified. No open BLOCKER or MAJOR remains.

## Findings

No open findings.

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks (catalog, effects, spending, persistence, sync, UI, guest, containers, coverage) covered by AC-1..AC-24 or explicit non-goals. |
| Testability | ✅ | ACs binary-testable with concrete values; AC-4 inclusive boundary pinned; AC-18 `Infinity` sentinel pinned; AC-7 null→`insufficient_funds` mapping pinned. |
| Boundaries | ✅ | Three tiers present (✅/⚠️/🚫); non-goals listed. |
| Dependency graph | ✅ | Acyclic; dependencies point at earlier tasks; every AC (1–24) mapped in tasks; T4 size noted (F13). |
| Parallel safety | ✅ | `[P]` tasks T6/T8/T10 own disjoint files. |
| Security | ✅ | Conditional UPDATE only (no insert), level guard, reload-before-derive, parameterized SQL, guest early guard. |
| Testing | ✅ | Unit + integration tiers named; commands from `AGENTS.md`; coverage ≥ 80% referenced; assertion bar stated. |
| Consistency | ✅ | Aligns with vision/stack; reuses existing architecture; no contradiction with `AGENTS.md`. |
| Real-time | ✅ | Connection lifecycle, reconnect, multi-client sync, server authority, out-of-order behavior specified; mode signal is session-owned (no `server-state.ts` change). |
| Containers | ✅ | No new service/image/port/env; migration 003 + schema mirror; container diff gate in T12/T_final. |

## Previous round verification (r1 → r2 → r3)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) BLOCKER | fixed | spec.md AC-8 conditional `UPDATE ... WHERE user_id = $1 AND coins >= $cost AND COALESCE((upgrades->>'<id>')::int, 0) = $currentLevel` (no insert/upsert, `null` on no row); plan.md SQL block; tasks T2. |
| F2 (r1) MAJOR | fixed | spec.md AC-8 reloads upgrades at start and recomputes cost/currentLevel from DB; plan.md § Interfaces (hub) + Key decision 6; tasks T4. |
| F3 (r1) MAJOR | fixed | spec.md AC-4 pins `cubeElapsedMs <= (thresholdSeconds(gridSize) + speedWindowSeconds(upgrades)) * 1000` (inclusive); tasks T4/T8. |
| F4 (r1) MAJOR | fixed | spec.md AC-10 concrete guest path (validate catalog/cost, then `adoptEconomy` + `adoptUpgrades`, no message); plan.md data flow 5; tasks T9. |
| F5 (r1) MAJOR | fixed | plan.md § Interfaces (Session) adds `purchaseUpgrade(upgradeId): void` to `OnlineGameSession` (inert offline no-op); tasks T9. |
| F6 (r1) MINOR | fixed | spec.md AC-11 `upgrades` always present for accounts (possibly `{}`), optional only for guests; plan.md protocol. |
| F7 (r1) MINOR | fixed | spec.md Assumptions + plan.md state `findUpgradesByUserId` returns `UpgradeState` defaulting to `{}`; tasks T2. |
| F8 (r1) MINOR | fixed | tasks.md T4 explicitly routes `message.type === 'purchaseUpgrade'` to `handlePurchaseUpgrade`. |
| F9 (r1) MINOR | fixed | spec.md AC-17 `EngineSnapshot.upgrades` optional on base, required in `OnlineEngineSnapshot`; tasks T8. |
| F10 (r1) MINOR | fixed | spec.md AC-18 pins sentinel to `Infinity` (client-only, never persisted/serialized). |
| F11 (r1) MINOR | fixed | tasks.md T12 verify includes container diff gate and "no change" note for `README.md`/`docs/architecture/*`. |
| F12 (r1) INFO | fixed | spec.md AC-12 + plan.md protocol validate upgrade levels as integers (non-integer → `bad_message`). |
| F13 (r1) INFO | fixed | tasks.md dependency overview + T4 note record size rationale; plan.md Risks. |
| F14 (r2) MAJOR | fixed | spec.md AC-10/AC-19 use session-owned `MultiplayerSnapshot.mode: 'guest' \| 'account'` (populated from last successful `join(mode)`, default `'guest'`); no `server-state.ts` change; plan.md § Session + Key decision 16; tasks T9/T11; spec.md Assumptions line 154. |
| F15 (r2) MINOR | fixed | plan.md § Interfaces (hub) + tasks T4: `handlePurchaseUpgrade` early-returns when `member.accountId === null` (no repo call, no broadcast). |
| F16 (r2) MINOR | fixed | spec.md Assumptions line 153 + plan.md § Session + Key decision 18 + tasks T10: in-flight disabling deferred (`UpgradesPanel` has no `pendingId`, `session.purchaseUpgrade` stays `void`). |
| F17 (r2) MINOR | fixed | spec.md AC-7 states any `null` repo result is reported as `insufficient_funds`; plan.md hub + tasks T4 echo the mapping. |
| F18 (r2) INFO | fixed | tasks.md T4 bullet reordered: reload via `findUpgradesByUserId` first, then derive `currentLevel`/`cost`, then validate catalog/max-level, then call `purchaseUpgrade`. |

## Notes / backlog (non-blocking)

- Q-1..Q-5 remain approval-gated before T1/T2/T6; proposed defaults are used in the interim and flagged in tasks.
- The documentation pass (T12) stays minimal (glossary term + proposed feature-index row) per `docs/architecture/documentation.md`; no README/architecture changes required for this feature; `docs/features/README.md` is orchestrator-owned.
- F14 resolution keeps `server-state.ts` and its tests untouched, consistent with task `files_owned`.
- No containerization, dependency, or port changes; migration `003_upgrades.sql` + `schema.sql` mirror only.