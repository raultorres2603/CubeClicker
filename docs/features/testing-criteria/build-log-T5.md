# Build log — T5 — Planner-facing guidance: spec authoring, spec review, task decomposition

Task: T5 (2026-10-18) · status: completed
Files changed: `.opencode/agents/planner.md`, `.opencode/skills/spec-authoring/SKILL.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`, `.opencode/skills/spec-authoring/templates/spec.md`, `.opencode/skills/spec-review/SKILL.md`, `.opencode/skills/task-decomposition/SKILL.md`, `docs/features/testing-criteria/build-log-T5.md`

Sketch (≤5 lines):
1. planner.md § Rules: +1 bullet — specs define unit+integration tiers and the coverage expectation (`npm run coverage`, ≥80 ×4 per workspace); tasks carry test files + a coverage verify step (contract 10.A, additive).
2. spec-authoring/SKILL.md workflow step 7: in-place replacement per contract 16.A.
3. spec-checklist.md § Testing strategy: +4 items (tiers; exact command+thresholds or justified deviation; assertion bar; behavior-change tasks carry tests + coverage verify) — additive (17.A).
4. templates/spec.md § Testing strategy: +`Integration:` (after Unit) and +`Coverage:` (after E2E) — additive (18.A).
5. spec-review/SKILL.md Testing item: in-place replacement (19.A); task-decomposition rule 2: in-place replacement (20.A).

What changed & why:
- `planner.md` — one additive rule bullet (line 70) making the testing bar a spec-authoring obligation: every spec's § Testing strategy defines the unit + integration tiers and the coverage expectation at the project bar, and `tasks.md` gives every behavior-change task its test files and a `verify:` with the coverage command. Mirrors AC-10/contract 10.A so future features are specced to the bar.
- `spec-authoring/SKILL.md` — workflow step 7 replaced verbatim per contract 16.A: "unit vs integration vs containerized e2e tiers … plus the coverage expectation — `npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace — with the project assertion/no-useless-tests bar."
- `spec-authoring/references/spec-checklist.md` — four additive § Testing strategy items (tiers defined; exact command + thresholds named or a justified deviation; assertion-quality bar; behavior-change task carries test deliverables + a coverage verify step). The pre-existing "Commands exist in AGENTS.md" and edge-case items are retained and unchanged.
- `spec-authoring/templates/spec.md` — `- Integration: …` added after `- Unit: …`; `- Coverage: \`npm run coverage\` — thresholds ≥ 80% (statements, branches, functions, lines), per workspace.` added after `- E2E: …`; Unit/E2E/Verification-commands lines retained (contract 18.A).
- `spec-review/SKILL.md` — the `**Testing**` spec-gate checklist item replaced verbatim per contract 19.A (tiers present; coverage expectation names `npm run coverage` with ≥ 80 thresholds per workspace; assertion-quality + no-useless-tests bars referenced).
- `task-decomposition/SKILL.md` — rule 2 replaced per contract 20.A, folding in AC-16's test-files obligation: `files_owned` (behavior-change tasks include their test files), `verify` (… behavior-change tasks include the coverage command: `npm run coverage` or the workspace-scoped pre-gate form). Rules 3–8 untouched.

Decisions:
- Contract 20.A's "suggested text" omitted the AC-16 "carries its test files" clause; per the plan's "wording may vary slightly if the required tokens/concepts hold; substance is pinned", both obligations are folded into the single rule-2 line so the replacement stays one line (no extra rule added).
- The spec-checklist's pre-existing edge-case item keeps its position after the new items so the diff is purely additive (four insertions, zero removals).
- No other rule text touched; no frontmatter, permission, or template-example changes.

Build-start baselines: captured verbatim at build start to `/tmp/opencode/t5-baseline/<path>` (md5 below) and cross-checked `diff`-clean against `git show HEAD:<path>`, so the baseline equals the committed content at build start (HEAD was `8e5eb33 test: cover the app shell to the 80% gate (T2)`).

```
8f73c417e0c9d6fe842ee6a343be10a4  .opencode/agents/planner.md
81155de10defe18a8af3a0d873d704e8  .opencode/skills/spec-authoring/SKILL.md
f75a351ea5c01345f4a08302a6b0bd22  .opencode/skills/spec-authoring/references/spec-checklist.md
27f603c908bc09cdef93652e61b70d5a  .opencode/skills/spec-authoring/templates/spec.md
ac02c5e3b6c213791749154ba62a4302  .opencode/skills/spec-review/SKILL.md
bf6e6adcae1eecd14ef55904bfd67bb5  .opencode/skills/task-decomposition/SKILL.md
```

