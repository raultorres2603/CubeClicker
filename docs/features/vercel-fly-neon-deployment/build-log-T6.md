# Build log — T6 — Documentation, supersession, local-path preservation

Task: T6 (2026-11-14) — `docs/features/vercel-fly-neon-deployment/tasks.md` (AC-17, AC-20, AC-21, AC-22)

Files changed:
- `docs/architecture/deployment.md` (rewritten for Vercel + Fly.io + Neon)
- `docs/architecture/vercel-fly-neon.md` (new; six required H2 sections)
- `README.md` (Deployment section rewritten; Quickstart/local path untouched)
- `docs/architecture/stack.md` (provider sentence)
- `docs/architecture/containerization.md` (provider, proxy, release-identity and frontend-delivery sentences)
- `AGENTS.md` (provider sentence, proof-of-working examples, `develop`/`main` branch model)
- `infra/README.md` (`SUPERSEDED` banner; AWS + Terraform retained in place)
- `docs/features/vercel-fly-neon-deployment/build-log-T6.md` (this log)

What changed & why (≤5 lines):
- `deployment.md` now documents the current architecture (Vercel static frontend, one always-on Fly
  backend machine, Neon pooled/direct URLs), environments/triggers, secrets/variables, deploy order,
  migrations, rollback, DNS/cookies, the single-machine trade-off, the canonical credential audit and
  an explicitly historical/superseded AWS section plus ledgers.
- `vercel-fly-neon.md` adds the architecture diagram, the exact 19-name environment catalog, the
  runbook, rollback, local-vs-cloud and cost/limits sections required by AC-21.
- README's Deployment section is rewritten and links both docs while Quickstart/`podman compose up`
  stays untouched; stack/containerization/AGENTS provider sentences point at Vercel/Fly/Neon.
- `infra/README.md` begins with a `SUPERSEDED` banner: retained, not deployed, not destroyed.
- No compose, Dockerfile, nginx, smoke, workflow, Terraform or source file changed.

Decisions:
- **Documentation-only task.** No runtime behavior changed, so no new unit/integration tests are
  applicable; the pinned `npm test -w @cubeclicker/frontend` docs-link test and the full frontend
  suite were run, plus root lint/typecheck and the root coverage regression gate.
- **Environment catalog is canonical in `vercel-fly-neon.md`.** `deployment.md` lists the same 19
  names by classification and links the catalog, so every name from AC-14 is present and traced to
  `deploy.yml` without hiding the values (values are user-supplied and never committed).
- **AWS mentions are confined to explicitly historical context.** The historical table maps each
  superseded component to its replacement; the only non-table `AWS` strings are the supersession
  sentence, the superseded-era credential-audit wording/command (retained verbatim by T6), the
  historical section heading/intro, and the stale-assumptions ledger bullet. Classification is
  recorded below.
- **`AGENTS.md` branch model.** The spec/plan (Q-3) and the approved status entry selected
  `develop` as the integration branch with `main` for production, so the one-line branch bullet was
  amended (`develop` = `development` environment; accepted work merges to `main` = `production`).
- **No `docs/features/README.md` edit.** The proposed row is recorded below for the orchestrator.

## Evidence

### 1. `test -f docs/architecture/vercel-fly-neon.md`

```
$ test -f docs/architecture/vercel-fly-neon.md
exit=0
```

### 2. Six required H2 sections

```
$ grep -nE '^## (Architecture|Environment catalog|Runbook|Rollback|Local development vs cloud|Cost and limits)$' docs/architecture/vercel-fly-neon.md
5:## Architecture
26:## Environment catalog
56:## Runbook
119:## Rollback
161:## Local development vs cloud
182:## Cost and limits
exit=0
```

Exactly six H2 headings; no other `##` heading exists in the file.

### 3. `grep -nE 'Vercel|Fly|Neon|development|production' docs/architecture/deployment.md`

