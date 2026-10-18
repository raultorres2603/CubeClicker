---
feature: testing-criteria
revision: 2
---
# Plan — Testing Acceptance Criteria

## Architecture (framework "system")

No runtime architecture: configuration, tests, and framework prose only. Three layers, all read by future agent sessions:

1. **Executable gate** — `@vitest/coverage-v8` + `coverage` scripts + workspace Vitest coverage configs. This is the only *checkable* part: `npm run coverage` exits non-zero below thresholds, so no future feature can claim done with weak coverage. Scope is honest: include `src/**/*.{ts,tsx}` (all files, imported or not); coverage `exclude` extends Vitest's built-in defaults with only test files and the one composition-root entrypoint per workspace; the frontend's test discovery is extended to `.test.tsx` so component test files are actually discovered and executed (F1 fix).
2. **Project-level doctrine** — `AGENTS.md` (§ Commands/§ Conventions/§ Boundaries/§ Project structure) and `README.md` (§ Commands) carry the short-form bar that every session sees; `docs/architecture/stack.md` § Commands mirrors the new canonical command (F3).
3. **Role guidance** — planner (specs define the strategy), builder (DoD = unit + integration tests, coverage evidence, concrete assertions, no useless tests), reviewer (rerun coverage, judge assertions, logs are claims), orchestrator + playbook (coverage evidence in the build gate and final summary). Skills carry the detail (`web-implementation` § Testing bar + `engineering-principles.md` § Testing principles; `code-review` SKILL + `testing.md`; spec-authoring/review checklists; task-decomposition rules).

**Data flow (future sessions):** planner reads the spec-authoring bar → writes specs with unit/integration/coverage expectations → task-decomposition gives behavior-change tasks test deliverables + coverage `verify:` → builder implements to the DoD and records `npm run coverage` evidence → reviewer reruns coverage and audits assertions → orchestrator reports coverage in the gate/summary.

## Interfaces / contracts

- **Scripts:** root `"coverage": "npm run coverage --workspaces --if-present"`; each workspace `"coverage": "vitest run --coverage"`. `npm test` stays `vitest run` (fast, no coverage). The gate command is `npm run coverage`; per-workspace: `npm run coverage --workspace @cubeclicker/backend` / `.../frontend`.
- **Dependency:** `"@vitest/coverage-v8": "^3.2.7"` in both workspaces' devDependencies; resolved version must equal the resolved `vitest` version exactly (peer requirement). If npm resolves a newer 3.x for the provider than the locked vitest, bump vitest to the same version (within `^3`) and record it.
- **Coverage config (both configs):** `provider: 'v8'`; `include: ['src/**/*.{ts,tsx}']`; `exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', <entrypoint>, ...coverageConfigDefaults.exclude]` — the pinned patterns **extend** Vitest's built-in defaults (import `coverageConfigDefaults` from `vitest/config`; no drop of defaults — F7) where `<entrypoint>` is `'src/server.ts'` (backend) / `'src/main.tsx'` (frontend), workspace-relative; `all: true` (un-imported production files count); `reporter: ['text']` (console only, no artifacts); `thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 }`; no `autoUpdate`, no `perFile`, no html/json reporters. If the installed Vitest's option model differs, the builder uses its documented equivalent for the same semantics and records the deviation in `build-log-T1.md` (the semantic contract above is what is pinned; exact key names follow the installed tool).
- **Test discovery (F1):** `src/frontend/vitest.config.ts` `include` becomes `['src/**/*.test.ts', 'src/**/*.test.tsx']`; `src/backend/vitest.config.ts` discovery stays `['src/**/*.test.ts']` (no `.tsx` sources in the backend). Without this, `App.test.tsx` is never discovered by the frontend suite.
- **Exception rule (assertions):** banned matcher forms are named in `engineering-principles.md` § Testing principles and `testing.md`; an exception must be (a) ≤ 1 per task, (b) justified in an in-test comment naming the concrete unavoidability reason (why no exact-value assertion is possible), (c) reviewer-approved; the reviewer records it in the review artifact (F8).

## Pinned content contracts (per file)

Baseline rule (all files): baseline = file content at that task's build start, captured in the task's build log (`git show HEAD:<path>` excerpt or verbatim copy); the build-start capture governs. Verification: `git diff` vs. that baseline plus the greps named in the ACs. Wording may vary slightly if the required tokens/concepts hold; substance is pinned. **Amendment rule:** the only in-place modifications allowed anywhere are the 16 pinned line replacements enumerated below (contracts 3.C, 6.B, 6.C, 6.E, 11.A, 11.B, 12.A, 12.B, 14.A, 16.A, 19.A, 20.A, 21.A, 21.B, 22.B, 22.C); all other changes are additive (additions include 6.A, 6.D, 22.A — 6.D is an append, never a replacement; F6).

