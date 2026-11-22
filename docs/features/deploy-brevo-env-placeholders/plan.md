---
feature: deploy-brevo-env-placeholders
revision: 4
---
# Plan — Deployment Brevo Environment Placeholders (GitHub Environment → Render)

**r4 (owner directive, no review round):** T5 **preserves the existing `development` values and adds only the missing names** ("Preserve existing, add missing", 2026-11-22), reversing the r1–r3 overwrite-with-placeholders behavior for that environment. `SMTP_USER` is read with `gh variable get` and its value moved to the secret through stdin without printing; `production` stays all-placeholder. The T5 verify, AC-2(b)/AC-9(c)/AC-10(a), AC-11(g)/(h)/(i), the config table, Q-2's factual note and the T6 greps are aligned; Q-1/Q-2/Q-3/Q-6/Q-12 are not reopened.

**r3 (scoped fix for spec review r2):** T7 now carries the exact AC-1 proof set (protected-file diff, `.env*` check, hermetic compose-config assertion, clean-stack Mailpit smoke) plus the guard self-test; the documentation contract and T6 pin the corrected README/deployment/vercel pipeline and operating statements. N3–N9 are folded; N10/N11 are backlog.

## Architecture

**Chosen shape: option (a) — the GitHub Environment is the source of truth; the deploy job validates all nine names and pushes only the seven SMTP values to the Render service through the Render API before the deploy hook, behind a hard placeholder guard.** Option (b) (GitHub as a documentation-only catalog, owner copies values into the Render dashboard) was rejected because it contradicts the owner's request ("I'll update with the values" in one place), leaves two human-edited copies, and cannot enforce "no placeholder reaches Render".

The nine-name **validation** set is split from the seven-name **sync** payload. `RENDER_SERVICE_ID` and `RENDER_API_KEY` are pipeline wiring: the service ID is the URL path coordinate and the API key is the bearer credential. They are validated (so production fails with a complete message) but never written to the Render service. This is a structural invariant: `syncRenderEnv` accepts only an `SmtpValues` object (the seven SMTP keys) and iterates only `SMTP_CATALOG`.

### Components

| Component | Layer | Responsibility |
| --- | --- | --- |
| `SMTP_CATALOG` (7) / `RENDER_WIRING` (2) / `CATALOG` (9) (`src/backend/src/deploy/render-env.ts`) | pure data | The validation catalog (nine names, order, GitHub type) and the sync catalog (seven SMTP names); the single definition the CLI, the tests and the docs describe |
| `SmtpKey` / `SmtpValues` | pure types | The seven-key sync payload type; `RENDER_*` cannot be passed to `syncRenderEnv` without an explicit cast |
| `isPlaceholder` / `validateDeployEnv` / `formatGuardFailure` | pure logic | Classify every one of the nine names as missing / placeholder / ok; render the pinned failure and success blocks |
| `renderEnvVarUrl` / `buildEnvVarPayload` / `redactValues` | pure logic | Build `https://api.render.com/v1/services/<id>/env-vars/<KEY>`, JSON-encode `{ "value": "…" }`, redact values from any text |
| `syncRenderEnv` | async logic (injected fetch) | `PUT` each SMTP name in order, assert the echoed `key`/`value`, produce the `SYNCED` lines; map failures to the pinned messages; never write the wiring names |
| `render-env-cli.ts` | CLI | Parse `--check-only` / `--dry-run` / `--help`, read `process.env`, validate nine, sync seven, set the exit code |
| `.github/workflows/deploy.yml` steps | pipeline | Preflight (`--check-only`) before the Neon migration; sync (default mode) immediately before the Render deploy hook; both bound to the nine names |
| `.github/workflows/ci.yml` steps | pipeline | Credential-free fixture proof that the guard rejects placeholders and accepts a complete set, with the exact CLI invocation and asserted output strings |
| `README.md` § Deployment Brevo runbook | docs | The executable `gh` block and value-entry UI, names-only verification, deployed proof, rollback, merge ordering, `SMTP_USER` migration |
| `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md` | docs | Catalog, classification, workflow order, source-of-truth statement, troubleshooting |

### Data flow

