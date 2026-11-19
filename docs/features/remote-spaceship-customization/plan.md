---
feature: remote-spaceship-customization
revision: 3
---
# Plan — Remote Spaceship Customization

## Architecture

**State ownership.** Four owners, unchanged in kind:

| Value | Owner | Transport | Mutability |
| --- | --- | --- | --- |
| Catalog (1,351 rows) | `game/parts-v3.ts` (mirrored, pure) | never on the wire | compiled constants + pure generation |
| Account appearance/inventory | hub + `EconomyRepository` (`user_economy`) | `customizationUpdate` (account), `welcome.customization` | server-validated writes only |
| Public appearance projection | hub (`Member.appearance`) | `MemberState.appearance?`, `memberAppearance` | account: from persisted state (seeded on join/rejoin); guest: structural validation of `setAppearance` |
| Remote ship presentation | client `render/remote-ship.ts` | derived from the projection + removal broadcasts | client-local, presentation only |

**Modules (new/edit):**

- Backend pure catalog: `src/backend/src/game/parts-v3.ts` — slots/forms/finishes tables, generated
  rows, checksum, loot draw, normalizers, `shotStyleForPart`. Mirrored in
  `src/frontend/src/game/parts-v3.ts` with the same tables/generator plus the renderer-facing
  `appearanceToShipParamsV3`.
- Backend transport: `protocol.ts` (optional `MemberState.appearance`, `memberAppearance`,
  `setAppearance`, bounds, `memberAppearanceOf`, builders), `hub.ts` (join seeding, equip fan-out,
  guest path, rate limit, grace/move), `economy-repository.ts` (v3 types + normalizer),
  `observability/metrics.ts` (allow-lists).
- Frontend pure: `game/ship-forms.ts` (form recipes, slot transform formula, chassis pose),
  `ui/hangar-tabs.ts` (6 tabs, totals), `game/reveal-motion.ts` (`shot` yaw).
- Frontend render: `render/cursor-ship.ts` (v3 resolution, chassis store, `applyPulseScale` as the
  only model-scale writer), `render/shot-visuals.ts`
  (4 projectile + 3 muzzle geometries), `render/spaceship.ts` (shot style/muzzle; `applyPulse` calls
  `applyPulseScale`), `render/preview.ts`
  (v3 appearance on the preview model), `render/remote-ship.ts` (the remote ship), `render/cube-view.ts`
  + `render/world.ts` (`tileOrigin`, roster appearance copy), `render/scene.ts` (wiring, spectate
  member + live appearance, tier), `render/lootbox-reveal.ts` (v3).
- Frontend UI/state: `multiplayer/protocol.ts`, `multiplayer/server-state.ts`, `game/engine.ts`
  (v3 guest validation + `adoptAppearance`), `game/session.ts` (guest adoption/send, spectate + live
  appearance wiring), `ui/SpaceshipCustomizationPanel.tsx` (v3 + form grid), `ui/SpaceshipPreview.tsx`
  (v3 mapping + attributes), `ui/LootboxReveal.tsx`, `ui/game-view.css`.

**Data flow — catalog.** Both workspaces build the same rows from the pinned tables:
`for slot of SLOT_CATALOG_V3: classic rows (v2) then for form of FORM_CATALOG (skip classic) for
finish of FINISH_CATALOG`. Each generated row is
`{ id: slot-form-finish, slot, name: '<Finish label> <Form label> <SLOT_NOUN>', rarity: finish.rarity,
color: finish.color, accent: finish.accent, form, finish, shape: form }`. Classic rows keep their
v2 `name`/`rarity`/`color`/`accent`/`shape` with `form: 'classic'`, `finish: 'classic'`.

**Data flow — appearance (account).** Join/rejoin: load `customization` and seed
`member.appearance = normalizeAppearanceV3(customization.appearance)` before `welcome`.
`equipPart` → validate (v3 catalog + ownership) → `setSlotAppearance` → update every member of the
account (`customization` + `appearance`) → for each affected member whose appearance changed,
`memberAppearance` on that member's server (encode once per server) → `customizationUpdate` to the
account's joined tabs. `unequipPart` is the same with the slot's standard part.

**Data flow — appearance (guest).** Client `equipPart` (engine-local) → the session notices the
engine appearance changed and sends `setAppearance { appearance }` (guest only, at most once per
accepted local change) → hub normalizes and pins → `memberAppearance` to the server's other members.
On `welcome`, the guest session first **adopts** `welcome.roster[self].appearance` into the engine
when its local record is empty (`engine.adoptAppearance`), then sends one `setAppearance` iff the
resulting record is non-empty and differs from the roster self entry.

