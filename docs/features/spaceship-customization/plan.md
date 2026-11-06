---
feature: spaceship-customization
revision: 3
---

# Plan — Spaceship Customization

## Architecture

**State ownership.** Customization is per-account on the server (`CustomizationState` held on `Member` and persisted via `EconomyRepository`) and per-guest in the engine snapshot. The server is the authority for accounts; guests mirror the flow locally. Broadcasts are account-scoped (`customizationUpdate`), mirroring the upgrades/economy pattern.

**Modules (new/edited):**
- Backend pure logic: `src/backend/src/game/parts.ts` (catalog, validation, RNG helper) — mirror of frontend.
- Backend persistence: `EconomyRepository` gains customization methods; migration `005`.
- Backend protocol: `src/backend/src/game/protocol.ts` new messages/error codes, `CustomizationState`, `customizationUpdateMessage`, `copyCustomizationState`.
- Backend hub: loads/persists customization; grants on cube completion; handles `openLootbox`/`equipPart`; broadcasts.
- Frontend pure logic: `src/frontend/src/game/parts.ts` (catalog + `appearanceToSpaceshipParams`).
- Frontend types: `CustomizationState` in `src/frontend/src/game/types.ts`.
- Frontend protocol mirror: `src/frontend/src/multiplayer/protocol.ts`.
- Frontend engine: customization state in snapshot, grant/open/equip for guests, adopt from server.
- Frontend render: `createSpaceship(appearance?)` parameterized; scene applies appearance on change.
- Frontend UI: `SpaceshipCustomizationPanel` + `SpaceshipPreview`; `App.tsx` wiring; `session.ts` commands.

**Data flow (account):** cube completion → hub grants lootbox/key → `customizationUpdate` → session `handleCustomizationUpdate` → engine `adoptCustomization` → snapshot → UI/preview/ship update. Open lootbox: UI → `session.openLootbox` → transport `openLootbox` → hub validates counts (lootboxes first), selects part via `deps.random`, persists via `applyLootboxOpen`, `customizationUpdate` → client adopts. Equip: `equipPart` → hub validates ownership, persists appearance via `setAppearance`, `customizationUpdate`.

**Data flow (guest):** engine grants on cube completion; open/equip mutate local customization and publish; no transport.

### Hub

Account authority. On cube completion, grant lootbox+key to the account and update `customization` on every member whose `accountId` equals the owning account, then broadcast `customizationUpdate` to the account's joined connections. On `openLootbox`: validate counts (lootboxes first), select the granted part via `randomPartId(deps.random())`, persist via `applyLootboxOpen`, then update `customization` on every member with that `accountId`, then broadcast. On `equipPart`: validate the part against the catalog and the account's owned inventory, persist appearance via `setAppearance`, then update `customization` on every member with that `accountId`, then broadcast. Member `customization` is updated before broadcasting (mirroring AC-1 and upgrades `purchaseUpgrade`), so reconnecting/multi-tab members of the account observe the latest state in `welcome`/`worldEntered`.

## Interfaces / contracts

**Backend types:**
```ts
// src/backend/src/game/protocol.ts
export interface CustomizationState {
  lootboxes: number;
  keys: number;
  parts: Record<string, number>;   // partId -> owned count
  appearance: Record<string, string>; // category -> partId
}
```

**Part catalog (shared shape):**
```ts
// src/backend/src/game/parts.ts and src/frontend/src/game/parts.ts
export type PartCategory = 'nose' | 'body' | 'wings' | 'cockpit' | 'engine';
export type PartId = 'nose-default' | 'nose-crimson' | 'nose-emerald'
  | 'body-default' | 'body-obsidian' | 'body-gold'
  | 'wings-default' | 'wings-silver'
  | 'cockpit-default' | 'cockpit-amber'
  | 'engine-default' | 'engine-blue';
export interface PartDef { id: PartId; category: PartCategory; name: string; color: string; }
export const PART_CATALOG: readonly PartDef[]; // 12 rows, see spec § Part catalog
export function isValidPartId(id: string): id is PartId;
export function partCategory(id: string): PartCategory; // throws Error('unknown part: …') for unknown
export function randomPartId(rng: () => number): PartId; // uniform over PART_CATALOG
```

