# Build log — T1 — Switch `deploy.yml` trigger to manual (`workflow_dispatch`) only

Task: T1 (2026-11-01)
Files changed: `.github/workflows/deploy.yml`

What changed & why: Replaced the `on: push: branches: [main]` trigger with a bare `on: workflow_dispatch` so deploys run only on manual trigger; CI triggers in `ci.yml` untouched. Only the `on:` block edited.

Decisions: Minimal trigger (D-2) — no `inputs:` block; rely on GitHub's built-in ref selector and `github.sha`.

Evidence:
- `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml` → exit 0 (no output)
- `grep -n "workflow_dispatch" .github/workflows/deploy.yml` → `4:  workflow_dispatch` (match)
- `grep -n "push:" .github/workflows/deploy.yml` → `18:  build-and-push:` (the only occurrence is the pre-existing job id `build-and-push`, not a trigger key; no trigger-level `push:` remains). Note: the literal command matches the pre-existing job id substring; the trigger-level `push:` key is gone. Job rename is out of scope (files_owned = on: block only).
- `grep -n "inputs:" .github/workflows/deploy.yml` → no match (exit 1) — minimal trigger carries no inputs; `workflow_dispatch:` is bare
- `grep -n "uses: ./.github/workflows/ci.yml" .github/workflows/deploy.yml` → `16:    uses: ./.github/workflows/ci.yml` (match)
- `grep -n "environment: production" .github/workflows/deploy.yml` → lines 26, 70, 108 (≥1 match)
- `grep -E 'uses: .*@v[0-9]+' .github/workflows/deploy.yml` → no match (exit 1) — full-SHA pins only
- `grep -n "id-token: write" .github/workflows/deploy.yml` → lines 25, 69, 107 — all inside build-and-push/infra/deploy-services job permission blocks; workflow-level permissions (line 12) is `contents: read` only
- `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` → matches only in prior feature docs/reviews quoting the audit pattern (no credentials in `.github/`); no match in workflow files

Before `on:` block:
```
on:
  push:
    branches: [main]
```

After `on:` block:
```
on:
  workflow_dispatch
```

Acceptance audit:
- AC-1 → met (workflow_dispatch present, no push trigger key, no inputs block)
- AC-2 → met (uses: ./.github/workflows/ci.yml present)
- AC-3 → met (environment: production ×3)
- AC-7 → met (actionlint exit 0)
- AC-9 → met (SHA pins, id-token scoped, credential audit clean in .github)

Deviations from spec: The literal `grep -n "push:"` verify matches the pre-existing `build-and-push:` job id (substring), which cannot be removed without renaming the job (out of scope — only the `on:` block may change). Recorded as a documented false positive; trigger-level `push:` is removed. No other deviations.