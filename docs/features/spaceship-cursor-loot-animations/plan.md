---
feature: spaceship-cursor-loot-animations
revision: 4
---

# Plan — Pointer ship, granular loot parts, satisfying animations

## Architecture

**State ownership.**

| State | Owner | Lifetime |
| --- | --- | --- |
| Cursor model/transform, bank/trail/pulse, shots, ignitions, fly-by | Frontend `render/**` | Per client/frame |
| Motion tokens/easing/ship math | Frontend `game/motion.ts`, `render/ship-motion.ts` (pure) | Build-time constants |
| Part catalog, odds, legacy normalizer | Mirrored `game/parts-v2.ts` (backend + frontend) | Build-time constants |
| Guest lootboxes/keys/parts/appearance | Frontend engine | Ephemeral session |
| Account lootboxes/keys/parts/appearance | Backend hub + `EconomyRepository` + `user_economy` JSONB | Persistent |
| Lootbox grant/reveal metadata | Server `lootboxOpened` → frontend engine/session | Per opening; cleared on dismiss |
| Pending open | Frontend session/multiplayer snapshot | While an account open is in flight |
| Slot appearance | `Spaceship.applyAppearance` / preview | Per client; from snapshot |

**Layer rules.** `game/**` is pure and DOM-free. `render/**` is three.js-only. `ui/**` owns React/DOM/CSS. Backend `game/parts-v2.ts`, `game/protocol.ts`, `game/hub.ts` keep catalog/codec, repository persistence and hub authority separate. No new dependency, asset, font, audio or external loader.

**Additive compatibility (F1/F5).** The legacy `parts.ts` modules and their exports
(`PART_CATALOG`, `PartId`, `PartCategory`, `partCategory`, `randomPartId`,
`appearanceToSpaceshipParams`, `SpaceshipVisualParams`) stay untouched. The v2 catalog lives in
`parts-v2.ts` (`PART_CATALOG_V2`, `PartIdV2`, `SlotId`, `selectLootPart`,
`appearanceToCursorShipParams`, normalizers). Consumers migrate in the task that owns them:
backend hub T5; frontend engine/session T10; spaceship/scene T9; preview T11; panel/App T12.
Every task's full-workspace test+coverage gate is green because no old test is left waiting for a
later task. At T14, production imports of the legacy helpers are grepped to confirm none remain
outside tests/legacy compatibility.

**Data flow (account).** Cube completion grants lootbox+key (existing). UI `openLootbox` →
session sends; hub takes the per-member in-flight guard, draws with the **captured hub RNG**
`selectLootPart(random)`, calls `applyLootboxOpenV2`, updates members, broadcasts
`customizationUpdate` to the account, sends `lootboxOpened` to the opener only. Client adopts the
state, sets `lastLootboxGrant` and `pendingOpen=false`; reveal renders. Equip/unequip sends the
v2 message; hub validates catalog/ownership/legacy target set, calls `setSlotAppearance`, updates
members and broadcasts.

**Data flow (guest).** Engine grants lootbox/key; `openLootbox` checks counts, draws one weighted
v2 part with the injected RNG, increments `parts`, decrements counts, sets the grant sequence and
publishes; no transport. Guest equip/unequip validates catalog/ownership/defaults locally and
publishes. Nothing persists.

**Scene data flow.** `SceneView.applySnapshot` re-applies `Spaceship.applyAppearance` on change.
Pointer move feeds `setHoverTarget` (T10's `picking.ts` hover path; one raycast per frame; T9's
`targeting.ts` renders the outline/reticle). At shot arrival the scene spawns the existing
24-point burst plus one `ImpactEffects.spawnPop` (rays/debris/coins/ring). On a level change the
scene starts the cursor fly-by; App shows the banner. Impact and targeting groups are children of
the existing particle group, so `scene.children` stays 9 (10 with remote world) while
`countObjects(scene)` grows from **102 to 136**: old cursor 8 → new cursor 34 (+26: outer group +
model root + 10 slot groups + 21 meshes + trail), impact +5 (group + four drawables), targeting +3
(group + two `LineSegments`). This supersedes detailed-hero AC-13/AC-14's 102.

## Interfaces / contracts

### Catalog v2 (`src/{backend,frontend}/src/game/parts-v2.ts`)

