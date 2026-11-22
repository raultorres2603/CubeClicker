# Build log — T5 — Create the GitHub Environment placeholders

Task: T5 (2026-11-22)
Files changed: `docs/features/deploy-brevo-env-placeholders/build-log-T5.md` (repository); external side effect: GitHub Environments `development` and `production` variables/secrets (owner-authorized, AC-9(c)/AC-10(a))
What changed & why: Ran the two write-permission probes (both HTTP 422, nothing created), then created only the four missing `development` names, moved the existing `SMTP_USER` variable value into the secret through stdin and deleted the variable, and created all nine pinned `production` placeholders. Existing `development` values were preserved.
Decisions: Owner decision 2026-11-22 "Preserve existing, add missing" (plan D-13, spec r4) — `development` keeps `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_PASS` untouched; `SMTP_USER` classification moves variable → secret with its value carried over in-process; `production` stays all-placeholder.

## Preconditions and write-permission probes

`gh auth status` → logged in to github.com as `raultorres2603`; token scopes: `gist`, `read:org`, `repo`, `workflow` (classic token). Endpoint permission (spec Q-12): a classic token with `repo` covers Environment variables and secrets writes; the fine-grained equivalent is **Environments: Read and write**. Both probes are validation-failure checks: GitHub authorizes the request before rejecting the missing required body, so an empty JSON body returns a validation status and creates nothing.

Exact probe commands (run before any mutation):

- `printf '{}' | gh api --method PUT repos/raultorres2603/CubeClicker/environments/development/secrets/__write_permission_probe --input -` → **HTTP 422**
- `printf '{}' | gh api --method POST repos/raultorres2603/CubeClicker/environments/development/variables --input -` → **HTTP 422**

No body was read back or recorded. Both probes created nothing (the success branches were not taken; no `__write_permission_probe` entry exists in the final listings).

Environment existence (names only):

```
gh api repos/raultorres2603/CubeClicker/environments --jq '.environments[].name' → development, production
gh api repos/raultorres2603/CubeClicker/environments/development --jq '.name' → development
gh api repos/raultorres2603/CubeClicker/environments/production --jq '.name' → production
```

## `development` — names-only pre-state

Captured with `gh variable list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name'` and the `gh secret list` equivalent, before any mutation:

```
development variables (before):
FRONTEND_ORIGIN
MAX_USERS_PER_SERVER
SESSION_COOKIE_SAMESITE
SESSION_COOKIE_SECURE
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_USER
VERCEL_ORG_ID
VERCEL_PROJECT_ID
VITE_API_URL
VITE_WS_URL
development secrets (before):
DATABASE_URL
DIRECT_DATABASE_URL
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
VERCEL_TOKEN
```

The pre-existing `SMTP_USER` **variable** selected the migration branch.

## `development` — created names (exact commands run, conditional on absence)

- `gh variable set SMTP_SECURE --env development --repo raultorres2603/CubeClicker --body 'false'`
- `gh variable set SMTP_CONNECTION_TIMEOUT_MS --env development --repo raultorres2603/CubeClicker --body '10000'`
- `gh variable set RENDER_SERVICE_ID --env development --repo raultorres2603/CubeClicker --body 'srv-dbtcvv9srm7s73au5bag'`
- `gh secret set RENDER_API_KEY --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-render-api-key>'`

## `development` — `SMTP_USER` variable → secret migration (value never printed)

Branch taken: **variable present → value moved to the secret via stdin** (no placeholder written for `development`).

- `gh variable get SMTP_USER --env development --repo raultorres2603/CubeClicker` — value captured in-process only, never echoed, logged, written to a file or passed as a command argument.
- `printf '%s' "$smtp_user_value" | gh secret set SMTP_USER --env development --repo raultorres2603/CubeClicker` — value delivered on stdin.
- temporary shell variable unset immediately after the pipe.
- `gh variable delete SMTP_USER --env development --repo raultorres2603/CubeClicker` — after the secret was written, so `SMTP_USER` exists only as a secret.

## `development` — preserved names (not read or overwritten)

- SMTP_HOST: preserved (existing)
- SMTP_PORT: preserved (existing)
- SMTP_FROM: preserved (existing)
- SMTP_PASS: preserved (existing)
- SMTP_USER: preserved (existing); variable value moved to the secret, never printed

Existing development values preserved by owner decision (2026-11-22, "Preserve existing, add missing"). SMTP_PASS was not read or overwritten. The preserved values are deliberately not recorded here; their presence and classification are proven by the names-only listings below.

## `production` — nine placeholders (exact commands run)

