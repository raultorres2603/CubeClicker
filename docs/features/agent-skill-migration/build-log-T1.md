# Build log — T1 — Restore pipeline skills and commit-track imported packs

Task: T1 (2026-11-12)
Files changed: `.opencode/skills/**` (restored 18 files from `HEAD`, no content change); `.agents/skills/**` + `skills-lock.json` staged/committed without content edits (`commits_also`); this log.
What changed & why: restored the six deleted project pipeline skills verbatim from `HEAD`, then commit-tracked the 31 imported skill packs and the existing `skills-lock.json` modification so the 18 untracked packs can no longer be lost. No pack content was edited, no installer was run, no network access.
Decisions: restore with `git restore --source=HEAD --worktree .opencode/skills` (never `git clean` or a worktree-wide restore); stage only `.agents/skills` + `skills-lock.json` in the first commit; make the evidence commit contain only this log.

## Baseline (recorded before any change)

```text
$ git rev-parse HEAD
BASE_SHA=58012947f8fde800f957f186291898db4401aacb

$ git status --porcelain
 D .opencode/skills/code-review/SKILL.md
 D .opencode/skills/code-review/checklists/quality.md
 D .opencode/skills/code-review/checklists/security.md
 D .opencode/skills/code-review/checklists/testing.md
 D .opencode/skills/code-review/templates/review.md
 D .opencode/skills/orchestration-playbook/SKILL.md
 D .opencode/skills/orchestration-playbook/templates/status.md
 D .opencode/skills/orchestration-playbook/templates/task-brief.md
 D .opencode/skills/spec-authoring/SKILL.md
 D .opencode/skills/spec-authoring/references/spec-checklist.md
 D .opencode/skills/spec-authoring/templates/plan.md
 D .opencode/skills/spec-authoring/templates/spec.md
 D .opencode/skills/spec-review/SKILL.md
 D .opencode/skills/spec-review/templates/review.md
 D .opencode/skills/task-decomposition/SKILL.md
 D .opencode/skills/task-decomposition/templates/tasks.md
 D .opencode/skills/web-implementation/SKILL.md
 D .opencode/skills/web-implementation/references/engineering-principles.md
 M skills-lock.json
?? .agents/skills/baseline-ui/
?? .agents/skills/brainstorming/
?? .agents/skills/component-canvas/
?? .agents/skills/create-canvas/
?? .agents/skills/create-design-md/
?? .agents/skills/executing-plans/
?? .agents/skills/fixing-accessibility/
?? .agents/skills/fixing-metadata/
?? .agents/skills/fixing-motion-performance/
?? .agents/skills/improve-ui/
?? .agents/skills/openai-docs/
?? .agents/skills/receiving-code-review/
?? .agents/skills/subagent-driven-development/
?? .agents/skills/systematic-debugging/
?? .agents/skills/test-driven-development/
?? .agents/skills/ui-skills-root/
?? .agents/skills/verification-before-completion/
?? .agents/skills/writing-plans/
?? docs/features/agent-skill-migration/

$ git status --porcelain -- .opencode/skills
 D .opencode/skills/code-review/SKILL.md
 D .opencode/skills/code-review/checklists/quality.md
 D .opencode/skills/code-review/checklists/security.md
 D .opencode/skills/code-review/checklists/testing.md
 D .opencode/skills/code-review/templates/review.md
 D .opencode/skills/orchestration-playbook/SKILL.md
 D .opencode/skills/orchestration-playbook/templates/status.md
 D .opencode/skills/orchestration-playbook/templates/task-brief.md
 D .opencode/skills/spec-authoring/SKILL.md
 D .opencode/skills/spec-authoring/references/spec-checklist.md
 D .opencode/skills/spec-authoring/templates/plan.md
 D .opencode/skills/spec-authoring/templates/spec.md
 D .opencode/skills/spec-review/SKILL.md
 D .opencode/skills/spec-review/templates/review.md
 D .opencode/skills/task-decomposition/SKILL.md
 D .opencode/skills/task-decomposition/templates/tasks.md
 D .opencode/skills/web-implementation/SKILL.md
 D .opencode/skills/web-implementation/references/engineering-principles.md
```

