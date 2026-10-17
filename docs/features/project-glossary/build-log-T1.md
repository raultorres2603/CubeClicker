# Build log — T1 — Author `docs/product/glossary.md`

Task: T1 (`docs/features/project-glossary/tasks.md`), 2026-10-17
Files changed: `docs/product/glossary.md` (new), `docs/features/project-glossary/build-log-T1.md` (new)
What changed & why (sketch, ≤5 lines):
1. Pinned template applied: one H1 title, intro usage note (canonical + use-as-defined rule), `## Terms`, eight H3 entries.
2. Entries in alphabetical order: click, cube, idle progress, offline progress, points, prestige, save, upgrade.
3. Each entry carries exactly `**Definition:**` and `**Example:**`, written from the plan's semantic-anchor table (wording-level only).
4. `idle progress` and `offline progress` each name the other term in their definition (AC-9).
5. Wording kept short so per-entry caps (AC-10/AC-11) and total caps (AC-12) pass with slack; no abbreviations inside entries.
Decisions: none beyond the pinned contracts (plan r2 § Interfaces / contracts); no mechanics, no synonym vocabulary, no extra terms. Per the counting rule, definition/example caps count the text after the label; total caps count all content.

## Preflight / baseline

- Branch and tip before branching: `git log -1 --format='%H %s'` → `02a9471f1f615dd009e0ae2e836e0d7595e457ca Containerized status` on `main` — **matches the expected `main` = `02a9471`** stated in the brief/status.md.
- Working tree at build start (`git status --porcelain=v1 -b`): `## main...origin/main` plus ` M docs/features/project-glossary/plan.md`, ` M docs/features/project-glossary/status.md`, ` M docs/features/project-glossary/tasks.md` — planner/orchestrator folds, **left exactly as-is; never staged or committed**.
- `feat/project-glossary` did **not** exist (`git branch -a` → `* main`, `remotes/origin/HEAD -> origin/main`, `remotes/origin/main`); no collision, branch created from `02a9471`: `git switch -c feat/project-glossary` → `Switched to a new branch 'feat/project-glossary'`.
- New-file baseline confirmed absent before authoring (AC-1 has a clean "before" state):
  - `git show HEAD:docs/product/glossary.md` → `fatal: path 'docs/product/glossary.md' does not exist in 'HEAD'`
  - `git ls-files docs/product/` → `docs/product/realtime-backlog.md`, `docs/product/vision.md` (glossary absent)
  - `ls -la docs/product/` → only `realtime-backlog.md`, `vision.md`

## Evidence

Verification is inspection-only (no project commands exist — `AGENTS.md` § Commands TBD; stack NOT DECIDED). Utilities below are cited as inspection aids only.

- `wc -l -w -c docs/product/glossary.md` → `46  408 2557 docs/product/glossary.md` (46 lines, 408 words, 2557 bytes)
- `grep -c '^# ' docs/product/glossary.md` → `1`; `grep -n '^# ' …` → `1:# CubeClicker — Glossary`
- `grep -n '^## ' docs/product/glossary.md` → `6:## Terms` (one section heading)
- `grep -n '^### ' docs/product/glossary.md` → `8:### click`, `13:### cube`, `18:### idle progress`, `23:### offline progress`, `28:### points`, `33:### prestige`, `38:### save`, `43:### upgrade`; `grep -c '^### '` → `8`
- `head -1 docs/product/glossary.md` → `# CubeClicker — Glossary` (no frontmatter; file opens with the H1)
- `sed -n '3,4p' docs/product/glossary.md` → intro usage note (verbatim):
  - `The terms in this glossary are the canonical CubeClicker terminology.`
  - `Docs and agents should use these terms as defined here rather than informal synonyms, and new terms or changed meanings should be added to this file in the same change that introduces them.`
- `grep -c '^\*\*Definition:\*\*' …` → `8`; `grep -c '^\*\*Example:\*\*' …` → `8` (both labels present once per entry, all populated)
- Whole-token term-token scan (inspection aid), `grep -io "\b<term>\b" docs/product/glossary.md`: click → 6, cube → 5, idle progress → 3 (one capitalized `Idle progress`), offline progress → 3, points → 11, prestige → 2, save → 3, upgrade → 3.
- `grep -n 'disappoint' docs/product/glossary.md` → no match ("the letters-in-another-word case does not occur"; whole-token clause satisfied by construction).
- Per-entry counting script over the file (label text only), output:

```
term | def_words | def_sent | ex_words | ex_sent | ex_uses_term
click | 31 | 2 | 11 | 1 | True
cube | 27 | 2 | 12 | 1 | True
idle progress | 35 | 2 | 14 | 1 | True
offline progress | 31 | 2 | 15 | 1 | True
points | 23 | 2 | 12 | 1 | True
prestige | 30 | 2 | 14 | 1 | True
save | 22 | 2 | 11 | 1 | True
upgrade | 26 | 2 | 11 | 1 | True
all caps + usage OK: True
```

