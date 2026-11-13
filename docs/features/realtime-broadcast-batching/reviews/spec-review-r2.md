---
feature: realtime-broadcast-batching
phase: spec_review
round: 2
iteration: 2
verdict: changes_requested
reviewed: 2026-11-13
blocking: 1
nonblocking: 5
---
# Spec Review — r2

## Summary

❌ changes requested — 1 MAJOR, 5 MINOR, 3 INFO. The r2 revision closes most of the r1 gaps: the approval checkpoint is now present in the spec and plan (Q-1…Q-5), the economy path has a per-account `economy_revision` and a highest-revision guard, the shutdown guard and AC-30 are specified, the AC-18 integration test is in T4, and F5–F9 are largely fixed. The core design remains coherent: encode-once fan-out, the registry index/visitor with the defensive snapshot, 40 ms removal batches with boundary flushes, absolute economy frames, one-write-per-click DB behavior, and the five-task sequential graph.

One MAJOR remains: the **purchase upgrade path is not ordered**. AC-21/AC-29 say a purchase’s `upgrades` “always apply” and only its economy is revision-guarded; a planned test races a purchase against a **credit**, not against another purchase. Two purchase results resolving out of order can let the older absolute `upgrades` overwrite the newer `member.upgrades` and `upgradesUpdate`; because `member.upgrades` feeds `miniCubeMultiplier`/`cubeMultiplier`, later credit deltas and the server-authoritative economy can be wrong until the next purchase/reload. The shutdown guard also does not cover an in-flight `handleJoin` continuation, and the long T3 Notes line still contains a stale second smoke-id pair.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `spec.md:70` (AC-21), `spec.md:84` (AC-29), `plan.md:236` (`applyEconomySnapshot`), `plan.md:263` (upgrades always adopted), `tasks.md:43` (T3 “always adopt/broadcast upgrades”), `src/backend/src/game/hub.ts:770-771`/`:868` (upgrades feed multipliers) | The purchase revision guards only the economy. A purchase result’s `upgrades` are always adopted/broadcast; two purchases resolving out of order let the older purchase’s absolute `upgrades` overwrite the newer `member.upgrades` and send an older `upgradesUpdate`. The older multiplier then feeds `miniCubeMultiplier`/`cubeMultiplier` in later `handleExplode`/completion credits, so the server-authoritative economy can under-credit until the next purchase/join reload. The planned race test is purchase vs **credit**, which cannot expose this because a credit does not change upgrades. | Add a purchase/upgrade revision guard separate from the economy revision (e.g. `lastAppliedUpgradeRevision`): apply and broadcast `upgrades` only when the purchase revision is newer than the last applied **purchase**; an older purchase still does not regress economy, and a later credit does not suppress a newest purchase. Add a two-purchase out-of-order test asserting the final `member.upgrades`/`upgradesUpdate` is the newer purchase and the older upgrades never overwrite it. Update AC-21/AC-29 and `plan.md:236`/`:263`/the T3 notes; keep one DB `purchaseUpgrade` write. | open |
| F2 | MINOR | `spec.md:85` (AC-30), `spec.md:122` (Shutdown), `plan.md:275`, `tasks.md:43` (async continuation list), `src/backend/src/game/hub.ts:590-676` | The shutdown list covers late credit/purchase/customization continuations but omits `handleJoin`. A join frame received before `hub.close()` but awaiting the five DB queries can resume after close and call `registry.assign`, `members.set`, `tokens.set`, `connection.playerId` and `recomputePlan` (sends are suppressed by the closed guard, but membership/token state is recreated). The planned late-join test only sends a join **after** close, which `handleMessage` drops. | Check the closed flag after each `await` in `handleJoin` (including the idle-credit path) and add a test with a deferred repository resolving after close; assert no member/token/connection/timer/send. Include `handleJoin` in the shutdown continuation list and T3 tests/plan. | open |
| F3 | MINOR | `spec.md:78` (AC-26), `tasks.md:43` (long T3 Notes, final `tests/e2e/smoke.mjs` paragraph) | The spec and the earlier T3 “Smoke” sentence use `front:0:1` then `front:0:2`, but the later T3 paragraph still says `front:0:1`, `front:1:0` — a leftover from the r1 wording. A builder following that paragraph would not implement AC-26’s exact ids/order. | Fix the later T3 paragraph to the spec’s `front:0:1`/`front:0:2` pair (after the existing `front:0:0` single-click check), keep the negative assertion, and remove the duplicate stale id pair. | open |
| F4 | MINOR | `tasks.md:34` (T2 notes) vs `plan.md:285`/`:291` | T2 says the in-process benchmark “dynamically imports `../src/backend/src/game/hub.ts` …”; from `tests/bench/realtime-broadcast.mjs` that resolves `tests/src`, not the repository `src`; the correct relative path is `../../src/backend/...`. T2 also says to count `credit` calls, but the after path uses `creditWithRevision`, so counting only `credit` can report zero; the plan correctly says count economy writes (`creditWithRevision` when present, `credit` fallback). | Correct the T2 import path and counter definition to match the plan; ensure the baseline `credit` and after `creditWithRevision` are normalized to one write per click. | open |
| F5 | MINOR | `tasks.md:52` (T4 integration note) vs `spec.md:64` (AC-18), `spec.md:146` | The integration test is present, but the note says “a real `WorldView` whose `applyMessage` is the fake scene’s `applyWorldMessage` sink” and also “real transport decode” while reusing the existing `session.test` fake env/wire. That is ambiguous: the fake scene must delegate its `applyWorldMessage` to the real `WorldView.applyMessage`, and the raw frame must go through the real transport/decoder rather than a pre-decoded fake wire. | State the concrete wiring: construct a real `createTransport` with a fake socket (or the real `parseServerMessage`) and have the fake scene’s `applyWorldMessage` delegate to a real `createWorldView(...).applyMessage`; keep the exact frame and malformed/duplicate/self/remote/unknown cases. | open |
| F6 | MINOR | `status.md:40` | The status still says “Draft artifacts written (spec r1, plan r1, tasks); spec review pending”, although the frontmatter is round 2 and the loop log records r2. | Update the status line to the r2 artifacts/review round (or remove the stale bullet) in the same status edit. | open |
| F7 | INFO | `spec.md:77` (AC-25), `plan.md:293` | The `registrySnapshotsPerBroadcast` baseline is static (the `HubDeps.registry` seam does not exist at the baseline; the script reports `null`). The spec labels it static, so this is not an AC failure, but it is weaker evidence than the measured counters. | Keep the static label in the T2/T3/T5 logs; do not present it as a measured benchmark counter. | open |
| F8 | INFO | `spec.md:72` (AC-23), `spec.md:89`, `plan.md:361` | The `economy_revision` migration and `creditWithRevision` are one-write additions; there is no write-behind, batched credit or deferred persistence, and the separate `economy-write-behind` feature is not in the tree. The revision is a write-order stamp, not a second write. | No change required; keep the DB writes at one per accepted click/completion/purchase and keep the revision additive. | open |
| F9 | INFO | `tasks.md:62` (T5 proposed row) | The proposed feature-index row says `planning`; at acceptance the orchestrator should apply `accepted` with the acceptance date. | Use `accepted` for the index row when the orchestrator applies it. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ❌ | The r1 approval checkpoint, economy revision, shutdown guard and integration test are present, but the purchase upgrade path (F1), the in-flight `handleJoin` continuation (F2), and the stale T3 smoke ids (F3) remain. |
| Testability | ❌ | The 30 ACs are mostly concrete; F1 needs a two-purchase test, F2 an in-flight join test, F3 an exact id fix, F4 the benchmark path/counter, and F5 the integration wiring. |
| Boundaries | ✅ | Non-goals still exclude DB write-behind, slow-client policy, join-query optimization, services/queues, version bumps, visual redesign, dependency and container changes. |
| Dependency graph | ✅ | T1 → T3 → T5, T2 → T3, T1 → T4 → T5 is acyclic; all tasks `[seq]`; AC-29/AC-30 are mapped to T2/T3 and the AC map covers all 30. |
| Parallel safety | ✅ | No `[P]`; T1 protocol, T2 registry/schedulers/benchmark, T3 hub/repository/migration/smoke, T4 frontend, T5 docs have disjoint `files_owned`; T1/T2 are serialized for the shared workspace. |
| Security | ✅ | The new frame is server-to-client, the decoder validates/copies, the revision is internal, no secrets/PII/dependency/service is added, and DB write count/timing is unchanged; F1/F2 are correctness, not a new security surface. |
| Testing | ❌ | The backend/frontend unit/integration/smoke/benchmark tiers and coverage gate are present, but F1/F2/F4/F5 leave core paths under-specified; the planned purchase-race test does not exercise two purchases. |
| Consistency | ❌ | AC-21/AC-29 say purchase upgrades always apply while the design needs purchase ordering (F1); the T3 line has two smoke-id pairs (F3); the T2 path/counter (F4), T4 wiring (F5), and status line (F6) are stale. |
| Real-time | ❌ | Encode-once fan-out, per-server call order, boundary flushes, cross-server isolation and the economy revision guard are coherent, but an older purchase can regress server `member.upgrades` and future economy multipliers (F1), and a pre-close `handleJoin` can mutate membership after close (F2). |
| Containers | ✅ | No service, image, port, environment variable or deployable changes; `compose.yaml`, `compose.smoke.yaml`, Dockerfiles and the local run path stay untouched; the wire benchmark uses the existing port. |
| Documentation | ✅ | The planned `realtime.md` sections and README benchmark subsection are appropriate; the status stale line is F6 and the feature-index row is F9/acceptance. |
| Performance | ✅ | The encode-once, registry index/visitor, 40 ms batch and 4 Hz coalescing targets are meaningful; the benchmark counter/path issues are F4/F7, not a design failure. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| r1 F1 — approval checkpoint | ✅ fixed | `spec.md:178-188` now presents Q-1 40 ms, Q-2 250 ms, Q-3 slow clients out, Q-4 evidence-only and Q-5 legacy single-id; `plan.md:392-402` mirrors it; Q-6/Q-7/Q-8 remain builder defaults. The user must still confirm these before T1; the status correctly stays `spec_review` until then. |
| r1 F2 — out-of-order economy | ⚠️ partially fixed | The `economy_revision` migration, `creditWithRevision`/`purchaseUpgrade` revisions, `applyEconomySnapshot` guard and highest-revision coalescer address credit/economy ordering. The purchase **upgrades** path is still unconditional (F1); the purchase race test is against a credit, not another purchase. |
| r1 F3 — shutdown guard | ⚠️ partially fixed | AC-30, the closed flag, late-frame/attach/deliver/broadcast guards, scheduler `discard` and the shutdown tests are specified. The in-flight `handleJoin` continuation is missing from the list/tests (F2). |
| r1 F4 — AC-18 integration proof | ✅ fixed in plan / ⚠️ wording | T4 adds one chain test in `session.test.ts` with the exact frame and the required cases; the real-transport/real-`WorldView` wiring wording needs F5. |
| r1 F5 — roster citation | ✅ fixed | `spec.md:19` now cites `hub.ts:412-413` for `rosterFor`; the audit evidence matches the source. |
| r1 F6 — backend builder validation | ✅ fixed | `spec.md:62` and `tasks.md:25` require full `playerId`/`ids` runtime validation and both-suite invalid tests. |
| r1 F7 — AC-22 no-recipient no-op | ✅ fixed | `spec.md:71` and `plan.md:224`/`:234` return before encoding when no joined account connection matches. |
| r1 F8 — benchmark commands/counters | ✅ fixed | AC-24/plan/T2/T3/T5 now use `--json` and reset counters after setup; the remaining T2 path/counter detail is F4. |
| r1 F9 — smoke ids/order | ⚠️ partially fixed | The spec and the earlier T3 “Smoke” sentence use `front:0:1`/`front:0:2`; the later T3 paragraph still has `front:1:0` (F3). |
| r1 F10/F11 — static baseline / write-behind | ✅ closed | F7/F8 remain documented observations; no scope creep. |

