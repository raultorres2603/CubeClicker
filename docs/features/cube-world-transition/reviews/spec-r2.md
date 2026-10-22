---
verdict: approved
blocking: 0
nonblocking: 0
iteration: 2
---

# Spec Review r2 — cube-world-transition

## Summary

The r2 correction resolves the r1 BLOCKER (F1: pose table vs formula contradiction) by applying ruling (a) — the formula is authoritative and the pose tables are corrected. The correction is sound, internally consistent, and preserves all retained claims. The framing gates still hold, the camera↔starfield coupling is preserved, and ruling (b) rejection is justified. No scope, AC renumbering, architecture, or dependency changes occurred beyond the corrected cells. T1 and T3 are unaffected. The spec is now ready for implementation.

## Findings

| # | Severity | Location | Finding | Required Action |
|---|----------|----------|---------|-----------------|
| F1 | INFO | spec.md L238, plan.md L191, tasks.md L61 | The revision histories accurately document the r2 correction per the T2 block (build-log-T2.md). Spec r2 notes ruling (a) application, plan r2 notes no substantive change was needed (plan only pinned the formula), tasks r2 notes the travelFrom regression literal correction. | None — documentation is accurate and complete. |

## Checklist Results

| Check | Result | Notes |
|-------|--------|-------|
| **Completeness** | ✅ pass | Every request item maps to binary-testable ACs. The correction does not introduce gaps. |
| **Testability** | ✅ pass | Each AC remains binary-testable. The corrected pose table values (3, 21, 51) are dyadic-exact and assertable without `toBeCloseTo`. The retained z-table claim is verified by recomputation. |
| **Boundaries** | ✅ pass | Three tiers present, non-goals listed. No change. |
| **Dependency Graph** | ✅ pass | T1 → T2 → T3. No change. |
| **Parallel Safety** | ✅ pass | Fully sequential (D-6). No change. |
| **Security** | ✅ pass | No new dependencies, no user data, no network. No change. |
| **Testing** | ✅ pass | Unit + integration tiers, coverage ≥ 80%, no banned matchers. The corrected pose table values are assertable with concrete literals. |
| **Consistency** | ✅ pass | Aligns with vision, reuses architecture. The formula-authoritative ruling preserves the camera↔starfield coupling invariant (both driven by `travelSwing`). |
| **Real-time** | ✅ pass | No shared/cross-client state. No change. |
| **Containers** | ✅ pass | No container changes. No change. |

## Previous Round Verification

| Finding | Status | Evidence |
|---------|--------|----------|
| F1 (r1): Pose table contradicted formula at p=0.25 (z: 21.75 vs 51) and p=0.75 (lateral: 18 vs 21) | **fixed** | Spec r2 L88 declares formula authoritative. Pose tables (L92-95) corrected to (3,0,51) at p=0.25 and (21,0,51) at p=0.75 for all four directions. Recomputation from landed easings confirms: `easeInOutQuad(0.25) = 0.125`, `travelSwing(0.25) = 0.5`, so x = 24·0.125 = 3, z = 12 + 78·0.5 = 51; `easeInOutQuad(0.75) = 0.875`, `travelSwing(0.75) = 0.5`, so x = 24·0.875 = 21, z = 51. Retained z-table at followup's 9 pinned progress values recomputes to `12 / 21.75 / 51 / 80.25 / 90 / 80.25 / 51 / 21.75 / 12`, matching the followup spec exactly. |
| F2 (r1): AC-3 regression literal in spec L145 and tasks L45 referenced (18, 0, 51) | **fixed** | Spec r2 L145 corrected to `(21, 0, 51)`. Tasks r2 L45 corrected to `(21, 0, 51)` and L61 notes the revision. |
| F3 (r1): Framing gates might not hold with corrected values | **verified** | At p=0.25, camera at (3, 0, 51) looking at (3, 0, 0), old cube at (0, 0, 0) extent 5. Distance ≈ 51.1, angular size ≈ 5.6°, well within FOV 50° (half-angle 25°). At p=0.75, camera at (21, 0, 51) looking at (21, 0, 0), new cube at (24, 0, 0) extent 5. Same geometry. Framing gates hold. |
| F4 (r1): Ruling (b) rejection not justified | **verified** | Ruling (b) would require ad-hoc piecewise easings (lateral: 2p² then linear; z: (2p)³ then linear), breaking the invariant documented in effects.ts L83-91 that "the same value drives camera z and starfield scale" (both use `travelSwing`). If table values were authoritative, `travelSwing(0.25)` would need to be (21.75-12)/78 = 0.125, but actual `travelSwing(0.25) = 0.5`. The invariant would break. Rejection is justified. |

## Notes

- The correction is minimal and surgical: only the pose table cells and the AC-3 regression literal changed. No other spec/plan/tasks content was affected.
- The plan was already on the formula-authoritative side (it only pinned the formula, not the table values), so the plan r2 revision was traceability-only.
- The tasks r2 correction was limited to the T2 travelFrom regression literal and the pose-table clause.
- All retained claims verified by recomputation: the z-column matches the followup's 9-row table verbatim, the lateral values are `easeInOutQuad`-shaped, and the camera↔starfield coupling is preserved.
- The framing gates still hold: the binding corner angle at p=0.25 is atan(3/51) ≈ 3.37° < 17.27° (the smallest horizontal half-angle at 16:9 aspect), so the old cube is fully framed.
- The builder's block was a legitimate catch: the r1 spec had two contradictory pins (formula and table), and the builder correctly refused to implement an ambiguous spec. The r2 correction resolves the ambiguity by declaring the formula authoritative and correcting the table.
