---
feature: server-live-leaderboard
phase: spec_review
round: 1
iteration: 1
verdict: changes_requested
reviewed: 2026-11-16
blocking: 1
nonblocking: 5
---
# Spec Review — r1

## Summary

❌ changes requested — 1 MAJOR, 2 MINOR, 3 INFO. The 26 ACs are complete and binary-testable: the three session counters, the accepted-only increment points, the guest/account parity and coin exclusion, the cubes → clicks → slot-order ranking, the top-five/all-member totals, the 1 s per-server coalescing, the `welcome`/`worldEntered` snapshot and travel-window replacement, the additive `leaderboardUpdate`/validation matrix, the `WorldState.leaderboard` reducer/session chain, the non-live top-five panel with reduced motion, the metrics allow-list and the A/B smoke proof are all specified, and the source audit confirms the hub's `handleExplode`/`handleCompletion`/`handleJoin`/`removeMember`/`handleClose` and `registry.forEachMember` support the plan. The blocking issue is the **status/approval checkpoint**: `status.md` says coins are shown as a server total and lists cadence/display as product checkpoints, directly contradicting the spec's Q-2 (coins excluded from ranking, wire and totals) and omitting the move/grace checkpoint. The spec/plan/status Q-3/Q-4/Q-8 numbering is also ambiguous, and AC-23's "no conflict" is not true for the upgrades panel on short mobile viewports (the spec itself acknowledges the clipping). No PII, cross-server/global state, per-click frame, guest/account divergence in the spec, or second live region was found; the status's coin-total sentence is the one fairness/privacy contradiction and must be removed before approval.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `status.md:30-34`; `spec.md:245,254` (Q-2), `:127` (AC-3), `:166` (AC-24), `:174` (non-goal), `:244-249` (approval checkpoint) | The status's approval list does not match the spec and contains a coin-total contradiction: Q-1 says "coins shown only as a server total, not a rank metric", while the spec excludes coins from the ranking, the wire **and the totals** (Q-2/§ Metric definitions/AC-3/AC-24/non-goals). The status's Q-2 is the cadence (a spec Q-6 default) and its Q-3 is display/top-five (a spec Q-5 default); the spec's product checkpoints Q-2 (coins excluded) and Q-3 (move/grace) are missing. The status's Q-5…Q-13 also omits the spec's Q-14/Q-15 and its Q-3 says "20 max members", which is a capacity, not the spec's all-current-member totals scope. A builder or orchestrator following the status could add an account-only/guest-local coin total and present the wrong four values for approval. | Align `status.md` Q-1–Q-4 with the spec's approval checkpoint: Q-1 ranking (cubes → clicks → slot order); Q-2 coins excluded from ranking, wire and totals; Q-3 counters follow a mover and grace members stay ranked; Q-4 placement. Remove the "coins shown as a server total" sentence, move cadence/display to the defaults list, and list Q-5…Q-13 (plus Q-14/Q-15) as the proposed defaults. The orchestrator must record the confirmed values before T1. No source change. | open |
| F2 | MINOR | `spec.md:242,249,255-260,266-267`; `plan.md:239,255-260` | The Q-numbering is not consistent across the approval checkpoint and the open questions. The approval checkpoints use Q-3 = move+grace and Q-4 = placement; the open questions use Q-3 = move, Q-4 = grace, and Q-8 = "Move and grace retention … Same decisions as Q-3/Q-4", so Q-4 means placement in one list and grace in the other and Q-8 duplicates Q-3/Q-4. The spec's defaults sentence lists Q-5…Q-13 but the open questions continue with Q-14 (timestamp) and Q-15 (solo/empty panel), which the status and plan do not list. | Unify the numbering across spec/plan/status. Either keep the approval checkpoint at Q-3 = move+grace and Q-4 = placement, remove the redundant Q-8, and add Q-14/Q-15 to the defaults; or split move/grace into Q-3/Q-4, move placement to Q-5 and renumber the remaining defaults. Correct the "Same decisions as Q-3/Q-4" reference so it never points at placement. | open |
| F3 | MINOR | `spec.md:162` (AC-23 "Placement and no conflict"), `spec.md:223` (short-mobile clipping), `plan.md:219`; `status.md:32-33` | AC-23 is titled "Placement and no conflict", but the spec's own assumptions and the plan's risk state that on very short mobile viewports the `max-height: 18vh` panel can visually meet the upgrades panel and the lower rows are clipped. The mobile `top: 17rem` is safely below the activity feed (10rem + 6rem) and the HUD, but "no conflict" overstates the upgrades-panel relationship and the user's placement check includes short viewports. | Clarify AC-23 to say "no overlap with the HUD, connection banner, activity feed or user panel; on very short mobile viewports the lower rows may be visually clipped by the upgrades panel, which paints above; all content remains in the DOM/accessibility tree", or adjust the mobile `top`/`max-height` to guarantee a gap. Add a CSS/short-viewport test that pins the intended relationship; keep the existing panels' placements unchanged. | open |
| F4 | INFO | `status.md:32-34`; `spec.md:249`; `plan.md:265` | The status's Q-3 "20 max members" and Q-5…Q-13 list are stale relative to the spec's top-five/all-current-member totals and Q-14/Q-15 defaults. The 20 is a server capacity, not a leaderboard product value; the spec's totals are over all current members, not a 20-member display cap. | Fold this into the F1/F2 status/default-list alignment; no source change. | open |
| F5 | INFO | `spec.md:260`; `plan.md:260` | Q-8 "Move and grace retention. Same decisions as Q-3/Q-4" duplicates Q-3/Q-4 and references Q-4, which is placement in the approval checkpoint and grace in the open questions. The duplicate adds no decision and makes the checkpoint ambiguous. | Remove Q-8 or renumber it as the detailed rationale of the single move/grace decision; fix the cross-reference. Covered by F2. | open |
| F6 | INFO | `status.md:30-35` | The status's Q-1…Q-4 (rank metric/coins, cadence, display, placement) appear to be an earlier design summary; the spec/plan's approval checkpoint and the status's own "Spec review pending" line are the current state. The status is orchestrator-owned and the review cannot edit it. | Update the status at the approval checkpoint after F1/F2; record the four spec values and the defaults. No source change. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The 26 ACs cover the counters and accepted-only increment rules, guest/account parity, coin exclusion, ranking/tie-breaks, top-five/all-member totals, the 1 s coalescing, snapshots and travel, protocol/validation, reducer/session, UI/accessibility, privacy, smoke and docs; the non-goals and three boundary tiers are present. |
| Testability | ✅ | Each AC is binary and has a unit/integration/e2e proof path: `leaderboard.test.ts` (ranking/coalescer), `protocol.test.ts`, `metrics.test.ts`, `hub.test.ts`, frontend protocol/server-state/session/Leaderboard/App/CSS tests, and the A/B smoke. F1/F2 are approval/consistency, not AC testability. |
| Boundaries | ✅ | Always / Ask first / Never are present, including the coin/persistence/encode-once/second-live-region prohibitions. |
| Dependency graph | ✅ | T1→T2→T3→T4→T5 is acyclic; every AC is mapped; no `[P]`; `files_owned` are disjoint and the protected files and orchestrator-owned README are excluded. |
| Parallel safety | ✅ | No parallel tasks; exclusive files; T5 stages the planner/orchestrator/reviewer artifacts without editing them. |
| Security | ✅ | The spec carries only server-issued ids/names and integer counters, never accountId/token/email/coins/upgrades/free text; per-server snapshots and the reducer guard prevent cross-server leaks; the client catalog has no leaderboard message. The status's coin-total sentence (F1) is the one fairness/privacy contradiction and is not part of the spec/plan implementation. |
| Testing | ✅ | Unit + integration + e2e strategy, coverage ≥ 80 per workspace, assertion bar, fake timers/manual clock, coalescer 999/1000 ms, per-server isolation, move/grace, encode-once, privacy scan, timer-count shutdown. |
| Consistency | ❌ | F1 (status coin total/Q-list), F2 (Q-numbering/Q-8/Q-14-15) and F3 (AC-23 "no conflict" vs the short-mobile upgrades clipping) are inconsistent across the artifacts. |
| Risks | ✅ | The plan enumerates the timer leak, stale ranking, move double/under-count, guest/account divergence, coin/privacy leak, cross-server leak, second live region, CSS conflict, short-mobile clipping, protocol drift, smoke timing, payload growth, fixture churn and rollback; the remaining AC-23 wording is F3. |
| Real-time | ✅ | Server authority, accepted-only increments, grace retention, move-follow, rejoin/welcome, per-server coalescing, encode-once fan-out, travel-window pending snapshot and per-server isolation are defined and tested. |
| Containers | ✅ | No new service/image/port/environment variable; the feed uses the existing `/ws` on backend 8080; compose/Dockerfiles/package files stay unchanged; `podman compose up` remains the single local command. |
| Approval checkpoint | ❌ | The spec's Q-1–Q-4 (ranking, coins excluded, move/grace, placement) are product-visible and genuine, but the status's Q-1–Q-4 do not match and the Q-3/Q-4/Q-8 numbering is ambiguous; the orchestrator cannot present a single unambiguous four-item list until F1/F2 are fixed. |

