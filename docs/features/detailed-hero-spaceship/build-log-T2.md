# Build log — T2 — Mount the model in the cosmic backdrop and update scene counts

Task: T2 (`docs/features/detailed-hero-spaceship/tasks.md`, plan r2, spec r2), 2026-11-08
Files changed: `src/frontend/src/render/cosmic-backdrop.ts`, `src/frontend/src/render/cosmic-backdrop.test.ts`, `src/frontend/src/render/scene.ts` (comment only), `src/frontend/src/render/scene.test.ts`, `docs/features/detailed-hero-spaceship/build-log-T2.md`
What changed & why (sketch, ≤5 lines):
1. `cosmic-backdrop.ts` now imports `createHeroSpaceshipModel`, re-exports `HERO_HULL_COLOR`/`HERO_FLAME_COLOR`, drops the seven local hero meshes, their three local tints and the unused `BoxGeometry` import, and mounts exactly one `hero-ship-model` child inside the pinned `hero-ship` group.
2. `COSMIC_BACKDROP_OBJECT_COUNT` is `70` (1 group + 7 asteroids + 3 meteor groups + 6 meteor meshes + 1 comet group + 2 comet meshes + the 50-object hero subtree = 1 hero group + 1 model group + 48 meshes); the 12 direct children and the 15-mesh non-hero disposal loop are unchanged.
3. `dispose()` calls `heroModel.dispose()` exactly once for the hero subtree (48 unique geometries, 11 shared materials), then the unchanged 15-mesh non-hero loop and the nebula texture; `collectMeshes` is 63 total.
4. `cosmic-backdrop.test.ts` pins the mounted model/name map/palette usage, 70 objects, 63 meshes, unique-set disposal + model-dispose-once/idempotence, and keeps motion/dt-clamp/reduced-motion/no-shadow/`z < -4` exact.
5. `scene.ts` gets the comment-only `(28 objects)` → `(70 objects)` edit; `scene.test.ts` updates `baselineObjects` `60` → `102` (`32 + COSMIC_BACKDROP_OBJECT_COUNT`) and its comment, leaving every camera/anchor/child-count assertion intact.

Decisions:
- The backdrop keeps its public surface unchanged (no new `heroModel` field): the model is found through the scene graph (`heroShip.children[0]`) in integration tests. To assert the disposal seam itself, `cosmic-backdrop.test.ts` wraps the real factory with `vi.mock`/`vi.hoisted` and records the created model, so `vi.spyOn(model, 'dispose')` observes the exact call the backdrop makes while every geometry/material remains the real three.js instance.
- `heroModel.dispose()` runs before the non-hero loop. Order is irrelevant for correctness (the sets are disjoint) but matches the plan's "before clearing the group" wording and documents that the hero subtree is never part of `ownedMeshes`.
- The hero palette comment records the pinned re-exported values (`0x2f6fd6`, `0xff9a3c`); the constants themselves live only in `spaceship-model.ts` (single source of truth).
- `scene.test.ts` changed only the one baseline literal/comment; the `countObjects` assertions that read `COSMIC_BACKDROP_OBJECT_COUNT` follow the constant automatically and stayed exact.

## Evidence

### `npm run lint`

```

> lint
> eslint .

exit=0
```

### `npm run typecheck`

