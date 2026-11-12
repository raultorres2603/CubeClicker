---
feature: small-destruction-shot-fx
revision: 3
---

# Plan — Small destruction and realistic shot FX

## Architecture

**State ownership.** No game state changes hands; every new layer is a presentation adapter:

| State | Owner | Lifetime |
| --- | --- | --- |
| Destroy records (≤ 150 per cube, elapsed ms) | `render/cube-view.ts` | Per client/frame (140 ms each) |
| Impact flash pool (6 records) | `render/impact-effects.ts` | Per client/frame (140 ms each) |
| Impact ember/smoke pool (72 points) | `render/impact-effects.ts` | Per client/frame (380/480 ms each) |
| Existing shard pool (42) and spark pool (72) | `render/impact-effects.ts`, `render/particles.ts` | Unchanged |
| Bolt, muzzle flash and recoil timer | `render/spaceship.ts` | Per shot (180 ms bolt, 80 ms flash, 120 ms recoil) |
| New counts/gains/durations | `game/motion.ts` | Build-time constants |
| Per-tier counts/flags | `render/quality.ts` `qualityFeatures` | Build-time constants + policy |
| Wiring, object counts, call sites | `render/scene.ts` | Per client/frame |
| Remote broadcast parity | `render/world.ts` | Per client/frame |

**Data flow (local click).**

1. t = 0: `SceneView.applyIntents` receives the explosion intent, reads the tile origin/normal,
   calls `spaceship.spawnShot(spaceship.getPosition(), origin)`, and pushes a pending explosion with
   `remainingMs = SHOT_TRAVEL_MS` (180). `spawnShot` computes `muzzle = anchor + rotate(group.quaternion,
   (0, 0, 0.78))`, places the bolt there, starts the muzzle flash and the recoil, and records
   `Shot.start` (anchor), `Shot.muzzle`, `Shot.target`.
2. t = 0–180 ms: `SceneView.update` → `spaceship.update` (recoil applied to the model subgroup) and
   `spaceship.updateShots` (bolt travels linearly; muzzle flash removed at 80 ms).
3. t = 180 ms: `applyDeferredExplosion` calls `cube.hideMiniCube(intent.id, reducedMotion)` (marks
   hidden/unpickable, starts the 140 ms destroy), `impact.spawnPop(origin, normal, frameTime)` (shards,
   flash, embers, smoke), and `particles.spawn(intent.burst, origin + normal·0.5, frameTime)`.
4. t = 180–320 ms: destroy records advance to zero-scale; flash fades by 320 ms; embers by 560 ms;
   smoke by 660 ms; shards and sparks keep their accepted lifetimes.
5. t = 320 ms: the tile is gone; the explosion is in its ember/smoke tail.

**Data flow (remote).** `WorldView.applyMessage('miniCubeRemoved')` calls `hideMiniCube(id)` (animate)
and spawns the unchanged burst; `applyRoster`/`hideInitialTile` call `hideMiniCube(id, true)` (instant)
so joining/reconnecting clients never replay a historical animation. No protocol or server change.

**Data flow (quality).** `SceneView.applyQuality` computes `qualityFeatures(tier, reducedMotion)` and
forwards `{ shards, flash, embers, smoke }` to the impact module and `shotFx` to the spaceship. The
quality policy itself is untouched; the new rows only add counts/flags.

**Timeline (one click, high tier).**

| Time | Event |
| --- | --- |
| 0 ms | Shot leaves the nose, muzzle flash 0–80 ms, recoil 0–120 ms |
| 0–180 ms | Bolt travels; tile still intact; coin popup already visible |
| 180 ms | Impact: tile hides/unpickable, destroy starts (brightness 3, scale 1), white core starts, 8 embers + 4 smoke + 14 shards + 24 sparks |
| 210 ms | Destroy peak scale 1.08 (30 ms into the destroy); core ≈ mid-growth |
| 240 ms | Core peak 0.55 world (60 ms after impact) |
| 320 ms | Tile fully zero-scaled; core gone; embers/smoke/shards/sparks remain |
| 560 ms | Embers gone |
| 660 ms | Smoke gone |
| 1380 ms | Shards gone (accepted 1200 ms from impact) |

**Draw/object accounting.**

