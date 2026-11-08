---
feature: spaceship-cursor-loot-animations
revision: 2
---

# Plan — Pointer ship, granular loot parts, satisfying animations

## Architecture

**State ownership.**

| State | Owner | Lifetime |
| --- | --- | --- |
| Cursor ship transform, bank/trail/pulse, shots, ignitions | Frontend `render/**` | Per client/frame |
| Motion tokens and easing | Frontend `game/motion.ts` (pure) | Build-time constants |
| Part catalog, rarity, weights, legacy mapping | Mirrored pure modules `game/parts.ts` (backend + frontend) | Build-time constants |
| Guest lootboxes/keys/parts/appearance | Frontend engine | Ephemeral session |
| Account lootboxes/keys/parts/appearance | Backend hub + `EconomyRepository` + `user_economy` JSONB | Persistent |
| Lootbox grant/reveal metadata | Server message → frontend engine/session | Per opening; cleared on dismiss |
| Slot appearance application | `Spaceship.applyAppearance` / preview model | Per client; from snapshot |

**Layer rules.** `game/**` stays pure and DOM-free (parts, motion, ship-motion, engine/session
types). `render/**` stays three.js-only (cursor model, spaceship, ship-motion application,
targeting/reticle, impact effects, preview scene, scene integration). `ui/**` owns React/DOM and
CSS (`LevelCompleteBanner`, coin popups, lootbox orb/reveal). The backend `game/parts.ts`,
`game/protocol.ts` and `game/hub.ts` keep the same split as the accepted customization feature:
pure catalog/codec, repository persistence, hub authority.

**Data flow (account).**

1. Cube completion → hub `grantCustomization(+1 lootbox, +1 key)` → `customizationUpdate` to the
   account's joined connections (existing path).
2. Player clicks `Open lootbox` → `session.openLootbox()` sends `{ type: 'openLootbox' }`.
3. Hub takes the per-member in-flight guard, draws one part with
   `selectLootPart(deps.random())`, calls `economyRepo.applyLootboxOpen(accountId, partId)`.
4. Repository atomically decrements `lootboxes`/`keys`, increments `parts[partId]`, returns
   `{ state, duplicate }` or a failure reason.
5. Hub updates every member with that `accountId`, broadcasts `customizationUpdate` to every joined
   connection of the account, and sends `lootboxOpened` to the opening connection only.
6. Client adopts the absolute state, stores `lastLootboxGrant`, renders the reveal, and the panel's
   `Equip` button sends `equipPart`/`unequipPart`.
7. Hub validates catalog/ownership, writes one slot atomically, updates members, broadcasts
   `customizationUpdate`.

**Data flow (guest).**

1. Engine grants lootbox/key on completion (existing path).
2. `session.openLootbox()` calls `engine.openLootbox()` locally; the engine checks counts, draws one
   weighted part with its injected RNG, increments `parts`, decrements counts, sets
   `lastLootboxGrant` (sequence++), publishes a snapshot; no transport message.
3. Guest `equipPart`/`unequipPart` validate the catalog/ownership/defaults locally, mutate
   `appearance`, publish. Nothing persists.

**Scene data flow.** `EngineSnapshot.customization` is unchanged; `SceneView.applySnapshot` compares
the appearance record and calls `spaceship.applyAppearance` on change. The cursor ship is one outer
`spaceship` group (unchanged name/position/scale) containing one `cursor-ship-model` group and one
trail `Points`; shots remain in the separate `spaceship-shots` group. Pointer movement feeds
`SceneView.setHoverTarget` (raycast at most once per frame), which drives the target outline and
reticle. On shot arrival the scene spawns one `ImpactEffects.spawnPop` (rays/debris/coins/ring) and
the existing 24-point spark burst. Impact effects are one extra child group under the existing
particle group, so the scene-child count stays 9 (10 with a remote world); only descendant counts
change — `countObjects(scene)` grows by **5** (one impact group + four drawables), so the accepted
`102` baseline becomes `107` without a remote world. On a level change the scene starts the cursor
fly-by and the App shows the level banner.

## Interfaces / contracts

### Catalog (mirrored in `src/backend/src/game/parts.ts` and `src/frontend/src/game/parts.ts`)

```ts
export type SlotId =
  | 'hull' | 'nose' | 'cockpit'
  | 'wing-left' | 'wing-right'
  | 'engine-left' | 'engine-right'
  | 'ignition-left' | 'ignition-right'
  | 'tail-fin';

export type Rarity = 'standard' | 'rare' | 'epic';

export interface SlotDef { id: SlotId; name: string; }

export interface PartDef {
  id: PartId;
  slot: SlotId;
  name: string;
  rarity: Rarity;
  color: string;   // '#rrggbb'
  accent: string;  // '#rrggbb'
  shape: string;   // slot-specific shape key, see § Cursor model
}

export const PART_CATALOG_VERSION = 2;
export const SLOT_CATALOG: readonly SlotDef[];       // 10 rows, spec order
export const PART_CATALOG: readonly PartDef[];       // 30 rows, spec § Part catalog
export const PART_IDS: readonly PartId[];            // 30 ids
export function isValidSlotId(id: string): id is SlotId;
export function isValidPartId(id: string): id is PartId;
export function partDefinition(id: string): PartDef; // throws `unknown part: <id>`
export function partSlot(id: string): SlotId;        // throws on unknown
export function partsForSlot(slot: SlotId): readonly PartDef[]; // 3, standard→rare→epic
export function defaultPartForSlot(slot: SlotId): PartId;
export function rarityWeight(rarity: Rarity): number; // standard 0, rare 3, epic 1
export function selectLootPart(rng: () => number): PartId; // one draw, 20 lootable parts
```

`selectLootPart` builds the 20-row loot table in catalog order, sums weights (40), rolls
`rng() * total`, walks the table, clamps a draw of `1` to the last row, and never returns a
standard part. It consumes exactly one draw.

### Legacy normalization (pure, both workspaces)

```ts
export function normalizePartMap(parts: Record<string, number>): Record<string, number>;
export function normalizeAppearance(appearance: Record<string, string>): Record<string, string>;
export function normalizeCustomizationState(state: CustomizationState): CustomizationState;
```

Rules:

- `body-default|obsidian|gold` → `hull-default|obsidian|gold`.
- `wings-default` → `wing-left-default` + `wing-right-default` (same count each).
- `wings-silver` → `wing-left-silver` + `wing-right-silver` (same count each).
- `engine-default` → `ignition-left-default` + `ignition-right-default` (same count each).
- `engine-blue` → `ignition-left-blue` + `ignition-right-blue` (same count each).
- `nose-*` / `cockpit-*` are retained.
- Unknown ids are dropped; counts must be positive integers; collisions are summed.
- Appearance keys `body`→`hull`, `wings`→`wing-left`+`wing-right`, `engine`→
  `ignition-left`+`ignition-right`; `nose`/`cockpit` retained. A value whose part slot does not
  match the key is dropped. Unknown keys are dropped.
