# Build log — T5 — GitHub `production` Environment catalog and protection

Task: T5 (2026-11-27)
Files changed: `docs/features/production-provisioning/build-log-T5.md` (only; no application code, workflow, `render.yaml`, provider asset, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: Populated the existing `production` GitHub Environment in place with the exact 15-variable / 8-secret catalog (14 builder-set variables; the two builder-set Neon secrets written on stdin; the six owner-held secrets and `SMTP_FROM` left untouched), then applied the `main`-only custom deployment branch policy and the owner `required_reviewers` protection rule. Re-read every provider and the `development` Environment before and after; no provider write, no deploy and no environment creation/deletion occurred.
Decisions: `production` is an existing environment, so no environment was created. The two Neon URLs were re-read from the `production` branch in-process and written through a mode-600 local bridge into `gh secret set` stdin; the value was never printed, never a command argument and never recorded. The six owner-held secret names and the `SMTP_FROM` variable (value never read) were not rewritten. Required reviewers were accepted with `prevent_self_review: false`, so the single-owner gate is self-approvable and the owner-declined fallback was not triggered; the `main` branch policy is present.
Testing note: T5 is an infrastructure task per `tasks.md` (provider/GitHub state plus a build log; no application code). The feature-appropriate proof is the names-only Environment listings, the protection read-back, the read-only provider read-backs and the T5 verify block; no repository unit/integration test boundary exists for GitHub Environment state, and the full repository suite remains T8's gate.

## T5a gate

- `docs/features/production-provisioning/build-log-T5a.md` records `Phase A owner hand-off complete` and `names only; no value read`.
- T5a complete.
- The six owner-held `production` secret names (`SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY`, `RENDER_DEPLOY_HOOK_URL`) were verified by name only and were not read, rewritten or compared.
- The `SMTP_FROM` variable was supplied by T5a and was not overwritten; its value was not read in T5 (`SMTP_FROM: present (value not read)`).

## Pre-state (names only)

Read immediately before the T5 writes with `gh variable list` / `gh secret list --json name` (names only) and `gh api .../environments/{production,development}`:

### `production` (pre-T5, 6 variables / 6 secrets)

```
RENDER_SERVICE_ID
SMTP_CONNECTION_TIMEOUT_MS
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_SECURE
```

```
BREVO_API_KEY
RENDER_API_KEY
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
SMTP_USER
VERCEL_TOKEN
```

- Counts: **6 variables / 6 secrets**; the three additional owner-held secrets (`BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_DEPLOY_HOOK_URL`) were added in T5a, which is why T1's earlier 3-secret pre-state is not repeated here.
- Protection pre-state: `{"deployment_branch_policy":null,"name":"production","protection_rules":[]}` (no protection, no branch policy).

### `development` (pre-T5, 15 variables / 8 secrets)

```
EMAIL_TRANSPORT
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
```

```
BREVO_API_KEY
DATABASE_URL
DIRECT_DATABASE_URL
RENDER_API_KEY
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
SMTP_USER
VERCEL_TOKEN
```

- Counts: **15 variables / 8 secrets** (the reference catalog).
- Protection pre-state: `{"deployment_branch_policy":null,"name":"development","protection_rules":[]}`.

## Builder writes

### Variables (14 names set with `gh variable set`; non-secret values)

`gh variable set <name> --env production --repo raultorres2603/CubeClicker --body <value>` was used for each value below (every value is a non-secret literal, so a command argument is allowed for these names). Existing variables were updated in place; no variable was deleted.

| Variable | Value |
| --- | --- |
| `FRONTEND_ORIGIN` | `https://cubeclicker.vercel.app` |
| `VITE_API_URL` | `https://cubeclicker.onrender.com` |
| `VITE_WS_URL` | `wss://cubeclicker.onrender.com/ws` |
| `VERCEL_ORG_ID` | `team_7cz2iixGr020Vqvjhj7Y1DNp` |
| `VERCEL_PROJECT_ID` | `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` |
| `MAX_USERS_PER_SERVER` | `10` |
| `SESSION_COOKIE_SECURE` | `true` |
| `SESSION_COOKIE_SAMESITE` | `none` |
| `EMAIL_TRANSPORT` | `brevo-api` |
| `RENDER_SERVICE_ID` | `srv-dc4mjd15efls739ua63g` |
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `2525` |
| `SMTP_SECURE` | `false` |
| `SMTP_CONNECTION_TIMEOUT_MS` | `10000` |

- `FRONTEND_ORIGIN`, `VITE_API_URL` and `VITE_WS_URL` are derived from the T3 `production frontend:` and T4 `production api:` records; `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and `RENDER_SERVICE_ID` are the T3/T4 provider IDs.
- `SMTP_FROM` was not set or overwritten by T5; it remains the T5a variable (`SMTP_FROM: present (value not read)`).

### Secrets (2 names set by the builder, names only)

| Secret | Source | Status |
| --- | --- | --- |
| `DATABASE_URL` | Neon `production` branch `br-floral-dream-zarerhtw` (pooled URL) | set |
| `DIRECT_DATABASE_URL` | same branch (direct URL, `-pooler` removed from the host) | set |
| `RENDER_DEPLOY_HOOK_URL` | T5a owner hand-off (T4 recorded `deploy hook: owner hand-off`) | already present; not written by T5 |
| `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `VERCEL_TOKEN`, `RENDER_API_KEY` | T5a owner secrets | already present; not read or rewritten |

- The two Neon URLs were re-read in-process with `tools.Neon.get_connection_string` (`project_id: patient-mountain-41401588`, `branch_id: br-floral-dream-zarerhtw`, database `cubeclicker`, role `cubeclicker_owner`); the pooled URL was used as `DATABASE_URL` and the direct URL was derived by removing `-pooler` from the host only. Both carried `sslmode=require`.
- Before each secret was written, the bridge opened a real `pg` connection and ran `SELECT 1` (output: `DATABASE_URL: connected`, `DIRECT_DATABASE_URL: connected`), then piped the same value into `gh secret set <name> --env production --repo raultorres2603/CubeClicker` on stdin. The value was never a command argument, never printed and never stored in the repository.
- The bridge was a mode-600 `node` script under `/tmp/opencode/t5` listening on `127.0.0.1` only; its log contained names/statuses only, and the script, log, stderr and pid files were shredded after use. The only stderr output was the `node-postgres` SSL-mode deprecation warning (no value).
- No `gh secret get`, no development secret copy and no value comparison was used.

## Production Environment catalog — final (names only)

`gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort`:

```
EMAIL_TRANSPORT
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
```

`gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort`:

```
BREVO_API_KEY
DATABASE_URL
DIRECT_DATABASE_URL
RENDER_API_KEY
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
SMTP_USER
VERCEL_TOKEN
```

- Counts: **15 variables / 8 secrets = 23 names** (`production github names: 15 variables / 8 secrets`).
- `SMTP_USER` is a secret only; no `SMTP_USER` variable exists (`SMTP_USER variable absent`).
- Exact non-secret values read back with `gh variable get` (14 builder-set variables): the table in § Builder writes is the exact read-back. The fifteenth variable, `SMTP_FROM`, is present by name only (`SMTP_FROM: present (value not read)`).
- The eleven-name guarded catalog is present: 7 variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `EMAIL_TRANSPORT`, `RENDER_SERVICE_ID`) and 4 secrets (`SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_API_KEY`).

