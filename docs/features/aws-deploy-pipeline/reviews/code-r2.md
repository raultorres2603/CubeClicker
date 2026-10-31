---
feature: aws-deploy-pipeline
phase: code
iteration: 2
verdict: approved
blocking: 0
nonblocking: 2
---

# Code Review — r2

## Summary

✅ approved — All round-1 BLOCKERs (F1 terraform CLI invocation order, F2 nonexistent task-definition JSON references) are fixed and independently reproduced: every terraform step now uses `working-directory: infra/terraform` (fmt/init/validate/plan/apply all exit 0 in the pinned container), `deploy-services` is reduced to a documented no-op note step with the ECS-deployment-via-Terraform rationale in `docs/architecture/deployment.md`, and `actionlint` exits 0 on both workflows. F3/F4/F5 are resolved/acceptable. The full gate suite is green (lint/typecheck/tests 630+1099/coverage 94.97/86.19/99.65/94.97 and 95.19/95.10/96.89/95.19/build/smoke 12/12). All 22 ACs met.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `infra/terraform/versions.tf`: `required_version = ">= 1.11.0"`, AWS provider `~> 6.0`, `aws_region` default `us-east-1`; `terraform fmt -check -recursive infra/terraform` exit 0 (wrapper). |
| AC-2 | ✅ | `podman run … terraform:1.15.9 init -backend=false` (via `-w /repo/infra/terraform`) exit 0 (root + bootstrap); `validate` exit 0 (root + bootstrap); no creds. |
| AC-3 | ✅ | `git ls-files '*.tfstate*' '*.tfplan*'` empty; no `.terraform/` tracked; only `infra/terraform/.terraform.lock.hcl` tracked; bootstrap untracked artifacts removed (F3). |
| AC-4 | ✅ | `infra/terraform/modules/edge/main.tf`: `idle_timeout = 90`; backend TG `path /healthz` matcher `200`; frontend TG `path /` matcher `200`; `/ws` routed to backend TG; no header-stripping policy. |
| AC-5 | ✅ | ECS backend task port 8080; env names `NODE_ENV=production`, `DATABASE_URL`, `MAX_USERS_PER_SERVER`, `APP_BASE_URL`, `ALLOWED_ORIGIN`, `SESSION_COOKIE_SECURE`, `SMTP_HOST/PORT/USER/PASS/FROM`; secrets via `valueFrom`. No secret literals. |
| AC-6 | ✅ | ECR repos `cubeclicker-backend`/`cubeclicker-frontend`; frontend service port 8080 default TG; image URIs SHA-tagged vars; no `latest`. |
| AC-7 | ✅ | data module: `engine_version = "16"`, `publicly_accessible = false`, `use_external_database_url` toggle; `manage_master_user_password = true`. |
| AC-8 | ✅ | OIDC IdP `token.actions.githubusercontent.com`; roles `GitHubActionsCubeCI` + `GitHubActionsCubeDeploy`; deploy trust `environment:production`; `grep aws_iam_access_key` empty. |
| AC-9 | ✅ | `backend.tf`: `key = "env/production/terraform.tfstate"`, `use_lockfile = true`; `envs/production.tfvars` `environment = "production"`; no dynamodb/staging. |
| AC-10 | ✅ | `ci.yml`: PR+push main+workflow_call; three jobs `verify-app`/`smoke-e2e`/`verify-infra`; Mailpit `up -d` before `run --rm smoke`; verify-infra uses `working-directory: infra/terraform` fmt/init/validate. |
| AC-11 | ✅ | workflow-level `permissions: contents: read`; no `id-token`; `setup-node` node 24 `cache: npm`; all `uses:` full-SHA pinned (`grep @v[0-9]+` empty). |
| AC-12 | ✅ | `deploy.yml`: push-to-main, concurrency `deploy-production`, verify via `workflow_call`, SHA-tagged images with `VITE_WS_URL` build-arg, OIDC deploy role, terraform init/plan/apply (all `working-directory: infra/terraform`), `deploy-services` retained as documented no-op (ECS handled by terraform apply per `deployment.md` § ECS service deployment mechanism). |
| AC-13 | ✅ | `environment: production` on build-and-push/infra/deploy-services; OIDC trust `environment:production`; documented in `deployment.md`. |
| AC-14 | ✅ | actionlint exit 0 on both workflows; dependabot github-actions weekly `ci:` prefix limit 5. |
| AC-15 | ✅ (caveat) | No workflow sets static AWS keys; `git grep -nE "AKIA\|aws_secret_access_key\|AWS_SESSION_TOKEN"` hits only documentation references in `docs/features/**` (review/build-log artifacts quoting the audit pattern) plus the prior feature's review — no credentials in src/infra/.github. |
| AC-16 | ✅ | `AGENTS.md` proof-of-working rule present; § Stack sentence amended to AWS+Terraform selected 2026-10-31. |
| AC-17 | ✅ | `builder.md` verify rule includes feature-appropriate proof + raw evidence. |
| AC-18 | ✅ | `reviewer.md` evidence rule reruns feature-appropriate proof; un-recorded/unreproducible = unmet. |
| AC-19 | ✅ | `orchestrator.md` + playbook proof-of-working gate; state set unchanged (8 states). |
| AC-20 | ✅ | web-implementation DoD recorded-verification item; code-review skill step 3 lists proof commands. |
| AC-21 | ✅ | `README.md` Deployment section; `docs/architecture/deployment.md` created (incl. new § ECS service deployment mechanism); containerization.md + stack.md provider-neutral amendments; no `no provider is chosen` remains. |
| AC-22 | ✅ | Route (a): `builder.md` permissions block has exactly two allow entries `infra/**` (line 68) and `.github/**` (line 71) before `.env*` deny. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F6 | INFO | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (end of file) | Both workflow files have no trailing newline (pre-existing; `\ No newline at end of file` in the r1 diff). | Optional: append a trailing newline for hygiene; not required for any AC (actionlint passes). | open |
| F7 | INFO | `docs/features/**` (review/build-log artifacts) | The credential-audit `git grep` now matches several documentation references to the audit pattern (the r2 build log and this review quote the pattern). These are documentation references, not credentials; `git grep` over `src/`/`infra/`/`.github/` is empty. | None; acceptable per AC-15 caveat. | open |

