---
feature: spaceship-cursor-polish
phase: spec
iteration: 1
verdict: changes_requested
blocking: 3
nonblocking: 4
---

# Spec Review — r1

## Summary

❌ changes requested — 3 MAJOR findings: the pinned default-camera target vector in AC-3 is off beyond tolerance (z by 3.3e-6), AC-5/AC-6 leave the triggering dtMs/movement unspecified, and the ignition reset/no-movement semantics are undefined in the plan (early-return on no pointer leaves stale flames). Minor clarifications also needed.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | spec.md § Acceptance criteria AC-3 | The pinned expected vector `(-0.334696, -0.334696, 6.018696)` does not match the computation for the default camera with offsets `-0.12/-0.12`. Recomputed (node + three, same camera setup as the predecessor test) gives `(-0.334695, -0.334695, 6.018699)`; the z component differs by ~3.28e-6, beyond the stated 1e-6 tolerance, so a conforming implementation and test would disagree and AC-3 would be unverifiable as written. | Correct the expected vector to `(-0.334695, -0.334695, 6.018699)` (tolerance 1e-6 on each component); re-verify x/y against the same computation. | open |
| F2 | MAJOR | spec.md § Acceptance criteria AC-5, AC-6 | The ACs say "an update that moves the ship (non-reduced motion, `dtMs > 0`, pointer present)" and "two consecutive moving updates with the same non-zero `dtMs`", but never pin the magnitude. With `SPACESHIP_IGNITION_MOVEMENT_THRESHOLD = 0.01`, a small `dtMs` (e.g. 1 ms) yields a lerp delta below threshold, so `getIgnitionIntensity()` stays 0 and flames never light / `scale.z` never differs — the AC would fail for an otherwise correct implementation, or pass only by accident of the builder's chosen step. This is a testability gap (vague trigger). | Pin a concrete `dtMs` (e.g. 120, matching the existing scene tests) and/or define "moves the ship" as a resulting movement delta ≥ `SPACESHIP_IGNITION_MOVEMENT_THRESHOLD`; state that both consecutive updates must exceed the threshold so intensity stays > 0 and `scale.z` differs. | open |
| F3 | MAJOR | plan.md § Interfaces/contracts (Ignition update); src/frontend/src/render/spaceship.ts (update early-return) | The plan's `update()` early-returns when `!hasPointer` (inherited from the predecessor) and otherwise computes intensity only from the movement delta. Nothing resets intensity to 0 or hides the flames on early return, zero delta, or sub-threshold movement. That contradicts AC-5 ("At rest (no pointer): intensity 0, every flame `visible === false`") and AC-6 ("When the ship does not move (no pointer or `dtMs === 0`): … intensity stays 0"), which a strict reading requires to hold even after a prior moving update. Left as written, flames can linger and ignition time semantics are ambiguous. | Specify in the plan: (a) ignitions are created with `visible === false` and intensity 0; (b) every `update` path — including `!hasPointer`, `dtMs <= 0`, reduced motion, and delta < threshold — sets intensity to 0 and hides all flames; (c) `ignitionTimeMs` advances only when intensity > 0; (d) the no-pointer early return performs this reset before returning. | open |
| F4 | MINOR | plan.md § Interfaces/contracts (Ignition update) | The flicker mapping from `sin(ignitionTimeMs / FLICKER_PERIOD_MS * 2π)` to `scale.z` (0.6–1.0) and material opacity (0.5–1.0) is described loosely (absolute value, ranges) without the exact affine formula. AC-6 only checks inequality, so not blocking, but the builder must not invent a divergent mapping that later tests depend on. | Add the exact formula (e.g. `scale.z = 0.6 + 0.4 * abs(sin(...))`, `opacity = 0.5 + 0.5 * abs(sin(...))`) to the plan and an implementation comment; keep tests on inequality only. | open |
| F5 | MINOR | spec.md § Acceptance criteria AC-5 | AC-5 requires flames hidden "at rest (no pointer)" but does not state that ignitions are created hidden, so the "at rest" claim depends on an unstated initial state (and on no `update` having run). | Add "ignitions are created with `visible === false`" to AC-5 and/or the plan's creation step. | open |
| F6 | INFO | spec.md § Open questions Q-1 | Cross-client visibility of the spaceship/ignitions remains an open user checkpoint; default (local-only) chosen and flagged. No action required unless the user chooses broadcast. | None — keep as open question. | open |
| F7 | INFO | tasks.md | All three tasks are `[seq]`; no parallel tasks, so parallel-safety holds trivially. No change needed, but note that T1 bundles constants + geometry + ignitions + tests in one session (sizing risk). | None — accept; T1 may be split if it exceeds one session. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks (farther/diagonal, larger bullet, more delay, ignition fire) covered by AC-1..AC-8; non-goals listed. |
| Testability | ❌ | AC-3 z value beyond tolerance (F1); AC-5/AC-6 trigger unspecified (F2). |
| Boundaries | ✅ | Three tiers present; non-goals explicit. |
| Dependency graph | ✅ | T1 → T2 → T3 acyclic; all 10 ACs mapped; tasks sized to one session (T1 borderline). |
| Parallel safety | ✅ | No `[P]` tasks; no file collisions. |
| Security | ✅ | No new deps; procedural geometry only; no user data/network. |
| Testing | ✅ | Unit + integration tiers; commands and ≥80% coverage bar named; concrete-assertion rule referenced. |
| Consistency | ✅ | Aligns with vision (reduced motion) and predecessor architecture; no contradictions. |
| Risks | ❌ | Ignition reset/no-movement semantics unspecified (F3); flicker mapping loose (F4). |
| Real-time | ✅ | N/A — client-local only; default local-only flagged (Q-1). |
| Containers | ✅ | N/A — frontend source only; AC-10 verifies no container/backend change. |

## Previous round verification (if iteration > 1)

N/A — first iteration.

## Notes / backlog (non-blocking)

- F4, F5: clarify during planning revision; not blocking implementation if builder follows the required action in F3.
- F6, F7: informational only.
- Wishlist: cross-client spaceship visibility (Q-1) remains a future feature requiring a protocol addition.