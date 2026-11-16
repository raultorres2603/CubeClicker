# Build log — T1 — Render Blueprint and backend service config

Task: T1 (2026-11-16)
Files changed: `docs/features/render-backend-migration/build-log-T1-render.md`
What changed & why: Created and deployed the Render **free** Docker web service `cubeclicker-development` (Frankfurt, `src/backend/Dockerfile`, branch `main`) against the existing Neon `development` branch, then proved `/healthz` and `/ws` are live. Service was created directly through the Render MCP/API; no `render.yaml` was added in this task (see Decisions).

## Service

- Service ID: `srv-dbtcvv9srm7s73au5bag`
- Name: `cubeclicker-development`
- URL: `https://cubeclicker-development.onrender.com`
- Dashboard: `https://dashboard.render.com/web/srv-dbtcvv9srm7s73au5bag`
- Workspace: `tea-cspt720gph6c739lkvs0` (Raul Torres's Workspace)
- Type/runtime: web service, Docker (`dockerContext=.`, `dockerfilePath=src/backend/Dockerfile`)
- Plan: `free` · Region: `frankfurt` · Instances: 1 · Auto-deploy: `no` (`autoDeployTrigger=off`)

## Deploy

- Deploy ID: `dep-dbtcvvhsrm7s73au5cfg` (created by `create_web_service`; no manual `trigger_deploy` needed)
- Trigger: manual · Commit: `72326485d84ce06e7000480439c18cac82601837` (`docs: record development provisioning`)
- Status: `live` (build started 09:42:22Z, deploy live 09:44:26Z)
- Runtime log: `CubeClicker backend listening on http://0.0.0.0:8080 (WebSocket ws://0.0.0.0:8080/ws)`; startup migrations ran before listen with no error.

## Health check

`GET https://cubeclicker-development.onrender.com/healthz` (Node `fetch`, 5 s cadence, 120 s budget):

```
attempt=1 status=200 ms=287 body={"status":"ok"}
```

WebSocket handshake proof (`wss://cubeclicker-development.onrender.com/ws`, Node global `WebSocket`):

```
open
message={"type":"hello","serverTime":"2026-11-16T09:45:33.960Z"}
```

WebSocket origin-allowlist proof (raw HTTPS upgrade with explicit `Origin`):

```
allowed-origin (https://cubeclicker-development.vercel.app): status=101 upgrade=websocket
allowed-origin: frame="{\"type\":\"hello\",\"serverTime\":\"2026-11-16T09:46:36.680Z\"}"
foreign-origin (https://evil.example.test): status=101 upgrade=websocket then closed, no hello frame
```

Database wiring proof (Neon MCP `run_sql` on `patient-mountain-41401588` / `br-ancient-smoke-za1pdv7w` / `cubeclicker`):

```
001_init.sql  2026-11-16T09:44:21.065Z
002_economy.sql  2026-11-16T09:44:21.143Z
003_upgrades.sql  2026-11-16T09:44:21.202Z
004_idle_accrual.sql  2026-11-16T09:44:21.255Z
005_spaceship_customization.sql  2026-11-16T09:44:21.312Z
006_granular_spaceship_parts.sql  2026-11-16T09:44:21.367Z
007_economy_revision.sql  2026-11-16T09:44:21.447Z
```

These rows were written by the Render container's startup migration runner (through `DIRECT_DATABASE_URL`) seconds before the deploy went live, so the deployed service is connected to the Neon `development` branch.

## Environment variables (names only)

`NODE_ENV`, `HOST`, `PORT`, `METRICS_ENABLED`, `MAX_USERS_PER_SERVER`,
`DATABASE_URL` (pooled Neon URL), `DIRECT_DATABASE_URL` (direct Neon URL),
`CORS_ORIGIN`, `ALLOWED_ORIGIN`, `APP_BASE_URL`,
`SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

Values are stored in Render only; no secret value is recorded in this log or the repository.
Database source: Neon project `patient-mountain-41401588`, branch `br-ancient-smoke-za1pdv7w`, database `cubeclicker`, role `cubeclicker_owner`. The pooled URL is the Neon `-pooler` host; `DIRECT_DATABASE_URL` is the same URL with `-pooler` removed from the host.

## Decisions

1. **`PORT=8080` was accepted** by `create_web_service`; no retry without `PORT` and no fallback to Render's `PORT=10000` was needed. The app reads `process.env.PORT` and the container log confirms it bound 8080.
2. **No additional auth/session secret exists.** `src/backend/src/auth/config.ts` reads no signing/key env var; sessions and verification tokens are opaque `randomBytes` values hashed with SHA-256 in the DB (`src/backend/src/auth/session-repository.ts`, `verification-token-repository.ts`). No secret was generated because none would be consumed.
3. **No `render.yaml` in T1.** The service already exists in Render; adding a Blueprint file that describes the same service would either create a duplicate (`create_new`) or require `adopt` before the file is pushed. The Blueprint/`render.yaml` step stays in T2/T3 where the deploy path and docs are owned.
4. **Auto-deploy is off** per the brief; deploys are triggered manually/through the deploy hook wired in T2.
5. **Commit target is the current branch (`main`)** because the delegating task did not request a feature branch and prior feature bookkeeping commits are on `main`. Staged only this build log.

## Acceptance audit (brief steps)

- Step 1, required env vars confirmed from `auth/config.ts`, `game/config.ts`, `observability/config.ts`, `cors.ts`, `server.ts`, `db/migrate-runner.ts` → met. Extra auth secret: none exists (decision 2).
- Step 2, Neon `development` pooled + direct URLs retrieved → met (pooled host carries `-pooler`; direct derived by removing it).
- Step 3, service created with the requested name/repo/branch/runtime/plan/region/autoDeploy/env names → met; `PORT` accepted.
- Step 4, deploy started by create, polled to `live`, URL read from `get_service` → met.
- Step 5, health check 200 `{"status":"ok"}` within 120 s → met (first attempt, 287 ms).
- Step 6, this build log with no secret values → met.
- Step 7, commit of this log only → met (commit `feat: deploy render development backend` on `main`; not pushed).
- Step 8, remaining blockers reported → see below.

## Verification evidence

- `create_web_service` → service `srv-dbtcvv9srm7s73au5bag`, deploy `dep-dbtcvvhsrm7s73au5cfg`, `url=https://cubeclicker-development.onrender.com`.
- `get_deploy` → `status=live`, `finishedAt=2026-11-16T09:44:26.81338Z`.
- `get_service` → `plan=free`, `region=frankfurt`, `runtime=docker`, `url=https://cubeclicker-development.onrender.com`.
- `list_logs` (runtime) → `Server listening at http://127.0.0.1:8080`, `CubeClicker backend listening on http://0.0.0.0:8080`, `GET /healthz` → `statusCode:200`.
- `node` fetch health script → `attempt=1 status=200 ms=287 body={"status":"ok"}`.
- `node` WebSocket check → `open`, `{"type":"hello","serverTime":"2026-11-16T09:45:33.960Z"}`.
- `node` origin probes → allowed Vercel dev origin gets `hello`; foreign origin closes with no `hello`.
- Neon MCP `run_sql` → seven `schema_migrations` rows applied 09:44:21Z by the deploying container (DB wiring proof).
- No application source files changed in this task, so lint/typecheck/unit/integration/coverage are unaffected; the full gate runs in T4 (local/static verification and live proof).

## Remaining blockers

1. **Vercel token** — `VERCEL_TOKEN` cannot be minted via MCP; required by the GitHub Actions frontend deploy (T2).
2. **SMTP** — Render cannot reach Fly Mailpit; current `SMTP_*` values are placeholders (`localhost:1025`), so verification email delivery is non-functional in the deployed environment until a reachable SMTP provider/Render-private Mailpit is chosen.
3. **Vercel SSO protection** — must be disabled for the development frontend so the deployed UI is reachable.
4. **GitHub environment** — `production`/`development` environment secrets (Render deploy hook, Vercel token, Neon URLs where CI needs them) are not yet configured; no workflows touched in T1.
5. **Render deploy hook URL** — not yet created/registered; required for the GitHub Actions deploy step (T2).
6. **Free-tier semantics** — the free instance spins down after idle and cold-starts; dev-only, to be documented (T3). Render dashboard reports `buildPlan: starter`, but `serviceDetails.plan` is `free`; no paid resource was created.

## Deviations from spec

- None in scope. `render.yaml` intentionally deferred (decision 3).
