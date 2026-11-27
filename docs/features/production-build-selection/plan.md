---
feature: production-build-selection
revision: 3
---
# Plan — Production Build Selection

**r2a (spec-review r2, F15–F20):** F15 extends the gate harness to the actual `Deploy Render backend`/`Wait for Render deploy to complete` `run` blocks with a stub `curl` (POST 201/202, non-`dep-` ID, commit mismatch, every terminal status, short-override timeout, transient retry, latest-deploy match/mismatch); F16 rewrites both containerization release-identity statements to the three-way rule (selected production SHA / manual development `github.sha` / automatic `workflow_run.head_sha`); F17 updates the dependency context to T6 complete/production live, T7 in progress, T8 pending; F18 puts the stub `pg` directory first on `NODE_PATH`; F19 retries transient completion-GET failures until the deadline; F20 cites the Trigger Deploy API `responses` plus the deploy-hook docs for 202.

## Architecture

The deploy workflow already has one guarded job and one environment-scoped configuration. This feature adds a **selection front-end** to the manual path, a **live Render completion proof**, and an executed **workflow-gate harness**; the automatic development path's source of truth (`workflow_run.head_sha`) is unchanged.

```
Development automatic
  push to main ──► CI (success) ──► workflow_run ──► deploy job (development)
                                                      checkout: workflow_run.head_sha
                                                      guard (Brevo) → migration → sync
                                                      → Render hook → Wait for Render deploy to complete
                                                        (automatic branch: existing 45 s head start)
                                                      → health → Vercel → smoke

Production manual (workflow_dispatch, environment=production)
  build: latest | previous-1 … previous-9 | build_sha (optional)
        │
        ▼
  Resolve selected build (Actions API: successful CI push runs on main, dedupe, index)
        │  sha + source
        ▼
  Verify CI succeeded for target commit (gh run list --event push --branch main)
  + on-main compare (gh api compare … → ahead|identical)
        │
        ▼
  Checkout selected SHA → Confirm selected build checkout (git rev-parse HEAD)
        │
        ▼
  Setup/install → Check selected build deploy contract (guard/sync/migration/smoke files
  identical to dispatch ref; pg present)
        │
        ▼
  Check deployment Brevo configuration (11 names, --check-only)
        │
        ▼
  Check selected build schema compatibility (schema_migrations ⊆ selected migrations;
  immutable-migration policy)
        │
        ▼
  Migrate Neon database (selected build's migration SQL, current runner)
        │
        ▼
  Sync Brevo SMTP settings to Render (9 names, current catalog)
        │
        ▼
  Deploy Render backend (manual: POST /v1/services/{id}/deploys {commitId};
  automatic: hook)
        │
        ▼
  Wait for Render deploy to complete
    manual: GET /deploys/{id} until status=live (default 10 s poll, 900 s timeout; env-overridable)
            → GET /deploys?limit=1 → current deploy id/commit must match the selection
    automatic: existing 45 s head start (no deploy id from the hook)
        │
        ▼
  /healthz poll (180 s) → Vercel pull/build/deploy --prod
  (same checkout; --meta githubCommitSha) → warm → deployed smoke
```

- **State ownership unchanged.** GitHub Environments own deployment configuration; Render owns live room/game state; Neon owns durable rows; Vercel owns no state. The selected build is a commit, not a provider artifact.
- **One job, one order.** The production dispatch uses the same job; the resolver/guard/contract/schema steps are dispatch-only. The provider order is the accepted order, with the two safety gates inserted before the migration and the completion proof replacing the old fixed sleep.
- **Pipeline code vs selected app code.** The workflow YAML always comes from the dispatch ref (`main`). After checkout, the guard/sync/migration/smoke scripts come from the selected build; the contract gate requires those files to be byte-identical to the dispatch ref, so a selected old build cannot run an older guard/catalog or an older smoke. The selected build's app code and its migration SQL are the only versioned payload.
- **Live revision proof.** A manual Render API deploy response is not proof that the selected revision is serving; Render keeps the previous instance live during the build. The completion step polls the selected deploy to `status: live` and verifies the service's current/latest deploy and commit before health/Vercel/smoke. The automatic path keeps its existing hook/45 s behavior (unchanged), because the hook does not provide a deploy ID.
- **Why rebuild instead of promoting artifacts.** A Vercel promotion or Render rollback is per-provider, can mix revisions, skips the guard/sync/migration/smoke and can carry stale build-time configuration. Rebuilding the selected SHA through the guarded pipeline is the only path that proves the same revision on both providers with the current catalog and configuration.
- **No native dynamic dropdown.** `workflow_dispatch.choice` `options` are static; GitHub resolves them from the workflow file at dispatch time. The relative dropdown + `build_sha` is the native, write-free design (Q-1); Q-1 requires owner acceptance at the approval checkpoint.

## Interfaces / contracts

### 1. Dispatch inputs (exact)

```yaml
  workflow_dispatch:
    inputs:
      environment:
        description: GitHub Environment to deploy (development or production)
        type: choice
        required: true
        default: production
        options: [production, development]
      build:
        description: Build to deploy (production only; latest = newest successful CI build on main)
        type: choice
        required: true
        default: latest
        options: [latest, previous-1, previous-2, previous-3, previous-4, previous-5, previous-6, previous-7, previous-8, previous-9]
      build_sha:
        description: Optional full 40-character lowercase commit SHA for an exact build (production only)
        type: string
        required: false
        default: ''
```

