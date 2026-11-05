# Build log — T7 — Frontend protocol mirror

Task: T7 (2026-11-05)
Files changed: src/frontend/src/multiplayer/protocol.ts, src/frontend/src/multiplayer/protocol.test.ts
What changed & why: Mirrored backend protocol additions in the frontend protocol: added `CustomizationState` import/export, the `no_lootbox`/`no_key`/`unknown_part`/`not_owned` error codes, `openLootbox` and `equipPart { partId }` client messages, the `customizationUpdate` server message, `customization?` on `Placement`, a `parseCustomizationState` codec with the pinned validation rules, and the `customizationUpdateMessage`/`copyCustomizationState` builders. Extended the parity test suite accordingly.
Decisions: Reused the existing frontend validation helpers (`isInteger`, `isNonEmptyString`, `asJsonObject`) and mirrored the backend's defensive-copy and builder shapes; parts counts must be positive, lootboxes/keys non-negative integers.
Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck --workspace @cubeclicker/frontend` → pass (no output)
- `npm test --workspace @cubeclicker/frontend -- protocol` → 171 tests passed (1 test file)
- `npm run coverage --workspace @cubeclicker/frontend` → 45 test files, 1159 tests passed; All files 95.28% statements / 95.12% branches / 97% functions / 95.28% lines (thresholds ≥ 80 met)
Acceptance audit: AC-11 → met (protocol.test.ts frontend parity; new messages/error codes, customizationUpdate codec rules, Placement.customization, customizationUpdateMessage, copyCustomizationState all covered)
Deviations from spec: none