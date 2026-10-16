# Build log — T3 — Planner & orchestrator guidance

Task: T3 (2026-10-17) — `[P]`, depends_on T0, T1.
Files changed: `.opencode/agents/orchestrator.md`, `.opencode/agents/planner.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md` (this log is the fourth `files_owned` path).
What changed & why: applied `plan.md` § Pinned content contracts items 5–7 additively — (5) two new bullets at the end of `orchestrator.md` **Iron rules**: online/real-time awareness (surfaces shared/cross-client real-time questions — identity vs. no-accounts, server authority, connection behavior — in the `awaiting_approval` summary; references `AGENTS.md` and `docs/architecture/stack.md`) and framework autonomy (mechanical bootstrap/workflow-file operations run in the pipeline under reviewer oversight; the user is approached only for genuine blockers or materially user-owned decisions; contains "2026-10-16"); (6) one new bullet at the end of `planner.md` **Rules**: specs for shared/cross-client features cover connection lifecycle, reconnection, multi-client behavior, and server authority — or declare them out of scope — and flag identity-vs-"no accounts" conflicts as open questions, assuming no stack beyond the WebSocket protocol requirement; (7) one new conditional section `## Real-time (when the feature touches shared/cross-client state)` with the two pinned checkboxes appended to `spec-checklist.md`. Purely additive (+2 / +1 / +4 lines; 0 deletions); no reflowing or rewording of existing lines; no `permissions:` block or allow/deny entry touched (AC-24); no library/framework/runtime/vendor technology names.

Decisions:
- **Additive placement:** orchestrator bullets appended after the last existing Iron rule ("Keep user-facing output terse…") and before `## Intake`; planner bullet appended after the last existing Rules bullet and before `## Revision mode`; the checklist section appended at end of file after `## Plan quality`. Every addition is contiguous with its section, so each diff is a single pure-addition hunk (0 deletions in all three files).
- **Single-line bullets** to respect the instruction-bloat cap (`plan.md` § Risks: agent files ≤ ~3 lines each): orchestrator +2 lines (one physical line per bullet), planner +1 line. No line reflowed.
- **Checklist formatting** mirrors the file's existing style exactly (`## Heading` immediately followed by `- [ ]` items, no blank line after the heading); one blank separator line precedes the new heading.
- **"Framework autonomy" wording:** the phrase is the pinned concept name carried by contract item 5 and AC-13(b) itself, not a technology name — but it contains the literal token "framework", so the technology-name scan below is run twice: raw (one expected hit: the pinned phrase) and with that phrase exempted (clean). Flagged here for the reviewer rather than silently filtered.
- **Reference handling:** the autonomy bullet cites the user directive date inline and points at `docs/features/online-realtime-workflow/spec.md` Q-1 for the verbatim quote, so the rule stays self-contained without duplicating the quote into an agent file.
- **Baseline = build start:** `HEAD` at T3 build start was `b3aeff1` (T2) and the working tree copies of all three files were byte-identical to `HEAD` (`diff -u` exit 0 each), so `git show b3aeff1:<path>` **is** the build-start content; full baselines are reproduced verbatim in §1.
- **Concurrency:** T4/T5 ran in the same working tree; only T3's four `files_owned` paths were staged/committed (§6). No branch switch, no rebase/reset/amend/history rewrite, no push.

