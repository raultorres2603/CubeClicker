---
feature: modern-ui-background-life
revision: 2
---

# Plan — Modern UI Background Life

## Architecture

All changes live in the frontend render/UI layer. No backend, protocol, container, or persistence change.

- **Border light & HUD blink CSS (`ui/app.css`)**: add `@keyframes border-light-travel` and `@keyframes hud-blink`; apply the border light to `main > section` and `.user-panel` (pseudo-element allowed) with `animation: border-light-travel <n>ms linear infinite;` (`<n>` ∈ [2000, 6000]); apply the blink to `main > section[data-blinking="true"]` with `animation: hud-blink <n>ms <easing>;` (`<n>` ≤ 300); disable all three under `@media (prefers-reduced-motion: reduce)` with `animation: none`.
- **Hud blink (`ui/Hud.tsx`)**: add optional `blinking?: boolean` prop; render `data-blinking="true"` when true; export `HUD_BLINK_MS = 200`.
- **App wiring (`ui/App.tsx`)**: derive reduced motion from `snapshot.reducedMotion`; track previous clicks in a `useRef`; in a `useEffect` keyed on `snapshot.stats.clicks` and `snapshot.reducedMotion`, set `hudBlinking = true` and (re)arm a single `setTimeout(..., HUD_BLINK_MS)` clearing it (clearing any prior timer), cleaning up the timer on unmount/re-trigger; skip setting it when reduced motion is true; pass `blinking` to the welcomed `Hud` only.
- **Background life (`render/background-life.ts`)**: new factory `createBackgroundLife(random)` building a fixed set of shooting stars and distant spaceships (procedural meshes) in a group named `'background-life'`, with deterministic per-object motion: shooting stars advance along a fixed axis within a pinned world-space band and recycle to the opposite edge using the injected `random` when they exit it; spaceships drift/orbit within a pinned distant band; `update` clamps `dtMs` with `Math.max(0, dtMs)` and is a no-op under reduced motion.
- **Scene integration (`render/scene.ts`)**: build `backgroundLife` in `createSceneView`, add its group to the scene, forward `reducedMotion` in `update`, and dispose it in `dispose()`; ensure rebuild does not duplicate.

State ownership: `hudBlinking` is local React state in `App`; all 3D visual state remains in render adapters. No shared state.

## Interfaces / contracts

- `Hud` props gain `blinking?: boolean`.
- `HUD_BLINK_MS === 200` exported from `src/frontend/src/ui/Hud.tsx`.
- `createBackgroundLife(random)` returns `{ group, shootingStars, spaceships, update(dtMs, reducedMotion?), dispose() }`.
- Constants exported from `src/frontend/src/render/background-life.ts`: `BACKGROUND_LIFE_SHOOTING_STAR_COUNT` (5), `BACKGROUND_LIFE_SPACESHIP_COUNT` (3), `BACKGROUND_LIFE_SHOOTING_STAR_SPEED`, `BACKGROUND_LIFE_SPACESHIP_SPEED`.
- `SceneView` unchanged public surface; background life is an internal owned object disposed with the scene.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/ui/app.css` | Edit | Border-light + hud-blink keyframes, pseudo-elements, reduced motion |
| `src/frontend/src/ui/app.css.test.ts` | Edit | CSS guards |
| `src/frontend/src/ui/Hud.tsx` | Edit | `blinking` prop + `HUD_BLINK_MS` export |
| `src/frontend/src/ui/Hud.test.tsx` | Edit | Blink prop assertions |
| `src/frontend/src/App.tsx` | Edit | `hudBlinking` state + timer + prop |
| `src/frontend/src/App.test.tsx` | Edit | Blink wiring tests |
| `src/frontend/src/render/background-life.ts` | New | Background life factory |
| `src/frontend/src/render/background-life.test.ts` | New | Counts/motion/reduced-motion tests |
| `src/frontend/src/render/scene.ts` | Edit | Integrate background life |
| `src/frontend/src/render/scene.test.ts` | Edit | Presence/rebuild/disposal tests |

Documentation: no README/container/architecture change is expected for this frontend-only feature; the acceptance-time documentation pass (per `docs/architecture/documentation.md`) confirms no change is needed. `docs/features/README.md` is orchestrator-owned.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | One feature for all three asks | Matches user request | Split (Q-5) |
| 2 | HUD blink derived from clicks increase in App | Avoids session/scene coupling; testable in React | Scene callback (heavier) |
| 3 | Background life as separate render module | Keeps scene.ts diff focused; deterministic via injected random | Inline in scene |
| 4 | CSS pseudo-element for border light | Testable via grep guards, no new render code | Canvas overlay |
| 5 | Fixed counts for background life | Bounded resources, testable | Dynamic spawning |

## Risks & mitigations

- Scene.ts edits risk regressions → keep changes to add/remove/forward/dispose only.
- App timer tests may be flaky → use fake timers in tests; spec pins `HUD_BLINK_MS`.
- CSS pseudo-element may affect layout → use absolutely positioned overlay with `pointer-events: none`.
- Background life geometry must not break coverage → keep module small and pure-ish.

## Open questions

See spec.md § Open questions (Q-1…Q-5). Containerization: none (frontend source only). Real-time: local-only visuals.