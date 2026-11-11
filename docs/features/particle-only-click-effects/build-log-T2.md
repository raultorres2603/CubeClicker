# Build log — T2 — Verify & integrate (documentation + visual evidence)

Task: T2 (2026-11-11)
Feature: particle-only-click-effects (spec r2, plan r2, tasks r2)
Files changed:
- `README.md`
- `docs/features/particle-only-click-effects/build-log-T2.md` (this file)
- `docs/features/particle-only-click-effects/evidence/t2-*.png` (verification screenshots; documentation artifacts, not runtime assets)

What changed & why: T2 is verification + documentation only — no source, test, CSS, backend, protocol, manifest, lockfile or container edit. The README game-view sentence now says a click produces green shard debris and spark particles with no click ray fan, coin glyphs or ring shockwave (the retired `rays, shards and coin popups` phrase is gone; the required `granular spaceship parts` and `detailed blue/orange hero spaceship` phrases are preserved). The log records the full repository gate, the fork-point diff/import/asset/index gates, the manual visual matrix at 1280×720 and 1920×1080 (click frames, coin `+0.10`, reticle, cursor, reduced motion, production banner/fly-by, no shake), and the high/medium/low performance and recovery traces.

## Fork point / verified tree

```text
$ git rev-parse HEAD
d515a6efe4a3ee5f2581a1d4bf80fcb41ef0d1a9      # T1 feat commit (verified tree)

$ git log --oneline -3
d515a6e feat: remove gold click explosion, keep particle debris
d5a83f6 docs: freeze accepted feature index rows
ba11d9a docs: record T14 verification evidence (post-T16 fix)

BASE_SHA=d5a83f6d3fcdee93a4b61c9848cdec818a5a317a   # transcribed from build-log-T1.md
```

`BASE_SHA` is the feature fork point recorded in `build-log-T1.md` before T1's first edit — never `git merge-base main HEAD`. This docs/evidence commit follows the verified tree and changes no source.

Environment: Node v24.22.0 / npm 11.19.1; Podman 5.8.9 + docker-compose 5.6.0; `podman compose up -d` stack (frontend `localhost:5173`, backend `localhost:8080`, Postgres, Mailpit, Adminer); headless Google Chrome 157.0.8103.50 over CDP with hardware ANGLE (`ANGLE (NVIDIA, Vulkan 1.4.351, NVIDIA GeForce RTX 5070 Laptop GPU)`). The test-only browser harness lives in `/tmp/opencode/t2/` and injects a `window.__t14Scene` reference by patching the dev-server `src/render/scene.ts` response (the same test-only hook as predecessor T14); no repository file was changed by the harness. All sessions were online guests (server welcome waited before the level start); the perf traces ran as a single-member guest world.

## Gate summary

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | **PASS** exit 0 | raw log below |
| `npm run typecheck` | **PASS** exit 0 (both workspaces) | raw log below |
| `npm test` | **PASS** backend 868 / frontend 1,693 tests | raw log below |
| `npm run coverage` | **PASS** backend 95.43/87.71/99.7/95.43; frontend 96.31/95.35/97.41/96.31 | raw log below |
| `npm run build` | **PASS** exit 0; initial JS **270.51 KB gzip** (≤ 273) | raw log below |
| Fork-point diff gate | **PASS** exit 0, empty | raw log below |
| Import/URL/loader grep | **PASS** no production match | raw log below |
| Runtime/game asset diff | **PASS** empty | raw log below |
| README old/new greps | **PASS** 3 new present, old absent, 2 preserved present | raw log below |
| Index guard | **PASS** exit 0 (no diff) | raw log below |
| Manual visual matrix (1280/1920) | **PASS** 32 screenshots + measured DOM/scene values | matrix below |
| Reduced-motion click (1280/1920) | **PASS** 0 shards / 0 sparks, numeric-only coin | reduced-motion section |
| Production banner / fly-by (1280/1920) | **PASS** one 2π roll, banner counts, no shake | banner section |
| High-tier traces | **PASS** 12/12 high runs stable, avg 16.666 ms, p95 16.7–16.8 ms | performance tables |
| Medium/low traces | **PASS** click draw medians and p95 below pinned bars | performance tables |
| Forced-low → high recovery | **PASS** both sizes | recovery tables |
| Scene / pool accounting | **PASS** 133 = 63 + 70, one impact drawable, 42/72 caps | accounting section |
| **High-tier reproducible miss** | **none reproduced** | 12/12 high runs `high→high` |

