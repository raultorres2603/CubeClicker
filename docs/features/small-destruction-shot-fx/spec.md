---
feature: small-destruction-shot-fx
revision: 4
status: draft
created: 2026-11-11
updated: 2026-11-12
---

# Spec — Small destruction and realistic shot FX

## Summary

The user asks for three additions to the click loop: "little explosions, a minicube effect of
'destroy' and also more realistic shot effect from spaceship." Today a clicked mini-cube vanishes
on the impact frame (the accepted one-frame conceal), the impact is a green-shard debris layer plus
a gold spark burst (the massive gold ray/coin/ring explosion was deliberately removed), and the
pointer ship fires a small yellow sphere with no muzzle flash, no recoil and no visible propulsion
beyond its existing plume. This feature adds (A) a small, localized impact explosion at the hit
mini-cube — a white-hot core, an orange/amber ember puff and a warm smoke haze, bounded to roughly
the observed pop core's size and never the removed gold fan/coins/ring; (B) a distinct per-cube
destroy animation on the clicked tile itself — a 140 ms brighten/swell then collapse to zero, while
the tile remains immediately unpickable and the cube still disappears promptly; and (C) a more
realistic shot presentation — a glowing tapered tracer bolt, a short muzzle flash at the ship's
nose, a slight recoil/settle, and the little explosion's white core acting as the hit flash — while
preserving the accepted 180 ms shot travel and adding no screen shake. Every new layer has a
reduced-motion variant and an adaptive-quality count; all effects are procedural and local.

## User stories

- As a player, when my shot lands on a mini-cube I want to see a small, punchy impact explosion —
  a white-hot core, a few embers and a puff of smoke — not a massive gold explosion.
- As a player, I want the clicked mini-cube itself to visibly break (a quick flash-and-collapse)
  instead of blinking out, so the destruction reads as cause and effect.
- As a player, I want the pointer ship's shot to read as a real shot: a muzzle flash at the nose,
  a visible glowing bolt with a hot trail, a slight recoil, and a bright hit flash.
- As a player who prefers reduced motion or whose device dropped to a lower tier, I want these new
  effects replaced by their pinned reduced/quality variants without breaking the accepted feedback
  (coin popup, banner, reticle, cursor, lootbox reveal) and without any screen shake.

## Scope decision

Three pillars, one visual pass, no gameplay change:

- **Pillar A — little impact explosion.** Extend the existing `impact-effects.ts` module with two
  pooled drawables beside the untouched `impact-shards` layer: a 6-instance additive white-hot core
  (`impact-flash`) growing 0.18 → 0.55 world units over 60 ms, and one additive `Points` pool
  (`impact-burst`, cap 72) carrying 8 amber/white embers (380 ms) plus 4 warm-grey smoke-haze points
  (480 ms) per pop at high tier. At the front face's distance the core's 0.55 world units are ≈45 px
  at 1280×720 — the observed pop core's size, not the removed 90–160 px rays, 6 gold coin discs or
  350 px ring. Medium halves the particle counts; low and reduced motion suppress the explosion.
- **Pillar B — mini-cube destroy.** The clicked mini-cube instance itself gets a 140 ms local destroy:
  on the impact frame it brightens to 3× (a hot green-white flash), swells to 1.08× over 30 ms, then
  collapses to zero over the next 110 ms with an accelerating ease-in; the id is hidden/unpickable
  on the same frame, and the tile is fully zero-scaled at 140 ms. This supersedes the predecessor's
  same-frame zero-scale (AC-36) but keeps its intent: no whole-cube burst, no screen shake, the cube
  disappears promptly. Remote `miniCubeRemoved` broadcasts animate identically; roster hydration and
  reconnection snapshots stay instant.
- **Pillar C — realistic shot.** Keep `SHOT_TRAVEL_MS = 180` and the linear muzzle-to-target travel.
  Replace the yellow sphere with a 0.55 × 0.07 world-unit additive cone/bolt (`shot-bolt`) aligned to
  the travel direction, add an 80 ms additive muzzle flash at the ship's nose (`shot-muzzle-flash`,
  0.22 world units, 1 → 1.4 scale), and add a 120 ms / 0.12-local-unit recoil-and-settle on the ship
  model (never the camera or HUD). The hit flash is Pillar A's white core. Reduced motion keeps the
  accepted no-shot path; low tier keeps the bolt but suppresses the muzzle flash/recoil.

**Preserved:** green shard debris (14/7/0, same geometry/physics/lifetime), gold spark particles
(24/12/0), coin `+0.10` popup, level banner and fly-by, reticle, cursor ship bank/pitch/idle/trail/
ignition, lootbox reveal, no gold ray fan/coins/ring, no screen shake, adaptive high/medium/low
policy, reduced motion, and the 180 ms shot timing.

## Provenance against the reference video

The reference (spaceship-cursor-loot-animations `video-analysis.md` §4.3, `frame-1.500.png`) shows a
massive gold pop: 12 tapered 90–160 px rays, 4–6 coin discs, a 70→350 px ring and 10–14 green shards.
The predecessor feature deliberately removed the rays/coins/ring. This feature does not restore any
of them; it borrows only the observed white-hot core's scale (≈20→45 px in ≈80 ms) and reuses it as
a 0.18→0.55 world-unit (≈15→45 px at the front face) local flash. The reference ship is static and
never fires (§4.9); the shot, muzzle flash and recoil are `[E]` extrapolations from the game's own
accepted 180 ms shot, not observed beats. The reference cube vanishes in one frame; the 140 ms
destroy is an explicit user-requested deviation from that observation, confined to the clicked tile.