### 1. `package.json` (root) (edit, T1)

- **1.A — script (addition).** Insert after `"test"`: `"coverage": "npm run coverage --workspaces --if-present"`. No other change (devDependencies untouched at root — the provider lives in the workspaces).

### 2. `src/backend/package.json`, `src/frontend/package.json` (edit, T1)

- **2.A — script (addition).** Add `"coverage": "vitest run --coverage"` after `"test"` in both.
- **2.B — devDependency (addition).** Add `"@vitest/coverage-v8": "^3.2.7"` to `devDependencies` in both; keep `"vitest": "^3"`. Post-install invariant: `npm ls vitest @vitest/coverage-v8` shows the same resolved version for both (adjust versions together within `^3` if npm resolves differently; record in build log). No other dependency.

### 3. `src/backend/vitest.config.ts`, `src/frontend/vitest.config.ts` (edit, T1)

- **3.A — coverage block (addition).** Add the `coverage` config pinned in § Interfaces/contracts (provider/include/exclude/all/reporter/thresholds — the exclude extends `coverageConfigDefaults.exclude`) to the `test` object; both configs' existing `environment` lines and the backend's `include` line stay unchanged.
- **3.B — justification comments.** One short comment above `exclude` naming the excluded entrypoint and why (composition root exercised by `npm run smoke`); one above `thresholds` stating the pinned 80 × four metrics. Comments are part of the contract.
- **3.C — frontend test discovery (replacement; F1).** In `src/frontend/vitest.config.ts` only: `include: ['src/**/*.test.ts']` → `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']`. The backend's discovery line is unchanged. This is the F1 fix — without it, `App.test.tsx` is never discovered or executed.

### 4. `src/frontend/src/App.test.tsx` (new, T2; requires contract 3.C)

- **4.A — integration test.** Renders `App` via `react-dom/server` (`renderToStaticMarkup` — no DOM environment, no new dependency) and asserts **concrete** expected markup values: the `CubeClicker` heading text and the initial status element (`data-status="connecting"` with the exact label `Connecting…`). Assertions pin the full expected strings (no banned matchers). The file is `.tsx` and runs only because of contract 3.C (frontend discovery extension). **Honest scope (F2a):** SSR executes `App`'s render path only — the effect callback and its cleanup (`App.tsx:17-23`) are not executed (SSR does not run effects), so those 2 functions stay uncovered without a DOM environment; this is accepted, stated in the spec, and accounted in the reachability math (D-6). If the baseline shows further module paths uncovered, extend with additional deterministic tests **within existing tooling**; if a metric still cannot clear 80, report `blocked` per Q-5 (no carve-out — F2c).

### 5. `src/frontend/src/ws/connection.test.ts`, `src/backend/src/app.test.ts` (edit, T2/T3)

- **5.A — mandated frontend top-up (F2b).** Add one test that exercises the **default socket-factory path** (`connection.ts:33-35`, `defaultSocketFactory`): stub the ambient global with a fake WebSocket class (`vi.stubGlobal('WebSocket', …)`-style — an in-process fake that records instantiations and never opens a socket; restored via `vi.unstubAllGlobals()` in `afterEach`), call `createConnection({ url, onStatus })` **without** `socketFactory`, and assert concrete values: the fake received the exact `url` (e.g., exactly one recorded instantiation for the exact url passed), plus the status sequence/teardown behavior. No real network I/O — this reconciles with the real-time testability rule (injected/faked connection, deterministic). This top-up is required for the gate: without it the frontend `functions` metric is 10/13 ≈ 76.9% (red) instead of 11/13 ≈ 84.6% (D-6).
- **5.B — conditional top-ups.** Beyond 5.A, add tests only for behavior the baseline reports uncovered; each new test asserts concrete expected values (e.g., exact status sequences, exact envelope fields) using the existing deterministic style (fake timers, injected factories). If no further gap exists, the evidence is the recorded passing run and a zero-change note — no cosmetic tests. Banned matchers must not appear in any added test (grep evidence); weak existentials must not be used as stand-ins.

### 6. `AGENTS.md` (edit, T4)

