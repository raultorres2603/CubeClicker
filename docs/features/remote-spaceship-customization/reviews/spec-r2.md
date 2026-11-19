---
feature: remote-spaceship-customization
iteration: 2
mode: spec
verdict: changes_requested
blocking: 2
nonblocking: 5
reviewed: 2026-11-18
---
# Spec Review — r2

## Verdict rationale

The r2 revision is materially better than r1: the catalog arithmetic, AC-30 control counts, the
measured 135/146/210/322 scene baseline, the optional `MemberState.appearance`, the `coin-economy`
sequencing gate, the 24-member welcome fixture, the live re-skin path and the documentation scope
all check out. F1, F3–F7, F9–F16, F18 and F19 are fixed; F2 and F17 are only partly fixed.

The spec is still **not buildable/testable as written**: AC-22's object/draw arithmetic remains
wrong after the r2 hierarchy change. The pinned hierarchy adds a separate `remote-ship-body`
`Group`, so the mounted ship contributes **36** objects at rest (manager + root + body + 32-object
`cursor-ship-model` + shots group), **38** with two in-flight bolts and **39** with a live muzzle
mesh — not "exactly 37". AC-22's own decomposition omits the body and its "exactly 37" contradicts
its "at most 2 shot meshes"; the fixture does not pin the shot state, so **183/247/359 cannot be
reproduced**, and AC-34, § Context, § Assumptions, plan R6, T11/T12/T18 and two supersession rows
inherit the error. That is a blocking exact-acceptance contradiction.

A second, independent MAJOR: the plan applies `chassisPose(form)` to the `cursor-ship-model` group,
but the accepted `Spaceship.update` overwrites `model.group.scale` every frame through
`applyPulse()` (the equip pulse). The own cursor's chassis scale is therefore lost after the first
update; no task owns the composition, and AC-17's `[0.95, 0.9, 1.25]` assertion only holds
immediately after `applyAppearance`.

The remaining findings are MINOR: supersession-ledger imprecisions, T17/T18 evidence gaps for
AC-34/AC-3/AC-35, the same-server two-tab fan-out wording in AC-10, the trailing-vs-reset window
wording in AC-12, and the `CURSOR_SLOT_SHAPE_TRANSFORMS` import assumption. This is the final
allowed spec round; a `changes_requested` verdict escalates the feature per `status.md`.

## Findings

