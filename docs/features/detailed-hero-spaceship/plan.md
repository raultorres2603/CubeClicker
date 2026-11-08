---
feature: detailed-hero-spaceship
revision: 3
---

# Plan — Detailed hero spaceship

## Architecture

The feature is a client-local render change with three composition layers plus the T4 reduced-motion starfield amendment; none touches gameplay, engine, session, multiplayer, server, persistence or containers.

### 1. Model layer — `render/spaceship-model.ts` (new)

A pure three.js factory, `createHeroSpaceshipModel()`, owns the detailed hero craft and nothing else. It is DOM-free, deterministic, consumes no `random` source and has no scene/camera/engine dependency. It returns:

```ts
export interface HeroSpaceshipModel {
  readonly group: Group;          // name 'hero-ship-model'; scale 1.7, yaw 0.26, pitch -0.10
  readonly meshes: readonly Mesh[]; // length 48 (the named parts)
  readonly flames: readonly Mesh[]; // length 2, name 'hero-engine'
  readonly flameCores: readonly Mesh[]; // length 2, name 'hero-engine-core'
  readonly triangleCount: number; // <= 6,000
  dispose(): void;
}
export function createHeroSpaceshipModel(): HeroSpaceshipModel;
```

The factory builds all 48 named meshes as direct children of the `hero-ship-model` group, using exactly 11 shared materials (so draw state and disposal stay bounded). It computes `triangleCount` from the built geometries once and exposes the same value for tests. `dispose()` releases every unique geometry and every unique material exactly once, clears the group and is idempotent. The model is deliberately **not** wired to the cursor: its palette, scale and attitude are hero-specific; cursor reuse is future work under Q-2.

### 2. Backdrop layer — `render/cosmic-backdrop.ts` (edit)

`createCosmicBackdrop` keeps its existing `hero-ship` group, pinned `HERO_SHIP_POSITION = { x: 9, y: -2.5, z: -14 }`, outer `rotation.y = Math.PI / 2` and existing hero bob (`COSMIC_HERO_BOB_SPEED` / `COSMIC_HERO_BOB_AMPLITUDE`). It replaces the seven locally built hero meshes with one `createHeroSpaceshipModel()` instance added as the `hero-ship-model` child. The outer group and its local position/rotation are untouched, so the T16 camera-anchored screen composition is preserved: the model's extra scale and three-quarter attitude are local to the inner group.

The backdrop's `COSMIC_BACKDROP_OBJECT_COUNT` becomes `70` (1 cosmic group + 7 asteroids + 3 meteor groups + 6 meteor meshes + 1 comet group + 2 comet meshes + the 50-object hero subtree: 1 hero group + 1 model group + 48 hero meshes). The **non-hero** disposal set is **15 meshes** (7 asteroids + 6 meteor meshes + 2 comet meshes), not 22; the old `collectMeshes === 22` literal was the total including the 7 old hero meshes and becomes **63 total** (15 non-hero + 48 hero). The backdrop's non-hero `ownedMeshes` loop stays unchanged over those 15 meshes; `dispose()` calls `heroModel.dispose()` exactly once before clearing the group, so the 11 shared hero materials are not double-disposed by the backdrop loop. `HERO_HULL_COLOR` and `HERO_FLAME_COLOR` remain exported from `cosmic-backdrop.ts` (re-exported from `spaceship-model.ts`) for the existing tests and callers. T2 also removes the now-unused `BoxGeometry` import from `cosmic-backdrop.ts` (only the old hero hull/wings used it).

### 3. Scene layer — `render/scene.ts` (comment-only edit) and `render/scene.test.ts` (edit)

No executable scene change is needed: the `cosmic-backdrop` group is still one ninth child, the anchor formula and `COSMIC_ANCHOR_OFFSET_X = 6` / `COSMIC_ANCHOR_OFFSET_Y = 4` are unchanged, and the hero outer world position remains `[ownX + 15, ownY + 1.5, -14]` from every slot. `scene.ts` gets exactly one comment-only edit: its header text “one `cosmic-backdrop` group (28 objects)” becomes “(70 objects)”; AC-1/T3 guard that the diff contains only that comment change. The scene-test change is the exact count: `countObjects(scene)` baseline goes from `60` to `102 = 32 + COSMIC_BACKDROP_OBJECT_COUNT (70)`; the literal `60` and its comment are updated. `scene.children` stays 9 (10 with one remote world), and all existing camera-anchor, starfield, background-life and disposal assertions stay exact.

### 4. Reduced-motion starfield freeze — `render/starfield.ts` (edit, T4)

T3 discovered that the protected starfield swirl (`swirlAngle += max(0, dtMs) · DRIFT_RADIANS_PER_MS`) kept rotating under reduced motion, moving stars through the AC-17 crop while the hero itself was pixel-static. T4 makes the reduced-motion branch freeze the swirl: `update` still advances `pulseTimeMs` (retained by the existing tests) and still copies the snapped camera anchor and base opacity, but does **not** advance `swirlAngle` or change the swirl quaternion/star geometry when `reducedMotion === true`. The normal path (`reducedMotion` false/omitted) keeps the existing swirl rate, twinkle, expansion, anchor composition and 1200-star layout exactly. No new `random` draw, dependency, asset or scene wiring is added.

