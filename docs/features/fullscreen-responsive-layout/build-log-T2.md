# Build log — T2 — Renderer resize, DPR cap, debounced listener & orientation source

Task: T2 (2026-10-24) — `docs/features/fullscreen-responsive-layout/tasks.md`
Files changed:
- `src/frontend/src/game/session.ts`
- `src/frontend/src/game/session.test.ts`
- `src/frontend/src/browser-env.ts`
- `docs/features/fullscreen-responsive-layout/build-log-T2.md`

## Sketch (≤ 5 lines, written before the code)

1. `SessionEnvironment`: add optional `orientation?: OrientationSource`; `browser-env.ts` implements it with `window 'orientationchange'` + teardown.
2. `attach`: keep the direct `applyViewport()` call; `env.resize` schedules a trailing 16 ms `setTimeout` (clear + reschedule on each emission).
3. `env.orientation` clears the pending resize timer and applies `applyViewport()` synchronously; teardown clears the timer and unsubscribes both sources.
4. Keep `applyViewport` exactly as pinned: capped DPR → size → helper aspect → `updateProjectionMatrix`.
5. `session.test.ts`: fake-timer debounce/orientation/teardown cases, 800×600 → 4/3, and pointerType-agnostic touch gating during travel/view-only.

## What changed & why

- **`session.ts` — `SessionEnvironment.orientation`.** New optional `OrientationSource` (`subscribe(cb): unsubscribe`). Optional keeps the existing custom-environment seam type-compatible; `browserEnvironment()` always supplies it.
- **`session.ts` — `applyViewport`.** Unchanged body: `setPixelRatio(Math.min(env.devicePixelRatio(), PIXEL_RATIO_CAP))`, `setSize(rect.width, rect.height)`, `camera.aspect = rect.height > 0 ? rect.width / rect.height : 1`, then `camera.updateProjectionMatrix()`. The attach call remains a direct, non-debounced call.
- **`session.ts` — debounced resize.** `env.resize` emissions now clear any pending timer and schedule `applyViewport` with `setTimeout(..., RESIZE_DEBOUNCE_MS = 16)` (trailing). No synchronous apply. The timer callback is guarded by `active`; teardown clears the timer.
- **`session.ts` — orientation.** `env.orientation` (when present) is subscribed in `attach`; each emission clears the pending resize timer and applies `applyViewport()` immediately. Teardown pushes the unsubscribe through the existing `unsubscribers` list, so both sources unsubscribe exactly once.
- **`browser-env.ts` — orientation source.** `window.addEventListener('orientationchange', handler)` with a teardown that removes the exact handler; module header updated. No renderer/scene/backend changes; no new dependencies.
- **`session.test.ts`.** Fake orientation source added to the injected environment; existing resize/visibility suite updated with fake timers; new debounce, orientation, teardown and AC-11 touch-gating cases. No gating logic changed (no real gap found).

## Tests added / updated (concrete values only)

New:
- `resize and visibility > coalesces a burst of resize emissions into one trailing apply (AC-8)` — first timer at 16 ms is cleared by a second emission at 10 ms; no call at 25 ms, one `setSize:1280:720` at 26 ms.
- `resize and visibility > applies an orientation change synchronously and clears the pending resize (AC-8)` — orientation applies `setSize:600:800` immediately and `aspect 0.75`; advancing 16 ms after it produces no duplicate call.
- `resize and visibility > cancels a pending debounced resize on teardown (AC-8)` — one queued timer, `dispose()` drops it to 0, no adapter call after 16 ms, resize + orientation unsubscribe each once.
- `multiplayer spectate > gates touch taps and drags exactly like mouse during travel and view-only (AC-11)` — touch events carry `pointerType: 'touch'`; travel and view-only yield zero clicks/orientation changes/wire sends; the same touch tap explodes `front:2:2` at home.

