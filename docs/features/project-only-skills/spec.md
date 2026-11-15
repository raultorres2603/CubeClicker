---
feature: project-only-skills
revision: 2
status: draft
created: 2026-11-14
updated: 2026-11-15
---
# Spec — Project-Only Skills

## Summary

CubeClicker currently carries two skill sources: six binding project pipeline skills under `.opencode/skills/` and 33 imported third-party packs under `.agents/skills/` pinned by `skills-lock.json`. The user has decided the imported packs are no longer needed: library and platform documentation (Three.js, React, Vite, Fastify, Vercel, Neon, etc.) is covered by the Context7 MCP, and the only skills the project should carry are the six pipeline skills. This feature deletes every imported pack and the lockfile, removes the imported allow-list entries and advisory-prompt text from the four agents, rewrites `docs/architecture/skills.md` as a project-only policy, and reconciles `AGENTS.md`, `README.md`, and `docs/architecture/documentation.md`. It supersedes the imported-skill policy of the accepted `agent-skill-migration` feature without rewriting that feature's historical artifacts.

## Problem

- `.agents/skills/` holds 33 imported directories (the 31 documented when `agent-skill-migration` was accepted plus the later `neon-postgres` and `deploy-to-vercel`), and `skills-lock.json` pins all 33. The inventory in `docs/architecture/skills.md` already drifts from the directory set (31 vs 33) — exactly the maintenance burden this feature removes.
- The imported packs are technology/generic guidance (13 `threejs-*`, UI/accessibility packs, Superpowers process packs, OpenAI docs, Vercel/Neon deploy packs). Context7 MCP now supplies current library/platform documentation, so vendored copies are redundant and stale by nature.
- The four agents carry 19 imported `skill: allow` rules in total (planner 1: `writing-plans`; builder 16: TDD, systematic debugging, verification, review reception, 10 `threejs-*`, 2 accessibility/motion packs; reviewer 2: systematic debugging, verification) and three "Imported skills are advisory" prompt bullets. The orchestrator already has none.
- Three live documents describe a two-location split, an imported-pack inventory, dispositions, and a `skills-lock.json` installer workflow. That policy is about to be false, and stale policy text is a defect under `docs/architecture/documentation.md`.

## Goals

- **G-1** — Delete every imported pack and `skills-lock.json`; no tracked or on-disk trace remains under `.agents/`.
- **G-2** — Reduce each agent's `skill` permissions to project skills only, preserving the existing rule contract (wildcard deny first, exact allows after, no other `skill` rules, least privilege).
- **G-3** — Rewrite `docs/architecture/skills.md` as the project-only policy: the six project skills, the per-agent allow-lists, and one statement that library/platform documentation comes from Context7 MCP. No inventory, dispositions, lockfile, or installer workflow.
- **G-4** — Reconcile `AGENTS.md`, `README.md`, and `docs/architecture/documentation.md` so no live document suggests a second skill source.
- **G-5** — Record the supersession of `agent-skill-migration`'s imported-skill policy, keep the four-agent pipeline unchanged, and leave reproducible verification evidence.

## User stories

- As the maintainer, I want the skill list to contain only CubeClicker's own pipeline skills so it reflects the project, not third-party tech guidance.
- As a pipeline agent, I want an allow-list of exactly the skills my role needs so permissions stay least-privilege and unambiguous.
- As a contributor, I want library/platform answers to come from Context7 MCP instead of vendored packs that drift from upstream.
- As a reviewer, I want binary checks proving no imported pack, lockfile, allow rule, or live-doc reference survives.
- As the repository owner, I want the deletion reversible from git history while accepted historical artifacts stay untouched.

## Scope inventory — deleted imported packs

The complete deletion set under `.agents/skills/` (33 IDs, each with a top-level `SKILL.md`; `skills-lock.json` lists the same 33 entries):

