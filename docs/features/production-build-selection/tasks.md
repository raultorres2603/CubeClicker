# Tasks — Production Build Selection

**r4b (F27):** removed the docs “no dropdown/relative labels” requirement from T2; the docs simply must not contain `dropdown|previous-[0-9]|relative label` or the old headings (the broad case-insensitive scan remains).

**r4a (spec-review r2, F23–F25):** the empty-`build_sha` resolver uses `.workflow_runs[0] // empty` and tests the parsed `sha`, so the harness `resolver-latest-unavailable` stub can return the real `{"total_count":0,"workflow_runs":[]}` shape and assert the exact failure; the resolver captures `created_at` and prints the exact `CI run: <id> <createdAt>` line, asserted by `resolver-latest`; T2/T4 stale scans case-insensitively reject `dropdown|previous-[0-9]|relative label` and the old headings; T3 records the 20 per-case `Pre-live harness` lines (no gate change).

**r3 (owner contract change):** the `build` dropdown/`choice` and all relative options are removed. The only selection input is the optional `build_sha` text field: empty = newest successful `CI` push build on `main`; set = that exact 40-character lowercase SHA (which may not be the latest). The resolver uses the Actions API `per_page=1` for empty and a validated exact SHA for set; the guard verifies the CI push run and the on-`main` compare for either source. T3 uses `build_sha=<prior-full-sha>` for the previous-build proof and omits `build_sha` for the latest restore; the old `previous-1` proof is superseded and must be re-run. T4 uses the post-merge base (`5209d80`) and does not expect the harness as a new addition.

Dependency overview: **T1 → T2 ∥ T3 → T4**. T1 is `[seq]` and is the only task that touches `.github/workflows/deploy.yml`/`.github/workflows/ci.yml` and the new gate harness. T2 (docs) and T3 (owner-gated live proof) are `[P]` after T1 because their `files_owned` are disjoint and they share no file; T3 additionally requires the owner to merge T1 to `main` before its production dispatch. T4 is the final `[seq]` verify-and-integrate task.

**Preconditions:** `production-provisioning` is accepted (T6 complete, T7 docs, T8 gate). Current state: PR #4 is merged as `d10dfb1`; T6a is complete; T6 is complete and production is live (Render `dep-dc4o1fff3r2c73c4asp0`, Vercel `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq`, deployed smoke 8/8); T7 is in progress and T8 is pending; the local `.github/workflows/deploy.yml` already contains the T6a `--repo "$GITHUB_REPOSITORY"` line; the feature branch is already merged at `5209d80`. T1 verifies `state: accepted` and the T6a line on `origin/main` and locally, and records `BLOCKED: production-provisioning is not accepted` (or the specific missing prerequisite) before editing any file. This feature does not reopen the provisioning spec, does not revert the T6a line, and does not change the 23-name catalog, protection rules or trigger model.

Task types: T1 is a pipeline/config change (workflow YAML, CI parse, and `tests/deploy/gate-fixtures.mjs`, which executes the actual gate `run` blocks); it adds no application code. The harness is the durable feature-appropriate test; T1/T4 run it and `npm run coverage` as the project no-regression bar. T2 is a documentation task. T3 is the owner-gated live proof (run log/provider evidence only; shortened SHAs). T4 is the final gate and runs the full repository suite, including `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace) and the harness. If any task discovers that application code is required, it stops and the spec is revised first; then the normal unit + integration test deliverables and coverage become mandatory.

## T1 — Build-SHA workflow contract, completion proof, CI parse and gate harness `[seq]`

depends_on: —
files_owned: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `tests/deploy/gate-fixtures.mjs`, `docs/features/production-build-selection/build-log-T1.md`
verify:
```bash
set -euo pipefail
mkdir -p /tmp/opencode
base=$(git merge-base origin/main HEAD)
# T1's harness-addition check uses the pre-merge base; the feature branch is merged at 5209d80.
pre_merge_base=$(git rev-parse 5209d80^1 2>/dev/null || printf '%s' "$base")

# Dependency / sequencing gate (current-state: PR #4 merged d10dfb1; T6a complete;
# T6 complete/production live; T7 in progress; T8 pending)
grep -q 'state: accepted' docs/features/production-provisioning/status.md
git show origin/main:.github/workflows/deploy.yml | grep -qF 'gh run list --repo "$GITHUB_REPOSITORY"'
grep -qF 'gh run list --repo "$GITHUB_REPOSITORY"' .github/workflows/deploy.yml
gh api repos/raultorres2603/CubeClicker/environments/production --jq '.deployment_branch_policy.custom_branch_policies' | grep -qx true
test "$(gh api repos/raultorres2603/CubeClicker/environments/production/deployment-branch-policies --jq '.branch_policies[].name' | grep -cx main)" -eq 1
if ! gh api repos/raultorres2603/CubeClicker/environments/production --jq '[.protection_rules[].type] | join(",")' | grep -q 'required_reviewers'; then
  grep -qF 'owner declined required reviewers' docs/features/production-provisioning/build-log-T5.md
fi
test "$(gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | wc -l)" -eq 15
test "$(gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | wc -l)" -eq 8

npm ci

# Workflow contract parse
node -e '
const fs=require("node:fs");const yaml=require("js-yaml");
const w=yaml.load(fs.readFileSync(".github/workflows/deploy.yml","utf8"));
const t=(w.on&&typeof w.on==="object")?w.on:w[true];
if(Object.keys(t).sort().join(",")!=="workflow_dispatch,workflow_run")throw new Error("triggers changed");
const wr=t.workflow_run;
if(JSON.stringify(wr.workflows)!==JSON.stringify(["CI"])||JSON.stringify(wr.types)!==JSON.stringify(["completed"])||JSON.stringify(wr.branches)!==JSON.stringify(["main"]))throw new Error("workflow_run trigger changed");
const inputs=t.workflow_dispatch.inputs;
if(Object.keys(inputs).sort().join(",")!=="build_sha,environment")throw new Error("dispatch inputs changed");
if(inputs.build)throw new Error("build choice must be removed");
const e=inputs.environment;
if(e.type!=="choice"||e.required!==true||e.default!=="production"||JSON.stringify(e.options)!==JSON.stringify(["production","development"]))throw new Error("environment input changed");
const s=inputs.build_sha;
if(s.type!=="string"||s.required!==false||s.default!=="")throw new Error("build_sha input changed");
if(s.description!=="Optional full 40-character lowercase commit SHA; empty = latest successful CI build on main; set = that exact commit, which may not be the latest on main")throw new Error("build_sha description changed");
const d=w.jobs.deploy;
if(Object.keys(w.jobs).length!==1)throw new Error("job count changed");
const expectedIf="github.event_name == \u0027workflow_dispatch\u0027 || (github.event.workflow_run.conclusion == \u0027success\u0027 && github.event.workflow_run.head_branch == \u0027main\u0027)";
if(d.if!==expectedIf)throw new Error("job condition changed");
const expectedRef=String.fromCharCode(36)+"{{ steps.resolve_build.outputs.sha || github.event.workflow_run.head_sha || github.sha }}";
if(d.steps.find(x=>x.name==="Checkout").with.ref!==expectedRef)throw new Error("checkout ref changed");
const expectedSteps=["Reject non-push CI runs","Resolve selected build","Verify CI succeeded for target commit","Checkout","Confirm selected build checkout","Setup Node","Install dependencies","Check selected build deploy contract","Check deployment Brevo configuration","Check selected build schema compatibility","Migrate Neon database","Sync Brevo SMTP settings to Render","Deploy Render backend","Wait for Render deploy to complete","Wait for Render backend health","Install Vercel CLI","Pull Vercel project settings","Build Vercel frontend","Deploy Vercel frontend","Warm Render backend before smoke","Run deployed smoke"];
if(JSON.stringify(d.steps.map(x=>x.name))!==JSON.stringify(expectedSteps))throw new Error("step list changed");
console.log("deploy.yml: build_sha input, 21-step order, completion step and same-SHA checkout pinned");
'

