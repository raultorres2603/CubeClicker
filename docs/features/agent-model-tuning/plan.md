---
feature: agent-model-tuning
revision: 2
---
# Plan — Agent Model & Effort Tuning (OpenCode Go)

## Architecture

- **What this is:** a config-content change with no runtime modules or data flow. The only artifact class is the `model:` frontmatter value in the four agent files. "Architecture" here = where the value lives, who reads it, when it applies, and how it is verified.
- **Single source of truth:** `spec.md` § Model mapping (normative). `tasks.md` § Change set repeats the four old → new strings for the builder; AC-7 checks the two are identical, so drift cannot hide.
- **Read path / effect model:** OpenCode reads agent frontmatter at session and subagent spawn time; the `model` key selects provider/model/effort. Changes apply to future sessions and spawns only. Consequence for this build: T1's builder spawns under the current config; after T1 commits, T2's builder and this feature's code reviewer spawn under the new config — the code-reviewer spawn is the first run that exercises the new reviewer mapping (de facto rollout smoke test; see § Risks).
- **No dependencies, scripts, CI, containers, or permission work.** Nothing else in the repository defines agent models (basis in `spec.md` § Current state & change surface; `opencode.jsonc` has no model key and stays untouched).
- **Rollback:** each agent is a single-line revert (`git revert` of the T1 commit restores all four baselines; per-file one-line edit otherwise). Nothing is pushed by tasks.

## Interfaces / contracts

**Pinned change set (old line → new line; line 4 in all four files as of 2026-10-19 — the build anchors on exact text, not position):**

| File | Current line (anchor) | Target line |
| --- | --- | --- |
| `.opencode/agents/orchestrator.md` | `model: opencode/deepseek-v4.1-flash-free#high` | `model: opencode-go/deepseek-v4.1-flash#low` |
| `.opencode/agents/planner.md` | `model: opencode/deepseek-v4.1-flash-free#max` | `model: opencode-go/deepseek-v4-pro#max` |
| `.opencode/agents/builder.md` | `model: opencode/deepseek-v4.1-flash-free#high` | `model: opencode-go/deepseek-v4.1-flash#high` |
| `.opencode/agents/reviewer.md` | `model: opencode/glm-5.3-flash-free#max` | `model: opencode-go/qwen3.7-plus#max` |

**Boundary contract:** only the `model:` scalar changes; every other byte of the four files (all frontmatter keys — including every `permissions:` entry — and all prose) is byte-identical to the build-start baseline (AC-5). The replacement must anchor on the exact old line, found exactly once (otherwise exit non-zero); re-running after the change is a no-op or a loud failure — never a double edit. Line endings unchanged.

**Failure contract:** if a target row or variant is absent from the live provider catalog at build time, stop and report `blocked` — a spec revision re-pins; never substitute a model or variant (spec Q-3).

