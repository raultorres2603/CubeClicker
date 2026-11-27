# Tasks — Production Environment Provisioning

**r2 (spec review r1, F1–F18):** T2 reuses/verifies the pre-existing project-default Neon `production` branch `br-floral-dream-zarerhtw` (parent `—`, no `main`; blocks on id drift) and asserts the seven migration names; T4 adds the anchored `production api:` line and exact Render origins/`<set>` values; **T5a** is the Phase A owner gate before T5; T6 asserts the exact health body and anchored URLs and forbids Neon-branch deletion; T7 adds the F4 negatives, the exact ledger row, the link-resolution record and the credential-shaped canonical audit; T8 adds the credential-shaped audit, the dispatch parse, the provider/development read-backs and the final stale-docs scan.

**r2 (spec review r2, F19–F27):** restored `FLY_API_TOKEN` to the credential-shaped alternation and `FlyV1 [A-Za-z0-9_-]{20,}` to the key-shape audit (spec/plan/T7/T8); T5a sets `SMTP_FROM` with `gh variable set`, not `gh secret set`; T8 executes the stale-doc scan instead of only recording it; T2 uses exact `*: 0` and `primary/default: true` lines; T5 asserts the production read-back lines; the inventory/negatives/scan include `six pinned placeholders` and `has no protection rules yet`; T7 greps the full ledger row; T5a/T5 secret division is explicit; the diff/history credential-shaped audits use the documented exclusions.

**r3 (T6 blocker amendment):** T6a adds exactly one line to `deploy.yml` (`--repo "$GITHUB_REPOSITORY"` in the pre-checkout `gh run list`), the owner merges the `fix/deploy-ci-preflight` PR, and T6 re-dispatches after the fix is on `main`; T7/T8 guard the exact one-line diff. No guard bypass or other workflow edit.

Dependency overview: **T1 → T2 → T3 → T4 → T5a → T5 → T6a → T6 → T7 → T8** (all `[seq]`; T5a is the Phase A owner gate; T6a is the owner-merged one-line workflow fix; live provider operations and the shared documentation/deploy-comment files make parallel batches unsafe). T1 is a hard capability/dependency gate; T2 reuses/migrates the existing Neon branch; T3/T4 create the Vercel/Render resources; T5a is the owner hand-off; T5 completes the GitHub Environment; T6a fixes the pre-checkout CI preflight; T6 is the live proof; T7 is the documentation pass; T8 is the final verification and integration task. No task touches development resources.

Task types: T1–T6 are infrastructure tasks (provider/GitHub state plus build logs) and add no application tests or coverage target; T5a is an owner gate; T6a is the one-line workflow preflight fix (config change with actionlint/diff/dry-run proof). T7 is a documentation/config-comment task; T8 is the final gate and runs the full repository suite (including `npm run coverage`) to prove no regression. No application code is planned; if a builder finds one is required, the normal unit + integration test deliverables and `npm run coverage` (≥ 80% per workspace) apply to that task and the spec must be revised first.

## T1 — Capability matrix, base-branch gate and read-only preflight `[seq]`
depends_on: —
files_owned: `docs/features/production-provisioning/build-log-T1.md`
verify:
```bash
set -euo pipefail
npm ci
gh auth status
base=$(git merge-base origin/main HEAD)
git show origin/main:src/backend/src/deploy/render-env.ts | grep -q 'EMAIL_CATALOG'
git show origin/main:.github/workflows/deploy.yml | grep -q 'EMAIL_TRANSPORT'
git show origin/main:.github/workflows/deploy.yml | grep -q 'BREVO_API_KEY'
gh api repos/raultorres2603/CubeClicker/environments --jq '.environments[].name' | sort
gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort
gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort
gh api repos/raultorres2603/CubeClicker/environments/production --jq '{name: .name, protection_rules: (.protection_rules // []), deployment_branch_policy: (.deployment_branch_policy // null)}'
printf '{}' | gh api --method PUT repos/raultorres2603/CubeClicker/environments/production/secrets/__write_permission_probe --input - 2>/dev/null || true
printf '{}' | gh api --method POST repos/raultorres2603/CubeClicker/environments/production/variables --input - 2>/dev/null || true
test -f docs/features/production-provisioning/build-log-T1.md
grep -qE '^## Capability matrix' docs/features/production-provisioning/build-log-T1.md
grep -qE '^## Dependency and base-branch check' docs/features/production-provisioning/build-log-T1.md
grep -qE '^## Read-only pre-state' docs/features/production-provisioning/build-log-T1.md
grep -qF 'GitHub MCP has no Actions-run or Environment-variable tools' docs/features/production-provisioning/build-log-T1.md
grep -qF 'gh CLI fallback' docs/features/production-provisioning/build-log-T1.md
test -z "$(git status --porcelain -- '.env*')"
test -z "$(git diff --name-only "$base" -- '.env*')"
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-T1.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-provisioning/build-log-T1.md
```
acceptance: AC-10(a), AC-12(a)
status: [ ]

Read-only capability and dependency gate. Enumerate the session's Neon, Vercel, Render and GitHub MCP tools by **capability** (branch create/list/connection string/SQL; project create/update/domain/project ID; service create/get/env vars/deploy hook/deploy status; environment/protection/variable/secret) and record the exact discovered tool names in `build-log-T1.md` § Capability matrix. Do not call a tool you have not listed; when a capability is absent, record the documented fallback (`gh` CLI for GitHub Environments/Actions, `vercel`/`render` CLI or owner hand-off, Node `fetch`). Record the known GitHub MCP gap (47 tools, no Actions-run/Environment-variable tools) and the `gh` fallback. Check `main` for the `brevo-api-email-transport` eleven-name catalog and the `EMAIL_TRANSPORT`/`BREVO_API_KEY` bindings; if absent, record `BLOCKED: brevo-api-email-transport is not on main` and stop without writing any production value. Record the pre-state names-only listings for the `production` and `development` Environments, the Neon branch list, the Vercel project list and the Render service list. Run the two validation-failure write-permission probes (HTTP 422, creates nothing). Record no secret and no connection string. This task mutates nothing except the build log.

## T2 — Neon `production` branch, URLs, migrations and zero-data check `[seq]`
depends_on: T1
files_owned: `docs/features/production-provisioning/build-log-T2.md`
verify:
```bash
set -euo pipefail
test -f docs/features/production-provisioning/build-log-T2.md
grep -qF 'branch production' docs/features/production-provisioning/build-log-T2.md
grep -qF 'branch id: br-floral-dream-zarerhtw' docs/features/production-provisioning/build-log-T2.md
! grep -qF 'DRIFT: production branch id' docs/features/production-provisioning/build-log-T2.md
! grep -qF 'BLOCKED: production branch id drift' docs/features/production-provisioning/build-log-T2.md
branch_id=$(grep -oE 'branch id: br-[a-z0-9-]+' docs/features/production-provisioning/build-log-T2.md | head -n1 | sed 's/^branch id: //')
test -n "$branch_id"
test "$branch_id" != "br-ancient-smoke-za1pdv7w"
grep -qF 'parent: none (project default)' docs/features/production-provisioning/build-log-T2.md
grep -qF 'not created from development' docs/features/production-provisioning/build-log-T2.md
grep -qF -- '-pooler' docs/features/production-provisioning/build-log-T2.md
grep -qF 'sslmode=require' docs/features/production-provisioning/build-log-T2.md
grep -qF 'DATABASE_URL: connected' docs/features/production-provisioning/build-log-T2.md
grep -qF 'DIRECT_DATABASE_URL: connected' docs/features/production-provisioning/build-log-T2.md
grep -qF 'schema_migrations: 7' docs/features/production-provisioning/build-log-T2.md
for name in 001_init.sql 002_economy.sql 003_upgrades.sql 004_idle_accrual.sql 005_spaceship_customization.sql 006_granular_spaceship_parts.sql 007_economy_revision.sql; do grep -qF "$name" docs/features/production-provisioning/build-log-T2.md; done
test "$(ls src/backend/src/db/migrations/*.sql | wc -l)" -eq 7
grep -qF 'users' docs/features/production-provisioning/build-log-T2.md
grep -qF 'sessions' docs/features/production-provisioning/build-log-T2.md
grep -qF 'verification_tokens' docs/features/production-provisioning/build-log-T2.md
grep -qF 'user_economy' docs/features/production-provisioning/build-log-T2.md
grep -qx 'primary: true' docs/features/production-provisioning/build-log-T2.md
grep -qx 'default: true' docs/features/production-provisioning/build-log-T2.md
grep -qx 'users: 0' docs/features/production-provisioning/build-log-T2.md
grep -qx 'sessions: 0' docs/features/production-provisioning/build-log-T2.md
grep -qx 'verification_tokens: 0' docs/features/production-provisioning/build-log-T2.md
grep -qx 'user_economy: 0' docs/features/production-provisioning/build-log-T2.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-provisioning/build-log-T2.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-T2.md
```
acceptance: AC-2, AC-6(a)
status: [ ]

