---
feature: production-provisioning
phase: spec
round: 2
iteration: 2
verdict: approved
blocking: 0
nonblocking: 3
---
# Spec Review — r2

## Summary

✅ **approved** — The r3 T6a amendment is bounded and consistent. F31 is fixed: `spec.md:65` now says the workflow already resolves the environment and is `production`-capable, and the only workflow change is the T6a one-line preflight fix; the stale "no code change" contradiction is gone, and no other "no workflow change" wording remains. T6a/ownership/graph, the exactly-one-line PR diff guards, T7 no longer owning `deploy.yml`, the AC/plan/non-goal/supersession alignment, and the 23-name catalog/protection/T5a/Neon-branch/owner decisions remain intact. F28–F30 remain non-blocking residuals.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F19 | MAJOR | spec.md:317,358; plan.md:197; tasks.md:393-396,471-480 | **The r2 token-audit replacement originally dropped the Fly credential coverage.** The canonical audit now retains `FLY_API_TOKEN` in the credential-shaped alternation and `FlyV1 [A-Za-z0-9_-]{20,}` in the full key-shape audits (`spec.md:317/358`, `plan.md:197`, `tasks.md:393-396`, `tasks.md:471-480`), the `deployment.md` wording task requires the canonical Fly/Vercel/Render coverage retained verbatim from `workflow-hygiene` while adding Brevo/SMTP (`tasks.md:412`), and the read-only current-tree dry-check returns no matches for the tracked and untracked credential-shaped and full key-shape audits. | Closed. The only residual is F28 (T7's duplicate guards omit `FlyV1`; T8 catches it). | fixed |
| F20 | MINOR | spec.md:158; tasks.md:178 | **T5a originally said to set the `SMTP_FROM` variable with `gh secret set`.** The T5a instruction now sets the five owner-held secrets (plus the hook when owner-held) with the UI or `gh secret set` stdin, and sets the `SMTP_FROM` **variable** with the UI or `gh variable set SMTP_FROM` — explicitly never `gh secret set`; T5a's verify checks `SMTP_FROM` in `vars`. | Closed. F29 notes the generic spec-table phrasing. | fixed |
| F21 | MINOR | spec.md:307; tasks.md:462-463 | **The T8 exhaustive stale-doc scan was recorded, not executed.** T8 now runs `stale=$(grep -RniE 'not provisioned\|unprovisioned\|placeholder-only\|future production\|one project\|six pinned placeholders\|has no protection rules yet' ... \| grep -vEi 'historical\|archived\|superseded\|it is not provisioned' \|\| true)` and asserts `test -z "$stale"` (tasks.md:462-463), then records `stale-production-scan: PASS`/`allowlist: historical AWS/Fly only`. | Closed. F30 notes the allowlist breadth. | fixed |
| F22 | MINOR | spec.md:248,251; tasks.md:72-77 | **The T2 zero-row/primary assertions were not exact.** T2 now uses `grep -qx 'users: 0'`, `sessions: 0`, `verification_tokens: 0`, `user_economy: 0`, and asserts `primary: true`/`default: true`; the task evidence line includes all three. | Closed. | fixed |
| F23 | MINOR | tasks.md:245-247,257 | **T5's production read-back lines were not asserted.** T5 now greps `production neon branch: br-floral-dream-zarerhtw`, `production vercel project: prj_… …` and `production render service: srv-… …` in addition to `development unchanged: PASS`; the task description matches. | Closed. | fixed |
| F24 | MINOR | spec.md:216-218; tasks.md:348,355-356,367-368,462 | **Two stale phrases were outside the inventory/T7/T8 scan.** `six pinned placeholders` and `has no protection rules yet` are now in the spec inventory, the T7 negative greps for README/deployment/vercel, and the T8 exhaustive scan pattern. | Closed. | fixed |
| F25 | MINOR | spec.md:309; tasks.md:328-330 | **The exact supersession ledger row was only prefix-checked.** T7 now builds the full row (`\`production-provisioning\` — **in force**; supersedes …; retains …`) in a `ledger` variable and greps it with `grep -qF "$ledger"` in both `deployment.md` and `vercel-render-neon.md`. | Closed. | fixed |
| F28 | MINOR | tasks.md:401-402 | **T7's duplicate full key-shape/build-log guards still omit `FlyV1`.** The T7 `git grep` over `.` and the T7 build-log guard use the old key-shape pattern without `FlyV1 [A-Za-z0-9_-]{20,}`; the T8 full key-shape audits (`tasks.md:471-474`) and the T8 credential-shaped audits (`tasks.md:477-480`) include it, so the final gate catches a Fly token. This is a defense-in-depth inconsistency, not an acceptance gap. | Add `FlyV1 [A-Za-z0-9_-]{20,}` to the T7 line 401/402 patterns for consistency. | open |
| F29 | MINOR | spec.md:154 | **The spec's owner-held table "How" column still says `gh secret set` generic.** The row includes the `SMTP_FROM` variable; line 158 and T5a line 178 correctly say the variable uses the UI/`gh variable set` and the secrets use `gh secret set`. The table row should split the variable from the secrets for exactness. | Reword the table's "How" cell to distinguish the `SMTP_FROM` variable from the secrets. | open |
| F30 | MINOR | tasks.md:462 | **The T8 allowlist is slightly broader than "historical AWS/Fly only".** The filter `grep -vEi 'historical\|archived\|superseded\|it is not provisioned'` also exempts any line containing `superseded`/`archived`; the T7 exact negatives and the current-state edits remain the primary gate. | Narrow the allowlist to the historical AWS/Fly sections (or document the broader markers as deliberate), keeping the `allowlist: historical AWS/Fly only` record accurate. | open |
| F31 | MAJOR | spec.md:65 | **The § Context and current state originally said `deploy.yml` was production-capable "with no code change".** T6a authorizes exactly one `deploy.yml` line (`--repo "$GITHUB_REPOSITORY"` in the pre-checkout `gh run list`), and spec § Out of scope, AC-8(e), AC-10(b)/(d) and the non-goals all state the T6a line is the only workflow change. The stale sentence contradicted the amendment. | Closed: `spec.md:65` now says the workflow already resolves the environment and is production-capable, and **the only workflow change is the T6a one-line preflight fix**; no other "no code change" wording remains. | fixed |

## Prior-finding disposition (r1)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (BLOCKER) — Neon branch pre-exists | **fixed** | spec.md:24,60,62,93,184,194,247-248 and plan.md:30,50,57,171 reuse/verify `br-floral-dream-zarerhtw` (parent `—`, no `main`); T2 asserts the ID, difference from `br-ancient-smoke-za1pdv7w`, `parent: none (project default)`, no create/delete and branch-id drift fail-closed. |
| F2 (BLOCKER) — cleanup deletes the branch | **fixed** | spec.md:43,194,323,353 and T6/T8 retain the pre-existing branch and delete only the Render/Vercel resources created by the feature; AC-11(a) is explicit. |
| F3 (MAJOR) — token audit false-positive | **fixed** | The updated credential-shaped audit (`tasks.md:477-480`) and full key-shape audit (`tasks.md:471-474`) return no match on the current tree (read-only `git grep` exit 1 for tracked and untracked); the canonical Fly/Vercel/Render coverage is retained (F19 fixed). |
| F4 (MAJOR) — documentation inventory incomplete | **fixed** | spec.md:216-219 lists the r1 examples plus F24; T7 lines 329-389 include the exact negatives; T8 lines 462-465 execute the exhaustive scan. |
| F5 (MAJOR) — Phase A gate missing | **fixed** | `T5a — Phase A owner hand-off [owner] [seq]` (tasks.md:155-178) depends on T4, owns `build-log-T5a.md`, verifies names only, includes `RENDER_DEPLOY_HOOK_URL`, and T5 depends on T5a; T6 depends on T5. F20/F26 fixed. |
| F6 (MAJOR) — branch-ID/migration assertions missing | **fixed** | T2 (tasks.md:51-84) asserts the exact branch ID, difference from development, `parent: none (project default)`, `primary: true`/`default: true`, `schema_migrations: 7`, the seven names, the local migration count and exact zero rows; drift stops with `BLOCKED: production branch id drift`. |
| F7 (MAJOR) — provider/development read-backs missing | **fixed** | T5/T8 require `development unchanged: PASS`; T5 asserts its production lines (tasks.md:245-247); T8 asserts `production neon branch: br-floral-dream-zarerhtw`, `production vercel project: prj_… …`, `production render service: srv-… …`, `production github names: 15 variables / 8 secrets` and the anchored URLs. |
| F8 (MINOR) — pre-state "all placeholder-bearing" | **fixed** | spec.md:60 says four pinned constants and five `CHANGEME` placeholders. |
| F9 (MINOR) — absolute "No secret value is read" | **fixed** | spec.md:44 says no owner-held or existing secret value is read; provider-generated values are handled in-process and never recorded. |
| F10 (MINOR) — Vercel fallback incomplete | **fixed** | tasks.md:105 adds the authenticated `vercel` CLI/REST fallback; spec.md:414 matches. |
| F11 (MINOR) — T8 dispatch parse missing | **fixed** | tasks.md:437 runs the dispatch parse in T8. |
| F12 (MINOR) — health-poll body not exact | **fixed** | tasks.md:274/461 use `healthz OK after [0-9]+s: \{"status":"ok"\}`. |
| F13 (MINOR) — Render origins/DB values name-only | **fixed** | tasks.md:125-131 assert the exact origins and `<set>` Neon URLs. |
| F14 (MINOR) — `head -n1` fallback extraction | **fixed** | T3/T4/T5/T6/T8 use the anchored `production frontend:`/`production api:` lines. |
| F15 (INFO) — exact ledger row | **fixed** | tasks.md:328-330 grep the full ledger row in both docs. |
| F16 (INFO) — prior-tool clarification | **fixed** | spec.md:76 states the named tools are prior recorded evidence; T1's capability matrix is the authority. |
| F17 (INFO) — Vercel root-directory limitation | **fixed** | spec.md:415, tasks.md:105 and the testing strategy state the limitation; T3 records the request and T6's build proves the effective root. |
| F18 (INFO) — Render/Vercel deployment ID/status | **fixed** | tasks.md:283-284 assert `Render deploy: dep-[A-Za-z0-9]+ live` and `Vercel deployment: dpl_[A-Za-z0-9]+ (ready\|aliased)`. |

## r2 re-check (F19–F27)

| Finding | Disposition | Evidence |
| --- | --- | --- |
| F19 — Fly token coverage | **fixed** | `spec.md:317,358` and `plan.md:197` include `FLY_API_TOKEN` + `FlyV1 [A-Za-z0-9_-]{20,}`; T7 lines 393-396 and the docs wording at 412 retain the canonical Fly/Vercel/Render coverage; T8 lines 471-474 (full key shape) and 477-480 (credential-shaped) include them. Read-only current-tree dry-check: tracked credential-shaped exit `1` (no match), untracked credential-shaped exit `1`, tracked full key-shape exit `1`, untracked full key-shape exit `1`. |
| F20 — T5a `SMTP_FROM` command | **fixed** | `tasks.md:178`: the variable uses the UI or `gh variable set SMTP_FROM`, never `gh secret set`; the five secrets/hook use the UI or `gh secret set` stdin; `spec.md:158` matches. Residual F29 is table wording only. |
| F21 — T8 stale scan execution | **fixed** | `tasks.md:462-463`: actual `grep -RniE` over the six docs, allowlist filter, `test -z "$stale"`; `stale-production-scan: PASS`/`allowlist` recorded at 464-465. Residual F30 is allowlist breadth. |
| F22 — exact zero/primary/default | **fixed** | `tasks.md:72-77`: `grep -qx 'primary: true'`, `default: true`, `users: 0`, `sessions: 0`, `verification_tokens: 0`, `user_economy: 0`; task evidence at 84. |
| F23 — T5 production read-backs | **fixed** | `tasks.md:245-247` assert the production Neon/Vercel/Render lines; task description at 257 matches. |
| F24 — residual stale phrases | **fixed** | `spec.md:216-218` includes `six pinned placeholders`/`has no protection rules yet`; T7 lines 348/355-356/367-368 include the negatives; T8 line 462 includes both in the scan. |
| F25 — full ledger row | **fixed** | `tasks.md:328-330`: full `ledger` variable and `grep -qF "$ledger"` in both `deployment.md` and `vercel-render-neon.md`. |
| F26 — T5a/T5 secret division | **fixed** | `tasks.md:178`: T5a checks six secret names (five owner-held + hook) and `SMTP_FROM`; T5 adds `DATABASE_URL`/`DIRECT_DATABASE_URL` for the eight-secret count. |
| F27 — diff/history exclusions | **fixed** | `tasks.md:479-480`: branch diff/history credential-shaped audits use `-- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts'`. |

**Current-tree audit result (F19):** the read-only commands returned no matches:
- credential-shaped, tracked: exit `1`
- credential-shaped, untracked: exit `1`
- full key-shape (including `FlyV1`), tracked: exit `1`
- full key-shape (including `FlyV1`), untracked: exit `1`

No provider call, live operation, GitHub write or deploy was performed for this re-check. The old canonical audit text still exists in `docs/architecture/deployment.md:118`; T7 line 412 replaces it with the retained-verbatim Fly/Vercel/Render coverage plus the credential-shaped pattern, and T7 lines 393-396 enforce it.

## r3 amendment re-check (T6a)

| Focus | Result | Evidence |
| --- | --- | --- |
| T6a task, ownership and graph | ✅ | `T6a — Fix deploy CI preflight repository context [seq]` exists (`tasks.md:261-291`), `depends_on: T5` (`tasks.md:262`), `files_owned: .github/workflows/deploy.yml, build-log-T6a.md` (`tasks.md:263`); T6 depends on T6a (`tasks.md:294`); the graph is T1→T2→T3→T4→T5a→T5→T6a→T6→T7→T8 (`tasks.md:9`). |
| Exactly one authorized line | ✅ | Spec lines 28/29/41/177/190/224/343/347 authorize only the T6a `--repo "$GITHUB_REPOSITORY"` pre-checkout `gh run list` line; T6a enforces `grep -qF 'gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion'` and exactly one `gh run list` (`tasks.md:275-276`); no guard condition, step `if`, step order, permission, trigger or concurrency change is authorized. The automatic `workflow_run` path remains `development`. |
| PR/diff/actionlint/dry-run/merge | ✅ | T6a creates the `fix/deploy-ci-preflight` PR through the GitHub MCP, records `PR:`, `diff: 1 added / 1 removed`, `actionlint: pass`, `dry-run: success`, `owner merged`, `merge commit: <short-sha>` and `No git push` (`tasks.md:268-286,291`). The PR diff is exactly 2 content lines; the added line contains `gh run list --repo "$GITHUB_REPOSITORY"`; the negative filter `^[+-][^+-]` runs first and excludes `gh run list` (`tasks.md:272-274`). |
| T7/T8 post-merge guards | ✅ | T7 and T8 read the T6a PR diff via `gh pr diff "$pr_num"` and assert the same 2-line count, added line and negative filter (T7 `tasks.md:424-430`; T8 `tasks.md:478-486`). T7 no longer owns `deploy.yml` (`tasks.md:335`); T7 line 456 says it is owned by T6a and must not be edited. No comment edits are expected; the two stale comments remain. |
| Spec ACs/plan/non-goals/supersession | ✅ | AC-3(e), AC-7(j), AC-8(e), AC-9(f), AC-10(b)/(d), the plan verification map (`plan.md:238-241`), non-goals/out-of-scope (`spec.md:41,343,347`), the supersession note (`spec.md:401`) and the r3 revision (`spec.md:433`) are aligned with T6a. F31 is fixed: `spec.md:65` now says the workflow already resolves the environment and is production-capable, and the only workflow change is the T6a one-line preflight fix. |
| Catalog/protection/T5a/Neon/owner decisions | ✅ | The 23-name catalog, protection rules, T5a owner gate, Neon branch reuse/no-delete, cleanup and Q-1–Q-10 remain intact; no unrelated scope reopened (`spec.md:60-62,273-280,328-337,398-407`; `tasks.md:155-191`). |
| Current-tree audit / live operations | ✅ | The F19 read-only audit remains clean (tracked/untracked credential-shaped and full key-shape exits `1`). No provider call, live operation, GitHub write or deploy was performed for this r3 re-check; the amendment is a plan/spec review only. |

**F31 disposition — fixed:** `spec.md:65` now reads "`.github/workflows/deploy.yml` already resolves the environment, `TARGET_ENVIRONMENT` and the concurrency group … runs one `deploy` job … and is `production`-capable; the only workflow change is the T6a one-line preflight fix." The "no code change" contradiction is gone; the surrounding § Context has no other "no workflow change" wording. No other content changed for this fix; the T6a authorization, out-of-scope, AC-8(e), AC-10(b)/(d), non-goals, plan map, supersession and revision text remain consistent.

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The request is covered end to end: pre-existing Neon branch reused/migrated, Vercel/Render resources, 23-name GitHub catalog, `main`-only protection, manual CI-preflighted live proof, docs pass, owner questions. |
| Testability | ✅ | The r1 gaps are fixed; T2 exact zero/primary/default, T5 production lines, T8 provider reads and the T8 stale scan are now explicit; F28/F30 are non-blocking consistency details. |
| Boundaries | ✅ | Three tiers are present; cleanup retains the pre-existing Neon branch and deletes only the Render/Vercel resources created by the feature. |
| Dependency graph | ✅ | T1→T2→T3→T4→T5a→T5→T6a→T6→T7→T8; T5a depends on T4, T5 on T5a, T6a on T5, T6 on T6a; every task points at an earlier task. |
| Parallel safety | ✅ | All tasks are `[seq]`; `files_owned` are disjoint; T5a owns `build-log-T5a.md`; T6a owns `deploy.yml` + `build-log-T6a.md`; T7 no longer owns `deploy.yml`; no `[P]` collision. |
| Security | ✅ | F19 retains `FLY_API_TOKEN`/`FlyV1`; F20 fixes the variable command; F29/F30 are non-blocking wording/breadth details; the owner/provider secret split is explicit. |
| Testing | ✅ | No-code change is correctly marked as no unit/integration target; T8 runs the full no-regression suite and coverage; the feature-appropriate gate is explicit. |
| Consistency | ✅ | The r3 amendment is internally aligned: `spec.md:65` now states the only workflow change is the T6a one-line preflight fix, matching the AC/non-goal/plan text. F28/F29/F30 are non-blocking duplicate/table/allowlist details. |
| Real-time | ✅ | § Real-time impact is correct: no behavior change; a production deploy restarts the single instance, closes WebSockets and resets in-memory rooms; the bounded reconnect policy is unchanged. |
| Containers | ✅ | § Containerization impact aligns with `docs/architecture/containerization.md`: same backend image, environment-based config, no new compose/image/port, `/healthz` and `/ws` on 8080, provider-neutral deployable. |
| Owner decisions | ✅ | Q-1–Q-10 surface the cost/plan/protection/credential/domain choices with safe defaults; T5a is the Phase A gate; no topology-changing decision is silent. |
| Documentation | ✅ | The inventory, T7 negatives and T8 scan cover the stale production statements, including F24; F28/F30 are non-blocking consistency details. |

## Notes / backlog (non-blocking)

- **F28 (MINOR)** — `tasks.md:401-402`: T7's duplicate full key-shape/build-log guards omit `FlyV1 [A-Za-z0-9_-]{20,}`; the T8 final audits (lines 471-480) include it, so a Fly token is still caught at the final gate. Add it to T7 for defense in depth.
- **F29 (MINOR)** — `spec.md:154`: the owner-held table's "How" cell says `gh secret set` generically; line 158 and `tasks.md:178` correctly distinguish the `SMTP_FROM` variable (UI/`gh variable set`) from the secrets. Reword the table cell.
- **F30 (MINOR)** — `tasks.md:462`: the T8 allowlist filter `historical|archived|superseded|it is not provisioned` is broader than "historical AWS/Fly only"; narrow it to the historical sections or document the broader markers while keeping the recorded allowlist accurate.
- **Scope note** — No provider call, live operation, GitHub write or deploy was performed for this re-check. The current-tree audit commands were read-only; no Fly token, credential-shaped assignment or full key-shape token is present outside the documented old audit text.
