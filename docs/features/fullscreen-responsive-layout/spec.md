---
feature: fullscreen-responsive-layout
revision: 2
status: draft
created: 2026-10-23
updated: 2026-10-23
---
# Spec — Fullscreen Responsive Layout

## Summary

Make CubeClicker fill the entire browser viewport (no letterboxing, no scrollbars, no unused margins) and be playable on small touch devices. The work is frontend-only and additive: viewport/CSS sizing, a debounced resize path that keeps the WebGL renderer and camera projection in sync with the canvas through the session's `applyViewport`, touch input that reuses the existing Pointer Events path (tap explodes; drag does nothing, identical to mouse), and responsive HUD/panel/banner placement with safe-area insets. No backend, WebSocket, protocol, or gameplay-rule changes. Mobile rotation is deliberately limited: phones without an attached keyboard rely on the engine's automatic face-clear auto-rotation; no virtual joystick is added. WebGL context loss on mobile is an out-of-scope limitation (a browser reload recovers).

## Scope

### In scope
- `src/frontend/index.html` viewport meta + `viewport-fit=cover` + safe-area-friendly root.
- `src/frontend/src/ui/app.css` full-viewport sizing (`100vw`/`100vh` with `100dvh` where supported), no scrollbars, overlay HUD/panel/banner with safe-area insets, portrait + landscape.
- `src/frontend/src/ui/Hud.tsx` responsive placement.
- `src/frontend/src/App.tsx` shell layout (canvas + overlays).
- `src/frontend/src/game/session.ts` `applyViewport` + debounced resize/orientation handling using `env.resize` / `env.orientation` and `env.devicePixelRatio()`.
- `src/frontend/src/browser-env.ts` ResizeObserver (existing) plus an `orientationchange` listener.
- Touch input: tap to explode (parity with mouse tap); drag does nothing (parity with mouse drag); no conflict with spectating travel.
- Reduced-motion honored (existing); no new quality tier.
- Accessibility: tap targets ≥ 44px on the three interactive shell controls, focus, live region retained.

### Explicitly out of scope
- Backend/WS/protocol changes, new services/images/ports/env.
- Orientation lock, PWA manifest (Q-6), virtual joystick (Q-1).
- New dependencies, new quality tiers, new test environments.
- Changes to game logic, engine, multiplayer state, or container assets.
- Pointer-drag rotation (removed by the accepted predecessor; not reintroduced).
- WebGL context-loss recovery (out-of-scope limitation; a browser reload recovers — see Risks).

## User stories
- As a mobile player, I want the game to fill my phone screen in portrait or landscape, so I can play without letterboxing.
- As a player rotating my device, I want the renderer and camera to follow the new size instantly, so nothing is cropped or stretched.
- As a touch player, I want tap-to-explode (identical to a mouse tap) and for drags to do nothing (no accidental rotation, no page scroll), so play feels native.
- As a keyboard/screen-reader user, I want tap targets ≥ 44px on the shell controls and the live region retained, so the game stays accessible.
- As a mobile player without an attached keyboard, I rely on the engine's automatic face-clear auto-rotation for face navigation (limitation; see Q-1).

## Acceptance criteria

