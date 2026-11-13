# Build log — T5 — CI/CD workflows (CI gates, environment-gated deploy)

Task: T5 (2026-11-13) — `docs/features/vercel-fly-neon-deployment/tasks.md` (AC-12..AC-16)

Files changed:
- `.github/workflows/ci.yml` (rewritten)
- `.github/workflows/deploy.yml` (rewritten)
- `docs/features/vercel-fly-neon-deployment/build-log-T5.md` (this log)

Status: **met (T5 completion round).** The implementation meets AC-12..AC-16. The first round was
reported `failed` because the original negative-token grep matched the substring `ecr` inside the
literal `secrets` (which every workflow secret reference necessarily contains); `tasks.md` was
corrected to the provider-qualified pattern, the corrected audit returns no match
(§ Correction and completion), and T5 is committed with
`ci: deploy vercel frontend and fly backend`. The historical failure evidence is retained below; no
check was weakened and no workflow implementation changed in the completion round.

What changed & why (≤5 lines):
- `ci.yml`: `develop` added to the push trigger; `verify-app` and `smoke-e2e` kept verbatim;
  `verify-workflows` added (pinned `rhysd/actionlint:1.7.12`, `vercel.json` JSON parse,
  `fly.config.toml` anchors); `verify-infra`/Terraform removed.
- `deploy.yml`: push to `develop`/`main` + `workflow_dispatch` required choice, `verify` via
  `workflow_call`, per-environment concurrency, one environment-gated `deploy` job running
  Neon migration → Fly secrets/deploy/health → Vercel pull/build/deploy/alias → deployed smoke.
- Every Vercel command runs with `working-directory: src/frontend`; the build gets
  `VITE_CLOUD_DEPLOY=true`, `VITE_API_URL` and the optional `VITE_WS_URL`.
- Runtime values come only from GitHub Environments; secrets are env-mapped and never echoed;
  no AWS/OIDC/ECR/ECS/Terraform reference remains.
- Pins resolved at build time: flyctl action full SHA `fc53c09e1bc3be6f54706524e3b82c4f462f77be`
  (`v1.5`); Vercel CLI exact `65.15.0`. Existing `actions/*` full-SHA pins preserved.

Decisions:
- **Environment selection.** `github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development')`
  is used identically in the `concurrency.group`, the `deploy` job `environment:` and
  `TARGET_ENVIRONMENT`. Push `main` → `production`; push `develop` → `development`; a dispatch
  chooses explicitly (`production` on any ref, or `development` on `main`). The truth table was
  checked (see § Structural audit).
- **One deploy job.** `deploy` has `needs: verify` and `environment: <target>` so production gets
  exactly one required-reviewer approval and the migrate → Fly → Vercel → smoke order is sequential
  in one job (no cross-job secret passing).
- **Concurrency.** `group: deploy-<target>` with `cancel-in-progress: false`: a development deploy
  and a production deploy never block each other; two runs for the same environment serialize.
- **Vercel pin and cwd.** `npm install --global vercel@65.15.0` (exact, no `@latest`/range);
  `pull`, `build`, `deploy` and `alias` each run with `working-directory: src/frontend`
  (4 occurrences — one per command). The CLI reads `VERCEL_TOKEN`, `VERCEL_ORG_ID` and
  `VERCEL_PROJECT_ID` from the step `env:` only; nothing is echoed and no `--token` argument is used.
- **Vercel environments.** `pull --environment=production` + `build --prod` +
  `deploy --prebuilt --prod` for production; `pull --environment=preview` + `build` +
  `deploy --prebuilt` for development. Only the development deploy is aliased, to the stable
  `FRONTEND_ORIGIN` host (protocol stripped, trailing slash removed) — never to a per-deployment
  preview URL. Production relies on Vercel's production domain routing.
- **flyctl pin.** Resolved live: GitHub release `superfly/flyctl-actions` tag `1.5`
  (published 2024-02-02) → commit `fc53c09e1bc3be6f54706524e3b82c4f462f77be`; the `setup-flyctl`
  action file was read back at that SHA (name `Set up flyctl`, Node 20 runtime). The action ref is
  a full 40-character SHA with the `# v1.5` version comment. The AC pins the action, not the flyctl
  binary it installs.
- **Vercel CLI pin.** Resolved live: `npm view vercel version` → `65.15.0`
  (`dist-tags.latest` = `65.15.0`); the workflow installs exactly `vercel@65.15.0`.
