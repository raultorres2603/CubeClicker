---
feature: live-activity-feed
phase: spec_review
round: 2
iteration: 2
verdict: approved
reviewed: 2026-11-15
blocking: 0
nonblocking: 4
---
# Spec Review — r2

## Summary

✅ approved — 0 BLOCKER, 0 MAJOR, 2 MINOR, 2 INFO. The r1 blockers are resolved: AC-1–AC-7 are gate-qualified candidates with per-type accepted/dropped tests; the move records the completion first and suppresses the move-in `memberJoined` activity, so an accepted completion is the sole new-server event and a dropped completion adds none; the validation matrix, terminal `clear()`, privacy-scan scope, travel-window pending feed, 20-newest-first order, per-server `nextId` and the exact representative frame are all pinned. Two summary-level stale wordings remain (the event catalog's `memberJoined` "or move-in" and the r2 revision-history F6 "except"; the `memberLeft` catalog condition does not split the move-out), plus two INFO clarifications. None changes the normative ACs, plan or task guidance, and none reintroduces the r1 failure modes.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `spec.md:62` (event catalog `memberJoined` "Candidate at: fresh `join` or move-in"), `spec.md:258` (r2 revision history F6: "pins the move-in join's `except`") | The normative body suppresses the move-in join entirely: `spec.md:67` ("suppressed for the move"), AC-7 (`:101`), AC-14 (`:114`), AC-25 (`:134`), Q-9 (`:232`), `plan.md:25` and `tasks.md:31`. The catalog's "Candidate at" still lists move-in, and the r2 revision history says the move-in join's `except` was pinned, which reads as a move-in candidate that is still emitted with an except. A builder following those summaries instead of the ACs/plan could reintroduce the r1 F2 failure: the move-in join consumes the new server's gate and drops the completion. | Change the catalog's "Candidate at" to "fresh `join` (move-in suppressed by completion precedence)" and reword the r2 revision-history F6 clause to "pins the fresh-join `except` and suppresses the move-in join for the move (no record/except)" or similar. The ACs/plan/tasks are already correct; this is a summary correction, not a design change. | open |
| F2 | MINOR | `spec.md:63` (event catalog `memberLeft` row) | The row's "Candidate at" includes "final grace-expiry removal or move-out", but its "Exact condition" only describes the final grace-expiry removal: "only when `registry.removeMember` reports `left: true` and that server still has at least one member". A move-out uses `registry.moveMember`, not `registry.removeMember`, and its old-server `memberLeft` candidate is recorded after the `memberLeft (moved)` broadcast when `serverHasMembers(oldServerId)` (AC-7 `:101`, `plan.md:25`, `tasks.md:31`). The catalog condition is therefore incomplete for one of the two candidate points and can suppress the old-server leave on a move. | Split the condition: final grace-expiry removal → `left: true && !serverDestroyed`; move-out → after the `memberLeft (moved)` broadcast when the old server still has members. Keep AC-7/plan/tasks as the normative rules. | open |
| F3 | INFO | `spec.md:67`, `spec.md:101`, `plan.md:25` | "The new server records the completion **first**" is slightly ambiguous: the plan actually records it after the existing `worldEntered`/`memberLeft`/`memberJoined` protocol broadcasts, and the move-in activity join is suppressed, so there is no other new-server activity candidate. The word "first" could be read as "before the protocol broadcasts". | Optional wording: say "after the existing protocol broadcasts, as the sole new-server activity candidate". No design change. | open |
| F4 | INFO | `spec.md:220` (Q-5..Q-12 builder defaults), `plan.md:227` (Q-7..Q-14 technical defaults), `status.md:36` (Q-5..Q-14 builder defaults), `spec.md:139` (AC-27 `firstId`) | The Q-5..Q-14 classification range is summarized differently across the spec, plan and status (Q-5..Q-12 vs Q-7..Q-14 vs Q-5..Q-14); the plan's split is the accurate one (Q-5/Q-6 are user-visible defaults, Q-7–Q-14 technical defaults). AC-27 uses `firstId` without defining it; `tasks.md:49` defines it as "the `id` from B's snapshot", so the smoke is testable, but the AC could state that definition. | Optional: align the defaults range in the spec/status with the plan's split and define `firstId` in AC-27 as B's `welcome.activity[0].id`. No design change. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Six event types with gate-qualified candidates and thresholds, per-server cadence/ring, protocol/snapshot, reducer/session, non-live feed UI, docs and smoke proof are covered; non-goals are explicit; no scope invented. |
| Testability | ✅ | AC-1–AC-7 are gate-qualified with per-type accepted/dropped tests; the move has accepted (one completion, no join) and dropped (none, no join) cases; AC-11 closed-flag, AC-15 validation matrix, AC-17 pending-feed and AC-24 scan-scope tests are binary; the two MINOR catalog summaries should be corrected but do not alter the normative ACs. |
| Boundaries | ✅ | Always / Ask first / Never are present; Q-1–Q-4 are isolated as the product-visible checkpoint. |
| Dependency graph | ✅ | T1→T2→T3→T4→T5 is acyclic; every AC is mapped; no `[P]`; `files_owned` are disjoint. |
| Parallel safety | ✅ | No parallel tasks; T5 stages, does not edit, the planner/orchestrator/reviewer artifacts; protected container/package/README files are excluded. |
| Security | ✅ | No PII (roster-visible name/id, catalog `partId`, numbers), per-server fan-out with a `serverId` guard, no client event path, privacy scan restricted to `activityEvent` + `activity` arrays with the `welcome` envelope identity fields explicitly exempt, no new dependency/secret/.env. |
| Testing | ✅ | Unit + integration + e2e strategy is comprehensive, commands exist, coverage ≥ 80 per workspace, assertion bar bans wildcard/snapshot-only tests, fake clocks; per-type accepted/dropped cases and the move accepted/dropped cases are in `hub.test.ts`. |
| Consistency | ✅ | The two MINORs are summary-level stale wordings; the normative ACs, plan, tasks and key decisions all implement completion-first/suppressed-move-in and the `removal.left` leave predicate. |
| Risks | ✅ | The r2 risk list explicitly covers the derivation-vs-gate issue, move completion observability, travel-window gap, leave-without-broadcast, privacy-scan false positives, validation drift and smoke timing. |
| Real-time | ✅ | Server authority, connection lifecycle, reconnection/eviction, multi-client fan-out, per-server isolation, completion-first move and pending-feed travel are defined; no unobservable move completion remains. |
| Containers | ✅ | No new service/image/port/env; the feed uses the existing `/ws` on backend 8080; `compose.yaml`, `compose.smoke.yaml` and both Dockerfiles stay unchanged; `podman compose up` remains the single local command. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) — cadence vs exact-one | ✅ fixed | `spec.md:54` defines candidates; AC-1–AC-6 (`:95-100`) are "when the gate accepts/drops"; AC-7 (`:101`) is accepted/dropped; the test strategy (`:203`) and T2 (`tasks.md:31`) require a positive and a dropped case for all six types. |
| F2 (r1) — move completion unobservable | ✅ fixed | `spec.md:67` records the completion first and suppresses the move-in join; AC-7/AC-14/AC-25 (`:101/:114/:134`), `plan.md:25`, `tasks.md:31` agree; accepted = sole new-server event, dropped = none, with no clock advance. |
| F3 (r1) — reconnect vs 20-event ring | ✅ fixed | `spec.md:73` and AC-13 (`:113`) carry the current ring and state the eviction-by-design; the test strategy includes the 20-event boundary. |
| F4 (r1) — decoder parity | ✅ fixed | `spec.md:75-89` validation matrix, AC-12 (`:112`) and AC-15 (`:115`) mirror it; `plan.md:17-18` and T1/T3 notes replay the same fixture table. |
| F5 (r1) — post-close inertness | ✅ fixed | AC-11 (`:108`) and `plan.md:13`/`:31` define the terminal `clear()` closed flag; T1 notes test `record` null, `snapshot` `[]`, `dropServer`/second `clear` no-ops. |
| F6 (r1) — move-in `except` | ✅ fixed in the body | Fresh join uses `except = member.playerId` (`plan.md:26`); the move-in activity is suppressed (`plan.md:25`, AC-14). The r2 revision-history summary still says "pins the move-in join's `except`" — the F1 r2 MINOR. |
| F7 (r1) — leave predicate | ✅ fixed in the body | AC-6 (`:100`), `plan.md:28` and `tasks.md:31` gate on `removal.left && !removal.serverDestroyed`; a no-op removal creates no candidate. The catalog's move-out condition is the F2 r2 MINOR. |
| F8 (r1) — privacy scan scope | ✅ fixed | AC-24 (`:133`) restricts the scan to `activityEvent` frames and `activity` arrays, exempting the `welcome` envelope's `token`/`accountId`; the test strategy (`:203`) matches. |
| F9 (r1) — travel-window gap | ✅ fixed | `spec.md:67`, AC-16/17/18 (`:119-121`) and AC-23 (`:132`) route matching target events into `pendingWorldSwap.activity` and apply them at the swap; `plan.md:35` and the session/reducer tests cover it. |
| F10 (r1) — AC-10 ordering | ✅ fixed | AC-10 (`:107`) pins `[event 25, …, event 6]` newest-first and per-server `nextId` starting at 1; `plan.md:12-13` and T1 notes match. |
| F11 (r1) — Q-5/Q-6 defaults | ✅ fixed | `spec.md:213` requires the approval summary to state Q-5/Q-6 as defaults; the open questions (`:228-229`) label them user-visible defaults. |
| F12 (r1) — per-server id/exact frame | ✅ fixed | `plan.md:12`/`:95` puts `nextId` in per-server state; AC-12 (`:112`) and `plan.md:111-112`/T1 notes pin the exact representative JSON. |

