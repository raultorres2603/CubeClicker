# Build log — T1 — Add `customization?` to backend protocol `welcome`/`worldEntered` variants

Task: T1 (2026-11-06)
Files changed: src/backend/src/game/protocol.ts
What changed & why: Added `customization?: CustomizationState;` to the `welcome` and `worldEntered` variants of the backend `ServerMessage` union, mirroring the existing `economy?`/`upgrades?` fields. `placementPayload` already copies customization defensively, so no codec change was needed.
Decisions: Type-only alignment; no parsePlacement exists in the backend workspace.

Evidence:
- `npm run lint` → (no output, exit 0)
- `npm run typecheck --workspace=@cubeclicker/backend` → (no output, exit 0)
- `npm test --workspace=@cubeclicker/backend -- protocol` → 1 test file passed, 102 tests passed
- `npm run coverage --workspace=@cubeclicker/backend` → All files 94.34% stmts / 85.93% branches / 99.68% funcs / 94.34% lines; 22 test files, 700 tests passed (thresholds ≥ 80 met)

Acceptance audit: AC-1 → met (typecheck exits 0; `customization?` present on both variants)
Deviations from spec: none