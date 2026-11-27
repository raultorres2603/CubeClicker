# Build log — T7 — Documentation pass and proposed feature-index row

Task: T7 (2026-11-27)
Files changed by this task: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/email.md`, `docs/architecture/observability.md`, `AGENTS.md`, `docs/features/production-provisioning/build-log-T7.md`.
No application, test, workflow, compose, Dockerfile, `render.yaml`, `vercel.json`, `.env*`, `docs/features/README.md` or `status.md` edit was authored by this task.

What changed & why: Rewrote the six documents from the production-unprovisioned/placeholder-only state to the live production state proven by `build-log-T6.md` — the reused and migrated Neon `production` branch, the Vercel project `cubeclicker`, the Render service `cubeclicker`, the 23-name (15 variables, 8 secrets) `production` Environment with the `main`-only deployment branch policy and required reviewers, the manual CI-preflighted production dispatch, the live proof, the no-suffix naming rule, and the shared free-plan cost/limits — and recorded the proposed feature-index row in this log.

Decisions: Values are names, provider IDs/URLs and non-secret literals only; no secret value is recorded. The supersession-ledger row is pinned verbatim in both architecture references. The T6a one-line preflight fix is documented as the only workflow change, with the reason the pre-checkout step needs `--repo`. The six docs were captured by the concurrent orchestrator batch commit `3277661` (`docs`); this task's own commit adds only this build log. The builder did not author, edit or commit `status.md`, `docs/features/README.md`, `.github/workflows/deploy.yml` or any other file.

Testing note: T7 is a documentation/config-comment task per `tasks.md` (no application code, unit/integration boundary or coverage target). The feature-appropriate tier is the pinned docs greps, the link checks, the `actionlint`/YAML/JSON/dispatch parses, the T6a one-line diff guard and the credential audits; the full repository suite was run as the no-regression gate.

## Proposed feature-index row

`production-provisioning | Production Environment Provisioning | accepted | 2026-11-27`

- Proposed only: `docs/features/README.md` is orchestrator-owned and was not edited.

## Documentation updates

- `README.md` — the production bullet is provisioned (Render service `cubeclicker` / `https://cubeclicker.onrender.com`, Vercel project `cubeclicker` / `https://cubeclicker.vercel.app`, Neon `production` branch), with the 23-name catalog (15 variables, 8 secrets), the `main`-only deployment branch policy, required reviewers, the manual command `gh workflow run deploy.yml --ref main -f environment=production` and the T6 live proof. `Production resources use the base name `cubeclicker` with no environment token` is the pinned naming sentence. The deployment table, the user-side asset checklist, the Brevo runbook (`SMTP_PORT=2525` / `SMTP_SECURE=false`, no placeholders), the documented-not-run asset note and the registration-recovery closing line were updated; every stale placeholder-only/unprovisioned/unprotected statement was removed.
- `docs/architecture/deployment.md` — the production column of § Environments and triggers now carries the provisioned Vercel/Render/Neon identities, the `main`-only deployment branch policy and required reviewers; § Secrets and variables records the 23 names (15 variables, 8 secrets) and the guarded-eleven/synced-nine split (`eleven validated, nine synced`); § Deploy pipeline records the manual protected production path and the T6a one-line `--repo "$GITHUB_REPOSITORY"` preflight fix; § Neon migrations records the existing project-default branch, the seven migrations and the zero application rows at provisioning; § DNS/cookies, § Single-instance (shared 750 h) and § Security (live values, unchanged credential posture) were updated; the credential audit is now the credential-shaped pattern plus the retained Fly key shape; the AWS historical row and the supersession ledger carry the `production-provisioning` row; the rollback section records `No rollback to development` and the no-Neon-branch-deletion rule.
- `docs/architecture/vercel-render-neon.md` — provisioned-identity table and two-of-each architecture; production deploy flow; full `production` Environment catalog (23 names, 15 variables, 8 secrets) with types/sources/consumers; production Vercel project and Render service sections; the Neon `production` branch section; runbook prerequisites, `### Production provisioning (completed)`, `### Routine production deploy` and the live `### Promote to production`; production verification commands; production troubleshooting entries; production email transport; rollback with `No rollback to development` and no branch deletion; local-vs-cloud production column; cost/limits (two free Render services share the 750 h budget, Vercel Hobby is non-commercial, the Neon production branch is not protected on the free plan); and the supersession ledger row.
- `docs/architecture/email.md` — production is provisioned on the same Brevo HTTPS API transport (`EMAIL_TRANSPORT=brevo-api`, REST key, verified sender, 23-name `production` Environment); the placeholder-catalog wording is gone.
- `docs/architecture/observability.md` — `Each deployed Render service sets \`METRICS_ENABLED=false\`` (development from `render.yaml`, production from its live service environment); `/metrics` is a plain 404 on both public hosts; the development-only phrasing is gone.
- `AGENTS.md` — `production is manual (\`workflow_dispatch\`) and provisioned behind the \`production\` Environment protection`; `main`-only and no-`develop` are retained.

