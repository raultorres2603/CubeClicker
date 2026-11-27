# Build log — T5a — Phase A owner hand-off

Task: T5a (2026-11-27)
Files changed: `docs/features/production-provisioning/build-log-T5a.md` (only; no application code, workflow, `render.yaml`, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: Performed the owner-authorized in-process copy of the non-secret `SMTP_FROM` variable from the `development` Environment to the `production` Environment (the value was never printed, read into this log or committed), then verified the six owner-held production secret names and the `SMTP_FROM` variable by name only. All six owner-held secrets and the `SMTP_FROM` variable are present in the final names-only check, so the Phase A owner hand-off is complete and T5 can proceed; `BREVO_API_KEY`, `VERCEL_TOKEN` and `RENDER_DEPLOY_HOOK_URL` appeared owner-side during the task (they were absent at the first post-copy check).
Decisions: The copy used `gh variable get`/`gh variable set` with the value held in process memory (never `gh secret set`, never an argument containing the value). Verification uses `--json name` listings only. No provider, deploy or development write was performed.
Testing note: T5a is the infrastructure owner gate defined in `tasks.md` (GitHub Environment state plus a build log; no application code, unit/integration boundary or coverage target). The feature-appropriate proof is the names-only GitHub Environment read-back plus the `gh` copy exit status; the full repository suite remains T8's gate.

## Authorized `SMTP_FROM` copy

- Owner authorization recorded: copy the non-secret `development` `SMTP_FROM` value to the `production` variable.
- Pre-copy state: `SMTP_FROM` already existed as a `production` variable name (T1 pre-state); the pre-copy value was never read.
- Command shape (the value is held in process memory between the two commands and never printed):

  ```bash
  val=$(gh variable get SMTP_FROM --env development --repo raultorres2603/CubeClicker)
  test -n "$val"
  printf '%s' "$val" | gh variable set SMTP_FROM --env production --repo raultorres2603/CubeClicker
  unset val
  ```

- Result: exit `0`; the `production` Environment `SMTP_FROM` variable now holds the copied value.
- Record: `SMTP_FROM variable: set (copied from development)`
- Division of names: `SMTP_FROM` is a variable, never a secret; `gh secret set` was not used for it. The two builder-set secrets `DATABASE_URL` and `DIRECT_DATABASE_URL` are set by T5, not T5a.

## Names-only verification (no value read)

`gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort` (post-copy):

```
RENDER_SERVICE_ID
SMTP_CONNECTION_TIMEOUT_MS
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_SECURE
```

`gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort` (final post-copy check):

```
BREVO_API_KEY
RENDER_API_KEY
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
SMTP_USER
VERCEL_TOKEN
```

Read-only source check (`gh variable list --env development ... --json name`): `SMTP_FROM` present; no value read.

Owner-gate presence check (names only; no value read):

| Name | Kind | Status |
| --- | --- | --- |
| `SMTP_FROM` | variable | present |
| `SMTP_USER` | secret | present |
| `SMTP_PASS` | secret | present |
| `BREVO_API_KEY` | secret | present |
| `VERCEL_TOKEN` | secret | present |
| `RENDER_API_KEY` | secret | present |
| `RENDER_DEPLOY_HOOK_URL` | secret | present |

- The first post-copy names-only listing showed only `RENDER_API_KEY`, `SMTP_PASS`, `SMTP_USER`; `BREVO_API_KEY`, `VERCEL_TOKEN` and `RENDER_DEPLOY_HOOK_URL` were added owner-side during the task. The listing and table above are the final observed state; no value was read at any point.
- `RENDER_DEPLOY_HOOK_URL` is the T4-recorded owner hand-off (`deploy hook: owner hand-off`); T4 exposed no hook read tool and no hook value was read, derived or recorded. Its presence was verified by name only.

## Phase A status

Phase A owner hand-off complete

- All six owner-held `production` Environment secrets are present by name: `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY`, `RENDER_DEPLOY_HOOK_URL`; the `SMTP_FROM` variable is present as well.
- `RENDER_DEPLOY_HOOK_URL: set (owner)`
- The five owner-held secrets and the T4-recorded deploy-hook hand-off are owner-supplied: `SMTP_USER`, `SMTP_PASS` and `RENDER_API_KEY` were already present at the T1 pre-state, while `BREVO_API_KEY`, `VERCEL_TOKEN` and `RENDER_DEPLOY_HOOK_URL` appeared during this task. The builder verified names only and never read, created or inferred a value.
- The builder-set secrets `DATABASE_URL` and `DIRECT_DATABASE_URL` are set by T5, not T5a. They are not part of this gate and do not appear in the listing above.
- No T5 command was run; no GitHub Environment secret write, provider call or deploy call was made in this task.

## Constraints honored

- No secret value was read, printed, recorded or committed: the only value touched was the owner-authorized non-secret `SMTP_FROM`, held in process memory and never echoed.
- The `development` Environment was read only (`gh variable get` for the authorized copy; names-only `list`); no development write occurred.
- The only GitHub write was the authorized `production` `SMTP_FROM` variable set. No secret write, no provider or deploy call, no `.env*` edit, no push.
- `.env*` was not touched; `git status --porcelain -- '.env*'` is empty.

## Verify

Command: the exact T5a block from `tasks.md` (the `bash` block under `## T5a — Phase A owner hand-off`, lines 163–174) extracted to `/tmp/opencode/t5a/t5a-verify.sh` and run as `bash /tmp/opencode/t5a/t5a-verify.sh`; `set -euo pipefail` is inside the block. Raw output:

```
$ bash /tmp/opencode/t5a/t5a-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=0
```

The block is silent on success (every check is a `test` or a `grep -q`/negated `grep`); exit `0` means every assertion passed:

| Verify area | Result |
| --- | --- |
| Build log present; `SMTP_FROM` variable present in the live `production` Environment; all six owner-held secret names present | PASS |
| `Phase A owner hand-off complete` marker and `names only; no value read` record present in this log | PASS |
| Credential-shaped and connection-string guards over this log | PASS |

## Acceptance audit

- **AC-5(d) — Phase A owner hand-off.** Met: the authorized `production` `SMTP_FROM` variable copy is done and the `production` Environment now holds the six owner-held secret names (`SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY`, `RENDER_DEPLOY_HOOK_URL`) plus the `SMTP_FROM` variable, verified by name only; the task records `Phase A owner hand-off complete` and T5 may proceed.
- **T5a acceptance scope.** Met for the executable part: the authorized variable copy is recorded, the six owner-held secret names and the variable are verified by name only, and `names only; no value read` is recorded. No secret value, connection string or credential appears in this log.
- **Testing tiers.** T5a is an infrastructure owner gate (`tasks.md` T1–T6 add no application tests or coverage target); the GitHub Environment names-only read-back and the `gh` write exit status are the feature-appropriate proof. No repository unit/integration boundary exists for GitHub Environment state, and T8 owns the full repository suite/no-regression gate.

## Deviations from spec

None. The owner completed the hand-off during the task: `BREVO_API_KEY`, `VERCEL_TOKEN` and `RENDER_DEPLOY_HOOK_URL` were absent at the first post-copy check and present in the final one, so the gate closed as complete without a scope change. No value was read or recorded at any point. No development write occurred, no provider/deploy call was made, and no push was performed.
