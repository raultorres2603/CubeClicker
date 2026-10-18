# Build log — T9 — Verify & integrate

Task: T9 (`[seq]`, final verification gate) — 2026-10-18 — branch `feat/testing-criteria`
Files changed: `docs/features/testing-criteria/build-log-T9.md` (only — this is a verification task; no source/config/test/doc outside this log is edited)

## Sketch (≤5 lines)

1. Run the full canonical gate myself on branch tip `af451c1`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` — record raw transcripts and exit codes.
2. Inspect the dependency/lockfile scope, the permission blocks, the two Vitest configs, and the cross-file command/threshold consistency.
3. Grep every test diff for banned matchers and every in-place line change against the 16 pinned contract IDs (amendment trace); inspect each task diff versus its build-start baseline.
4. Verify scope discipline (AC-21: exactly one dependency, no production-module / container / CI / `.env*` / permission changes) and `git status --short` cleanliness.
5. Write the per-AC met/unmet table (AC-1…AC-24) with evidence locations, the accepted residual, and any drift, honestly.

## Baselines / environment

```
$ git rev-parse HEAD                          → af451c14d5a487676e23c463dad0eaf3f63a4337
$ git branch --show-current                   → feat/testing-criteria
$ git rev-parse 7bc89bf  (pre-feature base)   → 7bc89bf559fa2b06933dabf7724c0fd649099c6b
$ git rev-parse main                          → 0784d009446ab0f1f698da929ceb7e424cda6d36
$ git log --oneline 7bc89bf..HEAD
af451c1 docs: require reviewer coverage reruns and assertion-quality checks (T7)
3166fd5 docs: gate the workflow on coverage evidence (T8)
0784d00 docs: make specs and tasks define the unit/integration/coverage bar (T5)
4e2a651 docs: add the builder testing bar and coverage DoD (T6)
8e5eb33 test: cover the app shell to the 80% gate (T2)
d9f163a docs: state the 80% testing bar in AGENTS.md, README, and the stack.md mirror (T4)
08a952d test: cover backend gaps to the 80% gate (T3)
e07d7a1 chore: add V8 coverage gate with 80% thresholds and measure baseline (T1)
```

Pre-feature baseline for the whole-feature audit = `7bc89bf` (the commit before T1's `e07d7a1`). The feature branch was created at `0784d00` (== then `main` tip); T8 (`3166fd5`) and T7 (`af451c1`) landed on it, per `status.md`. No history rewrite; nothing pushed.

Feature diff shape: `33 files changed, 2466 insertions(+), 23 deletions(-)`.

---

## Evidence

### 1. `npm ci` → 0 (clean install from the committed lockfile)

```
> ... (deprecation/audit warnings only, no error)
added 325 packages, and audited 328 packages in 1s
...
NPM_CI_EXIT:0
```

### 2. `npm run lint` → 0

```
> lint
> eslint .

LINT_EXIT:0
```

### 3. `npm run typecheck` → 0

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

TYPECHECK_EXIT:0
```

### 4. `npm test` → 0 — frontend transcript lists `src/App.test.tsx` as executed (AC-24 discovery check)

```
> test
> npm run test --workspaces --if-present

> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/app.test.ts (4 tests) 91ms

 Test Files  1 passed (1)
      Tests  4 passed (4)

> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/App.test.tsx (1 test) 6ms

 Test Files  2 passed (2)
      Tests  11 passed (11)

TEST_EXIT:0
```

`src/App.test.tsx (1 test)` is listed as an **executed** file with 1 passing test — the T1 discovery extension (contract 3.C) genuinely reaches the new `.tsx` test. Without the extension the file would be absent from this listing.

### 5. `npm run coverage` → 0 — both workspaces ≥ 80 on all four metrics (full transcript)

