---
feature: remote-spaceship-customization
revision: 3
status: draft
created: 2026-11-18
updated: 2026-11-18
---
# Spec — Remote Spaceship Customization (other players' ships + 1,351 ship customizations)

## Summary

Make every player's ship visible with that player's own equipped customization — at minimum while
spectating them — and expand spaceship customization from 30 parts to a **1,351-row catalog** that
includes chassis/form changes and new shot animations, without sending the catalog over the wire.
Raw request, verbatim: *"I would like you to add the spaceship of other's players, so, basically,
when user is specting other's, user 1 should be able to see user's 2098spaceship with user's 2
customizations aswell. Also, I would like you to add 1000+ space ship customizations, including
chassis changes, form of the spaceship, shooting new animations, etc..."*

The appearance projection is public by construction (a ship is meant to be seen): the hub pins each
member's equipped slot→part-id record, carries it on the optional `MemberState.appearance` field
(always populated by the server, normalized to `{}` by every client decode path), and broadcasts an
additive `memberAppearance` frame when it changes. Accounts keep the accepted server-authoritative
ownership path (`equipPart`/`unequipPart`) and their appearance is seeded from the persisted
customization at join/rejoin; guests — who have no persisted inventory by accepted design — report
their loadout through one additive client frame that the hub validates structurally and normalizes
against the catalog, and they adopt the stored record back on resume so their own ship/hangar never
show defaults while others see the real loadout. The catalog itself is a deterministic, mirrored
module (`parts-v3.ts`) of 11 slots × (classic rows + 10 forms × 12 finishes); only equipped ids
travel (≤ 11 per member, ≤ 700 encoded bytes). The spectated member's ship is a re-used cursor model
placed above-front of their cube and it fires — using the owner's shot style and muzzle form —
whenever the owner's accepted clicks remove tiles, derived from the existing
`miniCubeRemoved`/`miniCubesRemoved` broadcasts, so remote firing adds **no** protocol traffic, and a
live `memberAppearance` re-skins the mounted ship. The hangar gains a sixth `Shots` tab and a
form/finish picker so 1,351 rows stay browsable in a 22 rem panel with no 1,000-row list.

**Explicit supersession.** The predecessor `spaceship-customization` non-goal *"No multiplayer
visibility of customized ships (the spaceship cursor stays client-local; other clients never see
it)"* is **superseded** by this feature: other clients now see every server member's equipped
appearance (rendered while spectating, which is the only camera layout in which a remote cube is on
screen). See § Supersession table.

## Context and decisions already accepted

- **The catalog is slot-based and mirrored.** `game/parts-v2.ts` (both workspaces) holds 10 slots ×
  3 parts (`standard`/`rare`/`epic`), one weighted draw (`rare` 3, `epic` 1 → 75 %/25 % aggregate),
  implicit ownership of every standard part and the legacy v1 backfill (`body-*`/`wings-*`/`engine-*`
  → v2 ids). The 30 v2 rows are the accepted "classic" look and stay byte-identical.
- **Appearance is account-authoritative and persisted** in `user_economy.appearance` JSONB;
  `equipPart`/`unequipPart` validate catalog + ownership, persist through `setSlotAppearance`, update
  every member of the account, and broadcast the account-scoped `customizationUpdate`. Guests mutate
  their ephemeral copy locally (`EngineSnapshot.customization`).
- **The render path is one shared visual mapping.** `appearanceToCursorShipParams()` maps
  slot→part-id to ten renderer-facing `PartVisual` records; `createCursorShipModel()` (21 meshes,
  10 slot groups, 19 materials, 32 objects) applies colour/accent plus a per-slot shape transform;
  `createSpaceship()` adds pointer following, shots, ignitions and the trail; `render/preview.ts`
  and `render/lootbox-reveal.ts` reuse the same model and mapping, and `ui/SpaceshipPreview.tsx`
  publishes per-slot `data-preview-slot-*` attributes from that same mapping.
- **The world is one cube view per member, not pickable, and the camera never looks sideways.** The
  spectated camera rests at `(px, py, 12)` looking at `(px, py, 0)` with `CAMERA_FOV = 50`; at the
  cube plane the visible half-width is ≈ 12·tan(25°)·aspect (≈ 8.95 at aspect 1.6), while adjacent
  ring slots are `SLOT_SPACING = 24` apart. **Remote cubes are therefore only on screen while
  spectating** (or mid-flight); that geometry is the basis for the ship-visibility decision below.
- **Measured scene budgets (r3, reviewer-measured with the real `createSceneView`/`createWorldView`).**
  The accepted scene holds **135** objects with no world, **146** with one remote member, **210**
  with 9 and **322** with 23. The predecessor's 136 was a dry count
  (`spaceship-cursor-loot-animations` AC-47) that no runtime fixture reproduces; this spec uses the
  measured values and never "136 with a remote world". The mounted remote ship adds **36 objects /
  21 draws at rest** (`remote-ships` manager 1 + `remote-ship` root 1 + `remote-ship-body` 1 +
  `cursor-ship-model` 32 + `shots` group 1) and **+1 object/+1 draw per in-flight bolt** and
  **+1/+1 per live muzzle mesh**, so the peak is **39 objects / 24 draws** (21 model + 2 bolts +
  1 muzzle; two muzzle flashes cannot overlap at the 90 ms spawn interval and the 80 ms flash).
- **`MAX_MESSAGE_BYTES` (1024) applies to incoming client frames only.** Server frames are bounded
  by this spec's own outbound test budgets (AC-14), not by that constant.
- **Additive-fields precedent.** `activity`, `leaderboard`, `yawSteps`/`pitchSteps` and `customization`
  were all added as optional wire fields with defensive client decoding and no protocol version bump;
  metrics label allow-lists are closed lists that throw on an unlisted value.
- **Budgets.** Bundle ceilings are `initial ≤ 150,000`, `three ≤ 165,000`, `total ≤ 300,000` B gzip;
  the current build measures 99,970 B initial and 281,381 B total, and the generated 1,351-row
  catalog measures ≈ **14.4 KB** gzip — ≈ 114.4 KB initial and ≈ 295.8 KB total, i.e. **≈ 4 KB** of
  total headroom (AC-33/R5 gate it). Coverage is ≥ 80 % statements/branches/functions/lines per
  workspace.

## Scope decision and phasing

