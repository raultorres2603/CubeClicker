# Build log — T7 — Motion tokens + ship motion (additive)

Task: T7 (2026-11-08)
Files changed: `src/frontend/src/game/motion.ts`, `src/frontend/src/game/motion.test.ts`,
`src/frontend/src/render/ship-motion.ts`, `src/frontend/src/render/ship-motion.test.ts`,
`docs/features/spaceship-cursor-loot-animations/build-log-T7.md`

What changed & why: add the single `MOTION` token home (all observed `[O]` + extrapolated `[E]`
AC-34 values, exact), the single `easeOutCubic` implementation plus `easeOutBack`/`easeOutQuad`/
`easeOutQuint`/`easeInOutCubic`/`clamp01`, and pure deterministic cursor-ship motion math
(follow, pointer velocity, bank/pitch clamps, idle bob, equip pulse, fly-by roll, 8-point/220 ms
trail ring buffer) with reduced-motion zeros. No consumer is wired yet (T9/T12 own integration);
the full frontend workspace stays green.

Decisions:
- `MOTION` mirrors the plan/AC-34 object 1:1 in `as const`; token order is observed then
  extrapolated for review parity with the spec.
- `shipFollowFactor` reuses the accepted predecessor constant `SPACESHIP_FOLLOW_TAU_MS` (240 ms)
  imported from `game/effects.ts` instead of redefining the tau.
- `shipBankRad`/`shipPitchRad` normalise `-0` to `+0` so a rest pointer and `dtMs === 0` produce
  the exact positive zero pose AC-42 requires (`Object.is(-0, 0)` is false).
- Equip pulse is a smooth out-and-back `sin(π t)` envelope over `equipPulseMs`, peaking at exactly
  `1 + equipPulseScale = 1.04` at half duration and returning to 1. AC-42 pins the duration and
  4 % amplitude; the curve shape is an implementation choice documented in the module.
- Fly-by roll is `2π · easeInOutCubic(clamp01(elapsed / shipRollMs))` (AC-40/AC-42).
- Trail is a fixed-capacity ring (default `MOTION.trailCount = 8`) with
  `MOTION.trailLifetimeMs = 220` expiry; points are oldest-first `{x, y, z, atMs}`, and reduced
  motion stores nothing.
- No integration test tier: both modules are additive pure math with no consumer yet (T9 wires
  them into `spaceship.ts`/`scene.ts` and owns the integration evidence). Documented exception per
  the web-implementation testing bar.
- No documentation edits beyond this log: the modules are internal, have no user-facing behavior
  or config, and T13 owns the feature documentation pass (task constraints also forbid other docs).

Evidence:
- `npm run lint` →
  ```
  > lint
  > eslint .
  ```
  exit 0, no diagnostics.
- `npm run typecheck --workspace @cubeclicker/frontend` →
  ```
  > typecheck
  > tsc --noEmit
  ```
  exit 0, no diagnostics.
- `npm test --workspace @cubeclicker/frontend` →
  ```
  Test Files  57 passed (57)
       Tests  1435 passed (1435)
  ```
  (includes `src/game/motion.test.ts` 11 tests and `src/render/ship-motion.test.ts` 24 tests).
- `npm run coverage --workspace @cubeclicker/frontend` →
  ```
  All files          |   96.12 |    95.61 |    96.8 |   96.12 |
   motion.ts        |     100 |      100 |     100 |     100 |
   ship-motion.ts   |     100 |      100 |     100 |     100 |
  ```
  thresholds 80/80/80/80 met; both new modules are fully covered.
- Assertion quality: concrete exact values only (full `MOTION` deep equality, exact easing
  endpoints/midpoints/peaks, exact transforms/scales/positions/timestamps). No wildcard matchers;
  the bounded float-exception budget was not used (`0` `closeTo` calls).

Acceptance audit:
- AC-34 → met. `game/motion.ts` exports the exact token object (coin 1100, ring 330, orb 250 /
  ×1.25, banner peak 250 / ×1.08, level burst 760, debris 1200, lootbox total 1290, ship roll and
  trail 700, reticle fade 120 extrapolated, plus every other pinned token) and the single easing
  set with exact endpoints/midpoints (`easeOutBack` peaks 1.08 at t=0.6 for c1=1.5 and 1.25 at
  t=0.5 for c1=3.0). Evidence `motion.test.ts` (11 tests, 100% coverage). CSS token mirroring is
  T12's scope and is not touched here.
- AC-42 → met for the motion math. `render/ship-motion.ts` pins follow `1−exp(−dt/240)`,
  bank `clamp(−vx·2.4, ±0.28)`, pitch `clamp(−vy·1.6, ±0.18)`, idle `0.015·sin(2π·t/2600)`,
  equip pulse `1→1.04→1` over 260 ms, 360° roll over 700 ms with `easeInOutCubic`, and the
  8-point/220 ms trail; `dtMs === 0`, rest pointer and reduced motion yield exact zero
  bank/pitch, 0 trail points and scale 1. Evidence `ship-motion.test.ts` (24 tests, 100%
  coverage). Wiring into `spaceship.ts` and the `spaceship.test.ts` integration assertions is
  T9's scope.

Deviations from spec: none
