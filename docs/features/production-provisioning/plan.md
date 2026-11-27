---
feature: production-provisioning
revision: 3
---
# Plan — Production Environment Provisioning

**r2 (spec review r1, F1–F18):** F1 reworks the Neon plan to reuse/verify the pre-existing project-default `production` branch `br-floral-dream-zarerhtw` (parent `—`; no `main`), F2 limits cleanup to the Render/Vercel resources this feature created and never deletes the Neon branch, F3 replaces the bare token audit with the credential-shaped pattern, F4 expands the documentation inventory/negatives, F5 adds the `T5a [owner]` Phase A gate, F6 pins branch-ID/migration-name assertions, F7 adds provider/development read-backs, and F8–F18 apply the remaining corrections (pre-state constants, secret wording, Vercel fallback, dispatch parse, health body, Render origins, anchored URL lines, ledger row, prior-tool clarification, root-directory limitation, deployment IDs). **Spec review r2 (F19–F27):** the credential-shaped pattern retains `FLY_API_TOKEN` and the `FlyV1 [A-Za-z0-9_-]{20,}` key shape; T5a uses `gh variable set SMTP_FROM`; T8 executes the stale-doc scan; T2 uses exact zero/primary/default; T5 asserts production read-backs; the inventory/scan include `six pinned placeholders`/`has no protection rules yet`; T7 greps the full ledger row; T5a/T5 secret division and diff/history audit exclusions are explicit. **r3 (T6 blocker amendment):** T6a adds exactly one `deploy.yml` line (`--repo "$GITHUB_REPOSITORY"` in the pre-checkout `gh run list`), the owner merges the `fix/deploy-ci-preflight` PR, T6 re-dispatches after the fix, and T7/T8 guard the one-line diff; no guard bypass or other workflow change.

## Architecture

The production environment is a second, fully isolated instance of the existing development topology; no application, protocol, container or provider changes are needed.

```
GitHub Actions (manual workflow_dispatch, environment=production, main only)
  │  Check deployment Brevo configuration (11 names, no network)
  │  Neon migration (production DIRECT_DATABASE_URL)
  │  Sync 9 deployed names (GitHub production → Render production service)
  │  Render deploy hook
  │  45 s → /healthz poll (180 s)
  │  Vercel pull/build/deploy --prod (production project)
  │  warm /healthz → deployed smoke (8 checks)
  ▼
Render production service "cubeclicker" (free, Frankfurt, 1 instance, src/backend/Dockerfile)
  ├── runtime DATABASE_URL (Neon production pooled)
  ├── startup/migrations DIRECT_DATABASE_URL (Neon production direct)
  └── in-memory rooms, /healthz, /ws
Browser ──HTTPS──► Vercel production project "cubeclicker" (src/frontend static build)
    └────HTTPS/WSS──► Render production service
Neon project patient-mountain-41401588
  └── pre-existing project-default branch production (br-floral-dream-zarerhtw, parent —; reused, migrated, never created/deleted)
GitHub Environment production
  ├── 23 names (15 variables, 8 secrets; the 11-name guarded catalog inside)
  ├── Phase A owner gate T5a (owner-held values, names-only verification)
  └── main-only deployment branch policy + required reviewers
```

- **State ownership unchanged.** Render owns live room/game state; Neon owns durable account/session/verification/economy/customization rows; Vercel owns no state; GitHub Environments own deployment configuration.
- **Isolation.** Production has its own Render service, Vercel project, Neon branch and GitHub Environment. No production value points at a development resource and no development value points at production. No data is copied.
- **One authorized pipeline fix.** `deploy.yml` already resolves `environment`, `TARGET_ENVIRONMENT`, the concurrency group and every provider value from the selected Environment. `VERCEL_PROJECT_ID` selects the production project; `RENDER_SERVICE_ID`/`RENDER_DEPLOY_HOOK_URL` select the production service. T6a adds exactly one line to the pre-checkout `gh run list` (`--repo "$GITHUB_REPOSITORY"`); no guard logic, condition, step order, permission, trigger or concurrency changes, and the automatic path is unchanged.
- **Provider provisioning boundary.** Neon/Vercel/Render resources are created through the MCPs where the capability exists; GitHub values/protection use the `gh` CLI fallback (no MCP Environment tools). Each task starts with a capability check that records the exact discovered tool or the fallback; no tool name is guessed.