One feature, three internal phases in the same spec/plan/tasks (the request is one user outcome:
*see other players' customized ships and own a much larger collection*):

| Phase | Deliverable | Why it is not a separate feature |
| --- | --- | --- |
| **P1 — transport & remote ship** | Catalog v3, `MemberState.appearance`, `memberAppearance`/`setAppearance`, server authority, repository/normalizer migration, spectated ship rendering + firing + live re-skin | The user's first sentence; needs the catalog ids to travel |
| **P2 — shot styles** | `shot` slot, shot profiles, 4 projectile + 3 muzzle geometries, own and remote shot visuals, recoil | The user's "shooting new animations"; rides P1's transport |
| **P3 — discovery UI & proof** | Sixth `Shots` tab, form strip + 3/12-cell grids, `shot` in the reveal and preview, CSS, smoke check, documentation | Without it the 1,351 rows are unreachable; it is the same user outcome |

No second feature is created. A smaller catalog (e.g. ~120 rows) or a non-spectated visibility rule
would each be a Q-1/Q-2 deviation and require a spec revision.

## Supersession table

Everything in `spaceship-customization`, `spaceship-cursor-loot-animations`,
`hangar-tabs-and-menu-motion`, `game-feel-overhaul`, `adaptive-render-budget-v2`,
`multiplayer-servers`, `multiplayer-cube-sync`, `live-activity-feed`, `server-live-leaderboard`,
`presence-and-activity-liveness` and `realtime-broadcast-batching` stays in force **except** the
rows below (the ledger rule: predecessor specs are never edited).

| Superseded | Behavior replaced | Replaced by (this spec) | Retained from that AC |
| --- | --- | --- | --- |
| `spaceship-customization` non-goal "No multiplayer visibility of customized ships"; Q-7 "appearance scope = owning client only" | Appearance never leaves the owning account's connections | § C: every server member's appearance is public and the spectated member's ship renders with it | Inventory/coins/upgrades are never public |
| `spaceship-cursor-loot-animations` AC-7 (per-slot appearance through `appearanceToCursorShipParams`) | The cursor/preview model maps only the 10 v2 slots | The model maps 11 v3 slots (`shot` excluded from geometry) through `appearanceToShipParamsV3`; a `shot` entry selects only the shot style | Per-slot application, idempotent writes, outer group identity |
| `spaceship-cursor-loot-animations` AC-8 (cursor draw/scene budget, 136-object baseline) | The scene baseline and draw budget cover the cursor only | AC-22: **36 objects / 21 draws at rest** while a spectated ship is mounted (peak 39 / 24 with two bolts and a live muzzle); the manager group is absent otherwise, so the accepted 135/146/210/322 counts return exactly on disposal | ≤ 2500-triangle model, 21 meshes, no shadow casting |
| `spaceship-cursor-loot-animations` AC-10 second sentence ("the v2 module is the canonical catalog") and its 10-slot app-level union | `parts-v2` is canonical; the game has 10 slots | `parts-v3` is canonical: 11 slots (adds `shot`) and 1,351 rows; `parts-v2` remains unchanged as the 30-row classic subset | The v2 module and every v2 test |
| `spaceship-cursor-loot-animations` AC-11 (exactly 30 parts, 20 lootable) | App-level catalog size and loot table | 1,351 rows, 1,340 lootable; the 30 v2 rows stay verbatim inside v3 | 3 classic rows per ship slot, standard parts not lootable |
| `spaceship-cursor-loot-animations` AC-13 (odds and boundary ids) | 20 lootable parts; per-part 7.5 %/2.5 %; `rng 0.999999 → tail-fin-comet` | 1,340 lootable parts; per-part rare 3/2680 (0.1119 %), epic 1/2680 (0.0373 %); `rng 0 → hull-obsidian` retained, `rng 0.999999 → shot-kite-solar` | 75 %/25 % aggregate, one draw, weights rare 3 / epic 1, clamping |
| `spaceship-cursor-loot-animations` **AC-16 only** (read normalization) | v2-only **read** normalization | v3 read normalization accepts v1, v2 and v3 ids with the same mapping rules | Every v1→v2 rule, idempotence, defensive copies. **AC-15 and migration 006 remain in force**: this feature makes **no** schema or migration change (AC-36) and never edits the 006 backfill |
| `spaceship-cursor-loot-animations` AC-21/AC-22 (equip validation and state) | Validate against the v2 catalog | Validate against the v3 catalog with identical rules; a changed appearance also emits `memberAppearance` | Ownership rules, standard-part allowance, no-op re-equip, `unknown_part`/`not_owned`/`unknown_slot` |
| `spaceship-cursor-loot-animations` AC-29/AC-30 (10 rows × exactly 3 variants) | Every slot row renders 3 variant entries | Form strip (11 forms) + a 3-cell (`classic`), 1-cell (`shot` classic) or 12-cell (generated form) grid | 10 ship slot names, unequip, 44 px targets, focus rings, panel `aria-label`/`data-mode` |
| `spaceship-cursor-loot-animations` AC-31 (preview mapping and ten `data-preview-slot` attributes) | The preview maps v2 ids and publishes 10 v2 slot values | The preview maps v3 through `appearanceToShipParamsV3`, keeps ten ship-slot attributes (now v3 ids), omits `shot` geometry, and derives the five legacy colour attributes from v3 | Canvas contract, accessible name, 30 fps cap, one context, WebGL fallback |
| `hangar-tabs-and-menu-motion` AC-1/AC-2/AC-3/AC-5/AC-10 | 5 tabs, 2 rows, 4 lootable per tab, `x/4` badge, 3 variants | 6 tabs, 2 rows (1 on `Shots`), 244 (ship tabs) / 120 (`Shots`) lootable, `x/<total>` badge, form strip + grid | Tab ARIA pattern, roving tabindex, sticky strip, one tabpanel, no `aria-controls`, no close animation |
| `game-feel-overhaul` AC-21 (customization markup: 10 rows, 3 variants) | The panel's normal-state row contract | § E hangar discovery contract | Title, counts, `Open lootbox`, reveal spotlight, preview, `data-reveal-active` |
| `adaptive-render-budget-v2` § Quality tier budget | Nothing in the GPU/CPU tier matrix changes; the section is not a scene object/draw baseline | **Not a behavior change:** the tier matrix (thresholds, hidden-mesh lists, shadow/bloom/DPR) is unchanged and the remote ship consumes the tier's `hiddenCursorMeshes` list. The scene object/draw baseline it is measured against comes from `spaceship-cursor-loot-animations` AC-8/AC-47 and `multiplayer-servers` AC-13 | Every tier threshold and feature-matrix row |
| `multiplayer-servers` AC-13 (remote-cube drawable bound) | The world renders "≤ X × 7 meshes per world" (one cube view per member) | Adds exactly one spectated remote ship — **36 objects / 21 draws at rest, 39 / 24 peak** — while spectating | The ring layout, one-cube-view-per-member rule, non-pickable remote cubes and disposal rules |
| `realtime-broadcast-batching` § Metrics allow-lists | Closed `type` lists | Extended with `memberAppearance` (encoded/frames) and `setAppearance` (received) | Encode-once fan-out, no new metric, no per-client queue |

**Not superseded — clarified.** `spaceship-customization` AC-15 (`customizationUpdate` scoped to the
owning account) is **unchanged**: the public projection is a separate additive path, not a widening
of that broadcast. `spaceship-cursor-loot-animations` AC-15 and migration `006_granular_spaceship_parts.sql`
remain in force — this feature makes no schema or migration change (AC-36) and never edits that
backfill. The `adaptive-render-budget-v2` tier matrix is unchanged. `hangar-tabs-and-menu-motion`
AC-11…AC-22 (menu motion, scrollbars, crew pill, HUD minimize) stay in full. `multiplayer-cube-sync`
(orientation sync, loss tolerance), the spectate camera flights and edge cases, `SHOT_TRAVEL_MS === 180`,
`SPACESHIP_IGNITION_*`, the 1290 ms reveal timeline, `MINI_CUBE_POP_MS === 0` and every
board/grid/style rule remain in force.

## User stories

- As a spectator, I want to see the ship of the player I am watching, with their equipped parts,
  chassis form and paint, so that spectating shows a real player's identity.
- As a spectator, I want the ship to update when its owner changes parts mid-spectate, so the view is
  never stale.
- As a player, I want the watched ship to react to its owner — idling and visibly firing (with their
  shot style and muzzle form) when they shoot a tile — so the world feels alive.
- As a player, I want to unlock and equip many more parts (forms, chassis, paints, shot styles), so
  collecting does not stop after 30 items.
- As a player, I want to browse 1,351 parts in the hangar by picking a form and then a finish,
  instead of scrolling a thousand rows.
- As a guest, I want my equipped ship to be visible to others just like an account's ship, and to
  still see my own loadout after a reconnect.
- As an account holder, I want my ownership, persistence, multi-tab consistency and joined-server
  appearance to keep working exactly as before.
- As a player with reduced motion, I want a static remote ship and a non-travelling impact flash
  instead of firing animation.
- As a maintainer, I want one catalog module per workspace, one appearance projection on the wire,
  no catalog enumeration on any frame, and the existing protocols unchanged where they already work.

## Acceptance criteria

Verification notes: "backend" = `src/backend`, "frontend" = `src/frontend`, "BASE" = the pre-feature
fork point recorded in the final build log. Every test uses concrete expected values; no wildcard
matchers, snapshot-only or assertion-free tests. Commands (from `AGENTS.md`): `npm run lint`,
`npm run typecheck`, `npm test`, `npm run coverage` (≥ 80 % statements/branches/functions/lines per
workspace), `npm run build`, `npm run smoke`. Raw transcripts go in
`docs/features/remote-spaceship-customization/build-log-T<id>.md`.

### A. Catalog v3 (1,351 rows)

- **AC-1 — Catalog shape and counts.** `game/parts-v3.ts` exists in both workspaces and exports
  `PART_CATALOG_VERSION === 3`, `SLOT_CATALOG_V3` (11 slots in this exact order: `hull`, `nose`,
  `cockpit`, `wing-left`, `wing-right`, `engine-left`, `engine-right`, `ignition-left`,
  `ignition-right`, `tail-fin`, `shot`), `PART_CATALOG_V3` with **exactly 1,351 rows** in the pinned
  order (§ Catalog tables), `CATALOG_ROW_COUNT === 1351`, `LOOTABLE_ROW_COUNT === 1340`, and
  `SLOT_NOUN`. Per-slot row counts are exactly `123` for each of the ten ship slots and `121` for
  `shot`; exactly **11** rows have `rarity: 'standard'` (the ten v2 standards plus `shot-default`);
  rarity totals are exactly `670` `rare` and `670` `epic`. Evidence: `parts-v3.test.ts` (both
  workspaces).
- **AC-2 — Deterministic ids, names and grid shape.** Generated part id is
  `` `${slot}-${form}-${finish}` `` and generated name is
  `` `${finish.label} ${form.label} ${SLOT_NOUN[slot]}` ``; all 1,351 ids are unique, all 1,351
  names are unique, and every id is ≤ 40 characters — the **longest catalog id is 30 characters**
  (`ignition-right-bulwark-crimson`). `FORM_CATALOG` has exactly 11 entries in the pinned order
  (`classic`, `dart`, `lance`, `needle`, `manta`, `hauler`, `bulwark`, `arrow`, `orca`, `talon`,
  `kite`) and `FINISH_CATALOG` exactly 12 (six `rare`, six `epic`, § Catalog tables).
  `catalogForSlotForm(slot, 'classic')` returns exactly 3 rows for the ten ship slots and exactly 1
  row (`shot-default`) for `shot`; `catalogForSlotForm(slot, <generated form>)` returns exactly 12
  rows in finish order. One pinned row is asserted verbatim: `hull-dart-chrome` has
  `{ slot: 'hull', name: 'Chrome Dart Hull', rarity: 'rare', color: '#c9d4e2', accent: '#ffffff',
  form: 'dart', finish: 'chrome', shape: 'dart' }`. Every row's `form` exists in `FORM_CATALOG`, and
  every `classic` row's `shape` is one of the 13 v2 shape keys. Evidence: `parts-v3.test.ts` (both).
- **AC-3 — v2 preserved verbatim.** The 30 `PART_CATALOG_V2` rows appear in `PART_CATALOG_V3` with
  identical `id`, `slot`, `name`, `rarity`, `color`, `accent` and `shape`, in v2 order, at the start
  of each slot's run, with `form: 'classic'` and `finish: 'classic'`. `parts-v2.ts` and
  `parts-v2.test.ts` are byte-identical to `BASE`
  (`git diff --exit-code "$BASE"...HEAD -- src/backend/src/game/parts-v2.ts
  src/backend/src/game/parts-v2.test.ts src/frontend/src/game/parts-v2.ts
  src/frontend/src/game/parts-v2.test.ts`). Evidence: `parts-v3.test.ts` (both), final diff gate.
- **AC-4 — Loot draw over 1,340 rows.** `selectLootPartV3(rng)` consumes exactly one `rng` draw and
  maps the raw value deterministically: `NaN → 0`, `-Infinity → 0`, any value `≤ 0 → 0`,
  `Infinity → 1`, any value `≥ 1 → 1` (i.e. the accepted v2 clamp, now pinned). It walks the lootable
  rows in catalog order with weights `rare 3` / `epic 1` (total 2,680). `rng() === 0` returns
  `hull-obsidian`; `rng() === 0.999999` and `rng() === 1` return `shot-kite-solar`; it never returns
  a standard part. The aggregate rare probability is exactly `2010 / 2680 = 0.75`; per-part
  probabilities are `3 / 2680` (rare) and `1 / 2680` (epic). A second call with a fresh draw returns
  a different part for a seeded sequence. Evidence: `parts-v3.test.ts` (both), `hub.test.ts` (seeded
  multi-open).
- **AC-5 — Normalization covers v1, v2 and v3.** `normalizePartMapV3` / `normalizeAppearanceV3` /
  `normalizeCustomizationStateV3` apply every accepted v1/v2 rule (bilateral `wings-*`/`engine-*`
  expansion, `body-*` → `hull-*`, canonical slot keys win over legacy aliases) **and** keep v3 ids:
  `{ "hull": "hull-dart-chrome" }` survives; a v3 id in the wrong slot, an unknown id and a
  non-integer/negative/`> 2147483647` count are dropped; duplicate keys sum; output is emitted in
  `SLOT_CATALOG_V3` order (11 entries max). Normalization is independent of
  `customization_version` (a row at version 2 with v3 ids normalizes). The panel, engine and
  repository all consume this module (no production module reads `parts-v2` outside the classic
  subset). **Module layering:** the pure `game/ship-forms.ts` (form recipes/chassis) imports only
  `game/**` — never `three` or `render/**` — and the v2 shape-table resolution helper lives in
  `render/cursor-ship.ts`, which owns `CURSOR_SLOT_SHAPE_TRANSFORMS`; `ship-forms.test.ts` asserts the
  import boundary by reading the module source. Evidence: `parts-v3.test.ts` (both),
  `economy-repository.test.ts` (round-trip with v3 ids, AC-36),
  `SpaceshipCustomizationPanel.test.tsx` (v3 fixture, AC-31), `ship-forms.test.ts` (boundary).
- **AC-6 — Mirror parity.** Each module exports `CATALOG_ROWS_HASH` computed as FNV-1a 32-bit over
  the UTF-8 string `rows.map(r => [r.id, r.slot, r.name, r.rarity, r.color, r.accent, r.form,
  r.finish].join('|')).join('\n')`, formatted as 8 lowercase hex digits. Both `parts-v3.test.ts`
  files assert `CATALOG_ROWS_HASH === '<pinned literal>'` with the **same** literal, and the two
  literals are compared byte-for-byte in the build log. The pinned tables below fully determine the
  rows, so both workspaces must compute the same value independently. Evidence: `parts-v3.test.ts`
  (both), `build-log-T1.md`.

### B. Appearance transport and authority

- **AC-7 — `MemberState.appearance`: optional on the wire, always normalized at runtime.**
  `MemberState` (backend `game/protocol.ts` and frontend `multiplayer/protocol.ts`) gains
  `appearance?: Record<string, string>`. The backend's `memberState()`/`rosterFor()` **always**
  populate it, so every server-originated `welcome.roster[i]`, `worldEntered.roster[i]` and
  `memberJoined.member` carries the field (asserted key presence, AC-13). On the client the field
  stays optional so existing full `MemberState` literals (`UserPanel.test.tsx`,
  `activity-lifetime.test.ts`, `App.test.tsx`, the scene/session fixtures) compile **without edits**;
  every decode/copy path (`copyMember`, `reduceWorldState`, the `SceneWorld` roster copy) fills `{}`
  through the exported `memberAppearanceOf(member)` helper, which returns the field when it is a
  valid record and `{}` when it is absent, non-object, > 11 entries, or contains an unknown slot key
  or a non-string/empty/over-40-character value. When present, the codec requires a plain object
  with ≤ 11 entries, keys in the 11-slot union and non-empty string values ≤ 40 characters.
  `stateSync` and `levelAdvanced` gain **no** field and their encoded bytes are unchanged. Evidence:
  `protocol.test.ts` (both), `server-state.test.ts` (missing-field default `{}`), `world.test.ts`
  (roster copy default).
- **AC-8 — `memberAppearance` frame.** The server catalog gains
  `{ type: 'memberAppearance'; playerId: string; appearance: Record<string, string> }` with the
  AC-7 appearance rules and a `memberAppearanceMessage(playerId, appearance)` builder that copies
  the record defensively (mutating the argument afterwards does not change the message). Evidence:
  `protocol.test.ts` (both).
- **AC-9 — `setAppearance` frame.** The client catalog gains
  `{ type: 'setAppearance'; appearance: Record<string, string> }`. The codec rejects (→
  `bad_message`) a non-object, `null`, an array, > 11 entries, an unknown slot key, a non-string or
  empty value, a value longer than 40 characters, or an encoded appearance larger than
  `APPEARANCE_JSON_MAX_BYTES = 700`. The worst-case valid frame (11 entries, the 30-character
  `ignition-right-bulwark-crimson` id) is ≤ `MAX_MESSAGE_BYTES` (1024). Evidence: `protocol.test.ts`
  (both, identical fixtures).
- **AC-10 — Account equip path emits the public projection.** `equipPart` and `unequipPart` keep
  every accepted rule (catalog validation, ownership, standard-part allowance, legacy ids, no-op
  re-equip) and additionally set the new appearance on **every member whose `accountId` equals the
  owning account** before broadcasting. **Fan-out rule: one `memberAppearance` frame per affected
  member (`playerId`) on that member's server, emitted only when that member's appearance actually
  changed.** Two tabs of one account on the **same** server are two members ⇒ **two frames** on that
  server (one per `playerId`; a single frame for one member would leave the sibling's roster entry
  stale); two tabs on **two** servers ⇒ one frame on each server. Each frame is encoded once per
  server. No frame is emitted when the appearance is unchanged. `customizationUpdate` remains
  account-scoped and unchanged in shape. Evidence: `hub.test.ts` (same-server two-tab fixture and
  two-server fixture).
- **AC-11 — Guest path and account refusal.** `setAppearance` from a guest member normalizes the
  record against the v3 catalog, stores it on the member and broadcasts one `memberAppearance` to
  the server's **other** members (origin excluded) only when the normalized record differs from the
  stored one. `setAppearance` from an accounted member is a silent no-op: no state change, no frame,
  no error. Unknown part ids, wrong-slot ids and > 11-entry records never reach the wire (the codec
  rejects the last; the hub drops the others). Evidence: `hub.test.ts`.
- **AC-12 — `setAppearance` rate limit (true trailing window).** At most `10` accepted
  `setAppearance` frames per member in **any** 1000 ms trailing interval. An admitted frame is
  forgotten at `now − 1000 ms` (`<=`), matching the hub's `RATE_WINDOW_MS = 1000`; the boundary is
  pinned: 10 admitted frames at `t = 0, 100, …, 900` admit nothing at `t = 950` (11th inside
  `(−50, 950]`), and the frame admitted at `t = 0` expires at `t = 1000`, so an attempt at
  `t = 1000` is accepted. Dropped attempts are silent (no state change, no broadcast, no error).
  Evidence: `hub.test.ts` (fake timers, the 10/11th boundary at 950 and 1000).
- **AC-13 — Seeding and convergence on join, resume, move and leave.** (a) **Account seeding:** at a
  fresh `join` and at a `rejoin` inside grace, an account member's `appearance` equals its persisted
  `customization.appearance` (normalized) — never `{}` when the account has equipped parts — and the
  member's roster entry carries it (asserted on `welcome.roster[self]`, on a sibling tab's
  `memberJoined` and after a resume). (b) **Guest seeding:** a guest starts with `appearance: {}`;
  after `welcome` the session (guest only) first **adopts** `welcome.roster[self].appearance` into
  the engine when the local record is empty, so the guest's own ship, preview and hangar show the
  stored loadout; then it sends exactly one `setAppearance` iff the (adopted or local) record is
  non-empty and differs from the roster self entry — never more than once per `welcome`, never for an
  account. (c) **Stability:** a member's stored appearance survives a socket close inside grace and
  a `rejoin`; it travels with the member on a cross-server move (the target roster carries it); it is
  discarded on final removal; a new guest identity starts from `{}`. Evidence: `hub.test.ts` (a, c),
  `session.test.ts` (b).
