---
feature: deploy-brevo-env-placeholders
phase: code
verdict: approved
blocking: 0
iteration: 1
---
# Code Review — r1

## Summary

✅ **approved** — AC-1…AC-12 are functionally met at `HEAD 434308b` (AC-8 with the literal fixture-size caveat F3); a completed review session reproduced the full gate, and this session independently re-verified the backend coverage, the 53 deploy-module tests, the guard fixtures, the documentation gate, the credential guards and the AC-1 protected-file diff, plus live names-only GitHub and deploy/CI evidence. The former pre-merge operational risk is resolved: the `development` `RENDER_API_KEY` was filled at 19:07Z and the deploy for `5469a7c` succeeded with nine validated values, seven `SYNCED` lines, `/healthz` OK and an 8/8 deployed smoke. Three MINOR findings (stale post-deploy operator wording, a runbook re-run hazard, and the literal AC-8 fixture-size clause), one MINOR process note and two INFO notes remain; there is no open BLOCKER or MAJOR.

## Acceptance verification

| AC | Met? | Evidence | Reviewer spot-check |
| --- | --- | --- | --- |
| AC-1 | ✅ | (a) `git diff --exit-code origin/main...HEAD -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/backend/src/app.ts render.yaml src/backend/src/auth` → exit 0; same command over `a4a3b6c..HEAD` → exit 0; `git diff --name-only … -- '.env*'` → empty (T7 §7). (b) `podman compose --env-file /dev/null -f compose.yaml config` (all seven `SMTP_*` unset) → backend `SMTP_HOST=mailpit`, `SMTP_PORT=1025` (T7 §8). (c) `down --remove-orphans` → `up -d mailpit` → `npm run smoke` → `SMOKE PASS (29/29 checks)`, including the Mailpit registration/verification with the new deploy module in the image (T7 §9). | ✅ protected-file diff and `.env*` check rerun in this session (both ranges); compose assertion and 29/29 smoke are recorded T7 evidence, **not rerun** in this session (reused as recorded). |
| AC-2 | ✅ | `src/backend/src/deploy/render-env.ts:19-36` pins `SMTP_CATALOG` (7: five variables then `SMTP_USER`/`SMTP_PASS` secrets), `RENDER_WIRING` (2: `RENDER_SERVICE_ID` variable, `RENDER_API_KEY` secret) and `CATALOG` (9); `render-env.test.ts:151-191` asserts the exact arrays and lengths and the seven sync keys. T5 records the created-name `--body` commands and the five `preserved (existing)` entries (build-log-T5.md:55-90); live names-only listings confirm the classification (below). | ✅ code read + focused 53 tests + live names-only listing. |
| AC-3 | ✅ | `render-env.ts:49-95`: `isPlaceholder` is `value.includes('CHANGEME')` (case-sensitive, false for empty), `validateDeployEnv` classifies all nine in catalog order (`undefined`/whitespace = missing, `CHANGEME` = placeholder) and returns `ok: true` only when all nine are `ok`; `render-env.test.ts:193-267` pins the development set `['SMTP_FROM','SMTP_USER','SMTP_PASS','RENDER_API_KEY']`, the production set, all-missing, whitespace and all-real. | ✅ code read + focused 53 tests. |
| AC-4 | ✅ | `render-env-cli.ts:82-133`; the production placeholder fixture prints exactly the AC-4(a) block and exits 1; the complete development fixture prints exactly `Deploy configuration OK: 9 value(s) present for the 'development' environment.` and exits 0; `--help`/unknown-option behavior at `render-env-cli.ts:87-106`, tested at `render-env-cli.test.ts:206-246`. | ✅ fixtures rerun in this session: reject exit 1 with the exact block, accept exit 0 with the exact line. |
| AC-5 | ✅ | `render-env.ts:259-313` iterates `SMTP_CATALOG` only; per-key `PUT` with `authorization: Bearer …`, `content-type: application/json`, body `{"value":"…"}`, echo check on `key`/`value`, `SYNCED` ×7 + `Synced 7 …`; failure lines (non-2xx with Render `code` only, timeout `… timed out after 10000ms`, redacted generic rejection, value/key mismatch abort, stop-on-first-failure) are pinned in `render-env.test.ts:393-719`; no wiring name in any body, service ID only in the URL, API key only in the header, stray `RENDER_API_KEY` property ignored. | ✅ code read + focused 53 tests. |
| AC-6 | ✅ | `render-env-cli.ts:124-133`: `--dry-run` prints seven `DRY RUN: would set <KEY> (PUT …)` lines in catalog order and the `DRY RUN complete: 9 value(s) validated … 7 would be synced; no network calls made.` summary; `render-env-cli.test.ts:307-328` injects a throwing fetch and asserts it is never called. | ✅ dry-run fixture rerun in this session: 7 lines + exact summary, exit 0. |
| AC-7 | ✅ | `.github/workflows/deploy.yml:76-108`: `Check deployment Brevo configuration` runs after `Install dependencies` and before `Migrate Neon database`; `Sync Brevo SMTP settings to Render` runs after the migration and before `Deploy Render backend`; each step binds six `vars.*` and three `secrets.*` (18 bindings); the diff adds no `uses:`/`permissions:`/`concurrency:` line (workflow diff read). `actionlint` over both workflows exit 0 (reproduced review + CI run); `vercel.json` JSON and `render.yaml` YAML parses pass (T7 §11). | ✅ workflow diff and step order read; 18 bindings counted from the file; no `continue-on-error`. |
| AC-8 | ✅ (caveat F3) | `.github/workflows/ci.yml:91-129`: `Guard rejects placeholder values` and `Guard accepts a complete value set` run the exact `npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only` invocation (exactly twice) and assert the exact AC-4(a)/AC-4(b) strings inside their own `run` blocks; fixtures are YAML mappings, not `NAME=` strings; the extended credential guard is clean. Live CI run 45059592147 shows both steps success. **Literal deviation:** `ci.yml:96`/`:122` use `smtp-relay.brevo.com` and `CubeClicker <no-reply@example.com>`, which are neither shorter than 12 characters nor angle-bracket placeholders (F3). | ✅ CI step conclusions read live; `ci.yml` content read; guard clean. |
| AC-9 | ✅ | (a) Extended guard clean over the tracked tree, untracked files, feature diff and feature history (this session, §Verification); guard self-test matches synthetic `RENDER_API_KEY=`/16-char, `rnd_`/24-char, `SMTP_PASS=`/15-char and both Brevo shapes while allowing the documented placeholders (this session). (b) Every CLI test asserts no value/API-key leak (`expectNoFixtureSecrets` at `render-env-cli.test.ts:193-204`, error/redaction tests at `render-env.test.ts:490-719`). (c) Live names-only listings: `SMTP_USER`, `SMTP_PASS`, `RENDER_API_KEY` are secrets and the other six are variables in both environments; no `SMTP_USER` variable remains. (d) `RENDER_API_KEY` is never a service variable or body (tests); `render.yaml` stays value-free. | ✅ guard tree/untracked/diff/history rerun clean; live names-only listing; no value read. |
| AC-10 | ✅ | (a) T5 records the nine production `--body` placeholder command lines and the final listing (six variables, three secrets); live production listing matches (below). (b) The workflow offers only the `production` choice, keeps the CI-SHA preflight, and runs the guard before the migration and before any Render/Vercel step (step order read); the production fixture fails at the guard with the AC-4(a) block naming `RENDER_SERVICE_ID` and the other placeholders before any network call. | ✅ live names-only state + fixture rerun + workflow order. |
| AC-11 | ✅ | `README.md:285-…` `### Deployment Brevo runbook`: 18 exact `gh` commands for both environments, UI path (`Settings → Environments`, `Environment variables`/`Environment secrets`, `never as verification evidence`), four names-only list commands + `.environments[].name` + both single-environment fallbacks, stdin/never-argv rule, user-owned deployed proof (`SYNCED <KEY>`, Render deploy list, `Render dashboard lists the seven keys`, `curl -fsS "$VITE_API_URL/healthz"`, deployed-frontend registration, local `npm run email:test`), rollback/`Deploys → Rollback`/`rotate it in Render`, merge ordering, `SMTP_USER` migration, preserve note and source-of-truth note. The extracted T6 verify block exits 0. | ✅ T6 extraction rerun in this session (8 order assertions + all greps); README runbook read. |
| AC-12 | ✅ | `docs/architecture/deployment.md:45-53,109` and `docs/architecture/vercel-render-neon.md:46,55,57,72,80,167,182` carry the nine-name catalog/classification, `nine validated, seven synced`, the check → migration → sync → hook order, `never written to the Render service`, `placeholder-only` and `no Render service, Vercel project or Neon branch is provisioned`; README § Email/§ Secret hygiene/§ User-side asset checklist/§ What the pipelines run/§ Deploy flow are corrected. The extracted T6 block (all positive/negative greps and section-order assertions) exits 0. | ✅ T6 extraction rerun in this session, exit 0; production statement present in all three docs. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `README.md:301`, `README.md:360`; `docs/architecture/vercel-render-neon.md:182`; `status.md:41-42` | Operator text still describes the `development` `RENDER_API_KEY` as an unfilled placeholder and the first development deploy as blocked ("placeholder created by T5"; "the first development deploy after merge is blocked by design until the placeholder is filled"; "must be filled before the first development deploy"; Q-1/Q-2 "before merging to `main`"). Live state disproves it: the secret was updated 2026-11-22T19:07:05Z and deploy run 45059930353 (19:17Z) passed the guard and synced all seven names. The shipped behavior is documented correctly; only the post-deploy operator state is stale. | After owner confirmation, update the README table/merge-ordering paragraph, the `vercel-render-neon.md` guard bullet and the status Q-1/Q-2/blockers to the post-fill state; keep production `placeholder-only`. | open (non-blocking) |
| F2 | MINOR | `README.md:305-317` | The `development` nine-command block is directly runnable and would reseed `RENDER_API_KEY` with `<CHANGEME-render-api-key>` and overwrite the preserved `SMTP_USER`/`SMTP_PASS` with placeholders. The preceding paragraph warns against overwriting, but the block is still the first copy-pasteable recipe. | Label the `development` block "fresh-environment reference only — do not run against the provisioned `development` Environment" (or separate it into a non-executable reference table). | open (non-blocking) |
| F3 | MINOR | `.github/workflows/ci.yml:96,122`; `spec.md:93` (AC-8) | AC-8 requires every fixture value to be shorter than 12 characters or an angle-bracket placeholder, but the reject/accept fixtures use `smtp-relay.brevo.com` (20 characters) and `CubeClicker <no-reply@example.com>` (34 characters). Both are public non-secret constants, the extended credential guard is clean, and the clause's intent (no secret-shaped fixture) holds. | Amend AC-8's literal to admit public non-secret constants, or shorten the two fixture values (the CLI never echoes values, so the exact expected lines are unaffected). | open (non-blocking) |
| F4 | MINOR | `git log`/branch; `build-log-T7.md:605-609` | Process: the feature was built and committed on `main` (branch `main`, two commits ahead of `origin/main`) instead of `feat/<slug>`; `origin/main` already contains T1–T5 plus the non-conventional mega-commit `5469a7c` (`specs`); T7's log says the integration commit stages `spec.md`, `plan.md`, `reviews/spec-r{1,2}.md`, but `434308b` stages only `build-log-T7.md`, `status.md` and `tasks.md` (the rest were already committed). No code or history defect; the successful live deploy is from the already-pushed `5469a7c`. | Correct the T7 integration-commit wording; use a feature branch for the next feature. No code change. | open (process, non-blocking) |
| F5 | INFO | `src/backend/src/deploy/render-env.ts:126-128` | `renderEnvVarUrl` interpolates the fixed SMTP key and the environment-supplied service ID without URL-encoding. Both are constrained (the seven catalog keys; a Render `srv-…` coordinate), so there is no exploitable path; a malformed service ID only produces a wrong URL/API error. | Optional: `encodeURIComponent` both path segments for defense-in-depth. | accepted |
| F6 | INFO | Deploy run 45059930353 (GitHub log) | GitHub masks the environment name in the log (`'***elopment'`), so the success line reads oddly. It is standard secret masking and leaks nothing. | None. | accepted |

