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

The session owns the requestAnimationFrame loop for the Three.js game scene; the scheduler is injected (`createRafScheduler` wraps `requestAnimationFrame` in production). The reveal adds one additional bounded 30 fps loop outside the session, in the deferred customization panel (§ Lootbox reveal stage). One frame of [`session.ts`](../../src/frontend/src/game/session.ts) runs in this order:

1. **Simulation.** Measure `dtMs` from the previous frame baseline (never negative), advance the engine when `canRun()`, and handle level swaps/travel arrivals.
2. **Intents and hover.** `view.applyIntents(engine.drainIntents(), nowMs)`; when playing, resolve the hovered front-face mini-cube for the current pointer position.
3. **`view.applySnapshot(snapshot, nowMs)`.** Push the authoritative engine snapshot into the scene.
4. **`view.update(dtMs)`.** Push the frame time into the quality policy (the sorted-window p95 update) and apply the current tier's scene features and shadow budget.
5. **Tier poll.** `const tier = view.getQualityTier()`; only when `tier !== appliedTier`: set `appliedTier`, call `adapter.setQuality(tier)`, then `applyViewport()` to re-cap DPR and re-apply the size.
6. **`adapter.render(view.scene, view.camera)`.** Composer render at high/medium; the single base renderer render at low.
7. **Publish and reschedule.** Publish the snapshot/multiplayer views, then `scheduleFrame()` for the next frame.

`appliedTier` is seeded at attach (after the attach-time `setQuality`), so the first frame adds no call and stable-tier frames add neither `setQuality` nor a pixel-ratio apply. Because the tier poll and DPR re-apply happen before step 6, a tier change takes effect in the same frame it is observed.

## Remote ships

