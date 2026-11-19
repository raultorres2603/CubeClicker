---
feature: coin-economy
phase: code
iteration: 2
verdict: approved
blocking: 0
reviewed: 2026-11-18
---
# Code Review — r2

## Verdict rationale

Approved. All four code-review r1 findings are resolved at HEAD (`8c76e0c`): direct engine economy coverage (F1), restored full stats equality (F2), concrete hub guards (F3), and the status-doc inconsistency (F4). The fix commits (`eece694`, `8c76e0c`) are test/docs-only; production behavior, protocol, repository, schema and container paths are unchanged. The full suite, coverage and build pass at HEAD.

This artifact supersedes the earlier `code-r2.md` snapshot from the 2026-10-30 `bfe595d` pass (still in git history at `9386c2e`); that snapshot reported pre-fix coverage and is not the current HEAD.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `engine.test.ts` 1889–1900: one mini removal → `clicks: 1`, `facesDestroyed: 0`, `coins: 0.1`; `economy.ts` 100% coverage. |
| AC-2 | ✅ | `engine.test.ts` 1914/1930: fast completion `coins: 12.4`, slow `coins: 7.4`, `cubesDestroyed: 1`. |
| AC-3 | ✅ | `engine.test.ts` 1946/1964/1980/1998: inclusive boundary at grid 3 `15_000` ms → `15.4` vs `15_001` → `10.4`; grid 7 `35_000` → `39.4` vs `35_001` → `34.4`. |
| AC-4 | ✅ | Same boundary tests plus `thresholdSeconds(gridSize) = gridSize * 5` literal expectations (15 s / 35 s); no module-constant derivation inside the economy block. |
| AC-5 | ✅ | `Hud.test.tsx` coins line retained. |
| AC-6 | ✅ | `session.test.ts`/`hub.test.ts` account join loads persisted economy; `adoptEconomy` tests cover absolute adoption. |
| AC-7 | ✅ | Existing guest-persistence tests retained. |
| AC-8 | ✅ | `engine.test.ts` 2014: `cubesDestroyed` 1 → 2 across a real level advance, stats carried. |
| AC-9 | ✅ | `hub.test.ts` credits on valid explode, face-clear increments, no credit on invalid. |
| AC-10 | ✅ | `hub.test.ts` fast/slow/boundary completion credits. |
| AC-11 | ✅ | `session.test.ts`, `server-state.test.ts` `economyUpdate`. |
| AC-12 | ✅ | `hub.test.ts` forged payloads ignored; server clock used. |
| AC-13 | ✅ | `hub.test.ts` guest no persist/no broadcast. |
| AC-14 | ✅ | `protocol.test.ts` both workspaces. |
| AC-15 | ✅ | `protocol.test.ts` both workspaces. |
| AC-16 | ✅ | `session.test.ts` plus `engine.test.ts` 2070/2090 `adoptEconomy` higher/lower and continued earning. |
| AC-17 | ✅ | `hub.test.ts` multi-connection broadcast including origin. |
| AC-18 | ✅ | `session.test.ts`, `hub.test.ts` reconnect/resume. |
| AC-19 | ✅ | Container-path diff `eece694^..HEAD` empty. |
| AC-20 | ✅ | `npm run coverage`: backend 96.44/90.31/99.59/96.44; frontend 97.08/96.64/98.19/97.08; thresholds ≥ 80. |
| AC-21 | ✅ | `engine.test.ts` 2053: guest local earning `clicks: 2`, `coins: 0.2`, no adoption/transport. |

## Findings disposition

| # | Severity | Status | Evidence |
| --- | --- | --- | --- |
| F1 | MAJOR | Fixed | 11 direct engine economy tests with literal expected values: per-mini, per-cube fast/slow, grid-3 and grid-7 inclusive boundaries, cubesDestroyed across a level advance, guest ledger, and `adoptEconomy` higher/lower + continuation. No `COINS_PER_*`/`thresholdSeconds` derivation inside the economy block. |
| F2 | MAJOR | Fixed | The six named stats paths (`engine.test.ts:136, 191, 282, 618, 762, 1343`) now assert whole `stats` objects; an audit found all 13 whole-stats `toEqual` assertions and 2 identity checks, with no stats-touching path left partially asserted and no assertion deleted/weakened in `eece694`. |
| F3 | MINOR | Fixed | `grep -c toBeDefined src/backend/src/game/hub.test.ts` → 0; named lookups use the typed `onlyType` helper (`hub.test.ts:362–371`, uses 1855/1882/1949/1969/1988/2031/2098); the remaining `find` at 2112 is a negative `toBeUndefined()` check. |
| F4 | MINOR | Fixed | `status.md:30` records Q-1/Q-2/Q-3/Q-5 resolved with the approved defaults (0.1 / 5 / gridSize×5 / persisted stats scope); Q-4/Q-6/Q-8/Q-10/Q-11 defaults; Q-7 deferred; Q-9 non-goal. |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → backend 38 files / 1,601 tests; frontend 83 files / 2,706 tests; exit 0.
- `npm run coverage` → backend 96.44/90.31/99.59/96.44; frontend 97.08/96.64/98.19/97.08; exit 0. `economy.ts` 100 all, `hub.ts` 91.12/88.69/98.48/91.12, `engine.ts` 99.47/100/100/99.47, `progression.ts` 100 all.
- `npm run build` → exit 0; bundle budget OK.
- Targeted: `engine.test.ts` 115/115; `hub.test.ts` 194/194.
- Coverage configs unchanged (80s thresholds, `all: true`, only composition roots `main.tsx`/`server.ts` + tests excluded).
- `eece694` touched only `engine.test.ts`, `hub.test.ts` and the build log; `8c76e0c` touched the build log only; `git status -- src tests compose...` clean; container-path diff `eece694^..HEAD` empty.
- Docs: glossary already contains `coins` (line 28); no behavior change → no doc-pass update required; `docs/features/README.md` untouched (orchestrator-owned).
- `bfe595d` chronology: ancestor of HEAD (2026-10-30 09:00); the r1 artifact entered history later in bulk `9386c2e` (2026-10-31) but its content matches the pre-`bfe595d` tree (it reports 0 `adoptEconomy` matches). The builder's note is accurate — chronology only; HEAD was verified independently.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Atomic SQL increments, parameterized SQL, no new secrets, server authority over timing; forged payloads ignored. |
| Quality | ✅ | No production-code change in the fix commits; no scope creep; container/doc gates pass; coverage exclusions remain justified. |
| Testing | ✅ | F1/F2/F3 resolved; all 21 ACs evidence-backed; no assertion weakening. |
| Container | n/a | No container path changed. |

## Residual backlog / open questions

- The build-log audit prose slightly overstates the upgrades block (calls the 1563 `toEqual` an identity check and says all upgrades tests pair `coins`/`cubesDestroyed`, while two upgrades assertions are coins-only). Out of coin-economy scope; no behavioral gap.
- `status.md:31` still says "fixes in progress" while the loop log records them fixed; orchestrator-owned and expected to be updated with the r2 outcome.
- The README feature-index row still shows `building`/2026-10-30; acceptance-time orchestrator update pending.
- Q-7 deferred, Q-9 non-goal, out-of-order `economyUpdate` accepted as a v1 transient risk.
