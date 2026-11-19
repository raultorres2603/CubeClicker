# Build log — T17 — Documentation pass

Task: T17 (2026-11-19)
Files changed: `README.md`, `docs/architecture/realtime.md`, `docs/architecture/frontend-rendering.md`, `docs/architecture/observability.md`, `docs/product/glossary.md`, `docs/features/remote-spaceship-customization/build-log-T17.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `f277b67` — `docs: document remote ships and catalog v3` (not pushed; hash recorded in this follow-up `docs:` commit, mirroring T1/T2/T5/T6/T12/T13/T15/T16)

## Sketch (≤5 lines)

- README: rewrite the hangar/customization paragraph to six tabs, 244/120 totals, the form and
  finish picker, the 1,351-part catalog and the remote ship, with the exact AC-34 phrases and no
  stale five-tab/`n/4` text.
- `realtime.md`: add `## Public appearance projection` (optional field + normalization,
  `memberAppearance`/`setAppearance`, authority matrix, bounds, 10/s window, loss tolerance,
  metrics).
- `frontend-rendering.md`: add `## Remote ships` (spectated-only visibility + camera geometry,
  anchor/scale, idle/firing/reduced motion, live re-skin, lazy manager, 182/246/358 idle and
  185/249/361 peak) and fix the stale five-tab/`appearanceToCursorShipParams` lines.
- `observability.md`: add the three allow-list values and the paragraph; `glossary.md`: add
  `remote ship`, `chassis form`, `finish`, `shot style` and update `appearance`, `part`,
  `hangar tab`, `part slot`.
- Run the T17 verify recipe, record raw greps, propose the feature-index row in this log, and
  commit only the six T17 paths.

## What changed & why

- **`README.md`.** The customization paragraph now describes the actual catalog and hangar: **1,351
  spaceship parts** across eleven part slots, ten generated chassis forms × twelve finishes, a
  `shot` slot with 120 generated **shot styles**, six tabs (`Frame`, `Front`, `Wings`, `Engines`,
  `Ignitions`, `Shots`), per-tab `owned/<total>` counts (**244** on each ship tab, **120** on
  `Shots`), and the **form and finish picker** (3 classic / 12 generated finish cells). It adds the
  **remote player spaceships** sentence (spectating shows the watched member's ship with their
  equipped parts, chassis form and shot style) and the guest-report rule. The stale `five
  part-group tabs`, `ten part slots` and `n/4` text is gone. The accepted phrases `granular
  spaceship parts`, `animated 3D lootbox reveal`, `Neon Forge HUD` and `detailed blue/orange hero
  spaceship` are unchanged. The game-view paragraph's tracer-bolt clause now says the pointer ship
  fires its equipped `shot style` (tracer bolt by default), because shot styles are shipped
  behaviour.
- **`docs/architecture/realtime.md`.** New `## Public appearance projection` section covers the
  optional `MemberState.appearance` (server always populates it; every client decode/copy path
  defaults a malformed/absent field to `{}` through `memberAppearanceOf`), the `memberAppearance`
  server frame and guest `setAppearance` frame, the account/guest authority matrix (accounts
  persisted and ownership-validated; guest reports structurally validated and catalog-normalized
  only), the 11-entry / 40-character / 700-byte bounds, the 10-per-1000 ms true trailing-window
  limit and its 950/1000 ms boundary, the per-member fan-out and reconnect/loss tolerance, and the
  encoded/frames-sent/received metrics allow-lists. It states explicitly that only equipped
  appearance is public — inventory counts, coins, upgrades and identity are not.
- **`docs/architecture/frontend-rendering.md`.** New `## Remote ships` section: spectated-only
  visibility with the camera-geometry rationale (≈ 8.95-unit half-width at the cube plane vs.
  `SLOT_SPACING = 24`), the `remote-ship` root anchor `(1.6, 2.8, 4.4)` at scale `1.2`, the
  `remote-ship-body` idle bob/sway/recoil hierarchy, firing derived from accepted removals (90 ms
  interval, two in flight, 120 ms recoil), reduced-motion flash, the lazy `remote-ships` manager and
  the measured budgets: accepted counts 135/146/210/322 return with no ship; the mounted ship adds
  **36 objects / 21 draws** → idle **182/246/358**; two bolts 184/248/360 (38/23); peak
  **185/249/361** objects, **39 objects / 24 draws**. The 185 spectating baseline is recorded. Two
  stale lines were corrected: the reveal now names `appearanceToShipParamsV3` (not
  `appearanceToCursorShipParams`) as the active mapping, and the tab-structure paragraph now names
  six tabs including `Shots`, two rows except one on `Shots`, and the form strip + 3/1/12-cell grid.
