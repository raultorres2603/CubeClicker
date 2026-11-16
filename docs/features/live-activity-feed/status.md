---
feature: live-activity-feed
state: accepted
spec_review_round: 2
build_round: 2
created: 2026-11-15
updated: 2026-11-16
---
# Status — Live Activity Feed

## Summary

Per-server, server-authoritative activity feed: the hub derives cube completion, fast clear, level milestone, epic loot, join and leave events from already validated transitions, rate-limits them to at most one per second per server, keeps the latest 20 newest-first in memory, broadcasts an additive `activityEvent` through the existing encode-once fan-out, and includes the ring in `welcome`/reconnect and `worldEntered`. The frontend keeps the feed in `WorldState.activity` and renders a non-interactive, non-live `ActivityFeed` ticker with a reduced-motion variant. No persistence, new service, dependency, identity change or protocol version bump. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one" and "continue".

## Task board

- [x] T1 — Activity feed core and wire catalog (backend) `[seq]`
- [x] T2 — Hub derivation, welcome/reconnect, metrics allow-list `[seq]`
- [x] T3 — Frontend protocol mirror, reducer and session chain `[seq]`
- [x] T4 — ActivityFeed UI, App wiring, CSS, smoke proof `[seq]`
- [x] T5 — Documentation and final verification `[seq]`

## Loop log

- 2026-11-15 — created → PLANNING — planner artifacts r1 written (`spec.md`, `plan.md`); `tasks.md` pending the step-limit resume; audit evidence: hub completion/join/leave/loot transitions, shared `placementPayload`, metrics `type` allow-list throw risk, `WorldState` server-switch semantics, single `.phase-announcement` live region, existing A/B/C smoke grace flow.
- 2026-11-15 — planning → spec_review — `tasks.md` written (T1-T5 sequential); review round 1 pending — `spec.md` r1
- 2026-11-15 — spec review r1 → changes_requested (2 major: cadence vs exact-one, move completion unobservable; minors); planner revision r2 pending — `reviews/spec-review-r1.md`
- 2026-11-15 — planner revision r2 applied — gate-qualified ACs, completion precedence with unconditional move-in join suppression, validation/privacy/order fixes; → SPEC_REVIEW round 2 — `spec.md` r2
- 2026-11-15 — spec_review → awaiting_approval — r2 approved (0 blockers); catalog wording tightened; Q-1..Q-4 checkpoint pending — `reviews/spec-review-r2.md`
- 2026-11-15 — awaiting_approval → building — user approved defaults: milestone every 5, 1/s drop-not-queue, 20 stored/5 visible, top-center ticker, completion precedence, worldEntered snapshot
- 2026-11-15 — building T1 started — activity core and wire catalog — `tasks.md` T1
- 2026-11-15 — building T1 completed — activity core + protocol catalog; commit `10ffc77`; backend 1295 tests, coverage 96.06/89.46/99.55/96.06 — `build-log-T1.md`
- 2026-11-15 — building T2 completed — hub derivation + welcome/reconnect + metrics allow-list; commit `322b291`; backend 1324 tests, coverage 96.13/89.58/99.55/96.13 — `build-log-T2.md`
- 2026-11-15 — building T3 completed — frontend protocol/reducer/session; commit `2b43f28`; frontend 2053 tests, coverage 96.6/96.29/97.77/96.6 — `build-log-T3.md`
- 2026-11-16 — building T4 completed — ActivityFeed ticker + App/CSS + smoke; commit `5e546f1`; frontend 2069 tests, coverage 96.61/96.31/97.78/96.61; smoke 24/24 — `build-log-T4.md`
- 2026-11-16 — building T5 completed — realtime/glossary docs + final gates; commit `2665db6`; full suite 3,393 tests; coverage backend 96.13/89.58/99.55/96.13, frontend 96.61/96.31/97.78/96.61; build + smoke 24/24 — `build-log-T5.md`
- 2026-11-16 — building → code_review — all T1-T5 verified; acceptance row pending — `build-log-T5.md`
- 2026-11-16 — code_review → accepted — code review r1 approved (0 blockers); all 28 ACs met; F1 test-timing note in backlog — `reviews/code-review-r1.md`

## Blockers / open questions

- Q-1 — milestone every 5th cube: approved.
- Q-2 — drop-not-queue at 1/s per server: approved.
- Q-3 — 20 stored / 5 visible: approved.
- Q-4 — top-center ticker: approved.
- Q-5…Q-14 — builder defaults recorded in `spec.md`/`plan.md`.
- **Backlog (MINOR):** `app.test.ts` live-socket activity test uses a 250 ms real wait; replace with a deterministic seam in a follow-up. No behavior impact.
