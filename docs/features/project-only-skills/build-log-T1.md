# Build log — T1 — Delete imported packs and lockfile

Task: T1 (2026-11-15) — `docs/features/project-only-skills/tasks.md` (acceptance: AC-1, AC-2; gate contribution to AC-10)

BASE_SHA=7b87cbbfc6821bc2664c3062de0e42d57043a031

Files changed:
- `.agents/skills/**` — deleted: 33 skill directories, 79 tracked files (all tracked; 0 untracked).
- `.agents/` — removed (`git rm` pruned the then-empty parent automatically).
- `skills-lock.json` — deleted (33 pinned entries).
- `docs/features/project-only-skills/build-log-T1.md` — this log (new).

What changed & why (≤5 lines):
- All 33 imported third-party skill packs under `.agents/skills/` and `skills-lock.json` were removed; no other path was edited.
- `.opencode/skills/` is untouched and byte-identical to `BASE_SHA` (the six project pipeline skills, 18 tracked files).
- No agent prompt, policy doc, source, test, container, workflow, package, or deployment file was edited; those are T2/T3.
- The pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` was recorded and left untouched and unstaged.

Decisions:
- **No `-f`, no `rm -rf`, no `git clean`.** The pre-deletion `git status --porcelain -- .agents` was empty and every file was a regular tracked file (modes `100644`/`100755` only, 0 symlinks, no submodule entries), so `git rm -r -- .agents/skills` and `git rm -- skills-lock.json` succeeded without force.
- **The `blocked` inventory gate did not trigger.** `.agents/` had exactly one top-level entry (`skills`), 33 immediate subdirectories, 33 of them containing a top-level `SKILL.md`, 0 untracked files under `.agents` (`--untracked-files=all`), and the 33 names equal the spec's § Scope inventory set.
- **`.agents/` removal was implicit.** `git rm -r` deletes now-empty parent directories, so `.agents/` was already gone when the verify block reached `rm -r -- .agents`; that command reported `rm: cannot remove '.agents': No such file or directory` (exit 1) and `find .agents` reported `No such file or directory`. The required end state was re-asserted with `test ! -e .agents` (exit 0). Nothing else was removed.
- **Unit tier = the static assertions below.** This feature has no runtime code (spec § Testing strategy), so there are no new `*.test.ts` files; the deterministic static checks are the unit tier and `lint`/`typecheck`/`coverage` are the integration gate.
- **Post-commit assertions live in the Subagent Report.** The final `test -z "$(git status --porcelain -- .agents skills-lock.json)"` (after the commit) and `git show --stat --oneline HEAD` cannot be inside the commit's own log without a second commit; following the `agent-skill-migration` T4 precedent they are recorded in the Subagent Report instead.

## Evidence

### 1. Baseline + inventory (recorded before any deletion)

```text
$ BASE_SHA=$(git rev-parse HEAD); echo "BASE_SHA=$BASE_SHA"
BASE_SHA=7b87cbbfc6821bc2664c3062de0e42d57043a031

$ git status --porcelain
 M docs/features/vercel-fly-neon-deployment/status.md
?? docs/features/project-only-skills/

$ git status --porcelain -- docs/features/vercel-fly-neon-deployment/status.md
 M docs/features/vercel-fly-neon-deployment/status.md

$ find .agents/skills -mindepth 1 -maxdepth 1 -type d | sort
.agents/skills/baseline-ui
.agents/skills/brainstorming
.agents/skills/component-canvas
.agents/skills/create-canvas
.agents/skills/create-design-md
.agents/skills/deploy-to-vercel
.agents/skills/executing-plans
.agents/skills/fixing-accessibility
.agents/skills/fixing-metadata
.agents/skills/fixing-motion-performance
.agents/skills/improve-ui
.agents/skills/neon-postgres
.agents/skills/openai-docs
.agents/skills/receiving-code-review
.agents/skills/subagent-driven-development
.agents/skills/systematic-debugging
.agents/skills/test-driven-development
.agents/skills/threejs-animation
.agents/skills/threejs-asset-pipeline
.agents/skills/threejs-fundamentals
.agents/skills/threejs-geometry
.agents/skills/threejs-interaction
.agents/skills/threejs-lighting
.agents/skills/threejs-loaders
.agents/skills/threejs-materials
.agents/skills/threejs-performance
.agents/skills/threejs-postprocessing
.agents/skills/threejs-react-three-fiber
.agents/skills/threejs-shaders
.agents/skills/threejs-textures
.agents/skills/ui-skills-root
.agents/skills/verification-before-completion
.agents/skills/writing-plans

$ test "$(find .agents/skills -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 33; echo "exit=$?"
exit=0

$ test "$(find .agents/skills -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)" -eq 33; echo "exit=$?"
exit=0

$ find .agents -mindepth 1 -maxdepth 1 ! -name skills -print
$ test -z "$(find .agents -mindepth 1 -maxdepth 1 ! -name skills -print)"; echo "exit=$?"
exit=0

