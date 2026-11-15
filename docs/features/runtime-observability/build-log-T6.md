# Build log — T6 — Code-review r1 fix: disable public metrics exposure on Fly

Task: T6 (2026-11-15) — code-review r1 fix (F1 BLOCKER, F2/F3 MAJOR, F4/F7 MINOR/INFO)

Spec revision: **runtime-observability r3 (2026-11-15)** — AC-8 and AC-25 re-targeted from the superseded AWS/ALB boundary to the current Fly.io single-public-host model: deployed `METRICS_ENABLED=false` in `fly.config.toml` `[env]` and the deploy workflow, local compose `true` on loopback, `/metrics` excluded from every CORS grant, and a temporary Fly secret + `fly proxy`/`fly ssh` enablement procedure with an immediate unset. The r3 revision history entry and the revised `plan.md` (r3) / `tasks.md` / `status.md` are staged as-is (planner/orchestrator artifacts).

Files changed:
- `fly.config.toml` — `METRICS_ENABLED = "false"` in `[env]` with the public-host rationale
- `.github/workflows/deploy.yml` — `"METRICS_ENABLED=false"` staged in the Fly runtime configuration
- `src/backend/src/cors.ts` / `src/backend/src/cors.test.ts` — `/metrics` excluded from every CORS grant + tests
- `src/backend/src/app.ts` / `src/backend/src/app.test.ts` — Fly exposure comment + CORS/exposure integration tests
- `src/backend/src/observability/metrics-route.ts` — Fly exposure comment
- `README.md` — Operations exposure truth, temporary enablement procedure, configuration row
- `docs/architecture/observability.md` — Exposure section rewritten to the Fly public-host model (historical AWS only)
- `docs/architecture/deployment.md` — diagnostics bullet, Fly runtime config, supersession ledger row
- `docs/features/runtime-observability/spec.md`, `plan.md`, `tasks.md`, `status.md` — r3 revisions (staged without editing)
- `docs/features/runtime-observability/reviews/code-review-r1.md` — review artifact (staged)
- `docs/features/runtime-observability/build-log-T6.md` (this file)

What changed & why (≤5 lines):
1. The deployed default is now false in both committed places: `METRICS_ENABLED = "false"` in `fly.config.toml` `[env]` for both Fly apps and `"METRICS_ENABLED=false"` staged by `deploy.yml`. Local `compose.yaml` keeps `${METRICS_ENABLED:-true}` on the loopback.
2. The CORS hook returns before adding anything for `/metrics`: no `access-control-allow-origin`, no `access-control-allow-credentials`, and no preflight method/header/max-age grant (GET and OPTIONS), so the Vercel frontend origin cannot read a temporarily enabled scrape.
3. The docs now state the actual boundary: Fly serves one public host with no path filter; the deployed default false is the control; enablement is a temporary secret + `fly proxy`/`fly ssh` then unset; the ALB/CloudWatch text is clearly historical.
4. Tests pin the three states: local enabled scrape `200` without CORS, deployed-style disabled `404` without CORS, and a `/metrics` preflight with no grant and no `204`.
5. The route and composition-root comments no longer claim an ALB "not routed" boundary.

Decisions:
- **Both committed defaults.** `[env]` is the committed baseline for both apps; the deploy workflow stages the same `false` explicitly so an environment / pre-existing app cannot drift to the parser default `true`.
- **Path-based CORS exclusion.** `isMetricsPath` strips the query string and also matches a trailing slash, so the exclusion survives query strings and a future `ignoreTrailingSlash` setting. Other paths keep the exact-origin credentialed behavior unchanged.
- **Fail-closed preflight.** An `OPTIONS /metrics` is a plain `404` (no OPTIONS route) with no grant headers instead of a `204`; a browser preflight therefore fails and the cross-origin read never happens.
- **No parser default change.** `METRICS_ENABLED` still parses to `true` when unset, which is the local compose behavior; the deployed default comes from the Fly environment as the spec requires. The 30-metric catalog, `compose.yaml` and both images are untouched.
- **Spec/plan/tasks/status staged as-is.** The r3 edit was made by the planner/orchestrator before this fix; the builder only records it.

Evidence:

## Remote environments: committed default false

```text
$ grep -nF 'METRICS_ENABLED = "false"' fly.config.toml
16:  METRICS_ENABLED = "false"

$ grep -nF 'METRICS_ENABLED=false' .github/workflows/deploy.yml
90:            "METRICS_ENABLED=false"

$ grep -nF 'METRICS_ENABLED: "${METRICS_ENABLED:-true}"' compose.yaml
52:      METRICS_ENABLED: "${METRICS_ENABLED:-true}"
```