- Accepted particle-only baseline: 133 scene objects = 63 pre-backdrop (impact group 2) + 70 cosmic;
  impact 1 draw; worst-case 42 shards + 72 sparks.
- New baseline: **135** = **65 pre-backdrop** (impact group **4**: group + `impact-shards` +
  `impact-flash` + `impact-burst`) + 70 cosmic; 9 scene children (10 with a remote world); impact
  contributes **3 draws when active**, 0 at idle (flash count 0, burst drawRange 0, shards count 0).
- Spaceship group stays 34 objects (model 32 + trail 1 + group 1); `shotsGroup` stays 1 object at
  idle. The bolt and muzzle flash are created per shot and removed, so they never change the
  baseline; worst case at 10 clicks/s is 2 live shots + 2 live muzzle flashes.
- Worst-case live pools: 42 shards, 72 sparks, 6 flash, 72 burst points, 2 muzzle flashes, 2 shots,
  150 destroy records. No new drawable, geometry or material is created after construction and the
  pools allocate nothing per frame; the unchanged shard pool's per-spawn scratch vectors are exempt.
  Oldest-first recycling everywhere.
- Triangles: +48 static (6 flash instances × 8), +8 per live muzzle flash, and the 12-triangle bolt
  replaces the ≈112-triangle sphere (net −100 per shot).
- Draw change during a click trace: +2 impact pools (active almost continuously at 10 clicks/s) and
  **+0.8 mean muzzle flash** (80 ms live / 100 ms click interval) = **≈ +2.8** at high/medium; 0 at
  low. Pinned click means: high ≤ 221.0/220.0, medium ≤ 207.0/207.0, low ≤ 205.0/202.0 (1280/1920).
  The bars are the worst accepted predecessor trace per size/tier — high 215.54/214.15, medium
  201.40/201.24, low 201.79/197.94 (larger of the builder median and the independent rerun) — plus
  +2.8 at high/medium (0 at low) plus a 2.6–4.1-draw run-to-run margin; the observed 1280 high
  spread is 4.30 draws across individual runs and the acceptance statistic is the 3-run median.
  Idle unchanged (0 new active draws).

## Interfaces / contracts

### `src/frontend/src/game/motion.ts` (T1)

```ts
export const MOTION = {
  // ... all accepted keys unchanged ...
  miniCubeDestroyMs: 140,
  miniCubeDestroyGrowMs: 30,
  miniCubeDestroyPeakScale: 1.08,
  miniCubeDestroyFlashMs: 90,
  miniCubeDestroyFlashGain: 3,
  impactFlashMs: 140,
  impactFlashGrowMs: 60,
  impactEmberCount: 8,
  impactEmberLifetimeMs: 380,
  impactSmokeCount: 4,
  impactSmokeLifetimeMs: 480,
  shotMuzzleFlashMs: 80,
  shotRecoilMs: 120,
  shotRecoilDistance: 0.12,
} as const;
```

No CSS tokens are added (the new effects are three.js-only); `game-view.css` and its test are
untouched.

### `src/frontend/src/render/quality.ts` (T1)

```ts
export const QUALITY_EXPLOSION_FLASH_COUNTS: Readonly<Record<QualityTier, number>> =
  { high: 1, medium: 1, low: 0 };
export const QUALITY_EXPLOSION_EMBER_COUNTS: Readonly<Record<QualityTier, number>> =
  { high: 8, medium: 4, low: 0 };
export const QUALITY_EXPLOSION_SMOKE_COUNTS: Readonly<Record<QualityTier, number>> =
  { high: 4, medium: 2, low: 0 };
export const QUALITY_SHOT_FX: Readonly<Record<QualityTier, boolean>> =
  { high: true, medium: true, low: false };

export interface QualityFeatures {
  // ... accepted fields unchanged ...
  readonly explosionFlash: number;   // 1/1/0; 0 under reduced motion
  readonly explosionEmbers: number;  // 8/4/0; 0 under reduced motion
  readonly explosionSmoke: number;   // 4/2/0; 0 under reduced motion
  readonly shotFx: boolean;          // true/true/false; false under reduced motion
}
```

`qualityFeatures` keeps every accepted field and value; the new fields are computed from the
constants and forced to `0`/`false` when `reducedMotion` is true. `createQualityPolicy` and all policy
constants are untouched.