```ts
export type SlotId = 'hull' | 'nose' | 'cockpit' | 'wing-left' | 'wing-right'
  | 'engine-left' | 'engine-right' | 'ignition-left' | 'ignition-right' | 'tail-fin';
export type Rarity = 'standard' | 'rare' | 'epic';
export interface PartDefV2 { id: PartIdV2; slot: SlotId; name: string; rarity: Rarity;
  color: string; accent: string; shape: string; }
export const PART_CATALOG_VERSION = 2;
export const SLOT_CATALOG: readonly SlotDef[];
export const PART_CATALOG_V2: readonly PartDefV2[]; // 30 rows, spec table
export function isValidSlotId(id: string): id is SlotId;
export function isValidPartId(id: string): id is PartIdV2;
export function partSlot(id: string): SlotId; // throws `unknown part: <id>`
export function partsForSlot(slot: SlotId): readonly PartDefV2[];
export function defaultPartForSlot(slot: SlotId): PartIdV2;
export function rarityWeight(rarity: Rarity): number; // 0/3/1
export function selectLootPart(rng: () => number): PartIdV2; // one draw, 20 lootable
export function normalizePartMap(parts: Record<string, number>): Record<string, number>;
export function normalizeAppearance(appearance: Record<string, string>): Record<string, string>;
export function normalizeCustomizationState(state: CustomizationState): CustomizationState;
```

The legacy `parts.ts` stays as-is until T14's grep. The v2 table is the spec's 30-row table; exact
tests live in `parts-v2.test.ts` in both workspaces.

### Frontend params

```ts
export interface PartVisual { partId: PartIdV2; slot: SlotId; color: string; accent: string;
  rarity: Rarity; shape: string; }
export function appearanceToCursorShipParams(
  appearance: Record<string, string>,
): Record<SlotId, PartVisual>;
```

Missing/invalid/mismatched values fall back to the slot's standard part; always 10 keys.

### Repository

```ts
findCustomizationByUserId(userId): Promise<CustomizationState>; // normalize legacy keys/ids always
grantCustomization(userId, delta): Promise<CustomizationState>;
applyLootboxOpenV2(userId, partId: PartIdV2): Promise<
  | { state: CustomizationState; duplicate: boolean }
  | { reason: 'no_lootbox' } | { reason: 'no_key' }
>;
setSlotAppearance(userId, slot: SlotId, partId: PartIdV2 | null): Promise<CustomizationState>;
```

The old `applyLootboxOpen`/`setAppearance` remain until T5 migrates the hub; old tests stay green.

### Protocol

Client additions: `openLootbox`, `equipPart { partId }`, `unequipPart { slotId }`.
Server addition: `lootboxOpened { partId, slot, rarity, duplicate, lootboxes, keys, parts,
appearance }`; error `unknown_slot`; `customizationUpdate` unchanged. Codec rules per spec AC-24;
opener-only grant, account-wide state.

### Engine / session

```ts
export interface LootboxGrant { partId: string; slot: string; rarity: 'rare'|'epic';
  duplicate: boolean; sequence: number; }
EngineSnapshot.lastLootboxGrant?: LootboxGrant;
GameEngine: openLootbox?(): LootboxGrant | null; equipPart?(partId): void;
unequipPart?(slotId): void; adoptLootboxGrant?(grant): void; clearLootboxGrant?(): void;
```

`OnlineGameSession` adds `unequipPart(slotId)`, `dismissLootboxReveal()`, and
`pendingLootboxOpen` in the multiplayer snapshot. Pending is set on account send; cleared on
`lootboxOpened`, `customizationUpdate`, `error`, transport status change or `welcome`; guest opens
are synchronous and never pending.

### Motion