**Frontend visual params:**
```ts
// src/frontend/src/game/parts.ts
export interface SpaceshipVisualParams {
  noseColor: string;    // hex, default '#88aaff'
  bodyColor: string;    // hex, default '#4466cc'
  wingColor: string;    // hex, default '#4466cc'
  cockpitColor: string;  // hex, default '#ffffff'
  engineColor: string;   // hex, default '#ff6600'
}
export function appearanceToSpaceshipParams(appearance: Record<string, string>): SpaceshipVisualParams;
```
`appearanceToSpaceshipParams` resolves each category's color from the equipped part's `color` (via `PART_CATALOG`), falling back to the `*-default` color when the category is absent or the part id is unknown.

**Economy repository additions:**
```ts
// src/backend/src/auth/economy-repository.ts
findCustomizationByUserId(userId): Promise<CustomizationState>; // default zero state for missing row
grantCustomization(userId, delta: { lootboxes?: number; keys?: number }): Promise<CustomizationState>;
applyLootboxOpen(userId, partId: PartId): Promise<
  | { state: CustomizationState }
  | { reason: 'no_lootbox' }
  | { reason: 'no_key' }
>; // lootboxes checked first; atomic conditional UPDATE
setAppearance(userId, appearance: Record<string, string>): Promise<CustomizationState>;
```

**Protocol additions (backend + frontend mirror):**
- Backend `CustomizationState` in `src/backend/src/game/protocol.ts`; frontend `CustomizationState` in `src/frontend/src/game/types.ts` (re-exported by `src/frontend/src/multiplayer/protocol.ts`).
- Client: `{ type: 'openLootbox' }`, `{ type: 'equipPart'; partId: string }`
- Server: `{ type: 'customizationUpdate'; lootboxes: number; keys: number; parts: Record<string, number>; appearance: Record<string, string> }`
- `Placement` (both): `customization?: CustomizationState` (accounts only on the server; parsed defensively on the client).
- Error codes: `no_lootbox`, `no_key`, `unknown_part`, `not_owned`
- Builders: `customizationUpdateMessage(state: CustomizationState): ServerMessage` (backend) / `customizationUpdateMessage(...)` mirror (frontend, if used); defensive copy `copyCustomizationState(state): CustomizationState`.

**Engine snapshot & interfaces:**
```ts
// src/frontend/src/game/engine.ts
export interface EngineSnapshot {
  // … existing …
  customization?: CustomizationState; // optional on base
}
export interface OnlineEngineSnapshot extends EngineSnapshot {
  // … existing …
  customization: CustomizationState; // always populated by createEngine
}
```
`GameEngine` (optional on base, implemented by `createEngine`):
```ts
adoptCustomization?(state: CustomizationState): void;
openLootbox?(): void;
equipPart?(partId: string): void;
```
`OnlineGameEngine` requires all three. `createEngine` always populates `customization` (default zero state) and implements `adoptCustomization` (replaces entire state), `openLootbox` (guest: validates counts, decrements, adds random part, publishes), `equipPart` (guest: validates catalog + owned inventory, no-op otherwise, updates appearance, publishes).

**Session (OnlineGameSession):** add `openLootbox(): void`, `equipPart(partId: string): void`. Track `joinedMode` (already from upgrades). Guest branch: call `engine.openLootbox()` / `engine.equipPart(partId)` locally and publish the resulting snapshot; invalid (insufficient/unknown/unowned) opens/equips are no-ops that leave state unchanged. Account branch: send `{ type: 'openLootbox' }` / `{ type: 'equipPart', partId }` over transport; server errors leave client state unchanged (no optimistic mutation). Also handle inbound `customizationUpdate` → `engine.adoptCustomization`.

**Render:** `createSpaceship(appearance?: Record<string, string>)` applies part-derived materials (color per category). `SceneView.applySnapshot` re-applies appearance when `snapshot.customization?.appearance` changes from the last applied (rebuild materials or recreate). Exposed for tests: `SceneView` retains the last applied appearance (shallow copy).

