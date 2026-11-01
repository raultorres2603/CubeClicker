# Build log — T-final — Full verification sweep & evidence consolidation

Task: T-final (2026-11-01)
Files changed: `docs/features/manual-deploy-trigger/build-log-final-verification.md`

What changed & why: Ran the entire verification gate suite end-to-end (actionlint over all workflow YAML, Terraform fmt/validate regression guards, npm lint/typecheck/test/coverage/build, trigger/contract greps, id-token/SHA-pin/credential audits, inventory audit, git diff/status) and recorded raw output; walked AC-1..AC-10 with met/unmet + evidence pointers. No application code, tests, compose, or Terraform changes.

Decisions: Terraform `validate` requires `init` first (modules not installed), so ran `init -backend=false` in the working directory `/repo/infra/terraform` then `validate` (working form, per the task's "use working form or -chdir" note); `fmt` ran as given with `-w /repo`. The literal `validate infra/terraform` positional form fails (modules not installed / no init) and is recorded as a failed attempt; the working form is the green gate. Credential audit `git grep` returns only documentation references in `docs/features/**` (prior feature artifacts quoting the audit pattern) — no credentials in `.github/`, `src/`, or `infra/`. `git diff --name-only` is empty because T1/T2 changes are already committed (99f9437, dee4c58); the in-scope tracked files are evidenced via `git show --stat` of those commits, and `git status --porcelain` evidences the untracked feature artifacts.

Evidence:

## actionlint (all workflows)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml`
```
EXIT=0
```

## actionlint (deploy.yml only)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml`
```
EXIT=0
```

## terraform fmt -check -recursive
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform`
```
EXIT=0
```

## terraform validate (literal positional form — recorded as attempted)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 validate infra/terraform`
```
Error: Module not installed ... (modules networking/ecr/data/edge/cicd_iam/ecs not installed; terraform init required)
EXIT=1
```

## terraform init -backend=false (working form)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false`
```
Initializing modules...
- networking in modules/networking
- ecr in modules/ecr
- data in modules/data
- edge in modules/edge
- cicd_iam in modules/cicd-iam
- ecs in modules/ecs
Initializing provider plugins...
- Reusing previous version of hashicorp/aws from the dependency lock file
- Installing hashicorp/aws v6.71.0...
Terraform has been successfully initialized!
EXIT=0
```

## terraform validate (working form)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate`
```
Success! The configuration is valid.
EXIT=0
```

## npm run lint
Command: `npm run lint`
```
> lint
> eslint .
EXIT=0
```

## npm run typecheck
Command: `npm run typecheck`
```
> typecheck
> npm run typecheck --workspaces --if-present
> typecheck
> tsc --noEmit
> typecheck
> tsc --noEmit
EXIT=0
```

## npm test
Command: `npm test`
```
> test
> npm run test --workspaces --if-present
backend: Test Files 21 passed (21); Tests 630 passed (630); Duration 2.01s
frontend: Test Files 44 passed (44); Tests 1099 passed (1099); Duration 1.71s
EXIT=0
```

## npm run coverage
Command: `npm run coverage`
```
backend: Test Files 21 passed (21); Tests 630 passed (630)
  All files          | 94.97 | 86.19 | 99.65 | 94.97 |
frontend: Test Files 44 passed (44); Tests 1099 passed (1099)
  All files          | 95.19 | 95.10 | 96.89 | 95.19 |
EXIT=0
```
Thresholds (≥ 80 statements/branches/functions/lines per workspace) met by both workspaces.

## npm run build
Command: `npm run build`
```
> build
> npm run build --workspaces --if-present
backend: tsc (exit 0)
frontend: vite build — ✓ 69 modules transformed; built in 1.32s
EXIT=0
```

## ci.yml trigger anchors
Command: `grep -n "pull_request:\|branches: \[main\]\|workflow_call:" .github/workflows/ci.yml`
```
4:  pull_request:
6:    branches: [main]
7:  workflow_call:
EXIT=0
```

## deploy.yml AC anchors
Command: `grep -n "workflow_dispatch" .github/workflows/deploy.yml`
```
4:  workflow_dispatch
EXIT=0
```
Command: `grep -n "push:" .github/workflows/deploy.yml`
```
18:  build-and-push:
```
(Only the pre-existing job id `build-and-push:` matches; no trigger-level `push:` key remains — documented false positive, per build-log-T1.)

Command: `grep -n "inputs:" .github/workflows/deploy.yml`
```
(no match, exit 1) — minimal trigger carries no inputs; workflow_dispatch is bare
```
Command: `grep -n "uses: ./.github/workflows/ci.yml" .github/workflows/deploy.yml`
```
16:    uses: ./.github/workflows/ci.yml
EXIT=0
```
Command: `grep -n "environment: production" .github/workflows/deploy.yml`
```
26:    environment: production
70:    environment: production
108:    environment: production
EXIT=0
```
Command: `grep -n "id-token: write" .github/workflows/deploy.yml`
```
25:      id-token: write
69:      id-token: write
107:      id-token: write
```
All three fall inside the build-and-push / infra / deploy-services job permission blocks; workflow-level `permissions:` (line 10-12) is `contents: read` only. Inspection note recorded.

Command: `grep -E 'uses: .*@v[0-9]+' .github/workflows/deploy.yml`
```
(no match, exit 1) — full-SHA pins only
```

## deployment.md anchors
Command: `grep -n "workflow_dispatch" docs/architecture/deployment.md`
```
28:- Single deploy environment: `production`. Manual trigger (`workflow_dispatch`) → ...
62:- Deploy is triggered **manually** via `workflow_dispatch` only. ...
EXIT=0
```
Command: `grep -ni "single.*production\|staging" docs/architecture/deployment.md` (reason phrase)
```
3:... (AWS + Terraform, single `production` environment). ...
28:- Single deploy environment: `production`. ...
29:- Staging is deliberately not shipped. Additive recipe ...
63:- Automatic deploy is **deferred**. The reason is that only a single `production` environment exists: auto-deploying from a merge while no staging environment exists to absorb regressions is not acceptable. ...
EXIT=0
```
Command: `grep -n "push to \`main\`" docs/architecture/deployment.md`
```
(no match, exit 1) — stale trigger wording removed
```

## README.md anchors
Command: `grep -n "workflow_dispatch\|manual" README.md`
```
105:- `deploy.yml` (manual, via `workflow_dispatch`): ...
109:1. Trigger manually via `workflow_dispatch` (Actions → Deploy → Run workflow), selecting the ref to deploy ...
115:Note: continuous deployment (CD) is manual because only the `production` environment exists; ...
EXIT=0
```
Command: `grep -ni "manual.*production\|only.*production environment" README.md` (reason phrase)
```
115:Note: continuous deployment (CD) is manual because only the `production` environment exists; automatic deploy is deferred until a staging environment is added.
EXIT=0
```
Command: `grep -n "Push to \`main\`" README.md`
```
(no match, exit 1) — old first step removed
```

## Credential audit
Command: `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` (full tracked tree)
```
docs/features/aws-deploy-pipeline/build-log-final-verification.md:511:... (audit-pattern quote)
docs/features/aws-deploy-pipeline/reviews/code-r1.md:... (audit-pattern quote)
docs/features/aws-deploy-pipeline/reviews/code-r2.md:... (audit-pattern quote)
docs/features/aws-deploy-pipeline/spec.md:... (audit-pattern quote)
docs/features/aws-deploy-pipeline/tasks.md:... (audit-pattern quote)
docs/features/manual-deploy-trigger/build-log-T1.md:19:... (audit-pattern quote)
EXIT=0 (documentation references only)
```
Scoped to `.github/`, `src/`, `infra/`: no matches (exit 1 each). No credentials present; workflow `.github/workflows/deploy.yml` uses OIDC only.

## Inventory / state audit
Command: `git ls-files '*.tfstate*' '*.tfplan*'` then `git ls-files '*terraform.lock.hcl'`
```
=== tfstate/tfplan ===
(no output)
=== lockfiles ===
infra/terraform/.terraform.lock.hcl
```
EXIT=0

## git diff --name-only (tracked in-scope files)
Command: `git diff --name-only`
```
(no output — empty; T1 and T2 changes are already committed)
```
In-scope tracked files were changed in commits `99f9437` (deploy.yml) and `dee4c58` (deployment.md + README.md). Evidence:
```
$ git show --stat --oneline 99f9437
99f9437 feat(manual-deploy-trigger): switch deploy.yml trigger to workflow_dispatch only (T1)
 .github/workflows/deploy.yml | 4 ++--
$ git show --stat --oneline dee4c58
dee4c58 docs(manual-deploy-trigger): document manual-deploy policy (T2)
 README.md                       |  6 ++++--
 docs/architecture/deployment.md | 13 ++++++++++---
```
Plus the tracked build logs `docs/features/manual-deploy-trigger/build-log-T1.md` and `build-log-T2.md`.

## git status --porcelain (untracked set)
Command: `git status --porcelain`
```
?? docs/features/manual-deploy-trigger/plan.md
?? docs/features/manual-deploy-trigger/reviews/
?? docs/features/manual-deploy-trigger/reviews/spec-r1.md
?? docs/features/manual-deploy-trigger/reviews/spec-r2.md
?? docs/features/manual-deploy-trigger/spec.md
?? docs/features/manual-deploy-trigger/status.md
?? docs/features/manual-deploy-trigger/tasks.md
```
(The new `build-log-final-verification.md` appears here once written; `.terraform/` is gitignored.)

## AC walk (AC-1 .. AC-10)

| AC | Status | Evidence |
|---|---|---|
| AC-1 | met | `grep -n "workflow_dispatch"` → line 4 match; `grep -n "push:"` → only `build-and-push:` job id (no trigger key); `grep -n "inputs:"` → no match (bare `workflow_dispatch`). |
| AC-2 | met | `grep -n "uses: ./.github/workflows/ci.yml"` → line 16 match. |
| AC-3 | met | `grep -n "environment: production"` → lines 26, 70, 108 (≥1). |
| AC-4 | met | `grep -n "pull_request:\|branches: \[main\]\|workflow_call:"` on ci.yml → lines 4, 6, 7. |
| AC-5 | met | deployment.md: `grep -n "workflow_dispatch"` match (lines 28, 62); reason phrase `single.*production\|staging` match (line 63 states only a single `production` environment exists; automatic deploy deferred). |
| AC-6 | met | README: `grep -n "workflow_dispatch\|manual"` match (lines 105, 109, 115); reason phrase `manual.*production\|only.*production environment` match (line 115); old first step `Push to main` removed (`grep` exit 1). |
| AC-7 | met | actionlint over `.github/workflows/*.yml` exit 0 (and deploy.yml alone exit 0). |
| AC-8 | met | terraform fmt -check -recursive exit 0; terraform init -backend=false + validate exit 0 (no Terraform changes in this feature). |
| AC-9 | met | `grep -E 'uses: .*@v[0-9]+'` on deploy.yml exit 1 (SHA pins only); `id-token: write` scoped to deploy jobs (lines 25, 69, 107; workflow-level permissions = contents: read); credential audit clean in `.github/`/`src/`/`infra/`. |
| AC-10 | met | `git diff --name-only` shows no tracked out-of-scope files; T1/T2 commits touch only `.github/workflows/deploy.yml`, `docs/architecture/deployment.md`, `README.md` (plus build logs); `git status --porcelain` evidences the untracked feature artifacts (spec/plan/status/tasks/reviews + build log). No src/tests/compose/Terraform changes. |

## Deviations from spec
none

## Final verdict
All 10 ACs met with reproducible evidence. Verification gate green (actionlint exit 0; terraform fmt/validate exit 0; lint/typecheck/test/coverage/build exit 0; coverage ≥ 80% per workspace; credential audit clean in in-scope trees; inventory audit clean). Feature is green to go. No stack teardown performed.