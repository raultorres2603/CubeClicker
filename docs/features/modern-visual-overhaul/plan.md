---
feature: modern-visual-overhaul
revision: 2
---

# Plan — Modern Visual Overhaul

## Architecture

All changes live in the frontend render/UI layer. No backend, protocol, container, or persistence change.

- **Starfield (`render/starfield.ts`)**: raise the brightness floor to `STAR_MIN_BRIGHTNESS === 0.75` and point size to `STAR_SIZE === 0.8`; set material opacity base to `1.0`; add a slow twinkle by accumulating `pulseTimeMs` in `update` and modulating `material.opacity` (pinned formula, reduced-motion amplitude `0`); expose `pulseTimeMs` (readonly) and `averageBrightness` (readonly). Export `STAR_MIN_BRIGHTNESS`, `STAR_SIZE`, `STARFIELD_OPACITY_BASE`, `STARFIELD_OPACITY_AMPLITUDE`, `STARFIELD_PULSE_PERIOD_MS`. Accept an optional `reducedMotion` argument on `update` (4th param) and forward the scene's flag.
- **Shadows & lighting (`render/scene.ts`, `render/cube-view.ts`, `render/webgl.ts`)**: enable shadow maps in the WebGL renderer; set `castShadow` on the key directional light and its shadow map size to `1024 × 1024`; set `castShadow`/`receiveShadow` on the cube body and each face `InstancedMesh`; scale ambient intensity by `starfield.averageBrightness` (clamped) on construction only (no rebuild path).
- **Spaceship fighter refinement (`render/spaceship.ts`)**: refine into a fighter silhouette — cone nose, cylinder body, sphere cockpit, two `BoxGeometry` wings named `'wing'`, engine glow via emissive materials — while preserving constants, follow math, shots, and ignitions. All meshes under `spaceship.group` use `MeshStandardMaterial` with `metalness >= 0.4` and `roughness <= 0.6`; shot spheres (under `shotsGroup`) keep `MeshBasicMaterial` and are unconstrained.
- **HUD motion (`ui/Hud.tsx`, `ui/app.css`)**: add optional `minimized`/`onToggleMinimize` props and a toggle button (last child, calls `onToggleMinimize` on click); add `data-minimized` when minimized; add CSS transitions for hover/active/minimize, a `pointer-events: auto` rule for `main > section button`, and a reduced-motion override.
- **App wiring (`ui/App.tsx`)**: hold local `hudMinimized` state and pass it to `Hud` only in the welcomed branch; the pre-welcome stats section stays unchanged (F11).

State ownership: `hudMinimized` is local React state in `App`; all 3D visual state remains in the render adapters. No shared state.

## Interfaces / contracts

- `Starfield.pulseTimeMs: number` (readonly) — accumulated pulse phase in ms.
- `Starfield.averageBrightness: number` (readonly) — mean of all per-star RGB color channel values.
- `Starfield.update(dtMs, travelProgress?, anchor?, reducedMotion?)` — advances `pulseTimeMs` by `max(0, dtMs)`; applies twinkle unless `reducedMotion` is true.
- Constants exported from `render/starfield.ts`: `STAR_MIN_BRIGHTNESS`, `STAR_SIZE`, `STARFIELD_OPACITY_BASE`, `STARFIELD_OPACITY_AMPLITUDE`, `STARFIELD_PULSE_PERIOD_MS`.
- `Hud` props gain `minimized?: boolean` and `onToggleMinimize?: () => void`.
- `createWebGLRenderer` sets `renderer.shadowMap.enabled = true` (and a soft shadow type where available).
- Cube body and face meshes set `castShadow = receiveShadow = true`.
- Key directional light sets `castShadow = true` and `shadow.mapSize.set(1024, 1024)`.
- Ambient light intensity set on construction: `AMBIENT_INTENSITY * clamp(starfield.averageBrightness, 0.5, 1.0)`.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/render/starfield.ts` | Edit | Brighter stars, twinkle, pulseTimeMs, averageBrightness, exports |
| `src/frontend/src/render/starfield.test.ts` | Edit | Pin new constants/behaviour |
| `src/frontend/src/render/scene.ts` | Edit | Star-driven ambient, shadow flags on light |
| `src/frontend/src/render/scene.test.ts` | Edit | Assert shadow/star-driven config |
| `src/frontend/src/render/cube-view.ts` | Edit | Shadow flags on body/faces |
| `src/frontend/src/render/cube-view.test.ts` | Edit | Assert shadow flags |
| `src/frontend/src/render/webgl.ts` | Edit | Enable shadow maps |
| `src/frontend/src/render/webgl.test.ts` | Edit | Assert shadow map enablement (mock gains shadowMap) |
| `src/frontend/src/render/spaceship.ts` | Edit | Fighter silhouette + materials + wings |
| `src/frontend/src/render/spaceship.test.ts` | Edit | Pin geometry/material (wing meshes; standard materials) |
| `src/frontend/src/ui/Hud.tsx` | Edit | Minimize props + toggle |
| `src/frontend/src/ui/Hud.test.tsx` | Edit | Minimize assertions |
| `src/frontend/src/ui/app.css` | Edit | Hover/click/minimize animations + reduced-motion + pointer-events |
| `src/frontend/src/ui/app.css.test.ts` | Edit | CSS guards |
| `src/frontend/src/App.tsx` | Edit | hudMinimized state wiring (Hud branch only) |
| `src/frontend/src/App.test.tsx` | Edit | Minimize wiring tests |
| `README.md` | Edit | Documentation pass (final) |
| `docs/features/README.md` | Edit | Feature row (orchestrator) |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Keep one feature for all visual changes | Matches user request as a single overhaul | Split into multiple features (Q-6) |
| 2 | Enable real shadow maps | Delivers actual shadows vs. faked shading | Material-only shading (Q-4) |
| 3 | Twinkle via opacity modulation | Cheap, testable, no new objects | Per-star color animation (costly) |
| 4 | HUD minimize collapses stats only | Preserves panel/toggle visibility | Full panel hide (Q-3) |
| 5 | Local React state for minimize | No persistence or server impact | Persisted preference |
| 6 | Star-driven ambient fill only (no key-light/shadow scaling) | Keeps shadow strength fixed and testable; matches F4 reword | Scale key light/shadow with brightness |
| 7 | Reduced-motion opacity pinned to 1.0 | Removes open question; matches "twinkle disabled" | Keep 0.95 base |

## Risks & mitigations

- Shadow maps may hurt performance on low-end devices → keep map size 1024 and disable under reduced motion if needed.
- Twinkle opacity changes could affect contrast → amplitude small (0.05 around 0.95).
- Strict Hud tests may break → minimize props are optional and default markup unchanged.
- Large scene.ts edits risk regressions → keep changes to light flags and ambient scaling only.
- Webgl test mock must gain a `shadowMap` handle to assert enablement (builder updates mock).

## Open questions

See spec.md § Open questions (Q-1…Q-6). Containerization: none (frontend source only). Real-time: local-only visuals. HUD minimize applies only to the welcomed `Hud` branch; the pre-welcome stats section is unchanged (F11).<|end|><|start|>Assistant to=bash<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd /var/home/raultorraco/Documents/Projects/CubeClicker && git diff --stat