- The result is a new object (never the caller's).

### Frontend appearance mapping

```ts
export interface PartVisual {
  partId: PartId;
  slot: SlotId;
  color: string;
  accent: string;
  rarity: Rarity;
  shape: string;
}
export function appearanceToCursorShipParams(
  appearance: Record<string, string>,
): Record<SlotId, PartVisual>;
```

Each slot resolves `appearance[slot]` through the catalog; a missing/invalid/mismatched value
falls back to the slot's standard part. The result always has exactly 10 keys.

### Repository

```ts
export interface CustomizationState {
  lootboxes: number;
  keys: number;
  parts: Record<string, number>;
  appearance: Record<string, string>;
}

export interface EconomyRepository {
  // existing methods retained …
  findCustomizationByUserId(userId: string): Promise<CustomizationState>;
  grantCustomization(
    userId: string,
    delta: { lootboxes?: number; keys?: number },
  ): Promise<CustomizationState>;
  applyLootboxOpen(
    userId: string,
    partId: PartId,
  ): Promise<
    | { state: CustomizationState; duplicate: boolean }
    | { reason: 'no_lootbox' }
    | { reason: 'no_key' }
  >;
  setSlotAppearance(
    userId: string,
    slotId: SlotId,
    partId: PartId | null,
  ): Promise<CustomizationState>;
}
```

`setAppearance` from the predecessor is removed or kept as a private helper; the hub uses
`setSlotAppearance` so two tabs equipping different slots cannot clobber each other.

### Protocol

```ts
// Client additions
| { type: 'openLootbox' }
| { type: 'equipPart'; partId: string }
| { type: 'unequipPart'; slotId: string }

// Server addition
| {
    type: 'lootboxOpened';
    partId: string;
    slot: string;
    rarity: 'rare' | 'epic';
    duplicate: boolean;
    lootboxes: number;
    keys: number;
    parts: Record<string, number>;
    appearance: Record<string, string>;
  }

// Error code addition
| 'unknown_slot'
```

Codec rules: `partId`/`slotId` are non-empty strings; `lootboxOpened` requires a non-empty
`partId`/`slot`, a boolean `duplicate`, `rarity === 'rare' || rarity === 'epic'`, non-negative
integer `lootboxes`/`keys`, positive integer `parts` counts and non-empty-string
`appearance` keys/values. `customizationUpdate` keeps its predecessor shape. Both workspaces copy
nested `parts`/`appearance` maps defensively. `lootboxOpened` is sent only to the opening
connection; `customizationUpdate` remains the absolute state sync for all account connections.

### Engine / session

```ts
export interface LootboxGrant {
  partId: string;
  slot: string;
  rarity: 'rare' | 'epic';
  duplicate: boolean;
  sequence: number; // client-side, monotonic per engine instance
}

export interface EngineSnapshot {
  // existing fields …
  lastLootboxGrant?: LootboxGrant;
}

// GameEngine additions (optional on base, required on OnlineGameEngine)
openLootbox?(): LootboxGrant | null;
equipPart?(partId: string): void;
unequipPart?(slotId: string): void;
adoptLootboxGrant?(grant: Omit<LootboxGrant, 'sequence'>): void;
clearLootboxGrant?(): void;
```

`OnlineGameSession` additions: `unequipPart(slotId)`, `dismissLootboxReveal()`. Existing
`openLootbox()`/`equipPart()` keep their names. Account branches send the new messages; guest
branches call the engine and publish. `handleLootboxOpened` adopts the state and grant;
`handleCustomizationUpdate` adopts the state only.

### Motion

`game/motion.ts` is the single home. Observed tokens (from the decoded video) and extrapolated
tokens (`[E]`, absent from the video) are separated in the constant:

```ts
export const MOTION = {
  // observed [O]
  reticleDwellMs: 250, reticleFadeMs: 120,
  coinPopMs: 1100, coinRisePx: 45, coinRiseMs: 220, coinMaxConcurrent: 3,
  shockwaveGrowMs: 330, shockwaveFadeMs: 150, shockwaveVisibleMs: 480,
  shockwaveMaxScale: 5,
  orbOvershootMs: 250, orbOvershootScale: 1.25,
  bannerOvershootMs: 450, bannerOvershootScale: 1.08, bannerPeakMs: 370, bannerHaloMs: 250,
  bannerRotateDeg: 8, bannerWobbleDeg: 2, bannerHoldMs: 1600,
  levelBurstMs: 760, levelBurstAttackMs: 250, levelBurstReleaseMs: 510,
  levelRayGold: 16, levelRayCyan: 8, levelRingCount: 3,
  levelStarCount: 12, levelCoinCount: 12,
  rayCount: 12, rayGrowMs: 80, rayHoldMs: 100, rayFadeMs: 270, rayTotalMs: 450,
  debrisPerPop: 14, debrisPoolCap: 42, debrisLifetimeMs: 900,
  debrisSpeedMin: 1.8, debrisSpeedMax: 3.6, debrisDragPerS: 2, debrisGravity: 6,
  debrisAngularMin: 3, debrisAngularMax: 8,
  coinsPerPop: 6, coinPoolCap: 18, coinLifetimeMs: 1000,
  shipRollMs: 700, shipOrbitRadius: 1.2, fireTrailMs: 700, fireTrailCount: 16,
  plumeFlickerMs: 100,
  // extrapolated [E]
  lootboxChargeMs: 420, lootboxFlashMs: 120, lootboxRevealMs: 360,
  lootboxSettleMs: 140, lootboxTotalMs: 1040,
  equipPulseMs: 260, equipPulseScale: 0.04, equipRowFlashMs: 260,
  upgradePulseMs: 260,
  trailLifetimeMs: 220, trailCount: 8,
  shipBankMaxRad: 0.28, shipBankGain: 2.4,
  shipPitchMaxRad: 0.18, shipPitchGain: 1.6,
  shipIdleAmplitude: 0.015, shipIdlePeriodMs: 2600,
} as const;

export function easeOutCubic(t: number): number;   // 1 - (1-t)^3
export function easeOutBack(t: number, c1?: number): number; // default 1.5; peak 1.08 at t=0.6
export function easeOutQuad(t: number): number;    // 1 - (1-t)^2
export function easeOutQuint(t: number): number;   // 1 - (1-t)^5
export function easeInOutCubic(t: number): number;
export function clamp01(t: number): number;
```

`ship-motion.ts` (pure) owns the cursor math:

```ts
export function shipBankAngle(vx: number): number;   // clamp(-vx * 2.4, -0.28, 0.28)
export function shipPitchAngle(vy: number): number;  // clamp(-vy * 1.6, -0.18, 0.18)
export function idleOffsetAt(elapsedMs: number): number; // 0.015 * sin(2π t / 2600)
export function equipPulseScaleAt(elapsedMs: number): number; // 1 + 0.04*sin(π t/260)
export function trailFadeAt(elapsedMs: number): number; // 1 - t/220
export function shouldSpawnTrail(vx: number, vy: number, reducedMotion: boolean): boolean;
```

### Targeting

```ts
// render/targeting.ts
export interface Targeting {
  readonly group: Group; // one outline LineSegments + one six-tick LineSegments
  setHoverTarget(id: MiniCubeId | null, cubeView: CubeView): void;
  update(dtMs: number, reducedMotion: boolean): void;
  dispose(): void;
}
export function createTargeting(): Targeting;
```

The outline is one `LineSegments` `EdgesGeometry` box at `1.03` tile scale
(`depthTest: false`, `renderOrder: 11`); the reticle is one `LineSegments` with 12 vertices
(six 2×14 px-equivalent ticks at 60°). `setHoverTarget` positions both; `update` fades the reticle
over 120 ms and holds the 250 ms dwell; reduced motion keeps the outline and hides the ticks.

### Impact effects

```ts
// render/impact-effects.ts
export interface ImpactEffects {
  readonly group: Group; // child of the existing particles group
  spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void;
  update(dtMs: number): void;
  activeCounts(): { rays: number; debris: number; coins: number; rings: number };
  dispose(): void;
}
export function createImpactEffects(random: () => number): ImpactEffects;
```

Four pooled drawables: rays (3 instances × 12 tapered triangles), debris (42 small cubes), coins
(18 discs) and rings (3 instances of one prebuilt ring+spokes+satellites geometry). Each pool is
one draw; `spawnPop` fills all four from the same origin/normal. The existing 24-point spark burst
stays in `particles.ts` and is spawned by the scene, not duplicated here. Reduced motion calls no
spawn (the scene uses the 120 ms flash path).

### Level banner

```ts
// ui/LevelCompleteBanner.tsx
export function LevelCompleteBanner({
  visible, reducedMotion, levelNumber,
}: { visible: boolean; reducedMotion: boolean; levelNumber: number }): ReactElement | null;
```

Renders the 16+8 rays, 3 rings, 12 stars and 12 coins plus the `LEVEL COMPLETE` banner. The
component owns only the DOM/CSS overlay; the 3D burst/debris and ship fly-by are scene/spaceship.

## Data model and migration

### Storage

`user_economy` keeps `lootboxes INT`, `keys INT`, `parts JSONB`, `appearance JSONB` and gains
`customization_version INT NOT NULL DEFAULT 2` after migration 006. `parts` is
`partId -> positive integer count`; `appearance` is `slotId -> partId`; standard parts are
implicit and need not be present. The version column is internal (not on the wire).

### Migration 006 (exact steps)

1. `ALTER TABLE user_economy ADD COLUMN IF NOT EXISTS customization_version INT NOT NULL DEFAULT 1;`
2. Backfill appearance:

```sql
UPDATE user_economy
SET appearance = jsonb_strip_nulls(
  (appearance - 'wings' - 'body' - 'engine')
  || jsonb_build_object(
       'hull', appearance->'body',
       'wing-left', appearance->'wings',
       'wing-right', appearance->'wings',
       'ignition-left', appearance->'engine',
       'ignition-right', appearance->'engine'
     )
)
WHERE appearance ?| ARRAY['wings','body','engine'];
```

3. Backfill parts with a CTE that expands legacy keys into v2 keys, keeps v2 keys, sums duplicate
   keys and skips non-numeric values:

```sql
WITH expanded AS (
  SELECT ue.user_id,
         CASE
           WHEN key LIKE 'body-%'   THEN 'hull-' || substr(key, 6)
           WHEN key LIKE 'wings-%'  THEN 'wing-left-' || substr(key, 7)
           WHEN key LIKE 'engine-%' THEN 'ignition-left-' || substr(key, 8)
           ELSE key
         END AS part_id,
         value::int AS count
  FROM user_economy ue, jsonb_each_text(ue.parts) AS e(key, value)
  WHERE value ~ '^[0-9]+$'
  UNION ALL
  SELECT ue.user_id, 'wing-right-' || substr(key, 7), value::int
  FROM user_economy ue, jsonb_each_text(ue.parts) AS e(key, value)
  WHERE key LIKE 'wings-%' AND value ~ '^[0-9]+$'
  UNION ALL
  SELECT ue.user_id, 'ignition-right-' || substr(key, 8), value::int
  FROM user_economy ue, jsonb_each_text(ue.parts) AS e(key, value)
  WHERE key LIKE 'engine-%' AND value ~ '^[0-9]+$'
),
aggregated AS (
  SELECT user_id, jsonb_object_agg(part_id, count) AS parts
  FROM (
    SELECT user_id, part_id, SUM(count) AS count
    FROM expanded
    GROUP BY user_id, part_id
  ) summed
  GROUP BY user_id
)
UPDATE user_economy ue
SET parts = a.parts
FROM aggregated a
WHERE ue.user_id = a.user_id;
```

4. `UPDATE user_economy SET customization_version = 2 WHERE customization_version < 2;`
5. `ALTER TABLE user_economy ALTER COLUMN customization_version SET DEFAULT 2;`
6. Mirror all five steps in `schema.sql` (column `DEFAULT 2`; the data rewrite is migration-only).

The rewrite is safe to re-run: after the first pass no legacy keys remain, the CTE sums the same
values, and the version update is idempotent. `migration-006.test.ts` asserts the file contains
each pinned mapping, the version update/default and the numeric guard; `migrate.test.ts` asserts
006 is loaded and applied once by the fake runner. The repository also normalizes on read, so a
manually restored legacy row still renders even before a write.

## Repository design

### `applyLootboxOpen` (Postgres)

One CTE does the conditional decrement, part increment and duplicate detection atomically:

```sql
WITH eligible AS (
  SELECT user_id, parts
  FROM user_economy
  WHERE user_id = $1 AND lootboxes >= 1 AND keys >= 1
), updated AS (
  UPDATE user_economy ue
  SET lootboxes = ue.lootboxes - 1,
      keys = ue.keys - 1,
      parts = jsonb_set(
        ue.parts,
        ARRAY[$2]::text[],
        to_jsonb(COALESCE((ue.parts->>$2)::int, 0) + 1)
      ),
      updated_at = now()
  FROM eligible e
  WHERE ue.user_id = e.user_id
  RETURNING ue.lootboxes, ue.keys, ue.parts, ue.appearance,
            (e.parts ? $2) AS duplicate
)
SELECT * FROM updated;
```

If no row is returned, the fallback `SELECT lootboxes, keys` reports `no_lootbox` first, then
`no_key` (the accepted order). The in-memory implementation checks the same order and computes
`duplicate = (parts[partId] ?? 0) > 0`. Negative counts are impossible because the update is
conditional.

### `setSlotAppearance`

```sql
UPDATE user_economy
SET appearance = CASE
      WHEN $3::text IS NULL THEN appearance - $2
      ELSE jsonb_set(appearance, ARRAY[$2]::text[], to_jsonb($3::text), true)
    END,
    updated_at = now()
WHERE user_id = $1
RETURNING lootboxes, keys, parts, appearance;
```

No row → insert a zero row carrying the appearance (mirroring the predecessor `setAppearance`).
The in-memory implementation copies the map, sets or deletes one key, and returns a defensive copy.
Equip and unequip are per-slot, so multi-tab writes to different slots do not clobber each other;
two writes to the same slot are last-write-wins.

### `findCustomizationByUserId`

Reads `lootboxes, keys, parts, appearance, customization_version`; missing row → zero state;
`rowToCustomization` parses maps defensively (`parseParts`/`parseAppearance` patterns from the
predecessor) and applies `normalizeCustomizationState` when the version is `< 2`. All results are
fresh objects.

## Hub design

**Open.** `handleOpenLootbox`:

1. Guest/account check; guest messages are a silent no-op (guest opening is client-local).
2. `openingMembers.has(member.playerId)` → return (AC-20); otherwise add and `try/finally` delete.
   The guard is per member (connection), not per account, so independent tabs may open
   concurrently; the atomic repository update still prevents negative counts.
3. `partId = selectLootPart(deps.random())` (exactly one draw).
4. `applyLootboxOpen` → error `no_lootbox`/`no_key`; on success update every member with the
   account id and broadcast `customizationUpdate` to every joined account connection.
5. Send `lootboxOpened` to `connection` only with `partId`, `slot`, `rarity`, `duplicate` and the
   absolute state. The opener also receives the `customizationUpdate`; the client treats both as
   absolute state and only the grant message triggers the reveal.

**Equip.** `handleEquipPart`:

1. Guest → return.
2. `partDefinition(partId)` → `unknown_part` on throw.
3. Resolve `targets`: a slot-specific id targets its own slot; a legacy id targets one or two slots
   (AC-28). Standard parts are always owned; non-standard require `parts[partId] > 0` or
   `not_owned`.
4. Load current state; if every target already has the desired value, return (idempotent no-op).
5. For each target call `setSlotAppearance`; update members; broadcast one `customizationUpdate`.
   For the two-slot legacy case, write both slots before broadcasting.

**Unequip.** `handleUnequipPart`: validate slot (`unknown_slot`), load current state, if the slot
is already absent/default return, call `setSlotAppearance(slot, null)`, update members, broadcast.

**Broadcast.** Reuse `broadcastCustomizationUpdate(userId, state)`; it already filters
`connection.accountSession?.userId === userId` and open sockets. No new cross-player broadcast.

## Cursor model design

### Hierarchy (32 objects: root + 10 slot groups + 21 meshes)

| Slot group | Meshes | Geometry | Material role |
| --- | --- | --- | --- |
| `slot-hull` | `cursor-hull`, `cursor-hull-underside` | flattened `CylinderGeometry` (12), `ExtrudeGeometry` underplate | hull + panel |
| `slot-nose` | `cursor-nose` | `ConeGeometry` (12) | hull/accent |
| `slot-cockpit` | `cursor-cockpit`, `cursor-cockpit-frame`, `cursor-cockpit-highlight` | scaled `SphereGeometry`, `TorusGeometry`, `BoxGeometry` | canopy, frame, highlight |
| `slot-wing-left` | `cursor-wing-left`, `cursor-wing-left-tip` | `ExtrudeGeometry` delta wing, `BoxGeometry` tip | wing + accent |
| `slot-wing-right` | mirror of left | mirror | wing + accent |
| `slot-engine-left` | `cursor-engine-left`, `cursor-engine-left-nozzle` | `CylinderGeometry` (12), `CylinderGeometry` nozzle | housing + nozzle |
| `slot-engine-right` | mirror of left | mirror | housing + nozzle |
| `slot-ignition-left` | `ignition` | `ConeGeometry` (10) | flame |
| `slot-ignition-right` | `ignition` | `ConeGeometry` (10) | flame |
| `slot-tail-fin` | `cursor-tail-fin` | `BoxGeometry`/`ExtrudeGeometry` | trim/accent |

Detail meshes: `cursor-hull-seam-1`, `cursor-hull-seam-2` (thin `CylinderGeometry` rings offset from
the hull), `cursor-vent-left`, `cursor-vent-right` (thin `BoxGeometry`). All detail meshes are
direct children of the root, not slots, and use the shared trim material.

### Materials (19)

- Hull: 2 (hull, underside). Nose: 1. Cockpit: 3 (canopy, frame, highlight). Wings: 4 (two per
  side: wing, tip). Engines: 4 (two per side: housing, nozzle). Ignitions: 2 (one per side, so
  left/right flame colours are independent). Tail fin: 1. Shared hull seams: 1. Shared vents: 1.
  Total: `2 + 1 + 3 + 4 + 4 + 2 + 1 + 1 + 1 = 19`. The seams and vents use distinct shared
  materials (both dark, independently tinted). Good.
- Material finishes by rarity: standard `metalness 0.55, roughness 0.38, clearcoat 0.4`; rare
  `metalness 0.65, roughness 0.30, clearcoat 0.5`; epic `metalness 0.70, roughness 0.22,
  clearcoat 0.7`. Canopy stays glass (`metalness 0.2, roughness 0.08, clearcoat 1`), highlight is
  `MeshBasicMaterial`, ignitions are emissive transparent (`opacity 0.55`).
- No shadows, textures, lights, sprites, points, loaders, URLs or random draws.

### Shape transforms (slot-group scale/rotation)

| Slot | shape | scale (x,y,z) | rotation (rad) |
| --- | --- | --- | --- |
| hull | `standard` / `armored` / `solar` | `[1,1,1]` / `[1.08,1.06,1.02]` / `[0.98,1.04,1.10]` | `[0,0,0]` |
| nose | `standard` / `lance` / `photon` | `[1,1,1]` / `[0.85,0.85,1.35]` / `[1.10,1.10,0.80]` | `[0,0,0]` |
| cockpit | `standard` / `razor` / `oracle` | `[1,1,1]` / `[0.80,0.90,1.15]` / `[1.15,0.95,1.10]` | `[0,0,0]` |
| wing-left / wing-right | `standard` / `razor` / `solar` | `[1,1,1]` / `[0.82,1,1.10]` / `[1.18,1,1.05]` | `[0,0,0]` |
| engine-left / engine-right | `standard` / `boxed` / `nova` | `[1,1,1]` / `[1.10,1.10,0.90]` / `[1.18,1.18,1.05]` | `[0,0,0]` |
| ignition-left / ignition-right | `standard` / `ion` / `plasma` | `[1,1,1]` / `[0.85,0.85,1.35]` / `[1.20,1.20,1.15]` | `[0,0,0]` |
| tail-fin | `standard` / `split` / `comet` | `[1,1,1]` / `[1.20,1.10,1.00]` / `[1.00,0.85,1.25]` | `[0,0,0]` / `[0,0,0.18]` / `[0,-0.12,0]` |

`applyPartToModel(model, slot, part)` sets the slot group's scale/rotation, sets the slot's
materials' `color`/`emissive` from `part.color`/`part.accent`, and leaves every other slot group
untouched. The left and right wing groups are independent, so asymmetry is the normal case.

### Cursor integration

`render/spaceship.ts` keeps the public `Spaceship` handle. `createSpaceship(appearance?)` builds the
outer `spaceship` group at `(0,0,6)`, scale `1.2`, adds `cursor-ship-model` and the trail `Points`.
`applyAppearance` calls `appearanceToCursorShipParams` and `applyPartToModel` per slot, then starts
the equip pulse on a real change. `update` keeps the accepted target/follow math, then applies
bank/pitch from the movement delta, the idle offset on the model group, the trail history and the
ignition flicker. There is **no muzzle/recoil or press scale** (the reference ship does not react
to pops); this is an explicit `[E]` choice. `startFlyBy()` enters a 700 ms level-complete state:
the ship rolls 360° on a 1.2-world-unit orbit (`easeInOutCubic`), extends the trail to 16 points
over 700 ms, then returns to pointer follow. `getPosition()` returns the outer group position, so
the idle bob never changes the shot origin. Shots remain in `shotsGroup`. `dispose` disposes the
model (unique geometries/materials), trail geometry/material, shots and clears the groups.

## Motion system design

### Event sequences

| Event | Sequence (non-reduced) | Reduced motion |
| --- | --- | --- |
| Hover | target outline + six ticks fade in 120 ms; dwell 250 ms; no cube scale | static outline; ticks off |
| Click → shot/pop | shot 180 ms; tile zero-scaled on the same frame (no 160 ms shrink); impact spawns at shot arrival | shot/pop collapse; tile instant; no impact |
| Pop impact | 12 rays (80 grow/100 hold/270 fade) + 14 debris (900 ms) + 6 coins (1000 ms) + ring (330 grow/150 fade); 24-point spark burst retained | 120 ms white flash/ring at final scale; no rays/debris/coins |
| Coin | 1100 ms `+N` (scale 0.7→1 in 80 ms, rise 45 px in 220 ms); numeric HUD same frame; no HUD pulse | static `+N` 600 ms or numeric only |
| Level complete | 760 ms burst (16+8 rays, 3 rings, 12 stars/coins); banner 450 ms settle with 8 % overshoot; ship 700 ms roll + 700 ms fire trail; hold 1600 ms | 150 ms ≤15 % overlay; banner fade 120 ms; no fly-by/trail |
| Lootbox `[E]` | 420 ms charge orb → 250 ms 25 % overshoot → 120 ms flash → 360 ms card reveal (8 % overshoot) → 140 ms settle (1040 ms) | instant result; static orb; no charge/flash/overshoot |
| Equip `[E]` | 260 ms row flash + 260 ms ship pulse (peak 1.04) | Instant material/transform |
| Upgrade `[E]` | 260 ms row pulse; no coin HUD pulse | No pulse |
| Cursor idle/move `[E]` | bank/pitch + 8-point 220 ms trail + 2.6 s bob; 100 ms plume flicker | Snap, no bank/pitch/trail/bob/ignition |

### CSS sequences

`game-view.css` owns all new gameplay styles (the `app.css` guard requires every
`border-radius` there to be `0`, so rounded slot/reveal styles go in `game-view.css`; `app.css`
keeps the existing bottom-left placement and gets only 44 px target sizing where its rules own the
buttons).

- The `main` element declares `--motion-coin-pop-ms: 1100ms`, `--motion-loot-charge-ms: 420ms`,
  `--motion-loot-flash-ms: 120ms`, `--motion-loot-reveal-ms: 360ms`,
  `--motion-loot-settle-ms: 140ms`, `--motion-level-burst-ms: 760ms`,
  `--motion-banner-settle-ms: 450ms`, `--motion-equip-pulse-ms: 260ms`,
  `--motion-upgrade-pulse-ms: 260ms`. They are deliberately **not** added to `:root`: the accepted
  `game-view.css.test.ts` contract pins exactly one `:root` block with exactly the nine reference
  tokens. `game-view.css.test.ts` imports `MOTION` and asserts each `main` literal equals the
  token.
- `@keyframes lootbox-reveal` percentages: `0%–40%` charge (`scale 1 → 1.06 → 1`, no translate/
  rotate), `40%–52%` flash (`opacity 0→1→0`, `scale 1.25`), `52%–88%` reveal
  (`scale 0.86 → 1.08 → 1`, `opacity 0 → 1`, `cubic-bezier(.34,1.56,.64,1)`), `88%–100%` settle
  (`scale 1`). `animation: lootbox-reveal 1040ms cubic-bezier(.2,.9,.2,1) both;`. No shake.
- `@keyframes coin-pop` `translateY(0) → -45px`, `opacity 1 → 0`, `scale .7 → 1` over 1100 ms;
  rise 220 ms.
- `@keyframes level-burst` 760 ms with a 250 ms attack / 510 ms release; `@keyframes level-banner`
  `scale .2 rotate(-8deg)` at 0 → `scale 1` at 250 ms → `scale 1.08` at 370 ms → settle at
  450 ms with ±2° wobble; `@keyframes banner-halo` 250 ms.
- `@keyframes upgrade-purchased` one 260 ms glow/scale pulse.
- The existing `@media (prefers-reduced-motion: reduce)` block disables every new animation and
  transition; the lootbox result stays `opacity: 1; transform: none`, the banner stays at
  `scale 1/0°`, and the level overlay is a 150 ms ≤15 % white flash.

### Frame budget and allocations

- Cursor: 21 meshes/21 draw calls + one trail `Points` draw = at most 22 cursor draws; 19 materials;
  ≤ 2500 triangles.
- Impact: 4 pooled drawables (rays, debris, coins, ring) = 4 draws; worst case 3 ray fans, 42
  debris, 18 coins, 3 rings plus the existing 72 spark points.
- Targeting: 2 `LineSegments` draws (outline + six ticks).
- No per-frame allocation in `update`/`updateShots`/trail/impact/targeting: reuse module-level
  `Vector3`, `Quaternion`, `Matrix4` and arrays; each pool allocates once.
- Frame bar: average ≤ 16.7 ms, p95 ≤ 33 ms at 1280×720 and 1920×1080, three clean runs; watch the
  accepted 1920×1080 idle headroom (16.694 ms vs 16.7 ms). A reproducible miss blocks.
- Bundle: `npm run build` initial JS gzip ≤ 350 KB (accepted `BUNDLE_BUDGET_GZ_KB`). The current
  accepted build is 258.63 KB, leaving ~91 KB; the new catalog/UI/model must fit. A miss blocks;
  no budget change without approval.

## Preview design

`render/preview.ts` exports `createPreviewScene(appearance)` (pure three.js):

- `Scene`, `PerspectiveCamera(35, 1, 0.1, 20)` at `(0, 0.35, 3.2)` looking at `(0, 0, 0)`,
  ambient `0xffffff` intensity `1.1`, directional key at `(2, 3, 2)` intensity `1.4` (no shadows).
- `createCursorShipModel()` rotated `y = 0.45`; `applyAppearance` through the same slot mapping.
- `update(dtMs, reducedMotion)` rotates `model.rotation.y += 0.0004 * max(0, dtMs)` unless
  reduced; returns nothing.
- `dispose` disposes the model and clears the scene.

`ui/SpaceshipPreview.tsx` creates a `WebGLRenderer({ canvas, antialias: true })` in `useEffect`,
sets `setPixelRatio(min(devicePixelRatio, 2))`, sizes from the canvas rect (fallback 320×192),
renders on a 30 fps `requestAnimationFrame` loop, pauses when the document is hidden, and disposes
on unmount. A construction error is caught: the canvas remains the labeled fallback. The canvas
exposes `data-preview-slot-<slotId>` for all ten slots so SSR tests pin the appearance wiring
without WebGL.

## UI design

- `SpaceshipCustomizationPanel` keeps the `aria-label`, `data-mode`, counts and open button; the
  body becomes a 10-slot list. Each slot row shows the slot name, equipped part, three variant
  entries (owned/locked/equipped) and an unequip button. The reveal region is rendered above the
  slots when `lastLootboxGrant` exists; it contains the `LootboxOrb` (wireframe SVG/CSS sphere,
  orange core) and the 1040 ms charge/flash/reveal/settle sequence. The orb's satellite rings are
  part of the ring shockwave, not the idle orb.
- Buttons are native `<button type="button">`; equip has `aria-pressed`; unequip is disabled for
  the default; locked entries are plain text. The panel is scrollable (`max-height: 60vh`) and uses
  `pointer-events: auto` from the existing rounded panel treatment.
- `App` passes `customization`, `lastLootboxGrant`, `mode`, `reducedMotion`, `onOpenLootbox`,
  `onEquip`, `onUnequip`, `onDismissReveal`. It tracks the previous coin total and keeps up to three
  `{ id, amount }` popups for `MOTION.coinPopMs` (1100 ms), passing `coinDeltas`/`reducedMotion` to
  `Hud`; it keeps the existing `hudBlinking` timer (200 ms) for the accepted click blink only.
- `Hud` keeps `HUD_BLINK_MS = 200` and renders up to `MOTION.coinMaxConcurrent` `.coin-pop`
  elements; it does **not** add a new coin pulse/scale/colour flash.
- `UpgradesPanel` tracks its previous levels and applies `data-purchased="true"` to a row for
  `MOTION.upgradePulseMs` (260 ms) after a level increase.
- `LevelCompleteBanner` is rendered by `App` when `levelIndex` increases; it owns the 16+8 ray DOM,
  3 rings, 12 stars, 12 coins and the banner/halo, and is hidden after `bannerHoldMs` (1600 ms).
- `GameSession` detects a level-index change in its frame loop and calls
  `view.startLevelComplete()` (scene → cursor fly-by + impact burst); the banner is App state.
- No new icons or dependencies; rarity is text/colour, and the existing panel tokens are reused.

## File inventory

| Path | New/Edit | Purpose | Task |
| --- | --- | --- | --- |
| `src/backend/src/game/parts.ts` | Edit | v2 slots/catalog/weights/normalizer | T1 |
| `src/backend/src/game/parts.test.ts` | Edit | Catalog/odds/normalizer tests | T1 |
| `src/backend/src/db/migrations/006_granular_spaceship_parts.sql` | New | Version + backfill | T2 |
| `src/backend/src/db/schema.sql` | Edit | Mirror version column/default | T2 |
| `src/backend/src/db/migrate.test.ts` | Edit | Load/apply 006 | T2 |
| `src/backend/src/db/migration-006.test.ts` | New | SQL mapping/version guards | T2 |
| `src/backend/src/game/protocol.ts` | Edit | Messages/error/codec | T3 |
| `src/backend/src/game/protocol.test.ts` | Edit | Protocol matrix | T3 |
| `src/backend/src/auth/economy-repository.ts` | Edit | Normalize/apply/setSlot | T4 |
| `src/backend/src/auth/economy-repository.test.ts` | Edit | Repo tests | T4 |
| `src/backend/src/game/hub.ts` | Edit | Open/equip/unequip/broadcast | T5 |
| `src/backend/src/game/hub.test.ts` | Edit | Hub tests | T5 |
| `src/backend/src/app.test.ts` | Edit | Real-app integration | T6 |
| `src/frontend/src/game/parts.ts` | Edit | Mirror catalog/odds/normalizer | T7 |
| `src/frontend/src/game/parts.test.ts` | Edit | Mirror tests | T7 |
| `src/frontend/src/game/motion.ts` | New | Tokens/easings | T8 |
| `src/frontend/src/game/motion.test.ts` | New | Motion unit tests | T8 |
| `src/frontend/src/render/ship-motion.ts` | New | Bank/pitch/idle/trail/pulse math | T9 |
| `src/frontend/src/render/ship-motion.test.ts` | New | Ship math tests | T9 |
| `src/frontend/src/render/cursor-ship.ts` | New | 21-mesh slot model | T10 |
| `src/frontend/src/render/cursor-ship.test.ts` | New | Model contract tests | T10 |
| `src/frontend/src/render/spaceship.ts` | Edit | Model integration/appearance/motion | T11 |
| `src/frontend/src/render/spaceship.test.ts` | Edit | Cursor tests | T11 |
| `src/frontend/src/game/effects.ts` | Edit | Instant conceal; remove pop timeline | T12 |
| `src/frontend/src/game/effects.test.ts` | Edit | `MINI_CUBE_POP_MS = 0` tests | T12 |
| `src/frontend/src/render/cube-view.ts` | Edit | Same-frame zero scale, no pop records | T12 |
| `src/frontend/src/render/cube-view.test.ts` | Edit | Instant-conceal tests | T12 |
| `src/frontend/src/render/world.test.ts` | Edit | Remote instant-conceal tests | T12 |
| `src/frontend/src/render/impact-effects.ts` | New | Rays/debris/coins/ring pools | T12 |
| `src/frontend/src/render/impact-effects.test.ts` | New | Impact pool tests | T12 |
| `src/frontend/src/render/targeting.ts` | New | Target outline + reticle | T13 |
| `src/frontend/src/render/targeting.test.ts` | New | Targeting tests | T13 |
| `src/frontend/src/render/scene.ts` | Edit | Appearance + targeting + impact + level trigger | T13 |
| `src/frontend/src/render/scene.test.ts` | Edit | Counts/no-shake/dispose | T13 |
| `src/frontend/src/render/scene-spaceship.test.ts` | Edit | Cursor/targeting/impact scene tests | T13 |
| `src/frontend/src/game/types.ts` | Edit | `LootboxGrant` | T14 |
| `src/frontend/src/game/engine.ts` | Edit | Guest open/equip/unequip/grant | T14 |
| `src/frontend/src/game/engine.test.ts` | Edit | Engine tests | T14 |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirror protocol | T15 |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Parity tests | T15 |
| `src/frontend/src/game/session.ts` | Edit | Commands/reveal handlers | T16 |
| `src/frontend/src/game/session.test.ts` | Edit | Session tests | T16 |
| `src/frontend/src/render/preview.ts` | New | Preview scene | T17 |
| `src/frontend/src/render/preview.test.ts` | New | Preview tests | T17 |
| `src/frontend/src/ui/SpaceshipPreview.tsx` | Edit | Real preview renderer | T17 |
| `src/frontend/src/ui/SpaceshipPreview.test.tsx` | Edit | Preview markup/attrs | T17 |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx` | Edit | Slot UI/reveal | T18 |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx` | Edit | Slot UI tests | T18 |
| `src/frontend/src/ui/app.css` | Edit | Panel target sizing/placement | T19 |
| `src/frontend/src/ui/app.css.test.ts` | Edit | CSS guards | T19 |
| `src/frontend/src/ui/game-view.css` | Edit | Slot/reveal/motion styles | T19 |
| `src/frontend/src/ui/game-view.css.test.ts` | Edit | Motion/44px guards | T19 |
| `src/frontend/src/ui/Hud.tsx` | Edit | Coin pop | T20 |
| `src/frontend/src/ui/Hud.test.tsx` | Edit | Coin pop tests | T20 |
| `src/frontend/src/ui/UpgradesPanel.tsx` | Edit | Purchase pulse | T20 |
| `src/frontend/src/ui/UpgradesPanel.test.tsx` | Edit | Pulse tests | T20 |
| `src/frontend/src/ui/LevelCompleteBanner.tsx` | New | 760 ms burst/banner/halo DOM | T20 |
| `src/frontend/src/ui/LevelCompleteBanner.test.tsx` | New | Banner/ray/ring/reduced tests | T20 |
| `src/frontend/src/App.tsx` | Edit | Panel/reveal/coin wiring | T21 |
| `src/frontend/src/App.test.tsx` | Edit | App tests | T21 |
| `README.md` | Edit | Feature/procedural sentence | T22 |
| `docs/product/glossary.md` | Edit | Slot/reveal/motion terms | T22 |
| `docs/features/README.md` | Not edited | Orchestrator-owned; row proposed | T22/T23 |
| `docs/features/spaceship-cursor-loot-animations/build-log-T*.md` | New | Evidence | each |
| `docs/features/spaceship-cursor-loot-animations/evidence/*` | New | Screens/traces | T23 |

Container files (`compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`,
`src/frontend/Dockerfile`, `src/backend/src/server.ts`) are **not** in any task's `files_owned`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | 10 slots, 30 parts (3 per slot) | Covers the user's one-wing/cabin/ignition examples with independent left/right; small enough to build/test | 5 category slots (not granular); 12 slots with decals (scope) |
| 2 | Keep JSONB `parts`/`appearance` + version column | Mirrors accepted upgrades/economy pattern; no new tables/joins; migration is a data rewrite | Normalized part/loadout tables (more robust, more work) |
| 3 | One part per opening, weighted rare/epic | The user's ask; simple, testable odds | Bundles per opening; equal odds; pity |
| 4 | Standard parts implicit, not lootable | No need to seed inventories; defaults always render | Seed every account with 10 standard rows |
| 5 | Left/right independent | The user explicitly wants one wing, not both; asymmetry is expressive | Mirrored pair |
| 6 | `lootboxOpened` separate from `customizationUpdate` | The reveal needs the granted part/duplicate; other tabs only need absolute state | Diffing counts client-side (fragile); adding optional grant to the update (ambiguous) |
| 7 | Opener-only grant, account-wide state | Avoids replaying reveals on every tab while keeping inventory synced | Broadcast grant to all tabs (duplicate reveals) |
| 8 | Per-slot atomic `setSlotAppearance` | Prevents multi-tab lost updates across different slots | Whole-map `setAppearance` (last writer wins) |
| 9 | Legacy ids accepted on equip and normalized on read | Protects an unmigrated/restored row and old clients; no legacy grants | Hard cutover (breaks old clients/data) |
| 10 | One procedural 21-mesh cursor model | Realistic enough without an asset pipeline; budgetable/testable | Reuse hero model (too heavy); GLTF (Q-14) |
| 11 | Slot variants via colour/accent + slot-group transform | Visually distinct with one geometry set; no combinatorial mesh matrix | One geometry per variant (large model) |
| 12 | Real 30 fps preview with a blank fallback | Meets the "preview" expectation; one context while open | Keep the predecessor placeholder (does not preview) |
| 13 | Motion tokens in `game/motion.ts`, CSS mirrors via test | One source for durations/easings; CSS cannot import TS | Duplicate literals; CSS custom properties only |
| 14 | Impact effects as a separate pooled module under the particle group | Keeps the scene-child count; four one-draw pools (rays/debris/coins/ring) are testable in isolation | Embedding everything in `particles.ts` (one large module) |
| 15 | Instant one-frame conceal replaces the 160 ms pop | The reference conceals in one frame; the shatter is carried by rays/debris/coins | Keep 160 ms shrink (observed mismatch) |
| 16 | Observed `[O]` and extrapolated `[E]` beats are labelled separately | The video has no lootbox/equip/upgrade/cursor ship; do not claim unobserved fidelity | Pretend all beats are observed |
| 17 | No screen shake anywhere | The reference keeps camera/HUD fixed; the impact comes from rays/rings | Add camera shake for "juice" |

## Risks & mitigations

- **Reference fidelity interpretation.** The video has no lootbox/equip/upgrade/cursor ship, so
  those beats are extrapolations. Mitigation: every `[E]` row is labelled in the spec/video
  analysis and mapped to its nearest observed envelope; AC-46 records the provenance.
- **1920×1080 idle headroom.** The accepted build measured 16.694 ms against a 16.7 ms bar; the
  cursor adds 21 draw calls, impact adds 4, targeting adds 2. Mitigation: low-poly geometry, 19
  materials, no shadows, no post-processing additions, pooled effects, no per-frame allocation;
  measure first; a miss blocks (Q-13), no AC relaxation.
- **Instant-conceal test churn.** Changing `MINI_CUBE_POP_MS` to 0 touches cube-view, world,
  scene and predecessor pop tests. Mitigation: T12 owns the effects/cube-view/world tests; T13
  updates scene tests; the spec supersession ledger lists the exact replacement; no behavior
  outside the pop visual changes.
- **Migration data corruption.** JSONB rewrites can fail on malformed values or collide. Mitigation:
  numeric regex guard, `SUM` aggregation, transaction/rollback, version column, repository
  normalization on read, a DB backup before deploy (Q-12), and migration/source tests.
- **Protocol parity drift.** Backend/frontend mirrors must agree. Mitigation: same fixture matrix in
  both protocol tests, a shared pinned table in the spec, and a reviewer parity check.
- **Guest/server divergence.** Guest local RNG/selection must match server odds. Mitigation: the
  same `selectLootPart` algorithm mirrored and tested with identical fixtures; engine tests pin
  boundaries.
- **Multi-tab races.** Whole-map appearance writes could clobber. Mitigation: per-slot atomic
  `setSlotAppearance`; last-write-wins only within one slot.
- **Preview WebGL context/resource leak.** Mitigation: one context per open panel, 30 fps cap,
  hidden-tab pause, `dispose()` on unmount, blank fallback on construction error.
- **UI overload on mobile.** 10 slots × 3 variants is tall. Mitigation: scrollable panel
  (`max-height: 60vh` at 1280; `45vh` mobile), compact rows, 44 px targets, no horizontal
  overflow; manual 320×568/375×667 checks.
- **Bundle growth.** The accepted 258.63 KB gzip leaves ~91 KB. Mitigation: no new dependency; the
  catalog is data, the model is procedural code; measure at T23; a miss blocks.
- **CSS guard conflict.** `app.css.test.ts` requires every `border-radius: 0` in `app.css`.
  Mitigation: all new rounded slot/reveal styles go in `game-view.css`; `app.css` only gets the
  existing placement/44 px sizing.
- **Test churn.** The cursor model supersedes primitive-shape assertions. Mitigation: the
  supersession ledger in the spec; retained behavior ACs keep the old values; reviewers verify no
  assertion weakening beyond the pinned model swap.
- **Rollback while v2 data exists.** Old code ignores new slot keys and could write legacy ids.
  Mitigation: rollback with a pre-migration DB backup; pause lootbox opening during rollback; the
  old code's default appearance fallback keeps the ship renderable (Q-12).

## Rollback

1. Record `BASE=$(git merge-base main HEAD)` and take a `pg_dump` before deploying migration 006.
2. On rollback, redeploy the previous backend/frontend images (or revert the merge commit).
3. Restore the pre-006 dump if the v2 JSONB must be discarded. Without a restore, the old code
   reads `parts`/`appearance` with unknown v2 keys: it falls back to the default appearance and
   ignores unknown inventory ids; it does not crash.
4. Do not open lootboxes on the rolled-back backend until the restore/migration decision is made:
   the old code would grant legacy ids into a v2 inventory.
5. The frontend is stateless for accounts; a reload adopts whatever the backend returns. The cursor
   model/motion code is local presentation and can be rolled back independently of the data.

## Verification

- **Per-task pre-gates:** `npm run lint`, `npm run typecheck --workspace <ws>`,
  `npm test --workspace <ws> -- <pattern>`, `npm run coverage --workspace <ws>`.
- **Final gate (T23):** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`,
  `npm run build`, `npm run smoke`.
- **Diff gates:** `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`,
  `src/frontend/Dockerfile`, `src/backend/src/server.ts`, root/workspace `package.json` and
  `package-lock.json` unchanged; only migration 006 is a new backend DB artifact.
- **Manual visual matrix:** 1280×720, 1920×1080 (and 320×568/375×667 for the panel) with the local
  environment; cursor length/detail, target outline/reticle, instant conceal, 12 rays/14 shards/
  6 coins, ring 330 ms, coin popup 1100 ms, level burst/banner 8 % overshoot, ship roll/fire trail,
  no screen shake, slot equip/unequip, reveal orb, no z-fighting, no panel/cube obstruction
  regression.
- **Reduced motion A/B:** every new animation disabled; target ticks off; no rays/debris/coins;
  ring static flash; coin static/numeric; level overlay ≤15 %/150 ms; banner fade 120 ms; cursor
  bank/pitch/trail/pulse/ignition zero; lootbox instant; equip/upgrade instant.
- **Frame traces:** idle and 10 clicks/s at 1280×720 and 1920×1080, three clean runs; average
  ≤ 16.7 ms, p95 ≤ 33 ms.
- **Bundle:** initial JS gzip ≤ 350 KB, exact size recorded.
- **Reference gate:** `video-analysis.md` contains the inspected frame table/audio onsets and
  `reference/` contains the frames/contact sheets; the final build log maps every `[O]` beat to a
  shipped token and every `[E]` beat to its nearest observed envelope (AC-46).
- **Coverage:** both workspaces ≥ 80% statements/branches/functions/lines; no exclusions.
- **Documentation:** README phrase, glossary terms, proposed feature-index row in the final build
  log; `docs/features/README.md` not edited.

## Open questions

See `spec.md` § Open questions (Q-1…Q-14). Q-1 is **resolved** (video decoded 2026-11-08); Q-2 is
now only a build/performance split option; Q-3/Q-4 pin odds/duplicates; Q-5 pins left/right
independence; Q-6/Q-7 pin local-only/guest behavior; Q-10 keeps audio out of scope; Q-12 pins
rollback.

## Revision history

- r1 — 2026-11-08 — initial plan (A cursor model, B 10-slot/30-part catalog + migration/hub/UI,
  C planner-default motion, blocked video).
- r2 — 2026-11-08 — reference-video analysis integrated: observed target lock, instant conceal,
  rays/debris/coins, 330 ms ring, 1100 ms coin popup, 760 ms level burst + 8 % banner overshoot +
  700 ms ship fly-by, no shake and audio alignment; `[E]` lootbox/equip/upgrade/cursor motions
  defined from the nearest observed envelope. Q-1 resolved; T12/T13/T19/T20/T23 expanded; AC-46
  is now satisfiable.

## Assumptions

See `spec.md` § Assumptions. The plan additionally assumes the accepted 350 KB budget and frame
bar remain binding, the existing `three` version supplies every geometry/material, the decoded
frames are the motion source of truth for `[O]` beats, and manual screenshots/traces are the
project's accepted evidence tier.