- `gh variable set SMTP_HOST --env production --repo raultorres2603/CubeClicker --body 'smtp-relay.brevo.com'`
- `gh variable set SMTP_PORT --env production --repo raultorres2603/CubeClicker --body '587'`
- `gh variable set SMTP_SECURE --env production --repo raultorres2603/CubeClicker --body 'false'`
- `gh variable set SMTP_CONNECTION_TIMEOUT_MS --env production --repo raultorres2603/CubeClicker --body '10000'`
- `gh variable set SMTP_FROM --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-verified-sender>'`
- `gh secret set SMTP_USER --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-login>'`
- `gh secret set SMTP_PASS --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-key>'`
- `gh variable set RENDER_SERVICE_ID --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-render-service-id>'`
- `gh secret set RENDER_API_KEY --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-render-api-key>'`

`production` had no variables and no secrets before these commands.

## Names-only final listings

Captured with `gh variable list --env <env> --repo raultorres2603/CubeClicker --json name --jq '.[].name'` and the `gh secret list` equivalent:

```
development variables (final):
FRONTEND_ORIGIN
MAX_USERS_PER_SERVER
RENDER_SERVICE_ID
SESSION_COOKIE_SAMESITE
SESSION_COOKIE_SECURE
SMTP_CONNECTION_TIMEOUT_MS
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_SECURE
VERCEL_ORG_ID
VERCEL_PROJECT_ID
VITE_API_URL
VITE_WS_URL
development secrets (final):
DATABASE_URL
DIRECT_DATABASE_URL
RENDER_API_KEY
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
SMTP_USER
VERCEL_TOKEN
production variables (final):
RENDER_SERVICE_ID
SMTP_CONNECTION_TIMEOUT_MS
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_SECURE
production secrets (final):
RENDER_API_KEY
SMTP_PASS
SMTP_USER
```

Nine-name assertion (names only) passed for both environments: variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `RENDER_SERVICE_ID`; secrets `SMTP_USER`, `SMTP_PASS`, `RENDER_API_KEY`. `SMTP_USER` exists only as a secret in both environments; no duplicate `SMTP_USER` variable remains in either. No value was read back or recorded.

## Guard state and merge ordering

The deploy guard will still block until the `development` `RENDER_API_KEY` placeholder is filled with a real Render key (Q-1); `SMTP_USER` for `development` was migrated, not left a placeholder, so it does not block. Any other missing or placeholder value in either environment also blocks by design — `production` is entirely placeholder-only (AC-10(a)).

Merge-ordering warning: the `development` `RENDER_API_KEY` placeholder must be filled before this feature merges to `main`, because `main` auto-deploys the `development` environment and the strict guard fails closed. The preserved development values (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, the migrated `SMTP_USER`, and `SMTP_PASS`) are already in place, so `RENDER_API_KEY` is the only remaining pre-merge `development` value (the owner should still confirm the preserved Brevo values per Q-2). `production` remains placeholder-only and unprovisioned.

## Evidence

- Write-permission probes: `HTTP 422` (secret `PUT`) and `HTTP 422` (variable `POST`), no entry created.
- T5 verify block from `tasks.md` re-run end-to-end after the operations → exit `0`; every assertion passed (environment listings, final names-only listings for both environments, `SMTP_USER` variable absence in both, the build-log command-line greps, the preserve/migration branches, the owner-decision/guard/merge-ordering statements, and the extended credential guard over this log).
- The first attempt of the same verify block aborted during `gh secret list --env production` with a transient GitHub API `unexpected EOF` (no assertion failed; the API call did not complete), and a separate read hit a transient TLS handshake timeout; the identical verify block was retried and exited `0`, and the affected names-only listings were re-read cleanly. No command, value or expected literal was changed between attempts.
- Extended credential guard over this file: no match (`xsmtpsib-`, `xkeysib-`, `SMTP_USER=`/`SMTP_PASS=` assignments with ≥12 value characters, `RENDER_API_KEY=` assignments with ≥12 value characters, `rnd_` tokens).
- No secret or variable value was printed or recorded at any point; the migrated `SMTP_USER` value existed only in a shell variable long enough to cross the stdin pipe.

## Acceptance audit

- AC-2(b) → met: the four missing `development` names were created with the pinned literals (`false`, `10000`, `srv-dbtcvv9srm7s73au5bag`, `<CHANGEME-render-api-key>`), recorded above; the five preserved names are recorded as `preserved (existing)`; `production` has all nine pinned placeholders. No real credential appears.
- AC-9(c) → met: names-only listings show the exact classification in both environments (`SMTP_USER`, `SMTP_PASS`, `RENDER_API_KEY` secrets; the other six variables), no `SMTP_USER` variable remains, and the `SMTP_USER` secret carries the moved variable value (migration commands recorded, value never printed).
- AC-10(a) → met: `production` holds the nine names with the pinned placeholders (only the four environment-independent constants are real); exact production `--body` command lines recorded above.

## Deviations from spec

None. The preserve branch (`SMTP_USER` variable present) was taken exactly as provisioned by spec r4; the placeholder branch was not needed.
