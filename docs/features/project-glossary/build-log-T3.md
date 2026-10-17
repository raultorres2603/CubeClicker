# Build log — T3 — Verify & integrate

Task: T3 (`docs/features/project-glossary/tasks.md`), 2026-10-17
Files changed: `docs/features/project-glossary/build-log-T3.md` (new) — verification only; no product file touched
What changed & why (sketch, ≤5 lines):
1. Preflight: branch/tip/deliverable-cleanliness/fold-state confirmed and recorded.
2. Independent re-inspection of `docs/product/glossary.md` with a fresh ad-hoc checker (not T1's script) → AC-1…AC-12.
3. Independent re-inspection of `docs/product/vision.md` against its parent commit `e16f281` and against the plan r2 baseline quote → AC-13.
4. Link resolution checked (relative sibling target exists and is tracked).
5. Evidence recorded below; every verdict re-derived from current file contents.

Decisions: verification-only task — no file outside `build-log-T3.md` written; AC verdicts derived from current working-tree/committed bytes, with prior build logs used only as pointers. Counting followed the plan r2 § Interfaces / contracts counting rule (definition/example caps count the text **after** the label; total caps count all content; whole-token clause for AC-8 applies to the **term as a whole phrase**, so `idle progress` / `offline progress` are matched as phrases, not as two independent tokens).

Verification is inspection-only (no project commands exist — `AGENTS.md` § Commands TBD; stack NOT DECIDED). `git`, `wc`, `ls`, `grep`, `diff`, `sed`, and `python3` below are inspection aids only, not project commands. Python was run from stdin (`python3 - <<'PY'`) because ad-hoc scratch writes outside `docs/features/**/build-log*.md` are outside the builder allowlist.

## Preflight

| Check | Command | Result |
| --- | --- | --- |
| Branch | `git rev-parse --abbrev-ref HEAD` | `feat/project-glossary` ✅ (expected) |
| Tip | `git rev-parse HEAD` | `f0a141fa530b452c803aacb4e4c2306c5b776cde` → `f0a141f` ✅ (expected `f0a141f`); `git log --oneline -5` → `f0a141f docs: link glossary from vision.md (T2)`, `e16f281 docs: add canonical project glossary (T1)`, `02a9471 Containerized status`, … |
| Deliverables unmodified in worktree | `git diff --exit-code -- docs/product/glossary.md docs/product/vision.md` | no output, `exit=0` (clean) ✅; also `git diff HEAD --exit-code -- docs/product/glossary.md docs/product/vision.md` → no output, `exit=0` |
| Orchestration folds left uncommitted | `git status --porcelain` | ` M docs/features/project-glossary/plan.md`, ` M docs/features/project-glossary/status.md`, ` M docs/features/project-glossary/tasks.md` — the three expected folds, **untouched, unstaged, left as-is** ✅ |
| Branches | `git branch -vv` | `* feat/project-glossary f0a141f docs: link glossary from vision.md (T2)`, `main 02a9471 [origin/main] Containerized status` ✅ (no divergence surprise; `main` untouched) |
| Feature-range diff (integration scope) | `git diff --name-status 02a9471 f0a141f` | `A docs/features/project-glossary/build-log-T1.md`, `A docs/features/project-glossary/build-log-T2.md`, `A docs/product/glossary.md`, `M docs/product/vision.md` — exactly the two deliverables + two build logs, nothing else ✅ |
| Link resolution | `test -f docs/product/glossary.md` → true; `git ls-files docs/product/` → `docs/product/glossary.md`, `docs/product/realtime-backlog.md`, `docs/product/vision.md` | relative sibling target of `[glossary.md](glossary.md)` in `docs/product/vision.md` exists and is tracked ✅ |

## AC-1 … AC-13 verdict table (independently re-derived)

| AC | Verdict | Evidence (exact, from current bytes) |
| --- | --- | --- |
| **AC-1** — `docs/product/glossary.md` exists at that exact path | **met** | `ls -l docs/product/glossary.md` → `-rw-r--r--. 1 raultorraco raultorraco 2557 Oct 17 11:42 docs/product/glossary.md`; `git ls-files docs/product/` → `docs/product/glossary.md` is tracked ✅ |
| **AC-2** — exactly one H1 heading (document title) | **met** | `grep -c '^# ' docs/product/glossary.md` → `1`; the single H1 is line 1: `# CubeClicker — Glossary`. Heading inventory (`^#{1,6} `): only line 1, line 6 (`## Terms`), and the eight H3 term lines; `grep -c '^#### '` → `0` (no H4+). No frontmatter: `sed -n '1p'` → `# CubeClicker — Glossary` (file opens with the H1) |
| **AC-3** — between H1 and first term entry, a usage note states the listed terms are the canonical CubeClicker terminology | **met** | Intro occupies lines 3–4, i.e. after the H1 (line 1) and before the first term entry (`### click`, line 8). Line 3 verbatim: `The terms in this glossary are the canonical CubeClicker terminology.` (`canonical` present, `terminology` present) ✅ |
| **AC-4** — usage note states docs and agents should use the terms as defined in this glossary | **met** | Line 4 verbatim: `Docs and agents should use these terms as defined here rather than informal synonyms, and new terms or changed meanings should be added to this file in the same change that introduces them.` Contains `Docs` ✅, `agents` ✅, `should use these terms as defined here` ✅ (`here` = this glossary; the sentence sits inside the glossary file directly under its H1) |
| **AC-5** — exactly the eight required H3 entries, exact spellings, no others | **met** | `grep -n '^### '` → `8:### click`, `13:### cube`, `18:### idle progress`, `23:### offline progress`, `28:### points`, `33:### prestige`, `38:### save`, `43:### upgrade`; `grep -c '^### '` → `8`; set equality against `[cube, click, points, upgrade, idle progress, offline progress, save, prestige]` → `True`; every heading matched its required spelling exactly (all lowercase; `points` plural); no other `###` heading anywhere in the file ✅ |
| **AC-6** — entries in alphabetical order | **met** | H3 order: `click, cube, idle progress, offline progress, points, prestige, save, upgrade`; `names == sorted(names)` → `True`. Multiword `idle progress` correctly sorts between `cube` and `offline progress` ✅ |
| **AC-7** — every entry contains both `Definition:` and `Example:`, both populated | **met** | `grep -c '^\*\*Definition:\*\*'` → `8`; `grep -c '^\*\*Example:\*\*'` → `8`. Per-entry block parse: each of the eight entries has exactly one `**Definition:**` line and exactly one `**Example:**` line, both non-empty after the label, and **zero stray non-blank body lines** (`stray=[]` for all eight) ✅ |
| **AC-8** — every example uses its term (whole-token, case-insensitive; inflections count) | **met** | Per-entry check, `uses_term=True` for all eight. Single-word terms matched as whole tokens with inflections: `click`→`click`; `cube`→`cube`; `points`→`points` (singular `point` accepted); `prestige`→`prestige`; `save`→`save`; `upgrade`→`upgrade`. Multiword terms matched as whole phrases (case-insensitive): `idle progress`→`Idle progress`; `offline progress`→`offline progress`. Examples verbatim: `One click on the cube adds a point to the total.`; `Clicking the cube is the fastest way to earn your first points.`; `Idle progress keeps earning points while the game is open and you stop clicking.`; `When you return after a break, offline progress grants the points you would have earned.`; `Each click adds points that you can save for your next upgrade.`; `A player may choose to prestige, trading the current run for a permanent bonus.`; `The game writes a save so your points survive a reload.`; `Buying an upgrade with points makes every future click more valuable.` No unrelated substrings: `grep -in 'disappoint\|clicksum\|pointed' …` → no match (`exit=1`) ✅ |
| **AC-9** — `idle progress` and `offline progress` definitions each name the other term | **met** | `idle progress` definition contains `it is distinct from offline progress.` → names-other = `True`; `offline progress` definition contains `it is distinct from idle progress.` → names-other = `True`. The distinguishing axis is also stated (open/game-running + present-but-not-clicking vs. away/not running) ✅ |
| **AC-10** — each definition ≤ 2 sentences and ≤ 40 words | **met** | Text-after-label counts — click 31w/2s, cube 27w/2s, idle progress 35w/2s, offline progress 31w/2s, points 23w/2s, prestige 30w/2s, save 22w/2s, upgrade 26w/2s. Max 35 words (≤ 40), max 2 sentences (≤ 2); violations list `none`. Sentence count is unambiguous: `grep -n 'e\.g\.\|i\.e\.' docs/product/glossary.md` → no match (`exit=1`) ✅ |
| **AC-11** — each example exactly one sentence and ≤ 25 words | **met** | Text-after-label counts — 11, 12, 14, 15, 12, 14, 11, 11 words; sentence count = 1 for all eight; max 15 words (≤ 25); violations list `none` ✅ |
| **AC-12** — file ≤ 100 lines and ≤ 700 words total | **met** | `wc -l -w -c docs/product/glossary.md` → `46  408 2557 docs/product/glossary.md` → 46 lines ≤ 100, 408 words ≤ 700 (total-file caps count all content, per the counting rule) ✅ |
| **AC-13** — `docs/product/vision.md` contains exactly one added line: a Markdown link whose target is `glossary.md` (relative sibling) and whose visible label references the glossary/terminology; all pre-existing content unchanged vs. the plan baseline | **met** | See the dedicated section below ✅ |

## AC-13 — vision.md detail

**(a) Exactly +1 / −0 relative to the T2 parent commit `e16f281`:**

```
$ git diff --numstat e16f281 f0a141f -- docs/product/vision.md
1	0	docs/product/vision.md
$ git diff --stat e16f281 f0a141f -- docs/product/vision.md
 docs/product/vision.md | 1 +
 1 file changed, 1 insertion(+)
$ git diff -U0 e16f281 f0a141f -- docs/product/vision.md | grep -E '^[+-][^+-]'
+> **Terminology:** canonical domain terms are defined in [glossary.md](glossary.md).
```

One changed line, `+1`/`−0`; the only line-level change in the whole commit range diff for `vision.md` is the single `+` line. Line count 24 (`e16f281`) → 25 (`f0a141f`).
(For the record, the T2 commit `f0a141f` also adds `docs/features/project-glossary/build-log-T2.md` — `git show --name-status f0a141f` → `A build-log-T2.md`, `M docs/product/vision.md`; AC-13 concerns `vision.md` only.)

**(b) Non-destructive proof — removing the added line restores the baseline byte-for-byte:**

```
$ git show f0a141f:docs/product/vision.md | sed '4d' > /tmp/opencode/t3/v-t3-sed4.txt
$ git show e16f281:docs/product/vision.md      > /tmp/opencode/t3/v-parent.txt
$ diff /tmp/opencode/t3/v-t3-sed4.txt /tmp/opencode/t3/v-parent.txt   # no output
sed-proof diff exit: 0
$ sha256sum /tmp/opencode/t3/v-t3-sed4.txt /tmp/opencode/t3/v-parent.txt
d958c39b239ec021ed966607e46b30f735c7527bf33e54008c8f395f67907e24  /tmp/opencode/t3/v-t3-sed4.txt
d958c39b239ec021ed966607e46b30f735c7527bf33e54008c8f395f67907e24  /tmp/opencode/t3/v-parent.txt
```

Identical hashes ⇒ deleting line 4 from the tip reproduces the parent commit's `vision.md` byte-for-byte: all pre-existing content is unchanged.

**(c) The added line is a Markdown link with a terminology/glossary label:**

```
$ git show f0a141f:docs/product/vision.md | sed -n '4p'
> **Terminology:** canonical domain terms are defined in [glossary.md](glossary.md).
$ git show f0a141f:docs/product/vision.md | sed -n '4p' | grep -o '\[[^]]*\]([^)]*)'
[glossary.md](glossary.md)
```

One link; target = `glossary.md` (relative sibling — resolves to `docs/product/glossary.md`, which exists and is tracked, see Preflight "Link resolution"); visible label = `glossary.md` plus the bolded `**Terminology:**` marker ⇒ references the glossary/terminology ✅. Placement matches the plan r2 Vision link contract (immediately after the opening blockquote, no blank line inserted).

**(d) Compared against the plan r2 baseline quote:**

```
$ sed -n '78,101p' docs/features/project-glossary/plan.md > /tmp/opencode/t3/plan-quote.txt
$ git show e16f281:docs/product/vision.md                > /tmp/opencode/t3/v-baseline.txt
$ diff /tmp/opencode/t3/plan-quote.txt /tmp/opencode/t3/v-baseline.txt   # no output
PLAN QUOTE vs e16f281 BASELINE: identical (exit 0)
$ diff /tmp/opencode/t3/plan-quote.txt /tmp/opencode/t3/v-t3-sed4.txt    # no output
PLAN QUOTE vs (tip minus added line): identical (exit 0)
```

The plan r2 § Interfaces / contracts baseline quote (plan.md lines 78–101) matches both the `e16f281` baseline and the tip with line 4 removed, byte-for-byte ⇒ the plan quote is an accurate baseline and the operational rule ("baseline governs if it differs") had nothing to override. Content already present at baseline (the online-realtime-workflow One-liner change and the `> **Direction:**` line) is intact and untouched.

## Raw inspection aids used

- `wc -l -w -c docs/product/glossary.md` → `46  408 2557 docs/product/glossary.md`
- `grep -c '^# ' docs/product/glossary.md` → `1`; `grep -c '^#### ' …` → `0`
- `grep -n '^### ' docs/product/glossary.md` → 8 H3 lines (8/13/18/23/28/33/38/43)
- `grep -c '^\*\*Definition:\*\*' …` → `8`; `grep -c '^\*\*Example:\*\*' …` → `8`
- `grep -n 'e\.g\.\|i\.e\.' …` → no match (`exit=1`)
- `ls -l docs/product/glossary.md`; `test -f docs/product/glossary.md`; `git ls-files docs/product/`
- `git diff --exit-code -- docs/product/glossary.md docs/product/vision.md` → clean (`exit=0`)
- `git diff --numstat|--stat|-U0 e16f281 f0a141f -- docs/product/vision.md`
- `git show f0a141f:docs/product/vision.md | sed '4d'` vs `git show e16f281:docs/product/vision.md` → `diff`/`sha256sum` identical
- `sed -n '78,101p' docs/features/project-glossary/plan.md` vs `git show e16f281:docs/product/vision.md`
- `git show --name-status e16f281 f0a141f`; `git diff --name-status 02a9471 f0a141f`
- Ad-hoc `python3` re-check (stdin, independent of T1's script): heading inventory, intro-region extraction, per-entry field/stray-line parse, phrase-aware whole-token term match, per-entry word/sentence counts, total caps.

## Independent counting table (re-derived; T1's numbers reproduced, not reused)

| term | def words | def sentences | example words | example sentences | example uses term | fields populated |
| --- | --- | --- | --- | --- | --- | --- |
| click | 31 | 2 | 11 | 1 | yes (`click`) | yes |
| cube | 27 | 2 | 12 | 1 | yes (`cube`) | yes |
| idle progress | 35 | 2 | 14 | 1 | yes (phrase `Idle progress`) | yes |
| offline progress | 31 | 2 | 15 | 1 | yes (phrase `offline progress`) | yes |
| points | 23 | 2 | 12 | 1 | yes (`points`) | yes |
| prestige | 30 | 2 | 14 | 1 | yes (`prestige`) | yes |
| save | 22 | 2 | 11 | 1 | yes (`save`) | yes |
| upgrade | 26 | 2 | 11 | 1 | yes (`upgrade`) | yes |

Caps: definition max 35/40 words and 2/2 sentences; example max 15/25 words and exactly 1 sentence each; file 46/100 lines and 408/700 words. All with slack.

## Scope / constraints audit

- Wrote exactly one file: `docs/features/project-glossary/build-log-T3.md`. Staged pathspec will be exactly that path (no `git add .` / `-A`).
- `docs/product/glossary.md` and `docs/product/vision.md` **not modified** by T3 (`git diff --exit-code -- …` clean before and after the inspection pass).
- `spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/**` untouched: the three pre-existing uncommitted folds remain uncommitted and unstaged (`git status --porcelain` after the commit shows the same three ` M` entries plus nothing else).
- No edits to `AGENTS.md`, `.opencode/**`, `docs/architecture/**`, `src/`, `tests/`, `public/`, other features' files, or `.env*`. No dependencies, tooling, code, tests, config, or stack assumptions introduced (documentation-only feature; stack NOT DECIDED — AC verification is inspection-only and no project commands were run as if they existed).
- No fixes applied: nothing needed fixing; no AC was unmet.

## Deviations from spec/plan

None. T3 is a verification gate; all 13 acceptance criteria verified met from current file contents, with no hidden caveats. (One checker artifact was found and corrected during the pass — a naive *single-token* AC-8 check falsely flagged the two multiword terms; re-run with phrase-aware matching per the counting rule's whole-token clause gave `True` for all eight. Recorded for transparency; it is a bug in my ad-hoc checker, not in the deliverable.)
