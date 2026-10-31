---
feature: coin-economy
phase: spec
iteration: 1
verdict: changes_requested
blocking: 6
nonblocking: 7
---

# Spec Review — r1

## Summary
❌ changes requested — The spec, plan and tasks faithfully cover the raw request (per-mini-cube and per-cube coins, size-dependent speed bonus ×2, persistent coins + per-user stats, guest play, multi-tab sync) and reuse the user-auth Postgres/migration path with no container impact. Six MAJOR gaps would produce wrong or non-building work: server-side `facesDestroyed` tracking is not specified (AC-9/AC-10), the `GameStats` ripple is not owned by any task, the pending world swap has no economy field despite AC-14, the join/credit async flow and an in-memory `Member.economy` are unspecified, credit atomicity is not pinned, and eight open questions are marked blocking with no approval gates. Seven minor/info items follow.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | plan.md § Module ownership / tasks.md T6 | `GameStats` is extended with required `cubesDestroyed` and `coins`, but many existing files (e.g. `src/frontend/src/ui/Hud.test.tsx`, `App.test.tsx`, `engine.test.ts`) construct `GameStats` literals with only `{ clicks, facesDestroyed }`. No task owns that ripple: T6 `files_owned` is limited to `types.ts`, `progression.ts`, `progression.test.ts`. This will break `npm run typecheck`/`npm test` mid-build. | Either make the new fields optional with defaults in `createProgression`/`adoptEconomy`, or add a task (owned by T6/T9) that updates every `GameStats` literal; record the file list in the task. | open |
| F2 | MAJOR | spec.md § Acceptance criteria AC-9, AC-10; plan.md § Architecture (hub) | For accounts the server is the authority for persisted stats, but AC-9 only credits coins + clicks on a validated explode. `facesDestroyed` (AC-6) is never incremented server-side even though a face clears during an explode, so persisted `facesDestroyed` stays stale and `economyUpdate`/`welcome` carry a wrong value. | Amend AC-9 to state that on a validated explode the server derives whether the removal cleared a face (all `N²` ids of that face removed) and, when so, increments `facesDestroyed` and includes it in the credit; add `facesDestroyed` to the AC-9 evidence and hub tests. | open |
| F3 | MAJOR | plan.md § Interfaces / contracts (PendingWorldSwap); tasks.md T8 | AC-14 requires `worldEntered` to carry `economy`, and T8 says "worldEntered pending swap carries economy", but the `PendingWorldSwap` interface only has `self: CubeState` (no `economy` field). The reducer cannot store the carried value, so the wire field is dropped or the type is inconsistent. | Add `economy: EconomyState` to `PendingWorldSwap` (or apply `msg.economy` to `state.self.economy` immediately on `worldEntered`) and update T8's reducer tests; document the choice. | open |
| F4 | MAJOR | spec.md § Open questions Q-1..Q-4, Q-5, Q-6, Q-8, Q-10, Q-11; plan.md § Open questions; tasks.md | Eight questions are labelled "Needs user approval" / "BLOCKING on default", yet tasks T1/T9 proceed with the proposed defaults and no task is marked approval-gated. The build cannot legally start, and the constants/persistence behaviour may be re-litigated mid-build. | Consolidate: mark genuinely blocking decisions (Q-1, Q-2, Q-3, Q-5) as approval-gated before T1/T6 and add explicit gates; downgrade Q-4, Q-6, Q-8, Q-10, Q-11 to "default with notice" (or resolve them as defaults) so the task graph is runnable. | open |
| F5 | MAJOR | spec.md § Security considerations (Persistence integrity); plan.md § Risks; auth/economy-repository pattern | `credit(userId, delta)` is specified as an upsert but not as an atomic increment. With the multi-tab user story (AC-17) two connections credit concurrently; a read-modify-write implementation loses updates. The concurrency test is mentioned but atomicity is not. | Pin in the spec/plan/interface that `credit` must use atomic SQL increments (`INSERT … ON CONFLICT (user_id) DO UPDATE SET coins = user_economy.coins + $delta, clicks = …, …`), never read-modify-write; add a concurrency assertion in `economy-repository.test.ts`. | open |
| F6 | MAJOR | plan.md § Interfaces / contracts (Member, HubDeps, placementFor); tasks.md T3 | `placementFor` is synchronous and must include `economy` (AC-14), and `handleCompletion` sends `worldEntered` synchronously, but `Member` only gains `cubeStartedAtMs` — no in-memory `economy`. Join loading from the repo is async, yet `handleJoin` is synchronous and sends `welcome` immediately. The plan's "fire-and-forget credit with `.then`" covers credits but not the join load or sync placement. | Add `economy: EconomyState` to `Member`; make `handleJoin` async (await `findByUserId` before creating the member/sending `welcome`); credit in `handleExplode`/`handleCompletion` updates `member.economy` from the repo result before sending `economyUpdate`. Document microtask flushing in the test strategy. | open |
| F7 | MINOR | spec.md § Acceptance criteria AC-17; plan.md § Architecture (hub) | It is unspecified whether the originating connection receives `economyUpdate` (needed to reconcile its optimistic award) or only the other account connections. | State explicitly that `economyUpdate` is sent to all account connections including the origin; update T3 and hub tests for the member set. | open |
| F8 | MINOR | plan.md § Architecture (hub); tasks.md T3 | `cubeStartedAtMs` must be captured for the completed cube's speed bonus before it is reset for the new cube, but the plan says "set on join and reset on completion" without ordering. A naive reset-first implementation zeroes the bonus. | Clarify in T3 that elapsed is read from the previous cube's `cubeStartedAtMs` (using its `gridSize` for the threshold) before `cubeStartedAtMs` is set to `now()` for the new cube. | open |
| F9 | MINOR | spec.md § Acceptance criteria AC-11, AC-17; plan.md § Risks | Multi-tab `economyUpdate` messages can arrive out of order; absolute overwrite of a newer (higher) total by a stale (lower) one regresses the displayed balance. | Either add a monotonic guard (adopt only when the server total is ≥ the local total) or note the accepted transient risk and that the next `welcome` reconciles; document the decision. | open |
| F10 | MINOR | plan.md § Interfaces / contracts (Engine); tasks.md T9 | `adoptCubeState` is optional on `GameEngine` for source compat, but the plan pins `adoptEconomy` as required. Engine fakes in existing tests will not compile unless updated. | Make `adoptEconomy` optional (mirroring `adoptCubeState`) or list the affected fakes in T9 `files_owned`; keep the real engine implementing it. | open |
| F11 | MINOR | spec.md § Acceptance criteria AC-17; tasks.md T3 | It is unspecified whether `economyUpdate` is sent to connections that have not yet joined (intro menu). Sending to them is harmless but may be processed before `welcome`. | Restrict `economyUpdate` to joined connections of the account (`playerId !== null`); document in T3. | open |
| F12 | INFO | tasks.md T9 | T9 owns four files including a new `economy.ts`/`economy.test.ts` plus `engine.ts`/`engine.test.ts`; it is large for one builder session. | Builder may split and record in the build log (precedent: user-auth F24); no spec change required. | open |
| F13 | INFO | tasks.md T13; docs/architecture/documentation.md | T13 `files_owned` lists only `glossary.md`, but the documentation pass also covers the orchestrator-owned `docs/features/README.md` row update (proposed in the build log) and a README/architecture check. | Keep the pass as proposed; ensure the build log contains the proposed `docs/features/README.md` diff and the "no change" evidence for README/architecture. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every ask in the raw request is covered by an AC or an explicit non-goal; no invented scope (F2 is a correctness gap, not a missing ask). |
| Testability | ❌ | AC-9 omits `facesDestroyed` (F2); join/credit async flow is not specified (F6); blocking questions unresolved (F4). |
| Boundaries | ✅ | Three tiers present; non-goals listed (§ Non-goals). |
| Dependency graph | ❌ | F1 (ripple ownership) and F6 (async flow) leave the graph incomplete. |
| Parallel safety | ✅ | `[P]` tasks (T6, T9, T11) have disjoint `files_owned`; no shared-file contact. |
| Security | ❌ | Credit atomicity not pinned (F5); otherwise parameterized SQL, no new secrets, server authority stated. |
| Testing | ✅ | Unit + integration tiers, commands from `AGENTS.md`, `npm run coverage` with ≥ 80% thresholds, assertion bar referenced; edge cases named. |
| Consistency | ❌ | Pending world swap lacks `economy` (F3); otherwise aligns with user-auth Postgres path and multiplayer supersession ledger. |
| Real-time | ❌ | Connection lifecycle/reconnection/multi-client/authority stated, but F3/F6/F7 leave the wire/reducer contract incomplete. |
| Containers | ✅ | AC-19: no new service/image/port/env var; only `002_economy.sql`; migration path reused. |

## Notes / backlog (non-blocking)
- Q-7 (offline/idle accrual) is correctly deferred to a follow-up; keep out of scope.
- Q-9 (spending/upgrades) is a non-goal and tracked as a future feature; consistent with vision's core loop.
- The `NUMERIC(18,2)` + `BIGINT` parsing in `PgEconomyRepository` must parse BIGINT to number (or string) in the implementation; covered by mocked-pg tests.
- Multi-tab credits accumulate per member (existing model); document in the build log as the plan already notes.