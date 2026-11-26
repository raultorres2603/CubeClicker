# Build log — T4 — Deploy catalog, guard, CLI, workflows and `render.yaml` (absorbs T5)

Task: T4 (2026-11-26) — combined task per the amended `tasks.md` r3 (former T4 + T5)
Files changed: `src/backend/src/deploy/render-env.ts`, `src/backend/src/deploy/render-env.test.ts`, `src/backend/src/deploy/render-env-cli.ts`, `src/backend/src/deploy/render-env-cli.test.ts`, `render.yaml`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `docs/features/brevo-api-email-transport/build-log-T4.md`

## What changed & why

- `render-env.ts`: added `EMAIL_CATALOG` (2) and `SYNC_CATALOG` (9, SMTP then email) and rebuilt `CATALOG` (11, sync then wiring); `SMTP_CATALOG` and `RENDER_WIRING` are byte-unchanged. Renamed the sync payload types to `SyncKey`/`SyncValues` and made `syncRenderEnv` write the nine `SYNC_CATALOG` names in order.
- Added `validateEmailTransport`/`formatEmailTransportFailure` with the five AC-7 reasons and exact blocks: deployed `smtp` (or unset/empty → runtime `smtp`), unknown transport, `xsmtpsib-`/`SMTP_PASS`-reused key, local Mailpit sender (bare, angle-only, display-name), and unparseable/missing sender. Only the non-secret `EMAIL_TRANSPORT` value is ever echoed; the sender and key never are.
- `render-env-cli.ts`: the catalog (11), then the email-transport guard, then the SMTP port guard; `buildSyncValues` projects `SYNC_CATALOG`; usage/check/dry-run/sync counts are 11/9 and the sync summary is `Synced 9 value(s)`.
- `render.yaml`: `EMAIL_TRANSPORT` and `BREVO_API_KEY` are declared `sync: false`, no `value`; every other service field and `envVars` entry is unchanged against `origin/main`.
- Workflows: both deploy CLI steps bind `EMAIL_TRANSPORT` from `vars` and `BREVO_API_KEY` from `secrets`; the two `ci.yml` fixtures gained the two names and assert the 11-value success line and the 6-placeholder production header.

## Decisions

- Guard order is catalog → email transport → SMTP port (AC-8(e)): a deployed `smtp` selection at 587 reports the transport block, while a `brevo-api` selection at 587 still reports the port block.
- `validateEmailTransport` keeps presence/`CHANGEME` in the catalog's hands (the CLI always calls it after a successful catalog) and applies only to `development`/`production`. A missing/empty transport value resolves to the runtime default `smtp` and is rejected.
- Fixtures stay credential-clean: the API-key fixture is 11 characters, SMTP-shaped tokens are built with `repeat()`, and no fixture prints a value.

## Verification

### Lint / typecheck / tests / coverage

```
$ npm run lint
> eslint .
lint: exit 0

$ npm run typecheck --workspace @cubeclicker/backend
> tsc --noEmit
typecheck: exit 0

$ npm test --workspace @cubeclicker/backend
 Test Files  52 passed (52)
      Tests  2093 passed (2093)
test exit=0

$ npm run coverage --workspace @cubeclicker/backend
All files          |   97.09 |    92.24 |   99.65 |   97.09 |
 src/deploy        |   98.81 |     99.3 |     100 |   98.81 |
  render-env-cli.ts|   95.49 |    96.66 |     100 |   95.49 | 185-189
  render-env.ts    |     100 |      100 |     100 |     100 |
coverage exit=0
```

The uncovered CLI lines are the `import.meta.url` process-entry guard, which only runs in the spawned child process; coverage stays far above the 80 thresholds and no exclusion was added.

### `render.yaml`

```
$ node -e "...find EMAIL_TRANSPORT/BREVO_API_KEY, require sync:false and no value..."
render.yaml: EMAIL_TRANSPORT + BREVO_API_KEY sync:false
```

```
$ node - <<'NODE'  # load origin/main:render.yaml and the working file, drop the two new keys
render.yaml: other service fields and other envVars unchanged
```

### Workflows

```
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml
actionlint exit=0
```

```
$ node - <<'NODE'  # parsed comparison of deploy.yml against origin/main
deploy.yml: triggers/concurrency/permissions/job/step order/uses/run/with unchanged; only the two CLI steps gained EMAIL_TRANSPORT and BREVO_API_KEY
```

CI fixture counts (exact):

```
ci.yml counts: EMAIL_TRANSPORT brevo-api 2; BREVO_API_KEY 2; fixture-key 1; CHANGEME key 1; 11-value line 1; 6-placeholder line 1
deploy.yml counts: EMAIL_TRANSPORT vars binding 2; BREVO_API_KEY secrets binding 2
```

### Process fixtures (real `tsx` CLI, hermetic environment)

`fixture_sender` is built with `printf` from parts so no address appears in this log.

```
fixture 1 (development API-valid): exit 0 + 11-value line OK
fixture 2 (production placeholders): exit 1 + 6-placeholder header OK; no port/transport block
fixture 3 (smtp selection at 587): exit 1 + deployed_requires_api line OK
fixture 4 (brevo-api at blocked 587): exit 1 + port block OK
fixture 5 (API key equals the SMTP password fixture): exit 1 + smtp_key_reused block OK
fixture 6 (local sender): exit 1 + local_sender block OK
```

