# Build log — T4 — Freeze starfield swirl under reduced motion

Task: T4 (`docs/features/detailed-hero-spaceship/tasks.md`, plan r3, spec r3), 2026-11-08

Status: **completed** — all four T4 verify commands are green and the commit is created after this
log (`fix: freeze starfield swirl under reduced motion`).

Files changed:
`src/frontend/src/render/starfield.ts`,
`src/frontend/src/render/starfield.test.ts`,
`src/frontend/src/render/scene.test.ts` (one superseded assertion only),
`docs/features/detailed-hero-spaceship/build-log-T4.md`

Scope amendment (approved Option A): the first build pass found `scene.test.ts:718-731` still
asserting the pre-AC-17 contract ("keeps the view-axis swirl turning under reduced motion"). T4's
`files_owned` was extended by `src/frontend/src/render/scene.test.ts`; only that single test was
updated to the freeze assertion. No other scene test, and no executable `scene.ts` code, changed.

What changed & why (sketch, ≤5 lines):

1. `starfield.update` now computes `const motion = reducedMotion === true` before the phase advance
   and gates **only** `swirlAngle += max(0, dtMs) · DRIFT_RADIANS_PER_MS` on `!motion`; the
   `pulseTimeMs` advance, snapped anchor copy, `anchor.quaternion × RotZ(swirlAngle)` composition,
   travel scale and opacity branch are unchanged.
2. The header and `Starfield.update` JSDoc document the reduced-motion swirl freeze (AC-17):
   current orientation kept, pulse/anchor/base opacity retained.
3. `starfield.test.ts` adds five concrete tests: a fresh reduced-motion update at the anchor
   orientation (zero swirl, base opacity, travel scale still applied); a normal-then-reduced pair
   that keeps the pinned `0.015258789062499998` rotation/quaternion and the star positions exact;
   `pulseTimeMs` 1000 → 2000 with base opacity while frozen; the retained normal path (pinned
   swirl quaternion, opacity `0.95`, scale `[8, 8, 1]`, 1200 stars and seed-7 first-star layout);
   and zero random draws during updates.
4. `scene.test.ts`'s stale assertion becomes
   `freezes the view-axis swirl under reduced motion (AC-17)`: the camera-rest and `[1, 1, 1]`
   scale assertions stay, and the starfield quaternion is now exactly `[0, 0, 0, 1]`.
5. No dependency, asset, `random` draw, scene wiring or non-reduced-motion behavior change; the
   normal swirl rate, twinkle, expansion and 1200-star layout remain exactly as before.

Decisions:

- Freeze only the swirl advance instead of skipping `update`: AC-17 still requires the snapped
  camera anchor, `pulseTimeMs` semantics and base opacity, and T2/T3 rely on them.
- Use `motion` once at the top of `update` for both the swirl gate and the existing opacity branch;
  no other statement moved.
- Hard-coded the pre-existing pinned swirl doubles and the twinkle opacity literal (`0.95`) in the
  new assertions rather than `toBeCloseTo`; every new assertion is exact.
- The scene-level freeze test asserts the composed result through the real `createSceneView`
  update path (identity camera anchor × `RotZ(0)`), which is the integration seam for this change.
- No new integration test file was added because T4 owns no other integration file; the
  end-to-end AC-17 screenshot A/B proof is T3's rerun.

## Evidence

### `npm run lint`

```
$ npm run lint
> lint
> eslint .

exit=0
```

### `npm run typecheck`

```
$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

exit=0
```

### `npm test --workspace @cubeclicker/frontend`

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/render/starfield.test.ts (28 tests)
 ✓ src/render/scene.test.ts (85 tests)
 [all 54 test files pass]

 Test Files  54 passed (54)
      Tests  1356 passed (1356)
   Start at  11:20:59
   Duration  2.53s (transform 5.79s, setup 0ms, collect 15.71s, tests 6.98s, environment 3.63s, prepare 4.83s)

exit=0
```

Full raw output: § Appendix, first log block.

### `npm run coverage --workspace @cubeclicker/frontend`

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  54 passed (54)
      Tests  1356 passed (1356)
   Start at  11:21:04

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.8 |    95.37 |   96.61 |    95.8 |
 src/render        |   99.03 |    96.76 |   98.63 |   99.03 |
  scene.ts         |   97.48 |    96.17 |   94.73 |   97.48 |
  starfield.ts     |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
exit=0
```

All four aggregate metrics are ≥ 80 (95.8 / 95.37 / 96.61 / 95.8) and `starfield.ts` is 100 across.
Full raw output with the complete table: § Appendix, second log block.

### Diff guard

```
$ git diff --check -- src/frontend/src/render/starfield.ts src/frontend/src/render/starfield.test.ts src/frontend/src/render/scene.test.ts
exit=0

$ git diff --stat -- src/frontend/src/render/starfield.ts src/frontend/src/render/starfield.test.ts src/frontend/src/render/scene.test.ts
 src/frontend/src/render/scene.test.ts     | 10 ++--
 src/frontend/src/render/starfield.test.ts | 95 +++++++++++++++++++++++++++++++
 src/frontend/src/render/starfield.ts      | 21 +++++--
 3 files changed, 114 insertions(+), 12 deletions(-)
```

