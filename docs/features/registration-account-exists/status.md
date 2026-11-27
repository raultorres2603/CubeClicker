---
feature: registration-account-exists
state: code_review
spec_review_round: 2
build_round: 1
created: 2026-11-24
updated: 2026-11-24
---
# Status — Registration Account Exists: Working Verification Delivery, Honest Conflicts & Resumable Registration

## Summary
Deployed development registration returns 409 / no verification email because Render free blocks SMTP 25/465/587 (587 is pinned), registration commits before sending and retries non-idempotently, and the desired username and email sit on two different unverified accounts; this feature moves development to 2525 behind a deploy guard, returns a typed 502 with a resend path, resumes the same unverified registration, reports field-specific conflicts, accepts email login, and keeps destructive cleanup owner-owned.

## Task board
- [x] T1 — Strict Render-free SMTP guard and CI fixtures `[seq]`
- [x] T2 — Typed email delivery errors and transport `verify()` `[seq]`
- [x] T3 — Resumable registration, resend invalidation, field conflicts and email login `[seq]`
- [x] T4 — 502 mapping, field payloads, `resumed` passthrough and delivery logging `[seq]`
- [x] T5 — Non-blocking startup transport probe `[seq]`
- [x] T6 — Frontend field errors, resend action and resend-failure display `[seq]`
- [x] T7 — Documentation: blocked ports, 2525, 502, recovery and event catalog `[seq]`
- [x] T8 — Verify & integrate `[seq]`
- [ ] T9 — User-owned pre-merge setting and deployed live proof `[owner]` `[seq]`

