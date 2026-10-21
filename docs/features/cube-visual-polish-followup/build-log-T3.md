# Build log — T3 — Engine midpoint level advance

Task: T3 (2026-10-21)
Files changed: `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`, `docs/features/cube-visual-polish-followup/build-log-T3.md`

## What changed & why (≤5 lines)

- Split `advanceLevelAndRebuild` into `advanceLevel()` — progression +1, fresh board, default orientation, queued step/fade cleared, one `levelChanged` intent, invalidate — plus the phase switch, which stays in `advanceTravel`.
- `advanceTravel` records `before = phaseElapsedMs`, computes `midpointMs = travelMs · TRAVEL_LEVEL_ADVANCE_P` (imported from `./effects`) and fires `advanceLevel()` on the first crossing (`phaseElapsedMs >= midpointMs && (before < midpointMs || midpointMs <= 0)`); `playing` still begins at `travelMs`.
- The progression helper is imported as `advanceProgression` so the engine-local `advanceLevel()` keeps the plan's name without shadowing/recursing.
- `engine.test.ts`: new `travel arrival — the level advances at the midpoint (AC-3)` group (10 cases) pinning the default (1249 / 1 / 1250, single 2500) and reduced (74 / 1 / 75) timelines, zero-midpoint, once-only firing, arrival-half input gating, the single `travelStarted`, and `dtMs ≤ 0`.
- Retained travel/AC-10 and reduced-motion groups untouched and passing — their two `advance(1250)` calls already cross the midpoint, so the final assertions still hold.

## Decisions

