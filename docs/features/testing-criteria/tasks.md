# Tasks — Testing Acceptance Criteria

Dependency overview: `T1 → {T2 … T8} → T9`. T2–T8 are pairwise disjoint `files_owned` with a single earlier dependency (T1) → all marked `[P]`; the orchestrator schedules them in batches of ≤3 (playbook §4). T9 is the final verification gate `[seq]`.

**No permission bootstrap exists in this feature:** every target file is already inside the builder's edit allowlist (`src/**`, root/workspace `package.json`, `*.config.*`, `package-lock.json`, `README.md`, `AGENTS.md`, `docs/architecture/**`, `.opencode/agents/*.md`, `.opencode/skills/**`, `docs/features/**/build-log*.md`). No task modifies any `permissions:` block (AC-21).

**Baseline note:** T1 measures the repo's current coverage (unknown pre-build) and records it in `build-log-T1.md` as the baseline (`npm run coverage` transcript: per-workspace, per-metric numbers + exit codes; `npm ls vitest @vitest/coverage-v8`; proof the report counts the not-yet-imported `src/frontend/src/App.tsx` at 0%). Expected frontend functions baseline: ≈ 9/13 ≈ 69% (plan D-6). A non-zero coverage exit at T1 is the expected baseline, not a failure to fix by lowering thresholds or excluding code — the close-path is the mandated T2 top-up plus the App render test (plan D-6/contract 5.A). If any metric still cannot clear 80 with meaningful tests, the task reports `blocked` (no carve-out — spec Q-5; 🚫 boundary). The final gate (T9) requires exit 0.

**Per-task coverage note:** while T2/T3 run in parallel batches, each verifies with its workspace-scoped coverage command (`npm run coverage --workspace @cubeclicker/<ws>`); the full `npm run coverage` gate runs at T9.

**Grep evidence note:** multi-file OR-style greps are advisory only — a token landing in one file can mask its absence from another. AC-6/AC-9 token evidence must be recorded **per file** (e.g., `grep -c "coverage" <file>` for each file listed in the task), never as a combined grep alone.

**Commit staging note:** every task commit stages only that task's `files_owned` paths (explicit `git add` of those paths) — never `git add .` or `git add -A`; never push.

## T1 — Coverage tooling + baseline measurement `[seq]`
depends_on: —
files_owned: `package.json`, `src/backend/package.json`, `src/frontend/package.json`, `package-lock.json`, `src/backend/vitest.config.ts`, `src/frontend/vitest.config.ts`, `docs/features/testing-criteria/build-log-T1.md`
verify: `npm install` (adds `@vitest/coverage-v8@^3.2.7` to both workspaces + lockfile); `npm ls vitest @vitest/coverage-v8` (resolved versions identical, both 3.2.7-line); frontend discovery applied — `grep -n "include" src/frontend/vitest.config.ts` shows `['src/**/*.test.ts', 'src/**/*.test.tsx']` and the backend's stays `['src/**/*.test.ts']` (contract 3.C; record the include lines in the build log); `npm run coverage` (record full transcript: per-workspace per-metric numbers + exit codes as the baseline; non-zero expected where below 80 — do NOT lower thresholds or exclude code); `npm test` → 0; `npm run lint` → 0; `npm run typecheck` → 0; `git status --short` (no `coverage/` report artifacts — text-only reporter)
acceptance: AC-1, AC-2, AC-3, AC-22 (contracts 1–3), supports AC-24
status: [x]

Apply plan contracts 1–3: root `coverage` script delegating via `--workspaces --if-present`; workspace `coverage` scripts (`vitest run --coverage`); `@vitest/coverage-v8` devDependency in both workspaces, version-aligned with the installed vitest (adjust both within `^3` if npm resolves differently; record); the pinned coverage block in both Vitest configs (v8; include `src/**/*.{ts,tsx}`; exclude extends `coverageConfigDefaults.exclude` with test files + the one entrypoint per workspace — `src/server.ts` / `src/main.tsx` — with justification comments; all-files semantics; `reporter: ['text']`; thresholds 80 × statements/branches/functions/lines; no `autoUpdate`/`perFile`; if the installed Vitest uses different option names for the same semantics, use its documented equivalent and record the deviation); and the **frontend test-discovery extension** (3.C: `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']` — the F1 fix; backend discovery unchanged). Baseline transcript + version alignment + App.tsx-at-0% proof + include-line captures recorded in `build-log-T1.md`. Commit `chore: add V8 coverage gate with 80% thresholds and measure baseline (T1)`.