### `src/frontend/src/game/effects.ts` (T2)

```ts
export const MINI_CUBE_POP_MS = MOTION.miniCubeDestroyMs; // 140

/** 1 at the hide frame; 1.08 at 30 ms; 0 at 140 ms. */
export function miniCubeDestroyScaleAt(elapsedMs: number): number;
/** 3 at the hide frame; 1 at 90 ms; 1 after. */
export function miniCubeDestroyBrightnessAt(elapsedMs: number): number;
```

Pinned tables:

| elapsedMs | scaleAt | brightnessAt |
| --- | --- | --- |
| < 0 | 1 | 1 |
| 0 | 1 | 3 |
| 15 | 1.07 | 2.6667 |
| 30 | 1.08 | 2.3333 |
| 45 | 0.8056 | 2 |
| 85 | 0.27 | 1.1111 |
| 90 | 0.2231 | 1 |
| 140 | 0 | 1 |
| > 140 | 0 | 1 |

(Exact values are computed from the formulas; the test pins `0/15/30/85/140` for scale and
`0/45/90/140` for brightness. The intermediate 45 ms scale is `1.08 · (1 − easeOutQuad(15/110)) =
0.8056`; the 90 ms scale is `1.08 · (1 − easeOutQuad(60/110)) = 0.2231`; the 85 ms brightness is
`1 + 2 · (1 − 85/90) = 1.1111`.)

### `src/frontend/src/render/impact-effects.ts` (T2)

```ts
export const DEBRIS_POOL_CAP = MOTION.debrisPoolCap;      // 42, unchanged
export const DEBRIS_PER_POP = MOTION.debrisPerPop;        // 14, unchanged
export const IMPACT_FLASH_POOL_CAP = 6;
export const IMPACT_FLASH_COLOR = 0xfff2dc;
export const IMPACT_FLASH_START_SCALE = 0.18;
export const IMPACT_FLASH_PEAK_SCALE = 0.55;
export const IMPACT_BURST_POOL_CAP = 72;

export interface ImpactFeatures {
  readonly shards: number;  // 14/7/0
  readonly flash: number;   // 1/1/0
  readonly embers: number;  // 8/4/0
  readonly smoke: number;   // 4/2/0
}

export interface ImpactEffects {
  readonly group: Group; // exactly impact-shards, impact-flash, impact-burst
  spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void;
  update(dtMs: number): void;
  activeCounts(): { shards: number; flash: number; points: number };
  setFeatures(features: Partial<ImpactFeatures>): void;
  dispose(): void;
}
```

- Default features `{ shards: 14, flash: 0, embers: 0, smoke: 0 }` — the module is inert for the
  explosion until `SceneView.applyQuality` wires the tier (T3). This keeps T2's scene tests green and
  prevents a reduced-motion leak before the wiring lands.
- `setFeatures` merges a partial patch into the current features, then clamps: shards `[0,14]`,
  flash `[0,6]`, embers `[0,8]`, smoke `[0,4]`; non-finite → 0.
- `spawnPop` draws in the pinned order: shards first exactly as the accepted code (direction 3,
  speed 1, axis 3, angular 1), then embers/smoke (direction 3, speed 1 per point). This preserves the
  accepted shard seeded sequences.
- Flash record: `{ startMs, origin+normal·0.02, normal }`; `update` computes elapsed, scale
  `0.18 + 0.37·easeOutCubic(min(1, t/60))`, holds scale at 0.55 from 60–80 ms, then fades its
  per-instance scalar brightness `1 − (t − 80)/60` clamped `[0,1]` over 80–140 ms; at ≥140 release.
  The shared material is warm white (`IMPACT_FLASH_COLOR = 0xfff2dc`), so `instanceColor` is the
  scalar brightness written to r = g = b; there is no hue lerp. The amber/orange read comes from the
  ember points. `count` = live flash count.
