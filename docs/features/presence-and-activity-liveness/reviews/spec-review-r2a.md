---
feature: presence-and-activity-liveness
phase: spec_review
round: 2
iteration: 2a
verdict: approved
reviewed: 2026-11-16
blocking: 0
nonblocking: 2
---
# Spec Review — r2a

## Summary

✅ approved — the targeted r2 fixes are correctly applied. F1 is closed: § Client display expiry, § Travel window, § Constants, § Real-time Latency, AC-17/AC-18, the plan's session step and T6 all pin **reduce → observe → synchronous `pruneActivity` → publish** on every world reduction and after `applyWorldSwap`, before any `publishMultiplayer()`; the 250 ms interval is explicitly the fallback for time passing without a reduction. AC-17 pins the immediate 5001 same-server `welcome` feed as `[]` before any tick, which the old interval-only behavior cannot pass. F2's timer counts are plausible against the implementation: AC-1's 3→2 accounting (A/B heartbeats + one coalesced leaderboard timer; then B's heartbeat + the leaderboard timer) and AC-4's 2→0 (last-member heartbeat clear + `leaderboard.dropServer`, activity feed timerless) match `hub.ts` and `leaderboard.ts`. F3 observes the resumed counters through the rejoin `welcome`'s `leaderboard.entries`/`totals.facesDestroyed`; F4 assigns `leave` to the session and states the transport has no `welcomed` concept. No drift: spec/plan revision 3, revision history labelled **r2a targeted fix**, AC-1…AC-23, and the task graph/`files_owned` are unchanged. The spec is ready for the user approval checkpoint with Q-1/Q-2/Q-4.

## F1–F4 verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 — AC-17 synchronous tombstone/expiry | **Fixed** | `spec.md:114-117` (§ Client display expiry: synchronous removal on the reducing feed; `pruneActivity` before any `publishMultiplayer`, including handler publishes); `spec.md:122` (§ Travel window: `worldEntered` prunes before publish; `applyWorldSwap` → observe → synchronous prune → publish); `spec.md:202` (AC-17: immediately after the 5001 same-server `welcome`, before any `ACTIVITY_EXPIRY_TICK_MS` tick, `getMultiplayerSnapshot().world.activity` is `[]`; the seed never enters the published feed); `spec.md:203` (AC-18: every reduction prunes synchronously; the interval is the fallback); `plan.md:215-222` (exact session order, handler publishes see the pruned world, `applyWorldSwap` paths, interval fallback only); `tasks.md:59` (T6 implements/tests the same order and the immediate 5001 assertion); `spec.md:271` (testing strategy adds the immediate 5001 case). The old interval-only behavior would leave `e1` in `WorldState.activity` until the 250 ms tick, so AC-17's "before any tick" assertion fails; the fix is load-bearing and testable. |
| F2 — AC-1/AC-4 timer evidence | **Fixed** | `spec.md:183` (AC-1: `vi.getTimerCount()` 3→2 = A/B heartbeats + the server's coalesced leaderboard timer before; B's heartbeat + the leaderboard timer after; no grace timer for `p1`) and `spec.md:186` (AC-4: 2→0 = A's heartbeat + the leaderboard timer; the last-member removal clears the heartbeat and `leaderboard.dropServer` drops the timer; the activity feed creates no timer; `activity.test.ts` `dropServer`/`clear` pins ring teardown). The accounting matches `hub.ts:1133` (`handleJoin` `leaderboard.markDirty`), `hub.ts:1851` (heartbeat interval), `hub.ts:845-878`/`880-925` (`removeMember`/`handleClose`), `leaderboard.ts:143-153` (`markDirty`/`dropServer`) and the timerless activity feed; `hub.test.ts` uses `vi.useFakeTimers()`. The counts are plausible and not contradictory. |
| F3 — AC-2 counter observation | **Fixed** | `spec.md:184` (AC-2: the rejoin `welcome`'s `leaderboard.entries` entry for A has the same `clicks`/`cubesCompleted`; `totals.facesDestroyed` still includes A's faces, with a zero-counter peer if needed). This matches `LeaderboardEntry` (`playerId`, `name`, `cubesCompleted`, `clicks`) and the aggregate `totals.facesDestroyed` in `protocol.ts:175-199`; no nonexistent per-member field is asserted. |
| F4 — session vs transport `leave` | **Fixed** | `spec.md:323` (§ Assumptions: the **session** sends `leave` through the transport only while `welcomed` and connected; a disconnected page cannot deliver it, grace remains the fallback; the transport has no `welcomed` concept and only writes while its send target is open). This matches `plan.md:165-173` (`session.onPageHide`) and `transport.ts:160-166` (write-only `send`). |

## Residual findings (non-blocking)

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| I1 | INFO | `status.md:38` | The orchestrator-owned status still records `spec_review_round: 2` and the r2 caveat that the renumbered AC references and T8 link check were not re-run. This r2a verification confirms both: the AC-1…AC-23 references are consistent and the executed `node -e` link check exits 0 on the four docs. | The orchestrator can clear the caveat and record the T8 link-check pass when updating the status. No spec/plan/tasks change. | open |
| I2 | INFO | `tasks.md:73` (T8) | The dependency-free link check remains a simple regex; it passes on the current docs and the r2a revision keeps the edited links simple. It would false-fail on a future titled/absolute link target. | Keep the docs links as simple relative targets (already noted in the r3 disposition F7). No current action. | open |

## Drift check

| Area | Result | Notes |
| --- | --- | --- |
| Revisions | ✅ | `spec.md` frontmatter `revision: 3`; `plan.md` frontmatter `revision: 3`; the spec and plan revision histories both label the change **r2a targeted fix**; the tasks remain the same nine-task graph. |
| AC set | ✅ | AC-1…AC-23 remain complete and contiguous; AC-17/AC-18 are the synchronous-prune/fallback pair and AC-19–AC-23 stay accessibility/docs/containers/smoke/gates. Every AC remains mapped to a task (T1/T4 8-11; T2 11-12; T3 1-6, 9, 13-14; T5 5, 15-18; T6 7, 14-19; T7 22; T8 20; T9 1-23). |
| Task graph / `files_owned` | ✅ | Dependency overview unchanged: T1 → (T2 ∥ T4); T2 → T3; T4 → T5; (T3 ∥ T5); T5 → T6; T3 → T7; (T3, T6) → T8; (T7 ∥ T8) → T9. `files_owned` are unchanged and disjoint; T6 still owns only `session.ts`/`session.test.ts`/`browser-env.ts`/`browser-env.test.ts`; no protected file is added. |
| Core design | ✅ | Self-only `leave` on non-bfcache `pagehide`, retained abrupt-close grace/token rejoin, 5000 ms server snapshot filter + receipt-anchored client expiry, no wire-shape/version/dependency/persistence/service change remain intact. No design re-opening. |
| Formatting / consistency | ✅ | The spec/plan/tasks tables and code blocks are intact; no stale interval-only/"transport sends" wording remains; the r2 disposition table (F1–F7) and the new r3 entry are consistent; the T8 greps remain currently absent and the link check passes. |

## Verdict

**approved** — F1–F4 are correctly and completely fixed, the timer counts and counter observations are grounded in the actual implementation, and no new blocking defect or formatting/consistency drift was found. The spec is ready for the user approval checkpoint with **Q-1/Q-2/Q-4**; Q-3 is decided technically in § Protocol and additivity, and Q-11 remains a noted default.