| id | severity | area | location | issue | required change |
| --- | --- | --- | --- | --- | --- |
| N1 | BLOCKER | Object/draw arithmetic | `spec.md` AC-22 (lines 352–362), AC-34 (line 481), § Context (lines 64–69), § Assumptions (lines 785–787); `plan.md` § Remote ship hierarchy (lines 91–94), R6 (lines 425–428); `tasks.md` T11 (line 166), T12 (line 177), T18 (line 250); supersession rows `spaceship-cursor-loot-animations` AC-8 (line 107) and `multiplayer-servers` AC-13 (line 118) | AC-22's decomposition is `1 manager + 1 root + 32 cursor-ship-model objects + 1 shots group + at most 2 shot meshes = 37`, but AC-16 and the plan pin a **separate `remote-ship-body` child** between the root and the model. `cursor-ship-model` is exactly 32 objects (model root + 10 slot groups + 21 meshes; `cursor-ship.ts:9-12,52`), so the mounted ship adds **36** objects at rest, **38** with two in-flight bolts and **39** with the live muzzle mesh required by AC-24/AC-26 (`Shot.muzzleFlash` in `spaceship.ts:93-108,633-643`). The draw bound is **24** at peak (21 model + 2 bolts + 1 live muzzle), not 23; two muzzle flashes cannot overlap because the 90 ms spawn interval exceeds the 80 ms flash. AC-22 says "exactly 37" while its own text says "at most 2 shot meshes", so it is not exact under any reading. The fixture does not pin the shot state, so 183/247/359 are unreproducible: with the body and no shots the counts are **182/246/358**; with two bolts **184/248/360**; with a muzzle **185/249/361**. AC-34's "183-object" doc line and the plan/task/supersession 37/23 claims inherit the error. | Re-derive the count with the body and the muzzle in the decomposition; pin the fixture's shot state and muzzle lifetime (e.g. idle: 36 objects / 21 draws → 182/246/358; or 2 bolts + 1 muzzle: 39 objects / 24 draws → 185/249/361); update AC-22, AC-34, § Context, § Assumptions, plan R6, T11/T12/T18 and the AC-8/AC-13 supersession rows. Do not combine "exactly N" with a variable shot count. |
| N2 | MAJOR | Chassis vs equip pulse | `plan.md` § Form transform formula (lines 85–88); `spec.md` AC-17 (lines 316–317); source `src/frontend/src/render/spaceship.ts:597-604`, `src/frontend/src/render/cursor-ship.ts:243-257`; `tasks.md` T9/T10 (lines 135–155) | The plan applies `chassisPose(form)` to the `cursor-ship-model` group via `CursorShipModel.applyAppearance`, and AC-17 asserts the model group's chassis scale `[0.95, 0.9, 1.25]`. But `Spaceship.update` calls `applyPulse()` every frame, which executes `model.group.scale.setScalar(pulseScale)` (1 at rest). The own cursor's chassis scale is therefore overwritten after the first update; AC-17's assertion only holds immediately after `applyAppearance`, not in the rendered scene. The remote ship and preview (which do not use `Spaceship`) would show the chassis, so the own and remote/preview ships disagree. No task owns the composition: T9 owns `cursor-ship.ts` but not `spaceship.ts`; T10 owns `spaceship.ts`, but its task and ACs are shot visuals only. | Define the composition (store the chassis triple in `CursorShipModel` and expose a pulse-scale application that multiplies it; have `Spaceship.applyPulse` call it), assign the `spaceship.ts` edit to T9 or T10, and add a `scene.test.ts`/`cursor-ship.test.ts` assertion after an update at rest and at pulse peak (with the v2 classic `[1,1,1]` case). If the intent is to drop the equip pulse for generated chassis, state that in the supersession ledger. |
| N3 | MINOR | Supersession ledger | `spec.md` § Supersession table, `spaceship-cursor-loot-animations` AC-15/AC-16 row (line 111), `adaptive-render-budget-v2` row (line 117), `multiplayer-servers` AC-13 row (line 118) | (a) The AC-15/AC-16 row lists AC-15 (migration 006 legacy backfill) as superseded, although AC-36 pins "no schema or migration change" and only AC-16's read normalization widens; a builder could read the row as license to edit the migration. (b) The `adaptive-render-budget-v2` row attributes a "scene object/draw baseline" to that spec's § Quality tier budget, but that section is the GPU/CPU tier matrix; the scene object/draw baseline is `spaceship-cursor-loot-animations` AC-8/AC-47 and `multiplayer-servers` AC-13. (c) The `multiplayer-servers` row quotes "≤ X cube views", but AC-13's drawable bound is "≤ X × 7 meshes per world"; the layout/one-view rule is retained, only the drawable bound changes. (d) The 37/23 numbers in the AC-8 and AC-13 rows are N1. | Retitle the AC-15/AC-16 row to AC-16 (read normalization) and explicitly keep AC-15/migration 006 in force; reframe the adaptive row as "tier matrix unchanged; the remote ship consumes the hidden-detail list" and cite AC-8/AC-47 + `multiplayer-servers` AC-13 for the scene baseline; correct the AC-13 quote to "≤ X × 7 meshes"; update the 37/23 numbers per N1. |
| N4 | MINOR | Task evidence gaps | `tasks.md` T17 verify (line 231) and prose (line 235), T18 verify (line 244); `spec.md` AC-34 (lines 470–490), AC-3 (lines 182–188), AC-35 (lines 491–497) | (a) AC-34 requires the exact README phrases `form and finish picker` and `shot styles`, but T17's verify greps only `remote player spaceships` and `1,351 spaceship parts`; T17's prose says "form+finish picker" (not the exact phrase) and never says `shot styles`, so a builder following T17 can fail AC-34. (b) T18's `git diff --exit-code` omits `src/backend/src/game/parts-v2.test.ts`, `src/frontend/src/game/parts-v2.test.ts`, `src/backend/src/server.ts` and `docs/features/README.md`, although the plan's "Untouched (asserted by diff gates)" lists them and AC-3/AC-34/AC-35 require them; no task verify runs AC-34's `git status --porcelain -- docs/features ...`. | Add `grep -F "form and finish picker" README.md` and `grep -F "shot styles" README.md` (and use the exact phrases in T17's prose); extend T18's diff command with both `parts-v2.test.ts` paths and `src/backend/src/server.ts`, and add the `git status --porcelain -- docs/features ':(exclude)docs/features/remote-spaceship-customization'` check to T17/T18 verify. |
| N5 | MINOR | Multi-client wording | `spec.md` AC-10 (lines 245–251), § Real-time impact — Multi-client (lines 717–719); `plan.md` `broadcastMemberAppearance` (lines 226–227); `tasks.md` T6 (lines 100–110) | AC-10 says "exactly one `memberAppearance` frame is emitted per affected member's server" and its parenthetical covers only two tabs on two servers; § Real-time impact says "one frame per affected server". If two tabs of one account are on the **same** server, the former implies two frames (one per affected member/playerId), the latter one; a single frame for one playerId would leave the sibling tab's roster entry stale. The hub plan's `broadcastMemberAppearance(member)` is per member, but the test strategy only pins the two-server case. | State the same-server rule explicitly: one frame per affected member/playerId on that member's server; two tabs on the same server ⇒ two frames; two tabs on two servers ⇒ one frame on each server. Update § Real-time impact and add a `hub.test.ts` same-server two-tab fixture. |
| N6 | MINOR | Rate-limit wording | `spec.md` AC-12 (lines 258–260); source `src/backend/src/game/hub.ts:1225-1240` (`RATE_WINDOW_MS = 1000`) | "per trailing 1000 ms" (sliding) contradicts "the window resets after 1000 ms" (fixed). The accepted hub limiter is a true trailing window; a test written to the fixed-window reading can pass/fail differently at the boundary (e.g. 10 frames at t=0…900, 11th at t=950 vs t=1000). `hub.test.ts` with fake timers is the named evidence, so the boundary must be pinned. | Say "true trailing window: an admitted frame is forgotten at `now − 1000 ms` (`<=`), so the 11th within any 1000 ms interval is dropped; the first admitted frame at t=0 permits a new frame at t=1000." Or explicitly choose a fixed window and update the codebase pattern. |
| N7 | MINOR | Module layering | `plan.md` § Assumptions (lines 455–456), § Form transform formula (lines 85–89); `tasks.md` T9 (lines 135–144); `spec.md` § Boundaries (lines 599–600) | The plan says `CURSOR_SLOT_SHAPE_TRANSFORMS` is "imported by the new resolution helper rather than duplicated in `ship-forms.ts`", but `game/ship-forms.ts` is a pure `game/**` module and must not import `render/**` (three.js); `render/cursor-ship.ts` will import `ship-forms.ts` for the formula, so if the resolution helper lives in `ship-forms.ts`, the import is a cycle and a layer violation. If the helper lives in `cursor-ship.ts`, it already owns the table and does not need to import it. The location is unspecified. | Pin the resolution helper in `render/cursor-ship.ts` (or move the v2 table to a pure module) and state that `game/ship-forms.ts` imports only pure `game/**` modules; add an import-boundary check if the project has one. |