- **6.A — § Commands (addition).** One bullet after `npm test`: ``- `npm run coverage` — Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace; part of the build gate).``
- **6.B — § Conventions (replacement).** `- Tests accompany every behavior change.` → `- Tests accompany every behavior change: unit tests and integration tests with concrete expected values (no wildcard matchers), and no useless tests; coverage stays ≥ 80% (statements, branches, functions, lines) per workspace, verified with `npm run coverage`.`
- **6.C — § Boundaries ✅ (replacement).** `run lint, typecheck, and tests before reporting done` → `run lint, typecheck, tests, and the coverage command before reporting done`. Rest of the line unchanged.
- **6.D — § Boundaries 🚫 (addition).** Append to the Never list: `weaken assertions (wildcard matchers, snapshot-only or assertion-free tests) or exclude production code from coverage without a justified, reviewer-approved reason`. This is an addition to the Never list, never counted as a replacement (F6).
- **6.E — § Project structure (replacement; F4).** `Unit tests are colocated beside the sources they cover (\`*.test.ts\`, inside each workspace).` → `Unit tests are colocated beside the sources they cover (\`*.test.ts\` / \`*.test.tsx\`, inside each workspace).` No other sections change.

### 7. `README.md` (edit, T4)

- **7.A — § Commands table (addition).** One row after `npm test`: `| \`npm run coverage\` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |`. Nothing else.

### 8. `.opencode/agents/builder.md` (edit, T6)