- **AC-14 — Payload bounds and metrics.** `MAX_MESSAGE_BYTES` (1024) applies to **incoming** client
  frames only; the bounds below are this feature's **outbound test budgets**, not wire caps. (a)
  `APPEARANCE_JSON_MAX_BYTES === 700`: the worst-case appearance object (all 11 slots, the
  longest ids of AC-2) encodes to ≤ 700 B; the measured worst `memberAppearance` frame is **492 B**.
  (b) The pinned `welcome` fixture is **24 guest members, `removedIds: []` on every member, a full
  11-entry appearance on every member, `customization` absent**; it encodes to ≤ **17,408 B**
  (measured 16,710 B) and the `appearance` fields alone contribute ≤ 550 B per member. A `welcome`
  that also carries an account's full inventory is explicitly **out of this bound** (measured
  51,763 B with a full 1,351-entry inventory; that cost is the inventory itself, unchanged in kind).
  (c) `memberAppearance` is added to the closed `type` allow-lists of
  `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total`, and
  `setAppearance` to `cubeclicker_ws_messages_received_total`; a hub test with the metrics registry
  enabled does not throw and counts one encode per broadcast. Evidence: `protocol.test.ts`,
  `metrics.test.ts`, `hub.test.ts`.

### C. Remote ship (spectating)

- **AC-15 — Visibility, live updates and lifecycle.** The screen shows **exactly one** remote ship:
  the member the camera is spectating. `SceneView.setSpectatedMember(playerId | null)` mounts a ship
  for a member that exists in the live roster and disposes it (`dispose()` exactly once) on `null`,
  on `memberLeft` for that member, on `welcome`/`worldEntered` (world rebuild), and on scene
  disposal. `SceneView.setSpectatedAppearance(playerId, appearance)` applies a live
  `memberAppearance` to the mounted ship when `playerId` is the mounted member (an unknown/other id
  is a no-op) without remounting it. Calling `setSpectatedMember` with the same id twice is a no-op;
  an unknown id mounts nothing; no ship exists before the first `welcome`, during the
  spectate/return camera flight, or when the spectated member is not in the rendered world.
  Non-spectated members never get a ship (their cubes are off-camera in the accepted camera layouts;
  § Context). Evidence: `remote-ship.test.ts`, `scene.test.ts`, `session.test.ts`.
- **AC-16 — Placement, hierarchy and aim.** `REMOTE_SHIP_OFFSET === { x: 1.6, y: 2.8, z: 4.4 }` and
  `REMOTE_SHIP_SCALE === 1.2`. For a spectated member at `(10, -4)`, the **root** group's world
  position is exactly `(11.6, -1.2, 4.4)` and its scale `[1.2, 1.2, 1.2]`. The hierarchy is pinned:
  the **root** carries the anchor and the aim (after `updateMatrixWorld`, the root's local `+z` axis
  in world space equals the normalized vector from the root position to the cube centre `(10, -4, 0)`
  within `1e-6`, and its local `+y` is not degenerate); a **`remote-ship-body` child** carries the
  AC-19 idle bob/sway and the AC-20 recoil, with the model under it. AC-16 is measured with the body
  at rest (`bobY = 0`, `swayYaw = 0`, recoil `0`), so aim is independent of the idle animation.
  Evidence: `remote-ship.test.ts`.
- **AC-17 — Appearance drives the ship (including live updates).** The ship resolves its 11-slot
  appearance through `appearanceToShipParamsV3` and applies the 10 ship slots to the model; the
  `shot` entry only selects the shot style (AC-23/AC-26). A classic v2 appearance renders exactly the
  accepted v2 look: for `{ "hull": "hull-obsidian", "wing-left": "wing-left-gold" }` the hull
  material colour is `#1a2333`, the port wing colour is `#ccaa44`, and the hull slot group transform
  equals the v2 `armored` transform. For `{ "hull": "hull-dart-chrome" }` the hull slot group scale is
  exactly `[0.85, 0.9, 1.15]` and the model group's chassis scale is exactly `[0.95, 0.9, 1.25]`.
  **Chassis × equip-pulse composition (pinned):** `CursorShipModel` stores the chassis triple and
  exposes `applyPulseScale(pulseScale)`, which writes
  `[chassis.x · pulse, chassis.y · pulse, chassis.z · pulse]`; `Spaceship.applyPulse()` calls that
  method instead of `model.group.scale.setScalar(...)`. At rest (`pulseScale = 1`) the chassis is
  exactly `[0.95, 0.9, 1.25]`; at the pulse peak (`shipEquipPulseScale` = `1.04` at 130 ms of the
  260 ms window) it is `[0.988, 0.936, 1.3]` (within `1e-9`); a classic hull (`[1, 1, 1]`) yields
  exactly `[1.04, 1.04, 1.04]` at the peak and `[1, 1, 1]` at rest, preserving the accepted pulse.
  The own ship, the remote ship (no pulse) and the preview render the same chassis.
  A later `setSpectatedAppearance` with `{ "hull": "hull-dart-aurum", "shot": "shot-orca-violet" }`
  writes the new hull colour (`#ccaa44` accent `#fff3d6`) and switches the shot style **on the
  mounted model** (no remount: the model group identity is unchanged, no extra `dispose()`), and
  repeating the same record performs no write. Evidence: `remote-ship.test.ts`, `scene.test.ts`,
  `cursor-ship.test.ts`, `ship-forms.test.ts`, `spaceship.test.ts` (rest and pulse-peak scale after
  an `update`, classic and generated hulls).
