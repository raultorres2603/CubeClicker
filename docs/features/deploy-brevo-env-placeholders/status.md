---
feature: deploy-brevo-env-placeholders
state: building
spec_review_round: 2
build_round: 0
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
- [ ] T6 — Runbook and architecture documentation `[seq]`
- [ ] T7 — Verify & integrate `[seq]`

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

## Blockers / open questions
- Live GitHub state (review probe): both environments exist; `development` has `SMTP_HOST/PORT/USER/FROM` variables + `SMTP_PASS` secret; `production` empty. `SMTP_USER` must move from variable to secret.
- Q-1: user creates/updates `RENDER_API_KEY` (new secret) to authorize the sync.
- Q-2: the four `development` values (`SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `RENDER_API_KEY`) must be filled **before merging to `main`**, because `main` auto-deploys development and the guard fails closed.
- Q-3: production stays placeholder-only (unprovisioned).
- Q-4: confirm strict-fail rather than skip-with-warning when placeholders remain.
- Q-5: confirm `SMTP_USER` as a secret (supersedes the accepted feature's variable classification for deployment).
- Q-6: live-delivery proof remains user-owned.
- Q-12: GitHub environment write permission required for T5 (`Environments: Read and write` or classic `repo`), otherwise owner-executed fallback.
