---
feature: render-backend-migration
state: accepted
spec_review_round: 0
build_round: 2
created: 2026-11-16
updated: 2026-11-16
---
# Status — Render Backend Migration

## Summary

Supersede the Fly.io backend with a Render **free** web service while keeping the already-provisioned Vercel frontend and Neon Postgres. Render runs the persistent Fastify/WebSocket backend from `src/backend/Dockerfile`; the free instance spins down after inactivity and cold-starts on the next request/connection, which is acceptable for development only. Replace the Fly deploy steps in `.github/workflows/deploy.yml` with a Render deploy hook/API step, add `render.yaml`, update the environment catalog/docs, and remove Fly from the deployment path. Vercel remains frontend-only; Neon remains the database. No new runtime dependency; local `podman compose up` stays intact. Raw request: "For the Vercel/Fly/Neon deployments, you have the MCPs for all of them, please, use them to deploy on development. Bare in mind we are using free tiers on all of them, also GitHub, where you have the MCP aswell." followed by the user's choice to move the backend to Render free.

## Task board

- [x] T1 — Render Blueprint and backend service config
- [x] T2 — GitHub Actions deploy path (Render deploy hook, remove Fly)
- [x] T3 — Environment catalog and docs (README, deployment, Vercel/Render/Neon)
- [x] T4 — Local/static verification and live development proof
- [x] T5 — Acceptance/supersession bookkeeping

## Loop log

- 2026-11-16 — created → PLANNING — user chose Render free after Fly's credit-card gate; Vercel project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` and Neon `development` branch `br-ancient-smoke-za1pdv7w` already exist.
- 2026-11-16 — planning → building — Render MCP confirmed; direct free Docker web service provisioning started (Frankfurt, `src/backend/Dockerfile`, health `/healthz`) — `build-log-T1-render.md`
- 2026-11-16 — T1 backend live — Render service `srv-dbtcvv9srm7s73au5bag`, URL `https://cubeclicker-development.onrender.com`, free/frankfurt; deploy `dep-dbtcvvhsrm7s73au5cfg` live; `/healthz` 200; WS hello; Neon migrations 001–007 applied — `build-log-T1-render.md`
- 2026-11-16 — T2 Vercel live — project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`, SSO disabled, `VITE_API_URL`/`VITE_WS_URL` set, production deployment `dpl_9Hdnjf9Ze57EADRNpccKrNnc8KrF` READY, alias `cubeclicker-development.vercel.app`; deployed smoke 7/8 — Render free edge drops the 1008 close for a disallowed WS Origin; pre-upgrade 403 fix pending — `build-log-T2-vercel.md`
- 2026-11-16 — T2 smoke green — origin fix `e6a7afd` pushed; Render deploy `dep-dbtdbrdckfvc73eh5c9g` live at `ec9949d`; `/healthz` 200; deployed smoke **8/8** (disallowed Origin now HTTP 403 before upgrade); `VERCEL_TOKEN` + `RENDER_DEPLOY_HOOK_URL` present in `development` environment — `build-log-T2-smoke.md`
- 2026-11-16 — T2 workflow update in progress — replace Fly steps with Render deploy hook + health poll; set GitHub `development` vars/secrets and `develop` branch
- 2026-11-16 — user directive — push to `main` MUST auto-deploy `development`; production remains manual. Remove `gh workflow run` from the dev path; Vercel dev deploy must update the stable `cubeclicker-development.vercel.app` production target — workflow correction in progress
- 2026-11-16 — pipeline correction — remove duplicate CI (`ci.yml` + `deploy.yml` workflow_call); deploy must run only after a successful `CI` run via `workflow_run`; no re-running tests in deploy — in progress
- 2026-11-16 — pipeline green — CI `43852511347` success; Deploy `43852823666` success; Render `dep-dbte1lp5efls73artkb0` live; Vercel `dpl_BrrXU6iMWrDNA5Rb2gnWdUEa2uKj` READY/aliased; deployed smoke 8/8; deploy has no duplicate CI and no alias step
- 2026-11-16 — T3 docs/acceptance in progress — rewrite README/deployment docs to Vercel/Render/Neon, add `render.yaml`, archive Fly configs; production/SMTP remain explicit blockers
- 2026-11-16 — T3 docs complete — `74e0b60` `docs: document render deployment`; `render.yaml`, Vercel/Render/Neon runbook, Fly archive; actionlint/link/tests/coverage green
- 2026-11-16 — T4 live proof complete — CI `43852511347` + Deploy `43852823666` green; deployed smoke 8/8; Render/Vercel/Neon live — `build-log-T2-smoke.md`
- 2026-11-16 — review r1 fixes — `0d802e4` clean-job Render validation, no platform health check, production unprovisioned docs, main-only branch model; local, pending push — `build-log-T3-docs.md`
- 2026-11-16 — post-fix pipeline green — `0d802e4`/`74e0b60` on origin; CI `43863104962` success (Render validation after npm ci); Deploy `43863511736` success; Render `dep-dbtf3s8ae00c73d8dstg` live; Vercel `dpl_68pi3FkrwRVBGk35kYSXqgitu2HL` READY/aliased; deployed smoke 8/8
- 2026-11-16 — code_review → accepted — review r2 approved (0 blockers); live dev stack green; production/SMTP separation documented — `reviews/code-review-r2.md`

## Blockers / open questions

- Render free spin-down/cold-start semantics documented; deployed workflow polls `/healthz` because Render has **no platform health check configured**.
- SMTP guest-only in development; no free provider configured and Render free cannot reach Fly Mailpit.
- Vercel SSO is disabled for the dev project only.
- Neon production branch is unprotected; accepted free-plan deviation.
- Production is unprovisioned and unprotected; manual `workflow_dispatch` only.
- Backlog: stale Fly source comments; T2 workflow log acceptance audit superseded by later follow-ups; CI smoke uses `docker compose` (pre-existing).
- Accepted 2026-11-16; production and SMTP delivery remain separate follow-ups.
