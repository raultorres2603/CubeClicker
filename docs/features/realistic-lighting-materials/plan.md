---
feature: realistic-lighting-materials
revision: 3
---

# Plan — Realistic Lighting & Materials

## Architecture

The upgrade stays inside the render adapter layer (`src/frontend/src/render/**`) and the browser-environment factory. No game, state, protocol, or persistence code changes.

- `render/webgl.ts` keeps `createWebGLRenderer` (base renderer, now configured for tone mapping, sRGB output, soft shadows) and adds `createRealisticRenderer`, which wraps the base renderer with a post-processing composer built by `render/postprocessing.ts`. The base renderer is constructed immediately; the composer is constructed **lazily on the first `render(scene, camera)`** (see Interfaces). `setSize`/`setPixelRatio` are applied to the base renderer immediately and buffered (last value wins) for replay onto the composer at construction time. The adapter surface (`setSize`, `setPixelRatio`, `render`, `dispose`) is unchanged, so `game/session.ts` needs no edit.
- `render/postprocessing.ts` (new) owns the `EffectComposer` plus `RenderPass(scene, camera)`, `SSAOPass`, `UnrealBloomPass`, and `OutputPass` (in that order), exposing the narrow adapter surface `{ render, setSize, setPixelRatio, dispose }` and forwarding resize/pixel-ratio/dispose.
- `render/scene.ts` upgrades the key directional light's shadow configuration (size, bias, normal bias, radius) while retaining star-driven ambient fill.
- `render/cube-view.ts` and `render/spaceship.ts` swap `MeshStandardMaterial` for `MeshPhysicalMaterial` and add a clearcoat layer; metalness/roughness inputs are unchanged.
- `browser-env.ts` swaps its `rendererFactory` from `createWebGLRenderer` to `createRealisticRenderer`.

Data flow: the session loop calls `adapter.render(scene, camera)` each frame. On the first such call the realistic renderer lazily builds the composer from that frame's `scene`/`camera`; every call thereafter runs the composer (RenderPass → SSAO → bloom → OutputPass). `applyViewport` (which runs before the first frame) calls `setSize`/`setPixelRatio` on the adapter, which are applied to the base renderer immediately and buffered for the composer. Reduced motion does not alter the pipeline (passes are static); existing reduced-motion gating in the starfield and CSS is untouched.

## Interfaces / contracts

