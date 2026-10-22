---
verdict: approved
blocking: 0
iteration: 1
---

# Code Review — Round 1

**Feature:** cube-tile-lines-and-controls  
**Reviewer:** CubeClicker Code Reviewer  
**Date:** 2026-01-21  
**Gate:** code-gate-2  

## Summary

All acceptance criteria are met. Implementation is clean, tests are comprehensive with concrete assertions, coverage exceeds thresholds, and the diff scope is properly contained. No blocking issues found.

## Acceptance Criteria Verification

### AC-1: Seamed mini-cube surface ✅ MET

**Evidence:**
- `MINI_CUBE_TILE_RATIO = 0.95` asserted in `cube-view.test.ts:223` (exact match: `expect(MINI_CUBE_TILE_RATIO).toBe(0.95)`)
- Face-axis extent tests verify inset tile dimensions for N=3, N=5, N=7 using `Math.fround()` composition
- Seam gaps verified: adjacent tiles separated by `0.05 × cell` (1/12, 0.05, 1/28 for N=3,5,7)
- Perimeter rim verified: outermost tile outer face at `CUBE_HALF_SIZE - seam/2`
- Tile centers unchanged (verified in retained tests)
- Child list: body + 6 InstancedMesh (verified in `scene.test.ts`)
- Body material: `style.cubeColor` (verified in `scene.test.ts`)
- Pop timeline literals re-pinned to `Math.fround(0.95 × factor)` in `scene.test.ts:1343-1451`
- Glossary updated: "mini-cube" definition now describes seam appearance (`docs/product/glossary.md`)

**Test coverage:** 32 tests in `cube-view.test.ts`, 51 tests in `scene.test.ts`, 19 tests in `picking.test.ts`

### AC-2: Pointer drag does nothing ✅ MET

**Evidence:**
- `session.ts:278-282`: drag handling returns immediately without rotation, explosion, or state change
- `gestures.ts` logic unchanged (only doc comment updated)
- Recording engine tests verify drags dispatch zero events (`session.test.ts:748-783`)
- Real engine tests verify snapshot identity after drags (`session.test.ts:783-800`)
- Touch events unchanged (pointer events path)
- `touch-action: none` retained on canvas element

**Test coverage:** 25 tests in `session.test.ts`, 21 tests in `gestures.test.ts`

### AC-3: WASD and arrow keys rotate ✅ MET

**Evidence:**
- `keyboard.ts:22-30`: WASD mappings added (W→pitch+1, A→yaw-1, S→pitch-1, D→yaw+1)
- Arrow key mappings unchanged
- Case-insensitive: both 'w' and 'W' map to same event (`keyboard.ts:32-35`)
- Intro any-key skip unchanged (returns `introSkip` for any key)
- Travel null unchanged (returns null for all keys in travel phase)
- Six-face reachability verified: WASD can reach all 6 faces (`keyboard.test.ts:191-220`)

**Test coverage:** 13 tests in `keyboard.test.ts`

### AC-4: Canvas aria-label updated ✅ MET

**Evidence:**
- `GameCanvas.tsx`: aria-label = "Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube"
- Exact string asserted in `GameCanvas.test.tsx:14`
- Exact string asserted in `App.test.tsx:41` (SSR markup)

**Test coverage:** 2 tests in `GameCanvas.test.tsx`, 4 tests in `App.test.tsx`

### AC-5: Auto-rotation and game core untouched ✅ MET

**Evidence:**
- Git diff on engine core files is empty:
  - `src/frontend/src/game/engine.ts` (0 lines changed)
  - `src/frontend/src/game/rotation.ts` (0 lines changed)
  - `src/frontend/src/game/board.ts` (0 lines changed)
  - `src/frontend/src/game/progression.ts` (0 lines changed)
  - `src/frontend/src/game/effects.ts` (0 lines changed)
  - `src/frontend/src/game/types.ts` (0 lines changed)
- Auto-rotation behavior unchanged (verified by retained tests in `engine.test.ts`)
- 45 tests in `engine.test.ts` all pass

**Test coverage:** 45 tests in `engine.test.ts` (all retained, all passing)

### AC-6: Supersession ledger and regression gate ✅ MET

