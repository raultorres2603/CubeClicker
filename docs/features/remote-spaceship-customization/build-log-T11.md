# Build log — T11 — Remote ship

Task: T11 (2026-11-18)
Files changed: `src/frontend/src/render/remote-ship.ts` (new), `src/frontend/src/render/remote-ship.test.ts` (new), `docs/features/remote-spaceship-customization/build-log-T11.md` (this log)
Branch: `feat/remote-spaceship-customization` (from `0a1b330`)
Pre-step commits: `448fbde` — `feat: add v3 shot visuals and pulse composition` (the seven verified T10 files), `2fb1324` — `docs: record T10 build log commit hash` (T10 code/tests untouched)
Commit: `<pending>` — `feat: add remote spaceship rendering` (feature + this log; the hash record lands in a follow-up `docs:` commit, mirroring T1/T2/T9/T10/T14 — not pushed)

## What changed & why

- New `render/remote-ship.ts`: `remoteShipAnchor`/`remoteShipIdle`/`remoteShipRecoil`/
  `remoteShipFallbackTarget` plus `createRemoteShip(member)`. The ship reuses the T9 cursor model
  under a `remote-ship` root (anchor + `lookAt` aim at the cube centre) and a `remote-ship-body`
  child (bob/sway/recoil only), with one `shots` group as the body's sibling.
- Appearance resolves the member's 11-slot projection through `appearanceToShipParamsV3` (ten ship
  slots on the model) and `shotStyleForPart` (`shot` entry only). `applyAppearance` re-skins the
  mounted model in place (no remount/dispose, idempotent writes); the shot style follows live.
- Firing reuses T10's `createShotGeometries()`/`createShotMaterials()`, captures
  geometry/scale/muzzle at spawn, enforces the 90 ms interval and two-shot cap, spawns at the
  model-local `+z` nose, travels over `SHOT_TRAVEL_MS` (180) and starts one 0.12-unit/120 ms
  recoil. Reduced motion renders one 120 ms opacity flash at the target with no travelling mesh
  and no bob/sway/recoil.
- Object composition: root + body + 32 model + `shots` group = **35 module objects / 21 meshes**;
  T12's lazy `remote-ships` manager makes the pinned **36 / 21 at rest**, two bolts give the
  pinned **38 scene / 23**, and two bolts + one live muzzle the peak **39 / 24**. The frame path
  writes a preallocated idle pose and the body's own transform; no vector, set or scene object is
  created per frame.
- 44 tests: pinned constants, anchor/idle/recoil math, hierarchy/aim, appearance and live re-skin,
  idempotence, firing cadence/cap/recoil/muzzle, reduced-motion flash, object/draw fixtures, tier
  hidden meshes, allocation stability and idempotent disposal.

## Decisions