```
$ grep -nE 'Vercel|Fly|Neon|development|production' docs/architecture/deployment.md
3:CubeClicker deploys to three managed platforms: **Vercel** serves the React/Vite SPA as a static build, **Fly.io** runs the Fastify + `@fastify/websocket` backend container as one always-on machine, and **Neon** provides PostgreSQL for accounts, sessions, verification tokens, economy and customization. **GitHub Actions** is the single CI/CD pipeline, with the `development` and `production` GitHub Environments holding every per-environment secret and variable. The user selected this platform on 2026-11-13, superseding the earlier AWS (ECS/ALB/RDS/ECR + Terraform) target, which is now historical (see § Superseded AWS deployment).
5:The application itself is unchanged: game logic, server authority, in-memory rooms, the WebSocket protocol, the auth model and the database schema are the same as local. The local `podman compose up` path is unchanged too (see `../../README.md` § Quickstart). The container images remain provider-neutral deployables (see `containerization.md`); Vercel hosts the static frontend build, not the backend.
14:| Static SPA (`src/frontend`) | Vercel CDN | Nothing but the built HTML/JS/CSS; no functions, no serverless backend |
15:| HTTP API + WebSocket (`/auth/*`, `/healthz`, `/ws`) | Fly.io, one machine | All live game/room state (in memory, one process) and auth sessions |
16:| PostgreSQL | Neon | Durable accounts, sessions, verification tokens, economy and customization rows only |
19:- **Game state stays on Fly.** Rooms are in-memory, server-authoritative and per process. One machine is the pinned topology; two or more machines would split the room registry. See § Single-machine trade-off. Neon is never used for game/room state, and Vercel owns no application state.
20:- **Data flow.** Browser → Vercel for HTML/JS/CSS; browser → Fly for `/auth/*` (`fetch`, `credentials: 'include'`) and `/ws` (`wss://`). The session cookie is host-only for the Fly API host and is attached on both requests and the WebSocket upgrade; the backend resolves the account from the upgrade cookie exactly as locally.
21:- **Deploy flow.** GitHub Actions runs `verify` (the reusable `ci.yml` gates) and then one environment-gated `deploy` job: Neon migration (direct URL) → Fly secrets + deploy + `/healthz` → Vercel pull/build/deploy/alias → deployed smoke. Backend before frontend, because the frontend build bakes the API/WS URLs and should only point at a live, migrated backend.
25:| | `development` | `production` |
28:| Manual trigger | `workflow_dispatch` with `environment: development` | `workflow_dispatch` with `environment: production` |
29:| Frontend | Vercel preview deployment aliased to the stable `FRONTEND_ORIGIN` host | Vercel production deployment at the `FRONTEND_ORIGIN` domain |
30:| Backend | development Fly app (`FLY_APP_NAME`) | production Fly app (`FLY_APP_NAME`) |
31:| Database | Neon `development` branch | Neon `production` branch (protected) |
33:| Concurrency | `deploy-development`, `cancel-in-progress: false` | `deploy-production`, `cancel-in-progress: false` |
35:- The effective environment is `github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development')`, used identically by the concurrency group and the `deploy` job's `environment:`. A dispatch chooses explicitly; environment protection rules still apply.
36:- There is no third environment. `development` and `production` are fully isolated: separate GitHub Environment secrets/variables, separate Fly apps, separate Neon branches and separate frontend hostnames. A development deploy can never touch production data.
37:- The branch model is recorded in `../../AGENTS.md` § Conventions: feature work integrates on `develop` (the development environment) and reaches `main` (the production environment) only after acceptance.
45:- `VITE_*` values are public client configuration baked into the Vercel build; they are not secrets. `VITE_WS_URL` is optional: the resolver derives `wss://<api-host>/ws` from `VITE_API_URL` when it is empty.
46:- Fly runtime configuration is staged with `flyctl secrets set --stage` from the environment values, plus `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`. `DATABASE_URL` (pooled) serves application queries and `DIRECT_DATABASE_URL` (direct) serves the startup migration. Secrets are injected at deploy time and are never baked into the image or echoed in logs.
47:- Tokens are read through `env:`/`secrets.*` only: `FLY_API_TOKEN` is never passed as a command-line argument, and the Vercel commands read `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from the environment.
52:- `../../.github/workflows/deploy.yml` runs `verify` through `workflow_call`, then the single environment-gated `deploy` job in this fixed order: checkout/install → Neon migration → Fly secrets/deploy/health → Vercel pull/build/deploy/alias → deployed smoke (`../../tests/e2e/deployed-smoke.mjs`).
53:- Every Vercel command runs with `working-directory: src/frontend`, so the project's `vercel.json`, build command, output directory, SPA rewrite and cache headers are the ones used. The Vercel project Root Directory is `src/frontend`; the CLI cwd is a second guard.
54:- The Vercel build receives `VITE_CLOUD_DEPLOY=true`, `VITE_API_URL` and the optional `VITE_WS_URL`. Cloud mode fails the build when the API URL is missing/relative or the resolved WS URL is not `wss://`.
55:- Failed gates block the deploy before any provider is touched. `deploy.yml` contains only Vercel, Fly and Neon steps.
57:## Neon migrations
59:- One Neon project, two branches: `development` and `production`; the production branch is protected. Application and migration URLs always carry `sslmode=require`.
60:- `DATABASE_URL` is the pooled `-pooler` URL for the Fly app's runtime queries. `DIRECT_DATABASE_URL` is the direct URL for the CI migration job and the Fly startup migration, which runs on a dedicated `pg.Client` so `BEGIN`, every statement and `COMMIT` share one connection (PgBouncer transaction pooling is not used for migrations).
61:- Ordering is fixed: **migrate → backend deploy → frontend deploy**. CI runs `npx --no-install tsx src/backend/src/db/migrate-cli.ts` with `DIRECT_DATABASE_URL` before Fly; the image also packages `dist/db/migrations`, so the startup migration is an idempotent safety net and a no-op after CI. `node dist/db/migrate-cli.js --list` lists migration names without opening a connection.
69:- **Frontend:** `vercel rollback <previous-deployment-url-or-id>` (production) or `vercel promote <deployment-url>`; re-point the development alias with `vercel alias set <deployment> <host>`.
72:- **Database:** no automatic down migrations. If a schema change must be undone, create a Neon branch from the pre-migration point in time (PITR), validate it, then repoint `DATABASE_URL`/`DIRECT_DATABASE_URL` to the restored branch.
73:- **After any rollback:** re-run the deployed smoke and check `/healthz`; a Fly rollback restarts the machine, so clients reconnect and in-memory rooms reset (expected).
77:- `FRONTEND_ORIGIN` is the single stable public frontend origin per environment (a Vercel alias or custom domain); unique per-deployment preview URLs are never used as a CORS/CSRF origin. `VITE_API_URL` is the stable Fly (or custom `api.`) origin.
78:- Recommended production topology: first-party subdomains under one registrable domain (`app.<domain>` on Vercel, `api.<domain>` on Fly), so the session cookie is first-party and `SameSite=Lax` remains viable.
81:- The browser opens `wss://<api-host>/ws`; an `https://` page cannot use `ws://`, and the resolver rejects it in cloud builds. Fly terminates TLS and proxies WebSocket upgrades without extra configuration; the existing 30 s heartbeat and reconnect policy are unchanged.
82:- HTTPS is forced on Fly (`force_https = true`) and provided by Vercel for the frontend. No certificate or DNS asset is created by this repository's pipeline; domains are user-owned.
86:- The backend runs as exactly one always-on Fly machine (`auto_stop_machines = "off"`, `auto_start_machines = false`, `min_machines_running = 1`, 512 MB shared-CPU). In-memory rooms are the reason: a second machine would serve a different room registry and clients would stop seeing each other.
88:- Health is `GET /healthz` → `200` `{"status":"ok"}`, checked by Fly every 15 s (10 s grace, 5 s timeout) and asserted by the deploy job before the frontend step. The deployed smoke then proves health, CORS, SPA fallback, a real `/assets/*` 404 and a WebSocket hello/join/click.
99:  The connection-string audit is scoped to runtime/config trees and excludes colocated test fixtures: `git grep -nE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" -- .github infra src ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx'`. The token audit is `git grep -nE "VERCEL_TOKEN=|FLY_API_TOKEN=|FlyV1 " -- . ':(exclude)docs/'`.
100:- CORS never uses `*` with credentials; `SameSite=None` requires `Secure`; the WebSocket `Origin` guard is always on for present origins. The `development` and `production` secrets are separate, and production requires a reviewer.
108:| AWS ECS Fargate services + ALB (WebSocket passthrough, `idle_timeout = 90`) | One Fly.io machine + Fly Proxy (`/ws` upgrade passthrough) |
109:| AWS RDS PostgreSQL + Secrets Manager master password | Neon PostgreSQL, pooled/direct URLs per branch |
110:| AWS ECR image registry + SHA-tagged release images | Fly release images built from `src/backend/Dockerfile` target `prod`; the commit SHA is the release identity |
114:| Manual `workflow_dispatch` deploy; `deploy-services` placeholder | `develop` → `development`, `main` → `production` behind required reviewers; one deploy job |
115:| `PUBLIC_WS_URL` baked into the frontend image at build time | `VITE_CLOUD_DEPLOY=true` + `VITE_API_URL`/optional `VITE_WS_URL` baked by the Vercel build; the nginx image keeps the local/smoke contract |
125:- `manual-deploy-trigger` — **superseded** (trigger policy); replaced by branch-driven environments with the production reviewer gate.
127:- `frontend-delivery-hardening` — **partially superseded** (cloud edge only): Vercel replaces nginx as the cloud frontend; the hashed-asset immutability, app-shell `no-cache`, SPA fallback and real `/assets/*` 404 semantics are replicated in `src/frontend/vercel.json`, and the nginx image remains for local/smoke/portability.
exit=0
```

### 4. `grep -nE 'SUPERSEDED|not deployed|not destroyed' infra/README.md`

```
$ grep -nE 'SUPERSEDED|not deployed|not destroyed' infra/README.md
1:# Infrastructure (Terraform + AWS) — SUPERSEDED
3:> **SUPERSEDED — archive in place.**
6:> for reference and history; CI no longer verifies or applies it. AWS resources are **not deployed**
7:> by this feature and are **not destroyed** by it — delete-vs-keep is a user-owned decision
exit=0
```

### 5. `grep -nE 'podman compose up' README.md`

```
$ grep -nE 'podman compose up' README.md
19:podman compose up
33:- Background: `podman compose up -d`
34:- First run, or after dependency/manifest changes: `podman compose up --build`
49:| `npm run dev` | start the full local environment with hot reload (equivalent to `podman compose up`) |
86:The defaults work out of the box. `.env` files are user-owned and are not used by this scaffold — export a variable in your shell instead, e.g. `BACKEND_PORT=9090 podman compose up`. Secrets (database password, SMTP credentials) are supplied via environment variables at runtime and are never committed or baked into images.
exit=0
```

Quickstart/local path unchanged; `podman compose up --build` and `npm run smoke` instructions are untouched.

### 6. `grep -nE 'Vercel|Fly|Neon' docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md`

```
$ grep -nE 'Vercel|Fly|Neon' docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md
docs/architecture/stack.md:40:- Deployable artifacts are container images runnable on any container platform — provider-neutral deployables. The deployment target is **Vercel (static frontend) + Fly.io (backend container) + Neon (PostgreSQL)**, orchestrated by GitHub Actions; the user selected it on 2026-11-13, superseding the earlier AWS target (see `docs/architecture/deployment.md`). The images themselves remain provider-neutral.
docs/architecture/containerization.md:22:- The deployment target is **Vercel (static frontend) + Fly.io (backend container) + Neon (PostgreSQL)**, selected by the user on 2026-11-13 and superseding the earlier AWS target (see `docs/architecture/deployment.md`). That selection does not make the images provider-specific — a platform port swaps deployment artifacts and configuration, not the images.
docs/architecture/containerization.md:29:- Proxy/load-balancer handling is resolved by the deployment target: the Fly.io proxy terminates TLS and passes WebSocket upgrades through without extra configuration (see `docs/architecture/deployment.md`). This document contains no proxy configuration.
docs/architecture/containerization.md:37:- **Image naming/tagging.** `cubeclicker-backend` and `cubeclicker-frontend`; the local (compose-built, `target: dev`) tag is `:dev`. The deployed commit SHA (`github.sha`) is the release identity; Fly keeps prior release images for rollback, and no mutable `:latest` is deployed (see `docs/architecture/deployment.md`).
docs/architecture/containerization.md:41:- **Resolved by the deployment target (this feature).** Proxy/load-balancer upgrade handling → Fly.io proxy WebSocket passthrough (`docs/architecture/deployment.md`); release identity → the deployed commit SHA (`github.sha`) recorded by the pipeline; production runtime-config injection for the frontend → build-time Vercel build values (`VITE_CLOUD_DEPLOY=true`, `VITE_API_URL`, optional `VITE_WS_URL`) while the nginx image keeps the local/smoke contract (`docs/architecture/vercel-fly-neon.md`). The local-dev path and image neutrality are unchanged.
docs/architecture/containerization.md:45:The production frontend image serves the Vite static build with `nginxinc/nginx-unprivileged:1.27-alpine` on port 8080; its delivery contract is pinned in `src/frontend/nginx.conf` and proven on the wire by the containerized smoke test. In the cloud, Vercel serves the same SPA build directly from `src/frontend`, with `src/frontend/vercel.json` replicating the hashed-asset immutability, app-shell `no-cache`, SPA fallback and real `/assets/*` 404 semantics; the nginx `prod` image remains for local/smoke/portability but is no longer the cloud frontend (see `docs/architecture/vercel-fly-neon.md`). The frontend build splits the bundle (a Three.js-free entry plus lazy game-runtime and customization chunks) and enforces the gzip bundle budget, so a budget or initial-graph regression fails the image's `build` stage.
AGENTS.md:8:- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `podman compose up` command (hot reload); deployable artifacts are container images runnable on any container platform (Vercel + Fly.io + Neon selected by the `vercel-fly-neon-deployment` migration, superseding the earlier AWS target; container images remain provider-neutral deployables); future services (databases, queues, etc.) join the same path. Podman and Podman Compose (`podman compose`) are the decided tooling; the container assets live in the repository (`compose.yaml`, Dockerfiles under `src/*`), and the run instructions live in `README.md` (see `docs/architecture/containerization.md`).
AGENTS.md:40:- proof-of-working: a feature is green to go only when its verification evidence is recorded and reproducible: lint, typecheck, tests, `npm run coverage`, plus feature-appropriate proof such as the Mailpit-primed containerized smoke recipe for cross-service behavior or the `actionlint` workflow check plus the Vercel/Fly config checks (`src/frontend/vercel.json` JSON parse, `fly.config.toml` anchors) for deployment/pipeline config changes; raw output lives in the build logs, and the reviewer reproduces it.
exit=0
```

### 7. `grep -nE 'AWS|ECS|ALB|Terraform|OIDC|CloudWatch' docs/architecture/deployment.md`

```
$ grep -nE 'AWS|ECS|ALB|Terraform|OIDC|CloudWatch' docs/architecture/deployment.md
3:CubeClicker deploys to three managed platforms: **Vercel** serves the React/Vite SPA as a static build, **Fly.io** runs the Fastify + `@fastify/websocket` backend container as one always-on machine, and **Neon** provides PostgreSQL for accounts, sessions, verification tokens, economy and customization. **GitHub Actions** is the single CI/CD pipeline, with the `development` and `production` GitHub Environments holding every per-environment secret and variable. The user selected this platform on 2026-11-13, superseding the earlier AWS (ECS/ALB/RDS/ECR + Terraform) target, which is now historical (see § Superseded AWS deployment).
93:- The canonical scoped credential audit is retained verbatim from `workflow-hygiene`. Its AWS patterns cover credentials from the superseded deployment era and must never reappear in any tracked non-doc file:
96:  git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'
102:## Superseded AWS deployment (historical)
104:Everything in this section is **historical and superseded**: it is not provisioned, verified or deployed by the current pipeline. The Terraform tree is archived in place (`../../infra/README.md`) and is **not deployed** or **destroyed** by this feature; deleting it or any live AWS resource is a user-owned decision (spec Q-5).
108:| AWS ECS Fargate services + ALB (WebSocket passthrough, `idle_timeout = 90`) | One Fly.io machine + Fly Proxy (`/ws` upgrade passthrough) |
109:| AWS RDS PostgreSQL + Secrets Manager master password | Neon PostgreSQL, pooled/direct URLs per branch |
110:| AWS ECR image registry + SHA-tagged release images | Fly release images built from `src/backend/Dockerfile` target `prod`; the commit SHA is the release identity |
111:| Terraform (S3 remote state, `verify-infra` fmt/validate gate) | `fly.config.toml` + `src/frontend/vercel.json`, checked by `verify-workflows` (actionlint + JSON parse + TOML anchors) |
112:| GitHub OIDC roles / `id-token: write` AWS deploys | Static `VERCEL_TOKEN`/`FLY_API_TOKEN` environment secrets (no OIDC) |
113:| AWS CloudWatch `awslogs` logs and alarms | `fly logs`/`fly status` and the deployed smoke; provider dashboards are user-owned |
117:- The AWS resources, if any were ever created, are untouched. There is no AWS fallback path in the workflows; if DNS still points at an earlier host, reverting DNS is a user-owned operational decision, not a pipeline step.
118:- `infra/terraform/**` is retained; `git ls-files infra/terraform` is unchanged by this migration. No Terraform state or plan is committed.
128:- `runtime-observability` — **paused, assumptions stale**; its ALB/CloudWatch assumptions do not describe this target, and its artifacts are not edited by this feature.
exit=0
```

**Classification of every match (each is historical/superseded context, never a current-architecture
claim):**

| Line(s) | Match(es) | Classification |
| --- | --- | --- |
| 3 | AWS, ECS, ALB, Terraform | Supersession sentence: explicitly states the AWS target "is now historical" and points at the historical section. |
| 93 | AWS | Introduces the retained credential audit: "AWS patterns cover credentials from the superseded deployment era". |
| 96 | AWS (`AWS_SESSION_TOKEN`) | The canonical scoped credential-audit command, retained verbatim by T6; the pattern guards against credentials from the superseded era. Not an architecture claim. |
| 102 | AWS | H2 heading of the explicitly historical/superseded section. |
| 104 | AWS, Terraform | Historical section intro: "historical and superseded … not provisioned, verified or deployed"; Terraform tree "archived in place". |
| 108 | AWS, ECS, ALB | Historical component row (header says "Historical component (superseded)"); replacement is Fly. |
| 109 | AWS | Historical component row; replacement is Neon. |
| 110 | AWS | Historical component row; replacement is Fly release images. |
| 111 | Terraform | Historical component row; replacement is `fly.config.toml` + `vercel.json` checks. |
| 112 | OIDC, AWS | Historical component row; explicitly "no OIDC" replacement. |
| 113 | AWS, CloudWatch | Historical component row; replacement is `fly logs`/`fly status` + deployed smoke. |
| 117 | AWS | Historical section: AWS resources untouched, no fallback path. |
| 118 | Terraform | Historical section: `infra/terraform/**` retained/archived; no state or plan committed. |
| 128 | ALB, CloudWatch | Ledger bullet: `runtime-observability` is "paused, assumptions stale"; its ALB/CloudWatch assumptions "do not describe this target". |

No AWS/ECS/ALB/Terraform/OIDC/CloudWatch mention outside the historical section, the supersession
sentence, the stale-assumptions ledger bullet, or the retained credential-audit text.

### 8. `grep -nF ":(exclude)docs/" docs/architecture/deployment.md` (canonical scoped audit retained)

```
$ grep -nF ":(exclude)docs/" docs/architecture/deployment.md
96:  git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'
99:  The connection-string audit is scoped to runtime/config trees and excludes colocated test fixtures: `git grep -nE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" -- .github infra src ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx'`. The token audit is `git grep -nE "VERCEL_TOKEN=|FLY_API_TOKEN=|FlyV1 " -- . ':(exclude)docs/'`.
exit=0
```

The canonical command is retained verbatim (line 96): `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'`.

### 9. `grep -nE 'terraform (fmt|validate)' AGENTS.md` (proof examples no longer cite Terraform wrappers)

```
$ grep -nE 'terraform (fmt|validate)' AGENTS.md
exit=1
```

No match (expected); `AGENTS.md:40` now cites the `actionlint` workflow check plus the Vercel
(`vercel.json` JSON parse)/Fly (`fly.config.toml` anchors) config checks, with the proof-of-working
rule otherwise unchanged (see check 6).

### 10. `git diff --name-only` (scope audit)

```
$ git diff --name-only
AGENTS.md
README.md
docs/architecture/containerization.md
docs/architecture/deployment.md
docs/architecture/stack.md
docs/features/vercel-fly-neon-deployment/status.md
infra/README.md
exit=0
```

All tracked edits are T6-owned files plus `status.md` (orchestrator-owned, modified before T6 and not
part of this task). The new `docs/architecture/vercel-fly-neon.md` and this log are untracked until
the commit, so they are evidenced by `git status --porcelain`:

```
$ git status --porcelain
 M AGENTS.md
 M README.md
 M docs/architecture/containerization.md
 M docs/architecture/deployment.md
 M docs/architecture/stack.md
 M docs/features/vercel-fly-neon-deployment/status.md
 M infra/README.md
?? docs/architecture/vercel-fly-neon.md
?? docs/features/vercel-fly-neon-deployment/build-log-T6.md
```

No compose, Dockerfile, nginx, smoke script, workflow, Terraform or source file appears.

### 11. `npm test -w @cubeclicker/frontend` (docs link test + full frontend suite)

```
$ npm test -w @cubeclicker/frontend
 Test Files  70 passed (70)
      Tests  1873 passed (1873)
   Start at  00:25:59
   Duration  3.12s (transform 6.93s, setup 0ms, collect 20.24s, tests 10.29s, environment 6.63s, prepare 5.37s)
exit=0
```

`src/frontend/src/docs/links.test.ts` (the documentation-relative-link test) is part of this suite and
passes.

### 12. `git status --porcelain -- docs/features/README.md` (untouched)

```
$ git status --porcelain -- docs/features/README.md
exit=0
```

Empty output: the orchestrator-owned feature index is unchanged.

### Supplementary checks (documentation accuracy / regression)

Relative links in every changed doc resolve:

```
$ node <link-check script over README.md, docs/architecture/{deployment,vercel-fly-neon,stack,containerization}.md, infra/README.md, AGENTS.md>
ALL RELATIVE LINKS RESOLVE
exit=0
```

Root lint/typecheck and coverage regression:

```
$ npm run lint
lint_exit=0

$ npm run typecheck
typecheck_exit=0

$ npm run coverage
 RUN  v3.2.7 .../src/backend
 Test Files  32 passed (32)
      Tests  1110 passed (1110)
All files          |   95.25 |    88.68 |   99.53 |   95.25 |
 RUN  v3.2.7 .../src/frontend
 Test Files  70 passed (70)
      Tests  1873 passed (1873)
All files          |   96.48 |   96.14 |   97.56 |   96.48 |
coverage_exit=0
```

AC-17 documentation contract strings present in `vercel-fly-neon.md` (excerpt):

```
23:- **Neon contract (AC-17).** One Neon project with two branches: `development` and `production`; the production branch is protected. `DATABASE_URL` is the **pooled** `-pooler` URL with `sslmode=require` for the Fly app's runtime queries. `DIRECT_DATABASE_URL` is the **direct** URL with `sslmode=require`, used by both the CI migration job and the Fly startup migration; both run on a dedicated `pg.Client` (one connection) so `BEGIN`, every migration statement and `COMMIT` share the same connection — never a `pg.Pool` through PgBouncer. Migrations are forward-only and add-only. Only accounts, sessions, verification tokens, economy and customization live in Postgres; the game/room state stays in the single backend process.
20:- **Deploy flow and ordering.** ... **Neon migration with the direct URL → Fly secrets/deploy + `/healthz` → Vercel pull/build/deploy/alias → deployed smoke**. Migrate before backend deploy before frontend deploy ...
```

AC-22 evidence — `infra/terraform/**` retained:

```
$ git ls-files infra/terraform | wc -l
32
```

The count is the pre-feature baseline (no file under `infra/terraform/` was added, moved or deleted).
Supersession ledger rows are present in `spec.md` (lines 191–195 for `aws-deploy-pipeline`,
`manual-deploy-trigger`, `workflow-hygiene`, `frontend-delivery-hardening`, `runtime-observability`);
`deployment.md` § Supersession ledger references points at them.

## Acceptance audit

- **AC-17 — met (documentation contract).** `vercel-fly-neon.md` records one Neon project with
  `development`/`production` branches and a protected production branch; `DATABASE_URL` as the pooled
  `-pooler` URL with `sslmode=require` for Fly runtime queries; `DIRECT_DATABASE_URL` as the direct
  URL with `sslmode=require` for the CI migration and the Fly startup migration on a dedicated
  `pg.Client` (`BEGIN`/statements/`COMMIT` on one connection); the ordering migrate → backend →
  frontend; and that only accounts/sessions/verification/economy/customization live in Postgres while
  game/room state stays in the single backend process. The disposable-branch migration run is T7's
  live proof (recorded there).
- **AC-20 — local path preserved (documentation side).** `README.md` keeps the Quickstart and every
  `podman compose up` instruction; no compose, nginx, frontend Dockerfile or `tests/e2e/smoke.mjs`
  file changed (`git diff --name-only`); `deployment.md`/`vercel-fly-neon.md` state the no-database
  in-memory startup and the unchanged local path. The executable gates (compose smoke, no-database
  test) are T7's final gate.
- **AC-21 — met.** `deployment.md` documents Vercel + Fly + Neon as the current architecture (AWS
  only in the explicitly historical section), the manual rollback and the single-machine trade-off;
  `vercel-fly-neon.md` exists with exactly the six required `##` sections; `README.md`'s Deployment
  section is rewritten and links the new doc; `stack.md`, `containerization.md` and `AGENTS.md` no
  longer claim AWS as the selected deploy target; every relative link in the changed docs resolves
  (supplementary link check) and the docs link test passes.
- **AC-22 — met (documentation side).** `spec.md` carries the five-row supersession ledger plus the
  `infra/terraform/**` archive row; `infra/README.md` begins with the `SUPERSEDED` banner pointing to
  `deployment.md` and states AWS resources are not deployed or destroyed; `infra/terraform/**` is
  retained (`git ls-files infra/terraform | wc -l` = 32); `deployment.md` references the ledger.

## Proposed `docs/features/README.md` row (for the orchestrator; not applied)

```diff
@@
 | frontend-delivery-hardening | Frontend Delivery Hardening (gate-deferred three.js chunk, bundle budget, nginx gzip/immutable assets, prod smoke) | accepted | 2026-11-13 |
 | realtime-broadcast-batching | Real-Time Broadcast Batching (encode-once fan-out, registry index, 40 ms removal batches, 4 Hz economy coalescing) | accepted | 2026-11-13 |
+| vercel-fly-neon-deployment | Vercel + Fly.io + Neon Deployment Migration (Vercel static SPA, Fly backend, Neon Postgres, GitHub Environments) | building | 2026-11-14 |
```

The orchestrator sets the final state/date on acceptance.

## Deviations from spec

- None in scope. Two deliberate documentation choices within T6's owned files:
  - `AGENTS.md`'s branch bullet now records `develop` → `main`, implementing the one-line amendment
    the spec assigns to this feature (Q-3, user-approved).
  - `README.md`'s "Production images" paragraph and the "Deployment section above/below" reference
    were corrected because the frontend nginx image is no longer the cloud edge and the Deployment
    section follows that paragraph.
- No tests were added: this task changes no runtime behavior (documentation only); the docs link
  test and full frontend suite were run instead, and the root gates were run as a regression check.