The exact assertions run: fixture 1 exits 0 with `Deploy configuration OK: 11 value(s) present for the 'development' environment.`; fixture 2 exits 1 with the exact 6-placeholder header and placeholder line and neither a port nor a transport block; fixture 3 exits 1 with `Deploy blocked: EMAIL_TRANSPORT must be "brevo-api" for the 'development' environment; received "smtp".`; fixture 4 exits 1 with `Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment).`; fixture 5 exits 1 with `Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('development' environment).`; fixture 6 exits 1 with `Deploy blocked: SMTP_FROM is the local Mailpit default and cannot deliver through the Brevo API ('development' environment).`

### Full T4 verify (tasks.md lines 108–214, one script)

```
$ bash /tmp/opencode/t4/verify.sh   # the task's complete verify block, verbatim
FULL VERIFY EXIT=0
```

Raw tail of the same run (the fixture/count assertions are silent on success; the exit status covers them):

```
 Test Files  52 passed (52)
      Tests  2093 passed (2093)
All files          |   97.09 |    92.24 |   99.65 |   97.09 |
  render-env-cli.ts|   95.49 |    96.66 |     100 |   95.49 | 185-189
  render-env.ts    |     100 |      100 |     100 |     100 |
render.yaml: EMAIL_TRANSPORT + BREVO_API_KEY sync:false
render.yaml: other service fields and other envVars unchanged
deploy.yml: triggers/concurrency/permissions/job/step order/uses/run/with unchanged; only the two CLI steps gained EMAIL_TRANSPORT and BREVO_API_KEY
```

The script also ran `actionlint` (exit 0, no output), the six process fixtures, the CI/deploy binding counts, the log-file check and the shared guard below.

### Shared build-log guard (AC-12(e))

```
$ log=docs/features/brevo-api-email-transport/build-log-T4.md
$ test -f "$log"
$ log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
$ ! grep -qE "$log_guard" "$log"
guard exit=0 (no match)
```

## Acceptance audit

- AC-7(a) → met: `render-env.test.ts` pins `SMTP_CATALOG` (7, unchanged), `EMAIL_CATALOG` (2), `SYNC_CATALOG` (9, SMTP-then-email), `RENDER_WIRING` (2, unchanged) and `CATALOG` (11, sync-then-wiring) by strict array equality and order.
- AC-7(b) → met: production placeholder set yields exactly six placeholders in catalog order (`SMTP_FROM, SMTP_USER, SMTP_PASS, BREVO_API_KEY, RENDER_SERVICE_ID, RENDER_API_KEY`); an empty environment yields all eleven missing in order; the success payload returns all eleven values.
- AC-7(c) → met: explicit development **and** production API-valid `{ ok: true }` cases; `smtp` → `deployed_requires_api` in both deployed environments; unset/empty → the same `smtp` reason; `mailgun` → `unsupported_transport`; `xsmtpsib-`-shaped and `SMTP_PASS`-equal keys → `smtp_key_reused`; local sender in bare, **angle-only** and display-name form → `local_sender`; unparseable and missing sender → `invalid_sender`; every non-deployed target → `{ ok: true }`.
- AC-7(d) → met: all five blocks are asserted byte-for-byte (development or production label as applicable), the only echoed configured value is `EMAIL_TRANSPORT`, and a leaky sender/key assertion proves neither appears.
- AC-7(e) → met: the YAML parse requires both new names `sync: false` with no `value`; the filtered comparison against `origin/main:render.yaml` shows every other service field and `envVars` entry unchanged.
- AC-8(a) → met: process fixture 1 exits 0 with exactly `Deploy configuration OK: 11 value(s) present for the 'development' environment.`; the CLI unit test asserts the same line.
- AC-8(b) → met: process fixture 2 exits 1 with the exact six-placeholder header/line, and the unit test asserts the output contains neither `Deploy blocked: SMTP_PORT=` nor `Deploy blocked: EMAIL_TRANSPORT must be`.
- AC-8(c) → met: `--dry-run` prints one line per `SYNC_CATALOG` name (nine), then exactly `DRY RUN complete: 11 value(s) validated for the 'development' environment; 9 would be synced; no network calls made.`; no fetch in either no-network mode.
- AC-8(d) → met: default mode sends exactly nine `PUT`s in `SYNC_CATALOG` order with the pinned headers/bodies (including `brevo-api` and the API-key fixture), verifies each echo, prints nine `SYNCED <KEY> (value verified, not shown)` lines and `Synced 9 value(s) ...`; the wiring names never reach a body.
- AC-8(e) → met: fixture 3 (smtp + 587) prints the transport block, not the port block; fixture 4 (brevo-api + 587) prints the port block; fixture 1 (brevo-api + 2525 + STARTTLS) prints the success line.
- AC-8(f) → met: both CLI steps bind the two new names (counts 2/2); the parsed `deploy.yml` comparison shows triggers/concurrency/permissions/job fields, ordered step names, `uses`, `run` and `with` unchanged and only those four env keys added; `actionlint` passes.
- AC-8(g) → met: `ci.yml` has exactly two `EMAIL_TRANSPORT: brevo-api` fixtures, two `BREVO_API_KEY:` entries (one `fixture-key`, one angle-bracket placeholder), and exactly one 11-value line and one 6-placeholder line; `actionlint` passes.

## Testing tiers

- Unit: `render-env.test.ts` exercises the catalogs, catalog classification/formatting, the transport truth table and all five blocks, the sync request/echo/error/redaction paths with an injected `FetchLike` and logger. `render-env-cli.test.ts` exercises the in-process CLI branches.
- Integration: the CLI is spawned as a real `tsx` process (`spawnSync`) with a hermetic environment for the success, production-placeholder, port, transport, key-reuse and local-sender paths; `render.yaml` and both workflows are parsed as real files. No network is used.

## Deviations from spec

None. The task was implemented as the amended merged T4 (absorbs former T5); no file outside the T4 `files_owned` was edited, and no assertion, guard or coverage threshold was weakened.
