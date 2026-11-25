# Deployment

CubeClicker deploys to three managed platforms: **Vercel** serves the React/Vite SPA as a static build, **Render** runs the Fastify + `@fastify/websocket` backend container as one free Docker web service, and **Neon** provides PostgreSQL for accounts, sessions, verification tokens, economy and customization. **GitHub Actions** is the single CI/CD pipeline, with the `development` and `production` GitHub Environments holding every per-environment secret and variable. The backend host moved from Fly.io to Render on 2026-11-16 after Fly's credit-card gate blocked the free development app (§ Superseded Fly.io backend); Vercel and Neon were retained, and the earlier AWS (ECS/ALB/RDS/ECR + Terraform) target remains historical (§ Superseded AWS deployment).

The application itself is unchanged: game logic, server authority, in-memory rooms, the WebSocket protocol, the auth model and the database schema are the same as local. The local `podman compose up` path is unchanged too (see `../../README.md` § Quickstart). The container images remain provider-neutral deployables (see `containerization.md`); Vercel hosts the static frontend build, not the backend.

- Canonical reference: `vercel-render-neon.md` — architecture, exact environment catalog, runbook, rollback, local-vs-cloud, cost and limits.
- Superseded reference: `vercel-fly-neon.md` — retained for history, marked SUPERSEDED.
- Application stack: `stack.md`. Container conventions: `containerization.md`. Feature record: `../features/render-backend-migration/status.md`.

## Platform split and state ownership

| Surface | Platform | What it owns |
| --- | --- | --- |
| Static SPA (`src/frontend`) | Vercel CDN | Nothing but the built HTML/JS/CSS; no functions, no serverless backend |
| HTTP API + WebSocket (`/auth/*`, `/healthz`, `/ws`) | Render free Docker web service, one instance | All live game/room state (in memory, one process) and auth sessions |
| PostgreSQL | Neon | Durable accounts, sessions, verification tokens, economy and customization rows only |
| CI/CD and configuration | GitHub Environments (source of truth) + Render service variables (runtime copy) | Pipeline ordering, per-environment secrets/variables and the committed runtime defaults; no runtime application state |

- **Game state stays on Render.** Rooms are in-memory, server-authoritative and per process. One instance is the pinned topology; two or more instances would split the room registry. See § Single-instance trade-off. Neon is never used for game/room state, and Vercel owns no application state.
- **Data flow.** Browser → Vercel for HTML/JS/CSS; browser → Render for `/auth/*` (`fetch`, `credentials: 'include'`) and `/ws` (`wss://`). The session cookie is host-only for the Render API host and is attached on both requests and the WebSocket upgrade; the backend resolves the account from the upgrade cookie exactly as locally.
- **Diagnostics `/metrics`.** The backend also serves `GET /metrics` (Prometheus text) on its existing port 8080. Render serves the whole backend on one public host with no path filter, so the committed configuration is the control: `render.yaml` sets `METRICS_ENABLED: 'false'` for the service and the live service carries the same value, making the public host return `404`. Local compose keeps `true` on the loopback only. The CORS hook excludes `/metrics`, so the frontend origin receives no allow-origin or credentials on `GET` or `OPTIONS` and cannot read it. Temporary internal scraping sets `METRICS_ENABLED=true` on the service (dashboard) and restarts it, which also resets the per-process metrics; because there is no path filter, that short window is reachable by a non-browser client and is an audited exception. The historical ALB routing table is not the current boundary (see § Superseded AWS deployment (historical) and `observability.md` § Exposure and retention).
- **Verification email and its assets.** Delivery is an SMTP side effect of the backend (`smtp-relay.brevo.com`, § Secrets and variables), not a service. The two branded PNGs are static files under `src/frontend/public/email/`, served by the existing frontend origin at `/email/*.png` (Vite locally, nginx in the `prod` image, Vercel when deployed): no new service, port, image or backend route, and no attachments on the message. `APP_BASE_URL` supplies the origin for the verification link and the image URLs.
- **Deploy flow.** A push to `main` runs **CI once**; a successful CI run triggers the **deploy** job (`development` environment) via `workflow_run` (it does not re-run CI). Order: `Check deployment Brevo configuration` (nine values, `--check-only`, no network) → Neon migration (direct URL) → `Sync Brevo SMTP settings to Render` (seven SMTP names, synced from the GitHub Environment) → Render deploy hook → health poll → Vercel pull/build/deploy `--prod` → deployed smoke. Backend before frontend, because the frontend build bakes the API/WS URLs and should only point at a live, migrated backend.

