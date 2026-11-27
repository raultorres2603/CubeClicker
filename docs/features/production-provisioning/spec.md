---
feature: production-provisioning
revision: 3
status: draft
created: 2026-11-27
updated: 2026-11-27
---
# Spec — Production Environment Provisioning

## Summary

The repository has a fully provisioned `development` environment (Vercel project, Render Docker web service, Neon `development` branch, GitHub `development` Environment) but `production` is still partially provisioned: the `production` GitHub Environment holds a partial set of values, the Neon project already has its pre-existing default `production` branch (`br-floral-dream-zarerhtw`) but no production Render service or Vercel project exists, and there are no protection rules. The owner has authorized going to production and creating the live production resources with the MCPs available (Neon, Vercel, Render, GitHub, Brevo; Context7 for documentation), mirroring the development topology and the existing manual `workflow_dispatch` deploy path, while keeping every production **resource display name** on the base name `cubeclicker` with **no `-production` suffix and no environment token** — the GitHub Environment `production` and the Neon branch `production` are environment identifiers, not resource-name suffixes. This spec reuses and verifies the existing project-default Neon `production` branch and applies migrations to it (it never creates a duplicate and never branches from `development`), creates a second Vercel project and a second Render free Docker service, populates the `production` GitHub Environment with the same eleven-name guarded deploy catalog as development (seven variables, four secrets) plus the workflow-read names, adds `main`-only branch protection and required reviewers, proves the whole path with one live production `workflow_dispatch` deploy (guard success line, `/healthz` 200, deployed smoke 8/8), and updates every stale "production is not provisioned / placeholder-only / unprotected" statement in README and the architecture references. No application code, no new environment, no provider migration, no custom domain and no change to the development path are in scope.

## Raw request (verbatim, scope boundary)

> "We can go to production. So, using MCPS we have, configure the same way we configured development on GitHub, but, now, on production environment.
>
> Also, bear in mind, when deploying to Vercel, Neon or Render, do not use suffix "-production", do not use any environment suffix/prefix, is just on development environment."

## Scope

### In scope

- **Neon:** reuse and verify the existing project-default `production` branch `br-floral-dream-zarerhtw` in project `patient-mountain-41401588` (parent `—`/default, primary/default, unprotected), with pooled + direct URLs carrying `sslmode=require`; apply the numbered migrations to it; verify the seven migration names and zero application rows. Never create a duplicate branch and never branch from `development`.
- **Vercel:** create the production project named `cubeclicker` (fallback `cubeclicker-game`), root `src/frontend`, framework Vite, Node 24, the same `src/frontend/vercel.json` build, Git auto-deploy disabled, deployment protection off, domain `cubeclicker.vercel.app` (fallback `cubeclicker-game.vercel.app`).
- **Render:** create the production Docker web service named `cubeclicker` (fallback `cubeclicker-game`), same `src/backend/Dockerfile` + `dockerContext .`, branch `main`, one instance, `plan: free` unless the owner selects paid, region `frankfurt`, auto-deploy off, no platform health check; set its committed and dashboard-owned environment variables; obtain its deploy hook and service ID.
- **GitHub:** populate the `production` Environment with the same eleven-name guarded deploy catalog as development (seven variables, four secrets) **plus** the workflow-read names the deploy job needs (the full production catalog is 23 names: 15 variables, 8 secrets); the owner-held Phase A gate (T5a) supplies the five owner-held secrets and `SMTP_FROM`; add the `main`-only deployment branch policy and required reviewers; verify names only.
- **Live proof:** one CI-preflighted `workflow_dispatch` production deploy in the fixed order (guard → Neon migration → Render nine-name sync → deploy hook → health poll → Vercel `--prod` → deployed smoke), with the exact guard success line, `/healthz` 200 and `DEPLOYED SMOKE PASS (8/8 checks)`. T6a first fixes the pre-checkout `gh run list` repository context with the single owner-approved one-line workflow change.
- **Workflow preflight fix (T6a, exactly one line):** in `Verify CI succeeded for target commit`, add `--repo "$GITHUB_REPOSITORY"` to the pre-checkout `gh run list` (or an equivalent step-level `GH_REPO` env). No guard bypass, no condition/step-order/permission change and no other `deploy.yml` edit; the manual CI preflight stays intact and the automatic `workflow_run` path is unchanged.
- **Documentation:** update every stale production-unprovisioned/placeholder-only/unprotected statement in `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/email.md`, `docs/architecture/observability.md`, and `AGENTS.md`; update the supersession ledger; add the provisioning/live-deploy/rollback runbook; propose (not apply) the `docs/features/README.md` row.
- **Evidence:** per-task build logs with provider read-backs, names-only GitHub listings, MCP capability evidence, `actionlint`, config parses, credential audits and the live run proof.

### Explicitly out of scope

- No new environment (no staging), no third GitHub Environment, no provider migration, no new platform.
- No Neon branch creation or deletion: the pre-existing project-default `production` branch `br-floral-dream-zarerhtw` is reused, migrated, retained and never deleted.
- No application code, test, migration, schema, Dockerfile, compose-file, `package.json` or lockfile change.
- No change to the development Environment values, resources, names, credentials or pipeline behavior; no development deploy is triggered by this feature.
- No change to the Brevo/SMTP guard sources or tests; no extension of the SMTP port guard to production (`registration-account-exists` Q-2 remains open; the production port is set to the safe `2525` pair).
- No production auto-deploy from `main`; production stays `workflow_dispatch`-only, CI-preflighted and protected.
- No `render.yaml` second-service entry, no `src/frontend/vercel.json` change and no CI parse change; `deploy.yml` receives exactly the T6a one-line `--repo "$GITHUB_REPOSITORY"` preflight fix and no other functional edit (comment edits are dropped from this amendment).
- No custom domain, DNS, certificate or Vercel domain purchase; platform-default `*.vercel.app` / `*.onrender.com` hosts only.
- No production data migration or copy from development; no account, session, economy or customization row is copied.
- No deletion of development resources, archived AWS/Fly resources, the existing `production` GitHub Environment or the existing Neon `production` branch.
- No owner-held or existing secret value is read; provider-generated values created by this feature are handled in-process and never recorded. Owner-held credentials are entered by the owner via the GitHub UI or stdin.
- No edit of `docs/features/README.md` or `docs/features/production-provisioning/status.md` (orchestrator-owned).

## Context and current state

### Development (reference topology, provisioned)

| Surface | Provider | Provisioned identity |
| --- | --- | --- |
| Frontend | Vercel project, root `src/frontend` | `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`, `https://cubeclicker-development.vercel.app` |
| Backend | Render free Docker web service, one instance | `srv-dbtcvv9srm7s73au5bag`, `https://cubeclicker-development.onrender.com` |
| Database | Neon branch in project `patient-mountain-41401588` | `development` = `br-ancient-smoke-za1pdv7w`; pooled `DATABASE_URL` + direct `DIRECT_DATABASE_URL`, both `sslmode=require` |
| CI/CD | GitHub Actions | Environment `development` (automatic from `main` after CI; manual `workflow_dispatch` with `environment=development`) |

### Production (pre-state, verified from the repository and prior feature evidence)

