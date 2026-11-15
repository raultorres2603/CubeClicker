---
feature: project-only-skills
phase: code_review
round: 1
iteration: 1
verdict: approved
reviewed: 2026-11-15
blocking: 0
nonblocking: 1
---
# Code Review — r1

## Summary

✅ approved — 0 blocking (0 BLOCKER, 0 MAJOR), 1 MINOR. All 33 imported packs and `skills-lock.json` are deleted; no other tracked file was deleted; the six project skills are byte-identical to `BASE_SHA`; the three agent prompts end with exactly the project-skill allows after `skill "*" deny`; the orchestrator and every non-skill permission are unchanged; the docs are project-only and name Context7 MCP; no stale live reference survives. The full gate passes: lint, typecheck, tests (backend 1110, frontend 1873), coverage (backend 95.25/88.68/99.53/95.25; frontend 96.48/96.14/97.56/96.48), and build. The only deviation is evidence bookkeeping: the T1 verify block's pre-commit `test -z` is unsatisfiable while the deletions are staged, and the post-commit raw results for T1/T2/T3 live in the builder Subagent Report rather than their build logs (F1). The reviewer independently verified the current/T3 state; this is a MINOR acceptance-time evidence action, not a content defect.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `test ! -e .agents` and `test ! -e skills-lock.json` pass; `git ls-files -- '.agents/**' 'skills-lock.json'` is empty; `git status --porcelain -- .agents skills-lock.json` is empty. T1 commit `18d5010` contains exactly the 80 deletions (79 `.agents/skills/**` files + `skills-lock.json`) plus `build-log-T1.md`; the T1 log records the pre-deletion 33 directories/33 `SKILL.md` inventory. The pre-commit `test -z` at `tasks.md:47` failed by construction (staged `D` entries); the T1 log explains it and the post-commit result is in the builder report (F1). |
| AC-2 | ✅ | Exactly six directories under `.opencode/skills/` (`orchestration-playbook`, `spec-authoring`, `spec-review`, `task-decomposition`, `web-implementation`, `code-review`), each with `SKILL.md`; `git diff --exit-code 7b87cbb..95d93f8 -- .opencode/skills` exits 0 (byte-identical). |
| AC-3 | ✅ | The total-count/non-skill parser (T2/T3, reproduced by the reviewer) exits 0: orchestrator `skill "*" deny` + `orchestration-playbook`; planner + `spec-authoring`, `task-decomposition`; builder + `web-implementation`; reviewer + `spec-review`, `code-review`; 10 total `action: skill` rules; every non-skill rule equals `BASE_SHA`. |
| AC-4 | ✅ | The 33-ID + `imported skills are advisory` + `superpowers:` scan over all four agent prompts is empty; `skill "*" deny` remains first in all four. |
| AC-5 | ✅ | `docs/architecture/skills.md` has the six required headings, names all six IDs, contains the four exact per-agent rows, names `Context7 MCP`, and contains none of `.agents`, `skills-lock`, `Imported pack inventory`, `Excluded and unassigned packs`, or `Binding vs advisory`. |
| AC-6 | ✅ | `AGENTS.md`/`README.md` contain no `.agents`, `skills-lock`, `imported`, or `advisory`; `AGENTS.md` retains `.opencode/skills`, `docs/architecture/skills.md`, `podman compose`, and `four-agent pipeline`; `README.md` retains `podman compose up`, `.opencode/skills`, and the skills-doc bullet. |
| AC-7 | ✅ | `docs/architecture/documentation.md` has no stale token, still references `docs/architecture/skills.md`, the playbook path exists, and `git diff --exit-code 7b87cbb..95d93f8 -- docs/architecture/documentation.md` exits 0 (no edit needed). |
| AC-8 | ✅ | `grep -rnE '\.agents/skills\|skills-lock\.json' AGENTS.md README.md opencode.jsonc .opencode docs/architecture` is empty. |
| AC-9 | ✅ | The spec contains `## Supersession note` naming `agent-skill-migration`; `git diff --exit-code 7b87cbb..95d93f8 -- docs/features/agent-skill-migration` exits 0. |
| AC-10 | ✅ | Reviewer rerun: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` 32 files/1110 backend + 70 files/1873 frontend; `npm run coverage` backend 95.25/88.68/99.53/95.25 and frontend 96.48/96.14/97.56/96.48 (all ≥ 80); `npm run build` exit 0 with bundle budget OK. `git diff --exit-code 7b87cbb..95d93f8 -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json .github opencode.jsonc` exits 0. |
| AC-11 | ✅ (MINOR evidence deviation) | T3 stages `spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/**` and `build-log-T3.md`; T3 commit `95d93f8` contains those plus the reviews; the T3 tree has no `.agents`/`skills-lock`; the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` is not committed (`git log 7b87cbb..95d93f8 -- docs/features/vercel-fly-neon-deployment/status.md` is empty) and is excluded from the scoped clean check. The T1/T2/T3 post-commit raw outputs are in the builder Subagent Report rather than the build logs (F1); the reviewer reproduced the current/T3 state. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `tasks.md:47`, `:62`; `build-log-T1.md:556`, `:1009`; `build-log-T2.md:732`; `build-log-T3.md:894` | The T1 verify block runs `test -z "$(git status --porcelain -- .agents skills-lock.json)"` **before** the commit, while `git rm` has staged the deletions; it fails by construction. The builder explains this in the T1 log and reports the post-commit result in the Subagent Report. The T2/T3 commit/post-commit outputs are also deferred to the Subagent Report rather than the build logs, while AC-11 says each build log records its verify commands and raw results. The current/T3 state is clean and the reviewer independently verified it, so the deletion and clean result are correct; the recorded evidence is incomplete. | Append the post-commit `test -z` outputs and the T3 commit hash/`git show --stat` to `build-log-T1.md`/`build-log-T2.md`/`build-log-T3.md` (or a T3 addendum). For future tasks, move the T1 `test -z` after the commit or allow staged `D` entries. No content change. | open |
| F2 | INFO | `build-log-T3.md:907` vs `tasks.md:228` | The T3 commit message is `docs: verify project-only skills` instead of the task text's `docs: project-only-skills verification evidence`; it is still a conventional, clearly scoped message and the T3 log records the deviation. | None; keep the message. | open |
| F3 | INFO | Current working tree | `docs/features/project-only-skills/status.md` and the pre-existing `docs/features/vercel-fly-neon-deployment/status.md` are modified in the working tree; the former is the orchestrator's transition and the latter is the blocked feature's file, deliberately excluded from the feature's T3 scoped clean check. | Orchestrator handles the status/index updates at acceptance; do not touch the Vercel status. | open |
| F4 | INFO | Coverage | Reviewer coverage rerun matches the builder logs: backend 95.25/88.68/99.53/95.25; frontend 96.48/96.14/97.56/96.48; no new exclusions or thresholds changed. | None. | open |
| F5 | INFO | Secret scan | No real token/key values were found; the only `git grep` hits for the audit patterns are the audit commands documented in `docs/architecture/deployment.md`. The deleted packs are gone and no `.env*` was touched. | None. | open |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → exit 0: backend 32 test files / 1110 tests; frontend 70 test files / 1873 tests.
- `npm run coverage` → exit 0: backend `All files` 95.25 statements / 88.68 branches / 99.53 functions / 95.25 lines; frontend 96.48 / 96.14 / 97.56 / 96.48; all ≥ 80; no new exclusions/threshold changes.
- `npm run build` → exit 0; `Bundle budget OK (entry index-ak4hpiiK.js raw 88,353 B / gzip 27,426 B; bundle budget OK)`.
- Agent frontmatter parser (total-count + exact sequence + non-skill parity vs `7b87cbb`) → `parser OK`; current skill-rule count 10 (2+3+2+3); no imported IDs/advisory strings.
- Deletion checks: `.agents` and `skills-lock.json` absent; `git ls-files` for both empty; `git status --porcelain` for both empty; T1 commit `18d5010` deletes 80 paths (79 `.agents/skills/**` + `skills-lock.json`) and adds only `build-log-T1.md`.
- Project skills: six directories, each `SKILL.md`; `git diff 7b87cbb..95d93f8 -- .opencode/skills` empty.
- Docs/stale checks: `skills.md` six sections/Context7/no forbidden tokens; `AGENTS.md`/`README.md` no stale tokens with all required positives; `documentation.md` unchanged and link-valid; `grep` live paths empty; historical `agent-skill-migration` diff empty.
- Scope checks: no `src`, `tests`, compose, package/lockfile, `.github`, or `opencode.jsonc` diff vs `7b87cbb`; orchestrator unchanged; `docs/architecture/documentation.md` unchanged.
- T3 evidence: commit `95d93f8` includes spec/plan/tasks/status/reviews/build-log-T3; no `.agents`/`skills-lock`; no Vercel status commit; current scoped status shows only the orchestrator's `status.md` modification (expected post-T3).

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Spec compliance | ✅ | AC-1…AC-10 fully met; AC-11 met with the F1 evidence-recording deviation. |
| DB timing | n/a ✅ | No database, schema, repository, or migration change. |
| Documentation | ✅ | Project-only `skills.md`, `AGENTS.md`/`README.md`, and the unchanged `documentation.md` audit all reflect the shipped state; 33-vs-31 corrected. |
| Code quality | ✅ | Commits `18d5010`/`7491db3`/`95d93f8` are scoped and conventional; no source or config change; no imported packs resurrected; F2 is a message-only deviation. |
| Security | ✅ | Third-party prompt-injection surface removed; exact project allow-lists; wildcard deny first; non-skill parity proven; no secrets or `.env*` touched; the only token-pattern hits are docs' audit commands. |
| Testing | ✅ | Static content assertions are the correct unit tier for a content/config change; full lint/typecheck/test/coverage/build gate green; no useless runtime tests added. |
| Real-time | n/a ✅ | No shared/cross-client state, connection lifecycle, or identity change. |
| Containers | ✅ | No compose, Dockerfile, port, image, or local-run change; `podman compose up` remains documented. |
| Coverage | ✅ | Both workspaces exceed 80 on all four metrics; no exclusions or thresholds changed. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| Spec review r2 F1 (scoped clean/reviews/Vercel baseline) | ✅ fixed | T3 stages `reviews/**`, scopes the clean check to feature paths, records the Vercel status in T1, and excludes it from T3. |
| Spec review r2 F2 (non-skill parity) | ✅ fixed | The T2/T3 parser compares all non-skill rules to `7b87cbb`; reviewer reproduction passes. |
| Spec review r2 F3 (total-count parser) | ✅ fixed | The parser counts every `action: skill` occurrence and requires it to equal the parsed skill-rule count. |
| Spec review r2 F5 (baseline exclusion) | ✅ fixed in content | Spec/plan/tasks document the pre-existing Vercel status baseline/exclusion; the T1 log records it. The status note is an orchestrator action (F3 INFO). |
| F4/F6 r1 (untracked packs/dirty lock) | ✅ closed | All 33 packs are tracked and `skills-lock.json` is clean; T1 deletes exactly the enumerated set. |

## Notes / backlog (non-blocking)

- **F1 acceptance action:** append the post-commit `test -z` output and commit/`--stat` evidence to the task build logs (or a T3 addendum) so AC-11's build-log wording is fully satisfied; for future tasks, move the T1 pre-commit `test -z` after the commit or allow staged `D` entries. The reviewer verified the current/T3 state, so this is evidence bookkeeping, not a content fix.
- **Acceptance:** set `docs/features/project-only-skills/status.md` to accepted, add the `project-only-skills` row to `docs/features/README.md`, and commit the code-review artifact. No source, skill, agent, or docs content should change after acceptance.
- **No additional user gate:** the user explicitly authorized deleting the imported packs; Q-1 (repo-level Context7 entry) and Q-2 (History slug wording) remain non-blocking defaults.
- **Current status:** the working tree has the orchestrator's `status.md` transition and the pre-existing `docs/features/vercel-fly-neon-deployment/status.md`; neither is a feature defect, and the T3 commit tree has no `.agents`/`skills-lock` and no Vercel status commit.
- No skill, agent, doc, source, config or git state was edited by this review; only this review artifact was written.
