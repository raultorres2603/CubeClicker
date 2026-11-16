---
feature: vercel-fly-neon-deployment
state: building
spec_review_round: 3
build_round: 1
created: 2026-11-13
updated: 2026-11-16
---
# Status — Vercel + Fly.io + Neon Deployment Migration

## Summary

Replace the AWS ECS/RDS/Terraform deployment path with a provider split: Vercel hosts the React/Vite frontend, Fly.io runs the persistent Fastify/WebSocket backend, and Neon hosts Postgres. GitHub Actions becomes the CI/CD pipeline, with GitHub Environments `development` and `production` holding per-environment secrets and variables. The local `podman compose up` path remains intact. The game remains server-authoritative and single-process per environment; Vercel is not used for the WebSocket backend. Raw request: "We'll use Vercel to deploy all the stack by using GitHub Actions as the CI/CD Pipeline. Also, we'll use Github environments and environment variables to create development and production environments. I need you to adapt infraestructure to deploy on Vercel. Also Github Action's to point to vercel instead of AWS" clarified to option 1 (Vercel frontend + Fly.io backend + Neon Postgres).

## Task board

- [x] T1 — Frontend per-environment runtime config `[seq]`
- [x] T2 — Backend cross-origin auth (CORS, SameSite, WS Origin) `[seq]`
- [x] T3 — Vercel/Fly configs, migration runner, image migrations `[seq]`
- [x] T4 — Zero-dependency deployed smoke script `[seq]`
- [x] T5 — CI/CD workflows (CI gates, environment-gated deploy) `[seq]`
- [x] T6 — Documentation, supersession, local-path preservation `[seq]`
- [ ] T7 — Verify & integrate (full gates + live development proof) `[seq]`

## Loop log

- 2026-11-13 — created → PLANNING — Vercel frontend + Fly.io backend + Neon Postgres migration; planner artifacts r1 written (`spec.md`, `plan.md`, `tasks.md`); AWS deployment is superseded.
- 2026-11-13 — planning → spec_review — consistency polish applied (`VITE_CLOUD_DEPLOY`, AC-17/AC-20 mapping, scoped audits, stable-host prerequisite); review round 1 pending — `spec.md` r1
- 2026-11-13 — spec review r1 → changes_requested (4 blockers, 1 major); planner revision r2 pending — `reviews/spec-review-r1.md`
- 2026-11-13 — planner revision r2 applied — sequential T1-T4, audit excludes tests, effective-URL cloud proof, dedicated migration client, Vercel cwd pin; → SPEC_REVIEW round 2 — `spec.md` r2
- 2026-11-13 — spec review r2 → changes_requested (2 major: stale status board, no-DB startup regression); status board synced; planner r3 pending — `reviews/spec-review-r2.md`
- 2026-11-13 — planner revision r3 applied — conditional `runStartupMigrations`, no-database regression test, plan revision 2; → SPEC_REVIEW round 3 — `spec.md` r3
- 2026-11-13 — spec_review → awaiting_approval — r3 approved (0 blockers); Q-1..Q-14 checkpoint, including Q-5 archive/delete and Q-14 live-proof assets — `reviews/spec-review-r3.md`
- 2026-11-13 — awaiting_approval → building — user approved defaults + live proof: Vercel root src/frontend; Fly cubeclicker-development/production, iad/512 MB; Neon one project + dev/prod branches; custom app./api. domains; Terraform archived; develop/main with reviewer gate; live T7
- 2026-11-13 — building T1 started — frontend per-environment runtime config — `tasks.md` T1
- 2026-11-13 — building T1 completed — local/cloud URL resolver + build gate; commit `aba311d`; frontend 1873 tests, coverage 96.48/96.14/97.56/96.48 — `build-log-T1.md`
- 2026-11-13 — building T2 completed — cross-origin CORS/cookie/WS Origin; commit `07c4ce4`; backend 1088 tests, coverage 95.22/88.7/99.52/95.22 — `build-log-T2.md`
- 2026-11-13 — building T3 completed — vercel/fly configs + migration runner; commit `e139928`; backend 1110 tests, coverage 95.25/88.68/99.53/95.25; image migrations 7 files; no-DB startup green — `build-log-T3.md`
- 2026-11-13 — building T4 completed — deployed smoke script; commit `307027d`; local 8/8 dry-run, live proof pending T7 — `build-log-T4.md`
- 2026-11-13 — building T5 completed — CI/CD workflows; commit `8105bc1`; actionlint clean; no AWS; coverage 95.25/88.68/99.53/95.25 and 96.48/96.14/97.56/96.48 — `build-log-T5.md`
- 2026-11-14 — building T6 completed — Vercel/Fly/Neon docs + supersession; commit `7b87cbb`; Terraform archived; local path retained — `build-log-T6.md`
- 2026-11-14 — building → blocked — T7 live proof blocked by missing cloud assets (Vercel project/token/stable host, Fly apps/token, Neon development branch/URLs, GitHub `development` environment/secrets, `develop` branch, SMTP, push) — discovery report
- 2026-11-16 — blocked → building — user authorized MCP-based development deployment on free tiers; T7 provisioning/deploy in progress — user directive
- 2026-11-16 — T7 provisioning partial — Vercel project `cubeclicker-development` + Neon `development` branch created; Neon production protection blocked by Free plan; Fly/GitHub MCPs cannot deploy/configure; Vercel SSO protection and missing SMTP/domain remain — `build-log-T7-provision.md`

## Blockers / open questions

- Q-5 — Terraform archive vs delete: user-owned decision; deleting files requires explicit approval.
- Q-14 — live proof assets/domains: Vercel project + Neon dev branch now exist; Fly backend, GitHub environments/secrets, SMTP, and stable hostnames still required.
- **Neon Free plan:** 0 protected branches; production branch is unprotected. Accept documented deviation or upgrade.
- **Fly MCP:** Managed Postgres-only; cannot create apps/machines, set secrets, deploy the Dockerfile, or read logs. Need `flyctl` + `FLY_API_TOKEN` (or a Machines-capable MCP).
- **GitHub MCP:** no environment/secret/variable/workflow-dispatch tools. Need `gh` or the GitHub UI for `develop`, `development`/`production` environments, reviewers, and the secret/variable catalog.
- **Vercel:** project exists but has SSO protection and no deployment; backend URL/WS URL not set.
- Q-1..Q-4, Q-6..Q-13 — see `spec.md` § Open questions; recommended defaults recorded.
