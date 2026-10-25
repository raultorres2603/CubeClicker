---
feature: fullscreen-responsive-layout
revision: 2
---
# Plan — Fullscreen Responsive Layout

## Architecture
Frontend-only. Three seams:
1. **Viewport/CSS** (`index.html`, `app.css`, `App.tsx`, `Hud.tsx`): full-viewport root, overlays, safe-area insets.
2. **Renderer sizing** (`game/session.ts` `applyViewport`): `applyViewport` owns sizing — adapter `setPixelRatio` + `setSize` + camera aspect/projection. Resize handling is debounced on the injected `env.resize` source; an `env.orientation` source triggers an immediate apply. No sizing in `render/scene.ts`.
3. **Touch input**: no new module — reuse the existing Pointer Events path; classification already handles tap vs drag and is pointerType-agnostic. Tap explodes; drag does nothing (parity with mouse). Only CSS tap-target sizing and layout changes.

## Current-defect analysis (file:line)
- `src/frontend/src/ui/app.css:19-21` — `html, body, #root { height: 100%; }` relies on parent height chain; on mobile dynamic toolbars this can leave gaps/scroll. No `100dvh`/`100vw`.
- `src/frontend/src/ui/app.css:25-31` — `body { overflow: hidden }` hides scroll but does not guarantee full fill on small viewports; no safe-area handling.
- `src/frontend/src/ui/app.css:33-37` — `main { width:100%; height:100% }` (percentage, not viewport units); overlays use `1rem` offsets not safe-area aware.
- `src/frontend/src/ui/app.css:147` — `.user-panel { max-width: min(20rem, calc(100vw - 2rem)) }` uses viewport width but no safe-area.
- `src/frontend/src/App.tsx:92` — `<main>` has no explicit viewport sizing class; relies on CSS.
- `src/frontend/src/ui/Hud.tsx:27` — `<section>` positioned by `app.css main > section` (top/left 1rem); no safe-area.
- `src/frontend/src/main.tsx:5-11` — mounts into `#root`; no app-level resize bootstrap needed (ResizeObserver in `browser-env.ts`).
- `src/frontend/src/browser-env.ts:57-63` — resize reader is a `ResizeObserver` on the canvas only; no `orientationchange` listener.
- `src/frontend/src/game/session.ts` (`applyViewport`, ~793-801) — sizes synchronously on every resize emission; no debounce; reads `env.devicePixelRatio()` and `target.getBoundingClientRect()`.
- `src/frontend/index.html:5` — viewport meta present but no `viewport-fit=cover` for safe areas.

## Resize data flow
1. **Attach** (direct, not debounced): `applyViewport()` reads `target.getBoundingClientRect()` and calls `adapter.setPixelRatio(min(env.devicePixelRatio(), PIXEL_RATIO_CAP))`, `adapter.setSize(rect.width, rect.height)`, then sets `view.camera.aspect = rect.height > 0 ? rect.width / rect.height : 1` and calls `view.camera.updateProjectionMatrix()`.
2. **`env.resize` emission** (ResizeObserver on the canvas): schedule a trailing debounce of ≤ 16 ms (`setTimeout`) before `applyViewport`; each new emission clears the pending timer and reschedules. No synchronous apply.
3. **`env.orientation` emission** (window `orientationchange`): call `applyViewport()` immediately and clear any pending debounced timer.
4. **Teardown**: cancel any pending debounced timer; unsubscribe from both `env.resize` and `env.orientation`.

## Touch input design
- Reuse Pointer Events path; classification (tap < 40 px → explode on front face; drag ≥ 40 px → classified drag) is already pointerType-agnostic.
- Session policy: `playing` + tap → explode; `playing` + drag → nothing (no rotation, no explosion, no publish, snapshot identity unchanged); `intro` + tap → skip; `travel` → ignore. Touch follows the same gates.
- No new input module; only CSS tap-target sizing (AC-13).
- Mobile rotation limitation: without pointer-drag rotation, a phone without a keyboard relies on the engine's automatic face-clear auto-rotation; no virtual joystick is added (Q-1).

## Performance
- Rely on existing caps (`PIXEL_RATIO_CAP = 2`, `STAR_COUNT = 1200`, `PARTICLE_POOL_CAP = 72`). No new quality tier (Q-4).
- Reduced-motion already handled by the existing profile; unchanged.

