---
feature: vercel-fly-neon-deployment
phase: spec_review
round: 3
iteration: 3
verdict: approved
reviewed: 2026-11-13
blocking: 0
nonblocking: 1
---
# Spec Review — r3

## Summary

✅ approved — 0 blocking (0 BLOCKER, 0 MAJOR), 1 MINOR. The r2 majors are resolved: the status task board is `[seq]` for T1–T7; the startup migration is conditional through `runStartupMigrations` and preserves the no-database in-memory startup with a regression test; the plan is `revision: 2`, the spec is `revision: 3`, and no unconditional startup wording remains. The r1 F2–F10 fixes remain in place: the connection-string audit excludes `*.test.ts`/`*.test.tsx` and returns no match on the current tree; AC-4 asserts the effective resolved `wss://` URL; the migration runner uses a dedicated `pg.Client` and `DIRECT_DATABASE_URL`; every Vercel CLI command is pinned to `src/frontend`; optional `VITE_WS_URL`, dev SMTP, Fly region and trailing-slash rules are corrected; and the Vercel fallback is now specified. The only remaining item is a status label (`T3` says "migration CLI" rather than the migration runner/`server.ts` work); it is bookkeeping, not a gate.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `status.md:19` | The status task board is now `[seq]` for all tasks and no longer carries the r2 parallel marker, but the T3 label still says "Vercel/Fly configs, migration CLI, image migrations"; T3 now owns `migrate-runner.ts`, `migrate-cli.ts` and the `server.ts` startup wiring (`tasks.md:35-42`). The label is incomplete, not incorrect, and does not affect execution. | Update the T3 board description to mention the migration runner and startup wiring when the orchestrator applies the transition; no spec/plan/tasks change. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All 23 ACs, the Vercel/Fly/Neon split, the local path, the environment catalog, the supersession ledger and the user-owned prerequisites are present; Vercel is explicitly frontend-only. |
| Testability | ✅ | The ACs are binary and mapped; the no-database startup regression is now in `migrate-runner.test.ts`; the audit, effective-URL, dedicated-client, cwd and environment checks are concrete. |
| Boundaries | ✅ | Always/Ask-first/Never and the non-goals remain explicit: no Vercel Functions/serverless WS, no horizontal backend scaling, no AWS deletion, no auth/schema/UI rewrite, no new dependency. |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → T5 → T6 → T7 is acyclic and strictly sequential; T5 depends on T1–T4; all ACs are mapped. |
| Parallel safety | ✅ | `tasks.md` has no `[P]` markers and the status board is `[seq]`; T5 runs after all four application tasks and T6/T7 follow. |
| Security | ✅ | The audit returns no match while excluding test fixtures; CORS is exact-origin with credentials, `SameSite=None` requires `Secure`, the WS Origin guard rejects present non-allowlisted origins with `1008`, no secret is committed or baked into `VITE_*`, and the third-party cookie/ITP risk is explicitly flagged (Q-2). |
| Testing | ✅ | Migration runner/CLI (including no-URL), CORS/cookie/WS, frontend resolver, Vercel/Fly config, deployed smoke and the full coverage gate are concrete; the no-database regression is pinned. |
| Consistency | ✅ | Spec `revision: 3`, plan `revision: 2`, tasks and status are aligned; the only drift is the non-blocking T3 status label (F1). |
| Real-time | ✅ | Vercel is frontend-only; Fly runs one persistent backend process; rooms stay single-process; heartbeat/reconnect/grace are unchanged; cross-site cookie/WS Origin risks are documented. |
| Containers | ✅ | No new compose service/image/port/volume; `compose.yaml`, `compose.smoke.yaml`, nginx and the frontend Dockerfile are unchanged; the backend image is provider-neutral; `podman compose up` remains the local command. |
| Documentation | ✅ | `deployment.md`/`vercel-fly-neon.md`/README/stack/containerization/AGENTS and the supersession ledger cover the migration; the dev SMTP guidance is corrected; `docs/features/README.md` is untouched. |
| Risks | ✅ | Parallel verification, Vercel cwd, Fly single-machine, Neon direct/pooled, no-database startup, SMTP and cookie risks are covered; the r2 majors are closed. |
| Approval checkpoint | ✅ | Q-1…Q-14 are recorded; Q-5 (Terraform archive vs delete) and Q-14 (live-proof assets/stable hostnames) remain explicit user decisions; AC-19 correctly requires a real development deploy or `blocked`. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r2) — stale status board `[P]` | ✅ fixed | `status.md:17-23` now lists T1–T7 `[seq]`; `tasks.md:3`/`:15` are strictly sequential. Only the T3 label is incomplete (F1 r3). |
| F2 (r2) — no-database startup regression | ✅ fixed | `spec.md:82` adds `runStartupMigrations` returning `null` without a client/throw when neither URL is set; `tasks.md:42` and `plan.md:173-175` wire `server.ts` to it; `migrate-runner.test.ts` contains the no-database regression; `AC-20` covers the host-only in-memory path. |
| F3 (r2) — plan frontmatter revision | ✅ fixed | `plan.md:3` is `revision: 2`; `spec.md:3` is `revision: 3`; `plan.md:418` records the r2 changes. |
| F1 (r1) — T1–T4 parallel | ✅ fixed | `tasks.md`/status are all `[seq]`; T5 follows T1–T4; no `[P]`. |
| F2 (r1) — audit test fixtures | ✅ fixed | `spec.md:101`/`tasks.md:74` exclude `**/*.test.ts` and `**/*.test.tsx`; the exact command returns no match on the current tree. |
| F3 (r1) — local `ws://` literal | ✅ fixed | `spec.md:70` asserts the effective resolved URL, not literal absence; the local fallback may remain in the bundle. |
| F4 (r1) — pooled/pooled transaction | ✅ fixed | `migrate-runner.ts` uses a dedicated `pg.Client` and `DIRECT_DATABASE_URL`; the no-URL path is the new r2 regression test. |
| F5 (r1) — Vercel CLI cwd | ✅ fixed | `spec.md:88`/`:90`, `plan.md:122`, `tasks.md:56`/`:60` pin `src/frontend`. |
| F6–F10 (r1) | ✅ fixed | Optional `VITE_WS_URL` (AC-1/4/T1), dev SMTP (spec/plan), no `primary_region`, all-trailing-slash rule, and a specified Vercel fallback with `blocked` before switching. |