- **8.A — Rules (addition).** One bullet: every behavior change ships with unit tests **and** integration tests (per the `web-implementation` skill's tiers); assertions use concrete expected data — banned matchers listed as `ItIsAny`-equivalents, no useless tests; and the coverage gate (`npm run coverage`, thresholds ≥ 80) is part of the task's verify evidence. Contains "coverage" and "integration". No other change.

### 9. `.opencode/agents/reviewer.md` (edit, T7)

- **9.A — Rules (addition).** One bullet: at the code gate, rerun `npm run coverage` yourself — coverage below thresholds or missing unit/integration tests for changed behavior count as unmet; weak assertions (banned matchers, snapshot-only, assertion-free, tautological tests) are findings; inspect coverage exclusions for number-gaming; builder logs are claims, not evidence. Contains "coverage". No other change.

### 10. `.opencode/agents/planner.md` (edit, T5)

- **10.A — Rules (addition).** One bullet: every spec's § Testing strategy must define the unit + integration test tiers and the coverage expectation at the project bar (`npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace, concrete assertions, no useless tests), and tasks.md must give every behavior-change task test deliverables plus a coverage verify step. Contains "coverage" and "integration". No other change.

### 11. `.opencode/agents/orchestrator.md` (edit, T8)

- **11.A — Gates line (replacement).** `- Build gate: verdict \`approved\` with every acceptance criterion green → accepted;` → `- Build gate: verdict \`approved\` with every acceptance criterion green, including recorded coverage-run evidence (\`npm run coverage\`, thresholds ≥ 80) → accepted;`
- **11.B — Accepted-summary line (replacement).** Inside the `accepted` bullet, `evidence (verification commands and results)` → `evidence (verification commands and results, including the coverage run and per-workspace numbers)`. No other change.

### 12. `.opencode/skills/web-implementation/SKILL.md` (edit, T6)

- **12.A — Workflow step 4 (replacement).** Current step: write/adjust tests as you go with an explicit reason for visual-only cases. New: write unit **and** integration tests as you go (see § Testing bar; a documented exception is required when a change has no integration boundary), and make the coverage gate part of your run: `npm run coverage` enforces thresholds ≥ 80% statements/branches/functions/lines per workspace — a shortfall blocks reporting.
- **12.B — Definition of Done (replacement + additions).** Item `Tests added/updated for behavior changes` → `Unit tests and integration tests added/updated for behavior changes (documented exception when no integration boundary exists)`; add items: `Coverage gate green: npm run coverage passes (≥80% statements/branches/functions/lines per workspace) with raw output in the build log`; `Assertions use concrete expected values; no banned wildcard matchers without the bounded exception rule (≤ 1 per task, in-test-justified unavoidability reason, reviewer-approved)`; `No useless tests: each added test can fail on a real regression (no tautologies, no coverage-chasing)`. Existing items retained.
- **12.C — `## Testing bar` section (addition, before Definition of Done).** Defines: the two tiers (unit = one module with injected dependencies; integration = modules through real boundaries — route/WS in-process, component render, containerized smoke as cross-service e2e); the banned-matcher list (`expect.anything()`, `expect.any()`, `objectContaining`, `arrayContaining`, `stringContaining`/`stringMatching`, loose `toMatchObject`, argument-unchecked `toHaveBeenCalled()`, snapshot-only, assertion-free, and weak existentials as stand-ins — `toBeTruthy`/`toBeDefined`/`not.toThrow` where a concrete value can be asserted) with the exception rule (≤ 1 per task, in-test-commented unavoidability reason, reviewer-approved); determinism (fake timers, injected clocks/ids/factories; never weaken assertions); the no-useless-tests bar; the coverage metric (four metrics ≥ 80 per workspace, `npm run coverage`, exclusions pinned in the configs); retroactivity (the bar applies to new/changed tests; existing tests are not retro-refactored); depth pointer to `references/engineering-principles.md` § Testing principles.

### 13. `.opencode/skills/web-implementation/references/engineering-principles.md` (edit, T6)

- **13.A — `## Testing principles` section (addition).** Covers at least: test tiers with this repo's boundaries; concrete-assertion rule + banned-matcher list (Vitest names, including weak existentials as stand-ins for concrete values; "real approach data" framing; determinism guidance — parse timestamps into concrete values and assert bounds, fake timers, injected clocks/ids, never weaken assertions to dodge flakiness); the exception rule (≤ 1 per task, in-test-commented unavoidability reason, reviewer-approved); retroactivity (applies to new/changed tests; no retro-refactor); no-useless-tests bar (fail-on-regression test; no tautologies, coverage-chasing, implementation-detail assertions); coverage policy (all-files semantics, justified exclusions only, no number-gaming; the aggregate-vs-per-file note); spy/mock discipline (concrete `toHaveBeenCalledWith(...)` or outcome assertions; prefer injected fakes over global mocks — and note the sanctioned pattern for exercising ambient defaults: stub the global with an in-process fake, no real network, restore after each test).

### 14. `.opencode/skills/code-review/SKILL.md` (edit, T7)

- **14.A — Workflow step 3 (replacement).** `Run the full verification suite yourself (commands from \`AGENTS.md\`)` → `Run the full verification suite yourself (commands from \`AGENTS.md\`, including the coverage command \`npm run coverage\`)`; rest of the step retained.
- **14.B — Workflow step addition.** After step 5 (checklists), add: inspect the diff's tests against the banned-matcher list and the no-useless-tests bar (every test can fail on a real regression); verify coverage exclusions match the spec's justified list.
- **14.C — Severity rules (addition).** Add: coverage below the advertised thresholds counts as unmet (the feature's coverage criterion fails); unjustified banned-matcher usage, snapshot-only/assertion-free tests, or exclusion gaming are findings (MAJOR unless justified in-test and accepted).

### 15. `.opencode/skills/code-review/checklists/testing.md` (edit, T7)

- **15.A — `## Coverage gate` section (addition, at the top; named `## Coverage gate` — distinct from the pre-existing `## Coverage of the feature` section, which stays unchanged).** Items: (1) `npm run coverage` rerun independently — both workspaces ≥ 80% on statements, branches, functions, and lines; (2) coverage exclusions match the spec's justified list (test files + the one entrypoint per workspace, extending the built-in defaults) — no production logic excluded, no number-gaming; (3) un-imported production files count (report lists every non-excluded module); (4) raw command output recorded in the review, not quoted from the build log.
- **15.B — `## Assertion quality (real-data rule)` section (addition, after Test quality).** Items: concrete expected values (no `expect.anything()`/`expect.any()`/`objectContaining`/`arrayContaining`/`stringContaining`/`stringMatching`/loose `toMatchObject` as stand-ins; weak existentials — `toBeTruthy`/`toBeDefined`/`not.toThrow` — are not stand-ins for a concrete expected value); spy calls checked with concrete arguments (`toHaveBeenCalledWith(…)`), never argument-unchecked `toHaveBeenCalled()`; no snapshot-only or assertion-free tests; any exception ≤ 1 per task, in-test-commented with the concrete unavoidability reason, reviewer-approved; the bar applies to new/changed tests (no retro-refactor expectation for pre-existing tests).
- **15.C — `## No useless tests` section (addition).** Items: every test can fail on a real regression (spot-check: "what change would break it?"); no tautologies (re-asserting values configured on the test's own mocks) and no coverage-chasing; tests assert behavior/outcomes, not implementation details. Existing sections retained.

### 16. `.opencode/skills/spec-authoring/SKILL.md` (edit, T5)

- **16.A — Workflow step 7 (replacement).** `Testing strategy: what is unit vs e2e, which commands verify what (from \`AGENTS.md\`).` → `Testing strategy: unit vs integration vs containerized e2e tiers, which commands verify what (from \`AGENTS.md\`), and the coverage expectation — \`npm run coverage\`, ≥ 80% statements/branches/functions/lines per workspace — with the project assertion/no-useless-tests bar.` One line; nothing else changes.

### 17. `.opencode/skills/spec-authoring/references/spec-checklist.md` (edit, T5)

- **17.A — § Testing strategy (additions).** Add items: unit + integration tiers defined; the exact coverage command (`npm run coverage`) and thresholds (≥ 80% × four metrics, per workspace) named, or a justified deviation; the assertion-quality bar (concrete expectations; banned wildcard matchers; no useless tests) reflected where test design is specified; every behavior-change task carries test deliverables and a coverage verify step. Existing items retained.

### 18. `.opencode/skills/spec-authoring/templates/spec.md` (edit, T5)

- **18.A — § Testing strategy block (addition).** Add lines `- Integration: …` after Unit and `- Coverage: \`npm run coverage\` — thresholds ≥ 80% (statements, branches, functions, lines), per workspace.` after E2E; keep Unit/E2E/Verification-commands lines.

### 19. `.opencode/skills/spec-review/SKILL.md` (edit, T5)

- **19.A — Testing checklist item (replacement).** `- **Testing** — strategy present; commands exist in \`AGENTS.md\`; relevant edge cases named.` → `- **Testing** — strategy present with unit + integration tiers; commands exist in \`AGENTS.md\`; the coverage expectation names \`npm run coverage\` with thresholds ≥ 80% (statements, branches, functions, lines) per workspace; assertion-quality and no-useless-tests bars referenced; relevant edge cases named.` One item; nothing else changes.

### 20. `.opencode/skills/task-decomposition/SKILL.md` (edit, T5)

- **20.A — Rule 2 (replacement).** Rule 2's item list gains the testing obligation: behavior-change tasks carry their test files in `files_owned` and their `verify:` includes the coverage command (`npm run coverage`, workspace-scoped pre-gate form acceptable). Suggested text: `Every task has: depends_on, files_owned, verify (exact commands from AGENTS.md — behavior-change tasks include the coverage command), acceptance (AC ids it satisfies), status: [ ]`. Rule 7's acyclic rule and everything else unchanged.

### 21. `.opencode/skills/orchestration-playbook/SKILL.md` (edit, T8)

- **21.A — § 1 transition (replacement).** `building → code_review when every task in \`tasks.md\` is \`[x]\`.` → append `and every behavior-change task's build log records its coverage run.`
- **21.B — § 7 summary (replacement).** In the final-summary sentence, `evidence (verification commands and results)` → `evidence (verification commands and results, including the coverage run and per-workspace numbers)`. No other change.

### 22. `docs/architecture/stack.md` (edit, T4; F3/F4)

F3 decision: stack.md is **edited, not grandfathered** — its § Commands declares itself "Canonical commands, mirrored in `AGENTS.md` § Commands" and line 51 enumerates the canonical commands; adding `npm run coverage` to AGENTS.md/README while leaving stack.md stale would falsify that mirror claim and AC-23's "documented reality matches". The edit is a commands mirror + one test-pattern phrase; it changes no stack decision (the stack and its DECIDED status are untouched; the command joins `npm run smoke`/`dev` as an operational entry that was already mirrored there).

- **22.A — § Commands table (addition).** One row after `| \`npm test\` | Vitest, all workspaces |`: `| \`npm run coverage\` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |`.
- **22.B — canonical-commands parenthetical (replacement).** `(lint / typecheck / test / build / dev / smoke)` → `(lint / typecheck / test / coverage / build / dev / smoke)` in the closing paragraph.
- **22.C — § Application stack test-colocation phrase (replacement; F4).** `unit tests colocated as \`*.test.ts\` beside the sources they cover` → `unit tests colocated as \`*.test.ts\` / \`*.test.tsx\` beside the sources they cover` (same staleness discipline as 6.E). No other change to stack.md.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `package.json` | Edit (+1 script) | Root `coverage` script | T1 |
| `src/backend/package.json` | Edit (+1 script, +1 devDep) | Workspace coverage script + provider | T1 |
| `src/frontend/package.json` | Edit (+1 script, +1 devDep) | Workspace coverage script + provider | T1 |
| `package-lock.json` | Edit (npm-generated) | Provider + transitive dev tree | T1 |
| `src/backend/vitest.config.ts` | Edit (+coverage block) | Thresholds/scope/entrypoint exclusion | T1 |
| `src/frontend/vitest.config.ts` | Edit (+coverage block; ±include line) | Thresholds/scope/entrypoint exclusion; `.tsx` discovery (3.C) | T1 |
| `src/frontend/src/App.test.tsx` | New | Integration test for the App shell (concrete markup) | T2 |
| `src/frontend/src/ws/connection.test.ts` | Edit (1 mandated + conditional) | Default-socket-factory top-up (5.A) + measured-gap top-ups (5.B) | T2 |
| `src/backend/src/app.test.ts` | Edit (conditional) | Gap top-ups per baseline | T3 |
| `AGENTS.md` | Edit (2 additions + 3 line touches) | Commands row; Conventions bar; Boundaries lines; Project-structure pattern (6.E) | T4 |
| `README.md` | Edit (+1 table row) | Commands mirror | T4 |
| `docs/architecture/stack.md` | Edit (+1 table row, 2 line touches) | Commands mirror (22.A–22.C; F3) | T4 |
| `.opencode/agents/planner.md` | Edit (+1 rule) | Specs define the testing bar | T5 |
| `.opencode/skills/spec-authoring/SKILL.md` | Edit (1 line) | Workflow testing step | T5 |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` | Edit (+items) | Spec-gate testing items | T5 |
| `.opencode/skills/spec-authoring/templates/spec.md` | Edit (+2 lines) | Testing-strategy block | T5 |
| `.opencode/skills/spec-review/SKILL.md` | Edit (1 item) | Spec-gate testing check | T5 |
| `.opencode/skills/task-decomposition/SKILL.md` | Edit (rule 2) | Test + coverage verify obligation | T5 |
| `.opencode/agents/builder.md` | Edit (+1 rule) | Builder DoD rule | T6 |
| `.opencode/skills/web-implementation/SKILL.md` | Edit (step + DoD + section) | Testing bar + coverage gate | T6 |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | Edit (+1 section) | Testing principles depth | T6 |
| `.opencode/agents/reviewer.md` | Edit (+1 rule) | Coverage/assertion verification | T7 |
| `.opencode/skills/code-review/SKILL.md` | Edit (step + rule) | Run coverage; judge assertions | T7 |
| `.opencode/skills/code-review/checklists/testing.md` | Edit (+3 sections) | Coverage gate, assertion quality, no useless tests | T7 |
| `.opencode/agents/orchestrator.md` | Edit (2 lines) | Build-gate evidence; summary | T8 |
| `.opencode/skills/orchestration-playbook/SKILL.md` | Edit (2 lines) | Transition evidence; summary | T8 |
| `docs/features/testing-criteria/build-log-T1.md` … `-T9.md` | New | Per-task evidence | T1…T9 |

Planner artifacts (`spec.md`, `plan.md`, `tasks.md`) and review verdicts (`reviews/**`) are written by the planner/reviewer per the workflow, not by build tasks. All files are inside the builder's current edit allowlist (`src/**`, `tests/**`, root/workspace `package.json`, `*.config.*`, `package-lock.json`, `README.md`, `AGENTS.md`, `docs/architecture/**`, `.opencode/agents/*.md`, `.opencode/skills/**`, `docs/features/**/build-log*.md`) — **no permission bootstrap exists in this feature**; no `permissions:` entry is touched (AC-21).

## Files intentionally unchanged

| Path | Why no change |
| --- | --- |
| `src/**` production modules (`app.ts`, `server.ts`, `App.tsx`, `main.tsx`, `connection.ts`) | No application behavior change is in scope; the gate measures them, tests cover them. |
| `.opencode/skills/code-review/checklists/quality.md`, `security.md` | Assertion/coverage judging is testing.md's remit; duplicating it in quality/security adds noise without behavior change (this feature adds no security surface). |
| `.opencode/skills/task-decomposition/templates/tasks.md`, `.opencode/skills/spec-authoring/templates/plan.md` | The normative rule lives in the SKILLs; template examples stay generic ("<cmd1>") so no future spec is forced into a stale command name. |
| `.opencode/skills/spec-review/templates/review.md`, `.opencode/skills/code-review/templates/review.md` | Verdict/finding formats unchanged; the new checks surface as ordinary findings. |
| `.opencode/skills/orchestration-playbook` § 3 example brief, agent frontmatter/permissions | Routing mechanics and permissions unchanged; no new phase exists to brief. |
| `compose.yaml`, `compose.smoke.yaml`, `src/*/Dockerfile`, `tests/e2e/smoke.mjs` | No containerization impact (spec § Security considerations); the smoke test already exercises both excluded entrypoints. |
| `docs/product/**`, other `docs/features/**` | Out of scope; no product direction change. |
| `eslint.config.mjs`, `tsconfig*.json`, `vite.config.ts` | Coverage is a Vitest-only concern; no lint/type/build config change needed. |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | All four metrics (statements/branches/functions/lines) ≥ 80 per workspace, aggregate | Closes metric-picking loopholes; the request's "80%" is a floor, not a metric pick; aggregate (not per-file) suits tiny modules | Lines-only — rejected (branch gaps pass); per-file — deferred (noisy at this size; Q-3) |
| D-2 | `@vitest/coverage-v8` pinned version-aligned with vitest (resolved versions identical) | The provider has an exact peer requirement (`vitest@3.2.7`); misalignment breaks the run | `^3` unaligned — rejected (peer mismatch risk); istanbul provider — rejected (instrumentation overhead; v8 is recommended) |
| D-3 | Script name `coverage`; root delegates `--workspaces --if-present`; `npm test` unchanged | Mirrors the existing `typecheck`/`test`/`build` pattern; keeps the fast test loop fast; the gate is explicit | `test:coverage` — rejected (house style uses verb names); enabling coverage in `npm test` — rejected (slow default; thresholds should fail the dedicated gate) |
| D-4 | Include `src/**/*.{ts,tsx}` with all-files semantics; coverage `exclude` extends the built-in defaults with only the test patterns + the one entrypoint per workspace (F7); frontend test discovery extended to `.test.tsx` (contract 3.C) | Prevents "don't import it" gaming; entrypoints are composition roots exercised by the containerized smoke; extending defaults keeps Vitest's standard exclusions in place (none dropped, fully auditable); `.tsx` discovery is required for `App.test.tsx` to run at all (F1) | Exclude App.tsx/UI shell — rejected (gaming); no exclusions — rejected (gate unreachable without punishing untestable entrypoints); replacing the defaults silently — rejected (unauditable); re-pinning the test to `.test.ts` — rejected (see D-12) |
| D-5 | `reporter: ['text']` only | Console evidence, no artifacts (brief constraint); default reporters would write html/clover/json | Default reporters — rejected; text+json for machine parsing — rejected (no consumer; artifacts not allowed) |
| D-6 | Close the frontend gap with an SSR render test **plus the mandated default-socket-factory top-up** (5.A); backend gap closes only if measured | No new dependency (no DOM env); honest math: SSR covers only `App`'s render path (effect callback/cleanup stays uncovered — 2 of 13 functions); functions 9/13 ≈ 69% baseline → 11/13 ≈ 84.6% with the top-up (without it 10/13 ≈ 76.9%, red); statements/lines residue ≈ 2 of ~65; T1 is the measured ground truth | jsdom/happy-dom — rejected (unsanctioned dependency; a follow-up spec + user decision would be required); per-file carve-out — rejected (unlawful; F2c); SSR test only — rejected (functions gate red without the top-up) |
| D-7 | Ban list scope: the brief's enumerated forms + snapshot-only + assertion-free + weak existential stand-ins; `closeTo` exceptional (≤ 1 per task, in-test-commented, reviewer-approved) | Matches the request ("ItIsAny or something like that") with Vitest names; determinism, not weakening, is the remedy; the exception is bounded (F8) | Banning `closeTo` outright — rejected (float math may need it rarely); banning `toHaveBeenCalledTimes` — rejected (a real count assertion); banning `toBeDefined` etc. outright — rejected (they can be meaningful; only stand-in use is barred) |
| D-8 | Baseline measured at T1 and recorded; the feature closes the small measured gap with the mandated close-path; if a metric still cannot clear 80, the task reports `blocked` (orchestrator options per Q-5), never dependency/exception inflation | Cold-start policy from the brief; keeps the feature self-consistent (gate green at end); the corrected math (D-6) shows no such block is expected | Pre-pinning tests without measurement — rejected (guesswork); deferring the gate to a later feature — rejected (feature must end green); in-feature carve-outs — rejected (unlawful; F2c) |
| D-9 | 16 framework content files + the `docs/architecture/stack.md` commands mirror (17 targeted); quality/security checklists, task/spec plan templates, review templates unchanged | Proportionate: each edited file has a distinct future-reader role; testing-bar content lives once (testing.md + web-implementation skill chain); stack.md must mirror the new canonical command or its own mirror claim goes stale (F3) | Blanket-updating all skills — rejected (noise); orchestrator/playbook untouched — rejected (the gate evidence must be visible to routing/summary); grandfathering stack.md — rejected (falsifies its "mirrored in AGENTS.md" claim; F3) |
| D-10 | Baselines captured at build start per task (carried from precedents) | Repo state moves; plan-time quotes go stale | Plan-time-only baselines — rejected as brittle |
| D-11 | Amendment trace pinned: in-place line replacements enumerated (**16** — 3.C, 6.B, 6.C, 6.E, 11.A/B, 12.A/B, 14.A, 16.A, 19.A, 20.A, 21.A/B, 22.B/C), everything else additive (6.D, 22.A additions labeled; F6) | Keeps the feature non-destructive and reviewer-checkable (AC-22); precedents' pattern | Free-form edits — rejected (unverifiable diffs) |
| D-12 | F1 fix: extend the frontend Vitest discovery `include` to `['src/**/*.test.ts', 'src/**/*.test.tsx']` (contract 3.C) rather than re-pin `App.test.tsx` to a `.test.ts` file using `React.createElement` | Component tests live naturally in `.tsx` (JSX); future component tests work with no further config change; minimal diff (one appended glob element); the file name pinned in AC-5 stays stable | Re-pin to `.test.ts` with `createElement` + `renderToStaticMarkup` — viable (no config change) but forces non-JSX tests and leaves the next `.tsx` test hitting the same discovery wall; rejected |

## Risks & mitigations

- **Version misalignment** (`@vitest/coverage-v8` vs `vitest`) → D-2 + explicit `npm ls` verify + adjust both within `^3` and record.
- **Baseline worse than estimated** (a metric's measured ceiling below 80 despite the mandated close-path) → close with deterministic DOM-free tests within existing tooling (D-6); if a metric still cannot clear 80 with meaningful tests, T2 reports `blocked` and the orchestrator surfaces the lawful options (follow-up spec for a DOM-environment dependency; user-owned threshold amendment) — **no in-feature carve-out**, never gaming, never unsanctioned deps (F2c).
- **Config-pinned discovery vs. new file extension** (F1 class: a pinned "unchanged" glob that can never match the new test file) → contract 3.C extends the frontend discovery `include`; T2's verify requires the transcript to show `src/App.test.tsx` discovered and executed; T9 re-checks (AC-24); any mismatch is a `blocked` report, not a workaround.
- **Accepted residual: App effect path uncovered** (SSR never runs effects — the callback/cleanup at `App.tsx:17-23`, 2 functions) → stated honestly in spec § Testing strategy, contract 4.A, and D-6; accounted in the functions math (ceiling 11/13 ≈ 84.6%); the T9 per-AC table records it as a known, reviewer-visible residual.
- **T1's verify is expected non-zero** (thresholds fail at baseline) → T1's contract: record the baseline transcript and exit codes; the *final* gate (T9) requires exit 0; the builder must not "fix" by lowering thresholds or excluding code (🚫 boundary).
- **Entrypoint exclusion read as gaming** → justification pinned (composition roots; smoke test compensates), listed in config comments + spec AC-2 + Q-2; reviewer inspects.
- **Per-task coverage runs in parallel batches** (T2/T3) would see each other's gaps if run repo-wide → each task verifies with the workspace-scoped form (`npm run coverage --workspace @cubeclicker/<ws>`); T9 runs the full gate.
- **Framework-claim drift** (docs name a command/metric that differs from configs) → AC-23 cross-file consistency check at T9; greps for `npm run coverage` and `80`.
- **Test quality erosion** (future tests technically passing the gate but weak) → assertion-quality + no-useless-tests sections are reviewer-enforced with spot-check phrasing; exceptions require in-test comments + review artifacts.
- **Report artifacts leak into the repo** (default reporters) → D-5 text-only; `git status --short` check at T1/T9; `coverage/` already gitignored.
- **Instruction bloat** → each framework edit is one rule/line/section with a depth pointer; ~3–15 lines per file.

## Open questions

- **Q-1** — Metric strictness (all four vs lines-only): pinned as all four; keep recommended; a future user-owned amendment can loosen. (spec Q-1)
- **Q-2** — Entrypoint exclusions: pinned; alternative (spawn-based entrypoint tests) rejected as disproportionate/flaky; any further exclusion requires spec revision + reviewer approval. (spec Q-2)
- **Q-3** — Per-file thresholds: deferred future tightening. (spec Q-3)
- **Q-4** — `closeTo` policy: exceptional — ≤ 1 per task, in-test comment naming the concrete unavoidability reason, reviewer-approved. (spec Q-4)
- **Q-5** — Gap-closing contingency (corrected r2 — F2c): the corrected math shows the gate clears within existing tooling (functions 11/13 ≈ 84.6% with the mandated top-up); if measurement still leaves a metric unreachable at ≥ 80 with meaningful tests, T2 reports `blocked` and the orchestrator surfaces the lawful options (follow-up spec for a dev-only DOM-environment dependency; user-owned threshold amendment). No in-feature carve-out exists — thresholds below 80, `perFile`, and further exclusions are outside this feature's boundaries. (spec Q-5)
- **Q-6** — Local-only enforcement (no CI); future CI may wire `npm run coverage` into a pipeline. (spec Q-6)