$ git ls-files .agents | wc -l
79
$ git status --porcelain -- .agents
(end)
```

### 2. `.agents` full file list and `git ls-files` set equality

`find .agents -type f | sort` printed the 79 files below; the raw `git ls-files .agents` list is the same set in git index (byte) order — a `LC_ALL=C sort` comparison of the two lists is empty (`diff` exit 0, "set-equal: find .agents -type f == git ls-files .agents (79 files)").

```text
$ find .agents -type f | sort
.agents/skills/baseline-ui/SKILL.md
.agents/skills/brainstorming/builder-check-prompt.md
.agents/skills/brainstorming/scripts/frame-template.html
.agents/skills/brainstorming/scripts/helper.js
.agents/skills/brainstorming/scripts/server.cjs
.agents/skills/brainstorming/scripts/start-server.sh
.agents/skills/brainstorming/scripts/stop-server.sh
.agents/skills/brainstorming/SKILL.md
.agents/skills/brainstorming/visual-companion.md
.agents/skills/component-canvas/SKILL.md
.agents/skills/create-canvas/SKILL.md
.agents/skills/create-design-md/SKILL.md
.agents/skills/deploy-to-vercel/SKILL.md
.agents/skills/executing-plans/scripts/task-done
.agents/skills/executing-plans/scripts/task-start
.agents/skills/executing-plans/SKILL.md
.agents/skills/fixing-accessibility/SKILL.md
.agents/skills/fixing-metadata/SKILL.md
.agents/skills/fixing-motion-performance/SKILL.md
.agents/skills/improve-ui/agents/openai.yaml
.agents/skills/improve-ui/references/plan-template.md
.agents/skills/improve-ui/SKILL.md
.agents/skills/neon-postgres/references/branching.md
.agents/skills/neon-postgres/references/egress-optimization.md
.agents/skills/neon-postgres/references/full-text-search.md
.agents/skills/neon-postgres/references/hybrid-search.md
.agents/skills/neon-postgres/references/lakebase-search-drizzle.md
.agents/skills/neon-postgres/references/vector-search.md
.agents/skills/neon-postgres/SKILL.md
.agents/skills/openai-docs/agents/openai.yaml
.agents/skills/openai-docs/assets/openai.png
.agents/skills/openai-docs/assets/openai-small.svg
.agents/skills/openai-docs/LICENSE.txt
.agents/skills/openai-docs/references/latest-model.md
.agents/skills/openai-docs/references/prompting-guide.md
.agents/skills/openai-docs/references/upgrade-guide.md
.agents/skills/openai-docs/scripts/fetch-codex-manual.mjs
.agents/skills/openai-docs/scripts/resolve-latest-model-info.js
.agents/skills/openai-docs/SKILL.md
.agents/skills/receiving-code-review/SKILL.md
.agents/skills/subagent-driven-development/implementer-prompt.md
.agents/skills/subagent-driven-development/references/batching.md
.agents/skills/subagent-driven-development/references/cannot-verify.md
.agents/skills/subagent-driven-development/references/final-review.md
.agents/skills/subagent-driven-development/references/fix-loop.md
.agents/skills/subagent-driven-development/references/handling-reports.md
.agents/skills/subagent-driven-development/references/preflight.md
.agents/skills/subagent-driven-development/references/resuming.md
.agents/skills/subagent-driven-development/re-review-prompt.md
.agents/skills/subagent-driven-development/scripts/review-package
.agents/skills/subagent-driven-development/scripts/sdd-repo
.agents/skills/subagent-driven-development/scripts/sdd-workspace
.agents/skills/subagent-driven-development/scripts/task-brief
.agents/skills/subagent-driven-development/SKILL.md
.agents/skills/subagent-driven-development/task-reviewer-prompt.md
.agents/skills/systematic-debugging/condition-based-waiting-example.ts
.agents/skills/systematic-debugging/condition-based-waiting.md
.agents/skills/systematic-debugging/defense-in-depth.md
.agents/skills/systematic-debugging/find-polluter.sh
.agents/skills/systematic-debugging/root-cause-tracing.md
.agents/skills/systematic-debugging/SKILL.md
.agents/skills/test-driven-development/SKILL.md
.agents/skills/test-driven-development/writing-good-tests.md
.agents/skills/threejs-animation/SKILL.md
.agents/skills/threejs-asset-pipeline/SKILL.md
.agents/skills/threejs-fundamentals/SKILL.md
.agents/skills/threejs-geometry/SKILL.md
.agents/skills/threejs-interaction/SKILL.md
.agents/skills/threejs-lighting/SKILL.md
.agents/skills/threejs-loaders/SKILL.md
.agents/skills/threejs-materials/SKILL.md
.agents/skills/threejs-performance/SKILL.md
.agents/skills/threejs-postprocessing/SKILL.md
.agents/skills/threejs-react-three-fiber/SKILL.md
.agents/skills/threejs-shaders/SKILL.md
.agents/skills/threejs-textures/SKILL.md
.agents/skills/ui-skills-root/SKILL.md
.agents/skills/verification-before-completion/SKILL.md
.agents/skills/writing-plans/SKILL.md
```

```text
$ git ls-files .agents
.agents/skills/baseline-ui/SKILL.md
.agents/skills/brainstorming/SKILL.md
.agents/skills/brainstorming/builder-check-prompt.md
.agents/skills/brainstorming/scripts/frame-template.html
.agents/skills/brainstorming/scripts/helper.js
.agents/skills/brainstorming/scripts/server.cjs
.agents/skills/brainstorming/scripts/start-server.sh
.agents/skills/brainstorming/scripts/stop-server.sh
.agents/skills/brainstorming/visual-companion.md
.agents/skills/component-canvas/SKILL.md
.agents/skills/create-canvas/SKILL.md
.agents/skills/create-design-md/SKILL.md
.agents/skills/deploy-to-vercel/SKILL.md
.agents/skills/executing-plans/SKILL.md
.agents/skills/executing-plans/scripts/task-done
.agents/skills/executing-plans/scripts/task-start
.agents/skills/fixing-accessibility/SKILL.md
.agents/skills/fixing-metadata/SKILL.md
.agents/skills/fixing-motion-performance/SKILL.md
.agents/skills/improve-ui/SKILL.md
.agents/skills/improve-ui/agents/openai.yaml
.agents/skills/improve-ui/references/plan-template.md
.agents/skills/neon-postgres/SKILL.md
.agents/skills/neon-postgres/references/branching.md
.agents/skills/neon-postgres/references/egress-optimization.md
.agents/skills/neon-postgres/references/full-text-search.md
.agents/skills/neon-postgres/references/hybrid-search.md
.agents/skills/neon-postgres/references/lakebase-search-drizzle.md
.agents/skills/neon-postgres/references/vector-search.md
.agents/skills/openai-docs/LICENSE.txt
.agents/skills/openai-docs/SKILL.md
.agents/skills/openai-docs/agents/openai.yaml
.agents/skills/openai-docs/assets/openai-small.svg
.agents/skills/openai-docs/assets/openai.png
.agents/skills/openai-docs/references/latest-model.md
.agents/skills/openai-docs/references/prompting-guide.md
.agents/skills/openai-docs/references/upgrade-guide.md
.agents/skills/openai-docs/scripts/fetch-codex-manual.mjs
.agents/skills/openai-docs/scripts/resolve-latest-model-info.js
.agents/skills/receiving-code-review/SKILL.md
.agents/skills/subagent-driven-development/SKILL.md
.agents/skills/subagent-driven-development/implementer-prompt.md
.agents/skills/subagent-driven-development/re-review-prompt.md
.agents/skills/subagent-driven-development/references/batching.md
.agents/skills/subagent-driven-development/references/cannot-verify.md
.agents/skills/subagent-driven-development/references/final-review.md
.agents/skills/subagent-driven-development/references/fix-loop.md
.agents/skills/subagent-driven-development/references/handling-reports.md
.agents/skills/subagent-driven-development/references/preflight.md
.agents/skills/subagent-driven-development/references/resuming.md
.agents/skills/subagent-driven-development/scripts/review-package
.agents/skills/subagent-driven-development/scripts/sdd-repo
.agents/skills/subagent-driven-development/scripts/sdd-workspace
.agents/skills/subagent-driven-development/scripts/task-brief
.agents/skills/subagent-driven-development/task-reviewer-prompt.md
.agents/skills/systematic-debugging/SKILL.md
.agents/skills/systematic-debugging/condition-based-waiting-example.ts
.agents/skills/systematic-debugging/condition-based-waiting.md
.agents/skills/systematic-debugging/defense-in-depth.md
.agents/skills/systematic-debugging/find-polluter.sh
.agents/skills/systematic-debugging/root-cause-tracing.md
.agents/skills/test-driven-development/SKILL.md
.agents/skills/test-driven-development/writing-good-tests.md
.agents/skills/threejs-animation/SKILL.md
.agents/skills/threejs-asset-pipeline/SKILL.md
.agents/skills/threejs-fundamentals/SKILL.md
.agents/skills/threejs-geometry/SKILL.md
.agents/skills/threejs-interaction/SKILL.md
.agents/skills/threejs-lighting/SKILL.md
.agents/skills/threejs-loaders/SKILL.md
.agents/skills/threejs-materials/SKILL.md
.agents/skills/threejs-performance/SKILL.md
.agents/skills/threejs-postprocessing/SKILL.md
.agents/skills/threejs-react-three-fiber/SKILL.md
.agents/skills/threejs-shaders/SKILL.md
.agents/skills/threejs-textures/SKILL.md
.agents/skills/ui-skills-root/SKILL.md
.agents/skills/verification-before-completion/SKILL.md
.agents/skills/writing-plans/SKILL.md
```

`skills-lock.json`: 33 entries (`baseline-ui brainstorming component-canvas create-canvas create-design-md deploy-to-vercel executing-plans fixing-accessibility fixing-metadata fixing-motion-performance improve-ui neon-postgres openai-docs receiving-code-review subagent-driven-development systematic-debugging test-driven-development threejs-animation threejs-asset-pipeline threejs-fundamentals threejs-geometry threejs-interaction threejs-lighting threejs-loaders threejs-materials threejs-performance threejs-postprocessing threejs-react-three-fiber threejs-shaders threejs-textures ui-skills-root verification-before-completion writing-plans`), matching the 33 directories.

### 3. Deletion

```text
$ git rm -r -- .agents/skills
rm '.agents/skills/baseline-ui/SKILL.md'
rm '.agents/skills/brainstorming/SKILL.md'
rm '.agents/skills/brainstorming/builder-check-prompt.md'
rm '.agents/skills/brainstorming/scripts/frame-template.html'
rm '.agents/skills/brainstorming/scripts/helper.js'
rm '.agents/skills/brainstorming/scripts/server.cjs'
rm '.agents/skills/brainstorming/scripts/start-server.sh'
rm '.agents/skills/brainstorming/scripts/stop-server.sh'
rm '.agents/skills/brainstorming/visual-companion.md'
rm '.agents/skills/component-canvas/SKILL.md'
rm '.agents/skills/create-canvas/SKILL.md'
rm '.agents/skills/create-design-md/SKILL.md'
rm '.agents/skills/deploy-to-vercel/SKILL.md'
rm '.agents/skills/executing-plans/SKILL.md'
rm '.agents/skills/executing-plans/scripts/task-done'
rm '.agents/skills/executing-plans/scripts/task-start'
rm '.agents/skills/fixing-accessibility/SKILL.md'
rm '.agents/skills/fixing-metadata/SKILL.md'
rm '.agents/skills/fixing-motion-performance/SKILL.md'
rm '.agents/skills/improve-ui/SKILL.md'
rm '.agents/skills/improve-ui/agents/openai.yaml'
rm '.agents/skills/improve-ui/references/plan-template.md'
rm '.agents/skills/neon-postgres/SKILL.md'
rm '.agents/skills/neon-postgres/references/branching.md'
rm '.agents/skills/neon-postgres/references/egress-optimization.md'
rm '.agents/skills/neon-postgres/references/full-text-search.md'
rm '.agents/skills/neon-postgres/references/hybrid-search.md'
rm '.agents/skills/neon-postgres/references/lakebase-search-drizzle.md'
rm '.agents/skills/neon-postgres/references/vector-search.md'
rm '.agents/skills/openai-docs/LICENSE.txt'
rm '.agents/skills/openai-docs/SKILL.md'
rm '.agents/skills/openai-docs/agents/openai.yaml'
rm '.agents/skills/openai-docs/assets/openai-small.svg'
rm '.agents/skills/openai-docs/assets/openai.png'
rm '.agents/skills/openai-docs/references/latest-model.md'
rm '.agents/skills/openai-docs/references/prompting-guide.md'
rm '.agents/skills/openai-docs/references/upgrade-guide.md'
rm '.agents/skills/openai-docs/scripts/fetch-codex-manual.mjs'
rm '.agents/skills/openai-docs/scripts/resolve-latest-model-info.js'
rm '.agents/skills/receiving-code-review/SKILL.md'
rm '.agents/skills/subagent-driven-development/SKILL.md'
rm '.agents/skills/subagent-driven-development/implementer-prompt.md'
rm '.agents/skills/subagent-driven-development/re-review-prompt.md'
rm '.agents/skills/subagent-driven-development/references/batching.md'
rm '.agents/skills/subagent-driven-development/references/cannot-verify.md'
rm '.agents/skills/subagent-driven-development/references/final-review.md'
rm '.agents/skills/subagent-driven-development/references/fix-loop.md'
rm '.agents/skills/subagent-driven-development/references/handling-reports.md'
rm '.agents/skills/subagent-driven-development/references/preflight.md'
rm '.agents/skills/subagent-driven-development/references/resuming.md'
rm '.agents/skills/subagent-driven-development/scripts/review-package'
rm '.agents/skills/subagent-driven-development/scripts/sdd-repo'
rm '.agents/skills/subagent-driven-development/scripts/sdd-workspace'
rm '.agents/skills/subagent-driven-development/scripts/task-brief'
rm '.agents/skills/subagent-driven-development/task-reviewer-prompt.md'
rm '.agents/skills/systematic-debugging/SKILL.md'
rm '.agents/skills/systematic-debugging/condition-based-waiting-example.ts'
rm '.agents/skills/systematic-debugging/condition-based-waiting.md'
rm '.agents/skills/systematic-debugging/defense-in-depth.md'
rm '.agents/skills/systematic-debugging/find-polluter.sh'
rm '.agents/skills/systematic-debugging/root-cause-tracing.md'
rm '.agents/skills/test-driven-development/SKILL.md'
rm '.agents/skills/test-driven-development/writing-good-tests.md'
rm '.agents/skills/threejs-animation/SKILL.md'
rm '.agents/skills/threejs-asset-pipeline/SKILL.md'
rm '.agents/skills/threejs-fundamentals/SKILL.md'
rm '.agents/skills/threejs-geometry/SKILL.md'
rm '.agents/skills/threejs-interaction/SKILL.md'
rm '.agents/skills/threejs-lighting/SKILL.md'
rm '.agents/skills/threejs-loaders/SKILL.md'
rm '.agents/skills/threejs-materials/SKILL.md'
rm '.agents/skills/threejs-performance/SKILL.md'
rm '.agents/skills/threejs-postprocessing/SKILL.md'
rm '.agents/skills/threejs-react-three-fiber/SKILL.md'
rm '.agents/skills/threejs-shaders/SKILL.md'
rm '.agents/skills/threejs-textures/SKILL.md'
rm '.agents/skills/ui-skills-root/SKILL.md'
rm '.agents/skills/verification-before-completion/SKILL.md'
rm '.agents/skills/writing-plans/SKILL.md'
exit=0

