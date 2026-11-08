# Build log — T3 — Backend protocol v2 (additive)

Task: T3 (2026-11-08)
Files changed: `src/backend/src/game/protocol.ts`, `src/backend/src/game/protocol.test.ts`, `docs/features/spaceship-cursor-loot-animations/build-log-T3.md`
What changed & why: Additive protocol v2 — client `unequipPart { slotId }`, server `lootboxOpened { partId, slot, rarity, duplicate, lootboxes, keys, parts, appearance }`, error `unknown_slot`; `openLootbox`/`equipPart`/`customizationUpdate` stay byte-identical. Added the AC-24 payload codec + defensive copies and the opener-only builder.
Decisions: The backend never decodes server frames (the frontend mirror owns that direction), so AC-24's codec lands as the pure `parseLootboxOpened` payload validator used by `lootboxOpenedMessage`; malformed payloads throw a `TypeError` instead of reaching the wire. Legacy equip ids stay non-empty strings at the codec; the hub resolves their v2 target set in T5. `lootboxOpened` is referenced from the `ServerMessage` union via `({ type: 'lootboxOpened' } & LootboxOpened)` so the union and builder payload cannot drift.
Evidence:

- `npm run lint` → exit 0 (no findings; output after the npm banner is empty).
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0 (`tsc --noEmit`, no output).
- `npm test --workspace @cubeclicker/backend` → exit 0:
  ```
  Test Files  23 passed (23)
       Tests  804 passed (804)
  ```
- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds 80/80/80/80):
  ```
  % Coverage report from v8
  -------------------|---------|----------|---------|---------|-------------------
  File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
  -------------------|---------|----------|---------|---------|-------------------
  All files          |   94.73 |    87.01 |   99.69 |   94.73 |
   src/game          |   96.37 |    95.12 |   99.23 |   96.37 |
    protocol.ts      |   98.79 |    98.43 |   96.55 |   98.79 | 233-234,548-549
  ```
  (The two uncovered ranges are pre-existing: the invalid `join.mode` branch and the unused `purchaseUpgradeMessage` builder.)

Acceptance audit:
- AC-23 → met. `ClientMessage` gains `{ type: 'unequipPart'; slotId: string }`; codec decodes a non-empty `slotId` and rejects missing/empty/non-string ids with `bad_message`; `openLootbox` still takes no fields; `equipPart` continues to accept legacy ids (`body-gold`, `wings-silver`, `engine-blue`) as non-empty strings (matrix in `parseClientMessage — unequipPart` / `— legacy equip ids`).
- AC-24 → met. `ServerMessage` gains `lootboxOpened`; `LootboxOpened` carries the exact eight fields. `parseLootboxOpened` pins the codec: non-empty `partId`/`slot`, rarity exactly `rare`/`epic`, boolean `duplicate`, non-negative integer `lootboxes`/`keys`, positive integer `parts` counts, non-empty-string `appearance` keys/values — the invalid table covers empty ids, bad rarity, non-boolean duplicate, negative/float counts and bad maps. `lootboxOpenedMessage` copies both maps and refuses invalid payloads; `unknown_slot` is added to `ErrorCode`; `customizationUpdate` union/builder/`copyCustomizationState` are untouched and their existing tests stay green.
- AC-25 → backend half met. The backend fixture matrix and pinning assertions are published here for T10 to replay verbatim in the frontend mirror (frontend `parseServerMessage`/`parseClientMessage` are T10's `files_owned`); no `any` escape was introduced. Full two-workspace parity is T10/T14 evidence.

Testing tiers: codec behavior is exercised at its wire boundary (`lootboxOpenedMessage` → `encodeServerMessage` → `JSON.parse` → `parseLootboxOpened` exact round-trip). T3 has no hub/app consumer yet (additive task; T5 wires the hub and T10 wires the client), so no real-socket integration is reachable here; that socket tier lands in T5/T10. Unit + wire-round-trip evidence above is the documented T3 exception.

Deviations from spec: none.
