---
feature: particle-only-click-effects
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 3
---
# Code Review — r1

## Summary

✅ **approved — no open BLOCKER/MAJOR.** The removal build matches the approved spec r2 boundary: the click impact now owns one `impact-shards` drawable (14/7/0 shards) and the 24/12/0 spark layer is untouched; no ray/coin/ring pool, timing, flag or scene object remains. I reran lint, typecheck, both test suites, coverage, build and the AC-7/AC-8 diff/import/asset/index gates, and independently reran live accounting, high/medium/low traces and both low→high recovery traces with the recorded harness; every number is within the pinned bars, and the visual evidence shows the gold explosion gone while particles, coin `+0.10`, reticle, cursor, banner and reduced motion remain correct.

Three MINOR evidence/coverage notes are recorded and do not block: the AC-6 90–180 ms spark wording is physically incompatible with the pinned 180 ms shot-travel deferral (honestly documented; the 300–320 ms frames carry the spark proof), the build log's 1920 "before" caption overclaims what the predecessor 309 ms frame shows, and the rewritten unit test does not directly pin the unchanged shard physics values (the code diff proves them unchanged).

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — Impact module is shard-only | ✅ | `impact-effects.ts` current: one `InstancedMesh` `impact-shards`, `BoxGeometry(0.09,0.09,0.09)`, `MeshStandardMaterial({color:0x44cc88, metalness:0.2, roughness:0.5})`, cap 42, 14/pop, speed 1.8–3.6, drag `exp(-2·dt)`, gravity 6, angular 3–8, lifetime 1200 ms, oldest-first recycle. `impact-effects.test.ts` (7 tests) pins exact runtime exports (`Object.keys` = `DEBRIS_PER_POP`,`DEBRIS_POOL_CAP`,`createImpactEffects`), one child/no `impact-rays`/`impact-coins`/`impact-ring`, green material, 14 default, `[0,14]` clamp including NaN/fractional, 1200 ms release, 42-cap recycle and idempotent single dispose. `activeCounts()` returns exactly `{shards}`. Physics values are byte-identical in the diff (`impact-effects.ts:174–213`); see backlog M3 for the direct-pin note. |
| AC-2 — Quality matrix is shards + sparks only | ✅ | `quality.ts:78–90` exports `QUALITY_SHARD_COUNTS {14,7,0}` and unchanged `QUALITY_SPARK_COUNTS {24,12,0}`; `QUALITY_IMPACT_COUNTS` and `impactRays`/`impactCoins`/`shockwaveExpand` are gone. `quality.test.ts` exact `toEqual` matrices for high/medium/low × normal/reduced (`impactShards` 14/7/0, `sparks` 24/12/0, 0/0 under reduced) and an exact key list without the retired fields. Policy constants/tests unchanged (180/240 upgrade, 60/60 downgrade, 1000/3000 cooldowns, window 120, max 250 ms). |
| AC-3 — Scene spawns no gold impact drawables; shards/sparks pin | ✅ | `scene-spaceship.test.ts:280–323,377–415`: one `impact-shards` impact child; scene traversal contains no `impact-rays`/`impact-coins`/`impact-ring`; deferred high click → 14 shards + 24 spark drawRange, medium 7 + 12, low 0 + 0, reduced 0 + 0; conceal and camera-equality assertions preserved. `scene.test.ts` baseline 133 = 63 + 70, 9 children, 10 explosion cycles return to baseline. |
| AC-4 — Preserved behavior regression | ✅ | `npm test` frontend 63 files / 1,693 tests exit 0; backend 24 files / 868 exit 0. Unchanged suites for coin `+0.10` (`Hud`/`App`), banner (`LevelCompleteBanner`), fly-by/trail (`scene`, `scene-spaceship`, `spaceship`), no shake (camera position/quaternion equality at `scene-spaceship.test.ts:345–357`), reticle (`targeting`/scene), cursor ship (`cursor-ship`, `spaceship`), lootbox reveal (`SpaceshipCustomizationPanel`), reduced motion (`particles` + scene 0/0). No weakened assertions found. |
| AC-5 — Draw and performance budget improves | ✅ | Live accounting rerun: `ownBaseline=133`, `preBackdrop=63`, `cosmic=70`, sceneChildren 10 with remote world (9 own), impact children `['impact-shards']`, caps 42 shards/72 sparks; impact = 1 draw, high-tier net growth becomes +18. Independent traces (10 s): high clicks 1280×720 avg 16.694 ms/p95 16.7/draw 215.54; high clicks 1920×1080 16.666/16.7/209.47; high idle 1280 16.666/16.8/168.94; medium clicks 1280 19/19/201.40 (≤234.12); low clicks 1280 21/21/201.79 (≤225.45); low clicks 1920 21/21/195.27 (≤214.04); all tierStart=tierEnd, `errors: []`. Builder 36/36 JSONL rerun-verified: no errors, stable tiers, values match the log. Recovery rerun: 1280 low→medium 4816 ms/289 fr, medium→high 9832 ms/590 fr, final high; 1920 4818 ms/289 fr, 9851 ms/591 fr, final high. Build exit 0, JS gzip 270.51 KB ≤ 273 KB. |
| AC-6 — Visual evidence and manual check | ✅ (substance; MINOR wording M1) | 300–312/313 ms frames at 1280×720 and 1920×1080 show the concealed black hole with green shards + gold sparks and **no ray fan, no coin glyphs, no ring/satellites** (viewed). 90–180 ms frames show shot in flight, reticle and `+0.10` (measured onset 176.5–183 ms); 287/293 ms supporting frames show the burst with no gold layers. Reduced-motion 360 ms frames at both sizes show conceal with 0 shards/0 sparks and numeric-only coin. Coin `+0.10`, reticle + pointer ship, LEVEL COMPLETE banner/fly-by and no-shake measurements are recorded (build-log § Manual matrix). The 1280 predecessor "before" frame shows the gold fan/ring/coins; the 1920 "before" caption is inaccurate — see M2. |
| AC-7 — Documentation | ✅ | `README.md:9` contains `green shard debris`, `spark particles`, `no click ray fan`; retired `rays, shards and coin popups` absent; `granular spaceship parts` and `detailed blue/orange hero spaceship` preserved. `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md` → exit 0 (no edit); proposed row `particle-only-click-effects … accepted` recorded in `build-log-T2.md:263–267` for the orchestrator. |
| AC-8 — No dependency, backend, protocol or container change | ✅ | `git diff --exit-code d5a83f6...HEAD -- src/backend src/frontend/src/multiplayer/protocol.ts src/backend/package.json src/frontend/package.json package.json package-lock.json compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile` → exit 0/empty. Import/URL/loader grep over `src/frontend/src/render src/frontend/src/game` (tests excluded) → no production match (the only hit is a no-loader regex in `cursor-ship.test.ts`). Runtime/game asset diff over `src/frontend/public src` filtered to `png/jpg/jpeg/svg/mp3/wav/glb/gltf` → empty; evidence PNGs are documentation artifacts. No new dependency/asset/URL. |
| AC-9 — Coverage | ✅ | `npm run coverage` exit 0: backend 95.43/87.71/99.7/95.43; frontend 96.31/95.35/97.41/96.31 (statements/branches/functions/lines), both ≥ 80. Edited modules included: `impact-effects.ts` 97.27/90.9/100/97.27, `quality.ts` 97.61/96.87/100/97.61, `scene.ts` 97.2/95.67/95.34/97.2. `git diff` of both `vitest.config.ts` → empty; exclusions are only `*.test.*`, `main.tsx`/`server.ts` and Vitest defaults — no exclusion or threshold changed. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| M1 | MINOR | `spec.md:54` (AC-6); `build-log-T2.md:302–304,455–457` | AC-6 requires spark visibility in the 90–180 ms frame, but the pinned `SHOT_TRAVEL_MS = 180` (`src/frontend/src/game/effects.ts:162`) defers conceal and impact; measured onset is 176.5–183 ms, so the literal 90–180 ms window can only show the shot in flight. The builder documents this honestly and the 300–320 ms frames are 129–136 ms into the 350 ms burst (≈61–63 % brightness, inside the intended 49–74 % band), showing shards + sparks with no gold. The user-visible outcome is correct. | Follow-up spec/evidence wording fix: state spark proof at 300–320 ms (≈49–74 % band) and shot/conceal at 90–180 ms; no code change and no re-opening of the removal boundary. | open (non-blocking) |
| M2 | MINOR | `build-log-T2.md:278` (before/after table) | The 1920 "before" row claims `t14-pop-0309ms-1920x1080.png` shows "same gold explosion layers". Inspected: the frame shows an intact cube, reticle, `+0.10` and a small glow — no ray fan, ring or coin discs (0209/0259 ms frames likewise show no fan). The 1920 after frame is valid proof of absence and the 1280 A/B (gold fan/ring/coins before, none after) carries the removal claim, so this is an evidence-caption defect, not a product failure. | Correct the caption (note the predecessor 1920 frame does not show the gold layers), or reference a predecessor 1920 frame that does; 1280 A/B wording may stand. | open (non-blocking) |
| M3 | MINOR | `src/frontend/src/render/impact-effects.test.ts:68–131`; `spec.md:49,91` | AC-1/testing strategy say "shard physics … unchanged", but the rewritten unit test pins spawn position, clamp, lifetime and recycle only — not speed 1.8–3.6, drag `exp(−2 s⁻¹)`, gravity 6 or angular 3–8 rad/s. Code inspection of the diff shows those values/lines byte-identical (`impact-effects.ts:174–213`), so behavior is unchanged; the gap is direct test evidence. | Add one concrete physics assertion (e.g. one update step vs hand-computed speed/gravity/angle), or amend the AC to cite the unchanged code lines; no functional change required. | open (non-blocking) |

