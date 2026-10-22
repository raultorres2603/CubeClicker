---
feature: cube-tile-lines-and-controls
revision: 1
---

# Plan — Cube Tile Lines and Controls (seamed mini-cube surface, no pointer rotation, WASD + arrow rotation)

## Architecture

No new modules. Three surgical edits across the existing render / session / input / UI layers:

- **Render (seams).** The seam is *emergent*: `render/cube-view.ts` re-pins `MINI_CUBE_TILE_RATIO` 1 → 0.95. Everything else in the module (basis math, instance encoding, pop records, removal, disposal) is untouched — the tile matrices scale by `0.95 × cell` and the existing body (a `CUBE_SIZE` box in `style.cubeColor`) becomes visible through every seam. No plates, no line geometry, no new objects (Q-1).
- **Session (pointer policy).** `game/session.ts` `dispatchGesture` drops the `playing` + `drag` branch (drags dispatch nothing). The intro/travel branches and the tap→pick→explode path are unchanged. The engine's `rotate` event survives — the keyboard drives it now.
- **Input (keyboard).** `input/keyboard.ts` adds the four WASD rows to `PLAYING_KEY_EVENTS` and case-folds single-character keys before lookup (arrow names matched exactly). `input/gestures.ts` is logic-unchanged; only its module doc comment is updated ("drag = one rotation step" → "drag = ignored by the session").
- **UI.** `ui/GameCanvas.tsx` swaps the pinned aria-label string; `App.tsx`/`Hud.tsx`/`theme.ts` untouched.

**State ownership (unchanged).** The engine still owns the board, orientation, stats and phase; the session still owns listeners and policy; the scene still owns three.js objects. Nothing in this feature changes where state lives — only which input maps to which event.

**Data flow (unchanged).** Pointer: `pointerdown/up` → `classifyPointer` (unchanged) → `dispatchGesture` (drags now dispatch nothing) → engine. Keys: `keydown` → `mapKey` (new rows + case-folding) → engine. Engine → snapshot/intents → scene/UI — untouched.

## Interfaces / contracts

- **`MINI_CUBE_TILE_RATIO`** (`render/cube-view.ts`, exported): `0.95`. Seam fraction = `1 − ratio` (derived; never a second constant). `tileSize = cellSize × MINI_CUBE_TILE_RATIO`; world seam = `cellSize × 0.05`; perimeter rim = half-seam.
- **`mapKey(key, phase)`** (`input/keyboard.ts`): unchanged signature `(string, Phase) → GameEvent | null`. New lookup rule: for `playing`, if the raw key is not in the table and is a single character, the lowercased form is looked up; arrow names are looked up raw and never case-folded.
- **`dispatchGesture(gesture)`** (`game/session.ts`): `playing` + `{ kind: 'drag' }` → return immediately (no dispatch, no publish). All other branches byte-identical.
- **`PointerGesture`** (`input/gestures.ts`): unchanged — `tap { ndcX, ndcY }` | `drag { axis, direction }` | `null`. The drag payload remains the retained classification contract (Q-3).
- **Pinned aria-label** (hardcoded in `GameCanvas.tsx`, asserted as a literal in tests): `Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube`.
- **Pinned key table** (playing):

| key | event |
| --- | --- |
| `w`/`W` | `{ type: 'rotate', axis: 'pitch', direction: 1 }` |
| `a`/`A` | `{ type: 'rotate', axis: 'yaw', direction: -1 }` |
| `s`/`S` | `{ type: 'rotate', axis: 'pitch', direction: -1 }` |
| `d`/`D` | `{ type: 'rotate', axis: 'yaw', direction: 1 }` |
| `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` | unchanged (yaw −1 / yaw +1 / pitch +1 / pitch −1) |
| `Enter`, `' '`, anything else | `null` |

