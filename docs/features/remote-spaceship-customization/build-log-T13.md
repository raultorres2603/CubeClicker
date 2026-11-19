# Build log — T13 — Session convergence, spectate and live appearance wiring

Task: T13 (2026-11-19)
Files changed: `src/frontend/src/game/session.ts`, `src/frontend/src/game/session.test.ts`, `docs/features/remote-spaceship-customization/build-log-T13.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `<pending>` — `feat: wire guest appearance and spectate convergence` (not pushed; the real hash is recorded in the follow-up `docs:` commit, mirroring T1/T2/T8/T12)

## Sketch (≤5 lines)

- Guest `welcome` convergence: adopt `roster[self].appearance` into the engine only when the local
  normalized record is empty, then send exactly one `setAppearance` per welcome iff the resulting
  non-empty record differs from the roster self entry; accounts are never reported.
- Guest `equipPart`/`unequipPart`: compare the normalized record before/after and report one
  `setAppearance` only for an accepted local change (a no-op/unowned/unknown id sends nothing).
- `memberAppearance` → reducer has already stored it; re-skin the mounted ship in place only when it
  is the currently viewed member.
- Spectate lifecycle: mount the ship on arrival **after** `applySnapshot` (the scene refuses a mount
  while its retained snapshot still says `travel`), release it on return/`memberLeft`/`welcome`/
  status change/retry/dispose, and re-apply the live projection after the mount and after a remote
  `levelAdvanced` rebuild (the scene world does not consume `memberAppearance`).
- Tests: guest convergence matrix + spectate lifecycle/live-appearance suite; run lint/typecheck/
  frontend suite/frontend coverage and record raw output.

## What changed & why

- **`session.ts` (+173/−3).**
  - `sameAppearanceRecord(a, b)` compares two normalized slot→part records entry by entry (key
    order independent) for every send/skip decision.
  - `lastSentAppearance` tracks the normalized record the server is known to hold: seeded from the
    `welcome` roster self entry, updated on every accepted `setAppearance`.
  - `sendGuestAppearance(appearance)` is the single guest-report gate: never for an account
    (`joinedMode === 'account'`), never for an offline/not-welcomed session, never for a record the
    server already holds. It normalizes through `normalizeAppearanceV3`, copies the outgoing record,
    and records it only after `transport.send`.
  - `convergeGuestAppearance(welcome)` (AC-13 b): skips accounts (`joinedMode` or
    `identity.kind === 'account'`), resolves the roster self entry through
    `normalizeAppearanceV3(memberAppearanceOf(entry))`, seeds `lastSentAppearance` from it,
    adopts it with `engine.adoptAppearance` when the local normalized record is empty, then reports
    once when the resulting record is non-empty and differs from the roster entry. A guest whose
    local record already matches the roster reports nothing.
  - `equipPart`/`unequipPart` (guest): read the normalized engine record before and after the
    engine call and report only when it actually changed — one `setAppearance` per accepted local
    change, none for an unowned/unknown id or a repeated equip. The account paths are untouched
    (`equipPart`/`unequipPart` messages).
  - `handleMemberAppearance` + `syncSpectatedAppearance`: the reducer stores the projection; the
    session calls `scene.setSpectatedAppearance(playerId, memberAppearanceOf(member))` only when
    `spectate.mode === 'viewing' && target === playerId` (self/unknown/non-spectated ids are
    no-ops).
  - Spectate lifecycle calls: `setSpectatedMember(null)` on `welcome` (join and resume), on
    `memberLeft` for the affected member, on every transport status transition, on the return
    flight start (`returnToOwnCube`) and on `retryConnection`; `pendingSpectatedMount` is cleared on
    all of those and on teardown.
  - Arrival mounting: `handleTravelArrival` records `pendingSpectatedMount = target`; the frame
    loop mounts it right after `view.applySnapshot(...)` applied the arrival's `playing` snapshot,
    then immediately calls `syncSpectatedAppearance(target)` so a `memberAppearance` received
    during the flight is honoured.
  - Post-`levelAdvanced` resync: after `activeScene.applyWorldMessage(message)`, the session calls
    `syncSpectatedAppearance(message.playerId)` so the live projection survives the scene's
    remote-cube rebuild (seam note below).
- **`session.test.ts` (+491/−5).** Two new suites, 12 new tests and two updated pre-existing
  expectations:
  - `guest appearance convergence (AC-13)` (6): adoption when empty + no report; non-empty local
    record differing from the roster reported once; a differing roster reported once **per
    welcome** (a resume welcome is not suppressed by the previous connection's send); equal
    record reported never; account never adopts/reports (and equips through `equipPart` only);
    one report per accepted local equip and per unequip, none for a repeated equip.
  - `remote ship spectate lifecycle and live appearance (AC-15)` (6): mount only on the arrival
    frame (nothing during the flight) and release at the return start; release only for the
    departing spectated member; clear on status transitions and a resume `welcome`; in-place
    re-skin on a matching `memberAppearance` with concrete hull colour `1a2333 → ccaa44`, the
    stored `world.members` projection and the same model identity; re-apply after a remote
    `levelAdvanced` rebuild (colour stays `ccaa44`, no remount); ignore self/unknown/non-spectated
    updates.
  - The suite observes the two T12 hooks through `instrumentSceneView(view, calls)`, a
    prototype-delegating wrapper that records `setSpectatedMember`/`setSpectatedAppearance` calls
    and then runs the real `SceneView` method, plus the `sceneCalls` option threaded through
    `createFakeEnv`. The real three.js scene, `RemoteShip` and respawn/removal path still execute,
    so the assertions read the rendered subtree (ship presence, hull material colour, object
    identity), not a mock's return values.

## Decisions

1. **Adopt first, then one report on difference (AC-13 b).** The engine adoption happens only when
   the local normalized record is empty; a non-empty local record is never replaced by the roster
   copy. The report decision is made per `welcome` against the roster self entry: the finish pass
   seeds `lastSentAppearance` from that entry before comparing, so a resume welcome where the
   server copy still differs reports exactly one `setAppearance` instead of being suppressed by an
   earlier connection's send. The loader/mode guard (`joinedMode`) and the frame's identity guard
   (`identity.kind`) both exempt accounts; a guest report is additionally gated on `canRun()`.
2. **One report per accepted local change.** `equipPart`/`unequipPart` compare the normalized
   before/after records instead of inspecting the event or the engine's internal acceptance result,
   so an unowned/unknown id, a wrong-slot id or a repeated equip produces zero sends; a real change
   (including unequipping back to `{}`) produces exactly one. `sendGuestAppearance`'s dedupe keeps
   the local-change path and the welcome path sharing one "server already holds this" rule.
3. **Arrival mount is deferred until after `applySnapshot`.** `SceneView.setSpectatedMember`
   intentionally refuses to mount while its retained snapshot still says `travel`; calling it from
   `handleTravelArrival` would be discarded. The session stores `pendingSpectatedMount` and mounts
   from the frame after the `playing` snapshot is applied, which also keeps the ship absent during
   the whole camera-only flight (AC-15).
4. **Post-mount and post-`levelAdvanced` resync (T13/T12 seam).** `render/world.ts` does not
   consume `memberAppearance`: its roster copy is built from `welcome`/`memberJoined`/`levelAdvanced`
   payloads, and a `levelAdvanced` rebuild re-skins from that stale copy. The session therefore
   re-applies its authoritative world projection right after mounting and right after
   `applyWorldMessage` handles a remote `levelAdvanced`. `setSpectatedAppearance` is idempotent
   (the ship's `applyAppearance` skips an unchanged record), so the extra call is a no-op when the
   scene already had the right copy. If the feature review prefers the scene/world to own the
   projection, that is a T12 follow-up; T13 does not edit `render/**`.
5. **Explicit lifecycle releases at every boundary.** `welcome` (join/resume), the departing
   `memberLeft`, every transport status transition (including back to `connected`), the return
   flight start and `retryConnection` each call `setSpectatedMember(null)` and clear
   `pendingSpectatedMount`; `dispose`/teardown clears both. The scene's own same-id/`null`
   idempotence keeps the extra calls free.
6. **Account guard is producer-side only.** Accounts keep the accepted protocol paths
   (`equipPart`/`unequipPart`, server `customizationUpdate`) and never receive a client
   `setAppearance`; the guard is in the session, not in the wire codec.
7. **Test seam over a full mock.** `instrumentSceneView` uses `Object.create(view)` and overrides
   only the two observed methods, so every other scene behaviour (world rebuild, remote-ship
   mount/dispose, material writes) is the real production code. This is the smallest seam that
   records the session's call sequence while keeping the assertions on real rendered state.
8. **Test-tier note.** The new tests are integration-tier (`session.test.ts` drives the real
   engine, reducer, transport double and three.js scene through the session boundary); the pure
   before/after comparison and the account/guest gate are exercised through that same public
   boundary, so no separate unit module was added. No containerized tier applies: T13 changes no
   service boundary, frame routing or runtime config (T16 owns the smoke check).

## Evidence

All four commands below were run on the **final tree** (after the finish-pass fixes, including the
`lastSentAppearance` seeding and the two extra tests).

### `npm run lint`

```
$ npm run lint

> lint
> eslint .

EXIT:0
```

### `npm run typecheck`

```
$ npm run typecheck

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
      Tests  2844 passed (2844)
   Start at  10:25:38
   Duration  4.06s (transform 10.64s, setup 0ms, collect 26.45s, tests 16.71s, environment 11.46s, prepare 6.99s)

EXIT:0
```

The frontend workspace total grew from 2,832 (T8 follow-up) to 2,844 = +12 new tests. The focused
suite `npx vitest run src/game/session.test.ts --root src/frontend` reports
`Test Files 1 passed (1)` / `Tests 144 passed (144)` / `EXIT:0` (132 pre-existing + 12 new).
(`HTMLCanvasElement.getContext()` / `THREE.WebGLRenderer` stderr lines are the pre-existing jsdom
WebGL fallback noise from the UI suites; every file and test passes.)

### `npm run coverage --workspace @cubeclicker/frontend`

```
 Test Files  83 passed (83)
      Tests  2844 passed (2844)
   Start at  10:25:42
   Duration  5.98s (transform 10.75s, setup 0ms, collect 28.10s, tests 25.24s, environment 12.63s, prepare 8.13s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.15 |    96.75 |   98.36 |   97.15 |
 src/game          |   97.02 |    99.51 |    99.16 |   97.02 |
  engine.ts        |   99.48 |      100 |     100 |   99.48 | 987-988,1297-1298
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   91.51 |    98.96 |   97.61 |   91.51 | ...1852,1989-1990

EXIT:0
```

Frontend aggregate **97.15 / 96.75 / 98.36 / 97.15** against the ≥ 80 statements/branches/
functions/lines gate. `session.ts` is **91.51 / 98.96 / 97.61 / 91.51**; the uncovered ranges are
the pre-existing host-only paths (orientation source early return, async loader error branch) and
not T13 behaviour. No coverage config, threshold or exclusion was changed by T13.

## Acceptance audit

- **AC-13 (b) — met (session half).** A guest whose local record is empty adopts
  `welcome.roster[self].appearance` through `engine.adoptAppearance` (normalized) and reports
  nothing; a non-empty local record is never replaced. The session sends exactly one `setAppearance`
  per welcome when the resulting non-empty record differs from the roster self entry (including a
  resume whose roster still differs), and none when they match. Accounts (`joinedMode ===
  'account'` or account identity) never adopt or report, and `equipPart` stays on the dedicated
  account message. Evidence: `session.test.ts` — the six `guest appearance convergence (AC-13)`
  tests, including the concrete `wire.sent` sequences
  `[{ type: 'setAppearance', appearance: { hull: 'hull-obsidian' } }]` and `[]`.
- **AC-15 — met (session half).** Exactly one ship exists and only while viewing: no mount during
  the spectate flight, one `setSpectatedMember('p2')` on the arrival frame (after `applySnapshot`),
  release on the return start (`null`) and no remount after landing; `memberLeft` releases only for
  the departing spectator target; every status transition and a resume `welcome` clear the ship;
  a matching `memberAppearance` re-skins the mounted model in place (same `Mesh` identity, hull
  colour `#1a2333 → #ccaa44`) and stores the projection on `world.members`; self/unknown/
  non-spectated updates perform no scene write and keep the world reference for unknown/self;
  the live projection survives the remote `levelAdvanced` rebuild. The scene-side mount gate,
  disposal-exactly-once and 36-object/21-draw budget are T12's `scene.test.ts` evidence; T13 proves
  the session's call sequence against the real scene. Evidence: the six
  `remote ship spectate lifecycle and live appearance (AC-15)` tests.
- **T13 scope — met.** Only `game/session.ts` and `game/session.test.ts` changed; no `render/**`,
  `multiplayer/**`, `engine.ts`, `ui/**`, backend, `parts-v2`, package/lockfile, compose/Docker or
  `.env*` edit. `git status --porcelain` shows only those two paths plus this log and the
  pre-existing unrelated docs modifications (see § Scope checks).

## Deviations from spec

- **Two pre-existing guest expectations in `session.test.ts` were updated, not weakened.**
  `applies guest local equip` now expects one `{ type: 'setAppearance', appearance:
  { nose: 'nose-crimson' } }` after the equip (previously `[]`), and asserts the welcome itself
  sends nothing. `applies guest local unequip` now seeds the roster self entry with the resumed
  guest's record (`{ nose: 'nose-crimson', 'tail-fin': 'tail-fin-split' }`) so the welcome reports
  nothing, then expects one `setAppearance` carrying the remaining
  `{ 'tail-fin': 'tail-fin-split' }` after the unequip. Both are the direct AC-13 b consequence for
  the guest rules; the local engine state assertions are unchanged and the expectations are exact
  full values.
- **New test helper `instrumentSceneView` and the `sceneCalls` fake-environment option.** The two
  T12 hooks are recorded through a prototype-delegating wrapper so the real `SceneView` still runs;
  this is the only way to observe the session's call sequence while keeping the AC-15 assertions on
  the rendered three.js subtree. It is a test-only seam, not a production interface change.
- **The prior partial pass's arrival/return test tick was corrected (test-only).** The return
  landing was asserted after `tick(2516)` even though the frame baseline was already at `2516`
  (so `dt = 0` and the flight could not advance); it now uses `tick(5016)`, matching the accepted
  spectate tests. No production line changed for this.
- **T13/T12 seam note (recorded for the review).** `render/world.ts` does not consume
  `memberAppearance`; T13 compensates by re-applying `scene.setSpectatedAppearance` after the
  arrival mount and after a remote `levelAdvanced`. If the reviewer prefers the scene world to own
  the live projection, that is a T12 follow-up; T13 must not edit `render/**`.
- No new dependency, no schema/migration, no assertion weakening (no wildcard/existential
  stand-ins added; all new assertions are exact values, exact call counts or exact records).

## Scope / diff checks

- Stage set (feature commit): `src/frontend/src/game/session.ts`,
  `src/frontend/src/game/session.test.ts`, this log.
- Pre-existing unrelated dirty paths (`docs/features/README.md`, the coin-economy
  `status.md`/`reviews/code-r2.md` edits) were modified before T13 and are deliberately left
  unstaged. The feature's orchestrator-owned artifacts (`spec.md`, `plan.md`, `tasks.md`,
  `status.md`, `reviews/`) stay untracked.
- Status/tasks/spec/plan/reviews were not edited by this task; the documentation pass is T17.