The 18 deleted paths above are the complete deletion set. The 18 untracked `.agents/skills/<id>/` directories are the imported packs to be tracked (13 `threejs-*` packs were already tracked from `5801294`).

## Restore

```text
$ git restore --source=HEAD --worktree .opencode/skills
(no output; exit 0)
```

## Pipeline-skill checks (AC-1, AC-7 pipeline half)

```text
$ test "$(git ls-files .opencode/skills | wc -l)" -eq 18 && echo "18 tracked pipeline-skill files"
18 tracked pipeline-skill files
[exit 0]

$ test "$(git ls-files ".opencode/skills/*/SKILL.md" | wc -l)" -eq 6 && echo "6 tracked pipeline SKILL.md files"
6 tracked pipeline SKILL.md files
[exit 0]

$ git diff --exit-code HEAD -- .opencode/skills && echo ".opencode/skills matches HEAD exactly"
.opencode/skills matches HEAD exactly
[exit 0]

$ test -z "$(git status --porcelain -- .opencode/skills)" && echo "working tree clean for .opencode/skills"
working tree clean for .opencode/skills
[exit 0]

$ git ls-files .opencode/skills | sort
.opencode/skills/code-review/checklists/quality.md
.opencode/skills/code-review/checklists/security.md
.opencode/skills/code-review/checklists/testing.md
.opencode/skills/code-review/SKILL.md
.opencode/skills/code-review/templates/review.md
.opencode/skills/orchestration-playbook/SKILL.md
.opencode/skills/orchestration-playbook/templates/status.md
.opencode/skills/orchestration-playbook/templates/task-brief.md
.opencode/skills/spec-authoring/references/spec-checklist.md
.opencode/skills/spec-authoring/SKILL.md
.opencode/skills/spec-authoring/templates/plan.md
.opencode/skills/spec-authoring/templates/spec.md
.opencode/skills/spec-review/SKILL.md
.opencode/skills/spec-review/templates/review.md
.opencode/skills/task-decomposition/SKILL.md
.opencode/skills/task-decomposition/templates/tasks.md
.opencode/skills/web-implementation/references/engineering-principles.md
.opencode/skills/web-implementation/SKILL.md
```

The restored 18 paths are byte-identical to `HEAD` (`git diff --exit-code HEAD -- .opencode/skills` is empty), so there is no pipeline-skill content change to commit.

## Imported-pack inventory and count (AC-2)

```text
$ test "$(find .agents/skills -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)" -eq 31 && echo "31 imported SKILL.md files"
31 imported SKILL.md files
[exit 0]

$ find .agents/skills -mindepth 1 -maxdepth 1 -type d -printf "%f\n" | sort
baseline-ui
brainstorming
component-canvas
create-canvas
create-design-md
executing-plans
fixing-accessibility
fixing-metadata
fixing-motion-performance
improve-ui
openai-docs
receiving-code-review
subagent-driven-development
systematic-debugging
test-driven-development
threejs-animation
threejs-asset-pipeline
threejs-fundamentals
threejs-geometry
threejs-interaction
threejs-lighting
threejs-loaders
threejs-materials
threejs-performance
threejs-postprocessing
threejs-react-three-fiber
threejs-shaders
threejs-textures
ui-skills-root
verification-before-completion
writing-plans
```

## Lockfile/ID and provenance check (AC-3)

Pinned script from `tasks.md` T1, run from the repo root (`BASE_SHA` already recorded above):