## Protection

`PUT /repos/raultorres2603/CubeClicker/environments/production` body (owner user id from `gh api user --jq .id` = `55553058`):

```json
{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true},"reviewers":[{"type":"User","id":55553058}]}
```

Then `POST /repos/raultorres2603/CubeClicker/environments/production/deployment-branch-policies` with `{"name":"main","type":"branch"}` (the list was empty before the POST; no 409 occurred).

Protection read-back (`gh api repos/raultorres2603/CubeClicker/environments/production`, selected fields):

```json
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"production","protection_rules":[{"prevent_self_review":false,"reviewers":[{"id":55553058,"login":"raultorres2603","type":"User"}],"type":"required_reviewers"},{"prevent_self_review":null,"reviewers":[],"type":"branch_policy"}]}
```

Branch-policy read-back:

```json
{"branch_policies":[{"id":68496749,"name":"main","type":"branch"}],"total_count":1}
```

- The environment allows exactly the `main` custom branch policy (`custom_branch_policies: true`, one policy) and carries a `required_reviewers` rule naming the repository owner (`raultorres2603`, id `55553058`).
- `prevent_self_review: false`: the owner may approve a deployment they triggered, so the single-owner gate is approvable and the owner-declined/deadlock fallback was not triggered. The `main` branch policy is present regardless and is never removed.
- No `development` environment protection was set or changed.

## Development unchanged