## Approval checkpoint

The spec's four genuine product-visible values are:

1. **Q-1 — Ranking order**: cubes completed descending, then clicks descending, then ascending slot order. Alternative: clicks first.
2. **Q-2 — Coins**: excluded from the ranking, wire and totals. No account-only coin column; the guest/account fairness and privacy rationale is in § Metric definitions.
3. **Q-3 — Move and grace semantics**: counters follow the member across a cross-server move; a member in reconnect grace stays ranked. Alternative: reset on a move or drop on socket close.
4. **Q-4 — Placement**: non-interactive left rail below the HUD on desktop, below the activity feed on mobile.

Q-5 (top five + all-current-member totals), Q-6 (1 s per-server coalescing), Q-7 (`worldEntered` snapshot/travel replacement), Q-8 (the detailed move/grace retention — same decision as Q-3), Q-9 (separate multi-tab rows), Q-10 (faces in totals only), Q-11 (metrics allow-list), Q-12 (docs home), Q-13 (smoke proof), Q-14 (no timestamp display) and Q-15 (solo/empty panel) are proposed defaults. The orchestrator must present Q-1–Q-4 and record the confirmed values in `status.md` before T1; the status's current Q-1–Q-4 and the "coins shown as a server total" sentence must be corrected first.

## Notes / backlog

