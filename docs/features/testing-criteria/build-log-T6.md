# Build log — T6 — Builder-facing guidance: agent rule + web-implementation skill

Task: T6 (2026-10-18)
Files changed: `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `docs/features/testing-criteria/build-log-T6.md`

What changed & why (≤5 lines):
- `builder.md` (contract 8.A, addition): one Rules bullet — behavior changes ship unit **and** integration tests; concrete expected data only, with the `ItIsAny`-equivalents banned-matcher list and no useless tests; the `npm run coverage` gate (≥ 80 × four metrics per workspace) is verify evidence.
- `SKILL.md` (contract 12.A, replacement of workflow step 4): unit + integration tests with a documented exception when no integration boundary exists, plus the coverage gate in the run; a shortfall blocks reporting.
- `SKILL.md` (contract 12.B, one DoD item replaced + three items added): unit + integration tests; coverage gate green with raw output; concrete assertions / bounded exception; no useless tests.
- `SKILL.md` (contract 12.C, addition): new `## Testing bar` section — two tiers, banned-matcher list (incl. weak-existential stand-ins), bounded exception (≤ 1/task), determinism, no-useless-tests bar, coverage metric, retroactivity, depth pointer.
- `engineering-principles.md` (contract 13.A, addition): new `## Testing principles` section — repo-boundary tiers (unit / integration incl. real in-process socket + component render / containerized smoke as cross-service e2e), concrete-assertion rule + banned list, determinism (fake timers, injected clocks/ids/factories), exception rule, no-useless-tests bar, coverage policy (all-files, justified exclusions only, no number-gaming, aggregate-not-per-file note), spy/mock discipline incl. the sanctioned `vi.stubGlobal` fake-WebSocket pattern for ambient defaults.

Decisions:
- Wording follows the pinned substance of contracts 8.A/12.A/12.B/12.C/13.A; no contract ID is printed inside the agent/skill prose (it is traced here and in the diff instead).
- Section placement: `## Testing bar` sits immediately before `## Definition of Done` (12.C "before Definition of Done"); `## Testing principles` sits immediately before `## Real-time (WebSocket) principles` so the sanctioned stub-global pattern reads next to the real-time testability rule it reconciles with.
- Only contracts 12.A and 12.B are in-place replacements; everything else (8.A, 12.C, 13.A, the three added DoD items) is additive — proven by the deleted-line list below.
- This task is documentation-only (no runtime behavior change, no test boundary): per the new bar's own documented-exception path, no unit/integration tests are added for it. The task's pinned verify is the greps + baseline diff; `npm run lint` and `npm run typecheck` were run as supplementary sanity and pass.

## Build-start baselines (content at build start)

Working tree == HEAD for all three files at build start (no `M` entries in `git status --short` for them).

```
$ git rev-parse HEAD:.opencode/agents/builder.md
f36b3a97dd9a13ad01031012b975ddd24128ceaa
$ git rev-parse HEAD:.opencode/skills/web-implementation/SKILL.md
9f30bebc0e58d4bde7108813724f0b9f140dcdec
$ git rev-parse HEAD:.opencode/skills/web-implementation/references/engineering-principles.md
9aac4e9e3c87b1c9914f8d17156162bedbd1f1df

$ sha256sum (build-start working-tree copies)
d6c4de710c2211389aaf8004fde9d2267a8f6405df2e696ccd9d3bd329497865  .opencode/agents/builder.md
e2db893f2b828c1f64ff3887af8f0530f88b95fa71bd13e209cf6755c8313e8f  .opencode/skills/web-implementation/SKILL.md
c88488c87e2fb7ee3f5b9f2599439079d74257f1aceb8375f62a7a795edbb097  .opencode/skills/web-implementation/references/engineering-principles.md
```

Baseline excerpts (unchanged regions that the replacements touch):

```
$ git show HEAD:.opencode/skills/web-implementation/SKILL.md | sed -n '15p'
4. Write or adjust tests as you go — every behavior change gets a test, or an explicit reason why not (e.g., purely visual).

$ git show HEAD:.opencode/skills/web-implementation/SKILL.md | sed -n '38p'
- [ ] Tests added/updated for behavior changes
```

`HEAD` at build start: `8e5eb33` (branch `main`).

## Evidence

### T6 verify — `grep -in "coverage"` across the three files