```
> coverage
> npm run coverage --workspaces --if-present

> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/app.test.ts (4 tests) 108ms

 Test Files  1 passed (1)
      Tests  4 passed (4)

 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 app.ts   |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ws/connection.test.ts (10 tests) 8ms
 ✓ src/App.test.tsx (1 test) 8ms

 Test Files  2 passed (2)
      Tests  11 passed (11)

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

COVERAGE_EXIT:0
```

| Workspace | Stmts | Branch | Funcs | Lines | ≥ 80 ×4 | Exit |
| --- | --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | 100 | 100 | 100 | 100 | ✅ | 0 |
| `@cubeclicker/frontend` | 92.79 | 92.85 | 100 | 92.79 | ✅ | 0 |
| `npm run coverage` (root) | — | — | — | — | ✅ | **0** |

No `ERROR: Coverage for … does not meet global threshold (80%)` line is emitted.

### 6. `npm ls vitest @vitest/coverage-v8` → identical versions

```
cubeclicker@ /var/home/raultorraco/Documents/Projects/CubeClicker
├─┬ @cubeclicker/backend@ -> ./src/backend
│ ├─┬ @vitest/coverage-v8@3.2.7
│ │ └── vitest@3.2.7 deduped
│ └── vitest@3.2.7
└─┬ @cubeclicker/frontend@ -> ./src/frontend
  ├── @vitest/coverage-v8@3.2.7 deduped
  └── vitest@3.2.7 deduped

LS_EXIT:0
```

Both workspaces: `vitest@3.2.7` and `@vitest/coverage-v8@3.2.7` — identical, satisfying the provider's exact peer requirement.

### 7. Lockfile diff inspection (only the provider + its transitive dev tree)

```
$ git diff --stat 7bc89bf..HEAD -- package-lock.json
 package-lock.json | 632 ++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 632 insertions(+)

$ git diff 7bc89bf..HEAD -- package-lock.json | grep -c '^-[^-]'   → 0   (zero deletions/modifications)
```

48 added `node_modules/…` entries, all in the `@vitest/coverage-v8` dev tree:
`@vitest/coverage-v8`, `@ampproject/remapping`, `@bcoe/v8-coverage`, `@istanbuljs/schema`,
`ast-v8-to-istanbul` (+ nested `js-tokens`), `istanbul-lib-coverage`, `istanbul-lib-report`,
`istanbul-lib-source-maps`, `istanbul-reports`, `magicast`, `make-dir`, `test-exclude` (+ nested
`balanced-match`, `brace-expansion`, `minimatch`), `glob` (+ nested `brace-expansion`, `minimatch`),
`foreground-child`, `signal-exit`, `jackspeak`, `path-scurry` (+ nested `lru-cache`), `minipass`,
`package-json-from-dist`, `@isaacs/cliui`, `@pkgjs/parseargs`, `html-escaper`, `ansi-regex`,
`eastasianwidth`, `emoji-regex`, `is-fullwidth-code-point`, `string-width(-cjs)` (+ nested),
`strip-ansi(-cjs)` (+ nested), `wrap-ansi(-cjs)` (+ nested). **0 existing entries changed** (0
deletions) — `vitest` stays `3.2.7`. No production dependency entered the tree.

### 8. `git grep -n "permissions:" -- .opencode/agents` unchanged vs pre-feature baseline

```
=== baseline (7bc89bf) ===                 === HEAD ===
7bc89bf:.opencode/agents/builder.md:7:permissions:      HEAD:.opencode/agents/builder.md:7:permissions:
7bc89bf:.opencode/agents/orchestrator.md:7:permissions: HEAD:.opencode/agents/orchestrator.md:7:permissions:
7bc89bf:.opencode/agents/planner.md:7:permissions:      HEAD:.opencode/agents/planner.md:7:permissions:
7bc89bf:.opencode/agents/reviewer.md:7:permissions:     HEAD:.opencode/agents/reviewer.md:7:permissions:

$ git diff 7bc89bf..HEAD -- .opencode/agents | grep -i permission   → (no output)
```