## Acceptance audit (AC-1 … AC-12)

| AC | Verdict | Evidence (exact) |
| --- | --- | --- |
| AC-1 — file exists at `docs/product/glossary.md` | met | `ls -l docs/product/glossary.md` → `-rw-r--r--. 1 raultorraco raultorraco 2557 Oct 17 11:42 docs/product/glossary.md`; absent before authoring (`git show HEAD:…` → `fatal: path 'docs/product/glossary.md' does not exist in 'HEAD'`) |
| AC-2 — exactly one H1 | met | `grep -c '^# '` → `1`; the single H1 is line 1: `# CubeClicker — Glossary` |
| AC-3 — usage note before first entry stating canonical terminology | met | lines 3–4 sit between the H1 (line 1) and the first H3 (line 8); line 3: `The terms in this glossary are the canonical CubeClicker terminology.` |
| AC-4 — usage note says docs and agents use terms as defined here | met | line 4: `Docs and agents should use these terms as defined here rather than informal synonyms, and new terms or changed meanings should be added to this file in the same change that introduces them.` |
| AC-5 — exactly the eight required H3 entries, no others | met | `grep -c '^### '` → `8`; headings: `click`, `cube`, `idle progress`, `offline progress`, `points`, `prestige`, `save`, `upgrade` (lowercase spellings as listed); no other `###` heading in the file |
| AC-6 — alphabetical order | met | H3 line order 8,13,18,23,28,33,38,43 → click, cube, idle progress, offline progress, points, prestige, save, upgrade (multiword `idle progress` correctly between `cube` and `offline progress`) |
| AC-7 — every entry has both fields, populated | met | `**Definition:**` ×8 and `**Example:**` ×8 (`grep -c`), one each per entry; per-entry parse shows non-empty `def` and `ex` for all eight entries |
| AC-8 — every example uses its term (whole token, case-insensitive, inflections count) | met | per-entry check `ex_uses_term` → `True` for all eight; whole-token scan hits per term: click 6, cube 5, idle progress 3, offline progress 3, points 11, prestige 2, save 3, upgrade 3. Examples verbatim: `One click on the cube adds a point to the total.` (click); `Clicking the cube is the fastest way to earn your first points.` (cube); `Idle progress keeps earning points while the game is open and you stop clicking.` (idle progress); `When you return after a break, offline progress grants the points you would have earned.` (offline progress); `Each click adds points that you can save for your next upgrade.` (points); `A player may choose to prestige, trading the current run for a permanent bonus.` (prestige); `The game writes a save so your points survive a reload.` (save); `Buying an upgrade with points makes every future click more valuable.` (upgrade) |
| AC-9 — idle/offline definitions name each other | met | `idle progress` definition: `… it is distinct from offline progress.`; `offline progress` definition: `… it is distinct from idle progress.` (script checks `idle names offline: True`, `offline names idle: True`) |
| AC-10 — each definition ≤ 2 sentences / ≤ 40 words | met | counts (text after label): click 31w/2s, cube 27w/2s, idle progress 35w/2s, offline progress 31w/2s, points 23w/2s, prestige 30w/2s, save 22w/2s, upgrade 26w/2s — max 35 words, max 2 sentences |
| AC-11 — each example exactly 1 sentence / ≤ 25 words | met | counts (text after label): 11, 12, 14, 15, 12, 14, 11, 11 words; sentence count = 1 for all eight (no abbreviations/periods inside entries, so the count is unambiguous) |
| AC-12 — file ≤ 100 lines / ≤ 700 words total | met | `wc -l -w -c` → `46  408 2557`; word count over all content (whitespace tokens) → 408 ≤ 700; lines 46 ≤ 100 |

## Scope / constraints audit

- Touched only `docs/product/glossary.md` and `docs/features/project-glossary/build-log-T1.md` (staged pathspecs are exactly these two).
- `docs/product/vision.md` untouched (T2's file): not modified, not staged.
- No edits to `AGENTS.md`, `.opencode/**`, `docs/architecture/**`, `src/`, `tests/`, `public/`, other features' files, or `.env*`. No dependencies, tooling, stack references, code, tests, or config added.
- Orchestration artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/**`) left byte-identical; their pre-existing uncommitted edits remain uncommitted (see `git status` after commit).
- Builder allowlist preflight: `.opencode/agents/builder.md` includes `edit` allow `docs/product/**` (allow block lines 41–43; `grep -n` → line 42) and `docs/features/**/build-log*.md` (allow block lines 20–22; `grep -n` → line 21) → both owned paths are within my edit scope. ✅
- No frontmatter in `docs/product/glossary.md`; no abbreviations inside entries; definitions wording-level only (no mechanics: prestige reset/bonus and idle accrual mechanics explicitly deferred to future features).

Acceptance audit: AC-1 … AC-12 → all met (see table above).
Deviations from spec/plan: none.