## Relationship to predecessor features

This feature refines the accepted `particle-only-click-effects` (spec r2) state on top of
`spaceship-cursor-loot-animations` (spec r4). It explicitly supersedes:

| Predecessor criterion | Disposition |
| --- | --- |
| `spaceship-cursor-loot-animations` AC-36 — instant cube conceal | **Superseded.** The tile is hidden/unpickable on the impact frame but visually flashes and collapses for 140 ms; it is zero-scaled at 140 ms, not on the same frame. No whole-cube burst, no screen shake. Reduced motion keeps the instant zero-scale. |
| `spaceship-cursor-loot-animations` AC-37 — pop impact rays/debris/coins | **Remains superseded** by particle-only; no ray/coin/ring is restored. The green shard layer stays exactly 14/7/0 with its pinned physics. |
| `spaceship-cursor-loot-animations` AC-42 — cursor has no muzzle/recoil/press | **Superseded** for the shot reaction only: a 80 ms muzzle flash and a 120 ms/0.12-local recoil are added. Bank/pitch, trail, idle bob, equip pulse, plume flicker and press scale (still absent) are unchanged. |
| `spaceship-cursor-loot-animations` AC-6 — shots preserved | **Superseded in presentation only.** `SHOT_TRAVEL_MS = 180`, linear travel, endpoint capture and removal on arrival remain; the sphere becomes a tapered bolt, `Shot.muzzle` is added, and the muzzle flash/recoil are new. |
| `spaceship-cursor-loot-animations` AC-47 — motion performance accounting | **Superseded in accounting.** The current 133-object baseline becomes 135; the new pools and worst-case draw/triangle deltas are pinned in AC-8; frame-time, tier recovery and bundle bars remain. |
| `spaceship-cursor-loot-animations` AC-48 — reduced-motion coverage | **Extended.** Every new layer is off under reduced motion: instant conceal, no explosion, no shot (unchanged scene path), no muzzle/recoil. Existing variants are retained. |
| `spaceship-cursor-loot-animations` AC-52 — adaptive quality matrix | **Superseded in its impact/shot rows.** Adds `explosionFlash` 1/1/0, `explosionEmbers` 8/4/0, `explosionSmoke` 4/2/0, `shotFx` true/true/false; low keeps the destroy collapse but has no impact particles/muzzle. Policy thresholds, cooldowns, hysteresis and recovery are unchanged. |
| `spaceship-cursor-loot-animations` AC-34 — motion tokens | **Extended** with the new durations/counts/gains; no existing token value changes. |
| `particle-only-click-effects` AC-1 — impact module is shard-only | **Superseded.** The module now owns exactly three pooled drawables: `impact-shards`, `impact-flash`, `impact-burst`, with the shard contract unchanged. |
| `particle-only-click-effects` AC-2 — quality matrix shards + sparks only | **Superseded** by the new matrix in AC-2. |
| `particle-only-click-effects` AC-3 — scene spawns no gold drawables | **Extended.** Still no gold ray/coin/ring object; new names/quantities are pinned in AC-7. |
| `particle-only-click-effects` AC-5 — 133-object/draw budget | **Superseded.** 135 objects, new pools and draw means pinned in AC-8. |
| `particle-only-click-effects` AC-6 — visual evidence | **Superseded** by the new visual matrix in AC-9; the preserved-behaviour checks carry forward. |
| `particle-only-click-effects` AC-7 — README wording | **Superseded in the click sentence only.** The retired "vanishes on the same frame" statement is removed; the required `green shard debris`, `spark particles`, `no click ray fan`, `granular spaceship parts` and `detailed blue/orange hero spaceship` phrases remain. |

The predecessor specs, plans, tasks and evidence remain historical records and are not rewritten.

## Acceptance criteria