- **AC-18 — Absent/unknown appearance is safe and idempotent.** A missing appearance, `{}`, an
  unknown id or a wrong-slot id renders the slot's classic standard part and never throws; applying
  the same appearance twice performs no second material or transform write (spy on material
  `color.set` and slot-group scale writes) and starts no extra animation. Evidence:
  `remote-ship.test.ts`.
- **AC-19 — Idle motion.** `remoteShipIdle(elapsedMs, reducedMotion)` returns `bobY` and `swayYaw`
  with `REMOTE_SHIP_BOB_AMPLITUDE === 0.12`, `REMOTE_SHIP_BOB_PERIOD_MS === 2600` and
  `REMOTE_SHIP_SWAY_RAD === 0.05`: at `t = 0` `{ bobY: 0, swayYaw: 0.05 }`, at `t = 650`
  `{ bobY: 0.12, swayYaw: 0 }`, at `t = 1950` `{ bobY: -0.12, swayYaw: 0 }` (within `1e-9`); reduced
  motion returns `{ bobY: 0, swayYaw: 0 }` for every `t`. The values are applied to the
  `remote-ship-body` child only (`position.y = bobY`, `rotation.y = swayYaw`); the root's anchor and
  aim are unchanged by the animation. The ship never follows a pointer, never travels, and its root
  position is otherwise exactly the AC-16 anchor. Evidence: `remote-ship.test.ts`.
- **AC-20 — Firing from accepted removals.** When the mounted member's `miniCubeRemoved` or
  `miniCubesRemoved` arrives, the ship spawns at most one shot toward the first id's tile origin (the
  `CubeView` world position of that instance; when the tile is already hidden, the fallback target is
  `(px, py, 2.75)`). At most one shot per `REMOTE_SHOT_MIN_INTERVAL_MS = 90` per ship and at most
  `REMOTE_SHOT_MAX_IN_FLIGHT = 2` live shots per ship (a third is dropped, not queued); the shot
  spawns at the model's nose (local `+z` tip) and travels over the retained `SHOT_TRAVEL_MS === 180`.
  Each accepted shot starts one recoil on the `remote-ship-body` child: offset `-0.12` along its local
  `-z` at spawn (`t = 0`), decaying with `1 - easeOutCubic(t)` over
  `MOTION.remoteShipRecoilMs === 120`, pinned at `t = 60` → `-0.015` and `t = 120` → `0` (within
  `1e-9`); a dropped shot starts no recoil. A removal whose `playerId` is not the mounted member
  spawns nothing (the local ship owns its own shots). Evidence: `remote-ship.test.ts`,
  `scene.test.ts`.
- **AC-21 — Reduced-motion firing.** With reduced motion the remote ship does not bob, sway or
  recoil, and a removal renders one opacity flash at the target for `MOTION.remoteShotFlashMs = 120`
  with no travelling mesh; the tile conceal and the shared impact burst are unchanged. Evidence:
  `remote-ship.test.ts`.
- **AC-22 — Budget, tiers and picking.** Measured accepted scene: **135** objects with no world,
  **146** with one remote member, **210** with 9, **322** with 23. The `remote-ships` manager group is
  created only while a ship is mounted. **Idle fixture (pinned: ship mounted, no shot in flight):**
  the ship contributes **36 objects** — 1 manager + 1 `remote-ship` root + 1 `remote-ship-body` + 32
  `cursor-ship-model` objects + 1 `shots` group — and **21 draws**, so the scene totals are
  **182** (one remote member), **246** (9) and **358** (23). **Shot deltas (pinned):** each in-flight
  bolt adds **+1 object / +1 draw** and each live muzzle mesh adds **+1 / +1**; two bolts therefore
  give **38 objects / 23 draws** (scene totals **184 / 248 / 360**), at most two bolts are in flight
  (`REMOTE_SHOT_MAX_IN_FLIGHT`) and at most one muzzle is live (80 ms flash, ≥ 90 ms spawn interval),
  so the **peak fixture is 39 objects / 24 draws** and the peak scene totals are **185 / 249 / 361**.
  Disposing the ship restores the measured accepted counts exactly
  (`createWorldView` + `createSceneView` object counts asserted at the idle, two-bolt and peak
  fixtures). Medium hides the accepted four detail meshes and low the accepted six, with no trail and
  no reticle. A ray that hits only the remote ship resolves to `null` through the picking path. The
  per-frame path allocates no object (pose, bob, recoil and flash write pre-allocated vectors).
  Evidence: `remote-ship.test.ts`, `scene.test.ts`, `world.test.ts`.

### D. Shot styles

- **AC-23 — Shot-style catalog.** `shotStyleForPart(partId)` resolves any v3 part and throws
  `unknown part: <id>` otherwise; for a `shot` slot row it returns
  `{ partId, geometry, scale, muzzle, color, accent }` from the form's pinned shot profile
  (§ Catalog tables), and for any non-shot part it returns the classic default (`shot-default`).
  `shot-default` is `{ geometry: 'bolt', scale: 1, muzzle: 'spark', color: '#fff1c8',
  accent: '#ffd27a' }` — the accepted bolt/muzzle colours. `muzzle` is one of `spark` (the accepted
  octahedron), `ring` (a torus) and `petal` (three crossed quads). Evidence: `parts-v3.test.ts`
  (both), `shot-visuals.test.ts`.
- **AC-24 — Prebuilt geometry sets, zero per-shot allocation.** `render/shot-visuals.ts` builds
  exactly **four projectile geometries** (`bolt` = the accepted cone with the tip at local `+z`,
  `orb` = octahedron, `wave` = torus, `shard` = tetrahedron) and **three muzzle geometries**
  (`spark` = the accepted octahedron, `ring` = torus, `petal` = three crossed quads) once, plus one
  additive projectile material and one additive muzzle material. `Spaceship.applyShotStyle(style)`
  switches the style: a shot captures `geometry`, `scale` and `muzzle` at spawn (an in-flight shot
  keeps its geometry/muzzle after an equip), the shared projectile material colour is set to the
  style `color` and the muzzle material to the style `accent`; applying the same style twice is a
  no-op; no geometry or material is created after construction. Evidence: `spaceship.test.ts`,
  `shot-visuals.test.ts`.
- **AC-25 — Own shot style wiring.** `SceneView.applySnapshot` applies
  `shotStyleForPart(appearance.shot ?? 'shot-default')` when the normalized appearance changes (and
  once at construction), so equipping a `shot` part changes the next shot's geometry/scale/muzzle and
  the colours. An unknown/absent `shot` entry uses `shot-default`. Evidence:
  `scene.test.ts`, `spaceship.test.ts`.
- **AC-26 — Remote shots use the owner's style.** The mounted member's shots use that member's
  resolved shot style (geometry, scale, muzzle, colour and accent) — a spectator sees a different
  projectile and muzzle after the owner changes their `shot` part (including via a live
  `setSpectatedAppearance`); the remote ship's muzzle flash duration reuses
  `MOTION.shotMuzzleFlashMs`. Evidence: `remote-ship.test.ts`, `scene.test.ts`.

### E. Hangar discovery

- **AC-27 — Six tabs and totals.** `ui/hangar-tabs.ts` exports `HangarTabId` with exactly six tabs
  in this order: `frame` (`Frame`: `hull`, `tail-fin`), `front` (`Front`: `nose`, `cockpit`),
  `wings` (`Wings`: `wing-left`, `wing-right`), `engines` (`Engines`: `engine-left`,
  `engine-right`), `ignitions` (`Ignitions`: `ignition-left`, `ignition-right`), `shots` (`Shots`:
  `shot`). The union of slots is exactly the 11 `SLOT_CATALOG_V3` ids, per-tab slots are in catalog
  order, `HANGAR_DEFAULT_TAB === 'frame'`, `tabForSlot` covers all 11 and throws
  `unknown slot: <id>` otherwise, and `HANGAR_TAB_LOOTABLE_TOTALS` is exactly
  `{ frame: 244, front: 244, wings: 244, engines: 244, ignitions: 244, shots: 120 }`.
  `tabOwnedCount(tab, parts)` counts owned lootable v3 parts only (0 for `{}`, the tab total for a
  full inventory, legacy bilateral ids counting for both slots after normalization). Evidence:
  `hangar-tabs.test.ts`.
- **AC-28 — Row and grid DOM.** In the normal state the tabpanel renders one
  `li.customization-slot[data-slot]` per slot of the active tab (two rows; one on `Shots`) in catalog
  order. Each row renders `data-owned` (owned lootable rows of that slot) and `data-total` (122 ship
  / 120 shot) on its header, one `button.customization-unequip` (disabled at the standard part), one
  `.customization-forms` group with exactly **11** `button.customization-form` elements
  (`data-form`, `aria-pressed`, accessible name = form label, `min-height: 44px`), and one
  `.customization-variants` list whose `li.customization-variant` count is exactly **3** when the
  selected form is `classic` for a ship slot, exactly **1** for the `shot` classic form, and exactly
  **12** for a generated form. Each variant carries `data-part`, `data-finish`, `data-rarity`,
  `data-owned`, `data-locked`, `data-equipped`, an `aria-hidden` swatch whose inline background
  equals the catalog `color`, and either a `button.customization-equip` (owned; `aria-pressed="true"`
  + text `Equipped` when equipped, otherwise accessible name `Equip <part name>`) or the text
  `Locked` with no button. Every interactive control is ≥ 44×44 px with a `:focus-visible` ring.
  Evidence: `SpaceshipCustomizationPanel.test.tsx`, `game-view.css.test.ts`.
