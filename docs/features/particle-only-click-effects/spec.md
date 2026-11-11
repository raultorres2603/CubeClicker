---
feature: particle-only-click-effects
revision: 2
status: draft
created: 2026-11-11
updated: 2026-11-11
---

# Spec — Particle-only click effects

## Summary

The click impact introduced by `spaceship-cursor-loot-animations` starts four pooled drawables: a 12-ray gold fan, 14 green shard debris, 6 gold coin discs and a gold ring shockwave (plus the existing 24-point spark burst). The user rejects the combined read as a "massive yellow explosion" and asks for particles instead. This feature removes the gold ray fan, the gold coin glyphs and the gold ring shockwave from the click impact, keeps the green shard debris and the spark particles (the user explicitly wants particles), reduces `render/impact-effects.ts` to a shard-only pool instead of deleting it, updates the adaptive quality matrix to shard counts plus the unchanged spark counts, and proves with objective tests plus before/after visual evidence that the explosion is gone, particles remain, and every other accepted behavior is untouched.

## User stories

- As a player, when I click a mini-cube I want to see particles and debris, not a massive yellow explosion.
- As a player, the rest of the game's feedback — instant cube conceal, coin popup, level banner/fly-by, reticle, cursor ship, lootbox reveal — must stay exactly as satisfying as it is today.
- As a player who prefers reduced motion or whose device drops to a lower quality tier, the click must stay free of the removed explosion components and keep the accepted reduced/quality behavior.

## Scope decision

- **Remove from the click impact:** the 12-ray tapered gold fan, the 6 gold coin discs (glyphs) and the gold ring shockwave (ring + 8 baked spokes + 4 satellite rings, including its 330 ms growth / 150 ms fade / 480 ms visible timing and the reduced-motion 120 ms static flash).
- **Keep:** the 14 green beveled cube shards (pool cap 42, speed 1.8–3.6, drag 2 s⁻¹, gravity 6, angular 3–8 rad/s, lifetime 1200 ms, oldest-first recycling) and the 24-point additive gold spark burst (`EXPLOSION_PARTICLE_COUNT = 24`, pool cap 72, 350 ms lifetime). The spark layer is the particle layer the user asked for; its gold tint is unchanged.
- **Module decision:** keep `src/frontend/src/render/impact-effects.ts` and reduce it to the shard pool. Deleting the module and folding instanced cube debris into the `Points`-based `particles.ts` would mix two drawable types and rewrite the scene/particle contracts for no user-visible gain; the reduced module is the smallest safe change.
- **Ring decision:** remove it. The 310 ms evidence frame (`t14-pop-0310ms-1280x720.png`) shows the ring as a large bright-gold shockwave with satellite rings, not a subtle separate accent; it is part of the perceived yellow explosion.
- **Low tier default:** keep the accepted automatic-tier behavior — `high` 14 shards + 24 sparks, `medium` 7 shards + 12 sparks, `low` 0 shards + 0 sparks. The low tier is only reached after sustained frame-time misses, so normal play keeps particles (Open question Q-3).
- **Unused motion tokens:** keep the `MOTION` ray/coin/shockwave tokens and the `easeOutQuad`/`easeOutQuint` easings exported. They are part of the predecessor's pinned motion-token contract (AC-34); pruning them is a separate, non-user-visible cleanup (Open question Q-2).

## Relationship to the predecessor feature

This feature refines the accepted `spaceship-cursor-loot-animations` feature (spec r4). It explicitly supersedes these predecessor acceptance criteria:

