---
feature: realtime-broadcast-batching
phase: spec_review
round: 3
iteration: 3
verdict: changes_requested
reviewed: 2026-11-13
blocking: 1
nonblocking: 2
---
# Spec Review — r3

## Summary

❌ changes requested — 1 MAJOR, 2 MINOR, 3 INFO. The r3 spec and plan correctly add the separate purchase/upgrade guard (`findUpgradesSnapshot`, `applyUpgradeSnapshot`, `lastAppliedUpgradeRevision`), the two-purchase/out-of-order/under-credit proof, the explicit `handleJoin` shutdown checks/deferred-join test, the concrete real-transport/real-`WorldView` integration wiring, and they fix the r2 smoke ids, benchmark import path/counter, and status line. The 30 ACs, AC-29/AC-30 task map, additive migration, one-write DB timing, five-item approval checkpoint and five-task sequential graph are intact.

One MAJOR remains: the long **T3 Notes** line still contains an old unguarded purchase sentence. The early T3 paragraph correctly says upgrades go through `applyUpgradeSnapshot`, but the later summary says “`handlePurchaseUpgrade` applies/broadcasts `upgrades` immediately, queues+flushes economy only when its revision is newer”. A builder following that later sentence would skip the new upgrade guard and reintroduce the exact r2 purchase regression (older purchase overwrites newer `member.upgrades`/emits an older `upgradesUpdate`). This is a one-sentence task fix; the spec/plan are already correct.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `tasks.md:43` (T3 Notes, later `handlePurchaseUpgrade` summary) vs `spec.md:70` (AC-21), `spec.md:84` (AC-29), `plan.md:269` (guarded upgrades) | The early T3 paragraph and the spec/plan require purchase upgrades to go through `applyUpgradeSnapshot` and broadcast only when the purchase revision is newer. The later T3 summary still says “`handlePurchaseUpgrade` applies/broadcasts `upgrades` immediately, queues+flushes economy only when its revision is newer”; the “immediately” applies to upgrades and contradicts the guard. A builder following that sentence would implement the old behavior; the two-purchase test would fail, and the server `member.upgrades` (which feeds `miniCubeMultiplier`/`cubeMultiplier` for later credits) could regress. | Replace the later sentence with the guarded behavior: apply/broadcast `upgrades` only when `applyUpgradeSnapshot` accepts a newer purchase revision; queue/flush economy only when `applyEconomySnapshot` accepts; keep one `purchaseUpgrade` write and the two-purchase test. This is build-blocking if the stale sentence remains. | open |
| F2 | MINOR | `tasks.md:43` (T3 Notes, `close()` list) vs `plan.md:280` | The T3 `close()` list clears `members`, `tokens`, `openingMembers`, `economyRevisions`, timers and connections but omits the new `upgradeRevisions` map. The plan and AC-30 state the new guard map must be cleaned up; the in-memory map would otherwise survive shutdown. | Add `upgradeRevisions` to the T3 `close()` cleanup list (the plan already includes it) and assert the map is cleared in the shutdown test. | open |
| F3 | MINOR | `tasks.md:34` (T2 Notes, later benchmark summary) vs the same line’s first sentence / `plan.md:294` | The first T2 sentence correctly says the benchmark counts economy writes via `creditWithRevision` when present (fallback `credit`), but the later summary still says “count `JSON.stringify` server-message calls, removal/economy frames, `credit` calls”. Counting only `credit` after the feature would report zero DB credits because the hub now calls `creditWithRevision`. | Change the later summary to “economy writes (`creditWithRevision` when present, fallback `credit`)” so the T2 notes have one counter definition. | open |
| F4 | INFO | `spec.md:216` (r3 revision history), `plan.md:422` | The r3 revision histories list F1/F2/F5 but not the F3/F4 task fixes (smoke ids, benchmark path/counter); the status line 30 says F3–F5. This is documentation of the revision, not behavior. | Optionally add F3/F4 to the r3 revision histories for bookkeeping. No gate impact. | open |
| F5 | INFO | `tasks.md:62` (T5 proposed row) | The proposed feature-index row says `planning`; at acceptance the orchestrator should use `accepted` with the acceptance date. | Use `accepted` for the index row when the orchestrator applies it. | open |
| F6 | INFO | `spec.md:77` (AC-25), `plan.md:302` | The `registrySnapshotsPerBroadcast` baseline is static (the `HubDeps.registry` seam does not exist at the baseline; the script reports `null`); the spec labels it static. The additive `economy_revision` and `creditWithRevision` keep one DB write per click/completion/purchase; no write-behind is introduced. | Keep the static baseline label in the T2/T3/T5 logs and keep the one-write revision design. No change required. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ❌ | The spec/plan cover the purchase guard, join shutdown, AC-29/AC-30, migration and integration; the later T3 task sentence still contradicts the guard (F1), and the T3 close list omits `upgradeRevisions` (F2). |
| Testability | ❌ | The two-purchase/under-credit test, deferred-join test and concrete integration test are present and concrete. The T3 task contradiction (F1) can cause the test to be implemented against the wrong behavior; the T2 counter shorthand (F3) is minor. |
| Boundaries | ✅ | Non-goals still exclude DB write-behind, slow-client policy, join-query optimization, services/queues, version bumps, visual redesign, dependencies and container changes. |
| Dependency graph | ✅ | T1 → T3 → T5, T2 → T3, T1 → T4 → T5 is acyclic; all tasks `[seq]`; AC-29/AC-30 are mapped to T2/T3 and all 30 ACs have tasks. |
| Parallel safety | ✅ | No `[P]`; T1 protocol, T2 registry/schedulers/benchmark, T3 hub/repository/migration/smoke, T4 frontend, T5 docs have disjoint `files_owned`; T1/T2 are serialized for the shared workspace. |
| Security | ✅ | The new frame is server-to-client and validated/copied; the revision is internal; no secrets/PII/dependency/service; DB writes remain one per accepted click/completion/purchase. |
| Testing | ❌ | The test plan is strong, but F1’s contradictory task instruction can defeat the purchase guard test; F2/F3 are concrete minor gaps. |
| Consistency | ❌ | The T3 later purchase sentence (F1), the T3 close list (F2), and the T2 later counter sentence (F3) contradict the corrected spec/plan; F4/F5 are bookkeeping. |
| Real-time | ❌ | The spec/plan ordering, flush boundaries, reconnect authority, economy guards and shutdown checks are coherent; the T3 task sentence can reintroduce the purchase/upgrade regression (F1) if followed. |
| Containers | ✅ | No service, image, port, environment variable or deployable change; compose/Dockerfiles and the local run path stay untouched; the wire benchmark uses the existing published port. |
| Documentation | ✅ | The planned `realtime.md` sections and README benchmark subsection are appropriate; the status line is corrected; F4/F5 are optional/acceptance. |
| Performance | ✅ | The encode-once, registry index/visitor, 40 ms batch and 4 Hz coalescing targets are meaningful; the T2 counter phrasing is F3, not a design failure. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| r2 F1 — purchase/upgrade ordering | ✅ spec/plan fixed; ⚠️ T3 leftover | `spec.md:70`/`:84`, `plan.md:230`/`:241`/`:269`, `findUpgradesSnapshot`, `applyUpgradeSnapshot`, `lastAppliedUpgradeRevision`, the two-purchase/under-credit test are present. The later T3 sentence still describes the unguarded old behavior (F1). |
| r2 F2 — in-flight `handleJoin` shutdown | ✅ fixed | `spec.md:85` AC-30, `plan.md:283`/`:286`, T3 notes and the deferred-join test now cover every `handleJoin` await; F2 only adds `upgradeRevisions` cleanup. |
| r2 F3 — stale smoke ids | ✅ fixed | The T3 notes and spec AC-26 now use `front:0:1` then `front:0:2` after the existing `front:0:0` single-click check; the duplicate `front:1:0` is gone. |
| r2 F4 — benchmark import path/counter | ✅ path fixed; ⚠️ counter shorthand | The T2 notes now use `../../src/backend/...` and the first sentence says `creditWithRevision` (fallback `credit`); the later `credit` calls summary is F3. |
| r2 F5 — T4 integration wiring | ✅ fixed | `spec.md:64`/`:146` and `tasks.md:52` now specify a real `createTransport` with a fake WebSocket, the real decoder, and a fake scene delegating to a real `createWorldView(...).applyMessage`; no pre-decoded fake wire. |
| r2 F6 — stale status line | ✅ fixed | `status.md:42` now says spec r3/plan r3/tasks and spec review round 3 pending. |
| r1 F1–F4 | ✅ fixed/closed | The approval checkpoint, economy revision, shutdown guard and integration proof are present; no r1 regression found. |
| r1 F5–F11 | ✅ closed | The roster citation, full builder validation, encode-free no-recipient flush, `--json`/counter reset and smoke ids are in the plan/tasks; F7/F8 remain documented observations. |

