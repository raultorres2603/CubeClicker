---
feature: realistic-lighting-materials
revision: 3
status: draft
created: 2026-11-06
updated: 2026-11-06
---

# Spec — Realistic Lighting & Materials

## Summary

A frontend-only visual upgrade that keeps CubeClicker's stylized art but moves it to a premium presentation: the renderer uses ACES filmic tone mapping with sRGB output and soft (PCF) shadows; the scene's key light casts higher-resolution shadows with bias/normal-bias tuning; cube and spaceship surfaces move from standard to physical (PBR) materials with a clearcoat layer; and the render pipeline gains ambient occlusion (SSAO) and bloom passes via three.js post-processing. Game rules, state, networking, persistence, backend, and containers are untouched; every visual change remains local to one client. Post-processing uses only modules already shipped with `three` (no new npm dependency), which is flagged as an open question.

## User stories

- As a player, the cube, mini-cubes and spaceship read as premium physical surfaces (clearcoat, controlled highlights) rather than flat shaded primitives.
- As a player, shadows are softer and more stable, and lighting is tone-mapped, so the scene has depth without changing its art style.
- As a player, subtle ambient occlusion and bloom add contact shadows and glow to edges and emissive elements.
- As a player who prefers reduced motion, no new animation is introduced by the lighting/materials change; existing reduced-motion handling stays intact.
- As a maintainer, the upgrade touches only render modules and their tests: no game logic, protocol, persistence, backend, or container change.

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`.

- **AC-1 — Renderer tone mapping, color space, and shadow type.** `createWebGLRenderer` (and `createRealisticRenderer`) in `src/frontend/src/render/webgl.ts` configures the underlying renderer so that:
  - `renderer.toneMapping === ACESFilmicToneMapping` (imported from `three`),
  - `renderer.toneMappingExposure === TONE_MAPPING_EXPOSURE` with `TONE_MAPPING_EXPOSURE === 1.0` exported from `webgl.ts`,
  - `renderer.outputColorSpace === SRGBColorSpace`,
  - `renderer.shadowMap.type === PCFSoftShadowMap`,
  - `renderer.shadowMap.enabled === true` (retained),
  - `antialias === true` (retained).
  Evidence: `webgl.test.ts`.

- **AC-2 — Shadow quality.** The scene's key directional light in `src/frontend/src/render/scene.ts` has:
  - `castShadow === true`,
  - `shadow.mapSize.width === shadow.mapSize.height === KEY_SHADOW_MAP_SIZE` with `KEY_SHADOW_MAP_SIZE === 2048` exported from `scene.ts`,
  - `shadow.bias === KEY_SHADOW_BIAS` with `KEY_SHADOW_BIAS === -0.0001` exported from `scene.ts`,
  - `shadow.normalBias === KEY_SHADOW_NORMAL_BIAS` with `KEY_SHADOW_NORMAL_BIAS === 0.02` exported from `scene.ts`,
  - `shadow.radius === KEY_SHADOW_RADIUS` with `KEY_SHADOW_RADIUS === 2` exported from `scene.ts`.
  Evidence: `scene.test.ts`.

- **AC-3 — PBR materials.** In `src/frontend/src/render/cube-view.ts` and `src/frontend/src/render/spaceship.ts`, the cube body `Mesh`, every tile `InstancedMesh` material, and the spaceship meshes (nose, body, cockpit, wings, ignition) use `MeshPhysicalMaterial` with:
  - `material.clearcoat === MATERIAL_CLEARCOAT` with `MATERIAL_CLEARCOAT === 0.35` exported from the owning module,
  - `material.clearcoatRoughness === MATERIAL_CLEARCOAT_ROUGHNESS` with `MATERIAL_CLEARCOAT_ROUGHNESS === 0.2` exported from the owning module.
  Metalness/roughness continue to come from the cube style (cube) or the pinned `0.5` (spaceship). Shot meshes remain `MeshBasicMaterial`. Evidence: `cube-view.test.ts`, `spaceship.test.ts`.

- **AC-4 — Ambient occlusion pass and composer composition.** `src/frontend/src/render/postprocessing.ts` exports `createPostprocessing(renderer, scene, camera)` returning `{ render, setSize, setPixelRatio, dispose }`. The composer it builds contains, **in this order**: a `RenderPass` bound to `(scene, camera)`, an `SSAOPass`, an `UnrealBloomPass`, and an `OutputPass`. The `SSAOPass` has:
  - `kernelRadius === SSAO_KERNEL_RADIUS` with `SSAO_KERNEL_RADIUS === 0.5`,
  - `minDistance === SSAO_MIN_DISTANCE` with `SSAO_MIN_DISTANCE === 0.005`,
  - `maxDistance === SSAO_MAX_DISTANCE` with `SSAO_MAX_DISTANCE === 0.1`,
  all exported from `postprocessing.ts`. The `OutputPass` is required so the tone mapping set in AC-1 is applied to the post-processed output. Evidence: `postprocessing.test.ts` asserts the passes array is exactly `[RenderPass, SSAOPass, UnrealBloomPass, OutputPass]` (by constructed type) and the SSAO constants.

- **AC-5 — Bloom pass.** The same composer contains an `UnrealBloomPass` whose:
  - `strength === BLOOM_STRENGTH` with `BLOOM_STRENGTH === 0.45`,
  - `radius === BLOOM_RADIUS` with `BLOOM_RADIUS === 0.4`,
  - `threshold === BLOOM_THRESHOLD` with `BLOOM_THRESHOLD === 0.85`,
  all exported from `postprocessing.ts`.
  Evidence: `postprocessing.test.ts`.

- **AC-6 — Wiring and composer construction timing.** `src/frontend/src/render/webgl.ts` exports `createRealisticRenderer(canvas)` which builds the base renderer immediately and returns an adapter with the same surface (`setSize`, `setPixelRatio`, `render`, `dispose`); the `RendererAdapter` and factory signatures are unchanged. The post-processing composer is constructed **lazily on the first call to `render(scene, camera)`**, using that call's `scene` and `camera` (via `createPostprocessing(renderer, scene, camera)`); subsequent `render(scene, camera)` calls delegate to the composer's `render()`. `setSize`/`setPixelRatio` are applied to the base renderer immediately on every call; calls made before the composer exists are **buffered** (last value wins) and replayed onto the composer at construction time, and once the composer exists they propagate to both the renderer and the composer. `dispose()` releases the composer if it was constructed and always releases the base renderer. `src/frontend/src/browser-env.ts` uses `createRealisticRenderer` as its `rendererFactory`. Evidence: `webgl.test.ts`, `browser-env.test.ts`.

- **AC-7 — Reduced motion.** The lighting/materials change introduces no new animation: post-processing passes are static (their parameters are set once at construction from the pinned constants and are never mutated per frame; `postprocessing.test.ts` asserts each pass parameter equals its constant after construction and after `render()` calls), the renderer/shadow/material constants are static, and existing reduced-motion handling (starfield twinkle amplitude `0`, CSS animations/transitions disabled) is unchanged. Evidence: `starfield.test.ts`, `app.css.test.ts`, `postprocessing.test.ts`.

- **AC-8 — No backend/container change.** `git diff` is empty for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, `src/frontend/Dockerfile`, and any other `**/Dockerfile` in the tree. Verification command: `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'`. Evidence: final build log.

