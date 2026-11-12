---
feature: adaptive-render-budget-v2
revision: 3
---
# Plan — Adaptive Render Budget v2

## Architecture

Three client-local changes, each behind an existing seam:

1. **Gate-deferred runtime (UI → session).** `GameCanvas` gains an `active` prop. Its effect does nothing while `active === false`; when `active` becomes `true` it calls the existing `session.attach(canvas)` and returns the existing `session.dispose()` cleanup. `App` passes `active={gateState.view === 'closed'}`. The canvas element stays mounted, so layout and SSR markup are unchanged; only renderer/scene creation, the rAF loop, and the transport connect move to after the gate closes. No new session lifecycle method is introduced; `attach`/`dispose` remain idempotent and re-attachable. `active: true → false → true` disposes on the close and attaches fresh on the reopen; a StrictMode mount/unmount/remount follows the same effect path (2 attaches, 1 dispose). Logout does not reopen the gate (it is not wired to it), so this sequence is a defensive contract, not a production flow.
2. **GPU tier budget (policy → adapter → scene).** `render/quality.ts` remains the single source of the visual matrix. `QualityFeatures` gains `ssao`, `bloom`, `shadowMapSize`, `pixelRatioCap`. `render/postprocessing.ts` builds passes from an explicit tier; `render/webgl.ts` owns the tier-aware adapter (composer vs plain renderer, shadow-map enable/disable) and rebuilds the composer on tier change. `render/scene.ts` applies the light/shadow side (map size, `castShadow`). `game/session.ts` polls the scene tier once per frame, forwards it to the adapter, and applies the tier DPR cap.
3. **Sorted p95 (pure policy).** `render/quality.ts` keeps the insertion-order window (for eviction and average) plus a sorted array maintained by binary insertion; evicting the oldest removes one occurrence from the sorted array. No per-frame copy/sort. Semantics are unchanged.

### Data flow

```
App (useSyncExternalStore gate)
  └─ gateState.view === 'closed' ──► GameCanvas.active
        └─ effect ──► session.attach(canvas)
              ├─ createSceneView()  (quality policy starts 'high')
              ├─ rendererFactory(canvas) ──► RendererAdapter
              ├─ adapter.setQuality(view.getQualityTier())   // before first setSize
              ├─ applyViewport(): setPixelRatio(min(dpr, cap(tier))), setSize(rect)
              └─ scheduleFrame()

frame:
  engine.advance → applyIntents → applySnapshot
  view.update(dt)              // qualityPolicy.pushFrameTime; scene applies shadow budget
  tier = view.getQualityTier()
  if tier changed: adapter.setQuality(tier); applyViewport()   // same frame, before render
  adapter.render(scene, camera)
  scheduleFrame()
```

### Tier matrix (pinned)

| Tier | Composer passes | Shadows | Key-light map | DPR cap | Existing CPU matrix |
| --- | --- | --- | --- | --- | --- |
| high | `RenderPass → SSAOPass → UnrealBloomPass → OutputPass` | enabled, `castShadow = true` | 2048² | 2 | unchanged (21 meshes, 14 shards, 24 sparks, full impact/shot FX) |
| medium | `RenderPass → UnrealBloomPass → OutputPass` | enabled, `castShadow = true` | 1024² | 1.5 | unchanged (17 meshes, 7 shards, 12 sparks) |
| low | none — `renderer.render(scene, camera)` | disabled, `castShadow = false` | none | 1 | unchanged (15 meshes, 0 shards/sparks/impact/shot FX) |

SSAO constants (`0.5 / 0.005 / 0.1`), bloom constants (`0.45 / 0.4 / 0.85`), `ACESFilmicToneMapping`, exposure `1.0`, `SRGBColorSpace`, and `PCFSoftShadowMap` are unchanged at every tier. `reducedMotion` does not touch any GPU field (none is motion); it still disables the existing motion layers exactly as AC-52 pins.

## Interfaces / contracts

