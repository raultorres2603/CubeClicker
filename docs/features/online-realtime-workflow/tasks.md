# Tasks — Online & Real-Time Workflow Alignment

Dependency overview: `T0 → T1`; `{T0, T1} → {T2, T3, T4, T5}`; `{T2, T3, T4, T5} → T6`. T3–T5 are one `[P]` batch (pairwise disjoint `files_owned`, no shared files; earlier dependencies T0/T1 — T0 is the permission prerequisite). T2 is kept `[seq]`/foreground because its content is user-owned and declinable (Q-2). T2's `depends_on: T0, T1` is sequencing-only (disjoint files, no content dependency): it keeps the user-owned, declinable task in the foreground and the `[P]` batch at the playbook cap of three.

**Building precondition (ordering, not user action):** no user application is needed. Permissions are bootstrapped by the pipeline itself in **T0** (user-authorized by the 2026-10-16 directive — quoted in spec.md Q-1): the builder adds five `edit` allow entries to `.opencode/agents/builder.md` via its existing shell capability (a shell write — the `edit` tool cannot open `.opencode/**` until T0 lands). Do not dispatch T1–T5 (or T6) until T0's commit has landed; before dispatching T1, the orchestrator must check T0's recorded verify evidence in `build-log-T0.md` (grep anchors, idempotency output, structural assertion) against the pinned five entries — a read-only check. Subsequent builder sessions pick up the widened permissions from the updated file. T0 is the only sanctioned permission change anywhere (AC-24); the reviewer inspects its diff at the code gate; it is git-revertible and never pushed.

**Verification note:** `AGENTS.md` § Commands is TBD (stack NOT DECIDED) — `grep`/`git diff`/`git show` below are inspection aids, not project commands. Every AC is verified by inspection; per-AC evidence goes in the task's build log.

**Commit staging note:** every task commit stages only that task's `files_owned` paths (explicit `git add` of those paths) — never `git add .` or `git add -A`; this keeps untracked artifacts outside the feature scope (e.g., the pre-existing glossary files) from riding along in task commits.

## T0 — Permission bootstrap: builder `edit` allow entries `[seq]`
depends_on: —
files_owned: `.opencode/agents/builder.md`, `docs/features/online-realtime-workflow/build-log-T0.md`
verify: run the bootstrap heredoc twice (second run must leave the file byte-identical — idempotency evidence); `grep -n 'resource: "AGENTS.md"\|resource: "docs/architecture/\*\*"\|resource: "docs/product/\*\*"\|resource: "\.opencode/agents/\*\.md"\|resource: "\.opencode/skills/\*\*"' .opencode/agents/builder.md` (five anchors present); structural assertion (after the bootstrap): `python3` + `yaml.safe_load` (pyyaml is available) — the frontmatter must parse and every `permissions:` item must have `action`, `resource`, and `effect` keys; `git show HEAD -- .opencode/agents/builder.md` (commit diff adds only the five allow entries); record raw output (heredoc runs, greps, structural assertion, commit diff) in `build-log-T0.md`
acceptance: AC-24 (sanctioned permission change; no content AC — chore task)
status: [x]

Chore (bootstrap; user-authorized 2026-10-16). Apply exactly five `edit` allow entries to `.opencode/agents/builder.md` — `AGENTS.md`, `docs/architecture/**`, `docs/product/**`, `.opencode/agents/*.md`, `.opencode/skills/**` — via an anchored, idempotent `python3` heredoc (shell write; shell is already permitted): locate the existing `resource: "index.html"` allow block and insert the five entries after it in the order listed; abort with a non-zero exit if the anchor is absent; a re-run with the entries present is a no-op. Capture the file's baseline at build start; touch no deny entry (`.env*`, push, sudo, `rm -rf`, curl/wget denials unchanged); commit with a `chore:` message (e.g. `chore: widen builder edit permissions for online-realtime-workflow (T0)`); NEVER push.

## T1 — Project-level statements: `AGENTS.md` + `stack.md` `[seq]`
depends_on: T0
files_owned: `AGENTS.md`, `docs/architecture/stack.md`, `docs/features/online-realtime-workflow/build-log-T1.md`
verify: `grep -in "online\|real-time" AGENTS.md`; `grep -in "websocket" AGENTS.md docs/architecture/stack.md`; `grep -n "NOT DECIDED" AGENTS.md docs/architecture/stack.md`; `git diff HEAD -- AGENTS.md docs/architecture/stack.md` (record in `build-log-T1.md`)
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5
status: [x]

Apply plan.md § Pinned content contracts items 1–2 exactly: intro nature statement (single modified paragraph line — arrangement pinned in contract 1.A) + § Stack WebSocket bullet in `AGENTS.md`; `## Hard constraints (all candidates)` section in `stack.md`. Capture each file's baseline at build start. No technology names; NOT DECIDED retained.

