# Build log — T2 — Starfield square cone + swirl, intro dolly, travel arrival scene wiring

Task: T2 (2026-10-21) — `[P]`, depends_on T1. Re-dispatched after the r1 block; **spec r2 approved**
(square cone). Status: **completed**.

Files changed:
`src/frontend/src/render/starfield.ts`, `src/frontend/src/render/starfield.test.ts`,
`src/frontend/src/render/scene.ts`, `src/frontend/src/render/scene.test.ts`,
`src/frontend/src/game/session.test.ts` (test-only, one assertion block), this log.

## What changed & why (≤5 lines)

- `starfield.ts`: the backdrop is a camera-anchored **square** cone (`STARFIELD_TAN = 1.251258882715913` on
  both axes, depths `[20, 160]`, draw order `x → y → depth → brightness`, 4 draws/star, `STAR_COUNT` 1200);
  `update(dtMs, travelProgress?, anchor?)` re-anchors to the camera (`position` copy, `quaternion =
  anchor.quaternion × RotZ(swirlAngle)`, one preallocated swirl quaternion, no anchor → world identity),
  advances the view-axis swirl at `1/65536` rad/ms with `max(0, dtMs)` and applies the symmetric scale
  `S = 1 + 7·travelSwing(clamp(p))` (z stays 1; omitted progress keeps the scale).
- `scene.ts`: `introCameraPose` is the straight dolly `z = 60 − 48·easeOutCubic(clamp(p))` targeting the
  origin (search/find constants deleted, `INTRO_START_Z = 60`); the travel branch is
  `z = 12 + 78·travelSwing(p)` + `lookAt(ORIGIN)`; `update` feeds
  `starfield.update(dtMs, travelProgress, starfieldAnchor)` with the preallocated camera-referencing anchor.
- Tests: `starfield.test.ts` pins the square-cone bounds (both axes against `STARFIELD_TAN`), determinism,
  swirl quaternions, anchor copy, scale table, clamping, identity and dispose; `scene.test.ts` has the
  AC-1 corner-ray coverage + seeded density, the AC-2 pose table/sweep/framing gates, the AC-3 travel table
  and mid-travel rebuild/landing, plus the retained groups; `session.test.ts` re-pins the first-frame literal.

## Original blocker (r1) — resolved by spec r2

The r1 `STARFIELD_TAN_X`/`STARFIELD_TAN_Y` rectangle (`1.251258882715913` / `0.5362538068782483`) failed the
pinned AC-1 corner-ray test at swirl `π/4`: a rectangle is invariant only under 90° rotations, so the
inverse-swirled viewport corner leaves the short side. Measured worst `|v|` at `π/4` was `0.5495` (2/3),
`0.9159` (16/9), `1.0991` (7/3) against `TAN_Y = 0.5363` — i.e. the r1 fix reproduced the defect class after
≈ 51 s of swirl. The blocked run (raw failure) was:

```
 FAIL  src/render/scene.test.ts > backdrop coverage and density (AC-1)
       > covers the real frustum corner rays at every pinned pose, aspect and swirl
AssertionError: expected 0.5495488453343635 to be less than or equal to 0.5362538068782483
 Test Files  1 failed | 19 passed (20)
      Tests  1 failed | 287 passed (288)
```

Spec r2 resolves it with the square cone: `STARFIELD_TAN = tan(25°)·(7/3)·1.15 = 1.251258882715913` on both
axes. The square's inradius (`1.2513`) exceeds the largest supported viewport circumradius
(`√(1.0880² + 0.4663²) = 1.1840` at 7/3), so every inverse-swirled corner ray satisfies
`|u| ≤ STARFIELD_TAN` and `|v| ≤ STARFIELD_TAN` at every swirl angle. The negative r1 measurement is kept
as an in-test comment next to the corrected assertions (plans r2 § Risks retained).

## r2 measurements (pinned fixtures)

Seed `7`, square cone, 16:9, exact projected counts from the real camera (`ndcStarCells`):

- sustained poses (rest / intro start / intro mid / travel end), scale `(1,1,1)`, 4×4 NDC cells
  (row 0 = bottom): `[14,14,16,15,28,28,23,16,19,14,15,16,18,19,29,18]`, total **302** (floor ≥ 5 per cell;
  smallest cell 14; expected ≈ 296 total / ≈ 18.5 per cell).
