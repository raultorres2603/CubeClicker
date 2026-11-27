---
feature: brevo-api-email-transport
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 7
---
# Code Review — r1

## Summary

✅ **approved** — All non-owner acceptance criteria (AC-1…AC-12) are met. I independently reproduced the full gate: lint, typecheck, backend/frontend coverage at 97.09/92.24/99.65/97.09 and 97.22/96.8/98.6/97.22, build with the bundle budget, the Mailpit-primed smoke at 29/29, actionlint, Vercel/Render parses, the compose/render/deploy diffs, the deploy CLI process fixtures, the documentation checks and the credential/PII audits. The committed diff is tightly scoped: no frontend, `auth-service.ts`, `email-template.ts`, migration/schema or Dockerfile change.

**T8/AC-13 is the sole owner-pending gate.** No build log or doc claims the live delivery proof has happened; T7 records T8 as pending and the status keeps T8 unchecked. The owner steps are listed below.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `src/backend/src/auth/config.ts:31-38,241-341,397-417` parses `EMAIL_TRANSPORT`/`BREVO_API_KEY`, defaults to `smtp` for every `NODE_ENV`, honors explicit `smtp` in production, rejects unknown values/missing keys with the exact messages, and applies the three sender forms + local-default rejection. `config.test.ts:118-283` covers the default matrix, explicit `smtp`, unknown value, absent/empty key, bare/angle-only/display-name senders, unchanged stored value, unset/empty vs whitespace precedence and all local-default forms. |
| AC-2 | ✅ | `parseEmailSender` (`config.ts:261-282`) trims, parses display-name/angle-only/bare forms, and returns `null` for the AC-2(d) forms; `config.test.ts:286-335` asserts exact `toStrictEqual` objects and null cases (no `name: undefined`). |
| AC-3 | ✅ | `BrevoApiEmailService.sendVerification` (`email.ts:439-467`) sends exactly `POST https://api.brevo.com/v3/smtp/email` with the three headers, the five-key body, parsed sender, single recipient and `AbortSignal.timeout`. `email.test.ts` pins the exact URL/method/headers/body, 201/202 success, no body read, template reuse, `BREVO_API_TIMEOUT_MS === 10000`, and SMTP plain-text parity. |
| AC-4 | ✅ | `email.ts:340-397,469-497` maps non-2xx to `BrevoApiError`/`HTTP_<status>`, timeout to `TimeoutError`, other rejections to the source name/`unknown`, with fixed messages and no body parsing. `email.test.ts` covers 400/401/403/429/500, timeout, network/non-Error rejection, provider-body/key non-leakage and `GET /v3/account` verify. |
| AC-5 | ✅ | `app.ts:253-291` selects the service through `createEmailService`, uses the injected `brevoRequest` on the API path, leaves the SMTP factory path untouched, and starts the `onReady` probe without awaiting it. `app.test.ts:621-860` proves API selection, SMTP factory isolation, never-settling `/healthz`, exact `brevo_api_transport_verify_ok`/`failed`/`skipped` fields/levels, no leaked key/address/message, and the unsupported-service case. |
| AC-6 | ✅ | `auth-routes.ts:145-180` logs `transport` and keeps the exact 502 body. `auth-routes.test.ts` (API context) proves register/resend exact 502, no cookie/session, exactly one transport-tagged warn with `BrevoApiError`/`HTTP_401`/`api.brevo.com:443`, no PII, token invalidation via `consume`, and a later 202 resend that sends exactly once. Frontend source is unchanged (diff + existing suites). |
| AC-7 | ✅ | `render-env.ts:22-53,98-257` pins `SMTP_CATALOG` (7), `EMAIL_CATALOG` (2), `SYNC_CATALOG` (9), `RENDER_WIRING` (2) and `CATALOG` (11); `validateEmailTransport` covers development/production valid, smtp, unknown, SMTP-key reuse, local/invalid sender and non-deployed targets. `render-env.test.ts` asserts the exact arrays, six-placeholder production set, truth table and five exact blocks. `render.yaml` has both new names `sync:false` with no value; the filtered base comparison proves all other entries unchanged. |
| AC-8 | ✅ | `render-env-cli.ts:89-178` validates 11, runs the email guard before the port guard, and syncs 9. `render-env-cli.test.ts` plus the six real-process fixtures prove the 11-value line, 6-placeholder production block with no port/transport block, nine dry-run lines, nine `SYNCED` lines and the exact precedence cases. `deploy.yml` binds both names in both CLI steps; actionlint and the parsed comparison pass. `ci.yml` has exactly two `EMAIL_TRANSPORT: brevo-api` fixtures, one `fixture-key` and one `<CHANGEME-brevo-api-key>`, and the exact 11/6 assertions. |
| AC-9 | ✅ | `email-cli.ts:96-188` selects the transport through `createEmailService`, prints the exact API success/failure/config lines, redacts the API key plus both key shapes, and leaves the SMTP lines untouched. `email-cli.test.ts` covers API success/failure/missing key, real-factory request, injected-failure redaction and the unchanged SMTP paths. |
| AC-10 | ✅ | `compose.yaml` has `EMAIL_TRANSPORT`/`BREVO_API_KEY` pass-throughs and `compose.smoke.yaml` pins `smtp` + empty key. The compose top-level comparison reports only environment values changed; no service/image/port/volume/healthcheck. I reproduced `up -d mailpit` + `npm run smoke` at 29/29 using the documented environment-level `PODMAN_COMPOSE_PROVIDER` fallback; the smoke never contacts Brevo. |
| AC-11 | ✅ | `docs/architecture/email.md` exists and carries the full transport contract; `README.md`, `deployment.md`, `vercel-render-neon.md`, `observability.md` and `containerization.md` contain the required positive sentence/strings and none of the stale “deployed uses SMTP”/old seven-name strings. The 22-command runbook, API CLI line, rotation strings, recovery step, catalog rows, production code-catalog statement, supersession and AC-11(a) deviation are present. `docs/features/README.md` has no committed change; the T6 log carries the index-row proposal. |
| AC-12 | ✅ | Reproduced: lint/typecheck 0; coverage backend 52 files/2093 tests and 97.09/92.24/99.65/97.09, frontend 83 files/2867 tests and 97.22/96.8/98.6/97.22; build 0 with bundle budget; smoke 29/29; actionlint 0; `vercel.json`/`render.yaml` parses; compose/render/deploy diffs; deploy CLI fixtures; shared build-log guard clean; real-key and `.env*` audits no matches. The coverage configs are unchanged and both keep the four 80 thresholds. The committed diff has no forbidden source/frontend/Dockerfile/migration path, no `docs/features/README.md` and no other feature directory. |
| AC-13 | ⏳ owner-pending | T8 is unchecked and no T8 build log exists. This is the only open gate; the exact owner steps are below. The build logs/docs describe the target contract and do not claim the live proof. |

