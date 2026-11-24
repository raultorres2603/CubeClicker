# Build log — T7 — Documentation: blocked ports, 2525, 502, recovery and event catalog

Task: T7 (2026-11-24)
Files changed: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/observability.md`, `docs/features/registration-account-exists/build-log-T7.md`

## What changed & why
- `README.md`: the Brevo recipe now states that Render free blocks outbound SMTP on ports 25, 465 and 587, documents the deployed development recipe (`SMTP_PORT=2525` with `SMTP_SECURE=false`, STARTTLS), keeps 587/465 valid only off Render free, and the canonical export plus CLI example use 2525.
- `README.md`: the `SMTP_PORT` table row carries `2525 (STARTTLS, Render free)`, the deployment catalog's development cell carries `2525 (set before merge)`, the development sync command uses `--body '2525'` (no development 587 command), and production keeps its 587 placeholder with the note that a Render-free production service also needs 2525.
- `README.md`: a new `### Registration recovery (development)` section records the pre-merge setting, the Deploy re-run, the `/healthz` check, both resend paths (pending screen and the unauthenticated `POST /auth/resend-verification` with placeholders), the `email:test` sender/SMTP-key check and the Q-1/Q-2 owner references.
- `README.md`: the transport-failure text now says HTTP `502` with code `verification_email_failed`, that the account stays persisted and unverified, and that resend recovers; the old 500 text and the pinned-587 wording are removed.
- `deployment.md` / `vercel-render-neon.md`: blocked-port rule, 2525/false, 502 `verification_email_failed`, the strict guard (malformed, 1025, STARTTLS) and the troubleshooting path replace the pinned-587 and HTTP-500 text.
- `observability.md`: new § Email delivery events catalogues `verification_email_delivery_failed` (warn), `smtp_transport_verify_ok` (info), `smtp_transport_verify_failed` (warn) and `smtp_transport_verify_skipped` (debug) with their exact fields and the no-PII statement.

## Decisions
- **Single source per fact.** The blocked-port rule appears once per document in the section that owns it (README Brevo recipe, deployment Brevo SMTP bullet, Vercel/Render SMTP section), so T8's verbatim re-run validates the same anchors that readers use.
- **Recovery section placement.** `### Registration recovery (development)` is the last section of `README.md`, so the awk extraction in the T7 verify block sees the whole section and no following heading.
- **Placeholders only.** The recovery commands use `<the U2 address>`, `<owner-address>` and `<frontend origin>`; no address, username, token or verification link is recorded here or in the docs.
- **Production stays placeholder-only.** Its catalog value remains `587`; the note `A Render-free production service also needs 2525.` records the provisioning-time rule (Q-2) without changing the catalog.
- **Index proposal, not an edit.** `docs/features/README.md` is orchestrator-owned; the row is proposed below.

## Evidence

### Exact T7 verify block
The block from `tasks.md` § T7 — `verify` was executed verbatim (the per-file blocked-port/2525/event loop; the README anchors; the recovery-section awk extraction; the deployment and Vercel/Render guard/negative checks; the observability event catalog; the build-log anchors; the repository index, address, token and credential guards) as one script under `set -euo pipefail` from the repository root, with only a final marker echo appended. Raw result:

```
$ bash <the T7 verify script>
T7 VERIFY BLOCK: ALL COMMANDS EXITED 0
EXIT=0
```

The block is silent on success: every positive `grep` matched, every negated guard found no match, and the `git diff`/`git rev-parse` guards produced no output.

### Committed-tree re-run (the definitive run)
After the T7 commit, the same script was re-run so the `git diff origin/main...HEAD` guards scan this task's committed added lines rather than an empty diff:

```
$ bash <the T7 verify script>
T7 VERIFY BLOCK: ALL COMMANDS EXITED 0
EXIT=0

$ git diff --name-only origin/main...HEAD -- README.md docs/architecture
README.md
docs/architecture/deployment.md
docs/architecture/observability.md
docs/architecture/vercel-render-neon.md
```

The guarded diff is non-empty, so the address and token guards really scanned the added lines and both exited 0. The four documentation files plus this build log are the only committed paths; `docs/features/README.md` is not among them.

### Anchor checks (file → checked literal → result)
| File | Checked specification anchor | Result |
| --- | --- | --- |
| `README.md` | `Render free blocks outbound SMTP on ports 25, 465 and 587.` | matched |
| `README.md` | `export SMTP_PORT=2525` and `SMTP_SECURE=false` (canonical export) | matched |
| `README.md` | `502`, `stays persisted and unverified`, `verification_email_failed` | matched |
| `README.md` | `STARTTLS, Render free` (SMTP_PORT table row) | matched |
| `README.md` | `2525 (set before merge)` (catalog development cell) | matched |
| `README.md` | `smtp-relay.brevo.com:2525` (CLI success example) | matched |
| `README.md` | development sync command with `--body '2525'` | matched |
| `README.md` | development sync command with `--body '587'` | no match |
| `README.md` | `### Registration recovery (development)` and the extracted section: `Before merging this feature`, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `/healthz`, `email:test`, `/auth/resend-verification`, `<the U2 address>`, `<owner-address>`, `Q-1` | all matched |
| `README.md` | `A Render-free production service also needs 2525.` | matched |
| `README.md` | old `A transport failure surfaces as HTTP` sentence | no match |
| `README.md` | old pinned-587 recipe sentence | no match |
| `docs/architecture/deployment.md` | `25, 465 and 587`, `2525`, `verification_email_failed` | matched |
| `docs/architecture/deployment.md` | `SMTP_PORT=2525`, `SMTP_SECURE`, `SMTP_SECURE=false`, `malformed`, `1025` | matched |
| `docs/architecture/deployment.md` | stale `587` + `STARTTLS, pinned` pairing | no match |
| `docs/architecture/vercel-render-neon.md` | `25, 465 and 587`, `2525`, `verification_email_failed` | matched |
| `docs/architecture/vercel-render-neon.md` | `SMTP_PORT=2525`, `SMTP_SECURE`, `SMTP_SECURE=false`, `malformed`, `1025` | matched |
| `docs/architecture/vercel-render-neon.md` | stale `587` + `STARTTLS, pinned` pairing, `Registration returns HTTP`, `surfaces as HTTP` | no match |
| `docs/architecture/observability.md` | the four events, `warn`, `info`, `debug`, `errorType`, `transportCode`, `host`, `port` | matched |
| `docs/architecture/observability.md` | `No email, username, account id, token, message or stack` | matched |
| `build-log-T7.md` | `Feature-index row proposal` and the slug `registration-account-exists` | matched |
| repository | `docs/features/README.md` absent from the working diff | exit 0 |
| repository | `origin/main` resolvable | exit 0 |
| repository | no unmatched address in the branch diff of `README.md` + `docs/architecture` | exit 0 |
| repository | no non-synthetic token-shaped value on the added lines of that diff | exit 0 |
| repository | build-log address, token/username and credential guards | exit 0 |