## Verification performed

- `podman run … actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` → exit 0.
- `podman run … terraform:1.15.9 fmt -check -recursive infra/terraform` → exit 0.
- `podman run … terraform:1.15.9 init -backend=false` (working form, `-w /repo/infra/terraform`) → exit 0 (root + bootstrap).
- `podman run … terraform:1.15.9 validate` (working form) → exit 0 (root + bootstrap).
- `git status --short -- infra/terraform/bootstrap/` → empty (F3: no untracked `.terraform/` or `.terraform.lock.hcl`).
- `grep -n "T-final" …/tasks.md` → `status: [x]` (F4).
- `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` over src/infra/.github → empty (F5: only docs references).
- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → backend 630/630, frontend 1099/1099, all pass.
- `npm run coverage` → exit 0; backend 94.97 stmts / 86.19 branches / 99.65 funcs / 94.97 lines; frontend 95.19 / 95.10 / 96.89 / 95.19 (all ≥ 80). Exclusions: test files + one composition-root entrypoint per workspace only.
- `npm run build` → exit 0.
- `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` then `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0.
- SHA-pin audit `grep -E 'uses: .*@v[0-9]+' …` → exit 1 (no matches).
- Inventory audit `git ls-files '*.tfstate*' '*.tfplan*'` empty; `git ls-files '*terraform.lock.hcl'` → only `infra/terraform/.terraform.lock.hcl`.
- AC-22 route audit `grep -n "infra/\*\*" … && grep -n ".github/\*\*" …` → lines 68 and 71 (exactly two entries).
- Framework contracts: 8 states unchanged in playbook; autonomy directive preserved; verdict/report formats unchanged.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No secrets committed; keyless OIDC; SHA-pinned actions; no static AWS keys in src/infra/.github; `.env*` untouched; container images provider-neutral; credential audit clean except doc references (F7). |
| Quality | ✅ | Workflows functional on pinned terraform (working-directory form); deploy-services documented no-op; deployment.md updated (F2). |
| Testing | ✅ | Coverage ≥ 80% all four metrics both workspaces; no TS changes by this feature; smoke 12/12; terraform/actionlint wrappers green. |

## Previous round verification (iteration 2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) BLOCKER — terraform invocation order | fixed | ci.yml + deploy.yml now use `working-directory: infra/terraform` for fmt/init/validate/plan/apply; wrapper fmt/init/validate all exit 0 (verified above and in commit 6749eb9). |
| F2 (r1) BLOCKER — nonexistent task-def JSON files | fixed | render/deploy steps removed; deploy-services reduced to a `Note` step; rationale documented in `docs/architecture/deployment.md` § ECS service deployment mechanism (commit 6749eb9). |
| F3 (r1) MINOR — untracked bootstrap artifacts | fixed | `git status --short -- infra/terraform/bootstrap/` empty; artifacts removed (commit 6749eb9). |
| F4 (r1) MINOR — T-final row `[ ]` | fixed | `tasks.md` T-final row now `status: [x]`. |
| F5 (r1) INFO — credential audit doc hit | acceptable | `git grep` over src/infra/.github empty; only docs/features/** references remain. |

## Notes / backlog (non-blocking)

- Trailing-newline hygiene in the two workflow files (F6) is optional; actionlint passes either way.
- The credential-audit count grew because the feature's own review/build-log artifacts quote the audit pattern (F7); no credentials are present.
- Framework contract consistency (8 states, no new state, autonomy directive, verdict/report formats) verified unchanged by the diff.