Added by feature `remote-spaceship-customization` (2026-11-19); the full contract is in the
[feature spec](../features/remote-spaceship-customization/spec.md), and the player-facing terms are
[remote ship](../product/glossary.md#remote-ship) and [appearance](../product/glossary.md#appearance).

**One ship, for the spectated member.** The scene renders exactly one **remote ship**: the ship of
the **server member** the camera is currently spectating. The visibility rule is geometric, not
cosmetic. The accepted spectate camera rests at `(px, py, 12)` looking at `(px, py, 0)` with
`CAMERA_FOV = 50`, so at the cube plane the visible half-width is ≈ `12 · tan(25°) · aspect`
(≈ 8.95 units at aspect 1.6), while adjacent ring slots sit `SLOT_SPACING = 24` apart. Every
non-spectated cube is therefore off-screen (or mid-flight) in the accepted layouts, so a ship there
would add draws without pixels. Appearance is still carried for every member on the wire
(§ [realtime](realtime.md#public-appearance-projection)), so a future camera/overview change can
render them without a protocol change. No ship exists before the first `welcome`, during a
spectate/return camera flight, or when the spectated member is not in the rendered world.

**Hierarchy, anchor and aim.** [`render/remote-ship.ts`](../../src/frontend/src/render/remote-ship.ts)
places a `remote-ship` root above-front of the member's cube at
`REMOTE_SHIP_OFFSET = { x: 1.6, y: 2.8, z: 4.4 }` and `REMOTE_SHIP_SCALE = 1.2`, aimed at the cube
centre (the root's local `+z` points at it). A `remote-ship-body` child carries the idle bob/sway and
the firing recoil, and the reused cursor model (32 objects, 21 meshes, ten ship slot groups) sits
under it; a `shots` group is the body's sibling under the root. The root's anchor and aim are
independent of the animation.

**Appearance and live re-skin.** The ship resolves its 11-slot appearance through the shared
`appearanceToShipParamsV3` mapping and applies the ten ship slots to the model; the `shot` entry
selects only the shot style. `SceneView.setSpectatedAppearance(playerId, appearance)` applies a live
`memberAppearance` to the mounted ship when the id matches: the hull, slot transforms and shot style
change on the same model identity (no remount, no second `dispose()`), a repeated record performs no
material or transform write, and an absent, unknown or wrong-slot entry renders that slot's classic
standard part. The session calls it on the arrival frame and after a remote `levelAdvanced` rebuild.

**Idle motion.** `remoteShipIdle(elapsedMs, reducedMotion)` writes only the body:
`position.y = 0.12 · sin(2π·t / 2600)` and `rotation.y = 0.05 · cos(2π·t / 2600)`
(`REMOTE_SHIP_BOB_AMPLITUDE = 0.12`, `REMOTE_SHIP_BOB_PERIOD_MS = 2600`,
`REMOTE_SHIP_SWAY_RAD = 0.05`). The ship never follows the pointer, travels, banks or leaves a trail.

**Firing from accepted removals.** Remote firing adds **no protocol traffic**: it is derived from
the existing `miniCubeRemoved`/`miniCubesRemoved` broadcasts. For the mounted member, one removal
spawns at most one shot at the removed id's tile origin (the fallback for an already-hidden tile is
`(px, py, 2.75)`), from the model's nose, travelling over the retained `SHOT_TRAVEL_MS = 180` with
the owner's shot style (geometry, scale, muzzle form and colours). At most one shot per
`REMOTE_SHOT_MIN_INTERVAL_MS = 90` and at most `REMOTE_SHOT_MAX_IN_FLIGHT = 2` live shots; a third is
dropped, not queued. Each accepted shot starts a recoil of `0.12` units along the body's local `−z`,
decaying with `1 − easeOutCubic(t)` over `MOTION.remoteShipRecoilMs = 120`; a dropped shot starts
none, and a removal for any other member spawns nothing (the local ship owns its own shots).

**Reduced motion.** The remote ship does not bob, sway or recoil. A removal renders one opacity
flash at the target for `MOTION.remoteShotFlashMs = 120` with no travelling mesh; the tile conceal
and the shared impact burst are unchanged, and the quality tier never re-enables suppressed motion.

**Lazy manager and measured budgets.** The `remote-ships` manager group is created only while a ship
is mounted and removed with the last disposal, so the accepted scene counts return exactly with no
ship: **135** objects with no world, **146** with one remote member, **210** with 9 and **322** with
23. The mounted ship adds **36 objects / 21 draws** — manager 1 + root 1 + body 1 + 32 cursor-model
objects + 1 `shots` group — so the idle spectating fixture is **182 objects / 246 / 358**. Each
in-flight bolt adds **+1 object / +1 draw** and each live muzzle adds **+1 / +1**, so two bolts give
184 / 248 / 360 (38 scene objects / 23 draws), and the peak fixture with two bolts and one live
muzzle is **185 objects / 249 / 361** — the one-remote-member spectating baseline of **185 objects /
24 draws** (39 objects in the ship subtree). Unmounting restores the accepted counts exactly even
with shots in flight. A ray that hits only the remote ship resolves to `null` through the picking
path; medium hides the accepted four detail meshes and low the accepted six, with no trail and no
reticle; the per-frame path writes pre-allocated vectors and allocates no object.

## Lootbox reveal stage

The 3D lootbox reveal is a second, deliberately small three.js presentation of an accepted grant; it changes no protocol, server, persistence or quality-tier behavior. The grant still arrives as the server-authoritative, opener-only `lootboxOpened` message (or a guest engine's local grant), the session stores it as `lastLootboxGrant`, and a `welcome` or any non-`connected` transport status clears it, so a reconnect never replays the animation.

- **Modules.** [`game/reveal-motion.ts`](../../src/frontend/src/game/reveal-motion.ts) is pure arithmetic — the pinned 1290 ms pose timeline (`revealStagePose`), the per-slot yaw table and the rarity colours — with no DOM, timers or randomness, and it writes one pre-allocated `RevealStagePose` so a frame allocates nothing. [`render/lootbox-reveal.ts`](../../src/frontend/src/render/lootbox-reveal.ts) builds the stage (`createRevealStage`): one scene named `lootbox-reveal-scene` with an ambient light, a key light, the existing `createCursorShipModel` group and one rarity `RingGeometry` mesh; it owns no renderer and no loop. [`ui/LootboxReveal.tsx`](../../src/frontend/src/ui/LootboxReveal.tsx) owns the browser boundary and the card.
- **Try-on, never a mutation.** The slot is resolved from the pinned catalog (`partDefinitionV3(partId).slot`), never from the wire `slot`; the stage copies the normalized appearance, replaces only that slot, and applies it through the model's single `applyAppearance` path — the same `appearanceToShipParamsV3` mapping the pointer ship, the remote ship and the customization preview use. The player's stored appearance changes only through `Equip` (the existing `onEquip`/server path).
- **One context and one bounded loop.** The reveal renders in its own canvas inside the customization panel; while a grant exists the panel renders `LootboxReveal` and **not** `SpaceshipPreview`, so the panel has exactly one WebGL context in addition to the main scene's own context. The reveal loop is capped at 30 frames per second, skips rendering and stops scheduling while `document.hidden`, resumes on `visibilitychange` with a reset frame baseline, and is disposed on dismissal, grant replacement and unmount (stage first, then renderer). The main scene's frame loop, quality tier and draw budget are untouched.
- **Deferred chunk.** The component and its three.js imports stay behind the existing `DeferredSpaceshipCustomizationPanel` dynamic import, so the entry graph remains Three-free and the bundle-budget gate is unchanged (§ Loading and code splitting).
- **Reduced motion and fallback.** With reduced motion the component renders exactly one static rest-pose frame and schedules no further frame. If the renderer or the stage cannot be constructed, the card stays complete and the stage is replaced by a static inline-SVG ship fallback. The reveal root is a non-live `role="group" aria-live="off"` region labelled `Lootbox reveal: <part name>`; it is non-modal (no scrim, no focus trap, the game and the customization toggle stay interactive), and `Escape`, `Dismiss` and `Equip` are the only dismissal paths.

## Menu motion

Two player-opened menus animate when they mount — the hangar panel (`.customization-panel`, normal state only) and the crew list (`.user-panel .users-list`) — plus a short fade on every hangar tab switch. All of it is CSS: five `@keyframes` in [`game-view.css`](../../src/frontend/src/ui/game-view.css) driven by four `MOTION` durations mirrored as `--motion-*` on `main`; no JavaScript, timer or `requestAnimationFrame` is involved, and nothing is disabled while the sequence runs (no `pointer-events`, `inert`, delayed handler or focus move).

| Keyframe | Surface | Token → `--motion-*` mirror | Duration and easing |
| --- | --- | --- | --- |
| `menu-boot` | the panel / crew-list root | `menuBootMs` → `--motion-menu-boot-ms` | 320 ms, `linear`, `both` |
| `menu-scan` | the root `::before` top light edge | `menuBootMs` → `--motion-menu-boot-ms` | 320 ms, `linear`, `both` |
| `menu-rail` | the root `::after` left status rail | `menuFlickerMs` → `--motion-menu-flicker-ms` | 120 ms, `steps(2, end)`, `both` |
| `menu-chroma` | `.customization-title` / `.users-list-title` | `menuChromaMs` → `--motion-menu-chroma-ms` | 90 ms, `steps(3, end)`, `both` |
| `tab-panel-in` | `.customization-tabpanel` | `tabSwitchMs` → `--motion-tab-switch-ms` | 140 ms, `ease-out`, `both` |

- **The boot (320 ms).** `menu-boot` flickers the root's opacity `0 → 0.62 → 0.14 → 0.86 → 0.48 → 1` at `12/22/34/46/60 %` and settles its border colour from `--gf-rim-strong` to `--gf-rim`; `menu-scan` sweeps the top light edge's `right` from `100 %` to `0` by `45 %` and settles lit; `menu-rail` powers the left status rail's `height` from `8 %` to `40 %` (opacity `0.1 → 1`); `menu-chroma` steps the title's two-colour `text-shadow` split (`--gf-rare`/`--gf-rim-strong` → `--gf-amber`/`--gf-rare`) to `none`.
- **The tab swap (140 ms).** `tab-panel-in` fades the panel's opacity `0 → 1`. The tabpanel is keyed by the active tab id, so every switch mounts a new panel element (the animation restarts) while the tab strip and the single preview keep their identity.
- **Open only, no close.** There is no exit keyframe, `animation-direction: reverse` or delayed unmount: closing the hangar or the crew list unmounts it in one commit, and the next open replays the boot from the start.
- **No transform, no filter.** The beats animate only `opacity`, `border-color` and `text-shadow` on the surfaces, plus `right`/`height` on the two 1–2 px decorative pseudo-elements. No rule on the panel, the crew list, their pseudo-elements or their titles declares `transform`, `filter`, `backdrop-filter`, `will-change` or `clip-path`, so the chamfered clip and the layer table below are unchanged.
- **Reduced motion, specificity-safe.** Both off-switches — the file's single `@media (prefers-reduced-motion: reduce)` block and the existing top-level `main[data-reduced-motion='true']` session block — repeat the scoped selectors (the boot root and its `::before`/`::after`/title, the reveal state, `.customization-tabs`, `.customization-tab`, `.customization-tabpanel`, and the crew root/`::before`/`::after`/title) and set `animation: none; transition: none`. The boot rules are (0,2,0) and would beat a bare `.customization-panel` (0,1,0), so the off-switch selectors carry equal or higher specificity and every animation rule is declared before the media block; the scoped `.customization-panel[data-reveal-active='true']` selector also closes the older OS-preference gap on `reveal-spotlight`.
- **Tab structure.** The hangar's `.customization-tabs[role="tablist"]` (labelled `Spaceship part groups`) holds six `role="tab"` buttons — `Frame`, `Front`, `Wings`, `Engines`, `Ignitions` and `Shots` (two part slots each except `Shots`, which holds the `shot` slot) — with roving `tabindex` and arrow/`Home`/`End` selection. Exactly one `role="tabpanel"` (`id="customization-tabpanel"`) renders the active group's two rows (one on `Shots`), each row with an eleven-button form strip and a 3-cell (`classic`), 1-cell (`shot` classic) or 12-cell (generated form) finish grid; no tab carries `aria-controls` (there is only one panel), and the panel points back with `aria-labelledby` at the selected tab's stable id. The reveal branch keeps only `reveal-spotlight` and no tablist, tabpanel or preview.

## Game shell layering

The game view is one stacking context inside `<main>`; the canvas, the CSS ambience layer and the HUD/panel surfaces are ordered by explicit `z-index` values so no new surface accidentally covers a control:

| Layer | `z-index` | Surface |
| --- | --- | --- |
| Game canvas | `0` | `main > canvas` (`position: relative`) |
| Ambience | `2` | `.game-ambience` (procedural scanline/vignette/corner glow, `pointer-events: none`, `inset: 0`) |
| Panels and controls | `3` | every Neon Forge panel surface (HUD, upgrades, activity feed, leaderboard, users list, connection banner, phase announcement, `main > section`), `.user-panel`, `.game-runtime-status`, `.game-runtime-error` |
| Level banner | `5` | `.level-complete` |
| Reveal spotlight | `20` | the revealing `.customization-panel` (centred spotlight at `min-width: 721px`, bottom sheet at `max-width: 720px`) |
| Customization toggle | `21` | `.customization-toggle`, above the reveal panel so closing it is a real dismissal |
| Auth | `100` | `.auth-menu` / `.auth-forms` |

The reveal is non-modal: there is no full-screen scrim and no `data-reveal-active` on `<main>`. Under reduced motion the ambience scanline animation is `none` and only the static gradients remain.

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