**RNG:** hub openLootbox selects the granted part via `randomPartId(deps.random())` (reuses the injected factory); frontend engine uses its own RNG (`setRandomSource`/seeded LCG) for guest opens. Tests inject deterministic factories/sources.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/parts.ts` | New | Backend part catalog + helpers |
| `src/backend/src/game/parts.test.ts` | New | Catalog/validation/RNG tests |
| `src/backend/src/db/migrations/005_spaceship_customization.sql` | New | Schema migration |
| `src/backend/src/db/schema.sql` | Edit | Mirror new columns |
| `src/backend/src/auth/economy-repository.ts` | Edit | Customization persistence methods |
| `src/backend/src/auth/economy-repository.test.ts` | Edit | Coverage for new methods |
| `src/backend/src/game/protocol.ts` | Edit | New messages/error codes, `CustomizationState`, builders, copy helper |
| `src/backend/src/game/protocol.test.ts` | Edit | Codec/parity fixtures |
| `src/backend/src/game/hub.ts` | Edit | Grant, open, equip, broadcast, Member.customization |
| `src/backend/src/game/hub.test.ts` | Edit | Behavior tests |
| `src/frontend/src/game/parts.ts` | New | Frontend catalog + params helper |
| `src/frontend/src/game/parts.test.ts` | New | Params mapping tests |
| `src/frontend/src/game/types.ts` | Edit | `CustomizationState` |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirror protocol |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Parity tests |
| `src/frontend/src/game/engine.ts` | Edit | Customization state + guest flow + adopt + interfaces |
| `src/frontend/src/game/engine.test.ts` | Edit | Tests |
| `src/frontend/src/render/spaceship.ts` | Edit | Parameterized appearance |
| `src/frontend/src/render/spaceship.test.ts` | Edit | Appearance tests |
| `src/frontend/src/render/scene.ts` | Edit | Apply appearance to ship on change |
| `src/frontend/src/render/scene-spaceship.test.ts` | Edit | Scene tests |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx` | New | Menu panel |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx` | New | SSR contract |
| `src/frontend/src/ui/SpaceshipPreview.tsx` | New | Live 3D preview |
| `src/frontend/src/ui/SpaceshipPreview.test.tsx` | New | SSR contract |
| `src/frontend/src/ui/app.css` | Edit | Modern styling |
| `src/frontend/src/game/session.ts` | Edit | openLootbox/equipPart commands + handleCustomizationUpdate |
| `src/frontend/src/game/session.test.ts` | Edit | Command tests |
| `src/frontend/src/App.tsx` | Edit | Wire panel + menu toggle |
| `src/frontend/src/App.test.tsx` | Edit | Tests |
| `README.md` | Edit | Docs (documentation pass) |
| `docs/product/glossary.md` | Edit | New terms |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Persist customization in `user_economy` columns (lootboxes, keys, parts JSONB, appearance JSONB) | Mirrors upgrades pattern; single row per user | Separate tables — more joins, more migration |
| 2 | Account-scoped broadcast only | Consistent with upgrades; avoids cross-client leakage | Global broadcast — privacy/UX concerns |
| 3 | Grant lootbox+key on cube completion | Matches "destroying cubes"; reuses completion path | Mini-cube drops — more frequent, more complex |
| 4 | Uniform random part selection | Simple, testable | Rarity weights — deferred (Q-2) |
| 5 | Guest ephemeral state in engine | Mirrors guest coins; no DB | LocalStorage persistence — deferred (Q-3) |
| 6 | Parameterize `createSpaceship` with appearance | Single seam for cursor + preview | Separate builders — duplication |
| 7 | Discriminated `applyLootboxOpen` result | Maps failure reason for AC-4; check order pinned | Hub pre-check + atomic UPDATE — equivalent |
| 8 | `CustomizationState` in backend `protocol.ts` / frontend `types.ts` | Mirrors `UpgradeState` location | Shared package — none exists |

## Risks & mitigations

- **Coverage on WebGL preview component:** SSR cannot execute effects; mitigate by keeping component thin and logic in pure helpers covered by unit tests. If coverage fails, split further or report blocked.
- **Migration numbering conflict:** verify `005` is next free at build time (Q-8).
- **Protocol parity drift:** frontend mirror must be updated in same task; parity tests gate.
- **Guest/server double-grant:** engine grants optimistically; server `customizationUpdate` overwrites for accounts via `adoptCustomization`, matching economy pattern.
- **Reactive seam:** `SceneView` must not leak the spaceship; re-apply appearance without recreating the whole scene.

## Open questions

See spec.md § Open questions (Q-1…Q-8).

## Assumptions

See spec.md § Assumptions.