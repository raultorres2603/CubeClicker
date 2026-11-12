---
feature: frontend-delivery-hardening
phase: spec_review
round: 3
iteration: 3
verdict: changes_requested
reviewed: 2026-11-12
blocking: 1
nonblocking: 2
---
# Spec Review — r3

## Summary

❌ changes requested — 1 BLOCKER, 1 MINOR, 1 INFO. The r3 **planner artifacts** are consistent: `spec.md`, `plan.md`, `tasks.md`, and `status.md` use the approved **initial ≤ 150,000 B / three ≤ 165,000 B / total ≤ 300,000 B gzip**, and 140,000 appears only as historical root-cause/revision context. The fresh T3 measurement is accurately recorded (entry `assets/index-Cu7lmcVH.js`, initial `[index, react]` 95,903 B, three `assets/three-4rmoIDEa.js` 154,323 B, total 273,854 B), and the root cause is correct: the audit's 131,382 B was the **unminified** `three.module.js`, while the minified production chunk compresses to 154,323 B despite a smaller raw size (609,337 B vs 662,772 B). The "future overrun blocks, never silently raise" rule remains in AC-6, Q-1, the plan risk, T3, and the status.

However, the **active T3 implementation still pins 140,000 B** in `scripts/check-bundle-budget.mjs:22`, `scripts/check-bundle-budget.d.mts:7`, and `src/build/bundle-budget.test.ts:51,172,181,185,248`. The script therefore still exits 1 on the fresh `three = 154,323 B > 140,000 B`. The exact fix-up is already specified in `tasks.md:44`, but it has not been applied; per the review constraint, this state cannot be approved.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | `src/frontend/scripts/check-bundle-budget.mjs:22`, `src/frontend/scripts/check-bundle-budget.d.mts:7`, `src/frontend/src/build/bundle-budget.test.ts:51,160,167,172,181,185,248` | The r3 approved `threeGzipBytes` ceiling is 165,000 B, but the active gate, declaration, and test still pin `140000`: `BUDGETS.threeGzipBytes`, the `.d.mts` literal type, `BUDGET_VALUES`, the three-over fixture/message (`140001`/`140000`), the total-over fixture, and the `formatReport` expected text. The fresh build measures 154,323 B, so `npm run build` still exits 1 and the test enforces the superseded ceiling. The planner's fix-up is specified but not applied. | Apply the `tasks.md:44` T3 fix-up: set `BUDGETS.threeGzipBytes` and the `.d.mts` literal to `165000`; update `BUDGET_VALUES` (`:51`), the three-over fixture/message to 165001/165000 (`:160`, `:167`, `:172`), replace the total-over fixture (`:181`, `:185`) with e.g. initial 100000, three 165000, runtime 35001 → 300001, and the `formatReport` expected `budget=165000` (`:248`); ensure no active test value still says 140000. Re-run the T3 verify and `npm run build`; confirm the gate exits 0 with 95,903 / 154,323 / 273,854 and record the fresh report in `build-log-T3.md`. | open |
| F2 | MINOR | `status.md:43` | The status bullet says "Planner revision r2 applied; spec review round 2 pending", which contradicts the r3 frontmatter (`spec_review_round: 3`) and the r3 loop-log entry. | Update it to "Planner revision r3 applied; spec review round 3 pending" (or remove the stale line) in the same status edit. | open |
| F3 | INFO | `build-log-T3.md:300`, `spec.md:120`, `plan.md:270` | The blocked report says "≈6.9% headroom over 154,323 B"; the spec/plan Q-1 says 10,677 B / 6.5% headroom. Both are arithmetically correct: 10,677 / 154,323 = 6.9% (measured-relative), 10,677 / 165,000 = 6.5% (ceiling-relative). | No change required; optionally standardize the denominator in the historical build-log recommendation. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ❌ | The planner artifacts cover the approved budget correction, but the active gate/test still says 140,000 (F1); the blocker fix is specified in `tasks.md:44` and remains to be applied. |
| Testability | ❌ | The updated plan's ACs/tests are binary, but the active `bundle-budget.test.ts` still pins the superseded 140,000 ceiling (F1). After the specified fix-up, the test is the guard for the 165,000 ceiling. |
| Boundaries | ✅ | The r3 change is limited to the budget ceiling, the measured values/root cause, and the T3 fix-up notes; no application, protocol, container-path, or feasibility boundary changed. |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → T5 is unchanged and acyclic; all tasks remain `[seq]`; F1 is a T3 fix-up within its scope, not a new task. |
| Parallel safety | ✅ | No `[P]`; `files_owned` sets are unchanged and disjoint; T3 remains the sole owner of the budget script/declaration/test/package files. |
| Security | ✅ | The budget/report/nginx changes still expose names, paths, and byte counts only; no secrets, source maps, or environment values; the r3 revision adds no dependency or runtime surface. |
| Testing | ❌ | The fresh gate is implemented and the unit suite passes, but it passes against the old 140,000 budget; the active build still exits 1 at 154,323 B (F1). The re-run must prove the 165,000 gate passes. |
| Consistency | ❌ | The planner artifacts are consistent at 165,000, but the active script/declaration/test remain at 140,000 (F1), and `status.md:43` still says r2/round 2 (F2). |
| Real-time | ✅ N/A | The r3 revision changes no WebSocket, shared-state, identity, or reconnection behavior; the accepted adaptive-render-budget-v2 gate-close intro timing and attach/dispose contract are unchanged. |
| Containers | ✅ | The r3 revision changes no service, image, port, environment, or endpoint; the smoke-only `frontend-prod` and the nginx delivery plan are unchanged. |