```
GitHub Environment (development | production)
  vars.SMTP_HOST/PORT/SECURE/CONNECTION_TIMEOUT_MS/FROM/RENDER_SERVICE_ID
  secrets.SMTP_USER/SMTP_PASS/RENDER_API_KEY
        │  step env: (never argv, never a file)
        ▼
render-env-cli (--check-only, then default mode)
  validate 9 → all present and no CHANGEME? ── no ──► print "Deploy blocked…" → exit 1 (job fails, no provider touched)
        │ yes
        ▼
PUT /v1/services/{RENDER_SERVICE_ID}/env-vars/{KEY}   × 7 SMTP keys only
        │ 200 { key, value } compared with the sent value
        │ RENDER_API_KEY is only the Authorization bearer; RENDER_SERVICE_ID only the URL path
        ▼
Render service saved variables ──(next deploy only)──► container environment
        ▲
        │ POST $RENDER_DEPLOY_HOOK_URL  (unchanged; the only deploy trigger)
GitHub Actions deploy job
```

### State ownership

- **GitHub Environment** owns the nine deployment values; it is the only place the owner edits them. In `development` the five pre-existing entries (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`) are preserved by the 2026-11-22 owner decision; T5 creates only the four missing names. The two wiring names are pipeline configuration, not service runtime configuration.
- **Render** owns the runtime copy of the seven SMTP values plus the dashboard-only `sync: false` names (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `CORS_ORIGIN`, `ALLOWED_ORIGIN`, `APP_BASE_URL`, `SESSION_COOKIE_*`), which this feature never reads or writes. `RENDER_API_KEY` is never stored on the service.
- **`render.yaml`** stays a value-free description of the service; it is not applied by the pipeline and does not change.
- **Local** owns nothing new: Mailpit defaults and `.env*` are untouched.

## Interfaces / contracts

### 1. Catalog (single definition, split validation/sync)

```ts
export const SMTP_CATALOG = [
  { key: 'SMTP_HOST', source: 'variable' },
  { key: 'SMTP_PORT', source: 'variable' },
  { key: 'SMTP_SECURE', source: 'variable' },
  { key: 'SMTP_CONNECTION_TIMEOUT_MS', source: 'variable' },
  { key: 'SMTP_FROM', source: 'variable' },
  { key: 'SMTP_USER', source: 'secret' },
  { key: 'SMTP_PASS', source: 'secret' },
] as const;

export const RENDER_WIRING = [
  { key: 'RENDER_SERVICE_ID', source: 'variable' },
  { key: 'RENDER_API_KEY', source: 'secret' },
] as const;

export const CATALOG = [...SMTP_CATALOG, ...RENDER_WIRING] as const; // 9 validated

export type SmtpKey = (typeof SMTP_CATALOG)[number]['key'];          // 7 synced
export type SmtpValues = Record<SmtpKey, string>;

export const PLACEHOLDER_TOKEN = 'CHANGEME';
```

`CATALOG` is the only list `validateDeployEnv` iterates. `syncRenderEnv` iterates `SMTP_CATALOG` only. Nothing else is read from `vars.*`/`secrets.*`. An extra property on a `SmtpValues` object (for example a cast-in `RENDER_API_KEY`) is ignored by the sync loop and is asserted absent from every request body.

### 2. Guard contract

```ts
export function isPlaceholder(value: string): boolean;                  // value.includes('CHANGEME')
export function validateDeployEnv(env: Record<string, string | undefined>):
  | { ok: true; values: Record<string, string> }
  | { ok: false; missing: string[]; placeholders: string[] };           // CATALOG order preserved
export function formatGuardFailure(environment: string, result: Failure): string;
```

Pinned output (exact lines; `Missing:` first when non-empty, `Placeholder:` when non-empty):

```
Deploy blocked: the '<env>' environment has <N> unset or placeholder value(s).
  Missing: <names>
  Placeholder: <names>
Remediation (names only; never paste a value into a command argument):
  variables: gh variable set <NAME> --env <env> --repo raultorres2603/CubeClicker
  secrets:   gh secret set <NAME> --env <env> --repo raultorres2603/CubeClicker
Runbook: README.md § Deployment Brevo runbook
```

Success: `Deploy configuration OK: 9 value(s) present for the '<env>' environment.`

### 3. Sync contract

```ts
export type FetchLike = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export function renderEnvVarUrl(serviceId: string, key: string): string; // https://api.render.com/v1/services/<id>/env-vars/<KEY>
export function buildEnvVarPayload(value: string): string;               // {"value":"<json-escaped>"}
export function redactValues(text: string, values: string[]): string;    // replaces each value (length >= 4) and any rnd_ token with [redacted]

export async function syncRenderEnv(input: {
  serviceId: string;          // URL path only; never a body
  apiKey: string;             // Authorization header only; never a body
  smtpValues: SmtpValues;     // exactly the seven SMTP keys
  fetchImpl: FetchLike;
  log: (line: string) => void;
}): Promise<{ synced: SmtpKey[] }>;
```

Pinned lines: `SYNCED <KEY> (value verified, not shown)` per SMTP key (seven); `Synced 7 value(s) to Render service <id> for the '<env>' environment.` at the end; `Render API error for <KEY>: HTTP <status> (<code>)`; `Render API request for <KEY> timed out after 10000ms`; `Render API request for <KEY> failed: <sanitized>` (values and key redacted); `Render API returned a different value for <KEY>; aborting`. Response bodies are parsed only for `code`; nothing else is printed.

### 4. CLI contract

`render-env-cli.ts [--check-only | --dry-run] [--help]` — env inputs `TARGET_ENVIRONMENT` (default `unknown`), `RENDER_SERVICE_ID`, `RENDER_API_KEY`, seven `SMTP_*`. Exit `0` on success/help, `1` on any validation, transport, status or mismatch failure.

- `--check-only`: validate nine; print the guard block or the success line; no network.
- `--dry-run`: validate nine; print one `DRY RUN: would set <KEY> (PUT <url>)` per SMTP key (seven), then `DRY RUN complete: 9 value(s) validated for the '<env>' environment; 7 would be synced; no network calls made.`
- default: validate nine, build `smtpValues` from the seven `SMTP_CATALOG` keys, call `syncRenderEnv`, print the `SYNCED` lines and `Synced 7 …`.
- Neither `--check-only` nor `--dry-run` may call `fetch` (the tests inject a throwing fetch).

The module exports `runRenderEnvCli(argv: string[], env: Record<string, string | undefined>, io: { fetchImpl: FetchLike; log: (line: string) => void }): Promise<number>` and only the thin bottom guard calls it with `process.argv.slice(2)`, `process.env`, the real `fetch` and `console.log`, then sets `process.exitCode`. The bottom guard mirrors `src/backend/src/db/migrate-cli.ts` and includes the `process.argv[1] !== undefined` check before `pathToFileURL(process.argv[1])` (otherwise importing the module throws). Every logic branch is unit-tested; the bottom guard's true branch is exercised by the process-level integration fixtures (T2/T4/T7), not by unit tests.

### 5. Workflow contract (`.github/workflows/deploy.yml`)

| Position | Step | Command | Env bindings |
| --- | --- | --- | --- |
| after `Install dependencies`, before `Migrate Neon database` | `Check deployment Brevo configuration` | `npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only` | 6 × `vars.*` + 3 × `secrets.*` |
| after `Migrate Neon database`, before `Deploy Render backend` | `Sync Brevo SMTP settings to Render` | `npx --no-install tsx src/backend/src/deploy/render-env-cli.ts` | 6 × `vars.*` + 3 × `secrets.*` |

`TARGET_ENVIRONMENT` stays job-level. The sync step writes only the seven SMTP keys; `RENDER_SERVICE_ID`/`RENDER_API_KEY` are inputs. Triggers, `concurrency`, `permissions`, `timeout-minutes`, the Render hook step, the health poll, the Vercel steps and the deployed smoke are unchanged. No `uses:` line is added or modified.

### 6. CI contract (`.github/workflows/ci.yml`, `verify-workflows`)

Two steps after the existing config checks, using `env:` mappings (never `NAME=` strings, so the credential guard cannot match the fixtures):

- **Guard rejects placeholders** — `TARGET_ENVIRONMENT: production`, `RENDER_SERVICE_ID: <CHANGEME-render-service-id>`, `RENDER_API_KEY: <CHANGEME-render-api-key>`, `SMTP_FROM: <CHANGEME-verified-sender>`, `SMTP_USER: <CHANGEME-smtp-login>`, `SMTP_PASS: <CHANGEME-smtp-key>`, the four real constants; the `run` block invokes `npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only`, captures the expected non-zero exit, and greps the exact `Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).` header.
- **Guard accepts a complete set** — `TARGET_ENVIRONMENT: development`, `RENDER_SERVICE_ID: srv-fixture`, `RENDER_API_KEY: fixture-key`, `SMTP_FROM: 'CubeClicker <no-reply@example.com>'`, `SMTP_USER: fixture`, `SMTP_PASS: fixture`; the `run` block invokes the same CLI and greps the exact `Deploy configuration OK: 9 value(s) present for the 'development' environment.` line. (`fixture` and `fixture-key` stay under the 12-character guard threshold; the YAML mapping form has no `=`.)

### 7. Documentation contract

- `README.md`: new `### Deployment Brevo runbook` under `## Deployment`; § Email's "set them on the Render service" becomes "set them in the GitHub `development` Environment (the deploy workflow syncs the seven SMTP names to Render)"; § Secret hygiene names the GitHub Environment as the source, adds `RENDER_API_KEY=` and `rnd_[A-Za-z0-9_-]{20,}` to the guard block, and adds the branch-history command; § What the pipelines run and § Deploy flow gain the two guard fixture steps and the check → Neon migration → sync → Render hook order; § User-side asset checklist's Secrets list gains `RENDER_API_KEY` and `SMTP_USER`, its Variables list drops `SMTP_USER` and gains `RENDER_SERVICE_ID`, the production statements become `placeholder-only` with `no Render service, Vercel project or Neon branch is provisioned` (removing "with no secrets, variables or protection rules yet" and "has no secrets, variables or protection rules"), and the final paragraph says the deploy workflow syncs the seven SMTP values from the GitHub Environment (not "reads from the dashboard").
- `docs/architecture/deployment.md`: § Platform split (Deploy flow order check → Neon migration → sync → Render hook), § Secrets and variables (secrets/variables lists, source of truth, nine validated/seven synced, the wiring names never written to Render, the remaining `sync: false` names dashboard-owned), § Environments and triggers (production is `placeholder-only` with `no Render service, Vercel project or Neon branch is provisioned`; remove "no secrets, variables, protection rules or deployment branch policy"), § Deploy pipeline (CI `verify-workflows` gains the two guard fixture steps; deploy order gains check/sync; the "Failed gates block the deploy before any provider is touched" sentence becomes "the sync runs after the Neon migration and before the Render deploy hook"), § Security and credential posture (production holds the nine placeholder names). Remove `No new secret name is introduced`, `every value is dashboard- or shell-supplied`, the `SMTP_*` dashboard-list item, `runtime-parity`, `the same names, none provisioned`, `Order: Neon migration (direct URL) → Render deploy hook`, `checkout/install → Neon migration → Render deploy hook` and `Production has no secret or protection configured yet`.
- `docs/architecture/vercel-render-neon.md`: § Architecture and § Routine development deploy (deploy order check → Neon migration → sync → Render hook), § Environment catalog (both environments, nine names, `SMTP_USER` secret, `RENDER_API_KEY` secret, `RENDER_SERVICE_ID` var, nine validated/seven synced, production `placeholder-only` with no service/protection asset), § Render service environment (the seven SMTP values are workflow-synced, not dashboard-supplied), § SMTP and email (sync + guard), § Promote to production ("Nothing is provisioned today" → `no Render service, Vercel project or Neon branch is provisioned`; "fails on the first missing production secret" → `fails at the Brevo placeholder guard`), § Troubleshooting (email says `check the GitHub` source; `Placeholder guard` entry), § Operating rules (`the seven SMTP names are synced from the GitHub Environment`; the remaining `sync: false` names stay dashboard/API-owned), § Local development vs cloud (Secrets source row `GitHub Environment (synced to Render for the seven SMTP names)`). Remove the runtime-parity/only-Render-consumes sentence, "On the live service these values were set in the Render dashboard", "has no secrets, variables or protection rules yet", "the environment has no secrets and no variables" and "use the Render dashboard/API for `sync: false` values and GitHub Environment secrets".
- `docs/features/README.md`: orchestrator-owned; the builder proposes its row diff in `build-log-T7.md` and does not edit the file.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `src/backend/src/deploy/render-env.ts` | New | Catalog split, guard, URL/payload/redaction helpers, `syncRenderEnv` with injected fetch | T1 |
| `src/backend/src/deploy/render-env.test.ts` | New | Unit tests for the above (exact objects, seven PUTs, wiring exclusion, fake fetch) | T1 |
| `src/backend/src/deploy/render-env-cli.ts` | New | CLI entrypoint (`--check-only` / `--dry-run` / `--help`) | T2 |
| `src/backend/src/deploy/render-env-cli.test.ts` | New | CLI argument, output and exit-code tests | T2 |
| `.github/workflows/deploy.yml` | Edit | Preflight + sync steps in the pinned positions with the 18 bindings | T3 |
| `.github/workflows/ci.yml` | Edit | Two credential-free guard fixture steps with the exact CLI invocation and asserted strings | T4 |
| `README.md` | Edit | Deployment Brevo runbook, § Email, § Secret hygiene, § User-side asset checklist corrections | T6 |
| `docs/architecture/deployment.md` | Edit | Catalog/classification, deploy-pipeline order, source of truth | T6 |
| `docs/architecture/vercel-render-neon.md` | Edit | Environment catalog, Render env table, SMTP section, runbook, troubleshooting, local-vs-cloud | T6 |
| `docs/features/deploy-brevo-env-placeholders/build-log-T<n>.md` | New | Per-task raw evidence | each task |
| `docs/features/README.md` | Proposed only | Feature index row (orchestrator-owned) | T7 (proposal in build log) |

