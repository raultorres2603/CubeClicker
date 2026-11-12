# Build log — T2 — Curate agent allow-lists and document the skill policy

Task: T2 (2026-11-12)
Files changed: `.opencode/agents/planner.md`, `.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `AGENTS.md`, `README.md`, `docs/architecture/skills.md` (new), `docs/architecture/documentation.md`, this log.
What changed & why: replaced the three agents' incomplete `skill` allow-lists with the exact AC-5 sequences (`*` deny first, explicit allows in order), added one advisory-precedence line per edited agent prompt, created `docs/architecture/skills.md` with the nine required sections plus the 31-row inventory and 14-row disposition tables, and updated `AGENTS.md`, `README.md` (§ Stack), and `documentation.md` for the two skill locations and the policy.
Decisions: `orchestrator.md` untouched (its single `orchestration-playbook` allow already satisfies AC-5); no non-skill permission edited; no application code, tests, container assets, `docs/features/README.md`, or feature bookkeeping edited; the three T3 feature-index rows are recorded here only.

## Baseline

```text
$ git branch --show-current
main

$ git rev-parse HEAD   # pre-T2 HEAD = T1 evidence commit
e2d607f4048a014cf7ba30464cf7f29ac7c786bc

$ sed -n 's/^BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1
58012947f8fde800f957f186291898db4401aacb

$ git status --porcelain   # before any T2 edit
?? docs/features/agent-skill-migration/plan.md
?? docs/features/agent-skill-migration/reviews/
?? docs/features/agent-skill-migration/spec.md
?? docs/features/agent-skill-migration/status.md
?? docs/features/agent-skill-migration/tasks.md
```

## Edits

- `.opencode/agents/planner.md` — added `{action: skill, resource: "writing-plans", effect: allow}` after `task-decomposition`; added the advisory-precedence line naming the `writing-plans` subset.
- `.opencode/agents/builder.md` — added the 16 imported allow entries after `web-implementation` in AC-5 order (`test-driven-development`, `systematic-debugging`, `verification-before-completion`, `receiving-code-review`, `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-shaders`, `threejs-textures`, `threejs-animation`, `threejs-interaction`, `threejs-performance`, `threejs-postprocessing`, `fixing-accessibility`, `fixing-motion-performance`); added the advisory-precedence line.
- `.opencode/agents/reviewer.md` — added `systematic-debugging` and `verification-before-completion` after `code-review`; added the advisory-precedence line.
- `.opencode/agents/orchestrator.md` — no change (verified byte-identical to `BASE_SHA` below).
- `AGENTS.md` — project structure now names `.opencode/skills/` and `.agents/skills/`; Conventions links `docs/architecture/skills.md`.
- `README.md` — § Stack lists `docs/architecture/skills.md`.
- `docs/architecture/skills.md` — new policy document with the nine required sections.
- `docs/architecture/documentation.md` — architecture checklist names `skills.md`; Notes links `docs/architecture/skills.md`; the `.opencode/skills/orchestration-playbook/SKILL.md` reference resolves.
- `docs/features/agent-skill-migration/build-log-T2.md` — this log (evidence commit).

The only frontmatter changes are `action: skill` rules; the pinned non-skill permission guard below proves every non-skill rule is unchanged from `BASE_SHA` for all four agents.

## Verification evidence

All checks below are the verbatim pinned blocks from `docs/features/agent-skill-migration/tasks.md` T2, re-run against the T2 content commit (`INDEX_BASE_SHA`) from the repository root.

### Allow-list rule-order/effect check

```text
$ node -e '<T2 pinned allow-list rule-order/effect check — tasks.md lines 103-149>'
allow-lists OK: exact rule sequence plus last-match semantics for all known IDs
[exit 0]
```

### Non-skill permission guard

```text
$ BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1)
$ export BASE_SHA
$ node -e '<T2 pinned non-skill permission guard — tasks.md lines 151-180>'
non-skill permissions unchanged from BASE_SHA for all four agents
[exit 0]
```

### Inventory/disposition check

```text
$ node -e '<T2 pinned inventory/disposition check — tasks.md lines 182-234>'
skills inventory/disposition OK: 31 inventory rows, 14 disposition rows with reasons
[exit 0]
```

### Nine-section check

```text
$ for h in "Canonical locations" "Precedence and ID rules" "Per-agent skill policy" "Imported pack inventory" "Excluded and unassigned packs" "Binding vs advisory" "Maintenance" "Verification" "History"; do
>   grep -qx "## $h" docs/architecture/skills.md || { echo "missing section: $h"; exit 1; }
> done
nine required sections present
[exit 0]
```

### AC-8 scoped checks

```text
$ grep -n '\.opencode/skills' AGENTS.md
31:- `.opencode/` — agents, commands, and the six project pipeline skills in `.opencode/skills/` (the AI team)
51:- Skills: project pipeline skills live in `.opencode/skills/` (binding, higher precedence); imported packs live in `.agents/skills/` (advisory, installer-managed with `skills-lock.json`). Per-agent allow-lists, precedence, and pack dispositions are documented in `docs/architecture/skills.md`.