Updated:
- `attach > sizes the renderer from the container rect and the capped pixel ratio (AC-6, AC-7)` — dpr 3 → `setPixelRatio:2`, rect 800×600 → `setSize:800:600`, first-frame `camera.aspect === 4/3`, `vi.getTimerCount() === 0` (attach is direct).
- `attach > keeps a square projection on an empty rect` — 0×0 rect → `setSize:0:0`, `camera.aspect === 1`.
- `attach > is idempotent...` — added `orientation.subscribeCount() === 1`.
- `resize and visibility > re-applies size, capped pixel ratio and camera projection on the injected resize (AC-6, AC-7)` — fake timers prove no synchronous call, no call at 15 ms, the call at 16 ms, and the refreshed aspect drives the next pick (`front:2:3`).
- `pointer wiring > maps taps and drags to the events each phase allows...` — travel now also sends touch tap/drag; still `events === [{ introSkip }]`.
- `dispose > cancels the frame, releases everything exactly once...` — added `orientation.unsubscribeCount() === 1`.

## Evidence

### `npm run lint`

```
> lint
> eslint .
```

Exit code 0.

### `npm run typecheck --workspace @cubeclicker/frontend`

```
> typecheck
> tsc --noEmit
```

Exit code 0.

### `npm test --workspace @cubeclicker/frontend`

```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/render/webgl.test.ts (5 tests) 7ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/ws/connection.test.ts (10 tests) 12ms
 ✓ src/multiplayer/server-state.test.ts (40 tests) 15ms
 ✓ src/browser-env.test.ts (6 tests) 16ms
 ✓ src/game/progression.test.ts (10 tests) 12ms
 ✓ src/game/effects.test.ts (28 tests) 14ms
 ✓ src/game/rotation.test.ts (15 tests) 6ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 11ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 12ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 20ms
 ✓ src/render/particles.test.ts (19 tests) 15ms
 ✓ src/game/board.test.ts (18 tests) 26ms
 ✓ src/render/starfield.test.ts (15 tests) 63ms
 ✓ src/input/keyboard.test.ts (13 tests) 9ms
 ✓ src/ui/Hud.test.tsx (3 tests) 13ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/input/gestures.test.ts (21 tests) 11ms
 ✓ src/render/cube-view.test.ts (32 tests) 60ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 8ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 12ms
 ✓ src/game/engine.test.ts (71 tests) 56ms
 ✓ src/render/picking.test.ts (12 tests) 28ms
 ✓ src/render/world.test.ts (27 tests) 70ms
 ✓ src/App.test.tsx (9 tests) 19ms
 ✓ src/render/scene.test.ts (69 tests) 139ms
 ✓ src/game/session.test.ts (52 tests) 127ms

 Test Files  28 passed (28)
      Tests  646 passed (646)
   Start at  11:52:50
   Duration  804ms (transform 2.88s, setup 0ms, collect 7.79s, tests 806ms, environment 5ms, prepare 2.87s)
```

Exit code 0. (Baseline before T2: 642 tests; +4 new tests.)

### `npm run coverage --workspace @cubeclicker/frontend`

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.81 |    96.54 |   96.94 |   95.81 |                   
 src               |   96.74 |      100 |   92.85 |   96.74 |                   
  App.tsx          |     100 |      100 |     100 |     100 |                   
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/game          |   95.15 |    95.29 |   98.36 |   95.15 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.66 |    98.67 |     100 |   99.66 | 814-815           
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |    89.5 |    89.95 |   95.83 |    89.5 | ...75-976,989-990 
  types.ts         |     100 |      100 |     100 |     100 |                   
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.25 |     97.6 |    93.1 |   92.25 |                   
  protocol.ts      |   82.78 |    97.58 |   78.94 |   82.78 | ...82-593,597-607 
  server-state.ts  |   98.22 |    95.18 |     100 |   98.22 | ...14,293,295-296 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |     100 |      100 |     100 |     100 |                   
 src/render        |   99.45 |    97.08 |     100 |   99.45 |                   
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  scene.ts         |   99.54 |    98.38 |     100 |   99.54 | 757-758           
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   89.34 |      100 |  66.66 |   89.34 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  UserPanel.tsx    |   90.74 |      100 |   33.33 |   90.74 | 59-60,82-84       
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

