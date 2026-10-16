---
feature: online-realtime-workflow
revision: 3.1
---
# Plan — Online & Real-Time Workflow Alignment

## Architecture (documentation "system")

No runtime architecture: static text changes only — no code, data flow, dependencies, or persisted state. The "documentary architecture" has three layers, all read by future agent sessions:

1. **Project-level truth** — `AGENTS.md` (read by every agent session; nature statement + WebSocket constraint) and `docs/architecture/stack.md` (hard capability constraint for the stack-selection task). Stack remains NOT DECIDED; WebSocket is a protocol/architecture requirement only.
2. **Product direction** — `docs/product/vision.md` (north star; One-liner gains "online, real-time" + one link line) and `docs/product/realtime-backlog.md` (NEW; provisional candidates, "direction, not commitments").
3. **Workflow rules by role** — one targeted rule per agent instruction file, with the detail in the relevant skill:
   - `orchestrator.md` → routing/checkpoint awareness + framework autonomy (2026-10-16 directive).
   - `planner.md` + `spec-authoring/references/spec-checklist.md` → spec-time real-time considerations.
   - `builder.md` + `web-implementation/SKILL.md` + `references/engineering-principles.md` → implementation rules.
   - `reviewer.md` + `spec-review/SKILL.md` + `code-review/checklists/{quality,security,testing}.md` → gate-time checks.

**Data flow (future sessions):** agent reads `AGENTS.md` → sees online/real-time nature and the WebSocket constraint → planner reads `vision.md`/`realtime-backlog.md` → specs touching shared/cross-client state address lifecycle/reconnection/multi-client/server-authority → builder follows web-implementation real-time rules → reviewer applies the checklist real-time items at both gates.

**Vocabulary pin (consistency):** "online", "real-time", "WebSocket" (protocol), "server-authoritative"; no library/framework/runtime/vendor names anywhere.

## Pinned content contracts (per file)

Baseline rule (all files): baseline = file content at that task's build start, captured in `build-log-T<id>.md` (`git show HEAD:<path>` excerpt or verbatim copy); this build-start capture **governs** over any plan-time quote (D-10). For `builder.md` (two phases), each phase records its own baseline: T0 at T0 build start; T4 at T4 build start, after T0 has landed. Verification: `git diff` vs. that baseline plus the greps named in the ACs. For `vision.md`, T2 re-verifies the plan-time quote in item 4 below against the build-start content byte-for-byte and records equivalence or divergence in `build-log-T2.md`. Wording may vary slightly if the required tokens/concepts hold; substance is pinned.

### 1. `AGENTS.md` (edit, T1)
- **A — intro:** the sentence "CubeClicker is a web-based clicker game." becomes an online/real-time/multi-client descriptor (must contain "online" and "real-time"), and the intro adds one sentence stating clients are expected to see each other's live activity (live stats, other users' clicks, connected users). **Arrangement pinned:** keep the intro as one paragraph line — the live-activity sentence stays inline with the reworded opener, exactly as in **Suggested A** (one modified line total; the diff shape must match the file inventory row: +1 modified line, +1 bullet).
- **B — § Stack:** add a bullet after the existing NOT DECIDED bullet: the backend must be WebSocket-compatible and the frontend must connect to the backend over WebSocket; this is a protocol-level constraint that implies no framework/library/runtime. Existing NOT DECIDED text unchanged.
- Suggested A: `CubeClicker is a web-based, online, real-time, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users). This project is AI-native: …`
- Suggested B: `- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.`

### 2. `docs/architecture/stack.md` (edit, T1)
- **Placement:** new `## Hard constraints (all candidates)` section between the "Until this file is filled in" bullet list and the "When decided…" paragraph.
- **Required content:** (a) any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend (tokens "WebSocket server", "WebSocket client"); (b) rationale — the game is online/real-time with cross-client visibility; (c) it is a protocol/architecture requirement that makes no technology choice and the stack remains NOT DECIDED (existing `Status: NOT DECIDED` retained).
- Suggested: bullets as above plus `This section constrains capability only; it names no technology and the stack remains NOT DECIDED until the stack-selection task decides it.`