## Approval checkpoint

Q-1–Q-4 are genuine product-visible values and must be confirmed by the user before the build; the blanket "Proceed with all of them, one by one" is not approval of them:

1. **Q-1 — Milestone cadence**: every 5th completed cube (first at Cube 5); alternatives 10th/25th.
2. **Q-2 — Cadence policy**: drop candidates inside the 1 s window (no queue/timer); one accepted event per server per second.
3. **Q-3 — Buffer and display**: 20 stored / 5 visible; alternatives 10/3 or 50/8.
4. **Q-4 — Placement**: top-center ticker below the connection banner, non-interactive, with a mobile offset.

Q-5 (completion precedence: milestone > fastClear > cubeCleared) and Q-6 (`worldEntered` carries the target ring; travel events folded into the pending feed) are user-visible **defaults** and must be stated in the same approval summary. Q-7–Q-14 are technical defaults. The orchestrator must record the confirmed Q-1–Q-4 values in `status.md` and move the feature to `awaiting_approval` before T1.

## Notes / non-blocking observations

- **The r2 design is internally coherent where it matters.** The completion-first/suppressed-move-in rule is repeated in the catalog condition, AC-7/14/25, the plan's derivation/key decisions/risks and T2's notes; the F1 MINOR is a summary-level stale "or move-in"/"except" wording, not a disagreement in the build instructions.
- **The `memberLeft` catalog condition should be split** (F2 MINOR): the final-removal branch is `left: true && !serverDestroyed`; the move-out branch is the `memberLeft (moved)` broadcast followed by a `serverHasMembers(oldServerId)` probe. AC-7 and the plan already encode the second branch.
- **"First" wording (F3 INFO).** The plan's "after the existing broadcasts, record the completion first" is the accurate order; the spec/AC-7 can say "sole new-server activity candidate" to remove any reading that the record precedes `worldEntered`/`memberLeft`/`memberJoined`.
- **Approval-summary drift (F4 INFO).** The status says Q-5…Q-14 are builder defaults, the spec's summary sentence lists Q-5…Q-12 and the plan says Q-7…Q-14 are technical defaults; the plan's split is the accurate one (Q-5/Q-6 user-visible defaults; Q-7–Q-14 technical defaults). Define `firstId` in AC-27 as B's `welcome.activity[0].id` (T4 already does).
- **Smoke proof is testable as written.** The existing A/B/C flow gives A's empty welcome, B's welcome containing A's accepted join, and A's post-grace `memberLeft`; the `event.type === 'memberLeft'` predicate skips any earlier accepted B-join activity frame, and `firstId` comes from B's snapshot.
- **UI/accessibility and containers remain correct.** `ActivityFeed` is a single non-live `<aside aria-live="off">` with no live roles/focusable controls, `key={event.id}` supports the entry animation, the CSS placement/reduced-motion rules are pinned, and no service/port/environment/compose change is added; the backend `/ws` endpoint is unchanged.
- **28 ACs / 5 tasks / coverage / docs checks pass.** The AC→task map covers every AC; T1–T5 are sequential with exclusive file ownership; T4/T5 carry the workspace/root coverage gates (≥ 80 per workspace), build, frontend-prod rebuild and smoke; T5 also verifies the `## Activity feed` and `### activity feed` docs, the untouched `docs/features/README.md`, and the protected compose/Dockerfile/package files.
- **No new BLOCKER/MAJOR remains.** The r1 cadence, move-completion, PII/cross-server, bounded-memory and second-live-region concerns are resolved; the open items are the two summary corrections and two optional clarifications above.