### Data flow / state ownership

Unchanged. The hero model is constants-only render data; the scene never reads the engine for it, it has no state beyond the existing bob phase, and it consumes no `random` draw. No new store, event, protocol message or persistence exists. The cursor keeps its own state and appearance path. The manual composition and performance evidence is derived from the running client only.

## Model hierarchy and part list

```
cosmic-backdrop (Group)
├── … asteroids / meteors / comet (unchanged)
└── hero-ship (Group; position (9, -2.5, -14); rotation.y = π/2; bobs on y)
    └── hero-ship-model (Group; scale 1.7; rotation.x = -0.10; rotation.y = 0.26; 48 mesh children)
```

All 48 meshes are direct children of `hero-ship-model`; no sub-groups are added (this keeps the object count and disposal contract simple). The part families:

| Family | Names (count) | Geometry | Material | Placement / role |
| --- | --- | --- | --- | --- |
| Fuselage | `hero-hull` (1) | low-poly `CylinderGeometry` (10 radial segments), flattened on y | Hull blue (PBR clearcoat) | Main body, length ≈ 2.6, centre z ≈ 0 |
| Mid/underside armor | `hero-hull-underside` (1) | stepped two-tier `ExtrudeGeometry` (fore/aft tiers) | Light panel | Layered mid/underside armor plate, offset ≥ 0.012 model-local units from the hull; strengthens the reference's “layered armor plates” read (F20) |
| Nose | `hero-nose` (1) | `ConeGeometry` (10 segments) | Mid gray | Pointed gray nose, base at z ≈ 1.3, tip z ≈ 2.1 |
| Dorsal spine | `hero-dorsal-spine` (1) | `BoxGeometry` | Hull blue | Raised spine from cockpit to tail, y ≈ 0.3 |
| Hull panel seams | `hero-hull-seam-1..3` (3) | thin `BoxGeometry` (≈ 0.03–0.05 thick) | Navy trim | Fore/mid/aft seam lines, offset ≥ 0.012 above hull |
| Tail fins | `hero-tail-fin-left/right` (2) | thin `BoxGeometry`, canted, height ≥ 0.5 | Navy trim | Rear fins, z ≤ -1.2, `position.y + height/2 >= 0.55` model-local |
| Tail-fin tips | `hero-tail-fin-tip-left/right` (2) | small `BoxGeometry` | Orange accent | Orange tips at the fin tops |
| Cockpit glass | `hero-cockpit` (1) | scaled `SphereGeometry` | Canopy teal | Front/top canopy, z ≥ 0.7, y ≥ 0.25 |
| Canopy bezel | `hero-cockpit-frame` (1) | `TorusGeometry` (6×12) | Mid gray | Ring around the canopy |
| Canopy highlight | `hero-cockpit-highlight` (1) | small thin `BoxGeometry` | Canopy highlight (basic) | Subtle bright reflection strip |
| Wings | `hero-wing-left/right` (2) | `ExtrudeGeometry` delta shape, depth ≈ 0.08 | Hull blue | Swept wings, root at x ≈ ±0.40, tip x ≈ ±1.65 (shape-x span 1.25, float margin over the 1.2 minimum) |
| Wing leading edges | `hero-wing-leading-left/right` (2) | thin `BoxGeometry` along the sweep | Mid gray | Gray leading-edge strips |
| Wingtips | `hero-wingtip-left/right` (2) | small `BoxGeometry` | Orange accent | Orange wingtip caps at x = ±1.65 |
| Wing seams | `hero-wing-seam-left/right-1..3` (6) | thin `BoxGeometry` (≈ 0.03–0.05 thick) | Navy trim | Three panel lines per wing top |
| Engine pylons | `hero-engine-pylon-left/right` (2) | small `BoxGeometry` | Navy trim | Connect nacelles to the hull |
| Engine housings | `hero-engine-housing-left/right` (2) | `CylinderGeometry` (12 radial segments), length ≈ 1.2 | Engine housing blue-gray | Nacelles at x = ±1.1, y = -0.05, z = -1.0 |
| Engine ribs | `hero-engine-rib-left/right-1..2` (4) | `TorusGeometry` (6×12) | Mid gray | Two rib rings per nacelle |
| Engine nozzles | `hero-engine-nozzle-left/right` (2) | `CylinderGeometry`/cone, dark | Engine nozzle | Rear nozzle at z ≈ -1.65 |
| Outer flames | `hero-engine` (2) | `ConeGeometry` (10 segments), length ≈ 0.6 | Flame orange, additive/transparent | Exhaust at z ≤ -2.0 |
| Flame cores | `hero-engine-core` (2) | smaller `ConeGeometry` | White-hot core | Inside/behind the outer flame at z ≤ -2.1 |
| Hull stripes | `hero-hull-stripe-left/right` (2) | thin `BoxGeometry` | Orange accent | Upper-side warning/accent stripes |
| Vents | `hero-vent-left/right` (2) | small `BoxGeometry` | Navy trim | Side vents, offset ≥ 0.012 |
| Antennae | `hero-antenna-fore/aft` (2) | thin `CylinderGeometry` (6 segments) | Mid gray | Small dorsal antennae |
| Greebles | `hero-greeble-1/2` (2) | small `BoxGeometry` | Navy trim | Rivet/greeble clusters |