## F1–F19 disposition (r2 verification)

| Finding (r1) | r1 severity | r2 disposition | Evidence / remaining issue |
| --- | --- | --- | --- |
| F1 — AC-30 all-owned `Shots` count | BLOCKER | Fixed | AC-30 now gives empty 26/13, all-owned classic 30/13 and generated 48/24; all four fixtures are derivable from AC-28/AC-1/AC-27. Verified. |
| F2 — AC-22 baseline / 173 | BLOCKER | **Partially fixed — reopened by N1** | The measured 135/146/210/322 baseline is correct (re-measured with the real `createSceneView`/`createWorldView`), but the ship delta is still wrong: 37 omits the body and 183/247/359 assume that wrong delta. |
| F3 — required `MemberState.appearance` breaks fixtures | BLOCKER | Fixed | AC-7 makes the field optional on the wire, the server always populates it, and `memberAppearanceOf` fills `{}` in `copyMember`, `reduceWorldState` and the `SceneWorld` roster copy; the named fixtures compile untouched. |
| F4 — `coin-economy` gate | BLOCKER | Fixed | `coin-economy` is `building` after code-review r1; its open F1/F2 are in `engine.test.ts` (MAJOR) and F3 in `hub.test.ts` (MINOR). T3/T5/T6/T8/T13/T17 are gated, all shared files are listed, and T8's `[P]` waiver is stated. |
| F5 — 24-member welcome bound | MAJOR | Fixed | AC-14 pins the 24-guest `removedIds: []` + full 11-entry appearance + no `customization` fixture at ≤ 17,408 B (measured 16,710 B), ≤ 550 B/member appearance, and states `MAX_MESSAGE_BYTES` is incoming-only; the full-inventory 51,763 B welcome is out of bound. |
| F6 — live `memberAppearance` on the mounted ship | MAJOR | Fixed | AC-15 adds `SceneView.setSpectatedAppearance`; AC-17 pins the live re-skin without remount; T12/T13 carry the wiring and evidence. |
| F7 — preview files / v3 mapping | MAJOR | Fixed | `render/preview.ts` + test are T9; `ui/SpaceshipPreview.tsx` + test are T15; T15 depends on T9; AC-31 pins the 11-slot mapping, ten v3-valued attributes and legacy colours from v3. |
| F8 — stale documentation | MAJOR | Fixed except N4 | AC-34/T17 cover README, glossary `hangar tab`/`part slot`, observability allow-list, realtime and frontend-rendering; T17's verify still omits the `form and finish picker` and `shot styles` greps (N4). |
| F9 — guest self-view convergence | MAJOR | Fixed | AC-13(b) requires guest adoption of `welcome.roster[self].appearance` when the local record is empty, then at most one send on difference; `session.test.ts` is the evidence. |
| F10 — panel v3 normalizer switch | MAJOR | Fixed | T15 switches `normalizePartMap`/`normalizeAppearance`/`isValidPartId`/`partDefinition`/`partsForSlot` to v3 and adds a generated-v3-id + `shot` panel test; AC-5/AC-31 updated. |
| F11 — per-strip roving tabindex | MINOR | Fixed | AC-29 pins exactly one `tabindex="0"` per `.customization-forms` strip (two on a ship tab, one on `Shots`). |
| F12 — worst id length | MINOR | Fixed | AC-2/AC-9/AC-14 use the 30-character `ignition-right-bulwark-crimson` id and the measured 492 B `memberAppearance`. |
| F13 — `NaN`/infinity loot map | MINOR | Fixed | AC-4 pins `NaN → 0`, `-Infinity → 0`, `Infinity → 1`; matches `parts-v2.ts`'s accepted clamp. |
| F14 — aim vs idle motion | MINOR | Fixed | AC-16/AC-19 put aim on the `remote-ship` root and bob/sway/recoil on the `remote-ship-body` child; AC-16 measures at rest. |
| F15 — recoil token/curve | MINOR | Fixed | AC-20 pins `MOTION.remoteShipRecoilMs === 120`, the `-0.12` offset and the `0 / 60 / 120 ms` values; dropped shots start no recoil. |
| F16 — dead `burst` field | MINOR | Fixed | `burst` is replaced by the consumed `muzzle` form (`spark`/`ring`/`petal`) with three prebuilt muzzle geometries in AC-24 and remote use in AC-26. |
| F17 — supersession ledger | MINOR | **Partially fixed — N3/N1** | Rows for AC-7, AC-8, AC-31, `adaptive-render-budget-v2` and `multiplayer-servers` AC-13 were added; residual AC-15/AC-16, adaptive-row and AC-13-quote imprecisions remain, and the 37/23 count is still wrong. |
| F18 — bundle claim | MINOR | Fixed | AC-33/§ Context/§ Assumptions use ≈ 14.4 KB gzip, ≈ 114.4 KB initial, ≈ 295.8 KB total and ≈ 4 KB total headroom; T18 gates the exact deltas. |
| F19 — account join/rejoin seeding | MINOR | Fixed | AC-13(a) requires an account member's `appearance` to be seeded from the persisted customization at join and rejoin, with `hub.test.ts` evidence. |
| F20 — raw request coverage | INFO | Acknowledged | Other players' ships with their customizations while spectating (Q-1), 1,000+ distinct customizations (1,351), chassis/forms, shot styles, guest/account behaviour and server authority are covered; Q-2/Q-5–Q-8 are pinned, Q-1/Q-3/Q-4 remain user-owned. |

