---
feature: project-glossary
phase: spec
iteration: 1
verdict: approved
blocking: 0
nonblocking: 8
---
# Spec Review — r1

## Summary

✅ **approved** — The spec, plan, and tasks fully cover the verbatim request: target path exactly `docs/product/glossary.md` (AC-1), all eight requested terms with one example sentence each (AC-5…AC-8), concision made mechanically inspectable (AC-10…AC-12 with a pinned counting rule and slack), and no dependency, tooling, or stack assumption (consistent with stack NOT DECIDED). Every AC is binary-verifiable by inspection, which is the only available gate while `AGENTS.md` § Commands is TBD. No parallel-safety or dependency-graph defects. The one genuine execution risk — Q-1 builder permissions — is correctly identified and gated, and is an execution-time precondition rather than a defect in the reviewed artifacts (rationale under F1).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER (execution trigger — **not** a spec-gate defect) | spec.md § Open questions (Q-1); plan.md § Risks & mitigations, § Open questions; tasks.md line 5 (building precondition); evidence: `.opencode/agents/builder.md` lines 7–37, `.opencode/agents/orchestrator.md` lines 7–19, `.opencode/agents/planner.md` lines 7–22 | Builder edit permissions are a deny-all + allowlist that excludes `docs/product/**`; T1 (`docs/product/glossary.md`) and T2 (`docs/product/vision.md`) are therefore unwritable by the builder. The orchestrator (only `docs/features/**/status.md`, `tasks.md`, `README.md`) and planner (only `docs/features/**`) cannot write them either — so no pipeline agent can perform the two product-doc edits under current configuration. | None to the reviewed artifacts — the spec already treats this as a hard precondition (stated in spec Q-1, plan Risks, and the tasks.md precondition line) and the resolution path is viable: agent-config permissions are user-owned shared config ("ask first" per AGENTS.md § Boundaries), so the orchestrator **MUST** resolve Q-1 at the `awaiting_approval` checkpoint (user widens `.opencode/agents/builder.md` to allow `docs/product/**`, or approves an alternative route such as applying the two edits outside the builder role). State may flip to `building` only after Q-1 is resolved; otherwise T1/T2 are guaranteed permission-blocked. | open — gated at approval checkpoint; no artifact change requested |
| F2 | MINOR | plan.md § Interfaces / contracts → Baseline paragraph (line 74) | Baseline facts are stale: plan.md states "The repository's only commit (`cba610b` …) contains just `.gitattributes` and `LICENSE`". At review time HEAD is `927fd78` ("Initial commit"), which commits the entire project tree including `docs/product/vision.md`; `cba610b` is its parent. The verbatim quote still matches the committed file content exactly (verified line-by-line), and the plan's own fallback clause ("If the repo is committed before building, the committed content becomes the baseline") keeps AC-13 verifiable, so verifiability is not lost — but T2's evidence log would anchor on a factually false sentence. Also: AC-13 requires "exactly one added line", yet the source of truth for "before" is ambiguous if `vision.md` has uncommitted user edits at T2 start. | Correct plan.md § Baseline to acknowledge the committed baseline (`git show HEAD:docs/product/vision.md`) and pin the operational rule: baseline = committed content at T2 start; any pre-existing uncommitted `vision.md` changes must be noted in `build-log-T2.md` before the link line is added. Batch with the next planner touching of plan.md (no dedicated revision round required — this does not gate approval). | open |
| F3 | MINOR | spec.md § Acceptance criteria (AC-8); plan.md § Interfaces / contracts → Counting rule | Term-usage matching is underspecified at the edges: (a) for plural term `points`, is the bare singular "point" an accepted form? (b) matching must be whole-token, not substring — e.g. "point" inside "disappoint" must not satisfy AC-8 for `points`. Expected to hold naturally in practice (the example sentences will use the listed forms), but a verifier and a builder should not have to infer this. | Add one clarifying clause to AC-8 or the plan's counting rule: the term must appear as a whole, punctuation/whitespace-delimited token (case-insensitive), with inflections counted (e.g. clicked/clicking for `click`; saved/saving/saves for `save`; points/singular `point` for `points`); unrelated words containing the letters (e.g. "disappoint") do not count. Batch with F2. | open |
| F4 | INFO | spec.md § Open questions (Q-4); plan.md D-6 | One additive link line in `docs/product/vision.md` goes slightly beyond the literal request text ("all agents and docs use consistent terms" is the traceable rationale). Acceptable open question, not a blocker: the edit is minimal, pinned with a placement contract and verbatim baseline, an explicit "leave vision.md untouched" alternative is documented, and the user checkpoint precedes `building`. Confirm at checkpoint. | User confirms Q-4 at `awaiting_approval`. | open — confirmed at checkpoint |
| F5 | INFO | spec.md § Open questions (Q-3); plan.md D-2; spec.md § Explicitly out of scope | Freezing the term set at the eight listed (request said "e.g.") is a scope-control choice, not a coverage failure — every requested term is present. Additions have a defined amendment route. Acceptable open question, not a blocker. | User confirms Q-3 at `awaiting_approval`. | open — confirmed at checkpoint |
| F6 | INFO | spec.md § Open questions (Q-5); spec.md § Non-goals | Retrofitting existing docs to glossary terms is correctly deferred as an explicit non-goal (follow-up candidate). Not a blocker; backlog item. | Backlog; decide post-acceptance. | backlog |
| F7 | INFO | plan.md D-1; `docs/product/vision.md` § Principles | The idle/offline split (D-1) is well-grounded: vision.md's own "Idle-friendly" principle uses the parenthetical "(offline progress)" for away-time accrual — exactly the conflation the split prevents. Note the tension persists in vision.md because AC-13 forbids touching it beyond the link line; a future Q-5 retrofit would reconcile the wording. | None; informational. | backlog |
| F8 | INFO | spec.md § Open questions (Q-2); plan.md D-7 | Universal agent discovery via `AGENTS.md`/`.opencode/` prompts is deferred — correct call here (shared config is ask-first territory and `.opencode/**` is a 🚫 Never for this feature). Backlog recommendation. | Backlog; separate feature request if adopted. | backlog |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All eight requested terms covered (AC-5); the "idle/offline progress" umbrella split into two cross-referenced entries with rationale (D-1, AC-9); exact target path `docs/product/glossary.md` (AC-1); example sentence per term (AC-7/AC-11); concision measurable (AC-10…AC-12); consistent-usage ask covered by the usage note (AC-3/AC-4) plus the vision.md discovery line (AC-13, flagged to user via Q-4). |
| Testability | ✅ | Every AC is binary, single-behavior, inspectable with zero tooling: exactly-one-H1 (AC-2), exact-entry-set with pinned spellings (AC-5), alphabetical order (AC-6 — verified correct: click, cube, idle progress, offline progress, points, prestige, save, upgrade), mutual cross-naming (AC-9), counting rule + slack (AC-10…AC-12 — worst-case ≈ 610 words < 700, ≈ 49 lines < 100, holds under either counting convention), exact-one-added-line vs verbatim baseline (AC-13). |
| Boundaries | ✅ | Three tiers present (spec § Boundaries); non-goals explicit and exhaustive; no invented scope beyond the vision.md link presented to the user as a confirmable decision (Q-4). |
| Dependency graph | ✅ | T1 → T2 → T3 strictly sequential; `depends_on` points at earlier tasks only; all 13 ACs mapped (T1: AC-1…12, T2: AC-13, T3: full gate); each task is one builder session. |
| Parallel safety | ✅ | No `[P]` tasks; sequential chain; `files_owned` fully disjoint including the three distinct build-log files (T1: glossary.md + log-T1; T2: vision.md + log-T2; T3: log-T3). |
| Security | ✅ | Documentation-only: no user-controlled data, no runtime, no persistence, no secrets, no dependency additions (spec § Security considerations). Vision.md edit additive with pinned baseline so review can prove non-destructiveness. |
| Testing | ✅ | Strategy explicitly inspection-only and correctly justified (`AGENTS.md` § Commands TBD; stack NOT DECIDED; stack.md forbids assuming tooling). Edge cases named by construction: counting ambiguity, multiword alphabetical ordering, relative-link resolution, untracked→committed baseline (see F2). |
| Consistency | ✅ | Aligns with vision.md vocabulary (cube, click, points, upgrade, offline progress, persistence/save); stack-agnostic per stack.md's planner mandate with no stack-dependent decisions (Q-6); does not contradict AGENTS.md — it routes shared-config discovery edits and permission changes to ask-first channels (Q-1/Q-2). |

## Previous round verification (if iteration > 1)

N/A — round 1.

## Notes / backlog (non-blocking)

- **Q-1 gate discipline (F1):** recommended checkpoint wording for the orchestrator — "Approve requires (a) confirming Q-3/Q-4, (b) resolving Q-1 by widening `.opencode/agents/builder.md` to allow `docs/product/**` (user action, shared config), before `building` starts."
- If Q-4 is declined, drop T2 and AC-13 in a r2 spec touch — cheap revision, no other artifacts affected.
- F2/F3 are hygiene fixes to batch into the next planner touching of plan.md; neither warrants a dedicated revision round on its own.
- Post-acceptance backlog: Q-5 retrofit of vision.md body wording ("Idle-friendly … (offline progress)") and `docs/features/README.md`; Q-2 agent-config discovery link.

## Verdict

**approved** — blocking changes to reviewed artifacts: **0**. Condition: F1 must be resolved at the `awaiting_approval` checkpoint before the state flips to `building`; T1/T2 must not be dispatched with an unmodified builder permission set.