- **Source audit confirms the plan's derivation points.** `handleExplode` has the admitted/valid gate and the existing `faceCleared` predicate; `handleCompletion` has `isComplete`, `completedLevel` and the move branch; `handleJoin`/`handleRejoin`/`removeMember`/`handleClose` give the member/grace/removal lifecycle; `registry.forEachMember` gives the slot order and all-member totals; `broadcast` is the encode-once path; the metrics allow-lists are the only catalog change. The `Member`-owned counters are the right owner for grace/move.
- **Timer vs cadence.** The plan's one-timer-per-dirty-server coalescer is the correct alternative to the activity feed's drop-not-queue gate (the final state must publish); it must be discarded on server destroy and `hub.close()`, and the existing 40 ms/250 ms timers remain independent.
- **Mover/grace race.** The completion increments before the `worldEntered` snapshot, the target snapshot includes the mover, and the old totals exclude them; the old server's timer is dropped when the move destroys it. The spec's AC-2/AC-8 and the plan's move branch cover this.
- **Guest/account parity.** Both are `Member` records with the same `sessionStats`; the snapshot never reads `accountId` or economy. The status's coin-total sentence (F1) is the only contradiction to this.
- **UI occlusion.** AC-23's HUD/activity-feed placement is safe; the short-mobile upgrades-panel clipping is acknowledged in the spec/plan (F3) and should be made explicit/tested rather than left under a "no conflict" title.
- **Smoke.** The existing A/B/C flow gives A's one-entry welcome, B's A+B welcome and A's coalesced `clicks >= 3` frame within the existing timeouts; the check should scan history/await without a new fixed wait. No new service, port, environment variable, dependency or persistence is added.
- No source, tests, spec, plan, tasks, status or git state was edited; only this review artifact was written.

## Minimum revisions (blocking F1 only; F2/F3 are required to make the approval list unambiguous)

1. **F1** — Correct `status.md` Q-1–Q-4 to the spec's approval checkpoint (ranking, coins excluded, move/grace, placement); remove the "coins shown as a server total" sentence; move cadence/display to the defaults list; include Q-5…Q-13 and Q-14/Q-15. No source change.
2. **F2** — Unify the Q-3/Q-4/Q-8 numbering across spec/plan/status; remove or renumber the Q-8 duplicate; include Q-14/Q-15 or remove them from the open questions. No source change.
3. **F3** — Clarify AC-23's short-mobile upgrades-panel behavior (or adjust the mobile `top`/`max-height` to guarantee a gap) and add the short-viewport CSS test. No behavior change beyond the documented clipping/clarification.
