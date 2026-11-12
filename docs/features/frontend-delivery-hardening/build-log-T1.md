# Build log — T1 — Runtime environment seam and load status

Task: T1 (2026-11-12)
Files changed:
- `src/frontend/src/game/session.ts`
- `src/frontend/src/game/session.test.ts`
- `src/frontend/src/game/session-spaceship.test.ts` (compile-only: the two inline `SessionEnvironment` fixtures gain `renderRuntime`; no assertion changed — see Deviations)
- `src/frontend/src/browser-env.ts`
- `src/frontend/src/browser-env.test.ts`
- `src/frontend/src/render/scene.ts`
- `src/frontend/src/ui/GameCanvas.test.tsx` (compile-only: the probe environment gains `renderRuntime`; no assertion changed — see Deviations)
- `docs/features/frontend-delivery-hardening/build-log-T1.md`

What changed & why:
- `session.ts` no longer has any runtime (value) import of `../browser-env`, `../render/scene` or `../render/picking`; the reference to those is type-only (`SceneView`, `SceneViewOptions`, `HoverPick`, `CubeView`). The Three-touching functions arrive through the new `SessionEnvironment.renderRuntime` (`RenderRuntime`: `createSceneView`, `pickHoverTarget`, `pickMiniCube`), so `session.ts` is out of the entry graph's Three closure.
- `render/scene.ts` exports `SceneViewOptions` and `createSceneView(options: SceneViewOptions)`; the interface is the exact former inline parameter type. No scene behavior changed (`git diff` is the type extraction + signature only).
- `browser-env.ts` assembles `renderRuntime` from the real `render/scene` + `render/picking` functions; this module is the (already-planned) dynamic-import target, so it is now the single static edge to the render modules from the session boundary.
- `session.ts` adds `RuntimeStatus = 'idle' | 'loading' | 'ready' | 'error'`, optional `getRuntimeStatus?`/`subscribeRuntime?` on `GameSession` (existing fakes keep type-checking; `createGameSession` always implements them), and `GameSessionOptions.loadEnvironment?: (canvas) => Promise<SessionEnvironment>` whose production default is `import('../browser-env').then(({ browserEnvironment }) => browserEnvironment(canvas))`.
- `attach` keeps the accepted synchronous contract for a provided `options.env` (start body runs before return, status `ready`). Without one it sets `loading`, calls the loader once, starts on resolve (`ready`) or sets `error` on reject (with `active = false`, so the next `attach` is the retry). An attach-generation token (bumped by every attach and dispose) drops `dispose()`-during-loading and StrictMode-shaped remount resolutions; attach while active/loading is idempotent.
- The existing attach body moved verbatim into `start(target, env)`; its `frameBaselineMs = env.now()` is therefore the runtime-start clock. The loader runs before it and never calls `engine.advance`, so the loader elapsed is skipped: deferred and immediate loads produce the same intro progress after the same post-attach delta (the accepted gate-close timing is preserved).

Decisions:
- `renderRuntime` is required on `SessionEnvironment` (plan contract). The integration fixtures inject the real functions, which keeps `session.test.ts`/`session-spaceship.test.ts`/`GameCanvas.test.tsx` exercising the real three.js scene and picking rather than duplicating them.
- `session.test.ts` injects the module-mocked `pickHoverTarget` (the existing spy wraps the real function) so the accepted hover-coalescing assertions remain observable; `createSceneView` and `pickMiniCube` are the real functions.
- `dispose()` resets the status to `idle` (only reachable while `active`, i.e. also during `loading`); after a rejected load the status stays `error` until the next `attach` starts a fresh `loading` cycle.
- The status listener set follows the existing listener style (direct `Set` iteration, notify only on change) so T2 can drive `useSyncExternalStore` without further session work.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

- `npm run test --workspace @cubeclicker/frontend` → exit 0
```
 Test Files  64 passed (64)
      Tests  1778 passed (1778)
   Start at  21:37:52
   Duration  3.58s (transform 7.37s, setup 0ms, collect 22.06s, tests 11.24s, environment 6.96s, prepare 6.38s)
```

- Focused new-block run, `npx vitest run src/game/session.test.ts -t "runtime environment loading" --reporter=verbose` (run from `src/frontend`) → exit 0
```
 ✓ src/game/session.test.ts > runtime environment loading (AC-2 session half, AC-3) > starts synchronously and reports ready for a provided environment (loader unused) 46ms
 ✓ src/game/session.test.ts > runtime environment loading (AC-2 session half, AC-3) > loads a deferred environment once: loading creates no host effects, then ready starts one cycle 14ms
 ✓ src/game/session.test.ts > runtime environment loading (AC-2 session half, AC-3) > cancels a pending load on dispose: the late resolution creates nothing 0ms
 ✓ src/game/session.test.ts > runtime environment loading (AC-2 session half, AC-3) > reports error on a rejected load without listeners, frames or connections 0ms
 ✓ src/game/session.test.ts > runtime environment loading (AC-2 session half, AC-3) > retries after an error with a second loader call and starts exactly one cycle 11ms
 ✓ src/game/session.test.ts > runtime environment loading (AC-2 session half, AC-3) > is idempotent while loading: a second attach neither reloads nor starts twice 12ms
 ✓ src/game/session.test.ts > runtime environment loading (AC-2 session half, AC-3) > drops a StrictMode-shaped first load: two loader calls, only the second starts 10ms
 ✓ src/game/session.test.ts > runtime environment loading (AC-2 session half, AC-3) > anchors the intro clock at runtime start, skipping the loader elapsed (16 / introMs) 22ms

 Test Files  1 passed (1)
      Tests  8 passed | 86 skipped (94)
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 on statements/branches/functions/lines, per workspace)
```
 Test Files  64 passed (64)
      Tests  1778 passed (1778)
