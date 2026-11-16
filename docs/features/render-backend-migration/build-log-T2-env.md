# Build log — T2 env — GitHub `development` environment secrets and variables

Task: T2 env (2026-11-16)
Files changed: `docs/features/render-backend-migration/build-log-T2-env.md`
What changed & why: Set the GitHub Actions `development` environment secrets and variables consumed by `deploy.yml` (Neon migration, Render deploy hook, Vercel build/deploy/alias, deployed smoke) plus backend runtime-parity values for the Render service catalog. No repository code, workflow, or application source changed.

## Secrets set (names only — values never recorded)

| Name | Source | Updated (UTC) |
| --- | --- | --- |
| `DATABASE_URL` | Neon MCP pooled connection string | 2026-11-16T10:16:23Z |
| `DIRECT_DATABASE_URL` | Neon MCP direct connection string | 2026-11-16T10:16:23Z |
| `SMTP_PASS` | Placeholder `dev` (guest-only dev) | 2026-11-16T10:16:28Z |

Pre-existing secrets were left untouched: `VERCEL_TOKEN` (2026-11-16T10:05:05Z) and `RENDER_DEPLOY_HOOK_URL` (2026-11-16T10:05:54Z) keep their original timestamps.

## Variables set (names only — values match the orchestrator brief)

`FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `MAX_USERS_PER_SERVER`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`.

Consumers:

- Workflow (`deploy.yml`): `FRONTEND_ORIGIN` (Vercel alias + smoke origin), `VITE_API_URL` (Render health poll + smoke), `VITE_WS_URL` (smoke), `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` (Vercel CLI).
- Backend runtime parity (Render service already carries these from T1; not read by the workflow): `MAX_USERS_PER_SERVER`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`.

## Neon source

Project `patient-mountain-41401588`, branch `br-ancient-smoke-za1pdv7w`, database `cubeclicker`, role `cubeclicker_owner`, read-write compute. `get_connection_string` returned the pooled URL (Neon `-pooler` host); the direct URL is the same string with `-pooler` removed from the host, matching T1's Render wiring. Both were verified by a real `pg` connection before being registered.

## Verification

```
$ gh secret list --env development --repo raultorres2603/CubeClicker
DATABASE_URL	2026-11-16T10:16:23Z
DIRECT_DATABASE_URL	2026-11-16T10:16:23Z
RENDER_DEPLOY_HOOK_URL	2026-11-16T10:05:54Z
SMTP_PASS	2026-11-16T10:16:28Z
VERCEL_TOKEN	2026-11-16T10:05:05Z
```

```
$ gh variable list --env development --repo raultorres2603/CubeClicker   # values redacted here
FRONTEND_ORIGIN	<set>	2026-11-16T10:16:28Z
MAX_USERS_PER_SERVER	<set>	2026-11-16T10:16:32Z
SESSION_COOKIE_SAMESITE	<set>	2026-11-16T10:16:33Z
SESSION_COOKIE_SECURE	<set>	2026-11-16T10:16:33Z
SMTP_FROM	<set>	2026-11-16T10:16:37Z
SMTP_HOST	<set>	2026-11-16T10:16:34Z
SMTP_PORT	<set>	2026-11-16T10:16:35Z
SMTP_USER	<set>	2026-11-16T10:16:36Z
VERCEL_ORG_ID	<set>	2026-11-16T10:16:31Z
VERCEL_PROJECT_ID	<set>	2026-11-16T10:16:31Z
VITE_API_URL	<set>	2026-11-16T10:16:29Z
VITE_WS_URL	<set>	2026-11-16T10:16:30Z
```

Database connectivity proof (node-postgres, values read from mode-600 temp files, nothing printed):

```
DATABASE_URL: connected db=cubeclicker user=cubeclicker_owner ok=1
DIRECT_DATABASE_URL: connected db=cubeclicker user=cubeclicker_owner ok=1
```

Secret handling: the Neon values travelled from the Neon MCP into mode-600 files under `/tmp/opencode` (outside the repository), were passed to `gh secret set` on stdin (never in arguments or a request body), then the files were shredded and the receiver process stopped. No secret value appears in this log, the repository, or a command line.

## `develop` branch / Render branch mismatch (reported, not resolved)

- Remote branches: `main` only (`gh api repos/raultorres2603/CubeClicker/branches` → `main`).
- Render service `srv-dbtcvv9srm7s73au5bag` tracks `branch=main`, `autoDeployTrigger=off`.
- The Render MCP exposes `update_environment_variables` but no service-update tool, so the tracked branch cannot be switched to `develop` from here.
- Consequence: `develop` was **not** created. A `develop` branch would run CI but the Render deploy hook would still build `main`, so it would not be a working dev path. For now the development deploy path is `workflow_dispatch` on `main` with `environment=development` (the input takes precedence over the branch-based environment/default). This mismatch is an open operational item.

## Decisions

1. **Direct URL derived from the pooled URL** by removing `-pooler` from the host (same rule as T1); both strings were validated with a live `pg` connection, so the derivation is proven, not assumed.
2. **`gh secret set` via stdin only.** Values were staged in mode-600 files outside the repo and piped; no secret appears in an argument, a request body, or this log.
3. **`SMTP_PASS=dev` is a placeholder.** Guest-only dev is the agreed posture; verification email delivery stays non-functional in the deployed environment until a reachable SMTP provider or Render-private Mailpit is chosen (existing blocker, unchanged).
4. **Backend runtime vars are catalog entries.** `MAX_USERS_PER_SERVER`, cookie flags, and `SMTP_*` are not consumed by `deploy.yml`; they mirror the Render service configuration so the `development` environment catalog is complete.
5. **No `develop` branch created.** Render cannot track it and there is no MCP service-update tool (see mismatch section).

## Acceptance audit

- Retrieve Neon direct + pooled URLs and set `DATABASE_URL`/`DIRECT_DATABASE_URL` as `development` secrets without printing them → met (timestamps above; live `pg` proof).
- Set `SMTP_PASS=dev` as a `development` secret → met.
- Set the 12 listed `development` variables → met.
- Names-only verification, existing `VERCEL_TOKEN`/`RENDER_DEPLOY_HOOK_URL` preserved → met (timestamps unchanged).
- `develop` branch check and mismatch report → met (only `main`; Render tracks `main`; no update tool).
- Build log committed alone with `docs: configure render development environment` → met after commit.
- Next step reported: push `d9744ef` + `4be7189` + this log, then `gh workflow run deploy.yml --repo raultorres2603/CubeClicker -f environment=development` → reported to the orchestrator.

## Testing note

No application code or workflow changed in this task, so lint/typecheck/unit/integration/coverage are unaffected; the full local gate runs in T4. The task's verification is the `gh` environment listing plus the live database connection proof above. No automated test can assert repository-external GitHub environment state beyond these commands.