- Burst point record: preallocated arrays for position, velocity, age, lifetime, base colour and
  gravity. Ember: speed `0.8 + random()·1.0`, direction `normalize(unit + normal·1.5)`,
  drag `exp(-3·dt)`, `vy -= 1.5·dt`, colour `0xff9a3c` or `0xffe7c4` for `index % 4 === 0`, lifetime
  380. Smoke: speed `0.2 + random()·0.3`, direction `normalize(unit + normal·0.8)`,
  `velocity = direction · speed` with `vy += 0.25` at spawn (constant upward bias; no per-frame
  acceleration or gravity), colour `0x8a7f72 × 0.45`, lifetime 480. Fade to black over the lifetime (additive).
  Jitter ±0.04 world at spawn; base `origin + normal·0.05`.
- `update` writes positions/colours and sets `drawRange(0, livePoints)`. `activeCounts().points`
  counts live embers + smoke.
- `dispose` disposes the three geometries (`BoxGeometry`, `OctahedronGeometry`, burst
  `BufferGeometry`) and three materials exactly once, clears records and the group, idempotent.

### `src/frontend/src/render/cube-view.ts` (T2)

```ts
hideMiniCube(id: MiniCubeId, instant?: boolean): void;
update(dtMs: number): void;
settlePops(): void;
```

- `hideMiniCube` validates the id first (unchanged error messages), marks hidden/unpickable
  immediately, and is idempotent (a repeated id never restarts the destroy).
- `instant === true`: zero-scale the instance now, leave `instanceColor` at 1, no record (reduced
  motion, roster hydration). `instant === false`: write brightness 3 on the hide frame, start a
  record `{ faceId, index, elapsedMs: 0 }`; `update` advances each record and writes the matrix
  (`writePopMatrix(record, index, scaleAt)`) and colour (`brightnessAt` on all three channels) until
  `elapsedMs ≥ 140`, then zero-scales, restores colour 1 and drops it.
- Records live in a per-face `Map<number, number>` (index → elapsed); no per-frame allocation; at
  most `gridSize² × 6` records (150 at 5×5).
- `settlePops` zero-scales and restores colour for every live record, then clears; `removeFace` drops
  the face's records before disposing; `dispose` clears all records.
- `update(0)` advances nothing (a `dtMs <= 0` guard) so a paused frame does not skip the flash.
- The `instant` flag regains its real meaning (it was a no-op under AC-36); scene call sites already
  pass `reducedMotion` for the local cube and `true` for roster hydration.

### `src/frontend/src/render/spaceship.ts` (T2)

```ts
export const SHOT_MUZZLE_OFFSET = 0.78;
export const SHOT_MUZZLE_FLASH_MS = MOTION.shotMuzzleFlashMs; // 80
export function shotRecoilOffsetAt(elapsedMs: number): number;

export interface Shot {
  readonly mesh: Mesh;          // name 'shot-bolt'
  readonly start: Vector3;      // ship anchor passed to spawnShot (compatibility)
  readonly muzzle: Vector3;     // actual bolt origin: anchor + rotated (0,0,0.78)
  readonly target: Vector3;
  readonly muzzleFlash: Mesh;   // name 'shot-muzzle-flash'
  muzzleRemainingMs: number;
  remainingMs: number;
}

// Spaceship additions:
setShotFxEnabled(enabled: boolean): void;
getMuzzleFlashCount(): number;
getRecoilOffset(): number;
```

- Bolt geometry: one shared `ConeGeometry(0.07, 0.55, 6)` with `rotateX(Math.PI / 2)` (tip +z),
  additive `MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.95,
  depthWrite: false, toneMapped: false })`; one mesh per shot, removed on arrival. Orient with
  `quaternion.setFromUnitVectors(UP_Z, target.clone().sub(muzzle).normalize())`.
- Muzzle flash: one shared `OctahedronGeometry(0.22, 0)`, additive `0xffd27a`; one mesh per shot at
  the muzzle with the same orientation; `scale = 1 + 0.4·easeOutCubic(t/80)`, `opacity = 0.9·(1 −
  t/80)`; removed at 80 ms. `getMuzzleFlashCount()` counts live flash meshes.
- Recoil: on `spawnShot`, record `recoilStartMs = timeMs`; in the normal follow path, set
  `model.group.position.z = shotRecoilOffsetAt(timeMs − recoilStartMs)` when
  `shotFxEnabled && !reduced`; otherwise `0`. The no-pointer/fly-by/reduced paths reset it to 0.
  `getRecoilOffset()` returns the applied value. The outer group, camera and HUD never move.