Untouched by design: `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/backend/src/app.ts`, `src/backend/src/server.ts`, `src/backend/src/auth/**`, `render.yaml`, `.env*`, `package.json`, `package-lock.json`, `tests/e2e/**`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Option (a): the deploy job syncs GitHub → Render through the Render API | The owner edits one place; the values are enforced on every deploy; a placeholder cannot reach Render; testable without live credentials (fake fetch + fixtures) | (b) docs-only catalog + manual dashboard copy — two edited copies, no guard, contradicts the request; (c) Render environment group linked to the service — still a second manual surface and no placeholder guard |
| D-2 | Per-key `PUT /v1/services/{id}/env-vars/{key}`, never the bulk endpoint | Merge semantics: `DATABASE_URL`, `CORS_*`, `ALLOWED_ORIGIN`, `APP_BASE_URL`, `SESSION_COOKIE_*` cannot be clobbered by a workflow bug | Bulk `PUT …/env-vars` (replace-all) — would wipe the dashboard-owned names; `render.yaml` `value:` — forbidden (values in git) |
| D-3 | Logic lives in the backend workspace as a pure module + CLI, invoked with `npx --no-install tsx` | Reuses Vitest/coverage/typecheck/lint and the existing `migrate-cli` precedent; an inline YAML script would be untested | Inline shell in the workflow — untestable; a root `scripts/*.mjs` — outside the workspace test/coverage boundary |
| D-4 | The guard hard-fails the job (no skip, no override) | "`CHANGEME` never reaches Render" is the point; a skip path would let a deploy silently succeed with a knowingly unconfigured email path | Skip-sync-with-warning — quieter but misleading; `continue-on-error` — hides failures; a dispatch override — widens the trigger surface |
| D-5 | Two steps: `--check-only` preflight + re-validating sync | The preflight gives a fast, actionable failure (including the unprovisioned production message) before any provider is touched; the sync sits after the migration so ordering holds even if a `PUT` ever triggered a deploy | One step before the hook — production would fail on the DB secret first with no mention of the Render wiring |
| D-6 | A new `RENDER_SERVICE_ID` variable instead of parsing `RENDER_DEPLOY_HOOK_URL` | Explicit, environment-scoped, exists for production before its hook URL does; the hook URL format is an undocumented detail | URL parsing — fragile and unavailable for unprovisioned production |
| D-7 | `SMTP_USER` becomes a GitHub Environment secret | The brief's constraint; uniform handling of the credential pair; GitHub masks the value in logs. The docs are updated because the accepted catalog had it as a variable (supersession recorded) | Keep it a variable — less doc churn, but contradicts the stated constraint |
| D-8 | No retries, no GET-before-PUT diff | A failed deploy is re-run; seven idempotent `PUT`s cost nothing; a diff step would read secret values into the runner for no safety gain. `Retry-After` on 429/503 is not honored; the re-run path is documented | Read-modify-write — more API calls and more secret exposure surface; retry loop — more code for a re-runnable job |
| D-9 | `render.yaml` untouched | It already declares the seven names with `sync: false` and no value; the constraint forbids converting it to values | Adding the wiring names to `render.yaml` — they are pipeline credentials, not service runtime config |
| D-10 | The nine-name validation set is split from the seven-name sync payload | `RENDER_API_KEY` is the highest-privilege new secret; writing it into the service would expose an account-scoped key to a container that never needs it. `RENDER_SERVICE_ID` is public but equally unnecessary as service config. The split is enforced by the `SmtpValues` type and the fake-fetch tests | Validate and sync all nine — simpler, but violates least privilege and contradicts the key-scope risk statement |
| D-11 | T5 proves environment-write permission with validation-failure probes, with an owner-executed fallback | A read-only list cannot prove write; `gh auth status` alone cannot prove fine-grained permissions. GitHub authorizes before body validation, so an empty-body secrets `PUT`/variables `POST` returns 422 (or 400) without creating anything; 403/404 means no write. If the probe fails, the owner runs the same `gh` commands and records names-only listings | Assuming `gh auth status` proves write — false for read-only tokens; a UI-only fallback — cannot satisfy a gh-only verify |
| D-12 | T3/T4 are sequential, with per-file actionlint | Both tasks read workflow files in their verify and both run backend coverage; serial execution removes the false-evidence race. T3 actionlints `deploy.yml`, T4 `ci.yml`, T7 both | `[P]` — the review showed the shared verification resources make the parallel claim false |
| D-13 | T5 preserves the existing `development` values and creates only the missing names (owner decision 2026-11-22) | The owner already holds real `development` values in GitHub; overwriting them with placeholders would destroy working configuration and force a re-entry with no benefit. The four missing names are created with their pinned literals, and `SMTP_USER` moves from variable to secret with its value carried over through stdin (`gh variable get` → `gh secret set`, never printed), so the classification changes without data loss. `production` stays all-placeholder because it has no values yet | Overwrite all nine with placeholders (r1–r3 behavior) — loses the existing values; leave `SMTP_USER` a variable — contradicts Q-5 and the catalog. Accepted residual: a preserved value that is real-but-wrong is not detectable by the guard (it only rejects missing/`CHANGEME`), so Q-2 asks the owner to confirm the preserved values and the deployed proof catches a delivery failure |

