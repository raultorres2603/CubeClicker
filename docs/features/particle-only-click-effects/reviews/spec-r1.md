---
feature: particle-only-click-effects
phase: spec
iteration: 1
verdict: changes_requested
blocking: 3
nonblocking: 9
---
# Spec Review — r1

## Summary

❌ **changes requested — 3 blocking findings.** The removal boundary is sound and evidence-backed: the predecessor 310 ms frame (`t14-pop-0310ms-1280x720.png`) shows the 12-ray gold fan, the gold coin discs and the bright ring + four satellite rings dominating the "massive yellow explosion", while the green shard debris and the 24-point spark burst are the retained particle layer. The counts (impact 4 → 1 draw, scene 136 → 133 objects, high-tier net +21 → +18), the shard/spark quality matrix, the explicit supersession of predecessor AC-37/38/47/48/52 and README wording, the T1 → T2 dependency, the disjoint file ownership and the smoke-skip justification are coherent.

The blockers are verification-contract gaps, not design gaps: the T2 `docs/features/README.md` guard is a working-tree status check that already fails on the uncommitted accepted predecessor row and cannot detect a committed edit; the AC-8 diff gate does not cover "all backend sources" or the workspace manifests and its `BASE` is vacuous on `main`; and AC-8's "no new asset/loader/URL" claim has no import/asset/URL check. The remaining findings are non-blocking testability and consistency notes.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `plan.md` § Verification item 8 (line 168); `tasks.md` T2 verify (line 40) | The index guard is `test -z "$(git status --porcelain -- docs/features/README.md)"`. It only checks the working tree. The current worktree already has `M docs/features/README.md` (the accepted `spaceship-cursor-loot-animations` row), so the final gate is guaranteed to fail unless the orchestrator commits/freezes the predecessor accepted docs and that row first; a committed edit to the orchestrator-owned index would pass the guard. This fails AC-7's evidence and the `docs/features/README.md` ownership requirement. | Add `BASE=<feature fork point>` and `git diff --exit-code "$BASE"...HEAD -- docs/features/README.md` to T2; record `BASE` in `build-log-T2.md`. Keep the status check only as a precondition after the orchestrator commits/freezes the predecessor accepted docs/index row, and state that precondition in T2. | open |
| F2 | MAJOR | `spec.md` AC-8 (line 56); `plan.md` § Verification item 6 (line 166); `tasks.md` T2 verify (line 38) | AC-8 claims "all backend sources" are unchanged and no dependency is added, but for backend sources the diff gate lists only `server.ts`, `protocol.ts`, `hub.ts` and `economy-repository.ts`; it omits the rest of `src/backend` (auth, db, game, app) and the workspace `src/*/package.json` manifests. `BASE=$(git merge-base main HEAD)` is also vacuous if the builder works on `main` (the current branch), so the gate can pass without comparing anything. | Pin `BASE` to the feature fork point in `build-log-T2.md` and gate `src/backend src/frontend/src/multiplayer/protocol.ts src/*/package.json package.json package-lock.json compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile` (or narrow AC-8's wording to the files actually gated). | open |
| F3 | MAJOR | `spec.md` AC-8 (line 56); `tasks.md` T2 note (line 50); `plan.md` § Verification (lines 159–170) | AC-8 says no new dependency, loader, asset, texture, audio or URL is added, but no verification command checks frontend imports/URLs or new asset files. The diff gate only covers backend/container/dependency paths, so the build log cannot prove this sub-claim. | Add the predecessor bundle/import gate (`grep -rnE "GLTFLoader\|FileLoader\|TextureLoader\|fetch\(\|https?://" src/frontend/src/render src/frontend/src/game --include=*.ts --include=*.tsx \| grep -v '\.test\.'`, expect none) and an asset diff (`git diff --name-only "$BASE"...HEAD -- src/frontend/public 'src/**/*.{png,jpg,jpeg,svg,mp3,wav,glb,gltf}'`, expect none), or explicitly narrow AC-8. | open |
| F4 | MINOR | `spec.md` AC-6 (line 54); `tasks.md` T2 note (line 48) | AC-6 requires spark points visible in the 300–320 ms frame. The spark lifetime is 350 ms and the linear fade leaves ≈11% brightness at 310 ms (`particles.ts` `writeBuffer`), so the manual visual criterion is marginal/flaky; the green shards are still clearly visible. | Require spark visibility in the 90–180 ms frame (≈49–74% brightness) and only "no gold ray fan/coin glyphs/ring + green shards visible" at 300–320 ms; or add a 200–250 ms capture. | open |
| F5 | MINOR | `plan.md` § Draw/object accounting (line 26) | The plan says "136 scene objects = 66 pre-backdrop + 70 cosmic-backdrop objects; impact contributed 5 objects". The 66 already includes the impact group + four drawables (`scene.test.ts:1666-1670` expects 66 + 70 = 136); after removal the correct decomposition is 63 + 70 = 133. A builder copying the wording can misstate the `scene.test.ts` baseline comment. | Rewrite the accounting as "63 pre-backdrop (including the two-object impact group) + 70 cosmic-backdrop = 133; impact 5 objects → 2" and align the `scene.test.ts` comment. | open |
| F6 | MINOR | `spec.md` Q-3 (line 101); `plan.md` key decision 6 (line 141) | Q-3 keeps low tier at 0 shards + 0 sparks. The predecessor's low tier also kept the ring, so after the ring removal a low-tier click has no impact particle/debris effect (the cube still conceals; the coin popup and banner remain). The spec says "no click particles" but not "no impact effect"; this is a user-visible change at the lowest tier. | Explicitly state the low-tier consequence in Q-3 and confirm it is acceptable (the default keep is reasonable); if a minimal presence is desired, that matrix change needs user approval. Non-blocking as written. | open |
| F7 | MINOR | `spec.md` Risks (line 148) | The mitigation says recolouring/reducing the spark layer is a follow-up "not a hidden scope change (Q-1/Q-2)", but Q-1 is green-shard retention and Q-2 is unused-token cleanup; neither covers spark tint/reduction. | Add a Q-4 for spark tint/reduction or remove the Q-1/Q-2 parenthetical. | open |
| F8 | MINOR | `tasks.md` T2 verify (line 39); `spec.md` AC-7 (line 55) | The README verify greps only check `green shard`, `granular spaceship parts` and `detailed blue/orange hero spaceship`; they do not check that the old "rays, shards and coin popups" phrase is gone or that the new "spark particles / no ray fan, coin glyphs or ring shockwave" statement exists, so AC-7's evidence is incomplete. | Add `! grep -n "rays, shards and coin popups" README.md` and `grep -n "spark particles" README.md` (plus the absence wording), or a single exact-sentence grep. | open |
| F9 | INFO | `spec.md` non-goals (line 68); AC-8 (line 56); `tasks.md` T2 note (line 48) | AC-8 and the non-goals say "no new asset", while AC-6/T2 require new evidence PNGs under `docs/features/particle-only-click-effects/evidence/`. The intent is no runtime/game asset; the wording is contradictory. | Say "no new runtime/game asset" in AC-8 and the non-goals; evidence screenshots are documentation artifacts. | open |
| F10 | INFO | `tasks.md` T1 notes (line 22) | The "now-unused imports" list omits `BufferGeometry`, `REFERENCE_PIXEL_WORLD` and `clamp01`, which become unused when the ray/coin/ring code is deleted. Lint will catch them, but the note reads exhaustive. | Add these to the list or say "plus any other lint-reported unused imports". | open |
| F11 | INFO | `spec.md` § Relationship to the predecessor (AC-38 and AC-52 rows, lines 37–40) | The AC-52 row says "superseded in its impact matrix only" and lists `impactRays`/`impactCoins`/`shockwaveExpand` removal, but the predecessor's low tier retained the ring; the low-tier ring removal is only implied by AC-38. A builder could read AC-52 as preserving the low-tier ring. | Add "the low-tier ring is removed too" to the AC-38/AC-52 rows. | open |
| F12 | MINOR | `spec.md` AC-5 (line 53) | "Medium and low are recorded with no regression" is not quantified; the traces are recorded but the bar is not binary-checkable. | Pin the medium/low draw means against the predecessor T14 medians or "≤ the high-tier trace means" in the build log. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every request element is covered: remove the gold ray fan/coin glyphs/ring shockwave, keep green shards + spark particles, preserve the other accepted behaviors. The module reduction and quality-matrix rewrite are necessary consequences, not invented scope. |
| Testability | ✅ | ACs are mostly binary and evidence-able with concrete values (14/7/0 shards, 24/12/0 sparks, 133 objects, 1 impact draw, exact exports). Caveats: AC-6's 300–320 ms spark visibility is marginal (F4); AC-5's "medium and low are recorded with no regression" is not quantified — pin it to "≤ the predecessor T14 medium/low medians" or "≤ the high-tier trace means" in the build log. |
| Boundaries | ✅ | Always/Ask first/Never tiers and non-goals are present; the destructive scope (shard counts/colour/physics) is in Ask first; no backend/protocol/lootbox/container edits. |
| Dependency graph | ✅ | T1 → T2 is acyclic; every AC maps to a task; T1 owns every consumer and test file; T2 is the final gate. T1 is large but remains a single-session removal. |
| Parallel safety | ✅ | No `[P]` tasks; T1 and T2 `files_owned` are disjoint; no shared-file contact. |
| Security | ✅ | Presentation-only: no user-controlled data, persistence, secrets, network request or new dependency/loader. Removing drawables strictly reduces client work. |
| Testing | ❌ | Unit + integration + manual tiers are present with `npm run coverage` ≥ 80% thresholds and concrete-assertion bars. However, AC-7/AC-8 evidence is incomplete: the index guard is wrong (F1), the backend diff gate is too narrow and `BASE` is branch-dependent (F2), and the no-asset/loader/URL claim has no check (F3). AC-7's README greps are also incomplete (F8). |
| Consistency | ✅ | Aligns with the vision and the decided stack; reuses the existing `impact-effects`/`particles`/`quality`/`scene` architecture; supersedes predecessor AC-37/38/47/48/52 and README wording explicitly while leaving predecessor artifacts historical. Minor wording fixes: F5, F7, F11. |
| Real-time | ✅ | Explicitly out of scope and correctly justified: the click impact is purely local; no WebSocket lifecycle, reconnection, shared state, server authority or identity surface is touched. |
| Containers | ✅ | Explicitly out of scope: no service, image, port, environment variable, health signal, compose entry or WebSocket endpoint change; `podman compose up` remains the local-run path. The AC-8 container diff gate exists (scope fix in F2/F3). |

## AC → task traceability

| AC | Task(s) | Evidence | Review status |
| --- | --- | --- | --- |
| AC-1 — Impact module is shard-only | T1 | `impact-effects.test.ts`: exact runtime exports, one `impact-shards` drawable (42 cap, green material), 14 shards, physics/lifetime/recycle, clamp, idempotent dispose | ✅ |
| AC-2 — Quality matrix is shards + sparks only | T1 | `quality.test.ts`: exact high/medium/low × normal/reduced objects, `QUALITY_SHARD_COUNTS`/`QUALITY_SPARK_COUNTS`, no `QUALITY_IMPACT_COUNTS`, untouched policy tests | ✅ |
| AC-3 — Scene spawns no gold impact drawables; shards/sparks pin | T1 | `scene-spaceship.test.ts`: 14/7/0 shards + 24/12/0 sparks, 0/0 reduced motion, one impact child, no gold pool names; `scene.test.ts` conceal | ✅ |
| AC-4 — Preserved behavior regression | T1, T2 | Unchanged `Hud`/`App`/`LevelCompleteBanner`/`cursor-ship`/`spaceship`/`targeting`/`SpaceshipCustomizationPanel` suites; preserved conceal/camera/targeting assertions; frontend test exit 0 | ✅ |
| AC-5 — Draw and performance budget improves | T1, T2 | `scene.test.ts` 133 objects / 9 children / one impact draw; T2 traces, recovery, build ≤ 273 KB gzip, draw means ≥ 1.0 below 242.46/242.70 | ⚠️ F2 for the AC-8 gate; quantify medium/low "no regression" |
| AC-6 — Visual evidence and manual check | T2 | Before frames `t14-pop-0310ms-1280x720.png` / `t14-pop-0309ms-1920x1080.png`; after 300–320 ms + 90–180 ms at both sizes; reduced-motion click; preserved coin/reticle/cursor/banner/no-shake checks | ⚠️ F4 spark visibility timing |
| AC-7 — Documentation | T2 | README click wording + preserved phrases; `docs/features/README.md` untouched; proposed index row in `build-log-T2.md` | ⚠️ F1 index guard; F8 greps |
| AC-8 — No dependency, backend, protocol or container change | T2 | Diff gate + bundle/import/asset gates | ⚠️ F2 diff scope/BASE; F3 asset/import evidence |
| AC-9 — Coverage | T1, T2 | `npm run coverage` ≥ 80% statements/branches/functions/lines in both workspaces; edited modules included; no exclusion/threshold change | ✅ |

## Notes / backlog (non-blocking)

- **F4 (MINOR):** Move the "spark points visible" assertion to the 90–180 ms frame; at 310 ms the spark burst is at ~11% brightness against a 350 ms lifetime.
- **F5 (MINOR):** Correct the plan's 66 + 70 accounting to 63 + 70 = 133 after the three-object removal.
- **F6 (MINOR):** State explicitly that low tier has no impact visual at all after the ring removal; the 0/0 matrix itself is a reasonable accepted-behavior default.
- **F7 (MINOR):** The spark-recolour follow-up is not covered by Q-1/Q-2; add Q-4 or drop the parenthetical.
- **F8 (MINOR):** Add negative grep for the retired README phrase and positive grep for the new absence statement.
- **F9 (INFO):** Clarify "no new runtime/game asset" versus the required evidence PNGs.
- **F10 (INFO):** Extend the T1 unused-import note with `BufferGeometry`, `REFERENCE_PIXEL_WORLD` and `clamp01`.
- **F11 (INFO):** Make the low-tier ring removal explicit in the AC-38/AC-52 supersession rows.

Visual interpretation check: the 310 ms predecessor frame shows a dominant white-gold ray fan, a large bright ring with four satellite rings and gold coin discs; the green shards and the small spark cloud are the particle/debris layer. Removing the three gold layers while retaining the 14/7/0 shards and 24/12/0 sparks is consistent with the user's "massive yellow explosion" complaint and "I want particles" clarification. Q-1 (keep shards), Q-2 (defer token cleanup) and Q-3 (low-tier 0/0 default) are reasonable and not blockers; F6 only asks that Q-3's full consequence be stated.