- `setShotFxEnabled(false)` clears live muzzle flashes and sets recoil 0; the bolt still travels.
- Reduced motion: if `reduced` is true, `spawnShot` still creates the bolt (scene does not call it)
  but creates no muzzle flash and no recoil.
- `dispose` disposes the bolt geometry/material and muzzle geometry/material exactly once, clears
  `shotsGroup` and the shot list.

### `src/frontend/src/render/scene.ts` (T3)

```ts
impact.setFeatures({
  shards: features.impactShards,
  flash: features.explosionFlash,
  embers: features.explosionEmbers,
  smoke: features.explosionSmoke,
});
spaceship.setShotFxEnabled(features.shotFx);
```

No other behavior change: `applyIntents` keeps `spaceship.spawnShot(start, origin)` and the 180 ms
pending explosion; `applyDeferredExplosion` keeps `impact.spawnPop` + `particles.spawn`; the camera
path is untouched. Comments that describe the impact as "shard-only" are updated to the three-pool
wording.

## File inventory

| Path | New/Edit | Task | Purpose |
| --- | --- | --- | --- |
| `src/frontend/src/game/motion.ts` | Edit | T1 | Add the 14 new tokens; no existing value changes |
| `src/frontend/src/game/motion.test.ts` | Edit | T1 | Exact `MOTION` object + headline sums |
| `src/frontend/src/render/quality.ts` | Edit | T1 | New counts/flags and `QualityFeatures` fields |
| `src/frontend/src/render/quality.test.ts` | Edit | T1 | Exact matrix for high/medium/low/reduced; policy untouched |
| `src/frontend/src/game/effects.ts` | Edit | T2 | `MINI_CUBE_POP_MS = 140`; destroy scale/brightness helpers |
| `src/frontend/src/game/effects.test.ts` | Edit | T2 | Pinned helpers and updated conceal constant |
| `src/frontend/src/render/impact-effects.ts` | Edit | T2 | Add `impact-flash` and `impact-burst` pools |
| `src/frontend/src/render/impact-effects.test.ts` | Edit | T2 | Three drawables, counts, palette, recycle, dispose |
| `src/frontend/src/render/cube-view.ts` | Edit | T2 | 140 ms per-instance destroy; instant path; settle/remove/dispose |
| `src/frontend/src/render/cube-view.test.ts` | Edit | T2 | Destroy timeline, flag semantics, records, neighbours |
| `src/frontend/src/render/world.ts` | Edit | T2 | Comments: broadcast animates, roster instant (no logic change) |
| `src/frontend/src/render/world.test.ts` | Edit | T2 | Remote animate vs instant hydration, duplicate no-restart |
| `src/frontend/src/render/spaceship.ts` | Edit | T2 | Bolt, muzzle flash, recoil, Shot.muzzle, setter/getters |
| `src/frontend/src/render/spaceship.test.ts` | Edit | T2 | Shot/muzzle/recoil envelopes, tier/reduced suppression, dispose |
| `src/frontend/src/render/scene.test.ts` | Edit | T2 | 135-object baseline, 140 ms conceal timeline, remote timeline |
| `src/frontend/src/render/scene-spaceship.test.ts` | Edit | T2 | Three impact children, muzzle/travel through the scene |
| `src/frontend/src/render/scene.ts` | Edit | T3 | Wire the quality rows; update impact comments |
| `src/frontend/src/render/scene-effects.test.ts` | New | T3 | Wired tier matrix, destroy timeline, shot/recoil, no-shake |
| `README.md` | Edit | T3 | Click-sentence update with the new phrases |
| `docs/features/small-destruction-shot-fx/build-log-T1.md` | New | T1 | Tokens/quality gate + `BASE_SHA` |
| `docs/features/small-destruction-shot-fx/build-log-T2.md` | New | T2 | Render implementation gate |
| `docs/features/small-destruction-shot-fx/build-log-T3.md` | New | T3 | Full gate, traces, visual matrix, index proposal |
| `docs/features/small-destruction-shot-fx/evidence/*` | New | T3 | Timestamped frames at 1280×720 and 1920×1080 |

