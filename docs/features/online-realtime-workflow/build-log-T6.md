# Build log — T6 — Verify & integrate (independent verification pass)

Task: T6 (2026-10-17) — `[seq]`, depends_on T0…T5. `status: [>]` at start.
Files changed: `docs/features/online-realtime-workflow/build-log-T6.md` (this file, the only writable deliverable).
What changed & why: **no target file was changed.** T6 is a read-only, independent re-verification of the complete deliverable across the 15 target files against AC-1…AC-25, plus a commit-range inspection for AC-24 and per-file diffs vs. each task's recorded baselines for AC-25. Every command below was re-run by T6 from the repository (not copied from other logs); raw output is reproduced verbatim.

Branch: `feat/online-realtime-workflow` (no switch, no rebase/reset/amend, no history rewrite, no push).
Verified HEAD at pass time: `a1c636e2a46717a0c8949292a50bcbe9e9c24ab9` (T4 tip).

Verdict: **AC-1 … AC-25 all met.** No AC failed. Drift observations (7) are recorded in §10; none voids an AC. Two are the already-disclosed items the brief asked me to record.

---

## 0. Method and scope discipline

- Targets inspected (15): `AGENTS.md`; `docs/architecture/stack.md`; `docs/product/realtime-backlog.md`; `docs/product/vision.md`; `.opencode/agents/{orchestrator,planner,builder,reviewer}.md`; `.opencode/skills/web-implementation/{SKILL.md,references/engineering-principles.md}`; `.opencode/skills/spec-authoring/references/spec-checklist.md`; `.opencode/skills/spec-review/SKILL.md`; `.opencode/skills/code-review/checklists/{quality,security,testing}.md`.
- Read-only over those files: all inspection used `git show`, `git diff`, `git log`, `grep`, `sed`, `awk`, `wc`, `sha256sum`, and `python3` as read-only aids. No target file was opened for writing. No library/framework/runtime/tooling was introduced; the stack remains NOT DECIDED.
- T6 re-ran every command itself; other build logs were used only for the *recorded baselines* (which T6 independently reconstructed and hash-checked, §3).
- Chronological commit order is **not** task-number order (batch build): T0 `5af8715` → T1 `d41c465` → T2 `b3aeff1` → T5 `f5c4dad` → T3 `4052e50` → T4 `a1c636e` (tip). Each task's diff was resolved from its **actual parent** and from its **recorded baseline**, never by task-number order.
- Worktree state at pass start (only the pre-existing out-of-scope modification is present; all 15 targets are clean = equal to `HEAD`):

```
$ git rev-parse --abbrev-ref HEAD
feat/online-realtime-workflow
$ git rev-parse HEAD
a1c636e2a46717a0c8949292a50bcbe9e9c24ab9
$ git status --short
 M docs/features/project-glossary/status.md      # pre-existing, out of scope, untouched
?? docs/features/online-realtime-workflow/{plan,spec,status,tasks}.md   # planner/orchestrator-owned, untracked
?? docs/features/online-realtime-workflow/reviews/
?? docs/features/project-glossary/{plan,spec,tasks}.md + reviews/
$ git diff HEAD --name-only
docs/features/project-glossary/status.md
```

---

## 1. Commit graph and per-commit file lists

```
$ git log --graph --oneline --format='%h %p %s' -8
* a1c636e 4052e50 docs: add real-time implementation guidance for builder/web skill (T4)
* 4052e50 f5c4dad docs: add real-time and autonomy guidance for planner/orchestrator (T3)
* f5c4dad b3aeff1 docs: add real-time review checks for spec/code gates (T5)
* b3aeff1 d41c465 docs: add provisional real-time backlog and vision direction link (T2)
* d41c465 5af8715 docs: state online real-time nature and WebSocket constraint (T1)
* 5af8715 927fd78 chore: widen builder edit permissions for online-realtime-workflow (T0)
* 927fd78 cba610b Initial commit
* cba610b          Initial commit
```

Task→commit→parent→`files_owned` correspondence (from `git show --name-status --format='' <commit>`):

| Task | Commit | Parent | Files in commit | `files_owned` match |
| --- | --- | --- | --- | --- |
| T0 | `5af8715` | `927fd78` | `M .opencode/agents/builder.md`, `A build-log-T0.md` | ✅ exactly |
| T1 | `d41c465` | `5af8715` | `M AGENTS.md`, `M docs/architecture/stack.md`, `A build-log-T1.md` | ✅ exactly |
| T2 | `b3aeff1` | `d41c465` | `A docs/product/realtime-backlog.md`, `M docs/product/vision.md`, `A build-log-T2.md` | ✅ exactly |
| T5 | `f5c4dad` | `b3aeff1` | `M .opencode/agents/reviewer.md`, `M .opencode/skills/spec-review/SKILL.md`, `M .opencode/skills/code-review/checklists/{quality,security,testing}.md`, `A build-log-T5.md` | ✅ exactly |
| T3 | `4052e50` | `f5c4dad` | `M .opencode/agents/orchestrator.md`, `M .opencode/agents/planner.md`, `M .opencode/skills/spec-authoring/references/spec-checklist.md`, `A build-log-T3.md` | ✅ exactly |
| T4 | `a1c636e` | `4052e50` | `M .opencode/agents/builder.md`, `M .opencode/skills/web-implementation/SKILL.md`, `M .opencode/skills/web-implementation/references/engineering-principles.md`, `A build-log-T4.md` | ✅ exactly |

Whole-feature change set (baseline `927fd78` → tip `a1c636e`) — exactly the 15 targets + the six task logs, nothing else:

```
$ git diff --name-status 927fd78 a1c636e
M	.opencode/agents/builder.md
M	.opencode/agents/orchestrator.md
M	.opencode/agents/planner.md
M	.opencode/agents/reviewer.md
M	.opencode/skills/code-review/checklists/quality.md
M	.opencode/skills/code-review/checklists/security.md
M	.opencode/skills/code-review/checklists/testing.md
M	.opencode/skills/spec-authoring/references/spec-checklist.md
M	.opencode/skills/spec-review/SKILL.md
M	.opencode/skills/web-implementation/SKILL.md
M	.opencode/skills/web-implementation/references/engineering-principles.md
M	AGENTS.md
M	docs/architecture/stack.md
A	docs/features/online-realtime-workflow/build-log-T0.md
A	docs/features/online-realtime-workflow/build-log-T1.md
A	docs/features/online-realtime-workflow/build-log-T2.md
A	docs/features/online-realtime-workflow/build-log-T3.md
A	docs/features/online-realtime-workflow/build-log-T4.md
A	docs/features/online-realtime-workflow/build-log-T5.md
A	docs/product/realtime-backlog.md
M	docs/product/vision.md
```

