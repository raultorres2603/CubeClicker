---
feature: cube-visual-polish-followup
iteration: 2
verdict: approved
blocking: 0
created: 2026-10-21
---

# Spec Review — Cube Visual Polish Follow-up (r2)

## Verdict

✅ **approved** — The r2 correction resolves the r1 flaw. The square cone geometry is mathematically sound, the density pins are defensible, and there are no regressions or silent AC changes. Approved for building.

## Previous round verification

### r1 flaw

The r1 spec proposed a rectangular cone with `STARFIELD_TAN_X = 1.251258882715913` and `STARFIELD_TAN_Y = 0.5362538068782483`, claiming the cone was invariant under the view-axis swirl. This claim was false: a rectangle is invariant only under 90° rotations, not under arbitrary angles. At swirl π/4, the worst-case |v| for viewport corners exceeded TAN_Y for all three pinned aspects (2/3: 0.5495, 16/9: 0.9159, 7/3: 1.0991), causing the AC-1 coverage test to fail. The build-log-T2.md documented this failure with exact test output.

### r2 correction

The r2 spec replaces the rectangular cone with a square cone: `STARFIELD_TAN = 1.251258882715913` on both axes. The mathematical justification:

1. **Inradius vs circumradius**: The square's inradius is STARFIELD_TAN = 1.2513. The viewport's circumradius at the widest aspect (7/3) is √((tan(25°)·7/3)² + tan²(25°)) = 1.1838. Since inradius > circumradius (margin 5.70%), the square covers the viewport at every swirl angle.

2. **Rotation invariance**: Rotation preserves distance from the origin. The worst-case |u| or |v| for any rotated corner is the corner's distance from the origin, which is at most the circumradius. Since STARFIELD_TAN > circumradius, the coverage criterion |u| ≤ STARFIELD_TAN and |v| ≤ STARFIELD_TAN holds at every swirl angle.

3. **Verified numerically**: At swirl π/4, the worst-case |u| and |v| for all three aspects are:
   - Aspect 2/3: worst |u| = 0.5495, worst |v| = 0.5495 (both ≤ 1.2513 ✓)
   - Aspect 16/9: worst |u| = 0.9159, worst |v| = 0.9159 (both ≤ 1.2513 ✓)
   - Aspect 7/3: worst |u| = 1.0991, worst |v| = 1.0991 (both ≤ 1.2513 ✓)

### Density pins

The r2 correction changes the distribution from a rectangle to a square, which affects the visible star density. The spec pins:

- **Visible stars at 16:9 rest scale**: ≈ 296 (verified: 296.28)
- **Per-cell expected (4×4 grid)**: ≈ 18.5 (verified: 18.52)
- **Per-cell floor**: ≥ 5 (well above the floor)
- **Scale-8 peak visible stars**: ≈ 5 (verified: 4.62)
- **Scale-8 peak floor**: ≥ 2 (well above the floor)

The density pins are defensible. The scale-8 peak is 4.62, which is close to the expected ≈ 5 and well above the floor ≥ 2. The blocked-with-measurement path is retained: if the seeded count falls below a floor, the builder reports blocked with the measurement rather than weakening the assertion.

### Negative evidence

The spec r2 AC-1 explicitly cites the r1 failure as negative evidence: "The criterion fails before this revision — at swirl π/4 the inverse-rotated corner slope |v| reached 1.0991 against the old TAN_Y = 0.5363 — and passes after it: the builder's blocked run is the negative evidence." This makes the test demonstrably fail before the fix and pass after it.

### Alternatives rejected

The spec r2 records the rejected alternatives:
- **Circular cone**: Rejected because it changes the pinned draw scheme (polar/rejection instead of `x → y → depth → brightness`) and the determinism fixtures.
- **Bounding the swirl**: Rejected because it defeats the ambient unbounded drift (limited to ≈ 0.086 rad at 16:9, reached in ≈ 5.6 s).