- `development Environment unchanged`
- `No builder command targeted development`: the only T5 commands against development were the two read-only names-only listings (`gh variable list --env development`, `gh secret list --env development`); no write, protection `PUT`, branch-policy POST or variable/secret set targeted development.
- `development unchanged: PASS`

Pre-T5 and post-T5 names-only listings are identical (the two listings in § Pre-state are the pre set; the post set follows):

```
EMAIL_TRANSPORT
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
```

```
BREVO_API_KEY
DATABASE_URL
DIRECT_DATABASE_URL
RENDER_API_KEY
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
SMTP_USER
VERCEL_TOKEN
```

- `diff -u` on both pre/post listings: development variables unchanged; development secrets unchanged. Counts remain 15 variables / 8 secrets.
- Development protection post-read: `{"deployment_branch_policy":null,"name":"development","protection_rules":[]}` (identical to the pre-state).

## Provider read-backs (read-only)

Read with the T1-recorded Neon/Vercel/Render list/get tools before and after the GitHub writes; the pre and post values are identical, so T5 changed no provider resource.

### Neon (project `patient-mountain-41401588`)

- `production neon branch: br-floral-dream-zarerhtw` (name `production`, parent `none`, `primary: true`, `default: true`, `protected: false`, state `ready`, updated_at `2026-11-27T11:42:46Z`).
- Development branch `br-ancient-smoke-za1pdv7w` (parent `br-floral-dream-zarerhtw`, state `ready`, updated_at `2026-11-27T09:25:24Z`) is unchanged before and after.
- The Neon branch name `production` is an environment identifier, not a provider resource display name.

### Vercel

- `production vercel project: prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH https://cubeclicker.vercel.app`
- Production project read-back: name `cubeclicker`, account `team_7cz2iixGr020Vqvjhj7Y1DNp`, framework `vite`, Node.js `24.x`, `latestDeployment: null`, `ssoProtection.enabled: false`, updatedAt `1795778814291` (identical before and after T5).
- Development project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` (`cubeclicker-development`): latest deployment `dpl_8hXYFHhqw5uTczFB8Hy3UfXm8hWY`, updatedAt `1795770130687`, `ssoProtection.enabled: false` (identical before and after T5).
- The Vercel project/domain carry no `production`, `prod`, `dev`, `staging` or `stage` token.

### Render

- `production render service: srv-dc4mjd15efls739ua63g https://cubeclicker.onrender.com`
- Production service read-back: name `cubeclicker`, type `web_service`, runtime `docker`, `dockerfilePath: ./src/backend/Dockerfile`, `dockerContext: .`, plan `free`, region `frankfurt`, branch `main`, `autoDeployTrigger: off`, `numInstances: 1`, `healthCheckPath: ""`, `suspended: not_suspended`, updatedAt `2026-11-27T11:32:48.677457Z` (identical before and after T5).
- Development service `srv-dbtcvv9srm7s73au5bag` (`cubeclicker-development`): runtime `docker`, plan `free`, region `frankfurt`, branch `main`, `autoDeployTrigger: off`, `healthCheckPath: ""`, updatedAt `2026-11-27T09:01:43.970326Z` (identical before and after T5).
- The Render service name/host carry no `production`, `prod`, `dev`, `staging` or `stage` token.

### Name rule

- The Neon branch and the GitHub Environment are named exactly `production`; those two names are environment identifiers, not resource display names. The no-suffix rule applies only to provider resource display names: the Render service is `cubeclicker`, the Vercel project is `cubeclicker`, the Vercel domain is `cubeclicker.vercel.app` and the Render host is `cubeclicker.onrender.com`.
- No resource created by this feature has `-production` in its display name, and no `cubeclicker-production` resource/domain/host exists.

## Constraints honored

- No secret value, connection string or credential appears in this log or in any command argument. The two builder-set secrets were handled in-process and written on stdin; the six owner-held secret values and `SMTP_FROM` were never read.
- No provider write: Neon was read (`get_connection_string`, `list_branches`), Vercel and Render were read (`get_project`, `get_service`). No deploy, deploy hook, deletion or environment creation.
- The `development` Environment was read only; no development resource was changed.
- `.env*` was not touched (`git status --porcelain -- '.env*'` and the base diff are empty in the verify block). No `.env*` edit, no push.

## Verify