| Predecessor criterion | Disposition |
| --- | --- |
| AC-37 — Pop impact: rays, debris and coins | **Partially superseded.** The 12-ray gold fan and the 6 gold coin discs are removed; the 14 green shards and the 24-point spark layer are retained with their pinned values. |
| AC-38 — Ring shockwave | **Superseded and removed at every tier, including the predecessor's low-tier ring.** No ring drawable, no 330/150/480 ms ring timing and no reduced-motion ring flash remains in the click impact. |
| AC-47 — Motion performance, adaptive tiers and bundle | **Superseded in its impact accounting.** Scene object baseline 136 → 133; impact contributes 1 draw instead of 4; worst-case live impact pools become 42 shards (rays, coins and rings gone); the high-tier frame-time bar, tier recovery and bundle ceiling remain. |
| AC-48 — Reduced-motion coverage | **Superseded for the removed layers only.** The ring flash and ray/coin suppression are gone; shard and spark suppression remain, and every other reduced-motion variant is retained. |
| AC-52 — Adaptive quality tier | **Superseded in its impact matrix only, including the low-tier ring removal.** The impact matrix becomes `impactShards` 14/7/0 plus `sparks` 24/12/0; `impactRays`, `impactCoins` and `shockwaveExpand` are removed; low tier now has no impact drawable/effect at all (Q-3). Policy thresholds, cooldowns, hysteresis and recovery are unchanged. |
| AC-50 — Documentation | **README click-impact wording superseded.** The predecessor's `granular spaceship parts` and `detailed blue/orange hero spaceship` phrases remain required. |

The predecessor's spec, plan, tasks, video analysis and evidence remain historical records and are not rewritten.

## Acceptance criteria

Verification notes: "frontend" = `src/frontend`. All tests use concrete expected values; no wildcard matchers, snapshot-only tests or assertion-free tests. Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace), `npm run build`.