- **AC-1 — Full viewport fill.** With the app loaded in a browser window of arbitrary size, `document.documentElement` has no vertical/horizontal scrollbar and `main` occupies the full viewport (width = `window.innerWidth`, height = `window.innerHeight` within 1px) in both portrait and landscape. Evidence: `App.test.tsx`/CSS inspection + manual browser pass recorded in the build log (steps in § Testing strategy).
- **AC-2 — Dynamic viewport units.** `app.css` uses `100dvh` (with `100vh` fallback) for root/main height so mobile dynamic toolbars do not leave gaps or cause scroll. Evidence: grep for `100dvh` and `100vh` in `app.css`.
- **AC-3 — No letterboxing.** The canvas element's bounding box equals the viewport (no aspect-ratio box, no `max-width`/`max-height` clamping on `main` or `canvas`). Evidence: grep/inspection of `app.css` (no fixed width/max-width on `main`/`canvas`/`#root`).
- **AC-4 — Overlaid HUD/panels.** HUD, connection banner, and users panel are absolutely positioned overlays with `pointer-events` only on interactive parts; they do not push the canvas or create scroll. Evidence: existing CSS rules retained; `App.test.tsx` SSR markup unchanged except responsive classes if added.
- **AC-5 — Safe-area insets.** Overlays respect `env(safe-area-inset-*)` on notched devices (top/left/right/bottom padding ≥ safe-area inset). Evidence: grep for `safe-area-inset` in `app.css`; manual inspection.
- **AC-6 — Resize updates renderer.** On an emission of the injected resize source (the `ResizeObserver` on the canvas in `browser-env.ts`) or the orientation source, `applyViewport` runs: `adapter.setPixelRatio(min(env.devicePixelRatio(), PIXEL_RATIO_CAP))` (cap 2) and `adapter.setSize(rect.width, rect.height)` with `rect = target.getBoundingClientRect()`. Evidence: `session.test.ts` with injected sizes and ratios (concrete values, e.g. dpr 3 → 2), including an empty rect.
- **AC-7 — Camera aspect follows size.** After `applyViewport`, `view.camera.aspect === (rect.height > 0 ? rect.width / rect.height : 1)` and `updateProjectionMatrix` is invoked. Evidence: `session.test.ts`.
- **AC-8 — Debounced resize.** Resize-source emissions are trailing-debounced by ≤ 16 ms (`setTimeout`): an emission schedules `applyViewport` after ≤ 16 ms and does not apply it synchronously; the attach-time `applyViewport` is direct and not debounced; an orientation-source emission applies `applyViewport` immediately (clearing any pending debounced timer); teardown cancels any pending debounced timer and unsubscribes both sources. Evidence: `session.test.ts` with fake timers (concrete: no renderer call until the timer fires; after ≤ 16 ms the call occurs; an orientation emission applies synchronously).
- **AC-9 — Touch tap explodes.** A touch tap (pointer gesture < `TAP_DRAG_THRESHOLD_PX` 40 px) on the own cube's front face explodes the picked mini-cube, identical to a mouse tap. Evidence: `gestures.test.ts`/`session.test.ts` (classification is pointerType-agnostic; no logic change).
- **AC-10 — Touch drag does nothing.** A touch drag beyond the threshold commits no action: no rotation, no explosion, no dispatch, snapshot identity unchanged — identical to a mouse drag. Evidence: same tests with pointerType-agnostic paths.
- **AC-11 — No conflict with spectating travel.** During spectate travel and spectating view-only mode, touch input is gated exactly like mouse/keyboard (no dispatch). Evidence: `spectate.test.ts`/`session.test.ts`.
- **AC-12 — No virtual joystick in v1.** Gesture-only (tap explodes, drag does nothing); no on-screen joystick/rotate control is added. Evidence: no new input UI elements; inspection. Mobile rotation relies on auto-rotate after face clear plus any attached keyboard (limitation stated in Q-1).
- **AC-13 — Tap targets ≥ 44px.** The three interactive shell controls (Users on Server, Return to my cube, Retry) have `min-width`/`min-height` of 44 CSS px (or equivalent padding) in `app.css`, with no markup change. Canvas focus is not a tap target. Evidence: `app.css` (`min-width`/`min-height: 44px`) + inspection.
- **AC-14 — Accessibility retained.** Focusable canvas with stable aria-label, single `role="status" aria-live="polite"` region in all phases, reduced-motion profile unchanged, no orientation lock. Evidence: `App.test.tsx` SSR markup; `index.html` has no `orientation` lock meta.

## Non-goals
- No backend/WS/protocol changes; no shared-state changes.
- No PWA manifest, no orientation lock, no virtual joystick.
- No new dependencies, no new quality tier, no new test environments.
- No changes to game logic, engine, or multiplayer state.
- No container/Dockerfile/compose changes (additive-only).
- No pointer-drag rotation (predecessor contract retained).
- No WebGL context-loss recovery (out-of-scope limitation; a browser reload recovers).

## Boundaries
- ✅ Always: keep changes within the listed shared files; tests with concrete values; run lint/typecheck/tests/coverage before done; stage only owned files.
- ⚠️ Ask first: any new dependency; any change to a file outside `files_owned`; any pinned-constant change; any coverage exclusion/threshold change.
- 🚫 Never: weaken assertions; touch `.env*`/secrets; edit backend/container files; edit predecessor specs; push.

