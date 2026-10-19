# Tasks — Agent Model & Effort Tuning (OpenCode Go)

Dependency overview: `T1 → T2`. Both `[seq]` — one edit surface, and the verification gate must follow the edit; no parallel batch exists. Two tasks total; zero parallel-safe.

**Verification note (coverage):** the stack is decided and `npm run coverage` exists, but this feature has **no behavior-change task** — the entire change surface is one `model:` line in each of four agent configs outside all workspaces. `npm run coverage` is **not applicable** here (justification pinned in `spec.md` § Testing strategy) and must not be claimed as evidence in any build log. Verification is file-level: exact-line `grep`, `git diff`/`git show`, `python3` + `yaml.safe_load` (PyYAML verified available — precedent `docs/features/online-realtime-workflow/build-log-T0.md` § 4), and a catalog cross-check.

**Commit staging note:** every task commit stages only that task's `files_owned` paths (explicit `git add <paths>`), never `git add .` / `git add -A`.

**No permission bootstrap:** the builder already holds the `edit` allow for `.opencode/agents/*.md` (verified at plan time), so T1 needs no permission change; permissions are out of scope (spec AC-9).

## Change set (normative — copy byte-for-byte; identical to `spec.md` § Model mapping)

| # | File | Old full line | New full line |
| --- | --- | --- | --- |
| T1.1 | `.opencode/agents/orchestrator.md` | `model: opencode/deepseek-v4.1-flash-free#high` | `model: opencode-go/deepseek-v4.1-flash#low` |
| T1.2 | `.opencode/agents/planner.md` | `model: opencode/deepseek-v4.1-flash-free#max` | `model: opencode-go/deepseek-v4-pro#max` |
| T1.3 | `.opencode/agents/builder.md` | `model: opencode/deepseek-v4.1-flash-free#high` | `model: opencode-go/deepseek-v4.1-flash#high` |
| T1.4 | `.opencode/agents/reviewer.md` | `model: opencode/glm-5.3-flash-free#max` | `model: opencode-go/qwen3.7-plus#max` |

Line 4 in all four files as of 2026-10-19; replace by anchored exact-text match — never by line number.

## T1 — Retune the four agent `model:` lines `[seq]`

depends_on: —
files_owned: `.opencode/agents/orchestrator.md`, `.opencode/agents/planner.md`, `.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `docs/features/agent-model-tuning/build-log-T1.md`
verify: before editing, record the pre-feature baseline commit (`git rev-parse HEAD`) and capture baselines: `git show HEAD:.opencode/agents/orchestrator.md | sed -n '4p'` (same for planner, builder, reviewer — expect the old lines); after editing, exact-line presence per file: `grep -Fx "model: opencode-go/deepseek-v4.1-flash#low" .opencode/agents/orchestrator.md`, `grep -Fx "model: opencode-go/deepseek-v4-pro#max" .opencode/agents/planner.md`, `grep -Fx "model: opencode-go/deepseek-v4.1-flash#high" .opencode/agents/builder.md`, `grep -Fx "model: opencode-go/qwen3.7-plus#max" .opencode/agents/reviewer.md`; uniqueness: `grep -c "^model:" <file>` = `1` for each of the four; frontmatter parse + value equality via `python3` + `yaml.safe_load` (assert `data["model"]` equals each target; snippet pattern in `docs/features/online-realtime-workflow/build-log-T0.md` § 4); diff scope: `git diff --stat -- .opencode/agents/` = `4 files changed, 4 insertions(+), 4 deletions(-)` and `git diff -- .opencode/agents/` shows only the four `-`/`+` `model:` line pairs; completeness: `grep -rn "^\s*model\s*[:=]" .opencode/ opencode.jsonc` shows only the four agent lines; then commit (explicit paths) with `chore: retune agent models to OpenCode Go (T1)` and record `git show --stat HEAD`; raw outputs in `build-log-T1.md` (including the recorded `git rev-parse HEAD` pre-feature ref).
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-7
status: [x]

Apply exactly the four replacements in the table above (nothing else) with an anchored, idempotent `python3` heredoc (precedent: `online-realtime-workflow` T0): the exact old line must occur exactly once per file (otherwise exit non-zero — do not guess), the new line must not already be present, and a re-run must be a no-op or a clear failure. Do not touch any other byte: no permission entries, no prose, no `steps`/`color`/`description`/`mode`, no line-ending changes (AC-5). Do not edit any other file in this task. Never `git add .`; never push.

## T2 — Verify & integrate `[seq]`

depends_on: T1
files_owned: `docs/features/agent-model-tuning/build-log-T2.md`
verify: independent re-run against the committed state of every T1 check (exact-line greps + uniqueness; `python3` + `yaml.safe_load` value equality; `git diff`/`git show` scope); per-file `git show <T1-commit> -- <path>` against the baselines recorded in `build-log-T1.md` (exactly one `-`/`+` pair per file — AC-5); completeness: repo-wide `grep -rn "^\s*model\s*[:=]" .` returns only the four agent files (plus historical `docs/features/**` build logs — run records, not configuration), and `git diff <recorded-ref> -- opencode.jsonc .opencode/commands/feature.md` is empty, where `<recorded-ref>` is the pre-feature baseline commit recorded via `git rev-parse HEAD` in `build-log-T1.md` (AC-6); catalog cross-check: each target `model#variant` present in `spec.md` § Catalog basis (AC-7); cost boundary: no chosen target appears in the exclusion list; highest chosen price 0.66/1.98 (AC-8); scope discipline: `git show --stat` for the feature's commits shows only the four agent files plus feature-dir docs, and grep over commit diffs for `permissions:` yields no matches (AC-9 — the acceptance-time `docs/features/README.md` row is orchestrator-owned and post-code-gate, outside this evidence); if the platform's model-listing tool is available, re-query the live catalog and record the comparison (enrichment, not the AC basis); record the full per-AC evidence table in `build-log-T2.md`; commit (explicit path) with `docs: agent-model-tuning T2 verification evidence`.
acceptance: AC-1 … AC-9 (verification gate; AC-6, AC-8, AC-9 are enforced here in addition to T1)
status: [x]

Independent re-check of the complete deliverable before code review; report any AC not met with exact location; flag any drift from the pinned tables instead of papering over it. Do not run or claim `npm run coverage` (N/A — see the verification note). Never `git add .`; never push.