- Input key set exactly `build,build_sha,environment`.
- `environment` is unchanged; `build` is the required dropdown with `latest` default; `build_sha` is optional, production-only, and must be a full 40-character lowercase SHA.
- The relative labels are positions, not SHA labels; the resolver prints the selected SHA and CI run after selection.

### 2. Resolver contract (`Resolve selected build`, dispatch-only, pre-checkout)

Step surface: `id: resolve_build`, `if: github.event_name == 'workflow_dispatch'`, env `GH_TOKEN`, `ENVIRONMENT`, `BUILD`, `BUILD_SHA`, `DISPATCH_SHA`. Outputs `sha`, `source`.

Production lookup (no git context required):

```bash
gh api "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?event=push&branch=main&status=success&per_page=100" \
  --jq '.workflow_runs[] | [.head_sha, (.id|tostring), .created_at] | @tsv'
```

Selection: dedupe by `head_sha` preserving the API's newest-first order, then index 0 for `latest`, N for `previous-N`:

```bash
awk -F'\t' 'NF && !seen[$1]++' | sed -n "$((index + 1))p"
```

- `latest` = newest distinct successful `CI` push build on `main`; `previous-1` = the next older; … `previous-9`.
- `build_sha` is validated by `^[0-9a-f]{40}$` and must not be combined with a non-`latest` `build`.
- Development dispatch with defaults: `sha=$DISPATCH_SHA`, `source=dispatch-ref`.
- Development dispatch with a selection: fail with `Build selection is available for environment=production only; set build=latest and clear build_sha for a development dispatch.`
- Unavailable choice: `Build choice <choice> is unavailable: fewer than <N+1> successful CI builds on main.`
- Print `Resolved build: <sha> (<source>)`; for list-derived builds also `CI run: <id> <createdAt>`.
- The actual `run` block is executed by the harness (see §10).

### 3. Guard contract (`Verify CI succeeded for target commit`, dispatch-only, pre-checkout)

```bash
if ! conclusion=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --event push --branch main --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then
  echo "Unable to query CI runs for $TARGET_SHA; the token may lack actions:read" >&2
  exit 1
fi
if [ "$conclusion" != "success" ]; then
  echo "CI for $TARGET_SHA is not successful (conclusion: ${conclusion:-none}); refusing to deploy" >&2
  exit 1
fi
status=$(gh api "repos/$GITHUB_REPOSITORY/compare/$TARGET_SHA...main" --jq '.status')
case "$status" in
  ahead|identical) ;;
  *) echo "Build $TARGET_SHA is not on main (compare status: $status); refusing to deploy." >&2; exit 1 ;;
esac
echo "CI succeeded for $TARGET_SHA"
```

- `TARGET_SHA` is `${{ steps.resolve_build.outputs.sha }}` (not `github.sha`).
- Exactly one `gh run list` in the file; it keeps `--repo "$GITHUB_REPOSITORY"` (T6a). The resolver uses the Actions API, so the count invariant is preserved.
- `--event push --branch main` excludes PR runs for the same SHA; compare `ahead|identical` proves the SHA is on `main`.
- The actual `run` block is executed by the harness with a stub `gh` for success/failure/missing/not-on-main.

### 4. Checkout / same-SHA contract

```yaml
- name: Checkout
  uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  with:
    ref: ${{ steps.resolve_build.outputs.sha || github.event.workflow_run.head_sha || github.sha }}

- name: Confirm selected build checkout
  env:
    EXPECTED_SHA: ${{ steps.resolve_build.outputs.sha || github.event.workflow_run.head_sha || github.sha }}
  run: |
    actual=$(git rev-parse HEAD)
    if [ "$actual" != "$EXPECTED_SHA" ]; then
      echo "Checked-out build $actual does not match the selected build $EXPECTED_SHA." >&2
      exit 1
    fi
    echo "Deploying build $actual to $TARGET_ENVIRONMENT"
```

- The same `EXPECTED_SHA` expression is reused by the Render step (`TARGET_SHA`) and the Vercel step (`--meta githubCommitSha="$TARGET_SHA"`).
- On `workflow_run`, the resolver output is empty, so the expression falls back to `head_sha`; the step still prints the deployed build.

### 5. Deploy-contract gate (`Check selected build deploy contract`, dispatch-only, after install)

```bash
git fetch --depth=1 origin "$PIPELINE_SHA"
if ! git diff --quiet "$PIPELINE_SHA" -- \
  src/backend/src/deploy/render-env.ts \
  src/backend/src/deploy/render-env-cli.ts \
  src/backend/src/auth/config.ts \
  src/backend/src/db/migrate-cli.ts \
  src/backend/src/db/migrate-runner.ts \
  src/backend/src/db/migrate.ts \
  tests/e2e/deployed-smoke.mjs; then
  echo "Build $SELECTED_SHA has a different deploy/migration/smoke contract than the dispatch ref $PIPELINE_SHA; refusing to deploy a build that predates the current deployment contract." >&2
  exit 1
fi
if ! node -e "require.resolve('pg')" >/dev/null 2>&1; then
  echo "Build $SELECTED_SHA does not include the pg dependency required by the deployment tooling; refusing to deploy." >&2
  exit 1
fi
echo "Deploy contract OK for $SELECTED_SHA (guard/migration/smoke identical to $PIPELINE_SHA)."
```

