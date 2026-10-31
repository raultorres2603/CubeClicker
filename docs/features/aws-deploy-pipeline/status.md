---
feature: aws-deploy-pipeline
state: accepted
spec_review_round: 3
build_round: 2
created: 2026-10-31
updated: 2026-10-31
---
# Status — AWS Deploy Pipeline (Terraform + GitHub Actions CI/CD + framework proof-of-working)

## Summary
Deploy CubeClicker to AWS from the existing container images via Terraform infra + a GitHub Actions pipeline whose gates (lint/typecheck/tests/coverage/build/containerized smoke/terraform fmt+validate+plan) must all pass before any deploy — raw request: "create the different infraestructure we will need to deploy, for example, on AWS. We will deploy with GitHub Actions … with terraform … the pipeline … needs to verify everything before deploying … Also, update our AI agentic framework … a feature is green to go when everything works as expected."

## Task board
- [x] T0 — Permission bootstrap for `infra/**` + `.github/**` (route (a))
- [x] T1 — Terraform scaffold & conventions
- [x] T2 — State-bucket bootstrap root module
- [x] T3 — Networking + edge module (ALB, WebSocket passthrough)
- [x] T4 — ECR module
- [x] T5 — Database module
- [x] T6 — ECS stacks (backend + frontend services)
- [x] T7 — CI/CD IAM (GitHub OIDC + least-privilege roles)
- [x] T8 — Environment composition + state backend wiring + infra README
- [x] T9 — CI workflow (`ci.yml`, reusable gates)
- [x] T10 — CD workflow (`deploy.yml`)
- [x] T11 — Dependabot + workflow hygiene
- [x] T12 — Framework: orchestrator + reviewer + playbook strengthening
- [x] T13 — Framework: AGENTS.md + builder + skills strengthening
- [x] T14 — Documentation pass (README, architecture, feature index)
- [x] T-final — Full verification sweep & evidence consolidation

## Loop log
- 2026-10-31 — created → PLANNING — request: "create the different infraestructure we will need to deploy, for example, on AWS. We will deploy with GitHub Actions … with terraform … the pipeline … needs to verify everything before deploying … Also, update our AI agentic framework … a feature is green to go when everything works as expected." (full verbatim quote in the planner Task Brief and spec.md § Summary)
- 2026-10-31 — planning → spec_review — planner completed r1 spec/plan/tasks — docs/features/aws-deploy-pipeline/spec.md
- 2026-10-31 — spec_review → planning — changes_requested (F1–F9 blocking, F10–F16 minor/info; reviewer independently verified missing terraform/actionlint, smoke gate fail due to Mailpit ordering) — docs/features/aws-deploy-pipeline/reviews/spec-r1.md
- 2026-10-31 — planning → spec_review — planner completed r2 revision (all F1–F9 resolved; F10–F16 folded) — docs/features/aws-deploy-pipeline/spec.md
- 2026-10-31 — spec_review → escalated — changes_requested on round 2 (F17 blocking + F18–F21 minor/info; budget exhausted) — docs/features/aws-deploy-pipeline/reviews/spec-r2.md
- 2026-10-31 — escalated → planning — user authorized budget extension for r3 (F17 + F18–F20) — status.md (orchestrator)
- 2026-10-31 — planning → spec_review — planner completed r3 revision (F17 resolved as two-line ARG+ENV; F18–F21 resolved) — docs/features/aws-deploy-pipeline/spec.md
- 2026-10-31 — spec_review → awaiting_approval — verdict approved (r3, blocking 0, 1 INFO F22) — docs/features/aws-deploy-pipeline/reviews/spec-r3.md
- 2026-10-31 — awaiting_approval → building — user approved — status.md (orchestrator)
- 2026-10-31 — building → code_review — all 16 tasks [x]; T-final verification sweep green — docs/features/aws-deploy-pipeline/build-log-final-verification.md
- 2026-10-31 — code_review → building — changes_requested (F1 BLOCKER terraform invocation order, F2 BLOCKER deploy-services references nonexistent task-definition JSON; F3/F4/F5 minor/info) — reviews/code-r1.md
- 2026-10-31 — building → code_review — builder fixed F1 (working-directory form), F2 (removed render/deploy steps, rely on terraform apply), F3 (removed untracked bootstrap artifacts); build-log-fix-r2.md recorded — commit 6749eb9
- 2026-10-31 — code_review → accepted — verdict approved (r2, blocking 0, 2 INFO F6/F7); documentation gate satisfied (T14 doc pass + README row applied) — reviews/code-r2.md

## Blockers / open questions
- None blocking. Backlog (MINOR/INFO) carried forward:
  - F3 (MINOR, r1) resolved in fix pass.
  - F4 (MINOR, r1) resolved by orchestrator (T-final [x]).
  - F5 (INFO, r1) accepted (doc-only credential-audit hit, no action).
  - F6 (INFO, r2) optional: trailing newline hygiene in both workflow files.
  - F7 (INFO, r2) optional: credential audit matches only docs/features/** references; no credentials in src/infra/.github.
  - F22 (INFO, spec r3): podman-vs-Docker ARG injection nuance (two-line bridge stands).
  - Upstream backlog: pre-existing Mailpit ordering defect in the one-shot `npm run smoke` (workflow-pin fix + backlog item) — predates this feature.
  - User-owned assets still to be provisioned out-of-band: AWS account/role ARNs (repo vars), S3 state bucket (one-time local apply), protected `production` environment, `PUBLIC_WS_URL`.
- Suggested next step: provision the user-side AWS assets (Q-1) and run the first real `deploy.yml` against a real account (out of scope of this feature; verification boundary stated in spec.md).
