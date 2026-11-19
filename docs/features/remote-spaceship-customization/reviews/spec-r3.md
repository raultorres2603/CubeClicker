---
feature: remote-spaceship-customization
iteration: 3
mode: spec
verdict: approved
blocking: 0
nonblocking: 3
reviewed: 2026-11-18
---
# Spec Review — r3

## Verdict rationale

r3 resolves N1–N7. The scene arithmetic is now internally consistent and matches the real hierarchy:
the mounted ship is **36 objects / 21 draws at rest** (manager 1 + root 1 + `remote-ship-body` 1 +
32-object `cursor-ship-model` + shots group 1), each bolt and each live muzzle adds +1/+1, two bolts
give **38 / 23** (scene **184 / 248 / 360**), and the two-bolt-plus-one-live-muzzle peak is
**39 / 24** (scene **185 / 249 / 361**), with idle totals **182 / 246 / 358** and exact restoration
of the measured 135/146/210/322 on disposal. The chassis × equip-pulse composition is now pinned
(`CursorShipModel.applyPulseScale`, `Spaceship.applyPulse` calls it, rest/peak/classic values) with
T9 owning the model API and T10 owning the `spaceship.ts` call. The ledger, T17/T18 evidence
commands, same-server two-tab fan-out, true trailing rate window, module layering and the T2→T1 hash
ownership all check out.

The remaining findings are non-blocking wording/evidence gaps: one AC-34 notation ambiguity, one
T4 task-prose over-claim, incomplete documentation coverage of existing sections the feature
invalidates, and one redundant T9 acceptance reference. They do not change the build or acceptance
outcome; the code gate's documentation check remains the enforcement point for the docs item.
Per the r3 budget override this is the final spec round, so this approval clears the feature to
building subject to the recorded `coin-economy` sequencing gate.

## N1–N7 disposition

| N | r2 severity | r3 disposition | Evidence |
| --- | --- | --- | --- |
| N1 — object/draw arithmetic | BLOCKER | Resolved | `spec.md` AC-22 pins 36 objects / 21 draws at rest, +1/+1 per bolt, +1/+1 per live muzzle, 38 / 23 two-bolt scene totals 184/248/360, peak 39 / 24 scene totals 185/249/361, idle 182/246/358, the lazy `remote-ships` manager and exact 135/146/210/322 restoration on dispose. `spec.md` § Context (lines 64–72), AC-34 (line 514), § Assumptions (lines 830–833), plan § Remote ship hierarchy (lines 100–107) and R6 (lines 449–453), `tasks.md` T11 (lines 174–177), T12 (lines 186–190), T18 (lines 262–265) and the AC-8/AC-13 supersession rows (lines 110, 121) use the same numbers. The 80 ms `MOTION.shotMuzzleFlashMs` vs. 90 ms `REMOTE_SHOT_MIN_INTERVAL_MS` really does bound the ship to one live muzzle. Remaining `37`/`183` strings are only the r2 revision-history row and the r1/r2 review files (clearly superseded). |
| N2 — chassis × equip pulse | MAJOR | Resolved | `spec.md` AC-17 pins `CursorShipModel.applyPulseScale(pulseScale)` writing `[chassis.x · pulse, chassis.y · pulse, chassis.z · pulse]`, `Spaceship.applyPulse()` calling it instead of `model.group.scale.setScalar(...)`, rest `[0.95, 0.9, 1.25]`, 130 ms peak `[0.988, 0.936, 1.3]` (within 1e-9) and classic `[1,1,1] → [1.04,1.04,1.04]`. `shipEquipPulseScale(130) === 1.04` and the current `applyPulse()` is still the `setScalar` writer, so the composition is real work. T9 owns `render/cursor-ship.ts` + `game/ship-forms.ts` and the model API; T10 owns `render/spaceship.ts`, depends on T9, and changes the call. `files_owned` are exclusive (18 tasks / 63 files, no duplicates); `spaceship.test.ts` and `scene.test.ts` are named in AC-17 and in T9/T10/T12. |
| N3 — supersession ledger | MINOR | Resolved | The `spaceship-cursor-loot-animations` row is now **AC-16 only** (read normalization) with **AC-15 and migration 006 explicitly retained** (also repeated in the "Not superseded — clarified" note). The `adaptive-render-budget-v2` row is reframed as "tier matrix unchanged; the section is not a scene object/draw baseline", citing AC-8/AC-47 + `multiplayer-servers` AC-13. The AC-13 quote is "≤ X × 7 meshes per world" and the AC-8/AC-13 numbers follow N1. |
| N4 — task evidence | MINOR | Resolved | `tasks.md` T17 verify greps exactly `grep -F "form and finish picker" README.md` and `grep -F "shot styles" README.md`; T17 prose uses both phrases. T18's diff gate includes both `parts-v2.test.ts` paths, `src/backend/src/server.ts` and `docs/features/README.md`. Both T17 and T18 run `git status --porcelain -- docs/features ':(exclude)docs/features/remote-spaceship-customization'`. |
| N5 — same-server two-tab rule | MINOR | Resolved | AC-10 states one `memberAppearance` frame per affected member (`playerId`) on that member's server: same-server two tabs ⇒ two frames (one per `playerId`), two servers ⇒ one frame each, encoded once per server, no frame when unchanged. § Real-time impact § Multi-client matches; T6 carries the same-server two-tab and two-server fixtures. |
| N6 — trailing window | MINOR | Resolved | AC-12 pins the true trailing window (`forgotten at now − 1000 ms`, `<=`), the 10-frame sequence at t = 0…900, the 11th dropped at t = 950 (inside (−50, 950]) and the t = 1000 acceptance. The real hub limiter expires at `rate.admitted[0] <= now - RATE_WINDOW_MS` with `RATE_WINDOW_MS = 1000` (`hub.ts:154,1228,1731`), so the AC matches the codebase pattern; T6 names the fake-timer evidence. |
| N7 — module layering | MINOR | Resolved | AC-5 pins the pure `game/ship-forms.ts` (`game/**` only, no `three`/`render/**`) and puts the v2 shape-table resolution helper in `render/cursor-ship.ts`, which owns `CURSOR_SLOT_SHAPE_TRANSFORMS`. § Boundaries, plan § Layering/§ Assumptions and T9 repeat it; `ship-forms.test.ts` carries the source-reading import-boundary assertion. |
| Process — T1/T2 hash ownership | — | Resolved | T2 depends on T1 and is `[seq]` (no `[P]`); `tasks.md`/`status.md` state "T2 depends on T1, so the catalog-hash cross-check has an owner"; T18 compares both `build-log-T1.md` and `build-log-T2.md` literals. No `T1 ∥ T2` remains. |

