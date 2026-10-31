---
feature: modern-ui-background-life
phase: code
iteration: 2
verdict: approved
blocking: 0
nonblocking: 2
---

# Code Review — r2

## Summary

✅ approved — The r1 MAJOR (F1) and both MINORs (F2, F3) are fixed with direct test evidence: scene tests now assert the single `background-life` group, rebuild survival, disposal, and reduced-motion forwarding; the App HUD-blink test uses fake timers; `dispose()` detaches from its parent. AC-9 and AC-10 are now directly evidenced. Full verification suite (lint, typecheck, tests, coverage, build, container diff, smoke) is green; coverage ≥ 80% both workspaces. Two INFO items remain (orchestrator-owned index row and status note).

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `app.css.test.ts` (border-light describe); `app.css:556-591` — `@keyframes border-light-travel`, rules for `main > section` and `.user-panel` with `animation: border-light-travel 3000ms linear infinite` (n = 3000 ∈ [2000, 6000]) |
| AC-2 | ✅ | `app.css.test.ts` (reduced-motion block contains `main > section` and `.user-panel` with `animation: none`); `app.css:611-621` |
| AC-3 | ✅ | `Hud.test.tsx` ("Hud blinking prop (AC-3)"): `data-blinking="true"` when true, absent when false/omitted; default markup unchanged; `Hud.tsx:12,26` |
| AC-4 | ✅ | `app.css.test.ts` (HUD blink describe): `@keyframes hud-blink`, `main > section[data-blinking="true"]` with `animation: hud-blink 200ms ease` (n = 200 ≤ 300), disabled under reduced motion; `app.css:594-610` |
| AC-5 | ✅ | `App.test.tsx` ("blinks the welcomed HUD when clicks increase (AC-5)"): `data-blinking` flips to `"true"` then clears after 200 ms via fake timers; `App.tsx:376-407` (hudBlinking state, prevClicksRef, useEffect on clicks/reducedMotion, single `setTimeout(HUD_BLINK_MS)`, cleanup); `blinking={hudBlinking}` at `App.tsx:429`; pre-welcome section has no blink |
| AC-6 | ✅ | `App.test.tsx` ("does not blink the welcomed HUD under reduced motion (AC-6)"): no `data-blinking` when `reducedMotion: true`; `App.tsx:391` skips setting true |
| AC-7 | ✅ | `background-life.test.ts`: group `name === 'background-life'`, 5 shooting stars + 3 spaceships, all `Mesh`, constants exported with finite positive speeds, dispose clears group; `background-life.ts:1-32` |
| AC-8 | ✅ | `background-life.test.ts`: `Math.max(0, dtMs)` clamp, stars advance along x and recycle for large dtMs, spaceships drift, no-op under `reducedMotion === true`; `background-life.ts:71-100` |
| AC-9 | ✅ | `scene.test.ts:2376-2427` (new describe "background life scene integration (AC-9, AC-10)"): exactly one group named `'background-life'` (`scene.test.ts:2387`); survives `levelChanged` rebuild without duplication (`scene.test.ts:2396`); after `dispose()` no group named `'background-life'` (`scene.test.ts:2418`); impl `scene.ts:385,387,945` |
| AC-10 | ✅ | `scene.test.ts:2428` (forwarding test): reduced-motion star position unchanged, motion star position changes after `update(100)`; impl `scene.ts:890,923` (`reducedMotion = snapshot.reducedMotion`; `backgroundLife.update(dtMs, reducedMotion)`) |
| AC-11 | ✅ | `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0 (rerun by reviewer); `npm run smoke` → exit 0 (12/12 checks) |
| AC-12 | ✅ | `npm run coverage` → exit 0; frontend All files 95.05% stmts / 94.84% branches / 96.46% funcs / 95.05% lines; backend All files 94.66% stmts / 84.32% branches / 99.60% funcs / 94.66% lines (all ≥ 80) |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 (r1) | MAJOR | `src/frontend/src/render/scene.test.ts` | AC-9/AC-10 lacked direct scene integration tests | Add focused scene tests asserting single group, rebuild survival, disposal, and reduced-motion forwarding | fixed — `scene.test.ts:2376-2449` now asserts exactly one `'background-life'` group, survival across `levelChanged` rebuild, no such group after `dispose()`, and forwarding via star-position behavior; impl `scene.ts:385,387,890,923,945` |
| F2 (r1) | MINOR | `src/frontend/src/App.test.tsx:482-505` | HUD-blink test used real 250 ms wall-clock sleep | Convert to fake timers keeping 200 ms expected value | fixed — `App.test.tsx:481` now `vi.useFakeTimers()`, advances 200 ms, restores real timers; removed 50 ms sleep in AC-6 test |
| F3 (r1) | MINOR | `src/frontend/src/render/background-life.ts:102-118` | `dispose()` did not detach group from parent | Remove group from parent before clearing | fixed — `background-life.ts:108-111` removes `group` from `group.parent` before clearing/disposing |
| F4 (r1) | INFO | `docs/features/modern-ui-background-life/build-log-T6.md:18-22` | Orchestrator-owned `docs/features/README.md` row proposed but not applied | Orchestrator applies the proposed row on acceptance; no builder action | open (orchestrator-owned; not a builder finding) |
| F5 (r1) | INFO | `docs/features/modern-ui-background-life/status.md:30` | Status note | None | open (informational) |

## Verification performed

- `npm run lint` → exit 0 (rerun by reviewer)
- `npm run typecheck` → exit 0 (rerun by reviewer)
- `npm test` → exit 0 (backend: 18 files, 492 tests passed; frontend: 41 files, 917 tests passed) (rerun by reviewer)
- `npm test --workspace @cubeclicker/frontend -- --run src/render/scene.test.ts` → exit 0 (73 tests passed) (rerun by reviewer)
- `npm test --workspace @cubeclicker/frontend -- --run src/App.test.tsx` → exit 0 (23 tests passed, 3 runs, no flakiness observed) (rerun by reviewer)
- `npm run coverage` → exit 0 (frontend All files 95.05% stmts / 94.84% branches / 96.46% funcs / 95.05% lines; backend All files 94.66% stmts / 84.32% branches / 99.60% funcs / 94.66% lines; all ≥ 80) (rerun by reviewer)
- `npm run build` → exit 0 (backend tsc; frontend vite build, 66 modules) (rerun by reviewer)
- `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0 (AC-11) (rerun by reviewer)
- `npm run smoke` → exit 0 (SMOKE PASS, 12/12 checks) (rerun by reviewer)
- Manual: inspected `scene.ts` (background-life creation/add/forward/dispose, rebuild leaves group untouched), `background-life.ts` (self-contained dispose), `App.tsx` (blink wiring), `app.css` (keyframes/selectors/reduced motion), and changed tests; confirmed banned matchers absent from new/changed tests and no coverage-exclusion gaming (only `src/main.tsx` + test patterns excluded, as spec-justified).

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependencies, no secrets, no DOM injection (`textContent`/JSX only); frontend-only visuals; no backend/container change (AC-11) |
| Quality | ✅ | Pure render logic separated; single owners (connection/timers unchanged); no dead code or debug leftovers observed; diff traceable to T1–T5 and codefix |
| Testing | ✅ | AC-9/AC-10 now have direct scene integration tests (F1 fixed); coverage green both workspaces (≥ 80%); no banned matchers or snapshot-only tests in changed tests; App blink test uses fake timers (F2 fixed) |
| Containerized delivery | ✅ | Single-command run preserved; AC-11 container/backend/Dockerfile diff empty; smoke 12/12 |
| Documentation | ✅ | Frontend-only visuals: no README/architecture/container change required; builder's T6 log records no-change rationale and an orchestrator-owned proposed index-row diff (F4) |
| Real-time | n/a | No shared/cross-client state or protocol change; visuals are client-local (spec § Real-time impact) |

## Previous round verification (iteration > 1)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | fixed | `scene.test.ts:2376-2449` (single group, rebuild survival, disposal, forwarding); `scene.ts:385,387,890,923,945` |
| F2 (r1) | fixed | `App.test.tsx:481` (`vi.useFakeTimers()`), `vi.advanceTimersByTime(200)`, `vi.useRealTimers()`; 23/23 tests pass over 3 runs |
| F3 (r1) | fixed | `background-life.ts:108-111` (`group.parent.remove(group)` guarded) |
| F4 (r1) | open (INFO) | Orchestrator-owned; `docs/features/README.md` still has no `modern-ui-background-life` row (expected until acceptance) |
| F5 (r1) | open (INFO) | Status note only |

## Notes / backlog (non-blocking)

- No scope creep detected: codefix commit changed only `background-life.ts`, `scene.test.ts`, `App.test.tsx`, and its build log; all trace to F1–F3.
- Coverage exclusions remain exactly the spec-justified set (`src/main.tsx` plus test patterns, plus Vitest defaults); no production logic excluded and no threshold lowered.
- The orchestrator applies the `docs/features/README.md` row (F4) on acceptance.