- **Pinned geometry values** (f32-composed in tests via `Math.fround`):
  | N | tile edge (face axes) | seam | half-seam rim |
  | --- | --- | --- | --- |
  | 3 | `(5/3) × 0.95` | `1/12` | `1/24` |
  | 5 | `0.95` | `0.05` | `0.025` |
  | 7 | `(5/7) × 0.95` | `1/28` | `1/56` |

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/render/cube-view.ts` | Edit | `MINI_CUBE_TILE_RATIO` 1 → 0.95 + doc comment (seam rationale). No other logic change. |
| `src/frontend/src/render/cube-view.test.ts` | Edit | Ratio constant assertion; tile-extent and seam-separation re-pins at N = 3/5/7 (f32-composed); retained centre positions; child-list/body assertions; pop-on-inset-tile timeline. |
| `src/frontend/src/render/picking.test.ts` | Edit | Seam-miss case (tap at the pinned seam-midpoint NDC → `null`) on N = 5; centre-hit cases retained/added for N = 3/5/7; module doc comment (flush → inset). `picking.ts` untouched. |
| `src/frontend/src/render/scene.test.ts` | Edit | Pop-scale literals re-pinned to `Math.fround(0.95 × factor)` (idle `[Math.fround(0.95), Math.fround(0.95), 0.25]`); every retained group (travel, starfield, disposal, framing, reduced motion) unchanged. |
| `src/frontend/src/game/session.ts` | Edit | `dispatchGesture`: remove the `playing` + drag → `rotate` dispatch (drags dispatch nothing); doc comment updates. No other change. |
| `src/frontend/src/game/session.test.ts` | Edit | Pointer-policy groups reworked: `playing` drags → zero events on the recording engine + real-engine snapshot identity; retained tap/skip/travel groups; one tile-extent pop literal re-pinned to `Math.fround(0.95 × 1.016)`. |
| `src/frontend/src/input/gestures.ts` | Edit | Module doc comment only (drag = ignored by the session; classification contract retained). Logic and exports unchanged. |
| `src/frontend/src/input/keyboard.ts` | Edit | WASD rows + single-character case-folding; doc table update. |
| `src/frontend/src/input/keyboard.test.ts` | Edit | New table rows (incl. case-insensitivity), arrow-exactness (`ARROWLEFT`/`arrowleft` → `null`), Enter/Space still `null`, WASD-only six-face reachability; retained phase-policy and arrow groups. |
| `src/frontend/src/ui/GameCanvas.tsx` | Edit | Pinned aria-label string swap. |
| `src/frontend/src/ui/GameCanvas.test.tsx` | Edit | Label literal. |
| `src/frontend/src/App.test.tsx` | Edit | Label literal in the SSR markup assertion (test-only; no UI change). |
| `docs/product/glossary.md` | Edit | mini-cube wording: flush edge-to-edge → thin uniform seams (definition + example format; nothing else redefined). |
| `docs/features/cube-tile-lines-and-controls/build-log-T<id>.md` | New | Per-task raw evidence (transcripts, greps, numbers). |

Untouched by this feature (must show an empty git diff at the final gate): `game/{engine,rotation,board,progression,effects,types}.ts` and their tests, `render/{picking,starfield,particles}.ts` and `{starfield,particles}.test.ts`, `ui/Hud.tsx`, `ui/theme.ts`, `App.tsx`, `main.tsx`, `ws/**`, backend, container, config files, accepted-feature docs.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Seams via tile inset (`MINI_CUBE_TILE_RATIO = 0.95`), body shows through | Zero new objects/materials; AC-16 ceilings hold verbatim; one constant; the body is already the defined dark interior | Grid-line geometry (`LineSegments`): new drawable type + material, ceiling supersession, per-face rebuild/disposal on face removal/level change — rejected (Q-1) |
| D-2 | Ratio `0.95` (5% seam) | Middle of the requested 0.94–0.96 band; clearly visible at N = 5 (0.05 units); hit area per tile drops ~9.75% with centres unchanged — negligible for fast clicking | 0.94 / 0.96 / any band value — constant-only tuning (Q-2) |
| D-3 | Session owns the drag policy (drags dispatch nothing); `gestures.ts` classification unchanged | Minimal diff; the threshold/boundary/dominant-axis contract is a pinned accepted behavior (AC-6) retained verbatim; the classified drag payload stays as the future-pointer seam | Deleting the axis/direction fields: churns tested classification logic for no behavioral gain (Q-3) |
| D-4 | WASD = same directions as the arrows (W/A/S/D → up/left/down/right), case-insensitive | Matches the removed cursor's WASD directions and the arrows — one muscle memory; case-folding single characters keeps `ARROWLEFT` → `null` | W/S = yaw, A/D = pitch (breaks consistency); both-case table rows (8 entries, less general) (Q-4) |
| D-5 | Case-folding rule: single-character keys lowercased; arrow names exact | The accepted arrow-exactness tests (`ARROWLEFT`/`arrowleft` → `null`) keep passing unchanged | Case-fold everything (would break the accepted arrow contract) |
| D-6 | Engine untouched; `rotate` event now keyboard-only | The user asked to remove pointer rotation, not to change rotation itself; the queue/settle machine and auto-rotation stay as accepted | Engine-side gating of pointer rotation (more invasive, same observable result) |
| D-7 | Seam width = constant ratio (scales with cell) | Uniform appearance across N with one constant | Fixed world-unit seam (N-dependent ratio — per-level constants, rejected; Q-6) |

## Risks & mitigations

- **f32 rounding in extent literals** → every matrix value is pinned as `Math.fround(composed double)` (the predecessor's pattern: e.g. `Math.fround((5/7) × 0.95)`), never as a rounded literal.
- **Seam taps miss (dead clicks)** → seams are ≤ 8.3% of the cell (0.0833 units at N = 3); tile centres are unchanged, so centre-aimed rapid clicks never miss; the miss is pinned as the tested behavior (picking seam-miss → `null`).
- **Fast-click misclassification** → threshold retained inclusive (40 px = tap); per-gesture reset retained; nothing in the classification changes — the boundary tests (39/40/41) keep passing unmodified.
- **Keyboard auto-repeat floods rotate** → the engine's queue (≤ 1 queued step) is unchanged; no new deduplication (Q-5).
- **Stale docs after the policy change** → `gestures.ts` doc comment updated in the same task as the session change (T1); `keyboard.ts` doc table updated in T2.
- **Mid-chain honesty** → each task's own tree stays green: T1 updates the session tests in the same task as the session change and re-pins the one tile-extent literal the ratio change breaks; T2 touches no file T1 owns, so both tasks are independent (see tasks.md).
- **Test-literal sprawl** → the affected literals are enumerated: `scene.test.ts` (idle scale, t = 50 pop scale, neighbour idle scale — lines ~1343/1347/1367/1451), `session.test.ts` (pop element at 16 ms — line ~696), `cube-view.test.ts` (extent/axis groups), plus the two aria-label literals.

## Open questions

- Mirrors spec § Open questions (Q-1 seam mechanism, Q-2 ratio, Q-3 drag treatment, Q-4 WASD mapping, Q-5 key repeat, Q-6 seam constancy). The user checkpoint carries Q-1…Q-4; all recommended defaults are safe to build.