## Pinned docs-grep evidence

Every check below is the T7 pattern. Only the pattern is recorded, never the matched line, so no address or token enters this log. All checks returned PASS.

### Positive strings

| File | Pinned pattern | Result |
| --- | --- | --- |
| `README.md` | `Production resources use the base name \`cubeclicker\` with no environment token` | PASS |
| `docs/architecture/deployment.md` | `the GitHub Environment \`production\` and the Neon branch \`production\` are environment identifiers` | PASS |
| `docs/architecture/vercel-render-neon.md` | `Render service \`cubeclicker\`` (or `cubeclicker-game`) | PASS |
| `docs/architecture/vercel-render-neon.md` | `https://cubeclicker.onrender.com` (or the fallback) | PASS |
| `docs/architecture/vercel-render-neon.md` | `Vercel project \`cubeclicker\`` (or `cubeclicker-game`) | PASS |
| `docs/architecture/vercel-render-neon.md` | `https://cubeclicker.vercel.app` (or the fallback) | PASS |
| `docs/architecture/vercel-render-neon.md` | `Neon \`production\` branch` | PASS |
| `docs/architecture/deployment.md` | `23 names (15 variables, 8 secrets)` | PASS |
| `docs/architecture/vercel-render-neon.md` | `23 names (15 variables, 8 secrets)` | PASS |
| `docs/architecture/deployment.md` | `eleven validated, nine synced` | PASS |
| `docs/architecture/deployment.md` | `` `main`-only deployment branch policy `` | PASS |
| `docs/architecture/deployment.md` | `required reviewers` | PASS |
| `docs/architecture/vercel-render-neon.md` | `gh workflow run deploy.yml --ref main -f environment=production` | PASS |
| `docs/architecture/vercel-render-neon.md` | `DEPLOYED SMOKE PASS (8/8 checks)` | PASS |
| `docs/architecture/vercel-render-neon.md` | `two free Render services share` | PASS |
| `docs/architecture/vercel-render-neon.md` | `750` | PASS |
| `docs/architecture/vercel-render-neon.md` | `Vercel Hobby is non-commercial` | PASS |
| `docs/architecture/vercel-render-neon.md` | `The Neon \`production\` branch is not protected on the free plan` | PASS |
| `docs/architecture/deployment.md` | the exact `production-provisioning` ledger row | PASS |
| `docs/architecture/vercel-render-neon.md` | the exact `production-provisioning` ledger row | PASS |
| `docs/architecture/deployment.md` | `No rollback to development` | PASS |
| `docs/architecture/email.md` | `The production environment is provisioned and uses the same Brevo HTTPS API transport` | PASS |
| `docs/architecture/observability.md` | `Each deployed Render service sets \`METRICS_ENABLED=false\`` | PASS |
| `docs/architecture/observability.md` | negative: `for the development service` | PASS (absent) |
| `AGENTS.md` | `production is manual (\`workflow_dispatch\`) and provisioned` | PASS |
| `AGENTS.md` | negative: `production is manual (\`workflow_dispatch\`) and unprovisioned` | PASS (absent) |

The exact ledger row used in both files: `` `production-provisioning` — **in force**; supersedes the production-unprovisioned/placeholder-only statements; retains the manual trigger, guard, sync, catalog and development path ``.

### Stale-string negatives

All of the following returned PASS (pattern absent) on the current tree:

