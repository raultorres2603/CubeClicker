# Build log — T7 — Reviewer-facing guidance: agent rule + code-review skill and testing checklist

Task: T7 (2026-10-18) — branch `feat/testing-criteria`, build-start HEAD `0784d009446ab0f1f698da929ceb7e424cda6d36`
Files changed: `.opencode/agents/reviewer.md`, `.opencode/skills/code-review/SKILL.md`, `.opencode/skills/code-review/checklists/testing.md`, `docs/features/testing-criteria/build-log-T7.md`

## What changed & why (≤ 5 lines)

1. `reviewer.md` — one additive Rules bullet (contract 9.A): at the code gate the reviewer reruns `npm run coverage` itself; a coverage shortfall or missing unit/integration tests for changed behavior is unmet; weak assertions (banned matchers, snapshot-only, assertion-free, tautological) are findings; exclusions are inspected for number-gaming; builder logs are claims, not evidence.
2. `code-review/SKILL.md` — contract 14.A in-place replacement (workflow step 3 now names the coverage command); additive workflow step 6 (banned-matcher + no-useless-tests inspection, exclusion-list check); two additive severity bullets (coverage shortfall = unmet; unjustified banned matchers / exclusion gaming = `MAJOR` unless in-test-justified and accepted).
3. `code-review/checklists/testing.md` — three additive sections: `## Coverage gate` (top), `## Assertion quality (real-data rule)` (after `## Test quality`), `## No useless tests`; pre-existing `## Coverage of the feature` and all other sections retained verbatim.
4. No permission/frontmatter edits, no other rule text changed, no production/test/config edits.

## Decisions

- **Section name (backlog N-1).** The middle section is named `## Assertion quality (real-data rule)`, i.e. the name the **tasks.md T7 text specifies** (tasks.md T7 + plan contract 15.B use the suffix; AC-11 says `Assertion quality`). N-1 in `reviews/spec-r2.md` flagged this naming drift and allowed the builder to resolve it at T7; per the task brief I followed the tasks.md T7 text. The T7 verify grep (`## Assertion quality`) matches either form.
- **Step numbering.** Contract 14.B is an additive step "after step 5", so the inserted step is `6.` and the two pre-existing trailing steps shift `6.` → `7.` and `7.` → `8.`. No pre-existing content was removed or rewritten; the renumbering is the mechanical consequence of the additive insert (visible in the diff below).
- **Testing tiers (documented exception).** T7 changes framework prose only — no executable code path, no test/config file; the task's `verify` is inspection-based (greps + baseline diffs) per spec § Testing strategy ("Inspection evidence"). No unit/integration test is added because there is no integration boundary in this change; the repo-wide coverage gate was still rerun as evidence (below).
- Build-start baselines captured with `git show HEAD:<path>` into `/tmp/opencode/t7-baselines/` (all three files were clean vs HEAD at build start — `git diff --stat HEAD` empty for each).

## Evidence

### Branch / HEAD

```
$ git branch --show-current
feat/testing-criteria
$ git rev-parse HEAD
0784d009446ab0f1f698da929ceb7e424cda6d36
```

### `grep -in "coverage"` across all three files

