# Build log — T1 — `travelSwing`, `TRAVEL_LEVEL_ADVANCE_P` and the pinned travel tables

Task: T1 (2026-10-21)
Files changed: `src/frontend/src/game/effects.ts`, `src/frontend/src/game/effects.test.ts`, `docs/features/cube-visual-polish-followup/build-log-T1.md`
What changed & why: added the pinned `TRAVEL_LEVEL_ADVANCE_P = 0.5` constant and the pure total `travelSwing(progress)` (clamped `p ≤ 0.5 → easeInOutQuad(2p)`, else `1 − easeInOutQuad(2p − 1)`) per plan § Interfaces; replaced the superseded AC-22 travel-position helper test with the AC-3 camera (`12 + 78·S`) and scale (`1 + 7·S`) tables; pinned the swing table, both-end clamping, strict rise/fall and the constant. Everything else in the file (the `easeOutCubic` group incl. the reinstated AC-22 intro helper `60/18/12`, the pop, burst, timing and constant groups) is untouched.
Decisions: `travelSwing` sits beside `easeInOutQuad` (its only dependency); the constant sits with the other non-grid constants and its JSDoc says the advance happens at the midpoint. `TRAVEL_STARFIELD_SCALE`'s doc comment was corrected from "at travel progress 1" to "at the travel midpoint" (same file, the new AC-3 contract). Clamping is `Math.min(1, Math.max(0, progress))` — a total function of the input with no branching on NaN/Infinity beyond the clamp (NaN in → NaN out, out of contract; spec pins only finite progress).

Evidence:

- `npm test --workspace @cubeclicker/frontend` → exit 0, 20 files / 274 tests passed (`effects.test.ts` 28 tests, up from 26: +1 constant pin, +5 `travelSwing` tests, −1 superseded AC-22 helper).

```
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ...
 Test Files  20 passed (20)
      Tests  274 passed (274)
TEST_EXIT=0
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0, all four aggregate metrics ≥ 80; `effects.ts` at 100/100/100/100 (no exclusions, thresholds unchanged).

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
All files        |   99.31 |    99.36 |     100 |   99.31 |
 src/game/effects.ts |   100 |      100 |     100 |     100 |
 src/ui/GameCanvas.tsx | 61.9 |   100 |     100 |    61.9 |
 src/ws/connection.ts | 95.34 |  92.59 |     100 |   95.34 |
-----------------|---------|----------|---------|---------|
COVERAGE_EXIT=0
```

  Per-metric aggregate: statements 99.31, branches 99.36, functions 100, lines 99.31 (gate 80 each).

- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0 (`tsc --noEmit`, no output).
- `npm run lint` → exit 0 (`eslint .`, no output).

- Sensitivity greps:

```
# banned matchers in the changed test file (no matches)
grep -nE "expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined" src/frontend/src/game/effects.test.ts
BANNED_GREP_EXIT=1

# browser globals in the pure module (no matches)
grep -rnE "\b(document|window|requestAnimationFrame|performance\.now)\b" src/frontend/src/game/effects.ts
DOM_GREP_EXIT=1
```

- New exports as landed:

```
94:export function travelSwing(progress: number): number {
146:export const TRAVEL_LEVEL_ADVANCE_P = 0.5;
```

- `git diff --numstat` for the task's files: `effects.ts` +29/−2, `effects.test.ts` +44/−4 (no other source file touched; the `docs/features/README.md` and `docs/features/cube-game-frontend/status.md` modifications in the working tree pre-date this task and were not staged).

Acceptance audit:
- AC-3 (pure math) → met: `effects.test.ts` › `travelSwing` pins `{0→0, 0.125→0.125, 0.25→0.5, 0.375→0.875, 0.5→1, 0.625→0.875, 0.75→0.5, 0.875→0.125, 1→0}`, clamping at `[-1, -0.001, 1, 1.001, 2]`, the strict rise/fall sweep, the camera table `[12, 21.75, 51, 80.25, 90, 80.25, 51, 21.75, 12]`, the scale table `[1, 1.875, 4.5, 7.125, 8, 7.125, 4.5, 1.875, 1]`; `non-grid pinned constants` pins `TRAVEL_LEVEL_ADVANCE_P` to 0.5; `effects.ts` is three-free and DOM-free (grep above).
- AC-3 (engine/scene parts) → not in T1 scope (T3 owns the engine midpoint advance, T2 the scene wiring); `effects.ts` supplies the shared exports they import.
- AC-4 (partial) → met for this task: only the superseded AC-22 travel-position helper test was replaced (git diff shows the single removed `it`); the intro helper `60/18/12`, the `easeOutCubic`/`easeInOutQuad` value tables and every other group are unchanged; lint/typecheck/tests/coverage all exit 0.
- AC-2 (unchanged `easeOutCubic`) → met: the AC-22 intro-position helper test (`60 - 48·easeOutCubic` → `60/18/12`) is retained verbatim and passing.

Integration-test note (documented exception): `game/effects.ts` is a pure math module with no boundary — no I/O, no framework, no scene graph — so it has no integration tier of its own. The integration boundary for these exports (camera flight and starfield scale through the real three.js scene graph) is T2's `scene.test.ts`/`starfield.test.ts` and T3's `engine.test.ts`, which drive the same pinned tables. Adding a scene-level test here would duplicate T2's owned coverage or touch files outside `files_owned`.

Deviations from spec: none. (One in-file doc correction: `TRAVEL_STARFIELD_SCALE` now documented as the peak at the travel midpoint, matching spec AC-1/AC-3; the value 8 is unchanged.)
