# Build log — T6a — Fix deploy CI preflight repository context

Task: T6a (2026-11-27)
Files changed: `.github/workflows/deploy.yml` (remote branch `fix/deploy-ci-preflight`, merged to `main` as `d10dfb1`; 1 added / 1 removed line) and `docs/features/production-provisioning/build-log-T6a.md` (this file). The local `feat/production-provisioning` was fast-forwarded to `origin/main`; no application code, no provider asset, no other workflow line, no comment edit, no push.
What changed & why: Created `fix/deploy-ci-preflight` from `main`, changed exactly the pre-checkout `gh run list` in `Verify CI succeeded for target commit` to `gh run list --repo "$GITHUB_REPOSITORY" ...`, and opened PR #4. The T6 run `45993542551` failed at that step before `Checkout` because `gh` could not resolve the repository from the empty runner workspace (`fatal: not a git repository`); no provider was touched. The owner merged PR #4 (`d10dfb1`); `origin/main` and the local feature branch now carry the fix.
Decisions: Used the authorized `--repo "$GITHUB_REPOSITORY"` form (not `GH_REPO`). Branch, one-line file commit and PR were created through the GitHub MCP tools (`create_branch`, `get_file_contents`, `create_or_update_file`, `create_pull_request`); the local clone was not pushed. The feature branch had already been fast-forwarded into `main` and deleted during integration, so it was recreated at its last pre-deletion tip (`9e77d62`) and `origin/main` was merged in (fast-forward to `d10dfb1`).
Testing note: T6a is the one-line workflow preflight fix (config change with `actionlint`/diff/dry-run proof, per `tasks.md` task types). No application code changed, so there is no unit/integration test boundary here; T8 owns the full repository suite. The feature-appropriate evidence is the exact PR diff, `actionlint`, the `gh run list --repo` dry-run and the PR's own CI checks, all recorded below.

## Status: COMPLETED — PR #4 merged, fix verified on `main`

- PR #4 was merged by the owner to `main` at `2026-11-27T12:20:51Z`; the PR `mergeCommit` is `d10dfb1` (squash merge).
- `origin/main` contains the one-line fix; merge-SHA CI run `45997877865` (`push`, `main`, `d10dfb1`) is `completed` / `success`.
- The local `feat/production-provisioning` branch was fast-forwarded to `origin/main` (`d10dfb1`), so its `.github/workflows/deploy.yml` carries the fix.
- The merge-SHA dry-run returns `success` and the full T6a verify block exits `0`.
- No provider or deploy call was made by T6a; the production dispatch is T6's next action.

## Branch and PR

- Base at creation: `main` at short SHA `00e2359` (the live `main` SHA at creation time; the local `origin/main` matched it). `main` later advanced to `9e77d62` (feature-branch integration) before the owner merge.
- Branch: `fix/deploy-ci-preflight`, created from `main` through `tools.github.create_branch`; response `refs/heads/fix/deploy-ci-preflight` at the `main` commit.
- One-line commit on the branch: `8e7dd6c` (created through `tools.github.create_or_update_file`; `.github/workflows/deploy.yml` only).
- PR: https://github.com/raultorres2603/CubeClicker/pull/4 — PR number **4**, base `main`, head `fix/deploy-ci-preflight`, state `MERGED`, merged at `2026-11-27T12:20:51Z`, merge commit `d10dfb1`, 1 commit, 1 changed file, additions 1, deletions 1 (squash-merged; the merge SHA is the PR `mergeCommit`).
- PR CI run `45996595986` (pull_request): green — `verify-app` pass (2m50s), `verify-workflows` pass (1m0s), `smoke-e2e` pass (1m43s), GitGuardian Security Checks pass. `verify-workflows` independently ran the pinned `actionlint`, the Vercel/Render parses and both Brevo guard fixtures on the PR content.

## Post-merge evidence

- `git fetch origin` → `origin/main` is `d10dfb1`; `git log --oneline -1 origin/main` → `d10dfb1 fix: add repository context to the deploy CI preflight (#4)`.
- `git show origin/main:.github/workflows/deploy.yml` contains the anchored line at line 53; `grep -c 'gh run list'` → 1:
  `if ! conclusion=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then`
- PR #4 read-back: `state MERGED`, `mergedAt 2026-11-27T12:20:51Z`, `mergeCommit d10dfb1`.
- Merge-SHA CI: run `45997877865` (`push`, `main`, head `d10dfb1`) `completed` / `success` — verify-workflows 1m2s, smoke-e2e 1m38s, verify-app 2m30s.
- Local merge: `feat/production-provisioning` had been fast-forwarded into `main` and deleted during integration; recreated at its last pre-deletion tip `9e77d62`, then `git merge origin/main` → `Updating 9e77d62..d10dfb1` / `Fast-forward` / `.github/workflows/deploy.yml | 2 +-` / `1 insertion(+), 1 deletion(-)`. Local `HEAD` is `d10dfb1` and `git diff --stat origin/main -- .github/workflows/deploy.yml` is empty.

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

Final merge-SHA dry-run, from `/tmp/opencode/t6a` (not a git repository), emulating the pre-checkout runner workspace:

```text
export GITHUB_REPOSITORY=raultorres2603/CubeClicker
MERGE_SHA=$(gh pr view 4 --repo "$GITHUB_REPOSITORY" --json mergeCommit --jq .mergeCommit.oid)   # short: d10dfb1
gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$MERGE_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'
→ success (exit 0)
```

Control run with the old form (no `--repo`) from the same non-git directory reproduces the T6 defect:

```text
gh run list --workflow CI --commit "$MERGE_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'
→ exit 1
failed to determine base repo: failed to run git: fatal: not a git repository (or any parent up to mount point /)
Stopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).
```

dry-run: success

### No git push

- The only remote writes were the authorized `fix/deploy-ci-preflight` branch, the one-line commit `8e7dd6c` and PR #4 (created through the GitHub MCP) plus the owner's merge of PR #4. `git push` was never run from this clone, and no remote ref was updated from it.
- After the local merge, `HEAD` is `d10dfb1` (plus this build-log update commit); `git diff --stat origin/main -- .github/workflows/deploy.yml` is empty.

No git push

## Owner merge

- owner merged: d10dfb1
- merge commit: d10dfb1
- The owner merged PR #4 to `main` at `2026-11-27T12:20:51Z`; the PR `mergeCommit` is `d10dfb1` (squash merge onto `main` at `9e77d62`).
- The fix is on `origin/main` (line 53 of `.github/workflows/deploy.yml`, one `gh run list`) and on the local `feat/production-provisioning` after the fast-forward merge.
- T6 next action: confirm the production names/protection, then dispatch `gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker` and capture the live proof.

## Verify block (final run)

Command: the exact T6a block from `tasks.md` (lines 266–286) extracted to `/tmp/opencode/t6a/t6a-verify.sh` and run as `bash /tmp/opencode/t6a/t6a-verify.sh` from the repository root after the log update and the local merge. The block is silent on success; raw result:

```text
$ bash /tmp/opencode/t6a/t6a-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=0
```

Traced run (`bash -x`), final lines — every assertion executed:

```text
+ grep -qE 'merge commit: [0-9a-f]{7,12}' docs/features/production-provisioning/build-log-T6a.md
+ grep -qF 'No git push' docs/features/production-provisioning/build-log-T6a.md
VERIFY_TRACE_EXIT=0
```

- The PR-derived assertions pass: extracted PR URL/4; `gh pr diff` content-line count is exactly 2; the added line contains `gh run list --repo "$GITHUB_REPOSITORY"`; no other content line changed.
- The local-file assertions pass because `feat/production-provisioning` was fast-forwarded to `origin/main` (`d10dfb1`): the anchored fix is on line 53, there is one `gh run list`, and the guard condition and dispatch-only `if` are unchanged.
- `actionlint` (pinned) passes; `owner merged`/`merge commit: d10dfb1` are recorded; `No git push` holds.

## Acceptance audit

- **AC-8(e) — the only `deploy.yml` change is the T6a one-line preflight fix; guard condition, step `if`, step order, permissions, triggers and concurrency unchanged; automatic path unchanged.** Met: the merge commit `d10dfb1` on `main` contains exactly the one-line fix; the PR diff is 1 added / 1 removed non-comment line (`gh run list --repo "$GITHUB_REPOSITORY"`); the guard condition, dispatch-only `if`, step order, permissions, triggers and concurrency are unchanged; `origin/main` has one `gh run list` call.
- **AC-10(b) — pinned `actionlint` passes; the T6a workflow diff is exactly one added and one removed non-comment line, the added line contains `--repo "$GITHUB_REPOSITORY"` in the pre-checkout `gh run list`, and no guard/`if`/step-order/permission/trigger/concurrency line changes.** Met for the T6a share: pinned `actionlint` exit 0 on the merged file (and the local tree), exact 2-content-line diff, anchored added line, merge-SHA dry-run `success`, and merge-SHA CI run `45997877865` green (its `verify-workflows` job ran actionlint, the Vercel/Render parses and both guard fixtures). The full repository gate remains T7/T8 scope.
- **T6a task scope.** Met: branch from `main` and the one-line file commit created through the GitHub MCP, PR #4 opened and merged by the owner (`d10dfb1`), `PR:`, `diff: 1 added / 1 removed`, `actionlint: pass`, `dry-run: success`, `owner merged`, `merge commit: d10dfb1` and `No git push` recorded; full T6a verify exit 0; no provider/deploy call, no builder merge, no branch deletion, no `.env*` edit, no `git push`.
- **Testing tiers.** No application behavior changed; T6a is an infrastructure/config task with the feature-appropriate proof above, and T8 owns the full repository suite and coverage gate.

## Deviations from spec

- `feat/production-provisioning` had already been fast-forwarded into `main` and deleted during integration before this completion. It was recreated at its last pre-deletion tip (`9e77d62`) and `origin/main` was merged in (fast-forward to `d10dfb1`); there were no conflicts and no content change beyond the merge.
- Otherwise none: the workflow edit is exactly the authorized line; no guard bypass, no other workflow change, no provider or deploy call, no builder merge, no branch deletion, no `git push`, and `.env*` is untouched.