Exit code 0. Thresholds ≥ 80 statements/branches/functions/lines are met; no exclusions or threshold changes.
`browser-env.ts` lines 69-72 are the new `orientationchange` subscribe body (see Deviations).

### `npm run build --workspace @cubeclicker/frontend` (extra, not in T2 verify)

```
> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 58 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.42 kB │ gzip:   0.28 kB
dist/assets/index-By00Pcz7.css    3.43 kB │ gzip:   1.03 kB
dist/assets/index-B2qSK0ym.js   800.59 kB │ gzip: 217.81 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.27s
```

Exit code 0 (chunk-size warning predates T2 and is unchanged).

## Acceptance audit

- **AC-6 — Resize updates renderer → met.** `applyViewport` calls `setPixelRatio(min(devicePixelRatio(), PIXEL_RATIO_CAP))` (cap 2), then `setSize(rect.width, rect.height)` from `target.getBoundingClientRect()`. Evidence: attach test dpr 3 → `setPixelRatio:2` + `setSize:800:600`; resize test 1600×800 → 800×800; empty-rect test `setSize:0:0`.
- **AC-7 — Camera aspect follows size → met.** `camera.aspect = rect.height > 0 ? rect.width / rect.height : 1` followed by `updateProjectionMatrix()`. Evidence: aspect `4/3`, `1`, `0.75` assertions and the post-resize pick on `front:2:3` (which reads the refreshed projection matrix).
- **AC-8 — Debounced resize → met.** No synchronous apply on a resize emission; trailing timer is 16 ms and coalesces bursts; attach apply is direct (`vi.getTimerCount() === 0`); orientation applies synchronously and clears the pending timer; teardown clears the timer and unsubscribes both sources. All cases exercised with fake timers.
- **AC-11 — No conflict with spectating travel → met.** Touch events (`pointerType: 'touch'`) during spectate travel and view-only dispatch nothing observable: same snapshot identity, 0 clicks, 0 orientation steps, no wire sends; the same touch tap explodes at home. The injected-engine test additionally proves the travel phase drops touch tap/drag before any dispatch. No gating logic was changed; no real gap found.

## Deviations from spec

- **`screen.orientation 'change'` not wired.** The plan mentions it as an optional extra signal; T2 pins the `window 'orientationchange'` listener, which is what `browser-env.ts` now implements. `orientationchange` fires on the rotation transition and the session applies the final box synchronously, which satisfies AC-8.
- **Documented testing exception:** `browser-env.ts`'s orientation listener has no direct unit test because `src/frontend/src/browser-env.test.ts` is outside T2's `files_owned`. The session↔source contract is covered with the injected fake orientation source in `session.test.ts`; the browser listener itself is the remaining uncovered block (`browser-env.ts:69-72`, coverage still 91.66% for that file and 95.81% aggregate).

## Open questions

- Should a follow-up add the `browser-env.ts` orientation-listener unit test in `browser-env.test.ts` (out of T2 scope), and/or wire `screen.orientation 'change'` as a second signal? Neither blocks T2 acceptance.

## Definition-of-Done self-audit

- Task acceptance met with evidence — yes (above).
- Verify commands pass — yes (lint, typecheck, test, coverage; build also green).
- Unit + integration tests — integration (`session.test.ts`, real engine + scene, injected environment) updated/added; browser-env unit test documented as out-of-scope exception above.
- Coverage gate green — yes (95.81 / 96.54 / 96.94 / 95.81).
- Concrete assertions only — yes; no wildcard/snapshot-only/assertion-free matchers.
- No useless tests — each new test pins timing, call order, exact size/aspect, or a gate outcome.
- No out-of-scope edits — yes; `render/scene.ts`, UI files and backend untouched.