## Interfaces / contracts

### 1. Resource naming and identity

```
Render service:      name = cubeclicker        host = cubeclicker.onrender.com        fallback: cubeclicker-game
Vercel project:      name = cubeclicker        domain = cubeclicker.vercel.app        fallback: cubeclicker-game
Neon branch:         name = production         project = patient-mountain-41401588
                     id = br-floral-dream-zarerhtw (pre-existing project default, parent —)
GitHub Environment:  name = production
```

- Resource display names never contain `-production`, `prod`, `dev`, `development`, `staging` or `stage`.
- `production` on the GitHub Environment and the Neon branch are environment identifiers, not resource-name suffixes; the rule is stated verbatim in the spec and docs.
- Development resources keep `cubeclicker-development` / `cubeclicker-development.vercel.app` / `cubeclicker-development.onrender.com`.
- The Neon `production` branch is the project default `br-floral-dream-zarerhtw` (parent `—`); the `development` branch `br-ancient-smoke-za1pdv7w` was created from it. There is no `main` Neon branch; this feature never creates or deletes a branch.

### 2. Production GitHub Environment catalog (23 names)

Guarded 11 (validated; 9 synced): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `EMAIL_TRANSPORT`, `RENDER_SERVICE_ID` (variables); `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_API_KEY` (secrets).

Workflow-read 9: `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (variables); `DATABASE_URL`, `DIRECT_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`, `VERCEL_TOKEN` (secrets).

Inert parity 3: `MAX_USERS_PER_SERVER`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE` (variables).

Pinned builder-set literals: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `SMTP_CONNECTION_TIMEOUT_MS=10000`, `EMAIL_TRANSPORT=brevo-api`, `MAX_USERS_PER_SERVER=10`, `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`.