## Risks & mitigations

- **The hard guard blocks the first development deploy until the owner supplies `RENDER_API_KEY`.** → Documented as the merge-ordering rule (AC-11(g)); the preserved `development` values are already in place, so Q-1 is the only remaining pre-merge value; the runbook gives copy-paste commands; Render-dashboard rollback remains available for emergencies because it bypasses the workflow.
- **A preserved development value is real but wrong (the guard cannot detect it).** → Q-2 asks the owner to confirm the preserved `SMTP_FROM`/`SMTP_USER`/`SMTP_PASS` are the real Brevo values before merge; if a sync writes a wrong value, the deployed proof (registration delivery) fails and the owner corrects the GitHub value and re-runs. The guard still catches missing/`CHANGEME` values, so a placeholder can never reach Render.
- **The Render API key leaks into the service or a log.** → The key is a pipeline-only input: never in `smtpValues`, never in a body, never in a docs value; the fake-fetch test asserts the seven PUTs contain no wiring name and the guard catches `RENDER_API_KEY=`/`rnd_` shapes. The key is stored only as a GitHub Environment secret.
- **A Render API change or key-scope error breaks deploys.** → The error line names the key and the HTTP status/code; docs point at a scoped key and the dashboard; a failure happens before the hook so the running instance is untouched; the workflow can be re-run.
- **The per-key `PUT` triggers a deploy (unknown).** → The first live run checks the Render deploy list between the sync and the hook; if a deploy starts, the hook queues a second deploy of the same commit, the final health/smoke gate still applies, and the operator records the mitigation (cancel before the hook or let both finish and re-run the post-deploy checks); a follow-up change adds a deploy-in-progress guard.
- **GitHub and the dashboard drift (an operator edits Render directly).** → The next deploy overwrites the seven SMTP names; this is documented as the chosen semantics, and only those seven are ever written, so the other `sync: false` names keep dashboard ownership.
- **Partial sync (some `PUT`s succeed, one fails).** → No deploy occurs (the step fails before the hook); Render applies saved variables only on the next deploy, so the live instance keeps its old environment; the next run re-writes all seven.
- **Secrets in logs.** → Values only in step `env:`; JSON body built in-process; only key names, statuses and Render `code`s printed; no response bodies; transport errors value-redacted; GitHub masking; tests assert absence.
- **Placeholder text mistaken for a credential / tripping the repo credential guard.** → Angle-bracket placeholders and YAML-mapping fixtures; the extended guard patterns do not match `<…>`, `fixture` or `fixture-key`; the self-test proves both directions.
- **T5 cannot write because the token is read-only.** → The validation-failure probes detect it before any mutation; T5 becomes owner-executed and the owner records names-only listings; the builder never fabricates listings.
- **Production accidentally "half provisioned".** → The guard fails on `RENDER_SERVICE_ID`; docs and the runbook state that only placeholders exist and that provisioning is a separate feature.
- **A test-only regression in the backend suite (coverage `all: true`).** → Both new source files carry tests in the same tasks; T1/T2/T3/T4 run the workspace coverage gate sequentially.
- **`npx --no-install tsx` unavailable in a job.** → `npm ci` precedes both steps and the migration step already relies on the same resolution; the T3/T4 verify reproduces the command locally.

