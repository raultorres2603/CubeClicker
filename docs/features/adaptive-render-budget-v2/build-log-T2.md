# Build log — T2 — Tier-aware renderer and session propagation

Task: T2 (2026-11-12)

Files changed:
- `src/frontend/src/render/postprocessing.ts`
- `src/frontend/src/render/postprocessing.test.ts`
- `src/frontend/src/render/webgl.ts`
- `src/frontend/src/render/webgl.test.ts`
- `src/frontend/src/game/session.ts`
- `src/frontend/src/game/session.test.ts`
- `src/frontend/src/game/session-spaceship.test.ts` (compile-only: two inline adapter fakes gain the new required `setQuality() {}`; no assertions changed — see Deviations)
- `docs/features/adaptive-render-budget-v2/build-log-T2.md`

What changed & why:
- `createPostprocessing(renderer, scene, camera, tier)` now takes the tier: `RenderPass` + `OutputPass` always, `UnrealBloomPass` at high/medium, `SSAOPass` only at high; the pinned SSAO (`0.5 / 0.005 / 0.1`) and bloom (`0.45 / 0.4 / 0.85`) constants are unchanged and each built pass is disposed exactly once.
- `createRealisticRenderer(canvas)` keeps its factory signature and starts at high; the adapter gained `setQuality(tier)`: same-tier is a no-op, a change toggles `renderer.shadowMap.enabled` (`next !== 'low'`), disposes and nulls an existing composer exactly once, and the lazy rebuild replays the last forwarded size/ratio once. Low bypasses the composer and calls `renderer.render(scene, camera)` exactly once per render. `createWebGLRenderer` gained a no-op `setQuality()`.
- `session.ts`: `RendererAdapter` gained `setQuality(tier: QualityTier)` (type-only import); attach pushes the starting tier before the first `applyViewport()`; `applyViewport()` caps DPR with `QUALITY_PIXEL_RATIO_CAPS[view.getQualityTier()]`; the frame loop polls the tier between `view.update(dtMs)` and `adapter.render(...)` and only on a change calls `setQuality` then re-applies the viewport; detached `retryConnection()` is status-only.
- Tests pin the tier pass lists, dispose counts, shadow/DPR transitions, composer rebuild + replay, the low bypass, the session call ordering/counts, the named detached welcome path, hidden-at-attach, resize-before-attach, context-loss, and dispose/re-attach.