The square cone is the recommended option (option 1 from build-log-T2.md § Candidate answers).

## Regression check

### AC-2, AC-3, AC-4 unchanged

The spec r2 explicitly states: "AC-2, AC-3, AC-4, the intro/travel/engine sections, and the supersession ledger are unchanged." Verified:

- **AC-2** (intro pose table): Unchanged. The straight dolly z = 60 − 48·easeOutCubic(p) and the framing gates are unchanged.
- **AC-3** (arrival): Unchanged. The travelSwing table, camera z table, scale table, and engine midpoint advance are unchanged.
- **AC-4** (supersession ledger): Unchanged. The six superseded behaviors are unchanged.

### T1, T3, T4 unchanged

The tasks r2 explicitly states: "T1, T3, T4 and the DAG are unchanged." Verified:

- **T1**: Status [x] (landed). The travelSwing and TRAVEL_LEVEL_ADVANCE_P are unchanged.
- **T3**: Status [x] (landed). The engine midpoint advance is unchanged.
- **T4**: Status [ ] (not started). The verify & integrate task is unchanged.
- **DAG**: T1 → T2 → T4 and T1 → T3 → T4, with T2 ∥ T3. Unchanged.

### Accepted features untouched

The spec r2 explicitly states: "The predecessor specs (docs/features/cube-game-frontend/spec.md r2, docs/features/cube-visual-polish/spec.md r1) are authoritative for everything not superseded and are never edited by this feature." Verified:

- The supersession ledger is unchanged (six superseded behaviors).
- The retained behaviors are unchanged (rotation settle math, face destruction/fade, click path, gesture classification, burst-fronting pins, pop animation, cursor removal, HUD, live region, snapshot stability, reduced-motion values, lifecycle/disposal, bounded drawables, coverage bar, scope discipline, no new dependencies, bundle budget).

### No silent AC changes

Only AC-1 was changed (the coverage criterion). The change is explicitly documented in the spec r2 revision history: "§ 1's geometry claim, AC-1's coverage criterion (|u|, |v| ≤ STARFIELD_TAN in the inverse-swirled frame — held at every swirl angle because the square's inradius exceeds the largest viewport circumradius 1.1840) and the density pins (≈ 296 visible at 16:9 rest scale; per-cell floor ≥ 5 of ≈ 18.5 expected; scale-8 peak floor ≥ 2 of ≈ 5 expected, exact seeded values pinned in the tests) were updated accordingly."

No other ACs were changed. No silent AC changes.

## Revision history check

### Spec r2

The spec r2 revision history states: "r2 — 2026-10-21 — fix for the T2 block (build-log-T2.md § The blocker, used as the review artifact). **The builder's finding was correct:** the r1 rectangular cone (STARFIELD_TAN_X = 1.251258882715913 ≠ STARFIELD_TAN_Y = 0.5362538068782483) is invariant only under 90° rotations, so the pinned corner-ray coverage test fails at swirl π/4 (|v| up to 1.0991 vs TAN_Y) — the exact defect class the feature removes, after ≈ 51 s. **Fixed:** the cone is now a **square** — STARFIELD_TAN = tan(25°)·(7/3)·1.15 = 1.251258882715913 on both axes (the builder's recommended option 1; the circular-cone option rejected because it changes the pinned draw scheme/determinism fixtures, and the swirl-bounding option rejected because it defeats the ambient unbounded drift). § 1's geometry claim, AC-1's coverage criterion (|u|, |v| ≤ STARFIELD_TAN in the inverse-swirled frame — held at every swirl angle because the square's inradius exceeds the largest viewport circumradius 1.1840) and the density pins (≈ 296 visible at 16:9 rest scale; per-cell floor ≥ 5 of ≈ 18.5 expected; scale-8 peak floor ≥ 2 of ≈ 5 expected, exact seeded values pinned in the tests) were updated accordingly. AC-2, AC-3, AC-4, the intro/travel/engine sections, and the supersession ledger are unchanged; T1/T3 unaffected."

