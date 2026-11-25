# Build log — T1 — Add the development manual dispatch path

Task: T1 (2026-11-25)
Branch: `feat/deploy-development-manual-trigger`, created from `main` at `ca4c046899af8707a5233d5e01c267be7149dd3b` (no reset/rewrite of `main`)
Files changed: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `docs/features/deploy-development-manual-trigger/build-log-T1.md`

## What changed & why

- `deploy.yml`: only the two `workflow_dispatch.inputs.environment` lines change — `description` names both environments and `options` is `[production, development]`; `type: choice`, `required: true` and `default: production` stay, and every other line is byte-identical.
- `ci.yml`: one pure insertion in `verify-workflows`, the `Validate deploy workflow dispatch choices` step after `Validate Render blueprint`, whose `run` block is the pinned Node/`js-yaml` parse extracted verbatim from `tasks.md` T1 `verify`.
- The parse pins both choices, the `production` default, the complete dispatch-input key set, the input→environment mapping, the exact automatic-path `if`/checkout `ref`, both step lists, and the new step's position.
- Config-change task: no test files, no coverage target, no deploy and no secret value involved.

## Decisions

- Reused the single `deploy` job and its existing `github.event.inputs.environment || 'development'` mapping; no new job, expression, secret or dependency (`js-yaml` comes from the locked tree, already used by the `render.yaml` step).
- Appended `development` to the existing choices and kept `production` as the default, exactly as the task pins.
- The CI `run` block is the exact parse line from `tasks.md` T1 `verify` (extracted verbatim, `\"` escapes preserved); the expected checkout ref builds the dollar sign with `String.fromCharCode(36)` so a literal `${{` never appears in the script.
- No `status.md`, `docs/features/README.md`, spec/plan/tasks, README/architecture doc, `render-env.ts`/`render-env-cli.ts`, `render.yaml`, `vercel.json` or other workflow was edited.

## Evidence

### Merge base

```
base=ca4c046899af8707a5233d5e01c267be7149dd3b
ca4c046 docs: record T9 Phase B resend attempt blocked at SMTP auth
```

### `deploy.yml` — exactly 2 hunks / 4 added+removed content lines

```
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index d27c760..298e6e0 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -13 +13 @@ on:
-        description: GitHub Environment to deploy (manual production only)
+        description: GitHub Environment to deploy (development or production)
@@ -17 +17 @@ on:
-        options: [production]
+        options: [production, development]
```

```
hunks=2 content_lines=4
```

The task's forbidden-pattern grep over added/removed lines (`if:`, `ref:`, `secrets.`, `vars.`, `echo `, `uses:`, `permissions:`, `concurrency:`, `workflow_run:`, `environment: production`) reports no match: `no forbidden added/removed line: PASS`. The stale-wording guard passes (`no_manual_production_only_exit=0`).

### `ci.yml` — one pure insertion: 1 hunk, 0 removed lines, 1 added `- name:` line

```
hunks=1 removed=0 added_name_lines=1
+      - name: Validate deploy workflow dispatch choices
```

Parsed `jobs['verify-workflows'].steps` (the parse also asserts this exact list and position):

```json
["Checkout","Setup Node","Install dependencies","Lint GitHub Actions workflows","Validate Vercel config","Validate Render blueprint","Validate deploy workflow dispatch choices","Check deploy workflow has no Fly deploy path","Guard rejects placeholder values","Guard accepts a complete value set"]
```

### Pinned T1 verify block — run verbatim, exit 0

```
VERIFY_EXIT=0
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 399 packages, and audited 402 packages in 6s

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
npm warn install-scripts Run `npm install-scripts ls` to review, or run `npm install-scripts approve <pkg>` to allow.
deploy.yml: workflow_dispatch offers development and production; environment mapping and automatic path unchanged; ci.yml verify-workflows dispatch parse step in place
vercel.json: valid JSON
render.yaml: valid YAML (cubeclicker-development, docker, free, no platform health check)
```

Pinned actionlint (both workflows) is clean — no diagnostics and exit 0:

```
actionlint_exit=0
```

### Exact parse success line (AC-7)

```
deploy.yml: workflow_dispatch offers development and production; environment mapping and automatic path unchanged; ci.yml verify-workflows dispatch parse step in place
```

The parse printed this line and exited 0; it fails loudly on any change to the dispatch choices/default/input key set, the `if`/`ref` exact strings, the trigger/permissions/timeout/17-step deploy list or the 10-step `verify-workflows` list.

### Vercel / Render config parses

```
vercel.json: valid JSON
render.yaml: valid YAML (cubeclicker-development, docker, free, no platform health check)
```

### Guard source, `.env*`, and diff-purity checks

```
guard_source_diff_exit=0
status_env=[]
diff_env=[]
hunks=2 content_lines=4
hunks=1 removed=0 added_name_lines=1
```

`render-env.ts`/`render-env-cli.ts` are byte-identical to the merge base. No tracked or untracked `.env*` path changed; the pre-existing ignored `.env` was not opened, read or edited.

### No secrets, no deploy

No secret value was read, printed or committed. No deploy was triggered: no `gh workflow run`, no deploy-hook call, no `vercel deploy`, no Render or Neon API call. The only container run was the pinned, read-only `actionlint` over the two workflow files, and the only network action was `npm ci` from the committed lockfile.

## Acceptance audit

- **AC-1 — met.** The parse asserts the input key set `['environment']`, the field set, `type: choice`, `required: true`, `default: 'production'`, `options: ['production','development']` and the exact description; the `manual production only` grep passes.
- **AC-2 — met.** The parse asserts `jobs.deploy.environment === jobs.deploy.env.TARGET_ENVIRONMENT`, `concurrency.group === 'deploy-' + jobs.deploy.environment`, `cancel-in-progress: false`, and that each of the three values includes `github.event.inputs.environment` plus the `'development'` fallback and no `'production'` hardcode.
- **AC-3 — met.** The parse asserts `workflow_run` is exactly `CI`/`completed`/`main`, no `push` trigger, exactly one job, permissions `contents: read` + `actions: read`, `timeout-minutes: 45`, the exact `jobs.deploy.if` string, the exact checkout `with.ref` string and the 17-step list. The diff is 2 hunks / 4 content lines with no forbidden `if:`/`ref:`/secret/uses/permission/concurrency/workflow_run line.
- **AC-4 — met for T1 scope.** No deploy step or `vars.*`/`secrets.*` binding was added or removed (diff + step-list parse); the environment mapping resolves the dispatch input, so a development dispatch runs the unchanged guarded pipeline against the `development` Environment. Runtime documentation greps belong to T2.
- **AC-6 — met.** The diff adds/removes no `secrets.`, `vars.`, `echo`, `if:` or `ref:` line; permissions/action pins are unchanged; the input is a closed two-choice list; `.env*` checks are empty and this build log passes the task's credential guard.
- **AC-7 — met.** The new step sits at the pinned position in the parsed 10-step `verify-workflows` list; the parse prints the exact success line; the ci.yml diff is one pure insertion (0 removals, 1 added `- name:` line); pinned actionlint over both workflows exits 0.

## Deviations from spec

None.
