---
feature: realistic-lighting-materials
phase: spec
iteration: 1
verdict: changes_requested
blocking: 2
nonblocking: 2
---

# Spec Review — r1

## Summary
❌ changes requested — the spec pins two incompatible construction signatures (`createPostprocessing(renderer, scene, camera)` vs `createRealisticRenderer(canvas)`) without stating how/when the composer is built, which will block implementation against the session lifecycle; and it omits the `OutputPass`/`RenderPass` composition that the plan requires for tone-mapped output. Fix these before building.

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | spec.md § Acceptance criteria (AC-6); plan.md § Interfaces / § Architecture | `createRealisticRenderer(canvas)` only receives a canvas, but `createPostprocessing(renderer, scene, camera)` (AC-4) needs `scene` and `camera`, and the session creates the scene before calling `rendererFactory` without passing it (see `src/frontend/src/game/session.ts` ~L950). The spec does not state when the composer is constructed or how `setSize`/`setPixelRatio` issued before the first frame (applyViewport runs before the first render, ~L1161) are buffered/forwarded. As written, AC-4 and AC-6 cannot both be satisfied literally. | Revise AC-6 (and AC-4) to specify composer construction timing — e.g. lazy construction on the first `render(scene, camera)` with buffered resize/pixel-ratio application, or an explicit init hook — and update plan.md § Interfaces accordingly. Keep `RendererAdapter` and factory signatures unchanged. | open |
| F2 | MAJOR | spec.md § Acceptance criteria (AC-4, AC-5); plan.md § Architecture | The plan builds the composer as `EffectComposer` + `RenderPass` + `SSAOPass` + `UnrealBloomPass` + `OutputPass`, but the ACs only pin `SSAOPass` and `UnrealBloomPass`. Without `OutputPass` (and a `RenderPass` bound to the scene/camera) the tone mapping set in AC-1 will not be applied to the post-processed output, so the visual goal is unverifiable and the builder has no pinned contract for composition order. | Add an AC (or extend AC-4) pinning composer composition: a `RenderPass(scene, camera)`, the `SSAOPass`, the `UnrealBloomPass`, and an `OutputPass`, in that order, with concrete evidence in `postprocessing.test.ts`. | open |
| F3 | MINOR | spec.md § Non-goals ("No … hand-authored shaders") / Security considerations | The non-goal forbids shaders, but the default path uses `three/examples/jsm/postprocessing/*`, which internally ships shaders. The intent (no *custom* shaders) is implied but not stated, which risks a reviewer/builder misreading the non-goal as forbidding the default path. | Add one sentence clarifying that library-provided post-processing shaders are permitted (no hand-authored shader code), matching Q-1's default. | open |
| F4 | MINOR | spec.md § Acceptance criteria (AC-7) | AC-7 claims post-processing passes are static, but its evidence list (`starfield.test.ts`, `app.css.test.ts`) does not include `postprocessing.test.ts`, so the "no time-varying parameters" claim is not directly pinned by a test. | Add `postprocessing.test.ts` to AC-7's evidence list and require a concrete assertion that pass parameters are static constants (no per-frame mutation). | open |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All request asks (tone mapping, soft shadows, PBR+clearcoat, SSAO, bloom) covered by AC-1..AC-6; non-goals explicit. |
| Testability | ❌ | F1 (construction timing) and F2 (composition order) are not binary-testable as written. |
| Boundaries | ✅ | Three tiers present; non-goals listed; frontend-only boundary explicit. |
| Dependency graph | ✅ | T1 → (T2 ∥ T3 ∥ T4) → T5; acyclic; every AC mapped. |
| Parallel safety | ✅ | T3/T4 `[P]` own disjoint files; no shared-file contact. |
| Security | ✅ | No new npm dependency; no user data/network; procedural only; dispose releases resources. |
| Testing | ✅ | Unit + integration + container tiers named; `npm run coverage` ≥ 80% all four metrics; concrete-assertion bar referenced. |
| Consistency | ✅ | Aligns with predecessor pattern; supersedes shadow-map size via AC-2 (note predecessor AC-4 remains 1024 in its own spec, untouched). |

## Previous round verification (if iteration > 1)
| Finding | Status | Evidence |
| --- | --- | --- |
| — | — | — |

## Notes / backlog (non-blocking)
- Scope is large (Q-5); predecessor `modern-visual-overhaul` was comparable and accepted, so one feature is acceptable unless review prefers a split.
- Real-time impact is correctly "none for shared state"; all visuals remain client-local. Q-2 (cross-client visibility) carries over with local-only default.
- Containerization impact is none; AC-8 pins the container-file diff gate. No compose/Dockerfile/README change required.