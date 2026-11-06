# Build log — T4 (PBR material upgrade)

## Changes

- `src/frontend/src/render/cube-view.ts`: `MeshStandardMaterial` → `MeshPhysicalMaterial` for body and tile InstancedMesh materials; added `clearcoat`/`clearcoatRoughness` from exported constants; exported `MATERIAL_CLEARCOAT` (0.35) and `MATERIAL_CLEARCOAT_ROUGHNESS` (0.2).
- `src/frontend/src/render/spaceship.ts`: `MeshStandardMaterial` → `MeshPhysicalMaterial` for nose, body, cockpit, wings, ignition; added clearcoat constants; shot meshes remain `MeshBasicMaterial`; exported constants.
- Tests updated to `MeshPhysicalMaterial`.

## Verification evidence

### npm run lint
```
> eslint .
(no errors)
EXIT=0
```

### npm run typecheck
```
> tsc --noEmit (both workspaces)
EXIT=0
```

### npm test --workspace @cubeclicker/frontend
```
Test Files  48 passed (48)
Tests  1223 passed (1223)
EXIT=0
```

### npm run coverage --workspace @cubeclicker/frontend
```
All files | 95 | 94.94 | 95.75 | 95
EXIT=0
```

### npm run coverage (full)
```
backend All files | 94.34 | 85.93 | 99.68 | 94.34
frontend All files | 95 | 94.94 | 95.75 | 95
EXIT=0
```

### npm run build
```
✓ built in 1.33s
EXIT=0
```

### git diff (AC-8 container/backend gate)
```
EXIT=0
```