No `.env*`, secret, or key path appears anywhere in the range (`git diff --name-only 927fd78 a1c636e | grep -iE '\.env|secret|\.pem|key'` → no output). No file outside the 15 targets and the feature's build logs was changed by any task.

---

## 2. AC-24 — commit-range permission inspection

### 2a. Permission-key lines in each commit's **agent-file** diffs

```
$ for c in 5af8715 d41c465 b3aeff1 f5c4dad 4052e50 a1c636e; do <git show $c --format='' -- '.opencode/agents/'> | grep -E '^[+-]' | grep -E 'permissions:|action:|resource:|effect:'; done
```

Raw result — **T0 only**:

```
=== 5af8715 chore: widen builder edit permissions for online-realtime-workflow (T0) ===
9:+  - action: edit
10:+    resource: "AGENTS.md"
11:+    effect: allow
12:+  - action: edit
13:+    resource: "docs/architecture/**"
14:+    effect: allow
15:+  - action: edit
16:+    resource: "docs/product/**"
17:+    effect: allow
18:+  - action: edit
19:+    resource: ".opencode/agents/*.md"
20:+    effect: allow
21:+  - action: edit
22:+    resource: ".opencode/skills/**"
23:+    effect: allow
=== d41c465 (T1) ===  (zero permission-key lines)
=== b3aeff1 (T2) ===  (zero permission-key lines)
=== f5c4dad (T5) ===  (zero permission-key lines)
=== 4052e50 (T3) === (zero permission-key lines)
=== a1c636e (T4) === (zero permission-key lines)
```

### 2b. T0's diff adds exactly the five pinned entries and nothing else

```
$ git show 5af8715 --format='' -- .opencode/agents/builder.md
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index 14fafb5..793b678 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -32,6 +32,21 @@ permissions:
   - action: edit
     resource: "index.html"
     effect: allow
+  - action: edit
+    resource: "AGENTS.md"
+    effect: allow
+  - action: edit
+    resource: "docs/architecture/**"
+    effect: allow
+  - action: edit
+    resource: "docs/product/**"
+    effect: allow
+  - action: edit
+    resource: ".opencode/agents/*.md"
+    effect: allow
+  - action: edit
+    resource: ".opencode/skills/**"
+    effect: allow
   - action: edit
     resource: ".env*"
     effect: deny

$ git show --numstat --format='%h %s' 5af8715
5af8715 chore: widen builder edit permissions for online-realtime-workflow (T0)

15	0	.opencode/agents/builder.md
399	0	docs/features/online-realtime-workflow/build-log-T0.md
```

One hunk, 15 insertions = five 3-line entries (`action: edit` / `resource: …` / `effect: allow`), 0 deletions, nothing else in the file. The five resources and their order match `tasks.md` T0 exactly.

### 2c. Permission **block** content is frozen from T0 onward

`permissions:`-through-closing-`---` region hashed per commit (`git show <c>:<path> | sed -n '/^permissions:/,/^---$/p' | sha256sum`):

| File | pre-T0 `927fd78` | T0 `5af8715` | T1 | T2 | T5 | T3 | T4 (tip) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `orchestrator.md` | `e286158f4f5ca968` | `e286158f…` | `e286158f…` | `e286158f…` | `e286158f…` | `e286158f…` | `e286158f…` |
| `planner.md` | `595e33b2fe93fd25` | `595e33b2…` | `595e33b2…` | `595e33b2…` | `595e33b2…` | `595e33b2…` | `595e33b2…` |
| `builder.md` | `ee1c0d5519fa923e` | **`a683feed4cb59700`** | `a683feed…` | `a683feed…` | `a683feed…` | `a683feed…` | `a683feed…` |
| `reviewer.md` | `d7831de7732b5a5f` | `d7831de7…` | `d7831de7…` | `d7831de7…` | `d7831de7…` | `d7831de7…` | `d7831de7…` |

Only `builder.md`'s region changed, and only at T0. The other three agents' permission blocks are byte-identical across the entire range.

Deny set unchanged by T0 (and elsewhere):

```
pre-T0 927fd78  denies: 10   allows: 10
post-T0 (tip)   denies: 10   allows: 15
$ diff <(git show 927fd78:.opencode/agents/builder.md | grep -B2 'effect: deny') \
       <(git show a1c636e:.opencode/agents/builder.md | grep -B2 'effect: deny')
DENY BLOCKS IDENTICAL
```

Structural assertion (T0 `verify`, re-run read-only by T6, `python3` + YAML parse of the `permissions:` frontmatter):

```
frontmatter parsed OK; keys: ['color', 'description', 'mode', 'model', 'permissions', 'steps']
permission item count: 25
items missing action/resource/effect: 0
edit entries: 15
  [00] *                                      deny
  [01] src/**                                 allow
  [02] tests/**                               allow
  [03] public/**                              allow
  [04] docs/features/**/build-log*.md         allow
  [05] package.json                           allow
  [06] tsconfig.json                          allow
  [07] *.config.*                             allow
  [08] index.html                             allow
  [09] AGENTS.md                              allow
  [10] docs/architecture/**                   allow
  [11] docs/product/**                        allow
  [12] .opencode/agents/*.md                  allow
  [13] .opencode/skills/**                    allow
  [14] .env*                                  deny
ASSERTION: PASS
```

Five anchors present + idempotency-guard condition holds (so a bootstrap re-run would take the no-op branch; T6 deliberately did **not** execute the write-path script, staying read-only):

```
$ grep -n 'resource: "AGENTS.md"\|resource: "docs/architecture/\*\*"\|resource: "docs/product/\*\*"\|resource: "\.opencode/agents/\*\.md"\|resource: "\.opencode/skills/\*\*"' .opencode/agents/builder.md
36:    resource: "AGENTS.md"
39:    resource: "docs/architecture/**"
42:    resource: "docs/product/**"
45:    resource: ".opencode/agents/*.md"
48:    resource: ".opencode/skills/**"
exit=0
$ python3 -c '<replicates the driver guard: marker present AND followed by effect: allow>'
marker present: True
guard condition (-> re-run would take the no-op branch, exit 0): True
```

### 2d. Permission-key text outside T0 exists only as build-log prose

