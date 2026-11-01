# Build log — T2 — Document the manual-deploy policy

Task: T2 (2026-11-01)
Files changed: `docs/architecture/deployment.md`, `README.md`

What changed & why:
- `docs/architecture/deployment.md`: Environment strategy line updated from "Push to `main` → …" to "Manual trigger (`workflow_dispatch`) → …"; added a new "Trigger policy" section stating deploy is manual via `workflow_dispatch` only, automatic deploy is deferred because only a single `production` environment exists (staging is a future additive recipe), image tag = selected ref's tip SHA, and `production` protection still applies; generalized the "Double gate on `main`" heading to "Double gate on the selected ref (by design)" with wording covering manual triggers (gates re-run on the selected ref before any deploy — deliberate). Removed stale "push to `main`" trigger wording.
- `README.md` Deployment section: "What the pipelines run" `deploy.yml` parenthetical updated to manual `workflow_dispatch`; deploy flow step 1 changed from "Push to `main`" to a manual `workflow_dispatch` trigger (Actions → Deploy → Run workflow); added a note that CD is manual because only the `production` environment exists. Local-run instructions and other sections untouched.

Evidence:

- `grep -n "workflow_dispatch" docs/architecture/deployment.md` (match)
```
28:- Single deploy environment: `production`. Manual trigger (`workflow_dispatch`) → gates → build/push → plan/apply → deploy, gated by the GitHub `production` environment protection.
62:- Deploy is triggered **manually** via `workflow_dispatch` only. There is no automatic deploy on push to the default branch (or on any other event): CI runs automatically on pushes to `main` and on pull requests, but CD requires an explicit human action (Actions → Deploy → Run workflow).
```

- `grep -ni "single.*production\|staging" docs/architecture/deployment.md` (match stating the reason)
```
3:Conventions for deploying CubeClicker. ... (AWS + Terraform, single `production` environment). ...
28:- Single deploy environment: `production`. Manual trigger (`workflow_dispatch`) → ...
29:- Staging is deliberately not shipped. Additive recipe for a follow-up: ...
63:- Automatic deploy is **deferred**. The reason is that only a single `production` environment exists: auto-deploying from a merge while no staging environment exists to absorb regressions is not acceptable. Automatic deployment will be reconsidered once a staging environment is added (staging is a future additive recipe — see Environment strategy above).
```

- `grep -n "workflow_dispatch\|manual" README.md` (match in Deployment section)
```
105:- `deploy.yml` (manual, via `workflow_dispatch`): calls `ci.yml` via `workflow_call` (gates re-run on the selected ref by design), then builds and pushes both images to ECR tagged with the commit SHA (frontend bakes `VITE_WS_URL` from `PUBLIC_WS_URL`), assumes the deploy role via OIDC, runs `terraform init`/`plan`/`apply`, then deploys both ECS services and waits for stability. Wrapped in a `deploy-production` concurrency group.
109:1. Trigger manually via `workflow_dispatch` (Actions → Deploy → Run workflow), selecting the ref to deploy (typically the merge commit on `main`, only after a feature is accepted and merged).
115:Note: continuous deployment (CD) is manual because only the `production` environment exists; automatic deploy is deferred until a staging environment is added.
```

- `grep -n "Push to \`main\`" README.md` (no match — old first step removed): exit 1 (no output)

- `grep -n "push to \`main\`" docs/architecture/deployment.md` (no match — stale trigger wording removed): exit 1 (no output)

- `grep -c "no provider is chosen" docs/architecture/deployment.md` (unchanged): 0

- `git diff --stat` (only the two owned files)
```
 README.md                       |  6 ++++--
 docs/architecture/deployment.md | 13 ++++++++++---
 2 files changed, 14 insertions(+), 5 deletions(-)
```

- `git diff --name-only`: `README.md`, `docs/architecture/deployment.md`
- `git status --porcelain`: shows the two modified tracked files plus the untracked feature artifacts/build log (build log added in this commit).

## Proposed (NOT applied) `docs/features/README.md` row diff (orchestrator-owned index)

The feature's state at acceptance will be `accepted`. Proposed insertion after the `aws-deploy-pipeline` row:

```diff
 | aws-deploy-pipeline | AWS Deploy Pipeline (Terraform infrastructure + GitHub Actions CI/CD + framework proof-of-working) | accepted | 2026-10-31 |
+| manual-deploy-trigger | Manual Deploy Trigger (manual `workflow_dispatch` deploy; automatic deploy deferred while only `production` exists) | accepted | 2026-11-01 |
```

This diff is proposed only; `docs/features/README.md` is orchestrator-owned and is not edited by the builder.