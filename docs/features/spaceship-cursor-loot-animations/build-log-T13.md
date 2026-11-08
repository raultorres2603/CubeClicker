# Build log — T13 — Documentation pass

Task: T13 (2026-11-08)

Files changed:
- `README.md`
- `docs/product/glossary.md`
- `docs/features/spaceship-cursor-loot-animations/build-log-T13.md` (this file)

Sketch:
- README gameplay: one lootbox = one specific part for one **part slot**; exact phrase
  `granular spaceship parts`; per-slot equip/unequip, asymmetric loadouts.
- README game view: keep `detailed blue/orange hero spaceship`; state the procedural/no-external-
  assets position; describe the detailed pointer ship and the shared motion language.
- Glossary: add `part slot`, `lootbox reveal`, `motion token`; rewrite `appearance`, `part` and
  `lootbox` from categories to slots.
- Verify: lint, feature-BASE index guard (read-only), five feature greps.
- No source/tests/CSS/config/container/spec/plan/tasks/status edits; propose the feature row.

What changed & why:
- `README.md` § Gameplay now records the shipped granular model: a lootbox opening draws one
  random part from the `granular spaceship parts` catalog for one `part slot` (port wing,
  cockpit, one ignition, etc.), never a matched set; the customization menu equips/unequips each
  slot independently, and the pointer ship shows asymmetric loadouts. The feature reference now
  names `spaceship-cursor-loot-animations` in addition to `spaceship-customization`.
- `README.md` § Game view now states the view is generated procedurally in code with no external
  models, textures, images, videos or other assets; preserves the exact accepted phrase
  `detailed blue/orange hero spaceship`; describes the procedural pointer ship (metallic hull,
  framed canopy, swept wings, twin engines, panel seams, flames, bank/pitch, fire trail, equip
  pulse) and the shared motion language (hover reticle, same-frame mini-cube conceal, rays/
  shards/coin popups, wireframe charge-orb lootbox reveal, full-screen level banner), including
  the automatic high/medium/low quality tier and the static/instant reduced-motion variants.
- `docs/product/glossary.md` adds `lootbox reveal` (after `lootbox`), `motion token` (after
  `mini-cube`) and `part slot` (after `part`), and updates `appearance`, `part` and `lootbox`
  from the legacy five categories (`nose`, `body`, `wings`, `cockpit`, `engine`) to the ten
  shipped slots with the 30-part catalog, 10 always-owned standard parts and 20 lootable
  rare/epic parts.
- `docs/features/README.md` was **not** edited; the proposed row is recorded below for the
  orchestrator.

Decisions:
- Kept the README at two paragraphs (gameplay and game view) rather than adding new sections;
  this matches the existing documentation structure and the minimal-diff practice in
  `docs/architecture/documentation.md`.
- Described only shipped behavior: the README motion sentence names the user-visible beats and
  the reduced/adaptive behavior, but does not expose implementation file names or token values.
- Used the shipped display names (`Port Wing`, `wing-left`, etc.) in glossary examples so the
  terminology matches the customization panel and the pinned part catalog.
