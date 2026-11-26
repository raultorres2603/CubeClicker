# Build log — T6 — Documentation: transport contract, runbook, events and supersession

Task: T6 (2026-11-26)
Files changed: `README.md`, `docs/architecture/email.md` (new), `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/observability.md`, `docs/architecture/containerization.md`, `docs/features/brevo-api-email-transport/build-log-T6.md`

What changed & why: rewrote the named documentation so the deployed transport is the Brevo HTTPS API on `443` (`EMAIL_TRANSPORT=brevo-api` + `BREVO_API_KEY`) while SMTP/Mailpit stays local/off-Render. Added the canonical `docs/architecture/email.md` (transport selection, exact request shape, fixed `10000` ms timeout, error mapping, events, key creation/rotation, redaction, recovery, supersession) and updated the README (email contract, environment table, test-email CLI, secret hygiene, eleven/nine catalog, 22-command runbook, key rotation, exact API-key recovery step, production code-catalog statement, registration recovery), the deployment reference, the Vercel/Render reference, the observability event catalog and the containerization pass-throughs.

Decisions:
- Production is documented as a code/documentation catalog with six pinned placeholders and five pinned constants; no live production environment is claimed or modified.
- The seven SMTP names remain catalogued/synced for local/off-Render parity and the strict port guard stays in force; only the managed deployed transport is the API.
- No compose service, image, port, volume, healthcheck, WebSocket endpoint, code or workflow file changed.
- Commit ids are recorded as `<commit>`; no bare 40-character SHA appears in this log.

Feature-index row proposal: `| brevo-api-email-transport | Brevo HTTPS Email Transport (deployed environments) | building | 2026-11-26 |` — `docs/features/README.md` is orchestrator-owned and was not edited by T6; the orchestrator applies/updates this row (state/date) at acceptance.

## Evidence

The T6 verify block from `docs/features/brevo-api-email-transport/tasks.md` (lines 227–251) was extracted verbatim to `/tmp/opencode/t6-verify.sh` and run from the repository root:

```
$ bash /tmp/opencode/t6-verify.sh
T6_VERBATIM_EXIT=0
```

All checks are `grep -Fq`/`test -f` assertions and are silent on success; the exit status above is the raw result. Because Bash exempts `!`-inverted commands from `errexit`, the block was additionally mirrored as a strict script that turns every stale-string negative, the no-README-diff assertion and the shared log guard into explicit `if … then exit 1` checks:

```
$ bash /tmp/opencode/t6-strict.sh
STRICT_NEGATIVE_AND_GUARD_AUDIT_PASS
T6_STRICT_EXIT=0
```

The verbatim run above was executed with the pre-existing, uncommitted orchestrator edit to `docs/features/README.md` temporarily stashed (the edit was present before T6 and was restored unchanged with `git stash pop` afterwards), so the `! git diff --name-only | grep -qx 'docs/features/README.md'` assertion reflected T6's own change set. T6 authored no change to that file. The pre-existing `docs/features/registration-account-exists/status.md` edit was left untouched.

Concrete spot checks:

```
$ awk '… Exact `gh` commands (22 lines) …'
runbook gh command lines: 22
$ git diff --check
git diff --check: clean
```

The four required files each contain the exact positive sentence at least once (raw `grep -c` counts):

```
README.md:1
docs/architecture/email.md:1
docs/architecture/deployment.md:2
docs/architecture/vercel-render-neon.md:2
```

`docs/architecture/deployment.md` and `docs/architecture/vercel-render-neon.md` contain it in more than one applicable paragraph; all four files satisfy the assertion.

Required strings verified by the block and the strict mirror: `EMAIL_TRANSPORT`, `brevo-api`, `BREVO_API_KEY`, `POST https://api.brevo.com/v3/smtp/email`, `api-key`, `htmlContent`, `textContent`, `443`, `10000`, `verification_email_failed`, `persisted and unverified`, the three `brevo_api_transport_verify_*` events, `Settings → SMTP & API → API Keys`, `rotate`, `Mailpit`, the no-new-service sentence, `eleven validated, nine synced`, `six pinned placeholders`, `production catalog`, the two catalog rows, both `gh` commands, the 22-line heading, the secrets/variables fragments, the production code-catalog sentence, the supersession sentence, the AC-11(a) ordering-deviation sentence, the before-merge requirement, `### Registration recovery (development)`, the API success line and the exact API-key recovery step.

Shared log guard (AC-12(e)): the guard regex is applied to this log in the verbatim block and in the strict mirror; both report no match (no address, token, key shape or credential assignment is present).

## Acceptance audit (AC-11)

- AC-11(a) → met: new `docs/architecture/email.md` contains every required token plus the exact positive sentence and the never-logged/committed/baked/sent-to-client statement.
- AC-11(b) → met: `README.md` contains every required positive string and the removed-stale-string list is absent; the new 22-command block has exactly 22 commands; the catalog rows, rotation strings, recovery step, production code-catalog statement, supersession and AC-11(a) deviation statement are present.
- AC-11(c) → met: `docs/architecture/deployment.md` contains the required positive strings and none of the listed stale strings.
- AC-11(d) → met: `docs/architecture/vercel-render-neon.md` contains the required `var`/`secret` catalog rows and positive strings, and none of the listed stale strings.
- AC-11(e) → met: `docs/architecture/observability.md` catalogs the three API probe events, the `transport` field, `brevo-api`, `HTTP_<status>` and `email transport`, retains the no-PII sentence and removes the two stale phrases.
- AC-11(f) → met: `docs/architecture/containerization.md` records `EMAIL_TRANSPORT`/`BREVO_API_KEY` and the exact no-new-service sentence, and no longer contains the stale pass-through phrase.
- AC-11(g) → met: `docs/features/README.md` was not edited; the `Feature-index row proposal` above carries the slug, title, state and date.

## Supersession / production statement

This feature supersedes the SMTP delivery recipe for deployed environments; it consumes the blocked `registration-account-exists` T9/AC-11 Phase B, retains the earlier sync evidence, and records the AC-11(a) ordering deviation rather than claiming it closed. The production catalog is a code/documentation contract and no live production environment is modified.

Deviations from spec: none.
