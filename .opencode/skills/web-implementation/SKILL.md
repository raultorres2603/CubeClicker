---
name: Web Implementation
description: Use when implementing a CubeClicker task as the builder — coding standards, architecture rules, definition of done, verification, and evidence requirements.
---

# Web Implementation

You implement exactly one task (or a small parallel-safe batch) per invocation, in the project's agreed stack. `AGENTS.md` and `docs/architecture/stack.md` are the law; if the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.

## Workflow

1. Read the brief fully; then read `spec.md`, `plan.md`, `tasks.md` and your task section; then `docs/architecture/stack.md` and `AGENTS.md`; then the files you will touch, before changing them.
2. Sketch the change in at most 5 lines inside `build-log-<taskid>.md`, then implement.
3. Implement in small steps: pure logic first, then integration/UI. Keep diffs focused on the task's `files_owned`.
4. Write or adjust tests as you go — every behavior change gets a test, or an explicit reason why not (e.g., purely visual).
5. Run the task's `verify` commands. Fix failures before reporting.
6. Self-audit: walk each `acceptance` AC and record met/unmet with evidence.
7. Finish `build-log-<taskid>.md`, then commit with a conventional message (`feat:` / `fix:` / `test:` / `chore:`). NEVER `git push`.
8. Return the Subagent Report.

## Architecture rules (apply pragmatically — depth in `references/engineering-principles.md`)

- Game logic is pure and framework-free: functions over explicit state in `src/core/` (or the stack's equivalent). No DOM or timers inside pure logic — time and randomness come in as parameters.
- Rendering/UI subscribes to state; it does not own it. Single source of truth for game state.
- One place owns `requestAnimationFrame`/interval usage; clean up on teardown. No leaks.
- Persistence: versioned save schema plus a migration function; validate on load; a corrupt save must never crash the game.
- DRY without premature abstraction: extract on the third repetition, not the first. KISS: prefer the boring solution. YAGNI: build what the task asks, nothing speculative.
- `textContent`, never `innerHTML`, for user-controlled strings. No `eval`, no remote code.
- Accessibility baseline: keyboard operable, visible focus, semantic elements, text contrast ≥ 4.5:1.
- Performance: interactions target 60 fps; justify bundle additions; no per-frame allocations in hot loops.

## Definition of Done

- [ ] Task's acceptance criteria met with evidence
- [ ] `verify` commands pass (lint, typecheck, tests, build — as applicable)
- [ ] Tests added/updated for behavior changes
- [ ] `build-log-<taskid>.md` written with raw evidence
- [ ] Committed on the feature branch with a conventional message
- [ ] No out-of-scope edits (`files_owned` respected)

## When blocked

Do NOT improvise scope, architecture, or dependencies. Report `blocked` with: the exact question, why the spec/plan is insufficient, and 1–2 candidate answers you could proceed with if approved.

## build-log template

```
# Build log — T<id> — <title>
Task: T<id> (<date>)
Files changed: <paths>
What changed & why: <≤5 lines>
Decisions: <notable choices>
Evidence:
- `<verify cmd>` → <result summary>
Acceptance audit: AC-x → met (evidence) | unmet (why)
Deviations from spec: none | <what + why>
```
