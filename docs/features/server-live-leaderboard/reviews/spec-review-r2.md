---
feature: server-live-leaderboard
phase: spec_review
round: 2
iteration: 2
verdict: approved
reviewed: 2026-11-16
blocking: 0
nonblocking: 2
---
# Spec Review — r2

## Summary

✅ approved — 0 blocker, 0 major, 1 minor, 1 info. The r1 status/checkpoint MAJOR and the Q-numbering/AC-23 MINORs are fixed: the spec, plan and status now use Q-1 ranking (cubes → clicks → slot order), Q-2 coins excluded from ranking/wire/totals, Q-3 move+grace (counters follow the member; grace members stay ranked), Q-4 left-rail placement, and Q-5…Q-14 defaults with no duplicate Q-8/Q-15. AC-23 now pins the short-viewport behavior explicitly: the `@media (max-width: 720px) and (max-height: 600px)` `max-height: 12vh` rule, no overlap with the HUD, connection banner, activity feed or user panel at any width, the very-short-viewport lower rows possibly clipped behind the upgrades panel (which paints above), and all five rows/totals retained in the DOM/accessibility tree; the testing strategy, plan, T4 notes and CSS test all include the rule. The 26 ACs remain binary-testable and complete, the source audit confirms the hub/registry/broadcast/metrics/frontend carrier points, and T1–T5, coverage, the A/B smoke and the docs checks are in place. The two non-blocking items are status bookkeeping: the stale "revision r2 pending" note and the status Q-4 "no overlap" summary not mentioning the accepted short-viewport upgrades clipping (the spec's AC-23 is the detailed source and its "final position in spec" pointer is correct).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `status.md:37` | The status's last bullet still says "Spec review r1 changes requested; revision r2 pending", while the same status's loop log says "planner revision r2 applied" (`status.md:28`), `spec_review_round` is 2 (`status.md:4`), and the spec is r2. The Q-1…Q-14 list below it is corrected; only this phase note is stale. | Update the bullet to "Spec review r2 pending" (or "r1 changes addressed; r2 pending review") when the status is next touched. No source or spec change. | open |
| F2 | INFO | `status.md:35`; `spec.md:162` (AC-23), `:224` (responsive) | The status Q-4 says "placement: left rail below the HUD and activity feed, no overlap", which is broader than AC-23: the AC guarantees no overlap with the HUD, connection banner, activity feed and user panel, but explicitly allows the very-short-viewport lower rows to be visually clipped behind the upgrades panel (which paints above), with the DOM/accessibility content retained. The status's "final position in spec" pointer already resolves the detail; the summary is only imprecise. | Optionally qualify the status Q-4 with "no overlap with HUD/banner/feed/user; lower rows may be clipped behind the upgrades panel on very short viewports". The spec/AC-23 is correct; no source change. | open |

## Acceptance verification

The 26 ACs are unchanged from r1 except AC-23's clarified short-viewport wording; the r1 verification stands and was re-checked against the r2 artifacts:

| Area | ACs | Result | Evidence |
| --- | --- | --- | --- |
| Counters and authority | AC-1–AC-4 | ✅ | Accepted-only click/face/completion counters (§ Metric definitions), guest/account parity and the no-account-total rule (AC-3), and the client catalog with no counter message (AC-4); hub increment points confirmed in `handleExplode`/`handleCompletion`/`handleJoin`. |
| Snapshot and ranking | AC-5–AC-8 | ✅ | Top-five/all-current-member totals, cubes → clicks → slot-order tie-break, welcome/rejoin deep-copy snapshot, `worldEntered` target snapshot and travel-window replacement; the builder/coalescer and reducer tests are specified. |
| Cadence and delivery | AC-9–AC-13 | ✅ | 999/1000 ms coalescer boundary, ten changes → one frame, quiet/non-counter no-frame rules, encode-once fan-out, per-server isolation, drop-on-destroy and `hub.close()`/`vi.getTimerCount()===0` cleanup. |
| Protocol | AC-14–AC-16 | ✅ | The validation matrix, exact representative frame, backend/frontend parity and the exactly-two `leaderboardUpdate` metrics allow-list values; no new metric. |
| Frontend state | AC-17–AC-19 | ✅ | `WorldState.leaderboard` null seed, welcome/replace, pending-swap replacement, current/pending routing, identical-snapshot reference, session chain and no engine/scene action. |
| UI and accessibility | AC-20–AC-23 | ✅ | Exact panel markup/text/plurals, top-five cap, null/empty → null, no live region/focusable control, reduced motion, left-rail placement and the new short-viewport `(max-width: 720px) and (max-height: 600px)`/`12vh` rule with the upgrades-panel clipping documented and tested. |
| Privacy, proof and gates | AC-24–AC-26 | ✅ | Server-issued ids/names/integer counters only, no coins/accountId/token/email/free text or cross-server state; the A/B smoke welcome snapshots and coalesced `clicks >= 3` update; docs/glossary/README ownership/protected files and the full gate. |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The 26 ACs cover the counters, parity, coin exclusion, ranking/tie-breaks, top-five/all-member totals, coalescing, snapshots/travel, protocol, reducer/session, UI/accessibility, privacy, smoke and docs; the non-goals and three boundary tiers are present. |
| Testability | ✅ | Every AC has a unit/integration/e2e proof path: `leaderboard.test.ts`, `protocol.test.ts`, `metrics.test.ts`, `hub.test.ts`, frontend protocol/server-state/session/Leaderboard/App/CSS tests and the A/B smoke; the short-viewport CSS test is now explicit. |
| Boundaries | ✅ | Always / Ask first / Never are present, including the coin/persistence/encode-once/second-live-region prohibitions; the short-viewport clipping is an explicit accepted limitation with the content retained. |
| Dependency graph | ✅ | T1→T2→T3→T4→T5 is acyclic; every AC is mapped; no `[P]`; `files_owned` are disjoint and the protected files and orchestrator-owned README are excluded. |
| Parallel safety | ✅ | No parallel tasks; exclusive files; T5 stages the planner/orchestrator/reviewer artifacts without editing them. |
| Security | ✅ | The snapshot carries only server-issued ids/names and integer counters, never accountId/token/email/coins/upgrades/free text; per-server snapshots and the reducer guard prevent cross-server leaks; the client catalog has no leaderboard message; no new dependency/secret. |
| Testing | ✅ | Unit + integration + e2e strategy, coverage ≥ 80 per workspace, assertion bar, fake timers/manual clock, coalescer 999/1000 ms, per-server isolation, move/grace, encode-once, privacy scan, timer-count shutdown and the short-viewport CSS rule. |
| Consistency | ✅ | Q-1…Q-14 are now consistent across spec, plan and status; AC-23 and the status Q-4 pointer agree on the left rail; the only residual is the status's stale r1/r2 phase note (F1) and its broad "no overlap" summary (F2, pointer already correct). |
| Risks | ✅ | The plan enumerates the timer leak, stale ranking, move double/under-count, guest/account divergence, coin/privacy leak, cross-server leak, second live region, CSS conflict, short-mobile clipping, protocol drift, smoke timing, payload growth, fixture churn and rollback; the short-mobile clipping is now explicit in AC-23 and the CSS test. |
| Real-time | ✅ | Server authority, accepted-only increments, grace retention, move-follow, rejoin/welcome, per-server coalescing, encode-once fan-out, travel-window pending snapshot and per-server isolation are defined and tested. |
| Containers | ✅ | No new service/image/port/environment variable; the leaderboard uses the existing `/ws` on backend 8080; compose/Dockerfiles/package files stay unchanged; `podman compose up` remains the single local command. |
| Approval checkpoint | ✅ | Q-1–Q-4 are the product-visible values and the status now matches; Q-5…Q-14 are the defaults. The orchestrator must present the four and record them in `status.md` before T1. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) — status/checkpoint/coins | ✅ fixed | `status.md:32-36` now lists Q-1 ranking, Q-2 coins excluded, Q-3 move/grace and Q-4 placement, with Q-5…Q-14 defaults; the "coins shown as a server total" sentence is gone. |
| F2 (r1) — Q numbering/Q-8/Q-14/Q-15 | ✅ fixed | The spec/plan use the same Q-1…Q-14 sequence; Q-8 is multi-tab, Q-9 faces, Q-10 metrics, Q-11 docs, Q-12 containerized proof, Q-13 timestamp and Q-14 solo; no duplicate Q-8/Q-15. |
| F3 (r1) — AC-23 short-mobile | ✅ fixed | `spec.md:162`/`:224` now explicitly pin the `(max-width: 720px) and (max-height: 600px)`/`12vh` rule, the HUD/banner/feed/user no-overlap, the upgrades-panel clipping on very short viewports and the retained DOM/accessibility content; `plan.md:44,219`, `tasks.md:49` and the CSS test include it. |
| F4 (r1) — status 20 max/Q-5…Q-13 | ✅ fixed | `status.md:36` lists Q-5…Q-14; the stale "20 max members" is gone; the spec's totals are over all current members. |
| F5 (r1) — Q-8 duplicate | ✅ fixed | Q-8 is now multi-tab; the duplicate "Move and grace retention" entry is removed. |
| F6 (r1) — status stale note | ⚠️ partially fixed | The Q-list is corrected, but `status.md:37` still says "Spec review r1 changes requested; revision r2 pending" — F1 r2. |