Not edited: `src/frontend/src/render/particles.ts` and its tests (spark layer unchanged),
`src/frontend/src/render/picking.ts`/`targeting.ts` (hidden state is immediate), `game/parts-v2.ts`,
UI/HUD/banner/panel files, all backend sources, protocol files, manifests, lockfiles, compose files,
Dockerfiles, `docs/features/README.md` and all predecessor artifacts.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Animate the actual tile instance for 140 ms instead of spawning a ghost | The user asked for a mini-cube "destroy"; keeping the tile's own matrix/colour reads as the cube breaking, costs zero new objects/draws, and preserves the dark interior immediately behind it | Instant conceal + ghost afterimage (one extra drawable; reads as an afterimage, not the cube) |
| 2 | Hide/unpickable on the impact frame, visible collapse until 140 ms | Double-clicks cannot fire twice; rapid clicking stays snappy; the collapse is short enough to overlap the next click | Holding pickability until the animation ends (would eat inputs) or zero-scaling after 200 ms (too slow) |
| 3 | Extend `impact-effects.ts` with two pools instead of a new module | The explosion is part of the same per-pop impact; one module keeps the origin/normal/feature contract and the scene call site stable | New `explosion-effects.ts` (more wiring, same draws) |
| 4 | One instanced octahedron flash + one Points pool for embers/smoke | Two draws for the whole little explosion; no per-spawn geometry/material; the core stays crisp and the haze shares a draw | Separate smoke `Points` (darker but +1 draw), instanced quads (camera-facing complexity) |
| 5 | Additive warm-grey haze instead of dark smoke | Keeps one drawable and matches the neon space palette; the smoke is a plasma puff, not soot | Normal-blended smoke (needs per-vertex alpha/custom shader or a second drawable) |
| 6 | Bolt + muzzle flash + model-local recoil; keep 180 ms | The bolt and flash sell the shot; the recoil is a 0.12-local offset on the model subgroup, so the camera/HUD cannot shake; 180 ms keeps the accepted pacing | Tracer line (less physical), screen shake (forbidden), shorter travel (changes pacing) |
| 7 | Keep `Shot.start` as the anchor and add `Shot.muzzle` | Limits churn in existing scene tests and makes the visual origin explicit; the bolt/travel uses the muzzle | Renaming `start` to the muzzle (forces broader test churn for no user gain) |
| 8 | Explosion counts 1/8/4 high, 1/4/2 medium, 0/0/0 low; `shotFx` true/true/false | Preserves the adaptive policy's low-tier restraint and the accepted no-particle low tier, while the destroy collapse always gives low-tier feedback | Full explosion at low (unproven frame budget, reverses the accepted low-tier restraint) |
| 9 | Pin the new scene baseline at 135 (65 + 70) | Keeps `countObjects` meaningful; records the exact +2 object cost of the explosion pools | Leave the count unpinned (regressions undetectable) |
| 10 | New `scene-effects.test.ts` for the wired integration | Keeps `scene.test.ts` (T2) and `scene-spaceship.test.ts` (T2) ownership stable; the T3 wiring has its own integration file | Editing T2-owned tests from T3 (exclusive-ownership violation) |
| 11 | No audio, no external asset, no post-processing pass | The request is visual; procedural additive materials fit the existing renderer and the bundle/asset constraints | Sprite textures/bloom pass/audio (new assets or pipeline work, flagged as open questions) |
| 12 | README click sentence updated; index proposal only | Keeps docs accurate without rewriting accepted historical specs; the index stays orchestrator-owned | Editing `docs/features/README.md` directly (ownership violation) |

## Risks & mitigations

- **The 140 ms destroy reads as input lag or blocks rapid clicking.** → The id is hidden/unpickable
  on the impact frame; a repeated id never restarts; 140 ms is shorter than the 180 ms shot travel,
  so the next click's impact can overlap the previous collapse. Tested in `cube-view.test.ts` and
  `scene-effects.test.ts`; Q-1 records the alternative ghost/instant path.
- **The little explosion still reads as "gold" or too large.** → The palette is white-hot/amber/
  warm grey, the core peaks at ≈45 px at the front face (the observed core), and there are no rays,
  coins or ring. The AC-9 frames are inspected at 1280 and 1920; Q-3 pins the fallback to 0.45
  world/8 points.
