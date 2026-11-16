# Build log — T7 — Fly development deploy (backend + Mailpit)

Task: T7 (2026-11-16) — development deploy slice: Fly apps, Mailpit sink, Neon URLs, backend secrets and deploy
Status: **blocked** — Fly.io rejects every release on this account's `$1` trial until a credit card is added.
Files changed: `infra/fly/mailpit.toml` (new, uncommitted), `docs/features/vercel-fly-neon-deployment/build-log-T7-fly.md` (this file, uncommitted)
What changed & why: Created the Fly apps `cubeclicker-development` and `cubeclicker-mailpit-development` in org `personal` (slug `raul-torres-413` in the Fly API) and authored a dev-only Mailpit app config (public HTTP 8025, private SMTP 1025). The first Mailpit deploy aborted at release creation with a hard billing gate, so no backend config, secret or deployment followed.
Decisions:
- Stopped at the billing gate exactly as the task instructs; no Vercel, GitHub-environment or Neon-secret work was attempted (out of this slice anyway).
- Nothing was deleted. The two app records and the IPs allocated by the aborted Mailpit deploy were left in place.
- `infra/fly/mailpit.toml` and this log stay uncommitted: the task's commit gate is conditional on a successful deployment.

## Tooling

| Item | Value |
| --- | --- |
| flyctl path | `/home/raultorraco/.fly/bin/flyctl` (`PATH` extended with `$HOME/.fly/bin`) |
| flyctl version | `flyctl v0.5.10 linux/amd64 Commit: 1f836fe16302703423c9751e5ae24afacf17377f BuildDate: 2026-11-12T19:50:47Z` |
| Auth identity | `flyctl auth whoami` → `raultorres2603@gmail.com` |
| Org | `flyctl orgs list` → `Raul Torres | personal | PERSONAL`; Fly API/MCP reports slug `raul-torres-413`, org id `2035606` |
| Fly MCP capability check | `fly-mcp` exposes only context/org reads and Managed Postgres tools (`create_postgres_cluster`, …); no app/machine/secret/deploy/log tools — `flyctl` is the only deploy path |

## Apps created (not deleted)

| App | Hostname | Status after blocked deploy | Notes |
| --- | --- | --- | --- |
| `cubeclicker-development` | `cubeclicker-development.fly.dev` | `pending`, image `-`, no machines | backend app exists; nothing deployed |
| `cubeclicker-mailpit-development` | `cubeclicker-mailpit-development.fly.dev` | `pending`, image `-`, no machines | IPs allocated by the aborted deploy: shared IPv4 `66.241.125.161`, dedicated IPv6 `2a09:8280:1::209:5b71:0` |

Raw evidence:

```
$ flyctl apps create cubeclicker-development --org personal
New app created: cubeclicker-development
$ flyctl apps create cubeclicker-mailpit-development --org personal
New app created: cubeclicker-mailpit-development

$ flyctl apps list
 NAME                            │ OWNER    │ STATUS  │ LATEST DEPLOY
 cubeclicker-development         │ personal │ pending │
 cubeclicker-mailpit-development │ personal │ pending │

$ flyctl machine list -a cubeclicker-mailpit-development
No machines are available on this app cubeclicker-mailpit-development

$ flyctl status -a cubeclicker-mailpit-development
App
 Name     │ cubeclicker-mailpit-development
 Owner    │ personal
 Hostname │ cubeclicker-mailpit-development.fly.dev
 Image    │ -
```

Region: requested `iad` (`--primary-region iad`). No machine ever started, so the region is unproven; the app's primary region is the only place it is recorded.

## Mailpit config authored

`infra/fly/mailpit.toml` (new):

- `[build] image = "axllent/mailpit:latest"` — no Dockerfile, no build step.
- `[http_service] internal_port = 8025`, `force_https = true`, `auto_stop_machines = "off"`, `auto_start_machines = false`, `min_machines_running = 1` — UI/API on public `cubeclicker-mailpit-development.fly.dev`.
- `[[vm]] cpu_kind = "shared"`, `cpus = 1`, `memory = "256mb"`.
- SMTP `1025` is deliberately **not** declared as a Fly service: Fly Proxy only routes declared service ports, so `1025` stays reachable only over 6PN private networking (`cubeclicker-mailpit-development.internal:1025`) and no paid dedicated IPv4 is requested (Fly docs: 6PN traffic connects directly to the Machine and bypasses Fly Proxy).
- `[env] MP_MAX_MESSAGES=500`, `MP_SMTP_AUTH_ACCEPT_ANY=1`, `MP_SMTP_AUTH_ALLOW_INSECURE=1` — bounded disposable store and AUTH over the unencrypted private hop.

Config validation passed (`Validating infra/fly/mailpit.toml` → `✓ Configuration is valid`).

## Deploy attempt and exact failure

Command (run twice; identical result):

```
flyctl deploy --config infra/fly/mailpit.toml --app cubeclicker-mailpit-development --primary-region iad --remote-only
```

Output tail:

```
==> Verifying app config
Validating infra/fly/mailpit.toml
✓ Configuration is valid
--> Verified app config
==> Building image
Searching for image 'axllent/mailpit:latest' remotely...
image found: img_8y6w4zj8332xv7rn

Watch your deployment at https://fly.io/apps/cubeclicker-mailpit-development/monitoring

Error: failed to create release (status 422): {"error":"You are on the $1 Fly.io trial. Add a credit card to use this feature. Add one here: https://fly.io/dashboard/raul-torres-413/billing"}
```

