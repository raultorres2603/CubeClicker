# Build log — T7 provisioning — Vercel + Neon development assets

Task: T7 (2026-11-16) — development provisioning slice (Neon + Vercel only)
Files changed: `docs/features/vercel-fly-neon-deployment/build-log-T7-provision.md` (this file, uncommitted)
What changed & why: Created the Neon `development` branch from `production`, attempted to protect `production`, created the Vercel project `cubeclicker-development` (Root Directory `src/frontend`, Vite, Node 24, no Git link) and set the non-secret `VITE_CLOUD_DEPLOY=true` env var. No source, workflow or container file touched; no deployment created.
Decisions: Free tiers only, so the Neon branch-protection write was not retried after the plan-limit rejection and no plan upgrade was attempted. `get_connection_string` was deliberately not called because it returns a role password (no secret may be printed).

## Scope actually exercised

- MCP sources used: `tools.Neon.*`, `tools.vercel.*` only.
- Not touched: Fly apps/secrets, GitHub environments/secrets/branches/pushes, Vercel deployments/aliases, DNS/domains, SMTP, source code, compose/container assets.
- Nothing was deleted. No destructive tool was called.

## Neon (project `patient-mountain-41401588`)

Project snapshot (`tools.Neon.describe_project`): name `CubeClicker`, region `aws-eu-west-2`, PostgreSQL 18, org `org-silent-poetry-68126144`.

### Branches

| Branch | ID | Parent | Primary | Default | Protected | State |
| --- | --- | --- | --- | --- | --- | --- |
| `production` | `br-floral-dream-zarerhtw` | — | true | true | **false** (protection rejected by plan) | ready |
| `development` | `br-ancient-smoke-za1pdv7w` | `br-floral-dream-zarerhtw` | false | false | false | ready |

1. Pre-check `tools.Neon.list_branches({ project_id, limit: 50 })` → only `production` (`br-floral-dream-zarerhtw`), `protected: false`, `primary: true`, `default: true`.
2. Create `tools.Neon.create_branch({ project_id, name: "development", parent_id: "br-floral-dream-zarerhtw" })` → `br-ancient-smoke-za1pdv7w`, `parent_id` production, `init_source: parent-data`; later reads show `current_state: ready`.
3. Protect `tools.Neon.update_branch({ project_id, branch_id: "br-floral-dream-zarerhtw", protected: true })` → **HTTP 422**:

   ```
   You have reached the maximum number of protected branches for your current plan.
   To protect this branch, either upgrade your plan or reduce the number of existing protected branches.
   ```

   The project has zero protected branches before and after the call, so the Free plan allowance is 0 protected branches. Not retried; no upgrade attempted (free tiers only).
4. Post-check `tools.Neon.list_branches` confirms both branches exist and `production` is still `primary: true, default: true, protected: false`.

### Endpoints and host names

| Branch | Endpoint | Type | State | Direct host | Pooled host |
| --- | --- | --- | --- | --- | --- |
| `development` | `ep-floral-water-zal36pez` | read_write | active | `ep-floral-water-zal36pez.c-2.eu-west-2.aws.neon.tech` | `ep-floral-water-zal36pez-pooler.c-2.eu-west-2.aws.neon.tech` |
| `production` | `ep-dawn-silence-zaodnv50` | read_write | idle | `ep-dawn-silence-zaodnv50.c-2.eu-west-2.aws.neon.tech` | `ep-dawn-silence-zaodnv50-pooler.c-2.eu-west-2.aws.neon.tech` |

Both endpoint records report `pooler_enabled: false` while also exposing a `-pooler` host; verify the effective pooled URL during the first Fly deployment before wiring `DATABASE_URL` (spec AC-17 requires the pooled URL for app traffic).

### Database and role names

- Database: `cubeclicker` on both branches (`tools.Neon.list_postgres_databases`), owner `cubeclicker_owner`.
- Role: `cubeclicker_owner` (`authentication_method: password`) on both branches (`tools.Neon.list_postgres_roles`); it is the only non-system role returned.
- Connection strings: **not read**. `tools.Neon.get_connection_string` returns the role password inline, so it was intentionally not called. Availability: the MCP grant is write-capable (branch create/update succeeded) and both branches have a ready read-write compute, so the tool is expected to return URLs; capture them in the secret store (GitHub Environment secrets / Fly secrets) without printing them.
- No password, connection string or token value appears in this log.

## Vercel (team `team_7cz2iixGr020Vqvjhj7Y1DNp`, Hobby)

| Field | Value |
| --- | --- |
| Project name | `cubeclicker-development` |
| Project ID | `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` |
| Framework | `vite` |
| Node version | `24.x` (created with the team default `26.x`, then updated) |
| Root Directory | `src/frontend` (set at create, re-applied on update) |
| Git link | none (`gitRepository: null`) |
| Default domain | `cubeclicker-development.vercel.app` (verified) |
| Deployment protection | `ssoProtection.enabled: true`, `deploymentType: "all_except_custom_domains"` |
| Env var | `VITE_CLOUD_DEPLOY=true` (`plain`, targets production/preview/development, id `jEpbVHmhRyPfTwEp`) |
| `VITE_API_URL` / `VITE_WS_URL` | intentionally unset (Fly backend does not exist yet) |

