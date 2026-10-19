# Build log — T1 — Retune the four agent `model:` lines

Task: T1 (2026-10-19)
Files changed: `.opencode/agents/orchestrator.md`, `.opencode/agents/planner.md`, `.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `docs/features/agent-model-tuning/build-log-T1.md`

## What changed & why (≤5 lines)

- Replaced the single `model:` frontmatter line (line 4, index 3) in each of the four pipeline agent files with the target pinned byte-for-byte in `tasks.md` § Change set / `spec.md` § Model mapping (normative).
- orchestrator → `opencode-go/deepseek-v4.1-flash#low`; planner → `opencode-go/deepseek-v4-pro#max`; builder → `opencode-go/deepseek-v4.1-flash#high`; reviewer → `opencode-go/qwen3.7-plus#max`.
- Nothing else in any file was touched: no `permissions:`, no prose, no `steps`/`color`/`description`/`mode`, no line-ending change (AC-5).
- Applied with an anchored, idempotent `python3` heredoc: the exact old line must occur exactly once and the new line must be absent, otherwise the script exits non-zero without writing; a second run is a clean no-op.

## Decisions

- Anchor on exact line text (never on line numbers); operate on `str.split("\n")` with `newline=""` on read/write so no byte of the file other than the replaced line is altered and LF endings are preserved verbatim.
- Idempotency semantics: `old==1 and new==0` → edit; `old==0 and new==1` → `NO-OP` (already applied, exit 0); every other combination → hard failure naming the counts (never guess).
- `npm run coverage` intentionally NOT run — reviewer-approved N/A per `spec.md` § Testing strategy (no application/test content changes); not claimed as evidence.

## Evidence

### 0. Pre-feature baseline commit ref and per-file baselines (before any edit)

Command:

```
git rev-parse HEAD
for f in orchestrator planner builder reviewer; do git show HEAD:.opencode/agents/$f.md | sed -n '4p'; done
```

Output:

```
=== pre-feature baseline commit ===
02228acbefac7eafe03ca4ef31e0ed7f743fbc9e

=== baselines (line 4) ===
orchestrator: model: opencode/deepseek-v4.1-flash-free#high
planner: model: opencode/deepseek-v4.1-flash-free#max
builder: model: opencode/deepseek-v4.1-flash-free#high
reviewer: model: opencode/glm-5.3-flash-free#max
```

**Pre-feature baseline commit (AC-6 / T2 anchor): `02228acbefac7eafe03ca4ef31e0ed7f743fbc9e`**

All four baselines match the expected old lines in `tasks.md` § Change set (T1.1–T1.4). Environment pre-check: all four files are UTF-8, LF-only (0 CR bytes), `python3` + PyYAML 6.0.3 available.

### 1. Apply — anchored idempotent `python3` heredoc

Command (the heredoc from the task; per-file: `old` must occur exactly once, `new` must be absent):

```python
python3 - <<'PY'
CHANGES = [
    (".opencode/agents/orchestrator.md", "model: opencode/deepseek-v4.1-flash-free#high", "model: opencode-go/deepseek-v4.1-flash#low"),
    (".opencode/agents/planner.md",      "model: opencode/deepseek-v4.1-flash-free#max",  "model: opencode-go/deepseek-v4-pro#max"),
    (".opencode/agents/builder.md",      "model: opencode/deepseek-v4.1-flash-free#high", "model: opencode-go/deepseek-v4.1-flash#high"),
    (".opencode/agents/reviewer.md",     "model: opencode/glm-5.3-flash-free#max",       "model: opencode-go/qwen3.7-plus#max"),
]
# old==1 and new==0 -> edit ; old==0 and new==1 -> NO-OP ; else exit 1 (never guess)
PY
```

Output (exit 0):

```
EDITED   .opencode/agents/orchestrator.md: 1 occurrence of old line at index 3 -> replaced
EDITED   .opencode/agents/planner.md: 1 occurrence of old line at index 3 -> replaced
EDITED   .opencode/agents/builder.md: 1 occurrence of old line at index 3 -> replaced
EDITED   .opencode/agents/reviewer.md: 1 occurrence of old line at index 3 -> replaced
ALL OK
```

### 2. Idempotency re-run (expect clean no-op, exit 0)

Output:

```
NO-OP    .opencode/agents/orchestrator.md: target present exactly once at index 3; nothing written
NO-OP    .opencode/agents/planner.md: target present exactly once at index 3; nothing written
NO-OP    .opencode/agents/builder.md: target present exactly once at index 3; nothing written
NO-OP    .opencode/agents/reviewer.md: target present exactly once at index 3; nothing written
ALL OK
exit=0
```

### 3. AC-1…AC-4 — exact-line presence (`grep -Fx`) and uniqueness (`grep -c "^model:"`)

Output:

```
orchestrator -> rc=0 : model: opencode-go/deepseek-v4.1-flash#low
planner -> rc=0 : model: opencode-go/deepseek-v4-pro#max
builder -> rc=0 : model: opencode-go/deepseek-v4.1-flash#high
reviewer -> rc=0 : model: opencode-go/qwen3.7-plus#max

=== uniqueness: grep -c '^model:' (expect 1 each) ===
orchestrator = 1
planner = 1
builder = 1
reviewer = 1
```

### 4. Frontmatter parse + `model` value equality (`python3` + `yaml.safe_load`)

Snippet pattern from `docs/features/online-realtime-workflow/build-log-T0.md` § 4. Output (exit 0):

```
OK  .opencode/agents/orchestrator.md: data['model']='opencode-go/deepseek-v4.1-flash#low' expected='opencode-go/deepseek-v4.1-flash#low' (frontmatter keys=6 includes permissions=True)
OK  .opencode/agents/planner.md: data['model']='opencode-go/deepseek-v4-pro#max' expected='opencode-go/deepseek-v4-pro#max' (frontmatter keys=6 includes permissions=True)
OK  .opencode/agents/builder.md: data['model']='opencode-go/deepseek-v4.1-flash#high' expected='opencode-go/deepseek-v4.1-flash#high' (frontmatter keys=6 includes permissions=True)
OK  .opencode/agents/reviewer.md: data['model']='opencode-go/qwen3.7-plus#max' expected='opencode-go/qwen3.7-plus#max' (frontmatter keys=6 includes permissions=True)
PARSE ALL OK
exit=0
```

### 5. AC-5 — diff scope (`git diff --stat -- .opencode/agents/`)

Output:

```
 .opencode/agents/builder.md      | 2 +-
 .opencode/agents/orchestrator.md | 2 +-
 .opencode/agents/planner.md      | 2 +-
 .opencode/agents/reviewer.md     | 2 +-
 4 files changed, 4 insertions(+), 4 deletions(-)
```

Exactly `4 files changed, 4 insertions(+), 4 deletions(-)` — matches AC-5.

Full raw diff (`git diff -- .opencode/agents/`) — only the four `-`/`+` `model:` line pairs:

```
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index 50a42d4..69bbb40 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -1,7 +1,7 @@
 ---
 description: Web implementation specialist. Implements one tasks.md task (or a small parallel-safe batch) with tests, verification evidence, and a commit, then reports. Use after a spec is approved.
 mode: subagent
-model: opencode/deepseek-v4.1-flash-free#high
+model: opencode-go/deepseek-v4.1-flash#high
 color: "#22c55e"
 steps: 80
 permissions:
diff --git a/.opencode/agents/orchestrator.md b/.opencode/agents/orchestrator.md
index 746f39f..b208cf7 100644
--- a/.opencode/agents/orchestrator.md
+++ b/.opencode/agents/orchestrator.md
@@ -1,7 +1,7 @@
 ---
 description: CubeClicker workflow orchestrator. The only user-facing agent; delegates every phase to the planner, builder, and reviewer subagents and owns feature state. Never implements or reviews.
 mode: primary
-model: opencode/deepseek-v4.1-flash-free#high
+model: opencode-go/deepseek-v4.1-flash#low
 color: "#8b5cf6"
 steps: 60
 permissions:
diff --git a/.opencode/agents/planner.md b/.opencode/agents/planner.md
index 5aef59c..2e455f2 100644
--- a/.opencode/agents/planner.md
+++ b/.opencode/agents/planner.md
@@ -1,7 +1,7 @@
 ---
 description: Feature spec author. Turns a raw CubeClicker feature request into spec.md, plan.md, and a dependency-ordered tasks.md, and revises them in response to spec reviews.
 mode: subagent
-model: opencode/deepseek-v4.1-flash-free#max
+model: opencode-go/deepseek-v4-pro#max
 color: "#3b82f6"
 steps: 50
 permissions:
diff --git a/.opencode/agents/reviewer.md b/.opencode/agents/reviewer.md
index 0bc2d3d..cdbe171 100644
--- a/.opencode/agents/reviewer.md
+++ b/.opencode/agents/reviewer.md
@@ -1,7 +1,7 @@
 ---
 description: Independent quality gate. Reviews specs before building and implementations against the spec after building; produces severity-ranked findings and a verdict. Never fixes code.
 mode: subagent
-model: opencode/glm-5.3-flash-free#max
+model: opencode-go/qwen3.7-plus#max
 color: "#ef4444"
 steps: 50
 permissions:
```

