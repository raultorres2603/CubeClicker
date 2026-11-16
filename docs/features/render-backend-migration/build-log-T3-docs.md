# Build log — T3 — Render docs, environment catalog, Fly supersession

Task: T3 (2026-11-16, completed 2026-11-16)
Files changed: `render.yaml`, `infra/archive/fly/README.md`, `infra/archive/fly/fly.config.toml` (moved from `fly.config.toml`), `infra/archive/fly/mailpit.toml` (moved from `infra/fly/mailpit.toml`), `.github/workflows/ci.yml`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/vercel-fly-neon.md`, `docs/architecture/{stack,containerization,observability}.md`, `README.md`, `AGENTS.md`, `infra/README.md`, this log.

What changed & why (sketch):
1. Commit the live Render free service as a reproducible `render.yaml` (documentation, not a Blueprint sync).
2. Archive the Fly configs under `infra/archive/fly/` with a SUPERSEDED banner; no deletion.
3. Make `verify-workflows` parse `render.yaml` and keep the no-Fly deploy guard.
4. Rewrite the deployment docs and README to Vercel + Render + Neon; keep `podman compose up` untouched.
5. Add the environment catalog (names only), runbook, rollback and cost/limits reference.

## Decisions

1. **`render.yaml` is documentation/reproducibility, not a deployment trigger.** The service already exists (`srv-dbtcvv9srm7s73au5bag`); uncommenting/pointing a Blueprint at it would offer to create or adopt a service and could start a build. The file header states this. No Blueprint sync was triggered; no live Render/Vercel/Neon resource was touched.
2. **`js-yaml` from the locked eslint tree, no new dependency.** `verify-workflows` parses `render.yaml` with `require('js-yaml')`, which arrives transitively with `eslint@9.39.5` (`@eslint/eslintrc` → `js-yaml@4.3.2`) and is installed by `npm ci`. Adding a direct dependency would need user approval; the workflow comment records the provenance and the step fails loudly if it ever disappears.
3. **No `develop` branch.** The remote has only `main`; Render tracks `main`, `ci.yml` accepts `develop` pushes for future use, and `deploy.yml` deploys development from `main` via `workflow_run`. Docs state this instead of the stale `develop`-based model.
4. **Fly archived, not deleted.** `git mv` preserves history for both configs; `infra/archive/fly/README.md` carries the SUPERSEDED banner (credit-card gate, Render free selected, files not deployed, Fly apps have zero machines, deletion is user-owned).
5. **SMTP guest-only in development.** Render free has no private services, so the Fly `.internal` Mailpit design does not port. The docs record that development email delivery is not relied on and the SMTP values are placeholders; no secret value is named.
6. **Production is unprovisioned and manual.** Only `development` has a live Render service, Vercel project and Neon branch. Production is `workflow_dispatch`-only, reviewer-gated, and fails until its own assets and catalog are provisioned.
7. **`CORS_ORIGIN`/`ALLOWED_ORIGIN`/`APP_BASE_URL` are static Render service variables.** The old workflow derived them; the current one does not. The docs say they must equal `FRONTEND_ORIGIN` and that changing the origin is a Render variable change plus a workflow variable change.
8. **One small extension beyond the enumerated docs:** `infra/README.md` still said the AWS tree is superseded by "Vercel + Fly.io + Neon". Since this task owns the Fly supersession and the archive is linked from that area, the two stale lines were updated to Vercel + Render + Neon. No other out-of-scope edit.

## Evidence

### Workflow lint and static checks (final tree)

```
$ podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
actionlint_exit=0

$ node -e "<render.yaml parse + shape assertions from ci.yml verify-workflows>"
services=1
name=cubeclicker-development runtime=docker plan=free region=frankfurt branch=main
dockerfilePath=./src/backend/Dockerfile dockerContext=. healthCheckPath=/healthz autoDeployTrigger=off
nonSecret=NODE_ENV=production,HOST=0.0.0.0,PORT=8080,METRICS_ENABLED=false,MAX_USERS_PER_SERVER=10
syncFalse=DATABASE_URL,DIRECT_DATABASE_URL,CORS_ORIGIN,ALLOWED_ORIGIN,APP_BASE_URL,SESSION_COOKIE_SECURE,SESSION_COOKIE_SAMESITE,SMTP_HOST,SMTP_PORT,SMTP_USER,SMTP_PASS,SMTP_FROM

$ same command as the committed verify-workflows step
render.yaml: valid YAML (cubeclicker-development, docker, /healthz)
render_check_exit=0

$ no-Fly deploy guard (same command as the committed step)
no Fly references in deploy.yml
fly_guard_exit=0
```

### File, heading and link checks (final tree)

```
$ test -f <each required path>
ok render.yaml
ok infra/archive/fly/README.md
ok infra/archive/fly/fly.config.toml
ok infra/archive/fly/mailpit.toml
ok docs/architecture/vercel-render-neon.md
ok docs/architecture/deployment.md
ok docs/architecture/vercel-fly-neon.md
infra/fly removed