## Findings

No BLOCKER or MAJOR findings. The following are non-blocking backlog items.

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `tasks.md:246` (T6 verify), `docs/features/brevo-api-email-transport/build-log-T6.md:33`; compare `tasks.md:363` (T7) | T6's own verify still uses the working-tree `git diff --name-only` index check, and its log records temporarily stashing the orchestrator-owned README edit to pass that check. T7 correctly reads the committed `origin/main...HEAD` diff, so the T7 amendment is implemented, but a future T6 re-run would hit the same working-tree issue and could encourage another stash. | Change T6's index assertion to the committed `origin/main...HEAD` form used by T7 (or remove the duplicate); do not stash orchestrator-owned files. No content change to the README is needed. | backlog |
| F2 | MINOR | `README.md:190-193` (secret-hygiene guard commands); `tasks.md:346` / `build-log-T7.md:261` | The user-facing README guard commands match `BREVO_API_KEY=`/`SMTP_(USER|PASS)=` with `=` only, while the actual T7 audit uses `[:=]` and the documented test-fixture pathspec exception. A YAML-style `BREVO_API_KEY:` assignment in a non-test file would be caught by the T7 gate but not by the documented command. | Align the README guard with the actual `[:=]` pattern and note the test-fixture pathspec exception; the real key-shape patterns must stay strict. | backlog |
| F3 | MINOR | `README.md:299` (asset checklist) | The checklist says the `development` environment “is provisioned with the exact secrets/variables catalogued”, including the two new names, while T8 Phase A is still owner-pending; the runbook table correctly says “set before merge”. | Make the two new names explicitly owner-set-before-merge/conditional in the checklist, or state that the environment is provisioned only after Phase A. | backlog |
| F4 | MINOR | `tasks.md:3` vs `status.md:39` | The status/brief call the merged T4/T5 task list revision r4, but the tasks header still says “Revision r3 (2026-11-26)” while containing the amendment. | Bump the tasks header to r4 (or align the status wording) for traceability; content and ownership are correct. | backlog |
| F5 | INFO | `spec.md:206` (AC-12(e)); `tasks.md:344-355` / `build-log-T7.md:261` | The T7 preflight amendment excludes synthetic `*.test.ts`/`*.spec.ts` assignment fixtures by pathspec, but the approved AC-12(e) wording still describes the repository audit without that exception. The real Brevo/Render key-shape patterns are strict on every path, so this is a documentation/spec-traceability gap, not a detection gap. | Record the test-fixture pathspec exception in AC-12(e) (or the next spec revision) and keep the real-key shapes strict everywhere. | backlog |
| F6 | INFO | Working tree `docs/features/README.md`, `docs/features/registration-account-exists/status.md`; `git status` | These edits are orchestrator-owned and uncommitted; the committed feature diff is clean. The feature index row still says `planning` while the status is `code_review`. | Orchestrator updates the index row and commits/keeps the registration status edit at acceptance; builder need not touch either. | backlog |
| F7 | INFO | `status.md:46` (Q-1) | The status still lists “dedicated or existing MCP key” although the loop log records that the owner chose a dedicated key. | Refresh Q-1 when T8 runs (dedicated key; any fallback decision recorded then). | backlog |

