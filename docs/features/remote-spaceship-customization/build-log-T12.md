# Build log — T12 — Scene, world and cube-view wiring

Task: T12 (2026-11-19)
Files changed: `src/frontend/src/render/scene.ts`, `src/frontend/src/render/scene.test.ts`, `src/frontend/src/render/scene-spaceship.test.ts`, `src/frontend/src/render/world.ts`, `src/frontend/src/render/world.test.ts`, `src/frontend/src/render/cube-view.ts`, `src/frontend/src/render/cube-view.test.ts`, `src/frontend/src/game/session.test.ts` (inert fixture methods only — see Deviations), `docs/features/remote-spaceship-customization/build-log-T12.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `(pending)` — `feat: wire remote ships into the scene` (not pushed; hash recorded in this follow-up `docs:` commit)

## Sketch (≤5 lines)

- `CubeView.tileOrigin(id)` reads a live instance origin through the mesh world matrix (`null` for
  hidden/removed/malformed/off-grid); `WorldView` exposes `member(id)` (normalized appearance copy)
  and `tileOrigin(playerId, id)` validated against that member's grid.
- `WorldView`'s roster copy normalizes every member through `memberAppearanceOf`, preserves the
  appearance across `memberJoined` refreshes and the `levelAdvanced` rebuild.
- `SceneView` gains a **lazy** `remote-ships` manager, `setSpectatedMember` /
  `setSpectatedAppearance`, the removal→shot dispatch (single + batch first id, AC-20 fallback),
  live re-skin on roster/level events, and tier hidden-mesh forwarding.
- The own ship normalizes its construction/snapshot appearance through `normalizeAppearanceV3` and
  applies `shotStyleForPart(...)` at construction and on every real appearance change (AC-25).
- Tests: world/cube-view tile-origin matrices, the ten scene lifecycle/budget/picking integration
  tests, and the six own-ship shot-style/chassis-composition tests. Run lint/typecheck/frontend
  suite/frontend coverage and record raw output.

## What changed & why

- **`cube-view.ts` (+33).** `CubeView` gains `tileOrigin(id: string): Vector3 | null`. It parses the
  id with the existing grid-aware parser, returns `null` when the face is detached, the tile is
  already hidden (the AC-20 fallback then applies), or the id is malformed/off-grid/unknown-face;
  otherwise it reads the instance matrix, premultiplies the mesh's live `matrixWorld` and returns
  the world-space position. A moved/rotated cube therefore answers in world space, matching what
  `hideMiniCube` writes.
- **`world.ts` (+67/−2).** `WorldView` gains `member(playerId): MemberState | null` and
  `tileOrigin(playerId, id): Vector3 | null`. `copyMember` now stores
  `appearance: memberAppearanceOf(member)` so every rendered roster copy carries `{}` or a valid
  11-entry projection (T7/AC-7) and the scene can mount/reskin from the world itself. The
  `levelAdvanced` rebuild preserves the existing appearance (AC-17) and every other rebuilt field
  stays as before. `tileOrigin` validates the id against the member's own `gridSize` before
  touching matrices, returns `null` after disposal / for an unknown member / a hidden tile /
  a removed face, and delegates to the renamed internal `instanceOrigin` helper (the pre-existing
  removal path keeps using it unchanged).
- **`scene.ts` (+218/−7).** The scene owns the one spectated ship:
  - `remoteShips: Group | null` is the lazy `remote-ships` manager (created on first mount, removed
    with the last disposal, so the accepted 135/146/210/322 object counts are untouched until a
    ship exists — AC-22).
  - `setSpectatedMember(playerId | null)` disposes then mounts exactly one ship for a live roster
    member; same-id calls are a no-op, `null`/unknown id mount nothing, no ship exists before
    `welcome`, during a `spectate`/`return` camera flight, or when the member is not rendered.
  - `setSpectatedAppearance(playerId, appearance)` re-skins the mounted model in place only for its
    own id (no remount, no second dispose).
  - `applyWorldMessage` resolves the AC-20 target **before** the world hides the tile: a
    `miniCubeRemoved` for the mounted member fires at that tile's world origin, a
    `miniCubesRemoved` fires once at its first id, and an already-hidden/unknown tile uses
    `remoteShipFallbackTarget` (`(px, py, 2.75)`); empty batches, other members and non-mounted
    ids spawn nothing. `memberLeft` of the mounted member disposes once; `memberJoined` /
    `levelAdvanced` for the mounted member re-skin from the world's authoritative copy.
  - `welcome`/`worldEntered` disposal funnels through `disposeRemoteShip` exactly once, and scene
    disposal releases manager + ship after the world.
  - The own ship normalizes its construction record through `normalizeAppearanceV3` and applies
    `shotStyleForPart(record.shot ?? 'shot-default')` immediately, then again in `applySnapshot`
    whenever the normalized appearance really changes (AC-25). `lastAppliedAppearance` starts as
    the normalized construction record.
  - `qualityFeatures(...).hiddenCursorMeshes` is stored and forwarded to the mounted ship on every
    `update`; mounting applies it before the first frame. The remote ship gets no trail/reticle and
    no cursor/travel behaviour.
- **Tests (+24 new, 2 existing assertions updated, all in T12-owned files).**
  - `cube-view.test.ts` (+3): live-tile origins on every face, group world-position composition,
    `null` for hidden/removed-face/malformed/off-grid ids; the existing interface-key test gained
    `tileOrigin`.
  - `world.test.ts` (+5): stored member + defensive normalized appearance, AC-7 structural gate
    vs. renderer-level wrong-slot values, appearance across refresh/`levelAdvanced`, live tile
    origins and the full null matrix.
  - `scene.test.ts` (+10): the `spectated remote ship` suite — mount gates (pre-welcome, both
    flight kinds, unknown id, same id), exactly-once disposal on `memberLeft`/`welcome`/
    `worldEntered`/scene dispose, in-place live re-skin + AC-26 shot style, single/batch/fallback
    firing at frame time + player filtering, the 135/146/210/322 → +36/21 → 182/246/358 fixtures,
    the 184/248/360 and 185/249/361 peak fixtures with exact restoration, medium-4/low-6 hidden
    meshes and no trail/reticle, reduced-motion flash, and picking isolation. A `vi.mock` seam wraps
    T11's real `createRemoteShip` for lifecycle/call bookkeeping; counts and raycasts read the real
    three.js subtree.
  - `scene-spaceship.test.ts` (+6, 1 updated assertion): own shot style applied before the first
    snapshot, switched on a normalized snapshot change, palette written only on a real change,
    `shot-default` fallback; generated-hull chassis at rest `[0.95, 0.9, 1.25]` and pulse peak
    `[0.988, 0.936, 1.3]`, classic `[1, 1, 1]` → `[1.04, 1.04, 1.04]`. The pre-existing
    `lastAppearance` assertion now expects the v3-normalized `{ hull: 'hull-gold' }`.

## Decisions

1. **Lazy manager, removed on the last dispose.** Creating the `remote-ships` group at scene
   construction would break the accepted 135-object bare fixture; creating and removing it with the
   ship keeps both AC-22 baselines exact and makes the idle delta exactly 36 objects / 21 meshes.
2. **AC-20 target resolution happens before `world.applyMessage`.** `world.tileOrigin` intentionally
   answers `null` once a tile is hidden, so the scene captures the origin first and falls back to
   `remoteShipFallbackTarget` only when no live origin exists. The fallback vector is computed into
   a preallocated `Vector3` (`remoteTargetScratch`).
3. **One shot per member message, first id of a batch, no queue.** The dispatch calls
   `ship.fire(target, retainedFrameTime)` at most once; the 90 ms cadence and two-shot cap stay
   owned by T11's `RemoteShip`. A dropped shot therefore starts no recoil and a batch never
   multi-fires.
4. **Lifecycle funnels through `disposeRemoteShip`.** Every path (`null`, same-id replacement,
   unknown id, `memberLeft`, `welcome`, `worldEntered`, scene disposal) clears the reference before
   disposing and removes the empty manager, making a second call a no-op and the "exactly once"
   assertions structural rather than incidental.
5. **Live appearance reads the world's stored copy.** `member()` returns the stored `MemberState`
   (already normalized by `memberAppearanceOf`), so `memberJoined`/`levelAdvanced` re-skins read
   state rather than trusting the event payload, and a repeated record relies on T11's idempotent
   `applyAppearance`.
6. **Own ship applies the shot style explicitly, even though T10's `applyAppearance` already
   resolves it.** AC-25 asks for `shotStyleForPart(appearance.shot ?? 'shot-default')` at
   construction and on normalized changes; the calls are idempotent (same style signature) so the
   T10 path and the explicit T12 path cannot double-write materials. Construction now normalizes
   once and shares that record with `lastAppliedAppearance`, avoiding a v2 alias mismatch on the
   first snapshot.
7. **Grid-aware `world.tileOrigin` validation.** The member id is checked against that member's own
   `gridSize` (not the local `GRID_SIZE`) before reading matrices, so a legitimately larger board
   still answers and an off-grid id cannot index outside its instance buffer.
8. **Test seam, not a production seam.** `scene.test.ts` wraps the real `createRemoteShip` in
   `vi.mock`, replacing only its methods with spies bound to the real implementation. Lifecycle
   call counts are observable while object/draw/picking assertions still exercise the actual
   three.js hierarchy.
9. **Tier list forwarding is per-frame from the stored array.** The scene keeps
   `qualityFeatures(...).hiddenCursorMeshes` (no per-frame list rebuild) and passes it to
   `remoteShip.update` every frame; mounting calls `update(0, ...)` so a medium/low mount never
   flashes a hidden detail mesh.
10. **Test tiers.** Unit: `tileOrigin` matrices, world member-copy normalization and the pure
    own-ship style assertions. Integration: the full `SceneView` against the real `WorldView`,
    `CubeView`, `RemoteShip` and quality/picking modules (world messages, snapshots, frames,
    raycasts). No containerized tier applies: T12 changes no service boundary, frame routing or
    runtime config (T16 owns the smoke check).

## Evidence

Full suite, coverage, and lint/typecheck below were produced on the **final tree**; this follow-up
pass only writes this log and commits (no code/test edits). Fresh confirmations made during the
commit pass are marked **(re-run)**.

### `npm run lint` — (re-run) EXIT 0

```
> lint
> eslint .

