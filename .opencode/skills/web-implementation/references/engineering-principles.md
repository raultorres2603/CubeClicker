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

## Testing principles

The bar in the `web-implementation` SKILL § Testing bar, with the depth behind it.

- **Tiers, with this repo's boundaries.** *Unit* = one module exercised in isolation, every collaborator injected (clock, randomness, id factory, socket factory) — no real I/O, no browser, no framework loop. *Integration* = several modules through a **real** boundary: a Fastify route or `/ws` endpoint over a real in-process socket, a React component rendered to markup, the connection state machine driven by a fake-but-real-shaped WebSocket. *Cross-service e2e* = the containerized smoke (`npm run smoke`), which exercises both composition roots through the container path and compensates for the entrypoint coverage exclusions. A behavior change ships unit **and** integration tests; skipping a tier requires a documented exception in the build log (e.g., purely visual styling with no logic boundary).
- **Assert the real value (concrete-assertion rule).** Tests must pin the actual data the code produced — the "real approach data" of the request: exact strings, exact numbers, exact status codes, exact message envelopes, exact call arguments. Banned because they hide regressions: `expect.anything()`, `expect.any(Constructor)`, `objectContaining`/`arrayContaining`/`stringContaining`/`stringMatching`, `toMatchObject` used loosely instead of pinning the full expected object, argument-unchecked `toHaveBeenCalled()`, snapshot-only assertions (`toMatchSnapshot`/`toMatchInlineSnapshot` as the sole check), assertion-free tests, and **weak existentials used as stand-ins** — `toBeTruthy()`/`toBeDefined()`/`not.toThrow()` where the concrete value or the exact error is assertable. `toBeDefined()` is fine as an extra assertion next to a concrete one; it is not a substitute.
- **Determinism, not weakening.** When a test is flaky, control its inputs: `vi.useFakeTimers()` and advance time explicitly; inject the clock, id generator, and factories rather than reading ambient `Date.now()`/`Math.random()`; parse timestamps into concrete values and assert exact/bounded values. Never relax an assertion to a wildcard, existential, or snapshot to make a run green — a weakened assertion is worse than a red test, because it certifies a regression-free state it never checked.
- **Exception rule.** A banned form is permitted only when no exact-value assertion is possible (canonical case: one `expect.closeTo()` on floating-point economy math). Constraints: **≤ 1 per task**, an in-test comment naming the concrete unavoidability reason, reviewer approval, and the exception recorded in the review artifact.
- **No useless tests.** Every test must be able to fail on a real regression: ask "what code change would break this?" and if nothing realistic would, delete it. No tautologies (asserting a value the test itself configured on its own mock), no coverage-chasing tests written to move a number, no assertions on private implementation details (internal call order, private fields) where a behavior/outcome assertion exists. Interaction tests assert outcomes (state, rendered output, emitted messages) or concrete arguments — not merely that something was called.
- **Spy and mock discipline.** Prefer injected fakes over patching globals: the connection takes a `socketFactory`, the loop takes a clock. When a spy is unavoidable, assert with concrete arguments (`toHaveBeenCalledWith({ type: 'click', id: 7 })`) or on the resulting outcome; an argument-unchecked `toHaveBeenCalled()` is not evidence. **Sanctioned pattern for exercising an ambient default** (e.g., the real `defaultSocketFactory` arm): stub the global with an in-process fake class via `vi.stubGlobal('WebSocket', FakeSocket)`, assert the concrete values the fake observed (exact url, exact open/close sequence), and restore with `vi.unstubAllGlobals()` in `afterEach`. The fake never opens a socket — this is how the § Real-time testability rule ("tests need no real network") is satisfied while still covering the default path.
- **Coverage policy.** The gate is `npm run coverage`: Vitest's V8 provider, thresholds 80 on statements, branches, functions, and **lines** — all four, **aggregate per workspace** (per-file thresholds are a possible future tightening, not the current policy). Semantics are all-files: every non-excluded file matched by `coverage.include` counts, imported by a test or not, so "just don't import it" cannot buy coverage. The only legitimate exclusions are the pinned, justified ones — test-file patterns plus the single composition-root entrypoint per workspace (compensated by the containerized smoke test). Never exclude production logic, lower a threshold, or add tests that assert nothing to clear the gate; the gate exists to catch real regressions, and number-gaming it is a review finding.
- **Retroactivity.** The bar governs new and changed tests. Pre-existing tests are not retro-refactored to satisfy it; when a task touches an old test, bring that test up to the bar.

## Real-time (WebSocket) principles

- **Single connection owner.** One module owns the socket and its lifecycle; the rest of the UI observes connection status and never opens its own socket.
- **Lifecycle & reconnection.** Reconnection is bounded (retry limit/backoff) and resyncs state on success; handlers are idempotent, so reconnecting never registers duplicates or double-applies server state.
- **Server authority.** Shared/global values (counters, presence, leaderboards) come from the server; optimistic UI must reconcile with the server's answer, and client-reported values are never treated as truth.
- **Untrusted inbound data.** Treat every inbound message as untrusted: validate its shape and type, ignore unknown messages and fields, and render untrusted text via `textContent`, never `innerHTML`.
- **Graceful degradation.** Connection loss is visible (a clear status) and non-fatal: local play and saves keep working and resync when the connection returns.
- **Testability.** Connection logic takes its socket/transport as an injected, fakeable dependency; reconnects, closes, and inbound messages are simulated, so tests need no real network.

## Containerization principles

- **One image per deployable.** Frontend, backend, and future services each build from this repository into their own container image; the image is the deployable artifact (`docs/architecture/containerization.md`).
- **Single-command local run.** The full environment starts from a clean checkout with one `podman compose up`-style command; no host-specific setup beyond Podman with a working compose provider.
- **Config via environment.** Ports, endpoints, and flags come from environment variables with safe local defaults; configuration is never baked into the image.
- **No secrets in images.** Secrets are injected at run time; nothing secret is committed, layered, or logged, and `.env*` stays user-owned.
- **Health & graceful lifecycle.** Every long-running service exposes a health signal and stops cleanly without data corruption.
- **WebSocket end-to-end.** The backend container exposes the WebSocket endpoint and the compose setup preserves connection upgrades — consistent with § Real-time (WebSocket) principles.
- **Deploy neutrality.** No provider-specific assumptions; the images run on any container platform (AWS ECS Fargate is an example only, not a commitment).

## Documentation principles

Reference: `docs/architecture/documentation.md` (single source of truth for the documentation best practices and the acceptance-time update checklist).

- **Accuracy.** Documentation must match shipped behavior; stale or misleading docs are treated as defects.
- **Minimal diffs.** Change only what the behavior change requires — no blanket rewrites of unrelated sections.
- **Same change.** Update documentation in the same commit as the behavior change it describes.
- **Concrete specifics.** Prefer paths, commands, and environment variables over vague prose.
- **Link validity.** Keep relative links resolvable; no broken references.
- **Glossary.** Update `docs/product/glossary.md` when a term's meaning changes.