Using the Neon capability recorded in T1, **reuse and verify** the pre-existing project-default `production` branch `br-floral-dream-zarerhtw` in project `patient-mountain-41401588` (parent `—`/default, primary/default, unprotected). Do **not** create a branch, do **not** delete a branch, and do **not** branch from `development`; there is no `main` Neon branch. Re-read the live branch list first; if the live id differs from `br-floral-dream-zarerhtw`, stop and report `BLOCKED: production branch id drift`; do not proceed or record a substituted id. Read or derive the pooled (`-pooler`) and direct connection strings; assert both carry `sslmode=require`; verify each with a real `pg` connection (print only `DATABASE_URL: connected` / `DIRECT_DATABASE_URL: connected`). Stage the values in mode-600 files under `/tmp/opencode` when a pipe is needed; never echo them. Apply the pending migrations with `npx --no-install tsx src/backend/src/db/migrate-cli.ts` and `DIRECT_DATABASE_URL` (the value in the process environment only); record the applied/pending output. Run read-only SQL on the production branch to assert the five required tables exist and `users`, `sessions`, `verification_tokens`, `user_economy` have 0 rows (`schema_migrations` is exempt), and that `schema_migrations` has exactly seven rows with the names `001_init.sql`, `002_economy.sql`, `003_upgrades.sql`, `004_idle_accrual.sql`, `005_spaceship_customization.sql`, `006_granular_spaceship_parts.sql`, `007_economy_revision.sql`. Record the branch id, parent, host shapes (redacted role/password) and counts in the build log; do not record a connection string. If the branch inherits application rows, stop and report `blocked` for an owner decision; do not delete rows or the branch. Record these exact evidence lines in `build-log-T2.md`: `branch production`, `branch id: br-floral-dream-zarerhtw`, `parent: none (project default)`, `primary: true`, `default: true`, `not created from development`, `DATABASE_URL: connected`, `DIRECT_DATABASE_URL: connected`, `schema_migrations: 7`, the seven migration names, `users: 0`, `sessions: 0`, `verification_tokens: 0`, `user_economy: 0`.

## T3 — Vercel production project `[seq]`
depends_on: T2
files_owned: `docs/features/production-provisioning/build-log-T3.md`
verify:
```bash
set -euo pipefail
test -f docs/features/production-provisioning/build-log-T3.md
grep -qE 'name: cubeclicker(-game)?$' docs/features/production-provisioning/build-log-T3.md
grep -qE 'https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T3.md
grep -qE 'production frontend: https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T3.md
grep -qF 'rootDirectory: src/frontend' docs/features/production-provisioning/build-log-T3.md
grep -qF 'framework: vite' docs/features/production-provisioning/build-log-T3.md
grep -qF 'nodeVersion: 24.x' docs/features/production-provisioning/build-log-T3.md
grep -qF 'gitAutoDeploy: disabled' docs/features/production-provisioning/build-log-T3.md
grep -qF 'deploymentProtection: disabled' docs/features/production-provisioning/build-log-T3.md
grep -qF 'distinct from prj_9GfusgivGpVJDXeJPi2TnMUCb2RV' docs/features/production-provisioning/build-log-T3.md
grep -qF 'No Vercel deployment was created' docs/features/production-provisioning/build-log-T3.md
! grep -qE 'name: cubeclicker-production|https://cubeclicker-production' docs/features/production-provisioning/build-log-T3.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|VERCEL_TOKEN=[\"']?[A-Za-z0-9_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-T3.md
```
acceptance: AC-1(b), AC-3
status: [ ]

