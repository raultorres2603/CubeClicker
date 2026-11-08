# Build log — T9 — Cursor + scene + effects integration

Task: T9 (2026-11-08)
Files changed: `src/frontend/src/game/effects.ts`, `src/frontend/src/game/effects.test.ts`,
`src/frontend/src/render/cube-view.ts`, `src/frontend/src/render/cube-view.test.ts`,
`src/frontend/src/render/world.test.ts`, `src/frontend/src/render/spaceship.ts`,
`src/frontend/src/render/spaceship.test.ts`, `src/frontend/src/render/scene.ts`,
`src/frontend/src/render/scene.test.ts`, `src/frontend/src/render/scene-spaceship.test.ts`,
`src/frontend/src/render/targeting.ts`, `src/frontend/src/render/targeting.test.ts`,
`src/frontend/src/render/impact-effects.ts`, `src/frontend/src/render/impact-effects.test.ts`,
`src/frontend/src/render/particles.ts`, `src/frontend/src/render/particles.test.ts`,
`src/frontend/src/render/quality.ts`, `src/frontend/src/render/quality.test.ts`,
`docs/features/spaceship-cursor-loot-animations/build-log-T9.md`

Sketch:
- Instant conceal: `MINI_CUBE_POP_MS = 0`; same-frame zero scale in `cube-view`, no pop
  records/colour writes; remote cubes inherit the same path. Dedupe `easeOutCubic` into
  `motion.ts` and re-export it from `effects.ts`.
- Replace the 7-mesh cursor with `createCursorShipModel` inside the outer `spaceship`
  group + one trail `Points`: 34 objects, 21 meshes, 19 materials, 22 high-tier draws;
  bank/pitch/idle/equip pulse/fly-by/plumes, no muzzle/recoil/press.
- Add pure `quality.ts` (120-frame window, 60 samples, mean/nearest-rank p95, exact
  thresholds/cooldowns/hysteresis) and `impact-effects.ts` (rays/shards/coins/ring pools) +
  `targeting.ts` (outline/reticle) under the existing particle group; scene applies the
  feature matrix once per frame and at reduced-motion transitions.

What changed & why:
- `game/effects.ts`: `MINI_CUBE_POP_MS` is `0`; removed the 160 ms pop curve/constants and
  `popScaleAt`/`popColorMultiplierAt`; `easeOutCubic` is now only re-exported from
  `motion.ts` (same function identity); added the shared `REFERENCE_PIXEL_WORLD` conversion.
- `render/cube-view.ts`: every `hideMiniCube` zero-scales the instance on the same frame,
  writes no colour and records nothing; `update`/`settlePops` are compatibility no-ops.
  `world.test.ts`/`scene.test.ts` now pin same-frame remote/local conceal.
- `render/particles.ts`: added `setSparkLimit`/`getSparkLimit` (24/12/0 quality budgets; a
  zero limit consumes no random draws); the existing 24-point burst remains the spark layer.
- `render/quality.ts`: pure policy + exact `qualityFeatures(tier, reducedMotion)` matrix;
  `setTier` is the forced-tier hook (cooldowns/recovery still apply).
- `render/impact-effects.ts`: four pooled drawables (3 ray fans ×12, 42 shards, 18 coins,
  3 merged rings), oldest-first recycling, exact lifetimes/easings, reduced-motion static
  120 ms ring flash, no per-spawn geometry/material.
- `render/targeting.ts`: one white 1.03-scale edge outline (depthTest false, renderOrder 11)
  + six 60° tick lines (12 vertices), 120 ms fade/250 ms hold, miss hides, reduced motion
  static outline/no ticks, quality flag disables ticks only.
- `render/spaceship.ts`: outer `spaceship` group (scale 1.2, rest `(0,0,6)`) with the 32-object
  cursor model + one trail `Points` (34 objects); `applyAppearance` per slot via the model,
  no-op + no pulse for an unchanged appearance; follow/bank/pitch/idle/trail/equip pulse,
  100 ms plume flicker, 700 ms 360° fly-by on a 1.2 orbit with a 16-point/700 ms fire trail;
  the shot list/travel time are unchanged and the cursor has no muzzle/recoil/press response.
- `render/scene.ts`: impact + targeting are children of the existing particle group, so
  `scene.children` stays 9/10 while `countObjects(scene)` becomes 136; hover target,
  quality policy push (`pushFrameTime` once per frame), feature application to
  spacecraft/targeting/impact/particles, deferred-explosion impact spawn, quality-tier test
  hook and disposal wiring.

