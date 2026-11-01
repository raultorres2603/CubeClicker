# Build log — T2 — Poll Mailpit readiness before auth registration in smoke.mjs

Task: T2 (2026-11-01)
Files changed: tests/e2e/smoke.mjs
What changed & why: In `checkAuthFlow()`, poll `MAILPIT_URL + '/'` via the existing `pollUntilReady` helper before issuing `POST /auth/register`. On readiness failure, set `registerProblem` to a clear "Mailpit not ready: ..." message and skip registration/verify/login via the existing control flow, so the guest check still runs. No new recorded check (count stays 12).
Decisions: Used `pollUntilReady` (READY_TIMEOUT_MS budget) per plan; validate requires HTTP 200; folded readiness failure into the existing register check rather than adding a new one to preserve the 12-check count.
Evidence:
- `node --check tests/e2e/smoke.mjs` → exit 0
Acceptance audit: AC-6 → met (node --check exit 0); AC-7 → met (readiness poll added before registration, bounded timeout via pollUntilReady, clear failure message).
Deviations from spec: none