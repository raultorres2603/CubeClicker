---
feature: production-provisioning
state: blocked
spec_review_round: 2
build_round: 0
created: 2026-11-27
updated: 2026-11-27
---
# Status — Production Environment Provisioning

## Summary
Provision the `production` GitHub Environment end to end (Neon branch, Vercel project, Render service, GitHub values, protection and live deploy proof), mirroring development and using the available MCPs, with clean production resource names (no `-production` or any environment suffix/prefix). Raw request: "We can go to production. So, using MCPS we have, configure the same way we configured development on GitHub, but, now, on production environment. Also, bear in mind, when deploying to Vercel, Neon or Render, do not use suffix '-production', do not use any environment suffix/prefix, is just on development environment."

## Task board
- [x] T1 — Capability matrix, base-branch gate and read-only preflight `[seq]`
- [x] T2 — Neon `production` branch, URLs, migrations and zero-data check `[seq]`
- [x] T3 — Vercel production project `[seq]`
- [x] T4 — Render production service, environment and deploy hook `[seq]`
- [x] T5a — Phase A owner hand-off `[owner]` `[seq]`
- [x] T5 — GitHub `production` Environment catalog and protection `[seq]`
- [>] T6a — Fix deploy CI preflight repository context `[seq]`
- [ ] T6 — Live production deploy proof `[seq]`
- [ ] T7 — Documentation and proposed feature-index row `[seq]`
- [ ] T8 — Verify & integrate `[seq]`

