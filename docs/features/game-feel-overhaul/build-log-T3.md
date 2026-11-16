# Build log — T3 — Reveal React component

Task: T3 (2026-11-16)
Branch: `feat/game-feel-overhaul` (T1 `4421351`, T4 `f01c8b0`, T2 `cfb7d96`; T3 sits on
`cfb7d96`). Not pushed.
Files changed:
- `src/frontend/src/ui/LootboxReveal.tsx` (new — reveal component)
- `src/frontend/src/ui/LootboxReveal.test.tsx` (new — 39 component tests)
- `docs/features/game-feel-overhaul/build-log-T3.md` (this file)

## What changed & why

1. New `ui/LootboxReveal.tsx` owns the reveal's browser boundary: one `WebGLRenderer`, one
   resized stage canvas, one 30 fps `requestAnimationFrame` loop (hidden-tab pause), one
   `ResizeObserver` and the Escape/Dismiss/Equip/focus behaviour; everything is disposed on
   sequence replacement and unmount (stage → renderer).
2. The DOM contract is the AC-7 root (`role="group" aria-live="off"`, catalog label, phase)
   with exactly one `.lootbox-stage`, one `.lootbox-reveal-card` and the readable card texts;
   the wire `slot` is never trusted or displayed.
3. `phase === 'idle'` maps to `charge` (or `rest` under reduced motion), so
   `data-reveal-phase` is never `idle`.
4. An unknown part is sanitised at render time (fixed `unknown`/`""`/`0` values,
   `Unknown part`, no stage, no raw server string); a renderer/stage throw switches the stage
   to the inline-SVG fallback while keeping the full card and controls.
5. Tests use two injected seams (`createRenderer`, `createStage`) plus a manual rAF
   scheduler, so no real WebGL context and no wall-clock timing are needed.

## DOM contract as implemented (AC-7)

Valid grant (test default `wing-left-silver`, wire `slot: 'wing-left'`, 2 owned):

```html
<div class="lootbox-reveal" role="group" aria-live="off"
     aria-label="Lootbox reveal: Port Silver Wing"
     data-reveal-active="true" data-reveal-phase="rest" data-reveal-sequence="1"
     data-part-id="wing-left-silver" data-slot="wing-left" data-rarity="rare"
     data-duplicate="false" data-owned-count="2" data-reveal-3d="ready"
     data-reduced-motion="false">
  <div class="lootbox-stage" data-reveal-stage="true">
    <canvas class="lootbox-stage-canvas" aria-hidden="true"></canvas>
    <span class="lootbox-flash" data-reveal-flash="true" aria-hidden="true"></span>
  </div>
  <div class="lootbox-reveal-card" data-reveal-card="true">
    <p class="lootbox-reveal-rarity">Rare</p>
    <p class="lootbox-reveal-part">Port Silver Wing</p>
    <p class="lootbox-reveal-slot">Port Wing</p>
    <p class="lootbox-reveal-duplicate">New</p>
    <p class="lootbox-reveal-owned">Owned ×2</p>
    <div class="lootbox-reveal-actions">
      <button class="customization-reveal-equip" aria-label="Equip Port Silver Wing">Equip</button>
      <button class="customization-reveal-dismiss" aria-label="Dismiss lootbox reveal">Dismiss</button>
    </div>
  </div>
</div>
```

The test pins the **complete** attribute map with `toEqual` (no extra/omitted attribute), so
the wire value can never ride along. Epic duplicate + already equipped:
`data-rarity="epic"`, `data-duplicate="true"`, `data-owned-count="5"`, texts
`Epic` / `Gold Hull` / `Hull` / `Duplicate` / `Owned ×5`, and the Equip control renders
`Equipped` + `disabled` with no `aria-label` (accessible name `Equipped`), so focus goes to
`Dismiss`.

Sanitisation (unknown part `mystery-part`, wire `warp-core`, sequence 7):

```html
data-part-id="unknown" data-slot="" data-owned-count="0"
data-reveal-3d="unavailable" aria-label="Lootbox reveal: Unknown part"
<!-- card text: Unknown part; no .lootbox-stage, no <canvas>, no fallback svg -->
```

The test scans every attribute value and text node and asserts neither `mystery-part` nor
`warp-core` appears; `createRenderer`/`createStage` are asserted not called.

Phase evidence (table in `LootboxReveal.test.tsx`):

| `phase` prop | `data-reveal-phase` |
| --- | --- |
| `idle` | `charge` (and `rest` when `reducedMotion`; SSR-checked before any effect) |
| `charge` / `orb` / `flash` / `reveal` / `settle` / `rest` | same value |

A live phase change updates the attribute without a second renderer/stage/rAF call.

## Focus, dismissal and timing evidence (AC-8/AC-9)

- Mount focus → `document.activeElement === button[aria-label="Equip Port Silver Wing"]`;
  a new `sequence` refocuses Equip and disposes the previous stage/renderer exactly once
  (asserted `disposeCalls() === 1`, old `cancelAnimationFrame`).