# Contract anchors
grep -qF 'actions/workflows/ci.yml/runs?event=push&branch=main&status=success&per_page=1' .github/workflows/deploy.yml
grep -qF '.workflow_runs[0] // empty' .github/workflows/deploy.yml
grep -qF 'No successful CI push build found on main; refusing to deploy.' .github/workflows/deploy.yml
grep -qF 'Build SHA selection is available for environment=production only; clear build_sha for a development dispatch.' .github/workflows/deploy.yml
! grep -qF 'previous-1' .github/workflows/deploy.yml
! grep -qE '^[[:space:]]+build:' .github/workflows/deploy.yml
grep -qF 'gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --event push --branch main --commit "$TARGET_SHA"' .github/workflows/deploy.yml
grep -qF 'compare/$TARGET_SHA...main' .github/workflows/deploy.yml
grep -qF 'ahead|identical' .github/workflows/deploy.yml
grep -qF 'git rev-parse HEAD' .github/workflows/deploy.yml
grep -qF 'Deploy contract OK for' .github/workflows/deploy.yml
grep -qF 'src/backend/src/deploy/render-env.ts' .github/workflows/deploy.yml
grep -qF 'src/backend/src/deploy/render-env-cli.ts' .github/workflows/deploy.yml
grep -qF 'src/backend/src/auth/config.ts' .github/workflows/deploy.yml
grep -qF 'src/backend/src/db/migrate-cli.ts' .github/workflows/deploy.yml
grep -qF 'src/backend/src/db/migrate-runner.ts' .github/workflows/deploy.yml
grep -qF 'src/backend/src/db/migrate.ts' .github/workflows/deploy.yml
grep -qF 'tests/e2e/deployed-smoke.mjs' .github/workflows/deploy.yml
grep -qF 'predates applied migration' .github/workflows/deploy.yml
grep -qF 'api.render.com/v1/services/' .github/workflows/deploy.yml
grep -qF 'commitId' .github/workflows/deploy.yml
grep -qF 'Render deploy queued behind an in-progress deploy (HTTP 202)' .github/workflows/deploy.yml
grep -qF 'does not start with dep-' .github/workflows/deploy.yml
grep -qF 'Wait for Render deploy to complete' .github/workflows/deploy.yml
grep -qF 'id: render_deploy' .github/workflows/deploy.yml
grep -qF 'steps.render_deploy.outputs.deploy_id' .github/workflows/deploy.yml
grep -qF 'deploys?limit=1' .github/workflows/deploy.yml
grep -qF 'Render deploy live:' .github/workflows/deploy.yml
grep -qF 'Render current deploy:' .github/workflows/deploy.yml
grep -qF 'RENDER_DEPLOY_HOOK_URL' .github/workflows/deploy.yml
grep -qF -- '--meta githubCommitSha' .github/workflows/deploy.yml
grep -qF 'Validate deploy build selection contract' .github/workflows/ci.yml
test "$(grep -c 'gh run list' .github/workflows/deploy.yml)" -eq 1
! grep -qE '^[[:space:]]*push:' .github/workflows/deploy.yml
! grep -qF 'the health poll cannot pass against the old instance' .github/workflows/deploy.yml

# Exact-message assertions for AC-2–AC-7 (the harness also executes these cases)
grep -qF 'build_sha must be a full 40-character lowercase commit SHA.' .github/workflows/deploy.yml
grep -qF 'Resolved build: $sha ($source)' .github/workflows/deploy.yml
grep -qF 'CI run: $ci_run $ci_created' .github/workflows/deploy.yml
grep -qF 'CI for $TARGET_SHA is not successful (conclusion: ${conclusion:-none}); refusing to deploy' .github/workflows/deploy.yml
grep -qF 'Build $TARGET_SHA is not on main (compare status: $status); refusing to deploy.' .github/workflows/deploy.yml
grep -qF 'CI succeeded for $TARGET_SHA' .github/workflows/deploy.yml
grep -qF 'Checked-out build $actual does not match the selected build $EXPECTED_SHA.' .github/workflows/deploy.yml
grep -qF 'Deploying build $actual to $TARGET_ENVIRONMENT' .github/workflows/deploy.yml
grep -qF 'Render deploy queued behind an in-progress deploy (HTTP 202); re-run after it completes.' .github/workflows/deploy.yml
grep -qF 'Render deploy id $deploy_id does not start with dep-; refusing to continue.' .github/workflows/deploy.yml
grep -qF 'Render deploy commit mismatch: expected $TARGET_SHA, got ${deploy_commit:-none}; refusing to continue.' .github/workflows/deploy.yml
grep -qF 'Render deploy: $deploy_id $deploy_status for $TARGET_SHA' .github/workflows/deploy.yml
grep -qF 'Render deploy $DEPLOY_ID ended with status $status for $TARGET_SHA; refusing to continue.' .github/workflows/deploy.yml
grep -qF 'timeout_seconds=${RENDER_DEPLOY_TIMEOUT_SECONDS:-900}' .github/workflows/deploy.yml
grep -qF 'poll_interval=${RENDER_DEPLOY_POLL_INTERVAL_SECONDS:-10}' .github/workflows/deploy.yml
grep -qF 'Render deploy $DEPLOY_ID did not reach live within ${timeout_seconds}s (last status: ${status:-unknown}); refusing to continue.' .github/workflows/deploy.yml
grep -qF 'Render service current deploy $current_id ($current_commit) does not match the selected deploy $DEPLOY_ID ($TARGET_SHA); refusing to continue.' .github/workflows/deploy.yml
grep -qF 'Render current deploy: $current_id $current_commit' .github/workflows/deploy.yml
grep -qF 'Render deploy live: $DEPLOY_ID for $TARGET_SHA' .github/workflows/deploy.yml
grep -qF 'has a different deploy/migration/smoke contract' .github/workflows/deploy.yml
grep -qF 'does not include the pg dependency' .github/workflows/deploy.yml
grep -qF 'Deploy contract OK for $SELECTED_SHA' .github/workflows/deploy.yml
grep -qF 'Deploy contract OK for $SELECTED_SHA (guard/migration/smoke identical to $PIPELINE_SHA).' .github/workflows/deploy.yml
grep -qF 'predates applied migration(s):' .github/workflows/deploy.yml
grep -qF 'Schema compatibility OK for $TARGET_SHA' .github/workflows/deploy.yml
grep -qF 'Schema compatibility OK for $TARGET_SHA: $local_count migration(s) in build, $applied_count applied on the target branch.' .github/workflows/deploy.yml

# Execute the actual gate blocks (resolver, guard, contract, schema, Render creation/completion) and the CI parse
node tests/deploy/gate-fixtures.mjs > /tmp/opencode/gate-fixtures.log
for case in resolver-latest resolver-latest-unavailable resolver-exact resolver-malformed resolver-development-default resolver-development-non-default guard-success guard-ci-failure guard-missing guard-not-on-main contract-pass contract-changed contract-missing-pg schema-pass schema-missing-007 schema-missing-table render-creation-201 render-creation-202 render-creation-non-dep render-creation-commit-mismatch render-completion-live render-completion-build-failed render-completion-update-failed render-completion-canceled render-completion-pre-deploy-failed render-completion-deactivated render-completion-timeout render-completion-transient-retry render-completion-current-match render-completion-current-mismatch ci-build-parse; do
  grep -qE "^PASS $case$" /tmp/opencode/gate-fixtures.log
done

# ci.yml verify-workflows step-list position + execution of the new parse
node -e '
const fs=require("node:fs");const yaml=require("js-yaml");
const c=yaml.load(fs.readFileSync(".github/workflows/ci.yml","utf8"));
const steps=c.jobs["verify-workflows"].steps;
const names=steps.map((s)=>s.name);
const expected=["Checkout","Setup Node","Install dependencies","Lint GitHub Actions workflows","Validate Vercel config","Validate Render blueprint","Validate deploy workflow dispatch choices","Validate deploy build selection contract","Check deploy workflow has no Fly deploy path","Guard rejects placeholder values","Guard accepts a complete value set"];
if(JSON.stringify(names)!==JSON.stringify(expected))throw new Error("verify-workflows step list changed");
const step=steps.find((s)=>s.name==="Validate deploy build selection contract");
fs.writeFileSync("/tmp/opencode/ci-build-parse.sh",step.run);
console.log("ci.yml: verify-workflows 11-step list and build parse pinned");
'
bash /tmp/opencode/ci-build-parse.sh

