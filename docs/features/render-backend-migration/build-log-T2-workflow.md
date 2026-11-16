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

## Acceptance audit

1. Fly env and all Fly steps removed from `deploy.yml` → **met** (`grep -ni fly deploy.yml` → no matches).
2. Neon migration retained → **met** (`Migrate Neon database` step with `DATABASE_URL`/`DIRECT_DATABASE_URL`, unchanged).
3. Render deploy hook step uses `curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"` → **met** (line 60).
4. Bounded health poll on `${VITE_API_URL}/healthz`, up to 180 s, fails on non-200 → **met** (lines 63–76; behaviour run above).
5. Vercel pull/build/deploy/alias kept, `working-directory: src/frontend` and `VITE_CLOUD_DEPLOY`/`VITE_API_URL`/`VITE_WS_URL` kept → **met** (grep output above).
6. Deployed smoke kept; `/healthz` warmed first; longer smoke timeout → **met** (lines 138–153).
7. `develop`/`main` environment selection, concurrency, and `verify` job unchanged → **met** (identical lines 15–34, `needs: verify`).
8. `ci.yml` Fly check replaced, actionlint not weakened → **met** (no `render.yaml` exists, so no Render file checks were added; actionlint step untouched and green).
9. actionlint on both workflows → **met** (`actionlint_exit=0`).
10. Pinned grep checks → **met** (block above).
11. No secrets printed, no source changes, no GitHub vars/secrets set → **met** (only the two workflow files and this log are staged).

## Deviations from spec

- Removed the deploy-env keys that existed solely for `flyctl secrets set` (`SMTP_*`, `SESSION_COOKIE_*`, `MAX_USERS_PER_SERVER`); see Decision 3.
- Added a Fly-free guard in `ci.yml` in place of the removed anchor check; the brief allowed removal, and the guard keeps `verify-workflows` enforcing the migration invariant.

## Next step (out of scope here)

The `development` environment secrets/variables were configured in `d2ba961` (`build-log-T2-env.md`). Push all pending commits, then:

```
gh workflow run deploy.yml --repo raultorres2603/CubeClicker -f environment=development
```

`fly.config.toml` deletion and the deployment documentation updates remain in T3.