- `Escape` on the focused Equip calls `onDismiss` exactly once; `Enter` does not dismiss.
- `Dismiss` click → `onDismiss` once.
- `Equip` click → `onEquip('wing-left-silver')` then `onDismiss`, in that order (shared call
  log `['equip:wing-left-silver', 'dismiss']`).
- `vi.useFakeTimers({ toFake: ['setTimeout', …] })` advanced 10,000 ms: reveal still mounted,
  `onDismiss` not called (no auto-dismiss timer exists).
- Reduced motion (`phase="idle"`): `data-reduced-motion="true"`,
  `data-reveal-phase="rest"`, exactly one `stage.update(0, true)` + one `renderer.render(...)`
  (`scene`/`camera` identity asserted), `requestAnimationFrame` never called, no
  `[data-reveal-flash]`, card present.

## Loop, context, fallback and disposal evidence (AC-10/AC-12)

- 30 fps cap: frames at 0/16/34/1000 ms → `stage.update` calls `[[0,false],[34,false],[1000,false]]`
  and three renders; the real-scene integration test reads the exact pure-pose yaw for
  elapsed 34 (`revealStagePose(34, 'wing-left', false, …).yawRad`) out of the rendered model.
- Hidden tab: `visibilitychange` cancels the pending frame (no spinning), hidden frames render
  nothing, a visible tab resets the baseline and schedules exactly one frame; elapsed is
  measured from the first rendered frame.
- One context: exactly one `createRenderer` + one `createStage` per sequence, one `<canvas>`;
  unmount cancels the frame, removes the listener, disconnects the observer (asserted once),
  disposes stage then renderer exactly once; post-unmount `visibilitychange` schedules nothing.
- Renderer throw → `data-reveal-3d="unavailable"`, one inline
  `<svg class="lootbox-fallback-ship" data-fallback-ship="true" data-slot="wing-left"
  aria-hidden="true" focusable="false" viewBox="0 0 120 72">`, full card/controls, no
  canvas/stage, `createStage` not called, no rAF.
- Stage throw → same fallback plus the created renderer disposed exactly once.
- Real `WebGLRenderer` in jsdom (no context) → fallback, no canvas, no rAF (the production
  default factory is exercised, not just the seam).
- The fallback has no `<img>`/`<image>`/`<use>`, no `url(`, no `http`, no
  `dangerouslySetInnerHTML`; it is inline polygons only.
- `src/App.tsx` is asserted to import `DeferredSpaceshipCustomizationPanel` and **not**
  `./ui/LootboxReveal`, `./ui/SpaceshipCustomizationPanel` or `./render/lootbox-reveal`
  (chunk guard).

## Decisions

1. **Invalid part renders no stage element at all.** AC-10 says an invalid part renders the
   card "and no fallback stage"; rendering an empty `.lootbox-stage` would leave a hole and
   claim a stage that cannot exist. `.lootbox-stage`/`[data-reveal-stage]` are therefore
   present exactly once for valid grants and absent for sanitised ones (pinned by test).
2. **Optimistic `data-reveal-3d="ready"` at first render.** A valid grant renders the canvas
   and `ready` immediately; a construction throw flips the same grant to `unavailable` and
   the fallback. Effects run post-paint, so no user-visible "live canvas" is claimed after a
   failure; SSR/static markup stays consistent (`ready` for valid, `unavailable` for
   invalid).
3. **Focus target = Equip, or Dismiss when Equip is disabled** (already equipped or unknown
   part). The focus effect depends on `sequence`/slot/equipped state, so a new grant always
   lands on the primary action.
4. **Escape is root-scoped** (`onKeyDown` bubbles from the focused Equip/Dismiss). The reveal
   is non-modal and never installs a document-level key handler, so the game keeps its own
   keyboard behaviour; AC-8's Escape path is the focused reveal.
5. **Sequence-keyed single effect with a latest-props ref.** The panel re-normalizes
   `appearance`/`parts` on every render; depending on those objects would rebuild the context
   on every snapshot. The effect keys on `grant.sequence`/catalog slot and reads the latest
   values from a ref, so one context per grant and no churn.
6. **`idle` mapping is exactly the plan's formula** (`phase === 'idle' ? (reducedMotion ?
   'rest' : 'charge') : phase`); reduced motion never rewrites a phase the panel already
   chose.
7. **No CSS/App edits.** Classes (`lootbox-reveal`, `lootbox-stage`,
   `lootbox-reveal-card`, `customization-reveal-*`, `lootbox-flash`,
   `lootbox-fallback-ship`) are the ones T5 wires and T7 styles; `app.css`/`game-view.css`
   and `App.tsx` are untouched by this task.
8. **Test tiers.** The React render in jsdom with injected `createRenderer`/`createStage`
   (plus the real `createRevealStage` scene graph in the integration case) is this task's
   integration tier — it crosses the component/WebGL/DOM boundary. The pure-pose unit tier is
   T1's `reveal-motion.test.ts` and the stage factory's unit tier is T2's
   `lootbox-reveal.test.ts`; T3 adds no other pure module, so there is no separate unit file
   to duplicate them.

## Verification evidence

All commands run from the repository root on `feat/game-feel-overhaul` at
`cfb7d96` + the two new files.

### `npm run lint` → exit 0

```text