`scene.test.ts` diff is exactly the one test (rename + comment + expectation); no other assertion
in the file changes. The `starfield.ts` diff is confined to the two JSDoc paragraphs and the
reduced-motion gate (`const motion` hoisted, `if (!motion)` around the swirl advance); the normal
branch is unchanged. The test diff adds one `reduced-motion swirl freeze (AC-17)` describe block
and changes no existing starfield assertion.

## Acceptance audit (T4: AC-17)

| AC-17 clause | Verdict | Evidence |
| --- | --- | --- |
| `update(dtMs, travelProgress?, anchor?, true)` must not advance the swirl angle or change the swirl quaternion | met | `starfield.test.ts` "starts frozen at the anchor orientation on a fresh reduced-motion update" (exact anchor quaternion, zero swirl) and "leaves the swirled orientation and star positions unchanged under reduced motion" (pinned `0.015258789062499998` rotation/quaternion kept); `scene.test.ts` "freezes the view-axis swirl under reduced motion (AC-17)" pins the composed scene-level quaternion `[0, 0, 0, 1]` after `view.update(1000)` |
| Star geometry must not change | met | Both reduced-motion tests snapshot and compare the full 1200-star `Float32Array` exactly; `starfield.ts` never writes positions in `update` |
| `pulseTimeMs` may still advance | met | "keeps advancing pulseTimeMs and base opacity while the swirl stays frozen" (1000 → 2000, quaternion `[0, 0, 0, 1]` both times) |
| Snapped camera anchor and base opacity retained | met | The fresh reduced-motion test asserts `points.position [3, 4, 5]` and `opacity === STARFIELD_OPACITY_BASE`; the travel scale `[8, 8, 1]` is still applied |
| Non-reduced-motion swirl, twinkle, expansion and 1200-star layout unchanged | met | "retains the normal swirl, twinkle, expansion and 1200-star layout" pins the exact quaternion, rotation, opacity `0.95`, scale `[8, 8, 1]`, count 1200 and the seed-7 first-star coordinates; every pre-existing swirl/twinkle/expansion test stays green |
| No new dependency, asset or random draw | met | "consumes no random draws during updates, reduced motion included" (`4 × STAR_COUNT` before and after three updates); no import/package change |
| `scene.test.ts` forwarding assertions remain green | met | Full suite 54/54 files, 1356/1356 tests; the one superseded swirl assertion now asserts the AC-17 freeze |

## Scope / testing notes

- Only `starfield.ts`, `starfield.test.ts`, the single superseded `scene.test.ts` assertion and
  this build log were touched. The model/backdrop/UI/game/multiplayer files, executable
  `scene.ts`, configs, lockfiles, containers, `README.md`, `spec.md`, `plan.md`, `tasks.md` and
  `status.md` are untouched.
- Unit tier: the new reduced-motion swirl tests exercise the real `createStarfield` module with a
  deterministic seeded source. Integration tier: the `scene.test.ts` freeze assertion exercises the
  real `createSceneView` update path (the sole integration caller). The end-to-end AC-17 screenshot
  A/B proof remains T3's rerun.
- No banned matchers, snapshots, `toBeCloseTo`, `toMatchObject` or assertions on implementation
  details were added; every new expected value is exact.
- No new dependency, loader, URL, texture, lockfile, config, container or `.env*` change.

Acceptance audit: T4 (AC-17) → all clauses met (table above).
Deviations from spec: none. The one-test `scene.test.ts` change is the approved Option A scope
amendment; no other scene test or executable scene code changed.

## Appendix — full raw verify logs

### npm run lint

```

> lint
> eslint .

```

### npm run typecheck

```

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

### npm test --workspace @cubeclicker/frontend

```

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/game-view.css.test.ts (28 tests) 10ms
 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/auth/api.test.ts (28 tests) 12ms
 ✓ src/game/parts.test.ts (23 tests) 7ms
 ✓ src/game/effects.test.ts (28 tests) 10ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 15ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 29ms
 ✓ src/render/background-life.test.ts (14 tests) 13ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 15ms
 ✓ src/game/board.test.ts (18 tests) 21ms
 ✓ src/render/particles.test.ts (20 tests) 19ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 13ms
 ✓ src/ui/icons.test.tsx (16 tests) 26ms
 ✓ src/input/keyboard.test.ts (13 tests) 11ms
 ✓ src/render/spaceship.test.ts (34 tests) 42ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 23ms
 ✓ src/input/gestures.test.ts (27 tests) 35ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 23ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 127ms
 ✓ src/game/engine.test.ts (101 tests) 77ms
 ✓ src/render/picking.test.ts (12 tests) 96ms
 ✓ src/render/starfield.test.ts (28 tests) 136ms
 ✓ src/ui/app.css.test.ts (83 tests) 27ms
 ✓ src/render/cube-view.test.ts (33 tests) 192ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 233ms
 ✓ src/render/world.test.ts (27 tests) 176ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/game/upgrades.test.ts (20 tests) 7ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/game/progression.test.ts (21 tests) 12ms
 ✓ src/render/webgl.test.ts (17 tests) 15ms
 ✓ src/ui/theme.test.ts (11 tests) 6ms
 ✓ src/render/postprocessing.test.ts (10 tests) 10ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 13ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 3ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 14ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 8ms
 ✓ src/game/economy.test.ts (7 tests) 8ms
 ✓ src/auth/store.test.ts (31 tests) 25ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 7ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 277ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 173ms
 ✓ src/render/nebula.test.ts (11 tests) 552ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  449ms
 ✓ src/render/scene.test.ts (85 tests) 952ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 172ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 196ms
 ✓ src/ui/Hud.test.tsx (16 tests) 189ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 193ms
 ✓ src/game/session.test.ts (71 tests) 1131ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 393ms
 ✓ src/App.test.tsx (26 tests) 467ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 720ms

 Test Files  54 passed (54)
      Tests  1356 passed (1356)
   Start at  11:20:59
   Duration  2.53s (transform 5.79s, setup 0ms, collect 15.71s, tests 6.98s, environment 3.63s, prepare 4.83s)