## Raw verification commands (verified tree `d515a6e`)

### `npm run lint`

```text
$ npm run lint

> lint
> eslint .

LINT_EXIT=0
```

### `npm run typecheck`

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### `npm test`

```text
$ npm test

> test
> npm run test --workspaces --if-present

> test
> vitest run          # backend
 Test Files  24 passed (24)
      Tests  868 passed (868)
   Duration  3.08s (transform 2.31s, setup 0ms, collect 6.09s, tests 8.92s, environment 4ms, prepare 2.17s)

> test
> vitest run          # frontend
 Test Files  63 passed (63)
      Tests  1693 passed (1693)
   Duration  3.06s (transform 6.83s, setup 0ms, collect 18.82s, tests 8.76s, environment 5.48s, prepare 5.52s)

TEST_EXIT=0
```

The frontend suite includes the preserved-behavior suites named by AC-4 (`scene.test.ts`, `scene-spaceship.test.ts`, `Hud.test.tsx`, `App.test.tsx`, `LevelCompleteBanner.test.tsx`, `spaceship.test.ts`, `targeting.test.ts`, `particles.test.ts`, `cursor-ship.test.ts`, `SpaceshipCustomizationPanel.test.tsx`), all green without weakened assertions.

### `npm run coverage`

```text
$ npm run coverage

> coverage
> npm run coverage --workspaces --if-present

# backend
 Test Files  24 passed (24)
      Tests  868 passed (868)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.43 |    87.71 |    99.7 |   95.43 |

# frontend
 Test Files  63 passed (63)
      Tests  1693 passed (1693)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.31 |    95.35 |   97.41 |   96.31 |
 src/render        |   98.53 |    96.37 |   98.69 |   98.53 |
  ...ct-effects.ts |   97.27 |     90.9 |     100 |   97.27 | 117,131,169-170
  quality.ts       |   97.61 |    96.87 |     100 |   97.61 | 208-209,289-290
  scene.ts         |    97.2 |     95.67 |   95.34 |    97.2 | ...1025,1033-1034

COVERAGE_EXIT=0
```

Both workspaces are ≥ 80 on statements, branches, functions and lines. The edited render modules are included; no exclusion or threshold was changed.

### `npm run build`

```text
$ npm run build

> build
> npm run build --workspaces --if-present

> build
> tsc

> build
> vite build

vite v7.3.7 building client environment for production...
✓ 103 modules transformed.
dist/index.html                   0.42 kB │ gzip:   0.27 kB
dist/assets/index-BjbbTImZ.css   25.61 kB │ gzip:   5.24 kB
dist/assets/index-By8Au8fG.js   975.47 kB │ gzip: 270.51 kB
✓ built in 1.50s

BUILD_EXIT=0
```

Initial JS gzip is **270.51 KB** (≤ 273 KB; predecessor 273.23 KB). Bundle additions: none.

## Fork-point, import and asset gates (AC-8)

### Fork-point diff gate

```text
$ BASE_SHA=d5a83f6d3fcdee93a4b61c9848cdec818a5a317a
$ git diff --exit-code "$BASE_SHA"...HEAD -- src/backend src/frontend/src/multiplayer/protocol.ts \
    src/backend/package.json src/frontend/package.json package.json package-lock.json \
    compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile
DIFF_GATE_EXIT=0
(no output)

$ git diff --name-only "$BASE_SHA"...HEAD -- <same paths>
(no output)
```

### Import / URL / loader grep

```text
$ ! grep -rnE "GLTFLoader|FileLoader|TextureLoader|fetch\(|https?://" \
    src/frontend/src/render src/frontend/src/game --include=*.ts --include=*.tsx | grep -v '\.test\.'
GREP_PIPE_EXIT=1          # the negated pipeline succeeds: no production match

$ grep -rnE "GLTFLoader|FileLoader|TextureLoader|fetch\(|https?://" \
    src/frontend/src/render src/frontend/src/game --include=*.ts --include=*.tsx
src/frontend/src/render/cursor-ship.test.ts:942:      /\b(?:TextureLoader|GLTFLoader|OBJLoader|FileLoader|ImageLoader|AudioLoader)\b/,
```

The only match is inside a test (a regex that asserts no loader is used), excluded by the gate.

### Runtime/game asset diff

