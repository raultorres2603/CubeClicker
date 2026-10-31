---
feature: coin-economy
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 4
---

# Spec Review — r2

## Summary
✅ approved — Revision 2 addresses all r1 findings F1..F13: `facesDestroyed` server-side tracking (AC-9), optional `GameStats` fields with ripple ownership noted (F1), `PendingWorldSwap.economy` (F3), consolidated approval-gated open questions with T0 gate (F4), atomic SQL credit (F5), async join + `Member.economy` (F6), originating-connection broadcast (F7), server-clock ordering (F8), accepted out-of-order risk (F9), optional `adoptEconomy` (F10), joined-connection-only broadcast (F11), T9 sizing note (F12), T13 docs-pass evidence (F13). No new BLOCKER or MAJOR found; the spec/plan/tasks are testable, internally consistent, and consistent with the accepted user-authentication and multiplayer-cube-sync predecessors. Four INFO/MINOR notes follow.

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| N1 | INFO | docs/features/coin-economy/status.md § Blockers / open questions | Status says "none", but the spec lists Q-1/Q-2/Q-3/Q-5 as approval-gated before T1/T6. (Minor doc inconsistency; does not affect spec quality.) | Update status to note the approval-gated questions before build, mirroring user-authentication's status. | open |
| N2 | MINOR | spec.md § Security considerations (Persistence integrity) | The `credit` interface is `Partial<EconomyState>`, but the spec/plan do not state that omitted fields default to 0 in both the in-memory and Pg implementations. A naive impl could pass `undefined` into SQL. | Add a one-line note in T2 (or the interface) that `credit` coalesces missing delta fields to 0 in all implementations. | open |
| N3 | MINOR | plan.md § Architecture (hub) / tasks.md T3 | No error-handling contract is specified for a failed `credit` (DB error): fire-and-forget credit with no retry/reconciliation beyond the next welcome. | Document in T3 that a failed credit logs and skips the `economyUpdate` broadcast; the next successful credit or `welcome` reconciles. (Or accept as implicit.) | open |
| N4 | INFO | spec.md § Open questions Q-4/Q-6/Q-8/Q-10/Q-11 | Default-with-notice items are resolved as proposed defaults; ensure the build log records which defaults were taken, per the "default with notice" convention. | Record in the build log at T_final. | open |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every ask in the raw request (per-mini-cube and per-cube coins, size-dependent speed bonus ×2, persistent coins + per-user stats, guest play, multi-tab sync) is covered by an AC or an explicit non-goal. |
| Testability | ✅ | Each AC is binary-testable with concrete evidence files; AC-3/AC-4 name boundaries (exact threshold qualifies; grid 3→15 s, 7→35 s); AC-9 includes face-clear detection. |
| Boundaries | ✅ | Three tiers present (✅/⚠️/🚫); non-goals listed (§ Non-goals). |
| Dependency graph | ✅ | Acyclic; every AC mapped in the traceability table; async join (F6) and ripple ownership (F1) now reflected; tasks sized to one builder session (T9/T12 noted). |
| Parallel safety | ✅ | `[P]` tasks (T6, T9, T11) have disjoint `files_owned`; no shared-file contact across parallel tasks. |
| Security | ✅ | Atomic SQL increments pinned (F5); parameterized SQL; no new secrets; server authority over every economy value; forged timing/level values cannot change the bonus (AC-12). |
| Testing | ✅ | Unit + integration tiers; commands from `AGENTS.md`; `npm run coverage` with ≥ 80% thresholds; assertion-quality bar referenced; edge cases named (boundary, concurrency, out-of-order). |
| Consistency | ✅ | Aligns with accepted user-authentication (Postgres/migration path) and multiplayer-cube-sync (supersession ledger); no contradiction with `AGENTS.md`. |
| Risks | ✅ | Async persistence, float drift, multi-tab double credit, speed-bonus clock skew, out-of-order delivery all documented with mitigations. |
| Real-time | ✅ | Connection lifecycle, reconnection, multi-client behavior, server authority, and the accepted out-of-order transient risk (F9) are defined; identity/accounts conflicts flagged via user-auth supersession. |
| Containers | ✅ | AC-19: no new service/image/port/env var/Dockerfile/compose change; only `002_economy.sql`; migration path reused; T_final container diff gate. |

