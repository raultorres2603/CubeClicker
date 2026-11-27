# Build log — T2 — Documentation and feature-index proposal

Task: T2 (2026-11-27)
Branch: `feat/production-build-selection` (T1 at `2e648ed4`; base `de5b829d`)
Files changed: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/containerization.md`, `docs/features/production-build-selection/build-log-T2.md`

## What changed & why

- `README.md`: added `### Production build selection` (dropdown/default, relative labels plus resolved-SHA/CI-run lines, `build_sha` full-lowercase rule, same-SHA Render/Vercel guarantee with `Render deploy live`/current-deploy proof, contract/schema eligibility plus immutable-migration policy, the `previous-1` command, production-only/automatic-development-unchanged statement); updated § What the pipelines run and § Deploy flow to name the resolver/guard/contract/schema/Render-completion steps and the Render API on manual dispatches; corrected the "before the deploy hook" sync wording.
- `docs/architecture/deployment.md`: added `### Build selection (production)` (resolver/guard/contract/schema, build definition, relative labels, `--ref main` two-part rule, Render API `commitId` plus completion/current-deploy proof, Vercel `--meta`, rollback); updated the environments/triggers table, deploy pipeline, rollback, Neon immutable-policy note and ledger row.
- `docs/architecture/vercel-render-neon.md`: added `### Production deploy with build selection` (command, resolution, gates, Render 201/202 and completion/current-deploy, Vercel metadata, rollback); updated deploy-flow ordering, the production flow/trigger, the environment-catalog no-new-names note, the manual-development Render mechanism, troubleshooting, rollback, local-vs-cloud row and ledger row; removed the false "45 s head start cannot pass against the old instance" claim.
- `docs/architecture/containerization.md`: replaced both release-identity statements with the three-way rule (selected build SHA for a manual production dispatch, `github.sha` for a manual development dispatch, `workflow_run.head_sha` for the automatic path); no image/port/compose change.
- `build-log-T2.md`: records the evidence and proposes the feature-index row only; `docs/features/README.md` and `status.md` were not edited.

## Decisions

- The docs describe the shipped T1 workflow only; no application, container, provider or workflow change is made by T2, and no live deploy is claimed.
- The production-only restriction, the full 40-character lowercase `build_sha` rule and the name-based immutable-migration policy are stated where each is needed; the automatic path stays hook + 45 s head start, while manual dispatches use the Render API deploy-by-commit and the completion/current-deploy proof.
- Per-provider rollback is documented as emergency-only; the coordinated rollback is a build-selection deploy of the known-good SHA.
- The feature-index row is proposed in this log because `docs/features/README.md` is orchestrator-owned.

## Evidence

Docs greps (the exact T2 positive/negative block, README through the stale-claim negatives):
- The docs block (`sed -n '219,279p'` of `tasks.md`) was first run per line with fail-on-error semantics (`/tmp/opencode/check-each-grep.sh`): the initial pass reported two failures — `Render deploy-by-commit` missing in `deployment.md` (the text said `Render API deploy-by-commit`) and the `build_sha` lowercase sentence missing its closing period in `vercel-render-neon.md`. Both were fixed in the docs; the final per-line pass reports `failures=0`, and the full T2 block (`set -euo pipefail`) is green in the clean worktree.
- README: the section heading, dropdown/options/default sentence, relative-label sentence, build definition, `build_sha` lowercase sentence, same-SHA sentence, `Render deploy live`, contract/schema sentence, immutable-policy sentence, `previous-1` command, automatic-development-unchanged sentence and production-only sentence all matched.
- `deployment.md`: the section heading, build input/default sentence, relative-label/resolved-line sentence, build definition, lowercase `build_sha` sentence, deploy-contract and schema-gate sentences, immutable-policy sentence, `Render deploy-by-commit`, `commitId`, `Render deploy live`, `--meta githubCommitSha`, the `--ref main` two-part sentence and `Select the known-good build` all matched.
- `vercel-render-neon.md`: the section heading, command, `Render API deploy-by-commit`, `Render deploy live`, `current-deploy mismatch`, `Vercel deployment metadata`, `Vercel metadata projection: unavailable`, `Render 202`, `schema-incompatible build`, lowercase `build_sha` sentence, immutable-policy sentence, `select the known-good build` and `per-provider promote/rollback` all matched.
- `containerization.md`: both positive release-identity statements matched; both old `github.sha` phrasings were absent.
- Supersession ledger: the exact `` `production-build-selection` — **in force**; adds build selection and a live Render completion/current-deploy proof to the manual production deploy; retains the manual trigger, CI guard, 23-name catalog, protection, fixed order and automatic development path `` row matched in both `deployment.md` and `vercel-render-neon.md`.
- Stale-claim negatives: no `production dispatch always deploys the latest`, no `the only revision production can deploy is`, no `production has no way to choose`, no `cannot pass against the old instance` in the four docs.