**Implementation notes for the builder:**
- Build the model in the order hull → underside → nose → spine → cockpit → wings → fins → engines → seams → greebles → flames, so the silhouette is stable before detail is attached.
- Use `Shape` + `ExtrudeGeometry` for the wings (no custom shader); rotate the extrusion to lie horizontal and mirror the right wing.
- Use `TorusGeometry` for the bezel and ribs; rotate the torus by `Math.PI / 2` so it rings the local z axis.
- Point the nose/flames along local +z / −z: rotate `ConeGeometry` by `±Math.PI / 2` on x and keep the model's forward axis +z. The inner group's yaw/pitch then gives the three-quarter rear/side attitude while the outer group's `rotation.y = Math.PI / 2` makes the nose face world +x.
- Keep every detail mesh offset ≥ `HERO_DETAIL_OFFSET = 0.012` **model-local units** from its base surface; the 1.7 group scale turns that into ≥ 0.0204 world units. Detail thinness is tested on the model-local geometry bounding box (`<= 0.06` local), not world units. The coplanarity claim is verified by the manual AC-16 z-fighting matrix; a unit test only asserts observable local thinness/materials. Do not use `polygonOffset` or transparent coplanar overlays.
- Flames are static geometry (no per-frame scale/opacity animation): the only animation is the existing `heroShip.position.y` bob, which freezes under reduced motion.

## Materials and lighting

The model uses the accepted `MeshPhysicalMaterial` pipeline and existing scene lights; no new light, post-processing pass, environment map, texture or shader is added. The shared palette (exactly 11 material instances):

| # | Material | Used by | Values |
| --- | --- | --- | --- |
| 1 | Hull blue | hull, dorsal spine, `hero-wing-left/right` | `color 0x2f6fd6`, `metalness 0.45`, `roughness 0.35`, `clearcoat 0.6`, `clearcoatRoughness 0.2` |
| 2 | Light panel | underside | `0xd9dee7`, `0.25`, `0.45`, `0.4`, `0.25` |
| 3 | Mid gray | nose, leading edges, bezel, antennae, ribs | `0x8f9bad`, `0.4`, `0.4`, `clearcoat 0.3` |
| 4 | Navy trim | seams, fins, vents, greebles, pylons | `0x14213d`, `metalness 0.5`, `roughness 0.4` |
| 5 | Orange accent | wingtips, fin tips, hull stripes | `0xff7a1a`, `emissive 0xff7a1a`, `emissiveIntensity 0.4`, `metalness 0.3`, `roughness 0.4` |
| 6 | Canopy glass | cockpit | `0x0b2f38`, `metalness 0.2`, `roughness 0.08`, `clearcoat 1`, `clearcoatRoughness 0.08`, `emissive 0x0a3a44`, `emissiveIntensity 0.35` |
| 7 | Canopy highlight | cockpit highlight | `MeshBasicMaterial` `0xcffcff`, transparent `opacity 0.9` |
| 8 | Flame outer | two `hero-engine` | `MeshBasicMaterial` `0xff9a3c`, transparent `opacity 0.85`, `AdditiveBlending`, `depthWrite false` |
| 9 | Flame core | two `hero-engine-core` | `MeshBasicMaterial` `0xfff3d6` |
| 10 | Engine housing | two nacelles | `0x35507a`, `metalness 0.45`, `roughness 0.4`, `clearcoat 0.4` |
| 11 | Engine nozzle | two nozzles | `0x1a2333`, `metalness 0.6`, `roughness 0.45` |

No mesh casts or receives shadows (`castShadow = false`, `receiveShadow = false`), matching the accepted decorative backdrop. The orange accents are emissive PBR surfaces and the exhaust uses additive basic materials, so the existing ACES tone mapping and UnrealBloomPass (strength 0.45, radius 0.4, threshold 0.85) make the engines read strongly without a new light or bloom pass. Rim lighting is approximated by the bright orange edge stripes and clearcoat highlights; a custom rim shader is out of scope (Q-1/Non-goals).

## Geometry and performance budget