## Verification performed

- `npm run lint` → exit 0, no findings.
- `npm run typecheck` → exit 0, both workspaces.
- `npm run coverage` → exit 0; backend 52 files/2093 tests, 97.09/92.24/99.65/97.09; frontend 83 files/2867 tests, 97.22/96.8/98.6/97.22. Both workspaces exceed the four 80 thresholds.
- `npm run build` → exit 0; Vite bundle budget OK.
- `PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit && PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose npm run smoke` → exit 0, `SMOKE PASS (29/29 checks)`, including register → Mailpit → verify → login.
- `podman run … rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml` → exit 0; `vercel.json` JSON parse and `render.yaml` YAML parse → exit 0.
- Parsed compose top-level comparison (both files) → only `environment` values differ; parsed `render.yaml` comparison → every other service field/envVar unchanged; parsed `deploy.yml` comparison → triggers/concurrency/permissions/job fields/step order/`uses`/`run`/`with` unchanged and only the two CLI steps gained the two names.
- Deploy CLI real-process fixtures are covered by `render-env-cli.test.ts` and the T4/T7 logs: 11-value success, 6-placeholder production rejection with no port/transport block, `EMAIL_TRANSPORT=smtp` rejection, SMTP port rejection, SMTP-key reuse, local sender and invalid sender.
- Documentation check: the required positive sentence is present in `email.md`, `README.md`, `deployment.md` and `vercel-render-neon.md`; the stale deployed-SMTP/old-count strings are absent; the README runbook has 22 commands and the required catalog/recovery/rotation/supersession/AC-11(a) strings.
- Credential/PII audit: real key-shape patterns (`xkeysib`/`xsmtpsib`/`rnd_`) have no match on tracked, untracked, branch-diff or history surfaces; the assignment guard has no match on non-test surfaces; no `.env*` is in branch history; every `build-log-*.md` passes the shared guard.
- Scope: committed `origin/main...HEAD` has 31 files, no `src/frontend/**`, `auth-service.ts`, `email-template.ts`, `db/migrations`, Dockerfile, `docs/features/README.md`, or other feature directory.
- The T7 log's recorded raw evidence is internally consistent with this run (same test counts, coverage, build assets, smoke result and deploy comparisons). The only environment-level deviation is the documented compose-provider fallback, which changes no repository file.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Acceptance AC-1…AC-13 | ✅ | AC-1…AC-12 independently met; AC-13 is owner-pending T8 and is the sole open gate. |
| Tests and coverage | ✅ | Unit, integration, process-boundary and containerized smoke evidence; 2093/2867 tests; all four coverage metrics ≥80% per workspace; coverage configs unchanged; no snapshot-only/wildcard/assertion-free tests observed. |
| Security | ✅ | API key read only from env, sent only in the `api-key` header, never a body/URL/log/image; Brevo response bodies never read; fixed-message errors and `HTTP_<status>` whitelist; 502/token invalidation unchanged; deploy guard precedence/fail-closed; real key-shape audits strict. The test-fixture assignment pathspec exception is documented in the backlog (F5). |
| Documentation | ✅ | `email.md` plus README/architecture updates are accurate, per-file checked; the production catalog is code-only; the feature index is orchestrator-owned and unchanged in the committed diff. |
| Evidence reproducibility | ✅ | Reproduced the essential gate independently; the T7 log matches. The provider fallback is environment-level and documented; no secret/PII printed. |
| Containerization | ✅ | No new service/image/port/volume/healthcheck/WebSocket endpoint; compose pass-throughs only; smoke 29/29; images remain provider-neutral. |
| Real-time | ✅ | Out of scope and stated: no WebSocket/room/presence/reconnect/server-authority change; session-cookie upgrade and `join { mode: 'account' }` semantics unchanged. |