```ts
export const MOTION = {
  // observed [O]
  reticleDwellMs: 250, coinPopMs: 1100, coinRisePx: 45, coinRiseMs: 220,
  coinMaxConcurrent: 3, shockwaveGrowMs: 330, shockwaveFadeMs: 150,
  shockwaveVisibleMs: 480, shockwaveMaxScale: 5, orbOvershootMs: 250,
  orbOvershootScale: 1.25, bannerOvershootMs: 450, bannerOvershootScale: 1.08,
  bannerPeakMs: 250, bannerHaloMs: 250, bannerRotateDeg: 8, bannerWobbleDeg: 2,
  bannerHoldMs: 1600, levelBurstMs: 760, levelBurstAttackMs: 250,
  levelBurstReleaseMs: 510, levelRayGold: 16, levelRayCyan: 8, levelRingCount: 3,
  levelStarCount: 12, levelCoinCount: 20, rayCount: 12, rayGrowMs: 80,
  rayHoldMs: 100, rayFadeMs: 270, rayTotalMs: 450, debrisPerPop: 14,
  debrisPoolCap: 42, debrisLifetimeMs: 1200, debrisSpeedMin: 1.8,
  debrisSpeedMax: 3.6, debrisDragPerS: 2, debrisGravity: 6,
  debrisAngularMin: 3, debrisAngularMax: 8, coinsPerPop: 6, coinPoolCap: 18,
  coinLifetimeMs: 1000, shipRollMs: 700, shipOrbitRadius: 1.2,
  fireTrailMs: 700, fireTrailCount: 16, plumeFlickerMs: 100,
  // implementation choices [E]
  reticleFadeMs: 120, lootboxChargeMs: 420, lootboxFlashMs: 120,
  lootboxRevealMs: 360, lootboxSettleMs: 140, lootboxTotalMs: 1290,
  equipPulseMs: 260, equipPulseScale: 0.04, equipRowFlashMs: 260,
  upgradePulseMs: 260, trailLifetimeMs: 220, trailCount: 8,
  shipBankMaxRad: 0.28, shipBankGain: 2.4, shipPitchMaxRad: 0.18,
  shipPitchGain: 1.6, shipIdleAmplitude: 0.015, shipIdlePeriodMs: 2600,
} as const;
```

`motion.ts` is the only `easeOutCubic` implementation; `effects.ts` re-exports it (T9). CSS maps
exactly the 13 tokens in spec AC-34 on `main`; all others are JS-only.

### Adaptive quality

`render/quality.ts` is pure (no DOM/random/timers). `createQualityPolicy()` starts at `high`;
`pushFrameTime(dtMs)` appends a clamped frame time (`0 < dt <= 250`; non-finite/≤0 ignored) to a
120-frame ring, and after `QUALITY_MIN_SAMPLES = 60` evaluates `avg` (arithmetic mean) and `p95`
(nearest-rank on the sorted live window, `ceil(0.95*n)-1`):
- high→medium when `avg > 18.0` **or** `p95 > 24.0`, sustained 60 frames, after 1000 ms downgrade
  cooldown;
- medium→low when `avg > 20.0` **or** `p95 > 28.0`, sustained 60 frames, after 1000 ms cooldown;
- medium→high when `avg <= 16.0` **and** `p95 <= 20.0` for 180 frames, after 3000 ms upgrade
  cooldown;
- low→medium when `avg <= 17.0` **and** `p95 <= 22.0` for 240 frames, after 3000 ms cooldown.
One tier change per decision. `qualityFeatures(tier, reducedMotion)` returns the exact matrix in
spec AC-52: high full; medium hides `cursor-hull-seam-1/2` + `cursor-vent-left/right` (17
meshes), no trail/reticle, rays 6/shards 7/coins 3/sparks 12; low additionally hides
`cursor-wing-left-tip`/`cursor-wing-right-tip` (15 meshes), no trail/bank/idle/pulse, no
reticle, rays/shards/coins/sparks 0, ring + coin popup + banner core. Reduced motion forces
`trail=false`, `reticle=false`, `cursorMotion=false`,
`impactRays=0`, `impactDebris=0`, `impactCoins=0`, `sparks=0`, `shockwaveExpand=false`,
`bannerMotion=false` regardless of tier; the policy may still downgrade static detail.

Wiring: `SceneView` owns the policy and calls `pushFrameTime(dtMs)` once per frame; it exposes
`getQualityTier()` for tests and applies `qualityFeatures` to `spaceship` (trail/detail visibility/
bank/pitch/idle/pulse), `targeting` (reticle), `impactEffects` (rays/shards/coins/ring) and
`particles` (spark count 24/12/0). The banner remains core at every tier. No user-facing setting.

### Picking / targeting / impact / banner