## Security considerations
- No new user-controlled data, no persistence, no secrets, no new deps.
- Rendering safety unchanged (procedural geometry, no loaders).
- Containerization: no impact (no new services/images/ports/env/health). Additive-only.

## Real-time contract
- **Out of scope for this feature.** No broadcast/WS changes; connection lifecycle, reconnection, multi-client behavior, and server authority are untouched and remain governed by `multiplayer-servers`. Smoke test must still pass unchanged.

## Containerization impact
- **None (explicitly out of scope / additive-only).** No new services, images, ports, env vars, or health signals; compose files, Dockerfiles, and README unchanged. `npm run smoke` remains the unchanged container regression check.

## Testing strategy
- Unit: `session.test.ts` (attach/`applyViewport` with concrete sizes/ratios; debounced resize with fake timers; orientation immediate; touch tap/drag dispatch; spectate gating); CSS/layout assertions in `App.test.tsx`.
- Integration: `session.test.ts` (real engine + real three.js scene, injected environment); `browser-env.ts` orientation listener (where exercised).
- E2E/container: `npm run smoke` unchanged (final gate where environment allows).
- Coverage: `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`). No new exclusions.
- Verification commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, optional `npm run smoke`.
- Manual verification (AC-1, AC-5) recorded in the build log for T1/T5: window sizes 320×568, 375×667, 768×1024, 1280×720, 1920×1080 in both portrait and landscape; mobile dynamic-toolbar collapse (scroll to collapse/expand the address bar) checked for gaps/scroll; notched-device safe-area checked via emulation or a physical device. Record pass/fail and notes per size.

## Open questions
- **Q-1 — Touch scheme / mobile rotation.** Gesture-only (tap explodes, drag does nothing) vs. adding virtual joystick/rotate buttons. **Recommended: gesture-only (v1)** — reuses the existing pointer model and avoids extra UI; mobile rotation relies on the engine's automatic face-clear auto-rotation plus any attached keyboard. Limitation: a phone without a keyboard cannot manually rotate; face navigation happens only via auto-rotate. Joystick is a follow-up if playtesting shows this is awkward.
- **Q-2 — DPR cap.** Cap at `min(dpr, 2)` (existing `PIXEL_RATIO_CAP`) vs. 1.5 on mobile. **Recommended: keep 2** — consistent with desktop; lower only if profiling shows GPU pressure (Q-4).
- **Q-3 — Portrait layout of HUD/panel.** **Recommended: no breakpoint;** rely on safe-area insets plus the existing `max-width: min(20rem, calc(100vw - 2rem))` clamp on the panel; revisit if overlap occurs.
- **Q-4 — Mobile performance tier.** Lower star/particle caps on small viewports? **Recommended: no new tier in v1** — rely on existing caps (1200 stars, 72-particle pool) and the DPR cap; add a tier only with measured evidence (trigger: sustained frame time > 16 ms on a mid-range mobile device or observed GPU memory pressure).
- **Q-5 — Safe-area handling.** Use `env(safe-area-inset-*)` on overlays vs. `viewport-fit=cover`. **Recommended: both** — `viewport-fit=cover` in the meta plus `env()` padding on overlays.
- **Q-6 — PWA manifest.** Add manifest/icons for installability? **Recommended: out of scope for v1** (no manifest); revisit as a separate feature.

## Assumptions
- The existing pointer-event model (Pointer Events single path) already supports touch; this feature ensures CSS/layout, resize, and debounce follow through. Drags do nothing on touch as on mouse.
- `PIXEL_RATIO_CAP = 2` remains the cap; no new constant.
- No orientation lock; both orientations supported by responsive layout.
- The frontend workspace has no DOM test environment (SSR-only), so layout is verified by markup/CSS inspection + manual browser pass recorded in the build log.
- WebGL context loss on mobile is an out-of-scope limitation; a browser reload recovers. No recovery code is added.

## Revision history
- r1 — 2026-10-23 — initial draft (planning phase).
- r2 — 2026-10-23 — address spec review F1–F12: touch drag does nothing (parity); resize re-targeted at `session.applyViewport`/`env.resize`/`env.orientation`; debounce shape (trailing ≤16 ms, attach immediate, orientation immediate, teardown); corrected defect citations; task overview/ownership clarified; tap targets on three shell controls; manual verification steps; Q-3/Q-4 quantified.