## Environments and triggers

| | `development` | `production` |
| --- | --- | --- |
| Git trigger | push to `main` (CI, then Deploy after CI succeeds) | none |
| Manual trigger | `workflow_dispatch` with `environment=development` (re-deploy; CI for the target SHA required) | `workflow_dispatch` with `environment=production`; the job first verifies CI for the target SHA succeeded |
| Frontend | Vercel production deployment of the only project, updating the stable `cubeclicker-development.vercel.app` host | not provisioned |
| Backend | Render service `cubeclicker-development` (`srv-dbtcvv9srm7s73au5bag`) | not provisioned |
| Database | Neon `development` branch | not provisioned (a Neon `production` branch is the intended target) |
| Approval | none | none configured: no protection rules and no deployment branch policy yet; both must be added before production is provisioned |
| Concurrency | `deploy-development`, `cancel-in-progress: false` | `deploy-production`, `cancel-in-progress: false` |

- The effective environment is `github.event.inputs.environment || 'development'`, used identically by the concurrency group and the deploy job's `environment:`. A dispatch chooses `development` or `production` explicitly and reads only the selected environment's secrets and variables. The `production` Environment holds the nine placeholder names (`placeholder-only`) and has no protection rules and no deployment branch policy yet, so nothing pauses the job; provisioning must add the protection rules before production is used.
- There is no third environment. Development and production are intended to be fully isolated (separate GitHub Environment secrets/variables, separate Render services, separate Neon branches and separate frontend hostnames), but **production is not provisioned**: it is `placeholder-only`, and `no Render service, Vercel project or Neon branch is provisioned`. A development deploy can never touch production data because production does not exist yet.
- There is no `develop` branch. `main` is both the integration branch and the development deployment branch: CI runs on pull requests and `main` pushes, and a `main` push deploys development after CI succeeds; production is manual (`workflow_dispatch`) and unprovisioned. The branch model is recorded in `../../AGENTS.md` § Conventions.

## Secrets and variables

All values are per GitHub Environment; values are user-supplied and never committed. The exact catalog with per-environment shapes and the workflow consumer for each name is in `vercel-render-neon.md` § Environment catalog.

