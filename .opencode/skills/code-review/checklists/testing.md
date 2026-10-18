# Testing checklist — coverage, quality, evidence

Mark each ✅ / ❌ / n/a; failures become findings with severity.

## Coverage gate
- [ ] `npm run coverage` rerun independently by the reviewer — both workspaces ≥ 80% on statements, branches, functions, and lines
- [ ] Coverage exclusions match the spec's justified list (test files + the one composition-root entrypoint per workspace, extending Vitest's built-in defaults) — no production logic excluded, no number-gaming
- [ ] Un-imported production files count (the report lists every non-excluded module, e.g. a never-imported file at 0%)
- [ ] Raw command output recorded in the review — not quoted from the build log

## Coverage of the feature
- [ ] Every acceptance criterion has direct evidence: a test, a command, or a reproducible manual step recorded in the review
- [ ] Core logic (economy, time, persistence) has unit tests independent of the DOM
- [ ] Integration points (state ↔ UI, save ↔ load) have at least one test each
- [ ] Bug fixes in this diff include a regression test

## Edge cases exercised
- [ ] Offline progress: large time jumps, clock going backwards, zero elapsed
- [ ] Storage: quota exceeded, private mode, corrupted JSON, version migration from previous schema
- [ ] Input: rapid/repeated clicks, keyboard activation, double event firing
- [ ] Lifecycle: reload mid-action, visibility change/tab throttling

## Test quality
- [ ] Deterministic: no reliance on real wall-clock sleeps; time is injected/faked
- [ ] Assertions check behavior, not implementation details
- [ ] No flaky patterns (timing races, order dependence, shared mutable fixtures)
- [ ] Tests fail for the right reason (spot-check one negative case where cheap)

## Assertion quality (real-data rule)
- [ ] Assertions pin concrete expected values — no `expect.anything()`, `expect.any()`, `expect.objectContaining()`, `expect.arrayContaining()`, `expect.stringContaining()`/`expect.stringMatching()`, and no loose `toMatchObject()` as a stand-in for the full expected value
- [ ] Weak existentials (`toBeTruthy()` / `toBeDefined()` / `not.toThrow()`) are not stand-ins where a concrete value can be asserted
- [ ] Spy/mock calls checked with concrete arguments (`toHaveBeenCalledWith(…)`), never argument-unchecked `toHaveBeenCalled()`
- [ ] No snapshot-only tests (`toMatchSnapshot`/`toMatchInlineSnapshot` as the sole assertion) and no assertion-free tests
- [ ] Any exception to the list above is ≤ 1 per task, carries an in-test comment naming the concrete unavoidability reason (why no exact-value assertion is possible), and is reviewer-approved (recorded in the review artifact)
- [ ] The bar applies to new and changed tests; pre-existing tests are not retro-refactored

## No useless tests
- [ ] Every added/changed test can fail on a real regression (spot-check: "what change would break it?")
- [ ] No tautologies (re-asserting values configured on the test's own mocks) and no coverage-chasing tests
- [ ] Tests assert behavior/outcomes, not implementation details

## Evidence standard
- [ ] The review records raw command names and result summaries (not "tests pass" without output)
- [ ] Any AC marked met cites where the proof lives (test name, file:line, command)
- [ ] Anything not verifiable is marked unable-to-verify and treated as unmet

## Real-time coverage (if applicable)
- [ ] Multi-client behavior has at least one test: two clients observe the same shared state
- [ ] Reconnect/close paths are tested via simulated connection events (no real network), including state resync after reconnect
- [ ] Malformed/unknown inbound messages are handled in tests (ignored, no crash, no state change)

## Container coverage (if applicable)
- [ ] The containerized local environment starts and serves the full stack (documented smoke check)
- [ ] WebSocket connectivity verified through the container path (upgrades work end-to-end)
- [ ] Container build/run checks are part of the verification suite once the stack provides commands