```text
$ BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1)
$ export BASE_SHA
$ node -e '
const { execFileSync } = require("child_process");
const fs = require("fs");
if (!/^[0-9a-f]{40}$/.test(process.env.BASE_SHA || "")) { console.error("BASE_SHA missing"); process.exit(1); }
const head = JSON.parse(execFileSync("git", ["show", `${process.env.BASE_SHA}:skills-lock.json`], { encoding: "utf8" }));
const wt = JSON.parse(fs.readFileSync("skills-lock.json", "utf8"));
if (head.version !== 2 || wt.version !== 2) { console.error("lockfile version must be 2 in both BASE_SHA and the working tree"); process.exit(1); }
const headIds = Object.keys(head.skills).sort();
const wtIds = Object.keys(wt.skills).sort();
const dirs = fs.readdirSync(".agents/skills", { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(`.agents/skills/${d.name}/SKILL.md`))
  .map((d) => d.name).sort();
if (headIds.length !== 13) { console.error("expected 13 pre-existing entries, got", headIds.length); process.exit(1); }
if (wtIds.length !== 31) { console.error("expected 31 entries, got", wtIds.length); process.exit(1); }
if (JSON.stringify(wtIds) !== JSON.stringify(dirs)) { console.error("lockfile IDs do not match skill directories"); process.exit(1); }
const canon = (o) => JSON.stringify(Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])));
for (const id of headIds) {
  if (canon(head.skills[id]) !== canon(wt.skills[id])) { console.error("pre-existing entry changed:", id); process.exit(1); }
}
console.log("31 lockfile IDs match 31 directories; 13 pre-existing entries unchanged");
'
31 lockfile IDs match 31 directories; 13 pre-existing entries unchanged
[exit 0]

$ node -e 'const l=JSON.parse(require("fs").readFileSync("skills-lock.json","utf8")); console.log("working tree version:", l.version); console.log("working tree entries:", Object.keys(l.skills).length);'
working tree version: 2
working tree entries: 31
[exit 0]

$ BASE_SHA=$(sed -n "s/^BASE_SHA=//p" docs/features/agent-skill-migration/build-log-T1.md | tail -1); export BASE_SHA; node -e 'const {execFileSync}=require("child_process"); const h=JSON.parse(execFileSync("git",["show",process.env.BASE_SHA+":skills-lock.json"],{encoding:"utf8"})); console.log("BASE_SHA version:", h.version); console.log("BASE_SHA entries:", Object.keys(h.skills).length);'
BASE_SHA version: 2
BASE_SHA entries: 13
[exit 0]

$ BASE_SHA=$(sed -n "s/^BASE_SHA=//p" docs/features/agent-skill-migration/build-log-T1.md | tail -1); git diff --numstat "$BASE_SHA" -- skills-lock.json
108	0	skills-lock.json
[exit 0]

$ BASE_SHA=$(sed -n "s/^BASE_SHA=//p" docs/features/agent-skill-migration/build-log-T1.md | tail -1)
$ git diff --numstat "$BASE_SHA" -- skills-lock.json | awk '{ if ($1 < 1 || $2 != 0) { print "lockfile diff must be additive with zero deletions"; exit 1 } } END { if (NR == 0) { print "lockfile diff missing"; exit 1 } }' && echo "lockfile diff additive with zero deletions"
lockfile diff additive with zero deletions
[exit 0]
```

Note: an earlier ad-hoc run of the supplementary `BASE_SHA version` printout (not a pinned check) failed because the exported variable was missing from that invocation; the corrected run above is the recorded result, and the pinned script above independently asserts `version === 2` in both `BASE_SHA` and the working tree.

## Credential scan (AC-11)

```text
$ node -e '
const fs = require("fs");
const path = require("path");
const root = ".agents/skills";
const patterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\b(AWS_SECRET_ACCESS_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN)\s*[:=]/,
  /\b(api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["'][^"']{8,}["']/i,
];
const hits = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name.startsWith(".env")) { hits.push(`${p}: environment file`); continue; }
    if (e.isDirectory()) { walk(p); continue; }
    if (!e.isFile()) continue;
    const buf = fs.readFileSync(p);
    if (buf.includes(0)) continue;
    const text = buf.toString("utf8");
    for (const re of patterns) if (re.test(text)) hits.push(`${p}: ${re}`);
  }
})(root);
if (hits.length) { console.error(hits.join("\n")); process.exit(1); }
console.log("credential scan clean: no .env files, private keys, or credential patterns");
'
credential scan clean: no .env files, private keys, or credential patterns
[exit 0]
```

## Staging and staged-diff check (AC-2)

