# Tasks — Manual Deploy Trigger

Dependency overview: T1 → T2 → T-final

Revision: r2 — 2026-11-01 — spec-r1 review fixes (F1–F7): T1/T-final verify pin `grep -n "id-token: write"` (deploy-job-scoped); T1 verify adds the bare-`workflow_dispatch`/no-`inputs:` anchor; T2 verify drops the vacuous deployment.md grep and adds the reason-phrase + stale-"push to main" anchors; T-final verify adds `git status --porcelain` alongside `git diff --name-only` with documented coverage split.

## T1 — Switch `deploy.yml` trigger to manual (`workflow_dispatch`) only `[seq]`
depends_on: —
files_owned: `.github/workflows/deploy.yml`
verify: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml` (exit 0), `grep -n "workflow_dispatch" .github/workflows/deploy.yml` (match), `grep -n "push:" .github/workflows/deploy.yml` (no match), `grep -n "inputs:" .github/workflows/deploy.yml` (no match — minimal trigger carries no inputs; inspection confirms `workflow_dispatch:` is bare), `grep -n "uses: ./.github/workflows/ci.yml" .github/workflows/deploy.yml` (match), `grep -n "environment: production" .github/workflows/deploy.yml` (≥1 match), `grep -n "id-token: write" .github/workflows/deploy.yml` (matches fall only inside the build-and-push/infra/deploy-services job permission blocks, never at workflow level — inspection note recorded in build-log-T1.md), `grep -E 'uses: .*@v[0-9]+' .github/workflows/deploy.yml` (no match), `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` (no match)
acceptance: AC-1, AC-2, AC-3, AC-7, AC-9
status: [x]

Edit only the `on:` block of `.github/workflows/deploy.yml`: replace `push: branches: [main]` with `workflow_dispatch` (no inputs — minimal, per D-2). Leave the `verify` job calling `ci.yml` via `workflow_call`, the `concurrency` group, `environment: production`, OIDC, SHA-pinned actions, and the job chain untouched. Record the before/after `on:` block, the actionlint output, the `id-token: write` grep output (with the deploy-job-scoping inspection note), and the bare-`workflow_dispatch`/no-`inputs:` check in `build-log-T1.md`.

## T2 — Document the manual-deploy policy `[seq]`
depends_on: T1
files_owned: `docs/architecture/deployment.md`, `README.md`
verify: `grep -n "workflow_dispatch" docs/architecture/deployment.md` (match), `grep -ni "single.*production\|staging" docs/architecture/deployment.md` (match stating the reason), `grep -n "workflow_dispatch\|manual" README.md` (match in Deployment section), `grep -ni "manual.*production\|only.*production environment" README.md` (match — reason phrase present), `grep -n "Push to \`main\`" README.md` (no match — old first step removed), `grep -n "push to \`main\`" docs/architecture/deployment.md` (no match — stale trigger wording removed), `git diff --stat` (only the two owned files plus build log)
acceptance: AC-5, AC-6
status: [x]

In `docs/architecture/deployment.md`: add a "Trigger policy" section stating deploy is triggered manually via `workflow_dispatch` only, that automatic deploy is deferred, and that the deferral is because only a single `production` environment exists (staging is a future additive recipe); generalize the "Double gate on `main`" section heading/wording to cover manual triggers (gates re-run on the selected ref before any deploy — deliberate). In `README.md` Deployment section: change the deploy flow's first step from "Push to `main`" to a manual `workflow_dispatch` trigger (Actions → Deploy → Run workflow), and add a note that CD is manual because only the `production` environment exists. Do not touch local-run instructions or any other section. Record greps in `build-log-T2.md`.

## T-final — Full verification sweep & evidence consolidation `[seq]`
depends_on: T1, T2
files_owned: `docs/features/manual-deploy-trigger/build-log-final-verification.md`
verify: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml` (exit 0), `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` (exit 0), `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 validate infra/terraform` (exit 0), `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace), `npm run build`, `grep -n "pull_request:\|branches: \[main\]\|workflow_call:" .github/workflows/ci.yml` (all present), `grep -n "id-token: write" .github/workflows/deploy.yml` (matches fall only inside the build-and-push/infra/deploy-services job permission blocks, never at workflow level — inspection note), `git diff --name-only` (only in-scope tracked files: `.github/workflows/deploy.yml`, `docs/architecture/deployment.md`, `README.md`, plus build logs), `git status --porcelain` (evidences the untracked build-log set; complements `git diff --name-only`, which covers only tracked files), `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` (no match)
acceptance: AC-1 through AC-10
status: [x]

Run the full verification suite end-to-end and record raw output in `build-log-final-verification.md`, then walk every AC (AC-1…AC-10) with met/unmet + evidence pointers. Feature is green to go only when every AC is met with reproducible evidence. No teardown of any running stack is part of this task. Document which command covers which file set: `git diff --name-only` covers the tracked in-scope files; `git status --porcelain` covers the untracked build-log files.