```ts
// render/quality.ts (new fields; existing fields unchanged)
export interface QualityFeatures {
  // …existing fields (tier, reticle, trail, cursorMotion, hiddenCursorMeshes,
  // cursorMeshCount, impactShards, sparks, explosionFlash, explosionEmbers,
  // explosionSmoke, shotFx, coinPopup, bannerMotion)…
  readonly ssao: boolean;
  readonly bloom: boolean;
  /** 2048 | 1024 | 0 (0 = no shadow pass). */
  readonly shadowMapSize: number;
  /** External DPR ceiling: 2 | 1.5 | 1. */
  readonly pixelRatioCap: number;
}

export const QUALITY_SHADOW_MAP_SIZES: Readonly<Record<QualityTier, number>>;
export const QUALITY_PIXEL_RATIO_CAPS: Readonly<Record<QualityTier, number>>;

// game/session.ts
export interface RendererAdapter {
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  /** Applies the tier's GPU budget; idempotent for the current tier. */
  setQuality(tier: QualityTier): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

// render/postprocessing.ts
export function createPostprocessing(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  tier: QualityTier,
): Postprocessing;
// high: RenderPass, SSAOPass, UnrealBloomPass, OutputPass
// medium: RenderPass, UnrealBloomPass, OutputPass
// low: not called by the adapter

// render/webgl.ts — factory signature unchanged; adapter adds setQuality
export function createRealisticRenderer(canvas: CanvasLike): RendererAdapter;
export function createWebGLRenderer(canvas: CanvasLike): RendererAdapter; // setQuality no-op
```

`RendererAdapter` imports `QualityTier` as a type from `render/quality` (type-only; `session.ts` already depends on `render/**`). `browser-env.ts` is untouched: `createRealisticRenderer` keeps its `(canvas) => RendererAdapter` shape, so its test pin `toHaveBeenCalledWith(canvas)` stays valid.

### Adapter internals

- `createRealisticRenderer(canvas)` keeps `buildBaseRenderer` (tone mapping, color space, `PCFSoftShadowMap`) and starts at `high`.
- State: `tier`, `composer: Postprocessing | null`, `lastWidth`, `lastHeight`, `lastRatio`, `disposed`.
- `setQuality(next)`: if `next === tier` return. Else `tier = next`; disable/enable `renderer.shadowMap.enabled = next !== 'low'`; if a composer exists, `composer.dispose()` and set it to `null` (rebuilt lazily on the next `render`). Size/ratio are retained, so the rebuilt composer receives them.
- `setSize`/`setPixelRatio`: always forward to the base renderer, store the last values, and forward to the composer when it exists.
- `render(scene, camera)`:
  - `disposed` → return.
  - `tier === 'low'` → `renderer.render(scene, camera)`; if a composer somehow exists, dispose it first (defensive; `setQuality` already does).
  - otherwise lazily `createPostprocessing(renderer, scene, camera, tier)`, replay last width/height/ratio once, then `composer.render()`.
- `dispose()`: dispose the composer if present, dispose the base renderer, set `disposed`, idempotent.
- `createWebGLRenderer` gains `setQuality(): void {}` (plain renderer has no post-processing/shadow policy of its own).

### Scene shadow application

`applyQuality()` (already deduplicated by `appliedQualityTier`/`appliedQualityReduced`) gains:

```ts
const shadowSize = features.shadowMapSize;      // 2048 | 1024 | 0
keyLight.castShadow = shadowSize > 0;
if (shadowSize > 0 && keyLight.shadow.mapSize.width !== shadowSize) {
  keyLight.shadow.map?.dispose();
  keyLight.shadow.map = null;                   // forces three to allocate the new size
  keyLight.shadow.mapSize.set(shadowSize, shadowSize);
}
```

Construction keeps `KEY_SHADOW_MAP_SIZE = 2048` (= `QUALITY_SHADOW_MAP_SIZES.high`) and `castShadow = true`; the first `applyQuality()` at high changes nothing, so existing scene pins hold. At low the map is left unallocated and the renderer skips the pass.

### Session frame-loop integration

- At attach, after `createSceneView` and `rendererFactory`: `adapter.setQuality(view.getQualityTier())`, then the existing `applyViewport()` (which now reads the tier cap).
- `applyViewport()` uses `Math.min(env.devicePixelRatio(), QUALITY_PIXEL_RATIO_CAPS[view.getQualityTier()])`.
- In `onFrame`, between `view.update(dtMs)` and `adapter.render(...)`:
  ```ts
  const tier = view.getQualityTier();
  if (tier !== appliedTier) {
    appliedTier = tier;
    adapter.setQuality(tier);
    applyViewport();          // re-caps DPR; no-op for the box itself
  }
  ```
  `appliedTier` is initialized in `attach` so the first frame adds no call.
- Resize/orientation still call `applyViewport()`; it uses the live tier, so a resize during a lower tier re-applies the lower cap.
- No change to hidden-tab suspension, pointer/keyboard listeners, transport subscription order, or teardown order. `teardown` already calls `adapter.dispose()` then `view.dispose()`.

### Deferred reconnect (pre-attach login)

`retryConnection()` today calls `transport.close(); transport.connect()` unconditionally. New rule:

```ts
function retryConnection(): void {
  if (transport === undefined) return;
  status = 'connecting';
  welcomed = false;
  publishMultiplayer();
  if (!active) return;        // detached: attach's connect() opens the socket with the current cookie
  transport.close();
  transport.connect();
}
```

`join(mode)` is unchanged: `transport.join` records `lastMode` before a socket exists (`transport.ts`), and the `hello` handler sends `join { mode: lastMode }` on the attach-time connection. `attach` keeps its existing `transport.connect()` call, and `attach` subscribes `transport.onMessage`/`onStatus` **before** `transport.connect` (`session.ts:1315-1319`), so the attach-time welcome cannot be missed. The auth gate still calls retry then join; only the pre-attach socket churn disappears. The regression test is `session.test.ts` → `'receives welcome after a detached retryConnection → join(account) → attach cycle'`: it records the handler registrations before connect, runs `retryConnection()` → `join('account')` → `attach(canvas)`, emits a valid `welcome`, and asserts the world's `serverId`, one connect, zero closes, and that the next frame advances the intro. The named test does **not** inspect cookies; the cookie-at-upgrade behavior is unchanged and is evidenced by the existing `ws/connection` path plus the manual containerized step 2 below (the socket opens only after the login, so the browser's current session cookie is on the upgrade request).

## P95 strategy

- Keep `window: number[]` in push order and `windowSum` (average stays O(1)).
- Add `sorted: number[]` maintained by binary insertion (`lowerBound`) on every accepted push.
- On eviction (`window.length > QUALITY_WINDOW_FRAMES`), shift the oldest value out of `window` and remove one occurrence from `sorted` (binary search + `splice`).
- `p95()` reads `sorted[Math.ceil(0.95 * sorted.length) - 1]` (same clamp as today). No copy, no sort.
- Complexity: O(n) per push for the splice (n ≤ 120) and no sort; the previous implementation was O(n log n) plus an O(n) copy every frame. `splice` returns a removed-elements array, so the implementation allocates a small array per eviction; the AC-11 goal is no per-frame sort, not zero allocation. A manual left-shift loop is an acceptable substitute if the reviewer prefers no `splice` return allocation.
- `getP95FrameMs()` and `getAverageFrameMs()` remain on-demand reads; `evaluate()` uses the same sorted value on the same push, so decision timing is identical (60th frame for a constant 30 ms stream).
- Rejected alternative: evaluate every K frames. It would change the pinned 60-frame streak timing (60 evaluations would span K×60 frames) and break AC-52's decision contract.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/render/quality.ts` | Edit | GPU budget fields/constants; sorted-window p95 |
| `src/frontend/src/render/quality.test.ts` | Edit | Exact matrix, sort-spy, equivalence, existing policy tests |
| `src/frontend/src/render/postprocessing.ts` | Edit | Tier-conditional pass list |
| `src/frontend/src/render/postprocessing.test.ts` | Edit | Pass list per tier, params, dispose |
| `src/frontend/src/render/webgl.ts` | Edit | `setQuality`, low bypass, composer rebuild/replay |
| `src/frontend/src/render/webgl.test.ts` | Edit | High/medium/low, transitions, replay, dispose |
| `src/frontend/src/render/scene.ts` | Edit | Shadow map size / `castShadow` per tier |
| `src/frontend/src/render/scene.test.ts` | Edit | High/medium/low shadow assertions, restoration |
| `src/frontend/src/render/scene-spaceship.test.ts` | Verify (edit only if a pinned shadow/SSAO assumption requires the same concrete high-tier expectation) | T3's existing tier-driving tests must pass unchanged |
| `src/frontend/src/render/scene-effects.test.ts` | Verify (edit only if a pinned shadow/SSAO assumption requires the same concrete high-tier expectation) | T3's existing tier-driving tests must pass unchanged |
| `src/frontend/src/game/session.ts` | Edit | `RendererAdapter.setQuality`, tier poll/push, tier DPR cap, detached retry |
| `src/frontend/src/game/session.test.ts` | Edit | Fake adapter `setQuality`, ordering, detached lifecycle |
| `src/frontend/src/ui/GameCanvas.tsx` | Edit | `active` prop gates the attach effect |
| `src/frontend/src/ui/GameCanvas.test.tsx` | Edit | jsdom attach gating; SSR markup pin |
| `src/frontend/src/App.tsx` | Edit | Pass `active={gateState.view === 'closed'}` |
| `src/frontend/src/App.test.tsx` | Edit | Guest/login/registration/initially-closed attach counts and order |
| `README.md` | Edit | One sentence: tier also scales SSAO/bloom/shadow resolution/DPR |
| `docs/architecture/frontend-rendering.md` | New | Renderer lifecycle, tier budget, frame loop, verification |
| `docs/features/adaptive-render-budget-v2/build-log-T1.md`, `build-log-T2.md`, `build-log-T3.md`, `build-log-T4.md`, `build-log-T5.md` | New | Raw evidence per task |
| `docs/features/README.md` | **Not edited** | Orchestrator-owned; T5 records the proposed row |

