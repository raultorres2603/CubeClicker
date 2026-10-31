---
feature: spaceship-cursor-polish
revision: 3
---
# Plan — Spaceship Cursor Polish

## Architecture

Frontend-only. Three layers, all inside the existing spaceship module:

1. **Constants** (`game/effects.ts`). Changed: `SPACESHIP_FOLLOW_TAU_MS` 120 → 240, `SPACESHIP_CURSOR_NDC_OFFSET_X/Y` -0.05/-0.08 → -0.12/-0.12. New: `SPACESHIP_SCALE` (1.5), `SPACESHIP_IGNITION_COUNT` (2), `SPACESHIP_IGNITION_MOVEMENT_THRESHOLD` (0.01), `SPACESHIP_IGNITION_FLICKER_PERIOD_MS` (100). `SHOT_TRAVEL_MS` stays 180.
2. **Spaceship + shot manager** (`render/spaceship.ts`). Geometry becomes bullet-like: an elongated cone nose, a cylinder body, a sphere cockpit, scaled by `SPACESHIP_SCALE`, with `SPACESHIP_IGNITION_COUNT` cone flames at the rear. The handle gains `ignitions: readonly Mesh[]` and `getIgnitionIntensity(): number`. Pure helpers `spaceshipFollowFactor` and `spaceshipTargetPosition` are unchanged in method; their pinned constants change. Ignition state (accumulated time, intensity, visibility) is owned here and updated during `update`.
3. **Scene integration** (`render/scene.ts`). Unchanged in wiring: the scene already calls `spaceship.update(...)` per frame and adds `spaceship.group` + `spaceship.shotsGroup`. No new scene state is needed; ignition animation is internal to the spaceship. `applyIntents`/shot deferral unchanged.

Data flow: pointermove → session → scene.setPointerTarget → stored NDC → per-frame update → spaceship position + ignition animation. Click → unchanged shot/deferred-explosion path. No back-channel into the engine.

## Interfaces / contracts

```ts
// game/effects.ts additions/changes
export const SPACESHIP_FOLLOW_TAU_MS = 240; // was 120
export const SPACESHIP_CURSOR_NDC_OFFSET_X = -0.12; // was -0.05
export const SPACESHIP_CURSOR_NDC_OFFSET_Y = -0.12; // was -0.08
export const SPACESHIP_SCALE = 1.5;
export const SPACESHIP_IGNITION_COUNT = 2;
export const SPACESHIP_IGNITION_MOVEMENT_THRESHOLD = 0.01;
export const SPACESHIP_IGNITION_FLICKER_PERIOD_MS = 100;
// SHOT_TRAVEL_MS unchanged (180)

// render/spaceship.ts
export interface Spaceship {
  readonly group: Group; // name === 'spaceship', scale === SPACESHIP_SCALE
  readonly shotsGroup: Group;
  readonly shots: readonly Shot[];
  readonly ignitions: readonly Mesh[]; // length === SPACESHIP_IGNITION_COUNT, each name === 'ignition'
  update(camera, ndcX, ndcY, hasPointer, dtMs, reducedMotion): void;
  updateSpaceship(dtMs, camera, pointerNdc, hasPointer, reducedMotion): void;
  getPosition(): Vector3;
  getIgnitionIntensity(): number; // 0..1
  spawnShot(start, target): Shot;
  updateShots(dtMs): Shot[];
  dispose(): void;
}
```

Ignition creation: each ignition mesh is created with `visible === false`; `ignitionTimeMs = 0` and `intensity = 0` initially.

Geometry imports (F2): the bullet-like body uses `CylinderGeometry` instead of `BoxGeometry`; the now-unused `BoxGeometry` import must be removed from `spaceship.ts` (and any other import made unused by the geometry change) so `npm run lint` stays green. `CylinderGeometry` is added.

