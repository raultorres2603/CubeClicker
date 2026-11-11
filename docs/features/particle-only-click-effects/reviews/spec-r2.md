---
feature: particle-only-click-effects
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 3
---
# Spec Review — r2

## Summary

✅ **approved — no open BLOCKER/MAJOR.** All twelve r1 findings are resolved in the r2 spec/plan/tasks: the index guard is now the feature-BASE diff `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md` with the orchestrator precondition stated before `BASE_SHA` is captured; the AC-8 gate is pinned to the feature fork-point `BASE_SHA` and covers all `src/backend`, the frontend protocol mirror, both workspace manifests, the root manifest/lockfile and every container path; and the import/URL/loader grep plus runtime/game asset diff provide the missing no-new-asset evidence.

The removal boundary is unchanged: the gold ray fan, coin glyphs and ring shockwave are out at every tier (including the predecessor's low-tier ring); the 14/7/0 green shards and 24/12/0 sparks are in; the 133-object/one-draw/+18 accounting, the preserved-behavior suite, the T1 → T2 dependency with disjoint ownership, and the no-backend/protocol/container/dependency scope all remain intact. Three non-blocking notes are recorded: N1 (coverage-config diff for AC-9), N2 (import-grep scope) and N3 (asset-extension list).

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) — working-tree index guard | **fixed** | `plan.md` § Verification step 10 (line 180) and `tasks.md` T2 verify (line 60) use `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md`; the orchestrator precondition (accepted predecessor docs/index row committed/frozen before `BASE_SHA` is recorded) is stated at `plan.md` lines 161/180 and `tasks.md` lines 39/66. The working-tree `git status` check remains only as a pre-`BASE_SHA` precondition, explicitly not a T2 pass/fail gate. |
| F2 (r1) — AC-8 diff scope/BASE | **fixed** | `BASE_SHA=$(git rev-parse HEAD)` is recorded before T1's first edit (`plan.md` line 157; `tasks.md` T1 line 39; AC-8 line 56) and used at `plan.md` line 170 / `tasks.md` T2 line 56. The gate covers `src/backend`, `src/frontend/src/multiplayer/protocol.ts`, `src/backend/package.json`, `src/frontend/package.json`, root `package.json`/`package-lock.json`, `compose.yaml`, `compose.smoke.yaml` and both Dockerfiles. No `git merge-base main HEAD`. |
| F3 (r1) — import/URL/loader and asset evidence | **fixed** | `plan.md` steps 7–8 (lines 171–172) and `tasks.md` T2 verify (lines 57–58) add the import/URL/loader grep over `src/frontend/src/render`/`src/frontend/src/game` (tests excluded) and the runtime/game asset diff over `src/frontend/public`/`src` filtered to `png/jpg/jpeg/svg/mp3/wav/glb/gltf`. AC-8 line 56 records both. |
| F4 (r1) — spark evidence timing | **fixed** | AC-6 line 54 requires spark visibility in the 90–180 ms frame (≈49–74% of the 350 ms burst), green shards/no gold layers at 300–320 ms, and an optional 200–250 ms frame; `plan.md` line 181 and `tasks.md` lines 61/69 match. |
| F5 (r1) — object accounting | **fixed** | AC-5 line 53 and `plan.md` lines 26–27 pin 133 = 63 pre-backdrop (including the two-object impact group) + 70 cosmic-backdrop, with impact 5 → 2; `tasks.md` T1 line 42 aligns the `scene.test.ts` comment. |
| F6 (r1) — low-tier no-impact consequence | **fixed** | Q-3 line 101 states a low-tier click has no impact particle/debris/ring effect at all, while the cube conceal, coin popup and banner remain; AC-52 line 40 and `plan.md` key decision 6 (line 141) record the accepted 0/0 consequence. |
| F7 (r1) — spark-tint follow-up | **fixed** | Q-4 (line 102) added for spark tint/reduction; `plan.md` risk line 148 points to Q-4. |
| F8 (r1) — README old/new greps | **fixed** | AC-7 line 55 and `plan.md` step 9 (lines 173–179) / `tasks.md` T2 line 59 require the retired `rays, shards and coin popups` phrase absent and `green shard debris`, `spark particles`, `no click ray fan` present, plus the two preserved phrases. |
| F9 (r1) — runtime/game asset wording | **fixed** | AC-8 line 56, non-goals line 68 and security line 81 say "runtime/game asset"; evidence PNGs are explicitly documentation artifacts. |
| F10 (r1) — unused-import list | **fixed** | `tasks.md` T1 note line 40 adds `BufferGeometry`, `REFERENCE_PIXEL_WORLD`, `clamp01` and "any other lint-reported unused imports". |
| F11 (r1) — low-tier ring removal | **fixed** | AC-38 line 37 and AC-52 line 40 state the ring is removed at every tier, including the predecessor's low-tier ring. |
| F12 (r1) — medium/low draw means | **fixed** | AC-5 line 53 pins medium ≤ 234.12/234.28 and low ≤ 225.45/214.04 (the predecessor T14 medians) with p95 ≤ 33 ms; `plan.md` line 29 and `tasks.md` T2 line 70 match. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| N1 | MINOR | `spec.md` AC-9 (line 57); `plan.md` § Verification step 10 (line 180); `tasks.md` T2 verify (lines 56–60) | AC-9 says no coverage exclusion or threshold is changed, but the T2 gate has no diff for the coverage configuration (`src/frontend/vitest.config.ts`, `src/backend/vitest.config.ts` or any root coverage config). A lowered threshold or added exclusion would still let `npm run coverage` exit 0, and the build log would not prove the no-change claim; the code-gate reviewer will inspect, but the spec's evidence is incomplete. | Add `git diff --exit-code "$BASE_SHA"...HEAD -- src/frontend/vitest.config.ts src/backend/vitest.config.ts` (and any root coverage config) to T2, or record the config diff in `build-log-T2.md`. Non-blocking: the task inventory does not include those files. | open (non-blocking) |
| N2 | INFO | `spec.md` AC-8 (line 56); `plan.md` step 7 (line 171); `tasks.md` T2 verify (line 57) | The import/URL/loader grep is scoped to `src/frontend/src/render` and `src/frontend/src/game`; a new loader or URL in `src/frontend/src/ui`, `App.tsx`, `multiplayer` or `auth` would not be caught, so the global "no new loader/URL" claim is broader than the evidence. The r1 F3 required action scoped the grep to render/game; this is a scope note, not a regression. | Optionally widen the grep to all production `src/frontend/src` (tests excluded), or state that the grep covers the changed areas only. | open (INFO) |
| N3 | INFO | `spec.md` AC-8 (line 56); `plan.md` step 8 (line 172); `tasks.md` T2 verify (line 58) | The runtime-asset diff extension list `png/jpg/jpeg/svg/mp3/wav/glb/gltf` omits common asset types such as `webp`, `gif`, `mp4`, `ogg`, `woff/woff2/ttf`, `hdr` and `ktx2`; a new such runtime asset would not be flagged. The r1 F3 required action specified this list, so this is a scope note, not a regression. | Optionally widen the extension list, or state that the list covers the asset types the project uses. | open (INFO) |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The removal boundary is unchanged and complete: rays/coins/ring out at every tier; 14/7/0 shards + 24/12/0 sparks in; Q-1/Q-2/Q-3/Q-4 cover the deferred choices. No scope invented by the r2 fixes. |
| Testability | ✅ | ACs are binary and evidence-able: 133 = 63 + 70, one impact draw, +18, 14/7/0 shards, 24/12/0 sparks, spark visibility at 90–180 ms, medium/low draw means, README old/new greps, `BASE_SHA` diff, import/asset gates. |
| Boundaries | ✅ | Always/Ask first/Never tiers and non-goals are present; the destructive scope is in Ask first; no backend/protocol/lootbox/container edits. |
| Dependency graph | ✅ | T1 → T2 is acyclic; every AC maps to a task; T1 owns every consumer and test file; T2 is the final gate; T1 remains a single-session removal. |
| Parallel safety | ✅ | No `[P]` tasks; T1 and T2 `files_owned` are disjoint; no shared-file contact. |
| Security | ✅ | Presentation-only: no user-controlled data, persistence, secrets, network request or new dependency/loader/runtime asset. Removing drawables strictly reduces client work. |
| Testing | ✅ | Unit + integration + manual tiers, `npm run coverage` ≥ 80% per workspace, concrete-assertion bars, and the new import/asset evidence are present. N1 is a non-blocking coverage-config diff note; N2/N3 are INFO scope notes. |
| Consistency | ✅ | Aligns with the vision and stack; supersedes predecessor AC-37/38/47/48/52 and AC-50 README wording explicitly; predecessor artifacts remain historical; low-tier ring removal and 63 + 70 = 133 are consistent across spec/plan/tasks. |
| Real-time | ✅ | Explicitly out of scope and justified: the impact is local; no WebSocket lifecycle, reconnection, shared state, server authority or identity surface is touched. |
| Containers | ✅ | Explicitly out of scope: no service, image, port, environment variable, health signal, compose entry or WebSocket endpoint change; `podman compose up` remains the local-run path; the AC-8 container diff gate covers compose/Dockerfiles. |

