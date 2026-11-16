# Frontend rendering

The CubeClicker frontend renders a client-local three.js scene behind a narrow `RendererAdapter`; a single session-owned `requestAnimationFrame` loop drives simulation, scene updates and rendering. The pure quality policy in [`quality.ts`](../../src/frontend/src/render/quality.ts) is the single source of the tier's visual matrix. This document is the architecture reference for that runtime; the feature that produced it is [adaptive-render-budget-v2](../features/adaptive-render-budget-v2/spec.md), and the application stack is pinned in [stack.md](stack.md).

## Renderer lifecycle

**Gate-deferred attach.** [`App.tsx`](../../src/frontend/src/App.tsx) renders [`GameCanvas`](../../src/frontend/src/ui/GameCanvas.tsx) with `active={gateState.view === 'closed'}`. The `<canvas>` element stays mounted while the auth menu is open — its SSR markup (`tabIndex`, `aria-label`, inline `touch-action`) is unchanged — but the effect returns early while `active` is `false`: no renderer, scene, listener or scheduled frame exists before the gate closes. The page background shows behind the menu. `Play as guest` and a verified login close the gate; registration/pending verification and `Back to login` keep it open.

**Attach.** When `active` becomes `true`, the effect calls `session.attach(canvas)` and returns `session.dispose()` as cleanup. `attach` is idempotent (`if (active) return`). It creates the scene view, obtains the adapter from the injected environment (production: `createRealisticRenderer` in [`browser-env.ts`](../../src/frontend/src/browser-env.ts)), pushes the starting tier with `adapter.setQuality(view.getQualityTier())` **before** the first `applyViewport()`, applies the viewport, registers the five pointer handlers plus the window key handler, subscribes motion/visibility/resize/orientation and the page-lifecycle `pagehide` source, starts the session's activity-expiry interval, subscribes `transport.onMessage`/`onStatus` **before** calling `transport.connect()`, and schedules exactly one frame.

**Detached retry (login path).** While detached, `session.retryConnection()` is status-only: it publishes `connecting` and clears `welcomed` but does not call `transport.close()`/`connect()`. The attach-time `connect()` opens exactly one socket, after the login has set the current session cookie; because the attach-time subscriptions are registered first, the welcome cannot be missed. `join(mode)` before attach records `lastMode` in the transport and is sent on the attach-time `hello`.

**Hidden-tab suspension.** `scheduleFrame()` is a no-op while the session's hidden flag (initialized from `env.visibility.isHidden()` at attach) is true, and becoming hidden cancels the pending frame. Attaching while hidden creates the renderer/scene but schedules no frame. Becoming visible resets `frameBaselineMs` to `env.now()` (no time jump) and schedules exactly one frame.

**Page-lifecycle leave.** The browser environment exposes an optional `pageLifecycle` source ([`browser-env.ts`](../../src/frontend/src/browser-env.ts)) that subscribes to the window's `pagehide` and forwards `event.persisted === true`; the session subscribes while attached and unsubscribes in `dispose()`. A non-bfcache `pagehide` while the session is welcomed and connected sends exactly one additive `{ "type": "leave" }` through the transport, so the hub finalizes the member immediately instead of starting the reconnect grace. The send is exception-safe: a CLOSING/CLOSED socket can throw from `WebSocket.send`, and the handler swallows the error without sending another frame or skipping teardown. A bfcache `pagehide` (`persisted === true`), a tab switch, a dropped socket and `dispose()` (StrictMode/remount or route teardown) send nothing, so a remount inside the grace reconnects with the token.

**Activity display expiry.** Activity lines are temporal. Every world reduction (`welcome`, `worldEntered`, `activityEvent`, `leaderboardUpdate`, any frame) and the travel-midpoint `applyWorldSwap` run observe → synchronous `pruneActivity` → publish, so an event past its receipt-anchored five-second deadline (or a tombstoned `serverId:id` key) never reaches the published feed. One session-owned `setInterval(pruneExpiredActivity, ACTIVITY_EXPIRY_TICK_MS)` per attach cycle, with `ACTIVITY_EXPIRY_TICK_MS = 250` in [`activity-lifetime.ts`](../../src/frontend/src/multiplayer/activity-lifetime.ts), is only the fallback for time passing with no reduction: a line is pruned at the first tick at or after its deadline. Becoming visible prunes immediately before the next scheduled frame, and `dispose()` clears the interval so no callback, publish or state change follows teardown.

**Dispose and re-attach.** `dispose()` is idempotent; it cancels the pending frame and resize timer, removes every listener, unsubscribes every environment and transport subscription, closes the transport, then disposes the adapter and the scene view (teardown order). A frame callback that escapes `cancel` after dispose performs no render (`if (!active) return`). A later `attach()` builds a fresh adapter/scene pair and schedules exactly one frame; `active: true → false → true` disposes once and attaches once more, and the StrictMode-like mount → unmount → remount path ends with attach `2`, dispose `1`.

