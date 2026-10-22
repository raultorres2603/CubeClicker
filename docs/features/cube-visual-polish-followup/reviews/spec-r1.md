---
feature: cube-visual-polish-followup
iteration: 1
verdict: approved
blocking: 0
created: 2026-10-21
---

# Spec Review — Cube Visual Polish Follow-up (r1)

## Verdict

✅ **approved** — The spec is sound, complete, testable, and feasible. The diagnosis of all three defects is correct, the proposed fixes are mathematically sound, the supersession ledger is complete and honest, and the testability bar is met. All open questions are genuinely user-owned and clearly stated. Approved for building.

## Checklist

| Criterion | Status | Evidence |
| --- | --- | --- |
| **Completeness** | ✅ | Every raw-request ask maps to a pinned AC: backdrop coverage gap → AC-1 (cone distribution + coverage test); intro must point at cube from first frame → AC-2 (straight dolly + framing gates); level transition must fly to next cube → AC-3 (symmetric swing + midpoint advance). No scope invented beyond the three items. |
| **Testability** | ✅ | All ACs are binary-testable with concrete pinned values: AC-1 (corner-ray coverage test at 4 poses × 3 aspects × 2 swirl angles, per-cell density floors); AC-2 (pose table exact literals, monotonic sweep, framing gates at 5 progress × 3 aspects); AC-3 (travel swing table exact values, engine timing boundaries, scene camera/scale tables); AC-4 (supersession ledger + regression gate). No banned matchers, no visual-only acceptance (manual pass is explicitly "not an AC"). |
| **Boundaries** | ✅ | Three tiers present: ✅ Always (game/** DOM-free, concrete assertions, coverage bar), ⚠️ Ask first (constant deviations, file ownership), 🚫 Never (banned matchers, coverage exclusions, accepted artifact edits). Non-goals listed: no game rules, no HUD, no backend, no new dependencies, no browser automation. |
| **Dependency graph** | ✅ | Acyclic: T1 → T2 → T4 and T1 → T3 → T4; T2 ∥ T3 (parallel-safe: disjoint files_owned, no shared-file contact — both only import T1's exports). Every AC mapped to tasks. Tasks sized to one builder session. |
| **Parallel safety** | ✅ | T2 owns render files (starfield.ts, scene.ts, scene.test.ts, session.test.ts test-only re-pin); T3 owns engine files (engine.ts, engine.test.ts); no overlap. Both import T1's exports (travelSwing, TRAVEL_LEVEL_ADVANCE_P) but never redefine them. |
| **Security** | ✅ | No new dependencies (three 0.186.1 unchanged). No user data, no storage, no network. Rendering safety unchanged (procedural geometry, no loaders). Resource bounds as robustness (star count, drawable ceilings, once-only level advance). Test integrity as a control (coverage bar, concrete assertions, game/** DOM-freedom retained). |
| **Testing** | ✅ | Strategy present: unit (pure math — travelSwing, popScaleAt, easings) + integration (real three.js scene graph — starfield distribution, camera framing, travel timing). Commands exist in AGENTS.md (npm run coverage). Thresholds ≥ 80% × 4 per workspace. Assertion quality: concrete expected values, no banned matchers, no useless tests. Edge cases named (aspect range, swirl angles, timing boundaries, once-only firing). |
| **Consistency** | ✅ | Aligns with vision (instant fun, accessible, performance). Reuses existing architecture (four-layer: game/** → render/** → input/** → session.ts/ui/**). Contradicts nothing in AGENTS.md. Supersedes accepted behaviors by AC ID without editing their artifacts. |
| **Risks** | ✅ | Ambiguities resolved: exact-float swirl assertion (rate 1/65536 is dyadic-exact, 1000 × rate = 0.0152587890625 is exact); coverage-test pose sensitivity (15% margin, corner-ray test is loud not flaky); seeded density floors (≥ 5 per 4×4 cell, builder reports blocked if seed falls below); mid-chain consistency (T2 without T3 is green but visually inconsistent, T4 verifies integrated); engine once-only guard (crossing check prevents double-fire); accepted artifact regression (git diff on predecessor dirs must be empty). |
| **Real-time** | ✅ | Not applicable — all changes are local client-side rendering and phase timing. No shared or cross-client state. |
| **Containers** | ✅ | Not applicable — no new services, images, ports, environment variables, or health signals. Frontend image absorbs the diff through the existing build. |

## Diagnosis Verification

### Starfield Defect (AC-1)

**Claim:** The landed starfield is a bounded disk at the origin (x ∈ [-70, 70], y ∈ [-40, 40], z ∈ [-60, -8]) that the slow drift rotates rigidly about the world y-axis, causing the projected right boundary to recede inside the frustum after ~30–50 s.

**Verified:** `src/frontend/src/render/starfield.ts` lines 25–34 pin GALAXY_WIDTH=140, GALAXY_HEIGHT=80, GALAXY_NEAR_DEPTH=8, GALAXY_DEPTH_SPAN=52, giving the claimed bounds. Line 110 applies `points.rotation.y += dtMs * DRIFT_RADIANS_PER_MS` — rotation about world Y axis. The diagnosis is correct.

**Fix:** Camera-anchored rectangular cone with view-axis swirl. The cone's cross-section at depth d spans ±d·STARFIELD_TAN_X × ±d·STARFIELD_TAN_Y, where STARFIELD_TAN_X = tan(25°) · (7/3) · 1.15 ≈ 1.2512 and STARFIELD_TAN_Y = tan(25°) · 1.15 ≈ 0.5363. The frustum's cross-section at depth d spans ±d·tan(25°)·aspect × ±d·tan(25°). For aspect ≤ 7/3, the cone contains the frustum by construction (verified numerically: at aspect 2/3, frustum tanX = 0.311 < 1.251; at aspect 7/3, frustum tanX = 1.088 < 1.251). The swirl rotates the cone about the view axis (invariant under rotation), so coverage never degrades. The coverage test (corner rays of the real frustum compared against STARFIELD_TAN_X/Y) is meaningful and can fail if the constants diverge from the frustum. The 15% margin provides safety.

**Verdict:** Diagnosis correct, fix sound, test meaningful.

### Intro Defect (AC-2)

**Claim:** The landed intro has a search → find → approach choreography where the cube is off-screen for p ∈ [0, 0.4], violating the user's expectation that the camera should start far away pointing at the cube and approach it.

**Verified:** `src/frontend/src/render/scene.ts` lines 71–86 define INTRO_SEARCH_END_P=0.4, INTRO_FIND_END_P=0.72, with the camera starting at (36, 20, 24) looking at (0, 30, -40) — the cube is off-screen. The diagnosis is correct.

**Fix:** Straight dolly z = 60 − 48·easeOutCubic(p), target always (0, 0, 0). Pose table verified numerically: p=0 → z=60, p=0.25 → z=32.25, p=0.5 → z=18, p=0.75 → z=12.75, p=1 → z=12. The cube is framed at every progress: at the closest pose (p=1, z=12), the corner half-angle atan(2.5/9.5) ≈ 14.74° is less than the horizontal half-angle atan(tan(25°)·2/3) ≈ 17.27° at aspect 2/3. The framing gates (all 8 corners inside the real frustum at 5 progress × 3 aspects) verify this property.

**Supersession:** The spec reinstates the original AC-22 intro values (60/18/12) with the pointing guarantee. Checking cube-game-frontend AC-22: "intro (0,0,60) → (0,0,18)@0.5 → (0,0,12), easeOutCubic" — matches.

**Verdict:** Diagnosis correct, fix sound, supersession honest.

### Arrival Defect (AC-3)

**Claim:** The landed travel phase fires the level advance at the end of travel, so the new cube appears instantly at the rest pose when the camera snaps back, violating the user's expectation that "we should go to the next cube."

**Verified:** `src/frontend/src/game/engine.ts` lines 433–440 show advanceTravel fires advanceLevelAndRebuild when phaseElapsedMs >= travelMs — at the end. Lines 399–411 show advanceLevelAndRebuild does both level advance and phase switch together. The diagnosis is correct.

**Fix:** Symmetric swing travelSwing(p) = easeInOutQuad(2p) for p ≤ 0.5, 1 − easeInOutQuad(2p−1) for p > 0.5. Camera z = 12 + 78·travelSwing(p), scale = 1 + 7·travelSwing(p). Level advance at p = 0.5 (TRAVEL_LEVEL_ADVANCE_P = 0.5). Travel swing table verified numerically: p=0 → swing=0, p=0.125 → swing=0.125, p=0.25 → swing=0.5, p=0.375 → swing=0.875, p=0.5 → swing=1, p=0.625 → swing=0.875, p=0.75 → swing=0.5, p=0.875 → swing=0.125, p=1 → swing=0. Camera z table: 12 / 21.75 / 51 / 80.25 / 90 / 80.25 / 51 / 21.75 / 12. Scale table: 1 / 1.875 / 4.5 / 7.125 / 8 / 7.125 / 4.5 / 1.875 / 1. All values match the spec's tables.

**Engine change:** Split advanceLevelAndRebuild into advanceLevel (progression +1, fresh board, orientation reset, one levelChanged intent) and advanceTravel (fires advanceLevel at midpoint crossing, phase switch at travelMs). The guard `phaseElapsedMs >= midpoint && (before < midpoint || midpoint <= 0)` prevents double-firing. A single advance crossing both thresholds fires level advance first, then phase switch. This is sound.

**No new phase:** The arrival lives inside the existing travel phase. The engine phase machine, input gating, HUD live region, and session wiring stay untouched. This is a key design decision that minimizes blast radius.

**Verdict:** Diagnosis correct, fix sound, no-new-phase design sound.

## Supersession Ledger Verification

The spec lists 6 superseded behaviors:

1. **cube-visual-polish AC-1** (travel backdrop expansion mechanics): monotone expansion table over full progress → replaced by symmetric expand→contract peaking at midpoint. Retained: scale form (S,S,1) with z=1, clamped travel-progress input, same Points identity, determinism, reduced-motion collapse, drift rate.
2. **cube-visual-polish AC-2** (intro cinematic): search → find → approach choreography → replaced by straight dolly. Retained: INTRO_DURATION_MS 2500, tap/any-key skip, landing at rest, reduced-motion collapse, introCameraPose as pure function.
3. **cube-visual-polish AC-1 § Manual visual pass step 1**: "camera searches the sky" → replaced by AC-2 (cube visible and framed from first frame). Retained: all other manual-pass steps.
4. **cube-game-frontend AC-22** (camera flights): intro path (already superseded by polish AC-2) and travel pull-away table → intro reinstates original AC-22 values (60/18/12) with pointing guarantee; travel replaces with symmetric swing peaking at (0,0,90). Retained: rest pose, lookAt origin, FOV 50 / near 0.1 / far 200, easings, reduced-motion collapse.
5. **cube-game-frontend AC-10** (level-advance timing): advance at end of travel → replaced by advance at midpoint. Retained: every engine semantic (levelIndex advance, fresh board, next style, stats carried, orientation reset, travelStarted once, one levelChanged intent, phase sequence intro → playing → travel → playing, input gated, TRAVEL_DURATION_MS 2500 / reduced 150).
6. **cube-game-frontend AC-3** (starfield backdrop): concrete seeded star positions (bounded disk at origin) → replaced by cone distribution. Retained: black background, exactly one Points with STAR_COUNT (1200) stars, deterministic seeded layout, slow drift (now view-axis swirl, same rate), never rebuilt, travel-progress input.

**Verified:** Each supersession is honest — the replaced behavior is clearly identified, the replacement is clearly described, and the retained behaviors are explicitly listed. The ledger is complete (no missing supersessions) and does not over-supersede (no accepted behaviors change outside the six named).

**Accepted artifacts untouched:** The spec explicitly states "The predecessor specs (docs/features/cube-game-frontend/spec.md r2, docs/features/cube-visual-polish/spec.md r1) are authoritative for everything not superseded and are never edited by this feature." The Boundaries section reinforces: "🚫 Never: rewrite the accepted features' spec/plan/tasks to match this change (this spec supersedes them, it does not edit them)." T4's verify step includes "git diff --stat on docs/features/cube-game-frontend/**/docs/features/cube-visual-polish/** → empty."

**Verdict:** Ledger complete and honest, accepted artifacts protected.

## Testability & Bar

**Binary ACs:** AC-1 (coverage test), AC-2 (framing gates), AC-3 (timing boundaries + camera/scale tables), AC-4 (supersession ledger + regression gate) — all binary-testable.

**Concrete pinned values:** All pose tables, scale tables, timing boundaries are exact literals. No vague terms ("fast", "clean"). The bounded-exception budget stays 0 (no toBeCloseTo).

**No banned matchers:** The spec explicitly states "no banned matchers, no useless tests, no toBeCloseTo" and references the project testing bar.

**No visual-only acceptance:** The manual visual pass is explicitly "not an AC" — it is a checklist for post-build verification, not an acceptance criterion.

**Coverage ≥ 80 per workspace:** The spec pins `npm run coverage` with thresholds ≥ 80% statements/branches/functions/lines per workspace. T4's verify step runs the full suite and records the per-AC table.

**game/** DOM-free:** The spec explicitly states "keep game/** pure and DOM-free" in Boundaries ✅ Always.

**Verdict:** Testability bar met.

## Open Questions

**Q-1 — Supported aspect range:** Pinned [2/3, 7/3] for backdrop coverage and cube framing. Recommendation: keep. Note: at aspects below ≈ 0.564 (e.g., phone in 9:16 portrait) the cube's nearest corner can touch the horizontal frustum edge at the closest approach — a pre-existing property of the accepted rest pose (0,0,12) + FOV 50, not introduced here. The backdrop cone would still cover, and the cube stays centred. Widening the guaranteed range below 0.564 needs the rest pose ≥ ≈ 12.031 (a supersession of the accepted AC-22 rest value — user checkpoint) or a wider FOV. **Genuinely user-owned, clearly stated.**

**Q-2 — Intro start distance:** Pinned INTRO_START_Z = 60 — the original accepted AC-22 value ("far away"), now with the always-pointing guarantee. Recommendation: keep. A larger start (e.g., 90) is a constant-only change with a spec-revision note. **Genuinely user-owned, clearly stated.**

**Q-3 — Arrival geometry:** Pinned: turn-around at (0,0,90) (the retained TRAVEL_END_Z), level advance at p = 0.5, symmetric easeInOutQuad halves, expansion peak 8 contracting back to 1. Recommendation: keep. Alternatives (turn-around at 51, advance at 0.6, different easings) are pinned-constant changes, never silent. **Genuinely user-owned, clearly stated.**

**Q-4 — Star density at the travel peak:** The expansion spreads the stars, so at the turn-around (scale 8) roughly 8–14 stars are visible before the contraction condenses them back — the accepted expansion look (the predecessor's peak was comparably sparse), held only briefly. Recommendation: keep. Alternatives: raise STAR_COUNT or lower TRAVEL_STARFIELD_SCALE — both supersede accepted constants and need the user checkpoint. **Genuinely user-owned, clearly stated.**

**Q-5 — Reduced-motion arrival:** Pinned: collapses to the predecessor's instant swap (150 ms, camera at rest, no expansion, cube appears at rest). Recommendation: keep — consistent with the AC-12 collapse philosophy (no flights under reduced motion). **Genuinely user-owned, clearly stated.**

**Verdict:** All open questions are genuinely user-owned, clearly stated, with recommendations. Nothing should be pulled back into the spec.

## Findings

**None.** No BLOCKER or MAJOR findings. The spec is sound, complete, testable, and feasible.

### INFO (cosmetic, non-blocking)

**I-1 — Coverage test at scale-8 expansion:** The spec states "at the turn-around pose (0,0,90) with the scale-8 expansion the projected star count is ≥ 4." This is a density floor, not a coverage guarantee. The coverage guarantee (corner rays inside the cone) is separate and sufficient. The density floor is a visual-quality check, not a coverage check. This is fine — the coverage test is the real guarantee, the density floor is supplementary. **Location:** spec.md § Acceptance criteria AC-1. **Action:** None.

**I-2 — Swirl quaternion allocation:** The spec states "zero per-frame allocation" and "one preallocated Quaternion." The plan states "the swirl keeps one preallocated Quaternion and an accumulated scalar (zero per-frame allocation)." This is consistent. The implementation will need to preallocate the swirl quaternion outside the update loop. This is feasible. **Location:** spec.md § 1 (Resources/determinism), plan.md § Interfaces → render/starfield.ts. **Action:** None.

**I-3 — Anchor interface:** The spec proposes `StarfieldAnchor { position: Vector3; quaternion: Quaternion }` with "caller-owned references; never copied per frame." The plan states "the anchor follows the camera with zero allocation." This is consistent. The scene will create the anchor once beside the camera and pass it to starfield.update every frame. This is feasible. **Location:** plan.md § Interfaces → render/starfield.ts. **Action:** None.

**I-4 — Engine once-only guard:** The spec states "the level advance fires exactly once per travel: on the first advance crossing travelMs · TRAVEL_LEVEL_ADVANCE_P." The plan provides the implementation: `if (phaseElapsedMs >= midpoint && (before < midpoint || midpoint <= 0))`. This guard is correct: it fires when the current elapsed crosses the midpoint AND the previous elapsed was below it (or the midpoint is zero). This prevents double-firing. The spec also states "a single advance that crosses both the midpoint and the end fires the level advance first, then the phase switch" — this is correct because the midpoint check comes before the phase-switch check in the proposed code. **Location:** plan.md § Interfaces → game/engine.ts. **Action:** None.

**I-5 — Mid-chain consistency:** The spec acknowledges "Mid-chain (T2 without T3) the scene lands the camera at rest before the engine's end-of-travel advance — visually inconsistent but green (tests are layer-local); the integrated behavior lands at T4." This is an honest acknowledgment of the task boundary. T4's verify step re-runs the full suite and records the per-AC table, so the integrated behavior is verified. This is acceptable. **Location:** plan.md § Risks & mitigations. **Action:** None.

**I-6 — Seeded density floors:** The spec states "if the seed lands below a floor (statistically ~1–2% risk at the peak), the builder reports blocked rather than weakening the assertion." This is a sound mitigation. The risk is low and the mitigation is explicit. **Location:** plan.md § Risks & mitigations. **Action:** None.

**I-7 — Exact-float swirl assertion:** The spec states "the builder pins points.rotation.z === 0.0152587890625 and, if three's euler round-trip differs by ulps, pins the exact composed doubles with an in-test comment — no toBeCloseTo." This is consistent with the project bar (no banned matchers, bounded-exception budget 0). The rate 1/65536 = 2^-16 is exactly representable, and 1000 · 2^-16 = 0.0152587890625 is also exactly representable. The assertion is safe. **Location:** plan.md § Risks & mitigations. **Action:** None.

**I-8 — Supersession of polish AC-1 manual step 1:** The spec supersedes "polish AC-1 § Manual visual pass step 1" which states "the camera searches the sky (the cube is not on screen at first)." This is superseded by the new AC-2 (cube visible and framed from the first frame). This is correct — the manual step is part of the polish spec's checklist, and the followup spec supersedes it. **Location:** spec.md § Supersessions (row 3). **Action:** None.

**I-9 — Retained behaviors:** The spec explicitly lists retained behaviors: "rotation settle math; face destruction/fade; the whole engine click path; pointer gesture classification and the front-face picking gate; the burst-fronting pins (polish AC-3); the pop animation and its interactions (polish AC-4/AC-5); the cursor removal and the pinned aria-label (polish AC-6); the HUD, the single live region, snapshot stability; reduced-motion profile values (plus the AC-3 arrival collapse below); frame-loop lifecycle and disposal; bounded drawables (≤ 6 InstancedMesh + one starfield Points + one cube body + one pooled particle Points); the coverage bar and scope discipline; no new dependencies (three 0.186.1, named imports only), bundle ≤ BUNDLE_BUDGET_GZ_KB." This is comprehensive and matches the predecessor specs. **Location:** spec.md § Supersessions (final paragraph). **Action:** None.

**I-10 — No new phase:** The spec explicitly states "no new phase — the arrival lives inside travel." This is a key design decision. The engine phase machine, input gating, HUD live region, and session wiring stay untouched. This is sound — adding a new phase would require changes to the engine, input, HUD, and session, which is outside the scope of a visual polish followup. **Location:** spec.md § 3 (first paragraph). **Action:** None.

## Recommendations

- Carry-forward for the code gate: T4's per-AC table must cover AC-1…AC-4 explicitly; coverage config stays untouched (thresholds 80×4, main.tsx-only production exclusion); the residual (thin React effects, mocked WebGLRenderer) must be recorded in the table, not omitted.
- The builder should verify the seeded density floors at the travel peak (≥ 4 stars) and report blocked if the seed falls below, rather than weakening the assertion.
- The builder should pin the exact composed quaternion doubles for the swirl assertion if three's euler round-trip differs by ulps, with an in-test comment.
- The builder should verify the corner-ray coverage test at all 4 poses × 3 aspects × 2 swirl angles (rest scale and scale-8 expansion) and assert the per-cell density floors at the sustained poses.

## Revision History

- r1 — 2026-10-21 — initial spec review (approved, 0 blocking findings).