## Verification performed

### Reproduced by the completed review (attributed — not re-run in full in this session)

- `npm run lint` → exit 0; `npm run typecheck` → exit 0 in both workspaces.
- `npm test` → backend 42 files / 1,826 tests; frontend 83 files / 2,844 tests; all passing.
- `npm run coverage` → backend `96.64 / 90.81 / 99.61 / 96.64`, frontend `97.15 / 96.75 / 98.36 / 97.15` (statements/branches/functions/lines), all ≥ 80; `src/deploy` `98.09 / 98.75 / 100 / 98.09`; `render-env.ts` 100 on every metric.
- `npm run build` → exit 0; `Bundle budget OK` (initial gzip 101,990 / 150,000; three chunk 154,647 / 165,000).
- `podman run … actionlint:1.7.12 .github/workflows/*.yml` → exit 0 over both workflows.
- Guard fixtures → reject exit 1 with the exact AC-4(a) block; accept exit 0 with the exact AC-4(b) line; dry-run 7 lines + exact summary, exit 0.
- Hermetic compose config → `mailpit:1025` with all `SMTP_*` unset; clean-stack Mailpit smoke → `SMOKE PASS (29/29)` (T7 §8–§9).
- `vercel.json` JSON parse and `render.yaml` YAML parse → pass (T7 §11).
- T6 documentation gate extraction (`bash -c "$(sed -n '/^## T6 /,/^## T7 /p' tasks.md …)"`) → exit 0 (all greps + 8 section-order assertions).
- Extended credential guard over the tracked tree, untracked files, feature diff and feature history → clean; guard self-test → pass; no `.env*` file.
- AC-1 protected-file diff → exit 0; `.env*` diff → empty; timeout probe (`TimeoutError` classification) → correct (T7 §16/T1).
- `npm run smoke` → recorded 29/29; **not rerun** in this session (reused as recorded).