### 6. AC-5 strong check — all other bytes byte-identical

Per file, hash of the file with the `model:` line removed, baseline vs. current:

```
orchestrator: IDENTICAL (all bytes except model: line) sha=2e18120ba5f6e407a9b1a3e4d897ef11413430759795416a47453430e69f2ed6
planner:      IDENTICAL (all bytes except model: line) sha=2ec938438a6c351b29c271c6737d9cb0643d6d5b232f3aad079c37ff5787f869
builder:      IDENTICAL (all bytes except model: line) sha=bab6cc5c40635dbfad4958ff539e05d26d093886f4736c89c3cdd1fe30106d40
reviewer:     IDENTICAL (all bytes except model: line) sha=1949dfc1728f410a333ac53a5ef731ccab8d4a087ee6215434c0480153bde5a7
```

Also: `git diff -- .opencode/agents/ | grep -E "^[+-].*(permissions:|^\s*-\s*action:|steps:|color:|description:|mode:)"` → `no matches -> none touched`; and each file still has 0 CR bytes (no line-ending change).

### 7. AC-6 / completeness — `grep -rn "^\s*model\s*[:=]" .opencode/ opencode.jsonc`

Output:

```
.opencode/agents/builder.md:4:model: opencode-go/deepseek-v4.1-flash#high
.opencode/agents/planner.md:4:model: opencode-go/deepseek-v4-pro#max
.opencode/agents/orchestrator.md:4:model: opencode-go/deepseek-v4.1-flash#low
.opencode/agents/reviewer.md:4:model: opencode-go/qwen3.7-plus#max
rc=0
```

Only the four agent lines. `opencode.jsonc` contains no `model` key, and `git diff 02228acbefac7eafe03ca4ef31e0ed7f743fbc9e -- opencode.jsonc | wc -l` → `0` (byte-identical to the pre-feature ref).

### 8. AC-7 — catalog cross-check (live re-query, enrichment)

Live `models` tool query for provider `opencode-go` (2026-10-19) returned the four chosen models with variants identical to `spec.md` § Catalog basis — no drift:

| Target | Live variants | Required variant | Match |
| --- | --- | --- | --- |
| `opencode-go/deepseek-v4.1-flash` | low, high, max | orchestrator `low`; builder `high` | ✅ |
| `opencode-go/deepseek-v4-pro` | high, max | planner `max` | ✅ |
| `opencode-go/qwen3.7-plus` | none, high, max | reviewer `max` | ✅ |

All four targets are `status: active`. Targets also match `tasks.md` § Change set byte-for-byte. AC-8: no chosen model is in the exclusion list; highest chosen price 0.66/1.98 (planner).

### 9. Commit

Command (explicit paths only; never `git add .` / `git add -A`):

```
git add .opencode/agents/orchestrator.md .opencode/agents/planner.md .opencode/agents/builder.md .opencode/agents/reviewer.md docs/features/agent-model-tuning/build-log-T1.md
git commit -m "chore: retune agent models to OpenCode Go (T1)"
```

Staged file list (exactly the five `files_owned` paths — before commit):

```
.opencode/agents/builder.md
.opencode/agents/orchestrator.md
.opencode/agents/planner.md
.opencode/agents/reviewer.md
docs/features/agent-model-tuning/build-log-T1.md
```

Commit evidence — sha-free `--format=%s` (house precedent: `docs/features/online-realtime-workflow/build-log-T0.md` § 6 uses `--format=%s` "to avoid the self-referential hash", since the build log is itself part of the commit and its own insertion count grows when this section is amended in):

