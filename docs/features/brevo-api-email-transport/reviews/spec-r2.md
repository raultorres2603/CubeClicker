---
feature: brevo-api-email-transport
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 6
---
# Spec Review — r2

## Summary

❌ **changes requested** — r2 substantially improves the specification: F3 is corrected in `spec.md`/`plan.md`/`tasks.md`; F4–F18 are implemented as described; the 11/9/6 catalog counts, guard precedence, `smtp` default, explicit-value handling, AC-1(g)/AC-2(b) angle-only form, empty/whitespace precedence, coverage-config diff, parsed `deploy.yml` comparison, production API-valid guard case, Q-1 key posture, production code-catalog qualification and owner-attested T8 are all concrete and implementable.

Two r1 documentation findings and the r1 AC-11(a) propagation are still open: AC-11's negative list catches the r1-named stale strings but leaves 16+ other current “deployed uses SMTP”/old-count statements uncaptured, and the README deployment runbook/asset checklist/recovery still contains nine-name, seven-sync and SMTP-key instructions that T6 can leave in place. A separate task-graph gap remains: AC-10(c) (no new compose service/image/port/volume/healthcheck) has no task acceptance owner and no verification.

> **r3 targeted re-check: approved (blocking 0).** The r2 summary, findings and checklist below are the historical r2 state. See § Targeted re-check (r3) for the current verdict, the resolution evidence for F1/F2/F3/F19, and the non-blocking T6/T7 backlog.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `spec.md:188-196` (AC-11), `spec.md:44` (R-9); `tasks.md:224-249` (T6); current docs: `README.md:299,304,308,391,393,426`, `docs/architecture/deployment.md:24,48`, `docs/architecture/vercel-render-neon.md:75,127,156,204,211` | The exact negative greps do fail on the r1-named stale strings (I reproduced 13 README, 6 `deployment.md`, 9 `vercel-render-neon.md`, 2 `observability.md` and 1 `containerization.md` matches), but they are not exhaustive. The same current docs still contain uncaptured current claims: README “The nine deployment names are the source of truth”, “Development email delivers through Brevo SMTP”, “the nine names exist with pinned placeholders”, “validates **nine** names”, “This feature supersedes only the preserved SMTP_PORT value”, “seven `SYNCED <KEY>` lines”, “Synced 7 value(s)”, “The Render dashboard lists the seven keys”, and “SMTP_PASS holds the SMTP key”; `deployment.md` “seven SMTP names, synced from the GitHub Environment” and “the same nine deployment names”; `vercel-render-neon.md` “the six deployment variables and the three deployment secrets”, “The nine deployment names are validated”, “same nine names”, “the deployed recipe stays `SMTP_PORT=2525`”, the SMTP troubleshooting “Email verification does not arrive”, and “The seven SMTP deployment names are validated”. The required positive sentence can be added while these remain, so T6 can pass with contradictory docs. | Extend AC-11(b)/(c)/(d) and T6's negative loops with the exact residual strings above (or replace the affected sections with an exact 11-name/9-sync deployed-API statement and a positive production code-catalog statement). The positive sentence alone is not a guard against contradictory text. | open |
| F2 | MAJOR | `spec.md:191` (AC-11(b)); `tasks.md:231-232` (T6); current `README.md:299-304,308,330-352,381,383,410,426` | F2's API line, rotation strings, recovery step and catalog rows are pinned, but the README deployment runbook is still not binary: the “Exact `gh` commands (18 lines)” block has no `gh variable set EMAIL_TRANSPORT` or `gh secret set BREVO_API_KEY` commands; the asset checklist still lists “The nine deployment names”, the secrets/variables lists omit the two new names, the production paragraph says “the nine names exist”, the merge-ordering/preserve notes still describe only `SMTP_PORT`/`SMTP_SECURE`/`RENDER_API_KEY`, and the recovery section still tells the owner to check the SMTP key. T6 can add the required API strings elsewhere and leave this runbook operationally wrong. | Pin the runbook changes: exact greps for the two new `gh` commands, the updated command count/heading, `EMAIL_TRANSPORT`/`BREVO_API_KEY` in the README secrets/variables lists, a production code-catalog statement (not “the nine names exist”), and the removal/replacement of the old preserve/merge/recovery instructions. Add these to AC-11(b) and T6. | open |
| F3 | MAJOR | `spec.md:210-218` (AC-13), `spec.md:296,305`; `tasks.md:387-391,403`; current `README.md:381,383,410-412,426` | The spec/plan/tasks now correctly say AC-11(a) was not met on ordering and is recorded as a deviation. That correction did not reach the README: “This feature supersedes only the preserved `SMTP_PORT` value … before merge (AC-11(a))”, the merge-ordering paragraph, and the T9-specific recovery instructions still state the old AC-11(a) behavior. T6 can add the new API recovery step while the old preserve/merge text remains, so the owner-facing artifact still falsely claims AC-11(a) and the old feature supersession. | Add exact negative greps/removals for the README preserve note and T9-specific recovery instructions, and a positive README statement that this feature supersedes the SMTP delivery recipe, records the AC-11(a) ordering deviation, and requires `EMAIL_TRANSPORT`/`BREVO_API_KEY` before merge (or records the fail-closed deviation). | open |
| F19 | MAJOR | `spec.md:185` (AC-10(c)); `tasks.md:40` (T1 acceptance), `tasks.md:352` (T7 acceptance), `tasks.md:23-39` (T1 verify), `tasks.md:259-351` (T7 verify) | AC-10(c) (“`compose.yaml` and `compose.smoke.yaml` add no service, image, port, volume or healthcheck”) is not mapped to any task acceptance: T1 is `AC-1, AC-2, AC-10(a)` and T7 is `AC-10(b), AC-12`. T1's verify parses only the backend environment; T7's scope check only filters source paths and never parses the compose top-level services, images, ports, volumes or healthchecks. The same compose clause in AC-12(f) is therefore also unverified. | Add AC-10(c) to T1's acceptance (the compose owner) and a compose top-level comparison against `origin/main` (services, images, ports, volumes, healthchecks), and run the same comparison in T7's AC-12(f) scope check. | open |
| F20 | MINOR | `spec.md:159` (AC-7(e)); `tasks.md:103` (T4) | AC-7(e) says all other `render.yaml` entries are unchanged, but T4 only checks the two new names `sync: false` with no value; another entry could change undetected. | Add a parsed/`git diff` comparison of the other `render.yaml` envVars (keys, values, `sync`) against `origin/main`, or a diff restricted to the two new entries, to AC-7(e)/T4. | open |
| F21 | MINOR | `spec.md:130` (AC-7(c)); `plan.md:208`; `tasks.md:112` (T4) | AC-1(h) now covers the local default in “bare, angle-only or display-name form”, but AC-7(c)'s `local_sender` case and the plan still say “bare or display-name form”; the deploy guard test truth table omits an angle-only local sender. | Add angle-only to AC-7(c)/plan's `local_sender` wording and a T4 test for an angle-only local sender. | open |
| F22 | MINOR | `spec.md:206` (AC-12(e)); `tasks.md:338-342` (T7) | The shared guard's bare `[0-9a-f]{32,}` alternative also matches a normal 40-character git commit SHA. T8 uses `<commit>`, but T7's build log may record a commit hash and then fail the guard for a harmless identifier, or the builder may be tempted to weaken the guard. | Require `<commit>` placeholders in T7/T6 evidence too (as T8 already does) or document an exact, reviewed commit-ID exception; do not weaken the token guard. | open |
| F23 | MINOR | `spec.md:212-216` (AC-13(a)/(e)); `tasks.md:362-399` (T8) | T8 checks `owner risk accepted` but not the separately required rotation plan/least-privilege justification, does not check the `SMTP_FROM` “Brevo-verified sender” confirmation, and does not assert that the owner-supplied `GH_REPO` slug is absent from the log. | Add T8 markers/greps for `rotation plan`/`least privilege` (when the fallback is used), a `SMTP_FROM confirmed` marker with no value, and `! grep -qF "$GH_REPO" "$log"`. | open |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | **not fixed (partial)** | The r2 negative loops match the r1-named current strings (13 README, 6 `deployment.md`, 9 `vercel-render-neon.md`, 2 `observability.md`, 1 `containerization.md`), but 16+ other current stale claims are not covered; see the F1 finding. |
| F2 (r1) | **not fixed (partial)** | API success line, rotation strings, recovery step and catalog rows are pinned; the README `gh` command block/asset checklist/merge wording is not; see F2/F3. |
| F3 (r1) | **partially fixed** | `spec.md`/`plan.md`/`tasks.md` correctly record the post-merge Phase A/guard-failure/re-run deviation; the README preserve/merge/recovery text is not updated or pinned (F3). |
| F4 (r1) | **fixed** | Every task defines the shared guard; T7 loops over all `build-log-*.md`; T8 adds the owner-supplied username pattern. Only the commit-SHA false-positive note (F22) remains. |
| F5 (r1) | fixed | T7 adds `git diff --exit-code origin/main...HEAD -- src/backend/vitest.config.ts src/frontend/vitest.config.ts`; both files exist and carry the pinned 80 thresholds/excludes. |
| F6 (r1) | fixed | T5/T7 parse the current and base `deploy.yml` and compare triggers, concurrency, permissions, job fields, step order, `uses`, `run`, `with`, and the exact four env additions. |
| F7 (r1) | fixed | T5/T7 assert the production placeholder output contains neither `Deploy blocked: SMTP_PORT=` nor `Deploy blocked: EMAIL_TRANSPORT must be`. |
| F8 (r1) | fixed | AC-7(c)/T4 add the production API-valid `{ ok: true }` case. |
| F9 (r1) | fixed | AC-1(g)/AC-2(b) now explicitly accept angle-only and pin the parser test; the new angle-only form also needs AC-7(c)/plan's local-sender truth-table coverage (F21). |
| F10 (r1) | fixed | AC-1(g)/T1 pin unset/empty to the existing non-empty error before parsing and whitespace-only to the AC-1(g) parse error. |
| F11 (r1) | fixed | Q-1/security/configuration now make a dedicated key the acceptance default and require an explicit MCP-key risk acceptance; T8's rotation/least-privilege check is the residual (F23). |
| F12 (r1) | fixed | Spec/plan/tasks qualify production as a code/documentation catalog and write no live production values; the README's old “nine names exist” text is covered by F1/F2. |
| F13 (r1) | fixed | AC-13 is explicitly owner-attested/not CI-reproducible; T8 uses `GH_REPO`/`CUBECLICKER_USERNAME_PATTERN` and requires Render/Brevo/resend excerpts. |
| F14 (r1) | fixed | AC-12(f), plan and T7 allow the compose env pass-throughs and forbid service/image/port/volume/healthcheck changes; the actual compose check is the F19 gap. |
| F15 (r1) | fixed | The shared guard and T7 use `BREVO_API_KEY[[:space:]]*[:=][[:space:]]*…`, catching YAML and shell assignments. |
| F16 (r1) | fixed | AC-3(a) asserts the exported timeout value; T2 only checks the symbol. |
| F17 (r1) | fixed | The user story and security text describe the managed pipeline failing closed and a dashboard-only deploy failing visibly at send; the residual “always receives” phrase in `spec.md:249` is a minor wording note, not a reopened finding. |
| F18 (r1) | fixed | AC-11(e)/(f) and T6 pin the `email transport` prose, the new events, and the containerization no-service sentence. |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ❌ | AC-11 still permits contradictory stale docs (F1), the README runbook/asset checklist is not fully covered (F2), and the AC-11(a) correction is not propagated to the README (F3). |
| Testability | ❌ | AC-10(c) is unmapped (F19); AC-7(e), AC-7(c) local-sender, the T7 commit-SHA guard and T8's fallback/SMTP_FROM checks are not fully binary (F20–F23). |
| Boundaries | ✅ | Three tiers are present; the never/ask-first rules cover secrets, Mailpit, the guard, the feature index and assertion quality. |
| Dependency graph | ❌ | T1→T2→T3, T1→T4→T5, T1–T5→T6→T7→T8 is acyclic and sequential, but AC-10(c) has no task acceptance owner/verify. |
| Parallel safety | ✅ | No `[P]` batch; all tasks `[seq]`; `files_owned` are disjoint (T1 config/compose, T2 email/CLI, T3 app/routes, T4 deploy/render.yaml, T5 CLI/workflows, T6 docs, T7/T8 logs). |
| Security | ✅ | Q-1 is fixed; the API key is runtime-only, the API body is never parsed, and the shared guard covers credentials/PII. F22/F23 are minor guard completeness notes. |
| Testing | ✅ | Unit/integration/smoke/coverage/owner-proof tiers are present; `npm run coverage` ≥80% per workspace is named; no live network in tests. F20–F23 are the remaining evidence gaps. |
| Consistency | ❌ | The README still contradicts the new 11-name/API contract (F1–F3); AC-7(c) omits angle-only local senders (F21). |
| Real-time | ✅ | Explicitly out of scope; no WebSocket, room, presence, reconnect or server-authority change; the WS upgrade still uses the session cookie and `join { mode: 'account' }` still requires `verified = true`. |
| Containers | ✅ | No new service/image/port/volume/healthcheck; compose pass-throughs and `render.yaml` value-free `sync: false` are correct; the only gap is the missing compose no-change verification (F19). |

