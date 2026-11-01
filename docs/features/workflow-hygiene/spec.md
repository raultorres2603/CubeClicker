---
feature: workflow-hygiene
revision: 1
status: draft
created: 2026-11-01
updated: 2026-11-01
---

# Spec — Workflow Hygiene

## Summary

Close out the remaining actionable hygiene backlog from `aws-deploy-pipeline` and `manual-deploy-trigger`: (1) append a trailing newline to `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` (F6, aws feature), and (2) make the documented credential-audit command exclude `docs/features/**` (and, by extension, all of `docs/`) so benign documentation references to the audit pattern no longer produce false positives (F5/F7, aws feature; manual feature AC-9). The fix is confined to the two workflow YAML files and documentation: no application code, tests, build config, dependencies, infrastructure, or agentic-framework changes are made. Non-actionable backlog items (verify-anchor false positives in historical accepted-feature artifacts, optional anchor tightenings, the podman-vs-Docker ARG nuance, the upstream Mailpit one-shot smoke defect, user-side AWS asset provisioning, and the benign doc-only hit itself) are documented as out of scope.

### Raw request (verbatim, scope boundary)

> "Proceed with all backlogs you posted here."

## User stories

- As a maintainer, I want the workflow YAML files to end with a trailing newline so they conform to the repository's text-file hygiene and diff cleanly.
- As a maintainer, I want the credential audit to be scoped so documentation that quotes the audit pattern does not masquerade as a credential leak.
- As a reviewer, I want the canonical scoped audit command recorded in `docs/architecture/deployment.md` so every future feature uses the same form.

## Acceptance criteria

Verification conventions: commands run from the repository root. Config/doc ACs are verified by inspection with recorded grep/command anchors in build logs.

