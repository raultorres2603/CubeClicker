---
feature: agent-model-tuning
revision: 2
status: draft
created: 2026-10-19
updated: 2026-10-19
---
# Spec — Agent Model & Effort Tuning (OpenCode Go)

## Summary

Retune all four CubeClicker pipeline agents to provider **OpenCode Go** (`opencode-go`) with role-specific model + effort choices that balance intelligence, efficiency, and cost. Raw request (verbatim): "Please, proceed to update our AI framework agents to update models to use OpenCode Go models. Also, adapt effort of each model's agent in order to adjust them to be optimized. Also, do not use the most expensive one, do a "balance" between efficiency and cost and intelligence based on agent's role. Does make sense?"

The entire change surface is exactly **one `model:` frontmatter line per agent file** (line 4 today) in `.opencode/agents/{orchestrator,planner,builder,reviewer}.md`. The normative mapping (proposed at the approval checkpoint; the build copies the target strings byte-for-byte only after the user approves this spec at that checkpoint):

| Agent | Current (baseline) | Target (normative) | Recorded unit price ($in/$out per MTok) |
| --- | --- | --- | --- |
| orchestrator | `opencode/deepseek-v4.1-flash-free#high` | `opencode-go/deepseek-v4.1-flash#low` | 0.15 / 0.60 |
| planner | `opencode/deepseek-v4.1-flash-free#max` | `opencode-go/deepseek-v4-pro#max` | 0.66 / 1.98 |
| builder | `opencode/deepseek-v4.1-flash-free#high` | `opencode-go/deepseek-v4.1-flash#high` | 0.15 / 0.60 |
| reviewer | `opencode/glm-5.3-flash-free#max` | `opencode-go/qwen3.7-plus#max` | 0.40 / 1.60 |

The mapping keeps the two highest-volume roles (orchestrator, builder) on the cheapest paid tier, moves the two high-stakes reasoning roles (planner — the spec is the contract; reviewer — the independent gate) one tier up at maximum effort, and uses the `#variant` effort suffix as the per-role fine-tuning knob (`low` / `high` / `max` / `max`). No top-price model is used: the highest unit price anywhere in the mapping is the planner's $0.66/$1.98, and every model priced above that is excluded (§ Cost boundary). Everything else about the four files — `permissions:`, prompts/prose, `description`, `mode`, `color`, `steps`, and every other byte — stays identical, and nothing else in the repository defines agent models (verification basis in § Current state & change surface). Config changes take effect for **future sessions and subagent spawns only**.

## Scope

### In scope

- Exactly four line replacements — the single `model:` line (line 4 today) of `.opencode/agents/orchestrator.md`, `.opencode/agents/planner.md`, `.opencode/agents/builder.md`, `.opencode/agents/reviewer.md` — with the values pinned in § Model mapping (normative).
- This feature's artifacts: `docs/features/agent-model-tuning/{spec,plan,tasks}.md`, the per-task build logs (`build-log-T1.md`, `build-log-T2.md`), the review artifacts, and the orchestrator-owned `status.md`.

### Explicitly out of scope

- Any change to `permissions:` blocks or allow/deny entries in any agent file (or anywhere else).
- Any change to prompts/prose, `description`, `mode`, `color`, `steps`, or any other frontmatter key; any change to any other `.opencode/**` file (skills, playbook, templates, commands).
- Any application code, tests, build config, dependencies, scripts, CI, or container assets; any new tooling.
- Any user-level/global OpenCode configuration outside this repository.
- Empirical model benchmarking / A-B testing, fallback chains, cost telemetry, or auto-tuning machinery (capability positioning is a reasoned proxy — see § Assumptions).
- Any change to how features are planned, built, or reviewed (no framework-rule changes).

## Current state & change surface

The change surface, verified 2026-10-19 (line numbers are current positions; the build anchors on the exact baseline line text — never on line numbers):

