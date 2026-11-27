# Build log — T6a — Fix deploy CI preflight repository context

Task: T6a (2026-11-27)
Files changed: `.github/workflows/deploy.yml` (remote branch `fix/deploy-ci-preflight` only, through the GitHub MCP; 1 added / 1 removed line) and `docs/features/production-provisioning/build-log-T6a.md` (this file). No local `deploy.yml` edit, no application code, no provider asset, no other workflow line, no comment edit.
What changed & why: Created `fix/deploy-ci-preflight` from `main`, changed exactly the pre-checkout `gh run list` in `Verify CI succeeded for target commit` to `gh run list --repo "$GITHUB_REPOSITORY" ...`, and opened PR #4. The T6 run `45993542551` failed at that step before `Checkout` because `gh` could not resolve the repository from the empty runner workspace (`fatal: not a git repository`); no provider was touched.
Decisions: Used the authorized `--repo "$GITHUB_REPOSITORY"` form (not `GH_REPO`). Branch, one-line file commit and PR were created through the GitHub MCP tools (`create_branch`, `get_file_contents`, `create_or_update_file`, `create_pull_request`); the local clone was not pushed. The local `deploy.yml` is intentionally untouched until the owner merge lands it on `main`; the PR is the only carrier of the change.
Testing note: T6a is the one-line workflow preflight fix (config change with `actionlint`/diff/dry-run proof, per `tasks.md` task types). No application code changed, so there is no unit/integration test boundary here; T8 owns the full repository suite. The feature-appropriate evidence is the exact PR diff, `actionlint`, the `gh run list --repo` dry-run and the PR's own CI checks, all recorded below.

## Status: BLOCKED — PR ready, owner merge pending

- The one-line fix is committed on `fix/deploy-ci-preflight` and PR #4 is open, mergeable and green.
- The owner must merge PR #4 to `main`. `owner merged: pending` and `merge commit: pending` below are replaced with the merge SHA (7–12 hex characters) in the post-merge completion of this task.
- Nothing was merged, dispatched or deployed from this run; no provider or deploy call was made.

## Branch and PR

- Base: `main` at short SHA `00e2359` (the live `main` SHA at creation time; the local `origin/main` matched it).
- Branch: `fix/deploy-ci-preflight`, created from `main` through `tools.github.create_branch`; response `refs/heads/fix/deploy-ci-preflight` at the `main` commit.
- One-line commit on the branch: `8e7dd6c` (created through `tools.github.create_or_update_file`; `.github/workflows/deploy.yml` only).
- PR: https://github.com/raultorres2603/CubeClicker/pull/4 — PR number **4**, base `main`, head `fix/deploy-ci-preflight`, state `open`, draft `false`, mergeable `MERGEABLE`, merge state `CLEAN`, 1 commit, 1 changed file, additions 1, deletions 1.
- PR CI run `45996595986` (pull_request): green — `verify-app` pass (2m50s), `verify-workflows` pass (1m0s), `smoke-e2e` pass (1m43s), GitGuardian Security Checks pass. `verify-workflows` independently ran the pinned `actionlint`, the Vercel/Render parses and both Brevo guard fixtures on the PR content.

## Exact diff (one added / one removed line)

`gh pr diff 4 --repo raultorres2603/CubeClicker`:

```diff
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index 33227fa..174bd62 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -50,7 +50,7 @@ jobs:
           GH_TOKEN: ${{ github.token }}
           TARGET_SHA: ${{ github.sha }}
         run: |
-          if ! conclusion=$(gh run list --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then
+          if ! conclusion=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then
             echo "Unable to query CI runs for $TARGET_SHA; the token may lack actions:read" >&2
             exit 1
           fi
```

- diff: 1 added / 1 removed (non-comment content lines)
- `gh pr diff` content lines (`^[+-][^+-]`): 2 (one added, one removed)
- Content lines not containing `gh run list`: 0
- Reconstructed `main` → PR-head diff: `added=1`, `removed=1`, context lines only otherwise; `compare/main...fix/deploy-ci-preflight` reports `ahead_by: 1`, `behind_by: 0`, `total_commits: 1`, one file `.github/workflows/deploy.yml` with `additions: 1`, `deletions: 1`.
- The added line places `--repo "$GITHUB_REPOSITORY"` immediately after `gh run list`, i.e. it begins `gh run list --repo "$GITHUB_REPOSITORY" --workflow CI ...`.

## Guard invariants (unchanged)

PR-head `.github/workflows/deploy.yml`:

```text
53:          if ! conclusion=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then
57:          if [ "$conclusion" != "success" ]; then
48:        if: github.event_name == 'workflow_dispatch'
30:    if: github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')
```

- `gh run list` occurrences in the file: 1 (the fixed pre-checkout call).
- Guard condition (`if [ "$conclusion" != "success" ]; then`) is byte-identical to `main`.
- Dispatch-only step `if` (`if: github.event_name == 'workflow_dispatch'`) and the job `if` are byte-identical to `main`.
- The diff touches only the single `run:` line; step order, permissions (`contents: read`, `actions: read`), triggers (`workflow_run` + `workflow_dispatch` with unchanged choices/default) and concurrency are unchanged. The automatic `workflow_run` path still resolves to `development`.

## Verification

### actionlint (pinned 1.7.12)

PR-head file fetched from the branch and linted:

```text
podman run --rm -v /tmp/opencode/t6a:/repo:z -w /repo docker.io/rhysd/actionlint:1.7.12 deploy-pr.yml
→ exit 0 (no output)
```

