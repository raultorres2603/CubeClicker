---
feature: realistic-lighting-materials
phase: code
iteration: 1
verdict: changes_requested
blocking: 1
nonblocking: 3
---

# Code Review — r1

## Summary
❌ changes requested — implementation meets AC-1, AC-2, AC-4–AC-9 with a green verification suite (lint/typecheck/test/coverage/build/smoke all pass); AC-3 is unmet on evidence because `cube-view.test.ts` and `spaceship.test.ts` neither import nor assert `MATERIAL_CLEARCOAT`/`material.clearcoat`. One MINOR stale type cast and two INFO notes remain.

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `webgl.test.ts` pins `toneMapping === ACESFilmicToneMapping`, `toneMappingExposure === TONE_MAPPING_EXPOSURE === 1.0`, `outputColorSpace === SRGBColorSpace`, `shadowMap.type === PCFSoftShadowMap`, `shadowMap.enabled === true`, `antialias === true` (`webgl.ts:30-39`). |
| AC-2 | ✅ | `scene.test.ts` pins `KEY_SHADOW_MAP_SIZE === 2048`, `KEY_SHADOW_BIAS === -0.0001`, `KEY_SHADOW_NORMAL_BIAS === 0.02`, `KEY_SHADOW_RADIUS === 2` (`scene.ts:103-113`). |
| AC-3 | ❌ | `cube-view.ts:72-76` and `spaceship.ts:37-41` export `MATERIAL_CLEARCOAT = 0.35` / `MATERIAL_CLEARCOAT_ROUGHNESS = 0.2` and set `material.clearcoat`/`clearcoatRoughness`, and materials are `MeshPhysicalMaterial`, but `cube-view.test.ts` and `spaceship.test.ts` contain no import or assertion of `MATERIAL_CLEARCOAT` or `material.clearcoat` (grep: 0 matches). Evidence missing → unmet. |
| AC-4 | ✅ | `postprocessing.test.ts` asserts passes array exactly `[RenderPass, SSAOPass, UnrealBloomPass, OutputPass]`; SSAO constants `SSAO_KERNEL_RADIUS === 0.5`, `SSAO_MIN_DISTANCE === 0.005`, `SSAO_MAX_DISTANCE === 0.1` (`postprocessing.ts:22-26, 72-75`). |
| AC-5 | ✅ | `postprocessing.test.ts` asserts `BLOOM_STRENGTH === 0.45`, `BLOOM_RADIUS === 0.4`, `BLOOM_THRESHOLD === 0.85` (`postprocessing.ts:28-33`). |
| AC-6 | ✅ | `webgl.test.ts` asserts base renderer built immediately, composer constructed lazily on first `render(scene, camera)` with buffering/replay; `browser-env.test.ts` pins factory swap to `createRealisticRenderer` (`webgl.ts:77-128`). |
| AC-7 | ✅ | `postprocessing.test.ts` keeps pass params unchanged after `render()`; `starfield.test.ts` and `app.css.test.ts` unchanged reduced-motion handling (build-log-T5). |
| AC-8 | ✅ | `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0 (build-log-T5). |
| AC-9 | ✅ | `npm run coverage` exit 0; backend 94.34/85.93/99.68/94.34; frontend 95/94.94/95.75/95 (all ≥ 80). |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `src/frontend/src/render/cube-view.test.ts`, `src/frontend/src/render/spaceship.test.ts` (missing assertions) | AC-3 evidence gap: owning modules export `MATERIAL_CLEARCOAT = 0.35` and `MATERIAL_CLEARCOAT_ROUGHNESS = 0.2` and assign `material.clearcoat`/`clearcoatRoughness`, but neither test imports or asserts these constants or `material.clearcoat`. | Add concrete assertions pinning the exported constants and the material clearcoat values (one test per owning module), per the AC-3 evidence requirement. | open |
| F2 | MINOR | `src/frontend/src/render/scene.ts:828` | Stale type cast in `applyAppearanceToSpaceship`: casts `object.material as MeshStandardMaterial` while materials are now `MeshPhysicalMaterial`. | Update the cast (and the import) to `MeshPhysicalMaterial`. | open |
| F3 | INFO | `src/frontend/src/render/postprocessing.ts:54` (`createPostprocessing`) | Pass sizing at construction: SSAO/bloom passes are not explicitly sized from the renderer's drawing buffer; the real path relies on `EffectComposer` construction + buffered replay, but direct construction leaves 0×0. Not pinned by an AC. | None required (optional: size passes at construction). | open |
| F4 | INFO | `docs/architecture/documentation.md` (documentation pass) | Documentation pass runs on acceptance; `tasks.md` declares no README/architecture/container doc changes. No doc edits in the diff yet — acceptable at code_review; orchestrator confirms the pass before `accepted`. | None at the code gate. | open |

## Verification performed
- `npm run lint` → exit 0 (no errors).
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → backend 22 test files / 700 tests; frontend 48 test files / 1223 tests; exit 0.
- `npm run coverage` → exit 0; backend All files 94.34 / 85.93 / 99.68 / 94.34; frontend All files 95 / 94.94 / 95.75 / 95 (all ≥ 80).
- `npm run build` → exit 0, built in 1.39s.
- `npm run smoke` → 12/12 checks, exit 0.
- `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0.
- Banned-matcher scan of `src/frontend/src/render/*.test.ts` → 0 matches (`expect.any`, `objectContaining`, `arrayContaining`, `stringContaining`, `stringMatching`, `toMatchObject`, snapshots, `toBeTruthy`/`toBeDefined` stand-ins).

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependencies; no secrets; no DOM injection; backend/container files untouched; `.env*` untouched. |
| Quality | ✅ | Pure render separation; no dead code; diff traceable to tasks. Minor stale cast recorded as F2. |
| Testing | ❌ | AC-3 test evidence missing (F1). Coverage ≥ 80% both workspaces; no banned matchers in changed render tests. |

## Previous round verification
n/a — first code round (spec review r2 was approved; see `reviews/spec-r2.md`).

## Notes / backlog (non-blocking)
- F2, F3, F4 are non-blocking; F1 is the single blocking (MAJOR) item.
- Open questions Q-1..Q-5 remain open with their documented defaults; no spec revision requested.
- Real-time/shared-state impact is none (client-local visuals only); containerization contract holds (AC-8).
- Documentation pass (`docs/architecture/documentation.md`) to be confirmed by the orchestrator before `accepted`.