Verified: This accurately describes the changes made. The builder's finding was correct, the fix is sound, the alternatives are recorded, and the unchanged sections are correctly identified.

### Plan r2

The plan r2 revision history states: "r2 — 2026-10-21 — correction per the T2 block (build-log-T2.md § The blocker): the rectangular-cone invariance claim was false at swirl π/4; the cone is now a **square** (STARFIELD_TAN on both axes — inradius 1.2513 ≥ the largest supported viewport circumradius 1.1840), § The coverage argument, D-1, § Interfaces (starfield constants) and the density numbers (≈ 296 visible at 16:9; per-cell ≥ 5 of ≈ 18.5; peak ≥ 2 of ≈ 5) updated; the circular-cone and swirl-bounding options recorded as rejected. D-2…D-7, the intro/travel/engine contracts, and the file inventory are unchanged."

Verified: This accurately describes the changes made. The coverage argument is updated, the key decision D-1 is updated, the interfaces are updated, the density numbers are updated, the rejected alternatives are recorded, and the unchanged sections are correctly identified.

### Tasks r2

The tasks r2 revision history states: "r2 — 2026-10-21 — T2 text corrected per the T2 block (build-log-T2.md § The blocker): the square-cone correction (STARFIELD_TAN on both axes), the corrected coverage criterion (|u|, |v| ≤ STARFIELD_TAN in the inverse-swirled frame), the re-pinned density pins (per-cell ≥ 5 of ≈ 18.5 expected; scale-8 peak ≥ 2 of ≈ 5 expected, blocked-with-measurement path), and the note that the preserved blocked-attempt patch is the re-dispatch base. T1, T3, T4 and the DAG are unchanged."

Verified: This accurately describes the changes made. The T2 text is corrected, the coverage criterion is corrected, the density pins are re-pinned, the blocked-with-measurement path is retained, and the unchanged tasks are correctly identified.

## Traceability

Every change in r2 traces to the build-log-T2.md blocker:

1. **build-log-T2.md § The blocker**: The rectangular cone fails the coverage test at swirl π/4.
2. **build-log-T2.md § Candidate answers**: Three options are proposed: square cone (recommended), circular cone, bounding the swirl.
3. **spec r2**: The square cone is chosen, the geometry claim is updated, the coverage criterion is updated, the density pins are updated, the rejected alternatives are recorded.
4. **plan r2**: The coverage argument is updated, the key decision D-1 is updated, the interfaces are updated, the density numbers are updated, the rejected alternatives are recorded.
5. **tasks r2**: The T2 text is corrected, the coverage criterion is corrected, the density pins are re-pinned, the blocked-with-measurement path is retained.

The traceability is complete and linear. No silent changes.

## Findings

**None.** No BLOCKER or MAJOR findings. The r2 correction is sound, complete, and testable.

## Recommendations

- Carry-forward for the code gate: T4's per-AC table must cover AC-1…AC-4 explicitly; coverage config stays untouched (thresholds 80×4, main.tsx-only production exclusion); the residual (thin React effects, mocked WebGLRenderer) must be recorded in the table, not omitted.
- The builder should verify the seeded density floors at the travel peak (≥ 2 stars) and report blocked with the measurement if the seed falls below, rather than weakening the assertion.
- The builder should pin the exact composed quaternion doubles for the swirl assertion if three's euler round-trip differs by ulps, with an in-test comment.
- The builder should verify the corner-ray coverage test at all 4 poses × 3 aspects × 2 swirl angles (rest scale and scale-8 expansion) and assert the per-cell density floors at the sustained poses.
- The builder should use the preserved blocked-attempt patch (build-log-T2.md § Tree state) as the re-dispatch base, applying the square-cone correction on top.

## Revision History

- r2 — 2026-10-21 — final spec review (approved, 0 blocking findings; r1 flaw resolved).