### Independently reproduced in this session

- `npm run coverage --workspace @cubeclicker/backend` → 42 files / 1,826 tests, `All files 96.64 / 90.81 / 99.61 / 96.64`, exit 0; `src/deploy 98.09 / 98.75 / 100 / 98.09`; `render-env.ts` 100 on every metric.
- `npx vitest run src/backend/src/deploy/render-env.test.ts src/backend/src/deploy/render-env-cli.test.ts --root src/backend` → 2 files / 53 tests passing (32 + 21).
- Guard fixtures: production `--check-only` → exit 1 with the exact AC-4(a) block; complete `--check-only` → exit 0 with the exact success line; `--dry-run` → seven `DRY RUN` lines + exact summary, exit 0.
- T6 documentation gate extraction → all eight order assertions pass, exit 0.
- Credential guard self-test → pass; tracked, untracked, `a4a3b6c..HEAD` diff and history guards → no match (grep exit 1 on all four).
- AC-1 protected-file diff (`origin/main...HEAD` and `a4a3b6c..HEAD`) → exit 0; `.env*` diff → empty.
- Source/workflow read: the exact 7/2/9 catalog, the sync loop over `SMTP_CATALOG` only, the CLI's `AbortSignal.timeout(10000)` per request, the 18 `vars.*`/`secrets.*` bindings, the check → migration → sync → hook order, no `uses:`/`permissions:`/`concurrency:` change, no `continue-on-error`.
- No banned matchers (`toMatchSnapshot`, `toMatchInlineSnapshot`, `expect.anything/any/objectContaining/arrayContaining/stringContaining/stringMatching`, assertion-free tests) in the changed test files; all assertions pin concrete values.

