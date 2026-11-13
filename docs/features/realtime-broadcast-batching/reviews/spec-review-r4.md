---
feature: realtime-broadcast-batching
phase: spec_review
round: 4
iteration: 4
verdict: approved
reviewed: 2026-11-13
blocking: 0
nonblocking: 0
---
# Spec Review — r4

## Summary

✅ approved — 0 blocking (0 BLOCKER, 0 MAJOR/MINOR), 4 INFO. The targeted r3 fixes are complete. The long T3 Notes line now describes the purchase path correctly: upgrades apply and broadcast **only** when `applyUpgradeSnapshot` accepts a newer purchase revision, economy is guarded independently by `applyEconomySnapshot`, and one `purchaseUpgrade` DB write remains. The two-purchase out-of-order/under-credit test is explicit and distinct from purchase-vs-credit. `upgradeRevisions` is in the `close()` cleanup and the shutdown test via the test-only `revisionStateForTesting()` accessor. The T2 benchmark summary now counts economy writes (`creditWithRevision` when present, fallback `credit`). No unguarded upgrade sentence or stale smoke id remains.

The spec/plan/status are unchanged from r3 and remain coherent: the five-item approval checkpoint Q-1…Q-5, AC-29/AC-30, the additive `economy_revision` migration, one-write DB timing, no DB write-behind/identity/service/dependency changes, and the five-task sequential graph are intact. The remaining observations are bookkeeping only.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | INFO | `status.md:3-5`, `status.md:42` | The status frontmatter still says `spec_review_round: 3` and the final bullet says “spec review round 3 pending”; after this r4 approval the next state is the user approval checkpoint / round 4 completion. The user said the status is unchanged for this targeted review. | When the orchestrator applies the approval checkpoint, update the status round and the final line to reflect the r4 approval and `awaiting_approval` state. No gate impact. | open |
| F2 | INFO | `spec.md:216`, `plan.md:422` | The r3 revision histories list F1/F2/F5 but not the r3 task-level F3/F4 fixes (smoke ids, benchmark path/counter); the status line 30 says F3–F5. | Optionally add F3/F4 to the r3 revision histories for bookkeeping. No behavior or gate impact. | open |
| F3 | INFO | `tasks.md:62` (T5 proposed row) | The proposed feature-index row says `planning`; at acceptance the orchestrator should apply `accepted` with the acceptance date. | Use `accepted` for the index row when the orchestrator applies it. | open |
| F4 | INFO | `spec.md:77` (AC-25), `plan.md:302` | The `registrySnapshotsPerBroadcast` baseline is static (the `HubDeps.registry` seam does not exist at the baseline; the script reports `null`); the spec labels it static. The additive `economy_revision` and `creditWithRevision` keep one DB write per click/completion/purchase; no write-behind is introduced. | Keep the static baseline label and the one-write revision design. No change required. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The approval checkpoint, purchase/economy guards, shutdown/join guard, migration, frontend integration, benchmark and docs are all present; the r3 F1/F2/F3 fixes are in the task text. |
| Testability | ✅ | The two-purchase/under-credit test, deferred-join test, real-transport/real-`WorldView` integration test, registry 200-op test, batch/boundary tests and smoke burst are concrete; the T2 counter and T3 cleanup now match. |
| Boundaries | ✅ | Non-goals still exclude DB write-behind, slow-client policy, join-query optimization, services/queues, version bumps, visual redesign, dependencies and container changes. |
| Dependency graph | ✅ | T1 → T3 → T5, T2 → T3, T1 → T4 → T5 is acyclic; all tasks `[seq]`; AC-29/AC-30 are mapped to T2/T3 and all 30 ACs have tasks. |
| Parallel safety | ✅ | No `[P]`; T1 protocol, T2 registry/schedulers/benchmark, T3 hub/repository/migration/smoke, T4 frontend, T5 docs have disjoint `files_owned`; T1/T2 are serialized for the shared workspace. |
| Security | ✅ | The new frame is server-to-client and validated/copied; the revision is internal; no secrets/PII/dependency/service; DB writes remain one per accepted click/completion/purchase. |
| Testing | ✅ | The test plan covers every AC and the two-purchase/join/close edge cases; no test is weakened; coverage ≥ 80% per workspace is required; the benchmark is evidence-only. |
| Consistency | ✅ | The T3 purchase sentence now matches AC-21/AC-29 and the plan; the T3 `close()` list includes `upgradeRevisions`; the T2 economy-write counter matches the plan; the smoke ids match AC-26. Only F1/F2 bookkeeping remains. |
| Real-time | ✅ | Encode-once fan-out, per-server call order, boundary flushes, cross-server isolation, reconnect authority, economy/upgrade revision guards and shutdown guards are coherent; no unguarded upgrade path remains. |
| Containers | ✅ | No service, image, port, environment variable or deployable change; compose/Dockerfiles and the local run path stay untouched; the wire benchmark uses the existing published port. |
| Documentation | ✅ | The planned `realtime.md` sections and README benchmark subsection are appropriate; F1–F3 are acceptance/bookkeeping items. |
| Performance | ✅ | The encode-once, registry index/visitor, 40 ms batch and 4 Hz coalescing targets are meaningful; F4 is the static-baseline observation. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| r3 F1 — stale T3 unguarded purchase sentence | ✅ fixed | `tasks.md:43` now says `handlePurchaseUpgrade` applies/broadcasts `upgrades` only when `applyUpgradeSnapshot` accepts a newer purchase revision (never unguarded), queues/flushes economy only when `applyEconomySnapshot` accepts, and keeps one `purchaseUpgrade` write; the two-purchase/under-credit test is retained. |
| r3 F2 — `upgradeRevisions` close cleanup/test | ✅ fixed | The T3 task adds `revisionStateForTesting()` for both revision map sizes and asserts both are 0 after `close()`; the `close()` list now includes `upgradeRevisions`. |
| r3 F3 — T2 benchmark counter summary | ✅ fixed | The T2 benchmark summary now counts economy writes via `creditWithRevision` when present, falling back to `credit`; the import paths remain `../../src/backend/...`. |
| r3 F4 — revision history/feature row | ✅ closed/INFO | F2/F3 remain optional bookkeeping; no behavior or gate impact. |
| r3 F5 — feature-index row | ✅ acceptance | F3 (r4) repeats the `accepted`-row reminder; orchestrator-owned. |
| r3 F6 — static baseline / write-behind | ✅ closed/INFO | F4 (r4) keeps the static label and one-write revision design. |
| r2/r1 findings | ✅ fixed/closed | The checkpoint, economy/upgrade guards, join shutdown, integration wiring, smoke ids, benchmark path/counter and status line from the earlier rounds remain in place. |

