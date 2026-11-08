# Build log — T8 — Cursor model factory (additive)

Task: T8 (2026-11-08)
Files changed: `src/frontend/src/render/cursor-ship.ts`, `src/frontend/src/render/cursor-ship.test.ts`, `docs/features/spaceship-cursor-loot-animations/build-log-T8.md`

Sketch:
- Build a parameter-free procedural factory: root `cursor-ship-model` + 10 `slot-*` groups + 21 named meshes.
- One shared structural finish (AC-4: 0.55/0.38/0.4/0.2) for every structural mesh; canopy, highlight and two ignitions are the only special materials (19 total).
- Map `appearanceToCursorShipParams` `PartVisual`s onto per-slot materials and per-slot shape transforms (rarity recolours/reshapes only).
- Tests pin counts, names, slot mapping, geometry/dimensions, material values, appearance/idempotence, no lights/textures/random and dispose-once.

What changed & why:
- Added `render/cursor-ship.ts`: `createCursorShipModel()` with the AC-1 return contract (`group`,
  `slots`, `slotGroups`, `meshes`, `ignitions`, `triangleCount`, `materialCount`,
  `applySlotVisual`, `applyAppearance`, `dispose`). The model subtree is exactly 32 objects
  (`cursor-ship-model` + 10 slot groups + 21 meshes); the 21 meshes resolve to exactly 19 material
  instances (two seam strips share one, two vents share one). `triangleCount` is 776 (≤ 2,500).
- Added `render/cursor-ship.test.ts` (34 tests) covering the whole contract with concrete values.
- No consumer is wired in T8 (T9 owns `spaceship.ts`/`scene.ts` integration); the full frontend
  workspace stays green.

Decisions:
- `slots` is a `Record<SlotId, Group>` for O(1) T9 slot lookup, plus `slotGroups` in `SLOT_CATALOG`
  order for iteration; both point at the same ten groups.
- 19 materials = 15 structural instances + canopy + basic highlight + 2 ignition flames; the two
  hull seams share one material and the two side vents share one (21 meshes → 19 materials).
  Rarity never swaps a material instance, it only writes `color`/`accent` onto the existing one.
- Per-slot shape transforms are pinned in `CURSOR_SLOT_SHAPE_TRANSFORMS` (scale/rotation only);
  every `standard` shape is identity so the default model is the AC-3 rest pose. The spec/plan
  name the shape axis and keys but not numeric transforms, so the exact scale/rotation table is
  implementation-pinned here and asserted literally by the test.
- `applySlotVisual` stores a per-slot visual signature and returns `boolean`; applying the same
  visual twice writes nothing (T9 can use this for AC-7 idempotence and the equip pulse).
- The model group itself is identity (the outer `spaceship` group owns scale 1.2 / position / bank
  / pitch, T9); ignitions start hidden at rest.
- No integration test tier: the module has no consumer yet (T9 wires it into `spaceship.ts` and
  owns `spaceship.test.ts`/`scene-spaceship.test.ts`). The tests exercise real three.js objects
  (Groups, Meshes, materials, `Box3`) rather than mocks. Documented exception per the
  web-implementation testing bar, same as T7.