### Raw positive-anchor output
```
$ for f in README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md; do …; done
README.md blocked-port-hits=2
README.md 2525-hits=18
README.md event-hits=2
docs/architecture/deployment.md blocked-port-hits=1
docs/architecture/deployment.md 2525-hits=1
docs/architecture/deployment.md event-hits=1
docs/architecture/vercel-render-neon.md blocked-port-hits=2
docs/architecture/vercel-render-neon.md 2525-hits=4
docs/architecture/vercel-render-neon.md event-hits=3

$ grep -n '2525 (set before merge)' README.md
315:| `SMTP_PORT` | variable | `2525 (set before merge)` | `587` | yes |
$ grep -n 'smtp-relay.brevo.com:2525' README.md
178:Test email sent to <address> via smtp-relay.brevo.com:2525 (secure=false, starttls=required, auth=yes, from="CubeClicker <verified sender>")
$ grep -n 'A Render-free production service also needs 2525.' README.md
324:A Render-free production service also needs 2525. The `production` cell stays `587` placeholder-only until production is provisioned; when it is, set `SMTP_PORT=2525` with `SMTP_SECURE=false` (owner-owned, Q-2).
$ grep -n '### Registration recovery (development)' README.md
406:### Registration recovery (development)

$ recovery anchors (grep -cF in the extracted section)
Before merging this feature=1 SMTP_PORT=2525=3 SMTP_SECURE=false=2 /healthz=1 email:test=1 /auth/resend-verification=1 <the U2 address>=1 <owner-address>=1 Q-1=1

$ observability event counts
verification_email_delivery_failed=3 smtp_transport_verify_ok=2 smtp_transport_verify_failed=3 smtp_transport_verify_skipped=2
```

## Acceptance audit
- AC-9(a) → met: README § Brevo SMTP recipe starts from the exact blocked-port sentence, states the deployed `development` recipe `SMTP_PORT=2525` with `SMTP_SECURE=false` (STARTTLS), keeps 587/465 valid only off Render free, and the canonical export contains `export SMTP_PORT=2525`.
- AC-9(b) → met: the table row carries `2525 (STARTTLS, Render free)`, the catalog development cell `2525 (set before merge)`, the CLI example `smtp-relay.brevo.com:2525`, the development sync `--body '2525'` (no development `--body '587'`), and production stays placeholder-only with the exact `A Render-free production service also needs 2525.` note.
- AC-9(c) → met: `### Registration recovery (development)` contains the pre-merge setting (`Before merging this feature`, `SMTP_PORT=2525`, `SMTP_SECURE=false`), the Deploy re-run, `/healthz`, both resend paths (pending screen and the unauthenticated `/auth/resend-verification` with `<the U2 address>`/`<frontend origin>`), the `email:test` sender/SMTP-key check and the `Q-1`/Q-2 owner references; the login wording says username login works today and email login arrives with this feature.
- AC-9(d) → met: no `A transport failure surfaces as HTTP` text remains; registration/resend are documented as HTTP `502` with code `verification_email_failed`, the account `stays persisted and unverified`, and a resend recovers.
- AC-9(e) → met: `deployment.md` carries the blocked ports, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `verification_email_failed`, `malformed`, `1025` and the STARTTLS rule, and the stale pinned pairing no longer matches.
- AC-9(f) → met: `vercel-render-neon.md` carries the same set and no longer matches the pinned pairing, `Registration returns HTTP` or `surfaces as HTTP`.
- AC-9(g) → met: `observability.md` catalogs `verification_email_delivery_failed` (warn), `smtp_transport_verify_ok` (info), `smtp_transport_verify_failed` (warn) and `smtp_transport_verify_skipped` (debug, `no_credentials`/`unsupported`) with their exact fields and the sentence `No email, username, account id, token, message or stack`.
- AC-9(h) → met: `docs/features/README.md` is unmodified; the orchestrator handoff row is proposed below.
- Testing bar → documentation-only task (no source or behavior change): the task's executable verification is the per-file block above, and T8 re-runs it verbatim; there is no integration boundary to add a unit/integration test to.
- Files owned → only the five owned paths changed; no source, config, workflow, spec/plan/tasks/status or index edit.

## Deviations from spec
- None.

## Feature-index row proposal
`| registration-account-exists | Registration Account Exists: Working Verification Delivery, Honest Conflicts & Resumable Registration | building | 2026-11-24 |`
