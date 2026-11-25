---
feature: deploy-development-manual-trigger
revision: 2
---
# Plan — Manual Development Deploy Trigger

**r2 (spec review r1, findings F1–F9):** F1 replaces the substring-based automatic-path assertions with exact parsed-value equality for `jobs.deploy.if` and the checkout `with.ref` (the expected dollar sign is built with `String.fromCharCode(36)` so `${{` never appears literally in the `run:` script), pins `workflow_dispatch.inputs` to exactly `['environment']`, adds `if:`/`ref:` to the deploy diff forbidden set, and counts diffs from the merge base. F2 adds the three missing documentation corrections and greps (`deployment.md` “A dispatch chooses production explicitly.”; `vercel-render-neon.md` § Architecture's “Only a successful `workflow_run` … triggers **Deploy**”; the § Routine development deploy `verify-workflows` list). F3 corrects the credential inventory; F4 asserts the exact SMTP rejection headers; F5 adds status/feature-index no-edit evidence; F6 uses the single proposed index state `accepted`; F7 parses `ci.yml` and pins the step list/position plus a pure-insertion diff; F8 covers tracked and untracked (non-ignored) `.env*` paths with a recorded no-read statement; F9 adds the `production`-is-default warning and the production `--ref main` rule.

## Architecture

The deploy workflow already has the exact shape the request needs; the feature exposes one more value through the existing input instead of adding a second pipeline.

```
push to main ──► CI (success) ──► workflow_run ──┐
                                                 ├─► deploy job
workflow_dispatch: environment ∈ {production, ├─►   environment: <selected>  (GitHub Environment)
                                  development} ┘    TARGET_ENVIRONMENT    = <selected>
                                                    concurrency.group      = deploy-<selected>
                                                          │
                                                          ▼
    Check deployment Brevo configuration (nine names, --check-only; dev port guard when TARGET_ENVIRONMENT=development)
    → Migrate Neon database (DIRECT_DATABASE_URL from the selected environment)
    → Sync Brevo SMTP settings to Render (seven SMTP names from the selected environment)
    → Deploy Render backend (selected environment's deploy hook)
    → 45 s wait → /healthz poll (180 s)
    → Vercel pull/build/deploy --prod (selected environment's Vercel project)
    → warm /healthz → deployed smoke (selected environment's URLs)
```

- **Event resolution.** `workflow_run` supplies no inputs, so `github.event.inputs.environment` is empty and the existing `|| 'development'` fallback selects development. `workflow_dispatch` supplies the chosen input, so `development` selects development and `production` selects production. No new expression, job or step is needed.
- **State ownership.** GitHub Environments remain the single source of truth for the values; Render owns the runtime copy of the seven SMTP names plus the dashboard-owned `sync: false` names; Vercel owns no state; Neon owns durable data. This feature changes none of that.
- **Guard order.** The preflight (`--check-only`) stays before the Neon migration; the sync stays after the migration and before the Render hook. A development dispatch therefore runs the same fail-closed guard and writes the same seven names; a production dispatch still fails on placeholders before any provider.
- **Concurrency.** Both the automatic and the manual development path use `deploy-development` with `cancel-in-progress: false`: an in-progress deploy completes, a newer pending run replaces an older pending one, and no two development deploys overlap. Production uses `deploy-production`.
- **Regression boundary.** `ci.yml` `verify-workflows` gains one Node/`js-yaml` parse of the real `deploy.yml` and `ci.yml`, next to the existing `render.yaml`/`vercel.json` parses. It pins the two choices, the `production` default, the complete dispatch-input key set and the input→environment mapping, and asserts the exact `if`/checkout `ref` strings, the automatic trigger, permissions, timeout, the 17-step deploy list and the 10-step `verify-workflows` list. A second, one-time diff check proves the change is an addition-only edit.

## Interfaces / contracts

### 1. Dispatch input (`.github/workflows/deploy.yml`)

Only `description` and `options` change (2 added + 2 removed lines); everything else is byte-identical:

```yaml
  workflow_dispatch:
    inputs:
      environment:
        description: GitHub Environment to deploy (development or production)
        type: choice
        required: true
        default: production
        options: [production, development]
```

### 2. Environment mapping (unchanged text, pinned by the parse)

```
concurrency.group                  = deploy-${{ github.event.inputs.environment || 'development' }}
jobs.deploy.environment            = ${{ github.event.inputs.environment || 'development' }}
jobs.deploy.env.TARGET_ENVIRONMENT = ${{ github.event.inputs.environment || 'development' }}
```

### 3. Dispatch parse contract (new `verify-workflows` step + local verify)

Step name: `Validate deploy workflow dispatch choices`, placed after `Validate Render blueprint` and before `Check deploy workflow has no Fly deploy path`. It runs this exact command (the `${{ … }}` literals are deliberately never embedded in the `run` script; substrings are used only for the input→environment fallback, while the automatic-path `if` and checkout `ref` are compared by exact string equality):

```bash
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const w=yaml.load(fs.readFileSync('.github/workflows/deploy.yml','utf8'));const t=(w.on&&typeof w.on==='object')?w.on:w[true];if(Object.keys(t).sort().join(',')!=='workflow_dispatch,workflow_run')throw new Error('deploy triggers changed');if(Object.keys(t.workflow_dispatch.inputs).sort().join(',')!=='environment')throw new Error('workflow_dispatch inputs changed');const i=t.workflow_dispatch.inputs.environment;if(Object.keys(i).sort().join(',')!=='default,description,options,required,type')throw new Error('environment input fields changed');if(i.type!=='choice'||i.required!==true||i.default!=='production')throw new Error('environment input must stay a required choice defaulting to production');if(JSON.stringify(i.options)!==JSON.stringify(['production','development']))throw new Error('environment choices must be exactly [production, development]');if(i.description!=='GitHub Environment to deploy (development or production)')throw new Error('environment input description must name both environments');const d=w.jobs.deploy;if(Object.keys(w.jobs).length!==1)throw new Error('deploy.yml must keep exactly one job');const expectedIf=\"github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')\";if(d.if!==expectedIf)throw new Error('deploy job condition changed');if(d.environment!==d.env.TARGET_ENVIRONMENT)throw new Error('environment and TARGET_ENVIRONMENT must use the same expression');if(w.concurrency.group!=='deploy-'+d.environment)throw new Error('concurrency group must be deploy-<environment>');if(w.concurrency['cancel-in-progress']!==false)throw new Error('cancel-in-progress must stay false');for(const [k,v] of [['environment',d.environment],['TARGET_ENVIRONMENT',d.env.TARGET_ENVIRONMENT],['concurrency.group',w.concurrency.group]]){if(!v.includes('github.event.inputs.environment')||!v.includes(\"'development'\")||v.includes(\"'production'\"))throw new Error(k+' must resolve the dispatch input with a development fallback and no production hardcode')}const r=t.workflow_run;if(r&&Object.keys(r).sort().join(',')!=='branches,types,workflows')throw new Error('workflow_run fields changed');if(!r||JSON.stringify(r.workflows)!==JSON.stringify(['CI'])||JSON.stringify(r.types)!==JSON.stringify(['completed'])||JSON.stringify(r.branches)!==JSON.stringify(['main']))throw new Error('automatic trigger must stay workflow_run(CI, completed, main)');if(t.push!==undefined)throw new Error('deploy must not gain a push trigger');if(w.permissions.contents!=='read'||w.permissions.actions!=='read'||Object.keys(w.permissions).length!==2)throw new Error('permissions must stay contents: read, actions: read');if(d['timeout-minutes']!==45)throw new Error('deploy timeout must stay 45 minutes');const names=['Reject non-push CI runs','Verify CI succeeded for target commit','Checkout','Setup Node','Install dependencies','Check deployment Brevo configuration','Migrate Neon database','Sync Brevo SMTP settings to Render','Deploy Render backend','Wait for Render deploy to start','Wait for Render backend health','Install Vercel CLI','Pull Vercel project settings','Build Vercel frontend','Deploy Vercel frontend','Warm Render backend before smoke','Run deployed smoke'];const actual=d.steps.map((s)=>s.name);if(JSON.stringify(actual)!==JSON.stringify(names))throw new Error('deploy steps changed: '+JSON.stringify(actual));const co=d.steps.find((s)=>s.name==='Checkout');if(!co||!co.with||Object.keys(co.with).sort().join(',')!=='ref')throw new Error('checkout must keep exactly the ref input');const expectedRef=String.fromCharCode(36)+'{{ github.event.workflow_run.head_sha || github.sha }}';if(String(co.with.ref)!==expectedRef)throw new Error('checkout ref changed');const cw=yaml.load(fs.readFileSync('.github/workflows/ci.yml','utf8'));const ci=cw.jobs['verify-workflows'].steps.map((s)=>s.name);const expectedCi=['Checkout','Setup Node','Install dependencies','Lint GitHub Actions workflows','Validate Vercel config','Validate Render blueprint','Validate deploy workflow dispatch choices','Check deploy workflow has no Fly deploy path','Guard rejects placeholder values','Guard accepts a complete value set'];if(JSON.stringify(ci)!==JSON.stringify(expectedCi))throw new Error('verify-workflows steps changed: '+JSON.stringify(ci));console.log('deploy.yml: workflow_dispatch offers development and production; environment mapping and automatic path unchanged; ci.yml verify-workflows dispatch parse step in place')"
```

Expected success line:

```
deploy.yml: workflow_dispatch offers development and production; environment mapping and automatic path unchanged; ci.yml verify-workflows dispatch parse step in place
```

Parser notes:
- `js-yaml` 4 (already in the locked eslint tree, used by the `render.yaml` step) parses `on` as a string key; the `(w.on && typeof w.on === 'object') ? w.on : w[true]` fallback also tolerates a YAML 1.1 parser that would turn `on` into a boolean key. `js-yaml` is not a new dependency.
- `expectedIf` is an exact string comparison (including `&&`/`||` grouping); a future edit that adds an always-true alternative or a checkout fallback fails.
- `expectedRef` builds the dollar sign with `String.fromCharCode(36)` and concatenates `'{{ … }}'`, so the literal `${{` sequence never appears in the `run:` script (GitHub would interpolate it before Node ran). The concatenated result is exactly `${{ github.event.workflow_run.head_sha || github.sha }}`.
- The parse also loads `ci.yml` and asserts the exact `jobs['verify-workflows'].steps` name list, proving the new step is a child of that job at the pinned position and that the existing actionlint/config/Fly/guard steps remain.

### 4. Deploy diff contract

With `base=$(git merge-base origin/main HEAD)`:

- `git diff -U0 "$base" -- .github/workflows/deploy.yml` contains exactly 2 hunks and 4 added/removed content lines (the description and options lines).
- No added/removed line matches `if:`, `ref:`, `secrets.`, `vars.`, `echo `, `uses:`, `permissions:`, `concurrency:`, `workflow_run:` or a `production` environment literal.
- Comments are not edited.

### 5. CI diff contract

With the same `base`:

- `git diff -U0 "$base" -- .github/workflows/ci.yml` contains exactly 1 hunk and 0 removed content lines (a pure insertion).
- It adds exactly one `- name:` line, and that line is `Validate deploy workflow dispatch choices`; the parsed `verify-workflows` step list (Interface 3) proves the position and the survival of the existing steps.

### 6. Documentation contract

- `README.md`:
  - § Deployment development bullet: `It can also be deployed manually`, `Actions → Deploy → Run workflow`, `` `environment: development` ``, `gh workflow run deploy.yml --ref main -f environment=development`, `job first requires a successful CI run for that commit`, ``The `environment` input defaults to `production`; select `development` before running.`` (the F9 default warning), `deploy-development`.
  - § What the pipelines run: `` or `workflow_dispatch` for development or production ``, `` `development` after CI or a manual development dispatch ``, `dispatch choices`.
  - § Deploy flow step 1: `` or dispatch the Deploy workflow with `environment: development` ``; note that a manual dispatch does not re-run CI.
  - Production bullet: `` reachable only through a manual `workflow_dispatch` with `environment: production` ``.
- `docs/architecture/deployment.md`:
  - § Environments and triggers: `environment=development` and `environment=production` manual-trigger cells; replace “A dispatch chooses production explicitly.” with `` A dispatch chooses `development` or `production` explicitly ``; add `` reads only the selected environment's secrets and variables ``.
  - § Deploy pipeline: `` plus `workflow_dispatch` for `development` or `production` ``, `` `development` after CI or a development dispatch ``, `` The manual path (either environment) checks the CI conclusion for the target SHA ``, `both dispatch choices` in the CI list.
  - § Supersession ledger: `` development re-deployable by `workflow_dispatch` ``.
- `docs/architecture/vercel-render-neon.md`:
  - § Architecture: replace the automatic-only sentence with `` On the automatic path, only a successful `workflow_run` of that CI run triggers **Deploy**; a manual `workflow_dispatch` with `environment: development` re-runs the same job for a commit whose CI already succeeded. `` and keep the “deploy job does **not** call `ci.yml` again” clause.
  - § Environment catalog: `` same `workflow_dispatch` input can re-deploy it with `environment: development` ``; `` the same `environment` input offers `development` and `production` ``.
  - § Routine development deploy step 2: add `Validate deploy workflow dispatch choices` to the `verify-workflows` list.
  - New `### Manual development deploy` between § Routine development deploy and § Verification commands: the command; `` The dispatch ref must be `main` ``; `the manual path never bypasses CI`; ``The `environment` input defaults to `production`; select `development` before running.``; `same steps as the automatic path`; `SMTP port guard`; `SMTP_PORT=2525`; `SMTP_SECURE=false`; `SYNCED <KEY> (value verified, not shown)`; `deploy-development`; `a newer pending run replaces an older pending one`; `` `development` has no protection rules, so any user with Actions write access can dispatch it ``; `` Do not dispatch `production` for development work ``.
  - § Promote to production step 2: "Run Actions → Deploy → Run workflow from `main` with `environment: production` (`gh workflow run deploy.yml --ref main -f environment=production`)" so the `--ref main` rule covers production too.
  - § Troubleshooting: `Manual dispatch refuses to deploy` entry naming the `CI for <sha> is not successful` refusal and the `--ref main` rule.
  - § Local development vs cloud: development deploy trigger cell `` `workflow_dispatch` with `environment=development` ``; production cell `` `workflow_dispatch` with `environment=production` (no protection configured) ``.
  - § Supersession ledger: the same ledger update as `deployment.md`.
- `docs/features/README.md`: propose only (orchestrator-owned) — one row with the single target state `accepted`, applied by the orchestrator at acceptance: `deploy-development-manual-trigger | Manual Development Deploy Trigger | accepted | 2026-11-25`.
- `docs/features/deploy-development-manual-trigger/status.md`: not edited by the builder; the T2 build log records any orchestrator state commit and the no-edit evidence.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `.github/workflows/deploy.yml` | Edit | `workflow_dispatch.environment` description + options only (`[production, development]`, default `production`) | T1 |
| `.github/workflows/ci.yml` | Edit | New `Validate deploy workflow dispatch choices` parse step in `verify-workflows` | T1 |
| `README.md` | Edit | Manual development instruction, default warning, dispatch wording, pipeline list, deploy-flow alternative | T2 |
| `docs/architecture/deployment.md` | Edit | Manual trigger cells, dispatch sentence replacement, deploy pipeline wording, CI list, ledger | T2 |
| `docs/architecture/vercel-render-neon.md` | Edit | Automatic-path scoping, environment catalog, routine CI list, `### Manual development deploy`, production `--ref main`, troubleshooting, local-vs-cloud, ledger | T2 |
| `docs/features/deploy-development-manual-trigger/build-log-T1.md` | New | T1 raw evidence (parse output, actionlint, merge-base diff counts, greps) | T1 |
| `docs/features/deploy-development-manual-trigger/build-log-T2.md` | New | T2 raw evidence (docs greps, final gate, exact rejection lines, no-live-deploy and no-edit statements, proposed index row) | T2 |
| `docs/features/deploy-development-manual-trigger/spec.md` / `plan.md` / `tasks.md` | Edit | Planner artifacts (r2) | planner |

Untouched by design: `src/**`, `tests/**`, `render.yaml`, `src/frontend/vercel.json`, `compose.yaml`, `compose.smoke.yaml`, `src/*/Dockerfile`, `package.json`, `package-lock.json`, `.env*`, `.github/workflows/*` other than the two above, `docs/features/README.md`, `docs/features/deploy-development-manual-trigger/status.md`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Reuse the single `deploy` job and add `development` to the existing `environment` choice | The job already resolves `environment`, `TARGET_ENVIRONMENT` and concurrency from the input with a `development` fallback, and every provider value is environment-scoped; one input line exposes the whole guarded pipeline with no duplicated steps | A separate `deploy-development.yml` workflow — duplicates 17 steps, drifts, and needs its own pins/guards; a second dispatch input/boolean — two sources of truth for the same target |
| D-2 | Keep `default: production`; append `development` to the options | The brief requires production's manual behavior to remain unchanged; keeping the existing default is the literal preservation. An accidental production run fails closed at the placeholder guard while production is unprovisioned, and protection rules are required before provisioning. The docs warn about the default (F9) | `default: development` — friendlier for the new common case but changes the production manual default, which is user-owned (Q-1) |
| D-3 | Pin the dispatch contract in `ci.yml` `verify-workflows` with a Node/`js-yaml` parse, using exact parsed-value equality for the automatic path | The project keeps config invariants in CI next to the `render.yaml`/`vercel.json` parses; a build-log-only check would not regress-guard a future edit. `js-yaml` is already locked (no new dependency). Exact `===` comparisons for `jobs.deploy.if` and the checkout `ref` close the F1 substring hole, and parsing `ci.yml` (F7) proves the new step is inside `jobs['verify-workflows'].steps` at the pinned position. The expected ref's dollar sign is built with `String.fromCharCode(36)` so `${{` never appears in the `run:` script | A one-off build-log check — no durable guard; a committed helper script — a new uncovered file outside the workspaces; substring assertions — the F1 drift hole; literal `${{` in `run:` — Actions would interpolate it |
| D-4 | Pin the docs command to `gh workflow run deploy.yml --ref main -f environment=development`; require `--ref main` operationally for development and production, without a new ref guard | The Render hook builds the service's tracked `main` branch while Vercel builds the dispatched ref, so a non-main dispatch mixes revisions; the UI defaults to `main`. A guard would change the existing production manual path and insert a step into the accepted deploy order, so enforcement is a separate user-owned follow-up (Q-3) | Add a `refs/heads/main` guard now — safest in theory but out of the requested scope and changes production behavior; ignore the hazard — unsafe docs |
| D-5 | Keep the CI-success preflight for the development dispatch | The manual path re-deploys a commit whose CI already passed; it never becomes a way to ship unverified code. This matches production's existing dispatch behavior | Skip CI on manual dispatch — would create a red-CI deploy path and widen the blast radius (Q-4) |
| D-6 | Change no guard, sync, migration, health or Vercel step; change no secret/variable | The request is a trigger change; reusing the current environment-scoped pipeline is the smallest safe change, and the development `2525`/`false` vs production `587` behavior follows automatically from `TARGET_ENVIRONMENT` | Any guard edit — would require code/tests/coverage and risk the accepted Brevo contract |
| D-7 | No live deploy in the feature; the manual development dispatch is optional user-owned post-merge proof | Deploys are user-authorized actions and the brief forbids a real production deploy; the static contract is fully verifiable pre-merge, and the post-merge automatic development deploy exercises the unchanged job | Trigger a development dispatch during build — an unauthorized live action; trigger production — forbidden and pointless (placeholder guard) |
| D-8 | The documentation corrections are part of the trigger contract, including the three stale/incomplete statements and the default/ref guidance (F2, F9) | A trigger change that leaves the docs claiming “production only” or “only `workflow_run` triggers Deploy” is inaccurate; the default warning prevents an accidental production selection once production exists, and the production `--ref main` rule closes the same ref-mixing hazard | Trigger-only diff with docs untouched — contradicts the acceptance bar and the request's item 5; new ref guard — out of scope (Q-3) |

## Risks & mitigations

- **A future logic edit changes the automatic path undetected** → The parse compares `jobs.deploy.if` and checkout `with.ref` by exact string equality (no `.includes()`), pins the complete `workflow_dispatch.inputs` key set, and asserts the exact trigger/job/permissions/timeout/step lists; the one-time merge-base diff forbids `if:`/`ref:` edits.
- **Accidental production dispatch** (production is the default choice) → The docs require selecting `development` before running; today an accidental default run stops at `Check deployment Brevo configuration` before any provider because production is `placeholder-only`; production must remain unprovisioned and gain protection rules before provisioning; Q-1 records the user-owned default decision.
- **Non-main dispatch mixes revisions** (Vercel builds the dispatched ref, Render builds `main`) → The development runbook and README pin `--ref main`; the production runbook gains the same rule (F9); the UI defaults to `main`; Q-3 tracks optional enforcement.
- **A future edit drops `development`, changes the default or breaks the mapping** → The CI parse fails on choices/default/mapping; parsing `ci.yml` also fails if the step leaves `jobs['verify-workflows'].steps` or the existing steps change.
- **The parse's `on` key is parsed differently by a future YAML library** → The `(w.on && typeof w.on === 'object') ? w.on : w[true]` fallback handles YAML 1.1 boolean-key parsing; the step fails loudly rather than silently passing.
- **Pending-run replacement surprises an operator** → Documented: `deploy-development` serializes runs, `cancel-in-progress: false` protects the running deploy, and a newer pending run replaces an older pending one.
- **Manual dispatch blocked because CI is red/pending** → Intended fail-closed behavior, documented in § Troubleshooting with the exact message; the operator waits for CI or dispatches a commit with green CI.
- **Docs drift / stale trigger wording** → Pinned positive and negated greps in T2, including `A dispatch chooses production explicitly`, `` `workflow_dispatch` for production ``, ``single `production` choice`` and ``Only a successful `workflow_run` of that CI run triggers``.
- **Secret leakage through the new step** → The CI parse reads only the workflow YAML; the deploy diff adds no secret/vars/echo line; the workflow keeps its existing redaction and masking.
- **Guard regression** → `render-env.ts`/`render-env-cli.ts` are asserted byte-identical to the merge base, and the three credential-free fixtures prove development `2525`/`false` acceptance, development `587` rejection with its exact header and production placeholder rejection with its exact header.
- **The ignored `.env` cannot be content-checked without reading it** → The no-edit rule stands; the verify asserts no tracked or untracked (non-ignored) `.env*` change and records the no-read statement for the ignored file (F8).
- **An orchestrator `status.md` commit looks like a builder edit** → The T2 gate asserts no working-tree modification and no feature-index diff; the build log records the `status.md` history and states that any entry is orchestrator-authored state tracking (F5).

## Open questions

Mirrors `spec.md` § Open questions; none block planning.

- Q-1 — default choice stays `production` (user-owned; docs warn about it).
- Q-2 — production stays manual-only; auto-deploy is out of scope (user-owned).
- Q-3 — non-main dispatch documented in both runbooks, not enforced (user-owned).
- Q-4 — no CI-skip path (default decision documented).

## Verification plan (task-to-command map)

| Task | Primary proof |
| --- | --- |
| T1 | `npm ci`; pinned actionlint over `deploy.yml` and `ci.yml`; the exact-value dispatch parse (success line); `vercel.json` JSON parse; `render.yaml` YAML parse; merge-base diff counts (deploy: 2 hunks/4 lines and no `if:`/`ref:`/secret/vars/echo/uses/permissions/concurrency/workflow_run change; ci: 1 hunk, 0 removals, 1 added name line = the new step); guard sources byte-identical; build-log present and credential-clean |
| T2 | full re-run of T1's gate; three no-network guard fixtures with exact rejection headers; all AC-8 documentation greps incl. the three F2 corrections and the F9 default/ref rules; `.env*` path checks incl. untracked non-ignored files; status/feature-index no-edit evidence; credential audits; pinned no-live-deploy statements in `build-log-T2.md`; proposed `accepted` feature-index row |
