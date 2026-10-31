# Tasks — Modern Visual Overhaul

Dependency overview: T1 → T2, T3; T4 independent; T5 after T4; Tfinal after T1–T5.

## T1 — Brighten starfield and add twinkle `[seq]`
depends_on: —
files_owned: src/frontend/src/render/starfield.ts, src/frontend/src/render/starfield.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-1, AC-2, AC-3, AC-8
status: [x]
notes: Export `STAR_MIN_BRIGHTNESS`, `STAR_SIZE`, `STARFIELD_OPACITY_BASE`, `STARFIELD_OPACITY_AMPLITUDE`, `STARFIELD_PULSE_PERIOD_MS`; expose `pulseTimeMs` and `averageBrightness` (readonly) on `Starfield`; add optional `reducedMotion` 4th param to `update`. Update `starfield.test.ts` for new size 0.8, brightness 0.75, opacity base 1.0, twinkle formula, and reduced-motion opacity 1.0.

## T2 — Enable star-driven lighting and shadows `[seq]`
depends_on: T1
files_owned: src/frontend/src/render/scene.ts, src/frontend/src/render/scene.test.ts, src/frontend/src/render/cube-view.ts, src/frontend/src/render/cube-view.test.ts, src/frontend/src/render/webgl.ts, src/frontend/src/render/webgl.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-3, AC-4
status: [x]
notes: Scene sets ambient intensity to `AMBIENT_INTENSITY * clamp(starfield.averageBrightness, 0.5, 1.0)` on construction (no rebuild). Key light castShadow + 1024 shadow map. Cube body + face InstancedMesh castShadow/receiveShadow. `createWebGLRenderer` sets `renderer.shadowMap.enabled = true`; update webgl mock to include a `shadowMap` handle. Scene forwards `reducedMotion` to `starfield.update`.

## T3 — Refine spaceship into fighter silhouette `[P]`
depends_on: T1
files_owned: src/frontend/src/render/spaceship.ts, src/frontend/src/render/spaceship.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-5
status: [x]
notes: Add cone nose, cylinder body, sphere cockpit, two `BoxGeometry` meshes named `'wing'`, engine glow emissive. All meshes under `spaceship.group` use `MeshStandardMaterial` with `metalness >= 0.4`, `roughness <= 0.6` (shots under `shotsGroup` stay `MeshBasicMaterial`). Update `spaceship.test.ts` to require wing meshes and standard materials instead of forbidding `BoxGeometry`.

## T4 — HUD minimize props and overlay motion CSS `[seq]`
depends_on: —
files_owned: src/frontend/src/ui/Hud.tsx, src/frontend/src/ui/Hud.test.tsx, src/frontend/src/ui/app.css, src/frontend/src/ui/app.css.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-6, AC-7, AC-8
status: [x]
notes: Hud optional `minimized`/`onToggleMinimize`; render toggle button as last child when handler provided (onClick calls handler); `data-minimized` when minimized. CSS transitions <=200ms, button `:active` scale(0.97/0.98), collapse rule for `data-minimized="true"`, `pointer-events: auto` for `main > section button`, reduced-motion override. Update Hud tests for default markup (no button/data-minimized) and new button markup.

## T5 — Wire HUD minimize state in App `[seq]`
depends_on: T4
files_owned: src/frontend/src/App.tsx, src/frontend/src/App.test.tsx
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-6
status: [x]
notes: Local `hudMinimized` state passed to `Hud` only in the welcomed branch; pre-welcome stats section unchanged.

## Tfinal — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4, T5
files_owned: README.md, docs/features/README.md
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'`
acceptance: AC-9, AC-10
status: [x]