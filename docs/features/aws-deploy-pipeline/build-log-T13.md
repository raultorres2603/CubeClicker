# Build log — T13 — Framework: AGENTS.md + builder + skills strengthening

Task: T13 (2026-10-31)
Files changed:
- `AGENTS.md`
- `.opencode/agents/builder.md`
- `.opencode/skills/web-implementation/SKILL.md`
- `.opencode/skills/code-review/SKILL.md`

What changed & why: Applied pinned in-place extensions per plan.md contracts 1-3 and 7-9:
- AGENTS.md: added a `proof-of-working` bullet to ## Workflow (after the Feature artifacts bullet); extended the ✅ Always boundary line with feature-appropriate proof + raw-evidence recording; amended the § Stack parenthetical (contract 9) from "AWS ECS Fargate is an example only — no provider is chosen" to "AWS + Terraform selected per the user's 2026-10-31 request; container images remain provider-neutral deployables". No other text changed.
- builder.md: extended the Verify bullet in place to run the task's `verify` commands plus any feature-appropriate proof and record raw evidence. No `permissions:` lines touched (T0 owns those).
- web-implementation SKILL.md: added a Definition of Done item making recorded verification evidence (raw output of verify + feature-appropriate proof) a completion precondition.
- code-review SKILL.md: extended Workflow step 3 in place to list the feature-appropriate proof commands (Mailpit-primed containerized smoke; containerized `terraform fmt -check`/`validate` + credential-less plan when the tree permits; pinned `actionlint` wrapper when the diff contains `.tf`/`.yml`).

Decisions: Wording bounded by the named tokens in plan.md contracts 1-3, 7-9; edits applied via targeted in-place replacement so only the pinned lines changed (no new sections). Two-phase partition respected: only the Verify bullet of builder.md changed; no `action`/`resource` permission lines.

Evidence (raw command output):

- `grep -n "proof-of-working" AGENTS.md` ->
```
39:- proof-of-working: a feature is green to go only when its verification evidence is recorded and reproducible: lint, typecheck, tests, `npm run coverage`, plus feature-appropriate proof such as the Mailpit-primed containerized smoke recipe for cross-service behavior or the containerized `terraform fmt/validate` + `actionlint` wrappers for infra/pipeline config changes; raw output lives in the build logs, and the reviewer reproduces it.
```

- `grep -n "feature-appropriate" .opencode/agents/builder.md` ->
```
121:- Verify: run the task's `verify` commands plus any feature-appropriate proof and record raw evidence in `build-log-<taskid>.md`. Never claim success without command output.
```

- `grep -n "proof" .opencode/skills/web-implementation/SKILL.md` ->
```
53:- [ ] Recorded verification evidence: raw output of the task's `verify` commands plus any feature-appropriate proof is captured in `build-log-<taskid>.md` (completion precondition)
```

- `grep -n "actionlint" .opencode/skills/code-review/SKILL.md` ->
```
18:3. Run the full verification suite yourself (commands from `AGENTS.md`, including the coverage command `npm run coverage`) — evidence over claims. Run cheap edge-case experiments where useful (corrupt save, rapid clicks, reload, offline time jump). Also run any feature-appropriate proof the diff warrants: the Mailpit-primed containerized smoke recipe (`podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` then `npm run smoke`) for cross-service claims; the pinned containerized `terraform fmt -check` / `validate` (+ credential-less plan when the tree permits) and the `actionlint` wrapper (`podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml`) when the diff contains `.tf`/`.yml`. Treat un-recorded or unreproducible evidence as unmet.
```

- `grep -n "provider is chosen" AGENTS.md` ->
```
(no output — exit 1; the § Stack sentence is amended, contract 9)
```

- two-phase guard: `git show -- .opencode/agents/builder.md | grep -E '^[+-].*(- action|resource:)'` ->
```
(no output — exit 1; this task touches ONLY the Verify bullet, no permissions lines)
```

- consistency: `grep -n "state" .opencode/agents/orchestrator.md` ->
```
2:description: CubeClicker workflow orchestrator. The only user-facing agent; delegates every phase to the planner, builder, and reviewer subagents and owns feature state. Never implements or reviews.
52:- Keep user-facing output terse: one update per state transition, one final summary per feature.
53:- Online/real-time awareness: the game is online and real-time (`AGENTS.md`, `docs/architecture/stack.md`); when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary.
56:- Proof-of-working gate: before transitioning `building -> code_review`, confirm every behavior-change task's build log records raw verify evidence — including the `npm run coverage` run (thresholds >= 80% statements/branches/functions/lines per workspace) and any pinned feature-appropriate proof (e.g. the Mailpit-primed containerized smoke recipe for cross-service behavior, or the containerized `terraform fmt -check` / `validate` + `actionlint` wrappers for infra/pipeline config changes); un-recorded or unreproducible evidence means the feature stays in `building`. No new state and no new user checkpoint (autonomy per the 2026-10-16 directive).
62:1. Derive a kebab-case slug; create `docs/features/<slug>/status.md` from the playbook template (state `planning`).
64:3. Drive the state machine per the playbook: `planning -> spec_review -> awaiting_approval -> building -> code_review -> accepted`, with the documented loops and limits.
83:- `escalated`: state, what happened, blockers, 2-4 options, then stop.
```

- `grep -n "Definition of Done" .opencode/skills/web-implementation/SKILL.md` ->
```
47:## Definition of Done
```

- `grep "Subagent Report"` in touched files ->
```
.opencode/agents/builder.md:128:Subagent Report: status (`completed` | `blocked` | `failed`), artifacts, evidence (commands and results), open questions, next recommendation.
.opencode/skills/web-implementation/SKILL.md:19:8. Return the Subagent Report.
```
(AGENTS.md and code-review SKILL.md contain no "Subagent Report" reference; their pinned formats are unchanged — neither originally contained the token.)

Acceptance audit:
- AC-16 -> met: AGENTS.md gains the proof-of-working rule (Workflow bullet + extended ✅ boundary line) with no other text changes; § Stack sentence amended (contract 9).
- AC-17 -> met: builder.md Verify bullet extended with feature-appropriate proof + raw-evidence recording; report format unchanged; no `permissions:` lines touched.
- AC-20 -> met: web-implementation DoD gains the recorded-verification-evidence item; code-review step 3 lists the feature-appropriate proof commands (Mailpit-primed smoke, containerized terraform fmt/validate + credential-less plan, actionlint wrapper).
- AC-21 (e) fragment -> met: AGENTS.md § Stack parenthetical amended.

Deviations from spec: none.