## Residual findings

| ID | Severity | Location | Issue | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| M1 | MINOR | `spec.md` AC-34 (line 514) | "the two-bolt **184 / 23** delta" mixes the one-remote-member total object count (184) with the added-draw count (23). AC-22 pins the two-bolt ship delta as 38 objects / 23 draws and the scene totals as 184/248/360, but a doc writer reading only AC-34 could record 184 as a delta. | Reword to "the two-bolt fixture 184 objects / 23 added draws" (or "38 added objects / 23 added draws"). Non-blocking: AC-22, plan R6, T12 and T18 are exact. | open (backlog) |
| M2 | MINOR | `tasks.md` T4 (line 90) | "assert a metrics-enabled hub broadcast does not throw" is a hub-level test, but T4 owns only `src/backend/src/observability/metrics.ts` + `metrics.test.ts`; `hub.test.ts` is T6's file (T6 depends on T4). The prose invites editing an unowned file even though `files_owned` is explicit. | Scope T4's assertion to the allow-list in `metrics.test.ts` and leave the metrics-enabled hub-broadcast assertion to T6 (AC-14(c)); or add `hub.test.ts`/`hub.ts` to T4 and re-sequence. | open (backlog) |
| M3 | MINOR | `spec.md` AC-34; `tasks.md` T17 | The docs pass adds `## Remote ships` but does not require correcting existing statements this feature invalidates: `docs/architecture/frontend-rendering.md` still says the hangar "holds five `role="tab"` buttons" (line 90) and that the reveal uses "the same `appearanceToCursorShipParams` mapping" (line 68); `docs/architecture/realtime.md`'s leaderboard privacy paragraph says "No frame or placement object carries … appearance" (line 493), which becomes over-broad once `memberAppearance` frames carry appearance. T17's verify also does not assert the four retained README phrases AC-34 requires (`granular spaceship parts`, `animated 3D lootbox reveal`, `Neon Forge HUD`, `detailed blue/orange hero spaceship`). | Extend AC-34/T17's docs pass: six tabs and `appearanceToShipParamsV3` in `frontend-rendering.md`, scope the leaderboard privacy sentence to leaderboard frames, and add `grep -F` checks for the four retained phrases. Docs-only; the code-gate documentation pass per `docs/architecture/documentation.md` is the enforcement point. | open (backlog) |
| M4 | INFO | `tasks.md` T9 (line 144) | T9 lists AC-18, but AC-18's named evidence (`remote-ship.test.ts`) is owned by T11; T11 also lists AC-18, so the AC is covered. T9's acceptance over-claims one evidence file. | None required; optionally note that T9 covers the cursor-model idempotence half of AC-18 in `cursor-ship.test.ts`. | open (backlog) |