## Approval checkpoint

The four product-visible values are now consistent across `spec.md:245-248`, `plan.md:239` and `status.md:32-35`:

1. **Q-1 — Ranking order**: cubes completed descending, then clicks descending, then ascending slot order. Alternative: clicks first.
2. **Q-2 — Coins**: excluded from the ranking, the wire and the totals; no account-only coin column. Alternative rejected on guest/account fairness and privacy.
3. **Q-3 — Move and grace**: counters follow the member across a cross-server move; a member in reconnect grace stays ranked until final removal.
4. **Q-4 — Placement**: non-interactive left rail below the HUD on desktop and below the activity feed on mobile, with the short-viewport cap.

Q-5 (top five entries + all-current-member totals), Q-6 (1 s per-server coalescing), Q-7 (`worldEntered` snapshot/travel replacement), Q-8 (separate multi-tab rows), Q-9 (faces in totals only), Q-10 (metrics allow-list), Q-11 (docs home), Q-12 (containerized proof), Q-13 (no timestamp display) and Q-14 (solo/empty panel) are the proposed defaults. The orchestrator must present Q-1–Q-4 and record the confirmed values in `status.md` before T1; the blanket "Proceed with server-live-leaderboard" is not approval of these four.

## Notes / non-blocking observations

- **The r2 fixes are confined to the approval/Q numbering and AC-23**, exactly the r1 findings; no counter, ranking, coin, cadence, totals, isolation, protocol or UI markup changed. The 26 ACs remain the same testable set, and the source audit confirms the hub's `handleExplode`/`handleCompletion`/`handleJoin`/`removeMember`/`handleClose` and `registry.forEachMember` provide the increment/membership points, with `broadcast` for encode-once delivery and the two metrics allow-lists as the only catalog change.
- **Short-viewport behavior is now explicit, not claimed away.** The panel does not overlap the HUD/banner/feed/user; on `max-width: 720px and max-height: 600px` it is capped at `12vh` and the lower rows may sit behind the upgrades panel, which paints above; all five rows and totals remain in the DOM/accessibility tree, and the existing panels keep their placements. The CSS test and the T4 notes pin the rule; a collapsible mobile variant remains a possible follow-up, not part of this feature.
- **Guest/account parity and privacy hold.** Both are `Member` records with the same `sessionStats`; the snapshot never reads `accountId`/economy/coins/upgrades/customization; no PII or cross-server/global state is introduced; the client catalog has no leaderboard message; the panel is `aria-live="off"` with no focusable controls, so `.phase-announcement` remains the only live region.
- **Cadence and cleanup hold.** One timer per dirty server at 1000 ms, no per-click frame, no quiet-server frame, encode-once fan-out, `dropServer` on destroy and terminal `discard()` on `hub.close()`; the existing 40 ms/250 ms paths are untouched; the A/B smoke's welcome snapshots and coalesced `clicks >= 3` frame fit the existing 1 s window/timeouts.
- **F1/F2 are status-only.** The 26 ACs, the implementation plan, the task board and the docs are consistent; the orchestrator can correct the stale phase bullet and optionally qualify the status Q-4 summary while recording the approval, with no builder or spec change required.
- No source, tests, spec, plan, tasks or status were edited; only this review artifact was written.
