# Build log — T1 — Capability matrix, base-branch gate and read-only preflight

Task: T1 (2026-11-27)
Files changed: `docs/features/production-provisioning/build-log-T1.md` (only; no application code, workflow, `render.yaml`, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: Recorded the session's Neon/Vercel/Render/GitHub MCP capability matrix, proved the `brevo-api-email-transport` dependency is on `origin/main`, captured the names-only GitHub Environment pre-state, the read-only Neon/Vercel/Render listings, and ran the two validation-failure GitHub write-permission probes. No provider or GitHub write was performed.
Decisions: Read-only gate only — no branch create/delete, no project/service create, no secret value read, no connection string requested. The pre-existing Neon `production` branch is the recorded T2 target; T1 does not change it.

## Capability matrix

Session MCP servers discovered in the tool catalog (counts are the catalog's tool counts): Neon **143** tools, Vercel **281** tools, Render **50** tools, GitHub **47** tools, Brevo **300** tools, Context7 **2** tools. T1 scope is Neon, Vercel, Render and GitHub; Brevo and Context7 were not invoked. The full discovered name inventory for the four T1 providers is in § Appendix — full discovered tool names.

### Neon

| Capability | Discovered tool(s) (exact) | T1 use / note |
| --- | --- | --- |
| Project list/read and project ID | `tools.Neon.list_projects`, `tools.Neon.describe_project`, `tools.Neon.search`, `tools.Neon.fetch` | `describe_project` called read-only for `patient-mountain-41401588` |
| Project create/update | `tools.Neon.create_project`, `tools.Neon.update_project` | Discovered; not invoked (no project change in this feature) |
| Branch list/read | `tools.Neon.list_branches`, `tools.Neon.get_branch`, `tools.Neon.get_default_branch`, `tools.Neon.describe_branch` | `list_branches` called read-only; `production` and `development` recorded |
| Branch create | `tools.Neon.create_branch` | Discovered; **not invoked** — T2 reuses the pre-existing `production` branch and never creates one |
| Branch update/protection/delete | `tools.Neon.update_branch`, `tools.Neon.delete_branch` | Discovered; not invoked (no protection/rename/delete in T1; T2 must not create or delete) |
| Connection string | `tools.Neon.get_connection_string` | Discovered; **not invoked in T1** — it returns a role password; T2 handles any URL in-process without recording it |
| SQL (including read-only) | `tools.Neon.run_sql`, `tools.Neon.run_sql_transaction`, `tools.Neon.inspect_database`, `tools.Neon.explain_sql_statement` | Discovered; T2 uses read-only SQL |
| Compute/endpoint read | `tools.Neon.list_postgres_endpoints`, `tools.Neon.list_branch_computes` | Discovered; not needed for the T1 branch listing |
| Database/role read | `tools.Neon.list_postgres_databases`, `tools.Neon.list_postgres_roles` | Discovered; T2 may read names/ownership |
| Domain | — | Neon exposes no domain namespace; not applicable |
| Fallback if a Neon capability is absent | Neon console / `neonctl` CLI (not invoked in T1) | Provider-generated values are handled in-process per spec |

### Vercel

| Capability | Discovered tool(s) (exact) | T1 use / note |
| --- | --- | --- |
| Project list/read and project ID | `tools.vercel.list_projects`, `tools.vercel.get_project` | `list_projects` called read-only (one project found) |
| Project create/update | `tools.vercel.create_project`, `tools.vercel.update_project` | Discovered; T3 uses these for the production project (root directory, framework, Node.js, deployment protection) |
| Org/team ID | `tools.vercel.list_teams`, `tools.vercel.get_team` | `list_teams` called read-only; team ID recorded non-secret |
| Domain read | `tools.vercel.list_project_domains`, `tools.vercel.get_project_domain`, `tools.vercel.list_domains`, `tools.vercel.get_domain` | Discovered; T3 reads the project domain |
| Domain add/verify | `tools.vercel.add_project_domain`, `tools.vercel.verify_project_domain` | Discovered; not invoked (no custom domain in this feature) |
| Deployment read/status | `tools.vercel.list_deployments`, `tools.vercel.get_deployment`, `tools.vercel.list_deployment_aliases` | Discovered; T3 creates no deployment; T6 records deployment status |
| Deployment create | `tools.vercel.create_deployment` | Discovered; **not invoked** — the live deploy is the T6 workflow |
| Project env read/write | `tools.vercel.filter_project_envs`, `tools.vercel.get_project_env`, `tools.vercel.create_project_env`, `tools.vercel.edit_project_env` | Discovered; the deploy workflow supplies `VITE_*` at build; no T1 use |
| Deployment protection | `tools.vercel.update_project` (`ssoProtection`) / `tools.vercel.create_project` (`ssoProtection`) | Discovered; T3 disables Vercel Authentication for production |
| Fallback if a Vercel capability is absent | `vercel` CLI/REST (authenticated session/token) or owner hand-off (dashboard); do not guess a tool | Documented fallback |

### Render

| Capability | Discovered tool(s) (exact) | T1 use / note |
| --- | --- | --- |
| Workspace read | `tools.render.list_workspaces`, `tools.render.get_selected_workspace`, `tools.render.select_workspace` | `list_workspaces` called read-only; explicit `workspaceId` is passed on each call (the selected-workspace tool is deprecated) |
| Service list/read | `tools.render.list_services`, `tools.render.get_service` | `list_services` called read-only (one service found); `get_service` is the T4 read-back |
| Service create | `tools.render.create_web_service` | Discovered; T4 uses it. The tool supports a subset (`runtime`, `dockerfilePath`, `dockerContext`, `plan`, `region`, `branch`, `autoDeploy`, `envVars`); it exposes no `healthCheckPath` parameter — a new service has no platform health check by default, and T4 verifies the empty value with `get_service` |
| Environment variables | `tools.render.update_environment_variables` | Discovered; T4 writes the service env names (merge by default) |
| Deploy status/history | `tools.render.list_deploys`, `tools.render.get_deploy`, `tools.render.list_events` | Discovered; T6 records deploy status |
| Deploy trigger | `tools.render.trigger_deploy` | Discovered; the deploy workflow uses the service deploy hook instead |
| Deploy hook | — | **No MCP deploy-hook create/read tool discovered**; documented fallback: Render dashboard/owner hand-off, or `render` CLI/REST. `RENDER_DEPLOY_HOOK_URL` is owner-held when not readable |
| Fallback if a Render capability is absent | `render` CLI/REST or owner hand-off (dashboard); never guess a tool | Documented fallback |

### GitHub

Discovered: **47** GitHub MCP tools covering repository, branch, commit, file, issue, pull-request, release, team and code-search operations (e.g. `tools.github.list_branches`, `tools.github.create_branch`, `tools.github.get_file_contents`, `tools.github.list_commits`, `tools.github.get_commit`, `tools.github.search_code`, `tools.github.create_or_update_file`, `tools.github.list_pull_requests`, `tools.github.pull_request_read`).

- **GitHub MCP has no Actions-run or Environment-variable tools.** No workflow-run list/view/dispatch, no GitHub Environment create/list, no environment protection or deployment-branch-policy tool, and no environment variable/secret read/write tool was discovered in the 47-tool catalog.
- **Fallback: `gh` CLI fallback** (authenticated `gh` 2.106.0; token scopes `gist`, `read:org`, `repo`, `workflow`). Commands used or planned: `gh api repos/raultorres2603/CubeClicker/environments`, `gh variable list/set`, `gh secret list/set`, `gh api .../environments/production` (protection), `gh api .../deployment-branch-policies`, `gh run list/view`, `gh workflow run`. This is the documented `gh CLI fallback` for GitHub Environments and Actions.
- Validation-failure write probes (below) used the authenticated `gh api` path; they returned HTTP 422 and created nothing.

### Matrix guard

No provider write tool was called in T1. The only provider tools invoked are the read-only listings recorded above: `tools.Neon.describe_project`, `tools.Neon.list_branches`, `tools.vercel.list_teams`, `tools.vercel.list_projects`, `tools.render.list_workspaces`, `tools.render.list_services`. Every later task must stay inside this matrix or record a new discovered capability before use.

## Dependency and base-branch check

- Branch: `feat/production-provisioning` (created from `HEAD`).
- `git rev-parse HEAD` = `commit 00e2359`
- `git rev-parse origin/main` = `commit 00e2359`
- `git merge-base origin/main HEAD` = `commit 00e2359` (HEAD is exactly `origin/main`; no rebase/merge/push performed)
- `git show origin/main:src/backend/src/deploy/render-env.ts | grep -q 'EMAIL_CATALOG'` → exit 0. Matching lines (no values): 34 `export const EMAIL_CATALOG = [`, 39 and 40 (the `SYNC_CATALOG` composition).
- `git show origin/main:.github/workflows/deploy.yml | grep -q 'EMAIL_TRANSPORT'` → exit 0. Matching lines (no values): 85 and 109 (`vars.EMAIL_TRANSPORT` in the guard and sync steps).
- `git show origin/main:.github/workflows/deploy.yml | grep -q 'BREVO_API_KEY'` → exit 0. Matching lines (no values): 86 and 110 (`secrets.BREVO_API_KEY` in the guard and sync steps).
- `main` commit context: `00e2359 docs`, directly after `363dc53 test: record T7 full-gate verification evidence`, `9d9e217 docs: document Brevo HTTPS email transport and deployment runbook`, `e15039d feat: add Brevo API deploy catalog, transport guard, CLI sync and Render bindings` — the `brevo-api-email-transport` catalog and bindings are on `origin/main`.

Conclusion: the hard dependency is present. `BLOCKED: brevo-api-email-transport is not on main` does **not** apply. The base-branch gate passes; no production value was written.

## Read-only pre-state

All listings are names/IDs/status only; no secret value, role password or connection string was read or recorded. No write was made to GitHub, Neon, Vercel or Render in this section.

### GitHub Environments

`gh api repos/raultorres2603/CubeClicker/environments --jq '.environments[].name' | sort`:

```
development
production
```

#### `production` (pre-state, 9 names: 6 variables + 3 secrets)

`gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort`:

```
RENDER_SERVICE_ID
SMTP_CONNECTION_TIMEOUT_MS
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_SECURE
```

`gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort`:

```
RENDER_API_KEY
SMTP_PASS
SMTP_USER
```

- Counts: **6 variables / 3 secrets = 9 names**. This matches the spec's pre-`brevo-api` partial state (the four pinned SMTP constants plus the five `CHANGEME` placeholders; names only, no value read).
- Environment metadata: created `2026-10-31T17:56:07Z`, updated `2026-10-31T17:56:07Z`.
- Protection JSON (`gh api repos/raultorres2603/CubeClicker/environments/production --jq '{name: .name, protection_rules: (.protection_rules // []), deployment_branch_policy: (.deployment_branch_policy // null)}'`):

```json
{"deployment_branch_policy":null,"name":"production","protection_rules":[]}
```

- Deployment branch-policy listing (`.../environments/production/deployment-branch-policies`) → HTTP 404 `Not Found`, i.e. no custom branch policy exists. The production Environment has no protection rules yet and no deployment branch policy.

#### `development` (pre-state, 23 names: 15 variables + 8 secrets)

`gh variable list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort`:

```
EMAIL_TRANSPORT
FRONTEND_ORIGIN
MAX_USERS_PER_SERVER
RENDER_SERVICE_ID
SESSION_COOKIE_SAMESITE
SESSION_COOKIE_SECURE
SMTP_CONNECTION_TIMEOUT_MS
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_SECURE
VERCEL_ORG_ID
VERCEL_PROJECT_ID
VITE_API_URL
VITE_WS_URL
```

`gh secret list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort`:

```
BREVO_API_KEY
DATABASE_URL
DIRECT_DATABASE_URL
RENDER_API_KEY
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
SMTP_USER
VERCEL_TOKEN
```

- Counts: **15 variables / 8 secrets = 23 names**. This is the reference catalog; it is recorded only as the pre-state so T5/T8 can prove development is unchanged.
- Protection JSON: `{"deployment_branch_policy":null,"name":"development","protection_rules":[]}` (development remains unprotected, as designed).
- No builder command targeted `development`: the two `gh ... list --env development` commands are read-only names-only listings.

### Neon (project `patient-mountain-41401588`)

Read with `tools.Neon.describe_project` and `tools.Neon.list_branches` (read-only):

| Branch | Branch ID | Parent | Primary | Default | Protected | State | Creation source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `production` | `br-floral-dream-zarerhtw` | none (project default) | true | true | false | ready | console |
| `development` | `br-ancient-smoke-za1pdv7w` | `br-floral-dream-zarerhtw` | false | false | false | ready | console |

- Project: `patient-mountain-41401588` (`CubeClicker`), region `aws-eu-west-2`, PostgreSQL 18, org `org-silent-poetry-68126144`.
- There is no `main` Neon branch. The production branch is the project default and predates this feature; it is the T2 reuse target. T1 created, updated, protected and deleted nothing.

### Vercel (team `team_7cz2iixGr020Vqvjhj7Y1DNp`)

Read with `tools.vercel.list_teams` and `tools.vercel.list_projects` (read-only):

```
project: cubeclicker-development  id: prj_9GfusgivGpVJDXeJPi2TnMUCb2RV
```

- Exactly one project exists; there is no `cubeclicker` and no `cubeclicker-game` production project yet.
- No Vercel deployment was created.

### Render (workspace `tea-cspt720gph6c739lkvs0`)

Read with `tools.render.list_workspaces` and `tools.render.list_services` (read-only; the workspace contact field is deliberately not recorded):

```
service: cubeclicker-development  id: srv-dbtcvv9srm7s73au5bag
type: web_service  runtime: docker  branch: main  autoDeployTrigger: off
plan: free  region: frankfurt  healthCheckPath: ""  numInstances: 1
url: https://cubeclicker-development.onrender.com
```

- Exactly one service exists; there is no `cubeclicker` and no `cubeclicker-game` production service yet.
- No Render deploy was triggered and no environment variable was written.

### Read-only conclusion

Pre-state matches the spec: the `production` GitHub Environment holds 9 partial names with no protection, the Neon project already has the project-default `production` branch `br-floral-dream-zarerhtw`, and Vercel/Render hold only the development resources. T2 can reuse the Neon branch; T3/T4 create the missing production resources under the naming contract.

## Write-permission probes

Both probes are validation-failure requests sent to the existing `production` Environment with an empty `{}` body. They must fail with HTTP 422 and create nothing; only the status/error type is recorded (no values exist in these requests).

### Probe 1 — environment secret

```bash
printf '{}' | gh api --method PUT repos/raultorres2603/CubeClicker/environments/production/secrets/__write_permission_probe --input -
```

- Exit: `1`
- HTTP status: **422**
- Error type/message: `Invalid request. "encrypted_value", "key_id" weren't supplied.`
- Result: no secret named `__write_permission_probe` was created.

### Probe 2 — environment variable

```bash
printf '{}' | gh api --method POST repos/raultorres2603/CubeClicker/environments/production/variables --input -
```

- Exit: `1`
- HTTP status: **422**
- Error type/message: `Invalid input: object is missing required keys: name, value.`
- Result: no variable named `__write_permission_probe` was created.

### Post-probe state

- `gh secret list --env production ...` → still 3 names (`RENDER_API_KEY`, `SMTP_PASS`, `SMTP_USER`); `__write_permission_probe` absent.
- `gh variable list --env production ...` → still 6 names (`RENDER_SERVICE_ID`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`); `__write_permission_probe` absent.
- Counts before and after: **6 variables / 3 secrets** (unchanged). The authenticated `gh` token has the `repo` scope and passed the validation-failure permission probes; the actual T5 writes remain gated by T5a and the task order.

## Verify

The T1 verify block from `tasks.md` is run after this file is written; raw output is recorded below.

Command: the exact T1 block from `tasks.md` (lines 16–38) extracted to `/tmp/opencode/t1-verify.sh` and run as `bash /tmp/opencode/t1-verify.sh`; `set -euo pipefail` is inside the block. Raw output of the last full run (the earlier run before the verify section was written produced the same lines with `in 39s` instead of `in 3s` and also exited `0`):

```
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting <address>
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 399 packages, and audited 402 packages in 3s

102 packages are looking for funding
  run `npm fund` for details

14 vulnerabilities (12 moderate, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
github.com
  ✓ Logged in to github.com account raultorres2603 (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
development
production
RENDER_SERVICE_ID
SMTP_CONNECTION_TIMEOUT_MS
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_SECURE
RENDER_API_KEY
SMTP_PASS
SMTP_USER
{"deployment_branch_policy":null,"name":"production","protection_rules":[]}
{"message":"Invalid request.\n\n\"encrypted_value\", \"key_id\" weren't supplied.","documentation_url":"https://docs.github.com/rest/reference/actions#create-or-update-an-environment-secret","status":"422"}{"message":"Invalid request.\n\nInvalid input: object is missing required keys: name, value.","documentation_url":"https://docs.github.com/rest/actions/variables#create-an-environment-variable","status":"422"}VERIFY_EXIT=0
```

- The verify block exits `0`; the two probe responses are the expected HTTP `422` validation failures (their own exit status is `1`, absorbed by `|| true` in the block) and the secret/variable names were not created (post-probe listing in § Write-permission probes).
- `npm ci` completed (`added 399 packages`); the warnings are dependency/install-script notices, not T1 failures.
- `gh auth status` shows the authenticated account and the `repo`/`workflow` scopes; the token value is masked by `gh` and no secret is recorded.
- The credential guard (T1 line 37) and the connection-string guard (T1 line 38) both pass over this file (they are negated `grep`s inside the successful block).
- The `.env*` status and base-diff checks pass (inside the same successful block).

Post-T6 evidence-format pass: full SHAs shortened to 7–12 characters; values unchanged

## Acceptance audit

- **AC-10(a) — MCP capability matrix recorded with discovered tool names or documented fallbacks.** Met: § Capability matrix records the exact Neon/Vercel/Render tool names per provider operation, the GitHub 47-tool catalog and the exact gap phrase “GitHub MCP has no Actions-run or Environment-variable tools”, plus the `gh` CLI fallback and the `vercel`/`render` CLI/REST or owner-hand-off fallbacks. No tool outside the matrix was invoked; T1 used only six read-only listing tools.
- **AC-12(a) — dependency check.** Met: `origin/main` contains `EMAIL_CATALOG` in `src/backend/src/deploy/render-env.ts` and `EMAIL_TRANSPORT`/`BREVO_API_KEY` in `.github/workflows/deploy.yml`; the gate passes before any production value is written. The exact failure string `BLOCKED: brevo-api-email-transport is not on main` does not apply.
- **T1 acceptance scope.** Met: capability matrix, base-branch gate and read-only pre-state recorded; the two probes failed as required (HTTP 422, nothing created); no secret value or connection string is recorded; the only changed file is this build log.
- **Testing tiers.** No behavior/application code changed (read-only infrastructure/config gate), so no unit or integration test is added; the spec's testing strategy defines this task's feature-appropriate tier as provider/GitHub read-backs and the build-log guard. The full repository suite is not a T1 requirement; T8 owns the no-regression gate.

## Deviations from spec

None. No production value was written; no branch/project/service was created, updated or deleted; no secret was read; no `.env*` file was touched; no push/merge/rebase was performed.

## Appendix — full discovered tool names

The complete exact tool-name inventories returned by the session catalog for the four T1 providers (tool counts: Neon 143, Vercel 281, Render 50, GitHub 47).

### Neon (143)

```
tools.Neon.add_auth_oauth_provider, tools.Neon.add_auth_trusted_domain, tools.Neon.call_api, tools.Neon.compare_database_schema, tools.Neon.complete_database_migration, tools.Neon.complete_query_tuning, tools.Neon.count_projects, tools.Neon.create_auth_oauth_client, tools.Neon.create_auth_user, tools.Neon.create_branch, tools.Neon.create_credential, tools.Neon.create_postgres_database, tools.Neon.create_postgres_endpoint, tools.Neon.create_postgres_role, tools.Neon.create_project, tools.Neon.create_snapshot, tools.Neon.create_storage_bucket, tools.Neon.create_trigger, tools.Neon.delete_auth_oauth_client, tools.Neon.delete_auth_oauth_provider, tools.Neon.delete_auth_trusted_domain, tools.Neon.delete_auth_user, tools.Neon.delete_branch, tools.Neon.delete_data_api, tools.Neon.delete_function, tools.Neon.delete_functions_custom_domain, tools.Neon.delete_postgres_database, tools.Neon.delete_postgres_endpoint, tools.Neon.delete_postgres_role, tools.Neon.delete_project, tools.Neon.delete_snapshot, tools.Neon.delete_storage_bucket, tools.Neon.delete_storage_object, tools.Neon.delete_storage_objects_by_prefix, tools.Neon.delete_trigger, tools.Neon.deploy_function, tools.Neon.describe_branch, tools.Neon.describe_project, tools.Neon.describe_table_schema, tools.Neon.disable_auth, tools.Neon.disable_realtime, tools.Neon.enable_realtime, tools.Neon.explain_sql_statement, tools.Neon.fetch, tools.Neon.finalize_branch_restore, tools.Neon.get_ai_gateway, tools.Neon.get_auth, tools.Neon.get_auth_oauth_client, tools.Neon.get_auth_oauth_server, tools.Neon.get_branch, tools.Neon.get_branch_consumption, tools.Neon.get_connection_string, tools.Neon.get_data_api, tools.Neon.get_database_tables, tools.Neon.get_default_branch, tools.Neon.get_doc, tools.Neon.get_function, tools.Neon.get_neon_auth_config, tools.Neon.get_operation, tools.Neon.get_postgres_database, tools.Neon.get_postgres_endpoint, tools.Neon.get_postgres_role, tools.Neon.get_project_consumption, tools.Neon.get_realtime, tools.Neon.get_realtime_secret, tools.Neon.get_snapshot_schedule, tools.Neon.get_storage, tools.Neon.get_trigger, tools.Neon.inspect_database, tools.Neon.list_auth_oauth_clients, tools.Neon.list_auth_oauth_providers, tools.Neon.list_auth_trusted_domains, tools.Neon.list_branch_computes, tools.Neon.list_branches, tools.Neon.list_credentials, tools.Neon.list_functions, tools.Neon.list_functions_custom_domains, tools.Neon.list_incidents, tools.Neon.list_log_field_values, tools.Neon.list_log_fields, tools.Neon.list_operations, tools.Neon.list_organizations, tools.Neon.list_postgres_databases, tools.Neon.list_postgres_endpoints, tools.Neon.list_postgres_roles, tools.Neon.list_project_members, tools.Neon.list_project_permissions, tools.Neon.list_projects, tools.Neon.list_regions, tools.Neon.list_slow_queries, tools.Neon.list_snapshots, tools.Neon.list_storage_buckets, tools.Neon.list_storage_objects, tools.Neon.list_triggers, tools.Neon.prepare_database_migration, tools.Neon.prepare_query_tuning, tools.Neon.presign_storage_object, tools.Neon.provision_neon_auth, tools.Neon.provision_neon_data_api, tools.Neon.query_logs, tools.Neon.query_loki_logs, tools.Neon.recover_project, tools.Neon.register_functions_custom_domain, tools.Neon.reset_from_parent, tools.Neon.reset_postgres_role_password, tools.Neon.restart_postgres_endpoint, tools.Neon.restore_snapshot, tools.Neon.revoke_credential, tools.Neon.rotate_auth_oauth_client_secret, tools.Neon.rotate_credential, tools.Neon.rotate_realtime_secret, tools.Neon.run_sql, tools.Neon.run_sql_transaction, tools.Neon.search, tools.Neon.search_api, tools.Neon.search_docs, tools.Neon.send_auth_test_email, tools.Neon.send_feedback, tools.Neon.set_default_branch, tools.Neon.set_snapshot_schedule, tools.Neon.start_postgres_endpoint, tools.Neon.suspend_postgres_endpoint, tools.Neon.update_auth_allow_localhost, tools.Neon.update_auth_config, tools.Neon.update_auth_email_and_password, tools.Neon.update_auth_email_provider, tools.Neon.update_auth_logs_export, tools.Neon.update_auth_oauth_client, tools.Neon.update_auth_oauth_provider, tools.Neon.update_auth_oauth_server, tools.Neon.update_auth_plugins_magic_link, tools.Neon.update_auth_plugins_organization, tools.Neon.update_auth_plugins_phone_number, tools.Neon.update_auth_user_role, tools.Neon.update_auth_webhooks, tools.Neon.update_branch, tools.Neon.update_data_api, tools.Neon.update_function, tools.Neon.update_postgres_database, tools.Neon.update_postgres_endpoint, tools.Neon.update_project, tools.Neon.update_snapshot, tools.Neon.update_trigger
```

### Vercel (281)

```
tools.vercel.accept_project_transfer_request, tools.vercel.activate_kms_signing_key, tools.vercel.add_project_domain, tools.vercel.add_route, tools.vercel.add_toolbar_reaction, tools.vercel.aggregate_events, tools.vercel.aggregate_pageviews, tools.vercel.approve_rolling_release_stage, tools.vercel.artifact_query, tools.vercel.assign_alias, tools.vercel.authorize_team_access, tools.vercel.authorize_team_sso, tools.vercel.buy_domain, tools.vercel.cancel_deployment, tools.vercel.change_toolbar_thread_resolve_status, tools.vercel.close_sandbox_desktop, tools.vercel.complete_rolling_release, tools.vercel.count_events, tools.vercel.count_pageviews, tools.vercel.create_ai_gateway_api_key, tools.vercel.create_ai_gateway_rule, tools.vercel.create_ai_gateway_virtual_model, tools.vercel.create_deployment, tools.vercel.create_drain, tools.vercel.create_edge_config, tools.vercel.create_edge_config_token, tools.vercel.create_flag, tools.vercel.create_flags_project_connection, tools.vercel.create_git_project, tools.vercel.create_kms_issuer, tools.vercel.create_kms_issuer_policy, tools.vercel.create_kms_signing_key, tools.vercel.create_observability_query, tools.vercel.create_or_transfer_domain, tools.vercel.create_project, tools.vercel.create_project_env, tools.vercel.create_record, tools.vercel.create_sandboxes_sessions_by_session_id_snapshot_v2, tools.vercel.create_sandboxes_sessions_by_session_id_snapshot_v3, tools.vercel.create_sandboxes_v2, tools.vercel.create_sandboxes_v3, tools.vercel.create_sandboxes_v4, tools.vercel.create_sdk_key, tools.vercel.create_session_directory, tools.vercel.create_storage_stores_blob, tools.vercel.create_trace_session, tools.vercel.delete_drive, tools.vercel.delete_sandbox, tools.vercel.delete_session_snapshot, tools.vercel.edit_project_env, tools.vercel.edit_route, tools.vercel.edit_toolbar_message, tools.vercel.extend_session_timeout, tools.vercel.filter_project_envs, tools.vercel.fork_drive, tools.vercel.generate_route, tools.vercel.get_access_to_vercel_url, tools.vercel.get_active_attack_status, tools.vercel.get_agent_run, tools.vercel.get_agent_run_trace, tools.vercel.get_ai_gateway_leaderboard, tools.vercel.get_ai_gateway_model, tools.vercel.get_ai_gateway_usage, tools.vercel.get_ai_gateway_virtual_model, tools.vercel.get_alias, tools.vercel.get_auth_user, tools.vercel.get_board_identity, tools.vercel.get_board_thread, tools.vercel.get_bulk_availability, tools.vercel.get_bulk_price, tools.vercel.get_bypass_ip, tools.vercel.get_cert_by_id, tools.vercel.get_configuration, tools.vercel.get_connector, tools.vercel.get_connector_project_connection, tools.vercel.get_contact_info_schema, tools.vercel.get_custom_environment, tools.vercel.get_deployment, tools.vercel.get_deployment_feature_flags, tools.vercel.get_deployment_file_contents, tools.vercel.get_domain, tools.vercel.get_domain_availability, tools.vercel.get_domain_config, tools.vercel.get_domain_contact_verification, tools.vercel.get_domain_order, tools.vercel.get_domain_price, tools.vercel.get_domain_project_domains, tools.vercel.get_domain_verification_record, tools.vercel.get_domains_records_by_record_id, tools.vercel.get_drain, tools.vercel.get_drive, tools.vercel.get_edge_config, tools.vercel.get_edge_config_backup, tools.vercel.get_edge_config_backups, tools.vercel.get_edge_config_item, tools.vercel.get_edge_config_items, tools.vercel.get_edge_config_token, tools.vercel.get_edge_config_tokens, tools.vercel.get_edge_configs, tools.vercel.get_firewall_config, tools.vercel.get_flag, tools.vercel.get_flag_segment, tools.vercel.get_flag_settings, tools.vercel.get_flags_project_disconnection_link, tools.vercel.get_git_deployment_context, tools.vercel.get_kms_issuer, tools.vercel.get_microfrontends_config, tools.vercel.get_microfrontends_config_for_project, tools.vercel.get_named_sandbox, tools.vercel.get_observability_configuration_projects, tools.vercel.get_observability_schema, tools.vercel.get_or_create_drive, tools.vercel.get_order, tools.vercel.get_project, tools.vercel.get_project_deletion_link, tools.vercel.get_project_domain, tools.vercel.get_project_env, tools.vercel.get_project_trace, tools.vercel.get_purchase_quote, tools.vercel.get_records, tools.vercel.get_remote_cache_status, tools.vercel.get_rolling_release, tools.vercel.get_rolling_release_billing_status, tools.vercel.get_rolling_release_config, tools.vercel.get_runtime_errors, tools.vercel.get_runtime_logs, tools.vercel.get_security_vulnerability, tools.vercel.get_session, tools.vercel.get_session_command, tools.vercel.get_session_command_logs, tools.vercel.get_session_snapshot, tools.vercel.get_shared_env_var, tools.vercel.get_storage_stores_by_id, tools.vercel.get_team, tools.vercel.get_tld, tools.vercel.get_tld_price, tools.vercel.get_toolbar_thread, tools.vercel.get_vercel_ci_invocation, tools.vercel.get_vercel_ci_invocation_logs, tools.vercel.get_vercel_ci_invocation_tree, tools.vercel.get_vercel_ci_job_definition, tools.vercel.get_vercel_ci_job_run, tools.vercel.get_vercel_ci_job_run_logs, tools.vercel.get_vercel_ci_task_logs, tools.vercel.get_vercel_ci_task_run_logs, tools.vercel.get_webhooks, tools.vercel.git_namespaces, tools.vercel.invalidate_by_src_images, tools.vercel.invalidate_by_tags, tools.vercel.issue_cert, tools.vercel.kill_session_command, tools.vercel.label_board_message, tools.vercel.list_access_group_members, tools.vercel.list_access_group_projects, tools.vercel.list_access_groups, tools.vercel.list_agent_run_projects, tools.vercel.list_agent_runs, tools.vercel.list_ai_gateway_budgets, tools.vercel.list_ai_gateway_models, tools.vercel.list_ai_gateway_rules, tools.vercel.list_ai_gateway_virtual_models, tools.vercel.list_aliases, tools.vercel.list_billing_charges, tools.vercel.list_board_channels, tools.vercel.list_board_threads, tools.vercel.list_bulk_redirect_versions, tools.vercel.list_bulk_redirects, tools.vercel.list_certs, tools.vercel.list_connector_project_connections, tools.vercel.list_connectors, tools.vercel.list_deployment_aliases, tools.vercel.list_deployment_events, tools.vercel.list_deployment_files, tools.vercel.list_deployments, tools.vercel.list_domains, tools.vercel.list_drains, tools.vercel.list_drives, tools.vercel.list_event_types, tools.vercel.list_feature_flag_sdk_keys, tools.vercel.list_flag_segments, tools.vercel.list_flag_versions, tools.vercel.list_flags, tools.vercel.list_flags_project_connections, tools.vercel.list_flags_v2, tools.vercel.list_integration_billing_plans, tools.vercel.list_integration_configuration_products, tools.vercel.list_integration_configurations, tools.vercel.list_kms_issuers, tools.vercel.list_named_sandboxes, tools.vercel.list_project_connector_connections, tools.vercel.list_project_custom_environments, tools.vercel.list_project_domains, tools.vercel.list_project_route_versions, tools.vercel.list_project_routes, tools.vercel.list_projects, tools.vercel.list_promote_aliases, tools.vercel.list_security_vulnerabilities, tools.vercel.list_session_commands, tools.vercel.list_session_snapshots, tools.vercel.list_sessions, tools.vercel.list_supported_tlds, tools.vercel.list_team_flag_settings, tools.vercel.list_team_flags, tools.vercel.list_team_flags_v2, tools.vercel.list_team_members, tools.vercel.list_teams, tools.vercel.list_toolbar_threads, tools.vercel.list_user_events, tools.vercel.list_vercel_ci_invocation_attempts, tools.vercel.list_vercel_ci_invocations, tools.vercel.list_vercel_ci_job_definitions, tools.vercel.list_vercel_ci_job_runs, tools.vercel.list_vercel_ci_task_definitions, tools.vercel.list_vercel_ci_task_runs, tools.vercel.open_deployments, tools.vercel.open_sandbox_desktop, tools.vercel.patch_edge_config_items, tools.vercel.patch_url_protection_bypass, tools.vercel.pause_project, tools.vercel.put_firewall_config, tools.vercel.react_to_board_message, tools.vercel.read_access_group, tools.vercel.read_access_group_project, tools.vercel.read_session_file, tools.vercel.record_events, tools.vercel.replace_domain_dns_records, tools.vercel.reply_to_board_thread, tools.vercel.reply_to_toolbar_thread, tools.vercel.request_promote, tools.vercel.request_rollback, tools.vercel.rerequest_check, tools.vercel.restore_edge_config_backup, tools.vercel.restore_redirects, tools.vercel.retry_vercel_ci_invocation, tools.vercel.revoke_kms_signing_key, tools.vercel.run_session_command, tools.vercel.sandbox_desktop_click, tools.vercel.sandbox_desktop_key, tools.vercel.sandbox_desktop_run, tools.vercel.sandbox_desktop_screenshot, tools.vercel.sandbox_desktop_type, tools.vercel.search_domains, tools.vercel.search_repo, tools.vercel.search_vercel_documentation, tools.vercel.stage_redirects, tools.vercel.stage_routes, tools.vercel.start_board_thread, tools.vercel.start_rolling_release, tools.vercel.stop_session, tools.vercel.submit_feedback, tools.vercel.test_drain, tools.vercel.unpause_project, tools.vercel.update_ai_gateway_rule, tools.vercel.update_ai_gateway_virtual_model, tools.vercel.update_attack_challenge_mode, tools.vercel.update_bulk_redirect_version, tools.vercel.update_connector, tools.vercel.update_drain, tools.vercel.update_edge_config, tools.vercel.update_firewall_config, tools.vercel.update_flag, tools.vercel.update_flag_segment, tools.vercel.update_flag_settings, tools.vercel.update_kms_issuer, tools.vercel.update_kms_issuer_policy, tools.vercel.update_project, tools.vercel.update_project_protection_bypass, tools.vercel.update_record, tools.vercel.update_rolling_release_config, tools.vercel.update_route_versions, tools.vercel.update_sandbox, tools.vercel.update_session_network_policy, tools.vercel.upload_artifact, tools.vercel.upload_file, tools.vercel.upsert_ai_gateway_budget, tools.vercel.upsert_ai_gateway_budget_default, tools.vercel.upsert_connector_project_connection, tools.vercel.verify_project_domain, tools.vercel.wait_for_board_changes, tools.vercel.web_fetch_vercel_url, tools.vercel.write_session_files
```

### Render (50)

```
tools.render.approve_blueprint, tools.render.cancel_cron_job_run, tools.render.cancel_flow_run, tools.render.create_blueprint, tools.render.create_cron_job, tools.render.create_key_value, tools.render.create_postgres, tools.render.create_static_site, tools.render.create_web_service, tools.render.create_workflow, tools.render.create_workflow_version, tools.render.get_blueprint, tools.render.get_deploy, tools.render.get_flow, tools.render.get_flow_run, tools.render.get_flow_run_results, tools.render.get_flow_run_step, tools.render.get_key_value, tools.render.get_metrics, tools.render.get_postgres, tools.render.get_selected_workspace, tools.render.get_service, tools.render.get_workflow, tools.render.get_workflow_run, tools.render.get_workflow_run_results, tools.render.get_workflow_task, tools.render.get_workflow_version, tools.render.list_deploys, tools.render.list_events, tools.render.list_flow_run_steps, tools.render.list_flow_runs, tools.render.list_flows, tools.render.list_key_value, tools.render.list_log_label_values, tools.render.list_logs, tools.render.list_postgres_instances, tools.render.list_services, tools.render.list_workflow_runs, tools.render.list_workflow_tasks, tools.render.list_workflow_versions, tools.render.list_workflows, tools.render.list_workspaces, tools.render.plan_blueprint, tools.render.query_render_postgres, tools.render.run_cron_job, tools.render.select_workspace, tools.render.start_flow_run, tools.render.trigger_deploy, tools.render.update_blueprint, tools.render.update_environment_variables
```

### GitHub (47)

```
tools.github.add_comment_to_pending_review, tools.github.add_issue_comment, tools.github.add_reply_to_pull_request_comment, tools.github.create_branch, tools.github.create_or_update_file, tools.github.create_pull_request, tools.github.create_repository, tools.github.delete_file, tools.github.delete_repository, tools.github.fork_repository, tools.github.get_commit, tools.github.get_file_contents, tools.github.get_label, tools.github.get_latest_release, tools.github.get_me, tools.github.get_release_by_tag, tools.github.get_tag, tools.github.get_team_members, tools.github.get_teams, tools.github.issue_read, tools.github.issue_write, tools.github.list_branches, tools.github.list_commits, tools.github.list_issue_fields, tools.github.list_issue_types, tools.github.list_issues, tools.github.list_pull_requests, tools.github.list_releases, tools.github.list_repository_collaborators, tools.github.list_tags, tools.github.merge_pull_request, tools.github.pull_request_read, tools.github.pull_request_review_write, tools.github.push_files, tools.github.request_copilot_review, tools.github.run_secret_scanning, tools.github.search_code, tools.github.search_commits, tools.github.search_issues, tools.github.search_pull_requests, tools.github.search_repositories, tools.github.search_users, tools.github.sub_issue_write, tools.github.ui_get, tools.github.update_issue_comment, tools.github.update_pull_request, tools.github.update_pull_request_branch
```

- The GitHub 47-tool inventory contains no Actions-run tool and no Environment/protection/variable/secret tool; see the exact gap statement in § Capability matrix.
