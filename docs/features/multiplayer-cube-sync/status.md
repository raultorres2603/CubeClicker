---
feature: multiplayer-cube-sync
state: accepted
build_round: 1
created: 2026-10-22
updated: 2026-10-23
---
# Status — Multiplayer Cube Actions & Full Spectating

## Summary
Follow-up to the accepted `multiplayer-servers` feature. Remote cubes currently only mirror mini-cube pops, face clears and level advances; cube rotation (and possibly other local actions) is not synced, so spectators and nearby viewers cannot see another user turning their cube. Requested: full spectating — rotations and all actions visible on remote cubes in view, with completed cubes removed/replaced after transition.

## Task board
8 tasks, dependency-ordered; [P]: T3, T4, T5, T6.
- [x] T1 backend protocol (orientation, rotate, cubeRotated, stateSync)
- [x] T2 backend hub (orientation storage, rotate handling, clamp, broadcast)
- [x] T3 frontend protocol mirror + parity [P]
- [x] T4 frontend reducer (orientation, cubeRotated, stateSync) [P]
- [x] T5 frontend engine (adopt orientation) [P]
- [x] T6 frontend world view (remote rotation animator, cubeRotated) [P]
- [x] T7 frontend session (throttle, adoption, spectate reset)
- [x] T8 verify & integrate
## Loop log
- 2026-10-22 — created → PLANNING — request: "when a face is done on a cube that is not mine, I can't see it turning … FULL spectating mode … every cube finished … removed from the map"
- 2026-10-22 — planning → spec_review — planner delivered spec/plan/tasks — docs/features/multiplayer-cube-sync/spec.md, plan.md, tasks.md
- 2026-10-22 — spec_review → planning — verdict changes_requested, 9 blocking (F1 codec range, F2 rate-limit order, F3 latest-wins scope, F4 rotationMs, F5 unmodified suites, F6 applyMessage, F7 backend storage, F8 self-adopt, F9 reconnect reset) — reviews/spec-r1.md
- 2026-10-22 — planning → spec_review — planner delivered revision r2 addressing all 16 findings — spec.md, plan.md, tasks.md
- 2026-10-22 — spec_review → awaiting_approval — verdict approved (0 blocking) — reviews/spec-r2.md
- 2026-10-23 — building → code_review — T8 verify pass: 810→? tests; smoke 8/8; build 0; 17/17 ACs met — build-log-T8.md
- 2026-10-23 — code_review → accepted — verdict approved (0 blocking) — reviews/code-r1.md

## Blockers / open questions
- none
