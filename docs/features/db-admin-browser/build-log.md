# Build log — T1 — Add Adminer DB admin browser

Task: T1 (2026-10-26)
Files changed: compose.yaml, README.md
What changed & why: Added an `adminer` service (docker.io/adminer:4.8.1, pinned) bound to loopback on `${ADMINER_PORT:-8081}:8080`, wired to the `db` service via `ADMINER_DEFAULT_SERVER=db` and `depends_on: db: service_healthy`. Documented the new port/surface in README. No application code changes.
Decisions: Used full Adminer image (includes pgsql driver) pinned to 4.8.1; gated startup on db health for parity with backend; no healthcheck on adminer (stateless UI).

Evidence:
- `podman compose config` → parsed OK (adminer service emitted with host_ip 127.0.0.1, published 8081, target 8080, ADMINER_DEFAULT_SERVER=db, depends_on db service_healthy)
- `npm run lint` → no errors
- `npm run typecheck` → no errors (backend + frontend)
- `npm test` → 34 test files, 758 tests passed
- `npm run coverage` → exit 0; backend All files 94.66% stmts / 84.32% branches / 99.6% funcs / 94.66% lines; frontend All files 93.96% / 93.32% / 96.21% / 93.96%

Acceptance audit:
- AC (pinned image, loopback binding, port 8081, ADMINER_DEFAULT_SERVER=db, depends_on db) → met (compose config output)
- AC (README config row ADMINER_PORT default 8081) → met
- AC (README Quickstart surface table Adminer row) → met
- AC (compose config parses) → met
- AC (no app code changes) → met (diff limited to compose.yaml + README.md + build log)

Deviations from spec: none