```

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

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/game-view.css.test.ts (28 tests) 12ms
 ✓ src/ui/app.css.test.ts (83 tests) 14ms
 ✓ src/render/webgl.test.ts (17 tests) 14ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 12ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/auth/api.test.ts (28 tests) 17ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 19ms
 ✓ src/render/background-life.test.ts (14 tests) 11ms
 ✓ src/render/particles.test.ts (20 tests) 16ms
 ✓ src/auth/store.test.ts (31 tests) 19ms
 ✓ src/game/board.test.ts (18 tests) 20ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 16ms
 ✓ src/ui/icons.test.tsx (16 tests) 22ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 22ms
 ✓ src/render/spaceship.test.ts (34 tests) 47ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 12ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 19ms
 ✓ src/render/picking.test.ts (12 tests) 80ms
 ✓ src/input/gestures.test.ts (27 tests) 34ms
 ✓ src/render/starfield.test.ts (23 tests) 104ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 149ms
 ✓ src/render/cube-view.test.ts (33 tests) 142ms
 ✓ src/game/engine.test.ts (101 tests) 111ms
 ✓ src/render/world.test.ts (27 tests) 177ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 261ms
 ✓ src/game/progression.test.ts (21 tests) 11ms
 ✓ src/game/parts.test.ts (23 tests) 8ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/game/economy.test.ts (7 tests) 4ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/ws/connection.test.ts (10 tests) 15ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/render/postprocessing.test.ts (10 tests) 12ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 7ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 144ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 11ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/ui/theme.test.ts (11 tests) 8ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 6ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 298ms
 ✓ src/render/nebula.test.ts (11 tests) 537ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  455ms
 ✓ src/render/scene.test.ts (85 tests) 906ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 153ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 153ms
 ✓ src/ui/Hud.test.tsx (16 tests) 138ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 204ms
 ✓ src/game/session.test.ts (71 tests) 990ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 319ms
 ✓ src/App.test.tsx (26 tests) 458ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 735ms

 Test Files  54 passed (54)
      Tests  1351 passed (1351)
   Start at  00:09:12
   Duration  2.54s (transform 4.89s, setup 0ms, collect 14.58s, tests 6.56s, environment 3.37s, prepare 4.74s)

exit=0
```

### `npm run coverage --workspace @cubeclicker/frontend`

```

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (83 tests) 26ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 19ms
 ✓ src/multiplayer/protocol.test.ts (171 tests) 16ms
 ✓ src/auth/api.test.ts (28 tests) 25ms
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 12ms
 ✓ src/render/webgl.test.ts (17 tests) 11ms
 ✓ src/auth/store.test.ts (31 tests) 15ms
 ✓ src/game/board.test.ts (18 tests) 19ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 14ms
 ✓ src/ui/icons.test.tsx (16 tests) 21ms
 ✓ src/render/particles.test.ts (20 tests) 18ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 27ms
 ✓ src/render/spaceship.test.ts (34 tests) 44ms
 ✓ src/ui/SpaceshipPreview.test.tsx (5 tests) 14ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (11 tests) 27ms
 ✓ src/input/gestures.test.ts (27 tests) 47ms
 ✓ src/render/starfield.test.ts (23 tests) 127ms
 ✓ src/game/engine.test.ts (101 tests) 115ms
 ✓ src/render/picking.test.ts (12 tests) 154ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 188ms
 ✓ src/ui/game-view.css.test.ts (28 tests) 18ms
 ✓ src/render/cube-view.test.ts (33 tests) 288ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/render/postprocessing.test.ts (10 tests) 15ms
 ✓ src/game/progression.test.ts (21 tests) 11ms
 ✓ src/game/parts.test.ts (23 tests) 12ms
 ✓ src/input/keyboard.test.ts (13 tests) 18ms
 ✓ src/game/upgrades.test.ts (20 tests) 10ms
 ✓ src/game/effects.test.ts (28 tests) 12ms
 ✓ src/ui/theme.test.ts (11 tests) 8ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 7ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/game/economy.test.ts (7 tests) 6ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 13ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/render/world.test.ts (27 tests) 377ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 453ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 234ms
 ✓ src/render/scene-spaceship.test.ts (14 tests) 520ms
 ✓ src/render/nebula.test.ts (11 tests) 872ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  711ms
 ✓ src/ui/UpgradesPanel.test.tsx (8 tests) 232ms
 ✓ src/ui/Hud.test.tsx (16 tests) 211ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 304ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 274ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 469ms
 ✓ src/App.test.tsx (26 tests) 587ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 924ms
 ✓ src/game/session.test.ts (71 tests) 2129ms
 ✓ src/render/scene.test.ts (85 tests) 2276ms

 Test Files  54 passed (54)
      Tests  1351 passed (1351)
   Start at  00:09:15
   Duration  3.41s (transform 5.41s, setup 0ms, collect 14.36s, tests 11.30s, environment 3.83s, prepare 5.17s)

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
 src/render        |   99.03 |    96.76 |   98.63 |   99.03 |                   
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
exit=0
```

All four aggregate frontend metrics are ≥ 80 (95.8 statements / 95.37 branches / 96.61 functions / 95.8 lines); `cosmic-backdrop.ts` is 99/96/100/99, `scene.ts` 97.48/96.17/94.73/97.48 and `spaceship-model.ts` 100 across.

### Count / diff cross-checks