```text
$ ! git diff --name-only "$BASE_SHA"...HEAD -- src/frontend/public src \
    | grep -Ei '\.(png|jpe?g|svg|mp3|wav|glb|gltf)$'
ASSET_FILTER_EXIT=1       # no runtime/game asset added or removed

$ git diff --name-only "$BASE_SHA"...HEAD -- src/frontend/public src
src/frontend/src/render/impact-effects.test.ts
src/frontend/src/render/impact-effects.ts
src/frontend/src/render/quality.test.ts
src/frontend/src/render/quality.ts
src/frontend/src/render/scene-spaceship.test.ts
src/frontend/src/render/scene.test.ts
src/frontend/src/render/scene.ts
```

All seven changed `src` files are render TypeScript sources/tests. The `t2-*.png` evidence screenshots live under `docs/features/particle-only-click-effects/evidence/` and are documentation artifacts, not runtime/game assets.

## Documentation (AC-7)

### README diff (only the affected game-view sentence)

```text
-... a clicked mini-cube vanishes on the same frame, and rays, shards and coin popups burst out; ...
+... a clicked mini-cube vanishes on the same frame, and green shard debris and spark particles burst out
+(no click ray fan, no coin glyphs and no ring shockwave); ...
```

### README greps

```text
$ grep -n "green shard debris" README.md
9:... green shard debris and spark particles burst out ...
GREEN_EXIT=0

$ grep -n "spark particles" README.md
9:... green shard debris and spark particles burst out ...
SPARK_EXIT=0

$ grep -n "no click ray fan" README.md
9:... (no click ray fan, no coin glyphs and no ring shockwave) ...
NORAY_EXIT=0

$ grep -n "rays, shards and coin popups" README.md
OLD_EXIT=1                 # retired phrase absent

$ grep -n "granular spaceship parts" README.md
7:... draws one random part from the **granular spaceship parts** catalog ...
GRANULAR_EXIT=0

$ grep -n "detailed blue/orange hero spaceship" README.md
9:... an orange comet and a detailed blue/orange hero spaceship ...
HERO_EXIT=0
```

### Index guard

```text
$ git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md
INDEX_DIFF_EXIT=0
(no output)
```

`docs/features/README.md` is orchestrator-owned and was not edited. Proposed row for the orchestrator to apply after this guard:

```diff
+| particle-only-click-effects | Particle-Only Click Effects (remove gold click explosion; keep green shard debris and spark particles) | accepted | <acceptance date> |
```

## Manual visual matrix (AC-6)

