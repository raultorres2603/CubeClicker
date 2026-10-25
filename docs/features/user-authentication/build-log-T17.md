# Build log — T17 — Containerization (compose + README)

Task: T17 (2026-10-25)
Files changed: compose.yaml, compose.smoke.yaml, README.md

What changed & why: Added a Postgres 16 `db` service (named `db-data` volume, `pg_isready` healthcheck) and a `mailpit` dev email-capture service to compose.yaml; wired backend `DATABASE_URL`/`SMTP_*`/etc. env passthrough with safe local defaults and `depends_on: db: condition: service_healthy`. Mirrored smoke env in compose.smoke.yaml. Documented new variables and surfaces in README.md.

Decisions: Default DB credentials are `cubeclicker/cubeclicker/cubeclicker` with `DATABASE_URL` default matching; overriding DB creds requires also setting `DATABASE_URL`. Mailpit image pinned to `latest` (dev-only). Named volume has no `:z` (avoids podman warning). No secrets committed; `.env*` untouched.

Evidence:
- `podman compose config` → validated (exit 0, no errors)
- `podman compose -f compose.yaml -f compose.smoke.yaml config` → validated (exit 0)
- `podman compose up -d` → all services healthy (db healthy, backend started, mailpit/mailpit ui 200)
- `npm run smoke` → SMOKE PASS (8/8 checks)
- health: `GET /healthz` → `{"status":"ok"}`; mailpit UI → 200

Acceptance audit:
- AC-27 (DB container) → met: compose.yaml adds `db` (postgres:16-alpine), named volume `db-data`, healthcheck; backend `depends_on` db healthy; `DATABASE_URL` env default points at `db`; `podman compose up` starts stack.
- AC-28 (Dev email capture) → met: `mailpit` service added; default SMTP host/port point at it; no real email sent in dev.
- AC-29 (Secrets via env only) → met: no credentials committed beyond dev defaults; `.env*` untouched; README documents variables.
- AC-30 (Migrations on startup) → partial/out-of-scope for T17: compose provides `db`; migration-on-boot is T19 (server.ts); smoke exercised healthy stack.

Deviations from spec: none.