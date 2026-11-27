# Build log — T2 — Documentation and feature-index proposal (optional `build_sha` only)

Task: T2 (2026-11-27)
Branch: `feat/production-build-selection` (T1 rework `209aed7`; r4 artifacts `0e85012`; base `de5b829d`)
Files changed: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/containerization.md`, `docs/features/production-build-selection/build-log-T2.md`

## What changed & why

- The r4 contract removes the production `build` choice: the only selection input is the optional full-SHA `build_sha` text field (empty = newest successful `CI` push build on `main`; set = that exact commit, which may not be the latest on `main`). The docs now describe that field only.
- `README.md`: replaced the old section with `### Production build SHA selection` (optional field, empty = latest, set = exact SHA, `Resolved build`/`CI run` lines, lowercase full-SHA rule, same-SHA Render/Vercel guarantee with `Render deploy live`/current-deploy proof, contract/schema eligibility plus immutable-migration policy, the `-f build_sha=<40-hex-sha>` command, the latest restore omitting `-f build_sha`, production-only/automatic-development-unchanged statement); updated the production bullet, the pipelines description and the deploy flow.
- `docs/architecture/deployment.md`: replaced the old section with `### Build SHA selection (production)`; updated the environments/triggers table, the effective-environment note, the deploy pipeline, the rollback path (`Select the known-good build with `build_sha``) and the exact ledger row.
- `docs/architecture/vercel-render-neon.md`: replaced the old section with `### Production deploy with build SHA selection` (command, empty=latest/exact semantics, same-SHA evidence, Render 201/202 and completion/current-deploy troubleshooting, Vercel metadata fallback, schema-incompatible build, rollback); updated the production flow/trigger, catalog no-new-names note, manual-development rule, routine production/promote steps, rollback, local-vs-cloud row and ledger row; removed the obsolete choice troubleshooting entry.
- `docs/architecture/containerization.md`: no content change was needed in this revision — both release-identity statements already match the r4 pinned three-way rule (selected build SHA for a manual production dispatch; `github.sha` for a manual development dispatch; `workflow_run.head_sha` for the automatic path), and no removed-UX term appears.
- `build-log-T2.md`: this file. **The earlier dropdown/`previous-N`/relative-label evidence recorded in prior revisions of this log is superseded by this rework**; the docs contain none of those terms or the three old headings.

## Decisions

- Empty `build_sha` resolves the latest successful build; a set value is used exactly and may not be the latest. The docs state both and the latest restore omits `-f build_sha`.
- Operators use `-f build_sha=<40-hex-sha>`; the docs never instruct passing a `build` choice or a label.
- The same-SHA proof, deploy-contract/schema gates, immutable-migration policy, Render completion/current-deploy proof and Vercel `--meta githubCommitSha` are documented as shipped by T1.
- The automatic development path stays on the deploy hook plus the existing 45 s head start; manual dispatches use the Render API `commitId`; a manual development dispatch requires an empty `build_sha`.
- `containerization.md` already satisfies its pinned statements; leaving it byte-identical keeps the change minimal.

## Evidence

Docs greps (r4 T2 block, README through the feature-index/no-edit guards):
- A per-line fail-on-error run of the docs block (`/tmp/opencode/check-each-grep-r4.sh`) reports `failures=0`.
- README: `### Production build SHA selection`; `The `build_sha` input is optional.`; the empty=latest/set=exact sentence; `Resolved build`; `CI run`; `build_sha must be a full 40-character lowercase commit SHA.`; the `-f build_sha=<40-hex-sha>` command; `To deploy the latest successful build, omit `-f build_sha`.`; the same-SHA sentence; `Render deploy live`; the contract/schema sentence; the immutable-policy sentence; the automatic-development-unchanged sentence; `Build SHA selection is available for `environment=production` only.`
- `deployment.md`: `### Build SHA selection (production)`; the optional-input sentence; the may-not-be-latest sentence; `Resolved build`; `CI run`; the lowercase `build_sha` sentence; the deploy-contract and schema-gate sentences; the immutable-policy sentence; `Render deploy-by-commit`; `commitId`; `Render deploy live`; `--meta githubCommitSha`; the `--ref main` two-part sentence; `Select the known-good build with `build_sha``.
- `vercel-render-neon.md`: `### Production deploy with build SHA selection`; the command; the latest-omission sentence; `Render API deploy-by-commit`; `Render deploy live`; `current-deploy mismatch`; `Vercel deployment metadata`; `Vercel metadata projection: unavailable`; `Render 202`; `schema-incompatible build`; the lowercase `build_sha` sentence; the immutable-policy sentence; `select the known-good SHA with `build_sha``; `per-provider promote/rollback`.
- `containerization.md`: both pinned release-identity statements match; both old `github.sha` phrasings are absent.
- Supersession ledger: the exact `` `production-build-selection` — **in force**; adds optional `build_sha` selection (empty = latest, set = exact SHA) and a live Render completion/current-deploy proof to the manual production deploy; retains the manual trigger, CI guard, 23-name catalog, protection, fixed order and automatic development path `` row matches in both architecture references.
- Removed-UX negatives: no `previous-1`, no `The `build` dropdown offers`, no case-insensitive `dropdown|previous-[0-9]|relative label` in the three docs, and no old headings `### Production build selection`, `### Build selection (production)` or `### Production deploy with build selection`.
- Other stale-claim negatives: no `production dispatch always deploys the latest`, no `the only revision production can deploy is`, no `production has no way to choose`, no `cannot pass against the old instance`.

