---
feature: aws-free-tier-infra
revision: 1
status: draft
created: 2026-11-12
updated: 2026-11-12
---
# Spec — AWS Free-Tier Infra (single-VM deploy)

## Summary

Adapt the AWS deployment created by `aws-deploy-pipeline` (ECS Fargate + ALB + RDS by default) to the AWS free tier: a single EC2 instance (`t3.micro`, with `t2.micro` as the documented alternate) in a **public** subnet with an Elastic IP, a security group exposing 22/80/443, and user-data that installs Docker + the compose plugin and starts the `db` / `backend` / `frontend` / `caddy` stack. The default database becomes containerized Postgres on the VM; RDS `db.t3.micro` is retained only as an opt-in alternative behind `enable_rds` (default `false`). Fargate, the ALB, the NAT Gateway, and the default RDS path are removed. ECR (500 MB free), the S3 remote-state bucket (5 GB free), and CloudWatch (5 GB free) are retained. The ALB is replaced by Caddy as the reverse proxy — Let's Encrypt TLS with WebSocket passthrough whose idle timeout is strictly greater than 2× the backend's 30 s heartbeat. `ci.yml` is unchanged; `deploy.yml` switches from ECS register/update to SSM `send-command` restarting compose on the VM. The manual-deploy trigger policy (`workflow_dispatch` only) from `manual-deploy-trigger` still applies. No application code changes; only Terraform, the CD workflow YAML, and docs. This spec consolidates the r1 review findings (F1–F11) and their r2 resolutions, plus the cheap r2 non-blocking nits (F12–F16), into a single corrected draft; it is the approved-r2-equivalent and is not re-run through an r1→r2 cycle.

### Raw request (verbatim, scope boundary)

> "I would like you to adapt our infra creation to be based on free tier"

## Scope

### In scope

