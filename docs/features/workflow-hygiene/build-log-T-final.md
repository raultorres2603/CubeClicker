# Build log — T-final — Full verification sweep & evidence consolidation

Task: T-final (2026-11-01)
Files changed: `docs/features/workflow-hygiene/build-log-T-final.md`
What changed & why: Ran the entire verification gate suite end-to-end (trailing-newline byte checks, actionlint over both workflow YAML files, Terraform fmt/validate regression guards, scoped credential audit, SHA-pin audit, deployment.md anchors, npm lint/typecheck/test/coverage/build, git diff/status) and recorded raw output; walked AC-1..AC-10 with met/unmet + evidence pointers. No application code, tests, compose, or Terraform changes.

Decisions: Terraform `validate` requires `init` first (modules not installed), so ran `init -backend=false` in the working directory `/repo/infra/terraform` then `validate` (working form, per the task's "use working form or -chdir" note); `fmt` ran as given with `-w /repo`. `git diff --name-only` shows only the orchestrator-owned `docs/features/README.md` index update (manual-deploy-trigger row) — unrelated to this feature; the three in-scope tracked files are evidenced via the T1/T2/T3 commits (see below), matching the manual-deploy-trigger T-final precedent.

Evidence:

## Trailing newline — ci.yml (AC-1)
Command: `tail -c 1 .github/workflows/ci.yml | od -An -tuC`
```
  10
```
Command: `tail -c 2 .github/workflows/ci.yml | od -An -tuC`
```
 101  10
```
(not `10  10`)

## Trailing newline — deploy.yml (AC-2)
Command: `tail -c 1 .github/workflows/deploy.yml | od -An -tuC`
```
  10
```
Command: `tail -c 2 .github/workflows/deploy.yml | od -An -tuC`
```
  34  10
```
(not `10  10`)

## actionlint (both workflows) (AC-3)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml`
```
EXIT=0
```

## terraform fmt -check -recursive (AC-4)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform`
```
EXIT=0
```

## terraform init -backend=false (AC-5)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false`
```
Terraform has been successfully initialized!
EXIT=0
```

## terraform validate (AC-5)
Command: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate`
```
Success! The configuration is valid.
EXIT=0
```

## deployment.md anchors (AC-6)
Command: `grep -F ":(exclude)docs/" docs/architecture/deployment.md`
```
- Credential audit (canonical scoped form): `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'`. The full unscoped command is not used because `docs/features/**` contains benign references to the audit pattern in prior feature review/build-log artifacts, which are not credentials; excluding `docs/` keeps the audit effective over all tracked non-doc files (`src/`, `infra/`, `.github/`, etc.).
EXIT=0 (match, line 59)
```
Command: `grep -n "docs/features/\*\*" docs/architecture/deployment.md`
```
59:- Credential audit (canonical scoped form): ... `docs/features/**` contains benign references ...
EXIT=0 (match, line 59)
```

## Scoped credential audit (AC-7)
Command: `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'`
```
(no output)
EXIT=1
```

## SHA-pin audit (AC-8)
Command: `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml`
```
(no output)
EXIT=1
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
backend: Test Files 21 passed (21); Tests 630 passed (630)
frontend: Test Files 44 passed (44); Tests 1099 passed (1099)
EXIT=0
```

## npm run coverage (AC-9)
Command: `npm run coverage`
```
backend: Test Files 21 passed (21); Tests 630 passed (630)
  All files          | 94.97 | 86.19 | 99.65 | 94.97 |
frontend: Test Files 44 passed (44); Tests 1099 passed (1099)
  All files          | 95.19 | 95.09 | 96.89 | 95.19 |
EXIT=0
```
Thresholds (≥ 80 statements/branches/functions/lines per workspace) met by both workspaces.

## npm run build
Command: `npm run build`
```
backend: tsc (exit 0)
frontend: vite build — ✓ 69 modules transformed; built in 1.35s
EXIT=0
```

## git diff --name-only (AC-10)
Command: `git diff --name-only`
```
docs/features/README.md
```
The only tracked diff line is the orchestrator-owned `docs/features/README.md` index update (manual-deploy-trigger row), which is outside this feature's scope and is not attributable to workflow-hygiene. The three in-scope tracked files were changed in the committed T1/T2/T3 commits and are evidenced below; no `src/**`, `tests/**`, `compose*`, Terraform, or agentic-framework files are changed.

## In-scope tracked files (committed in T1/T2/T3)
```
$ git show --stat --oneline 6258140
6258140 chore(workflow-hygiene): append trailing newline to ci.yml (T1)
 .github/workflows/ci.yml                       |  2 +-
 docs/features/workflow-hygiene/build-log-T1.md | 14 ++++++++++++++
$ git show --stat --oneline 147787c
147787c chore(workflow-hygiene): append trailing newline to deploy.yml (T2)
 .github/workflows/deploy.yml                   |  2 +-
 docs/features/workflow-hygiene/build-log-T2.md | 15 +++++++++++++++
$ git show --stat --oneline 8d503f4
8d503f4 docs: document scoped credential-audit command in deployment.md (T3)
 docs/architecture/deployment.md                |  1 +
 docs/features/workflow-hygiene/build-log-T3.md | 12 +++++++++++++
```

## git status --porcelain (AC-10)
Command: `git status --porcelain`
```
 M docs/features/README.md
?? docs/features/manual-deploy-trigger/plan.md
?? docs/features/manual-deploy-trigger/reviews/
?? docs/features/manual-deploy-trigger/spec.md
?? docs/features/manual-deploy-trigger/status.md
?? docs/features/manual-deploy-trigger/tasks.md
?? docs/features/workflow-hygiene/build-log-T-final.md
?? docs/features/workflow-hygiene/plan.md
?? docs/features/workflow-hygiene/reviews/
?? docs/features/workflow-hygiene/spec.md
?? docs/features/workflow-hygiene/status.md
?? docs/features/workflow-hygiene/tasks.md
```
Evidences the untracked build-log set under `docs/features/workflow-hygiene/` (this file) plus the orchestrator-owned feature artifacts; no `src/`, `tests/`, `compose*`, Terraform, or agentic-framework changes.

## AC walk (AC-1 .. AC-10)

| AC | Status | Evidence |
|---|---|---|
| AC-1 | met | `tail -c 1` → `10`; `tail -c 2` → `101  10` (not `10  10`). |
| AC-2 | met | `tail -c 1` → `10`; `tail -c 2` → `34  10` (not `10  10`). |
| AC-3 | met | actionlint over both workflows exit 0. |
| AC-4 | met | terraform fmt -check -recursive exit 0. |
| AC-5 | met | terraform init -backend=false exit 0; validate exit 0 ("Success!"). |
| AC-6 | met | `grep -F ":(exclude)docs/"` match (line 59); `grep -n "docs/features/\*\*"` match (line 59). |
| AC-7 | met | scoped `git grep` no output, exit 1. |
| AC-8 | met | `grep -E 'uses: .*@v[0-9]+'` no match (exit 1); SHA pins preserved. |
| AC-9 | met | `npm run coverage` exit 0; backend 94.97/86.19/99.65/94.97; frontend 95.19/95.09/96.89/95.19 (all ≥ 80). |
| AC-10 | met | `git diff --name-only` shows only orchestrator-owned `docs/features/README.md` (unrelated); T1/T2/T3 commits touch only `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `docs/architecture/deployment.md` (+ build logs); `git status --porcelain` evidences untracked build-log set; no `src/**`/`tests/**`/`compose*`/Terraform/agentic files changed. |

## Deviations from spec
none

## Final verdict
All 10 ACs met with reproducible evidence. Verification gate green (actionlint exit 0; terraform fmt/validate exit 0; lint/typecheck/test/coverage/build exit 0; coverage ≥ 80% per workspace; scoped credential audit clean; SHA pins preserved; trailing-newline byte checks pass). Feature is green to go. No stack teardown performed.