## Checks performed

- Recomputed the catalog from the pinned tables: 11 slots × (3 classic + 10 × 12 generated) + 121
  `shot` rows = **1,351**; per-slot 123/121; **1,340** lootable; **11** standard; **670** rare /
  **670** epic; weight **2,680**; 75 %/25 %; per-part 3/2,680 and 1/2,680; boundaries `rng 0 →
  hull-obsidian`, `rng 0.999999` and `1 → shot-kite-solar`; unique ids/names; longest id **30**
  (`ignition-right-bulwark-crimson`); `hull-dart-chrome` row verbatim; the 30 v2 rows preserved in
  v2 order. No new catalog finding.
- Derived all four AC-30 fixtures from AC-28/AC-1/AC-27: empty **26/13**, all-owned classic
  **30/13**, all-owned generated **48/24**. Verified consistent.
- Independently measured the real scene counts with `createSceneView`/`createWorldView` (the existing
  `scene.test.ts` also pins 135): **135** no world, **146** one remote member, **210** nine, **322**
  twenty-three. Verified the world group children (2/10/24) and the per-member additions.
- Measured the model hierarchy: `CursorShipModel` is **32** objects (model root + 10 slot groups + 21
  meshes; `cursor-ship.ts:9-12,52`). Composed the AC-16 hierarchy with the real model:
  manager + root + body + model + shots group = **36** at rest; +1 bolt = 37; +2 bolts = **38**;
  +2 bolts + 1 live muzzle = **39**. Confirmed `Shot.muzzleFlash` is a separate mesh and the flash
  is 80 ms while the minimum shot interval is 90 ms, so at most one muzzle is live (peak **24**
  draws: 21 model + 2 bolts + 1 muzzle). This is the N1 evidence.
