# Tasks — Smoke Test Hygiene

Dependency overview: T1 ∥ T2 → T3

## T1 — Add trailing newline to compose.smoke.yaml `[P]`

depends_on: —
files_owned: compose.smoke.yaml
verify: `tail -c 2 compose.smoke.yaml | od -c` shows a single trailing `\n` and no double newline (AC-1); `git diff -- compose.smoke.yaml` shows only the added newline (AC-2); `podman compose -f compose.yaml -f compose.smoke.yaml config` exits 0 (AC-7).
acceptance: AC-1, AC-2, AC-7
status: [x]

## T2 — Use MAILPIT_TIMEOUT_MS for the Mailpit readiness poll in smoke.mjs `[P]`

depends_on: —
files_owned: tests/e2e/smoke.mjs
verify: `node --check tests/e2e/smoke.mjs` exits 0 (AC-6); source inspection confirms `pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS)` (AC-3) and the Mailpit call passes `MAILPIT_TIMEOUT_MS` (AC-4, AC-5).
acceptance: AC-3, AC-4, AC-5, AC-6
status: [x]

## T3 — Verify & integrate `[seq]`

depends_on: T1, T2
files_owned: docs/features/smoke-test-hygiene/build-log-final-verification.md
verify: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` exit 0; `npm run coverage` exit 0 (AC-8); `git diff --name-only` shows no changes under `src/` (AC-8); `podman compose -f compose.yaml -f compose.smoke.yaml config` exit 0 (AC-7); `npm run smoke` unprimed prints `SMOKE PASS (12/12 checks)` exit 0 (AC-9); `npm run smoke` primed (Mailpit pre-started) prints `SMOKE PASS (12/12 checks)` exit 0 (AC-10); record raw evidence in the build log.
acceptance: AC-7, AC-8, AC-9, AC-10
status: [x]
