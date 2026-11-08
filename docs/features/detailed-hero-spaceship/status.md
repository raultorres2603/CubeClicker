---
feature: detailed-hero-spaceship
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-11-07
updated: 2026-11-08
---
# Status — Detailed hero spaceship

## Summary
Enhance the game's spaceship so it is more detailed and closer to the reference image: a stylized blue/orange retro-futuristic ship with layered hull, cockpit canopy, swept wings, tail fins, twin engine nacelles, glowing exhaust, and orange accents. Request: "Can we enhance space ship? To make it more detailed and like the image."

## Task board
- [x] T1 — Detailed hero ship model factory `[P]`
- [x] T2 — Mount in cosmic backdrop + scene counts `[seq]`
- [x] T3 — Verify & integrate `[seq]`
- [x] T4 — Freeze starfield swirl under reduced motion `[seq]`

## Loop log
- 2026-11-07 — created → PLANNING — request: "enhance space ship ... more detailed and like the image"
- 2026-11-07 — planning → SPEC_REVIEW — planner delivered spec r1, plan, 3 tasks (T1–T3); spec review round 1 — spec.md
- 2026-11-07 — spec_review → PLANNING — review r1: changes_requested (1 blocking, 19 non-blocking); planner revision r2 required — reviews/spec-r1.md
- 2026-11-07 — planning → SPEC_REVIEW — planner delivered spec r2, plan r2, revised tasks; spec review round 2 (final allowed) — spec.md
- 2026-11-07 — spec_review → AWAITING_APPROVAL — review r2: approved, 0 blocking, 1 minor; user checkpoint — reviews/spec-r2.md
- 2026-11-07 — awaiting_approval → BUILDING — user approved spec r2; T1 started — status.md
- 2026-11-08 — building — T1 completed (model factory, 48 meshes, 1,852 triangles); commit faf12fd; frontend 1,350 tests; coverage 95.84/95.37/96.61/95.84 — build-log-T1.md
- 2026-11-08 — building — T2 completed (backdrop/scene integration, 70 objects/63 meshes); commit 111f00c; frontend 1,351 tests; coverage 95.8/95.37/96.61/95.8 — build-log-T2.md
- 2026-11-08 — building — T3 blocked on AC-17 reduced-motion proof: ship boxes identical, but protected starfield swirl still moves under reduced motion (4.48% crop diff at 1280, 8.47% at 2560 vs ≤1%); T4 added to freeze it — build-log-T3.md
- 2026-11-08 — building — spec r3 amendment: T4 freezes starfield swirl under reduced motion; T3 now depends T2/T4; T3 rerun required — spec.md / plan.md / tasks.md
- 2026-11-08 — building — T4 scope extended to the single superseded scene.test assertion (swirl-under-reduced-motion); implementation otherwise complete — tasks.md
- 2026-11-08 — building — T4 completed (starfield swirl frozen under reduced motion); commit 42d998a; frontend 1,356 tests; coverage 95.8/95.37/96.61/95.8; T3 rerun — build-log-T4.md
- 2026-11-08 — building — T3 completed after T4: AC-17 reduced-motion diff 0/19,200 px; 12/12 visual captures; performance 3/3; bundle 258.63 kB; docs pass; commit 3a3a474 — build-log-T3.md
- 2026-11-08 — building → CODE_REVIEW — all tasks T1–T4 [x]; code review round 1 — tasks.md / build-log-T3.md
- 2026-11-08 — code_review → ACCEPTED — review r1: approved, 0 blocking, 2 minor + 5 info; docs pass complete; feature index row added — reviews/code-r1.md

## Blockers / open questions
- None blocking. Spec defaults Q-1..Q-7 approved; B-4 fixed by T4.
- Backlog: MINOR “10-segment octagonal” comment in `spaceship-model.ts`; MINOR stale HEAD/version metadata in `build-log-T3.md`; INFO optional 2560 reduced-motion recapture; INFO reused AC-14/16 evidence (T4 normal path unchanged); INFO optional no-DOM/loader unit assertion; INFO subtle underplate/seams at 1280 (Q-1 fidelity); INFO feature commits on main / artifacts uncommitted.
