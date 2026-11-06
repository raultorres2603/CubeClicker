---
feature: spaceship-customization-minor-fixes
phase: spec
iteration: 1
verdict: approved
blocking: 0
nonblocking: 1
---

# Spec Review — r1

## Summary

✅ approved — Spec/plan/tasks cover both parent MINOR findings (F1 protocol type alignment across both mirrors; F2 engine grant defensive copy) with binary, evidence-able ACs; dependency graph is acyclic and parallel-safe; real-time/container scope correctly declared out of scope. One non-blocking mechanical note (unused import after cast removal) recorded.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | plan.md § Key decisions (3) / src/frontend/src/game/session.ts:96 | `plan.md` says to keep session.ts logic unchanged apart from the read, but removing the two `(message as { customization?: CustomizationState })` casts leaves `CustomizationState` (imported on line 96) with no remaining reference, which can trip `@typescript-eslint/no-unused-vars` and fail AC-5's `npm run lint` gate. | In the same edit that removes the casts, drop `CustomizationState` from the `import type { … } from './types'` line (unless another reference remains), so lint stays green. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Both parent code-r1 MINORs (F1, F2) are covered by AC-1..AC-4; F3 correctly excluded as non-goal; no scope invented. |
| Testability | ✅ | Each AC is binary and evidence-able (compile, grep for casts, reference inequality, coverage thresholds). |
| Boundaries | ✅ | Non-goals, three-tier Boundaries, and Security considerations all present. |
| Dependency graph | ✅ | T1 ∥ T2 ∥ T4; T3 after T2; T5 after all. Acyclic; every AC mapped (T1→AC-1, T2→AC-2, T3→AC-3, T4→AC-4/AC-5, T5→AC-1..5). |
| Parallel safety | ✅ | `files_owned` sets are disjoint across parallel tasks (backend protocol.ts vs frontend protocol.ts vs engine files vs session.ts); no shared-file contact. |
| Security | ✅ | No new user-controlled data, persistence surface, secrets, or dependencies; codecs already validate `customization`. |
| Testing | ✅ | Unit + integration tiers named; commands from AGENTS.md; `npm run coverage` with ≥ 80% per workspace; AC-4 reference-inequality test noted. |
| Consistency | ✅ | Reuses existing defensive-copy convention (`adoptCustomization` spread style) and existing codec rules; no contradiction with AGENTS.md. |
| Real-time | ✅ | Correctly declared out of scope: type-only alignment + in-memory copy; no connection/reconnection/multi-client/authority change. |
| Containers | ✅ | Correctly declared out of scope: no services/images/ports/config/deployables; AC-18-style container diff gate unchanged (T5 verifies). |

## Previous round verification (if iteration > 1)

Not applicable — first spec review round.

## Notes / backlog (non-blocking)

- No documentation updates are expected for this feature (no user-facing behavior, config, or container change); confirm during the acceptance documentation pass that no docs reference the removed casts.
- The builder may add/adjust tests in the owned test files (`engine.test.ts`) to assert AC-4's reference inequality; no production behavior beyond the copy change.