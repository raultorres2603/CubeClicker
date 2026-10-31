---
feature: aws-deploy-pipeline
revision: 3
---
# Plan — AWS Deploy Pipeline (Terraform infrastructure + GitHub Actions CI/CD + framework proof-of-working)

## Architecture

### Terraform layer (`infra/terraform/`)

One root module composed of one-file-per-concern root wiring plus per-concern submodules. Every Terraform task keeps the directory in a `validate`-green state at its commit (each task's verify runs over the whole tree via the pinned C-1 wrapper), so the graph is sequential in the infra cluster.

```
infra/terraform/
├── versions.tf            # required_version ≥ 1.11 + aws provider pin (T1)
├── variables.tf           # aws_region (default us-east-1), project=cubeclicker, environment
│                          #   (validated var, NO default — target value "production"), per-module
│                          #   sizing vars, toggles (data module remote-DB mode) (T1)
├── outputs.tf             # ARNs/DNS/names consumed by CI/CD + documentation (T1)
├── networking.tf          # root wiring → modules/networking (T3)
├── edge.tf                # root wiring → modules/edge (T3)
├── ecr.tf                 # root wiring → modules/ecr (T4)
├── data.tf                # root wiring → modules/data (T5)
├── ecs.tf                 # root wiring → modules/ecs (T6)
├── cicd-iam.tf            # root wiring → modules/cicd-iam (T7)
├── backend.tf             # S3 backend; use_lockfile=true; bucket+region via -backend-config
│                          #   flags in the workflow; key pinned LITERAL env/production/terraform.tfstate (T8)
├── envs/
│   └── production.tfvars  # environment="production", sizing, region override if any (T8)
├── modules/
│   ├── networking/        # VPC (2 public + 2 private subnets via AZ data source), IGW,
│   │                      #   NAT (per AZ hardened limit), route tables, SGs (T3)
│   ├── edge/              # internet-facing ALB, listeners, 2 target groups, WS-capable
│   │                      #   routing (/ws + /auth* + /healthz → backend TG; / default →
│   │                      #   frontend TG), idle_timeout = 90 — strictly greater than
│   │                      #   2× the backend's 30 s heartbeat (hub.test.ts:556);
│   │                      #   health checks: /healthz matcher 200, / matcher 200 (T3)
│   ├── ecr/               # 2 repos cubeclicker-backend / cubeclicker-frontend, lifecycle
│   │                      #   policy keeping recent SHA-tagged images (T4)
│   ├── data/              # PostgreSQL 16 (RDS, default) in private subnets, SG→backend only,
│   │                      #   AWS-managed master credentials (Secrets Manager);
│   │                      #   `use_external_database_url` toggle for Q-5 alternative (T5)
│   ├── ecs/               # Fargate cluster; task defs + services for `backend` (8080) and
│   │                      #   `frontend` (8080, prod image); env vars + SSM/Secrets Manager
│   │                      #   `secrets` injection; awslogs driver; task roles with
│   │                      #   name prefix `cubeclicker-<environment>-task-` (T6)
│   └── cicd-iam/          # OIDC IdP for token.actions.githubusercontent.com; roles
│                          #   GitHubActionsCubeCI / GitHubActionsCubeDeploy (names pinned D-6);
│                          #   trust sub conditions per D-6 (T7)
└── bootstrap/             # ONE-TIME separate root: S3 bucket for repo state — versioning,
    ├── variables.tf       #   encryption, use_lockfile (S3-native locking), public-access block
    └── main.tf            #   bucket name convention cubeclicker-tfstate-<aws-account-id>
                          #   (account id via variable), output state_bucket_name (T2)
```

Composition flow: root variables → module calls → outputs (image repo URIs, ALB DNS, cluster/service names, role ARNs). Remote state: ONE shared bucket per account (Q-2 reconciled); the deploy workflow supplies `-backend-config bucket=${{ vars.TF_STATE_BUCKET }} -backend-config region=${{ vars.AWS_REGION }}` while `backend.tf` carries the pinned `key = "env/production/terraform.tfstate"` literal; the bucket itself is created exactly once by the local `bootstrap/` apply (D-10). Image URIs are apply-time `-var image_uri_backend` / `-var image_uri_frontend` ending in the SHA tag (D-4); the workflow also layers `-var-file=envs/production.tfvars` (D-9). The frontend image build in the deploy job carries `--build-arg VITE_WS_URL=${{ vars.PUBLIC_WS_URL }}` against the two-line `ARG VITE_WS_URL` + `ENV VITE_WS_URL` amendment T10 makes to `src/frontend/Dockerfile` (F6/F17 route (a) — the feature's only `src/**` touch; the `ENV` bridge exports the build arg into the build container's process env so Vite bakes `PUBLIC_WS_URL`).

### Pipeline layer (`.github/workflows/`)

- `ci.yml` — `on: pull_request`, `push: branches: [main]`, plus `workflow_call` (consumed by deploy). Jobs (pinned names, run **in parallel**, no internal `needs` chain): `verify-app` (`npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run coverage` → `npm run build`), `smoke-e2e` (**Mailpit pre-start, then** the containerized smoke run — `docker compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` → `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`; the one-shot run never starts Mailpit — no `depends_on` edge — and was reviewer-verified 9/12 FAIL without the pre-start and 12/12 PASS with it; the upstream one-shot `npm run smoke` defect is backlog, compose files frozen), `verify-infra` (`terraform fmt -check -recursive`, `terraform init -backend=false`, `terraform validate` — runner-side install via `hashicorp/setup-terraform` with `terraform_wrapper: false`; no AWS credentials). Each job fails the run on any non-zero exit; the caller (deploy.yml) gates on the reusable workflow's overall result, so **all three must pass before any deploy**. The coverage gate (`npm run coverage`, thresholds ≥ 80% statements/branches/functions/lines per workspace, from AGENTS.md) runs in `verify-app`.
- `permissions`: workflow-level `contents: read`; only deploy jobs get `id-token: write`; `actions/checkout` SHA-pinned + version comment everywhere; Node 24 + npm cache via `actions/setup-node`; no `pull_request_target`; no static keys.
- `deploy.yml` — `on: push: branches: [main]`, `concurrency: { group: deploy-production, cancel-in-progress: false }`; `environment: production`. Jobs pinned: `verify` (calls `ci.yml` via `workflow_call` — gates re-run on main by design) → `build-and-push` (ECR login via OIDC; build/push both images tagged `github.sha`; frontend builds with the `VITE_WS_URL` build-arg; task defs never render `latest`) → `infra` (wrapper-equivalent `terraform fmt`/`validate`, then `init -backend-config bucket/region`, `plan -var-file=envs/production.tfvars -var image_uri_* -out=tfplan`, `apply -input=false tfplan` — all assuming `AWS_DEPLOY_ROLE_ARN` via OIDC) → `deploy-services` (render + `amazon-ecs-deploy-task-definition` ×2 with `wait-for-service-stability: true`).
- Workflow hygiene: every third-party action is full-commit-SHA-pinned with a version comment; `.github/dependabot.yml` tracks the `github-actions` ecosystem (T11).

### Framework layer (deliverable 3 — strengthen, no new state)

Pinned content contracts (wording latitude bounded by the named tokens; numbering mirrors T0/T12/T13 ownership):

1. **`AGENTS.md` § Workflow** (T13) — one added bullet after the workflow-artifacts bullet: proof-of-working ("a feature is green to go only when its verification evidence is recorded and reproducible: lint, typecheck, tests, `npm run coverage`, plus feature-appropriate proof such as the Mailpit-primed containerized smoke recipe for cross-service behavior or the containerized `terraform fmt/validate` + `actionlint` wrappers for infra/pipeline config changes; raw output lives in the build logs, and the reviewer reproduces it").
2. **`AGENTS.md` § Boundaries ✅ line** (T13) — extended in place: "run lint, typecheck, tests, and the coverage command **plus any feature-appropriate proof pinned by the task's verify** before reporting done; record raw evidence in build logs". No other boundary text changes.
3. **`.opencode/agents/builder.md` Verify bullet** (T13) — extended in place with feature-appropriate proof and raw-output recording; report format unchanged.
4. **`.opencode/agents/reviewer.md` evidence bullet** (T12) — extended in place: rerun the feature-appropriate proof yourself; un-recorded/unreproducible evidence = unmet.
5. **`.opencode/agents/orchestrator.md` iron rules** (T12) — one added bullet: proof-of-working gate before `building → code_review` (verify evidence per behavior-change task's build log, including the coverage run + pinned feature-appropriate proof) and nothing new about states.
6. **`.opencode/skills/orchestration-playbook/SKILL.md` § 1 transition rule `building → code_review`** (T12) — the existing rule ("every behavior-change task's build log records its coverage run") is widened in place: records its verify evidence **including the coverage run and any pinned feature-appropriate proof**; the existing `code_review → accepted` rule (docs pass per `documentation.md`) is unchanged.
7. **`.opencode/skills/web-implementation/SKILL.md` § Definition of Done** (T13) — one added checklist item: verify evidence + feature-appropriate proof recorded (raw output) is a completion precondition.
8. **`.opencode/skills/code-review/SKILL.md` Workflow step 3** (T13) — extended in place: run the full suite including feature-appropriate proof commands — the Mailpit-primed containerized smoke recipe for cross-service claims; the containerized `terraform fmt -check` + `validate` (+ credential-less plan when the tree permits) and the pinned `actionlint` wrapper when the diff contains `.tf`/`.yml`.
9. **`AGENTS.md` § Stack** (T13, F9) — the "AWS ECS Fargate is an example only — no provider is chosen" parenthetical is amended to the true statement: AWS + Terraform selected per the user's 2026-10-31 request; container images remain provider-neutral deployables. `docs/architecture/stack.md` and `docs/architecture/containerization.md` receive the SAME amendment, but those two files are owned by T14 (see File inventory) — T13 owns only the `AGENTS.md` fragment.

The eight r1-verified anchor targets (AGENTS.md § Workflow bullet + § Boundaries ✅ line; builder Verify bullet; reviewer evidence bullet; orchestrator iron rule; playbook §1 transition rule; web-implementation DoD; code-review workflow step 3) remain the anchor set for contracts 1–8 at r2. No state names, no checkpoint rules, no verdict/report formats are touched (1–3 and 9 are in-place extensions/one-sentence swaps; the autonomy directive of 2026-10-16 — quoted in `docs/features/online-realtime-workflow/spec.md` Q-1 — is respected: the proof loop is agent-run, no user gate added).

## Interfaces / contracts (pinned)

### Terraform

| Item | Pinned value |
| --- | --- |
| Root dir | `infra/terraform/` (recursive format/validate scope) |
| required_version | `≥ 1.11` (S3-native locking GA) |
| Providers | `hashicorp/aws` only, pinned via `~>` to the then-current major (builder pins exact, e.g. `~> 6.0`) |
| `aws_region` default | `us-east-1` (variable default; tfvars override) |
| `project` | `cubeclicker` |
| `environment` | validated variable with **no default**; the only declared value is `production` (`envs/production.tfvars`) |
| Deploy environment | single `production` (F5); staging is a documented additive recipe, not shipped code |
| State backend | S3 + `use_lockfile = true`, no DynamoDB; ONE shared bucket per account (`cubeclicker-tfstate-<aws-account-id>`, never hardcoded); bucket+region via `-backend-config` workflow flags; state key `env/<environment>/terraform.tfstate` with **`env/production/terraform.tfstate` pinned literal in `backend.tf`** |
| ECR repos | `cubeclicker-backend`, `cubeclicker-frontend` (mirror containerization.md image names) |
| Image tag policy | git commit SHA (`github.sha`); no mutable `:latest` in task definitions |
| Container names in task defs | `backend` (port 8080), `frontend` (port 8080, the `prod` nginx image) — identical to compose service names |
| Backend env names | `NODE_ENV=production`, `DATABASE_URL`, `MAX_USERS_PER_SERVER`, `APP_BASE_URL`, `ALLOWED_ORIGIN`, `SESSION_COOKIE_SECURE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (compose-name parity) |
| Secrets injection | task-definition `secrets:` from SSM/Secrets Manager ARNs; secret values never committed; values provisioned out-of-band (Q-6) |
| OIDC IdP thumbprint config | default (provider handles GitHub issuer); `aud` = `sts.amazonaws.com` |
| Roles | `GitHubActionsCubeCI` (read-only: ECR pull/describe, state read + lockfile ops, describe-only service reads — provisioned for the plan-on-PR follow-up (Q-7), consumed by no workflow today (F15)) and `GitHubActionsCubeDeploy` (apply) — deploy trust `sub` pinned to `repo:<owner>/<repo>:environment:production`; CI role trust pinned `repo:<owner>/<repo>:ref:refs/heads/main` (owner value via repo variable, not committed) |
| Task roles | name-prefix scoped `cubeclicker-<environment>-task-` (wildcards bounded to prefix — least-privilege trade-off documented) |
| Data default | PostgreSQL engine `16`, non-public, SG-scoped, `storage_encrypted = true`; toggle `use_external_database_url` (Q-5) |
| ALB idle timeout | `idle_timeout = 90` — strictly greater than 2× the backend's 30 s heartbeat (`src/backend/src/game/hub.test.ts`, line 556) |
| Health checks (ALB-assertable only) | backend target group: `GET /healthz` matcher 200; frontend target group: `GET /` matcher 200. Body/content-type signals are the images' HEALTHCHECK + smoke-suite contracts — the edge asserts only path + status |
| Routing | backend TG receives `/ws` + `/auth*` + `/healthz`; frontend TG is the default (`/`) |
| Root outputs (pinned names) | `backend_repository_url`, `frontend_repository_url`, `alb_dns_name`, `ecs_cluster_name`, `backend_service_name`, `frontend_service_name`, `backend_task_family`, `frontend_task_family`, `ci_plan_role_arn`, `deploy_role_arn` |
| Bootstrap output (pinned name) | `state_bucket_name` (from the `bootstrap/` root, recorded by the user into the `TF_STATE_BUCKET` repo variable) |

### Workflows

| Item | Pinned value |
| --- | --- |
| CI triggers | `pull_request` (all branches), `push` to `main`, `workflow_call` |
| CI job order | `verify-app`, `smoke-e2e`, `verify-infra` run in parallel; the deploy caller gates on the reusable workflow's overall success (all three must pass) |
| `verify-app` steps | `actions/checkout` → `actions/setup-node` (24, `cache: npm`) → `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run coverage` → `npm run build` |
| `smoke-e2e` steps | `docker compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` **first** → `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (the smoke script polls readiness itself per `tests/e2e/smoke.mjs`; verdict `SMOKE PASS`) → cleanup `docker compose -f compose.yaml -f compose.smoke.yaml down -v` (always) |
| `verify-infra` steps | `hashicorp/setup-terraform` (`terraform_wrapper: false`) → `terraform fmt -check -recursive infra/terraform` → `terraform init -backend=false infra/terraform` → `terraform validate infra/terraform` |
| CI permissions | workflow-level `permissions: contents: read`; no `id-token` anywhere in ci.yml |
| Deploy triggers | `push` to `main`; `concurrency: { group: deploy-production, cancel-in-progress: false }`; `environment: production` |
| Deploy jobs | `verify` (uses `./.github/workflows/ci.yml`) → `build-and-push` → `infra` → `deploy-services` (needs-chain among the deploy-side jobs; verify-app/smoke/verify-infra run in parallel *inside* the reusable ci workflow) |
| OIDC | `aws-actions/configure-aws-credentials` in `build-and-push`, `infra`, `deploy-services`; `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}`; `aws-region: ${{ vars.AWS_REGION }}`; `id-token: write` scoped to those deploy jobs; no CI-role assumption in `verify` jobs |
| Frontend build arg | `--build-arg VITE_WS_URL=${{ vars.PUBLIC_WS_URL }}` on the frontend image build (against the `ARG VITE_WS_URL` + `ENV VITE_WS_URL` lines T10 adds to `src/frontend/Dockerfile`) |
| Infra wiring flags | `terraform init -backend-config bucket=${{ vars.TF_STATE_BUCKET }} -backend-config region=${{ vars.AWS_REGION }}`; `terraform plan -var-file=envs/production.tfvars -var image_uri_backend=<sha-tag> -var image_uri_frontend=<sha-tag> -out=tfplan`; `terraform apply -input=false tfplan` |
| ECS deploy | `aws-actions/amazon-ecs-render-task-definition` ×2 (backend, frontend) + `aws-actions/amazon-ecs-deploy-task-definition` with `wait-for-service-stability: true` on both |
| Repo variables (user-side, no secrets) | `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `AWS_PLAN_ROLE_ARN`, `TF_STATE_BUCKET`, `PUBLIC_WS_URL` |
| Workflow lint | pinned `actionlint` wrapper over `.github/workflows/*.yml` (C-1) |

### C-1 — Containerized verification tooling (pinned, F1)

`terraform` and `actionlint` are NOT installed on the build host; Docker is absent; Podman 5.x (verified 5.8.9 on the build host) is present. No local gate depends on a host binary. The pinned wrapper forms (used verbatim in every affected task's `verify:`):

```
# Terraform wrapper (fmt -check -recursive / init -backend=false / validate)
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 <subcommand>

# actionlint wrapper
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml

# Pull-failure protocol: report `blocked` with candidate tags — never substitute silently (AC-1)
```

Tags are stable pinned values verified to exist at r2 (`hashicorp/terraform:1.15.9` patch release; `rhysd/actionlint:1.7.12`, matching actionlint's documented image usage); `required_version ≥ 1.11` is satisfied. Inside the workflows themselves the TF checks run via `hashicorp/setup-terraform` on GitHub-hosted runners (runner-side install; not a local-gate dependency) — the wrapper constraint applies to agent-run local verification and T-final.

### Framework (contract table)

See § Architecture → Framework layer: nine pinned in-place/added-content edits (AGENTS.md × 3 incl. the § Stack fragment (contract 9), builder × 1, reviewer × 1, orchestrator × 1, playbook × 1, web-implementation × 1, code-review × 1) — each task's build log must record before/after anchor evidence (grep anchors per contract). **Two-phase file note (F3):** `.opencode/agents/builder.md` is touched by T0 (permissions block — only under Q-9 route (a)) and T13 (Verify bullet, contract 3); phases partition the file and the DAG orders them (T0 first, T13 last of the framework pair), and neither task may edit the other's lines. That is the sole cross-task file in the inventory.

## File inventory

| Path | New/Edit | Purpose | Owned by |
| --- | --- | --- | --- |
| `infra/terraform/versions.tf` | New | TF/provider pin | T1 |
| `infra/terraform/variables.tf` | New | Input schema | T1 |
| `infra/terraform/outputs.tf` | New | Output schema | T1 |
| `infra/terraform/.terraform.lock.hcl` | New (committed by design) | provider-hash lockfile for reproducibility — enumerated, not state | T1 |
| `infra/terraform/networking.tf` | New | root wiring: networking | T3 |
| `infra/terraform/edge.tf` | New | root wiring: edge | T3 |
| `infra/terraform/modules/networking/**` | New | VPC/SGs | T3 |
| `infra/terraform/modules/edge/**` | New | ALB/target-groups | T3 |
| `infra/terraform/ecr.tf` | New | root wiring: ecr | T4 |
| `infra/terraform/modules/ecr/**` | New | repos + lifecycle | T4 |
| `infra/terraform/data.tf` | New | root wiring: data | T5 |
| `infra/terraform/modules/data/**` | New | RDS/credentials/toggle | T5 |
| `infra/terraform/ecs.tf` | New | root wiring: ecs | T6 |
| `infra/terraform/modules/ecs/**` | New | cluster/task defs/services | T6 |
| `infra/terraform/cicd-iam.tf` | New | root wiring: cicd-iam | T7 |
| `infra/terraform/modules/cicd-iam/**` | New | OIDC + roles | T7 |
| `infra/terraform/bootstrap/variables.tf` | New | bootstrap input schema | T2 |
| `infra/terraform/bootstrap/main.tf` | New | state bucket | T2 |
| `infra/terraform/backend.tf` | New | S3 backend + key literal | T8 |
| `infra/terraform/envs/production.tfvars` | New | env layer (single production) | T8 |
| `infra/README.md` | New | infra conventions + bootstrap how-to + C-1 wrapper reference | T8 |
| `.github/workflows/ci.yml` | New | reusable gates (Mailpit-primed smoke) | T9 |
| `.github/workflows/deploy.yml` | New | deploy pipeline | T10 |
| `src/frontend/Dockerfile` | Edit | two-line `ARG VITE_WS_URL` + `ENV VITE_WS_URL` in the build stage (F6/F17 route (a); the feature's only `src/**` touch) | T10 |
| `.github/dependabot.yml` | New | action pin upkeep | T11 |
| `.gitignore` | Edit | add terraform artifacts (state/plan/.terraform) | T1 |
| `AGENTS.md` | Edit | proof-of-working rule (contracts 1–2) + § Stack amendment (contract 9) | T13 |
| `.opencode/agents/orchestrator.md` | Edit | gate strengthening (contract 5) | T12 |
| `.opencode/agents/reviewer.md` | Edit | evidence rule (contract 4) | T12 |
| `.opencode/skills/orchestration-playbook/SKILL.md` | Edit | transition rule (contract 6) | T12 |
| `.opencode/agents/builder.md` | Edit (two-phase) | T0: permissions block only (Q-9 route (a)) — T13: Verify bullet (contract 3) | T0 / T13 |
| `.opencode/skills/web-implementation/SKILL.md` | Edit | DoD item (contract 7) | T13 |
| `.opencode/skills/code-review/SKILL.md` | Edit | step-3 proof commands (contract 8) | T13 |
| `README.md` | Edit | Deployment section | T14 |
| `docs/architecture/deployment.md` | New | deployment conventions doc | T14 |
| `docs/architecture/containerization.md` | Edit | resolved deferrals (tagging/WS/config-injection) + neutrality amendment | T14 |
| `docs/architecture/stack.md` | Edit | § Stack provider-choice sentence amendment (contract 9 sibling) | T14 |
| `docs/features/aws-deploy-pipeline/build-log-*.md` | New | per-task raw evidence | each task (own build log only) |

Never touched: `src/**` except the pinned `src/frontend/Dockerfile` ARG line, `src/frontend/src/**`, `tests/e2e/**`, `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `package.json`, `package-lock.json`, `.env*`, `docs/features/README.md` (orchestrator-owned; builder proposes its own row diff in T14's report/build log).

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Terraform-first IaC; provider-specific AWS modules isolated in `infra/terraform/modules/` so a future cloud port swaps resource bodies, not repo layout or pipeline | "Most compatible possible" per the request; Terraform is open-source, declarative, and provider-portable; the pipeline is provider-agnostic (no cloud-aware steps) | CDK/Pulumi (require runtime SDK in the repo, diverges from TS-only stack constraint); SAM/serverless templates (wrong runtime model for the two long-running images) |
| D-2 | Runtime = ECS Fargate (two services) + internet-facing ALB; ALB has native WebSocket passthrough for `/ws`; `idle_timeout = 90` (strictly > 2× the 30 s heartbeat) | The committed images run unchanged (image-first per `docs/architecture/containerization.md`); ALB documentedly load-balances WebSocket; 90 s keeps idle-kill margins above the 30 s heartbeat with room for network jitter | CloudFront-first (WS-via-CDN is possible — e.g. VPC origins, 2026 — but adds edge complexity and a second config surface; a future additive module); API Gateway WS (not image-first); NLB (no ALB path routing for REST/WS split) |
| D-3 | S3 remote state with S3-native locking (`use_lockfile = true`), no DynamoDB | Terraform ≥ 1.11 GA'd S3 locking; DynamoDB locking is deprecated; one managed system fewer | S3+DynamoDB (deprecated), local state (not CI-safe), Terraform Cloud (external service) |
| D-4 | Image release = `github.sha` tags pushed by the CD job; the deploy job layers `-var-file=envs/production.tfvars`, `-backend-config bucket/region` flags, and apply-time `-var image_uri_*`; task definitions pin exact image URIs; the frontend build bakes `VITE_WS_URL` from `PUBLIC_WS_URL` (F6 route (a)) | AWS-recommended rollback story; one audit trail from state bucket to task definition; consistent with "release tagging deferred to deployment time" in `docs/architecture/containerization.md` — this feature resolves that deferral (updated by T14); the bake fix keeps the deployed frontend actually functional | mutable `latest` (breaks rollbacks); `-backend-config key` per run (key is safer pinned literal, single env); deferred bake (rejected — passes ACs while shipping a broken WS frontend) |
| D-5 | Smoke gate in CI runs `docker compose` (same compose files, same `tests/e2e/smoke.mjs`) with **Mailpit pre-started first** (`up -d mailpit` → `run --rm smoke`); upstream one-shot `npm run smoke` defect is backlog | GitHub-hosted runners ship Docker/Compose; podman is absent; the OCI-project-agnostic compose spec makes the equivalence exact; the r1 reviewer proved the one-shot run never starts Mailpit (no `depends_on` edge) — 9/12 FAIL cold, 12/12 PASS pre-started; compose files and AGENTS.md § Commands stay frozen (defect predates the feature) | installing podman on runners (fragile, slower); fixing compose files here (out of scope — compose frozen) |
| D-6 | OIDC/roles; two roles (`GitHubActionsCubeCI` read-only, provisioned-for-follow-up; `GitHubActionsCubeDeploy` apply); trust `sub` conditions; repo variables for ARNs/region/bucket; `id-token: write` scoped to deploy jobs | Best practice grounded in current guidance (actions marketplace hardening docs, AWS builder notes): no long-lived keys, minimal token scoping | static keys/stored secrets (banned) |
| D-7 | `tflint`/`yamllint` **not** included initially; `actionlint` included | fmt+validate+plan covers Terraform syntax/semantics; actionlint is the one high-signal checker for our workflow shape (it validates expressions/needs/pins); keeping one config linter minimizes maintenance; revisit if the pipeline grows | adding both (lint noise vs. signal); adding none (misses workflow-semantic bugs) |
| D-8 | PR gates = fmt+validate+app-suite (no AWS creds, fork-safe); real `terraform plan` runs only in the deploy job immediately before apply | Credential-less PRs can't refresh state nor call provider APIs; no secrets on PR runs; plan-before-apply is the standard IaC safety bar | plan-on-PR with OIDC (damaging unless roles/vars exist; follow-up option — Q-7; role + `AWS_PLAN_ROLE_ARN` provisioned now, consumed later (F15)) |
| D-9 | ONE shared state bucket + per-environment state keys; single `production` deploy environment layered by `-var-file=envs/production.tfvars`; staging deferred to a documented additive recipe | Single source of truth; no module duplication; environments are config, not copies; the r1 two-env default could not be executed or audited within the no-real-apply boundary — F5 resolution (Q-3 rev) keeps the model additive: copy tfvars + `env/<environment>/terraform.tfstate` key + a second GitHub environment/trust constraint/concurrency group in a follow-up | separate root per env (duplicates module wiring), workspaces (state-key-by-workspace is less auditable), shipping staging now (unverifiable; contradicts the verification boundary) |
| D-10 | `bootstrap/` is a separate root applied once locally (Q-2 default); the CI/CD lands only after the bucket exists; bucket name convention `cubeclicker-tfstate-<aws-account-id>` recorded by the user into `TF_STATE_BUCKET` | Breaks the state-bucket chicken-and-egg without granting CI write access to bootstrap IAM; one bucket + per-env keys avoids per-env bucket sprawl | CI-applied bootstrap (adds write surface for one-time infra); per-env buckets (needless sprawl for a single deployed environment) |
| D-11 | Framework strengthening is in-place single-line/rule extensions of the existing gates (9 pinned contracts) | No duplication, no new states — the playbook's existing `building → code_review` and `code_review → accepted` rules already carry the doc-pass and coverage obligations; widening their evidence clause is the minimal consistent strengthening | new "verification" state (banned by the brief and would fork every existing reference) |
| D-12 | "verification boundary": no real AWS apply in this feature's acceptance; realistic first-deploy is a user-gated operational run of the finished pipeline | The user's AWS assets (account/roles/bucket/variables) don't exist yet; spec/plan/pipeline/artifacts can be verified credentiallessly (fmt/validate, actionlint, smoke) | blocking acceptance on a real deployment (undecidable without user assets; would stall the feature) |
| D-13 | All local terraform/actionlint verification runs through pinned containerized Podman wrappers (C-1): `docker.io/hashicorp/terraform:1.15.9`, `docker.io/rhysd/actionlint:1.7.12`; pull failure → `blocked`, never silent substitution | The r1 review verified the host lacks `terraform`, `actionlint`, and `docker`; the builder deny rules exclude `curl`/`wget`, so host installs are impossible; Podman 5.x (verified 5.8.9 on the build host) is present and running ephemeral containers is house-consistent with the containerized delivery path | documented one-time host install (impossible under deny rules); unpinned `latest` tags (non-reproducible); substituting tags silently on pull failure (forged evidence) |

## Risks & mitigations

- **Deploy role breadth** (Terraform apply must create ECS task roles/policies) → explicit allowed-resources with `Name`/prefix wildcards pinned in D-6; plan-role IAM read-only (provisioned-for-follow-up, F15); a manual review step on `production` env gates real applies; a finding in the code review re-audits the role policies against the pinned list.
- **State-file sensitive values** → bucket versioning + encryption + public-access block; roles scoped to the one bucket; `sensitive` on outputs carrying credentials/URLs; `.gitignore` coverage for `*.tfstate*`/plan files (AC-3); the committed provider lockfile is reproducibility, not state (F11).
- **WebSocket edge regressions** (dropped upgrades, idle kills, ALB changes) → pin: target groups use HTTP listener with upgrade passthrough; `idle_timeout = 90` > 2× the 30 s heartbeat; ALB health checks assert exactly path + 200 (AC-4); add a smoke-oriented follow-up note in deployment doc (post-first-deploy, route-WS check against the real ALB, user-gated).
- **Tool-image tag rot / pull failure** (D-13) → pinned stable tags verified at r2; no dependabot tracking for wrapper images (upgrade via feature PR when Terraform/provider majors bump, so a human validates against real state); a failed pull reports `blocked` with candidate tags and never substitutes silently (AC-1).
- **Builder permission surface** (F3) → Q-9 route pins the route before authoring starts: route (a) = T0's two-entry allowlist bootstrap (reviewer-diff-inspected, revertible); route (b) = shell authoring under the AC-22 controls; AC-22's automatic finding catches any `permissions:` drift beyond T0's two entries.
- **Two-phase `builder.md`** (T0 permissions vs T13 verify-rule edits) → DAG ordering (T0 before all infra tasks; T13 in the framework cluster, after T12); each build log's diff shows only its own lines; AC-22 audit re-checks the final file.
- **Frontend WS URL bake drift** (Q-4 route (a)) → `PUBLIC_WS_URL` repo variable feeds the image build via the T10-owned `ARG VITE_WS_URL` + `ENV VITE_WS_URL` Dockerfile bridge (F17); a variable mismatch (stale URL) is visible as the frontend failing to connect — documented in the deployment doc's troubleshooting; long-term same-origin inference is a candidate follow-up feature (explicitly out of scope here).
- **Provider-schema churn** (Terraform 1.11+ / AWS provider major bumps) → `required_version` + provider `~>` pins; dependabot updates are explicitly *not* enabled for Terraform (lockfile churn without an account to validate against) — updates happen through feature PRs post-deploy.
- **Framework consistency drift** (the nine contracts touching six files + the two-phase builder file) → T12 → T13 ordering with each contract's grep anchors reviewed; the reviewer runs anchor checks; no silent rewording of existing sentences beyond the pinned replacements (review scope heightened for config-content tasks).
- **CI runtime cost** (smoke spins Postgres/Mailpit + both images per PR… ~3–6 min) → npm cache via setup-node; docker layer reuse is not cached on hosted runners (accepted); the three verify jobs run in parallel so the fastest failures surface first; the Mailpit pre-start adds only the container-create seconds.
- **No AWS account during build** → all verification is credential-less by construction (D-8/D-12); wrapper fmt/validate + actionlint + smoke keep the gates real; the first real apply is explicitly out of feature scope.

## Doc pass plan (T14 satisfies AC-21 (a)–(f); T13 satisfies AC-21 (e) fragment)

1. Root `README.md`: add a **Deployment** section (what the pipelines do, the gate list including the Mailpit-primed smoke step, deploy flow, and the user-side asset checklist: repo variables `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `AWS_PLAN_ROLE_ARN`, `TF_STATE_BUCKET`, `PUBLIC_WS_URL`; protected `production` environment; the one-time bootstrap apply; the plan-role marked "provisioned for the plan-on-PR follow-up; consumed by no workflow today").
2. `docs/architecture/deployment.md` (new): conventions — region default `us-east-1`; ONE shared state bucket (`cubeclicker-tfstate-<aws-account-id>`) + `env/production/terraform.tfstate` key with S3-native locking; OIDC roles + trust conditions; single-`production` environment strategy + the additive staging recipe; WebSocket edge handling (`idle_timeout = 90` > 2×30 s heartbeat, ALB-assertable health checks); image tagging = commit SHA; frontend WS-URL bake via `PUBLIC_WS_URL` → Dockerfile `ARG VITE_WS_URL` + `ENV VITE_WS_URL` bridge; secret posture (no values committed; SSM/Secrets Manager); the deliberate double gate run on `main` (ci.yml re-runs as `verify` before deploy — by design, F16); the Dockerfile carve-out (the one `src/**` touch).
3. `docs/architecture/containerization.md`: resolve the named deferrals — "release image tagging" (= commit SHA), "proxy/load-balancer upgrade handling" (= ALB WS passthrough per deployment.md), "production runtime-config injection for the frontend" (= build-time `PUBLIC_WS_URL` bake) — each marked as decided by this feature; § Deployment neutrality amended to record AWS + Terraform as selected per the user's 2026-10-31 request while the container *images* remain provider-neutral deployables; no other containerization text altered.
4. `docs/architecture/stack.md`: § Containerized delivery path's "AWS ECS Fargate is an example only — no provider is chosen" sentence amended to the contract-9 statement (the same nuance: images stay provider-neutral; the deploy target is AWS via ECS/ALB/RDS/ECR + Terraform); no other stack.md text altered.
5. (fragment) `AGENTS.md` § Stack: the identical sentence amendment is owned by T13 (contract 9), not T14 — recorded here so the doc pass can verify all three files left true.
6. `docs/features/README.md`: builder proposes the row diff (orchestrator-owned index).

Verification greps pinned in T14: `grep -n "Deployment" README.md`, `grep -n "use_lockfile" docs/architecture/deployment.md`, `grep -n "commit SHA" docs/architecture/deployment.md`, `grep -n "provider-neutral" docs/architecture/containerization.md` and `grep -c "no provider is chosen" docs/architecture/stack.md docs/architecture/containerization.md` (must be 0 — the stale sentence is gone), plus the unchanged-text check `git diff README.md | grep -c "podman compose up"` (local-run instructions untouched).

## Verification boundary

Acceptance of this feature is **artifact + credential-less pipeline verification green** (wrapper fmt/validate, wrapper actionlint, mailpit-primed smoke, coverage as pinned per task plus this spec's ACs) — **not** a deployed environment. Running `terraform apply` against real AWS, creating the OIDC role ARNs, the state bucket's first apply, GitHub-side environment/variable setup, and the first operational `deploy.yml` run are user-gated operational steps after acceptance (Q-1/Q-2/Q-8). This is an accepted, explicit verification boundary of the feature — not a lowered test bar: every quality gate that *can* run without the account *does* run as part of build verification (locally via the pinned C-1 wrappers; in-CI via the pinned runner installs).

## Open questions

- Consumes spec.md § Open questions Q-1…Q-9 (same IDs; plan adds no new ones beyond the default decisions D-1…D-13, each traceable to spec.md Qs, the raw request, or a spec-r1 review finding F1–F16).
