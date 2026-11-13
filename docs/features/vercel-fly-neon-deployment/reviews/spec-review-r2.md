---
feature: vercel-fly-neon-deployment
phase: spec_review
round: 2
iteration: 2
verdict: changes_requested
reviewed: 2026-11-13
blocking: 2
nonblocking: 1
---
# Spec Review — r2

## Summary

❌ changes requested — 2 MAJOR, 1 MINOR. The r1 F2–F10 fixes are present and the critical pieces now hang together: AC-23's connection-string audit excludes `*.test.ts`/`*.test.tsx` and returns no match on the current tree; AC-4 asserts the effective resolved `wss://` URL instead of literal absence; AC-10 adds a dedicated `pg.Client` migration runner and `server.ts` uses the direct URL when present; AC-13/AC-15 pin every Vercel CLI command to `src/frontend`; optional `VITE_WS_URL`, dev SMTP, Fly region and trailing-slash rules are corrected; and T1–T4 are sequential in `tasks.md`. Two issues remain: the `status.md` task board still marks T1–T4 `[P]` (the r1 F1 residual), and the new unconditional startup migration throws when no database URL is configured, breaking the existing in-memory startup. The plan frontmatter is also still `revision: 1`.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `status.md:17-20` vs `tasks.md:3`, `:15` | The r1 F1 fix is incomplete in the status artifact: `tasks.md` is now strictly sequential (T1 → T2 → T3 → T4 → T5 → T6 → T7; no `[P]`), and the status loop log at `status.md:30` says "sequential T1-T4", but the status task board still lists T1–T4 with `[P]`. The status is the feature's task tracker; if the orchestrator follows that board it can reintroduce the parallel verification/smoke collision the r1 review blocked. | Update the status task board to `[seq]` for T1–T4 (and T5–T7), with T3 describing the migration runner/`server.ts` work and T5 the workflows. No spec/plan/tasks behavior change; this is the r1 F1 bookkeeping closure. | open |
| F2 | MAJOR | `spec.md:82` (AC-10), `plan.md:170`, `tasks.md:42`, `src/backend/src/server.ts:11-16` | The new startup path unconditionally calls `runMigrationsAgainst(resolveMigrationUrl(process.env))` before `buildApp`. `resolveMigrationUrl` throws when neither `DIRECT_DATABASE_URL` nor `DATABASE_URL` is set, but the current `server.ts` supports a no-database in-memory startup (`if (pool !== null)` and `buildApp(..., pool !== null ? … : {})`). A host-only backend run (`npm run dev -w @cubeclicker/backend`/`node dist/server.js`) with no DB now exits 1 instead of starting with in-memory repositories. The documented `podman compose up` path has `DATABASE_URL`, so it is unaffected, but the existing local/in-memory mode is a regression. | Make the startup migration conditional on a configured URL: `const url = process.env.DIRECT_DATABASE_URL \|\| process.env.DATABASE_URL; if (url) await runMigrationsAgainst(url);`, leaving `buildApp` with the in-memory repositories when neither is set. Add a `server.ts`/startup test for the no-URL skip; update AC-10/AC-20 and the T3 note. | open |
| F3 | MINOR | `plan.md:3` | The plan frontmatter still says `revision: 1` even though its content is the r2 revision (dedicated migration client, Vercel cwd, no `primary_region`, effective-URL proof) and the spec is `revision: 2`; the status loop log says the r2 revision was applied. The artifact revision trail is inconsistent. | Bump `plan.md` to `revision: 2` and, if the plan carries a revision history elsewhere, record the r2 changes. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All 23 ACs, the Vercel/Fly/Neon split, the local path, the environment catalog, the supersession ledger and the user-owned prerequisites are present; the architecture does not assume Vercel can host the WebSocket backend. |
| Testability | ❌ | The ACs are binary and mapped, but the new no-database startup path (F2) has no test and the status board (F1) is the execution tracker; both are fixable without changing the architecture. |
| Boundaries | ✅ | Always/Ask-first/Never and the non-goals remain explicit: no Vercel Functions/serverless WS, no horizontal backend scaling, no AWS deletion, no auth/schema/UI rewrite, no new dependency. |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → T5 → T6 → T7 is acyclic and strictly sequential; T5 depends on T1–T4; all ACs are mapped. |
| Parallel safety | ❌ | `tasks.md` is sequential, but the status board still has T1–T4 `[P]` (F1); the status is the orchestrator's tracker, so the r1 F1 is not fully closed until it is synced. |
| Security | ✅ | The r1 connection-string audit now excludes fake test fixtures and returns no match; CORS is exact-origin with credentials, `SameSite=None` requires `Secure`, the WS Origin guard rejects present non-allowlisted origins with `1008`, metrics/secrets remain out of the client bundle, and no secret value is committed. |
| Testing | ❌ | The migration runner/CLI, CORS/cookie/WS, frontend resolver, Vercel/Fly config and deployed smoke tests are concrete; F2's no-database startup path is an uncovered regression, and F1 is a task-tracker issue. |
| Consistency | ❌ | The plan revision (F3), status board (F1) and `server.ts` no-URL startup (F2) do not match the spec/tasks; the rest of the r2 corrections are consistent. |
| Real-time | ✅ | Vercel is frontend-only; Fly runs one persistent backend process; rooms are single-process; heartbeat/reconnect/grace are unchanged; cross-site cookie/ITP and WS Origin risks are explicitly documented (Q-2/Q-13). |
| Containers | ✅ | No new compose service/image/port/volume; `compose.yaml`, `compose.smoke.yaml`, nginx and the frontend Dockerfile remain unchanged; backend image stays provider-neutral; `podman compose up` remains the local command. |
| Documentation | ✅ | `deployment.md`/`vercel-fly-neon.md`/README/stack/containerization/AGENTS and the supersession ledger cover the migration; the dev SMTP guidance is corrected; `docs/features/README.md` is untouched. |
| Risks | ❌ | The plan covers parallel verification, Vercel cwd, Fly single-machine, Neon direct/pooled, SMTP and cookie risks, but not the no-database startup regression (F2) or the status/plan artifact drift (F1/F3). |
| Approval checkpoint | ✅ | Q-1…Q-14 are recorded; Q-5 (Terraform archive vs delete) and Q-14 (live-proof assets) remain explicit user decisions; AC-19 correctly requires a real development deploy or `blocked`. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) — T1–T4 falsely parallel | ⚠️ partial | `tasks.md:3`/`:15` are strictly sequential; the status board still lists T1–T4 `[P]` (F1 r2). |
| F2 (r1) — AC-23 audit matches test fixtures | ✅ fixed | `spec.md:101`/`tasks.md:74` exclude `**/*.test.ts` and `**/*.test.tsx`; the exact command returns no match (exit 1) on the current tree. |
| F3 (r1) — AC-4 local `ws://` literal | ✅ fixed | `spec.md:70` now asserts the effective resolved URL; the local fallback may remain in the bundle; `plan.md:50`/`tasks.md:24` repeat it. |
| F4 (r1) — startup pooled / unpinned transaction | ✅ fixed for the pooled/Pool issue | `spec.md:82`/`plan.md:168`/`tasks.md:42` add `migrate-runner.ts` with a dedicated `pg.Client`; `server.ts` uses `DIRECT_DATABASE_URL` when present. New no-URL regression: F2 r2. |
| F5 (r1) — Vercel CLI cwd | ✅ fixed | `spec.md:88`/`:90`, `plan.md:122`, `tasks.md:56`/`:60` pin every Vercel command to `src/frontend`. |
| F6 (r1) — optional `VITE_WS_URL` vs "either missing" | ✅ fixed | `spec.md:67`/`:70` validate the resolved `wsUrl`; the API-only cloud case derives `wss://…/ws`; the T1 verify builds API-only. |
| F7 (r1) — dev `SMTP_HOST` Mailpit | ✅ fixed | `spec.md:176-177` and `plan.md:258` require a reachable SMTP/test mailbox and explicitly say Mailpit is not reachable from Fly. |
| F8 (r1) — hardcoded `primary_region` | ✅ fixed | `spec.md:80`, `plan.md:79`/`:114`, `tasks.md:42` remove `primary_region`; the region comes only from `--primary-region`. |
| F9 (r1) — trailing-slash rule | ✅ fixed | `spec.md:67`/`plan.md:45` remove all trailing slashes, including repeated slashes; the test pins `https://api.example.test//`. |
| F10 (r1) — Vercel monorepo fallback | ✅ fixed | `plan.md:379` defines the root `vercel.json` fallback shape and requires `blocked` + user approval before switching; T5/T7 require the first build log. |