- **Fly secrets.** One `flyctl secrets set --stage --app "$FLY_APP_NAME"` stages
  `DATABASE_URL` (pooled), `DIRECT_DATABASE_URL` (direct startup migration), the derived
  `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL` (= `FRONTEND_ORIGIN`), the `SMTP_*`,
  `SESSION_COOKIE_*`, `MAX_USERS_PER_SERVER`, and the non-secret `NODE_ENV`/`HOST`/`PORT`
  (also present in `fly.config.toml [env]`; secrets take precedence with the same values).
  `FLY_API_TOKEN` comes from `secrets.FLY_API_TOKEN` via `env:` only and is never printed or passed
  as a command-line argument.
- **Fly deploy.** `flyctl deploy --remote-only --config fly.config.toml --app "$FLY_APP_NAME" --primary-region "$FLY_REGION" --strategy rolling` (app and region only from the workflow flags; the file has no `app`/`primary_region`).
- **Health assertion.** Bounded retry (12 × 5 s, 60 s total) around
  `curl -fsS "$VITE_API_URL/healthz"` with exact-body equality to `{"status":"ok"}`; a wrong or
  unreachable body fails the job after the bounded window.
- **Optional `VITE_WS_URL`.** The Vercel build always receives `VITE_WS_URL: ${{ vars.VITE_WS_URL }}`
  (empty when unset; T1's resolver derives `wss://<api-host>/ws`). The deployed-smoke step derives
  the same `SMOKE_WS_URL` from `SMOKE_API_URL` when it is empty, so the T4 script always receives a
  concrete WS URL.
- **No workflow unit tests.** Both files are GitHub Actions YAML; the repository has no workflow
  test harness and this task changes no application behavior. The verification tiers are actionlint
  (syntax/schema/context/shellcheck), the exact anchor greps, the structural audit below, and T7's
  live run. Root `npm run coverage` remains the regression gate (green, § 8).
- **No Terraform/AWS.** `verify-infra` is gone; no `terraform`, `aws-actions`, `id-token`, `AWS_`,
  `ecr`/`ecs` token remains in either workflow (token-aware audit in § 5/§ 10).

## Environment catalog (exact; per GitHub Environment)

Both `development` and `production` use the **same names**; values are per environment. Secrets are
never printed; variables are non-sensitive configuration. `FRONTEND_ORIGIN` is the single public
frontend origin for the environment, and the workflow derives `CORS_ORIGIN`, `ALLOWED_ORIGIN` and
`APP_BASE_URL` from it so the three cannot drift. The reviewer-facing catalog lands in
`docs/architecture/vercel-fly-neon.md` in T6; this table is the T5 source of truth.

| Name | Type | Development (shape) | Production (shape) | `deploy.yml` consumption |
| --- | --- | --- | --- | --- |
| `VERCEL_TOKEN` | secret | token scoped to the dev project | token scoped to the prod project | `env:` of `pull`/`build`/`deploy`/`alias`; never echoed |
| `VERCEL_ORG_ID` | var | Vercel team/org ID | Vercel team/org ID | `env:` of the four Vercel steps (CLI project link) |
| `VERCEL_PROJECT_ID` | var | Vercel project ID (Root Directory `src/frontend`) | project ID | `env:` of the four Vercel steps |
| `FLY_API_TOKEN` | secret | deploy token for the dev app | deploy token for the prod app | `env:` of Fly secrets/deploy steps; never on argv |
| `FLY_APP_NAME` | var | e.g. `cubeclicker-development` | e.g. `cubeclicker-production` | `--app "$FLY_APP_NAME"` in both Fly commands |
| `FLY_REGION` | var | e.g. `iad` | e.g. `iad` | `--primary-region "$FLY_REGION"` |
| `FRONTEND_ORIGIN` | var | stable dev frontend origin (Vercel alias), e.g. `https://cubeclicker-dev.vercel.app` | production domain, e.g. `https://app.example.com` | Vercel alias host; `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL`; smoke `SMOKE_FRONTEND_URL`/`SMOKE_ORIGIN` |
| `VITE_API_URL` | var | e.g. `https://cubeclicker-development.fly.dev` | e.g. `https://api.example.com` | health check, Vercel build, smoke `SMOKE_API_URL` |
| `VITE_WS_URL` | var | optional, e.g. `wss://cubeclicker-development.fly.dev/ws` | optional, e.g. `wss://api.example.com/ws` | Vercel build; smoke `SMOKE_WS_URL` (derived when empty) |
| `DATABASE_URL` | secret | Neon dev **pooled** URL (`-pooler`, `sslmode=require`) | Neon prod **pooled** URL | CI migration fallback; Fly app runtime secret |
| `DIRECT_DATABASE_URL` | secret | Neon dev **direct** URL (`sslmode=require`) | Neon prod **direct** URL | CI migration (preferred); Fly startup-migration secret |
| `SMTP_HOST` | var | reachable SMTP host or test mailbox (never `mailpit`) | production SMTP host | Fly secret |
| `SMTP_PORT` | var | test-mailbox port (not Mailpit's compose-only `1025`) | provider port | Fly secret |
| `SMTP_USER` | var | optional | provider user | Fly secret |
| `SMTP_PASS` | secret | optional | provider password | Fly secret |
| `SMTP_FROM` | var | `no-reply@...` | `no-reply@...` | Fly secret |
| `SESSION_COOKIE_SECURE` | var | `true` | `true` | Fly secret |
| `SESSION_COOKIE_SAMESITE` | var | `none` (default hosts) or `lax` (same-site custom domains) | `none` or `lax` | Fly secret |
| `MAX_USERS_PER_SERVER` | var | `10` | `10` | Fly secret |

Environment protection (GitHub Environment settings, user-owned; the workflow only names them):
`development` has no required reviewers; `production` requires at least one reviewer and restricts
deployment branches to `main`. Both rules are prerequisites recorded in the spec and verified live
in T7, not something a workflow file can express.

Derived Fly app configuration staged by the workflow (values from the environment catalog, never
committed): `DATABASE_URL`, `DIRECT_DATABASE_URL`, `CORS_ORIGIN`, `ALLOWED_ORIGIN`,
`APP_BASE_URL`, `SMTP_*`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`,
`MAX_USERS_PER_SERVER`, `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`.

## First build root/cwd detection requirement (T7 prerequisite)

The primary, approved path is: Vercel project **Root Directory = `src/frontend`**, `vercel.json`
inside that directory, and every CLI command run with `working-directory: src/frontend`. T5 encodes
that pin (4/4 Vercel commands). T5 cannot produce the first live Vercel build log because no Vercel
token/project ID/org ID exists in this workspace; the first **development** deploy (T7) must prove
from the `vercel build` log that the project root and CLI cwd resolve to `src/frontend` (for example
a `Detected ... src/frontend` root line and a `src/frontend/dist` output path).

If monorepo/workspace detection fails in that first build, **stop and report `blocked` before**
applying the documented root-`vercel.json` fallback (`installCommand: "npm ci"`,
`buildCommand: "npm run build -w @cubeclicker/frontend"`, `outputDirectory: "src/frontend/dist"`,
the same rewrite/headers, plus the one-entry builder-permission bootstrap). That fallback requires
user approval and a spec revision; no fallback is applied here.

## Evidence

### 1. `podman run --rm ... docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml`

```
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml
(no output)
actionlint_exit=0
```

Actionlint includes context/property type checking and shellcheck over the `run:` scripts. The
reusable-workflow call, `github.event.inputs` expressions, `env`-based secret mapping and the
flyctl/Vercel steps are all clean.

### 2. CI anchor grep (pinned)

```
$ grep -nE 'verify-app|smoke-e2e|verify-workflows|workflow_call' .github/workflows/ci.yml
7:  workflow_call:
13:  verify-app:
14:    name: verify-app
38:  smoke-e2e:
39:    name: smoke-e2e
53:  verify-workflows:
54:    name: verify-workflows
exit=0
```

### 3. Deploy anchor grep (pinned)

```
$ grep -nE 'branches: \[develop, main\]|workflow_dispatch|environment|fly.config.toml|migrate-cli|vercel|deployed-smoke|VITE_CLOUD_DEPLOY.*true|VITE_API_URL' .github/workflows/deploy.yml
5:    branches: [develop, main]
6:  workflow_dispatch:
8:      environment:
16:  group: deploy-${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development') }}
32:    environment: ${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development') }}
34:      TARGET_ENVIRONMENT: ${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development') }}
38:      VITE_API_URL: ${{ vars.VITE_API_URL }}
62:        run: npx --no-install tsx src/backend/src/db/migrate-cli.ts
93:        run: flyctl deploy --remote-only --config fly.config.toml --app "$FLY_APP_NAME" --primary-region "$FLY_REGION" --strategy rolling
99:            body=$(curl -fsS "$VITE_API_URL/healthz" || true)
111:        run: npm install --global vercel@65.15.0
120:            vercel pull --yes --environment=production
122:            vercel pull --yes --environment=preview
130:          VITE_CLOUD_DEPLOY: "true"
131:          VITE_API_URL: ${{ vars.VITE_API_URL }}
135:            vercel build --prod
137:            vercel build
140:        id: vercel_deploy
148:            deploy_output=$(vercel deploy --prebuilt --prod --yes)
150:            deploy_output=$(vercel deploy --prebuilt --yes)
162:          DEPLOYMENT_URL: ${{ steps.vercel_deploy.outputs.deployment_url }}
166:          vercel alias set "$DEPLOYMENT_URL" "$frontend_host"
171:          SMOKE_API_URL: ${{ vars.VITE_API_URL }}
179:          node tests/e2e/deployed-smoke.mjs
exit=0
```

### 4. Vercel cwd pin (pinned; count recorded)

```
$ grep -nE 'working-directory: src/frontend|--cwd src/frontend' .github/workflows/deploy.yml
113:        working-directory: src/frontend
125:        working-directory: src/frontend
141:        working-directory: src/frontend
157:        working-directory: src/frontend
count=4
```

The four lines are the `Pull Vercel project settings`, `Build Vercel frontend`,
`Deploy Vercel frontend` and `Alias development deployment` steps — every Vercel `pull`/`build`/
`deploy`/`alias` command is covered (the structural audit asserts the step-to-command mapping).

### 5. Pinned negative-token grep — **FAILS (false positive)**

```
$ grep -nE 'verify-infra|terraform|aws-actions|id-token|AWS_|ecr|ecs' .github/workflows/ci.yml .github/workflows/deploy.yml
.github/workflows/deploy.yml:60:          DATABASE_URL: ${{ secrets.DATABASE_URL }}
.github/workflows/deploy.yml:61:          DIRECT_DATABASE_URL: ${{ secrets.DIRECT_DATABASE_URL }}
.github/workflows/deploy.yml:68:          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
.github/workflows/deploy.yml:69:          DATABASE_URL: ${{ secrets.DATABASE_URL }}
.github/workflows/deploy.yml:70:          DIRECT_DATABASE_URL: ${{ secrets.DIRECT_DATABASE_URL }}
.github/workflows/deploy.yml:71:          SMTP_PASS: ${{ secrets.SMTP_PASS }}
.github/workflows/deploy.yml:73:          flyctl secrets set --stage --app "$FLY_APP_NAME" \
.github/workflows/deploy.yml:92:          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
.github/workflows/deploy.yml:115:          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
.github/workflows/deploy.yml:127:          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
.github/workflows/deploy.yml:143:          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
.github/workflows/deploy.yml:159:          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
exit=0
```

Diagnosis: every one of the 12 matches is the literal substring `ecr` inside the word `secrets`
(`s-e-c-r-e-t-s`) or inside the `flyctl secrets set` command. No line contains an AWS, ECR, ECS,
OIDC, Terraform, `verify-infra` or `id-token` reference. Because GitHub Actions requires the
`secrets.<NAME>` context for every secret (and AC-14/AC-16 require `deploy.yml` to reference
`VERCEL_TOKEN`, `FLY_API_TOKEN`, `DATABASE_URL`, `DIRECT_DATABASE_URL` and `SMTP_PASS`), **no
workflow that satisfies AC-12..AC-16 can also satisfy this exact grep**. This is a defect in the
verification command, not in the workflow.

Proof of no provider token (same files, word-bounded/token-aware):

```
$ python3 /tmp/opencode/t5-verify.py   # § 6 audit, token section
PASS no verify-infra reference
PASS no terraform reference
PASS no aws-actions reference
PASS no id-token reference
PASS no AWS_ reference
PASS no amazon-ecr reference
PASS no amazon-ecs reference
PASS no ECS reference
PASS no ECR reference
PASS no OIDC reference
```

### 6. Structural audit (PyYAML; supplementary proof)

Full output (script: parse both workflows, assert the trigger/job/step/order/pin/env contracts):

```
PASS ci triggers on pull_request
PASS ci push branches = [main, develop] — ['main', 'develop']
PASS ci exposes workflow_call
PASS ci workflow permissions = contents: read — {'contents': 'read'}
PASS ci jobs = verify-app, smoke-e2e, verify-workflows — ['verify-app', 'smoke-e2e', 'verify-workflows']
PASS ci verify-app runs the six gates in order — ['npm ci', 'npm run lint', 'npm run typecheck', 'npm test', 'npm run coverage', 'npm run build']
PASS ci smoke-e2e pre-starts Mailpit before smoke — ['docker compose -f compose.yaml -f compose.smoke.yaml up -d mailpit', 'docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke', 'docker compose -f compose.yaml -f compose.smoke.yaml down -v']
PASS ci verify-workflows pins actionlint 1.7.12 over all workflows
PASS ci verify-workflows parses vercel.json
PASS ci verify-workflows anchors fly.config.toml
PASS deploy push branches = [develop, main] — ['develop', 'main']
PASS deploy workflow_dispatch environment is a required choice — {'description': 'GitHub Environment to deploy', 'type': 'choice', 'required': True, 'default': 'development', 'options': ['development', 'production']}
PASS deploy dispatch options = development, production — ['development', 'production']
PASS deploy default environment = development — development
PASS deploy concurrency is per-environment — deploy-${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development') }}
PASS deploy concurrency does not cancel in progress — False
PASS deploy workflow permissions = contents: read — {'contents': 'read'}
PASS deploy verify job calls ci.yml — ./.github/workflows/ci.yml
PASS deploy job needs verify — verify
PASS deploy job is environment-gated — ${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development') }}
PASS deploy steps run migrate -> Fly -> health -> Vercel -> smoke — Checkout -> Setup Node -> Install dependencies -> Migrate Neon database -> Setup flyctl -> Stage Fly runtime configuration -> Deploy Fly backend -> Verify Fly backend health -> Install Vercel CLI -> Pull Vercel project settings -> Build Vercel frontend -> Deploy Vercel frontend -> Alias development deployment -> Run deployed smoke
PASS migration uses the tsx CLI with DIRECT_DATABASE_URL — {'name': 'Migrate Neon database', 'env': {'DATABASE_URL': '${{ secrets.DATABASE_URL }}', 'DIRECT_DATABASE_URL': '${{ secrets.DIRECT_DATABASE_URL }}'}, 'run': 'npx --no-install tsx src/backend/src/db/migrate-cli.ts'}
PASS Fly secrets staged with the exact flag order
PASS Fly secret staged: DATABASE_URL
PASS Fly secret staged: DIRECT_DATABASE_URL
PASS Fly secret staged: CORS_ORIGIN
PASS Fly secret staged: ALLOWED_ORIGIN
PASS Fly secret staged: APP_BASE_URL
PASS Fly secret staged: SMTP_HOST
PASS Fly secret staged: SMTP_PORT
PASS Fly secret staged: SMTP_USER
PASS Fly secret staged: SMTP_PASS
PASS Fly secret staged: SMTP_FROM
PASS Fly secret staged: SESSION_COOKIE_SECURE
PASS Fly secret staged: SESSION_COOKIE_SAMESITE
PASS Fly secret staged: MAX_USERS_PER_SERVER
PASS Fly deploy uses fly.config.toml, app/region flags, rolling — flyctl deploy --remote-only --config fly.config.toml --app "$FLY_APP_NAME" --primary-region "$FLY_REGION" --strategy rolling
PASS Fly steps read FLY_API_TOKEN from secrets
PASS health check asserts exact {"status":"ok"}
PASS four Vercel steps (pull/build/deploy/alias) — ['Pull Vercel project settings', 'Build Vercel frontend', 'Deploy Vercel frontend', 'Alias development deployment']
PASS every Vercel step runs from src/frontend — [('Pull Vercel project settings', 'src/frontend'), ('Build Vercel frontend', 'src/frontend'), ('Deploy Vercel frontend', 'src/frontend'), ('Alias development deployment', 'src/frontend')]
PASS Vercel CLI pinned exactly — npm install --global vercel@65.15.0
PASS Vercel pull production for production, preview for development
PASS Vercel build sets VITE_CLOUD_DEPLOY=true — true
PASS Vercel build sets VITE_API_URL from vars — ${{ vars.VITE_API_URL }}
PASS Vercel build sets optional VITE_WS_URL from vars — ${{ vars.VITE_WS_URL }}
PASS Vercel deploy uses --prebuilt with --prod only for production
PASS Alias only runs for development — env.TARGET_ENVIRONMENT != 'production'
PASS Alias targets the stable FRONTEND_ORIGIN host
PASS Vercel steps read token/org/project ids from env
PASS deployed smoke runs the T4 script — if [ -z "$SMOKE_WS_URL" ]; then
  SMOKE_WS_URL="${SMOKE_API_URL/https:/wss:}/ws"
  export SMOKE_WS_URL
fi
node tests/e2e/deployed-smoke.mjs
PASS deployed smoke receives FRONTEND/API/WS/ORIGIN — {'SMOKE_FRONTEND_URL': '${{ vars.FRONTEND_ORIGIN }}', 'SMOKE_API_URL': '${{ vars.VITE_API_URL }}', 'SMOKE_WS_URL': '${{ vars.VITE_WS_URL }}', 'SMOKE_ORIGIN': '${{ vars.FRONTEND_ORIGIN }}'}
PASS deploy.yml references secrets.VERCEL_TOKEN
PASS deploy.yml references secrets.FLY_API_TOKEN
PASS deploy.yml references secrets.DATABASE_URL
PASS deploy.yml references secrets.DIRECT_DATABASE_URL
PASS deploy.yml references secrets.SMTP_PASS
PASS deploy.yml references vars.VERCEL_ORG_ID
PASS deploy.yml references vars.VERCEL_PROJECT_ID
PASS deploy.yml references vars.FLY_APP_NAME
PASS deploy.yml references vars.FLY_REGION
PASS deploy.yml references vars.FRONTEND_ORIGIN
PASS deploy.yml references vars.VITE_API_URL
PASS deploy.yml references vars.VITE_WS_URL
PASS deploy.yml references vars.SMTP_HOST
PASS deploy.yml references vars.SMTP_PORT
PASS deploy.yml references vars.SMTP_USER
PASS deploy.yml references vars.SMTP_FROM
PASS deploy.yml references vars.SESSION_COOKIE_SECURE
PASS deploy.yml references vars.SESSION_COOKIE_SAMESITE
PASS deploy.yml references vars.MAX_USERS_PER_SERVER
PASS action pinned to full SHA: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
PASS version comment after pin: actions/checkout
PASS action pinned to full SHA: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
PASS version comment after pin: actions/setup-node
PASS action pinned to full SHA: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
PASS version comment after pin: actions/checkout
PASS action pinned to full SHA: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
PASS version comment after pin: actions/checkout
PASS local reusable workflow: ./.github/workflows/ci.yml
PASS action pinned to full SHA: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
PASS version comment after pin: actions/checkout
PASS action pinned to full SHA: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
PASS version comment after pin: actions/setup-node
PASS action pinned to full SHA: superfly/flyctl-actions/setup-flyctl@fc53c09e1bc3be6f54706524e3b82c4f462f77be
PASS version comment after pin: superfly/flyctl-actions/setup-flyctl
PASS target environment: input=None ref=refs/heads/main — production
PASS target environment: input=None ref=refs/heads/develop — development
PASS target environment: input=production ref=refs/heads/develop — production
PASS target environment: input=development ref=refs/heads/main — development
PASS no verify-infra reference
PASS no terraform reference
PASS no aws-actions reference
PASS no id-token reference
PASS no AWS_ reference
PASS no amazon-ecr reference
PASS no amazon-ecs reference
PASS no ECS reference
PASS no ECR reference
PASS no OIDC reference

0 failure(s)
structural_exit=0
```

### 7. Floating-action-tag grep (pinned)

```
$ grep -E 'uses: .*@v[0-9]+' .github/workflows/*.yml
(no output)
exit=1
```

All remote `uses:` are 40-hex SHA pins with version comments; the only non-SHA `uses:` is the local
reusable workflow `./.github/workflows/ci.yml`.

### 8. `npm run coverage` (pinned regression gate) → exit 0

```
> coverage
> npm run coverage --workspaces --if-present

 RUN  v3.2.7 .../src/backend
 Test Files  32 passed (32)
      Tests  1110 passed (1110)
All files          |   95.25 |    88.68 |   99.53 |   95.25 |

 RUN  v3.2.7 .../src/frontend
 Test Files  70 passed (70)
      Tests  1873 passed (1873)
All files          |   96.48 |    96.14 |   97.56 |   96.48 |
coverage_exit=0
```

All four metrics are above the 80 threshold in both workspaces. No application code changed in T5.

### 9. Root lint/typecheck (regression)

```
$ npm run lint
> eslint .
lint_exit=0

$ npm run typecheck
> npm run typecheck --workspaces --if-present
> tsc --noEmit   (backend)
> tsc --noEmit   (frontend)
typecheck_exit=0
```

### 10. Scope, hygiene and credential audits

```
$ git status --porcelain
 M .github/workflows/ci.yml
 M .github/workflows/deploy.yml
 M docs/features/vercel-fly-neon-deployment/status.md   <- orchestrator-owned, pre-existing before T5
?? docs/features/vercel-fly-neon-deployment/build-log-T5.md

$ git diff --stat
 .github/workflows/ci.yml                           |  32 ++-
 .github/workflows/deploy.yml                       | 243 +++++++++++++--------
 docs/features/vercel-fly-neon-deployment/status.md |   9 +-
 3 files changed, 173 insertions(+), 111 deletions(-)
```

Only the task's two owned workflow files were edited; `status.md` is the orchestrator's pre-existing
T4-completion edit and is not part of T5. No source, config, smoke script, compose, Terraform,
nginx, or doc outside the feature directory changed.

```
$ git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'
(no output; exit 1)
$ git grep -nE "VERCEL_TOKEN=|FLY_API_TOKEN=|FlyV1 " -- . ':(exclude)docs/'
(no output; exit 1)
$ git grep -nE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" -- .github infra src ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx'
(no output; exit 1)
```

No secret, token, connection string or `.env*` edit was introduced; the only credential references
are the `${{ secrets.<NAME> }}` context names listed in the environment catalog.

Trailing-newline hygiene (existing workflow-hygiene rule):

```
$ tail -c 1 .github/workflows/ci.yml | od -An -tuC   ->  10
$ tail -c 2 .github/workflows/ci.yml | od -An -tuC   -> 105  10   (not "10 10")
$ tail -c 1 .github/workflows/deploy.yml | od -An -tuC ->  10
$ tail -c 2 .github/workflows/deploy.yml | od -An -tuC -> 115  10  (not "10 10")
```

### 11. Pin resolution evidence

```
$ npm view vercel version
65.15.0
$ npm view vercel dist-tags
{ "latest": "65.15.0", "snapshot": "65.15.0-snapshot-9209a1e84cf9", "canary": "65.15.0" }
```

```
GitHub API (MCP):
  GET releases (superfly/flyctl-actions, latest): tag_name "1.5", published_at 2024-02-02
  GET tag "1.5": object.type "commit", object.sha "fc53c09e1bc3be6f54706524e3b82c4f462f77be"
  GET setup-flyctl/action.yml @ fc53c09e...: "name: Set up flyctl", runs.using: node20
```

## Acceptance audit

- **AC-12 — met by the implementation; pinned negative grep defective as written.** `ci.yml` triggers
  on `pull_request`, push to `main` and `develop`, and `workflow_call`; `verify-app` runs
  `npm ci`/lint/typecheck/test/coverage/build; `smoke-e2e` keeps the Mailpit pre-start + unchanged
  smoke recipe; `verify-workflows` runs pinned `rhysd/actionlint:1.7.12` over
  `.github/workflows/*.yml` plus the `vercel.json` JSON parse and `fly.config.toml` anchors;
  `verify-infra`/Terraform is removed; workflow-level `permissions: contents: read`; every
  third-party `uses:` is a full 40-hex SHA with a version comment; no `id-token`/AWS token exists
  (token-aware audit § 5). The exact pinned grep is unsatisfiable because of the `secrets` substring
  (§ 5).
- **AC-13 — met by the implementation; same check caveat.** Triggers and the required
  `workflow_dispatch` choice are present; the effective target is production for `main`/explicit
  production and development otherwise (truth table § 6); concurrency is
  `deploy-<target>` with `cancel-in-progress: false`; `verify` calls `./.github/workflows/ci.yml`;
  one `deploy` job with `environment:` runs checkout/install → Neon migration
  (`npx --no-install tsx src/backend/src/db/migrate-cli.ts`, `DIRECT_DATABASE_URL`) → Fly secrets +
  `flyctl deploy` → exact `/healthz` assertion → Vercel pull/build/deploy `--prebuilt` + alias
  (all four from `src/frontend`) → deployed smoke (§ 3, § 6). No `id-token`, `aws-actions`,
  `terraform`, `ecr`, `ecs` or `AWS_` token (token-aware audit § 5).
- **AC-14 — implementation ready; doc side is T6.** The exact catalog is recorded above with the
  secret/var split and per-environment shapes; every one of the 19 names is referenced by
  `deploy.yml` (structural audit § 6). `development`/`production` are the only environments.
  `docs/architecture/vercel-fly-neon.md` is T6's artifact; the reviewer should use this table as the
  T5 source of truth. Protection rules (production reviewer + `main`-only) are GitHub Environment
  settings, documented above and verified live in T7.
- **AC-15 — met.** Vercel CLI exact `65.15.0`; `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`
  read from `env:` only; all four commands (`pull`, `build`, `deploy`, `alias`) run from
  `working-directory: src/frontend` (count 4); pull uses `production` for production and `preview`
  for development; the build sets `VITE_CLOUD_DEPLOY=true` and `VITE_API_URL` (+ optional
  `VITE_WS_URL`); production adds `--prod` to build/deploy; only the development deployment is
  aliased, to the stable `FRONTEND_ORIGIN` host. The first live build log proving
  Root Directory/cwd is a T7 prerequisite (recorded above; no fallback applied).
- **AC-16 — met.** flyctl installed through
  `superfly/flyctl-actions/setup-flyctl@fc53c09e1bc3be6f54706524e3b82c4f462f77be # v1.5`;
  `flyctl secrets set --stage --app "$FLY_APP_NAME"` stages the pooled `DATABASE_URL` and the direct
  `DIRECT_DATABASE_URL` (plus CORS/allowed-origin/app-base, SMTP, cookie and room-capacity values);
  `flyctl deploy --remote-only --config fly.config.toml --app "$FLY_APP_NAME" --primary-region "$FLY_REGION" --strategy rolling`;
  the health check asserts `curl -fsS "$VITE_API_URL/healthz"` equals `{"status":"ok"}`;
  `FLY_API_TOKEN` is env-mapped from `secrets.FLY_API_TOKEN` and never printed or passed on argv.
- **AC-19/AC-20/AC-21/AC-22 — not T5 gates.** Live deploy proof is T7; no compose/nginx/smoke/
  Terraform file changed; documentation/supersession is T6.

## Deviation / open question (historical — resolved by the corrected check below)

**Historical (first round).** `tasks.md` was corrected to the provider-qualified pattern and the
corrected audit returns no match (§ Correction and completion); this section records the original
false-positive evidence, not an open item.

The only failed check was the original tasks.md line:

```
grep -nE 'verify-infra|terraform|aws-actions|id-token|AWS_|ecr|ecs' .github/workflows/ci.yml .github/workflows/deploy.yml   # (no match)
```

It matches the `ecr` alternative inside `secrets` (12 false positives, § 5). Proposed correction
(one of):

1. Word-bounded / token-aware: `grep -nE 'verify-infra|terraform|aws-actions|id-token|AWS_|\becr\b|\becs\b' ...` or
   `grep -nE 'amazon-ecr|amazon-ecs|AWS_ECR|AWS_ECS|ecr\.[a-z]|ecs\.[a-z]' ...`; or
2. Keep the literal command and record an explicit waiver that `secrets` is the only match.

No workflow change can satisfy both AC-13/AC-14/AC-16 and the literal command. The workflow files
and this log are left in the worktree (uncommitted) for the next round; after the check is amended,
the only remaining action is to re-run the pinned commands and commit with
`ci: deploy vercel frontend and fly backend`. T5 was not marked complete and T6-T7 were not started.

Deviations from spec: none in the implementation. The only deviation is the uncommitted state forced
by the defective verification command.

## Correction and completion (2026-11-13)

The T5 verify check in `tasks.md` was corrected from the original
`verify-infra|terraform|aws-actions|id-token|AWS_|ecr|ecs` to the provider-qualified
`verify-infra|terraform|aws-actions|id-token|AWS_|amazon-ecr|amazon-ecs|AWS_ECR|AWS_ECS`
(`secrets` no longer false-positives). Corrected audit on the unchanged workflows:

```
$ grep -nE 'verify-infra|terraform|aws-actions|id-token|AWS_|amazon-ecr|amazon-ecs|AWS_ECR|AWS_ECS' .github/workflows/ci.yml .github/workflows/deploy.yml
(no output)
corrected_grep_exit=1
```

### actionlint re-run

```
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml
(no output)
actionlint_exit=0
```

### `npm run coverage` re-run

```
> coverage
> npm run coverage --workspaces --if-present

 RUN  v3.2.7 .../src/backend
 Test Files  32 passed (32)
      Tests  1110 passed (1110)
All files          |   95.25 |    88.68 |   99.53 |   95.25 |

 RUN  v3.2.7 .../src/frontend
 Test Files  70 passed (70)
      Tests  1873 passed (1873)
All files          |   96.48 |    96.14 |   97.56 |   96.48 |
coverage_exit=0
```

T5's pinned verification is green: actionlint exit 0, corrected negative grep no match, the CI and
deploy anchor greps and the 4/4 `working-directory: src/frontend` pin unchanged (§ 2–§ 4), the
floating-tag grep no match (§ 7), and coverage ≥ 80 on all four metrics in both workspaces. The
workflow implementation was not modified in this round. Commit:
`ci: deploy vercel frontend and fly backend` — exactly `.github/workflows/ci.yml`,
`.github/workflows/deploy.yml`, this build log, and the corrected `tasks.md`.
