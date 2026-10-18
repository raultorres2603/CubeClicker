# Build log — T2 — Frontend tests to close the baseline gap

Task: T2 (`[P]`, batch 1) — 2026-10-18
Files changed: `src/frontend/src/App.test.tsx` (new), `src/frontend/src/ws/connection.test.ts` (edit), `docs/features/testing-criteria/build-log-T2.md`

## What changed & why (≤5 lines)

1. Added `src/frontend/src/App.test.tsx` (contract 4.A): renders `App` with `renderToStaticMarkup` from `react-dom/server` (node environment, no DOM, no new dependency) and pins the **full** static markup — `<h1>CubeClicker</h1>` plus the initial status element `<span data-status="connecting">Connecting…</span>` — in one exact `toBe` assertion.
2. Added the **mandated** 5.A top-up to `connection.test.ts`: a `FakeGlobalWebSocket` in-process fake stubbed over the ambient global with `vi.stubGlobal('WebSocket', …)` (restored by `vi.unstubAllGlobals()` in `afterEach`, no real network I/O, no real socket opened) exercises `defaultSocketFactory` (`connection.ts:33-35`) and the `socketFactory ?? defaultSocketFactory` fallback arm through `createConnection({ url, onStatus })` with no injected factory.
3. The top-up asserts concrete values: exactly one recorded instantiation, the exact url the fake received, the exact status sequence `['connecting']` → `['connecting','connected']`, and teardown (one `close()` call, all three handlers `null`).
4. No 5.B top-up was needed: after (1) + (2) the measured gate is green on all four metrics (92.79 / 92.85 / 100 / 92.79, exit 0) — recorded as the zero-change note contract 5.B allows. No cosmetic tests added.
5. No production-code edit, no config change, no dependency, no DOM environment (explicitly out of scope).

## Decisions

- **Single exact-markup assertion instead of sub-assertions (4.A).** The whole SSR string is pinned with `toBe`, so the heading text, the `data-status="connecting"` hook and its exact label are all covered by one assertion that cannot be satisfied loosely; no partial/substring matcher is used anywhere in the file.
- **`FakeGlobalWebSocket` restores in a describe-scoped `afterEach`.** The pre-existing file-level `beforeEach`/`afterEach` (`vi.useFakeTimers()` / `vi.useRealTimers()`) are byte-identical to the build-start baseline: the new code is an append only (the stub lifecycle lives in the new `describe`), so the T2 diff is purely additive (AC-22).
- **One code path, one test.** The drop/retry behavior of the default factory is the same `attach`/`scheduleRetry` code the injected-factory suite already exercises deterministically; a second retry test through the global stub would not be able to fail on a regression the existing nine cannot, so it was not added (contract 5.B: "no cosmetic tests").
- **Honest residual (recorded, not papered over).** Uncovered after T2: `App.tsx` lines **19-22** (the `useEffect` callback body + cleanup — SSR never runs effects, exactly the accepted residual in spec § Testing strategy / contract 4.A / plan D-6) and `connection.ts` lines **53-54, 99-100** (the two defensive `if (closed) return;` guards inside `setStatus` and `open`). Those guards are unreachable by construction: `close()` latches `closed = true`, detaches every socket handler and clears the pending retry timer, so neither `setStatus('…')` nor `open()` can be invoked afterwards without a production-code change (i.e. **not** coverable without weakening the assertion style or editing production code — both forbidden). They stay uncovered; branches still clear the gate comfortably (92.85%).
- **Measured functions = 100% (differs from the D-6 estimate of 11/13 ≈ 84.6%).** Recorded as measured ground truth: with the SSR render path plus the mandated top-up, v8 reports `App.tsx` and `connection.ts` at 100% functions while their line gaps above remain. No estimate-driven test was added or omitted — T1/T2 measurement governs.

## Evidence

### 1. `npm run coverage --workspace @cubeclicker/frontend` — BEFORE (build-start baseline, identical to `build-log-T1.md`) → exit 1

```
> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ws/connection.test.ts (9 tests) 8ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  18:02:04
   Duration  340ms (transform 51ms, setup 0ms, collect 51ms, tests 8ms, environment 0ms, prepare 76ms)

 % Coverage report from v8
----------------|---------|----------|---------|---------|--------------------
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s  
----------------|---------|----------|---------|---------|--------------------
All files       |   71.17 |    85.18 |      80 |   71.17 |                    
 src            |       0 |        0 |       0 |       0 |                    
  App.tsx       |       0 |        0 |       0 |       0 | 1-34               
 src/ws         |   91.86 |    88.46 |   88.88 |   91.86 |                    
  connection.ts |   91.86 |    88.46 |   88.88 |   91.86 | 33-35,53-54,99-100 
----------------|---------|----------|---------|---------|--------------------
ERROR: Coverage for lines (71.17%) does not meet global threshold (80%)
ERROR: Coverage for statements (71.17%) does not meet global threshold (80%)
npm error Lifecycle script `coverage` failed with error:
npm error code 1
npm error path /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error workspace @cubeclicker/frontend
npm error location /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error command failed
npm error command sh -c vitest run --coverage
EXIT:1
```

