---
feature: render-backend-migration
state: building
spec_review_round: 0
build_round: 1
created: 2026-11-16
updated: 2026-11-16
---
# Status — Render Backend Migration

## Summary

Supersede the Fly.io backend with a Render **free** web service while keeping the already-provisioned Vercel frontend and Neon Postgres. Render runs the persistent Fastify/WebSocket backend from `src/backend/Dockerfile`; the free instance spins down after inactivity and cold-starts on the next request/connection, which is acceptable for development only. Replace the Fly deploy steps in `.github/workflows/deploy.yml` with a Render deploy hook/API step, add `render.yaml`, update the environment catalog/docs, and remove Fly from the deployment path. Vercel remains frontend-only; Neon remains the database. No new runtime dependency; local `podman compose up` stays intact. Raw request: "For the Vercel/Fly/Neon deployments, you have the MCPs for all of them, please, use them to deploy on development. Bare in mind we are using free tiers on all of them, also GitHub, where you have the MCP aswell." followed by the user's choice to move the backend to Render free.

## Task board

- [x] T1 — Render Blueprint and backend service config
- [ ] T2 — GitHub Actions deploy path (Render deploy hook, remove Fly)
- [ ] T3 — Environment catalog and docs (README, deployment, Vercel/Render/Neon)
- [ ] T4 — Local/static verification and live development proof
- [ ] T5 — Acceptance/supersession bookkeeping

## Loop log

- 2026-11-16 — created → PLANNING — user chose Render free after Fly's credit-card gate; Vercel project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` and Neon `development` branch `br-ancient-smoke-za1pdv7w` already exist.
- 2026-11-16 — planning → building — Render MCP confirmed; direct free Docker web service provisioning started (Frankfurt, `src/backend/Dockerfile`, health `/healthz`) — `build-log-T1-render.md`
- 2026-11-16 — T1 backend live — Render service `srv-dbtcvv9srm7s73au5bag`, URL `https://cubeclicker-development.onrender.com`, free/frankfurt; deploy `dep-dbtcvvhsrm7s73au5cfg` live; `/healthz` 200; WS hello; Neon migrations 001–007 applied — `build-log-T1-render.md`
- 2026-11-16 — T2 Vercel live — project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`, SSO disabled, `VITE_API_URL`/`VITE_WS_URL` set, production deployment `dpl_9Hdnjf9Ze57EADRNpccKrNnc8KrF` READY, alias `cubeclicker-development.vercel.app`; deployed smoke 7/8 — Render free edge drops the 1008 close for a disallowed WS Origin; pre-upgrade 403 fix pending — `build-log-T2-vercel.md`
- 2026-11-16 — T2 smoke green — origin fix `e6a7afd` pushed; Render deploy `dep-dbtdbrdckfvc73eh5c9g` live at `ec9949d`; `/healthz` 200; deployed smoke **8/8** (disallowed Origin now HTTP 403 before upgrade); `VERCEL_TOKEN` + `RENDER_DEPLOY_HOOK_URL` present in `development` environment — `build-log-T2-smoke.md`
- 2026-11-16 — T2 workflow update in progress — replace Fly steps with Render deploy hook + health poll; set GitHub `development` vars/secrets and `develop` branch
- 2026-11-16 — user directive — push to `main` MUST auto-deploy `development`; production remains manual. Remove `gh workflow run` from the dev path; Vercel dev deploy must update the stable `cubeclicker-development.vercel.app` production target — workflow correction in progress
- 2026-11-16 — pipeline correction — remove duplicate CI (`ci.yml` + `deploy.yml` workflow_call); deploy must run only after a successful `CI` run via `workflow_run`; no re-running tests in deploy — in progress

## Blockers / open questions

- Render account/API access: need a Render API key or a service created from `render.yaml` (free web service) plus its deploy hook URL.
- Vercel CI token: `VERCEL_TOKEN` cannot be minted via MCP; needed for GitHub Actions frontend deploy.
- Render free spin-down/cold-start semantics must be documented as development-only.
- Mailpit: Render cannot reach a Fly `.internal` host; use a Render-private service or a free SMTP provider. The Fly Mailpit config is not usable with Render as-is.
- Vercel SSO protection must be disabled for the dev project.
- Neon production protection remains an accepted free-plan deviation.