- The GitHub `production` Environment exists and holds the nine pre-`brevo-api` names: four pinned constants (`SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_CONNECTION_TIMEOUT_MS=10000`) and five `CHANGEME` placeholders (`SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `RENDER_SERVICE_ID`, `RENDER_API_KEY`); it has **no protection rules and no deployment branch policy**.
- It lacks the `brevo-api-email-transport` catalog names (`EMAIL_TRANSPORT`, `BREVO_API_KEY`) and every workflow-read name (`FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`, `VERCEL_TOKEN`) and the inert parity names (`MAX_USERS_PER_SERVER`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`).
- **Neon pre-state:** project `patient-mountain-41401588` already has the project-default `production` branch `br-floral-dream-zarerhtw` (primary/default, parent `—`, unprotected, ready) and the `development` branch `br-ancient-smoke-za1pdv7w` created from it. There is **no `main` branch**; this feature reuses the existing production branch, applies migrations to it and never creates a duplicate or branches from `development` (`docs/features/vercel-fly-neon-deployment/build-log-T7-provision.md:20-35`). Prior evidence records no `users` table on production (`docs/features/registration-account-exists/reviews/spec-r1.md`), so the schema migration is the provisioning step; T2 re-reads the live branch list before acting.
- No production Render service or Vercel project is provisioned. Vercel has the development project; Render has the development service. The production Neon branch is the only pre-existing production provider resource.
- `.github/workflows/deploy.yml` already resolves the environment, `TARGET_ENVIRONMENT` and the concurrency group from `github.event.inputs.environment || 'development'`, runs one `deploy` job in the selected GitHub Environment, and is `production`-capable; the only workflow change is the T6a one-line preflight fix. The automatic `workflow_run` path resolves to `development`; production is reachable only by dispatch.
- `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `README.md`, `docs/architecture/email.md`, `docs/architecture/observability.md` and `AGENTS.md` contain the current "production not provisioned / placeholder-only / no protection rules" statements listed in § Documentation inventory.

### In-flight feature dependencies

- **`brevo-api-email-transport` (code_review) is a hard dependency.** The eleven-name guarded catalog (`SMTP_*` + `EMAIL_TRANSPORT` + `BREVO_API_KEY` + `RENDER_SERVICE_ID` + `RENDER_API_KEY`) and the nine-name sync exist only after that feature is merged to `main`. This feature's base branch is `main` **after** that merge; if `main` does not contain `EMAIL_CATALOG` in `src/backend/src/deploy/render-env.ts` and `EMAIL_TRANSPORT`/`BREVO_API_KEY` in `.github/workflows/deploy.yml`, T1 stops the feature as blocked and no production value is written. This spec does not claim any `brevo-api-email-transport` behavior as already on `main`.
- **`registration-account-exists` (code_review) is not a hard dependency.** This feature does not rely on its registration/resend/502 behavior; the deployed smoke is guest-only. Its Q-2 question (extend the strict Render-free SMTP port guard to production) remains open; this feature sets production `SMTP_PORT=2525` with `SMTP_SECURE=false` (the value the earlier feature already documents as the Render-free production requirement), so the safe value is in place **without** changing the guard code or its tests.
- `brevo-api-email-transport` T8 (owner live proof) and `registration-account-exists` T9 may still be pending; neither blocks this feature's static work, but the `brevo-api-email-transport` merge does. Ordering: merge `brevo-api-email-transport` → start `production-provisioning` from updated `main` → provision → live production deploy.

### MCP inventory and known capability gap

- The session exposes six MCP servers: Neon (143 tools), Vercel (281), GitHub (47), Render (50), Brevo (300) and Context7. The repository has no `.opencode/opencode.jsonc`; the MCP inventory lives in the global OpenCode config and the session tool catalog. The planner does not name or guess individual tools; T1 records the discovered names.
- Recorded capability evidence from prior features: Render MCP `create_web_service`, `get_service` and `update_environment_variables` created/configured the development service (`docs/features/render-backend-migration/build-log-T1-render.md`); Neon MCP `get_connection_string`/`run_sql` supplied and proved the development URLs; the Render deploy hook was **not** created through the MCP and `VERCEL_TOKEN` cannot be minted via MCP. These named tools are prior recorded evidence, not new assumptions about today's tool catalog; T1's live capability matrix is the only authority, and no task invokes a tool it has not listed.
- Known gap: the GitHub MCP exposes 47 tools (repository, issue, pull-request and file operations) and **no** Actions-run or Environment-variable tools (`docs/features/registration-account-exists/build-log-T9.md`). GitHub Environment creation/update, protection rules, variables and secrets use the authenticated `gh` CLI (`gh api`, `gh variable`, `gh secret`) as the documented fallback. `gh` auth must show `repo` scope; the environment write-permission probe is the prior validation-failure pattern (HTTP 422, creates nothing).

## Naming contract

- **Rule.** Production **resource display names** use the base name `cubeclicker` with no `-production` suffix, no `prod`/`dev`/`staging` prefix and no other environment token. The production Render service and its hostname, and the production Vercel project and its domain, are:
  - Render service `cubeclicker` → `https://cubeclicker.onrender.com`;
  - Vercel project `cubeclicker` → `https://cubeclicker.vercel.app`.
- **Fallback.** If `cubeclicker` is unavailable at a provider, the single documented clean fallback is `cubeclicker-game` (`https://cubeclicker-game.onrender.com`, `https://cubeclicker-game.vercel.app`). If both are unavailable, the task stops and asks the owner; `cubeclicker-production` and any environment-token name are never used.
- **Environment identifiers (explicit interpretation).** The GitHub Environment is named `production` and the Neon branch is named `production`. These are environment identifiers in their provider's namespace (GitHub Environments, Neon branches), not resource display names with an environment suffix; the no-suffix rule does not rename them. The Neon project keeps its existing name `patient-mountain-41401588`.
- Development resources keep their existing `-development` names (`cubeclicker-development` service/project and `cubeclicker-development.*` hosts).
- The production frontend origin and API origin are the stable platform-default hosts above; no custom domain exists in this feature.

## Resource contract (production)

| Resource | Provider | Required shape | Evidence |
| --- | --- | --- | --- |
| Neon branch | Neon, project `patient-mountain-41401588` | **reuse and verify** the pre-existing project-default `production` branch `br-floral-dream-zarerhtw` (parent `—`, primary/default, unprotected); never create a duplicate and never branch from `development`; pooled `DATABASE_URL` with `-pooler` and direct `DIRECT_DATABASE_URL`, both `sslmode=require`; the seven numbered migrations applied; `schema_migrations` = 7 names; `users`/`sessions`/`verification_tokens`/`user_economy` zero rows | Neon read-back + SQL counts, names only |
| Vercel project | Vercel | name `cubeclicker` (fallback `cubeclicker-game`); root `src/frontend`; framework `vite`; Node `24.x`; build from `src/frontend/vercel.json`; Git auto-deploy off; deployment protection off; domain per naming contract | Vercel read-back; project/org IDs non-secret |
| Render service | Render | name `cubeclicker` (fallback `cubeclicker-game`); runtime `docker`; `dockerfilePath ./src/backend/Dockerfile`; `dockerContext .`; branch `main`; one instance; `plan: free` unless owner-selected paid; region `frankfurt`; `autoDeployTrigger: 'off'`; no `healthCheckPath` | Render read-back; service ID/host non-secret |
| Render env | Render | 8 committed non-secret names + 7 dashboard-owned names (see § Environment catalog); no `RENDER_API_KEY`/`RENDER_SERVICE_ID`; the nine synced names arrive from the workflow | Render env names/values for non-secrets; secrets names only |
| Deploy hook | Render | one deploy hook URL for the production service, stored as `RENDER_DEPLOY_HOOK_URL`; never printed | `gh secret list` name; build-log statement |
| GitHub Environment | GitHub | name `production`; 23 names (15 variables, 8 secrets); `main`-only deployment branch policy; required reviewers (owner default) | `gh variable list` / `gh secret list` names; `gh api environments/production` protection read-back |
| Live deploy | GitHub Actions | `workflow_dispatch` from `main`, `environment=production`, after CI success; fixed order; guard line; 9 sync lines; `/healthz` 200; smoke 8/8 | run URL + redacted log excerpts; provider deploy IDs |

## Environment catalog (GitHub `production`)

All values are per Environment; only names are listed here, never secret values. The **guarded eleven-name deploy catalog** is exactly the same as development: 7 variables + 4 secrets. The **full production catalog** adds the workflow-read names and the inert parity names that development already carries: 23 names (15 variables, 8 secrets).

### Guarded eleven-name deploy catalog (validated by `Check deployment Brevo configuration`, nine synced)

| Name | GitHub type | Production value / source | Synced to Render? |
| --- | --- | --- | --- |
| `SMTP_HOST` | variable | `smtp-relay.brevo.com` (builder-set constant) | yes |
| `SMTP_PORT` | variable | `2525` (builder-set; Render-free-safe STARTTLS pair; supersedes the old `587` placeholder) | yes |
| `SMTP_SECURE` | variable | `false` (builder-set) | yes |
| `SMTP_CONNECTION_TIMEOUT_MS` | variable | `10000` (builder-set) | yes |
| `SMTP_FROM` | variable | the Brevo-verified sender (owner-supplied variable; the builder may copy the non-secret development value in-process, never recording it) | yes |
| `EMAIL_TRANSPORT` | variable | `brevo-api` (builder-set) | yes |
| `RENDER_SERVICE_ID` | variable | the created production Render service ID (provider-read non-secret; builder-set) | no — URL path only |
| `SMTP_USER` | secret | Brevo SMTP login (owner-held; the deployed API transport does not read it) | yes |
| `SMTP_PASS` | secret | Brevo SMTP key (owner-held; not the REST API key; the API transport does not read it) | yes |
| `BREVO_API_KEY` | secret | Brevo **REST API key** (owner-held; dedicated production key preferred) | yes |
| `RENDER_API_KEY` | secret | Render API key (owner-held; dedicated production key preferred) | no — bearer header only |

### Workflow-read complement (needed for the deploy job; not part of the guard)

| Name | GitHub type | Production value / source | Consumer |
| --- | --- | --- | --- |
| `FRONTEND_ORIGIN` | variable | `https://cubeclicker.vercel.app` (fallback `https://cubeclicker-game.vercel.app`; builder-set) | job `env`, smoke origin |
| `VITE_API_URL` | variable | `https://cubeclicker.onrender.com` (fallback; builder-set) | health poll, Vercel build, smoke |
| `VITE_WS_URL` | variable | `wss://cubeclicker.onrender.com/ws` (fallback; builder-set) | Vercel build, smoke |
| `VERCEL_ORG_ID` | variable | Vercel org ID (provider-read non-secret; builder-set) | Vercel CLI |
| `VERCEL_PROJECT_ID` | variable | the created production Vercel project ID (provider-read non-secret; builder-set) | Vercel CLI |
| `DATABASE_URL` | secret | Neon production **pooled** URL, `sslmode=require` (provider-generated; builder-set) | Neon migration fallback |
| `DIRECT_DATABASE_URL` | secret | Neon production **direct** URL, `sslmode=require` (provider-generated; builder-set) | Neon migration (preferred) |
| `RENDER_DEPLOY_HOOK_URL` | secret | production Render deploy hook URL (builder-set if the provider exposes it; otherwise owner-held) | `curl -fsS -X POST` |
| `VERCEL_TOKEN` | secret | Vercel token (owner-held; dedicated production token preferred) | `vercel pull/build/deploy` |

