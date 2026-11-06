# Build log — T6 (realistic-lighting-materials)

## Scope
Fix code review r1 findings F1 (MAJOR) and F2 (MINOR).

## Changes
- `src/frontend/src/render/cube-view.test.ts`: imported `MATERIAL_CLEARCOAT`, `MATERIAL_CLEARCOAT_ROUGHNESS`; added `materials (AC-3)` test pinning constants (0.35, 0.2) and asserting body + every tile material is `MeshPhysicalMaterial` with `clearcoat === 0.35` and `clearcoatRoughness === 0.2`.
- `src/frontend/src/render/spaceship.test.ts`: imported `MATERIAL_CLEARCOAT`, `MATERIAL_CLEARCOAT_ROUGHNESS`; added `materials (AC-3)` test pinning constants and asserting every mesh under `group` is `MeshPhysicalMaterial` with the pinned clearcoat values.
- `src/frontend/src/render/scene.ts`: changed import `MeshStandardMaterial` → `MeshPhysicalMaterial` and updated the stale cast in `applyAppearanceToSpaceship` to `MeshPhysicalMaterial`.

## Verification evidence

### npm run lint
```
> lint
> eslint .

exit=0
```

### npm run typecheck
```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

exit=0
```

### npm test (all workspaces)
```
backend: Test Files 22 passed (22), Tests 700 passed (700)
frontend: Test Files 48 passed (48), Tests 1225 passed (1225)
exit=0
```

### npm run coverage --workspace @cubeclicker/frontend (pre-gate)
```
All files | 95 | 94.94 | 95.75 | 95
exit=0
```

### npm run coverage (full gate)
```
backend All files | 94.34 | 85.93 | 99.68 | 94.34
frontend All files | 95 | 94.94 | 95.75 | 95
exit=0
```

### npm run build
```
✓ built in 1.35s
exit=0
```

### AC-8 container/backend diff gate
```
git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'
exit=0
```

## Notes
- `scene.test.ts` left unchanged: it does not assert the `applyAppearanceToSpaceship` cast type; its `MeshStandardMaterial` references are casts/instance checks that remain valid (`MeshPhysicalMaterial extends MeshStandardMaterial`).
- No banned matchers introduced; assertions use concrete expected values.
```

Now commit? The task says commit per task conventional message. Should I commit? The builder should commit. Let me check git status and commit.<|end|><|start|>-start to=shell<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd /var/home/raultorraco/Documents/Projects/CubeClicker && git status --short