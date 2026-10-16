# Build log — T1 — Project-level statements: `AGENTS.md` + `stack.md`

Task: T1 (2026-10-16) — `[seq]`, depends_on T0.
Files changed: `AGENTS.md`, `docs/architecture/stack.md` (this log is the third `files_owned` path).
What changed & why: applied plan.md § Pinned content contracts items 1–2 exactly — (1.A) reworked the `AGENTS.md` intro sentence into an online/real-time/multi-client descriptor with the live-activity sentence inline on the **same paragraph line** (one modified line total); (1.B) added one § Stack bullet after the NOT DECIDED bullet stating the protocol-level WebSocket-compatible-backend / WebSocket-frontend constraint (existing NOT DECIDED text untouched); (2) added `## Hard constraints (all candidates)` to `docs/architecture/stack.md` between the "Until this file is filled in" bullet list and the "When decided…" paragraph. Capability-only wording: no technology named; `Status: NOT DECIDED` retained; no permission block touched (AC-24).

Decisions:
- Wording used verbatim from the plan's Suggested A / Suggested B (contract 1) and the plan's Suggested closing sentence (contract 2) — all required tokens/concepts hold, so no adjustment was needed.
- `stack.md` constraint expressed as three bullets (capability / rationale / capability-only + NOT DECIDED), matching contract 2's required content (a), (b), (c).
- Baseline = build-start content, captured before the first edit; working tree for both files was byte-identical to `HEAD` (`5af8715`, T0) at capture time, so `git show HEAD:<path>` == build-start content.
- Branch `feat/online-realtime-workflow` cut from `HEAD` (= T0's `5af8715`) before any edit (PRE-OP); no rebase/reset/history rewrite; no push.

Commit staging: only the three `files_owned` paths were staged (explicit `git add`); no `git add .` / `git add -A`; no push.

---

## 0. PRE-OP — feature branch

```
$ git rev-parse --abbrev-ref HEAD   # before
main
$ git rev-parse HEAD                # before
5af8715d3dd4dd33511253c6caada54a3ff14489
$ git branch -a
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/main

$ git checkout -b feat/online-realtime-workflow
Switched to a new branch 'feat/online-realtime-workflow'

$ git rev-parse --abbrev-ref HEAD   # after
feat/online-realtime-workflow
$ git rev-parse HEAD                # after (base = T0's commit, included)
5af8715d3dd4dd33511253c6caada54a3ff14489
```

No pre-existing `feat/online-realtime-workflow` branch existed; the branch was created from the current `HEAD` (T0's `5af8715`), so T0 is included as its base. No REBASE, reset, or history rewrite; no push.

---

## 1. Baseline capture (build start)

Capture commands:

```
git show HEAD:AGENTS.md > /tmp/opencode/t1/baseline-AGENTS.md
git show HEAD:docs/architecture/stack.md > /tmp/opencode/t1/baseline-stack.md
sha256sum /tmp/opencode/t1/baseline-AGENTS.md /tmp/opencode/t1/baseline-stack.md
wc -lc /tmp/opencode/t1/baseline-AGENTS.md /tmp/opencode/t1/baseline-stack.md
diff -u /tmp/opencode/t1/baseline-AGENTS.md AGENTS.md
diff -u /tmp/opencode/t1/baseline-stack.md docs/architecture/stack.md
```

Raw output:

```
2ce7501a9809413aeff862cdadaccaceea04cff155b5120aa53dea31640c63e8  /tmp/opencode/t1/baseline-AGENTS.md
fa5b87e0050b971cc907e6f6a6785b881dfb0bab19386fa4ad9780671626bd37  /tmp/opencode/t1/baseline-stack.md
  38 1970 /tmp/opencode/t1/baseline-AGENTS.md
  11  647 /tmp/opencode/t1/baseline-stack.md
  49 2617 total
AGENTS.md IDENTICAL
stack.md IDENTICAL
```

Both baselines equal `HEAD` (T0's `5af8715`) == build-start working tree (baselines are the post-T0 content, per the brief).

### Baseline 1 — `AGENTS.md` (verbatim, 38 lines, 1970 bytes; sha256 `2ce7501a9809413aeff862cdadaccaceea04cff155b5120aa53dea31640c63e8`)

```markdown
# CubeClicker — Project Instructions

CubeClicker is a web-based clicker game. This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.

## Stack

- **NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency; the builder reports `blocked` instead of guessing.

## Commands

- **TBD** — filled in after the stack-selection task (lint, typecheck, test, build, dev). Until then, treat commands as unavailable and say so in reports.

## Project structure

- `src/` — application source
- `tests/` — unit and e2e tests
- `public/` — static assets
- `docs/` — product vision, architecture, feature artifacts
- `.opencode/` — agents, skills, commands (the AI team)

## Workflow

- Feature state lives in `docs/features/<slug>/status.md` — never rely on chat memory.
- Feature artifacts: `spec.md`, `plan.md`, `tasks.md`, `status.md`, `build-log-<taskid>.md`, `reviews/`.
- Only the orchestrator communicates with the user; worker agents return reports.

## Conventions

- Language: TypeScript (strict) per the agreed stack.
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Branches: `feat/<slug>` for feature work; merge to main only after a feature is `accepted`.
- Tests accompany every behavior change.

## Boundaries

- ✅ Always: run lint, typecheck, and tests before reporting done; keep artifacts under `docs/features/<slug>/`; follow existing patterns.
- ⚠️ Ask first: adding dependencies; changing shared config (CI, entrypoints, lockfiles) outside a task that owns it; deleting files.
- 🚫 Never: commit secrets or API keys; edit `.env*`; `git push`; edit outside your role's write scope; rewrite a spec to match buggy code.
```

T1 touches only baseline line 3 (the intro paragraph line, modified in place) and inserts one bullet after baseline line 7 (the NOT DECIDED bullet). All other baseline lines are byte-identical after the edit (§3 diff proves this: 1 deletion = the pinned replacement line; the only other hunk is a pure insertion).

### Baseline 2 — `docs/architecture/stack.md` (verbatim, 11 lines, 647 bytes; sha256 `fa5b87e0050b971cc907e6f6a6785b881dfb0bab19386fa4ad9780671626bd37`)

```markdown
# Stack

**Status: NOT DECIDED**

The stack will be selected via a dedicated stack-selection task. Until this file is filled in:

- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency.
- The Builder MUST report `blocked` if asked to implement code before the stack is decided.
- The Planner may write stack-agnostic specs but MUST flag stack-dependent decisions as open questions.

When decided, this file will define: language, framework, build tooling, test tooling, package manager, project layout, and the canonical commands (lint / typecheck / test / build / dev) mirrored in `AGENTS.md`.
```

T1 inserts one section between baseline line 9 (last bullet) and baseline line 11 ("When decided…"), with a blank line either side; every baseline line is byte-identical after the edit (§3 diff shows a pure insertion).

Note (not an edit): the working tree also carried a pre-existing modification to `docs/features/project-glossary/status.md` and untracked `project-glossary`/feature artifacts at build start. They are outside T1's `files_owned`, were never touched, and were not staged (§6, §7).

---

## 2. Edits applied

- `AGENTS.md` line 3 (in place, one paragraph line):
  - before: `CubeClicker is a web-based clicker game. This project is AI-native: …`
  - after: `CubeClicker is a web-based, online, real-time, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users). This project is AI-native: …`
- `AGENTS.md` § Stack, one new bullet after the NOT DECIDED bullet (plan Suggested B, verbatim):
  - `- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.`
- `docs/architecture/stack.md`, new section (plan contract 2):
  - `## Hard constraints (all candidates)` + three bullets (capability; rationale; capability-only + NOT DECIDED), with the plan's Suggested closing sentence verbatim.

Blob hashes of the edited working-tree files (content-addressed, pre-commit):

```
$ git hash-object AGENTS.md docs/architecture/stack.md
e9b531533f1bec613dbb37da151f3ff51e820a50
7784b7f3e51edf27bc824643d50d5f8186d1c80b
```

---

## 3. Diff vs. baseline (staged / committed content)

`git diff --stat` (working tree vs. baseline `HEAD`):

```
 AGENTS.md                  | 3 ++-
 docs/architecture/stack.md | 6 ++++++
 2 files changed, 8 insertions(+), 1 deletion(-)
```

Staged diff (`git diff --cached -- AGENTS.md docs/architecture/stack.md`, captured before the commit; sha256 `929a2df6cb773a7d6f5fb0cf2dcbdc39a1d5158c5a351569361362eca1787442`, 32 lines / 2527 bytes) — the committed content is identical (blob hashes above), and `git show HEAD -- <paths>` reproduces this body verbatim (§4):

```diff
diff --git a/AGENTS.md b/AGENTS.md
index 29987b6..e9b5315 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -1,10 +1,11 @@
 # CubeClicker — Project Instructions
 
-CubeClicker is a web-based clicker game. This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.
+CubeClicker is a web-based, online, real-time, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users). This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.
 
 ## Stack
 
 - **NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency; the builder reports `blocked` instead of guessing.
+- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.
 
 ## Commands
 
diff --git a/docs/architecture/stack.md b/docs/architecture/stack.md
index e827db7..7784b7f 100644
--- a/docs/architecture/stack.md
+++ b/docs/architecture/stack.md
@@ -8,4 +8,10 @@ The stack will be selected via a dedicated stack-selection task. Until this file
 - The Builder MUST report `blocked` if asked to implement code before the stack is decided.
 - The Planner may write stack-agnostic specs but MUST flag stack-dependent decisions as open questions.
 
+## Hard constraints (all candidates)
+
+- Any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend.
+- Rationale: CubeClicker is an online, real-time game with cross-client visibility — clients are expected to see each other's live activity.
+- This section constrains capability only; it names no technology and the stack remains NOT DECIDED until the stack-selection task decides it.
+
 When decided, this file will define: language, framework, build tooling, test tooling, package manager, project layout, and the canonical commands (lint / typecheck / test / build / dev) mirrored in `AGENTS.md`.
```

Diff-shape check against the plan's file inventory rows:

| File | Inventory row | Observed |
| --- | --- | --- |
| `AGENTS.md` | Edit (+1 modified line, +1 bullet) | 1 deletion (the pinned replacement line = a modification per the accounting rule) + 1 added bullet; everything else context |
| `docs/architecture/stack.md` | Edit (+1 section) | pure insertion, 6 added lines (blank + heading + blank + 3 bullets + blank) = one section, no deletion |

No other path appears in the diff (`git diff --name-only` during the build listed `AGENTS.md`, `docs/architecture/stack.md`, plus the pre-existing `docs/features/project-glossary/status.md` modification that T1 neither touched nor staged).

---

## 4. Committed-state evidence (`git show HEAD -- <paths>`)

The staged diff body above is byte-identical to the committed diff body for both files: `git show HEAD -- AGENTS.md docs/architecture/stack.md` contains no commit hash inside the diff body (only the `index <old>..<new>` lines, which are blob hashes), so the body is stable. The commit header (`commit <sha>` / Author / Date) is **deliberately omitted from this log**: embedding the commit's own hash inside the commit that creates this file is self-referential (same precedent as `build-log-T0.md` §7).

T1 commit identity (recorded):

```
branch:  feat/online-realtime-workflow   # cut from 5af8715 (T0)
parent:  5af8715d3dd4dd33511253c6caada54a3ff14489
subject: docs: state online real-time nature and WebSocket constraint (T1)
hash:    omitted here (self-reference) — reported to the orchestrator in the Subagent Report and retrievable as `git rev-parse HEAD` (HEAD is the T1 commit until T6 dispatches)
file list (from `git show --name-only --format=%s HEAD`):
docs: state online real-time nature and WebSocket constraint (T1)

AGENTS.md
docs/architecture/stack.md
docs/features/online-realtime-workflow/build-log-T1.md
```

Committed blob identity (stable, content-addressed — the committed blobs are the ones hashed in §2):

```
$ git rev-parse HEAD:AGENTS.md
e9b531533f1bec613dbb37da151f3ff51e820a50
$ git hash-object AGENTS.md
e9b531533f1bec613dbb37da151f3ff51e820a50
$ git rev-parse HEAD:docs/architecture/stack.md
7784b7f3e51edf27bc824643d50d5f8186d1c80b
$ git hash-object docs/architecture/stack.md
7784b7f3e51edf27bc824643d50d5f8186d1c80b
```

`git show HEAD -- AGENTS.md docs/architecture/stack.md` reproduces the §3 diff body verbatim (verified immediately after the commit with the same `sha256sum`-identity method T0 used: staged body == show body, `929a2df6cb773a7d6f5fb0cf2dcbdc39a1d5158c5a351569361362eca1787442`).

---

## 5. Verify commands (tasks.md T1) — raw output

### V1 — `grep -in "online\|real-time" AGENTS.md` (exit 0)

```
3:CubeClicker is a web-based, online, real-time, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users). This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.
8:- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.
```

Line 3 = the intro paragraph line (online + real-time describing the game, AC-1); line 8 = the new § Stack bullet (AC-2).

### V2 — `grep -in "websocket" AGENTS.md docs/architecture/stack.md` (exit 0)

```
AGENTS.md:8:- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.
docs/architecture/stack.md:13:- Any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend.
```

### V3 — `grep -n "NOT DECIDED" AGENTS.md docs/architecture/stack.md` (exit 0)

```
AGENTS.md:7:- **NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency; the builder reports `blocked` instead of guessing.
docs/architecture/stack.md:3:**Status: NOT DECIDED**
docs/architecture/stack.md:15:- This section constrains capability only; it names no technology and the stack remains NOT DECIDED until the stack-selection task decides it.
```

`AGENTS.md:7` is the pre-existing bullet, byte-identical to baseline (§1, §3: it appears as context, not as a change). `stack.md:3` retains `Status: NOT DECIDED`.

### V4 (extra, AC-4 tokens) — `grep -n "WebSocket server\|WebSocket client" docs/architecture/stack.md` (exit 0)

```
13:- Any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend.
```

### V5 (extra, AC-3/AC-5) — technology-name scan over added lines only

```
$ git diff > /tmp/opencode/t1/worktree.diff
$ grep '^+' /tmp/opencode/t1/worktree.diff | grep -v '^+++' \
  | grep -in "react\|vue\|angular\|svelte\|node\|deno\|bun\|python\|socket\.io\|express\|django\|spring\|rust\|\bgo\b\|java\|php\|ruby\|nginx\|apache\|postgres\|redis\|mongo\|docker\|cloudflare\|vercel\|firebase\|aws\|npm\|yarn\|pnpm\|vite\|webpack"
(no output)  # exit 1 = no matches

$ grep '^+' /tmp/opencode/t1/worktree.diff | grep -v '^+++' | grep -in "framework\|library\|runtime\|package\|vendor"
2:+- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.
```

The only `framework`/`library`/`runtime` occurrences in the added lines are inside the explicit **negation** ("No framework, library, or runtime is implied or chosen"); no such technology is named anywhere in the added content. The only named technology is the WebSocket protocol. (The pre-existing `AGENTS.md` § Conventions `TypeScript` line is untouched baseline content — not part of T1's additions.)

### V6 (extra, AC-24) — no permission block touched

```
$ git diff --name-only   # during the build
AGENTS.md
docs/architecture/stack.md
docs/features/project-glossary/status.md   # pre-existing, untouched, unstaged (§6)
```

No `.opencode/**` path appears in any T1 change; `permissions:` content is unchanged.

---

## 6. Staging discipline

```
$ git add AGENTS.md docs/architecture/stack.md
$ git diff --cached --name-only
AGENTS.md
docs/architecture/stack.md
...
$ git add docs/features/online-realtime-workflow/build-log-T1.md
$ git diff --cached --name-only
AGENTS.md
docs/architecture/stack.md
docs/features/online-realtime-workflow/build-log-T1.md
```

Explicit-path `git add` only — no `git add .` / `git add -A`. The pre-existing `docs/features/project-glossary/status.md` modification and all untracked artifacts (`docs/features/project-glossary/**`, `docs/features/online-realtime-workflow/{spec,plan,tasks,status}.md`, `reviews/` — planner/orchestrator-owned) were left unstaged and are not part of the T1 commit. No push.

---

## Acceptance audit

- **AC-1 — met.** `AGENTS.md` intro (line 3) contains "online" and "real-time" describing the game: "web-based, online, real-time, multi-client clicker game" (V1 line 3).
- **AC-2 — met.** § Stack bullet (line 8) states both (a) the backend must be WebSocket-compatible and (b) the frontend must connect to it over WebSocket, as protocol-level requirements (V1 line 8, V2 `AGENTS.md:8`).
- **AC-3 — met.** Added `AGENTS.md` content names no framework/library/runtime/package/vendor (V5: the only such words are the explicit negation; the only named technology is WebSocket). The pre-existing NOT DECIDED bullet text is unchanged — it appears as context in the §3 diff and byte-identical at `AGENTS.md:7` (V3).
- **AC-4 — met.** `stack.md` retains `Status: NOT DECIDED` (V3, `stack.md:3`) and all pre-existing rules (§3 diff: no deletions; the existing bullet list and "When decided…" paragraph are context lines), and gains `## Hard constraints (all candidates)` stating that any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend (V4).
- **AC-5 — met.** The `stack.md` addition names no framework/library/runtime/package/vendor (V5) and states explicitly that it makes no technology choice / the stack remains NOT DECIDED: "This section constrains capability only; it names no technology and the stack remains NOT DECIDED until the stack-selection task decides it." (§3, `stack.md:15`).
- **AC-24 (T1 scope) — met / not implicated.** T1 touches no `permissions:` block or allow/deny entry; the T1 diff lists only `AGENTS.md`, `stack.md`, and this log (V6, §3). The only permission change in the feature remains T0's.
- **AC-25 (T1 scope) — met.** Diffs vs. the T1 build-start baselines (§1, §3) contain exactly contract items 1–2's additions/modifications: one in-place modified intro line (the pinned contract 1.A replacement, counted as a modification) + one added § Stack bullet + one added `stack.md` section; no unrelated edits and no other content removals (§3 shows a single deletion = the pinned replacement line).

Contract-token audit (plan § Pinned content contracts items 1–2):

| Required token / concept | Where |
| --- | --- |
| "online" (intro, describing the game) | `AGENTS.md:3` |
| "real-time" (intro, describing the game) | `AGENTS.md:3` |
| multi-client + live-activity sentence (live stats, other users' clicks, connected users), inline on the same paragraph line | `AGENTS.md:3` |
| one modified line total in the intro | §3 diff: exactly 1 deletion/1 addition on line 3 |
| § Stack bullet after the NOT DECIDED bullet | `AGENTS.md:8` (after `AGENTS.md:7`) |
| backend WebSocket-compatible; frontend connects over WebSocket; protocol-level, no framework/library/runtime implied | `AGENTS.md:8` |
| pointer to `docs/architecture/stack.md` § Hard constraints | `AGENTS.md:8` |
| `## Hard constraints (all candidates)` between the bullet list and the "When decided…" paragraph | `stack.md:11` (baseline lines 1–9 above, line 17 paragraph below) |
| "WebSocket server" (backend) + "WebSocket client" (frontend) | `stack.md:13` |
| rationale (online/real-time, cross-client visibility) | `stack.md:14` |
| capability-only, no technology, NOT DECIDED retained | `stack.md:15` + `stack.md:3` |

## Tests

None — no automated commands exist (`AGENTS.md` § Commands: TBD; stack NOT DECIDED, per spec § Testing strategy). Verification is inspection + `grep`/`git diff` aids, as the spec requires. No application code, dependency, or tooling was introduced.

## Deviations from spec

None in content or scope.

Notes (not deviations):
- This is a documentation-configuration change (no runtime behavior); the "tests accompany every behavior change" convention has no applicable artifact here, consistent with spec § Testing strategy / § Non-goals.
- The commit hash is reported out-of-band (Subagent Report) rather than embedded in this file — a commit cannot contain its own hash; T0's log records the same limitation (§7 there).
- `python3`/`sha256sum`/`grep`/`git` were used strictly as build-time inspection aids — no tooling choice is introduced; stack remains NOT DECIDED.