`baseline-ui`, `brainstorming`, `component-canvas`, `create-canvas`, `create-design-md`, `deploy-to-vercel`, `executing-plans`, `fixing-accessibility`, `fixing-metadata`, `fixing-motion-performance`, `improve-ui`, `neon-postgres`, `openai-docs`, `receiving-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `threejs-animation`, `threejs-asset-pipeline`, `threejs-fundamentals`, `threejs-geometry`, `threejs-interaction`, `threejs-lighting`, `threejs-loaders`, `threejs-materials`, `threejs-performance`, `threejs-postprocessing`, `threejs-react-three-fiber`, `threejs-shaders`, `threejs-textures`, `ui-skills-root`, `verification-before-completion`, `writing-plans`.

## Acceptance criteria

- **AC-1** — Imported packs and lockfile are gone: `test ! -e .agents`, `test ! -e skills-lock.json`, `git ls-files -- '.agents/**' 'skills-lock.json'` prints nothing, and `git status --porcelain -- .agents skills-lock.json` is empty. `build-log-T1.md` records the pre-deletion inventory (33 directories, 33 `SKILL.md` files, full file list and `git ls-files`/`git status` output for `.agents/`).
- **AC-2** — The project skills are untouched and complete: exactly the six directories `orchestration-playbook`, `spec-authoring`, `spec-review`, `task-decomposition`, `web-implementation`, `code-review` exist under `.opencode/skills/`, each with `SKILL.md` (`find .opencode/skills -mindepth 1 -maxdepth 1 -type d | wc -l` prints `6`), and `git diff --exit-code "$BASE_SHA" -- .opencode/skills` exits 0.
- **AC-3** — Each agent's `skill` permission block consists of exactly one `{action: skill, resource: "*", effect: deny}` rule followed by one allow rule per ID below, in this order, and no other `skill` rules:
  - `orchestrator`: `orchestration-playbook`
  - `planner`: `spec-authoring`, `task-decomposition`
  - `builder`: `web-implementation`
  - `reviewer`: `spec-review`, `code-review`

  A parser that enumerates every permission rule block in `.opencode/agents/*.md` reproduces those four sequences exactly, asserts that the total count of `action: skill` occurrences equals the parsed skill-rule count (a differently shaped or unmatched skill rule fails), and asserts that every non-skill permission rule (same order, same `action`/`resource`/`effect`) is identical to `git show "$BASE_SHA:.opencode/agents/<agent>.md"` — any added, removed, or changed non-skill permission (`shell`, `edit`, `subagent`, `question`, `external`, or any future action) fails. Under last-match evaluation every other skill ID is denied.
- **AC-4** — No imported-skill trace remains in agent prompts: for every ID in § Scope inventory and for the strings `imported skills are advisory` and `superpowers:`, `.opencode/agents/*.md` contains no occurrence. The `skill "*" deny` rule remains in all four agents.
- **AC-5** — `docs/architecture/skills.md` is rewritten as the project-only policy and meets all of:
  - contains `## Canonical location`, `## Precedence and ID rules`, `## Per-agent skill policy`, `## Maintenance`, `## Verification`, and `## History`;
  - names all six project skill IDs;
  - contains these exact per-agent table rows: `| orchestrator | \`orchestration-playbook\` |`, `| planner | \`spec-authoring\`, \`task-decomposition\` |`, `| builder | \`web-implementation\` |`, `| reviewer | \`spec-review\`, \`code-review\` |`;
  - contains the literal `Context7 MCP` and states that library/platform documentation comes from it;
  - contains none of `.agents`, `skills-lock`, `Imported pack inventory`, `Excluded and unassigned packs`, or `Binding vs advisory`.
- **AC-6** — `AGENTS.md` and `README.md` contain no `.agents`, `skills-lock`, `imported`, or `advisory` string; `AGENTS.md` still contains `.opencode/skills`, `docs/architecture/skills.md`, `podman compose`, and `four-agent pipeline`; `README.md` still contains `podman compose up`, `.opencode/skills`, and the `docs/architecture/skills.md` bullet.
- **AC-7** — `docs/architecture/documentation.md` contains no `.agents`, `skills-lock`, `imported`, or `advisory` string; it still contains `docs/architecture/skills.md`; its referenced `.opencode/skills/orchestration-playbook/SKILL.md` exists (`test -f`); and `git diff --exit-code "$BASE_SHA" -- docs/architecture/documentation.md` exits 0 (empty diff, because no stale reference exists at baseline).
- **AC-8** — No live reference to the deleted paths survives: `grep -rnE '\.agents/skills|skills-lock\.json' AGENTS.md README.md opencode.jsonc .opencode docs/architecture` prints nothing. Historical feature artifacts under `docs/features/**` are exempt by design (non-goal).
- **AC-9** — Supersession is recorded without rewriting history: `docs/features/project-only-skills/spec.md` contains a `## Supersession note` naming `agent-skill-migration`, and `git diff --exit-code "$BASE_SHA" -- docs/features/agent-skill-migration` exits 0 (spec, plan, tasks, status, reviews, and build logs unchanged).
- **AC-10** — The full project gate is green: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (statements, branches, functions, lines each ≥ 80 in both workspaces), and `npm run build` all exit 0, with raw output and per-workspace coverage numbers recorded in `build-log-T3.md`. No file under `src/**`, `tests/**`, `compose.yaml`, `compose.smoke.yaml`, `package.json`, `package-lock.json`, `.github/**`, `opencode.jsonc`, or `src/*/Dockerfile` differs from `BASE_SHA`.
- **AC-11** — The feature ends clean on its own paths: at the end of T3, `test -z "$(git status --porcelain -- docs/features/project-only-skills .opencode .agents skills-lock.json AGENTS.md README.md docs/architecture)"` passes after the T3 commit; T3 stages (without editing) `spec.md`, `plan.md`, `tasks.md`, `status.md`, and `reviews/**`; the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` is recorded in `build-log-T1.md`, is not staged or committed by the feature (`test -z "$(git log --oneline "$BASE_SHA"..HEAD -- docs/features/vercel-fly-neon-deployment/status.md)"`), and is deliberately excluded from the clean check; and each task's `build-log-<taskid>.md` records the commands and raw results named in its `verify` block.

## Supersession note

This feature supersedes the imported-skill policy established by the accepted feature `agent-skill-migration` (`docs/features/agent-skill-migration/`):

- **Superseded:** the two-location canonical split; the 31-row imported-pack inventory and 14-row disposition policy; `skills-lock.json` provenance and installer maintenance; and every imported allow-list entry (planner `writing-plans`; builder's 16; reviewer's 2).
- **Retained:** the six project pipeline skills and their binding precedence; the four-agent pipeline; the `skill` rule contract (`*` deny first, exact allows after, no other `skill` rules); and the static-resolution verification approach.
- **Not rewritten:** the historical `agent-skill-migration` artifacts stay as the record of that migration. The current policy lives in `docs/architecture/skills.md` and this spec.

## Non-goals

- Deleting, renaming, or editing `.opencode/skills/` or any of the six project pipeline skills.
- Deleting or changing any game code, tests, container assets, workflows, deployment configuration, or the blocked `vercel-fly-neon-deployment` feature's artifacts and configuration.
- Adding any new skill, installer, MCP server, or agent; changing the four-agent workflow, roles, gates, or state machine.
- Rewriting accepted historical feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/**`, build logs) of other features, including `agent-skill-migration` and `adaptive-render-budget-v2`.
- Re-adding an inventory of technology skills, a Context7-redundancy argument, or an installer workflow to `docs/architecture/skills.md`; one statement that Context7 MCP supplies library/platform docs is the required extent.
- Adding a project-level Context7 entry to `opencode.jsonc` (see Q-1).

## Boundaries

- ✅ Always: delete only the enumerated imported packs and `skills-lock.json`; keep `.opencode/skills/` byte-identical; preserve the `skill "*" deny`-first rule contract; run the listed verification and record raw evidence in the task build logs; keep live documentation link-valid; keep the four-agent pipeline text intact.
- ⚠️ Ask first: deleting anything under `.agents/` that is not one of the 33 enumerated skill packs; changing `opencode.jsonc`; editing `docs/features/README.md` (orchestrator-owned); touching another feature's artifacts; re-adding any skill or installer.
- 🚫 Never: delete or modify project pipeline skills; add a wildcard skill allow or remove the `*` deny; edit `src/**`, `tests/**`, `compose.yaml`, `compose.smoke.yaml`, `.github/**`, deployment configs, or Dockerfiles; rewrite historical feature artifacts; edit `.env*`; commit secrets; `git push`; edit `docs/features/project-only-skills/status.md` (orchestrator-owned).

## Security considerations

- **No user data or runtime surface.** The change touches no authentication, persistence, network, WebSocket, or cross-client state; no new user-controlled data exists.
- **Destructive deletion, authorized and reversible.** The user explicitly authorized deleting the imported packs. Every deleted file is tracked, so `git show "$BASE_SHA:<path>"` and `git revert` can restore it; `BASE_SHA` is recorded before deletion and rollback is documented in `plan.md`.
- **Supply chain / prompt-injection surface reduced.** Third-party instruction packs and their scripts (`brainstorming/scripts/`, `systematic-debugging/find-polluter.sh`, `openai-docs/scripts/`) are removed from the checkout; none is executed by the pipeline at any point. The lockfile's provenance data remains recoverable from git history.
- **Permission surface.** Agent edits are limited to removing `skill` allow rules; the wildcard deny and every non-skill permission stay byte-identical. A total-count frontmatter parser proves every `action: skill` line is accounted for and checks the exact project-only sequence; the same parser diffs each agent's non-skill rules against `BASE_SHA` in T2 and T3, so a widened `shell`, `edit`, `subagent`, `question`, `external`, or future non-skill permission fails the task.
- **Secrets.** No secret is read, written, or exposed. `.env*` stays untouched; the deletion is limited to `.agents/skills/**` and `skills-lock.json`.

## Testing strategy

- **Unit tier (static content assertions).** This feature changes repository content and agent configuration, not runtime code, so the unit tier is a set of deterministic static assertions run by the builder and recorded in the build logs: agent frontmatter is parsed block-by-block to the exact skill sequences, the total `action: skill` count equals the parsed skill count, and every non-skill permission rule is compared to `BASE_SHA`; the project-skill directory set equals the six IDs and is byte-identical to `BASE_SHA`; `.agents/` and `skills-lock.json` do not exist and are untracked; forbidden-path and forbidden-ID scans over live files are empty; `docs/architecture/skills.md` has the required sections and table rows; positive literals (`Context7 MCP`, `.opencode/skills`, `podman compose`) remain. Assertions use exact expected values/exit codes — no wildcard matchers, snapshot-only checks, or assertion-free tests.
- **Integration tier (repository gate).** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, and `npm run build` prove that removing the vendored tree and editing agent prompts does not break linting, compilation, tests, coverage, or the build. This is the integration proof for a content/config change; the authoritative gate is static resolution, consistent with `agent-skill-migration` AC-13. An optional `opencode run --format json` skill-load smoke is supplementary only and is never the acceptance basis.
- **E2E tier.** None. No service, image, port, compose file, route, or WebSocket behavior changes; `npm run smoke` is intentionally not required.
- **Coverage.** `npm run coverage` — Vitest V8 in all workspaces, thresholds ≥ 80 statements/branches/functions/lines per workspace, unchanged; raw output and per-workspace numbers go in the build logs.
- **Verification commands.** From `AGENTS.md`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`.
- **Edge cases.** Untracked/foreign files under `.agents/` are enumerated before deletion and block the task if found; a pre-existing dirty worktree is recorded before edits, including the unrelated `docs/features/vercel-fly-neon-deployment/status.md` modification; once no files remain under `.agents/`, `rm -r -- .agents` removes the empty directory tree; historical feature artifacts containing the old paths are deliberately exempt from the live scans.

## Real-time impact

Explicitly out of scope. The feature changes no shared or cross-client state, no connection lifecycle, no reconnection behavior, no multi-client behavior, and no server authority; nothing about identity or accounts is touched.

## Containerization impact

Explicitly out of scope. The feature adds no service, image, port, environment variable, health signal, or deployable, and it does not modify `compose.yaml`, `compose.smoke.yaml`, the Dockerfiles, or the local-run contract; the `podman compose up` path is unchanged and must remain valid in the docs.

## Documentation impact

- **Rewrite:** `docs/architecture/skills.md` (project-only policy).
- **Edit:** `AGENTS.md` (remove the `.agents/skills/` bullet; rewrite the Skills convention), `README.md` (rewrite the skills bullet in `## Stack`).
- **Audit (expected empty diff):** `docs/architecture/documentation.md` — no imported-pack reference exists at baseline; its `docs/architecture/skills.md` link and playbook path must stay valid.
- **Orchestrator-owned at acceptance:** the `project-only-skills` row in `docs/features/README.md`, per `docs/architecture/documentation.md`.
- **Not rewritten:** every historical feature artifact under `docs/features/**`.

## Baseline and clean-tree scope

The planning checkout already contains an unrelated pre-existing modification: `M docs/features/vercel-fly-neon-deployment/status.md` (a blocked feature owned by another flow). This feature must never edit, stage, or commit that path. T1 records the full `git status --porcelain` and that path in `build-log-T1.md`; T3's clean check is scoped to the feature-owned paths — `docs/features/project-only-skills`, `.opencode`, `.agents`, `skills-lock.json`, `AGENTS.md`, `README.md`, `docs/architecture` — and explicitly excludes `docs/features/vercel-fly-neon-deployment/status.md`. A whole-tree `git status --porcelain` empty result is not required and must not be claimed. The orchestrator records the exclusion in `status.md`; this feature does not edit `status.md`.

## Open questions

- **Q-1** — Context7 MCP is available to this environment, but `opencode.jsonc` currently declares only the `vercel` and `Neon` remote MCP servers. Should a project-level Context7 server entry be added for reproducibility? This feature does not add or reconfigure MCP servers (non-goal); the assumption is that Context7 availability is environment-level (A-1). Non-blocking; a separate decision can add it later.
- **Q-2** — When documenting the removal in `docs/architecture/skills.md` History, may the entry name the `agent-skill-migration` and `project-only-skills` slugs? Proposed: yes, slugs only, with no `.agents`/`skills-lock` path or filename text, so AC-5/AC-8 stay green. Non-blocking.

## Assumptions

- **A-1** — Context7 MCP is available to the agents in this environment through user/global OpenCode configuration; no repository-level MCP change is needed for this feature.
- **A-2** — No external tooling (CI, installer, editor integration) depends on `skills-lock.json` or `.agents/skills/`; deleting them cannot break the build, local environment, or deployment pipelines.
- **A-3** — The 33 directories observed under `.agents/skills/` are the complete imported set, and `.agents/` contains nothing else that must be preserved. T1 enumerates the tree and reports `blocked` if this is false.
- **A-4** — The six project pipeline skills, `AGENTS.md`, the four agent prompts, and `docs/architecture/*` already carry every binding process rule; deleting the imported process packs (TDD, systematic debugging, verification, review reception) does not lower the project's testing/verification bar.
- **A-5** — Historical feature artifacts under `docs/features/**` are records and are exempt from live stale-reference scans and from rewriting (non-goal).
- **A-6** — `docs/features/README.md` is orchestrator-owned; its `project-only-skills` row is applied at acceptance, not by the builder.
- **A-7** — `docs/architecture/documentation.md` currently has no `.agents`/`skills-lock` references, so its update is an audit expected to produce an empty diff; if a reference is found it is removed in T2 within the same file scope.
- **A-8** — The pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` belongs to the blocked feature and stays untouched, unstaged, and uncommitted by this feature; the scoped clean check excludes it, and only the orchestrator may update that feature's status.

## Revision history

- r1 — 2026-11-14 — initial draft: delete the 33 imported packs and lockfile, reduce agent allow-lists to the six project skills, rewrite the skill policy docs, record the supersession of `agent-skill-migration`.
- r2 — 2026-11-15 — addresses spec-review r1: F1 scopes AC-11's clean-tree assertion to feature-owned paths, stages `reviews/**`, and records the pre-existing Vercel status baseline/exclusion; F2 adds non-skill permission parity against `BASE_SHA` to AC-3/T2/T3; F3 makes the skill-rule parser total-count so an unmatched skill rule fails; F5 records the baseline and exclusion here and in `plan.md` instead of editing `status.md`. Q-1/Q-2 remain non-blocking.
