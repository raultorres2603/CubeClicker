# Build log — T1 — Reveal motion tokens and pure pose function

Task: T1 (2026-11-16)
Branch: `feat/game-feel-overhaul` (created from the current base `e39c378` — the branch that was
checked out when T1 started; `main` is at `294b302`). Not pushed.
Files changed:
- `src/frontend/src/game/motion.ts` (edit — 12 additive AC-32 tokens)
- `src/frontend/src/game/motion.test.ts` (edit — full-object pin extended + named AC-32 test)
- `src/frontend/src/game/reveal-motion.ts` (new — pure pose module)
- `src/frontend/src/game/reveal-motion.test.ts` (new — pose timeline tests)
- `docs/features/game-feel-overhaul/build-log-T1.md` (this file)

## What changed & why

1. `MOTION` gains exactly the 12 AC-32 tokens (`revealStageOrbScale: 1.1`,
   `revealStageFlashOpacity: 0.85`, `revealStageRingMinScale: 0.4`,
   `revealStageRingMaxScale: 2.4`, `revealStageRingOpacity: 0.9`,
   `revealStageSlotPulse: 1.1`, `uiPanelEnterMs: 220`, `uiPanelEnterOffsetPx: 6`,
   `uiButtonPressMs: 90`, `uiButtonPressScale: 0.97`, `uiGlowPulseMs: 2400`,
   `uiRevealSpotlightMs: 260`). No accepted value or timing changed; the full-object
   `toEqual` pin in `motion.test.ts` still lists every pre-existing token unchanged.
2. New pure module `game/reveal-motion.ts` (no DOM/three.js/timers/randomness) exports
   `REVEAL_SLOT_YAW_RAD`, `REVEAL_START_YAW_RAD`, `REVEAL_RARITY_HEX`,
   `RevealStagePhase`, `RevealUiPhase` (includes `idle`, shared with T3/T5),
   `RevealStagePose`, `createRevealStagePose()` and the allocation-free
   `revealStagePose(elapsedMs, slot, reducedMotion, out)`.
3. Phase windows are derived from the accepted `MOTION` durations, not re-typed:
   `420 = lootboxChargeMs`, `670 = +orbOvershootMs`, `790 = +lootboxFlashMs`,
   `1150 = +lootboxRevealMs`, `1290 = +lootboxSettleMs`.
4. Tests pin the ten slot yaws, `REVEAL_START_YAW_RAD === PREVIEW_REST_ROTATION_RAD`,
   the rarity hexes, every AC-6 boundary value, every phase window edge, clamping,
   reduced motion and same-`out` identity.

## Pose contract as implemented (AC-6)

Slot yaw table (`REVEAL_SLOT_YAW_RAD`): `hull 0.35`, `nose 0.15`, `cockpit 0.45`,
`wing-left 0.85`, `wing-right -0.85`, `engine-left 0.7`, `engine-right -0.7`,
`ignition-left 1.0`, `ignition-right -1.0`, `tail-fin 1.2` (`REVEAL_START_YAW_RAD 0.55`).

| Window (ms) | `phase` | yaw | `scale` | `slotPulse` | `ringScale` | `ringOpacity` | `flashOpacity` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–419 | `charge` | `0.55 → slot`, `easeInOutCubic` | `1 → 1.04`, `easeInOutCubic` | 1 | 0.4 | 0 | 0 |
| 420–669 | `orb` | slot | `1.04 → 1.1`, `easeOutCubic` | 1 | 0.4 | 0 | 0 |
| 670–789 | `flash` | slot | 1.1 | 1 | 0.4 | 0 | `0.85·sin(πt)` |
| 790–1149 | `reveal` | slot | `1.1 → 1`, `easeOutCubic` | `1 + 0.1·sin(πt)` | `0.4 → 2.4`, `easeOutCubic` | `0.9·sin(πt)` | 0 |
| 1150–1289 | `settle` | slot | 1 | 1 | 2.4 | 0 | 0 |
| ≥ 1290 | `rest` | slot | 1 | 1 | 1 | 0 | 0 |

Exact boundary values asserted in `reveal-motion.test.ts`:

- `0` → charge row: yaw `0.55`, scale `1`, slotPulse `1`, ringScale `0.4`,
  ringOpacity `0`, flashOpacity `0`.
- `420` → orb, yaw = slot yaw (e.g. `0.35` hull), scale `1.04`, ringScale `0.4`.
- `670` → flash, scale `1.1`, flashOpacity `0`.
- `730` → flashOpacity `0.85` (t = 0.5, `sin(π/2) = 1`).
- `970` → reveal, slotPulse `1.1`, ringOpacity `0.9` (t = 0.5).
- `1150` → settle, scale `1`, ringScale `2.4`, ringOpacity `0`.
- `1290` → rest row, `phase === 'rest'`, ringScale `1`, ringOpacity `0`.
- Window edges also pinned: `419` charge, `669` orb, `789` flash, `1149` reveal,
  `1289` settle, `5000` rest.
