---
feature: brevo-api-email-transport
state: code_review
spec_review_round: 2
build_round: 1
created: 2026-11-26
updated: 2026-11-26
---
# Status — Brevo HTTPS Email Transport (deployed environments)

## Summary
Deployed verification email delivery still fails with SMTP `EAUTH` after six credential/deploy attempts; move development (and production when provisioned) to Brevo's HTTPS Transactional Email API on port 443 using a Brevo API key, keeping Mailpit SMTP for local and smoke. Raw request: "Can't send email verification on development environment, see screenshot. Use MCP's if needed to solve this issue."

## Task board
- [x] T1 — Transport configuration, sender parsing, and local defaults `[seq]`
- [x] T2 — Brevo API service and operator CLI `[seq]`
- [x] T3 — Runtime transport selection, startup probe and 502 logging `[seq]`
- [x] T4 — Deploy catalog, guard, CLI, workflows and `render.yaml` (absorbs T5) `[seq]`
- [x] T6 — Documentation: transport contract, runbook, events and supersession `[seq]`
- [x] T7 — Verify & integrate `[seq]`
- [ ] T8 — Owner live proof and T9/AC-11 consumption `[owner]` `[seq]`

## Loop log
- 2026-11-26 — created → planning — owner reports the deployed UI still cannot send verification email; registration-account-exists T9 evidence shows `smtp_transport_verify_failed` / `EAUTH` at `smtp-relay.brevo.com:2525` after every synced credential update; Brevo MCP/API access works, so the follow-up feature targets the HTTPS API instead of SMTP — docs/features/registration-account-exists/build-log-T9.md
- 2026-11-26 — planning — planner delivered spec/plan/tasks r1 (8 sequential tasks, 13 ACs; `EMAIL_TRANSPORT` with `smtp` default, Brevo API service, deploy guard 11/9/6, owner live proof) — spec.md, plan.md, tasks.md
- 2026-11-26 — planning → spec_review — spec review round 1 dispatched — reviews/spec-r1.md
- 2026-11-26 — spec_review → planning — verdict changes_requested (4 MAJOR blocking: doc-gate false pass, unpinned README/catalog/no-service clauses, false AC-11(a) claim, incomplete PII/token/username build-log guards; 14 MINOR/INFO); planner revision r2 dispatched — reviews/spec-r1.md
- 2026-11-26 — planning — revision r2 complete: spec/plan updated, tasks rewritten, F1–F18 all fixed (disposition table in spec), shared log guard + deploy-contract checks added, AC-11(a) ordering corrected, Q-1 dedicated-key default — spec.md, plan.md, tasks.md
- 2026-11-26 — planning → spec_review — final spec review round 2 dispatched — reviews/spec-r2.md
- 2026-11-26 — spec_review → planning — review r2 verdict changes_requested (4 MAJOR: residual stale deployed-SMTP doc claims, README runbook not pinned, AC-11(a) README propagation, AC-10(c)/compose check unmapped; 4 MINOR); bounded mechanical doc/task-pinning fix under framework autonomy; targeted round-2 re-check next — reviews/spec-r2.md
- 2026-11-26 — planning — bounded fix r3 complete (F1–F3, F19–F23 addressed; 8-row disposition table; self-check PASS; AC-10(c) mapped T1/T7; 11/9/6 consistent) — spec.md, plan.md, tasks.md
- 2026-11-26 — planning → spec_review — targeted round-2 re-check dispatched (verdict update in spec-r2.md) — reviews/spec-r2.md
- 2026-11-26 — spec_review → awaiting_approval — targeted re-check approved (blocking 0; 6 MINOR/INFO backlog); user checkpoint dispatched — reviews/spec-r2.md
- 2026-11-26 — awaiting_approval → building — user approved spec r3; dedicated Brevo API key chosen (owner sets the GitHub secret before T8); T1 dispatched — reviews/spec-r2.md
- 2026-11-26 — building — T1 completed (commit 5f43382; verify exit 0; backend 2022 tests; coverage 96.98/91.98/99.64/96.98; config.ts 100%; compose local/smoke smtp/empty-key; compose top-level diff clean; log guard pass); T2 dispatched — build-log-T1.md
- 2026-11-26 — building — T2 completed (commit d6049a7; verify exit 0; backend 2055 tests; coverage 97.04/92.09/99.65/97.04; email.ts 100%; CLI 28 tests; shared guard clean); T3 dispatched; risk noted: T7 repository-wide credential guard currently matches synthetic test fixtures in T1/pre-existing tests (T2 added none) — reconcile before T7 — build-log-T2.md
- 2026-11-26 — building — T3 completed (commit 9b1f8b6; verify exit 0; backend 2064 tests; coverage 97.06/92.16/99.65/97.06; probe never-settling healthz + token invalidation + resend 202 proven; shared guard clean); T4 dispatched — build-log-T3.md
- 2026-11-26 — building → blocked — T4 cannot pass its own full-suite verify: the 11-name catalog breaks the T5-owned `render-env-cli.test.ts` nine-name expectations; no files changed, no commit; planner dispatched for a bounded task-graph amendment (merge T4+T5 or extend ownership) — build-log-T4.md (not created)
- 2026-11-26 — blocked → building — planner merged T4+T5 into one sequential deploy task (7 tasks remain; T6–T8 numbering preserved; all ACs mapped); T4 re-dispatched with exclusive ownership of the deploy module, CLI, tests, `render.yaml` and both workflows — tasks.md (r4)
- 2026-11-26 — building — T4 completed (commit e15039d; verify exit 0; backend 2093 tests; coverage 97.09/92.24/99.65/97.09; render-env.ts 100%; actionlint and workflow/render diffs clean; six process fixtures exact; shared guard clean); T6 dispatched — build-log-T4.md
- 2026-11-26 — building — T6 completed (commit 9d9e217; T6 verify verbatim exit 0; strict negative/guard audit pass; 22-line gh runbook; docs/architecture/email.md created; index row proposal recorded; shared guard clean); T7 preflight amendment applied (synthetic test-fixture pathspec exclusion; committed-diff index check); T7 dispatched — build-log-T6.md
- 2026-11-27 — building — T7 completed (commit 363dc53; full gate exit 0: backend 2093 tests 97.09/92.24/99.65/97.09; frontend 2867 tests 97.22/96.8/98.6/97.22; build/bundle pass; smoke 29/29 with documented provider fallback; actionlint + config parses + deploy diffs + credential/PII/scope audits pass); T8 owner live proof pending — build-log-T7.md
- 2026-11-27 — building → code_review — T1–T7 complete and evidence recorded; T8 owner-attested live proof remains the only owner gate; code review round 1 dispatched — build-log-T7.md
- 2026-11-27 — code_review — review r1 approved (0 blocking; 7 MINOR/INFO); AC-1–AC-12 independently reproduced; AC-13/T8 owner-pending; owner hand-off for Phase A + merge/deploy/live proof — reviews/code-r1.md

## Blockers / open questions
- Q-1 resolved: owner chose a dedicated Brevo API key; set `EMAIL_TRANSPORT=brevo-api` and `BREVO_API_KEY` in the `development` environment before merge/T8.
- Q-2 (owner): production scope stays placeholder-only.
- Q-3 (owner): confirm the active sender is the intended `SMTP_FROM`; domain authentication recommended before production.
- Q-4 (owner): retire unused SMTP names from the deployed catalog later.
- Q-5 (owner): live-proof recipient is the stale unverified account; owner clicks the link and logs in.
- Q-6 (owner): Brevo free-plan 300/day limit; 429 maps to the existing 502/resend path.
