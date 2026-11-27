---
feature: production-build-selection
state: planning
spec_review_round: 0
build_round: 0
created: 2026-11-27
updated: 2026-11-27
---
# Status — Production Build Selection

## Summary
Add a production deploy build-selection parameter: a dropdown of previous builds, defaulting to the latest successful build, while development automatic deploys keep deploying the latest successful build. Raw request: "I would like to, for example, when deploying to production, being able to select a previous build. So, by default, when deploying to development on this automatic deployment we've done, it will select the latest successful build. But, when deploying to production, that will be manually, we should be able to select as a pipeline param the build we want to deploy that, by default, will be the last successful build. The selection should be as a dropdown of builds."

## Task board
_No tasks yet; planner is authoring the spec/plan/tasks._

## Loop log
- 2026-11-27 — created → planning — request: production manual deploy should offer a dropdown of previous builds (default latest successful), development automatic stays latest; planner briefed with the GitHub Actions `workflow_dispatch` static-choice limitation, the current `production-provisioning` T6a fix, and the need to keep Render/Vercel on the same selected revision.

## Blockers / open questions
- GitHub Actions `workflow_dispatch` choices are static YAML options; a dynamically populated dropdown of arbitrary previous builds is not natively supported. The planner must recommend a viable dropdown design (for example a generated/static recent-build list or a relative latest/previous choice) and state the trade-offs.
- Sequence after `production-provisioning` (T6a one-line fix and the live proof) to avoid conflicting changes to `deploy.yml`.