# Static config parses and lint
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml .github/workflows/ci.yml
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1)throw new Error('render.yaml must declare exactly one service');const s=b.services[0];if(s.name!=='cubeclicker-development'||s.runtime!=='docker'||s.plan!=='free')throw new Error('render.yaml changed');if(s.healthCheckPath!==undefined&&s.healthCheckPath!=='')throw new Error('render.yaml health check changed');console.log('render.yaml: one development service, unchanged')"

# No application/container change; T1's harness-addition check uses the pre-merge base and
# allows an empty tests diff when the feature is already merged at 5209d80.
git diff --exit-code "$base" -- src compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json render.yaml src/frontend/vercel.json ':(exclude)tests'
changed_tests=$( { git diff --name-only "$pre_merge_base" -- tests; git ls-files --others --exclude-standard -- tests; } | sort -u )
case "$changed_tests" in
  "tests/deploy/gate-fixtures.mjs"|"") ;;
  *) echo "unexpected tests change: $changed_tests" >&2; exit 1 ;;
esac
test -f tests/deploy/gate-fixtures.mjs
test -z "$(git ls-files --others --exclude-standard -- src)"

# Project bar
npm run coverage

# Build-log evidence and guards
test -f docs/features/production-build-selection/build-log-T1.md
grep -qF 'Dependency gate: production-provisioning accepted' docs/features/production-build-selection/build-log-T1.md
grep -qF 'T6a fix present on origin/main and locally' docs/features/production-build-selection/build-log-T1.md
test "$(grep -c 'Gate harness: PASS' docs/features/production-build-selection/build-log-T1.md)" -ge 31
for case in resolver-latest resolver-latest-unavailable resolver-exact resolver-malformed resolver-development-default resolver-development-non-default guard-success guard-ci-failure guard-missing guard-not-on-main contract-pass contract-changed contract-missing-pg schema-pass schema-missing-007 schema-missing-table render-creation-201 render-creation-202 render-creation-non-dep render-creation-commit-mismatch render-completion-live render-completion-build-failed render-completion-update-failed render-completion-canceled render-completion-pre-deploy-failed render-completion-deactivated render-completion-timeout render-completion-transient-retry render-completion-current-match render-completion-current-mismatch ci-build-parse; do
  grep -qF "Gate harness: PASS $case" docs/features/production-build-selection/build-log-T1.md
