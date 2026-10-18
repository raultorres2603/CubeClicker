# Build log — T8 — Orchestration guidance: orchestrator + playbook

Task: T8 (2026-10-18), `[P]` batch 2b (parallel with T7), branch `feat/testing-criteria`
Files changed: `.opencode/agents/orchestrator.md`, `.opencode/skills/orchestration-playbook/SKILL.md`, `docs/features/testing-criteria/build-log-T8.md`

What changed & why (≤5 lines):
- `orchestrator.md` build-gate line (contract 11.A, in-place): the gate now requires every acceptance criterion green **including recorded coverage-run evidence** (`npm run coverage`, thresholds ≥ 80).
- `orchestrator.md` accepted-summary line (contract 11.B, in-place): the reported evidence now includes the coverage run and per-workspace numbers.
- `orchestration-playbook/SKILL.md` § 1 transition (contract 21.A, in-place): `building → code_review` additionally requires every behavior-change task's build log to record its coverage run.
- `orchestration-playbook/SKILL.md` § 7 final summary (contract 21.B, in-place): evidence now includes the coverage results (`npm run coverage` + per-workspace numbers).
- Nothing else changed: no frontmatter/permission edits, no other text touched; exactly 4 lines replaced (2 per file).

Decisions:
- Contract 21.B wording slightly extended to name the command (`the \`npm run coverage\` run`) so AC-18's "(command + per-workspace numbers)" holds literally; plan § Baseline rule line 27 allows slight wording variance when the pinned tokens/concepts hold. The replacement is still one line, contract 21.B, in place.
- No additions/appendices: T8's pinned content for both files is only the four in-place replacements (11.A/11.B, 21.A/21.B).
- This task changes guidance text only (no production/tests/config/code), so the testing bar's unit+integration tiers have no boundary to exercise here; the task's `verify` is the inspection set pinned in `tasks.md` T8. The feature's coverage gate is still executed and recorded below as supporting evidence.

## Baseline (build start)

- `git branch --show-current` → `feat/testing-criteria` (must be, and is)
- `git rev-parse HEAD` → `0784d009446ab0f1f698da929ceb7e424cda6d36`
- Build-start baselines captured from HEAD:
  - `git show HEAD:.opencode/agents/orchestrator.md` → `/tmp/opencode/t8-baseline/orchestrator.md` (4132 bytes)
  - `git show HEAD:.opencode/skills/orchestration-playbook/SKILL.md` → `/tmp/opencode/t8-baseline/SKILL.md` (6925 bytes)

Baseline bytes for the four pinned lines (pre-change):

```
orchestrator.md:75  - Build gate: verdict `approved` with every acceptance criterion green → accepted; `changes_requested` → builder fixes (max 3 rounds); spec defects → planner.
orchestrator.md:81  - `accepted`: one final summary — what was built (feature + key files), evidence (verification commands and results), review history, backlog (MINOR/INFO), suggested next step. Update `docs/features/README.md`.
SKILL.md:33         - `building → code_review` when every task in `tasks.md` is `[x]`.
SKILL.md:101        One message: what was built (feature + key files), evidence (verification commands and results), review history (rounds and outcomes), backlog (MINOR/INFO findings and open questions), suggested next step. Update `docs/features/README.md`.
```

## Evidence

### `git branch --show-current` + HEAD

```
$ git branch --show-current
feat/testing-criteria
$ git rev-parse HEAD
0784d009446ab0f1f698da929ceb7e424cda6d36
```

### `grep -n "coverage" .opencode/agents/orchestrator.md .opencode/skills/orchestration-playbook/SKILL.md`

```
.opencode/agents/orchestrator.md:75:- Build gate: verdict `approved` with every acceptance criterion green, including recorded coverage-run evidence (`npm run coverage`, thresholds ≥ 80) → accepted; `changes_requested` → builder fixes (max 3 rounds); spec defects → planner.
.opencode/agents/orchestrator.md:81:- `accepted`: one final summary — what was built (feature + key files), evidence (verification commands and results, including the coverage run and per-workspace numbers), review history, backlog (MINOR/INFO), suggested next step. Update `docs/features/README.md`.
.opencode/skills/orchestration-playbook/SKILL.md:33:- `building → code_review` when every task in `tasks.md` is `[x]` and every behavior-change task's build log records its coverage run.
.opencode/skills/orchestration-playbook/SKILL.md:101:One message: what was built (feature + key files), evidence (verification commands and results, including the `npm run coverage` run and per-workspace numbers), review history (rounds and outcomes), backlog (MINOR/INFO findings and open questions), suggested next step. Update `docs/features/README.md`.
```

### `git diff` vs build-start baselines (raw)

`diff -u /tmp/opencode/t8-baseline/orchestrator.md .opencode/agents/orchestrator.md`:

```
--- /tmp/opencode/t8-baseline/orchestrator.md	2026-10-18 18:09:40.075030625 +0200
+++ .opencode/agents/orchestrator.md	2026-10-18 18:09:56.295345710 +0200
@@ -72,11 +72,11 @@
 ## Gates & loops
 
 - Spec gate: verdict `approved` → user checkpoint; `changes_requested` → planner revision (max 2 rounds).
-- Build gate: verdict `approved` with every acceptance criterion green → accepted; `changes_requested` → builder fixes (max 3 rounds); spec defects → planner.
+- Build gate: verdict `approved` with every acceptance criterion green, including recorded coverage-run evidence (`npm run coverage`, thresholds ≥ 80) → accepted; `changes_requested` → builder fixes (max 3 rounds); spec defects → planner.
 - Budget exceeded, unrecoverable `failed`, or contradictions → escalate with concrete options. Never loop silently.
 
 ## Checkpoints & completion
 
 - `awaiting_approval`: summary of at most 12 lines, then the `question` tool (Approve / Request changes / Abort).
-- `accepted`: one final summary — what was built (feature + key files), evidence (verification commands and results), review history, backlog (MINOR/INFO), suggested next step. Update `docs/features/README.md`.
+- `accepted`: one final summary — what was built (feature + key files), evidence (verification commands and results, including the coverage run and per-workspace numbers), review history, backlog (MINOR/INFO), suggested next step. Update `docs/features/README.md`.
 - `escalated`: state, what happened, blockers, 2–4 options, then stop.
```

