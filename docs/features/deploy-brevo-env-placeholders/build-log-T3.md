# Build log — T3 — Deploy workflow: preflight guard and Render sync

Task: T3 (2026-11-22)
Files changed: `.github/workflows/deploy.yml`, `docs/features/deploy-brevo-env-placeholders/build-log-T3.md`

## What changed & why

- Inserted `Check deployment Brevo configuration` after `Install dependencies` and before `Migrate Neon database`; it runs the T2 CLI with `--check-only`, so a missing/placeholder value fails the job before the database or any provider is touched (AC-7(a), AC-10(b)).
- Inserted `Sync Brevo SMTP settings to Render` after `Migrate Neon database` and before `Deploy Render backend`; it runs the same CLI with no flags, so the seven SMTP values are written and verified before the Render deploy hook starts a build (AC-7(a), AC-5 wiring).
- Each new step carries its own `env:` with the six `vars.*` and three `secrets.*` bindings (nine per step, 18 total); `TARGET_ENVIRONMENT` stays job-level.
- Nothing else changed: triggers, `concurrency`, `permissions`, `timeout-minutes`, checkout/setup/install, the Render hook, the 45 s wait, the `/healthz` poll, the Vercel steps and the deployed smoke are byte-identical; no `uses:` line was added or modified (diff is 30 added lines, 0 removed).

## Decisions

- Env binding order follows the spec catalog (`SMTP_*` then `RENDER_SERVICE_ID`, `RENDER_API_KEY`), so the two blocks are visually identical and a missing binding is easy to spot. `RENDER_SERVICE_ID`/`RENDER_API_KEY` are inputs only; the CLI's `SmtpValues` projection keeps them out of every request body.
- One short comment per step records the intent (fail early; GitHub Environment is the source of truth). No other text was touched.
- No unit-test tier applies: this task edits workflow YAML, not an executable module. The invoked CLI carries its own unit and process-level integration tests from T1/T2. The integration tier for this change is the pipeline-artifact proof below (actionlint over `deploy.yml`, the install-first step-order and 18-binding assertions, the no-`uses:`/permissions/concurrency diff check, and the `vercel.json`/`render.yaml` parses) — the documented exception for a config-only task with no unit boundary.
- No documentation edits in T3: T6 owns `README.md`, `docs/architecture/deployment.md` and `docs/architecture/vercel-render-neon.md`; this task changes no user-facing behavior beyond the deploy job the T6 docs describe.
- The pinned actionlint container mount (`:z`) worked without `--security-opt label=disable` on this host; no fallback invocation was needed (recorded below).

## Evidence

### Workflow diff (only additions)

```bash
git diff origin/main -- .github/workflows/deploy.yml
```

```diff
@@ -71,12 +71,42 @@ jobs:
       - name: Install dependencies
         run: npm ci
 
+      # Fail before any provider is touched when a deployment value is missing
+      # or still a CHANGEME placeholder.
+      - name: Check deployment Brevo configuration
+        env:
+          SMTP_HOST: ${{ vars.SMTP_HOST }}
+          SMTP_PORT: ${{ vars.SMTP_PORT }}
+          SMTP_SECURE: ${{ vars.SMTP_SECURE }}
+          SMTP_CONNECTION_TIMEOUT_MS: ${{ vars.SMTP_CONNECTION_TIMEOUT_MS }}
+          SMTP_FROM: ${{ vars.SMTP_FROM }}
+          SMTP_USER: ${{ secrets.SMTP_USER }}
+          SMTP_PASS: ${{ secrets.SMTP_PASS }}
+          RENDER_SERVICE_ID: ${{ vars.RENDER_SERVICE_ID }}
+          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
+        run: npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only
+
       - name: Migrate Neon database
         env:
           DATABASE_URL: ${{ secrets.DATABASE_URL }}
           DIRECT_DATABASE_URL: ${{ secrets.DIRECT_DATABASE_URL }}
         run: npx --no-install tsx src/backend/src/db/migrate-cli.ts
 
+      # The GitHub Environment is the source of truth: write the seven Brevo
+      # SMTP values to the Render service before the deploy hook starts a build.
+      - name: Sync Brevo SMTP settings to Render
+        env:
+          SMTP_HOST: ${{ vars.SMTP_HOST }}
+          SMTP_PORT: ${{ vars.SMTP_PORT }}
+          SMTP_SECURE: ${{ vars.SMTP_SECURE }}
+          SMTP_CONNECTION_TIMEOUT_MS: ${{ vars.SMTP_CONNECTION_TIMEOUT_MS }}
+          SMTP_FROM: ${{ vars.SMTP_FROM }}
+          SMTP_USER: ${{ secrets.SMTP_USER }}
+          SMTP_PASS: ${{ secrets.SMTP_PASS }}
+          RENDER_SERVICE_ID: ${{ vars.RENDER_SERVICE_ID }}
+          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
+        run: npx --no-install tsx src/backend/src/deploy/render-env-cli.ts
+
       # Backend runtime configuration lives on the Render service; this hook only
       # starts a build of the service's tracked branch.
       - name: Deploy Render backend
```