## Notes / backlog (non-blocking)

- The r2 exact fixes for F5–F8, F10, F11, F13–F18 are genuine and implementable; F4 is fixed with the commit-SHA guard note.
- The `AC-11(b)` API success line uses `<address>` while AC-9(a) uses `<test-address>`; both are placeholders and not behaviorally different, but the spec should use one placeholder for consistency (INFO).
- `spec.md:249` still says “a deployed service always receives `brevo-api` through the sync” while the same sentence acknowledges an unchecked dashboard-only deploy; consider “a pipeline-deployed service receives `brevo-api` through the sync” (INFO).
- The `docs/architecture/deployment.md:131` historical Fly section mentions the development backend delivering through Brevo SMTP; it is labeled historical/superseded, so it is not a current claim (INFO).

## Targeted re-check (r3)

**Current verdict: approved.** The r2 summary, findings and checklist above are the historical r2 state; this section is the r3 targeted re-check of the bounded fix. The frontmatter now reflects r3.

### r2 blocking findings

| r2 blocker | Status | r3 evidence |
| --- | --- | --- |
| F1 — stale documentation claims | **resolved** | AC-11(b)/(c)/(d) and T6 now include every residual string from the r2 F1 list: the README nine-name/seven-sync/SMTP-key/preserve/merge/recovery strings, the `deployment.md` seven-sync and nine-name strings, and the `vercel-render-neon.md` nine-name/seven-sync/2525/troubleshooting strings. I re-checked all 23 r2 residual strings; each appears in the r3 T6 negative arrays. The positive 11-name/9-sync, `The production catalog is a code/documentation contract`, and `no live production environment is modified` statements are also pinned. |
| F2 — README runbook not binary | **resolved** | AC-11(b)/T6 pin `Exact `gh` commands (22 lines)`, `gh variable set EMAIL_TRANSPORT`, `gh secret set BREVO_API_KEY`, the secrets-list fragment `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_API_KEY`, the variables-list fragment `SMTP_FROM`, `EMAIL_TRANSPORT`, `RENDER_SERVICE_ID`, the production code-catalog/no-live-production statements, and the removal of the old 18-line/preserve/merge/recovery strings. |
| F3 — AC-11(a) deviation not propagated | **resolved** | AC-11(b)/T6 require `This feature supersedes the SMTP delivery recipe`, `records the AC-11(a) ordering deviation`, and `requires EMAIL_TRANSPORT and BREVO_API_KEY before merge`, and negatively grep the old preserve/merge/T9-specific SMTP recovery text. AC-13(a)/(f) and T8 carry the same deviation; T8 requires `AC-11(a) deviation` and negates `AC-11(a) met`. |
| F19 — AC-10(c) unmapped/unverified | **resolved** | T1 acceptance is now `AC-1, AC-2, AC-10(a), AC-10(c)`; T7 acceptance is `AC-10(b), AC-10(c), AC-12`. Both T1 and T7 run the same parsed compose top-level comparison against `origin/main`/`origin/main:compose.smoke.yaml`, stripping only `environment`; services, images/builds, ports, volumes, depends_on, healthchecks and top-level volumes must be unchanged. |