A whole-commit grep (including logs) matches permission-key **text** in non-T0 commits — always inside `docs/features/online-realtime-workflow/build-log-T*.md` prose (AC-24 discussion or verbatim baseline quotations of agent frontmatter). Breakdown:

```
T0 5af8715: .opencode/agents/builder.md -> 15     (the real change)
            docs/features/.../build-log-T0.md -> 98  (log quotes)
T1 d41c465: build-log-T1.md -> 2   ("T1 touches no `permissions:` block…" lines)
T2 b3aeff1: build-log-T2.md -> 2   (same kind of AC-24 statements)
T5 f5c4dad: build-log-T5.md -> 45  (log quotes reviewer.md baseline frontmatter)
T3 4052e50: build-log-T3.md -> 84  (log quotes orchestrator/planner baseline frontmatter)
T4 a1c636e: build-log-T4.md -> 88  (log quotes builder.md baseline frontmatter)
```

**AC-24 statement:** only `5af8715` (T0) modifies a `permissions:` block or any allow/deny entry in `.opencode/agents/*.md`; that commit adds exactly the five pinned entries and no other permission content; T1, T2, T3, T4, T5 contain **zero** permission-key lines in their code diffs (agent-file diffs are empty of any `permissions:`/`action:`/`resource:`/`effect:` line). → **AC-24 met.**

---

## 3. AC-25 foundation — recorded baselines reconstructed and hash-verified

T6 did not trust the logs' prose: each recorded baseline was reconstructed from the repository and its sha256 compared with the value recorded in the task's build log. All 15 match byte-for-byte.

| Task | Baseline source (rev) | Path | Recorded sha256 (log) | T6 recomputed | Result |
| --- | --- | --- | --- | --- | --- |
| T0 | `927fd78` | `.opencode/agents/builder.md` | `1c5d222e…9a5a3` | `1c5d222e8b1982784737917180df702ab3eca130f8d971417375174ddf99a5a3` | ✅ |
| T1 | `5af8715` | `AGENTS.md` | `2ce7501a…c63e8` | `2ce7501a9809413aeff862cdadaccaceea04cff155b5120aa53dea31640c63e8` | ✅ |
| T1 | `5af8715` | `docs/architecture/stack.md` | `fa5b87e0…26bd37` | `fa5b87e0050b971cc907e6f6a6785b881dfb0bab19386fa4ad9780671626bd37` | ✅ |
| T2 | `d41c465` | `docs/product/vision.md` | `ea8c912e…78be4` | `ea8c912e0b29f560c424f3fad4c6d70b0e4fbe8ce7dd7f395f8c923337878be4` | ✅ |
| T3 | `b3aeff1` | `.opencode/agents/orchestrator.md` | `c23b338a…99f69` | `c23b338a8344c1c8c3041250cb651ff74bdffdab0a2840ab0b0c1617be199f69` | ✅ |
| T3 | `b3aeff1` | `.opencode/agents/planner.md` | `52cc5f2c…00695b` | `52cc5f2cf26eb0e33d2a334c8ee857a47533582a072b7e75e3908858c300695b` | ✅ |
| T3 | `b3aeff1` | `.opencode/skills/spec-authoring/references/spec-checklist.md` | `e0b19535…7d5214` | `e0b19535064764deb2cb274f57ada95b2f57bf8666c1e31d23c0fa8ae17d5214` | ✅ |
| T4 | `b3aeff1` (post-T0) | `.opencode/agents/builder.md` | `7eb8a152…9bcf4` | `7eb8a152d4086cf3bdb42a7c26493f789ca32a690d4e0cb973f02413f9f9bcf4` | ✅ |
| T4 | `b3aeff1` | `.opencode/skills/web-implementation/SKILL.md` | `d3094c45…44cdc0f` | `d3094c45faae2bbc070f56d6ed061d1174f0e30e96b0bcad9d5560f8844cdc0f` | ✅ |
| T4 | `b3aeff1` | `.opencode/skills/web-implementation/references/engineering-principles.md` | `ef60983a…540392` | `ef60983a924c4b572e67b1d7341cd02c79018f3287fbb20fa85b3acf3d540392` | ✅ |
| T5 | `b3aeff1` | `.opencode/agents/reviewer.md` | `5bb59a96…5da2d0e` | `5bb59a9641f0aa074dd25a57164c8bb23df7c4747929e81f35aaf6d6a5da2d0e` | ✅ |
| T5 | `b3aeff1` | `.opencode/skills/spec-review/SKILL.md` | `30dfbedb…8ac3bc7` | `30dfbedb1279270dd472ac7af35e769e42cfc9d8341619d63245ab96f8ac3bc7` | ✅ |
| T5 | `b3aeff1` | `.opencode/skills/code-review/checklists/quality.md` | `5c6f4ac5…b58c4` | `5c6f4ac56a526119bc5f1d8bf0ccb4e7c240177138d337edc5374b94772b58c4` | ✅ |
| T5 | `b3aeff1` | `.opencode/skills/code-review/checklists/security.md` | `10bb5f40…da8bcf` | `10bb5f40412e1a09edd793578a93af02359d4927df63781186371e72f9da8bcf` | ✅ |
| T5 | `b3aeff1` | `.opencode/skills/code-review/checklists/testing.md` | `c568ecd6…2b90b` | `c568ecd69f8a6d852a2e4269f30a216d45cfa6cee26f7dda5340bf3fdeb2b90b` | ✅ |

**Baseline vs. actual parent (interleaved-graph check).** T3 and T4 captured their baselines at build-start `HEAD` = `b3aeff1`, while their commits' actual parents are `f5c4dad` (T3) and `4052e50` (T4). T6 verified the baselines are still exact on the actual parents (same blob ids):

```
.opencode/agents/orchestrator.md                  b3aeff1=d3ccb1d9…  4052e50^=f5c4dad=d3ccb1d9…  IDENTICAL
.opencode/agents/planner.md                       b3aeff1=4a256b30…  4052e50^=f5c4dad=4a256b30…  IDENTICAL
.opencode/skills/spec-authoring/…/spec-checklist.md b3aeff1=de7c2a06… 4052e50^=f5c4dad=de7c2a06… IDENTICAL
.opencode/agents/builder.md                       b3aeff1=793b6782…  a1c636e^=4052e50=793b6782…  IDENTICAL
.opencode/skills/web-implementation/SKILL.md      b3aeff1=6e8cbb80…  a1c636e^=4052e50=6e8cbb80…  IDENTICAL
.opencode/skills/web-implementation/…/engineering-principles.md b3aeff1=46e21bef… a1c636e^=4052e50=46e21bef… IDENTICAL
T5 five files (reviewer, spec-review, quality, security, testing) b3aeff1 == f5c4dad^  IDENTICAL
```

