# Tasks — Fullscreen Responsive Layout

Dependency overview: T1 first; then T2 ∥ T4; T3 after T2; T5 after T2, T3, T4.

## T1 — Fullscreen viewport CSS, shell & index.html `[seq]`
depends_on: —
files_owned: src/frontend/index.html, src/frontend/src/ui/app.css, src/frontend/src/App.tsx, src/frontend/src/main.tsx, src/frontend/src/App.test.tsx
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-13, AC-14
status: [x]
notes: T1 owns **all** `app.css` edits (viewport units, safe-area insets, tap targets, no letterboxing). Other tasks must not edit `app.css`.

## T2 — Renderer resize, DPR cap, debounced listener & orientation source `[seq]`
depends_on: T1
files_owned: src/frontend/src/game/session.ts, src/frontend/src/game/session.test.ts, src/frontend/src/browser-env.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-6, AC-7, AC-8, AC-11
status: [x]
notes: Sizing is owned by `session.applyViewport` (not `render/scene.ts`). Implement trailing debounce ≤ 16 ms via `setTimeout` on `env.resize` emissions; attach-time `applyViewport` is direct; `env.orientation` (added in `browser-env.ts`) triggers an immediate apply. Update the `resize and visibility` session tests with fake timers. `render/scene.ts` is not touched.

## T3 — Touch gesture support (tap explodes, drag does nothing) `[P]`
depends_on: T2
files_owned: src/frontend/src/input/gestures.ts, src/frontend/src/input/gestures.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-9, AC-10, AC-12
status: [x]
notes: Classification is already pointerType-agnostic and drags already dispatch nothing (predecessor contract). This task verifies/updates the module doc comment only; no logic change and no rotation reintroduced.

## T4 — Responsive HUD & panel placement `[seq]`
depends_on: T1
files_owned: src/frontend/src/ui/Hud.tsx, src/frontend/src/ui/Hud.test.tsx, src/frontend/src/ui/UserPanel.tsx, src/frontend/src/ui/ConnectionBanner.tsx
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-4, AC-5, AC-13, AC-14
status: [x]
notes: T4 must **not** edit `app.css` (owned by T1). It verifies the CSS-driven ACs (safe-area, tap targets) through markup/component tests only. Completed 2026-10-25: doc comments on `Hud`/`UserPanel`/`ConnectionBanner` + three overlay-contract tests in `Hud.test.tsx`; no markup/class change; `build-log-T4.md`.

## T5 — Verify & integrate `[seq]`
depends_on: T2, T3, T4
files_owned: —
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke` (where the environment allows)
acceptance: AC-1..AC-14
status: [ ]
