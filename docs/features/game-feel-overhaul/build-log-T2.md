# Build log — T2 — 3D reveal stage factory

Task: T2 (2026-11-16)
Branch: `feat/game-feel-overhaul` (T1 `4421351`; T4 `f01c8b0` landed concurrently in this batch)
Files changed:
- `src/frontend/src/render/lootbox-reveal.ts` (new — reveal stage factory)
- `src/frontend/src/render/lootbox-reveal.test.ts` (new — stage contract tests)
- `docs/features/game-feel-overhaul/build-log-T2.md` (this file)

## What changed & why

1. New `render/lootbox-reveal.ts` exports `createRevealStage(appearance, grant)` and the
   `RevealStage` handle (`scene`, `camera`, `model`, `stageAppearance`, `ring`, `update`,
   `dispose`) exactly as pinned in the plan. It owns no renderer and no frame loop.
2. The pinned four-child scene is built from `createCursorShipModel()` plus one
   `RingGeometry` mesh: `reveal-ambient` (`AmbientLight 0xbcd6ff, 1.1`),
   `reveal-key-light` (`DirectionalLight 0xffffff, 3.0`, position `[2.5, 3.5, 4]`),
   `cursor-ship-model`, `reveal-slot-ring`. Camera `PerspectiveCamera(32, 1, 0.1, 20)` at
   `[0, 0.42, 2.35]` looking at `[0, 0.03, 0]`.
3. Try-on staging: `resolvedSlot = partDefinition(grant.partId).slot` (the catalog slot wins
   over the wire `slot`), `stageAppearance = { ...normalizeAppearance(appearance),
   [resolvedSlot]: grant.partId }`, applied through `model.applyAppearance(stageAppearance)`
   once. The caller's `appearance` object is never mutated.
4. Base slot transforms are captured after `applyAppearance` into `Float64Array`s; each
   `update` writes the whole-ship yaw/scale, the granted slot's base scale × `slotPulse`
   (other slots keep their base scale), every slot's base rotation, the ring's
   scale/opacity and `keyLight.intensity = 3.0 * (1 + flashOpacity)`.
5. `dispose()` disposes the model, the ring geometry/material once, clears the scene and is
   idempotent; updates after disposal are no-ops that return the last pose.

## Stage contract as implemented (AC-4)

```text
lootbox-reveal-scene
├── reveal-ambient        AmbientLight  0xbcd6ff, intensity 1.1
├── reveal-key-light      DirectionalLight 0xffffff, base 3.0, [2.5, 3.5, 4]
├── cursor-ship-model     Group, 10 slot groups, 21 meshes
└── reveal-slot-ring      RingGeometry(0.86, 0.9, 48) → 96 triangles
                          MeshBasicMaterial(REVEAL_RARITY_HEX, transparent,
                          depthWrite false, DoubleSide), rotation.x −π/2, y −0.25
```

Camera: `fov 32`, `aspect 1`, `near 0.1`, `far 20`, position `[0, 0.42, 2.35]`, look-at
direction equals `normalize([0, 0.03, 0] − position)`.

Per-frame values asserted in `lootbox-reveal.test.ts` (grant `wing-left-silver`, razor base
scale `1.16 / 1 / 0.9`, slot yaw `0.85`):

| elapsed | phase | ship yaw | ship scale | slot scale | ring scale | ring opacity | key light |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | charge | 0.55 | 1 | 1.16 / 1 / 0.9 | 0.4 | 0 | 3 |
| 420 | orb | 0.85 | 1.04 | base | 0.4 | 0 | 3 |
| 730 | flash | 0.85 | 1.1 | base | 0.4 | 0 | 3 × (1 + 0.85) = 5.550000000000001 |
| 970 | reveal | 0.85 | 1.0125 | 1.276 / 1.1 / 0.9900000000000001 | 2.15 | 0.9 | 3 |
| 1150 | settle | 0.85 | 1 | base | 2.4 | 0 | 3 |
| 1290 | rest | 0.85 | 1 | base | 1 | 0 | 3 |

Reduced motion writes the rest row for every elapsed value; the same pose object is reused
across frames (identity asserted).

## Scene / geometry / triangle / draw evidence

- Scene children: 4, in the pinned order (`reveal-ambient`, `reveal-key-light`,
  `cursor-ship-model`, `reveal-slot-ring`).
- Model: 21 meshes, `triangleCount === 776`; ring: 96 triangles (`getIndex().count === 288`).
- Total: **22 draw calls** (21 meshes + 1 ring) ≤ `REVEAL_MAX_DRAW_CALLS = 24`;
  **872 triangles** ≤ `REVEAL_MAX_TRIANGLES = 2596` (`CURSOR_SHIP_MAX_TRIANGLES 2500 + 96`).
- Unique resources across the scene: 22 geometries, 20 materials (19 cursor + 1 ring), each
  disposed exactly once and idempotently.
- Runtime traversal: 2 lights, 0 sprites, 0 points, every mesh `castShadow === false` /
  `receiveShadow === false`, every material `map === null`.