- **`docs/architecture/observability.md`.** `setAppearance` was added to the received `type`
  allow-list row, `memberAppearance` to the encoded row, and the allow-list paragraph now explains
  the received count (once per decoded frame, including a dropped report) and the encoded/frames-sent
  counts (once per broadcast / once per recipient).
- **`docs/product/glossary.md`.** Added `remote ship`, `chassis form`, `finish` and `shot style`.
  Updated `appearance` (public projection; privacy boundary), `part` (1,351 rows, 11 slots, 1,340
  lootable), `hangar tab` (six tabs, 244/120 badges, `owned/<total>`) and `part slot` (11 slots,
  `shot` has no mesh; 123/121 row counts).

## Decisions

1. **The ship delta is 36 objects, not 37.** The dispatch brief's "+37" is the superseded r2
   count (spec revision history explicitly replaces it with r3/N1). AC-22, AC-34, T12, T18 and this
   log use the measured **36 objects / 21 draws** at rest and **39 / 24** at peak; the idle fixture
   is 146 + 36 = 182 and the peak is 182 + 2 bolts + 1 muzzle = 185.
2. **No source/test/feature-artifact edits.** Only the five owned documentation files and this log
   are staged. `spec.md`, `plan.md`, `tasks.md`, `status.md` and `reviews/` are untouched, and no
   behavior, dependency, schema, compose or package file changed.
3. **README line 9 touched minimally.** The pointer-ship sentence now names the equipped shot style
   so the README does not imply only a tracer bolt exists; every accepted retained phrase stays
   verbatim.
4. **Glossary terms use the shipped numbers.** `part`/`part slot` use the 1,351/1,340/123/121
   counts; `hangar tab` uses the 244/120 lootable totals and the shipped
   `<Label>, <owned> of <total> parts owned` announcement; `finish` names the six rare/six epic
   entries and the 12-cell grid (1 classic cell on `shot`).
5. **The feature-index row is proposal-only.** `docs/features/README.md` was not edited; the proposed
   diff is below.

## Evidence

The recipe ran on the final documentation tree at `daf40e3` plus the five edited docs (the untracked
feature artifacts belong to the orchestrator). No code/test file is modified by T17.

### `npm run lint` — EXIT 0

```
> lint
> eslint .

EXIT:0
```

### `npm run typecheck` — EXIT 0

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT:0
```

### `npm test --workspace @cubeclicker/frontend` — EXIT 0

```
 Test Files  83 passed (83)
      Tests  2844 passed (2844)
   Start at  10:57:33
   Duration  4.37s (transform 9.75s, setup 0ms, collect 28.50s, tests 18.11s, environment 12.39s, prepare 7.58s)

EXIT:0
```

(`HTMLCanvasElement.getContext()` / `THREE.WebGLRenderer` stderr lines are the pre-existing jsdom
WebGL fallback noise from the UI suites; every file and test passes.)

### `npm run coverage --workspace @cubeclicker/frontend` — EXIT 0 (skill DoD gate, extra to the T17 recipe)

```
 Test Files  83 passed (83)
      Tests  2844 passed (2844)
All files          |   97.15 |    96.75 |   98.36 |   97.15 |

EXIT:0
```

Frontend coverage: statements 97.15 / branches 96.75 / functions 98.36 / lines 97.15, all four ≥ 80.
No coverage config, threshold or exclusion was changed.

### AC-34 greps — all EXIT 0

```
$ grep -F "remote player spaceships" README.md
Players earn points by clicking the cube ... The world also renders **remote player spaceships**: while spectating another member ...
EXIT:0
$ grep -F "1,351 spaceship parts" README.md
Players earn points by clicking the cube ... The catalog now holds **1,351 spaceship parts** across eleven **part slots** ...
EXIT:0
$ grep -F "form and finish picker" README.md
Players earn points by clicking the cube ... a **form and finish picker** narrows each row ...
EXIT:0
$ grep -F "shot styles" README.md
Players earn points by clicking the cube ... **shot styles** ... equipped **shot styles** ...
EXIT:0
$ grep -F "## Public appearance projection" docs/architecture/realtime.md
## Public appearance projection
EXIT:0
$ grep -F "## Remote ships" docs/architecture/frontend-rendering.md
## Remote ships
EXIT:0
$ grep -F "setAppearance" docs/architecture/observability.md
| `cubeclicker_ws_messages_received_total` | counter | `type`: ..., `unequipPart`, `setAppearance`, `ping`, ...
The received list also includes the guest `setAppearance` frame ...
EXIT:0
$ ! grep -E "five part-group tabs|ten part slots|n/4" README.md
EXIT:0
```

The four accepted retained phrases were also checked:

```
$ grep -qF "granular spaceship parts" README.md       → OK
$ grep -qF "animated 3D lootbox reveal" README.md     → OK
$ grep -qF "Neon Forge HUD" README.md                 → OK
$ grep -qF "detailed blue/orange hero spaceship" README.md → OK
```

### `git status --porcelain -- docs/features ':(exclude)docs/features/remote-spaceship-customization'` — EXIT 0, **not empty**

```
 M docs/features/README.md
 M docs/features/coin-economy/reviews/code-r2.md
 M docs/features/coin-economy/status.md