### r2 MINOR findings and INFO notes

| r2 item | Status | r3 evidence |
| --- | --- | --- |
| F20 — AC-7(e) other render entries | **resolved** | AC-7(e) now requires a parsed comparison of the other `envVars` and service fields against `origin/main:render.yaml`; T4 implements it by filtering only the two new keys. |
| F21 — angle-only local sender | **resolved** | AC-7(c) and the plan now say `bare, angle-only or display-name form`; T4 requires the angle-only local-sender test. |
| F22 — bare 32+ hex commit SHA | **resolved** | AC-12(e), T6, T7 and T8 record commit ids as `<commit>` (or a reviewed exception) without weakening the token guard. |
| F23 — T8 fallback/SMTP_FROM/GH_REPO markers | **resolved** | AC-13(a)/(e) and T8 add `SMTP_FROM confirmed`, conditional `rotation plan`/`least privilege` when `owner risk accepted` is present, and `! grep -qF "$GH_REPO" "$log"`. |
| INFO — placeholder consistency | **resolved** | The spec preamble, AC-9(a), AC-11(b) and T6 use `<address>` consistently. |
| INFO — pipeline-deployed wording | **resolved** | `spec.md:255` now says “a pipeline-deployed service receives `brevo-api` through the sync”. |
| INFO — historical Fly section | retained | `deployment.md:131` remains a historical/superseded note, not a current claim. |