```text
$ git add .agents/skills skills-lock.json
[exit 0]

$ git status --porcelain -- .agents/skills skills-lock.json
A  .agents/skills/baseline-ui/SKILL.md
A  .agents/skills/brainstorming/SKILL.md
A  .agents/skills/brainstorming/builder-check-prompt.md
A  .agents/skills/brainstorming/scripts/frame-template.html
A  .agents/skills/brainstorming/scripts/helper.js
A  .agents/skills/brainstorming/scripts/server.cjs
A  .agents/skills/brainstorming/scripts/start-server.sh
A  .agents/skills/brainstorming/scripts/stop-server.sh
A  .agents/skills/brainstorming/visual-companion.md
A  .agents/skills/component-canvas/SKILL.md
A  .agents/skills/create-canvas/SKILL.md
A  .agents/skills/create-design-md/SKILL.md
A  .agents/skills/executing-plans/SKILL.md
A  .agents/skills/executing-plans/scripts/task-done
A  .agents/skills/executing-plans/scripts/task-start
A  .agents/skills/fixing-accessibility/SKILL.md
A  .agents/skills/fixing-metadata/SKILL.md
A  .agents/skills/fixing-motion-performance/SKILL.md
A  .agents/skills/improve-ui/SKILL.md
A  .agents/skills/improve-ui/agents/openai.yaml
A  .agents/skills/improve-ui/references/plan-template.md
A  .agents/skills/openai-docs/LICENSE.txt
A  .agents/skills/openai-docs/SKILL.md
A  .agents/skills/openai-docs/agents/openai.yaml
A  .agents/skills/openai-docs/assets/openai-small.svg
A  .agents/skills/openai-docs/assets/openai.png
A  .agents/skills/openai-docs/references/latest-model.md
A  .agents/skills/openai-docs/references/prompting-guide.md
A  .agents/skills/openai-docs/references/upgrade-guide.md
A  .agents/skills/openai-docs/scripts/fetch-codex-manual.mjs
A  .agents/skills/openai-docs/scripts/resolve-latest-model-info.js
A  .agents/skills/receiving-code-review/SKILL.md
A  .agents/skills/subagent-driven-development/SKILL.md
A  .agents/skills/subagent-driven-development/implementer-prompt.md
A  .agents/skills/subagent-driven-development/re-review-prompt.md
A  .agents/skills/subagent-driven-development/references/batching.md
A  .agents/skills/subagent-driven-development/references/cannot-verify.md
A  .agents/skills/subagent-driven-development/references/final-review.md
A  .agents/skills/subagent-driven-development/references/fix-loop.md
A  .agents/skills/subagent-driven-development/references/handling-reports.md
A  .agents/skills/subagent-driven-development/references/preflight.md
A  .agents/skills/subagent-driven-development/references/resuming.md
A  .agents/skills/subagent-driven-development/scripts/review-package
A  .agents/skills/subagent-driven-development/scripts/sdd-repo
A  .agents/skills/subagent-driven-development/scripts/sdd-workspace
A  .agents/skills/subagent-driven-development/scripts/task-brief
A  .agents/skills/subagent-driven-development/task-reviewer-prompt.md
A  .agents/skills/systematic-debugging/SKILL.md
A  .agents/skills/systematic-debugging/condition-based-waiting-example.ts
A  .agents/skills/systematic-debugging/condition-based-waiting.md
A  .agents/skills/systematic-debugging/defense-in-depth.md
A  .agents/skills/systematic-debugging/find-polluter.sh
A  .agents/skills/systematic-debugging/root-cause-tracing.md
A  .agents/skills/test-driven-development/SKILL.md
A  .agents/skills/test-driven-development/writing-good-tests.md
A  .agents/skills/ui-skills-root/SKILL.md
A  .agents/skills/verification-before-completion/SKILL.md
A  .agents/skills/writing-plans/SKILL.md
M  skills-lock.json

$ git diff --cached --stat | tail -5
 .agents/skills/ui-skills-root/SKILL.md             |  59 ++
 .../skills/verification-before-completion/SKILL.md | 120 ++++
 .agents/skills/writing-plans/SKILL.md              | 204 ++++++
 skills-lock.json                                   | 108 +++
 59 files changed, 8777 insertions(+)

$ test -z "$(git diff --cached --name-status "$BASE_SHA" -- .agents/skills | grep -v '^A')"
staged .agents/skills changes are additions only
[exit 0]

$ git diff --cached --name-status "$BASE_SHA" -- .agents/skills | awk '{print $1}' | sort | uniq -c
     58 A

$ git diff --cached --numstat "$BASE_SHA" -- skills-lock.json
108	0	skills-lock.json
```

The 13 pre-existing `threejs-*` packs are unchanged: every staged `.agents/skills` change is status `A` (58 new files across the 18 previously untracked packs), and the lockfile diff is 108 insertions / 0 deletions.