**Data flow — remote ship.** `session.handleWelcome/handleWorldEntered` → `scene.enterWorld` /
`queueWorldSwap` (roster, unchanged) → `session.handleTravelArrival` / `returnToCube` →
`scene.setSpectatedMember(target | null)` → `remote-ship.createRemoteShip(member)` (appearance from
the roster copy) → per frame `remoteShip.update(dtMs, reducedMotion, hiddenMeshes)`. Each
`miniCubeRemoved`/`miniCubesRemoved` reaches `scene.applyWorldMessage` → `world.tileOrigin(member, id)`
→ `remoteShip.fire(target, nowMs)`. A live `memberAppearance` reaches
`session.handleMemberAppearance` → the reducer stores it → `scene.setSpectatedAppearance(playerId,
appearance)` applies it to the mounted ship when the id matches (no remount).

**Form transform formula (pinned, frontend-only).** For a generated form `f` with
`{ lengthScale: L, widthScale: W, sweepDeg: S, thicknessScale: T, offsetZ: O }` and
`Srad = S * π / 180`, `slotFormTransform(slot, f)` returns:

| slot | scale | rotation | position |
| --- | --- | --- | --- |
| `hull` | `[W, T, L]` | `[0, 0, 0]` | `[0, 0, O]` |
| `nose` | `[W, W, L]` | `[0, 0, 0]` | `[0, 0, 2O]` |
| `cockpit` | `[W, T, L]` | `[0, 0, 0]` | `[0, 0.02T, 0]` |
| `wing-left` / `wing-right` | `[W, T, L]` | `[0, ∓Srad, 0]` (left +, right −) | `[0, 0, 0]` |
| `engine-left` / `engine-right` | `[W, T, L]` | `[0, 0, 0]` | `[0, 0, O]` |
| `ignition-left` / `ignition-right` | `[0.8W, 0.8T, 0.8L]` | `[0, 0, 0]` | `[0, 0, 0]` |
| `tail-fin` | `[W, L, T]` | `[0, 0, ∓0.5Srad]` (left +, right −) | `[0, 0, 0]` |
| `shot` | `[1, 1, 1]` | `[0, 0, 0]` | `[0, 0, 0]` |

`chassisPose(form)` returns the form's pinned `chassis` triple (classic `[1, 1, 1]`). The
`cursor-ship-model` group **stores** that triple and exposes `applyPulseScale(pulseScale)`, which
writes `[chassis.x · pulse, chassis.y · pulse, chassis.z · pulse]`; `Spaceship.applyPulse()` calls it
instead of `model.group.scale.setScalar(...)`, so the accepted 260 ms equip pulse (1 → 1.04 → 1)
composes with the chassis instead of overwriting it. Rest and peak values are pinned in AC-17.

**Layering (pinned).** The v2-table resolution helper lives in `render/cursor-ship.ts`, which already
owns `CURSOR_SLOT_SHAPE_TRANSFORMS` and imports the pure `game/ship-forms.ts` formula; `game/ship-forms.ts`
imports only pure `game/**` modules (never `three` or `render/**`) and carries an import-boundary
assertion in its test. Resolution order for a slot shape key is: (1) the accepted
`CURSOR_SLOT_SHAPE_TRANSFORMS[slot][shape]` v2 entry, (2) the formula above when `shape` is a
generated form id, (3) the slot's `standard` entry. This preserves every v2 visual exactly.

**Remote ship hierarchy (pinned).** `remote-ships` (manager, created lazily while a ship is mounted)
→ `remote-ship` root (anchor + `lookAt` aim; the only group whose `+z` is asserted) → `remote-ship-body`
child (`position.y = bobY`, `rotation.y = swayYaw`, recoil along local `−z`) → `cursor-ship-model` →
10 slot groups → 21 meshes. The `shots` group is a sibling of the body under the root and holds at
most two bolt meshes plus at most one live muzzle mesh (`Shot.muzzleFlash`, 80 ms flash vs. the
90 ms spawn interval). Object/draw arithmetic: manager 1 + root 1 + body 1 + model 32 + shots group 1
= **36 objects / 21 draws at rest**; every bolt adds +1/+1 and a live muzzle adds +1/+1, so the peak
is **39 / 24**.

## Interfaces / contracts

**Catalog v3 (both workspaces, identical rows):**