Verification notes: "frontend" = `src/frontend`. All tests use concrete expected values; no wildcard
matchers, snapshot-only or assertion-free tests. Commands (from `AGENTS.md`): `npm run lint`,
`npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/functions/lines per
workspace), `npm run build`.

- **AC-1 — Motion vocabulary.** `src/frontend/src/game/motion.ts` `MOTION` adds exactly these
  keys/values and changes no existing value:
  `miniCubeDestroyMs: 140`, `miniCubeDestroyGrowMs: 30`, `miniCubeDestroyPeakScale: 1.08`,
  `miniCubeDestroyFlashMs: 90`, `miniCubeDestroyFlashGain: 3`, `impactFlashMs: 140`,
  `impactFlashGrowMs: 60`, `impactEmberCount: 8`, `impactEmberLifetimeMs: 380`,
  `impactSmokeCount: 4`, `impactSmokeLifetimeMs: 480`, `shotMuzzleFlashMs: 80`,
  `shotRecoilMs: 120`, `shotRecoilDistance: 0.12`. `motion.test.ts` pins the exact `MOTION` object
  and the headline sums (`impactFlashGrowMs < impactFlashMs`, `miniCubeDestroyGrowMs <
  miniCubeDestroyMs`, `shotRecoilMs > shotMuzzleFlashMs`). Evidence: `motion.test.ts`.

- **AC-2 — Adaptive quality matrix.** `src/frontend/src/render/quality.ts` exports these four
  constants with exactly these values (all existing exports and `QualityFeatures` fields remain):
  `QUALITY_EXPLOSION_FLASH_COUNTS === { high: 1, medium: 1, low: 0 }`,
  `QUALITY_EXPLOSION_EMBER_COUNTS === { high: 8, medium: 4, low: 0 }`,
  `QUALITY_EXPLOSION_SMOKE_COUNTS === { high: 4, medium: 2, low: 0 }` and
  `QUALITY_SHOT_FX === { high: true, medium: true, low: false }`.
  `QualityFeatures` adds `explosionFlash`, `explosionEmbers`, `explosionSmoke` and `shotFx`.
  `qualityFeatures('high', false)` has `explosionFlash 1`, `explosionEmbers 8`, `explosionSmoke 4`,
  `shotFx true`; medium `1/4/2/true`; low `0/0/0/false`; every `(tier, true)` has `0/0/0/false`.
  All previously pinned fields keep their accepted values. `createQualityPolicy`, every threshold,
  stable-frame count, cooldown, hysteresis and recovery value, and the existing policy tests are
  unchanged. Evidence: `quality.test.ts`.

- **AC-3 — Little explosion module.** `src/frontend/src/render/impact-effects.ts`
  `createImpactEffects(random).group` has exactly three children in this order:
  `impact-shards` (unchanged: 42-cap `InstancedMesh`, `BoxGeometry(0.09, 0.09, 0.09)`,
  `MeshStandardMaterial` colour `0x44cc88`, 14 per default pop, speed 1.8–3.6, drag `exp(-2 s⁻¹)`,
  gravity 6, angular 3–8 rad/s, lifetime 1200 ms, oldest-first recycling),
  `impact-flash` and `impact-burst`.
  `impact-flash` is one `InstancedMesh` of a prebuilt `OctahedronGeometry(0.5, 0)` (8 triangles;
  radius 0.5 base geometry, so the peak instance scale 0.55 yields a 0.55 world-unit diameter — the
  measured 42–44 px at 1280×720),
  `IMPACT_FLASH_POOL_CAP === 6`, additive `MeshBasicMaterial` colour `IMPACT_FLASH_COLOR = 0xfff2dc`
  (warm white, transparent, `depthWrite: false`, `depthTest: false`, `toneMapped: false`),
  `frustumCulled = false`, `renderOrder = 10`, and an `InstancedBufferAttribute` assigned to
  `mesh.instanceColor` as the per-instance brightness channel (r = g = b). One flash starts at
  `origin + normal · 0.02`, scale
  `IMPACT_FLASH_START_SCALE = 0.18 → IMPACT_FLASH_PEAK_SCALE = 0.55` over
  `impactFlashGrowMs = 60` with `easeOutCubic`, holds scale from 60–80 ms at brightness 1, fades its
  additive brightness linearly to 0 over 80–140 ms, then releases; the oldest flash recycles at 6.
  The amber/orange flash read comes from the ember points, not a hue shift of the white core.
  `impact-burst` is one `Points` with `IMPACT_BURST_POOL_CAP === 72`, position + colour attributes,
  `drawRange`, `PointsMaterial` (`0xffffff`, `size = 0.12`, `sizeAttenuation: true`, vertex colours,
  additive, `depthWrite: false`, `depthTest: false`, `toneMapped: false`), `frustumCulled = false`,
  `renderOrder = 10`. One high-tier pop starts `impactEmberCount = 8` embers (speed 0.8–1.8,
  direction `normalize(randomUnit + normal · 1.5)`, drag `3 s⁻¹`, gravity 1.5 downward, lifetime 380
  ms, colour `0xff9a3c` except every 4th point `0xffe7c4`) and `impactSmokeCount = 4` smoke-haze
  points (speed 0.2–0.5, random direction times speed plus a constant +0.25 world/s upward bias
  (no acceleration or gravity), lifetime 480 ms, colour `0x8a7f72` at 0.45 brightness); all fade to
  black (additive) over their lifetime and recycle oldest-first at 72.
  `ImpactFeatures` is `{ shards, flash, embers, smoke }`, default `{ 14, 0, 0, 0 }`, merged on
  `setFeatures` and clamped to `[0, 14]`, `[0, 6]`, `[0, 8]`, `[0, 4]` (non-finite → 0).
  `spawnPop(origin, normal, nowMs)` consumes random draws in the pinned order: shards exactly as
  before (direction 3, speed 1, axis 3, angular 1 per shard), then per ember/smoke point
  direction 3 and speed 1. `activeCounts()` returns `{ shards, flash, points }`, where `points` is
  the live ember + smoke count. `update(dtMs)` ages all three pools; `dispose()` releases the three
  geometries and three materials exactly once, empties the group and is idempotent. No object,
  geometry or material named or shaped as `impact-rays`, `impact-coins` or `impact-ring` exists; no
  `ConeGeometry`, `CylinderGeometry`, `RingGeometry` or merged geometry is imported by the module.
  No new drawable, geometry or material is created after construction and the pools allocate nothing
  per frame; the unchanged shard pool's per-spawn scratch vectors (`base.clone()`, `new Vector3()`,
  `direction.clone()`) are accepted and explicitly exempt. Evidence: `impact-effects.test.ts`.

- **AC-4 — Mini-cube destroy.** `src/frontend/src/game/effects.ts` sets
  `MINI_CUBE_POP_MS === 140` (from `MOTION.miniCubeDestroyMs`) and exports pure
  `miniCubeDestroyScaleAt(elapsedMs)` and `miniCubeDestroyBrightnessAt(elapsedMs)`.
  `miniCubeDestroyScaleAt`: `t < 0 → 1`; `0 ≤ t < 30 → 1 + 0.08 · easeOutCubic(t / 30)`; `30 ≤ t <
  140 → 1.08 · (1 − easeOutQuad((t − 30) / 110))`; `t ≥ 140 → 0`; pinned samples `0 → 1`,
  `15 → 1.07`, `30 → 1.08`, `85 → 0.27`, `140 → 0`. `miniCubeDestroyBrightnessAt`: `t < 0 → 1`
  (not yet started: an idle tile is unflashed; live records start at `t = 0`); `0 ≤ t < 90 → 1 +
  2 · (1 − t / 90)`; `t ≥ 90 → 1`; pinned samples `0 → 3`, `45 → 2`, `90 → 1`, `140 → 1`.
  `CubeView.hideMiniCube(id, instant = false)` validates the id first, marks it hidden/unpickable on
  the same frame, is idempotent, and: with `instant === true` zero-scales the instance immediately
  and leaves its colour at 1 (reduced motion and roster hydration); with `instant === false` writes
  brightness 3 on the hide frame, records the destroy, and `update(dtMs)` advances it through the
  pinned scale/brightness curves, writing the matrix and `instanceColor` each frame; at
  `elapsedMs ≥ 140` it zero-scales, restores colour 1 and drops the record. `settlePops()`
  zero-scales every live record and restores colour 1 immediately; `removeFace` drops that face's
  records; `dispose` clears them. At most `gridSize² × 6` (150 at the default 5×5) records exist;
  `mesh.count` stays 25; no new three.js object is created and the only writes are the existing
  instance matrix/colour buffers. Evidence: `cube-view.test.ts`, `effects.test.ts`.

- **AC-5 — Remote cube parity.** `src/frontend/src/render/world.ts` applies a `miniCubeRemoved`
  broadcast through the animating `hideMiniCube(id)` path (140 ms destroy, no restart on a duplicate
  id, burst unchanged); a roster snapshot's `removedIds` still uses `hideMiniCube(id, true)` and is
  zero-scaled immediately (no animation replay on join/reconnect). A cleared face's countdown and
  detachment are unchanged, and `removeFace` still drops the face's geometries/materials exactly
  once. The world view adds no new drawable/object. Evidence: `world.test.ts`.

- **AC-6 — Realistic shot.** `SHOT_TRAVEL_MS === 180`. `spawnShot(start, target)` keeps `Shot.start`
  as the ship anchor passed by the scene, adds `Shot.muzzle = start + rotate(group.quaternion,
  (0, 0, SHOT_MUZZLE_OFFSET = 0.78))`, keeps `Shot.target` and `Shot.remainingMs`, and places the
  bolt mesh at `muzzle`. The bolt is a shared prebuilt `ConeGeometry(0.07, 0.55, 6)` rotated so its
  tip is local `+z` (12 triangles), named `shot-bolt`, additive `MeshBasicMaterial` colour
  `0xfff1c8` (`transparent`, `opacity 0.95`, `depthWrite: false`, `toneMapped: false`), oriented to
  the travel direction; travel stays linear `muzzle → target` over 180 ms and the shot is removed on
  arrival. Each shot also creates one `shot-muzzle-flash` mesh (shared `OctahedronGeometry(0.22, 0)`,
  additive `0xffd27a`) at the muzzle, lifetime `shotMuzzleFlashMs = 80`, scale
  `1 → 1.4` over 80 ms with `easeOutCubic`, opacity `0.9 → 0`, removed at 80 ms; at most two are
  live at 10 clicks/s and each is one transient draw. `shotRecoilOffsetAt(elapsedMs)` returns
  `-shotRecoilDistance · (1 − easeOutCubic(clamp01(elapsedMs / shotRecoilMs)))` for
  `0 ≤ elapsedMs < 120` and 0 otherwise (`0 → -0.12`, `60 → -0.015`, `120 → 0`); the ship applies it
  to `model.group.position.z` while a recoil is active, so the outer group, camera and HUD never
  move. `setShotFxEnabled(false)` suppresses muzzle flashes and recoil and clears live flashes; the
  bolt keeps travelling. The ship ignores muzzle/recoil when its last `update` was reduced-motion.
  `getMuzzleFlashCount()` and `getRecoilOffset()` expose the live values for tests. `spaceship.test.ts`
  proves a cancelled/settled recoil and a shot draw equal to the accepted one per in-flight shot.
  Evidence: `spaceship.test.ts`, `scene-spaceship.test.ts`.

- **AC-7 — Scene integration.** With the high-tier matrix wired, a deferred click (`front:0:0`,
  `SHOT_TRAVEL_MS = 180`) yields `impact-shards.count === 14`, spark `drawRange.count === 24`,
  `impact-flash.count === 1` and `impact-burst` `drawRange.count === 12` on the impact frame; medium
  yields `7 / 12 / 1 / 6`; low yields `0 / 0 / 0 / 0`; reduced motion yields `0 / 0 / 0 / 0`, hides
  the tile with `instanceScale === [0, 0, 0]` on the click frame and spawns no shot. On the normal
  path the tile is hidden/unpickable on the impact frame with scale 1 and brightness 3, is between 0
  and 1 at +70 ms and is `[0, 0, 0]` with brightness 1 at +140 ms. The shot fires with one muzzle
  flash, a negative recoil offset and `shot.muzzle.z === 6.78` at rest; by 80 ms the muzzle flash
  count is 0 and by 120 ms the recoil offset is 0; the shot arrives at 180 ms. The camera
  position/quaternion is identical before and after the whole sequence. HUD no-shake/no-layout-shift
  evidence is owned by the unchanged `Hud.test.tsx`, `App.test.tsx` and `game-view.css.test.ts`
  assertions (a scene unit test cannot observe the DOM HUD); `scene-effects.test.ts` covers the
  camera only. No scene object is named `impact-rays`, `impact-coins` or `impact-ring`; the
  `impact-effects` group has exactly `impact-shards`, `impact-flash`, `impact-burst`. The preserved
  suites — coin popup `+0.10`, level burst/banner/fly-by, reticle, cursor ship, lootbox reveal,
  reduced motion — stay green without weakened assertions. Evidence: `scene-effects.test.ts` (new),
  `scene.test.ts`, `scene-spaceship.test.ts`, `Hud.test.tsx`, `App.test.tsx`, `game-view.css.test.ts`.

- **AC-8 — Object, draw, triangle and frame budget.** `countObjects(scene)` is **135**,
  decomposed as **65 pre-backdrop objects** (including the four-object impact group: group +
  `impact-shards` + `impact-flash` + `impact-burst`) + **70 cosmic-backdrop objects**; scene children
  stay 9 (10 with a remote world). The spaceship group stays 34 objects; `shotsGroup` is 1 object at
  idle; shots and muzzle flashes are transient. Worst-case live pools are 42 shards, 72 spark points,
  6 flash instances, 72 impact-burst points, 2 muzzle flashes, at most 2 in-flight shots at 10 clicks/s
  and at most 150 destroy records; no new drawable, geometry or material is created after
  construction, the pools allocate nothing per frame (the unchanged shard pool's per-spawn scratch
  vectors are exempt), and every pool recycles oldest-first. Triangle deltas: +48 static
  (6-octahedron flash pool), +8 per live muzzle flash, and the 12-triangle bolt replaces the
  ≈112-triangle 8×8 sphere (net −100 per in-flight shot). Draw deltas versus the accepted
  particle-only state: idle 0; worst-case +3 (flash + burst + one muzzle flash); the true mean delta
  during a 10 clicks/s trace is **+2.8** at high/medium (both impact pools live almost continuously =
  +2.0, plus the 80 ms muzzle flash at a 100 ms click interval = **+0.8**) and **0** at low (no
  explosion/muzzle); the bolt replaces the old shot draw one-for-one. In the local environment, three
  clean 10-second click traces at 10 clicks/second per size — same single-member guest world, same
  harness, fresh page, with the remote-world object count recorded per run — report median mean draw
  calls at high ≤ **221.0** (1280×720) and ≤ **220.0** (1920×1080), medium ≤ **207.0 / 207.0**, low
  ≤ **205.0 / 202.0**. These bars are the worst accepted predecessor trace per size/tier (high
  215.54/214.15, medium 201.40/201.24, low 201.79/197.94 — the larger of the builder median and the
  independent rerun) plus the +2.8 effect mean at high/medium (0 at low) plus a documented 2.6–4.1
  draw run-to-run margin; the observed 1280 high spread is 4.30 draws across individual runs, while
  the acceptance statistic is the median of three. Every tier's p95 is ≤ 33 ms and every high run's
  average is ≤ 16.7 ms for the median and at least two of three runs; a forced-low run recovers to
  high after the pinned stable window. Idle draw medians remain within ±1.5 of the accepted
  168.05/168.17. `npm run build` exits 0 and initial JS gzip is ≤ **279 KB** (accepted 270.51 KB).
  Evidence: build log traces and accounting.

- **AC-9 — Visual evidence and manual check.** At 1280×720 and 1920×1080, screencast frames with
  measured millisecond timestamps show: a muzzle flash at the ship's nose 20–60 ms after the click; a
  glowing bolt in flight 90–150 ms; the impact/destroy start at 180–220 ms (tile brightened/swollen,
  white core and first embers); the core peak at 240–280 ms (core ≈45 px at 1280×720); the tile fully
  gone with embers/smoke/shards at **320–340 ms** (the destroy ends at 180 + 140 = 320 ms); smoke
  visible and fading at **420–480 ms**, gone by **660 ms** (impact 180 + 480). No frame shows a gold
  ray fan, gold coin glyph, ring or satellite ring; green shards and gold sparks remain visible. The
  same pass records the reduced-motion click at 120 and 360 ms (no shot, instant conceal, no
  explosion/shards/sparks) and confirms the preserved coin `+0.10`, reticle, cursor ship, banner/
  fly-by and no screen shake. Before/after uses the accepted particle-only frames
  `t2-click-shot-0162ms-1280x720.png` / `t2-click-no-gold-shards-0312ms-1280x720.png` (and the 1920
  pair) as "before"; evidence lives under `docs/features/small-destruction-shot-fx/evidence/` and is
  mapped in the build log. Evidence: build-log-T3.md and the evidence files.

- **AC-10 — Documentation.** `README.md` keeps the exact phrases `green shard debris`,
  `spark particles`, `no click ray fan`, `granular spaceship parts` and
  `detailed blue/orange hero spaceship`, removes the retired exact phrase
  `vanishes on the same frame`, and adds the exact phrases `small white-orange impact burst`,
  `collapses over 140 ms` and `glowing tracer bolt with a muzzle flash`. `docs/features/README.md` is
  not edited by this feature: the feature-base guard
  `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md` exits 0 after the
  orchestrator precondition (the accepted predecessor docs/index rows are committed and frozen
  before `BASE_SHA` is recorded; this feature's row is applied only after the guard); the final build
  log records the proposed row for the orchestrator. No `docs/architecture/**` or
  `docs/product/glossary.md` change is required (no stack, container, term or meaning changes); the
  build log states this explicitly. Evidence: README greps, index diff and build-log proposal.

- **AC-11 — No dependency, backend, protocol, container or audio change.** The feature fork-point
  commit `BASE_SHA` is recorded in `build-log-T1.md` before T1 starts (never a vacuous
  `git merge-base main HEAD`) and transcribed in `build-log-T2.md`/`build-log-T3.md`; the gate
  `git diff --exit-code "$BASE_SHA"...HEAD -- src/backend src/frontend/src/multiplayer/protocol.ts
  src/backend/package.json src/frontend/package.json package.json package-lock.json compose.yaml
  compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile` exits 0. No new dependency,
  loader, runtime/game asset, texture, audio or URL is added: the import/URL/loader grep over
  `src/frontend/src/render` and `src/frontend/src/game` (tests excluded) finds none, the
  runtime/game-asset diff over `src/frontend/public` and `src` filtered to
  `png/jpg/jpeg/svg/mp3/wav/glb/gltf` is empty, and no `Audio`/`AudioContext`/`<audio>`/sound file
  exists in the changed surfaces. Evidence screenshots under
  `docs/features/small-destruction-shot-fx/evidence/` are documentation artifacts, not runtime/game
  assets. Evidence: build-log diff gates, grep output and asset diff.

- **AC-12 — Coverage and full gate.** `npm run coverage` exits 0 with ≥ 80%
  statements/branches/functions/lines in both workspaces; every edited/new frontend module is
  included and no exclusion or threshold is changed. `npm run lint`, `npm run typecheck`, `npm test`
  and `npm run build` exit 0. Evidence: final build log.

## Non-goals

- Re-introducing or retaining any part of the removed massive gold explosion: no ray fan, no coin
  discs, no ring/satellites, no screen-filling flash. The little explosion is local to one mini-cube.
- Changing the green shard counts/colour/physics/lifetime/pool or the gold spark counts/colour/
  lifetime/pool.
- Changing the 180 ms shot travel, the click rate, the coin/point economy, the HUD values, or the
  delayed impact timing.
- Changing the coin `+0.10` popup, the level-complete burst/banner, the fly-by, the reticle, the
  cursor ship's bank/pitch/idle/trail/equip pulse/plume flicker, or the lootbox reveal.
- Changing the adaptive quality policy thresholds, stable-frame counts, cooldowns, hysteresis or
  recovery; adding a user-facing quality/particle setting.
- Changing reduced-motion variants other than adding the pinned new-layer variants.
- Audio, music, sound effects or any audio alignment work (default none; Q-4).
- Any backend, protocol, lootbox, inventory, persistence, authentication or multiplayer authority
  change; connection lifecycle/reconnection is unaffected.
- Any container, compose, Dockerfile, port, environment-variable, health-signal or WebSocket-endpoint
  change.
- Adding a dependency, a runtime/game asset, a loader, a texture, a post-processing pass or an
  external URL. The evidence screenshots are documentation artifacts.
- Rewriting the accepted predecessor specs/plans/tasks, video analysis or reference frames; the
  supersession table is the authoritative record.
- Pruning the unused predecessor `MOTION` ray/coin/shockwave tokens (still a deferred cleanup).

## Boundaries

- ✅ Always: run lint, typecheck, frontend tests, coverage and build; keep the change to the owned
  frontend render/game files and their tests; keep assertions concrete; preserve reduced motion,
  no-shake and the quality policy; pool and recycle every new effect; record raw output, frame
  timestamps and measured draw/frame data in the build logs; update `README.md` in the same change.
- ⚠️ Ask first: changing the pinned durations, counts, palette, scale envelopes or recoil distance;
  changing `SHOT_TRAVEL_MS`; restoring any ray/coin/ring; adding audio or a dependency; changing the
  low-tier matrix; editing files outside the task inventory; editing predecessor artifacts.
- 🚫 Never: add screen shake or camera/HUD displacement; add per-frame allocations or per-spawn
  geometry/material; weaken assertions (wildcard matchers, snapshot-only or assertion-free tests) or
  exclude production code from coverage; touch backend/protocol/lootbox/inventory/persistence code;
  edit `.env*`, lockfiles, compose files or Dockerfiles; rewrite an accepted spec to match new
  behaviour; `git push`.

## Security considerations

- Presentation-only: the feature consumes no user-controlled data, writes no persistence, adds no
  client-side secret and makes no network request. All randomness comes from the existing injected
  `random` source; no `Math.random` is added to a testable path.
- The new pools are bounded (6 flash, 72 points, transient shots/flashes) and recycle oldest-first,
  so a click flood cannot grow memory or draw count without bound.
- No dependency, loader or runtime asset is added, so the supply-chain and bundle surface does not
  grow. Remote cube animation derives only from already-validated server broadcasts.

## Real-time, multi-client and containerization impact

- **Real-time/multi-client:** explicitly local presentation. The server remains the sole authority
  for which mini-cubes are removed; this feature does not touch WebSocket connection lifecycle,
  reconnection, state sync, accounts or identity. Every client animates its own copy of a broadcast
  `miniCubeRemoved` from the same build; roster hydration and reconnection use the instant path so no
  historical animation is replayed. No shared value is computed client-side.
- **Identity vs. "no accounts":** not applicable; no identity surface is touched.
- **Containerization:** explicitly out of scope per `docs/architecture/containerization.md`. The
  feature adds no service, image, port, environment variable, health signal, compose entry, Dockerfile
  or WebSocket endpoint. `podman compose up` / `npm run dev` remains the local-run path for the manual
  visual/perf check; container assets are unchanged (AC-11). `npm run smoke` is not required because
  no cross-service, backend, protocol or container behaviour changes.

## Testing strategy

- **Unit (per module):** `motion.test.ts` pins the new tokens and unchanged values;
  `effects.test.ts` pins `MINI_CUBE_POP_MS = 140` and the exact destroy scale/brightness tables;
  `quality.test.ts` pins the new constants and exact high/medium/low/reduced matrices plus unchanged
  policy behaviour; `impact-effects.test.ts` pins the three drawables, caps, counts, palette,
  lifetimes, recycle, draw order, `activeCounts`, no-gold geometry/names, no post-construction
  drawable/geometry/material and idempotent dispose; `cube-view.test.ts` pins the 140 ms timeline,
  immediate hidden/pickable
  state, instant path, `settlePops`, face-removal record drop, 150-record ceiling and untouched
  neighbour instances; `spaceship.test.ts` pins the 180 ms travel, muzzle offset, bolt geometry/
  material, muzzle-flash envelope/removal, recoil table, `setShotFxEnabled`, reduced suppression and
  dispose. All assertions are concrete expected values.
- **Integration (real boundaries):** `scene.test.ts` pins the 135-object baseline (65 + 70), 9 scene
  children, the impact-start/mid/zero destroy timeline, the reduced instant path, 10-cycle pool reuse
  and the remote broadcast timeline; `world.test.ts` pins animate-on-broadcast vs instant-on-roster,
  duplicate no-restart and unchanged burst/face behaviour; `scene-spaceship.test.ts` pins the
  three-child impact group, shot muzzle/travel through `SceneView`, muzzle-flash lifetime and camera
  equality; the new `scene-effects.test.ts` pins the wired tier matrix (14/24/1/12 high,
  7/12/1/6 medium, 0/0/0/0 low/reduced), the destroy timeline through the scene, the shot/recoil
  sequence, no-gold names and camera equality. HUD no-shake/no-layout-shift is covered by the
  unchanged `Hud.test.tsx`/`App.test.tsx`/`game-view.css.test.ts` suites, which also prove the
  preserved behaviours with the unchanged `LevelCompleteBanner`/`cursor-ship`/`targeting`/
  `SpaceshipCustomizationPanel` suites.
- **Manual / visual-perf:** `podman compose up` (or `npm run dev`) at 1280×720 and 1920×1080; the
  AC-9 frame windows with measured timestamps, a reduced-motion click, the preserved-behaviour
  checks, and three clean 10-second high/medium/low traces plus a forced-low→high recovery run at
  both sizes. `npm run smoke` is not required (no cross-service behaviour).
- **Coverage:** `npm run coverage` — ≥ 80% statements, branches, functions and lines per workspace
  (both must pass). Per-task pre-gates may use
  `npm run coverage --workspace @cubeclicker/frontend`; the final task runs the full command.
- **Verification commands:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`,
  `npm run build`; plus the AC-11 fork-point diff/import/asset/audio gates and the AC-10 README/
  index guards.

## Open questions

Q-1, Q-2 and Q-3 are **accepted defaults** (orchestrator decision, 2026-11-11); the alternatives are
recorded for traceability and do not block building. Q-4…Q-7 are defaults retained as documented
product choices; they do not block building.

- **Q-1 — Destroy behaviour (ACCEPTED DEFAULT).** The clicked tile itself brightens 3×, swells to
  1.08× for 30 ms and collapses to zero over the next 110 ms (visible total 140 ms; unpickable from
  the impact frame). This supersedes the accepted same-frame conceal. The recorded alternative (keep
  the instant conceal and play a 140 ms ghost-afterimage at the tile position, one extra pooled
  drawable) is not built.
- **Q-2 — Shot form (ACCEPTED DEFAULT).** A glowing tapered bolt (0.55 × 0.07 world) with a muzzle
  flash and a 120 ms/0.12-local recoil; the 180 ms travel is preserved. The recorded tracer line/beam
  alternative and other recoil magnitudes are not built.
- **Q-3 — Explosion palette/size (ACCEPTED DEFAULT).** A warm-white core (`IMPACT_FLASH_COLOR =
  0xfff2dc`) with scalar brightness, amber/white embers `0xff9a3c`/`0xffe7c4`, and a warm-grey smoke
  haze `0x8a7f72`; core 0.18 → 0.55 world (≈45 px at the front face), 12 points per high-tier pop.
  The 0.45 world/8-point reduction and a darker normal-blended smoke layer are recorded fallbacks,
  not built.
- **Q-4 — Audio (default).** None. The reference aligns audio transients with pops and the banner, but
  this feature ships no audio asset, dependency or playback code.
- **Q-5 — Green shards (default).** Keep the accepted 14/7/0 green shard debris alongside the new
  explosion (the user asked to preserve it). Removing/reducing it is a follow-up, not part of this
  feature.
- **Q-6 — Low-tier consequence (default).** Low keeps the 140 ms destroy collapse and the bolt but
  suppresses explosion particles and the muzzle flash/recoil; this replaces the particle-only
  "no impact visual at all" consequence. A minimum low-tier explosion would need explicit approval.
- **Q-7 — Smoke blending (default).** One additive Points pool (one draw) with a warm-grey haze. A
  darker, normal-blended smoke layer would add one drawable; the additive haze is the shipped choice.

## Assumptions

- "Little explosions" means a per-hit, local burst at the clicked mini-cube, not level-complete
  fireworks or a restored version of the removed massive gold explosion.
- "A minicube effect of destroy" means the clicked tile itself, not the whole cube or the face.
- "More realistic shot effect" is a visual change only; the accepted 180 ms shot travel and delayed
  impact timing stay so click pacing is unchanged.
- The previous no-massive-gold-explosion decision remains binding; amber/orange embers are not a
  reintroduction of the gold ray/coin/ring explosion.
- No audio is required by this request.
- The local containerized environment and the existing headless-browser capture harness are
  available for the visual/perf evidence, and the predecessor evidence frames are the "before".
- The accepted particle-only state (133 objects, 42 shards, 72 sparks, 24/12/0 sparks) is the
  baseline this feature measures against.

## Review r1 disposition (F1–F11)

All eleven findings are fixed; none is rebutted. Dispositions dated 2026-11-11.

| # | Severity | Disposition | Change |
| --- | --- | --- | --- |
| F1 | MAJOR | Fixed | AC-8 click bars re-based on the worst accepted predecessor trace per size/tier (high 215.54/214.15, medium 201.40/201.24, low 201.79/197.94 — the larger of the builder median and independent rerun) plus the true effect mean (+2.8 high/medium, 0 low) plus a 2.6–4.1-draw run-to-run margin: high ≤ 221.0/220.0, medium ≤ 207.0/207.0, low ≤ 205.0/202.0. The trace environment is pinned (single-member guest world, same harness, fresh page, three clean runs, remote-world object count recorded). |
| F2 | MINOR | Fixed | The muzzle-flash mean is corrected to +0.8 (80 ms live per 100 ms click interval) and the total mean delta to ≈ +2.8; the spec's +3 worst case is unchanged. Plan draw accounting aligned. |
| F3 | MINOR | Fixed | Wording is now "no new drawable, geometry or material after construction and no per-frame allocations"; the unchanged shard pool's per-spawn scratch vectors (`base.clone()`, `new Vector3()`, `direction.clone()`) are explicitly exempt. T2's test asserts children/geometry/material identities and per-frame allocation freedom, not every JS object. |
| F4 | MINOR | Fixed | AC-7 keeps camera equality in `scene-effects.test.ts` and assigns HUD no-shake/no-layout-shift evidence to the unchanged `Hud.test.tsx`, `App.test.tsx` and `game-view.css.test.ts` assertions; T3 explicitly forbids a HUD assertion in the scene test. |
| F5 | MINOR | Fixed | AC-9 windows now read "tile fully gone 320–340 ms (180 + 140)" and "smoke visible/fading 420–480 ms, gone by 660 ms (180 + 480)"; plan/tasks aligned. |
| F6 | MINOR | Fixed | AC-2 now says "exports these four constants with exactly these values (all existing exports and `QualityFeatures` fields remain)", not that the module exports only them. |
| F7 | MINOR | Fixed | Smoke motion is one formula in spec, plan and test: `direction · speed` plus a constant `+0.25` world/s upward bias applied at spawn, with no per-frame acceleration or gravity. |
| F8 | MINOR | Fixed | T3's commit is `feat: wire the destruction and shot effects` (an optional separate `docs:` commit for README/index); the task's behavior-change nature is explicit. |
| F9 | MINOR | Fixed | The tolerance rule is scoped to **new** assertions; pre-existing accepted `spaceship.test.ts`/scene tolerances stay and require no rewrite. |
| F10 | MINOR | Fixed | AC-3 names `mesh.instanceColor` as the `InstancedBufferAttribute` per-instance brightness channel (r = g = b). |
| F11 | INFO | Fixed | `miniCubeDestroyBrightnessAt(t < 0)` is now `1` (an idle/not-yet-started tile is unflashed); live records start at 0, so the 0–90 ms curve is unchanged. |

## Revision history

- r1 — 2026-11-11 — initial draft: little impact explosion (white core + ember/smoke haze), 140 ms
  mini-cube destroy on the instance, realistic bolt/muzzle/recoil shot with 180 ms travel preserved;
  new motion/quality tokens; 135-object budget; 3-task plan; no backend/container/audio impact;
  explicit supersession of AC-36/AC-42/AC-47/AC-48/AC-52 and the particle-only module/budget
  criteria.
- r2 — 2026-11-11 — consistency fix: idle draw bar ±1.5; Q-1/Q-2/Q-3 marked accepted defaults; Q-3
  core wording aligned to `IMPACT_FLASH_COLOR = 0xfff2dc` with scalar brightness (amber from the
  embers). No AC behaviour change.
- r3 — 2026-11-11 — spec-review r1 disposition F1–F11 (all fixed): draw bars re-based on worst
  accepted traces + +2.8 effect mean + run-to-run margin; muzzle mean +0.8; shard-allocation
  exemption; HUD evidence ownership; 320/660 ms visual windows; "exports these four constants"
  wording; constant smoke bias; `feat:` commit for T3; new-test tolerance scope; `instanceColor`
  named; pre-start brightness 1. Three pillars, accepted Q-1/Q-2/Q-3 defaults, T1 → T2 → T3 and all
  budgets/supersessions retained.
- r4 — 2026-11-12 — AC-3 correction: `impact-flash` geometry `OctahedronGeometry(0.5, 0)` (radius 0.5,
  peak instance scale 0.55 → 0.55 world-unit diameter, 42–44 px at 1280×720); no other AC/plan/task
  change.
