---
feature: particle-only-click-effects
revision: 2
---

# Plan — Particle-only click effects

## Architecture

**State ownership.** No state changes hands. The click impact is a presentation-only render adapter:

| State | Owner | Lifetime |
| --- | --- | --- |
| Impact shard pool (42 records, 14 per default pop) | `render/impact-effects.ts` | Per client/frame |
| Spark burst pool (72 fragments, 24 per default pop) | `render/particles.ts` (unchanged) | Per client/frame |
| Shard/spark counts per tier | `render/quality.ts` `qualityFeatures` | Build-time constants |
| Adaptive tier policy | `render/quality.ts` `createQualityPolicy` | Per client/frame |
| Wiring, object counts, spawn call sites | `render/scene.ts` | Per client/frame |

**Removal.** The impact module currently owns four pools (rays, shards, coins, ring). This feature deletes the ray, coin and ring pools, their geometries/materials/instance-colour attributes, their spawn/update/write paths and their feature flags, leaving the shard pool and its existing physics. `spawnPop(origin, normal, nowMs)` keeps its call sites and now starts only shards (none when the tier/reduced motion suppresses them). `update(dtMs)` ages only shards. The module keeps its name and `createImpactEffects` factory so `scene.ts`, the scene tests and the feature's conceptual "impact debris layer" stay stable.

**Data flow.** Unchanged: `SceneView.applyIntents`/`applyDeferredExplosion` conceals the tile on the same frame, calls `impact.spawnPop(origin, normal, nowMs)` and calls `particles.spawn(intent.burst, origin + normal * 0.5, nowMs)`. `SceneView.applyQuality` computes `qualityFeatures(tier, reducedMotion)` and forwards only `{ shards: features.impactShards }` to the impact pool and `features.sparks` to the particle pool. `SceneView.update` ages both pools. The coin popup, level banner/fly-by, reticle, cursor ship and lootbox reveal paths are not touched.

**Draw/object accounting.**

- Predecessor accepted baseline: 136 scene objects = 66 pre-backdrop objects (including the five-object impact group: group + four drawables) + 70 cosmic-backdrop objects; high-tier net draw growth vs the pre-spaceship baseline was +21 (cursor +15, impact +4, targeting +2).
- New baseline: **133** scene objects = **63 pre-backdrop objects** (including the two-object impact group: group + one shard `InstancedMesh`) + 70 cosmic-backdrop objects; impact contributes **one draw**; high-tier net growth becomes **+18**.
- Worst-case live pools: 42 shards + 72 spark points. Ray fans (3 × 12), coin discs (18) and rings (3) no longer exist.
- The high-tier click trace means should sit near the predecessor medians minus three draws (≈239.5 at 1280×720 and ≈239.7 at 1920×1080); AC-5 requires at least 1.0 below 242.46/242.70 to absorb run noise. Medium/low means are pinned at or below the predecessor T14 medians: medium ≤ 234.12 (1280×720) / ≤ 234.28 (1920×1080); low ≤ 225.45 (1280×720) / ≤ 214.04 (1920×1080); all tiers p95 ≤ 33 ms.

## Interfaces / contracts

### `src/frontend/src/render/impact-effects.ts`

```ts
import type { Group, Vector3 } from 'three';
import { MOTION } from '../game/motion';

/** Active green shards: 42 (MOTION.debrisPoolCap). */
export const DEBRIS_POOL_CAP = MOTION.debrisPoolCap;
/** Maximum shards per pop at high tier: 14 (MOTION.debrisPerPop). */
export const DEBRIS_PER_POP = MOTION.debrisPerPop;

export interface ImpactFeatures {
  /** Shards per pop (0 at low tier and under reduced motion). */
  readonly shards: number;
}

export interface ImpactEffects {
  /** Group holding exactly one `InstancedMesh` named `impact-shards`. */
  readonly group: Group;
  spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void;
  update(dtMs: number): void;
  /** Active shards only; the removed rays/coins/rings have no counter. */
  activeCounts(): { shards: number };
  setFeatures(features: ImpactFeatures): void;
  dispose(): void;
}

export function createImpactEffects(random: () => number): ImpactEffects;
```

- The only child is an `InstancedMesh` with `name = 'impact-shards'`, `instanceMatrix.count = 42`, `count = 0`, `frustumCulled = false`, a `BoxGeometry(0.09, 0.09, 0.09)` and a `MeshStandardMaterial({ color: 0x44cc88, metalness: 0.2, roughness: 0.5 })`.
- `spawnPop` recycles the oldest shard at 42, starts each shard at `origin + normal * 0.02 + direction * 0.05`, and keeps the pinned random draw order: direction (3), speed (1), axis (3), angular speed (1) per shard.
- `setFeatures` clamps `shards` into `[0, 14]` (finite floor; non-finite → 0).
- `update` keeps speed 1.8–3.6, drag `exp(-2 * dt)`, gravity 6, angular 3–8 rad/s and lifetime 1200 ms.
- `dispose` disposes the single geometry and material once, clears the group and is idempotent.
- No `InstancedBufferAttribute`, `ConeGeometry`, `CylinderGeometry`, `RingGeometry`, `mergeGeometries`, `AdditiveBlending`, `DoubleSide`, `MeshBasicMaterial`, `easeOutQuad` or `easeOutQuint` import remains.