Identical. No permission block was added, removed, or modified in any agent file.

### 9. Cross-file consistency

**(a) `npm run coverage` token present per file** (`grep -c`):

```
AGENTS.md (2) · README.md (1) · docs/architecture/stack.md (1)
.opencode/agents/{builder,reviewer,planner,orchestrator}.md (1 each)
.opencode/skills/web-implementation/SKILL.md (3) · …/references/engineering-principles.md (1)
.opencode/skills/code-review/SKILL.md (2) · …/checklists/testing.md (1)
.opencode/skills/spec-authoring/SKILL.md (1) · …/references/spec-checklist.md (1) · …/templates/spec.md (1)
.opencode/skills/spec-review/SKILL.md (1) · .opencode/skills/task-decomposition/SKILL.md (1)
.opencode/skills/orchestration-playbook/SKILL.md (1)
```

Every documented framework file names the exact command `npm run coverage`; `stack.md`'s canonical-commands parenthetical now reads `(lint / typecheck / test / coverage / build / dev / smoke)`.

**(b) Thresholds `80` in both Vitest configs** — `src/backend/vitest.config.ts:25-28` and `src/frontend/vitest.config.ts:25-28` both declare `statements/branches/functions/lines = 80`.

**(c) Documented exclusions match the configured ones** — both configs:
`exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', '<entrypoint>', ...coverageConfigDefaults.exclude]`
(`src/server.ts` backend / `src/main.tsx` frontend), matching the spec's justified list (test patterns + the one composition-root entrypoint, extending the built-in defaults — F7). Both configs import `coverageConfigDefaults`; `include: ['src/**/*.{ts,tsx}']`; `all: true`; `reporter: ['text']`; no `autoUpdate`, no `perFile`.

**(d) Frontend `include` covers `.test.tsx`; backend discovery unchanged**:

```
backend  baseline 6:    include: ['src/**/*.test.ts'],                              (unchanged at HEAD)
frontend baseline 6:    include: ['src/**/*.test.ts'],   (pre-feature)
frontend HEAD     6:    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],         (contract 3.C)
```

### 10. Banned-matcher grep over all test diffs → no matches

```
$ git diff 7bc89bf..HEAD -- 'src/**/*.test.ts' 'src/**/*.test.tsx' | grep '^+' | grep -nE \
    "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchSnapshot|toMatchInlineSnapshot|toHaveBeenCalled\(\)|toBeTruthy\(\)|toBeDefined\(\)|not\.toThrow\(\)|toMatchObject|closeTo"
(no output — exit 1)

$ grep -rnE "<same pattern>" src/backend/src src/frontend/src
(no output — exit 1)
```

Zero banned matcher forms, zero weak-existential stand-ins, zero argument-unchecked
`toHaveBeenCalled()`, zero snapshot-only/assertion-free tests in **added** content and in the
changed test files as a whole. **0 exception-rule uses** (`closeTo`/etc.) in the feature. The added
assertions pin concrete values (`toBe` on the full SSR markup; `toHaveLength(1)`; exact `url` via
`toBe`; `toEqual(['connecting'])`; `toEqual(['connecting','connected'])`; `toBe(1)`; `toBeNull()` ×3)
— and the pre-existing suite was not retro-refactored (retroactivity rule).

### 11. Amendment-trace audit — every deleted line in the feature diff

Whole-feature deleted lines (23) enumerated and mapped (`git diff 7bc89bf..HEAD | grep '^-'`):

