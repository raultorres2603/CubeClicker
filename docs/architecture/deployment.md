# Deployment

CubeClicker deploys to three managed platforms: **Vercel** serves the React/Vite SPA as a static build, **Fly.io** runs the Fastify + `@fastify/websocket` backend container as one always-on machine, and **Neon** provides PostgreSQL for accounts, sessions, verification tokens, economy and customization. **GitHub Actions** is the single CI/CD pipeline, with the `development` and `production` GitHub Environments holding every per-environment secret and variable. The user selected this platform on 2026-11-13, superseding the earlier AWS (ECS/ALB/RDS/ECR + Terraform) target, which is now historical (see § Superseded AWS deployment).

The application itself is unchanged: game logic, server authority, in-memory rooms, the WebSocket protocol, the auth model and the database schema are the same as local. The local `podman compose up` path is unchanged too (see `../../README.md` § Quickstart). The container images remain provider-neutral deployables (see `containerization.md`); Vercel hosts the static frontend build, not the backend.

- Canonical reference: `vercel-fly-neon.md` — architecture diagram, exact environment catalog, runbook, rollback, local-vs-cloud, cost and limits.
- Application stack: `stack.md`. Container conventions: `containerization.md`. Feature record: `../features/vercel-fly-neon-deployment/spec.md`.

## Platform split and state ownership

| Surface | Platform | What it owns |
| --- | --- | --- |
| Static SPA (`src/frontend`) | Vercel CDN | Nothing but the built HTML/JS/CSS; no functions, no serverless backend |
| HTTP API + WebSocket (`/auth/*`, `/healthz`, `/ws`) | Fly.io, one machine | All live game/room state (in memory, one process) and auth sessions |
| PostgreSQL | Neon | Durable accounts, sessions, verification tokens, economy and customization rows only |
| CI/CD and configuration | GitHub Actions Environments | Pipeline ordering and per-environment secrets/variables; no runtime application state |

- **Game state stays on Fly.** Rooms are in-memory, server-authoritative and per process. One machine is the pinned topology; two or more machines would split the room registry. See § Single-machine trade-off. Neon is never used for game/room state, and Vercel owns no application state.
- **Data flow.** Browser → Vercel for HTML/JS/CSS; browser → Fly for `/auth/*` (`fetch`, `credentials: 'include'`) and `/ws` (`wss://`). The session cookie is host-only for the Fly API host and is attached on both requests and the WebSocket upgrade; the backend resolves the account from the upgrade cookie exactly as locally.
- **Diagnostics `/metrics`.** The backend also serves `GET /metrics` (Prometheus text) on its existing port 8080. Fly serves the whole backend on one public host with no path filter, so the committed configuration is the control: `METRICS_ENABLED = "false"` in `fly.config.toml` `[env]` and the explicit `METRICS_ENABLED=false` staged by `deploy.yml` make the public host return `404`. Local compose keeps `true` on the loopback only. The CORS hook excludes `/metrics`, so the frontend origin receives no allow-origin or credentials on `GET` or `OPTIONS` and cannot read it. Temporary internal scraping sets the Fly secret `METRICS_ENABLED=true`, uses `fly proxy`/`fly ssh`, and unsets it immediately; because Fly has no path filter, that short window is reachable by a non-browser client and is an audited exception. The historical ALB routing table is not the current boundary (see § Superseded AWS deployment (historical) and `observability.md` § Exposure and retention).
- **Deploy flow.** GitHub Actions runs `verify` (the reusable `ci.yml` gates) and then one environment-gated `deploy` job: Neon migration (direct URL) → Fly secrets + deploy + `/healthz` → Vercel pull/build/deploy/alias → deployed smoke. Backend before frontend, because the frontend build bakes the API/WS URLs and should only point at a live, migrated backend.

## Environments and triggers

| | `development` | `production` |
| --- | --- | --- |
| Git trigger | push to `develop` | push to `main` |
| Manual trigger | `workflow_dispatch` with `environment: development` | `workflow_dispatch` with `environment: production` |
| Frontend | Vercel preview deployment aliased to the stable `FRONTEND_ORIGIN` host | Vercel production deployment at the `FRONTEND_ORIGIN` domain |
| Backend | development Fly app (`FLY_APP_NAME`) | production Fly app (`FLY_APP_NAME`) |
| Database | Neon `development` branch | Neon `production` branch (protected) |
| Approval | none | at least one required reviewer; deployment branches restricted to `main` |
| Concurrency | `deploy-development`, `cancel-in-progress: false` | `deploy-production`, `cancel-in-progress: false` |

