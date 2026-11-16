# Build log — T2 workflow — Deploy the Render backend from GitHub Actions

Task: T2 workflow (2026-11-16)
Files changed: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `docs/features/render-backend-migration/build-log-T2-workflow.md`
What changed & why:
- `deploy.yml`: dropped the `FLY_*` env block and every `Setup flyctl` / `flyctl secrets set` / `flyctl deploy` / Fly health step; kept the Neon migration, Vercel pull/build/deploy/alias, and deployed-smoke steps, plus the `develop`/`main` environment selection, concurrency group, and `verify` job.
- `deploy.yml`: new `Deploy Render backend` step runs `curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"`, followed by a 180 s bounded `/healthz` poll that only accepts HTTP 200.
- `deploy.yml`: warmed `GET /healthz` right before the deployed smoke and raised the smoke per-check budget to 20 s (`SMOKE_TIMEOUT_MS=20000`) for the Render free cold start.
- `ci.yml`: replaced the `fly.config.toml` anchor check with a guard that fails `verify-workflows` if `deploy.yml` mentions Fly at all. No `render.yaml` exists yet, so per the brief no Render file checks were added; actionlint still lints both workflows.

## Decisions

1. **No `render.yaml` check.** `render.yaml` does not exist in the repository (T1 created the service directly through the Render API), so the brief's fallback applies: remove the Fly-specific `verify-workflows` check. The replacement guard keeps `verify-workflows` enforcing the new invariant ("no Fly in the deploy path") instead of silently losing coverage.
2. **Health poll contract.** The poll requires exactly `200` (not merely a 2xx/body match), retries every 5 s, caps each request at 15 s, and gives up after 180 s. The previous body-equality check was tied to `{"status":"ok"}`; the brief pins non-200 as the failure condition, so status is the contract.
3. **Unused deploy env removed.** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, and `MAX_USERS_PER_SERVER` fed only the removed `flyctl secrets set` step. Backend runtime configuration now lives on the Render service (set in T1); the deploy hook only starts a build of the tracked branch, so the workflow no longer stages runtime secrets.
4. **`fly.config.toml` remains on disk** (deleting files is outside this task's scope), but no workflow references it any more. Removal belongs to the T3 config/docs cleanup.
5. **Deploy hook scope.** A Render deploy hook deploys the service's configured branch (the service tracks `main`) and cannot change environment variables. The `develop`/`main` GitHub Environment selection is unchanged; the branch-to-Render-environment mapping and the `production` hook are operational items for the next stage.
6. **Health poll vs. rollout.** While Render builds the new instance the old one can still answer `/healthz`, so the poll proves reachability/warmth rather than "new code live". The deployed smoke (which exercises the origin guard behaviour introduced in `e6a7afd`) remains the end-to-end proof of the deployed revision.
7. **Test tiers.** No application code changed, so no unit/integration test was added: the change is CI workflow configuration. The applicable tests are actionlint over both workflows, the pinned grep checks, and a local execution of the committed poll script against a fake server (both success and non-200 failure paths). Live workflow proof is the next stage's `gh workflow run`.

## Evidence

### Workflow lint and pinned checks

```
$ podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
actionlint_exit=0

$ grep -nE "flyctl|FLY_" .github/workflows/deploy.yml || echo "no matches"
no matches

$ grep -ni "fly" .github/workflows/deploy.yml || echo "no matches"
no matches

$ grep -rnE "flyctl|FLY_" .github/workflows/ || echo "no matches"
no matches

$ grep -n "RENDER_DEPLOY_HOOK_URL" .github/workflows/deploy.yml
59:          RENDER_DEPLOY_HOOK_URL: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
60:        run: curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"

$ grep -n "healthz" .github/workflows/deploy.yml
67:            status=$(curl -sS -o "$response" -w '%{http_code}' --max-time 15 "$VITE_API_URL/healthz" || true)
69:              echo "healthz OK after $((SECONDS - start))s: $(cat "$response")"
72:            echo "healthz not ready (HTTP ${status:-000}) after $((SECONDS - start))s; retrying in 5s"
75:          echo "healthz did not return 200 within 180s" >&2
140:          curl -fsS --retry 12 --retry-delay 5 --retry-all-errors --max-time 30 "$VITE_API_URL/healthz"

$ grep -n "working-directory: src/frontend" .github/workflows/deploy.yml
81:        working-directory: src/frontend
93:        working-directory: src/frontend
109:        working-directory: src/frontend
125:        working-directory: src/frontend

$ grep -n "VITE_CLOUD_DEPLOY\|VITE_API_URL\|VITE_WS_URL" .github/workflows/deploy.yml
36:      VITE_API_URL: ${{ vars.VITE_API_URL }}
37:      VITE_WS_URL: ${{ vars.VITE_WS_URL }}
67:            status=$(curl -sS -o "$response" -w '%{http_code}' --max-time 15 "$VITE_API_URL/healthz" || true)
98:          VITE_CLOUD_DEPLOY: "true"
99:          VITE_API_URL: ${{ vars.VITE_API_URL }}
100:          VITE_WS_URL: ${{ vars.VITE_WS_URL }}
140:          curl -fsS --retry 12 --retry-delay 5 --retry-all-errors --max-time 30 "$VITE_API_URL/healthz"
144:          SMOKE_API_URL: ${{ vars.VITE_API_URL }}
145:          SMOKE_WS_URL: ${{ vars.VITE_WS_URL }}

$ grep -n "SMOKE_TIMEOUT_MS" .github/workflows/deploy.yml
147:          SMOKE_TIMEOUT_MS: "20000"

$ git diff --stat -- .github/workflows/deploy.yml .github/workflows/ci.yml
 .github/workflows/ci.yml     |  7 ++---
 .github/workflows/deploy.yml | 69 ++++++++++++++------------------------------
 2 files changed, 24 insertions(+), 52 deletions(-)
```

### Health poll behaviour (committed script, fake server)

The exact 14-line `run:` block was extracted from `deploy.yml` and executed against a local server that answered `503` twice and then `200`, and against a server that always answered `500` (the bound was shortened to 2 s in a temporary copy so the failure path runs quickly; the committed script uses 180 s).

```
=== success path: two 503s then 200 ===
healthz not ready (HTTP 503) after 0s; retrying in 5s
healthz not ready (HTTP 503) after 5s; retrying in 5s
healthz OK after 10s: {"status":"ok"}
success_exit=0 elapsed=10s

=== failure path: always 500, 2s bound (180 -> 2 in a copy) ===
healthz not ready (HTTP 500) after 0s; retrying in 5s
healthz did not return 200 within 2s
failure_exit=1
```

Non-200 responses are retried, a 200 succeeds, and the deadline exits non-zero.

### Repository gates (workflow-only change)

```
$ npm run lint
lint_exit=0

$ npm run typecheck
typecheck_exit=0

$ npm run coverage
@cubeclicker/backend   Test Files 37 passed (37)   Tests 1507 passed (1507)
  All files            | 96.15 | 89.81 | 99.57 | 96.15 |
@cubeclicker/frontend  Test Files 74 passed (74)   Tests 2248 passed (2248)
  All files            | 96.63 | 96.35 | 97.80 | 96.63 |
coverage_exit=0
```

## Follow-up — production deploy deferred to workflow dispatch

Superseded by the next follow-up: the push trigger now targets `main` and resolves to development; production remains `workflow_dispatch`-only. The deploy-hook safety rationale below still holds for production.

The `production` environment still has no `RENDER_DEPLOY_HOOK_URL` (and no other secrets), so a push to `main` would have started a deploy that fails at the Render step. The push trigger now covers `develop` only:

```diff
 on:
+  # Pushes deploy development only; production is workflow_dispatch-only until
+  # its environment and secrets are provisioned.
   push:
-    branches: [develop, main]
+    branches: [develop]
   workflow_dispatch:
```

`workflow_dispatch` keeps the `development`/`production` choice, and the concurrency group and environment expression are unchanged, so a manual production run still selects the `production` environment. No other workflow behaviour changed.

Evidence:

```
$ podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
actionlint_exit=0

$ sed -n '1,16p' .github/workflows/deploy.yml
name: Deploy

on:
  # Pushes deploy development only; production is workflow_dispatch-only until
  # its environment and secrets are provisioned.
  push:
    branches: [develop]
  workflow_dispatch:
    inputs:
      environment:
        description: GitHub Environment to deploy
        type: choice
        required: true
        default: development
        options: [development, production]
```

## Follow-up — auto-deploy development from a main push

User directive: a push to `main` must deploy **development** automatically; `gh workflow run` is not used for dev. This supersedes the `develop`-only trigger above and keeps production manual.

```diff
 on:
-  # Pushes deploy development only; production is workflow_dispatch-only until
-  # its environment and secrets are provisioned.
+  # A push to main auto-deploys development. Production is workflow_dispatch-only
+  # until its environment and secrets are provisioned.
   push:
-    branches: [develop]
+    branches: [main]
   workflow_dispatch:
     inputs:
       environment:
         ...

 concurrency:
-  group: deploy-${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development') }}
+  group: deploy-${{ github.event.inputs.environment || 'development' }}
 ...
-    environment: ${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development') }}
+    environment: ${{ github.event.inputs.environment || 'development' }}
     env:
-      TARGET_ENVIRONMENT: ${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'development') }}
+      TARGET_ENVIRONMENT: ${{ github.event.inputs.environment || 'development' }}
```

Mapping: on a `push` event `github.event.inputs.environment` is unset, so the expression resolves to `development`; on `workflow_dispatch` it resolves to the chosen input (`development` or `production`). Production therefore stays manual and unprovisioned, while a `main` push deploys development with no dispatch.

Vercel now always targets the development project's production environment, so the stable domain is updated on every dev run and no preview URL is produced for the dev pipeline:

- `vercel pull --yes --environment=production`
- `vercel build --prod`
- `vercel deploy --prebuilt --prod --yes`
- `vercel alias set "$DEPLOYMENT_URL" "$FRONTEND_ORIGIN"` (deterministic `cubeclicker-development.vercel.app` alias, development only)

Pipeline order is unchanged: migrate → Render hook → 180 s health poll → Vercel production deploy → alias → warm health → deployed smoke.

Evidence:

```
$ podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
actionlint_exit=0

$ grep -n "preview\|refs/heads\|branches:" .github/workflows/deploy.yml
7:    branches: [main]

$ grep -n "github.event.inputs.environment" .github/workflows/deploy.yml
18:  group: deploy-${{ github.event.inputs.environment || 'development' }}
34:    environment: ${{ github.event.inputs.environment || 'development' }}
36:      TARGET_ENVIRONMENT: ${{ github.event.inputs.environment || 'development' }}

$ grep -n "^      - name:" .github/workflows/deploy.yml
41:      - name: Checkout
43:      - name: Setup Node
48:      - name: Install dependencies
51:      - name: Migrate Neon database
59:      - name: Deploy Render backend
63:      - name: Wait for Render backend health
80:      - name: Install Vercel CLI
84:      - name: Pull Vercel project settings
91:      - name: Build Vercel frontend
101:      - name: Deploy Vercel frontend
113:      - name: Alias development deployment
128:      - name: Warm Render backend before smoke
131:      - name: Run deployed smoke

$ grep -n "vercel pull\|vercel build\|vercel deploy\|vercel alias" .github/workflows/deploy.yml
90:        run: vercel pull --yes --environment=production
100:        run: vercel build --prod
109:          deploy_output=$(vercel deploy --prebuilt --prod --yes)
124:          vercel alias set "$DEPLOYMENT_URL" "$frontend_host"
```

## Follow-up — CI runs once; deploy follows a successful CI run

User directive: CI runs first, and deployment happens only if CI succeeded — no second verification inside the deploy pipeline. This supersedes the `push` trigger from the previous follow-up; `main` pushes now reach deployment through the CI workflow run, not directly. Trigger graph:

```
push main ──► CI (verify-app + smoke-e2e + verify-workflows)
                 │ completed
                 ▼
             Deploy (workflow_run)
                 └─ job runs only if conclusion == success && head_branch == main
                    └─ migrate → Render hook → 180 s health poll
                       → Vercel production deploy + alias → warm health → smoke

workflow_dispatch (production only) ──► read-only CI-conclusion guard ──► same deploy path
```

`deploy.yml` changes:

- Trigger is `workflow_run: workflows: [CI], types: [completed], branches: [main]` plus `workflow_dispatch`; `push` is gone.
- `workflow_dispatch` is production-only: the `environment` input keeps its name but now offers `options: [production]` with `default: production`, so development is reachable only through the successful-CI `workflow_run` path. The environment expression `github.event.inputs.environment || 'development'` resolves to `production` on a manual dispatch and `development` for `workflow_run`.
- The `verify` job (`uses: ./.github/workflows/ci.yml`) and `needs: verify` are removed.
- Job condition: `github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')`.
- Checkout pins `ref: ${{ github.event.workflow_run.head_sha || github.sha }}`, so the deploy uses the exact commit CI validated (manual runs use the dispatch SHA).
- Manual runs (`workflow_dispatch`) run a read-only guard before checkout: `gh run list --workflow CI --commit "$GITHUB_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'` must be `success`. The job grants `actions: read` for this query; no CI jobs are re-run. If the token cannot query Actions runs, the step exits non-zero (fail-closed) with an explicit message, so a missing permission blocks the deploy rather than skipping the guard.
- Defense in depth: a `workflow_run` that did not originate from a `push` event (for example a fork PR whose head branch is named `main`) is rejected before checkout. The pinned job condition is unchanged; this step only closes the fork-PR path.
- Deploy keeps only setup/migration/build work: checkout, Node + `npm ci` (for the `tsx` migration runner), Neon migration, Render hook + health poll, Vercel CLI pull/build/deploy/alias, warm health, deployed smoke. No lint/typecheck/test/coverage step exists in `deploy.yml`.

`ci.yml` changes: the `workflow_call` trigger is removed; `pull_request` and `push` to `main`/`develop` remain, and the workflow name is exactly `CI`. All three jobs are unchanged.

Evidence:

```
$ podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
actionlint_exit=0

$ grep -nE "workflow_run|workflow_dispatch|push:|branches:|types:" .github/workflows/deploy.yml
5:  # that CI run succeeds. Production is workflow_dispatch-only until provisioned.
6:  workflow_run:
8:    types: [completed]
9:    branches: [main]
10:  workflow_dispatch:
30:    if: github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')
41:        if: github.event_name == 'workflow_run' && github.event.workflow_run.event != 'push'
43:          WORKFLOW_EVENT: ${{ github.event.workflow_run.event }}
48:        if: github.event_name == 'workflow_dispatch'
65:          ref: ${{ github.event.workflow_run.head_sha || github.sha }}

$ grep -n "description:\|default:\|options:" .github/workflows/deploy.yml
13:        description: GitHub Environment to deploy (manual production only)
16:        default: production
17:        options: [production]

$ grep -n "uses: ./.github/workflows/ci.yml\|needs: verify\|npm run lint\|npm run typecheck\|npm test\|npm run coverage" .github/workflows/deploy.yml || echo "no matches"
no matches

$ grep -n "workflow_call" .github/workflows/ci.yml || echo "no matches"
no matches

$ grep -n "^name:\|^on:\|^  pull_request:\|^  push:\|^    branches:" .github/workflows/ci.yml
1:name: CI
3:on:
4:  pull_request:
5:  push:
6:    branches: [main, develop]

$ grep -n "workflow_run\|github.event.inputs.environment\|head_sha\|gh run list\|actions: read" .github/workflows/deploy.yml
6:  workflow_run:
20:  group: deploy-${{ github.event.inputs.environment || 'development' }}
25:  actions: read
30:    if: github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')
33:    environment: ${{ github.event.inputs.environment || 'development' }}
35:      TARGET_ENVIRONMENT: ${{ github.event.inputs.environment || 'development' }}
41:        if: github.event_name == 'workflow_run' && github.event.workflow_run.event != 'push'
43:          WORKFLOW_EVENT: ${{ github.event.workflow_run.event }}
53:          if ! conclusion=$(gh run list --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then
65:          ref: ${{ github.event.workflow_run.head_sha || github.sha }}

$ grep -n "^      - name:" .github/workflows/deploy.yml
40:      - name: Reject non-push CI runs
47:      - name: Verify CI succeeded for target commit
62:      - name: Checkout
66:      - name: Setup Node
71:      - name: Install dependencies
74:      - name: Migrate Neon database
82:      - name: Deploy Render backend
86:      - name: Wait for Render backend health
103:      - name: Install Vercel CLI
107:      - name: Pull Vercel project settings
114:      - name: Build Vercel frontend
124:      - name: Deploy Vercel frontend
136:      - name: Alias development deployment
151:      - name: Warm Render backend before smoke
154:      - name: Run deployed smoke
```

Known limits of the manual guard: it reads the newest CI run for the dispatch SHA through the Actions API (`actions: read`); it does not re-run CI, and a SHA with no CI run fails the guard. Production remains unprovisioned, so a manual production dispatch still stops at the first missing production secret.

## Acceptance audit

1. Fly env and all Fly steps removed from `deploy.yml` → **met** (`grep -ni fly deploy.yml` → no matches).
2. Neon migration retained → **met** (`Migrate Neon database` step with `DATABASE_URL`/`DIRECT_DATABASE_URL`, unchanged).
3. Render deploy hook step uses `curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"` → **met** (line 62).
4. Bounded health poll on `${VITE_API_URL}/healthz`, up to 180 s, fails on non-200 → **met** (lines 63–78; behaviour run above).
5. Vercel pull/build/deploy/alias kept, `working-directory: src/frontend` and `VITE_CLOUD_DEPLOY`/`VITE_API_URL`/`VITE_WS_URL` kept → **met** (grep output above).
6. Deployed smoke kept; `/healthz` warmed first; longer smoke timeout → **met** (lines 128–143).
7. `develop`/`main` environment selection, concurrency, and `verify` job unchanged → **met at the commit described here** (the mapping was later superseded by the follow-up below: main push → development, dispatch → input).
8. `ci.yml` Fly check replaced, actionlint not weakened → **met** (no `render.yaml` exists, so no Render file checks were added; actionlint step untouched and green).
9. actionlint on both workflows → **met** (`actionlint_exit=0`).
10. Pinned grep checks → **met** (block above).
11. No secrets printed, no source changes, no GitHub vars/secrets set → **met** (only the two workflow files and this log are staged).

## Deviations from spec

- Removed the deploy-env keys that existed solely for `flyctl secrets set` (`SMTP_*`, `SESSION_COOKIE_*`, `MAX_USERS_PER_SERVER`); see Decision 3.
- Added a Fly-free guard in `ci.yml` in place of the removed anchor check; the brief allowed removal, and the guard keeps `verify-workflows` enforcing the migration invariant.

## Next step (out of scope here)

The `development` environment secrets/variables are configured (`d2ba961`, `build-log-T2-env.md`). Push the pending commits:

```
git push origin main
```

CI runs once on the push; only when that run completes successfully does the `Deploy` workflow start and deploy development. No `gh workflow run` is used for development. The orchestrator may watch both runs with `gh run watch` but must not dispatch the development deploy.

`fly.config.toml` deletion and the deployment documentation updates remain in T3.