## Open questions

Mirrors `spec.md` § Open questions. Planning-blocking items: none. Pre-merge checkpoints: Q-1 (`RENDER_API_KEY`), Q-2 (confirm the preserved `development` values), Q-6 (live-delivery proof owner) and Q-12 (environment write permission). Q-3 (production stays unprovisioned) is the assumed default. Q-4 (strict fail) and Q-5 (`SMTP_USER`/`SMTP_PASS` as secrets) are closed by owner confirmation (2026-11-22); the auto-sync architecture is approved, and T5 preservation is the owner's 2026-11-22 directive.

## Verification plan (task-to-command map)

| Task | Primary proof |
| --- | --- |
| T1 | `npm run lint`, backend `typecheck`/`test`/`coverage` with the exact-object assertions, seven-PUT fake fetch, no-wiring-body assertions and the guard self-test |
| T2 | the same suite plus the shell fixtures: placeholder → non-zero with the AC-4(a) header, complete → zero with the AC-4(b) line, `--dry-run` 9-validated/7-synced summary |
| T3 | `actionlint` over `deploy.yml` only, the install-first step-order/18-binding assertion, the no-`uses:`/permissions/concurrency diff assertion, exact CLI commands, `vercel.json`/`render.yaml` parses, backend coverage regression |
| T4 | `actionlint` over `ci.yml` only, the exact CLI invocation count (2) and expected-string counts (1 each) inside `ci.yml`, local reproduction of both CI fixture steps, backend coverage regression |
| T5 | the two write-permission validation-failure probes (422/400, not 403/404) with the actual status recorded; `gh auth status`; the `.environments[].name` listing and the single-environment fallback; the names-only pre-state capture; conditional creation of only the missing `development` names (`SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `RENDER_SERVICE_ID`, `RENDER_API_KEY`); value-preserving `SMTP_USER` variable→secret migration through stdin (no print/record; placeholder only if absent); all nine `production` placeholders; the final names-only listings for both environments; the `SMTP_USER` variable absence in both; the exact created-name commands plus `NAME: preserved (existing)` entries and the owner-decision/guard/merge-ordering statements in `build-log-T5.md`; names-only evidence only |
| T6 | the complete per-element `grep -q`/`! grep -q` and section-order `node -e` set: 18 runbook commands, four lists, both environment-listing forms, stdin/UI rule, rollback, merge ordering, deployed proof, value-preserving `SMTP_USER` note, preserve note, README `What the pipelines run`/`Deploy flow`, `deployment.md` § Platform split/§ Deploy pipeline/§ Security, `vercel-render-neon.md` deploy order/troubleshooting/operating rules, and every corrected architecture/README sentence |
| T7 | full suite: `npm ci`, lint, typecheck, test, `npm run coverage`, build, actionlint over both workflows, both config parses, the guard fixtures, the guard self-test, the exact AC-1 commands (protected-file diff, `.env*`, hermetic compose config, `down --remove-orphans`, `up -d mailpit`, `npm run smoke`), the extended credential guard, the T6 greps; the deployed proof is recorded as user-owned/pending |