1. **Terraform infrastructure (`infra/terraform/`)** — rework the deploy target to a single free-tier VM:
   - Remove `modules/edge/`, `modules/ecs/`, the default RDS block in `modules/data/`, and the NAT Gateway in `modules/networking/` (F1, F11).
   - Add a single EC2 module: instance type `t3.micro` (default) / `t2.micro` (alternate), public subnet, Elastic IP, security group (22/80/443), user-data installing Docker + compose plugin and starting `db`/`backend`/`frontend`/`caddy`, IAM instance profile with least-privilege ECR pull.
   - Containerized Postgres on the VM by default; RDS `db.t3.micro` retained as an opt-in behind `enable_rds` (default `false`) (F4).
   - Caddy reverse proxy config (Let's Encrypt TLS, WebSocket passthrough, idle timeout > 2× 30 s heartbeat) — shipped as infra-managed config, not a repo compose change.
   - Keep ECR, S3 remote state, CloudWatch.
2. **GitHub Actions CI/CD (`.github/workflows/`)** — `ci.yml` unchanged; `deploy.yml` switches to SSM `send-command` to restart compose on the VM; manual-deploy trigger policy retained.
3. **Documentation** — `deployment.md`, `README.md`, `containerization.md` (and the provider-choice sentence in `stack.md`/`AGENTS.md`) updated to reflect the single-VM free-tier target; container images remain provider-neutral.

### Explicitly out of scope

- Any application code change: `src/**` (except none), `tests/e2e/**`, `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile` are read-only. The VM's compose stack is infra-managed (rendered/shipped under `infra/`), not the repo's dev compose files.
- Running `terraform apply` against a real AWS account during this feature (verification boundary — see § Testing strategy).
- Provider porting beyond AWS; no multi-provider abstractions.
- DNS/Route53/custom domains/ACM purchases, CloudFront, multi-region, cross-account bootstrapping.
- Second deploy environment (staging) — deferred additive recipe (unchanged from `aws-deploy-pipeline`).
- Changes to the local dev path (`podman compose up`, hot reload, `npm run dev`, `npm run smoke`).
- New state-machine states or checkpoints.

## User stories

- As the project owner, I want the AWS deployment to fit the free tier so running it costs ~$0/month while learning.
- As the project owner, I want the container images (provider-neutral) to run unchanged on the VM.
- As the developer, I want every deploy gated by the unchanged CI gates plus infra verification.
- As the developer, I want deploys to restart the VM's compose stack via SSM, with no ECS/ALB/RDS defaults.
- As the reviewer, I want the legacy (Fargate/ALB/NAT/RDS-default) modules gone with grep-verifiable evidence.

## Acceptance criteria

Verification conventions: commands from the repository root. Terraform checks use the pinned containerized Podman wrappers (C-1). Config/content ACs are verified by inspection with `grep`/`git diff` anchors cited in build logs.

- **AC-1** — `infra/terraform/versions.tf` declares `required_version >= 1.11`, the AWS provider (`hashicorp/aws ~> 6.0`), **and** `hashicorp/random ~> 3.6` (F3); the pinned wrapper `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` exits 0 and `... init -backend=false infra/terraform` + `... validate infra/terraform` exit 0 with no AWS credentials.
- **AC-2** — Legacy modules removed: `infra/terraform/modules/edge/` and `infra/terraform/modules/ecs/` do not exist; `modules/networking/` contains no `aws_nat_gateway`; `modules/data/` provisions no RDS by default (`enable_rds` defaults `false`); `grep -rn "aws_lb\|aws_ecs_cluster\|aws_nat_gateway" infra/terraform/modules/edge infra/terraform/modules/ecs infra/terraform/modules/networking` returns empty (paths may be absent) (F1, F11).
- **AC-3** — No Terraform state, plan artifacts, or `.terraform/` directories committed: `git ls-files '*.tfstate*' '*.tfplan*'` returns empty and `git ls-files | grep -E '(^|/)\.terraform/'` returns empty (the `.terraform.lock.hcl` is committed by design).
- **AC-4** — A single EC2 instance resource exists with instance type defaulting to `t3.micro` (alternate `t2.micro` selectable via variable), placed in a public subnet, with an Elastic IP attached, and an IAM instance profile granting ECR pull; anchors: `grep -n "aws_instance" infra/terraform/modules/ec2/*.tf`, `grep -n "aws_eip" infra/terraform/modules/ec2/*.tf`, `grep -n "aws_iam_instance_profile" infra/terraform/modules/ec2/*.tf`.
- **AC-5** — Security group allows ingress 22 (from `admin_cidr` only), 80 and 443 (from `0.0.0.0/0`); anchors: `grep -n "from_port.*22\|to_port.*22" ...`, ports 80/443 present.
- **AC-6** — Caddy reverse-proxy configuration is present (infra-managed) with Let's Encrypt TLS and WebSocket passthrough: no `header_up` directive drops `Upgrade`/`Connection`, and a `flush_interval`/idle-timeout anchor greater than 60 s; concrete anchors: `! grep -nE 'header_up[[:space:]]+-(Upgrade|Connection)' <caddyfile>`, `grep -nE 'flush_interval|idle_timeout' <caddyfile>` showing a value > 60, and `grep -n "tls" <caddyfile>` (F6).
- **AC-7** — User-data installs Docker + the compose plugin and starts the `db`, `backend`, `frontend`, `caddy` services; anchors: `grep -nE 'dnf|yum' ...` docker install, `grep -n "compose" ...` plugin, `grep -nE 'db|backend|frontend|caddy' ...` service names (F9).
- **AC-8** — IAM instance profile is least-privilege for ECR pull (and SSM managed-instance core for `send-command`): policy allows only `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage` scoped to the two repos, plus `AmazonSSMManagedInstanceCore`; no wildcard `*` resource on ECR actions beyond the pinned repo ARNs; anchor: `grep -n "ecr:" infra/terraform/modules/ec2/*.tf`.
- **AC-9** — `admin_cidr` is a required variable with no open default and rejects `0.0.0.0/0` and empty values via validation; anchor: `grep -n "admin_cidr" infra/terraform/variables.tf` with no `default` and a `validation` block (F7).
- **AC-10** — `ci.yml` is unchanged: `git diff --exit-code .github/workflows/ci.yml` exits 0 (F5).
- **AC-11** — `deploy.yml` uses SSM `send-command` to restart the compose stack on the VM (not ECS register/update); anchors: `grep -n "send-command\|AWS-RunShellScript" .github/workflows/deploy.yml` and absence of `amazon-ecs-deploy-task-definition` / `register-task-definition`.
- **AC-12** — Manual-deploy trigger policy retained: `deploy.yml` triggers on `workflow_dispatch` only (no push-to-main auto-deploy); anchor: `grep -n "workflow_dispatch" .github/workflows/deploy.yml` and no `on: push` auto-deploy of infra.
- **AC-13** — Scoped credential audit: `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` returns empty (F2).
- **AC-14** — Real-time/WebSocket: Caddy passes WebSocket upgrades end-to-end (no header stripping, idle timeout > 2× 30 s heartbeat); documented in `deployment.md`; the frontend `VITE_WS_URL` bake and heartbeat contract are unchanged.
- **AC-15** — Containerization: container images remain provider-neutral deployables; the deploy target is documented as the single-VM free-tier (AWS) in `containerization.md` § Deployment neutrality; anchor: `grep -n "provider-neutral" docs/architecture/containerization.md`.
- **AC-16** — Meaningful anchor present in docs: `grep -n "free-tier\|single-VM\|t3.micro" docs/architecture/deployment.md docs/architecture/containerization.md README.md` returns matches (F10).
- **AC-17** — RDS opt-in: `enable_rds` variable defaults `false`; when `true`, provisions RDS `db.t3.micro`; containerized Postgres on the VM is the default; anchor: `grep -n "enable_rds" infra/terraform/variables.tf infra/terraform/modules/data/*.tf` (F4).
- **AC-18** — Documentation targets updated: `README.md` Deployment section, `docs/architecture/deployment.md` (single-VM/free-tier conventions), `docs/architecture/containerization.md` (deferral resolution + neutrality amendment), `docs/architecture/stack.md` (provider-choice sentence amended) — each with recorded grep evidence (F12–F16 nits).
- **AC-19** — Final disposition of legacy modules documented in D-5 and the file inventory (deleted: `modules/edge/`, `modules/ecs/`, default RDS block, NAT Gateway); anchor: `grep -n "removed\|deleted\|legacy" docs/features/aws-free-tier-infra/plan.md` (F11).

## Non-goals

- No application code, tests, build config, or dependency changes. `src/**`, `tests/e2e/**`, both compose files, both Dockerfiles, `package.json`, lockfiles stay read-only.
- No real AWS deployment during this feature (verification boundary).
- No other cloud providers, no multi-cloud abstractions, no CloudFront/CDN, no DNS/domain/cert provisioning, no multi-region.
- No second deploy environment (staging deferred, additive recipe unchanged).
- No changes to the local dev path.
- No new state-machine states or checkpoints.
- No production SMTP/mail provider decisions (inherited open question).

## Boundaries

- ✅ Always: keep the local Podman/compose dev path untouched; record every build's verify evidence (including `npm run coverage` for TS surfaces and the containerized `terraform fmt/validate` + `actionlint` evidence for config tasks) in `build-log-<taskid>.md`; keep all infrastructure values named in plan.md § Interfaces / contracts verbatim; treat `AGENTS.md`, `.opencode/**`, and `README.md` as shared user-owned config (editor-diff discipline); run every task so the tree stays `validate`-green at its commit; run the scoped credential audit (AC-13).
- ⚠️ Ask first: the ⚠️ deletion approval for T1 (modules/edge, modules/ecs, default RDS block, NAT Gateway) — user approval required before T1 runs (F1, F8); any workflow step beyond the pinned set; changing instance sizing (t3.micro/t2.micro), admin_cidr semantics, or any configuration value in plan.md § Interfaces / contracts; creating GitHub repository variables, environments, or protection rules (user-side clicks); including `tflint`/`yamllint` (default: not).
- 🚫 Never: run `terraform apply`/`destroy` against any real AWS account during this feature; commit secrets, keys, `.env*`, or Terraform state; edit `src/**`, `tests/e2e/**`, `compose*`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`; weaken the coverage gate; rewrite the agentic framework's gate semantics; modify any agent `permissions:` block; git push; leave the legacy modules in place.

## Security considerations

- **Keyless CI/CD retained.** All AWS auth from GitHub Actions uses OIDC via `aws-actions/configure-aws-credentials`; no long-lived keys. Trust conditions constrain roles to the repository and (for deploy) `environment:production`. The scoped audit (AC-13) is `git grep`-verifiable over tracked non-doc files.
- **Least-privilege instance profile.** The EC2 instance profile grants only ECR pull on the two repos plus `AmazonSSMManagedInstanceCore` for `send-command`; no broad `*` resources. Task/execution IAM breadth is removed along with Fargate.
- **Secrets and state.** No secret values authored in the repository. The containerized Postgres password (when used) is generated via `random_password` and stored as an SSM SecureString provisioned out-of-band; the VM's compose env references it. Terraform state is encrypted/versioned/non-public; `.gitignore` covers `*.tfstate*`/plan files; the committed provider lockfile is reproducibility, not state.
- **Supply chain.** Every third-party action is pinned to a full commit SHA with a version comment; Dependabot tracks `github-actions`; the two verification-tool images are pinned to stable tags (D-13 of the prior feature, carried).
- **No `.env*` interaction.** Runtime configuration travels through environment variables/secrets in the compose stack; no agent writes `.env*`.
- **Real-time surface.** The deployed edge (Caddy) must preserve WebSocket upgrades (no request-policy stripping, idle timeout strictly above 2× the 30 s heartbeat); nothing else changes the real-time contract.
- **Permission surface.** The builder's `edit` allowlist covers neither `infra/**` nor `.github/**` (unchanged); the Q-9 route from `aws-deploy-pipeline` (route (a) user-authorized two-entry bootstrap T0, or route (b) shell authoring) still governs authoring of those paths, recorded before any authoring task runs (AC-22 of the prior feature, carried).

## Testing strategy

- **Tool provisioning.** No `terraform`/`actionlint` binaries on the host; Podman 5.x is present. Pinned wrappers: `docker.io/hashicorp/terraform:1.15.9` and `docker.io/rhysd/actionlint:1.7.12`. A failed pull reports `blocked` with candidate tags — never a silent substitute (AC-1).
- **Unit-level (HCL):** wrapper `fmt -check -recursive` + `init -backend=false` + `validate` over `infra/terraform/` (syntax + provider schema, no creds). Both the root and `bootstrap/` validate.
- **Integration (workflow level):** the pinned `actionlint` wrapper over `.github/workflows/*.yml`; action SHA-pinning audited by grep; permission model audited by inspection; deploy-chain wiring (SSM send-command, `-backend-config`, `-var-file`) audited by grep of pinned names in `deploy.yml`.
- **Containerized e2e:** the existing `npm run smoke` suite is unchanged in content and remains the deploy-blocking smoke gate in CI with the Mailpit pre-start (`up -d mailpit` before `run --rm smoke`); upstream one-shot defect remains backlog.
- **Coverage:** no production TypeScript is added or changed (infra/config/docs only), so no new coverage targets; the project bar (`npm run coverage`, thresholds ≥ 80% statements/branches/functions/lines per workspace) is preserved and enforced by the pipeline gates. T-final runs `npm run coverage` as the regression guard for the no-TS-changes claim.
- **Config/content verification:** AC-16/AC-18/AC-19 content changes are verified by inspection with recorded grep anchors in build logs (house style); the reviewer re-anchors independently.
- **Evidence hygiene:** every build log records raw command output (no paraphrase claims); the reviewer independently reproduces per the strengthened `AGENTS.md` conventions.

## Open questions

- **Q-1 — Instance type default (confirmation sought).** Default `t3.micro` (free-tier eligible in most regions); `t2.micro` selectable via `instance_type` variable for regions where `t3.micro` is not free-tier eligible. Confirm region/instance eligibility.
- **Q-2 — Remote state backend (carried).** ONE shared S3 bucket per account (`cubeclicker-tfstate-<aws-account-id>`), never hardcoded; bucket+region via `-backend-config`; state key `env/production/terraform.tfstate` pinned literal; bucket created once by `bootstrap/` locally. Unchanged from `aws-deploy-pipeline` Q-2.
- **Q-3 — Environment strategy (carried).** Single `production` environment; staging is a documented additive recipe, not shipped. Unchanged.
- **Q-4 — SSH access / `admin_cidr` (F7).** `admin_cidr` is required with no open default; rejects `0.0.0.0/0` and empty. Confirm the operator's IP/CIDR for SSH (port 22). If no SSH is desired, the variable still must be supplied (could be a bastion/VPN CIDR) — there is no "disabled" default.
- **Q-5 — Database placement (revised, F4).** Default: containerized Postgres on the VM (no RDS, no cost). Opt-in: `enable_rds` (default `false`) provisions RDS `db.t3.micro` when `true` (free-tier eligible, 750 h/month for 12 months). The prior `use_external_database_url` toggle is replaced by `enable_rds`; the data module's SG input is renamed `ec2_security_group_id`. Confirm whether the opt-in RDS path is wanted for production durability.
- **Q-6 — Production email/verification flow (carried).** SMTP slots exist (SSM SecureStrings) but values are provisioned out-of-band. Confirm SES vs. direct SMTP.
- **Q-7 — `terraform plan` on PRs (carried).** Credential-less PRs run fmt+validate only; the real plan runs in `deploy.yml` immediately before apply. `GitHubActionsCubeCI` + `AWS_PLAN_ROLE_ARN` provisioned, consumed by no workflow today.
- **Q-8 — First real deployment (verification boundary, carried).** Acceptance is artifact + credential-less pipeline verification green; actual provisioning requires user-side AWS assets and an operational `deploy.yml` run.
- **Q-9 — Builder permission route (carried, F3).** Route (a) user-authorized two-entry bootstrap T0 for `infra/**` and `.github/**` (recommended default), or route (b) shell authoring with pinned controls. Recorded before any authoring task runs; the Dockerfile is not touched by this feature, so no bootstrap entry is needed for `src/**`.

## Assumptions

- The free-tier target is AWS (single account) on EC2 `t3.micro`/`t2.micro`; container images remain provider-neutral deployables.
- `docker.io/hashicorp/terraform:1.15.9` and `docker.io/rhysd/actionlint:1.7.12` are existing stable tags; pull failure → `blocked`.
- GitHub-hosted `ubuntu-latest` runners are the CI assumption (Docker/Compose preinstalled); the smoke gate uses the Mailpit pre-start recipe.
- The dependency lockfile, compose topology, `tests/e2e/smoke.mjs`, and both Dockerfiles do not change; ECR image names mirror compose image names.
- The framework strengthening from `aws-deploy-pipeline` (proof-of-working) is already in place and is not re-touched by this feature.
- `docs/features/README.md` remains orchestrator-owned; the builder proposes its own row diff.
- The provider-choice sentences in `AGENTS.md` § Stack / `docs/architecture/stack.md` / `docs/architecture/containerization.md` are amended by this feature's doc pass (T4) to reflect the selected AWS single-VM free-tier target while stating that container images remain provider-neutral.

## Revision history

- r1 — 2026-11-12 — initial draft consolidating r1 findings F1–F11 (resolutions applied: legacy-module deletion approved, scoped credential audit, random provider declared, `enable_rds` toggle, ci.yml unchanged gate, Caddy WS anchors, admin_cidr required, T1 gated on deletion approval, user-data service-name anchors, meaningful doc anchor, legacy-module disposition) and the cheap r2 nits F12–F16 (anchors/greps/doc checks). Equivalent to the approved r2; no r1→r2 cycle re-run.