### 3. `docs/product/realtime-backlog.md` (NEW, T2)
- Structure: H1; blockquote stating "Provisional direction — **not commitments**"; short "why this file exists"; `## Candidates from the request` (live statistics; other users' clicks; connected users — one line each; a note that the request's "etc." stays open); `## Proposed additions (unconfirmed — not requested, not committed)` with up to three one-liners (global live counter; live leaderboard; community milestones); `## Open tensions` (identity vs. "no accounts required" — mentions "accounts"; server authority one-liner); closing non-commitment rule (items become real only via normal feature requests; the user owns this list). **Section set is closed:** exactly these four headings (H1 title + the three `##` sections); the blockquote, the one-line "why" paragraph, and the closing non-commitment rule are the only block elements otherwise — no other sections (AC-8 is inspected against this set).
- No implementation planning, no stack/library names (the word "WebSocket" is allowed as protocol context only).

### 4. `docs/product/vision.md` (edit, T2)
- **A — One-liner modified (only modified line):** `A web-based, online, real-time clicker game built and maintained by an AI-native development team.` (insertion of "online, real-time"; tokens "online", "real-time").
- **B — exactly one added line**, immediately after the One-liner paragraph: `> **Direction:** candidate online/real-time features are tracked provisionally in [realtime-backlog.md](realtime-backlog.md) — direction, not commitments.`
- **Vision baseline (verbatim, captured 2026-10-16 — plan-time; build-start content governs per the baseline rule, and T2 re-verifies this quote byte-for-byte against the build-start content, recording the result in `build-log-T2.md`):**

```markdown
# CubeClicker — Product Vision

> Living document. The user owns the vision; agents read it as the north star. Updates flow through feature requests.

## One-liner

A web-based clicker game built and maintained by an AI-native development team.

## Core loop

Click a cube → earn points → spend points on upgrades → earn faster → repeat. (Details will be refined by the first product-spec feature.)

## Principles

- **Instant fun:** playable within seconds of loading; no friction, no accounts required.
- **Idle-friendly:** progress accrues while away (offline progress), so returning players feel rewarded.
- **Persistence:** safe local saves with versioned migration; corrupted saves never crash the game.
- **Accessible & responsive:** keyboard operable, mobile-friendly, respects reduced motion.
- **Performance:** 60 fps interactions, small bundle, instant load.

## Status

Product details are intentionally high-level. The stack-selection task and the first feature (core click loop) will flesh these out through the agent workflow.
```

### 5. `.opencode/agents/orchestrator.md` (edit, T3)
- Add to **Iron rules** one bullet (token "real-time"): online/real-time awareness — when a feature touches shared or cross-client state, surface its real-time questions (identity vs. no-accounts, server authority, connection behavior) in the `awaiting_approval` summary; reference `AGENTS.md` and `docs/architecture/stack.md`.
- Add to **Iron rules** one bullet (token "autonomous" or "autonomy"; include the date "2026-10-16"): framework autonomy — mechanical bootstrap and workflow-file operations are performed by the pipeline under reviewer oversight; the user is approached only for genuine blockers or materially user-owned decisions (per the user directive of 2026-10-16, quoted in spec.md § Open questions Q-1).

### 6. `.opencode/agents/planner.md` (edit, T3)
- Add to **Rules** one bullet (token "real-time"; concepts: connection lifecycle, reconnection, multi-client behavior, server authority; identity conflicts flagged; assumes no stack beyond the WebSocket protocol requirement).

### 7. `.opencode/skills/spec-authoring/references/spec-checklist.md` (edit, T3)
- Add a new section `## Real-time (when the feature touches shared/cross-client state)` with two checkboxes: (1) connection lifecycle, reconnection, multi-client behavior, and server authority addressed or explicitly out of scope; (2) identity/"no accounts" conflicts flagged as open questions.

### 8. `.opencode/agents/builder.md` (two stages: T0 permissions → T4 prose)
- **T0 — permission bootstrap (strictly first; detail in tasks.md T0):** add exactly five `edit` allow entries — `AGENTS.md`, `docs/architecture/**`, `docs/product/**`, `.opencode/agents/*.md`, `.opencode/skills/**` — after the existing `index.html` allow block, via an anchored, idempotent `python3` heredoc (shell write); no other permission content changes. T0's baseline = `builder.md` at T0 build start; T0 commits `chore:`. T0's verification adds a structural assertion (`python3` + `yaml.safe_load`: the frontmatter parses and every `permissions:` item has `action`, `resource`, and `effect` keys), recorded in `build-log-T0.md`.
- **T4 — prose rule (after T0):** add to **Rules** one bullet (token "real-time"): shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules. T4's baseline = `builder.md` at T4 build start (post-T0); T4 touches no permission entry.