```
$ grep -in "coverage" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md
.opencode/agents/builder.md:115:- Testing bar: every behavior change ships with unit tests **and** integration tests (tiers per the `web-implementation` skill's § Testing bar); assertions use concrete expected data — banned matchers are the `ItIsAny`-equivalents (`expect.anything()`/`expect.any()`, `objectContaining`/`arrayContaining`/`stringContaining`, loose `toMatchObject`, argument-unchecked `toHaveBeenCalled()`, snapshot-only, weak existentials used as stand-ins), and there are no useless tests; the coverage gate (`npm run coverage`, thresholds ≥ 80 statements/branches/functions/lines per workspace) is part of the task's verify evidence.
.opencode/skills/web-implementation/SKILL.md:15:4. Write unit **and** integration tests as you go (see § Testing bar; a documented exception is required when a change has no integration boundary), and make the coverage gate part of your run: `npm run coverage` enforces thresholds ≥ 80% statements/branches/functions/lines per workspace — a shortfall blocks reporting.
.opencode/skills/web-implementation/SKILL.md:42:- **No useless tests.** Every added test must be able to fail on a real regression ("what change would break it?"). No tautologies (re-asserting values configured on the test's own mocks), no coverage-chasing tests, no assertions on implementation details instead of behavior/outcomes.
.opencode/skills/web-implementation/SKILL.md:43:- **Coverage metric.** `npm run coverage` runs Vitest's V8 provider per workspace with thresholds of **80** on statements, branches, functions, and lines (aggregate per workspace). All-files semantics: un-imported production files count. Only the justified exclusions pinned in the workspace Vitest configs (test patterns + the one composition-root entrypoint per workspace) are allowed; never exclude production code or lower a threshold to pass the gate. Raw command output goes in `build-log-<taskid>.md`.
.opencode/skills/web-implementation/SKILL.md:51:- [ ] Coverage gate green: `npm run coverage` passes (≥ 80% statements/branches/functions/lines per workspace) with raw output in the build log
.opencode/skills/web-implementation/SKILL.md:53:- [ ] No useless tests: each added test can fail on a real regression (no tautologies, no coverage-chasing)
.opencode/skills/web-implementation/references/engineering-principles.md:49:- **Tiers, with this repo's boundaries.** *Unit* = one module exercised in isolation, every collaborator injected (clock, randomness, id factory, socket factory) — no real I/O, no browser, no framework loop. *Integration* = several modules through a **real** boundary: a Fastify route or `/ws` endpoint over a real in-process socket, a React component rendered to markup, the connection state machine driven by a fake-but-real-shaped WebSocket. *Cross-service e2e* = the containerized smoke (`npm run smoke`), which exercises both composition roots through the container path and compensates for the entrypoint coverage exclusions. A behavior change ships unit **and** integration tests; skipping a tier requires a documented exception in the build log (e.g., purely visual styling with no logic boundary).
.opencode/skills/web-implementation/references/engineering-principles.md:53:- **No useless tests.** Every test must be able to fail on a real regression: ask "what code change would break this?" and if nothing realistic would, delete it. No tautologies (asserting a value the test itself configured on its own mock), no coverage-chasing tests written to move a number, no assertions on private implementation details (internal call order, private fields) where a behavior/outcome assertion exists. Interaction tests assert outcomes (state, rendered output, emitted messages) or concrete arguments — not merely that something was called.
.opencode/skills/web-implementation/references/engineering-principles.md:55:- **Coverage policy.** The gate is `npm run coverage`: Vitest's V8 provider, thresholds 80 on statements, branches, functions, and **lines** — all four, **aggregate per workspace** (per-file thresholds are a possible future tightening, not the current policy). Semantics are all-files: every non-excluded file matched by `coverage.include` counts, imported by a test or not, so "just don't import it" cannot buy coverage. The only legitimate exclusions are the pinned, justified ones — test-file patterns plus the single composition-root entrypoint per workspace (compensated by the containerized smoke test). Never exclude production logic, lower a threshold, or add tests that assert nothing to clear the gate; the gate exists to catch real regressions, and number-gaming it is a review finding.
exit=0
```

### T6 verify — OR-grep `integration\|anything\|objectContaining\|toHaveBeenCalled` across the three files