$ git rm -- skills-lock.json
rm 'skills-lock.json'
exit=0

$ test -z "$(find .agents -type f -print)"; echo "exit=$?"
find: ‘.agents’: No such file or directory
exit=0

$ find .agents -print
find: ‘.agents’: No such file or directory

$ rm -r -- .agents; echo "exit=$?"
rm: cannot remove '.agents': No such file or directory
exit=1
```

`git rm -r` reported deletion of 79 files with `exit=0`; `git rm -- skills-lock.json` reported `rm 'skills-lock.json'` with `exit=0`. No `-f` was needed (no local modifications were reported by `git status --porcelain -- .agents` at baseline).

### 4. Post-deletion verification

```text
$ BASE_SHA=7b87cbbfc6821bc2664c3062de0e42d57043a031

$ test ! -e .agents; echo "exit=$?"
exit=0
$ test ! -e skills-lock.json; echo "exit=$?"
exit=0
$ test -z "$(git ls-files -- ".agents/**" "skills-lock.json")"; echo "exit=$?"
exit=0
$ git ls-files -- ".agents/**" "skills-lock.json"
(none above)
$ test -z "$(git status --porcelain -- .agents skills-lock.json)"; echo "exit=$?"
exit=1
$ git status --porcelain -- .agents skills-lock.json
D  .agents/skills/baseline-ui/SKILL.md
D  .agents/skills/brainstorming/SKILL.md
D  .agents/skills/brainstorming/builder-check-prompt.md
D  .agents/skills/brainstorming/scripts/frame-template.html
D  .agents/skills/brainstorming/scripts/helper.js
D  .agents/skills/brainstorming/scripts/server.cjs
D  .agents/skills/brainstorming/scripts/start-server.sh
D  .agents/skills/brainstorming/scripts/stop-server.sh
D  .agents/skills/brainstorming/visual-companion.md
D  .agents/skills/component-canvas/SKILL.md
D  .agents/skills/create-canvas/SKILL.md
D  .agents/skills/create-design-md/SKILL.md
D  .agents/skills/deploy-to-vercel/SKILL.md
D  .agents/skills/executing-plans/SKILL.md
D  .agents/skills/executing-plans/scripts/task-done
D  .agents/skills/executing-plans/scripts/task-start
D  .agents/skills/fixing-accessibility/SKILL.md
D  .agents/skills/fixing-metadata/SKILL.md
D  .agents/skills/fixing-motion-performance/SKILL.md
D  .agents/skills/improve-ui/SKILL.md
D  .agents/skills/improve-ui/agents/openai.yaml
D  .agents/skills/improve-ui/references/plan-template.md
D  .agents/skills/neon-postgres/SKILL.md
D  .agents/skills/neon-postgres/references/branching.md
D  .agents/skills/neon-postgres/references/egress-optimization.md
D  .agents/skills/neon-postgres/references/full-text-search.md
D  .agents/skills/neon-postgres/references/hybrid-search.md
D  .agents/skills/neon-postgres/references/lakebase-search-drizzle.md
D  .agents/skills/neon-postgres/references/vector-search.md
D  .agents/skills/openai-docs/LICENSE.txt
D  .agents/skills/openai-docs/SKILL.md
D  .agents/skills/openai-docs/agents/openai.yaml
D  .agents/skills/openai-docs/assets/openai-small.svg
D  .agents/skills/openai-docs/assets/openai.png
D  .agents/skills/openai-docs/references/latest-model.md
D  .agents/skills/openai-docs/references/prompting-guide.md
D  .agents/skills/openai-docs/references/upgrade-guide.md
D  .agents/skills/openai-docs/scripts/fetch-codex-manual.mjs
D  .agents/skills/openai-docs/scripts/resolve-latest-model-info.js
D  .agents/skills/receiving-code-review/SKILL.md
D  .agents/skills/subagent-driven-development/SKILL.md
D  .agents/skills/subagent-driven-development/implementer-prompt.md
D  .agents/skills/subagent-driven-development/re-review-prompt.md
D  .agents/skills/subagent-driven-development/references/batching.md
D  .agents/skills/subagent-driven-development/references/cannot-verify.md
D  .agents/skills/subagent-driven-development/references/final-review.md
D  .agents/skills/subagent-driven-development/references/fix-loop.md
D  .agents/skills/subagent-driven-development/references/handling-reports.md
D  .agents/skills/subagent-driven-development/references/preflight.md
D  .agents/skills/subagent-driven-development/references/resuming.md
D  .agents/skills/subagent-driven-development/scripts/review-package
D  .agents/skills/subagent-driven-development/scripts/sdd-repo
D  .agents/skills/subagent-driven-development/scripts/sdd-workspace
D  .agents/skills/subagent-driven-development/scripts/task-brief
D  .agents/skills/subagent-driven-development/task-reviewer-prompt.md
D  .agents/skills/systematic-debugging/SKILL.md
D  .agents/skills/systematic-debugging/condition-based-waiting-example.ts
D  .agents/skills/systematic-debugging/condition-based-waiting.md
D  .agents/skills/systematic-debugging/defense-in-depth.md
D  .agents/skills/systematic-debugging/find-polluter.sh
D  .agents/skills/systematic-debugging/root-cause-tracing.md
D  .agents/skills/test-driven-development/SKILL.md
D  .agents/skills/test-driven-development/writing-good-tests.md
D  .agents/skills/threejs-animation/SKILL.md
D  .agents/skills/threejs-asset-pipeline/SKILL.md
D  .agents/skills/threejs-fundamentals/SKILL.md
D  .agents/skills/threejs-geometry/SKILL.md
D  .agents/skills/threejs-interaction/SKILL.md
D  .agents/skills/threejs-lighting/SKILL.md
D  .agents/skills/threejs-loaders/SKILL.md
D  .agents/skills/threejs-materials/SKILL.md
D  .agents/skills/threejs-performance/SKILL.md
D  .agents/skills/threejs-postprocessing/SKILL.md
D  .agents/skills/threejs-react-three-fiber/SKILL.md
D  .agents/skills/threejs-shaders/SKILL.md
D  .agents/skills/threejs-textures/SKILL.md
D  .agents/skills/ui-skills-root/SKILL.md
D  .agents/skills/verification-before-completion/SKILL.md
D  .agents/skills/writing-plans/SKILL.md
D  skills-lock.json
(none above)

$ test "$(find .opencode/skills -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 6; echo "exit=$?"
exit=0
$ for id in orchestration-playbook spec-authoring spec-review task-decomposition web-implementation code-review; do test -f ".opencode/skills/$id/SKILL.md" || exit 1; done; echo "exit=$?"
exit=0
$ git diff --exit-code "$BASE_SHA" -- .opencode/skills; echo "exit=$?"
exit=0

$ git diff --name-status "$BASE_SHA" -- .agents skills-lock.json
D	.agents/skills/baseline-ui/SKILL.md
D	.agents/skills/brainstorming/SKILL.md
D	.agents/skills/brainstorming/builder-check-prompt.md
D	.agents/skills/brainstorming/scripts/frame-template.html
D	.agents/skills/brainstorming/scripts/helper.js
D	.agents/skills/brainstorming/scripts/server.cjs
D	.agents/skills/brainstorming/scripts/start-server.sh
D	.agents/skills/brainstorming/scripts/stop-server.sh
D	.agents/skills/brainstorming/visual-companion.md
D	.agents/skills/component-canvas/SKILL.md
D	.agents/skills/create-canvas/SKILL.md
D	.agents/skills/create-design-md/SKILL.md
D	.agents/skills/deploy-to-vercel/SKILL.md
D	.agents/skills/executing-plans/SKILL.md
D	.agents/skills/executing-plans/scripts/task-done
D	.agents/skills/executing-plans/scripts/task-start
D	.agents/skills/fixing-accessibility/SKILL.md
D	.agents/skills/fixing-metadata/SKILL.md
D	.agents/skills/fixing-motion-performance/SKILL.md
D	.agents/skills/improve-ui/SKILL.md
D	.agents/skills/improve-ui/agents/openai.yaml
D	.agents/skills/improve-ui/references/plan-template.md
D	.agents/skills/neon-postgres/SKILL.md
D	.agents/skills/neon-postgres/references/branching.md
D	.agents/skills/neon-postgres/references/egress-optimization.md
D	.agents/skills/neon-postgres/references/full-text-search.md
D	.agents/skills/neon-postgres/references/hybrid-search.md
D	.agents/skills/neon-postgres/references/lakebase-search-drizzle.md
D	.agents/skills/neon-postgres/references/vector-search.md
D	.agents/skills/openai-docs/LICENSE.txt
D	.agents/skills/openai-docs/SKILL.md
D	.agents/skills/openai-docs/agents/openai.yaml
D	.agents/skills/openai-docs/assets/openai-small.svg
D	.agents/skills/openai-docs/assets/openai.png
D	.agents/skills/openai-docs/references/latest-model.md
D	.agents/skills/openai-docs/references/prompting-guide.md
D	.agents/skills/openai-docs/references/upgrade-guide.md
D	.agents/skills/openai-docs/scripts/fetch-codex-manual.mjs
D	.agents/skills/openai-docs/scripts/resolve-latest-model-info.js
D	.agents/skills/receiving-code-review/SKILL.md
D	.agents/skills/subagent-driven-development/SKILL.md
D	.agents/skills/subagent-driven-development/implementer-prompt.md
D	.agents/skills/subagent-driven-development/re-review-prompt.md
D	.agents/skills/subagent-driven-development/references/batching.md
D	.agents/skills/subagent-driven-development/references/cannot-verify.md
D	.agents/skills/subagent-driven-development/references/final-review.md
D	.agents/skills/subagent-driven-development/references/fix-loop.md
D	.agents/skills/subagent-driven-development/references/handling-reports.md
D	.agents/skills/subagent-driven-development/references/preflight.md
D	.agents/skills/subagent-driven-development/references/resuming.md
D	.agents/skills/subagent-driven-development/scripts/review-package
D	.agents/skills/subagent-driven-development/scripts/sdd-repo
D	.agents/skills/subagent-driven-development/scripts/sdd-workspace
D	.agents/skills/subagent-driven-development/scripts/task-brief
D	.agents/skills/subagent-driven-development/task-reviewer-prompt.md
D	.agents/skills/systematic-debugging/SKILL.md
D	.agents/skills/systematic-debugging/condition-based-waiting-example.ts
D	.agents/skills/systematic-debugging/condition-based-waiting.md
D	.agents/skills/systematic-debugging/defense-in-depth.md
D	.agents/skills/systematic-debugging/find-polluter.sh
D	.agents/skills/systematic-debugging/root-cause-tracing.md
D	.agents/skills/test-driven-development/SKILL.md
D	.agents/skills/test-driven-development/writing-good-tests.md
D	.agents/skills/threejs-animation/SKILL.md
D	.agents/skills/threejs-asset-pipeline/SKILL.md
D	.agents/skills/threejs-fundamentals/SKILL.md
D	.agents/skills/threejs-geometry/SKILL.md
D	.agents/skills/threejs-interaction/SKILL.md
D	.agents/skills/threejs-lighting/SKILL.md
D	.agents/skills/threejs-loaders/SKILL.md
D	.agents/skills/threejs-materials/SKILL.md
D	.agents/skills/threejs-performance/SKILL.md
D	.agents/skills/threejs-postprocessing/SKILL.md
D	.agents/skills/threejs-react-three-fiber/SKILL.md
D	.agents/skills/threejs-shaders/SKILL.md
D	.agents/skills/threejs-textures/SKILL.md
D	.agents/skills/ui-skills-root/SKILL.md
D	.agents/skills/verification-before-completion/SKILL.md
D	.agents/skills/writing-plans/SKILL.md
D	skills-lock.json
(end)
```

Note on the pre-commit `test -z "$(git status --porcelain -- .agents skills-lock.json)"` from `tasks.md:47`: it exits 1 at this point **by construction**, because `git rm` stages the deletions and `git status --porcelain` lists staged changes (`D ` entries) until they are committed. The command's intended property — nothing left under the two paths and nothing untracked/modified there — is proven by the empty `git ls-files`, the `D`-only `git status` output above, and the post-commit run of the identical assertion (Subagent Report). `git diff --name-status "$BASE_SHA" -- .agents skills-lock.json` lists only `D` entries (80 paths: 79 files + `skills-lock.json`); no `A`/`M`/`R` entry exists.

### 5. Project skills preserved (`.opencode/skills`)

```text
$ test "$(git ls-files '.opencode/skills/*/SKILL.md' | wc -l)" -eq 6; echo "exit=$?"
exit=0
$ git ls-files ".opencode/skills/*/SKILL.md"
.opencode/skills/code-review/SKILL.md
.opencode/skills/orchestration-playbook/SKILL.md
.opencode/skills/spec-authoring/SKILL.md
.opencode/skills/spec-review/SKILL.md
.opencode/skills/task-decomposition/SKILL.md
.opencode/skills/web-implementation/SKILL.md
$ git ls-files .opencode/skills | wc -l
18
```

`test "$(find .opencode/skills -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 6` → `exit=0`; all six `SKILL.md` files exist (`exit=0`); `git diff --exit-code "$BASE_SHA" -- .opencode/skills` → `exit=0` (byte-identical).

