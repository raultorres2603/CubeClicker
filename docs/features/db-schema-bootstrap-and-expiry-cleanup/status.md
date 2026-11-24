---
feature: db-schema-bootstrap-and-expiry-cleanup
state: accepted
spec_review_round: 3
build_round: 1
created: 2026-11-24
updated: 2026-11-24
---
# Status — DB Schema Bootstrap & Expired Verification Cleanup

## Summary
Deployment-time schema bootstrap that checks required PostgreSQL tables, creates them when missing, and logs traces; plus a cleanup service that purges expired verification entries.

## Task board
- [x] T1 — Additive debug log sink `[P]`
- [x] T2 — Full DDL contract and catalog-equivalence proof `[P]`
- [x] T3 — DB lifecycle configuration `[P]`
- [x] T4 — Schema bootstrap runner and functional PostgreSQL proof `[seq]`
- [x] T5 — Expired verification cleanup scheduler and PostgreSQL proof `[P]`
- [x] T6 — Startup phase with advisory lock, migrations, bootstrap and traces `[seq]`
- [x] T7 — Shutdown `beforeClose` hook `[P]`
- [x] T8 — Server wiring: build-first, startup, cleanup lifecycle, exit path `[seq]`
- [x] T9 — Container and Render configuration, proven by the stack smoke `[seq]`
- [x] T10 — Documentation pass `[seq]`
- [x] T11 — Verify & integrate `[seq]`

## Loop log
- 2026-11-24 — created → planning — request: "add a service that checks if the required tables ... are created ... create them automatically ... logging" and "a new service that removes the entries on DB that are expired"
- 2026-11-24 — planning → spec_review — planner delivered spec/plan/tasks (rev 1) — docs/features/db-schema-bootstrap-and-expiry-cleanup/{spec.md,plan.md,tasks.md}
- 2026-11-24 — spec_review → planning — changes_requested (2 blocking: LogSink debug seam unowned; incomplete required-DDL contract) — reviews/spec-r1.md
- 2026-11-24 — planning → spec_review — planner delivered revision 2 (27 ACs, DDL contract, debug sink, 11 tasks) — {spec.md,plan.md,tasks.md}
- 2026-11-24 — spec_review → escalated — round-2 verdict changes_requested (1 blocker: T6 removes runStartupMigrations still imported by T8-owned server.ts) and spec-round budget (2) consumed — reviews/spec-r2.md
- 2026-11-24 — escalated → planning — user authorized narrow round 3 for the mechanical T6/T8 ownership fix — user decision (recommended option)
- 2026-11-24 — planning → spec_review — planner delivered revision 3 (T6/T8 ownership fixed; R2-F2..F6 folded) — {spec.md,plan.md,tasks.md}
- 2026-11-24 — spec_review → awaiting_approval — verdict approved, 0 blocking (2 nonblocking) — reviews/spec-r3.md
- 2026-11-24 — awaiting_approval → building — user approved the spec — user decision (Approve)
- 2026-11-24 — T3 completed (commit afa81c6; 29 tests; coverage 95.76/90.88/99.62/95.76) — build-log-T3.md
- 2026-11-24 — T1 completed (commit 0fa79d0; 248 tests; coverage 96.67/90.88/99.62/96.67) — build-log-T1.md
- 2026-11-24 — T7 completed (commit d6e1231; 12 shutdown tests; coverage 96.7/90.89/99.62/96.7) — build-log-T7.md
- 2026-11-24 — T2 completed (commit e173b91; 15 tests incl. real-Postgres equivalence; coverage 96.7/90.89/99.62/96.7) — build-log-T2.md
- 2026-11-24 — T5 completed (commit efac922; 12 tests incl. real-Postgres cleanup; coverage 96.74/90.97/99.62/96.74) — build-log-T5.md
- 2026-11-24 — T4 completed (commit 5fd4f05; 19 tests incl. real-Postgres insert proofs; coverage 96.78/91.05/99.63/96.78) — build-log-T4.md
- 2026-11-24 — T6 completed (commit 9a367ff; 18 tests; coverage 96.81/91.16/99.63/96.81) — build-log-T6.md
- 2026-11-24 — T8 completed (commit 57c494e; 65 scoped tests; coverage 96.81/91.16/99.63/96.81) — build-log-T8.md
- 2026-11-24 — T9 completed (commit 31b942d; compose/render assertions + smoke 29/29) — build-log-T9.md
- 2026-11-24 — T10 completed (commit f0f23eb; 25/25 doc greps/scripts) — build-log-T10.md
- 2026-11-24 — T11 completed (commit 5229f92; root gates green; backend coverage 96.81/91.16/99.63/96.81, frontend 97.15/96.75/98.36/97.15; smoke 29/29) — build-log-T11.md
- 2026-11-24 — building → code_review — all 11 tasks complete; proof-of-working evidence recorded — build-log-T1..T11.md
- 2026-11-24 — code_review → accepted — verdict approved, 0 blocking (1 MINOR, 3 INFO); docs pass complete and feature-index row added — reviews/code-r1.md

## Blockers / open questions
- none (Q-2 DDL grants for the runtime role and Q-5 direct/session-capable fallback remain operator notes, documented in README/deployment docs)