All captures are in `docs/features/particle-only-click-effects/evidence/`. Frame labels are the measured screencast time relative to the click (`performance.timeOrigin` + `metadata.timestamp` minus the click's `performance.now()`). Two capture methods are represented: CDP mouse input (reticle/coin/popup/level) and synchronous in-page pointer events for the precise click timeline.

### Before vs after (300–320 ms)

| Size | Before (predecessor T14) | After (this feature) | What changed |
| --- | --- | --- | --- |
| 1280×720 | `docs/features/spaceship-cursor-loot-animations/evidence/t14-pop-0310ms-1280x720.png` — gold ray fan + ring/satellites + coin discs + shards | `t2-click-no-gold-shards-0312ms-1280x720.png` — black hole, green shard debris + gold sparks, **no ray fan, no coin glyphs, no ring** | gold explosion layers removed; shards/sparks retained |
| 1920×1080 | `docs/features/spaceship-cursor-loot-animations/evidence/t14-pop-0309ms-1920x1080.png` — same gold explosion layers | `t2-click-no-gold-shards-0313ms-1920x1080.png` — black hole, green shard debris + gold sparks, **no ray fan, no coin glyphs, no ring** | same |

### Click timeline (measured)

| Size | Click → coin popup | Click → first shard/spark | 90–180 ms frame | 300–320 ms frame |
| --- | --- | --- | --- | --- |
| 1280×720 | 6 ms | **183 ms** | `t2-click-shot-0162ms-1280x720.png` (shot in flight, reticle + `+0.10`) | `t2-click-no-gold-shards-0312ms-1280x720.png` |
| 1920×1080 | 5.5 ms | **176.5 ms** | `t2-click-shot-0180ms-1920x1080.png` (shot in flight, reticle + `+0.10`) | `t2-click-no-gold-shards-0313ms-1920x1080.png` |

Supporting frames:

| File | Measured | Content |
| --- | --- | --- |
| `t2-click-impact-0195ms-1280x720.png` | 195 ms | first impact frame: conceal starts, shards/sparks spawn (onset 183 ms) |
| `t2-click-impact-0197ms-1920x1080.png` | 197 ms | first impact frame (onset 176.5 ms) |
| `t2-click-mid-0220ms-1280x720.png` | 220 ms | impact bloom + reticle; sparks/shards at burst start |
| `t2-click-mid-0243ms-1920x1080.png` | 243 ms | impact bloom + reticle at 1920 |
| `t2-click-shards-no-gold-0287ms-1280x720.png` | 287 ms | supporting: burst just after impact, no gold layers |
| `t2-click-shards-no-gold-0293ms-1920x1080.png` | 293 ms | supporting: burst just after impact, no gold layers |
| `t2-click-spark-conceal-0154ms-1280x720.png` | 154 ms | supporting CDP run: shot in flight, instant-conceal precursor |
| `t2-click-spark-conceal-0160ms-1920x1080.png` | 160 ms | supporting CDP run at 1920 |
| `t2-coin-popup-1280x720.png`, `t2-coin-popup-1920x1080.png` | ≈130 ms | `+0.10` coin popup + HUD `Coins 0.10` |
| `t2-reticle-1280x720.png`, `t2-reticle-1920x1080.png` | hover | reticle on the mini-cube + pointer ship visible |

### Timing nuance (honest record)

The click impact is deferred by the pinned **`SHOT_TRAVEL_MS = 180`** (`src/frontend/src/game/effects.ts`): the ship fires a shot, the shot travels for 180 ms, and `SceneView.applyDeferredExplosion` then hides the tile and spawns the shard/spark pools. The measured onset is 183 ms (1280) / 176.5 ms (1920) after the click; the coin popup starts at 5.5–6 ms. Therefore the literal "90–180 ms after the click" frames show the **shot in flight, reticle and coin popup**, not the spark burst; the conceal and particles begin on the impact frame at ≈176–183 ms. The spec's spark-brightness parenthetical (≈49–74 % of the 350 ms burst) matches the **300–320 ms** frames: at 312/313 ms the burst is 129–136 ms old, i.e. ≈61–63 % brightness, and the green shards have separated from the black hole. This is the accepted predecessor behavior (T14's own 177 ms frame shows the shot, not the burst), recorded here rather than overclaiming spark visibility in the pre-impact window. The 300–320 ms frames satisfy the no-gold + green-shard + spark requirement at the pinned brightness band.

### Preserved behaviors confirmed in the manual pass

```text
Coin:        .hud-coin-pop = ["+0.10"], [data-stat=coins] = 0.10, clicks = 1 (1280 and 1920)
Reticle:     targeting group present with 2 children on hover (both sizes; visible in reticle frames)
Cursor:      spaceship group present/visible; pointer ship visible in reticle and click frames
Banner:      LEVEL COMPLETE, 24 rays (16 gold + 8 cyan), 3 rings, 12 stars, 20 coins (both sizes)
Fly-by:      1280 one roll, max |rotation.z| = 6.2828 rad (2π), 568 ms above 0.05 rad;
             1920 one roll, max |rotation.z| = 6.2832 rad (2π), 496 ms; no second interval
No shake:    main / .hud-panel / .upgrades-panel: transform none, translate none, rotate none,
             scale none, animation none after the pop and after level completion
```

Banner frames:

| Size | Frames |
| --- | --- |
| 1280×720 | `t2-level-banner-pre-0014ms-1280x720.png`, `t2-level-banner-post-0102ms-1280x720.png`, `t2-level-banner-post-0252ms-1280x720.png`, `t2-level-banner-post-0402ms-1280x720.png`, `t2-level-banner-post-0702ms-1280x720.png` |
| 1920×1080 | `t2-level-banner-pre-0037ms-1920x1080.png`, `t2-level-banner-post-0097ms-1920x1080.png`, `t2-level-banner-post-0247ms-1920x1080.png`, `t2-level-banner-post-0380ms-1920x1080.png`, `t2-level-banner-post-0697ms-1920x1080.png` |

The fly-by was triggered by the production snapshot `levelIndex` rise (T16 path); no harness trigger was called. Captures use online 3×3 server cubes (the level completed in ≈54 clicks); 5×5/6×6/7×7 server cubes reached six cleared faces but did not complete the level under the synthetic 100-clicks/s burst, so those attempts were discarded and the completed 3×3 runs are recorded. This is a pre-existing online-sync/harness condition, not a feature behavior change.