**Verification contract:** exact commands in `tasks.md` (T1/T2 `verify:`) — exact-line greps, uniqueness counts, YAML parse + value equality, diff-scope checks, completeness search, catalog cross-check; raw outputs recorded in the task build logs. `npm run coverage` is N/A by design (spec § Testing strategy) and is not part of any verify.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `.opencode/agents/orchestrator.md` | Edit | `model:` → `opencode-go/deepseek-v4.1-flash#low` |
| `.opencode/agents/planner.md` | Edit | `model:` → `opencode-go/deepseek-v4-pro#max` |
| `.opencode/agents/builder.md` | Edit | `model:` → `opencode-go/deepseek-v4.1-flash#high` |
| `.opencode/agents/reviewer.md` | Edit | `model:` → `opencode-go/qwen3.7-plus#max` |
| `docs/features/agent-model-tuning/build-log-T1.md` | New | T1 evidence (baselines, diffs, greps, parse, commit) |
| `docs/features/agent-model-tuning/build-log-T2.md` | New | T2 per-AC evidence table |
| `docs/features/agent-model-tuning/{spec,plan,tasks}.md` | New | Planner artifacts |
| `docs/features/agent-model-tuning/status.md` | Edit | Orchestrator state (not a build task) |
| `docs/features/agent-model-tuning/reviews/*.md` | New | Reviewer verdicts |
| `docs/features/README.md` | Edit | Index row at acceptance only — orchestrator-owned, post-code-gate, outside all T1/T2 `files_owned` and outside build-commit scope-discipline evidence (AC-9 carve-out) |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | orchestrator → `opencode-go/deepseek-v4.1-flash#low` | Mechanics + bookkeeping, highest call count, latency-sensitive; the cheapest paid tier is the right home for that profile; `low` effort cuts per-turn reasoning cost. | claude-haiku-5-5#low / gpt-6-luna#low ($0.10/$0.50 — slightly cheaper, no continuity/proven-role evidence); muse-spark-1.3-contributor#low ($0.10/$0.20 — no continuity); mimo-v2.6-flash / mimo-v2.5 ($0.14/$0.28 — no effort variants); `#high` (status quo — kept as one-line fallback, spec Q-1); free models (spec Q-2). |
| D-2 | builder → `opencode-go/deepseek-v4.1-flash#high` | Highest volume × low unit price is the main cost control; `high` effort pays for implementation depth without multiplying the largest token stream at `max`. | deepseek-v4-pro / qwen3.7-plus (3–4× unit price over the largest volume — rejected); `#max` (volume-multiplied effort — rejected); kimi-k2.7-code ($0.95/$4, above ceiling, no variants — rejected); free models (Q-2). |
| D-3 | planner → `opencode-go/deepseek-v4-pro#max` | The spec is the contract — highest stakes, low-to-moderate volume; pro tier gives the never-under-powered headroom at ~1/6 of the $4 top-tier input / ~1/10 of the $20 top-tier output; `max` effort is affordable at this volume. | qwen3.7-plus#max (cheaper mid-tier; kept for the reviewer instead so families split, D-4); deepseek-v4.1-flash#max (status-quo class; rejected as under-powered risk for the contract role); glm-5.3#max (above ceiling). |
| D-4 | reviewer → `opencode-go/qwen3.7-plus#max` | The gate is above the builder it most directly gates (flash), is family-independent from the DeepSeek planner/builder by design (adversarial diversity; independence chosen over price tier versus the planner), and runs at `max` rigor; plus tier is the balance point ($0.40/$1.60 = 10%/8% of the $4/$20 top tier). | glm-5.3-flash#max (exact continuity, $0.15/$0.50; rejected — same tier as builders, under-powered for the gate; kept as user fallback, spec Q-4); deepseek-v4-pro#max (stronger; same model as planner — independence loss); glm-5.3#max (above ceiling); claude-haiku-5-5#max (small-model class for a rigor gate — rejected). |
| D-5 | Cost boundary: exclude top-price {gemini-4-argon-contributor, kimi-k3, qwen3.8-max, grok-4.7} plus above-ceiling {glm-5.3, step-5-preview, kimi-k2.7-code, hy4-preview}; mapping ceiling $0.66/$1.98 | Implements "do not use the most expensive" with an explicit, checkable ceiling; the nearest excluded model ($0.834/$2.501) is above the ceiling. | Free models (rate-limit risk — Q-2); all-flash cheapest mapping (under-powers planner/reviewer per the request's role-based balance). |
| D-6 | Effort policy: `low` = mechanical/high-frequency (orchestrator); `high` = heavy implementation (builder); `max` = high-stakes authoring/verification (planner, reviewer); each variant validated against its model's variant set (AC-7) | Effort is the fine-tuning knob the request asks for; differentiated by role rather than uniform. | Uniform effort across roles (ignores role differentiation). |
| D-7 | Change surface: only the four `model:` lines; permissions/prose/`steps`/`color`/`description`/`mode` untouched | Explicit user constraint; keeps the diff auditable and the rollout revert trivial; broader agent-file changes would be a separate feature. | Any combined edits (rejected; would need their own spec). |
| D-8 | Verification = file-level inspection (grep/diff/parse/catalog); `npm run coverage` N/A | No application/test content changes; coverage would measure untouched code and yield zero signal (spec § Testing strategy). | Running coverage anyway (no evidence value — rejected). |
| D-9 | Containerization: no impact | AI-framework config only; no services/images/ports/env/deployables. | — |
| D-10 | Rollout = future spawns only; first post-change spawn (this feature's code reviewer) is the smoke signal; per-file one-line revert | The platform reads agent config at spawn time; the change is observed naturally in the next spawn cycle. | Pre-spawn validation (no mechanism available to the pipeline — stated honestly). |

## Risks & mitigations

- **opencode-go variant support in subagent configs** — the `#variant` syntax is already in use in all four files (`opencode/...-free#max` today), so parsing/support is proven in this environment; the catalog was queried live 2026-10-19; an unsupported id would fail at first spawn and be reverted one line at a time.
- **Catalog drift** (ids/variants/prices changing between 2026-10-19 and the build) — AC-7 cross-checks against the recorded catalog; absence → `blocked` + spec revision (Q-3); the reviewer re-queries live if tooling allows.
- **Capability assumptions without benchmarks** — mitigated by family continuity for the proven roles (orchestrator/builder stay in the deepseek flash class) and mid-tier hedges for planner/reviewer; flagged as an explicit assumption (spec § Assumptions); Q-5 schedules a trial review; every change is a one-line revert.
- **Orchestrator `low` effort may under-perform on edge cases** — the workload is mechanical by design; the first post-rollout sessions are observable; fallback `#high` is one line (Q-1).
- **In-flight `cube-game-frontend` build** — no file conflicts (`.opencode/agents/` vs `src/frontend/`); its future builder spawns run the updated builder config, which is the same family/tier class (deepseek flash, paid) — behaviorally near-identical; its remaining orchestrator transitions run under the new orchestrator config — monitor the first transitions.
- **Config typo breaking future spawns** — byte-exact copying from the pinned tables, `grep -Fx` checks, YAML parse, first-spawn smoke signal, `git revert`.
- **Spend decision ownership** — the `awaiting_approval` checkpoint presents the mapping table with recorded prices and is the user-owned spend decision; the build (T1) proceeds only after that approval is recorded per the workflow; no auto-fallback to other models exists.
- **Free-tier distraction** — free models are explicitly excluded with rationale (Q-2), so the choice is deliberate, not accidental.

## Open questions

Spec Q-1…Q-5 are maintained in `spec.md` § Open questions (orchestrator effort fallback; free-model exclusion; catalog drift handling; reviewer fallback; trial review). No plan-only open questions.