- `PIPELINE_SHA = ${{ github.sha }}` (dispatch ref tip); `SELECTED_SHA = ${{ steps.resolve_build.outputs.sha }}`.
- The migration **SQL** is excluded: the selected build carries its own migration set, validated by the schema gate.
- The `auth/config.ts` file is included because `render-env.ts` imports `parseEmailSender` from it; the deployed smoke is included so an old build cannot run weaker E2E checks.
- The fetch runs after `actions/checkout` with its persisted credentials; a fetch failure fails the run with a clear message.
- The actual `run` block is executed by the harness against a local git remote with pass/changed/missing-pg fixtures.

### 6. Schema-compatibility gate (`Check selected build schema compatibility`, dispatch-only, before migration)

Read the applied set (missing table = zero applied):

```bash
applied=$(node -e '
const { Client } = require("pg");
(async () => {
  const client = new Client({ connectionString: process.env.DIRECT_DATABASE_URL });
  await client.connect();
  try {
    const exists = await client.query("select to_regclass(\u0027public.schema_migrations\u0027) as t");
    if (!exists.rows[0].t) return;
    const result = await client.query("select name from schema_migrations order by name");
    process.stdout.write(result.rows.map((row) => row.name).join("\n"));
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error("Unable to read schema_migrations:", error.message);
  process.exit(1);
});
')
```

Compare:

```bash
missing=""
while IFS= read -r migration; do
  [ -z "$migration" ] && continue
  if [ ! -f "src/backend/src/db/migrations/$migration" ]; then missing="$missing $migration"; fi
done <<< "$applied"
if [ -n "$missing" ]; then
  echo "Build $TARGET_SHA predates applied migration(s):$missing; refusing to deploy a build older than the migrated schema." >&2
  exit 1
fi
local_count=$(find src/backend/src/db/migrations -maxdepth 1 -name '*.sql' | wc -l)
applied_count=$(printf '%s\n' "$applied" | grep -c . || true)
echo "Schema compatibility OK for $TARGET_SHA: $local_count migration(s) in build, $applied_count applied on the target branch."
```

- The selected build's migration SQL is what the next step applies through the current migration runner (the contract gate guarantees the runner matches).
- The gate compares **names** under the project's **immutable-migration policy** (applied files never edited; new changes are new numbered files). The docs record the policy; a policy relaxation requires content hashes (F11).
- A build before an applied migration fails closed; the owner can select an eligible build or use the Neon PITR runbook (Q-3).
- The actual `run` block is executed by the harness with a stub `pg` module: pass, missing `007_economy_revision.sql`, missing `schema_migrations` table.

### 7. Render contract (`Deploy Render backend` + `Wait for Render deploy to complete`)

**7a. Creation (manual dispatch).** The Trigger Deploy API reference's OpenAPI definition (`https://api-docs.render.com/reference/create-deploy`) declares `responses: 201 Created` (deploy object: `id`, `commit.id`, `status`) and `202 Queued` (no content). The deploy-hook documentation (`https://render.com/docs/deploy-hooks`) describes `202 Accepted` as a different deploy already in progress for the service under the workspace's `Wait` overlapping-deploy policy and states the body does not include a deploy ID. The API `201` deploy object can still be `created`/`queued`; the completion poll is authoritative. A 202 is fail-closed because it carries no deploy ID to poll.

```bash
response_file=$(mktemp)
status=$(curl -sS -o "$response_file" -w '%{http_code}' -X POST \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
  -H "accept: application/json" -H "content-type: application/json" \
  -H "authorization: Bearer $RENDER_API_KEY" \
  --data "{\"commitId\":\"$TARGET_SHA\",\"clearCache\":\"do_not_clear\"}")
if [ "$status" = "202" ]; then
  echo "Render deploy queued behind an in-progress deploy (HTTP 202); re-run after it completes." >&2
  rm -f "$response_file"; exit 1
fi
if [ "$status" != "201" ]; then
  echo "Render deploy failed (HTTP $status); refusing to continue." >&2
  rm -f "$response_file"; exit 1
fi
deploy_id=$(node -e "const fs=require('node:fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(d.id||'')" "$response_file")
deploy_commit=$(node -e "const fs=require('node:fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write((d.commit&&d.commit.id)||'')" "$response_file")
deploy_status=$(node -e "const fs=require('node:fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(d.status||'created')" "$response_file")
rm -f "$response_file"
case "$deploy_id" in
  dep-*) ;;
  *) echo "Render deploy id $deploy_id does not start with dep-; refusing to continue." >&2; exit 1 ;;
esac
if [ "$deploy_commit" != "$TARGET_SHA" ]; then
  echo "Render deploy commit mismatch: expected $TARGET_SHA, got ${deploy_commit:-none}; refusing to continue." >&2
  exit 1
fi
echo "Render deploy: $deploy_id $deploy_status for $TARGET_SHA"
echo "deploy_id=$deploy_id" >> "$GITHUB_OUTPUT"
```

The deploy step carries `id: render_deploy`; the completion step reads `DEPLOY_ID: ${{ steps.render_deploy.outputs.deploy_id }}`. On the automatic path the output is empty and the automatic branch does not use it.

**7b. Completion (manual dispatch).** `Wait for Render deploy to complete` polls the selected deploy and then proves it is the service's current/latest deploy:

```bash
timeout_seconds=${RENDER_DEPLOY_TIMEOUT_SECONDS:-900}
poll_interval=${RENDER_DEPLOY_POLL_INTERVAL_SECONDS:-10}
deadline=$((SECONDS + timeout_seconds))
status=""
while [ "$SECONDS" -lt "$deadline" ]; do
  if ! body=$(curl -fsS "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys/$DEPLOY_ID" \
    -H "accept: application/json" -H "authorization: Bearer $RENDER_API_KEY"); then
    echo "Render deploy status GET failed transiently; retrying in ${poll_interval}s."
    sleep "$poll_interval"
    continue
  fi
  if ! status=$(printf '%s' "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{process.stdout.write((JSON.parse(s).status)||'')})"); then
    echo "Render deploy status response was unreadable; retrying in ${poll_interval}s."
    sleep "$poll_interval"
    continue
  fi
  case "$status" in
    live) break ;;
    build_failed|update_failed|canceled|pre_deploy_failed|deactivated)
      echo "Render deploy $DEPLOY_ID ended with status $status for $TARGET_SHA; refusing to continue." >&2
      exit 1 ;;
  esac
  sleep "$poll_interval"
done
if [ "$status" != "live" ]; then
  echo "Render deploy $DEPLOY_ID did not reach live within ${timeout_seconds}s (last status: ${status:-unknown}); refusing to continue." >&2
  exit 1
fi
latest=$(curl --retry 3 --retry-delay 5 --retry-all-errors -fsS "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys?limit=1" \
  -H "accept: application/json" -H "authorization: Bearer $RENDER_API_KEY")
current_id=$(printf '%s' "$latest" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);process.stdout.write((a[0]&&a[0].deploy&&a[0].deploy.id)||'')})")
current_commit=$(printf '%s' "$latest" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);process.stdout.write((a[0]&&a[0].deploy&&a[0].deploy.commit&&a[0].deploy.commit.id)||'')})")
if [ "$current_id" != "$DEPLOY_ID" ] || [ "$current_commit" != "$TARGET_SHA" ]; then
  echo "Render service current deploy $current_id ($current_commit) does not match the selected deploy $DEPLOY_ID ($TARGET_SHA); refusing to continue." >&2
  exit 1
fi
echo "Render current deploy: $current_id $current_commit"
echo "Render deploy live: $DEPLOY_ID for $TARGET_SHA"
```

- `RENDER_DEPLOY_TIMEOUT_SECONDS` defaults to 900 and `RENDER_DEPLOY_POLL_INTERVAL_SECONDS` to 10; the workflow sets neither, and the harness sets short overrides so the timeout path executes.
- Transient GET/5xx/network failures and unreadable responses are retried until the deadline; only a terminal status, the timeout or a current-deploy mismatch fails closed.
- The latest-deploy read uses bounded `curl --retry 3 --retry-delay 5 --retry-all-errors`; a persistent failure fails closed.

**7c. Automatic `workflow_run` branch.** The existing hook stays and the completion step's automatic branch keeps the existing 45 s head start (the hook does not provide a deploy ID to poll):

```bash
curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"
echo "Render deploy triggered by hook for $TARGET_SHA"
```

```bash
# Wait for Render deploy to complete (automatic branch)
sleep 45
echo "Render deploy hook started; using the existing 45 s head start (no deploy id to poll)."
```

- The automatic branch is unchanged and the completion/current-deploy proof is manual-only. The hook is never used for a selected old build.
- The response body is never printed; only `id/status/commit.id` are extracted. `fs.readFileSync` + `JSON.parse` is used because the `mktemp` response file has no JSON extension and `require()` would try to execute it as JavaScript.
- A 202 is fail-closed because there is no deploy ID to track; a 201 with `created`/`queued` is handled by the completion poll.

### 8. Vercel contract (`Build`/`Deploy Vercel frontend`)

```yaml
- name: Deploy Vercel frontend
  id: vercel_deploy
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
    VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
    TARGET_SHA: ${{ steps.resolve_build.outputs.sha || github.event.workflow_run.head_sha || github.sha }}
  run: |
    deploy_output=$(vercel deploy --prebuilt --prod --yes --meta githubCommitSha="$TARGET_SHA")
    printf '%s\n' "$deploy_output"
    deployment_url=$(printf '%s\n' "$deploy_output" | tail -n 1)
    echo "deployment_url=$deployment_url" >> "$GITHUB_OUTPUT"
    echo "Vercel deployment: $deployment_url for $TARGET_SHA"
```

- The build runs from the selected checkout, so `src/frontend` and its `vercel.json` are the selected revision; `vercel pull`/`build` keep the current project settings and environment values.
- `--meta githubCommitSha` records the selected SHA for traceability; T3 attempts a `vercel inspect --json` read-back and, if the projection omits custom meta, records `Vercel metadata projection: unavailable` with the deployment ID and checkout/Render evidence (F3).

### 9. Automatic-development and manual-development contracts

