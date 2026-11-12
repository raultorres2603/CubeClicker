---
feature: agent-skill-migration
revision: 3
---
# Plan — Agent Skill Migration & Repository-State Repair

## Architecture

### Two skill sources, one loader

OpenCode discovers skills from project sources and exposes them to agents through the `skill` tool, gated by each agent's `skill` permission list. The repository uses two discoverable project locations with different ownership:

```text
.opencode/skills/<id>/SKILL.md     project-owned pipeline skills (higher precedence)
        │
        ├── orchestration-playbook, spec-authoring, spec-review,
        │   task-decomposition, web-implementation, code-review
        │
.agents/skills/<id>/SKILL.md       imported third-party packs (lower precedence)
        │
        ├── 13 threejs-* packs (committed 5801294)
        ├── 9 ibelick/ui-skills packs
        ├── 8 obra/superpowers packs
        └── 1 openai/skills pack
        │
        ▼
agent frontmatter: skill "*" deny first → specific skill allows in listed order
        │
        ▼
skill tool: load body + base directory; supporting files read on demand
```

- **`.opencode/skills/` is the project source.** The six pipeline skills are authored and reviewed here, edited like code, and take precedence if an ID ever collides.
- **`.agents/skills/` is the imported-pack source.** OpenCode treats it as a project compatibility source. The packs are vendored from upstream, pinned by `skills-lock.json` (`version: 2`, source, `skillPath`, `computedHash`), and must not be hand-edited. Updating a pack is an installer + lockfile operation in a future change.
- **No duplicate IDs.** The six project IDs do not collide with any imported ID. AC-7 verifies this mechanically.
- **No `opencode.jsonc` change.** The default discovery already covers both locations; only agent allow-lists and documentation change.

### Per-agent policy

The allow-lists are curated, not wildcarded. Imported packs are advisory; the project pipeline is binding.