- **AC-29 — Form selection and keyboard.** Each slot row keeps a selected form that defaults to
  `classic` and persists per slot for the panel's lifetime (reset on mount). Clicking a form button
  selects it: `aria-pressed`, the row's `data-form`, and the variant list change in the same commit
  and the list is keyed by the form id. Each `.customization-forms` strip uses its own roving tabindex
  — **exactly one `tabindex="0"` per strip** (two on a ship tab, one on `Shots`), all other buttons
  `-1`; with focus on the selected form, `ArrowRight`/`ArrowLeft` select the next/previous form in
  `FORM_CATALOG` order wrapping at both ends, `Home`/`End` select `classic`/`kite`, focus moves to the
  newly selected button, and `event.preventDefault()` is called for all four keys (the panel is the
  scroll container). Selection calls none of `onOpenLootbox`/`onOpen`/`onEquip`/`onUnequip`/
  `onDismissReveal`, and the `SpaceshipPreview` element identity is unchanged across selections.
  Evidence: `SpaceshipCustomizationPanel.test.tsx`.
- **AC-30 — Control counts and structure.** Counts are derived from AC-28's markup. With an empty
  inventory (`parts: {}`) and the default `classic` form: each ship tab renders exactly **26**
  controls (2 rows × (11 form buttons + 1 unequip + 1 equip)) and the `Shots` tab exactly **13**
  (1 × (11 + 1 + 1)). With an all-owned inventory (all 1,351 ids at count 1) and `classic`: ship
  tabs **30** (2 × (11 + 1 + 3)) and `Shots` **13** (11 + 1 + 1 — the shot slot's classic form has
  one variant). With an all-owned inventory and a generated form selected on every row: each ship tab
  **48** (2 × (11 + 1 + 12)) and `Shots` **24** (1 × (11 + 1 + 12)). The panel keeps its
  `aria-label="Spaceship customization"`, `data-mode`, the two counts with `data-lootboxes`/
  `data-keys`, `Open lootbox` enable rules, exactly one `[role="tabpanel"]`
  (`id="customization-tabpanel"`) with `aria-labelledby` resolving to the selected tab, no
  `aria-controls` on any tab, exactly one `SpaceshipPreview`, and no row of a non-active tab in the
  DOM. Evidence: `SpaceshipCustomizationPanel.test.tsx`.
- **AC-31 — Reveal and preview tolerate `shot`.** `REVEAL_SLOT_YAW_RAD` gains exactly `shot: 0.9`
  (the other ten values unchanged); a grant whose part is in the `shot` slot renders the card with
  `data-slot="shot"`, the slot display name `Shot`, the catalog part name, and the unchanged 1290 ms
  timeline / dismiss / equip / reduced-motion / WebGL-fallback behaviour; the staged ship is
  unchanged by a shot part (no mesh). The preview resolves through `appearanceToShipParamsV3`
  (11 slots; the `shot` entry is ignored for geometry) and keeps its ten
  `data-preview-slot-<shipSlot>` attributes, now carrying v3 ids; its five legacy
  `data-*-color` attributes are derived from the same v3 mapping (hull→body, nose→nose,
  wing-left→wings, cockpit→cockpit, ignition-left→engine) so a v3 part never renders a default
  colour. `partDefinition` consumers in `LootboxReveal`, the panel and the preview resolve v3 ids (a
  v3 id's catalog slot is used, never the wire `slot`). Evidence: `reveal-motion.test.ts`,
  `lootbox-reveal.test.ts`, `LootboxReveal.test.tsx`, `preview.test.ts`,
  `SpaceshipPreview.test.tsx`, `SpaceshipCustomizationPanel.test.tsx`.

### F. Cross-cutting

- **AC-32 — Coverage.** `npm run coverage` exits 0 with statements, branches, functions and lines all
  ≥ 80 in **both** workspaces; every new module is included; no exclusion and no threshold change.
  Evidence: final build log.
- **AC-33 — Full gates and measured budgets.** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run coverage`, `npm run build` and `npm run smoke` all run; the build passes the
  150,000 / 165,000 / 300,000 B gzip ceilings. The catalog's measured cost is ≈ **14.4 KB** gzip
  (≈ 114.4 KB initial, ≈ 295.8 KB total — ≈ **4 KB** of total headroom against 300,000 B), and the
  build log records the exact initial/three/total deltas against `BASE`. A Podman-unavailable smoke
  result is recorded as `not applicable` and never claimed as a pass. Evidence: final build log.
- **AC-34 — Documentation.** `README.md` contains the exact phrases `remote player spaceships`,
  `1,351 spaceship parts`, `form and finish picker` and `shot styles`; its customization paragraph is
  rewritten to describe **six** hangar tabs (`Frame`, `Front`, `Wings`, `Engines`, `Ignitions`,
  `Shots`), the per-tab `owned/<total>` counts (244 / 120) and the form+finish picker, with **no**
  remaining `five part-group tabs`, `ten part slots` or `n/4` text; it keeps the accepted
  `granular spaceship parts`, `animated 3D lootbox reveal`, `Neon Forge HUD` and
  `detailed blue/orange hero spaceship` phrases. `docs/architecture/realtime.md` gains
  `## Public appearance projection` (optional field + `memberAppearanceOf` normalization,
  `memberAppearance`, `setAppearance`, authority matrix, outbound bounds, loss tolerance, metrics).
  `docs/architecture/frontend-rendering.md` gains `## Remote ships` (visibility rule and the
  camera-geometry rationale, anchor/scale/hierarchy, idle/firing/recoil, reduced motion, live
  re-skin, budgets) and records the **idle spectating fixture**: one remote member + a mounted ship
  at rest = **182 objects with 21 added draws** (36 added objects), the two-bolt **184 / 23** delta
  and the **185 / 24** peak (accepted counts 135/146/210/322 unchanged while no ship is mounted). `docs/architecture/observability.md`
  updates the metric allow-list rows: `setAppearance` in `cubeclicker_ws_messages_received_total`,
  `memberAppearance` in `cubeclicker_ws_messages_encoded_total` and
  `cubeclicker_ws_frames_sent_total`, plus the allow-list paragraph's list. `docs/product/glossary.md`
  adds `### remote ship`, `### chassis form`, `### finish`, `### shot style`; updates `### appearance`
  (public projection), `### part` (1,351 rows, 11 slots), `### hangar tab` (six tabs, 244/120 totals,
  `<owned>/<total>` badge) and `### part slot` (11 slots including `shot`). `docs/features/README.md`
  is **not** edited; the proposed row is recorded in `build-log-T17.md`. Evidence: exact-string
  greps and `git status --porcelain -- docs/features ':(exclude)docs/features/remote-spaceship-customization'`.
