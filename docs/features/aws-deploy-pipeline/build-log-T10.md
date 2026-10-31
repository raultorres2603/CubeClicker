# Build log — T10 — CD workflow (`deploy.yml`) + frontend Dockerfile WS-URL bake

Task: T10 (2026-10-31)
Files changed: `.github/workflows/deploy.yml`, `src/frontend/Dockerfile`
What changed & why: Created the CD workflow (push to main, concurrency deploy-production with no cancel, GitHub `production` environment, `verify` job calling ci.yml via workflow_call, build-and-push of both images tagged with github.sha with the frontend `--build-arg VITE_WS_URL`, infra plan/apply via OIDC, deploy-services with wait-for-service-stability). Added the two-line `ARG VITE_WS_URL` + `ENV VITE_WS_URL` bridge to the frontend build stage so Vite bakes `PUBLIC_WS_URL`.
Decisions: Used amazon-ecr-login + docker build/push (runner docker) rather than docker/build-push-action to keep action set to official AWS/GitHub actions; all third-party actions pinned to full commit SHAs with version comments; id-token: write scoped to build-and-push/infra/deploy-services only; no static keys or `latest` tags.

Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml` → exit=0 (no output)
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml` → exit=0 (no output)
- `grep -n "AWS_DEPLOY_ROLE_ARN" .github/workflows/deploy.yml` → 37, 78, 111
- `grep -n "id-token: write" .github/workflows/deploy.yml` → 26, 70, 103
- `grep -n "environment: production" .github/workflows/deploy.yml` → 27, 71, 104
- `grep -n "concurrency" .github/workflows/deploy.yml` → 7
- `grep -n "TF_STATE_BUCKET" .github/workflows/deploy.yml` → 88
- `grep -n "envs/production.tfvars" .github/workflows/deploy.yml` → 92
- `grep -n "image_uri_backend" .github/workflows/deploy.yml` → 92
- `grep -n "image_uri_frontend" .github/workflows/deploy.yml` → 92
- `grep -n "VITE_WS_URL" .github/workflows/deploy.yml` → 59
- `grep -n 'ARG VITE_WS_URL="ws://localhost:8080/ws"' src/frontend/Dockerfile` → 38
- `grep -n 'ENV VITE_WS_URL=${VITE_WS_URL}' src/frontend/Dockerfile` → 39
- `grep -E 'uses: .*@v[0-9]+' .github/workflows/deploy.yml` → (no output, exit=1)
- `git diff -- src/frontend/Dockerfile` → 2 insertions, exactly the pinned two lines (ARG + ENV) in the build stage.

Pinned action SHAs (resolved at build time):
- actions/checkout v4.2.2 → 11bd71901bbe5b1630ceea73d27597364c9af683
- aws-actions/configure-aws-credentials v6.3.0 → e1253824e5c10ff9df46874f81ed3ec929e19cfd
- aws-actions/amazon-ecr-login v2.1.7 → 03f1aad4c6c7ffd436567f42f9384779290529bd
- hashicorp/setup-terraform v3.1.2 → b9cd54a3c349d3f38e8881555d616ced269862dd
- aws-actions/amazon-ecs-render-task-definition v1.9.1 → 8d79160660ad39c402a16e5fc7cd2a32e8f7d6b7
- aws-actions/amazon-ecs-deploy-task-definition v2.6.4 → a00d4d57ac0de1a99b39fe469f3d898d38717c2b

Acceptance audit: AC-12 → met (triggers, concurrency, environment, verify via workflow_call, build/push with sha tags + VITE_WS_URL build-arg, infra init/plan/apply with pinned flags, deploy-services with wait-for-service-stability); AC-13 → met (environment: production referenced); AC-15 → met (no static keys; id-token write scoped to deploy jobs; credential audit clean).
Deviations from spec: none