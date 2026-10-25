---
feature: user-authentication
state: accepted
spec_review_round: 3
build_round: 3
created: 2026-10-25
updated: 2026-10-25
---
# Status — User Authentication (Login, Registration & Guest Play)

## Summary
Login with username and password, registration with email activation, password hashing, guest play, and an intro menu (Login / Register / Play as guest), with a dockerized database and email delivery.

## Task board
21 tasks (T1–T20 + T_final); 4 parallel-safe ([P]: T2, T7, T8, T18). See tasks.md.
- [x] T1 backend dependency & config scaffolding
- [x] T2 Argon2id password hashing [P]
- [x] T3 DB pool, migrations, schema
- [x] T4 user repository
- [x] T5 session repository
- [x] T6 verification-token repository
- [x] T7 email service [P]
- [x] T8 rate limiter [P]
- [x] T9 auth service
- [x] T10 auth HTTP routes
- [x] T11 WS auth integration
- [x] T12 frontend auth API client
- [x] T13 frontend auth store
- [x] T14 auth menu/forms/pending UI
- [x] T15 App.tsx intro-menu integration
- [x] T16 session & transport auth wiring
- [x] T17 containerization
- [x] T18 docs supersession [P]
- [x] T19 server startup migrations
- [x] T20 e2e smoke extension
- [x] T_final verify & integrate

## Loop log
- 2026-10-25 — created → PLANNING — request: "make a login. With user and password."
- 2026-10-25 — planning → spec_review — planner delivered spec/plan/tasks — docs/features/user-authentication/spec.md, plan.md, tasks.md
- 2026-10-25 — spec_review → planning — verdict changes_requested (21 blocking) — reviews/spec-r1.md
- 2026-10-25 — planning → spec_review — planner delivered r2 spec/plan/tasks — docs/features/user-authentication/spec.md, plan.md, tasks.md
- 2026-10-25 — spec_review → escalated — budget exceeded (round 2 changes_requested, 2 MAJOR F22/F23) — reviews/spec-r2.md
- 2026-10-25 — escalated → planning — user authorized round-3 spec review to close F22/F23 (override of 2-round budget)
- 2026-10-25 — planning → spec_review — planner delivered r3 spec/plan/tasks (F22/F23/F24/F25/F27) — docs/features/user-authentication/spec.md, plan.md, tasks.md
- 2026-10-25 — spec_review → awaiting_approval — verdict approved (0 blocking, 1 MINOR backlog) — reviews/spec-r3.md
- 2026-10-25 — awaiting_approval → building — user approved; gated decisions approved (Postgres 16, SMTP+Mailpit, @node-rs/argon2, in-repo SQL runner, compose/docs edits)
- 2026-10-25 — building → code_review — all tasks [x]; T_final gate green (lint/typecheck/test/coverage/build/smoke) — build-log-T_final.md
- 2026-10-25 — code_review → building — verdict changes_requested (5 MAJOR banned-matchers + F11 protocol parity + 5 MINOR) — reviews/code-r1.md
- 2026-10-25 — building → code_review — code-fix pass complete (F1-F5,F8-F11 fixed; F6/F7 deferred) — build-log-codefix.md
- 2026-10-25 — code_review → building — verdict changes_requested (F12 banned matchers in store.test.ts) — reviews/code-r2.md
- 2026-10-25 — building → code_review — F12 fixed (banned matchers replaced) — build-log-F12.md
- 2026-10-25 — code_review → accepted — verdict approved (0 blocking, 0 nonblocking) — reviews/code-r3.md

## Blockers / open questions
- Dependency/service decisions flagged (Q-1..Q-12) need user approval before build.