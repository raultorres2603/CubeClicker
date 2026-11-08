# Build log — T10 — Protocol mirror + engine/session/picking

Task: T10 (2026-11-08)
Files changed: `src/frontend/src/multiplayer/protocol.ts`,
`src/frontend/src/multiplayer/protocol.test.ts`, `src/frontend/src/game/types.ts`,
`src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`,
`src/frontend/src/game/session.ts`, `src/frontend/src/game/session.test.ts`,
`src/frontend/src/render/picking.ts`, `src/frontend/src/render/picking.test.ts`,
`docs/features/spaceship-cursor-loot-animations/build-log-T10.md`

Sketch:
- Mirror T3: `unequipPart`, `lootboxOpened`, `unknown_slot`, AC-24 codec/copies and the
  parity fixture matrix; add `LootboxGrant` to the shared game types.
- Engine v2 guests: weighted open/grant/sequence/duplicate, v2 + legacy equip with
  all-or-nothing ownership, unequip/defaults, grant adoption/clear, legacy normalization.
- Session: account/guest open/equip/unequip commands, `pendingLootboxOpen` lifecycle,
  `lootboxOpened` adoption, reveal dismissal, legacy restored-state adoption.
- Picking: `pickHoverTarget` with preallocated NDC/intersections/result and a cached id;
  session coalesces pointer moves to one hover raycast per animation frame.

What changed & why:
- `multiplayer/protocol.ts`: mirrors the backend v2 catalog — client `unequipPart`, server
  `lootboxOpened`, error `unknown_slot`, `parseLootboxOpened` (AC-24 validation + defensive
  map copies) and `lootboxOpenedMessage`; `parseServerMessage` decodes the grant.
- `game/types.ts`: `LootboxGrant` (`partId`, `slot`, `rarity`, `duplicate`, client-owned
  `sequence`).
- `game/engine.ts`: migrated off legacy `parts.ts` to `parts-v2`; guest opens consume
  exactly one weighted draw, decrement lootboxes/keys, add the part, flag duplicates and
  advance the grant sequence; v2 and legacy (`body-*`/`wings-*`/`engine-*`) equips mirror
  the hub's catalog/ownership rules (standard parts implicit; multi-slot all-or-nothing);
  `unequipPart` deletes one slot and no-ops on unknown/default slots; `adoptCustomization`
  normalizes restored legacy state; snapshot carries `lastLootboxGrant`.
- `game/session.ts`: adds `unequipPart`/`dismissLootboxReveal`; exposes
  `pendingLootboxOpen` in the multiplayer snapshot (set on account send; cleared on
  `lootboxOpened`/`customizationUpdate`/`error`/status change/`welcome`); adopts the
  opener-only grant without letting `customizationUpdate` replace it; captures pointer NDC
  and resolves the hover target at most once per frame, pushing `SceneView.setHoverTarget`;
  pointer leave clears the target.
- `render/picking.ts`: `pickHoverTarget` reuses a module-owned NDC `Vector2`, preallocated
  intersection array and reusable `HoverPick` result; the hit id string is cached until the
  tile changes. `pickMiniCube` (click path) is unchanged.

Decisions:
- `OnlineGameSession.unequipPart`/`dismissLootboxReveal` are optional in the shared UI
  interface for source compatibility with pre-v2 session fakes owned by other tasks;
  `createGameSession` always implements them. This keeps the T10 workspace green without
  editing the T12-owned `App.test.tsx` fakes.
- `lastLootboxGrant` is optional on the base `EngineSnapshot` (pre-v2 snapshot fakes) and
  always present (`LootboxGrant | null`) on `OnlineEngineSnapshot`.
- The account grant sequence is session-owned (the wire carries no sequence); the guest
  sequence is engine-owned and both advance by one per grant, so reopening the same part
  restarts the reveal.
- Hover picking happens inside the frame loop, after `engine.advance`, so a rotation and a
  pointer move in the same frame use the settled orientation; the scene rebuild path that
  clears its own target is covered by always pushing the current pick on a pointer frame.
- Legacy equip mapping is duplicated in the frontend engine from the pinned catalog rule
  (the backend owns the authoritative copy; no new dependency or shared package).

Evidence:
- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .
  ```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > typecheck
  > tsc --noEmit
  ```
