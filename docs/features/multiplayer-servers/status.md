---
feature: multiplayer-servers
state: accepted
spec_review_round: 1
build_round: 2
created: 2026-10-21
updated: 2026-10-22
---
# Status — Multiplayer Servers & Spectating

## Summary
Turn the single-player frontend into an online experience: the backend comes online and hosts a first server, each server holds up to X users (capacity to be analysed), every connected user gets their own cube in the shared space, users can travel to another user's cube via a "Users on Server" button, overflow users spill into additional servers, and servers rebalance as users disconnect and finish cubes.

## Task board
16 tasks, dependency-ordered; 7 parallel-safe ([P]: T2, T3, T4, T8, T9, T10, T11).
- [x] T1 backend core (config, registry, assignment, move plan, ring)
- [x] T2 backend identity/grace [P]
- [x] T3 backend cube state [P]
- [x] T4 backend protocol codecs [P]
- [x] T5 backend hub + `/ws` wiring
- [x] T1b stable slot occupancy (corrective, inserted by orchestrator)
- [x] T7 frontend multiplayer core
- [x] T8 engine online seams [P]
- [x] T9 frontend transport [P]
- [x] T10 world view / remote cubes [P]
- [x] T11 spectate travel math [P]
- [x] T12 scene online integration
- [x] T13 session wiring
- [x] T14 UI (Users on Server panel, banner, HUD)
- [x] T15 containers & e2e smoke
- [x] T16 verify & integrate
- [x] T17 corrective: mid-flight resume reset + spectator stays viewing
- [x] T5b corrective: plan recompute, trailing-second limiter, cap ordering, donor order
- [x] T17b corrective: authoritative board adoption, held-travel release, pre-welcome UI gating
- [x] T15b corrective: smoke idempotency + errata commit

## Loop log
- 2026-10-21 — created → PLANNING — request: "include backend … every time backend goes online … it will create the first server"
- 2026-10-21 — planning → spec_review — planner delivered spec/plan/tasks — docs/features/multiplayer-servers/spec.md, plan.md, tasks.md
- 2026-10-21 — spec_review → awaiting_approval — verdict approved (0 blocking, 2 MINOR backlog) — reviews/spec-r1.md
- 2026-10-21 — awaiting_approval → building — user approved; capacity confirmed X = 10 (MAX_USERS_PER_SERVER default) — status.md
- 2026-10-21 — building: T1 complete — 47 backend tests, 100% coverage — build-log-T1.md
- 2026-10-21 — building: T2, T3, T4 complete — 140 backend tests, 100% coverage on all four metrics — build-log-T2.md, build-log-T3.md, build-log-T4.md
- 2026-10-21 — building: T5 complete — 172 backend tests, 98.4 stmts / 96.9 branch / 100 funcs / 98.4 lines — build-log-T5.md
- 2026-10-21 — building: T1b corrective complete (stable slots across removals) — 180 backend tests, 98.5/97.1/100/98.5 — build-log-T1b.md
- 2026-10-22 — building: T7 complete (frontend core) — 502 frontend tests, 99.4/99.3/100/99.4 — build-log-T7.md
- 2026-10-22 — building: T8–T15 complete — 782 tests total; smoke 8/8 PASS; build 216.3 kB gzip — build-log-T8…T15.md
- 2026-10-22 — building: T16 first pass blocked — AC-19(c/d) and AC-22 mid-flight clause unmet; corrective T17 inserted — build-log-T16.md
- 2026-10-22 — building: T17 complete — 788 tests, backend 98.5/97.1/100/98.5, frontend 99.1/98.3/99.3/99.1 — build-log-T17.md
- 2026-10-22 — building → code_review — T16 second pass: 27/27 ACs met; smoke 8/8 PASS (clean stack) — build-log-T16.md
- 2026-10-22 — code_review → building — verdict changes_requested, 4 blocking (F1/F2 client authority+resume, F3 plan recompute, F4 trailing-second limiter); corrective T5b/T17b/T15b — reviews/code-r1.md
- 2026-10-22 — building: T5b, T17b, T15b complete; spec/glossary r2 errata committed — 810 tests, backend 98.5/97.2/100/98.5, frontend 99.0/98.3/99.3/99.0; smoke 8/8 twice — build-log-T5b.md, T17b.md, T15b.md
- 2026-10-22 — building → code_review — round 2 — reviews/code-r2.md (pending)
- 2026-10-22 — code_review → accepted — verdict approved (0 blocking, F1–F11 closed, 27/27 ACs) — reviews/code-r2.md

## Blockers / open questions
- **Slot stability defect (T5 Q-T5-2), fixing before the frontend chain:** the registry stores members in a dense array, so a removal compacts remaining slots and staying members' cubes would jump position mid-play — contradicting spec § 5 / D-6 ("positions stable while the member stays"), and unimplementable client-side because no message carries the new positions. Fix: explicit slot occupancy with holes in `servers.ts` + hub reads the member's slot.
- **Spec erratum (T5 prose):** tasks.md T5 said `attach` sends `hello`; plan § Interfaces and AC-20 make the `/ws` route the sender (hub importing app would be a cycle). Implemented route-owned; hub asserts attach sends nothing; app integration asserts hello-first over a real socket.
- **Spec erratum (AC-10 fixture):** spec.md/tasks.md show both `[1: X, 2: 1] → {p2: 1}` and `[1: X, 2: 1] → {}`. Resolution applied (normative § 4 "free slots" + strictly-lower targets): `[1: X−1, 2: 1] → {p2: 1}`, `[1: X−2, 2: 2] → {p2: 1, p3: 1}`, `[1: X, 2: 1] → {}`. T1 tests pin this; code review must confirm § 4 semantics; doc text to be corrected in the erratum commit.
- T1 note: `MAX_MESSAGE_BYTES` is exposed on `GameConfig.maxMessageBytes`; T4 owns the exported codec constant (no duplication of the numeric literal in public API).
