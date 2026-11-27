# Build log — T4 — Render production service, environment and deploy hook

Task: T4 (2026-11-27)
Files changed: `docs/features/production-provisioning/build-log-T4.md` (only; no application code, `render.yaml`, workflow, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: Created the production Render Docker web service `cubeclicker` in the existing `tea-cspt720gph6c739lkvs0` workspace (none existed), applied the required runtime shape, and wrote the eight committed names plus the seven dashboard-owned names, including the two Neon `production` connection URLs read in-process. Recorded the service ID, host and the deploy-hook owner hand-off. No deploy hook was invoked.
Decisions: The base name `cubeclicker` was available (the only pre-existing service was `cubeclicker-development`), so the `cubeclicker-game` fallback and any provider-refusal record do not apply. The service was created with `autoDeploy: no` and branch `main`, matching development; no provider-created deploy is used as acceptance evidence.
Testing note: T4 is an infrastructure task per `tasks.md` (provider state plus a build log; no application code). The feature-appropriate integration tier is the Render provider create/read-back plus the environment write record; no repository unit/integration boundary exists for Render account state, and the full repository suite remains T8's gate.

## Capability and pre-state

- Render tool matrix from T1: `tools.render.list_workspaces`, `tools.render.list_services`, `tools.render.create_web_service`, `tools.render.update_environment_variables`, `tools.render.get_service`; no deploy-hook create/read tool, no environment-variable read tool, and no `healthCheckPath` parameter on `create_web_service`.
- Pre-state `list_services` (workspace `tea-cspt720gph6c739lkvs0`) returned exactly one service, `cubeclicker-development` (`srv-dbtcvv9srm7s73au5bag`, `https://cubeclicker-development.onrender.com`). Neither `cubeclicker` nor `cubeclicker-game` existed; `cubeclicker` was available with no provider refusal.
- Development read-back was read-only (`get_service`): id `srv-dbtcvv9srm7s73au5bag`, name `cubeclicker-development`, plan `free`, region `frankfurt`, branch `main`, `autoDeployTrigger: off`, `updatedAt: 2026-11-27T09:01:43.970326Z` (unchanged from T1); no T4 write targeted development.
- The `.env*` files and all repository files outside this build log are untouched.

## Creation and read-back

`create_web_service` call (in-process): workspace `tea-cspt720gph6c739lkvs0`, name `cubeclicker`, repo `https://github.com/raultorres2603/CubeClicker`, branch `main`, runtime `docker`, dockerfilePath `./src/backend/Dockerfile`, dockerContext `.`, plan `free`, region `frankfurt`, autoDeploy `no`, and the 15 environment names below. Response: `{deployId, service}`; the service id is `srv-dc4mjd15efls739ua63g`. No `list_services` entry named `cubeclicker` existed before the create.

Read-back with `get_service` / `list_services` (2026-11-27) plus the required evidence lines:

```
name: cubeclicker
https://cubeclicker.onrender.com
production api: https://cubeclicker.onrender.com
service id: srv-dc4mjd15efls739ua63g
type: web_service
runtime: docker
dockerfilePath: ./src/backend/Dockerfile
dockerContext: .
plan: free
region: frankfurt
branch: main
autoDeployTrigger: off
healthCheckPath: none
numInstances: 1
suspended: not_suspended
```

- `dockerfilePath` read-back is exactly `./src/backend/Dockerfile`; `dockerContext` is `.`; the `get_service` projection returns `healthCheckPath: ""`, i.e. no platform health check (`healthCheckPath: none`).
- `autoDeployTrigger: off` and `autoDeploy: no`; branch `main`; one instance; `plan: free`; `region: frankfurt`.
- `https://cubeclicker.onrender.com` is the platform-default host; the recorded name and host contain no `production`, `prod`, `dev`, `development`, `staging` or `stage` token.

## Environment write

The two Neon values were re-read from Neon in-process with `tools.Neon.get_connection_string` on project `patient-mountain-41401588`, branch `br-floral-dream-zarerhtw` (`production`), database `cubeclicker`, role `cubeclicker_owner`; the pooled host contains `-pooler`, the direct host is derived by removing it, and both carry `sslmode=require`. They were passed directly to `tools.render.update_environment_variables`; no value was printed, persisted or recorded.

Final write: `tools.render.update_environment_variables({ workspaceId, serviceId, envVars, replace: true })` with exactly the 15 keys below; the tool returned `Environment variables updated.` (accepted). Because the Render MCP exposes no environment read tool, this accepted replace-all write is the environment record; it contains no other key.

```
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
METRICS_ENABLED=false
MAX_USERS_PER_SERVER=10
DB_SCHEMA_BOOTSTRAP_ENABLED=true
DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true
DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000
DATABASE_URL=<set>
DIRECT_DATABASE_URL=<set>
CORS_ORIGIN=https://cubeclicker.vercel.app
ALLOWED_ORIGIN=https://cubeclicker.vercel.app
APP_BASE_URL=https://cubeclicker.vercel.app
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=none
```

- `CORS_ORIGIN`, `ALLOWED_ORIGIN` and `APP_BASE_URL` equal the T3 `production frontend:` value exactly (`https://cubeclicker.vercel.app`).
- `DATABASE_URL=<set>` and `DIRECT_DATABASE_URL=<set>` are the provider-generated Neon URLs; their values are names-only in this log.
- `RENDER_API_KEY is not a service variable`
- `RENDER_SERVICE_ID is not a service variable`
- The nine workflow-synced names (the seven SMTP names plus `EMAIL_TRANSPORT` and `BREVO_API_KEY`) are not set by T4; the T6 deploy sync writes them from the GitHub `production` Environment.

## Deploy hook

- The Render MCP has no deploy-hook create/read tool and `get_service` exposes no hook field; no hook value was read, derived or recorded.

deploy hook: owner hand-off

- T5a records the owner hand-off and sets the `RENDER_DEPLOY_HOOK_URL` secret; T4 does not read or store a hook value.
- No deploy-hook POST was made and `tools.render.trigger_deploy` was not called. The provider started an initial deploy as part of service creation and started deploys when the environment was written; neither is acceptance evidence. The authoritative live deploy remains the T6 workflow run.

## No secret, no development change, no deploy hook

- No connection string, role password, hook URL or credential appears in this log; the T4 verify credential guard and connection-string guard pass.
- `.env*` was not touched and no tracked file other than this build log changed.
- The development service was read only; its `updatedAt` remains `2026-11-27T09:01:43.970326Z`. No development Environment, Vercel project or Neon branch was touched; no service was deleted.

## Verify

Command: the exact T4 verify block from `tasks.md` (the `bash` block under `## T4 — Render production service, environment and deploy hook`, lines 115–153), extracted to `/tmp/opencode/t4/t4-verify.sh` and run as `bash /tmp/opencode/t4/t4-verify.sh`; `set -euo pipefail` is inside the block. Raw output:

```
$ bash /tmp/opencode/t4/t4-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=0
```

The block is silent on success (every check is a `test` or a `grep -q`/negated `grep`); exit `0` means every assertion passed:

| Verify area | Result |
| --- | --- |
| Build log present; `name: cubeclicker`; the host and the single anchored `production api: https://cubeclicker.onrender.com` line | PASS |
| `runtime: docker`, `dockerfilePath: ./src/backend/Dockerfile`, `dockerContext: .`, `plan: free`, `region: frankfurt`, `branch: main`, `autoDeployTrigger: off`, `healthCheckPath: none` | PASS |
| `production frontend` extraction from `build-log-T3.md` and the exact `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL` values | PASS |
| `DATABASE_URL=<set>`, `DIRECT_DATABASE_URL=<set>` and all fifteen environment names, including the eight committed exact values and the two cookie values | PASS |
| `RENDER_API_KEY is not a service variable`, `RENDER_SERVICE_ID is not a service variable`, `deploy hook` record | PASS |
| No credential-shaped value, no credentialed connection string, no `cubeclicker-production` name/host | PASS |

## Acceptance audit

- **AC-1(a) — Render production resource name and host carry no environment token.** Met: `name: cubeclicker`; `https://cubeclicker.onrender.com`; `production api: https://cubeclicker.onrender.com`. Neither the name nor the host contains `production`, `prod`, `dev`, `development`, `staging` or `stage`.
- **AC-4(a) — Docker service shape.** Met: service `srv-dc4mjd15efls739ua63g` exists with `runtime: docker`, `dockerfilePath: ./src/backend/Dockerfile`, `dockerContext: .`, `branch: main`, `numInstances: 1`, `plan: free`, `region: frankfurt`, `autoDeployTrigger: off` and `healthCheckPath: none` (empty read-back).
- **AC-4(b) — runtime configuration.** Met: the accepted replace-all environment write contains exactly the eight committed names with the exact values and the seven dashboard-owned names (`DATABASE_URL=<set>`, `DIRECT_DATABASE_URL=<set>`, the three origin names equal to `https://cubeclicker.vercel.app`, `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`). The Render MCP has no environment read tool; the write record is the provider evidence, and T6 exercises the deployed behavior.
- **AC-4(c) — `RENDER_API_KEY`/`RENDER_SERVICE_ID` are not service variables.** Met: the final replace-all write contains exactly the 15 contract keys and neither pipeline name; `RENDER_API_KEY` and `RENDER_SERVICE_ID` were never sent to the service.
- **AC-4(d) — service ID and deploy hook.** Met: `service id: srv-dc4mjd15efls739ua63g`; `deploy hook: owner hand-off` is recorded for T5a; no hook value, URL or credential is in this log.
- **AC-4(e) — provider-created deploy is not acceptance evidence.** Met: the creation and environment-write deploys are explicitly excluded; the authoritative deploy is the T6 workflow run, and no deploy hook was invoked.
- **AC-6(a) — no secret, connection string or credential in the build log.** Met: the T4 verify credential-shaped guard and connection-string guard pass; only `<set>` and non-secret IDs/values are recorded.
- **Testing tiers.** T4 is an infrastructure task (`tasks.md` T1–T6 add no application tests or coverage target); the provider read-back and environment write are the feature-appropriate proof. No repository unit/integration test boundary exists for Render account state, and T8 owns the full repository suite/no-regression gate.

## Deviations from spec

None. The base name `cubeclicker` was available, so the `cubeclicker-game` fallback and a provider refusal are not applicable. The recorded limitations are the documented capability gaps: no `healthCheckPath` parameter (verified empty), no environment-variable read tool (the accepted replace-all write is the record), and no deploy-hook tool (owner hand-off for T5a). No service was deleted, no development resource was changed, no deploy hook was POSTed, and no push was performed.
