# Build log — T13 — Session wiring, browser environment & WebGL bootstrap

Task: T13 (2026-10-18, resumed 2026-10-19) — `docs/features/cube-game-frontend/tasks.md` (r4)
Historical build-start revision: `95b13d6` (T12 post-commit verification) — branch `main`
Pre-resume HEAD (baseline for this resume): `1c1163c` (unrelated `agent-model-tuning` commits)
Pre-resume skeleton commit: `02228ac` ("First steps with frontend" — non-conventional, landed the
2026-10-18 attempt's code + the untracked feature docs; no `browser-env.test.ts`/`webgl.test.ts` and
an incomplete build log). The resume completed and verified that skeleton instead of rewriting it.

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

- **`session.ts`** (363 lines): the browser boundary the UI drives. `createGameSession({ env?, engine? })`
  creates (or accepts) the engine immediately, so `getSnapshot`/`subscribe` are valid before attach.
  `attach(canvas)` resolves the environment (`providedEnv ?? browserEnvironment(target)`), builds the
  scene view from the engine style and the renderer through `env.rendererFactory`, applies the first
  viewport (`setPixelRatio(min(dpr, PIXEL_RATIO_CAP))`, `setSize(rect)`, camera aspect
  `width / height`, `1` when empty), wires pointer (down/up/cancel), keydown, motion, visibility and
  resize, then schedules the first frame (unless the tab starts hidden). Each frame:
  `advance(dt)` → `drainIntents()` → `applyIntents` → `applySnapshot` → `update` → `render` → publish
  → reschedule. Phase policy: `intro` tap → `introSkip`, `intro` drag → nothing; `playing` tap →
  `pickMiniCube(view.camera, view.cubeView, frontFace(snapshot.orientation), ndcX, ndcY)` — both
  handles re-read at pick time — hit → `explodeMiniCube`, other-face hit/miss → nothing; `playing`
  drag → `rotate`; `travel` → pointer input ignored. `dispose` cancels the pending frame, removes
  every listener, unsubscribes every source and disposes the renderer + scene exactly once. A frame
  callback that escapes the cancel sees `active === false` and neither renders nor reschedules.
  The module reads no host global (DOM-globals grep below).
- **`browser-env.ts`** (77 lines): the only module reading `window`/`document`/`ResizeObserver`/
  `performance`/`Math.random`; returns the narrow `SessionEnvironment`. Read at call time (not module
  load). The reduced-motion query is the pinned `(prefers-reduced-motion: reduce)` string.
- **`render/webgl.ts`** (59 lines): `createWebGLRenderer(canvas)` → `new WebGLRenderer({ canvas,
  antialias: true })` behind the four-method adapter; `createRafScheduler()` → the rAF/cancel wrapper.
  It does not decide size or pixel ratio (the session owns both).
- **Plan-r3 seam (`scene.ts` / `scene.test.ts`)**: `SceneView` gained `readonly cubeView: CubeView`, a
  getter over the `let cube` binding `rebuildCube`/`reconcileStyle` reassign — never a stored field, so
  a `levelChanged` rebuild cannot leave the session's per-tap read with the disposed previous handle.
  No other render behavior touched; no new drawables/disposables. The one regression test rebuilds via
  `levelChanged` and asserts the accessor returns the new handle (different group, in the scene) while
  the captured old handle is untouched and no longer in `scene.children`.
- **Resume fixes (pre-resume skeleton defects)**: `createFakeEnv` now defaults its options object
  (13 tests constructed it with no argument and threw `Cannot read properties of undefined (reading
  'rect')`); the subscription test's post-unsubscribe assertion now pins the real engine state
  (`yawSteps 1`, left step queued behind the running right step) instead of an impossible `0`;
  the unused `type SceneView` import was removed (ESLint error). Added the two missing unit test
  files (`browser-env.test.ts`, `webgl.test.ts`) and completed this evidence section.

## Decisions

- **`SessionEnvironment` carries `resize: ResizeSource`.** The plan's interface sketch lists the other
  sources but its § Session-wiring text allows "window `resize` via env or ResizeObserver"; a source
  in the environment keeps `session.ts` global-free and testable, and `browser-env.ts` implements it
  with `ResizeObserver` on the canvas.
- **Pixel ratio before size**, `min(devicePixelRatio(), PIXEL_RATIO_CAP)`, cap imported from
  `effects.ts` (`PIXEL_RATIO_CAP = 2`) — pinned by test (`setPixelRatio:2`, `setSize:1600:800`).
- **Time source for deltas is `env.now()`**, the scheduler's callback timestamp is only the frame
  clock; the visible transition resets the baseline so a hidden span never becomes one giant delta.