- Source guard: no `Math.random`, texture/loader class, `new Texture`, `new Sprite`/`new
  Points`, `document.`/`window.`, URL or image/model extension; exactly one `AmbientLight`,
  one `DirectionalLight`, one `Scene`, one `RingGeometry` and one `.applyAppearance(` call.
  The `Math.random` spy around `update` records 0 calls (three's constructors generate UUIDs,
  so the spy is scoped to the frame path; the module itself has no random source).

## Decisions

1. **`appearanceToCursorShipParams` reuse.** The stage feeds the staged record through
   `CursorShipModel.applyAppearance`, which is the cursor model's single
   `appearanceToCursorShipParams` mapping (the same one `render/preview.ts` uses). The module
   therefore imports no second mapping and cannot drift from the cursor/preview visuals; a
   direct second call would be dead work. AC-5's "applies through
   `model.applyAppearance(stageAppearance)` exactly once" is satisfied literally, and the
   source guard pins the single call site.
2. **Initial pose.** Construction applies the elapsed-0 (charge) row, so a frame painted
   before the first `update` already shows the preview rest yaw, a fully transparent ring and
   the unflashed key light (a fresh `MeshBasicMaterial` defaults to `opacity 1`).
3. **Invalid part.** `partDefinition` throws `unknown part: <id>` before any geometry,
   material or scene object is created; `LootboxReveal` (T3) catches that as its WebGL/stage
   fallback path. The factory never renders a mismatched or unknown part.
4. **Defensive slot lookup.** The granted slot index is an identity lookup over
   `model.slotGroups`; an impossible miss simply never pulses instead of throwing or writing
   `NaN`.
5. **No per-frame allocation.** The pose buffer, base transforms and scene handles are
   allocated once; the frame path is index loops over pre-sized arrays and scalar writes.

## Evidence — raw verify output

`npm run lint` → exit 0

```text
> lint
> eslint .
```

`npm run typecheck` → exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

`npm test --workspace @cubeclicker/frontend` → exit 0

```text
 ✓ src/render/lootbox-reveal.test.ts (16 tests) 80ms
 Test Files  76 passed (76)
      Tests  2331 passed (2331)
```

`npm run coverage --workspace @cubeclicker/frontend` → exit 0

```text
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   96.71 |    96.39 |   97.83 |   96.71 |
 ...box-reveal.ts |     100 |      100 |     100 |     100 |
```

Thresholds are the workspace-pinned 80/80/80/80; all four exceed the gate and the new module
is fully covered with no exclusion added.

`git diff --check` → exit 0 (no whitespace/conflict-marker output).

## Acceptance audit

- **AC-4 — Stage factory contract → met.** `lootbox-reveal.test.ts`: exact scene name/child
  count/order and light classes/names/intensities/colours/position; camera
  `fov 32`/`near 0.1`/`far 20`/`[0, 0.42, 2.35]` and look-at target; `model.meshes.length
  === 21`; ring name, `RingGeometry(0.86, 0.9, 48)` parameters and 96 triangles, transparent
  `MeshBasicMaterial` with `getHex()` `0x60a5fa` (rare) / `0xc084fc` (epic), `depthWrite
  false`, `DoubleSide`, `rotation.x −π/2`, `y −0.25`; `update` key-light lift
  `3.0 * (1 + flashOpacity)` (5.550000000000001 at the 0.85 flash peak); no shadow flags, no
  textures/sprites/points, no loader/DOM/random construction; dispose releases 22
  geometries + 20 materials once, clears the scene and is idempotent.
- **AC-5 — Try-on appearance, no mutation → met.** Catalogue-derived slot wins over a
  mismatched wire `slot` (`wing-left-silver` with wire `hull` stages `wing-left`); the full
  staged record equals `{ hull: 'hull-gold', 'wing-left': 'wing-left-silver' }` for the
  legacy `body: 'body-gold'` input, every other key equals `normalizeAppearance`, and
  `stageAppearance` is a distinct object; the passed `appearance` is deep-equal before/after
  construction and after `update(0/970/1290)`; the model shows hull-gold `0xccaa44`,
  wing-silver `0xaaaaaa`/tip `0xd9dee7`; the source has exactly one `.applyAppearance(` call
  site. (Panel/engine-level AC-5 assertions are owned by T5.)
- **AC-14 — Rarity colour channel → met for the stage.** The ring uses
  `REVEAL_RARITY_HEX.rare === '#60a5fa'` → `0x60a5fa` and `epic === '#c084fc'` → `0xc084fc`.
  The epic 8-ray flourish, duplicate/new text and owned counts are DOM/CSS (T5/T7).
- **AC-15 — Per-frame work and budget → met for the stage.** 22 draw calls ≤ 24,
  872 triangles ≤ 2596, one reused pose buffer (no per-frame allocation) and the per-frame
  writes above; the 10-second runtime trace at 1280×720 and 1920×1080 is recorded by T11.

## Deviations from spec

None. No dependency, no coverage exclusion, no assertion weakening, no main-scene budget
change; T2 files only.
