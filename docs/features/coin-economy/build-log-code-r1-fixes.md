# Build log — code review r1 fixes (F1–F3, test adequacy)

Task: coin-economy code-review r1 follow-up (2026-11-18)
Branch: `feat/remote-spaceship-customization` (deliberate unblocking detour; no push)
Files changed:
- `src/frontend/src/game/engine.test.ts`
- `src/backend/src/game/hub.test.ts`
- `docs/features/coin-economy/build-log-code-r1-fixes.md` (this log)

## What changed & why (sketch)

1. Pin every F1 economy expectation to literal numbers (0.1 / 5 / 10 / 15 s / 35 s) instead of values derived from the module under test; add the missing grid-7 just-over boundary, a two-cube `cubesDestroyed` increment, and adoptEconomy "keeps progression/board, earning continues" cases.
2. Convert the six review-named engine stats paths to whole-`stats` equality so `coins`/`cubesDestroyed` are pinned by object, not by adjacent field lines.
3. Replace the remaining `find(...) as ServerMessage` lookups in the F3-adjacent hub tests with the typed `onlyType(...)` narrowing helper (exactly one frame, typed payload).
4. No production code touched; no dependency/schema/container change.

## State at HEAD (why a second pass was needed)

A first pass at these findings exists in history: commit `bfe595d` (`test(coin-economy):
address code review r1 F1-F4`, log `build-log-codefix2.md`, 2026-10-30). It added the
economy describe block, paired `coins`/`cubesDestroyed` assertions and `update.type` guards.
The committed `reviews/code-r1.md` reflects the pre-fix tree (it records "adoptEconomy has 0
matches in engine.test.ts") even though the file itself was committed later, so the findings
were re-verified against the current tree and the residual weaknesses were closed here:

- F1 expectations were derived from `COINS_PER_MINI_CUBE`/`COINS_PER_CUBE`/`thresholdSeconds`
  imported from the module under test, so an economy-constant regression would have kept the
  engine boundary tests green (only `economy.test.ts` would fail).
- No grid-7 *just-over* boundary; no multi-cube `cubesDestroyed` increment; `adoptEconomy`
  did not assert that progression/board are untouched or that earning continues from the
  adopted total.
- F3's `expect(x.type)` guards were concrete, but two lookups still dereferenced a
  `find(...)` result typed only by an unchecked `as ServerMessage` cast.

## Finding-by-finding disposition

| # | Severity | Disposition | Evidence |
| --- | --- | --- | --- |
| F1 | MAJOR | **Fixed.** Direct `engine.test.ts` cases with literal expected values: per-mini (one removal → `clicks: 1`, `coins: 0.1`, no `cubesDestroyed`), per-cube fast (`coins: 12.4` = 24 × 0.1 + 5 × 2, `cubesDestroyed: 1`) and slow (`coins: 7.4` = 24 × 0.1 + 5), speed-bonus boundary at grid 3 (`15_000` ms qualifies → `15.4`; `15_001` misses → `10.4`) and grid 7 (`35_000` → `39.4`; `35_001` → `34.4`), `cubesDestroyed` 1 → 2 across a real level advance with stats carried, guest local earning (`clicks: 2`, `coins: 0.2`, no adoption), and `adoptEconomy` with higher (`99.99/5/2/3`) and lower (`0.05/0/0/0`) snapshots, asserting the exact 4-field stats object, unchanged `levelIndex`/board identity, and continued earning (`0.15` after the next mini-cube). | `engine.test.ts` § “engine economy awards” / “adoptEconomy” (11 tests); targeted run 115/115. |
| F2 | MAJOR | **Fixed.** The six review-named paths (initial stats, referential-stability click, click counters, face-clear, sixth-face completion, authoritative adoption) now assert the whole `stats` object with concrete values. An audit across every `stats.` assertion in `engine.test.ts` confirms the remaining stats-touching paths keep paired exact `coins`/`cubesDestroyed` assertions (or identity checks); no assertion was weakened. | Audit script output in “Evidence”; `git diff` on the six paths. |
| F3 | MINOR | **Fixed.** `grep -c 'toBeDefined' hub.test.ts` → 0. The review's named spots use `onlyType(...)` (asserts exactly one frame of the type and returns the narrowed payload); the remaining economy cast lookup in the idle-accrual test was converted too. No other assertion changed. | `hub.test.ts` stateSync/memberJoined/idle-economy tests; targeted run 194/194. |
| F4 | MINOR | **Already resolved** (not a code finding). `status.md` § Blockers/open questions records Q-1/Q-2/Q-3/Q-5 as resolved with the approved defaults; `status.md` is orchestrator-owned and was not edited by this task. | `docs/features/coin-economy/status.md` blockers paragraph. |

### Why the new tests can fail (no useless tests)

- Literal coin totals fail if the per-mini/per-cube award, the ×2 multiplier, the rounding or
  the completion trigger regresses.
- Literal `15_000`/`35_000` boundaries fail if `thresholdSeconds` changes (e.g. `gridSize * 4`)
  or the `<=` comparison becomes `<`; the just-over cases fail if the comparison becomes `<=`
  on the wrong side.
- The two-cube case fails if `cubesDestroyed` is incremented more than once per cube, not at
  all, or if stats are reset by the level advance.
- The adoptEconomy cases fail if adoption merges, clamps, rounds, resets `levelIndex` or
  rebuilds the board; the post-adoption earning case fails if local awards ignore the adopted
  total.
- `onlyType` fails explicitly when a frame is missing, duplicated or of another type.

## Evidence (raw)

Baseline before edits (targeted suites):

```
npx vitest run src/frontend/src/game/engine.test.ts --root src/frontend
→ Test Files 1 passed (1); Tests 113 passed (113)

npx vitest run src/backend/src/game/hub.test.ts --root src/backend
→ Test Files 1 passed (1); Tests 194 passed (194)
```

After edits, full recipe from the repository root:

```
npm run lint
> eslint .
→ exit 0 (no output, no warnings)

npm run typecheck
→ exit 0 (both workspaces: backend tsc --noEmit, frontend tsc --noEmit)

npm test
→ backend:  Test Files 38 passed (38); Tests 1601 passed (1601)
→ frontend: Test Files 83 passed (83); Tests 2706 passed (2706)
→ exit 0

npm run coverage
→ backend:  All files | 96.44 stmts | 90.31 branch | 99.59 funcs | 96.44 lines
→ frontend: All files | 97.08 stmts | 96.64 branch | 98.19 funcs | 97.08 lines
→ exit 0 (thresholds 80/80/80/80 per workspace; no exclusions changed)
```

Relevant coverage rows after the change:

```
backend:  economy.ts 100/100/100/100; hub.ts 91.12/88.69/98.48/91.12
frontend: economy.ts 100/100/100/100; engine.ts 99.47/100/100/99.47; progression.ts 100/100/100/100
```

Targeted suites after the change:

```
npx vitest run src/frontend/src/game/engine.test.ts --root src/frontend
→ Test Files 1 passed (1); Tests 115 passed (115)

npx vitest run src/backend/src/game/hub.test.ts --root src/backend
→ Test Files 1 passed (1); Tests 194 passed (194)
```

Stats-assertion audit (Python one-liner over `engine.test.ts`): 13 whole-`stats` assertions
(6 review-named, 6 economy/adoptEconomy, 1 identity check) and no stats-touching partial
assertion missing either `coins` or `cubesDestroyed`. The audit’s flagged lines are only the
two identity checks (`toBe(before.stats)`), the deliberate pre-adoption `coins` precondition,
and the upgrades tests, which pin `coins` and `cubesDestroyed` in pairs.

```
grep -c 'toBeDefined' src/backend/src/game/hub.test.ts
→ 0
```

## Acceptance audit

AC-1 → met (per-mini literal engine test)
AC-2 → met (per-cube fast/slow literal engine tests)
AC-3 → met (fast vs slow completion; bonus ×2/×1 at literal boundaries)
AC-4 → met (grid 3 = 15 s and grid 7 = 35 s, exact and +1 ms)
AC-6/AC-16 → met (adoptEconomy absolute higher/lower adoption, untouched progression/board)
AC-8 → met (cubesDestroyed 1 → 2 across a level advance)
AC-21 → met (guest local ledger, no adoption/transport)
AC-9/AC-10 → unchanged and still green (hub suite)
AC-20 → met (coverage ≥ 80 in both workspaces, exit 0)

Deviations from spec: none. No production behavior changed; no out-of-scope files touched.