## T8 owner steps remaining (AC-13)

1. **Phase A (before merge):** With the dedicated Brevo API key chosen, set the GitHub `development` variable `EMAIL_TRANSPORT=brevo-api` and the `BREVO_API_KEY` secret (UI or stdin, never as a command argument); confirm `SMTP_FROM` is the Brevo-verified sender; record `SMTP_FROM confirmed` and the names-only evidence in `build-log-T8.md` under `Phase A`. If the existing MCP key is used instead, record `owner risk accepted`, the coupled blast radius, `rotation plan` and `least privilege`.
2. **Phase B (post-merge, owner-attested):** Run **Deploy**; record `Deploy configuration OK: 11 value(s) present for the 'development' environment.`, `SYNCED EMAIL_TRANSPORT (value verified, not shown)`, `SYNCED BREVO_API_KEY (value verified, not shown)`, `/healthz` exactly `{"status":"ok"}`, and the new Render instance's `brevo_api_transport_verify_ok` with `host=api.brevo.com`/`port=443` (or the documented info-filtered fallback).
3. **Live delivery:** Resend to the stale unverified account; record the `202`, the Brevo transactional record (message id redacted), actual delivery, opening the link, `verified = true`, then login and `join { mode: 'account' }` on the deployed frontend.
4. **Redacted evidence:** Keep `Phase A`/`Phase B` markers and `<owner-address>`, `<frontend-origin>`, `<verification-link>` and `<commit>` placeholders; include `Render excerpt`, `Brevo excerpt` and `resend response`; record `AC-11(a) deviation` (not met on ordering), `AC-11(b)` retained, `AC-11(c)/(d)` replaced by AC-13(c)/(d), and `no live production write`. Run the shared log guard and the username/`GH_REPO` checks; never record `GH_REPO`, the username pattern, an address, username, token/link, key or bare 32+ hex commit id.
5. T8 is owner-attested and not CI-reproducible; no agent creates/reads/rotates the key, writes GitHub/Render state or sends email.
