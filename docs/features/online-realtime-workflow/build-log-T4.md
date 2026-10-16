# Build log — T4 — Builder guidance

Task: T4 (2026-10-17) — `[P]`, depends_on T0, T1.
Files changed: `.opencode/agents/builder.md` (edited), `.opencode/skills/web-implementation/SKILL.md` (edited), `.opencode/skills/web-implementation/references/engineering-principles.md` (edited) — plus this log (the fourth `files_owned` path).
What changed & why: applied plan.md § Pinned content contracts item 8 (T4 stage), item 9 and item 10 exactly — (8) one new bullet in `builder.md` **Rules** requiring server-authoritative shared state, no trust in client-reported values, ownership of the connection lifecycle (connect/reconnect/teardown, no duplicate handlers), and pointing at the `web-implementation` skill's real-time rules (token "real-time"); (9) one new bullet in the SKILL's **Architecture rules** — summary shape with a depth pointer to `references/engineering-principles.md` § Real-time principles — covering single connection-lifecycle owner, bounded reconnection with state resync, server-authoritative shared state, and teardown; (10) a new section `## Real-time (WebSocket) principles` in the depth reference with six bullets (single connection owner; lifecycle & reconnection; server authority; untrusted inbound data; graceful degradation; testability). Purely additive: 11 added lines, 0 deletions across the three files; no permission entry touched (AC-24); no library/framework/runtime/vendor named (only the WebSocket protocol).