EXIT:0
```

### `npm run typecheck` — (re-run) EXIT 0

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT:0
```

### `npm test --workspace @cubeclicker/frontend` — final-tree run, EXIT 0

```
 Test Files  83 passed (83)
      Tests  2819 passed (2819)

EXIT:0
```

(`HTMLCanvasElement.getContext()` / `THREE.WebGLRenderer` stderr lines are the pre-existing jsdom
WebGL fallback noise from the UI suites; all files and tests pass.)

### Focused render suites — (re-run) EXIT 0

```
 ✓ src/render/cube-view.test.ts (40 tests) 99ms
 ✓ src/render/world.test.ts (34 tests) 110ms
 ✓ src/render/scene-spaceship.test.ts (34 tests) 358ms
 ✓ src/render/scene.test.ts (100 tests) 990ms

 Test Files  4 passed (4)
      Tests  208 passed (208)

EXIT:0
```

### `npm run coverage --workspace @cubeclicker/frontend` — final-tree run, EXIT 0

```
 Test Files  83 passed (83)
      Tests  2819 passed (2819)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.15 |    96.68 |   98.35 |   97.15 |
 ...
  scene.ts         |   97.32 |      100 |      96 |   97.32 |
  world.ts         |   97.56 |    90.98 |     100 |   97.56 |
  cube-view.ts     |   99.29 |      100 |     100 |   99.29 |
  remote-ship.ts   |     100 |    97.87 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |

EXIT:0
```