No `browser-env.ts`, `transport.ts`, backend, compose, Dockerfile, or package/lockfile change.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Gate by `active` prop on `GameCanvas`, keeping the canvas mounted | Smallest React change; preserves layout and SSR pins; reuses idempotent attach/dispose | Conditional `GameCanvas` mount (drops the canvas, breaks the "canvas behind overlay" contract); a new session `pause()` API (larger surface) |
| 2 | Tier polling in the frame loop rather than a scene callback | One string compare per frame; no re-entrancy during construction; ordering is explicit in `onFrame` | `onQualityTierChanged` option on `createSceneView` (new option, callback during policy changes) |
| 3 | Adapter gains `setQuality`; scene applies shadow size | Post-processing/shadowMap belong to the renderer; light configuration belongs to the scene; both consume the same matrix | Adapter reaching into the scene graph (layer violation); scene owning the composer (wrong ownership) |
| 4 | Sorted array with binary insertion (exact) | Preserves AC-52 semantics and 60-frame timing exactly; removes the per-frame copy+sort | Interval evaluation (changes decision timing); a heap (more code, no benefit at n=120) |
| 5 | Composer rebuilt on tier change rather than pass add/remove | `EffectComposer` has no safe pass-removal contract; rebuilds are rare (cooldown-gated) and cheap relative to the change | Adding/removing passes at runtime (untracked buffers, leak risk) |
| 6 | Low bypasses the composer entirely | "Plain renderer" is the cheapest path and avoids an OutputPass-only composer | RenderPass+OutputPass at low (extra full-screen pass) |
| 7 | Detached `retryConnection` is status-only | Removes the pre-attach connect/hello race; attach opens the socket once with the current cookie | Connecting pre-attach and replaying the welcome (missed-message risk); changing the gate contract (auth-contract change) |
| 8 | Keep `KEY_SHADOW_MAP_SIZE = 2048` and `PIXEL_RATIO_CAP = 2` as the high values | Existing pins and the high-tier look stay valid; new constants express the tier ladder | Renaming/repurposing the existing constants (needless churn) |

## Risks & mitigations

- **Pre-attach welcome race** (login reconnects before the session subscribes) → detached `retryConnection` never touches the transport; attach subscribes first, then connects; the AC-2 `'receives welcome after a detached retryConnection → join(account) → attach cycle'` test pins the welcome receipt, one connect, and zero pre-attach closes.
- **Fake-adapter drift** (session tests pass while the production adapter diverges) → `webgl.test.ts` adds a contract test that drives `createRealisticRenderer` through the session's exact `setQuality → setPixelRatio → setSize → render` sequence, the low bypass, and an idempotent same-tier call; the fake and the production adapter are asserted against the same call contract.
- **Context loss during the intro** → no handler is added; `session.test.ts` dispatches a synthetic `webglcontextlost`/`webglcontextrestored` on the canvas during the intro and asserts no throw, no scheduled-frame change, and no new canvas listener; `webgl.test.ts` keeps the existing renderer mocks (no GL context) and the adapter holds no GL state beyond what `dispose()` releases.
- **Logout or a gate reopen while active** → logout is not wired to the gate; `GameCanvas.test.tsx` still drives `active: true → false → true` and a StrictMode-like remount, asserting dispose on the close and one fresh attach (2 attaches / 1 dispose across the remount).
- **Composer rebuild leaks or stale size** → dispose exactly once, retain last width/height/ratio, replay once; tests assert counts and values for every transition.
- **Shadow resampling not applied after `mapSize` change** → dispose + null the map before setting the size; test asserts `map === null` after the switch and 2048/1024 at high/medium.
- **Frame-order regression (render before `setQuality`)** → explicit ordering test records `setQuality` → `setPixelRatio` → `render` in one frame.
- **Intro restarts at gate close** → accepted supersession (Q-2); the existing intro skip (any key / tap) still bypasses it; the spec ledger records the change so it is not mistaken for a bug.
- **Black page behind the menu** → accepted consequence of deferral (A-3); the canvas remains and the overlay is unchanged; Q-2 allows the alternative if the user prefers the old cinematic.
- **Perceived low-tier softness/aliasing** → DPR ladder is a single-constant edit (Q-3); the containerized visual pass compares low at 1.0 and, if rejected, revises the constant before acceptance.
- **Hidden-tab attach** → `scheduleFrame` already checks `hidden`; attach while hidden creates resources but runs no frames; test pins one resume schedule and a reset baseline.
- **StrictMode double-attach** → existing idempotent attach/dispose already covers it; the jsdom test pins attach=1 for a single mount and dispose on unmount.
- **Coverage regression in `App.tsx`/`GameCanvas.tsx`** → jsdom tests exercise the new branches (active true/false, four gate paths); no exclusion is added.