- **AC-1** — `.github/workflows/ci.yml` ends with exactly one trailing newline: its final byte is `0x0A` and it does not end with `0x0A 0x0A`. Evidence: `tail -c 1 .github/workflows/ci.yml | od -An -tuC` prints `10`; `tail -c 2 .github/workflows/ci.yml | od -An -tuC` is not `10  10`.
- **AC-2** — `.github/workflows/deploy.yml` ends with exactly one trailing newline (same byte-level condition). Evidence: `tail -c 1 .github/workflows/deploy.yml | od -An -tuC` prints `10`; `tail -c 2 …` is not `10  10`.
- **AC-3** — Both changed workflows pass the pinned containerized `actionlint` wrapper: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` exits 0.
- **AC-4** — Terraform regression guard is green (no Terraform changes in this feature): `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` exits 0.
- **AC-5** — Terraform regression guard is green (no Terraform changes in this feature): `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` exits 0 (after a successful `init -backend=false` in the same working directory).
- **AC-6** — `docs/architecture/deployment.md` documents the canonical scoped credential-audit command in its Secret posture section: it contains the scoped form that excludes `docs/` (e.g. `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'`) and states that the unscoped form is not used because `docs/features/**` contains benign references to the audit pattern. Evidence: `grep -F ":(exclude)docs/" docs/architecture/deployment.md` returns a match; `grep -n "docs/features/\*\*" docs/architecture/deployment.md` returns a match.
- **AC-7** — The scoped credential audit over the tracked tree prints no matches: `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` exits 1 (no output).
- **AC-8** — SHA-pinned actions are preserved: `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml` prints nothing.
- **AC-9** — Coverage regression guard is green (no TypeScript changes in this feature): `npm run coverage` exits 0 with thresholds ≥ 80% statements/branches/functions/lines per workspace.
- **AC-10** — Scope is clean: `git diff --name-only` lists only `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, and `docs/architecture/deployment.md` among tracked files; `git status --porcelain` evidences only the untracked build-log set under `docs/features/workflow-hygiene/`. No `src/**`, `tests/**`, `compose*`, Terraform, or agentic-framework files are changed.

## Non-goals

- **No application code, tests, build config, or dependency changes.** No `src/**`, `tests/**`, `compose*`, Terraform, `package.json`, or lockfile edits.
- **No agentic-framework changes.** `AGENTS.md`, `.opencode/**` are untouched.
- **No OIDC/IAM/Terraform changes.** The Secret posture content of `deployment.md` is documentation only.
- **No containerization changes.** No services, images, ports, or deployables are added.
- **F1/F2/F3 (manual-deploy-trigger, MINOR):** verify-anchor false positives in historical accepted-feature build logs/tasks.md. These are historical artifacts; the production code and gates are correct. No action.
- **F10/F11 (manual, MINOR) and F8/F9 (manual, INFO):** optional anchor tightenings, already applied at build time where cheap. Not changed here.
- **F22 (aws-deploy-pipeline, INFO):** podman-vs-Docker ARG injection nuance — already handled by the two-line `ARG VITE_WS_URL` + `ENV VITE_WS_URL` bridge. No action.
- **Upstream Mailpit one-shot smoke defect:** predates both features; separate concern that would change `npm run smoke`/compose. Not in scope.
- **User-side AWS asset provisioning:** account/role ARNs, S3 state bucket, protected `production` environment, `PUBLIC_WS_URL`. Operational, not code.
- **F5 doc-only hit:** the benign reference in `docs/features/containerized-workflow/reviews/code-r1.md` is a historical review artifact and is **not** edited. The fix is scoping the audit command so it no longer flags it.
- **Historical accepted-feature artifacts are not rewritten.** `aws-deploy-pipeline` and `manual-deploy-trigger` specs, tasks, reviews, and build logs keep their recorded evidence. The scoped command is canonical in `docs/architecture/deployment.md` and in this feature's own anchors going forward (see Open Questions Q-2).

## Boundaries

- ✅ Always: keep SHA-pinned actions, OIDC, least-privilege, and the proof-of-working verification gate; record raw verify evidence (including actionlint and the trailing-newline checks) in build logs; keep the change limited to the two workflow YAML files and `docs/architecture/deployment.md`; treat `AGENTS.md`, `.opencode/**`, `README.md` as shared config (editor-diff discipline, no drive-by rewrites); run every task so the tree stays green at its commit.
- ⚠️ Ask first: changing the scoped audit form beyond the chosen default; editing any file outside the in-scope set; running `terraform apply` against a real account.
- 🚫 Never: edit `src/**`, `tests/**`, `compose*`, Terraform, `package.json`/lockfiles, `AGENTS.md`, or `.opencode/**`; commit secrets/keys/`.env*`/state; weaken the coverage gate or the verification bar; rewrite historical accepted-feature artifacts; git push.

## Security considerations

- No secrets are introduced or changed. All AWS authentication remains OIDC and is untouched.
- Scoping the audit command does not weaken security: it only stops documentation that quotes the audit pattern from being reported as a credential. The audit still runs over all tracked non-doc files (`src/`, `infra/`, `.github/`, etc.) and any real secret in those paths would still be caught.
- No dependency additions; no client-side secrets; no persistence changes.

## Containerization and real-time impact

- **Containerization:** none. No services, images, ports, configuration, or deployables are added or changed. The container assets and run instructions follow the settled conventions in `docs/architecture/containerization.md` without deviation.
- **Real-time:** none. No shared/cross-client state, connection lifecycle, reconnection, multi-client behavior, or server-authority changes. The WebSocket edge handling pinned by `aws-deploy-pipeline` is untouched.

## Testing strategy

- Unit: not applicable — no TypeScript/production code changes.
- Integration: not applicable — no module boundaries changed.
- Config/workflow verification (the feature-appropriate proof for this change):
  - Trailing-newline byte check on both workflow files (AC-1, AC-2).
  - `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` (exit 0) (AC-3).
  - Terraform regression: `podman run … docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` (exit 0) (AC-4) and `… validate` in the working directory (exit 0) (AC-5).
  - Scoped credential audit: `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` (no matches) (AC-7).
  - SHA-pin audit: `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml` (no matches) (AC-8).
  - Documentation anchor: `grep -F ":(exclude)docs/" docs/architecture/deployment.md` (match) and `grep -n "docs/features/\*\*" docs/architecture/deployment.md` (match) (AC-6).
  - Scope audit: `git diff --name-only` and `git status --porcelain` (AC-10).
- Coverage: `npm run coverage` is run as a regression guard (no TS changes; thresholds ≥ 80% statements/branches/functions/lines per workspace must remain green) (AC-9).
- E2E/containerized: the existing Mailpit-primed smoke recipe is unchanged and is not re-run by this feature (no cross-service behavior change); the pinned smoke gate remains the deploy-blocking gate inside `ci.yml`.

## Open questions

- **Q-1 — Scoped form choice.** Default: `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` (excludes all of `docs/`, which is where the benign references live). Alternative: scope to the AWS-relevant trees only, `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- src/ infra/ .github/`. Confirm or override at approval.
- **Q-2 — Migration of historical accepted-feature anchors.** Default: no. Historical `aws-deploy-pipeline` and `manual-deploy-trigger` specs/tasks/build logs keep their recorded (unscoped) evidence; the scoped command is canonical in `docs/architecture/deployment.md` and in this feature's anchors going forward. If the reviewer wants the old verify anchors migrated to the scoped form, that is a follow-up (it touches accepted feature artifacts and is outside this feature's default scope).

## Assumptions

- Both workflow files currently lack a trailing newline (F6, aws-deploy-pipeline code review r2). Appending one byte does not change any job behavior; `actionlint` passes either way.
- No TypeScript or application code is added or changed, so `npm run coverage` is a regression guard only and no new coverage targets are introduced.
- The builder's existing permissions already cover `.github/**` and `docs/**` (route (a) from `aws-deploy-pipeline`); no permission-bootstrap task is needed.
- `docs/features/README.md` remains orchestrator-owned; this feature proposes no row change beyond what the acceptance documentation pass requires (the workflow-hygiene row is already present in the index via the orchestrator's bootstrap).

## Revision history

- r1 — 2026-11-01 — initial draft.