- `README.md`: `production intended, not provisioned`; `production` is **not provisioned**; `no Render service, Vercel project or Neon branch is provisioned`; `no protection rules are configured`; `no live production environment is modified`; `# production (placeholder-only)`; `the production `587` is placeholder-only`; `Production remains unprovisioned`; `Production is `placeholder-only``; `production stays placeholder-only until then`; `The production column is a code/documentation catalog`; `six pinned placeholders`; `production is unprovisioned`.
- `docs/architecture/deployment.md`: `production is not provisioned`; `not provisioned (a Neon `production` branch is the intended target)`; `one `development` branch today (production intended)`; `| not provisioned |`; `none configured: no protection rules and no deployment branch policy yet`; `has no protection rules yet`; `six pinned placeholders`; `the live production Environment is unchanged`; `reviewer/branch protection must be added when it is provisioned`; `production is manual (workflow_dispatch) and unprovisioned`; `Production (`placeholder-only`)`; `production is not provisioned on the free plan`; `production manual and unprovisioned`.
- `docs/architecture/vercel-render-neon.md`: `production` is **not provisioned**; `` `production` (not provisioned) ``; `` `production` (not provisioned, manual only) ``; `no protection rules and no deployment branch policy`; `has no protection rules yet`; `six pinned placeholders`; `no Render service, Vercel project or Neon branch is provisioned`; `until then, production is also not provisioned`; `names stay `placeholder-only``; `production is manual, unprovisioned and `placeholder-only``; `currently unprovisioned`; `production is unprovisioned`; `production manual and unprovisioned`; `no protection configured`; `production stays `placeholder-only``; `why production is not provisioned on the free plan`; `The only Vercel project is the development project`; `a future production project must make its own protection decision`; ``GitHub Environment (`placeholder-only`; not provisioned)``; ``one project (`development`)``; `production branch when provisioned`; `| not provisioned |`.
- `docs/architecture/email.md`: `The production column is a code/documentation catalog`; `not a live-environment claim`; `no live production environment is modified`.

Only the historical AWS section and the supersession-ledger row retain the deprecated vocabulary, and both are allowlisted by the T8 scan's `historical|archived|superseded` filter; no current-state production claim remains.

## Link checks

Each added relative link was read at its target; the target file exists.

- link: README.md -> docs/features/production-provisioning/build-log-T6.md: OK
- link: docs/architecture/deployment.md -> docs/features/production-provisioning/spec.md: OK
- link: docs/architecture/deployment.md -> docs/features/production-provisioning/build-log-T6.md: OK
- link: docs/architecture/vercel-render-neon.md -> docs/features/production-provisioning/spec.md: OK
- link: docs/architecture/vercel-render-neon.md -> docs/features/production-provisioning/build-log-T6.md: OK

## Workflow and config proof (no edit by this task)

- `.github/workflows/deploy.yml` was not edited: `git diff --stat HEAD -- .github/workflows/deploy.yml` is empty.
- The T6a PR diff is exactly one added and one removed non-comment line; the added line contains `gh run list --repo "$GITHUB_REPOSITORY"`; no other content line changed. No guard condition, step `if`, step order, permission, trigger or concurrency line changed; the automatic `workflow_run` path still resolves to `development`.
- `podman run --rm ... docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml` → exit 0 (no output).
- `node -e "JSON.parse(...'src/frontend/vercel.json'...)"` → `vercel.json: valid JSON`.
- `render.yaml` parse → `render.yaml: valid YAML (one development service, unchanged)`.
- `deploy.yml` dispatch parse → `deploy.yml: dispatch choices, automatic path and job count unchanged`.

## No-edit, `.env*` and credential audits

- `git status --porcelain -- docs/features/README.md docs/features/production-provisioning/status.md` is empty on the final tree. The only earlier failure was pre-existing orchestrator dirtiness: the first in-place verify ran while `docs/features/production-provisioning/status.md` held the orchestrator's uncommitted T7 dispatch/loop-log update (` M docs/features/production-provisioning/status.md`); the builder did not edit it, and the orchestrator later committed it in `3277661`.
- `git diff --name-only <base> -- docs/features/README.md` is empty; `docs/features/README.md` was not edited.
- `git status --porcelain -- '.env*'` is empty; `git diff --name-only <base> -- '.env*'` is empty.
- The feature build-log guard (`xsmtpsib-`, `xkeysib-`, `SMTP_USER/PASS=`, `BREVO_API_KEY=`, `RENDER_API_KEY=`, `rnd_`, credentialed connection strings) returns no match on this file.
- The repository credential-shaped audit `(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=["']?[A-Za-z0-9+/_-]{12,}` plus `FlyV1 [A-Za-z0-9_-]{20,}` returns no match on the tracked tree (`git grep`, exit 1 for the negated guard).
- No application, test, migration, Dockerfile, compose-file, `package.json` or lockfile change (`git diff --name-only 3277661 -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json` is empty; the docs commit `3277661` touched only documentation).