Workflow/config checks (T2 verify):
```
npm ci → exit 0
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml → exit 0 (no findings)
deploy.yml: build selection dispatch contract pinned
vercel.json: valid JSON
render.yaml: one development service, unchanged
```

Link checks (every relative link added/changed by this task; plus a full scan of the four docs):
```
link: README.md -> docs/architecture/deployment.md: OK
link: README.md -> docs/architecture/vercel-render-neon.md: OK
link: README.md -> docs/features/production-provisioning/build-log-T6.md: OK
link: docs/architecture/deployment.md -> vercel-render-neon.md: OK
link: docs/architecture/vercel-render-neon.md -> deployment.md: OK
all relative links in the four changed docs: 18 checked, 0 missing
```

No-edit checks (`docs/features/README.md`, `status.md`):
- In-place state before the T2 commit: `git status --porcelain -- docs/features/README.md docs/features/production-build-selection/status.md` → ` M docs/features/production-build-selection/status.md` (the orchestrator-owned uncommitted state change that predates T2).
- `git log --oneline de5b829d..HEAD -- docs/features/production-build-selection/status.md` → empty (no builder commit touches it).
- `git status --porcelain -- docs/features/README.md` → empty; `git diff --name-only de5b829d -- docs/features/README.md` → empty.
- Clean-worktree pass: the exact T2 verify block was run on a worktree at the T2 commit with `status.md` at `HEAD` and only the four docs plus this log applied; the first run exposed the two content defects below, and the final green run (after the doc fixes and this log update) is recorded in § Clean-worktree verification.
- `.env*`: `git status --porcelain -- '.env*'` → empty; `git diff --name-only de5b829d -- '.env*'` → empty.

T2 verify, in-place run:
- `bash /tmp/opencode/t2-verify.sh` → exit 1 at the exact `grep -qF 'Render deploy-by-commit' docs/architecture/deployment.md` check: the text said `Render API deploy-by-commit`, which does not contain the pinned string. A per-line run of the docs block then also found the `build_sha` lowercase sentence missing its closing period in `vercel-render-neon.md` (the text ended at `... commit SHA, and it cannot ...`). Both were real content defects, fixed in the docs; every other preceding command (npm ci, actionlint, deploy/config parses, the remaining docs greps and stale-claim negatives) was green.

T2 verify, clean-worktree run: exit 0 (recorded in § Clean-worktree verification below).

Feature-index proposal (for the orchestrator to apply; file not edited):

```
production-build-selection | Production Build Selection | accepted | 2026-11-27
```

Credential and build-log guards:
- `! grep -qE '[0-9a-f]{32,}' build-log-T2.md` → no match (short SHAs only).
- The T2 build-log token-shape guard (Brevo/SMTP/Render/Fly credential patterns) → no match; no email address, connection string or provider token is recorded.
- No secret value was read, printed or changed; the docs record names only.

## Clean-worktree verification

The orchestrator-owned `status.md` is dirty in the primary worktree, so the exact T2 block was run in detached worktrees where `status.md` is at `HEAD` and only this task's four docs plus this log are applied.