| Metric | Budget / expected value |
| --- | --- |
| Hero meshes | `HERO_SHIP_MESH_COUNT = 48` |
| Hero shared materials | `HERO_MATERIAL_COUNT = 11` |
| Hero triangles | `<= HERO_SHIP_MAX_TRIANGLES = 6,000` (expected ≈ 2,500–3,500 from the pinned primitives) |
| Hero model subtree objects | `HERO_SHIP_MODEL_OBJECT_COUNT = 49` (1 `hero-ship-model` + 48 meshes) |
| Hero subtree objects | `HERO_SHIP_SUBTREE_OBJECT_COUNT = 50` (1 `hero-ship` + 49 model objects) |
| `cosmic-backdrop` meshes | 63 (15 non-hero + 48 hero) |
| `cosmic-backdrop` objects | `COSMIC_BACKDROP_OBJECT_COUNT = 70` (63 decorative meshes + 7 groups) |
| `cosmic-backdrop` direct children | 12 (unchanged) |
| Scene baseline objects | 102 (`32 + 70`) |
| Scene children | 9 without a remote world, 10 with one remote world (unchanged) |
| Draw calls added vs. accepted hero | +41 meshes (48 vs. 7); the hero uses 11 shared materials instead of 7 per-mesh materials, so the backdrop gains 41 mesh draw calls and a small bounded material set |
| Bundle | initial JS gzip ≤ 350 KB (accepted `BUNDLE_BUDGET_GZ_KB`); current accepted build is 247.22 KB, so ≈ 102 KB headroom and no new dependency |
| Frame time | average ≤ 16.7 ms, p95 ≤ 33 ms at 1280×720 and 1920×1080, three clean runs, B-3 protocol |

The extra 41 draw calls are one small opaque/transparent batch each; the model stays at camera-relative depth 26 and covers a small screen area. The geometry budget is far below the cube's instanced tile geometry and the existing SSAO/bloom cost, so no quality tier or LOD is introduced in v1 (Q-6).

## Integration points

| File | Change |
| --- | --- |
| `src/frontend/src/render/spaceship-model.ts` | New factory, palette/count/dimension constants, 48 named meshes, shared materials, `triangleCount`, `dispose()`. |
| `src/frontend/src/render/cosmic-backdrop.ts` | Import `createHeroSpaceshipModel`; remove the seven local hero meshes, their local colour constants **and the now-unused `BoxGeometry` import**; add the model group to `hero-ship`; set `COSMIC_BACKDROP_OBJECT_COUNT = 70`; call `heroModel.dispose()` once; re-export `HERO_HULL_COLOR`/`HERO_FLAME_COLOR`; keep position, rotation, bob, reduced-motion freeze and the 15-mesh non-hero disposal semantics. |
| `src/frontend/src/render/cosmic-backdrop.test.ts` | Update imports/counts; assert the model group/48 meshes; `collectMeshes` 22 → 63 total (15 non-hero + 48 hero); unique-set disposal over 63 meshes/11 shared hero materials; keep asteroid/meteor/comet motion and reduced-motion assertions. |
| `src/frontend/src/render/scene.ts` | **Comment-only edit**: header `cosmic-backdrop` count `28 objects` → `70 objects`; no executable change (AC-1/T3 diff guard). |
| `src/frontend/src/render/scene.test.ts` | Update the baseline literal `60` → `102` and its comment; keep every child-count, anchor, hero-world-position, starfield, background-life, update-forwarding and disposal assertion exact. |
| `src/frontend/src/render/starfield.ts` | T4: freeze `swirlAngle` under `reducedMotion === true`; keep `pulseTimeMs`, snapped anchor, base opacity, normal swirl/twinkle/expansion and 1200-star layout unchanged. |
| `src/frontend/src/render/starfield.test.ts` | T4: pin frozen swirl/points quaternion under reduced motion; keep normal swirl rate, twinkle, expansion, anchor and star layout/count assertions exact. |
| `src/frontend/src/render/spaceship.ts` and its tests | **Unchanged** (cursor out of scope). |
| `README.md` | Documentation pass: update the procedural-visual sentence to contain the exact phrase `detailed blue/orange hero spaceship`; still no external image assets. |
| `docs/features/README.md` | **Not edited**; the final build log records the proposed row diff for the orchestrator. |
| `docs/features/detailed-hero-spaceship/evidence/*.png` | New screenshots and reduced-motion A/B files. |

Explicitly not touched (except the one `scene.ts` comment line and the T4 reduced-motion starfield branch): `src/frontend/src/game/**`, `src/frontend/src/multiplayer/**`, `src/frontend/src/render/{spaceship.ts,world.ts,picking.ts,particles.ts,background-life.ts,nebula.ts,cube-view.ts,postprocessing.ts,webgl.ts,spectate-travel.ts}`, `src/frontend/src/ui/**`, `src/frontend/src/App.tsx`, `src/frontend/src/main.tsx`, `src/backend/**`, `compose*.yaml`, Dockerfiles, `package.json`, lockfiles, configs.

## Interfaces / contracts

