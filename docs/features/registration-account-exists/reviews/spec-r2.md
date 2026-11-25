---
feature: registration-account-exists
phase: spec_review
iteration: 2
verdict: approved
blocking: 0
nonblocking: 7
date: 2026-11-24
---
# Spec Review — r2

## Summary

✅ **approved** — The round-1 BLOCKER and all seven MAJOR findings are genuinely resolved: AC-4(g)/T4 own the route `resumed` contract, T1's CI fixture check is executable, AC-3(c)/T3 invalidate the token on create/resume/resend, AC-9/T7/T8 are per-file with the stale 587/500 checks, T8 carries the branch-history/`.env` audits and the final gate, the PII/token guards are explicit, the pre-merge 2525 sequencing is documented, and AC-1 is strict and fail-closed. The diagnosis, Q-1, real-time, and containerization sections remain sound.

The single r2 BLOCKER — the docs-diff **token** guard rejecting the README's documented **synthetic** `/verify?token=cli-test` link once the required AC-9(b) CLI-example edit (587 → 2525) put that line in the hunk — is resolved by r4. The guard now reads added lines only, extracts token-shaped values, and exempts exactly the synthetic value; a disposable `/tmp` fixture reproduces the required edit (guard exits `0`), a fake real token (exits `1`), the mixed-line case (exits `1`), and the no-op diff (exits `0`). `spec.md:253`, T7 (`tasks.md:247-251`), T8 (`tasks.md:376-380`) and plan D-14 carry the identical pipeline; the remaining F2–F8 MINOR/INFO items are unchanged.

## Gate rationale