So the T3/T4 diffs are baseline-correct on their commits' real parents. No baseline was stale.

---

## 4. AC-25 — per-file diffs vs. each task's recorded baseline

`show()` below emits `git diff --numstat` (additions/deletions), hunk count, and raw added/deleted line counts. Per the spec's **accounting rule**, a pinned in-place replacement line counts as a **modification** (it appears as 1 deletion + 1 re-added line in git terms), never as added or deleted *content*.

```
--- T0 (baseline 927fd78) ---
.opencode/agents/builder.md | numstat=+15 -0 | hunks=1 | rawadd=15 rawdel=0
--- T1 (baseline 5af8715) ---
AGENTS.md                   | numstat=+2 -1 | hunks=2 | rawadd=2 rawdel=1
docs/architecture/stack.md  | numstat=+6 -0 | hunks=1 | rawadd=4 rawdel=0 (incl. 2 blank added lines)
--- T2 (baseline d41c465) ---
docs/product/realtime-backlog.md | numstat=+26 -0 | hunks=1 | (new file)
docs/product/vision.md           | numstat=+2 -1 | hunks=1 | rawadd=2 rawdel=1
--- T3 (baseline b3aeff1; actual parent f5c4dad) ---
.opencode/agents/orchestrator.md                                  | numstat=+2 -0 | hunks=1
.opencode/agents/planner.md                                       | numstat=+1 -0 | hunks=1
.opencode/skills/spec-authoring/references/spec-checklist.md      | numstat=+4 -0 | hunks=1
--- T4 (baseline b3aeff1 = post-T0; actual parent 4052e50) ---
.opencode/agents/builder.md                                            | numstat=+1 -0 | hunks=1
.opencode/skills/web-implementation/SKILL.md                           | numstat=+1 -0 | hunks=1
.opencode/skills/web-implementation/references/engineering-principles.md | numstat=+9 -0 | hunks=1
--- T5 (baseline b3aeff1; actual parent f5c4dad) ---
.opencode/agents/reviewer.md                         | numstat=+1 -0 | hunks=1
.opencode/skills/spec-review/SKILL.md                | numstat=+1 -0 | hunks=1
.opencode/skills/code-review/checklists/quality.md   | numstat=+7 -0 | hunks=1
.opencode/skills/code-review/checklists/security.md  | numstat=+7 -0 | hunks=1
.opencode/skills/code-review/checklists/testing.md   | numstat=+5 -0 | hunks=1
```

Shape vs. the plan's file inventory:

| File | Inventory row | Observed | Verdict |
| --- | --- | --- | --- |
| `AGENTS.md` | +1 modified line, +1 bullet | 2 hunks: 1 modification (1 del + 1 add on the intro line) + 1 added bullet | ✅ |
| `docs/architecture/stack.md` | +1 section | pure insertion, 6 lines (blank/heading/blank/3 bullets/blank), 0 deletions | ✅ |
| `docs/product/realtime-backlog.md` | New | `new file`, 26 lines, 0 deletions | ✅ |
| `docs/product/vision.md` | +1 modified line, +1 added line | 1 hunk: 1 modification (1 del + 1 add) + 1 net-new add | ✅ |
| `.opencode/agents/orchestrator.md` | +1 rule (contract 5 pins 2) | 2 added lines, 0 deletions | ✅ (see §10-1) |
| `.opencode/agents/planner.md` | +1 rule | 1 added line, 0 deletions | ✅ |
| `.opencode/skills/spec-authoring/…/spec-checklist.md` | +1 section | 4 added lines (blank + heading + 2 checkboxes) | ✅ |
| `.opencode/agents/builder.md` | T0: +5 entries; T4: +1 rule | T0 `+15 -0`; T4 `+1 -0`; combined vs. pre-T0 `+16 -0`, 2 hunks | ✅ |
| `.opencode/skills/web-implementation/SKILL.md` | +1 rule | 1 added line, 0 deletions | ✅ |
| `.opencode/skills/web-implementation/…/engineering-principles.md` | +1 section | 9 added lines (blank + heading + blank + 6 bullets), 0 deletions | ✅ |
| `.opencode/agents/reviewer.md` | +1 rule | 1 added line, 0 deletions | ✅ |
| `.opencode/skills/spec-review/SKILL.md` | +1 item | 1 added line, 0 deletions | ✅ |
| `.opencode/skills/code-review/checklists/quality.md` | +1 section | 7 added lines (blank + heading + 5 rows) | ✅ |
| `.opencode/skills/code-review/checklists/security.md` | +1 section | 7 added lines (blank + heading + 5 rows) | ✅ |
| `.opencode/skills/code-review/checklists/testing.md` | +1 section | 5 added lines (blank + heading + 3 rows) | ✅ |

**`builder.md` two-phase check (as required):**

```
phase 1 — T0 vs. T0 baseline (927fd78):   +15 -0, 1 hunk  = exactly the five pinned edit-allow entries, nothing else
phase 2 — T4 vs. T4 baseline (b3aeff1, post-T0): +1 -0, 1 hunk = exactly contract item 8's prose rule
combined — T0+T4 vs. pre-T0 baseline (927fd78): +16 -0, 2 hunks
  hunk 1: @@ -32,6 +32,21 @@ permissions:   (+15: the five entries)
  hunk 2: @@ -74,6 +89,7 @@ ## Rules              (+1: the real-time prose rule)
```

**Removals across the whole feature (only the two pinned replacement lines):**

```
$ git diff 927fd78 a1c636e -- AGENTS.md docs/architecture/stack.md docs/product/ .opencode/ | grep '^-[^-]'
-CubeClicker is a web-based clicker game. This project is AI-native: …
-A web-based clicker game built and maintained by an AI-native development team.
```

These are exactly contract item 1.A's intro line (replaced by the online/real-time/multi-client descriptor, `AGENTS.md:3`) and contract item 4.A's One-liner (`vision.md:7`). Both count as **modifications** under the accounting rule; there are no other removals anywhere.

**AC-25 statement:** for all 15 targets the diff vs. the recorded build-start baseline contains only the pinned additions/modifications, plus (for `builder.md` only) T0's five permission entries checked as two per-task diffs; no unrelated or drive-by edits; no removals other than the two pinned replacement lines. → **AC-25 met.**

---