### `src/frontend/src/render/quality.ts`

```ts
export const QUALITY_SHARD_COUNTS: Readonly<Record<QualityTier, number>> = {
  high: 14,
  medium: 7,
  low: 0,
};

export const QUALITY_SPARK_COUNTS: Readonly<Record<QualityTier, number>> = {
  high: 24,
  medium: 12,
  low: 0,
};

export interface QualityFeatures {
  readonly tier: QualityTier;
  readonly reticle: boolean;
  readonly trail: boolean;
  readonly cursorMotion: boolean;
  readonly hiddenCursorMeshes: readonly string[];
  readonly cursorMeshCount: number;
  /** Green shards per pop (14/7/0; 0 under reduced motion). */
  readonly impactShards: number;
  /** Spark fragments per explosion (24/12/0; 0 under reduced motion). */
  readonly sparks: number;
  readonly coinPopup: boolean;
  readonly bannerMotion: boolean;
}
```

- `QUALITY_IMPACT_COUNTS`, `impactRays`, `impactCoins` and `shockwaveExpand` are removed. No other exported constant, type, policy threshold, cooldown, hysteresis or recovery value changes.
- `qualityFeatures` computes `impactShards: reducedMotion ? 0 : QUALITY_SHARD_COUNTS[tier]` and keeps `sparks: reducedMotion ? 0 : QUALITY_SPARK_COUNTS[tier]`.

### `src/frontend/src/render/scene.ts`

```ts
impact.setFeatures({ shards: features.impactShards });
particles.setSparkLimit(features.sparks);
```

- `applyExplosion`/`applyDeferredExplosion` keep both `impact.spawnPop(...)` and `particles.spawn(...)` calls; no scene-style change.
- Header comments that describe "impact pools" / four drawables / AC-37/AC-38 are updated to the shard-only wording; no behavior outside quality wiring changes.

## File inventory

| Path | New/Edit | Task | Purpose |
| --- | --- | --- | --- |
| `src/frontend/src/render/impact-effects.ts` | Edit | T1 | Delete ray/coin/ring pools; keep shard pool and physics |
| `src/frontend/src/render/impact-effects.test.ts` | Edit | T1 | Rewrite exact exports, one drawable, shard counts/lifetimes/recycling/dispose |
| `src/frontend/src/render/quality.ts` | Edit | T1 | `QUALITY_SHARD_COUNTS`; remove impact rays/coins/shockwave flags |
| `src/frontend/src/render/quality.test.ts` | Edit | T1 | Exact high/medium/low/reduced matrix and shard/spark counts |
| `src/frontend/src/render/scene.ts` | Edit | T1 | Forward `{ shards }`; update impact comments |
| `src/frontend/src/render/scene.test.ts` | Edit | T1 | 133-object baseline, 9 children, conceal/spark assertions/comments |
| `src/frontend/src/render/scene-spaceship.test.ts` | Edit | T1 | Spawn counts 14/7/0, sparks 24/12/0, no gold pools, one impact child, preserved camera/targeting |
| `README.md` | Edit | T2 | Click-impact wording: green shards + sparks, no rays/coins/ring; keep required phrases |
| `docs/features/particle-only-click-effects/build-log-T1.md` | New | T1 | Raw gate output |
| `docs/features/particle-only-click-effects/build-log-T2.md` | New | T2 | Full gate, traces, visual matrix, index-row proposal |
| `docs/features/particle-only-click-effects/evidence/*` | New | T2 | Before/after click frames at 1280×720 and 1920×1080 |

