---
feature: modern-visual-overhaul
revision: 2
status: draft
created: 2026-10-28
updated: 2026-10-28
---

# Spec — Modern Visual Overhaul

## Summary

A frontend-only visual modernization of the CubeClicker game. The starfield becomes brighter and gently animated, the cube and mini-cubes gain shadows and an ambient fill light whose intensity tracks starfield brightness, the spaceship is refined into a more bullet/fighter-like craft with modern materials and lighting, and the HUD/overlays gain hover, click and minimize animations. The overall aesthetic moves toward a more modern, animated presentation while keeping game rules, state, networking and persistence untouched. All changes are local to one client: no shared or cross-client state, backend, protocol, container, or persistence change is made.

## User stories

- As a player, I see a brighter, subtly animated starfield so the backdrop feels alive.
- As a player, the cube and mini-cubes show shadows, and the scene's ambient fill light tracks starfield brightness, so lighting feels coherent.
- As a player, the spaceship reads as a small bullet/fighter craft with modern materials and engine glow, not a primitive toy.
- As a player, the HUD and overlays animate on hover, click and minimize, so the interface feels responsive and modern.
- As a player who prefers reduced motion, all new animations collapse or disable, so there is no motion sickness.

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`.

- **AC-1 — Brighter starfield constants.** `STAR_MIN_BRIGHTNESS === 0.75` and `STAR_SIZE === 0.8`; the starfield `PointsMaterial.opacity` base is `1.0` (twinkle modulation is applied on top of this base). `STAR_COUNT` remains `1200`. `STAR_MIN_BRIGHTNESS` and `STAR_SIZE` are exported from `src/frontend/src/render/starfield.ts`; `STAR_COUNT` is exported from `src/frontend/src/game/effects.ts`. Evidence: `starfield.test.ts`.

- **AC-2 — Starfield twinkle.** `Starfield` exposes `readonly pulseTimeMs: number` (the accumulated pulse phase) and `readonly averageBrightness: number` (see AC-3). `createStarfield` and `Starfield.update` have the following contract:
  - `Starfield.update(dtMs, travelProgress?, anchor?, reducedMotion?)` advances `pulseTimeMs` by `Math.max(0, dtMs)` on every call.
  - `reducedMotion` defaults to `false` when omitted.
  - Pinned constants, all exported from `src/frontend/src/render/starfield.ts`: `STARFIELD_OPACITY_BASE === 1.0`, `STARFIELD_OPACITY_AMPLITUDE === 0.1`, `STARFIELD_PULSE_PERIOD_MS === 4000`.
  - When `reducedMotion` is `false`, `points.material.opacity = STARFIELD_OPACITY_BASE - STARFIELD_OPACITY_AMPLITUDE * (0.5 - 0.5 * cos(2π * pulseTimeMs / STARFIELD_PULSE_PERIOD_MS))`.
  - When `reducedMotion` is `true`, the twinkle amplitude is effectively `0`, so `points.material.opacity === STARFIELD_OPACITY_BASE` (`1.0`) regardless of `pulseTimeMs`.
  - After `update(1000)` from a freshly created starfield, `pulseTimeMs === 1000` and `points.material.opacity` equals `1.0 - 0.1 * (0.5 - 0.5 * cos(2π * 1000 / 4000))` within `1e-6`.
  Evidence: `starfield.test.ts`.

- **AC-3 — Star-driven fill light.** `Starfield.averageBrightness` is the mean of all per-star RGB color channel values (range `0..1`). On construction, the scene sets its ambient light intensity to `AMBIENT_INTENSITY * clamp(averageBrightness, 0.5, 1.0)` (`AMBIENT_INTENSITY === 0.6`). The starfield is created once per scene; no rebuild path re-applies this value. Evidence: `starfield.test.ts`, `scene.test.ts`.

- **AC-4 — Shadow configuration.** The scene's key directional light has `castShadow === true` and `shadow.mapSize` of `1024 × 1024`; the cube body mesh and every face `InstancedMesh` have both `castShadow === true` and `receiveShadow === true`; `createWebGLRenderer` enables `renderer.shadowMap.enabled === true`. Evidence: `scene.test.ts`, `cube-view.test.ts`, `webgl.test.ts`.

- **AC-5 — Spaceship fighter refinement.** `createSpaceship().group.scale` is `(SPACESHIP_SCALE, SPACESHIP_SCALE, SPACESHIP_SCALE)` with `SPACESHIP_SCALE === 1.2` (exported from `src/frontend/src/game/effects.ts`). The group contains at least one `Mesh` whose `geometry.type === 'ConeGeometry'` (nose), at least one whose `geometry.type === 'CylinderGeometry'` (body), and at least two `Mesh`es named `'wing'` whose `geometry.type === 'BoxGeometry'`. All meshes under `spaceship.group` (excluding the separate `shotsGroup`) use `MeshStandardMaterial` with `metalness >= 0.4` and `roughness <= 0.6`; at least one mesh has `emissive` non-zero (engine glow). `SPACESHIP_IGNITION_COUNT` remains `2` (exported from `src/frontend/src/game/effects.ts`). Evidence: `spaceship.test.ts`.

- **AC-6 — HUD minimize support.** `Hud` accepts optional props `minimized?: boolean` (default `false`) and `onToggleMinimize?: () => void`. When `onToggleMinimize` is provided, the section renders a `<button type="button" aria-expanded={!minimized} aria-label="Toggle HUD">` placed as the last child of the section; the button calls `onToggleMinimize` on click and is a normal focusable button. When `onToggleMinimize` is not provided, no button is rendered. When `minimized` is `true`, the section carries `data-minimized="true"`; otherwise it carries no `data-minimized` attribute. Evidence: `Hud.test.tsx`.

- **AC-7 — Overlay hover/click/minimize animations.** `app.css` contains, for `main > section` and its minimize button, `transition` rules with duration `<= 200ms`; the minimize button's `:active` rule applies `transform: scale(0.97)` (or equivalent `scale(0.98)`); `main > section[data-minimized="true"]` collapses the stat paragraphs (e.g. `max-height: 0; opacity: 0; overflow: hidden`). A `main > section button` rule grants `pointer-events: auto` so the minimize button is clickable despite the section's `pointer-events: none`. A `@media (prefers-reduced-motion: reduce)` block disables these transitions/animations. Evidence: `app.css.test.ts` (grep guards).

- **AC-8 — Reduced motion.** All new CSS animations/transitions are disabled under `prefers-reduced-motion: reduce`; the starfield twinkle amplitude becomes `0` under reduced motion, so `points.material.opacity` stays `1.0` constant (see AC-2). Evidence: `starfield.test.ts`, `app.css.test.ts`.

- **AC-9 — No backend/container change.** `git diff` is empty for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, `src/frontend/Dockerfile`, and any other `**/Dockerfile` in the tree. Verification command: `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'`. Evidence: final build log.

