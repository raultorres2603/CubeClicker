---
feature: modern-visual-overhaul
phase: code
iteration: 1
verdict: changes_requested
blocking: 2
nonblocking: 3
---

# Code Review — r1

## Summary

❌ changes requested — Implementation of AC-1…AC-10 is present and the verification suite (lint, typecheck, tests, coverage, build, container diff, smoke) is green, but AC-4 lacks direct test evidence: shadow assertions are missing from `scene.test.ts` and `cube-view.test.ts`, and the WebGL shadow-map assertion is thin. Two MAJOR findings block approval; three MINOR/INFO items are non-blocking.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `starfield.test.ts` (constants `STAR_MIN_BRIGHTNESS === 0.75`, `STAR_SIZE === 0.8`, opacity base 1.0, `STAR_COUNT === 1200` from `effects.ts`) |
| AC-2 | ✅ | `starfield.test.ts` (`pulseTimeMs`, `averageBrightness`, twinkle formula, reduced-motion opacity 1.0) |
| AC-3 | ✅ | `starfield.test.ts`, `scene.test.ts` (ambient intensity `0.525` = `0.6 * clamp(0.875, 0.5, 1.0)` at `scene.ts:360-364`) |
| AC-4 | ❌ (impl present, tests missing) | Impl: `scene.ts:367-368` (key light `castShadow`, `shadow.mapSize` 1024×1024), `cube-view.ts:233-234`/`259-260` (body + face `InstancedMesh` cast/receive), `webgl.ts:32` (`renderer.shadowMap.enabled = true`). Test assertions absent in `scene.test.ts`/`cube-view.test.ts` (F1); WebGL assertion thin (F2) |
| AC-5 | ✅ | `spaceship.test.ts` (fighter geometry/materials, `SPACESHIP_SCALE === 1.2`, `SPACESHIP_IGNITION_COUNT === 2`) |
| AC-6 | ✅ | `Hud.test.tsx` (minimize props, toggle button, `data-minimized`) |
| AC-7 | ✅ | `app.css.test.ts` (transitions ≤200ms, scale, collapse, pointer-events) |
| AC-8 | ✅ | `starfield.test.ts`, `app.css.test.ts` (reduced-motion) |
| AC-9 | ✅ | `git diff --exit-code …` empty (build-log-Tfinal) |
| AC-10 | ✅ | `npm run coverage` green, both workspaces ≥ 80% (see Verification performed) |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `src/frontend/src/render/scene.test.ts`, `src/frontend/src/render/cube-view.test.ts` | AC-4 shadow configuration (key light `castShadow` + 1024×1024 `shadow.mapSize`; cube body + every face `InstancedMesh` `castShadow`/`receiveShadow`) is implemented in `scene.ts:367-368` and `cube-view.ts:233-234`/`259-260` but has no direct assertions in the integration tests the spec names as evidence (`scene.test.ts`, `cube-view.test.ts`). | Add concrete assertions pinning `keyLight.castShadow === true`, `keyLight.shadow.mapSize` width/height === 1024, and `body`/each face mesh `castShadow === true` and `receiveShadow === true`. | open |
| F2 | MAJOR | `src/frontend/src/render/webgl.test.ts:61` | WebGL shadow-map evidence is thin: a single `expect(threeMock.instances[0]!.shadowMap.enabled).toBe(true)` inside the AC-13 constructor test; no dedicated assertion that `createWebGLRenderer` enables `renderer.shadowMap.enabled` as an AC-4 contract, and no negative/edge coverage. | Add a focused AC-4 assertion (ideally its own `it`) verifying `shadowMap.enabled === true` after construction, with a concrete expected value; keep the existing mock handle. | open |
| F3 | MINOR | `src/frontend/src/ui/Hud.test.tsx` | Unexplained deletion/absence of a previously-present Hud test case in the minimize change; the diff removes an assertion without a recorded reason in the build log. | Document the reason in `build-log-T4.md` (or restore the assertion) so the test edit is traceable. | open |
| F4 | MINOR | `src/frontend/src/render/scene.ts:363` | Ambient fill-light intensity uses inline magic clamp bounds (`0.5`, `1.0`) instead of named constants alongside `AMBIENT_INTENSITY`. | Extract `AMBIENT_INTENSITY_MIN`/`AMBIENT_INTENSITY_MAX` (or equivalent) constants and reference them in both source and test. | open |
| F5 | INFO | `docs/features/modern-visual-overhaul/build-log-Tfinal.md:22-28` | Documentation pass defers root `README.md` (no change needed) and proposes an orchestrator-owned single-row diff for `docs/features/README.md` to apply on acceptance; confirm the row is actually applied when the feature transitions to `accepted`. | Orchestrator applies the proposed row on acceptance; no builder action. | open |

## Verification performed

- `npm run lint` → exit 0 (build-log-Tfinal)
- `npm run typecheck` → exit 0 (build-log-Tfinal)
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 40 files / 882 tests) (build-log-Tfinal)
- `npm run coverage` → exit 0 (frontend All files 95.02% stmts / 94.85% branches / 96.42% funcs / 95.02% lines; backend All files 94.66% stmts / 84.32% branches / 99.60% funcs / 94.66% lines; all ≥ 80) (build-log-Tfinal)
- `npm run build` → exit 0 (backend tsc; frontend vite build, 65 modules) (build-log-Tfinal)
- `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0 (AC-9) (build-log-Tfinal)
- `npm run smoke` → exit 0 (SMOKE PASS, 12/12 checks) (build-log-Tfinal)
- Manual: inspected `scene.ts`, `cube-view.ts`, `webgl.ts`/`webgl.test.ts`, `Hud.test.tsx`; confirmed shadow implementation present and shadow assertions absent (F1, F2); confirmed ambient clamp magic numbers (F4).

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependencies, no secrets, no DOM injection; frontend-only visuals; no backend/container change (AC-9) |
| Quality | ✅ | Pure render logic separated; no dead code observed; diff traceable to tasks T1–T5 |
| Testing | ❌ | AC-4 shadow assertions missing in `scene.test.ts`/`cube-view.test.ts`; WebGL shadow-map assertion thin (F1, F2) |

## Notes / backlog (non-blocking)

- F3, F4, F5 are non-blocking and may be resolved alongside F1/F2 or deferred at the orchestrator's discretion.
- Coverage remains comfortably above the 80% threshold in both workspaces; no coverage-exclusion gaming observed.