---
feature: spaceship-cursor
phase: spec
iteration: 2
verdict: changes_requested
blocking: 1
nonblocking: 3
---

# Spec Review — r2

## Summary

❌ changes requested — F1–F7 from r1 are all addressed and the spec/plan/tasks are otherwise solid, but one acceptance-critical evidence path is still missing: AC-5's "burst spawned using the retained frame time (default 0)" clause has no pinned observable read surface, so a test cannot assert it (analogous to the r1 F1 shot-count gap). Pin an accessor before building.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F8 | MAJOR | spec.md § Acceptance criteria AC-5; plan.md § Interfaces/contracts (`SceneView`) | AC-5 requires the burst to be spawned with the scene's most recent frame time, retained from the last `applyIntents`/`applySnapshot` and defaulting to `0` when `update` runs without a prior frame. Neither the spec nor the plan pins an observable read surface for that retained value (no `lastFrameTime`/frame-time accessor on `SceneView`, and `particles` is internal), so a test cannot assert the default-`0` path or that a retained value is used. This is the same class of gap as r1 F1 (shot-count observability). | Pin the observable frame-time surface in plan § Interfaces/contracts — e.g. `readonly lastFrameTime: number` on `SceneView` (and state in AC-5 that it is the evidence path for the frame-time clause, default `0`) — or, alternatively, justify and pin testing via particle recycling ordering. | open |
| F9 | MINOR | spec.md § Acceptance criteria AC-2 | AC-2 pins the reduced-motion factor as `1` "for any `dtMs > 0`", leaving `dtMs === 0` unspecified. A builder/test author cannot tell whether a zero-dt reduced-motion update should snap (`1`) or do nothing (`0`), and the two choices differ on the first frame. | State the expected factor for `dtMs === 0` under reduced motion (recommended: `1`, so reduced motion always snaps regardless of elapsed time; or `0` to match the no-elapsed-time semantics) and update the AC wording accordingly. | open |
| F10 | MINOR | docs/features/spaceship-cursor/status.md (frontmatter) | The status frontmatter contains a duplicate `spec_review_round` key (`2` then `1`), which is ambiguous to YAML parsers and to the orchestrator's state tracking. | Collapse to a single `spec_review_round: 2` key. | open |
| F11 | MINOR | spec.md § Acceptance criteria AC-7 | AC-7 says the session "computes NDC from the rect" but does not pin the conversion (in particular the y-axis sign / origin). NDC is conventional, but an un-pinned formula lets a test assert either orientation and is a latent source of wrong-work if the implementation flips y. | Pin the conversion in AC-7 (recommended: `ndcX = (clientX - rect.left) / rect.width * 2 - 1`, `ndcY = 1 - (clientY - rect.top) / rect.height * 2`, then clamp both to `[-1, 1]`). | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every request ask (follow cursor, 3D ship, shoot minicube, explode) is covered by AC-1…AC-8 or listed as non-goal; no scope invented beyond reduced-motion collapse and local-only flag (both justified/flagged). |
| Testability | ❌ | AC-5 frame-time clause lacks a pinned observable accessor (F8); AC-2 leaves the `dtMs === 0` reduced-motion case unspecified (F9); AC-7 leaves the NDC conversion formula unpinned (F11). |
| Boundaries | ✅ | Three tiers present; non-goals listed (no rules/state/protocol/persistence change, no multiplayer visibility, no audio/deps/assets/shaders, no customisation UI, no browser automation). |
| Dependency graph | ✅ | T1→T2→T3→T4 acyclic; every AC mapped (AC-1…AC-8 to T1–T3, AC-9/AC-10 to T4); tasks sized to one builder session. |
| Parallel safety | ✅ | All tasks `[seq]`; no `[P]` task, so no shared-file contact to collide. |
| Security | ✅ | No new dependencies; no user data/storage/network; procedural geometry only; shots bounded and cleared on dispose; no coverage gaming. |
| Testing | ✅ | Unit + integration tiers, commands from AGENTS.md, `npm run coverage` with ≥80% ×4 named, assertion-quality/no-useless-tests bar referenced, edge cases (reduced motion, disposal, rebuild) named. |
| Consistency | ✅ | Aligns with vision (local client visuals) and reuses existing scene/session architecture; only wording/observability gaps noted above. |
| Real-time | ✅ | Explicitly none for shared state; connection lifecycle/reconnection/multi-client/server authority stated as unaffected; Q-1 flags the cross-client alternative. |
| Containers | ✅ | Explicitly none; no services/images/ports/env/health changes; AC-10 guards container/backend paths. |

## Previous round verification (r1)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) MAJOR — shot-count observable accessor | fixed | spec.md § AC-4/AC-8 now pin `SceneView.shots: readonly Shot[]` (delegating to `Spaceship.shots`), emptied by `dispose()`; plan.md § Interfaces/contracts lines 31/44; decision D-7. |
| F2 (r1) MAJOR — unprojection method + expected vector | fixed | spec.md § AC-3 pins the ray-through-offset-NDC / Euclidean-distance formula and the expected vector `(-0.139757, -0.223611, 6.005798)` (verified against three.js unproject for the default camera). |
| F3 (r1) MAJOR — deferred-explosion origin/normal capture timing | fixed | spec.md § AC-4 states origin/normal captured at fire time and stored in the deferred queue; plan.md § Interfaces/contracts `PendingExplosion { origin, normal }`; decision D-6. |
| F4 (r1) MINOR — Summary shape wording | fixed | spec.md § Summary now reads "cone (nose) + box (body) + small sphere (cockpit)", matching Q-3. |
| F5 (r1) MINOR — constant-assertion evidence file | fixed | spec.md § AC-2/AC-3 and § Testing strategy attribute pinned constants to `effects-spaceship.test.ts`. |
| F6 (r1) MINOR — retained frame-time default | partially fixed | Retention and default-`0` are now stated in AC-5 and the plan, but the observable read surface is not pinned — raised as F8. |
| F7 (r1) MINOR — no-pointer behaviour | fixed | spec.md § AC-2 pins rest at `(0, 0, 6)` with no smoothing until first `setPointerTarget`. |

## Notes / backlog (non-blocking)

- Q-1…Q-5 are user checkpoints with stated defaults; none blocks building, but Q-1 (cross-client visibility) and Q-2 (state vs. visual timing) should be confirmed with the user before acceptance.
- The deferred-explosion queue and shot lifetime depend on `update` dt accumulation; tests should use fixed dt steps (already noted in plan Risks).
- INFO: in-flight shots are not explicitly capped; the spec asserts "no unbounded growth" on the basis that each shot is removed on arrival (~180 ms). Acceptable for the click rate, but a future enhancement could add a cap mirroring the particle pool. Not a blocker.
- Only F8 blocks; F9–F11 are documentation/precision improvements that should be folded into r3 alongside F8.