## Previous round verification

| Check | Status | Evidence |
| --- | --- | --- |
| r1 F1–F4 / r2 findings | ✅ still fixed | The r2 approval and its intro-timing, readiness, ceiling, and summary-byte fixes are unchanged. The r3 revision history (`spec.md:148`, `plan.md:285`, `tasks.md:17`) states that no other AC, task order, scope, or accepted adaptive behavior changed. |
| r2 Q-1 defaults | superseded by the r3 user decision | The r2 Q-1 initial/three/total defaults were 150,000 / 140,000 / 300,000 B. The user approved three = 165,000 B; initial and total are unchanged (`status.md:31`, `:34`; `spec.md:120`; `plan.md:270`). |
| Fresh measured values | ✅ accurate | `build-log-T3.md` § Fresh values records entry `assets/index-Cu7lmcVH.js`, initial `["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]` 95,903 B, three `assets/three-4rmoIDEa.js` 154,323 B, total 273,854 B; the spec/plan/tasks use the same values. |
| Root cause | ✅ accurate | The audit's `662,772 B / 131,382 B gzip` is the unminified `three.module.js`; Node zlib level 6 reproduces 131,517 B (≈135 B audit/tool difference), while the minified production chunk is 609,337 B raw / 154,323 B gzip (`build-log-T3.md:260-280`). |
| Active BUDGETS/.d.mts/tests | ❌ not updated | F1: the active script, declaration, and test still say 140,000; `npm run build` still exits 1 on 154,323 > 140,000. |
| No other AC/task/scope change | ✅ | AC-1–AC-4, AC-7–AC-11, the T1–T5 graph, the `files_owned` sets, and the accepted adaptive-render-budget-v2 behavior are unchanged; only the budget ceiling, measured values/root cause, T3 fix-up notes, and status were revised. |
| Future-overrun rule | ✅ | AC-6 (`spec.md:34`) and Q-1 (`spec.md:120`) state that a future overrun stops/blocks and requires an orchestrator-approved spec revision; the plan risk (`plan.md:203`), T3 notes (`tasks.md:44`), and status Q-1 (`status.md:34`) repeat "never silently raise". |

## Minimum remaining revisions

The only blocking revision is **F1**; no further planner revision is needed, because `tasks.md:44` already specifies the exact fix-up:

1. Set `BUDGETS.threeGzipBytes` to `165000` in `src/frontend/scripts/check-bundle-budget.mjs:22`.
2. Set the literal type to `165000` in `src/frontend/scripts/check-bundle-budget.d.mts:7`.
3. Update `src/frontend/src/build/bundle-budget.test.ts`: `BUDGET_VALUES` to 165000 (`:51`); the three-over fixture/message to 165001/165000 (`:160`, `:167`, `:172`); replace the total-over fixture (`:181`, `:185`) so no active test value says 140000; and the `formatReport` expected `budget=165000` (`:248`).
4. Re-run the T3 verify (`npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`, `npm run build`) and record the passing gate with 95,903 / 154,323 / 273,854 in `build-log-T3.md`.

Non-blocking correction: update the stale `status.md:43` r2/round-2 line (F2) in the same status edit. The F3 percentage note requires no action.

## Notes / backlog (non-blocking)

- **Planner artifacts are complete.** Every active planner reference to the ceiling is 165,000 (`spec.md:33`, `:34`, `:103`, `:120`; `plan.md:13`, `:135`, `:193`, `:203`, `:245`, `:270`; `tasks.md:44`, `:73`); the 140,000 occurrences in `spec.md:34`, `:120`, `:148`, `plan.md:193`, `:203`, `:245`, `:270`, `:285`, `tasks.md:17`, `:44`, `status.md:30`, the blocked-run build log, and the r1/r2 reviews are historical root-cause/revision context.
- **The build log's 140,000 lines are historical.** `build-log-T3.md` § Blocked report and its `bundle-report.json`/`budget=140000` output record the failed run before the r3 decision; they should remain as evidence, not be rewritten.
- **Measured values and root cause are accurate.** The fresh `npm run build` output records the same entry/initial/three/total values as the planner artifacts, and the unminified-vs-minified explanation is reproducible from `node_modules/three/build/three.module.js` (662,772 raw / 131,517 B level-6 gzip) versus the minified `dist/assets/three-4rmoIDEa.js` (609,337 raw / 154,323 B gzip).
- **The strict `>` rule is consistent.** The gate passes values exactly at a ceiling and fails only above it; the proposed total-over fixture (initial 100000, three 165000, runtime 35001 → 300001) preserves the total-only violation while keeping both individual ceilings exactly met.
- **The accepted adaptive-render-budget-v2 behavior is untouched.** AC-3, Q-4, A-10, and the Supersessions section are unchanged from r2; the r3 revision history scopes the change to the budget ceiling, measured values/root cause, T3 fix-up, and status updates.
- **T3 can resume after F1.** The planner artifacts are ready; the builder can apply the specified literal/test update and re-run the gate without a further planner revision. Until then, the active `npm run build` remains red and the feature cannot be accepted.
