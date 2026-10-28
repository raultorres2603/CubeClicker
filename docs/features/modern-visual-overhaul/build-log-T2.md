# Build log — T2 — Enable star-driven lighting and shadows
Task: T2 (2026-10-28)
Files changed: src/frontend/src/render/scene.ts, src/frontend/src/render/scene.test.ts, src/frontend/src/render/cube-view.ts, src/frontend/src/render/webgl.ts, src/frontend/src/render/webgl.test.ts
What changed & why: Ambient light intensity now scales with starfield averageBrightness (AMBIENT_INTENSITY * clamp(avg, 0.5, 1.0)) set once at construction; key directional light casts shadows with a 1024x1024 shadow map; cube body and face InstancedMeshes cast/receive shadows; WebGL renderer enables shadowMap; scene forwards reducedMotion to starfield.update. Exported AMBIENT_INTENSITY.
Decisions: Reordered starfield creation before lights to read averageBrightness; no rebuild path re-applies ambient value.
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → exit 0 (Test Files 40 passed, Tests 870 passed)
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (All files 95% stmts / 94.82% branches / 96.41% funcs / 95% lines)
Acceptance audit: AC-3 met (star-driven ambient fill); AC-4 met (shadow config + renderer shadowMap); AC-8 met (reducedMotion forwarded).
Deviations from spec: none
