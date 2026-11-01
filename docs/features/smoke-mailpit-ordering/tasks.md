# Tasks — Smoke Test Mailpit Ordering Fix

Dependency overview: T1 ∥ T2 → T3

## T1 — Add Mailpit to smoke depends_on `[P]`
depends_on: —
files_owned: compose.smoke.yaml
verify: `podman compose -f compose.yaml -f compose.smoke.yaml config` (exit 0); `grep -n "mailpit" compose.smoke.yaml`
acceptance: AC-2, AC-4
status: [x]

## T2 — Poll Mailpit readiness before auth registration in smoke.mjs `[P]`
depends_on: —
files_owned: tests/e2e/smoke.mjs
verify: `node --check tests/e2e/smoke.mjs` (exit 0)
acceptance: AC-6, AC-7
status: [x]

## T3 — Verify & integrate `[seq]`
depends_on: T1, T2
files_owned: docs/features/smoke-mailpit-ordering/build-log-final-verification.md
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `podman compose -f compose.yaml -f compose.smoke.yaml config`, `npm run smoke` (exit 0; `SMOKE PASS (12/12 checks)`)
acceptance: AC-1, AC-3, AC-5
status: [x]