```bash
$ git diff --numstat origin/main -- .github/workflows/deploy.yml
30	0	.github/workflows/deploy.yml
```

### `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml`

```
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml
exit=0 (no findings, no output)
```

The `:z` mount label was accepted by SELinux on this host (podman 6.1.3); the documented `--security-opt label=disable` fallback was not required.

### Step-order assertion

```bash
$ node -e "const fs=require('node:fs');const t=fs.readFileSync('.github/workflows/deploy.yml','utf8');const n=['- name: Install dependencies','- name: Check deployment Brevo configuration','- name: Migrate Neon database','- name: Sync Brevo SMTP settings to Render','- name: Deploy Render backend','- name: Wait for Render deploy to start','- name: Wait for Render backend health','- name: Pull Vercel project settings','- name: Run deployed smoke'];const i=n.map((x)=>t.indexOf(x));i.forEach((v,k)=>{if(v<0)throw new Error('missing step: '+n[k])});for(let k=1;k<i.length;k++){if(i[k]<=i[k-1])throw new Error('step order wrong at '+n[k])}console.log('deploy.yml step order OK')"
deploy.yml step order OK
exit=0
```

### Binding counts — six variables, two occurrences each

```bash
$ for n in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_CONNECTION_TIMEOUT_MS SMTP_FROM RENDER_SERVICE_ID; do test "$(grep -c "vars\.$n" .github/workflows/deploy.yml)" -eq 2; echo "vars.$n = $(grep -c "vars\.$n" .github/workflows/deploy.yml)"; done
vars.SMTP_HOST = 2
vars.SMTP_PORT = 2
vars.SMTP_SECURE = 2
vars.SMTP_CONNECTION_TIMEOUT_MS = 2
vars.SMTP_FROM = 2
vars.RENDER_SERVICE_ID = 2
exit=0
```

### Binding counts — three secrets, two occurrences each

```bash
$ for n in SMTP_USER SMTP_PASS RENDER_API_KEY; do test "$(grep -c "secrets\.$n" .github/workflows/deploy.yml)" -eq 2; echo "secrets.$n = $(grep -c "secrets\.$n" .github/workflows/deploy.yml)"; done
secrets.SMTP_USER = 2
secrets.SMTP_PASS = 2
secrets.RENDER_API_KEY = 2
exit=0
```

### CLI invocation lines

```bash
$ grep -q 'run: npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only' .github/workflows/deploy.yml && echo 'check-only invocation present'
check-only invocation present
$ grep -qE '^ *run: npx --no-install tsx src/backend/src/deploy/render-env-cli\.ts$' .github/workflows/deploy.yml && echo 'no-flag invocation present'
no-flag invocation present
exit=0
```

The second grep is anchored to the whole line, so the sync step provably runs the CLI with **no flags**; no wiring name appears in a sync argument (all nine are `env:` inputs).

### Guard is not weakened and structure is untouched

```bash
$ ! grep -q 'continue-on-error' .github/workflows/deploy.yml && echo 'no continue-on-error'
no continue-on-error
$ ! git diff origin/main -- .github/workflows/deploy.yml | grep -qE '^[+-].*(uses:|permissions:|contents: read|actions: read|concurrency:|group:|cancel-in-progress)' && echo 'diff touches no uses:/permissions/concurrency lines'
diff touches no uses:/permissions/concurrency lines
$ grep -n 'uses:' .github/workflows/deploy.yml
63:        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
67:        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
exit=0
```

Both `uses:` lines are the pre-existing SHA pins; no action was added.

### Structural constants unchanged (AC-7 / AC-10(b))

```bash
$ grep -n 'options: \[production\]' .github/workflows/deploy.yml
17:        options: [production]
$ grep -n 'name: Verify CI succeeded for target commit' .github/workflows/deploy.yml
47:      - name: Verify CI succeeded for target commit
$ grep -n 'conclusion" != "success"' .github/workflows/deploy.yml
57:          if [ "$conclusion" != "success" ]; then
$ grep -nE 'workflow_run:|workflow_dispatch:|group: deploy|permissions:|contents: read|actions: read|timeout-minutes: 45' .github/workflows/deploy.yml
6:  workflow_run:
10:  workflow_dispatch:
20:    group: deploy-${{ github.event.inputs.environment || 'development' }}
23:permissions:
24:  contents: read
25:  actions: read
32:    timeout-minutes: 45
exit=0
```

The dispatch still offers only `production`, the CI-success preflight is intact, and `concurrency`/`permissions`/timeout are unchanged. A production dispatch therefore passes the CI preflight and fails at `Check deployment Brevo configuration` (before `Migrate Neon database`, before any Render API call, before any Vercel command); the exact production guard block is proven by the T2 CLI unit/process tests and the T4 fixtures.

