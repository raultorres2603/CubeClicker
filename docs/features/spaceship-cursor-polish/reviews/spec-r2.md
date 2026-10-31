---
feature: spaceship-cursor-polish
phase: spec
iteration: 2
verdict: changes_requested
blocking: 1
nonblocking: 1
---

# Spec Review — r2

## Summary

❌ changes requested — r1 findings F1–F5 are resolved and verified (AC-3 vector, ignition trigger/threshold, reset/no-movement semantics, flicker formula, creation-hidden). One new MAJOR remains: the plan's ignition `update` pseudo-code early-returns on `reducedMotion`/`dtMs <= 0` before the position lerp, which would prevent the reduced-motion snap required by AC-2/AC-8 and contradict the plan's own "factor = 1 (snap)" decision. One MINOR note on an unused import.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | plan.md § Interfaces/contracts (Ignition update), bullets 2–3 | The pseudo-code resets, then early-returns on `!hasPointer`/`dtMs <= 0`/`reducedMotion` *before* the `previous = group.position; lerp; delta = ...` step. Under reduced motion the follow factor is `1` (snap) for any `dtMs >= 0` (AC-2, AC-8, plan D-5/line 59), so the ship must still move to its target; an early return before the lerp leaves it frozen and breaks the snap. The same applies to `dtMs === 0` under reduced motion (factor 1). The reset and the early-return are meant to govern ignition intensity/time only, not movement. | Reorder the ignition block so the group's position update (`previous` clone → `lerp(target, factor)` with `factor = spaceshipFollowFactor(dtMs, reducedMotion)`) runs first for every path that has a pointer (including reduced motion and `dtMs === 0`); then reset intensity/visibility; then early-return on `reducedMotion`/`dtMs <= 0`/sub-threshold delta to skip time advance and intensity. Keep `!hasPointer` returning after reset with no movement (predecessor behaviour). | open |
| F2 | MINOR | plan.md § Interfaces/contracts; src/frontend/src/render/spaceship.ts imports | The bullet-like geometry replaces the box body with a `CylinderGeometry`, which makes the existing `BoxGeometry` import unused. Left as-is, `npm run lint` fails (`no-unused-vars`) at the T1/T3 gates. | In T1, remove the now-unused `BoxGeometry` import from `spaceship.ts` (and any other import made unused by the geometry change) as part of the edit. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks (farther/diagonal, larger bullet, more delay, ignition fire) covered by AC-1..AC-8; non-goals listed. |
| Testability | ✅ | AC-3 vector verified by independent computation (`(-0.334695, -0.334695, 6.018699)`); AC-5/AC-6 pin `dtMs === 120` and the `delta >= threshold` condition; animation inequality verified for the pinned formula. |
| Boundaries | ✅ | Three tiers present; non-goals explicit. |
| Dependency graph | ✅ | T1 → T2 → T3 acyclic; all 10 ACs mapped. |
| Parallel safety | ✅ | No `[P]` tasks; no file collisions. |
| Security | ✅ | No new deps; procedural geometry only; no user data/network. |
| Testing | ✅ | Unit + integration tiers; commands and ≥80% coverage bar named; concrete-assertion rule referenced. |
| Consistency | ✅ | Aligns with vision (reduced motion) and predecessor architecture; AC-2/AC-8 preserved. |
| Risks | ❌ | Plan ignition block ordering contradicts reduced-motion snap (F1). |
| Real-time | ✅ | N/A — client-local only; default local-only flagged (Q-1). |
| Containers | ✅ | N/A — frontend source only; AC-10 verifies no container/backend change. |

## Previous round verification (if iteration > 1)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | fixed | spec.md AC-3 now pins `(-0.334695, -0.334695, 6.018699)`; independent three.js computation matches to 1e-6. |
| F2 (r1) | fixed | spec.md AC-5/AC-6 pin `dtMs === 120` and `movement delta >= SPACESHIP_IGNITION_MOVEMENT_THRESHOLD`; both consecutive updates must exceed the threshold. |
| F3 (r1) | fixed | plan.md now specifies reset-first on every path, creation-hidden, no-movement semantics, and `ignitionTimeMs` advancing only when intensity > 0. |
| F4 (r1) | fixed | plan.md now gives the exact affine formula: `scale.z = 0.6 + 0.4 * abs(sin(...))`, `opacity = 0.5 + 0.5 * abs(sin(...))`. |
| F5 (r1) | fixed | spec.md AC-5 and plan.md creation step state ignitions are created with `visible === false` and intensity 0. |
| F6 (r1) | informational (carried) | Q-1 remains an open user checkpoint; default local-only chosen and flagged. No action. |
| F7 (r1) | accepted | tasks.md retains the sizing note; T1 may be split if it exceeds one session. |

## Notes / backlog (non-blocking)

- F6 (cross-client spaceship visibility) and F7 (T1 sizing) remain informational only; no change requested.
- Wishlist: cross-client spaceship visibility (Q-1) remains a future feature requiring a protocol addition.