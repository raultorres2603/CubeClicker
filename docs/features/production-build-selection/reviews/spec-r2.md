---
feature: production-build-selection
phase: spec
round: 2
iteration: 2
verdict: approved
blocking: 0
nonblocking: 2
---
# Spec Review — r2

## Summary

✅ **approved (r2a re-check)** — The r2a fixes close the remaining r2 MAJOR and all r2 MINOR/INFO items. The gate harness now extracts and executes the actual `Deploy Render backend` and `Wait for Render deploy to complete` run blocks with a stub `curl`; the 14 `render-creation-*`/`render-completion-*` cases are identical in AC-5, plan §10, T1/T4 (34-case lists/counts) and T3 pre-live. Both containerization statements use the three-way rule (manual production selected SHA / manual development `github.sha` / automatic `workflow_run.head_sha`) with matching T2/T4 greps. The dependency context in spec/plan/tasks is T6 complete/production live, T7 in progress, T8 pending, with the `state: accepted` gate preserved. The stub `pg` is first on `NODE_PATH`; the completion GET retries transient errors until an env-driven deadline with no hard-coded 900 s message; and the 202 statement cites the Trigger Deploy API responses plus the deploy-hook docs while retaining fail-closed. Two INFO residuals remain: the orchestrator-owned `status.md` line 30 still carries the stale “T6 blocked on Vercel token” note, and the T3 build log may record the single `Pre-live harness: render-* PASS` marker rather than the 14 per-case lines the task wording asks for (the T3 verify executes and checks all 14 cases). No new BLOCKER or MAJOR.

## R2a re-check (F15–F20)

| Focus | Result | Evidence |
| --- | --- | --- |
| F15 (MAJOR) — Render creation/completion in the harness | **fixed** | `spec.md` AC-5 evidence (line 241) lists the 14 cases; `plan.md` §10 (line 408) names the same creation/completion matrix; T1 (`tasks.md:126`) and T4 (`tasks.md:419`) use the full 34-case list and `-ge 34` counts; T1 build-log guards require every case (`tasks.md:162-163`); T3 pre-live runs the 14 render cases and records `Pre-live harness: render-* PASS` (`tasks.md:323-325`, `tasks.md:395`); the harness extracts the actual Render blocks with a stub `curl` (`spec.md:171`, `plan.md:403`, `tasks.md:189`). |
| F16 (MINOR) — containerization three-way wording | **fixed** | T2 (`tasks.md:265-266`) and T4 (`tasks.md:468-469`) use the three-way sentences: selected build SHA for manual production, `github.sha` for manual development, `workflow_run.head_sha` for automatic; old phrases are negated (`tasks.md:267-268`, `tasks.md:470-471`); AC-10(d) and plan §11 match. |
| F17 (MINOR) — dependency context | **fixed in spec/plan/tasks** | `spec.md:14,55,65,368-369`, `plan.md:448,454`, `tasks.md:5,20,321,395` say T6 complete/production live, T7 in progress, T8 pending; no `T6 blocked on VERCEL_TOKEN` text remains in those artifacts. The orchestrator-owned `status.md:30` still has the stale note (F21 INFO). |
| F18 (MINOR) — stub `pg` ordering | **fixed** | `spec.md:171`, `plan.md:404`, `tasks.md:189` put the temp stub `pg` directory first on `NODE_PATH`, repo modules after, so both `require.resolve('pg')` (contract) and `require('pg')` (schema) resolve the stub. |
| F19 (MINOR) — transient completion GET failures | **fixed** | `plan.md` §7b (lines 291-333) uses `RENDER_DEPLOY_TIMEOUT_SECONDS`/`RENDER_DEPLOY_POLL_INTERVAL_SECONDS`, retries failed/unreadable GETs until the deadline, fails only on terminal status/timeout/current-deploy mismatch, and prints `<timeout>s`; `spec.md:181`/AC-5(c) and `tasks.md:111-113,186` match; the harness uses short overrides for the timeout case. |
| F20 (INFO) — 201/202 citation | **fixed** | `spec.md:178`, `plan.md:253`, D-11 (`plan.md:450`) cite the Trigger Deploy API `responses` (201 deploy object, 202 queued/no content) and the deploy-hook 202 explanation; 202 remains fail-closed and a 201 `created`/`queued` deploy is handled by the completion poll. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F15 | MAJOR | `spec.md` AC-5 (line 241), §4d (line 171); `plan.md` §10 (lines 401-408); `tasks.md:126,162-163,189,323-325,395,419,423` | **Originally:** the harness did not execute the Render creation/completion blocks while AC-5 claimed harness PASS lines. **Now:** the harness extracts/executes both Render blocks with a stub `curl`; the 14 cases are identical across AC-5, plan §10, T1/T4 (34-case lists) and T3 pre-live; T1/T4 build-log guards record every case. | — | fixed |
| F16 | MINOR | `docs/architecture/containerization.md:37,42`; `tasks.md:265-268,468-471`; `spec.md` AC-10(d) (line 274) | **Originally:** the new sentences omitted/ambiguous the manual-development dispatch SHA. **Now:** both statements use the three-way rule and the T2/T4 greps match. | — | fixed |
| F17 | MINOR | `spec.md:14,55,65,368-369`; `plan.md:448,454`; `tasks.md:5,20,321,395`; `status.md:30` | **Originally:** the dependency context was stale (T6 blocked on VERCEL_TOKEN). **Now:** spec/plan/tasks say T6 complete/production live, T7 in progress, T8 pending; the T1 gate remains `state: accepted`. The orchestrator-owned `status.md:30` is still stale (F21 INFO). | — | fixed |
| F18 | MINOR | `spec.md:171`; `plan.md:404`; `tasks.md:189` | **Originally:** the plan pointed `NODE_PATH` at the repo's `node_modules`, which would load the real `pg` into the schema gate. **Now:** the stub directory is first, repo modules after; both `require.resolve('pg')` and `require('pg')` resolve the stub. | — | fixed |
| F19 | MINOR | `plan.md` §7b (lines 291-333); `spec.md:181`/AC-5(c) (line 238); `tasks.md:111-113,186` | **Originally:** `curl -fsS` aborted on a transient error and the timeout message was hard-coded. **Now:** transient/unreadable GETs retry until the env-driven deadline, only terminal/timeout/current-deploy mismatch fail closed, and the message uses `${timeout_seconds}s`. | — | fixed |
| F20 | INFO | `spec.md:178`; `plan.md:253,450` | **Originally:** the 202 API claim was uncited/ambiguous. **Now:** the Trigger Deploy API `responses` and the deploy-hook 202 explanation are cited; 202 remains fail-closed and a 201 `created`/`queued` deploy is polled. | — | fixed |
| F21 | INFO | `docs/features/production-build-selection/status.md:30` | The orchestrator-owned status still says “T6 is currently owner-blocked on the production Vercel token”, contradicting the r2a context and `production-provisioning/status.md` (T6 `[x]`, production live, T7 in progress, T8 pending). | Update the status note at the approval checkpoint; orchestrator-owned, not a spec/plan/tasks defect. | open |
| F22 | INFO | `tasks.md:323-325,395` | The T3 task asks for the 14 per-case `Pre-live harness: render-* PASS` lines, while the T3 verify executes all 14 harness cases but only greps the single `Pre-live harness: render-* PASS` marker in the build log. The evidence is reproducible; the per-case build-log lines are optional. | Optionally record the 14 per-case lines in `build-log-T3.md`; no gate change required. | open |

