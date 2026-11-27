---
feature: production-build-selection
phase: spec
round: 2
iteration: 2
verdict: approved
blocking: 0
nonblocking: 1
---
# Spec Review — r2

## Summary

✅ **approved (r4a/r4b re-check)** — The r2a fixes remain correct, and the r4 `build_sha`-only contract change is now fully consistent. F23 is fixed: the resolver uses `.workflow_runs[0] // empty`, tests the parsed `sha` (not the formatted TSV), and reaches the exact `No successful CI push build found on main; refusing to deploy.` message on the real `{"total_count":0,"workflow_runs":[]}` shape; AC-2(b), plan §2, T1 step/anchors and the `resolver-latest-unavailable` harness case match. F24 is fixed with case-insensitive broad negatives (`dropdown|previous-[0-9]|relative label` plus the three old headings) in T2/T4 and AC-10(e). F25 is fixed with `ci_created` captured and `CI run: <id> <createdAt>` pinned in the plan, T1 and `resolver-latest`. F22 is fixed: T3 records the 20 per-case pre-live lines without changing the gate. The 31-case harness (6 resolver + 4 guard + 3 contract + 3 schema + 14 render + 1 CI parse), T3's 20 resolver/render cases, the input contract, the 21-step order, the post-merge base fix and the Q-2/Q-3/Q-4 set are consistent; no `[ -z "$runs" ]`, old jq filter, or positive dropdown/`previous-N` expectation remains outside history/negative text. One INFO residual remains: the orchestrator-owned status note (F21). F27 is fixed in r4b: AC-10(a)/T2 no longer require a “no dropdown/relative labels” sentence, while the broad `dropdown|previous-[0-9]|relative label` and old-heading negatives remain the gate. No new BLOCKER/MAJOR.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F15 | MAJOR | `spec.md` AC-5 (line 237), §4d (line 167); `plan.md` §10 (lines 413-418); `tasks.md:134,176,348,445` | **Originally:** the harness did not execute the Render creation/completion blocks. **Now:** the harness extracts/executes both Render blocks with a stub `curl`; the 14 `render-*` cases are identical in AC-5, plan §10, T1/T4 (31-case lists/counts) and T3 pre-live (20 resolver/render cases); T1/T4 build-log guards record every case. | — | fixed |
| F16 | MINOR | `docs/architecture/containerization.md:37,42`; `tasks.md:282-285,492-493`; `spec.md` AC-10(d) (line 270) | **Originally:** the new sentences omitted/ambiguous the manual-development dispatch SHA. **Now:** both statements use the three-way rule (manual production selected SHA / manual development `github.sha` / automatic `workflow_run.head_sha`) and the T2/T4 greps match. | — | fixed |
| F17 | MINOR | `spec.md:14,58,68,368`; `plan.md:448,454`; `tasks.md:5,24,559`; `status.md:30` | **Originally:** the dependency context was stale (T6 blocked on VERCEL_TOKEN). **Now:** spec/plan/tasks say T6 complete/production live, T7 in progress, T8 pending; the T1 gate remains `state: accepted`. The orchestrator-owned `status.md` is still stale (F21 INFO). | — | fixed |
| F18 | MINOR | `spec.md:167`; `plan.md:418`; `tasks.md:203` | **Originally:** the plan pointed `NODE_PATH` at the repo's `node_modules`, which would load the real `pg` into the schema gate. **Now:** the stub directory is first, repo modules after; both `require.resolve('pg')` and `require('pg')` resolve the stub. | — | fixed |
| F19 | MINOR | `plan.md` §7b (lines 291-333); `spec.md:177`/AC-5(c) (line 234); `tasks.md:116-118,198` | **Originally:** `curl -fsS` aborted on a transient error and the timeout message was hard-coded. **Now:** transient/unreadable GETs retry until the env-driven deadline, only terminal/timeout/current-deploy mismatch fail closed, and the message uses `${timeout_seconds}s`. | — | fixed |
| F20 | INFO | `spec.md:174`; `plan.md:253,450` | **Originally:** the 202 API claim was uncited/ambiguous. **Now:** the Trigger Deploy API `responses` and the deploy-hook 202 explanation are cited; 202 remains fail-closed and a 201 `created`/`queued` deploy is polled. | — | fixed |
| F21 | INFO | `docs/features/production-build-selection/status.md:12,30,34-35` | The orchestrator-owned status is stale: the summary still says “a dropdown of previous builds”, the blockers still list Q-1/Q-5, and the blockers say “T6 is currently owner-blocked on the production Vercel token”; the r4 spec/plan/tasks correctly use `build_sha`-only and T6 complete/production live/T7 in progress/T8 pending. | Update the status summary/blockers at the approval/merge checkpoint; orchestrator-owned. | open |
| F22 | INFO | `tasks.md:348-351,421` | **Originally:** T3 asked for the 20 per-case resolver/render lines but the verify only grepped the single marker. **Now:** T3 records the 20 `Pre-live harness: PASS <case>` lines and the verify executes all 20 cases; the gate is unchanged. | — | fixed |
| F23 | MAJOR | `spec.md` §2 (lines 114-116), AC-2(b) (line 210); `plan.md` §2 (lines 106-123); `tasks.md` T1 step 2 (`tasks.md:195`), anchors (`tasks.md:69,107`), harness (`tasks.md:134,203`) | **Originally:** the empty-`build_sha` “no successful run” check tested the formatted TSV, which is non-empty (`\tnull\t`) on an empty Actions list, so the exact message was not reached. **Now:** `--jq '.workflow_runs[0] // empty | [.head_sha, (.id|tostring), .created_at] | @tsv'` emits nothing for `{"total_count":0,"workflow_runs":[]}`; the resolver tests the parsed `sha`, reaches the exact `No successful CI push build found on main; refusing to deploy.` message, and `resolver-latest-unavailable` returns that real empty JSON shape. | — | fixed |
| F24 | MINOR | `tasks.md` T2 (`tasks.md:297-298`), T4 (`tasks.md:509-510`); `spec.md` AC-10(e) (line 271) | **Originally:** the docs stale scan only checked `previous-1` and one old phrase. **Now:** case-insensitive broad negatives cover `dropdown|previous-[0-9]|relative label` and the old headings `### Production build selection`, `### Build selection (production)` and `### Production deploy with build selection` across README/deployment/vercel; AC-10(e) matches. | — | fixed |
| F25 | MINOR | `spec.md` AC-2(a) (line 209); `plan.md` §2 (lines 115-123); `tasks.md:107,195,203` | **Originally:** the plan did not capture `created_at`. **Now:** `ci_created` is captured (field 3) and the exact `CI run: <ci_run> <ci_created>` line is pinned by the T1 anchor and asserted by `resolver-latest`; AC-2(a) matches. | — | fixed |
| F27 | MINOR | `spec.md` AC-10(a) (line 267), AC-10(e) (line 271); `tasks.md` T2 task (`tasks.md:319`), r4b note (`tasks.md:3`); T2/T4 broad negatives (`tasks.md:297,509`) | **Originally:** the broad docs negative conflicted with the required “no dropdown” wording. **Now (r4b):** AC-10(a) and the T2 README instruction no longer require a “no dropdown/relative labels” sentence; the docs simply must not contain `dropdown|previous-[0-9]|relative label` or the old headings, and the case-insensitive broad negatives remain the gate. | — | fixed |

