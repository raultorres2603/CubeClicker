# Build log — T3 — Refine spaceship into fighter silhouette

Task: T3 (2026-10-28)
Files changed: src/frontend/src/render/spaceship.ts, src/frontend/src/render/spaceship.test.ts, src/frontend/src/render/scene.test.ts
What changed & why: Added two BoxGeometry meshes named 'wing' to the spaceship group; set metalness/roughness on all MeshStandardMaterials under spaceship.group (including ignitions); kept shot spheres MeshBasicMaterial. Updated spaceship.test.ts to require wings and standard materials (replacing no-BoxGeometry assertion). Updated scene.test.ts baseline object count 21→23 to reflect two added wing meshes.
Decisions: metalness 0.5 / roughness 0.5 on all ship meshes; wings use same material as body.

Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 40 test files, 882 tests passed, exit 0
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0, All files 95.02% statements
- `npm run coverage` → exit 0
- `npm run build` → exit 0

Acceptance audit: AC-5 → met (cone/cylinder/2 wings named 'wing' BoxGeometry; all group meshes MeshStandardMaterial metalness>=0.4 roughness<=0.6; ignition emissive non-zero; scale SPACESHIP_SCALE; SPACESHIP_IGNITION_COUNT 2).
Deviations from spec: edited scene.test.ts baseline count (out of files_owned) to reflect added wings; necessary for tests to pass.