## Minimum remaining revisions

None. The only open finding is the non-blocking T3 status label (F1).

## Checkpoint items for the `awaiting_approval` summary

1. **Q-1 — User-owned identifiers.** Vercel org/project IDs, Fly app names/region, Neon project/branches and hostnames; defaults: one Vercel project (`src/frontend`), `cubeclicker-development`/`cubeclicker-production`, `iad`, one Neon project with two branches.
2. **Q-2 — Domain and cookie strategy.** Recommended `app.<domain>` + `api.<domain>` for first-party cookies and `SameSite=Lax`; development may use default `*.vercel.app`/`*.fly.dev` with `SameSite=None; Secure` for Chrome-based testing; Safari/iOS ITP risk is flagged.
3. **Q-3 — `develop` branch model.** Recommended `develop` as the integration branch with a one-line `AGENTS.md` amendment; alternative is `main` for development and tags for production.
4. **Q-4 — Production trigger.** Recommended push to `main` plus the `production` environment's required-reviewer gate; alternative is manual-only `workflow_dispatch`.
5. **Q-5 — Terraform archive vs delete.** Recommended archive in place, remove Terraform from CI, defer deletion to the user; deletion requires explicit approval.
6. **Q-6 — CORS implementation.** Recommended in-repo Fastify hook with tests, no dependency; alternative `@fastify/cors@^11` requires the dependency-approval bar.
7. **Q-7 — Fly region/machine size.** Recommended `iad`, `shared-cpu-1x`, 512 MB; one machine is required by in-memory rooms.
8. **Q-8 — Vercel plan/Node.** Confirm a commercial-capable plan for a public game and Node 24.x in the Vercel project.
9. **Q-9 — SMTP provider.** User-supplied values for both environments; the Fly development environment must use a reachable SMTP host or test mailbox, never `mailpit`.
10. **Q-10 — Existing AWS data.** Assume none; any RDS data migration is a separate feature.
11. **Q-11 — Vercel Git integration.** Recommended disable so GitHub Actions is the only deploy path.
12. **Q-12 — Neon topology.** Recommended one project/two branches; two projects is the isolation alternative.
13. **Q-13 — Production cookie value.** `lax` with same-site custom subdomains; `none` with default cross-site hosts.
14. **Q-14 — Live-proof availability (blocking).** AC-19 requires the user-owned assets and a real development deploy; if absent, T7 records `blocked` and AC-19 is unmet.

Q-6/Q-7/Q-8/Q-10 remain builder defaults; Q-2/Q-3/Q-4/Q-9/Q-11/Q-12/Q-13 are user-owned choices; Q-5/Q-14 are the explicit blocking decisions. The orchestrator must present Q-1..Q-14 (especially Q-5/Q-14) in `awaiting_approval` and record confirmation in `status.md` before T1/T7.

## Notes / backlog (non-blocking)

- **F1 status label:** update the T3 board description to mention the migration runner and `server.ts` startup wiring; the task graph and `[seq]` markers are already correct.
- **The r2 majors are closed:** the status board is sequential, the no-database startup is preserved with a regression test, and the plan/spec revisions are consistent.
- **Q-5/Q-14 are explicit user decisions:** the Terraform archive/delete choice and the live development assets/stable hostnames; AC-19 stays `blocked` rather than accepted if the assets are absent.
- **Security and local-path constraints hold:** no public secrets, exact-origin CORS with credentials, `SameSite=None` only with `Secure`, WS Origin `1008`, the audit passes on a clean checkout, and `podman compose up`/`npm run smoke` remain unchanged.
- No spec, plan, tasks, status, source, workflow, Terraform, compose or git state was edited by this review; only this review artifact was written.
