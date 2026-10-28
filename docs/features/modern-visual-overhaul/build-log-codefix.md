# Build log — codefix (review r1 F1–F4) — modern-visual-overhaul
Task: codefix (2026-10-28)
Files changed: src/frontend/src/render/scene.ts, src/frontend/src/render/scene.test.ts, src/frontend/src/render/cube-view.test.ts, src/frontend/src/render/webgl.test.ts, docs/features/modern-visual-overhaul/build-log-codefix.md
What changed & why: Added shadow assertions (F1) to scene.test.ts (key light castShadow + 1024×1024 shadow map) and cube-view.test.ts (body + each face InstancedMesh castShadow/receiveShadow); added focused shadow-map enablement test in webgl.test.ts (F2); extracted AMBIENT_INTENSITY_MIN/MAX constants and replaced the magic ambient intensity in scene.test.ts with an expression referencing AMBIENT_INTENSITY, the constants and starfield.averageBrightness (F4).
Decisions:
- F3: The cross-component test that rendered `ConnectionBanner` and `UserPanel` inside `Hud.test.tsx` (deleted in T4) was removed because `Hud.test.tsx` owns only the `Hud` panel; markup for those overlays is pinned by their own test files (`ConnectionBanner`, `UserPanel`). Coupling Hud tests to unrelated components also broke when the minimize toggle introduced interactive descendants, so the assertion no longer held. No behavior change.
- Constants named `AMBIENT_INTENSITY_MIN`/`AMBIENT_INTENSITY_MAX` (0.5/1.0) per review F4; exported from scene.ts so tests reference them.
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 40 files / 883 tests)
- `npm run coverage` → exit 0 (frontend All files 95.03% stmts / 94.85% branches / 96.42% funcs / 95.03% lines; backend All files 94.66% stmts / 84.32% branches / 99.60% funcs / 94.66% lines; all ≥ 80)
- `npm run build` → exit 0 (backend tsc; frontend vite build, 65 modules)
Acceptance audit: AC-4 → met (shadow assertions now present in scene.test.ts, cube-view.test.ts, webgl.test.ts); AC-3 → met (ambient intensity expressed via AMBIENT_INTENSITY + clamp bounds + starfield.averageBrightness); AC-9 → met (no backend/container change); AC-10 → met (coverage green).
Deviations from spec: none
