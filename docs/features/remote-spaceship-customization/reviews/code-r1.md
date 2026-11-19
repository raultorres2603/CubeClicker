---
feature: remote-spaceship-customization
phase: code
iteration: 1
verdict: changes_requested
blocking: 1
nonblocking: 7
reviewed: 2026-11-19
---
# Code Review — r1

## Verdict rationale

Implementation review of all 36 ACs, T18 evidence and the source/test diff: the feature is
functionally conformant. The catalog arithmetic, protocol/authority paths, remote-ship
lifecycle/motion/firing, shot styles, hangar discovery and budgets all reproduce, and I reran the
complete gate suite myself (`lint`, `typecheck`, `test`, `coverage`, `build`, `smoke` 29/29) with
the recorded counts. One **MAJOR documentation drift** remains: `docs/architecture/realtime.md:493`
still says *no frame* carries appearance, contradicting the new `MemberState.appearance` /
`memberAppearance` projection and the new `## Public appearance projection` section in the same
file. The spec r3 residual M3 explicitly required scoping that sentence to the leaderboard; T17
did not, so the code-gate documentation pass is not complete. Required fix: rewrite that privacy
sentence to scope it to leaderboard frames (or explicitly state the appearance projection
exception), re-run the docs greps and commit it. The remaining findings are non-blocking.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `src/backend/src/game/parts-v3.ts:108-268,334-337`; `parts-v3.test.ts` (63 tests) pins version 3, the 11-slot order, 1,351 rows, 1,340 lootable, 123/121 per slot, 11 standard / 670 rare / 670 epic; frontend mirror (`parts-v3.test.ts`, 71 tests) passes in the full suite. |
| AC-2 | ✅ | `parts-v3.test.ts` (backend 334-467) pins `slot-form-finish` ids, `Finish Form Noun` names, 1,351 unique ids/names, max id length 30 (`ignition-right-bulwark-crimson`), 11 forms, 12 finishes, `hull-dart-chrome` verbatim, classic 3/1 and generated 12 rows. Frontend mirror passes. |
| AC-3 | ✅ | `parts-v3.test.ts:470-482` compares the 30 classic rows field-for-field in v2 order; independent `git diff --exit-code BASE...HEAD` for both `parts-v2.ts` and both `parts-v2.test.ts` exits 0. |
| AC-4 | ✅ | `parts-v3.test.ts:604-676` pins one rng draw, `0/NaN/-Infinity/-0.5 → hull-obsidian`, `0.999999/1/2/Infinity → shot-kite-solar`, weights 3/1, 2,010/2,680 rare, 670 epic, every lootable row hit exactly 3/1 times; `hub.test.ts:2493-2532` proves a seeded multi-open sequence returns different v3 parts. |
| AC-5 | ✅ | `normalizePartMapV3` / `normalizeAppearanceV3` / `normalizeCustomizationStateV3` (`parts-v3.ts:533-622`) retain v3 ids and every v1/v2 rule; tests in both workspaces cover wrong-slot/unknown/count bounds/order/idempotence. Consumer switch verified in `economy-repository.ts` (`normalizeCustomizationStateV3`), `engine.ts`, panel/preview, and the pure `ship-forms.ts` import-boundary test (`ship-forms.test.ts:421-436`). |
| AC-6 | ✅ | Both `parts-v3.test.ts` assert `CATALOG_ROWS_HASH === '4a8df5e0'` (backend test line 584, frontend 587); both modules compute it over the pinned row string; T18’s runtime check reproduced `4a8df5e0 1351` and both build logs record the same literal. |
| AC-7 | ✅ | `protocol.ts` (backend and frontend) adds optional `MemberState.appearance`, the structural codec and `memberAppearanceOf`; `memberState()`/`rosterFor()` always populate (`hub.ts:731-757`); `copyMember` in `server-state.ts:115-122`, the reducer paths, and `render/world.ts:146-160` fill `{}` through the helper; `stateSync`/`levelAdvanced` shapes and exact bytes are pinned unchanged. (Transport note: F2 — absent fields are preserved by `parseMemberState`/`copyMemberState`, but every stored member and renderer path normalizes.) |
| AC-8 | ✅ | `metadata` union and `memberAppearanceMessage` (`protocol.ts:1104-1116`); the builder re-validates and copies; `protocol.test.ts:2338-2416` proves argument mutation cannot change the frame and the frame encodes exactly at 492 B. |
| AC-9 | ✅ | Backend/frontend `setAppearance` codecs reject non-object/null/array/>11/unknown slot/non-string/empty/41-char/701-byte inputs with `bad_message`; 40-char and 700-byte boundaries accepted; worst valid frame 473 B ≤ 1024 (`protocol.test.ts`; T3/T7 logs). |
| AC-10 | ✅ | `handleEquipPart`/`handleUnequipPart` persist then update every account member before broadcasting (`hub.ts:1765-1841`); `hub.test.ts:3465-3563` pins the same-server two-tab two-frame fixture, the two-server one-frame-each fixture, exact `customizationUpdate` shape and no frame on a no-op. |
| AC-11 | ✅ | `handleSetAppearance` (`hub.ts:1854-1872`) normalizes against the v3 catalog, stores only on change, broadcasts on that member’s server with the origin excluded; account members are a silent no-op. `hub.test.ts:3344-3436` covers wrong-slot/unknown dropping, origin exclusion, no-op and account refusal. |
| AC-12 | ✅ | True trailing window in `hub.ts:1858-1865` (`<= now - 1000`); `hub.test.ts:3616-3672` pins 10 frames at 0…900, the 11th dropped at 950, acceptance at 1000, no state/error on drops. |
| AC-13 | ✅ | Account seeding at join/rejoin (`hub.ts:1168-1170`); sibling `memberJoined` and resume fixtures (`hub.test.ts:3259-3324`); guest `{}` (`hub.test.ts:3326-3342`), adoption + exactly one send (`session.test.ts:4472-4602`), grace/rejoin/move/removal (`hub.test.ts:3674-3758`). |
| AC-14 | ✅ | `APPEARANCE_JSON_MAX_BYTES = 700`, 40-char, 11-entry bounds in both protocols; worst `memberAppearance` 492 B; 24-guest welcome fixture (`hub.test.ts:3810-3837`) has 24 members, empty `removedIds`, full 11-entry appearance, absent `customization`, ≤17,408 B and ≤550 B/member; `metrics.test.ts` + hub metrics test pin the type allow-lists and one encode/frame count. |
| AC-15 | ✅ | `SceneView.setSpectatedMember`/`setSpectatedAppearance` (`scene.ts:1267-1298`) mount one ship only for a rendered member, dispose once on null/memberLeft/welcome/worldEntered/scene disposal, no-op same id/unknown id, no ship before welcome or in camera flight; `scene.test.ts` and `session.test.ts` lifecycle tests pass. |
| AC-16 | ✅ | `REMOTE_SHIP_OFFSET`/`REMOTE_SHIP_SCALE` (`remote-ship.ts:72-77`); `remote-ship.test.ts:216-287` pins the root at `(11.6, -1.2, 4.4)`, scale `[1.2,1.2,1.2]`, body/model/shots hierarchy, and the root local `+z` aim within `1e-6` at rest. |
| AC-17 | ✅ | `appearanceToShipParamsV3`/`resolveSlotTransform`/`chassisPose`; `remote-ship.test.ts:289-453` pins obsidian hull `#1a2333`, gold wing `#ccaa44`, the v2 armored transform, `hull-dart-chrome` slot scale `[0.85,0.9,1.15]` and chassis `[0.95,0.9,1.25]`, live re-skin without remount; `cursor-ship.test.ts` and `scene-spaceship.test.ts` pin rest/peak pulse composition (`[0.988,0.936,1.3]`, classic `[1.04,1.04,1.04]`). |
| AC-18 | ✅ | `remote-ship.test.ts:318-431` covers absent/`{}`/unknown/wrong-slot defaults, the repeated-record no-write spies on material/transform writes, and catalog-order change reporting. |
| AC-19 | ✅ | `remoteShipIdle` (`remote-ship.ts:201-216`) and `remote-ship.test.ts:155-216,456-509` pin t=0/650/1950 values, reduced-motion zeros, body-only writes, root anchor/aim unchanged, and no pointer/travel/bank. |
| AC-20 | ✅ | `fire` (`remote-ship.ts:425-498`) and `remote-ship.test.ts:511-668` pin nose spawn, 180 ms travel, 90 ms boundary, two-shot cap, first-id batch target, fallback `(px,py,2.75)`, `-0.12 → -0.015 → 0` recoil, no recoil on drop and no shot for another member; `scene.test.ts` checks the broadcast→fire wiring. |
| AC-21 | ✅ | `remote-ship.test.ts:669-728` pins one 120 ms target flash, no travelling mesh/recoil, reuse of the single flash, and no re-enabled motion when reduced motion returns. |
| AC-22 | ✅ | `remote-ship.test.ts:731-860` pins 35 module objects / 21 meshes at rest, 38/23 two-bolt, hidden tier meshes, no trail/reticle, stable pose/object count; `scene.test.ts` pins 135/146/210/322 before mount, 182/246/358 idle, 184/248/360 two-bolt, 185/249/361 peak, exact restoration on dispose, lazy `remote-ships`, picking returns null, own chassis survives `update`. |
| AC-23 | ✅ | `shotStyleForPart` (`parts-v3.ts:471-488`); both `parts-v3.test.ts` and `shot-visuals.test.ts` pin `shot-default` bolt/spark colours, all form profiles, muzzle kinds, non-shot fallback and `unknown part` throw. |
| AC-24 | ✅ | `shot-visuals.ts` builds exactly four projectile and three muzzle geometries plus one material pair; `spaceship.test.ts`/`shot-visuals.test.ts` pin spawn capture, in-flight geometry/muzzle retention, shared colour writes, same-style no-op and no post-construction geometry/material creation. |
| AC-25 | ✅ | `scene.ts:1357-1370` normalizes the snapshot appearance and applies `shotStyleForPart` at construction/change; `scene.test.ts` and `spaceship.test.ts` pin the style switch and default fallback. |
| AC-26 | ✅ | `RemoteShip.applyAppearance`/`fire` use the owner’s resolved style; `remote-ship.test.ts:606-667` pins next-shot geometry/muzzle after a live change and 80 ms muzzle reuse. |
| AC-27 | ✅ | `hangar-tabs.ts` six tabs in order, union = 11 slots, `HANGAR_DEFAULT_TAB = 'frame'`, `tabForSlot` throw, totals `{frame:244,…,shots:120}`; `hangar-tabs.test.ts` passes. |
| AC-28 | ✅ | `SpaceshipCustomizationPanel.tsx:447-552` renders per-slot rows, 11 form buttons, 3/1/12 variants, `data-*` attributes, owned/locked/equipped states and inline swatch colours; `SpaceshipCustomizationPanel.test.tsx` (75 tests) and `game-view.css.test.ts` pin 44 px targets and focus rings. |
| AC-29 | ✅ | `SpaceshipCustomizationPanel.tsx:366-410,490-510` per-slot form state, per-strip roving `tabIndex`, Arrow/Home/End selection with `preventDefault`, no command callbacks on selection and stable `SpaceshipPreview` identity; panel tests pass. |
| AC-30 | ✅ | Panel tests pin the 26/13, 30/13 and 48/24 control fixtures, six tabs, one `role="tabpanel"` (`customization-tabpanel`), `aria-labelledby`, no `aria-controls`, one preview and no inactive-tab rows; `game-view.css.test.ts` pins the form/grid CSS. |
| AC-31 | ✅ | `reveal-motion.ts` adds `shot: 0.9`; `lootbox-reveal.ts`/`LootboxReveal.tsx` resolve v3 ids/slot/name and leave the staged ship unchanged for `shot`; `preview.ts`/`SpaceshipPreview.tsx` use `appearanceToShipParamsV3`, keep ten `data-preview-slot-*` attributes and derive the five legacy colours from v3. The named reveal/lootbox/preview tests pass. |
| AC-32 | ✅ | Reviewer-run `npm run coverage`: backend **96.46 / 90.49 / 99.59 / 96.46**, frontend **97.15 / 96.75 / 98.36 / 97.15**; exit 0; config/thresholds unchanged; new modules included (T18 lines 183-211). |
| AC-33 | ✅ | Reviewer-run `npm run lint`, `typecheck`, `test` (backend 38/1,694; frontend 83/2,844), `coverage`, `build` (`Bundle budget OK`; initial 101,990 / three 154,647 / total 286,599 ≤ 150,000/165,000/300,000) and `smoke` (29/29, exit 0). Exact deltas vs BASE: +2,020 initial, +30 three, +5,218 total (T18 lines 280-300). Measured catalog cost is lower than the ≈14.4 KB planning estimate (F5). |
| AC-34 | ✅ | AC-34’s enumerated items are present: README has the four exact phrases, six tabs, 244/120 counts and no stale `five part-group tabs`/`ten part slots`/`n/4` text; `realtime.md` has `## Public appearance projection`; `frontend-rendering.md` has `## Remote ships` with the 182/184/185 budgets; `observability.md` has the three allow-list entries and paragraph; glossary has the four new terms and the four updates; T17 did not edit `docs/features/README.md`. **The separate code-gate documentation pass is still incomplete: F1 leaves a contradictory privacy sentence at `realtime.md:493`; AC-34’s exact items pass, but the docs rule fails as a MAJOR finding.** |
| AC-35 | ✅ | Reviewer-run `npm run smoke` → `SMOKE PASS (29/29 checks)`, including `PASS appearance projection: guest B’s 11-slot setAppearance yields exactly one memberAppearance on guest A, and an unknown slot key yields bad_message without a broadcast`; `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles, `server.ts` and the `GET /ws` path are byte-identical to BASE. |
| AC-36 | ✅ | `git diff --exit-code BASE...HEAD -- src/backend/src/db` exits 0 (no schema/migration change), `customization_version` stays `2`; `economy-repository.test.ts:1215,2008` round-trips v3 ids through `findCustomizationByUserId → setSlotAppearance → findCustomizationByUserId`; root/workspace `package.json` and `package-lock.json` are unchanged against BASE. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `docs/architecture/realtime.md:493` | The leaderboard “Privacy and rollback” paragraph still says “No frame or placement object carries … appearance …”. That is now false: `MemberState.appearance` travels on every server-originated roster and the `memberAppearance` frame carries appearance by design (the same document’s new `## Public appearance projection` section says so). Spec r3/M3 explicitly required scoping this sentence to leaderboard frames. This is stale documentation for shipped behavior. | Rewrite the sentence (e.g. “No **leaderboard** frame or leaderboard placement field carries … appearance …”) or state the appearance projection exception explicitly; re-run the T17 docs greps and commit with the docs pass. | open |
| F2 | MINOR | `src/frontend/src/multiplayer/protocol.ts:985-1000`; `src/backend/src/game/protocol.ts:1270-1285` | The transport decoders preserve an absent `appearance` instead of filling `{}`, while AC-7’s broad sentence says every decode/copy path fills `{}`. The three named client paths (`copyMember`, `reduceWorldState`, the `SceneWorld` roster copy) do fill, the hub always populates server frames, and no renderer receives an absent field, so there is no runtime exposure; the exception is documented in T3/T7. | Either normalize an absent field in `parseMemberState`/`copyMemberState`, or narrow AC-7/the docs wording to “every stored/copy/render path” and record the transport exception explicitly. | open |
| F3 | MINOR | `docs/architecture/frontend-rendering.md:133` | The reveal bullet still names `partDefinition(partId).slot` as the catalog resolver; the shipped code resolves v3 ids through `partDefinitionV3`. This is stale API naming in the docs. | Update to `partDefinitionV3(partId).slot` (or “the v3 catalog resolver”). | open |
| F4 | MINOR | `docs/features/README.md` (pre-step commit `65606be`; `build-log-T18.md:36-74`) | T18 committed the orchestrator-owned `coin-economy` index row to clear the status gate. T17 itself did not edit the index and the current feature row is the orchestrator’s; the change is explained and not a rewrite, but it is a builder edit of the orchestrator-owned index outside its own row. | Leave feature-index edits to the orchestrator; if a worktree carries orchestrator bookkeeping, record it and let the orchestrator commit it rather than including it in a feature task commit. | open |
| F5 | INFO | `build-log-T18.md:280-300` | The measured bundle cost (+2,020 B initial / +5,218 B total, 13,401 B total headroom) is far below the spec’s ≈14.4 KB / ≈4 KB-headroom planning estimate. This is a favorable measurement of the same ceilings (`initial ≤150,000`, `three ≤165,000`, `total ≤300,000`), not a missed gate. | No code action; record the measured deltas (already done). | accepted |
| F6 | INFO | `hub.test.ts:3810-3837`; `build-log-T6.md` | The 24-guest welcome measures 16,362 B in the fixture, while spec AC-14’s planning note says 16,710 B; both are under the 17,408 B bound and the test pins the bound, per-member ≤550 B and the empty `removedIds`/full-record fixture. | No code action. | accepted |
| F7 | INFO | `build-log-T18.md:193-196` | `SpaceshipPreview.tsx` per-file coverage is 86.99 statements / 77.41 branches / 75 functions / 86.99 lines; the workspace aggregate passes the only configured gate (97.15/96.75/98.36/97.15), and no exclusion/threshold changed. | No code action; optional future preview-fallback test coverage. | accepted |
| F8 | INFO | `build-log-T18.md:353-361` | The smoke run reused the running compose services and the pre-existing `frontend-prod` image; the appearance check ran through the bind-mounted current dev backend/frontend and `npm run build` independently proves HEAD. The transcript is recorded, so this is a reproducibility note rather than a failed check. | No code action; on a truly cold run, rebuild `frontend-prod` to exercise HEAD’s static assets. | accepted |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → backend **38 files / 1,694 tests passed**, frontend **83 files / 2,844 tests passed**, exit 0.
- `npm run coverage` → backend **96.46 / 90.49 / 99.59 / 96.46**, frontend **97.15 / 96.75 / 98.36 / 97.15** (statements/branches/functions/lines), exit 0; `vitest.config.ts` and `vite.config.ts` are unchanged against BASE.
- `npm run build` → `Bundle budget OK`; initial **101,990 B**, three **154,647 B**, total **286,599 B**; exit 0.
- `npm run smoke` → **SMOKE PASS (29/29 checks)**, `SMOKE_EXIT:0`, including the AC-35 appearance check and the bad-message/no-broadcast assertion.
- `git diff --exit-code 4233147...HEAD -- src/backend/src/game/parts-v2.ts src/backend/src/game/parts-v2.test.ts src/frontend/src/game/parts-v2.ts src/frontend/src/game/parts-v2.test.ts package.json package-lock.json src/backend/package.json src/frontend/package.json compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' src/backend/src/server.ts src/backend/src/db` → exit 0.
- `git status --porcelain src tests compose.yaml compose.smoke.yaml package.json package-lock.json` → empty; the only worktree entries are this feature’s orchestrator artifacts and the feature-index row.
- `git diff --check` → exit 0.
- Test-quality scan of the change set: no `expect.anything`/`toMatchObject`/snapshot-only/`toBeTruthy`/`toBeDefined`/unchecked `toHaveBeenCalled` additions; no new `.only`/`.skip`; the changed test expectations are concrete values and the affected predecessor assertions were replaced, not deleted.
- Catalog hash and count verified through both workspaces’ `parts-v3.test.ts` (hash literal `4a8df5e0`, 1,351 rows) and T18’s runtime probe.
- Scene budget/fixture checks verified through `scene.test.ts` and `remote-ship.test.ts` (35/21 module, 36/21 scene, 38/23 two-bolt, 39/24 peak, 135/146/210/322 restoration, 182/246/358 idle, 185/249/361 peak).
- Docs greps: the four README phrases, the stale-text negative grep, both architecture section headings, the observability allow-list entries and the glossary headings all pass; the independent grep also found the stale `realtime.md:493` privacy sentence (F1).

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Guest `setAppearance` is bounded (11/40/700), catalog-normalized and rate-limited; accounts are silent no-ops; public projection holds only slot→part-id strings (no inventory, coins, tokens or `accountId`); no secrets or dependency/container changes; server authority is intact. Transport absence is F2, with no renderer exposure. |
| Quality | ❌ | Functional code is conformant, but F1 is a stale documentation statement contradicting the shipped public projection; F3 is a stale API name. No source defect found in the catalog, protocol, hub, session or render paths. |
| Testing | ✅ | Coverage rerun above thresholds in both workspaces; new modules covered; concrete assertions, no banned matchers, no snapshot-only/assertion-free tests, no coverage-exclusion gaming; hub/multi-client, reconnect/grace, malformed-frame and smoke coverage present. |
| Real-time | ✅ | Same-server two-tab and two-server fan-out, guest origin exclusion, true trailing limiter, grace/rejoin/move, live `memberAppearance` re-skin and removal-derived firing all verified; no extra protocol traffic for firing. |
| Accessibility / UI | ✅ | Six tabs, roving focus, 44 px targets, focus-visible rings, ARIA tab/tabpanel pattern, form-strip keyboard selection and preview identity verified. |
| Containerization | ✅ | `compose.yaml`, `compose.smoke.yaml`, Dockerfiles, `server.ts` and `GET /ws` unchanged; smoke 29/29; no new service/port/env/health signal. |
| Documentation | ❌ | AC-34’s exact README/architecture/observability/glossary requirements are present, but F1 leaves a contradictory privacy statement; T17’s docs pass is incomplete. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| Spec r3 M1 (AC-34 “184 / 23 delta” wording) | fixed in docs | `frontend-rendering.md:119-122` separates 184/248/360 totals from 38/23 draws; spec wording is historical only. |
| Spec r3 M2 (T4 metrics ownership) | fixed | T4 stayed in `metrics.ts`/`metrics.test.ts`; the hub metrics-enabled broadcast test is in T6 (`hub.test.ts:3785-3807`). |
| Spec r3 M3 (stale docs) | **not fully fixed** | The reveal mapping and six-tab lines were corrected, but the leaderboard privacy sentence at `realtime.md:493` remains (F1). |
| Spec r3 M4 (T9/AC-18 overlap) | accepted | T11 owns the AC-18 `remote-ship.test.ts` evidence; no action. |
| Spec r3 approval / T1–T18 board | verified | All 18 build logs contain raw lint/typecheck/test/coverage evidence; T18 re-ran the full recipe. |

## Residual backlog / open questions

- **F2** — decide whether the transport decoder should default an absent `appearance` to `{}` or whether AC-7/docs should explicitly exempt the wire parser (no runtime defect either way).
- **F3** — update the reveal doc’s `partDefinition` name to `partDefinitionV3`.
- **F4** — keep orchestrator-owned feature-index edits out of builder commits; T18’s pre-step `coin-economy` row is explained and content-correct, but it is outside this feature’s own row.
- **F5–F8** — favorable bundle measurement, 16,362 B welcome measurement, `SpaceshipPreview.tsx` per-file coverage, and smoke-service reuse are recorded/accepted; no code action.
- **T13/T12 seam note** — `render/world.ts` does not consume `memberAppearance`; `session.ts` re-applies `setSpectatedAppearance` after mount and after a remote `levelAdvanced`. The behavior and lifecycle tests pass; if the scene world is later made the owner, that is a follow-up, not a defect in this feature.
- **User-owned questions Q-1/Q-3/Q-4** remain the accepted defaults; no new open question.