## R1 disposition

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (BLOCKER) — live Render revision unproven | **fixed** | `Wait for Render deploy to complete` polls `GET /deploys/{id}` every `RENDER_DEPLOY_POLL_INTERVAL_SECONDS` (default 10 s) for up to `RENDER_DEPLOY_TIMEOUT_SECONDS` (default 900 s), requires `status: live`, fails on terminal statuses/timeout/current-deploy mismatch, and verifies `GET /deploys?limit=1` `.[0].deploy.id`/`commit.id` before health/Vercel/smoke; 21 steps preserved; automatic branch keeps only the 45 s head start. Harness coverage added in r2a (F15). |
| F2 (MAJOR) — fixtures reimplemented gates; missing-table/messages | **fixed** | `tests/deploy/gate-fixtures.mjs` executes the actual resolver/guard/contract/schema/CI-parse blocks; missing-table/missing-007 cases and exact messages; T1/T4 run it. Render blocks added in r2a. |
| F3 (MAJOR) — T3 Vercel commit vs projection limitation | **fixed** | T3/T4 accept either the Vercel commit read-back or `Vercel metadata projection: unavailable` plus the deployment ID, checkout/Render evidence and `No mixed revision`. |
| F4 (MAJOR) — second stale `github.sha` release-identity line | **fixed** | Both containerization statements now use the three-way rule with positive/negative greps and a T4 stale scan. |
| F5 (MAJOR) — unverified Render 202 assumption | **fixed** | 201/202 cited, 202 fail-closed, 201 `created`/`queued` polled; D-11/AC-5 coherent. |
| F6 (MINOR) — relative dropdown UX | **fixed** | Q-1 owner acceptance at the approval checkpoint; relative-label/resolved-SHA docs; `build_sha` exact selector. |
| F7 (MINOR) — T3 exact lines vs long-hex guard | **fixed** | AC-11(d), T3 task and T3/T4 verify require shortened 7–12 character SHAs and the `Shortened evidence: …` label. |
| F8 (MINOR) — stale dependency context | **fixed** | Spec/plan/tasks now say T6 complete/production live, T7 in progress, T8 pending; the orchestrator-owned `status.md:30` stale note is F21 INFO. |
| F9 (MINOR) — “Development unchanged” overstated | **fixed** | Automatic development unchanged; manual development defaults preserved with the Render API mechanism aligned; AC-7(c) explicit. |
| F10 (MINOR) — `ci.yml` parse position/content unverified | **fixed** | T1/T4 assert the exact 11-step `verify-workflows` list and write/execute the `Validate deploy build selection contract` run block. |
| F11 (INFO) — migration content vs names | **fixed** | Immutable-migration policy documented; a policy relaxation requires content hashes. |
| F12 (INFO) — Render `.id` prefix | **fixed** | AC-5(b), the `case "$deploy_id" in dep-*)` and the T1 grep assert the prefix. |
| F13 (INFO) — lowercase `build_sha` | **fixed** | Description, AC-2(d) and T2 greps require the full 40-character lowercase rule. |
| F14 (INFO) — false 45 s comment | **fixed** | T1 negates the old phrase; the plan removes the comment and replaces it with the completion-poll rationale. |