All four thresholds (≥ 80 statements/branches/functions/lines) pass for the frontend workspace.
The five modules this task touches/consumes all clear the per-workspace gate on every metric; no
coverage config, threshold or exclusion was changed by T12.

## Acceptance audit

- **AC-15 — met (scene half).** Exactly one ship exists, and only for the spectated member:
  `setSpectatedMember` mounts one `remote-ship` under the lazy manager; same-id is a no-op (no
  remount, no dispose), `null` and an unknown id mount nothing, and no ship exists before the first
  `welcome`, during `spectate`/`return` travel, or for a non-rendered member. `memberLeft` for the
  mounted member, `welcome`, a queued `worldEntered` swap at the level midpoint and scene disposal
  each dispose it **exactly once** (a repeated `memberLeft`/`dispose()` is a no-op).
  `setSpectatedAppearance` applies only for the mounted id and keeps the model identity (no
  remount). Evidence: `scene.test.ts` — `mounts nothing before welcome…`, `disposes exactly once on
  memberLeft, welcome, worldEntered and scene disposal`, `re-skins the mounted model in place…`.
  The session-side calls (`memberAppearance`/`memberLeft`/`welcome` → setters) are T13's scope;
  `session.test.ts` only gained compile-compatibility fakes (see Deviations).
- **AC-17 — met (scene/world half).** The own ship resolves the v3-normalized record at
  construction and on every snapshot change; the generated hull chassis is exactly
  `[0.95, 0.9, 1.25]` at rest and `[0.988, 0.936, 1.3]` at the 130 ms pulse peak (within 1e-9), and
  the classic hull stays `[1, 1, 1]` at rest and `[1.04, 1.04, 1.04]` at peak. The mounted remote
  ship re-skins in place from the world's normalized copy (live `setSpectatedAppearance`, roster
  refresh, `levelAdvanced`), and `world.copyMember` carries the normalized appearance while
  `levelAdvanced` preserves it. v3 slot rendering itself (10 ship slots, classic v2 colours) is
  T11/T10-owned and covered by `remote-ship.test.ts` (100 / 97.87 / 100 / 100). Evidence:
  `scene-spaceship.test.ts` (both chassis tests, four shot-style tests), `scene.test.ts`
  (`re-skins…`), `world.test.ts` (three member-copy tests).