## AC → task traceability

| AC | Task(s) | Evidence | Review status |
| --- | --- | --- | --- |
| AC-1 — Impact module is shard-only | T1 | `impact-effects.test.ts`: exact runtime exports, one `impact-shards` drawable (42 cap, green material), 14 shards, physics/lifetime/recycle, clamp, idempotent dispose | ✅ |
| AC-2 — Quality matrix is shards + sparks only | T1 | `quality.test.ts`: exact high/medium/low × normal/reduced objects, `QUALITY_SHARD_COUNTS`/`QUALITY_SPARK_COUNTS`, no `QUALITY_IMPACT_COUNTS`, untouched policy tests | ✅ |
| AC-3 — Scene spawns no gold impact drawables; shards/sparks pin | T1 | `scene-spaceship.test.ts`: 14/7/0 shards + 24/12/0 sparks, 0/0 reduced motion, one impact child, no gold pool names; `scene.test.ts` conceal | ✅ |
| AC-4 — Preserved behavior regression | T1, T2 | Unchanged `Hud`/`App`/`LevelCompleteBanner`/`cursor-ship`/`spaceship`/`targeting`/`SpaceshipCustomizationPanel` suites; preserved conceal/camera/targeting assertions; frontend test exit 0 | ✅ |
| AC-5 — Draw and performance budget improves | T1, T2 | 133 = 63 + 70 objects / 9 children / one impact draw / +18; high ≤ 241.46/241.70; medium ≤ 234.12/234.28; low ≤ 225.45/214.04; p95 ≤ 33 ms; build ≤ 273 KB gzip | ✅ |
| AC-6 — Visual evidence and manual check | T2 | Before frames `t14-pop-0310ms-1280x720.png` / `t14-pop-0309ms-1920x1080.png`; after 90–180 ms (spark + conceal), optional 200–250 ms, 300–320 ms (no gold layers + green shards); reduced-motion click; preserved coin/reticle/cursor/banner/no-shake checks | ✅ |
| AC-7 — Documentation | T2 | README old phrase absent; `green shard debris`/`spark particles`/`no click ray fan` present; preserved phrases; feature-BASE index diff guard; proposed row in `build-log-T2.md` | ✅ |
| AC-8 — No dependency, backend, protocol or container change | T2 | `BASE_SHA` fork-point gate over `src/backend`, frontend protocol, workspace/root manifests, lockfile, containers; import/URL/loader grep; runtime/game asset diff | ✅ (N2/N3 INFO) |
| AC-9 — Coverage | T1, T2 | `npm run coverage` ≥ 80% statements/branches/functions/lines in both workspaces; edited modules included; no exclusion/threshold change | ✅ (N1 MINOR) |

## Notes / backlog (non-blocking)

- **N1 (MINOR):** Add the coverage-config diff (or record it in `build-log-T2.md`) so AC-9's "no exclusion or threshold is changed" is proven, not just inferred from a passing coverage run.
- **N2 (INFO):** The import/URL/loader grep covers the changed `render`/`game` areas; widening it to all production `src/frontend/src` would make the global no-new-URL claim stricter.
- **N3 (INFO):** The runtime-asset extension list can be widened beyond `png/jpg/jpeg/svg/mp3/wav/glb/gltf` if future asset types are a concern.
- **Removal boundary and preservation:** unchanged from r1. The 310 ms predecessor frame still supports removing the ray fan, coin discs and ring + satellites while retaining the 14/7/0 green shards and 24/12/0 gold spark particles. Q-1 (keep shards), Q-2 (defer token cleanup), Q-3 (low-tier 0/0 consequence) and Q-4 (spark tint follow-up) remain reasonable and non-blocking.
- **Scope:** no backend, protocol, lootbox, inventory, persistence, authentication, multiplayer, container, dependency or new-runtime-asset change; T1 → T2 ownership is unchanged and disjoint.