- **Completeness:** R-1…R-11 and AC-1…AC-11 cover the request: 2525 + strict guard, typed 502 + resend, resume, field 409, email login, frontend recovery, docs, live proof; the exact pair stays Q-1. No scope invented; the probe/guard expansions are each justified and superseded explicitly.
- **Testability:** exact statuses, bodies, messages, fields, events, failure reasons and doc strings; every behaviour task has test/verify steps and coverage. F1r2 is resolved by the r4 targeted check; F3r2/F4r2/F5r2 are residual MINOR gaps.
- **Boundaries:** three tiers present; no deletion/merge code (Q-1); no new dependency, secret, schema/migration; no `.env*` edit; no UI redesign beyond the pinned error/resend surfaces.
- **Dependency graph:** acyclic and every dependency points earlier: `T1→T2→T3→T4→T6→T8`; `T2→T5→T8`; `T1,T4,T5→T7→T8`; `T8→T9`. All ACs are owned.
- **Parallel safety:** all nine tasks are `[seq]`; no `[P]`; `files_owned` is disjoint (T3 keeps one ownership set because both halves edit `auth-service.ts`; T6 has a concrete disjoint T6a/T6b split note).
- **Security:** resume requires the stored password hash, unverified-only, no session, 3/hour; login/resend stay generic apart from the recorded seventh supersession; logs use field-only events; no transport message returned; no secrets in images or docs. The F1r2 guard is added-lines-only with one exact exemption and still fails on a real token.
- **Testing/coverage:** `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace) is on every behaviour task and the T8 final gate; concrete expected values; no wildcard/snapshot-only tests; the Mailpit-primed smoke, actionlint, config parses, branch-history credential audit and T7 re-run are in T8.
- **Consistency:** seven supersessions are explicit and match the accepted specs; F1/F2/F3/F9/F17/F20 align; Q-1 is owner-only. No contradiction with `AGENTS.md`, `stack.md`, `containerization.md` or `documentation.md`.
- **Documentation:** AC-9 is per file and T7/T8 use per-file checks; F1r2 is resolved; F3r2 leaves small AC-9 clauses unproven.
- **Real-time/containers:** no WS message/room/presence/grace/reconnection/authority change; email login changes only HTTP session issuance; the upgrade still resolves the cookie and `join { mode: 'account' }` still requires `verified = true`. No service/image/port/volume/healthcheck/Dockerfile/compose change; environment-based config; `/healthz` and `/ws` on 8080 unchanged; provider-neutral images; no secrets in images or `.env*`.

## Evidence reproduced (read-only)

- **Artifacts read:** `spec.md` (r4), `plan.md` (r4), `tasks.md` (r4) — r3 for the original round, re-read at r4 for the targeted check — `status.md`, `reviews/spec-r1.md`, `AGENTS.md`, `docs/architecture/{stack,containerization,documentation,deployment,vercel-render-neon,observability}.md`, and the accepted `brevo-smtp-email-delivery`, `deploy-brevo-env-placeholders` and `user-authentication` specs.
- **Shell syntax:** all nine fenced `verify` blocks in the r3 `tasks.md` were extracted and passed `bash -n` (exit 0 each); the r4 re-check re-extracted T7/T8/T9 and they pass as well. No task command was executed against the repository; the only executable reproduction is the docs-token guard in the `/tmp` fixture (§ Targeted resolution check).
- **F2 re-check:** copied `ci.yml` to `/tmp`, changed only the development accept fixture to `SMTP_PORT: '2525'`; `grep` counts are one 2525 and one 587, and both `-B5` context checks (`development`/`production`) pass. `render-env-cli.test.ts` currently shares `SMTP_PORT: '587'`; T1's instructions cover `SMTP_VALUES`, `COMPLETE_ENV`, `EXPECTED_BODIES` and an explicit `PRODUCTION_PLACEHOLDER_ENV` 587.
- **Email extraction guard:** simulated `git diff | grep -oE <address> | grep -vxE <allowed> | grep .`: passes with no address or only the allowed local placeholder; fails with a disallowed address or a mixed line. The r3 extraction fix works.
- **Token guard (BLOCKER):** changed `README.md:177` from `smtp-relay.brevo.com:587` to `smtp-relay.brevo.com:2525` in a `/tmp` copy and ran the then-current whole-diff `git diff --no-index -U3 | grep -qE 'verify\?token=|token=[0-9a-f]{32,}'`: it **matched** the documented synthetic `/verify?token=cli-test` link on `README.md:180`, which lies in the 3-line trailing context. The r3 guard was in `spec.md:253`, `tasks.md:245` (T7) and `tasks.md:370` (T8). **Resolved in r4:** the added-lines-only guard passes this edit and fails on a real/fake token — see § Targeted resolution check.
- **Repository state:** `git grep`/`git grep --untracked` with the pinned credential pattern is clean on the current tree; `origin/main` resolves; `node_modules/.bin/tsx` exists; `js-yaml` resolves from the root; both `vitest.config.ts` files pin 80 statements/branches/functions/lines. `runRenderEnvCli` has the `(argv, env, io)` signature; `AuthService.resendVerification` issues then sends without invalidation; `auth-routes.ts` register sends only `{ message }` and maps unknown errors to 500; `VerificationPending` has no rejection catch; `README.md`, `deployment.md` and `vercel-render-neon.md` still carry the stale 587/pinned/500 text; `ci.yml` has the two 587 fixtures.
- **Not re-run:** live Neon/Render/Brevo provider evidence and T9. The r1 review's Neon reproduction (two unverified rows, zero sessions/economy rows, two undelivered tokens; production has no `users` table) remains the recorded evidence; this spec gate re-read the artifacts and the repository state and did not execute production or owner commands (the r4 targeted check ran only the docs-token guard in a disposable `/tmp` fixture). No real email address, token, password or credential appears in this review.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | `spec.md:253` (§ Security considerations → Evidence redaction), `tasks.md:245` (T7), `tasks.md:370` (T8) | **The docs-diff token guard scans context and rejects the documented synthetic link.** The guard `! git diff origin/main...HEAD -- README.md docs/architecture \| grep -qE 'verify\?token=\|token=[0-9a-f]{32,}'` inspects the entire diff, including unchanged context lines. AC-9(b)/T7 require the README CLI success example at `README.md:177` to change from `smtp-relay.brevo.com:587` to `smtp-relay.brevo.com:2525`; the default 3-line context includes `README.md:180`, which documents the email CLI's synthetic `/verify?token=cli-test` URL. I reproduced the failure with `git diff --no-index -U3` on a copy: the guard matches, so T7 and T8 fail when the documentation is correct. A builder could pass the grep only by leaving the stale `smtp-relay.brevo.com:587` CLI example in place (violating AC-9(b)) or by editing the accurate synthetic-link line (falsifying the CLI's documented synthetic URL); weakening the guard is forbidden by the spec's own "never weaken the check" rule. None of those is acceptable. | Inspect only added lines (`git diff ... \| grep '^+' \| ...`) and/or exempt the documented synthetic `verify?token=cli-test` (e.g. `grep -v 'verify?token=cli-test'`) or restrict the pattern to real token shapes (`verify\?token=[0-9a-f]{16,}\|token=[0-9a-f]{32,}`); update `spec.md` § Evidence redaction, T7 and T8. Apply the same exemption to the T7/T8/T9 build-log guards if CLI output can ever be recorded; keep the real-token/email checks intact. | resolved (r4; targeted check below) |
| F2 | MINOR | `tasks.md:242` (T7), `tasks.md:361` (T8) | **The `docs/features/README.md` ownership guard is unstaged-only.** `git diff --name-only` lists only unstaged changes, so a staged or committed edit to the orchestrator-owned index passes AC-9(h)'s task checks even though it is forbidden. | Use `git diff origin/main...HEAD --name-only -- docs/features/README.md` (fail on non-empty) or `git log --name-only origin/main..HEAD`; keep the T7 `Feature-index row proposal` requirement. | open |
| F3 | MINOR | `spec.md:189-196` (AC-9), `tasks.md:191-248` (T7), `tasks.md:307-360` (T8) | **Several AC-9 strings remain unproven.** T7/T8 check that `smtp-relay.brevo.com:2525` appears but never assert the stale `smtp-relay.brevo.com:587` CLI example is gone; the `<frontend origin>` placeholder, the Deploy re-run and the pre-ship login wording are not checked; `2525 (STARTTLS, Render free)` is checked only as `STARTTLS, Render free`; observability `no_credentials`/`unsupported` and per-event level associations are not checked (only `warn`/`info`/`debug` anywhere); the proposal's title/state/date are not checked. | Add exact negatives/positives (e.g. `! grep -q 'smtp-relay.brevo.com:587' README.md`, `grep -q '<frontend origin>'`, the exact table string, the reason strings and the event-level rows), or narrow AC-9 to the checked strings. Non-blocking. | open |
| F4 | MINOR | `spec.md:139` (AC-4(e)), `spec.md:141` (AC-4(g)), `tasks.md:141` (T4) | **Resume-429 `Retry-After` is ambiguous.** AC-4(e) pins the 429 body but not a `Retry-After`; AC-4(g)/T4 say "the 429 body/`Retry-After` is preserved", while the service's `RateLimitError` carries no `retryAfter` (unlike `AccountLockedError`). A builder cannot tell whether to assert absence or add a header. | State "no `Retry-After` for the resume limiter" or pin a value; keep the account-lockout `Retry-After` as AC-6(d); test both. Non-blocking. | open |
| F5 | MINOR | `tasks.md:393-410` (T9) | **T9's latest-run and Phase A evidence are not pinned to the post-merge development run.** `gh run list --workflow Deploy --limit 1` selects the latest Deploy run overall, not the post-merge run; a later production dispatch or unrelated run could make the check mismatch. The verify checks the live `gh variable get` values but never asserts that the Phase A log records them, although AC-11(a) says "recorded in `build-log-T9.md` Phase A". | Filter by the merge `headSha`/run id (or record the run id) and grep the Phase A log for the two names/values; non-blocking. | open |
| F6 | MINOR | `tasks.md:213-228` (T7), `tasks.md:334-349` (T8) | **Exact-phrase negative guards are phrasing traps.** `! grep -q 'A transport failure surfaces as HTTP'`, `! grep -q 'Registration returns HTTP'`, `! grep -q 'surfaces as HTTP'` and the pinned-587 phrases fail a *correct* replacement such as "no longer surfaces as HTTP 500". The AC-9(e)/(f) wording says "no longer matches" the stale regex, so the guard is consistent with the AC, but the builder must avoid the phrase entirely. | Phrase the docs positively and, if desired, narrow these guards to added lines; non-blocking. | open |
| F7 | INFO | `spec.md:379-384` (Revision history) | **Record-only omission.** The r3 line records the docs-diff address extraction, the README/recovery checks, the `origin/main` guard and the `VerificationPending.initialError` removal, but not the T9 `join { mode: 'account' }` grep (present in AC-11(d) and `tasks.md:417`). No behaviour change. | Add it to the r3 history on the next edit; no gate impact. | open |
| F8 | INFO | `status.md:28` | **Historical wording.** The r1 loop-log entry says "six supersessions"; the current spec has seven. It is a historical r1 entry, not a current claim. | None, or clarify "six at r1"; no gate impact. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | R-1…R-11 and AC-1…AC-11 cover the request; the exact pair stays Q-1; no scope invented. |
| Testability | ✅ | F1r2 is resolved by the r4 targeted check; F3r2/F4r2/F5r2 are residual MINOR gaps. |
| Boundaries | ✅ | Three tiers; no destructive SQL; no new dependency/secret/schema; no `.env*` edit. |
| Dependency graph | ✅ | Acyclic; all dependencies earlier; every AC owned by T1–T9. |
| Parallel safety | ✅ | No `[P]`; all `[seq]`; `files_owned` disjoint; T6 split note; T3 single ownership justified. |
| Security | ✅ | Resume hash/unverified/no-session/3-per-hour; generic 401; field-only logs; no transport message returned; no secret in images/docs. F1r2 is resolved: the docs guard is added-lines-only with one exact exemption and still fails on a real token. |
| Testing | ✅ | Coverage and concrete expectations on every behaviour task; the docs guard passes the required edit and fails on a real token, including on a mixed line. |
| Consistency | ✅ | Seven supersessions match the accepted specs; F1/F2/F3/F9/F17/F20; Q-1; no WS/container contradiction. |
| Documentation | ✅ | AC-9 is per-file; F1r2 is resolved; F3r2 remains MINOR. |
| Real-time | ✅ | No WS message/room/presence/grace/reconnection/authority change; email login is HTTP-only; `join { mode: 'account' }` still requires `verified = true`; resume never issues a session. |
| Containers | ✅ | No service/image/port/volume/healthcheck/Dockerfile/compose change; env-based config; `/healthz` and `/ws` on 8080; provider-neutral images; no secrets. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) BLOCKER | fixed | AC-4(g) exists; T4 `files_owned` includes `auth-routes.*`, accepts AC-4, owns `resumed` passthrough and the exact route/429 tests; T3 owns the service result. |
| F2 (r1) MAJOR | fixed | AC-1(d)/(e); T1 uses `-eq 1` and `-B5` context; the production placeholder fixture stays 587; the CLI shared values move to 2525; reproduced in `/tmp`. |
| F3 (r1) MAJOR | fixed | R-3/AC-3(c) cover create, resume and resend; T3 wraps all three and invalidates the just-issued token; the non-goal and diagnosis (two undelivered tokens) are reconciled. |
| F4 (r1) MAJOR | fixed (residual F3r2) | AC-9 rewritten per file; T7 uses per-file loops and exact positives/negatives; T8 re-runs the block; stale 587/465/25/pinned/500 claims are targeted. |
| F5 (r1) MAJOR | fixed | T8 adds `git log -p origin/main..HEAD`, the `.env*` history check, the T1 fixtures and T7's per-file checks; AC-10(d)/(e) require them. |
| F6 (r1) MAJOR | fixed; the r2 regression F1r2 is resolved | AC-11(e), § Evidence redaction and T7/T8/T9 add email/token/credential guards and placeholders; the r4 docs-diff guard is added-lines-only with one exact exemption and still fails on real tokens (targeted check). |
| F7 (r1) MAJOR | fixed | R-11, AC-11(a), the plan merge-ordering flow, T9 Phase A and § Immediate workaround require 2525/false before merge, with the blocked-deploy recovery documented. |
| F8 (r1) MAJOR | fixed | AC-1(a) requires `/^\d+$/` and 1–65535, rejects 25/465/587, 1025 and non-STARTTLS secure values; tests cover 0, 65536, -1, 587abc, 25.5, `' 2525'`, 1025 and the secure variants. |
| F9–F22 (r1) | fixed/rebutted | Spec § Review findings disposition: F9 seventh supersession; F10 `SYNCED SMTP_PORT`; F11 `email:test`/sender/key check; F12 pre-ship login wording; F13 three-argument CLI signature; F14 ARIA ids; F15 race fallback; F16 play proof; F17 guard scope; F18 sizing note (T3 one task/T6 split); F19 token count/redacted provider excerpts; F20 Q-1/status wording; F21 feature-index proposal; F22 2525 stop condition. |

## Non-blocking backlog (carry to the final summary)

- **Closed this round:** F1r2 docs-diff token guard — resolved by r4; see § Targeted resolution check below.
- **MINOR:** F2r2 `docs/features/README.md` guard is unstaged-only; F3r2 residual AC-9 strings (stale 587 CLI example, `<frontend origin>`, Deploy re-run, pre-ship wording, exact table string, `no_credentials`/`unsupported`, per-event levels, proposal title/state/date); F4r2 resume-429 `Retry-After` ambiguity; F5r2 T9 latest-run/Phase A log evidence; F6r2 exact-phrase negative guards.
- **INFO:** F7r2 r3 revision-history omission (T9 `join { mode: 'account' }` grep); F8r2 status historical "six supersessions".
- **Verified pass:** the r1 F1–F8 fixes are genuine, the F9–F22 dispositions are coherent, the dependency graph/`[seq]`/disjoint `files_owned` are valid, every behaviour task carries `npm run coverage` at 80/80/80/80, T8 is the full final gate, T9 is owner-only, the diagnosis/non-causes/immediate workaround/Q-1 are correct and redacted, the seven supersessions are explicit, and the real-time/containerization impacts are correctly out of scope.

## Targeted resolution check (r2 BLOCKER F1) — 2026-11-24

**Result: resolved.** The r4 guard reads added diff lines only, extracts token-shaped values, exempts exactly the documented synthetic `verify?token=cli-test`, and fails on any other token-shaped addition. Reproduced in a disposable `/tmp` fixture repository built from copies of `README.md` and `docs/architecture/*.md`; no production file, database, provider or repository ref was modified. The fixture token values are 64 `a` characters (not a token); no email address, credential or real verification link was used.

### Artifacts and agreement

| Artifact | Location | Check |
| --- | --- | --- |
| Spec | `spec.md:248-255` (§ Security considerations → Evidence redaction) | Prose and pipeline state the added-lines rule, the single exemption and the `grep . >/dev/null` tail |
| T7 | `tasks.md:247-251` | Identical pipeline |
| T8 | `tasks.md:376-380` | Identical pipeline |
| Plan | `plan.md:269` (D-14), `plan.md:284` (risk) | Same added-lines-only rule and single exemption |
| Revision records | `spec.md:384`, `tasks.md:9`, `plan.md:7` | Describe the same change; no task/AC/ownership change |

The three command copies are identical after whitespace normalization (`cmp` on the joined lines):

```bash
! git diff --no-color --unified=0 origin/main...HEAD -- README.md docs/architecture \
  | grep '^+' \
  | grep -oE 'verify\?token=[A-Za-z0-9_-]+|token=[0-9a-f]{32,}' \
  | grep -vxF 'verify?token=cli-test' \
  | grep . >/dev/null
```

`--no-color`, `--unified=0`, `grep '^+'`, `grep -oE` extraction, `grep -vxF` exact exemption and the `grep . >/dev/null` tail are all present; the pipeline contains no `grep -q`. AC-9's evidence line points at the T7/T8 blocks, so AC-9, T7, T8 and D-14 agree on one command and one exemption. The build-log guards (`tasks.md:253`, `tasks.md:382`, `tasks.md:419`, `spec.md:250-251`) stay strict with **no** exemption, matching the spec's "the build-log guard stays strict and records no link at all".

### Reproduction

Fixture: `/tmp/cc-guard-fixture.aalX6j` — `git init`; base commit copied from the current repository; `git update-ref refs/remotes/origin/main HEAD`; branch `feat/fixture`. The guard commands were extracted verbatim from `tasks.md` (not retyped) and run with the task's `set -euo pipefail`. `README.md:177` is the AC-9(b) CLI success line; `README.md:180` is the synthetic-link sentence.

| Case | Fixture change | Guard line exit | Expected |
| --- | --- | --- | --- |
| a | `README.md:177` `:587` → `:2525`, only line changed | **0** | 0 |
| b | added line with a fake 64-hex `verify?token=<value>` | **1** | 1 |
| c1 | added line with the synthetic value then the fake token | **1** | 1 |
| c2 | same line, fake token first | **1** | 1 |
| d | no diff | **0** | 0 |
| e | added line with only `/verify?token=cli-test` | **0** | 0 |

- **Before/after:** on case (a), the r3 whole-diff guard (negated `git diff ... | grep -qE 'verify\?token=|token=[0-9a-f]{32,}'`) exits **1** (the reported false positive); the r4 pipeline exits **0**. With `-U3` the synthetic link at `README.md:180` is present as trailing context; with `-U0` the hunk contains only the added `:2525` line and `grep '^+'` sees neither the synthetic nor a real token.
- **`--no-color`:** with `git -c color.ui=always diff --no-color --unified=0`, case (a) still exits **0** and case (b) still exits **1**; a colour setting cannot blind the `^+` filter.
- **Exact exemption:** an added `verify?token=cli-test-extra` exits **1** (the `-x` whole-line match does not exempt a longer value); `verify?token=cli-test&ref=mail` exits **0** (the extracted token is exactly the synthetic value); a mixed line with the synthetic value plus a separate bare `token=<64 hex>` exits **1**.
- **No early-exit/`pipefail` false pass:** over 50,000 matching lines, the old tail `grep -qE` leaves the upstream `grep -oE` dead with SIGPIPE and the pipeline reports **141** despite a match (`! 141` → 0 under `set -e`: a false pass). The r4 tail `grep . >/dev/null` reads all input and reports **0** (`! 0` → 1: caught).
- **Shell syntax:** the extracted T7 (68 lines), T8 (123 lines) and unchanged T9 (20 lines) `verify` blocks each pass `bash -n` (exit 0).

### Residual backlog (unchanged)

- F1r2: **closed** by this check.
- **MINOR open:** F2r2 (unstaged-only `docs/features/README.md` guard), F3r2 (residual AC-9 strings), F4r2 (resume-429 `Retry-After`), F5r2 (T9 latest-run/Phase A evidence), F6r2 (exact-phrase negative guards).
- **INFO open:** F7r2 (r3 revision-history omission), F8r2 (status historical "six supersessions").
- r4 changed no task title, ownership, acceptance criterion or dependency; the non-blocking count stays 7.

**Verification note (non-blocking; not a spec change).** The guard line's own exit code is the enforced signal: a standalone `! pipeline` returning 1 does not abort a `set -e` script (bash/POSIX erase `-e` for `!`-inverted commands), so an aggregate-only exit record would not show a guard failure. The accepted build logs record per-command exit codes (`[exit=N]`), which is what makes this guard visible. The idiom is pre-existing across `tasks.md` and is not introduced by r4; no spec change is required for this gate.