```ts
export type SlotIdV3 = SlotId | 'shot';                 // SlotId from parts-v2 (10 ship slots)
export type PartIdV3 = `${SlotIdV3}-${string}`;         // runtime gate: isValidPartIdV3
export type FormId = 'classic' | 'dart' | 'lance' | 'needle' | 'manta'
                   | 'hauler' | 'bulwark' | 'arrow' | 'orca' | 'talon' | 'kite';

export interface FormDef { id: FormId; label: string; recipe: FormRecipe | null; }
export interface FormRecipe {
  lengthScale: number; widthScale: number; sweepDeg: number;
  thicknessScale: number; offsetZ: number;
  chassis: readonly [number, number, number];
  shot: { geometry: 'bolt' | 'orb' | 'wave' | 'shard'; scale: number;
          muzzle: 'spark' | 'ring' | 'petal' };
}
export interface FinishDef { id: string; label: string; color: string; accent: string;
                             rarity: 'rare' | 'epic'; }
export interface PartDefV3 {
  id: string; slot: SlotIdV3; name: string; rarity: Rarity;
  color: string; accent: string; form: FormId; finish: string; shape: string;
}

export const PART_CATALOG_VERSION: 3;
export const SLOT_CATALOG_V3: readonly SlotDef[];
export const SLOT_NOUN: Readonly<Record<SlotIdV3, string>>;
export const FORM_CATALOG: readonly FormDef[];
export const FINISH_CATALOG: readonly FinishDef[];
export const PART_CATALOG_V3: readonly PartDefV3[];      // 1,351 rows
export const CATALOG_ROW_COUNT: 1351;
export const LOOTABLE_ROW_COUNT: 1340;
export const CATALOG_ROWS_HASH: string;                  // FNV-1a 32-bit, 8 lowercase hex digits

export function isValidSlotIdV3(id: string): id is SlotIdV3;
export function isValidPartIdV3(id: string): id is PartIdV3;
export function partDefinitionV3(id: string): PartDefV3;             // throws unknown part: <id>
export function catalogForSlot(slot: SlotIdV3): readonly PartDefV3[];
export function catalogForSlotForm(slot: SlotIdV3, form: FormId): readonly PartDefV3[];
export function defaultPartForSlotV3(slot: SlotIdV3): string;
export function selectLootPartV3(rng: () => number): string;         // NaN/-Inf → 0, Inf → 1
export function shotStyleForPart(partId: string): ShotStyleDef;      // non-shot → shot-default
export function normalizePartMapV3(parts: Record<string, number>): Record<string, number>;
export function normalizeAppearanceV3(appearance: Record<string, string>): Record<string, string>;
export function normalizeCustomizationStateV3(state: CustomizationState): CustomizationState;
// frontend only:
export function appearanceToShipParamsV3(appearance: Record<string, string>):
  Record<SlotIdV3, PartVisual & { partId: string; form: FormId }>;
export function computeCatalogRowsHash(rows: readonly PartDefV3[]): string;   // test seam
```

**Form math (frontend, pure):**

```ts
// game/ship-forms.ts — pure `game/**` only (no `three`, no `render/**`)
export interface SlotTransform {
  scale: [number, number, number];
  rotation: [number, number, number];
  position: [number, number, number];
}
export const FORM_RECIPES: Readonly<Record<Exclude<FormId, 'classic'>, FormRecipe>>;
export function slotFormTransform(slot: SlotIdV3, form: FormId): SlotTransform; // classic/shot → identity
export function chassisPose(form: FormId): readonly [number, number, number];

// render/cursor-ship.ts — owns CURSOR_SLOT_SHAPE_TRANSFORMS and the resolution helper
export interface CursorShipModel {
  // … existing …
  /** The chassis triple from the equipped hull form (classic `[1, 1, 1]`). */
  readonly chassisScale: readonly [number, number, number];
  /** Writes `group.scale = chassis × pulseScale` (the only writer of the model scale). */
  applyPulseScale(pulseScale: number): void;
}
```

**Protocol additions (backend; frontend mirror in `multiplayer/protocol.ts`):**

```ts
export const APPEARANCE_MAX_ENTRIES = 11;
export const APPEARANCE_VALUE_MAX_LENGTH = 40;   // longest catalog id is 30
export const APPEARANCE_JSON_MAX_BYTES = 700;    // measured worst frame 492 B

export interface MemberState { /* existing */
  appearance?: Record<string, string>;           // optional on the wire; server always populates
}

/** Normalizes a member's appearance: the field when valid, otherwise {}. */
export function memberAppearanceOf(member: MemberState): Record<string, string>;

// server → client
| { type: 'memberAppearance'; playerId: string; appearance: Record<string, string> }

// client → server
| { type: 'setAppearance'; appearance: Record<string, string> }

export function memberAppearanceMessage(playerId: string,
  appearance: Record<string, string>): ServerMessage;
export function copyAppearance(appearance: Record<string, string>): Record<string, string>;
```

`MemberState.appearance` stays optional so every existing full-literal fixture compiles untouched;
the backend's `memberState()`/`rosterFor()` always set it, and the client's `copyMember`,
`reduceWorldState` and `SceneWorld` roster copy all pass through `memberAppearanceOf` so the runtime
record is always `{}` or a valid 11-entry map. `stateSync`/`levelAdvanced` are unchanged.

**Muzzle and shot visuals:**

```ts
// render/shot-visuals.ts
export type ShotGeometryKind = 'bolt' | 'orb' | 'wave' | 'shard';
export type MuzzleKind = 'spark' | 'ring' | 'petal';
export interface ShotGeometrySet {
  readonly projectiles: Readonly<Record<ShotGeometryKind, BufferGeometry>>;
  readonly muzzles: Readonly<Record<MuzzleKind, BufferGeometry>>;
  dispose(): void;
}
export function createShotGeometries(): ShotGeometrySet;
```

`shotStyleForPart` returns
`{ partId, geometry, scale, muzzle, color, accent }`; `Spaceship` and `RemoteShip` each own one
geometry set + one projectile material + one muzzle material. A shot captures
`geometry`/`scale`/`muzzle` at spawn; the materials follow the equipped style.

**Repository (widened types only; storage shape unchanged):**

```ts
applyLootboxOpenV2(userId: string, partId: PartIdV3): Promise<
  | { state: CustomizationState; duplicate: boolean }
  | { reason: 'no_lootbox' } | { reason: 'no_key' }>;