- **AC-1 — Impact module is shard-only.** `src/frontend/src/render/impact-effects.ts` builds exactly one pooled drawable: an `InstancedMesh` named `impact-shards` with capacity `DEBRIS_POOL_CAP === 42` and per-pop maximum `DEBRIS_PER_POP === 14`, green material colour `0x44cc88`. `createImpactEffects(random).group` has exactly one child and no child named `impact-rays`, `impact-coins` or `impact-ring`. The module's runtime exports are exactly `DEBRIS_POOL_CAP`, `DEBRIS_PER_POP` and `createImpactEffects` (types are erased); `ImpactFeatures` is `{ shards: number }`; `activeCounts()` returns exactly `{ shards: number }`. A default pop records exactly 14 shards and no other effect; the shard physics, lifetime and oldest-first recycle at 42 are unchanged. `dispose()` releases the one geometry and one material exactly once, empties the group and is idempotent. Evidence: `impact-effects.test.ts`.
- **AC-2 — Quality matrix is shards plus sparks only.** `src/frontend/src/render/quality.ts` exports `QUALITY_SHARD_COUNTS === { high: 14, medium: 7, low: 0 }` and keeps `QUALITY_SPARK_COUNTS === { high: 24, medium: 12, low: 0 }`; `QUALITY_IMPACT_COUNTS` no longer exists. `qualityFeatures(tier, false)` returns exact objects containing `impactShards` 14/7/0 and `sparks` 24/12/0 for high/medium/low and no `impactRays`, `impactCoins` or `shockwaveExpand` field; `qualityFeatures(tier, true)` returns `impactShards: 0` and `sparks: 0` at every tier while the unrelated flags keep their accepted values. The quality-policy constants, thresholds, cooldowns, hysteresis and downgrade/upgrade/recovery behavior are unchanged; the existing policy tests pass without edits. Evidence: `quality.test.ts`.
- **AC-3 — Scene spawns no gold impact drawables; shards and sparks pin.** At high tier a deferred click explosion (`front:0:0`) yields `impact-shards.count === 14` and particle `drawRange.count === 24`; at medium 7 and 12; at low 0 and 0; under reduced motion 0 and 0. No scene object carries the name `impact-rays`, `impact-coins` or `impact-ring`, and the `impact-effects` group has exactly one child. The instant-conceal behavior is unchanged. Evidence: `scene-spaceship.test.ts`, `scene.test.ts`.
- **AC-4 — Preserved behavior regression.** The frontend suite for the preserved behaviors passes without weakened assertions: instant conceal (`scene.test.ts`), coin popup `+0.10` (`Hud.test.tsx`, `App.test.tsx`), level burst/banner (`LevelCompleteBanner.test.tsx`), ship fly-by/trail (`scene.test.ts`, `scene-spaceship.test.ts`, `spaceship.test.ts`), no screen shake (camera position/quaternion equality in `scene-spaceship.test.ts`), target reticle (`targeting.test.ts`, `scene-spaceship.test.ts`), cursor ship (`cursor-ship.test.ts`, `spaceship.test.ts`), lootbox reveal (`SpaceshipCustomizationPanel.test.tsx`), and reduced motion (`particles.test.ts` plus the existing reduced assertions). `npm test --workspace @cubeclicker/frontend` exits 0. Evidence: build log.
- **AC-5 — Draw and performance budget improves.** `countObjects(scene)` is 133 (the accepted 136 minus the three removed impact drawables), decomposed as **63 pre-backdrop objects including the two-object impact group + 70 cosmic-backdrop objects**; scene children stay 9 (10 with a remote world), and the impact group contributes one drawable instead of four; the high-tier net draw growth against the pre-spaceship baseline becomes +18 (was +21). The worst-case live effect pools are 42 shards and 72 spark points; no ray-fan, coin-disc or ring impact pool exists (the level-complete banner's DOM rays/rings are a different effect and remain). In the local environment, 10-second idle and 10-clicks/second `requestAnimationFrame` traces at 1280×720 and 1920×1080 (three clean runs, fresh page load) report average ≤ 16.7 ms and p95 ≤ 33 ms for the median and at least two of three runs at high tier. Medium and low are recorded with quantified no-regression: their click-trace mean draw calls are ≤ the predecessor T14 medians — medium ≤ 234.12 at 1280×720 and ≤ 234.28 at 1920×1080; low ≤ 225.45 at 1280×720 and ≤ 214.04 at 1920×1080 — and their p95 is ≤ 33 ms. A forced-low run recovers to high after the pinned stable window. The high-tier click-trace mean draw calls are at least 1.0 below the predecessor T14 medians (242.46 at 1280×720 and 242.70 at 1920×1080). `npm run build` exits 0 and initial JS gzip is ≤ 273 KB (predecessor: 273.23 KB). Evidence: build log traces.
- **AC-6 — Visual evidence and manual check.** At 1280×720 and 1920×1080, screenshots captured 300–320 ms after a click show no gold ray fan, no gold coin glyphs and no gold ring/satellites, while green shard debris is visible; the spark particles are required to be visible in the 90–180 ms frame (≈49–74% of the 350 ms burst's brightness), which also shows the instant conceal; an optional 200–250 ms frame is supporting evidence. The before/after comparison uses the predecessor frames `t14-pop-0310ms-1280x720.png` and `t14-pop-0309ms-1920x1080.png` as "before". The same manual pass confirms the preserved behaviors visibly: coin `+0.10`, reticle, cursor ship, level banner/fly-by, no screen shake, and a reduced-motion click with no shards or sparks. Evidence files live under `docs/features/particle-only-click-effects/evidence/` and are mapped in the build log.
- **AC-7 — Documentation.** `README.md` no longer contains the retired exact phrase `rays, shards and coin popups`; it states that a click produces green shard debris and spark particles with no ray fan, coin glyphs or ring shockwave (the exact substrings `green shard debris`, `spark particles` and `no click ray fan` are present), and it preserves the exact phrases `granular spaceship parts` and `detailed blue/orange hero spaceship`. `docs/features/README.md` is not edited by this feature: the feature-BASE diff guard `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md` exits 0 after the orchestrator precondition (the accepted predecessor docs/index row are committed and frozen **before `BASE_SHA` is recorded**, so the accepted row is part of the baseline, and this feature's proposed row is applied only after the guard); the final build log records the proposed index row for the orchestrator. Evidence: README greps (old phrase absent, new phrases present), the index diff and the build-log proposal.
- **AC-8 — No dependency, backend, protocol or container change.** The feature fork-point commit `BASE_SHA` is recorded in `build-log-T1.md` before T1 starts (never a vacuous `git merge-base main HEAD`) and transcribed in `build-log-T2.md`, and the gate `git diff --exit-code "$BASE_SHA"...HEAD -- src/backend src/frontend/src/multiplayer/protocol.ts src/backend/package.json src/frontend/package.json package.json package-lock.json compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile` exits 0. No new dependency, loader, runtime/game asset, texture, audio or URL is added: the import/URL/loader grep over `src/frontend/src/render` and `src/frontend/src/game` (excluding tests) finds none, and the runtime-asset diff over `src/frontend/public` and `src` filtered to `png/jpg/jpeg/svg/mp3/wav/glb/gltf` is empty; evidence screenshots under `docs/features/particle-only-click-effects/evidence/` are documentation artifacts, not runtime/game assets. Evidence: build-log diff gate, grep output and asset diff.
- **AC-9 — Coverage.** `npm run coverage` exits 0 with ≥ 80% statements/branches/functions/lines in both workspaces; the edited frontend modules are included and no exclusion or threshold is changed. Evidence: build log.

## Non-goals

- Removing or recolouring the spark particle layer, or removing the green shard debris (the user asked for particles; both stay).
- Changing the shard counts, shard colour, physics, lifetime or pool cap.
- Changing the coin popup / HUD `+0.10`, the level-complete burst/banner, the ship fly-by/fire trail, the target reticle, the cursor ship, or the lootbox reveal.
- Changing the adaptive quality policy thresholds, cooldowns, hysteresis or recovery; changing the spark counts (24/12/0); adding a user-facing quality or particle setting.
- Changing reduced-motion variants other than removing the ring/ray/coin variants that no longer exist.
- Any backend, protocol, lootbox, inventory, persistence, authentication or multiplayer change; connection lifecycle/reconnection is unaffected.
- Any container, compose, Dockerfile, port, environment-variable, health-signal or WebSocket-endpoint change.
- Adding audio, a new dependency, a new runtime/game asset, a loader, a texture or an external URL. The evidence screenshots required by AC-6 are documentation artifacts and are exempt from this non-goal.
- Rewriting the accepted predecessor spec/plan/tasks, `video-analysis.md` or `reference/`; pruning the unused `MOTION` ray/coin/shockwave tokens and easings (deferred, Q-2).
- Changing the level-complete banner's rays/rings (those are a different, level-completion effect and remain).

## Boundaries

- ✅ Always: run lint, typecheck, frontend tests, `npm run coverage` and `npm run build`; keep the change to the owned frontend render/quality/scene files and their tests; keep assertions concrete; preserve reduced motion and the quality-tier policy; record raw command output and visual evidence in the build log; update `README.md` in the same change.
- ⚠️ Ask first: changing the shard counts, colour, physics, lifetime or pool cap; removing the shard pool entirely; changing `QUALITY_SHARD_COUNTS`/`QUALITY_SPARK_COUNTS`; changing quality thresholds/cooldowns; adding a dependency; editing files outside the task inventory; editing the predecessor's accepted artifacts.
- 🚫 Never: re-add a gold ray fan, coin glyph or ring shockwave to the click impact; weaken assertions (wildcard matchers, snapshot-only or assertion-free tests) or exclude production code from coverage; touch backend/protocol/lootbox/inventory/persistence code; edit `.env*`, lockfiles, compose files or Dockerfiles; rewrite an accepted spec to match new behaviour; `git push`.

## Security considerations

- The change is presentation-only: it consumes no user-controlled data, writes no persistence, adds no client-side secret and makes no network request.
- Removing drawables strictly reduces client render work; no new dependency, loader or runtime/game asset is introduced, so the supply-chain and bundle surface does not grow.
- The removed objects create no state that could desynchronize clients; every client renders the same procedural impact from its own build (no server or protocol involvement).

## Real-time, multi-client and containerization impact

- **Real-time/multi-client:** explicitly out of scope. The click impact is a purely local presentation effect; this feature does not touch WebSocket connection lifecycle, reconnection, server authority, shared game state, accounts or identity. No open question exists for identity vs. "no accounts" because no identity surface is touched.
- **Containerization:** explicitly out of scope per `docs/architecture/containerization.md`. The feature adds no service, image, port, environment variable, health signal, compose entry or WebSocket endpoint. `podman compose up` / `npm run dev` remains the local-run path used for the manual visual check; compose files and Dockerfiles are unchanged (AC-8).

## Testing strategy

- **Unit:** `impact-effects.test.ts` asserts the module's exact runtime exports, one `impact-shards` drawable (42 capacity, green material), no ray/coin/ring children, 14 shards per default pop, physics/lifetime/recycling unchanged, clamp behavior and idempotent dispose. `quality.test.ts` asserts exact `qualityFeatures` objects for high/medium/low and reduced motion, `QUALITY_SHARD_COUNTS`/`QUALITY_SPARK_COUNTS`, the absence of `QUALITY_IMPACT_COUNTS`, and unchanged policy behavior. `particles.test.ts` stays green and pins the 24/12/0 spark limits.
- **Integration:** `scene-spaceship.test.ts` asserts the deferred explosion produces 14/7/0 shards and 24/12/0 spark points by tier, zero under reduced motion, no `impact-rays`/`impact-coins`/`impact-ring` scene objects, one impact child, and preserved targeting/camera behavior. `scene.test.ts` asserts the 133-object baseline, 9 scene children, the one-frame conceal and the spark burst lifetime. The unchanged `Hud.test.tsx`, `App.test.tsx`, `LevelCompleteBanner.test.tsx`, `cursor-ship.test.ts`, `spaceship.test.ts`, `targeting.test.ts` and `SpaceshipCustomizationPanel.test.tsx` suites prove the preserved behaviors.
- **E2E / manual:** the containerized local environment (`podman compose up`, or `npm run dev`) is clicked at 1280×720 and 1920×1080; frames at 90–180 ms (spark visibility and instant conceal), an optional 200–250 ms and 300–320 ms (no gold fan/coins/ring, green shards visible) after a click are captured for before/after evidence, plus a reduced-motion click. `npm run smoke` is not required: no cross-service, backend, protocol or container behavior changes, so it would not exercise this feature.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements, branches, functions and lines per workspace (both workspaces must pass). The per-task pre-gate may use `npm run coverage --workspace @cubeclicker/frontend`; the final task runs the full command.
- **Verification commands:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`; plus the AC-8 fork-point diff/import/asset gates and the AC-7 README old-phrase-absent/new-phrase-present greps.

## Open questions

- **Q-1 — Green shard retention.** Default: keep the 14/7/0 green shard debris alongside the sparks, because the user asked for particles and the shards are the debris half of that request. If the user wants spark particles only, that is a one-line follow-up (`QUALITY_SHARD_COUNTS` zeroed and the shard pool suppressed), not part of this feature.
- **Q-2 — Unused motion-token cleanup.** The `MOTION` ray/coin/shockwave tokens and the `easeOutQuad`/`easeOutQuint` easings become unused by production after this change but remain exported per predecessor AC-34. Prune them in a follow-up, or keep them as the motion vocabulary? Non-blocking; no user-visible effect.
- **Q-3 — Low-tier impact consequence.** The accepted low tier keeps `impactShards: 0` and `sparks: 0`; after the ring removal a low-tier click has **no impact particle/debris/ring effect at all** — the cube still conceals on the same frame, and the coin popup and level banner remain. Default: keep the accepted 0/0 matrix and accept this consequence; if the user wants a minimal particle presence at low, that matrix change needs explicit approval.
- **Q-4 — Spark tint/reduction.** The retained spark layer is gold (`0xffcc66`). If the user still finds the particles too yellow or too large, recolouring/shrinking the spark material or reducing the spark limit is a one-line follow-up requiring approval; it is not part of this feature.

## Assumptions

- "Massive yellow explosion" means the combined gold ray fan + gold coin glyphs + gold ring shockwave; the modest 24-point gold spark burst and the green shards are the "particles" the user wants.
- The spark layer's gold tint is acceptable; the complaint is about the explosion's scale/components, not the colour of the small particles.
- The reduced-motion click remains particle-free (accepted behavior); this feature does not add a reduced-motion particle alternative.
- The adaptive tier policy itself is correct and stays untouched; only its impact feature rows change.
- The predecessor's historical artifacts are not rewritten; this spec's supersession table is the authoritative record of the change.
- The local visual check runs against the real frontend build in the containerized local environment, with the same browser/resolution setup that produced the predecessor T14 frames.

## Review r1 disposition

All twelve findings are fixed; none is rebutted. Dispositions dated 2026-11-11.

| # | Severity | Disposition | Change |
| --- | --- | --- | --- |
| F1 | MAJOR | Fixed | T2 replaces the working-tree index status guard with the feature-BASE diff guard `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md`; T2 states the orchestrator precondition that the accepted predecessor docs/index row are committed and frozen before `BASE_SHA` is recorded (so they are part of the baseline) and this feature's row is applied after the guard, so the existing accepted row cannot fail it. |
| F2 | MAJOR | Fixed | `BASE_SHA` is the feature fork point recorded before T1 (`BASE_SHA=$(git rev-parse HEAD)`), never `git merge-base main HEAD`; the AC-8 gate covers all `src/backend` sources, the frontend protocol mirror, both workspace `package.json` manifests, the root manifest/lockfile and every container path. |
| F3 | MAJOR | Fixed | AC-8/T2 add the import/URL/loader grep over `src/frontend/src/render` and `src/frontend/src/game` (tests excluded) and the runtime/game asset diff over `src/frontend/public` plus `src` filtered to `png/jpg/jpeg/svg/mp3/wav/glb/gltf`; both checks succeed only when no entry exists. |
| F4 | MINOR | Fixed | Spark visibility is required in the 90–180 ms frame (≈49–74% brightness); the 300–320 ms frame requires no gold ray/coin/ring plus visible green shards; a 200–250 ms frame is optional supporting evidence. |
| F5 | MINOR | Fixed | Object accounting corrected to 63 pre-backdrop objects (including the two-object impact group) + 70 cosmic-backdrop = 133; impact 5 objects → 2; the `scene.test.ts` baseline comment instruction is updated. |
| F6 | MINOR | Fixed | Q-3 now states that a low-tier click has no impact visual at all after the ring removal, while the cube conceal, coin popup and banner remain; the 0/0 default is explicitly accepted unless the user approves a minimum presence. |
| F7 | MINOR | Fixed | Added Q-4 for spark tint/reduction; the plan risk mitigation now points to Q-4 instead of Q-1/Q-2. |
| F8 | MINOR | Fixed | AC-7/T2 greps now require the retired phrase `rays, shards and coin popups` to be absent and `green shard debris`, `spark particles` and `no click ray fan` to be present. |
| F9 | INFO | Fixed | AC-8 and the non-goals say "runtime/game asset"; the AC-6 evidence PNGs are explicitly documentation artifacts, not runtime/game assets. |
| F10 | INFO | Fixed | T1's unused-import note adds `BufferGeometry`, `REFERENCE_PIXEL_WORLD`, `clamp01` and "any other lint-reported unused imports". |
| F11 | INFO | Fixed | The AC-38 and AC-52 supersession rows now state explicitly that the predecessor's low-tier ring is removed too and no tier keeps a ring. |
| F12 | MINOR | Fixed | AC-5 pins medium/low click-trace draw means against the predecessor T14 medians (medium ≤ 234.12/234.28; low ≤ 225.45/214.04) and their p95 ≤ 33 ms. |

## Revision history

- r1 — 2026-11-11 — initial draft: remove the gold ray fan, coin glyphs and ring shockwave from the click impact; keep green shards and sparks; reduce `impact-effects.ts` to the shard pool; shard-only quality matrix; supersede predecessor AC-37/AC-38/AC-47/AC-48/AC-52 impact parts; no backend/container impact.
- r2 — 2026-11-11 — spec-review r1 disposition F1–F12 (all fixed): feature-fork-point `BASE_SHA` and repository-wide AC-8 gate; index diff guard plus orchestrator precondition; import/asset/URL gates; spark-evidence timing; 63 + 70 = 133 arithmetic; low-tier no-impact consequence; Q-4 spark tint; README old/new greps; runtime/game-asset wording; unused-import list; explicit low-tier ring removal; quantified medium/low traces. Removal boundary and T1 → T2 unchanged.
