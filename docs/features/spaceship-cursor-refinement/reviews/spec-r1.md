---
feature: spaceship-cursor-refinement
phase: spec
iteration: 1
verdict: approved
blocking: 0
nonblocking: 2
---
# Spec Review — r1

## Summary

✅ approved — The r1 spec is complete, testable, and internally consistent: the two refined constants (scale 1.5→1.2, NDC x offset -0.12→-0.16) are pinned with concrete values, AC-2's expected vector was recomputed and matches `(-0.445721, -0.334291, 6.025924)` within 1e-6, and every "unchanged" constant and behaviour (follow tau, shot timing, reduced motion, geometry) is explicitly carried over. The dependency graph is acyclic (T1→T2→T3), all ACs are mapped, and parallel safety holds trivially (no `[P]` tasks). Two minor clarifications are noted below.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | plan.md § File inventory; tasks.md T1, T2 | The plan/tasks describe the test edits generically ("update pinned constant assertions to new values", "update expected vector to new offset") but never state that only `SPACESHIP_CURSOR_NDC_OFFSET_X` changes (-0.12 → -0.16) while `SPACESHIP_CURSOR_NDC_OFFSET_Y` stays -0.12. Three test sites mix the two offsets: `effects-spaceship.test.ts` (cursor-offset assertion), `spaceship.test.ts` (default-camera expected vector and the z-independence manual NDC construction). A blanket find/replace of `-0.12` → `-0.16` would corrupt the unchanged Y and break those tests. | Add an explicit per-site note in plan.md/T1/T2 listing the mixed values: X -0.16, Y -0.12 (e.g. `new Vector3(0.1 - 0.16, -0.2 - 0.12, 1)` and vector `(-0.445721, -0.334291, 6.025924)`). | open |
| F2 | INFO | spec.md § Open questions Q-1; docs/features/README.md | Cross-client visibility of the spaceship remains an open user checkpoint (default local-only) and the feature row is not yet present in the orchestrator-owned index; both are expected to be handled at acceptance per the standard workflow. No action required now. | None — carry over; orchestrator adds the index row on acceptance. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Both asks (smaller ship, farther left) covered by AC-1..AC-3; non-goals explicit. |
| Testability | ✅ | Every AC is binary-testable with concrete expected values; AC-2 vector recomputed and matches within 1e-6. |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ✅ | T1 → T2 → T3 acyclic; all 8 ACs mapped; tasks sized to one session. |
| Parallel safety | ✅ | No `[P]` tasks; no file collisions. |
| Security | ✅ | No new deps; procedural geometry only; no user data/network. |
| Testing | ✅ | Unit + integration tiers; commands and ≥80% coverage bar named; concrete-assertion rule referenced. |
| Consistency | ✅ | Aligns with predecessor polish spec and AGENTS.md; no contradictions. |
| Risks | ✅ | Only residual risk is the mixed-offset test edit (F1, MINOR); no mid-build blocker. |
| Real-time | ✅ | N/A — client-local only; default local-only flagged (Q-1). |
| Containers | ✅ | N/A — frontend source only; AC-8 verifies no container/backend change. |

## Previous round verification (if iteration > 1)

N/A — first iteration.

## Notes / backlog (non-blocking)

- F1: clarify during the build's test-edit step; not blocking because the spec's ACs state the mixed values explicitly.
- F2: informational only.
- Wishlist: cross-client spaceship visibility (Q-1) remains a future feature requiring a protocol addition.