## 5. Per-AC evidence table (AC-1 … AC-25)

Line numbers are in the current committed files (`HEAD` = `a1c636e`).

| AC | Met | Raw evidence (T6 re-run) | Location |
| --- | --- | --- | --- |
| AC-1 | ✅ | `grep -in "online\|real-time" AGENTS.md` → line 3: "CubeClicker is a web-based, **online**, **real-time**, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users)." | `AGENTS.md:3` (intro) |
| AC-2 | ✅ | `grep -in websocket AGENTS.md` → line 8: "the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this." Both (a) backend compatible and (b) frontend connects, stated as protocol-level. | `AGENTS.md:8` (§ Stack) |
| AC-3 | ✅ | Added-lines scan over T1's `AGENTS.md`+`stack.md` additions for technology names → `exit=1` (no matches). The only `framework`/`library`/`runtime` words in the additions are the explicit negation ("No framework, library, or runtime is implied or chosen"). Pre-existing NOT DECIDED bullet appears as **context** in `git diff 5af8715 d41c465 -- AGENTS.md` (unchanged, no `-` line) and reads identically at `AGENTS.md:7`. Only named technology = WebSocket protocol. | `AGENTS.md:7,8`; diff §6-T1 |
| AC-4 | ✅ | `stack.md` diff vs. baseline = pure insertion (0 deletions; `Status: NOT DECIDED` at `:3` and all pre-existing bullets/paragraph appear as context). New `## Hard constraints (all candidates)` at `:11`; `:13` = "Any selected stack must support a **WebSocket server** on the backend and **WebSocket client** connections from the frontend." | `stack.md:3,11,13` |
| AC-5 | ✅ | Same technology-name scan → no matches in `stack.md` additions. `:15` = "This section constrains capability only; it names no technology and the stack remains **NOT DECIDED** until the stack-selection task decides it." | `stack.md:15` |
| AC-6 | ✅ | `grep -in "not commitments" docs/product/realtime-backlog.md` → `:3` "> Provisional direction — **not commitments**. Nothing here is promised, scheduled, or approved." File exists (`git diff --name-status` = `A`). | `realtime-backlog.md:3` |
| AC-7 | ✅ | `grep -in "live statistics\|other users' clicks\|connected users"` → `:9` Live statistics; `:10` Other users' clicks; `:11` Connected users (one line each). | `realtime-backlog.md:9–11` |
| AC-8 | ✅ | Headings: `H1 count: 1`, `## count: 3`, all-headings `4` → `# Real-Time Feature Backlog` (`:1`) + `## Candidates from the request` (`:7`) + `## Proposed additions (unconfirmed — not requested, not committed)` (`:15`) + `## Open tensions` (`:21`) = the pinned closed set exactly; every other block element maps to an element enumerated in contract 3 (§8 map). Technology-name scan over the whole file → `exit=1` (none; "WebSocket" does not appear at all). Implementation-planning scan (`schema\|api\|endpoint\|architecture\|implement\|deploy\|server-side code\|protocol`) → `exit=1`. | `realtime-backlog.md:1,3,5,7,13,15,21,26` |
| AC-9 | ✅ | Unconfirmed marking present on two levels: section heading `:15` "**(unconfirmed — not requested, not committed)**" and file-level non-commitment blockquote `:3`. The three non-request entries (`:17` global live counter, `:18` live leaderboard, `:19` community milestones) sit under that heading. | `realtime-backlog.md:15,17–19` |
| AC-10 | ✅ | `grep -in accounts` → `:23` "**Identity vs. "no accounts required".** Presence and attribution imply some notion of a user or session, which can collide with the vision's "no accounts required" principle; this must be reconciled before any presence or attribution feature is scoped. Flagged here, not resolved." | `realtime-backlog.md:23` |
| AC-11 | ✅ | `sed -n '7p' docs/product/vision.md` → "A web-based, **online**, **real-time** clicker game built and maintained by an AI-native development team." vs. T2 baseline (`d41c465`, sha256 `ea8c912e…`): `difflib` opcode map = **one** `replace` at baseline line 7 → new lines 7–8; `equal lines: 22 of baseline 23`. Per the accounting rule it is a **modification**, not added/deleted content. | `vision.md:7` |
| AC-12 | ✅ | `git diff --numstat d41c465 b3aeff1 -- docs/product/vision.md` → `2 1` (1 modification + 1 net-new add). Net-new line = `vision.md:8` "> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments." Label references the backlog/direction. Link resolution: `label='realtime-backlog.md' target='realtime-backlog.md' -> docs/product/realtime-backlog.md exists=True`. All other pre-existing content unchanged. | `vision.md:8`; target `docs/product/realtime-backlog.md` |
| AC-13 | ✅ | (a) `grep -in "real-time" .opencode/agents/orchestrator.md` → `:54` "Online/real-time awareness: the game is online and real-time (`AGENTS.md`, `docs/architecture/stack.md`); when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary." (b) `grep -in "autonom\|2026-10-16"` → `:55` "Framework **autonomy**: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; approach the user only for genuine blockers or materially user-owned decisions (user directive of **2026-10-16**, …)". Diff vs. baseline = `+2 -0`, 1 hunk, both lines in `## Iron rules`. | `orchestrator.md:54,55` |
| AC-14 | ✅ | `grep -in "real-time" .opencode/agents/planner.md` → `:68` "Real-time: specs for features touching shared or cross-client state address **connection lifecycle**, **reconnection**, **multi-client behavior**, and **server authority for shared values** — or state them as explicitly out of scope — and flag **identity vs. "no accounts" conflicts** as open questions. Assume no stack beyond the WebSocket protocol requirement." Diff = `+1 -0`. Added-lines technology-name scan → none. | `planner.md:68` |
| AC-15 | ✅ | `grep -in "real-time" .opencode/skills/spec-authoring/references/spec-checklist.md` → `:35` "## **Real-time** (when the feature touches shared/cross-client state)" with `:36` (connection lifecycle / reconnection / multi-client behavior / server authority — addressed or explicitly out of scope) and `:37` (identity vs. "no accounts" conflicts flagged as open questions). Diff = `+4 -0` (blank + heading + 2 items). | `spec-checklist.md:35–37` |
| AC-16 | ✅ | `grep -in "real-time" .opencode/agents/builder.md` → `:92` "Real-time: shared/cross-client state is **server-authoritative** — **never trust client-reported values**; **own the connection lifecycle** (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules." T4 diff vs. its post-T0 baseline = `+1 -0`; permission block untouched (§2c: region hash `a683feed…` on both sides). | `builder.md:92` |
| AC-17 | ✅ | `web-implementation/SKILL.md:26` (Architecture rules bullet): "Real-time (WebSocket): **one owner for the connection lifecycle** (connect → open → close → reconnect); **reconnection is bounded and resyncs state**; **shared/cross-client state is server-authoritative** (the client never trusts reported values); **teardown closes connections and removes handlers**. **Depth in `references/engineering-principles.md` § Real-time principles.**" Diff = `+1 -0`. | `web-implementation/SKILL.md:26` |
| AC-18 | ✅ | New section `## Real-time (WebSocket) principles` at `:45` with exactly 6 bullets: `:47` single connection owner (UI observes status, never opens its own socket); `:48` lifecycle & reconnection (bounded, resync, idempotent handlers — no duplicates across reconnects); `:49` server authority (shared/global values from the server; optimistic UI reconciles; client-reported values never truth); `:50` untrusted inbound data (validate shape/type, ignore unknown, `textContent`, never `innerHTML`); `:51` graceful degradation (loss visible and non-fatal, local play/saves unaffected); `:52` testability (injected/fakeable connection, no real network). Diff = `+9 -0`, one new section. | `engineering-principles.md:45–52` |
| AC-19 | ✅ | `reviewer.md:59` "For features touching shared or cross-client state, apply the skills' real-time checks: **connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state**; **unverifiable real-time behavior counts as unmet**." Diff = `+1 -0`. | `reviewer.md:59` |
| AC-20 | ✅ | `spec-review/SKILL.md:25` "**Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged." Appended to the Checklist list (previous item `:24` Risks). Diff = `+1 -0`. | `spec-review/SKILL.md:25` |
| AC-21 | ✅ | `quality.md` `:33` section "## Real-time (if the feature uses the connection)" with `:34` one lifecycle owner; `:35` no duplicate handlers after reconnect + teardown; `:36` bounded reconnection with resync; `:37` multi-client behavior consistent or single-client scope explicit, all `- [ ]` rows; `:38` shared/global values server-authoritative. Diff = `+7 -0`; file's `- [ ]` row convention preserved. | `quality.md:33–38` |
| AC-22 | ✅ | `security.md` `:34` section "## Real-time & untrusted messages (if applicable)" with `:35` inbound messages untrusted (shape/type-validated, unknown/malformed ignored, no crash/state change); `:36` untrusted text via `textContent` — never `innerHTML`/`insertAdjacentHTML`; `:37` no API keys/tokens/secrets in client code or messages; `:38` secure transport (`wss://` on https; no mixed content); `:39` shared state never derived from unvalidated client-reported values. Diff = `+7 -0`. | `security.md:34–39` |
| AC-23 | ✅ | `testing.md` `:28` section "## Real-time coverage (if applicable)" with `:29` multi-client behavior has ≥1 test (two clients, same shared state); `:30` reconnect/close paths tested via simulated connection events (no real network) incl. resync; `:31` malformed/unknown inbound messages handled in tests. Diff = `+5 -0`. | `testing.md:28–31` |
| AC-24 | ✅ | §2 above. Only `5af8715` (T0) touches a permission block; its `builder.md` diff = `+15 -0` = exactly the five pinned entries, 0 other permission content, deny blocks byte-identical, other three agents' permission regions identical across the whole range; T1/T2/T3/T4/T5 agent-file diffs contain **zero** permission-key lines. | `.opencode/agents/builder.md` (T0 diff); §2a–2d |
| AC-25 | ✅ | §3/§4 above. All 15 recorded baselines reconstruct byte-identically; every per-file diff contains only the pinned additions/modifications (0 deletions except the 2 pinned replacement lines, which count as modifications); `builder.md` verified as two per-task diffs plus the combined view; no unrelated/drive-by edits anywhere. | §3, §4 |