## F27 disposition (r4b)

| Focus | Result | Evidence |
| --- | --- | --- |
| F27 — docs “no dropdown” requirement vs broad negative | **fixed** | `spec.md` AC-10(a) (line 267) no longer contains the “(no dropdown/relative labels)” requirement; AC-10(e) (line 271) now states the docs must not contain `dropdown`, `previous-[0-9]` or `relative label`, with the case-insensitive broad scan and old-heading negatives; `tasks.md` T2 task (`tasks.md:319`) no longer requires a “no dropdown” sentence. The T2/T4 broad negatives (`tasks.md:297-298,509-510`) remain the gate. |

## R4a re-check (F23–F25, F22)

| Focus | Result | Evidence |
| --- | --- | --- |
| F23 — empty-`build_sha`/no-success resolver | **fixed** | `spec.md:115` `// empty`; `spec.md:116` tests the parsed SHA and captures fields 1–3; AC-2(b) (`spec.md:210`) uses the real `{"total_count":0,"workflow_runs":[]}` shape; `plan.md:112` and `plan.md:114` (`if [ -z "$sha" ]`); T1 anchors `tasks.md:69` (`// empty`) and the exact message; harness `resolver-latest-unavailable` (`tasks.md:134,203`) returns the real empty shape. |
| F24 — broad docs stale scan | **fixed** | T2 `tasks.md:297-298`, T4 `tasks.md:509-510` use case-insensitive `dropdown\|previous-[0-9]\|relative label` and the three old headings; AC-10(e) `spec.md:271` matches. The residual over-broad concern was fixed in r4b (F27). |
| F25 — `CI run: <id> <createdAt>` | **fixed** | `plan.md:119` captures `ci_created` (`cut -f3`); `plan.md:123` prints the exact line; T1 `tasks.md:107` anchors `CI run: $ci_run $ci_created`; `tasks.md:203` has `resolver-latest` assert it; AC-2(a) matches. |
| F22 — T3 per-case pre-live lines | **fixed** | T3 task `tasks.md:421` records the 20 `Pre-live harness: PASS <case>` lines; T3 verify `tasks.md:348-351` still executes the 20 resolver/render cases and the single marker; the gate is unchanged. |
| Residual scan | ✅ | No `[ -z "$runs" ]`, no old `.workflow_runs[0] \| [...]` filter; 31 cases in T1/T4 (`-ge 31`), 20 in T3; input keys exactly `build_sha,environment`; no positive dropdown/`previous-N` expectation outside history/negative text. |