- **Publish only on snapshot identity change** (the engine caches its snapshot), so React's
  `useSyncExternalStore` sees stable references.
- **Re-attach is supported** after `dispose` for the same engine state (fresh renderer + scene),
  because the component/host contract may mount the same session instance twice; tested.

## Evidence

### Tests — `npm test --workspace @cubeclicker/frontend` → 0

```
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/render/webgl.test.ts (5 tests) 12ms
 ✓ src/game/session.test.ts (19 tests) 38ms
 ✓ src/render/scene.test.ts (23 tests) 66ms
 ... (all 17 files listed by the transcript)
 Test Files  17 passed (17)
      Tests  263 passed (263)
```

New/changed test files in the transcript: `src/browser-env.test.ts` (new, 6),
`src/render/webgl.test.ts` (new, 5), `src/game/session.test.ts` (resumed/fixed, 19),
`src/render/scene.test.ts` (seam regression, 23).

### Coverage — `npm run coverage --workspace @cubeclicker/frontend` → 0

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.39 |     98.9 |     100 |   99.39 |
 src             |   93.84 |      100 |     100 |   93.84 |
  App.tsx        |      84 |      100 |     100 |      84 | 19-22
  browser-env.ts |     100 |      100 |     100 |     100 |
 src/game        |     100 |    99.21 |     100 |     100 |
  session.ts     |     100 |    96.36 |     100 |     100 | 139,173
 src/input       |     100 |      100 |     100 |     100 |
 src/render      |   99.68 |    99.27 |     100 |   99.68 |
  scene.ts       |     100 |      100 |     100 |     100 |
  webgl.ts       |     100 |      100 |     100 |     100 |
-----------------|---------|----------|---------|---------|-------------------
```

Workspace aggregate: **statements 99.39, branches 98.9, functions 100, lines 99.39** — all four
≥ 80. No exclusions added; thresholds untouched. The two uncovered `session.ts` branches are the
default-argument arms (`options.engine ??`, `providedEnv ??`) — the injected path is what the
integration tier pins, and the default path is exercised by `browser-env.test.ts` at its own seam.

### Typecheck — `npm run typecheck --workspace @cubeclicker/frontend` → 0

```
> tsc --noEmit
(no diagnostics)
```

### Lint — `npm run lint` → 0

```
> eslint .
(no diagnostics)
```

### DOM-globals grep (AC-17) → no matches

```
$ grep -n "window\|document\|matchMedia\|requestAnimationFrame\|performance" \
    src/frontend/src/game/session.ts src/frontend/src/game/engine.ts
(no output; exit 1)
```

`game/**` stays DOM-free; only `src/frontend/src/browser-env.ts` (outside `game/**`) reads globals,
plus the `render/webgl.ts` rAF wrapper the plan assigns there.

### Comment-fix greps (plan-r3 + delta-r3 F1) → no matches

```
$ grep -n "at/above" src/frontend/src/game/effects.ts
(no output; exit 1)

$ grep -n "at/above\|exclusive form" src/frontend/src/input/gestures.ts
(no output; exit 1)
```

Before/after lines:

- `game/effects.ts:106` before (`95b13d6`):
  `/** Pointer travel (px) below which a gesture is a tap, at/above which it is a drag. */`
- `game/effects.ts:106-109` after:
  ```
  /**
   * Pointer travel (px) up to and including which a gesture is a tap: travel ≤ 40 px is a
   * tap (exactly at the threshold is a tap), 41 px is a drag (AC-6).
   */
  ```
  Comment-only: `TAP_DRAG_THRESHOLD_PX = 40` unchanged; no test change.
- `input/gestures.ts:14-17` before (`95b13d6`): the parenthetical
  `(The one-line comment beside the constant in `effects.ts` reads "below … at/above …", i.e. the
  exclusive form; … Flagged in the T11 build log.)`
- `input/gestures.ts:14-16` after:
  ```
   * 40 px → tap, 41 px → drag. The doc comment beside the constant in `effects.ts`
   * states the same inclusive form (plan-r3 correction of the mismatch the T11 build
   * log flagged).
  ```
  Comment-only; classification code and tests unchanged.

### Scoped diff inspection — `git diff --stat 95b13d6 02228ac -- <T13 seam/comment files>`

```
 src/frontend/src/game/effects.ts      |  5 ++++-
 src/frontend/src/input/gestures.ts    |  7 +++----
 src/frontend/src/render/scene.test.ts | 23 +++++++++++++++++++++++
 src/frontend/src/render/scene.ts      | 15 +++++++++++++++
 4 files changed, 45 insertions(+), 5 deletions(-)
