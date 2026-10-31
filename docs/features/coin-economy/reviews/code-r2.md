---
feature: coin-economy
phase: code
iteration: 2
verdict: approved
blocking: 0
nonblocking: 2
---

# Code Review — r2

## Summary
✅ approved — All 21 acceptance criteria are now met with direct evidence (AC-1..AC-4/AC-8/AC-21 via new direct `engine.test.ts` cases); prior r1 findings F1–F4 are fixed. Verification suite passes across both workspaces (lint/typecheck/test/coverage/build), container and doc gates are clean, and coverage exceeds thresholds (backend 95.17/85.82/99.62/95.17; frontend 95.23/94.98/96.78/95.23). Only three minor observations remain, none blocking.

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `engine.test.ts` (per-mini reward, concrete coin values); `progression.test.ts` (recordCoins). |
| AC-2 | ✅ | `engine.test.ts` (per-cube reward, with/without speed bonus); `economy.test.ts` constants. |
| AC-3 | ✅ | `engine.test.ts` (speed-bonus boundary incl. exact threshold qualifies); `hub.test.ts` (fast/slow/exact). |
| AC-4 | ✅ | `engine.test.ts` (threshold boundary grid 3 & grid 7); `hub.test.ts` (`thresholdSeconds(3)=15s`). |
| AC-5 | ✅ | `Hud.test.tsx` coins line (per build log). |
| AC-6 | ✅ | `session.test.ts`, `hub.test.ts` (account join loads persisted economy); `engine.test.ts` (`adoptEconomy`). |
| AC-7 | ✅ | Existing guest tests retained (no persistence). |
| AC-8 | ✅ | `engine.test.ts` (cubesDestroyed increment by exactly 1). |
| AC-9 | ✅ | `hub.test.ts` (credits on valid explode, face-clear increments facesDestroyed, no credit on invalid). |
| AC-10 | ✅ | `hub.test.ts` (fast/slow/boundary completion credits with server clock). |
| AC-11 | ✅ | `session.test.ts`, `server-state.test.ts` (server totals authoritative, adopt absolute). |
| AC-12 | ✅ | `hub.test.ts` (forged payloads ignored; server clock). |
| AC-13 | ✅ | `hub.test.ts` (guest no persist/no broadcast). |
| AC-14 | ✅ | `protocol.test.ts` both workspaces (economy in welcome/worldEntered). |
| AC-15 | ✅ | `protocol.test.ts` both workspaces (`economyUpdate` codec). |
| AC-16 | ✅ | `session.test.ts` (adopts economyUpdate); `engine.test.ts` (adoptEconomy). |
| AC-17 | ✅ | `hub.test.ts` (multi-connection broadcast including origin). |
| AC-18 | ✅ | `session.test.ts`, `hub.test.ts` (reconnect reconciles). |
| AC-19 | ✅ | Container diff gate empty (build log); migration file only. |
| AC-20 | ✅ | Coverage ≥ 80% both workspaces (see Verification performed). |
| AC-21 | ✅ | `engine.test.ts` (guest earning path, session-only). |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | src/frontend/src/game/engine.test.ts (was missing) | Engine-level economy behavior (per-mini reward, per-cube reward, speed-bonus boundary, size-dependent threshold, cubesDestroyed increment, guest earning, `adoptEconomy`) had no direct test despite AC-1..AC-4/AC-8/AC-21 naming it. | Add direct `engine.test.ts` cases asserting concrete coin/cubesDestroyed values. | fixed |
| F2 | MAJOR | src/frontend/src/game/engine.test.ts (throughout) | Existing engine tests were weakened from full stats equality to partial `clicks`/`facesDestroyed` assertions, dropping regression coverage for `coins`/`cubesDestroyed`. | Restore `coins`/`cubesDestroyed` paired assertions on all 38 stats-touching engine tests. | fixed |
| F3 | MINOR | src/backend/src/game/hub.test.ts (lines 1413, 1441, 1542, 1563, 1582, 1626) | Weak `expect(...).toBeDefined()` guards preceded field access on possibly-undefined messages. | Replace with concrete `.type` assertions. | fixed |
| F4 | MINOR | docs/features/coin-economy/status.md § Blockers / open questions | Status doc said "none" despite Q-1/Q-2/Q-3/Q-5 approval-gated. | Update status to note Q-1..Q-5 resolved with approved defaults. | fixed |

## Verification performed
- `npm run lint` → exit 0 (no errors)
- `npm run typecheck` → exit 0 (both workspaces)
- `npm test` → backend 531 passed, frontend 1037 passed
- `npm run coverage` → backend 95.17/85.82/99.62/95.17; frontend 95.23/94.98/96.78/95.23 (≥ 80 all)
- `npm run build` → exit 0 (both workspaces)
- Container diff gate on `compose.yaml`, `compose.smoke.yaml`, Dockerfiles → empty (no changes)
- Doc gate `grep -q "coins" docs/product/glossary.md` → OK
- Coverage exclusions: only `src/main.tsx` (justified composition root) + test files; no production code excluded
- Direct grep: `adoptEconomy` now present in `engine.test.ts` (lines 2003+); per-mini/per-cube/speed-bonus assertions present

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Atomic SQL increments, parameterized SQL, no new secrets, server authority over timing; forged payloads ignored. |
| Quality | ✅ | No scope creep; container/doc gates pass; only justified coverage exclusion. |
| Testing | ✅ | All ACs have direct evidence; engine-level economy coverage added; weak `toBeDefined` guards replaced with concrete assertions. |

## Previous round verification (r1)
| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | fixed | `engine.test.ts` now contains per-mini, per-cube (with/without speed bonus), threshold boundary (grid 3 & 7), guest earning, and `adoptEconomy` cases (build log codefix2). |
| F2 (r1) | fixed | `coins`/`cubesDestroyed` paired assertions restored on all 38 stats-touching engine tests (build log codefix2). |
| F3 (r1) | fixed | 5 weak `expect(...).toBeDefined()` guards in `hub.test.ts` replaced with concrete `.type` assertions (build log codefix2). |
| F4 (r1) | fixed | `status.md` Blockers/open questions updated to note Q-1..Q-5 resolved with approved defaults. |

## Notes / backlog (non-blocking)
- Q-7 (offline/idle accrual) and Q-9 (spending/upgrades) remain correctly deferred/non-goal.
- Out-of-order `economyUpdate` accepted as transient risk in v1 (no monotonic guard); next `welcome`/`economyUpdate` reconciles.
- Non-blocking observations: (1) `hub.ts` dereferences possibly-undefined `registry.servers().find(...)` results (lines 251, 311) without an explicit null guard; (2) `docs/features/coin-economy/status.md` has no trailing newline; (3) `docs/features/README.md` row update pending orchestrator (ownership respected).
- F4 is a docs-only inconsistency; does not affect code correctness.