```ts
// render/spaceship-model.ts
export const HERO_SHIP_SCALE = 1.7;
export const HERO_SHIP_YAW = 0.26;
export const HERO_SHIP_PITCH = 0.1;
export const HERO_SHIP_MESH_COUNT = 48;
export const HERO_SHIP_MODEL_OBJECT_COUNT = 49; // model group + 48 meshes
export const HERO_SHIP_SUBTREE_OBJECT_COUNT = 50; // outer hero group + model subtree
export const HERO_SHIP_MAX_TRIANGLES = 6000;
export const HERO_SHIP_LENGTH = 4.6;
export const HERO_SHIP_WIDTH = 3.3;
export const HERO_SHIP_HEIGHT = 1.0;
export const HERO_MATERIAL_COUNT = 11;
export const HERO_DETAIL_OFFSET = 0.012; // model-local units, before the 1.7 scale
export const HERO_WING_ROOT_X = 0.4;
export const HERO_WINGTIP_X = 1.65;
export const HERO_WING_SHAPE_SPAN = 1.25; // >= 1.2 with float margin

export const HERO_HULL_COLOR = 0x2f6fd6;
export const HERO_PANEL_LIGHT = 0xd9dee7;
export const HERO_PANEL_MID = 0x8f9bad;
export const HERO_TRIM_NAVY = 0x14213d;
export const HERO_ACCENT_ORANGE = 0xff7a1a;

export const HERO_CANOPY_COLOR = 0x0b2f38;
export const HERO_CANOPY_HIGHLIGHT = 0xcffcff;
export const HERO_FLAME_COLOR = 0xff9a3c;
export const HERO_FLAME_CORE_COLOR = 0xfff3d6;
export const HERO_ENGINE_HOUSING_COLOR = 0x35507a;
export const HERO_ENGINE_NOZZLE_COLOR = 0x1a2333;

export interface HeroSpaceshipModel {
  readonly group: Group;               // name 'hero-ship-model'
  readonly meshes: readonly Mesh[];    // length 48
  readonly flames: readonly Mesh[];    // length 2, name 'hero-engine'
  readonly flameCores: readonly Mesh[]; // length 2, name 'hero-engine-core'
  readonly triangleCount: number;      // <= HERO_SHIP_MAX_TRIANGLES
  dispose(): void;
}
export function createHeroSpaceshipModel(): HeroSpaceshipModel;

// render/cosmic-backdrop.ts (changed exports)
export const COSMIC_BACKDROP_OBJECT_COUNT = 70;
export { HERO_FLAME_COLOR, HERO_HULL_COLOR } from './spaceship-model';
// HERO_SHIP_POSITION, COSMIC_HERO_BOB_SPEED, COSMIC_HERO_BOB_AMPLITUDE unchanged
```

**Scene count contract:** `COSMIC_BACKDROP_OBJECT_COUNT = 70`; `countObjects(backdrop.group) === 70`; `collectMeshes(backdrop.group) === 63` (15 non-hero + 48 hero); `backdrop.group.children.length === 12`; `heroShip.children.length === 1` (the model group); `HERO_SHIP_MODEL_OBJECT_COUNT === 49`; `HERO_SHIP_SUBTREE_OBJECT_COUNT === 50`; `countObjects(scene) === 102`; `scene.children.length === 9` (10 with a remote world). The hero outer world position stays `[ownX + 15, ownY + 1.5, -14]`; the anchor offsets stay `6`/`4`; the model's local yaw/pitch/scale do not move the outer group. `scene.ts` changes only its header comment `28 objects` → `70 objects`.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/render/spaceship-model.ts` | New | Detailed procedural hero model, palette, counts, shared materials, disposal |
| `src/frontend/src/render/spaceship-model.test.ts` | New | Unit contract: parts, palette, dimensions, budget, disposal |
| `src/frontend/src/render/cosmic-backdrop.ts` | Edit | Mount the model in `hero-ship`, update count/disposal, re-export palette |
| `src/frontend/src/render/cosmic-backdrop.test.ts` | Edit | 70-object/63-mesh integration (15 non-hero + 48 hero), motion/reduced-motion/disposal |
| `src/frontend/src/render/scene.ts` | Edit (comment only) | Header `cosmic-backdrop` count 28 → 70; no executable change |
| `src/frontend/src/render/scene.test.ts` | Edit | Baseline 60 → 102 and comment; hero world-position/anchor assertions retained |
| `src/frontend/src/render/starfield.ts` | Edit (T4) | Freeze swirl under reduced motion; normal path unchanged |
| `src/frontend/src/render/starfield.test.ts` | Edit (T4) | Frozen-swirl test + retained normal-path assertions |
| `README.md` | Edit (docs pass) | Accurate sentence containing `detailed blue/orange hero spaceship`, no external assets |
| `docs/features/detailed-hero-spaceship/build-log-T1.md` | New | T1 build log |
| `docs/features/detailed-hero-spaceship/build-log-T2.md` | New | T2 build log |
| `docs/features/detailed-hero-spaceship/build-log-T3.md` | New | Final verification/build log |
| `docs/features/detailed-hero-spaceship/build-log-T4.md` | New | T4 build log |
| `docs/features/detailed-hero-spaceship/evidence/*.png` | New | Wide-size screenshots, reduced-motion A/B |
| `docs/features/README.md` | Propose only | Orchestrator applies the row diff recorded in the final build log |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | New testable `render/spaceship-model.ts` factory instead of growing `cosmic-backdrop.ts` | The model needs 48 named parts, 11 shared materials, its own geometry budget and a disposal seam; a separate pure module is node-testable without a scene, keeps `cosmic-backdrop.ts` focused on backdrop composition, and leaves the door open for future cursor reuse (Q-2) | Inline in `cosmic-backdrop.ts` (large, hard to test, mixes concerns); reuse the cursor module (would destabilize cursor scale/appearance/ignitions) |
| 2 | Fully procedural three.js, no GLTF/asset pipeline | No new dependency, loader, licensing review, asset file or bundle weight; the reference is stylized and can be approximated with layered primitives, extruded wings and panel detail; the project has no model pipeline | GLTF/OBJ asset (closer to a painted reference, but new asset/dependency/pipeline and a much larger change; Q-1) |
| 3 | Scale the inner model `1.7×` and add a local 0.26 rad yaw / 0.10 rad pitch | Makes the detail readable at 1280 (≈ 230 px long) while keeping the outer group position/rotation, so the accepted T16 camera-anchored composition and scene assertions stay valid | Enlarge `hero-ship` outer group (would move/scale the world anchor expectations); keep the current size (detail sub-pixel at 1280) |
| 4 | Keep the outer `hero-ship` group at `(9, -2.5, -14)` / `rotation.y = π/2` | Preserves the accepted camera-anchor contract, scene world-position tests, right-side/behind-cube composition and upgrades-panel clearance | Re-pin position/rotation (re-opens T16 and scene tests); move the camera (`reference-image-game-view` Q-8; out of scope) |
| 5 | 11 shared materials with unique-set disposal | Keeps material state bounded, makes the palette testable, and avoids disposing the same material once per mesh; a Set-based `dispose()` is simple and idempotent | One material per mesh (11→48 material instances, double-dispose bug risk); global material singleton (harder to reason about) |
| 6 | 48 meshes / ≤ 6,000 triangles, no LOD in v1 | Small bounded addition to the accepted 60-object scene; the hero is a single backdrop asset and the frame-time check is the gate | Merge detail geometries via `BufferGeometryUtils` (fewer draw calls, more build complexity); LOD/quality tier (Q-6) |
| 7 | No new animation; only the existing y-bob | Engine flames are static geometry; reduced motion already freezes the bob; no flicker/glow pulse to gate | Flame flicker/pulse (would need reduced-motion handling and new tests); no animation at all (loses the accepted bob) |
| 8 | Cursor untouched; model not wired to `spaceship.ts` | The user's reference is the right-side hero ship; the cursor has accepted scale/follow/ignition/appearance behavior and its own tests; mixing scopes risks regressions | Refactor cursor to reuse the model (Q-2; separate feature) |
| 9 | Manual screenshots/frame-time, no browser automation | Matches every accepted visual feature in the project; composition/detail/perf is inherently visual; no new test tooling | Playwright/perceptual snapshots (new dependency/scope; predecessor non-goal) |
| 10 | Update the single scene baseline literal, the backdrop constant and the stale `scene.ts` header comment (comment-only) | The production scene already handles a group child; only counts and one comment change, keeping the camera/picking/anchor code byte-identical while making the source description accurate (F13) | Leave the stale comment (fails documentation accuracy); add a scene-level `heroShip` field or anchor logic (unnecessary, larger diff) |
| 11 | T4 freezes the starfield swirl under reduced motion via a guarded `swirlAngle` advance, not by disabling the whole `update` | T3 measured 4.48%/8.47% crop contamination from moving stars while the hero was static; freezing only the swirl satisfies AC-17 while retaining camera anchoring, base opacity, `pulseTimeMs` semantics, twinkle/expansion and normal-motion swirl | Skip the whole `update` (breaks camera anchoring and pulse semantics); leave the starfield and relax AC-17 (rejected: reduced motion must freeze all decorative motion) |

