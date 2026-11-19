---
feature: remote-spaceship-customization
state: accepted
spec_review_round: 3
build_round: 2
created: 2026-11-18
updated: 2026-11-19
---
# Status — Remote Spaceship Customization (other players' ships + 1,351 options)

## Summary
Make other players' spaceships visible together with each player's equipped customization (at minimum while spectating that player), and expand spaceship customization from 30 parts to a 1,351-row catalog including chassis/form changes and new shot animations. Raw request gist: "add the spaceship of other's players … user 1 should be able to see user's 2 spaceship with user's 2 customizations aswell"; "add 1000+ space ship customizations, including chassis changes, form of the spaceship, shooting new animations".

## Task board
_Mirror of tasks.md; `[ ]` pending, `[>]` in progress, `[x]` done._

| Task | Phase | Title | Depends on | ACs | Status |
| --- | --- | --- | --- | --- | --- |
| T1 | P1 | Backend catalog v3 (1,351 rows, loot draw, normalizers) | — | AC-1–AC-6 | `[x]` `[seq]` |
| T2 | P1 | Frontend catalog v3 mirror + renderer mapping | T1 | AC-1–AC-6, AC-23 | `[x]` `[seq]` |
| T3 | P1 | Backend protocol: optional appearance, `memberAppearance`, `setAppearance` | T1 | AC-7, AC-8, AC-9, AC-14 | `[x]` `[seq]` |
| T4 | P1 | Metrics allow-lists for the new frames | T3 | AC-14 | `[x]` `[P]` |
| T5 | P1 | Repository v3 widening and read normalization | T1 | AC-5, AC-36 | `[x]` `[P]` |
| T6 | P1 | Hub appearance authority | T3, T4, T5 | AC-10–AC-14 | `[x]` `[seq]` |
| T7 | P1 | Frontend protocol mirror + world reducer | T2, T3 | AC-7, AC-8, AC-9 | `[x]` `[seq]` |
| T8 | P1 | Engine v3 guest customization + appearance adoption | T2 | AC-5, AC-13 | `[x]` `[P]` |
| T9 | P1 | Cursor model v3, form/chassis math, preview mapping | T2 | AC-2, AC-5, AC-17, AC-18, AC-31 | `[x]` `[P]` |
| T10 | P2 | Shot visuals + `Spaceship.applyShotStyle` + pulse composition | T2, T9 | AC-17, AC-23, AC-24, AC-25 | `[x]` `[seq]` |
| T11 | P1 | Remote ship | T9, T10 | AC-15–AC-22, AC-26 | `[x]` `[seq]` |
| T12 | P1 | Scene, world and cube-view wiring | T7, T11 | AC-15, AC-17, AC-20, AC-22, AC-25, AC-26 | `[x]` `[seq]` |
| T13 | P1 | Session convergence and spectate wiring | T7, T8, T12 | AC-13, AC-15 | `[x]` `[seq]` |
| T14 | P2 | `shot` support in the reveal path | T2 | AC-31 | `[x]` `[P]` |
| T15 | P3 | Hangar tabs + form/finish picker | T2, T9, T14 | AC-5, AC-27–AC-31 | `[x]` |
| T16 | P1 | Containerized smoke check | T3, T6 | AC-35 | `[x]` `[P]` |
| T17 | P3 | Documentation pass (incl. observability allow-list) | T12, T15 | AC-34 | `[x]` `[seq]` |
| T18 | P3 | Verify & integrate | T1–T17 | AC-32–AC-36 | `[x]` `[seq]` |

Dependency overview: `T1 → T2`; `T1 → T3 → T4 → T6`; `T1 → T5 → T6`; `T2 → T7`; `T2 → {T8, T9, T14}`; `T9 → T10 → T11`; `{T7, T11} → T12`; `{T7, T8, T12} → T13`; `{T2, T9, T14} → T15`; `{T3, T6} → T16`; `{T12, T15} → T17`; all → `T18`.
Parallel-safe: `T4 ∥ T5`; `T8 ∥ T9 ∥ T14`; `T15 ∥ T16`.

**Sequencing gate (R1, F4) — released 2026-11-18.** `coin-economy` reached `code_review` and was `accepted` (`reviews/code-r2.md`, 0 blocking). Its shared files are free: `protocol.ts`, `hub.ts`, `economy-repository.ts`, `engine.ts`, `session.ts` and their tests, plus `docs/product/glossary.md`.