### 9. `.opencode/skills/web-implementation/SKILL.md` (edit, T4)
- Add one bullet to **Architecture rules** (summary + pointer, consistent with the existing summary/depth pattern): real-time (WebSocket) — one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (client never trusts reported values); teardown closes connections and removes handlers; depth in `references/engineering-principles.md` § Real-time principles.

### 10. `.opencode/skills/web-implementation/references/engineering-principles.md` (edit, T4)
- Add section `## Real-time (WebSocket) principles` with bullets: single connection owner (UI observes status, never opens its own socket); lifecycle & reconnection (bounded retries, state resync after reconnect, idempotent handlers — no duplicates across reconnects); server authority (shared/global values come from the server; optimistic UI must reconcile; never trust client-reported values as truth); untrusted inbound data (validate shape/type, ignore unknown; render untrusted text via `textContent`, never `innerHTML`); graceful degradation (connection loss visible and non-fatal, local play/saves unaffected); testability (connection logic injectable/fakeable — no real network needed in tests).

### 11. `.opencode/skills/spec-review/SKILL.md` (edit, T5)
- Append to the **Checklist** list one item: **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.

### 12. `.opencode/agents/reviewer.md` (edit, T5)
- Add to **Rules** one bullet (token "real-time"): for features touching shared/cross-client state, verify connection lifecycle, reconnection, multi-client behavior, and server-authoritative shared state against the skills' real-time checks; unverifiable real-time behavior counts as unmet.

