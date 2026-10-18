# Build log — T8 — Cube view (faces, mini-cubes, highlight, removal)

Task: T8 (2026-10-18)
Files changed:
- `src/frontend/src/render/cube-view.ts` (new)
- `src/frontend/src/render/cube-view.test.ts` (new)
- `docs/features/cube-game-frontend/build-log-T8.md` (this file)

What changed & why (≤5 lines):
1. Built `createCubeView(style, gridSize = GRID_SIZE)` exactly on the plan § Interfaces surface: `group`, `body`, `faces`, `plateMeshes`, `hideMiniCube`, `highlightCursor`, `removeFace`, `applyStyle`, `dispose`.
2. One `InstancedMesh` per face (`gridSize²` instances, index = `row * gridSize + col`) whose instance matrices are built as the exact axis-aligned face basis scaled to the tile and placed on the pinned grid; plus one face plate per face with a transparent material for fades, and one accent-material highlight mesh for the keyboard cursor.
3. `hideMiniCube` keeps the tile's slot and zeroes the linear part of the matrix (so `picking.ts` can still raycast the instance and discard it); `removeFace` sets the plate opacity to 0, detaches both meshes, disposes their geometry/material and drops them from the maps; `applyStyle` re-colours the existing materials in place; `dispose()` releases every geometry/material exactly once and empties the group.
4. Tests run in node against real three.js objects (the spec's integration tier for `render/**`) and pin concrete values: instance positions/scales per face, constant value pins, material colours/metalness/roughness, highlight placement/orientation, exact disposal call counts.

Decisions:
- **Additive-to-plan members (documented deviation, no behaviour change).** The returned object also exposes `highlight: Mesh` and `isMiniCubeHidden(id)`:
  `highlight` is the single accent mesh the plan describes as "accent material swap/scale" (tests and diagnostics need a handle on it; the plan's map-based surface has no slot for it);
  `isMiniCubeHidden` is the read side of "hidden instance" that T10's `pickMiniCube` needs ("returns null … for hidden instances") — without it a picker can only guess from a matrix's zero scale.
  Both are additive; every plan-pinned member keeps its pinned shape/name.
- **Instance matrices are `copy(basis).scale(tile).setPosition(center)`, not `compose(center, quaternion, scale)`.** The basis vectors are axis-aligned, so the scaled columns stay exact (no quaternion round-trip) — the instance transform is exactly the face basis scaled to the tile. Positions use an explicit screen-up vector per face (no `negate()`), which also keeps every zero a plain `0` instead of a signed zero.
- **Per-face geometry/material instances instead of shared ones.** One `BoxGeometry(1,1,1)` (instances), one plate `PlaneGeometry` + one `MeshStandardMaterial` per face, plus the body's and the highlight's own — 14 geometries and 14 materials total. Sharing would break AC-9's "the cleared face's geometry/instances are removed and disposed" (one face's disposal would kill the others), so per-face ownership is the honest reading of that AC.
- **`removeFace` deletes from `faces`/`plateMeshes`** (`faces.size` 6 → 5). AC-9 says the face's plate/instances are *removed from the scene*, and the maps are the view's public inventory of what is still in the scene; `gridSize`/`FACE_IDS` stay the source of truth for the board's six faces. Disposal is tracked in a `Set`, so `removeFace` + `dispose()` never double-dispose a resource.
- **Colour assignment:** body + plate take `style.cubeColor`, tiles take `style.miniCubeColor`, the highlight takes `style.accentColor` (spec § Cube, mini-cubes, and styles). Plate opacity is never reset by `applyStyle` (the scene owns the fade).
- **The fade itself belongs to the scene (T12).** T8 ships the mechanism the plan asks for: a transparent plate material plus a `removeFace` end state (opacity 0 + detach + disposal); the per-frame interpolation over `FACE_FADE_MS` happens in `scene.applyIntents`.

Evidence (final transcripts, run after the parallel batch settled):
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > tsc --noEmit
  ```
- `npm run lint` → exit 0:
  ```
  > eslint .
  ```
- `npm test --workspace @cubeclicker/frontend` → exit 0:
  ```
   ✓ src/render/cube-view.test.ts (23 tests) 29ms
   Test Files  10 passed (10)
        Tests  167 passed (167)
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (four metrics ≥ 80 workspace-aggregate):
  ```
  All files        |    99.3 |    98.68 |     100 |    99.3 |
   src/render      |     100 |      100 |     100 |     100 |
    cube-view.ts   |     100 |      100 |     100 |     100 |
  ```
- Banned-matcher grep over `cube-view.test.ts`:
  `grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching|closeTo)|toMatchObject|toMatchSnapshot|toHaveBeenCalled\(\)|toBeTruthy|toBeDefined|not\.toThrow"` → no matches (exit 1).
- DOM-globals grep over `cube-view.ts`:
  `grep -nE "\b(window|document|performance|matchMedia|requestAnimationFrame|localStorage)\b"` → no matches (exit 1); `grep -nE "from 'three/addons|import \* as"` on both files → no matches (exit 1).
- Scope check: `git status --porcelain` at commit time lists `cube-view.ts`/`cube-view.test.ts` inside the untracked `src/frontend/src/render/`; staging is explicit per file (`git add src/frontend/src/render/cube-view.ts src/frontend/src/render/cube-view.test.ts docs/features/cube-game-frontend/build-log-T8.md`) — never the directory, never `git add .`.

Acceptance audit:
- AC-4 (cube level structure) → met: `cube-view.test.ts` "builds one body, six face grids, six plates and one hidden highlight" (6 `InstancedMesh`, 25 instances each), "lays every face grid on the pinned first and last positions" (concrete first/last instance centres for all six faces), "sizes every instance to the tile and orients it on its face".
- AC-5 (hide the exploded instance) → met: "zeroes one instance matrix while keeping its position" (position kept, linear part zero, `count` still 25, `isMiniCubeHidden` true), "hides exactly the requested id, on its own face, and is idempotent".
- AC-9 (plate removal + disposal) → met: "detaches the face, zeroes its plate opacity and disposes its resources once" (opacity 0, `faces`/`plateMeshes` shrink, group 14 → 12 children, four disposals exactly once, other faces untouched), "is a no-op when the face is already removed", "leaves the remaining faces hittable".
- AC-16 (bounded rendering resources) → met: exactly 6 `InstancedMesh` + 6 plates + 1 body + 1 highlight (14 children, asserted), `removeFace`/`dispose` release them; no per-frame allocation (instances/plates/highlight are created once and reused).

Deviations from spec: none in behaviour; the two additive members and the per-face (rather than shared) geometry ownership are documented under Decisions.

Commit note (coordination incident — no history rewrite performed):
- The three T8 paths landed inside a parallel task's commit: `bbf403e feat: add pooled explosion particle system (T9)` contains `docs/features/cube-game-frontend/build-log-T8.md`, `src/frontend/src/render/cube-view.ts` and `src/frontend/src/render/cube-view.test.ts` alongside T9's own files (`git show --stat bbf403e` → 6 files). Cause: T9 staged the shared directory (`src/frontend/src/render/`) while the T8 files were untracked in it. T8's own explicit `git add` of the three paths (never the directory, never `git add .`) was therefore a no-op and the pinned commit message `feat: add the cube view with instanced mini-cubes (T8)` could not be produced for those files.
- Content is intact: `git diff HEAD -- <the three paths>` is empty (HEAD == working tree), and the whole workspace is green as transcribed above. This log amendment is committed on its own with a `docs:` conventional message; rewriting the shared history to re-attribute the files was deliberately not attempted (parallel agents were committing on the same branch).

Reconciliation with the parallel batch (T3/T5/T6/T7/T9 landed while T8 was in flight):
- First workspace-scoped pre-gate run right after `cube-view.ts` + its tests landed: **exit 0**, `All files 82.29% stmts / 98.63% branch / 100% funcs / 82.29% lines` with `cube-view.ts` 100/100/100/100 (T9's `particles.ts` was on disk untested at 0% at that moment).
- Minutes later T6's `engine.ts` entered the workspace (0% until its test file is finished → aggregate 68.57%), and briefly T6's mid-edit `engine.test.ts` (8 then 5 failing tests) and T9's `particles.test.ts` (2 typecheck errors, `BufferAttribute.usage`) were red too — none of those files is owned by T8. T8's own file and its tests were never affected: `npx vitest run src/render/cube-view.test.ts` stayed 23/23 green with 100% coverage on all four metrics throughout, and the T8-scoped compile `npx tsc --noEmit … src/render/cube-view.ts src/render/cube-view.test.ts` exited 0 during the red window.
- Once the siblings settled, the full workspace run is green (transcripts above: test exit 0 / 167 tests, coverage exit 0 / 99.3% aggregate, typecheck exit 0, lint exit 0). The transient numbers are kept here for honesty rather than dropped.