### Not re-run in this session

- Full `npm run lint`, `npm run typecheck`, `npm test`, frontend `npm run coverage`, `npm run build`, the containerized `actionlint` run and `podman compose … up -d mailpit` + `npm run smoke` were not repeated here; they are attributed to the completed review and corroborated by live CI run 45059592147 (`Lint`, `Typecheck`, `Test`, `Coverage`, `Build`, `Lint GitHub Actions workflows`, `smoke-e2e` all success) and T7's recorded raw output. `npm run smoke` is explicitly **not rerun**; T7's 29/29 is reused.

## Live GitHub names-only evidence (2026-11-23)

Read-only `gh variable list` / `gh secret list` / `gh api …/environments` calls; names only, no value read or printed.

| Scope | Names observed | Notes |
| --- | --- | --- |
| `development` variables | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `RENDER_SERVICE_ID`; plus `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `MAX_USERS_PER_SERVER`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE` | Six expected deployment variables; **no `SMTP_USER` variable**; `SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS`/`RENDER_SERVICE_ID` created 2026-11-22T18:48Z. |
| `development` secrets | `SMTP_USER`, `SMTP_PASS`, `RENDER_API_KEY`; plus `DATABASE_URL`, `DIRECT_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`, `VERCEL_TOKEN` | `SMTP_USER` migrated at 18:48:48Z; `RENDER_API_KEY` updated 19:07:05Z (after T5), resolving the former pre-merge risk. |
| `production` variables | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `RENDER_SERVICE_ID` | Exactly the six pinned variables. |
| `production` secrets | `SMTP_USER`, `SMTP_PASS`, `RENDER_API_KEY` | Exactly the three pinned secrets. |
| Probe leftovers | none | `__write_permission_probe` is absent from both variable and secret lists. |

## Deploy / CI evidence for `5469a7c`