---

## 6. Task-named verify greps re-run by T6 (raw)

All commands below were run by T6 against the committed tree at `HEAD` = `a1c636e` (target files clean).

```
--- T1 V1: grep -in "online\|real-time" AGENTS.md ---
3:CubeClicker is a web-based, online, real-time, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users). This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.
8:- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.

--- T1 V2: grep -in "websocket" AGENTS.md docs/architecture/stack.md ---
AGENTS.md:8:- **Online/real-time constraint (protocol-level).** …must be WebSocket-compatible and the frontend must connect to it over WebSocket. …
docs/architecture/stack.md:13:- Any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend.

--- T1 V3: grep -n "NOT DECIDED" AGENTS.md docs/architecture/stack.md ---
AGENTS.md:7:- **NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency; the builder reports `blocked` instead of guessing.
docs/architecture/stack.md:3:**Status: NOT DECIDED**
docs/architecture/stack.md:15:- This section constrains capability only; it names no technology and the stack remains NOT DECIDED until the stack-selection task decides it.

--- T2 V1: grep -in "not commitments\|accounts" docs/product/realtime-backlog.md ---
3:> Provisional direction — **not commitments**. Nothing here is promised, scheduled, or approved.
23:- **Identity vs. "no accounts required".** Presence and attribution imply some notion of a user or session, which can collide with the vision's "no accounts required" principle; this must be reconciled before any presence or attribution feature is scoped. Flagged here, not resolved.

--- T2 V2: grep -in "realtime-backlog.md" docs/product/vision.md ---
8:> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.

--- T3 V1: grep -in "real-time" .opencode/agents/orchestrator.md .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md ---
.opencode/agents/orchestrator.md:54:- Online/real-time awareness: the game is online and real-time (`AGENTS.md`, `docs/architecture/stack.md`); when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary.
.opencode/agents/planner.md:68:- Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.
.opencode/skills/spec-authoring/references/spec-checklist.md:35:## Real-time (when the feature touches shared/cross-client state)

--- T3 V2: grep -in "autonom\|2026-10-16" .opencode/agents/orchestrator.md ---
55:- Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; approach the user only for genuine blockers or materially user-owned decisions (user directive of 2026-10-16, quoted in `docs/features/online-realtime-workflow/spec.md` Q-1).

--- T4 V1: grep -in "real-time" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md ---
.opencode/agents/builder.md:92:- Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.
.opencode/skills/web-implementation/SKILL.md:26:- Real-time (WebSocket): one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (the client never trusts reported values); teardown closes connections and removes handlers. Depth in `references/engineering-principles.md` § Real-time principles.
.opencode/skills/web-implementation/references/engineering-principles.md:45:## Real-time (WebSocket) principles

--- T5 V1: grep -in "real-time" .opencode/agents/reviewer.md .opencode/skills/spec-review/SKILL.md .opencode/skills/code-review/checklists/*.md ---
.opencode/agents/reviewer.md:59:- For features touching shared or cross-client state, apply the skills' real-time checks: connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state; unverifiable real-time behavior counts as unmet.
.opencode/skills/spec-review/SKILL.md:25:- **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.
.opencode/skills/code-review/checklists/quality.md:33:## Real-time (if the feature uses the connection)
.opencode/skills/code-review/checklists/security.md:34:## Real-time & untrusted messages (if applicable)
.opencode/skills/code-review/checklists/testing.md:28:## Real-time coverage (if applicable)
```