`git diff -- fly.config.toml .github/workflows/deploy.yml`:

```diff
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index bf802cf..e32b1ef 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -86,7 +86,8 @@ jobs:
             "MAX_USERS_PER_SERVER=$MAX_USERS_PER_SERVER" \
             "NODE_ENV=production" \
             "HOST=0.0.0.0" \
-            "PORT=8080"
+            "PORT=8080" \
+            "METRICS_ENABLED=false"
       - name: Deploy Fly backend
         env:
           FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
diff --git a/fly.config.toml b/fly.config.toml
index 675b5da..e3712c0 100644
--- a/fly.config.toml
+++ b/fly.config.toml
@@ -10,6 +10,10 @@
   NODE_ENV = "production"
   HOST = "0.0.0.0"
   PORT = "8080"
+  # Fly serves the whole app on one public host with no path filter. `/metrics`
+  # stays a 404 unless a temporary internal enablement sets a METRICS_ENABLED
+  # secret to true (local compose keeps its own true default on the loopback).
+  METRICS_ENABLED = "false"
 
 [http_service]
   internal_port = 8080
```

## Local gates

`npm run lint` → exit 0

```text
> lint
> eslint .
```

`npm run typecheck` → exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

`npm run test --workspace @cubeclicker/backend` → exit 0 (35 files / 1143 tests; +6 new tests)

```text
 ✓ src/cors.test.ts (20 tests) 209ms
 ✓ src/app.test.ts (37 tests) 2375ms

 Test Files  35 passed (35)
      Tests  1143 passed (1143)
```

Focused proof of the new coverage (verbose reporter):

```text
 ✓ src/cors.test.ts > isMetricsPath > matches only the metrics path, with an optional query string or trailing slash
 ✓ src/cors.test.ts > /metrics CORS exclusion (AC-8) > serves the loopback metrics route without a grant for the allowed origin
 ✓ src/cors.test.ts > /metrics CORS exclusion (AC-8) > keeps the exclusion when the request carries a query string
 ✓ src/cors.test.ts > /metrics CORS exclusion (AC-8) > answers a metrics preflight with no grant and no 204
 ✓ src/cors.test.ts > /metrics CORS exclusion (AC-8) > returns 404 for /metrics with no CORS grant when metrics are disabled
 ✓ src/app.test.ts > observability wiring (T3) > does not register /metrics when METRICS_ENABLED=false (AC-8)
 ✓ src/app.test.ts > observability wiring (T3) > serves /metrics locally but never grants it to the frontend origin (AC-8)
```

`npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds 80/80/80/80)

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.89 |    89.07 |   99.54 |   95.89 |
 src               |   97.65 |    91.08 |     100 |   97.65 |
  app.ts           |   96.94 |    87.32 |     100 |   96.94 | ...40,224,318-319
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   95.74 |    83.13 |     100 |   95.74 |
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 | ...61-363,369-370
  auth-service.ts  |     100 |    81.75 |     100 |     100 | ...95,400,417,503
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...69-770,826-839
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |   98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |   98.02 |    93.75 |     100 |   98.02 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   94.63 |    93.22 |   98.85 |   94.63 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   89.98 |    87.74 |   98.27 |   89.98 | ...1506,1636-1637
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   98.89 |    98.61 |   96.87 |   98.89 | 248-249,571-572
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/observability |   99.66 |     96.5 |     100 |   99.66 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.44 |    93.54 |     100 |   99.44 | 243-244
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57
-------------------|---------|----------|---------|---------|-------------------
```

`npm run build` → exit 0 (bundle budget unchanged; host entry `assets/index-Bu2ZFvtA.js`)

```text
entry index assets/index-Bu2ZFvtA.js raw=90584 gzip=28356
initial files=2 raw=312283 gzip=97312 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=987075 gzip=275342 budget=300000

Bundle budget OK.
```

## Docs and static checks

```text
grep -cF 'METRICS_ENABLED=false' docs/architecture/observability.md → 3
grep -cF 'Fly' docs/architecture/observability.md                    → 8
grep -cF 'CORS' docs/architecture/observability.md                   → 3
grep -cF 'Fly' docs/architecture/deployment.md                       → 24
grep -cF 'CORS' docs/architecture/deployment.md                      → 6
grep -cF 'METRICS_ENABLED=false' README.md                           → 2
grep -RnF 'not routed by the ALB' README.md docs/architecture/observability.md docs/architecture/deployment.md → no match (exit 1)
grep -RnF 'not routed by the public edge' README.md docs/architecture/observability.md docs/architecture/deployment.md → no match (exit 1)
for h in "Structured logging" "Metrics catalog" "Exposure and retention" "Frontend performance overlay" "Verification"; do grep -qx "## $h" docs/architecture/observability.md; done → ok for all five
test -z "$(git status --porcelain -- docs/features/README.md)" → exit 0
git diff --exit-code -- compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile infra/terraform package.json package-lock.json → exit 0 (no output)
```