`src/frontend/src/render/particles.ts`, `game/motion.ts`, `game/effects.ts`, all UI/HUD/banner/panel files, backend sources, protocol files and container assets are not edited.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Reduce `impact-effects.ts` to the shard pool instead of deleting it | Smallest safe change; keeps the pooled-instanced-mesh debris path, scene call sites and tests stable; no new module/API | Delete the module and fold instanced shards into the `Points` particle system (larger change, mixes drawable types, rewrites contracts) |
| 2 | Remove the ring shockwave with the rays and coins | The 310 ms evidence frame shows a large bright-gold ring + four satellites as part of the perceived "massive yellow explosion"; it is not a subtle separate accent | Keep a subtle ring (contradicts the default removal; a one-line follow-up if the user asks) |
| 3 | Keep the green shard debris and the 24-point spark burst | User explicitly wants particles; this is the debris + spark half of the current impact and the only remaining click particles | Remove shards (Q-1 follow-up), remove sparks (contradicts "I want particles") |
| 4 | Keep the module name, `createImpactEffects` factory and `spawnPop` signature | Avoids churn in `scene.ts`, tests and feature terminology; the module's role is still the impact debris layer | Rename to `shard-effects.ts`/`createShardEffects` (larger diff, no user-visible gain) |
| 5 | Keep the `MOTION` ray/coin/shockwave tokens and `easeOutQuad`/`easeOutQuint` | They are part of predecessor AC-34's pinned motion vocabulary; pruning is a separate cleanup with no user-visible effect | Remove unused tokens/easings now (more files, supersedes AC-34) |
| 6 | Keep the low tier at 0 shards + 0 sparks | Preserves the accepted adaptive matrix; low is only reached after sustained frame misses, so normal play keeps particles. After the ring removal a low-tier click has no impact visual at all (the cube still conceals; the coin popup and banner remain) — accepted as Q-3 | Give low a minimum particle presence (matrix change needing approval, Q-3) |
| 7 | Pin the new scene baseline at 133 objects and one impact draw | Objective draw-budget improvement; keeps `countObjects` tests meaningful and records the 3-draw/3-object reduction | Leave the count unpinned (reviewers cannot detect regressions) |
| 8 | Minimal documentation: README click sentence + proposed index row in the build log | Keeps docs accurate without rewriting accepted historical specs; the index stays orchestrator-owned | Rewrite predecessor spec/plan/tasks (historical drift, unnecessary) |
| 9 | No backend/protocol/container change | Purely local presentation; no shared state, service, image, port or endpoint | Any backend/protocol involvement (out of scope) |

## Risks & mitigations

- **The remaining spark burst still reads as "yellow".** Mitigation: the sparks are a small 24-point additive cloud (no rays, coins or ring); the AC-6 manual A/B at ~100 ms and ~310 ms proves the explosion is gone and only particles/debris remain. If the user still objects, recolouring/reducing the spark layer is a follow-up, not a hidden scope change (Q-4).
- **Removing pools breaks scene/quality tests.** Mitigation: T1 owns every consumer and test file in the same task; the full frontend gate (lint/typecheck/test/coverage) must be green before T2. No task leaves a red workspace.
- **Object/draw counts drift.** Mitigation: pin `countObjects(scene) === 133`, one impact child, 14 shards and 24 sparks at high; T2 records forced high/medium/low traces and the ≥1.0-draw improvement over the predecessor medians.
- **Predecessor documentation drift.** Mitigation: README change in T2, supersession table in the spec, index-row proposal recorded for the orchestrator; predecessor historical artifacts are intentionally not rewritten.
- **Performance regression from the particles themselves.** Mitigation: the change only deletes drawables and leaves the existing 72-point spark cap; frame-time and bundle bars are unchanged or stricter (bundle ≤ 273 KB).
- **Test brittleness from exact counts.** Mitigation: counts are intentional contract values (14/7/0 shards, 24/12/0 sparks, 133 objects); no wildcard matchers or snapshot-only assertions.

## Verification

**Feature fork point (`BASE_SHA`).** Before T1's first edit, the builder records the current HEAD as `BASE_SHA=$(git rev-parse HEAD)` in `build-log-T1.md`; T2 transcribes and uses that exact value. Do not use `git merge-base main HEAD` (vacuous when the builder works on `main`). All T2 diff gates compare `"$BASE_SHA"...HEAD`.

**T1 gate (frontend):** `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`. Evidence in `build-log-T1.md`, including `BASE_SHA`.