- Inspected `spaceship.ts`: `applyPulse()` writes `model.group.scale.setScalar(pulseScale)` every
  update; `applyAppearance` is the only chassis path in the plan, and no task owns the composition.
  This is the N2 evidence. Also checked `parts-v2.ts` AC-17 values (`hull-obsidian` `#1a2333` /
  `armored`, `wing-left-gold` `#ccaa44`, `hull-gold` `#ccaa44`/`#fff3d6`), `CUBE_SIZE = 5` and the
  `2.75` fallback tile plane.
- Inspected the backend protocol/hub: `MAX_MESSAGE_BYTES` is incoming-only (the caller drops
  oversized frames); `memberState()`/`rosterFor()` are the only roster builders and `memberJoined`
  uses `memberState()`; the hub's rate limiter is a true trailing 1 s window
  (`RATE_WINDOW_MS = 1000`, expiry at `<= now − 1000`). The AC-10 same-server and AC-12 wording
  findings follow.
- Checked `coin-economy/status.md` and `reviews/code-r1.md`: state `building` after code-review r1;
  open **F1/F2 (MAJOR) in `engine.test.ts`** and **F3 (MINOR) in `hub.test.ts`**. The T3/T5/T6/T8/
  T13/T17 gate and the full shared-file list (including `protocol.test.ts`, `economy-repository.test.ts`,
  `session.test.ts`, `glossary.md`) are correct; T8's `[P]` waiver is stated.