## Risks & mitigations

- **Reference fidelity is subjective / planner cannot see the image** → pin palette, dimensions, part counts and material values; record the AC-16 matrix; keep Q-1/Q-4 open for approval-time correction.
- **“Layered armor plates” reads flat** (F20) → the mid/underside is a stepped two-tier `ExtrudeGeometry` plate, with the dorsal spine and three hull seams as additional layers; AC-16 explicitly checks the layered read, and Q-1 lets the user reject/refine it at approval.
- **The ship is too small to read detail at 1280 or too large and hits the upgrades panel** → scale 1.7 and the 160–280 px / 320–560 px manual pixel checks; the ship's projected bottom clears the panel top with the existing bob; if a screenshot fails, reduce the scale or pitch (Q-3/Q-4) and re-run the matrix.
- **Detail z-fighting on coplanar seams/greebles** → every detail mesh is offset by ≥ 0.012 **model-local** units (0.0204 world after the 1.7 scale) and has real thickness; thinness is tested on the local geometry box (`<= 0.06` local); the manual matrix records a z-fighting pass/fail; no transparent coplanar overlays.
- **Detail-unit predicate drift** → all thinness/offset assertions use model-local geometry/positions before the 1.7 scale; never mix world and local thresholds (F2/F10). Test helpers must state “model-local” explicitly.
- **Starfield reduced-motion regression** → T4 changes only the `reducedMotion === true` swirl branch; `pulseTimeMs`, camera anchoring, base opacity, normal swirl rate, twinkle, expansion and 1200-star layout are explicitly retained by tests. The T3 rerun must show a clean AC-17 crop and no normal-motion visual change; the separate `starfield.ts`/`starfield.test.ts` diff guard confirms the change is confined to the branch.
- **Performance/draw-call regression and thin 1920 idle headroom** → 48 meshes, 11 materials, ≤ 6,000 triangles, one small screen area; AC-14's three-run traces; the accepted 1920×1080 idle median was 16.694 ms against the 16.7 ms bar (≈0.006 ms headroom), so watch that measurement first; if the median misses, the task blocks and Q-6 schedules a merged-detail or quality-tier follow-up.
- **Disposal-set arithmetic regressions** → the non-hero loop is **15 meshes** (7 asteroids + 6 meteor + 2 comet), the hero is 48 meshes with 11 shared materials, and `collectMeshes` is **63 total**. The old `22` was the total including the 7 old hero meshes and must never be used as a non-hero count (F1).
- **Shared-material double disposal** → `spaceship-model.dispose()` uses unique geometry/material Sets and is idempotent; `cosmic-backdrop.dispose()` calls it exactly once and keeps its own **15-mesh** non-hero loop separate; tests spy on unique materials/geometries and assert one call each.
- **Scene count churn / stale comment** → `COSMIC_BACKDROP_OBJECT_COUNT` (28 → 70), the single `scene.test.ts` literal `60` → `102`, and the one `scene.ts` header comment `28 objects` → `70 objects` are the only count-related changes; `scene.children` stays 9/10 and the hero outer world position stays exact; T2 owns `scene.ts` (comment-only), `scene.test.ts` and `cosmic-backdrop.*` and runs the full frontend suite.
- **Bundle growth** → no new dependency/assets; the model is code only; AC-15's gzip check against the 350 KB budget (current 247.22 KB) and the import scan.
- **Cursor regression** → AC-1's diff gate keeps `render/spaceship.ts`, its tests and `scene-spaceship.test.ts` byte-identical; the new factory is not imported by the cursor.
- **Hero too dark under PBR without an environment map** → the palette uses lighter blue/gray surfaces, clearcoat highlights, emissive orange accents and additive flames; the manual matrix checks the palette reads; material tuning stays inside the pinned constants.
- **Bloom washes out the flames or the white core** → flames use additive transparent materials and a modest core size; the manual matrix compares the engine glow to the accepted comet/star glow; tuning is a constant edit with a spec note.
- **Dimension unit test brittleness** → AC-5 uses ranges (3.2–3.4, 0.9–1.1, 4.2–4.8) rather than an exact float; the builder may tune the primitive extents within the ranges.
- **Manual evidence reproducibility** → record the environment, the slot positions, the fresh page-load protocol, the screenshot paths and the exact pixel measurements; use the B-3 three-run performance protocol.