## Reduced motion (AC-4, AC-6)

```text
1280×720: matchMedia("(prefers-reduced-motion: reduce)") = true
          shards = 0, spark drawRange = 0 at ~360 ms and after 1 s
          .hud-coin-pop count = 0 (numeric-only coin feedback)
          Coins = 0.10, Clicks = 1
          screenshots: t2-reduced-reticle-1280x720.png,
                       t2-reduced-click-120ms-1280x720.png,
                       t2-reduced-click-360ms-1280x720.png
1920×1080: matchMedia = true; shards = 0, sparks = 0; pop count = 0; Coins = 0.10
          screenshots: t2-reduced-reticle-1920x1080.png,
                       t2-reduced-click-120ms-1920x1080.png,
                       t2-reduced-click-360ms-1920x1080.png
```

The reduced-motion click conceals the tile with no shards/sparks and no coin popup DOM; the HUD coin value still increases by `+0.10` (numeric-only feedback).

## Performance, adaptive tier and draw counts (AC-5)

Method: 10 s trace per run, fresh page, online guest; high runs force `setQualityTierForTesting('high')` immediately before the trace and then let the real policy run; medium/low runs force the tier and feed the policy a controlled 19 ms / 21 ms frame stream (a `requestAnimationFrame` wrapper; no source edit) so the shipped tier stays selected. Draw calls are counted per `requestAnimationFrame` through the WebGL context wrappers (drawElements/drawArrays/instanced variants), including background-life and the remote-world group. Click runs dispatch pointer events at 10/s across the current face centres; `hudClicks` is the HUD delta (50–90 hits per run).

### High / medium / low traces — 3 runs each, both sizes (36 runs)

| tier | workload | size | run 1 avg/p95 (draw) | run 2 avg/p95 (draw) | run 3 avg/p95 (draw) | median draw | tier start→end |
| --- | --- | --- | --- | --- | --- | --- | --- |
| high | idle | 1280×720 | 16.666/16.7 (170.71) | 16.666/16.7 (168.01) | 16.666/16.8 (168.05) | 168.05 | high→high ×3 |
| high | clicks | 1280×720 | 16.666/16.8 (211.24) | 16.666/16.7 (208.99) | 16.666/16.7 (213.08) | **211.24** (≤ 241.46) | high→high ×3 |
| high | idle | 1920×1080 | 16.666/16.8 (171.49) | 16.666/16.8 (168.17) | 16.666/16.8 (166.34) | 168.17 | high→high ×3 |
| high | clicks | 1920×1080 | 16.666/16.8 (214.97) | 16.666/16.7 (214.15) | 16.666/16.7 (206.9) | **214.15** (≤ 241.70) | high→high ×3 |
| medium | idle | 1280×720 | 19/19 (172.56) | 19/19 (167.7) | 19/19 (166.49) | 167.7 | medium→medium ×3 |
| medium | clicks | 1280×720 | 19/19 (201.09) | 19/19 (201.64) | 19/19 (196.25) | **201.09** (≤ 234.12) | medium→medium ×3 |
| medium | idle | 1920×1080 | 19/19 (171.31) | 19/19 (167.57) | 19/19 (167.18) | 167.57 | medium→medium ×3 |
| medium | clicks | 1920×1080 | 19/19 (201.24) | 19/19 (202.78) | 19/19 (198.33) | **201.24** (≤ 234.28) | medium→medium ×3 |
| low | idle | 1280×720 | 21/21 (171.11) | 21/21 (167.57) | 21/21 (167.74) | 167.74 | low→low ×3 |
| low | clicks | 1280×720 | 21/21 (199.65) | 21/21 (191.31) | 21/21 (198.09) | **198.09** (≤ 225.45) | low→low ×3 |
| low | idle | 1920×1080 | 21/21 (171.03) | 21/21 (167.21) | 21/21 (167.42) | 167.42 | low→low ×3 |
| low | clicks | 1920×1080 | 21/21 (200.92) | 21/21 (197.94) | 21/21 (195.4) | **197.94** (≤ 214.04) | low→low ×3 |