## Evidence

### 1. T5 verify grep 1 — `grep -in "coverage"` across all six files (exit 0)

```
.opencode/agents/planner.md:70:- Testing bar: every spec's § Testing strategy must define the unit and integration test tiers plus the coverage expectation at the project bar (`npm run coverage`, thresholds ≥ 80% statements/branches/functions/lines per workspace, concrete assertions, no wildcard matchers, no useless tests), and `tasks.md` must give every behavior-change task its test files in `files_owned` and a `verify:` that includes the coverage command (workspace-scoped pre-gate form acceptable).
.opencode/skills/spec-authoring/SKILL.md:18:7. Testing strategy: unit vs integration vs containerized e2e tiers, which commands verify what (from `AGENTS.md`), and the coverage expectation — `npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace — with the project assertion/no-useless-tests bar.
.opencode/skills/spec-authoring/references/spec-checklist.md:30:- [ ] The exact coverage command (`npm run coverage`) and thresholds (≥ 80% statements/branches/functions/lines, per workspace) named — or a justified deviation
.opencode/skills/spec-authoring/references/spec-checklist.md:32:- [ ] Every behavior-change task carries its test deliverables and a coverage verify step
.opencode/skills/spec-authoring/templates/spec.md:35:- Coverage: `npm run coverage` — thresholds ≥ 80% (statements, branches, functions, lines), per workspace.
.opencode/skills/spec-review/SKILL.md:22:- **Testing** — strategy present with unit + integration tiers; commands exist in `AGENTS.md`; the coverage expectation names `npm run coverage` with thresholds ≥ 80% (statements, branches, functions, lines) per workspace; assertion-quality and no-useless-tests bars referenced; relevant edge cases named.
.opencode/skills/task-decomposition/SKILL.md:13:2. Every task has: `depends_on`, `files_owned` (behavior-change tasks include their test files), `verify` (exact commands from `AGENTS.md` — behavior-change tasks include the coverage command: `npm run coverage` or the workspace-scoped pre-gate form), `acceptance` (AC ids it satisfies), `status: [ ]`.
exit=0
```

### 2. T5 verify grep 2 — `grep -in "integration" planner.md + spec-checklist.md` (exit 0)

```
.opencode/agents/planner.md:70:- Testing bar: every spec's § Testing strategy must define the unit and integration test tiers plus the coverage expectation at the project bar …
.opencode/skills/spec-authoring/references/spec-checklist.md:29:- [ ] Unit and integration tiers both defined (unit = one module with injected dependencies; integration = modules through real boundaries) — plus containerized e2e where cross-service behavior is claimed
exit=0
```

### 3. Per-file evidence for the AC-12 tokens (combined greps are not the sole evidence)

`grep -c` / `grep -n` per file (all six), token counts:

```
.opencode/agents/planner.md                                            coverage=1 integration=1 npm_run_coverage=1
.opencode/skills/spec-authoring/SKILL.md                               coverage=1 integration=1 npm_run_coverage=1
.opencode/skills/spec-authoring/references/spec-checklist.md           coverage=2 integration=1 npm_run_coverage=1
.opencode/skills/spec-authoring/templates/spec.md                      coverage=1 integration=1 npm_run_coverage=1
.opencode/skills/spec-review/SKILL.md                                  coverage=1 integration=1 npm_run_coverage=1
.opencode/skills/task-decomposition/SKILL.md                           coverage=1 integration=1 npm_run_coverage=1
```

AC-12 specifically requires `.opencode/skills/spec-authoring/SKILL.md` **itself** to contain "integration" and "coverage":

```
$ grep -c "integration" .opencode/skills/spec-authoring/SKILL.md
1
$ grep -n "integration" .opencode/skills/spec-authoring/SKILL.md
18:7. Testing strategy: unit vs integration vs containerized e2e tiers, which commands verify what (from `AGENTS.md`), and the coverage expectation — `npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace — with the project assertion/no-useless-tests bar.
$ grep -c "coverage" .opencode/skills/spec-authoring/SKILL.md
1
$ grep -n "coverage" .opencode/skills/spec-authoring/SKILL.md
18:7. Testing strategy: unit vs integration vs containerized e2e tiers, which commands verify what (from `AGENTS.md`), and the coverage expectation — `npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace — with the project assertion/no-useless-tests bar.
```

AC-13 items, per-file (spec-checklist.md) — the § Testing strategy section verbatim:

```
## Testing strategy
- [ ] Commands exist in AGENTS.md (else flagged as an open question)
- [ ] Unit and integration tiers both defined (unit = one module with injected dependencies; integration = modules through real boundaries) — plus containerized e2e where cross-service behavior is claimed
- [ ] The exact coverage command (`npm run coverage`) and thresholds (≥ 80% statements/branches/functions/lines, per workspace) named — or a justified deviation
- [ ] The assertion-quality bar reflected where test design is specified (concrete expected values; no banned wildcard matchers; no useless tests)
- [ ] Every behavior-change task carries its test deliverables and a coverage verify step
- [ ] Edge cases named where relevant (offline progress, clock skew, storage quota, rapid input, corrupted save)
```

```
$ grep -n "integration" .opencode/skills/spec-authoring/references/spec-checklist.md
29:- [ ] Unit and integration tiers both defined (unit = one module with injected dependencies; integration = modules through real boundaries) — plus containerized e2e where cross-service behavior is claimed
$ grep -n "npm run coverage" .opencode/skills/spec-authoring/references/spec-checklist.md
30:- [ ] The exact coverage command (`npm run coverage`) and thresholds (≥ 80% statements/branches/functions/lines, per workspace) named — or a justified deviation
$ grep -n "80%" .opencode/skills/spec-authoring/references/spec-checklist.md
30:- [ ] The exact coverage command (`npm run coverage`) and thresholds (≥ 80% statements/branches/functions/lines, per workspace) named — or a justified deviation
$ grep -n "assertion-quality" .opencode/skills/spec-authoring/references/spec-checklist.md
31:- [ ] The assertion-quality bar reflected where test design is specified (concrete expected values; no banned wildcard matchers; no useless tests)
$ grep -n "test deliverables" .opencode/skills/spec-authoring/references/spec-checklist.md
32:- [ ] Every behavior-change task carries its test deliverables and a coverage verify step
```

AC-14 (templates/spec.md) — Unit/E2E retained, Integration/Coverage added:

```
$ sed -n '31,36p' .opencode/skills/spec-authoring/templates/spec.md
## Testing strategy
- Unit: …
- Integration: …
- E2E: …
- Coverage: `npm run coverage` — thresholds ≥ 80% (statements, branches, functions, lines), per workspace.
- Verification commands: <from AGENTS.md>
$ grep -n "^- Unit:\|^- E2E:\|^## Testing strategy" .opencode/skills/spec-authoring/templates/spec.md
31:## Testing strategy
32:- Unit: …
34:- E2E: …
```

AC-15 (spec-review/SKILL.md) and AC-16 (task-decomposition/SKILL.md), per-file:

```
$ grep -n "Testing\*\*" .opencode/skills/spec-review/SKILL.md
22:- **Testing** — strategy present with unit + integration tiers; commands exist in `AGENTS.md`; the coverage expectation names `npm run coverage` with thresholds ≥ 80% (statements, branches, functions, lines) per workspace; assertion-quality and no-useless-tests bars referenced; relevant edge cases named.
$ grep -n "^2\." .opencode/skills/task-decomposition/SKILL.md
13:2. Every task has: `depends_on`, `files_owned` (behavior-change tasks include their test files), `verify` (exact commands from `AGENTS.md` — behavior-change tasks include the coverage command: `npm run coverage` or the workspace-scoped pre-gate form), `acceptance` (AC ids it satisfies), `status: [ ]`.
$ grep -n "^7\." .opencode/skills/task-decomposition/SKILL.md
18:7. Keep the graph acyclic — reviewers verify this.
```

AC-10 (planner.md rule):

```
$ grep -n "Testing bar" .opencode/agents/planner.md
70:- Testing bar: every spec's § Testing strategy must define the unit and integration test tiers plus the coverage expectation at the project bar (`npm run coverage`, thresholds ≥ 80% statements/branches/functions/lines per workspace, concrete assertions, no wildcard matchers, no useless tests), and `tasks.md` must give every behavior-change task its test files in `files_owned` and a `verify:` that includes the coverage command (workspace-scoped pre-gate form acceptable).
```

### 4. `git diff` vs build-start baselines (per file, complete hunks)

```
$ diff -u /tmp/opencode/t5-baseline/<file> <file>      # canary: each baseline diff-clean vs `git show HEAD:<file>`
```

`.opencode/agents/planner.md` — additive (1 insertion, 0 removals):

```
@@ -67,6 +67,7 @@
 - Containerization: specs for features that add services, images, ports, configuration, or deployables must cover their containerization impact per `docs/architecture/containerization.md` (…) — they are reopened only by a user-owned stack amendment.