$ grep -n '\.agents/skills' AGENTS.md
32:- `.agents/skills/` — 31 imported third-party skill packs (advisory), tracked with `skills-lock.json`
51:- Skills: project pipeline skills live in `.opencode/skills/` (binding, higher precedence); imported packs live in `.agents/skills/` (advisory, installer-managed with `skills-lock.json`). Per-agent allow-lists, precedence, and pack dispositions are documented in `docs/architecture/skills.md`.

$ grep -n 'docs/architecture/skills.md' AGENTS.md
51:- Skills: project pipeline skills live in `.opencode/skills/` (binding, higher precedence); imported packs live in `.agents/skills/` (advisory, installer-managed with `skills-lock.json`). Per-agent allow-lists, precedence, and pack dispositions are documented in `docs/architecture/skills.md`.

$ grep -n 'docs/architecture/skills.md' docs/architecture/documentation.md
43:- Link to the glossary: [glossary](../product/glossary.md). Link to the vision: [vision](../product/vision.md). Link to the containerization reference: [containerization](containerization.md). Link to the stack reference: [stack](stack.md). Link to the skills policy: `docs/architecture/skills.md`.

$ test -f .opencode/skills/orchestration-playbook/SKILL.md
[exit 0]

$ awk '/^## Stack$/{f=1;next} /^## /{f=0} f' README.md | grep -n 'docs/architecture/skills.md'
6:- `docs/architecture/skills.md` — skill locations (`.opencode/skills/` and `.agents/skills/`), per-agent allow-lists, imported-pack dispositions, and the binding-vs-advisory policy

AC-8 scoped checks OK
[exit 0]
```

### Duplicate-ID and live-path checks

```text
$ test -z "$(comm -12 <(ls .opencode/skills | sort) <(ls .agents/skills | sort))"
no duplicate IDs between .opencode/skills and .agents/skills
[exit 0]

$ grep -rhoE '\.opencode/skills/[A-Za-z0-9._/-]+' AGENTS.md README.md .opencode docs/architecture \
>   | sed -E 's/[.,;:]+$//' | sort -u \
>   | while read -r p; do test -e "$p" || { echo "missing $p"; exit 1; }; done
all live .opencode/skills references resolve
[exit 0]
```

### F3-r3 cross-check (spec-review r3 carry: explicit project/imported ID resolution)

```text
$ node -e '<resolution loop: every AC-5 allow-listed ID must have exactly one .opencode/skills/<id>/SKILL.md or .agents/skills/<id>/SKILL.md>'
every allow-listed ID resolves to exactly one SKILL.md (F3-r3 cross-check)
[exit 0]
```

### Orchestrator unchanged

```text
$ git diff --exit-code 58012947f8fde800f957f186291898db4401aacb HEAD -- .opencode/agents/orchestrator.md
(no output)
orchestrator.md unchanged from BASE_SHA
[exit 0]
```

## Proposed feature-index rows for T3 (recorded here; `docs/features/README.md` not edited)

T3 (orchestrator, edit-only) inserts exactly these rows at the pinned positions:

```markdown
| coin-economy | Coin Economy (coins from destroyed cubes, speed bonus, persistent per-user stats) | building | 2026-10-30 |
| spending-upgrades | Spending & Upgrades (spend coins on upgrades to earn faster) | accepted | 2026-10-30 |
| idle-accrual | Idle Accrual (coins accrue while away for accounts) | accepted | 2026-10-30 |
```

- `coin-economy` — after `spaceship-cursor-refinement` and before `modern-visual-overhaul`.
- `spending-upgrades` and `idle-accrual` — after `metallic-hud-frames-polish`, in that order, and before `aws-deploy-pipeline`.

The dates are derived from each feature's latest `- YYYY-MM-DD —` loop-log entry (`coin-economy` keeps its 2026-10-30 activity date; its stale frontmatter `updated: 2026-10-28` is not edited).

## Commit 1 — content

```text
$ git add .opencode/agents/planner.md .opencode/agents/builder.md .opencode/agents/reviewer.md AGENTS.md README.md docs/architecture/skills.md docs/architecture/documentation.md
$ git diff --cached --stat
 .opencode/agents/builder.md        |  49 +++++++++++++++
 .opencode/agents/planner.md        |   4 ++
 .opencode/agents/reviewer.md       |   7 +++
 AGENTS.md                          |   4 +-
 README.md                          |   1 +
 docs/architecture/documentation.md |   4 +-
 docs/architecture/skills.md        | 124 +++++++++++++++++++++++++++++++++++++
 7 files changed, 190 insertions(+), 3 deletions(-)

