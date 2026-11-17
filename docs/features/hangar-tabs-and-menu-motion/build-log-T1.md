# Build log — T1 — Menu-motion tokens

Task: T1 (2026-11-17), feature `hangar-tabs-and-menu-motion`, branch
`feat/hangar-tabs-and-menu-motion` at `36de001`, parallel batch with T2.

Files changed (only `files_owned`):

- `src/frontend/src/game/motion.ts`
- `src/frontend/src/game/motion.test.ts`
- `docs/features/hangar-tabs-and-menu-motion/build-log-T1.md`

## What changed & why

1. Added exactly four additive tokens at the end of `MOTION`, under a
   `// Hangar tabs + menu boot (spec AC-11).` block: `menuBootMs: 320`,
   `menuFlickerMs: 120`, `menuChromaMs: 90`, `tabSwitchMs: 140`.
2. Extended the existing full-object `toEqual` pin in `motion.test.ts` with the same four
   keys, so every token (including singular/plural spellings such as `coinPopMs` vs
   `coinsPerPop`) still holds its pinned value.
3. Added one focused test that pins the four exact values and asserts the key count is
   exactly `96` (92 accepted + the 4 new), proving no key was removed, renamed or added
   alongside them.
4. No CSS in this task: the `main` `--motion-*` mirror is T4. No existing token value
   changed.