- **AC-9 — Coverage.** `npm run coverage` (both workspaces) exits 0 with ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` is the task-level check. Evidence: final build log.

## Non-goals

- No change to game rules, stats, intents, phase sequencing, level progression, server protocol, or persistence.
- No textures, image assets, audio, fonts, or hand-authored shaders; all visuals remain procedural and code-driven. Library-provided post-processing shaders shipped with `three/examples/jsm/postprocessing/*` are permitted (they are not hand-authored shader code); this matches open question Q-1's default.
- No change to starfield counts, twinkle, or star-driven ambient fill light logic.
- No change to CSS/HUD styling, markup, or component behaviour.
- No new npm dependency: post-processing uses modules already shipped with `three` (`three/examples/jsm/postprocessing/*`); adding a separate package requires user approval.
- No cross-client visibility of the new visuals: they remain local to one client.
- No browser automation or pixel/perceptual tests.
- No performance tuning beyond the pinned passes; advanced effects (volumetrics, reflections, cascaded shadows) are out of scope.
- No scaling of AO/bloom intensity with starfield brightness.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named imports from `three` (and `three/examples/jsm/*` where post-processing is used); tests with concrete expected values beside every behaviour change; run lint, typecheck, tests, and the coverage command before reporting done; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency or package (none required, but flagged); any pinned-constant deviation from this spec; touching any file outside a task's `files_owned`; any coverage exclusion or threshold change; any change to backend/container files; any change to the `RendererAdapter` signature.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, or configs; use `import *` from `three`; read browser globals inside `game/**` or pure render math; push; rewrite predecessor specs.

## Security considerations

- **No new dependencies.** Only existing `three` imports (core + `examples/jsm/postprocessing/*`); lockfile untouched unless a package is explicitly approved.
- **No user data, storage, or network.** All visual state is in-memory per client; nothing is persisted or sent.
- **Rendering safety.** Fully procedural geometry/materials; no loaders, textures, or external assets; no `innerHTML`.
- **Resource bounds.** Post-processing uses fixed render targets and fixed pass counts; `dispose()` releases them. No unbounded growth.
- **Test integrity.** Coverage bar and concrete-assertion rule protect unchanged pure logic and server-authority paths.

## Real-time impact

**None for shared state.** Tone mapping, shadows, PBR materials, AO, and bloom are client-local visuals: no shared or cross-client state is created or read, no protocol message is added, and connection lifecycle, reconnection, multi-client behaviour, and server authority are unaffected (they remain as in predecessor features). **Open question Q-2** carries over whether other clients should see a player's ship/material state; the default (local-only) is chosen and flagged.

## Containerization impact

**None expected.** Frontend source changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it. AC-8 pins the container-file diff gate.

## Testing strategy

- **Unit (Vitest, node environment):** `webgl.test.ts` pins renderer tone mapping, exposure, color space, shadow type, realistic-renderer wiring and lazy composer construction/buffering (mocking the post-processing composer); `postprocessing.test.ts` pins SSAO/Bloom constants, composer composition order (RenderPass, SSAOPass, UnrealBloomPass, OutputPass), and the static-params assertion; `scene.test.ts` pins shadow map size/bias/normalBias/radius; `cube-view.test.ts` and `spaceship.test.ts` pin `MeshPhysicalMaterial` + clearcoat constants; `browser-env.test.ts` pins the factory swap.
- **Integration (same node environment — real three.js scene graph):** `scene.test.ts` asserts lighting/shadow configuration against a real scene; `scene-spaceship.test.ts` unchanged behaviour.
- **E2E / container:** no browser automation (predecessor non-goal retained); `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). If a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.

## Open questions

- **Q-1 — Post-processing dependency.** Default: use `three/examples/jsm/postprocessing/*` (already shipped with `three`, no npm install). If the reviewer prefers zero example imports, bloom/SSAO can be dropped to a renderer-only scope (constants removed, AC-4/AC-5/AC-6 revised) — requires a spec revision.
- **Q-2 — Cross-client visibility (carried over, user checkpoint).** Default: all new visuals are local to one client. Broadcasting material/ship state would need a protocol addition and server authority; not implemented. Choosing it requires a spec revision.
- **Q-3 — Tuning.** The pinned tone-mapping exposure, shadow bias/normalBias/radius, clearcoat, and AO/bloom intensities are defaults; tuning is a constant edit plus a spec note.
- **Q-4 — Low-end performance.** SSAO + bloom add fixed per-frame cost. Default: always on. If devices stutter, make SSAO/bloom opt-out under a quality flag (open question, requires spec revision).
- **Q-5 — Feature scope.** The request bundles lighting, shadows, materials, AO, and bloom. Default: one feature. If review finds the scope too large, split into `renderer-tonemapping`, `shadow-quality`, `pbr-materials`, `postprocessing-ao-bloom` and sequence them; requires user approval.

## Assumptions

- `three@0.186.1` and `@types/three@0.186.0` provide the example post-processing modules and their types.
- The `RendererAdapter` surface stays unchanged (`setSize`, `setPixelRatio`, `render`, `dispose`); post-processing is encapsulated behind `createRealisticRenderer`.
- Composer construction is lazy: `createRealisticRenderer(canvas)` builds only the base renderer up front; the composer is built on the first `render(scene, camera)` and buffered `setSize`/`setPixelRatio` values are replayed at that point. `game/session.ts` is untouched.
- HUD minimize state and other UI behaviour are untouched.
- Predecessor specs/plans/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: TypeScript strict, Vitest, ESLint; the project testing bar governs.

## Revision history

- r1 — 2026-11-06 — initial draft (planning phase).
- r2 — 2026-11-06 — spec review r1: addressed F1 (composer construction timing), F2 (composer composition order), F3 (library-provided post-processing shaders permitted), F4 (AC-7 evidence + static pass params).
- r3 — 2026-11-06 — planning revision: finalized lazy-construction contract and task DAG consistency; bumped revision 2 → 3.
