# Build log — T2 — WASD + arrow keyboard rotation, canvas label

Task: T2 (2026-10-21) — `docs/features/cube-tile-lines-and-controls/tasks.md` § T2
Acceptance: AC-3, AC-4 (spec r1)

## Files changed

- `src/frontend/src/input/keyboard.ts` — four WASD rows in `PLAYING_KEY_EVENTS`; single-character case-folding in `mapKey`; doc phase-policy table updated.
- `src/frontend/src/input/keyboard.test.ts` — exact WASD table rows, case-insensitivity pins, arrow-exactness, Enter/space still `null`, WASD-only six-face reachability, WASD orientation counters; retained arrow/phase-policy/integration groups.
- `src/frontend/src/ui/GameCanvas.tsx` — pinned `aria-label` swapped.
- `src/frontend/src/ui/GameCanvas.test.tsx` — label literal swapped.
- `src/frontend/src/App.test.tsx` — SSR markup label literal swapped.

## What changed & why (≤ 5 lines)

1. The `playing` key table gains `w/a/s/d` → the same four rotation steps as the arrows (W = up, A = left, S = down, D = right) so both key groups rotate.
2. `mapKey` looks the raw key up first; when absent **and** the key is a single character it retries the lowercased form — so `W`/`A`/`S`/`D` work without duplicate rows while named keys (`ARROWLEFT`, `arrowleft`) stay exactly matched and `null`.
3. `Enter`, space, `Escape` and unknown keys remain `null`; the intro any-key skip and the travel all-null policy are untouched (no keyboard cursor reintroduced).
4. A WASD-only six-face enumeration (front `[]`, left `[d]`, back `[d, d]`, right `[a]`, top `[w]`, bottom `[s]`) mirrors the retained arrows enumeration through the real engine, one settled step per press.
5. The canvas `aria-label` is now exactly `Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube` (production + both test literals); no other markup/copy changed.

## Decisions