done
grep -qF 'Exact messages: PASS' docs/features/production-build-selection/build-log-T1.md
grep -qF 'ci.yml parse execution: PASS' docs/features/production-build-selection/build-log-T1.md
grep -qF 'actionlint: pass' docs/features/production-build-selection/build-log-T1.md
grep -qF 'No application code change; the only test addition is the feature-owned harness tests/deploy/gate-fixtures.mjs' docs/features/production-build-selection/build-log-T1.md
test -z "$(git status --porcelain -- '.env*')"
test -z "$(git diff --name-only "$pre_merge_base" -- '.env*')"
! grep -qE '[0-9a-f]{32,}' docs/features/production-build-selection/build-log-T1.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-build-selection/build-log-T1.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}" docs/features/production-build-selection/build-log-T1.md
```
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7(a)–(c), AC-8, AC-9, AC-12(a)–(d)
status: [ ]

Implement the build-SHA pipeline contract in `.github/workflows/deploy.yml`, its durable CI parse in `.github/workflows/ci.yml`, and the actual-block gate harness in `tests/deploy/gate-fixtures.mjs`; record the dependency gate, exact diff anchors, harness results and message assertions in `build-log-T1.md`.

1. **Inputs.** Keep the `environment` input byte-identical. Add only `build_sha` (`type: string`, `required: false`, `default: ''`, description `Optional full 40-character lowercase commit SHA; empty = latest successful CI build on main; set = that exact commit, which may not be the latest on main`). Remove the `build` choice/dropdown and all relative options. Keep the two triggers, job `if`, permissions, concurrency and action pins unchanged.
2. **Resolver.** Add `Resolve selected build` before `Verify CI succeeded for target commit` and `Checkout`: `if: github.event_name == 'workflow_dispatch'`, `id: resolve_build`, env `GH_TOKEN`, `ENVIRONMENT`, `BUILD_SHA`, `DISPATCH_SHA`. Empty `build_sha` (production) queries the Actions API `.../runs?event=push&branch=main&status=success&per_page=1` with `--jq '.workflow_runs[0] // empty | [.head_sha, (.id|tostring), .created_at] | @tsv'`, captures fields 1–3, tests the parsed `sha` (not the formatted TSV), sets `source=latest` and prints `Resolved build: <sha> (latest)` plus the exact `CI run: <ci_run> <ci_created>` line; an empty parsed SHA (the real `{"total_count":0,"workflow_runs":[]}` shape) fails with `No successful CI push build found on main; refusing to deploy.` Set `build_sha` validates `^[0-9a-f]{40}$`, sets `source=pinned` and prints `Resolved build: <sha> (pinned)`; malformed fails with `build_sha must be a full 40-character lowercase commit SHA.` Development with empty `build_sha` resolves `github.sha` (`dispatch-ref`); non-empty fails with `Build SHA selection is available for environment=production only; clear build_sha for a development dispatch.` Do **not** add `previous-N`, dedupe/index code or a second `gh run list`; the T6a count invariant stays true.
3. **Guard.** Change `Verify CI succeeded for target commit` to `TARGET_SHA: ${{ steps.resolve_build.outputs.sha }}`; keep `gh run list --repo "$GITHUB_REPOSITORY"` and add `--event push --branch main`; add the compare API `ahead|identical` check with the exact failure message. Do not change the guard condition or the step's dispatch-only `if`.
4. **Checkout and confirm.** Set `Checkout.with.ref` to `${{ steps.resolve_build.outputs.sha || github.event.workflow_run.head_sha || github.sha }}`; add `Confirm selected build checkout` immediately after checkout with the `git rev-parse HEAD` assertion and the `Deploying build <sha> to <environment>` line.
5. **Contract gate.** Add `Check selected build deploy contract` after `Install dependencies` and before the Brevo guard: fetch `${{ github.sha }}`, `git diff --quiet` over the seven contract files, `require.resolve('pg')`, exact messages, and the `Deploy contract OK for <sha>` line.
6. **Schema gate.** Add `Check selected build schema compatibility` after `Check deployment Brevo configuration` and before `Migrate Neon database`: read `SELECT name FROM schema_migrations` with a Node/`pg` one-liner through `DIRECT_DATABASE_URL` (missing table = zero applied), compare every applied name with the selected checkout's `src/backend/src/db/migrations/*.sql`, fail with the exact message, print the exact success line, never print the connection string. The gate compares names under the documented immutable-migration policy.
7. **Render creation + completion.** In `Deploy Render backend`, branch on `github.event_name`: on `workflow_dispatch` call the Render API `POST /v1/services/{id}/deploys` with `commitId` and `clearCache: do_not_clear`, require 201 + a `dep-` `.id` + `.commit.id`, fail closed on 202, non-`dep-` ID or commit mismatch, print `Render deploy: … for <sha>`; on `workflow_run` keep `curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"`. Rename `Wait for Render deploy to start` to `Wait for Render deploy to complete` (keep the 21-step count): on `workflow_dispatch` poll `GET /v1/services/{id}/deploys/{deployId}` every `RENDER_DEPLOY_POLL_INTERVAL_SECONDS` (default 10) for up to `RENDER_DEPLOY_TIMEOUT_SECONDS` (default 900) until `status: live`, retrying transient 5xx/network/unreadable GET responses until the deadline; fail on `build_failed`/`update_failed`/`canceled`/`pre_deploy_failed`/`deactivated`/timeout with the exact messages, then require `GET /v1/services/{id}/deploys?limit=1` `.[0].deploy.id`/`commit.id` to match the selected deploy/SHA (bounded `curl` retries) and print `Render current deploy`/`Render deploy live: <id> for <sha>`; on `workflow_run` keep the existing 45 s head start. Remove the false 45 s comment (`the health poll cannot pass against the old instance`) and replace it with the completion-poll rationale. The harness sets short timeout/poll overrides and a stub `curl` to execute every creation/completion case. No secret is echoed.
8. **Vercel.** Keep `vercel deploy --prebuilt --prod --yes`, add `--meta githubCommitSha="$TARGET_SHA"`, and print `Vercel deployment: <url> for <sha>`.
9. **CI parse.** Update `Validate deploy workflow dispatch choices` for the `environment`/`build_sha` contract (no `build` input/choice/relative labels) and add `Validate deploy build selection contract` with the exact `build_sha` fields/description, resolver latest/exact/development steps, guard/checkout/confirm/contract/schema/Render/completion/current-deploy/Vercel steps, the 21-step list with `Wait for Render deploy to complete`, the 11-step `verify-workflows` list, trigger/job/permissions/concurrency/mapping and no `push` trigger. Keep the existing actionlint/`vercel.json`/`render.yaml`/no-Fly/Brevo-fixture steps.
10. **Harness.** Add `tests/deploy/gate-fixtures.mjs`: load `deploy.yml`/`ci.yml` with `js-yaml`, extract the actual `run` strings for `Resolve selected build`, `Verify CI succeeded for target commit`, `Check selected build deploy contract`, `Check selected build schema compatibility`, `Deploy Render backend`, `Wait for Render deploy to complete` and `Validate deploy build selection contract`, and execute them with a stub `gh` (Actions latest/exact list, guard conclusion, compare status), a local git remote (selected/pipeline commits), a stub `curl` (POST 201/202, GET status sequences/transient failures, latest-deploy responses) and a stub `pg` module (applied rows, missing table). Put the temp stub `pg` directory **first** on `NODE_PATH`, with the repo's `node_modules` after it for `js-yaml`/other imports, so both `require.resolve('pg')` and `require('pg')` resolve the stub. Cover resolver latest (asserting the exact `CI run: <id> <createdAt>` line), latest-unavailable (the stub returns the real `{"total_count":0,"workflow_runs":[]}` shape and the exact `No successful CI push build found on main; refusing to deploy.` is asserted), exact, malformed, development-default and development-non-default; guard success/CI-failure/missing/not-on-main; contract pass/changed/missing-pg; schema pass/missing-007/missing-table; Render creation 201/202/non-`dep-`/commit-mismatch; Render completion live/build-failed/update-failed/canceled/pre-deploy-failed/deactivated/timeout (short override)/transient-retry/current-match/current-mismatch; CI parse pass. Print `PASS <case>` for each and exit non-zero on any failure. No reimplementation with `diff`/`check_missing` or a fake Render block.
11. **Record** in `build-log-T1.md`: the dependency gate (`production-provisioning` accepted; T6a line on `origin/main` and locally; 15/8 names; branch policy; reviewers or the recorded fallback), the exact `deploy.yml`/`ci.yml` diff anchors, the parse success line, actionlint, the config parses, `Gate harness: PASS <case>` for every job above, `Exact messages: PASS`, `ci.yml parse execution: PASS`, the `npm run coverage` result, the exact statement `No application code change; the only test addition is the feature-owned harness tests/deploy/gate-fixtures.mjs`, and the no-secret/`.env*` evidence. Do not edit `docs/features/production-provisioning/*`, `status.md` or `docs/features/README.md`.

## T2 — Documentation and feature-index proposal `[P]`

depends_on: T1
files_owned: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/containerization.md`, `docs/features/production-build-selection/build-log-T2.md`
verify:
```bash
set -euo pipefail
base=$(git merge-base origin/main HEAD)
npm ci
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
node -e '
const fs=require("node:fs");const yaml=require("js-yaml");
const w=yaml.load(fs.readFileSync(".github/workflows/deploy.yml","utf8"));
const t=(w.on&&typeof w.on==="object")?w.on:w[true];
if(Object.keys(t).sort().join(",")!=="workflow_dispatch,workflow_run")throw new Error("triggers changed");
const wr=t.workflow_run;
if(JSON.stringify(wr.workflows)!==JSON.stringify(["CI"])||JSON.stringify(wr.types)!==JSON.stringify(["completed"])||JSON.stringify(wr.branches)!==JSON.stringify(["main"]))throw new Error("workflow_run trigger changed");
const inputs=t.workflow_dispatch.inputs;
if(Object.keys(inputs).sort().join(",")!=="build_sha,environment")throw new Error("dispatch inputs changed");
if(inputs.build)throw new Error("build choice must be removed");
if(inputs.build_sha.type!=="string"||inputs.build_sha.required!==false||inputs.build_sha.default!=="")throw new Error("build_sha changed");
if(!inputs.build_sha.description.includes("lowercase"))throw new Error("build_sha description must say lowercase");
if(inputs.environment.default!=="production"||JSON.stringify(inputs.environment.options)!==JSON.stringify(["production","development"]))throw new Error("environment changed");
console.log("deploy.yml: build_sha optional text field pinned; no dropdown");
'
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1||b.services[0].name!=='cubeclicker-development')throw new Error('render.yaml changed');console.log('render.yaml: one development service, unchanged')"

# README
grep -qF '### Production build SHA selection' README.md
grep -qF 'The `build_sha` input is optional.' README.md
grep -qF 'Leave `build_sha` empty to deploy the latest successful `CI` push build on `main`; set it to deploy that exact commit, which may not be the latest on `main`.' README.md
grep -qF 'Resolved build' README.md
grep -qF 'CI run' README.md
grep -qF 'build_sha must be a full 40-character lowercase commit SHA.' README.md
grep -qF 'gh workflow run deploy.yml --ref main -f environment=production -f build_sha=<40-hex-sha>' README.md
grep -qF 'To deploy the latest successful build, omit `-f build_sha`.' README.md
grep -qF 'The same selected commit SHA is deployed to the Render backend and the Vercel frontend.' README.md
grep -qF 'Render deploy live' README.md
grep -qF 'A selected build must match the current deploy/migration/smoke contract and must contain every migration already applied; otherwise the deploy fails closed before any provider call.' README.md
grep -qF 'Applied migration files are immutable; new schema changes are new numbered files.' README.md
grep -qF 'Automatic development deploys are unchanged; manual development defaults are preserved with the Render API mechanism aligned.' README.md
grep -qF 'Build SHA selection is available for `environment=production` only.' README.md

# deployment.md
grep -qF '### Build SHA selection (production)' docs/architecture/deployment.md
grep -qF 'The `build_sha` input is optional; empty selects the newest successful `CI` push build on `main`, and a set value selects that exact 40-character lowercase commit SHA.' docs/architecture/deployment.md
grep -qF 'The `build_sha` value may name a commit that is not the latest on `main`.' docs/architecture/deployment.md
grep -qF 'Resolved build' docs/architecture/deployment.md
grep -qF 'CI run' docs/architecture/deployment.md
grep -qF '`build_sha` must be a full 40-character lowercase commit SHA.' docs/architecture/deployment.md
grep -qF "The deploy-contract gate requires the selected build's guard/sync, migration runner and deployed smoke to match the dispatch ref." docs/architecture/deployment.md
grep -qF "The schema gate requires the selected build's migration set to contain every migration already applied." docs/architecture/deployment.md
grep -qF 'Applied migration files are immutable; new schema changes are new numbered files.' docs/architecture/deployment.md
grep -qF 'Render deploy-by-commit' docs/architecture/deployment.md
grep -qF 'commitId' docs/architecture/deployment.md
grep -qF 'Render deploy live' docs/architecture/deployment.md
grep -qF -- '--meta githubCommitSha' docs/architecture/deployment.md
grep -qF 'The dispatch ref must be `main`, and the selected SHA must be on `main`.' docs/architecture/deployment.md
grep -qF 'Select the known-good build with `build_sha`' docs/architecture/deployment.md

# vercel-render-neon.md
grep -qF '### Production deploy with build SHA selection' docs/architecture/vercel-render-neon.md
grep -qF 'gh workflow run deploy.yml --ref main -f environment=production -f build_sha=<40-hex-sha>' docs/architecture/vercel-render-neon.md
grep -qF 'To deploy the latest successful build, omit `-f build_sha`.' docs/architecture/vercel-render-neon.md
grep -qF 'Render API deploy-by-commit' docs/architecture/vercel-render-neon.md
grep -qF 'Render deploy live' docs/architecture/vercel-render-neon.md
grep -qF 'current-deploy mismatch' docs/architecture/vercel-render-neon.md
grep -qF 'Vercel deployment metadata' docs/architecture/vercel-render-neon.md
grep -qF 'Vercel metadata projection: unavailable' docs/architecture/vercel-render-neon.md
grep -qF 'Render 202' docs/architecture/vercel-render-neon.md
grep -qF 'schema-incompatible build' docs/architecture/vercel-render-neon.md
grep -qF '`build_sha` must be a full 40-character lowercase commit SHA.' docs/architecture/vercel-render-neon.md
grep -qF 'Applied migration files are immutable; new schema changes are new numbered files.' docs/architecture/vercel-render-neon.md
grep -qF 'select the known-good SHA with `build_sha`' docs/architecture/vercel-render-neon.md
grep -qF 'per-provider promote/rollback' docs/architecture/vercel-render-neon.md

# containerization.md: both release-identity statements (lines 37 and 42)
grep -qF 'The deployed commit SHA is the selected build SHA for a manual production dispatch; the dispatch SHA (`github.sha`) for a manual development dispatch; `workflow_run.head_sha` for the automatic path.' docs/architecture/containerization.md
grep -qF 'release identity → the selected build SHA for a manual production dispatch; `github.sha` for a manual development dispatch; `workflow_run.head_sha` for the automatic path.' docs/architecture/containerization.md
! grep -qF 'The deployed commit SHA (`github.sha`) is the release identity' docs/architecture/containerization.md
! grep -qF 'release identity → the deployed commit SHA (`github.sha`) recorded by the pipeline' docs/architecture/containerization.md

# Supersession ledger row (both docs)
ledger='`production-build-selection` — **in force**; adds optional `build_sha` selection (empty = latest, set = exact SHA) and a live Render completion/current-deploy proof to the manual production deploy; retains the manual trigger, CI guard, 23-name catalog, protection, fixed order and automatic development path'
grep -qF "$ledger" docs/architecture/deployment.md
grep -qF "$ledger" docs/architecture/vercel-render-neon.md

# Stale-claim negatives (the docs must not mention the removed UX)
! grep -qF 'previous-1' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'The `build` dropdown offers' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -RniE 'dropdown|previous-[0-9]|relative label' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -RniE '### Production build selection|### Build selection \(production\)|### Production deploy with build selection' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'production dispatch always deploys the latest' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'the only revision production can deploy is' docs/architecture/deployment.md
! grep -qF 'production has no way to choose' docs/architecture/vercel-render-neon.md
! grep -qF 'cannot pass against the old instance' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md docs/architecture/containerization.md

# Feature index proposal and no-edit checks
grep -qF 'production-build-selection | Production Build Selection | accepted | 2026-11-27' docs/features/production-build-selection/build-log-T2.md
test -z "$(git status --porcelain -- docs/features/README.md docs/features/production-build-selection/status.md)"
test -z "$(git diff --name-only "$base" -- docs/features/README.md)"
test -z "$(git status --porcelain -- '.env*')"
test -z "$(git diff --name-only "$base" -- '.env*')"
grep -qF 'link: ' docs/features/production-build-selection/build-log-T2.md
! grep -qE '[0-9a-f]{32,}' docs/features/production-build-selection/build-log-T2.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}" docs/features/production-build-selection/build-log-T2.md
```
acceptance: AC-10
status: [ ]

Update the four documents to the shipped build-SHA behavior, minimally and without rewriting unrelated sections:

- **`README.md`** — replace the old section with `### Production build SHA selection`: the `build_sha` input is optional; empty = latest successful `CI` push build on `main`; set = that exact 40-character lowercase commit SHA, which may not be the latest; the command `gh workflow run deploy.yml --ref main -f environment=production -f build_sha=<40-hex-sha>`; the latest restore omits `-f build_sha`; the same-SHA Render+Vercel guarantee including `Render deploy live`/current-deploy; the contract/schema/immutable-migration rules; the automatic-development-unchanged/manual-development-aligned statement and the production-only rule.
- **`docs/architecture/deployment.md`** — add `### Build SHA selection (production)`; update § Environments and triggers (optional `build_sha`), § Deploy pipeline (resolver → guard → contract → schema → migration → sync → Render API → Render completion/current-deploy proof → health → Vercel same SHA → smoke), § Rollback (`build_sha` known-good SHA; per-provider rollback is emergency only), the `--ref main` two-part rule, the empty=latest/exact rule, the lowercase `build_sha` rule, the immutable-migration policy and the eligibility rule. Add the exact ledger row.
- **`docs/architecture/vercel-render-neon.md`** — add `### Production deploy with build SHA selection` under § Runbook with the command, empty=latest/exact semantics, same-SHA provider evidence including `Render deploy live` and the current-deploy check, contract/schema eligibility, the lowercase `build_sha` requirement, Render 201/202 and completion-poll troubleshooting, Vercel metadata or `Vercel metadata projection: unavailable`, the immutable-migration policy and rollback guidance; update § Environment catalog (no new names), § Troubleshooting, § Rollback, § Local development vs cloud and the ledger row.
- **`docs/architecture/containerization.md`** — update **both** release-identity statements (lines 37 and 42) to: the selected build SHA for a manual production dispatch; the dispatch SHA (`github.sha`) for a manual development dispatch; `workflow_run.head_sha` for the automatic path. Use the exact pinned sentences above; the old `github.sha` claim and old line-42 phrasing must be gone; no image/port/compose change.
- **Stale scan:** run the case-insensitive scan over `README.md`, `docs/architecture/deployment.md` and `docs/architecture/vercel-render-neon.md` for `dropdown|previous-[0-9]|relative label` and the old headings `### Production build selection`, `### Build selection (production)` and `### Production deploy with build selection`; record no match.
- **Feature index:** record the proposed row `production-build-selection | Production Build Selection | accepted | 2026-11-27` in `build-log-T2.md`; do not edit `docs/features/README.md` or `status.md`. Check that every relative link added/changed resolves; record one `link: <source> -> <target>: OK` line per link in the build log.
- **Orchestrator-owned status:** if `docs/features/production-build-selection/status.md` has an uncommitted orchestrator state change at verify time, record it (`git status --porcelain -- docs/features/production-build-selection/status.md` and `git log --oneline "$base"..HEAD -- docs/features/production-build-selection/status.md`) and re-run the no-edit check after the orchestrator commits it. Never include it in a builder commit and never edit `status.md` or `docs/features/README.md`.
- Record the docs greps, actionlint/parse output, link checks, the no-edit checks and the credential guards. This is a documentation task: no test files and no application code; `npm run coverage` is not a T2 target (T1/T4 run it).

## T3 — Live prior-build/`build_sha` proof and automatic development proof `[owner]` `[P]`

depends_on: T1
files_owned: `docs/features/production-build-selection/build-log-T3.md`
verify:
```bash
set -euo pipefail
npm ci
test -f docs/features/production-build-selection/build-log-T3.md
grep -qE 'Feature merge: [0-9a-f]{7,12}' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Previous build SHA: [0-9a-f]{7,12}' docs/features/production-build-selection/build-log-T3.md
grep -qF 'Protection gate: not bypassed' docs/features/production-build-selection/build-log-T3.md
grep -qF 'No mixed revision' docs/features/production-build-selection/build-log-T3.md
grep -qF 'Shortened evidence: 7–12 character SHAs; full SHAs only in the temporary run logs' docs/features/production-build-selection/build-log-T3.md
grep -qE 'production frontend: https://cubeclicker(-game)?\.vercel\.app' docs/features/production-build-selection/build-log-T3.md
grep -qE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-build-selection/build-log-T3.md

# Pre-live evidence: resolver and render harness cases (T6 complete, production live;
# T7 in progress; T8 pending)
node tests/deploy/gate-fixtures.mjs > /tmp/opencode/pbs-gate.log
for case in resolver-latest resolver-latest-unavailable resolver-exact resolver-malformed resolver-development-default resolver-development-non-default render-creation-201 render-creation-202 render-creation-non-dep render-creation-commit-mismatch render-completion-live render-completion-build-failed render-completion-update-failed render-completion-canceled render-completion-pre-deploy-failed render-completion-deactivated render-completion-timeout render-completion-transient-retry render-completion-current-match render-completion-current-mismatch; do
  grep -qE "^PASS $case$" /tmp/opencode/pbs-gate.log
done
grep -qF 'Pre-live harness: resolver-* and render-* PASS' docs/features/production-build-selection/build-log-T3.md

# Previous-build production run (exact prior SHA via build_sha)
prev_url=$(grep -oE 'Production previous run: https://github.com/raultorres2603/CubeClicker/actions/runs/[0-9]+' docs/features/production-build-selection/build-log-T3.md | head -n1 | sed 's/^Production previous run: //')
test -n "$prev_url"
prev_run=${prev_url##*/}
gh run view "$prev_run" --repo raultorres2603/CubeClicker --json event,headBranch,conclusion --jq '[.event,.headBranch,.conclusion] | @tsv' | grep -qx $'workflow_dispatch\tmain\tsuccess'
gh run view "$prev_run" --repo raultorres2603/CubeClicker --log > /tmp/opencode/pbs-prev.log
grep -qE 'Resolved build: [0-9a-f]{7,40} \(pinned\)' /tmp/opencode/pbs-prev.log
grep -qE 'CI succeeded for [0-9a-f]{7,40}' /tmp/opencode/pbs-prev.log
grep -qE 'Deploy contract OK for [0-9a-f]{7,40}' /tmp/opencode/pbs-prev.log
grep -qE 'Schema compatibility OK for [0-9a-f]{7,40}: [0-9]+ migration\(s\) in build, [0-9]+ applied on the target branch\.' /tmp/opencode/pbs-prev.log
grep -qF "Deploy configuration OK: 11 value(s) present for the 'production' environment." /tmp/opencode/pbs-prev.log
for key in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_CONNECTION_TIMEOUT_MS SMTP_FROM SMTP_USER SMTP_PASS EMAIL_TRANSPORT BREVO_API_KEY; do grep -qF "SYNCED $key (value verified, not shown)" /tmp/opencode/pbs-prev.log; done
test "$(grep -cF '(value verified, not shown)' /tmp/opencode/pbs-prev.log)" -eq 9
grep -qE 'Render deploy: dep-[A-Za-z0-9]+ [a-z_]+ for [0-9a-f]{7,40}' /tmp/opencode/pbs-prev.log
grep -qE 'Render deploy live: dep-[A-Za-z0-9]+ for [0-9a-f]{7,40}' /tmp/opencode/pbs-prev.log
grep -qE 'Render current deploy: dep-[A-Za-z0-9]+ [0-9a-f]{7,40}' /tmp/opencode/pbs-prev.log
grep -qE 'healthz OK after [0-9]+s: \{"status":"ok"\}' /tmp/opencode/pbs-prev.log
grep -qE 'Vercel deployment: https://[^ ]+ for [0-9a-f]{7,40}' /tmp/opencode/pbs-prev.log
grep -qF 'DEPLOYED SMOKE PASS (8/8 checks)' /tmp/opencode/pbs-prev.log
! grep -qF 'DEPLOYED SMOKE FAIL' /tmp/opencode/pbs-prev.log