Commit staging: only the four `files_owned` paths were staged (explicit `git add`); no `git add .` / `git add -A`; no push. The T4/T5 in-progress modifications (`.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `.opencode/skills/**` except T3's checklist, …) and the pre-existing `docs/features/project-glossary/status.md` modification were left unstaged, as were all untracked planner/orchestrator artifacts.

---

## 0. PRE-OP — branch (no switch)

```
$ git rev-parse --abbrev-ref HEAD
feat/online-realtime-workflow
$ git rev-parse HEAD
b3aeff1bba4e2ae8e39ec4ad4493df7aa897f3f1
$ git log --oneline -3
b3aeff1 docs: add provisional real-time backlog and vision direction link (T2)
d41c465 docs: state online real-time nature and WebSocket constraint (T1)
5af8715 chore: widen builder edit permissions for online-realtime-workflow (T0)
```

Branch state at T3 build start: `feat/online-realtime-workflow` at `b3aeff1` (T2), with T1 `d41c465` / T0 `5af8715` as ancestors. **No** checkout/branch switch, **no** rebase/reset/amend/history rewrite, **no** push. Documented change (deliverable), not a history operation.

**Peer-commit movement during the T3 build (recorded, not authored by T3):** the concurrent `[P]` peers committed while T3 was in progress, so `HEAD` advanced from the T3 build-start `b3aeff1` to `f5c4dad` (`docs: add real-time review checks for spec/code gates (T5)`) before T3's own commit. T5's commit touched only `.opencode/agents/reviewer.md`, `.opencode/skills/spec-review/SKILL.md`, `.opencode/skills/code-review/checklists/{quality,security,testing}.md`, and `build-log-T5.md` — **none** of T3's `files_owned` paths. Re-verified at commit time:

```
$ git rev-parse f5c4dad:.opencode/agents/orchestrator.md f5c4dad:.opencode/agents/planner.md \
              f5c4dad:.opencode/skills/spec-authoring/references/spec-checklist.md
d3ccb1d933b6e75cb4cbb775478ae403396161cb            # == b3aeff1 baseline blob
4a256b30f275f2f731c9d784f367ce94fcfc072a            # == b3aeff1 baseline blob
de7c2a06da039c30e9db8aaa172f135f301c4fd6            # == b3aeff1 baseline blob
$ for p in <the three files>; do git show "HEAD:$p" | cmp - /tmp/opencode/t3/baseline-<safe>; done
.opencode/agents/orchestrator.md: HEAD(f5c4dad) == b3aeff1 baseline (byte-identical)
.opencode/agents/planner.md: HEAD(f5c4dad) == b3aeff1 baseline (byte-identical)
.opencode/skills/spec-authoring/references/spec-checklist.md: HEAD(f5c4dad) == b3aeff1 baseline (byte-identical)
$ git show --name-only --format='%h %s' HEAD
f5c4dad docs: add real-time review checks for spec/code gates (T5)
.opencode/agents/reviewer.md
.opencode/skills/code-review/checklists/quality.md
.opencode/skills/code-review/checklists/security.md
.opencode/skills/code-review/checklists/testing.md
.opencode/skills/spec-review/SKILL.md
docs/features/online-realtime-workflow/build-log-T5.md
```

Effect on this log: every T3 baseline in §1 (captured from `b3aeff1`) remains valid **and** equals `HEAD` immediately before T3's commit (identical blob ids, `cmp` byte-identical), so the §3 diffs are baseline-correct on the commit's actual parent. The only change to §4's recorded commit identity is the `parent:` field (`f5c4dad`, not `b3aeff1`).

---

## 1. Baseline capture (build start)

Capture commands:

```
$ mkdir -p /tmp/opencode/t3
$ BASE=$(git rev-parse HEAD)          # b3aeff1bba4e2ae8e39ec4ad4493df7aa897f3f1
$ for p in .opencode/agents/orchestrator.md .opencode/agents/planner.md \
           .opencode/skills/spec-authoring/references/spec-checklist.md; do
    safe=$(echo "$p" | tr '/' '_')
    git show "$BASE:$p" > "/tmp/opencode/t3/baseline-$safe"
    cp "$p" "/tmp/opencode/t3/buildstart-$safe"
    sha256sum "/tmp/opencode/t3/baseline-$safe" "/tmp/opencode/t3/buildstart-$safe"
    wc -lc "/tmp/opencode/t3/baseline-$safe"
    diff -u "/tmp/opencode/t3/baseline-$safe" "$p" >/dev/null && echo "IDENTICAL (HEAD == build-start working tree)" || echo "DIFFERS"
  done
```

Raw output:

```
--- .opencode/agents/orchestrator.md
c23b338a8344c1c8c3041250cb651ff74bdffdab0a2840ab0b0c1617be199f69  /tmp/opencode/t3/baseline-.opencode_agents_orchestrator.md
c23b338a8344c1c8c3041250cb651ff74bdffdab0a2840ab0b0c1617be199f69  /tmp/opencode/t3/buildstart-.opencode_agents_orchestrator.md
  80 3534 /tmp/opencode/t3/baseline-.opencode_agents_orchestrator.md
IDENTICAL (HEAD == build-start working tree)
--- .opencode/agents/planner.md
52cc5f2cf26eb0e33d2a334c8ee857a47533582a072b7e75e3908858c300695b  /tmp/opencode/t3/baseline-.opencode_agents_planner.md
52cc5f2cf26eb0e33d2a334c8ee857a47533582a072b7e75e3908858c300695b  /tmp/opencode/t3/buildstart-.opencode_agents_planner.md
  75 2866 /tmp/opencode/t3/baseline-.opencode_agents_planner.md
IDENTICAL (HEAD == build-start working tree)
--- .opencode/skills/spec-authoring/references/spec-checklist.md
e0b19535064764deb2cb274f57ada95b2f57bf8666c1e31d23c0fa8ae17d5214  /tmp/opencode/t3/baseline-.opencode_skills_spec-authoring_references_spec-checklist.md
e0b19535064764deb2cb274f57ada95b2f57bf8666c1e31d23c0fa8ae17d5214  /tmp/opencode/t3/buildstart-.opencode_skills_spec-authoring_references_spec-checklist.md
  33 1548 /tmp/opencode/t3/baseline-.opencode_skills_spec-authoring_references_spec-checklist.md
IDENTICAL (HEAD == build-start working tree)
```

Blob ids at the captured commit (`git rev-parse b3aeff1:<path>` == `git rev-parse HEAD:<path>`):

```
d3ccb1d933b6e75cb4cbb775478ae403396161cb  .opencode/agents/orchestrator.md
4a256b30f275f2f731c9d784f367ce94fcfc072a  .opencode/agents/planner.md
de7c2a06da039c30e9db8aaa172f135f301c4fd6  .opencode/skills/spec-authoring/references/spec-checklist.md
```

### 1.1 Baseline — `.opencode/agents/orchestrator.md` (verbatim, 80 lines / 3534 bytes; blob `d3ccb1d`; build-start `b3aeff1`)

```markdown
---
description: CubeClicker workflow orchestrator. The only user-facing agent; delegates every phase to the planner, builder, and reviewer subagents and owns feature state. Never implements or reviews.
mode: primary
model: opencode/deepseek-v4.1-flash-free#high
color: "#8b5cf6"
steps: 60
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: edit
    resource: "docs/features/**/status.md"
    effect: allow
  - action: edit
    resource: "docs/features/**/tasks.md"
    effect: allow
  - action: edit
    resource: "docs/features/README.md"
    effect: allow
  - action: shell
    resource: "*"
    effect: deny
  - action: subagent
    resource: "*"
    effect: deny
  - action: subagent
    resource: "planner"
    effect: allow
  - action: subagent
    resource: "builder"
    effect: allow
  - action: subagent
    resource: "reviewer"
    effect: allow
  - action: skill
    resource: "*"
    effect: deny
  - action: skill
    resource: "orchestration-playbook"
    effect: allow
---

# Orchestrator

You are the CubeClicker workflow orchestrator. You are the ONLY agent that communicates with the user. You NEVER implement, design, review, or fix anything yourself: you route work to subagents and keep project state accurate.

## Iron rules

- Load the `orchestration-playbook` skill before your first action and follow it exactly.
- Route every phase through subagents. If you catch yourself reading source code beyond what a status update needs, stop and delegate.
- State lives in files (`docs/features/<slug>/`), not in this conversation. Read and update it after every transition.
- Trust only artifacts: verdict frontmatter in `reviews/*.md`, worker reports, files on disk. Chat claims are not evidence.
- Keep user-facing output terse: one update per state transition, one final summary per feature.

## Intake

When the user requests a feature:

1. Derive a kebab-case slug; create `docs/features/<slug>/status.md` from the playbook template (state `planning`).
2. Brief the **planner** using a Task Brief, including the RAW request text verbatim.
3. Drive the state machine per the playbook: `planning → spec_review → awaiting_approval → building → code_review → accepted`, with the documented loops and limits.

## Delegation

- Launch subagents with the `subagent` tool using agent ids: `planner`, `builder`, `reviewer`.
- Every invocation is a Task Brief (ROLE, FEATURE, PHASE, INPUTS, SCOPE, CONSTRAINTS, DELIVERABLES, REQUIRED OUTPUT).
- End every brief with: "Return the Subagent Report as your final message. Do not address the user."
- Foreground for single tasks; background for parallel-safe `[P]` batches (playbook §4, max 3).

## Gates & loops

- Spec gate: verdict `approved` → user checkpoint; `changes_requested` → planner revision (max 2 rounds).
- Build gate: verdict `approved` with every acceptance criterion green → accepted; `changes_requested` → builder fixes (max 3 rounds); spec defects → planner.
- Budget exceeded, unrecoverable `failed`, or contradictions → escalate with concrete options. Never loop silently.

## Checkpoints & completion

- `awaiting_approval`: summary of at most 12 lines, then the `question` tool (Approve / Request changes / Abort).
- `accepted`: one final summary — what was built (feature + key files), evidence (verification commands and results), review history, backlog (MINOR/INFO), suggested next step. Update `docs/features/README.md`.
- `escalated`: state, what happened, blockers, 2–4 options, then stop.
```

### 1.2 Baseline — `.opencode/agents/planner.md` (verbatim, 75 lines / 2866 bytes; blob `4a256b3`; build-start `b3aeff1`)

```markdown
---
description: Feature spec author. Turns a raw CubeClicker feature request into spec.md, plan.md, and a dependency-ordered tasks.md, and revises them in response to spec reviews.
mode: subagent
model: opencode/deepseek-v4.1-flash-free#max
color: "#3b82f6"
steps: 50
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: edit
    resource: "docs/features/**"
    effect: allow
  - action: edit
    resource: "docs/features/**/status.md"
    effect: deny
  - action: edit
    resource: "docs/features/**/reviews/**"
    effect: deny
  - action: edit
    resource: "docs/features/**/build-log*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
  - action: shell
    resource: "git status *"
    effect: allow
  - action: shell
    resource: "git log *"
    effect: allow
  - action: shell
    resource: "git diff *"
    effect: allow
  - action: shell
    resource: "git show *"
    effect: allow
  - action: subagent
    resource: "*"
    effect: deny
  - action: question
    resource: "*"
    effect: deny
  - action: skill
    resource: "*"
    effect: deny
  - action: skill
    resource: "spec-authoring"
    effect: allow
  - action: skill
    resource: "task-decomposition"
    effect: allow
---

# Planner

You are the CubeClicker feature planner — a subagent. You NEVER address the user; you return your report to the orchestrator. You write specs, plans, and task breakdowns; you write no application code.

## Rules

- Load the `spec-authoring` and `task-decomposition` skills before acting; follow their workflows and templates.
- Work strictly from the Task Brief: read all INPUT paths first. The raw request quoted in the brief is the scope boundary.
- Write `spec.md`, `plan.md`, and `tasks.md` into the feature directory named in the brief. Touch nothing else.
- If `docs/architecture/stack.md` says NOT DECIDED: stay stack-agnostic and list stack choices as open questions. Never assume tooling.
- Acceptance criteria are binary-testable or they don't exist. Non-goals are mandatory. Boundaries use the three tiers.
- `tasks.md`: exclusive `files_owned` per task, acyclic `depends_on`, `[P]` only with disjoint files and no shared-file contact.
- Every assumption appears in Open Questions or Assumptions — never hidden in prose.

## Revision mode

When the brief references spec-review findings: read the review artifact and address EVERY finding by ID — fixed (with what changed) or explicitly rebutted (with reasoning). Bump the spec `revision` and add a revision-history line. Never change acceptance criteria silently; changes must trace to the request, the review, or a listed open question.

## Report

Finish with the Subagent Report (status, artifacts, evidence summary, open questions, next recommendation). Use `status: blocked` if the brief is contradictory or missing required inputs.
```

### 1.3 Baseline — `.opencode/skills/spec-authoring/references/spec-checklist.md` (verbatim, 33 lines / 1548 bytes; blob `de7c2a0`; build-start `b3aeff1`)

```markdown
# Spec checklist — run before reporting

## Completeness vs request
- [ ] Every explicit ask is covered by at least one AC or listed as a non-goal or open question
- [ ] Nothing beyond the request is invented without being flagged

## Acceptance criteria
- [ ] Numbered, binary-testable, one behavior each (no conjoined criteria)
- [ ] Bad: "clicking feels fast and satisfying" → Good: "a click updates the counter within the same frame (no visible lag at 60 fps)"
- [ ] Each AC can cite evidence: a test, a command, or an observable step

## Boundaries & scope
- [ ] Three tiers present and specific
- [ ] Non-goals listed
- [ ] Spec covers exactly one feature

## Dependency & sizing (with tasks.md)
- [ ] Every task sized to one builder session, exclusive `files_owned`
- [ ] Dependency graph acyclic; `[P]` only with disjoint files and no shared-file contact
- [ ] Every AC maps to at least one task; every task maps to an AC (or is labeled chore)

## Security
- [ ] User-controlled data identified (names, imports, URLs)
- [ ] Persistence integrity considered (validation on load, corruption handling)
- [ ] No secrets in the client bundle; dependency additions flagged as ⚠️ Ask first

## Testing strategy
- [ ] Commands exist in AGENTS.md (else flagged as an open question)
- [ ] Edge cases named where relevant (offline progress, clock skew, storage quota, rapid input, corrupted save)

## Plan quality
- [ ] File inventory lists everything the feature will touch
- [ ] Interfaces/contracts pinned enough for an independent builder
```

---

## 2. Changes applied

- **EDIT `.opencode/agents/orchestrator.md`** — two added lines at the end of `## Iron rules` (after baseline line 53, before `## Intake`); no line modified or removed:
  - `orchestrator.md:54` (new): `- Online/real-time awareness: the game is online and real-time (`AGENTS.md`, `docs/architecture/stack.md`); when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary.`
  - `orchestrator.md:55` (new): `- Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; approach the user only for genuine blockers or materially user-owned decisions (user directive of 2026-10-16, quoted in `docs/features/online-realtime-workflow/spec.md` Q-1).`
- **EDIT `.opencode/agents/planner.md`** — one added line at the end of `## Rules` (after baseline line 67, before `## Revision mode`); no line modified or removed:
  - `planner.md:68` (new): `- Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.`
- **EDIT `.opencode/skills/spec-authoring/references/spec-checklist.md`** — one added blank separator line + new section appended after `## Plan quality` (baseline line 33 = last line); no line modified or removed:
  - `spec-checklist.md:34` (new): blank
  - `spec-checklist.md:35` (new): `## Real-time (when the feature touches shared/cross-client state)`
  - `spec-checklist.md:36` (new): `- [ ] Connection lifecycle, reconnection, multi-client behavior, and server authority addressed — or explicitly out of scope`
  - `spec-checklist.md:37` (new): `- [ ] Identity vs. "no accounts" conflicts flagged as open questions`

Post-edit sizes / hashes and diff shape:

```
$ sha256sum .opencode/agents/orchestrator.md .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md
e1634de113c5a12b0b532236c736bfed070f9fcdb1f7d8b6d2e0a44b89538dc8  .opencode/agents/orchestrator.md
8076e84fcce4986991f3495343723f1815943ab8c96e9edbd05bd9a46a3319f0  .opencode/agents/planner.md
3ba69fba663c8e66a1980ad2e19cea0430b45b2ee7a379a665dfb5f7977bf20d  .opencode/skills/spec-authoring/references/spec-checklist.md
$ wc -lc .opencode/agents/orchestrator.md .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md
  82 4132 .opencode/agents/orchestrator.md      # 80 -> 82 lines ( +2, 0 deletions )
  76 3215 .opencode/agents/planner.md           # 75 -> 76 lines ( +1, 0 deletions )
  37 1811 .opencode/skills/spec-authoring/references/spec-checklist.md   # 33 -> 37 lines ( +4, 0 deletions )
```

Per-file `diff -u baseline <file> | grep -c '^-[^-]'` → `0` for all three files (**pure addition everywhere; no existing line reflowed, reworded, or removed**).

Pre-commit content addresses (worktree blob == staged blob):

```
$ git hash-object .opencode/agents/orchestrator.md .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md
64e45e7c7644c443f6a000a7c10aa6da144351e2
8e2a796237d2af5a5bf990c7ece5779f7e20b608
b270cd33fcb46c9b9aa4f28072649b402996aaff
$ git rev-parse :.opencode/agents/orchestrator.md :.opencode/agents/planner.md :.opencode/skills/spec-authoring/references/spec-checklist.md
64e45e7c7644c443f6a000a7c10aa6da144351e2
8e2a796237d2af5a5bf990c7ece5779f7e20b608
b270cd33fcb46c9b9aa4f28072649b402996aaff
```

---

## 3. Diffs (staged content; pre-commit)

`git diff --cached --stat`:

```
 .opencode/agents/orchestrator.md                             | 2 ++
 .opencode/agents/planner.md                                  | 1 +
 .opencode/skills/spec-authoring/references/spec-checklist.md | 4 ++++
 3 files changed, 7 insertions(+)
```

`git diff --cached -- .opencode/agents/orchestrator.md .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md`:

```diff
diff --git a/.opencode/agents/orchestrator.md b/.opencode/agents/orchestrator.md
index d3ccb1d..64e45e7 100644
--- a/.opencode/agents/orchestrator.md
+++ b/.opencode/agents/orchestrator.md
@@ -51,6 +51,8 @@ You are the CubeClicker workflow orchestrator. You are the ONLY agent that commu
 - State lives in files (`docs/features/<slug>/`), not in this conversation. Read and update it after every transition.
 - Trust only artifacts: verdict frontmatter in `reviews/*.md`, worker reports, files on disk. Chat claims are not evidence.
 - Keep user-facing output terse: one update per state transition, one final summary per feature.
+- Online/real-time awareness: the game is online and real-time (`AGENTS.md`, `docs/architecture/stack.md`); when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary.
+- Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; approach the user only for genuine blockers or materially user-owned decisions (user directive of 2026-10-16, quoted in `docs/features/online-realtime-workflow/spec.md` Q-1).
 
 ## Intake
 
diff --git a/.opencode/agents/planner.md b/.opencode/agents/planner.md
index 4a256b3..8e2a796 100644
--- a/.opencode/agents/planner.md
+++ b/.opencode/agents/planner.md
@@ -65,6 +65,7 @@ You are the CubeClicker feature planner — a subagent. You NEVER address the us
 - Acceptance criteria are binary-testable or they don't exist. Non-goals are mandatory. Boundaries use the three tiers.
 - `tasks.md`: exclusive `files_owned` per task, acyclic `depends_on`, `[P]` only with disjoint files and no shared-file contact.
 - Every assumption appears in Open Questions or Assumptions — never hidden in prose.
+- Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.
 
 ## Revision mode
 
diff --git a/.opencode/skills/spec-authoring/references/spec-checklist.md b/.opencode/skills/spec-authoring/references/spec-checklist.md
index de7c2a0..b270cd3 100644
--- a/.opencode/skills/spec-authoring/references/spec-checklist.md
+++ b/.opencode/skills/spec-authoring/references/spec-checklist.md
@@ -31,3 +31,7 @@
 ## Plan quality
 - [ ] File inventory lists everything the feature will touch
 - [ ] Interfaces/contracts pinned enough for an independent builder
+
+## Real-time (when the feature touches shared/cross-client state)
+- [ ] Connection lifecycle, reconnection, multi-client behavior, and server authority addressed — or explicitly out of scope
+- [ ] Identity vs. "no accounts" conflicts flagged as open questions
```

Diff shape: exactly one hunk per file; three pure-addition hunks (0 deletions); no other path. The only hunk context each file carries is its own section tail.

Diff-shape check against the plan's file inventory rows:

| File | Inventory row | Observed |
| --- | --- | --- |
| `.opencode/agents/orchestrator.md` | Edit (+1 rule) — contract item 5 pins **two** bullets | 2 added lines, 0 deletions, single hunk (both bullets are contract item 5's two sub-bullets; plan § Architecture also states orchestrator carries "routing/checkpoint awareness + framework autonomy") |
| `.opencode/agents/planner.md` | Edit (+1 rule) | 1 added line, 0 deletions, single hunk |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` | Edit (+1 section) | 1 section = 1 added heading + 1 blank separator + 2 added checkbox lines; 0 deletions, single hunk |

---

## 4. Committed-state evidence

Commit identity is **deliberately omitted from this file** (self-reference: a commit cannot contain its own hash; same precedent as `build-log-T0.md` §7 / `build-log-T1.md` §4 / `build-log-T2.md` §4). It is reported to the orchestrator in the Subagent Report and retrievable as `git rev-parse HEAD` (or by selecting the commit whose subject is `docs: add real-time and autonomy guidance for planner/orchestrator (T3)` on `feat/online-realtime-workflow`).

Committed content is proven by content-addressed blob hashes, stable across the commit (pre-commit `git hash-object` == staged blob == post-commit `HEAD:<path>`):

```
branch:  feat/online-realtime-workflow
parent:  f5c4dadd7b646b3c05cf6f6baeae96f16b2ecded  (T5; recorded as f5c4dad — see §0 peer-commit movement)
subject: docs: add real-time and autonomy guidance for planner/orchestrator (T3)
hash:    omitted here (self-reference) — reported in the Subagent Report / `git rev-parse HEAD`
file list (from `git show --name-only --format=%s HEAD`):
.opencode/agents/orchestrator.md
.opencode/agents/planner.md
.opencode/skills/spec-authoring/references/spec-checklist.md
docs/features/online-realtime-workflow/build-log-T3.md
```

Post-commit `git show HEAD -- <paths>` reproduces the §3 diff bodies verbatim (the commit header — `commit <sha>` / Author / Date — is the only difference), and `git rev-parse HEAD:.opencode/agents/orchestrator.md` == `64e45e7c…`, `HEAD:.opencode/agents/planner.md` == `8e2a7962…`, `HEAD:.opencode/skills/spec-authoring/references/spec-checklist.md` == `b270cd33…`, matching §2's recorded pre-commit blobs.

---

## 5. Verify commands (tasks.md T3) — raw output

### V1 — `grep -in "real-time" .opencode/agents/orchestrator.md .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md` (exit 0)

```
.opencode/agents/orchestrator.md:54:- Online/real-time awareness: the game is online and real-time (`AGENTS.md`, `docs/architecture/stack.md`); when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary.
.opencode/agents/planner.md:68:- Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.
.opencode/skills/spec-authoring/references/spec-checklist.md:35:## Real-time (when the feature touches shared/cross-client state)
```

Line 54 = the orchestrator real-time rule (AC-13(a)); line 68 = the planner rule (AC-14); line 35 = the new checklist section heading (AC-15). The checklist's two added checkbox lines (36–37) carry the concepts but not the literal hyphenated token.

### V2 — `grep -in "autonom\|2026-10-16" .opencode/agents/orchestrator.md` (exit 0)

```
55:- Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; approach the user only for genuine blockers or materially user-owned decisions (user directive of 2026-10-16, quoted in `docs/features/online-realtime-workflow/spec.md` Q-1).
```

Single line carries both AC-13(b) tokens: `autonomy` and `2026-10-16`. (The word "autonomously"/"autonomous" does not appear; AC-13(b) accepts `autonomous` **or** `autonomy`.)

### V3 — `git diff HEAD -- <files_owned>` (post-edit, pre-commit; raw content)

Raw post-edit diff output is the §3 staged output (identical bodies; `git diff` vs. `git diff --cached` differ only in that the working tree and index are identical here — the pre-commit `git diff --cached` is the authoritative record). Baseline-relative `diff -u` is quoted in §2 and reproduced below:

```
$ for p in <the three files>; do diff -u /tmp/opencode/t3/baseline-<safe> "$p"; done
@@ -51,6 +51,8 @@   (orchestrator.md)   +2 added, 0 removed
@@ -65,6 +65,7 @@   (planner.md)        +1 added, 0 removed
@@ -31,3 +31,7 @@    (spec-checklist.md) +4 added, 0 removed (incl. 1 blank separator)
```

### V4 (extra, AC-24) — no permission-block edit in any T3 path

```
$ git diff -U0 -- .opencode/agents/orchestrator.md .opencode/agents/planner.md \
  | grep -c '^[-+].*\(effect:\|action:\|resource:\|permissions:\)'
0
```

Zero added/removed lines matching `effect:` / `action:` / `resource:` / `permissions:`; the frontmatter `permissions:` blocks of both agent files are byte-identical to the baselines (§3 hunks are in the prose sections at lines 51+/65+; the checklist has no frontmatter). T3 is a content-only change — the T0 bootstrap (and only it) is the sanctioned permission change.

### V5 (extra) — technology-name scan on the added lines

```
$ git diff -U0 -- <the three files> | grep '^+[^+]' > /tmp/opencode/t3/added-lines.txt
$ cat -n /tmp/opencode/t3/added-lines.txt
     1  +- Online/real-time awareness: the game is online and real-time (`AGENTS.md`, `docs/architecture/stack.md`); when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary.
     2  +- Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; approach the user only for genuine blockers or materially user-owned decisions (user directive of 2026-10-16, quoted in `docs/features/online-realtime-workflow/spec.md` Q-1).
     3  +- Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.
     4  +## Real-time (when the feature touches shared/cross-client state)
     5  +- [ ] Connection lifecycle, reconnection, multi-client behavior, and server authority addressed — or explicitly out of scope
     6  +- [ ] Identity vs. "no accounts" conflicts flagged as open questions

$ grep -in "react\|vue\|angular\|svelte\|node\.js\|deno\|bun\|socket\.io\|express\|django\|spring\|rust\|nginx\|apache\|postgres\|redis\|mongo\|docker\|cloudflare\|vercel\|firebase\|aws\|npm\|yarn\|pnpm\|vite\|webpack\|library\|framework\|runtime\|vendor\|package" /tmp/opencode/t3/added-lines.txt
2:+- Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; approach the user only for genuine blockers or materially user-owned decisions (user directive of 2026-10-16, quoted in `docs/features/online-realtime-workflow/spec.md` Q-1).
# expected single hit: the pinned concept name, not a technology

$ sed 's/- Framework autonomy:/- [pinned "Framework autonomy" heading]:/' /tmp/opencode/t3/added-lines.txt \
  | grep -in "react\|vue\|angular\|svelte\|node\.js\|deno\|bun\|socket\.io\|express\|django\|spring\|rust\|nginx\|apache\|postgres\|redis\|mongo\|docker\|cloudflare\|vercel\|firebase\|aws\|npm\|yarn\|pnpm\|vite\|webpack\|javascript\|typescript\|library\|runtime\|vendor\|package"
(no matches: exit 1 — no technology names)

$ grep -in "websocket" /tmp/opencode/t3/added-lines.txt
3:+- Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.
```

Result: the only occurrence of the literal token `framework` is the **pinned concept name** "Framework autonomy" from contract item 5 / AC-13(b) (with the phrase exempted, the scan is clean). The single technology token in the additions is `WebSocket`, explicitly permitted as protocol context (plan § Vocabulary pin). No library/framework/runtime/vendor/product name is introduced; the stack stays NOT DECIDED.

### V6 (extra) — scope: no file outside `files_owned` touched

```
$ git status --porcelain          # immediately after staging the three content files
 M .opencode/agents/builder.md                                        # T4 in progress (unstaged, not mine)
M  .opencode/agents/orchestrator.md                                  # T3 (staged)
M  .opencode/agents/planner.md                                       # T3 (staged)
 M .opencode/agents/reviewer.md                                      # T5 in progress (unstaged, not mine)
 M .opencode/skills/code-review/checklists/quality.md                # T5 in progress
 M .opencode/skills/code-review/checklists/security.md               # T5 in progress
 M .opencode/skills/code-review/checklists/testing.md                # T5 in progress
M  .opencode/skills/spec-authoring/references/spec-checklist.md      # T3 (staged)
 M .opencode/skills/spec-review/SKILL.md                             # T5 in progress
 M .opencode/skills/web-implementation/SKILL.md                      # T4 in progress
 M .opencode/skills/web-implementation/references/engineering-principles.md   # T4 in progress
 M docs/features/project-glossary/status.md                           # pre-existing, untouched
?? docs/features/online-realtime-workflow/{plan,spec,status,tasks}.md  # orchestrator/planner-owned, untracked
?? docs/features/online-realtime-workflow/reviews/
?? docs/features/project-glossary/{plan,spec,tasks}.md + reviews/
```

Only the T3 `files_owned` paths carry the staged (`M `/`A ` left-column) marker. Everything else is either the concurrent T4/T5 builders' unstaged work or pre-existing/untracked artifacts — none of it is staged or committed by T3.

---

## 6. Staging discipline

```
$ git add .opencode/agents/orchestrator.md .opencode/agents/planner.md \
          .opencode/skills/spec-authoring/references/spec-checklist.md
$ git diff --cached --name-only
.opencode/agents/orchestrator.md
.opencode/agents/planner.md
.opencode/skills/spec-authoring/references/spec-checklist.md
$ git add docs/features/online-realtime-workflow/build-log-T3.md
$ git diff --cached --name-only
.opencode/agents/orchestrator.md
.opencode/agents/planner.md
.opencode/skills/spec-authoring/references/spec-checklist.md
docs/features/online-realtime-workflow/build-log-T3.md
```

Explicit-path `git add` only — no `git add .` / `git add -A`. Left untouched and unstaged: the concurrent T4/T5 in-progress modifications (`.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `.opencode/skills/web-implementation/**`, `.opencode/skills/spec-review/**`, `.opencode/skills/code-review/checklists/**`), the pre-existing `docs/features/project-glossary/status.md` modification, and all untracked planner/orchestrator artifacts. No branch switch, no rebase, no history rewrite, no push.

---

## 7. Contract-token audit (plan § Pinned content contracts items 5–7; spec AC-13…AC-15)

| Required token / concept | Contract | Where |
| --- | --- | --- |
| bullet in **Iron rules**, token "real-time" | 5, AC-13(a) | `orchestrator.md:54` (also "real-time" ×3) |
| surfaces real-time questions when a feature touches shared/cross-client state | 5, AC-13(a) | `orchestrator.md:54` — "when a feature touches shared or cross-client state, surface its real-time questions" |
| identity vs. no-accounts | 5, AC-13(a) | `orchestrator.md:54` — "identity vs. no-accounts" |
| server authority | 5, AC-13(a) | `orchestrator.md:54` — "server authority" |
| connection behavior | 5, AC-13(a) | `orchestrator.md:54` — "connection behavior" |
| surfaced in the `awaiting_approval` summary | 5, AC-13(a) | `orchestrator.md:54` — "in the `awaiting_approval` summary" |
| references `AGENTS.md` and `docs/architecture/stack.md` | 5 | `orchestrator.md:54` — both paths named in backticks |
| bullet in **Iron rules**, token "autonomy", date "2026-10-16" | 5, AC-13(b) | `orchestrator.md:55` — "Framework **autonomy**" … "user directive of **2026-10-16**" |
| mechanical bootstrap + workflow-file operations performed by the pipeline under reviewer oversight | 5, AC-13(b) | `orchestrator.md:55` — "mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight" |
| user approached only for genuine blockers or materially user-owned decisions | 5, AC-13(b) | `orchestrator.md:55` — "approach the user only for genuine blockers or materially user-owned decisions" |
| quoted in spec.md § Open questions Q-1 | 5 | `orchestrator.md:55` — "quoted in `docs/features/online-realtime-workflow/spec.md` Q-1" |
| bullet in **Rules**, token "real-time" | 6, AC-14 | `planner.md:68` |
| connection lifecycle | 6, AC-14 | `planner.md:68` — "connection lifecycle" |
| reconnection | 6, AC-14 | `planner.md:68` — "reconnection" |
| multi-client behavior | 6, AC-14 | `planner.md:68` — "multi-client behavior" |
| server authority (for shared values) | 6, AC-14 | `planner.md:68` — "server authority for shared values" |
| identity conflicts flagged as open questions | 6, AC-14 | `planner.md:68` — "flag identity vs. \"no accounts\" conflicts as open questions" |
| assumes no stack beyond the WebSocket protocol requirement | 6, AC-14 | `planner.md:68` — "Assume no stack beyond the WebSocket protocol requirement." |
| no library names in the added content | AC-14 | V5 scan (clean; only `WebSocket`, permitted) |
| section `## Real-time (when the feature touches shared/cross-client state)` | 7, AC-15 | `spec-checklist.md:35` |
| checkbox 1: connection lifecycle, reconnection, multi-client behavior, server authority — addressed or explicitly out of scope | 7, AC-15 | `spec-checklist.md:36` |
| checkbox 2: identity/"no accounts" conflicts flagged as open questions | 7, AC-15 | `spec-checklist.md:37` |
| existing formatting/bullet style followed | constraint | `- [ ]` items with no blank line after the heading, matching every other section of the file |
| additive only; agent-file additions ≤ ~3 lines | constraint, `plan.md` § Risks | orchestrator +2 / planner +1 physical lines; 0 deletions in all three files |

## Acceptance audit

- **AC-13 — met.** `.opencode/agents/orchestrator.md` gains exactly two rules, both in `## Iron rules` (V3/V1/V2, §2, §7):
  - (a) `orchestrator.md:54` — "Online/real-time awareness… the game is online and real-time (`AGENTS.md`, `docs/architecture/stack.md`); when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary." → added content contains "real-time" (×3); all four pinned concepts present; both referenced paths named. V1 confirms the token.
  - (b) `orchestrator.md:55` — "Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; approach the user only for genuine blockers or materially user-owned decisions (user directive of 2026-10-16, quoted in `docs/features/online-realtime-workflow/spec.md` Q-1)." → added content contains "**autonomy**" and "**2026-10-16**"; V2 confirms both tokens on a single line.
  - No other orchestrator content changed (V3: single hunk, +2 added / 0 removed), and no permission entry was touched (V4: 0).
- **AC-14 — met.** `.opencode/agents/planner.md` gains one rule in `## Rules`: `planner.md:68` requires specs for features touching shared or cross-client state to address **connection lifecycle**, **reconnection**, **multi-client behavior**, and **server authority for shared values** (with an explicit "or state them as explicitly out of scope" escape, matching the checklist/AC-20 phrasing), and to **flag identity vs. "no accounts" conflicts as open questions**; it "assume[s] no stack beyond the WebSocket protocol requirement." Added content contains "Real-time" (V1) and no library names (V5). Single hunk, +1/0 (V3); no permission entry touched (V4: 0).
- **AC-15 — met.** `.opencode/skills/spec-authoring/references/spec-checklist.md` gains the section `## Real-time (when the feature touches shared/cross-client state)` (`spec-checklist.md:35`) with exactly two checkboxes: (1) line 36 — connection lifecycle, reconnection, multi-client behavior, and server authority "addressed — or explicitly out of scope"; (2) line 37 — identity/"no accounts" conflicts "flagged as open questions". Added content contains "Real-time" (V1). The section is appended after `## Plan quality` in the file's existing style; single hunk, +4/0 (V3).
- **AC-24 (T3 scope) — met / not implicated.** T3 touches no `permissions:` block or allow/deny entry: the staged diff contains only prose additions in the `## Iron rules` / `## Rules` sections and the checklist body; V4 shows zero added/removed `action:`/`resource:`/`effect:`/`permissions:` lines. The frontmatter of both agent files is byte-identical to the baselines (§1.1/§1.2 vs. §3 hunks). T3 stages only its four `files_owned` paths (§6).
- **AC-25 (T3 scope) — met.** Diffs vs. the build-start baselines (§1, §2, §3) contain exactly contract items 5–7's content — the two pinned orchestrator bullets, the one pinned planner bullet, and the one pinned checklist section (heading + two checkboxes + one blank separator) — as **pure additions** (+7 lines total, 0 deletions across all three files), with no unrelated or drive-by edits and no removals of pre-existing content (no pinned replacement line is involved in T3; the accounting rule for contract items 1.A/4.A belongs to T1/T2).

## Tests

None — no automated commands exist (`AGENTS.md` § Commands: TBD; stack NOT DECIDED, per spec § Testing strategy). This is a documentation/instruction-content change with no runtime behavior, so the "tests accompany every behavior change" convention has no applicable artifact (consistent with spec § Non-goals / § Testing strategy and the other T-logs). Verification is by inspection plus `grep`/`git diff`/`sha256sum`/`wc`/`diff` build-time aids — no tooling choice is introduced.

## Deviations from spec

None in content or scope.

Notes (not deviations):
- The plan's file-inventory row for `orchestrator.md` reads "Edit (+1 rule)"; contract item 5 (pinned substance, governing) pins **two** bullets, and plan § Architecture / spec § Scope both state the orchestrator carries two rules (real-time + framework autonomy). T3 applied contract item 5's two bullets, i.e. +2 added lines.
- Commit identity is reported out-of-band (Subagent Report) rather than embedded here — a commit cannot contain its own hash (T0/T1/T2 precedent).
- `python3` was not needed for T3's checks; `grep`/`git`/`sha256sum`/`diff`/`wc`/`sed` were used strictly as build-time inspection aids.