### 6. Gates

```text
$ npm run lint

> lint
> eslint .

```

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

```text
$ npm run coverage

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/auth/user-repository.test.ts (40 tests) 21ms
 ✓ src/game/config.test.ts (13 tests) 7ms
 ✓ src/game/parts.test.ts (19 tests) 6ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/game/economy.test.ts (20 tests) 4ms
 ✓ src/db/migrate.test.ts (11 tests) 12ms
 ✓ src/auth/config.test.ts (29 tests) 16ms
 ✓ src/game/broadcast.test.ts (13 tests) 12ms
 ✓ src/game/cubes.test.ts (24 tests) 8ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/observability/metrics.test.ts (30 tests) 15ms
 ✓ src/db/migrate-runner.test.ts (14 tests) 12ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 22ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 11ms
 ✓ src/auth/session-repository.test.ts (35 tests) 20ms
 ✓ src/game/parts-v2.test.ts (40 tests) 18ms
 ✓ src/auth/email.test.ts (12 tests) 11ms
 ✓ src/game/players.test.ts (13 tests) 10ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 14ms
 ✓ src/game/servers.test.ts (47 tests) 173ms
 ✓ src/observability/logging.test.ts (28 tests) 138ms
 ✓ src/game/protocol.test.ts (182 tests) 31ms
 ✓ src/observability/config.test.ts (24 tests) 9ms
 ✓ src/auth/password.test.ts (17 tests) 326ms
 ✓ src/game/hub.test.ts (135 tests) 197ms
 ✓ src/cors.test.ts (15 tests) 134ms
 ✓ src/auth/auth-routes.test.ts (28 tests) 718ms
 ✓ src/auth/auth-service.test.ts (50 tests) 898ms
 ✓ src/auth/economy-repository.test.ts (119 tests) 2148ms
 ✓ src/db/migration-006.test.ts (13 tests) 2242ms
 ✓ src/db/migration-007.test.ts (11 tests) 2214ms
 ✓ src/app.test.ts (27 tests) 2282ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1113ms

 Test Files  32 passed (32)
      Tests  1110 passed (1110)
   Start at  08:44:31
   Duration  3.25s (transform 3.57s, setup 0ms, collect 9.74s, tests 11.74s, environment 6ms, prepare 3.58s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.25 |    88.68 |   99.53 |   95.25 |                   
 src               |   85.88 |       90 |     100 |   85.88 |                   
  app.ts           |   81.72 |     85.1 |     100 |   81.72 | ...59,172,249-266 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 src/auth          |   95.74 |    82.88 |     100 |   95.74 |                   
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 | ...61-363,369-370 
  auth-service.ts  |     100 |    81.63 |     100 |     100 | ...95,400,417,503 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   95.74 |    86.52 |     100 |   95.74 | ...69-770,826-839 
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    84.12 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |    98.8 |    89.53 |     100 |    98.8 | 61-62,315         
  ...repository.ts |   97.29 |    90.62 |     100 |   97.29 | 63-68             
 src/db            |   98.02 |    93.67 |     100 |   98.02 |                   
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83             
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108           
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
 src/game          |   94.63 |    93.21 |   98.85 |   94.63 |                   
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   89.98 |    87.71 |   98.27 |   89.98 | ...1506,1636-1637 
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   98.89 |    98.61 |   96.87 |   98.89 | 248-249,571-572   
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290           
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/observability |   99.59 |       96 |     100 |   99.59 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  logging.ts       |     100 |      100 |     100 |     100 |                   
  metrics.ts       |   99.44 |    93.54 |     100 |   99.44 | 243-244           
-------------------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/multiplayer/server-state.test.ts (52 tests) 9ms
 ✓ src/game/effects.test.ts (30 tests) 7ms
 ✓ src/ui/game-view.css.test.ts (45 tests) 16ms
 ✓ src/render/webgl.test.ts (22 tests) 15ms
 ✓ src/multiplayer/protocol.test.ts (256 tests) 25ms
 ✓ src/game/board.test.ts (18 tests) 16ms
 ✓ src/render/particles.test.ts (24 tests) 14ms
 ✓ src/render/impact-effects.test.ts (22 tests) 34ms
 ✓ src/auth/api.test.ts (31 tests) 13ms
 ✓ src/render/preview.test.ts (7 tests) 28ms
 ✓ src/multiplayer/transport.test.ts (15 tests) 14ms
 ✓ src/render/quality.test.ts (29 tests) 90ms
 ✓ src/render/starfield.test.ts (28 tests) 94ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 18ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 134ms
 ✓ src/input/gestures.test.ts (27 tests) 43ms
 ✓ src/render/targeting.test.ts (11 tests) 82ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 189ms
 ✓ src/game/engine.test.ts (113 tests) 120ms
 ✓ src/render/picking.test.ts (16 tests) 179ms
 ✓ src/render/spaceship.test.ts (40 tests) 124ms
 ✓ src/build/vite-config.test.ts (11 tests) 382ms
 ✓ src/render/postprocessing.test.ts (14 tests) 14ms
 ✓ src/auth/store.test.ts (31 tests) 26ms
 ✓ src/game/parts-v2.test.ts (50 tests) 34ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/render/cube-view.test.ts (37 tests) 321ms
 ✓ src/game/progression.test.ts (21 tests) 17ms
 ✓ src/ui/icons.test.tsx (16 tests) 35ms
 ✓ src/input/keyboard.test.ts (13 tests) 15ms
 ✓ src/render/background-life.test.ts (14 tests) 18ms
 ✓ src/render/ship-motion.test.ts (24 tests) 11ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 15ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 412ms
 ✓ src/game/upgrades.test.ts (20 tests) 10ms
 ✓ src/game/motion.test.ts (12 tests) 8ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 19ms
 ✓ src/render/world.test.ts (29 tests) 353ms
 ✓ src/ws/connection.test.ts (10 tests) 24ms
 ✓ src/ui/app.css.test.ts (87 tests) 37ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 253ms
 ✓ src/game/rotation.test.ts (15 tests) 11ms
 ✓ src/game/parts.test.ts (23 tests) 13ms
 ✓ src/build/bundle-budget.test.ts (11 tests) 9ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 8ms
 ✓ src/config.test.ts (20 tests) 8ms
 ✓ src/ui/theme.test.ts (11 tests) 12ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/build/nginx-config.test.ts (6 tests) 6ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 13ms
 ✓ src/render/scene-effects.test.ts (9 tests) 431ms
 ✓ src/game/economy.test.ts (7 tests) 6ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 6ms
 ✓ src/render/nebula.test.ts (11 tests) 891ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  716ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 898ms
 ✓ src/ui/Hud.test.tsx (20 tests) 187ms
 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 80ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders exactly ten slot rows in SLOT_CATALOG order with the section contract
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders exactly three variants per row in standard → rare → epic order
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 258ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > shows the slot display name and the equipped part name for every slot
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/GameCanvas.runtime.test.tsx (5 tests) 157ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > marks owned parts and exposes equipped/label states on the equip controls
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 75ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders a 44px-capable unequip control per slot, disabled at the standard part
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 251ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx (5 tests) 242ms
 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 313ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 506ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > calls onUnequip with the slot id only for an enabled control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > normalizes legacy direct props into the v2 slot rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-29) > calls onOpenLootbox once when the enabled control is clicked
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-29) > keeps the pre-v2 onOpen alias working
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/GameCanvas.test.tsx (7 tests) 250ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the rare/new grant region with the pinned data attributes and copy
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the epic/duplicate copy and the wireframe orb with an orange core
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > keeps the reveal, orb and card non-shrinking and fully visible at the reveal phase
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > restarts the timeline when the same part is reopened with a new sequence
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the settled reveal instantly under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > dismisses the reveal through onDismissReveal
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > equips the revealed part through the panel command
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > sets data-equipping on the equipped slot for exactly 260 ms
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > adds no row flash under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/AuthForms.test.tsx (44 tests) 1017ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  337ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 855ms
stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > passes pendingLootboxOpen to the panel and disables Open lootbox while pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > enables Open lootbox when the open is not pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > passes the last grant into the reveal region and dismisses it through the session
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/render/scene.test.ts (90 tests) 2581ms
stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > routes panel equip and unequip controls to the session commands
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/game/session.test.ts (96 tests) 2712ms
 ✓ src/App.test.tsx (41 tests) 1241ms

 Test Files  70 passed (70)
      Tests  1873 passed (1873)
   Start at  08:44:34
   Duration  4.30s (transform 8.60s, setup 0ms, collect 21.19s, tests 16.32s, environment 8.35s, prepare 7.49s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.48 |    96.14 |   97.56 |   96.48 |                   
 src               |   87.87 |    84.95 |   95.45 |   87.87 |                   
  App.tsx          |   86.22 |    81.91 |   96.42 |   86.22 | ...31-433,455-456 
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77             
  config.ts        |     100 |      100 |     100 |     100 |                   
 src/auth          |   96.85 |     86.2 |   96.15 |   96.85 |                   
  api.ts           |   96.44 |     87.5 |     100 |   96.44 | ...61-162,170,222 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   96.19 |    99.36 |   98.46 |   96.19 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.47 |      100 |     100 |   99.47 | 958-959,1250-1251 
  motion.ts        |     100 |      100 |     100 |     100 |                   
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   90.07 |    98.67 |   95.65 |   90.07 | ...1430,1549-1550 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |    93.4 |     96.6 |   95.89 |    93.4 |                   
  protocol.ts      |   89.13 |    96.04 |   90.32 |   89.13 | ...1076,1080-1090 
  server-state.ts  |   98.19 |    95.09 |     100 |   98.19 | ...19,321-322,380 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200               
 src/render        |   98.58 |    98.96 |   98.79 |   98.58 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |      100 |     100 |      99 | 299-300           
  cube-view.ts     |   99.24 |      100 |     100 |   99.24 | 336-337           
  cursor-ship.ts   |   99.54 |    97.61 |     100 |   99.54 | 208-209           
  ...ct-effects.ts |   98.64 |      100 |     100 |   98.64 | ...49-350,474-475 
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  preview.ts       |     100 |      100 |     100 |     100 |                   
  quality.ts       |   98.31 |      100 |     100 |   98.31 | 316-317,400-401   
  scene.ts         |   97.26 |    99.39 |   95.34 |   97.26 | ...1076,1084-1085 
  ship-motion.ts   |     100 |      100 |     100 |     100 |                   
  ...ship-model.ts |     100 |      100 |     100 |     100 |                   
  spaceship.ts     |   96.16 |      100 |   97.05 |   96.16 | ...63-664,690-693 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  targeting.ts     |   95.78 |      100 |     100 |   95.78 | ...64-166,178-179 
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.46 |       92 |     100 |   98.46 | 231-234,453       
 src/ui            |   96.71 |    93.95 |   94.59 |   96.71 |                   
  AuthForms.tsx    |     100 |    99.07 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   91.66 |     87.5 |     100 |   91.66 | 60-61,66-67       
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   96.84 |    88.99 |     100 |   96.84 | ...09-210,216-217 
  ...ipPreview.tsx |    87.2 |    77.41 |      75 |    87.2 | ...24-125,130-131 
  ...adesPanel.tsx |   96.74 |    90.62 |     100 |   96.74 | 77-78,96-97       
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

Per-workspace totals (thresholds ≥ 80): backend — 95.25 statements / 88.68 branches / 99.53 functions / 95.25 lines (32 test files, 1110 tests passed); frontend — 96.48 statements / 96.14 branches / 97.56 functions / 96.48 lines (70 test files, 1873 tests passed). `npm run coverage` exit 0.

### 7. Staging and commit

Staged paths are exactly the 80 deletions plus this log; `git status --porcelain` shows no modification under `docs/features/vercel-fly-neon-deployment/` staged and none under `.opencode/`.

```text
$ git add docs/features/project-only-skills/build-log-T1.md
$ git diff --cached --name-only | grep -v '^.agents/skills/' | sort
docs/features/project-only-skills/build-log-T1.md
skills-lock.json
$ git diff --cached --name-only -- docs/features/vercel-fly-neon-deployment/status.md
(empty)
$ git diff --cached --name-only | wc -l
81
$ git diff --cached --name-status | cut -c1 | sort | uniq -c
      1 A
     80 D