## Previous round verification (r1 → r2)
| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (MAJOR) — `GameStats` ripple ownership | fixed | spec.md § Testing strategy + AC-6 note "GameStats's new fields (`coins`, `cubesDestroyed`) are optional and default to 0 at read sites"; tasks.md T6 note (F1) records the affected test files (`App.test.tsx`, `engine.test.ts`, `session.test.ts`, `Hud.test.tsx`, `gestures.test.ts`, `keyboard.test.ts`) and assigns updates to the owning tasks. |
| F2 (MAJOR) — server-side `facesDestroyed` tracking | fixed | spec.md AC-9 now credits `facesDestroyed` on face clear (all `N²` ids removed); plan.md § Architecture (hub) T3 implements face-clear detection; tasks.md T3 acceptance includes AC-9. |
| F3 (MAJOR) — `PendingWorldSwap` lacks `economy` | fixed | plan.md § Interfaces / contracts `PendingWorldSwap` gains `economy: EconomyState`; tasks.md T8 adds it; reducer tests cover the pending-swap economy. |
| F4 (MAJOR) — blocking open questions ungated | fixed | spec.md § Open questions consolidates Q-1/Q-2/Q-3/Q-5 as approval-gated (BLOCKING) and Q-4/Q-6/Q-8/Q-10/Q-11 as default-with-notice; tasks.md T0 is the explicit approval gate before T1/T6. |
| F5 (MAJOR) — credit atomicity not pinned | fixed | spec.md § Security considerations pins atomic SQL increments (`INSERT … ON CONFLICT … DO UPDATE SET … = user_economy.<col> + $delta`); plan.md § Interfaces shows the SQL; tasks.md T2 requires atomic increments + concurrency assertion. |
| F6 (MAJOR) — async join + in-memory `Member.economy` unspecified | fixed | plan.md § Interfaces adds `economy: EconomyState` to `Member` and makes `handleJoin` async (await `findByUserId`); tasks.md T3 documents microtask flushing. |
| F7 (MINOR) — originating connection receives `economyUpdate` | fixed | spec.md AC-17 states `economyUpdate` goes to all account connections including the origin; plan/tasks reflect the member set. |
| F8 (MINOR) — `cubeStartedAtMs` reset ordering | fixed | tasks.md T3 specifies elapsed is read from the previous cube's `cubeStartedAtMs`/`gridSize` before reset; plan § Risks repeats the ordering. |
| F9 (MINOR) — out-of-order `economyUpdate` regression | fixed | spec.md AC-11 + § Real-time impact document the accepted transient risk and "no monotonic guard in v1"; `adoptEconomy` adopts absolute totals. |
| F10 (MINOR) — `adoptEconomy` required breaks fakes | fixed | plan.md § Interfaces marks `adoptEconomy?` optional (mirroring `adoptCubeState`); tasks.md T9 keeps the real engine implementing it. |
| F11 (MINOR) — `economyUpdate` to non-joined connections | fixed | spec.md AC-17 restricts to joined connections (`playerId !== null`); tasks.md T3 restricts broadcast accordingly. |
| F12 (INFO) — T9 task size | fixed (note) | tasks.md T9 note allows splitting `economy.ts`/`economy.test.ts` from `engine.ts`/`engine.test.ts` with build-log record (precedent user-auth F24). |
| F13 (INFO) — T13 docs-pass ownership | fixed (note) | tasks.md T13 records the proposed `docs/features/README.md` row diff and "no change" evidence for README/architecture in the build log; glossary.md owned by T13. |

## Notes / backlog (non-blocking)
- Q-7 (offline/idle accrual) remains correctly deferred to a follow-up; Q-9 (spending/upgrades) remains a non-goal.
- `NUMERIC(18,2)` + `BIGINT` parsing in `PgEconomyRepository` must parse to number (or string) in the implementation; covered by mocked-pg tests.
- Multi-tab credits accumulate per member (existing model); totals accumulate via atomic SQL increments.
- N1 (status doc inconsistency) should be corrected before build; not a spec defect.
- Out-of-order `economyUpdate` accepted as transient risk in v1 (no monotonic guard); next `welcome`/`economyUpdate` reconciles.