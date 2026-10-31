---
feature: aws-deploy-pipeline
phase: code
iteration: 1
verdict: changes_requested
blocking: 2
nonblocking: 3
---

# Code Review — r1

## Summary

❌ changes requested — The host-side verification suite is green (lint/typecheck/tests/coverage/build/smoke 12/12/terraform fmt+init+validate/actionlint all pass; coverage backend 94.97/86.19/99.65/94.97, frontend 95.19/95.09/96.89/95.19), but the committed GitHub Actions workflows contain two functional defects that would make the deploy pipeline fail on the GitHub-hosted runners: (1) Terraform CLI invocation order (`-flag … positional-dir`) is rejected by terraform 1.15.9, and (2) `deploy-services` references task-definition JSON files that do not exist in the repository. Both are BLOCKERs against AC-10/AC-12.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `infra/terraform/versions.tf`: `required_version = ">= 1.11.0"`, AWS provider `~> 6.0`, `aws_region` default `us-east-1`; `terraform fmt -check -recursive infra/terraform` exit 0 (wrapper). |
| AC-2 | ✅ (HCL) / ⚠️ (pinned wrapper form) | `terraform init -backend=false` + `validate` succeed for root and `bootstrap/` via `-w /repo/infra/terraform` (and `-chdir=`); the literal pinned form `podman run … init -backend=false infra/terraform` fails on terraform 1.15.9 ("Too many command line arguments") — see F1. |
| AC-3 | ✅ | `git ls-files '*.tfstate*' '*.tfplan*'` empty; no `.terraform/` tracked; only `infra/terraform/.terraform.lock.hcl` tracked. (Untracked `bootstrap/.terraform.lock.hcl` exists locally from init — recommend gitignoring/removing.) |
| AC-4 | ✅ | `infra/terraform/modules/edge/main.tf`: `idle_timeout = 90`; backend TG `path /healthz` matcher `200`; frontend TG `path /` matcher `200`; `/ws` routed to backend TG; no header-stripping policy. |
| AC-5 | ✅ | ECS backend task port 8080; env names `NODE_ENV=production`, `DATABASE_URL`, `MAX_USERS_PER_SERVER`, `APP_BASE_URL`, `ALLOWED_ORIGIN`, `SESSION_COOKIE_SECURE`, `SMTP_HOST/PORT/USER/PASS/FROM`; secrets via `valueFrom`. No secret literals. |
| AC-6 | ✅ | ECR repos `cubeclicker-backend`/`cubeclicker-frontend`; frontend service port 8080 default TG; image URIs are SHA-tagged vars; no `latest` in task defs. |
| AC-7 | ✅ | data module: `engine_version = "16"`, `publicly_accessible = false`, `use_external_database_url` toggle; `manage_master_user_password = true`. |
| AC-8 | ✅ | OIDC IdP `token.actions.githubusercontent.com`; roles `GitHubActionsCubeCI` + `GitHubActionsCubeDeploy`; deploy trust `environment:production`; `grep aws_iam_access_key` empty. |
| AC-9 | ✅ | `backend.tf`: `key = "env/production/terraform.tfstate"`, `use_lockfile = true`; `envs/production.tfvars` `environment = "production"`; no dynamodb/staging. |
| AC-10 | ❌ | ci.yml structure matches (PR+push main+workflow_call; three jobs; Mailpit `up -d` before `run --rm smoke`; verify-infra fmt/init/validate), but the init command `terraform init -backend=false infra/terraform` fails on terraform 1.15.9 (F1). Job cannot pass as written. |
| AC-11 | ✅ | workflow-level `permissions: contents: read`; no `id-token`; `setup-node` node 24 `cache: npm`; all `uses:` full-SHA pinned (grep `@v[0-9]+` empty). |
| AC-12 | ❌ | deploy.yml push-to-main, concurrency, verify via workflow_call, SHA-tagged images with `VITE_WS_URL` build-arg, OIDC deploy role, terraform init/plan/apply, deploy services — but init/plan commands use failing flag-first order (F1) and deploy-services references nonexistent `infra/ecs/*-task-definition.json` (F2). |
| AC-13 | ✅ | `environment: production` on build-and-push/infra/deploy-services; OIDC trust `environment:production`; documented in `docs/architecture/deployment.md`. |
| AC-14 | ✅ | actionlint exit 0 on both workflows; dependabot github-actions weekly `ci:` prefix limit 5. |
| AC-15 | ✅ (caveat) | No workflow sets static AWS keys; raw `git grep -nE "AKIA\|aws_secret_access_key\|AWS_SESSION_TOKEN"` returns one line, but it is a documentation reference to the audit pattern in `docs/features/containerized-workflow/reviews/code-r1.md`, not a credential (out of scope to edit). |
| AC-16 | ✅ | AGENTS.md proof-of-working rule present; § Stack sentence amended to AWS+Terraform selected 2026-10-31. |
| AC-17 | ✅ | builder.md verify rule includes feature-appropriate proof + raw evidence. |
| AC-18 | ✅ | reviewer.md evidence rule reruns feature-appropriate proof; un-recorded/unreproducible = unmet. |
| AC-19 | ✅ | orchestrator.md + playbook proof-of-working gate; state set unchanged. |
| AC-20 | ✅ | web-implementation DoD recorded-verification item; code-review skill step 3 lists proof commands. |
| AC-21 | ✅ | README Deployment section; `docs/architecture/deployment.md` created; containerization.md + stack.md amended; no `no provider is chosen` remains. |
| AC-22 | ✅ | Route (a): builder.md permissions block has exactly two allow entries `infra/**` and `.github/**` before the `.env*` deny. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | `.github/workflows/ci.yml:58-60` (verify-infra init/validate steps); `.github/workflows/deploy.yml:78-82` (infra init/plan/validate steps) | Terraform 1.15.9 rejects `terraform init -backend=false infra/terraform` ("Too many command line arguments") when the global flag precedes the positional directory; only `terraform init infra/terraform -backend=false` (positional first) or `-chdir=infra/terraform` works. The same applies to `terraform init -backend-config … infra/terraform`, `terraform validate infra/terraform` (modules not installed because init never ran in that dir), and `terraform plan … -out=tfplan infra/terraform`. Empirically verified in the pinned container. The CI verify-infra job and the deploy infra job would fail on the first run. | Reorder every terraform invocation to positional-first (e.g. `terraform init infra/terraform -backend=false`, `terraform init infra/terraform -backend-config …`, `terraform validate infra/terraform` after a successful init in the same step, `terraform plan infra/terraform … -out=tfplan`) or set `working-directory: infra/terraform` on the steps and drop the positional arg. Update the pinned AC command forms correspondingly. | open |
| F2 | BLOCKER | `.github/workflows/deploy.yml:108-125` (deploy-services job) | `amazon-ecs-render-task-definition` is given `task-definition: infra/ecs/backend-task-definition.json` (and frontend), but no such files exist in the repository — task definitions are Terraform-managed (`aws_ecs_task_definition` in `infra/terraform/modules/ecs/main.tf`). The render step fails (file not found) and the whole deploy-services job cannot run. | Either commit JSON task-definition templates (and reconcile them with the Terraform-managed definitions to avoid drift) or remove the render/deploy-task-definition steps and rely on `terraform apply` (which already updates task defs and services via the image URI vars), documenting the choice in `docs/architecture/deployment.md`. | open |
| F3 | MINOR | `infra/terraform/bootstrap/` (local working tree) | An untracked `bootstrap/.terraform.lock.hcl` was generated by the local `init` run. It is not committed (AC-3 passes), but it is unignored noise that could be accidentally staged. | Add `infra/terraform/bootstrap/.terraform/` (already ignored) and confirm the bootstrap lockfile stays untracked, or remove the local artifact; document the init recipe uses `-backend=false` without committing a bootstrap lockfile. | open |
| F4 | MINOR | `docs/features/aws-deploy-pipeline/tasks.md` (T-final row) | T-final's status is still `[ ]` in `tasks.md` even though `status.md` and the build log record completion. Cosmetic bookkeeping drift. | Update T-final to `[x]` (orchestrator-owned hygiene) or leave to the acceptance doc pass. | open |
| F5 | INFO | `docs/features/containerized-workflow/reviews/code-r1.md:67` | The single `git grep` credential-audit hit is a documentation reference to the audit pattern in a prior feature's review artifact, not a credential. Acceptable as the spec's AC-15 caveat states; no action needed. | None. | open |

