---
feature: db-schema-bootstrap-and-expiry-cleanup
phase: spec
iteration: 2
verdict: changes_requested
blocking: 1
nonblocking: 5
reviewed: 2026-11-24
---
# Spec Review — r2

## Summary

❌ **changes requested** — 1 BLOCKER, 0 MAJOR, 3 MINOR, 2 INFO. Revision 2 closes r1's F1–F14: the additive `debug` seam is fully specified (interface, `createLogSink`, both existing doubles) and owned by T1; the five-table normative DDL matches `schema.sql` in every table's types/defaults/NOT NULL/PK/FK/unique/indexes (the independent `user_economy`/`schema_migrations` creation order differs and is immaterial to the catalog equivalence), and AC-2/AC-3/AC-6 prove catalog equivalence and real inserts (including after recreation); AC-13 pins the startup trace; the container, docs and `.env*` evidence gaps are addressed; and both partial supersessions are accurately scoped.

One new build-order defect remains: T6 is instructed to remove `runStartupMigrations` from `migrate-runner.ts` while the T8-owned `server.ts` still imports and calls it, so T6's root `npm run typecheck` fails and T6 cannot pass its verify without an unowned edit to `server.ts`; T8 (the only owner of `server.ts`) depends on T6, so the task graph dead-ends. The remaining items are traceability/evidence nits, not redesigns.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| R2-F1 | BLOCKER | `tasks.md` T6 (`:57-63`; notes `:62`, verify `:60`), T8 (`:73-79`; `files_owned` `:75`); `plan.md` § Startup phase (`:237`) and File inventory (`:334-335`); `src/backend/src/server.ts:4,19`; `src/backend/tsconfig.json:11-12` | T6's normative change is "`runStartupMigrations` is removed" and its verify runs the root `npm run typecheck`; but `server.ts` (owned only by T8) still has `import { runStartupMigrations } from './db/migrate-runner.js'` and calls it at line 19. `src/backend/tsconfig.json` includes `src/**/*.ts` and excludes only tests/`dist`, so removing the export makes `tsc --noEmit` fail with TS2305 at T6. T8 depends on T6 and is the only task allowed to rewire `server.ts`, so T6 cannot pass its own gate without an unowned edit (violating `files_owned`) or abandoning the stated removal. | Keep `runStartupMigrations` through T6 (either its current implementation or a deprecated delegating wrapper is not safe here — a delegating wrapper would create a `migrate-runner`↔`startup` import cycle; keeping the implementation is simplest) and move its removal plus the `migrate-runner.ts`/`migrate-runner.test.ts` file ownership to T8, which rewires `server.ts`. Update T6/T8 `files_owned`, T6/T8 verify (T8 must run `typecheck` and `migrate-runner.test.ts`), plan § Startup phase/File inventory, and the supersession wording. If removal must stay in T6, `server.ts` must join T6's `files_owned` and T8's server edit must move with it — but the first option preserves the current split. | open |
| R2-F2 | MINOR | `spec.md` AC-10 (`:83`), AC-11 (`:84`); `tasks.md` T6 acceptance (`:61`), T8 acceptance (`:77`), T8 notes (`:78`) | Both ACs cite `server.test.ts` as evidence, but T6 is the only task accepting them and T6 cannot run `server.test.ts` (T8 creates it, and T8 depends on T6). T8's acceptance lists only AC-21/AC-22/AC-23; its notes mention "every failure/skip/success path", which could cover the no-database listen and lock-stage no-listen halves, but the traceability is not explicit. A builder can mark AC-10/AC-11 complete at T6 without the server evidence. | Mark T6's AC-10/AC-11 claims as partial and add AC-10/AC-11 to T8's acceptance/notes: `server.test.ts` asserts no-database → listen with in-memory repositories and lock-stage `DatabaseStartupError` → no `listen`, alongside AC-22's bootstrap-stage failure. Alternatively split each AC's startup/server halves. | open |
| R2-F3 | MINOR | `spec.md` § Required schema contract table (`:120`) vs the normative DDL (`:160-175`); AC-7 (`:77`); § Log contract `db_schema_table_outdated` (`:216`) | The table lists `user_economy` columns as `... upgrades, lootboxes, keys, parts, appearance, customization_version, economy_revision, last_seen_at, updated_at`, while the normative DDL places `economy_revision` before `upgrades`. The log contract says `missingColumns` is comma-joined in "contract order", so the order of the TypeScript `columns` array is ambiguous for `user_economy`; AC-7 only exercises one missing column (`locked_until`), so a multi-column order mismatch would not be caught. | Align the table order with the normative DDL (or define the TypeScript `columns` array as the DDL order and use that for `missingColumns`); optionally add a multi-missing-column assertion so "contract order" is pinned. | open |
| R2-F4 | MINOR | `spec.md` AC-26 (`:108`); `tasks.md` T10 verify (`:92`); `src/frontend/src/docs/links.test.ts:1-12,20-28` | The AC requires "every relative link resolves" in the edited docs (`README.md`, `observability.md`, `deployment.md`, `vercel-render-neon.md`, `containerization.md`), but the cited test is explicitly scoped to `docs/architecture/documentation.md` ("intentionally scoped ... not a full documentation crawler"). The other edited docs' links are not verified by the listed evidence; `docs/architecture/documentation.md` itself defers automated link checking (docs-on-feature-acceptance Q-3), so a manual check is acceptable but must be stated. Relatedly, the T10 README greps assert the variable/event names but not the required defaults. | Either scope AC-26's link clause to `documentation.md` or add a T10 manual link-resolution check over the five edited docs to the verify list; add a grep/assertion for the README defaults (for example `true`, `true`, `3600000`) so the AC's "with defaults" wording is evidenced. | open |
| R2-F5 | INFO | `spec.md` AC-5 (`:75`); `plan.md` § Bootstrap algorithm (`:38-46`); `src/backend/src/db/migrate.ts:69-71` | AC-5 says "A second run on the complete schema issues zero `CREATE TABLE` … statements", but a second **full startup** run always issues the migration runner's `CREATE TABLE IF NOT EXISTS schema_migrations` before the ledger read. The AC's evidence (`schema-bootstrap-postgres.test.ts`, a recording client) implies a second `runSchemaBootstrap` run, not a full startup; the wording can mislead a builder into wrapping the full startup and failing. | Say explicitly "a second `runSchemaBootstrap` run on the complete schema" in AC-5 and § Bootstrap algorithm; keep the full startup path out of the zero-DDL assertion. | open |
| R2-F6 | INFO | `spec.md` AC-25 (`:107`); `tasks.md` T9 verify (`:84,86`) | The compose check asserts the three new keys and their values, plus ports/volumes/`depends_on`/image/no-healthcheck, but not that the backend `environment` map gained **exactly** the three keys; "exactly the three environment keys" is covered only by the human review of `git diff --unified=0 -- compose.yaml render.yaml`, not by an assertion. | State the diff review as the evidence for exactness (as the T9 notes already do), or add an environment-key count/allow-list assertion to the node check. No design change. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every raw-request ask is covered: post-migration table presence/creation with structured logs, and expired verification-token deletion. Non-goals explicitly exclude auto-`ALTER`/`DROP`, account/session cleanup, a separate service/image/route/metric/deploy step, and schema evolution. The two supersessions are recorded with retained behavior. |
| Testability | ❌ | The ACs themselves are binary and single-behavior, but R2-F1 makes T6's verify unpassable as written; R2-F2 leaves AC-10/AC-11 server evidence unassigned at the task that accepts them; R2-F4 leaves part of AC-26's link/default evidence unproven by the cited commands. |
| Boundaries | ✅ | Three tiers present; Ask-first covers new dependencies, new services/deploy steps, contract changes beyond the migrations, metrics/routes and DDL grants; Never covers auto-`ALTER`/`DROP`, account/session deletion, pooled DDL, logging secrets/SQL, test weakening, `.env*` and `docs/features/README.md`. |
| Dependency graph | ✅ | Acyclic; every dependency points at an earlier task; T1/T2/T3 start in parallel; T4/T5/T7 are disjoint after T1; T6→T8→T9→T10→T11 is serialized. R2-F1 is a sequential ownership/verify break inside T6→T8, not a cycle. |
| Parallel safety | ✅ | `files_owned` is disjoint across all 11 tasks; no `[P]` pair shares a file. T1 owns `logging.ts`, `logging.test.ts`, `hub.test.ts` and `shutdown.test.ts` exclusively; T7 owns `shutdown.ts`/`shutdown-before-close.test.ts`; T8 owns `server.ts`/`server.test.ts`. R2-F1 is not a parallel collision, but it is the files_owned violation a builder would be forced into if following T6 literally. |
| Security | ✅ | No secrets/SQL/rows/emails/tokens in the new events; `errorType` + optional string `code` are the diagnostic surface; DDL/catalog queries are constants with the table array bound as `$1::text[]`; cleanup reuses the parameterized `DELETE`; no public trigger; lock wait capped at 30 s; Q-2 leaves DDL grants user-owned; missing-index drift is an explicit limitation (D13). |
| Testing | ❌ | The bar is correct (unit + real-Postgres integration + containerized smoke; exact values; no banned matchers/snapshots; ≥ 80% statements/branches/functions/lines per workspace via `npm run coverage`; `server.ts`'s pre-existing composition-root exclusion is justified and behaviorally tested). But R2-F1 means T6's gate is red as written, and R2-F2/R2-F4 leave evidence gaps. |
| Consistency | ❌ | Plan/tasks say `runStartupMigrations` is removed at T6 while `server.ts` still imports it (R2-F1); the `user_economy` table order differs from the normative DDL (R2-F3). Otherwise the design is consistent with `AGENTS.md`, the Render/Neon target, the 30-metric observability catalog and the containerization contract. |
| Real-time | ✅ | No shared/cross-client value, room, economy, leaderboard, presence or WS-protocol change. The schema phase completes before `listen`, so `/ws` is not advertised against an incomplete schema; startup failure follows the existing reconnect/banner path; cleanup is a single atomic `DELETE` and does not invalidate sessions or change `verified`. |
| Containers | ✅ | No new service, image, port, volume, healthcheck or deploy step; three backend env pass-throughs with safe defaults; `render.yaml` documents the same non-secret values; `GET /healthz` and the `HEALTHCHECK` are unchanged; `/ws` remains on 8080; images stay provider-neutral; `podman compose up` remains the single local command. |
| Documentation | ✅ | T10 covers the root `README.md` and the four affected architecture docs, runs the docs link test, and leaves `docs/features/README.md` orchestrator-owned with a proposed row diff only. R2-F4 asks for a scoped or manual link check and the README defaults assertion. |
| Risks | ✅ | The plan's risks cover contract drift, missing DDL role, concurrent starts, dropped-table data loss, outdated columns, missing-index drift, stuck lock, cleanup scan, Render spin-down, overlap/shutdown, log leakage, skipped DB suites and future schema drift. R2-F1 is the one unlisted build-order risk. |

## Previous round verification (r1 → r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) — unowned `LogSink` debug seam | fixed | `spec.md` AC-1; `plan.md` § Logging extension (`:100-123`); T1 `files_owned` (`:19`) owns `logging.ts`, `logging.test.ts`, `game/hub.test.ts`, `observability/shutdown.test.ts`; the doubles are at `src/backend/src/game/hub.test.ts:4779-4797` and `src/backend/src/observability/shutdown.test.ts:18-28`; `spec.md` § Supersessions records the partial `runtime-observability` AC-3 supersession. |
| F2 (r1) — missing DDL/defaults | fixed | `spec.md` § Required schema contract (`:123-181`) is the full DDL; its content matches `src/backend/src/db/schema.sql:5-57` (same types/defaults/NOT NULL/PK/FK/unique/indexes; the independent `user_economy`/`schema_migrations` creation order differs and is immaterial). AC-2 runs catalog equivalence (`data_type`/`is_nullable`/`column_default`, PK/FK/unique/index definitions); AC-3 proves `PgUserRepository`/`PgSessionRepository`/`PgVerificationTokenRepository` inserts and a raw `user_economy` insert; AC-6 proves a post-recreate token insert. |
| F3 (r1) — startup traces unasserted | fixed | `spec.md` AC-13 (`:86`) pins the lock/wait, migration and startup-completed events with exact fields/levels; `plan.md:59` and T6 notes repeat the contract. |
| F4 (r1) — container/docs/.env evidence | fixed | AC-25 (`:107`) now runs the `frontend-prod` build + `npm run smoke` and machine-checks the compose service/port/volume/`depends_on`/healthcheck shape plus the Render values; T9 `verify` (`:84`) includes both node checks, the smoke recipe and `git diff --exit-code` for Dockerfiles/deploy.yml; T10 `verify` (`:92`) greps all three variables and all 18 events; AC-27 (`:109`) replaces the vacuous `.env*` git check with the stated manual boundary. T9 notes record `js-yaml` as the existing transitive dependency. |
| F5 (r1) — dependency overview | fixed | `tasks.md:3` now matches the per-task `depends_on` blocks (`T1 → {T4, T5, T7}`; `T2 → T4`; `T3 → {T6, T8, T9}`; `T4 → T6`; `{T3, T5, T6, T7} → T8`; `T8 → T9 → T10 → T11`). |
| F6 (r1) — overlap/cadence wording | fixed | AC-15 (`:91`) states "`intervalMs` after the previous run settles"; AC-19 (`:95`) triggers the guard via a direct `runOnce()` during a deferred run; plan § Cleanup algorithm (`:61-69`) matches. |
| F7 (r1) — AC-18 dual assignment | fixed | Split into AC-20 (shutdown `beforeClose`) and AC-21 (server wiring), owned by T7 and T8 respectively. |
| F8 (r1) — coverage exclusion wording | fixed | `spec.md` D14 (`:52`), AC-27 (`:109`), plan Key decision 15 (`:371`) and T8 notes state the pre-existing `testing-criteria` composition-root exclusion and the behavioral `server.test.ts` compensation. |
| F9 (r1) — index/constraint drift | fixed | D13 (`:51`), § Required schema contract (`:199`), non-goals (`:236`) and plan risk (`:387`) record the limitation and the migrations/CI repair path. |
| F10 (r1) — status/supersession bookkeeping | fixed | `spec.md` § Supersessions Bookkeeping (`:340`) notes `vercel-fly-neon-deployment` is blocked at T7 with T1–T6 done; `status.md`'s stale task-board line remains orchestrator-owned. |
| F11 (r1) — Render downtime wording | fixed (plan) | T10 notes (`:94`) reconcile `vercel-render-neon.md:35` (old/new overlap) with `deployment.md:95` (no zero-downtime for clients); AC-26 (`:108`) records the requirement. |
| F12 (r1) — pooled fallback caveat | fixed | Q-5 (`:311`) and § Security "Startup URL fallback" (`:257`) state the direct/session-capable URL requirement; plan Key decision 18 records no hostname sniffing. |
| F13 (r1) — empty-string config | fixed | AC-14 (`:90`) includes `''` for all three variables; T3 notes repeat. |
| F14 (r1) — task sizing | fixed | T2/T4/T5/T8 notes allow splitting the unit and real-Postgres suites and recording the split in the build log. |

## Acceptance-criteria traceability

All 27 ACs are unique, binary-worded and mapped to at least one task; every task maps to at least one AC.

| AC | Task(s) | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | T1 | `logging.test.ts` adapter/level 20; typecheck; `hub.test.ts`/`shutdown.test.ts` | Mapped |
| AC-2 | T2 | `schema-contract.test.ts`; `schema-contract-postgres.test.ts` | Mapped |
| AC-3 | T4 | `schema-bootstrap-postgres.test.ts` empty schema + repository inserts | Mapped |
| AC-4 | T4 | `schema-bootstrap.test.ts` recording sink | Mapped |
| AC-5 | T4 | `schema-bootstrap-postgres.test.ts` no-op re-run | Mapped; R2-F5 wording |
| AC-6 | T4 | `schema-bootstrap-postgres.test.ts` drop/recreate + token insert | Mapped |
| AC-7 | T4 | `schema-bootstrap-postgres.test.ts` outdated column | Mapped; R2-F3 order |
| AC-8 | T4 | `schema-bootstrap.test.ts` create failure | Mapped |
| AC-9 | T6 | `startup.test.ts` statement order | Mapped |
| AC-10 | T6 (+T8 implicit) | `startup.test.ts`; `server.test.ts` | Mapped; R2-F2 |
| AC-11 | T6 (+T8 implicit) | `startup.test.ts`; `server.test.ts` | Mapped; R2-F2 |
| AC-12 | T6 | `startup.test.ts` bootstrap-disabled | Mapped |
| AC-13 | T6 | `startup.test.ts` exact trace entries | Mapped |
| AC-14 | T3 | `lifecycle-config.test.ts` defaults/bounds/empty/invalid | Mapped |
| AC-15 | T5 | `verification-cleanup.test.ts` fake timers | Mapped |
| AC-16 | T5 | `verification-cleanup-postgres.test.ts` expired-only delete | Mapped |
| AC-17 | T5 | `verification-cleanup-postgres.test.ts` concurrent idempotence | Mapped |
| AC-18 | T5 | `verification-cleanup.test.ts`; unchanged `app.test.ts` | Mapped |
| AC-19 | T5 | `verification-cleanup.test.ts` deferred `runOnce()` | Mapped |
| AC-20 | T7 | `shutdown-before-close.test.ts`; `shutdown.test.ts` | Mapped |
| AC-21 | T8 | `server.test.ts` wiring/skip paths | Mapped |
| AC-22 | T8 | `server.test.ts` startup failure/exit/no-listen | Mapped |
| AC-23 | T4, T5, T6, T8 | exact-field tests; T11 source audit | Mapped |
| AC-24 | T11 | `git diff --exit-code` app/metrics; unchanged `app.test.ts`/`metrics.test.ts` | Mapped |
| AC-25 | T9 | YAML shape checks; smoke transcript; Dockerfile/deploy diff | Mapped; R2-F6 exactness |
| AC-26 | T10 | docs greps; docs link test; `docs/features/README.md` status | Mapped; R2-F4 scope |
| AC-27 | T11 | build log with lint/typecheck/test/coverage/build/smoke; `.env*` manual confirmation | Mapped |

## Blocking revision (minimum)

1. **R2-F1** — Fix the T6/T8 sequencing so `runStartupMigrations` is not removed while `server.ts` still imports it. Preferred: keep it through T6 and move its removal (with `migrate-runner.ts`/`migrate-runner.test.ts` ownership and the T8 verify entries) to T8. Update `tasks.md`, `plan.md` § Startup phase/File inventory and the supersession wording together. Once this is fixed, no BLOCKER or MAJOR remains; R2-F2…R2-F6 can be fixed in the same revision or accepted as non-blocking.

## Notes / backlog (non-blocking)

- `status.md` still says "(empty until tasks.md exists)" while `tasks.md` exists. It is orchestrator-owned; the spec's § Supersessions Bookkeeping acknowledges it, and the orchestrator should update the task board on transition (r1 F10 context).
- The docs link test (`src/frontend/src/docs/links.test.ts`) is intentionally scoped to `docs/architecture/documentation.md`; R2-F4 asks for a scoped AC or a manual check over the edited docs, consistent with `docs/architecture/documentation.md`'s deferred automated-link-checking statement.
- This review edited no spec, plan, task, status, source, config, compose, workflow or git state; only this review artifact was written.