setSlotAppearance(userId: string, slot: SlotIdV3,
  partId: PartIdV3 | null): Promise<CustomizationState>;
// normalizeRead() switches from normalizeCustomizationState (v2) to normalizeCustomizationStateV3
```

**Hub internals:**

```ts
// Member gains: appearance: Record<string, string>
function setMemberAppearance(member: Member, appearance: Record<string, string>): boolean;
function broadcastMemberAppearance(member: Member): void;   // server-scoped, except origin
function handleSetAppearance(c: Connection,
  m: Extract<ClientMessage, { type: 'setAppearance' }>): void;
// join/rejoin: member.appearance = normalizeAppearanceV3(customization.appearance) (accounts)
```

**Engine (guest):**

```ts
adoptAppearance?(appearance: Record<string, string>): void;  // replaces only `customization.appearance`
```

**Remote ship (frontend render):**

```ts
// render/remote-ship.ts
export const REMOTE_SHIP_OFFSET = { x: 1.6, y: 2.8, z: 4.4 } as const;
export const REMOTE_SHIP_SCALE = 1.2;                 // === SPACESHIP_SCALE
export const REMOTE_SHOT_MIN_INTERVAL_MS = 90;
export const REMOTE_SHOT_MAX_IN_FLIGHT = 2;
export const REMOTE_SHIP_BOB_AMPLITUDE = 0.12;
export const REMOTE_SHIP_BOB_PERIOD_MS = 2600;
export const REMOTE_SHIP_SWAY_RAD = 0.05;
export const REMOTE_SHIP_RECOIL_OFFSET = 0.12;

export interface RemoteShip {
  readonly group: Group;                              // `remote-ship` root (anchor + aim)
  readonly body: Group;                               // `remote-ship-body` (bob/sway/recoil)
  readonly playerId: string;
  applyAppearance(appearance: Record<string, string>): readonly SlotIdV3[];
  applyShotStyle(style: ShotStyleDef): void;
  fire(target: Vector3, nowMs: number): boolean;      // false when rate/cap dropped it
  update(dtMs: number, reducedMotion: boolean, hiddenMeshes: readonly string[]): void;
  readonly shots: readonly Shot[];
  dispose(): void;                                    // idempotent
}
export function createRemoteShip(member: MemberState): RemoteShip;
export function remoteShipAnchor(position: Position): { x: number; y: number; z: number };
export function remoteShipIdle(elapsedMs: number, reducedMotion: boolean):
  { bobY: number; swayYaw: number };