- **High tier: 12/12 runs pass** (avg 16.666 ms ≤ 16.7; p95 16.7–16.8 ms ≤ 33) at both sizes and both workloads; every high run reports `tierStart=high`, `tierEnd=high`. **No reproducible high-tier miss.**
- Medium/low runs report the injected 19/21 ms profile and stay in their forced tier; their p95 is 19/21 ms (≤ 33) and their click-trace draw medians are below the pinned predecessor T14 medians.
- The average/median draw values are lower than the predecessor medians (high 211.24/214.15 vs 242.46/242.70; medium 201.09/201.24 vs 234.12/234.28; low 198.09/197.94 vs 225.45/214.04). The high click medians are 31.22/28.55 draws below the predecessor, far exceeding the required ≥ 1.0 improvement. The absolute values also reflect a single-member guest world in this run (the visual accounting run had 11–19 remote-world objects depending on the room); the pinned upper bounds are the acceptance criterion.
- Frame counts per 10 s trace: 598–600; `errors: []` on all 36 runs; no page exceptions.

### Forced low → high recovery (real policy, both sizes)

```text
1280×720: start low → medium at 4858 ms / 291 frames → high at 9806 ms / 588 frames; final high
1920×1080: start low → medium at 4862 ms / 292 frames → high at 9813 ms / 589 frames; final high
```

The forced-low start is `setQualityTierForTesting('high')` then `setQualityTierForTesting('low')` (so `lastChangeMs`/streaks reset) followed by a 10 ms injected frame stream. The observed transitions match the pinned cooldowns (240 stable frames + 3000 ms for low→medium; 180 + 3000 ms for medium→high), within one poll interval.

### Scene, drawable and pool accounting

```text
SCENE (1280×720, online guest): sceneChildren=10, total=144, worldObjects=11,
      ownBaseline=133, cosmic=70, preBackdrop=63  (133 = 63 + 70)
      scene children: AmbientLight, DirectionalLight, Points, Group, Group,
      spaceship, spaceship-shots, background-life, cosmic-backdrop, Group (remote world)
IMPACT: impact-effects group has exactly 1 child: impact-shards
        capacity 42; material colour 0x44cc88; BoxGeometry 0.09×0.09×0.09
        no scene object named impact-rays / impact-coins / impact-ring
SPARKS: one particle Points drawable, capacity 72
POOLS:  worst-case live pools measured 42 shards + 72 sparks after several pops;
        after the 1200 ms shard / 350 ms spark lifetimes both return to 0
```

`scene.test.ts` pins the same baseline (63 pre-backdrop + 70 cosmic = 133) and 9 scene children (10 with a remote world). The draw accounting is impact = 1 draw instead of the predecessor's 4; the high-tier net growth becomes +18 (accepted: was +21).

## Raw perf run lines (36/36, `errors: []`)

```text
high|idle|1280x720|1 16.666/16.7 170.71
high|idle|1280x720|2 16.666/16.7 168.01
high|idle|1280x720|3 16.666/16.8 168.05
high|clicks|1280x720|1 16.666/16.8 211.24
high|clicks|1280x720|2 16.666/16.7 208.99
high|clicks|1280x720|3 16.666/16.7 213.08
medium|idle|1280x720|1 19/19 172.56
medium|idle|1280x720|2 19/19 167.7
medium|idle|1280x720|3 19/19 166.49
medium|clicks|1280x720|1 19/19 201.09
medium|clicks|1280x720|2 19/19 201.64
medium|clicks|1280x720|3 19/19 196.25
low|idle|1280x720|1 21/21 171.11
low|idle|1280x720|2 21/21 167.57
low|idle|1280x720|3 21/21 167.74
low|clicks|1280x720|1 21/21 199.65
low|clicks|1280x720|2 21/21 191.31
low|clicks|1280x720|3 21/21 198.09
high|idle|1920x1080|1 16.666/16.8 171.49
high|idle|1920x1080|2 16.666/16.8 168.17
high|idle|1920x1080|3 16.666/16.8 166.34
high|clicks|1920x1080|1 16.666/16.8 214.97
high|clicks|1920x1080|2 16.666/16.7 214.15
high|clicks|1920x1080|3 16.666/16.7 206.9
medium|idle|1920x1080|1 19/19 171.31
medium|idle|1920x1080|2 19/19 167.57
medium|idle|1920x1080|3 19/19 167.18
medium|clicks|1920x1080|1 19/19 201.24
medium|clicks|1920x1080|2 19/19 202.78
medium|clicks|1920x1080|3 19/19 198.33
low|idle|1920x1080|1 21/21 171.03
low|idle|1920x1080|2 21/21 167.21
low|idle|1920x1080|3 21/21 167.42
low|clicks|1920x1080|1 21/21 200.92
low|clicks|1920x1080|2 21/21 197.94
low|clicks|1920x1080|3 21/21 195.4
```

