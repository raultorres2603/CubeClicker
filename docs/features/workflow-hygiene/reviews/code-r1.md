---
feature: workflow-hygiene
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 5
---

# Code Review — r1

## Summary

✅ approved — All ten acceptance criteria (AC-1…AC-10) are met with independently reproduced evidence: trailing-newline byte checks pass on both workflows, the pinned `actionlint` wrapper exits 0, Terraform `fmt`/`init`/`validate` regression guards are green, the scoped credential audit prints no matches, SHA pins are preserved, `npm run coverage` is green at ≥ 80% in both workspaces, and the scope audit shows only the three in-scope tracked files (plus the orchestrator-owned `docs/features/README.md` row, which is pre-existing and out of scope). No BLOCKER or MAJOR findings; five non-blocking MINOR/INFO items remain open (four carried, one new).

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ met | `tail -c 1 .github/workflows/ci.yml | od -An -tuC` → `10`; `tail -c 2 … | od -An -tuC` → `101  10` (not `10  10`). (Reproduced: `10` / `101  10`.) |
| AC-2 | ✅ met | `tail -c 1 .github/workflows/deploy.yml | od -An -tuC` → `10`; `tail -c 2 …` → `34  10` (not `10  10`). (Reproduced: `10` / `34  10`.) |
| AC-3 | ✅ met | `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` → exit 0 (no output). Reproduced: exit 0. |
| AC-4 | ✅ met | `podman run … docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` → exit 0. Reproduced: exit 0. |
| AC-5 | ✅ met | `init -backend=false` in `/repo/infra/terraform` → "Terraform has been successfully initialized!" exit 0; `validate` → "Success! The configuration is valid." exit 0. Reproduced: both exit 0. |
| AC-6 | ✅ met | `grep -F ":(exclude)docs/" docs/architecture/deployment.md` → match (line 59); `grep -n "docs/features/\*\*" docs/architecture/deployment.md` → match (line 59). Reproduced: both match. |
| AC-7 | ✅ met | `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` → no output, exit 1. Reproduced: exit 1. |
| AC-8 | ✅ met | `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml` → no match, exit 1. Reproduced: exit 1. SHA pins preserved (actionlint clean). |
| AC-9 | ✅ met | `npm run coverage` → exit 0; backend `All files 94.97 / 86.19 / 99.65 / 94.97`; frontend `95.19 / 95.09 / 96.89 / 95.19` (all ≥ 80). Reproduced: backend 94.97/86.19/99.65/94.97, frontend 95.19/95.09/96.89/95.19. |
| AC-10 | ✅ met (with caveat) | Working-tree tracked diff: `git diff --name-only` → `docs/features/README.md` only (orchestrator-owned manual-deploy-trigger row, pre-existing per brief; not part of this feature). The three in-scope tracked files were changed in commits `6258140` (ci.yml), `147787c` (deploy.yml), `8d503f4` (deployment.md) — each touching only its target plus its build log. `git status --porcelain` shows no `src/**`, `tests/**`, `compose*`, Terraform, or agentic-framework changes; untracked set is feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`) plus the manual-deploy-trigger feature artifacts. No framework contract files changed (verified via commit file lists). |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | spec.md § Non-goals (~line 47) | Non-goal bullet cites `F10/F11 (manual, MINOR)`, but the `manual-deploy-trigger` review artifacts contain no F10/F11 (spec review r1 has F1–F9; code review r1 has F1–F5). The numbers do not resolve to any artifact. | Correct the cross-references: keep `F8/F9 (manual, INFO)` and drop/replace the fabricated `F10/F11` with the actual anchors (manual code-review F1–F3 are already covered by the preceding bullet), or describe the items in prose. | open (carried from spec r1) |
| F3 | MINOR | spec.md § Assumptions (~line 96) | Assumption states the `workflow-hygiene` row is "already present in the index via the orchestrator's bootstrap", but `docs/features/README.md` has no `workflow-hygiene` row (verified: `grep workflow-hygiene docs/features/README.md` → no match). Row addition is deferred to the acceptance documentation pass (status.md), consistent with the orchestrator-owned index. | Reword the assumption to "the row will be proposed in the acceptance documentation pass per `docs/architecture/documentation.md` (orchestrator-owned index)", matching the manual-deploy-trigger precedent. Orchestrator applies the row on acceptance. | open (carried from spec r1) |
| F4 | MINOR | status.md § Task board | Task board is out of sync with tasks.md: T1 is described as covering both `ci.yml` and `deploy.yml` (tasks.md splits T1=`ci.yml`, T2=`deploy.yml`), and T3 is described as "Refresh verify anchors in deployment.md" (tasks.md T3 is "Document the scoped credential-audit command"). | Align the status.md task board with tasks.md (T1 trailing newline ci.yml; T2 trailing newline deploy.yml; T3 scoped audit command in deployment.md; T-final verification sweep). Orchestrator-owned; apply on the next status update. | open (carried from spec r1) |
| F5 | INFO | spec.md § Assumptions (~line 95) | Assumption says the builder's permissions cover `.github/**` and `docs/**`, but the actual allowlist in `.opencode/agents/builder.md` scopes docs edits to `docs/architecture/**` and `docs/features/**/build-log*.md`. The in-scope files are covered, so no permission-bootstrap is needed; the wording is broader than reality. | Reword to name the actually covered paths (`docs/architecture/**`, `docs/features/**/build-log*.md`, `.github/**`), matching the aws-deploy-pipeline route (a) precedent. Cosmetic. | open (carried from spec r1) |
| F8 | INFO | build-log-T-final.md § "git diff --name-only (AC-10)" / "git status --porcelain (AC-10)" | The build log states that `git status --porcelain` "evidences the untracked build-log set under `docs/features/workflow-hygiene/`", but the four build logs (T1–T-final) are committed (tracked) in commits `6258140`, `147787c`, `8d503f4`, `ad85d86`; the actual untracked set under the feature directory is `spec.md`, `plan.md`, `tasks.md`, `status.md`, and `reviews/`. The substantive AC-10 result (no `src/**`/`tests/**`/`compose*`/Terraform/agentic changes) is unaffected and verified. | Optionally correct the evidence narrative in the build log to reflect that the build logs are committed and the untracked set is the feature spec/plan/tasks/status/reviews artifacts. Documentation accuracy only; not a code defect. | open (new) |

## Verification performed

- `tail -c 1 .github/workflows/ci.yml | od -An -tuC` → `  10`; `tail -c 2 .github/workflows/ci.yml | od -An -tuC` → ` 101  10` (not `10  10`). ✅
- `tail -c 1 .github/workflows/deploy.yml | od -An -tuC` → `  10`; `tail -c 2 .github/workflows/deploy.yml | od -An -tuC` → `  34  10` (not `10  10`). ✅
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` → exit 0. ✅
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` → exit 0. ✅
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` → "Terraform has been successfully initialized!" exit 0. ✅
- `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` → "Success! The configuration is valid." exit 0. ✅
- `grep -F ":(exclude)docs/" docs/architecture/deployment.md` → match (line 59). ✅
- `grep -n "docs/features/\*\*" docs/architecture/deployment.md` → match (line 59). ✅
- `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` → no output, exit 1. ✅
- `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml` → no match, exit 1. ✅
- `npm run lint` → exit 0. ✅
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`). ✅
- `npm test` → backend 21 files / 630 tests; frontend 44 files / 1099 tests; exit 0. ✅
- `npm run coverage` → backend 94.97 stmts / 86.19 branches / 99.65 funcs / 94.97 lines; frontend 95.19 / 95.09 / 96.89 / 95.19; exit 0 (all ≥ 80). ✅
- `npm run build` → backend `tsc` exit 0; frontend vite build exit 0 (69 modules). ✅
- `git diff --name-only` → `docs/features/README.md` only (orchestrator-owned, pre-existing). ✅
- `git status --porcelain` → ` M docs/features/README.md` + untracked feature artifacts; no `src/**`/`tests/**`/`compose*`/Terraform/agentic changes. ✅
- Commit file lists (`8d503f4`, `147787c`, `6258140`, `ad85d86`) → only `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `docs/architecture/deployment.md`, and `docs/features/workflow-hygiene/build-log-*.md`. Framework contracts (`AGENTS.md`, `.opencode/**`, compose, package manifests) untouched. ✅
- Containerization contract: no services/images/ports/config/deployables changed; contract unaffected. ✅
- Real-time contract: no shared/cross-client state, connection lifecycle, reconnection, or server-authority changes; WebSocket edge untouched. ✅
- Coverage exclusions: unchanged (no production code excluded, no thresholds lowered); no number-gaming. ✅

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | SHA pins preserved (AC-8); OIDC untouched; no secrets introduced; scoped audit still covers all non-doc tracked files (`src/`, `infra/`, `.github/`, etc.); `.env*` untouched; no dependency changes. |
| Quality | ✅ | Minimal, single-byte change to each workflow; single-line doc addition in deployment.md § Secret posture; no drive-by refactors; no dead code; formatting intact (blank line before `## Trigger policy` preserved). |
| Testing | ✅ | No TypeScript/production code changes; coverage gate green at ≥ 80% both workspaces; all ACs evidenced by pinned commands (reproduced by reviewer); no new tests required (config/docs-only feature). |

## Previous round verification (spec r1 findings)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (spec r1, MINOR) | not fixed | `spec.md` § Non-goals still cites `F10/F11 (manual, MINOR)` (line 47). Carried as F1 above. |
| F2 (spec r1, MINOR) | fixed | T-final `verify:` now runs `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml`; reproduced exit 1 (no match). (build-log-T-final.md § SHA-pin audit.) |
| F3 (spec r1, MINOR) | not fixed | `docs/features/README.md` still has no `workflow-hygiene` row (`grep workflow-hygiene` → no match); spec assumption on line 96 unchanged. Carried as F3 above; row deferred to orchestrator at acceptance. |
| F4 (spec r1, MINOR) | not fixed | `status.md` task board still out of sync with `tasks.md`. Carried as F4 above. |
| F5 (spec r1, INFO) | not fixed | `spec.md` line 95 still says permissions cover `.github/**` and `docs/**`. Carried as F5 above. |
| F6 (spec r1, INFO) | addressed | `docs/architecture/deployment.md` line 59 already explains that the exclusion is intentional because `docs/features/**` contains benign references; no further action required. |
| F7 (spec r1, INFO) | addressed | Scope audit handled: the only working-tree tracked change is the orchestrator-owned `docs/features/README.md` (manual-deploy-trigger row), which is pre-existing per the brief and out of this feature's scope. |

## Notes / backlog (non-blocking)

- The non-actionable backlog items remain correctly documented as out of scope in `spec.md` § Non-goals (verify-anchor false positives in historical accepted-feature artifacts, optional anchor tightenings, podman-vs-Docker ARG nuance, upstream Mailpit one-shot smoke defect, user-side AWS asset provisioning, and the benign doc-only hit in `docs/features/containerized-workflow/reviews/code-r1.md`).
- The `workflow-hygiene` row is absent from `docs/features/README.md`; the orchestrator should add it (slug `workflow-hygiene`, title "Workflow Hygiene (trailing newlines + scoped credential audit)", state `accepted` on acceptance, last-updated date) during the acceptance documentation pass. This is orchestrator-owned and is not a builder edit.
- The build-log evidence narrative (F8) is a documentation-accuracy nit only; all underlying commands were independently reproduced and pass.
- No re-run of the Mailpit-primed containerized smoke recipe was performed: this feature changes no cross-service behavior, no application code, and no container assets, so the existing pinned smoke gate inside `ci.yml` is unaffected. (Per spec § Testing strategy, smoke is intentionally not re-run.)