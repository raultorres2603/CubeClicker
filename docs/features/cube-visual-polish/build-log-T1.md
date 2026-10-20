# Build log — T1 — Effect constants, pop timeline math & particle layering pins
Task: T1 (2026-10-20)
Files changed: `src/frontend/src/game/effects.ts`, `src/frontend/src/game/effects.test.ts`, `src/frontend/src/render/particles.ts`, `src/frontend/src/render/particles.test.ts`

What changed & why:
- `game/effects.ts`: added the six pinned constants (`TRAVEL_STARFIELD_SCALE` 8, `BURST_ORIGIN_OFFSET` 0.5, `MINI_CUBE_POP_MS` 160, `MINI_CUBE_POP_EXPAND_MS` 100, `MINI_CUBE_POP_PEAK_SCALE` 1.1, `MINI_CUBE_POP_COLOR_STRENGTH` 0.3) and the pure, three-free/DOM-free timeline functions `popScaleAt` / `popColorMultiplierAt`; module doc constant-home list updated (F2 single home).
- `game/effects.test.ts`: pins the six constant values and the exact AC-4 timeline literals at t = 0 / 50 / 100 / 130 / 160 / 161, plus the outside-envelope values.
- `render/particles.ts`: pool material now sets `depthTest: false` (`depthWrite: false`, `AdditiveBlending`, `transparent` unchanged) and the `Points` drawable carries `renderOrder = PARTICLE_RENDER_ORDER` (module constant 10, documented as above starfield/plates at default 0).
- `render/particles.test.ts`: material/drawable pins added; every existing pool assertion (cap 72, oldest-burst recycle, release at lifetime, 10-cycle reuse) left untouched and green.

Decisions:
- `popScaleAt` / `popColorMultiplierAt` are total functions of `elapsedMs`: non-positive time clamps to the start pose (scale 1 / multiplier 1), `>= MINI_CUBE_POP_MS` yields the settled end pose (scale 0 / multiplier 1). The plan pins the `>= 160` end values; the non-positive clamp is the documented start-pose extension of "linear expand 1→1.1 over 100 ms".
- Shrink phase computed as `PEAK * (1 - progress)` (scale) and `1 + STRENGTH * (1 - progress)` (multiplier) so the pinned literals `0.55` and `1.15` are exact doubles (no `toBeCloseTo`, bounded-exception budget stays 0).
- `PARTICLE_RENDER_ORDER` stays module-local (not exported): the plan's interface shows a bare `const` and no consumer needs it; the test pins the observable `points.renderOrder === 10`.
- Testing tiers: `effects.test.ts` is the unit tier (pure functions over explicit input); `particles.test.ts` is the integration tier per spec § Testing strategy ("Integration (same node environment — real three.js scene graph)") — it builds a real `Points`/`PointsMaterial` graph and asserts the actual material/drawable flags.

Evidence:

`npx vitest run --root src/frontend src/game/effects.test.ts src/render/particles.test.ts` → exit 0
```
 ✓ src/game/effects.test.ts (23 tests) 5ms
 ✓ src/render/particles.test.ts (19 tests) 11ms

 Test Files  2 passed (2)
      Tests  42 passed (42)
```

`npm test --workspace @cubeclicker/frontend` → exit 0
```
 ✓ src/game/effects.test.ts (23 tests) 7ms
 ...
 ✓ src/render/particles.test.ts (19 tests) 14ms
 ...
 Test Files  20 passed (20)
      Tests  278 passed (278)
```

`npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80/80/80/80 unchanged, no exclusions added)
```
 Test Files  20 passed (20)
      Tests  278 passed (278)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.19 |    99.15 |     100 |   99.19 |
 src/game        |     100 |    99.62 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
 src/render      |   99.68 |    99.27 |     100 |   99.68 |
  particles.ts   |     100 |      100 |     100 |     100 |
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 | 23-30
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
```
Per-metric workspace totals: statements 99.19, branches 99.15, functions 100, lines 99.19 — all four ≥ 80. `effects.ts` and `particles.ts` each 100/100/100/100.

`npm run typecheck --workspace @cubeclicker/frontend` → exit 0 (no output beyond the `tsc --noEmit` header).

`npm run lint` → exit 0 (no output beyond the `eslint .` header).

Banned-matcher grep over the two changed test files (`toBeCloseTo|expect.anything|expect.any(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot`) → no matches (grep exit 1).

Diff stat (owned files only):
```
 src/frontend/src/game/effects.test.ts     | 43 ++++++++++++++++++
 src/frontend/src/game/effects.ts          | 74 ++++++++++++++++++++++++++++---
 src/frontend/src/render/particles.test.ts | 10 +++--
 src/frontend/src/render/particles.ts      | 16 +++++++
 4 files changed, 135 insertions(+), 8 deletions(-)
```

Acceptance audit (T1 scope only):
- AC-1 (partial, constants) → met: `TRAVEL_STARFIELD_SCALE === 8` pinned in `effects.test.ts`; the expansion wiring itself is T2.
- AC-3 (partial: material/drawable pins + `BURST_ORIGIN_OFFSET`) → met: `material.depthTest === false`, `material.depthWrite === false`, `points.renderOrder === 10`, `BURST_ORIGIN_OFFSET === 0.5` pinned; spawn-offset wiring is T2.
- AC-4 (partial: pure timeline math + constants) → met: `popScaleAt` / `popColorMultiplierAt` exact literals at t = 0/50/100/130/160/161 (`1/1.05/1.1/0.55/0/0` and `1/1.15/1.3/1.15/1/1`) plus the four pop constants; the cube-view/scene animation wiring is T2.
- AC-7 (partial) → met for this task: lint/typecheck/workspace tests/workspace coverage all exit 0 with the four metrics ≥ 80; no exclusions or threshold changes.

Deviations from spec: none. No out-of-scope files edited (`git status` shows only the four owned source/test files plus this new build log; the pre-existing `docs/features/cube-game-frontend/status.md` modification was already present before this task and was not touched).