```ts
// render/picking.ts (T10)
export function pickHoverTarget(camera, cubeView, frontFaceId, ndcX, ndcY): MiniCubeId | null;
// preallocated NDC/result; at most one raycast per animation frame.

// render/targeting.ts (T9)
export function createTargeting(): { group; setHoverTarget(id, cubeView); update(dtMs, reduced); dispose(); };

// render/impact-effects.ts (T9)
export function createImpactEffects(random): { group; spawnPop(origin, normal, nowMs);
  update(dtMs); activeCounts(); dispose(); };

// ui/LevelCompleteBanner.tsx (T12)
export function LevelCompleteBanner({ visible, reducedMotion, levelNumber }): ReactElement | null;
```

## Data model and migration 006

`user_economy` keeps `lootboxes`, `keys`, `parts JSONB`, `appearance JSONB`; adds
`customization_version INT NOT NULL DEFAULT 2` after migration. `parts` is `v2PartId → count`;
`appearance` is `slotId → v2PartId`; standard parts are implicit.

**Migration 006 exact steps:**

1. `ADD COLUMN IF NOT EXISTS customization_version INT NOT NULL DEFAULT 1`.
2. Rewrite appearance **keys and values** in one `jsonb_strip_nulls` expression:
   - `body`=`body-*` → `hull`=`hull-*` (`replace(value,'body-','hull-')`);
   - `wings`=`wings-*` → `wing-left`=`replace(value,'wings-','wing-left-')` **and**
     `wing-right`=`replace(value,'wings-','wing-right-')`;
   - `engine`=`engine-*` → `ignition-left`=`replace(value,'engine-','ignition-left-')` and
     `ignition-right`=`replace(value,'engine-','ignition-right-')`;
   - `nose`/`cockpit` retained; drop missing keys.
3. Rewrite `parts` with a CTE expanding legacy keys to one/two v2 keys, summing collisions.
   Numeric guard: `value::numeric BETWEEN 0 AND 2147483647`; skip non-numeric/overflow.
4. `UPDATE user_economy SET customization_version = 2 WHERE customization_version < 2;`
5. `ALTER COLUMN customization_version SET DEFAULT 2;` mirror `schema.sql`.

The AC-33 fixture: `parts={"wings-silver":2,"engine-blue":1,"body-gold":1}`,
`appearance={"wings":"wings-silver","engine":"engine-blue","body":"body-gold"}` →
`appearance={"wing-left":"wing-left-silver","wing-right":"wing-right-silver",
"ignition-left":"ignition-left-blue","ignition-right":"ignition-right-blue","hull":"hull-gold"}`,
version 2. The rewrite is idempotent; T2 records a pre-006 `pg_dump`/restore command.

**Read normalization.** `rowToCustomization` applies `normalizeCustomizationState` whenever legacy
keys/ids are present **or** `customization_version < 2`; a restored v2 row with legacy ids is
therefore renderable/equippable (F15). All results are defensive copies.

## Repository / hub

**`applyLootboxOpenV2`** (Postgres) is one CTE: conditional `lootboxes>=1 AND keys>=1`, decrement
both, `jsonb_set(parts, ARRAY[$part], COALESCE(...)+1)`, return
`(e.parts ? $part) AS duplicate`; fallback reports `no_lootbox` first then `no_key`. In-memory
mirrors the order. **`setSlotAppearance`** is `jsonb_set`/`-` on one key with a zero-row upsert.

**Hub.** `handleOpenLootbox`: guest no-op; per-member `openingMembers` guard; **captured `random`**
for `selectLootPart` (not a fresh `deps.random()`); update members; `customizationUpdate` all
account connections; `lootboxOpened` opener only. **Equip:** v2 part requires owned count; standard
always owned. Legacy ids: `body-*`→one hull slot requiring hull owned; `wings-*`→two wing slots
requiring **both** v2 wing parts (partial → `not_owned`); `engine-*`→two ignition slots requiring
both. Equip/unequip is per-slot atomic; re-equip same value is a no-op.

## Cursor model