## Minimum blocking revisions

1. **F1 only.** Correct the later T3 `handlePurchaseUpgrade` sentence to the guarded behavior: upgrades only via `applyUpgradeSnapshot` (newer purchase revision), economy only via `applyEconomySnapshot`, no unguarded broadcast. Keep the two-purchase test and one DB write. This is build-blocking if the stale sentence remains because a builder following it would reintroduce the r2 purchase/upgrade regression.

Non-blocking corrections:
- **F2:** add `upgradeRevisions` to the T3 `close()` cleanup and shutdown assertion.
- **F3:** change the later T2 counter sentence to `creditWithRevision`/economy writes.
- **F4/F5:** optionally record the r3 F3/F4 fixes in the revision history and use `accepted` for the feature-index row.
- **F6:** keep the static registry baseline label and the one-write revision design.

## Notes / backlog (non-blocking)

- **The five-item approval checkpoint is intact.** `spec.md:178-188` and `plan.md:402-412` present Q-1 40 ms, Q-2 250 ms, Q-3 slow clients out of scope, Q-4 evidence-only and Q-5 legacy single-id; Q-6/Q-7/Q-8 remain builder defaults. The orchestrator must record the user’s confirmation in `status.md` before T1.
- **The purchase/upgrade guard is correct in the spec and plan.** `findUpgradesSnapshot` reads the upgrades and revision atomically; `applyUpgradeSnapshot` uses a separate `upgradeRevisions` guard; the two-purchase test resolves the older purchase last and checks the final `member.upgrades`, the only `upgradesUpdate`, and a later explode’s credit delta. The only gap is the stale T3 summary sentence (F1).
- **The shutdown and join guards are coherent.** `handleJoin` checks the closed flag after every repository await; the deferred-join test is specified; `close()` clears members/tokens/economy revisions/timers/connections; F2 adds the new upgrade map to that cleanup list.
- **The migration is additive and one-write.** `economy_revision BIGINT NOT NULL DEFAULT 0`, `creditWithRevision` and `purchaseUpgrade` bump it in the same write, `credit`/`findUpgradesByUserId` remain wrappers. No DB write-behind, identity change, service or dependency is introduced; the separate `economy-write-behind` feature stays out of scope.
- **The five-task graph is executable.** T1/T2 are logically independent but serialized; T3 depends on both and owns the hub/repository/migration/smoke; T4 depends on T1; T5 depends on T3/T4; `files_owned` remain disjoint and the AC map covers AC-1…AC-30.
- No spec, plan, tasks, status, source, protocol, test, config or git state was edited by this review; only this review artifact was written.