- Checked the supersession ledger against the predecessor specs: `spaceship-cursor-loot-animations`
  AC-7/AC-8/AC-10/AC-11/AC-13/AC-15/AC-16/AC-21/AC-22/AC-29/AC-30/AC-31/AC-47,
  `hangar-tabs-and-menu-motion` AC-1/AC-2/AC-3/AC-5/AC-10, `game-feel-overhaul` AC-21,
  `adaptive-render-budget-v2` AC-5, `multiplayer-servers` AC-13, and the `realtime-broadcast-batching`
  metrics allow-lists. The missing rows were added; N3 records the residual imprecisions.
- Checked T17's grep recipe and T18's diff gate: missing `form and finish picker` / `shot styles`
  greps and the `parts-v2.test.ts` (both), `server.ts` and `docs/features/README.md` diff paths
  (N4). `docs/features/README.md` is correctly proposal-only in T17, but no task verify runs the
  AC-34 `git status` check.
- Checked the AC↔task mapping and DAG: all AC-1…AC-36 are mapped; dependencies point earlier; the
  `[P]` sets (T1∥T2, T4∥T5, T8∥T9∥T14, T15∥T16) are file-disjoint; T8 is gated; T15 depends on T9;
  preview files and `App.test.tsx` have owners. One process note is in the backlog (T1∥T2 hash
  cross-check).
- Checked docs/architecture/containerization.md and the smoke path: no new service, image, port,
  environment variable or deployable; `GET /ws` unchanged; `compose.smoke.yaml` sets
  `MAX_USERS_PER_SERVER=2`, so the AC-35 guest A/B check is feasible. The frontend bundle report
  (initial 95,903 B / three 154,323 B / total 273,854 B) and the spec's 99,970 / 281,381 B plus the
  ≈ 14.4 KB catalog leave ≈ 4 KB total headroom under 300,000 B; AC-33 gates it.
- Checked security: the only new client-authored value is guest `setAppearance`, codec-bounded
  (≤ 11 entries, known slots, ≤ 40-char values, ≤ 700 B), hub-normalized against the catalog, and
  cosmetic-only; no inventory/account/coins/tokens on the new path; no new dependency, secret,
  schema or migration; rollback degradation is stated (AC-36).
- Checked documentation scope: AC-34 covers README, realtime `## Public appearance projection`,
  frontend-rendering `## Remote ships`, observability allow-list, glossary terms and the
  proposal-only features index; the README's required exact phrases and the 183 baseline are the
  open items (N1/N4).

## Residual backlog / open questions

- **Q-1 (spectated-only visibility), Q-3 (loot pacing), Q-4 (guest structural authority)** remain
  user-owned per `status.md`; no planner-introduced silent deviation found. Q-2/Q-5–Q-8 are pinned.
- **T1∥T2 hash parity.** T2's task says its `CATALOG_ROWS_HASH` literal "must match T1's recorded
  value", but T1 and T2 are marked `[P]` and may run concurrently; the cross-check has no owner
  during T2. The hash is deterministic, so T2 can assert its own literal, but T18 should compare
  both build logs or T2 should depend on T1. Non-blocking process note.
- **N1 correction detail.** The prior reviewer's "37–39 objects / 25 draws" is close but not exact:
  the lower bound is **36** with no shots, and the peak is **39** objects / **24** draws with two
  bolts plus one live muzzle (two muzzle flashes cannot overlap at 90 ms spawn / 80 ms flash).
  The planner should use the measured state, not the range.
- **N2 composition detail.** If the planner chooses to keep the equip pulse, the chassis must be
  multiplied into the pulse scale; if the planner chooses to drop the pulse for generated chassis,
  that is a supersession of the accepted pulse and must be recorded. Do not leave both unspecified.
- **N4 evidence detail.** AC-34 is testable as written; the gaps are in the T17/T18 recipes, so the
  code gate can still reproduce them if the builder reads the ACs. The tasks should carry the exact
  commands to avoid a false green.
- **N5/N6 fixtures.** Add a `hub.test.ts` same-server two-tab `memberAppearance` fixture and a
  fake-timer 10/11th-setAppearance boundary sequence so the wording is pinned by tests, not prose.
- **N7 helper location.** Pin the `slotFormTransform`/v2-table resolution helper in
  `render/cursor-ship.ts` (or a pure module) before T9; `game/ship-forms.ts` must stay free of
  three.js imports.
