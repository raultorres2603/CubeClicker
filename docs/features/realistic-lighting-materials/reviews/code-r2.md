---
feature: realistic-lighting-materials
phase: code
iteration: 2
verdict: approved
blocking: 0
nonblocking: 2
---

# Code Review — r2

## Summary
✅ approved — F1 (AC-3 clearcoat test evidence) and F2 (stale `MeshStandardMaterial` cast in `scene.ts`) from code-r1 are resolved. Re-verified AC-1..AC-9; lint, typecheck, tests, coverage (both workspaces), build, and container diff gate all pass; smoke 12/12. No new regressions found. Two INFO items (F3, F4) remain non-blocking.

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `webgl.test.ts` pins `toneMapping === ACESFilmicToneMapping`, `toneMappingExposure === TONE_MAPPING_EXPOSURE === 1.0`, `outputColorSpace === SRGBColorSpace`, `shadowMap.type === PCFSoftShadowMap`, `shadowMap.enabled === true`, `antialias === true` (`webgl.ts:30-39`). |
| AC-2 | ✅ | `scene.test.ts` pins `KEY_SHADOW_MAP_SIZE === 2048`, `KEY_SHADOW_BIAS === -0.0001`, `KEY_SHADOW_NORMAL_BIAS === 0.02`, `KEY_SHADOW_RADIUS === 2` (`scene.ts:103-113, 398-401`). |
| AC-3 | ✅ | Resolved (F1). `cube-view.test.ts` `materials (AC-3)` imports `MATERIAL_CLEARCOAT`/`MATERIAL_CLEARCOAT_ROUGHNESS`, pins `0.35`/`0.2`, asserts body + every tile `InstancedMesh` material is `MeshPhysicalMaterial` with `clearcoat === MATERIAL_CLEARCOAT` and `clearcoatRoughness === MATERIAL_CLEARCOAT_ROUGHNESS` (`cube-view.ts:73,76,237-238,265-266`). `spaceship.test.ts` `materials (AC-3)` does the same for every mesh under `group` (`spaceship.ts:38,41,172-236`); shot meshes remain `MeshBasicMaterial` (`spaceship.ts:268`). |
| AC-4 | ✅ | `postprocessing.test.ts` asserts passes array exactly `[RenderPass, SSAOPass, UnrealBloomPass, OutputPass]`; SSAO constants `SSAO_KERNEL_RADIUS === 0.5`, `SSAO_MIN_DISTANCE === 0.005`, `SSAO_MAX_DISTANCE === 0.1` (`postprocessing.ts:22-26, 72-75`). |
| AC-5 | ✅ | `postprocessing.test.ts` asserts `BLOOM_STRENGTH === 0.45`, `BLOOM_RADIUS === 0.4`, `BLOOM_THRESHOLD === 0.85` (`postprocessing.ts:28-33`). |
| AC-6 | ✅ | `webgl.test.ts` asserts base renderer built immediately, composer constructed lazily on first `render(scene, camera)` with buffering/replay; `browser-env.test.ts` pins factory swap to `createRealisticRenderer` (`webgl.ts:77-128`). |
| AC-7 | ✅ | `postprocessing.test.ts` keeps pass params unchanged after `render()`; `starfield.test.ts` and `app.css.test.ts` unchanged reduced-motion handling. |
| AC-8 | ✅ | `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0. |
| AC-9 | ✅ | `npm run coverage` exit 0; backend 94.34/85.93/99.68/94.34; frontend 95/94.94/95.75/95 (all ≥ 80). |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `src/frontend/src/render/cube-view.test.ts`, `src/frontend/src/render/spaceship.test.ts` (r1) | AC-3 evidence gap. | Resolved: both tests now import and assert `MATERIAL_CLEARCOAT`/`MATERIAL_CLEARCOAT_ROUGHNESS` and `material.clearcoat` on every PBR surface. | resolved |
| F2 | MINOR | `src/frontend/src/render/scene.ts:828` (r1) | Stale `MeshStandardMaterial` cast. | Resolved: import and cast updated to `MeshPhysicalMaterial` (`scene.ts:55, 828`). | resolved |
| F3 | INFO | `src/frontend/src/render/postprocessing.ts:54` (`createPostprocessing`) | Pass sizing at construction: SSAO/bloom passes are not explicitly sized from the renderer's drawing buffer; direct construction leaves 0×0 until buffered replay. Not pinned by an AC. | None required (optional: size passes at construction). | open |
| F4 | INFO | `docs/architecture/documentation.md` (documentation pass) | Documentation pass runs on acceptance; `tasks.md` declares no README/architecture/container doc changes. No doc edits in the diff yet — acceptable at code_review; orchestrator confirms the pass before `accepted`. | None at the code gate. | open |

## Verification performed
- `npm run lint` → exit 0 (no errors).
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → backend 22 test files / 700 tests; frontend 48 test files / 1225 tests; exit 0.
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0; All files 95 / 94.94 / 95.75 / 95.
- `npm run coverage` → exit 0; backend All files 94.34 / 85.93 / 99.68 / 94.34; frontend All files 95 / 94.94 / 95.75 / 95 (all ≥ 80).
- `npm run build` → exit 0, built in 1.37s.
- `npm run smoke` → 12/12 checks, exit 0.
- `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0.
- Banned-matcher scan of `src/frontend/src/render/*.test.ts` → 0 matches.

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependencies; no secrets; no DOM injection; backend/container files untouched; `.env*` untouched. |
| Quality | ✅ | Pure render separation; no dead code; diff traceable to tasks. Stale cast from r1 resolved. |
| Testing | ✅ | AC-3 evidence present in both owning modules (F1 resolved); coverage ≥ 80% both workspaces; no banned matchers in changed render tests. |

## Previous round verification
- r1 blocking F1 (MAJOR) resolved: `cube-view.test.ts` and `spaceship.test.ts` now import and assert `MATERIAL_CLEARCOAT`/`material.clearcoat` (concrete values 0.35/0.2) on body + every tile/ship mesh.
- r1 F2 (MINOR) resolved: `scene.ts` cast is now `MeshPhysicalMaterial`.
- F3 and F4 remain INFO/non-blocking and unchanged.

## Notes / backlog (non-blocking)
- F3, F4 are non-blocking; no open BLOCKER or MAJOR.
- Open questions Q-1..Q-5 remain open with their documented defaults; no spec revision requested.
- Real-time/shared-state impact is none (client-local visuals only); containerization contract holds (AC-8).
- Documentation pass (`docs/architecture/documentation.md`) to be confirmed by the orchestrator before `accepted`.