| File | Line | Current value |
| --- | --- | --- |
| `.opencode/agents/orchestrator.md` | 4 | `model: opencode/deepseek-v4.1-flash-free#high` |
| `.opencode/agents/planner.md` | 4 | `model: opencode/deepseek-v4.1-flash-free#max` |
| `.opencode/agents/builder.md` | 4 | `model: opencode/deepseek-v4.1-flash-free#high` |
| `.opencode/agents/reviewer.md` | 4 | `model: opencode/glm-5.3-flash-free#max` |

**Verification basis — nothing else in the repository defines agent models:**

- Repo-wide line-start search (`grep -rn "^\s*model\s*[:=]" .`) returns only the four agent files above (live configuration) plus five historical build logs under `docs/features/**` (records of past runs — not configuration; they are never edited by this feature).
- `opencode.jsonc` (read in full, 2026-10-19) defines no model: its only keys are `$schema`, `default_agent`, `permissions`. No other JSON/JSONC/YAML/TOML config in the repository matches a model key.
- `.opencode/commands/feature.md` contains no model reference; `AGENTS.md` and `README.md` name no model.

**Operational semantics.** Agent config is read at session/subagent spawn time: the tuned models take effect for future sessions and spawns, not for already-running agents. For this feature specifically: T1's builder spawns under the current configuration; after T1 commits, later spawns (T2 builder, code reviewer) pick up the new configuration, so this feature's code-reviewer spawn is the first spawn that exercises the new reviewer mapping (see `plan.md` § Risks).

**Feasibility.** No permission bootstrap is needed: the builder already holds an `edit` allow for `.opencode/agents/*.md`, the planner for `docs/features/**`, the reviewer for `docs/features/**/reviews/**`, and the orchestrator for `tasks.md`/`status.md`. Framework-file operations are performed by the pipeline under reviewer oversight (user directive of 2026-10-16, quoted in `docs/features/online-realtime-workflow/spec.md` Q-1); the mapping itself is proposed for user approval at the `awaiting_approval` checkpoint.

## Model mapping (normative)

The user approves (or amends) this table at the `awaiting_approval` checkpoint; the build copies the target strings byte-for-byte only after that approval is recorded per the workflow (AC-1…AC-4, AC-7).

Workload profile per role:

| Agent | Turn shape | Latency sensitivity | Reasoning depth | Token volume |
| --- | --- | --- | --- | --- |
| orchestrator | many short turns; routing/bookkeeping, no code | high | low–moderate (fixed state machine) | moderate (input-dominated) |
| builder | long turns; code + tests + logs, many tool calls | low | moderate–high | highest |
| planner | few long turns; spec/plan/tasks authoring | low | high (contract authoring) | low–moderate |
| reviewer | moderate turns; re-derive evidence, run commands, find defects | low | high (defect hunting, independence) | moderate |

**orchestrator → `opencode-go/deepseek-v4.1-flash#low` (recorded $0.15/$0.60)**

- Workload: the highest call count and the shortest turns of the four agents — routing, Task-Brief assembly, verdict parsing, state bookkeeping; it never writes code. Every state transition waits on it, so latency and per-turn cost dominate its profile.
- Intelligence: reliable instruction-following of a fixed state machine and terse summarization — not deep reasoning. The flash tier is the class that demonstrably serves the role today (its `-free` sibling); the paid swap preserves demonstrated adequacy.
- Efficiency/cost: cheapest paid tier; `low` effort is the largest lever at high call frequency (fewer reasoning tokens, lower latency per turn).
- Effort fit: `low` is valid for this model ({low, high, max}); the work is mechanical and speed beats deliberation. Fallback note: if reliability ever dips, `#high` is a one-line change (Q-1).

**builder → `opencode-go/deepseek-v4.1-flash#high` (recorded $0.15/$0.60)**

- Workload: heaviest by token volume — long-context reads, many tool calls, code and unit/integration tests, evidence logs, sometimes parallel-safe batches. Volume × unit price dominates total framework spend.
- Intelligence: solid code generation/repair and deterministic failure analysis; the flash tier is the current builder's family (demonstrated).
- Efficiency/cost: keeping the highest-volume role on the cheapest paid tier is the single most important cost decision; a pro/plus model here would multiply the largest volume by 3–4× unit price.
- Effort fit: `high` ({low, high, max}) buys implementation depth where it pays; `max` is rejected because effort multiplies over the largest volume and the builder's bar is tests + evidence, not maximal deliberation.