**Resize and context loss.** A resize emitted while detached is ignored (`onResize` early-returns); after attach the resize handler coalesces bursts into one debounced `applyViewport()`, and orientation changes apply immediately. Context loss uses three.js's built-in restore path: the session adds no `webglcontextlost`/`webglcontextrestored` listener of its own (its canvas listeners remain the five pointer handlers), so a synthetic loss/restore during the intro neither throws nor changes the frame count.

## Quality tier budget

The tier is selected automatically from frame times; there is no user-facing quality setting. `qualityFeatures(tier, reducedMotion)` is the single source of the matrix, and the GPU fields below are **identical** for `reducedMotion` true and false — reduced motion governs motion only and never changes static GPU cost.

| Tier | `ssao` | `bloom` | `shadowMapSize` | `pixelRatioCap` | Composer pass list | Shadows |
| --- | --- | --- | --- | --- | --- | --- |
| high | `true` | `true` | `2048` | `2` | `RenderPass → SSAOPass → UnrealBloomPass → OutputPass` | enabled, `castShadow = true`, 2048² |
| medium | `false` | `true` | `1024` | `1.5` | `RenderPass → UnrealBloomPass → OutputPass` | enabled, `castShadow = true`, 1024² |
| low | `false` | `false` | `0` | `1` | none — plain `renderer.render(scene, camera)` | disabled, `castShadow = false`, no map |

- **Constants.** `QUALITY_SHADOW_MAP_SIZES = { high: 2048, medium: 1024, low: 0 }`; `QUALITY_PIXEL_RATIO_CAPS = { high: 2, medium: 1.5, low: 1 }`. The high shadow size equals the scene's exported `KEY_SHADOW_MAP_SIZE` (which now derives from `QUALITY_SHADOW_MAP_SIZES.high`), and the high DPR cap reuses `PIXEL_RATIO_CAP` from `game/effects.ts`, so the tier ladder and the accepted high-tier look cannot drift. High remains the acceptance tier and is visually identical to the pre-tier renderer.
- **Reduced motion.** The GPU fields never change; the existing motion fields (`reticle`, `trail`, `cursorMotion`, `impactShards`, `sparks`, `explosionFlash`, `explosionEmbers`, `explosionSmoke`, `shotFx`, `bannerMotion`) are disabled by reduced motion, and `coinPopup` stays at every tier.
- **Adapter ([`webgl.ts`](../../src/frontend/src/render/webgl.ts)).** `createRealisticRenderer` starts at high and lazily builds the composer on the first render. `setQuality(next)` is a no-op for the same tier; on a change it toggles `renderer.shadowMap.enabled` (`next !== 'low'`) and disposes any existing composer exactly once. The next render rebuilds the composer for the new tier (from [`postprocessing.ts`](../../src/frontend/src/render/postprocessing.ts)) and replays the last forwarded size and pixel ratio once. Low never constructs a composer: each render is exactly one `renderer.render(scene, camera)`. `dispose()` releases the composer and the base renderer; render after dispose is a no-op. The plain `createWebGLRenderer` keeps `shadowMap.enabled = true` and has a no-op `setQuality`.
- **Scene shadows ([`scene.ts`](../../src/frontend/src/render/scene.ts)).** `applyQuality()` sets `keyLight.castShadow = shadowMapSize > 0`; when the size changes it disposes and nulls `keyLight.shadow.map` before setting `mapSize` (three.js only reallocates after the old map is released). At low the previous map is deliberately not resampled — the shadow pass is disabled. `KEY_SHADOW_BIAS`, `KEY_SHADOW_NORMAL_BIAS` and `KEY_SHADOW_RADIUS` are unchanged at every tier.
- **DPR.** `applyViewport()` sets `adapter.setPixelRatio(Math.min(env.devicePixelRatio(), QUALITY_PIXEL_RATIO_CAPS[tier]))` and then `adapter.setSize(rect.width, rect.height)`; a resize or orientation change re-applies the live tier's cap, and a tier change re-applies it in the same frame before the render.
- **Policy ([`quality.ts`](../../src/frontend/src/render/quality.ts)).** The policy starts at high, keeps a 120-frame live window, makes no decision before 60 samples, and maintains a sorted view of the window by binary insertion and one-occurrence removal on eviction, so `getP95FrameMs()` is the exact nearest-rank p95 without copying or sorting per frame.