## Coverage of the review scope

| Brief item | Result | Evidence / notes |
| --- | --- | --- |
| 1. Request fidelity and UX | ✅ | Static relative dropdown with `latest` default, Q-1 owner acceptance, relative-label/resolved-SHA docs; development automatic unchanged. |
| 2. Build identity and same-revision guarantee | ✅ | Build = successful `CI` push run on `main`; resolved-SHA guard/compare; same-SHA Render API + completion/current-deploy proof + Vercel checkout; the 14 render cases are executed by the harness. |
| 3. Safety gates | ✅ | Contract/schema gates fail closed and ordered; harness executes them plus the Render creation/completion; immutable-migration policy documented. |
| 4. Current-feature dependency | ✅ | Depends on `production-provisioning` acceptance; T6a/one `gh run list` preserved; spec/plan/tasks context current; `state: accepted` gate. |
| 5. Testability | ✅ | ACs binary/mapped; T3 owner-gated; exact messages pinned; 34 harness cases; F21/F22 are INFO only. |
| 6. Task graph and ownership | ✅ | T1 → T2 ∥ T3 → T4 acyclic; T1 owns both workflows + harness; T2/T3 disjoint; T3 owner merge precondition; T4 integrates. |
| 7. Docs, security, real-time, containers | ✅ | Four docs + index; both release-identity statements three-way; no secret exposure; real-time/container impacts correct. |
| 8. Owner decisions | ✅ | Q-1–Q-5 surfaced; Q-1 acceptance required; no silent topology change. |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Request covered; UX limitation surfaced and owner-gated. |
| Testability | ✅ | All gate blocks executed by the harness; 34 cases; F21/F22 INFO only. |
| Boundaries | ✅ | Three tiers; non-goals explicit; only the harness added under `tests`. |
| Dependency graph | ✅ | T1 → T2 ∥ T3 → T4; no cycle; all ACs mapped. |
| Parallel safety | ✅ | T1 owns the workflows/harness; T2/T3/T4 logs disjoint; no shared-file contact. |
| Security | ✅ | No new secret; `build_sha` validated; Render response body not printed; catalog/protection preserved. |
| Testing | ✅ | Coverage/no-regression gate correct; harness covers resolver/guard/contract/schema/Render creation/completion/CI parse. |
| Consistency | ✅ | Dependency context current in spec/plan/tasks; the status note is F21 INFO. |
| Real-time | ✅ | Restart/WS close/reconnect/room reset and the live completion proof addressed. |
| Containers | ✅ | No new image/service/port; provider-neutral; `/healthz`/`/ws` on 8080; environment config. |
| Documentation | ✅ | Four docs + index; both release-identity statements updated; F21 status note only. |
| Owner decisions | ✅ | Q-1–Q-5 with defaults; no silent topology change. |

## Notes / backlog (non-blocking)

- **F21 (INFO)** — `status.md:30` is orchestrator-owned and still says T6 is blocked on the Vercel token; update at the approval checkpoint. The spec/plan/tasks are current.
- **F22 (INFO)** — The T3 task asks for the 14 per-case `Pre-live harness: render-* PASS` lines; the T3 verify executes all 14 cases and greps the single marker. Recording the per-case lines is optional.
- **Review method** — Static review only; no provider call, workflow dispatch, GitHub write, deploy or live operation was performed. The r2a changes were read directly from `spec.md`, `plan.md`, `tasks.md` and the orchestrator status.