- First clean-worktree run (commit `4cb1cb9`, worktree `/tmp/opencode/pbs-t2-clean-1`): exit 1 at `grep -qF 'Render deploy-by-commit' docs/architecture/deployment.md` — the doc said `Render API deploy-by-commit`, which does not contain the pinned string. A per-line run of the docs block (`/tmp/opencode/check-each-grep.sh`) also found the `build_sha` lowercase sentence grep in `vercel-render-neon.md` failing because the sentence continued with a comma instead of the pinned closing period. Both were real content defects, not harness artifacts.
- Fix: the three `Render API deploy-by-commit` occurrences became `Render deploy-by-commit API` in `deployment.md`, and the `build_sha` sentence became two sentences ending with the exact `... commit SHA.` in `vercel-render-neon.md`; this log records the defects. Commit `2936251` (same conventional message, amended).
- Final clean-worktree run (commit `2936251`, worktree `/tmp/opencode/pbs-t2-clean-2`, `status.md` at `HEAD`, clean tracked tree): `bash /tmp/opencode/t2-verify.sh` → exit 0. The block ran `npm ci`, pinned actionlint over both workflows, the `deploy.yml`/`vercel.json`/`render.yaml` parses, all positive and negative docs greps, the exact ledger rows, the feature-index row, the `status.md`/`README.md` no-edit checks, the `.env*` checks, the `link: ` check, and the build-log hex/token guards. Output: `deploy.yml: build selection dispatch contract pinned`, `vercel.json: valid JSON`, `render.yaml: one development service, unchanged`; no actionlint findings. After the log-only amend that produced `dde3659`, the same exact block was re-run in a fresh worktree (`/tmp/opencode/pbs-t2-clean-3`) → exit 0; that amend changed only this log's prose, not the docs.
- After the final log-only amend (the commit containing this paragraph), the same block was re-run in a fresh worktree and exited 0; the only delta from the recorded runs is this evidence prose.
- Per-line docs check after the fix: `bash /tmp/opencode/check-each-grep.sh` → `failures=0`.

## Acceptance audit

- AC-10(a) → met: README has `### Production build selection` with the dropdown/options/`latest` default, the relative-label and resolved-SHA/CI-run explanation, the build definition, the full 40-character lowercase `build_sha` rule, the same-SHA Render+Vercel guarantee including the `Render deploy live`/current-deploy proof, the contract/schema eligibility rule with the immutable-migration policy, the `gh workflow run … -f build=previous-1` command, the automatic-development-unchanged/manual-development-aligned statement and the production-only rule; the exact README greps pass.
- AC-10(b) → met: `deployment.md` has `### Build selection (production)`, the updated environments/triggers table (production manual with build selection), the resolver → guard → contract → schema → migration → sync → Render API → Render completion/current-deploy proof → health → Vercel same SHA → smoke order, the build definition, the `--ref main` two-part rule, the relative-label/resolved-line text, the lowercase `build_sha` rule, the immutable-migration policy, `Select the known-good build` rollback guidance and the exact ledger row.
- AC-10(c) → met: `vercel-render-neon.md` has `### Production deploy with build selection` with the command, resolution semantics, same-SHA evidence (`Render deploy live`, current-deploy check, `Vercel deployment metadata`), Render 201/202 and completion troubleshooting, the schema-incompatible-build case, the fallback `Vercel metadata projection: unavailable`, the immutable-migration policy, `select the known-good build` and `per-provider promote/rollback`; the catalog note states no new names, and the troubleshooting, rollback, local-vs-cloud and ledger sections are updated.
- AC-10(d) → met: both containerization release-identity statements are the three-way rule (selected manual-production SHA; `github.sha` for manual development; `workflow_run.head_sha` for automatic), and both old `github.sha` phrasings are absent; no image/port/compose change.
- AC-10(e) → met: the stale-claim negatives pass, the false old-45-s phrase is gone, and the exact supersession-ledger row is present in both architecture references.
- AC-10(f) → met: the proposed row `production-build-selection | Production Build Selection | accepted | 2026-11-27` is recorded here; `docs/features/README.md` and `status.md` were not edited.

## Deviations from spec

None.