```
$ grep -in "integration\|anything\|objectContaining\|toHaveBeenCalled" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md
.opencode/agents/builder.md:115: (same rule line as above — contains `integration`, `expect.anything()`, `objectContaining`, `toHaveBeenCalled()`)
.opencode/skills/web-implementation/SKILL.md:14:3. Implement in small steps: pure logic first, then integration/UI. Keep diffs focused on the task's `files_owned`.
.opencode/skills/web-implementation/SKILL.md:15:4. Write unit **and** integration tests as you go (see § Testing bar; a documented exception is required when a change has no integration boundary), and make the coverage gate part of your run: `npm run coverage` enforces thresholds ≥ 80% statements/branches/functions/lines per workspace — a shortfall blocks reporting.
.opencode/skills/web-implementation/SKILL.md:38:- **Two tiers.** *Unit* exercises one module in isolation with its dependencies injected (clock, randomness, factories) — no I/O, no framework. *Integration* exercises modules through a real boundary: a route or WebSocket over a real in-process socket, a component render, or the server↔client wire. *Containerized smoke* (`npm run smoke`) is the cross-service e2e tier. Every behavior change ships **both** tiers; a change with no integration boundary needs a documented exception in the build log.
.opencode/skills/web-implementation/SKILL.md:39:- **Concrete assertions only.** Banned matcher forms: `expect.anything()`, `expect.any(Constructor)`, `objectContaining`/`arrayContaining`/`stringContaining`/`stringMatching`, loose `toMatchObject` as a stand-in for pinning the full expected value, argument-unchecked `toHaveBeenCalled()`, snapshot-only assertions, assertion-free tests, and weak existentials used as stand-ins for a concrete value (`toBeTruthy()`/`toBeDefined()`/`not.toThrow()` where an exact value can be asserted). Assert the real value: exact strings, exact numbers, exact envelopes, `toHaveBeenCalledWith(…)`.
.opencode/skills/web-implementation/SKILL.md:50:- [ ] Unit tests and integration tests added/updated for behavior changes (documented exception when no integration boundary exists)
.opencode/skills/web-implementation/references/engineering-principles.md:49:- **Tiers, with this repo's boundaries.** (same line as above — `integration`)
.opencode/skills/web-implementation/references/engineering-principles.md:50:- **Assert the real value (concrete-assertion rule).** Tests must pin the actual data the code produced — the "real approach data" of the request: exact strings, exact numbers, exact status codes, exact message envelopes, exact call arguments. Banned because they hide regressions: `expect.anything()`, `expect.any(Constructor)`, `objectContaining`/`arrayContaining`/`stringContaining`/`stringMatching`, `toMatchObject` used loosely instead of pinning the full expected object, argument-unchecked `toHaveBeenCalled()`, snapshot-only assertions (`toMatchSnapshot`/`toMatchInlineSnapshot` as the sole check), assertion-free tests, and **weak existentials used as stand-ins** — `toBeTruthy()`/`toBeDefined()`/`not.toThrow()` where the concrete value or the exact error is assertable. `toBeDefined()` is fine as an extra assertion next to a concrete one; it is not a substitute.
.opencode/skills/web-implementation/references/engineering-principles.md:54:- **Spy and mock discipline.** Prefer injected fakes over patching globals: the connection takes a `socketFactory`, the loop takes a clock. When a spy is unavoidable, assert with concrete arguments (`toHaveBeenCalledWith({ type: 'click', id: 7 })`) or on the resulting outcome; an argument-unchecked `toHaveBeenCalled()` is not evidence. **Sanctioned pattern for exercising an ambient default** (e.g., the real `defaultSocketFactory` arm): stub the global with an in-process fake class via `vi.stubGlobal('WebSocket', FakeSocket)`, assert the concrete values the fake observed (exact url, exact open/close sequence), and restore with `vi.unstubAllGlobals()` in `afterEach`. The fake never opens a socket — this is how the § Real-time testability rule ("tests need no real network") is satisfied while still covering the default path.
exit=0
```

### Per-file evidence for the AC-6 tokens (NOT the combined grep)

The combined greps above are advisory only (task note). Per-file output:

```
$ grep -in "coverage" .opencode/agents/builder.md
115:- Testing bar: every behavior change ships with unit tests **and** integration tests (tiers per the `web-implementation` skill's § Testing bar); assertions use concrete expected data — banned matchers are the `ItIsAny`-equivalents (`expect.anything()`/`expect.any()`, `objectContaining`/`arrayContaining`/`stringContaining`, loose `toMatchObject`, argument-unchecked `toHaveBeenCalled()`, snapshot-only, weak existentials used as stand-ins), and there are no useless tests; the coverage gate (`npm run coverage`, thresholds ≥ 80 statements/branches/functions/lines per workspace) is part of the task's verify evidence.
exit=0

$ grep -in "integration" .opencode/agents/builder.md
115:- Testing bar: every behavior change ships with unit tests **and** integration tests (tiers per the `web-implementation` skill's § Testing bar); assertions use concrete expected data — banned matchers are the `ItIsAny`-equivalents (`expect.anything()`/`expect.any()`, `objectContaining`/`arrayContaining`/`stringContaining`, loose `toMatchObject`, argument-unchecked `toHaveBeenCalled()`, snapshot-only, weak existentials used as stand-ins), and there are no useless tests; the coverage gate (`npm run coverage`, thresholds ≥ 80 statements/branches/functions/lines per workspace) is part of the task's verify evidence.
exit=0

$ for f in <three files>; do printf 'coverage:%s  integration:%s  %s\n' "$(grep -ic coverage $f)" "$(grep -ic integration $f)" "$f"; done
coverage:1  integration:1  .opencode/agents/builder.md
coverage:5  integration:4  .opencode/skills/web-implementation/SKILL.md
coverage:3  integration:1  .opencode/skills/web-implementation/references/engineering-principles.md
```