- **AC-20 — met.** For the mounted member, `miniCubeRemoved` fires once at the removed tile's
  world origin (`[10, 14, 2.625]` for `front:0:0` on a member at `(12, 12)`) at the retained frame
  time (`42`); `miniCubesRemoved` fires once at its first id (`[11, 13, 2.625]`, frame `7`); an
  already-hidden tile uses the fallback `(px, py, 2.75)` exactly (`[12, 12, 2.75]`); an empty batch
  fires nothing; a removal from any other member fires nothing. Cadence/cap/recoil/muzzle and the
  dropped-shot-no-recoil rule are T11's `remote-ship.test.ts` (100 / 97.87), exercised here through
  the scene at the two-bolt and peak fixtures. Evidence: `scene.test.ts` — `fires at the removed
  tile origin…`, `takes the first id of a batch and falls back…`.
- **AC-22 — met.** Bare scene 135; one/nine/twenty-three remotes 146/210/322 with **no** manager
  while nobody is spectated. Mounting adds exactly 36 objects / 21 meshes → **182 / 246 / 358**;
  two bolts add `+2` → **184 / 248 / 360** (23 meshes); the second shot's live muzzle adds `+1` →
  **185 / 249 / 361** (24 meshes); the muzzle expires first, leaving the two-bolt fixture. Unmounting
  restores the accepted counts exactly even with shots in flight (`idle − 36`). Medium hides the
  accepted 4 (15 model meshes visible), low the accepted 6 (13 visible); the ship has no trail,
  reticle or outline, and a pick ray that hits only the remote ship resolves `null`. Allocation-free
  frame writes are T11's pinned `pose` contract (its 100% statement coverage); the scene calls
  `update` with the stored tier list and no per-frame allocation. Evidence: `scene.test.ts` — the
  three budget/tier/picking tests; `cube-view.test.ts`, `world.test.ts` for the origin reads.