Calls and evidence:

1. `tools.vercel.list_projects({ teamId, search: "cubeclicker" })` → no project existed.
2. `tools.vercel.create_project({ teamId, requestBody: { name: "cubeclicker-development", framework: "vite", rootDirectory: "src/frontend" } })` → `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`, `framework: "vite"`, no `gitRepository` supplied, default `nodeVersion: "26.x"`.
3. `tools.vercel.update_project({ idOrName: "cubeclicker-development", requestBody: { nodeVersion: "24.x" } })` → accepted; `tools.vercel.get_project` returns `nodeVersion: "24.x"`.
4. `tools.vercel.update_project({ ... requestBody: { rootDirectory: "src/frontend", framework: "vite", nodeVersion: "24.x" } })` → accepted (idempotent re-apply). The MCP project projection omits `rootDirectory`, so the effective value can only be proven by the first build log (`src/frontend` root) — deferred to the deploy phase because no deployment was created in this slice.
5. `tools.vercel.create_project_env({ idOrName, upsert: "true", requestBody: { key: "VITE_CLOUD_DEPLOY", value: "true", type: "plain", target: ["production", "preview", "development"] } })` → created id `jEpbVHmhRyPfTwEp`; `tools.vercel.filter_project_envs` returns key `VITE_CLOUD_DEPLOY`, type `plain`, value `true`, all three targets.
6. `tools.vercel.list_project_domains` → `cubeclicker-development.vercel.app`, verified.
7. `tools.vercel.get_project` → `gitRepository: null`, `live: false`, `latestDeployment: null` (no deployment, as required).

## Verify results

| Verify item | Result |
| --- | --- |
| Neon `development` branch exists | **met** — `br-ancient-smoke-za1pdv7w`, parent `br-floral-dream-zarerhtw`, state ready |
| Neon `production` protected | **unmet** — HTTP 422, Free plan allows 0 protected branches |
| Vercel project exists, root `src/frontend`, Vite, Node 24, no Git link | **partially met** — project/ID/Vite/Node 24/no Git link confirmed by API reads; `rootDirectory` write accepted twice but the MCP projection does not echo it (build-time proof pending) |
| No secret values printed or committed | **met** — no `get_connection_string`, no role password, no token; only a `plain` non-secret `VITE_CLOUD_DEPLOY=true` was written; nothing committed |

### Raw secret-audit evidence

```
$ grep -nE "postgres(ql)?://[^\"' ]+:[^\"' ]+@|-pooler.*://" docs/features/vercel-fly-neon-deployment/build-log-T7-provision.md
no match
$ grep -nE "VERCEL_TOKEN=|FLY_API_TOKEN=|FlyV1 |npg_|neondb_owner.*@" docs/features/vercel-fly-neon-deployment/build-log-T7-provision.md
no match
$ git status --porcelain
 M docs/features/vercel-fly-neon-deployment/status.md
?? docs/features/vercel-fly-neon-deployment/build-log-T7-provision.md
```

The only working-tree changes are this log and the orchestrator's pre-existing `status.md` edit; no source/config file was modified.

## Remaining blockers

1. **B1 — Neon protected branch (AC-17 conflict).** `production` cannot be protected on the Free plan (exact 422 above). Needs a user decision: (a) accept an unprotected `production` branch and record the AC-17 deviation, or (b) upgrade the Neon plan (outside the free-tier constraint).
2. **B2 — Vercel deployment protection.** New projects inherit Vercel Authentication (`ssoProtection.enabled: true`, all except custom domains). Preview/production URLs will return an auth challenge, so `tests/e2e/deployed-smoke.mjs` would fail with 401 until protection is disabled for this dev project, a custom domain is used, or an automation bypass secret is wired into the smoke. Decide before the first deployment.
3. **B3 — Neon URLs as secrets.** Capture the pooler and direct URLs for `development` (and later `production`) into the secret store without printing them; also re-check `pooler_enabled`/pooled URL behavior on first connect.
4. **B4 — Fly backend.** No app/region/secrets created (out of this slice). Required before `VITE_API_URL`/`VITE_WS_URL` can be set on the Vercel project.
5. **B5 — GitHub.** `development`/`production` environments, secrets/variables, and the `develop` branch were not touched; the deploy workflow cannot run yet.
6. **B6 — First build proof.** A deployment (explicitly not created here) must show the `src/frontend` project root and the Vercel CLI cwd before AC-15 is considered proven.

## Deviations from spec

- `production` branch protection (spec AC-17, deployment docs) could not be applied on the Free plan; recorded as B1.
- No commit was made: the task's commit gate requires complete provisioning, and the branch-protection requirement is blocked.