Exact token values (source of truth for T4's mirror):

| Token | Value | Mirror (T4) |
| --- | --- | --- |
| `menuBootMs` | `320` | `--motion-menu-boot-ms: 320ms` |
| `menuFlickerMs` | `120` | `--motion-menu-flicker-ms: 120ms` |
| `menuChromaMs` | `90` | `--motion-menu-chroma-ms: 90ms` |
| `tabSwitchMs` | `140` | `--motion-tab-switch-ms: 140ms` |

## Decisions

- **Append-only placement.** The four tokens are appended after `uiRevealSpotlightMs` with
  the pinned comment, matching the file's existing comment-block style
  (`// Game-feel overhaul: … (spec AC-32).`). `git diff` shows only added lines, so every
  accepted value is untouched by construction.
- **The full-object pin stays the value contract.** `expect(MOTION).toEqual({…})` already
  enumerates all 92 accepted tokens; extending it (rather than replacing it with spot
  checks) keeps the "no existing token changes value" half of AC-11 enforced.
- **Key count as the completeness guard.** `Object.keys(MOTION)).toHaveLength(96)` is a
  concrete-number assertion that fails on an added, removed or renamed token — the
  "gains exactly" half of AC-11 that `toEqual` cannot express by itself.
- **No integration tier in this task.** T1 is a data-only token addition with no
  boundary: the consumer is the CSS mirror/test pair owned by T4 (AC-11 second half) and
  the animation rules in T4's `game-view.css`. The documented exception applies: a pure
  constant table has no integration boundary until T4 wires it to CSS. T2's parallel work
  is unaffected (`game/motion*` and `ui/hangar-tabs*` are disjoint).

## Raw evidence

Exact source diff (`git diff -- src/frontend/src/game/motion.ts src/frontend/src/game/motion.test.ts`):

```diff
diff --git a/src/frontend/src/game/motion.test.ts b/src/frontend/src/game/motion.test.ts
@@ -109,6 +109,11 @@ describe('MOTION tokens (AC-34)', () => {
       uiButtonPressScale: 0.97,
       uiGlowPulseMs: 2400,
       uiRevealSpotlightMs: 260,
+      // Hangar tabs + menu boot (spec AC-11).
+      menuBootMs: 320,
+      menuFlickerMs: 120,
+      menuChromaMs: 90,
+      tabSwitchMs: 140,
     });
   });
 
@@ -129,6 +134,17 @@ describe('MOTION tokens (AC-34)', () => {
     expect(MOTION.uiRevealSpotlightMs).toBe(260);
   });
 
+  it('adds the four hangar-tab and menu-boot tokens with exact values (AC-11)', () => {
+    expect(MOTION.menuBootMs).toBe(320);
+    expect(MOTION.menuFlickerMs).toBe(120);
+    expect(MOTION.menuChromaMs).toBe(90);
+    expect(MOTION.tabSwitchMs).toBe(140);
+    // 92 accepted tokens + exactly the four additive menu-motion tokens: no key was
+    // removed, renamed or added alongside them (every value is pinned by the full-object
+    // `toEqual` above, which covers singular and plural spellings alike).
+    expect(Object.keys(MOTION)).toHaveLength(96);
+  });
+
   it('pins the destruction and shot headline sums', () => {
     expect(MOTION.impactFlashGrowMs).toBe(60);
     expect(MOTION.impactFlashMs).toBe(140);
diff --git a/src/frontend/src/game/motion.ts b/src/frontend/src/game/motion.ts
@@ -116,6 +116,11 @@ export const MOTION = {
   uiButtonPressScale: 0.97,
   uiGlowPulseMs: 2400,
   uiRevealSpotlightMs: 260,
+  // Hangar tabs + menu boot (spec AC-11).
+  menuBootMs: 320,
+  menuFlickerMs: 120,
+  menuChromaMs: 90,
+  tabSwitchMs: 140,
 } as const;
```

Token-count and append-only proof:

```text
$ git show HEAD:src/frontend/src/game/motion.ts | sed -n '/export const MOTION = {/,/} as const;/p' | grep -cE '^  [A-Za-z][A-Za-z0-9]*:'
92
$ sed -n '/export const MOTION = {/,/} as const;/p' src/frontend/src/game/motion.ts | grep -cE '^  [A-Za-z][A-Za-z0-9]*:'
96
$ git diff --numstat -- src/frontend/src/game/motion.ts src/frontend/src/game/motion.test.ts
16	0	src/frontend/src/game/motion.test.ts
5	0	src/frontend/src/game/motion.ts
$ git diff -U0 -- src/frontend/src/game/motion.ts | grep -E '^-[^-]' || echo '(none)'
(none)
```

Focused suite:

```text
$ npx vitest run src/game/motion.test.ts --root src/frontend
 ✓ src/game/motion.test.ts (14 tests) 8ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

```text
$ npm run lint

> lint
> eslint .
LINT_EXIT=0
```

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

```text
$ npm test --workspace @cubeclicker/frontend

 ✓ src/App.test.tsx (62 tests) 1241ms

 Test Files  78 passed (78)
      Tests  2440 passed (2440)
TEST_EXIT=0
```

```text
$ npm run coverage --workspace @cubeclicker/frontend

 Test Files  78 passed (78)
      Tests  2440 passed (2440)
 % Coverage report from v8
All files          |   96.84 |    96.51 |   98.04 |   96.84 |
COVERAGE_EXIT=0
```

Thresholds are the unchanged workspace 80/80/80/80; no exclusion or threshold edit.

```text
$ git diff --check
(no output)
DIFFCHECK_EXIT=0
```

## Assertion integrity

- Concrete assertions only: four `toBe(<exact number>)` pins plus one `toHaveLength(96)`.
  No `expect.anything()`/`expect.any()`, no `objectContaining`/`arrayContaining`/
  `stringContaining`, no `toMatchObject`, no snapshot, no argument-unchecked
  `toHaveBeenCalled()`, no `toBeTruthy`/`toBeDefined`/`not.toThrow` stand-ins. No bounded
  exception was needed (no float assertion added).
- No existing assertion was deleted or weakened: the changed test file shows `16 0`
  (added/deleted lines) and the new test is additive.
- No useless test: the new test fails if a token value drifts (spot pins), if a token is
  removed or renamed (`toEqual` key set) or if a fifth token is added (`toHaveLength(96)`).

## Acceptance audit

- **AC-11 (motion-token half) — met.** `MOTION` gains exactly `menuBootMs: 320`,
  `menuFlickerMs: 120`, `menuChromaMs: 90`, `tabSwitchMs: 140` (key count 92 → 96, all
  additions, no deletions) and no existing token changed value (the full-object `toEqual`
  pin over all 96 keys is green). The `game-view.css` `main` mirror half of AC-11 belongs
  to T4 (`--motion-menu-boot-ms`/`--motion-menu-flicker-ms`/`--motion-menu-chroma-ms`/
  `--motion-tab-switch-ms` mapped to these tokens) and is not applicable to this
  `files_owned` set; the exact values T4 must mirror are recorded in the table above.
- **AC-34 regression — met.** The pre-existing `MOTION` full pin and every easing/
  `clamp01` assertion still pass unchanged (14 tests in the focused suite).

## Deviations from spec

None. The only scope note is the documented integration-tier exception above (a pure
constant table has no boundary; T4 supplies the CSS consumer and its source-guard test).