- **Draw-budget creep.** → Only two persistent pools (+2 objects, +2 draws) and one transient muzzle
  flash (+1 draw for 80 ms); the bolt replaces the sphere one-for-one; the AC-8 traces pin the click
  medians and p95.
- **Test churn from changing conceal/shot semantics.** → T2 owns every affected unit/integration
  test (`cube-view`, `world`, `scene`, `scene-spaceship`, `spaceship`, `effects`); no other owner edits
  them; the full frontend suite must be green before T3.
- **Remote clients replay animations on reconnect.** → Roster hydration uses `hideMiniCube(id, true)`;
  only live `miniCubeRemoved` broadcasts animate. Pinned in `world.test.ts`.
- **Additive smoke looks like a glow, not smoke.** → Q-7; the haze is deliberately faint (0.45
  brightness) and the fallback (a second normal-blended Points) is a one-draw change if approved.
- **The scene wiring lands without the pools being counted.** → T2 updates the 135-object baseline
  and the three-child impact group; T3 only changes counts fed to existing pools, so the object count
  cannot drift at the wiring step.
- **Coverage drops from new branches.** → T1–T2 add exact tests for every branch (negative/zero/late
  elapsed, empty pools, caps, instant/reduced, duplicate ids, disabled shot FX); the final gate runs
  the full coverage command.

## Verification

**Feature fork point (`BASE_SHA`).** Before T1's first edit, record
`BASE_SHA=$(git rev-parse HEAD)` in `build-log-T1.md`; T2/T3 transcribe it. Do not use
`git merge-base main HEAD`. All T3 diff gates compare `"$BASE_SHA"...HEAD`.

**T1 gate (frontend):** `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`,
`npm test --workspace @cubeclicker/frontend`,
`npm run coverage --workspace @cubeclicker/frontend`. Evidence in `build-log-T1.md`, including
`BASE_SHA`.

**T2 gate (frontend):** the same four commands; evidence in `build-log-T2.md`. The full frontend
suite (including `scene.test.ts`, `scene-spaceship.test.ts`, `world.test.ts`, `picking.test.ts`,
`targeting.test.ts`, `App.test.tsx`, `Hud.test.tsx`) must be green with the new conceal/shot
semantics.

