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
Add a production deploy build-selection parameter: a dropdown of previous builds, defaulting to the latest successful build, while development automatic deploys keep deploying the latest successful build. Raw request: "I would like to, for example, when deploying to production, being able to select a previous build. So, by default, when deploying to development on this automatic deployment we've done, it will select the latest successful build. But, when deploying to production, that will be manually, we should be able to select as a pipeline param the build we want to deploy that, by default, will be the last successful build. The selection should be as a dropdown of builds."

## Task board
- [ ] T1 — Build-selection workflow contract, CI parse and dry-runs `[seq]`
- [ ] T2 — Documentation and feature-index proposal `[P]`
- [ ] T3 — Live selected-build proof and automatic development proof `[owner]` `[P]`
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

## Blockers / open questions
- **Q-1 accepted:** the user approved the native static relative dropdown (`latest`, `previous-1` … `previous-9`) plus the optional exact `build_sha` field.
- **T1 waiting:** `production-provisioning` must reach `state: accepted` before T1; T6 is complete and production is live (Render `dep-dc4o1fff3r2c73c4asp0`, Vercel `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq`, smoke 8/8), while T7/T8 are still pending. No build-selection task is ready yet.
- **Q-2 (default):** "previous" means previous successful `CI` build on `main`; **Q-3:** old builds fail closed on schema/contract mismatch; **Q-4:** selection is production-only; **Q-5:** dropdown depth 10.
