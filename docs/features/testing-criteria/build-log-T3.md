# Build log — T3 — Backend tests to close the baseline gap

Task: T3 (`[P]`, batch 1 with T2/T4) — 2026-10-18
Files changed: `docs/features/testing-criteria/build-log-T3.md` (record-only task — no source or test file touched)

## What changed & why (≤5 lines)

1. Re-ran the workspace-scoped gate `npm run coverage --workspace @cubeclicker/backend` against the T1 baseline (commit `e07d7a1`) to look for any uncovered backend behavior.
2. Measured result: `src/app.ts` at **100 / 100 / 100 / 100** across statements/branches/functions/lines, ✗ 0 uncovered line ranges, **exit 0** — identical to the T1 baseline; no production path is unreached.
3. Per plan contract 5 / D-6 ("backend gap closes only if measured") and the T3 contract ("a baseline with no gap ends the task as record-only evidence"), **no test was added** — adding a test here would be cosmetic and would violate the no-useless-tests bar (AC-8/AC-9).
4. Re-confirmed the other T3 verify gates: `npm test --workspace @cubeclicker/backend` → 0; `npm run typecheck --workspace @cubeclicker/backend` → 0; banned-matcher grep over `src/backend/src/*.test.ts` → no matches.
5. Recorded the transcript, the before/after numbers, and the zero-change diff evidence in this log; nothing else changed in the repo.

## Decisions

- **Record-only, no invented tests.** The T1 baseline is the measured ground truth (plan D-8) and already shows the backend clean at 100 × four metrics with exit 0. The task's own wording makes a zero-gap baseline a terminal, record-only outcome; the absence of a measured gap is the exit condition, not an invitation to pad the suite.
- **Before/after are identical by construction.** Before = T1 baseline (`build-log-T1.md` §3: 100/100/100/100, exit 0). After = this task's rerun: 100/100/100/100, exit 0. Delta = 0 on all four metrics (nothing was uncovered, so nothing could improve).
- **Exclusion unchanged and still the only one.** `src/server.ts` (composition-root entrypoint) remains the single excluded backend production file; the report contains `app.ts` as the only counted source file, so the 100% is over the whole non-excluded backend surface — no file is hidden from the gate.
- **No assertion or config weakening.** Thresholds, `include`, `exclude`, `all`, and `reporter` are untouched (T1-owned and unchanged since `e07d7a1`); no `autoUpdate`/`perFile`; no dependency added.

## Evidence

### 1. `npm run coverage --workspace @cubeclicker/backend` — exit 0, all four metrics ≥ 80 (100 × 4)

```
> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/app.test.ts (4 tests) 104ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  18:01:17
   Duration  477ms (transform 34ms, setup 0ms, collect 93ms, tests 104ms, environment 0ms, prepare 61ms)

 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |                   
 app.ts   |     100 |      100 |     100 |     100 |                   
----------|---------|----------|---------|---------|-------------------
EXIT:0
```

Note: the `Uncovered Line #s` column is empty for `app.ts` — every statement, branch, function, and line of the only non-excluded backend module is executed. No `ERROR: Coverage for … does not meet global threshold (80%)` line was emitted.

**Before / after (per metric, workspace-scoped):**

| Metric | T1 baseline (`build-log-T1.md` §3) | T3 rerun (this task) | Delta | Gate |
| --- | --- | --- | --- | --- |
| Statements | 100 | 100 | 0 | ≥ 80 ✅ |
| Branches | 100 | 100 | 0 | ≥ 80 ✅ |
| Functions | 100 | 100 | 0 | ≥ 80 ✅ |
| Lines | 100 | 100 | 0 | ≥ 80 ✅ |
| Exit code | 0 | 0 | 0 | must be 0 ✅ |

### 2. `npm test --workspace @cubeclicker/backend` → exit 0

```
> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/app.test.ts (4 tests) 89ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  18:01:21
   Duration  372ms (transform 33ms, setup 0ms, collect 71ms, tests 89ms, environment 0ms, prepare 56ms)

EXIT:0
```

### 3. `npm run typecheck --workspace @cubeclicker/backend` → exit 0

```
> typecheck
> tsc --noEmit

EXIT:0
```

### 4. Banned-matcher grep over `src/backend/src/*.test.ts` → no matches

```
$ grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchSnapshot|toMatchInlineSnapshot|toHaveBeenCalled\(\)" src/backend/src/*.test.ts
GREP_EXIT:1

$ ls src/backend/src/*.test.ts
src/backend/src/app.test.ts
```

`grep` exit 1 = zero matching lines in the only backend test file. (No test content was added by this task, so the "no matches in added content" clause is satisfied vacuously and the pre-existing file is clean of banned forms as well.)

### 5. `git diff` vs build-start baseline — zero change

Build-start baseline for T3 = `e07d7a1` (T1, the last commit before this task).

```
$ git diff --stat
(empty)

$ git diff --stat e07d7a1 -- src/backend
(empty)

$ git status --short
?? docs/features/testing-criteria/plan.md
?? docs/features/testing-criteria/reviews/
?? docs/features/testing-criteria/spec.md
?? docs/features/testing-criteria/status.md
?? docs/features/testing-criteria/tasks.md
```

`src/backend/src/app.test.ts` is byte-identical to the build-start baseline (`git diff --stat e07d7a1 -- src/backend` is empty): no tracked file changed in this task, and the only working-tree entries are the feature's own untracked planning artifacts (owned by the planner/orchestrator, not staged here). This is the zero-change note required by the T3 contract.

### 6. `git status --short` — no coverage report artifacts

```
$ ls -d src/backend/coverage
ls: cannot access 'src/backend/coverage': No such file or directory
```

`reporter: ['text']` writes console output only; no `coverage/` directory and no other report artifact was produced by the rerun (also visible in §5: `git status --short` lists no new artifact).

## Acceptance audit

- **AC-5 (backend) — met.** The backend baseline gap is empty and is left closed by tests, not by exclusion: the measured report shows the only non-excluded backend module (`src/app.ts`) at 100% on all four metrics with an empty uncovered-line column; no metric is masked by a carve-out (the single exclusion is the T1-justified `src/server.ts` composition root) and no threshold was lowered. Evidence §1, §5.
- **AC-22 (contract 5) — met.** Plan contract 5 prescribes backend tests "only for behavior the T1 baseline reports uncovered"; the measurement reports no uncovered behavior, so the compliant diff is the zero-change diff recorded in §5 (which contains no source, config, package, or test edit and therefore no contract drift). No banned matcher was introduced (§4). Evidence §1, §5.
- **supports AC-4 — met (backend half).** The backend workspace-scoped gate is green (`npm run coverage --workspace @cubeclicker/backend` → exit 0, all four metrics 100 ≥ 80), which is the precondition the T9 project-wide gate builds on. Evidence §1.

Deviations from spec: none. No test was added because none was warranted (the pinned record-only path); no new dependency; no production-code edit; no `.env*`, compose, Dockerfile, CI, or permission change; nothing outside `files_owned` was touched.