# Latest restore run (no build_sha)
latest_url=$(grep -oE 'Production latest run: https://github.com/raultorres2603/CubeClicker/actions/runs/[0-9]+' docs/features/production-build-selection/build-log-T3.md | head -n1 | sed 's/^Production latest run: //')
test -n "$latest_url"
latest_run=${latest_url##*/}
gh run view "$latest_run" --repo raultorres2603/CubeClicker --json event,headBranch,conclusion --jq '[.event,.headBranch,.conclusion] | @tsv' | grep -qx $'workflow_dispatch\tmain\tsuccess'
gh run view "$latest_run" --repo raultorres2603/CubeClicker --log > /tmp/opencode/pbs-latest.log
grep -qE 'Resolved build: [0-9a-f]{7,40} \(latest\)' /tmp/opencode/pbs-latest.log
grep -qE 'Render deploy live: dep-[A-Za-z0-9]+ for [0-9a-f]{7,40}' /tmp/opencode/pbs-latest.log
grep -qE 'Render current deploy: dep-[A-Za-z0-9]+ [0-9a-f]{7,40}' /tmp/opencode/pbs-latest.log
grep -qF 'DEPLOYED SMOKE PASS (8/8 checks)' /tmp/opencode/pbs-latest.log

# Automatic development run
dev_url=$(grep -oE 'Development automatic run: https://github.com/raultorres2603/CubeClicker/actions/runs/[0-9]+' docs/features/production-build-selection/build-log-T3.md | head -n1 | sed 's/^Development automatic run: //')
test -n "$dev_url"
dev_run=${dev_url##*/}
gh run view "$dev_run" --repo raultorres2603/CubeClicker --json event,headBranch,conclusion --jq '[.event,.headBranch,.conclusion] | @tsv' | grep -qx $'workflow_run\tmain\tsuccess'
gh run view "$dev_run" --repo raultorres2603/CubeClicker --log > /tmp/opencode/pbs-dev.log
grep -qE 'Deploying build [0-9a-f]{7,40} to development' /tmp/opencode/pbs-dev.log
grep -qF "Deploy configuration OK: 11 value(s) present for the 'development' environment." /tmp/opencode/pbs-dev.log
grep -qF 'DEPLOYED SMOKE PASS (8/8 checks)' /tmp/opencode/pbs-dev.log

# Provider identity read-backs recorded in the log (shortened evidence)
grep -qE 'Render deploy commit: [0-9a-f]{7,12}' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Render deploy live: dep-[A-Za-z0-9]+' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Render deploy status: live' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Render current deploy: dep-[A-Za-z0-9]+ [0-9a-f]{7,12}' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Vercel deployment id: dpl_[A-Za-z0-9]+' docs/features/production-build-selection/build-log-T3.md
if ! grep -qE 'Vercel deployment commit: [0-9a-f]{7,12}' docs/features/production-build-selection/build-log-T3.md; then
  grep -qF 'Vercel metadata projection: unavailable' docs/features/production-build-selection/build-log-T3.md
  grep -qF 'No mixed revision' docs/features/production-build-selection/build-log-T3.md
fi
grep -qE 'Render deploy id: dep-[A-Za-z0-9]+' docs/features/production-build-selection/build-log-T3.md

# Post-run health
prod_api=$(grep -oE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-build-selection/build-log-T3.md | head -n1 | sed 's/^production api: //')
test -n "$prod_api"
node -e "fetch('$prod_api/healthz').then(async r=>{const b=await r.text();if(r.status!==200||b!=='{\"status\":\"ok\"}')process.exit(1);console.log('HTTP 200',b)})"

rm -f /tmp/opencode/pbs-prev.log /tmp/opencode/pbs-latest.log /tmp/opencode/pbs-dev.log /tmp/opencode/pbs-gate.log
! grep -qE '[0-9a-f]{32,}' docs/features/production-build-selection/build-log-T3.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-build-selection/build-log-T3.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}" docs/features/production-build-selection/build-log-T3.md
test -z "$(git status --porcelain -- '.env*')"
```
acceptance: AC-4(d), AC-5(c), AC-7(d), AC-11
status: [ ]

Owner-gated live proof. Current context: **T6 is complete and production is live** (Render `dep-dc4o1fff3r2c73c4asp0`, Vercel `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq`, deployed smoke 8/8); T7 is in progress and T8 is pending; the feature branch is already merged at `5209d80`; T1 must wait for `production-provisioning` `state: accepted`. The owner merges T1 to `main` first; the builder does not edit the workflow. Record `Feature merge: <short-sha>`, `Previous build SHA: <short-sha>` and `Shortened evidence: 7–12 character SHAs; full SHAs only in the temporary run logs`. Before the dispatches, run `tests/deploy/gate-fixtures.mjs`, record `Pre-live harness: resolver-* and render-* PASS`, and record the 20 per-case lines `Pre-live harness: PASS <case>` for `resolver-latest`, `resolver-latest-unavailable`, `resolver-exact`, `resolver-malformed`, `resolver-development-default`, `resolver-development-non-default`, `render-creation-201`, `render-creation-202`, `render-creation-non-dep`, `render-creation-commit-mismatch`, `render-completion-live`, `render-completion-build-failed`, `render-completion-update-failed`, `render-completion-canceled`, `render-completion-pre-deploy-failed`, `render-completion-deactivated`, `render-completion-timeout`, `render-completion-transient-retry`, `render-completion-current-match` and `render-completion-current-mismatch`; the live runs then exercise the success paths.

1. **Previous-build production proof.** Pick a prior successful `CI` push build on `main` (for example the last known-good production SHA before the current `main` tip) and record its short form as `Previous build SHA: <short-sha>`; the full 40-character value is used only in the dispatch command and is not written to the build log. Dispatch `gh workflow run deploy.yml --ref main -f environment=production -f build_sha=<prior-full-sha> --repo raultorres2603/CubeClicker`; the owner approves the `production` environment gate. Record `Production previous run: <url>`, `run_id`, the run metadata (`event=workflow_dispatch`, `headBranch=main`, `success`), and the exact lines from the run log with every SHA shortened to 7–12 characters: `Resolved build: <short-sha> (pinned)`, `CI succeeded for <short-sha>`, `Deploy contract OK for <short-sha>`, `Schema compatibility OK for <short-sha>: …`, the 11-value guard line, the nine `SYNCED` lines, `Render deploy: dep-… … for <short-sha>`, `Render deploy live: dep-… for <short-sha>`, `Render current deploy: dep-… <short-sha>`, `healthz OK after <n>s: {"status":"ok"}`, `Vercel deployment: <url> for <short-sha>`, `DEPLOYED SMOKE PASS (8/8 checks)`. Record `Render deploy id: dep-…`, `Render deploy status: live`, `Render deploy commit: <short-sha>` (read-only Render read-back), `Vercel deployment id: dpl_…`, and either `Vercel deployment commit: <short-sha>` or `Vercel metadata projection: unavailable` (with the deployment ID and checkout/Render evidence). Record `production frontend:`/`production api:`, `Protection gate: not bypassed` and `No mixed revision`.
2. **Latest restore.** Dispatch the same command **without** `-f build_sha`: `gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker`. Record `Production latest run: <url>`, `Resolved build: <short-sha> (latest)`, the `Render deploy live`/`Render current deploy` lines and the same guard/health/smoke lines. Production ends on the latest successful build.
3. **Automatic development proof.** After the feature merge, record the `workflow_run` Deploy run (`Development automatic run: <url>`) with `event=workflow_run`, head SHA = the merge commit, `Deploying build <short-sha> to development`, the development 11-value guard line, nine `SYNCED` lines, `/healthz` 200 and `DEPLOYED SMOKE PASS (8/8 checks)`. The automatic path's completion step keeps the 45 s head start; no live-poll claim is made for it.
4. Record `POST-RUN HEALTH 200`, the exact provider IDs, and the no-secret/credential guards. Do not print full logs or full SHAs; grep the required lines, shorten the SHAs to 7–12 characters, and delete the temp logs. The old `previous-1` proof is superseded by this exact-SHA `build_sha` proof; re-run it from the current merged base. If a run fails, capture the exact failing step; a failed guard/gate/completion means no health/Vercel/smoke was reached; fix forward, never bypass. If the owner cannot approve the production gate, record the blocker and stop; no bypass.

## T4 — Verify & integrate `[seq]`

depends_on: T2, T3
files_owned: `docs/features/production-build-selection/build-log-T4.md`
verify:
```bash
set -euo pipefail
base=$(git merge-base origin/main HEAD)
mkdir -p /tmp/opencode
npm ci
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
npm run smoke
node tests/deploy/gate-fixtures.mjs > /tmp/opencode/gate-fixtures.log
for case in resolver-latest resolver-latest-unavailable resolver-exact resolver-malformed resolver-development-default resolver-development-non-default guard-success guard-ci-failure guard-missing guard-not-on-main contract-pass contract-changed contract-missing-pg schema-pass schema-missing-007 schema-missing-table render-creation-201 render-creation-202 render-creation-non-dep render-creation-commit-mismatch render-completion-live render-completion-build-failed render-completion-update-failed render-completion-canceled render-completion-pre-deploy-failed render-completion-deactivated render-completion-timeout render-completion-transient-retry render-completion-current-match render-completion-current-mismatch ci-build-parse; do
  grep -qE "^PASS $case$" /tmp/opencode/gate-fixtures.log
done
test "$(grep -c '^PASS ' /tmp/opencode/gate-fixtures.log)" -ge 31
for case in render-creation-201 render-creation-202 render-creation-non-dep render-creation-commit-mismatch render-completion-live render-completion-build-failed render-completion-update-failed render-completion-canceled render-completion-pre-deploy-failed render-completion-deactivated render-completion-timeout render-completion-transient-retry render-completion-current-match render-completion-current-mismatch; do
  grep -qF "Gate harness: PASS $case" docs/features/production-build-selection/build-log-T4.md
done
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1||b.services[0].name!=='cubeclicker-development')throw new Error('render.yaml changed');console.log('render.yaml: one development service, unchanged')"
node -e '
const fs=require("node:fs");const yaml=require("js-yaml");
const w=yaml.load(fs.readFileSync(".github/workflows/deploy.yml","utf8"));
const t=(w.on&&typeof w.on==="object")?w.on:w[true];
if(Object.keys(t).sort().join(",")!=="workflow_dispatch,workflow_run")throw new Error("triggers changed");
const wr=t.workflow_run;
if(JSON.stringify(wr.workflows)!==JSON.stringify(["CI"])||JSON.stringify(wr.types)!==JSON.stringify(["completed"])||JSON.stringify(wr.branches)!==JSON.stringify(["main"]))throw new Error("workflow_run trigger changed");
const inputs=t.workflow_dispatch.inputs;
if(Object.keys(inputs).sort().join(",")!=="build_sha,environment")throw new Error("dispatch inputs changed");
if(inputs.build)throw new Error("build choice must be removed");
if(inputs.build_sha.type!=="string"||inputs.build_sha.required!==false||inputs.build_sha.default!=="")throw new Error("build_sha changed");
if(inputs.environment.default!=="production"||JSON.stringify(inputs.environment.options)!==JSON.stringify(["production","development"]))throw new Error("environment changed");
const d=w.jobs.deploy;if(Object.keys(w.jobs).length!==1)throw new Error("job count changed");
const expectedRef=String.fromCharCode(36)+"{{ steps.resolve_build.outputs.sha || github.event.workflow_run.head_sha || github.sha }}";
if(d.steps.find(x=>x.name==="Checkout").with.ref!==expectedRef)throw new Error("checkout ref changed");
console.log("deploy.yml: build_sha and automatic path pinned");
'
node -e '
const fs=require("node:fs");const yaml=require("js-yaml");
const c=yaml.load(fs.readFileSync(".github/workflows/ci.yml","utf8"));
const steps=c.jobs["verify-workflows"].steps;
const names=steps.map((s)=>s.name);
const expected=["Checkout","Setup Node","Install dependencies","Lint GitHub Actions workflows","Validate Vercel config","Validate Render blueprint","Validate deploy workflow dispatch choices","Validate deploy build selection contract","Check deploy workflow has no Fly deploy path","Guard rejects placeholder values","Guard accepts a complete value set"];
if(JSON.stringify(names)!==JSON.stringify(expected))throw new Error("verify-workflows step list changed");
const step=steps.find((s)=>s.name==="Validate deploy build selection contract");
fs.writeFileSync("/tmp/opencode/ci-build-parse.sh",step.run);
'
bash /tmp/opencode/ci-build-parse.sh
# Post-merge base: the feature branch is already merged at 5209d80. No application/container
# change; the harness already exists and is not expected as a new tests addition.
git diff --exit-code "$base" -- src compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json render.yaml src/frontend/vercel.json ':(exclude)tests'
test -f tests/deploy/gate-fixtures.mjs
test -z "$(git ls-files --others --exclude-standard -- src)"