Documentation truth check:

- `observability.md` § Exposure states the Fly public host has **no path filter**; deployed Fly defaults `METRICS_ENABLED=false` (`fly.config.toml` `[env]` + deploy workflow); local compose keeps `true` on loopback; `/metrics` is excluded from CORS for GET and OPTIONS; temporary enablement is a Fly secret + `fly proxy`/`fly ssh` then unset; the ALB/CloudWatch text is explicitly historical.
- `deployment.md` § Platform split states the same model and marks the ALB routing table as historical-only; § Secrets and variables lists `METRICS_ENABLED=false`; the supersession-ledger row records the deployed default false and the CORS exclusion.
- `README.md` § Operations states the deployed default `false`, the single-public-host/no-path-filter model, the CORS exclusion and the temporary enablement/unset procedure; the configuration row distinguishes compose `true` from deployed `false`.

## Acceptance audit

- **AC-8 — Deployed-private metrics exposure on the existing port** → **met**. The route stays on the existing port 8080; `grep -F 'METRICS_ENABLED = "false"' fly.config.toml` and `grep -F 'METRICS_ENABLED=false' .github/workflows/deploy.yml` match; `compose.yaml` keeps `METRICS_ENABLED: "${METRICS_ENABLED:-true}"`; `app.test.ts` proves the local enabled scrape is `200` with the exact Prometheus content type and the deployed-style disabled path is a plain `404`; `cors.test.ts` + `app.test.ts` prove no `access-control-allow-origin`/`access-control-allow-credentials` on `/metrics` GET and no grant (and no `204`) on OPTIONS from the allowed origin; the docs document the temporary Fly secret + `fly proxy`/`fly ssh` + unset procedure.
- **AC-25 — Observability documentation matches the Fly deployment** → **met**. `observability.md` keeps exactly the five pinned `##` sections; the exposure section now states the public Fly host/no path filter, the deployed false default in both committed places, the local compose true-on-loopback default, the CORS exclusion and the temporary enablement procedure; the ALB/CloudWatch material is clearly historical only. `README.md` and `deployment.md` state the same model; no current "not routed by the ALB/public edge" claim remains; every relative link still resolves; `docs/features/README.md` is untouched.
- **AC-26 — Quality gates and bounded config changes** → **met for this fix**. `npm run lint`, `npm run typecheck`, `npm run test --workspace @cubeclicker/backend`, `npm run coverage --workspace @cubeclicker/backend` (95.89/89.07/99.54/95.89, all ≥ 80) and `npm run build` all exit 0. `fly.config.toml` adds only `METRICS_ENABLED = "false"` (plus the paired comment) to `[env]`; `deploy.yml` adds only the explicit `METRICS_ENABLED=false` Fly value; `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles, `package.json`, `package-lock.json` and `infra/terraform/**` are unchanged (diff exit 0). No dependency added.
- **Review findings** → F1 addressed (deployed default false + CORS exclusion + documented internal enablement); F2 addressed (docs + route/app comments corrected; historical AWS clearly historical); F3 addressed (spec r3 re-targeted, plan/tasks revised); F4 addressed (route/app comments); F7 addressed (CORS exclusion + tests). F5 (status `updated` date at acceptance) and F6 (feature-index row) remain orchestrator acceptance actions; F8–F10 were informational and unchanged.

## Assertion bar

- All new assertions use concrete values: exact status codes, exact content type, exact 404 body, exact absence of `access-control-allow-origin`/`access-control-allow-credentials`/`access-control-allow-methods`/`access-control-max-age`, and the exact `METRICS_PATH` constant. No wildcard matchers, snapshots or assertion-free tests.
- No existing test was weakened; the `METRICS_ENABLED=false` app test gained an allowed-origin header and two exact `toBeUndefined()` CORS assertions.

Deviations from spec: none. The parser default remains `true` when `METRICS_ENABLED` is unset so local compose stays enabled; deployed false is supplied by the committed Fly configuration and the deploy workflow exactly as AC-8 requires. `status.md` and `docs/features/README.md` were not edited (orchestrator-owned); the r3 status revision is staged as-is. The containerized smoke was not re-run for this fix because the change is environment/CORS-only and its behavior is covered by the backend integration tests; the T5 smoke evidence remains valid (the local compose default is unchanged).