| Agent | Project (binding) | Imported (advisory) | Total `skill` allows |
| --- | --- | --- | --- |
| orchestrator | `orchestration-playbook` | none | 1 |
| planner | `spec-authoring`, `task-decomposition` | `writing-plans` | 3 |
| builder | `web-implementation` | `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `receiving-code-review`, 10 core `threejs-*` packs, `fixing-accessibility`, `fixing-motion-performance` | 17 |
| reviewer | `spec-review`, `code-review` | `systematic-debugging`, `verification-before-completion` | 4 |

The 10 core `threejs-*` packs are `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-shaders`, `threejs-textures`, `threejs-animation`, `threejs-interaction`, `threejs-performance`, and `threejs-postprocessing`.

**Excluded packs (7; tracked, never allow-listed):**

| Pack | Reason |
| --- | --- |
| `baseline-ui` | Mandates Tailwind, `motion/react`, Base UI/Radix, and its own design rules — conflicts with the decided stack and the project's HUD/design system. |
| `threejs-react-three-fiber` | Proposes a React Three Fiber rewrite; the frontend uses raw three.js (`three@0.186.1`) directly. |
| `executing-plans` | Inline execution method, overlaps the orchestrator/builder pipeline. |
| `subagent-driven-development` | Its own subagent execution/review loop duplicates the four-agent pipeline. |
| `openai-docs` | OpenAI product documentation; irrelevant to CubeClicker. |
| `threejs-loaders` | External model/texture loading guidance; the game uses procedural assets. |
| `threejs-asset-pipeline` | glTF compression/tooling for imported assets; conflicts with the procedural-asset approach. |

**Unassigned packs (7; tracked, available for explicit invocation):** `brainstorming`, `component-canvas`, `create-canvas`, `create-design-md`, `improve-ui`, `ui-skills-root`, `fixing-metadata`. These are design/authoring or open-ended ideation tools with no current pipeline role; not allow-listed avoids advertising conflicting or noisy guidance.

**Binding vs advisory.** `AGENTS.md`, the agent prompts, the six project skills, and `docs/architecture/*` outrank imported packs. Imported packs that say "ask your human partner" map to "report `blocked` to the orchestrator" because subagents cannot address the user. Namespaced references such as `superpowers:test-driven-development` resolve to the local allow-listed ID when one exists and are otherwise ignored. `writing-plans` contributes only its file-structure, task-right-sizing, step-granularity, and self-review sections; its plan path/header/execution handoff and `superpowers:*` sub-skill references are ignored. `test-driven-development` and `verification-before-completion` reinforce, and do not weaken, the existing testing bar.

### Ownership, execution capability, and bookkeeping

The orchestrator has no shell permission and cannot run verification or commit. The planner can only edit feature specs and has read-only git. The builder has shell and can stage/commit any path; the reviewer can write `reviews/**` and has shell. Tasks are therefore assigned to owners that can execute their own verify commands:

| Task | Owner | Can execute | Notes |
| --- | --- | --- | --- |
| T1 | builder | restore, stage, commit, log | Restores pipeline skills and tracks all imported packs; two commits. |
| T2 | builder | edit, verify, commit, log | Edits agent allow-lists and docs; records `INDEX_BASE_SHA`. |
| T3 | orchestrator | edit only | Applies the three feature-index rows; **no shell, no verify, no commit**. T4 records the checks. |
| T4 | builder | verify, stage, commit, log | Runs the T3 row checks and the full gate, both in `build-log-T4.md`; commits feature bookkeeping. |
| T5 | builder | verify, stage, commit, log | Acceptance bookkeeping after the orchestrator has applied **all** acceptance edits; commits status/README/task-board/review artifacts and does not edit them. |

- **`.opencode/skills/**`, `.opencode/agents/*.md`, `AGENTS.md`, `README.md`, and `docs/architecture/**`** are builder-editable under the current permissions.
- **`.agents/skills/**` and `skills-lock.json`** are not in the builder's `edit` allow-list. T1 lists them under `commits_also` and only stages the existing files with git (no content edits), which the builder's shell scope permits. If content changes are needed, T1 reports `blocked`.
- **`docs/features/README.md`** is orchestrator-owned. T3 edits it; T4 stages/commits that edit and verifies it. The builder never edits it.
- **`docs/features/agent-skill-migration/status.md` and `tasks.md`** are orchestrator-owned. T4/T5 stage/commit the orchestrator's edits.
- **`spec.md`, `plan.md`, and `reviews/**`** are authored by the planner/reviewer. T4/T5 stage/commit them under the explicit `commits_also` field; the builder does not edit them.

## Interfaces / contracts

1. **Skill ID contract.** A skill ID is the directory name under `.opencode/skills/` or `.agents/skills/`. It is lowercase kebab-case and is what `skill` permissions use. Display names in frontmatter (`name:`) are not permission keys.
2. **Allow-list rule contract.** Under `permissions:`, the first `skill` rule is `{action: skill, resource: "*", effect: deny}`. It is followed by exactly one `{action: skill, resource: "<id>", effect: allow}` rule per permitted ID in the order listed in AC-5, and no other `skill` rules. The checker asserts the exact sequence and then evaluates last-match semantics for every known ID: an expected ID's last match is its allow, and every other ID's last match is the `*` deny. It fails on a wildcard allow, a missing `*` deny, a `*` deny after a specific allow, an `ask` effect, or an extra/missing/reordered allow.
3. **Advisory-precedence note contract.** Each affected agent prompt gains one short line stating that imported skills are advisory and that project files/pipeline win on conflict; planner `writing-plans` exceptions and namespaced-reference handling are named explicitly.
4. **Skills document contract.** `docs/architecture/skills.md` contains the nine sections in AC-4 plus two machine-readable tables:
   - `## Imported pack inventory`: header `| ID | Source | Disposition |`, exactly 31 rows (all `.agents/skills/*` IDs), source from `skills-lock.json`, disposition `allowed|excluded|unassigned`.
   - `## Excluded and unassigned packs`: header `| ID | Category | Reason |`, exactly the 14 non-allowed IDs (7 excluded + 7 unassigned), category equal to disposition, non-empty reason.
5. **Feature-index row contract.** `| <slug> | <title> | <state> | <YYYY-MM-DD> |`, where `state` equals the status frontmatter state and the date equals the latest `- YYYY-MM-DD —` loop-log entry. T3 inserts the three rows at the pinned chronological positions; T4 verifies exact rows, derived dates, placement, and an additive-only diff against `INDEX_BASE_SHA`.
6. **SHA contract.** `BASE_SHA` is the pre-feature `git rev-parse HEAD`, recorded as `BASE_SHA=<40-hex>` in `build-log-T1.md`. `INDEX_BASE_SHA` is the T2 content-commit SHA, recorded as `INDEX_BASE_SHA=<40-hex>` in `build-log-T2.md` by the T2 evidence commit (a later commit, so not self-referential). T4 reads both with `sed -n 's/^BASE_SHA=//p'` and `sed -n 's/^INDEX_BASE_SHA=//p'`; no angle-bracket placeholders remain in any T1–T5 verify command. Rollback prose uses the recorded symbolic names (`T1_PACK_SHA`, `T4_CONTENT_SHA`, `T4_EVIDENCE_SHA`) rather than angle-bracket placeholders.
7. **Bookkeeping commit contract.** A task's `files_owned` covers what it creates, edits, or restores; a `commits_also` field lists paths the task stages/commits but must not edit (vendored packs, lockfile, or planner/reviewer/orchestrator artifacts). T1, T4, and T5 have `commits_also`; each stages an explicit path list and ends with `git status --porcelain` empty.

## Migration sequence

1. **T1 — baseline, restore, and protect.** Record `BASE_SHA`, `git status`, and the 18 deleted paths. Restore `.opencode/skills` from `HEAD`. Verify the 31 imported dirs, the 31 lockfile IDs, the 13 pre-existing lockfile entries deep-equal to `BASE_SHA`, zero lockfile deletions, and a clean credential scan. Stage/commit `.agents/skills` + `skills-lock.json`; then write `build-log-T1.md` (with `BASE_SHA=` and `T1_PACK_SHA=`) and commit the log. This closes the data-loss window before any doc edit.
2. **T2 — rewire allow-lists and document the policy.** Edit planner/builder/reviewer allow-lists, add the advisory-precedence lines, update `AGENTS.md`, `README.md`, and `docs/architecture/documentation.md`, create `docs/architecture/skills.md` with the 31-row inventory and 14-row disposition table, and record the proposed feature-index rows in the build log. Run the structural and last-match allow-list checks, the inventory/disposition check, the nine-section check, the AC-8 scoped checks, the duplicate-ID check, and live-path resolution. Commit; record `INDEX_BASE_SHA` as the content-commit SHA in `build-log-T2.md`; commit the log.
3. **T3 — feature index (orchestrator-only edit).** Insert the three exact rows at the pinned positions in `docs/features/README.md`. No shell, no verify, no commit.
4. **T4 — final verification and pre-review bookkeeping (builder).** Read `BASE_SHA`/`INDEX_BASE_SHA`, run the T3 row checks and the full static bundle/full gate suite, record everything in `build-log-T4.md`, then stage/commit the log plus `spec.md`, `plan.md`, `tasks.md`, `reviews/**`, `status.md`, and the T3 README edit in the **T4 content commit**. Record `T4_CONTENT_SHA` and `git show --stat --oneline HEAD` in the build log, then commit the updated log as the **T4 evidence commit** (`T4_EVIDENCE_SHA`). End with a clean tree. The code reviewer then reviews the committed state.
5. **T5 — acceptance bookkeeping (builder), strictly one-directional.** After the code-review verdict is approved, the orchestrator makes **all** acceptance edits *before* T5: `status.md` frontier state `accepted` with the acceptance loop-log entry, exactly one `agent-skill-migration` accepted row in `docs/features/README.md` dated from that loop-log entry, and the task-board update. The builder then verifies the accepted state, runs the final four-row README diff check, writes `build-log-T5.md`, stages/commits `status.md`, `docs/features/README.md`, `tasks.md`, `reviews/**` (the code-review artifact), and the log, and ends with a clean tree. **No post-T5 edits are permitted.**
6. **Acceptance:** the orchestrator confirms T5's evidence and declares the feature accepted **without further edits**.

## File inventory

| Path | Action | Purpose | Task |
| --- | --- | --- | --- |
| `.opencode/skills/{orchestration-playbook,spec-authoring,spec-review,task-decomposition,web-implementation,code-review}/**` | Restore | Six pipeline skills, 18 files, verbatim from `HEAD` | T1 |
| `.agents/skills/**` | Track (no content edit) | 31 imported packs (18 currently untracked) | T1 (`commits_also`) |
| `skills-lock.json` | Track existing modification | Pins imported-pack provenance; version 2, 13 entries unchanged | T1 (`commits_also`) |
| `.opencode/agents/planner.md` | Edit | Add `writing-plans`; advisory-precedence line | T2 |
| `.opencode/agents/builder.md` | Edit | Add 16 imported allow entries; advisory-precedence line | T2 |
| `.opencode/agents/reviewer.md` | Edit | Add `systematic-debugging`, `verification-before-completion`; advisory-precedence line | T2 |
| `.opencode/agents/orchestrator.md` | No change | Its single allow rule resolves after T1; verified by T2 | T1/T2 |
| `AGENTS.md` | Edit | Describe both skill locations and link the policy doc | T2 |
| `README.md` | Edit | Add `docs/architecture/skills.md` to the § Stack index | T2 |
| `docs/architecture/skills.md` | New | Canonical locations, policy, 31-row inventory, 14-row dispositions, maintenance, verification | T2 |
| `docs/architecture/documentation.md` | Edit | Link `skills.md`; keep the playbook reference valid | T2 |
| `docs/features/README.md` | Edit (orchestrator) | Add the three missing rows; later this feature's accepted row | T3 / T5 |
| `docs/features/agent-skill-migration/build-log-T1.md` | New | Baseline, restore, pack/lockfile, credential evidence; `BASE_SHA` | T1 |
| `docs/features/agent-skill-migration/build-log-T2.md` | New | Allow-list/doc evidence, proposed rows; `INDEX_BASE_SHA` | T2 |
| `docs/features/agent-skill-migration/build-log-T4.md` | New | T3 row checks + full static bundle + gate suite + bookkeeping commit evidence | T4 |
| `docs/features/agent-skill-migration/build-log-T5.md` | New | Acceptance-state verification + bookkeeping commit evidence | T5 |
| `docs/features/agent-skill-migration/{spec,plan,tasks}.md` | New/Edit | Planner artifacts; staged/committed by T4 | planner / T4 |
| `docs/features/agent-skill-migration/status.md` | Edit | Orchestrator bookkeeping; staged/committed by T4/T5 | orchestrator / T4/T5 |
| `docs/features/agent-skill-migration/reviews/**` | New | Spec/code review verdicts; staged/committed by T4/T5 | reviewer / T4/T5 |

**No file under `src/**`, `tests/**`, `compose*.yaml`, `src/*/Dockerfile`, `package.json`, or `package-lock.json` is touched.**

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Keep project pipeline skills in `.opencode/skills/`; keep imported packs in `.agents/skills/` | Native project source, higher precedence, code-reviewed ownership; keeps upstream content in the installer/lockfile domain | Migrate all skills to `.agents/skills/` (mixes project and vendored content; no benefit); migrate all to `.opencode/skills/` (duplicates 31 packs, breaks installer update path) |
| D-2 | Restore the six skills verbatim from `HEAD`, not rewrite them | Zero content loss, fastest safe repair; their content is known-good and referenced by the pipeline | Rewrite from memory (risks divergence); reconstruct from docs references (lossy) |
| D-3 | Track all 31 imported packs, including excluded/unassigned ones | Prevents loss from `git clean`/checkout; preserves the user's imported set; deletion is a separate decision | Track only the allow-listed subset (loses 14 packs); delete excluded packs (user-owned, out of scope) |
| D-4 | Explicit allow entries, no wildcard allows, `*` deny first | Auditable, excludes conflicting packs by construction, and the rule order makes last-match semantics unambiguous | `threejs-*` wildcard (would include `threejs-loaders`, `threejs-asset-pipeline`, `threejs-react-three-fiber`); `*` allow (defeats curation) |
| D-5 | Curated sets: builder 17 total (1 project + 16 imported), planner 3 (2+1), reviewer 4 (2+2), orchestrator 1 (1+0) | Covers the actual role needs without advertising the whole catalogue; descriptions only enter context on demand | Allow all 31 (noise and conflicts); allow none (loses useful guidance) |
| D-6 | Imported packs are advisory; project pipeline is binding | Imported packs assume a human partner and their own execution/plan conventions; the four-agent pipeline is the law | Treat imported packs as binding (would rewrite the workflow); reject imports entirely (loses three.js and process value) |
| D-7 | README index is orchestrator-edited, builder-verified and builder-committed | Matches the ownership policy while giving the checks and commit to a shell-capable owner | Orchestrator runs checks/commits (impossible: no shell); builder edits README (permission denied) |
| D-8 | Use inline static checks, not a committed checker script | No application code means no new unit-test/coverage obligation; commands are reproducible from `tasks.md` and recorded raw | Add `scripts/check-skills.mjs` (uncovered root tooling, extra maintenance); CI-only check (not available locally) |
| D-9 | Do not run containerized smoke | No service, image, port, env, or WebSocket change; the feature is repository content/config | Run smoke anyway (slow, proves nothing about skills) |
| D-10 | Exclude historical `docs/features/**` from live-link checks | They are immutable records of past states; rewriting them violates minimal-diff and history | Rewrite all historical references (large, risky, unrelated) |
| D-11 | Builder-owned bookkeeping commits (T4/T5) for planner/reviewer/orchestrator artifacts | Those authors cannot commit (planner read-only git, orchestrator no shell, reviewer writes reviews only); a shell-capable owner makes the tree clean | Leave feature artifacts untracked (F4 failure); ask the user to commit (unnecessary) |
| D-12 | T3 is orchestrator edit-only; T4 runs its checks | The orchestrator cannot execute shell or commit; separating edit from verification keeps every command owned by an agent that can run it | Orchestrator runs checks/commits (impossible) |
| D-13 | Smoke is supplementary, static resolution is authoritative | A repeated phrase does not prove a `skill` tool call; JSON tool-call evidence is environment-dependent. The static file/ID/rule checks prove discovery and permissions deterministically | Treat the phrase as integration proof (false evidence); omit the smoke entirely (loses optional signal) |
| D-14 | All acceptance edits precede T5; T5 only verifies/commits; no post-T5 edits | A single direction makes the accepted state, the README row, and the clean-tree invariant mutually consistent; the orchestrator confirms the docs pass without editing after T5 | Post-T5 status edit (dirty tree, AC-14/15 failure); T6 second acceptance commit (unnecessary) |

## Risks & mitigations

- **R-1 — Untracked packs lost before T1 commits them.** `git clean`, a worktree-wide checkout, or an editor rollback could delete the 18 untracked packs. → T1 records the inventory, restores pipeline skills, and commits the packs/lockfile in one session; no destructive git command is permitted.
- **R-2 — Vendored content drifts from the lockfile.** Hand-editing packs would invalidate `computedHash` and future installer updates. → Track as-is; no content edits; compare the 13 pre-existing entries to `BASE_SHA`; document the installer-only update path.
- **R-3 — Imported guidance conflicts with the pipeline.** Human-partner escalation, `docs/superpowers/plans/`, stack mandates, and subagent execution methods contradict CubeClicker rules. → Advisory policy in `skills.md`; one precedence line per affected agent; conflicting packs excluded.
- **R-4 — Allow-list typo, wrong effect, or wrong order.** A wrong rule can expose all packs or deny every skill. → The checker asserts the exact sequence and last-match semantics for every known ID; T2/T4 verify.
- **R-5 — Duplicate skill ID across sources.** Precedence would silently shadow a pack. → `comm -12` check; no current duplicates; document the rule.
- **R-6 — Builder cannot edit `.agents/skills`/lockfile.** The edit allow-list does not cover those paths. → T1 only stages existing files via git; any content edit is out of scope and reports `blocked`.
- **R-7 — README ownership collision.** A builder edit would violate the orchestrator-owned index. → T3 is the only editor; T4 stages/commits and verifies.
- **R-8 — ESLint traverses vendored TypeScript.** The baseline spot check is green, but tracking must not change lint behavior. → T4 runs `npm run lint`; if vendored content fails, report `blocked` and let the orchestrator decide on a scoped ignore (a ⚠️ ask-first change), never weaken project rules.
- **R-9 — Smoke is model/environment-dependent.** `opencode run` may be unavailable or may not emit JSON tool calls. → AC-13 makes static resolution authoritative; the smoke is supplementary and never the acceptance basis, so an unavailable or inconclusive smoke cannot weaken the gate.
- **R-10 — Stale `coin-economy` frontmatter date.** The status says 2026-10-28 but the loop log says 2026-10-30. → The T4 row check derives the date from the latest loop-log entry; do not edit another feature's status; record the inconsistency as Q-4.
- **R-11 — Scope creep into performance/feature ideas.** The user's "all of them" includes later items. → Explicit non-goals; this feature stops at the repository repair.
- **R-12 — Orchestrator cannot execute shell or commit.** T3 would fail if it carried shell verification. → T3 is edit-only; T4 runs the checks and commits.
- **R-13 — Bookkeeping commit stages unrelated files.** A broad `git add` could capture unrelated work. → Explicit path staging; `git show --stat` scope audit; `git status --porcelain` must be empty after the commit.
- **R-14 — Feature artifacts left untracked at acceptance.** Planner/reviewer/orchestrator artifacts have no shell-capable author. → T4/T5 `commits_also` lists and commits them; AC-14/15 require a clean tree. All acceptance edits are made before T5, so no post-T5 edit can re-dirty the tree.

## Rollback plan

- **Before T1's pack commit:** the repair is reversible with `git restore --source=HEAD --worktree .opencode/skills`; never use `git clean`. The untracked packs are still in the worktree.
- **T1 (imported packs):** the pack tree is recoverable from the T1 commit even if later reverted; never delete the worktree copy before the commit. If the tracking commit must be undone, `git revert T1_PACK_SHA` and restore files from that commit; prefer fixing forward.
- **T2/T4/T5 (docs/config/bookkeeping):** `git revert` each commit by its recorded SHA (`T4_CONTENT_SHA`, `T4_EVIDENCE_SHA`, or the T5 commit). No runtime or deployable behavior changes, so rollback has no production impact.
- **If the canonical-location decision is reversed later:** do not revert T1; write a follow-up migration that moves the six project skills into `.agents/skills/`, updates the allow-lists and docs in one reviewed change, and keeps history intact.
- **If a pack is later judged unwanted:** remove it from allow-lists and lockfile via the installer in a separate user-approved change; do not delete it as part of rollback.

## Verification strategy

- **T1:** 18 pipeline files / 6 SKILL.md, clean diff vs `HEAD`; 31 imported dirs; 31 lockfile IDs; lockfile `version === 2` in both `BASE_SHA` and the working tree; 13 pre-existing lockfile entries deep-equal to `BASE_SHA`; zero lockfile deletions; `.agents/skills` changes since `BASE_SHA` are additions only; credential scan clean; post-commit status clean for the repaired paths. The packs and lockfile are T1 `commits_also`, not `files_owned` edits.
- **T2:** exact allow-list rule sequence and last-match semantics per agent; excluded IDs denied; every allowed ID resolves; no duplicate IDs; `docs/architecture/skills.md` has the nine sections, the 31-row inventory, and the 14-row disposition table; `AGENTS.md` names both locations and links the policy; `README.md` § Stack contains the policy link; `documentation.md` links it and the playbook path resolves; all live `.opencode/skills/...` references resolve; `INDEX_BASE_SHA` recorded.
- **T3/T4:** T3 is an edit-only orchestrator action; T4 runs the exact-row/date/placement/additive-diff checks against `INDEX_BASE_SHA` **before the acceptance row exists**, the full static bundle, `npm run lint/typecheck/test/coverage/build`, the `BASE_SHA` no-runtime-diff check (including `package.json`/`package-lock.json`), the non-skill permission guard, and the optional smoke; all T4 evidence goes in `build-log-T4.md`; T4 commits the pre-review bookkeeping, records its content-commit stat audit, commits the updated log as the evidence commit, and ends with a clean tree.
- **T5:** all acceptance edits are pre-applied by the orchestrator; T5 checks `status.md` state `accepted`, an acceptance loop-log entry, the README row date equal to that loop-log date, exactly one accepted `agent-skill-migration` row, and the final README diff = three AC-10 rows + that one accepted row with no removals; then the acceptance bookkeeping commit and a clean tree with no post-T5 edits.
- **Reviewer:** reproduces the static bundle and the full suite from the committed T4 state; treats unrecorded or unreproducible evidence as unmet; verifies no `src/**`/`tests/**`/container diff. T5 is the post-approval bookkeeping pass, not a code change.

## Open questions
- Q-1..Q-8 from `spec.md` § Open questions (canonical split, excluded-pack retention, advisory precedence, `coin-economy` date, smoke requirement, UI fix packs/`baseline-ui` classification, `writing-plans` subset, orchestrator prompt vs edit permission). Recommended defaults are stated there; this plan proceeds on those defaults unless the user objects at the approval checkpoint.
- The task renumbering (T1 merged restore+track; T3 orchestrator edit; T4 pre-review bookkeeping; T5 acceptance bookkeeping) is deliberate: it satisfies F1/F4 and removes the T1→T2 data-loss gap. The report maps the review's original T1–T5 references to the new numbering.
- Q-8 is the only INFO deferred to a future change: this feature uses the orchestrator's existing `edit` permission for `status.md`/`README.md` and does not change its prompt text; reconciling the prompt is a workflow change outside this repair.
