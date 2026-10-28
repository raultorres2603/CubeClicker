# Build log — T5 (Scene integration of background life)

## Files changed
- src/frontend/src/render/scene.ts (edit)
- src/frontend/src/render/scene.test.ts (edit)

## Verify evidence

### lint
Command: `npm run lint`
Result: exit 0 (no output).

### typecheck
Command: `npm run typecheck`
Result: exit 0.

### tests
Command: `npm test --workspace @cubeclicker/frontend`
Result: 41 test files passed, 913 tests passed (includes scene.test.ts 69 tests).

### coverage (frontend pre-gate)
Command: `npm run coverage --workspace @cubeclicker/frontend`
Result: exit 0; scene.ts 98.09% statements / 96.37% branches / 100% functions / 98.09% lines.

## Notes
- No backend/container files touched.
- Background life group added once to scene; survives cube rebuild; disposed with scene.
- SceneView.update forwards reducedMotion to backgroundLife.update.