```

This is the task's one non-empty gate. The three paths were already modified before T17 started
(they are recorded as pre-existing dirty paths in `build-log-T6.md`, `build-log-T12.md` and
`build-log-T13.md`); their diffs are the `coin-economy` acceptance state and the
`docs/features/README.md` coin-economy row update, not T17 content. T17 did **not** edit any of
them: the T17 worktree diff contains only the five owned docs, and the commit stages only those five
files plus this log. Clearing the check requires the orchestrator/owner to commit its own
`coin-economy`/index changes; restoring or committing them here would be an out-of-scope edit. The
same check is reproduced in T18 with this note carried forward.

### Proposed `docs/features/README.md` row (proposal only — do not apply in T17)

```diff
@@ after the `hangar-tabs-and-menu-motion` row
 | hangar-tabs-and-menu-motion | Hangar Tabs & Menu Motion (tabbed spaceship hangar, glitch menu boot, screenshot polish) | accepted | 2026-11-17 |
+| remote-spaceship-customization | Remote Spaceship Customization (spectated remote ships + 1,351-part catalog) | code_review | 2026-11-19 |
```

The orchestrator owns the row and sets the final state/date when it applies the index update on
acceptance.

### Link and whitespace checks

```
$ git diff --check -- README.md docs/architecture/realtime.md docs/architecture/frontend-rendering.md docs/architecture/observability.md docs/product/glossary.md
EXIT:0
```

All new relative links resolve: `../features/remote-spaceship-customization/spec.md` exists,
`../product/glossary.md#appearance`, `#remote-ship`, `realtime.md#public-appearance-projection` match
their headings.

## Acceptance audit

- **AC-34 — met (documentation scope).**
  - README exact phrases: all four greps exit 0 (`remote player spaceships`, `1,351 spaceship parts`,
    `form and finish picker`, `shot styles`); the stale-text grep (`five part-group tabs`, `ten part
    slots`, `n/4`) is empty; the four retained phrases are present.
  - Six-tab/244/120 contract: the paragraph names `Frame`, `Front`, `Wings`, `Engines`, `Ignitions`
    and `Shots`, the eleven slots, the `owned/<total>` counts (244 / 120) and the form + finish
    picker.
  - `docs/architecture/realtime.md` has `## Public appearance projection` with the optional field
    and `memberAppearanceOf` normalization, both frames, the authority matrix, the 11/40/700 bounds,
    the 10/s true window, loss tolerance and the three metrics allow-list values.
  - `docs/architecture/frontend-rendering.md` has `## Remote ships` with the spectated-only rule and
    camera rationale, anchor/scale and hierarchy, idle/firing/recoil, reduced motion, live re-skin,
    the lazy manager and the measured fixtures: idle **182/246/358** (36 added objects / 21 draws),
    two bolts **184/248/360** (38/23) and peak **185/249/361** (39 / 24), plus the 185 spectating
    baseline. The stale five-tab and `appearanceToCursorShipParams` lines are fixed.
  - `docs/architecture/observability.md` rows and paragraph include `setAppearance` in
    `cubeclicker_ws_messages_received_total` and `memberAppearance` in
    `cubeclicker_ws_messages_encoded_total` / `cubeclicker_ws_frames_sent_total`.
  - `docs/product/glossary.md` adds `remote ship`, `chassis form`, `finish`, `shot style` and
    updates `appearance`, `part`, `hangar tab` and `part slot`.
  - `docs/features/README.md` was not edited; the proposed row is in this log. The status command is
    non-empty only because of the pre-existing orchestrator/coin-economy edits described above.
- **AC-32/AC-33** are T18's full-suite gates; this task adds the frontend test/coverage evidence
  above and changes no production code.
- **AC-35/AC-36** are unaffected: no container, schema, migration, package or lockfile file changed.

## Deviations from spec

- **Task wording vs. measured count.** The dispatch brief says "+37 objects"; the authoritative
  spec (revision 3, AC-22/AC-34) and T12/T18 say **36 objects / 21 draws** at rest. The r2 "+37" is
  explicitly superseded in the spec revision history. The docs use 36.
- **`docs/features/README.md` status gate.** The command is not empty because three unrelated paths
  were already modified before T17. T17 did not touch them (see § Evidence); this is recorded for
  T18/the orchestrator rather than "fixed" by staging files outside the task's ownership.
- No other deviation. No source, test, feature artifact, container, package or `.env*` change; no new
  dependency.