## Verification performed

- `npm ci` → exit 0 (399 packages).
- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → backend 630/630, frontend 1099/1099, all pass.
- `npm run coverage` → exit 0; backend 94.97 stmts / 86.19 branches / 99.65 funcs / 94.97 lines; frontend 95.19 / 95.09 / 96.89 / 95.19 (all ≥ 80). Exclusions: test files + one composition-root entrypoint per workspace only (`server.ts`, `main.tsx`) — justified.
- `npm run build` → exit 0.
- `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` then `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0; stack left running.
- `podman run … terraform:1.15.9 fmt -check -recursive infra/terraform` → exit 0.
- `podman run … terraform:1.15.9 init -backend=false` (via `-w /repo/infra/terraform` and `-chdir=`) → exit 0 (root + bootstrap).
- `podman run … terraform:1.15.9 validate` (via `-w`/`-chdir=`) → exit 0 (root + bootstrap).
- `podman run … actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` → exit 0.
- SHA-pin audit `grep -E 'uses: .*@v[0-9]+' …` → no matches (exit 1).
- Credential audit `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` → one documentation-only hit (F5).
- Inventory audit `git ls-files '*.tfstate*' '*.tfplan*'` empty; `git ls-files '*terraform.lock.hcl'` → only `infra/terraform/.terraform.lock.hcl`.
- AC-22 route audit `grep -n "infra/\*\*" .opencode/agents/builder.md && grep -n ".github/\*\*" …` → exactly two entries (lines 68, 71).
- Pinned wrapper form check: `podman run … terraform:1.15.9 init -backend=false infra/terraform` → exit 1 ("Too many command line arguments") — recorded as F1.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No secrets committed; keyless OIDC; SHA-pinned actions; no static AWS keys; `.env*` untouched; container images provider-neutral; credential audit clean except doc reference (F5). |
| Quality | ❌ | Workflows are non-functional on the pinned terraform (F1); deploy-services references missing files (F2). |
| Testing | ✅ | Coverage ≥ 80% all four metrics both workspaces; no banned matchers introduced by this feature (no TS changes); smoke 12/12; terraform/actionlint wrappers green. |

## Previous round verification (if iteration > 1)

n/a — first code review round.

## Notes / backlog (non-blocking)

- The HCL itself is valid and `fmt`/`init`/`validate` all pass via `-w`/`-chdir`; only the *workflow invocation order* is broken.
- The `deploy-services` job is redundant with `terraform apply` (which updates task defs/services via image URI vars); simplifying it removes F2 and avoids JSON drift.
- Framework contract consistency (8 states, no new state, autonomy directive, verdict/report formats) was verified by the spec review (r3) and the committed `.opencode` edits match the pinned contracts; no regression observed in the diff.