Factory `createCursorShipModel()` returns `cursor-ship-model` with 10 slot groups and 21 meshes:
hull 2, nose 1, cockpit 3, wings 4 (2 each), engines 4 (2 each), ignitions 2, tail fin 1, hull
seams 1 (merged), vents 1 (merged) = 21. 19 materials: hull-family 17 + shared seam 1 + shared vent
1. The outer `spaceship` group adds the model + trail `Points`, so the cursor is 34 objects
(1 outer + 1 model root + 10 groups + 21 meshes + 1 trail), 22 draws (21 meshes + trail), ≤2500
triangles. **All structural hull-family parts use AC-4 finish values** (`metalness 0.55`,
`roughness 0.38`, `clearcoat 0.4`, `clearcoatRoughness 0.2`); rarity changes colour/accent/shape
only (F9). Canopy: `metalness 0.2`, `roughness 0.08`, `clearcoat 1`,
`clearcoatRoughness 0.08`; highlight basic; ignitions emissive transparent opacity 0.55. No
shadows/lights/textures/loaders/random.

Slot shape transforms (scale/rotation) per spec: hull standard/armored/solar, nose
standard/lance/photon, cockpit standard/razor/oracle, wings standard/razor/solar, engines
standard/boxed/nova, ignitions standard/ion/plasma, tail fin standard/split/comet. Left/right slots
are independent.

`spaceship.ts`: keep follow/target/shot/ignition values and rest/scale; add
`applyAppearance`, bank/pitch, 8-point/220 ms trail, 0.015/2600 idle bob, 260 ms/4 % equip pulse,
`startFlyBy()` (700 ms 360° roll on 1.2-world orbit + 16-point/700 ms fire trail), no
muzzle/recoil/press. Reduced motion snaps, hides ignitions/trail, zeros bank/pitch/pulse/fly-by.

## Motion system

Observed `[O]`: target lock 250 ms dwell (no scale); instant conceal; 12 rays (80 grow/100 hold/
270 fade), 14 shards (1200 ms), 6 coins (1000 ms); 330 ms ring; 1100 ms coin popup; 760 ms level
burst (250 attack/510 release); banner peak 1.08 at **250 ms**, settle 450 ms; ship 700 ms roll +
700 ms trail; no shake; audio alignment. Implementation choices `[E]`: 120 ms reticle fade,
lootbox 1290 ms (charge 420 + orb 250 + flash 120 + reveal 360 + settle 140), equip/upgrade/row
pulses, cursor bank/trail/idle.

CSS: `main` declares the exact 13 mapped tokens from spec AC-34 (no `:root` changes); keyframes
`lootbox-reveal 1290ms`, `coin-pop 1100ms`, `level-burst 760ms`, `level-banner` peak 250/settle
450, `banner-halo 250`, `upgrade-purchased 260`; reduced-motion block disables all new motion.

**Performance.** High tier: old cursor 7 draws → new cursor 22 (+15), impact +4, targeting +2 =
**net +21**; 19 materials (+12). Medium: 17 cursor draws (no trail, four detail meshes hidden);
low: 15 cursor draws (no trail, six detail meshes hidden, no reticle/impact particles). T9/T14
trace idle and 10 clicks/s at 1280×720 and 1920×1080 (3 runs) at high, medium and low (forced via
the policy/test hook), prove a forced-low run recovers to high after the stable window, and report
average ≤16.7 ms, p95 ≤33 ms at high; bundle ≤350 KB gzip. A reproducible **high-tier** miss still
blocks; the approved adaptive tier is the mitigation (AC-52) and no further budget/quality change
is allowed without explicit user approval (Q-13). The accepted 1920×1080 idle median 16.694 ms
leaves ~0.006 ms headroom and is the first measurement to watch.

## Preview / UI

- Preview: `createPreviewScene(appearance)` + one 30 fps WebGL context while open; static reduced
  frame; blank fallback; dispose; keep canvas/aria and the five predecessor data attrs; 10
  `data-preview-slot-*`.
- Panel: 10 slot rows, 3 variants each, owned/locked/equipped, equip/unequip, 44 px, ARIA,
  `pendingOpen`, reveal orb + 1290 ms sequence, `data-equipping` row flash 260 ms (T12 owns).
- App: passes pending/reveal/coin queue; level banner 1600 ms; no HUD pulse for coins; existing
  200 ms click blink retained.
- Banner: 16 gold +8 cyan rays, 3 rings, 12 stars, 20 coins, `LEVEL COMPLETE`, halo; reduced
  overlay 150 ms ≤15 %; no camera/HUD shake.

