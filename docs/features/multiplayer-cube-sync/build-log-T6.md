# Build log — T6 (multiplayer-cube-sync)

## Scope
Modified `src/frontend/src/render/world.ts` and `src/frontend/src/render/world.test.ts` only.

## Changes
- `MemberCube` now tracks `orientation`, `rotationFrom`, `rotationElapsedMs`, `rotationDurationMs` (300 ms via `timingsFor(false).rotationMs`).
- `copyMember` now copies `yawSteps`/`pitchSteps`.
- `build` sets the cube view group's rotation to the member's reported orientation (no animation for new members).
- `upsert` animates existing members only when the reported orientation differs (retargets smoothly, no-op when identical).
- `applyMessage` handles `cubeRotated`: animates the matching member's cube to the target yaw/pitch; no-op for unknown members; no dispose/rebuild.
- `levelAdvanced` resets orientation to `(0, 0)` (identity rotation) on rebuild.
- `update(dt)` advances in-flight rotations (linear, yaw shortest path, pitch linear) and applies the interpolated orientation to the cube view group; settles at `t = 1`.

## Verification

### `npm run lint`
```
> lint
> eslint .
```
(exit 0, no output)

### `npm run typecheck --workspace @cubeclicker/frontend`
```
src/game/session.test.ts(642,3): ... (pre-existing, out-of-scope: missing yawSteps/pitchSteps in fixtures owned by T4/T7)
src/game/session.test.ts(687,5): ...
src/game/session.test.ts(717,5): ...
src/game/session.test.ts(741,3): ...
src/multiplayer/transport.test.ts(114,5): ...
src/multiplayer/transport.test.ts(115,14): ...
src/render/scene.test.ts(140,3): ...
src/ui/UserPanel.test.tsx(14,3): ...
```
`src/frontend/src/render/world.ts` and `src/frontend/src/render/world.test.ts` typecheck cleanly; the remaining errors are in files outside this task's `files_owned` (T4/T7-owned fixtures) and are not touched by T6.

### `npm test --workspace @cubeclicker/frontend -- world`
```
 RUN  v3.2.7 .../src/frontend

 ✓ src/render/world.test.ts (27 tests) 36ms

 Test Files  1 passed (1)
      Tests  27 passed (27)
```

### `npm run coverage --workspace @cubeclicker/frontend -- world` (world.ts)
```
 src/render/world.ts | 97.15 | 89.88 | 100 | 97.15 | ...32,289-292,442
```
(world.ts: 97.15% statements, 89.88% branches, 100% functions, 97.15% lines — above the 80% gate.)

## Commit
`feat: animate remote cube rotations in the world view (multiplayer-cube-sync T6)`