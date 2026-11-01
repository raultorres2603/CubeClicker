---
feature: smoke-test-hygiene
revision: 1
---

# Plan — Smoke Test Hygiene

## Architecture

Two independent, minimal edits, each confined to a single file:

1. **`compose.smoke.yaml`** — append exactly one `\n` to the end of the file. No other bytes change. This is a formatting-only fix with no semantic effect on Compose parsing.
2. **`tests/e2e/smoke.mjs`** — extend `pollUntilReady` to accept an optional third positional parameter `timeoutMs` defaulting to `READY_TIMEOUT_MS`, and use it (instead of the hardcoded `READY_TIMEOUT_MS`) for the readiness deadline. Update the single Mailpit readiness call site in `checkAuthFlow()` to pass `MAILPIT_TIMEOUT_MS`.

No new modules, state, interfaces, or dependencies. The change is additive to an existing function signature (backward compatible via default) and a call-site argument.

## Interfaces / contracts

- `pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS)` — returns `null` on success or the last observed problem string. The third parameter is optional; when omitted, behavior is identical to today. `READY_TIMEOUT_MS` remains the default so backend/frontend health polls are unaffected.
- Mailpit readiness call: `pollUntilReady(MAILPIT_URL + '/', (response) => …, MAILPIT_TIMEOUT_MS)`.
- `compose.smoke.yaml` terminates with exactly one `\n`.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `compose.smoke.yaml` | Edit | Add single trailing newline (AC-1, AC-2). |
| `tests/e2e/smoke.mjs` | Edit | `pollUntilReady` optional budget param; Mailpit call site uses `MAILPIT_TIMEOUT_MS` (AC-3, AC-4, AC-5). |

No other files are touched. No `src/`, Dockerfile, CI, or `compose.yaml` changes.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Optional third positional parameter on `pollUntilReady` (default `READY_TIMEOUT_MS`) | Minimal diff; preserves every existing call site without edits; matches the existing positional style (`url`, `validate`). | Options object (`{ timeoutMs }`) — more extensible but larger diff and inconsistent with current call style; rejected for hygiene scope. |
| 2 | Use the already-defined `MAILPIT_TIMEOUT_MS` (10 s) constant | The constant already exists (line 55); the review's only complaint is that it is not used by the readiness poll. No new constant needed. | Add a new constant — unnecessary duplication; rejected. |
| 3 | Trailing newline only; no other reformatting | AC-2 requires byte-identical content aside from the newline; keeps the diff reviewable. | Rewriting the file — would violate AC-2 and the minimal-diff rule. |

## Risks & mitigations

- Risk: the optional parameter could be passed in the wrong position by a future caller. Mitigation: documented in the JSDoc; default preserves current behavior; only the Mailpit call site changes now.
- Risk: smoke regression from the tighter 10 s Mailpit budget. Mitigation: prior feature OQ-2 assumes Mailpit ready in well under a second; the 12/12 smoke run (AC-9, AC-10) validates end-to-end.
- Risk: trailing-newline edit accidentally alters other bytes. Mitigation: byte-level verification (`tail`/`od`) and `git diff` review (AC-1, AC-2).

## Open questions

- OQ-1 — Resolved: positional parameter (see decision 1).
- OQ-2 — Carried from the prior feature: Mailpit readiness within the budget; validated by the smoke run.

## Documentation task

No documentation updates are required (no behavior, command, port, image, or config changes). The `docs/features/README.md` row is orchestrator-owned and applied on acceptance. No dedicated documentation task is added; the documentation impact is recorded here and in `spec.md`.
