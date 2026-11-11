# Build log — T2 — Render the little explosion, mini-cube destroy and realistic shot

Task: T2 (2026-11-11)
Feature: small-destruction-shot-fx
Fork point (recorded in `build-log-T1.md`): `BASE_SHA=92fcf84999cde086dbc2d6acc89629f73a2fe6d6`.
HEAD before this commit: `cae667bd619d121816e59048322914a6b3574e16` (T1).

Files changed:
- `src/frontend/src/game/effects.ts`
- `src/frontend/src/game/effects.test.ts`
- `src/frontend/src/render/cube-view.ts`
- `src/frontend/src/render/cube-view.test.ts`
- `src/frontend/src/render/impact-effects.ts`
- `src/frontend/src/render/impact-effects.test.ts`
- `src/frontend/src/render/spaceship.ts`
- `src/frontend/src/render/spaceship.test.ts`
- `src/frontend/src/render/world.ts` (comments only)
- `src/frontend/src/render/world.test.ts`
- `src/frontend/src/render/scene.test.ts`
- `src/frontend/src/render/scene-spaceship.test.ts`
- `docs/features/small-destruction-shot-fx/build-log-T2.md`

What changed & why (≤5 lines):
- `MINI_CUBE_POP_MS = MOTION.miniCubeDestroyMs` (140) plus the two pure destroy curves; the
  cube view restores real `instant` semantics and runs per-face 140 ms destroy records that
  write matrix + `instanceColor` each frame and settle on the pinned end state.
- `impact-effects.ts` now owns exactly `impact-shards` (untouched), `impact-flash` (6-instance
  white-hot octahedron, per-instance scalar brightness) and `impact-burst` (72 additive
  ember/smoke points), with the pinned counts, palette, lifetimes, physics and recycling.
- `spaceship.ts` replaces the yellow sphere with a tapered additive bolt (`shot-bolt`), adds
  the 80 ms muzzle flash (`shot-muzzle-flash`), the `muzzle` origin and the 120 ms/0.12
  model-local recoil; `setShotFxEnabled`/getters expose the tier/reduced suppression.
- `world.ts` gets comment updates only (broadcast animates, roster hydration instant); its
  tests pin the 140 ms remote timeline and the instant snapshot path.
- `scene.test.ts` / `scene-spaceship.test.ts` move to the 135-object baseline, the three-child
  impact group, the shot muzzle/travel/flash and the remote destroy timeline.

Decisions:
- **No `scene.ts` edit (T3 ownership).** The exact local hide-frame assertions (scale 1,
  brightness 3, mid-collapse at +70) live in `cube-view.test.ts` and the remote broadcast
  timeline in `scene.test.ts`. The local `scene.test.ts` case is order-agnostic (hidden on
  impact, zero after +140) so it stays green both before and after T3's scene wiring/order;
  T3's `scene-effects.test.ts` owns the exact local timeline (AC-7). This is the only way to
  respect the T2 scope ("No scene.ts (T3)").
- `impact-burst` uses preallocated typed arrays and oldest-first slot replacement; `impact-flash`
  recycles oldest-first by `nowMs`. Colours are derived once from `three.Color` (linear working
  space), so the palette read-back is exact in float32.
- Muzzle material is shared (one material, as pinned by the T2 note); its opacity envelope is
  driven by the live flash. The muzzle flash mesh always exists on `Shot` but is only added to
  `shotsGroup` when the FX layer is enabled; `getMuzzleFlashCount` counts live draws.
- Recoil is applied only on the pointer-follow path to `model.group.position.z`; the no-pointer,
  fly-by and reduced paths reset it to 0 (outer group/camera/HUD never move).
- Existing accepted `spaceship.test.ts` / scene tolerances were left as they are; new
  assertions pin exact float32 read-backs (`Math.fround`) and the deterministic three.js
  double results, so no new tolerance matchers were added.

Evidence (raw):
- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .
  ```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > typecheck
  > tsc --noEmit
  ```
- Focused suites (all run with `npx vitest run <file> --config src/frontend/vitest.config.ts`):
  - `src/frontend/src/game/effects.test.ts` → 30 passed
  - `src/frontend/src/render/cube-view.test.ts` → 37 passed
  - `src/frontend/src/render/impact-effects.test.ts` → 22 passed
  - `src/frontend/src/render/spaceship.test.ts` → 40 passed
  - `src/frontend/src/render/world.test.ts` → 27 passed
  - `src/frontend/src/render/scene.test.ts` → 85 passed
  - `src/frontend/src/render/scene-spaceship.test.ts` → 28 passed
