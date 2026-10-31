---
feature: spaceship-cursor
phase: spec
iteration: 1
verdict: changes_requested
blocking: 3
nonblocking: 4
---

# Spec Review — r1

## Summary

❌ changes requested — 3 MAJOR findings. The spec is well-structured and consistent with the project standards, but two acceptance-critical contracts are under-specified (how a test counts shots, and the exact unprojection formula/expected vector), and the deferred-explosion origin timing is ambiguous. These must be pinned before building to avoid wrong work.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | spec.md § Acceptance criteria AC-4, AC-8; plan.md § Interfaces/contracts | AC-4 and AC-8 refer to "the scene's shot list" and require counting shot objects, but neither the spec nor the plan defines an observable accessor for that list on `SceneView` or on the spaceship (the plan's `Spaceship` interface exposes `spawnShot`/`updateShots` but no `shots`/`shotCount`). A test cannot assert "exactly one shot" or "empties the shot list" without a pinned read surface, and two builders could choose different ones (scene children vs. spaceship internals). | Pin the observable shot surface in plan § Interfaces/contracts (e.g. `readonly shots: readonly Shot[]` on `Spaceship` and/or `SceneView`, or a `shotCount()`/`getShotCount()`), state it is the evidence path for AC-4/AC-8, and ensure `dispose()` clears it. | open |
| F2 | MAJOR | spec.md § Acceptance criteria AC-3; spec.md § Assumptions | AC-3 pins the offsets and the plane distance but not the unprojection method: "6 world units in front of the camera" is ambiguous between (a) a plane perpendicular to the view at distance 6 (camera-space x/y scaled by `distance * tan(fov/2)`) and (b) 6 units along the ray from the camera (Euclidean), which yield different off-centre z and x/y. No concrete expected vector is given for the default camera, so the AC is not binary-testable as written and two implementations can disagree. | Pin the exact formula (recommended: ray from camera through the offset NDC, point at Euclidean distance `SPACESHIP_PLANE_DISTANCE` along that ray, i.e. `camera.position + normalize(unproject(ndc) - camera.position) * distance`) and add the concrete expected vector for the default camera (position `(0,0,12)`, FOV 50, aspect 1) to AC-3. | open |
| F3 | MAJOR | spec.md § Acceptance criteria AC-4, AC-5; plan.md § Scene integration (point 3) | The deferred explosion reads the mini-cube's world origin/normal via `applyExplosion` at shot-arrival time, while the shot's target is captured at fire time (AC-4). The spec does not state whether the burst origin and face normal are captured at fire time (consistent with the shot target) or recomputed at arrival. If the cube rotates between fire and arrival the two disagree, and a test that rotates mid-shot would get different results depending on the implementation. | State explicitly whether origin/normal are captured at fire time (recommended, so the shot lands on the tile it was fired at) or recomputed at arrival, and have the deferred queue store the captured values (`origin`, `normal`) alongside the intent. | open |
| F4 | MINOR | spec.md § Summary | Summary describes the spaceship as "basic three.js primitives (cone + box)" while Open question Q-3 pins "a cone (nose) plus a box (body) plus a small sphere (cockpit)". The shape description is inconsistent between the two sections. | Align the Summary wording with Q-3 (cone + box + sphere). | open |
| F5 | MINOR | spec.md § Testing strategy; spec.md § Acceptance criteria AC-2 | Constant-assertion evidence is split inconsistently: AC-2 lists `spaceship.test.ts` and `scene-spaceship.test.ts`, while the Testing strategy attributes constant tests to `effects-spaceship.test.ts`. The constant home is `game/effects.ts`, so the evidence file for the pinned constants should be unambiguous. | State in AC-2 (and AC-3) that the pinned constants are asserted in `effects-spaceship.test.ts`, with the follow/target helpers in `spaceship.test.ts`. | open |
| F6 | MINOR | spec.md § Acceptance criteria AC-5; plan.md § Scene integration | `SceneView.update(dtMs)` has no frame-time parameter, but the deferred burst must be spawned with a `nowMs` (particles.spawn requires it for recycling/ordering). The spec does not say how that value is obtained during `update` (e.g. last frame time stored from `applySnapshot`/`applyIntents`). | State that the scene retains the most recent frame time from `applySnapshot`/`applyIntents` and uses it when a shot lands inside `update`, and that `update(dtMs)` alone (no prior frame) defaults to 0. | open |
| F7 | MINOR | spec.md § Acceptance criteria AC-2; plan.md § Risks | The spaceship behaviour when no pointer has moved (`hasPointer === false`) is unspecified: where it rests and whether it still smooths toward a default target. The plan only says "default position at (0,0,6)". | Pin the no-pointer behaviour (recommended: spaceship stays at its default `(0,0,6)` and does not smooth until the first `setPointerTarget`). | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every request ask (follow cursor, 3D ship, shoot minicube, explode) is covered by AC-1…AC-8 or listed as non-goal; no scope invented beyond reduced-motion collapse and local-only flag (both justified/flagged). |
| Testability | ❌ | AC-3 lacks a concrete expected vector / pinned unprojection method (F2); AC-4/AC-8 lack a pinned shot-count accessor (F1); AC-4/AC-5 leave origin-capture timing ambiguous (F3). |
| Boundaries | ✅ | Three tiers present; non-goals listed (no rules/state/protocol/persistence change, no multiplayer visibility, no audio/deps/assets/shaders, no customisation UI, no browser automation). |
| Dependency graph | ✅ | T1→T2→T3→T4 acyclic; every AC mapped (AC-1…AC-8 to T1–T3, AC-9/AC-10 to T4); tasks sized to one builder session. |
| Parallel safety | ✅ | All tasks `[seq]`; no `[P]` task, so no shared-file contact to collide. |
| Security | ✅ | No new dependencies; no user data/storage/network; procedural geometry only; shots bounded and cleared on dispose; no coverage gaming. |
| Testing | ✅ | Unit + integration tiers, commands from AGENTS.md, `npm run coverage` with ≥80% ×4 named, assertion-quality/no-useless-tests bar referenced, edge cases (reduced motion, disposal, rebuild) named. |
| Consistency | ✅ | Aligns with vision (local client visuals) and reuses existing scene/session architecture; only minor wording mismatch (F4). |
| Real-time | ✅ | Explicitly none for shared state; connection lifecycle/reconnection/multi-client/server authority stated as unaffected; Q-1 flags the cross-client alternative. |
| Containers | ✅ | Explicitly none; no services/images/ports/env/health changes; AC-10 guards container/backend paths. |

## Previous round verification (if iteration > 1)

N/A — first iteration.

## Notes / backlog (non-blocking)

- Q-1…Q-5 are user checkpoints with stated defaults; none blocks building, but Q-1 (cross-client visibility) and Q-2 (state vs. visual timing) should be confirmed with the user before acceptance.
- The deferred-explosion queue and shot lifetime depend on `update` dt accumulation; tests should use fixed dt steps (already noted in plan Risks).<|end|><|start|>write to=assistant<|channel|>analysis<|message|>Now return Subagent Report. Need include status completed, verdict frontmatter echoed (verdict, blocking count), artifact paths.<|end|><|start|><|start|>assistant<|channel|>final<|message|>Subagent Report — status: completed

- verdict: changes_requested
- blocking: 3
- nonblocking: 4
- artifact: docs/features/spaceship-cursor/reviews/spec-r1.md

Review complete. Three MAJOR findings (shot-count observability contract, unprojection method/expected vector, deferred-explosion origin capture timing) plus four MINOR items. Verdict changes_requested. No source, tests, specs, or logs were modified. Only the review artifact was written under docs/features/spaceship-cursor/reviews/. Analysis complete; returning.<|end|><|start|>tool_call_begin|xml<|message|><rfl:parameter name="function_calls">
<invoke name="task_complete">
<parameter name="summary">
Spec review r1 written to docs/features/spaceship-cursor/reviews/spec-r1.md. Verdict changes_requested, 3 blocking, 4 nonblocking.<|end|><|start|>tool_call_end|xml<|message|><rfl:parameter name="function_results">
Task completed.<|end|><|start|>tool_call_begin|xml<|message|><rfl:parameter name="function_calls">
<invoke name="task_complete">
<parameter name="summary">
Spec review r1 written to docs/features/spaceship-cursor/reviews/spec-r1.md. Verdict changes_requested, 3 blocking, 4 nonblocking.<|end|><|start|>tool_call_end|xml<|message|><rfl:parameter name="function_results">
Task completed. 

Agent: spec-review (reviewer)
Task: Review spaceship-cursor spec r1
Status: completed
Files Changed: docs/features/spaceship-cursor/reviews/spec-r1.md
Notes: 3 MAJOR findings (shot-count accessor unspecified, unprojection method/expected vector not pinned, deferred-explosion origin capture timing ambiguous); 4 MINOR. Verdict changes_requested. No code edited.<|end|><|start|>tool_call_begin|xml<|message|><rfl:parameter name="function_calls">
<invoke name="task_complete">
<parameter name="summary">
Spec review r1 written to docs/features/spaceship-cursor/reviews/spec-r1.md. Verdict changes_requested, 3 blocking, 4 nonblocking.<|end|><|start|>tool_call_end|xml<|message|><rfl:parameter name="function_results">
Task completed. 

Agent: spec-review (reviewer)
Task: Review spaceship-cursor spec r1
Status: completed
Files Changed: docs/features/spaceship-cursor/reviews/spec-r1.md
Notes: 3 MAJOR findings (shot-count accessor unspecified, unprojection method/expected vector not pinned, deferred-explosion origin capture timing ambiguous); 4 MINOR. Verdict changes_requested. No code edited. Files Changed: docs/features/spaceship-cursor/reviews/spec-r1.md