- **Deploy run 45059930353** (5469a7c, success): every step success; log lines `Deploy configuration OK: 9 value(s) present for the '***elopment' environment.` (19:18:49Z), seven `SYNCED SMTP_* (value verified, not shown)` lines (19:18:52–53Z), `Synced 7 value(s) to Render service srv-dbtcvv9srm7s73au5bag for the '***elopment' environment.`, `healthz OK after 12s: {"status":"ok"}`, and `DEPLOYED SMOKE PASS (8/8 checks)`.
- **CI run 45059592147** (5469a7c, success): `verify-app`, `smoke-e2e` and `verify-workflows` all success, including `Guard rejects placeholder values` and `Guard accepts a complete value set`.
- The `***elopment` masking is harmless (F6). The inspected lines carry key names and status text only; the CLI never prints a value and GitHub masks registered secrets.

## `5469a7c` audit

`git show --name-status 5469a7c` → 2,121 added / 6 modified / **0 deleted**. Non-`.agents` files are `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/features/README.md`, the previous feature's review/status/tasks, this feature's `spec.md`/`plan.md`/`reviews/spec-r{1,2}.md`/`status.md`/`tasks.md`, and `skills-lock.json`. Guard over the commit diff → 0 matches; `.env*` paths → 0; `src/`, `.github/`, `compose*`, `Dockerfile`, `render.yaml`, `package*.json` paths → 0. The `docs/features/README.md` edit is the previous feature's accepted row; this feature's row is only proposed in `build-log-T7.md` (builder did not rewrite the orchestrator index). No secret, code, workflow, container or deletion regression.

## Operational risk (post-build)

- **Development: resolved.** The `development` `RENDER_API_KEY` was filled (19:07:05Z) and deploy run 45059930353 passed the guard with nine values and synced all seven SMTP names; `/healthz` and the deployed smoke passed. The former merge-ordering risk (Q-1) no longer blocks a development deploy.
- **Production: placeholder-only.** The three secrets and six variables exist with pinned placeholders; no Render service, Vercel project, Neon production branch, protection rule or production deploy exists. A production dispatch fails at `Check deployment Brevo configuration` by design.
- **Residual user-owned checks.** The full deployed-email proof (registration from the deployed frontend to an owner-controlled mailbox) and the Render deploy-list "no deploy between sync and hook" probe are not evidenced in the artifacts; the live run proves the sync → hook → health → deployed-smoke path. Both are user-owned by spec and do not gate this review.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | The three secrets travel only as step `env:` values; the CLI reads them from `process.env`; bodies are built in-process; `RENDER_API_KEY` is never a Render service variable or request body and `RENDER_SERVICE_ID` is only the URL path; non-2xx output prints only the Render `code`; transport errors are value-redacted (tested with a `rnd_` shape and every configured value); no `continue-on-error`; no trigger/permission change; no secret in the tracked tree, untracked files, diff or history; no `.env*`; `render.yaml` value-free with `sync: false`. F5 is defense-in-depth only. |
| Quality | ✅ | Pure catalog/guard/sync logic with injected fetch and logger; one catalog definition drives validation and sync; exact pinned output lines; no dead code or debug leftovers; the diff is traceable to T1–T7 (no drive-by refactor); docs updated for the shipped behavior. F1/F2 are operator-wording/runbook hazards, not behavior defects. |
| Testing | ✅ | Coverage ≥ 80 on all four metrics in both workspaces (backend independently reproduced at 96.64/90.81/99.61/96.64; frontend attributed + CI `Coverage` success); the new `src/deploy` area is fully counted (`all: true`, no new exclusion; the only exclusions remain the pre-existing composition-root entrypoints and test files); 53 focused tests pass with exact-value assertions; the process-boundary integration tier exercises the real CLI; no banned matchers, snapshot-only, assertion-free or tautological tests; failures are deterministic (fake fetch, injected rejection; no real sleeps or network). The containerized smoke is recorded 29/29 and not rerun (F3-caveat is a spec-literal issue, not a test-quality issue). |

## Notes / backlog (non-blocking)

- Schedule F1–F4 for the next docs/process touch; none blocks acceptance. F1 should be applied only after owner confirmation that the live deploy is the intended steady state.
- The `docs/features/README.md` row for this feature remains a proposal in `build-log-T7.md`; the orchestrator applies it on acceptance. The index change in `5469a7c` is the previous feature's row, not a rewrite.
- This review performed no GitHub mutation; all `gh` calls were read-only names-only listings. No secret value was read or printed.
- The working tree contains only the orchestrator's `status.md`/`tasks.md` bookkeeping (state `code_review`, T7 `[x]`); those are not part of the feature diff and were not edited by this review.
- Process note (F4): the feature is on `main` rather than `feat/<slug>`, and `origin/main` already contains T1–T5; the next feature should use a feature branch and a conventional integration-commit message.
