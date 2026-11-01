---
feature: manual-deploy-trigger
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 3
---

# Code Review — r1

## Summary

✅ approved — Independently reproduced the full verification suite (actionlint exit 0 over both workflows; Terraform fmt/init/validate green via the working form; npm lint/typecheck/test/coverage/build exit 0; coverage ≥ 80% per workspace). All 10 ACs are met in substance; the only open items are three non-blocking MINOR anchor-precision gaps carried over from spec review (F10/F11) plus the Terraform positional-validate shorthand, none of which affect the actual gates. No BLOCKER or MAJOR.

## Independently reproduced evidence

| Gate | Command | Result |
|---|---|---|
| actionlint (deploy.yml) | `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml` | exit 0 |
| actionlint (all) | `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml` (host glob) | exit 0 |
| terraform fmt | `podman run … docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` | exit 0 |
| terraform init | `… init -backend=false` (working dir) | exit 0 |
| terraform validate | `… validate` (working dir) | exit 0 (Success) |
| npm lint | `npm run lint` | exit 0 |
| npm typecheck | `npm run typecheck` | exit 0 |
| npm test | `npm test` | exit 0 (backend 630, frontend 1099) |
| npm coverage | `npm run coverage` | exit 0 (backend 94.97/86.19/99.65/94.97; frontend 95.19/95.10/96.89/95.19) |
| npm build | `npm run build` | exit 0 |

Credential audit scoped to `.github/`, `src/`, `infra/`: no matches (exit 1). SHA-pin audit (`grep -E 'uses: .*@v[0-9]+'`) on deploy.yml: no matches (exit 1). `id-token: write` present only at lines 25, 69, 107 (job permission blocks); workflow-level `permissions:` (lines 10–12) is `contents: read`. `environment: production` at lines 26, 70, 108.

## AC walk (AC-1 … AC-10)

| AC | Status | Evidence |
|---|---|---|
| AC-1 | met (substance) | `grep -n "workflow_dispatch"` → line 4 match; `on:` block is bare `workflow_dispatch` (no `push:` trigger key, no `inputs:` block); `grep -n "inputs:"` → no match. (The literal `grep -n "push:"` also matches the pre-existing job id `build-and-push:` on line 18 — documented false positive; see F1.) |
| AC-2 | met | `grep -n "uses: ./.github/workflows/ci.yml"` → line 16 match |
| AC-3 | met | `grep -n "environment: production"` → lines 26, 70, 108 (≥1) |
| AC-4 | met | `grep -n "pull_request:\|branches: \[main\]\|workflow_call:"` on ci.yml → lines 4, 6, 7; ci.yml unchanged in this feature |
| AC-5 | met | deployment.md: `grep -n "workflow_dispatch"` match (lines 28, 62); reason phrase `single.*production\|staging` match (line 63) |
| AC-6 | met | README: `grep -n "workflow_dispatch\|manual"` match (lines 105, 109, 115); reason phrase match (line 115); old first step `Push to main` removed (grep exit 1) |
| AC-7 | met | actionlint over deploy.yml (and all workflows) exit 0 |
| AC-8 | met (working form) | terraform fmt -check -recursive exit 0; init -backend=false + validate exit 0; no Terraform changes in this feature. (Literal positional `validate infra/terraform` exits 1 — see F3.) |
| AC-9 | met | SHA pins only (no `@vN`); `id-token: write` scoped to deploy jobs; credential audit clean in `.github/`/`src/`/`infra/` |
| AC-10 | met | Feature commits touch only `.github/workflows/deploy.yml`, `docs/architecture/deployment.md`, `README.md` (plus build logs); `git status --porcelain` evidences only untracked feature artifacts; no `src/**`/`tests/**`/`compose*`/Terraform changes |

## Findings

| # | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| F1 | MINOR | tasks.md T1 `verify:` and spec.md § AC-1 | The pinned anchor `grep -n "push:" .github/workflows/deploy.yml` cannot return "no match": the deploy job is named `build-and-push` (line 18), so the literal substring always matches. The trigger-level `push:` key is genuinely gone (verified by inspection of the `on:` block), but the documented command is contradictory and the builder recorded it as a false positive rather than tightening. Carried over from spec review F10 (left open). | Tighten the anchor to a standalone-key pattern, e.g. `grep -nE '^\s+push:\s*$' .github/workflows/deploy.yml` (no match), or inspect the `on:` block; record the chosen command in the build log. Not blocking — substance verified. | open |
| F2 | MINOR | tasks.md T2 `verify:` and build-log-T2.md | The stale-trigger guard for deployment.md uses the lowercase form `grep -n "push to \`main\`"`, but the actual stale wording in deployment.md (line 28, now removed) was capitalized ("Push to `main`"). A case-sensitive lowercase grep cannot detect capitalized stale wording, so the guard is vacuous for that case. The builder recorded exit 1 (no match) without tightening. Carried over from spec review F11 (left open). | Change the deployment.md anchor to the capitalized form `grep -n "Push to \`main\`" docs/architecture/deployment.md` (no match), or make it case-insensitive (`grep -ni "push to \`main\`"`), consistent with the README anchor. Not blocking — substance verified by inspection. | open |
| F3 | MINOR | spec.md § AC-8 and tasks.md T-final `verify:` | The literal pinned command `podman run … docker.io/hashicorp/terraform:1.15.9 validate infra/terraform` exits 1 (modules not installed when run from `/repo` without `-chdir`/working-dir), even though `init -backend=false` has run in a prior container (the `.terraform/` tree persists on the bind mount). The build log records this as a failed attempt and uses the working-directory form (`-w /repo/infra/terraform … validate`), which exits 0 — matching how ci.yml actually runs it (`working-directory: infra/terraform`). | Tighten the AC-8/T-final anchor to the working form actually used by ci.yml: `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` (exit 0), or chain `init -backend=false infra/terraform && validate infra/terraform` in a single container as the aws-deploy-pipeline tasks do. Not blocking — the real gate is green and no Terraform changed. | open |
| F4 | INFO | build-log-T1.md, build-log-final-verification.md | Credential audit `git grep` returns matches only in documentation artifacts quoting the audit pattern (prior feature docs/reviews); scoped audit over `.github/`, `src/`, `infra/` is clean. Correctly classified by the builder. No action. | none | n/a |
| F5 | INFO | docs/features/README.md | The feature index is orchestrator-owned and was not edited by the builder; the proposed row diff is recorded in build-log-T2.md (to be applied by the orchestrator on acceptance). Consistent with `docs/architecture/documentation.md` ownership rule. | Orchestrator applies the proposed row on acceptance. | n/a |

## Checklist results

| Area | Result | Notes |
|---|---|---|
| Spec conformance | ✅ | All 10 ACs met in substance; trigger/contract/grep anchors all present |
| Security | ✅ | SHA-pinned actions; `id-token: write` job-scoped; no static AWS keys (OIDC only) |
| Quality / scope | ✅ | Diff limited to `.github/workflows/deploy.yml`, `docs/architecture/deployment.md`, `README.md` + build logs; no src/tests/compose/Terraform changes; framework contracts untouched |
| Testing | ✅ | actionlint + terraform wrappers green; npm lint/typecheck/test/coverage/build green; coverage ≥ 80% per workspace; no weak assertions introduced (no TS changes) |
| Coverage exclusions | ✅ | No changes to vitest config; pre-existing justified exclusions (entrypoints) unchanged |
| Real-time | ✅ (N/A) | Explicitly out of scope; WebSocket edge untouched |
| Containers | ✅ (N/A) | Explicitly out of scope; no services/images/ports/config added |
| Documentation gate | ✅ | T2 covers doc edits (deployment.md + README); proposed `docs/features/README.md` row present in build-log-T2.md; links verified |
| Framework contracts | ✅ | `.opencode/**`, `AGENTS.md` unchanged; 8 states unchanged; no new state |

## Open questions / backlog (non-blocking)

- F1–F3 are anchor-precision tightenings; the builder may apply them at any time without a spec revision (consistent with spec review's F10/F11 precedent). They do not block approval.
- Q-1 (no `workflow_dispatch` input) and Q-2 (verify re-runs gates on manual trigger) defaults stand as documented in spec.md.
- Documentation pass on acceptance (per `docs/architecture/documentation.md`) remains pending: orchestrator applies the proposed `docs/features/README.md` row and confirms the pass before transitioning to `accepted`.

## Verdict

approved — blocking: 0 (3 MINOR non-blocking anchor-precision findings; 2 INFO). Feature is green to go pending the orchestrator's acceptance-time documentation pass.