Decisions:
- Fake-adapter recording keeps the accepted `calls` array (`setPixelRatio`/`setSize` only) and adds a full `order` timeline plus `qualities`; pre-existing exact call arrays stay valid while ordering (`setQuality → setPixelRatio → setSize → render`) is asserted concretely.
- A tier change on 30 ms frames is driven through the real scene policy: high→medium on push 60, medium→low on push 120 (60-frame streak + 1000 ms cooldown), matching the pinned policy timing.
- `createPostprocessing` still builds a `RenderPass + OutputPass` list if called at low (per the task's explicit rule), but the adapter never calls it at low; the direct call is pinned only as the builder contract.
- The low render path keeps the plan's defensive `disposeComposer()` (unreachable through the public adapter because `setQuality` already disposed synchronously); `webgl.ts` remains 100 % covered on all four metrics.
- High-tier parity: the four-pass list, SSAO/bloom parameters, `PCFSoftShadowMap`, tone mapping and color space are unchanged; `scene.ts`/`quality.ts` are untouched by T2 (T1 already pins the 2048 high shadow-map and the `2 / 1.5 / 1` DPR ladder).

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
      Tests  1757 passed (1757)
   Duration  2.98s (transform 6.76s, setup 0ms, collect 19.84s, tests 9.38s, environment 5.01s, prepare 4.74s)
```

- Focused changed-module run, `npx vitest run src/render/postprocessing.test.ts src/render/webgl.test.ts src/game/session.test.ts` → exit 0
```
 Test Files  3 passed (3)
      Tests  122 passed (122)
```
  New/changed tests observed green (verbose):
```
 ✓ src/render/postprocessing.test.ts > createPostprocessing > builds the high composer with passes in order RenderPass, SSAOPass, UnrealBloomPass, OutputPass
 ✓ src/render/postprocessing.test.ts > createPostprocessing > builds the medium composer with RenderPass, UnrealBloomPass, OutputPass and no SSAOPass
 ✓ src/render/postprocessing.test.ts > createPostprocessing > builds only RenderPass and OutputPass for a low-tier call (the adapter never calls it)
 ✓ src/render/postprocessing.test.ts > createPostprocessing > releases the composer and every high-tier pass on dispose
 ✓ src/render/postprocessing.test.ts > createPostprocessing > releases the composer and exactly the medium passes on dispose
 ✓ src/render/postprocessing.test.ts > createPostprocessing > releases the composer and exactly the low-tier passes on dispose
 ✓ src/render/webgl.test.ts > createRealisticRenderer > is idempotent for the current tier (AC-9)
 ✓ src/render/webgl.test.ts > createRealisticRenderer > toggles shadows, disposes the old composer exactly once and replays the last size/ratio on rebuild (AC-9)
 ✓ src/render/webgl.test.ts > createRealisticRenderer > never constructs a composer at low and renders the base scene exactly once per call (AC-8)
 ✓ src/render/webgl.test.ts > createRealisticRenderer > matches the session contract: setQuality(medium) → setPixelRatio → setSize → render → setQuality(low) → render → setQuality(low) → setQuality(high) → render (AC-10)
 ✓ src/game/session.test.ts > attach > applies a tier change before that frame renders and re-caps the DPR (AC-10)
 ✓ src/game/session.test.ts > resize and visibility > attaches while hidden: creates the renderer, schedules no frame and resumes once visible
 ✓ src/game/session.test.ts > dispose > can be attached again for the same engine state
 ✓ src/game/session.test.ts > deferred lifecycle probes (AC-13) > ignores a resize emitted before attach without creating a renderer
 ✓ src/game/session.test.ts > deferred lifecycle probes (AC-13) > survives a synthetic context loss/restore during the intro without listeners or frames
 ✓ src/game/session.test.ts > detached login path (AC-2, AC-14) > retryConnection before attach is status-only and never touches the transport
 ✓ src/game/session.test.ts > detached login path (AC-2, AC-14) > receives welcome after a detached retryConnection → join(account) → attach cycle
```

- Named AC-2 regression test, `npx vitest run src/game/session.test.ts -t "receives welcome after a detached retryConnection"` → exit 0
```
 ✓ src/game/session.test.ts > detached login path (AC-2, AC-14) > receives welcome after a detached retryConnection → join(account) → attach cycle 53ms
 Test Files  1 passed (1)
      Tests  1 passed | 85 skipped (86)
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (threshold 80 on all four metrics)
```
 Test Files  64 passed (64)
      Tests  1757 passed (1757)
All files          |   96.46 |    95.47 |   97.49 |   96.46 |
  session.ts       |   90.16 |    99.64 |   96.77 |   90.16 | ...1300,1313-1314
  ...processing.ts |     100 |      100 |     100 |     100 |
  quality.ts       |   98.31 |    97.46 |     100 |   98.31 | 316-317,400-401
  webgl.ts         |     100 |      100 |     100 |     100 |
```

- High-tier pin re-check (focused run): the four-pass high composer, SSAO `0.5 / 0.005 / 0.1`, bloom `0.45 / 0.4 / 0.85`, and the DPR-2 cap are asserted green:
```
 ✓ src/render/quality.test.ts > quality GPU matrix (AC-5) > pins the shadow-map size and DPR-cap constants
 ✓ src/render/quality.test.ts > quality GPU matrix (AC-5) > exposes the exact GPU fields for every tier with and without reduced motion
 ✓ src/render/postprocessing.test.ts > createPostprocessing > sets SSAO parameters from the pinned constants
 ✓ src/render/postprocessing.test.ts > createPostprocessing > sets bloom parameters from the pinned constants
 ✓ src/game/session.test.ts > attach > sizes the renderer from the container rect and the capped pixel ratio (AC-6, AC-7)
```
  `src/frontend/src/render/scene.ts` is unchanged (`git diff --exit-code -- src/frontend/src/render/scene.ts src/frontend/src/render/quality.ts` → exit 0); its `KEY_SHADOW_MAP_SIZE = 2048` and high-quality matrix from T1 are therefore intact (the scene shadow half is T3).

Acceptance audit:
- AC-6 (renderer/composer/DPR half) → met: high builds exactly `[RenderPass, SSAOPass, UnrealBloomPass, OutputPass]`, SSAO `0.5/0.005/0.1`, bloom `0.45/0.4/0.85`; `renderer.shadowMap.enabled === true` at high; session attach with `devicePixelRatio()` 3 applies `setPixelRatio(2)`; rendering goes through the composer. Scene half untouched (T3).
- AC-7 (renderer half) → met: medium builds exactly `[RenderPass, UnrealBloomPass, OutputPass]`, no `SSAOPass` constructed, bloom parameters pinned; shadows stay enabled; the medium tier change applies `setPixelRatio(1.5)` in the same frame before the render. Scene half untouched (T3).
- AC-8 (renderer half) → met: low never constructs an `EffectComposer` (adapter bypass), each `render` is exactly one `renderer.render(scene, camera)`, `renderer.shadowMap.enabled === false` after the transition, and the session applies `setPixelRatio(1)` before the low frame's render. Scene half untouched (T3).
- AC-9 → met: same-tier `setQuality` is a no-op (composer disposed 0 times); every replaced composer is disposed exactly once; the next render builds the new tier's pass list (`'medium'`/`'high'` fourth argument pinned); the last `setSize`/`setPixelRatio` are replayed exactly once (last value wins); `render` after `dispose` remains a no-op and constructs nothing (existing test green).
- AC-10 → met: attach order is `setQuality:high → setPixelRatio:2 → setSize:800:600`; the high→medium frame order is `setQuality:medium → setPixelRatio:1.5 → setSize:800:800 → render`; the medium→low frame order is `setQuality:low → setPixelRatio:1 → setSize:800:800 → render`; stable frames add neither `setQuality` nor a pixel-ratio apply; the production adapter contract test drives the same sequence.
- AC-14 → met: the named `'receives welcome after a detached retryConnection → join(account) → attach cycle'` test records `['join:account', 'onMessage', 'onStatus', 'connect']`, asserts `connectCount() === 1` and `closeCount() === 0`, the world `serverId === 42`, and the next frame advances the intro to `16 / 2500`; the existing attached-retry test (close+connect once) and the unchanged `transport.test.ts` are green in the full suite.

Deviations from spec:
- `src/frontend/src/game/session-spaceship.test.ts` is outside T2's `files_owned` and received only the compile-required addition of `setQuality() {}` to its two inline `rendererFactory` literals (the `RendererAdapter` interface gained a required method). No behavior or assertion changed; no other task owns that file.
- `createPostprocessing` at low builds `RenderPass + OutputPass` if called directly (the task's explicit conditional rule); the production adapter never calls it at low, and the low bypass is pinned in `webgl.test.ts`.