Derived builder-set values: `FRONTEND_ORIGIN=https://<vercel-domain>`, `VITE_API_URL=https://<render-host>`, `VITE_WS_URL=wss://<render-host>/ws`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RENDER_SERVICE_ID`.

Owner-held: `VERCEL_TOKEN`, `RENDER_API_KEY`, `BREVO_API_KEY`, `SMTP_USER`, `SMTP_PASS` (secrets); `SMTP_FROM` (variable); `RENDER_DEPLOY_HOOK_URL` only if the Render capability cannot expose it.

### 3. Render production service shape

```yaml
type: web
name: cubeclicker                  # fallback cubeclicker-game
runtime: docker
dockerfilePath: ./src/backend/Dockerfile
dockerContext: .
plan: free                         # owner may select paid
region: frankfurt
branch: main
autoDeployTrigger: 'off'
# no healthCheckPath; the workflow polls /healthz
```

Committed env names: `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`, `METRICS_ENABLED=false`, `MAX_USERS_PER_SERVER=10`, `DB_SCHEMA_BOOTSTRAP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true`, `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000`.

Dashboard-owned env names: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `CORS_ORIGIN`, `ALLOWED_ORIGIN`, `APP_BASE_URL`, `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`; the three origin names equal `FRONTEND_ORIGIN`.

Never service env vars: `RENDER_API_KEY`, `RENDER_SERVICE_ID`.

The nine synced names (`SMTP_*`, `EMAIL_TRANSPORT`, `BREVO_API_KEY`) are written by the deploy workflow, not by T4.

### 4. Vercel production project shape

```
name: cubeclicker                  # fallback cubeclicker-game
rootDirectory: src/frontend
framework: vite
nodeVersion: 24.x
buildCommand/outputDirectory/rewrites/headers: from src/frontend/vercel.json
git auto-deploy: disabled
deployment protection (Vercel Authentication/SSO): disabled
production domain: cubeclicker.vercel.app   # fallback cubeclicker-game.vercel.app
```

The project is not Git-linked; Actions is the only deployment path (`vercel pull/build/deploy --prod`). No deployment is created by T3.

### 5. GitHub Environment protection contract

Use the REST API through `gh api` (the GitHub MCP has no Environment tools):

- `PUT /repos/{owner}/{repo}/environments/production` with `deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }` and `reviewers: [{ type: "User", id: <owner-user-id> }]` (the owner id comes from `gh api user --jq .id`).
- `POST /repos/{owner}/{repo}/environments/production/deployment-branch-policies` with `{ "name": "main", "type": "branch" }` (list first; a 409 means it exists).
- Read-back: `gh api repos/{owner}/{repo}/environments/production` asserts `deployment_branch_policy.custom_branch_policies == true`, the branch-policy list contains exactly `main`, and `protection_rules` contains a `required_reviewers` rule (or the recorded owner fallback).
- Existing variables/secrets are not deleted by the protection `PUT`; the task re-lists names after the update.

### 6. Deploy workflow contract (one authorized preflight line)

- `on.workflow_dispatch.inputs.environment` stays `type: choice`, `required: true`, `default: production`, `options: [production, development]`.
- `jobs.deploy.environment`, `TARGET_ENVIRONMENT` and `concurrency.group` stay the same expressions; the automatic `workflow_run` path still resolves to `development`.
- Step order stays: reject non-push CI → verify CI for a dispatch → checkout → setup Node → install → guard → Neon migration → sync → Render hook → 45 s wait → health poll → Vercel install/pull/build/deploy → warm → smoke.
- The only edit is T6a: in `Verify CI succeeded for target commit`, the pre-checkout `gh run list` adds `--repo "$GITHUB_REPOSITORY"` (or a step-level `GH_REPO` env with the same effect). No guard condition, step `if`, step order, permission, trigger, concurrency or other non-comment line changes; comment edits are dropped from this amendment.
- `render.yaml` and `src/frontend/vercel.json` are unchanged; `ci.yml` and its parses are unchanged.

### 7. Live deploy proof contract

```
gh workflow run deploy.yml --ref main -f environment=production
```

Required lines:
- `Deploy configuration OK: 11 value(s) present for the 'production' environment.`
- nine `SYNCED <KEY> (value verified, not shown)` lines, then `Synced 9 value(s) to Render service <id> for the 'production' environment.`
- `healthz OK after <n>s: {"status":"ok"}`
- `DEPLOYED SMOKE PASS (8/8 checks)`

No production deploy is dispatched until all 23 names are present and CI for the `main` SHA is green. The run's environment is `production`; the job may pause for protection approval.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `docs/features/production-provisioning/build-log-T1.md` | New | Capability matrix, dependency/base-branch check, read-only pre-state, names-only inventories | T1 |
| `docs/features/production-provisioning/build-log-T2.md` | New | Neon branch/migration/zero-data evidence | T2 |
| `docs/features/production-provisioning/build-log-T3.md` | New | Vercel project read-back | T3 |
| `docs/features/production-provisioning/build-log-T4.md` | New | Render service/env/deploy-hook read-back | T4 |
| `docs/features/production-provisioning/build-log-T5a.md` | New | Phase A owner gate: names-only verification of the owner-held values | T5a |
| `docs/features/production-provisioning/build-log-T5.md` | New | GitHub Environment catalog/protection names-only evidence | T5 |
| `docs/features/production-provisioning/build-log-T6.md` | New | Live production deploy proof (post-T6a re-dispatch) | T6 |
| `docs/features/production-provisioning/build-log-T6a.md` | New | One-line deploy preflight fix: PR URL, exact diff, actionlint, dry-run, owner merge | T6a |
| `docs/features/production-provisioning/build-log-T7.md` | New | Documentation pass evidence + proposed feature-index row | T7 |
| `README.md` | Edit | Production state, resources, catalog, runbook, cost/limits | T7 |
| `docs/architecture/deployment.md` | Edit | Environments/triggers, catalog, deploy path, rollback, supersession ledger | T7 |
| `docs/architecture/vercel-render-neon.md` | Edit | Architecture, production catalog/service/project sections, runbook, promote/rollback, cost, local-vs-cloud, ledger | T7 |
| `docs/architecture/email.md` | Edit | Production is live and uses the same Brevo HTTPS API transport | T7 |
| `docs/architecture/observability.md` | Edit | `METRICS_ENABLED=false` on each deployed service | T7 |
| `AGENTS.md` | Edit | Production is provisioned and protected, still manual | T7 |
| `.github/workflows/deploy.yml` | Edit | Exactly one line: add `--repo "$GITHUB_REPOSITORY"` to the pre-checkout `gh run list` in `Verify CI succeeded for target commit`; no other edit | T6a |
| `docs/features/production-provisioning/build-log-T8.md` | New | Final gate and live-proof reproduction | T8 |

Untouched by design: `src/**`, `tests/**`, `compose.yaml`, `compose.smoke.yaml`, `render.yaml`, `src/frontend/vercel.json`, `.github/workflows/ci.yml`, Dockerfiles, `package.json`, `package-lock.json`, `.env*`, `docs/features/README.md`, `docs/features/production-provisioning/status.md`, and the development/provider resources.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Production resource display names are exactly `cubeclicker` (fallback `cubeclicker-game`), never `cubeclicker-production` | Direct user instruction: no environment suffix/prefix on Vercel, Neon or Render resource names; the fallback keeps the rule if the base name is taken | `cubeclicker-production` — forbidden; `cubeclicker-prod` — forbidden; a random name — not reviewable |
| D-2 | GitHub Environment and Neon branch stay named `production` | They are environment identifiers in their provider namespaces, not resource display names; renaming them would break the requested environment semantics | Rename the branch/environment — no environment identifier left; use `prod` — unnecessary abbreviation |
| D-3 | **Reuse and verify** the pre-existing project-default Neon `production` branch `br-floral-dream-zarerhtw` (parent `—`); never create a duplicate and never branch from `development` | The branch already exists as the project default (prior evidence `vercel-fly-neon-deployment/build-log-T7-provision.md:20-35`); creating from a non-existent `main` would fail or duplicate; reusing keeps the project-default identity and avoids copying development data. T2 applies the seven migrations and verifies zero application rows | Create a new branch from `development` — copies dev data and duplicates `production`; create from `main` — no such branch; use a second Neon project — out of scope |
| D-4 | Reuse the existing `production` GitHub Environment and fill it, rather than create a third environment | It already exists with the four constants + five placeholders and no protection; this feature upgrades it in place; there is no staging/third environment | New environment — breaks the two-environment model; new repository — out of scope |
| D-5 | Extend the production Environment to the full 23-name catalog, with the 11-name guarded catalog explicit | The deploy job also reads `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`, `VERCEL_TOKEN`; development already carries the inert parity names; "same as development" means the full set, not only the guard | Only the 11 guarded names — the workflow would fail on the missing workflow-read names; invent fewer names — diverges from development |
| D-6 | Use MCPs where capable; `gh` CLI for GitHub Environments and protection | Recorded capability evidence: Render/Neon MCPs provisioned development; GitHub MCP has no Actions-run/Environment tools. A single `gh` fallback is the documented, authenticated path | Guess GitHub MCP tool names — forbidden/unreliable; manual UI only — not reproducible |
| D-7 | Builder sets provider-generated values in-process; owner sets owner-held credentials | Neon URLs and (if readable) the Render hook are created by this feature and can be written without reading existing secrets; Vercel token, Render API key, Brevo key and SMTP credentials are owner-held and must never be read by the builder | Builder creates tokens via MCP — tool output would expose the secret in the transcript; builder reads dev secrets — forbidden |
| D-8 | Add `main`-only branch policy + required reviewers; development stays unprotected | Matches the documented pre-provisioning requirement and the owner's "same way" direction; the branch policy prevents non-main dispatches; reviewers are the human gate. The single-owner deadlock is documented with a fallback | No protection — leaves production dispatchable by any Actions-write user; reviewers only — no branch policy |
| D-9 | Production `SMTP_PORT=2525`, `SMTP_SECURE=false` | The Render-free-safe STARTTLS pair the earlier features already document for a Render-free production service; the API transport ignores SMTP but a future SMTP fallback stays viable; the strict guard remains development-scoped | Keep `587` — blocked on Render free and only a placeholder; extend the guard code — out of scope (`registration-account-exists` Q-2) |
| D-10 | Keep `render.yaml` as the development-service description; no second Blueprint entry | Avoids making the Blueprint a production adoption/creation surface; the production service is MCP-provisioned and documented in the architecture reference; the one-service CI parse stays unchanged | Add a second service — Blueprint adoption risk + CI parse change; new production Blueprint — new artifact/scope |
| D-11 | The only `deploy.yml` change is the T6a one-line preflight fix (`--repo "$GITHUB_REPOSITORY"`, or an equivalent single `GH_REPO` step env); no guard bypass, no condition/step-order/permission change; keep `production` as the dispatch default | The T6 run failed before `Checkout` because `gh run list` had no repository context; the one-line fix preserves the fail-closed CI-success guard and makes the manual path functional. Comment edits are dropped to keep the diff exactly one line | Rewrite the workflow — unnecessary risk; add extra edits beyond one line — violates the one-line authorization; bypass the guard — forbidden; switch the default — changes production behavior (Q-8) |
| D-12 | Live production deploy is part of the build proof, after Phase A values and CI success | The owner explicitly authorized creating production resources and running a live production deploy; a live guard/sync/health/smoke run is the only end-to-end proof | Static-only proof — cannot prove the provider topology; a local smoke — does not exercise Vercel/Render/Neon |
| D-13 | Hard dependency on `brevo-api-email-transport`; no hard dependency on `registration-account-exists` | The 11-name catalog/9-name sync exists only after the Brevo API merge; the production deploy/smoke does not touch registration; the SMTP safe value removes the need for the unmerged guard extension | Build before the Brevo merge — the catalog/guard would be the old 9/7 shape; wait for registration-account-exists — unnecessary |
| D-14 | Cleanup only before the live deploy is green; only the Render/Vercel resources this feature created may be deleted; the pre-existing Neon `production` branch is never deleted; no rollback to development | The branch is the project default and predates this feature; deleting it could destroy the project default and is outside the owner's provisioning authorization. Production has no data at provisioning time; deleting the new Render/Vercel resources is safe if provisioning is abandoned; once live, fix forward and never point production at development | Delete the Neon branch because it is zero-row — destructive and forbidden; delete production resources after a bad live deploy — destroys the new environment; repoint to development — forbidden |
| D-15 | Add a named Phase A owner gate `T5a [owner]` before T5 | The owner-held values cannot be written by the builder and T5's exact 15/8 listing cannot pass without them; a named gate makes the dependency explicit and keeps T5 blocked until the owner records the names-only hand-off | Fold Phase A into T5 — the builder would fail or record an incomplete hand-off; T6 waits on T5 anyway |

## Risks & mitigations

- **The `brevo-api-email-transport` merge is delayed** → T1 is a hard gate: it checks `origin/main` for `EMAIL_CATALOG` and the `EMAIL_TRANSPORT`/`BREVO_API_KEY` bindings and stops before any production value is written; the orchestrator merges that feature first.
- **`cubeclicker` is unavailable at Vercel/Render** → Use the single documented fallback `cubeclicker-game`; if both are unavailable, stop and ask the owner; never use an environment-token name.
- **A secret leaks into a build log or command line** → Owner-held values via UI/stdin only; provider-generated values through mode-600 files/pipes; no `gh secret get`; the shared build-log guard and repository credential audit run in T1/T5/T7/T8.
- **The Render deploy hook is not MCP-readable** → Owner creates/copies it in the Render dashboard and sets `RENDER_DEPLOY_HOOK_URL` via UI/stdin; the live deploy only proceeds when the name is present. No guessed tool.
- **The GitHub MCP lacks Environment tools** → Use the authenticated `gh` CLI fallback (`gh variable`, `gh secret`, `gh api`); the T1 capability matrix records the gap and the fallback.
- **The production protection gate deadlocks a single-owner repo** → Confirm the owner can approve before dispatch; if self-approval is refused, keep the `main`-only branch policy and remove required reviewers (or add a second reviewer), recorded as an owner decision (Q-4).
- **Two free Render services exceed the 750 h budget** → Document the shared budget and the risk; the owner may choose a paid plan (Q-1); the build log records the chosen plan.
- **The Neon branch id drifts** → T2 requires exactly `br-floral-dream-zarerhtw`; a different live id stops the task with `BLOCKED: production branch id drift` and no id is substituted. The pre-existing branch is never created or deleted.
- **The builder creates a duplicate Neon `production` branch or records a false parent** → F1: the pre-existing project-default branch `br-floral-dream-zarerhtw` (parent `—`) is reused; T1 re-reads the branch list; T2 asserts the branch id and `parent: none (project default)`, never `parent main`, and never creates a branch.
- **Cleanup deletes the pre-existing Neon branch** → F2: cleanup is limited to the Render service and Vercel project this feature created; the Neon branch is retained and never deleted (non-goal, AC-11, boundaries).
- **The token audit is red on the current tree** → F3/F19: use the credential-shaped `(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=["']?[A-Za-z0-9+/_-]{12,}` pattern plus the `FlyV1 [A-Za-z0-9_-]{20,}` key shape, with documented `docs/`/test-file exclusions, and record the current-tree no-match proof in T8; the Fly coverage is retained from `workflow-hygiene`.
- **Stale production docs survive a green T7** → F4: the expanded inventory and exact negatives plus the T8 exhaustive allowlisted scan; a non-allowlisted `not provisioned`/`unprovisioned`/`placeholder-only`/`future production`/`one project` line fails the gate.
- **T5 fails because the owner-held names are absent** → F5: the named `T5a [owner]` gate records the names-only hand-off before T5; T5 depends on T5a and T6 depends on T5.
- **The final gate cannot prove development was untouched** → F7: T1 records the pre-state and T5/T8 re-run the same provider read-backs, including `development unchanged: PASS`; T8 records the production read-backs and single `production frontend:`/`production api:` lines.
- **Production accidentally inherits development data** → The production branch is the project default, not a development copy; verify the four application tables are zero-row before the live deploy; stop and ask the owner if rows exist; never create a branch from `development`.
- **The manual CI preflight fails before `Checkout`** → T6a adds exactly `--repo "$GITHUB_REPOSITORY"` to the pre-checkout `gh run list`; the guard condition, dispatch-only `if`, step order, permissions, triggers and concurrency stay unchanged; actionlint, the exact one-line diff, the PR URL and the `gh run list --repo` dry-run are recorded. The owner merges the `fix/deploy-ci-preflight` PR; T6 re-dispatches the same production command after the fix is on `main`.
- **The T6a fix grows beyond one line** → T6a's verify asserts exactly one added/one removed non-comment line, the added line contains `--repo "$GITHUB_REPOSITORY"`, and no guard logic/condition/step-order/permission/trigger/concurrency change; T7/T8 re-assert the same diff guard.
- **Production accidentally deploys from `main` automatically** → No `push` trigger is added; the automatic `workflow_run` resolves to `development`; the dispatch parse and the T8 workflow check pin the trigger; the `production` Environment branch policy allows only `main`.
- **A production deploy fails after the migration** → The guard/sync/migration are idempotent; fix forward and re-run; the migration is add-only; no rollback to development; cleanup rules apply only before the live deploy is green.
- **Docs drift / stale production statements** → T7 pins exact positive and negative greps over `README.md`, the four architecture docs and `AGENTS.md`; T8 re-runs them.
- **The feature branch's CI is red while the live deploy uses `main`** → The live dispatch is from `main` and requires a successful CI run for the `main` SHA; the feature branch's own CI is the static gate, not the live proof.
- **The owner is unavailable to approve the production gate** → The provisioning is complete and fail-closed; the live proof waits for approval (Q-10); no bypass is added.

## Open questions

Mirrors `spec.md` § Open questions; none block planning.

- Q-1 — Render plan free (default) vs paid; 750 h shared budget.
- Q-2 — Vercel plan current/Hobby (default) vs commercial.
- Q-3 — Neon free (default) vs paid for branch protection/PITR.
- Q-4 — required reviewers default; single-owner deadlock fallback.
- Q-5 — dedicated production credentials (default) vs reuse with risk acceptance.
- Q-6 — production `SMTP_PORT=2525` (default) vs `587`.
- Q-7 — `render.yaml` development-only (default) vs second service.
- Q-8 — keep `production` as the `workflow_dispatch` default (default) vs switch.
- Q-9 — platform-default hosts (default) vs custom domain (out of scope).
- Q-10 — owner approval availability for the live proof.

Status/blocker note (orchestrator-owned): record `T5 blocked pending T5a Phase A owner hand-off` in `docs/features/production-provisioning/status.md`; this planner does not edit that file.

## Verification plan (task-to-command map)

| Task | Primary proof |
| --- | --- |
| T1 | `npm ci`; `gh auth status`; `gh api .../environments` names; `gh variable list`/`gh secret list --env production` names; `gh api .../environments/production` protection read-back; Neon/Vercel/Render read-only MCP listings; `git show origin/main:...render-env.ts \| grep EMAIL_CATALOG`; `git show origin/main:.github/workflows/deploy.yml \| grep EMAIL_TRANSPORT`; capability-matrix and dependency sections present in `build-log-T1.md`; credential guard |
| T2 | Neon branch read-back (`branch id: br-floral-dream-zarerhtw`; a different live id stops with `BLOCKED: production branch id drift`; `parent: none (project default)`); pooled/direct host + `sslmode=require` checks; live `pg` connection (no output); migration CLI output; `schema_migrations: 7` plus the seven names; `run_sql` counts for the five tables; zero-row assertion; build-log guard |
| T3 | Vercel project read-back (name/ID/domain/root request/framework/Node/protection/Git); distinct from `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`; no deployment; `production frontend: <url>` line; build-log guard |
| T4 | Render service read-back (name/host/plan/region/branch/autoDeploy/dockerfile/no health check); env name list (15 names; no `RENDER_API_KEY`/`RENDER_SERVICE_ID`); exact `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL` = `FRONTEND_ORIGIN` and `<set>` Neon URLs; `production api: <url>` line; deploy hook name/statement; build-log guard |
| T5a | `gh variable list`/`gh secret list --env production` names-only; `Phase A owner hand-off complete`; owner-held six names present; no value read |
| T5 | `gh variable list`/`gh secret list --env production` exact 15/8 sets; 11-name subset; `SMTP_USER` secret-only; protection read-back (`main` policy + reviewers/fallback); development pre/post listings; `.env*` checks; build-log guard |
| T6a | T6a PR diff exactly one added/one removed line (added contains `--repo "$GITHUB_REPOSITORY"`); no guard condition/step-order/permission/trigger/concurrency change; `actionlint`; `gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit <sha>` dry-run success; PR URL and owner merge recorded |
| T6 | `gh run list --workflow CI --commit <main-sha>` success; `gh workflow run ... -f environment=production`; the fix PR/commit is on `main`; `gh run view <id> --log` exact guard/sync/`healthz OK after <n>s: {"status":"ok"}`/smoke lines; Render deploy ID/status and Vercel deployment ID; build-log guard |
| T7 | Docs positive/negative greps; link check; `actionlint`; `vercel.json` JSON parse; `render.yaml` YAML parse (one service); `ci.yml` dispatch parse; `npm run lint/typecheck/test/coverage/build`; `npm run smoke`; credential audit; exact ledger row; feature-index proposal; `status.md`/`docs/features/README.md` no-edit evidence |
| T8 | Full re-run of the static gate (lint/typecheck/tests/coverage/build/smoke/actionlint/parses/fixtures/credential-shaped audit), the exact T6a PR diff guard, plus the live proof and T5/T8 provider/development read-backs (run URL, guard line, 9 sync lines, `/healthz` 200, deployed smoke 8/8, development unchanged); final report |