## Budget override
- **2026-11-18 — user approved one extra spec round (r3)** after the default two-round spec budget was exhausted (`reviews/spec-r2.md`). r3 resolved N1–N7 and was approved.

## Loop log
- 2026-11-18 — created → PLANNING — request: "add the spaceship of other's players … with user's 2 customizations aswell. Also … add 1000+ space ship customizations, including chassis changes, form of the spaceship, shooting new animations"
- 2026-11-18 — planning → spec_review — planner r1 delivered `spec.md`, `plan.md`, `tasks.md`; status board applied by the orchestrator after the planner's `status.md` write was permission-denied — `docs/features/remote-spaceship-customization/{spec,plan,tasks}.md`
- 2026-11-18 — spec_review → planning — review r1 `changes_requested` (10 blocking: F1–F10; 9 minor: F11–F19; F20 INFO) — `reviews/spec-r1.md`
- 2026-11-18 — planning → spec_review — planner r2 revised spec/plan/tasks to revision 2; F1–F19 addressed — `spec.md`, `plan.md`, `tasks.md`
- 2026-11-18 — spec_review → escalated — review r2 `changes_requested` at the final default spec round (2 blocking: N1, N2; 5 minor: N3–N7) — `reviews/spec-r2.md`
- 2026-11-18 — escalated → planning — user approved one extra spec round (r3) to resolve N1–N7; budget override recorded — user decision
- 2026-11-18 — planning → spec_review — planner r3 (revision 3) resolved N1–N7; T1/T2 sequenced, pulse composition assigned to T10, counts/docs/task evidence synced — `spec.md`, `plan.md`, `tasks.md`
- 2026-11-18 — spec_review → awaiting_approval — review r3 `approved` (0 blocking; 3 minor M1–M3, 1 INFO M4) — `reviews/spec-r3.md`
- 2026-11-18 — awaiting_approval → building — user approved the spec; scheduling T1 — user decision
- 2026-11-18 — building — T1 completed: backend catalog v3, hash `4a8df5e0`, backend 38 files / 1,601 tests pass, coverage 96.44/90.31/99.59/96.44; commits `b0f3261` + `e4fe4b8` — `build-log-T1.md`
- 2026-11-18 — building — T2 completed: frontend catalog v3 mirror, hash `4a8df5e0` matches T1, frontend 80 files / 2,576 tests pass, coverage 96.96/96.61/98.1/96.96; branch `feat/remote-spaceship-customization`; commits `7c86331` + `36117b9` — `build-log-T2.md`
- 2026-11-18 — building — T14 completed: `shot` reveal support, 2,588 tests, coverage 96.96/96.61/98.1/96.96; commits `17c62ff` + `965c4c9` — `build-log-T14.md`
- 2026-11-18 — building — T9 completed: ship-forms, cursor v3/chassis/pulse, preview v3; 2,624 tests, coverage 96.99/96.65/98.12/96.99; commit `61191e9`, follow-up `0a1b330` — `build-log-T9.md`
- 2026-11-18 — building — T10 committed via T11 pre-step: `448fbde` + `2fb1324`; 2,643 tests, coverage 97.02/96.66/98.13/97.02 — `build-log-T10.md`
- 2026-11-18 — building — T11 completed: remote ship, 2,687 tests, coverage 97.1/96.69/98.18/97.1; commits `839ca4d` + `c496600` — `build-log-T11.md`
- 2026-11-18 — building — T15 completed: hangar tabs/form picker/preview, 2,704 tests, coverage 97.08/96.64/98.19/97.08, bundle 99,859 / 154,647 / 284,420; commits `e437a93` + `b9b830e` — `build-log-T15.md`
- 2026-11-18 — building → blocked — all ungated tasks complete; remaining tasks waited on `coin-economy` reaching `code_review` — `tasks.md`
- 2026-11-18 — coin-economy fix detour: F1–F3 fixed (`eece694`), code review r2 approved (0 blocking), `coin-economy` accepted; README index row updated — `docs/features/coin-economy/reviews/code-r2.md`
- 2026-11-18 — blocked → building — sequencing gate released; dispatching T3 — `tasks.md`
- 2026-11-19 — building — T3 completed: backend appearance protocol, 38 files / 1,667 backend tests, coverage 96.48/90.43/99.59/96.48; commits `4825938` + `5507ff9`; Decision #3 (copyMemberState preserves absence; T6/T7 must default) flagged — `build-log-T3.md`
- 2026-11-19 — building — dispatching T7 (frontend protocol mirror + reducer); T4/T5/T8 batch follows T7; T6 after T4/T5 — `tasks.md`
- 2026-11-19 — building — T7 production code + protocol tests complete (633 protocol tests), but reducer tests, full verify, build log and commit were cut off by the step cap; finish builder dispatched — `tasks.md`
- 2026-11-19 — building — T7 completed: frontend protocol mirror/reducer, 83 files / 2,795 tests, coverage 97.16/96.66/98.33/97.16; commits `fb38938` + `c1ed5b8`; `session.test.ts` fixture-only deviation recorded — `build-log-T7.md`
- 2026-11-19 — building — dispatching T12 (next `[seq]`; T4/T5/T8 parallel batch follows T12; T6 after T4/T5) — `tasks.md`
- 2026-11-19 — building — T12 partial: cube-view/world/scene production code on disk, but scene tests, scene-spaceship tests, full verify, build log and commit were cut off by the step cap; finish builder dispatched — `tasks.md`
- 2026-11-19 — building — T12 code/tests now green: 83 files / 2,819 frontend tests, coverage 97.15/96.68/98.35/97.15, focused scene 100 / scene-spaceship 34 / world 34 / cube-view 40; build log and commit remain; commit-only finish builder dispatched — `tasks.md`
- 2026-11-19 — building — T12 completed: commit `49439ea` + docs `ec67f60`; scene remote-ship lifecycle/fire/budgets/picking and own-ship shot/pulse tests green — `build-log-T12.md`
- 2026-11-19 — building — dispatching T4 ∥ T5 ∥ T8 (all `[P]`, disjoint files: metrics allow-lists, repository v3, engine v3/adoption); T17 deferred until T4/T6/T13/T16 because its docs cover their behavior — `tasks.md`
- 2026-11-19 — building — T5 completed: repository v3 read normalization/widening, v3 round-trip, no schema change; backend 38 files / 1,676 tests, coverage 96.48/90.43/99.59/96.48; commits `7637179` + `4ff8bfd` — `build-log-T5.md`
- 2026-11-19 — building — T8 completed: engine v3 guest equip/unequip + `adoptAppearance`; 83 files / 2,829 tests, coverage 97.16/96.69/98.35/97.16; commits `a8acd76` + `258cfec`; **gap found:** guest `openLootbox` still uses the v2 draw, so guests cannot acquire generated v3 parts — follow-up dispatched — `build-log-T8.md`
- 2026-11-19 — building — T4 completed: metrics allow-lists for `memberAppearance`/`setAppearance`; backend 38 files / 1,676 tests, coverage 96.48/90.43/99.59/96.48; commits `8096f6e` + `1e21e70` — `build-log-T4.md`
- 2026-11-19 — building — dispatching T6 (hub appearance authority) while the T8 guest-loot follow-up runs; T13/T16/T17/T18 follow — `tasks.md`
- 2026-11-19 — building — T8 follow-up completed: guest `openLootbox` uses `selectLootPartV3`, generated v3 ids reachable; 83 files / 2,832 tests, coverage 97.15/96.69/98.35/97.15; commit `e0a4965`; T13-owned session fixture updated mechanically — `build-log-T8.md`
- 2026-11-19 — building — T6 partial: hub appearance authority production code + 209 hub tests on disk (3 failing, 2 fixed after the last run), `app.test.ts` fixture catch-up, full verify, build log and commit remain; finish builder dispatched — `tasks.md`
- 2026-11-19 — building — T6 completed: hub appearance authority, backend 38 files / 1,694 tests, coverage 96.46/90.49/99.59/96.46; welcome 16,362 B, worst frame 493 B; commits `9129998` + `e78fa4a` — `build-log-T6.md`
- 2026-11-19 — building — dispatching T13 (session convergence/spectate/live appearance; next `[seq]`); T16 follows, then T17/T18 — `tasks.md`
- 2026-11-19 — building — T13 partial: session implementation + 10 new tests on disk and typechecking; full verify, build log and commit remain; finish builder dispatched. Note: `render/world.ts` ignores `memberAppearance`, so T13 resyncs the mounted ship after mount and after `levelAdvanced` — recorded for review — `tasks.md`
- 2026-11-19 — building — T13 completed: session convergence/live re-skin/spectate lifecycle; 83 files / 2,844 tests, coverage 97.15/96.75/98.36/97.15; commits `234bada` + `341e5ee` — `build-log-T13.md`
- 2026-11-19 — building — dispatching T16 (containerized smoke: guest `setAppearance` fan-out + malformed-frame guard); T17 docs and T18 final verify follow — `tasks.md`
- 2026-11-19 — building — T16 completed: smoke PASS 29/29 incl. the appearance projection check; commit `daf40e3`; compose/package/source diff gates empty — `build-log-T16.md`
- 2026-11-19 — building — dispatching T17 documentation pass (README, realtime, frontend-rendering, observability, glossary); T18 follows — `tasks.md`
- 2026-11-19 — building — T17 completed: README + realtime public projection + remote ships (182/185 budgets) + observability allow-lists + glossary; 2,844 frontend tests, coverage 97.15/96.75/98.36/97.15; commits `c99468d` + `e0b2fbb` — `build-log-T17.md`
- 2026-11-19 — building — dispatching T18 final verification; pre-step commits the pre-existing coin-economy/README index bookkeeping so the status gate is clean; features-index diff is checked as "T17 did not edit it" because the orchestrator-owned row changes are separate — `tasks.md`
- 2026-11-19 — building → code_review — all 18 tasks `[x]`; T18 final verify green (lint/typecheck/test/coverage/build/smoke 29/29; backend 96.46/90.49/99.59/96.46; frontend 97.15/96.75/98.36/97.15; bundle +2,020/+30/+5,218 vs BASE `4233147`; 13,401 B total headroom) — `build-log-T18.md`
- 2026-11-19 — code_review → building — review r1 `changes_requested` (1 MAJOR: `realtime.md` leaderboard privacy sentence still says no frame carries appearance; minors F2/F3 docs wording) — `reviews/code-r1.md`
- 2026-11-19 — building → code_review — F1/F2/F3 fixed in `realtime.md`/`frontend-rendering.md`; docs greps and frontend suite green; commits `1f95cd6` + `ec38660`; code review r2 started — `build-log-code-r1-fixes.md`
- 2026-11-19 — code_review → accepted — review r2 `approved` (0 blocking; F1–F3 verified fixed, scope clean) — `reviews/code-r2.md`

