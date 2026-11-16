---
feature: presence-and-activity-liveness
state: accepted
spec_review_round: 2
build_round: 2
created: 2026-11-16
updated: 2026-11-16
---

# Status — Presence & Activity Liveness

## Summary

Make live server state reflect reality: a player who closes the game must stop appearing as present on their server, and server activity messages must be temporal (about 5 seconds on screen, then disappear) instead of accumulating. Raw request: "When closing game, player remains on server, it's a bug." and "Also, server activity must be temporal, like 5 seconds message and then dissapears."

## Task board

- [x] T1 — Backend wire: `leave`, TTL constant, received allow-list `[seq]`
- [x] T2 — Backend activity TTL `[P]`
- [x] T3 — Backend hub explicit leave `[P]`
- [x] T4 — Frontend protocol mirror `[P]`
- [x] T5 — Frontend activity lifetime + prune helper `[P]`
- [x] T6 — Frontend session + browser env `[seq]`
- [x] T7 — Containerized smoke `[P]`
- [x] T8 — Documentation pass `[P]`
- [x] T9 — Verify & integrate `[seq]`

## Loop log

- 2026-11-16 — created → PLANNING — request: "When closing game, player remains on server, it's a bug." + "Also, server activity must be temporal, like 5 seconds message and then dissapears."
- 2026-11-16 — planning → spec_review — planner completed spec/plan/tasks r1; root-cause audit identifies the missing explicit-close signal (not grace expiry); 21 ACs, 9 tasks — `spec.md`, `plan.md`, `tasks.md`
- 2026-11-16 — spec_review → planning — changes_requested r1 (4 MAJOR, 7 MINOR, 4 INFO) — `reviews/spec-review-r1.md`
- 2026-11-16 — planning → spec_review — planner applied r2: AC-1…AC-23, F1–F15 dispositions, Q-3 decided technically, checkpoint Q-1/Q-2/Q-4 — `spec.md` r2
- 2026-11-16 — spec_review → escalated — changes_requested r2 (1 MAJOR: tombstoned welcome seed can display for up to 250 ms; plan prunes only on the interval); spec-review budget exhausted — `reviews/spec-review-r2.md`
- 2026-11-16 — escalated → planning — user authorized a targeted re-review: apply the synchronous-prune fix, then reviewer verifies only that fix (r2a) — user decision
- 2026-11-16 — planning → spec_review — planner applied r2a: synchronous prune on every reduction and `applyWorldSwap`, AC-17 immediate 5001 empty feed, timer counts 3→2/2→0, AC-2 observable counters, session/transport wording — `spec.md` r3
- 2026-11-16 — spec_review → awaiting_approval — targeted r2a verification approved (0 blocking, 2 INFO); spec ready for checkpoint Q-1/Q-2/Q-4 — `reviews/spec-review-r2a.md`
- 2026-11-16 — awaiting_approval → building — user approved the spec and defaults Q-1 (TTL 5000 ms), Q-2 (grace members remain listed), Q-4 (per-connection presence) — user decision
- 2026-11-16 — building T1 started — backend wire: `leave`, TTL constant, received allow-list — `tasks.md` T1
- 2026-11-16 — building T1 completed — `leave` decoder + `ACTIVITY_EVENT_TTL_MS=5000` + received allow-list; commit `2e4a2ce`; backend 1520 tests, coverage 96.15/89.81/99.57/96.15 — `build-log-T1.md`
- 2026-11-16 — building T2 + T4 started — parallel-safe batch: backend activity TTL ∥ frontend protocol mirror — `tasks.md` T2/T4
- 2026-11-16 — building T2 implemented — commit `7c212d5`; activity 24 tests + 100% coverage green; full backend suite red on five T3-owned `hub.test.ts` welcome TTL expectations; T3 will re-pin — `build-log-T2.md`
- 2026-11-16 — building T4 completed — commit `e39c378`; frontend 2262 tests, coverage 96.63/96.35/97.8/96.63; `leave` parity 11/11 — `build-log-T4.md`
- 2026-11-16 — building T3 started — hub explicit leave + welcome TTL re-pins to restore the green backend gate — `tasks.md` T3
- 2026-11-16 — building T3 completed — explicit `leave` finalizes through `removeMember`, `closeReason='client'`, peer close; five+one welcome TTL re-pins; commit `4734fe8`; backend 1537 tests, coverage 96.2/89.92/99.57/96.2 — `build-log-T3.md`
- 2026-11-16 — repo-state note — parallel game-feel builder shared the checkout; T3's first commit was moved to the presence branch via cherry-pick (`4734fe8`), game-feel branch reset to `4421351` with its uncommitted work preserved.
- 2026-11-16 — building T2 evidence closed — post-T3 re-run on the presence branch: backend 1537 tests green, coverage 96.2/89.92/99.57/96.2; commit `5b678e1` — `build-log-T2.md`
- 2026-11-16 — building T5 started — frontend activity lifetime/tombstones + prune helper — `tasks.md` T5
- 2026-11-16 — building T5 completed — commit `bdf7a77`; `activity-lifetime.ts` 100%, `pruneActivity` reference-stable; frontend 2287 tests, coverage 96.66/96.41/97.83/96.66 — `build-log-T5.md`
- 2026-11-16 — building T6 started — session wiring: synchronous prune, 250 ms fallback, visibility, exception-safe pagehide leave — `tasks.md` T6
- 2026-11-16 — building T6 completed — commit `d7085f8`; pagehide leave + synchronous tombstone prune, 250 ms fallback, visibility, dispose; frontend 2301 tests, coverage 96.68/96.43/97.85/96.68 — `build-log-T6.md`
- 2026-11-16 — building T7 started — containerized smoke: explicit leave < 900 ms, abrupt close ≥ 900 ms, freed-slot join — `tasks.md` T7
- 2026-11-16 — building T7 completed — commit `cca6373`; `npm run smoke` PASS 28/28, explicit leave 1 ms, roster `[A, E]`, existing grace check unchanged; bundle budget OK — `build-log-T7.md`
- 2026-11-16 — building T8 started — docs: presence/leave, activity lifetime, observability rows, page lifecycle, glossary — `tasks.md` T8
- 2026-11-16 — building T8 completed — commit `dd223ee`; realtime presence/lifetime, observability allow-lists, page lifecycle, glossary; all greps/link check pass — `build-log-T8.md`
- 2026-11-16 — building T9 started — full root gate + smoke + protected-file checks — `tasks.md` T9
- 2026-11-16 — building T9 completed — commit `fe567fe`; lint/typecheck/test/build green; coverage backend 96.2/89.92/99.57/96.2, frontend 96.68/96.43/97.85/96.68; smoke 28/28; protected files unchanged — `build-log-T9.md`
- 2026-11-16 — building → code_review — all T1–T9 `[x]` with recorded evidence; feature index row proposed in T9 log — `build-log-T9.md`
- 2026-11-16 — code_review → building — changes_requested r1 (1 MAJOR: feature artifacts untracked / committed docs link broken; 3 MINOR, 1 INFO) — `reviews/code-review-r1.md`
- 2026-11-16 — review fixes started — tracking commit for spec/plan/tasks/status/reviews; close-reason heartbeat race; T9/T2 log wording — `reviews/code-review-r1.md`
- 2026-11-16 — review fixes completed — commits `8a75f0f` (clear heartbeat on leave; close reason stays `client`) and `909d0cd` (feature artifacts tracked, spec approved, log/EOF fixes); backend 1538 tests, coverage 96.2/89.92/99.57/96.2 — `build-log-r1-fixes.md`
- 2026-11-16 — building → code_review — r1 findings closed; code review round 2 started — `reviews/code-review-r1.md`
- 2026-11-16 — review r1 fixes applied — feature artifacts tracked; F4 clears the leave heartbeat before the peer close with a delayed-close test; T2 EOF fixed; T9 log reconciled; spec status approved — `build-log-r1-fixes.md`
- 2026-11-16 — code_review → accepted — code review r2 approved (0 blocking, 1 INFO); all AC-1…AC-23 met; docs pass complete; index row updated — `reviews/code-review-r2.md`

## Blockers / open questions

- none
- **Backlog (INFO):** r2 noted only the orchestrator's acceptance bookkeeping commit; no product or test backlog.

## Review history

- Spec: r1 changes requested (4 MAJOR) → r2 changes requested (1 MAJOR) → targeted r2a approved (0 blocking, 2 INFO).
- Code: r1 changes requested (1 MAJOR, tracking) → r2 approved (0 blocking, 1 INFO).