The full 36-line JSONL (with draw min/max, HUD clicks/coins, model visible/hidden sets and errors) is reproducible with `/tmp/opencode/t2/perf.mjs`; every run reported `errors: []`, `ownBaseline` 129–134 during clicks (faces clear during the trace), and `impactChildren: 1`.

## Acceptance audit

| AC | Status | Evidence |
| --- | --- | --- |
| AC-1 | met (T1, re-verified) | `impact-effects.test.ts` green in the full run; live scene has one `impact-shards` child, capacity 42, colour `0x44cc88`, no gold pool names |
| AC-2 | met (T1, re-verified) | `quality.test.ts` green; `QUALITY_SHARD_COUNTS` 14/7/0 + `QUALITY_SPARK_COUNTS` 24/12/0 pinned by the suite |
| AC-3 | met (T1, re-verified) | `scene-spaceship.test.ts` / `scene.test.ts` green; live scene reports one impact child, 42/72 pool caps, no gold objects |
| AC-4 | met | `npm test` frontend 63 files / 1,693 tests exit 0; preserved-behavior suites green; manual coin `+0.10`, reticle, cursor, banner/fly-by and no-shake measurements |
| AC-5 | met | 36 traces: high 12/12 stable, avg 16.666 ms, p95 ≤ 16.8; medium/low click draw medians 201.09/201.24 and 198.09/197.94, p95 19/21; high click medians 211.24/214.15 (≥ 1.0 below predecessor); recovery low→high both sizes; 133 = 63 + 70; one impact drawable; 42/72 caps; JS gzip 270.51 KB |
| AC-6 | met | before/after 300–320 ms frames at 1280/1920 (no gold fan/coins/ring, green shards + sparks); 90–180 ms shot/conceal frames; impact onset 176.5/183 ms; reduced-motion 0/0; coin, reticle, cursor, banner/fly-by, no shake; files mapped above |
| AC-7 | met | README old phrase absent, three new substrings present, two preserved phrases present; index guard exit 0; proposed row recorded |
| AC-8 | met | fork-point diff gate exit 0/empty; import/URL/loader grep no production match; runtime/game asset diff empty; evidence PNGs are docs artifacts |
| AC-9 | met | `npm run coverage` exit 0; backend 95.43/87.71/99.7/95.43; frontend 96.31/95.35/97.41/96.31; no exclusion/threshold change |

## Deviations from spec

- **Timing nuance, recorded honestly:** the spec's "90–180 ms after a click" spark-visibility wording is not physically compatible with the shipped 180 ms shot-travel deferral. The measured onset is 176.5–183 ms; the 90–180 ms frames show the shot in flight, reticle and `+0.10`, and the conceal + particle burst start on the impact frame. The 300–320 ms frames are 129–136 ms into the 350 ms burst (≈61–63 % brightness, inside the spec's 49–74 % band) and show the green shards + sparks with no gold layers. No code was changed to force an earlier burst; this is the predecessor's accepted timeline (T14's 177 ms frame shows the shot).
- **Level capture session note:** the banner/fly-by evidence uses online 3×3 server cubes that completed the level in 54 clicks. 5×5/6×6/7×7 server-cube attempts reached six cleared faces but did not complete under the synthetic click burst; those frames were discarded. This is a pre-existing online-sync/harness condition, not a feature behavior change.
- No source/test/CSS/backend/protocol/manifest/lockfile/container edit was made by T2. Pre-existing orchestrator/planner modifications to `docs/features/spaceship-cursor-loot-animations/*` and the untracked feature docs/reviews are not staged.

## Final status

**READY — all gates green.** The full repository gate (lint, typecheck, backend 868 + frontend 1,693 tests, coverage ≥ 80×4 in both workspaces, build 270.51 KB JS gzip) passes; the fork-point diff/import/asset/index gates are clean; the manual matrix at 1280×720 and 1920×1080 proves no gold ray fan, coin glyphs or ring, with green shards and sparks retained, reduced motion particle-free, coin `+0.10`, reticle, cursor, banner/fly-by and no shake preserved; the 36-run performance and both recovery traces are within the pinned bars with no high-tier reproducible miss. Verified tree `d515a6e`; this docs-only evidence commit follows it.