### 2. `npm run coverage --workspace @cubeclicker/frontend` — AFTER → exit 0

```
> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ws/connection.test.ts (10 tests) 8ms
 ✓ src/App.test.tsx (1 test) 8ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  18:02:43
   Duration  331ms (transform 55ms, setup 0ms, collect 92ms, tests 16ms, environment 0ms, prepare 147ms)

 % Coverage report from v8
----------------|---------|----------|---------|---------|-------------------
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------|---------|----------|---------|---------|-------------------
All files       |   92.79 |    92.85 |     100 |   92.79 |                   
 src            |      84 |      100 |     100 |      84 |                   
  App.tsx       |      84 |      100 |     100 |      84 | 19-22             
 src/ws         |   95.34 |    92.59 |     100 |   95.34 |                    
  connection.ts |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100      
----------------|---------|----------|---------|---------|-------------------
EXIT:0
```

**Before → after (per metric, same command):**

| Metric | Before | After | Threshold | Status |
| --- | --- | --- | --- | --- |
| Statements | 71.17 | **92.79** | 80 | pass (was fail) |
| Branches | 85.18 | **92.85** | 80 | pass |
| Functions | 80.00 | **100** | 80 | pass |
| Lines | 71.17 | **92.79** | 80 | pass (was fail) |
| Exit code | **1** | **0** | — | green |
| `App.tsx` | 0 / 0 / 0 / 0 (1-34) | 84 / 100 / 100 / 84 (19-22) | — | render path covered |
| `connection.ts` | 91.86 / 88.46 / 88.88 / 91.86 (33-35, 53-54, 99-100) | 95.34 / 92.59 / 100 / 95.34 (53-54, 99-100) | — | `33-35` now covered |

### 3. `npm test --workspace @cubeclicker/frontend` → 0 — `src/App.test.tsx` **discovered and executed** (AC-24 / F1)

```
> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/App.test.tsx (1 test) 6ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  18:02:38
   Duration  258ms (transform 51ms, setup 0ms, collect 85ms, tests 16ms, environment 0ms, prepare 111ms)

EXIT:0
```

`src/App.test.tsx (1 test)` is listed as an executed file with 1 passing test — the discovery extension from T1 (contract 3.C) actually reaches the new file. Before T2 the same command listed only `src/ws/connection.test.ts (9 tests)`.

### 4. `npm run coverage` (root, both workspaces) → 0 — supports AC-4

```
... backend: All files | 100 | 100 | 100 | 100 |  → `app.ts | 100 | 100 | 100 | 100 |`
... frontend: ✓ src/ws/connection.test.ts (10 tests) 8ms
               ✓ src/App.test.tsx (1 test) 8ms
              All files       |   92.79 |    92.85 |     100 |   92.79 |
              App.tsx         |      84 |      100 |     100 |      84 | 19-22
              connection.ts   |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
EXIT:0
```

Both workspaces clear 80 on all four metrics at the root invocation; the final T9 gate remains the authoritative run.

### 5. `grep -n "stubGlobal" src/frontend/src/ws/connection.test.ts` → present (mandated 5.A top-up)

```
242:    vi.stubGlobal('WebSocket', FakeGlobalWebSocket);
```

`vi.unstubAllGlobals()` runs in the new block's `afterEach` (line 249), so no stub leaks into the other nine tests; no real network I/O occurs (the fake never opens a socket — it only records instantiations/handlers).

### 6. Banned-matcher grep over the frontend test files → no matches in added content

```
$ grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchSnapshot|toMatchInlineSnapshot|toHaveBeenCalled\(\)" src/frontend/src/*.test.* src/frontend/src/ws/*.test.*
(no output — exit 1)

$ grep -nE "toBeTruthy\(\)|toBeDefined\(\)|not\.toThrow\(\)|toMatchObject|closeTo" src/frontend/src/App.test.tsx src/frontend/src/ws/connection.test.ts
(no output — exit 1)
```

No banned matcher, no weak-existential stand-in, no argument-unchecked `toHaveBeenCalled()`, no snapshot-only/assertion-free test, and no exception-rule use (0 exceptions this task). Every added assertion pins a concrete value (`toBe` on the full markup / the exact url; `toHaveLength(1)`; `toEqual(['connecting'])`; `toEqual(['connecting','connected'])`; `toBe(1)`; `toBeNull()` ×3).