### 6a. "real-time" token across the role/skill/checklist files (ACs 13–23) and the four doc targets

```
AGENTS.md                                                              2
docs/architecture/stack.md                                             1
docs/product/realtime-backlog.md                                       2
docs/product/vision.md                                                 2
.opencode/agents/orchestrator.md                                       1
.opencode/agents/planner.md                                            1
.opencode/agents/builder.md                                            1
.opencode/agents/reviewer.md                                           1
.opencode/skills/web-implementation/SKILL.md                           1
.opencode/skills/web-implementation/references/engineering-principles.md 1
.opencode/skills/spec-authoring/references/spec-checklist.md           1
.opencode/skills/spec-review/SKILL.md                                  1
.opencode/skills/code-review/checklists/quality.md                     1
.opencode/skills/code-review/checklists/security.md                    1
.opencode/skills/code-review/checklists/testing.md                     1
```

Every one of the 11 role/skill/checklist files carries the token (1 each), and in fact all 15 targets do. (The brief's phrasing "13 role/skill/checklist files" exceeds the actual set of 11 such files; see §10-5.)

### 6b. Technology-name scan over **all** added lines of the 15 targets (`927fd78` → `a1c636e`)

```
$ <added lines of the 15 targets, re-scanned with a ~40-alternative pattern of specific
   library/framework/runtime/product/vendor names (the same pattern family T1/T3/T4/T5 used;
   the concrete name list is omitted here to honour the T6 no-technology-names constraint)>
exit=1  (no matches)

$ <same added lines, for the category words> framework|librar(y|ies)|runtime|vendor|package
18:+- Framework autonomy: mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; … ("Framework autonomy" = the pinned concept name from contract 5 / AC-13(b))
56:+- **Online/real-time constraint (protocol-level).** …No framework, library, or runtime is implied or chosen. … (explicit negation)
```

No library, framework, runtime, package, or vendor **name** appears in any added content; the only named technology anywhere in the additions is the WebSocket protocol (6 added lines contain the protocol token). (Note: the word-boundary scan matters — an unanchored scan of the same name list false-positives on substrings inside ordinary words of the added prose, as T4/T5 also recorded.)

---

## 7. Vision check (AC-11, AC-12) — raw

```
$ git diff d41c465 b3aeff1 -- docs/product/vision.md
diff --git a/docs/product/vision.md b/docs/product/vision.md
index 8b40044..b0d9019 100644
--- a/docs/product/vision.md
+++ b/docs/product/vision.md
@@ -4,7 +4,8 @@
 
 ## One-liner
 
-A web-based clicker game built and maintained by an AI-native development team.
+A web-based, online, real-time clicker game built and maintained by an AI-native development team.
+> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.
 
 ## Core loop
```

Independent (non-git) line-by-line comparison of the baseline blob and the committed blob:

```
baseline lines: 23   new lines: 24
opcode map (difflib, autojunk off):
  replace baseline 7..7 -> new 7..8
equal lines: 22 of baseline 23
```

- Exactly **one** modified line (baseline line 7 → new line 7), counted as a modification per the accounting rule; **exactly one** net-new added line (new line 8). All 22 other baseline lines byte-identical. → AC-11 ✅, AC-12 ✅.
- Link target: `label='realtime-backlog.md' target='realtime-backlog.md' -> docs/product/realtime-backlog.md exists=True` → AC-12 ✅.

Plan-quote re-verification (build-start governs; the plan-time quote in `plan.md` § Pinned content contracts item 4 re-checked by T6):

```
$ awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f{print}' docs/features/online-realtime-workflow/plan.md > /tmp/opencode/t6-planquote.md
$ sha256sum /tmp/opencode/t6-planquote.md /tmp/opencode/t6-baseline-vision.md
ea8c912e0b29f560c424f3fad4c6d70b0e4fbe8ce7dd7f395f8c923337878be4  /tmp/opencode/t6-planquote.md
ea8c912e0b29f560c424f3fad4c6d70b0e4fbe8ce7dd7f395f8c923337878be4  /tmp/opencode/t6-baseline-vision.md
$ cmp /tmp/opencode/t6-planquote.md /tmp/opencode/t6-baseline-vision.md && echo "EQUIVALENCE"
EQUIVALENCE
```

The plan-time quote equals the T2 build-start baseline byte-for-byte (T2 recorded equivalence; T6 independently reproduces it) — no divergence, build-start capture governs and is the plan quote.

---

## 8. Backlog closed-section-set check (AC-8)

Full file (26 lines) inspected; heading counts and block map recomputed:

```
$ grep -n '^#\{1,6\} ' docs/product/realtime-backlog.md
1:# Real-Time Feature Backlog
7:## Candidates from the request
15:## Proposed additions (unconfirmed — not requested, not committed)
21:## Open tensions
$ H1=1  H2=3  all-headings=4
```

| Block | Line(s) | Maps to contract item 3 element |
| --- | --- | --- |
| 1 | 1 | H1 title |
| 2 | 3 | blockquote "Provisional direction — **not commitments**" |
| 3 | 5 | one-line "why this file exists" paragraph |
| 4 | 7 | `## Candidates from the request` |
| 5 | 9–11 | three single-line candidate bullets (live statistics; other users' clicks; connected users) |
| 6 | 13 | "etc." stays-open note (contract: "a note that the request's 'etc.' stays open") — see §10-3 |
| 7 | 15 | `## Proposed additions (unconfirmed — not requested, not committed)` |
| 8 | 17–19 | three proposal one-liners (global live counter; live leaderboard; community milestones) = "up to three" |
| 9 | 21 | `## Open tensions` |
| 10 | 23–24 | identity vs. "no accounts required" (mentions "accounts"); server-authority one-liner |
| 11 | 26 | closing non-commitment rule (real only via normal feature requests; user owns the list) |

No other headings, tables, code fences, or horizontal rules. No technology names (scan clean; "WebSocket" absent). No implementation planning (scan clean). → AC-6…AC-10 met; see §10-3 for the one wording nuance.

---

## 9. Drift audit summary

- **No AC failed.** AC-1 … AC-25 all met (§5).
- **No task commit touched a file outside its `files_owned`** (§1) and no commit outside T0 touched any permission block (§2).
- **No target file was edited by T6** (read-only pass; only this log is written and committed).
- All observed deviations from a *literal* reading of the pinned contracts are recorded in §10; each was already disclosed by a builder or is a documentation-wording nuance with no AC impact, and none was papered over.

---

## 10. Observations / drift notes (recorded for the reviewer, none void an AC)

1. **T3 — plan inventory row vs. contract 5 (already disclosed).** `plan.md:116` (file inventory) says `.opencode/agents/orchestrator.md` = "Edit (+1 rule)", while contract 5 (`plan.md:74–75`) pins **two** bullets (real-time awareness; framework autonomy), and `plan.md § Architecture` / `spec.md § Scope` also state the orchestrator carries two rules. T3 applied the contract: `+2 -0` in `orchestrator.md` (verified §4). I flag this as a plan-document inconsistency the reviewer may confirm; the governing pinned substance (contract 5) and AC-13 are satisfied. Recorded, not fixed (T6 is read-only).
2. **T4 — §5 parent correction (already disclosed).** `build-log-T4.md:480` records `parent: b3aeff1 (T2)`; the commit's actual parent is `4052e50` (T3), verified by `git rev-parse a1c636e^` → `4052e50bba40029e4842589180a119bec02a1ed5`. This is the sanctioned correction the brief names: T4's build-start baseline (`b3aeff1`) is nevertheless byte-identical on the real parent (§3), so the correction changes only the recorded `parent:` field, not any evidence.
3. **T2 — contract 3's closure sentence vs. the mandatory "etc." note.** `plan.md:39` closes the element set with "the blockquote, the one-line 'why' paragraph, and the closing non-commitment rule are the only block elements otherwise", yet the same contract mandates "a note that the request's 'etc.' stays open", which the file carries as its own paragraph at `realtime-backlog.md:13`. Strict reading: one block element beyond the three named. AC-8's operative criterion ("the file's section set is enumerable and matches that pinned closed set exactly", plus no technology names and no implementation planning) **is** satisfied — the note is itself an enumerated contract element and introduces no section/heading. Recorded as a contract-wording nuance for the reviewer.
4. **T2 — vision link line has no blank separator (deliberate).** `vision.md:7–8` are contiguous: the `> **Direction:** …` blockquote immediately follows the One-liner text line, so the diff is exactly +1 modified / +1 added as the inventory row and AC-12 require. CommonMark permits a block quote to interrupt a paragraph, so the intended rendering holds; rendering itself is not machine-verifiable here (no project tooling, stack NOT DECIDED) and is therefore recorded as an unverified-by-tooling observation, not an AC claim.
5. **Count nuance in the T6 brief (no AC impact).** The brief refers to "13 role/skill/checklist files"; the contract sets are 4 agent files + 7 skill/checklist files = **11**. All 11 carry the "real-time" token, and all 15 targets carry it (§6a). Recorded so the count discrepancy in the brief is not mistaken for a missing file.
6. **Non-T0 commits contain permission-key *text* in build logs only.** A naive whole-commit `grep` matches `permissions:`/`action:`/`resource:`/`effect:` inside `build-log-T{0,1,2,3,4,5}.md` (AC-24 prose or verbatim baseline quotations of agent frontmatter — e.g. `build-log-T3.md` 84 lines, `build-log-T5.md` 45 lines, `build-log-T4.md` 88 lines). These are `docs/**` log content, not edits to `.opencode/agents/*.md` permission content; the agent-file diffs of T1/T2/T3/T4/T5 contain zero such lines (§2a, §2d). Flagged so the reviewer's independent check reads the right scoping.
7. **T0's commit sits on `main`, not on the feature branch (disclosed by T0, hygiene note).** `git branch -vv` → `main 5af8715 [origin/main: ahead 1]`; the feature branch `feat/online-realtime-workflow` was cut from `5af8715` and carries T1…T4. So `main` currently holds exactly the T0 permission-bootstrap commit (never pushed; the branch is 1 ahead of `origin/main`). This is a branch-placement note, not an AC-24 breach (AC-24 is about *which* commit changes permissions, and T0 is the sanctioned one). T6 did not move, reset, or rewrite anything — per the brief, no branch switch and no history rewrite.

---

## 11. Staging discipline

Only this log was written and staged, by explicit path; no target file was staged or modified:

```
$ git status --short            # before committing
 M docs/features/project-glossary/status.md      # pre-existing, out of scope, NOT staged
?? docs/features/online-realtime-workflow/{plan,spec,status,tasks}.md   # NOT staged
?? docs/features/online-realtime-workflow/reviews/                      # NOT staged
?? docs/features/project-glossary/**                                    # NOT staged
?? docs/features/online-realtime-workflow/build-log-T6.md               # T6 deliverable

$ git add docs/features/online-realtime-workflow/build-log-T6.md        # explicit path only
$ git diff --cached --name-only
docs/features/online-realtime-workflow/build-log-T6.md

$ git commit -m "docs: record T6 verification pass for online-realtime-workflow (T6)" -- docs/features/online-realtime-workflow/build-log-T6.md
```

No `git add .`, no `git add -A`, no path outside the task's `files_owned`, no `--amend`, no rebase/reset, no branch switch, no push. Commit hash and post-commit file list are reported in the Subagent Report (a commit cannot embed its own hash — T0/T1/T2/T3/T4/T5 precedent).

---

## Tests

None — no automated commands exist (`AGENTS.md` § Commands: TBD; stack NOT DECIDED; spec § Testing strategy). T6 is a verification pass: inspection + `grep`/`git diff`/`git show`/`git log`/`sha256sum`/`diff`/`awk`/`sed`/`wc` + `python3` read-only aids, exactly as the task's `verify` field specifies. No application code, dependency, or tooling was introduced.

## Deviations from spec

None in content or scope. T6 changed no target file (read-only pass); the only artifact written is this log. Seven observations are recorded in §10, including the two the brief asked me to record (T3 inventory-vs-contract, T4 §5 parent correction) — none of them voids an AC and none was fixed by T6.
