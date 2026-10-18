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
4. Write unit **and** integration tests as you go (see § Testing bar; a documented exception is required when a change has no integration boundary), and make the coverage gate part of your run: `npm run coverage` enforces thresholds ≥ 80% statements/branches/functions/lines per workspace — a shortfall blocks reporting.
5. Run the task's `verify` commands. Fix failures before reporting.
6. Self-audit: walk each `acceptance` AC and record met/unmet with evidence.
7. Finish `build-log-<taskid>.md`, then commit with a conventional message (`feat:` / `fix:` / `test:` / `chore:`). NEVER `git push`.
8. Return the Subagent Report.

## Architecture rules (apply pragmatically — depth in `references/engineering-principles.md`)

- Game logic is pure and framework-free: functions over explicit state in `src/core/` (or the stack's equivalent). No DOM or timers inside pure logic — time and randomness come in as parameters.
- Rendering/UI subscribes to state; it does not own it. Single source of truth for game state.
- One place owns `requestAnimationFrame`/interval usage; clean up on teardown. No leaks.
- Real-time (WebSocket): one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (the client never trusts reported values); teardown closes connections and removes handlers. Depth in `references/engineering-principles.md` § Real-time principles.
- Containerized delivery (`docs/architecture/containerization.md`): one image per deployable; `podman compose up`-style single-command local dev; runtime config via environment variables (never secrets in images); a health signal per service; backend WebSocket endpoint exposed; provider-neutral images. Container assets and conventions are pinned in the repository (`compose.yaml`, `src/*/Dockerfile`; `docs/architecture/containerization.md`). Depth in `references/engineering-principles.md` § Containerization principles.
- Persistence: versioned save schema plus a migration function; validate on load; a corrupt save must never crash the game.
- DRY without premature abstraction: extract on the third repetition, not the first. KISS: prefer the boring solution. YAGNI: build what the task asks, nothing speculative.
- `textContent`, never `innerHTML`, for user-controlled strings. No `eval`, no remote code.
- Accessibility baseline: keyboard operable, visible focus, semantic elements, text contrast ≥ 4.5:1.
- Performance: interactions target 60 fps; justify bundle additions; no per-frame allocations in hot loops.

## Testing bar

This bar is binding for every task; depth (rationale, examples, reconciliation with the real-time rules) lives in `references/engineering-principles.md` § Testing principles.

- **Two tiers.** *Unit* exercises one module in isolation with its dependencies injected (clock, randomness, factories) — no I/O, no framework. *Integration* exercises modules through a real boundary: a route or WebSocket over a real in-process socket, a component render, or the server↔client wire. *Containerized smoke* (`npm run smoke`) is the cross-service e2e tier. Every behavior change ships **both** tiers; a change with no integration boundary needs a documented exception in the build log.
- **Concrete assertions only.** Banned matcher forms: `expect.anything()`, `expect.any(Constructor)`, `objectContaining`/`arrayContaining`/`stringContaining`/`stringMatching`, loose `toMatchObject` as a stand-in for pinning the full expected value, argument-unchecked `toHaveBeenCalled()`, snapshot-only assertions, assertion-free tests, and weak existentials used as stand-ins for a concrete value (`toBeTruthy()`/`toBeDefined()`/`not.toThrow()` where an exact value can be asserted). Assert the real value: exact strings, exact numbers, exact envelopes, `toHaveBeenCalledWith(…)`.
- **Bounded exception.** An exception is allowed only when no exact-value assertion is possible (e.g., one `expect.closeTo()` on float math): **≤ 1 per task**, justified by an in-test comment naming the concrete unavoidability reason, and reviewer-approved. It is recorded in the review artifact.
- **Determinism before weakening.** Flakiness is fixed by controlling time and randomness — fake timers (`vi.useFakeTimers`), injected clocks/ids/factories, awaited in-process sockets — never by loosening an assertion into a wildcard or existential.
- **No useless tests.** Every added test must be able to fail on a real regression ("what change would break it?"). No tautologies (re-asserting values configured on the test's own mocks), no coverage-chasing tests, no assertions on implementation details instead of behavior/outcomes.
- **Coverage metric.** `npm run coverage` runs Vitest's V8 provider per workspace with thresholds of **80** on statements, branches, functions, and lines (aggregate per workspace). All-files semantics: un-imported production files count. Only the justified exclusions pinned in the workspace Vitest configs (test patterns + the one composition-root entrypoint per workspace) are allowed; never exclude production code or lower a threshold to pass the gate. Raw command output goes in `build-log-<taskid>.md`.
- **Retroactivity.** The bar applies to new and changed test content; pre-existing tests are not retro-refactored to satisfy it.

## Definition of Done

- [ ] Task's acceptance criteria met with evidence
- [ ] `verify` commands pass (lint, typecheck, tests, build — as applicable)
- [ ] Unit tests and integration tests added/updated for behavior changes (documented exception when no integration boundary exists)
- [ ] Coverage gate green: `npm run coverage` passes (≥ 80% statements/branches/functions/lines per workspace) with raw output in the build log
- [ ] Assertions use concrete expected values; no banned wildcard matchers without the bounded exception rule (≤ 1 per task, in-test-justified unavoidability reason, reviewer-approved)
- [ ] No useless tests: each added test can fail on a real regression (no tautologies, no coverage-chasing)
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