### Consistency and gate checks

- The 8-task graph is unchanged and acyclic: T1→T2→T3; T1→T4→T5; T1–T5→T6→T7→T8. No `[P]` batch; `files_owned` remain disjoint.
- All 13 ACs are mapped: T1 `AC-1, AC-2, AC-10(a), AC-10(c)`; T2 `AC-3, AC-4, AC-9`; T3 `AC-5, AC-6`; T4 `AC-7`; T5 `AC-8`; T6 `AC-11`; T7 `AC-10(b), AC-10(c), AC-12`; T8 `AC-13`. AC-10(c) is intentionally verified in both the compose-owning task (T1) and the final gate (T7).
- Counts remain **11 validated / 9 synced / 6 production placeholders**; the guard order stays catalog → email transport → SMTP port; the runtime `smtp` default and explicit-value handling are unchanged.
- No new contradiction was introduced: the compose `environment`-only allowance, the `render.yaml` other-entry comparison, the `deploy.yml` parsed comparison, the `<commit>` rule, the T8 markers and the README runbook all agree with the existing task graph and security contract.

### MINOR/INFO backlog (non-blocking, for T6/T7)

These are close-variant stale-count sentences that remain in the current docs and are not yet in the exact T6 negative arrays; the T6 task description already covers them (“pipeline counts”, “secret hygiene”, “deployment.md … counts”, “deploy flow”), so they should be cleaned during T6 but do not block the spec gate:

- `README.md:185` — “The nine deployment names are validated on every deploy” should become the 11-name statement (or be added to the T6 README negatives).
- `docs/architecture/deployment.md:51` — “The seven SMTP names are synced from the GitHub Environment” should become the nine-synced statement (or be added to the T6 deployment negatives).
- `docs/architecture/deployment.md:58` — “`Check deployment Brevo configuration` (nine values, no network)” should be updated to the 11-name count (or negatively grepped).
- `docs/architecture/deployment.md:46-47` — the development secrets/variables lists should include `BREVO_API_KEY`/`EMAIL_TRANSPORT`; the T6 positive names currently do not force those list rows.
- `docs/architecture/vercel-render-neon.md:155` — “`Check deployment Brevo configuration` (nine names)” should be updated to the 11-name count (or negatively grepped).
- INFO: the T1/T4/T5 base comparisons use `origin/main`, while only T7 verifies `origin/main` exists. The builder should keep the existing `origin/main` ref or add a `git rev-parse --verify origin/main` guard to those task verifies.

**Spec gate: clear.** The four r2 blocking findings are resolved; F20–F23 and both INFO notes are resolved; the remaining items are non-blocking documentation cleanup for T6/T7.