## Regression scan (r1 findings and cross-cutting)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 — AC-30 all-owned `Shots` | Fixed | AC-30 gives empty 26/13, all-owned classic 30/13, all-owned generated 48/24; all four fixtures derive from AC-28/AC-1/AC-27. Standard parts are implicitly owned (`isOwned` returns true for `rarity: 'standard'`), so the empty-inventory fixture correctly has one equip per row. |
| F2 — scene baseline | Fixed via N1 | Measured 135/146/210/322 retained; ship delta corrected to 36/21 at rest and 39/24 peak. |
| F3 — required `MemberState.appearance` | Fixed | AC-7 keeps the field optional on the wire, server always populates it, and `memberAppearanceOf` defaults every decode/copy path to `{}`; `UserPanel.test.tsx`, `activity-lifetime.test.ts` and `App.test.tsx` stay untouched. |
| F4 — `coin-economy` sequencing | Fixed | `coin-economy/status.md` is `building` after code-r1; its open F1/F2 are in `engine.test.ts` and F3 in `hub.test.ts`. T3/T5/T6/T8/T13/T17 are gated, all shared files (including `protocol.test.ts`, `economy-repository.test.ts`, `session.test.ts`, `glossary.md`) are listed, and T8's `[P]` waiver is stated. |
| F5 — 24-member welcome bound | Fixed | AC-14 pins 24 guests, empty `removedIds`, full 11-entry appearance, no `customization`, ≤ 17,408 B (measured 16,710 B), ≤ 550 B/member; the full-inventory welcome is out of bound. |
| F6 — live re-skin | Fixed | AC-15 `setSpectatedAppearance`, AC-17 re-skin without remount, T12/T13 wiring and evidence. |
| F7 — preview files | Fixed | `render/preview.ts` + test in T9; `ui/SpaceshipPreview.tsx` + test in T15; T15 depends on T9; AC-31 pins the v3 mapping. |
| F8 — stale documentation | Fixed except M3 | README/glossary/observability updates are pinned; the existing `frontend-rendering.md`/`realtime.md` sentences remain (M3). |
| F9 — guest self-view convergence | Fixed | AC-13(b) adopts `welcome.roster[self].appearance` then sends at most once on difference; `session.test.ts` is named. |
| F10 — panel v3 switch | Fixed | T15 switches all five panel helpers and adds a generated-v3-id + `shot` test. |
| F11 — per-strip roving tabindex | Fixed | AC-29 pins exactly one `tabindex="0"` per `.customization-forms` strip (two ship rows, one on `Shots`). |
| F12 — 30-character id | Fixed | AC-2/AC-9/AC-14 use `ignition-right-bulwark-crimson`; the worst appearance object is comfortably under 700 B and the worst valid `setAppearance` frame under 1024 B. |
| F13 — `NaN`/infinity loot map | Fixed | AC-4 pins `NaN → 0`, `-Infinity → 0`, `Infinity → 1`, `≤ 0 → 0`, `≥ 1 → 1`. |
| F14 — aim vs idle motion | Fixed | Aim on `remote-ship` root, bob/sway/recoil on `remote-ship-body`, AC-16 measured at rest. |
| F15 — recoil token/curve | Fixed | AC-20 pins `MOTION.remoteShipRecoilMs === 120`, `-0.12`, and `t = 0/60/120` values; dropped shots start no recoil. |
| F16 — muzzle consumption | Fixed | `muzzle` (`spark`/`ring`/`petal`) consumed by AC-24/AC-26 with three prebuilt muzzle geometries. |
| F17 — ledger | Fixed via N3 | AC-7/AC-8/AC-31 and the adaptive/servers rows are present; the AC-16-only framing is correct. |
| F18 — bundle claim | Fixed | ≈ 14.4 KB gzip, ≈ 114.4 KB initial, ≈ 295.8 KB total, ≈ 4 KB total headroom; AC-33/R5 gate it. |
| F19 — account seeding | Fixed | AC-13(a) requires persisted appearance at join/rejoin with `hub.test.ts` evidence. |
| F20 — raw request coverage | Acknowledged | Spectated remote ships, 1,351 rows, chassis/forms, shot styles, guest/account authority and server authority are covered; Q-1/Q-3/Q-4 remain user-owned. |