Decisions:
- **`builder.md` baseline = post-T0 content** (the contract's two-phase rule): captured at T4 build start from `HEAD` (`b3aeff1`, T2) where the working tree was byte-identical, so the T4 diff shows only the prose rule and no permission entry (§1.1, §4).
- Bullet placement is not pinned by the contract; each bullet was placed where it reads as the natural neighbour of the existing rules and yields a single-hunk insertion: `builder.md` immediately after the skill-loading rule (the new bullet references that skill); SKILL.md immediately after the `requestAnimationFrame`/interval-ownership rule (same resource-lifecycle theme); the new section appended at the end of the depth reference (clean append, no interleaving of existing sections).
- Wording follows each file's existing conventions: single-line `- ` bullet in `builder.md`; single-line summary bullet in the SKILL (existing Architecture-rules bullets are single-line summaries; the section header already carries the "depth in `references/engineering-principles.md`" pattern, and the new bullet adds an explicit § pointer as the contract requires); `- **Lead-in.**` bullets in the depth reference, matching the `## Game-specific rules` style (≤6 bullets, per plan § Risks "skill sections ≤ 6 bullets").
- No reflow of any pre-existing line: the diffs are pure insertions (1/1/9 lines, 0 deletions; one hunk per file, §3, §6 V7).
- Commit identity is not embedded here (a commit cannot contain its own hash or output produced after it — same precedent as `build-log-T0.md` §7 / `build-log-T1.md` §4 / `build-log-T2.md` §4). Parent, subject, file list, and content-addressed blob hashes are recorded in §5; the commit hash is reported in the Subagent Report and retrievable as `git rev-parse HEAD`. Post-commit `git show HEAD -- <paths>` was run and its body is byte-identical to the staged body recorded in §5 (same blob hashes ⇒ same `index a..b` header and hunks); the raw post-commit output is reported out-of-band for the same self-reference reason.

Commit staging: only this task's four `files_owned` paths were staged (explicit `git add`), and the commit was created **pathspec-limited** (`git commit -m … -- <four paths>`) because two sibling builders share this repository's index in the same `[P]` batch (T3's three files were already staged by T3 when T4 reached its commit step; T5's files were modified but unstaged). A pathspec-limited commit cannot sweep another builder's staged work into this commit. No `git add .` / `git add -A`; no push. Immediately before committing, T4's three content files were deliberately left **unstaged** (they had been staged only momentarily, for evidence capture, then restored with `git restore --staged` on exactly those paths) to minimise the window in which a sibling's index-wide commit could capture them.

---

## 0. PRE-OP — branch (no switch)

```
$ git rev-parse --abbrev-ref HEAD
feat/online-realtime-workflow
$ git log --oneline -4
b3aeff1 docs: add provisional real-time backlog and vision direction link (T2)
d41c465 docs: state online real-time nature and WebSocket constraint (T1)
5af8715 chore: widen builder edit permissions for online-realtime-workflow (T0)
927fd78 Initial commit
```

Branch state at T4 build start: `feat/online-realtime-workflow` at `b3aeff1` (T2), with T0 `5af8715` and T1 `d41c465` below it. **No** checkout/branch switch, **no** rebase/reset/amend/history rewrite, **no** push.

---

## 1. Baseline capture (build start)

Capture commands (three files; `HEAD` == build-start working tree for all three):

```
$ mkdir -p /tmp/opencode/t4
$ git show HEAD:.opencode/agents/builder.md > /tmp/opencode/t4/baseline-builder.md
$ git show HEAD:.opencode/skills/web-implementation/SKILL.md > /tmp/opencode/t4/baseline-skill.md
$ git show HEAD:.opencode/skills/web-implementation/references/engineering-principles.md > /tmp/opencode/t4/baseline-ep.md
$ cp .opencode/agents/builder.md /tmp/opencode/t4/buildstart-builder.md
$ cp .opencode/skills/web-implementation/SKILL.md /tmp/opencode/t4/buildstart-skill.md
$ cp .opencode/skills/web-implementation/references/engineering-principles.md /tmp/opencode/t4/buildstart-ep.md
$ sha256sum /tmp/opencode/t4/baseline-*.md /tmp/opencode/t4/buildstart-*.md
7eb8a152d4086cf3bdb42a7c26493f789ca32a690d4e0cb973f02413f9f9bcf4  /tmp/opencode/t4/baseline-builder.md
7eb8a152d4086cf3bdb42a7c26493f789ca32a690d4e0cb973f02413f9f9bcf4  /tmp/opencode/t4/buildstart-builder.md
d3094c45faae2bbc070f56d6ed061d1174f0e30e96b0bcad9d5560f8844cdc0f  /tmp/opencode/t4/baseline-skill.md
d3094c45faae2bbc070f56d6ed061d1174f0e30e96b0bcad9d5560f8844cdc0f  /tmp/opencode/t4/buildstart-skill.md
ef60983a924c4b572e67b1d7341cd02c79018f3287fbb20fa85b3acf3d540392  /tmp/opencode/t4/baseline-ep.md
ef60983a924c4b572e67b1d7341cd02c79018f3287fbb20fa85b3acf3d540392  /tmp/opencode/t4/buildstart-ep.md
$ wc -lc /tmp/opencode/t4/baseline-builder.md /tmp/opencode/t4/baseline-skill.md /tmp/opencode/t4/baseline-ep.md
 101 3085 /tmp/opencode/t4/baseline-builder.md
  57 3353 /tmp/opencode/t4/baseline-skill.md
  43 3344 /tmp/opencode/t4/baseline-ep.md
 201 9782 total
$ for f in <the three paths>; do diff -q <(git show HEAD:$f) $f; done
IDENTICAL: .opencode/agents/builder.md
IDENTICAL: .opencode/skills/web-implementation/SKILL.md
IDENTICAL: .opencode/skills/web-implementation/references/engineering-principles.md
$ git rev-parse HEAD:.opencode/agents/builder.md HEAD:.opencode/skills/web-implementation/SKILL.md HEAD:.opencode/skills/web-implementation/references/engineering-principles.md
793b678274f585af94d461fbdaec6a15659fd091
6e8cbb80dbe29a750a3c6b8db130008d9f5fd1aa
46e21bef27418deab5a15b546351996c0d1c3d9a
```

`HEAD` == build-start working tree for all three files (identical sha256 pairs above), so the `git show HEAD:<path>` capture **is** the build-start baseline (plan § Baseline rule, D-10).

### 1.1 Baseline 1 — `.opencode/agents/builder.md` (post-T0; verbatim, 101 lines / 3085 bytes)

sha256 `7eb8a152d4086cf3bdb42a7c26493f789ca32a690d4e0cb973f02413f9f9bcf4`; blob `793b678274f585af94d461fbdaec6a15659fd091`; recoverable as `git show HEAD:<path>` at T4's parent (`b3aeff1`).

```markdown
---
description: Web implementation specialist. Implements one tasks.md task (or a small parallel-safe batch) with tests, verification evidence, and a commit, then reports. Use after a spec is approved.
mode: subagent
model: opencode/deepseek-v4.1-flash-free#high
color: "#22c55e"
steps: 80
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: edit
    resource: "src/**"
    effect: allow
  - action: edit
    resource: "tests/**"
    effect: allow
  - action: edit
    resource: "public/**"
    effect: allow
  - action: edit
    resource: "docs/features/**/build-log*.md"
    effect: allow
  - action: edit
    resource: "package.json"
    effect: allow
  - action: edit
    resource: "tsconfig.json"
    effect: allow
  - action: edit
    resource: "*.config.*"
    effect: allow
  - action: edit
    resource: "index.html"
    effect: allow
  - action: edit
    resource: "AGENTS.md"
    effect: allow
  - action: edit
    resource: "docs/architecture/**"
    effect: allow
  - action: edit
    resource: "docs/product/**"
    effect: allow
  - action: edit
    resource: ".opencode/agents/*.md"
    effect: allow
  - action: edit
    resource: ".opencode/skills/**"
    effect: allow
  - action: edit
    resource: ".env*"
    effect: deny
  - action: shell
    resource: "*"
    effect: allow
  - action: shell
    resource: "git push *"
    effect: deny
  - action: shell
    resource: "sudo *"
    effect: deny
  - action: shell
    resource: "rm -rf *"
    effect: deny
  - action: shell
    resource: "curl *"
    effect: deny
  - action: shell
    resource: "wget *"
    effect: deny
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
    resource: "web-implementation"
    effect: allow
---

# Builder

You are the CubeClicker builder — a subagent and web technologies specialist. You NEVER address the user. You implement exactly the task(s) in the brief, with tests and evidence.

## Rules

- Load the `web-implementation` skill before acting; its rules and Definition of Done are binding.
- The stack is whatever `AGENTS.md` and `docs/architecture/stack.md` say. If the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.
- Read before you write: spec, plan, your task section, and the files you will touch.
- Stay inside your task's `files_owned`. Out-of-scope edits are a reportable failure.
- Verify: run the task's `verify` commands and record raw evidence in `build-log-<taskid>.md`. Never claim success without command output.
- Commit per task with a conventional message (`feat:` / `fix:` / `test:` / `chore:`). NEVER push. NEVER touch `.env*`.
- If something in the spec is ambiguous or contradictory: report `blocked` with the exact question and candidate answers. Do not improvise scope.

## Report

Subagent Report: status (`completed` | `blocked` | `failed`), artifacts, evidence (commands and results), open questions, next recommendation.
```

This baseline **is** the post-T0 content (T0's five permission entries are present at lines 35–49; no other phase has touched the file since `b3aeff1`), satisfying contract item 8's "T4's baseline = `builder.md` at T4 build start (post-T0)".

**Permission-region fingerprint** (used in §4 for the AC-24 proof) — frontmatter from `permissions:` through the closing `---` fence (`sed -n '/^permissions:/,/^---$/p'`), 77 lines / 1569 bytes:

```
sha256 = a683feed4cb59700efbb9c25c0de8634829b658571b69f13c797304f5a387f5b
lines 7–83 of the baseline file: same region + nothing else; sha256 = a683feed4cb59700efbb9c25c0de8634829b658571b69f13c797304f5a387f5b (77 lines / 1569 bytes)
```

### 1.2 Baseline 2 — `.opencode/skills/web-implementation/SKILL.md` (verbatim, 57 lines / 3353 bytes)

sha256 `d3094c45faae2bbc070f56d6ed061d1174f0e30e96b0bcad9d5560f8844cdc0f`; blob `6e8cbb80dbe29a750a3c6b8db130008d9f5fd1aa`.

(` ```` ` = a four-backtick provenance fence, used because the quoted file itself contains ``` fences; the quoted content between the fences is verbatim.)

````markdown
---
name: Web Implementation
description: Use when implementing a CubeClicker task as the builder — coding standards, architecture rules, definition of done, verification, and evidence requirements.
---

# Web Implementation

You implement exactly one task (or a small parallel-safe batch) per invocation, in the project's agreed stack. `AGENTS.md` and `docs/architecture/stack.md` are the law; if the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.

## Workflow

1. Read the brief fully; then read `spec.md`, `plan.md`, `tasks.md` and your task section; then `docs/architecture/stack.md` and `AGENTS.md`; then the files you will touch, before changing them.
2. Sketch the change in at most 5 lines inside `build-log-<taskid>.md`, then implement.
3. Implement in small steps: pure logic first, then integration/UI. Keep diffs focused on the task's `files_owned`.
4. Write or adjust tests as you go — every behavior change gets a test, or an explicit reason why not (e.g., purely visual).
5. Run the task's `verify` commands. Fix failures before reporting.
6. Self-audit: walk each `acceptance` AC and record met/unmet with evidence.
7. Finish `build-log-<taskid>.md`, then commit with a conventional message (`feat:` / `fix:` / `test:` / `chore:`). NEVER `git push`.
8. Return the Subagent Report.

## Architecture rules (apply pragmatically — depth in `references/engineering-principles.md`)

- Game logic is pure and framework-free: functions over explicit state in `src/core/` (or the stack's equivalent). No DOM or timers inside pure logic — time and randomness come in as parameters.
- Rendering/UI subscribes to state; it does not own it. Single source of truth for game state.
- One place owns `requestAnimationFrame`/interval usage; clean up on teardown. No leaks.
- Persistence: versioned save schema plus a migration function; validate on load; a corrupt save must never crash the game.
- DRY without premature abstraction: extract on the third repetition, not the first. KISS: prefer the boring solution. YAGNI: build what the task asks, nothing speculative.
- `textContent`, never `innerHTML`, for user-controlled strings. No `eval`, no remote code.
- Accessibility baseline: keyboard operable, visible focus, semantic elements, text contrast ≥ 4.5:1.
- Performance: interactions target 60 fps; justify bundle additions; no per-frame allocations in hot loops.

## Definition of Done

- [ ] Task's acceptance criteria met with evidence
- [ ] `verify` commands pass (lint, typecheck, tests, build — as applicable)
- [ ] Tests added/updated for behavior changes
- [ ] `build-log-<taskid>.md` written with raw evidence
- [ ] Committed on the feature branch with a conventional message
- [ ] No out-of-scope edits (`files_owned` respected)

## When blocked

Do NOT improvise scope, architecture, or dependencies. Report `blocked` with: the exact question, why the spec/plan is insufficient, and 1–2 candidate answers you could proceed with if approved.

## build-log template

```
# Build log — T<id> — <title>
Task: T<id> (<date>)
Files changed: <paths>
What changed & why: <≤5 lines>
Decisions: <notable choices>
Evidence:
- `<verify cmd>` → <result summary>
Acceptance audit: AC-x → met (evidence) | unmet (why)
Deviations from spec: none | <what + why>
```
````

(The final fenced block above is a ` ```` ` fence in the source — the baseline is the file content as captured, 57 lines / 3353 bytes, sha256 `d3094c45…`.)

### 1.3 Baseline 3 — `.opencode/skills/web-implementation/references/engineering-principles.md` (verbatim, 43 lines / 3344 bytes)

sha256 `ef60983a924c4b572e67b1d7341cd02c79018f3287fbb20fa85b3acf3d540392`; blob `46e21bef27418deab5a15b546351996c0d1c3d9a`.

```markdown
# Engineering principles for CubeClicker

Pragmatic application of SOLID, DRY, KISS, and YAGNI to a browser clicker game. These are guidelines with judgment, not religion: the tests, the task's acceptance criteria, and the existing codebase patterns win ties.

## SOLID, applied

- **S — Single responsibility.** A module does one thing: `game-loop` advances time, `economy` computes costs/income, `save` serializes state, `view` renders. If a file needs "and" to describe it, split it.
- **O — Open/closed.** Upgrades/buildings are data, not branches: a registry of definitions that the economy iterates, so adding content doesn't edit the system.
- **L — Liskov.** Prefer plain data + functions over inheritance trees. If you do subclass, honor the base contract; don't bolt game-specific flags onto shared interfaces.
- **I — Interface segregation.** Small focused types (`{ cost, multiplier }`) beat one god-`GameConfig` interface passed everywhere.
- **D — Dependency inversion.** Pure logic takes its dependencies (clock, randomness, storage) as parameters or injected adapters. Tests then run without a browser.

## DRY — with a third-strike rule

Extract on the third repetition, not the first. Two similar lines are cheaper than a wrong abstraction. When you do deduplicate, deduplicate the *concept* (e.g., "cost scaling formula"), not the incidental shape.

## KISS & YAGNI

- Prefer the boring solution: `Array.reduce` over a custom state machine; a plain object over a library for 30 lines of logic.
- Build only what the task's acceptance criteria require. No speculative config, no plugin systems for one use case, no premature optimization.
- If a dependency is proposed, justify it against: bundle size, maintenance, security surface. Adding dependencies is ⚠️ Ask first anyway.

## Game-specific rules

- **Determinism:** the core simulation must be a function of (state, elapsed time, inputs). Same inputs → same outputs. This makes offline progress, tests, and future anti-cheat possible.
- **Time discipline:** read the clock in ONE place (the loop); pass `deltaMs`/`now` down. Never scatter `Date.now()` through logic.
- **Number safety:** clicker economies grow fast. Decide per task whether `number` suffices or `bigint`/decimal math is required; document rounding rules.
- **Save integrity:** saves are versioned (`{ v: N, ... }`); a migration chain upgrades old versions; malformed saves fall back to a fresh state with a visible, non-crashing notice.
- **One writer per storage key** — no two modules writing the same localStorage key.

## Accessibility & UX floor

- Keyboard: everything clickable is focusable and activatable without a mouse.
- Use semantic elements (`button`, not `div` with a click handler).
- Respect `prefers-reduced-motion` for decorative animation.
- Numbers should stay readable: format with separators; avoid layout shift as digits grow (fixed-width tabular numerals).

## Performance budget (per feature)

- Interaction latency: input → visible feedback in the same frame at 60 fps.
- Main-thread tasks over ~16 ms are splitting candidates (chunk heavy work; don't run it per frame).
- Memory: no unbounded arrays/growth per tick; pools or reuse for hot-loop objects.
- Bundle: state any new dependency's cost in the build log; keep the game shell loading instantly.
```

---

## 2. Changes applied

Three insertions, no deletions, no reflow (post-edit sizes: `builder.md` 102 lines / 3327 bytes; `SKILL.md` 58 / 3720; `engineering-principles.md` 52 / 4506):

1. **`.opencode/agents/builder.md`** — new line 92, the second bullet of **Rules** (immediately after the skill-loading rule):
   `- Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.`
2. **`.opencode/skills/web-implementation/SKILL.md`** — new line 26, in **Architecture rules** (immediately after the `requestAnimationFrame`/interval-ownership rule):
   `- Real-time (WebSocket): one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (the client never trusts reported values); teardown closes connections and removes handlers. Depth in `references/engineering-principles.md` § Real-time principles.`
3. **`.opencode/skills/web-implementation/references/engineering-principles.md`** — new section appended after `## Performance budget (per feature)`: blank line, `## Real-time (WebSocket) principles`, blank line, six `- **Lead-in.** …` bullets (single connection owner; lifecycle & reconnection; server authority; untrusted inbound data; graceful degradation; testability). Full text verbatim in §3.3.

Pre-commit content addresses (working tree == index for the three files at staging time; §5 re-confirms against the committed blobs):

```
$ git hash-object <file>  ==  git rev-parse :<file>
.opencode/agents/builder.md                                        29921e35bf1a156991503045cc414b5b27ce0c66
.opencode/skills/web-implementation/SKILL.md                       20b0415cfb119dc2dcc0d99820899927ccf3875b
.opencode/skills/web-implementation/references/engineering-principles.md  ac284055968cbfd401c4b1ba8b422ef3c2572449
```

Post-edit sha256: `c67c646a4b75caa2db32c1da040c6644131f034415541fd2d76bfcb0311a8050` (builder.md), `3e6b8e6e4bb00e65b7c451c580d02a06eb022ff53cae3ecdc88e243e2a289145` (SKILL.md), `d886b0ca963b92f181acc4414cac51559f8eee9349ac688b416870277dfed607` (engineering-principles.md).

---

## 3. Diffs vs. the build-start baselines (working tree)

tasks.md T4 `verify`: `git diff HEAD -- <files_owned>` vs. the T4 build-start baselines (§1). Raw output:

### 3.1 `.opencode/agents/builder.md`

```diff
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index 793b678..29921e3 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -89,6 +89,7 @@ You are the CubeClicker builder — a subagent and web technologies specialist.
 ## Rules
 
 - Load the `web-implementation` skill before acting; its rules and Definition of Done are binding.
+- Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.
 - The stack is whatever `AGENTS.md` and `docs/architecture/stack.md` say. If the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.
 - Read before you write: spec, plan, your task section, and the files you will touch.
 - Stay inside your task's `files_owned`. Out-of-scope edits are a reportable failure.
```

### 3.2 `.opencode/skills/web-implementation/SKILL.md`

```diff
diff --git a/.opencode/skills/web-implementation/SKILL.md b/.opencode/skills/web-implementation/SKILL.md
index 6e8cbb8..20b0415 100644
--- a/.opencode/skills/web-implementation/SKILL.md
+++ b/.opencode/skills/web-implementation/SKILL.md
@@ -23,6 +23,7 @@ You implement exactly one task (or a small parallel-safe batch) per invocation,
 - Game logic is pure and framework-free: functions over explicit state in `src/core/` (or the stack's equivalent). No DOM or timers inside pure logic — time and randomness come in as parameters.
 - Rendering/UI subscribes to state; it does not own it. Single source of truth for game state.
 - One place owns `requestAnimationFrame`/interval usage; clean up on teardown. No leaks.
+- Real-time (WebSocket): one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (the client never trusts reported values); teardown closes connections and removes handlers. Depth in `references/engineering-principles.md` § Real-time principles.
 - Persistence: versioned save schema plus a migration function; validate on load; a corrupt save must never crash the game.
 - DRY without premature abstraction: extract on the third repetition, not the first. KISS: prefer the boring solution. YAGNI: build what the task asks, nothing speculative.
 - `textContent`, never `innerHTML`, for user-controlled strings. No `eval`, no remote code.
```

### 3.3 `.opencode/skills/web-implementation/references/engineering-principles.md`

```diff
diff --git a/.opencode/skills/web-implementation/references/engineering-principles.md b/.opencode/skills/web-implementation/references/engineering-principles.md
index 46e21be..ac28405 100644
--- a/.opencode/skills/web-implementation/references/engineering-principles.md
+++ b/.opencode/skills/web-implementation/references/engineering-principles.md
@@ -41,3 +41,12 @@ Extract on the third repetition, not the first. Two similar lines are cheaper th
 - Main-thread tasks over ~16 ms are splitting candidates (chunk heavy work; don't run it per frame).
 - Memory: no unbounded arrays/growth per tick; pools or reuse for hot-loop objects.
 - Bundle: state any new dependency's cost in the build log; keep the game shell loading instantly.
+
+## Real-time (WebSocket) principles
+
+- **Single connection owner.** One module owns the socket and its lifecycle; the rest of the UI observes connection status and never opens its own socket.
+- **Lifecycle & reconnection.** Reconnection is bounded (retry limit/backoff) and resyncs state on success; handlers are idempotent, so reconnecting never registers duplicates or double-applies server state.
+- **Server authority.** Shared/global values (counters, presence, leaderboards) come from the server; optimistic UI must reconcile with the server's answer, and client-reported values are never treated as truth.
+- **Untrusted inbound data.** Treat every inbound message as untrusted: validate its shape and type, ignore unknown messages and fields, and render untrusted text via `textContent`, never `innerHTML`.
+- **Graceful degradation.** Connection loss is visible (a clear status) and non-fatal: local play and saves keep working and resync when the connection returns.
+- **Testability.** Connection logic takes its socket/transport as an injected, fakeable dependency; reconnects, closes, and inbound messages are simulated, so tests need no real network.
```

### 3.4 Diff shape vs. the plan's file inventory rows

| File | Inventory row | Observed |
| --- | --- | --- |
| `.opencode/agents/builder.md` | Edit (T4: +1 rule) | 1 insertion, 0 deletions, 1 hunk, nothing else changed |
| `.opencode/skills/web-implementation/SKILL.md` | Edit (+1 rule) | 1 insertion, 0 deletions, 1 hunk |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | Edit (+1 section) | 9 insertions, 0 deletions, 1 hunk |

`git diff --numstat` / hunk counts / deletion counts:

```
$ git diff --numstat HEAD -- <three paths>
1	0	.opencode/agents/builder.md
1	0	.opencode/skills/web-implementation/SKILL.md
9	0	.opencode/skills/web-implementation/references/engineering-principles.md
$ per-file '^@@' count: 1 / 1 / 1
$ deletion lines ('^-[^-]') in the three-file diff: 0
```

---

## 4. AC-24 proof — the T4 diff touches no permission entry

Requirement (tasks.md T4, contract 8 T4 stage, AC-24): `builder.md`'s permission block is byte-identical before and after T4; T4's `builder.md` diff is the prose rule only.

**Permission region** = frontmatter from `permissions:` through the closing `---` fence (`sed -n '/^permissions:/,/^---$/p'`; equivalently baseline lines 7–83).

```
$ sed -n '/^permissions:/,/^---$/p' /tmp/opencode/t4/baseline-builder.md | sha256sum
a683feed4cb59700efbb9c25c0de8634829b658571b69f13c797304f5a387f5b  -
$ sed -n '/^permissions:/,/^---$/p' .opencode/agents/builder.md | sha256sum
a683feed4cb59700efbb9c25c0de8634829b658571b69f13c797304f5a387f5b  -
$ diff -u <(sed -n '/^permissions:/,/^---$/p' /tmp/opencode/t4/baseline-builder.md) <(sed -n '/^permissions:/,/^---$/p' .opencode/agents/builder.md)
PERMISSION REGION: BYTE-IDENTICAL (no diff output)
$ sed -n '7,83p' .opencode/agents/builder.md | sha256sum
a683feed4cb59700efbb9c25c0de8634829b658571b69f13c797304f5a387f5b  -
$ sed -n '7,83p' .opencode/agents/builder.md | wc -lc
     77    1569
```

**Structured check** (frontmatter parsed with `python3` + `yaml.safe_load` — the same aid T0's structural assertion used; here only as an inspection aid):

```
$ python3 - <<'PY'   # parse both files, compare the normalized permissions lists
...
baseline item count: 25 post-edit item count: 25
normalized lists equal: True
first divergence: None
PY
```

**Count/state checks:**

```
$ grep -c 'effect: allow' baseline / post-edit → 15 / 15
$ grep -c 'effect: deny'  baseline / post-edit → 10 / 10
```

**Staged-blob check** (permission region inside the staged/committed blob — evidence that the committed object carries the untouched block):

```
$ git cat-file blob :<staged-builder.md> | sed -n '/^permissions:/,/^---$/p' | sha256sum
a683feed4cb59700efbb9c25c0de8634829b658571b69f13c797304f5a387f5b  -
```

**Where the single `builder.md` hunk sits:** `@@ -89,6 +89,7 @@` with context `## Rules` — the prose region (line 89+ in the baseline corresponds to the end of the frontmatter and the rules list; the file's frontmatter ends at baseline line 83). The hunk contains no `permissions:`, no `action:`, no `resource:`, no `effect:` line. Conclusion: **T4 changes exactly one prose rule and zero permission entries**; the only permission change in the feature remains T0's five-entry commit (`5af8715`).

---

## 5. Committed-state evidence

Commit identity is **deliberately not embedded in this file** (a commit cannot contain its own hash nor raw output produced after it — self-reference; same precedent as `build-log-T0.md` §7 / `build-log-T1.md` §4 / `build-log-T2.md` §4). It is reported in the Subagent Report and retrievable as `git rev-parse HEAD`.

Staged diff — captured with explicit paths (path-limited, so sibling builders' staged files never appear), sha256 per file:

```
$ git diff --cached -- .opencode/agents/builder.md | sha256sum
eaecdcffbd4638eadfcfbe7fe2e7959ef0a58e3538ed930250d48d592eb5e770  -
$ git diff --cached -- .opencode/skills/web-implementation/SKILL.md | sha256sum
f5cb3b870a76771ccf2f0a7cd5157ea4ac6183d42a769a34d1d09c8fe9ee0804  -
$ git diff --cached -- .opencode/skills/web-implementation/references/engineering-principles.md | sha256sum
b70239b0441118dc75387ec9f2a469fdb8e2c00250dad853e2b3bdc3c50561a5  -
```

Staged-diff bodies are byte-identical to the working-tree diff bodies in §3 (same content, same blob hashes) — the §3 blocks are therefore the staged bodies verbatim.

Recorded commit metadata (knowable before the commit; parent = HEAD at build start):

```
branch:  feat/online-realtime-workflow
parent:  b3aeff1  (T2; docs: add provisional real-time backlog and vision direction link (T2))
subject: docs: add real-time implementation guidance for builder/web skill (T4)
file list (git diff --cached --name-only, four paths added explicitly):
  .opencode/agents/builder.md
  .opencode/skills/web-implementation/SKILL.md
  .opencode/skills/web-implementation/references/engineering-principles.md
  docs/features/online-realtime-workflow/build-log-T4.md
staged blob == working-tree blob for each content file (git hash-object == git rev-parse :<path>):
  29921e35bf1a156991503045cc414b5b27ce0c66  .opencode/agents/builder.md
  20b0415cfb119dc2dcc0d99820899927ccf3875b  .opencode/skills/web-implementation/SKILL.md
  ac284055968cbfd401c4b1ba8b422ef3c2572449  .opencode/skills/web-implementation/references/engineering-principles.md
hash:    omitted here (self-reference) — reported in the Subagent Report / `git rev-parse HEAD`
```

**Post-commit confirmation** (command run immediately after the commit; the raw output is reported out-of-band for the self-reference reason above, and is reproducible by anyone):

```
$ git show HEAD -- .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md \
      .opencode/skills/web-implementation/references/engineering-principles.md
```

Its body is byte-identical to the §3/§5 staged bodies by content-addressing: `git diff --cached` and `git show HEAD -- <path>` emit the same `index <old-blob>..<new-blob> 100644` header and the same hunks, and the new blob hashes are identical because the staged blobs are what the commit records (`git hash-object` == `git rev-parse :<path>` above; post-commit `git rev-parse HEAD:<path>` yields the same three hashes). The identity was verified after the commit by extracting `git show HEAD -- <path>` bodies and comparing them with the staged bodies (`sha256sum`) — matching values recorded in the Subagent Report. Additionally, `git show --name-only --format=%s HEAD` lists exactly the four `files_owned` paths above (no sibling path, since the commit was pathspec-limited — §7).

---

## 6. Verify commands (tasks.md T4) — raw output

### V1 — `grep -in "real-time" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md` (exit 0)

```
.opencode/agents/builder.md:92:- Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.
.opencode/skills/web-implementation/SKILL.md:26:- Real-time (WebSocket): one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (the client never trusts reported values); teardown closes connections and removes handlers. Depth in `references/engineering-principles.md` § Real-time principles.
.opencode/skills/web-implementation/references/engineering-principles.md:45:## Real-time (WebSocket) principles
exit=0
```

All three files carry the "real-time" token required by AC-16/AC-17/AC-18.

### V2 — `git diff HEAD -- <files_owned>` vs. the T4 build-start baselines

See §3 (raw diff bodies) and §3.4 (numstat/hunk/deletion counts): exactly one insertion per agent/skill file, one 9-line section in the depth reference, zero deletions, one hunk per file.

### V3 — AC-16 token audit (`builder.md`, added line 92)

```
$ grep -o -iE "real-time|server-authoritative|never trust client-reported values|connection lifecycle|connect/reconnect/teardown|no duplicate handlers|\`web-implementation\` skill" <added line>
real-time  server-authoritative  never trust client-reported values  connection lifecycle
connect/reconnect/teardown  no duplicate handlers  `web-implementation` skill
```

### V4 — AC-17 token audit (`SKILL.md` line 26)

```
$ sed -n '26p' .opencode/skills/web-implementation/SKILL.md | grep -o -iE "one owner for the connection lifecycle|connect → open → close → reconnect|reconnection is bounded and resyncs state|server-authoritative|never trusts reported values|teardown closes connections and removes handlers|references/engineering-principles.md § Real-time principles"
one owner for the connection lifecycle
connect → open → close → reconnect
reconnection is bounded and resyncs state
server-authoritative
never trusts reported values
teardown closes connections and removes handlers
```

### V5 — AC-18 audit (`engineering-principles.md`)

```
$ grep -n '^## ' .opencode/skills/web-implementation/references/engineering-principles.md
5:## SOLID, applied
13:## DRY — with a third-strike rule
17:## KISS & YAGNI
23:## Game-specific rules
31:## Accessibility & UX floor
38:## Performance budget (per feature)
45:## Real-time (WebSocket) principles
$ sed -n '45,52p' <file> | grep -c '^- \*\*'
6
$ heading counts: baseline 6 → post-edit 7 (exactly one new section, appended last)
$ "WebSocket" occurrences in added lines: 2 (protocol name only)
```

### V6 — technology-name scans

```
$ grep -inE "\b(react|vue|angular|svelte|node|deno|bun|socket\.io|express|django|spring|rust|nginx|apache|postgres|redis|mongo|graphql|docker|firebase|aws|npm|yarn|pnpm|vite|webpack|rollup|jest|vitest|playwright|cypress|framework|library|libraries|runtime|vendor|package)\b" <added lines>
exit=1 (no matches)
$ <same scan, whole-file, on all three targets>
exit=1 (no matches)
$ grep -c 'WebSocket' <added lines>
2
```

Note (transparency): an earlier, unanchored variant of this scan produced three false positives because the substring `rust` occurs inside `trust` / `trusts` / `untrusted` — the word-boundary scan above is the correct one and is clean. The only technology name in the added content is the WebSocket protocol (contract: allowed as protocol context only); stack remains NOT DECIDED.

### V7 — additive-only / scope checks

```
$ git diff --numstat HEAD -- <three paths>          → 1/0, 1/0, 9/0 (insertions/deletions)
$ per-file '^@@' hunk counts                        → 1, 1, 1
$ deletions in the three-file diff ('^-[^-]')       → 0
$ builder.md Rules bullets: baseline 7 → post 8
$ SKILL.md Architecture-rules bullets: baseline 8 → post 9
$ engineering-principles.md '## ' headings: baseline 6 → post 7
```

---

## 7. Staging discipline

```
$ git diff --cached --name-only        # BEFORE staging anything of T4's
.opencode/agents/orchestrator.md          <- T3's, staged by the sibling builder
.opencode/agents/planner.md               <- T3's
.opencode/skills/spec-authoring/references/spec-checklist.md   <- T3's
$ git add .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md \
          .opencode/skills/web-implementation/references/engineering-principles.md   # evidence capture only
$ git restore --staged .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md \
          .opencode/skills/web-implementation/references/engineering-principles.md   # release the shared index
$ git diff --cached --name-only
.opencode/agents/orchestrator.md
.opencode/agents/planner.md
.opencode/skills/spec-authoring/references/spec-checklist.md
$ git status --porcelain=v1 -- <T4 paths>
 M .opencode/agents/builder.md
 M .opencode/skills/web-implementation/SKILL.md
 M .opencode/skills/web-implementation/references/engineering-principles.md
```

Because T3 shares this index inside the `[P]` batch, T4 committed with an **explicit pathspec** in a single command (staging its own log path first, in the same command), which cannot include another builder's staged entries:

```
$ git add docs/features/online-realtime-workflow/build-log-T4.md && \
  git commit -m "docs: add real-time implementation guidance for builder/web skill (T4)" -- \
    .opencode/agents/builder.md \
    .opencode/skills/web-implementation/SKILL.md \
    .opencode/skills/web-implementation/references/engineering-principles.md \
    docs/features/online-realtime-workflow/build-log-T4.md
```

No `git add .` / `git add -A`; no `git add` of any path outside `files_owned`; no unrelated path committed (verified post-commit with `git show --name-only --format=%s HEAD`). Left untouched, unstaged/untracked: all sibling-builder work in the `[P]` batch (orchestrator/planner/spec-checklist/reviewer/spec-review/code-review) and the pre-existing `docs/features/project-glossary/**` artifacts plus `docs/features/project-glossary/status.md`. No push; no branch switch; no rebase/reset/amend.

---

## Acceptance audit

- **AC-16 — met.** `.opencode/agents/builder.md` gains one rule (new line 92, single-line bullet in **Rules**; added content contains "real-time"). It requires: server-authoritative shared/cross-client state (`shared/cross-client state is server-authoritative`), no trust in client-reported values (`never trust client-reported values`), connection-lifecycle ownership (`own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers)`), and a pointer to the skill (`follow the `web-implementation` skill's real-time rules`). Evidence: §2 item 1, §3.1, V1, V3. No permission entry touched (§4).
- **AC-17 — met.** `.opencode/skills/web-implementation/SKILL.md` gains one **Architecture rules** bullet (new line 26) covering: single connection-lifecycle owner (`one owner for the connection lifecycle (connect → open → close → reconnect)`); bounded reconnection with state resync (`reconnection is bounded and resyncs state`); server-authoritative shared state (`shared/cross-client state is server-authoritative (the client never trusts reported values)`); teardown (`teardown closes connections and removes handlers`); and a pointer to the depth reference (`Depth in `references/engineering-principles.md` § Real-time principles`). Evidence: §2 item 2, §3.2, V1, V4.
- **AC-18 — met.** `.opencode/skills/web-implementation/references/engineering-principles.md` gains the section `## Real-time (WebSocket) principles` (line 45, last section, one new `##` heading) with six bullets covering every required area: single connection owner (l.47 — UI observes status, never opens its own socket); reconnection with resync and no duplicate handlers (l.48 — bounded, idempotent handlers, no duplicates across reconnects); server authority for shared values (l.49 — values from the server, optimistic UI reconciles, client-reported values never truth); untrusted inbound message handling (l.50 — validate shape/type, ignore unknown, `textContent` never `innerHTML`); graceful degradation (l.51 — connection loss visible and non-fatal, local play/saves unaffected); testability without a real network (l.52 — socket/transport injected/fakeable, events simulated). Evidence: §2 item 3, §3.3, V1, V5.
- **AC-24 (T4 scope) — met / not implicated.** T4 modifies no `permissions:` block or allow/deny entry: the permission region is byte-identical before/after (sha256 `a683feed4cb59700efbb9c25c0de8634829b658571b69f13c797304f5a387f5b` both sides; normalized YAML permission lists equal; 15 allow / 10 deny both sides; same hash inside the staged blob); the single `builder.md` hunk sits at `@@ -89,6 +89,7 @@` in the prose region and contains no permission key. Evidence: §4.
- **AC-25 (T4 scope) — met.** Diffs vs. the T4 build-start baselines (§3) contain exactly contract items 8 (T4 stage), 9, and 10's content: 11 added lines total across three files, 0 deletions, 1 hunk per file, no unrelated or drive-by edits, no reflow of pre-existing lines, no removal — the new content is verbatim the pinned substance, and no other path was touched. `builder.md` is checked here as the T4 phase only (T0's five entries are inside the baseline, §1.1, and are untouched by this diff). Evidence: §3, §3.4, V7.

Contract-token audit (plan § Pinned content contracts items 8 T4-stage / 9 / 10; spec AC-16/17/18):

| Required token / concept | Where |
| --- | --- |
| `builder.md` **Rules** bullet with "real-time" | `builder.md:92` |
| server-authoritative shared/cross-client state + never trust client-reported values | `builder.md:92` |
| connection lifecycle ownership connect/reconnect/teardown, no duplicate handlers | `builder.md:92` |
| pointer to `web-implementation` skill's real-time rules | `builder.md:92` |
| SKILL **Architecture rules** bullet, summary + depth pointer | `SKILL.md:26` |
| one owner for the connection lifecycle (connect → open → close → reconnect) | `SKILL.md:26` |
| bounded reconnection + state resync | `SKILL.md:26` |
| server-authoritative shared state; client never trusts reported values | `SKILL.md:26` |
| teardown closes connections / removes handlers | `SKILL.md:26` |
| depth pointer to `references/engineering-principles.md` § Real-time principles | `SKILL.md:26` |
| section `## Real-time (WebSocket) principles` | `engineering-principles.md:45` |
| single connection owner (UI observes status, never opens its own socket) | `engineering-principles.md:47` |
| lifecycle & reconnection (bounded retries, resync, idempotent/no duplicate handlers) | `engineering-principles.md:48` |
| server authority (shared/global from server; optimistic UI reconciles; never trust client-reported) | `engineering-principles.md:49` |
| untrusted inbound data (shape/type validation, ignore unknown, `textContent` never `innerHTML`) | `engineering-principles.md:50` |
| graceful degradation (loss visible, non-fatal, local play/saves unaffected) | `engineering-principles.md:51` |
| testability (injected/fakeable connection, no real network) | `engineering-principles.md:52` |
| no library/framework/runtime/vendor names (WebSocket protocol only) | V6 |
| no permission-content edit | §4 |

## Tests

None — no automated commands exist (`AGENTS.md` § Commands: TBD; stack NOT DECIDED, per spec § Testing strategy and § Non-goals). This is a workflow-instruction documentation change with no runtime behavior; verification is inspection + `grep`/`git diff`/`python3` aids, exactly as the task's `verify` field specifies. No application code, dependency, or tooling was introduced.

## Deviations from spec

None in content or scope.

Notes (not deviations):
- Bullet/section placement inside each list is not pinned by the contracts; each insertion was placed at the natural neighbour and produces a single-hunk, deletion-free diff (§2 Decisions).
- The commit was path-scoped (`git commit -- <paths>`) rather than plain `git commit`, because two sibling builders share this branch's index in the same `[P]` batch; this is the staging-discipline requirement (stage only `files_owned`) met more strictly, not a deviation.
- The commit hash and the raw post-commit `git show` output are reported out-of-band (Subagent Report) instead of embedded: a commit cannot contain its own hash or output produced after it (T0/T1/T2 precedent).
- `python3`/`sha256sum`/`grep`/`git` were used strictly as build-time inspection aids — no tooling choice is introduced; stack remains NOT DECIDED.
