# Frontend rendering

The CubeClicker frontend renders a client-local three.js scene behind a narrow `RendererAdapter`; a single session-owned `requestAnimationFrame` loop drives simulation, scene updates and rendering. The pure quality policy in [`quality.ts`](../../src/frontend/src/render/quality.ts) is the single source of the tier's visual matrix. This document is the architecture reference for that runtime; the feature that produced it is [adaptive-render-budget-v2](../features/adaptive-render-budget-v2/spec.md), and the application stack is pinned in [stack.md](stack.md).

## Renderer lifecycle

**Gate-deferred attach.** [`App.tsx`](../../src/frontend/src/App.tsx) renders [`GameCanvas`](../../src/frontend/src/ui/GameCanvas.tsx) with `active={gateState.view === 'closed'}`. The `<canvas>` element stays mounted while the auth menu is open — its SSR markup (`tabIndex`, `aria-label`, inline `touch-action`) is unchanged — but the effect returns early while `active` is `false`: no renderer, scene, listener or scheduled frame exists before the gate closes. The page background shows behind the menu. `Play as guest` and a verified login close the gate; registration/pending verification and `Back to login` keep it open.

**Attach.** When `active` becomes `true`, the effect calls `session.attach(canvas)` and returns `session.dispose()` as cleanup. `attach` is idempotent (`if (active) return`). It creates the scene view, obtains the adapter from the injected environment (production: `createRealisticRenderer` in [`browser-env.ts`](../../src/frontend/src/browser-env.ts)), pushes the starting tier with `adapter.setQuality(view.getQualityTier())` **before** the first `applyViewport()`, applies the viewport, registers the five pointer handlers plus the window key handler, subscribes motion/visibility/resize/orientation, subscribes `transport.onMessage`/`onStatus` **before** calling `transport.connect()`, and schedules exactly one frame.

**Detached retry (login path).** While detached, `session.retryConnection()` is status-only: it publishes `connecting` and clears `welcomed` but does not call `transport.close()`/`connect()`. The attach-time `connect()` opens exactly one socket, after the login has set the current session cookie; because the attach-time subscriptions are registered first, the welcome cannot be missed. `join(mode)` before attach records `lastMode` in the transport and is sent on the attach-time `hello`.

**Hidden-tab suspension.** `scheduleFrame()` is a no-op while the session's hidden flag (initialized from `env.visibility.isHidden()` at attach) is true, and becoming hidden cancels the pending frame. Attaching while hidden creates the renderer/scene but schedules no frame. Becoming visible resets `frameBaselineMs` to `env.now()` (no time jump) and schedules exactly one frame.

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

## Verification

**Automated.** The rendering contract is enforced by the repository commands (also listed in [stack.md](stack.md) and the root [README](../../README.md)):

```bash
npm run lint
npm run typecheck
npm test
npm run coverage   # thresholds >= 80 statements/branches/functions/lines per workspace
npm run build
```

Frontend-only pre-gate: `npm run test --workspace @cubeclicker/frontend` and `npm run coverage --workspace @cubeclicker/frontend`. The suites pin the behavior at concrete values: `quality.test.ts` (GPU matrix and constants, reduced-motion invariance, sorted-window exactness, the 10,000-push `Array.prototype.sort` throw-spy, the pinned 60×30/60×10/60×10 stream), `postprocessing.test.ts` (exact pass lists and SSAO/bloom parameters per tier, dispose-once), `webgl.test.ts` (high/medium/low adapter behavior, composer rebuild/replay, render-after-dispose, the production-adapter contract), `scene.test.ts` (shadow pass and map-size transitions), `session.test.ts` (attach-time `setQuality` before `setSize`, same-frame `setQuality → setPixelRatio → render`, detached retry/welcome, hidden-at-attach, dispose/re-attach, context loss), `GameCanvas.test.tsx` (no attach before `active`; attach/dispose counts across cycles and remounts) and `App.test.tsx` (guest, verified-login, registration-pending and initially-closed attach counts and order).

**Containerized manual pass.** Start the unchanged local environment with `podman compose up` and open http://localhost:5173; the recipe and expected observations are in the [adaptive-render-budget-v2 plan § Verification](../features/adaptive-render-budget-v2/plan.md#verification). It covers (1) high-tier visual parity at 1280×720 and 1920×1080 (SSAO contact shading, bloom glow, the soft 2048 shadow edge, cursor material), (2) gate deferral in the network panel — no `/ws` socket while the auth menu is open, one socket after guest/login, none while verification is pending, with the intro starting at gate close, (3) graceful degradation under DevTools CPU throttling (6× then 4×) to the bloom-only medium look and the plain low look with no shadows, confirming the backing-store ratio follows `min(devicePixelRatio, 1.5)` then `min(devicePixelRatio, 1)`, clicks and HUD staying responsive, and recovery to high after throttling stops, and (4) lifecycle probes — resize during the menu, tab switch during play (frames resume without a time jump), and a reload/gate repeat. The per-step results are recorded in [build-log-T5.md](../features/adaptive-render-budget-v2/build-log-T5.md); the manual pass is human-visible evidence and never substitutes for the automated tier tests. No `npm run smoke` gate applies to this client-only rendering change.