| # | Deleted line (file) | Contract | Kind |
| --- | --- | --- | --- |
| 1 | orchestrator build-gate line | **11.A** | pinned replacement |
| 2 | orchestrator accepted-summary line | **11.B** | pinned replacement |
| 3 | code-review SKILL workflow step 3 | **14.A** | pinned replacement |
| 4 | code-review SKILL `6. Verify previous-round…` | — | renumber → via 14.B |
| 5 | code-review SKILL `7. Decide the verdict…` | — | renumber → via 14.B |
| 6 | playbook `building → code_review…` | **21.A** | pinned replacement |
| 7 | playbook §7 summary line | **21.B** | pinned replacement |
| 8 | spec-authoring SKILL workflow step 7 | **16.A** | pinned replacement |
| 9 | spec-review SKILL `**Testing**` item | **19.A** | pinned replacement |
| 10 | task-decomposition rule 2 | **20.A** | pinned replacement |
| 11 | web-implementation SKILL workflow step 4 | **12.A** | pinned replacement |
| 12 | web-implementation SKILL DoD `Tests added/updated…` | **12.B** | pinned replacement |
| 13 | AGENTS.md test-colocation line | **6.E** | pinned replacement |
| 14 | AGENTS.md `Tests accompany every behavior change.` | **6.B** | pinned replacement |
| 15 | AGENTS.md ✅ Always line | **6.C** | pinned replacement |
| 16 | AGENTS.md 🚫 Never line | 6.D (append) | additive-on-line (F6) |
| 17 | stack.md Package-manager colocation phrase | **22.C** | pinned replacement |
| 18 | stack.md canonical-commands parenthetical | **22.B** | pinned replacement |
| 19 | backend package.json `"test": "vitest run"` | — | JSON trailing comma → via 2.A |
| 20 | backend vitest.config import line | — | import extension → via 3.A |
| 21 | frontend package.json `"test": "vitest run"` | — | JSON trailing comma → via 2.A |
| 22 | frontend vitest.config import line | — | import extension → via 3.A |
| 23 | frontend vitest.config discovery line | **3.C** | pinned replacement |

**16 pinned replacements present and exact:** 3.C, 6.B, 6.C, 6.E, 11.A, 11.B, 12.A, 12.B, 14.A,
16.A, 19.A, 20.A, 21.A, 21.B, 22.B, 22.C. Plus **6.D** (documented append to the Never line —
additive, F6), plus 6 mechanical line touches (#4, #5, #19, #20, #21, #22) that are **not** among
the 16 enumerated replacements — see § 14 Drift observations. No content is removed anywhere beyond
the enumerated replacements; nothing unrelated appears.

### 12. Scope discipline (AC-21)

```
$ git diff --name-only 7bc89bf..HEAD -- src/backend/src/app.ts src/backend/src/server.ts \
    src/frontend/src/App.tsx src/frontend/src/main.tsx src/frontend/src/ws/connection.ts
(empty)                                   → production modules unchanged

$ git diff --name-only 7bc89bf..HEAD -- src/
src/backend/package.json · src/backend/vitest.config.ts
src/frontend/package.json · src/frontend/src/App.test.tsx · src/frontend/src/ws/connection.test.ts
src/frontend/vitest.config.ts             → configs + package files + test files only
```

Exactly one dependency added across the three `package.json` files — `@vitest/coverage-v8@^3.2.7`
(the `coverage` scripts are additions, not dependencies). No compose.yaml / Dockerfile /
`tests/e2e` / CI / `.env*` file appears in the feature diff. Permissions unchanged (§ 8).

### 13. `git status --short` — no `coverage/` artifacts, no `.env*`

```
$ git status --short
?? docs/features/testing-criteria/plan.md
?? docs/features/testing-criteria/reviews/
?? docs/features/testing-criteria/spec.md
?? docs/features/testing-criteria/status.md
?? docs/features/testing-criteria/tasks.md

$ find . -type d -name coverage -not -path './node_modules/*'
(no output)                               → no coverage/ report artifacts (text reporter)

$ git diff --name-only 7bc89bf..HEAD | grep -E '\.env' ; git status --short -uall | grep -E '\.env'
(no output — exit 1 both)                 → no .env* touched or untracked
```

Only the feature's own planner artifacts are untracked (owned by planner/orchestrator, not staged
here); no build artifact leaked.

