---
feature: realtime-broadcast-batching
state: building
spec_review_round: 4
build_round: 1
created: 2026-11-13
updated: 2026-11-13
---
# Status — Real-Time Broadcast Batching

## Summary

Next performance feature of the approved audit queue: the hub serializes every server message once **per recipient**, deep-copies the whole registry on every broadcast/location lookup, broadcasts one `miniCubeRemoved` per accepted click and one `economyUpdate` per account connection per credited click. This feature encodes each server message once and fans out the same string, adds an O(1) `locationOf` index plus a no-copy `forEachMember` visitor while keeping the defensive `servers()` snapshot, batches mini-cube removals into a 40 ms window as `miniCubesRemoved` (legacy `miniCubeRemoved` for a single id) with boundary flushes, and coalesces credit-driven economy broadcasts to 4 Hz per account with absolute totals and unchanged DB writes. A zero-dependency Node 24 benchmark records before/after encodes, registry copies, frames per 100 clicks, DB credits and p95 ack latency. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one".

## Task board

- [x] T1 — Protocol `miniCubesRemoved` frame in both mirrors (builder) `[seq]`
- [x] T2 — Registry index, broadcast schedulers, benchmark harness (builder) `[seq]`
- [x] T3 — Hub fan-out, batching, economy coalescing, smoke burst (builder) `[seq]`
- [x] T4 — Frontend consumption (reducer/session/world) (builder) `[seq]`
- [ ] T5 — Documentation and final verification (builder) `[seq]`

## Loop log

- 2026-11-13 — created → PLANNING — next performance feature of the approved audit queue; planner artifacts r1 written (`spec.md`, `plan.md`, `tasks.md`); audit evidence: `hub.ts:333-363` per-recipient encode, `servers.ts:274-276` snapshot copies, `hub.ts:787-800` per-connection economy encode, `hub.ts:866-890` completion broadcasts; raw request quoted above.
- 2026-11-13 — planning → spec_review — polish applied (containerization impact, identity line, AC-25 baseline, benchmark verify commands); review round 1 pending — `spec.md` r1
- 2026-11-13 — spec review r1 → changes_requested (4 major: checkpoint, economy ordering, shutdown guard, integration proof); planner revision r2 pending — `reviews/spec-review-r1.md`
- 2026-11-13 — planner revision r2 applied — checkpoint Q-1..Q-5; AC-29 economy revision; AC-30 shutdown guard; AC-18 integration chain; F5-F9 fixes; → SPEC_REVIEW round 2 — `spec.md` r2
- 2026-11-13 — spec review r2 → changes_requested (1 major: purchase/upgrade ordering guard); planner revision r3 pending — `reviews/spec-review-r2.md`
- 2026-11-13 — planner revision r3 applied — separate purchase/upgrade revision guard; AC-29 two-purchase race; shutdown join guard; F3-F5 fixes; → SPEC_REVIEW round 3 — `spec.md` r3
- 2026-11-13 — spec review r3 → changes_requested (1 major: stale T3 sentence contradicts upgrade guard); targeted T3 fix pending — `reviews/spec-review-r3.md`
- 2026-11-13 — spec_review → awaiting_approval — r4 approved (0 blockers); Q-1..Q-5 checkpoint pending — `reviews/spec-review-r4.md`
- 2026-11-13 — awaiting_approval → building — user approved defaults: 40 ms removals, 250 ms economy, slow clients out of scope, evidence-only benchmark, legacy single-id shape — user message
- 2026-11-13 — building T1 started — protocol `miniCubesRemoved` frame in both mirrors — `tasks.md` T1
- 2026-11-13 — building T1 completed — batch protocol frame + validation; commit `b38d71b`; backend 881 tests, frontend 1833; coverage 95.45/96.43 statements — `build-log-T1.md`
- 2026-11-13 — building T2 completed — registry index + broadcast batchers + benchmark baseline; commit `b47af70`; backend 903 tests; coverage 95.49/88/99.72/95.49; baseline encode 10/broadcast, removal 100, economy 100, p95 2.45 ms — `build-log-T2.md`
- 2026-11-13 — building T3 completed — economy revisions (`728d930`), hub encode-once/batching/coalescing (`6dab4f0`), after benchmark + smoke (`50bc999`); backend 959 tests, coverage 94.63/87.35/99.46/94.63; encode 1, registry 0, removal 4, economy 4, p95 41.24 ms; smoke 21/21 — `build-log-T3.md`
- 2026-11-13 — building T4 completed — frontend batch consumption + AC-18 integration chain; commit `18dea2d`; frontend 1844 tests, coverage 96.47/96.14/97.54/96.47 — `build-log-T4.md`

## Blockers / open questions

- Q-1 — removal window: approved 40 ms.
- Q-2 — economy cadence: approved 250 ms (4 Hz).
- Q-3 — slow clients: approved out of scope; only synchronous send-error isolation.
- Q-4 — benchmark gate: approved evidence-only.
- Q-5 — single-id compatibility: approved legacy `miniCubeRemoved`.
- Q-6 — completion message fusion: recommended no (encode-once only); builder default.
- Q-7 — `HubDeps.registry` test seam: recommended include; builder default.
- Q-8 — docs home: new `docs/architecture/realtime.md` plus README benchmark subsection; builder default.
- Spec approved r4 (0 blockers); awaiting Q-1..Q-5 user confirmation. No code, protocol, test or feature state has been changed.
