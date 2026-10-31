---
feature: modern-ui-background-life
revision: 2
status: draft
created: 2026-10-28
updated: 2026-10-28
---

# Spec — Modern UI Background Life

## Summary

A frontend-only follow-up to the modern visual overhaul. The two HUD boxes (the top-left stats panel `main > section` and the top-right users panel `.user-panel` / its inner section) gain an animated light that travels along their borders; the HUD blinks briefly whenever a mini-cube is shot; and the 3D backdrop gains procedural "background life" — random shooting stars and distant spaceships fighting — driven by the injected random source so it stays deterministic and testable. Game rules, state, networking, persistence, backend and containers are untouched; all visuals remain local to one client.

## User stories

- As a player, I see a light travelling along the borders of the HUD boxes, so the interface feels alive.
- As a player, the HUD blinks when I shoot a mini-cube, so shots read as impactful.
- As a player, I see random shooting stars and distant spaceships in the background, so the scene feels inhabited.
- As a player who prefers reduced motion, border lights, blinks and background motion collapse or disable.

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`.

- **AC-1 — Animated border light on HUD boxes.** `app.css` defines `@keyframes border-light-travel` and applies it to both HUD boxes with at least one rule whose selector contains `main > section` and at least one whose selector contains `.user-panel` (a `::before`/`::after` pseudo-element on the selector is allowed), each declaring `animation: border-light-travel <n>ms linear infinite;` with `<n>` an integer in the inclusive range `2000..6000`. The animation moves a visible light element (pseudo-element or border image) around the perimeter. Evidence: `app.css.test.ts`.

- **AC-2 — Reduced motion disables border light.** Under `@media (prefers-reduced-motion: reduce)`, the border-light animation is disabled (`animation: none`) for `main > section` and `.user-panel` (the same media block also disables the blink per AC-4). Evidence: `app.css.test.ts`.

- **AC-3 — HUD blink prop.** `Hud` accepts an optional `blinking?: boolean` (default `false`). When `true`, the section carries `data-blinking="true"`; when `false`/omitted, it carries no `data-blinking` attribute. The existing default markup (no button, no data-minimized) is unchanged when `blinking` is omitted. Evidence: `Hud.test.tsx`.

- **AC-4 — HUD blink styling.** `app.css` defines `@keyframes hud-blink` and applies it to `main > section[data-blinking="true"]` with a rule of the form `animation: hud-blink <n>ms <easing>;` where `<n>` is an integer `<= 300` (any easing token is allowed). Under `@media (prefers-reduced-motion: reduce)`, the blink animation is disabled (`animation: none`) for `main > section[data-blinking="true"]`. Evidence: `app.css.test.ts`.

- **AC-5 — HUD blink on shot.** `App` holds a `hudBlinking` boolean state and tracks the previous value of `snapshot.stats.clicks` in a `useRef`. In a `useEffect` keyed on `snapshot.stats.clicks` (and `snapshot.reducedMotion`), whenever clicks increases relative to the retained previous value, `App` sets `hudBlinking = true` and (re)arms a single `setTimeout(..., HUD_BLINK_MS)` that sets it back to `false`, clearing any prior timer; the effect cleans up the timer on unmount or re-trigger. `HUD_BLINK_MS === 200`, exported from `src/frontend/src/ui/Hud.tsx`. `App` passes `blinking={hudBlinking}` to the welcomed `Hud`. The pre-welcome stats section is unchanged and receives no blink. Evidence: `App.test.tsx`, `Hud.test.tsx`.

- **AC-6 — Reduced motion suppresses blink triggering.** `App` derives reduced motion from `snapshot.reducedMotion`. When it is `true`, shots still increment clicks (game rule unchanged), but `App` does not set `hudBlinking = true` (the blink is skipped entirely; the CSS also disables it). Evidence: `App.test.tsx`.

- **AC-7 — Background life module.** New module `src/frontend/src/render/background-life.ts` exports `createBackgroundLife(random)` returning an object with: `group` (a `Group` with `name === 'background-life'`), `shootingStars` (readonly array of length `BACKGROUND_LIFE_SHOOTING_STAR_COUNT === 5`), `spaceships` (readonly array of length `BACKGROUND_LIFE_SPACESHIP_COUNT === 3`), `update(dtMs, reducedMotion?)`, and `dispose()`. Constants `BACKGROUND_LIFE_SHOOTING_STAR_COUNT`, `BACKGROUND_LIFE_SPACESHIP_COUNT`, `BACKGROUND_LIFE_SHOOTING_STAR_SPEED` (a finite positive number) and `BACKGROUND_LIFE_SPACESHIP_SPEED` (a finite positive number) are exported. Each shooting star and spaceship is a `Mesh` (or `Group`) with procedural geometry only. Evidence: `background-life.test.ts`.

- **AC-8 — Background life motion.** `BackgroundLife.update(dtMs, reducedMotion?)`:
  - clamps `dtMs` with `Math.max(0, dtMs)` before any motion, so a negative input advances nothing;
  - when `reducedMotion` is `false`/omitted, shooting-star positions change over a positive `dtMs`; each shooting star advances along a fixed axis within a pinned world-space band and, when it exits that band, resets to the opposite edge using the injected `random` (at least one recycle occurs for a large enough `dtMs`);
  - spaceships drift/orbit within a pinned distant band;
  - when `reducedMotion` is `true`, no position changes for any positive `dtMs`.
  Evidence: `background-life.test.ts`.

- **AC-9 — Scene integration.** `createSceneView` adds exactly one group named `'background-life'` to the scene; it survives a cube rebuild (`levelChanged` path) without duplication; `dispose()` removes and disposes it and leaves no group named `'background-life'`. Evidence: `scene.test.ts` (or `scene-background-life.test.ts`).

- **AC-10 — Scene forwards reduced motion.** `SceneView.update` calls `backgroundLife.update(dtMs, reducedMotion)` so reduced-motion state propagates. Evidence: `scene-background-life.test.ts` (or `scene.test.ts`).

- **AC-11 — No backend/container change.** `git diff` is empty for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, `src/frontend/Dockerfile`, and any other `**/Dockerfile` in the tree. Verification command: `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'`. Evidence: final build log.

