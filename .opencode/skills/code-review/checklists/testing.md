# Testing checklist — coverage, quality, evidence

Mark each ✅ / ❌ / n/a; failures become findings with severity.

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

## Evidence standard
- [ ] The review records raw command names and result summaries (not "tests pass" without output)
- [ ] Any AC marked met cites where the proof lives (test name, file:line, command)
- [ ] Anything not verifiable is marked unable-to-verify and treated as unmet