+- Testing bar: every spec's § Testing strategy must define the unit and integration test tiers plus the coverage expectation at the project bar (`npm run coverage`, thresholds ≥ 80% statements/branches/functions/lines per workspace, concrete assertions, no wildcard matchers, no useless tests), and `tasks.md` must give every behavior-change task its test files in `files_owned` and a `verify:` that includes the coverage command (workspace-scoped pre-gate form acceptable).
```

`.opencode/skills/spec-authoring/SKILL.md` — in-place replacement **16.A** (1 line out / 1 line in):

```
@@ -15,7 +15,7 @@
-7. Testing strategy: what is unit vs e2e, which commands verify what (from `AGENTS.md`).
+7. Testing strategy: unit vs integration vs containerized e2e tiers, which commands verify what (from `AGENTS.md`), and the coverage expectation — `npm run coverage`, ≥ 80% statements/branches/functions/lines per workspace — with the project assertion/no-useless-tests bar.
```

`.opencode/skills/spec-authoring/references/spec-checklist.md` — additive (4 insertions, 0 removals):

```
@@ -26,6 +26,10 @@
 ## Testing strategy
 - [ ] Commands exist in AGENTS.md (else flagged as an open question)
+- [ ] Unit and integration tiers both defined (unit = one module with injected dependencies; integration = modules through real boundaries) — plus containerized e2e where cross-service behavior is claimed
+- [ ] The exact coverage command (`npm run coverage`) and thresholds (≥ 80% statements/branches/functions/lines, per workspace) named — or a justified deviation
+- [ ] The assertion-quality bar reflected where test design is specified (concrete expected values; no banned wildcard matchers; no useless tests)
+- [ ] Every behavior-change task carries its test deliverables and a coverage verify step
 - [ ] Edge cases named where relevant (offline progress, clock skew, storage quota, rapid input, corrupted save)