## T2 — Frontend tests to close the baseline gap `[P]`
depends_on: T1
files_owned: `src/frontend/src/App.test.tsx`, `src/frontend/src/ws/connection.test.ts`, `docs/features/testing-criteria/build-log-T2.md`
verify: `npm run coverage --workspace @cubeclicker/frontend` → 0 with statements/branches/functions/lines all ≥80 (record transcript + before/after numbers); `npm test --workspace @cubeclicker/frontend` → 0 **and its transcript shows `src/App.test.tsx` discovered and executed** (file listed with ≥ 1 passing test — F1/AC-24 discovery proof; if the file is absent from the output, stop and report `blocked`, do not proceed); `grep -n "stubGlobal" src/frontend/src/ws/connection.test.ts` → present (the mandated 5.A default-factory top-up); `npm run typecheck --workspace @cubeclicker/frontend` → 0; `grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchSnapshot|toMatchInlineSnapshot|toHaveBeenCalled\(\)" src/frontend/src/*.test.* src/frontend/src/ws/*.test.*` → no matches in added content; `git diff` vs build-start baselines recorded in `build-log-T2.md`
acceptance: AC-5 (frontend), AC-24, AC-22 (contracts 4–5), supports AC-4
status: [x]

Apply plan contracts 4–5 (frontend): add `App.test.tsx` rendering `App` via `react-dom/server` and asserting concrete expected markup (heading text; `data-status="connecting"` with the exact label — no banned matchers); add the **mandated** `connection.test.ts` top-up per 5.A (default socket-factory path via a stubbed global fake class — `vi.stubGlobal`, no real network I/O, restored in `afterEach`; assert concrete values: the exact url recorded by the fake plus the status sequence/teardown); then close any further measured gap per 5.B with deterministic top-ups (fake timers, injected factories). No DOM-environment dependency, no carve-out: if the gap cannot be closed within existing tooling, stop and report `blocked` so the orchestrator surfaces the Q-5 options. Commit `test: cover the app shell to the 80% gate (T2)`.

## T3 — Backend tests to close the baseline gap `[P]`
depends_on: T1
files_owned: `src/backend/src/app.test.ts`, `docs/features/testing-criteria/build-log-T3.md`
verify: `npm run coverage --workspace @cubeclicker/backend` → 0 with all four metrics ≥80 (record transcript + before/after numbers; if the T1 baseline already passes and no uncovered behavior exists, record the passing run + zero-change note); `npm test --workspace @cubeclicker/backend` → 0; `npm run typecheck --workspace @cubeclicker/backend` → 0; `grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchSnapshot|toMatchInlineSnapshot|toHaveBeenCalled\(\)" src/backend/src/*.test.ts` → no matches in added content; `git diff` vs build-start baseline recorded in `build-log-T3.md`
acceptance: AC-5 (backend), AC-22 (contract 5), supports AC-4
status: [x]

Apply plan contract 5 (backend): add tests only for behavior the T1 baseline reports uncovered (concrete expected values, existing deterministic style — e.g., exact envelope fields, concrete status codes). No cosmetic tests: a baseline with no gap ends the task as record-only evidence. Commit `test: cover backend gaps to the 80% gate (T3)`.

## T4 — Project-level doctrine: AGENTS.md + README + stack.md mirror `[P]`
depends_on: T1
files_owned: `AGENTS.md`, `README.md`, `docs/architecture/stack.md`, `docs/features/testing-criteria/build-log-T4.md`
verify: `grep -n "npm run coverage" AGENTS.md README.md docs/architecture/stack.md`; `grep -n "integration" AGENTS.md`; `grep -n "80" AGENTS.md README.md docs/architecture/stack.md`; `grep -n "test.tsx" AGENTS.md docs/architecture/stack.md` (the 6.E/22.C pattern lines); `git diff` vs build-start baselines (record in `build-log-T4.md`; in-place replacements exactly contracts 6.B/6.C/6.E and 22.B/22.C — nothing else)
acceptance: AC-19, AC-20, AC-22 (contracts 6–7, 22), supports AC-23
status: [x]