**planner → `opencode-go/deepseek-v4-pro#max` (recorded $0.66/$1.98)**

- Workload: low-to-moderate volume; long structured outputs (spec/plan/tasks) plus revision rounds. The spec is the contract the whole pipeline builds and is gated against — the highest-stakes single artifact.
- Intelligence: high — decomposition, edge-case enumeration, boundary precision, cross-artifact consistency; deliberately one tier above flash so the contract role is never under-powered ("cheapest-adequate, not cheapest-at-any-cost").
- Efficiency/cost: at low-to-moderate volume, pro pricing is affordable and still far under the exclusions — ~1/6 of the top-tier $4 input and ~1/10 of the top-tier $20 output.
- Effort fit: `max` ({high, max}) — low volume makes maximum deliberation cheap in absolute terms; subtle spec ambiguity is the most expensive defect to fix downstream.

**reviewer → `opencode-go/qwen3.7-plus#max` (recorded $0.40/$1.60)**

- Workload: moderate volume; two gates per feature; must re-derive evidence, rerun commands, and find subtle defects — rigor matters most.
- Intelligence: the gate sits above the builder it most directly gates (flash) and is family-independent from the DeepSeek planner/builder by design — independence was chosen over price tier versus the planner — so review is not same-family echo. qwen3.7-plus is the balance point.
- Efficiency/cost: $0.40/$1.60 = 10% of the $4 top-tier input and 8% of the $20 top-tier output (same $4/$20 referent as the planner paragraph); moderate volume bounds spend. (Context caveat: >256k tokens → $1.2/$4.8; normal reviewer inputs — spec + diff — stay far below that.)
- Effort fit: `max` ({none, high, max}) — rigor over volume; the gate is the last line of defense.

## Cost boundary — interpretation of "do not use the most expensive"

- **Top-price models (excluded):** gemini-4-argon-contributor ($4/$20), kimi-k3 ($3/$15), qwen3.8-max and grok-4.7 ($2/$6). None is selected anywhere.
- **Above the balance ceiling (also excluded):** glm-5.3 ($1.4/$4.4), step-5-preview ($1/$2.7), kimi-k2.7-code ($0.95/$4), hy4-preview ($0.834/$2.501).
- **Ceiling of this mapping:** no chosen model exceeds $0.66/MTok input or $1.98/MTok output (the nearest excluded model, hy4-preview, starts at $0.834/$2.501).
- **Free models** (minimax-m3.1-flash-free, beam-free, longcat-2.5-preview-free) are **not** selected: free tiers carry rate-limit/availability risk and the pipeline's gates must be dependable; "balance" means cheapest-adequate, not cost-zero-at-any-cost (Q-2).
- **Cheapest-adequate, not cheapest-at-any-cost:** orchestrator and builder sit on the cheapest paid tier because their unit-price impact is the largest (orchestrator by call count, builder by volume); planner and reviewer are deliberately above flash — under-powering the contract author or the gate is false economy.
- **Neutral exclusions to record:** models with no usable effort variant (mimo-v2.5, mimo-v2.5-pro, mimo-v2.6-flash, kimi-k2.7-code, longcat) are poor fits for the requested effort tuning and are not selected; same-tier nearby options (claude-haiku-5-5, gpt-6-luna, glm-5.3-flash, qwen3.8-flash, muse-spark-1.3-contributor) are recorded in `plan.md` § Key decisions with reasons.

## Catalog basis (recorded 2026-10-19 — provider `opencode-go`)

Recorded from the live models tool on 2026-10-19 (per the Task Brief). USD per MTok; "Variants" = valid `#` effort suffixes for `provider/model#variant`. This table is the verification basis for target validity (AC-7). If the reviewer's tooling exposes the platform model listing, re-query live and record the comparison (Q-3).