The exact verify-block command on the local tree also exits 0:

```text
podman run --rm -v /var/home/raultorraco/Documents/Projects/CubeClicker:/repo:z -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml
→ exit 0 (no output)
```

actionlint: pass

### `gh run list --repo "$GITHUB_REPOSITORY"` dry-run

Run from `/tmp/opencode/t6a` (not a git repository), emulating the pre-checkout runner workspace:

```text
export GITHUB_REPOSITORY=raultorres2603/CubeClicker
MAIN_SHA=$(git -C /var/home/raultorraco/Documents/Projects/CubeClicker rev-parse origin/main)   # short: 00e2359
gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$MAIN_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'
→ success (exit 0)
```

Control run with the old form (no `--repo`) from the same non-git directory reproduces the T6 defect:

```text
gh run list --workflow CI --commit "$MAIN_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'
→ exit 1
failed to determine base repo: failed to run git: fatal: not a git repository (or any parent up to mount point /)
Stopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).
```

dry-run: success

### No git push

- Local `HEAD` is still `88c6717` on `feat/production-provisioning`; no local `fix/deploy-ci-preflight` branch exists, and `git diff --stat origin/main -- .github/workflows/deploy.yml` is empty (local file unchanged).
- The branch, commit `8e7dd6c` and PR #4 were created exclusively through the GitHub MCP. `git push` was never run; no remote ref was updated from this clone.

No git push

## Owner hand-off

- owner merged: pending
- merge commit: pending
- Owner action: **merge PR #4 (https://github.com/raultorres2603/CubeClicker/pull/4) into `main`.** The PR is mergeable (`MERGEABLE`, `CLEAN`) and all its checks are green.
- Post-merge completion of T6a (after the owner reports the merge):
  1. `git fetch origin` and record the merge commit as `merge commit: <short-sha>` (7–12 hex characters) and `owner merged: <short-sha>`; merge `origin/main` into `feat/production-provisioning` so the local `deploy.yml` carries the fix.
  2. Re-run the dry-run with the merge SHA: `gh run list --repo raultorres2603/CubeClicker --workflow CI --commit <merge-sha> --limit 1 --json conclusion --jq '.[0].conclusion'` → `success`.
  3. Re-run the full T6a verify block; with the merge recorded and the local file synced, all assertions (including `merge commit: [0-9a-f]{7,12}`) pass.
  4. T6 re-dispatches the same production deploy (`gh workflow run deploy.yml --ref main -f environment=production`) after the fix is on `main`.

## Verify block (pre-merge run)

Command: the exact T6a block from `tasks.md` (lines 266–286) extracted to `/tmp/opencode/t6a/t6a-verify.sh` and run as `bash /tmp/opencode/t6a/t6a-verify.sh`; `set -euo pipefail` is inside the block. The block is silent on success; raw result:

```text
$ bash /tmp/opencode/t6a/t6a-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=1
```

Traced run (`bash -x`), final lines — the block stops at the local-file assertion:

```text
+ grep -E '^[+-][^+-]'
+ grep -vE 'gh run list'
+ grep -q .
+ grep -qF 'gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion' .github/workflows/deploy.yml
VERIFY_TRACE_EXIT=1
```

- The PR-derived assertions pass: extracted PR URL/4; `gh pr diff` content-line count is exactly 2; the added line contains `gh run list --repo "$GITHUB_REPOSITORY"`; no other content line changed.
- The block then stops at the local-file assertion because the local `.github/workflows/deploy.yml` is still at `main`'s old line by design; it is updated by merging `origin/main` after the owner merge.
- The later log-field assertions (`owner merged`, `merge commit`, `No git push`) are not reached in this pre-merge run; the log currently records `owner merged: pending` and `merge commit: pending`, which the post-merge completion replaces.

## Acceptance audit

- **AC-8(e) — the only `deploy.yml` change is the T6a one-line preflight fix; guard condition, step `if`, step order, permissions, triggers and concurrency unchanged; automatic path unchanged.** Met at PR level: the PR diff is exactly 1 added / 1 removed non-comment line (`gh run list --repo "$GITHUB_REPOSITORY"`), the guard condition and dispatch-only `if` are byte-identical, and the file has one `gh run list` call. Effective on `main` only after the owner merge.
- **AC-10(b) — pinned `actionlint` passes; the T6a workflow diff is exactly one added and one removed non-comment line, the added line contains `--repo "$GITHUB_REPOSITORY"` in the pre-checkout `gh run list`, and no guard/`if`/step-order/permission/trigger/concurrency line changes.** Met for the T6a share: pinned `actionlint` exit 0 on the PR-head file (and on the local tree), exact 2-content-line diff, anchored added line, no other change. The full AC-10(b) gate (`vercel.json`/`render.yaml` parses, dispatch parse, guard fixtures) is T7/T8 scope; the PR's `verify-workflows` job already ran those and passed.
- **T6a task scope.** Met: branch from `main` and the one-line file commit created through the GitHub MCP, PR #4 opened, `PR:`, `diff: 1 added / 1 removed`, `actionlint: pass`, `dry-run: success` and `No git push` recorded; no provider/deploy call, no merge, no branch deletion, no `.env*` edit, no local `git push`.
- **Testing tiers.** No application behavior changed; T6a is an infrastructure/config task with the feature-appropriate proof above, and T8 owns the full repository suite and coverage gate.

## Deviations from spec

None. The workflow edit is exactly the authorized line; no guard bypass, no other workflow change, no provider or deploy call, no merge, no branch deletion, no `git push`, and `.env*` is untouched.