```
$ git diff --stat
 src/frontend/src/render/cosmic-backdrop.test.ts | 222 ++++++++++++++++++++----
 src/frontend/src/render/cosmic-backdrop.ts      | 134 +++-----------
 src/frontend/src/render/scene.test.ts           |   6 +-
 src/frontend/src/render/scene.ts                |   2 +-
 4 files changed, 220 insertions(+), 144 deletions(-)

$ git diff -- src/frontend/src/render/scene.ts
- * `cosmic-backdrop` group (28 objects) owning the nebula `DataTexture` used as
+ * `cosmic-backdrop` group (70 objects) owning the nebula `DataTexture` used as
  * `scene.background`, and, online, one remote world of ≤ (X − 1) cube views (AC-10,
```

`scene.ts` has no executable change; the only diff hunk is the header comment.

Test-pinned counts (all asserted, all green):
- `COSMIC_BACKDROP_OBJECT_COUNT` 70; `countObjects(backdrop.group)` 70; `backdrop.group.children` 12.
- Hero subtree 50 objects (`HERO_SHIP_SUBTREE_OBJECT_COUNT`), model subtree 49 (`HERO_SHIP_MODEL_OBJECT_COUNT`), 48 hero meshes in the exact name→count map.
- `collectMeshes(backdrop.group)` 63 total = 15 non-hero + 48 hero; 63 unique geometries; 26 unique materials = 15 non-hero + `HERO_MATERIAL_COUNT` (11) hero.
- Hero palette per-family counts: hull 4, light 1, mid 10, navy 17, orange 6, canopy 1, highlight 1, flame 2, core 2, housing 2, nozzle 2 (sum 48).
- Scene baseline `32 + 70 = 102`; scene children 9 (10 with one remote world).

## Acceptance audit (T2: AC-11, AC-12, AC-13)

| AC | Verdict | Evidence |
| --- | --- | --- |
| AC-11 — Backdrop composition and counts | met | `cosmic-backdrop.test.ts` "pins the exported counts, colours and positions" (70, `0x2f6fd6`, `0xff9a3c`, re-export identity), "builds one named group with exactly the pinned object count" (70, 12 children, hero subtree 50/model 49), "mounts exactly one detailed hero-ship-model inside the pinned hero-ship group" (one child, name, scale `1.7`, pitch −0.1/yaw 0.26, 48 meshes, exact name map), "shares exactly eleven hero materials with the pinned per-family mesh counts", and the retained "casts no shadows and keeps every object behind the cube" (`z < -4`, no shadow flags). |
| AC-12 — Motion, reduced motion and disposal | met | "moves every asteroid, meteor, the comet and the hero ship for a positive dt" pins the retained rotations/drift and the exact hero bob plus unchanged model-local transforms; "freezes every transform under reduced motion"; "clamps non-positive dt so nothing advances"; "releases every unique geometry/material and the texture exactly once, then detaches" (63 geometries, 26 materials, 15 non-hero / 11 hero split, model `dispose()` once, texture once, group empty, second dispose no-op). |
| AC-13 — Scene integration and camera-anchored composition | met | `scene.test.ts` baseline `32 + COSMIC_BACKDROP_OBJECT_COUNT` and literal `102`; retained ninth-child/9–10 children, hero world position `[ownX + 15, ownY + 1.5, -14]` from slots 1/2/ring-10, anchor offsets 6/4, starfield/background-life, update-forwarding and disposal assertions all green; `scene.ts` diff above is comment-only. |

## Scope / testing notes

- Only the four owned frontend files and this build log were touched. `spaceship-model.*`, cursor/UI/game/multiplayer/backend/config/container files, `tasks.md`, `status.md`, `README.md` and `docs/features/README.md` are untouched.
- Unit + integration tiers: the factory itself is T1's unit tier; T2 exercises the real three.js scene graph through `createCosmicBackdrop`/`createSceneView` (integration boundary: the backdrop mounted in the scene and the disposal lifecycle). All assertions use concrete expected values; no wildcard matchers, snapshots or close-to assertions were added.
- No new dependency, loader, URL, texture (beyond the existing nebula), lockfile, config, container or `.env*` change.

Acceptance audit: T2 (AC-11, AC-12, AC-13) → all met (table above).
Deviations from spec: none.