Other spot checks: catalog arithmetic 1,351 = 10×123 + 121; 1,340 = 1,351 − 11; rare 670 / epic 670;
weight 2,680 → 2,010/2,680 = 0.75; first lootable `hull-obsidian`, last `shot-kite-solar`; v2 order
(standard, rare, epic) makes `rng 0 → hull-obsidian` correct. AC-27 tab totals 244/120; AC-28
`data-total` 122/120; AC-30 26/13, 30/13, 48/24 all derive. The 24-member welcome fixture and the
17,408 B bound are coherent. AC-34's six-tab/244/120 README rewrite is compatible with the pinned
catalog. No new dependency, container, image, port, environment variable or schema/migration change
is introduced; AC-35/AC-36 and the T18 diff gate cover it. The DAG is acyclic with dependencies
pointing earlier; `[P]` sets `T4 ∥ T5`, `T8 ∥ T9 ∥ T14`, `T15 ∥ T16` are file-disjoint; T2 is
`[seq]` on T1. No scope weakening found — the supersession ledger is explicit and the retired
statements are confined to revision history.

## Checks performed

- Read all r3 inputs: `spec.md` (revision 3), `plan.md` (revision 3), `tasks.md` (revision 3),
  `status.md` (spec_review round 3, user-approved budget override), `reviews/spec-r2.md` (N1–N7),
  `reviews/spec-r1.md` (F1–F20), `AGENTS.md`, `docs/architecture/{stack,realtime,frontend-rendering,
  documentation,containerization,observability}.md`, the predecessor specs/rows used by the ledger
  (`spaceship-cursor-loot-animations` AC-8/AC-15/AC-16/AC-47, `multiplayer-servers` AC-13,
  `adaptive-render-budget-v2` § Quality tier budget), `coin-economy/status.md` +
  `reviews/code-r1.md`, and the relevant sources.
- N1: re-derived the 36/21-rest hierarchy from `cursor-ship.ts` (`CURSOR_SHIP_MODEL_OBJECT_COUNT =
  32`), the plan hierarchy and `spaceship.ts` (`Shot.muzzleFlash` is a separate mesh;
  `SHOT_MUZZLE_FLASH_MS = MOTION.shotMuzzleFlashMs = 80`); re-computed 38/23, 39/24, 182/246/358,
  184/248/360 and 185/249/361; confirmed the manager is lazy and disposal restores the measured
  counts; grepped `37`/`183`/`≤23` across spec/plan/tasks and found only the r2 revision-history row
  and review files. Confirmed the 90 ms minimum spawn interval exceeds the 80 ms flash, so one live
  muzzle.
- N2: read AC-17, plan § Form transform formula/§ Interfaces/R12, T9/T10 and the actual
  `spaceship.ts` `applyPulse()`; confirmed `shipEquipPulseScale(130) === 1.04` (`ship-motion.test.ts`)
  and the arithmetic 0.95/0.9/1.25 × 1.04 = 0.988/0.936/1.3. Parsed `files_owned` across 18 tasks
  (63 files) and found no duplicate ownership. Confirmed `spaceship.test.ts`/`scene.test.ts` are
  named in AC-17 and owned by T10/T12.
- N3: matched every ledger row against the predecessor spec text and confirmed the AC-16-only
  normalization row, the AC-15/migration-006 retention, the reframed adaptive row, the "≤ X × 7
  meshes per world" quote and the N1 numbers.
