# Tasks — Project-Only Skills

Dependency overview: T1 → T2 → T3

## Shared conventions

- `files_owned` lists the only paths a task may create, edit, or delete. `commits_also` (T3 only) lists orchestrator-authored artifacts the builder stages/commits **without editing**.
- The planning baseline includes an unrelated pre-existing modification, `M docs/features/vercel-fly-neon-deployment/status.md` (blocked feature). T1 records it; no task may edit, stage, or commit it. The final clean check is scoped to feature-owned paths and explicitly excludes it.
- This feature has no runtime code change, so there are no new `*.test.ts` files: the unit tier is the deterministic static-assertion blocks in each task's verify section (exact expected values and exit codes, no wildcard matchers, no assertion-free tests). Every task runs `npm run coverage`; thresholds stay ≥ 80 statements/branches/functions/lines per workspace and are unchanged.
- T1 records `BASE_SHA=<sha>` on its own line in `build-log-T1.md`; T2 and T3 read it back. Historical feature artifacts under `docs/features/**` are exempt from stale-reference scans; the new feature directory is not part of those scans either.
- Deletion uses `git rm -r` (tracked) plus `rm -r` for any untracked remainder; `rm -rf` and `git clean` are banned. If `.agents/` contains anything other than the 33 enumerated skill directories, stop and report `blocked`.
- `docs/features/project-only-skills/status.md` and `docs/features/README.md` are orchestrator-owned; the builder never edits them. T3 stages `reviews/**` (spec-review and any code-review verdicts) without editing. The reviewer's verdict and the acceptance index row are committed by the orchestrator at acceptance.

## T1 — Delete imported packs and lockfile `[seq]`

depends_on: —
files_owned: `.agents/skills/**` (delete), `.agents/` (remove empty directory), `skills-lock.json` (delete), `docs/features/project-only-skills/build-log-T1.md`
verify: every command in § T1 verify, in order; record raw output in `build-log-T1.md`
acceptance: AC-1, AC-2
status: [ ]