| Model | $in | $out | Variants | Status in this mapping |
| --- | --- | --- | --- | --- |
| minimax-m3.1-flash-free | 0 | 0 | low, medium, high, xhigh, max | Free — not selected (Q-2) |
| gemini-4-argon-contributor | 4 | 20 | low, medium, high | Excluded — top price |
| claude-haiku-5-5 | 0.1 | 0.5 (ctx>100k: 0.5/2.5) | none, low, medium, high, xhigh, max | Not selected (alternatives D-1/D-4) |
| beam-free | 0 | 0 | low, medium, high, xhigh, max | Free — not selected (Q-2) |
| longcat-2.5-preview-free | 0 | 0 | none | Free — not selected (Q-2); no effort variant |
| mimo-v2.6-flash | 0.14 | 0.28 | none | Not selected — no effort variant |
| gpt-6-luna | 0.1 | 0.5 (ctx>272k: 0.2/0.75) | none, low, medium, high, xhigh, max | Not selected (alternative D-1) |
| grok-4.7 | 2 | 6 (ctx>200k: 4/12) | low, medium, high, xhigh | Excluded — top price |
| step-5-preview | 1 | 2.7 | low, medium, high | Excluded — above ceiling |
| deepseek-v4.1-flash | 0.15 | 0.6 | low, high, max | **Chosen — orchestrator `#low`; builder `#high`** |
| muse-spark-1.3-contributor | 0.1 | 0.2 | minimal, low, medium, high, xhigh | Not selected (alternative D-1) |
| hy4-preview | 0.834 | 2.501 | none, high | Excluded — above ceiling |
| glm-5.3-flash | 0.15 | 0.5 | low, high, max | Not selected (reviewer fallback — Q-4) |
| qwen3.8-flash | 0.15 | 0.47 | none, low, medium, xhigh | Not selected |
| glm-5.3 | 1.4 | 4.4 | low, high, max | Excluded — above ceiling |
| qwen3.8-max | 2 | 6 | none, low, medium, xhigh | Excluded — top price |
| kimi-k3 | 3 | 15 | max | Excluded — top price |
| kimi-k2.7-code | 0.95 | 4 | none | Excluded — above ceiling |
| qwen3.7-plus | 0.4 | 1.6 (ctx>256k: 1.2/4.8) | none, high, max | **Chosen — reviewer `#max`** |
| minimax-m3 | 0.3 | 1.2 (ctx>512k: 0.6/2.4) | none, thinking | Not selected — no effort variants for role needs |
| deepseek-v4-pro | 0.66 | 1.98 | high, max | **Chosen — planner `#max`** |
| mimo-v2.5 | 0.14 | 0.28 | none | Not selected — no effort variant |
| mimo-v2.5-pro | 0.435 | 0.87 | none | Not selected — no effort variant |

## User stories

- As the project owner, I want the four pipeline agents on OpenCode Go models with role-tuned effort, so the framework runs at a deliberate efficiency/intelligence/cost balance without any top-tier spend.
- As the orchestrator, I want a fast, cheap model tuned for short mechanical turns, so state transitions stay low-latency.
- As the builder, I want a capable-but-cheap high-effort model, so the highest-volume role stays affordable.
- As the planner, I want a stronger reasoning model, so the spec (the contract) is never under-powered.
- As the reviewer, I want a rigorous, independent model, so spec and code defects are found without same-family echo.

## Acceptance criteria

Verification notes:

- "Baseline" = the content of each of the four files at T1 build start, recorded in `build-log-T1.md`; the build anchors on the exact baseline line text (found exactly once), never on line numbers. **Pre-feature baseline commit** = the `git rev-parse HEAD` capture recorded in `build-log-T1.md` before any edit; T2 and AC-6 anchor every "diff vs. pre-feature" check on that recorded ref — never a relative ref such as `HEAD~1`, since the working tree can receive concurrent commits (the in-flight `cube-game-frontend` build).
- Evidence is file-level inspection: `grep` (exact-line and repo-wide searches), `git diff`/`git show`, and `python3` + `yaml.safe_load` frontmatter parsing (precedent: `docs/features/online-realtime-workflow/build-log-T0.md` § 4 ran `python3` + `yaml.safe_load` successfully in this environment; the fallback if PyYAML is ever missing is recorded in § Assumptions). These are build-time inspection aids, not project commands.
- The repo-wide coverage gate is not applicable to this feature — see § Testing strategy (no application/test content changes; the change surface lies outside all workspaces).
- "Target string" = the full `model: …` line; the ACs check content, not position.