```
$ grep -in "coverage" .opencode/agents/reviewer.md .opencode/skills/code-review/SKILL.md .opencode/skills/code-review/checklists/testing.md
.opencode/agents/reviewer.md:57:- At the code gate, rerun `npm run coverage` yourself: coverage below the thresholds (≥ 80% statements/branches/functions/lines per workspace), or missing unit/integration tests for changed behavior, counts as unmet; weak assertions (banned matchers, snapshot-only, assertion-free, tautological tests) are findings; inspect the coverage exclusions for number-gaming (production code excluded or thresholds lowered to pass); builder logs are claims, not evidence.
.opencode/skills/code-review/SKILL.md:18:3. Run the full verification suite yourself (commands from `AGENTS.md`, including the coverage command `npm run coverage`) — evidence over claims. Run cheap edge-case experiments where useful (corrupt save, rapid clicks, reload, offline time jump).
.opencode/skills/code-review/SKILL.md:21:6. Inspect the diff's tests against the banned-matcher list and the no-useless-tests bar (every test can fail on a real regression); verify the coverage exclusions match the spec's justified list.
.opencode/skills/code-review/SKILL.md:33:- Coverage below the advertised thresholds (`npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace) counts as unmet — the feature's coverage criterion fails.
.opencode/skills/code-review/SKILL.md:34:- Unjustified banned-matcher usage, snapshot-only or assertion-free tests, and coverage-exclusion gaming are findings — `MAJOR` unless justified in-test and accepted (the bounded exception rule: ≤ 1 per task, concrete unavoidability reason, reviewer-approved).
.opencode/skills/code-review/checklists/testing.md:1:# Testing checklist — coverage, quality, evidence
.opencode/skills/code-review/checklists/testing.md:5:## Coverage gate
.opencode/skills/code-review/checklists/testing.md:6:- [ ] `npm run coverage` rerun independently by the reviewer — both workspaces ≥ 80% on statements, branches, functions, and lines
.opencode/skills/code-review/checklists/testing.md:7:- [ ] Coverage exclusions match the spec's justified list (test files + the one composition-root entrypoint per workspace, extending Vitest's built-in defaults) — no production logic excluded, no number-gaming
.opencode/skills/code-review/checklists/testing.md:11:## Coverage of the feature
.opencode/skills/code-review/checklists/testing.md:39:- [ ] No tautologies (re-asserting values configured on the test's own mocks) and no coverage-chasing tests
.opencode/skills/code-review/checklists/testing.md:47:## Real-time coverage (if applicable)
.opencode/skills/code-review/checklists/testing.md:52:## Container coverage (if applicable)
```

### Per-file evidence for the AC-9 token (`.opencode/agents/reviewer.md` contains "coverage")

```
$ grep -c "coverage" .opencode/agents/reviewer.md
1
$ grep -in "coverage" .opencode/agents/reviewer.md
57:- At the code gate, rerun `npm run coverage` yourself: coverage below the thresholds (≥ 80% statements/branches/functions/lines per workspace), or missing unit/integration tests for changed behavior, counts as unmet; weak assertions (banned matchers, snapshot-only, assertion-free, tautological tests) are findings; inspect the coverage exclusions for number-gaming (production code excluded or thresholds lowered to pass); builder logs are claims, not evidence.
```

(Recorded per file as required by tasks.md § Grep evidence note; the combined grep above is not the sole evidence.)

```
$ grep -c "coverage" .opencode/agents/reviewer.md .opencode/skills/code-review/SKILL.md .opencode/skills/code-review/checklists/testing.md
.opencode/agents/reviewer.md:1
.opencode/skills/code-review/SKILL.md:4
.opencode/skills/code-review/checklists/testing.md:5
```

Line counts for `grep -c`; every file is independently non-zero, so no file's coverage of the token depends on another's.

### Exact section names + retained pre-existing section

```
$ grep -n "## Coverage gate\|## Assertion quality\|## No useless tests" .opencode/skills/code-review/checklists/testing.md
5:## Coverage gate
29:## Assertion quality (real-data rule)
37:## No useless tests

$ grep -n "Coverage of the feature" .opencode/skills/code-review/checklists/testing.md
11:## Coverage of the feature
```

### `git diff` vs build-start baselines

`.opencode/agents/reviewer.md` (baseline `/tmp/opencode/t7-baselines/.opencode_agents_reviewer.md`, `git show HEAD:.opencode/agents/reviewer.md`):

```diff
@@ -54,6 +54,7 @@
 
 - Determine the gate from the brief: `spec_review` → load the `spec-review` skill; `code_review` → load the `code-review` skill. Follow that skill's checklist and output format.
 - Read every artifact listed in the brief. For code review, inspect the diff file-by-file and run the verification suite yourself — a builder's log is a claim, not evidence.
+- At the code gate, rerun `npm run coverage` yourself: coverage below the thresholds (≥ 80% statements/branches/functions/lines per workspace), or missing unit/integration tests for changed behavior, counts as unmet; weak assertions (banned matchers, snapshot-only, assertion-free, tautological tests) are findings; inspect the coverage exclusions for number-gaming (production code excluded or thresholds lowered to pass); builder logs are claims, not evidence.
 - Every finding: severity (BLOCKER/MAJOR/MINOR/INFO), location (`file:line` or artifact section), what's wrong, why it matters, required action.
 - Verdict: any open BLOCKER or MAJOR → `changes_requested`. "Unable to verify" counts as unmet.
 - For features touching shared or cross-client state, apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet.
```

Additive only (frontmatter/permissions untouched), contains "coverage".

`.opencode/skills/code-review/SKILL.md` (baseline `/tmp/opencode/t7-baselines/.opencode_skills_code-review_SKILL.md`):

```diff
@@ -15,11 +15,12 @@
 
 1. Read the spec's acceptance criteria — build the verification table FIRST (one row per AC).
 2. Inspect the diff file-by-file; note anything not traceable to a task or spec.
-3. Run the full verification suite yourself (commands from `AGENTS.md`) — evidence over claims. Run cheap edge-case experiments where useful (corrupt save, rapid clicks, reload, offline time jump).
+3. Run the full verification suite yourself (commands from `AGENTS.md`, including the coverage command `npm run coverage`) — evidence over claims. Run cheap edge-case experiments where useful (corrupt save, rapid clicks, reload, offline time jump).
 4. Verify every AC: met / unmet / unable-to-verify, each with evidence (command output, `file:line`, observed behavior).
 5. Run the checklists: `checklists/security.md`, `checklists/quality.md`, `checklists/testing.md`.
-6. Verify previous-round findings (fixed / not fixed / waived with reason).
-7. Decide the verdict, write `reviews/code-r<iteration>.md` using `templates/review.md`, and return the report.
+6. Inspect the diff's tests against the banned-matcher list and the no-useless-tests bar (every test can fail on a real regression); verify the coverage exclusions match the spec's justified list.
+7. Verify previous-round findings (fixed / not fixed / waived with reason).
+8. Decide the verdict, write `reviews/code-r<iteration>.md` using `templates/review.md`, and return the report.
 
 ## Severity & verdict rules
 
@@ -29,6 +30,8 @@
 - Any open BLOCKER or MAJOR → `changes_requested`. Otherwise `approved`.
 - Every finding MUST include: severity, `file:line` (or artifact section), what's wrong, why it matters, required action.
 - "Unable to verify" counts as unmet for gate purposes — state what evidence is missing.
+- Coverage below the advertised thresholds (`npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace) counts as unmet — the feature's coverage criterion fails.
+- Unjustified banned-matcher usage, snapshot-only or assertion-free tests, and coverage-exclusion gaming are findings — `MAJOR` unless justified in-test and accepted (the bounded exception rule: ≤ 1 per task, concrete unavoidability reason, reviewer-approved).
 
 ## Rules
```

The only modified pre-existing line is contract **14.A** (workflow step 3), exactly as pinned (rest of the step retained verbatim); steps 6→7 / 7→8 are pure renumbering from the additive step insert. Everything else is additive.

`.opencode/skills/code-review/checklists/testing.md` (baseline `/tmp/opencode/t7-baselines/.opencode_skills_code-review_checklists_testing.md`):

```diff
@@ -2,6 +2,12 @@
 
 Mark each ✅ / ❌ / n/a; failures become findings with severity.
 
+## Coverage gate
+- [ ] `npm run coverage` rerun independently by the reviewer — both workspaces ≥ 80% on statements, branches, functions, and lines
+- [ ] Coverage exclusions match the spec's justified list (test files + the one composition-root entrypoint per workspace, extending Vitest's built-in defaults) — no production logic excluded, no number-gaming
+- [ ] Un-imported production files count (the report lists every non-excluded module, e.g. a never-imported file at 0%)
+- [ ] Raw command output recorded in the review — not quoted from the build log
+
 ## Coverage of the feature
 - [ ] Every acceptance criterion has direct evidence: a test, a command, or a reproducible manual step recorded in the review
 - [ ] Core logic (economy, time, persistence) has unit tests independent of the DOM
@@ -20,6 +26,19 @@
 - [ ] No flaky patterns (timing races, order dependence, shared mutable fixtures)
 - [ ] Tests fail for the right reason (spot-check one negative case where cheap)
 
+## Assertion quality (real-data rule)
+- [ ] Assertions pin concrete expected values — no `expect.anything()`, `expect.any()`, `expect.objectContaining()`, `expect.arrayContaining()`, `expect.stringContaining()`/`expect.stringMatching()`, and no loose `toMatchObject()` as a stand-in for the full expected value
+- [ ] Weak existentials (`toBeTruthy()` / `toBeDefined()` / `not.toThrow()`) are not stand-ins where a concrete value can be asserted
+- [ ] Spy/mock calls checked with concrete arguments (`toHaveBeenCalledWith(…)`), never argument-unchecked `toHaveBeenCalled()`
+- [ ] No snapshot-only tests (`toMatchSnapshot`/`toMatchInlineSnapshot` as the sole assertion) and no assertion-free tests
+- [ ] Any exception to the list above is ≤ 1 per task, carries an in-test comment naming the concrete unavoidability reason (why no exact-value assertion is possible), and is reviewer-approved (recorded in the review artifact)
+- [ ] The bar applies to new and changed tests; pre-existing tests are not retro-refactored
+
+## No useless tests
+- [ ] Every added/changed test can fail on a real regression (spot-check: "what change would break it?")
+- [ ] No tautologies (re-asserting values configured on the test's own mocks) and no coverage-chasing tests
+- [ ] Tests assert behavior/outcomes, not implementation details
+
 ## Evidence standard
 - [ ] The review records raw command names and result summaries (not "tests pass" without output)
 - [ ] Any AC marked met cites where the proof lives (test name, file:line, command)
```

Purely additive; every pre-existing section (`Coverage of the feature`, `Edge cases exercised`, `Test quality`, `Evidence standard`, `Real-time coverage`, `Container coverage`) retained unchanged; `✅/❌/n/a` marking convention and `- [ ]` item style preserved.

### Coverage gate rerun (repo-wide, as T7 itself now demands of reviewers)

```
$ npm run coverage
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8
 ✓ src/app.test.ts (4 tests) 102ms
 Test Files  1 passed (1)   Tests  4 passed (4)

 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 app.ts   |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/App.test.tsx (1 test) 9ms
 Test Files  2 passed (2)   Tests  11 passed (11)

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
EXIT=0
```

backend 100/100/100/100; frontend 92.79/92.85/100/92.79 — all four metrics ≥ 80 in both workspaces, exit 0. (Recorded as context; the full gate belongs to T9. The framework prose touched by T7 is not part of the measured surface.)

### Scope / non-destructiveness checks

- Files touched: exactly the 4 `files_owned` paths (verified by `git status --short` before commit).
- `permissions:` blocks untouched (reviewer.md frontmatter unmodified — the only hunk is in `## Rules`).
- No `.env*`, no dependencies, no branch switch, no push.
- In-place replacements in this task: exactly one — contract 14.A (`code-review/SKILL.md` workflow step 3). Everything else additive (AC-22).

## Acceptance audit

- **AC-9** → met. `reviewer.md` gains one additive rule bullet containing "coverage" (per-file `grep -c "coverage" .opencode/agents/reviewer.md` → 1; line 57 recorded above) stating the rerun, the unmet conditions (threshold shortfall / missing unit+integration tests), the assertion findings, the exclusion inspection, and "builder logs are claims, not evidence".
- **AC-10** → met. `code-review/SKILL.md`: verification-suite step names `npm run coverage` (14.A, exact pinned replacement); additive step 6 requires inspecting assertion quality against the banned list and exclusion-vs-justified-list verification; severity bullets state coverage shortfall = unmet and unjustified banned-matcher usage / snapshot-only / exclusion gaming = `MAJOR` unless justified in-test and accepted.
- **AC-11** → met. `testing.md` gains exactly three new `✅/❌/n/a` + `- [ ]` sections — `## Coverage gate` (line 5: command rerun, ≥ 80 × four metrics, justified exclusions, un-imported files counted), `## Assertion quality (real-data rule)` (line 29: concrete values, every banned matcher form named incl. weak existentials, concrete spy args, no snapshot-only/assertion-free, ≤ 1/task in-test-justified approved exception, retroactivity), `## No useless tests` (line 37) — with `## Coverage of the feature` retained (line 11) and all other sections unchanged. Middle-section naming per tasks.md T7 / plan 15.B; N-1 note above.
- **AC-22** → met for this task's files. Diffs vs build-start baselines contain only contract 9.A, 14.A–14.C and 15.A–15.C; the sole in-place replacement is 14.A (exact pinned text); steps 6→7 / 7→8 are renumbering only (no content removal).

## Deviations from spec / plan

- None in substance. Two transparency notes: (1) the middle checklist section carries the ` (real-data rule)` suffix mandated by the tasks.md T7 text and plan 15.B while AC-11 names it without the suffix (backlog **N-1**, resolved here in favor of the task text; the verify grep matches either); (2) two pre-existing workflow step numbers shifted as a mechanical consequence of the additive step insert required by contract 14.B.