```

`.opencode/skills/spec-authoring/templates/spec.md` — additive (2 insertions, 0 removals):

```
@@ -30,7 +30,9 @@
 ## Testing strategy
 - Unit: …
+- Integration: …
 - E2E: …
+- Coverage: `npm run coverage` — thresholds ≥ 80% (statements, branches, functions, lines), per workspace.
 - Verification commands: <from AGENTS.md>
```

`.opencode/skills/spec-review/SKILL.md` — in-place replacement **19.A** (1 line out / 1 line in):

```
@@ -19,7 +19,7 @@
-- **Testing** — strategy present; commands exist in `AGENTS.md`; relevant edge cases named.
+- **Testing** — strategy present with unit + integration tiers; commands exist in `AGENTS.md`; the coverage expectation names `npm run coverage` with thresholds ≥ 80% (statements, branches, functions, lines) per workspace; assertion-quality and no-useless-tests bars referenced; relevant edge cases named.
```

`.opencode/skills/task-decomposition/SKILL.md` — in-place replacement **20.A** (1 line out / 1 line in):

```
@@ -10,7 +10,7 @@
-2. Every task has: `depends_on`, `files_owned`, `verify` (exact commands from `AGENTS.md`), `acceptance` (AC ids it satisfies), `status: [ ]`.
+2. Every task has: `depends_on`, `files_owned` (behavior-change tasks include their test files), `verify` (exact commands from `AGENTS.md` — behavior-change tasks include the coverage command: `npm run coverage` or the workspace-scoped pre-gate form), `acceptance` (AC ids it satisfies), `status: [ ]`.
```

Amendment trace (deletion/insertion counts vs build-start baseline) — the only in-place replacements are 16.A, 19.A, 20.A; everything else is additive:

```
.opencode/agents/planner.md: removed_lines=0 added_lines=1
.opencode/skills/spec-authoring/SKILL.md: removed_lines=1 added_lines=1
.opencode/skills/spec-authoring/references/spec-checklist.md: removed_lines=0 added_lines=4
.opencode/skills/spec-authoring/templates/spec.md: removed_lines=0 added_lines=2
.opencode/skills/spec-review/SKILL.md: removed_lines=1 added_lines=1
.opencode/skills/task-decomposition/SKILL.md: removed_lines=1 added_lines=1
```

```
$ git diff --stat -- <my six paths>
 .opencode/agents/planner.md                                  | 1 +
 .opencode/skills/spec-authoring/SKILL.md                     | 2 +-
 .opencode/skills/spec-authoring/references/spec-checklist.md | 4 ++++
 .opencode/skills/spec-authoring/templates/spec.md            | 2 ++
 .opencode/skills/spec-review/SKILL.md                        | 2 +-
 .opencode/skills/task-decomposition/SKILL.md                 | 2 +-
 6 files changed, 10 insertions(+), 3 deletions(-)