No BLOCKER or MAJOR findings. No test weakening, wildcard matcher, snapshot-only or assertion-free test in the changed files. The approved `toBeCloseTo(3.07, 5)` exception is recorded under Test quality.

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces, `tsc --noEmit`).
- `npm test` → backend 24 files / 868 tests passed; frontend 63 files / 1,693 tests passed; exit 0.
- `npm run coverage` → exit 0. Backend 95.43/87.71/99.7/95.43; frontend 96.31/95.35/97.41/96.31. `impact-effects.ts` 97.27/90.9/100/97.27; `quality.ts` 97.61/96.87/100/97.61; `scene.ts` 97.2/95.67/95.34/97.2.
- `npm run build` → exit 0; `dist/assets/index-By8Au8fG.js` 975.47 kB / gzip **270.51 kB**.
- Fork-point diff gate (exact AC-8 path list, `d5a83f6...HEAD`) → exit 0, no output.
- Import/URL/loader grep over `src/frontend/src/render` + `src/frontend/src/game` (tests excluded) → no production match.
- Runtime/game asset diff over `src/frontend/public` + `src` filtered to image/audio/model extensions → empty.
- README greps → 3 new substrings present, old phrase absent, 2 required phrases present. `docs/features/README.md` diff guard → exit 0; proposed row only in build log.
- Retired-symbol grep: no production/scene reference to `impact-rays`/`impact-coins`/`impact-ring`/`QUALITY_IMPACT_COUNTS`/`impactRays`/`impactCoins`/`shockwaveExpand` remains (only negative assertions/historical docs).
- Live accounting rerun (`/tmp/opencode/t2/accounting.mjs`): `sceneChildren=10` (own 9), `total=160`, `worldObjects=27`, `ownBaseline=133`, `cosmic=70`, `preBackdrop=63`, impact children `['impact-shards']`, `poolCaps.shards=42`, `poolCaps.sparks=72`.
- Independent traces via the recorded harness (`/tmp/opencode/t2/perf.mjs`), 10 s each, 1280/1920: high clicks 16.694/16.7 ms avg/p95, draw 215.54 (1280); 16.666/16.7, draw 209.47 (1920); high idle 16.666/16.8, draw 168.94; medium clicks 19/19, draw 201.40; low clicks 21/21, draw 201.79 (1280) and 21/21, draw 195.27 (1920). All start/end tier stable, `errors: []`, `impactChildren: 1`, `ownBaseline` 130–133 while faces clear.
- Builder `perf.jsonl`: first 36 runs verified line-by-line — 36/36 present, no errors, tier start=end, values matching the build-log tables; 12/12 high runs stable.
- Independent recovery (`/tmp/opencode/t2/recovery.mjs`): 1280 low→medium 4816 ms/289 frames, medium→high 9832 ms/590 frames, final high; 1920 4818 ms/289, 9851 ms/591, final high.
- Visual evidence inspected directly: `t2-click-no-gold-shards-0312ms-1280x720.png`, `t2-click-no-gold-shards-0313ms-1920x1080.png` (green shards + gold sparks, no ray fan/coins/ring), `t2-click-shot-0162ms-1280x720.png`, `t2-click-shot-0180ms-1920x1080.png` (shot/reticle/`+0.10`), `t2-click-impact-0195ms-1280x720.png`, `t2-click-mid-0220ms-1280x720.png`, `t2-click-shards-no-gold-0287ms-1280x720.png`, `t2-reduced-click-360ms-1280x720.png` and `…-1920x1080.png` (conceal, 0 particles), `t2-coin-popup-1280x720.png` (`+0.10`), `t2-reticle-1280x720.png`, `t2-level-banner-post-0102ms-1280x720.png`; predecessor `t14-pop-0310ms-1280x720.png` (gold fan/ring/coins) and `t14-pop-0309ms-1920x1080.png` (no gold layers — M2).
- `impact-effects.test.ts` float review: `toBeCloseTo(3.07, 5)` reads back from the Float32 `instanceMatrix`; the in-test comment names the concrete unavoidability, x/y are exact and the recycle x is an exact integer. This is the task's single bounded tolerance and is **approved**.
- Test-quality scan of changed test files: no `expect.anything/any/objectContaining/arrayContaining/stringContaining/stringMatching`, no `toMatchObject` as a full-value stand-in, no `toBeTruthy`/`toBeDefined`/`not.toThrow` coverage fillers, no snapshots and no assertion-free tests.
- Coverage configs: `src/frontend/vitest.config.ts` and `src/backend/vitest.config.ts` unchanged since BASE; exclusions are tests + the one composition-root entrypoint (`main.tsx`/`server.ts`) + Vitest defaults; thresholds remain 80×4.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Presentation-only; no user-controlled data, persistence, secret, network request, dependency, loader or runtime asset added. Removing drawables reduces client work. No backend/protocol/container surface touched (AC-8 gate empty). |
| Quality | ✅ | Diff traceable to T1/T2, no drive-by refactor, no dead ray/coin/ring code or debug leftovers; one drawable and one geometry/material per pool; shard physics/lifetime/recycle unchanged; reduced motion and quality policy preserved; README accurate; `docs/features/README.md` proposed only. |
| Testing | ✅ (with M3) | Coverage ≥ 80×4 reproduced; exact assertions throughout; unit + integration + manual evidence present; changed tests can fail on real regressions; one approved Float32 tolerance; M3 notes the direct-pin gap for unchanged shard physics. |

## Notes / backlog (non-blocking)

- **M1 (MINOR):** AC-6 90–180 ms spark wording vs the pinned 180 ms shot-travel deferral; documented honestly, spark proof lives in the 300–320 ms frames (≈49–74 % brightness). Fix wording in a follow-up; no code change.
- **M2 (MINOR):** 1920 "before" caption overclaims the predecessor 309 ms frame; correct the caption or reference a frame that shows the gold layers.
- **M3 (MINOR):** Add one concrete shard-physics assertion (or cite the unchanged code lines in AC-1) so "physics unchanged" is pinned by test evidence.
- **Approved exception:** `toBeCloseTo(3.07, 5)` in `impact-effects.test.ts` — Float32 instance-matrix read-back; concrete, commented and bounded (≤1 per task).
- **Confirmed scope:** no backend, protocol, lootbox, inventory, persistence, multiplayer, container, dependency or runtime-asset change; removal boundary exactly as approved (rays/coins/ring out at every tier; 14/7/0 shards and 24/12/0 sparks in; low tier 0/0 accepted per Q-3). No previous-round code findings exist (this is code round 1); spec-r2 non-blocking N1–N3 remain informational only.
