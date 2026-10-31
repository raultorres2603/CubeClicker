---
feature: coin-economy
phase: code
iteration: 1
verdict: changes_requested
blocking: 2
nonblocking: 2
---

# Code Review — r1

## Summary
❌ changes requested — Verification suite and container/doc gates pass (lint/typecheck/test/coverage/build; backend 95.17/85.82/99.62/95.17, frontend 95.21/94.98/96.78/95.21), and most ACs are covered by backend/frontend tests. However, two MAJOR gaps remain: the engine-level economy behavior (per-mini/per-cube rewards, speed-bonus boundary, guest earning, `adoptEconomy`) has no direct `engine.test.ts` coverage despite AC-1..AC-4/AC-8/AC-21 naming it, and existing engine tests were weakened from full stats equality to partial `clicks`/`facesDestroyed` assertions, dropping regression coverage for `coins`/`cubesDestroyed`. Two MINOR items round out the report.

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ⚠️ partial | `progression.test.ts` (recordCoins) + `economy.test.ts` (constants); no direct `engine.test.ts` per-mini reward assertion. |
| AC-2 | ⚠️ partial | `progression.test.ts` (recordCoins) + `economy.test.ts`; no direct `engine.test.ts` per-cube reward assertion. |
| AC-3 | ⚠️ partial | `hub.test.ts` speed-bonus boundary (fast/slow/exact); no direct `engine.test.ts` speed-bonus timing/boundary. |
| AC-4 | ⚠️ partial | `hub.test.ts` (thresholdSeconds(3)=15s); `engine.test.ts` does not exercise `thresholdSeconds`. |
| AC-5 | ✅ | `Hud.test.tsx` coins line (per build log T11). |
| AC-6 | ✅ | `session.test.ts`, `hub.test.ts` (account join loads persisted economy). |
| AC-7 | ✅ | Existing guest tests retained (no persistence). |
| AC-8 | ⚠️ partial | `progression.test.ts` (recordCubeDestroyed); no direct `engine.test.ts` cubesDestroyed increment. |
| AC-9 | ✅ | `hub.test.ts` (credits on valid explode, face-clear increments facesDestroyed, no credit on invalid). |
| AC-10 | ✅ | `hub.test.ts` (fast/slow/boundary completion credits). |
| AC-11 | ✅ | `session.test.ts`, `server-state.test.ts`. |
| AC-12 | ✅ | `hub.test.ts` (forged payloads ignored; server clock). |
| AC-13 | ✅ | `hub.test.ts` (guest no persist/no broadcast). |
| AC-14 | ✅ | `protocol.test.ts` both workspaces. |
| AC-15 | ✅ | `protocol.test.ts` both workspaces. |
| AC-16 | ✅ | `session.test.ts`. |
| AC-17 | ✅ | `hub.test.ts` (multi-connection broadcast including origin). |
| AC-18 | ✅ | `session.test.ts`, `hub.test.ts`. |
| AC-19 | ✅ | Container diff gate empty (build log T_final); migration file only. |
| AC-20 | ✅ | Coverage ≥ 80% both workspaces (build log T_final). |
| AC-21 | ⚠️ partial | `progression.test.ts` helpers; no direct `engine.test.ts` guest earning path. |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | src/frontend/src/game/engine.test.ts (missing) | Engine-level economy behavior — per-mini reward (AC-1), per-cube reward (AC-2), speed-bonus boundary (AC-3), size-dependent threshold (AC-4), cubesDestroyed increment (AC-8), guest earning (AC-21), and `adoptEconomy` (AC-6/AC-16) — has no direct test in `engine.test.ts`, despite the spec naming it as primary evidence. Only helper-level coverage exists (`progression.test.ts`, `economy.test.ts`), so a regression in `engine.ts` award wiring (lines 635–651) could land green. | Add direct `engine.test.ts` cases asserting concrete coin/cubesDestroyed values for per-mini, per-cube (with/without speed bonus at the threshold boundary), guest path, and `adoptEconomy` absolute adoption. | open |
| F2 | MAJOR | src/frontend/src/game/engine.test.ts (throughout) | Existing engine tests were changed from full stats equality to partial `clicks`/`facesDestroyed` assertions (e.g. lines 134, 189, 280, 616, 760, 1341), dropping regression coverage for `coins` and `cubesDestroyed` on every stats-touching path. A change that corrupts those two fields would not fail any test. | Restore `coins`/`cubesDestroyed` to the expected stat objects (or add paired assertions) on the affected engine tests so the new fields are pinned. | open |
| F3 | MINOR | src/backend/src/game/hub.test.ts (lines 1413, 1441, 1542, 1563, 1582, 1626) | Weak `expect(...).toBeDefined()` guards precede field access on possibly-undefined messages; these only assert existence, not concrete values, and rely on subsequent property reads for the real assertion. | Replace with concrete shape/value assertions (or typed narrowing) so a malformed message fails explicitly. | open |
| F4 | MINOR | docs/features/coin-economy/status.md § Blockers / open questions | Status doc still says "none" even though Q-1/Q-2/Q-3/Q-5 are approval-gated (carried from spec review N1). Inconsistent with the spec. | Update status to note the approval-gated questions (or mark resolved with the approved defaults). | open |

## Verification performed
- `npm run lint` → exit 0 (no errors) (build log T_final)
- `npm run typecheck` → exit 0 (both workspaces) (build log T_final)
- `npm test` → backend 531 passed, frontend 1028 passed (build log T_final)
- `npm run coverage` → backend 95.17/85.82/99.62/95.17; frontend 95.21/94.98/96.78/95.21 (≥ 80 all) (build log T_final)
- `npm run build` → exit 0 (build log T_final)
- Container diff gate on `compose.yaml`, `compose.smoke.yaml`, Dockerfiles → empty (build log T_final)
- Doc gate `grep -q "coins" docs/product/glossary.md` → OK (build log T_final)
- Coverage exclusions: only `src/main.tsx` (justified composition root) + test files; no production code excluded (verified `vitest.config.ts`).
- Direct grep: `adoptEconomy` has 0 matches in `engine.test.ts`; no per-mini/per-cube/speed-bonus assertions in `engine.test.ts`.

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Atomic SQL increments, parameterized SQL, no new secrets, server authority over timing; forged payloads ignored (hub.test.ts). |
| Quality | ✅ | No scope creep; container/doc gates pass; only justified coverage exclusion. |
| Testing | ❌ | Missing direct engine-level economy coverage (F1) and weakened stats assertions (F2); weak `toBeDefined` guards (F3). |

## Notes / backlog (non-blocking)
- Q-7 (offline/idle accrual) and Q-9 (spending/upgrades) remain correctly deferred/non-goal.
- Out-of-order `economyUpdate` accepted as transient risk in v1 (no monotonic guard); next `welcome`/`economyUpdate` reconciles.
- F4 is a docs-only inconsistency; does not affect code correctness.