---
feature: aws-free-tier-infra
revision: 1
---
# Plan — AWS Free-Tier Infra (single-VM deploy)

## Architecture

### Terraform layer (`infra/terraform/`)

The deploy target changes from Fargate/ALB/RDS-default to a single free-tier VM. Legacy modules are removed; a new `ec2` module is added. The root module is re-wired.

```
infra/terraform/
├── versions.tf            # required_version >= 1.11; aws ~> 6.0; random ~> 3.6 (T1)
├── variables.tf           # aws_region, project, environment, admin_cidr (required),
│                          # instance_type (t3.micro/t2.micro), enable_rds (default false),
│                          # external_database_url (opt-in), sizing (T1/T2)
├── outputs.tf             # vm public ip/dns, instance id, ecr repos, roles (T1)
├── networking.tf          # root wiring -> modules/networking (NO NAT) (T1)
├── ec2.tf                 # root wiring -> modules/ec2 (NEW) (T2)
├── data.tf                # root wiring -> modules/data (opt-in RDS) (T2)
├── ecr.tf                 # root wiring -> modules/ecr (unchanged) (T1)
├── cicd-iam.tf            # root wiring -> modules/cicd-iam (unchanged) (T1)
├── backend.tf             # S3 backend (unchanged) (T1)
├── envs/production.tfvars # environment + sizing (T1)
├── modules/
│   ├── networking/        # VPC, 2 public subnets, IGW, route tables, SG (ALB SG removed
│   │                      # or repurposed as VM SG: 22/80/443) — NO NAT (T1)
│   ├── ec2/               # NEW: instance, EIP, SG (22/80/443), IAM instance profile,
│   │                      # user-data (Docker + compose plugin + db/backend/frontend/caddy),
│   │                      # random_password for containerized Postgres (T2)
│   ├── ecr/               # unchanged: 2 repos (T1)
│   ├── data/              # opt-in RDS behind enable_rds (default false); SG input
│   │                      # renamed ec2_security_group_id (T2)
│   └── cicd-iam/          # unchanged: OIDC + roles (T1)
├── bootstrap/             # unchanged: S3 state bucket (T1)
└── (modules/edge/, modules/ecs/ DELETED) (T1)
```