`.opencode/agents/builder.md` itself contains both required tokens (line 115, one occurrence each) — AC-6 is satisfied by its own file, not by the sibling files.

### `git diff` vs build-start baselines

```
$ git diff --numstat -- .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md
1	0	.opencode/agents/builder.md
17	2	.opencode/skills/web-implementation/SKILL.md
13	0	.opencode/skills/web-implementation/references/engineering-principles.md
```

Additive/replacement trace — full diff (3 files, 31 insertions / 2 deletions):

- `.opencode/agents/builder.md`: +1 line (one Rules bullet after the `files_owned` bullet) — **8.A addition**, no other change.
- `.opencode/skills/web-implementation/SKILL.md`: exactly two deleted lines and nothing else removed — the two pinned in-place replacements:

```
$ git diff -U0 -- .opencode/skills/web-implementation/SKILL.md | grep '^-' | grep -v '^---'
-4. Write or adjust tests as you go — every behavior change gets a test, or an explicit reason why not (e.g., purely visual).   <- 12.A (workflow step 4)
-- [ ] Tests added/updated for behavior changes                                                                               <- 12.B (Definition of Done item)
```

  the remaining 17 lines are the replacement step-4 text (1), the new `## Testing bar` section + heading + intro + 7 bullets (10), the replacement DoD item (1), and the three new DoD items (3) — i.e. **12.C addition** + the 12.B added items; no other existing line touched.
- `.opencode/skills/web-implementation/references/engineering-principles.md`: +13 lines, 0 deletions — the `## Testing principles` heading, intro, and 9 bullets inserted before `## Real-time (WebSocket) principles` — **13.A addition**; no other existing line touched.

### Supplementary sanity (not part of T6's pinned verify)

```
$ npm run lint
> lint
> eslint .
exit=0

$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present
> typecheck  (backend)  > tsc --noEmit
> typecheck  (frontend) > tsc --noEmit
exit=0
```

## Acceptance audit

- **AC-6 → met.** `.opencode/agents/builder.md` gains exactly one Rules bullet stating: unit **and** integration tests for every behavior change; concrete expected data with the banned matchers named as `ItIsAny`-equivalents; no useless tests; the `npm run coverage` gate (thresholds ≥ 80) as verify evidence. Per-file evidence above shows the file itself contains "coverage" (line 115) and "integration" (line 115); diff = +1/-0 (contract 8.A addition).
- **AC-7 → met.** `SKILL.md`: workflow step 4 now requires unit + integration tests and the coverage run with a shortfall blocking reporting (12.A); DoD has (a) unit + integration items, (b) coverage gate green with raw output in the build log, (c) concrete assertions / banned matchers with the bounded exception rule, (d) no useless tests (12.B + 3 additions); new `## Testing bar` section (before Definition of Done) defines the two tiers, the banned-matcher list including weak-existential stand-ins, the bounded exception (≤ 1/task, in-test unavoidability reason, reviewer-approved), determinism, the no-useless-tests bar, the coverage metric (four metrics, ≥ 80, per workspace, `npm run coverage`), and the depth pointer to `references/engineering-principles.md` § Testing principles (12.C).
- **AC-8 → met.** `engineering-principles.md` gains `## Testing principles` covering: tiers with this repo's boundaries (unit; integration = real in-process route/WS socket, component render; containerized smoke as cross-service e2e); the concrete-assertion rule with the Vitest-named banned list (incl. weak existentials as stand-ins and the "real approach data" framing); determinism (fake timers, injected clocks/ids/factories, parse-to-concrete-values, never weaken to dodge flakiness); the exception rule (≤ 1/task, in-test comment, reviewer-approved); the no-useless-tests bar (fail-on-regression, no tautologies/coverage-chasing/implementation-detail assertions); the coverage policy (all-files, justified exclusions only, no number-gaming, aggregate-per-workspace note); spy/mock discipline (concrete `toHaveBeenCalledWith`/outcome assertions, injected fakes preferred, plus the sanctioned `vi.stubGlobal` in-process fake-WebSocket pattern with `vi.unstubAllGlobals()` restore — reconciling with the § Real-time testability rule).
- **AC-22 → met.** Diff vs build-start baselines contains only the pinned content: contract 8.A (addition), 12.A and 12.B (the only two in-place replacements — deleted-line list proves exactly those two pre-existing lines were removed), 12.C (addition), 13.A (addition). No unrelated edit, no removal elsewhere, no frontmatter/permission-block change (all three files' frontmatter untouched; `builder.md`'s `permissions:` block byte-identical).

## Deviations from spec

None. Wording of the pinned contracts is followed in substance; contract IDs are traced here rather than printed inside the framework prose. This task is documentation-only, so no unit/integration tests are added for it (documented-exception path of the bar itself): it changes no runtime behavior and has no test boundary.