# Brevo guard fixtures (unchanged contract)
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture EMAIL_TRANSPORT=brevo-api BREVO_API_KEY=fixture-key npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 11 value(s) present for the 'development' environment."
code=0; out=$(env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' EMAIL_TRANSPORT=brevo-api BREVO_API_KEY='<CHANGEME-brevo-api-key>' npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only) || code=$?; test "$code" -eq 1; printf '%s\n' "$out" | grep -qx "Deploy blocked: the 'production' environment has 6 unset or placeholder value(s)."

# Docs and stale-claim scan
grep -qF '### Production build SHA selection' README.md
grep -qF '### Build SHA selection (production)' docs/architecture/deployment.md
grep -qF '### Production deploy with build SHA selection' docs/architecture/vercel-render-neon.md
grep -qF 'The deployed commit SHA is the selected build SHA for a manual production dispatch; the dispatch SHA (`github.sha`) for a manual development dispatch; `workflow_run.head_sha` for the automatic path.' docs/architecture/containerization.md
grep -qF 'release identity → the selected build SHA for a manual production dispatch; `github.sha` for a manual development dispatch; `workflow_run.head_sha` for the automatic path.' docs/architecture/containerization.md
grep -qF 'Leave `build_sha` empty to deploy the latest successful `CI` push build on `main`; set it to deploy that exact commit, which may not be the latest on `main`.' README.md
grep -qF 'Resolved build' README.md
grep -qF 'CI run' README.md
grep -qF '`build_sha` must be a full 40-character lowercase commit SHA.' docs/architecture/deployment.md
grep -qF 'Applied migration files are immutable; new schema changes are new numbered files.' docs/architecture/deployment.md
ledger='`production-build-selection` — **in force**; adds optional `build_sha` selection (empty = latest, set = exact SHA) and a live Render completion/current-deploy proof to the manual production deploy; retains the manual trigger, CI guard, 23-name catalog, protection, fixed order and automatic development path'
grep -qF "$ledger" docs/architecture/deployment.md
grep -qF "$ledger" docs/architecture/vercel-render-neon.md
! grep -qF 'previous-1' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'The `build` dropdown offers' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -RniE 'dropdown|previous-[0-9]|relative label' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -RniE '### Production build selection|### Build selection \(production\)|### Production deploy with build selection' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'production dispatch always deploys the latest' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md
! grep -qF 'the only revision production can deploy is' docs/architecture/deployment.md
! grep -qF 'production has no way to choose' docs/architecture/vercel-render-neon.md
! grep -qF 'cannot pass against the old instance' README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md docs/architecture/containerization.md
! grep -qF 'The deployed commit SHA (`github.sha`) is the release identity' docs/architecture/containerization.md
! grep -qF 'release identity → the deployed commit SHA (`github.sha`) recorded by the pipeline' docs/architecture/containerization.md

# Live evidence reproduction from T3
grep -qF 'DEPLOYED SMOKE PASS (8/8 checks)' docs/features/production-build-selection/build-log-T3.md
grep -qF 'No mixed revision' docs/features/production-build-selection/build-log-T3.md
grep -qF 'Protection gate: not bypassed' docs/features/production-build-selection/build-log-T3.md
grep -qF 'Shortened evidence: 7–12 character SHAs; full SHAs only in the temporary run logs' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Resolved build: [0-9a-f]{7,12} \(pinned\)' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Resolved build: [0-9a-f]{7,12} \(latest\)' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Render deploy live: dep-[A-Za-z0-9]+' docs/features/production-build-selection/build-log-T3.md
grep -qE 'Render current deploy: dep-[A-Za-z0-9]+ [0-9a-f]{7,12}' docs/features/production-build-selection/build-log-T3.md
grep -qE 'production frontend: https://cubeclicker(-game)?\.vercel\.app' docs/features/production-build-selection/build-log-T3.md
prod_api=$(grep -oE 'production api: https://cubeclicker(-game)?\.onrender\.com' docs/features/production-build-selection/build-log-T3.md | head -n1 | sed 's/^production api: //')
test -n "$prod_api"
node -e "fetch('$prod_api/healthz').then(async r=>{const b=await r.text();if(r.status!==200||b!=='{\"status\":\"ok\"}')process.exit(1);console.log('POST-RUN HEALTH 200',b)})"

# No-edit, secret and environment guards
test -z "$(git status --porcelain -- docs/features/README.md docs/features/production-build-selection/status.md)"
test -z "$(git diff --name-only "$base" -- docs/features/README.md)"
test -z "$(git status --porcelain -- '.env*')"
test -z "$(git diff --name-only "$base" -- '.env*')"
grep -qF 'production-build-selection | Production Build Selection | accepted | 2026-11-27' docs/features/production-build-selection/build-log-T4.md
grep -qF 'No application code change; the only test addition is the feature-owned harness tests/deploy/gate-fixtures.mjs' docs/features/production-build-selection/build-log-T4.md
test -f docs/features/production-build-selection/build-log-T1.md
test -f docs/features/production-build-selection/build-log-T2.md
test -f docs/features/production-build-selection/build-log-T3.md
! grep -qE '[0-9a-f]{32,}' docs/features/production-build-selection/build-log-*.md
! grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-build-selection/build-log-*.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}" docs/features/production-build-selection/build-log-*.md
# Synthetic harness fixtures are excluded from the tree/diff/history key-shape and
# credential-shaped audits only (tests/deploy/gate-fixtures.mjs); build-log guards still apply.
! git grep -qE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'
! git grep -qE "postgres(ql)?://[^\"' ]+:[^\"' ]+@" -- .github infra src ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx'
! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}" -- . ':(exclude)tests/deploy/gate-fixtures.mjs'
! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|FlyV1 [A-Za-z0-9_-]{20,}" -- . ':(exclude)tests/deploy/gate-fixtures.mjs'
! git grep -qE "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}" -- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts' ':(exclude)tests/deploy/gate-fixtures.mjs'
! git grep --untracked -qE "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}" -- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts' ':(exclude)tests/deploy/gate-fixtures.mjs'
! git diff "$base"...HEAD -- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts' ':(exclude)tests/deploy/gate-fixtures.mjs' | grep -qE "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}"
! git log -p "$base"..HEAD -- . ':(exclude)docs/' ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts' ':(exclude)tests/deploy/gate-fixtures.mjs' | grep -qE "(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=[\"']?[A-Za-z0-9+/_-]{12,}"
```
acceptance: AC-1–AC-12
status: [ ]

Final verification and integration. Re-run the full static gate (lint, typecheck, tests, `npm run coverage`, build, local smoke, actionlint, the `vercel.json`/`render.yaml` parses, the updated dispatch/build-SHA parses including the executed `ci.yml` parse, the harness with all 31 cases including the 14 `render-*` cases, and the two Brevo guard fixtures). Record `Gate harness: PASS <case>` for the 14 `render-creation-*`/`render-completion-*` cases. Reproduce the T3 live evidence from the recorded run IDs (previous-build via `build_sha` with `Resolved build: (pinned)`, latest restore with `Resolved build: (latest)`, `Render deploy live`/`Render current deploy`, automatic development) and the public `/healthz`; confirm the same SHA on Render and Vercel and record `POST-RUN HEALTH 200`. Record the docs/stale-claim greps, including the case-insensitive `dropdown|previous-[0-9]|relative label` scan and the old headings, both three-way containerization release-identity statements, the old 45 s phrase, the old `github.sha` release-identity phrases and the F19/F20 wording; the no-edit checks, the `.env*` checks, the credential audits, the harness `PASS` lines and the exact statement `No application code change; the only test addition is the feature-owned harness tests/deploy/gate-fixtures.mjs`. **Post-merge base:** the feature branch is already merged at `5209d80`, so `base=$(git merge-base origin/main HEAD)` includes the harness; T4 asserts no application/container change, confirms the harness exists, and does not expect it as a new tests addition. If the orchestrator has an uncommitted `status.md` state change at verify time, record it and re-run the no-edit check after the orchestrator commits it; never include it in a builder commit. Record the proposed feature-index row `production-build-selection | Production Build Selection | accepted | 2026-11-27` and the final report (artifacts, evidence, open questions Q-2–Q-4 including latest-vs-exact, residual risks). Do not edit `docs/features/README.md` or `status.md`; the orchestrator applies the row.
