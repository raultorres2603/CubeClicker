---
feature: spaceship-cursor-polish
phase: spec
iteration: 3
verdict: approved
blocking: 0
nonblocking: 0
---

# Spec Review — r3

## Summary

✅ approved — r2 findings F1 (MAJOR ignition update ordering) and F2 (MINOR unused `BoxGeometry` import) are resolved and verified. The plan now runs the group position lerp (`factor = spaceshipFollowFactor`) first on every pointer path (including reduced motion and `dtMs === 0`) before the ignition reset and early-return, preserving the reduced-motion snap required by AC-2/AC-8; T1 notes the `BoxGeometry` removal. Independent recomputation confirms AC-3 vector `(-0.334695, -0.334695, 6.018699)`, `spaceshipFollowFactor(240, false) = 1 - 1/e`, and the flicker inequality holds for the pinned formula. No new blockers or majors.

## Findings

(none)

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks (farther/diagonal, larger bullet, more delay, ignition fire) covered by AC-1..AC-8; non-goals listed. |
| Testability | ✅ | AC-3 vector verified by independent computation; AC-5/AC-6 pin `dtMs === 120` and the `delta >= threshold` condition; animation inequality verified for the pinned formula. |
| Boundaries | ✅ | Three tiers present; non-goals explicit. |
| Dependency graph | ✅ | T1 → T2 → T3 acyclic; all 10 ACs mapped. |
| Parallel safety | ✅ | No `[P]` tasks; no file collisions. |
| Security | ✅ | No new deps; procedural geometry only; no user data/network; `BoxGeometry` dropped where unused (F2). |
| Testing | ✅ | Unit + integration tiers; commands and ≥80% coverage bar named; concrete-assertion rule referenced. |
| Consistency | ✅ | Aligns with vision (reduced motion) and predecessor architecture; AC-2/AC-8 preserved. |
| Risks | ✅ | Ignition update ordering now consistent with reduced-motion snap (F1 resolved). |
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
| F1 (r2) | fixed | plan.md (revision r3) reorders the ignition block: group position lerp (`previous` clone → `lerp(target, factor)` with `factor = spaceshipFollowFactor(dtMs, reducedMotion)`) runs first on every pointer path, including reduced motion and `dtMs === 0`, then the ignition reset and early-return. Verified by reading plan.md § Interfaces/contracts (Ignition update) bullets 2–4. |
| F2 (r2) | fixed | plan.md § Interfaces/contracts and tasks.md note (review r2 F2) require removing the now-unused `BoxGeometry` import from `spaceship.ts` (and any other import made unused) so `npm run lint` stays green. |

## Notes / backlog (non-blocking)

- F6 (cross-client spaceship visibility) and F7 (T1 sizing) remain informational only; no change requested.
- Wishlist: cross-client spaceship visibility (Q-1) remains a future feature requiring a protocol addition.
- Minor implementation cautions (not findings): parenthesise the flicker argument as `abs(sin((ignitionTimeMs / SPACESHIP_IGNITION_FLICKER_PERIOD_MS) * 2 * Math.PI))`; set ignition materials `transparent = true` so the opacity term is visible; ensure the disposed guard does not skip the ignition reset in a way that leaves stale flames (tests exercise the rest/move/reduced paths on live instances).