# Build log — T12 — Emerald default cube palette

Task: T12 (2026-11-07)
Files changed: `src/frontend/src/game/progression.ts`, `src/frontend/src/game/progression.test.ts`, `src/frontend/src/render/world.test.ts`

## Sketch

1. Replace only the `CUBE_STYLES[0]` literal in `progression.ts` with the AC-13 emerald values (`id` kept as `obsidian-neon`).
2. Update the exact style-list expectation in `progression.test.ts` (ids/order and `currentStyle` assertions already reference `CUBE_STYLES` and stay unchanged).
3. Update the three style-0 literals in `world.test.ts` (`0b0b12` → `0a2418`, `1de9b6` → `2ee27f`, unknown-style fallback `0a2418`) and the fallback test name.
4. Run lint, typecheck, frontend tests and frontend coverage; record the known-red integration files owned by T8/T13/T11.

## What changed & why

- `CUBE_STYLES[0]` is now exactly `{ id: 'obsidian-neon', name: 'Emerald Neon', cubeColor: '#0a2418', miniCubeColor: '#2ee27f', accentColor: '#b6ffd9', metalness: 0.3, roughness: 0.18 }` (AC-13). The wire id is unchanged; styles 1–4 and the list order are byte-identical.
- `progression.test.ts` pins the new exact first-style object inside the full five-style `toEqual` list; the separate id-order assertion and `currentStyle`/cycling tests are untouched.
- `world.test.ts` style-0 body/tile colour assertions and the unknown-style fallback literal now expect the emerald values; the fallback test name mentions the emerald first style.

## Decisions

- No new assertions were added: the change is a pinned-data update, and the existing exact-list/currentStyle/world-view assertions already fail on any regression. No backend `CUBE_STYLE_IDS`, protocol or gameplay logic touched.
- `cube-view.test.ts` and `scene.test.ts` intentionally left untouched (T13/T11 own their palette literals); their failures below are the expected integration gaps until those tasks run.

## Evidence

### `npm run lint` (root)

```
> lint
> eslint .

```
exit 0.

### `npm run typecheck` (root)

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```
exit 0.

### Owned tests — `npx vitest run src/game/progression.test.ts src/render/world.test.ts` (in `src/frontend`)

```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/progression.test.ts (21 tests) 7ms
 ✓ src/render/world.test.ts (27 tests) 34ms

 Test Files  2 passed (2)
      Tests  48 passed (48)
```
exit 0.

### `npm test --workspace @cubeclicker/frontend` (full frontend suite)

```
 FAIL  src/App.test.tsx > App > renders the travel phase copy in the same single live region
 FAIL  src/App.test.tsx > App > announces a spectate flight with the target member name (AC-17)
 FAIL  src/App.test.tsx > App > announces the return flight with the pinned copy (AC-18)
 FAIL  src/App.test.tsx > App > renders the playing phase with an empty live region that is still present
 FAIL  src/App.test.tsx > App > binds the HUD to the engine snapshot and the server id to the multiplayer store (AC-11, AC-23)
 FAIL  src/App.test.tsx > App > renders Return to my cube in the shell exactly while spectating (AC-18)
 FAIL  src/App.test.tsx > App > renders the pinned banner copy per transport status (AC-22)
 FAIL  src/render/cube-view.test.ts > createCubeView > takes the pinned colours and PBR values from the style (body = dark interior)
 FAIL  src/render/cube-view.test.ts > applyStyle > leaves a removed face untouched
 FAIL  src/render/scene.test.ts > intent application > exposes the live cube view through the rebuild-aware accessor (AC-16)
 Test Files  3 failed | 49 passed (52)
      Tests  10 failed | 1279 passed (1289)
```
exit 1. Every failure is in a file not owned by T12 and pinned to the old template, so only these three known-red integration files fail:

- `App.test.tsx` (7 failures) — full-shell string goldens still pin the pre-T4/T5/T6/T8 markup; T8 owns the shell golden update.
- `cube-view.test.ts` (2 failures) — still pins `0b0b12`/`1de9b6`/`0.6`/`0.35`; T13 owns those lines.
  - `expected '0a2418' to be '0b0b12'` at `cube-view.test.ts:321`
  - `expected '2ee27f' to be '1de9b6'` at `cube-view.test.ts:855`
- `scene.test.ts` (1 failure) — still pins `0b0b12`; T11 owns the two style-0 literals at `scene.test.ts:1596/1623`.
  - `expected '0a2418' to be '0b0b12'` at `scene.test.ts:1596`

All other 49 test files (1279 tests) pass, including `progression.test.ts` and `world.test.ts`.

### `npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure`

The aggregate table is produced despite the known-red tests:

```
 Test Files  3 failed | 49 passed (52)
      Tests  10 failed | 1279 passed (1289)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.28 |    95.01 |   96.13 |   95.28 |
```
No threshold error is emitted; exit 1 comes from the three known-red test files.

### Coverage gate green with only the known-red integration files excluded

`npx vitest run --coverage --exclude src/App.test.tsx --exclude src/render/cube-view.test.ts --exclude src/render/scene.test.ts` (in `src/frontend`):

```
 Test Files  49 passed (49)
      Tests  1156 passed (1156)
All files          |   89.14 |    92.71 |   95.52 |   89.14 |
EXIT:0
```

All four metrics are ≥ 80 (statements 89.14, branches 92.71, functions 95.52, lines 89.14) with zero failures once the three integration files owned by T8/T13/T11 are excluded.

## Acceptance audit

- AC-13 — met: `CUBE_STYLES[0]` has the exact pinned id/name/colours/materials (progression.test.ts exact-list assertion); styles 1–4 and id order unchanged (same test); backend `CUBE_STYLE_IDS` untouched and `world.test.ts` now passes against the new style-0 body/tile/fallback colours. The remaining AC-13 evidence files (`cube-view.test.ts`, `scene.test.ts`) are owned by T13/T11 per tasks.md and are expected red until those tasks run.

## Deviations from spec

None. No documentation edit was needed in this task (the palette contract is already recorded in `spec.md`/`plan.md`; the final documentation pass is T15). Other workers' files (e.g. `UpgradesPanel*`, `CustomizationToggle*`) were left untouched.
