---
feature: spaceship-cursor
revision: 3
---
# Plan — Spaceship Cursor

## Architecture

Frontend-only. Three layers:

1. **Constants + pure math** (`game/effects.ts`, `render/spaceship.ts`). New pinned constants (`SHOT_TRAVEL_MS`, `SPACESHIP_FOLLOW_TAU_MS`, `SPACESHIP_PLANE_DISTANCE`, `SPACESHIP_CURSOR_NDC_OFFSET_X/Y`) join the existing constant home. Pure helpers: follow factor `1 - exp(-dt/tau)`, target position from NDC via camera unprojection at the pinned distance (ray through the offset NDC, point at Euclidean distance `SPACESHIP_PLANE_DISTANCE`), shot position lerp.
2. **Spaceship + shot manager** (`render/spaceship.ts`). Builds the spaceship group (cone + box + sphere) once and owns a list of in-flight shots (each a small sphere mesh plus start/target/remaining time). Exposes `createSpaceship()` returning `{ group, shots, updateSpaceship(dtMs, camera, pointerNdc, hasPointer, reducedMotion), getPosition(), spawnShot(start, target): Shot, updateShots(dtMs): Shot[] (completed), dispose() }`. No DOM, no engine. Pure helpers `spaceshipFollowFactor(dtMs, reducedMotion)` and `spaceshipTargetPosition(camera, ndcX, ndcY)` are exported from this module.
3. **Scene integration** (`render/scene.ts`). Owns one spaceship instance added to `scene` at construction. Tracks `pointerNdc` + `hasPointer`. `setPointerTarget(ndcX, ndcY)` stores clamped NDC. In `applyIntents`, an `explosion` intent under non-reduced motion does NOT call `applyExplosion` immediately; instead it captures the mini-cube's world origin and outward face normal (at fire time), the spaceship's current position, spawns a shot, and queues a deferred explosion `{ intent, origin, normal, remainingMs: SHOT_TRAVEL_MS }`. Under reduced motion it applies immediately (as before). In `update`, advance spaceship, advance shots; when a shot's `remainingMs <= 0`, remove it and apply the deferred explosion (pop + burst) using the captured origin/normal and the retained frame time. `dispose()` clears shots and removes the spaceship. The scene retains the most recent frame time from `applyIntents`/`applySnapshot` (default `0`) for burst spawning inside `update`.
4. **Session integration** (`game/session.ts`). Adds `pointermove` listener on the canvas, computes NDC from the rect, clamps to `[-1, 1]`, calls `activeScene?.setPointerTarget(ndcX, ndcY)`. Exposes `setPointerTarget` on `GameSession`.

Data flow: pointermove → session → scene.setPointerTarget → stored NDC → per-frame update → spaceship position. Click → engine explode (sync state) → intent drained → scene schedules shot → per-frame update → shot arrival → applyExplosion visual (pop + burst) with captured origin/normal. No back-channel into the engine.

## Interfaces / contracts

```ts
// game/effects.ts additions
export const SHOT_TRAVEL_MS = 180;
export const SPACESHIP_FOLLOW_TAU_MS = 120;
export const SPACESHIP_PLANE_DISTANCE = 6;
export const SPACESHIP_CURSOR_NDC_OFFSET_X = -0.05;
export const SPACESHIP_CURSOR_NDC_OFFSET_Y = -0.08;

// render/spaceship.ts
export interface Spaceship {
  readonly group: Group; // name === 'spaceship'
  readonly shots: readonly Shot[];
  update(camera, ndcX, ndcY, hasPointer, dtMs, reducedMotion): void;
  getPosition(): Vector3;
  spawnShot(start: Vector3, target: Vector3): Shot;
  updateShots(dtMs: number): Shot[]; // returns completed shots
  dispose(): void;
}
export interface Shot { readonly mesh: Mesh; start: Vector3; target: Vector3; remainingMs: number; }
export function spaceshipFollowFactor(dtMs: number, reducedMotion: boolean): number;
export function spaceshipTargetPosition(camera: Camera, ndcX: number, ndcY: number): Vector3;

// SceneView additions
setPointerTarget(ndcX: number, ndcY: number): void;
readonly shots: readonly Shot[];
readonly lastFrameTime: number; // retained frame time, default 0; drives burst spawn in update
// GameSession additions
setPointerTarget(ndcX: number, ndcY: number): void;
```