The failure is deterministic (two identical 422 responses), occurs **after** image resolution and **before** a machine is created, and is a billing-account gate rather than a config, image or region error. The account has no other organization to fall back to (`flyctl orgs list` returns only `personal`).

## Verification results

| Verify item | Result |
| --- | --- |
| `flyctl auth whoami` authenticated | **met** — `raultorres2603@gmail.com` |
| Apps `cubeclicker-development` / `cubeclicker-mailpit-development` created in `personal` | **met** — both listed, status `pending` |
| `infra/fly/mailpit.toml` authored (HTTP 8025, SMTP 1025 private, shared-cpu-1x, 256 MB, `iad`) | **met** — config validates; region unproven because no machine started |
| Mailpit deployed (`flyctl deploy … --remote-only`) | **unmet** — HTTP 422 `$1 Fly.io trial`, card required |
| Mailpit HTTP endpoint responds via Node `fetch` | **unmet** — no machine: `fetch('https://cubeclicker-mailpit-development.fly.dev/')` → `fetch failed` (the app hostname has no started Machine) |
| Neon `development` pooled/direct URLs retrieved | **not attempted** — deliberately stopped at the billing gate before touching secrets (they would have no destination to stage into) |
| Backend Fly secrets set without exposing values | **not attempted** — same reason; nothing was printed, no secret file was created |
| Backend deployed (`flyctl deploy --config fly.config.toml …`) | **not attempted** — blocked upstream by the same billing gate |
| `https://cubeclicker-development.fly.dev/healthz` returns 200 `{"status":"ok"}` | **unmet** — no deployment; Node `fetch` → `fetch failed` |
| `flyctl status -a cubeclicker-development` machine count/region | **unmet** — app exists, image `-`, no machines |
| Backend→Mailpit SMTP reachability on `…internal:1025` | **unverified** — no backend machine to run the probe from and no Mailpit machine to answer |

## Secret hygiene

- No Fly token, Neon connection string, SMTP password or role password was read, printed or written. The Neon `get_connection_string`/secret-import steps were skipped because the deploy is blocked.
- This log contains only names, hostnames, timestamps, the account email, IP addresses and the provider error string.

```
$ grep -nE "postgres(ql)?://[A-Za-z0-9._-]+:[^@[:space:]]+@" docs/features/vercel-fly-neon-deployment/build-log-T7-fly.md
(no output; exit 1)
$ grep -nE "(FLY_API_TOKEN|VERCEL_TOKEN|SMTP_PASS|DATABASE_URL)=[A-Za-z0-9]|FlyV1 [A-Za-z0-9]|npg_[A-Za-z0-9]" docs/features/vercel-fly-neon-deployment/build-log-T7-fly.md
(no output; exit 1)
$ grep -nE "ep-[a-z]+-[a-z]+-[a-z0-9]+\.[a-z0-9.-]*neon\.tech" docs/features/vercel-fly-neon-deployment/build-log-T7-fly.md
(no output; exit 1)
```

The patterns are written to avoid matching their own command lines, so `exit 1` (no match) is the real audit result.

## Remaining blockers

1. **B1 — Fly.io billing gate (blocking everything in this slice).** Release creation returns HTTP 422: `You are on the $1 Fly.io trial. Add a credit card to use this feature.` Both app records exist but neither can run a Machine. Resolution is user-owned: add a payment method at `https://fly.io/dashboard/raul-torres-413/billing` (this also removes the "free-tier only" constraint assumption, since Fly requires a card even for its trial allowance), then re-run the Mailpit deploy, the backend secret import and the backend deploy from this log's commands.
2. **B2 — Mailpit public exposure decision.** The config publishes the Mailpit UI at `https://cubeclicker-mailpit-development.fly.dev`. No credentials are exposed beyond the development mailbox content; if the orchestrator prefers private-only access, the `[http_service]` block can be dropped/`flyctl ips release` applied after a successful deploy — deferred because nothing is deployed and the task requires the HTTP endpoint check.
3. **B3 — Neon development URLs still unset.** Once B1 clears, retrieve them via the Neon MCP and stage `DATABASE_URL` (pooled `-pooler` host) and `DIRECT_DATABASE_URL` (direct host) into `cubeclicker-development` without printing them, then deploy `fly.config.toml` and health-check `/healthz`.
4. **B4 — Docs drift (for acceptance).** `docs/architecture/vercel-fly-neon.md` / `spec.md` § Q-9 still state Mailpit is compose-only and cannot be a Fly `SMTP_HOST`. The user explicitly authorized a Mailpit Fly app; the doc needs a superseding note that the development environment now has a dedicated Fly Mailpit app while production still requires a provider. Not edited here (outside this task's `files_owned`).

## Acceptance audit

- Nothing in this slice claims AC-19. The live development proof remains unmet: no Mailpit machine, no backend machine, no health response, no deployed smoke run.

## Deviations from spec

- The spec's Q-9 assumption ("Mailpit … cannot be `SMTP_HOST` in Fly") is superseded by the user directive to run Mailpit on Fly; recorded as B4 for the documentation pass.
- No commit: the task's commit is conditional on a successful deployment, and the deployment is billing-blocked.
