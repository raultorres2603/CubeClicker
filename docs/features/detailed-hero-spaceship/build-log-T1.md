# Build log — T1 — Detailed hero ship model factory

Task: T1 (`docs/features/detailed-hero-spaceship/tasks.md`, plan r2, spec r2), 2026-11-08
Files changed: `src/frontend/src/render/spaceship-model.ts` (new), `src/frontend/src/render/spaceship-model.test.ts` (new), `docs/features/detailed-hero-spaceship/build-log-T1.md` (new)
What changed & why (sketch, ≤5 lines):
1. New pure three.js factory `createHeroSpaceshipModel()` builds one `hero-ship-model` group (scale 1.7, pitch −0.10, yaw 0.26, roll 0) with exactly 48 named meshes as direct children and the pinned palette/count/dimension constants.
2. Built the hull/stepped underplate/nose/spine, cockpit/bezel/highlight, swept `ExtrudeGeometry` wings with leading edges/wingtips/seams, canted tail fins, twin ribbed nacelles with nozzles/additive flames/cores, and the seam/vent/antenna/greeble/stripe detail at the pinned model-local offset.
3. Exactly 11 shared materials with the pinned PBR/basic values; `triangleCount` computed once (1,852); `dispose()` releases each unique geometry/material once and is idempotent.
4. `spaceship-model.test.ts` pins the exact name→count map, material values/usage, Box3 dimensions with the transform reset, attitude, cockpit, wings/fins, engines/exhaust, detail thinness/offset, triangle budget, absence of lights/points/sprites/textures, and disposal.

Decisions:
- Hull seams are thin open `CylinderGeometry` rings (height 0.035) instead of the plan table's BoxGeometry strips: AC-10 explicitly allows `BoxGeometry` or `CylinderGeometry`, and rings follow the tapered/flattened fuselage at a constant radial `HERO_DETAIL_OFFSET` without floating strips; every seam stays ≤ 0.06 in one model-local dimension (0.035).
- Nacelle ribs use the default `TorusGeometry` orientation (ring in the xy plane, hole along local z) because the housings' axis is z; the plan's “rotate the torus by π/2” note would point the hole along y and not ring the nacelle.
- Hull/light/mid/orange/canopy/housing materials are `MeshPhysicalMaterial`; navy trim and the nozzle use `MeshStandardMaterial` (their pinned values have no clearcoat); the highlight/flames/cores are `MeshBasicMaterial`.
- The wing shape tip is x = ±1.66 (the visible cap stays at the pinned ±1.65) so the geometry shape-x span is 1.26 ≥ `HERO_WING_SHAPE_SPAN` (1.25) with float margin.

## Evidence

### Verify commands (raw)

```
$ npm run lint
> lint
> eslint .
(exit 0, no findings)
```

```
$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
(exit 0)
```

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/render/spaceship-model.test.ts (33 tests) 153ms
 … (52 other suites, all green)

 Test Files  54 passed (54)
      Tests  1350 passed (1350)
   Start at  00:03:06
   Duration  2.34s (transform 5.40s, setup 0ms, collect 14.05s, tests 6.57s, environment 3.37s, prepare 4.49s)
(exit 0)
```

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8
 … (54 suites, 1350 tests passed)

 Test Files  54 passed (54)
      Tests  1350 passed (1350)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.84 |    95.37 |   96.61 |   95.84 |
 ...
 src/render        |   99.05 |    96.77 |   98.63 |   99.05 |
  ...ship-model.ts |     100 |      100 |     100 |     100 |
 ...
-------------------|---------|----------|---------|---------|-------------------
(exit 0; all four aggregate metrics ≥ 80)
```

### Model-local measurements (probe + test assertions)

Raw measurement of the built model with the group scale/rotation reset:

```
box min [-1.6899999991059302, -0.35000000029802325, -2.3500000119209288]
box max [ 1.6899999991059302, 0.7167938826140002,  2.199999988079071]
size    [ 3.3799999982118605, 1.0667938829120236,  4.55]
nose max z = 2.199999988079071 (≥ 1.9)
outer-flame min z = -2.3500000119209288 (≤ −2.0); core min z = -2.339999997615814 (≤ −2.1)
wing geometry bbox = 1.2599999606609344 × 1.4999999701976776 × 0.07999999821186066
materials = 11 instances, mesh usage histogram = [1, 1, 1, 2, 2, 2, 2, 4, 6, 10, 17]
triangles = 1852 (≤ HERO_SHIP_MAX_TRIANGLES = 6000)
nose tip world (outer hero group at (9, −2.5, −14), rotation.y = π/2):
  x = 12.59624208019016, y = −2.1391722301442218
  nose.x > housing-left.x 7.852169280715982 and > housing-right.x 6.8954914181229245
  nose.y − housing-left.y = 0.561421766748786
  nose.y − housing-right.y = 0.6574097263834697
  nose.y − nozzle-left.y = 0.6729503501587537
  nose.y − nozzle-right.y = 0.7689383097934379 (all ≥ 0.2)
detail thinness (model-local geometry boxes): hull seams 0.035, wing seams 0.030,
  vents 0.050, antennae 0.0208–0.024, greebles 0.040 (all ≤ 0.06)
detail offsets measured with the transform reset: wing seam bottom − wing top =
  0.01500000033; greeble bottom − spine top = 0.01499999970;
  antenna bottom − spine top = 0.01499999925 (all ≥ HERO_DETAIL_OFFSET = 0.012)
```

### Import / no-loader scan

