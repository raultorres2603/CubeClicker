# Build log — T2 — Render layer: flush mini-cube-built surface + directional world travel

Task: T2 (`cube-world-transition`, 2026-10-21)
Status: **BLOCKED** — the spec's pinned travel pose table contradicts its own (and the plan's, and the
task's) travel pose formula in exactly two cells per direction. No code was written and no feature
commit exists; the only change in this run is this log.

Files changed: `docs/features/cube-world-transition/build-log-T2.md` (this file). No source, test or
config file was modified; `git status --short src/frontend` is empty (see evidence 1).

## What blocks the task

`travelCameraPose` is pinned twice, with two different value sets:

1. **Formula** (spec § 3 "Flight", spec § Pinned constants "Travel camera", plan § Interfaces
   `travelCameraPose` comment, plan D-4, tasks.md T2):
   `x(p) = ox + dx · easeInOutQuad(p)`, `y(p) = oy + dy · easeInOutQuad(p)`,
   `z(p) = 12 + 78 · travelSwing(p)`, target `(x(p), y(p), 0)`.
2. **Table** (spec.md L92–95 "Pinned pose tables"; AC-3 "the pure `travelCameraPose` yields exactly
   the § 3 pose tables … at p ∈ {0, 0.25, 0.5, 0.75, 1} (positions and targets as exact literals)";
   tasks.md T2 "the `travelFrom` regression (… p = 0.75 pose still `(18, 0, 51)`)").

They disagree in **two cells** (the other eight cells agree exactly):

| Cell | Formula (with the shipped `easeInOutQuad` / `travelSwing`) | Spec § 3 table + tasks.md |
| --- | --- | --- |
| `p = 0.25`, `z` (all four directions) | `12 + 78 · travelSwing(0.25) = 12 + 78 · 0.5 = 51` | `21.75` (= `12 + 78 · 0.125`) |
| `p = 0.75`, lateral (all four directions) | `24 · easeInOutQuad(0.75) = 24 · 0.875 = 21` | `18` (= `24 · 0.75`) |

Recomputed from verbatim copies of `easeInOutQuad`/`travelSwing` as they exist in
`src/frontend/src/game/effects.ts` (evidence 2):

```
left   p=0: (0, 0, 12)   p=0.25: (-3, 0, 51)   p=0.5: (-12, 0, 90)   p=0.75: (-21, 0, 51)   p=1: (-24, 0, 12)
right  p=0: (0, 0, 12)   p=0.25: ( 3, 0, 51)   p=0.5: ( 12, 0, 90)   p=0.75: ( 21, 0, 51)   p=1: ( 24, 0, 12)
top    p=0: (0, 0, 12)   p=0.25: (0,  3, 51)   p=0.5: (0,  12, 90)   p=0.75: (0,  21, 51)   p=1: (0,  24, 12)
bottom p=0: (0, 0, 12)   p=0.25: (0, -3, 51)   p=0.5: (0, -12, 90)   p=0.75: (0, -21, 51)   p=1: (0, -24, 12)
intermediate: { eq025: 0.125, eq075: 0.875, sw025: 0.5, sw075: 0.5 }
```

Spec § 3 table (spec.md L92–95), for comparison: `p = 0.25` → `(±3, ±3, 21.75)`, `p = 0.75` →
`(±18, ±18, 51)`.

**No single implementation satisfies both.** The table is not reproducible by the pinned easings:

- the table's lateral column `0 / 0.125 / 0.5 / 0.75 / 1` is not symmetric (`L(0.25) = 0.125` while
  `1 − L(0.75) = 0.25`), so `easeInOutQuad(p)` (`0 / 0.125 / 0.5 / 0.875 / 1`) cannot produce `18` at
  `p = 0.75`; only an ad-hoc piecewise curve (`2p²` up to 0.5, then linear) would;
- the table's z swing column `0 / 0.125 / 1 / 0.5 / 0` is not the retained `travelSwing`
  (`0 / 0.5 / 1 / 0.5 / 0`) and is not symmetric, so the "retained z table … 12/21.75/51/80.25/90"
  (spec § 3, plan D-4, followup AC-3 retention) cannot produce `21.75` at `p = 0.25`.

Everything else in T2 (flush tiling, plate removal, `removeFace` disposal, picking multi-size,
`cubePosition`/pending-rebuild mechanics, the countdown, the reduced-motion instant swap, the
coverage/framing gates) is unambiguous and unaffected by the ruling; only `travelCameraPose` and the
pose literals it pins are blocked.

## Candidate answers