- Engine-local helper named `advanceLevel()` per plan § Interfaces; the progression `advanceLevel` is imported under the alias `advanceProgression` (an import alias only — same function, no behaviour change) to avoid recursion. Plan explicitly allows wording variation when semantics hold.
- Test helper `sweepIntoTravel(timings, gridSize, options)` builds a flat-random engine, clears all six faces, drains them into `travel` and advances exactly the profile's `faceFadeMs` (`Math.max(1, …)` so a zero fade still gets the frame that starts `travel`). This keeps `travelMs` at the profile's pinned value, so only the arrival timeline is under test.
- `ARRIVAL_TIMINGS = { ...DEFAULT_TIMINGS, rotationMs: 0, faceFadeMs: 0 }` collapses only the sweep phases (rotation + face fade), never the travel timeline (2500 / midpoint 1250).
- Integration-tier exception (documented, per the skill's testing bar): T3's whole behaviour change is inside the pure `game/engine.ts` core, which has no integration boundary of its own — no I/O, no DOM, no socket. The scene↔engine integration of the mid-travel `levelChanged` (rebuild while `travel`, no double rebuild, landing at rest) is exercised by T2's `scene.test.ts` and re-verified at T4; adding such a test here would require files outside `files_owned`.

## Evidence

Workspace state at verify time: `HEAD = 62616bb` (`feat: add travelSwing and the arrival constant (T1)`); `git status --porcelain src/frontend` = only

```
 M src/frontend/src/game/engine.test.ts
 M src/frontend/src/game/engine.ts
```

(i.e. the tree is T1 + this task only).

### `npm test --workspace @cubeclicker/frontend`

```
TEST_EXIT=0

 ✓ src/game/engine.test.ts (38 tests) 48ms
 ✓ src/render/scene.test.ts (31 tests) 78ms
 ✓ src/game/session.test.ts (19 tests) 55ms

 Test Files  20 passed (20)
      Tests  284 passed (284)
```

`engine.test.ts` grew from 28 to 38 `it(...)` blocks (10 added, none removed or weakened). The new group, verbose:

```
 ✓ travel arrival — the level advances at the midpoint (AC-3) > drains nothing and keeps the old level through the first 1249 ms of travel
 ✓ travel arrival — the level advances at the midpoint (AC-3) > advances exactly one level at 1250 ms while the phase is still travel
 ✓ travel arrival — the level advances at the midpoint (AC-3) > switches to playing at 2500 ms without a second levelChanged
 ✓ travel arrival — the level advances at the midpoint (AC-3) > fires the level advance first and then the phase switch on a single 2500 ms advance
 ✓ travel arrival — the level advances at the midpoint (AC-3) > follows the reduced timeline: 74 nothing, 75 levelChanged, 150 playing
 ✓ travel arrival — the level advances at the midpoint (AC-3) > never refires the level advance while the arrival half runs on
 ✓ travel arrival — the level advances at the midpoint (AC-3) > advances at once when the injected travel duration makes the midpoint zero
 ✓ travel arrival — the level advances at the midpoint (AC-3) > gates every input during the arrival half
 ✓ travel arrival — the level advances at the midpoint (AC-3) > drains exactly one travelStarted at travel start
 ✓ travel arrival — the level advances at the midpoint (AC-3) > ignores non-positive time during travel
```

Pinned timeline table (asserted values):

| default travelMs 2500 | elapsed after | phase | levelIndex | intents |
| --- | --- | --- | --- | --- |
| `advance(1249)` | 1249 | `travel` (progress 1249/2500) | 0, style `CUBE_STYLES[0]` | `[]` |
| `advance(1)` | 1250 | `travel` (progress 0.5) | 1, style `CUBE_STYLES[1]` (`crimson-alloy`), orientation `{yawSteps:0,pitchSteps:0}`, board `[25×6]`, stats `{clicks:150,facesDestroyed:6}` | `[{kind:'levelChanged', style: CUBE_STYLES[1]}]` |
| `advance(1250)` | 2500 | `playing` (progress 1) | 1 | `[]` |
| `advance(2500)` in one call | 2500 | `playing` | 1 | one `levelChanged` (produced before the switch) |

| reduced travelMs 150 | elapsed after | phase | levelIndex | intents |
| --- | --- | --- | --- | --- |
| `advance(74)` | 74 | `travel` | 0 | `[]` |
| `advance(1)` | 75 | `travel` | 1, board `[1×6]`, stats `{clicks:6,facesDestroyed:6}` | one `levelChanged` |
| `advance(75)` | 150 | `playing` | 1 | `[]` |

Arrival-half gating (`advance(1250)`, then dispatches): snapshot object identity unchanged (`expect(after).toBe(before)`), stats `{clicks:150,facesDestroyed:6}`, board `[25,25,25,25,25,25]`, orientation `{0,0}`, `rotationFrom` `null`, intents `[]`.

`travelStarted`: gridSize-1 sweep yields exactly 13 intents — index 11 `{kind:'faceCleared', faceId:'bottom'}`, index 12 `{kind:'travelStarted'}`; a second drain is `[]`.

`dtMs ≤ 0` during travel: snapshot identity unchanged, phase `travel`, levelIndex 0, intents `[]`.

### `npm run coverage --workspace @cubeclicker/frontend`

```
COVERAGE_EXIT=0

 Test Files  20 passed (20)
      Tests  284 passed (284)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.31 |    99.36 |     100 |   99.31 |
 src/game        |     100 |    99.59 |     100 |     100 |
  engine.ts      |     100 |      100 |     100 |     100 |
 src/render      |     100 |      100 |     100 |     100 |
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 | 23-30
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
```

Workspace aggregate: statements 99.31, branches 99.36, functions 100, lines 99.31 — all four ≥ 80. `game/engine.ts` is 100/100/100/100. No exclusions added, no thresholds changed (`vitest.config.ts` untouched).

### `npm run typecheck --workspace @cubeclicker/frontend`

```
TYPECHECK_EXIT=0
> typecheck
> tsc --noEmit
```

### `npm run lint`

```
LINT_EXIT=0
> lint
> eslint .
```

### Banned-matcher audit (changed test file)

```
$ grep -nE "expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toHaveBeenCalled\(\)|toMatchSnapshot" src/frontend/src/game/engine.test.ts src/frontend/src/game/engine.ts
(no matches, exit 1)
$ grep -c "toBeTruthy\|toBeDefined\|not.toThrow" src/frontend/src/game/engine.test.ts
0
```

Every new assertion is an exact literal, an exact object (`toEqual`) or snapshot identity (`toBe`); no floats are approximated — `phaseProgress` is asserted as the exact same division the engine performs (`1249 / 2500`, `0.5`).

## Acceptance audit

- **AC-3 (engine parts) → met.** Default timeline (`advance(1249)` nothing / `advance(1)` one `levelChanged` at `travel`, `levelIndex +1`, next style `crimson-alloy`, fresh 25-per-face board, default orientation, carried stats `{150,6}` / `advance(1250)` → `playing`, no second intent), single `advance(2500)` advance-then-switch, reduced timeline 74/1/75, once-only firing, arrival-half input gating (explode/rotate/skip no-ops), `travelStarted` once, `dtMs ≤ 0` no-op, zero-midpoint arm — all asserted in `engine.test.ts` § `travel arrival`. Pure-math half (`TRAVEL_LEVEL_ADVANCE_P`, `travelSwing`) is T1's, imported not redefined.
- **AC-4 (partial) → met for this task.** Only the named supersession (predecessor AC-10 timing) changed inside `engine.ts`; every other engine semantic (fresh board, style cycle, orientation reset, carried stats, `travelStarted` once, one `levelChanged`, `intro → playing → travel → playing`, whole-`travel` input gating, `TRAVEL_DURATION_MS` 2500 / reduced 150) is retained and asserted by the untouched groups. No file outside `files_owned` was edited; no dependency, config, threshold or exclusion change.

## Deviations from spec

None. (Import alias `advanceLevel as advanceProgression` is a naming necessity, not a behaviour deviation; the plan's "wording may vary slightly if semantics hold" clause covers it.)

## Note on the parallel batch

T2 (`render/**`, `session.test.ts`) ran concurrently. During the first workspace run its half-written tree was red; those runs are not evidence. By the time of the recorded verify run T2's working-tree edits had been reverted (no T2 commit in `git log`; `build-log-T2.md` exists untracked), so the transcript above is purely T1 + T3. T2's own verify and the integrated gate belong to T4.