```
$ git show --name-only --format=%s HEAD
chore: retune agent models to OpenCode Go (T1)

.opencode/agents/builder.md
.opencode/agents/orchestrator.md
.opencode/agents/planner.md
.opencode/agents/reviewer.md
docs/features/agent-model-tuning/build-log-T1.md
```

T1 commit diff scope for the agent files (stable across amends — matches AC-5):

```
$ git show --stat --format=%s HEAD -- .opencode/agents/
chore: retune agent models to OpenCode Go (T1)

 .opencode/agents/builder.md      | 2 +-
 .opencode/agents/orchestrator.md | 2 +-
 .opencode/agents/planner.md      | 2 +-
 .opencode/agents/reviewer.md     | 2 +-
 4 files changed, 4 insertions(+), 4 deletions(-)
```

Committed blob == working-tree file (content-addressed, stable across amends):

```
$ git rev-parse HEAD:.opencode/agents/orchestrator.md   -> b208cf7da9ee58fd0ccea0091049a9918880dbf0
$ git hash-object            .opencode/agents/orchestrator.md -> b208cf7da9ee58fd0ccea0091049a9918880dbf0   IDENTICAL
$ git rev-parse HEAD:.opencode/agents/planner.md        -> 2e455f222ee8796767fca11c650bad31b81ab710
$ git hash-object            .opencode/agents/planner.md      -> 2e455f222ee8796767fca11c650bad31b81ab710   IDENTICAL
$ git rev-parse HEAD:.opencode/agents/builder.md        -> 69bbb4030c977913da7292d3a692e9bc2cbb07b0
$ git hash-object            .opencode/agents/builder.md      -> 69bbb4030c977913da7292d3a692e9bc2cbb07b0   IDENTICAL
$ git rev-parse HEAD:.opencode/agents/reviewer.md       -> cdbe1710905519b6894a630a80f4c9ecf01a5b62
$ git hash-object            .opencode/agents/reviewer.md     -> cdbe1710905519b6894a630a80f4c9ecf01a5b62   IDENTICAL
$ git rev-parse HEAD:docs/features/agent-model-tuning/build-log-T1.md -> 8771fab3148640eb801083401833378fd8882740
$ git hash-object            docs/features/agent-model-tuning/build-log-T1.md -> 8771fab3148640eb801083401833378fd8882740   IDENTICAL
```

The T1 commit is identified by its pinned subject `chore: retune agent models to OpenCode Go (T1)` (the first commit with that subject on the branch), discoverable via `git log --oneline --grep "OpenCode Go (T1)"`. The pre-feature baseline commit for AC-6 / T2 anchoring is `02228acbefac7eafe03ca4ef31e0ed7f743fbc9e`.

**Files touched by the T1 commit: exactly the four agent files + this build log** (nothing else staged; `spec.md`/`plan.md`/`tasks.md`/`status.md`/`reviews/` remain untracked/owned by other roles).

## Acceptance audit

- **AC-1** → met. orchestrator: one `^model:` line, full content = target (grep -Fx rc=0, uniqueness=1, grep count), YAML `model` = `opencode-go/deepseek-v4.1-flash#low`.
- **AC-2** → met. planner: unique `^model:` line, full content = `model: opencode-go/deepseek-v4-pro#max`; YAML `model` equality confirmed.
- **AC-3** → met. builder: unique `^model:` line, full content = `model: opencode-go/deepseek-v4.1-flash#high`; YAML `model` equality confirmed.
- **AC-4** → met. reviewer: unique `^model:` line, full content = `model: opencode-go/qwen3.7-plus#max`; YAML `model` equality confirmed.
- **AC-5** → met. `git diff --stat` = `4 files changed, 4 insertions(+), 4 deletions(-)`; full diff only the four `model:` line pairs; stripped-model-line hashes identical; no CR; no `permissions:`/`steps`/`color`/`description`/`mode` touched.
- **AC-7** → met. Targets byte-for-byte equal to the normative table; well-formed `opencode-go/<id>#<variant>`; each variant valid per live catalog (enrichment) and per spec § Catalog basis.

(AC-6/AC-8/AC-9 are primarily enforced at T2; AC-6 and AC-8 spot-checks above are consistent — only the four agent files define models, `opencode.jsonc` unchanged, no excluded model chosen.)

## Deviations from spec

none.

## Coverage

`npm run coverage` not run — N/A by design (`spec.md` § Testing strategy, reviewer-approved). Not claimed as evidence.