## Minimum blocking revisions

1. **F1 only.** Add purchase-upgrade ordering (a separate purchase/upgrade revision guard or equivalent) so an older purchase result cannot overwrite `member.upgrades` or send an older `upgradesUpdate`; add a two-purchase out-of-order test and update AC-21/AC-29, `plan.md:236`/`:263`, and the T3 notes. Keep one `purchaseUpgrade` write and preserve the economy revision guard.

Non-blocking corrections (fix or explicitly rebut in the same revision):
- **F2:** add the closed check after each `handleJoin` await and a deferred-join shutdown test.
- **F3:** replace the later T3 `front:1:0` pair with `front:0:1`/`front:0:2`; remove the stale duplicate.
- **F4:** correct the T2 benchmark import path to `../../src/backend/...` and count `creditWithRevision` in the after run.
- **F5:** make the T4 integration wiring concrete (real transport/decoder and a fake scene delegating to a real `WorldView.applyMessage`).
- **F6:** update the stale status line.
- **F7/F8/F9:** keep the static baseline label, the one-write revision design, and use `accepted` for the feature-index row.

## Notes / backlog (non-blocking)

- **The approval checkpoint is present and remains the next user gate.** The five items are Q-1 40 ms, Q-2 250 ms, Q-3 slow clients out of scope, Q-4 evidence-only, and Q-5 legacy single-id; Q-6/Q-7/Q-8 are builder defaults. The r2 review should not be treated as user confirmation; the orchestrator must present the five items and record the confirmation in `status.md` before T1.
- **The economy revision migration is additive and one-write.** `economy_revision BIGINT NOT NULL DEFAULT 0`, `creditWithRevision` increments in the same `UPDATE`/`INSERT`, `purchaseUpgrade` increments in its existing write, and `credit` remains a wrapper. The separate `economy-write-behind` feature is not present; no DB write-behind or batched persistence is introduced.
- **The purchase upgrade gap is the one substantive remaining design issue.** A credit does not change upgrades, so the existing purchase-vs-credit test is insufficient; a purchase-vs-purchase test is required because `member.upgrades` affects later credit multipliers and is server-authoritative. The required action is a separate upgrade revision (or equivalent) without a second DB write.
- **The five-task graph is executable.** T1/T2 are logically independent but serialized; T3 depends on both and owns the hub/repository/migration/smoke; T4 depends on T1; T5 depends on T3/T4. The `files_owned` sets remain disjoint, and AC-29/AC-30 are mapped.
- No spec, plan, tasks, status, source, protocol, test, config or git state was edited by this review; only this review artifact was written.