## Commit 1 — pack/lockfile tracking

```text
$ git commit -m "chore: track imported skill packs and lockfile"
[main 633c67a] chore: track imported skill packs and lockfile
 59 files changed, 8777 insertions(+)
 (58 create-mode lines; the same file list is recorded in the staged status above)

$ git rev-parse HEAD
T1_PACK_SHA=633c67aa36d82d895cbe036165a92c9d9d8f24a3

$ git show --stat --oneline HEAD
633c67a chore: track imported skill packs and lockfile
 .agents/skills/baseline-ui/SKILL.md                |  85 +++
 .agents/skills/brainstorming/SKILL.md              | 316 +++++++++
 .../skills/brainstorming/builder-check-prompt.md   |  23 +
 .../brainstorming/scripts/frame-template.html      | 213 ++++++
 .agents/skills/brainstorming/scripts/helper.js     | 167 +++++
 .agents/skills/brainstorming/scripts/server.cjs    | 723 +++++++++++++++++++++
 .../skills/brainstorming/scripts/start-server.sh   | 216 ++++++
 .../skills/brainstorming/scripts/stop-server.sh    | 120 ++++
 .agents/skills/brainstorming/visual-companion.md   | 299 +++++++++
 .agents/skills/component-canvas/SKILL.md           | 123 ++++
 .agents/skills/create-canvas/SKILL.md              | 162 +++++
 .agents/skills/create-design-md/SKILL.md           | 254 ++++++++
 .agents/skills/executing-plans/SKILL.md            | 323 +++++++++
 .agents/skills/executing-plans/scripts/task-done   |  55 ++
 .agents/skills/executing-plans/scripts/task-start  |  32 +
 .agents/skills/fixing-accessibility/SKILL.md       | 136 ++++
 .agents/skills/fixing-metadata/SKILL.md            | 112 +++
 .agents/skills/fixing-motion-performance/SKILL.md  | 151 +++++
 .agents/skills/improve-ui/SKILL.md                 | 116 ++++
 .agents/skills/improve-ui/agents/openai.yaml       |  13 +
 .../skills/improve-ui/references/plan-template.md  |  55 ++
 .agents/skills/openai-docs/LICENSE.txt             | 201 ++++++
 .agents/skills/openai-docs/SKILL.md                | 161 +++++
 .agents/skills/openai-docs/agents/openai.yaml      |  14 +
 .agents/skills/openai-docs/assets/openai-small.svg |   3 +
 .agents/skills/openai-docs/assets/openai.png       | Bin 0 -> 1429 bytes
 .../skills/openai-docs/references/latest-model.md  |  37 ++
 .../openai-docs/references/prompting-guide.md      | 244 +++++++
 .../skills/openai-docs/references/upgrade-guide.md | 181 ++++++
 .../openai-docs/scripts/fetch-codex-manual.mjs     | 598 +++++++++++++++++
 .../scripts/resolve-latest-model-info.js           | 147 +++++
 .agents/skills/receiving-code-review/SKILL.md      | 205 ++++++
 .../skills/subagent-driven-development/SKILL.md    | 339 ++++++++++
 .../implementer-prompt.md                          | 154 +++++
 .../re-review-prompt.md                            | 116 ++++
 .../references/batching.md                         |  11 +
 .../references/cannot-verify.md                    |  10 +
 .../references/final-review.md                     |  49 ++
 .../references/fix-loop.md                         |  77 +++
 .../references/handling-reports.md                 |  15 +
 .../references/preflight.md                        |  26 +
 .../references/resuming.md                         |  12 +
 .../scripts/review-package                         |  64 ++
 .../subagent-driven-development/scripts/sdd-repo   |  54 ++
 .../scripts/sdd-workspace                          | 110 ++++
 .../subagent-driven-development/scripts/task-brief | 108 +++
 .../task-reviewer-prompt.md                        | 209 ++++++
 .agents/skills/systematic-debugging/SKILL.md       | 283 ++++++++
 .../condition-based-waiting-example.ts             | 158 +++++
 .../condition-based-waiting.md                     | 115 ++++
 .../systematic-debugging/defense-in-depth.md       | 122 ++++
 .../skills/systematic-debugging/find-polluter.sh   |  72 ++
 .../systematic-debugging/root-cause-tracing.md     | 169 +++++
 .agents/skills/test-driven-development/SKILL.md    | 330 ++++++++++
 .../test-driven-development/writing-good-tests.md  | 198 ++++++
 .agents/skills/ui-skills-root/SKILL.md             |  59 ++
 .../skills/verification-before-completion/SKILL.md | 120 ++++
 .agents/skills/writing-plans/SKILL.md              | 204 ++++++
 skills-lock.json                                   | 108 +++
 59 files changed, 8777 insertions(+)

$ git status --porcelain -- .opencode/skills .agents/skills skills-lock.json
(empty)
```