- **AC-35 — Containerization impact.** No new service, image, deployable, port, host mapping,
  environment variable or health signal; `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles and
  the `GET /ws` endpoint are unchanged; `podman compose up` is unchanged. `tests/e2e/smoke.mjs` gains
  one check: guest B sends a valid 11-slot `setAppearance` and guest A receives exactly one
  `memberAppearance` for B with the same record, while A's roster entry for B had `appearance: {}`
  before it; a malformed frame (unknown slot key) yields `error bad_message` and no broadcast.
  Evidence: smoke transcript, diff gate on container paths.
- **AC-36 — Persistence, rollback and dependencies.** No schema or migration change:
  `src/backend/src/db/schema.sql`, `src/backend/src/db/migrations/**`,
  `customization_version` (stays `2`) and `src/backend/src/auth/economy-repository.ts`'s **storage
  shape** are unchanged except the catalog type/normalizer imports and the widened part/slot
  parameter types. A `user_economy` row written before this feature loads unchanged; a row with v3
  ids round-trips through `findCustomizationByUserId` → `setSlotAppearance` →
  `findCustomizationByUserId` with the ids intact. Rollback safety: an older build's normalizer drops
  v3 ids (appearance falls back to classics, inventory entries are ignored) without error — recorded
  as the accepted degradation. `package.json`, `package-lock.json`, both workspace `package.json`
  files are unchanged (`git diff --exit-code` against `BASE`). Evidence: `economy-repository.test.ts`,
  final build log.

## Catalog tables (pinned)

### Slots and nouns (`SLOT_CATALOG_V3` order)

| # | slot | display name | `SLOT_NOUN` | classic rows | generated rows | total |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `hull` | Hull | `Hull` | 3 | 120 | 123 |
| 2 | `nose` | Nose | `Nose` | 3 | 120 | 123 |
| 3 | `cockpit` | Cockpit | `Canopy` | 3 | 120 | 123 |
| 4 | `wing-left` | Port Wing | `Port Wing` | 3 | 120 | 123 |
| 5 | `wing-right` | Starboard Wing | `Starboard Wing` | 3 | 120 | 123 |
| 6 | `engine-left` | Port Engine | `Port Engine` | 3 | 120 | 123 |
| 7 | `engine-right` | Starboard Engine | `Starboard Engine` | 3 | 120 | 123 |
| 8 | `ignition-left` | Port Ignition | `Port Flame` | 3 | 120 | 123 |
| 9 | `ignition-right` | Starboard Ignition | `Starboard Flame` | 3 | 120 | 123 |
| 10 | `tail-fin` | Tail Fin | `Tail Fin` | 3 | 120 | 123 |
| 11 | `shot` | Shot | `Bolt` | 1 (`shot-default`) | 120 | 121 |

### Forms (`FORM_CATALOG`, this order)

Recipes are the numeric inputs of the renderer's form transform (§ Plan § Form transform). `classic`
uses the accepted v2 per-slot transform tables unchanged and has chassis `[1, 1, 1]`. `muzzle` is
the muzzle-flash form consumed by AC-24.

| # | form | label | `lengthScale` | `widthScale` | `sweepDeg` | `thicknessScale` | `offsetZ` | chassis `[x,y,z]` | shot geometry | shot scale | muzzle |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `classic` | Classic | — | — | — | — | — | `[1, 1, 1]` | `bolt` | 1 | `spark` |
| 1 | `dart` | Dart | 1.15 | 0.85 | 18 | 0.9 | 0.02 | `[0.95, 0.9, 1.25]` | `bolt` | 1 | `spark` |
| 2 | `lance` | Lance | 1.3 | 0.8 | 12 | 0.95 | 0.04 | `[0.9, 0.85, 1.35]` | `bolt` | 1.25 | `spark` |
| 3 | `needle` | Needle | 1.25 | 0.7 | 8 | 0.8 | 0.05 | `[0.8, 0.8, 1.4]` | `bolt` | 0.85 | `spark` |
| 4 | `manta` | Manta | 1.0 | 1.25 | 32 | 0.85 | 0 | `[1.2, 0.85, 1.0]` | `wave` | 1.15 | `petal` |
| 5 | `hauler` | Hauler | 0.9 | 1.15 | 6 | 1.2 | −0.02 | `[1.15, 1.1, 0.85]` | `orb` | 1.1 | `ring` |
| 6 | `bulwark` | Bulwark | 0.95 | 1.1 | 10 | 1.3 | −0.03 | `[1.1, 1.15, 0.9]` | `orb` | 1.2 | `ring` |
| 7 | `arrow` | Arrow | 1.1 | 0.95 | 24 | 0.9 | 0.01 | `[0.95, 0.95, 1.2]` | `shard` | 1 | `petal` |
| 8 | `orca` | Orca | 1.05 | 1.2 | 14 | 1.0 | 0 | `[1.1, 1.0, 1.05]` | `wave` | 1.2 | `petal` |
| 9 | `talon` | Talon | 1.0 | 1.0 | 28 | 0.85 | 0.03 | `[1.0, 0.9, 1.1]` | `shard` | 1.05 | `spark` |
| 10 | `kite` | Kite | 1.1 | 1.05 | 38 | 0.9 | 0 | `[1.05, 1.0, 1.1]` | `orb` | 0.95 | `ring` |

### Finishes (`FINISH_CATALOG`, this order — six rare, six epic)

| # | finish | label | color | accent | rarity |
| --- | --- | --- | --- | --- | --- |
| 0 | `chrome` | Chrome | `#c9d4e2` | `#ffffff` | rare |
| 1 | `azure` | Azure | `#2f6fd6` | `#7cf6ff` | rare |
| 2 | `ember` | Ember | `#c2410c` | `#ffb35c` | rare |
| 3 | `jade` | Jade | `#15803d` | `#86efac` | rare |
| 4 | `steel` | Steel | `#64748b` | `#cbd5e1` | rare |
| 5 | `ivory` | Ivory | `#e7e5e4` | `#fafaf9` | rare |
| 6 | `abyss` | Abyss | `#0f172a` | `#38bdf8` | epic |
| 7 | `aurum` | Aurum | `#ccaa44` | `#fff3d6` | epic |
| 8 | `violet` | Violet | `#6d28d9` | `#c4b5fd` | epic |
| 9 | `crimson` | Crimson | `#9f1239` | `#fb7185` | epic |
| 10 | `plasma` | Plasma | `#a855f7` | `#f0abfc` | epic |
| 11 | `solar` | Solar | `#f59e0b` | `#fef3c7` | epic |

### Row order and counting rule

Per slot in `SLOT_CATALOG_V3` order: the classic rows first in v2 order, then for each generated form
in `FORM_CATALOG` order, for each finish in `FINISH_CATALOG` order. **A "customization" is one
distinct catalog row (one part id) that can be owned and equipped.** The catalog has exactly
**1,351** rows, of which **1,340** are lootable (`rare` 670, `epic` 670, weight total 2,680 → 75 % /
25 %) and **11** are standard. The `shot` slot's standard row is
`{ id: 'shot-default', slot: 'shot', name: 'Standard Bolt', rarity: 'standard', color: '#fff1c8',
accent: '#ffd27a', form: 'classic', finish: 'classic', shape: 'standard' }`.

## Non-goals

- No ship rendering for non-spectated members: the accepted camera layouts put every other cube
  off-screen (`SLOT_SPACING = 24` vs. ≈ 8.95 half-width at the cube plane), so a ship there would be
  an invisible draw. The appearance data is carried for **every** member so a future camera/overview
  change can render them without a protocol change (Q-1).
- No remote ship movement, pointer following, travel animation, banking, trails or level-complete
  fly-by; only idle bob/sway and firing.
- No camera changes, no spectate-view rotation, no overview/map mode, no free camera.
- No trading, gifting, crafting, fusing, salvage or duplicate conversion; duplicate counts keep the
  accepted behavior (Q-3).
- No targeted unlock, pity system, part shop, currency-priced cosmetics or battle pass.
- No catalog enumeration on the wire, no per-member inventory on the wire, no `stateSync` growth, no
  protocol version bump.
- No new dependency, asset, texture, font, model loader, sound or audio; everything stays procedural.
- No change to the accepted shot pacing (`SHOT_TRAVEL_MS` 180, muzzle flash duration, ignition
  flicker), the 1290 ms reveal timeline, the board/grid/style cycle, the economy, upgrades or the
  lootbox/key counts.
- No change to menu motion, panel placement, breakpoints, z-index table, live regions or the
  deferred-chunk/bundle architecture beyond the catalog module's own bytes.
- No localisation, no user-authored names, no free text anywhere.

## Boundaries

- ✅ Always: keep `game/**`, `multiplayer/**` and the new pure modules DOM-free and injected-input
  only; keep the layering intact — `game/ship-forms.ts` imports only pure `game/**` modules (never
  `render/**` or `three`), and the v2 shape-table resolution helper lives in `render/cursor-ship.ts`,
  which owns the table; multiply the chassis by the equip pulse (never overwrite it); keep the server
  authoritative for membership, boards, positions and account appearance; validate every client value
  structurally and against the catalog; keep the 30 classic rows byte-identical; derive both
  workspaces' catalogs from the same pinned tables; normalize the optional appearance field on every
  client decode path; test every behavior change with concrete expected values; run
  lint/typecheck/tests/coverage before reporting done; record raw evidence in build logs; stage only
  `files_owned`.
- ⚠️ Ask first: any new dependency; a different catalog size/counting rule, form/finish table, tab
  set or remote-ship visibility rule than Q-1/Q-2; any change to `compose.yaml`,
  `compose.smoke.yaml`, Dockerfiles, `MAX_MESSAGE_BYTES` or the bundle ceilings; any coverage
  exclusion or threshold change; editing `src/backend/src/game/parts-v2.ts`,
  `src/frontend/src/game/parts-v2.ts` or another feature's artifacts; touching `.env*`.
- 🚫 Never: weaken or delete an assertion without an equal-or-stronger replacement; enumerate the
  catalog or a member's inventory in a broadcast; trust a client-supplied appearance for an account;
  send `accountId`, token, coins or upgrade levels to other members; add a second source of truth for
  the slot/form/finish tables; add a per-frame allocation to the ship/pose path; introduce a second
  polite live region; commit secrets; `git push`; edit predecessor specs/plans/tasks.

## Security considerations

- **User-controlled data.** `setAppearance.appearance` (guests only) is the only new client-authored
  value: the codec bounds it (≤ 11 entries, known slot keys, ≤ 40-character values, ≤ 700 encoded
  bytes) and the hub resolves every value against the v3 catalog, dropping unknown or wrong-slot
  ids. It never affects boards, positions, economy, membership or another member's state. On read,
  `memberAppearanceOf` is the single normalization gate, so a malformed or absent field can never
  reach a renderer.
- **Authority matrix.** Accounts: persisted appearance, ownership-validated, client `setAppearance`
  silently ignored — a forged loadout is impossible. Guests: no persisted inventory exists by
  accepted design, so the hub pins a structurally valid cosmetic loadout without ownership proof;
  this is a **cosmetic-only** residual (Q-4), carries no advantage, and is bounded by the catalog
  and the rate limit. The identity tension (no accounts ⇒ no guest ownership proof) is recorded as
  Q-4 rather than silently resolved.
- **Privacy.** `MemberState.appearance` and `memberAppearance` carry only slot→part-id strings that
  are rendered on screen by definition; never inventory counts, `parts`, coins, upgrades, `accountId`,
  tokens, email, IP or free text. `customizationUpdate` stays account-scoped.
- **Abuse bounds.** `setAppearance` ≤ 10/s per member; `memberAppearance` fan-out ≤ X − 1 per
  accepted change; `MAX_MESSAGE_BYTES` 1024 and `MAX_CONNECTIONS` 200 unchanged; the catalog is a
  fixed 1,351 rows so no memory growth is user-driven; the appearance record is capped at 11 entries
  so no unbounded map can be stored.
- **Persistence integrity.** No schema change; the existing `NOT NULL DEFAULT '{}'` JSONB columns are
  read through the v3 normalizer which drops unknown ids defensively; a failed write aborts the
  handler as today; parameterized SQL only; no new query.
- **Rendering safety.** The remote ship is procedural geometry with catalog-derived colours; no
  loader, URL, texture, `innerHTML` or `eval`; all DOM text is catalog text (React-escaped); the
  catalog names are generated from pinned word tables, never from user input.
- **Test integrity as a control.** Catalog parity is guarded by a shared hash literal and exact
  counts; the classic rows are asserted verbatim; the repository round-trip test prevents the
  "silently dropped v3 ids" failure mode; the scene fixtures are pinned to the measured accepted
  counts.

## Testing strategy

- **Unit (Vitest, node) — backend.** `parts-v3.test.ts` (AC-1…AC-6: counts, order, ids/names
  including the 30-character worst id, classic verbatim, form/finish tables, loot boundaries and
  weights with the `NaN`/infinity map, normalization, hash, form coverage); `protocol.test.ts`
  (AC-7…AC-9, optional-field decode, payload bounds, defensive copies, parity fixtures);
  `economy-repository.test.ts` (AC-5/AC-36: read/write with v3 ids, widened signatures, legacy rows);
  `metrics.test.ts` (AC-14 allow-lists); `hub.test.ts` (AC-10…AC-14: account seeding at join/rejoin,
  equip fan-out per member/`playerId` on that member's server including the **same-server two-tab**
  fixture, guest path, account refusal, the true-trailing-window boundary at 950/1000 ms, grace/move
  convergence, the 24-member welcome fixture, payload sizes).
- **Unit (Vitest, node) — frontend.** `parts-v3.test.ts` (mirror of the backend catalog ACs);
  `ship-forms.test.ts` (form transform formula, chassis pose, classic identity, every form covered,
  and the import boundary: the module's source imports only `./parts-v3.js` and no `three`/
  `../render/**`); `cursor-ship.test.ts` (AC-17: v3 resolution, classic visuals unchanged, chassis
  stored, `applyPulseScale` multiplies the chassis, idempotent writes); `shot-visuals.test.ts`
  (AC-23/AC-24: four projectile + three muzzle geometries, two materials, no per-shot allocation);
  `spaceship.test.ts` (AC-17/AC-24/AC-25: chassis × pulse after an `update` at rest and at the 130 ms
  pulse peak, classic `[1,1,1]`, style switch, spawn capture, no-op repeat, legacy default);
  `remote-ship.test.ts` (AC-15…AC-22, AC-26: anchor/hierarchy/aim, appearance, live re-skin, idle
  values, firing rate/cap, fallback target, recoil curve, reduced motion, disposal, the
  **182/246/358 idle** and **185/249/361 peak** object counts, picking isolation); `preview.test.ts`
  (AC-31: v3 appearance renders on the preview model, 11-entry input, `shot` ignored for geometry);
  `reveal-motion.test.ts` (AC-31: `shot` yaw); `hangar-tabs.test.ts` (AC-27).
- **Integration (Vitest jsdom + real three.js).** `scene.test.ts` (AC-15/AC-17/AC-20/AC-22/AC-25/
  AC-26: `setSpectatedMember` + `setSpectatedAppearance` wiring, one ship, live re-skin, firing on
  broadcast, tier meshes, exact object counts at the idle, two-bolt and peak fixtures, the own ship's
  chassis surviving an update, dispose on world swap/dispose);
  `world.test.ts` (`tileOrigin`, roster copy appearance default, unchanged cube behavior);
  `server-state.test.ts` (member appearance in `members`, missing-field default, referential
  stability); `session.test.ts` (AC-13/AC-15: guest adoption of the roster self appearance then one
  send if different, no send for accounts, spectate arrive/leave → ship lifecycle, live
  `memberAppearance` forwarding); `SpaceshipCustomizationPanel.test.tsx` (AC-28…AC-30: rows, form
  strip, grid counts, per-strip roving tabindex, payload attributes, all four control-count fixtures,
  a generated v3 id and the `shot` slot, tab structure); `SpaceshipPreview.test.tsx` (AC-31: v3 ids,
  legacy colour attributes from v3); `LootboxReveal.test.tsx`, `lootbox-reveal.test.ts` (AC-31);
  `App.test.tsx` (updated panel assertions: six tabs, new totals; the accepted shell assertions
  unchanged, and its `MemberState` fixtures compile untouched because `appearance` is optional).
- **Backend integration (real hub + fake peers + manual clock).** `hub.test.ts` sequences: account
  join/rejoin seeds `MemberState.appearance` from the persisted customization; two guests join → B
  `setAppearance` → A receives one `memberAppearance`; an account with two tabs on the **same**
  server emits **two** frames (one per `playerId`), and two tabs on **two** servers emit one frame
  each; the `setAppearance` limiter admits 10 in `(−50, 950]` and admits again at `t = 1000`; resume
  and move carry the appearance; the 24-member welcome fixture measures ≤ 17,408 B.
- **Containerized e2e.** `npm run smoke` with the AC-35 check (guest appearance round trip +
  `bad_message` on an unknown slot key); recorded transcript.
- **Coverage.** `npm run coverage` — statements, branches, functions and lines ≥ 80 in both
  workspaces; new modules included; no exclusion and no threshold change. Per-task pre-gate:
  `npm run coverage --workspace @cubeclicker/backend` / `@cubeclicker/frontend`.
- **Assertion bar.** Concrete values everywhere (counts 1,351/1,340/670/670, ids, hex colours, pose
  numbers, byte bounds 492/700/17,408, scene counts 182/246/358 idle and 185/249/361 peak, timer
  boundaries); no
  `expect.anything`/`toMatchObject`-only, snapshot-only or assertion-free tests; every
  inherited-suite assertion that changes is rewritten as a replacement with the new contract, never
  deleted.

## Real-time impact (contract)

- **Server authority.** Membership, boards, positions, counters and **account** appearance remain
  server-authoritative. Guest appearance is a structural, cosmetic-only, server-pinned projection
  (Q-4). No client value becomes authoritative for shared game state.
- **New shared/cross-client state.** The equipped appearance of every member is now public within
  their server (previously owner-only). It is a presentation value: it cannot influence boards,
  movement, economy or ranking. The catalog is never transmitted.
- **Connection lifecycle.** `hello` → `join`/`rejoin` → `welcome` unchanged. Appearance is seeded in
  `welcome.roster` (self included; accounts from persistence, guests from `{}` then a one-time
  `setAppearance`), updated by `memberAppearance`, and travels with a mover's `worldEntered` roster.
  A guest re-reports once after `welcome` only when it differs, and adopts the stored record first so
  its own view is never stale; an account never reports. Appearance change is immediate and not
  coalesced (rare, human-paced, rate-limited).
- **Reconnection.** A resume inside grace restores the member and their stored appearance; a guest
  adopts it into the engine (ship, preview, hangar); a fresh identity starts at `{}`. A missed
  `memberAppearance` leaves the last known outfit until the next `welcome`/`memberJoined`/
  `memberAppearance` — a presentation delta, never state corruption (`realtime.md` contract); the ship
  never blocks or errors.
- **Multi-client.** One connection = one member. Two tabs of one account are two members (possibly on
  two servers): equipping updates both members' appearances and emits **one `memberAppearance` frame
  per affected member on that member's server** — two tabs on the same server receive two frames
  (one per `playerId`), two tabs on two servers receive one frame each — so a sibling tab's ship
  updates in both layouts; only the opener's tabs get `customizationUpdate`.
- **Spectating liveness.** A `memberAppearance` for the currently mounted member reaches the ship
  through `SceneView.setSpectatedAppearance` in the same message turn, so a spectator watching an
  owner who equips a new part or shot style sees the change without re-entering spectate.
- **Latency and loss.** Remote ship firing is derived from the already-authoritative removal
  broadcasts, so it inherits their ordering and their loss tolerance: a dropped removal frame skips
  one shot and the tile stays visible until the next snapshot. No new queue, retry or timer.
- **Identity vs. "no accounts".** Appearance visibility does **not** require accounts. The conflict is
  that guests cannot prove ownership; it is flagged as Q-4 with a recommended default (structural
  validation only) rather than resolved silently.

## Containerization impact

None beyond the existing path: no new service, image, deployable, port, host mapping, environment
variable, health signal or WebSocket endpoint change; `compose.yaml`, `compose.smoke.yaml` and both
Dockerfiles are untouched; the backend still exposes `GET /ws` on 8080 and the frontend keeps its
Vite dev server and static build. The only delivery-adjacent change is the frontend bundle growing by
the catalog module (measured ≈ 14.4 KB gzip, ≈ 4 KB total headroom, AC-33) and the smoke script
gaining the AC-35 check.

## Open questions

- **Q-1 — Remote ship visibility (user-owned; recommended default: spectated only).** Default:
  exactly one remote ship, for the member being spectated, because every other cube is off-camera in
  the accepted layouts. Alternative A: render ships for the nearest 3 members anyway (≈ 27 invisible
  draws per view; no visual benefit until the camera changes). Alternative B: add an overview/map
  camera so several ships are on screen (a new camera feature). Default accepted unless overridden.
- **Q-2 — Catalog size and counting rule (pinned).** Default: 1,351 distinct part ids (11 slots ×
  classic rows + 10 forms × 12 finishes), counting every ownable/equippable row. Alternative: count
  slots × forms only (~121) — fails "1000+". Not blocking; pinned.
- **Q-3 — Loot pacing at 1,340 lootable parts (user-owned; recommended default: keep the accepted
  odds).** Default: one weighted draw, 75 %/25 % aggregate, per-part 0.1119 %/0.0373 %, duplicates
  increment counts and never convert. Alternative A: unlock a whole form family (12 finishes) per
  draw — fewer, chunkier unlocks. Alternative B: duplicate → key conversion — an economy change owned
  by `coin-economy`. Default accepted unless overridden.
- **Q-4 — Guest cosmetic authority (user-owned; recommended default: structural validation only).**
  Default: a guest's reported loadout is normalized and pinned without ownership proof (guests have
  no persisted inventory). Alternative: guests render only classic defaults and the server rejects
  their `setAppearance` — consistent with "no guest persistence" but makes guest ships uniform and
  fails the user's "other players' ships with their customizations" for the guest majority. Default
  accepted unless overridden; flagged because it is the identity-vs-authority tension of this
  feature.
- **Q-5 — `shot` as an 11th slot (pinned).** Default: a dedicated `shot` slot + `Shots` tab so shot
  style is its own collectible. Alternative: derive the shot style from the equipped `nose` — no
  extra tab, but it couples two customization intents and makes the request's "shooting animations"
  implicit. Pinned.
- **Q-6 — `customization_version` (pinned).** Default: keep the DB column at `2` (storage shape is
  unchanged and every v2 id stays valid) while the code catalog version becomes `3`; no migration.
  Alternative: bump the column to `3` with a no-op migration — churn without a reader. Pinned.
- **Q-7 — Appearance change cadence (pinned).** Default: immediate `memberAppearance` per accepted
  change, rate-limited at 10/s. Alternative: coalesce at 100 ms — unnecessary at human equip rates
  and harder to reason about. Pinned.
- **Q-8 — Locked parts visible in the hangar (pinned).** Default: yes, as today (the grid shows
  locked cells with `Locked`), so players can see what exists. Alternative: hide locked parts —
  discovery would depend on loot luck. Pinned.

## Assumptions

- The stack is decided (TypeScript strict, Fastify WebSocket, React/Vite, npm workspaces, Vitest);
  no new dependency, asset, service or container change is needed.
- "1000+ customizations" means distinct ownable/equippable catalog rows; 1,351 satisfies it with the
  pinned counting rule.
- The two workspaces duplicate the same small source tables and generator (no shared package exists),
  and the pinned `CATALOG_ROWS_HASH` plus exact counts guard the mirror.
- The generated catalogs measure ≈ 14.4 KB gzip (≈ 114.4 KB initial, ≈ 295.8 KB total, ≈ 4 KB total
  headroom); the build is the gate, not an estimate in prose.
- The spectated member is the only remote cube on screen in the accepted camera layouts; the mounted
  remote ship therefore adds **36 objects / 21 draws at rest** (peak 39 / 24 with two bolts and one
  live muzzle) only while spectating, and the accepted scene counts (135/146/210/322) return exactly
  when no ship is mounted.
- `MemberState.appearance` stays optional on the wire so every existing full-literal fixture compiles
  untouched; the runtime record is always normalized by `memberAppearanceOf`.
- `coin-economy` is `building`; its open fix-up round owns `src/frontend/src/game/engine.test.ts`
  (F1/F2) and `src/backend/src/game/hub.test.ts` (F3) plus the shared production files — this
  feature's edits to those files are additive and must be sequenced after that round (plan § Risks
  R1).
- Appearance is public by nature; no account identity, inventory or economy value becomes public.
- The v2 modules stay untouched and green; v3 becomes the runtime catalog (same compatibility
  policy v1→v2 used).
- Reduced-motion behaviour is authoritative; the quality tier may reduce detail but cannot re-enable
  suppressed motion.

## Revision history

- r1 — 2026-11-18 — initial draft (planning phase).
- r2 — 2026-11-18 — resolves spec review r1 (F1–F19): corrected the all-owned `Shots` control count
  to 13 and added the generated-form fixture (F1); re-pinned the scene budget to the measured
  135/146/210/322 counts with the ship's +37 objects and the 183/247/359 fixtures (F2; the +37
  delta and the 183/247/359 totals were superseded by r3/N1 — see below); made
  `MemberState.appearance` optional on the wire with `memberAppearanceOf` normalization so no unowned
  fixture changes (F3); extended the `coin-economy` gate to T8/T17 and every shared file including the
  test files (F4); pinned the exact 24-member welcome fixture and the 17,408 B outbound budget with
  the incoming-only `MAX_MESSAGE_BYTES` note (F5); added `setSpectatedAppearance` and the live
  re-skin path (F6); added the preview files, `appearanceToShipParamsV3`, the preview test and the
  T9→T15 dependency (F7); rewrote the README/glossary/observability documentation requirements (F8);
  added guest adoption of the roster self appearance (F9); added the panel's v3 normalizer switch and
  v3-id test (F10); scoped the roving tabindex per strip (F11); corrected the 30-character worst id
  (F12); pinned the `NaN`/infinity loot map (F13); split the aim (root) from the sway/recoil (body
  child) (F14); pinned `MOTION.remoteShipRecoilMs` and the recoil curve (F15); replaced the dead
  `burst` field with a consumed `muzzle` form and three muzzle geometries (F16); corrected and
  extended the supersession ledger including AC-7/AC-8/AC-31, `adaptive-render-budget-v2` and the
  37-object count (F17); replaced the bundle estimate with the measured ≈ 14.4 KB and ≈ 4 KB headroom
  (F18); added the account join/rejoin appearance-seeding assertion (F19).
- r3 — 2026-11-18 — resolves spec review r2 (N1–N7): re-derived the scene arithmetic with the
  `remote-ship-body` and the live muzzle — 36 objects / 21 draws at rest, +1/+1 per bolt, +1/+1 per
  muzzle, peak 39 / 24 — and pinned the idle fixture at 182/246/358 with the peak at 185/249/361
  (N1); pinned the chassis × equip-pulse composition (`CursorShipModel.applyPulseScale`,
  `Spaceship.applyPulse` calls it, rest/peak values, classic identity) (N2); corrected the
  supersession ledger (AC-16-only row with AC-15/migration 006 retained, the adaptive tier row
  reframed, the AC-13 quote "≤ X × 7 meshes per world", N1 numbers) (N3); extended the T17/T18
  evidence with the exact README greps, both `parts-v2.test.ts` paths, `server.ts`,
  `docs/features/README.md` and the features-index status check (N4); pinned the same-server
  two-tab fan-out rule in AC-10/§ Real-time impact with a `hub.test.ts` fixture (N5); pinned the
  true trailing rate window and its 950/1000 ms boundary (N6); pinned the layering (pure
  `game/ship-forms.ts`, the resolution helper in `render/cursor-ship.ts`) with an import-boundary
  test (N7); and made T2 depend on T1 so the `CATALOG_ROWS_HASH` cross-check has an owner.

## Review response (spec-r1)

| ID | Severity | Disposition | What changed |
| --- | --- | --- | --- |
| F1 | BLOCKER | Fixed | AC-30: all-owned `Shots` is **13** (11 form buttons + 1 unequip + 1 equip); added the generated-form fixture (ship tab 48, `Shots` 24). |
| F2 | BLOCKER | Fixed (count superseded by r3/N1) | § Context and AC-22 now use the measured 135/146/210/322 counts; the r2 ship delta (37) was wrong and r3 pins 36/21 at rest → 182/246/358 idle, 39/24 peak → 185/249/361. |
| F3 | BLOCKER | Fixed (preferred option) | AC-7: `appearance?` optional on the wire, server always populates, `memberAppearanceOf` fills `{}` on every decode/copy path; `UserPanel.test.tsx`/`activity-lifetime.test.ts`/`App.test.tsx` compile untouched (stated in AC-7 and the plan inventory). |
| F4 | BLOCKER | Fixed | Tasks gate now covers T3, T5, T6, **T8**, T13, T17 and every shared file incl. `engine.test.ts`, `hub.test.ts`, `protocol.test.ts`, `economy-repository.test.ts`, `session.test.ts`, `glossary.md`; plan R1 updated; the coin-economy round must reach `code_review` first. |
| F5 | MAJOR | Fixed | AC-14 pins the 24-guest `removedIds: []` + full-appearance fixture at ≤ 17,408 B (measured 16,710 B), ≤ 550 B/member appearance, and states `MAX_MESSAGE_BYTES` is incoming-only; the full-inventory welcome (51,763 B) is explicitly out of bound. |
| F6 | MAJOR | Fixed | AC-15 adds `SceneView.setSpectatedAppearance(playerId, appearance)`; AC-17 pins the live re-skin (no remount); T12 carries AC-17/AC-26 and `scene.test.ts`/`remote-ship.test.ts` evidence; session handler wiring in AC-13/T13. |
| F7 | MAJOR | Fixed | `render/preview.ts`+test added to T9, `ui/SpaceshipPreview.tsx`+test to T15; both switch to `appearanceToShipParamsV3`; AC-31 pins the 11-slot mapping, the 10 v3-valued attributes and the legacy colour attributes; T15 depends on T9; plan inventory updated. |
| F8 | MAJOR | Fixed | AC-34/T17 rewrite the README customization paragraph (six tabs, 244/120, no five-tab/`n/4` text), glossary `hangar tab`/`part slot`, and `docs/architecture/observability.md` allow-list rows + paragraph; `docs/features/README.md` stays proposal-only. |
| F9 | MAJOR | Fixed | AC-13(b): the guest session adopts `welcome.roster[self].appearance` when its local record is empty, then sends only on difference; `session.test.ts` evidence; Real-time impact updated. |
| F10 | MAJOR | Fixed | T15 switches the panel's `normalizePartMap`/`normalizeAppearance`/`isValidPartId`/`partDefinition`/`partsForSlot` to v3 and adds a generated-v3-id + `shot` panel test; AC-5/AC-31 acceptance updated. |
| F11 | MINOR | Fixed | AC-29: exactly one `tabindex="0"` **per `.customization-forms` strip** (two on a ship tab, one on `Shots`). |
| F12 | MINOR | Fixed | AC-2/AC-9/AC-14 use the 30-character `ignition-right-bulwark-crimson` worst id and the measured 492 B `memberAppearance`. |
| F13 | MINOR | Fixed | AC-4 pins `NaN → 0`, `-Infinity → 0`, `Infinity → 1`. |
| F14 | MINOR | Fixed | AC-16/AC-19: aim on the `remote-ship` root, bob/sway/recoil on the `remote-ship-body` child; AC-16 measured at rest. |
| F15 | MINOR | Fixed | AC-20 pins `MOTION.remoteShipRecoilMs === 120`, `-0.12` offset and the `0 / 60 / 120 ms` curve values; dropped shots start no recoil. |
| F16 | MINOR | Fixed | `burst` replaced by the consumed `muzzle` form (`spark`/`ring`/`petal`) with three prebuilt muzzle geometries in AC-24 and remote use in AC-26. |
| F17 | MINOR | Fixed | Ledger corrected: added AC-7, AC-8, AC-31 and `adaptive-render-budget-v2` rows; `multiplayer-servers` cites AC-13; AC-15 (`customizationUpdate`) moved to the "not superseded" note; object count aligned to 37. |
| F18 | MINOR | Fixed | AC-33/§ Context/Assumptions use ≈ 14.4 KB gzip, ≈ 114.4 KB initial, ≈ 295.8 KB total and the ≈ 4 KB total headroom; the 12–20 KB claim is gone. |
| F19 | MINOR | Fixed | AC-13(a) requires the account's `MemberState.appearance` to be seeded from the persisted customization at join and rejoin, with `hub.test.ts` evidence. |
| F20 | INFO | Acknowledged | No change required; the raw request remains covered. |

## Review response (spec-r2)

| ID | Severity | Disposition | What changed |
| --- | --- | --- | --- |
| N1 | BLOCKER | Fixed | AC-22/§ Context/AC-34/§ Assumptions now use the pinned hierarchy with the `remote-ship-body` and the live muzzle: **36 objects / 21 draws at rest**, **+1/+1 per bolt**, **+1/+1 per muzzle**, peak **39 / 24**; the idle fixture is **182/246/358** and the peak is **185/249/361**. The "exactly 37" / 183/247/359 / ≤ 23 draws claims are removed from AC-22, AC-34, Context, Assumptions, plan R6, T11/T12/T18 and the AC-8/AC-13 supersession rows. |
| N2 | MAJOR | Fixed | AC-17 pins `CursorShipModel.applyPulseScale` (multiplies the stored chassis) and `Spaceship.applyPulse` calling it, with rest `[0.95, 0.9, 1.25]`, pulse-peak `[0.988, 0.936, 1.3]` at 130 ms and classic `[1,1,1] → [1.04,1.04,1.04]`; `spaceship.test.ts`/`scene.test.ts` evidence; the `spaceship.ts` edit is owned by T10 (which already owns the file and depends on T9), while T9 owns the model/table/scale API. |
| N3 | MINOR | Fixed | Ledger: the normalization row is **AC-16 only** with AC-15/migration 006 explicitly retained; the `adaptive-render-budget-v2` row is reframed as "tier matrix unchanged; the remote ship consumes the hidden-detail list" citing AC-8/AC-47 + `multiplayer-servers` AC-13 for the baseline; the AC-13 quote is "≤ X × 7 meshes per world" with the layout/one-view rule retained; the AC-8/AC-13 numbers follow N1. |
| N4 | MINOR | Fixed | T17 verify adds `grep -F "form and finish picker" README.md`, `grep -F "shot styles" README.md` and the features-index `git status --porcelain` check; T17 prose uses those exact phrases. T18's diff gate adds both `parts-v2.test.ts` paths, `src/backend/src/server.ts`, `docs/features/README.md` and the same status check. |
| N5 | MINOR | Fixed | AC-10 states one frame per affected member/`playerId` on that member's server (same server ⇒ two frames; two servers ⇒ one each); § Real-time impact matches; `hub.test.ts` gains the same-server two-tab fixture (T6). |
| N6 | MINOR | Fixed | AC-12 pins the true trailing window: a frame is forgotten at `now − 1000 ms` (`<=`); 10 frames at `t = 0…900` admit nothing at `t = 950` and admit again at `t = 1000`; fake-timer evidence (T6). |
| N7 | MINOR | Fixed | The resolution helper is pinned in `render/cursor-ship.ts` (which owns `CURSOR_SLOT_SHAPE_TRANSFORMS`); `game/ship-forms.ts` imports only pure `game/**` (no `three`, no `render/**`), enforced by a source/import-boundary assertion in `ship-forms.test.ts` (T9) and stated in § Boundaries. |
| — | Process | Fixed | **T2 now depends on T1** (the `T1 ∥ T2` parallel marker is removed) so the `CATALOG_ROWS_HASH` cross-check is owned; T1/T18 still record both literals. |