- N4: read T17/T18's verify commands and prose; confirmed the exact two new README greps, both
  `parts-v2.test.ts` paths, `src/backend/src/server.ts`, `docs/features/README.md` and the
  features-index status check.
- N5: read AC-10, § Real-time impact and T6; confirmed the per-member/per-server fan-out wording and
  the same-server two-tab fixture.
- N6: read AC-12/T6 and the hub's limiter (`RATE_WINDOW_MS = 1000`, expiry at
  `<= now - RATE_WINDOW_MS`); confirmed the 950/1000 ms boundary semantics.
- N7: read AC-5, plan § Layering/§ Interfaces/§ Assumptions, § Boundaries and T9; confirmed
  `CURSOR_SLOT_SHAPE_TRANSFORMS` is owned by `render/cursor-ship.ts` and the import-boundary test is
  named.
- Process: confirmed T2 `depends_on: T1`, no `[P]` on T2, no `T1 ∥ T2` in tasks/status, and T18's
  dual build-log comparison.
- Regression scan: spot-checked the catalog arithmetic and boundaries; the AC-30 control counts
  against the current panel `isOwned` behavior; AC-14's fixture; the optional `MemberState.appearance`
  path; the live re-skin; the preview/panel v3 ownership; the docs targets; the `coin-economy` gate
  (state `building`, open F1/F2 in `engine.test.ts`, F3 in `hub.test.ts`); the DAG/`files_owned`/`[P]`
  sets; the no-new-dependency/container/schema claims; and the absence of scope weakening.
- Residuals found: M1 (AC-34 notation), M2 (T4 prose ownership), M3 (docs coverage), M4 (INFO,
  T9/AC-18).

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Raw request covered; non-goals and Q-1/Q-3/Q-4 are explicit; no invented scope. |
| Testability | ✅ | N1/N2 numbers are concrete and derivable; the residual M1 is a notation ambiguity only, and AC-22/T12/T18 pin the exact values. |
| Boundaries | ✅ | Three tiers present; `game/**` purity, server authority, no catalog-on-wire and no secrets are pinned. |
| Dependency graph | ✅ | Acyclic; all AC-1…AC-36 mapped; T2 depends on T1; T9→T10→T11; T15 depends on T9. |
| Parallel safety | ✅ | `files_owned` disjoint for all 18 tasks; `[P]` sets verified; M2 is a T4-prose ambiguity, not an owned-file collision. |
| Security | ✅ | Guest `setAppearance` codec bounds + catalog normalization; account authority; no inventory/account/coins/tokens on the new path; no new dependency/secret. |
| Testing | ✅ | Unit + integration + containerized smoke; `npm run coverage` ≥ 80 per workspace; concrete assertions; no snapshot-only/assertion-free tests. |
| Consistency | ✅ with M3 | Aligns with vision/architecture/containerization; M3 records the remaining stale doc sentences the code-gate documentation pass must correct. |

## Residual backlog / open questions

- **Q-1 (spectated-only visibility), Q-3 (loot pacing 75/25 with duplicates), Q-4 (guest structural
  validation only)** remain user-owned per `status.md`; Q-2/Q-5–Q-8 are pinned. No planner-introduced
  silent deviation found.
- **M1** — reword AC-34's "184 / 23 delta" to separate the total object count from the added-draw
  count; AC-22/T12/T18 are already exact.
- **M2** — scope T4's metrics assertion to `metrics.test.ts`; keep the metrics-enabled hub-broadcast
  assertion in T6 (`hub.test.ts`). This avoids an out-of-ownership edit while T4 is `[P]`.
- **M3** — extend the T17 docs pass to the existing `frontend-rendering.md` five-tab/mapping
  sentences, the `realtime.md` leaderboard privacy sentence, and the four retained README phrases;
  the code-gate documentation check will verify this regardless.
- **M4** — T9's AC-18 listing is redundant; T11 owns AC-18's `remote-ship.test.ts` evidence.
- **Sequencing gate.** T3/T5/T6/T8/T13/T17 remain blocked until the `coin-economy` fix-up round
  reaches `code_review`; `coin-economy` is `building` after code-r1 with open F1/F2 in
  `engine.test.ts` and F3 in `hub.test.ts`. T8's `[P]` does not waive this.
- This is the user-approved final spec round; approval clears the feature to building with the gate
  above and the code-gate documentation/real-time/container checks still to run.