Composition flow: root variables → module calls → outputs. Remote state unchanged (ONE shared bucket, per-env keys). Image URIs still apply-time vars. The VM pulls images from ECR via the instance profile and runs them under compose; Caddy terminates TLS (Let's Encrypt) and proxies `/ws`, `/auth*`, `/healthz` to backend and `/` to frontend, with WebSocket upgrade passthrough.

### Pipeline layer (`.github/workflows/`)

- `ci.yml` — **unchanged** (AC-10). Gates: verify-app, smoke-e2e (Mailpit pre-start), verify-infra (fmt/validate). No edits.
- `deploy.yml` — triggers on `workflow_dispatch` only (manual-deploy policy). Steps: verify (calls ci.yml) → build-and-push (images tagged `github.sha`, frontend bakes `VITE_WS_URL`) → infra (fmt/validate + init/plan/apply) → deploy (SSM `send-command` running `docker compose pull && docker compose up -d` on the VM for `db`/`backend`/`frontend`/`caddy`). No ECS register/update, no ALB. `concurrency: deploy-production`, `environment: production`.

### Documentation layer

- `README.md` Deployment section updated to single-VM/free-tier.
- `docs/architecture/deployment.md` rewritten for single-VM: region default, state bucket, OIDC roles, single production env, Caddy WS handling (idle timeout > 2× 30 s heartbeat), image tagging = commit SHA, WS-URL bake, secret posture, double gate, and the removed (Fargate/ALB/NAT/RDS-default) note.
- `docs/architecture/containerization.md` deferral resolution + neutrality amendment (deploy target = single-VM free-tier AWS; images remain provider-neutral).
- `docs/architecture/stack.md` § Containerized delivery path provider-choice sentence amended.

### Framework layer

Unchanged — the proof-of-working strengthening from `aws-deploy-pipeline` (AGENTS.md, builder, reviewer, orchestrator, playbook, web-implementation, code-review) is already in place and is not re-touched.

## Interfaces / contracts (pinned)

### Terraform

| Item | Pinned value |
| --- | --- |
| Root dir | `infra/terraform/` |
| required_version | `>= 1.11` |
| Providers | `hashicorp/aws ~> 6.0`, `hashicorp/random ~> 3.6` |
| `aws_region` default | `us-east-1` |
| `project` | `cubeclicker` |
| `environment` | validated variable, no default; only declared value `production` |
| State backend | S3 + `use_lockfile = true`, no DynamoDB; ONE shared bucket per account; key `env/production/terraform.tfstate` pinned literal |
| `admin_cidr` | required, no default, rejects `0.0.0.0/0` and empty (F7) |
| `instance_type` | default `t3.micro`, allowed `t3.micro`/`t2.micro` |
| `enable_rds` | default `false` (opt-in RDS `db.t3.micro`) (F4) |
| ECR repos | `cubeclicker-backend`, `cubeclicker-frontend` (unchanged) |
| Image tag policy | git commit SHA; no mutable `:latest` |
| Container names in compose | `db`, `backend`, `frontend`, `caddy` |
| Backend env names | `NODE_ENV=production`, `DATABASE_URL`, `MAX_USERS_PER_SERVER`, `APP_BASE_URL`, `ALLOWED_ORIGIN`, `SESSION_COOKIE_SECURE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| ALB idle timeout (replaced) | Caddy idle timeout strictly > 2× 30 s heartbeat (> 60 s) |
| Health checks | Caddy → backend `/healthz` (200), frontend `/` (200) |
| Routing | Caddy: `/ws`, `/auth*`, `/healthz` → backend; `/` → frontend |
| TLS | Let's Encrypt (Caddy automatic HTTPS) |
| Root outputs (pinned) | `instance_id`, `instance_public_ip`, `instance_public_dns`, `ecr_backend_repository_url`, `ecr_frontend_repository_url`, `deploy_role_arn`, `ci_plan_role_arn` |
| Bootstrap output | `state_bucket_name` |

### Workflows

| Item | Pinned value |
| --- | --- |
| CI triggers | unchanged (`pull_request`, `push` main, `workflow_call`) |
| CI job order | unchanged (verify-app, smoke-e2e, verify-infra in parallel) |
| Deploy triggers | `workflow_dispatch` only (manual-deploy policy) |
| Deploy jobs | `verify` (calls ci.yml) → `build-and-push` → `infra` → `deploy` (SSM send-command) |
| OIDC | `aws-actions/configure-aws-credentials` assuming deploy role; `id-token: write` scoped to deploy jobs |
| Frontend build arg | `--build-arg VITE_WS_URL=${{ vars.PUBLIC_WS_URL }}` |
| Infra wiring flags | `terraform init -backend-config bucket=${{ vars.TF_STATE_BUCKET }} -backend-config region=${{ vars.AWS_REGION }}`; `terraform plan -var-file=envs/production.tfvars ... -out=tfplan`; `terraform apply -input=false tfplan` |
| SSM deploy | `aws ssm send-command --document-name AWS-RunShellScript` running `cd /opt/cubeclicker && docker compose pull && docker compose up -d` (db/backend/frontend/caddy) |
| Repo variables | `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `AWS_PLAN_ROLE_ARN`, `TF_STATE_BUCKET`, `PUBLIC_WS_URL` (unchanged) |
| Workflow lint | pinned actionlint wrapper over `.github/workflows/*.yml` |

### C-1 — Containerized verification tooling (carried)

`terraform` and `actionlint` are NOT installed on the host; Podman 5.x is present. Pinned wrappers:

```
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 <subcommand>
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
```

Pull failure → `blocked`, never silent substitution.

## File inventory

| Path | New/Edit/Delete | Purpose | Owned by |
| --- | --- | --- | --- |
| `infra/terraform/versions.tf` | Edit | Add `hashicorp/random ~> 3.6` | T1 |
| `infra/terraform/variables.tf` | Edit | `admin_cidr` (required), `instance_type`, `enable_rds`, drop `use_external_database_url`/`external_database_url` (or keep external URL under new toggle) | T1/T2 |
| `infra/terraform/outputs.tf` | Edit | VM outputs; drop ALB/ECS outputs | T1 |
| `infra/terraform/networking.tf` | Edit | Remove NAT wiring | T1 |
| `infra/terraform/ec2.tf` | New | Root wiring → modules/ec2 | T2 |
| `infra/terraform/data.tf` | Edit | Opt-in RDS wiring | T2 |
| `infra/terraform/ecr.tf` | (unchanged) | ECR wiring | — |
| `infra/terraform/cicd-iam.tf` | (unchanged) | IAM wiring | — |
| `infra/terraform/backend.tf` | (unchanged) | S3 backend | — |
| `infra/terraform/envs/production.tfvars` | Edit | Sizing for VM | T1 |
| `infra/terraform/modules/networking/*` | Edit | Remove NAT gateway + EIP; keep VPC/subnets/IGW/SG (VM SG 22/80/443) | T1 |
| `infra/terraform/modules/ec2/*` | New | Instance, EIP, SG, IAM profile, user-data, random_password | T2 |
| `infra/terraform/modules/edge/*` | **Delete** | Legacy ALB module (F1) | T1 |
| `infra/terraform/modules/ecs/*` | **Delete** | Legacy Fargate module (F1) | T1 |
| `infra/terraform/modules/data/*` | Edit | Remove default RDS block; opt-in behind `enable_rds`; rename SG input `ec2_security_group_id` (F4) | T2 |
| `infra/terraform/modules/ecr/*` | (unchanged) | ECR repos | — |
| `infra/terraform/modules/cicd-iam/*` | (unchanged) | OIDC + roles | — |
| `infra/terraform/bootstrap/*` | (unchanged) | State bucket | — |
| `infra/terraform/infra/.../caddy/*` (infra-managed Caddyfile) | New | Caddy config (TLS, WS passthrough) | T2 |
| `.github/workflows/ci.yml` | (unchanged) | Gates | — (verified unchanged, AC-10) |
| `.github/workflows/deploy.yml` | Edit | SSM send-command deploy; remove ECS steps | T3 |
| `README.md` | Edit | Deployment section (single-VM) | T4 |
| `docs/architecture/deployment.md` | Edit | Single-VM conventions | T4 |
| `docs/architecture/containerization.md` | Edit | Deferral resolution + neutrality | T4 |
| `docs/architecture/stack.md` | Edit | Provider-choice sentence (contract 9 sibling) | T4 |
| `docs/features/aws-free-tier-infra/build-log-*.md` | New | Per-task evidence | each task |

Never touched: `src/**`, `tests/e2e/**`, `compose*.yaml`, both Dockerfiles, `package.json`, lockfiles, `.env*`, `AGENTS.md` (framework already in place; this feature does not re-touch it), `.opencode/**`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Single free-tier VM (EC2 `t3.micro`/`t2.micro`) replaces Fargate+ALB | Fits free tier (~$0/mo); simplest topology; reuses container images unchanged | Fargate/ALB (costs money, prior default); Lightsail (less IaC-native) |
| D-2 | Containerized Postgres on the VM by default; RDS `db.t3.micro` opt-in behind `enable_rds` (default false) | Free-tier default with zero DB cost; durability opt-in for users who want managed DB | RDS always (costs after 12 mo / storage); external DB only |
| D-3 | Caddy as reverse proxy (Let's Encrypt TLS, WS passthrough, idle timeout > 2× 30 s) | Free, automatic TLS, native WS upgrade passthrough, simple config | ALB (costs money); nginx+certbot (more ops) |
| D-4 | Public subnet + Elastic IP, no NAT Gateway | NAT Gateway is not free-tier; public subnet keeps egress free; instance has public IP | Private subnet + NAT (costs ~$32/mo) |
| D-5 | Delete `modules/edge/`, `modules/ecs/`, default RDS block, NAT Gateway (F1, F11) | Removes non-free resources; grep-verifiable; documented disposition | Keep disabled behind flags (clutter, cost risk) |
| D-6 | Replace `use_external_database_url` with `enable_rds` (default false); rename SG input `ec2_security_group_id` (F4) | Clearer opt-in semantics for the free-tier default; VM is the DB host's peer | Keep old toggle (inverted/confusing) |
| D-7 | `admin_cidr` required, no open default, rejects `0.0.0.0/0`/empty (F7) | SSH must not be open to the world by default | Default `0.0.0.0/0` (insecure) |
| D-8 | `ci.yml` unchanged; deploy via SSM `send-command` | Reuses proven gates; SSM is free-tier and avoids ECS | ECS deploy (removed); CodeDeploy (extra complexity) |
| D-9 | Manual-deploy trigger policy retained (`workflow_dispatch` only) | Consistent with `manual-deploy-trigger`; no auto-deploy to production | Push-to-main auto-deploy (rejected) |

## Risks & mitigations

- **Free-tier eligibility varies by region/account** → document `t2.micro` alternate; verify eligibility in Q-1; instance type is a variable.
- **Let's Encrypt rate limits / TLS issuance on first boot** → Caddy retries automatically; document; user-data waits for Caddy healthy before marking complete.
- **WebSocket idle kills** → Caddy idle timeout > 2× 30 s heartbeat; backend pings every 30 s; anchor verified by grep (AC-6).
- **Secret values on the VM** → containerized Postgres password generated via `random_password` and stored as SSM SecureString; compose env references `${SSM}`-injected value; never committed.
- **User-data failure (Docker install)** → user-data logs to `/var/log/cloud-init-output.log`; documented troubleshooting; SSM `send-command` can re-run compose manually.
- **Legacy-module deletion (F1)** → gated on explicit user approval before T1 (⚠️ ask-first); T1 verify proves absence via grep.
- **SSM agent availability** → AmazonSSMManagedInstanceCore attached to instance profile; verify agent is running in user-data.
- **No real apply during build** → verification boundary (D-12 carried); credential-less fmt/validate + actionlint + smoke.

## Verification strategy

- Wrapper fmt/validate over `infra/terraform/` (root + bootstrap) — T1, T2.
- actionlint wrapper over `.github/workflows/*.yml` — T3.
- `git diff --exit-code .github/workflows/ci.yml` — T3 (AC-10).
- Scoped credential audit `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` — T4 (AC-13).
- Grep anchors for AC-2/AC-4/AC-5/AC-6/AC-7/AC-9/AC-11/AC-16/AC-17/AC-19 — per task.
- `npm run coverage` as regression guard (no TS changes) — T4.
- Doc greps (README, deployment.md, containerization.md, stack.md) — T4.

## Open questions

Consumes spec.md § Open questions Q-1…Q-9 (same IDs; plan adds no new ones). Key decisions D-1…D-9 each trace to spec.md Qs, the raw request, or review findings F1–F16.

## Revision history

- r1 — 2026-11-12 — initial plan consolidating the free-tier rework and review findings F1–F16.