```
$ grep -nE "GLTFLoader|FileLoader|TextureLoader|fetch\(|http://|https://" src/frontend/src/render/spaceship-model.ts
no matches
$ grep -nE "Math\.random|document\.|window\.|new Scene|new PerspectiveCamera|new Camera" src/frontend/src/render/spaceship-model.ts
no matches
$ sed -n '31,48p' src/frontend/src/render/spaceship-model.ts
import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
```

The only import is the named `three` list above; there is no `import *`, loader, URL,
external asset, DOM or random source.

## Acceptance audit (T1: AC-2 … AC-10)

| AC | Verdict | Evidence |
| --- | --- | --- |
| AC-2 — Factory and object contract | met | `spaceship-model.test.ts` "builds one `hero-ship-model` group…" (name, `scale.toArray() === [1.7,1.7,1.7]`, rotation −0.1/0.26/0, 48 direct `Mesh` children), "reports the pinned model and hero subtree object counts" (`49`/`50`), "exposes the two flame and two core meshes…", "computes a positive triangle count…" (exact 1,852, `≤ 6000`), "casts and receives no shadows", "creates no lights, points, sprites or textures", "is deterministic and parameter-free". |
| AC-3 — Named parts | met | "contains exactly the AC-3 name→count map (46 names, 48 meshes)" compares the full 46-key map (including `hero-engine: 2`, `hero-engine-core: 2`) and the 48-mesh total. |
| AC-4 — Palette and material values | met | Palette constants test (all 11 hex values); "creates exactly 11 shared materials with the pinned per-family mesh usage" (histogram [1,1,1,2,2,2,2,4,6,10,17]); "reuses the same instances…"; the three value tests pin every colour, metalness/roughness, clearcoat, emissive/intensity, flame transparency/opacity/additive/depthWrite and highlight 0.9. |
| AC-5 — Dimensions, proportions, scale | met | "measures the pinned wingspan, height and length…" with transform reset: x 3.3799999982 ∈ [3.2, 3.4], y 1.0667938829 ∈ [0.9, 1.1], z 4.55 ∈ [4.2, 4.8]; "puts the nose tip forward of z = 1.9…" (2.199999988; flames −2.350000012, cores −2.34). |
| AC-6 — Three-quarter attitude / upward nose | met | "yaws and pitches so the nose leads screen-right…": outer hero group pinned at `(9, −2.5, −14)`/`π/2`; nose tip world x 12.596 > both housing x (7.852, 6.895); nose y minus both housing centres (0.561, 0.657) and both nozzle centres (0.673, 0.769) ≥ 0.2. |
| AC-7 — Cockpit and canopy | met | "places the teal sphere canopy…" (`SphereGeometry`, z 0.82 ≥ 0.7, y 0.33 ≥ 0.25, no pilot); "wraps the canopy in the mid-gray bezel ring…" (frame bbox contains cockpit in x/z, centre deltas 0 and ~1e−16, y positions differ 0.02 ≤ 0.05); "places the bright highlight strip above…" (0.462 > 0.33, highlight material). |
| AC-8 — Wings and tail fins | met | "builds two swept `ExtrudeGeometry` wings…" (hull-blue material; geometry bbox 1.25999996 ≥ 1.25 and 1.49999997 ≥ 1.4); "sets gray leading edges…/orange wingtips at ±1.65"; "builds canted navy tail fins…" (z −1.25 ≤ −1.2, `parameters.height` 0.55 ≥ 0.5, `position.y + height/2` 0.625 ≥ 0.55, orange tips y 0.65 above the fin top). |
| AC-9 — Twin engines and exhaust | met | "places two 12-segment housing cylinders…" (±1.1, −0.05, −1.0; `radialSegments` 12); "rings each nacelle with two mid-gray torus ribs"; "ends each nacelle in a dark nozzle and two additive flames with cores" (flames ±1.1/−0.05/z −2.05, additive/0.85/`depthWrite false`; cores z −2.15); "connects each nacelle…with a navy pylon"; global shadow-free test covers all engine meshes. |
| AC-10 — Surface detail | met | Exact detail counts test (3 hull seams, 6 wing seams, 2 vents, 2 antennae, 2 greebles, 2 stripes); thinness test over all 15 detail meshes (Box/Cylinder, min dimension 0.0208–0.05 ≤ 0.06, navy or mid-gray); measured offsets 0.0150/0.0150/0.0150 ≥ `HERO_DETAIL_OFFSET` 0.012; orange stripes use the orange accent instance. |

## Scope / testing notes

- Files touched: only the two new `render/spaceship-model.*` files and this build log. `cosmic-backdrop.ts`/`.test.ts`, `scene.ts`/`.test.ts`, cursor/UI/game/multiplayer/backend/config/container files, `tasks.md`, `status.md` and `docs/features/README.md` are untouched.
- Integration-tier exception: T1 is a pure, DOM-free three.js factory with no external boundary (no scene, network, I/O or state). Per spec § Testing strategy the integration tier for this feature is `cosmic-backdrop.test.ts` / `scene.test.ts`, owned by T2; the T1 test suite exercises the real three.js scene graph (groups, transforms, `Box3`, materials, disposal) in the node environment. No integration boundary exists inside T1's `files_owned`.
- No new dependency, lockfile, config, container or `.env*` change; the module imports named symbols from the installed `three` only.

Acceptance audit: T1 (AC-2 … AC-10) → all met (table above).
Deviations from spec: none. Plan-level implementation notes recorded under Decisions (hull seam primitive and torus orientation); AC-10 explicitly permits the chosen seam primitive.