**T2 precondition (orchestrator-owned index).** The accepted predecessor docs — including the `docs/features/README.md` `spaceship-cursor-loot-animations` row already present in the worktree — must be committed/frozen **before `BASE_SHA` is recorded** (before T1's first edit), so the accepted row is part of the baseline. The orchestrator applies this feature's proposed row only after the T2 guard. Precondition check (before `BASE_SHA` capture, not a T2 pass/fail gate): `test -z "$(git status --porcelain -- docs/features/README.md)"`. If the file is still dirty when T1 starts, T1 is blocked and the orchestrator commits it; the gate compares committed history only.

**T2 final gate (repository):**

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run coverage`
5. `npm run build`
6. Diff gate: `git diff --exit-code "$BASE_SHA"...HEAD -- src/backend src/frontend/src/multiplayer/protocol.ts src/backend/package.json src/frontend/package.json package.json package-lock.json compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile`
7. Import/URL/loader grep (succeeds only when none): `! grep -rnE "GLTFLoader|FileLoader|TextureLoader|fetch\(|https?://" src/frontend/src/render src/frontend/src/game --include=*.ts --include=*.tsx | grep -v '\.test\.'`
8. Runtime/game asset diff (succeeds only when no asset change): `! git diff --name-only "$BASE_SHA"...HEAD -- src/frontend/public src | grep -Ei '\.(png|jpe?g|svg|mp3|wav|glb|gltf)$'`
9. README greps:
   - `grep -n "green shard debris" README.md`
   - `grep -n "spark particles" README.md`
   - `grep -n "no click ray fan" README.md`
   - `! grep -n "rays, shards and coin popups" README.md`
   - `grep -n "granular spaceship parts" README.md`
   - `grep -n "detailed blue/orange hero spaceship" README.md`
10. Index guard (expect no diff): `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md`; record `BASE_SHA` and the empty diff in `build-log-T2.md`.
11. Visual matrix: run `podman compose up` (or `npm run dev`); at 1280×720 and 1920×1080 click a mini-cube and capture frames at 90–180 ms (spark visibility + conceal), optionally 200–250 ms, and 300–320 ms (no gold fan/coins/ring; green shards visible); repeat with `prefers-reduced-motion: reduce`; save under `docs/features/particle-only-click-effects/evidence/` and map each frame in `build-log-T2.md`.
12. Traces: 10 s idle + 10 clicks/s at 1280×720 and 1920×1080, three clean runs at high, forced medium/low, forced-low→high recovery; record avg/p95, draw means, tier transitions and bundle gzip. Pin high ≤ 241.46/241.70 (predecessor medians 242.46/242.70 minus 1.0), medium ≤ 234.12/234.28, low ≤ 225.45/214.04, and p95 ≤ 33 ms at every tier.

## Review r1 disposition

All findings are fixed (2026-11-11); the authoritative per-finding table is `spec.md` § Review r1 disposition.

| # | Severity | Disposition | Plan-side change |
| --- | --- | --- | --- |
| F1 | MAJOR | Fixed | T2 index guard is `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md`; T2 states the orchestrator precondition that the accepted predecessor row/docs are committed/frozen before `BASE_SHA` is recorded and the feature row is applied after the guard. |
| F2 | MAJOR | Fixed | `BASE_SHA` is recorded before T1; the AC-8 gate covers all `src/backend` sources, the frontend protocol mirror, both workspace manifests, the root manifest/lockfile and container paths. |
| F3 | MAJOR | Fixed | Verification adds the import/URL/loader grep and the runtime/game asset diff. |
| F4 | MINOR | Fixed | Spark evidence moves to 90–180 ms; 300–320 ms checks no gold layers + green shards; 200–250 ms optional. |
| F5 | MINOR | Fixed | Draw accounting corrected to 63 pre-backdrop (impact group 2) + 70 cosmic = 133; impact 5 objects → 2. |
| F6 | MINOR | Fixed | Decision 6 and Q-3 state that a low-tier click has no impact visual at all; conceal/coin popup/banner remain. |
| F7 | MINOR | Fixed | Risk mitigation points to Q-4 (spark tint/reduction). |
| F8 | MINOR | Fixed | README verification requires the old phrase absent and the new phrases present. |
| F9 | INFO | Fixed | Wording is "runtime/game asset"; evidence PNGs are documentation artifacts. |
| F10 | INFO | Fixed | T1's unused-import note adds `BufferGeometry`, `REFERENCE_PIXEL_WORLD`, `clamp01` and any other lint-reported imports. |
| F11 | INFO | Fixed | Supersession rows state that the low-tier ring is removed too. |
| F12 | MINOR | Fixed | Medium/low click-trace draw means and p95 are pinned against the predecessor T14 medians. |

## Revision history

- r1 — 2026-11-11 — initial plan: reduce `impact-effects.ts` to the shard pool; shard-only quality matrix; 133-object/one-draw accounting; T1 → T2; docs/visual evidence.
- r2 — 2026-11-11 — review r1 disposition F1–F12 (all fixed): feature-fork-point `BASE_SHA`, repository-wide AC-8 diff plus import/asset/index gates and T2 precondition, spark-evidence timing, 63 + 70 = 133 arithmetic, low-tier no-impact consequence, Q-4, README old/new greps, runtime/game-asset wording, unused imports, explicit low-tier ring removal, quantified medium/low traces. Removal boundary and T1 → T2 unchanged.

## Open questions

See `spec.md` § Open questions: Q-1 shard retention (default keep), Q-2 unused motion-token cleanup (deferred), Q-3 low-tier no-impact consequence (0/0 default accepted), Q-4 spark tint/reduction (deferred). None blocks T1.