- scale-8 turn-around `(0,0,90)`: total **5** (floor ≥ 2; expected ≈ 5), cells
  `[0,1,0,0,1,1,1,0,0,0,1,0,0,0,0,0]`.
- swirl `update(1000)`: composed quaternion `[0,0,0.007629320516597103,0.9999708963107151]`; three's Euler
  round-trip is `0.015258789062499998` (one ulp below the ideal `0.0152587890625`), so the exact composed
  doubles are pinned with an in-test comment (no `toBeCloseTo`).
- distribution bounds: every star in seed 1 satisfies `depth ∈ [20,160]`, `|x|/depth ≤ 1.251258882715913`
  and `|y|/depth ≤ 1.251258882715913`; the constant literal is pinned.

## Evidence (final verify)

`npm test --workspace @cubeclicker/frontend` →

```
 ✓ src/render/starfield.test.ts (15 tests) 69ms
 ✓ src/game/session.test.ts (19 tests) 41ms
 ✓ src/render/scene.test.ts (35 tests) 93ms
 ...
 Test Files  20 passed (20)
      Tests  291 passed (291)
```

`npm run coverage --workspace @cubeclicker/frontend` →

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.31 |    99.36 |     100 |   99.31 |
 src             |     100 |      100 |     100 |     100 |
 src/game        |     100 |    99.59 |     100 |     100 |
  session.ts     |     100 |    98.18 |     100 |     100 | 173
 src/render      |     100 |      100 |     100 |     100 |
  scene.ts       |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 | 23-30
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
```

Thresholds ≥ 80 on all four metrics pass (99.31 / 99.36 / 100 / 99.31); no exclusions or threshold changes.

`npm run typecheck --workspace @cubeclicker/frontend` → exit 0 (`tsc --noEmit`, no diagnostics).

`npm run lint` → exit 0 (`eslint .`, no findings).

Focused evidence for the corrected criterion (before the workspace-wide run):

```
 ✓ src/render/starfield.test.ts (15 tests)
 ✓ src/render/scene.test.ts (33 tests)   # before restoring the retained snap group
 ✓ src/game/session.test.ts (19 tests)
```

## Acceptance audit

- AC-1 → **met**: square-cone distribution bounds over every star (`starfield.test.ts`), camera anchor copy/compose,
  `update(1000)` swirl exact doubles, `update(0)` no advance, scale table/clamping/identity, corner-ray
  coverage at 4 poses × 3 aspects × 2 swirls (including the scale-8 turn-around) and seeded per-cell density
  (302 total / 14 minimum cell; 5 at the peak, floor ≥ 2). Negative r1 evidence retained in-test.
- AC-2 → **met**: 5-row pose table exact literals + identity quaternion, monotonic sweep `{0, 0.1, …, 1}`,
  framing gates (all 8 corners) at `p ∈ {0,0.25,0.5,0.75,1}` × aspects `{2/3,16/9,7/3}`, centre on the view
  axis, skip-to-rest, reduced-motion collapse; `session.test.ts` first-frame literal `[0,0,60]`.
- AC-3 (scene parts) → **met**: camera `12/21.75/51/80.25/90/80.25/51/21.75/12`, scale
  `(1,1,1)/(1.875…)/(4.5…)/(7.125…)/(8,8,1)/…/(1,1,1)`, identity quaternion at every pinned p, same `Points`
  identity, mid-travel `levelChanged` rebuild once (no second rebuild from the new-style snapshot), landing at
  `(0,0,12)` / `(1,1,1)`; reduced motion keeps rest/scale.
- AC-4 (partial) → **met for T2**: only the T2 `files_owned` paths changed (engine untouched: T3's
  `bef14a7`); retained burst/pop/fade/disposal/baseline groups pass; no new dependencies; coverage green.

## Decisions

- Single `STARFIELD_TAN` exported (module-local definition) so `scene.test.ts` compares the real camera's
  inverse-swirled corner rays against the actual cone contract (plan D-4); the coverage test fails loudly if
  the lens or aspect bound diverges.
- Density seed `7` (the fixture from the blocked attempt), re-measured for the square cone: 302 sustained
  total / 5 peak, both above the r2 floors (≥5 per cell / ≥2 total); exact seeded values pinned.
- `session.test.ts` changed by exactly the one comment + literal block named in the task.

## Deviations from spec

None; the r1 blocker was resolved by the approved spec r2 (square cone).
