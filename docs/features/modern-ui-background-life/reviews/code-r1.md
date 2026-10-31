---
feature: modern-ui-background-life
phase: code
iteration: 1
verdict: changes_requested
blocking: 1
nonblocking: 3
---

# Code Review — r1

## Summary

❌ changes requested — Implementation of AC-1…AC-8 and AC-11/AC-12 is present and the full verification suite (lint, typecheck, tests, coverage, build, container diff, smoke) is green, but AC-9 and AC-10 lack direct test evidence in `scene.test.ts`: the background-life group's name, rebuild survival, disposal, and reduced-motion forwarding are only implied by child-count deltas. One MAJOR finding blocks approval; three MINOR/INFO items are non-blocking.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `app.css.test.ts` (border-light describe): `@keyframes border-light-travel`, rules matching `main > section` and `.user-panel` with `animation: border-light-travel 3000ms linear infinite` (n = 3000 ∈ [2000, 6000]); `app.css:556-591` |
| AC-2 | ✅ | `app.css.test.ts` (reduced-motion block contains `main > section…animation: none` and `.user-panel…animation: none`); `app.css:611-621` |
| AC-3 | ✅ | `Hud.test.tsx` ("Hud blinking prop (AC-3)"): `data-blinking="true"` when true, absent when false/omitted; default markup unchanged; `Hud.tsx:12,26` |
| AC-4 | ✅ | `app.css.test.ts` (HUD blink describe): `@keyframes hud-blink`, `main > section[data-blinking="true"]` with `animation: hud-blink 200ms ease` (n = 200 ≤ 300), disabled under reduced motion; `app.css:594-610` |
| AC-5 | ✅ | `App.test.tsx` ("blinks the welcomed HUD when clicks increase (AC-5)"): `data-blinking` flips to `"true"` then clears after 200 ms; `App.tsx:376-407` (hudBlinking state, prevClicksRef, useEffect on clicks/reducedMotion, single setTimeout(HUD_BLINK_MS), cleanup); `blinking={hudBlinking}` passed to welcomed `Hud` at `App.tsx:429`; pre-welcome section has no blink (`App.test.tsx:524`) |
| AC-6 | ✅ | `App.test.tsx` ("does not blink the welcomed HUD under reduced motion (AC-6)"): no `data-blinking` when `reducedMotion: true`; `App.tsx:391` skips setting true; `snapshot.reducedMotion` drives the effect |
| AC-7 | ✅ | `background-life.test.ts`: group `name === 'background-life'`, 5 shooting stars + 3 spaceships, all `Mesh`, constants exported with finite positive speeds, dispose clears group; `background-life.ts:8-11,30-32` |
| AC-8 | ✅ | `background-life.test.ts`: `Math.max(0, dtMs)` clamp, stars advance along x and recycle for large dtMs, spaceships drift, no-op under `reducedMotion === true`; `background-life.ts:71-100` |
| AC-9 | ❌ (impl present, tests missing) | Impl: `scene.ts:385` (`createBackgroundLife(random)`), `scene.ts:387` (`scene.add(…, backgroundLife.group)`), `scene.ts:945` (`backgroundLife.dispose()`), and rebuild path leaves the group untouched (`rebuildCubeIfNeeded` only swaps `cube.group`). Tests only re-pin child counts (`scene.test.ts:477, 1643, 1681, 1729, 1771, 1978`); no assertion on group name `'background-life'`, rebuild survival, or disposal (F1) |
| AC-10 | ❌ (impl present, tests missing) | Impl: `scene.ts:923` (`backgroundLife.update(dtMs, reducedMotion)` inside `SceneView.update`) with `reducedMotion` from `applySnapshot` (`scene.ts:890`). No test asserts the forwarding (F1) |
| AC-11 | ✅ | `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0 (rerun by reviewer); `npm run smoke` → exit 0 (12/12 checks) |
| AC-12 | ✅ | `npm run coverage` → exit 0; frontend All files 95.04% stmts / 94.84% branches / 96.46% funcs / 95.04% lines; backend All files 94.66% stmts / 84.32% branches / 99.60% funcs / 94.66% lines (all ≥ 80) |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `src/frontend/src/render/scene.test.ts` | AC-9/AC-10 are implemented (`scene.ts:385-387, 890, 923, 945`) but the scene integration tests only re-pin aggregate child/object counts; there is no direct assertion that `createSceneView` adds exactly one group named `'background-life'`, that it survives the `levelChanged` rebuild without duplication, that `dispose()` leaves no group named `'background-life'`, or that `SceneView.update` forwards `reducedMotion` to `backgroundLife.update`. This matches the missing-test pattern flagged as MAJOR in the predecessor feature's r1 review. | Add focused scene tests (in `scene.test.ts` or a new `scene-background-life.test.ts`) asserting: (1) exactly one scene child is a `Group` with `name === 'background-life'`; (2) after a `levelChanged` rebuild the count of such groups remains 1; (3) after `dispose()` no child has `name === 'background-life'`; (4) `update(dtMs)` invokes `backgroundLife.update` with the reduced-motion value from `applySnapshot`. | open |
| F2 | MINOR | `src/frontend/src/App.test.tsx:482-505` | The HUD-blink integration test waits on a real 250 ms wall-clock sleep (`await new Promise((resolve) => setTimeout(resolve, 250))`) for the 200 ms timer to clear, instead of using fake timers; this is a determinism/flakiness risk under load. | Convert the timer assertion to Vitest fake timers (or document why real timers are required), keeping the concrete 200 ms expected value. | open |
| F3 | MINOR | `src/frontend/src/render/background-life.ts:102-118` | `dispose()` clears and disposes children but does not detach `group` from its parent; correctness currently relies on `SceneView.dispose` calling `scene.clear()` afterwards. If the module is reused or disposed standalone, an empty group remains parented. | Make `dispose()` remove `group` from `group.parent` (guarded) before/while clearing, so the module is self-contained. | open |
| F4 | INFO | `docs/features/modern-ui-background-life/build-log-T6.md:18-22` | Documentation pass proposes an orchestrator-owned single-row diff for `docs/features/README.md` (insert the `modern-ui-background-life` row after `modern-visual-overhaul`); not yet applied. Root `README.md` needs no change (frontend-only visuals). | Orchestrator applies the proposed row on acceptance; no builder action. | open |
| F5 | INFO | `docs/features/modern-ui-background-life/status.md:30` | Feature is in `code_review` with T6 verification passed; no scope creep detected in the diff (all changed files trace to tasks T1–T5). | None. | open |

## Verification performed

- `npm run lint` → exit 0 (rerun by reviewer)
- `npm run typecheck` → exit 0 (rerun by reviewer)
- `npm test` → exit 0 (backend: 18 files, 492 tests passed; frontend: 41 files, 913 tests passed) (rerun by reviewer)
- `npm run coverage` → exit 0 (frontend All files 95.04% stmts / 94.84% branches / 96.46% funcs / 95.04% lines; backend All files 94.66% stmts / 84.32% branches / 99.60% funcs / 94.66% lines; all ≥ 80) (rerun by reviewer)
- `npm run build` → exit 0 (backend tsc; frontend vite build, 66 modules) (rerun by reviewer)
- `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0 (AC-11) (rerun by reviewer)
- `npm run smoke` → exit 0 (SMOKE PASS, 12/12 checks) (rerun by reviewer)
- Manual: inspected `scene.ts` (background-life creation/add/forward/dispose, rebuild leaves group untouched), `background-life.ts`, `App.tsx` (blink wiring), `Hud.tsx`, `app.css` (keyframes/selectors/reduced motion), and the changed test files; confirmed banned matchers absent from new/changed tests and no coverage-exclusion gaming (only `src/main.tsx` + test patterns excluded, as spec-justified).

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependencies, no secrets, no DOM injection (`textContent`/JSX only); frontend-only visuals; no backend/container change (AC-11) |
| Quality | ✅ | Pure render logic separated; single owners (connection/timers unchanged); no dead code or debug leftovers observed; diff traceable to T1–T5 |
| Testing | ❌ | AC-9/AC-10 lack direct scene integration tests (F1); coverage green both workspaces (≥ 80%); no banned matchers or snapshot-only tests in changed tests; App blink test uses a real wall-clock sleep (F2) |
| Containerized delivery | ✅ | Single-command run preserved; AC-11 container/backend/Dockerfile diff empty; smoke 12/12 |
| Documentation | ✅ | Frontend-only visuals: no README/architecture/container change required; builder's T6 log records no-change rationale and an orchestrator-owned proposed index-row diff (F4) |
| Real-time | n/a | No shared/cross-client state or protocol change; visuals are client-local (spec § Real-time impact) |

## Previous round verification (if iteration > 1)

n/a — first code review round.

## Notes / backlog (non-blocking)

- F2 and F3 may be resolved alongside F1 or deferred at the orchestrator's discretion.
- No scope creep detected: every changed source file traces to tasks T1–T5; `docs/features/README.md` is untouched (orchestrator-owned).
- Coverage exclusions remain exactly the spec-justified set (`src/main.tsx` plus test patterns, plus Vitest defaults); no production logic excluded and no threshold lowered.