---
feature: deploy-brevo-env-placeholders
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-11-22
updated: 2026-11-22
---
# Status — Deployment Brevo Environment Placeholders

## Summary
Local stays on Mailpit; development and production deployment environments carry the Brevo SMTP configuration as GitHub environment variables/secrets with placeholders for the repository owner to fill in, synced to Render behind a hard placeholder guard.

## Task board
- [x] T1 — Catalog, placeholder guard and Render sync logic `[seq]`
- [x] T2 — Render env CLI (`--check-only` / `--dry-run` / sync) `[seq]`
- [x] T3 — Deploy workflow: preflight guard and Render sync `[seq]`
- [x] T4 — CI guard fixture checks `[seq]`
- [x] T5 — Create the GitHub Environment placeholders `[seq]`
- [x] T6 — Runbook and architecture documentation `[seq]`
- [x] T7 — Verify & integrate `[seq]`

## Loop log
- 2026-11-22 — created → planning — request: "On local, we will continue using Mailpit, but, on deployment environments, we'll use Brevo. So: On development and production we should have this as environment variables/secrets. Can you do this for me? Add the placeholders on GitHub, I'll update with the values."
- 2026-11-22 — planning → spec_review — planner delivered spec/plan/tasks r1 (GitHub→Render sync + hard placeholder guard); review round 1 — docs/features/deploy-brevo-env-placeholders/spec.md
- 2026-11-22 — spec_review (r1) → planning — verdict `changes_requested`, 7 blocking (F1–F7: pipeline credential in sync payload, unsafe `[P]` batch, broken gh command, unproven gh write permission, RENDER_API_KEY outside guard, stale docs, incomplete runbook verify) — reviews/spec-r1.md
- 2026-11-22 — spec_review (r2) → planning — verdict `changes_requested`, 2 blocking (N1 T7 missing AC-1 proof; N2 incomplete pipeline-doc greps); owner approved scoped fix skipping round 3 — reviews/spec-r2.md
- 2026-11-22 — planning (r3) → awaiting_approval — N1/N2 fixed (T7 AC-1 diff+compose+smoke, T6 pipeline/operating greps), N3–N9 folded; owner confirmed auto-sync + strict fail, Q-4/Q-5 closed — spec.md (r3)
- 2026-11-22 — awaiting_approval → building — user approved spec r3 — spec.md (r3)
- 2026-11-22 — building — T1 complete — guard/sync module + 32 tests, coverage 96.66/90.75/99.61/96.66, commit c33c3b2 — build-log-T1.md
- 2026-11-22 — building — T2 complete — `--check-only`/`--dry-run`/sync CLI + 21 tests, 1826 tests, coverage 96.64/90.81/99.61/96.64, commit 5cdaa5c — build-log-T2.md
- 2026-11-22 — building — T3 complete — deploy preflight + sync steps, actionlint clean, 13/13 checks, commit fa56cb4 — build-log-T3.md
- 2026-11-22 — building — T4 complete — CI reject/accept guard fixtures with real CLI calls, actionlint clean, commit 38e405f — build-log-T4.md
- 2026-11-22 — building — T5 complete — GitHub envs: dev added/migrated (preserve decision), production nine placeholders; probes 422/422; names-only verify green; commit d2041ef — build-log-T5.md
- 2026-11-22 — building — T6 complete — README deployment runbook, deployment/vercel-render docs corrected, T6 verify green; concurrent commit 5469a7c noted for audit; commit cb95d75 — build-log-T6.md
- 2026-11-23 — building — T7 complete — full gate green (1826+2844 tests, coverage backend 96.64/90.81/99.61/96.64, frontend 97.15/96.75/98.36/97.15, smoke 29/29, actionlint/config/credential audits clean); 5469a7c audited clean; commit 434308b — build-log-T7.md
- 2026-11-23 — building → code_review — all 7 tasks [x], every task's verify recorded — tasks.md
- 2026-11-23 — code_review → accepted — verdict `approved`, blocking 0; AC-1…AC-12 met; docs pass complete (T6); live deploy for 5469a7c succeeded (guard 9 values, 7 SYNCED, /healthz OK, deployed smoke 8/8); feature index updated — reviews/code-r1.md

## Blockers / open questions
- Resolved: T5 created the GitHub entries (development additions + `SMTP_USER` migrated variable→secret preserving value; production nine placeholders); owner filled `development` `RENDER_API_KEY`; deploy run 45059930353 synced seven values to Render and passed.
- Q-3: production stays placeholder-only (unprovisioned) — fill the production placeholders when the service exists.
- Q-6: live-delivery proof the deployed registration delivers is user-owned; the deployed smoke 8/8 passed.
- Backlog (MINOR/INFO from code-r1): stale post-deploy operator wording (README/architecture/net status), README development runbook re-run hazard (label fresh-environment-only), AC-8 fixture-size literal vs public constants, commits on `main`/`5469a7c` mega-commit/process notes, URL-encoding INFO, log masking INFO.