| Transition | Condition | Sustained | Cooldown |
| --- | --- | --- | --- |
| high → medium | `avg > 18.0` or `p95 > 24.0` ms | 60 frames | 1000 ms |
| medium → low | `avg > 20.0` or `p95 > 28.0` ms | 60 frames | 1000 ms |
| medium → high | `avg <= 16.0` and `p95 <= 20.0` ms | 180 frames | 3000 ms |
| low → medium | `avg <= 17.0` and `p95 <= 22.0` ms | 240 frames | 3000 ms |

At most one tier change happens per frame/decision; frame times are clamped into `(0, 250]` ms. The forced-tier seam `view.setQualityTierForTesting(tier)` exists for tests only.

## Frame loop

The session owns the only `requestAnimationFrame` loop; the scheduler is injected (`createRafScheduler` wraps `requestAnimationFrame` in production). One frame of [`session.ts`](../../src/frontend/src/game/session.ts) runs in this order:

1. **Simulation.** Measure `dtMs` from the previous frame baseline (never negative), advance the engine when `canRun()`, and handle level swaps/travel arrivals.
2. **Intents and hover.** `view.applyIntents(engine.drainIntents(), nowMs)`; when playing, resolve the hovered front-face mini-cube for the current pointer position.
3. **`view.applySnapshot(snapshot, nowMs)`.** Push the authoritative engine snapshot into the scene.
4. **`view.update(dtMs)`.** Push the frame time into the quality policy (the sorted-window p95 update) and apply the current tier's scene features and shadow budget.
5. **Tier poll.** `const tier = view.getQualityTier()`; only when `tier !== appliedTier`: set `appliedTier`, call `adapter.setQuality(tier)`, then `applyViewport()` to re-cap DPR and re-apply the size.
6. **`adapter.render(view.scene, view.camera)`.** Composer render at high/medium; the single base renderer render at low.
7. **Publish and reschedule.** Publish the snapshot/multiplayer views, then `scheduleFrame()` for the next frame.

`appliedTier` is seeded at attach (after the attach-time `setQuality`), so the first frame adds no call and stable-tier frames add neither `setQuality` nor a pixel-ratio apply. Because the tier poll and DPR re-apply happen before step 6, a tier change takes effect in the same frame it is observed.

## Loading and code splitting

**Three-free entry.** The built `index.html` loads one entry chunk plus the `react` vendor chunk; the entry contains the app shell, the auth/HUD UI, the DOM-free game engine, and the session core, and no three.js. [`session.ts`](../../src/frontend/src/game/session.ts) refers to the scene and picking APIs through type-only imports, and the Three-touching functions (`createSceneView`, `pickHoverTarget`, `pickMiniCube`) arrive through `SessionEnvironment.renderRuntime`, supplied by [`browser-env.ts`](../../src/frontend/src/browser-env.ts). [`vite.config.ts`](../../src/frontend/vite.config.ts) pins function-form `manualChunks` named `three` and `react`, so the Three.js vendor code lives in one shared chunk and cannot silently merge back into the entry; the shell loads the entry and preloads only the React chunk.

**Gate-close runtime load.** While `gateState.view === 'menu'`, [`GameCanvas`](../../src/frontend/src/ui/GameCanvas.tsx) does not call `session.attach` and no environment import happens. When the gate closes, the effect calls `session.attach(canvas)`; without an injected environment the session sets its runtime status to `loading`, dynamically imports `../browser-env`, and runs the existing start body once the import resolves (status `ready`). The loader runs before the start body and never calls `engine.advance`; `frameBaselineMs` is set at runtime start, so the loader's elapsed time is skipped and the intro still begins at gate close (§ Renderer lifecycle). `GameCanvas` renders `Loading the game…` with `role="status"` while loading; on rejection it renders `The game could not be loaded.` with `role="alert"` and a `Try again` button that calls `session.attach(canvas)` again, and a resolved retry removes the alert. The `<canvas>` element and its SSR markup are unchanged in every state. An attach-generation token drops a resolution after `dispose()` and the StrictMode-shaped mount → unmount → remount first load (two loader calls, one start).

**Deferred customization preview.** [`App`](../../src/frontend/src/App.tsx) renders [`DeferredSpaceshipCustomizationPanel`](../../src/frontend/src/ui/DeferredSpaceshipCustomizationPanel.tsx), which dynamically imports the panel (`SpaceshipCustomizationPanel → SpaceshipPreview → render/preview → three`) only when the customization toggle opens. Pending renders `Loading customization…` with `role="status"`; a rejection renders `Customization could not be loaded.` with `role="alert"` and a `Try again` button that retries the import; the resolved panel keeps the existing `.customization-panel` and `Open lootbox` controls.

**Chunk graph.** The expected post-split graph is:

```text
index.html
  └─ assets/index-<hash>.js                            entry: app shell, auth/HUD, engine, session core
       ├─ static: assets/react-<hash>.js               react, react-dom, scheduler
       └─ dynamic:
            ├─ assets/browser-env-<hash>.js            game runtime: browser env, scene, picking
            ├─ assets/SpaceshipCustomizationPanel-<hash>.js   customization preview
            └─ assets/cursor-ship-<hash>.js            pointer-ship visuals (shared by both)
                 every dynamic chunk statically imports assets/three-<hash>.js;
                 the entry closure never does
```

**Bundle-budget gate.** `src/frontend/package.json` chains `vite build` with `node scripts/check-bundle-budget.mjs` ([`check-bundle-budget.mjs`](../../src/frontend/scripts/check-bundle-budget.mjs)). The script reads `dist/.vite/manifest.json`, builds the initial closure from the entry's recursive static `imports` only (never `dynamicImports`), gzip-measures every manifest JS file at level 6, writes `dist/bundle-report.json`, and exits 1 when `initial.gzipBytes > 150000`, `three.gzipBytes > 165000`, `total.gzipBytes > 300000`, no `three` chunk exists, or `three.file` is in `initial.files`. The root build, CI's Build step, and the frontend Docker `build` stage inherit the exit code. The fresh T3 build measured the entry at 26,947 B gzip, initial `[index, react]` at 95,903 B, the three chunk at 154,323 B, and the total at 273,854 B, against the approved 150,000 / 165,000 / 300,000 B ceilings.

## Verification

**Automated.** The rendering contract is enforced by the repository commands (also listed in [stack.md](stack.md) and the root [README](../../README.md)):

```bash
npm run lint
npm run typecheck
npm test
npm run coverage   # thresholds >= 80 statements/branches/functions/lines per workspace
npm run build      # fresh Vite build + bundle-budget gate
npm run smoke      # containerized production static-delivery proof
```

Frontend-only pre-gate: `npm run test --workspace @cubeclicker/frontend` and `npm run coverage --workspace @cubeclicker/frontend`. The suites pin the behavior at concrete values: `quality.test.ts` (GPU matrix and constants, reduced-motion invariance, sorted-window exactness, the 10,000-push `Array.prototype.sort` throw-spy, the pinned 60×30/60×10/60×10 stream), `postprocessing.test.ts` (exact pass lists and SSAO/bloom parameters per tier, dispose-once), `webgl.test.ts` (high/medium/low adapter behavior, composer rebuild/replay, render-after-dispose, the production-adapter contract), `scene.test.ts` (shadow pass and map-size transitions), `session.test.ts` (attach-time `setQuality` before `setSize`, same-frame `setQuality → setPixelRatio → render`, detached retry/welcome, hidden-at-attach, dispose/re-attach, context loss), `GameCanvas.test.tsx` (no attach before `active`; attach/dispose counts across cycles and remounts) and `App.test.tsx` (guest, verified-login, registration-pending and initially-closed attach counts and order). The code-splitting contract adds `session.test.ts` (deferred loader, retry, StrictMode cancellation, intro-clock anchor), `GameCanvas.runtime.test.tsx` (loading/ready/error/retry with the canvas always mounted), `DeferredSpaceshipCustomizationPanel.test.tsx` (loading/resolved/rejected/retry), `bundle-budget.test.ts` (initial closure and every violation), `vite-config.test.ts` (manifest, warning limit, manual chunks) and `nginx-config.test.ts` (gzip directives, the cache-header locations, the absence of a brotli directive).

**Containerized manual pass.** Start the unchanged local environment with `podman compose up` and open http://localhost:5173; the recipe and expected observations are in the [adaptive-render-budget-v2 plan § Verification](../features/adaptive-render-budget-v2/plan.md#verification). It covers (1) high-tier visual parity at 1280×720 and 1920×1080 (SSAO contact shading, bloom glow, the soft 2048 shadow edge, cursor material), (2) gate deferral in the network panel — no `/ws` socket while the auth menu is open, one socket after guest/login, none while verification is pending, with the intro starting at gate close, (3) graceful degradation under DevTools CPU throttling (6× then 4×) to the bloom-only medium look and the plain low look with no shadows, confirming the backing-store ratio follows `min(devicePixelRatio, 1.5)` then `min(devicePixelRatio, 1)`, clicks and HUD staying responsive, and recovery to high after throttling stops, and (4) lifecycle probes — resize during the menu, tab switch during play (frames resume without a time jump), and a reload/gate repeat. The per-step results are recorded in [build-log-T5.md](../features/adaptive-render-budget-v2/build-log-T5.md); the manual pass is human-visible evidence and never substitutes for the automated tier tests. `npm run smoke` proves the production static-delivery path — gzip, the immutable/no-cache header matrix, and the served chunk graph from `/bundle-report.json` — not the tier policy or the rendering-behavior contract above, which stay covered by the automated suites.