## T2 — Product direction docs: backlog + vision `[seq]`
depends_on: T0, T1
files_owned: `docs/product/realtime-backlog.md`, `docs/product/vision.md`, `docs/features/online-realtime-workflow/build-log-T2.md`
verify: `grep -in "not commitments\|accounts" docs/product/realtime-backlog.md`; `grep -in "realtime-backlog.md" docs/product/vision.md`; `git diff HEAD -- docs/product/vision.md` compared line-by-line against the vision baseline in plan.md § Pinned content contracts item 4, after re-verifying that plan quote byte-for-byte against the build-start `vision.md` content (build-start governs — record both the equivalence/divergence check and the diff in `build-log-T2.md`)
acceptance: AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12
status: [x]

Create the backlog per contract item 3 (three named candidates; proposals explicitly unconfirmed; open tensions incl. accounts; closed section set — no implementation planning). Make exactly the two pinned `vision.md` edits (One-liner modification; one net-new link line). Confirm the link target exists (AC-12). If Q-2 is declined at the checkpoint, the `vision.md` portion (AC-11/AC-12) is dropped in a spec revision — backlog creation (AC-6…AC-10) remains, and the pointer relocation per plan § Key decisions D-4 is applied in that revision (the backlog link moves to `AGENTS.md`, a T1-owned file). Do not pre-emptively skip.

## T3 — Planner & orchestrator guidance `[P]`
depends_on: T0, T1
files_owned: `.opencode/agents/orchestrator.md`, `.opencode/agents/planner.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`, `docs/features/online-realtime-workflow/build-log-T3.md`
verify: `grep -in "real-time" .opencode/agents/orchestrator.md .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md`; `grep -in "autonom\|2026-10-16" .opencode/agents/orchestrator.md`; `git diff HEAD -- <files_owned>` (record in `build-log-T3.md`)
acceptance: AC-13, AC-14, AC-15
status: [x]

One additive bullet in each agent file's rules section (orchestrator gets two: real-time + framework autonomy, per contract item 5) and one conditional section in the checklist, per contract items 5–7. No permission-block edits (AC-24); no library names.

## T4 — Builder guidance `[P]`
depends_on: T0, T1
files_owned: `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `docs/features/online-realtime-workflow/build-log-T4.md`
verify: `grep -in "real-time" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md`; `git diff HEAD -- <files_owned>` vs. the T4 build-start baselines (record in `build-log-T4.md`)
acceptance: AC-16, AC-17, AC-18
status: [x]

One bullet in `builder.md` rules; one architecture-rule bullet in the SKILL (summary + depth pointer); the real-time section in engineering principles, per contract items 8 (T4 stage) and 9–10. `builder.md`'s permission block was already changed by T0 (committed): capture its baseline at T4 build start (post-T0) so the T4 diff shows only the prose rule, and touch no permission entry (AC-24).

## T5 — Reviewer guidance `[P]`
depends_on: T0, T1
files_owned: `.opencode/agents/reviewer.md`, `.opencode/skills/spec-review/SKILL.md`, `.opencode/skills/code-review/checklists/quality.md`, `.opencode/skills/code-review/checklists/security.md`, `.opencode/skills/code-review/checklists/testing.md`, `docs/features/online-realtime-workflow/build-log-T5.md`
verify: `grep -in "real-time" .opencode/agents/reviewer.md .opencode/skills/spec-review/SKILL.md .opencode/skills/code-review/checklists/*.md`; `git diff HEAD -- <files_owned>` (record in `build-log-T5.md`)
acceptance: AC-19, AC-20, AC-21, AC-22, AC-23
status: [x]

One bullet in `reviewer.md` rules; one checklist item in the spec-review skill; one section in each code-review checklist, per contract items 11–15. Follow each checklist file's existing `✅/❌/n/a` convention.

## T6 — Verify & integrate `[seq]`
depends_on: T0, T1, T2, T3, T4, T5
files_owned: `docs/features/online-realtime-workflow/build-log-T6.md`
verify: full inspection pass over all 15 target files against AC-1…AC-25: per-file `git diff` vs. each task's recorded baseline (AC-25; apply the accounting rule — pinned replacement lines count as modifications, never as added or deleted content; `builder.md` is checked as two per-task diffs: T0's five permission entries vs. T0's baseline, T4's prose vs. T4's post-T0 baseline); T0 commit inspection for AC-24 (exactly the five entries added; every other commit touches no permission block); `grep` anchors for every token named in the ACs; vision diff vs. baseline (AC-11, AC-12); backlog link resolves to the existing file (AC-12). Record the full per-AC evidence table in `build-log-T6.md`.
acceptance: AC-1 … AC-25 (verification gate; AC-24 includes the T0 exception check)
status: [x]

Independent re-check of the complete deliverable before code review; report any AC not met with exact location. Flag any drift from the pinned contracts instead of papering over it.