## Loop log
- 2026-11-27 — created → planning — request: "We can go to production … configure the same way we configured development … do not use suffix '-production' … is just on development environment"; planner briefed with the current production `placeholder-only` state and the MCP/naming constraints.
- 2026-11-27 — planning — planner delivered spec/plan/tasks r1 (8 sequential tasks, 12 ACs; provider provisioning + GitHub production Environment + live proof; hard dependency gate on `brevo-api-email-transport` being on `main`) — spec.md, plan.md, tasks.md
- 2026-11-27 — planning → spec_review — spec review round 1 dispatched — reviews/spec-r1.md
- 2026-11-27 — spec_review → planning — verdict changes_requested (2 BLOCKER: the Neon `production` branch pre-exists as the project default `br-floral-dream-zarerhtw` but the plan creates it from a non-existent `main`, and the cleanup would delete that pre-existing branch; 5 MAJOR: T8 token audit false-positive, incomplete documentation inventory, missing Phase A owner gate, missing T2 branch-ID/migration assertions, missing T8 development/provider read-backs; 11 MINOR/INFO); planner revision r2 dispatched — reviews/spec-r1.md
- 2026-11-27 — planning — revision r2 complete: spec/plan/tasks updated for F1–F18 (existing Neon branch reused and never deleted; cleanup limited to created Render/Vercel resources; credential-shaped audits; exhaustive docs inventory; T5a owner gate; exact branch-ID/schema assertions; provider/development read-backs; minor corrections) — spec.md, plan.md, tasks.md
- 2026-11-27 — planning → spec_review — final spec review round 2 dispatched (r1 findings verification + full re-review) — reviews/spec-r2.md
- 2026-11-27 — spec_review → planning — review r2 verdict changes_requested (1 MAJOR: the token-audit replacement drops the canonical `FLY_API_TOKEN`/`FlyV1` coverage, a security-audit regression; 8 MINOR/INFO: T5a `SMTP_FROM` command, unexecuted T8 stale scan, T2 exact-zero/primary assertions, T5 production read-backs, two residual stale phrases, partial ledger row; all r1 BLOCKER/MAJOR fixed); bounded mechanical fix under framework autonomy dispatched, targeted r2 re-check to follow — reviews/spec-r2.md
- 2026-11-27 — planning — bounded r2a fix complete (F19–F27: Fly audit coverage restored; `SMTP_FROM` variable command corrected; exhaustive T8 scan executed; exact zero/primary assertions; T5 production read-backs; residual stale phrases; full ledger row; secret attribution and audit exclusions) — spec.md, plan.md, tasks.md
- 2026-11-27 — spec_review — targeted r2 re-check approved (0 blocking; 3 MINOR backlog: duplicate T7 guard omits `FlyV1`, owner-table `SMTP_FROM` how-cell, slightly broad T8 allowlist); user checkpoint dispatched — reviews/spec-r2.md
- 2026-11-27 — awaiting_approval → building — user approved spec r2 with the documented defaults (free Render/Vercel/Neon, main-only protection + reviewers, dedicated credentials, SMTP 2525/false, render.yaml development-only, platform hosts); T1 dispatched — reviews/spec-r2.md
- 2026-11-27 — building — T1 completed (commit 387a302; base 00e2359 on `main`; dependency gate green: `EMAIL_CATALOG`, `EMAIL_TRANSPORT`, `BREVO_API_KEY` present; capability matrix and names-only pre-state recorded; probes 422 and created nothing; verify exit 0); T2 dispatched — build-log-T1.md
- 2026-11-27 — building — T2 completed (commit 621a570; existing `br-floral-dream-zarerhtw` verified, parent none/default/primary, no create/delete; pooled+direct URLs connected with `sslmode=require`; seven migrations applied and re-run clean; five tables exist with zero application rows; verify exit 0); T3 dispatched — build-log-T2.md
- 2026-11-27 — building — T3 completed (commit 200f4f8; Vercel project `cubeclicker` created as `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, domain `https://cubeclicker.vercel.app`, root/framework/Node settings, auto-deploy off, deployment protection disabled, zero deployments; distinct from the development project; verify exit 0); T4 dispatched — build-log-T3.md
- 2026-11-27 — building — T4 completed (commit e88139d; Render service `cubeclicker` created as `srv-dc4mjd15efls739ua63g`, host `https://cubeclicker.onrender.com`, docker/free/frankfurt/main, 15 env names, no health check, deploy hook owner hand-off; development untouched; verify exit 0); T5a owner gate dispatched — build-log-T4.md
- 2026-11-27 — building — T5a: owner authorized copying the non-secret development `SMTP_FROM` variable; builder dispatched to copy it in-process and verify the six owner-held production secrets by name (values never read or recorded)
- 2026-11-27 — building — T5a completed (commit 9cb455a; `SMTP_FROM` copied from development without recording the value; all six owner-held secrets present; `Phase A owner hand-off complete`; verify exit 0); T5 dispatched — build-log-T5a.md
- 2026-11-27 — building — T5 completed (commit 2af2072; production Environment 15 variables / 8 secrets; Neon URLs verified and set; `main`-only branch policy + required reviewer `raultorres2603`; development unchanged; verify exit 0); T6 dispatched — build-log-T5.md
- 2026-11-27 — building → blocked — T6 live deploy run `45993542551` failed at `Verify CI succeeded for target commit` before any provider step: the pre-checkout `gh run list` has no repository context (`fatal: not a git repository`); the same defect failed prior manual run `45700752621`. Production is provisioned but unpromoted; no provider asset changed. The spec non-goal forbids the one-line guard fix, so an owner decision is required: amend and merge the fix, or defer the live proof — build-log-T6.md
- 2026-11-27 — blocked → planning — owner approved the one-line deploy-guard fix and the merge-to-main path; planner dispatched for a bounded spec amendment (allow `--repo "$GITHUB_REPOSITORY"`, add T6a) and reviewer re-check — build-log-T6.md
- 2026-11-27 — planning — r3 amendment complete (T6a added; exactly one `deploy.yml` line allowed; T6/T7/T8 guards updated; F31 wording fixed) — spec.md, plan.md, tasks.md
- 2026-11-27 — planning → building — reviewer approved the r3 amendment (0 blocking; 3 MINOR backlog); T6a dispatched to create the `fix/deploy-ci-preflight` PR — reviews/spec-r2.md
- 2026-11-27 — building → blocked — T6a PR #4 opened (`https://github.com/raultorres2603/CubeClicker/pull/4`, branch `fix/deploy-ci-preflight`, commit `8e7dd6c`, 1 file +1/−1, actionlint pass, repo-context dry-run success, PR CI green); the owner must merge it to `main` before T6 re-dispatches. Also flagged: T8's long-hex build-log guard currently matches existing full SHAs in `build-log-T1.md`/`build-log-T6.md` and must be adjusted or the SHAs shortened before T8 — build-log-T6a.md

## Blockers / open questions
- T6a is owner-gated: PR #4 (`fix/deploy-ci-preflight`, one line, actionlint/dry-run/PR-CI green) must be merged to `main` before T6 re-dispatches the production deploy. Production remains provisioned but unpromoted; no provider asset was touched.
- T8 currently has a long-hex build-log guard that matches existing full SHAs in `build-log-T1.md`/`build-log-T6.md`; the guard must be adjusted or the SHAs shortened before T8 can pass.
- T5a Phase A owner hand-off is complete (six owner-held secrets + copied `SMTP_FROM`); names only were verified. The live T6 proof remains.
- T5 must re-read/derive the two Neon URLs in-process and set `DATABASE_URL`/`DIRECT_DATABASE_URL`; `SMTP_FROM` is a variable, never a secret.
- T4 limitation: the Render MCP exposes no environment-variable read tool; the accepted replace-all write with exactly 15 keys is the environment record, and T6's sync/deploy/smoke is the functional proof.