---

## Per-AC met/unmet table (AC-1 … AC-24)

| AC | Status | Evidence location |
| --- | --- | --- |
| **AC-1** — root+workspace `coverage` scripts; `@vitest/coverage-v8` devDep in both; identical resolved versions | **met** | T9 §6 (`npm ls` 3.2.7 = 3.2.7), §7/§12 (package.json/lockfile diffs); `build-log-T1.md` §1–3, §10 |
| **AC-2** — both configs: v8, `include src/**/*.{ts,tsx}`, `exclude` extends `coverageConfigDefaults.exclude` + test patterns + one entrypoint; all-files semantics | **met** | T9 §9(c)/§9(d) (both configs read directly); `build-log-T1.md` §4–5, §10 (App.tsx counted at 0%; defaults preserved) |
| **AC-3** — thresholds 80 ×4; enforced by the run; no `autoUpdate`/`perFile`; text-only reporter, no artifacts | **met** | T9 §5 exit 0 (was exit 1 at baseline), §9(b), §13 (no artifacts); `build-log-T1.md` §3, §9–10 |
| **AC-4** — end state green: `npm run coverage` exit 0, all four metrics ≥ 80 per workspace | **met** | T9 §5 (backend 100×4; frontend 92.79/92.85/100/92.79; exit 0) |
| **AC-5** — baseline gap closed by meaningful tests (SSR render test + mandated default-socket-factory top-up); no banned matchers | **met** | T9 §10 (banned-matcher greps clean), §4/§5 (App.test.tsx executed); `build-log-T2.md` §2, §5, §6, §9; `build-log-T3.md` (backend record-only, no gap) |
| **AC-6** — `builder.md` rule: unit + integration, concrete assertions, coverage gate; contains "coverage" + "integration" | **met** | T9 §9(a) + the `.opencode/agents/builder.md` diff (one additive Rules bullet); `build-log-T6.md` per-file evidence (builder.md itself: coverage=1, integration=1) |
| **AC-7** — `web-implementation/SKILL.md`: workflow step, DoD items, `## Testing bar` section | **met** | T9 §11 (#11, #12); `build-log-T6.md` § (12.A/B/C) |
| **AC-8** — `engineering-principles.md` `## Testing principles` section (tiers, banned list, determinism, exception, no-useless-tests, coverage policy, spy discipline) | **met** | T9 §11 (13-line additive section); `build-log-T6.md` § (13.A) |
| **AC-9** — `reviewer.md` rule: rerun coverage; shortfall/missing tiers unmet; weak assertions findings; logs are claims; contains "coverage" | **met** | T9 §11 (additive bullet), §9(a); `build-log-T7.md` per-file evidence (reviewer.md: coverage=1) |
| **AC-10** — `code-review/SKILL.md`: suite step names coverage; assertion-quality inspection step; severity rules | **met** | T9 §11 (#3 = 14.A; additive step + 2 severity bullets); `build-log-T7.md` § (14.A/B/C) |
| **AC-11** — `testing.md`: three new sections `## Coverage gate`, `## Assertion quality`, `## No useless tests`; `## Coverage of the feature` retained | **met** *(caveat: N-1, see below)* | T9 §9/(grep): lines 5 / 29 / 37; retained `## Coverage of the feature` line 11; `build-log-T7.md` § (15.A/B/C) |
| **AC-12** — `spec-authoring/SKILL.md` step requires unit+integration+coverage; contains "integration" + "coverage" | **met** | T9 §11 (#8 = 16.A), §9(a); `build-log-T5.md` per-file (`integration`=1, `coverage`=1 in the file itself) |
| **AC-13** — `spec-checklist.md` §Testing strategy requires tiers, exact command/thresholds, assertion bar, behaviour-change task tests+coverage verify | **met** | T9 §11 (4 additive items); `build-log-T5.md` §3 |
| **AC-14** — `templates/spec.md` gains `Integration:` + `Coverage:` lines; Unit/E2E retained | **met** | T9 §11; `build-log-T5.md` §3 |
| **AC-15** — `spec-review/SKILL.md` Testing item checks tiers/commands/coverage/bars/edge-cases | **met** | T9 §11 (#9 = 19.A); `build-log-T5.md` §3 |
| **AC-16** — `task-decomposition/SKILL.md` rule 2 requires tests + coverage verify; rest unchanged | **met** | T9 §11 (#10 = 20.A); `build-log-T5.md` §3 |
| **AC-17** — `orchestrator.md` build-gate + accepted-summary require coverage evidence; contains "coverage" | **met** | T9 §11 (#1 = 11.A, #2 = 11.B), §9(a); `build-log-T8.md` |
| **AC-18** — `orchestration-playbook/SKILL.md` transition + §7 summary require coverage evidence; contains "coverage" | **met** | T9 §11 (#6 = 21.A, #7 = 21.B), §9(a); `build-log-T8.md` |
| **AC-19** — `AGENTS.md` §Commands row, §Conventions bar, §Boundaries ✅/🚫, §Project-structure `.tsx` pattern; no other section | **met** | T9 §11 (#13=6.E, #14=6.B, #15=6.C, #16=6.D), §9(a); `build-log-T4.md` |
| **AC-20** — `README.md` §Commands `npm run coverage` row | **met** | T9 §11 (1 added row); `build-log-T4.md` § (7.A) |
| **AC-21** — scope discipline: exactly one dependency; no production-module changes; no compose/Dockerfile/CI/`.env*`/permission changes | **met** | T9 §12 (prod diff empty; one dep), §7 (lockfile: provider+transitive only, 0 deletions), §8 (permissions identical), §13 (no `.env*`) |
| **AC-22** — non-destructive pinned edits; in-place replacements exactly the 16 enumerated IDs; all else additive | **met** *(substantive; 6 derived mechanical line touches flagged — §14)* | T9 §11 (full deleted-line enumeration → 16 pinned exact) |
| **AC-23** — self-consistency: command/thresholds/exclusions documented == reality; and lint/typecheck/test/coverage all pass | **met** | T9 §9(a)–(d) (cross-file consistency), §2–§5 (all four commands exit 0) |
| **AC-24** — frontend discovery covers `.test.tsx`; backend unchanged; transcripts list `App.test.tsx` executed | **met** | T9 §9(d) (configs), §4 + §5 (`✓ src/App.test.tsx (1 test)`); `build-log-T1.md` §5, `build-log-T2.md` §3 |

**No AC is unmet.** Every row above has a directly verifiable evidence location in this log or the
cited prior build log.

---

## Accepted residual (recorded explicitly, not omitted)

The coverage report leaves three source regions uncovered; both are the residuals the spec
pre-declared and accepted:

- **`src/frontend/src/App.tsx` lines 19-22** — the `useEffect` callback body and its cleanup. SSR
  (`renderToStaticMarkup`) executes only the render path and never runs effects, so these are
  uncoverable without a DOM environment (unsanctioned dependency). Accepted residual: spec
  § Testing strategy (r2 F2a), plan contract 4.A, plan D-6, risks table. `App.tsx` remains at
  84 / 100 / 100 / 84 — comfortably ≥ 80 on all four metrics despite it.
- **`src/frontend/src/ws/connection.ts` lines 53-54 and 99-100** — the two defensive
  `if (closed) return;` guards. Unreachable by construction (`close()` latches `closed = true` and
  detaches handlers/clears the retry timer first), so they cannot be covered without a
  production-code change — forbidden by this feature's scope. `connection.ts` remains at
  95.34 / 92.59 / 100 / 95.34.

Both regions are consistent with the numbers recorded at T2/T7/T8; no threshold, exclusion,
include or assertion was weakened to accommodate them.

## Known / expected (backlog — not drift)

- **N-1 — testing.md middle-section name.** `.opencode/skills/code-review/checklists/testing.md:29`
  is named `## Assertion quality (real-data rule)`, whereas AC-11's short form is
  `Assertion quality`. This is the cosmetic difference flagged as backlog N-1 in
  `reviews/spec-r2.md`; tasks.md T7 and plan contract 15.B both specify the `(real-data rule)`
  suffix, which the T7 build used. Known/expected, not drift; the T7 verify grep (`## Assertion
  quality`) matches either form.
- **T8 contract 21.B wording variance.** `build-log-T8.md` records that the §7 summary line names
  the command explicitly (`the \`npm run coverage\` run and per-workspace numbers`) to satisfy
  AC-18's "(command + per-workspace numbers)" literally. Permitted by the plan § Baseline rule
  ("wording may vary slightly if the required tokens/concepts hold"); still a single in-place line,
  contract 21.B. Known/expected, not drift.
- **N-2 / N-3 (status.md backlog).** N-2: contract 5.A's "-style" phrasing vs T2's literal
  `stubGlobal` token — the canonical API was used (`vi.stubGlobal`), so no deviation arose. N-3:
  `VITE_WS_URL` is `undefined` under vitest (vitest never loads `vite.config.ts`); harmless as
  pinned — the tests assert only the initial `connecting` state and never drive the effect. No
  action needed; recorded for completeness.

## Drift observations (flagged honestly)

No substantive drift and no unmet AC. One transparency item:

- **Six mechanical line touches outside the literal 16-replacement enumeration** (all are
  non-substantive consequences of pinned *additive* contracts, remove no content, and add no
  unrelated edit):
  - `.opencode/skills/code-review/SKILL.md` — workflow steps `6.`→`7.` and `7.`→`8.` renumbered.
    Mechanical consequence of contract **14.B** (the additive step inserted after step 5); text
    unchanged, only the ordinal digit moves.
  - `src/backend/package.json` + `src/frontend/package.json` — `"test": "vitest run"` gains a
    trailing comma. Mechanical consequence of contract **2.A** (JSON key appended after the last
    key must add a comma); the line's value is otherwise identical.
  - `src/backend/vitest.config.ts` + `src/frontend/vitest.config.ts` — the import line becomes
    `import { coverageConfigDefaults, defineConfig } from 'vitest/config';`. Mechanical consequence
    of contract **3.A** (the `exclude` spreads `coverageConfigDefaults`, so it must be imported).

  AC-22's substance holds (no unrelated edit; no pre-existing content otherwise removed; exactly
  the 16 enumerated replacements are present). These six are the diff-representation of pinned
  *additive* changes, but they are not literally among the 16 enumerated replacement IDs — flagged
  here so the reviewer can judge; not papered over.

## Acceptance audit (T9's own)

- **AC-4** → met. `npm run coverage` exit 0, both workspaces ≥ 80 ×4 (§5).
- **AC-21** → met. Exactly one dependency; production modules unchanged; permissions/compose/CI/
  `.env*` untouched (§8, §12, §13).
- **AC-22 (cross-task)** → met (substantive; 6 derived mechanical line touches flagged — §14). Full
  deleted-line enumeration mapped to the 16 pinned IDs (§11).
- **AC-23** → met. Cross-file consistency (§9) + lint/typecheck/test/coverage all exit 0 (§2–§5).
- **AC-24** → met. Frontend discovery covers `.test.tsx`, backend unchanged, `npm test`/`npm run
  coverage` transcripts list `✓ src/App.test.tsx (1 test)` (§4, §5, §9(d)).

Deviations from spec: none. No fixes were applied by T9 (this is verification only); no out-of-scope
edit; nothing pushed; no branch switch.

Commit: `docs: record T9 verification pass for testing-criteria (T9)` — staged explicitly, only
`docs/features/testing-criteria/build-log-T9.md`.