- **AC-1** — `.opencode/agents/orchestrator.md` contains exactly one line matching `^model:` and its full content is `model: opencode-go/deepseek-v4.1-flash#low`; the file's YAML frontmatter parses and maps `model` to `opencode-go/deepseek-v4.1-flash#low`.
- **AC-2** — `.opencode/agents/planner.md` contains exactly one line matching `^model:` and its full content is `model: opencode-go/deepseek-v4-pro#max`; the file's YAML frontmatter parses and maps `model` to `opencode-go/deepseek-v4-pro#max`.
- **AC-3** — `.opencode/agents/builder.md` contains exactly one line matching `^model:` and its full content is `model: opencode-go/deepseek-v4.1-flash#high`; the file's YAML frontmatter parses and maps `model` to `opencode-go/deepseek-v4.1-flash#high`.
- **AC-4** — `.opencode/agents/reviewer.md` contains exactly one line matching `^model:` and its full content is `model: opencode-go/qwen3.7-plus#max`; the file's YAML frontmatter parses and maps `model` to `opencode-go/qwen3.7-plus#max`.
- **AC-5** — For each of the four files, the diff vs. the build-start baseline consists of exactly one removed line (the old `model:` line) and one added line (the new `model:` line): `git diff --stat` reports `4 files changed, 4 insertions(+), 4 deletions(-)`, and in the full diff every `-`/`+` line is a `model:` line — every other byte of all four files (all other frontmatter keys including the entire `permissions:` block, and all body prose) is identical to the baseline.
- **AC-6** — The four files are the complete set of model definitions in the repository's live configuration: the repo-wide line-start search for `model:`/`"model"` returns no live model definition outside `.opencode/agents/*.md` (the historical `docs/features/**` build-log hits are run records, not configuration), `.opencode/commands/feature.md` contains no model reference, and `opencode.jsonc` contains no model key and is byte-identical to its baseline at the pre-feature commit recorded at T1 build start (checked as an empty `git diff <recorded-ref> -- opencode.jsonc`, where `<recorded-ref>` is the `git rev-parse HEAD` capture in `build-log-T1.md`).
- **AC-7** — Every target string matches the normative table of this spec byte-for-byte (and the identical table in `tasks.md` § Change set); each target is well-formed `opencode-go/<model-id>#<variant>` and its variant is valid for that model per § Catalog basis (orchestrator `low`; planner `max`; builder `high`; reviewer `max` — each in its model's variant set).
- **AC-8** — No chosen target appears in the exclusion list of § Cost boundary, and no chosen model's recorded unit price exceeds $0.66/MTok input or $1.98/MTok output (highest among the four: planner, 0.66/1.98) — strictly below every excluded model.
- **AC-9** — No file other than the four agent files is modified by the feature's build commits, except artifacts under `docs/features/agent-model-tuning/**`; the acceptance-time `docs/features/README.md` index row is orchestrator-owned, lands after the code gate, is outside all T1/T2 `files_owned`, and is outside this AC's build-commit scope-discipline evidence; no diff anywhere touches a `permissions:` block or any `steps`/`color`/`description`/`mode` key; no application/test/config/container/CI file appears in any feature commit (per-commit `git show --stat` + diff grep evidence).

## Non-goals

- No permission changes: every `permissions:` block and allow/deny entry in all four files (and anywhere else in the repository) stays byte-identical.
- No prompt/prose changes; no `description`, `mode`, `color`, `steps`, or other frontmatter changes; no new agents.
- No routing/fallback logic, cost telemetry, auto-tuning, or benchmarking machinery.
- No changes to skills, playbook, templates, commands, or any other `.opencode/**` file.
- No application code, tests, configs, dependencies, scripts, CI, or container assets; no new tooling.
- No user-level/global OpenCode configuration changes (repo-scoped feature).
- No use of the excluded top-price models; no free-model usage in this change.
- No framework-rule changes (model selection only).

## Boundaries

- ✅ Always: change exactly the four `model:` lines per § Model mapping; capture baselines and raw command evidence in the task build logs; verify with the exact-line greps, the YAML parse, and the diff-scope checks; commit per task with explicit paths and a conventional message.
- ⚠️ Ask first: any deviation from the pinned mapping — including substituting a model or variant (a catalog mismatch is a `blocked` report plus a spec revision, never a workaround); any edit beyond the four `model:` lines; anything that increases cost beyond the pinned mapping.
- 🚫 Never: touch `permissions:` blocks or any other frontmatter key; edit any other `.opencode/**` file; introduce dependencies, tooling, scripts, or CI changes; select an excluded top-tier (or free) model without a spec revision; edit `.env*`; commit secrets; `git push`.

## Security considerations

- **Control-plane change.** This feature edits the workflow's own agent configuration. The scope is pinned to one line per file; permission blocks are explicitly out of scope and byte-identity is an acceptance criterion (AC-5, AC-9). The diff is tiny, auditable, and trivially revertible (per-file single-line change, or `git revert` of the T1 commit); nothing is pushed.
- **No secrets.** Model ids only — no keys, tokens, or credentials are introduced; `.env*` untouched; no dependency additions (supply chain unchanged).
- **Cost exposure.** Paid models begin serving future sessions/spawns; spend is bounded by the pinned mapping and the exclusion list. Approval of the mapping at the `awaiting_approval` checkpoint is the user-owned spend decision and gates the build — nothing starts before that approval is recorded; there is no auto-fallback to other models.
- **Provider data path.** Prompts, code, and evidence from agent runs are processed by the selected provider — OpenCode Go, the provider the user requested for the framework; no data path is introduced beyond model selection.
- **Rollout hazard.** An invalid model id/variant would surface as a spawn/config failure at the first post-change spawn; contained by the catalog cross-check (AC-7) and one-line revert per file.

## Testing strategy

- **Unit tier:** not applicable — no application module or behavior changes; the change surface is four YAML scalars in agent configs outside all workspaces. No test files are added: a "test" of a config line would be a useless test, which the project bar bans.
- **Integration tier:** not applicable — same reason; no module boundaries or services are exercised.
- **Containerized e2e:** not applicable — no services, images, or ports touched.
- **Coverage expectation:** `npm run coverage` is **not applicable** and must not be claimed as evidence: it measures `src/**` in the `@cubeclicker/backend` and `@cubeclicker/frontend` workspaces, while this feature changes no source/test file anywhere; running it would produce numbers about untouched code and zero signal for any AC. No coverage config, threshold, or exclusion is modified. No behavior-change task exists, so the coverage-verify requirement for behavior-change tasks holds vacuously. The code-gate reviewer treats this as the justified deviation: the criterion is explicitly N/A by design, not "unable to verify".
- **Functional verification (this feature's evidence tier — file-level, runnable):** exact-line presence (`grep -Fx`) + uniqueness (`grep -c "^model:"` = 1) per file; frontmatter parse + `model` equality (`python3` + `yaml.safe_load`); diff scope vs. build-start baseline (`git diff`/`git show` — exactly 4 insertions/4 deletions, all on `model:` lines); completeness search (no other live config defines models; `opencode.jsonc` unchanged); catalog cross-check (each `model#variant` present in § Catalog basis; live re-query when tooling allows).
- **Rollout signal (honest limitation):** spawn success cannot be pre-verified from the files alone; the first post-change spawn — this feature's code reviewer, on `opencode-go/qwen3.7-plus#max` — exercises the new configuration end-to-end. A configuration failure there is the detection mechanism, with per-file one-line revert.
- **Real-time and containerization impact — explicitly none:** the feature adds no shared/cross-client state, no connection behavior, no services, images, ports, environment configuration, or deployables; the repo's container assets and the WebSocket runtime are untouched.
- **Reviewer re-verification:** all of the above rerun independently at the code gate; the live catalog re-query is an enrichment, not the AC basis (the files + recorded catalog are).

## Open questions

- **Q-1 — Orchestrator effort: `low` (recommended) vs `high`.** The spec pins `#low` (mechanical, latency-sensitive, highest call count). If the user prefers the conservative status-quo effort, `#high` is a one-line change; the first sessions after rollout will show whether routing/bookkeeping quality holds.
- **Q-2 — Free models not used.** minimax-m3.1-flash-free / beam-free / longcat-2.5-preview-free are excluded (rate-limit/availability risk; gates must be dependable). If the user wants a cost-zero trial for a role later, that is a follow-up one-line tuning.
- **Q-3 — Catalog fidelity.** Prices/ids/variants recorded 2026-10-19 from the live models tool. If any target id or variant is absent or renamed at build time, the builder reports `blocked` and a spec revision re-pins — no improvisation. The reviewer re-queries live where tooling allows.
- **Q-4 — Reviewer upgrade vs continuity.** Recommended: `qwen3.7-plus#max` (above the builder it most directly gates; independent family — independence chosen over price tier versus the planner). If the user prefers minimal change, `glm-5.3-flash#max` (the current family and tier, $0.15/$0.50) is the recorded fallback, one line (plan D-4).
- **Q-5 — Trial review.** Suggest revisiting the tuning after the next feature completes end-to-end (all four agents exercised): a follow-up one-line-per-agent tuning if any role behaved below expectations. User-owned process question.

## Assumptions

- OpenCode Go entitlement/availability in the user's environment (explicitly requested); first-spawn validation as described.
- **Capability proxy:** with no benchmark data available to the pipeline, price/position tier plus family continuity is the basis for "adequate": orchestrator/builder keep their proven model class (paid equivalents); planner/reviewer are placed one tier up. This weak evidence is flagged here rather than hidden (Q-5 revisits it after a trial).
- The `#variant` suffix is safe YAML: `#` not preceded by whitespace is not a comment, and all four current lines already use this exact syntax (proven in use; the parse check still runs).
- PyYAML is available at build time (precedent: `online-realtime-workflow/build-log-T0.md` § 4 ran `python3` + `yaml.safe_load` successfully). If it is ever missing, the builder records the structural fallback (grep uniqueness + shape regex) and flags it — not expected.
- Config changes take effect for future sessions/subagent spawns only; the in-flight `cube-game-frontend` feature is unaffected except that its future spawns run under the new (equal-or-better) builder class.
- Repo-scoped change set: any global/user-level OpenCode configuration is outside this repository's scope and is untouched.
- The builder's existing `edit` allow for `.opencode/agents/*.md` (and each other role's allows) makes this feature implementable with no permission changes.

## Revision history

- r1 — 2026-10-19 — initial draft.
- r2 — 2026-10-19 — spec-r1 fixes (`reviews/spec-r1.md`); no mapping, price, catalog, or scope changes. **F1** fixed: approval provenance — no checkpoint approval is claimed anywhere; the mapping is "proposed at the approval checkpoint" and the build starts only after the `awaiting_approval` decision is recorded (Summary, § Model mapping, § Feasibility, § Security considerations; plan.md § Risks "Spend decision ownership" aligned). **F2** fixed: reviewer percentage claim recomputed against the same $4/$20 referent as the planner paragraph (10%/8%); plan.md D-3/D-4 aligned. **F3** fixed: reviewer tier claim narrowed — above the builder it most directly gates; family independence from the DeepSeek planner/builder by design (spec § Model mapping, Q-4; plan.md D-4). **F4** fixed: T1 records the pre-feature baseline commit (`git rev-parse HEAD`); AC-6 and T2 anchor "diff vs. pre-feature" checks on that recorded ref. **F5** fixed: AC-9 carve-out — the acceptance-time `docs/features/README.md` row is orchestrator-owned, post-code-gate, outside build-commit evidence.