Apply plan contracts 6–7 and 22: § Commands coverage bullet (mirroring the README row and the stack.md row); § Conventions testing-bar replacement (unit + integration, concrete assertions, no useless tests, ≥80 × four metrics via `npm run coverage`); § Boundaries ✅ coverage addition + 🚫 assertion-weakening/exclusion-gaming addition; § Project structure pattern line (6.E — `.test.ts` / `.test.tsx`); stack.md § Commands row (22.A) + canonical-commands list (22.B) + test-colocation phrase (22.C) — a commands mirror only; no stack decision is touched. No other sections change. Commit `docs: state the 80% testing bar in AGENTS.md, README, and the stack.md mirror (T4)`.

## T5 — Planner-facing guidance: spec authoring, spec review, task decomposition `[P]`
depends_on: T1
files_owned: `.opencode/agents/planner.md`, `.opencode/skills/spec-authoring/SKILL.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`, `.opencode/skills/spec-authoring/templates/spec.md`, `.opencode/skills/spec-review/SKILL.md`, `.opencode/skills/task-decomposition/SKILL.md`, `docs/features/testing-criteria/build-log-T5.md`
verify: `grep -in "coverage" .opencode/agents/planner.md .opencode/skills/spec-authoring/SKILL.md .opencode/skills/spec-authoring/references/spec-checklist.md .opencode/skills/spec-authoring/templates/spec.md .opencode/skills/spec-review/SKILL.md .opencode/skills/task-decomposition/SKILL.md`; `grep -in "integration" .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md`; `git diff` vs build-start baselines (record in `build-log-T5.md`; in-place replacements exactly contracts 16.A, 19.A, 20.A)
acceptance: AC-12, AC-13, AC-14, AC-15, AC-16, AC-22 (contracts 10, 16–20)
status: [x]

Apply plan contracts 10 and 16–20: planner rule (specs define unit + integration + coverage expectation; tasks carry tests + coverage verify step); spec-authoring workflow step (one line); spec-checklist testing items; spec template `Integration:`/`Coverage:` lines; spec-review Testing item; task-decomposition rule 2 (behavior-change tasks: test files owned + coverage in `verify:`). No other rule text changes. Commit `docs: make specs and tasks define the unit/integration/coverage bar (T5)`.

## T6 — Builder-facing guidance: agent rule + web-implementation skill `[P]`
depends_on: T1
files_owned: `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `docs/features/testing-criteria/build-log-T6.md`
verify: `grep -in "coverage" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md`; `grep -in "integration\|anything\|objectContaining\|toHaveBeenCalled" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md`; **per-file evidence for the AC-6 tokens** (`.opencode/agents/builder.md` must itself contain "coverage" and "integration" — record per-file grep output in `build-log-T6.md`; the combined greps above must not be the sole evidence); `git diff` vs build-start baselines (record in `build-log-T6.md`; in-place replacements exactly contracts 12.A/12.B)
acceptance: AC-6, AC-7, AC-8, AC-22 (contracts 8, 12–13)
status: [x]

Apply plan contracts 8 and 12–13: builder rule (unit + integration tests; concrete assertions; coverage gate evidence); SKILL workflow step + DoD checklist items + `## Testing bar` section (tiers, banned-matcher list incl. weak-existential stand-ins, bounded exception rule ≤ 1/task, determinism, no-useless-tests bar, coverage metric, retroactivity, depth pointer); engineering-principles `## Testing principles` section (same depth incl. the sanctioned stub-global pattern for exercising ambient defaults without a real network). No permission-block edits. Commit `docs: add the builder testing bar and coverage DoD (T6)`.

## T7 — Reviewer-facing guidance: agent rule + code-review skill and testing checklist `[P]`
depends_on: T1
files_owned: `.opencode/agents/reviewer.md`, `.opencode/skills/code-review/SKILL.md`, `.opencode/skills/code-review/checklists/testing.md`, `docs/features/testing-criteria/build-log-T7.md`
verify: `grep -in "coverage" .opencode/agents/reviewer.md .opencode/skills/code-review/SKILL.md .opencode/skills/code-review/checklists/testing.md`; **per-file evidence for the AC-9 token** (`.opencode/agents/reviewer.md` must itself contain "coverage" — record per-file grep output in `build-log-T7.md`; the combined grep must not be the sole evidence); `grep -n "## Coverage gate\|## Assertion quality\|## No useless tests" .opencode/skills/code-review/checklists/testing.md` (exact section names); `grep -n "Coverage of the feature" .opencode/skills/code-review/checklists/testing.md` → still present (pre-existing section retained; naming distinction per AC-11); `git diff` vs build-start baselines (record in `build-log-T7.md`; in-place replacements exactly contract 14.A)
acceptance: AC-9, AC-10, AC-11, AC-22 (contracts 9, 14–15)
status: [x]