- `npm test --workspace @cubeclicker/frontend` → exit 0:
  ```
   Test Files  63 passed (63)
        Tests  1729 passed (1729)
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0:
  ```
  All files          |   96.43 |    95.43 |   97.47 |   96.43 |
    effects.ts       |     100 |      100 |     100 |     100 |
    cube-view.ts     |   99.24 |    98.48 |     100 |   99.24 |
    impact-effects.ts|   98.64 |    94.11 |     100 |   98.64 |
    spaceship.ts     |   96.16 |    95.41 |   97.05 |   96.16 |
    world.ts         |   98.41 |    91.75 |     100 |   98.41 |
  ```
  (statements / branches / functions / lines; all above the 80 thresholds.)
- Supporting scope gates:
  - `git diff --name-only "$BASE_SHA"...HEAD -- <backend/protocol/manifests/compose/Dockerfiles>`
    → empty (exit 0).
  - Import/URL/loader grep over `src/frontend/src/render` + `src/frontend/src/game` (tests
    excluded) → no matches (exit 0).
  - Audio grep over `src/frontend/src` → no matches (exit 0).
- `git status --porcelain` confirms only the T2 files above plus the untracked feature artifacts
  (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`) owned by the orchestrator.

Acceptance audit:
- **AC-3 — Little explosion module: met.** `impact-effects.test.ts` pins exactly three children
  in order (`impact-shards`, `impact-flash`, `impact-burst`), the 6/72 caps, `0xfff2dc` white-hot
  core with per-instance brightness, `0xff9a3c`/`0xffe7c4` embers and `0x8a7f72 × 0.45` smoke,
  380/480 ms lifetimes, ember drag/gravity and constant smoke bias, the 0.18→0.55/60 ms growth,
  80–140 ms fade, oldest-first recycling, `activeCounts`, no gold names/geometry, no
  post-construction drawable/geometry/material, and idempotent dispose.
- **AC-4 — Mini-cube destroy: met.** `effects.test.ts` pins 140 ms and the exact
  scale (0/15/30/85/140) and brightness (0/45/90/140) tables; `cube-view.test.ts` pins the
  immediate hidden/unpickable state, brightness 3 on the hide frame, the exact 15/30/70/139/140
  timeline, `dtMs <= 0` no-advance, idempotence, instant reduced/roster path, `settlePops`,
  face-removal record drop, the 150-record ceiling, untouched neighbours, `mesh.count === 25`
  and dispose clearing records.
- **AC-5 — Remote cube parity: met.** `world.test.ts` pins the broadcast 140 ms timeline (scale 1
  + colour 3 → mid 70 ms → zero/colour 1 at 140 ms), duplicate no-restart, instant
  `removedIds` zero-scale + colour 1, and the unchanged burst/face-clear behavior; `world.ts`
  has comment-only changes.
- **AC-6 — Realistic shot: met.** `spaceship.test.ts` pins `SHOT_MUZZLE_OFFSET = 0.78`, the
  `shot-bolt` cone (0.07/0.55/6, 12 triangles, additive `0xfff1c8`), muzzle orientation, the
  80 ms `shot-muzzle-flash` envelope/removal, the `shotRecoilOffsetAt` table
  (0 → −0.12, 60 → −0.015, 120 → 0), applied model-local recoil, one draw per live shot,
  low/reduced suppression, `setShotFxEnabled` clearing flashes/recoil while the bolt travels,
  and exactly-once disposal of the shared bolt/muzzle resources. `scene-spaceship.test.ts`
  pins the muzzle origin (`z = 6.78` at rest), travel from the muzzle, the flash lifetime
  through `SceneView` and the recoil settle; the camera-equality test remains green.

Deviations from spec: the exact local `SceneView` hide-frame/mid-collapse timeline (AC-7) is not
asserted in `scene.test.ts` because `scene.ts`'s per-frame `cube.update` ordering is owned by T3
and cannot be changed in T2; T2 pins the same curve in `cube-view.test.ts` and the full
non-reduced remote timeline in `scene.test.ts`/`world.test.ts`, and T3's `scene-effects.test.ts`
owns the local AC-7 sequence. No other deviation.