## R2a re-check (F15–F20)

| Focus | Result | Evidence |
| --- | --- | --- |
| F15 | **fixed** | AC-5 evidence lists the 14 cases; plan §10 names the creation/completion matrix; T1/T4 use 31 cases (6 resolver + 4 guard + 3 contract + 3 schema + 14 render + 1 CI) and `-ge 31`; T1 build-log guards require every case; T3 pre-live runs the 20 resolver/render cases; the harness extracts the actual Render blocks with a stub `curl`. |
| F16 | **fixed** | T2/T4 three-way greps (`tasks.md:282-285,492-493`); AC-10(d) and plan §11 match; old phrases negated. |
| F17 | **fixed** | `spec.md:14,58,68,368`, `plan.md:448,454`, `tasks.md:5,24,559` say T6 complete/production live, T7 in progress, T8 pending; the T1 gate is `state: accepted`. |
| F18 | **fixed** | `spec.md:167`, `plan.md:418`, `tasks.md:203`: stub `pg` first on `NODE_PATH`, repo modules after. |
| F19 | **fixed** | Plan §7b env-driven timeout/poll; transient retries; `${timeout_seconds}s`; AC-5(c)/T1 match. |
| F20 | **fixed** | `spec.md:174`, `plan.md:253,450`: 201/202 cited; 202 fail-closed; 201 `created`/`queued` polled. |