- `npm test --workspace @cubeclicker/frontend` → exit 0 (62 files / 1636 tests):
  ```
   ✓ src/multiplayer/protocol.test.ts (236 tests) 28ms
   ✓ src/render/picking.test.ts (16 tests) 88ms
   ✓ src/game/engine.test.ts (113 tests) 91ms
   ✓ src/game/session.test.ts (81 tests) 1048ms
   Test Files  62 passed (62)
        Tests  1636 passed (1636)
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80×4):
  ```
   Test Files  62 passed (62)
        Tests  1636 passed (1636)
   All files          |   96.11 |    95.61 |   97.06 |   96.11 |
    src/game/engine.ts|   99.47 |      100 |     100 |   99.47 |
    src/game/session.ts|  90.03 |    99.63 |   96.77 |   90.03 |
    src/game/types.ts |     100 |      100 |     100 |     100 |
    src/multiplayer/protocol.ts| 88.57 | 95.73 | 90 | 88.57 |
    src/render/picking.ts| 97.33 |   90.47 |     100 |   97.33 |
  ```
- Assertion quality: concrete expected values only (exact ids, grants, counts, sequences,
  envelopes, decoded messages). No wildcard matchers, snapshots or assertion-free tests.

Acceptance audit:
- AC-21 → met. Engine v2 equip validates the catalog and positive ownership; standard parts
  are always allowed. Legacy ids derive their slot set server-side-equivalently
  (`body-*`→hull, `wings-*`→both wings, `engine-*`→both ignitions). Evidence:
  `engine.test.ts` (standard/unowned/unknown/legacy), `session.test.ts` (guest/account send).
- AC-22 → met. Equip mutates only the derived slot(s); re-equip is a snapshot-identity
  no-op; unequip removes exactly one slot and no-ops for unknown/missing/default slots.
  Evidence: `engine.test.ts`, `session.test.ts` (guest unequip, account `unequipPart` send).
- AC-23 → met. Client union/decoder has `openLootbox` (no fields), `equipPart { partId }`,
  `unequipPart { slotId }`; empty/wrong-type fields decode to `bad_message`; legacy ids are
  accepted as non-empty strings. Evidence: `protocol.test.ts`.
- AC-24 → met. Server union/decoder/builder has `lootboxOpened` with `partId`, `slot`,
  `rare|epic` rarity, boolean `duplicate`, non-negative integer counts, positive part
  counts and non-empty appearance keys/values; maps are copied; `unknown_slot` added and
  the existing codes retained. Evidence: `protocol.test.ts` valid/invalid matrix.
- AC-25 → met. Frontend mirrors the backend constants/unions/error codes and replays the
  same fixture matrix (including `lootboxOpened`, `unequipPart`, legacy equip ids, bad
  rarity, missing slot, negative/float counts and empty strings). Evidence:
  `protocol.test.ts`.
- AC-26 → met at the session layer: `welcome`/`customizationUpdate` adopt the persisted
  state; only `lootboxOpened` creates a grant, and the account-wide update never replaces
  it; guest sessions receive no account broadcasts. Evidence: `session.test.ts`.
- AC-27 → met. Guest `openLootbox` decrements both counts by one, adds exactly one weighted
  v2 part, sets `lastLootboxGrant` with an advancing sequence and publishes; guest
  equip/unequip validate catalog/ownership/defaults; no message is sent. Evidence:
  `engine.test.ts`, `session.test.ts`.
- AC-28 → met. Legacy ids equip through the pinned mapping; multi-slot ids require both v2
  parts (partial → no-op); standard legacy ids are always allowed; legacy ids are never
  granted. The engine normalizer accepts legacy restored state. Evidence:
  `engine.test.ts`, `session.test.ts` (legacy welcome normalization).
- AC-29 → met. Session exposes `pendingLootboxOpen`: set when the account message is sent
  and cleared on `lootboxOpened`, `customizationUpdate`, `error`, transport status change
  and `welcome`; guest opens never set it. Evidence: `session.test.ts` (all five clears,
  guest assertion).
- AC-32 → met. `lastLootboxGrant` carries `{partId, slot, rarity, duplicate, sequence}`;
  account and guest grants advance the sequence; `customizationUpdate` does not clear or
  replace it; `dismissLootboxReveal()` clears it. Evidence: `engine.test.ts`,
  `session.test.ts`.
- AC-33 → met at T10: `adoptCustomization` normalizes the exact legacy fixture
  (`wings-silver`→both wings, `engine-blue`→both ignitions, `body-gold`→hull) on `welcome`
  and `customizationUpdate`; guest state starts from the zero state. Evidence:
  `engine.test.ts`, `session.test.ts`; DB/hub evidence is T2/T4/T5.
- AC-35 → met at T10: `picking.ts` adds `pickHoverTarget` with preallocated NDC,
  intersection storage and result object plus a cached id; the session records pointer NDC
  and performs at most one hover raycast per animation frame before calling
  `SceneView.setHoverTarget`, clearing on a miss/leave; `pickMiniCube` is unchanged.
  Evidence: `picking.test.ts`, `session.test.ts`; targeting visuals are T9.

Deviations from spec: none. `OnlineGameSession`'s two new commands are optional in the
shared UI type for pre-v2 fake compatibility (the concrete session always implements them);
this is a source-compatibility choice, not a behavior deviation. Pre-existing modified
feature docs and `docs/features/.../reviews/` were left untouched and are not staged.