- The effective environment is `github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development')`, used identically by the concurrency group and the `deploy` job's `environment:`. A dispatch chooses explicitly; environment protection rules still apply.
- There is no third environment. `development` and `production` are fully isolated: separate GitHub Environment secrets/variables, separate Fly apps, separate Neon branches and separate frontend hostnames. A development deploy can never touch production data.
- The branch model is recorded in `../../AGENTS.md` § Conventions: feature work integrates on `develop` (the development environment) and reaches `main` (the production environment) only after acceptance.

## Secrets and variables

All values are per GitHub Environment; values are user-supplied and never committed. The exact catalog with per-environment shapes and the workflow consumer for each name is in `vercel-fly-neon.md` § Environment catalog.

- **Secrets:** `VERCEL_TOKEN`, `FLY_API_TOKEN`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `SMTP_PASS`.
- **Variables:** `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `FLY_APP_NAME`, `FLY_REGION`, `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `MAX_USERS_PER_SERVER`.
- `VITE_*` values are public client configuration baked into the Vercel build; they are not secrets. `VITE_WS_URL` is optional: the resolver derives `wss://<api-host>/ws` from `VITE_API_URL` when it is empty.
- Fly runtime configuration is staged with `flyctl secrets set --stage` from the environment values, plus `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080` and `METRICS_ENABLED=false`; `fly.config.toml` `[env]` commits the same `METRICS_ENABLED = "false"` default for both apps. `DATABASE_URL` (pooled) serves application queries and `DIRECT_DATABASE_URL` (direct) serves the startup migration. Secrets are injected at deploy time and are never baked into the image or echoed in logs.
- Tokens are read through `env:`/`secrets.*` only: `FLY_API_TOKEN` is never passed as a command-line argument, and the Vercel commands read `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from the environment.

## Deploy pipeline

- `../../.github/workflows/ci.yml` runs on pull requests, pushes to `main`/`develop` and `workflow_call`: `verify-app` (`npm ci` → lint → typecheck → test → coverage → build), `smoke-e2e` (Mailpit-primed containerized smoke) and `verify-workflows` (pinned `rhysd/actionlint:1.7.12` over both workflows, `src/frontend/vercel.json` JSON parse, `fly.config.toml` anchors). Workflow-level `permissions: contents: read`; every third-party action is pinned to a full commit SHA.
- `../../.github/workflows/deploy.yml` runs `verify` through `workflow_call`, then the single environment-gated `deploy` job in this fixed order: checkout/install → Neon migration → Fly secrets/deploy/health → Vercel pull/build/deploy/alias → deployed smoke (`../../tests/e2e/deployed-smoke.mjs`).
- Every Vercel command runs with `working-directory: src/frontend`, so the project's `vercel.json`, build command, output directory, SPA rewrite and cache headers are the ones used. The Vercel project Root Directory is `src/frontend`; the CLI cwd is a second guard.
- The Vercel build receives `VITE_CLOUD_DEPLOY=true`, `VITE_API_URL` and the optional `VITE_WS_URL`. Cloud mode fails the build when the API URL is missing/relative or the resolved WS URL is not `wss://`.
- Failed gates block the deploy before any provider is touched. `deploy.yml` contains only Vercel, Fly and Neon steps.

## Neon migrations

- One Neon project, two branches: `development` and `production`; the production branch is protected. Application and migration URLs always carry `sslmode=require`.
- `DATABASE_URL` is the pooled `-pooler` URL for the Fly app's runtime queries. `DIRECT_DATABASE_URL` is the direct URL for the CI migration job and the Fly startup migration, which runs on a dedicated `pg.Client` so `BEGIN`, every statement and `COMMIT` share one connection (PgBouncer transaction pooling is not used for migrations).
- Ordering is fixed: **migrate → backend deploy → frontend deploy**. CI runs `npx --no-install tsx src/backend/src/db/migrate-cli.ts` with `DIRECT_DATABASE_URL` before Fly; the image also packages `dist/db/migrations`, so the startup migration is an idempotent safety net and a no-op after CI. `node dist/db/migrate-cli.js --list` lists migration names without opening a connection.
- With neither URL set (local host-only runs), startup migrations are skipped and the backend uses in-memory repositories; this preserves the no-database mode.
- Migrations are forward-only and add-only. See § Rollback for the database recovery path.