- **AC-10 — Coverage.** `npm run coverage` (both workspaces) exits 0 with ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` is the task-level check. Evidence: final build log.

## Non-goals

- No change to game rules, stats, intents, phase sequencing, level progression, server protocol, or persistence. Engine's `explodeMiniCube` untouched; `clicks` and board removal stay synchronous.
- No multiplayer visibility of the new visuals: they remain local to one client.
- No new dependencies, no textures/assets, no shaders, no audio.
- No browser automation or pixel/perceptual tests.
- No change to spaceship shot timing or deferred explosion semantics.
- No real shadow-map tuning beyond enabling shadows; advanced shadow (PCSS, cascades) out of scope.
- No redesign of auth overlays beyond the CSS transition additions.
- No scaling of key-light intensity or shadow strength with starfield brightness: only the ambient fill light tracks `averageBrightness` (AC-3). Shadow strength stays fixed.
- No persistence or cross-client propagation of HUD minimize state.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named tree-shakeable imports from `three`; tests with concrete expected values beside every behavior change; run lint, typecheck, tests, and the coverage command before reporting done; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation from this spec; touching any file outside a task's `files_owned`; any coverage exclusion or threshold change; any change to backend/container files.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, or configs; use `import *` from `three`; read browser globals inside `game/**` or pure render math; push; rewrite predecessor specs.

## Security considerations

- **No new dependencies.** Only existing `three` named imports (including `BoxGeometry` where needed); lockfile untouched.
- **No user data, storage, or network.** All visual state is in-memory per client; nothing is persisted or sent. HUD minimize state is local component state.
- **Rendering safety.** Fully procedural geometry; no loaders, textures, or external assets; no `innerHTML`.
- **Resource bounds.** Shadows and twinkle reuse existing objects; no unbounded growth. `dispose()` unchanged in contract.
- **Test integrity.** Coverage bar and concrete-assertion rule protect unchanged pure logic and server-authority paths.

## Real-time impact

**None for shared state.** The starfield brightness, shadows, spaceship refinement, HUD minimize and overlay animations are client-local visuals: no shared or cross-client state is created or read, no protocol message is added, and connection lifecycle, reconnection, multi-client behavior, and server authority are unaffected (they remain as in predecessor features). **Open question Q-1** carries over whether other clients should see a player's spaceship; the default (local-only) is chosen and flagged.

## Containerization impact

**None expected.** Frontend source changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it. AC-9 pins the container-file diff gate.

## Testing strategy

- **Unit (Vitest, node environment):** `starfield.test.ts` pins new brightness/size/opacity/twinkle constants, `pulseTimeMs`, `averageBrightness` and reduced-motion opacity; `spaceship.test.ts` pins fighter geometry/material constants (including wing meshes and standard materials, replacing the prior "no BoxGeometry" assertion); `Hud.test.tsx` pins minimize props; `webgl.test.ts` pins shadow-map enablement (mock gains a `shadowMap` handle); `app.css.test.ts` pins CSS guards (transitions, scale, collapse, reduced motion, pointer-events).
- **Integration (same node environment — real three.js scene graph):** `scene.test.ts` asserts shadow config and star-driven ambient fill; `scene-spaceship.test.ts` unchanged behavior; `cube-view.test.ts` asserts shadow flags on meshes.
- **E2E / container:** no browser automation (predecessor non-goal retained); `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). If a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.

## Open questions

- **Q-1 — Cross-client visibility (carried over, user checkpoint).** Default: the spaceship, shadows and HUD animations are local to one client. Broadcasting a lightweight pointer position would need a protocol addition and server authority; not implemented. Choosing it requires a spec revision.
- **Q-2 — Visual vs. state timing (carried over, user checkpoint).** Default: game state (board/stats) stays synchronous at click; only the explosion visual (pop + burst) is delayed to shot arrival. Delaying the engine's `explodeMiniCube` itself changes game rules and is not implemented.
- **Q-3 — HUD minimize semantics.** Default: minimize collapses the stat paragraphs inside the HUD panel but keeps the panel (and its toggle) visible. Alternative: hide the entire panel. Choosing the alternative requires a spec revision and test updates.
- **Q-4 — Shadow implementation.** Default: enable three.js shadow maps on the existing directional key light and set cast/receive flags on meshes. Alternative: simulate shadows via material shading only. The default changes `webgl.ts` constructor usage and is flagged.
- **Q-5 — Brightness thresholds and animation periods.** The pinned values (0.75 brightness floor, 4000 ms twinkle period, 0.1 amplitude around 1.0 base, 1024 shadow map) are defaults; tuning is a constant edit plus a spec note.
- **Q-6 — Feature scope.** The request bundles several visual changes. Default: one feature. If review finds the scope too large for one build, split into `bright-starfield`, `shadow-lighting`, `fighter-spaceship`, `hud-motion` and sequence them; requires user approval.

## Assumptions

- The pointer is tracked via Pointer Events on the canvas (existing single input path); unchanged.
- Shadow maps require renderer support; the mock-based webgl tests are updated to assert `shadowMap.enabled` (the mock gains a `shadowMap` handle).
- HUD minimize state is local React state in `App` (or `Hud`), not persisted.
- Predecessor specs/plan/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: `three@0.186.1` / `@types/three@0.186.0`, TypeScript strict, Vitest, ESLint; the project testing bar governs.
- `reducedMotion` propagates to the starfield via the optional fourth parameter of `Starfield.update`; the scene forwards its `reducedMotion` flag each frame.

## Revision history

- r1 — 2026-10-28 — initial draft (planning phase).
- r2 — 2026-10-28 — spec review r1 revisions: F1 (AC-2 formula cleaned to single pinned form), F2 (pulse phase contract + reducedMotion propagation + opacity pin 1.0), F3 (constant export modules stated), F4 (user story reworded to star-driven fill light; shadow strength fixed non-goal), F5 (HUD button onClick + pointer-events auto), F6 (container verification command corrected), F7 (rebuild clause removed), F8 (spaceship mesh scope clarified), F9 (spaceship test edit noted), F10 (button focus/render condition clarified), F11 (minimize scope recorded in plan). Bumped revision 1 → 2.<|end|><|start|>Assistant to=bash<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd /var/home/raultorraco/Documents/Projects/CubeClicker && git diff --stat