## Blockers / open questions
- **Accepted.** Code review r2 approved with 0 blocking; F1–F3 fixed and scope clean.
- **Residual backlog (non-blocking):** F9 wording nuance on the projection exception; F4 is the coin-economy index bookkeeping commit; F5–F8 are accepted INFO notes (favorable bundle delta, welcome byte difference, preview per-file coverage, smoke service reuse).
- **T13/T12 seam note:** `render/world.ts` does not consume `memberAppearance`; T13 compensates with `setSpectatedAppearance` after mount and after `levelAdvanced`. If the reviewer prefers the scene world to own it, that is a T12 follow-up.
- **T6 fixture deviation:** `app.test.ts` inline `MemberState` literals gained mechanical `appearance: {}` because AC-7 makes the server projection always populated; recorded for feature review.
- **T17 deferred:** ready by DAG (T12/T15 done) but logically depends on T4/T6/T13/T16 because its docs cover their behavior; schedule after those tasks.
- **T12 fixture deviation:** `session.test.ts` (T13-owned) needed inert `setSpectatedMember()`/`setSpectatedAppearance()` fakes and three `appearance: {}` fixtures; mechanical only, no behavior, recorded for feature review.
- **T7 fixture deviation:** `session.test.ts` (T13-owned) needed three `appearance: {}` fixture properties after `copyMember` began filling the default; this is a mechanical fixture-only change recorded for the feature review. T13 still owns all session behavior changes.
- **T3 Decision #3 risk:** `copyMemberState` preserves an absent `appearance` rather than injecting `{}` (to keep 19 accepted deep-equal fixtures untouched); `memberAppearanceOf` returns `{}` and the codec rules are tested. T6 must populate server builders; T7 must default client copy/reducer paths. Feature code review should verify this interpretation against AC-7.
- **Spec approved.** Q-1 spectated-only visibility, Q-3 75/25 loot pacing with duplicates, Q-4 guest structural validation only are the approved defaults.
- **Process note:** T1 committed on `main` before the feature branch existed; T2 created `feat/remote-spaceship-customization` from the current HEAD. The `coin-economy` test-only fix commits (`eece694`, `8c76e0c`) also landed on this branch to unblock the pipeline; coin-economy is accepted.
- **Backlog (non-blocking):** M1 AC-34 wording; M2 T4 metrics test scope; M3 extra docs cleanup; M4 INFO T9/AC-18 evidence overlap.