### `src/frontend/vercel.json` parse

```bash
$ node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
vercel.json: valid JSON
exit=0
```

### `render.yaml` parse

```bash
$ node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1)throw new Error('render.yaml must declare exactly one service');const s=b.services[0];if(s.name!=='cubeclicker-development'||s.runtime!=='docker'||s.plan!=='free')throw new Error('unexpected render.yaml service');console.log('render.yaml: valid YAML')"
render.yaml: valid YAML
exit=0
```

`render.yaml` is not modified by this task (`git diff origin/main -- render.yaml` is empty).

### Backend coverage regression

```bash
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage
...
 Test Files  42 passed (42)
      Tests  1826 passed (1826)
...
 src/deploy        |   98.09 |    98.75 |     100 |   98.09 |
  ...er-env-cli.ts |      95 |    96.15 |     100 |      95 | 160-164
  render-env.ts    |     100 |     100 |     100 |     100 |
...
All files          |   96.64 |     90.8 |   99.61 |   96.64 |
exit=0
```

The workspace gate (statements/branches/functions/lines ≥ 80) passes; the workflow change adds no backend source.

### Build log existence and credential guard

```bash
$ test -f docs/features/deploy-brevo-env-placeholders/build-log-T3.md && echo "build log present: exit=0"
build log present: exit=0
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T3.md && echo "credential guard over build-log-T3.md: clean (no match)"
credential guard over build-log-T3.md: clean (no match)
```

No value is recorded in this log: only names, the placeholder forms and the two non-secret constants already committed in the runbook/spec.

### Repository lint (no source changed; sanity check)

```bash
$ npm run lint
> lint
> eslint .
exit=0 (no findings)
```

### T3 verify block verbatim

The `verify:` line of the T3 section in `tasks.md` was extracted mechanically (each backtick segment became one command) into `/tmp/opencode/t3-verify.sh` and executed with `bash -euo pipefail` from the repository root; it contains the 13 commands above in their original order (actionlint; step order; the six `vars.*` counts; the three `secrets.*` counts; the two CLI-line greps; no `continue-on-error`; the no-`uses:`/permissions/concurrency diff check; `vercel.json`; `render.yaml`; backend coverage; build-log existence; build-log credential guard):

```
$ bash /tmp/opencode/t3-verify.sh
== verify 1/13 ==
== verify 2/13 ==
deploy.yml step order OK
== verify 3/13 ==
== verify 4/13 ==
== verify 5/13 ==
== verify 6/13 ==
== verify 7/13 ==
== verify 8/13 ==
== verify 9/13 ==
vercel.json: valid JSON
== verify 10/13 ==
render.yaml: valid YAML
== verify 11/13 ==
...
 Test Files  42 passed (42)
      Tests  1826 passed (1826)
...
All files          |   96.64 |     90.8 |   99.61 |   96.64 |
== verify 12/13 ==
== verify 13/13 ==
VERIFY_ALL_OK
verify-exit=0
```

Every command succeeded: `verify-exit=0` (the `test -f` build-log check and the credential guard ran against this file).

## Acceptance audit

- **AC-7** → met. The workflow keeps its triggers (`workflow_run` on `main`, `workflow_dispatch` with only `production`), `concurrency`, `permissions`, job-level `environment:`/`TARGET_ENVIRONMENT` and `timeout-minutes: 45` (diff is additions only; greps above). Step order is install → **Check deployment Brevo configuration** → Neon migration → **Sync Brevo SMTP settings to Render** → Render hook → 45 s wait → health poll → Vercel → smoke (`deploy.yml step order OK`). (a) the check step runs `--check-only`, the sync step the same entrypoint with no flags; each step binds the six `vars.*` and three `secrets.*` (counts of 2 each = 18 bindings); `TARGET_ENVIRONMENT` stays job-level; the CLI (T1/T2) validates nine and writes only the seven SMTP keys. (b) no action added, no `uses:` line changed (both pins unchanged), actionlint over `deploy.yml` exits `0`. (c) `vercel.json` parses as JSON and `render.yaml` parses as the one expected service.
- **AC-10(b)** → met. The production dispatch path is unchanged through the CI-success preflight (`options: [production]`, `Verify CI succeeded for target commit`, non-success refusal), and the new check step sits before the migration, so a production run fails at the AC-4(a) `'production'` block — naming `RENDER_SERVICE_ID` and the other placeholders — before the Neon migration, before any Render API call and before any Vercel command. The exact block is the CLI behavior proven by the T2 unit/process tests and reproduced in T2's build log; T4 adds the credential-free CI fixtures.
- **Definition of Done** → no unit tier applies to workflow YAML (documented above); the integration tier is actionlint plus the structural/config assertions, and the invoked CLI carries both tiers from T1/T2. No wildcard matchers, no snapshots, no new dependencies, no out-of-scope edits, no secrets.

## Deviations from spec

None.