- **(a) Formula authoritative (recommended).** Keep `x = dx·easeInOutQuad(p)`, `z = 12 + 78·travelSwing(p)`.
  The § 3 table is corrected in r2 to `p = 0.25 → (3, 0, 51)` and `p = 0.75 → (21, 0, 51)` (mirrored for
  `left`/`top`/`bottom`), and tasks.md T2's `(18, 0, 51)` becomes `(21, 0, 51)`. This preserves the
  retained symmetric swing, the followup's z table retention, D-4's rationale and the starfield scale
  coupling (`z` and `scale` stay driven by the same `travelSwing`). The two bad cells look like a
  transcription of the old 9-row table (`21.75` is that table's `p = 0.125` row, and `21.75` is also
  the superseded predecessor AC-22 value at `p = 0.25`; `18` is the linear value).
- **(b) Table authoritative.** Then r2 must pin the actual easing functions instead of `easeInOutQuad`
  + `travelSwing` (e.g. lateral `2p²` for `p ≤ 0.5` then linear; z `(2p)³` for `p ≤ 0.5` then linear),
  accepting that the camera z no longer equals the retained `travelSwing` used by the starfield scale
  (`z = 12 + 78·S(p)` with `S ≠ travelSwing` breaks the "same value drives camera and backdrop"
  invariant documented in `game/effects.ts`), and update plan D-4 + the followup retention row.

Both are constant/table-only corrections in the artifacts — no scope, dependency or architecture change.

## Evidence

### 1. No source change in this run

```
$ git status --short src/frontend
(empty)
```

### 2. Formula vs table, recomputed with the shipped easing bodies

```
$ node -e '… verbatim easeInOutQuad/travelSwing from src/frontend/src/game/effects.ts …'
left   p=0: (0, 0, 12)  p=0.25: (-3, 0, 51)  p=0.5: (-12, 0, 90)  p=0.75: (-21, 0, 51)  p=1: (-24, 0, 12)
right  p=0: (0, 0, 12)  p=0.25: ( 3, 0, 51)  p=0.5: ( 12, 0, 90)  p=0.75: ( 21, 0, 51)  p=1: ( 24, 0, 12)
top    p=0: (0, 0, 12)  p=0.25: (0,  3, 51)  p=0.5: (0,  12, 90)  p=0.75: (0,  21, 51)  p=1: (0,  24, 12)
bottom p=0: (0, 0, 12)  p=0.25: (0, -3, 51)  p=0.5: (0, -12, 90)  p=0.75: (0, -21, 51)  p=1: (0, -24, 12)
intermediate: { eq025: 0.125, eq075: 0.875, sw025: 0.5, sw075: 0.5 }
```

### 3. The contradicting artifact lines

```
$ sed -n '84,86p;92,95p' docs/features/cube-world-transition/spec.md
- position: `x(p) = ox + dx · easeInOutQuad(p)`, `y(p) = oy + dy · easeInOutQuad(p)`, `z(p) = 12 + 78 · travelSwing(p)` …
| right | `(0, 0, 12)` → `(0,0,0)` | `(3, 0, 21.75)` → `(3,0,0)` | `(12, 0, 90)` → `(12,0,0)` | `(18, 0, 51)` → `(18,0,0)` | `(24, 0, 12)` → `(24,0,0)` |
| left | `(0, 0, 12)` | `(−3, 0, 21.75)` | `(−12, 0, 90)` | `(−18, 0, 51)` | `(−24, 0, 12)` |
| top | `(0, 0, 12)` | `(0, 3, 21.75)` | `(0, 12, 90)` | `(0, 18, 51)` | `(0, 24, 12)` |
| bottom | `(0, 0, 12)` | `(0, −3, 21.75)` | `(0, −12, 90)` | `(0, −18, 51)` | `(0, −24, 12)` |

$ sed -n '111,112p' docs/features/cube-world-transition/plan.md
/** Pure directional travel pose (spec AC-3): lateral easeInOutQuad toward the offset,
 *  z = 12 + 78·travelSwing(p); target = (x(p), y(p), 0) — identity quaternion at every p. */

$ grep -n "easeInOutQuad(clamp(p))" docs/features/cube-world-transition/tasks.md
45: … lateral `easeInOutQuad(clamp(p)) · offset`, `z = 12 + 78 · travelSwing(p)` … p = 0.75 pose still `(18, 0, 51)` …
```

### 4. Not run (blocked before implementation)

`npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`,
`npm run typecheck --workspace @cubeclicker/frontend`, `npm run lint` — no change to verify. The
pre-change baseline (T1's run) is 306 tests passing, coverage 99.32 / 99.37 / 100 / 99.32 in
`build-log-T1.md`.

## Acceptance audit

AC-2 → not started (unambiguous; ready to implement). AC-3 (scene parts) → **blocked** on the pose
table/formula contradiction above. AC-4 (partial, render-side retention) → not started.

## Deviations from spec

None (nothing was implemented, so nothing deviates). The blocker is a defect in the spec/plan/task
text, reported rather than resolved unilaterally.
