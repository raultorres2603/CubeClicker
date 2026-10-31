# Build log — T12 — Framework: orchestrator + reviewer + playbook strengthening

Task: T12 (2026-10-31)
Files changed:
- `.opencode/agents/orchestrator.md`
- `.opencode/agents/reviewer.md`
- `.opencode/skills/orchestration-playbook/SKILL.md`

What changed & why: Applied pinned in-place extensions per plan.md contracts 4-6:
- orchestrator.md: added a "Proof-of-working gate" iron rule bullet before `building -> code_review`, requiring every behavior-change task's build log to record raw verify evidence (including the `npm run coverage` run at thresholds >= 80 and any pinned feature-appropriate proof); un-recorded/unreproducible evidence keeps the feature in `building`. No new state, no new user checkpoint.
- reviewer.md: extended the code-gate evidence bullet in place so the reviewer independently reruns `npm run coverage` AND any pinned feature-appropriate proof; un-recorded or unreproducible evidence counts as unmet.
- orchestration-playbook SKILL.md: widened the `building -> code_review` transition rule in place to require verify evidence (coverage run + any pinned feature-appropriate proof). State names (8 states), checkpoint semantics, verdict parsing, and the rest of the skill untouched.

Decisions: Wording bounded by the named tokens in plan.md contract 4-6; edits applied via targeted in-place replacement so only the pinned lines changed (no new sections).

Evidence (raw command output):

- `grep -n "proof" .opencode/agents/orchestrator.md` ->
```
56:- Proof-of-working gate: before transitioning `building -> code_review`, confirm every behavior-change task's build log records raw verify evidence - including the `npm run coverage` run (thresholds >= 80% statements/branches/functions/lines per workspace) and any pinned feature-appropriate proof (e.g. the Mailpit-primed containerized smoke recipe for cross-service behavior, or the containerized `terraform fmt -check` / `validate` + `actionlint` wrappers for infra/pipeline config changes); un-recorded or unreproducible evidence means the feature stays in `building`. No new state and no new user checkpoint (autonomy per the 2026-10-16 directive).
```

- `grep -n "feature-appropriate" .opencode/agents/reviewer.md` ->
```
56:- At the code gate, rerun `npm run coverage` yourself and independently rerun any pinned feature-appropriate proof (e.g. the Mailpit-primed containerized smoke recipe for cross-service behavior, or the containerized `terraform fmt -check` / `validate` + `actionlint` wrappers for infra/pipeline config changes): coverage below the thresholds (>= 80% statements/branches/functions/lines per workspace), or missing unit/integration tests for changed behavior, counts as unmet; weak assertions (banned matchers, snapshot-only, assertion-free, tautological tests) are findings; inspect the coverage exclusions for number-gaming (production code excluded or thresholds lowered to pass); un-recorded or unreproducible evidence counts as unmet; builder logs are claims, not evidence.
```

- `grep -n "verify evidence" .opencode/skills/orchestration-playbook/SKILL.md` ->
```
33:- `building -> code_review` when every task in `tasks.md` is `[x]` and every behavior-change task's build log records its verify evidence (including the coverage run and any pinned feature-appropriate proof).
```

- `grep -c "code_review" .opencode/skills/orchestration-playbook/SKILL.md` -> 6 (state names unchanged - exactly the 8 existing states remain; the count of `code_review` references is unchanged from baseline 6)

- `grep -n "awaiting_approval" .opencode/skills/orchestration-playbook/SKILL.md` ->
```
18:| `awaiting_approval` | Spec approved; user checkpoint | Present summary, ask user (§6) |
29:- `spec_review -> awaiting_approval` when the verdict artifact frontmatter says `verdict: approved`.
32:- `awaiting_approval -> building` when the user approves.
92:## 6. User checkpoint (`awaiting_approval`)
```
(no checkpoint semantics changes)

Acceptance audit: AC-18 -> met (reviewer independently reruns the suite including feature-appropriate proof; un-recorded/unreproducible evidence = unmet); AC-19 -> met (orchestrator proof-of-working gate added; playbook `building -> code_review` widened to verify evidence; state set unchanged (8 states), no new user checkpoint, autonomy directive preserved).

Deviations from spec: none.