```

Frontmatter / permission integrity (per file, baseline vs current):

```
.opencode/agents/planner.md                                            permissions-diff=SAME frontmatter-diff=SAME
.opencode/skills/spec-authoring/SKILL.md                               permissions-diff=SAME frontmatter-diff=SAME
.opencode/skills/spec-authoring/references/spec-checklist.md           permissions-diff=SAME (file has no frontmatter: `grep -c '^---$'` → 0; head-3 diff clean)
.opencode/skills/spec-authoring/templates/spec.md                      permissions-diff=SAME frontmatter-diff=SAME
.opencode/skills/spec-review/SKILL.md                                  permissions-diff=SAME frontmatter-diff=SAME
.opencode/skills/task-decomposition/SKILL.md                           permissions-diff=SAME frontmatter-diff=SAME
```

### 5. Repo-level sanity checks (docs-only change; task verify in `tasks.md` is grep/diff-based)

```
$ npm run lint
> lint
> eslint .
lint exit=0

$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present
> tsc --noEmit      (backend)
> tsc --noEmit      (frontend)
typecheck exit=0
```

`npm test` / `npm run coverage` are not applicable to this task (no code, config, or test change): production sources, configs, and tests are untouched by T5 (`git status --short` shows only `.opencode/**` + this build log from my paths). T9 owns the full gate.

## Self-audit (acceptance)

- **AC-12** → met. `spec-authoring/SKILL.md` workflow step 7 (in-place replacement 16.A) requires unit + integration tiers, the coverage expectation (`npm run coverage`, ≥ 80 per workspace) and the assertion/no-useless-tests bar; per-file greps show the file itself contains "integration" (1) and "coverage" (1) — evidence § 3.
- **AC-13** → met. `spec-checklist.md` § Testing strategy gains unit + integration tiers, the exact coverage command + thresholds (or justified deviation), the assertion-quality bar, and the behavior-change-task test/coverage-verify item; pre-existing items retained (4 insertions, 0 removals) — evidence § 3/§ 4.
- **AC-14** → met. `templates/spec.md` § Testing strategy now has `- Integration: …` (after Unit) and `- Coverage: \`npm run coverage\` — thresholds ≥ 80% (statements, branches, functions, lines), per workspace.` (after E2E); Unit/E2E/Verification-commands retained — evidence § 3.
- **AC-15** → met. `spec-review/SKILL.md` `**Testing**` item (in-place replacement 19.A) checks tiers, `AGENTS.md` commands, the `npm run coverage` ≥ 80 per-workspace expectation, the assertion/no-useless-tests bars, and edge cases — evidence § 3.
- **AC-16** → met. `task-decomposition/SKILL.md` rule 2 (in-place replacement 20.A) requires behavior-change tasks to carry their test files and a `verify:` including the coverage command (full or workspace-scoped); rule 7 and the rest of the file unchanged — evidence § 3/§ 4.
- **AC-10 (plan contract 10.A)** → met. `planner.md` rule bullet present and containing "coverage" + "integration" — evidence § 1/§ 3.
- **AC-22** → met. Every diff vs the build-start baseline contains only contract-pinned additions (10.A, 17.A, 18.A) and exactly the three in-place replacements 16.A / 19.A / 20.A; no other rule text is removed or altered; no frontmatter or permission entry changed — evidence § 4.
- **AC-21 (scope discipline, T5 portion)** → met. Only the six `files_owned` framework files + this build log were touched; no dependency, config, production source, container, CI, or `.env*` change.

Deviations from spec: none. Contract 20.A's wording was extended (within the plan's allowed "wording may vary, substance is pinned") to also state the AC-16 test-files obligation; the replacement remains a single line, as pinned.

Commit: `docs: make specs and tasks define the unit/integration/coverage bar (T5)` — staged explicitly: only the six files above + this build log.
