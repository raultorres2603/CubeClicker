# Build log — T9 — Explosion particles (pooled)

Task: T9 (`docs/features/cube-game-frontend/tasks.md`)
Files changed: `src/frontend/src/render/particles.ts` (new), `src/frontend/src/render/particles.test.ts` (new), `docs/features/cube-game-frontend/build-log-T9.md` (new)
What changed & why: implements the plan § Interfaces contract `createParticleSystem(random, cap = PARTICLE_POOL_CAP)` — one pooled `Points` drawable, `spawn(burst, origin, nowMs)` / `update(dtMs)` / `activeCount()` / `dispose()`; bursts age and release at `burst.lifetimeMs`; a spawn at the cap recycles the earliest-spawned burst, so `activeCount()` never exceeds `PARTICLE_POOL_CAP` (72, imported from `game/effects.ts`, never redefined). 19 node tests against real three.js objects pin the buffer contents, the cap/recycle behaviour and disposal.
Decisions:
- **One drawable, not one `Points` per burst.** `cap` position/colour slots live in a single `Points` (`DynamicDrawUsage`); a burst owns a contiguous slice and `update` rewrites the buffer from the recorded burst state (`bursts` array + per-fragment jitter offsets). Buys AC-16 bounded drawables (1 object ever created) and one draw call for the whole pool.
- **`nowMs` orders recycling.** `update` only receives `dtMs`, so `spawn`'s `nowMs` is the recycle key: the pool drops the burst with the smallest spawn time (ties → spawn order), covered by the out-of-order spawn test.
- **`random` drives the per-fragment spawn jitter** (three draws per played fragment, `x → y → z`, `±0.0625` world units) — a burst reads as a cloud, and the injected source stays deterministic/assertable. `0.0625` (2⁻⁴) is float32-exact, so spawned positions are pinned by `toBe`-level equality.
- **`BurstParticle.size` is not consumed.** `PointsMaterial` carries a single size per draw call and the pool deliberately stays one drawable (AC-16) instead of one `Points` per fragment; fragments draw at the pinned world size `0.15`. Recorded in the module docstring too.
- **Ignored spawns:** empty bursts and non-positive lifetimes (the spec § Reduced motion path sends no burst) are no-ops, which also keeps the linear fade denominator positive.
- **Released slots are zeroed** beyond the draw range so "the oldest burst's particles are gone" is assertable over the whole buffer.

Evidence:

- `npm test --workspace @cubeclicker/frontend -- src/render/particles.test.ts` → exit 0
```
 ✓ src/render/particles.test.ts (19 tests) 16ms
 Test Files  1 passed (1)
      Tests  19 passed (19)
```
- `npm test --workspace @cubeclicker/frontend` → exit 0 (full frontend workspace suite, final run)
```
 Test Files  10 passed (10)
      Tests  169 passed (169)
```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0 (`tsc --noEmit`, no output)
- `npm run lint` → exit 0 (whole repository, final run, no output)
- `npx eslint src/frontend/src/render/particles.ts src/frontend/src/render/particles.test.ts` → exit 0 (no output)
- `npx vitest run --coverage --coverage.include='src/render/particles.ts' src/render/particles.test.ts` → exit 0 (module-scoped coverage evidence)
```
 All files     |     100 |      100 |     100 |     100 |
 particles.ts |     100 |      100 |     100 |     100 |
```
- `npm run coverage --workspace @cubeclicker/frontend` → **exit 0** (final run, after T6's concurrently-written files landed; all four metrics clear 80 and `particles.ts` is 100):
```
 Test Files  10 passed (10)
      Tests  169 passed (169)
 All files        |    99.3 |    99.34 |     100 |    99.3 |
 src/render      |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
exit=0
```
  Earlier runs of the same command were red **only** because T6's `src/frontend/src/game/engine.ts` (+ `engine.test.ts`) was still being written in parallel — a path outside this task's `files_owned`; kept here as attribution evidence, not as a T9 result. Raw run 1 (T6's implementation written, its test file not yet present):
```
 File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
 All files        |   68.57 |    98.88 |     100 |   68.57 |
 src/game        |   43.38 |      100 |     100 |   43.38 |
  engine.ts      |       0 |      100 |     100 |       0 | 37-562
 src/render      |     100 |      100 |     100 |     100 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
ERROR: Coverage for lines (68.57%) does not meet global threshold (80%)
ERROR: Coverage for statements (68.57%) does not meet global threshold (80%)
```
  Raw run 2 (T6's `engine.test.ts` now present and itself failing) — the run aborts on T6's tests, so no coverage table is produced:
```
 ❯ src/game/engine.test.ts (31 tests | 7 failed) 35ms
 FAIL  src/game/engine.test.ts > clicks, stats and intents (AC-5, AC-11) > explodes the cursor cell through the identical path as a click (AC-8)
   ❯ src/game/engine.test.ts:248:38
 Test Files  1 failed | 9 passed (10)
      Tests  7 failed | 160 passed (167)
exit=1
```
  Attribution experiment (T6's in-flight `engine.ts` excluded, T6's test file not run; my test file included) — the remaining workspace aggregate is green and `particles.ts` is 100 on all four metrics, i.e. T9 does not drag the gate:
```
 All files        |   95.53 |    97.76 |   96.49 |   95.53 |
 src/render      |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
exit=0
```
- `grep -nE "expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toBeTruthy|toBeDefined|toBeFalsy|toHaveBeenCalled\(\)" src/frontend/src/render/particles.test.ts` → no matches (exit 1); no `toBeCloseTo`, so the ≤ 1 bounded exception is not used at all.
- `git status --porcelain` (scope check) → only untracked paths; `particles.ts` / `particles.test.ts` staged explicitly for the commit; no other tracked file touched.

Acceptance audit:
- AC-5 (burst, spec lists `particles.test.ts` as evidence) → **met**: a real `createBurst(...)` burst activates exactly `EXPLOSION_PARTICLE_COUNT` (24) fragments at the origin offsets, and the burst plays until its 350 ms lifetime ends, after which `activeCount()` is 0 and the buffer is zeroed (test: "plays a real EXPLOSION_PARTICLE_COUNT burst and releases it after its lifetime"). The engine→`spawn` wiring is T6/T12's half of AC-5.
- AC-16 (cap/release) → **met**: hard cap `PARTICLE_POOL_CAP` (72) imported from `game/effects.ts`; spawning a 4th 24-fragment burst recycles the oldest burst and `activeCount()` stays exactly 72 with the recycled burst's fragments absent from the buffer; release at the lifetime boundary returns `activeCount()` to exactly 0; 10 spawn/release cycles reuse the same `Points`, geometry, attributes and 216-float buffer (no unbounded growth).

Tiers: `particles.ts` is a render-adapter module — no DOM, network or database boundary. Per spec § Testing strategy, this feature's integration tier *is* the node run against real three.js objects (`Points`, geometry/attributes, material, disposal), which this file asserts; the pool bookkeeping (counts, cap, recycle, release boundaries with hand-built bursts) is the unit tier. The module's integration into the scene/session is covered by T12/T13; no further boundary exists here.

Deviations from spec: none. Design notes (not spec deviations) are the `size`-not-consumed and `nowMs`-orders-recycling decisions above.