export function remoteShipRecoil(elapsedMs: number): number;   // 0 → -0.12, 120 → 0
```

```ts
// render/scene.ts (additive)
setSpectatedMember(playerId: string | null): void;
setSpectatedAppearance(playerId: string, appearance: Record<string, string>): void;
// render/cube-view.ts (additive)
tileOrigin(id: string): Vector3 | null;
// render/world.ts (additive)
member(playerId: string): MemberState | null;
tileOrigin(playerId: string, id: string): Vector3 | null;
```

**Hangar tabs (frontend):**

```ts
export type HangarTabId = 'frame' | 'front' | 'wings' | 'engines' | 'ignitions' | 'shots';
export interface HangarTab { id: HangarTabId; label: string; slots: readonly SlotIdV3[]; }
export const HANGAR_TABS: readonly HangarTab[];                       // 6
export const HANGAR_DEFAULT_TAB: 'frame';
export const HANGAR_TAB_LOOTABLE_TOTALS: Readonly<Record<HangarTabId, number>>;
export function tabForSlot(slot: SlotIdV3): HangarTabId;
export function tabOwnedCount(tab: HangarTab, parts: Record<string, number>): number;
```

**Session behaviour:** track the last sent appearance; after `welcome` (guest only) adopt
`memberAppearanceOf(roster self)` into the engine when the local record is empty, then send once when
the resulting record is non-empty and differs; after a successful local `equipPart`/`unequipPart`
(guest) send the new normalized appearance; handle `memberAppearance` (store via the reducer and call
`scene.setSpectatedAppearance`); on spectate arrival/return/`memberLeft`/`welcome`/`handleStatus`
call `scene.setSpectatedMember`.

## File inventory

| Path | New/Edit | Owner | Purpose |
| --- | --- | --- | --- |
| `src/backend/src/game/parts-v3.ts` | New | T1 | 11 slots, 1,351 rows, loot draw, normalizers, shot style |
| `src/backend/src/game/parts-v3.test.ts` | New | T1 | AC-1…AC-6 backend |
| `src/backend/src/game/protocol.ts` | Edit | T3 | Optional `MemberState.appearance`, `memberAppearanceOf`, two frames, bounds, builders |
| `src/backend/src/game/protocol.test.ts` | Edit | T3 | Codec/parity fixtures |
| `src/backend/src/game/hub.ts` | Edit | T6 | Appearance seeding, equip fan-out, guest path, rate limit |
| `src/backend/src/game/hub.test.ts` | Edit | T6 | AC-10…AC-14 sequences |
| `src/backend/src/auth/economy-repository.ts` | Edit | T5 | v3 types + v3 normalizer |
| `src/backend/src/auth/economy-repository.test.ts` | Edit | T5 | v3 round-trip |
| `src/backend/src/observability/metrics.ts` | Edit | T4 | Allow-list entries |
| `src/backend/src/observability/metrics.test.ts` | Edit | T4 | Allow-list assertions |
| `src/frontend/src/game/parts-v3.ts` | New | T2 | Catalog mirror + `appearanceToShipParamsV3` |
| `src/frontend/src/game/parts-v3.test.ts` | New | T2 | AC-1…AC-6 frontend |
| `src/frontend/src/game/ship-forms.ts` | New | T9 | Form recipes, slot transform, chassis pose (pure `game/**` only) |
| `src/frontend/src/game/ship-forms.test.ts` | New | T9 | Formula fixtures, classic identity |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | T7 | Wire mirror + `memberAppearanceOf` |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | T7 | Parity + optional-field fixtures |
| `src/frontend/src/multiplayer/server-state.ts` | Edit | T7 | Member appearance in `members` |
| `src/frontend/src/multiplayer/server-state.test.ts` | Edit | T7 | Reduction + missing-field default |
| `src/frontend/src/game/engine.ts` | Edit | T8 | v3 guest validation + `adoptAppearance` |
| `src/frontend/src/game/engine.test.ts` | Edit | T8 | v3 guest flow + adoption |
| `src/frontend/src/game/session.ts` | Edit | T13 | Guest adopt/send; spectate + live appearance wiring |
| `src/frontend/src/game/session.test.ts` | Edit | T13 | AC-13/AC-15 |
| `src/frontend/src/render/cursor-ship.ts` | Edit | T9 | v3 resolution, form transforms, chassis store + `applyPulseScale` |
| `src/frontend/src/render/cursor-ship.test.ts` | Edit | T9 | AC-17: chassis store, pulse multiplication, layout resolution |
| `src/frontend/src/render/preview.ts` | Edit | T9 | Preview model uses the v3 mapping (doc + behaviour) |
| `src/frontend/src/render/preview.test.ts` | Edit | T9 | AC-31 v3 appearance on the preview model |
| `src/frontend/src/render/shot-visuals.ts` | New | T10 | Four projectile + three muzzle geometries |
| `src/frontend/src/render/shot-visuals.test.ts` | New | T10 | Geometry set + dispose |
| `src/frontend/src/render/spaceship.ts` | Edit | T10 | `applyShotStyle`, spawn capture, muzzle, `applyPulse` → `applyPulseScale` |
| `src/frontend/src/render/spaceship.test.ts` | Edit | T10 | AC-17 pulse composition + AC-24/AC-25 |
| `src/frontend/src/game/motion.ts` | Edit | T10 | `remoteShipRecoilMs`, `remoteShotFlashMs` |
| `src/frontend/src/game/motion.test.ts` | Edit | T10 | Token values |
| `src/frontend/src/render/remote-ship.ts` | New | T11 | Remote ship (pose, idle, firing, recoil, reduced motion) |
| `src/frontend/src/render/remote-ship.test.ts` | New | T11 | AC-15…AC-22, AC-26 |
| `src/frontend/src/render/cube-view.ts` | Edit | T12 | `tileOrigin` |
| `src/frontend/src/render/cube-view.test.ts` | Edit | T12 | Tile origin values |
| `src/frontend/src/render/world.ts` | Edit | T12 | `member`, `tileOrigin`, appearance copy |
| `src/frontend/src/render/world.test.ts` | Edit | T12 | Origin + roster default |
| `src/frontend/src/render/scene.ts` | Edit | T12 | Lazy ships manager, spectate member + live appearance, firing |
| `src/frontend/src/render/scene.test.ts` | Edit | T12 | AC-15/AC-17/AC-20/AC-22/AC-25/AC-26 |
| `src/frontend/src/render/scene-spaceship.test.ts` | Edit | T12 | Ship/own-ship invariants |
| `src/frontend/src/game/reveal-motion.ts` | Edit | T14 | `shot` yaw |
| `src/frontend/src/game/reveal-motion.test.ts` | Edit | T14 | AC-31 |
| `src/frontend/src/render/lootbox-reveal.ts` | Edit | T14 | v3 part resolution |
| `src/frontend/src/render/lootbox-reveal.test.ts` | Edit | T14 | `shot` reveal |
| `src/frontend/src/ui/LootboxReveal.tsx` | Edit | T14 | v3 part resolution |
| `src/frontend/src/ui/LootboxReveal.test.tsx` | Edit | T14 | `shot` card |
| `src/frontend/src/ui/hangar-tabs.ts` | Edit | T15 | 6 tabs, totals, `shot` |
| `src/frontend/src/ui/hangar-tabs.test.ts` | Edit | T15 | AC-27 |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx` | Edit | T15 | v3 normalizers + form strip + 3/12-cell grids |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx` | Edit | T15 | AC-28…AC-31 |
| `src/frontend/src/ui/SpaceshipPreview.tsx` | Edit | T15 | v3 mapping, 10 v3 slot attributes, legacy colours from v3 |
| `src/frontend/src/ui/SpaceshipPreview.test.tsx` | Edit | T15 | AC-31 preview contract |
| `src/frontend/src/ui/game-view.css` | Edit | T15 | Form strip/grid styles, badge width |
| `src/frontend/src/ui/game-view.css.test.ts` | Edit | T15 | CSS guards |
| `src/frontend/src/App.test.tsx` | Edit | T15 | Six tabs / new totals in the accepted shell tests |
| `tests/e2e/smoke.mjs` | Edit | T16 | AC-35 appearance round trip |
| `README.md` | Edit | T17 | Six-tab hangar paragraph + phrases |
| `docs/architecture/realtime.md` | Edit | T17 | `## Public appearance projection` |
| `docs/architecture/frontend-rendering.md` | Edit | T17 | `## Remote ships`, idle 182 baseline (36 objects / 21 draws; peak 185 / 24) |
| `docs/architecture/observability.md` | Edit | T17 | Metric allow-list rows + paragraph |
| `docs/product/glossary.md` | Edit | T17 | New/updated terms |
| `docs/features/remote-spaceship-customization/{spec,plan,tasks}.md` | New/Edit | planner | Feature artifacts (`status.md` is orchestrator-synced, never edited by a worker) |

**Compile-compatibility (F3).** `src/frontend/src/ui/UserPanel.test.tsx`,
`src/frontend/src/multiplayer/activity-lifetime.test.ts` and the scene/session `MemberState`
fixtures are **not** edited by this feature: `appearance` is optional on the wire and
`memberAppearanceOf` supplies `{}`, so their full literals keep compiling. `App.test.tsx` is edited
only for the panel contract (six tabs / new totals), never for appearance fixtures.

Untouched (asserted by diff gates): `src/*/src/game/parts-v2.ts` + its tests, `compose.yaml`,
`compose.smoke.yaml`, both Dockerfiles, `src/backend/src/server.ts`, `src/backend/src/db/**`,
`package.json`, `package-lock.json`, `src/*/package.json`, `docs/features/README.md`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Public appearance as `MemberState.appearance` + one `memberAppearance` frame + one `setAppearance` frame | The appearance is already rendered data; a field avoids repeating it in every existing frame, and the update frame is needed because guests equip at runtime | Reusing `memberJoined` for updates (semantic overload, full-member payload), a generic `stateSync` (account-private), coalescing (unnecessary at human rate) |
| 2 | `appearance` is **optional** on the wire and normalized by `memberAppearanceOf` | Keeps every existing full-literal fixture compiling untouched and tolerates an older backend; the runtime record is always valid | Required field (breaks `UserPanel.test.tsx`, `activity-lifetime.test.ts`, `App.test.tsx` and forces cross-task file ownership) |
| 3 | Only the spectated member's ship renders | The accepted camera layouts put every other cube off-screen (`SLOT_SPACING` 24 vs ≈ 8.95 half-width); rendering invisible ships costs draws for no pixels | Nearest-3 ships (Q-1 A), an overview camera (new feature) |
| 4 | Deterministic generated catalog with the 30 classic rows as a preserved subset | 1,351 rows cannot be hand-authored; generation keeps both workspaces identical from small tables | Hand-authored 1,000 rows (unreviewable), JSON asset (build coupling), shared package (none exists) |
| 5 | Generated id `slot-form-finish`, name `Finish Form Noun`, rarity from the finish | Stable, readable, ≤ 30 characters, collision-free with the two-segment classic ids | Numeric ids (opaque), hash ids (unreadable), per-slot id tables (1,351 literals) |
| 6 | Chassis = the hull part's generated form; one formula for all slot transforms | "Chassis/form" changes read on the hull, wings and tail at once; one parameter table drives both models, the preview and the reveal | Separate chassis slot (a 12th slot for one visual), per-form geometry swaps (mesh explosion) |
| 7 | A dedicated `shot` slot with 10 forms × 12 finishes | The request names shooting animations as a customization; it keeps the projectile independent of the nose | Deriving it from `nose` (hidden coupling), a global setting (not collectible) |
| 8 | No DB migration; code version 3, column version 2 | Storage shape and every id are unchanged; only the reader widens | Bumping `customization_version` with a no-op migration (churn) |
| 9 | Guests' appearance is structurally validated, not ownership-validated; they adopt the stored record on resume | Guests have no persisted inventory by accepted design; cosmetics carry no advantage; adoption keeps their own view truthful | Rejecting guest reports (uniform guest ships), guest persistence (a new identity model) |
| 10 | Remote firing derives from `miniCubeRemoved`/`miniCubesRemoved` | Zero new traffic, inherits server ordering, rate-limited by construction (30 clicks/s → batched ≤ ~25 frames/s, 90 ms local cap) | A new `remoteShot` message (more bytes, more state) |
| 11 | Aim on the root, idle/recoil on a body child | Keeps the aim assertion exact and independent of the animation; a single group cannot satisfy both | Applying sway to the root and measuring "unswayed" (untestable) |
| 12 | Form strip + 3/12-cell grid instead of a 1,351-row list | Bounded DOM (≤ 12 cells per row), no search box, no new text input | Search/filter panel (new surface + tests), virtual list (new dependency/pattern) |
| 13 | Duplicate the tables + generator in both workspaces and pin `CATALOG_ROWS_HASH` | Follows the accepted mirror policy; a shared package is not in the stack | Cross-workspace import (tsconfig/bundle boundaries), generated JSON (build step) |
| 14 | Immediate `memberAppearance` (no coalescing) | Equip is human-paced and rate-limited at 10/s; coalescing adds a timer for no measurable gain | 100 ms coalescer |
| 15 | Lazy `remote-ships` manager group | No baseline shift when nobody is spectated; the measured 135/146/210/322 counts return exactly on disposal | Always-mounted manager (+1 object in every fixture) |
| 16 | Chassis is multiplied by the equip pulse, never written by it | The accepted 260 ms pulse writes the model scale every frame; multiplying preserves both the chassis (the request's "form") and the accepted equip feedback | Dropping the pulse for generated chassis (supersedes an accepted AC for no gain), writing the chassis after the pulse each frame (last-writer ambiguity) |
| 17 | The v2 shape-table resolution helper stays in `render/cursor-ship.ts`; `game/ship-forms.ts` stays pure | `cursor-ship.ts` already owns the table, and a pure `game/**` module importing `render/**`/three would be a cycle and a layer violation | Moving the table into `game/**` (touches the accepted cursor module's data), duplicating the table (drift) |

## Risks & mitigations

- **R1 — `coin-economy` file overlap (sequencing, extended by F4).** Its open fix-up round (code
  review r1 F1/F2 in `engine.test.ts`, F3 in `hub.test.ts`) and its build round own
  `src/backend/src/game/protocol.ts` + test, `src/backend/src/game/hub.ts` + test,
  `src/backend/src/auth/economy-repository.ts` + test, `src/frontend/src/game/engine.ts` + test,
  `src/frontend/src/game/session.ts` + test, and `docs/product/glossary.md`. → Mitigation: T3, T5, T6,
  **T8**, T13 and T17 are **gated**; the orchestrator dispatches them only after the `coin-economy`
  fix-up round reaches `code_review`. Their diffs are additive lines (one optional field, two union
  members, three signatures, one normalizer import, one `adoptAppearance` method, four call sites,
  doc paragraphs). T8's `[P]` marker means file-disjointness only; it does not waive the gate.
- **R2 — Silent v3 data loss through the repository normalizer.** `normalizeRead()` currently calls
  the v2 normalizer, which drops unknown ids; forgetting the migration would erase v3 appearance and
  inventory on every read. → AC-5/AC-36 pin a repository round-trip with v3 ids and a `find` →
  `setSlotAppearance` → `find` fixture; T5 is a hard dependency of T6.
- **R3 — Appearance payload growth.** 11 entries × 24 members adds ≈ 13 KB to a full `welcome`. →
  Pinned fixture and bound (AC-14): 24 guests, `removedIds: []`, full appearance, no
  `customization` → ≤ 17,408 B (measured 16,710 B); ≤ 550 B per member; the full-inventory welcome
  is explicitly out of bound.
- **R4 — Catalog mirror drift.** Two transcriptions of an 11 × 10 × 12 table can diverge. → Pinned
  tables, exact counts, `CATALOG_ROWS_HASH` in both suites, and a review-time byte comparison in
  `build-log-T1.md`.
- **R5 — Bundle growth in the entry chunk.** The catalog is imported by `session.ts`/`cursor-ship.ts`,
  so it lands in the entry closure. → Measured ≈ 14.4 KB gzip: ≈ 114.4 KB initial and ≈ 295.8 KB
  total, ≈ 4 KB under the 300,000 B ceiling (AC-33). T18 records the exact deltas; if it misses, the
  documented fallback is moving shot-style resolution behind the scene chunk — a spec revision, not a
  silent deviation.
- **R6 — Render budget.** The mounted ship is **36 objects / 21 draws at rest** and **39 / 24 at
  peak** (two bolts + one live muzzle), only while spectating, and the manager is lazy so the
  accepted counts return exactly. → AC-22 pins the idle fixtures **182/246/358**, the per-shot
  deltas and the peak **185/249/361**, plus disposal at all three fixtures; the frame traces stay at
  average ≤ 16.7 ms and p95 ≤ 33 ms at 1280×720 and 1920×1080 with a spectated ship firing.
- **R7 — Form-coverage gap.** A generated form missing from the transform tables would silently fall
  back to `standard` (120 identical-looking parts). → A test iterates all 1,351 rows and asserts each
  `shape` resolves to a non-`standard` entry (or the v2 table for classic rows), plus one worked
  value per slot role.
- **R8 — Hangar accessibility regression.** Replacing 3 fixed variant rows with a form strip could
  lose the ARIA/keyboard contract. → AC-28…AC-30 keep the tab pattern, 44 px targets, visible focus,
  a per-strip roving tabindex and the four pinned control-count fixtures.
- **R9 — v2 consumers left behind.** A production module still using `parts-v2` would render v3 parts
  as defaults. → T15 switches the panel, T9 the model/preview, T8 the engine, T5 the repository; a
  verification grep for `parts-v2` imports outside `parts-v2.ts`/its tests must be empty, and
  `cursor-ship.test.ts`/`SpaceshipCustomizationPanel.test.tsx` pin v3 ids.
- **R10 — `shot` surprises the reveal.** A shot part has no mesh. → AC-31 pins the yaw entry, the
  catalog-derived slot and the unchanged timeline; the staged ship ignores the shot entry.
- **R11 — Unfalsifiable payload bound.** A "full boards" 24-member claim is not achievable. → AC-14
  pins the exact fixture and the 17,408 B measured band and states the incoming-only nature of
  `MAX_MESSAGE_BYTES`.
- **R12 — Chassis overwritten by the equip pulse.** `Spaceship.update` writes
  `model.group.scale` every frame through `applyPulse()`. → AC-17 pins `CursorShipModel.applyPulseScale`
  as the only scale writer (chassis × pulse) and T10 owns the one-line `spaceship.ts` call change; a
  rest/peak assertion guards it.
- **R13 — Catalog-hash cross-check had no owner.** T1 and T2 asserted the same literal while marked
  `[P]`. → **T2 now depends on T1** (the parallel marker is removed); T1 records the literal in
  `build-log-T1.md` and T18 compares both logs.

## Open questions

See `spec.md` § Open questions (Q-1 remote-ship visibility, Q-2 catalog size, Q-3 loot pacing,
Q-4 guest cosmetic authority — the user-owned ones; Q-5…Q-8 pinned).

## Assumptions

See `spec.md` § Assumptions. Additional implementation assumptions:

- The v2-table resolution helper lives in `render/cursor-ship.ts` (it owns `CURSOR_SLOT_SHAPE_TRANSFORMS`);
  `game/ship-forms.ts` imports only pure `game/**` modules and is guarded by an import-boundary test.
- `SPACESHIP_SCALE`, `SHOT_TRAVEL_MS`, `SPACESHIP_TRAIL_*` and the quality matrix stay untouched;
  `MOTION` gains only `remoteShipRecoilMs` (120) and `remoteShotFlashMs` (120).
- The `remote-ships` manager group is created on the first mount and removed on the last dispose, so
  a scene with no spectated ship keeps the measured accepted object counts.
- `App.tsx` needs no production change; only its tests assert the new panel contract.
- The panel's v3 switch and the preview's v3 switch land in different tasks (T15/T9) but both derive
  from T2's `appearanceToShipParamsV3`; T15 depends on T9 and T9 depends on T2.

## Revision history

- r1 — 2026-11-18 — initial plan (planning phase).
- r2 — 2026-11-18 — spec review r1 (F1–F19): measured scene baseline, optional wire field, extended
  gate, pinned payload fixture, live re-skin, preview ownership, docs scope.
- r3 — 2026-11-18 — spec review r2 (N1–N7): re-derived the ship arithmetic with the `remote-ship-body`
  and the live muzzle (36 / 21 at rest, peak 39 / 24; idle 182/246/358, peak 185/249/361) in the
  architecture, hierarchy, R6 and the inventory; pinned the chassis × pulse composition and the
  only-scale-writer rule (N2) with R12; corrected the ledger framing (N3); added the T17/T18 evidence
  commands and the features-index status check (N4); pinned the per-member fan-out rule (N5); pinned
  the trailing window boundary (N6); pinned the pure-`game/**` layering and the helper location (N7)
  with R13 and made T2 depend on T1 for the hash cross-check.