- No `docs/architecture/**` change: the feature adds no service, image, port, environment
  variable, health signal or WebSocket endpoint change (AC-51 is T14's gate).
- No coverage command for this chore task (per T13 notes); `npm run lint` is the applicable gate.

Evidence:

### `npm run lint`

```text
$ npm run lint
> lint
> eslint .

LINT_EXIT=0
```

### Feature `BASE` and `docs/features/README.md` guard

```text
$ BASE=$(git merge-base main HEAD); echo "BASE=$BASE"
BASE=34df3d298948c232b575fc840f8f41e37f47162e

$ git diff --exit-code "$BASE"...HEAD -- docs/features/README.md
INDEX_DIFF_EXIT=0

$ test -z "$(git status --porcelain -- docs/features/README.md)"
INDEX_STATUS_EXIT=0

$ git status --porcelain -- docs/features/README.md
STATUS_OUTPUT_END
```

### Required greps

```text
$ grep -n "granular spaceship parts" README.md
7:Players earn points by clicking the cube and progress through cube levels. Completing a cube grants a **lootbox** and a **key**; opening a lootbox with a key draws one random part from the **granular spaceship parts** catalog — a single part for one **part slot** (for example the port wing, the cockpit or one ignition), not a whole matched set. The **Spaceship Customization** menu (appearance editor) shows a live 3D preview and lets players equip or unequip each slot independently; the in-game pointer ship reflects the equipped appearance, including asymmetric left/right loadouts. Appearance and inventory are persisted per **account**; **guests** keep an ephemeral copy for the session. (Features: `spaceship-customization`, see `docs/features/spaceship-customization/`; `spaceship-cursor-loot-animations`, see `docs/features/spaceship-cursor-loot-animations/`.)
GREP_EXIT=0

$ grep -n "detailed blue/orange hero spaceship" README.md
9:The game view is generated procedurally in code (no external models, textures, images, videos or other assets): a procedural nebula in purple/blue/pink with asteroids, meteors, an orange comet and a detailed blue/orange hero spaceship (layered hull, swept wings, twin glowing engines), an emerald beveled cube with golden spark bursts, and rounded translucent cyan HUD panels. The pointer-following spaceship cursor is also procedural — a small metallic craft with a framed canopy, swept wings, twin engines, panel seams and flames that banks and pitches as it follows the pointer, leaves a fire trail and pulses when its appearance changes. One motion language connects the loop: a hover reticle marks the target, a clicked mini-cube vanishes on the same frame, and rays, shards and coin popups burst out; lootbox opening uses a wireframe charge-orb reveal; level completion raises a full-screen banner. An automatic high/medium/low quality tier keeps the frame rate in budget, and reduced motion replaces each of these animations with a static or instant variant. (Features: `reference-image-game-view`, `detailed-hero-spaceship` and `spaceship-cursor-loot-animations`; see `docs/features/spaceship-cursor-loot-animations/`.)
GREP_EXIT=0

$ grep -n "part slot" docs/product/glossary.md
15:**Definition:** The equipped look of a player's spaceship, expressed as a map from **part slot** to a part id; a missing slot resolves to that slot's standard part. Slots are equipped and unequipped independently, so a loadout may be asymmetric (for example a silver port wing and a gold starboard wing). It is persisted per **account** in the `user_economy.appearance` column and broadcast to that account's joined connections; **guests** keep an ephemeral copy for the session. Changing appearance updates the live 3D preview and the in-game pointer ship.
70:**Definition:** A closed container earned by completing (destroying) a **cube**. A lootbox requires a **key** to open; opening consumes one of each and grants exactly one random lootable **part** for one **part slot** (75% rare, 25% epic). Lootboxes are persisted per **account** in the `user_economy.lootboxes` column; **guests** earn them for the session only.
75:**Definition:** The client-local panel animation that presents a lootbox opening to the connection that opened it: a 1290 ms sequence of 420 ms wireframe charge, 250 ms orb pulse with overshoot, 120 ms flash, 360 ms card reveal and 140 ms settle, followed by the granted **part**'s name, **part slot**, rarity (rare or epic) and new/duplicate status. The server remains authoritative and sends the grant plus the absolute inventory; other connections of the account receive the inventory update without replaying the reveal. Under reduced motion the settled result appears instantly.
95:**Definition:** A cosmetic spaceship component belonging to exactly one of the ten **part slots** (hull, nose, cockpit, wing-left, wing-right, engine-left, engine-right, ignition-left, ignition-right, tail-fin). The catalog has 30 parts — one standard, one rare and one epic part for every slot; the 10 standard parts are always owned and never looted, while the 20 rare/epic parts are granted one per **lootbox** opening. Parts can be equipped in the spaceship customization menu to change the ship's colours, accents and some shapes. Owned part counts are persisted per **account** in the `user_economy.parts` column.
98:### part slot
GREP_EXIT=0

$ grep -n "lootbox reveal" docs/product/glossary.md
73:### lootbox reveal
GREP_EXIT=0

$ grep -n "motion token" docs/product/glossary.md
83:### motion token
GREP_EXIT=0
```

### Scope and working tree

```text
$ git status --porcelain
 M README.md
 M docs/features/spaceship-cursor-loot-animations/plan.md
 M docs/features/spaceship-cursor-loot-animations/spec.md
 M docs/features/spaceship-cursor-loot-animations/status.md
 M docs/features/spaceship-cursor-loot-animations/tasks.md
 M docs/features/spaceship-cursor-loot-animations/video-analysis.md
 M docs/product/glossary.md
?? docs/features/spaceship-cursor-loot-animations/build-log-T13.md
?? docs/features/spaceship-cursor-loot-animations/reviews/

$ git status --porcelain -- src tests .opencode compose.yaml compose.smoke.yaml AGENTS.md docs/architecture docs/features/README.md
SCOPE_STATUS_OUTPUT_END

$ git diff --stat -- README.md docs/product/glossary.md
 README.md                |  4 ++--
 docs/product/glossary.md | 25 ++++++++++++++++++++-----
 2 files changed, 22 insertions(+), 7 deletions(-)
```

The modified `docs/features/spaceship-cursor-loot-animations/{plan,spec,status,tasks,video-analysis}.md`
files and the untracked `reviews/` directory were present before T13 and are not staged; they
belong to earlier planning/review steps, not this task. Only this task's two documentation files
and this build log are staged in the T13 commit.

### Proposed `docs/features/README.md` row (orchestrator applies on acceptance)

Append after the last feature row (`detailed-hero-spaceship`), before the `States:` legend line;
no other row is modified:

```diff
+| spaceship-cursor-loot-animations | Pointer Ship, Granular Loot Parts & Satisfying Animations (detailed procedural pointer ship, per-slot loot parts, shared motion language) | building | 2026-11-08 |
```

The orchestrator sets the state to `accepted` and the acceptance date when the feature is
accepted; T13 does not edit `docs/features/README.md` (F16/F27).

Acceptance audit:
- AC-50 → met. `README.md` contains the exact phrase `granular spaceship parts` (grep exit 0),
  preserves `detailed blue/orange hero spaceship` (grep exit 0), states the pointer ship is
  procedural and that no external models/textures/images/videos/assets are used; the game view
  description covers the detailed pointer ship, per-part lootboxes and the motion language.
  `docs/product/glossary.md` defines `part slot`, `lootbox reveal` and `motion token` (grep exit 0
  each) and updates `appearance`/`part`/`lootbox` from categories to slots.
  `docs/features/README.md` is unchanged against the feature `BASE`
  (`INDEX_DIFF_EXIT=0`, `INDEX_STATUS_EXIT=0`); its proposed row is recorded above.
- Documentation checklist (`docs/architecture/documentation.md`): root `README.md` updated for
  shipped behavior; `docs/architecture/**` not applicable (no architectural/convention change);
  `docs/product/glossary.md` updated; `docs/features/README.md` proposed only, not edited.
- No source, test, CSS, config, container, spec, plan, tasks or status file was changed by T13
  (`SCOPE_STATUS_OUTPUT_END` above is empty for all guarded paths).

Deviations from spec: none.
