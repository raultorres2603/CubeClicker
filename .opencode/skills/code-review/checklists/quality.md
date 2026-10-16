# Quality checklist — structure, correctness, UX, performance

Mark each ✅ / ❌ / n/a; failures become findings with severity.

## Structure & maintainability
- [ ] Pure game logic separated from rendering/DOM (testable without a browser)
- [ ] Single source of truth for game state; UI reads state, doesn't fork it
- [ ] One writer per storage key / one owner per timer
- [ ] Names describe intent; files organized per the plan's file inventory
- [ ] No dead code, commented-out blocks, or debug leftovers (`console.log` beyond intentional logging)
- [ ] DRY honored without premature abstraction; no copy-pasted blocks across modules
- [ ] Diffs traceable to the task — no drive-by refactors

## Correctness
- [ ] Number handling: no silent float/overflow surprises in economy math; rounding rules documented
- [ ] Time handling: one clock source; offline/elapsed-time math correct (including negative/zero/huge deltas)
- [ ] Edge inputs: rapid clicking, double-fire prevention, tab throttling, reload mid-action
- [ ] Error paths: storage failure, invalid save, network (if any) all handled without crashing

## UX & accessibility
- [ ] Keyboard operable end-to-end; visible focus states
- [ ] Semantic elements (`button` for actions); labels for controls
- [ ] Text contrast ≥ 4.5:1; respects `prefers-reduced-motion`
- [ ] No layout shift as numbers grow; number formatting readable
- [ ] Feedback for user actions (especially clicks) is immediate and obvious

## Performance
- [ ] Interaction latency: input → visible feedback within the same frame at 60 fps
- [ ] No per-frame allocations or DOM churn in hot loops
- [ ] Timers/observers cleaned up on teardown (no leaks across reloads/HMR)
- [ ] Bundle additions justified and measured where significant