### 7. `npm run typecheck --workspace @cubeclicker/frontend` → 0

```
> typecheck
> tsc --noEmit

TYPECHECK_EXIT:0
```

### 8. `npm run lint` → 0

```
> lint
> eslint .

LINT_EXIT:0
```

### 9. `git diff` vs build-start baselines

Build-start baseline for `connection.test.ts` = `git show HEAD:src/frontend/src/ws/connection.test.ts` (captured verbatim before the edit, HEAD = `e07d7a1`); `App.test.tsx` did not exist at build start (new file, untracked).

```
$ git status --short -- src/frontend/src/App.test.tsx src/frontend/src/ws/connection.test.ts
 M src/frontend/src/ws/connection.test.ts
?? src/frontend/src/App.test.tsx

$ diff -u <build-start baseline connection.test.ts> src/frontend/src/ws/connection.test.ts
@@ -214,3 +214,60 @@
     expect(h.statuses).toEqual(['connecting']);
   });
 });
+
+/** In-process stand-in for the ambient `WebSocket` global … */
+class FakeGlobalWebSocket { … }
+
+describe('createConnection — default socket factory', () => {
+  beforeEach(() => { … vi.stubGlobal('WebSocket', FakeGlobalWebSocket); });
+  afterEach(() => { vi.unstubAllGlobals(); … });
+  it('uses the ambient WebSocket global with the exact url when no factory is injected', () => { … });
+});
```

**Additive only:** 57 inserted lines, **0 deleted lines** (`@@ -214,3 +214,60 @@`) in `connection.test.ts` — the whole diff is an hunk appended after the last existing line; the pre-existing `FakeSocket` class, `harness`, `current`, file-level `beforeEach`/`afterEach` and all nine existing tests are byte-identical to the baseline. No pre-existing content was replaced or removed anywhere, so no amendment-trace concern arises for this task (contracts 4–5 add files/tests only).

`App.test.tsx` (24 lines) is new — full content is the two imports, the honest-scope comment, and one test with one exact-markup `toBe` assertion.

Task-scope check: no other path was touched by this task (`git status --short` shows only ` M src/frontend/src/ws/connection.test.ts`, `?? src/frontend/src/App.test.tsx` from T2; `M AGENTS.md`/other paths in the working tree belong to the parallel T3/T4 tasks). No config, no `package.json`, no lockfile, no production module, no `.env*`.

## Acceptance audit

- **AC-5 (frontend) — met.** `src/frontend/src/App.test.tsx` exists and asserts concrete rendered output (full static markup: `CubeClicker` heading + `data-status="connecting"` with the exact label `Connecting…`) via `react-dom/server` — no new dependency, no DOM environment (§9, §2). The mandated `connection.test.ts` top-up exercises the default socket-factory path (`connection.ts:33-35`) through a `vi.stubGlobal`-stubbed in-process global fake, restored in `afterEach`, with no real network I/O, and covers the `socketFactory ?? defaultSocketFactory` fallback arm (§5, §2 — `33-35` gone from the uncovered list). No further measured gap existed, so no 5.B top-up was needed (§2, Decision 4). Diff vs. its build-start baseline contains **0** banned matcher forms and 0 exceptions (§6); before/after numbers are in §1-§2.
- **AC-24 — met.** `src/frontend/vitest.config.ts` discovery covers `.tsx` tests (landed in T1, contract 3.C), and the T2 frontend transcript (§3) **lists `src/App.test.tsx` as an executed test file with 1 passing test** — the file is genuinely discovered and run, not merely present.
- **AC-22 (contracts 4–5) — met.** The only changes are the new file (4.A) and the appended 5.A top-up + its fake (57 added lines, 0 removed; no in-place replacement of any pre-existing line) — §9. Nothing else in either file changed.
- **supports AC-4 — met (frontend half).** The frontend workspace is green on all four metrics (§2) and the root `npm run coverage` exits 0 (§4); the authoritative end-state run stays T9.

Known residual (accepted, reviewer-visible; spec § Testing strategy / contract 4.A / plan D-6): `App.tsx` lines 19-22 (effect callback/cleanup — SSR never runs effects) and `connection.ts` lines 53-54, 99-100 (defensive post-`close()` guards unreachable without a production-code change) remain uncovered. No threshold, exclusion, include or assertion was weakened to accommodate them; the gate clears with margin on every metric anyway.

Deviations from spec: none. No blocker arose — the Q-5 contingency was not needed (functions measured 100%, not the estimated 84.6%; both okay).

**No useless tests:** each added test can fail on a real regression — the markup test fails if the heading, the label, the `data-status` value, or the surrounding structure changes; the factory test fails if `defaultSocketFactory` stops using the ambient `WebSocket`, stops forwarding the url, changes the status sequence, or stops closing/detaching on teardown.
