# Build log — T2 — Link the glossary from `docs/product/vision.md`

Task: T2 (`docs/features/project-glossary/tasks.md`), 2026-10-17
Files changed: `docs/product/vision.md` (+1 line), `docs/features/project-glossary/build-log-T2.md` (new)
What changed & why (sketch, ≤5 lines):
1. Preflight: branch/tip/baseline captured (committed vs. working tree identical for `vision.md`).
2. One line added as the new line 4, immediately below the opening blockquote (line 3), no blank line inserted.
3. The line is the plan's Vision link contract line, verbatim, with the relative sibling target `glossary.md`.
4. Nothing else touched: no reflow, no rewording, no other file (the glossary from T1 was not modified).
5. Evidence recorded below; AC-13 audited.

Decisions: use the contract line exactly as quoted in `plan.md` § Interfaces / contracts → "Vision link contract" (the brief's mandated text), placed immediately after the opening blockquote per the contract's placement rule. Baseline = committed content at T2 start, which was verified equal to the plan quote; no conflict arose, so the operational rule did not need to override the quote.

## Preflight / baseline

- Branch: `git rev-parse --abbrev-ref HEAD` → `feat/project-glossary` ✅
- Tip: `git rev-parse HEAD` → `e16f281c2be8d053206721301a15937af2ccd6ad` — **matches the expected `e16f281`**; `git log --oneline -3` → `e16f281 docs: add canonical project glossary (T1)`, `02a9471 Containerized status`, `cbee867 docs: record containerized-workflow artifacts and acceptance`.
- Working tree at build start (`git status --porcelain`):
  - ` M docs/features/project-glossary/plan.md`
  - ` M docs/features/project-glossary/status.md`
  - ` M docs/features/project-glossary/tasks.md`
  - Planner/orchestrator folds, **left exactly as-is; never staged, never committed**. **No working-tree modification of `docs/product/vision.md`** (see the two-way baseline check below) → preflight proceeded; no `blocked` condition.
- Baseline, both ways (expected identical — they are):
  - Committed: `git show HEAD:docs/product/vision.md | sha256sum` → `d958c39b239ec021ed966607e46b30f735c7527bf33e54008c8f395f67907e24`
  - Working tree: `sha256sum docs/product/vision.md` → `d958c39b239ec021ed966607e46b30f735c7527bf33e54008c8f395f67907e24`
  - `git diff --exit-code -- docs/product/vision.md` → no output, exit 0 (`IDENTICAL: no working-tree diff`)
  - Line count both ways: `24` (`git show HEAD:docs/product/vision.md | wc -l` → `24`; `wc -l docs/product/vision.md` → `24`)
- Quote check: committed baseline was diffed against the plan's quoted block (`plan.md` lines 78–101, extracted with `sed -n '78,101p'` into `plan-quote.txt`): `diff plan-quote.txt baseline.txt` → no output → **QUOTE MATCHES COMMITTED BASELINE EXACTLY**. So the plan quote is an accurate baseline and the operational rule ("baseline governs if it differs") did not change anything. Note: the committed baseline already contains the two online-realtime-workflow pre-existing changes described in the plan (the modified One-liner and the `> **Direction:**` line, which sits directly under the One-liner at line 8) — both treated as pre-existing baseline content, untouched.

### Baseline — `docs/product/vision.md` (verbatim, `git show HEAD:docs/product/vision.md`, 24 lines)

```markdown
# CubeClicker — Product Vision

> Living document. The user owns the vision; agents read it as the north star. Updates flow through feature requests.

## One-liner

A web-based, online, real-time clicker game built and maintained by an AI-native development team.
> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.

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

## Exact added line

Inserted as new line 4 (file is now 25 lines), immediately below the opening blockquote, no blank line between:

```markdown
> **Terminology:** canonical domain terms are defined in [glossary.md](glossary.md).
```

## Evidence

Verification is inspection-only (no project commands exist — `AGENTS.md` § Commands TBD; stack NOT DECIDED). `git`/`sed`/`wc`/`diff` are cited as inspection aids only.

- `git diff -- docs/product/vision.md` (raw):

```
diff --git a/docs/product/vision.md b/docs/product/vision.md
index b0d9019..219eae6 100644
--- a/docs/product/vision.md
+++ b/docs/product/vision.md
@@ -1,6 +1,7 @@
 # CubeClicker — Product Vision
 
 > Living document. The user owns the vision; agents read it as the north star. Updates flow through feature requests.
+> **Terminology:** canonical domain terms are defined in [glossary.md](glossary.md).
 
 ## One-liner
 
```

- `git diff --stat -- docs/product/vision.md` → ` docs/product/vision.md | 1 +` / `1 file changed, 1 insertion(+)` ✅ (1 file, +1)
- `git diff --numstat -- docs/product/vision.md` → `1	0	docs/product/vision.md` (added = 1, removed = 0; zero modifications — a modification would appear as a `+`/`-` pair, which is absent) ✅
- Line delta: 24 → 25 (`wc -l docs/product/vision.md` → `25`) ✅
- Non-destructiveness proof (independent of the diff): `sed '4d' docs/product/vision.md | diff /tmp/opencode/baseline.txt -` → no output → **ALL PRE-EXISTING CONTENT IDENTICAL (byte-for-byte)**; i.e. removing the single added line reproduces the committed baseline exactly.
- Head of file after the edit: `sed -n '1,6p' docs/product/vision.md` →

```
# CubeClicker — Product Vision

> Living document. The user owns the vision; agents read it as the north star. Updates flow through feature requests.
> **Terminology:** canonical domain terms are defined in [glossary.md](glossary.md).

## One-liner
```

- Link target exists (relative sibling of `vision.md`):
  - `ls -l docs/product/glossary.md` → `-rw-r--r--. 1 raultorraco raultorraco 2557 Oct 17 11:42 docs/product/glossary.md` ✅
  - `git show HEAD:docs/product/glossary.md` → succeeds (tracked at T1's commit `e16f281`; T1's build log reports 46 lines / 2557 bytes) ✅
  - `test -f docs/product/glossary.md` → true (sibling resolution: `docs/product/` + `glossary.md`) ✅
  - `git status --porcelain -- docs/product/glossary.md` → empty (T1's file unmodified by T2) ✅
- Builder allowlist preflight: `.opencode/agents/builder.md` → `grep -n 'docs/product'` → `42:    resource: "docs/product/**"` and `grep -n 'build-log'` → `21:    resource: "docs/features/**/build-log*.md"` → both owned paths are within my edit scope. ✅

## Acceptance audit

| AC | Verdict | Evidence (exact) |
| --- | --- | --- |
| AC-13 — exactly one added line in `docs/product/vision.md`: a Markdown link whose target is `glossary.md` (relative sibling) and whose visible label references the glossary/terminology; all pre-existing content unchanged vs. the plan baseline | met | Added line 4: `> **Terminology:** canonical domain terms are defined in [glossary.md](glossary.md).` — one line, containing exactly one Markdown link, target `glossary.md` (relative sibling of `vision.md`; sibling file exists and is tracked, see Evidence), visible label "glossary.md" + bolded `**Terminology:**` word → references the glossary/terminology. Count/scope: `git diff --numstat` → `1 0` (one addition, zero removals/modifications); `git diff --stat` → `1 file changed, 1 insertion(+)`. `git diff --name-only` (all tracked/unstaged paths) → `docs/features/project-glossary/plan.md`, `docs/features/project-glossary/status.md`, `docs/features/project-glossary/tasks.md`, `docs/product/vision.md` — the first three are the pre-existing planner/orchestrator folds (unmodified by me, deliberately left uncommitted), so the only file **I** changed is `docs/product/vision.md`. Non-destructiveness: `sed '4d' docs/product/vision.md | diff baseline.txt -` → identical (byte-for-byte); committed baseline itself matched the plan quote verbatim (`diff` of `plan.md` lines 78–101 vs. `git show HEAD:docs/product/vision.md` → no output). |

Acceptance audit: AC-13 → met (see table above). T2 accepts only AC-13; T3 runs the full AC-1…AC-13 pass.

## Scope / constraints audit

- Touched only the two owned paths: `docs/product/vision.md` and `docs/features/project-glossary/build-log-T2.md`. Staged pathspec = exactly these two; commit uses an explicit pathspec (no `git add .`/`-A`).
- Exactly one added line; no line added, removed, reflowed, rewrapped, or "fixed" anywhere else (proved by the `sed '4d'` ↔ baseline diff).
- `docs/product/glossary.md` (T1) not modified: `git status --porcelain -- docs/product/glossary.md` → empty.
- No edits to `AGENTS.md`, `.opencode/**`, `docs/architecture/**`, `src/`, `tests/`, `public/`, other features' files, or `.env*`. No dependencies, tooling, code, tests, or config added (documentation-only; stack NOT DECIDED).
- Orchestration artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/**`) left byte-identical; their pre-existing uncommitted edits remain uncommitted.
- No secret material in the added line; link is a relative repo path (no external URL).

Deviations from spec/plan: none.