## Risks & mitigations
- Mobile dynamic toolbars causing 1px gaps → use `100dvh` with `100vh` fallback (AC-2).
- Resize thrashing on orientation change → trailing debounce ≤ 16 ms + immediate orientation apply (AC-8).
- Tap targets too small on mobile → min 44 px in CSS (AC-13).
- Overlap of HUD/panel in portrait → keep corner overlays + safe-area (Q-3).
- Mobile rotation limitation (no manual rotate without a keyboard) → stated explicitly; auto-rotate covers face navigation; virtual joystick is a follow-up (Q-1).
- WebGL context loss on mobile (common) → **out of scope** for v1; a browser reload recovers. Rationale: no recovery code is added to keep scope additive; context-loss recovery is a candidate follow-up feature (see review notes).
- Debounce vs. existing session tests → session tests updated with fake timers (trailing shape); attach-time apply stays direct.

## Interfaces / contracts

- `SessionEnvironment` (in `game/session.ts`) gains an optional `orientation?: { subscribe(cb: () => void): () => void }` source. When present, the session subscribes and calls `applyViewport()` immediately on each emission; teardown unsubscribes.
- `browser-env.ts` implements `orientation` by listening to `window 'orientationchange'` (and `screen.orientation 'change'` where available) and calling `cb`; teardown removes the listener.
- Debounce state inside `attach`: a `resizeTimer: ReturnType<typeof setTimeout> | null`. `onResize` clears any pending timer and schedules `setTimeout(() => { resizeTimer = null; applyViewport(); }, 16)`. Teardown clears `resizeTimer`.
- `applyViewport()` (unchanged signature, internal) as specified in § Resize data flow step 1.
- `RendererAdapter`, `ResizeSource`, and the canvas `CanvasLike` contract are unchanged.

## File inventory
| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/index.html` | Edit | viewport meta + `viewport-fit=cover` |
| `src/frontend/src/ui/app.css` | Edit | full-viewport sizing, safe-area insets, tap targets, no letterboxing |
| `src/frontend/src/App.tsx` | Edit | shell layout / viewport sizing class |
| `src/frontend/src/main.tsx` | Edit (minor) | unchanged mount; documented as no resize bootstrap |
| `src/frontend/src/App.test.tsx` | Edit | SSR markup/CSS assertions if classes added |
| `src/frontend/src/ui/Hud.tsx` | Edit | responsive placement |
| `src/frontend/src/ui/Hud.test.tsx` | Edit | markup assertions |
| `src/frontend/src/ui/UserPanel.tsx` | Edit | responsive placement |
| `src/frontend/src/ui/ConnectionBanner.tsx` | Edit | responsive placement |
| `src/frontend/src/game/session.ts` | Edit | `applyViewport` + debounced resize + orientation handling |
| `src/frontend/src/game/session.test.ts` | Edit | fake-timer resize tests; touch/spectate gating |
| `src/frontend/src/browser-env.ts` | Edit | orientationchange listener |

## Key decisions
| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Sizing owned by `session.applyViewport`, not a scene adapter | Matches the existing code and tests; avoids inventing `scene.setSize` | Adding `scene.setSize` (rejected: duplicates ownership) |
| 2 | Trailing debounce ≤ 16 ms via `setTimeout`; attach direct | Matches the existing rotate coalescing timer; testable with fake timers; keeps first paint immediate | rAF debounce (rejected: harder to test deterministically) |
| 3 | `orientationchange` as an additional immediate trigger | Faster than waiting for the ResizeObserver on some devices | Relying on ResizeObserver only (rejected: F11 asks explicit trigger) |
| 4 | Touch tap explodes, drag does nothing | Retains the accepted predecessor contract (no pointer-drag rotation) | Reintroducing drag rotation (rejected: scope creep, breaks accepted contract) |
| 5 | No virtual joystick; auto-rotate + keyboard | Gesture-only reuses pointer model; avoids extra UI | Virtual joystick (deferred follow-up) |
| 6 | WebGL context loss out of scope | Keeps change additive; browser reload recovers | Minimal recovery (deferred follow-up) |
| 7 | No portrait breakpoint | Safe-area insets + existing max-width clamp suffice (Q-3) | Breakpoint-based layout (deferred) |

## Dependency requests
None. No new dependencies.

## Container impact
None. No new services/images/ports/env/health. Additive-only; smoke unchanged.