All files          |   96.41 |    96.12 |   97.51 |   96.41 |
  session.ts       |   89.75 |    98.63 |   95.58 |   89.75 | ...1530,1567-1568
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77
  scene.ts         |   97.26 |    99.39 |   95.34 |   97.26 |
```

- Static-import proof (AC-2 session half / AC-1 groundwork):
```
$ grep -nE "^import \{.*from '\.\./(browser-env|render/scene|render/picking)'" src/frontend/src/game/session.ts
none (exit 1)
$ grep -nE "^import type .*from '\.\./(render/scene|render/picking|render/cube-view)'" src/frontend/src/game/session.ts
102:import type { CubeView } from '../render/cube-view';
103:import type { HoverPick } from '../render/picking';
106:import type { SceneView, SceneViewOptions } from '../render/scene';
$ grep -nF "return import('../browser-env')" src/frontend/src/game/session.ts
227:  return import('../browser-env').then(({ browserEnvironment }) => browserEnvironment(canvas));
```

- No scene behavior change:
```
$ git diff --stat -- src/frontend/src/render/scene.ts
 src/frontend/src/render/scene.ts | 35 ++++++++++++++++++++++++++++-------
 1 file changed, 28 insertions(+), 7 deletions(-)
```
  (the diff is the exported `SceneViewOptions` interface plus `createSceneView` taking it; the body is untouched).

- Out-of-scope production files untouched:
```
$ git diff --exit-code -- src/frontend/src/ui/GameCanvas.tsx src/frontend/src/App.tsx
untouched exit=0
```

- Accepted gate-close intro timing stays green: the existing `detached login path` test still pins `phaseProgress === 16 / 2500` after one 16 ms frame; the new deferred-loader test additionally pins the same `16 / 2500` (never `(500 + 16) / 2500`) and equality with the immediate-loader baseline.

Acceptance audit:
- AC-2 (session half) → met: provided env starts synchronously with `ready` and zero loader calls; a deferred loader leaves `loading` with zero renderer/listener/frame/transport-connect before resolution, then exactly one start and `ready`; rejection yields `error` with no host effects; retry calls the loader a second time and starts once; attach-while-loading is idempotent; StrictMode-shaped mount → unmount → remount performs two loader calls and one start; `GameCanvas` still calls the one-argument `attach` (unchanged `GameCanvas.tsx` and its 7-test suite green). The exact `Loading the game…`/`The game could not be loaded.` UI is T2.
- AC-3 → met: injected-env attach remains synchronous; the existing attach/dispose/idempotence/hidden-at-attach/transport-subscribe-before-connect tests stay green unchanged; dispose during loading creates nothing (late resolution ignored, status `idle`); `attach → dispose → attach` behavior unchanged (existing tests); the intro clock is anchored at runtime start, `engine.advance` is never called while the loader is pending, and the fake-clock deferred test pins `16 / 2500` (equal to the immediate-loader baseline, not `(N + 16) / 2500`).
- AC-10 (T1 portion) → met: both tiers shipped (unit-level status/loader tests through the session boundary, integration-level real three.js scene/renderer tests, browser-env boundary test); concrete expected values only; coverage command exits 0 at 96.41/96.12/97.51/96.41 aggregate with `session.ts` at 89.75/98.63/95.58/89.75; no exclusion or threshold change.

Deviations from spec: none. Two compile-only fixture additions outside the strict note wording are recorded as required by the plan's required `renderRuntime` field:
- `src/frontend/src/game/session-spaceship.test.ts`: both inline `SessionEnvironment` literals gain `renderRuntime: { createSceneView, pickHoverTarget, pickMiniCube }` (real functions); no assertion changed.
- `src/frontend/src/ui/GameCanvas.test.tsx`: the real-session probe environment gains the same `renderRuntime` field; the file is in T1's `files_owned`, and its seven tests/assertions are unchanged and green. T2 still owns the UI (`GameCanvas.tsx` untouched).

## Post-strengthening re-verification (T1 completion)

The deferred-loader test was strengthened before the final amend: the `loading` state now also pins
`visibility.subscribeCount() === 0`, `resize.subscribeCount() === 0` and
`orientation.subscribeCount() === 0` before resolution, and exactly `1` for each after the single
start (the "zero listeners before resolve" claim now covers every host subscription source). Test-only
change; no production line changed, so the coverage figures below are identical to the first run.

- Focused run, `npx vitest run src/game/session.test.ts -t "runtime environment loading"` (from `src/frontend`) → exit 0
```
 ✓ src/game/session.test.ts (94 tests | 86 skipped) 118ms

 Test Files  1 passed (1)
      Tests  8 passed | 86 skipped (94)
```

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

- `npm run test --workspace @cubeclicker/frontend` → exit 0
```
 Test Files  64 passed (64)
      Tests  1778 passed (1778)
   Start at  21:39:41
   Duration  3.41s (transform 7.82s, setup 0ms, collect 21.85s, tests 10.90s, environment 6.50s, prepare 6.33s)
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 on all four metrics, per workspace)
```
 Test Files  64 passed (64)
      Tests  1778 passed (1778)
All files          |   96.41 |    96.12 |   97.51 |   96.41 |
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77
  session.ts       |   89.75 |    98.63 |   95.58 |   89.75 | ...1530,1567-1568
  scene.ts         |   97.26 |    99.39 |   95.34 |   97.26 | ...1076,1084-1085
```

The amended commit (`perf: load frontend runtime behind a dynamic seam`) contains the 7 T1
source/test files plus this build log; no planner artifacts, no T2-T5 artifacts.