- **AC-12 — Coverage.** `npm run coverage` (both workspaces) exits 0 with ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` is the task-level check. Evidence: final build log.

## Non-goals

- No change to game rules, stats, intents, phase sequencing, level progression, server protocol, or persistence.
- No multiplayer visibility of background life or border lights: all visuals remain local to one client.
- No new dependencies, no textures/assets, no shaders, no audio.
- No browser automation or pixel/perceptual tests.
- No change to spaceship shot timing or deferred explosion semantics.
- No redesign of auth overlays beyond CSS additions.
- No persistence or cross-client propagation of HUD blink or border-light state.
- Background life is decorative only: it does not affect picking, collisions, or game state.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named tree-shakeable imports from `three`; tests with concrete expected values beside every behavior change; run lint, typecheck, tests, and the coverage command before reporting done; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation from this spec; touching any file outside a task's `files_owned`; any coverage exclusion or threshold change; any change to backend/container files.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, or configs; use `import *` from `three`; read browser globals inside `game/**` or pure render math; push; rewrite predecessor specs.

## Security considerations

- **No new dependencies.** Only existing `three` named imports; lockfile untouched.
- **No user data, storage, or network.** All visual state is in-memory per client; nothing is persisted or sent.
- **Rendering safety.** Fully procedural geometry; no loaders, textures, or external assets; no `innerHTML`.
- **Resource bounds.** Background life uses fixed counts (5 stars, 3 ships); `dispose()` releases all. No unbounded growth.
- **Test integrity.** Coverage bar and concrete-assertion rule protect unchanged pure logic and server-authority paths.

## Real-time impact

**None for shared state.** Border lights, HUD blink and background life are client-local visuals: no shared or cross-client state is created or read, no protocol message is added, and connection lifecycle, reconnection, multi-client behavior, and server authority are unaffected (they remain as in predecessor features). Open question Q-1 carries over whether other clients should see a player's background life; the default (local-only) is chosen and flagged.

## Containerization impact

**None expected.** Frontend source changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it. AC-11 pins the container-file diff gate.

## Testing strategy

- **Unit (Vitest, node environment):** `background-life.test.ts` pins counts, constants, motion and reduced-motion; `Hud.test.tsx` pins the `blinking` prop and `data-blinking`; `app.css.test.ts` pins CSS guards (border-light, hud-blink, reduced motion).
- **Integration (same node environment — real three.js scene graph):** `scene.test.ts` / `scene-background-life.test.ts` assert background-life presence, rebuild safety, disposal, and reduced-motion forwarding.
- **Integration (React):** `App.test.tsx` pins HUD blink wiring on click increase and reduced-motion suppression; blink assertions await commit (e.g. `waitFor`/`findBy`) because the flip and timer are scheduled in a commit effect.
- **E2E / container:** no browser automation; `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). If a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.

## Open questions

- **Q-1 — Cross-client visibility (carried over, user checkpoint).** Default: border lights, HUD blink and background life are local to one client. Broadcasting any of them would need protocol additions and server authority; not implemented. Choosing it requires a spec revision.
- **Q-2 — Background life density and speed.** The pinned counts (5 shooting stars, 3 spaceships) and speeds are defaults; tuning is a constant edit plus a spec note.
- **Q-3 — HUD blink trigger under reduced motion.** Default: clicks still increment and stats update; blink is skipped entirely when reduced motion is active. Alternative: keep the blink but rely on CSS disabling it. The default avoids unnecessary timers.
- **Q-4 — Border light technique.** Default: CSS keyframe animation on a pseudo-element. Alternative: canvas-drawn overlay. The CSS default keeps it testable via grep guards and avoids new render code.
- **Q-5 — Feature scope.** The request bundles several visual changes. Default: one feature. If review finds the scope too large, split into `animated-hud-borders`, `hud-shot-blink`, `background-life` and sequence them; requires user approval.

## Assumptions

- The pointer and shot flow are unchanged; HUD blink is derived from `stats.clicks` increases in `App`.
- Background life uses the same injected `random` as the starfield for determinism; no new RNG.
- Background life is added to the scene once in `createSceneView` and disposed with it.
- Predecessor specs/plan/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: TypeScript strict, Vitest, ESLint; the project testing bar governs.

## Revision history

- r1 — 2026-10-28 — initial draft (planning phase).
- r2 — 2026-10-28 — revision after spec review r1: F1 AC-6 reduced-motion signal pinned to `snapshot.reducedMotion`; F2 AC-5 commit/timer semantics pinned (useRef + useEffect, single setTimeout, cleanup); F3 AC-1/AC-2/AC-4 CSS selectors and shorthand pinned to greppable forms; F4 AC-8 recycle bounds and dtMs clamp pinned. (F5/F6/F7 informational; F5 handled in tasks/plan.)