## Build-discovered amendment (T3)

T3's AC-17 proof failed while the hero was pixel-static: the protected starfield kept `swirlAngle += max(0, dtMs) · DRIFT_RADIANS_PER_MS` under reduced motion, so stars moved through the 8 px union crop. Measured contamination was **4.4765%** at 1280×720 (838/18,720 px, max channel diff 213) and **8.4660%** at 2560×1280 (4,508/53,248 px, max 208), against the `<= 1%` bar; the hero boxes were identical in both clean pairs. This is a reduced-motion accessibility defect, not a hero-model defect.

**T4 approach.** In `starfield.update`, advance `pulseTimeMs` as today, but gate the swirl advance on `reducedMotion !== true`; keep copying the snapped anchor, composing the (unchanged) swirl quaternion, applying travel scale and setting the base opacity. The normal path (`reducedMotion` false/omitted) keeps the existing `max(0, dtMs) · 1/65536` swirl exactly. No new `random` draw, dependency, asset or scene wiring is added. `starfield.test.ts` pins the frozen swirl/quaternion under reduced motion and retains the normal swirl, twinkle, expansion, anchor and 1200-star layout/count assertions.

**AC note.** AC-17's crop method is unchanged; it now explicitly requires all decorative motion (hero, cosmic backdrop, starfield swirl) to be frozen. AC-1's protected set excludes `starfield.ts`/`starfield.test.ts` from byte-identical and adds a separate diff guard limiting the change to the reduced-motion branch. No other AC or product scope changes.

## Rollback / no-regression strategy

- **No data or protocol migration**: nothing to roll back server-side or in persistence; every change is source/test/docs.
- **Task-isolated reverts**: reverting T2's `cosmic-backdrop.ts` edit (and its test/scene-count literals plus the `scene.ts` comment) restores the accepted seven-mesh hero instantly; T1 is then an unused new file that can be deleted. T4 reverts to the prior unconditional swirl advance (the previous reduced-motion twinkle freeze stays), restoring the T3-measured behavior without touching the hero model. No camera, engine, session, protocol or container change is involved.
- **Feature branch**: work on `feat/detailed-hero-spaceship`; no merge until accepted; `BASE` recorded for the AC-1/AC-15 diff gates.
- **Test-first guards**: the cursor, scene camera/anchor, engine/session/multiplayer, world/picking, starfield/background-life/nebula/particles tests stay unchanged and green; the only changed test expectations are the exact hero/model counts and the palette/position literals owned by T1/T2.
- **Manual rollback check**: the pre-feature screenshot set remains reproducible; after each task, compare the hero composition and the cube/panel clearance so a regression can be attributed to one task.

## Verification strategy