- Clamping: `-1`, `-1000`, `NaN`, `-Infinity`, `+Infinity` produce the 0 ms charge row;
  `5000` and `1290.5` produce the 1290 rest row.
- Reduced motion: every value in `[-50, 0, 420, 670, 730, 970, 1150, 1289, 1290, 5000, NaN]`
  returns the static rest row with the granted slot yaw.
- Allocation-free: `revealStagePose` returns the same `out` reference it writes, and two
  consecutive calls mutate that one record; `createRevealStagePose()` returns a fresh buffer
  per call.

## Decisions

- **Window constants are derived from `MOTION`** so the pose timeline cannot drift from the
  accepted 1290 ms DOM timeline.
- **Pose values reuse `MOTION`** wherever a token exists (orb scale, flash opacity, ring
  min/max/opacity, slot-pulse peak); only the charge-end scale `1.04` (no AC-32 token) is a
  module-local constant.
- **Clamping follows the plan contract**: non-finite and non-positive elapsed become `0`
  (so `±Infinity` → charge row, `NaN` → charge row); values `>= 1290` write the rest row.
- **Unknown slot** (runtime value cast past the type) falls back to the `hull` yaw, no throw
  (plan § Reveal motion).
- **`createRevealStagePose()` starts on the rest row for `hull`** — a static, motion-free
  buffer so a reader that observes it before the first update never sees a mid-animation
  state. AC-6 does not pin the initial contents; the first `revealStagePose` call overwrites
  every field.
- **`RevealUiPhase`/`RevealStagePhase` are exported now** so T3 (component) and T5 (panel)
  share one type instead of redefining `idle` locally.
- No new dependency, no coverage exclusion, no threshold change, no assertion weakening.
  No `expect.closeTo` (the bounded float exception) was needed.

## Test tiers

- **Unit:** `reveal-motion.test.ts` (43 tests) and `motion.test.ts` (13 tests) exercise the
  pure modules in isolation with explicit inputs.
- **Integration:** T1 introduces only pure data/arithmetic that no component, route or socket
  consumes yet, so this task has **no integration boundary** — documented exception. The
  closest boundary is the cross-layer consistency check that imports `render/preview` and
  pins `REVEAL_START_YAW_RAD === PREVIEW_REST_ROTATION_RAD` (game ↔ render). Real integration
  coverage arrives with T2 (`render/lootbox-reveal.ts`), T3 (`ui/LootboxReveal.tsx`) and T5
  (panel).
- No wildcard matchers, no snapshot-only or assertion-free tests; every assertion pins a
  concrete value.

## Evidence

All commands run from `/var/home/raultorraco/Documents/Projects/CubeClicker`.

- `npm run lint` → **exit 0**, no findings:

  ```text
  > lint
  > eslint .
  ```

- `npm run typecheck` → **exit 0**:

  ```text
  > typecheck
  > npm run typecheck --workspaces --if-present

  > typecheck
  > tsc --noEmit

  > typecheck
  > tsc --noEmit
  ```

- `npm test --workspace @cubeclicker/frontend` → **exit 0**:

  ```text
   Test Files  75 passed (75)
        Tests  2306 passed (2306)
     Duration  3.36s (transform 7.12s, setup 0s, collect 21.90s, tests 11.30s, environment 7.40s, prepare 5.74s)
  ```

- `npm run coverage --workspace @cubeclicker/frontend` → **exit 0** (thresholds 80):

  ```text
  All files          |   96.67 |    96.37 |   97.82 |   96.67 |
    motion.ts        |     100 |      100 |     100 |     100 |
    reveal-motion.ts |     100 |      100 |     100 |     100 |
  ```

  (`statements | branches | functions | lines`; `reveal-motion.ts` is fully covered, including
  every phase branch and the defensive slot fallback.)

- `git diff --check` → **exit 0**, empty output (no whitespace errors).

## Acceptance audit

- **AC-6 — Pose timeline and slot yaw table → met.** Ten exact slot yaws and
  `REVEAL_START_YAW_RAD === 0.55 === PREVIEW_REST_ROTATION_RAD` pinned; `revealStagePose`
  returns the same `out` object; negative/`NaN` clamp to 0 and `> 1290` clamps to 1290;
  exact values at 0/420/670/730/970/1150/1290; phases `charge`/`orb`/`flash`/`reveal`/
  `settle` on their windows and `rest` at ≥ 1290; reduced motion returns the rest row for
  every elapsed value including `NaN` and negatives. Evidence: `reveal-motion.test.ts`
  (43 passing tests), coverage 100 % on `reveal-motion.ts`.
- **AC-32 — Motion tokens → met for T1's share.** `MOTION` gains exactly the 12 pinned
  tokens with exact values and all accepted tokens are unchanged (full-object `toEqual`
  pin). Evidence: `motion.test.ts` (13 passing tests). The `game-view.css` custom-property
  mapping and its `game-view.css.test.ts` assertion of `${MOTION.<token>}ms` belong to T7
  (`files_owned`); T1 does not touch CSS.

## Deviations from spec

None. No out-of-scope file was touched; the branch was created from the current base because
`feat/game-feel-overhaul` did not exist yet.
