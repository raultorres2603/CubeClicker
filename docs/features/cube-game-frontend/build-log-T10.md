# Build log — T10 — Picking (raycast to mini-cube id)

Task: T10 (2026-10-18)
Files changed: `src/frontend/src/render/picking.ts` (new), `src/frontend/src/render/picking.test.ts` (new), `docs/features/cube-game-frontend/build-log-T10.md` (new)

What changed & why:
- `picking.ts` implements the plan § Render interfaces contract `pickMiniCube(camera, cubeView, frontFaceId, ndcX, ndcY)` with a real `THREE.Raycaster` and no new dependencies.
- Only the `InstancedMesh` of the face named by `frontFaceId` is intersected (non-recursive), so body/plate/highlight/other-face hits can never resolve: they are simply not in the intersection set.
- A hit's `instanceId` decodes to `face:row:col` using the cube view's own encoding; the grid size is read back from `mesh.count` (`Math.round(Math.sqrt(count))`), so non-default grids (the scene may pass `gridSize`) pick correctly.
- Null paths: removed face (no mesh in `faces`), miss / non-target hit (`instanceId === undefined`), and hidden instance (explicit `isMiniCubeHidden` guard).
- `picking.test.ts` builds a real `cube-view` + real `PerspectiveCamera` and asserts exact ids / exact nulls for 9 concrete NDC positions.

Decisions:
- **Target = the front face's mesh, not the whole group.** A group-wide raycast would be occluded by the cursor highlight, which is thicker and wider than the tile it marks (probe below: highlight hit at distance 9.1875, tile at 9.25) — picking must not depend on the accent overlay. Intersecting the gated mesh is also the cheapest correct option (one `InstancedMesh`, ≤ 25 instance tests).
- **No hardcoded `GRID_SIZE`.** The signature is pinned to five parameters and the cube view can be built with another `gridSize`, so the grid size is derived from the instance count; a 3×3 view pins that (`front:2:0` decodes differently under the default 5).
- **Raycaster near/far left at their defaults** (`0`/`Infinity`): the pinned camera (`0.1`/`200`) and the pinned cube placement never clip, so camera-plane coupling would add behavior the plan does not pin.
- **Shared module-level `Raycaster`/`Vector2`** (no per-pick allocation); picking is event-driven and never nested, so reuse is safe. `setFromCamera` only reads the NDC port.
- **Both ends of the ray are refreshed** (`camera.updateMatrixWorld()`, `mesh.updateWorldMatrix(true, false)`) because a tap can be dispatched in the same task as a rotation, before the frame loop refreshes the world matrices; the tests rely on this (the fixture deliberately never calls `updateMatrixWorld`).
- **The `isMiniCubeHidden` guard is defensive**: with the current zero-scale hidden representation three's triangle test already skips hidden instances (probe: 0 intersections), so its true branch is unreachable today — it is kept because `cube-view.ts` documents `isMiniCubeHidden` as the picking seam and the contract must survive any change to the hidden representation. It is the only uncovered line in the new file (coverage below, lines 88-89).

Evidence:
- `npm test --workspace @cubeclicker/frontend` → exit 0; 14 files, 232 tests passed, `src/render/picking.test.ts (9 tests)`:

```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/render/picking.test.ts (9 tests) 17ms
 ✓ src/render/scene.test.ts (22 tests) 36ms
 ✓ src/render/cube-view.test.ts (23 tests) 27ms
 ...
 Test Files  14 passed (14)
      Tests  232 passed (232)
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0, four workspace metrics ≥ 80 (99.27 / 99.2 / 100 / 99.27):

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.27 |     99.2 |     100 |   99.27 |
 ...
 src/render      |   99.66 |    99.21 |     100 |   99.66 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  picking.ts     |   93.54 |     87.5 |     100 |   93.54 | 88-89
  scene.ts       |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
-----------------|---------|----------|---------|---------|-------------------
```

  `picking.ts` lines 88-89 = the `return null;` inside the `isMiniCubeHidden` guard (see Decisions).
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0 (no output).
- `npm run lint` (repo-wide) → exit 0 (no output).
- Banned-matcher grep over the new test file:

```
$ grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching|closeTo)|toMatchObject|toMatchSnapshot|toHaveBeenCalled\(\)|toBeTruthy|toBeDefined|toBeFalsy|toBeGreaterThan|toBeLessThan|not\.toThrow|toMatchInlineSnapshot" src/frontend/src/render/picking.test.ts
grep exit=1 (1 = no matches)
```

- Probe (temporary `it` block inside `picking.test.ts`, real `cube-view` + real `Raycaster`, removed before commit) that measured the two three.js behaviors the decisions rest on:

```
hidden centre hits: 0 []
neighbour hits: [ [ 13, 9.302474574018328 ] ]
group-wide on highlighted tile: [
  [ 'Mesh', undefined, 9.1875 ],
  [ 'Mesh', undefined, 9.1875 ],
  [ 'Mesh', 12, 9.25 ],
  ...
]
```

  i.e. a hidden (zero-scaled) instance yields no intersection at all, and a group-wide ray on a highlighted tile hits the highlight before the tile — both behaviors are asserted in `picking.test.ts` as outcomes (`hidden → null`; `highlighted tile → 'front:2:2'`).

Acceptance audit:
- AC-5 (click targeting) → met: `picking.test.ts` resolves a concrete NDC to an exact id (`front:2:2` at the viewport centre, the four corners, `front:1:3`, `front:3:1`), a 3×3 view resolves `front:2:0` (grid-size decoding), and a removed face resolves `null` — the session (T13) turns a hit into `explodeMiniCube`, which is where the stat intent is produced.
- AC-6 (front-face tap pick) → met: with the cube yawed 90° the centre ray reaches the left face only, `pickMiniCube(camera, view, 'front', 0, 0) === null` while `pickMiniCube(camera, view, 'left', 0, 0) === 'left:2:2'`; the cursor highlight does not swallow the pick; grid gaps and off-cube rays return `null`.
- AC-6 evidence list in spec § Testing strategy names `picking.test.ts` (front-face hit → id; non-front-face hit → null) → met.

Deviations from spec: none.

Scope check:
- `git status --short` before committing shows exactly the three task files as untracked additions from this task (`picking.ts`, `picking.test.ts`, this log); `src/render/scene.ts` / `scene.test.ts` are the concurrent T12 builder's in-flight files and were not touched.
- Commit staged with `git commit --only -- <the three paths>`; `git show --stat HEAD` (below) lists exactly those three files.