## Minimum remaining revisions

None. The r3 blocking issues are fixed; no unguarded upgrade path or stale smoke id remains. The remaining F1–F4 are INFO/bookkeeping only.

## Checkpoint items for the `awaiting_approval` summary

1. **Q-1 — 40 ms removal batch window.** Remote cube removals can arrive up to 40 ms late; a click burst collapses into one frame. (Alternative: 30 ms lower latency, 50 ms more coalescing.)
2. **Q-2 — 250 ms (4 Hz) economy/HUD coalescing.** Coin/click/destruction totals update at most four times per second with absolute values; purchases and join-time idle credit stay immediate.
3. **Q-3 — Slow-client policy out of scope.** No per-client queue, drop/replace policy or `bufferedAmount` close threshold; only a synchronous send error closes that one peer.
4. **Q-4 — Benchmark evidence-only.** The before/after benchmark is recorded in build logs; no CI performance gate is added.
5. **Q-5 — Legacy single-id compatibility shape.** A one-id flush keeps `miniCubeRemoved`; multi-id bursts use `miniCubesRemoved`.

Q-6 (no completion fusion), Q-7 (`HubDeps.registry` test seam) and Q-8 (new `docs/architecture/realtime.md` plus README benchmark subsection) remain builder defaults.

## Notes / backlog (non-blocking)

- **The targeted fixes are complete.** The T3 line has one consistent purchase description, the `upgradeRevisions` map is cleaned and asserted, the T2 counter definition matches the implementation path, and the AC-18 integration test is concrete (real transport socket, real decoder, real `WorldView.applyMessage` through a fake scene delegate). The smoke burst uses `front:0:1`/`front:0:2` after the existing `front:0:0` single-click check; no `front:1:0` remains.
- **The approval checkpoint is intact.** The orchestrator must still present Q-1…Q-5 and record the user’s confirmation in `status.md` before T1; this review is a spec gate, not the user’s confirmation.
- **The database change is additive and one-write.** `economy_revision BIGINT NOT NULL DEFAULT 0`, `creditWithRevision` and `purchaseUpgrade` bump it in the existing write, and `credit`/`findUpgradesByUserId` remain wrappers. No DB write-behind, identity change, new service or dependency is introduced; the separate `economy-write-behind` feature stays out of scope.
- **The five-task graph is executable.** T1/T2 are logically independent but serialized; T3 depends on both and owns the hub/repository/migration/smoke; T4 depends on T1; T5 depends on T3/T4; the `files_owned` sets remain disjoint and the AC map covers AC-1…AC-30.
- No spec, plan, tasks, status, source, protocol, test, config or git state was edited by this review; only this review artifact was written.