`diff -u /tmp/opencode/t8-baseline/SKILL.md .opencode/skills/orchestration-playbook/SKILL.md`:

```
--- /tmp/opencode/t8-baseline/SKILL.md	2026-10-18 18:09:40.078030683 +0200
+++ .opencode/skills/orchestration-playbook/SKILL.md	2026-10-18 18:10:25.001903344 +0200
@@ -30,7 +30,7 @@
 - `spec_review → planning` when `changes_requested` and `spec_review_round < 2`; if it would exceed 2 → `escalated`.
 - User feedback at the checkpoint does not consume reviewer budget; route it into the next Planner brief.
 - `awaiting_approval → building` when the user approves.
-- `building → code_review` when every task in `tasks.md` is `[x]`.
+- `building → code_review` when every task in `tasks.md` is `[x]` and every behavior-change task's build log records its coverage run.
 - Increment `build_round` each time a code review starts.
 - `code_review → accepted` when `verdict: approved` and every acceptance criterion is verified met.
 - `code_review → building` when `changes_requested` and `build_round < 3`; if it would exceed 3 → `escalated`.
@@ -98,7 +98,7 @@
 
 ## 7. Final summary (`accepted`)
 
-One message: what was built (feature + key files), evidence (verification commands and results), review history (rounds and outcomes), backlog (MINOR/INFO findings and open questions), suggested next step. Update `docs/features/README.md`.
+One message: what was built (feature + key files), evidence (verification commands and results, including the `npm run coverage` run and per-workspace numbers), review history (rounds and outcomes), backlog (MINOR/INFO findings and open questions), suggested next step. Update `docs/features/README.md`.
 
 ## 8. Blocked & escalation
 
```

### Diff shape / replacement-trace

```
$ git diff --stat -- .opencode/agents/orchestrator.md .opencode/skills/orchestration-playbook/SKILL.md
 .opencode/agents/orchestrator.md                 | 4 ++--
 .opencode/skills/orchestration-playbook/SKILL.md | 4 ++--
 2 files changed, 4 insertions(+), 4 deletions(-)
$ grep -c "permissions:" .opencode/agents/orchestrator.md   # frontmatter untouched
1
```

In-place replacements are exactly the four pinned contracts — 11.A (orchestrator build gate), 11.B (orchestrator accepted summary), 21.A (playbook § 1 `building → code_review`), 21.B (playbook § 7 final summary). No additions, no deletions beyond the replaced lines, no frontmatter/permission change, no other text changed.

### Supporting: feature coverage gate (not a T8 verify step; recorded for the DoD)

```
$ npm run coverage
> coverage
> npm run coverage --workspaces --if-present

> @cubeclicker/backend coverage
> vitest run --coverage
 Test Files  1 passed (1)
      Tests  4 passed (4)
 % Coverage report from v8
File      | % Stmts | % Branch | % Funcs | % Lines
All files |     100 |      100 |     100 |     100
 app.ts   |     100 |      100 |     100 |     100

> @cubeclicker/frontend coverage
> vitest run --coverage
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/App.test.tsx (1 test) 8ms
 Test Files  2 passed (2)
      Tests  11 passed (11)
 % Coverage report from v8
File            | % Stmts | % Branch | % Funcs | % Lines
All files       |   92.79 |    92.85 |     100 |   92.79
 src            |      84 |      100 |     100 |      84
  App.tsx       |      84 |      100 |     100 |      84 | 19-22
 src/ws         |   95.34 |    92.59 |     100 |   95.34
  connection.ts |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
EXIT=0
```

## Acceptance audit

- **AC-17 → met.** `orchestrator.md:75` requires coverage-run evidence at the build gate (`npm run coverage`, thresholds ≥ 80) — contract 11.A; `orchestrator.md:81` reports coverage results in the accepted summary (coverage run + per-workspace numbers) — contract 11.B. Both lines contain "coverage" (grep above); diff vs baseline touches only those two lines.
- **AC-18 → met.** `SKILL.md:33` requires recorded coverage-run evidence for behavior-change tasks in the `building → code_review` transition — contract 21.A; `SKILL.md:101` (§ 7 final summary) includes the coverage results with the command (`npm run coverage`) and per-workspace numbers — contract 21.B. Both lines contain "coverage" (grep above); only those two lines differ from the baseline.
- **AC-22 → met (for this task's files).** Diff vs build-start baseline contains only the pinned in-place replacements: exactly 4 changed lines mapping to contracts 11.A/11.B and 21.A/21.B; zero additions, zero unrelated edits, frontmatter/permissions untouched.
- Scope discipline: edited exactly the 3 owned paths; no dependency, config, container, CI, or `.env*` change.

Deviations from spec: none in substance. Wording note: 21.B names the command explicitly (`the \`npm run coverage\` run and per-workspace numbers`) to satisfy AC-18's "(command + per-workspace numbers)" literally — a slight wording variance permitted by plan § Baseline rule (line 27); the line is still a single in-place contract-21.B replacement.

Commit: `docs: gate the workflow on coverage evidence (T8)` (staged only the 3 owned paths).