Deferred explosion queue (internal to scene):
```ts
interface PendingExplosion {
  intent: Extract<EffectIntent, { kind: 'explosion' }>;
  origin: Vector3;   // captured at fire time
  normal: Vector3;   // captured at fire time
  remainingMs: number;
}
```

Shot position (linear travel) at elapsed `e` ms of `SHOT_TRAVEL_MS`:
`start.clone().lerp(target, e / SHOT_TRAVEL_MS)`; at `e === 90` this is the component-wise average of `start` and `target`.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/game/effects.ts` | Edit | Add spaceship/shot constants |
| `src/frontend/src/render/spaceship.ts` | New | Spaceship group + shot manager + pure helpers |
| `src/frontend/src/render/scene.ts` | Edit | Integrate spaceship, pointer target, deferred shots, `shots` accessor, frame-time retention |
| `src/frontend/src/game/session.ts` | Edit | pointermove → setPointerTarget; expose on GameSession |
| `src/frontend/src/game/effects-spaceship.test.ts` | New | Constant assertions |
| `src/frontend/src/render/spaceship.test.ts` | New | Pure math + helper assertions |
| `src/frontend/src/render/scene-spaceship.test.ts` | New | Scene integration assertions |
| `src/frontend/src/game/session-spaceship.test.ts` | New | Session pointer tracking assertions |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Visual-only shot: game state stays synchronous at click; only the explosion visual is delayed | Avoids engine/server changes and keeps existing tests passing; matches Q-2 default | Delay engine dispatch (rejected: large ripple) |
| D-2 | Defer `applyExplosion` in the scene via a shot queue with `remainingMs` | Reuses existing `applyExplosion` unchanged; shot arrival triggers it | New intent kind (rejected: protocol/engine churn) |
| D-3 | Spaceship follows pointer in a plane 6 units in front of the camera | Keeps it visually near the cursor across viewport sizes | Fixed world z (rejected: off-screen on small viewports) |
| D-4 | Reduced motion: snap follow, instant explosion, no shot | Consistent with existing reduced-motion collapses | Hide spaceship entirely (rejected: Q-5) |
| D-5 | Local-only: no broadcast of pointer position | No protocol/server change; matches Q-1 default | Broadcast pointer (rejected: scope) |
| D-6 | Origin and face normal captured at fire time and stored in the deferred queue | Shot lands on the tile it was fired at even if the cube rotates before arrival; matches F3 | Recompute at arrival (rejected: fire/arrival disagreement) |
| D-7 | Observable shot surface is `shots: readonly Shot[]` on both `Spaceship` and `SceneView` | Single read surface for AC-4/AC-8; tests do not depend on scene-graph internals | Count via scene children (rejected: ambiguous) |
| D-8 | Observable retained-frame-time surface is `SceneView.lastFrameTime: number` (default `0`) | Single read surface for AC-5's burst frame-time clause; tests do not depend on particles internals | Testing via particle recycling ordering (rejected: ambiguous) |

## Risks & mitigations

- Shot arrival timing depends on `update` dt; tests use fixed dt steps to make it deterministic. Mitigation: store `remainingMs` and decrement by `max(0, dtMs)`.
- Spaceship position at fire time may be stale if no pointer moved; mitigation: default position at `(0,0,6)` and shot still fires.
- Scene rebuild must not duplicate spaceship; mitigation: create once at construction, never in rebuild path.
- Burst frame time inside `update`: mitigation: retain last frame time from `applyIntents`/`applySnapshot`, default `0`.
- Coverage: new branches in scene/session; mitigation: tests target them.

## Open questions

See spec.md § Open questions (Q-1 … Q-5). Review response: see spec.md § Review response (spec-r1) (F1 … F7) and § Review response (spec-r2) (F8 … F11).