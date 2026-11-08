---
feature: detailed-hero-spaceship
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 7
---
# Code Review — r1

## Summary

✅ approved — the build satisfies spec r3 on the reviewed tree: the 48-mesh/11-material/1,852-triangle hero model, the 70-object backdrop, the 102-object scene baseline, the pinned composition and the reduced-motion freeze all reproduce. Lint, typecheck, both test suites, both coverage workspaces, the build and the protected-path gates pass; the only open findings are two MINOR documentation/comment corrections and five INFO evidence/process notes, none of which changes behaviour or blocks acceptance.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — Visual-only scope and protected files | ✅ | Independent run vs recorded fork point `BASE=da3625e3fe03e1a9f25ca80cd2c3dd00ba1265a9` and actual `HEAD=3a3a47476d08ce8402cb7d8ddf6b75f964417139`: protected `git diff --exit-code` → `PROTECTED_DIFF_EXIT=0`; protected `git status --porcelain` → clean; `git diff --name-status BASE..HEAD` lists only the two new `spaceship-model.*` files, `cosmic-backdrop.*`, `scene.ts`, `scene.test.ts`, `starfield.*`, `README.md`, feature build logs/evidence and feature docs. `scene.ts` has one comment line `(28 objects)`→`(70 objects)`; `starfield.ts`/`starfield.test.ts` contain only the reduced-motion branch/JSDoc/tests; `scene.test.ts` has the T2 `60`→`102` change and the one approved T4 AC-17 assertion. |
| AC-2 — Factory and object contract | ✅ | `spaceship-model.test.ts`: group `hero-ship-model`, scale `[1.7,1.7,1.7]`, rotation `(-0.1, 0.26, 0)`; 48 direct mesh children; model subtree 49 / hero subtree 50; two `hero-engine` and two `hero-engine-core`; exact `triangleCount=1852` (`≤6000`); no shadow flags; no `Light`/`Points`/`Sprite`/`Texture`. Source/import scans show no `Math.random`, DOM, scene/camera, loader, URL or `import *` (`NO_DOM_RANDOM_LOADER`; import scan no matches). |
| AC-3 — Named parts | ✅ | Exact 46-name→48-count map test (`EXPECTED_MESH_COUNTS`), every direct child `Mesh`, no other names. |
| AC-4 — Palette and material values | ✅ | All 11 hex constants pinned; exactly 11 material instances (`usage.size=11`); usage histogram `[1,1,1,2,2,2,2,4,6,10,17]`; hull/light/mid/orange/canopy/housing physical values, navy/nozzle standard values, highlight/flame/core basic values and flame `AdditiveBlending`/`0.85`/`depthWrite=false` all asserted exactly. |
| AC-5 — Dimensions, proportions and scale | ✅ | Model-local `Box3` with transform reset: size `3.379999998 × 1.066793883 × 4.55` inside `[3.2,3.4]/[0.9,1.1]/[4.2,4.8]`; nose max z `2.199999988 ≥ 1.9`; flame min z `-2.350000012 ≤ -2.0`; core min z `-2.34 ≤ -2.1`; constants `1.7/4.6/3.3/1.0` pinned. |
| AC-6 — Three-quarter attitude and upward nose | ✅ | Inner rotation `-0.1/0.26/0`, scale 1.7; after `updateMatrixWorld(true)` nose world x `12.596` > housing x `7.852`/`6.895`; nose y minus housing centres `0.561`/`0.657` and nozzle centres `0.673`/`0.769` all `≥0.2`; outer group `(9,-2.5,-14)` / `rotation.y=π/2` retained in the model and backdrop tests. |
| AC-7 — Cockpit and canopy | ✅ | `SphereGeometry` canopy at `z=0.82`, `y=0.33`; frame bbox contains cockpit bbox in x/z with centre deltas `0`/`≈0` and y delta `0.02 ≤0.05`; highlight `y=0.462 >0.33`; no pilot mesh; canopy/highlight materials pinned. |
| AC-8 — Wings and tail fins | ✅ | Both wings `ExtrudeGeometry`, hull material; geometry bboxes `1.25999996 × 1.49999997` (`≥1.25/≥1.4`); leading edges mid-gray at design midpoint; wingtips orange at `±1.65`; fins z `-1.25`, height `0.55`, `position.y+height/2=0.625 ≥0.55`; orange tips at `0.65` above fin top. |
| AC-9 — Twin engine nacelles and exhaust | ✅ | Housings `CylinderGeometry` 12 segments at `x=±1.1`, `y=-0.05`, `z=-1.0`; four mid-gray torus ribs; two dark nozzles; two flames at `z=-2.05` additive/0.85/depthWrite false; two cores at `z=-2.15`; all engine meshes shadow-free. |
| AC-10 — Surface detail | ✅ | Exactly 3 hull seams, 6 wing seams, 2 vents, 2 antennae, 2 greebles, 2 hull stripes; all 15 seam/vent/antenna/greeble meshes are Box/Cylinder with local min dimension `0.0208–0.05 ≤0.06` and navy/mid material; measured offsets `0.0150/0.0150/0.0150 ≥0.012`; orange stripes use the orange material. Manual AC-16 captures show no z-fighting. |
| AC-11 — Backdrop composition and counts | ✅ | `COSMIC_BACKDROP_OBJECT_COUNT=70`, `countObjects(backdrop.group)=70`, 12 direct children; one `hero-ship-model` child with 48 meshes; hero position/rotation pinned; world positions all `z<-4`; no shadow flags; re-exported `HERO_HULL_COLOR=0x2f6fd6`/`HERO_FLAME_COLOR=0xff9a3c` identical to model exports. |
| AC-12 — Motion, reduced motion and disposal | ✅ | `update(128)` retains asteroid/meteor/comet motion and hero bob `-2.5+sin(128/2048)·0.25`; model subtree transforms unchanged; x/z stay `9/-14`; reduced-motion and non-positive dt freeze all transforms. Disposal: 63 geometries, 26 materials (15 non-hero + 11 hero), model `dispose()` once, texture once, group empty, second call no-op; 15-mesh non-hero split asserted. |
| AC-13 — Scene integration and camera-anchored composition | ✅ | Scene children 9 without a remote world and 10 with one; backdrop is the ninth child after `background-life`; baseline `32+70=102`; `scene.ts` comment-only edit verified; hero world position `[ownX+15, ownY+1.5, -14]` for slots `7.64/-7.64/38.2`; anchor offsets `6/4`; starfield/background-life counts and forwarding preserved. |
| AC-14 — Performance evidence | ✅ | 12 clean 10-second runs (599 frames each, no frame >33 ms): 1280 idle median `16.666/16.800 ms`, 1280 rapid `16.666/16.800`, 1920 idle `16.666/16.700` (0.034 ms headroom), 1920 rapid `16.666/16.700`; 3/3 runs pass each bar. Normal path independently verified unchanged by the T4 diff/tests, so the pre-T4 traces remain valid (see F4). |
| AC-15 — Bundle and dependency budget | ✅ | `npm run build` exit 0; initial JS `935.79 kB` / gzip `258.63 kB ≤350 kB`; CSS gzip `3.66 kB`; `package.json`, lockfile, both workspace manifests, both Dockerfiles, compose files unchanged; import scan no `GLTFLoader/FileLoader/TextureLoader/fetch/http(s)/import *`; named `three` + workspace-relative imports only. |
| AC-16 — Manual visual matrix | ✅ | 12 captures exist and were independently inspected (all dimensions correct; ship crops confirm the palette/detail reads). Recorded lengths: 224–232 px at 1280×720, 398–415 px at 2560×1280, 337–347 px at 2560×1080; min cube clearance 82 px; min panel clearance 13.5 px (1280×720 slot 2, no intersection); ship is on-screen, right of the cube, layered armor/spine/seams visible, no z-fighting observed. |
| AC-17 — Reduced-motion visual freeze | ✅ | Fresh post-T4 pair `t3-reduced-motion-a/b.png` is byte-identical (same SHA-256), hero boxes both `[948,279,1171,342]`, 8 px union crop `[940,271,1179,350]`, `0/19,200` pixels differ `>8/255` (0.0%, max channel 0), full frame `0/921,600`; `starfield.test.ts` pins frozen swirl/quaternion and unchanged star layout, `scene.test.ts` pins identity under reduced motion, and normal swirl/twinkle/expansion/1200-star/anchor tests pass. |
| AC-18 — Coverage | ✅ | Independent `npm run coverage` exit 0: backend `94.34/85.93/99.68/94.34`; frontend `95.8/95.37/96.61/95.8`; `spaceship-model.ts` 100% across; `starfield.ts` 100%; no coverage/threshold config diff; only the pre-existing `main.tsx` composition-root exclusion. |
| AC-19 — Documentation | ✅ | `grep -n "detailed blue/orange hero spaceship" README.md` → line 9 exact phrase, still states “no external image assets”; `docs/features/README.md` untouched (`git status` clean); proposed row recorded in build-log-T3; `docs/architecture/**` and `docs/product/**` diff exit 0. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/frontend/src/render/spaceship-model.ts:139` | The comment says “10-segment octagonal read”; a 10-segment cylinder is decagonal, and spec F7 explicitly removed the “octagonal” wording. The geometry/tests are correct; only the source comment is inaccurate. | Change the comment to “10-segment low-poly read” (or remove the parenthetical); no code/test change. | open |
| F2 | MINOR | `docs/features/detailed-hero-spaceship/build-log-T3.md:3,15-18` | The final log header still cites “plan r2, spec r2” although T3 ran after the r3/T4 amendment, and it records `HEAD = 42d998a` while the final T3 commit is `3a3a474`. The source tree is unchanged after T4 and the gates were independently rerun against `3a3a474`, so this is an audit-trail accuracy issue, not a code failure. | Update the header to plan/spec r3 and record `HEAD=3a3a474` (or state that the gate run covered `42d998a` plus the T3 docs-only commit). | open |
| F3 | INFO | `docs/features/detailed-hero-spaceship/build-log-T3.md` § Reduced-motion proof | The fresh AC-17 A/B proof is only at 1280×720, while the build-discovered failure also measured 8.47% at 2560×1280. The branch-level fix and the 1280 byte-identical pair pass, and AC-17 does not pin a second viewport, but the previously failing wide case was not recaptured after T4. | Optional: capture a 2560×1280 reduced-motion A/B pair; no code change expected. | open |
| F4 | INFO | `docs/features/detailed-hero-spaceship/build-log-T3.md` § Performance / visual matrix | The 12 AC-14 traces and 12 AC-16 screenshots were recorded before T4. Reuse is valid because T4 only gates the `reducedMotion === true` swirl branch; the diff and normal-path tests confirm swirl/twinkle/expansion/anchor/1200-star behaviour is unchanged. | Keep the reuse note; optionally rerun on the final tree for a strictly final-source evidence set. | open |
| F5 | INFO | `src/frontend/src/render/spaceship-model.test.ts` § AC-2 | The unit test directly asserts no lights/points/sprites/textures and parameter-free construction, but not the absence of DOM access, loaders or `Math.random`; those are proven by the source and import scans. | Optional: add a spy/`Math.random` assertion or keep the source-scan evidence; no behavioural risk. | open |
| F6 | INFO | `docs/features/detailed-hero-spaceship/evidence/t3-*.png` | Visual fidelity is subjective (Q-1): the near-wing surfaces read very dark/navy and the stepped underplate/spine/seams are subtle at 1280. The required palette families and detail groups are distinguishable in the captures, so this is a user-checkpoint judgment rather than an unmet AC. | Add to the Q-1 approval note if desired; no code change under this spec. | open |
| F7 | INFO | repository state | Feature commits are on `main` rather than `feat/detailed-hero-spaceship`, and `spec.md`/`plan.md`/`tasks.md`/`status.md`/`reviews/` remain untracked while build logs/evidence are committed. This is process hygiene, not a feature defect. | Orchestrator: commit the feature artifacts and apply the branch/merge policy. | open |

## Verification performed

- `npm run lint` → exit 0, no findings.
- `npm run typecheck` → exit 0.
- `npm test` → exit 0; backend 22 files / 700 tests; frontend 54 files / 1,356 tests; all green.
- `npm run coverage` → exit 0; frontend `95.8/95.37/96.61/95.8`, backend `94.34/85.93/99.68/94.34`; all four metrics ≥80 in both workspaces; no config change.
- `npm run build` → exit 0; `dist/assets/index-hGlZqrLG.js` `935.79 kB` / gzip `258.63 kB`; CSS gzip `3.66 kB`.
- Protected AC-1 gate vs `BASE=da3625e...` and `HEAD=3a3a474...` → `PROTECTED_DIFF_EXIT=0`; protected working tree clean; changed-path list contains only allowed source/test/docs paths.
- `git diff BASE..HEAD -- scene.ts` → one comment-only hunk `(28 objects)`→`(70 objects)`.
- `git diff BASE..HEAD -- starfield.ts starfield.test.ts` → JSDoc + reduced-motion `swirlAngle` gate + five `reduced-motion swirl freeze (AC-17)` tests; normal branch unchanged.
- `git diff 111f00c..HEAD -- scene.test.ts` → exactly the one approved reduced-motion assertion change; the other scene-test diff is the T2 `60`→`102` baseline.
- Package/lockfile/Dockerfile/compose diff → exit 0; import scans → no banned loader/URL/`import *` matches; no DOM/random/scene/camera use in `spaceship-model.ts`.
- Evidence: 14 PNGs verified with `file`; 12 matrix captures and A/B pair; A/B SHA-256 identical (`c367928995c42544ab76498b6ce9e167ddb6f951377112f9b18c6d11da2f5f18`); independent crop inspection confirms ship composition/palette and no obvious z-fighting.
- Documentation: `README.md` line 9 grep success; `docs/features/README.md` status clean; `docs/architecture`/`docs/product` diff exit 0.
- `npm run smoke` was not run: optional for this frontend-only, no-container-file change; compose/Dockerfiles are unchanged and the containerization contract is untouched.

## Visual / performance audit

### Composition matrix (recorded by the final build; captures independently inspected)

| Size | Slot | Hero box | Len (px) | Pinned range | Cube clear (px) | Panel clear (px) |
| --- | --- | --- | ---: | --- | ---: | ---: |
| 1280×720 | slot 1 | `[948,273,1171,336]` | 224 | 160–280 | 87 | 26.5 |
| 1280×720 | slot 2 | `[943,283,1174,349]` | 232 | 160–280 | 82 | 13.5 |
| 1280×720 | ring 10 | `[948,277,1171,340]` | 224 | 160–280 | 87 | 22.5 |
| 1920×1080 | slot 1 | `[1422,409,1757,501]` | 336 | — | 130 | 221.5 |
| 1920×1080 | slot 2 | `[1412,429,1766,522]` | 355 | — | 121 | 200.5 |
| 1920×1080 | ring 10 | `[1422,425,1759,518]` | 338 | — | 130 | 204.5 |
| 2560×1280 | slot 1 | `[1820,485,2225,614]` | 406 | 320–560 | 146 | 308.5 |
| 2560×1280 | slot 2 | `[1817,488,2231,600]` | 415 | 320–560 | 144 | 322.5 |
| 2560×1280 | ring 10 | `[1828,510,2225,620]` | 398 | 320–560 | 155 | 302.5 |
| 2560×1080 | slot 1 | `[1742,415,2078,509]` | 337 | 300–450 | 130 | 213.5 |
| 2560×1080 | slot 2 | `[1732,410,2078,505]` | 347 | 300–450 | 121 | 217.5 |
| 2560×1080 | ring 10 | `[1742,427,2087,527]` | 346 | 300–450 | 130 | 195.5 |

All 12 captures pass the pinned composition and size gates; the minimum panel clearance is **13.5 px**, with no rectangle intersection. The ship is right of the cube, on-screen and behind the cube in every capture. The palette read is present: cobalt/royal-blue upper hull, light-gray underside/leading edge, navy tail fins/trim, orange wingtips/stripes, dark teal canopy, gray pointed nose, two ribbed nacelles, two orange flames with white-hot cores, seam/greeble/vent detail at 1280. The layered-armor read (stepped underplate + spine + hull seams) is subtle but present; see F6 for the Q-1 fidelity note.

### AC-14 frame traces

| Measurement | Run 1 avg / p95 | Run 2 avg / p95 | Run 3 avg / p95 | Median avg / p95 | Worst avg / p95 | Pass |
| --- | --- | --- | --- | --- | --- | --- |
| 1280×720 idle | 16.666 / 16.800 | 16.666 / 16.700 | 16.666 / 16.800 | 16.666 / 16.800 | 16.666 / 16.800 | 3/3 |
| 1280×720 rapid | 16.666 / 16.800 | 16.666 / 16.800 | 16.666 / 16.700 | 16.666 / 16.800 | 16.666 / 16.800 | 3/3 |
| 1920×1080 idle | 16.666 / 16.700 | 16.666 / 16.700 | 16.666 / 16.700 | 16.666 / 16.700 | 16.666 / 16.700 | 3/3 |
| 1920×1080 rapid | 16.666 / 16.700 | 16.666 / 16.700 | 16.666 / 16.800 | 16.666 / 16.700 | 16.666 / 16.800 | 3/3 |

All traces are 10 s / 599 frames with no frame >33 ms; the 1920×1080 idle median has 0.034 ms headroom against the 16.7 ms bar. The traces predate T4 by design; the normal path is verified unchanged (F4).

## Documentation, container, and real-time checks

- **Documentation:** README exact phrase and no-external-assets statement pass; `docs/features/README.md` was not edited and the proposed row is recorded; no `docs/architecture/**` or `docs/product/**` diff. F2/F1 cover the only doc/comment accuracy nits.
- **Containerization:** no compose, Dockerfile, port, environment-variable, health, WebSocket or image change; the single-command `podman compose up` contract and the provider-neutral frontend image remain unchanged. `npm run smoke` was optional and not needed for this source-only diff.
- **Real-time:** none; no backend, protocol, multiplayer, connection-lifecycle, reconnection or shared-state change. The feature is client-local decoration, and the protected-path gate keeps the relevant paths byte-identical.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No user-controlled data, secrets, remote URLs, loaders, external assets or new dependencies; source/import scans clean; fixed resource bounds and one disposal seam. |
| Quality | ✅ | Pure DOM-free factory; single source of truth for palette/scale; no per-frame allocations; static flames; exact transform/disposal tests; no drive-by refactors in executable code. Comment nit F1. |
| Testing | ✅ | Coverage thresholds pass in both workspaces; every AC has direct test/command/manual evidence; concrete name/count/colour/transform assertions; no snapshots or assertion-free tests; no new coverage exclusions or weakened assertions. The unchanged pre-existing `toBeCloseTo` uses are not part of this diff. F5 is an optional source-scan-versus-test coverage note. |
| Real-time | ✅ (n/a) | No connection, shared state, protocol or server-authority change; protected backend/multiplayer paths unchanged. |
| Containerization | ✅ | No service/image/port/config change; contract unchanged; smoke optional and not run. |
| Documentation | ✅ (MINOR notes) | README/index/architecture checks pass; F1/F2 are accuracy cleanup. |

## Previous round verification (if iteration > 1)

N/A — code review iteration 1. The spec gate is complete: `reviews/spec-r1.md` (changes requested, F1–F20) and `reviews/spec-r2.md` (approved with F21 backlog). The T3/T4 build-discovered amendment B-T3-1 is resolved by the measured post-T4 AC-17 proof.

## Notes / backlog (non-blocking)

- **F1/F2** are the only required cleanup: correct the “octagonal” source comment and the build-log-T3 version/HEAD metadata. Neither changes behaviour.
- **F3** optionally adds a 2560×1280 reduced-motion recapture for the originally failing wide case; the branch-level fix and 1280 proof already pass.
- **F4** records that AC-14/AC-16 evidence is reused pre-T4 but valid; a fresh final-tree run is optional.
- **F5** optional test strengthening for no DOM/loader/random; source and import scans are the current evidence.
- **F6** is the Q-1 fidelity checkpoint: the ship reads as the required palette/detail craft, with the layered underplate/spine/seams subtle at 1280; no AC failure under the written description.
- **F7** process note: commits are on `main` and the spec/plan/tasks/status/reviews artifacts are untracked; orchestrator should commit them and apply the branch policy.
- **No blockers:** all 19 acceptance criteria are met; the feature is approved for the code gate with only non-blocking cleanup/backlog items.