> lint
> eslint .

```

### `npm run typecheck` → exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

### `npm test --workspace @cubeclicker/frontend` → exit 0

```text

 ✓ src/App.test.tsx (50 tests) 1021ms

 Test Files  77 passed (77)
      Tests  2370 passed (2370)
   Start at  16:30:53
   Duration  3.58s (transform 9.34s, setup 0ms, collect 24.20s, tests 12.56s, environment 8.86s, prepare 6.90s)
```

`src/ui/LootboxReveal.test.tsx` alone: **39 tests passed** (verbose run lists every AC-7/
AC-8/AC-9/AC-10/AC-12 case; see the per-case names quoted in the sections above).

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.73 |    96.35 |   97.87 |   96.73 |
  ...boxReveal.tsx |   98.24 |    94.84 |     100 |   98.24 | 152-153,273-274
-------------------|---------|----------|---------|---------|-------------------
```

Thresholds (80 statements/branches/functions/lines) pass; no coverage exclusion or threshold
change was made. The two uncovered snippets are defensive guards only: the `canvas === null`
early return (the canvas is always mounted for a valid grant) and the `handleEquip` guard
(the Equip button is `disabled` in those states, so a browser never dispatches the click).

### `git diff --check` → exit 0

```text
(no output)
```

## Acceptance audit

- **AC-7 — Reveal DOM and card contract → met.** Complete root attribute map asserted with
  `toEqual` (role/group, `aria-live="off"`, exact label, phase/sequence/part/slot/rarity/
  duplicate/owned/3d/reduced-motion); one `.lootbox-stage[data-reveal-stage]`, one
  `.lootbox-reveal-card[data-reveal-card]`; exact `Rare`/`Epic`, catalog part name, catalog
  slot display name, `New`/`Duplicate`, `Owned ×N`; Equip accessible name
  `Equip <part name>` (or `Equipped` + disabled); Dismiss name `Dismiss lootbox reveal`;
  phase never `idle`; catalog slot wins over missing/mismatched/unknown wire slot and the raw
  value appears in no attribute/text; unknown part → `unknown`/`""`/`0`/`unavailable`/
  `Unknown part` with no raw server string; canvas `aria-hidden="true"`; no live region,
  `role="status"`, `role="alert"` or `aria-modal`.
- **AC-8 — Dismiss and equip behaviour → met.** Mount/new-sequence focus on Equip (Dismiss
  when disabled); Escape once; Dismiss once; Equip → `onEquip(partId)` then `onDismiss` once
  each; 10,000 ms of fake timers leaves the reveal mounted. In-panel focus restoration to
  `Open lootbox` is the panel's job (T5) and is not claimed here.
- **AC-9 — Reduced motion → met.** SSR first render with `phase="idle"` is
  `data-reduced-motion="true"` + `data-reveal-phase="rest"`; live mount renders exactly one
  frame (`update(0, true)`, one render), schedules no frame, has no `.lootbox-flash` and the
  card is immediately present; `idle` maps to `rest`/`charge` per the pinned formula.
- **AC-10 — WebGL-unavailable fallback → met.** Renderer throw, stage throw and the real
  jsdom `WebGLRenderer` failure all produce `data-reveal-3d="unavailable"`, one inline fallback
  SVG with the catalog-derived `data-slot` (`wing-left` even when the wire slot is `hull`),
  the full card/controls, no error escaping, and a disposed created renderer; invalid part
  renders the sanitised card with no fallback stage.
- **AC-12 — One context, deferred chunk and budget → met (component tier).** One
  renderer/stage/canvas per sequence, 30 fps cap, hidden-tab pause, dispose-once on
  replacement and unmount; `App.tsx` does not import the component or the stage module (the
  panel remains the deferred chunk). The full bundle/deferred-chunk byte evidence is T11's.
- **AC-31 — Accessibility (component tier) → met.** Non-modal `role="group" aria-live="off"`,
  no scrim/focus trap/`aria-modal`, decorative canvas/flash/fallback are `aria-hidden`,
  native buttons with concrete accessible names and visible focus (focus ring/44 px are T6/T7
  CSS).

## Deviations from spec

None. Interpretation recorded in Decisions 1 (invalid grant → no stage element) and 4
(root-scoped Escape for a non-modal reveal). No out-of-scope file was edited: `App.tsx`,
`app.css`, `game-view.css`, `SpaceshipCustomizationPanel.tsx` and its tests are untouched;
the component is not yet wired into the panel (T5) or styled (T7).
