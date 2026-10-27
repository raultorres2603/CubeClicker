# Build log — T2 — Integrate spaceship, pointer target, and deferred shots into scene

Task: T2 (2026-10-27)
Files changed: src/frontend/src/render/scene.ts, src/frontend/src/render/scene-spaceship.test.ts
What changed & why: Added a spaceship group + shots group to the scene, `setPointerTarget`, `shots` and `lastFrameTime` accessors, deferred explosion queue (shot spawns on explosion under non-reduced motion; arrival applies pop+burst using captured origin/normal and retained frame time), reduced-motion instant path, spaceship/shot advancement in `update`, and disposal cleanup.
Decisions: Shots remain top-level via `spaceship.shotsGroup`; frame time retained from `applyIntents`/`applySnapshot` (default 0); pending explosions decrement independently and apply at arrival.

Evidence:
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0
- `npm run lint` → exit 0
- `npx vitest run src/frontend/src/render/scene-spaceship.test.ts` → 11 passed, 0 failed
- `npm run build` → success (vite build completed)
- Full `npm test --workspace @cubeclicker/frontend` / `npm run coverage` currently fail only on predecessor scene/session tests that assert the pre-feature immediate-explosion visuals; those are updated by the feature's test revision to the deferred-shot timing. The new `scene-spaceship.test.ts` passes.

Acceptance audit: AC-1 → met (spaceship group present, survives rebuild); AC-4 → met (deferred: no immediate hide/burst, shot added); AC-5 → met (arrival at 180ms hides + burst, midpoint average, lastFrameTime); AC-6 → met (reduced instant, no shot); AC-8 → met (dispose empties shots, one group after rebuild).
Deviations from spec: none