- **Per task (T1/T2/T4)**: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (workspace pre-gate). T1 owns the model test; T2 owns the backdrop/scene test updates; T4 owns the starfield reduced-motion test and normal-path retention.
- **Final gate (T3)**: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% all four metrics both workspaces), `npm run build`, optional `npm run smoke` where the container environment allows. Run T3 only after T4.
- **Diff gates (T3)**: record `BASE` (`BASE=$(git merge-base main HEAD)` or the pre-feature fork point), then run and paste both `git diff --exit-code "$BASE"...HEAD -- <protected paths>` and `test -z "$(git status --porcelain -- <protected paths>)"` for the expanded AC-1 protected set (including `main.tsx`, `cube-view.ts`/test, `postprocessing.ts`/test, `webgl.ts`/test, `spectate-travel.ts`/test, and the `picking`/`particles`/`background-life`/`nebula` tests; `starfield.ts`/test are excluded from this byte-identical set). Paste the full `git status --porcelain` showing only the allowed feature paths; paste the `scene.ts` diff proving the only change is the header comment `28 objects` → `70 objects`; paste the `starfield.ts`/`starfield.test.ts` diff proving only the reduced-motion branch/tests changed.
- **Bundle/import gate (T3)**: `npm run build` output with the initial JS gzip total compared to 350 KB; `grep` for `GLTFLoader|FileLoader|TextureLoader|fetch\(|http://|https://` in `spaceship-model.ts`/`cosmic-backdrop.ts` → no matches; named-import check.
- **Manual visual matrix (T3)**: with `podman compose up` (or `npm run dev`), record the AC-16 table and screenshots at 1280×720, 1920×1080, 2560×1280 and 2560×1080 from slot 1, slot 2 and the 10-user ring where possible; measure the ship's full bounding box (160–280 px at 1280, 320–560 px at 2560×1280, 300–450 px at 2560×1080), cube/panel clearance, palette/detail visibility and the layered-armor read; record z-fighting pass/fail.
- **Reduced-motion proof (T3, rerun after T4)**: emulate `prefers-reduced-motion: reduce`, capture A/B 1.5 s apart, assert the hero bounding box is pixel-identical and the union crop expanded by 8 px has `<= 1%` of pixels with a per-channel difference `> 8/255`; separately verify the hero, cosmic backdrop and starfield swirl are all frozen (T4's `starfield.test.ts` pins the frozen swirl; the A/B crop is the end-to-end proof). Keep the existing unit freeze tests green.
- **Performance proof (T3)**: AC-14's three-run idle/10 clicks-per-second traces at 1280×720 and 1920×1080; report every run's average/p95 plus median/worst; a host-hitch caveat only with corroborating evidence and a compliant median; otherwise block.
- **Documentation pass (T3)**: `grep -n "detailed blue/orange hero spaceship" README.md`, confirm no `docs/architecture/**`/`docs/product/**` diff, record the proposed `docs/features/README.md` row diff in the final build log for the orchestrator.

## Documentation impact

- **Root `README.md`** — one accurate sentence updated to contain the exact phrase `detailed blue/orange hero spaceship` (layered hull, swept wings, twin glowing engines) and still state that no external image assets are used.
- **`docs/features/README.md`** — orchestrator-owned; the builder does not edit it, but the final build log records the proposed row (`detailed-hero-spaceship`, title, state, date) for the orchestrator to apply.
- **`docs/architecture/**`** — no change: stack, container conventions, commands, ports and WebSocket endpoint are untouched.
- **`docs/product/**`** — no change: no term, vision or backlog item changes.
- **Predecessor feature artifacts** — never edited; superseded criteria are listed in `spec.md` only.

## Open questions

See `spec.md` § Open questions (Q-1…Q-7). Planning defaults: procedural model only; hero ship only (cursor out of scope); scale 1.7; pinned cobalt/gray/navy/orange/teal palette; 0.26 rad yaw / 0.10 rad pitch; cylindrical nacelles; one fixed quality (no LOD); no cross-client visibility. Q-8 (cursor factory reuse) is a non-blocking future note in `spec.md` § Assumptions, not an approval decision.

## Revision history

- r1 — 2026-11-07 — initial plan (planning phase).
- r2 — 2026-11-07 — spec review r1 alignment (F1–F20): non-hero disposal 15/63 total; model-local detail units; 1.25 wing span; 10-segment fuselage; hull-blue wing usage; exact README phrase; pinned reduced-motion method; manual coplanarity check; pinned cockpit/fin/engine predicates; comment-only `scene.ts` edit; `BoxGeometry` import removal; build-log ownership; model/subtree object constants; 2560×1080 range; 1920 idle-headroom risk; Q-8 moved to Assumptions; stepped two-tier underplate. Counts remain 48 hero meshes / 49 model objects / 50 hero subtree / 63 backdrop meshes / 70 backdrop objects / 102 scene objects.
- r3 — 2026-11-08 — T3 build-discovered amendment (B-T3-1): starfield swirl now freezes under reduced motion via T4; AC-17 explicitly covers all decorative motion sources; AC-1 excludes `starfield.ts`/test from byte-identical with a separate diff guard. Added T4 to the build plan before T3. No other AC or product scope changed.