- **Automatic:** `on.workflow_run` exactly `workflows: [CI]`, `types: [completed]`, `branches: [main]`; job `if` exactly `github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')`; `Reject non-push CI runs` unchanged; resolver/guard/contract/schema skipped; checkout `head_sha`; Render hook; completion automatic branch `sleep 45`; Vercel same checkout; warm + smoke. The only additions are `Confirm selected build checkout` and the Vercel `--meta` line.
- **Manual development:** `environment=development`, default `build=latest` resolves `github.sha` (`dispatch-ref`); the Render API `commitId` deploys `github.sha` (instead of the hook's `main` tip), matching the Vercel build's dispatch ref; a non-default selection fails closed. This is an explicit mechanism alignment, not an unchanged path.

### 10. CI parse and gate-harness contract

Update `Validate deploy workflow dispatch choices`:
- trigger keys exactly `workflow_dispatch,workflow_run`; `workflow_run` exactly `workflows: [CI]`, `types: [completed]`, `branches: [main]`;
- input keys exactly `build,build_sha,environment`;
- environment fields/options/default/description unchanged;
- job `if`, checkout ref (new expression), one job, concurrency, environment/TARGET_ENVIRONMENT mapping;
- no `push` trigger.

Add `Validate deploy build selection contract` after it, before `Check deploy workflow has no Fly deploy path`:
- `build` fields key set exactly `default,description,options,required,type`; `type=choice`, `required=true`, `default=latest`, exact options array, exact description;
- `build_sha` fields key set exactly `default,description,required,type`; `type=string`, `required=false`, `default=''`, exact description;
- `Resolve selected build` step exists with `id=resolve_build`, dispatch `if`, the Actions API URL, the `awk`/`sed` pipeline, the `build_sha` regex and the production-only message;
- `Verify CI succeeded` uses `steps.resolve_build.outputs.sha`, has `--event push --branch main` and the compare `ahead|identical`;
- checkout ref exact new expression; `Confirm selected build checkout` exists;
- `Check selected build deploy contract` exists with the seven-file list and the `git diff --quiet` pattern;
- `Check selected build schema compatibility` exists between the Brevo guard and the migration with `schema_migrations` and the migration directory;
- `Deploy Render backend` contains the API URL, `commitId`, the 202 message, the `dep-` prefix check, the hook branch and the `id: render_deploy`/`steps.render_deploy.outputs.deploy_id` wiring;
- `Wait for Render deploy to complete` exists with the GET deploy poll, the `RENDER_DEPLOY_TIMEOUT_SECONDS`/`RENDER_DEPLOY_POLL_INTERVAL_SECONDS` defaults, transient retry, `status: live`, the failure statuses, the `deploys?limit=1` current-deploy check and the automatic `sleep 45` branch;
- `Deploy Vercel frontend` contains `--meta githubCommitSha`;
- the deploy step name list is the exact 21-step list with `Wait for Render deploy to complete`;
- the `verify-workflows` step list is exactly `Checkout`, `Setup Node`, `Install dependencies`, `Lint GitHub Actions workflows`, `Validate Vercel config`, `Validate Render blueprint`, `Validate deploy workflow dispatch choices`, `Validate deploy build selection contract`, `Check deploy workflow has no Fly deploy path`, `Guard rejects placeholder values`, `Guard accepts a complete value set`.

**Harness (`tests/deploy/gate-fixtures.mjs`).** The harness:
1. loads `.github/workflows/deploy.yml` and `.github/workflows/ci.yml` with `js-yaml`;
2. extracts the actual `run` strings for `Resolve selected build`, `Verify CI succeeded for target commit`, `Check selected build deploy contract`, `Check selected build schema compatibility`, `Deploy Render backend`, `Wait for Render deploy to complete` and `Validate deploy build selection contract`;
3. executes them with a temp `PATH` stub `gh` (Actions runs list, guard conclusion, compare status), a temp git repo + local bare remote (selected/pipeline commits), a temp stub `curl` (POST 201/202 and bodies, GET deploy status sequences/transient failures, latest-deploy responses) and a temp `pg` stub module (`schema_migrations` rows, missing table). The temp stub `pg` directory is **first** on `NODE_PATH`, followed by the repo's `node_modules` for `js-yaml`/other imports, so both `require.resolve('pg')` (contract) and `require('pg')` (schema) resolve the stub;
4. sets short `RENDER_DEPLOY_TIMEOUT_SECONDS`/`RENDER_DEPLOY_POLL_INTERVAL_SECONDS` overrides for the timeout case;
5. asserts the exact messages for every case and prints `PASS <case>`; a failure exits non-zero.

Required harness cases: resolver `latest`, `previous-1`, `previous-9`, unavailable, `pinned`, `dispatch-ref`, malformed `build_sha`, mixed `build`+`build_sha`, development non-default; guard success, CI failure, missing run, not-on-main; contract pass, changed contract file, missing `pg`; schema pass, missing `007_economy_revision.sql`, missing `schema_migrations` table; Render creation 201/202/non-`dep-`/commit-mismatch; Render completion `live`/`build_failed`/`update_failed`/`canceled`/`pre_deploy_failed`/`deactivated`/timeout/transient-retry/latest-deploy match/latest-deploy mismatch; CI build parse pass and its `verify-workflows` step-list position. The T1/T4 verify executes the harness and records each `PASS` line.

### 11. Documentation contract

- `README.md` § Deployment / § What the pipelines run / § Deploy flow: production build selection, options/default, relative-label explanation, resolved-SHA/CI-run lines, `build_sha` exact selector with the lowercase full-SHA rule, same-SHA guarantee including the Render `live`/current-deploy proof, contract/schema rules and immutable-migration policy, command, automatic-development-unchanged/manual-development-aligned statement.
- `docs/architecture/deployment.md` § Environments and triggers, § Deploy pipeline, § Rollback, § Neon migrations and the supersession ledger: production build selection, build definition, resolver/guard/contract/schema, Render completion/current-deploy proof, `--ref main` two-part rule, relative-label/resolved-line explanation, lowercase `build_sha`, immutable-migration policy, known-good-build rollback, ledger row.
- `docs/architecture/vercel-render-neon.md` § Environment catalog, § Runbook (`### Production deploy with build selection`), § Troubleshooting, § Rollback, § Local development vs cloud, § Supersession ledger: the same contract with provider-specific notes (Render 201/202, completion poll, current-deploy mismatch, Vercel metadata or `Vercel metadata projection: unavailable`, per-provider vs coordinated rollback).
- `docs/architecture/containerization.md` § Container conventions: update **both** release-identity statements (lines 37 and 42) to the selected build SHA for a manual production dispatch, the dispatch SHA (`github.sha`) for a manual development dispatch and `workflow_run.head_sha` for the automatic path; no image/port/compose change.
- `docs/features/README.md`: propose only `production-build-selection | Production Build Selection | accepted | 2026-11-27`; do not edit. `status.md` is orchestrator-owned.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `.github/workflows/deploy.yml` | Edit | Build/`build_sha` inputs, resolver, resolved-SHA guard + compare, checkout/confirm, contract/schema gates, Render API commitId + completion/current-deploy proof, Vercel `--meta`, automatic hook/45 s preserved | T1 |
| `.github/workflows/ci.yml` | Edit | Updated dispatch parse + new build-selection parse in `verify-workflows` | T1 |
| `tests/deploy/gate-fixtures.mjs` | New | Executes the actual resolver/guard/contract/schema/Render creation/completion/CI-parse `run` blocks against fixtures (no reimplementation) | T1 |
| `README.md` | Edit | Production build selection section, relative labels/resolved line, lowercase `build_sha`, immutable policy, commands, automatic/manual development statement | T2 |
| `docs/architecture/deployment.md` | Edit | Trigger/pipeline/build/rollback/ledger/completion/immutable-policy updates | T2 |
| `docs/architecture/vercel-render-neon.md` | Edit | Production runbook, completion/troubleshooting, rollback, catalog note, ledger | T2 |
| `docs/architecture/containerization.md` | Edit | Both release-identity statements (lines 37 and 42) | T2 |
| `docs/features/production-build-selection/build-log-T1.md` | New | Dependency gate, workflow diff, actionlint, parses, harness case results, exact-message assertions | T1 |
| `docs/features/production-build-selection/build-log-T2.md` | New | Docs greps, link checks, proposed feature-index row | T2 |
| `docs/features/production-build-selection/build-log-T3.md` | New | Live previous-build/live/current-deploy proof, latest restore, automatic development proof, shortened evidence | T3 |
| `docs/features/production-build-selection/build-log-T4.md` | New | Final gate, harness/parse execution, live evidence reproduction, final report | T4 |

Untouched by design: `src/**`, `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`, `render.yaml`, `src/frontend/vercel.json`, `package.json`, `package-lock.json`, `.env*`, `docs/features/README.md`, `docs/features/production-build-selection/status.md`, every provider resource (no resource is created, renamed or deleted), and all `tests/**` except the new `tests/deploy/gate-fixtures.mjs` harness.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | A "build" is a successful `CI` **push** run on `main`; the commit SHA is the identity; Vercel deployments, Render deploys and Deploy-workflow runs are not the selection unit | CI already verified the exact tree; rebuilding from that SHA re-runs the guard/catalog and lets both providers ship one revision. Vercel/Render artifacts are per-provider, may carry stale build-time config, and a Deploy run re-executes an old pipeline version. | Select a Vercel deployment ID — frontend only; select a Render deploy ID — backend only; re-run a Deploy run — same commit but old pipeline/inputs; none coordinates both under the current guard. |
| D-2 | Ship a static relative dropdown (`latest`, `previous-1` … `previous-9`) plus an optional `build_sha`; no generated/bot list and no external UI; Q-1 requires owner acceptance at the approval checkpoint | Native GitHub has no dynamically populated `choice` options; relative options are a real dropdown, default to latest, require no write to `main`, add no automation and remain reviewable. `build_sha` covers exact builds. The owner explicitly accepts the relative-label trade-off. | Generated SHA list (B) — a scheduled workflow/bot must commit to `main`, with drift and permission cost; external UI (C) — leaves native GitHub; re-run/promote/rollback (D) — uncoordinated and skips the guard. |
| D-3 | Build selection is production-only; automatic development and manual development defaults are preserved, with the manual Render mechanism aligned | The request targets production; preserving `workflow_run.head_sha` and `github.sha` keeps the accepted defaults. The manual Render API `commitId` removes the old hook/main-tip mismatch and matches the Vercel dispatch-ref build. | Selection for development too — changes the accepted path, Q-4; leave the manual hook — can mix Render `main` with the Vercel dispatch SHA. |
| D-4 | Guard the **resolved** SHA, not the dispatch SHA; require a successful `CI` push run on `main` and compare `ahead`/`identical` | The dispatch SHA is the workflow ref (`main` tip), not the selected build. The compare gate proves the selected SHA is on `main`; `--event push` excludes PR runs. This also enforces the documented `--ref main` rule. | Trust `build_sha` after regex only — deploys an unverified/non-main SHA; check the dispatch SHA — the wrong revision; substring/absence of compare — a merged branch SHA could slip through. |
| D-5 | Add deploy-contract identity and schema-compatibility gates before the migration; compare applied migration **names** under the immutable-migration policy | The selected build's guard/sync/migration/smoke scripts run after checkout; an old build could run a weaker guard or an older smoke, and an old backend could run against a newer schema. The project never edits an applied migration; a name match is sufficient under that policy. | Trust the selected build's old guard — violates "same guard/catalog"; allow an override — unsafe, Q-3; run old code against new schema — can break data; content hashes now — extra complexity unless the policy is relaxed. |
| D-6 | Manual dispatches deploy Render through `POST /v1/services/{id}/deploys {commitId}`, poll the selected deploy to `status: live`, then verify the service's current/latest deploy and commit; the automatic path keeps the hook + 45 s | The hook builds `main` head and cannot deploy a selected SHA; a 201/created deploy is not proof the selected revision is serving. The completion/current-deploy proof closes the old-instance false positive. The automatic path has no deploy ID from the hook and stays unchanged. | Hook for selected builds — deploys `main`, not the selection; API for every path — changes automatic development and has no hook deploy ID; fixed sleep only — false positive. |
| D-7 | Vercel builds the selected checkout and records `--meta githubCommitSha`; no `vercel promote` | The Vercel project is not Git-linked and Actions is the only deploy path; building from the selected checkout applies the current environment values and the selected `src/frontend`/`vercel.json`. Promotion reuses an old artifact and cannot prove the same current config or backend revision. | `vercel promote` a previous deployment — frontend-only, stale build config; select a Vercel deployment — not a build. |
| D-8 | Keep the 23-name catalog, protection, trigger and fixed order; add no secret/variable/environment | The request is a selection parameter; the production environment is already provisioned and protected. A new secret/variable would widen the surface and reopen the provisioning spec. | New catalog name — unnecessary; new environment — forbidden; production push trigger — forbidden. |
| D-9 | Update the `ci.yml` parses and add a harness that executes the actual gate `run` blocks; base the feature after `production-provisioning` acceptance (PR #4 already merged as `d10dfb1`; T6 complete/production live; T7 in progress; T8 pending) | The current parse pins the one-input dispatch shape and the 17-step list; the feature must update it in the same change. The harness proves the resolver/guard/contract/schema/Render creation/completion logic rather than a parallel reimplementation. Starting before T8 causes a `deploy.yml` conflict and makes the docs task target a pre-live state. | Edit `deploy.yml` before T8 — conflicts; skip the parse update — CI red; fixtures that reimplement the gates — F2/F15; update docs before T7 — docs drift. |
| D-10 | The live proof is owner-gated and includes a `latest` restore; no application code | A real previous-build deploy with `status: live`/current-deploy proof is the only end-to-end proof; restoring latest leaves production healthy. The feature is workflow/config/docs plus a test harness, so no workspace source change and the coverage bar stays the final no-regression gate. | Static-only proof — cannot prove Render/Vercel same-revision; leave production on an old build — undesirable; add app code — unnecessary scope and coverage cost. |
| D-11 | Record the Trigger Deploy API's 201/202 behavior and treat 202 as fail-closed; the completion poll is the authority for 201 | The Trigger Deploy API OpenAPI definition declares `responses: 201 Created` (deploy object) and `202 Queued` (no content); the deploy-hook documentation describes `202 Accepted` as an in-progress deploy under the `Wait` policy with no deploy ID. A 202 has no deploy ID to track, so proceeding could pass against the old instance; the completion poll handles a 201 deploy that starts `created`/`queued`. | Assume 202 never happens — F5; treat 202 as success — no deploy ID; rely on the old sleep — false positive. |

## Risks & mitigations

- **`production-provisioning` is not accepted** → T1 is a hard gate: it checks `state: accepted`, `origin/main` and the local `.github/workflows/deploy.yml` contain `gh run list --repo "$GITHUB_REPOSITORY"`, the 15/8 names and the branch policy; otherwise it records `BLOCKED: production-provisioning is not accepted` and stops. Current state: PR #4 merged `d10dfb1`; T6a complete; T6 complete and production live (Render `dep-dc4o1fff3r2c73c4asp0`, Vercel `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq`, smoke 8/8); T7 in progress; T8 pending.
- **The local `deploy.yml` lacks the T6a fix** → The current local file already has it; T1 still checks both `origin/main` and the local file and must not recreate or revert the one-line fix. The one `gh run list` stays `--repo "$GITHUB_REPOSITORY"`; the resolver uses the Actions API.
- **The Render API returns 202 (queued behind an in-progress deploy)** → Fail closed with the exact message; re-run after the in-progress deploy finishes. A 201 whose status is `created`/`queued` is polled to `live`. Never proceed without a deploy ID or against the old instance.
- **The Render deploy never becomes live or the service's current deploy is not the selected one** → The completion step fails on terminal failure statuses, the default 900 s timeout (env-overridable; the harness uses a short override), or a current-deploy ID/commit mismatch; health/Vercel/smoke do not run. The operator inspects the Render deploy logs and re-runs the same build.
- **The automatic `workflow_run` path has a pre-existing main-advance race** → The hook builds the service's tracked `main`, which can advance between the CI run and the hook; the Vercel build uses `workflow_run.head_sha`, so the automatic path can briefly mix revisions if `main` moves. This feature leaves that accepted behavior unchanged and pins only the production selected-build path (and the manual development dispatch) to one SHA; the docs state the scope.
- **The harness stubs diverge from the real commands** → The harness extracts the actual `run` strings from the workflow YAML (failing if a step name or body is missing) and stubs only the external surfaces (`gh`, git remote, `curl`, `pg`); the stub `pg` directory is first on `NODE_PATH` so both `require.resolve('pg')` and `require('pg')` use it, with the repo modules after it for `js-yaml`/other imports. The T1/T4 build logs record every `PASS` line. A changed step body fails the harness until the fixture is updated.
- **A selected build predates the current guard/catalog/migration/smoke contract** → The contract gate fails closed before the Brevo guard; the operator selects an eligible build (or `build_sha` of an eligible one). The docs state the eligibility rule.
- **A selected build predates an applied migration** → The schema gate fails closed before the migration; the operator selects a build at/after the schema head. A true rollback needs the Neon PITR runbook (separate owner operation). The gate is name-based under the immutable-migration policy; a policy relaxation requires content hashes.
- **The relative dropdown is mistaken for a fixed build list** → The resolver prints the resolved SHA and CI run; the docs define `previous-N` relative to the latest successful build, not the previous deploy; `build_sha` covers exact builds (Q-1/Q-2). Q-1 requires owner acceptance before building.
- **A per-provider rollback creates a mixed revision** → The docs state the coordinated path is a build-selection deploy of the known-good SHA; `vercel promote`/Render rollback are emergency tools that must use same-SHA artifacts and be followed by the smoke.
- **The selected build re-reads current config and an old config is expected** → The docs state the selected build does not restore historical environment values; restore the value explicitly in the GitHub Environment, re-deploy, and re-validate. Stale configuration is never restored silently.
- **A non-`main` dispatch slips through** → The guard's `--branch main`/compare and the `production` Environment branch policy both block it; a manual development dispatch from a non-`main` ref also fails the guard.
- **Secret leakage through the Render response or pg errors** → Parse only `id/status/commit.id` and the completion statuses; never print the response body; print only `error.message` from pg; no `set -x`; GitHub masks secrets; the credential guard runs over every build log.
- **The Vercel metadata projection omits custom meta** → The `--meta` flag and the printed line remain; T3 records `Vercel metadata projection: unavailable` plus the deployment ID and the checkout/Render same-SHA evidence, matching AC-4(d). The build log does not invent a commit read-back.
- **The CI parse update conflicts with `production-provisioning` T7/T8** → The feature starts after T8; the new parse supersedes the one-input/17-step assertions but keeps the trigger choices/defaults, automatic job `if`, permissions and concurrency.
- **The owner cannot approve the production gate or has not accepted Q-1** → The live proof waits; the feature stays in building and no bypass is added.
- **Docs drift** → T2 pins exact positive/negative greps (including both containerization release-identity statements and the old 45 s phrase) and a link check; T4 re-runs them and the stale-claim scan.
- **The build log contains a full SHA (the T8 long-hex issue)** → Build logs record short 7–12 character SHAs labeled `Shortened evidence: 7–12 character SHAs; full SHAs only in the temporary run logs`; fixture full SHAs live in temporary files; the `[0-9a-f]{32,}` guard runs over every build log.

## Open questions

Mirrors `spec.md` § Open questions; none block planning/building.

- Q-1 — dropdown design: static relative + `build_sha` (default) vs generated SHA list vs external UI vs re-run/promote/rollback; **owner acceptance required at the approval checkpoint**.
- Q-2 — "previous" = previous successful CI build (default) vs previous production deploy.
- Q-3 — old-build eligibility: fail closed under the immutable-migration policy (default) vs an explicit override; a policy relaxation requires content hashes.
- Q-4 — selection scope: production only (default) vs manual development too.
- Q-5 — dropdown depth: 10 options (default) vs another count.

## Verification plan (task-to-command map)

| Task | Primary proof |
| --- | --- |
| T1 | Dependency gate (`production-provisioning` `state: accepted`; `origin/main` and local T6a line; 15/8 names; branch policy/reviewers); `npm ci`; pinned actionlint over both workflows; the updated dispatch parse and new build parse (including the `ci.yml` 11-step list and execution of the new parse's `run` block); `vercel.json`/`render.yaml` parses; `node tests/deploy/gate-fixtures.mjs` executing the actual resolver/guard/contract/schema/**Render creation/completion** blocks and the CI parse (all `render-*`/other cases PASS, incl. missing `schema_migrations`, 201/202/non-`dep-`/mismatch/statuses/timeout/transient-retry/current-deploy and every exact message); `deploy.yml` diff anchors; one `gh run list` with `--repo`; `dep-`/completion/current-deploy anchors; no app/container diff and only the harness under `tests`; `npm run coverage`; build-log guards |
| T2 | `actionlint`; the parses; exact README/deployment/vercel-render-neon/containerization positive and negative greps (relative labels, resolved line, lowercase `build_sha`, immutable policy, both release-identity statements, old 45 s phrase); link check; `docs/features/README.md`/`status.md` no-edit; `.env*` checks; credential audits; proposed index row |
| T3 | `gh run view` on the recorded production `previous-1` and `latest` restore runs: `Resolved build`, `CI succeeded`, `Deploy contract OK`, `Schema compatibility OK`, `Deploy configuration OK: 11 …`, nine `SYNCED`, `Render deploy: dep-… …`, `Render deploy live: dep-… for <sha>`, current-deploy ID/commit, `healthz OK after <n>s: {"status":"ok"}`, `Vercel deployment: … for <sha>` (or `Vercel metadata projection: unavailable`), `DEPLOYED SMOKE PASS (8/8 checks)`; Render deploy read-back live/commit; post-run health; the automatic development run; no mixed revision; protection not bypassed; shortened-SHA evidence; credential guard |
| T4 | Full gate (`npm ci`, lint, typecheck, test, `npm run coverage`, build, smoke, `node tests/deploy/gate-fixtures.mjs` including all `render-*` cases); actionlint; all parses/fixtures (including the executed `ci.yml` parse); docs greps and stale-claim scan (both containerization lines, old 45 s phrase); live evidence reproduction from T3 IDs; `.env*`/credential audits; no-edit checks; final report + proposed index row |
