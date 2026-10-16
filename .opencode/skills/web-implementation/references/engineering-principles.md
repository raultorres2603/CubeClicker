# Engineering principles for CubeClicker

Pragmatic application of SOLID, DRY, KISS, and YAGNI to a browser clicker game. These are guidelines with judgment, not religion: the tests, the task's acceptance criteria, and the existing codebase patterns win ties.

## SOLID, applied

- **S — Single responsibility.** A module does one thing: `game-loop` advances time, `economy` computes costs/income, `save` serializes state, `view` renders. If a file needs "and" to describe it, split it.
- **O — Open/closed.** Upgrades/buildings are data, not branches: a registry of definitions that the economy iterates, so adding content doesn't edit the system.
- **L — Liskov.** Prefer plain data + functions over inheritance trees. If you do subclass, honor the base contract; don't bolt game-specific flags onto shared interfaces.
- **I — Interface segregation.** Small focused types (`{ cost, multiplier }`) beat one god-`GameConfig` interface passed everywhere.
- **D — Dependency inversion.** Pure logic takes its dependencies (clock, randomness, storage) as parameters or injected adapters. Tests then run without a browser.

## DRY — with a third-strike rule

Extract on the third repetition, not the first. Two similar lines are cheaper than a wrong abstraction. When you do deduplicate, deduplicate the *concept* (e.g., "cost scaling formula"), not the incidental shape.

## KISS & YAGNI

- Prefer the boring solution: `Array.reduce` over a custom state machine; a plain object over a library for 30 lines of logic.
- Build only what the task's acceptance criteria require. No speculative config, no plugin systems for one use case, no premature optimization.
- If a dependency is proposed, justify it against: bundle size, maintenance, security surface. Adding dependencies is ⚠️ Ask first anyway.

## Game-specific rules

- **Determinism:** the core simulation must be a function of (state, elapsed time, inputs). Same inputs → same outputs. This makes offline progress, tests, and future anti-cheat possible.
- **Time discipline:** read the clock in ONE place (the loop); pass `deltaMs`/`now` down. Never scatter `Date.now()` through logic.
- **Number safety:** clicker economies grow fast. Decide per task whether `number` suffices or `bigint`/decimal math is required; document rounding rules.
- **Save integrity:** saves are versioned (`{ v: N, ... }`); a migration chain upgrades old versions; malformed saves fall back to a fresh state with a visible, non-crashing notice.
- **One writer per storage key** — no two modules writing the same localStorage key.

## Accessibility & UX floor

- Keyboard: everything clickable is focusable and activatable without a mouse.
- Use semantic elements (`button`, not `div` with a click handler).
- Respect `prefers-reduced-motion` for decorative animation.
- Numbers should stay readable: format with separators; avoid layout shift as digits grow (fixed-width tabular numerals).

## Performance budget (per feature)

- Interaction latency: input → visible feedback in the same frame at 60 fps.
- Main-thread tasks over ~16 ms are splitting candidates (chunk heavy work; don't run it per frame).
- Memory: no unbounded arrays/growth per tick; pools or reuse for hot-loop objects.
- Bundle: state any new dependency's cost in the build log; keep the game shell loading instantly.

## Real-time (WebSocket) principles

- **Single connection owner.** One module owns the socket and its lifecycle; the rest of the UI observes connection status and never opens its own socket.
- **Lifecycle & reconnection.** Reconnection is bounded (retry limit/backoff) and resyncs state on success; handlers are idempotent, so reconnecting never registers duplicates or double-applies server state.
- **Server authority.** Shared/global values (counters, presence, leaderboards) come from the server; optimistic UI must reconcile with the server's answer, and client-reported values are never treated as truth.
- **Untrusted inbound data.** Treat every inbound message as untrusted: validate its shape and type, ignore unknown messages and fields, and render untrusted text via `textContent`, never `innerHTML`.
- **Graceful degradation.** Connection loss is visible (a clear status) and non-fatal: local play and saves keep working and resync when the connection returns.
- **Testability.** Connection logic takes its socket/transport as an injected, fakeable dependency; reconnects, closes, and inbound messages are simulated, so tests need no real network.
