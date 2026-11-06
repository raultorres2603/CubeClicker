---
feature: realistic-lighting-materials
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 5
---

# Spec Review — r2

## Summary
✅ approved — r1's F1 (composer construction timing) and F2 (composer composition order) are resolved by the revised AC-4/AC-6 lazy-construction contract, and F3/F4 are addressed. No BLOCKER or MAJOR regressions found; only MINOR/INFO improvements remain.

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | spec.md § Acceptance criteria (AC-4) | `createPostprocessing(renderer, scene, camera)` returns `{ render, setSize, setPixelRatio, dispose }`, but AC-4 only pins composition and SSAO constants; it does not state that `setSize`/`setPixelRatio` forward to the composer and that `dispose` releases the passes/render targets. The plan requires forwarding, but the AC leaves it implicit, so a builder could skip it and no AC would fail. | Add one sentence to AC-4 requiring that the returned `setSize`/`setPixelRatio` forward to the composer and `dispose` releases the composer's render targets/passes. | open |
| F2 | MINOR | tasks.md § T1 (acceptance: AC-4, AC-5) | AC-7's evidence list includes `postprocessing.test.ts` (static pass params), but T1's acceptance list does not include AC-7 even though T1 owns `postprocessing.test.ts`; T5 owns no files and cannot author that assertion. The AC is mapped only to T5, leaving its postprocessing half without an owning task. | Add AC-7 to T1's acceptance list (postprocessing static-params assertion) so ownership is explicit; keep T5 for verification. | open |
| F3 | INFO | tasks.md § Dependency overview / T3, T4 | T3 (scene) and T4 (materials) declare `depends_on: T1`, but neither imports `postprocessing.ts`; the dependency only serializes them behind T1 without need. | Drop the T1 dependency from T3 and T4 (keep T2 → T1) to restore intended parallelism; optional. | open |
| F4 | INFO | spec.md § Acceptance criteria (AC-6) | The replay order of buffered `setSize`/`setPixelRatio` values at composer construction is unspecified. `applyViewport` calls `setPixelRatio` then `setSize`; replaying in the opposite order could size render targets with a stale pixel ratio. | Specify replay as `setPixelRatio` then `setSize` (matching `applyViewport`), or state that order is implementation-defined if tests do not assert it. | open |
| F5 | INFO | spec.md § Acceptance criteria (AC-2) vs predecessor modern-visual-overhaul AC-4 | The spec supersedes the predecessor's 1024×1024 shadow map with 2048×2048 but does not state this supersession explicitly, which may confuse readers reconciling the two specs. | Add a one-line note in AC-2 or Assumptions stating that this feature supersedes modern-visual-overhaul AC-4's shadow-map size. | open |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All request asks (tone mapping, soft shadows, PBR+clearcoat, SSAO, bloom) covered by AC-1..AC-6; non-goals explicit. |
| Testability | ✅ | r1 F1/F2 resolved; ACs are binary-testable with concrete constants and evidence files. Minor forwarding gap noted (F1). |
| Boundaries | ✅ | Three tiers present; non-goals listed; frontend-only boundary explicit. |
| Dependency graph | ✅ | Acyclic; every AC mapped; T3/T4 over-serialization is INFO only. |
| Parallel safety | ✅ | T3/T4 `[P]` own disjoint files; no shared-file contact. |
| Security | ✅ | No new npm dependency; no user data/network; procedural only; dispose releases resources. |
| Testing | ✅ | Unit + integration + container tiers named; `npm run coverage` ≥ 80% all four metrics; concrete-assertion bar referenced. |
| Consistency | ✅ | Aligns with predecessor pattern; shadow-map supersession noted as INFO. |
| Real-time | ✅ | None for shared state; visuals remain client-local; Q-2 carries over with local-only default. |
| Containers | ✅ | No service/image/port/env change; AC-8 pins the container-file diff gate. |

## Previous round verification
| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | fixed | AC-6 now specifies lazy composer construction on first `render(scene, camera)` with buffered `setSize`/`setPixelRatio` (last value wins) and replay at construction; plan § Interfaces updated. |
| F2 (r1) | fixed | AC-4 now pins composer order `RenderPass, SSAOPass, UnrealBloomPass, OutputPass` with evidence in `postprocessing.test.ts`. |
| F3 (r1) | fixed | Non-goals now explicitly permit library-provided post-processing shaders from `three/examples/jsm/postprocessing/*`. |
| F4 (r1) | fixed | AC-7 evidence list now includes `postprocessing.test.ts` and requires static pass params. |

## Notes / backlog (non-blocking)
- Scope is large (Q-5); predecessor `modern-visual-overhaul` was comparable and accepted, so one feature is acceptable unless review prefers a split.
- Real-time impact is correctly "none for shared state"; all visuals remain client-local. Q-2 (cross-client visibility) carries over with local-only default.
- Containerization impact is none; AC-8 pins the container-file diff gate. No compose/Dockerfile/README change required.
- Replay sizing note: `createPostprocessing` should size `SSAOPass`/`UnrealBloomPass` from the renderer's current drawing-buffer size at construction (after buffered `setSize` replay), so passes are not created at 0×0; implementation detail, not pinned by an AC.
- Low-end performance (Q-4) and tuning (Q-3) remain open questions with sensible defaults.