# Tasks — Workflow Hygiene

Dependency overview: T1 ∥ T2 ∥ T3 (disjoint files); T-final depends on all (T1, T2, T3).

## T1 — Append trailing newline to `.github/workflows/ci.yml` `[P]`
depends_on: —
files_owned: `.github/workflows/ci.yml`, `docs/features/workflow-hygiene/build-log-T1.md`
verify: `tail -c 1 .github/workflows/ci.yml | od -An -tuC` (prints `10`), `tail -c 2 .github/workflows/ci.yml | od -An -tuC` (not `10  10`), `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml` (exit 0)
acceptance: AC-1, AC-3
status: [x]

## T2 — Append trailing newline to `.github/workflows/deploy.yml` `[P]`
depends_on: —
files_owned: `.github/workflows/deploy.yml`, `docs/features/workflow-hygiene/build-log-T2.md`
verify: `tail -c 1 .github/workflows/deploy.yml | od -An -tuC` (prints `10`), `tail -c 2 .github/workflows/deploy.yml | od -An -tuC` (not `10  10`), `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml` (exit 0), `grep -E 'uses: .*@v[0-9]+' .github/workflows/deploy.yml` (no match)
acceptance: AC-2, AC-3, AC-8
status: [x]

## T3 — Document the scoped credential-audit command in `docs/architecture/deployment.md` `[P]`
depends_on: —
files_owned: `docs/architecture/deployment.md`, `docs/features/workflow-hygiene/build-log-T3.md`
verify: `grep -F ":(exclude)docs/" docs/architecture/deployment.md` (match), `grep -n "docs/features/\*\*" docs/architecture/deployment.md` (match), `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` (no match)
acceptance: AC-6, AC-7
status: [x]

## T-final — Verify & integrate `[seq]`
depends_on: T1, T2, T3
files_owned: `docs/features/workflow-hygiene/build-log-T-final.md`
verify: `tail -c 1 .github/workflows/ci.yml | od -An -tuC` (prints `10`) and `tail -c 2 .github/workflows/ci.yml | od -An -tuC` (not `10  10`), `tail -c 1 .github/workflows/deploy.yml | od -An -tuC` (prints `10`) and `tail -c 2 .github/workflows/deploy.yml | od -An -tuC` (not `10  10`), `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` (exit 0), `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` (exit 0), `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 init -backend=false` (exit 0) then `podman run --rm -v "$PWD:/repo:z" -w /repo/infra/terraform docker.io/hashicorp/terraform:1.15.9 validate` (exit 0), `grep -F ":(exclude)docs/" docs/architecture/deployment.md` (match), `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN" -- . ':(exclude)docs/'` (no match), `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml` (no match), `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace), `npm run build`, `git diff --name-only` (only `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `docs/architecture/deployment.md`), `git status --porcelain` (evidences the untracked build-log set under `docs/features/workflow-hygiene/`)
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10
status: [x]