Workflow/config checks (part of the T2 verify):
- `npm ci` → exit 0.
- Pinned `rhysd/actionlint:1.7.12` over `.github/workflows/*.yml` → exit 0, no findings.
- `deploy.yml: build_sha optional text field pinned; no dropdown` (`inputs` exactly `build_sha,environment`; `build` absent; `build_sha` string/optional/empty default; description says lowercase).
- `vercel.json: valid JSON`.
- `render.yaml: one development service, unchanged`.

Link checks (added/changed links; plus a full scan of the four docs):
```
link: README.md -> docs/architecture/deployment.md: OK
link: README.md -> docs/architecture/vercel-render-neon.md: OK
link: README.md -> docs/features/production-provisioning/build-log-T6.md: OK
link: docs/architecture/deployment.md -> vercel-render-neon.md: OK
link: docs/architecture/vercel-render-neon.md -> deployment.md: OK
all relative links in the four changed docs: 18 checked, 0 missing
```

No-edit checks (`docs/features/README.md`, `status.md`):
- `status.md` and the r4 artifacts were committed first as `0e85012` (`chore: record build_sha-only spec revision and status`); `git status --porcelain -- docs/features/README.md docs/features/production-build-selection/status.md` → empty.
- `git diff --name-only de5b829d -- docs/features/README.md` → empty; `docs/features/README.md` was not edited.
- `.env*`: `git status --porcelain -- '.env*'` → empty; `git diff --name-only de5b829d -- '.env*'` → empty.

Feature-index proposal (for the orchestrator to apply; file not edited):

```
production-build-selection | Production Build Selection | accepted | 2026-11-27
```

Credential and build-log guards:
- `! grep -qE '[0-9a-f]{32,}' build-log-T2.md` → no match (short SHAs only).
- The T2 build-log token-shape guard (Brevo/SMTP/Render/Fly credential patterns) → no match; no email address, connection string or provider token is recorded.
- No secret value was read, printed or changed; the docs record names only.

## T2 verify

The exact r4 T2 block (`tasks.md` lines 214–314, `set -euo pipefail`) was run in place with `status.md` committed (`0e85012`):

- `bash /tmp/opencode/t2-verify-r4.sh` → **exit 0**.
- `npm ci` → exit 0; pinned `rhysd/actionlint:1.7.12` over `.github/workflows/*.yml` → exit 0, no findings.
- `deploy.yml: build_sha optional text field pinned; no dropdown`; `vercel.json: valid JSON`; `render.yaml: one development service, unchanged`.
- All README/deployment/vercel-render-neon/containerization positive greps, the removed-UX and other stale-claim negatives, both exact ledger rows, the feature-index row, the `status.md`/`README.md` no-edit checks, the `.env*` checks, the `link: ` check and the build-log hex/token guards passed (the command would have stopped on the first failure).
- A separate per-line docs check (`/tmp/opencode/check-each-grep-r4.sh`) reports `failures=0`, so no failure is hidden by the block's final command.

## Acceptance audit

- AC-10(a) → met: README has `### Production build SHA selection` with the optional `build_sha`, the empty=latest/set=exact rule, the resolved-SHA/CI-run lines, the full lowercase rule, the same-SHA Render+Vercel guarantee including `Render deploy live`/current-deploy, the contract/schema/immutable rules, the `-f build_sha=<40-hex-sha>` command, the latest restore omitting the flag, the automatic-development-unchanged statement and the production-only rule.
- AC-10(b) → met: `deployment.md` has `### Build SHA selection (production)`, the updated environments/triggers table, the resolver → guard → contract → schema → migration → sync → Render deploy-by-commit API → completion/current-deploy proof → health → Vercel same SHA → smoke order, the empty=latest/may-not-be-latest text, the `--ref main` two-part rule, the lowercase rule, the immutable-migration policy, `Select the known-good build with `build_sha`` rollback guidance and the exact ledger row.
- AC-10(c) → met: `vercel-render-neon.md` has `### Production deploy with build SHA selection` with the command, empty=latest/exact semantics, same-SHA evidence (`Render deploy live`, current-deploy check, `Vercel deployment metadata`), Render 201/202 and completion troubleshooting (`Render 202`, `current-deploy mismatch`), the `schema-incompatible build` case, the `Vercel metadata projection: unavailable` fallback, the immutable-migration policy, `select the known-good SHA with `build_sha`` and `per-provider promote/rollback`; the catalog note states no new names, and troubleshooting, rollback, local-vs-cloud and the ledger are updated.
- AC-10(d) → met: both containerization release-identity statements are the three-way rule (selected manual-production SHA; `github.sha` for manual development; `workflow_run.head_sha` for automatic), and both old `github.sha` phrasings are absent; no image/port/compose change.
- AC-10(e) → met: the removed-UX and stale-claim negatives pass, the false old-45-s phrase is gone, and the exact supersession-ledger row is present in both architecture references.
- AC-10(f) → met: the proposed row `production-build-selection | Production Build Selection | accepted | 2026-11-27` is recorded here; `docs/features/README.md` and `status.md` were not edited after the first commit.

## Deviations from spec

None.