```

### npm run coverage --workspace @cubeclicker/frontend

```

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (83 tests) 22ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 12ms
 ✓ src/auth/api.test.ts (28 tests) 19ms
 ✓ src/browser-env.test.ts (6 tests) 14ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 17ms
 ✓ src/game/board.test.ts (18 tests) 17ms
 ✓ src/render/webgl.test.ts (17 tests) 12ms
 ✓ src/render/background-life.test.ts (14 tests) 18ms
 ✓ src/auth/store.test.ts (31 tests) 13ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 21ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 14ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 14ms
 ✓ src/render/particles.test.ts (20 tests) 18ms
 ✓ src/ui/icons.test.tsx (16 tests) 26ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 26ms
 ✓ src/render/spaceship.test.ts (34 tests) 46ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 18ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 26ms
 ✓ src/input/gestures.test.ts (27 tests) 38ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 173ms
 ✓ src/render/starfield.test.ts (28 tests) 127ms
 ✓ src/game/engine.test.ts (101 tests) 109ms
 ✓ src/render/picking.test.ts (12 tests) 158ms
 ✓ src/game/progression.test.ts (21 tests) 9ms
 ✓ src/ws/connection.test.ts (10 tests) 17ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/render/postprocessing.test.ts (10 tests) 12ms
 ✓ src/render/cube-view.test.ts (33 tests) 301ms
 ✓ src/ui/game-view.css.test.ts (28 tests) 24ms
 ✓ src/input/keyboard.test.ts (13 tests) 14ms
 ✓ src/game/parts.test.ts (23 tests) 12ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 8ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 14ms
 ✓ src/game/rotation.test.ts (15 tests) 13ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/ui/theme.test.ts (11 tests) 10ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 442ms
 ✓ src/render/world.test.ts (27 tests) 367ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 283ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 579ms
 ✓ src/render/nebula.test.ts (11 tests) 898ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  706ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 232ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 261ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 218ms
 ✓ src/ui/Hud.test.tsx (16 tests) 158ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 414ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 919ms
 ✓ src/App.test.tsx (26 tests) 575ms
 ✓ src/render/scene.test.ts (85 tests) 2171ms
 ✓ src/game/session.test.ts (71 tests) 2197ms

 Test Files  54 passed (54)
      Tests  1356 passed (1356)
   Start at  11:21:04
   Duration  3.50s (transform 5.50s, setup 0ms, collect 15.11s, tests 11.15s, environment 3.80s, prepare 5.79s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.8 |    95.37 |   96.61 |    95.8 |                   
 src               |   84.16 |     79.5 |    92.1 |   84.16 |                   
  App.tsx          |   83.33 |    77.39 |    92.3 |   83.33 | ...03,417-419,505 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   95.44 |    99.68 |   98.75 |   95.44 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |    99.7 |      100 |     100 |    99.7 | 882-883           
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   89.85 |    99.61 |   96.55 |   89.85 | ...1140,1153-1154 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.47 |    96.05 |   95.71 |   92.47 |                   
  protocol.ts      |   87.09 |     94.9 |   89.28 |   87.09 | ...94-905,909-919 
  server-state.ts  |   98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   97.95 |      100 |     100 |   97.95 | 176-178,196       
 src/render        |   99.03 |    96.77 |   98.63 |   99.03 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |       96 |     100 |      99 | 299-300           
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  scene.ts         |   97.48 |    96.17 |   94.73 |   97.48 | ...48-949,973-974 
  ...ship-model.ts |     100 |      100 |     100 |     100 |                   
  spaceship.ts     |   98.25 |    94.54 |     100 |   98.25 | ...44,360,380,391 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   96.45 |    97.26 |   88.67 |   96.45 |                   
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   81.17 |    68.75 |      50 |   81.17 | 45-50,52-57,96-99 
  ...ipPreview.tsx |   93.75 |      100 |     100 |   93.75 | 18-19             
  ...adesPanel.tsx |     100 |      100 |     100 |     100 |                   
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```