## Rollback

Manual, immediate and routing-only where possible; the full runbook is in `vercel-fly-neon.md` § Rollback.

- **Frontend:** `vercel rollback <previous-deployment-url-or-id>` (production) or `vercel promote <deployment-url>`; re-point the development alias with `vercel alias set <deployment> <host>`.
- **Backend:** `fly releases --app "$FLY_APP_NAME" --image` to find the known-good release, then `fly deploy --image <release-image> --app "$FLY_APP_NAME" --config fly.config.toml`.
- **Order:** roll back the backend first when the API/WebSocket is broken, then the frontend when only the UI is broken. API changes are additive, so the previous frontend stays compatible during the window.
- **Database:** no automatic down migrations. If a schema change must be undone, create a Neon branch from the pre-migration point in time (PITR), validate it, then repoint `DATABASE_URL`/`DIRECT_DATABASE_URL` to the restored branch.
- **After any rollback:** re-run the deployed smoke and check `/healthz`; a Fly rollback restarts the machine, so clients reconnect and in-memory rooms reset (expected).

## DNS and cookies

- `FRONTEND_ORIGIN` is the single stable public frontend origin per environment (a Vercel alias or custom domain); unique per-deployment preview URLs are never used as a CORS/CSRF origin. `VITE_API_URL` is the stable Fly (or custom `api.`) origin.
- Recommended production topology: first-party subdomains under one registrable domain (`app.<domain>` on Vercel, `api.<domain>` on Fly), so the session cookie is first-party and `SameSite=Lax` remains viable.
- Default `*.vercel.app` → `*.fly.dev` hosts are cross-site: `SESSION_COOKIE_SECURE=true` and `SESSION_COOKIE_SAMESITE=none` are required, and Safari/iOS ITP or Chrome third-party cookie blocking can still drop the session cookie. That is a documented product risk, not a code bug.
- `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL` are derived by the workflow from `FRONTEND_ORIGIN`, so they cannot drift. CORS is an exact-origin allowlist with credentials, `Vary: Origin`, and no wildcard; the WebSocket upgrade checks a present `Origin` against the same allowlist (close code `1008`, no `hello`) while allowing non-browser clients that omit `Origin`.
- The browser opens `wss://<api-host>/ws`; an `https://` page cannot use `ws://`, and the resolver rejects it in cloud builds. Fly terminates TLS and proxies WebSocket upgrades without extra configuration; the existing 30 s heartbeat and reconnect policy are unchanged.
- HTTPS is forced on Fly (`force_https = true`) and provided by Vercel for the frontend. No certificate or DNS asset is created by this repository's pipeline; domains are user-owned.

## Single-machine trade-off

- The backend runs as exactly one always-on Fly machine (`auto_stop_machines = "off"`, `auto_start_machines = false`, `min_machines_running = 1`, 512 MB shared-CPU). In-memory rooms are the reason: a second machine would serve a different room registry and clients would stop seeing each other.
- Deploys use the `rolling` strategy on the single machine, so a deploy restarts the process and closes every WebSocket. Clients reconnect automatically (10 attempts, 500 ms → 5 s backoff, 30 s grace) and in-memory rooms reset; there is no zero-downtime deploy, by design and by the room model.
- Health is `GET /healthz` → `200` `{"status":"ok"}`, checked by Fly every 15 s (10 s grace, 5 s timeout) and asserted by the deploy job before the frontend step. The deployed smoke then proves health, CORS, SPA fallback, a real `/assets/*` 404 and a WebSocket hello/join/click.

## Security and credential posture

- No secret value is committed, baked into an image, or logged; GitHub masks registered secrets and the workflows never enable shell tracing. `.env*` files remain user-owned and off-limits.
- The canonical scoped credential audit is retained verbatim from `workflow-hygiene`. Its AWS patterns cover credentials from the superseded deployment era and must never reappear in any tracked non-doc file:

  ```sh
  git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'
  ```

  The connection-string audit is scoped to runtime/config trees and excludes colocated test fixtures: `git grep -nE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" -- .github infra src ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx'`. The token audit is `git grep -nE "VERCEL_TOKEN=|FLY_API_TOKEN=|FlyV1 " -- . ':(exclude)docs/'`.