## Rollback

Revert the feature commit range for `src/frontend/**` and `README.md`/`docs/architecture/frontend-rendering.md`; no persistence, schema, protocol, backend, or container state is involved, so rollback is a code-only revert. The GPU matrix, DPR ladder, and composer composition revert together; if a partial rollback is required, reverting `quality.ts` alone restores always-on SSAO/bloom at every tier (the adapter then receives the old feature shape only after `webgl.ts` is reverted too, so reverting the render files as one unit is required). Build logs record the revert commands and the post-revert `npm run coverage` output. The supersession ledger stays in the spec as a historical record; predecessor artifacts are never edited.

## Verification

### Automated (all tasks; full suite at T5)

`npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80 all four metrics in each workspace), `npm run build`. Task-level pre-gate: `npm run test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`. The full suite must include the AC-2 welcome test, the AC-13 context-loss probe, the `GameCanvas` close/reopen + remount tests, and the production-adapter contract test. No `npm run smoke` requirement: no container/backend change; run it only opportunistically, never as evidence for a client-rendering AC.

### Containerized visual verification (manual, recorded in `build-log-T5.md`)

Environment: unchanged path — `podman compose up`, frontend at `http://localhost:5173` (backend/WebSocket as today). No new service, image, port, env var, health signal, or proxy rule.

1. **High-tier parity.** Before the change, capture idle screenshots at rest (after intro) at 1280×720 and 1920×1080 as a guest. After the change, repeat at the same viewport, camera state, and cube level. Compare: SSAO contact shading under the cube edges, bloom glow on emissive parts, soft 2048 shadow edge, cursor ship material. Expected: no visible difference.
2. **Gate deferral.** Fresh page: the auth menu is visible and the network panel shows **no** WebSocket connection and no `/ws` upgrade until a choice is made. The page background is the page color (accepted). Choose `Play as guest`: one socket opens, the intro plays from the start, and the scene renders. Repeat for a verified login (the socket opens after the login click, with the cookie present, and no duplicate socket from the pre-login state) and for registration (no socket while the verification-pending screen is shown).
3. **Graceful degradation.** With the scene idle, enable DevTools Performance CPU throttling (6×, then 4×) for long enough to exceed the AC-52 downgrade windows. Observe: bloom-only look (medium) then plain look with no glow and no cast shadows (low); check `document.querySelector('canvas').width / cssWidth` to confirm the backing-store ratio matches `min(devicePixelRatio, 1.5)` then `min(devicePixelRatio, 1)`. Clicks must still register and the HUD must remain responsive. Remove throttling: after the upgrade cooldown and stable windows the tier recovers and the high look returns. Record the observed tiers/durations; if medium/low cannot be reached on the host, record "not executed — host too fast" and rely on the automated tier tests (not a pass substitute for AC-6/7/8, which are test-pinned).
4. **Lifecycle probes.** Resize the window during the menu (no error, canvas still blank), then choose guest: the scene fills the new box. Switch tabs during play and back: frames resume without a time jump. Reload and repeat the gate path once to confirm a fresh attach.

## Open questions

**Approval checkpoint.** The `awaiting_approval` summary must name the AC-18 animation-clause supersession and the intro-from-start default (Q-2), Q-1's shadows-off low tier, and Q-3's `2 / 1.5 / 1.0` ladder. Approval of the blanket audit queue is not approval of these visual defaults.

- **Q-1 — Low-tier shadows.** Default: fully off. Alternative: one static contact-shadow plane. Does not affect any other tier or AC.
- **Q-2 — Intro after gate close.** Default: play from the start at attach. Alternative: start in `playing` on late attach. Preserves the accepted intro otherwise.
- **Q-3 — DPR ladder.** Default: 2 / 1.5 / 1.0. Alternative: 2 / 1.25 / 0.75 if the visual pass finds low too soft.