- **Case-folding is a lookup rule, not table rows** (plan D-5, spec § 3): the table holds lowercase letters only; the fold is gated on `key.length === 1`, so arrow/`Enter`/space names can never be folded — the retained `ARROWLEFT`/`arrowleft` → `null` contract keeps passing verbatim.
- **Retained groups untouched** in intent and assertions: arrow table rows, intro any-key skip, travel all-null, the arrows six-face enumeration, and the exact arrows orientation counters (yaw 3/pitch 0 → 3/1 → 0/1 → 0/0).
- **`REMOVED_CURSOR_KEYS` reduced to `['Enter', ' ']`** — WASD are bound now (superseding cube-visual-polish AC-6's WASD-`null` clause), Enter/Space stay in the no-cursor group.
- **No new deps, no config change, no coverage exclusion**; the `mapKey(key, phase)` signature is unchanged so T1's session import is unaffected (parallel-safety).

## Evidence

### `npm test --workspace @cubeclicker/frontend`

```
 ✓ src/game/session.test.ts (23 tests) 61ms
 ✓ src/render/scene.test.ts (51 tests) 124ms

 Test Files  20 passed (20)
      Tests  333 passed (333)
EXIT=0
```

(T2-owned files included in the run: `src/input/keyboard.test.ts (13 tests)`, `src/ui/GameCanvas.test.tsx (2 tests)`, `src/App.test.tsx (4 tests)`.)

### `npm run coverage --workspace @cubeclicker/frontend`

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.33 |    99.41 |     100 |   99.33 |
 src/input       |     100 |      100 |     100 |     100 |
  keyboard.ts    |     100 |      100 |     100 |     100 |
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 | 23-30
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

Aggregate: **statements 99.33 / branches 99.41 / functions 100 / lines 99.33** — all four ≥ 80. `keyboard.ts` at 100 × 4. The known honest residuals (thin `GameCanvas.tsx` effect body, `ws/connection.ts` lines) are the pre-existing ones; no exclusion or threshold change.

### `npm run typecheck --workspace @cubeclicker/frontend`

```
> typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

### `npm run lint`

```
> lint
> eslint .
LINT_EXIT=0
```

### Pinned label — exactly one match per file

```
src/frontend/src/ui/GameCanvas.tsx:37:      aria-label="Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube"
src/frontend/src/ui/GameCanvas.test.tsx:14:  'Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube';
src/frontend/src/App.test.tsx:22:  'Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube';
LABEL_EXIT=0
per-file counts: GameCanvas.tsx: 1 | GameCanvas.test.tsx: 1 | App.test.tsx: 1
```

### Old label gone

```
$ grep -rn "drag or press" src/frontend/src
OLD_LABEL_EXIT=1 (1 = no matches)
```

### Banned-matcher grep over the changed test files

```
$ grep -nE "expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toBeTruthy|toBeDefined|not\.toThrow|toHaveBeenCalled\(\)|toBeCloseTo|expect\.closeTo" \
    src/frontend/src/input/keyboard.test.ts src/frontend/src/ui/GameCanvas.test.tsx src/frontend/src/App.test.tsx
BANNED_EXIT=1 (1 = no matches)
```

### Diff stat (files_owned only)

```
 src/frontend/src/App.test.tsx           |   2 +-
 src/frontend/src/input/keyboard.test.ts | 120 ++++++++++++++++++++++++++++++--
 src/frontend/src/input/keyboard.ts      |  37 ++++++++--
 src/frontend/src/ui/GameCanvas.test.tsx |   2 +-
 src/frontend/src/ui/GameCanvas.tsx      |   2 +-
 5 files changed, 146 insertions(+), 17 deletions(-)
```

## Acceptance audit

- **AC-3 — WASD + arrow keyboard rotation: met.**
  - Table: `keyboard.test.ts` § "maps W/A/S/D to the same four rotation steps, in either case" pins `w`/`W` → pitch +1, `a`/`A` → yaw −1, `s`/`S` → pitch −1, `d`/`D` → yaw +1; the arrow group with its four exact events is retained.
  - Case-insensitivity: the "folds single-character keys to lowercase…" group pins lower/upper to the identical concrete event, and pins `WASD` (multi-character) → `null`; arrow exactness `ARROWLEFT`/`arrowleft`/`Arrowleft`/`ARROWUP`/`arrowdown` → `null` in its own group.
  - Unbound/no cursor: `Enter`, `' '` (`REMOVED_CURSOR_KEYS`) → `null`; `Escape`, `q`, `p`, `e`, `wasd`, `Token`, `Tab`, `Shift`, `?`, `''` → `null`.
  - Phases: intro any-key → `introSkip` (11 keys incl. WASD/arrows/Enter/space) and travel all-null (15 keys) retained.
  - Six-face reachability: arrows group retained; WASD group front `[]`, left `[d]`, back `[d, d]`, right `[a]`, top `[w]`, bottom `[s]`, each asserting `frontFace`, `rotationFrom: null`, `rotationProgress: 1` after one settled 300 ms step per press. Orientation counters: arrows retained (3/0 → 3/1 → 0/1 → 0/0) and WASD added (`W` → 0/1, `a` → 3/1, `S` → 3/0, `d` → 0/0). The integration test also re-asserts that Enter/space dispatch nothing (snapshot identity + no intents) while `W` rotates through the real engine.
- **AC-4 — Canvas label + untouched accessibility surface: met.**
  - `GameCanvas.tsx` label is the exact pinned string; `GameCanvas.test.tsx` asserts the full SSR markup `<canvas tabindex="0" aria-label="…" style="touch-action:none"></canvas>`; `App.test.tsx` asserts the full shell markup with the same literal. The HUD, single live region, skip hint, `tabindex="0"`, `touch-action:none` assertions are unchanged and green; `Hud.test.tsx` untouched and green.

## Deviations from spec

None. Only `files_owned` paths changed; no dependency, config, threshold, or exclusion change; no `toBeCloseTo`; banned-exception budget stays 0.