## No-regression gate

| Command | Result |
| --- | --- |
| `npm ci` | exit 0 (lockfile install; 399 packages) |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 — 83 test files, 2867 tests passed |
| `npm run coverage` | exit 0 — backend 97.09 statements / 92.24 branches / 99.65 functions / 97.09 lines; frontend 97.22 / 96.8 / 98.6 / 97.22; thresholds ≥ 80 unchanged |
| `npm run build` | exit 0 — `Bundle budget OK` (initial 102,616 B gzip / 150,000; Three.js 154,647 / 165,000; total 287,223 / 300,000) |
| `npm run smoke` (default provider) | exit 1 — host-runtime limitation, see below |
| `npm run smoke` (`PODMAN_COMPOSE_PROVIDER` fallback) | exit 0 — `SMOKE PASS (29/29 checks)` |

### Smoke provider note

- Default provider: `podman compose` uses `/usr/local/bin/docker-compose` (`Docker Compose v5.6.0`), which creates containers with `OomScoreAdj=200`; the `db` HEALTHCHECK (`pg_isready`) is a `podman exec`, and the host's `crun 1.31` refuses it with the exact error `crun: write to /proc/self/oom_score_adj: Permission denied: OCI permission denied`. The compose health gate never opens (`dependency failed to start: container cubeclicker-db-1 is unhealthy`). The database itself logged `database system is ready to accept connections`; this is a host-runtime limitation, not an application failure.
- Documented environment-level fallback (no repository file changed): the other supported provider, `podman-compose 1.6.0` in a throwaway venv outside the repository, selected with `PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose`. After removing the default-provider containers and network, the pinned cold sequence `down` → `up -d mailpit` → `npm run smoke` passed 29/29, including `auth register`, `auth verify`, `auth login`, the metrics check and the production static-delivery checks. This mirrors the fallback recorded in the prior features' build logs. CI smoke is the authoritative cross-service proof and runs the same pinned commands on a host without the `crun` regression.

## Verify evidence

### In-place run 1 (pre-existing orchestrator dirtiness)

Command: the exact T7 block from `tasks.md` (lines 337–442), extracted to `/tmp/opencode/t7/t7-verify.sh` and run as `bash /tmp/opencode/t7/t7-verify.sh`; `set -euo pipefail` is inside the block.

```text
$ bash /tmp/opencode/t7/t7-verify.sh
...
VERIFY_EXIT=1
```

Traced run (`bash -x`) shows every check up to the no-edit check passed; the single failing command was:

```text
++ git status --porcelain -- docs/features/README.md docs/features/production-provisioning/status.md
+ test -z ' M docs/features/production-provisioning/status.md'
```

That `status.md` modification was the orchestrator's own uncommitted T7 dispatch/loop-log update, not a builder edit. The orchestrator committed it concurrently in `3277661` (`docs`).

### In-place run 2 (final tree)

After `3277661` committed the orchestrator-owned `status.md` and this log's evidence was written, the same block was re-run on the final tree at `f356fa1`.

```text
$ bash /tmp/opencode/t7/t7-verify.sh > /tmp/opencode/t7/inplace-final.log 2>&1
$ echo "INPLACE_VERIFY_EXIT=$?"
INPLACE_VERIFY_EXIT=0
```

The raw tail contains the three parse outputs (`vercel.json: valid JSON`, `render.yaml: valid YAML (one development service, unchanged)`, `deploy.yml: dispatch choices, automatic path and job count unchanged`); the block is otherwise silent on success.

### Clean-worktree run

A detached worktree of `HEAD` (`f356fa1`) was created at `/tmp/opencode/t7/cleanwt2`; it contains the committed six docs and this build log, with `status.md` exactly at `HEAD` (no builder edit). The exact T7 block was run there.