$ grep -qxF "<required heading>" docs/architecture/vercel-render-neon.md
ok ## Architecture
ok ## Environment catalog
ok ## Runbook
ok ## Rollback
ok ## Local development vs cloud
ok ## Cost and limits

$ node -e "<relative link scan over the 11 touched docs>"
links_checked=25 broken=0
linkcheck_exit=0
```

### Repository gates

```
$ npm test -w @cubeclicker/frontend
 Test Files  74 passed (74)
      Tests  2248 passed (2248)
frontend_test_exit=0

$ npx --no-install vitest run --root src/frontend src/docs/links.test.ts
 ✓ src/docs/links.test.ts (1 test) 3ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
docs_test_exit=0

$ npm run lint
lint_exit=0

$ npm run typecheck
typecheck_exit=0

$ npm run coverage
 Test Files  37 passed (37)
      Tests  1507 passed (1507)
All files          |   96.15 |    89.81 |   99.57 |   96.15 |
 Test Files  74 passed (74)
      Tests  2248 passed (2248)
All files          |   96.63 |    96.35 |   97.8 |   96.63 |
coverage_exit=0
```

Coverage thresholds are 80 on statements/branches/functions/lines per workspace; both workspaces clear them. No application source changed in this task (docs, YAML and workflow config only), so coverage and behavior are unaffected; the numbers are the whole-repository gate and were re-run for the final state.

### Commit contents

The commit stages exactly the T3 set (see § Acceptance audit). `docs/features/render-backend-migration/status.md` stays modified in the working tree (orchestrator-owned) and `docs/features/README.md` was never edited.

## Acceptance audit (task steps)

- Step 1 — `git status --porcelain=v1 -uall` and `git diff --check` → met (changed set = T3 docs/config/archive + the untracked build log; `diff_check_exit=0`; `status.md` left unstaged).
- Step 2 — build log with evidence, decisions, proposed index row and source-comment backlog → met (this file).
- Step 3 — stage exactly the listed paths, excluding `status.md` and `docs/features/README.md` → met (verify with `git show --stat --oneline HEAD`).
- Step 4 — commit `docs: document render deployment`, no push → met (one commit on `main` with that message; its SHA is reported in the Subagent Report; no `git push` run).
- Step 5 — verify commit contents and report `git show --stat --oneline HEAD` → met (see report).
- `render.yaml` matches the live service: name, runtime, Dockerfile path/context, plan, region, branch, health path, auto-deploy off, 5 non-secret values, 12 `sync: false` names → met.
- Fly files moved with `git mv` (rename detection) and a SUPERSEDED README added; nothing deleted → met.
- `ci.yml` validates `render.yaml` and keeps the no-Fly guard; no Fly re-added → met (actionlint + both step commands).
- `deployment.md` rewritten for Vercel + Render + Neon; `vercel-render-neon.md` has the six required sections and covers spin-down/cold start, WS reconnect, 750 h, Vercel Hobby/SSO/Node 24/root, Neon free branch + unprotected production deviation, names-only `development` catalog, production unprovisioned/manual, SMTP guest-only, no Mailpit on Render free, CI-once → deploy-after-CI → met (content review + heading checks).
- SUPERSEDED banner on `vercel-fly-neon.md` linking the new doc → met.
- README, AGENTS.md and stack/containerization/observability Fly references updated; `podman compose up` untouched → met (`grep -rn -E "Fly|FLY_|fly\.config|flyctl"` over the touched docs shows only historical/supersession mentions; no workflow or compose change).
- actionlint, `test -f`/heading/link checks, frontend test → met (raw output above).
- No secrets, no paid resources, no Fly deployment, no live-resource changes → met (names only; no commands against providers).

## Proposed feature-index row (orchestrator-owned file — do not commit)

`docs/features/README.md` is orchestrator-owned. Proposed minimal diff — append after the last row (`server-live-leaderboard`):

```md
| render-backend-migration | Render Backend Migration (Fly free-tier gate → Render free Docker backend, CI-once deploy, Vercel/Neon retained) | accepted | 2026-11-16 |
```

No other row changes. The orchestrator applies this on acceptance.

## Backlog — stale Fly source comments (not changed in T3)

These are code comments, not docs, so they are outside T3's files-owned set. They do not affect behavior, and T3 makes no source change; they should be corrected in a small follow-up chore (no test change needed):

- `src/backend/src/app.ts:162-163` — "Fly terminates TLS at its edge proxy … (Fly sets NODE_ENV=production …)".
- `src/backend/src/app.ts:330` — "deployed Fly sets false on its one public host".
- `src/backend/src/observability/metrics-route.ts:5-6` — "Deployed Fly environments set `METRICS_ENABLED=false` because Fly serves the whole app on one…".
- `src/backend/src/db/migrate-runner.ts:71` — "Fly receives `DIRECT_DATABASE_URL` as a secret".
- `src/backend/src/app.test.ts:779` — `describe('trust proxy (Fly)', …)` suite name.

## Deviations from spec

- `infra/README.md` (2 supersession lines) updated beyond the enumerated docs — in-intent (Fly supersession) and recorded in § Decisions 8.
- Source comments left untouched — deliberate scope boundary; tracked in § Backlog.
- No other deviations.
