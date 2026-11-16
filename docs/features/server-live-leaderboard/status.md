---
feature: server-live-leaderboard
state: building
spec_review_round: 2
build_round: 1
created: 2026-11-16
updated: 2026-11-16
---
# Status — Server Live Leaderboard

## Summary

Session-scoped, per-server live leaderboard: the hub tracks accepted clicks, completed cubes and session totals for every member (guests and accounts on the same basis), ranks by cubes then clicks then slot order, coalesces a `leaderboardUpdate` to about 1 Hz through the existing encode-once fan-out, and includes the snapshot in `welcome`/reconnect and `worldEntered`. The frontend keeps it in `WorldState.leaderboard` and renders a top-5 panel plus server totals with reduced-motion support. No persistence, global/all-time ranking, new service, dependency, identity change or protocol version bump. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one" and "Proceed with server-live-leaderboard".

## Task board

- [x] T1 — Leaderboard core and wire catalog (backend) `[seq]`
- [x] T2 — Hub counters, snapshot delivery, coalescing and metrics `[seq]`
- [x] T3 — Frontend protocol mirror, reducer and session chain `[seq]`
- [x] T4 — Leaderboard UI, App wiring, CSS, smoke proof `[seq]`
- [ ] T5 — Documentation and final verification `[seq]`

## Loop log

- 2026-11-16 — created → PLANNING — planner artifacts r1 written (`spec.md`, `plan.md`, `tasks.md`); status created by orchestrator; audit evidence: hub accepted click/completion/join/leave/grace paths, existing encode-once fan-out, 250 ms economy coalescer pattern, `WorldState` server-switch semantics, single `.phase-announcement` live region, existing A/B/C smoke flow.
- 2026-11-16 — planning → spec_review — review round 1 pending — `spec.md` r1
- 2026-11-16 — spec review r1 → changes_requested (1 major: status checkpoint/Q numbering; minors: AC-23 wording); status aligned; planner revision r2 pending — `reviews/spec-review-r1.md`
- 2026-11-16 — planner revision r2 applied — Q-1..Q-14 unified, coins excluded, move/grace counters follow member, left rail, short-viewport AC/CSS; status corrected; → SPEC_REVIEW round 2 — `spec.md` r2
- 2026-11-16 — spec_review → awaiting_approval — r2 approved (0 blockers); Q-1..Q-4 checkpoint pending — `reviews/spec-review-r2.md`
- 2026-11-16 — awaiting_approval → building — user approved defaults: cubes→clicks→slot, coins excluded, counters follow mover/grace, left rail
- 2026-11-16 — building T1 started — leaderboard core and wire catalog — `tasks.md` T1
- 2026-11-16 — building T1 completed — leaderboard core + protocol; commit `b03d87f`; backend 1487 tests, coverage 96.22/89.87/99.56/96.22 — `build-log-T1.md`
- 2026-11-16 — building T2 completed — hub counters + 1 Hz coalescing + snapshots; commit `2a03d3c`; backend 1506 tests, coverage 96.19/89.83/99.57/96.19 — `build-log-T2.md`
- 2026-11-16 — building T3 completed — frontend protocol/reducer/session; commit `d062913`; frontend 2229 tests, coverage 96.62/96.33/97.79/96.62 — `build-log-T3.md`
- 2026-11-16 — building T4 completed — Leaderboard panel + App/CSS + smoke; commit `d6855b3`; frontend 2248 tests, coverage 96.63/96.35/97.8/96.63; smoke 26/26 — `build-log-T4.md`

## Blockers / open questions

- Q-1 — rank metric: cubes, then clicks, then slot order (recommended).
- Q-2 — coins excluded from ranking, wire and totals (recommended; upgrade-scaled and account-only authority).
- Q-3 — move/grace semantics: counters follow the member to the new server; the target snapshot includes the completion that caused the move; grace members retain their session row until expiry (recommended).
- Q-4 — placement: left rail below the HUD and activity feed; no overlap with HUD/banner/feed/user panel, though very-short-viewport lower rows may clip behind the upgrades panel while remaining in the accessibility tree (recommended).
- Q-5…Q-14 — builder defaults recorded in `spec.md`/`plan.md`.