```text
$ git worktree add --detach /tmp/opencode/t7/cleanwt2 HEAD
Preparing worktree (detached HEAD f356fa1)
HEAD is now at f356fa1 docs: record T7 documentation evidence and proposed feature index
$ (cd /tmp/opencode/t7/cleanwt2 && bash /tmp/opencode/t7/t7-verify.sh) > /tmp/opencode/t7/cleanwt-verify.log 2>&1
$ echo "CLEAN_WORKTREE_VERIFY_EXIT=$?"
clean-worktree VERIFY_EXIT=0
```

Raw tail of the clean-worktree run:

```text
added 399 packages, and audited 402 packages in 2s
vercel.json: valid JSON
render.yaml: valid YAML (one development service, unchanged)
deploy.yml: dispatch choices, automatic path and job count unchanged
```

After the evidence amendment to this log, the same clean-worktree run was repeated against the amended `HEAD` and also returned `clean-worktree VERIFY_EXIT=0`; the amendment touches only this log's evidence text, not the six docs or the verified content.

## Acceptance audit

- **AC-9(a) — stale current-state strings gone; exact negatives pass.** Met: all README/deployment/vercel-render-neon/email negatives above are absent; the only remaining deprecated vocabulary is in the historical AWS section and the pinned supersession-ledger row, both allowlisted by the T8 scan's historical/superseded filter.
- **AC-9(b) — docs carry the production names/IDs/URLs, catalog, split, protection, manual command, live proof, costs and runbook.** Met: pinned positives above; `production frontend:` / `production api:` identities, the 23-name catalog, the 11/9 split, the `main`-only policy with required reviewers, the manual dispatch command, the T6 guard/sync/health/smoke proof, the shared 750 h budget, Vercel Hobby non-commercial, Neon free unprotected, the promote-to-production and rollback runbooks and the no-suffix naming rule.
- **AC-9(c) — supersession ledger.** Met: the exact `production-provisioning` row is in both `deployment.md` and `vercel-render-neon.md`.
- **AC-9(d) — feature index proposed, no orchestrator-owned edit.** Met: the proposed row is recorded above; `docs/features/README.md` is not edited; this task did not edit or commit `status.md` (the concurrent orchestrator batch commit `3277661` included its own update).
- **AC-9(e) — links resolve.** Met: five `link: … OK` records above.
- **AC-9(f) — T6a preflight fix documented.** Met: the deployment docs record the one-line `--repo "$GITHUB_REPOSITORY"` fix, why the pre-checkout step needs it, and that the guard/step order/permissions/triggers/concurrency and automatic path are unchanged.
- **AC-10(b) — pinned static gate.** Met: `actionlint` exit 0, `vercel.json` valid JSON, `render.yaml` one development service, the dispatch parse, and the exact T6a one-added/one-removed diff guard.
- **AC-10(c) — credential-shaped audit.** Met: the credential-shaped pattern and the Fly key shape return no match on the current tree; the feature build-log guard passes.
- **AC-10(d) — no application change / coverage gate.** Met: the no-regression gate above is green with the thresholds unchanged at ≥ 80; no application, test, migration, Dockerfile, compose, `package.json` or lockfile file changed.
- **T7 task scope — docs + build log only.** Met: the six docs and this log; no `deploy.yml` edit, no `status.md`/`docs/features/README.md` edit, no `.env*` edit, no `git push`.
- **Testing tiers.** No application behavior changed; the pinned docs greps, parses, diff guard, link checks, credential audits and the full no-regression suite are the feature-appropriate evidence (the spec's § Testing strategy documents why no unit/integration test applies to a documentation pass).

## Deviations from spec

- The six documentation files were captured by the concurrent orchestrator batch commit `3277661` (`docs`) before this task's final commit; this task did not author that commit or the `status.md`/other-feature files it contains. The builder's own commit adds only `build-log-T7.md`.
- The default `podman compose` provider cannot run the smoke on this host because of the documented `crun`/`OomScoreAdj=200` regression; the pinned commands were re-run green with the documented `PODMAN_COMPOSE_PROVIDER` fallback (environment-level only, no repository change).
- No other deviation.
