---
feature: production-build-selection
state: building
spec_review_round: 2
build_round: 0
created: 2026-11-27
updated: 2026-11-27
---
# Status — Production Build Selection

## Summary
Add an optional `build_sha` to the manual production deploy: empty selects the latest successful CI build on `main`; a set SHA deploys that exact commit (which may not be the latest on `main`). Development automatic deploys keep deploying the latest successful build. Raw request (initial): "I would like to, for example, when deploying to production, being able to select a previous build. So, by default, when deploying to development on this automatic deployment we've done, it will select the latest successful build. But, when deploying to production, that will be manually, we should be able to select as a pipeline param the build we want to deploy that, by default, will be the last successful build. The selection should be as a dropdown of builds." Owner revision: "I don't like this build param. Just maintain the build_sha as optional, so: If we set this, is not the latest commit on main."

## Task board
- [x] T1 — Build-selection workflow contract, CI parse and dry-runs `[seq]` (rework for `build_sha`-only)
- [x] T2 — Documentation and feature-index proposal `[P]` (rework for `build_sha`-only)
- [>] T3 — Live selected-build proof and automatic development proof `[owner]` `[P]` (rework with `build_sha`)
- [ ] T4 — Verify & integrate `[seq]`

## Loop log
- 2026-11-27 — created → planning — request: production manual deploy should offer a dropdown of previous builds (default latest successful), development automatic stays latest; planner briefed with the GitHub Actions static-choice limitation, the `production-provisioning` T6a fix, and the same-revision requirement.
- 2026-11-27 — planning — planner delivered spec/plan/tasks r1: build = successful `CI` push run on `main` → SHA; native static `build` choice `latest` / `previous-1` … `previous-9` (default `latest`) plus optional `build_sha`; same-SHA Render API `commitId` on manual dispatches and Vercel `--meta githubCommitSha`; deploy-contract + schema-compatibility fail-closed gates; automatic development unchanged; 12 ACs; 4 tasks; hard precondition on `production-provisioning` acceptance — spec.md, plan.md, tasks.md
- 2026-11-27 — planning → spec_review — spec review round 1 dispatched — reviews/spec-r1.md
- 2026-11-27 — spec_review → planning — verdict changes_requested (5 blocking: live Render revision not verified after the API deploy; safety-gate fixtures reimplement rather than execute the gates; T3 Vercel commit assertion contradicts the metadata limitation; stale `github.sha` release-identity line; Render 201/202 assumption); planner revision r2 dispatched — reviews/spec-r1.md
- 2026-11-27 — planning — revision r2 complete: F1–F14 addressed (Render deploy-completion poll + current-deploy/SHA read-back; real gate harness executing the workflow run blocks with exact messages and missing-table case; conditional Vercel metadata proof; both containerization release-identity statements; verified 201/202 behavior; owner Q-1 acceptance; shortened SHA evidence; current dependency context; automatic-development wording; CI parse position/content) — spec.md, plan.md, tasks.md
- 2026-11-27 — planning → spec_review — final spec review round 2 dispatched — reviews/spec-r2.md
- 2026-11-27 — spec_review → planning — review r2 verdict changes_requested (1 MAJOR: the gate harness does not execute the Render creation/completion run blocks, so the F1 failure paths are untested; 3 MINOR: containerization manual-development wording, stale dependency context, harness stub-pg ordering; 1 INFO: 202 citation); bounded r2a fix dispatched — reviews/spec-r2.md
- 2026-11-27 — planning — r2a complete: harness extracts/executes the Render creation/completion blocks with 14 `render-*` failure-path cases; three-way containerization wording; T6-complete/production-live context; stub-first `NODE_PATH`; env-driven completion retry/timeout; 201/202 citation — spec.md, plan.md, tasks.md
- 2026-11-27 — spec_review — targeted r2a re-check approved (0 blocking; 2 INFO: stale status note fixed here; T3 may record a single pre-live harness marker); user checkpoint dispatched — reviews/spec-r2.md
- 2026-11-27 — awaiting_approval → building — user approved the spec including Q-1 (static relative dropdown + optional exact `build_sha`) and defaults Q-2–Q-5; T1 waits for `production-provisioning` `state: accepted` (T7/T8 pending) — reviews/spec-r2.md
- 2026-11-27 — building — user merged `feat/production-provisioning` to `main`; accepted state and the T6a fix are now on `main`; T1 dispatched on `feat/production-build-selection` — reviews/code-r1.md (production-provisioning)
- 2026-11-27 — building — T1 completed (commit `2e648ed`; `build`/`build_sha` inputs, resolver, same-SHA guard/checkout, contract/schema gates, Render API `commitId` + completion/current-deploy proof, Vercel metadata, 21 steps; 34/34 harness PASS; coverage backend 97.09/92.24/99.65/97.09, frontend 97.22/96.8/98.6/97.22; actionlint/parses pass; T1 verify exit 0; no app/container change); T2 dispatched — build-log-T1.md
- 2026-11-27 — building — T2 completed (commit `142ea984`; README/deployment/vercel-render-neon/containerization updated; exact docs greps, ledger rows, links, actionlint/parses pass; clean-worktree T2 verify exit 0 after fixing `Render deploy-by-commit` and the `build_sha` sentence; proposed index row `production-build-selection | Production Build Selection | accepted | 2026-11-27`); T3 owner merge/live proof pending — build-log-T2.md
- 2026-11-27 — building — user merged `feat/production-build-selection` to `main`; T3 dispatched: `previous-1` production proof, `latest` restore, automatic-development proof — build-log-T2.md
- 2026-11-27 — building — T3 completed (merge `5209d80`; previous-1 run `46060367835` deployed `de5b829d5` to Render `dep-dc4u29mi0phs73bksleg`/Vercel `dpl_EefCVz1PPst24imsqyTHe7vycCMo`, latest restore `46060683509` deployed `5209d80` to Render `dep-dc4u3jk9v7es738dip4g`/Vercel `dpl_CXYRLt78JFvr5icsmCJiTFRwKHMk`, automatic development `46060358305` green; smoke 8/8 each, protection not bypassed, no mixed revision; T3 verify exit 0); T4 final gate next — build-log-T3.md
- 2026-11-27 — building — T4 task guard fixed: application/container diff excludes `tests` and asserts only `tests/deploy/gate-fixtures.mjs`; harness-only credential-audit exclusion added; T4 final gate dispatched — tasks.md
- 2026-11-27 — building → planning (user change) — owner rejected the `build` dropdown/relative choices; new contract is optional `build_sha` only: empty = latest successful CI build on `main`, set = that exact commit SHA. T4 stopped; T1/T2/T3 rework and a new live proof are required; planner amendment dispatched — user request (verbatim: "I don't like this build param. Just maintain the build_sha as optional, so: If we set this, is not the latest commit on main.")
- 2026-11-27 — planning — r4 contract change applied: `build` choice and relative labels removed; only `environment` + optional `build_sha`; empty → latest successful CI push on `main`, set → exact full SHA; 31-case harness; T3 re-run with `build_sha` and latest restore; docs updated; post-merge base fix for T1/T4; old `previous-1` proof superseded — spec.md, plan.md, tasks.md
- 2026-11-27 — planning → spec_review — targeted contract-change re-check dispatched — reviews/spec-r2.md
- 2026-11-27 — spec_review — targeted `build_sha` re-check approved (0 blocking; F27 docs-scan wording fix applied, F21 status cleanup done here); T1 rework dispatched on `feat/production-build-selection` — reviews/spec-r2.md
- 2026-11-27 — building — T1 rework completed (commit `209aed7`; inputs `environment` + optional `build_sha`; empty → newest successful CI push on `main`, set → exact SHA; resolver `.workflow_runs[0] // empty` + parsed-SHA check; 31/31 harness PASS; coverage backend 97.09/92.24/99.65/97.09, frontend 97.22/96.8/98.6/97.22; actionlint/parses pass; T1 verify exit 0; no app/container change); T2 rework dispatched — build-log-T1.md
- 2026-11-27 — building — T2 rework completed (commits `0e85012` r4 artifacts + `e82f7ac` docs; README/deployment/vercel updated to `build_sha`-only, old dropdown sections removed; T2 verify exit 0 in place; links/actionlint/parses/no-edit/credential guards pass; proposed index row recorded); T3 needs the updated branch merged to `main` — build-log-T2.md

## Blockers / open questions
- **Q-1 superseded by the owner:** the dropdown and relative choices are removed; the only selector is the optional `build_sha` field (empty = latest, set = exact SHA).
- **T3 owner gate:** T1/T2 are reworked; the updated `feat/production-build-selection` (commits `209aed7`, `0e85012`, `e82f7ac`) must be merged to `main` before the new live proof. T3 then dispatches `build_sha=<known-good-40-hex>` and a latest restore omitting `build_sha`; T4 follows.
- The orchestrator-owned `status.md` is uncommitted; the eventual T4 builder is authorized to commit it unchanged with its build log.
- **Q-2 (default):** empty `build_sha` means the newest successful `CI` push build on `main`; a set SHA is the exact commit (may not be the latest). **Q-3:** old builds fail closed on schema/contract mismatch. **Q-4:** selection is production-only.
- **F27 (MINOR):** the broad docs negative would reject a correct “no dropdown” sentence; the T2 wording/scan needs a bounded fix before T2 runs.
