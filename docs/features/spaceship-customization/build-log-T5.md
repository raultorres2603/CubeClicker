# Build log — T5 — Backend protocol additions

Task: T5 (2026-11-05)
Files changed: src/backend/src/game/protocol.ts, src/backend/src/game/protocol.test.ts
What changed & why: Added `CustomizationState` type, `customization?` on `Placement`, `customizationUpdate` server message, `openLootbox`/`equipPart` client messages, new error codes, `customizationUpdateMessage` builder, `copyCustomizationState` helper, and defensive copy in `placementPayload`. Client codec handles the two new messages; message-size cap unchanged (1024).
Decisions: Mirrored the upgrades pattern (copy on placement, builder copies state). `openLootbox` ignores extra fields; `equipPart.partId` must be non-empty string. Size cap left as `MAX_MESSAGE_BYTES`.
Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck --workspace @cubeclicker/backend` → pass
- `npm test --workspace @cubeclicker/backend -- protocol` → 102 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → exit 0; All files 94.23% stmts / 85.41% branch / 99.67% funcs / 94.23% lines
Acceptance audit: AC-11 → met (protocol types, messages, error codes, codec rules, builder, copy helper, placement field)
Deviations from spec: none