Using the Vercel capability recorded in T1, reuse or create the production project named exactly `cubeclicker` (fallback `cubeclicker-game` only if `cubeclicker` is unavailable at Vercel; record the provider's refusal; if both are unavailable, stop and report `blocked`). Set root directory `src/frontend`, framework `vite`, Node.js `24.x`, the `src/frontend/vercel.json` build/output/rewrites/headers, Git auto-deploy disabled and Vercel deployment protection (Vercel Authentication/SSO) disabled. Read back the project ID, org ID and production domain (`https://cubeclicker.vercel.app`, fallback `https://cubeclicker-game.vercel.app`). Do not create a deployment. Note: the Vercel MCP project projection may omit `rootDirectory`; record the requested `rootDirectory: src/frontend` as a request record and treat T6's successful Vercel build as the effective-root proof (same limitation recorded for the development project). Record these exact evidence lines in `build-log-T3.md`: `name: cubeclicker` (or `name: cubeclicker-game`), `https://cubeclicker.vercel.app` (or the fallback), `production frontend: https://cubeclicker.vercel.app` (or the fallback; the single anchored line), `rootDirectory: src/frontend` (request record), `framework: vite`, `nodeVersion: 24.x`, `gitAutoDeploy: disabled`, `deploymentProtection: disabled`, `distinct from prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`, `No Vercel deployment was created`, and `project id: <id>` / `org id: <id>` (non-secret). If the Vercel MCP cannot create/update the project, use the authenticated `vercel` CLI/REST fallback if a session/token is available; otherwise stop and record the owner hand-off (dashboard) rather than guessing a tool. Never record a token.

## T4 — Render production service, environment and deploy hook `[seq]`
depends_on: T2, T3
files_owned: `docs/features/production-provisioning/build-log-T4.md`
verify:
```bash
set -euo pipefail
test -f docs/features/production-provisioning/build-log-T4.md
grep -qE 'name: cubeclicker(-game)?$' docs/features/production-provisioning/build-log-T4.md
grep -qE 'https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T4.md
grep -qF 'runtime: docker' docs/features/production-provisioning/build-log-T4.md
grep -qF 'dockerfilePath: ./src/backend/Dockerfile' docs/features/production-provisioning/build-log-T4.md
grep -qF 'dockerContext: .' docs/features/production-provisioning/build-log-T4.md
grep -qE 'plan: (free|starter|standard|pro)' docs/features/production-provisioning/build-log-T4.md
grep -qF 'region: frankfurt' docs/features/production-provisioning/build-log-T4.md
grep -qF 'branch: main' docs/features/production-provisioning/build-log-T4.md
grep -qF 'autoDeployTrigger: off' docs/features/production-provisioning/build-log-T4.md
grep -qF 'healthCheckPath: none' docs/features/production-provisioning/build-log-T4.md
grep -qE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T4.md
prod_frontend=$(grep -oE 'production frontend: https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T3.md | head -n1 | sed 's/^production frontend: //')
test -n "$prod_frontend"
grep -qF "CORS_ORIGIN=$prod_frontend" docs/features/production-provisioning/build-log-T4.md
grep -qF "ALLOWED_ORIGIN=$prod_frontend" docs/features/production-provisioning/build-log-T4.md
grep -qF "APP_BASE_URL=$prod_frontend" docs/features/production-provisioning/build-log-T4.md
grep -qF 'DATABASE_URL=<set>' docs/features/production-provisioning/build-log-T4.md
grep -qF 'DIRECT_DATABASE_URL=<set>' docs/features/production-provisioning/build-log-T4.md
for name in NODE_ENV HOST PORT METRICS_ENABLED MAX_USERS_PER_SERVER DB_SCHEMA_BOOTSTRAP_ENABLED DB_EXPIRED_TOKEN_CLEANUP_ENABLED DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS DATABASE_URL DIRECT_DATABASE_URL CORS_ORIGIN ALLOWED_ORIGIN APP_BASE_URL SESSION_COOKIE_SECURE SESSION_COOKIE_SAMESITE; do grep -qF "$name" docs/features/production-provisioning/build-log-T4.md; done
grep -qF 'NODE_ENV=production' docs/features/production-provisioning/build-log-T4.md
grep -qF 'HOST=0.0.0.0' docs/features/production-provisioning/build-log-T4.md
grep -qF 'PORT=8080' docs/features/production-provisioning/build-log-T4.md
grep -qF 'METRICS_ENABLED=false' docs/features/production-provisioning/build-log-T4.md
grep -qF 'MAX_USERS_PER_SERVER=10' docs/features/production-provisioning/build-log-T4.md
grep -qF 'DB_SCHEMA_BOOTSTRAP_ENABLED=true' docs/features/production-provisioning/build-log-T4.md
grep -qF 'DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true' docs/features/production-provisioning/build-log-T4.md
grep -qF 'DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000' docs/features/production-provisioning/build-log-T4.md
grep -qF 'SESSION_COOKIE_SECURE=true' docs/features/production-provisioning/build-log-T4.md
grep -qF 'SESSION_COOKIE_SAMESITE=none' docs/features/production-provisioning/build-log-T4.md
grep -qF 'RENDER_API_KEY is not a service variable' docs/features/production-provisioning/build-log-T4.md
grep -qF 'RENDER_SERVICE_ID is not a service variable' docs/features/production-provisioning/build-log-T4.md
grep -qF 'deploy hook' docs/features/production-provisioning/build-log-T4.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-provisioning/build-log-T4.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-T4.md
! grep -qE 'name: cubeclicker-production|https://cubeclicker-production' docs/features/production-provisioning/build-log-T4.md
```
acceptance: AC-1(a), AC-4, AC-6(a)
status: [ ]

Using the Render capability recorded in T1, reuse or create the production Docker web service named exactly `cubeclicker` (fallback `cubeclicker-game` only if `cubeclicker` is unavailable at Render; record the refusal). Set runtime `docker`, `dockerfilePath ./src/backend/Dockerfile`, `dockerContext .`, branch `main`, one instance, `plan: free` (or the owner-selected paid plan), region `frankfurt`, `autoDeployTrigger: off` and no `healthCheckPath`. Set the eight committed env names and the seven dashboard-owned names (the two Neon URLs from T2 in-process; `CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL` exactly equal to `FRONTEND_ORIGIN` from T3; `SESSION_COOKIE_SECURE=true`; `SESSION_COOKIE_SAMESITE=none`). Read back the service ID, host and deploy hook; store the hook as `RENDER_DEPLOY_HOOK_URL` if the tool can read it, otherwise record the owner hand-off. Never write `RENDER_API_KEY` or `RENDER_SERVICE_ID` to the service; never print a hook/URL/credential. A provider-created initial deploy is not acceptance evidence (T6 is). Record these exact evidence lines in `build-log-T4.md`: `name: cubeclicker` (or `name: cubeclicker-game`), `https://cubeclicker.onrender.com` (or the fallback), `production api: https://cubeclicker.onrender.com` (or the fallback; the single anchored line), `service id: srv-<id>`, `runtime: docker`, `dockerfilePath: ./src/backend/Dockerfile`, `dockerContext: .`, `plan: free` (or the paid plan), `region: frankfurt`, `branch: main`, `autoDeployTrigger: off`, `healthCheckPath: none`, the fifteen `NAME=value` lines for the committed/dashboard names (`CORS_ORIGIN`, `ALLOWED_ORIGIN` and `APP_BASE_URL` exactly equal to the `production frontend:` value; `DATABASE_URL=<set>` and `DIRECT_DATABASE_URL=<set>`; other secret values as `<set>`), `RENDER_API_KEY is not a service variable`, `RENDER_SERVICE_ID is not a service variable`, and `deploy hook: <set|owner hand-off>`.

## T5a — Phase A owner hand-off `[owner]` `[seq]`
depends_on: T4
files_owned: `docs/features/production-provisioning/build-log-T5a.md`
verify:
```bash
set -euo pipefail
test -f docs/features/production-provisioning/build-log-T5a.md
vars=$(gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort)
secrets=$(gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort)
printf '%s\n' "$vars" | grep -qx 'SMTP_FROM'
for name in SMTP_USER SMTP_PASS BREVO_API_KEY VERCEL_TOKEN RENDER_API_KEY RENDER_DEPLOY_HOOK_URL; do printf '%s\n' "$secrets" | grep -qx "$name"; done
grep -qF 'Phase A owner hand-off complete' docs/features/production-provisioning/build-log-T5a.md
grep -qF 'names only; no value read' docs/features/production-provisioning/build-log-T5a.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-T5a.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-provisioning/build-log-T5a.md
```
acceptance: AC-5(d)
status: [ ]

Owner gate (Phase A). The owner sets the five owner-held secrets `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY` and the `RENDER_DEPLOY_HOOK_URL` secret when T4 recorded `deploy hook: owner hand-off` (when T4 read the hook, the builder sets it and T5a verifies the name only) via the GitHub UI or `gh secret set` stdin; the `SMTP_FROM` **variable** is set with the GitHub UI or `gh variable set SMTP_FROM` (never `gh secret set`). T5a checks six secret names (the five owner-held plus the hook) and the `SMTP_FROM` variable; T5 then adds the two builder-set secrets `DATABASE_URL` and `DIRECT_DATABASE_URL`, so all eight production secrets exist before T5's 8-secret count can pass. The builder does not read any value; it runs the names-only `gh variable list`/`gh secret list` verification and records `Phase A owner hand-off complete` plus `names only; no value read` in `build-log-T5a.md`. If any owner-held name is missing, record `BLOCKED: Phase A owner hand-off incomplete` and stop; T5 remains blocked until this task completes. Do not print, copy or record a value.

## T5 — GitHub `production` Environment catalog and protection `[seq]`
depends_on: T5a
files_owned: `docs/features/production-provisioning/build-log-T5.md`
verify:
```bash
set -euo pipefail
base=$(git merge-base origin/main HEAD)
test -f docs/features/production-provisioning/build-log-T5.md
vars=$(gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort)
secrets=$(gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort)
printf '%s\n' "$vars" | grep -qx 'FRONTEND_ORIGIN'
printf '%s\n' "$vars" | grep -qx 'VITE_API_URL'
printf '%s\n' "$vars" | grep -qx 'VITE_WS_URL'
printf '%s\n' "$vars" | grep -qx 'VERCEL_ORG_ID'
printf '%s\n' "$vars" | grep -qx 'VERCEL_PROJECT_ID'
printf '%s\n' "$vars" | grep -qx 'MAX_USERS_PER_SERVER'
printf '%s\n' "$vars" | grep -qx 'SESSION_COOKIE_SECURE'
printf '%s\n' "$vars" | grep -qx 'SESSION_COOKIE_SAMESITE'
printf '%s\n' "$vars" | grep -qx 'SMTP_HOST'
printf '%s\n' "$vars" | grep -qx 'SMTP_PORT'
printf '%s\n' "$vars" | grep -qx 'SMTP_SECURE'
printf '%s\n' "$vars" | grep -qx 'SMTP_CONNECTION_TIMEOUT_MS'
printf '%s\n' "$vars" | grep -qx 'SMTP_FROM'
printf '%s\n' "$vars" | grep -qx 'EMAIL_TRANSPORT'
printf '%s\n' "$vars" | grep -qx 'RENDER_SERVICE_ID'
printf '%s\n' "$secrets" | grep -qx 'DATABASE_URL'
printf '%s\n' "$secrets" | grep -qx 'DIRECT_DATABASE_URL'
printf '%s\n' "$secrets" | grep -qx 'RENDER_DEPLOY_HOOK_URL'
printf '%s\n' "$secrets" | grep -qx 'SMTP_USER'
printf '%s\n' "$secrets" | grep -qx 'SMTP_PASS'
printf '%s\n' "$secrets" | grep -qx 'BREVO_API_KEY'
printf '%s\n' "$secrets" | grep -qx 'RENDER_API_KEY'
printf '%s\n' "$secrets" | grep -qx 'VERCEL_TOKEN'
test "$(printf '%s\n' "$vars" | wc -l)" -eq 15
test "$(printf '%s\n' "$secrets" | wc -l)" -eq 8
! printf '%s\n' "$vars" | grep -qx 'SMTP_USER'
test "$(gh variable get SMTP_PORT --env production --repo raultorres2603/CubeClicker)" = "2525"
test "$(gh variable get SMTP_SECURE --env production --repo raultorres2603/CubeClicker)" = "false"
test "$(gh variable get SMTP_HOST --env production --repo raultorres2603/CubeClicker)" = "smtp-relay.brevo.com"
test "$(gh variable get SMTP_CONNECTION_TIMEOUT_MS --env production --repo raultorres2603/CubeClicker)" = "10000"
test "$(gh variable get EMAIL_TRANSPORT --env production --repo raultorres2603/CubeClicker)" = "brevo-api"
test "$(gh variable get MAX_USERS_PER_SERVER --env production --repo raultorres2603/CubeClicker)" = "10"
test "$(gh variable get SESSION_COOKIE_SECURE --env production --repo raultorres2603/CubeClicker)" = "true"
test "$(gh variable get SESSION_COOKIE_SAMESITE --env production --repo raultorres2603/CubeClicker)" = "none"
prod_frontend=$(grep -oE 'production frontend: https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T3.md | head -n1 | sed 's/^production frontend: //')
prod_api=$(grep -oE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T4.md | head -n1 | sed 's/^production api: //')
prod_service=$(grep -oE 'service id: srv-[A-Za-z0-9]+' docs/features/production-provisioning/build-log-T4.md | head -n1 | sed 's/^service id: //')
prod_project=$(grep -oE 'project id: prj_[A-Za-z0-9]+' docs/features/production-provisioning/build-log-T3.md | head -n1 | sed 's/^project id: //')
test -n "$prod_frontend"
test -n "$prod_api"
test -n "$prod_service"
test -n "$prod_project"
test "$(gh variable get FRONTEND_ORIGIN --env production --repo raultorres2603/CubeClicker)" = "$prod_frontend"
test "$(gh variable get VITE_API_URL --env production --repo raultorres2603/CubeClicker)" = "$prod_api"
test "$(gh variable get VITE_WS_URL --env production --repo raultorres2603/CubeClicker)" = "${prod_api/https:/wss:}/ws"
test "$(gh variable get RENDER_SERVICE_ID --env production --repo raultorres2603/CubeClicker)" = "$prod_service"
test "$(gh variable get VERCEL_PROJECT_ID --env production --repo raultorres2603/CubeClicker)" = "$prod_project"
grep -qE 'org id: [A-Za-z0-9_-]+' docs/features/production-provisioning/build-log-T3.md
gh api repos/raultorres2603/CubeClicker/environments/production --jq '.deployment_branch_policy.custom_branch_policies' | grep -qx true
gh api repos/raultorres2603/CubeClicker/environments/production/deployment-branch-policies --jq '.branch_policies[].name' | grep -qx main
test "$(gh api repos/raultorres2603/CubeClicker/environments/production/deployment-branch-policies --jq '.branch_policies | length')" -eq 1
if ! gh api repos/raultorres2603/CubeClicker/environments/production --jq '[.protection_rules[].type] | join(",")' | grep -q 'required_reviewers'; then grep -qF 'owner declined required reviewers' docs/features/production-provisioning/build-log-T5.md; fi
grep -qF 'development Environment unchanged' docs/features/production-provisioning/build-log-T5.md
grep -qF 'No builder command targeted development' docs/features/production-provisioning/build-log-T5.md
grep -qF 'development unchanged: PASS' docs/features/production-provisioning/build-log-T5.md
grep -qF 'production neon branch: br-floral-dream-zarerhtw' docs/features/production-provisioning/build-log-T5.md
grep -qE 'production vercel project: prj_[A-Za-z0-9]+ https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T5.md
grep -qE 'production render service: srv-[A-Za-z0-9]+ https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T5.md
grep -qF 'T5a complete' docs/features/production-provisioning/build-log-T5.md
test -z "$(git status --porcelain -- '.env*')"
test -z "$(git diff --name-only "$base" -- '.env*')"
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-T5.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-provisioning/build-log-T5.md
```
acceptance: AC-1(c), AC-1(d), AC-5, AC-6(b), AC-6(c)
status: [ ]

Populate the existing `production` Environment (do not create a new environment) with the 23-name catalog. T5 depends on T5a and remains blocked until T5a records `Phase A owner hand-off complete`; record `T5a complete` in this build log. Using the T1-recorded Neon/Vercel/Render list/get tools, re-read the development and production resources and record `development unchanged: PASS` plus the production branch/project/service lines; T8 re-runs the same reads. Builder-set variables: `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `MAX_USERS_PER_SERVER=10`, `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`, `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `SMTP_CONNECTION_TIMEOUT_MS=10000`, `EMAIL_TRANSPORT=brevo-api`, `RENDER_SERVICE_ID` (from T4). Builder-set secrets: `DATABASE_URL`, `DIRECT_DATABASE_URL` (from T2) and `RENDER_DEPLOY_HOOK_URL` only if T4 could read it; write secrets with `gh secret set` on stdin (mode-600 temp files under `/tmp/opencode`, shredded after use), never in an argument. Do **not** write `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY` or `SMTP_FROM`; they are supplied by T5a. Set the protection rules via `gh api`: `PUT /repos/raultorres2603/CubeClicker/environments/production` with body `{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true},"reviewers":[{"type":"User","id":<owner-user-id>}]}` (owner id from `gh api user --jq .id`), then `POST .../deployment-branch-policies` with `{"name":"main","type":"branch"}` (list first; a 409 means it exists). Read back names only and the protection JSON. If the owner declines required reviewers (or the single-owner gate cannot be approved), keep the `main` branch policy and record `owner declined required reviewers`; never remove the branch policy. Do not touch the `development` Environment; record the pre/post development names-only listings and the statement that no builder command targeted development. If a required name is missing, record it and stop; T6 stays blocked until T5 is green.

## T6a — Fix deploy CI preflight repository context `[seq]`
depends_on: T5
files_owned: `.github/workflows/deploy.yml`, `docs/features/production-provisioning/build-log-T6a.md`
verify:
```bash
set -euo pipefail
test -f docs/features/production-provisioning/build-log-T6a.md
pr_url=$(grep -oE 'PR: https://github.com/raultorres2603/CubeClicker/pull/[0-9]+' docs/features/production-provisioning/build-log-T6a.md | head -n1 | sed 's/^PR: //')
test -n "$pr_url"
pr_num=${pr_url##*/}
pr_diff=$(gh pr diff "$pr_num" --repo raultorres2603/CubeClicker || true)
test "$(printf '%s\n' "$pr_diff" | grep -cE '^[+-][^+-]')" -eq 2
printf '%s\n' "$pr_diff" | grep -qE '^\+.*gh run list --repo "\$GITHUB_REPOSITORY"'
! printf '%s\n' "$pr_diff" | grep -E '^[+-][^+-]' | grep -vE 'gh run list' | grep -q .
grep -qF 'gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion' .github/workflows/deploy.yml
test "$(grep -c 'gh run list' .github/workflows/deploy.yml)" -eq 1
grep -qF 'if [ "$conclusion" != "success" ]; then' .github/workflows/deploy.yml
grep -qF "if: github.event_name == 'workflow_dispatch'" .github/workflows/deploy.yml
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml
grep -qE 'PR: https://github.com/raultorres2603/CubeClicker/pull/[0-9]+' docs/features/production-provisioning/build-log-T6a.md
grep -qF 'diff: 1 added / 1 removed' docs/features/production-provisioning/build-log-T6a.md
grep -qF 'actionlint: pass' docs/features/production-provisioning/build-log-T6a.md
grep -qF 'dry-run: success' docs/features/production-provisioning/build-log-T6a.md
grep -qF 'owner merged' docs/features/production-provisioning/build-log-T6a.md
grep -qE 'merge commit: [0-9a-f]{7,12}' docs/features/production-provisioning/build-log-T6a.md
grep -qF 'No git push' docs/features/production-provisioning/build-log-T6a.md
```
acceptance: AC-8(e), AC-10(b)
status: [ ]

Owner-approved one-line workflow fix. Create `fix/deploy-ci-preflight` from `origin/main` through the GitHub MCP, change exactly the pre-checkout `gh run list` line in `Verify CI succeeded for target commit` to insert `--repo "$GITHUB_REPOSITORY"` immediately after `gh run list` (the resulting line begins `gh run list --repo "$GITHUB_REPOSITORY" --workflow CI ...`; the `--repo` form is the chosen implementation), commit the one-line change through the MCP and open the PR. Do **not** `git push`, do not bypass or change the guard condition, the step `if`, the step order, permissions, triggers or concurrency, and do not edit any other `deploy.yml` line or comment. The owner merges the PR to `main`; after the merge, run `gh run list --repo raultorres2603/CubeClicker --workflow CI --commit <merge-sha> --limit 1 --json conclusion --jq '.[0].conclusion'` (dry-run) and record its `success`. Record in `build-log-T6a.md`: `PR: <url>`, `diff: 1 added / 1 removed`, `actionlint: pass`, `dry-run: success`, `owner merged`, `merge commit: <short-sha>` (7–12 hex characters, never a full 40-character SHA), and `No git push`. The exact diff is the old `if ! conclusion=$(gh run list --workflow CI ...` line removed and the same line with `--repo "$GITHUB_REPOSITORY"` immediately after `gh run list` added.

## T6 — Live production deploy proof `[seq]`
depends_on: T6a
files_owned: `docs/features/production-provisioning/build-log-T6.md`
verify:
```bash
set -euo pipefail
test -f docs/features/production-provisioning/build-log-T6.md
grep -qE 'Fix PR: https://github.com/raultorres2603/CubeClicker/pull/[0-9]+' docs/features/production-provisioning/build-log-T6.md
grep -qE 'Fix commit: [0-9a-f]{7,12}' docs/features/production-provisioning/build-log-T6.md
run_id=$(grep -oE 'run_id=[0-9]+' docs/features/production-provisioning/build-log-T6.md | head -n1 | cut -d= -f2)
test -n "$run_id"
gh run view "$run_id" --repo raultorres2603/CubeClicker --json event,headBranch,conclusion --jq '[.event,.headBranch,.conclusion] | @tsv' | grep -qx $'workflow_dispatch\tmain\tsuccess'
gh run view "$run_id" --repo raultorres2603/CubeClicker --log > /tmp/opencode/prod-deploy.log
grep -qF "Deploy configuration OK: 11 value(s) present for the 'production' environment." /tmp/opencode/prod-deploy.log
for key in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_CONNECTION_TIMEOUT_MS SMTP_FROM SMTP_USER SMTP_PASS EMAIL_TRANSPORT BREVO_API_KEY; do grep -qF "SYNCED $key (value verified, not shown)" /tmp/opencode/prod-deploy.log; done
test "$(grep -cF '(value verified, not shown)' /tmp/opencode/prod-deploy.log)" -eq 9
grep -qF "Synced 9 value(s) to Render service" /tmp/opencode/prod-deploy.log
grep -qE 'healthz OK after [0-9]+s: \{"status":"ok"\}' /tmp/opencode/prod-deploy.log
grep -qF 'DEPLOYED SMOKE PASS (8/8 checks)' /tmp/opencode/prod-deploy.log
! grep -qF 'DEPLOYED SMOKE FAIL' /tmp/opencode/prod-deploy.log
grep -qE 'production frontend: https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T6.md
grep -qE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T6.md
prod_api=$(grep -oE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T6.md | head -n1 | sed 's/^production api: //')
test -n "$prod_api"
node -e "fetch('$prod_api/healthz').then(async r=>{const b=await r.text();if(r.status!==200||b!=='{\"status\":\"ok\"}')process.exit(1);console.log('HTTP 200',b)})"
grep -qF 'Neon migration' docs/features/production-provisioning/build-log-T6.md
grep -qE 'Render deploy: dep-[A-Za-z0-9]+ live' docs/features/production-provisioning/build-log-T6.md
grep -qE 'Vercel deployment: dpl_[A-Za-z0-9]+ (ready|aliased)' docs/features/production-provisioning/build-log-T6.md
grep -qF 'No rollback to development' docs/features/production-provisioning/build-log-T6.md
grep -qF 'No deletion of the existing Neon production branch' docs/features/production-provisioning/build-log-T6.md
grep -qF 'CI succeeded for' docs/features/production-provisioning/build-log-T6.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-provisioning/build-log-T6.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-T6.md
rm -f /tmp/opencode/prod-deploy.log
```
acceptance: AC-7, AC-8(c), AC-11
status: [ ]

Live proof, only after T5a/T5 are complete, T6a's one-line preflight fix is merged to `main`, and the 23 production names are present. Record `Fix PR: <url>` and `Fix commit: <short-sha>` from `build-log-T6a.md` in this build log. Verify the `main` SHA has a successful CI run (`gh run list --workflow CI --commit "$(git rev-parse origin/main)" --limit 1 --json conclusion --jq '.[0].conclusion'` = `success`), then re-run the same production dispatch `gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker`. Capture the new run id (compare `gh run list --workflow Deploy --event workflow_dispatch --limit 5` before/after) and record `run_id=<id>` in the build log. If the job pauses for the `production` environment, the owner approves it in the GitHub UI; if self-approval is refused, apply the Q-4 fallback (keep the branch policy, remove reviewers or add a second reviewer) and record the deviation. Poll `gh run view <id>`; on failure, capture the exact failing step and the exact guard block (if the guard failed, no provider was touched), fix the value and re-run; never bypass the guard. On success, capture the exact guard line, the nine `SYNCED` lines, the summary, the exact `healthz OK after <n>s: {"status":"ok"}` line and `DEPLOYED SMOKE PASS (8/8 checks)`; record the Render deploy ID/status, the Vercel deployment ID and a post-run `/healthz` 200. Record these exact evidence lines in `build-log-T6.md`: `Fix PR: <url>`, `Fix commit: <short-sha>`, `run_id=<id>`, `CI succeeded for <commit>`, `Neon migration: <n> applied`, `Sync: 9 SYNCED`, `production frontend: <url>`, `production api: <url>`, `Render deploy: dep-<id> live`, `Vercel deployment: dpl_<id> <ready|aliased>`, `POST-RUN HEALTH 200`, `DEPLOYED SMOKE PASS (8/8 checks)`, `No rollback to development`, and `No deletion of the existing Neon production branch`. Do not print the full log; grep the required lines and delete the temp log. If the deploy fails after the migration, follow the partial-failure/cleanup rules: fix forward; do not roll back to development; only before the live deploy is green may the owner approve deleting/suspending the new Render/Vercel resources; the existing Neon branch is never deleted.

## T7 — Documentation and proposed feature-index row `[seq]`
depends_on: T6
files_owned: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/email.md`, `docs/architecture/observability.md`, `AGENTS.md`, `docs/features/production-provisioning/build-log-T7.md`
verify:
```bash
set -euo pipefail
base=$(git merge-base origin/main HEAD)
npm ci
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1)throw new Error('render.yaml must declare exactly one service');const s=b.services[0];if(s.name!=='cubeclicker-development'||s.runtime!=='docker'||s.plan!=='free')throw new Error('render.yaml must describe the cubeclicker-development docker service on the free plan');if(s.healthCheckPath!==undefined&&s.healthCheckPath!=='')throw new Error('render.yaml must not declare a platform health check');console.log('render.yaml: valid YAML (one development service, unchanged)')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const w=yaml.load(fs.readFileSync('.github/workflows/deploy.yml','utf8'));const t=(w.on&&typeof w.on==='object')?w.on:w[true];const i=t.workflow_dispatch.inputs.environment;if(JSON.stringify(i.options)!==JSON.stringify(['production','development'])||i.default!=='production'||i.type!=='choice'||i.required!==true)throw new Error('dispatch choices changed');const d=w.jobs.deploy;const expectedIf=\"github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')\";if(d.if!==expectedIf)throw new Error('deploy job condition changed');const ref=d.steps.find(s=>s.name==='Checkout').with.ref;if(ref!==String.fromCharCode(36)+'{{ github.event.workflow_run.head_sha || github.sha }}')throw new Error('checkout ref changed');if(Object.keys(w.jobs).length!==1)throw new Error('deploy must keep one job');console.log('deploy.yml: dispatch choices, automatic path and job count unchanged')"
grep -qF 'production-provisioning | Production Environment Provisioning | accepted | 2026-11-27' docs/features/production-provisioning/build-log-T7.md
grep -qF 'Production resources use the base name `cubeclicker` with no environment token' README.md
grep -qF 'the GitHub Environment `production` and the Neon branch `production` are environment identifiers' docs/architecture/deployment.md
grep -qE 'Render service `cubeclicker(-game)?`' docs/architecture/vercel-render-neon.md
grep -qE 'https://cubeclicker(-game)?\.onrender\.com' docs/architecture/vercel-render-neon.md
grep -qE 'Vercel project `cubeclicker(-game)?`' docs/architecture/vercel-render-neon.md
grep -qE 'https://cubeclicker(-game)?\.vercel\.app' docs/architecture/vercel-render-neon.md
grep -qF 'Neon `production` branch' docs/architecture/vercel-render-neon.md
grep -qF '23 names (15 variables, 8 secrets)' docs/architecture/deployment.md
grep -qF '23 names (15 variables, 8 secrets)' docs/architecture/vercel-render-neon.md
grep -qF 'eleven validated, nine synced' docs/architecture/deployment.md
grep -qF '`main`-only deployment branch policy' docs/architecture/deployment.md
grep -qF 'required reviewers' docs/architecture/deployment.md
grep -qF 'gh workflow run deploy.yml --ref main -f environment=production' docs/architecture/vercel-render-neon.md
grep -qF 'DEPLOYED SMOKE PASS (8/8 checks)' docs/architecture/vercel-render-neon.md
grep -qF 'two free Render services share' docs/architecture/vercel-render-neon.md
grep -qF '750' docs/architecture/vercel-render-neon.md
grep -qF 'Vercel Hobby is non-commercial' docs/architecture/vercel-render-neon.md
grep -qF 'The Neon `production` branch is not protected on the free plan' docs/architecture/vercel-render-neon.md
ledger='`production-provisioning` — **in force**; supersedes the production-unprovisioned/placeholder-only statements; retains the manual trigger, guard, sync, catalog and development path'
grep -qF "$ledger" docs/architecture/deployment.md
grep -qF "$ledger" docs/architecture/vercel-render-neon.md
grep -qF 'No rollback to development' docs/architecture/deployment.md
grep -qF 'The production environment is provisioned and uses the same Brevo HTTPS API transport' docs/architecture/email.md
grep -qF 'Each deployed Render service sets `METRICS_ENABLED=false`' docs/architecture/observability.md
! grep -qF 'for the development service' docs/architecture/observability.md
grep -qF 'production is manual (`workflow_dispatch`) and provisioned' AGENTS.md
! grep -qF 'production is manual (`workflow_dispatch`) and unprovisioned' AGENTS.md
! grep -qF 'production intended, not provisioned' README.md
! grep -qF 'production` is **not provisioned**' README.md
! grep -qF 'no Render service, Vercel project or Neon branch is provisioned' README.md
! grep -qF 'no protection rules are configured' README.md
! grep -qF 'no live production environment is modified' README.md
! grep -qF '# production (placeholder-only)' README.md
! grep -qF 'the production `587` is placeholder-only' README.md
! grep -qF 'Production remains unprovisioned' README.md
! grep -qF 'Production is `placeholder-only`' README.md
! grep -qF 'production stays placeholder-only until then' README.md
! grep -qF 'The production column is a code/documentation catalog' README.md
! grep -qF 'six pinned placeholders' README.md
! grep -qF 'production is unprovisioned' README.md
! grep -qF 'production is not provisioned' docs/architecture/deployment.md
! grep -qF 'not provisioned (a Neon `production` branch is the intended target)' docs/architecture/deployment.md
! grep -qF 'one `development` branch today (production intended)' docs/architecture/deployment.md
! grep -qF '| not provisioned |' docs/architecture/deployment.md
! grep -qF 'none configured: no protection rules and no deployment branch policy yet' docs/architecture/deployment.md
! grep -qF 'has no protection rules yet' docs/architecture/deployment.md
! grep -qF 'six pinned placeholders' docs/architecture/deployment.md
! grep -qF 'the live production Environment is unchanged' docs/architecture/deployment.md
! grep -qF 'reviewer/branch protection must be added when it is provisioned' docs/architecture/deployment.md
! grep -qF 'production is manual (workflow_dispatch) and unprovisioned' docs/architecture/deployment.md
! grep -qF 'Production (`placeholder-only`)' docs/architecture/deployment.md
! grep -qF 'production is not provisioned on the free plan' docs/architecture/deployment.md
! grep -qF 'production manual and unprovisioned' docs/architecture/deployment.md
! grep -qF 'production` is **not provisioned**' docs/architecture/vercel-render-neon.md
! grep -qF '`production` (not provisioned)' docs/architecture/vercel-render-neon.md
! grep -qF '`production` (not provisioned, manual only)' docs/architecture/vercel-render-neon.md
! grep -qF 'no protection rules and no deployment branch policy' docs/architecture/vercel-render-neon.md
! grep -qF 'has no protection rules yet' docs/architecture/vercel-render-neon.md
! grep -qF 'six pinned placeholders' docs/architecture/vercel-render-neon.md
! grep -qF 'no Render service, Vercel project or Neon branch is provisioned' docs/architecture/vercel-render-neon.md
! grep -qF 'until then, production is also not provisioned' docs/architecture/vercel-render-neon.md
! grep -qF 'names stay `placeholder-only`' docs/architecture/vercel-render-neon.md
! grep -qF 'production is manual, unprovisioned and `placeholder-only`' docs/architecture/vercel-render-neon.md
! grep -qF 'currently unprovisioned' docs/architecture/vercel-render-neon.md
! grep -qF 'production is unprovisioned' docs/architecture/vercel-render-neon.md
! grep -qF 'production manual and unprovisioned' docs/architecture/vercel-render-neon.md
! grep -qF 'no protection configured' docs/architecture/vercel-render-neon.md
! grep -qF 'production stays `placeholder-only`' docs/architecture/vercel-render-neon.md
! grep -qF 'why production is not provisioned on the free plan' docs/architecture/vercel-render-neon.md
! grep -qF 'The only Vercel project is the development project' docs/architecture/vercel-render-neon.md
! grep -qF 'a future production project must make its own protection decision' docs/architecture/vercel-render-neon.md
! grep -qF 'GitHub Environment (`placeholder-only`; not provisioned)' docs/architecture/vercel-render-neon.md
! grep -qF 'one project (`development`)' docs/architecture/vercel-render-neon.md
! grep -qF 'production branch when provisioned' docs/architecture/vercel-render-neon.md
! grep -qF '| not provisioned |' docs/architecture/vercel-render-neon.md
! grep -qF 'The production column is a code/documentation catalog' docs/architecture/email.md
! grep -qF 'not a live-environment claim' docs/architecture/email.md
! grep -qF 'no live production environment is modified' docs/architecture/email.md
pr_url=$(grep -oE 'PR: https://github.com/raultorres2603/CubeClicker/pull/[0-9]+' docs/features/production-provisioning/build-log-T6a.md | head -n1 | sed 's/^PR: //')
test -n "$pr_url"
pr_num=${pr_url##*/}
non_comment=$(gh pr diff "$pr_num" --repo raultorres2603/CubeClicker || true)
test "$(printf '%s\n' "$non_comment" | grep -cE '^[+-][^+-]')" -eq 2
printf '%s\n' "$non_comment" | grep -qE '^\+.*gh run list --repo "\$GITHUB_REPOSITORY"'
! printf '%s\n' "$non_comment" | grep -E '^[+-][^+-]' | grep -vE 'gh run list' | grep -q .
grep -qE 'link: .+ -> .+: OK' docs/features/production-provisioning/build-log-T7.md
! grep -qF 'VERCEL_TOKEN=|RENDER_DEPLOY_HOOK_URL=|RENDER_API_KEY=|FLY_API_TOKEN=|FlyV1 ' docs/architecture/deployment.md
grep -qF 'VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN' docs/architecture/deployment.md
grep -qF "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/architecture/deployment.md
grep -qF 'FlyV1 [A-Za-z0-9_-]{20,}' docs/architecture/deployment.md
test -z "$(git status --porcelain -- docs/features/README.md docs/features/production-provisioning/status.md)"
test -z "$(git diff --name-only "$(git merge-base origin/main HEAD)" -- docs/features/README.md)"
test -z "$(git status --porcelain -- '.env*')"
! grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[0-9a-f]{32,}' docs/features/production-provisioning/build-log-T7.md
! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" -- .
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-T7.md
```
acceptance: AC-9, AC-10(b)
status: [ ]

Update the docs to the live production state, minimally and without rewriting unaffected sections:

Pinned positive strings (write them verbatim; the verify greps them exactly): README `Production resources use the base name `cubeclicker` with no environment token`; `deployment.md` `the GitHub Environment `production` and the Neon branch `production` are environment identifiers`, `23 names (15 variables, 8 secrets)`, `eleven validated, nine synced`, `` `main`-only deployment branch policy ``, `required reviewers`, `No rollback to development`, `production-provisioning`; `vercel-render-neon.md` `Render service `cubeclicker`` and `https://cubeclicker.onrender.com` (or the `cubeclicker-game` fallback), `Vercel project `cubeclicker`` and `https://cubeclicker.vercel.app` (or the fallback), `Neon `production` branch`, `23 names (15 variables, 8 secrets)`, `gh workflow run deploy.yml --ref main -f environment=production`, `DEPLOYED SMOKE PASS (8/8 checks)`, `two free Render services share`, `750`, `Vercel Hobby is non-commercial`, `The Neon `production` branch is not protected on the free plan`, `production-provisioning`; `email.md` `The production environment is provisioned and uses the same Brevo HTTPS API transport`; `observability.md` `Each deployed Render service sets `METRICS_ENABLED=false``; `AGENTS.md` `production is manual (`workflow_dispatch`) and provisioned`. The exact negative greps below include `six pinned placeholders` and `has no protection rules yet`; remove those phrases from every current-state sentence. For every docs grep, record `PASS`/`FAIL` and the pattern, never the matched line, so no address or token enters the build log.

- **`README.md`** — the production bullet becomes provisioned: the production Render service `cubeclicker`, Vercel project `cubeclicker`, Neon `production` branch, the 23-name catalog (15 variables, 8 secrets), the `main`-only branch policy, required reviewers, the manual command `gh workflow run deploy.yml --ref main -f environment=production` (from `main`, CI-preflighted, approval-gated), the no-`-production`-suffix rule, and the live proof. Include the pinned sentence `Production resources use the base name `cubeclicker` with no environment token`. Update the deployment table, the user-side asset checklist, the Brevo runbook production column/statements (production `SMTP_PORT=2525`/`SMTP_SECURE=false`, no longer `# production (placeholder-only)` or `the production `587` is placeholder-only`), the documented-not-run email asset note, and the registration-recovery closing line. State that production is live and no live production environment is "unmodified".
- **`docs/architecture/deployment.md`** — fill the production column of § Environments and triggers (Vercel project/domain, Render service/ID, Neon branch/ID, protection rules, concurrency); replace every `not provisioned`/`placeholder-only`/`no protection` sentence; update § Secrets and variables to the 23-name catalog and the 11-name guarded/9-name synced split; update § Deploy pipeline (production is provisioned and protected; the only workflow change is the T6a one-line preflight fix); update § Neon migrations (the production branch exists, is migrated and zero-data, free-plan unprotected); § DNS/cookies (platform-default production hosts, `SameSite=None`/`Secure`); § Single-instance trade-off (the production free instance spins down; the 750 h budget is shared); § Security (production values are live; the credential posture is unchanged) and replace the canonical bare token audit `VERCEL_TOKEN=|RENDER_DEPLOY_HOOK_URL=|RENDER_API_KEY=|FLY_API_TOKEN=|FlyV1 ` with the retained-verbatim canonical Fly/Vercel/Render coverage plus the credential-shaped `(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=["']?[A-Za-z0-9+/_-]{12,}` pattern and the `FlyV1 [A-Za-z0-9_-]{20,}` key shape, plus documented `docs/`/test-file exclusions; the wording must state the canonical audit is retained verbatim from `workflow-hygiene` (Vercel/Render/Fly) while the credential-shaped pattern adds Brevo/SMTP; that pattern must return no matches on the current tree; the historical AWS table row `production manual and unprovisioned`; and the supersession ledger with the exact row `` `production-provisioning` — **in force**; supersedes the production-unprovisioned/placeholder-only statements; retains the manual trigger, guard, sync, catalog and development path ``. Add the `production-provisioning` ledger row, the no-rollback-to-development and no-Neon-branch-deletion rules, and the T6a preflight-fix note (`gh run list --repo "$GITHUB_REPOSITORY"`, pre-checkout reason, guard/automatic path unchanged).
- **`docs/architecture/vercel-render-neon.md`** — update the provisioned-identity table, § Architecture (two Vercel projects, two Render services, two Neon branches; production deploy flow), § Environment catalog: rewrite the `production` section as provisioned with the 23 names/values/classifications, and add the production Vercel project/Render service/Neon branch sections; update § Runbook one-time prerequisites, add `### Production provisioning (completed)` and `### Routine production deploy`; replace `### Promote to production (currently unprovisioned)` with the live promote runbook; update § Verification commands, § Troubleshooting (production guard/protection/approval entries), § Email transport (production is live on the API transport), § Rollback (production resources; no rollback to development; no Neon branch deletion), § Local development vs cloud (fill the production column), § Cost and limits (two free Render services/750 h, Vercel Hobby non-commercial, Neon free unprotected; write `a single Neon project` rather than the literal `one project`), and the supersession ledger with the exact row `` `production-provisioning` — **in force**; supersedes the production-unprovisioned/placeholder-only statements; retains the manual trigger, guard, sync, catalog and development path ``.
- **`docs/architecture/email.md`** — replace the production "code/documentation catalog, not a live-environment claim" paragraph with the provisioned state: production is live, uses `EMAIL_TRANSPORT=brevo-api` + a REST API key + the verified sender, and the production values live in the `production` Environment; keep the transport contract, events, rotation and redaction sections unchanged.
- **`docs/architecture/observability.md`** — update the deployed default-off sentence from "the development service" to each deployed Render service (development and production) and note the production service carries `METRICS_ENABLED=false`; no metric/event change.
- **`AGENTS.md`** — replace `production is manual (workflow_dispatch) and unprovisioned` with `production is manual (workflow_dispatch) and provisioned behind the production Environment's protection`; keep the `main`-only/no-`develop` statements.
- **`.github/workflows/deploy.yml`** — owned by T6a; do not edit it in T7. Verify the T6a PR diff contains exactly one added and one removed non-comment line, the added line is the T6a `gh run list --repo "$GITHUB_REPOSITORY"` fix, and no guard condition, step `if`, step order, permission, trigger/concurrency line or other non-comment line changed. The deployment docs must record the preflight fix and why the pre-checkout step needs `--repo`; the automatic `workflow_run` path stays unchanged and the two stale comments remain as-is (comment edits are dropped from this amendment).
- Record the proposed feature-index row `production-provisioning | Production Environment Provisioning | accepted | 2026-11-27` in `build-log-T7.md`; do not edit `docs/features/README.md` or `status.md`. Check that every relative link added or changed in the edited docs resolves to an existing file (read the target; no link checker is installed) and record one `link: <source> -> <target>: OK` line per edited link in the build log. Record the docs greps, the actionlint/parse output, the one-line deploy diff proof, the link check and the credential audit. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build` and `npm run smoke` as the no-regression gate (no application code changed; the coverage thresholds stay 80).

## T8 — Verify & integrate `[seq]`
depends_on: T7
files_owned: `docs/features/production-provisioning/build-log-T8.md`
verify:
```bash
set -euo pipefail
base=$(git merge-base origin/main HEAD)
npm ci
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
npm run smoke
git diff --exit-code "$(git merge-base origin/main HEAD)" -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1||b.services[0].name!=='cubeclicker-development')throw new Error('render.yaml changed');console.log('render.yaml: one development service, unchanged')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const w=yaml.load(fs.readFileSync('.github/workflows/deploy.yml','utf8'));const t=(w.on&&typeof w.on==='object')?w.on:w[true];const i=t.workflow_dispatch.inputs.environment;if(JSON.stringify(i.options)!==JSON.stringify(['production','development'])||i.default!=='production'||i.type!=='choice'||i.required!==true)throw new Error('dispatch choices changed');const d=w.jobs.deploy;const expectedIf=\"github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')\";if(d.if!==expectedIf)throw new Error('deploy job condition changed');const ref=d.steps.find(s=>s.name==='Checkout').with.ref;if(ref!==String.fromCharCode(36)+'{{ github.event.workflow_run.head_sha || github.sha }}')throw new Error('checkout ref changed');if(Object.keys(w.jobs).length!==1)throw new Error('deploy must keep one job');console.log('deploy.yml: dispatch choices, automatic path and job count unchanged')"
pr_url=$(grep -oE 'PR: https://github.com/raultorres2603/CubeClicker/pull/[0-9]+' docs/features/production-provisioning/build-log-T6a.md | head -n1 | sed 's/^PR: //')
test -n "$pr_url"
pr_num=${pr_url##*/}
deploy_diff=$(gh pr diff "$pr_num" --repo raultorres2603/CubeClicker || true)
test "$(printf '%s\n' "$deploy_diff" | grep -cE '^[+-][^+-]')" -eq 2
printf '%s\n' "$deploy_diff" | grep -qE '^\+.*gh run list --repo "\$GITHUB_REPOSITORY"'
! printf '%s\n' "$deploy_diff" | grep -E '^[+-][^+-]' | grep -vE 'gh run list' | grep -q .
grep -qF 'if [ "$conclusion" != "success" ]; then' .github/workflows/deploy.yml
grep -qF "if: github.event_name == 'workflow_dispatch'" .github/workflows/deploy.yml
prod_frontend=$(grep -oE 'production frontend: https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T6.md | head -n1 | sed 's/^production frontend: //')
prod_api=$(grep -oE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T6.md | head -n1 | sed 's/^production api: //')
test -n "$prod_frontend"
test -n "$prod_api"
SMOKE_FRONTEND_URL="$prod_frontend" SMOKE_API_URL="$prod_api" SMOKE_WS_URL="${prod_api/https:/wss:}/ws" SMOKE_ORIGIN="$prod_frontend" SMOKE_TIMEOUT_MS=20000 node tests/e2e/deployed-smoke.mjs > /tmp/opencode/prod-smoke.log
grep -qF 'DEPLOYED SMOKE PASS (8/8 checks)' /tmp/opencode/prod-smoke.log
rm -f /tmp/opencode/prod-smoke.log
test -f docs/features/production-provisioning/build-log-T8.md
grep -qF 'DEPLOYED SMOKE PASS (8/8 checks)' docs/features/production-provisioning/build-log-T8.md
grep -qE 'Fix PR: https://github.com/raultorres2603/CubeClicker/pull/[0-9]+' docs/features/production-provisioning/build-log-T8.md
grep -qE 'Fix commit: [0-9a-f]{7,12}' docs/features/production-provisioning/build-log-T8.md
grep -qF "Deploy configuration OK: 11 value(s) present for the 'production' environment." docs/features/production-provisioning/build-log-T8.md
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture EMAIL_TRANSPORT=brevo-api BREVO_API_KEY=fixture-key npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 11 value(s) present for the 'development' environment."
code=0; out=$(env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' EMAIL_TRANSPORT=brevo-api BREVO_API_KEY='<CHANGEME-brevo-api-key>' npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only) || code=$?; test "$code" -eq 1; printf '%s\n' "$out" | grep -qx "Deploy blocked: the 'production' environment has 6 unset or placeholder value(s)."
grep -qF 'No application code change' docs/features/production-provisioning/build-log-T8.md
grep -qF 'npm run coverage' docs/features/production-provisioning/build-log-T8.md
grep -qF 'No rollback to development' docs/features/production-provisioning/build-log-T8.md
grep -qF 'No deletion of the existing Neon production branch' docs/features/production-provisioning/build-log-T8.md
grep -qF 'development unchanged: PASS' docs/features/production-provisioning/build-log-T8.md
grep -qF 'production neon branch: br-floral-dream-zarerhtw' docs/features/production-provisioning/build-log-T8.md
grep -qE 'production vercel project: prj_[A-Za-z0-9]+ https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T8.md
grep -qE 'production render service: srv-[A-Za-z0-9]+ https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T8.md
grep -qE 'production frontend: https://cubeclicker(-game)?\.vercel\.app' docs/features/production-provisioning/build-log-T8.md
grep -qE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-provisioning/build-log-T8.md
grep -qF 'production github names: 15 variables / 8 secrets' docs/features/production-provisioning/build-log-T8.md
grep -qE 'healthz OK after [0-9]+s: \{"status":"ok"\}' docs/features/production-provisioning/build-log-T8.md
stale=$(grep -RniE 'not provisioned|unprovisioned|placeholder-only|future production|one project|six pinned placeholders|has no protection rules yet' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md docs/architecture/email.md docs/architecture/observability.md AGENTS.md | grep -vEi 'historical|archived|superseded|it is not provisioned' || true)
test -z "$stale"
grep -qF 'stale-production-scan: PASS' docs/features/production-provisioning/build-log-T8.md
grep -qF 'allowlist: historical AWS/Fly only' docs/features/production-provisioning/build-log-T8.md
grep -qF 'production-provisioning | Production Environment Provisioning | accepted | 2026-11-27' docs/features/production-provisioning/build-log-T8.md
test -z "$(git status --porcelain -- docs/features/README.md docs/features/production-provisioning/status.md)"
test -z "$(git status --porcelain -- '.env*')"
! grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[0-9a-f]{32,}' docs/features/production-provisioning/build-log-*.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/production-provisioning/build-log-*.md
! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}" -- .
! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}"
! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}"
! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}"
! git grep -qE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'
! git grep -qE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" -- .github infra src ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx'
! git grep -qE "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}" -- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts'
! git grep --untracked -qE "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}" -- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts'
! git diff origin/main...HEAD -- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts' | grep -qE "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}"
! git log -p origin/main..HEAD -- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts' | grep -qE "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-provisioning/build-log-T8.md
```
acceptance: AC-1–AC-12
status: [ ]

Final verification and integration. Re-run the full gate (lint, typecheck, tests, `npm run coverage`, build, local smoke, actionlint, the vercel/render parses, the dispatch parse, the two Brevo guard fixtures, the credential-shaped audit including the retained `FLY_API_TOKEN`/`FlyV1` coverage, and the feature build-log guard). Assert the T6a PR diff is exactly the one-line fix (`gh run list --repo "$GITHUB_REPOSITORY"` before `--workflow CI`), with no guard condition, step `if`, step order, permission, trigger/concurrency or other non-comment change; the automatic `workflow_run` path stays unchanged. The credential-shaped audit must return no matches on the current tree (planning dry-check: no matches, including no Fly token). Record fixture results and exact output lines, never the fixture command lines; use `<address>` in any quoted command, so the address guard passes. Reproduce the live proof from `build-log-T6.md`: the fix PR/commit, the run URL, the exact guard line, the nine `SYNCED` lines, the exact `healthz OK after <n>s: {"status":"ok"}` line, `/healthz` 200 and `DEPLOYED SMOKE PASS (8/8 checks)`; re-run the deployed smoke against the anchored `production frontend:`/`production api:` lines (guest-only, no account/email). Record `Fix PR: <url>` and `Fix commit: <short-sha>`. Record the provider/development read-backs using the T1-recorded tools and these exact lines: `development unchanged: PASS`, `production neon branch: br-floral-dream-zarerhtw`, `production vercel project: <prj-id> <url>`, `production render service: <srv-id> <url>`, `production github names: 15 variables / 8 secrets`, plus the development Neon/Vercel/Render/GitHub post-read-backs proving it was untouched. Run the final stale-production scan over `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/email.md`, `docs/architecture/observability.md` and `AGENTS.md` for `not provisioned|unprovisioned|placeholder-only|future production|one project|six pinned placeholders|has no protection rules yet`; use `a single Neon project` rather than the literal `one project` in current-state prose; the historical AWS/Fly allowlist filters `historical|archived|superseded|it is not provisioned`; record `stale-production-scan: PASS` and `allowlist: historical AWS/Fly only`. Record `No deletion of the existing Neon production branch`. Confirm no application code, test, migration, Dockerfile, compose, package or lockfile change; state `No application code change; npm run coverage is not a feature target but is run to prove no regression (thresholds ≥ 80% per workspace)`. Confirm the `development` Environment/resources are unchanged and no production auto-deploy exists. Record `No rollback to development`. Record the proposed feature-index row for the orchestrator. Do not edit `status.md` or `docs/features/README.md`. Report the Subagent Report: status, artifacts, evidence summary (exact commands/lines), open questions and next recommendation.
