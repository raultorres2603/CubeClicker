# Infrastructure (Terraform + AWS)

This directory holds the Terraform infrastructure for deploying CubeClicker to AWS.
The application images themselves stay provider-neutral (see
`docs/architecture/containerization.md`); AWS + Terraform is the chosen deploy
target per the user's 2026-10-31 request.

## Tooling convention (C-1) — no host binaries

`terraform` and `actionlint` are **not** installed on the build host, and none
will be. Every verification command below runs through the pinned Podman
wrappers. Podman 5.x is required (verified 5.8.9 on the build host).

```sh
# Terraform wrapper (fmt -check -recursive / init -backend=false / validate)
podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform \
  docker.io/hashicorp/terraform:1.15.9 <subcommand>

# actionlint wrapper (workflows live at repo root, not under infra/)
podman run --rm -v "$PWD:/repo:z" -w /repo \
  docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
```

A failed image pull is reported `blocked` with candidate tags — never
substituted silently (AC-1).

## Layout

```
infra/terraform/
  versions.tf            required_version >= 1.11 + aws provider pin
  variables.tf           input schema (aws_region default us-east-1, project,
                         environment with NO default, sizing, toggles)
  outputs.tf             pinned output names
  networking.tf / edge.tf / ecr.tf / data.tf / ecs.tf / cicd-iam.tf
                         root wiring into modules/* (one concern per file)
  backend.tf             S3 backend (key pinned; bucket/region via -backend-config)
  envs/production.tfvars environment layer (single production env)
  modules/               networking, edge, ecr, data, ecs, cicd-iam
  bootstrap/             ONE-TIME separate root: shared S3 state bucket
```

State backend: S3 with S3-native locking (`use_lockfile = true`). **No
DynamoDB anywhere** (AC-3). ONE shared bucket per account, per-environment state
keys `env/<environment>/terraform.tfstate`; the production key
`env/production/terraform.tfstate` is pinned literal in `backend.tf`.

## One-time state bootstrap (Q-2 / D-10)

The state bucket is created exactly once, locally, by the `bootstrap/` root.
It is never created CI-side.

```sh
cd /var/home/raultorraco/Documents/Projects/CubeClicker  # repo root

# 1. Init the bootstrap root (no backend; it creates the backend).
podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap \
  docker.io/hashicorp/terraform:1.15.9 init -backend=false

# 2. Review the plan (bucket name convention: cubeclicker-tfstate-<aws-account-id>).
podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap \
  docker.io/hashicorp/terraform:1.15.9 plan \
  -var "aws_account_id=<YOUR_ACCOUNT_ID>" \
  -var "aws_region=us-east-1"

# 3. Apply (user-gated operational step; never run in CI).
podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform/bootstrap \
  docker.io/hashicorp/terraform:1.15.9 apply \
  -var "aws_account_id=<YOUR_ACCOUNT_ID>" \
  -var "aws_region=us-east-1"

# 4. Record the printed state_bucket_name into the TF_STATE_BUCKET repo variable.
```

The bucket is versioned, encrypted (SSE-KMS default key), public-access-blocked,
and TLS-only. `force_destroy = false`.

## Per-environment init / plan (production)

```sh
# Init against the shared bucket (bucket + region arrive via -backend-config).
podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform \
  docker.io/hashicorp/terraform:1.15.9 init \
  -backend-config "bucket=${TF_STATE_BUCKET}" \
  -backend-config "region=${AWS_REGION}"

# Credential-less syntax/schema validation (no AWS creds needed).
podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform \
  docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive .
podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform \
  docker.io/hashicorp/terraform:1.15.9 validate

# Plan (run with real OIDC creds in the deploy job, immediately before apply).
podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform \
  docker.io/hashicorp/terraform:1.15.9 plan \
  -var-file=envs/production.tfvars \
  -var "image_uri_backend=<sha-tag>" \
  -var "image_uri_frontend=<sha-tag>" \
  -out=tfplan
```

The validated `environment` variable has **no default**, so plan cannot silently
mis-target an environment. The deploy job pins
`-var-file=envs/production.tfvars` (AC-9). A second environment is a documented
additive recipe (copy `envs/production.tfvars` -> `envs/<env>.tfvars`, state key
`env/<env>/terraform.tfstate`, plus a second GitHub environment + deploy-role
trust constraint + concurrency group) — not shipped code (F5).

## Repository variables checklist (user-side, no secrets)

Create these as **repository variables** (not secrets) in GitHub, and the
protected `production` environment with required reviewers:

- `AWS_REGION` — e.g. `us-east-1`
- `AWS_DEPLOY_ROLE_ARN` — ARN of `GitHubActionsCubeDeploy`
- `AWS_PLAN_ROLE_ARN` — ARN of `GitHubActionsCubeCI` (provisioned for the
  plan-on-PR follow-up; consumed by no workflow today)
- `TF_STATE_BUCKET` — name printed by the one-time bootstrap apply
- `PUBLIC_WS_URL` — production WebSocket URL baked into the frontend image

Also required: the protected `production` GitHub environment (required reviewers)
and the one-time bootstrap apply above.

## Verification boundary

Acceptance of this feature is **artifact + credential-less pipeline
verification green** — not a deployed environment. No `terraform apply` runs
during build verification; the first real apply is a user-gated operational
step (Q-8). Every gate that can run without an account does run (wrapper
fmt/validate, actionlint, the Mailpit-primed smoke recipe).
