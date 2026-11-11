# Build log — T1 — Shared motion vocabulary and adaptive quality matrix

Task: T1 (2026-11-11)
Feature: small-destruction-shot-fx
Branch: main (no branch switch)

**Fork point:** `BASE_SHA=92fcf84999cde086dbc2d6acc89629f73a2fe6d6` (`git rev-parse HEAD`).

**Precondition:** `git status --porcelain -- docs/features/README.md` is clean and the accepted
predecessor row (`particle-only-click-effects | … | accepted | 2026-11-11`) is already committed at
HEAD in `92fcf84`. No separate `docs: freeze accepted feature index rows` commit was possible or
needed: staging that file would produce an empty commit, and the task's own precondition
(`tasks.md` T1, "committed/frozen … if not, T1 is blocked") is satisfied by the clean index.

Files changed:
- `src/frontend/src/game/motion.ts`
- `src/frontend/src/game/motion.test.ts`
- `src/frontend/src/render/quality.ts`
- `src/frontend/src/render/quality.test.ts`
- `docs/features/small-destruction-shot-fx/build-log-T1.md`

What changed & why (≤5 lines):
- Added the 14 AC-1 destruction/shot tokens to `MOTION`; no existing value changed, no CSS token.
- Pinned the enlarged exact `MOTION` object and the three headline-sum relations in `motion.test.ts`.
- Added the four AC-2 count/flag tables and four `QualityFeatures` fields; `qualityFeatures` forces
  the new fields to `0`/`false` under reduced motion and keeps every existing field/value.
- Updated the four exact `qualityFeatures` matrices, the exported-key list and the per-tier constant
  assertions. `createQualityPolicy` and all thresholds/cooldowns/hysteresis values are untouched.

Decisions:
- New `MOTION` keys are appended as a documented block after the accepted tokens so no accepted
  value moves; `as const` keeps the literal types.
- `shotFx` is computed as `!reducedMotion && QUALITY_SHOT_FX[tier]` so reduced motion is
  authoritative for the shot layer, matching the impact/shard/spark derivation.
- No source-comment/doc change beyond the build log: the tokens/fields are inert until T3 wires
  them, so no user-facing docs are affected by T1.

Evidence (raw):
- `git rev-parse HEAD` → `92fcf84999cde086dbc2d6acc89629f73a2fe6d6`
- `git status --porcelain -- docs/features/README.md` → no output (exit 0); the accepted
  predecessor row is committed at HEAD.
- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .
  ```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > typecheck
  > tsc --noEmit
  ```
- `npm test --workspace @cubeclicker/frontend` → exit 0:
  ```
   Test Files  63 passed (63)
        Tests  1694 passed (1694)
  ```
  Includes `src/game/motion.test.ts (12 tests)` and `src/render/quality.test.ts (24 tests)`.
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0:
  ```
  All files          |   96.33 |    95.36 |   97.41 |   96.33
   motion.ts         |     100 |      100 |     100 |     100
   quality.ts        |   97.91 |    97.18 |     100 |   97.91
  ```
  (statements / branch / functions / lines; all ≥ 80 in the frontend workspace.)
- `git diff --stat -- src/frontend/src/game/motion.ts src/frontend/src/game/motion.test.ts
  src/frontend/src/render/quality.ts src/frontend/src/render/quality.test.ts` → 4 files changed,
  120 insertions(+), 2 deletions(-); the only deletions are the two updated test titles, and no
  existing `MOTION` value changed.

Acceptance audit:
- **AC-1 → met.** `MOTION` adds exactly the 14 specified keys/values
  (`miniCubeDestroyMs 140`, `miniCubeDestroyGrowMs 30`, `miniCubeDestroyPeakScale 1.08`,
  `miniCubeDestroyFlashMs 90`, `miniCubeDestroyFlashGain 3`, `impactFlashMs 140`,
  `impactFlashGrowMs 60`, `impactEmberCount 8`, `impactEmberLifetimeMs 380`,
  `impactSmokeCount 4`, `impactSmokeLifetimeMs 480`, `shotMuzzleFlashMs 80`, `shotRecoilMs 120`,
  `shotRecoilDistance 0.12`); the exact `toEqual(MOTION)` object pins all accepted plus new values;
  the new headline test pins `impactFlashGrowMs < impactFlashMs`,
  `miniCubeDestroyGrowMs < miniCubeDestroyMs`, `shotRecoilMs > shotMuzzleFlashMs`; the easing
  describe blocks are untouched; no CSS token added. Evidence: `motion.test.ts` 12/12 green.
- **AC-2 → met.** `quality.ts` exports `QUALITY_EXPLOSION_FLASH_COUNTS {1,1,0}`,
  `QUALITY_EXPLOSION_EMBER_COUNTS {8,4,0}`, `QUALITY_EXPLOSION_SMOKE_COUNTS {4,2,0}` and
  `QUALITY_SHOT_FX {true,true,false}`; `QualityFeatures` adds `explosionFlash`,
  `explosionEmbers`, `explosionSmoke`, `shotFx`; the four exact `toEqual` matrices pin
  high `1/8/4/true`, medium `1/4/2/true`, low `0/0/0/false` and every `(tier, true)` at
  `0/0/0/false` while all previously pinned fields keep their accepted values; the exported-key
  list and per-tier constant assertions are updated. `createQualityPolicy` and all thresholds,
  stable-frame counts, cooldowns, hysteresis and recovery values are untouched (not in the diff).
  Evidence: `quality.test.ts` 24/24 green.
- **Integration tier exception:** T1 only adds inert constant tables and a pure matrix; there is
  no render/scene/network boundary to exercise until T3 wires the fields into `scene.ts`. The
  feature's integration proof is owned by T3's `scene-effects.test.ts` per `tasks.md`; T1 records
  this as the documented no-boundary exception.

Documentation: no user-facing behaviour or configuration changes at T1 (tokens/fields are inert
until T3), so no `README.md`, `docs/architecture/**` or `docs/features/README.md` edit is required
in this commit; the AC-10 README/index work is T3-owned.

Deviations from spec: none. The precondition's separate README freeze commit was unnecessary
because the index row was already committed and the index is clean (see Precondition).