- CORS never uses `*` with credentials; `SameSite=None` requires `Secure`; the WebSocket `Origin` guard is always on for present origins. The `development` and `production` secrets are separate, and production requires a reviewer.

## Superseded AWS deployment (historical)

Everything in this section is **historical and superseded**: it is not provisioned, verified or deployed by the current pipeline. The Terraform tree is archived in place (`../../infra/README.md`) and is **not deployed** or **destroyed** by this feature; deleting it or any live AWS resource is a user-owned decision (spec Q-5).

| Historical component (superseded) | Current replacement |
| --- | --- |
| AWS ECS Fargate services + ALB (WebSocket passthrough, `idle_timeout = 90`) | One Fly.io machine + Fly Proxy (`/ws` upgrade passthrough) |
| AWS RDS PostgreSQL + Secrets Manager master password | Neon PostgreSQL, pooled/direct URLs per branch |
| AWS ECR image registry + SHA-tagged release images | Fly release images built from `src/backend/Dockerfile` target `prod`; the commit SHA is the release identity |
| Terraform (S3 remote state, `verify-infra` fmt/validate gate) | `fly.config.toml` + `src/frontend/vercel.json`, checked by `verify-workflows` (actionlint + JSON parse + TOML anchors) |
| GitHub OIDC roles / `id-token: write` AWS deploys | Static `VERCEL_TOKEN`/`FLY_API_TOKEN` environment secrets (no OIDC) |
| AWS CloudWatch `awslogs` logs and alarms | `fly logs`/`fly status` and the deployed smoke; provider dashboards are user-owned |
| Manual `workflow_dispatch` deploy; `deploy-services` placeholder | `develop` → `development`, `main` → `production` behind required reviewers; one deploy job |
| `PUBLIC_WS_URL` baked into the frontend image at build time | `VITE_CLOUD_DEPLOY=true` + `VITE_API_URL`/optional `VITE_WS_URL` baked by the Vercel build; the nginx image keeps the local/smoke contract |

- The AWS resources, if any were ever created, are untouched. There is no AWS fallback path in the workflows; if DNS still points at an earlier host, reverting DNS is a user-owned operational decision, not a pipeline step.
- `infra/terraform/**` is retained; `git ls-files infra/terraform` is unchanged by this migration. No Terraform state or plan is committed.

## Supersession ledger references

The authoritative ledger is `../features/vercel-fly-neon-deployment/spec.md` § Supersession ledger. This document owns the deployment-side detail:

- `aws-deploy-pipeline` — **superseded** (deploy target and pipeline); the historical table above records the replacements.
- `manual-deploy-trigger` — **superseded** (trigger policy); replaced by branch-driven environments with the production reviewer gate.
- `workflow-hygiene` — **still in force**; the canonical scoped credential audit and SHA pinning are retained above and in the workflows.
- `frontend-delivery-hardening` — **partially superseded** (cloud edge only): Vercel replaces nginx as the cloud frontend; the hashed-asset immutability, app-shell `no-cache`, SPA fallback and real `/assets/*` 404 semantics are replicated in `src/frontend/vercel.json`, and the nginx image remains for local/smoke/portability.
- `runtime-observability` — **resumed on this target**; the shipped logging/metrics/overlay surface is documented in `observability.md`. Deployed Fly environments set `METRICS_ENABLED=false` on the one public host, `/metrics` is excluded from the CORS grant, and the ALB/CloudWatch notes are historical context only. The committed default-off configuration is the exposure control.
- `infra/terraform/**` — **archived, not deleted**; see `../../infra/README.md`.

## See also

- `vercel-fly-neon.md` — architecture, environment catalog, runbook, rollback, local-vs-cloud and cost/limits.
- `containerization.md` — image contracts, ports, health and compose files (local path unchanged).
- `stack.md` — the decided application stack.
- `../features/vercel-fly-neon-deployment/spec.md` — acceptance criteria, environment catalog and supersession ledger.
- `../../README.md` — quickstart and commands.