## Loop log
- 2026-11-24 — created → planning — request: "Registration says the account already exists and the verification email never arrives."
- 2026-11-24 — planning — diagnosis verified as authoritative (Render free 25/465/587 block with 587 pinned; commit-before-send → generic 500 → non-idempotent 409; U1 `raultorraco` and U2 `raultorraco123` split across unverified rows; no sessions/economy rows; production has no users table) — spec.md § Diagnosis
- 2026-11-24 — planning — spec/plan/tasks r1 authored (11 ACs, 9 tasks, six supersessions, owner recovery runbook); awaiting spec_review — spec.md, plan.md, tasks.md
- 2026-11-24 — planning → spec_review — spec review round 1 dispatched — reviews/spec-r1.md
- 2026-11-24 — spec_review → planning — verdict changes_requested (1 BLOCKER, 7 MAJOR; 14 MINOR/INFO) — reviews/spec-r1.md; planner revision r2 dispatched
- 2026-11-24 — planning — planner delivered spec/plan/tasks r2 addressing F1–F22; consistency pass pending — spec.md, plan.md, tasks.md
- 2026-11-24 — planning — consistency pass r3 completed (static shell checks; docs-diff guard fixed; no F1–F8 regressions) — spec.md, plan.md, tasks.md
- 2026-11-24 — planning → spec_review — spec review round 2 dispatched (final review round) — reviews/spec-r2.md (pending)
- 2026-11-24 — spec_review → planning — review r2 verdict changes_requested (1 BLOCKER: docs-diff token guard false-positive on synthetic verify?token=cli-test); bounded mechanical fix under framework autonomy; targeted round-2 re-check next — reviews/spec-r2.md
- 2026-11-24 — planning — planner delivered r4 added-lines-only docs token guard (synthetic verify?token=cli-test exempted); targeted round-2 re-check dispatched — spec.md, tasks.md, plan.md
- 2026-11-24 — spec_review → awaiting_approval — spec review r2 approved (0 blocking; 7 non-blocking F2–F8); user checkpoint dispatched — reviews/spec-r2.md
- 2026-11-24 — awaiting_approval → building — user approved spec r2; T1 dispatched — reviews/spec-r2.md
- 2026-11-24 — building — T1 completed (commit 58c29f8; verify exit 0; backend coverage 96.84/91.26/99.63/96.84; actionlint pass); T2 dispatched — build-log-T1.md
- 2026-11-24 — building — T2 completed (commit 5af50c2; verify exit 0; backend coverage 96.86/91.41/99.63/96.86; email.ts 100%); T3 dispatched; branch `feat/registration-account-exists` from T3 — build-log-T2.md
- 2026-11-24 — building — T3 completed (commit fdc64bd on feat/registration-account-exists; verify exit 0; backend coverage 96.9/91.66/99.64/96.9; auth-service.ts 100/87.69/100/100); T4 dispatched — build-log-T3.md
- 2026-11-24 — building — T4 implementation + verify exit 0, but commit missing at step cap; bounded completion (re-run verify, commit) dispatched — build-log-T4.md
- 2026-11-24 — building — T4 completed (commit 2a2b535; verify exit 0; backend coverage 96.94/91.83/99.64/96.94; auth-routes.ts 84.35/61.26/100/84.35); T5 dispatched — build-log-T4.md
- 2026-11-24 — building — T5 completed (commit 3cda70d; verify exit 0; backend coverage 96.96/91.88/99.64/96.96; app.ts 96.41/90.09/100/96.41); T6 dispatched — build-log-T5.md
- 2026-11-24 — building — T6 completed (commit 699ae6b; verify exit 0; frontend coverage 97.22/96.8/98.6/97.22; build pass); T7 dispatched — build-log-T6.md
- 2026-11-24 — building — T7 completed (commit 3e914a2; docs verify exit 0; feature-index proposal in build log); T8 dispatched — build-log-T7.md
- 2026-11-24 — building — T8 full gate green (both workspaces; smoke 29/29 with PODMAN_COMPOSE_PROVIDER fallback; actionlint/config/audits pass), but commit missing at step cap; bounded completion (log guards + commit) dispatched — build-log-T8.md
- 2026-11-24 — building → code_review — T1–T8 complete, full gate green (backend 96.96/91.88/99.64/96.96; frontend 97.22/96.8/98.6/97.22; smoke 29/29 via PODMAN_COMPOSE_PROVIDER; actionlint/config/audits pass); T9 owner post-merge pending; code review round 1 dispatched — build-log-T8.md
- 2026-11-24 — code_review — review r1 approved (0 blocking; 6 MINOR + 6 INFO); AC-1–AC-10 verified; AC-11/T9 owner-pending post-merge; owner hand-off checkpoint — reviews/code-r1.md
- 2026-11-24 — code_review — owner chose to run T9; Phase A/B instructions handed off; awaiting build-log-T9.md — build-log-T9.md (pending)
- 2026-11-25 — code_review — owner authorized T9 Phase A via GitHub MCP and reported the merge to main; builder dispatched to set development vars and deploy — build-log-T9.md (pending)
- 2026-11-25 — code_review — Deploy run 45664106846 green after 2525/false, but SMTP_HOST still points at local Mailpit; owner-authorized follow-up to set smtp-relay.brevo.com and redeploy — build-log-T9.md
- 2026-11-25 — code_review — Deploy attempt 3 success after SMTP_HOST=smtp-relay.brevo.com; /healthz 200; Phase B live proof pending (owner resend/click/login) — build-log-T9.md
- 2026-11-25 — code_review — owner authorized the Phase B resend to the requested account; builder dispatched to trigger it and record send evidence — build-log-T9.md
- 2026-11-25 — code_review — Phase B resend blocked: HTTP 502 verification_email_failed, Render EAUTH at smtp-relay.brevo.com:2525; Brevo credentials rejected, zero Brevo records; owner must correct SMTP_USER/SMTP_PASS and redeploy — build-log-T9.md
- 2026-11-25 — code_review — deployed UI now shows the 502/resend panel; latest attempt still fails; diagnosing Render/Brevo/GitHub-secret timestamps before another resend — build-log-T9.md
- 2026-11-25 — code_review — post-sync Deploy attempt 4 green but the fresh instance still EAUTHs; Brevo SMTP login/key remains wrong; read-only Brevo account/sender check dispatched — build-log-T9.md
- 2026-11-25 — code_review — Brevo SMTP login identified as the relay username (not the account email); builder dispatched to correct SMTP_USER and redeploy — build-log-T9.md
- 2026-11-25 — code_review — SMTP_USER corrected and Deploy attempt 5 green, but the fresh instance still EAUTHs; SMTP_PASS is not the Brevo SMTP key; owner must replace it — build-log-T9.md
- 2026-11-25 — code_review — owner requested another Deploy after updating SMTP_PASS; builder dispatched to re-run and read the startup probe — build-log-T9.md
- 2026-11-25 — code_review — Deploy attempt 6 green but SMTP_PASS is still rejected (EAUTH); owner must regenerate the Brevo SMTP key and set it without whitespace before another retry — build-log-T9.md
- 2026-11-26 — code_review — owner reports the deployed resend still fails; SMTP auth has failed six times, so a follow-up feature (brevo-api-email-transport) is dispatched to move deployed delivery to Brevo's HTTPS API; T9/AC-11 live proof will be satisfied/superseded there — docs/features/brevo-api-email-transport/status.md

## Blockers / open questions
- T9 Phase B blocked: login corrected; `SMTP_PASS` still rejected (`EAUTH`); owner must replace it with the Brevo SMTP key (`xsmtpsib-…`), then redeploy and retry the resend.
- Q-1 (owner, destructive): delete both unverified rows or keep U2 for the exact `raultorraco` + U2-email pair; no merge implementation is in scope.
- Q-2: extend the blocked-port guard to production when provisioned.
- Q-5: Brevo sender/domain authentication remains owner-owned; AC-11 distinguishes it.
- AC-11 is user-owned; the feature is not green on local Mailpit alone.