Command: the exact T5 verify block from `tasks.md` (the `bash` block under `## T5 — GitHub production Environment catalog and protection`, lines 184–253), extracted to `/tmp/opencode/t5/t5-verify.sh` and run as `bash /tmp/opencode/t5/t5-verify.sh`; `set -euo pipefail` is inside the block.

```
$ bash /tmp/opencode/t5/t5-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=0
```

The block is silent on success (every check is a `test`, a `grep -q`/negated `grep`, or a `grep -qx` inside a pipeline); exit `0` means every assertion passed:

| Verify area | Result |
| --- | --- |
| Build log present; the 15-variable and 8-secret exact name sets; counts 15/8; `SMTP_USER` not a variable | PASS |
| Exact values: `SMTP_PORT=2525`, `SMTP_SECURE=false`, `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_CONNECTION_TIMEOUT_MS=10000`, `EMAIL_TRANSPORT=brevo-api`, `MAX_USERS_PER_SERVER=10`, `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none` | PASS |
| Derived values match the T3/T4 records: `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `RENDER_SERVICE_ID`, `VERCEL_PROJECT_ID`; T3 `org id:` present | PASS |
| Custom branch policy true; exactly one branch policy named `main`; `required_reviewers` present (or the recorded fallback) | PASS |
| `development Environment unchanged`, `No builder command targeted development`, `development unchanged: PASS`, `T5a complete` | PASS |
| Production provider lines: `production neon branch:`, `production vercel project:`, `production render service:` | PASS |
| `.env*` status and base-diff checks; credential-shaped and connection-string guards over this log | PASS |

## Acceptance audit

- **AC-1(c) — environment identifiers vs display names.** Met: the Neon branch is named exactly `production` and the GitHub Environment is named exactly `production`; § Name rule states they are environment identifiers and applies the no-suffix rule only to provider display names.
- **AC-1(d) — no `-production` display name.** Met: Render `cubeclicker` / `cubeclicker.onrender.com`, Vercel `cubeclicker` / `cubeclicker.vercel.app`; no `cubeclicker-production` resource, domain or host exists in the read-backs.
- **AC-5(a) — exact 23-name catalog.** Met: 15 variables and 8 secrets exactly as listed; counts `15` / `8`.
- **AC-5(b) — guarded catalog and `SMTP_USER` secret-only.** Met: the eleven-name guarded set is present (7 variables + 4 secrets) and `SMTP_USER variable absent`.
- **AC-5(c) — exact builder-set values.** Met: all 14 builder-set variables read back with the exact values (table) and `SMTP_FROM` present by name; derived values equal the T3/T4 provider records.
- **AC-5(d) — T5a complete.** Met: T5a records `Phase A owner hand-off complete` with `names only; no value read`; the six owner-held secrets and `SMTP_FROM` are present by name. The authoritative non-placeholder proof is T6's guard success.
- **AC-5(e) — `main`-only policy and reviewers.** Met: `custom_branch_policies: true`, exactly one policy named `main`, and a `required_reviewers` rule naming the owner (`raultorres2603`, id `55553058`) with `prevent_self_review: false`, so the single-owner gate is self-approvable; the fallback was not needed and the branch policy is present.
- **AC-5(f) — development untouched.** Met: pre/post names-only listings identical (15/8), development protection unchanged, and `development unchanged: PASS`; only read-only `list` commands targeted development.
- **AC-6(b) — builder-set secret handling.** Met: exactly the two provider-generated Neon URLs were written by the builder via `gh secret set` stdin from a mode-600 in-process bridge; the `pg` check printed only `connected`; the bridge files were shredded; nothing was echoed or recorded.
- **AC-6(c) — owner/existing values never read.** Met: no `gh secret get`, no development secret copy and no value comparison; the owner-held secret names were only listed. `SMTP_FROM` was verified by name and its value was not read.
- **AC-6(e) — `.env*` untouched.** Met: the verify block's `.env*` status and base-diff checks pass.
- **Testing tiers.** T5 is an infrastructure task (`tasks.md` T1–T6 add no application tests or coverage target); the GitHub Environment names-only read-back, protection JSON, provider read-backs and verify block are the feature-appropriate proof. No repository unit/integration test boundary exists for GitHub Environment state, and T8 owns the full repository suite/no-regression gate.

## Deviations from spec

None. The environment already existed and was updated in place; no environment was created or deleted. Required reviewers were accepted with `prevent_self_review: false`, so the documented owner-declined/deadlock fallback was not triggered and the `main` branch policy was never removed. No provider write, deploy, development change or push was performed.