- **Secrets (`development`, provisioned):** `DATABASE_URL`, `DIRECT_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`, `SMTP_USER`, `SMTP_PASS`, `RENDER_API_KEY`, `VERCEL_TOKEN`.
- **Variables (`development`, provisioned):** `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `MAX_USERS_PER_SERVER`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `RENDER_SERVICE_ID`.
- **Production (`placeholder-only`):** the same nine deployment names exist with the pinned placeholders — six variables and three secrets — and `no Render service, Vercel project or Neon branch is provisioned`. A production deploy fails at the Brevo placeholder guard until the assets exist and the values are filled.
- `VITE_*` values are public client configuration baked into the Vercel build; they are not secrets. `VITE_WS_URL` is optional: the resolver derives `wss://<api-host>/ws` from `VITE_API_URL` when it is empty.
- **Brevo SMTP.** `SMTP_HOST=smtp-relay.brevo.com`. **Render free blocks outbound SMTP on ports 25, 465 and 587**, so the deployed `development` recipe is `SMTP_PORT=2525` with `SMTP_SECURE=false` (STARTTLS); `587` (STARTTLS) and `465` with `SMTP_SECURE=true` (implicit TLS) are valid only off Render free. The deploy CLI fails closed for `development` on any of the three blocked ports, the local Mailpit port `1025`, a `malformed` or out-of-range value, or an `SMTP_SECURE` other than `false`/`0` with `2525`, and it runs after the nine-name catalog validation and before any Render call. A runtime transport rejection maps to HTTP `502` with code `verification_email_failed` on register and resend; the account stays persisted and unverified, the just-issued token is invalidated, and one `warn` `verification_email_delivery_failed` line carries `route`, `errorType`, optional `transportCode`, `host` and `port`. `SMTP_USER` is the Brevo **SMTP login** and `SMTP_PASS` holds the Brevo **SMTP key** from **Settings → SMTP & API → SMTP** — **not the REST API key**, which cannot authenticate the relay. `SMTP_FROM` must be a Brevo-verified sender (`CubeClicker <verified sender>` is the recommended shape). `SMTP_SECURE` (empty derives `true` on port `465`) and `SMTP_CONNECTION_TIMEOUT_MS` (default `10000`, integer 1000–120000) are optional names. GitHub is the source of truth: the deploy workflow validates all nine and syncs the seven SMTP names (`nine validated, seven synced`) from the GitHub Environment to the Render service before the deploy hook. `RENDER_API_KEY` is a GitHub secret only and `RENDER_SERVICE_ID` is the URL coordinate; both are `never written to the Render service` and never become service variables. A Render dashboard edit to one of the seven synced names is overwritten on the next deploy.
- **Render runtime configuration** is committed for the non-secret values in `render.yaml` (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, `METRICS_ENABLED=false`, `MAX_USERS_PER_SERVER=10`, `DB_SCHEMA_BOOTSTRAP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000`) and set in the Render dashboard for the remaining `sync: false` names (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `CORS_ORIGIN`, `ALLOWED_ORIGIN`, `APP_BASE_URL`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`); `render.yaml` keeps `sync: false` and no value for every name. The seven SMTP names are synced from the GitHub Environment, while those remaining `sync: false` names `stay dashboard-owned` and are `never synced`. `DATABASE_URL` (pooled) serves application queries and `DIRECT_DATABASE_URL` (direct) serves the startup phase (advisory lock, migrations and schema bootstrap). Secrets are never baked into the image or echoed in logs.
- `CORS_ORIGIN`, `ALLOWED_ORIGIN` and `APP_BASE_URL` are static Render service variables set to the exact `FRONTEND_ORIGIN`; the workflow no longer derives or stages them, so changing the frontend origin is a Render variable change plus a workflow variable change.
- Tokens are read through `env:`/`secrets.*` only: `RENDER_DEPLOY_HOOK_URL` is passed as `env:` to `curl` and never echoed, `RENDER_API_KEY` is read from the step `env:` and used only as the Render authorization header, and the Vercel commands read `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from the environment.

## Deploy pipeline

- `../../.github/workflows/ci.yml` runs on pull requests and pushes to `main`: `verify-app` (`npm ci` → lint → typecheck → test → coverage → build), `smoke-e2e` (Mailpit-primed containerized smoke) and `verify-workflows` (`npm ci` on Node 24 → pinned `rhysd/actionlint:1.7.12` over both workflows → `src/frontend/vercel.json` JSON parse → `render.yaml` YAML parse that checks the service name/runtime/plan and that no platform health check is declared → a `deploy.yml` dispatch parse that pins both dispatch choices, the `production` default, the input→environment mapping and the automatic path → a guard that `deploy.yml` never mentions Fly → `Guard rejects placeholder values` (credential-free `--check-only` fixture that must exit non-zero and print the exact `'production'` block header) → `Guard accepts a complete value set` (the same CLI with the complete `development` fixture, asserting the exact success line)). Workflow-level `permissions: contents: read`; every third-party action is pinned to a full commit SHA.
- `../../.github/workflows/deploy.yml` triggers on `workflow_run` of `CI` completing on `main`, plus `workflow_dispatch` for `development` or `production`. It runs one `deploy` job in the environment selected by the event (`development` after CI or a development dispatch, `production` for a production dispatch) in this fixed order: checkout/install → `Check deployment Brevo configuration` (nine values, no network) → Neon migration (`DIRECT_DATABASE_URL`) → `Sync Brevo SMTP settings to Render` (seven SMTP names via the Render API) → Render deploy hook → 45 s wait → `/healthz` poll (180 s) → Vercel pull/build/deploy `--prod` → warm `/healthz` → deployed smoke (`../../tests/e2e/deployed-smoke.mjs`).
- **No duplicate CI.** The deploy job does not call `ci.yml` and does not run lint/typecheck/test/coverage/build again; those gates run once in the CI workflow that triggered it. The manual path (either environment) checks the CI conclusion for the target SHA (`gh run list`) before deploying.
- **No alias step.** `vercel deploy --prebuilt --prod` updates the project's production domain (`cubeclicker-development.vercel.app`), so the workflow has no separate `vercel alias` command and no duplicate host mapping.
- Every Vercel command runs from the repository root (the project Root Directory is `src/frontend`, applied once by the project settings). The project's `vercel.json`, build command, output directory, SPA rewrite and cache headers are the ones used.
- The Vercel build receives `VITE_CLOUD_DEPLOY=true`, `VITE_API_URL` and the optional `VITE_WS_URL`. Cloud mode fails the build when the API URL is missing/relative or the resolved WS URL is not `wss://`.
- The preflight fails closed: a missing or `CHANGEME` value stops the job before any provider is touched, and the sync runs after the Neon migration and before the Render deploy hook. `deploy.yml` contains only Neon, Render and Vercel steps.

## Neon migrations

- One Neon project, one `development` branch today (production intended). Application and migration URLs always carry `sslmode=require`.
- `DATABASE_URL` is the pooled `-pooler` URL for the Render service's runtime queries. `DIRECT_DATABASE_URL` is the direct URL for the CI migration job and the Render startup phase (advisory lock, migrations and schema bootstrap), which runs on a dedicated `pg.Client` so `BEGIN`, every statement and `COMMIT` share one connection (PgBouncer transaction pooling is not used for migrations).
- Ordering is fixed: **migrate (CI) → schema bootstrap → listen → backend deploy → frontend deploy**. CI runs `npx --no-install tsx src/backend/src/db/migrate-cli.ts` with `DIRECT_DATABASE_URL` before triggering Render; the image also packages `dist/db/migrations`, so the startup phase's migration step is an idempotent safety net and a no-op after CI. `node dist/db/migrate-cli.js --list` lists migration names without opening a connection. The startup schema bootstrap then verifies the five required tables before the process accepts traffic.
- With neither URL set (local host-only runs), the startup phase is skipped and the backend uses in-memory repositories; no cleanup scheduler is created. This preserves the no-database mode.
- Migrations are forward-only and add-only. The Neon `production` branch is not protected on the free plan — an accepted deviation recorded in the feature spec. See § Rollback for the database recovery path.

## Database startup phase and schema bootstrap

The backend runs the database lifecycle phase itself at every boot, before it accepts traffic: build the app (logger + pool) → one dedicated direct-URL `pg.Client` → acquire a session-level Postgres advisory lock (retrying every 250 ms for at most 30 s) → apply pending migrations → run the schema bootstrap → best-effort unlock and end the client → `listen`. The bootstrap checks the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`), creates any missing table and its indexes with idempotent `CREATE ... IF NOT EXISTS` DDL in one transaction per table, and reports required columns missing from an existing table without altering it. The numbered migrations remain the only schema-evolution authority; a table recreated by the bootstrap uses the final consolidated shape.

- **URL requirement: direct/session-capable.** The phase prefers `DIRECT_DATABASE_URL` and falls back to `DATABASE_URL`. The fallback must be a direct/session-capable URL: the advisory lock is session-scoped and DDL must not cross PgBouncer transaction boundaries. On Neon both URLs are set and the direct one wins; local compose points directly at the compose Postgres, so the fallback works there. A deployment that sets only the pooled `-pooler` URL cannot use the lock/DDL phase (the runner does not sniff provider hostnames): provide the direct URL or set `DB_SCHEMA_BOOTSTRAP_ENABLED=false` and rely on the CI migration.
- **Fail-fast vs warn-and-continue.** Connect, lock, migration and table-creation failures log `db_startup_failed` / `db_schema_bootstrap_failed` with `stage` (`connect`, `lock`, `migrations` or `bootstrap`), `errorType` and an optional SQLSTATE `code`, then close the app and exit `1` without `listen`; the deploy workflow's `/healthz` poll fails the deploy. A connect failure, a 30 s advisory-lock timeout, a failed migration and a denied `CREATE` are all fatal. An outdated table (missing required columns) logs `db_schema_table_outdated` at `warn` and startup continues; the migrations are the repair path.
- **Cleanup is in-process and best-effort.** After `listen`, the same process deletes expired `verification_tokens` rows (`expires_at <= now`) once immediately and then `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` after each run settles (default one hour; 60,000–86,400,000 ms), with an in-flight guard, `unref()`ed timers and non-fatal failures (`db_verification_cleanup_failed`; the next run is still scheduled). `SIGTERM`/`SIGINT` stops the scheduler through the shutdown `beforeClose` hook before the pool closes. The Render free instance spins down after 15 idle minutes, so the schedule is best-effort and the immediate run on the next start catches up. No cron service, worker, pre-deploy command or second Render service is added.
- **Advisory-lock safety under Render's old/new overlap.** On a deploy Render builds first and then starts the new instance before the old one is fully retired (see `vercel-render-neon.md` § Architecture). Both processes may therefore run the startup phase concurrently; the session advisory lock serializes them, so the second instance waits (bounded at 30 s) until the first releases the lock and then finds the schema complete. That provider-level overlap is **not** application-level zero-downtime for clients: when traffic switches, the old instance's WebSockets close, clients follow the bounded reconnect policy and rejoin, and the new instance starts with empty in-memory rooms (§ Single-instance trade-off). The advisory lock makes the DDL phase safe under either provider behavior; it does not make a deploy invisible to connected clients.
- **Configuration.** `DB_SCHEMA_BOOTSTRAP_ENABLED` (default `true`), `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` (default `true`) and `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` (default `3600000`) are non-secret values committed in `render.yaml` and defaulted in `compose.yaml`; invalid or empty values fail startup naming the variable.

## Rollback

Manual, immediate and routing-only where possible; the full runbook is in `vercel-render-neon.md` § Rollback.

- **Frontend:** `vercel rollback <previous-deployment-url-or-id>` (production target) or `vercel promote <deployment-url>`; re-point the development host manually with `vercel alias set <deployment> <host>` only if a routing mistake needs correcting.
- **Backend:** redeploy the last known-good commit (revert on `main` and let CI → Deploy rebuild, or redeploy the previous deploy from the Render dashboard). `render deploys list srv-dbtcvv9srm7s73au5bag` lists deploys; the free plan has no release-image registry, so the git commit is the release identity.
- **Order:** roll back the backend first when the API/WebSocket is broken, then the frontend when only the UI is broken. API changes are additive, so the previous frontend stays compatible during the window.
- **Database:** no automatic down migrations. If a schema change must be undone, create a Neon branch from the pre-migration point in time (PITR), validate it, then repoint `DATABASE_URL`/`DIRECT_DATABASE_URL` (GitHub Environment secrets and Render service variables) to the restored branch.
- **After any rollback:** re-run the deployed smoke and check `/healthz`; a Render rollback restarts the instance, so clients reconnect and in-memory rooms reset (expected).

## DNS and cookies

- `FRONTEND_ORIGIN` is the single stable public frontend origin per environment (the Vercel production domain or a custom domain); unique per-deployment preview URLs are never used as a CORS/CSRF origin. `VITE_API_URL` is the stable Render (or custom `api.`) origin. Development currently uses the platform default hosts `cubeclicker-development.vercel.app` and `cubeclicker-development.onrender.com`.
- Recommended production topology: first-party subdomains under one registrable domain (`app.<domain>` on Vercel, `api.<domain>` on Render), so the session cookie is first-party and `SameSite=Lax` remains viable.
- Default `*.vercel.app` → `*.onrender.com` hosts are cross-site: `SESSION_COOKIE_SECURE=true` and `SESSION_COOKIE_SAMESITE=none` are required, and Safari/iOS ITP or Chrome third-party cookie blocking can still drop the session cookie. That is a documented product risk, not a code bug.
- `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL` are set on the Render service to the exact `FRONTEND_ORIGIN`, so they cannot drift from the frontend host without a visible configuration change. CORS is an exact-origin allowlist with credentials, `Vary: Origin`, and no wildcard; the WebSocket upgrade checks a present `Origin` against the same allowlist (HTTP `403` before the upgrade, no `hello`) while allowing non-browser clients that omit `Origin`.
- The browser opens `wss://<api-host>/ws`; an `https://` page cannot use `ws://`, and the resolver rejects it in cloud builds. Render terminates TLS and proxies WebSocket upgrades without extra configuration; the existing 30 s heartbeat and reconnect policy are unchanged.
- HTTPS is provided by Render and Vercel. No certificate or DNS asset is created by this repository's pipeline; domains are user-owned.

## Single-instance trade-off

- The backend runs as exactly one free Render instance (`plan: free`, Frankfurt, `512 MB` / `0.1 CPU`). In-memory rooms are the reason: a second instance would serve a different room registry and clients would stop seeing each other.
- A deploy or cold start restarts the process and closes every WebSocket. Clients reconnect automatically (10 attempts, 500 ms → 5 s backoff) and in-memory rooms reset; there is no zero-downtime deploy, by design and by the room model. Render's brief old/new instance overlap during a deploy does not change this: the provider may run both processes for a moment, but clients still lose and re-establish their sockets and the new instance starts with empty rooms (§ Database startup phase and schema bootstrap records the advisory-lock safety of that overlap).
- Free instances **spin down after 15 minutes without traffic** and cold-start in roughly 30–60 s on the next request or WebSocket connection. The client's ~38 s retry budget can be exhausted by a cold start, in which case the connection banner shows `Connection lost` with a `Retry` button. This is development-only behavior; production is not provisioned on the free plan.
- Health is `GET /healthz` → `200` `{"status":"ok"}`, asserted by the deploy job (`200` within 180 s) before the frontend step. Render has **no platform health check** configured for the service (`healthCheckPath` is empty) and `render.yaml` declares none, so the deploy job's poll is the health gate. The deployed smoke then proves health, CORS (allowed and disallowed), SPA fallback, a real `/assets/*` 404 and a WebSocket hello/join/click plus the disallowed-Origin `403`.

## Security and credential posture

- No secret value is committed, baked into an image, or logged; GitHub masks registered secrets and the workflows never enable shell tracing. `.env*` files remain user-owned and off-limits.
- The canonical scoped credential audit is retained verbatim from `workflow-hygiene`. Its AWS patterns cover credentials from the superseded deployment era and its Fly pattern covers the abandoned backend; neither may reappear in any tracked non-doc file:

  ```sh
  git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'
  ```

  The connection-string audit is scoped to runtime/config trees and excludes colocated test fixtures: `git grep -nE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" -- .github infra src ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx'`. The token audit is `git grep -nE "VERCEL_TOKEN=|RENDER_DEPLOY_HOOK_URL=|RENDER_API_KEY=|FLY_API_TOKEN=|FlyV1 " -- . ':(exclude)docs/'`.
- CORS never uses `*` with credentials; `SameSite=None` requires `Secure`; the WebSocket `Origin` guard is always on for present origins. The `development` and `production` secrets are separate. Production holds the nine placeholder names (`placeholder-only`); `no Render service, Vercel project or Neon branch is provisioned`, and reviewer/branch protection must be added when it is provisioned.

## Superseded Fly.io backend (historical)

Everything in this section is **historical and superseded**: no Fly machine was ever deployed, the Fly apps that exist have zero machines, and no workflow references Fly. The configuration files are archived, not deleted: `../../infra/archive/fly/` (see its `README.md`).

| Historical Fly component (superseded) | Current replacement |
| --- | --- |
| One always-on `shared-cpu-1x` 512 MB machine per environment (`fly.config.toml`) | One free Render Docker web service described by `render.yaml` |
| `flyctl secrets set --stage` + `flyctl deploy` | `POST` to the Render deploy hook (`RENDER_DEPLOY_HOOK_URL`) |
| Fly release images (`fly releases --image`) for rollback | Render deploys keyed by the deploying git commit; rollback is a redeploy of the known-good commit |
| `fly logs` / `fly status` | Render dashboard deploy/runtime logs and the Render CLI |
| Fly Mailpit app on private networking (`infra/archive/fly/mailpit.toml`) | No equivalent on Render free; the development backend delivers through Brevo SMTP (`smtp-relay.brevo.com`) instead, so no hosted Mailpit is needed |
| Fly proxy TLS + WebSocket passthrough | Render TLS + WebSocket upgrade passthrough |

- Why it was abandoned: creating the Fly development app required a credit card even for the free allowance, so the backend host moved to Render's free tier. The application, images and protocols did not change.

## Superseded AWS deployment (historical)

Everything in this section is **historical and superseded**: it is not provisioned, verified or deployed by the current pipeline. The Terraform tree is archived in place (`../../infra/README.md`) and is **not deployed** or **destroyed** by this feature; deleting it or any live AWS resource is a user-owned decision (spec Q-5).

| Historical component (superseded) | Current replacement |
| --- | --- |
| AWS ECS Fargate services + ALB (WebSocket passthrough, `idle_timeout = 90`) | One Render web service + Render TLS/WebSocket passthrough |
| AWS RDS PostgreSQL + Secrets Manager master password | Neon PostgreSQL, pooled/direct URLs per branch |
| AWS ECR image registry + SHA-tagged release images | Render builds `src/backend/Dockerfile`; the commit SHA is the release identity |
| Terraform (S3 remote state, `verify-infra` fmt/validate gate) | `render.yaml` + `src/frontend/vercel.json`, checked by `verify-workflows` (actionlint + YAML/JSON parse) |
| GitHub OIDC roles / `id-token: write` AWS deploys | Static `VERCEL_TOKEN`/`RENDER_DEPLOY_HOOK_URL` environment secrets (no OIDC) |
| AWS CloudWatch `awslogs` logs and alarms | Render logs and the deployed smoke; provider dashboards are user-owned |
| Manual `workflow_dispatch` deploy; `deploy-services` placeholder | `main` → CI once → development deploy; production manual and unprovisioned |
| `PUBLIC_WS_URL` baked into the frontend image at build time | `VITE_CLOUD_DEPLOY=true` + `VITE_API_URL`/optional `VITE_WS_URL` baked by the Vercel build; the nginx image keeps the local/smoke contract |

- The AWS resources, if any were ever created, are untouched. There is no AWS fallback path in the workflows; if DNS still points at an earlier host, reverting DNS is a user-owned operational decision, not a pipeline step.
- `infra/terraform/**` is retained; `git ls-files infra/terraform` is unchanged by this migration. No Terraform state or plan is committed.

## Supersession ledger references

The authoritative ledger is `../features/vercel-fly-neon-deployment/spec.md` § Supersession ledger, extended by `../features/render-backend-migration/status.md`. This document owns the deployment-side detail:

- `aws-deploy-pipeline` — **superseded** (deploy target and pipeline); the historical table above records the replacements.
- `manual-deploy-trigger` — **superseded** (trigger policy); replaced by CI-once → deploy-after-CI on `main` for development, development re-deployable by `workflow_dispatch` (`environment=development`), with production manual and unprovisioned.
- `vercel-fly-neon-deployment` — **partially superseded**: Vercel and Neon are retained; Fly is replaced by Render (`vercel-fly-neon.md` carries the supersession banner).
- `workflow-hygiene` — **still in force**; the canonical scoped credential audit and SHA pinning are retained above and in the workflows.
- `frontend-delivery-hardening` — **partially superseded** (cloud edge only): Vercel replaces nginx as the cloud frontend; the hashed-asset immutability, app-shell `no-cache`, SPA fallback and real `/assets/*` 404 semantics are replicated in `src/frontend/vercel.json`, and the nginx image remains for local/smoke/portability.
- `runtime-observability` — **resumed on this target**; the shipped logging/metrics/overlay surface is documented in `observability.md`. Deployed Render environments set `METRICS_ENABLED=false` on the one public host, `/metrics` is excluded from the CORS grant, and the ALB/CloudWatch notes are historical context only. The committed default-off configuration is the exposure control.
- `infra/terraform/**` — **archived, not deleted**; see `../../infra/README.md`. `infra/archive/fly/**` — **archived, not deployed**; see `../../infra/archive/fly/README.md`.

## See also

- `vercel-render-neon.md` — architecture, environment catalog, runbook, rollback, local-vs-cloud and cost/limits.
- `vercel-fly-neon.md` — superseded Vercel/Fly reference (historical).
- `containerization.md` — image contracts, ports, health and compose files (local path unchanged).
- `stack.md` — the decided application stack.
- `observability.md` — logging, metrics and retention.
- `../features/render-backend-migration/status.md` — current feature state and blockers.
- `../../README.md` — quickstart and commands.