- `TONE_MAPPING_EXPOSURE: number` (1.0) — `webgl.ts`.
- `KEY_SHADOW_MAP_SIZE: number` (2048), `KEY_SHADOW_BIAS: number` (-0.0001), `KEY_SHADOW_NORMAL_BIAS: number` (0.02), `KEY_SHADOW_RADIUS: number` (2) — `scene.ts`.
- `MATERIAL_CLEARCOAT: number` (0.35), `MATERIAL_CLEARCOAT_ROUGHNESS: number` (0.2) — `cube-view.ts` and `spaceship.ts`.
- `SSAO_KERNEL_RADIUS: number` (0.5), `SSAO_MIN_DISTANCE: number` (0.005), `SSAO_MAX_DISTANCE: number` (0.1), `BLOOM_STRENGTH: number` (0.45), `BLOOM_RADIUS: number` (0.4), `BLOOM_THRESHOLD: number` (0.85) — `postprocessing.ts`.
- `createPostprocessing(renderer, scene, camera): { render; setSize; setPixelRatio; dispose }` — `postprocessing.ts`. `render()` takes no arguments: the scene and camera are bound at construction via the `RenderPass`.
- `createRealisticRenderer(canvas): RendererAdapter` — `webgl.ts`. Constructs the base renderer immediately. The composer is constructed lazily on the first `render(scene, camera)`; `setSize`/`setPixelRatio` are applied to the base renderer immediately and buffered (last value wins) for replay onto the composer at construction. `dispose()` releases the composer if constructed.
- `RendererAdapter` signature unchanged.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/render/webgl.ts` | Edit | Tone mapping, color space, soft shadow type; add `createRealisticRenderer`. |
| `src/frontend/src/render/webgl.test.ts` | Edit | Pin renderer config and realistic-renderer wiring. |
| `src/frontend/src/render/postprocessing.ts` | New | EffectComposer + RenderPass + SSAOPass + UnrealBloomPass + OutputPass. |
| `src/frontend/src/render/postprocessing.test.ts` | New | Pin SSAO/Bloom constants and composer composition. |
| `src/frontend/src/render/scene.ts` | Edit | Key-light shadow quality constants and assignment. |
| `src/frontend/src/render/scene.test.ts` | Edit | Pin shadow map size/bias/normalBias/radius. |
| `src/frontend/src/render/cube-view.ts` | Edit | `MeshStandardMaterial` → `MeshPhysicalMaterial` + clearcoat. |
| `src/frontend/src/render/cube-view.test.ts` | Edit | Pin physical material + clearcoat constants. |
| `src/frontend/src/render/spaceship.ts` | Edit | `MeshStandardMaterial` → `MeshPhysicalMaterial` + clearcoat. |
| `src/frontend/src/render/spaceship.test.ts` | Edit | Pin physical material + clearcoat constants. |
| `src/frontend/src/browser-env.ts` | Edit | Use `createRealisticRenderer`. |
| `src/frontend/src/browser-env.test.ts` | Edit | Pin factory swap. |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | ACES filmic tone mapping + sRGB output on the renderer. | Standard premium look; built into three; no new dependency. | Reinhard/neutral tone mapping (less contrast). |
| 2 | PCFSoft shadow maps at 2048 with small bias/normalBias/radius. | Softer, more stable shadows; pins testable numbers. | Larger maps (4096) at higher cost; PCF (harder). |
| 3 | `MeshPhysicalMaterial` with clearcoat for cube/spaceship surfaces. | PBR upgrade while keeping stylized colours and existing metalness/roughness. | Custom ShaderMaterial (too invasive); textures (out of scope). |
| 4 | SSAO + bloom via `three/examples/jsm/postprocessing`. | Delivers requested AO/bloom without a new npm package. | Skip post-processing (drops AC-4/AC-5); add a package (ask-first). |
| 5 | Keep `RendererAdapter` surface unchanged; encapsulate composer behind `createRealisticRenderer`. | Avoids editing `game/session.ts` and its many tests. | Extend adapter with composer methods (broader contract change). |
| 7 | Lazy composer construction on first `render(scene, camera)`. | `createRealisticRenderer(canvas)` only receives a canvas, but `createPostprocessing` needs `scene` and `camera`, which the session creates before the renderer factory runs; `applyViewport` also runs before the first frame. Lazy construction with buffered resize/pixel-ratio satisfies both AC-4 and AC-6 without changing signatures. | Explicit init hook on the adapter (broader surface change); eager construction in the factory (impossible — no scene/camera available). |
| 6 | browser-env switches factory to the realistic renderer. | Single integration point; tests assert the swap. | Keep base renderer (no visible bloom). |

## Risks & mitigations

- Post-processing performance on low-end devices → keep passes minimal (SSAO + bloom + output); constants tunable; open question Q-4 for opt-out.
- Example imports may complicate Vitest mocking → plan mocks `three/examples/jsm/postprocessing/*` in `postprocessing.test.ts` and `webgl.test.ts`.
- Lazy composer construction means `setSize`/`setPixelRatio` issued before the first frame must be buffered and replayed; tests assert the buffered values reach the composer at construction.
- Shadow bias tuning may cause acne/peter-panning → pinned small bias/normalBias; adjustable via constants.
- Clearcoat on instanced meshes may affect performance → single material per face (already the case); no new drawables.
- Cross-client visibility ambiguity → carried over as open question Q-2; default local-only.

## Open questions

- Q-1 — Post-processing dependency (default: use shipped three examples).
- Q-2 — Cross-client visibility (default: local-only).
- Q-3 — Tuning of pinned constants.
- Q-4 — Low-end performance opt-out.
- Q-5 — Feature scope / split.

---