**Gate verification (reviewer-run):**
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test` → exit 0 (340 tests: 336 frontend + 4 backend)
- `npm run coverage` → exit 0
  - Backend: statements 100%, branches 100%, functions 100%, lines 100%
  - Frontend: statements 99.33%, branches 99.41%, functions 100%, lines 99.33%
- `npm run build` → exit 0, gzip initial JS 209.69 KB ≤ 350 KB

**Diff scope verification:**
- Only 15 feature files changed (9 source/test files + 6 doc files)
- All out-of-scope files unchanged:
  - Backend: 0 lines changed
  - Container: 0 lines changed
  - WebSocket: 0 lines changed
  - HUD/theme/App.tsx: 0 lines changed
  - Game core (engine/rotation/board/progression/effects/types): 0 lines changed
  - Render (picking/starfield/particles.ts): 0 lines changed

**Test quality:**
- No banned matchers (grep verified: 0 matches)
- No wildcard matchers
- All assertions use concrete values
- No `toBeCloseTo` usage (budget = 0)
- f32-composed literals use `Math.fround()` for seam/extent values
- No weakened assertions detected

**Coverage analysis:**
- Frontend aggregate: 99.33% (well above 80% threshold)
- Lowest files: `GameCanvas.tsx:61.9%`, `connection.ts:95.34%` (both pre-existing exclusions, not gamed)
- No production code excluded from coverage

**Supersession ledger:**
- All changes are in the ledged files only
- No unintended changes to accepted features

## Test Quality Assessment

**Concrete assertions:** ✅ All tests use specific expected values (no wildcards, no `any()`, no `expect.anything()`)

**Banned matcher check:** ✅ Grep for banned matchers returned 0 results

**Test strength:** ✅ Tests verify:
- Exact constant values (`MINI_CUBE_TILE_RATIO === 0.95`)
- Exact tile dimensions with f32 composition
- Exact seam gaps for N=3,5,7
- Exact aria-label strings
- Drag→no-op behavior with recording engine
- WASD→rotation mappings with case insensitivity
- Six-face reachability via WASD

**Coverage integrity:** ✅ No coverage gaming detected. Low-coverage files (`GameCanvas.tsx`, `connection.ts`) are pre-existing exclusions for legitimate reasons (effect bodies, WebSocket connection logic).

## Code Quality

**Implementation correctness:** ✅
- Seam ratio correctly applied to tile extent calculation
- Drag handling correctly short-circuits without side effects
- WASD mappings correctly added with case-insensitive lookup
- Aria-label correctly updated in both production and test files

**Test correctness:** ✅
- All tests pass (340/340)
- No flaky tests detected
- Tests verify behavior, not implementation details
- Integration tests verify end-to-end scenarios

**Documentation:** ✅
- Glossary updated with seam description
- Doc comments in `gestures.ts` and `keyboard.ts` updated
- Spec supersession ledger is complete and accurate

## Scope and Integrity

**Diff scope:** ✅ Only 15 feature files changed, all within `files_owned` lists

**Out-of-scope files:** ✅ All unchanged (verified by git diff)
- Backend: untouched
- Container: untouched
- Game core: untouched
- Render infrastructure: untouched
- HUD/theme: untouched

**Residuals:** ✅ Documented honestly
- `GameCanvas.tsx:23-30` (effect body, 61.9% coverage) — pre-existing
- `connection.ts` (WebSocket connection logic, 95.34% coverage) — pre-existing
- `session.ts:175` (uncovered branch) — pre-existing
- Mocked `WebGLRenderer` — pre-existing

**No new dependencies:** ✅ Only existing `three` library used

**No banned patterns:** ✅ No DOM globals or `Math.random` in `game/**`

## Findings

**None.** All acceptance criteria met, all gates pass, no blocking issues.

## Verdict

**APPROVED** — Ready to merge.

The implementation is clean, well-tested, and meets all acceptance criteria. Coverage exceeds thresholds, tests use concrete assertions, and the diff scope is properly contained. The feature is ready for deployment.

## Next Steps

1. Merge to main branch
2. Update `status.md` to "accepted"
3. Deploy to production (if applicable)