## R1 disposition

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (BLOCKER) — live Render revision unproven | **fixed** | Completion poll/current-deploy proof; 21 steps; automatic branch head start; harness coverage added. |
| F2 (MAJOR) — fixtures reimplemented gates | **fixed** | Harness executes resolver/guard/contract/schema/Render/CI-parse blocks; missing-table and exact messages; Render blocks added. |
| F3 (MAJOR) — T3 Vercel commit vs projection limitation | **fixed** | Conditional Vercel commit or `Vercel metadata projection: unavailable`. |
| F4 (MAJOR) — stale release-identity line | **fixed** | Both containerization statements three-way; positive/negative greps. |
| F5 (MAJOR) — Render 202 assumption | **fixed** | 201/202 cited; 202 fail-closed; 201 polled. |
| F6 (MINOR) — relative dropdown UX | **fixed** | Removed by the owner contract change; `build_sha`-only. |
| F7 (MINOR) — T3 exact lines vs long-hex | **fixed** | Shortened 7–12 character SHAs and the `Shortened evidence` label. |
| F8 (MINOR) — stale dependency context | **fixed** | T6 complete/production live; T7 in progress; T8 pending. |
| F9 (MINOR) — “Development unchanged” overstated | **fixed** | Automatic unchanged; manual defaults preserved with the Render API mechanism aligned. |
| F10 (MINOR) — CI parse position/content | **fixed** | 11-step list and executed parse in T1/T4. |
| F11–F14 (INFO) | **fixed** | Immutable-migration policy, `dep-` prefix, lowercase `build_sha`, 45 s comment. |

## Coverage of the review scope

| Brief item | Result | Evidence / notes |
| --- | --- | --- |
| 1. Request fidelity and UX | ✅ | Optional `build_sha` text field (empty=latest, set=exact); no dropdown; owner contract change applied. |
| 2. Build identity and same-revision guarantee | ✅ | Build = successful `CI` push on `main`; resolved-SHA guard/compare; same-SHA Render API + completion/current-deploy + Vercel. |
| 3. Safety gates | ✅ | Contract/schema gates fail closed; harness executes them; immutable policy documented. |
| 4. Current-feature dependency | ✅ | T6 complete/production live; T7/T8 pending; T6a/one `gh run list` preserved; `state: accepted` gate. |
| 5. Testability | ✅ | 31-case harness; T3 20; `// empty`/parsed-SHA and `CI run` line verified; F27 fixed in r4b. |
| 6. Task graph and ownership | ✅ | T1 → T2 ∥ T3 → T4; T1 owns workflows/harness; T2/T3 disjoint; T3 owner merge; T4 integrates. |
| 7. Docs, security, real-time, containers | ✅ | Docs/README positives; broad `dropdown|previous-[0-9]|relative label` negatives; no secret exposure; real-time/container impacts correct. |
| 8. Owner decisions | ⚠️ | Q-2/Q-3/Q-4 in spec/plan; Q-1/Q-5 dropped there but F21 status note; no silent topology change. |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Owner `build_sha`-only contract covered; no dropdown/relative labels. |
| Testability | ✅ | F23/F24/F25/F22/F27 fixed. |
| Boundaries | ✅ | Three tiers; non-goals explicit; harness-only test addition. |
| Dependency graph | ✅ | T1 → T2 ∥ T3 → T4; no cycle; all ACs mapped. |
| Parallel safety | ✅ | T1 owns workflows/harness; T2/T3/T4 logs disjoint. |
| Security | ✅ | No new secret; `build_sha` validated; Render body not printed; catalog/protection preserved. |
| Testing | ✅ | 31 cases consistent; T3 20; exact messages; no reimplemented gates. |
| Consistency | ✅ | F27 fixed in r4b; F21 status note only. |
| Real-time | ✅ | Restart/WS close/reconnect/room reset and completion proof addressed. |
| Containers | ✅ | No new image/service/port; provider-neutral; `/healthz`/`/ws` on 8080. |
| Documentation | ✅ | Positives complete; broad negatives retain the gate; F21 status note only. |
| Owner decisions | ⚠️ | Q-2/Q-3/Q-4; Q-1/Q-5 historical only; F21 status. |

## Notes / backlog (non-blocking)

- **F21 (INFO)** — The orchestrator-owned status still says “dropdown”/Q-1/Q-5 and the stale T6/Vercel-token note; update at the approval/merge checkpoint.
- **F27 (MINOR, fixed in r4b)** — AC-10(a)/T2 no longer require a “no dropdown” sentence; the broad `dropdown|previous-[0-9]|relative label` and old-heading negatives remain the gate.
- **Review method** — Static review only; no provider call, workflow dispatch, GitHub write, deploy or live operation was performed.