## Minimum remaining revisions

1. **F1** — Sync `status.md` T1–T4 to `[seq]` (and keep T5–T7 `[seq]`); this closes the r1 F1 residual. The authoritative `tasks.md` is already sequential.
2. **F2** — Make the startup migration conditional on a configured `DIRECT_DATABASE_URL`/`DATABASE_URL`; preserve the in-memory `buildApp` startup when neither is set, and add the regression test. Update AC-10/AC-20, the plan's `server.ts` step and the T3 note.
3. **F3** — Bump `plan.md` to `revision: 2` (and record the r2 changes) so the planner artifact matches the spec/status.

## Notes / backlog (non-blocking)

- **The r1 security and migration risks are closed:** the audit now passes on the current tree, the migration path uses the direct URL and one `pg.Client`, and the Vercel CLI cwd is pinned. The remaining work is the no-URL startup guard plus the status/plan bookkeeping.
- **Q-5/Q-14 remain user-owned:** the Terraform archive-vs-delete decision and the live development assets/domains must be confirmed; AC-19 stays `blocked` rather than accepted if the assets are absent. Do not present the approval checkpoint until F1/F2/F3 are fixed.
- **Cross-site auth is explicitly handled, not silently assumed:** CORS is exact-origin with credentials and `Vary: Origin`; `SameSite=None` requires `Secure`; the existing Origin/CSRF check remains the control; Safari/iOS ITP and default `*.vercel.app` → `*.fly.dev` blocking are documented with the first-party-subdomain recommendation.
- **The local compose path remains intact:** `compose.yaml`, `compose.smoke.yaml`, nginx and the frontend Dockerfile are unchanged; the only local regression found is the host-only no-database startup (F2), not the documented `podman compose up` path.
- **No spec, plan, tasks, status, source, workflow, Terraform, compose or git state was edited by this review; only this review artifact was written.**
