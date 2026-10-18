# Build log — T13 — Session wiring, browser environment & WebGL bootstrap

Task: T13 (2026-10-18) — `docs/features/cube-game-frontend/tasks.md` (r3)
Build-start revision: `95b13d6` (T12 post-commit verification) — branch `main`

Files changed:
- `src/frontend/src/game/session.ts` (new) — session wiring
- `src/frontend/src/game/session.test.ts` (new) — session integration tests
- `src/frontend/src/browser-env.ts` (new) — the single browser-global reader
- `src/frontend/src/browser-env.test.ts` (new) — stubbed-global tests
- `src/frontend/src/render/webgl.ts` (new) — `createWebGLRenderer` + `createRafScheduler`
- `src/frontend/src/render/webgl.test.ts` (new) — mocked-`three` + stub-global tests
- `src/frontend/src/render/scene.ts` (plan-r3 seam only: the rebuild-aware `cubeView` accessor)
- `src/frontend/src/render/scene.test.ts` (plan-r3 seam regression test only)
- `src/frontend/src/game/effects.ts` (plan-r3 comment-only correction)
- `src/frontend/src/input/gestures.ts` (folded delta-review F1, comment-only)
- `docs/features/cube-game-frontend/build-log-T13.md` (this file)

## Sketch (≤ 5 lines, written before the code)

1. `session.ts`: `SessionEnvironment`/`GameSession` per plan § session contract; `attach` resolves env (injected or `browserEnvironment`), builds scene+renderer, wires pointer/key/motion/visibility/resize, starts the scheduler loop; `dispose` tears everything down.
2. Phase-aware pointer dispatch: `intro` tap → `introSkip`, `intro` drag → nothing; `playing` tap → `pickMiniCube(sceneView.camera, sceneView.cubeView, frontFace(snapshot.orientation), ndcX, ndcY)` (hit → `explodeMiniCube`, miss → nothing), drag → `rotate`; `travel` → ignored.
3. Loop: scheduler → `advance(dt)` → drain intents → `applyIntents` → `applySnapshot` → `update` → `renderer.render` → reschedule; publish the engine snapshot on identity change.
4. `browser-env.ts`: the only global reader (key target, motion query, visibility, resize observer, frame clock, pixel ratio, random; default renderer factory from `webgl.ts`); `webgl.ts`: `createWebGLRenderer` (antialias, narrow adapter) + `createRafScheduler`.
5. Seam: `SceneView.readonly cubeView` getter over the current cube-view binding + its `scene.test.ts` regression; the two comment-only corrections.

## What changed & why

(completed after implementation — see below)