## File inventory (T1–T14)

| Path | Task | Purpose |
| --- | --- | --- |
| `src/backend/src/game/parts-v2.ts` + test | T1 | Additive 30-part v2 catalog/normalizer |
| `src/backend/src/db/migrations/006_granular_spaceship_parts.sql`, `db/schema.sql`, `db/migrate.test.ts`, `db/migration-006.test.ts` | T2 | Version + appearance/parts value backfill |
| `src/backend/src/game/protocol.ts` + test | T3 | Additive protocol |
| `src/backend/src/auth/economy-repository.ts` + test | T4 | v2 open/setSlot/read normalization |
| `src/backend/src/game/hub.ts` + test, `src/backend/src/app.test.ts` | T5 | Hub/app v2 + legacy ownership |
| `src/frontend/src/game/parts-v2.ts` + test | T6 | Additive v2 catalog/params |
| `src/frontend/src/game/motion.ts` + test, `render/ship-motion.ts` + test | T7 | Tokens/easings/ship math |
| `src/frontend/src/render/cursor-ship.ts` + test | T8 | 34-object/21-mesh/19-material model |
| `src/frontend/src/game/effects.ts` + test, `render/cube-view.ts` + test, `render/world.test.ts`, `render/spaceship.ts` + test, `render/scene.ts` + test, `render/scene-spaceship.test.ts`, `render/targeting.ts` + test, `render/impact-effects.ts` + test, `render/particles.ts` + test, `render/quality.ts` + test | T9 | Instant conceal + cursor/scene/impact/targeting + adaptive quality |
| `src/frontend/src/multiplayer/protocol.ts` + test, `game/types.ts`, `game/engine.ts` + test, `game/session.ts` + test, `render/picking.ts` + test | T10 | Protocol mirror + engine/session/pending/open + hover pick |
| `src/frontend/src/render/preview.ts` + test, `ui/SpaceshipPreview.tsx` + test | T11 | Live preview |
| `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx` + test, `App.tsx` + test, `ui/app.css` + test, `ui/game-view.css` + test, `ui/Hud.tsx` + test, `ui/UpgradesPanel.tsx` + test, `ui/LevelCompleteBanner.tsx` + test | T12 | Panel/App/CSS/HUD/banner |
| `README.md`, `docs/product/glossary.md` | T13 | Docs |
| `build-log-T*.md`, `evidence/*` | each/T14 | Evidence |

Container assets and `src/backend/src/server.ts` are not in any task's `files_owned`.

## Key decisions

| # | Decision | Rationale | Alternatives |
| --- | --- | --- | --- |
| 1 | Additive `parts-v2.ts`, legacy module untouched | Green-per-task; old consumers compile/test until migrated | Rewriting `parts.ts` and all consumers in one task |
| 2 | 14 green tasks, consumer/test consolidation | F1: no red workspace between tasks | 23 scoped-gate tasks (rejected) |
| 3 | JSONB + version column | Accepted pattern; no new tables | Normalized tables |
| 4 | Legacy appearance values rewritten in 006 + read normalization | AC-33 exact mapping; restored rows work | Version-only normalization (bug) |
| 5 | One part per opening, weighted 75/25 | User ask; testable | Bundles/pity |
| 6 | Left/right independent, legacy ownership all-or-nothing | Granular ask; prevents partial legacy equip | Mirrored pair |
| 7 | `lootboxOpened` opener-only + account state | Reveal without replaying on tabs | Broadcast grant |
| 8 | Per-slot atomic `setSlotAppearance` | Multi-tab safe | Whole-map write |
| 9 | Instant conceal + pooled impact | Observed video | 160 ms shrink |
| 10 | UI/CSS 1290 ms reveal, banner peak 250 | Review-corrected observed/extra | 1040/370 |
| 11 | No rarity finish; AC-4 values for all structural parts | Review F9 | Rarity finish table |
| 12 | High-tier net +21 draws pinned; **user-approved adaptive high/medium/low tier** | Review F12 resolved | Silent over-budget; unapproved quality tier |
| 13 | `parts-v2` + consumer migration; `easeOutCubic` only in motion | Compatibility/dedupe | Duplicate exports |

## Risks & mitigations