- No documentation edits beyond this log: the module is internal and T13 owns the feature
  documentation pass; task constraints forbid other docs.

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
- `npm test --workspace @cubeclicker/frontend` → exit 0:
  ```
   ✓ src/render/cursor-ship.test.ts (34 tests) 149ms
   Test Files  58 passed (58)
        Tests  1475 passed (1475)
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80/80/80/80 met):
  ```
   Test Files  58 passed (58)
        Tests  1475 passed (1475)
  All files          |   96.29 |    95.66 |   96.87 |   96.29 |
    cursor-ship.ts   |   99.54 |    97.56 |     100 |   99.54 | 208-209
  ```
  The only uncovered lines are the defensive non-indexed-geometry fallback in the private
  `countGeometryTriangles` helper; every geometry the factory builds is indexed (all three.js
  primitives used are indexed), so the fallback is unreachable from the factory's public surface.
  Aggregate coverage stays well above the 80 gate.
- Assertion quality: concrete values only (exact names/counts/hex colours/positions/scale/
  rotation/geometry parameters/triangle and material counts). No wildcard matchers, no snapshots,
  no assertion-free tests; the bounded float exception was not used (`0` `closeTo` calls).

Acceptance audit:
- AC-1 → met. `createCursorShipModel()` takes no parameters (`toHaveLength(0)`), returns the
  pinned handle, builds `cursor-ship-model` with exactly the 10 named slot groups in
  `SLOT_CATALOG` order, 21 meshes, 2 `ignition` meshes in the ignition slot groups, 19 materials,
  776 triangles (> 0, ≤ 2,500), every mesh `castShadow === false`/`receiveShadow === false`, and
  no Light/Points/Sprite/Texture/loader/DOM/`Math.random` construction (graph traversal + source
  scan; all geometry parameters are literals, so the build is deterministic). `dispose()` releases
  each of the 21 unique geometries and 19 materials exactly once, empties the root and every slot
  group, detaches from a parent, and a second call changes nothing. Evidence:
  `cursor-ship.test.ts` (34 tests, 99.54% statements / 97.56% branches / 100% functions).
- AC-2 → met. The 21 meshes are exactly the pinned 20-name map (`ignition` ×2): `cursor-hull`,
  `cursor-hull-underside`, `cursor-nose`, `cursor-cockpit`, `cursor-cockpit-frame`,
  `cursor-cockpit-highlight`, `cursor-wing-left`, `cursor-wing-left-tip`, `cursor-wing-right`,
  `cursor-wing-right-tip`, `cursor-engine-left`, `cursor-engine-left-nozzle`,
  `cursor-engine-right`, `cursor-engine-right-nozzle`, `ignition` ×2, `cursor-tail-fin`,
  `cursor-hull-seam-1`, `cursor-hull-seam-2`, `cursor-vent-left`, `cursor-vent-right`; every
  entry is a `Mesh` inside its pinned slot group and no other mesh names exist. Evidence:
  `cursor-ship.test.ts` § model contract.
- AC-3 → met. Exports `CURSOR_SHIP_LENGTH === 1.4`, `CURSOR_SHIP_WIDTH === 0.9`,
  `CURSOR_SHIP_HEIGHT === 0.4`; with the group at identity, `Box3.setFromObject(group)` sizes are
  inside z ∈ [1.3, 1.5], x ∈ [0.8, 1.0], y ∈ [0.3, 0.5]; the nose tip is at z 0.7 (≥ 0.65), both
  flame tips at z −0.7 (≤ −0.6), nose points +z and exhausts −z; all ten slot groups start at the
  identity standard pose. `createSpaceship()` is untouched (T9 owns the cursor integration) and
  its existing `spaceship.test.ts` stays green in the full workspace run. Evidence:
  `cursor-ship.test.ts` § dimensions and rest pose.
- AC-4 → met. Every structural mesh (hull, underside, nose, cockpit frame, both wings and tips,
  both engines and nozzles, tail fin, both seams, both vents) uses `MeshPhysicalMaterial` with
  `metalness 0.55`, `roughness 0.38`, `clearcoat 0.4`, `clearcoatRoughness 0.2`; the canopy uses
  `0.2 / 0.08 / 1 / 0.08`; the canopy highlight is `MeshBasicMaterial`; both ignitions are
  transparent (`opacity 0.55`) emissive meshes whose `emissive` equals the ignition part colour.
  Rare/epic appearances (full mixed-set test plus legacy `body`/`wings`/`engine` aliases) change
  colour, accent and slot-group shape only — material instances and the AC-4 finish values are
  unchanged (F9). Exactly two seams, two vents and two nozzles exist, each a thin
  Box/Cylinder with at least one local dimension ≤ 0.04 (seam width 0.014, vent width 0.02,
  nozzle height 0.035); no texture, loader, URL or external asset is referenced. Evidence:
  `cursor-ship.test.ts` § materials, § appearance mapping, § purity. The manual 1280×720 /
  1920×1080 pixel-size matrix belongs to the T14 final visual evidence.

Deviations from spec: none. T8 is additive and nothing imports the new module yet.