- **`RemoteShipMember` is structural, not `MemberState`.** T7 (the frontend `MemberState.appearance`
  field) is still gated on `coin-economy`, so `createRemoteShip` takes
  `Pick<MemberState, 'playerId' | 'position'> & { appearance?: Record<string, string> }`. A
  `MemberState` (with T7's optional field) satisfies it structurally, so T12 passes roster entries
  directly; the renderer normalizes defensively through `normalizeAppearanceV3`.
- **Shots live in the root's local frame.** The plan pins the `shots` group as a sibling of the body
  under the root; the root is scaled 1.2 and aimed, so `Shot.start`/`muzzle`/`target` are root-local
  vectors (documented in the module and the interface). `mesh.getWorldPosition` yields world space;
  the travel still lands exactly on the caller's world target (tested within 1e-9).
- **Shot materials stay shared.** As in T10, the projectile/muzzle material colours follow the live
  style, while geometry/scale/muzzle are captured at spawn. A spectator switching the owner's
  `shot` part updates the colours of every live shot and the form of the next one (AC-24/AC-26).
- **At most one live muzzle is enforced at spawn.** The 90 ms interval already exceeds the 80 ms
  flash, but `fire` retires any live muzzle before adding the next, so the AC-22 peak object/draw
  count cannot be exceeded even if `update` is delayed between two accepted removals.
- **The reduced-motion flash is one preallocated mesh, attached only while it fades.** Creating it at
  construction and leaving it in the tree would shift the pinned rest count to 37; instead it is
  created once (no per-removal allocation), detached at rest, re-used for every reduced-motion
  removal and removed at expiry.
- **`remoteShipIdle` writes an optional `out` buffer.** The public signature keeps returning
  `{ bobY, swayYaw }`; `update` passes the preallocated `pose` buffer, and `RemoteShip.pose` exposes
  its identity so the allocation-free frame path is testable (AC-22).
- **`remoteShipFallbackTarget` is exported here.** AC-20's fallback `(px, py, 2.75)` is a single
  source of truth; T12 calls it when `world.tileOrigin` returns `null`.
- **The remote ship never ignites.** The two cursor ignition meshes stay hidden at every tier; the
  tier list hides only the accepted four (medium) / six (low) detail meshes.
- **Testing tiers.** Unit: the pure helpers (`remoteShipIdle`, `remoteShipRecoil`,
  `remoteShipAnchor`, `remoteShipFallbackTarget`, the constants). Integration: `remote-ship.test.ts`
  drives the real factory over the real three.js object graph (real cursor model, real shot
  geometries/materials, real disposal) through the public handle, exactly the T9/T10 render-tier
  precedent — there is no DOM, network or in-process socket boundary in this task; T12's
  `scene.test.ts` covers the scene/manager/picking integration.
- **Float note.** `-4 + 2.8` is one ulp from the decimal `-1.2`
  (`-1.2000000000000002`). The anchor test pins x/z exactly and y within 1e-12; the AC's "exactly"
  is decimal intent, not an IEEE guarantee.

## Evidence

### `npm run lint`

```
> lint
> eslint .

EXIT:0
```

### `npm run typecheck`

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT:0
```

### `npm test --workspace @cubeclicker/frontend`

```
 Test Files  83 passed (83)
      Tests  2687 passed (2687)
   Duration  4.01s (transform 10.44s, setup 0ms, collect 27.36s, tests 14.87s, environment 11.59s, prepare 9.25s)

EXIT:0
```

Baseline after T10 (`448fbde` + `2fb1324`): 82 files / 2,643 tests. Delta: +1 file
(`remote-ship.test.ts`, 44 tests) = **+44 tests**.

Focused run:

```
$ npx vitest run src/render/remote-ship.test.ts --root src/frontend

 ✓ src/render/remote-ship.test.ts (44 tests) 72ms
 Test Files  1 passed (1)
      Tests  44 passed (44)
   Duration  597ms (transform 125ms, setup 0ms, collect 179ms, tests 72ms, environment 0ms, prepare 80ms)
EXIT:0
```

### `npm run coverage --workspace @cubeclicker/frontend`

```
 Test Files  83 passed (83)
      Tests  2687 passed (2687)
   Duration  5.76s (transform 8.71s, setup 0ms, collect 26.10s, tests 23.63s, environment 13.15s, prepare 8.70s)
All files          |    97.1 |    96.69 |   98.18 |    97.1 |
  remote-ship.ts   |     100 |    97.84 |     100 |     100 | 509,516

EXIT:0
```

Frontend coverage: **statements 97.1 / branches 96.69 / functions 98.18 / lines 97.1** —
thresholds (≥ 80 on all four) passed. `remote-ship.ts` is 100 % statements/functions/lines; the two
uncovered branch arms are the defensive `SHOT_TRAVEL_MS > 0` / `MOTION.shotMuzzleFlashMs > 0`
alternates, unreachable pinned constants mirrored from the accepted `spaceship.ts` pattern.

### Pinned values exercised (spot check)

```
anchor (10, -4)             -> x 11.6, y -1.2000000000000002 (1e-12 of -1.2), z 4.4; scale 1.2
aim  local +z               -> normalize(-1.6, -2.8, -4.4) within 1e-6; +y unit and orthogonal
idle 0 / 650 / 1950         -> {0, 0.05} / {0.12, 6.1e-17} / {-0.12, -1.8e-16}; reduced {0, 0}
recoil 0 / 60 / 120         -> -0.12 / -0.015 / 0 (1e-9)
classic hull-obsidian       -> #1a2333, hull slot [1.06, 1.1, 1.02]
wing-left-gold              -> #ccaa44
hull-dart-chrome            -> hull slot [0.85, 0.9, 1.15], chassis [0.95, 0.9, 1.25]
hull-dart-aurum             -> #ccaa44 / #fff3d6 (seams)
shot-orca-violet            -> wave / 1.2 / petal, #6d28d9 / #c4b5fd
shot-kite-solar             -> orb / 0.95 / ring, #f59e0b / #fef3c7
shot-arrow-crimson          -> shard / 1 / petal, #9f1239 / #fb7185
objects rest / 2 bolts / peak -> 35 + manager = 36 / 37 + manager = 38 / 38 + manager = 39
draws rest / 2 bolts / peak   -> 21 / 23 / 24
tier hidden meshes            -> medium 4 (17 model meshes total - 2 ignitions = 15 visible), low 6
```

## Acceptance audit

- **AC-15 — met (module scope).** `dispose()` detaches the root, clears the shots/body/model and
  releases every geometry/material exactly once (28 geometries, 21 materials) and is idempotent;
  the handle is inert after disposal. Mount lifecycle (`setSpectatedMember`, `memberLeft`,
  `welcome`/`worldEntered`, scene disposal) is T12's scene wiring.
- **AC-16 — met.** Root position/scale pinned; root children are exactly body then shots; body holds
  the 32-object model; local `+z` aims at the cube centre within 1e-6 and local `+y` is unit and
  orthogonal. Aim is measured with the body at rest.
- **AC-17 — met.** Classic look (`#1a2333` hull, `#ccaa44` port wing, `armored` hull transform),
  generated hull (`hull-dart-chrome` slot `[0.85, 0.9, 1.15]`, chassis `[0.95, 0.9, 1.25]`), live
  re-skin to `hull-dart-aurum`/`shot-orca-violet` on the same model group with no dispose, and a
  repeat write of zero.
- **AC-18 — met.** Absent/`{}`/unknown/wrong-slot records render the classic standard (hull/nose/
  cockpit colours and `shot-bolt`); applying the same record twice writes zero `Color.set` and zero
  slot-group scale writes and starts no animation.
- **AC-19 — met.** `t = 0/650/1950` values, reduced-motion zeros, body-only writes, root pin
  unchanged, and no pointer following/travel/bank over 60 frames.
- **AC-20 — met (module scope).** 90 ms boundary (0/89/90), two-shot cap with a dropped third, nose
  spawn `(0, 0, 0.7)` local, world-target arrival over 180 ms, fallback helper `(px, py, 2.75)`,
  recoil `0 → -0.12`, `60 → -0.015`, `120 → 0`, and a dropped shot does not restart recoil.
  Per-member filtering of removals (`playerId`) is T12's dispatch.
- **AC-21 — met.** Reduced motion zeroes bob/sway/recoil, creates no travelling mesh, and writes one
  opacity flash at the target for 120 ms (0.9 → 0.45 at 60 ms → removed at 120).
- **AC-22 — met (module scope).** Idle 35 module objects / 21 draws (+ T12 manager = 36), two bolts
  37 / 23 (+1 = 38), peak 38 / 24 (+1 = 39); medium hides four and low six detail meshes with no
  trail/reticle; one stable pose buffer and stable object count across 120 frames. Scene totals and
  picking isolation are T12's `scene.test.ts`.
- **AC-26 — met.** The owner's resolved style drives geometry/scale/muzzle/colours; a live
  `shot` change switches the next shot and the shared material colours; muzzle duration is
  `MOTION.shotMuzzleFlashMs` (80) and in-flight shots keep their captured geometry/muzzle.

## Scope / diff checks

- `git status --porcelain` after the change lists only the two new `remote-ship` files plus this log
  (and the already-untracked orchestrator feature artifacts).
- Untouched: `render/scene.ts`, `render/world.ts`, `render/cube-view.ts` (T12), `multiplayer/**`/
  `protocol.ts` (T7), `game/engine.ts` (T8), `game/session.ts` (T13), `ui/SpaceshipCustomizationPanel.tsx`/
  `SpaceshipPreview.tsx`/`hangar-tabs.ts` (T15), `parts-v2.ts`/test, backend, `package.json`,
  lockfiles, compose/Docker, `.env*`, `spec.md`/`plan.md`/`tasks.md`/`status.md`/`reviews/`.
- No new dependency; no schema/migration change; `coin-economy` files untouched.
- Documentation: T11 changes no user-facing behaviour/config outside the spectator render path;
  T17 owns the README/frontend-rendering/realtime/observability/glossary documentation pass.

## Deviations from spec

- `createRemoteShip` accepts the structural `RemoteShipMember` instead of a `MemberState` that
  carries `appearance` (T7 not landed yet); a `MemberState` satisfies it once T7 adds the optional
  field. `RemoteShip` also exposes `shotsGroup` and `pose` additively for T12/tests.
- Shot vectors are root-local (the plan pins the `shots` group under the root); world positions are
  obtained through three.js. No behaviour or count changes.
- No player-facing docs in this change (T17 owns them); no scene/picking wiring (T12 owns it).