### Inert parity names (mirror development; not read by the deploy job)

| Name | GitHub type | Production value / source |
| --- | --- | --- |
| `MAX_USERS_PER_SERVER` | variable | `10` (builder-set) |
| `SESSION_COOKIE_SECURE` | variable | `true` (builder-set) |
| `SESSION_COOKIE_SAMESITE` | variable | `none` (builder-set; cross-site default hosts) |

- `SMTP_USER` exists only as a secret (no `SMTP_USER` variable), matching development after the `SMTP_USER` migration.
- `RENDER_API_KEY` and `RENDER_SERVICE_ID` are never written to the Render service; the nine synced names are the seven SMTP names plus `EMAIL_TRANSPORT` and `BREVO_API_KEY`.
- The production Render service itself carries the 8 committed names (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, `METRICS_ENABLED=false`, `MAX_USERS_PER_SERVER=10`, `DB_SCHEMA_BOOTSTRAP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000`) plus the 7 dashboard-owned names (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `CORS_ORIGIN`, `ALLOWED_ORIGIN`, `APP_BASE_URL`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`), with `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL` exactly equal to `FRONTEND_ORIGIN`.
- The nine synced names are written by the deploy workflow from the `production` Environment; the Render dashboard is not the source for them and a dashboard edit is reverted on the next deploy.

## Secret handling and value sourcing

| Class | Names | Who sets it | How |
| --- | --- | --- | --- |
| Provider-generated, builder-settable | `DATABASE_URL`, `DIRECT_DATABASE_URL`; `RENDER_DEPLOY_HOOK_URL` if the Render capability check can read it; `RENDER_SERVICE_ID`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL` | Builder | Read from the provider response in-process; write to GitHub via `gh secret set` stdin (secrets) or `gh variable set`/`gh api` (non-secrets); write the two Neon URLs to the Render service with the provider env API; never echo, log, commit or record a value |
| Builder-set constants | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `EMAIL_TRANSPORT`, `MAX_USERS_PER_SERVER`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE` | Builder | `gh variable set` with the pinned non-secret literals |
| Owner-held (Phase A) | `VERCEL_TOKEN`, `RENDER_API_KEY`, `BREVO_API_KEY`, `SMTP_USER`, `SMTP_PASS` (secrets); `SMTP_FROM` (variable); `RENDER_DEPLOY_HOOK_URL` only if not provider-readable | Owner | GitHub UI or `gh secret set` stdin; the builder verifies names only and never reads the value |
| Existing development values | any `development` secret | Nobody | Never read, copied, compared or recorded by this feature |

- **Never read an existing secret.** The builder uses no `gh secret get`, no secret-dump command, no development secret copy. The only secret values the builder handles are values **created by this feature** in the provider response (Neon URLs, and the Render hook if the tool returns it); those travel through mode-600 files under `/tmp/opencode` or an in-process pipe, are written to GitHub/Render on stdin/API, and are deleted after use, following the recorded precedent in `docs/features/render-backend-migration/build-log-T2-env.md`.
- **Owner Phase A prerequisite (T5a owner gate).** Before the builder's full-catalog verification (T5), the owner sets the five owner-held secrets (`SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY`), the `RENDER_DEPLOY_HOOK_URL` secret when the provider cannot expose it, and the `SMTP_FROM` variable, via the GitHub UI; the secrets use `gh secret set` stdin, while `SMTP_FROM` uses `gh variable set SMTP_FROM`. T5a verifies names only (`gh variable list --env production` / `gh secret list --env production`); no value is printed. T5 depends on T5a and remains blocked until T5a records `Phase A owner hand-off complete`. `SMTP_FROM` may be copied from the non-secret development variable by the builder in-process if the owner prefers; it is never recorded.
- **Missing-value behavior.** If any of the eleven guarded names is missing or contains `CHANGEME`, `Check deployment Brevo configuration` fails closed with the exact `'production'` block before the Neon migration, the Render API call and Vercel; the workflow run is red and no provider is touched. The task records the block, the owner fixes the value (UI/stdin) and the run is re-run; the guard is never bypassed or weakened.
- **Evidence.** Build logs record names, timestamps, IDs, domains and the exact guard/sync lines only; secrets appear as `<set>`/`<not shown>`. The shared build-log guard covers credential assignments, `rnd_`, `xkeysib-`, `xsmtpsib-`, connection strings with credentials, email addresses and 32+ hex tokens.

## Deploy path

Production stays **manual**: `workflow_dispatch` with `environment=production`, from `main`, after a successful CI run for the target SHA. No production auto-deploy from `main` is added; the automatic `workflow_run` path still resolves to `development`. The fixed order is unchanged:

```
Check deployment Brevo configuration (11 names, --check-only, no network)
→ Migrate Neon database (production DIRECT_DATABASE_URL)
→ Sync Brevo SMTP settings to Render (9 deployed names)
→ Deploy Render backend (production deploy hook)
→ 45 s wait → /healthz poll (180 s)
→ Vercel pull/build/deploy --prod (production project)
→ warm /healthz → deployed smoke (8 checks)
```

- `deploy.yml` needs no functional change beyond the single T6a preflight line: every provider value is read from the selected GitHub Environment, `VERCEL_PROJECT_ID` selects the production project, and `--prod` updates that project's production domain. The manual preflight adds `--repo "$GITHUB_REPOSITORY"` to the pre-checkout `gh run list`; the guard logic, condition, step order, permissions, triggers and concurrency stay unchanged, and the automatic `workflow_run` path still resolves to `development`.
- `render.yaml` stays the development-service description: it is a Blueprint/documentation artifact for the existing service, and adding a second service would make the same file an adoption/creation surface for production. The production service is created through the Render MCP and documented in `vercel-render-neon.md`; its committed non-secret values are the same list as `render.yaml`. `src/frontend/vercel.json` is per-project and unchanged. `ci.yml`'s `render.yaml` parse (exactly one `cubeclicker-development` service) and the dispatch parse stay unchanged.
- The production environment's protection rules gate the job: the deployment branch policy allows only `main`; required reviewers (owner by default) pause the job until approved. The development path is unchanged (no protection, automatic from `main`).
- `brevo-api-email-transport` must be on `main` first (hard dependency). The live deploy runs from `main`; no feature-branch-only behavior is claimed.

## Live provisioning operations (ordered, idempotent)

1. **Capability and dependency gate (T1).** Read-only: enumerate the MCP tools for Neon/Vercel/Render/GitHub; verify `gh` auth/scopes and the write-permission probes (validation-only, create nothing); record the pre-state names/IDs; check `main` contains the eleven-name catalog and nine-name sync. Stop if the dependency is absent.
2. **Neon (T2).** Reuse and verify the pre-existing project-default `production` branch `br-floral-dream-zarerhtw` (parent `—`, primary/default, unprotected); read/derive pooled and direct URLs; verify `sslmode=require` with a real `pg` connection; apply the pending migrations; verify `schema_migrations` = the seven names and zero application rows. Idempotent: the branch is never created or deleted; migrations are idempotent; the seven-name and zero-data checks are re-run.
3. **Vercel (T3).** Reuse or create the `cubeclicker` project (fallback `cubeclicker-game`); set root `src/frontend`, Vite, Node 24, Git auto-deploy off, protection off; read project/org IDs and domain. Idempotent: an existing project is updated to the same settings.
4. **Render (T4).** Reuse or create the `cubeclicker` service (fallback `cubeclicker-game`); set the 8 committed + 7 dashboard-owned env names; read service ID/host and the deploy hook (or record the owner hand-off). Idempotent: an existing service is updated to the same shape; env names are re-written.
5. **Phase A owner gate (T5a).** The owner sets the five owner-held secrets plus `SMTP_FROM` (and the deploy hook if not provider-readable); the builder verifies names only. T5 remains blocked until this gate records `Phase A owner hand-off complete`.
6. **GitHub `production` Environment (T5).** Set the 14 builder variables and the builder-settable secrets (up to 3; the deploy hook is owner-held when the provider cannot expose it); verify the owner-held names; set the `main`-only branch policy and required reviewers; names-only read-back. Idempotent: set/refresh the same names; the protection `PUT` is idempotent.
7. **Workflow preflight fix (T6a).** On a `fix/deploy-ci-preflight` branch from `origin/main`, change exactly one line in `Verify CI succeeded for target commit`: add `--repo "$GITHUB_REPOSITORY"` to the pre-checkout `gh run list`. Open a PR through the GitHub MCP; the owner merges to `main`; record the PR URL, exact diff, actionlint and the `gh run list --repo "$GITHUB_REPOSITORY"` dry-run. No `git push`, no guard bypass, no condition/step-order/permission change.
8. **Live deploy (T6).** Re-run the same production dispatch after the T6a fix is on `main`: verify all 23 names and CI success; dispatch `gh workflow run deploy.yml --ref main -f environment=production`; owner approves the protection gate if prompted; capture the fix PR/commit, the guard line, 9 `SYNCED` lines, migration output, the exact health-poll body, Vercel deployment and smoke `DEPLOYED SMOKE PASS (8/8 checks)`. Re-runs are safe (idempotent).
9. **Docs and final gate (T7/T8).** Update the docs to the live state and record the preflight fix; re-run the static gate, the provider/development read-backs and the live read-backs; propose the feature-index row.

## Partial-failure cleanup and rollback

- **Before the live deploy is green** there is no production data beyond the migration bookkeeping. Cleanup, in order: (1) delete or suspend the production Render service to stop the 750-hour free-plan consumption; (2) delete the production Vercel project (it has no authoritative deployment); (3) **retain the pre-existing Neon `production` branch** — it predates this feature, is the project default, and is **never deleted**; only its newly applied schema migrations remain (forward-only); (4) keep the `production` GitHub Environment (it existed before this feature) and leave its names-only state; (5) never touch development. The owner approves any deletion of the Render/Vercel resources this feature created. No deletion of the existing Neon branch occurs in any scenario.
- **After the live deploy is green** production is live: no production resource is deleted, repointed to development or rolled back to a development host. Failures are fixed forward.
- **Bad revision:** Vercel rollback/promote for the frontend; Render dashboard rollback or a known-good redeploy for the backend; Neon forward-only migrations (PITR branch only for a schema incident, per the existing rollback runbook). A Render rollback restarts the single instance; clients reconnect on the unchanged bounded policy and in-memory rooms reset. The existing `production` branch is never dropped or re-created.
- **No rollback to development** in any scenario: production's `FRONTEND_ORIGIN`, `VITE_API_URL`, `DATABASE_URL` and `DIRECT_DATABASE_URL` are never pointed at development resources; development is never used as a production fallback.

## Cost, plan and protection decisions

| # | Decision | Default | Consequence / owner question |
| --- | --- | --- | --- |
| C-1 | Render production plan | `free`, mirroring development | Two free services share the workspace's **750 instance hours/month**; if both stay awake, the budget is exceeded (~730 h each). Idle spin-down usually keeps it under, but a busy production service can starve development. Paid removes spin-down but is a user-owned cost. |
| C-2 | Vercel plan | current plan (Hobby), mirroring development | **Hobby is non-commercial**; a public game that generates revenue needs a commercial plan. Provisioning works on Hobby; the owner confirms/upgrades before a commercial launch. |
| C-3 | Neon plan | `free` | Free-plan compute autosuspends; the `production` branch is **not protected** — an accepted deviation; protected branches/PITR need a paid plan. |
| C-4 | Production protection | `main`-only deployment branch policy **and** required reviewers (owner) | Mirrors the documented production requirement; development stays unprotected. Single-owner repo: if GitHub refuses self-approval by the triggering actor, the run waits; the documented fallback is to keep the branch policy and remove reviewers (or add a second reviewer), recorded as an owner decision. |
| C-5 | Credentials | dedicated production `VERCEL_TOKEN`, `RENDER_API_KEY`, `BREVO_API_KEY`; the Brevo SMTP login/key may be reused for the inert SMTP names | Dedicated keys isolate rotation and blast radius. Reuse is an explicit owner risk acceptance. The builder never creates a token through a tool that would expose it in the transcript. |
| C-6 | Production `SMTP_PORT` | `2525` with `SMTP_SECURE=false` | The Render-free-safe STARTTLS pair; supersedes the old `587` placeholder (the API transport ignores SMTP, but the safe pair keeps a future SMTP fallback viable). |
| C-7 | `render.yaml` | keep as the development-service description | Avoids a second Blueprint service/adoption surface; the production service is documented separately. |
| C-8 | `workflow_dispatch` default | keep `production` | No trigger change; the protection gate now pauses an accidental production dispatch. The docs warn to select `development` for development work. |

## Documentation inventory

Stale current-state strings to remove/replace (exact examples; the T7 verify pins them, and T8 re-runs a final exhaustive scan with a documented allowlist):

- `README.md`: `production intended, not provisioned`; `production` is **not provisioned** and stays `placeholder-only`; `no Render service, Vercel project or Neon branch is provisioned`; `no protection rules are configured`; `no live production environment is modified`; `production 587 is placeholder-only`; `# production (placeholder-only)`; `Production remains unprovisioned`; `production is unprovisioned`; `Production is placeholder-only`; `production stays placeholder-only until then`; `The production column is a code/documentation catalog`; `six pinned placeholders`; `has no protection rules yet`.
- `docs/architecture/deployment.md`: `not provisioned` in the environments table; `not provisioned (a Neon `production` branch is the intended target)`; `none configured: no protection rules and no deployment branch policy yet`; `has no protection rules yet`; `the live production Environment is unchanged`; `production is not provisioned`; `production is manual (workflow_dispatch) and unprovisioned`; `Production (placeholder-only)`; `production is not provisioned on the free plan`; `reviewer/branch protection must be added when it is provisioned`; `one `development` branch today (production intended)`; `six pinned placeholders`; the historical AWS table row and ledger phrase `production manual and unprovisioned`.
- `docs/architecture/vercel-render-neon.md`: `Environments development (provisioned) and production (not provisioned)`; `production is **not provisioned**`; `### GitHub Environment production (not provisioned, manual only)`; `no protection rules and no deployment branch policy`; `has no protection rules yet`; `no Render service, Vercel project or Neon branch is provisioned`; `until then, production is also not provisioned`; `the production names stay placeholder-only`; `production is manual, unprovisioned and placeholder-only`; `### Promote to production (currently unprovisioned)`; `production stays placeholder-only`; `not provisioned` in the local-vs-cloud table; `why production is not provisioned on the free plan`; `The only Vercel project is the development project`; `a future production project must make its own protection decision`; `GitHub Environment (`placeholder-only`; not provisioned)`; `one project (`development`)`; `production branch when provisioned`; `six pinned placeholders`.
- `docs/architecture/email.md`: `The production column is a code/documentation catalog ... not a live-environment claim; the feature writes no production values and no live production environment is modified`.
- `docs/architecture/observability.md`: `render.yaml commits METRICS_ENABLED: 'false' for the development service` (now one value for each deployed service).
- `AGENTS.md`: `production is manual (workflow_dispatch) and unprovisioned`.
- `.github/workflows/deploy.yml`: only the T6a one-line `gh run list --repo "$GITHUB_REPOSITORY"` preflight fix; the two stale comments are left unchanged (comment edits are dropped from this amendment).

Positive statements to add: the production resources (names/IDs/URLs), the 23-name catalog and the 11-name guarded/9-name synced split, the `main`-only branch policy and reviewers, the manual command `gh workflow run deploy.yml --ref main -f environment=production`, the live proof, the cost/limits and the no-suffix naming rule, the promote-to-production and rollback runbooks, and a `production-provisioning` row in both supersession-ledger references (`deployment.md`, `vercel-render-neon.md`) stating that it supersedes the production-unprovisioned/placeholder-only statements while retaining the manual trigger, guard, sync, catalog and development path.

## User stories

- As the repository owner, I want production provisioned end to end (Neon branch, Vercel project, Render service, GitHub values and protection), so the game can go live with the same topology and safety gates as development.
- As the repository owner, I want production resources named `cubeclicker` with no `-production` suffix, so the live URLs are clean and not environment-stamped.
- As the security reviewer, I want the builder to never read or record a secret, owner-held credentials entered by the owner, and provider-generated values handled in-process, so provisioning cannot leak a credential.
- As the reviewer, I want the deploy guard to fail closed before any provider call when a production value is missing, and the live proof to show the exact guard line, `/healthz` 200 and smoke 8/8, so production is provably safe.
- As the operator, I want the production deploy to remain a manual, CI-preflighted, protected `workflow_dispatch`, so production never deploys from `main` automatically and development keeps its automatic path.
- As the maintainer, I want every stale "production is not provisioned" statement corrected and the supersession ledger updated, so the docs match the live state.

## Acceptance criteria

Identifiers, names and messages below are exact. "Names only" means names, IDs, domains, timestamps and redacted status text; never a value. Commands run from the repository root with `--repo raultorres2603/CubeClicker` (or an equivalent `GH_REPO` supplied by the orchestrator).

- **AC-1 — Production resource names carry no environment token.**
  (a) The Render production service `name` is exactly `cubeclicker` (or the single fallback `cubeclicker-game`), and its public host is exactly `cubeclicker.onrender.com` (or `cubeclicker-game.onrender.com`); the recorded name+host contain no `production`, `prod`, `dev`, `development`, `staging` or `stage` token (case-insensitive).
  (b) The Vercel production project name and its production domain are exactly `cubeclicker` / `cubeclicker.vercel.app` (or `cubeclicker-game` / `cubeclicker-game.vercel.app`); the recorded name+domain contain no environment token.
  (c) The Neon branch is named exactly `production` and the GitHub Environment is named exactly `production`; the build log states these are environment identifiers, not resource display names, and applies the no-suffix rule only to provider resource display names.
  (d) No resource created by this feature has `-production` in its display name, and no `cubeclicker-production` resource/domain/host exists.
  Evidence: Render/Vercel/Neon read-backs recorded in `build-log-T3.md`/`build-log-T4.md`; a case-insensitive `grep -E 'production|prod|dev|staging|stage'` over the recorded resource names/hosts (excluding the two environment identifiers) returns no match.

- **AC-2 — The existing Neon `production` branch is reused, migrated and empty of application data.**
  (a) The existing Neon project `patient-mountain-41401588` contains exactly one branch named `production`, with branch id exactly `br-floral-dream-zarerhtw`; the dev branch id `br-ancient-smoke-za1pdv7w` is different and remains present. If the live read-back id differs, T2 stops with `BLOCKED: production branch id drift`; it does not substitute an id.
  (b) The `production` branch is the project-default/primary branch (`parent: none (project default)`, `primary: true`, `default: true`); it is **not** created by this feature and **not** branched from `development`; no duplicate `production` branch exists.
  (c) The pooled `DATABASE_URL` host contains `-pooler`; the direct `DIRECT_DATABASE_URL` host does not; both carry `sslmode=require`; both connect successfully with a real `pg` client (no output) before being stored.
  (d) The migration CLI (`npx --no-install tsx src/backend/src/db/migrate-cli.ts` with `DIRECT_DATABASE_URL`) has applied the numbered migration set to the production branch; `schema_migrations` contains exactly seven rows with the names `001_init.sql`, `002_economy.sql`, `003_upgrades.sql`, `004_idle_accrual.sql`, `005_spaceship_customization.sql`, `006_granular_spaceship_parts.sql`, `007_economy_revision.sql`, and the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`) exist.
  (e) The four application tables contain exactly zero rows on the production branch after provisioning (`schema_migrations` is exempt).
  (f) No connection string, role password or credential appears in any build log.
  Evidence: Neon read-backs and `run_sql` counts in `build-log-T2.md`; migration output; the credential guard.

- **AC-3 — The Vercel production project mirrors the development build with the production protection decision.**
  (a) A Vercel project exists with the AC-1(b) name/domain, root directory `src/frontend`, framework `vite`, Node.js `24.x`, the `src/frontend/vercel.json` build command/output/rewrites/headers, Git auto-deploy disabled, and Vercel deployment protection (Vercel Authentication/SSO) disabled.
  (b) The project is distinct from the development project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`; the development project's settings, domain and deployments are unchanged.
  (c) The project ID and org ID are recorded as non-secret values and set as the `production` Environment's `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID`.
  (d) T3 creates no Vercel deployment; the first production deployment is the live workflow run in T6.
  (e) The T6a workflow fix does not change the Vercel project, its deployment protection or the first-deployment timing; it only fixes the pre-checkout CI query.
  Evidence: Vercel read-back in `build-log-T3.md`; `gh variable list`; no deployment ID in T3.

- **AC-4 — The Render production service matches development and carries the runtime configuration.**
  (a) A Render Docker web service exists with the AC-1(a) name/host, runtime `docker`, `dockerfilePath ./src/backend/Dockerfile`, `dockerContext .`, branch `main`, one instance, `plan: free` (or the recorded owner-selected paid plan), region `frankfurt`, `autoDeployTrigger: 'off'`, and no `healthCheckPath`.
  (b) The service environment contains the eight committed non-secret names with the exact values `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, `METRICS_ENABLED=false`, `MAX_USERS_PER_SERVER=10`, `DB_SCHEMA_BOOTSTRAP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000`, and the seven dashboard-owned names: `CORS_ORIGIN`, `ALLOWED_ORIGIN` and `APP_BASE_URL` exactly equal to `FRONTEND_ORIGIN`, `DATABASE_URL=<set>` and `DIRECT_DATABASE_URL=<set>` (secret values names-only), `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`.
  (c) `RENDER_API_KEY` and `RENDER_SERVICE_ID` are not service environment variables.
  (d) The service ID is recorded; the deploy hook is stored as `RENDER_DEPLOY_HOOK_URL` (or the owner hand-off is recorded), and no hook value appears in a build log.
  (e) Any deploy created by the provider at service creation is explicitly not acceptance evidence; the authoritative deploy is the T6 workflow run.
  Evidence: Render read-back (secret values names-only) in `build-log-T4.md`; `gh secret list` name; build-log guard.

- **AC-5 — The `production` GitHub Environment carries the exact catalog and protection, and development is untouched.**
  (a) The `production` Environment contains exactly the 23 names in § Environment catalog: 15 variables (`FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `MAX_USERS_PER_SERVER`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `EMAIL_TRANSPORT`, `RENDER_SERVICE_ID`) and 8 secrets (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`, `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_API_KEY`, `VERCEL_TOKEN`).
  (b) The eleven-name guarded catalog is exactly 7 variables + 4 secrets as listed; `SMTP_USER` is a secret only (no `SMTP_USER` variable).
  (c) Builder-set variables have the exact values in the table: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `SMTP_CONNECTION_TIMEOUT_MS=10000`, `EMAIL_TRANSPORT=brevo-api`, `MAX_USERS_PER_SERVER=10`, `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`, `FRONTEND_ORIGIN=https://<production-frontend-host>`, `VITE_API_URL=https://<production-api-host>`, `VITE_WS_URL=wss://<production-api-host>/ws`, plus `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RENDER_SERVICE_ID` read from the providers.
  (d) The Phase A owner gate T5a is complete (`Phase A owner hand-off complete`): the owner-held names (`SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY` as secrets; `SMTP_FROM` as a variable) are present (names only) and non-placeholder; the T6 guard success line proves it.
  (e) The `production` Environment allows exactly the `main` branch (custom deployment branch policy) and carries a `required_reviewers` protection rule (owner by default) or the documented owner-declined/deadlock fallback; the branch policy is present in every case.
  (f) The `development` Environment and its Names are unchanged; no builder write command targeted `development`; the pre/post names-only listings match.
  Evidence: `gh variable list`/`gh secret list` exact name sets; `gh api repos/.../environments/production` protection read-back; `build-log-T5.md`; development pre/post listings.

- **AC-6 — Owner-held and existing secret values are never read, printed, logged, committed or recorded.**
  (a) No build log, tracked file, workflow output or command line contains a Neon connection string with credentials, a Vercel token, a Render API key/deploy hook value, a Brevo API key, an SMTP login/key or any secret value; the feature's build-log guard passes over every `docs/features/production-provisioning/build-log-*.md`.
  (b) Builder-settable secret values are exactly the provider-generated Neon URLs and (when provider-readable) the Render deploy hook; they are written via stdin/in-process API, never echoed, never in a command argument, never in an artifact, and the temporary files are deleted.
  (c) Owner-held and existing secret values are never read: no `gh secret get`, no development secret copy, no value comparison; the provider-generated values created by this feature are handled in-process and never recorded.
  (d) Owner-held values (`VERCEL_TOKEN`, `RENDER_API_KEY`, `BREVO_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and the deploy hook when not provider-readable) are entered by the owner via the GitHub UI or stdin; the builder verifies names only.
  (e) `.env*` is untouched: `git status --porcelain -- '.env*'` and `git diff --name-only <base> -- '.env*'` are empty.
  Evidence: credential-guard output; command inventory; names-only listings; `.env*` checks.

- **AC-7 — One live production deploy proves the path end to end.**
  (a) The production deploy is a `workflow_dispatch` run from `main` with `environment=production`, dispatched only after `gh run list --workflow CI --commit <main-sha>` reports `success`; the run event is `workflow_dispatch`, the head branch is `main`, and no `push`-triggered production deploy exists.
  (b) The run's `Check deployment Brevo configuration` step prints exactly `Deploy configuration OK: 11 value(s) present for the 'production' environment.` before any provider call.
  (c) The `Sync Brevo SMTP settings to Render` step prints exactly nine `SYNCED <KEY> (value verified, not shown)` lines (the seven SMTP names plus `EMAIL_TRANSPORT` and `BREVO_API_KEY`) and exactly `Synced 9 value(s) to Render service <id> for the 'production' environment.`
  (d) The Neon migration step runs with the production `DIRECT_DATABASE_URL` and reports zero or more applied migrations (idempotent); no development URL is used.
  (e) The Render deploy hook starts a new production deploy; the logged `/healthz` poll line matches exactly `healthz OK after <n>s: {"status":"ok"}` (HTTP 200, exact body) within 180 s.
  (f) The Vercel step deploys the production project with `--prod` and the production domain serves the new deployment.
  (g) `node tests/e2e/deployed-smoke.mjs` prints exactly `DEPLOYED SMOKE PASS (8/8 checks)`; the recorded run has no `FAIL`.
  (h) The run URL, Render deploy ID/status and Vercel deployment ID are recorded; a post-run `/healthz` check returns 200.
  (i) The build log records the single lines `production frontend: <url>` and `production api: <url>` (the actual host, never the fallback alternative in the same line); T5/T8 extract these lines rather than a `head -n1` over a log that mentions both names.
  (j) The successful run occurs only after T6a's one-line fix is merged to `main`; the T6 build log records the fix PR URL and the fix commit SHA on `main`.
  Evidence: redacted log excerpts and run/provider IDs in `build-log-T6.md`.

- **AC-8 — The development path and production trigger model are unchanged, with read-back proof.**
  (a) The `development` Environment names, the development Render service `srv-dbtcvv9srm7s73au5bag` (`https://cubeclicker-development.onrender.com`), the development Vercel project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` (`https://cubeclicker-development.vercel.app`), and the development Neon branch `br-ancient-smoke-za1pdv7w` are unchanged; no builder command targeted them. T1 records the pre-state and T5/T8 re-run the same provider read-backs; the development post-read-back line is `development unchanged: PASS`.
  (b) `deploy.yml` still has no `push` trigger; the automatic `workflow_run` path still resolves to `development`; production remains `workflow_dispatch`-only; the `ci.yml` dispatch parse and the two guard fixtures pass.
  (c) No production resource is used as a development resource or vice versa; no rollback to development is performed; the existing Neon `production` branch is never deleted.
  (d) T8 records the production read-backs too: `production neon branch: br-floral-dream-zarerhtw`, `production vercel project: <prj-id> <url>`, `production render service: <srv-id> <url>`, `production github names: 15 variables / 8 secrets`, and the exact `production frontend:`/`production api:` lines.
  (e) The only `deploy.yml` change is the T6a one-line preflight fix: `gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion ...` in `Verify CI succeeded for target commit`; the guard condition (`conclusion` must be `success`), the step `if` (dispatch only), step order, permissions, triggers and concurrency are unchanged, and the automatic `workflow_run` path still resolves to `development`.
  Evidence: T1 pre-state read-backs; T5/T8 post-read-backs; T6a workflow diff; workflow parse; command inventory; `build-log-T8.md` statement.

- **AC-9 — Documentation matches the live production state.**
  (a) The stale current-state strings listed in § Documentation inventory are gone from `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/email.md`, `docs/architecture/observability.md` and `AGENTS.md` (exact negative greps), and T8 executes a final exhaustive `grep -RniE 'not provisioned|unprovisioned|placeholder-only|future production|one project|six pinned placeholders|has no protection rules yet'` over the edited docs with a documented allowlist for the historical AWS/Fly sections only; no non-allowlisted production claim remains.
  (b) The docs contain the production resource names/IDs/URLs, the 23-name catalog, the 11-name guarded/9-name synced split, the `main`-only branch policy and required reviewers, the manual command `gh workflow run deploy.yml --ref main -f environment=production`, the live proof, the cost/limits (shared 750 h, Vercel Hobby non-commercial, Neon free unprotected), the promote-to-production/rollback runbook and the no-suffix naming rule (exact positive greps).
  (c) The supersession-ledger references in `deployment.md` and `vercel-render-neon.md` gain the exact row `` `production-provisioning` — **in force**; supersedes the production-unprovisioned/placeholder-only statements; retains the manual trigger, guard, sync, catalog and development path `` stating it supersedes the production-unprovisioned/placeholder-only statements while retaining the manual trigger, guard, sync, catalog and development path.
  (d) `docs/features/README.md` is not edited; the proposed row (`production-provisioning | Production Environment Provisioning | accepted | 2026-11-27`) is recorded in `build-log-T7.md`; `docs/features/production-provisioning/status.md` is not edited.
  (e) Links in the edited docs resolve; no broken relative link is introduced.
  (f) The deployment docs record the T6a preflight fix (the `--repo "$GITHUB_REPOSITORY"` line and why the pre-checkout step needs it), the manual CI preflight remains intact, and the automatic path is described as unchanged.
  Evidence: the exact greps in T7/T8; link checks; the build log.

- **AC-10 — The feature-appropriate verification gate is green.**
  (a) T1 records an MCP capability matrix per provider operation with the discovered tool name (or the documented fallback) and records the GitHub MCP absence of Actions-run/Environment-variable tools plus the `gh` fallback; no task invokes a tool not recorded in the matrix.
  (b) Pinned `actionlint` over both workflows exits `0`; `src/frontend/vercel.json` parses as JSON; `render.yaml` parses as exactly one `cubeclicker-development` service (docker, free, no platform health check); the `ci.yml` dispatch parse and both Brevo guard fixtures pass; the T6a workflow diff is exactly one added and one removed non-comment line, the added line contains `--repo "$GITHUB_REPOSITORY"` in the pre-checkout `gh run list`, and no guard condition, step `if`, step order, permission, trigger or concurrency line changes.
  (c) The repository credential audit uses the credential-shaped pattern `(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=["']?[A-Za-z0-9+/_-]{12,}` plus the Fly key-shape clause `FlyV1 [A-Za-z0-9_-]{20,}` over the tracked tree, untracked files, branch diff and branch history, with documented exclusions for `docs/` prose and colocated `*.test.ts`/`*.spec.ts` synthetic fixtures, and it returns no matches on the current tree; the key-shape patterns (`rnd_`, `xkeysib-`, `xsmtpsib-`, `FlyV1`) remain strict on every path. The feature build-log guard passes over every `docs/features/production-provisioning/build-log-*.md`.
  (d) No application code, test, migration, Dockerfile, compose file, `package.json` or lockfile change; the only workflow change is the T6a one-line preflight fix (`git diff --exit-code <base> -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json` is empty, and the `deploy.yml` diff is exactly the T6a line). With no application code change, `npm run coverage` is not a feature target; T8 still runs `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` and `npm run build` to prove no regression, with the per-workspace thresholds unchanged at ≥ 80%.
  (e) T8 reproduces the live proof (AC-7) and the provider/development read-backs (AC-8(a)/(d)) from the recorded run URL and the T1-recorded provider tools; the reviewer can re-run the same reads.
  Evidence: raw command output in `build-log-T1.md`, `build-log-T7.md`, `build-log-T8.md`.

- **AC-11 — Partial failure is cleaned up safely, the pre-existing Neon branch is retained, and nothing falls back to development.**
  (a) The spec defines the ordered cleanup for a failed provisioning before the live deploy is green: delete/suspend the production Render service and delete the production Vercel project (resources this feature created), with owner approval; **never delete the pre-existing Neon `production` branch** (project default, predates this feature); keep the `production` GitHub Environment; never touch development.
  (b) After the live deploy is green, no production resource is deleted or repointed to development; failures are fixed forward; frontend/backend rollback uses Vercel/Render rollback, not a development pointer; the Neon branch is never dropped or re-created.
  (c) No rollback to development is performed in any scenario; the T6/T8 build logs record `No rollback to development` and `No deletion of the existing Neon production branch`.
  Evidence: this spec section; `build-log-T6.md`/`build-log-T8.md` statements.

- **AC-12 — The in-flight-feature dependency and ordering are honest.**
  (a) T1 verifies `main` contains the `brevo-api-email-transport` eleven-name catalog (`EMAIL_CATALOG` in `src/backend/src/deploy/render-env.ts`) and the `EMAIL_TRANSPORT`/`BREVO_API_KEY` bindings in `deploy.yml`; if absent, the feature stops as blocked before any production value is written.
  (b) The spec does not claim `registration-account-exists` behavior as on `main`; its Q-2 production port-guard question stays open; production `SMTP_PORT=2525`/`SMTP_SECURE=false` is safe without a guard-code change.
  (c) The feature branch is based on `main` after the `brevo-api-email-transport` merge; the live deploy runs from `main`; no feature-branch-only behavior is claimed.
  Evidence: `build-log-T1.md` dependency section; the T6 run SHA; the command inventory.

## Non-goals

- No new environment, no staging, no third GitHub Environment, no provider migration, no new platform.
- No application code, test, migration, schema, Dockerfile, compose-file, `package.json` or lockfile change; the only workflow change is the T6a one-line `--repo "$GITHUB_REPOSITORY"` preflight fix in `Verify CI succeeded for target commit`.
- No change to the development Environment values, resources, names, credentials, naming or pipeline behavior; no development deploy is triggered.
- No change to the Brevo/SMTP guard source or tests; no extension of the strict SMTP port guard to production (`registration-account-exists` Q-2 remains open).
- No production auto-deploy from `main`; no change to the trigger, concurrency, permissions, timeout, step order or action pins.
- No `render.yaml` second service, no `vercel.json` change, no `ci.yml` parse change; the only `deploy.yml` edit is the T6a one-line preflight fix (no guard bypass, no condition/step-order/permission change, no other non-comment line and no comment edits).
- No custom domain, DNS, certificate or Vercel domain purchase; platform-default hosts only.
- No production data migration or copy from development; no account/session/economy/customization row is copied.
- No secret read/copy from development; no `.env*` edit; no `git push`.
- No deletion of development or archived AWS/Fly resources; no deletion of the `production` GitHub Environment.
- No paid plan commitment without the owner; no Vercel password protection.
- No edit of `docs/features/README.md` or `status.md`.

## Boundaries

- ✅ Always: check MCP capability per task and record the discovered tool name before using it; use the documented CLI/owner fallback when the capability is absent; **reuse and verify the existing project-default Neon `production` branch `br-floral-dream-zarerhtw` and never create or delete a branch**; keep production resource names on `cubeclicker`/`cubeclicker-game` with no environment token; keep the GitHub Environment and Neon branch named `production` as environment identifiers; keep production manual and CI-preflighted; keep the guard → migration → sync → hook → health → Vercel → smoke order; keep the development path untouched; record names/IDs/timestamps and redacted evidence only; run the feature-appropriate gate; update the docs in the same feature; propose (not apply) the feature-index row.
- ⚠️ Ask first: choosing a paid Render/Vercel/Neon plan; adding a custom domain; removing required reviewers or the branch policy; reusing a development credential for production; changing the `workflow_dispatch` default; adding a production service to `render.yaml`; extending the SMTP port guard to production (code change); deleting a production resource after the live deploy; changing the naming fallback to anything other than `cubeclicker-game`.
- 🚫 Never: use `-production` or any environment token in a production resource display name; create a staging environment; create or delete a Neon branch (the existing `production` branch is retained); auto-deploy production from `main`; read, print, log or commit an owner-held or existing secret; read a development secret; put a secret in a command argument, `render.yaml`, an image, the bundle or a build log; weaken or bypass the Brevo/SMTP guard; edit `.env*`; `git push`; edit `docs/features/README.md` or `status.md`; point production at development; roll back to development; copy production data from development; delete the pre-existing Neon `production` branch.

## Security considerations

- **Credential classes.** Owner-held credentials (`VERCEL_TOKEN`, `RENDER_API_KEY`, `BREVO_API_KEY`, `SMTP_USER`, `SMTP_PASS`, and the deploy hook when not provider-readable) are entered by the owner via the GitHub UI or `gh secret set` stdin; the builder never reads them. Provider-generated values created by this feature (the two Neon URLs and, when the tool exposes it, the Render deploy hook) are handled in-process, written to GitHub/Render via stdin/API, and never recorded. Existing owner-held/development secret values are never read or copied.
- **No secret in artifacts.** Build logs record names, IDs, domains, timestamps and redacted status lines only. The feature build-log guard covers connection strings with credentials, `rnd_`, `xkeysib-`, `xsmtpsib-`, `FlyV1`, credential-shaped assignments, email addresses and 32+ hex tokens. GitHub masks registered secrets; no step enables shell tracing; no `gh secret get` is used. The repository audit uses the credential-shaped pattern `(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=["']?[A-Za-z0-9+/_-]{12,}` plus the `FlyV1 [A-Za-z0-9_-]{20,}` key shape, with documented `docs/` and test-fixture exclusions, and it must return no matches on the current tree; the Fly coverage is retained from `workflow-hygiene` while the credential-shaped alternation adds Brevo/SMTP.
- **Render API key scope.** A Render API key is workspace-scoped. A dedicated production key is preferred; it is stored only as the `production` `RENDER_API_KEY` secret, read only by the sync step, sent only as the `authorization` header, and never written to the service environment.
- **Vercel token.** A dedicated production token is preferred; it is stored only as the `production` `VERCEL_TOKEN` secret, used by `vercel pull/build/deploy`, and never in the frontend bundle or a log.
- **Brevo key.** `BREVO_API_KEY` is the Brevo REST API key (not the SMTP key), stored only as the `production` secret, synced to Render, read only from `process.env`, sent only in the `api-key` header over HTTPS; response bodies are not read. `SMTP_USER`/`SMTP_PASS` are inert under `brevo-api` but must be non-placeholder; they are owner-supplied.
- **Neon.** The pre-existing project-default `production` branch `br-floral-dream-zarerhtw` is reused, never created or deleted. Production URLs are provider-generated, carry `sslmode=require`, and are stored as GitHub secrets and Render service variables. The free plan does not protect the branch (accepted deviation); production has no application data beyond the schema at provisioning time. No connection string is logged.
- **Database isolation.** The `production` branch is the project default, not a development copy; the four application tables must be zero-row before the live deploy. No development account/session/economy/customization row is copied.
- **CORS/cookies.** Production uses the exact `FRONTEND_ORIGIN` for `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL`; no wildcard; `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none` for the cross-site default hosts; the WebSocket `Origin` guard is unchanged.
- **Metrics exposure.** The production Render service sets `METRICS_ENABLED=false`, so `GET /metrics` is a plain `404` on the public host; `/healthz` and `/ws` are unchanged on port 8080.
- **Protection.** The `production` Environment allows only `main` and requires reviewers; the single-owner repo risk is documented with a fallback. Development remains unprotected by design.
- **No user-controlled data, persistence or client-side secret changes.** This is infrastructure/configuration; the application schema, auth model and WebSocket protocol are unchanged.

## Real-time impact

Out of scope for behavior change. The production service runs the existing single Fastify process with the existing `/ws` endpoint, heartbeat, reconnect policy, presence, room model and server authority. A production deploy restarts the single instance, closes WebSocket connections and resets in-memory rooms; clients reconnect on the unchanged bounded policy (10 attempts, 500 ms → 5 s) and rejoin. Multi-client behavior is the same as development/local; no cross-client state is moved to Postgres or Vercel. No identity or "no accounts" question is reopened: the production Environment is operator configuration, not a user identity.

## Containerization impact

- No new image, Dockerfile stage, compose service, port, volume, build argument, health signal or WebSocket endpoint. The production Render service builds the existing `src/backend/Dockerfile` with `dockerContext .` and runs the same provider-neutral backend image as development; Vercel builds the existing static SPA from `src/frontend` (no functions, no serverless WebSocket). `compose.yaml`, `compose.smoke.yaml` and `podman compose up` are unchanged.
- The production service receives configuration from environment variables (the committed non-secret names plus the workflow-synced nine and the dashboard-owned seven); secrets are injected at run time and never baked into the image. `GET /healthz` remains the health signal (Render has no platform health check); `GET /ws` stays on port 8080 and Render terminates TLS/passes upgrades.
- `render.yaml` remains the development-service description; the production service is documented in `vercel-render-neon.md`. No container convention is reopened; this follows `docs/architecture/containerization.md`.

## Testing strategy

- **Unit: not applicable.** No TypeScript/application/library code changes, so no unit tests or test files are added. Adding workflow/provider YAML tests beyond the existing CI parses would be test theater; the feature-appropriate tier is the config/provider boundary.
- **Integration (infrastructure/config boundary — the feature-appropriate tier).** T1's MCP capability matrix and read-only preflight; T2's Neon branch-ID/migration-name/SQL read-backs; T3's Vercel project read-back (noting the MCP projection may omit `rootDirectory`, proven by the T6 build); T4's Render service/env read-back including exact origin/`<set>` values; T5a's names-only owner gate; T5's names-only GitHub Environment listing and protection read-back; T6a's one-line `deploy.yml` diff, actionlint and `gh run list --repo "$GITHUB_REPOSITORY"` dry-run; T7/T8's pinned `actionlint`, `src/frontend/vercel.json` JSON parse, `render.yaml` YAML parse (one development service, unchanged), the `ci.yml` dispatch parse and the two credential-free Brevo guard fixtures; T8's provider/development read-backs. No live provider call is made by CI.
- **E2E (deployed proof — live, guest-only).** The T6 `workflow_dispatch` production deploy runs `tests/e2e/deployed-smoke.mjs`, which asserts health, allowed/disallowed CORS, SPA `/`, SPA deep link, a real `/assets/*` 404 and the WebSocket hello/join/click plus the disallowed-Origin 403; the required line is `DEPLOYED SMOKE PASS (8/8 checks)`. The smoke creates no account and sends no email. T8 re-runs the smoke against the recorded production URLs.
- **Coverage expectation.** No application code changes, so this config/infrastructure feature adds no coverage target and no test files. The project bar (`npm run coverage`, thresholds ≥ 80% statements/branches/functions/lines per workspace) is unchanged; T8 runs `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` and `npm run build` to prove no regression. If any application code change is made, the normal unit + integration test deliverables and `npm run coverage` become mandatory for that task.
- **Assertion bar.** Provider/GitHub evidence uses exact names, IDs, counts and exact output lines (the guard success line, nine `SYNCED` lines, `schema_migrations: 7` plus the seven names, the exact `healthz OK after <n>s: {"status":"ok"}` line, `production frontend:`/`production api:` lines, `DEPLOYED SMOKE PASS (8/8 checks)`); no wildcard matchers, snapshot-only checks or assertion-free commands. Bounded alternatives are only the documented name fallback (`cubeclicker`/`cubeclicker-game`), each asserted exactly. The credential audit uses the credential-shaped pattern with documented exclusions and records a current-tree no-match.
- **Verification commands:** `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke`, the pinned `actionlint` container, the `vercel.json`/`render.yaml` parses, the `ci.yml` dispatch parse, the two Brevo guard fixtures, `gh variable list`/`gh secret list` names-only, `gh api .../environments/production` protection read-back, the provider MCP/CLI read-backs, the credential audits and the live deploy log greps.

## Supersessions

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| The production-unprovisioned/placeholder-only state documented by `deploy-brevo-env-placeholders`, `registration-account-exists` and `brevo-api-email-transport` (and every `README`/architecture statement of it) | Production has no Render service or Vercel project; the pre-existing Neon `production` branch has no application schema; the `production` Environment is placeholder-only and unprotected; a production dispatch fails at the guard | Live production resources (the reused/migrated Neon `production` branch, the Vercel `cubeclicker` project, the Render `cubeclicker` service) and a protected `production` Environment with the 23-name catalog; one live deploy proof | The manual `workflow_dispatch` trigger, CI preflight, guard → migration → sync → hook → health → Vercel → smoke order, eleven-name guard/nine-name sync, GitHub-as-source-of-truth, `CHANGEME` fail-closed behavior, development path and naming |
| The pinned production `SMTP_PORT=587` placeholder value | A placeholder safe only because production was unprovisioned | Production `SMTP_PORT=2525` with `SMTP_SECURE=false` (the Render-free-safe pair the earlier features already document as the production requirement) | The seven SMTP names, the strict guard (still development-scoped), the API transport on 443 |
| The "no protection rules / no deployment branch policy" production state | Nothing pauses a production dispatch | `main`-only deployment branch policy + required reviewers (owner default) | Development's unprotected path |
| The r2 "no CI step-body change / `deploy.yml` comment-corrections only" rule | The pre-checkout manual CI preflight (`gh run list`) fails on a fresh runner because it has no repository context | Exactly one authorized T6a line: `gh run list --repo "$GITHUB_REPOSITORY" ...` in `Verify CI succeeded for target commit`; no comment edits | The CI-success guard, dispatch-only condition, step order, permissions, triggers, concurrency and the automatic `workflow_run` path |

## Open questions

- **Q-1 (owner) — Render plan for production.** Default: `free`, mirroring development. Two free services share the workspace's 750 instance-hour/month budget; a busy production service can starve development. A paid plan removes spin-down but is a cost decision. The live provisioning records the chosen plan; the default is free.
- **Q-2 (owner) — Vercel plan.** Default: the current plan (Hobby), mirroring development. Hobby is non-commercial; a public game that generates revenue needs a commercial plan. Provisioning works on the current plan; the owner confirms/upgrades before a commercial launch.
- **Q-3 (owner) — Neon plan.** Default: `free`; the `production` branch is not protected (accepted deviation). Protected branches/PITR need a paid plan; the owner may upgrade later.
- **Q-4 (owner) — Protection reviewers.** Default: add the `main`-only deployment branch policy **and** required reviewers (the repository owner). Single-owner repo: if GitHub refuses self-approval by the triggering actor, the run waits; the fallback is to keep the branch policy and remove reviewers (or add a second reviewer), recorded as an owner decision. The live deploy is dispatched only after the owner confirms the gate can be approved.
- **Q-5 (owner) — Credential reuse.** Default: dedicated production `VERCEL_TOKEN`, `RENDER_API_KEY` and `BREVO_API_KEY`; the Brevo SMTP login/key may be reused for the inert SMTP names. Reusing the development tokens/keys is an explicit owner risk acceptance with a rotation plan; the builder never reads them.
- **Q-6 (owner) — Production `SMTP_PORT`.** Default: `2525` with `SMTP_SECURE=false` (Render-free-safe, matching the earlier feature's documented production requirement). The old `587` placeholder is superseded; choosing `587` would only matter if production ever switched to SMTP on a non-blocking host.
- **Q-7 (owner) — `render.yaml` second service.** Default: no; keep the Blueprint as the development-service description and document production separately. Adding a second service would make the Blueprint an adoption/creation surface for production and require the CI parse update.
- **Q-8 (owner) — `workflow_dispatch` default.** Default: keep `production` (no trigger change); the protection gate now pauses an accidental production dispatch. Switching the default to `development` would be friendlier but changes the existing production manual behavior.
- **Q-9 (owner) — Custom domains.** Out of scope; platform-default `cubeclicker.vercel.app` / `cubeclicker.onrender.com` hosts are the default. A custom domain (e.g. `app.<domain>`/`api.<domain>`) is a separate feature and would change the cookie `SameSite` decision.
- **Q-10 (owner) — Live-deploy approval availability.** Default: the owner is available to approve the `production` environment gate for the T6 proof. If not, the live proof waits; the provisioning stays complete and fail-closed until approval. The feature remains blocked at T5 until the Phase A gate T5a records `Phase A owner hand-off complete`; the orchestrator records this blocker in `status.md`.

## Assumptions

- `brevo-api-email-transport` is merged to `main` before this feature's build starts (the hard dependency in § In-flight feature dependencies); the base branch is then `main`. If it is not merged, T1 blocks and no production value is written.
- `registration-account-exists` is not required to be merged; the production deploy/smoke does not depend on its registration/resend behavior. Its Q-2 production port-guard question remains open.
- The Neon project's pre-existing project-default `production` branch `br-floral-dream-zarerhtw` is the target (parent `—`, primary/default, unprotected); there is no `main` branch. It has no `users` table per prior evidence, so T2 applies the seven migrations and verifies zero application rows. T2 never creates or deletes a branch; if the live read-back id differs from `br-floral-dream-zarerhtw`, it stops with `BLOCKED: production branch id drift` and does not substitute an id.
- The Render MCP can create the production service (proven for development) and update its environment variables; the Vercel MCP can create/update the production project, or an authenticated `vercel` CLI/REST session can; if neither capability exists, the documented owner hand-off is used. `VERCEL_TOKEN` cannot be minted via MCP (recorded), so it is owner-held.
- The Vercel MCP project projection may omit `rootDirectory`; T3 records the requested `rootDirectory: src/frontend` and T6's successful Vercel build is the effective-root proof (the same limitation recorded for the development project).
- The GitHub `production` Environment already exists; this feature updates it rather than creating a new environment. The `gh` CLI is authenticated as the owner with `repo` scope and environment write permission (probed with validation-only 422 requests).
- The owner approved the T6a one-line deploy preflight fix (`--repo "$GITHUB_REPOSITORY"` in the pre-checkout `gh run list`) and will merge the `fix/deploy-ci-preflight` PR to `main` before T6 re-dispatches; no other workflow edit is authorized.
- `cubeclicker.vercel.app` and `cubeclicker.onrender.com` are available; otherwise the single fallback `cubeclicker-game` is used. No other fallback is invented.
- The owner can approve the production environment gate; if self-approval is blocked, the Q-4 fallback applies.
- No production data exists; no data migration beyond schema migrations; no rollback to development.
- `main` is the integration branch; there is no `develop` branch.
- `docs/features/README.md` and `docs/features/production-provisioning/status.md` are orchestrator-owned and are not edited by this feature.

## Revision history

- r3 — 2026-11-27 — T6 blocker amendment (owner-approved): authorizes exactly one `deploy.yml` line, adding `--repo "$GITHUB_REPOSITORY"` to the pre-checkout `gh run list` in `Verify CI succeeded for target commit` (or an equivalent `GH_REPO` step env); adds T6a, makes T6 depend on it, pins the one-line diff/actionlint/dry-run, and updates AC-7/AC-8/AC-9/AC-10, testing, non-goals, the deploy-path text and the supersession note. No guard bypass, condition/step-order/permission change or other workflow edit; the 23-name catalog, protection, T5a, Neon branch reuse/no-delete and owner decisions are unchanged.
- r2a — 2026-11-27 — spec-review r2 mechanical fixes (F19–F27): restored `FLY_API_TOKEN`/`FlyV1` coverage in the canonical audit; T5a uses `gh variable set SMTP_FROM`; T8 executes the stale-doc scan; T2 exact zero/primary/default; T5 production read-backs; inventory/negatives/scan include `six pinned placeholders`/`has no protection rules yet`; full ledger row; T5a/T5 secret division; diff/history audit exclusions.
- r2 — 2026-11-27 — spec-review r1 fixes: **F1 (BLOCKER)** corrected the Neon pre-state to the existing project-default `production` branch `br-floral-dream-zarerhtw` (parent `—`, no `main`), rewrote scope/table/AC-2/T2/plan/risks/assumptions to reuse and verify it and never create a duplicate; **F2 (BLOCKER)** removed the Neon branch from cleanup and added “never delete the pre-existing branch” to cleanup, non-goals, AC-11 and boundaries; **F3 (MAJOR)** replaced the bare-assignment token audit with the credential-shaped pattern plus documented `docs/`/test exclusions and a current-tree no-match requirement; **F4 (MAJOR)** added the reviewer’s exact stale strings to the documentation inventory and T7/T8 negatives plus a final exhaustive allowlisted scan; **F5 (MAJOR)** added the `T5a [owner]` Phase A gate and made T5 depend on it; **F6 (MAJOR)** added branch-ID/schema-migration-name assertions (`schema_migrations: 7` + seven names); **F7 (MAJOR)** added T5/T8 provider/development read-backs and exact expected lines; **F8** corrected the pre-state to four constants + five placeholders; **F9** reworded the secret-read rule to owner-held/existing secrets; **F10** added the Vercel CLI/REST fallback; **F11** added the dispatch parse to T8; **F12** pinned the health-poll body; **F13** asserted exact Render origins and `<set>` Neon URLs; **F14** anchored T5/T8 extraction to single `production frontend:`/`production api:` lines; **F15–F18** applied where cheap (exact ledger row, prior-tool clarification, Vercel root-directory limitation, Render/Vercel deployment ID/status assertions).
- r1 — 2026-11-27 — initial spec: production resource provisioning, naming contract, 23-name/11-name catalog, secret sourcing, protection, live proof, cleanup/rollback, documentation inventory, dependency ordering with the two code_review features.