$ git commit -m "chore: remove imported skill packs and lockfile"
```

The 81 staged entries are exactly 80 deletions (79 `.agents/skills/**` files + `skills-lock.json`) and 1 addition (this log). The full pre-commit `git status --porcelain` shows the 80 staged `D ` entries, the staged `A ` log, the pre-existing unstaged ` M docs/features/vercel-fly-neon-deployment/status.md`, and the untracked T2/T3 artifacts (`docs/features/project-only-skills/plan.md`, `reviews/`, `spec.md`, `status.md`, `tasks.md`) — none of the latter are staged.

## Acceptance audit

- **AC-1 (T1 part)** → met: `test ! -e .agents` exit 0; `test ! -e skills-lock.json` exit 0; `git ls-files -- '.agents/**' 'skills-lock.json'` empty; `git status --porcelain -- .agents skills-lock.json` shows only the staged `D` deletions pre-commit and is empty post-commit (Subagent Report); the pre-deletion inventory (33 directories, 33 `SKILL.md`, full 79-file list, `git ls-files`/`git status` output) is recorded above.
- **AC-2** → met: exactly six project-skill directories, each with `SKILL.md`; `git ls-files '.opencode/skills/*/SKILL.md' | wc -l` = 6; `git diff --exit-code "$BASE_SHA" -- .opencode/skills` exit 0.
- **AC-10 (T1 gate contribution)** → met: `npm run lint`, `npm run typecheck`, `npm run coverage` all exit 0 with per-workspace coverage ≥ 80 on all four metrics; no `src/**`, `tests/**`, `compose*.yaml`, `package*.json`, `.github/**`, `opencode.jsonc`, or Dockerfile path was touched (the staged set contains only `.agents/skills/**`, `skills-lock.json`, and this log).
- **AC-11 (T1 part)** → met: `BASE_SHA` and the full `git status --porcelain` are recorded above, including `M docs/features/vercel-fly-neon-deployment/status.md`; that path was not edited, staged, or committed by T1.

## Deviations from spec

- None in scope. Two bookkeeping notes: (1) the pre-commit `test -z "$(git status --porcelain -- .agents skills-lock.json)"` in `tasks.md` § T1 verify is unsatisfiable while the deletions are staged (see § 4 note); the post-commit assertion is recorded in the Subagent Report; (2) post-commit evidence is reported rather than committed, following the `agent-skill-migration` T4 precedent.