Notes: run the inventory block **before** deleting anything and paste its output into the log; record the full `git status --porcelain` including the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` (never touch that path). The deletion commit contains only `.agents/**`, `skills-lock.json`, and the T1 log. Do not edit agent prompts or docs in this task.

### T1 verify

```bash
# baseline + inventory (record all of this in build-log-T1.md)
BASE_SHA=$(git rev-parse HEAD); echo "BASE_SHA=$BASE_SHA"
git status --porcelain
git status --porcelain -- docs/features/vercel-fly-neon-deployment/status.md   # pre-existing M; record, never touch
find .agents/skills -mindepth 1 -maxdepth 1 -type d | sort
test "$(find .agents/skills -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 33
test "$(find .agents/skills -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)" -eq 33
find .agents -mindepth 1 -maxdepth 1 ! -name skills -print   # must print nothing
test -z "$(find .agents -mindepth 1 -maxdepth 1 ! -name skills -print)"
git ls-files .agents | wc -l
git status --porcelain -- .agents

# deletion (use `git rm -r -f` / `git rm -f` only if git reports local modifications; record them first)
git rm -r -- .agents/skills
git rm -- skills-lock.json
test -z "$(find .agents -type f -print)"     # must be empty; if not, rm -r the untracked remainder (no -f)
rm -r -- .agents                              # removes only empty directories at this point
test ! -e .agents
test ! -e skills-lock.json
test -z "$(git ls-files -- '.agents/**' 'skills-lock.json')"
test -z "$(git status --porcelain -- .agents skills-lock.json)"

# project skills preserved
test "$(find .opencode/skills -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 6
for id in orchestration-playbook spec-authoring spec-review task-decomposition web-implementation code-review; do test -f ".opencode/skills/$id/SKILL.md"; done
git diff --exit-code "$BASE_SHA" -- .opencode/skills

# gates
npm run lint
npm run typecheck
npm run coverage

# commit (deletions are already staged; log records the pre-commit evidence)
git add docs/features/project-only-skills/build-log-T1.md
git commit -m "chore: remove imported skill packs and lockfile"
test -z "$(git status --porcelain -- .agents skills-lock.json)"
```

## T2 — Remove imported allow-list entries and rewrite skill policy docs `[seq]`

depends_on: T1
files_owned: `.opencode/agents/planner.md`, `.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `docs/architecture/skills.md`, `AGENTS.md`, `README.md`, `docs/architecture/documentation.md`, `docs/features/project-only-skills/build-log-T2.md`
verify: every command in § T2 verify, in order; record raw output in `build-log-T2.md`
acceptance: AC-3, AC-4, AC-5, AC-6, AC-7
status: [ ]

Notes: orchestrator.md is audited and left unchanged (already project-only). Delete the whole "Imported skills are advisory …" bullet in each edited agent; do not replace it. `documentation.md` is an audit — if no stale reference exists, record the empty diff and make no edit. Commit only the listed files plus the T2 log.

### T2 verify

```bash
BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/project-only-skills/build-log-T1.md | head -1)

# AC-3: exact skill sequences, total skill-rule count, and non-skill permission parity vs BASE_SHA
BASE_SHA="$BASE_SHA" node -e '
const fs=require("fs"), assert=require("assert"), {execFileSync}=require("child_process");
const agents=["orchestrator","planner","builder","reviewer"];
const expected={orchestrator:["orchestration-playbook"],planner:["spec-authoring","task-decomposition"],builder:["web-implementation"],reviewer:["spec-review","code-review"]};
const fmOf=(text)=>{const parts=text.split(/^---\s*$/m); assert.ok(parts.length>=3,"missing frontmatter"); return parts[1];};
const parse=(fm)=>{
  const rules=[]; let cur=null;
  for (const line of fm.split(/\r?\n/)) {
    const start=line.match(/^\s*-\s*action:\s*(\S+)\s*$/);
    if (start) { if (cur) rules.push(cur); cur={action:start[1].replace(/^["\x27]|["\x27]$/g,""),resource:null,effect:null}; continue; }
    if (!cur) continue;
    const resource=line.match(/^\s*resource:\s*"([^"]*)"\s*$/);
    if (resource) { cur.resource=resource[1]; continue; }
    const effect=line.match(/^\s*effect:\s*(\S+)\s*$/);
    if (effect) { cur.effect=effect[1]; continue; }
  }
  if (cur) rules.push(cur);
  for (const rule of rules) assert.ok(rule.resource!==null && rule.effect,"unparsed permission rule: "+JSON.stringify(rule));
  return rules;
};
const canon=(rule)=>`${rule.action}|${rule.resource}|${rule.effect}`;
for (const agent of agents) {
  const fm=fmOf(fs.readFileSync(`.opencode/agents/${agent}.md`,"utf8"));
  const baseFm=fmOf(execFileSync("git",["show",`${process.env.BASE_SHA}:.opencode/agents/${agent}.md`],{encoding:"utf8"}));
  const work=parse(fm), base=parse(baseFm);
  const skillOccurrences=(fm.match(/\baction:\s*["\x27]?skill["\x27]?\b/g)||[]).length;
  const skillRules=work.filter((rule)=>rule.action==="skill");
  assert.strictEqual(skillOccurrences,skillRules.length,`${agent}: unmatched action: skill rule`);
  assert.deepStrictEqual(skillRules.map(canon),[`skill|*|deny`,...expected[agent].map((id)=>`skill|${id}|allow`)],`${agent}: skill sequence`);
  assert.deepStrictEqual(work.filter((rule)=>rule.action!=="skill").map(canon),base.filter((rule)=>rule.action!=="skill").map(canon),`${agent}: non-skill permission changed`);
}
console.log("agent frontmatter: skill sequences, total count, and non-skill parity OK");
'

# AC-4: no deleted pack ID, advisory bullet, or namespaced reference in any agent prompt
node -e '
const fs=require("fs");
const ids="baseline-ui brainstorming component-canvas create-canvas create-design-md deploy-to-vercel executing-plans fixing-accessibility fixing-metadata fixing-motion-performance improve-ui neon-postgres openai-docs receiving-code-review subagent-driven-development systematic-debugging test-driven-development threejs-animation threejs-asset-pipeline threejs-fundamentals threejs-geometry threejs-interaction threejs-lighting threejs-loaders threejs-materials threejs-performance threejs-postprocessing threejs-react-three-fiber threejs-shaders threejs-textures ui-skills-root verification-before-completion writing-plans".split(" ");
let bad=false;
for (const agent of ["orchestrator","planner","builder","reviewer"]) {
  const text=fs.readFileSync(`.opencode/agents/${agent}.md`,"utf8");
  for (const id of ids) if (text.includes(id)) { console.error(`${agent}: ${id}`); bad=true; }
  if (/imported skills are advisory/i.test(text)) { console.error(`${agent}: advisory bullet`); bad=true; }
  if (text.includes("superpowers:")) { console.error(`${agent}: namespaced reference`); bad=true; }
}
process.exit(bad?1:0);
'

# AC-5: skills.md is the project-only policy
for h in "## Canonical location" "## Precedence and ID rules" "## Per-agent skill policy" "## Maintenance" "## Verification" "## History"; do grep -qF "$h" docs/architecture/skills.md || exit 1; done
for id in orchestration-playbook spec-authoring spec-review task-decomposition web-implementation code-review; do grep -qF "$id" docs/architecture/skills.md || exit 1; done
grep -qF 'Context7 MCP' docs/architecture/skills.md
grep -qF '| orchestrator | `orchestration-playbook` |' docs/architecture/skills.md
grep -qF '| planner | `spec-authoring`, `task-decomposition` |' docs/architecture/skills.md
grep -qF '| builder | `web-implementation` |' docs/architecture/skills.md
grep -qF '| reviewer | `spec-review`, `code-review` |' docs/architecture/skills.md
! grep -nE '\.agents|skills-lock|Imported pack inventory|Excluded and unassigned packs|Binding vs advisory' docs/architecture/skills.md

# AC-6: AGENTS.md and README.md
! grep -niE '\.agents|skills-lock|imported|advisory' AGENTS.md README.md
grep -qF '.opencode/skills' AGENTS.md
grep -qF 'docs/architecture/skills.md' AGENTS.md
grep -qF 'podman compose' AGENTS.md
grep -qF 'four-agent pipeline' AGENTS.md
grep -qF 'podman compose up' README.md
grep -qF '.opencode/skills' README.md
grep -qF 'docs/architecture/skills.md' README.md

# AC-7: documentation.md audit and link resolution
! grep -niE '\.agents|skills-lock|imported|advisory' docs/architecture/documentation.md
grep -qF 'docs/architecture/skills.md' docs/architecture/documentation.md
test -f .opencode/skills/orchestration-playbook/SKILL.md
git diff --exit-code "$BASE_SHA" -- docs/architecture/documentation.md

# AC-8: no live reference to the deleted paths
! grep -rnE '\.agents/skills|skills-lock\.json' AGENTS.md README.md opencode.jsonc .opencode docs/architecture

# gates
npm run lint
npm run typecheck
npm run coverage

# commit
git add .opencode/agents/planner.md .opencode/agents/builder.md .opencode/agents/reviewer.md docs/architecture/skills.md AGENTS.md README.md docs/architecture/documentation.md docs/features/project-only-skills/build-log-T2.md
git commit -m "docs: limit skills to the project pipeline"
test -z "$(git status --porcelain -- .opencode/agents docs/architecture AGENTS.md README.md)"
```

## T3 — Verify no stale references; full gates; commit `[seq]`

depends_on: T2
files_owned: `docs/features/project-only-skills/build-log-T3.md`
commits_also: `docs/features/project-only-skills/spec.md`, `docs/features/project-only-skills/plan.md`, `docs/features/project-only-skills/tasks.md`, `docs/features/project-only-skills/status.md`, `docs/features/project-only-skills/reviews/**` (stage/commit only; never edit)
verify: every command in § T3 verify, in order; record raw output in `build-log-T3.md`
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
status: [ ]

Notes: this task makes no content edits. Stage `reviews/**` and the feature artifacts without editing. Never edit, stage, or commit `docs/features/vercel-fly-neon-deployment/status.md` — it is a pre-existing `M` from a blocked feature and is excluded from the scoped clean check. If a verify command fails, report `blocked` with the exact command and output — do not edit T1/T2 files outside `files_owned`; the orchestrator routes the fix. Record the feature commit SHAs, the baseline Vercel status, and the rollback recipe from `plan.md` § Rollback in the log.

### T3 verify

```bash
BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/project-only-skills/build-log-T1.md | head -1)

# AC-1: deleted paths absent and untracked
test ! -e .agents
test ! -e skills-lock.json
test -z "$(git ls-files -- '.agents/**' 'skills-lock.json')"
test -z "$(git status --porcelain -- .agents skills-lock.json)"

# AC-2: only the six project skills, byte-identical to baseline
test "$(find .opencode/skills -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 6
for id in orchestration-playbook spec-authoring spec-review task-decomposition web-implementation code-review; do test -f ".opencode/skills/$id/SKILL.md"; done
git diff --exit-code "$BASE_SHA" -- .opencode/skills

# AC-3 re-check: exact skill sequences, total skill-rule count, non-skill parity vs BASE_SHA
BASE_SHA="$BASE_SHA" node -e '
const fs=require("fs"), assert=require("assert"), {execFileSync}=require("child_process");
const agents=["orchestrator","planner","builder","reviewer"];
const expected={orchestrator:["orchestration-playbook"],planner:["spec-authoring","task-decomposition"],builder:["web-implementation"],reviewer:["spec-review","code-review"]};
const fmOf=(text)=>{const parts=text.split(/^---\s*$/m); assert.ok(parts.length>=3,"missing frontmatter"); return parts[1];};
const parse=(fm)=>{
  const rules=[]; let cur=null;
  for (const line of fm.split(/\r?\n/)) {
    const start=line.match(/^\s*-\s*action:\s*(\S+)\s*$/);
    if (start) { if (cur) rules.push(cur); cur={action:start[1].replace(/^["\x27]|["\x27]$/g,""),resource:null,effect:null}; continue; }
    if (!cur) continue;
    const resource=line.match(/^\s*resource:\s*"([^"]*)"\s*$/);
    if (resource) { cur.resource=resource[1]; continue; }
    const effect=line.match(/^\s*effect:\s*(\S+)\s*$/);
    if (effect) { cur.effect=effect[1]; continue; }
  }
  if (cur) rules.push(cur);
  for (const rule of rules) assert.ok(rule.resource!==null && rule.effect,"unparsed permission rule: "+JSON.stringify(rule));
  return rules;
};
const canon=(rule)=>`${rule.action}|${rule.resource}|${rule.effect}`;
for (const agent of agents) {
  const fm=fmOf(fs.readFileSync(`.opencode/agents/${agent}.md`,"utf8"));
  const baseFm=fmOf(execFileSync("git",["show",`${process.env.BASE_SHA}:.opencode/agents/${agent}.md`],{encoding:"utf8"}));
  const work=parse(fm), base=parse(baseFm);
  const skillOccurrences=(fm.match(/\baction:\s*["\x27]?skill["\x27]?\b/g)||[]).length;
  const skillRules=work.filter((rule)=>rule.action==="skill");
  assert.strictEqual(skillOccurrences,skillRules.length,`${agent}: unmatched action: skill rule`);
  assert.deepStrictEqual(skillRules.map(canon),[`skill|*|deny`,...expected[agent].map((id)=>`skill|${id}|allow`)],`${agent}: skill sequence`);
  assert.deepStrictEqual(work.filter((rule)=>rule.action!=="skill").map(canon),base.filter((rule)=>rule.action!=="skill").map(canon),`${agent}: non-skill permission changed`);
}
console.log("agent frontmatter: skill sequences, total count, and non-skill parity OK");
'

# AC-4 re-check: no deleted pack ID / advisory bullet in agent prompts
node -e '
const fs=require("fs");
const ids="baseline-ui brainstorming component-canvas create-canvas create-design-md deploy-to-vercel executing-plans fixing-accessibility fixing-metadata fixing-motion-performance improve-ui neon-postgres openai-docs receiving-code-review subagent-driven-development systematic-debugging test-driven-development threejs-animation threejs-asset-pipeline threejs-fundamentals threejs-geometry threejs-interaction threejs-lighting threejs-loaders threejs-materials threejs-performance threejs-postprocessing threejs-react-three-fiber threejs-shaders threejs-textures ui-skills-root verification-before-completion writing-plans".split(" ");
let bad=false;
for (const agent of ["orchestrator","planner","builder","reviewer"]) {
  const text=fs.readFileSync(`.opencode/agents/${agent}.md`,"utf8");
  for (const id of ids) if (text.includes(id)) { console.error(`${agent}: ${id}`); bad=true; }
  if (/imported skills are advisory/i.test(text)) { console.error(`${agent}: advisory bullet`); bad=true; }
}
process.exit(bad?1:0);
'

# AC-5/AC-6/AC-7 re-check
for h in "## Canonical location" "## Precedence and ID rules" "## Per-agent skill policy" "## Maintenance" "## Verification" "## History"; do grep -qF "$h" docs/architecture/skills.md || exit 1; done
grep -qF 'Context7 MCP' docs/architecture/skills.md
! grep -nE '\.agents|skills-lock|Imported pack inventory|Excluded and unassigned packs|Binding vs advisory' docs/architecture/skills.md
! grep -niE '\.agents|skills-lock|imported|advisory' AGENTS.md README.md docs/architecture/documentation.md
grep -qF 'podman compose' AGENTS.md
grep -qF 'four-agent pipeline' AGENTS.md
grep -qF 'podman compose up' README.md
test -f .opencode/skills/orchestration-playbook/SKILL.md
git diff --exit-code "$BASE_SHA" -- docs/architecture/documentation.md

# AC-8: no live reference to the deleted paths
! grep -rnE '\.agents/skills|skills-lock\.json' AGENTS.md README.md opencode.jsonc .opencode docs/architecture

# AC-9: supersession recorded; historical artifacts untouched
grep -qF '## Supersession note' docs/features/project-only-skills/spec.md
grep -qF 'agent-skill-migration' docs/features/project-only-skills/spec.md
git diff --exit-code "$BASE_SHA" -- docs/features/agent-skill-migration

# AC-10: no application/container/CI/deploy changes vs baseline
git diff --exit-code "$BASE_SHA" -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json .github opencode.jsonc

# AC-10: full gate
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build

# AC-11: bookkeeping, reviews staging, scoped clean tree; unrelated Vercel status excluded
git log --oneline "$BASE_SHA"..HEAD -- .agents skills-lock.json .opencode/agents AGENTS.md README.md docs/architecture/skills.md
git add docs/features/project-only-skills/spec.md docs/features/project-only-skills/plan.md docs/features/project-only-skills/tasks.md docs/features/project-only-skills/status.md docs/features/project-only-skills/reviews docs/features/project-only-skills/build-log-T3.md
test -z "$(git diff --cached --name-only -- docs/features/vercel-fly-neon-deployment/status.md)"
git commit -m "docs: project-only-skills verification evidence"
test -z "$(git status --porcelain -- docs/features/project-only-skills .opencode .agents skills-lock.json AGENTS.md README.md docs/architecture)"
test -z "$(git log --oneline "$BASE_SHA"..HEAD -- docs/features/vercel-fly-neon-deployment/status.md)"
```

## Acceptance mapping

| AC | Verified in |
| --- | --- |
| AC-1 | T1, T3 |
| AC-2 | T1, T3 |
| AC-3 | T2, T3 |
| AC-4 | T2, T3 |
| AC-5 | T2, T3 |
| AC-6 | T2, T3 |
| AC-7 | T2, T3 |
| AC-8 | T2, T3 |
| AC-9 | T3 |
| AC-10 | T3 |
| AC-11 | T1, T2, T3 |

## Documentation impact

T2 performs the documentation changes (`docs/architecture/skills.md`, `AGENTS.md`, `README.md`, and the `documentation.md` audit) in the same change as the configuration change. The orchestrator-owned `docs/features/README.md` row is applied at acceptance per `docs/architecture/documentation.md`; the builder does not edit it.