- **AC-25 — met.** Construction applies `shotStyleForPart(appearance.shot ?? 'shot-default')` before
  the first snapshot (`shot-orca-violet` → `shot-wave`, scale 1.2, `#6d28d9`/`#c4b5fd`); a
  normalized snapshot change switches the next shot (`shot-kite-solar` → `shot-orb`, 0.95,
  `#f59e0b`/`#fef3c7` while the first stays a bolt); the identical record and a same-style record
  with another slot changed write no material colour; absent/unknown `shot` falls back to
  `shot-default` (`shot-bolt`, 1, `#fff1c8`/`#ffd27a`), including returning to default after a valid
  style. Evidence: `scene-spaceship.test.ts` — four `own-ship shot style wiring (AC-25)` tests.
- **AC-26 — met (scene integration half).** After `setSpectatedAppearance('p2', { hull:
  'hull-dart-aurum', shot: 'shot-orca-violet' })`, the mounted model identity is unchanged (no
  remount/dispose) and the next remote removal spawns the owner's style: `shot-wave` torus geometry,
  scale `[1.2, 1.2, 1.2]`, projectile material `#6d28d9`. A repeated record performs no
  material/transform write (`applyAppearance` changed list `[]`); geometry/muzzle capture at spawn
  and the `MOTION.shotMuzzleFlashMs` duration are T11's `remote-ship.test.ts` evidence. Live style
  changes make the spectator see a different projectile and muzzle (AC-26). Evidence: `scene.test.ts`
  — `re-skins the mounted model in place…`.

## Deviations from spec

- **`src/frontend/src/game/session.test.ts` (T13-owned) gained two inert methods.** Expanding the
  `SceneView` interface with `setSpectatedMember()`/`setSpectatedAppearance()` made the test's
  `SceneView` delegate literal incomplete, so it received two no-op methods with a comment naming
  this log. This is a mechanical compile-compatibility fixture, not a behaviour change: no existing
  assertion, expectation or production `session.ts` line was touched. T13 owns the real spectate
  wiring.
- **One pre-existing assertion in `scene-spaceship.test.ts` was updated, not weakened.** The
  `lastAppearance` expectation now pins the v3-normalized record (`{ body: 'body-gold' }` →
  `{ hull: 'hull-gold' }`), because `applySnapshot` now normalizes through
  `normalizeAppearanceV3` (AC-5/AC-17). It remains a concrete full-value assertion; the mutation
  guard on the returned copy is unchanged.
- **One pre-existing interface test in `cube-view.test.ts` was updated.** Its exhaustive key list
  gained `tileOrigin`; no assertion was removed.
- No other spec deviation. The brief estimated nine new scene tests; the final diff contains ten
  (the suite list above), which is the authoritative count.

## Scope / diff checks

- Stage set: exactly the nine paths in the header — seven T12-owned render files, the T13-owned
  `session.test.ts` fixture catch-up, and this log.
- `git diff --check` → EXIT 0.
- No changes to `src/backend`, `game/engine.ts`, production `game/session.ts`, `ui/**`, production
  `multiplayer/**`, `parts-v2*`, `package.json`, any lockfile, compose/Docker assets or `.env*`.
- Two pre-existing unrelated dirty paths (`docs/features/README.md`, the coin-economy `status.md`/
  `reviews/code-r2.md` edits) were already modified before T12 and are deliberately left unstaged.
- After the feature commit and the hash-record commit, `git status --porcelain` shows only this
  feature's untracked orchestrator-owned artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`,
  `reviews/`) plus those pre-existing modifications.