Apply plan contracts 9 and 14–15: reviewer rule (rerun coverage; shortfall/weak assertions count as unmet; logs are claims); code-review SKILL (run coverage; assertion-quality inspection step; severity rules); testing.md three new sections named exactly `## Coverage gate`, `## Assertion quality (real-data rule)`, `## No useless tests` — distinct from the retained `## Coverage of the feature` section — covering the gate, the banned list incl. weak-existential stand-ins, and the ≤ 1/task exception rule, following the existing `✅/❌/n/a` + `- [ ]` conventions; existing sections retained. Commit `docs: require reviewer coverage reruns and assertion-quality checks (T7)`.

## T8 — Orchestration guidance: orchestrator + playbook `[P]`
depends_on: T1
files_owned: `.opencode/agents/orchestrator.md`, `.opencode/skills/orchestration-playbook/SKILL.md`, `docs/features/testing-criteria/build-log-T8.md`
verify: `grep -n "coverage" .opencode/agents/orchestrator.md .opencode/skills/orchestration-playbook/SKILL.md`; `git diff` vs build-start baselines (record in `build-log-T8.md`; in-place replacements exactly contracts 11.A/11.B, 21.A/21.B)
acceptance: AC-17, AC-18, AC-22 (contracts 11, 21)
status: [x]

Apply plan contracts 11 and 21: orchestrator build-gate line requires recorded coverage evidence; accepted-summary line reports coverage results; playbook `building → code_review` transition requires recorded coverage-run evidence for behavior-change tasks; §7 final summary includes coverage numbers. No frontmatter/permission changes. Commit `docs: gate the workflow on coverage evidence (T8)`.

## T9 — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4, T5, T6, T7, T8
files_owned: `docs/features/testing-criteria/build-log-T9.md`
verify: `npm ci` (clean install from committed lockfile) → 0; `npm run lint` → 0; `npm run typecheck` → 0; `npm test` → 0 with the frontend transcript listing `src/App.test.tsx` as executed (discovery check — AC-24); `npm run coverage` → 0 with both workspaces ≥80 on all four metrics (full transcript in `build-log-T9.md`); `npm ls vitest @vitest/coverage-v8` (identical versions); lockfile diff inspection (only the provider + transitive dev tree); `git grep -n "permissions:" -- .opencode/agents` unchanged vs baseline; cross-file consistency greps (`npm run coverage` named consistently in `AGENTS.md`, `README.md`, `docs/architecture/stack.md`, skills; `80` thresholds present in both vitest configs; documented exclusion list matches configured ones; frontend `include` covers `.test.tsx`); banned-matcher grep over all test diffs; amendment-trace audit (every in-place replacement is one of the 16 pinned contract IDs — 3.C, 6.B, 6.C, 6.E, 11.A/B, 12.A/B, 14.A, 16.A, 19.A, 20.A, 21.A/B, 22.B/C — anything else is drift); `git status --short` (no `coverage/` artifacts, no `.env*`)
acceptance: AC-4, AC-21, AC-22 (cross-task), AC-23, AC-24 (verification gate; per-AC evidence table required)
status: [x]

Run the full verification suite yourself; record raw output and the per-AC met/unmet table (AC-1…AC-24, each with its evidence location) in `build-log-T9.md`. Inspect every task diff against its build-start baseline for contract adherence and the amendment trace (AC-22); verify scope discipline (AC-21: exactly one dependency, no production-module changes, no container/CI/`.env*`/permission changes). Record the known accepted residual (App effect path uncovered, 2 of 13 frontend functions — spec § Testing strategy) explicitly in the table rather than as an omission. Flag any drift or unmet AC with exact location instead of papering over it. Commit `docs: record T9 verification pass for testing-criteria (T9)`.