**T3 final gate (repository):**

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run coverage`
5. `npm run build`
6. Diff gate:
   `git diff --exit-code "$BASE_SHA"...HEAD -- src/backend src/frontend/src/multiplayer/protocol.ts src/backend/package.json src/frontend/package.json package.json package-lock.json compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile`
7. Import/URL/loader grep (succeeds only when none):
   `! grep -rnE "GLTFLoader|FileLoader|TextureLoader|fetch\(|https?://" src/frontend/src/render src/frontend/src/game --include=*.ts --include=*.tsx | grep -v '\.test\.'`
8. Runtime/game asset diff (succeeds only when no asset change):
   `! git diff --name-only "$BASE_SHA"...HEAD -- src/frontend/public src | grep -Ei '\.(png|jpe?g|svg|mp3|wav|glb|gltf)$'`
9. Audio grep (succeeds only when none): `! grep -rnE "AudioContext|new Audio\(|<audio" src/frontend/src --include=*.ts --include=*.tsx`
10. README greps: present `green shard debris`, `spark particles`, `no click ray fan`,
    `granular spaceship parts`, `detailed blue/orange hero spaceship`, `small white-orange impact
    burst`, `collapses over 140 ms`, `glowing tracer bolt with a muzzle flash`; absent
    `vanishes on the same frame`.
11. Index guard (expect no diff):
    `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md`; record the proposed row in
    `build-log-T3.md`.
12. Manual visual matrix: `podman compose up` (or `npm run dev`); at 1280×720 and 1920×1080 capture
    the AC-9 windows (muzzle 20–60 ms, bolt 90–150 ms, impact 180–220 ms, core peak 240–280 ms, tile
    gone 320–340 ms, smoke 420–480 ms and gone by 660 ms), the reduced-motion frames at 120/360 ms,
    and the preserved coin/reticle/cursor/banner/no-shake checks; map every frame with its measured
    timestamp in the build log.
13. Traces: 10 s idle + 10 clicks/s at both sizes in the same single-member guest world and harness
    (fresh page, three clean runs; record the remote-world object count per run), forced medium/low,
    and a forced-low→high recovery run; record avg/p95, draw means (high ≤ 221.0/220.0, medium ≤
    207.0/207.0, low ≤ 205.0/202.0; p95 ≤ 33 at every tier), tier transitions, `countObjects(scene)
    === 135`, pool caps, triangle deltas and the JS gzip (≤ 279 KB).

## Open questions

See `spec.md` § Open questions. **Q-1, Q-2 and Q-3 are accepted defaults** (orchestrator decision,
2026-11-11): 140 ms tile destroy superseding the same-frame conceal; glowing bolt + 0.12/120 ms
recoil with 180 ms travel; warm-white core + scalar brightness, amber embers and warm-grey haze at
0.18→0.55 world. Q-4 audio (none), Q-5 shard retention (keep), Q-6 low-tier destroy-only and Q-7
additive haze are retained defaults. None blocks T1.

## Review r1 disposition (F1–F11)

All eleven findings are fixed (2026-11-11); the authoritative per-finding table is `spec.md`
§ Review r1 disposition. Plan-side changes:

| # | Severity | Disposition | Plan-side change |
| --- | --- | --- | --- |
| F1 | MAJOR | Fixed | Draw accounting re-based on the worst accepted trace per size/tier plus +2.8 high/medium (0 low) plus a 2.6–4.1-draw margin; bars high ≤221.0/220.0, medium ≤207.0/207.0, low ≤205.0/202.0; trace environment pinned (single-member guest world, same harness, fresh page, 3 runs, remote-world object count recorded). |
| F2 | MINOR | Fixed | Muzzle-flash mean corrected to +0.8 and total to ≈+2.8; +3 worst case retained. |
| F3 | MINOR | Fixed | "No new drawable/geometry/material after construction and no per-frame allocations"; shard per-spawn scratch vectors exempt; test asserts identities and per-frame freedom. |
| F4 | MINOR | Fixed | Camera equality stays in `scene-effects.test.ts`; HUD evidence is assigned to the unchanged React/CSS suites in the spec and T3 notes. |
| F5 | MINOR | Fixed | T3 manual windows are 320–340 ms for tile-gone and 420–480 ms / gone by 660 ms for smoke. |
| F6 | MINOR | Fixed | Spec AC-2 wording now says "exports these four constants with exactly these values"; existing exports remain. |
| F7 | MINOR | Fixed | Smoke motion is `direction · speed` plus a constant `+0.25` world/s upward bias at spawn, no per-frame acceleration/gravity, matching the spec and test. |
| F8 | MINOR | Fixed | T3 commit is `feat: wire the destruction and shot effects` with an optional separate `docs:` commit. |
| F9 | MINOR | Fixed | The tolerance rule is scoped to new assertions; pre-existing tolerances need no rewrite. |
| F10 | MINOR | Fixed | `mesh.instanceColor` is named as the per-instance brightness channel in the spec; the plan already uses it. |
| F11 | INFO | Fixed | `miniCubeDestroyBrightnessAt(t < 0)` is 1; live records still start at 0. |

## Revision history

- r1 — 2026-11-11 — initial plan: T1 tokens/quality; T2 all render modules + tests + conceal/budget
  updates; T3 scene wiring, new integration test, docs, visual/perf evidence; 135-object budget;
  exact interfaces and supersession boundaries.
- r1.1 — 2026-11-11 — consistency fix: corrected the destroy table's 45/85/90 ms samples; aligned
  the flash contract to `IMPACT_FLASH_COLOR = 0xfff2dc` with scalar brightness (no colour lerp);
  marked Q-1/Q-2/Q-3 accepted defaults.
- r2 — 2026-11-11 — revision metadata aligned with spec r2.
- r3 — 2026-11-11 — spec-review r1 disposition F1–F11 (all fixed): corrected bars/muzzle mean and
  pinned trace environment; shard allocation exemption; HUD ownership; 320/660 ms evidence windows;
  constant smoke bias; `feat:` commit; new-test tolerance scope; `instanceColor`; pre-start
  brightness 1. Three pillars, accepted Q-1/Q-2/Q-3, T1 → T2 → T3 and all budgets/supersessions
  retained.