### 13. `.opencode/skills/code-review/checklists/quality.md` (edit, T5)
- Add section `## Real-time (if the feature uses the connection)`: one owner for connection lifecycle / no duplicate handlers after reconnect / teardown; bounded reconnection with state resync; multi-client behavior consistent (or single-client scope explicit in the spec); shared/global values server-authoritative (**✅/❌/n/a** style, same as the file's conventions).

### 14. `.opencode/skills/code-review/checklists/security.md` (edit, T5)
- Add section `## Real-time & untrusted messages (if applicable)`: inbound WebSocket messages untrusted (shape-validated, unknown types ignored, untrusted text rendered via `textContent`, never `innerHTML`); no secrets/tokens in client code or messages; secure transport / no mixed content on https; shared state never derived from unvalidated client-reported values.

### 15. `.opencode/skills/code-review/checklists/testing.md` (edit, T5)
- Add section `## Real-time coverage (if applicable)`: multi-client behavior has at least one test (two clients observe the same shared state); reconnect/close paths tested via simulated connection events (no real network), resync covered; malformed/unknown inbound messages handled in tests.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `AGENTS.md` | Edit (+1 modified line, +1 bullet) | Nature statement + WebSocket constraint | T1 |
| `docs/architecture/stack.md` | Edit (+1 section) | Hard WebSocket capability constraint; NOT DECIDED retained | T1 |
| `docs/product/realtime-backlog.md` | New | Provisional real-time candidate backlog (not commitments) | T2 |
| `docs/product/vision.md` | Edit (+1 modified line, +1 added line) | One-liner online/real-time + backlog link | T2 |
| `.opencode/agents/orchestrator.md` | Edit (+1 rule) | Checkpoint/route real-time awareness | T3 |
| `.opencode/agents/planner.md` | Edit (+1 rule) | Spec-time real-time considerations | T3 |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` | Edit (+1 section) | Spec-gate real-time item | T3 |
| `.opencode/agents/builder.md` | Edit (T0: +5 permission entries; T4: +1 rule) | Permission bootstrap (T0); server-authoritative/shared-state rule (T4) | T0, T4 |
| `.opencode/skills/web-implementation/SKILL.md` | Edit (+1 rule) | Real-time implementation rule (summary) | T4 |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | Edit (+1 section) | Real-time engineering depth | T4 |
| `.opencode/agents/reviewer.md` | Edit (+1 rule) | Real-time verification obligation | T5 |
| `.opencode/skills/spec-review/SKILL.md` | Edit (+1 item) | Spec-gate real-time check | T5 |
| `.opencode/skills/code-review/checklists/quality.md` | Edit (+1 section) | Code-gate real-time quality checks | T5 |
| `.opencode/skills/code-review/checklists/security.md` | Edit (+1 section) | Code-gate real-time security checks | T5 |
| `.opencode/skills/code-review/checklists/testing.md` | Edit (+1 section) | Code-gate real-time test coverage checks | T5 |
| `docs/features/online-realtime-workflow/build-log-T0.md` … `-T6.md` | New | Per-task evidence (baseline, diff, greps, AC audit) | T0…T6 |

Planner artifacts (`spec.md`, `plan.md`, `tasks.md`) and review verdicts (`reviews/**`) are written per the workflow by the planner/reviewer, not by build tasks. `.opencode/agents/builder.md` is the only file with two task phases: T0's permission entries, then T4's prose (strict order; T0's committed state is T4's baseline).

## Files intentionally unchanged

| Path | Why no change |
| --- | --- |
| `.opencode/commands/feature.md` | Pure routing into the orchestrator; no realtime content belongs here. |
| `.opencode/skills/orchestration-playbook/SKILL.md` + templates | Generic state machine/brief mechanics; the one orchestrator rule lives in its agent file; no protocol-level workflow change needed. |
| `.opencode/skills/task-decomposition/SKILL.md` + template | DAG/sizing/file-ownership mechanics are orthogonal to realtime; realtime work decomposes as ordinary tasks. |
| `.opencode/skills/spec-authoring/SKILL.md` + `templates/spec.md`, `templates/plan.md` | Workflow unchanged; the run-before-reporting realtime gate lives in its checklist (single update point); no new mandatory template section (avoids "n/a noise" — conditional requirements are enforced via the checklist). |
| `.opencode/skills/spec-review/templates/review.md`, `.opencode/skills/code-review/templates/review.md`, `.opencode/skills/code-review/SKILL.md` | Findings/verdict formats and the checklist-running workflow are generic; realtime items surface as ordinary findings via the updated checklists. |
| `docs/features/README.md`, `docs/features/**/status.md`, `tasks.md` | Orchestrator-owned process bookkeeping, updated by the orchestrator per the playbook. |
| `src/**`, `tests/**`, `public/**`, config files | No application code/tooling in this feature (stack NOT DECIDED). |
| Any `permissions:` block in `.opencode/agents/*.md` other than `builder.md`'s T0 bootstrap | Never edited by tasks (AC-24); the only permission change anywhere is T0's sanctioned five-entry addition in `builder.md`. |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | WebSocket captured as a protocol/architecture hard constraint only; stack stays NOT DECIDED | Constraint says no technology choices; the request says the backend "should be compatible with websocket", not which tech | Naming candidate stacks — rejected (forbidden until stack selection) |
| D-2 | Project nature lands in `AGENTS.md` intro + `stack.md` hard constraints + vision One-liner | AGENTS.md is read every session; stack.md binds the future stack-selection; vision is the north star | A new "project brief" doc — rejected: split sources, no discovery |
| D-3 | Backlog in a new `docs/product/realtime-backlog.md` (not a vision section) | Keeps user-owned north star lean; backlog is provisional and user-maintained; linked from vision | Vision section — rejected: mixes direction into the north star; also `docs/features/` — wrong (not a feature) |
| D-4 | Vision edits minimal and pinned: one modified One-liner line + one added link line (Q-2) | Reflects "This game will be an online game" without touching user-owned prose further; baseline captured so review can prove non-destructiveness | Leave vision fully untouched — fallback if Q-2 declined (pointer moves to AGENTS.md) |
| D-5 | Role-based distribution: agent files carry one obligation each; skills carry the detailed checks | Matches existing summary/depth pattern; no duplication, minimal bloat | Duplicating full rules in agent files — rejected |
| D-6 | Reviewer checks split: spec gate (spec-review + spec-authoring checklist) vs code gate (quality/security/testing) | Each gate checks what it can see: specs → considerations; code → lifecycle/multi-client/security/tests | One combined realtime checklist — rejected: wrong gate ownership |
| D-7 | T3/T4/T5 form one `[P]` batch after T1 | Pairwise disjoint `files_owned`, no shared files, single earlier dependency; saves build time | Fully sequential — safe but slower; batching is the documented playbook pattern |
| D-8 | Backlog proposals (global counter, leaderboard, community milestones) marked "unconfirmed — not requested" (Q-3) | Honors the request's "other features … awesome to have" without inventing commitments; user can delete | Omit proposals — thinner doc; keeps "etc." fully open (either acceptable; Q-3 resolves) |
| D-9 | Tasks touch `permissions:` blocks only via T0's sanctioned bootstrap (AC-24); T0 applies the five-entry widen via shell, user-authorized (2026-10-16 directive) | Privilege-escalation hazard — an agent widening its own permissions is acceptable only as an explicit, bounded, user-authorized bootstrap: one task, five pinned entries, reviewer diff inspection at the code gate, git-revertible, no push | User-applied widening (former A/A-hybrid) and manual drafting (former B) — superseded by the directive; builder self-widen — previously rejected outright, now authorized under the listed controls |
| D-10 | Baselines captured at build start per task (stored in build logs); AC-25 checks diffs vs. those baselines | Repo state may move; plan-time quotes would go stale | Pinning all baselines at plan time — rejected as brittle |

## Risks & mitigations

- **Permission bootstrap is agent-applied (Q-1, r3)** → T0 runs first via the builder's already-allowed shell path; T1–T6 are gated on T0's commit landing and on the orchestrator's pre-T1 check of T0's recorded verify evidence in `build-log-T0.md` (grep anchors, idempotency output, structural assertion) against the pinned five entries. Controls: T0 is the only sanctioned permission change (AC-24); the reviewer inspects T0's diff at the code gate; git-revertible; no push; no user action required.
- **Self-edit hazard** (T0 grants the builder `edit` access to `.opencode/agents/*.md` — all four agent files, including its own permission block; it already has shell write paths today) → explicit user authorization (2026-10-16 directive), T0-only scope (exactly five entries), reviewer diff inspection, revertibility, AC-24 forbidding any other permission edit; the widen persists beyond this feature unless the user re-narrows after acceptance.
- **Instruction bloat** → per-file additions capped (agent files ≤ ~3 lines each; skill sections ≤ 6 bullets); unchanged-files list documents deliberate omissions; no duplication between agent files and skills.
- **Vision edits declined (Q-2)** → fallback: move the backlog pointer into `AGENTS.md`; drop AC-11/AC-12 via a small future spec revision (r3 or later).
- **Wording drift vs. pinned contracts** → AC tokens + concepts; reviewer inspects diffs against contracts.
- **Parallel batch hazards** → disjoint files verified (D-7); no shared files; playbook caps batches at 3; if in doubt the orchestrator downgrades to sequential.
- **"etc." scope creep** → Q-4; backlog is explicitly non-committal; proposals marked unconfirmed.
- **Accounts/identity tension** → flagged only (Q-6, backlog "Open tensions"); never resolved unilaterally.
- **Stale baselines** → captured at build start (D-10); build logs record `git show HEAD:<path>` excerpts.
- **Verification without commands** → inspection + grep anchors; reviewer re-runs greps and diff inspection; "unable to verify" counts as unmet, as usual.

## Open questions

- **Q-1 — resolved (r3, user directive 2026-10-16)** — apply route for the 15 targets: agent-applied bootstrap. **T0** (builder, shell write) adds the five `edit` allow entries (`AGENTS.md`, `docs/architecture/**`, `docs/product/**`, `.opencode/agents/*.md`, `.opencode/skills/**`) to `.opencode/agents/builder.md`; former user-applied options (A, A-hybrid, B, C) are superseded — the user will not hand-apply edits (directive: "I don't want you to ask for all. Please, update framework to work autonomsly without user's request. If needed because it's a blocker, ask user"). Controls: T0 is the only sanctioned permission change (AC-24); the reviewer inspects T0's diff at the code gate; git-revertible; no push. `building` starts with T0; no user action gates it.
- **Q-2** — confirm the two minimal `vision.md` edits; alternative: leave untouched (fallback route documented).
- **Q-3** — confirm or remove the three unconfirmed backlog proposals.
- **Q-4** — "etc.": user adds further candidates at will.
- **Q-5** — future synchronous gameplay vs. shared visibility only (product-direction question; not scoped here).
- **Q-6** — identity vs. "no accounts required" — flagged for resolution before any presence/attribution feature is scoped.
- **Q-7** — stack-dependent decisions: none made; the WebSocket capability constraint is protocol-level and binding for the future stack-selection task.
