# Build log — codefix — modern-ui-background-life

Task: codefix (2026-10-28)
Files changed:
- src/frontend/src/render/background-life.ts
- src/frontend/src/render/scene.test.ts
- src/frontend/src/App.test.tsx
- docs/features/modern-ui-background-life/build-log-codefix.md

What changed & why:
- F1: added `background life scene integration (AC-9, AC-10)` describe block in scene.test.ts asserting single 'background-life' group, rebuild survival, disposal, and reduced-motion forwarding.
- F2: converted App HUD-blink wall-clock sleep (250 ms) to Vitest fake timers, keeping 200 ms expected value; also removed 50 ms sleep in reduced-motion test.
- F3: background-life dispose() now removes group from parent before clearing.

Decisions: behavioral assertions used for reduced-motion forwarding (star positions) since backgroundLife is internal to SceneView.

Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test` → backend 18 files 492 tests; frontend 41 files 917 tests; all passed
- `npm run coverage` → frontend All files 95.05% stmts / 94.84% branches / 96.46% funcs / 95.05% lines; backend 94.66% / 84.32% / 99.60% / 94.66%; all ≥ 80
- `npm run build` → exit 0

Acceptance audit:
- AC-9 → met (new scene tests: single group, rebuild survival, disposal)
- AC-10 → met (forwarding test: reduced motion no change; motion changes)

Deviations from spec: none
