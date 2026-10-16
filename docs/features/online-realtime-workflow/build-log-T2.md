# Build log — T2 — Product direction docs: backlog + vision

Task: T2 (2026-10-17) — `[seq]`, depends_on T0, T1.
Files changed: `docs/product/realtime-backlog.md` (new), `docs/product/vision.md` (edited) (this log is the third `files_owned` path).
What changed & why: applied plan.md § Pinned content contracts items 3–4 exactly — (3) created `docs/product/realtime-backlog.md` with the pinned closed section set: H1 + exactly three `##` sections (`Candidates from the request` / `Proposed additions (unconfirmed — not requested, not committed)` / `Open tensions`), the non-commitment blockquote ("Provisional direction — **not commitments**"), a one-line "why this file exists" paragraph, and the closing non-commitment rule as the only other block elements; (4) edited `docs/product/vision.md` with exactly the two pinned edits: (4.A) One-liner modified in place to `A web-based, online, real-time clicker game built and maintained by an AI-native development team.` and (4.B) exactly one added line immediately after the One-liner paragraph linking `realtime-backlog.md`. No technology/library/framework/runtime names; no permission block touched (AC-24).

Decisions:
- `vision.md` edit shape is literal per contract 4.B ("exactly one added line, immediately after the One-liner paragraph"): the Direction blockquote line is inserted directly after the One-liner text line with **no** blank separator, so the diff is exactly +1 modified line / +1 added line (a blank separator line would have made it +2 added lines and broken the inventory row / AC-12's "exactly one net-new added line"). CommonMark allows a block quote to interrupt a paragraph, so the line still renders as a standalone blockquote.
- Backlog wording: each named candidate and each proposal is a single-line bullet; the request's "etc." openness and the closing rule are plain paragraphs (not headings, not new sections) to keep the section set closed.
- Baseline = build-start content, captured **before** the first edit; working tree for `vision.md` was byte-identical to `HEAD` at capture time (`d41c465`, T1), so `git show HEAD:docs/product/vision.md` == build-start content.
- Plan-time vision quote (plan.md § Pinned content contracts item 4) re-verified byte-for-byte against the build-start content: **equivalence** (identical sha256; see §1.2 — no divergence).
- Stayed on `feat/online-realtime-workflow`; no branch switch, no rebase/reset/history rewrite; no push.

Commit staging: only the three `files_owned` paths were staged (explicit `git add`); no `git add .` / `git add -A`; no push. The pre-existing `docs/features/project-glossary/status.md` modification and all untracked planner/orchestrator artifacts were left untracked/unstaged.

---

## 0. PRE-OP — branch (no switch)

```
$ git rev-parse --abbrev-ref HEAD
feat/online-realtime-workflow
$ git log --oneline -3
d41c465 docs: state online real-time nature and WebSocket constraint (T1)
5af8715 chore: widen builder edit permissions for online-realtime-workflow (T0)
927fd78 Initial commit
```

Branch state at T2 build start: `feat/online-realtime-workflow` at `d41c465` (T1), with T0 `5af8715` as its parent. **No** checkout/branch switch, **no** rebase/reset/amend/history rewrite, **no** push. Documented change (deliverable), not a history operation.

---

## 1. Baseline capture (build start)

### 1.1 `vision.md` baseline

Capture commands:

```
$ git show HEAD:docs/product/vision.md > /tmp/opencode/t2/baseline-vision.md
$ cp docs/product/vision.md /tmp/opencode/t2/buildstart-vision.md
$ sha256sum /tmp/opencode/t2/baseline-vision.md /tmp/opencode/t2/buildstart-vision.md
ea8c912e0b29f560c424f3fad4c6d70b0e4fbe8ce7dd7f395f8c923337878be4  /tmp/opencode/t2/baseline-vision.md
ea8c912e0b29f560c424f3fad4c6d70b0e4fbe8ce7dd7f395f8c923337878be4  /tmp/opencode/t2/buildstart-vision.md
$ wc -lc /tmp/opencode/t2/baseline-vision.md
  23 1052 /tmp/opencode/t2/baseline-vision.md
$ diff -u /tmp/opencode/t2/baseline-vision.md docs/product/vision.md && echo "HEAD == build-start working tree: IDENTICAL"
HEAD == build-start working tree: IDENTICAL
```

Baseline 1 — `docs/product/vision.md` (verbatim, 23 lines, 1052 bytes; sha256 `ea8c912e0b29f560c424f3fad4c6d70b0e4fbe8ce7dd7f395f8c923337878be4`; blob `8b40044`):

```markdown
# CubeClicker — Product Vision

> Living document. The user owns the vision; agents read it as the north star. Updates flow through feature requests.

## One-liner

A web-based clicker game built and maintained by an AI-native development team.

## Core loop

Click a cube → earn points → spend points on upgrades → earn faster → repeat. (Details will be refined by the first product-spec feature.)

## Principles

- **Instant fun:** playable within seconds of loading; no friction, no accounts required.
- **Idle-friendly:** progress accrues while away (offline progress), so returning players feel rewarded.
- **Persistence:** safe local saves with versioned migration; corrupted saves never crash the game.
- **Accessible & responsive:** keyboard operable, mobile-friendly, respects reduced motion.
- **Performance:** 60 fps interactions, small bundle, instant load.

## Status

Product details are intentionally high-level. The stack-selection task and the first feature (core click loop) will flesh these out through the agent workflow.
```

`docs/product/realtime-backlog.md` baseline: **file does not exist** at build start (`test -f` fails; `git ls-files docs/product/` lists only `vision.md`) — creation, not modification.

### 1.2 Plan-time vision quote re-verification (equivalence/divergence)

Command (extract the item-4 fenced `markdown` block from `plan.md`, compare byte-for-byte with the build-start vision content):

```
$ awk '/^```markdown$/{f=1;next} f&&/^```$/{exit} f{print}' docs/features/online-realtime-workflow/plan.md > /tmp/opencode/t2/plan-quote.md
$ wc -lc /tmp/opencode/t2/plan-quote.md
  23 1052 /tmp/opencode/t2/plan-quote.md
$ sha256sum /tmp/opencode/t2/plan-quote.md
ea8c912e0b29f560c424f3fad4c6d70b0e4fbe8ce7dd7f395f8c923337878be4  /tmp/opencode/t2/plan-quote.md
$ cmp /tmp/opencode/t2/plan-quote.md docs/product/vision.md && echo "QUOTE == BUILD-START vision.md: BYTE-IDENTICAL (equivalence)" || echo "DIVERGENCE"
QUOTE == BUILD-START vision.md: BYTE-IDENTICAL (equivalence)
```

**Result: EQUIVALENCE.** The plan.md item-4 plan-time quote (23 lines, 1052 bytes, sha256 `ea8c912e0b29f560c424f3fad4c6d70b0e4fbe8ce7dd7f395f8c923337878be4`) is byte-identical to the build-start `vision.md` content (`cmp` exit 0; identical line and byte counts and sha256). No divergence; the build-start capture governs and **is** the plan quote. The plan quote's pinned target lines hold: line 7 = `A web-based clicker game built and maintained by an AI-native development team.`; line 5 = `## One-liner`; lines 8 = blank; line 9 = `## Core loop`.

---

## 2. Changes applied

- **NEW `docs/product/realtime-backlog.md`** (26 lines / 2007 bytes): H1 `# Real-Time Feature Backlog`; non-commitment blockquote; one-line "why this file exists" paragraph; `## Candidates from the request` (three single-line named candidates: live statistics; other users' clicks; connected users) + one-line note that the request's "etc." stays open; `## Proposed additions (unconfirmed — not requested, not committed)` with the three one-liners (global live counter; live leaderboard; community milestones); `## Open tensions` (identity vs. "no accounts required"; server authority) ; closing non-commitment rule (items become real only through the normal feature-request workflow; the user owns the list). Content is verbatim in §3/§7.
- **EDIT `docs/product/vision.md`** — line 7 replaced in place (contract 4.A) and one net-new line inserted at position 8 (contract 4.B):
  - before (baseline line 7): `A web-based clicker game built and maintained by an AI-native development team.`
  - after (new line 7): `A web-based, online, real-time clicker game built and maintained by an AI-native development team.`
  - added (new line 8): `> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.`
  - Nothing else in `vision.md` changed (§3, §5 V4).

Pre-commit content addresses (identical to the staged blobs — §4):

```
$ git hash-object docs/product/vision.md docs/product/realtime-backlog.md
b0d9019da22e65b99e24820affaabdd68c9cea0d
a20283110d165f04b31554ee42d43f654bb706d6
$ git rev-parse :docs/product/vision.md :docs/product/realtime-backlog.md
b0d9019da22e65b99e24820affaabdd68c9cea0d
a20283110d165f04b31554ee42d43f654bb706d6
```

---

## 3. Diffs (staged content; pre-commit)

`git diff --cached --stat`:

```
 docs/product/realtime-backlog.md | 26 ++++++++++++++++++++++++++
 docs/product/vision.md           |  3 ++-
 2 files changed, 28 insertions(+), 1 deletion(-)
```

### 3.1 New file diff — `docs/product/realtime-backlog.md`

(`git diff --cached -- docs/product/realtime-backlog.md`; sha256 `fa6d2a75896f84556a9e64626ad72ce06049980212003ff17a8562a01aad2cf8`, 32 lines / 2007 bytes)

```diff
diff --git a/docs/product/realtime-backlog.md b/docs/product/realtime-backlog.md
new file mode 100644
index 0000000..a202831
--- /dev/null
+++ b/docs/product/realtime-backlog.md
@@ -0,0 +1,26 @@
+# Real-Time Feature Backlog
+
+> Provisional direction — **not commitments**. Nothing here is promised, scheduled, or approved.
+
+This file exists so that online and real-time feature ideas raised in conversation are captured in one visible place as direction, instead of being lost or silently treated as planned work.
+
+## Candidates from the request
+
+- **Live statistics** — shared stats that update live and are visible to connected players.
+- **Other users' clicks** — seeing other connected players' click activity as it happens.
+- **Connected users** — seeing which players are currently connected to the game.
+
+The request's "etc." stays open: further candidates are added here at the user's discretion.
+
+## Proposed additions (unconfirmed — not requested, not committed)
+
+- **Global live counter** — one shared counter incremented by every player's clicks.
+- **Live leaderboard** — a running ranking of players by score or activity.
+- **Community milestones** — shared goals that unlock once the community reaches a collective total.
+
+## Open tensions
+
+- **Identity vs. "no accounts required".** Presence and attribution imply some notion of a user or session, which can collide with the vision's "no accounts required" principle; this must be reconciled before any presence or attribution feature is scoped. Flagged here, not resolved.
+- **Server authority.** Anything shared across clients has one authoritative source, and values reported by a client are never treated as truth. How that is structured is a design question for whichever feature needs it.
+
+Items become real only through the normal feature-request workflow (spec → plan → build). Until then this list is direction only. The user owns this list and may add, reword, or remove entries at will.
```

### 3.2 Modified-lines diff — `docs/product/vision.md`

(`git diff --cached -- docs/product/vision.md`; sha256 `1efcda3b2ad81993ce46c6f6caa07f6e8e7c959880e56a2717095ffd517055f1`, 14 lines / 540 bytes)

```diff
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

Diff shape: exactly one hunk, one deletion (the pinned contract 4.A replacement line = a **modification** per the spec's accounting rule, never added/deleted content) and two additions (the replacement line + the one net-new line). No other hunk, no other path.

Diff-shape check against the plan's file inventory rows:

| File | Inventory row | Observed |
| --- | --- | --- |
| `docs/product/realtime-backlog.md` | New | `new file mode 100644`, 26 added lines, 0 deletions |
| `docs/product/vision.md` | Edit (+1 modified line, +1 added line) | 1 deletion (pinned replacement = modification) + 2 additions = +1 net-new line; single hunk; nothing else changed |

---

## 4. Committed-state evidence

Commit identity is **deliberately omitted from this file** (self-reference: a commit cannot contain its own hash; same precedent as `build-log-T0.md` §7 / `build-log-T1.md` §4). It is reported to the orchestrator in the Subagent Report and retrievable as `git rev-parse HEAD`.

Committed content is proven by content-addressed blob hashes, stable across the commit (pre-commit `git hash-object` == staged blob == post-commit `HEAD:<path>`):

T2 commit identity (recorded):

```
branch:  feat/online-realtime-workflow
parent:  d41c46542ca4ff18ab36166b03fd53b41941d41f  (T1; recorded as d41c465)
subject: docs: add provisional real-time backlog and vision direction link (T2)
hash:    omitted here (self-reference) — reported in the Subagent Report / `git rev-parse HEAD`
file list (from `git show --name-only --format=%s HEAD`):
docs/product/realtime-backlog.md
docs/product/vision.md
docs/features/online-realtime-workflow/build-log-T2.md
```

Post-commit `git show HEAD -- <paths>` reproduces the §3 diff bodies verbatim: the commit header (`commit <sha>` / Author / Date) is the only difference, and the bodies were compared with `sha256sum` immediately after the commit (staged body == shown body, `1efcda3b…` for `vision.md` and `fa6d2a75…` for `realtime-backlog.md`), plus `git rev-parse HEAD:docs/product/vision.md` == `b0d9019d…` and `git rev-parse HEAD:docs/product/realtime-backlog.md` == `a2028311…` matching §2.

---

## 5. Verify commands (tasks.md T2) — raw output

### V1 — `grep -in "not commitments\|accounts" docs/product/realtime-backlog.md` (exit 0)

```
3:> Provisional direction — **not commitments**. Nothing here is promised, scheduled, or approved.
23:- **Identity vs. "no accounts required".** Presence and attribution imply some notion of a user or session, which can collide with the vision's "no accounts required" principle; this must be reconciled before any presence or attribution feature is scoped. Flagged here, not resolved.
```

Line 3 = the pinned non-commitment phrase "not commitments" (AC-6); line 23 = the identity-vs-accounts tension (AC-10).

### V2 — `grep -in "realtime-backlog.md" docs/product/vision.md` (exit 0)

```
8:> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.
```

Single occurrence, line 8 = the one net-new line (AC-12).

### V3 (AC-12 link resolution) — link target exists

```
$ grep -o '(realtime-backlog.md)' docs/product/vision.md
(realtime-backlog.md)
$ test -f docs/product/realtime-backlog.md && echo "docs/product/realtime-backlog.md EXISTS"
docs/product/realtime-backlog.md EXISTS
$ realpath docs/product/vision.md; realpath docs/product/realtime-backlog.md
/var/home/raultorraco/Documents/Projects/CubeClicker/docs/product/vision.md
/var/home/raultorraco/Documents/Projects/CubeClicker/docs/product/realtime-backlog.md

$ python3 -c '...resolve every markdown link in vision.md relative to its own directory...'
label='realtime-backlog.md' target='realtime-backlog.md' -> docs/product/realtime-backlog.md exists=True
```

The relative link `realtime-backlog.md` in `docs/product/vision.md` resolves to `docs/product/realtime-backlog.md`, which exists (created in this task, same commit). Placement follows the spec's edge-case note (backlog created before the link is verified — T2 sequence).

### V4 — vision diff compared line-by-line against the baseline (build-start, per §1.2 the plan quote too)

```
$ diff /tmp/opencode/t2/baseline-vision.md docs/product/vision.md
7c7,8
< A web-based clicker game built and maintained by an AI-native development team.
---
> A web-based, online, real-time clicker game built and maintained by an AI-native development team.
> > **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.

$ python3 - <<'PY'  # difflib opcode map: baseline vs. new, line-by-line
...
baseline lines: 24 new lines: 25
('replace', 6, 7, ['A web-based clicker game built and maintained by an AI-native development team.'], 6, 8, ['A web-based, online, real-time clicker game built and maintained by an AI-native development team.', '> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.'])
PY
```

Line-by-line result: the **only** non-equal opcode is a single `replace` at baseline line 7 (0-based 6): baseline line 7 → new lines 7–8 (the modified One-liner line + the one net-new Direction line). **All other 22 baseline lines are byte-identical** (no other opcodes emitted). `d41c465`'s `docs/product/vision.md` additionally carries no other differences (the diff in §3.2 shows one hunk only).

### V5 (extra, AC-11 tokens) — One-liner tokens

```
$ sed -n '7p' docs/product/vision.md
A web-based, online, real-time clicker game built and maintained by an AI-native development team.
$ grep -in "online\|real-time" docs/product/vision.md
7:A web-based, online, real-time clicker game built and maintained by an AI-native development team.
8:> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.
```

### V6 (extra, AC-7/AC-8/AC-9) — backlog structure + technology-name scan

```
$ grep -n '^#\{1,6\} ' docs/product/realtime-backlog.md
1:# Real-Time Feature Backlog
7:## Candidates from the request
15:## Proposed additions (unconfirmed — not requested, not committed)
21:## Open tensions
$ grep -c '^## ' docs/product/realtime-backlog.md   -> 3
$ grep -c '^#\{1,6\} ' docs/product/realtime-backlog.md -> 4

$ grep -in "live statistics\|other users' clicks\|connected users" docs/product/realtime-backlog.md
9:- **Live statistics** — shared stats that update live and are visible to connected players.
10:- **Other users' clicks** — seeing other connected players' click activity as it happens.
11:- **Connected users** — seeing which players are currently connected to the game.

$ grep -in "etc\." docs/product/realtime-backlog.md
13:The request's "etc." stays open: further candidates are added here at the user's discretion.

$ grep -in "global live counter\|live leaderboard\|community milestones\|unconfirmed" docs/product/realtime-backlog.md
15:## Proposed additions (unconfirmed — not requested, not committed)
17:- **Global live counter** — one shared counter incremented by every player's clicks.
18:- **Live leaderboard** — a running ranking of players by score or activity.
19:- **Community milestones** — shared goals that unlock once the community reaches a collective total.

$ grep -in "server authority\|authoritative" docs/product/realtime-backlog.md
24:- **Server authority.** Anything shared across clients has one authoritative source, and values reported by a client are never treated as truth. How that is structured is a design question for whichever feature needs it.

$ grep -in "user owns this list\|normal feature-request" docs/product/realtime-backlog.md
26:Items become real only through the normal feature-request workflow (spec → plan → build). Until then this list is direction only. The user owns this list and may add, reword, or remove entries at will.

$ grep -in "react|vue|angular|svelte|node.js|deno|bun|socket.io|express|django|spring|rust|nginx|apache|postgres|redis|mongo|docker|cloudflare|vercel|firebase|aws|npm|yarn|pnpm|vite|webpack|websocket|framework|library|runtime|vendor|package" docs/product/realtime-backlog.md
(no output)  # exit 1 = no matches

$ grep -in "schema|API|endpoint|architecture|implement|deploy|server-side code" docs/product/realtime-backlog.md
(no output)  # exit 1 = no matches
```

### V7 (extra, AC-24 / scope) — no `.opencode/**` path touched by T2

```
$ git diff --cached --name-only
docs/product/realtime-backlog.md
docs/product/vision.md
$ git diff --name-only -- .opencode/
(empty)
```

No `permissions:` block or allow/deny entry is touched by T2 (AC-24); T2 stages only its three `files_owned` paths.

---

## 6. Staging discipline

```
$ git add docs/product/vision.md docs/product/realtime-backlog.md
$ git diff --cached --name-only
docs/product/realtime-backlog.md
docs/product/vision.md
$ git add docs/features/online-realtime-workflow/build-log-T2.md
$ git diff --cached --name-only
docs/product/realtime-backlog.md
docs/product/vision.md
docs/features/online-realtime-workflow/build-log-T2.md
```

Explicit-path `git add` only — no `git add .` / `git add -A`. Left untouched and unstaged: the pre-existing `docs/features/project-glossary/status.md` modification and all untracked artifacts (`docs/features/online-realtime-workflow/{spec,plan,tasks,status}.md`, `reviews/`, `docs/features/project-glossary/**` — planner/orchestrator-owned). No push.

---

## 7. Backlog structure audit (AC-8 closed section set)

Headings: exactly one H1 (`# Real-Time Feature Backlog`) + exactly three `##` sections — `Candidates from the request`, `Proposed additions (unconfirmed — not requested, not committed)`, `Open tensions`. No other heading level anywhere (V6: 4 headings total).

Block-level map (blank-line separated blocks; computed over the file):

```
block 1: line 1        :: H1 title
block 2: line 3        :: blockquote — "Provisional direction — **not commitments**. …"
block 3: line 5        :: one-line "why this file exists" paragraph
block 4: line 7        :: ## Candidates from the request
block 5: lines 9-11    :: three single-line candidate bullets
block 6: line 13       :: "etc." stays-open note (paragraph, not a section)
block 7: line 15       :: ## Proposed additions (unconfirmed — not requested, not committed)
block 8: lines 17-19   :: three single-line proposals
block 9: line 21       :: ## Open tensions
block 10: lines 23-24  :: two single-line tension bullets (identity/accounts; server authority)
block 11: line 26      :: closing non-commitment rule (paragraph, not a section)
```

Every block maps 1:1 to an element enumerated in plan contract item 3; there are no extra sections, headings, tables, code fences, or horizontal rules. No implementation planning (no architecture, messages, APIs, or designs — V6 scan clean); no framework/library/runtime/vendor names (V6 scan clean; "WebSocket" does not appear at all).

---

## Acceptance audit

- **AC-6 — met.** `docs/product/realtime-backlog.md` exists and contains the pinned phrase "not commitments" (`realtime-backlog.md:3`, V1 line 3: `> Provisional direction — **not commitments**. Nothing here is promised, scheduled, or approved.`).
- **AC-7 — met.** The three candidates from the request are listed, one line each: live statistics (l.9), other users' clicks (l.10), connected users (l.11) — V6, §7 block 5.
- **AC-8 — met.** Section set is enumerable and matches the pinned closed set exactly: H1 + the three `##` sections, with the blockquote, the one-line "why" paragraph, the "etc." note, and the closing rule as the only other block elements (§7 map; V6 heading greps: 4 headings, 3 `##`). No framework/library/runtime/package/vendor is named (V6 scan: no matches; "WebSocket" absent). No implementation planning, no stack/library names.
- **AC-9 — met.** Every entry not named in the original request is explicitly marked as an unconfirmed proposal on two levels: the section heading itself (`## Proposed additions (unconfirmed — not requested, not committed)`, l.15) and the file-level non-commitment blockquote (l.3) + closing rule (l.26). The three proposals are global live counter (l.17), live leaderboard (l.18), community milestones (l.19).
- **AC-10 — met.** The identity tension is flagged and "accounts" is mentioned: `realtime-backlog.md:23` — presence/attribution "can collide with the vision's 'no accounts required' principle; this must be reconciled before any presence or attribution feature is scoped. Flagged here, not resolved." (V1 line 23; also references the vision principle by quote). Server-authority tension is the companion one-liner at l.24.
- **AC-11 — met.** `vision.md:7` One-liner = `A web-based, online, real-time clicker game built and maintained by an AI-native development team.` (contains "online" and "real-time"; V5). Relative to the build-start baseline (= the re-verified plan quote; equivalence recorded in §1.2), it is the **only** modified line — one pinned in-place modification (contract 4.A), counted as a modification per the accounting rule (§3.2: 1 deletion/1 addition on that line; §5 V4: single `replace` opcode, all other 22 baseline lines byte-identical).
- **AC-12 — met.** `vision.md` has exactly **one** net-new added line: `vision.md:8` = `> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.` — a Markdown link whose label (`realtime-backlog.md`) references the backlog/direction. It resolves to the created `docs/product/realtime-backlog.md` (V3, `exists=True`) and there is no other added content (§3.2 / V4: single hunk; net additions = 1 line). All other pre-existing content is unchanged vs. the baseline.
- **AC-24 (T2 scope) — met / not implicated.** T2 touches no `permissions:` block or allow/deny entry; the T2 diff lists only `docs/product/realtime-backlog.md`, `docs/product/vision.md`, and this log (V7, §3).
- **AC-25 (T2 scope) — met.** Diffs vs. the build-start baselines (§1, §3) contain exactly contract items 3–4's content: the new backlog file (all 26 lines are contract-3 elements — §7) plus the one pinned in-place One-liner modification + the one net-new link line, with no unrelated or drive-by edits and no removals other than the pinned contract 4.A replacement line.

Contract-token audit (plan § Pinned content contracts items 3–4):

| Required token / concept | Where |
| --- | --- |
| H1 title | `realtime-backlog.md:1` |
| blockquote "Provisional direction — **not commitments**" | `realtime-backlog.md:3` |
| short "why this file exists" paragraph | `realtime-backlog.md:5` |
| `## Candidates from the request` | `realtime-backlog.md:7` |
| live statistics / other users' clicks / connected users (one line each) | `realtime-backlog.md:9–11` |
| request's "etc." stays open | `realtime-backlog.md:13` |
| `## Proposed additions (unconfirmed — not requested, not committed)` | `realtime-backlog.md:15` |
| global live counter / live leaderboard / community milestones | `realtime-backlog.md:17–19` |
| `## Open tensions` | `realtime-backlog.md:21` |
| identity vs. "no accounts required" (mentions "accounts") | `realtime-backlog.md:23` |
| server authority one-liner | `realtime-backlog.md:24` |
| closing non-commitment rule (real only via normal feature requests; user owns the list) | `realtime-backlog.md:26` |
| exactly three `##` sections + H1, no other headings | V6 / §7 |
| no stack/library names; no implementation planning | V6 scans (no matches) |
| One-liner: "online", "real-time" | `vision.md:7` |
| exactly one added line, immediately after the One-liner paragraph, linking `realtime-backlog.md` | `vision.md:8` (§3.2: single hunk, +1 net-new line) |

## Tests

None — no automated commands exist (`AGENTS.md` § Commands: TBD; stack NOT DECIDED, per spec § Testing strategy). Verification is inspection + `grep`/`git diff`/`python3` aids, as the spec requires. No application code, dependency, or tooling was introduced.

## Deviations from spec

None in content or scope.

Notes (not deviations):
- This is a product-direction documentation change (no runtime behavior); the "tests accompany every behavior change" convention has no applicable artifact here, consistent with spec § Testing strategy / § Non-goals.
- The commit hash is reported out-of-band (Subagent Report) rather than embedded here — a commit cannot contain its own hash (T0/T1 precedent).
- `python3`/`sha256sum`/`grep`/`git` were used strictly as build-time inspection aids — no tooling choice is introduced; stack remains NOT DECIDED.