$ git commit -m "docs: document skill locations and curate agent allow-lists"
[main 4a63b1e] docs: document skill locations and curate agent allow-lists
 7 files changed, 190 insertions(+), 3 deletions(-)
 create mode 100644 docs/architecture/skills.md

$ git rev-parse HEAD
INDEX_BASE_SHA=4a63b1e6582057ba94689213d56099691d08f977

$ git show --stat --oneline HEAD
4a63b1e docs: document skill locations and curate agent allow-lists
 .opencode/agents/builder.md        |  49 +++++++++++++++
 .opencode/agents/planner.md        |   4 ++
 .opencode/agents/reviewer.md       |   7 +++
 AGENTS.md                          |   4 +-
 README.md                          |   1 +
 docs/architecture/documentation.md |   4 +-
 docs/architecture/skills.md        | 124 +++++++++++++++++++++++++++++++++++++
 7 files changed, 190 insertions(+), 3 deletions(-)
```

`INDEX_BASE_SHA=4a63b1e6582057ba94689213d56099691d08f977` is recorded here for T4/T5 and is a later commit than the content commit, so it is not self-referential.

## Acceptance audit

- **AC-4** — met: `docs/architecture/skills.md` has all nine required sections (nine-section check) and both machine-readable tables; the inventory has 31 rows, one per `.agents/skills/*` ID, each `Source` equal to `skills-lock.json`, each `Disposition` in `allowed|excluded|unassigned`; the disposition table has 14 rows (7 excluded + 7 unassigned), each with a non-empty reason and category equal to disposition (inventory/disposition check).
- **AC-5** — met: the allow-list checker asserts the exact `skill` rule sequence (first `*` deny, then the listed allows in AC-5 order, no other skill rules) and last-match semantics for all 37 known IDs (6 project + 31 imported) for all four agents; `orchestrator.md` is byte-identical to `BASE_SHA`.
- **AC-6** — met: under last-match evaluation every excluded ID (`baseline-ui`, `threejs-react-three-fiber`, `executing-plans`, `subagent-driven-development`, `openai-docs`, `threejs-loaders`, `threejs-asset-pipeline`) resolves to the `*` deny for every agent (allow-list checker prints no last-match failure).
- **AC-7** — met: every allow-listed ID resolves to exactly one `SKILL.md` (F3-r3 cross-check), and `comm -12` of the two location ID sets is empty (duplicate-ID check).
- **AC-8** — met: `AGENTS.md` contains `.opencode/skills`, `.agents/skills`, and `docs/architecture/skills.md`; `documentation.md` prints the literal `docs/architecture/skills.md` and its `.opencode/skills/orchestration-playbook/SKILL.md` reference resolves; the README `## Stack` section (scoped `awk`) lists `docs/architecture/skills.md` (AC-8 check block).
- **AC-9 (live docs/config half)** — met: every `.opencode/skills/<id>/<file>` reference in `AGENTS.md`, `README.md`, `.opencode/**`, and `docs/architecture/**` resolves (live-path check); historical `docs/features/**` artifacts are untouched.

## Testing bar

This is a content/configuration change with no application runtime boundary, so there is no unit/integration test file to add: per `spec.md` § Testing strategy and `plan.md` D-8/D-9, the pinned static assertions above are the unit-level tier and static resolution is the authoritative integration gate. No `src/**`, `tests/**`, `compose*.yaml`, Dockerfile, `package.json`, or `package-lock.json` file changed; `npm run smoke` is intentionally not required (no container/runtime change). The regression suite (lint/typecheck/test/coverage/build) runs at T4.

## Deviations from spec

None. No non-skill permission, application code, test, container asset, `docs/features/README.md`, `orchestrator.md` skill rule, or `.env*` was edited; no push. The T2 brief's `status.md` task-board/loop-log update could not be applied: the builder's `edit` allow-list grants only `docs/features/**/build-log*.md`, so `status.md` is permission-denied as designed (it is orchestrator-owned). The orchestrator must mark T2 `[x]` and append the loop-log entry (content commit `4a63b1e` plus this evidence commit) itself before T4 stages `status.md`.