## Post-commit state

```text
$ git status --porcelain
?? docs/features/agent-skill-migration/

$ test -z "$(git status --porcelain -- .opencode/skills .agents/skills skills-lock.json)" && echo "repaired paths clean"
repaired paths clean
[exit 0]
```

Only the feature artifacts directory remains untracked (it is committed by T4/T5 under their `commits_also` lists; this T1 evidence commit stages only this log).

## Post-evidence-commit verification

```text
$ sed -n 's/^BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1
58012947f8fde800f957f186291898db4401aacb
$ sed -n 's/^T1_PACK_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1
633c67aa36d82d895cbe036165a92c9d9d8f24a3

$ test "$(git ls-files .opencode/skills | wc -l)" -eq 18
[exit 0]
$ test "$(git ls-files ".opencode/skills/*/SKILL.md" | wc -l)" -eq 6
[exit 0]
$ git diff --exit-code HEAD -- .opencode/skills
[exit 0, no output]
$ git diff --exit-code 58012947f8fde800f957f186291898db4401aacb HEAD -- .opencode/skills
[exit 0, no output: restored tree equals BASE_SHA]
$ test -z "$(git status --porcelain -- .opencode/skills)"
[exit 0]
$ test "$(find .agents/skills -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)" -eq 31
[exit 0]
$ BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1); export BASE_SHA; node -e '…pinned lockfile/ID script…'
31 lockfile IDs match 31 directories; 13 pre-existing entries unchanged
[exit 0]
$ git diff --numstat "$BASE_SHA" -- skills-lock.json
108	0	skills-lock.json

$ test -z "$(git status --porcelain -- .opencode/skills .agents/skills skills-lock.json)" && echo "repaired paths clean after evidence commit"
repaired paths clean after evidence commit
[exit 0]

$ git status --porcelain
?? docs/features/agent-skill-migration/plan.md
?? docs/features/agent-skill-migration/reviews/
?? docs/features/agent-skill-migration/spec.md
?? docs/features/agent-skill-migration/status.md
?? docs/features/agent-skill-migration/tasks.md
```

The remaining untracked files are planner/reviewer/orchestrator artifacts committed by T4/T5; T1 does not own or edit them.

## Acceptance audit

- AC-1 — met: six pipeline skills restored, 18 tracked files / 6 `SKILL.md`, `git diff --exit-code HEAD -- .opencode/skills` empty (no output), working tree clean for `.opencode/skills`.
- AC-2 — met: 31 imported directories with top-level `SKILL.md`; staged-vs-`BASE_SHA` name-status under `.agents/skills` is `A` only (58 additions, no `M`/`D`); post-commit status clean for `.agents/skills`, `skills-lock.json`, `.opencode/skills`.
- AC-3 — met: lockfile `version` 2 in both `BASE_SHA` (13 entries) and the working tree (31 entries); 31 IDs match 31 directories; 13 pre-existing entries deep-equal; `git diff --numstat "$BASE_SHA"` = `108 0`; post-commit status clean.
- AC-7 (pipeline half) — met: all six project IDs resolve to `.opencode/skills/<id>/SKILL.md`; restored tree equals `HEAD`.
- AC-11 — met: pinned credential scan printed `credential scan clean` and exited 0.
- AC-9 (pipeline paths, T1 scope) — met: every restored `.opencode/skills/...` path exists (the 18 tracked files listed above).

## Deviations from spec

None. No pack content, lockfile content, agent file, policy doc, README, or `.env*` was edited; no installer/network was run; no `git clean` or worktree-wide restore was used.