Ignition update (inside `update`; movement is computed before the ignition reset/early-return so the reduced-motion snap still happens):
- `!hasPointer`: reset baseline (`intensity = 0` and `visible = false` for every flame) and return with no movement (predecessor behaviour). No time advance.
- Pointer path: compute `target = spaceshipTargetPosition(camera, ndcX, ndcY)`; clone `previous = group.position.clone()`; compute `factor = spaceshipFollowFactor(dtMs, reducedMotion)`; `group.position.lerp(target, factor)`; then `delta = group.position.distanceTo(previous)`. This lerp runs for every pointer path, including reduced motion and `dtMs === 0`, so the ship snaps to the target under reduced motion (factor 1).
- Reset baseline next: `intensity = 0` and `visible = false` for every flame. This reset runs on all paths so flames never linger after a prior moving update.
- Early-return (no time advance, no intensity) when `reducedMotion` or `dtMs <= 0` or `delta < SPACESHIP_IGNITION_MOVEMENT_THRESHOLD` (sub-threshold movement). Flames stay hidden (already reset); `ignitionTimeMs` does not advance.
- Otherwise (`delta >= SPACESHIP_IGNITION_MOVEMENT_THRESHOLD`, non-reduced, `dtMs > 0`): `intensity = clamp(delta / SPACESHIP_IGNITION_MOVEMENT_THRESHOLD, 0, 1)` (≥ 1 → 1); `ignitionTimeMs += max(0, dtMs)`; for each flame set `visible = true` and animate:
  - `s = abs(sin(ignitionTimeMs / SPACESHIP_IGNITION_FLICKER_PERIOD_MS * 2π))`
  - `scale.z = 0.6 + 0.4 * s`
  - material opacity = `0.5 + 0.5 * s`

Reduced motion: `factor = 1` (snap), but ignitions are reset to 0/hidden regardless of delta.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/game/effects.ts` | Edit | Changed/new spaceship constants |
| `src/frontend/src/render/spaceship.ts` | Edit | Bullet-like geometry, scale, ignitions, intensity, animation |
| `src/frontend/src/game/effects-spaceship.test.ts` | Edit | Constant assertions (updated + new) |
| `src/frontend/src/render/spaceship.test.ts` | Edit | Follow factor, target vector, geometry/scale, ignition assertions |
| `src/frontend/src/render/scene-spaceship.test.ts` | Edit | Updated tau in follow assertion (no new scene code) |

`scene.ts` and `session.ts` are unchanged.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Keep visual-only shot and deferred explosion unchanged | No engine/server ripple; matches predecessor Q-2 default | Delay engine dispatch (rejected) |
| D-2 | Increase tau 120 → 240 | Clearer "more delay" while still responsive | 300 (rejected: too sluggish) / 180 (rejected: barely changed) |
| D-3 | Offset both axes to -0.12 | Farther and clearly diagonal, symmetric | -0.10/-0.16 (rejected: asymmetric; tunable) |
| D-4 | Scale the whole group by 1.5 and use a cylinder body | Reads as larger bullet-like craft; no box | Keep box (rejected: "not a cube") |
| D-5 | Ignitions are internal cones animated by movement delta | Self-contained, testable via `ignitions` + `getIgnitionIntensity` | Particle-based fire (rejected: heavier, less deterministic) |
| D-6 | Reduced motion hides ignitions entirely | Consistent with collapse philosophy | Static flames (rejected: still motion-y) |
| D-7 | Expose `ignitions` and `getIgnitionIntensity()` for tests | Binary-testable without scene-graph traversal beyond names | Traverse geometry only (rejected: ambiguous) |

## Risks & mitigations

- Geometry type assertions depend on three.js class names; mitigation: use `geometry.type` strings (`'ConeGeometry'`, etc.), which are stable.
- Ignition flicker non-determinism across frames: mitigation: driven by accumulated `dtMs`, so tests control it with fixed steps.
- Scale affects visual only; `getPosition()` returns unscaled position, so shots still fire from the ship centre.
- Coverage: new branches in spaceship; mitigation: tests target rest/move/reduced paths.

## Open questions

See spec.md § Open questions (Q-1 … Q-8).