```

The `effects.ts`/`gestures.ts` hunks are comment lines only (verified by filtering the diff: every
changed line is inside the two doc blocks; no expression, value, import or export changed). The
`scene.ts` hunk is exactly the interface member + getter (15 added lines); the `scene.test.ts` hunk is
exactly the one regression test (23 added lines). `git diff HEAD -- session.ts` in the resume is one
unused-import removal; `git diff HEAD -- session.test.ts` the two skeleton-test fixes described above.
Resume commit paths: the five T13 sources/tests plus this log — no docs, config, `App.tsx`, `main.tsx`
or `ws/**` change.

### Banned-matcher grep over the new/changed test files

`expect.anything|expect.any(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeTruthy|toBeDefined|not.toThrow`
→ no matches. The only hit for the `toHaveBeenCalled()` pattern is four `not.toHaveBeenCalled()`
negatives (no eager renderer, no re-query, one observer still connected, one instance not sized),
which are complete assertions of zero calls, not argument-unchecked positives. **0** bounded
exceptions (`closeTo`) in this task.

## Acceptance audit

- **AC-2 (intro phase / pointer skip) → met.** `pointer wiring > skips the intro on a tap and ignores
  an intro drag` (real engine: tap → `phase === 'playing'`, `stats.clicks === 0`; 120 px drag →
  phase still `intro`, orientation `{0,0}`, `rotationFrom === null`); `maps taps and drags to the
  events each phase allows` pins the dispatch sequence `[]` for an intro drag then
  `[{ type: 'introSkip' }]` for an intro tap.
- **AC-6 (front-face tap pick; threshold; plan-r3 seam) → met.** `explodes the front-face mini-cube
  under a playing tap` (real scene: centre tap → `clicks 1`, `front:2:2` gone, instance matrix zeroed
  in the next rendered frame); `ignores a playing tap that misses the cube` (ndc 0.8/0.8 → `clicks 0`,
  25 remain); `re-reads the live front face and cube view on every tap` (rotation without a frame →
  no click; after the frame the same tap explodes `left:2:2`); `resize…` proves the refreshed camera
  aspect changes the pick; `scene.test.ts` pins the accessor rebuilding after `levelChanged`.
  Threshold semantics are comment-corrected per r3 and already pinned by `gestures.test.ts`/`effects` tests.
- **AC-12 (live reduced-motion toggle) → met.** `follows the injected motion source from attach and on
  a live change` (initial `true` → emit `false` → `false` → emit `true` → `true`);
  `applies the motion setting before the first frame` pins `motionCalls [true]` then `[true, false]`;
  `browser-env.test.ts` pins the pinned media query string and the live `change` forwarding.
- **AC-13 (canvas size/ratio, single input path, touch) → met for this task's scope.** `sizes the
  renderer from the container rect and the capped pixel ratio` pins `['setPixelRatio:2','setSize:1600:800']`
  at dpr 3; `re-applies size, capped pixel ratio and camera projection on the injected resize` pins the
  second pair and aspect; `webgl.test.ts` pins `new WebGLRenderer({ canvas, antialias: true })` and
  argument forwarding. Pointer events are the single path (the session listens only to pointer
  events); `touch-action: none` is T14's canvas style.
- **AC-15 (teardown / no leaks) → met.** `cancels the frame, releases everything exactly once and
  never renders again` (cancel `[2]`, zero listeners, every source unsubscribed once, renderer and
  scene disposed once, `scene.children` empty, an escaped frame callback renders nothing and does not
  reschedule); `pauses the loop while hidden and resumes it from the current time` and `never starts
  the loop while the tab is already hidden` pin visibility pause/resume; `is idempotent` pins attach
  idempotence; `can be attached again for the same engine state` pins the re-attach cycle.

## Deviations from spec

- None in behavior or pinned values. Implementation choices the artifacts leave open are pinned by
  test and listed under Decisions: the `resize` source lives in `SessionEnvironment` (the plan allows
  a `ResizeObserver`), pixel ratio is applied before size, and `attach` is re-entrant after `dispose`.
- The pre-resume skeleton commit `02228ac` already contains the T13 sources (with a non-conventional
  message and no unit tests for `browser-env`/`webgl`); history is not rewritten. This resume commit
  (`feat: add session wiring and WebGL bootstrap (T13)`) completes the task: the two missing test
  files, the skeleton test fixes, the lint fix and this evidence.
- No dependency, config, container, spec, plan, tasks or status change; no coverage exclusion;
  thresholds untouched; `App.tsx`/`main.tsx`/`ws/**` untouched.