Decisions:
- The adaptive policy starts counting condition streaks from the first live sample and only
  permits a change once `QUALITY_MIN_SAMPLES = 60` are present; a constant slow stream
  therefore downgrades on its 60th frame, while the 180/240-frame upgrade streaks and
  1000/3000 ms cooldowns are unchanged.
- Reduced motion is authoritative: the quality matrix turns off trail/reticle motion,
  cursor motion, sparks and impact particles and switches the ring to the 120 ms flash; the
  cursor outline remains static so target lock stays readable.
- The cursor trail uses one preallocated 16-slot `Points` drawable for both modes: the
  normal trail stores 8 points at 220 ms; the fly-by stores 16 points at 700 ms. This keeps
  the 34-object contract and 22-draw ceiling.
- The scene ages particles/impact pools before spawning a frame's deferred explosion so a
  new burst starts at elapsed 0 instead of being aged by the same frame.
- The hero ship, detailed-hero files and camera/HUD transforms are untouched; no shake was
  introduced (tested camera position/quaternion equality).

Evidence:
- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .
  ```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > typecheck
  > tsc --noEmit
  ```
- `npm test --workspace @cubeclicker/frontend` → exit 0 (61 files / 1531 tests):
  ```
   ✓ src/render/quality.test.ts (23 tests)
   ✓ src/render/particles.test.ts (24 tests)
   ✓ src/render/impact-effects.test.ts (15 tests)
   ✓ src/render/targeting.test.ts (11 tests)
   ✓ src/render/cube-view.test.ts (32 tests)
   ✓ src/render/spaceship.test.ts (31 tests)
   ✓ src/render/world.test.ts (27 tests)
   ✓ src/game/effects.test.ts (25 tests)
   ✓ src/render/scene-spaceship.test.ts (24 tests)
   ✓ src/render/scene.test.ts (85 tests)
   Test Files  61 passed (61)
        Tests  1531 passed (1531)
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80/80/80/80):
  ```
   Test Files  61 passed (61)
        Tests  1531 passed (1531)
   All files          |   96.17 |    95.61 |   96.98 |   96.17 |
    src/render        |   98.26 |    96.59 |   98.68 |   98.26 |
     cube-view.ts     |     100 |      100 |     100 |     100 |
     impact-effects.ts|   97.24 |    91.76 |     100 |   97.24 |
     particles.ts     |     100 |      100 |     100 |     100 |
     quality.ts       |   97.68 |    97.05 |     100 |   97.68 |
     scene.ts         |   97.16 |    95.48 |   95.12 |   97.16 |
     spaceship.ts     |    94.6 |      100 |   96.42 |    94.6 |
     targeting.ts     |   95.78 |     92.5 |     100 |   95.78 |
    src/game/effects.ts|    100 |      100 |     100 |     100 |
  ```
- Manual frame/bundle traces and the high/medium/low draw-count proof are the T14 final
  gate (AC-8/AC-47); T9 pins the model counts (34 objects, 21 meshes, 19 materials, 22 high
  cursor draws) and the scene baseline (136) in tests.
- Final post-edit re-run (after two comment-only `scene.ts` doc edits): `npm run lint` and
  `npm run typecheck --workspace @cubeclicker/frontend` exit 0 again; the focused
  `npm test --workspace @cubeclicker/frontend -- src/render/scene.test.ts
  src/render/scene-spaceship.test.ts` passes 2 files / 109 tests:
  ```
   ✓ src/render/scene-spaceship.test.ts (24 tests)
   ✓ src/render/scene.test.ts (85 tests)
   Test Files  2 passed (2)
        Tests  109 passed (109)
  ```
- Assertion quality: concrete expected values only (exact counts, names, positions, scales,
  hex colours, tier matrices, pool lifetimes, camera vectors). No wildcard matchers, no
  snapshots, no assertion-free tests. The bounded float exception was not needed.

Acceptance audit:
- AC-5 → met. `spaceshipFollowFactor` keeps `SPACESHIP_FOLLOW_TAU_MS = 240` and
  `1 - exp(-dt/240)` (0 at dt 0, 1 under reduced motion); `spaceshipTargetPosition` keeps
  plane distance 6, NDC offsets `-0.16/-0.12` and the pinned vector within 1e-6. No-pointer
  rest is `(0,0,6)` and does not smooth. Evidence: `spaceship.test.ts`,
  `scene-spaceship.test.ts`.
- AC-6 → met. `SHOT_TRAVEL_MS = 180`, endpoints/linear travel/completion preserved; the
  deferred explosion still fires at the scene layer; two ignitions are hidden at rest,
  visible/flickering after a moving update and hidden under reduced motion. Evidence:
  `spaceship.test.ts`, `scene-spaceship.test.ts`.
- AC-7 → met. `Spaceship.applyAppearance` maps through `appearanceToCursorShipParams`; a
  left-wing change leaves the right wing untouched; a repeated appearance changes nothing
  and does not pulse; the outer group identity is never replaced. `SceneView.applySnapshot`
  applies on change and keeps the shallow `lastAppearance` copy. Evidence:
  `spaceship.test.ts`, `scene-spaceship.test.ts`.
- AC-8 → met at the T9 contract level: the cursor subtree is 34 objects (outer + model root
  + 10 slot groups + 21 meshes + trail), 21 meshes / 19 materials, high-tier cursor draws
  ≤22; scene baseline is 136. Frame traces/bundle size are T14 evidence. Evidence:
  `spaceship.test.ts`, `scene.test.ts`, `scene-spaceship.test.ts`.
- AC-9 → met. Reduced motion zeroes bank/pitch, pulse scale is exactly 1, trail count 0,
  ignitions hidden, no fly-by; materials still reflect the equipped appearance. Evidence:
  `spaceship.test.ts`, `scene-spaceship.test.ts`.
- AC-35 → met. `targeting.ts` provides the 1.03 tile outline, six 60° ticks (12 vertices),
  120 ms fade, 250 ms hold, miss hide, reduced static outline/no ticks; scene exposes
  `setHoverTarget` and refreshes the lock transform per frame. `picking.ts` remains T10.
  Evidence: `targeting.test.ts`, `scene-spaceship.test.ts`.
- AC-36 → met. `MINI_CUBE_POP_MS === 0`; local and remote hides zero-scale on the same
  frame with no pop record/per-frame write and no colour write; `update`/`settlePops` are
  no-ops. Evidence: `effects.test.ts`, `cube-view.test.ts`, `world.test.ts`, `scene.test.ts`.
- AC-37 → met. Four pools: 12 rays/14 shards/6 coins/ring per pop, oldest-first recycling,
  exact lifetimes/easings, one draw each, no per-spawn geometry/material; the spark layer is
  capped at 24/12/0 by tier. Scene spawns the impact at the deferred explosion. Evidence:
  `impact-effects.test.ts`, `particles.test.ts`, `scene-spaceship.test.ts`.
- AC-38 → met. One 394-vertex prebuilt ring geometry (32-segment ring + 8 spokes + 4
  satellites), 3-instance pool, growth 1→5 over 330 ms `easeOutQuad`, 150 ms fade/480 ms
  visible, normal-aligned `+z`, reduced-motion 120 ms final-scale flash. Evidence:
  `impact-effects.test.ts`, `scene-spaceship.test.ts`.
- AC-40 → met for the cursor ship: 700 ms 360° roll on a 1.2-world orbit with a 16-point
  fire trail, then neutral pointer-follow; no camera/HUD shake. The DOM banner/burst remains
  T12. Evidence: `spaceship.test.ts`, `scene-spaceship.test.ts`.
- AC-42 → met. Non-reduced motion keeps bank/pitch formulas, 8-point/220 ms trail,
  0.015/2600 idle bob, 260 ms/4 % equip pulse, 100 ms plume flicker; dt 0/rest/reduced yields
  zero bank/pitch, trail 0 and scale 1; no muzzle/recoil/press. Evidence:
  `spaceship.test.ts`.
- AC-44 → met for the scene: camera position/quaternion are identical across a pop and ring;
  effects and quality wiring never write camera/HUD transforms. Evidence:
  `scene-spaceship.test.ts`.
- AC-47 → T9 pin: high/medium/low cursor draws are 22/17/15 via the exact hidden-mesh sets,
  impact pools are 4 draws and targeting 2; scene baseline 136. Actual frame traces and
  bundle size remain the T14 final gate. Evidence: `quality.test.ts`,
  `scene-spaceship.test.ts`, `scene.test.ts`.
- AC-52 → met. Pure policy with exact 120-frame window, 60-sample gate, 250 ms clamp,
  nearest-rank p95, high→medium/medium→low/medium→high/low→medium thresholds, 60/180/240
  stable frames, 1000/3000 ms cooldowns, one change per decision and default high; feature
  matrix high/medium/low and reduced-motion authority; scene pushes frame time once per
  frame, exposes `getQualityTier()`/`setQualityTierForTesting()` and applies the flags to
  spaceship/targeting/impact/particles. Evidence: `quality.test.ts`,
  `scene-spaceship.test.ts`.

Deviations from spec: none. Out-of-scope files were not edited; the pre-existing modified
feature docs and `reviews/` directory were left untouched and are not staged.
