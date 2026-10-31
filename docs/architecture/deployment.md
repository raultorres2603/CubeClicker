# Deployment

Conventions for deploying CubeClicker. The application stack and container conventions are decided in `docs/architecture/stack.md` and `docs/architecture/containerization.md`; this document records the deployment-specific decisions made by the `aws-deploy-pipeline` feature (AWS + Terraform, single `production` environment). The container *images* remain provider-neutral deployables — only the infrastructure target is AWS.

## Region default

- `aws_region` defaults to `us-east-1` (overridable via tfvars / the `AWS_REGION` repository variable).

## Remote state

- ONE shared S3 bucket per AWS account (convention `cubeclicker-tfstate-<aws-account-id>`; the bucket name is never hardcoded — the deploy job passes `-backend-config bucket=${{ vars.TF_STATE_BUCKET }}`).
- S3-native locking: `use_lockfile = true` in the backend block. No DynamoDB anywhere.
- State keys are per-environment: `env/<environment>/terraform.tfstate`. The production key is pinned literal `env/production/terraform.tfstate` in `infra/terraform/backend.tf`.
- The bucket is created exactly once by the `infra/terraform/bootstrap/` root (one-time local apply, never by CI). It is versioned, encrypted, public-access-blocked.
- Bucket + region arrive via `-backend-config` flags in the deploy job; the key is pinned in `backend.tf`.

## OIDC roles and trust conditions

- GitHub OIDC identity provider for `token.actions.githubusercontent.com` (audience `sts.amazonaws.com`).
- Two least-privilege roles (no static AWS access keys anywhere):
  - `GitHubActionsCubeCI` — read-only (ECR pull/describe, state-bucket read + lockfile ops, describe-only service reads). Provisioned for the plan-on-PR follow-up; consumed by no workflow today.
  - `GitHubActionsCubeDeploy` — ECR push, ECS register/run-service update, infrastructure apply scope (bounded by name-prefix wildcards pinned in plan.md).
- Trust `sub` conditions: CI role `repo:<owner>/<repo>:ref:refs/heads/main`; deploy role `repo:<owner>/<repo>:environment:production`.
- `id-token: write` is scoped to the deploy jobs only; `ci.yml` declares workflow-level `permissions: contents: read` and no `id-token`.

## Environment strategy

- Single deploy environment: `production`. Push to `main` → gates → build/push → plan/apply → deploy, gated by the GitHub `production` environment protection.
- Staging is deliberately not shipped. Additive recipe for a follow-up: copy `envs/production.tfvars` → `envs/<env>.tfvars`, state key `env/<env>/terraform.tfstate`, an additional GitHub environment + deploy-role trust constraints, and a second concurrency group. No staging roles, jobs, or tfvars are created by this feature.
- `environment` is a validated Terraform variable with no default, so a plan cannot silently mis-target.

## WebSocket edge handling

- Internet-facing ALB with WebSocket upgrade passthrough (`/ws` routed to the backend target group; no request policy strips `Upgrade`/`Connection`).
- `idle_timeout = 90` — strictly greater than 2× the backend's 30 s heartbeat (`src/backend/src/game/hub.test.ts`, line 556).
- ALB-assertable health checks: backend target group `GET /healthz` matcher `200`; frontend target group `GET /` matcher `200`. Richer body/content-type signals live in the image HEALTHCHECKs and the smoke suite.
- Routing: `/ws`, `/auth*`, `/healthz` → backend target group; `/` (default) → frontend target group.

## Image tagging

- Release images are tagged with the commit SHA (`github.sha`) and pushed to ECR (`cubeclicker-backend`, `cubeclicker-frontend`). No mutable `:latest` tag is referenced by any task definition.
- ECR lifecycle rules retain recent SHA-tagged images.

## Frontend WebSocket URL bake

- The frontend bakes its WebSocket target at image-build time from the `PUBLIC_WS_URL` repository variable.
- Deploy flow: `deploy.yml` passes `--build-arg VITE_WS_URL=${{ vars.PUBLIC_WS_URL }}` to the frontend build, against the two-line bridge in `src/frontend/Dockerfile`:
  - `ARG VITE_WS_URL="ws://localhost:8080/ws"`
  - `ENV VITE_WS_URL=${VITE_WS_URL}`
- The `ENV` bridge exports the build arg into the build container's process env, because Vite resolves the value via `process.env.VITE_WS_URL` (a bare Docker `ARG` is not a process env var and would silently fall back to `ws://localhost:8080/ws`).
- Local builds without the arg keep the pinned `ws://localhost:8080/ws` default (compose dev builds target the `dev` stage and are unaffected).

## Secret posture

- No secret value is ever committed. Database credentials are created and rotated by an AWS-managed secret store (`manage_master_user_password`) and injected into the backend task as `DATABASE_URL` via the task-definition `secrets` mechanism.
- SMTP credentials are user-supplied SSM SecureStrings (values set out-of-band; names pinned in the manifest).
- Sensitive Terraform outputs/variables are marked `sensitive`. Terraform state can contain sensitive values: the state bucket is encrypted, versioned, non-public, and access is restricted to the two CI/CD roles.
- No state, plan, or `.terraform/` artifacts are committed (the committed `.terraform.lock.hcl` is build reproducibility, not state).

## Double gate on `main` (by design)

- `deploy.yml` first calls `ci.yml` via `workflow_call` (`verify` job) so all three gates re-run on `main` before any build, push, plan, or apply. This is deliberate (F16): the PR gates are re-run on the merge commit rather than trusted from the PR run, so a red gate blocks deploy even if the PR run was green.
- The deploy-side jobs (`build-and-push`, `infra`, `deploy-services`) then run sequentially with `needs` chaining, all assuming the deploy role via OIDC.

## Dockerfile carve-out

- The only `src/**` change owned by this feature is the two-line `ARG VITE_WS_URL` + `ENV VITE_WS_URL` bridge in `src/frontend/Dockerfile`'s build stage. Every other file under `src/**`, `tests/e2e/**`, `compose*`, and `src/backend/Dockerfile` is consumed, not modified.
- The images remain the deployable artifacts per `docs/architecture/containerization.md`.

## User-side asset checklist

Repository variables (Settings → Secrets and variables → Actions → Variables):

- `AWS_REGION` — target region (default `us-east-1`).
- `AWS_DEPLOY_ROLE_ARN` — ARN of `GitHubActionsCubeDeploy`.
- `AWS_PLAN_ROLE_ARN` — ARN of `GitHubActionsCubeCI` (provisioned for the plan-on-PR follow-up; consumed by no workflow today).
- `TF_STATE_BUCKET` — name of the one-time bootstrap-created state bucket.
- `PUBLIC_WS_URL` — public WebSocket URL baked into the frontend image at build time.

GitHub environment:

- Protected `production` environment (required reviewers / branch protection as desired). The workflow's `environment: production` and the deploy role's `environment:production` trust condition both depend on it.

One-time bootstrap apply (local, by the owner):

- Apply `infra/terraform/bootstrap/` once to create the shared state bucket; record its name in `TF_STATE_BUCKET`. See `infra/README.md`.

Concurrency: the whole deploy workflow is wrapped in a `deploy-production` concurrency group (`cancel-in-progress: false`).

See also `docs/architecture/containerization.md` (image contracts) and `docs/architecture/stack.md` (application stack).