- **Performance (+21 high-tier draws, 16.694 ms headroom).** The user-approved adaptive tier
  (AC-52) drops trail/reticle/decorative particles and detail meshes before sustained misses; T9/T14
  measure high/medium/low and prove recovery. A reproducible **high-tier** miss still blocks; no
  further budget/quality change without approval.
- **Migration value rewrite/overflow.** Exact SQL, numeric bound, AC-33 fixture, idempotent tests,
  pre-006 `pg_dump`; restore command recorded.
- **Green-per-task pressure.** Tasks T9/T10/T12 are large integration tasks; each owns all consumers
  and tests it breaks. The reviewer should reject partial gates; T14 is the only final gate.
- **Legacy compatibility drift.** T14 greps production imports of legacy `parts`; old tests stay
  green but no production consumer may keep v1 helpers.
- **Reveal arithmetic/observed values.** 1290 ms total, banner peak 250, level coins 20, debris
  1200; tests pin them.
- **Preview WebGL context.** One 30 fps context, hidden pause, dispose, fallback.
- **UI/mobile overload.** Scrollable panel, 44 px, no horizontal overflow at 320/375.
- **Rollback while v2 data exists.** Pre-006 dump; old code ignores v2 keys; do not open lootboxes
  while rolled back (Q-12).

## Rollback

1. Record `BASE` and take a `pg_dump` before migration 006; T2 records the command/output, T14
   records the dump as acceptance evidence.
2. Redeploy the previous images/revert; restore the dump if v2 data must be discarded.
3. The old code ignores v2 keys and falls back to default appearance; do not open lootboxes on the
   rolled-back backend until the restore decision. Frontend presentation can roll back separately.

## Verification

- Per-task full workspace: `npm run lint`, `npm run typecheck --workspace <ws>`,
  `npm test --workspace <ws>`, `npm run coverage --workspace <ws>`; green before the next task.
- T14: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`,
  `npm run smoke` (real smoke required; skipped is not a pass).
- Diff gates: compose/Dockerfiles/`src/server.ts`/manifests unchanged; only migration 006 DB
  artifact. Bundle ≤350 KB. Scene `countObjects` 136; children 9/10. T14 forces high/medium/low,
  records the tier thresholds/cooldowns and proves low→high recovery after the stable window; a
  high-tier reproducible miss blocks.
- Manual matrix/reduced A/B/frame traces per spec; AC-46 reference table; coverage ≥80×4; docs
  README/glossary/index proposal.

## Open questions

See `spec.md` § Open questions. Q-1 is **resolved** (video decoded 2026-11-08); Q-2 is only a
build/performance split option; Q-3/Q-4 odds/duplicates; Q-5 left/right; Q-6/Q-7 local/guest;
Q-10 audio out of scope; Q-12 rollback; Q-13 performance approval.

## Revision history

- r1 — 2026-11-08 — initial plan (A/B/C; old 23-task DAG; blocked video).
- r2 — 2026-11-08 — video analysis integrated; observed/extrapolated Pillar C.
- r3 — 2026-11-08 — spec-r1 disposition F1–F27: 14 green-per-task tasks; `parts-v2` additive
  compatibility; scene 136; migration appearance-value rewrite + unconditional legacy
  normalization; detailed-hero AC-1/AC-13/AC-14 supersession; pending open; 1290 ms reveal;
  observed-value corrections; no rarity finish; legacy ownership; row-flash owner; +21 draw
  budget; picking ownership; single `easeOutCubic`; CSS token map; backup/smoke/docs fixes.
  **r3 consistency verified:** MOTION includes `lootboxTotalMs 1290`, `bannerPeakMs 250`,
  `levelCoinCount 20`, `debrisLifetimeMs 1200`; inventory is T1–T14 only; no stale
  shockwave/particle wording.
- r4 — 2026-11-08 — **user-approved adaptive quality tier (AC-52).** Added pure
  `render/quality.ts` with the 120-frame window, exact high/medium/low thresholds, hysteresis,
  downgrade/upgrade cooldowns and feature matrix; T9 owns the module/tests and scene/cursor/effects
  wiring; T14 measures all three tiers and proves recovery while a high-tier miss still blocks.
  No other scope change. **r4 consistency verified:** AC-1…AC-52 map to T1–T14; inventory is
  T1–T14 only; T14 is last.
