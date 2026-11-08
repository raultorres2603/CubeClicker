---
feature: spaceship-cursor-loot-animations
revision: 2
status: draft
created: 2026-11-08
updated: 2026-11-08
---

# Spec — Pointer ship, granular loot parts, satisfying animations

## Summary

Replace the default pointer-following spaceship cursor's seven-primitive model with a small,
restrained procedural craft that reads as realistic rather than toy-like (metallic hull, framed
canopy, swept wings, twin engines, panel seams and flames) while preserving every accepted cursor
behavior: follow smoothing, NDC offset, plane distance, scale, shots, ignitions, reduced motion and
local-only presentation. Replace the current whole-category loot catalog (one `wings` item colours
both wings) with a **per-slot part model**: a lootbox grants exactly one specific part for one
specific slot (e.g. the left wing, the cockpit, one ignition), with independent left/right
ownership, rarity, duplicates, per-slot equip/unequip and a slot-by-slot customization UI. Keep
inventory, opening and equip server-authoritative for accounts, persist them in the existing
`user_economy` row with a versioned migration/backfill for legacy inventories, and keep guest play
ephemeral. Add a coherent motion system for the click-to-shot-to-pop loop, the cursor ship, the HUD
and a lootbox reveal, with pinned durations/easings, reduced-motion variants and frame/bundle
budgets.

The third pillar is derived from the user's reference video
`/home/raultorraco/Downloads/gemini_generated_video_6c10d7c9.mp4`, which was inspected read-only on
2026-11-08 (24 fps; 10.0 s; 1280×720; 40 reference frames + 3 contact sheets under
`reference/`). **Observed beats** are measured from those frames: target lock/reticle, one-frame
cube conceal, 12-ray/14-shard/6-coin impact, coin popup ≈1.1–1.2 s, golden wireframe orb with ≈25 %
overshoot, 330 ms ring growth, 760 ms level burst, banner ≈8 % overshoot, ship 360° roll with fire
trail, no screen shake and audio alignment within 2–5 frames. **Extrapolated beats** — lootbox
panel/reveal, part equip, upgrade purchase and the custom cursor ship/trail — are absent from the
video; they are defined as an explicit adaptation of the nearest observed envelope and marked `[E]`
in § Reference mapping. No video, frame, audio, texture or external asset is shipped.

## User stories

- As a player, the spaceship trailing my pointer looks like a small, believable craft — a clean
  metal hull, canopy, wings, twin engines and subtle panel detail — instead of a toy made of three
  primitives.
- As a player, opening a lootbox gives me one specific part (the left wing, the cockpit, the left
  ignition, etc.), so collecting and equipping is granular and expressive.
- As a player, I can equip different left and right wing/engine/ignition parts and see the ship
  update immediately, including an asymmetric loadout.
- As a player, I can see which parts I own and which are still locked for every slot, and equip or
  unequip each slot with a clear, accessible control.
- As a player, opening a lootbox and equipping a part feels satisfying: a wireframe charge orb
  pulses and burst-reveals the card with rarity/duplicate feedback, and the ship pulses as it
  changes (an extrapolation of the video's orb/banner language; the video has no lootbox panel).
- As a player, clicks, explosions, coins and upgrades feel connected by one motion language rather
  than unrelated effects.
- As a player who prefers reduced motion, every new animation has a static or instant variant and
  the ship never banks, trails, pulses or flickers.
- As an account holder, my parts, appearance and versioned legacy inventory survive reconnect and
  are consistent across my tabs; as a guest, I can still open/equip locally with no account.

## Scope decision and phasing

This is one feature by the user's direction ("Proceed with this feature"), but it contains three
distinct workstreams. The default plan builds them in this order: **B foundations (catalog,
migration, protocol) → A cursor model → B server/UI/equip → C observed motion → C extrapolated
lootbox/cursor motion → verification**. The observed beats (AC-35…AC-40, AC-44…) are pinned from
the decoded video; the extrapolated beats (AC-41…AC-43) are explicitly labelled `[E]` and inherit
the nearest observed envelope. The feature is no longer blocked on video inspection; Q-2 remains
only as a build/performance split option, not a reference-fidelity blocker.

## Acceptance criteria

Verification notes: "backend" = `src/backend`, "frontend" = `src/frontend`. "Legacy" means the
pre-feature 12-part catalog/5-category appearance. All tests use concrete expected values; no
wildcard matchers, snapshot-only tests or assertion-free tests. Commands (from `AGENTS.md`):
`npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/
functions/lines per workspace), `npm run build`, `npm run smoke`.

### Pillar A — pointer-following ship

- **AC-1 — Cursor model factory contract.** `src/frontend/src/render/cursor-ship.ts` exports
  `createCursorShipModel()` with no parameters. It returns `{ group, slots, meshes, ignitions,
  triangleCount, materialCount, dispose }`. `group.name === 'cursor-ship-model'`; it contains
  exactly `CURSOR_SHIP_SLOT_COUNT === 10` child groups named `slot-hull`, `slot-nose`,
  `slot-cockpit`, `slot-wing-left`, `slot-wing-right`, `slot-engine-left`, `slot-engine-right`,
  `slot-ignition-left`, `slot-ignition-right`, `slot-tail-fin`, in that order; `meshes.length ===
  CURSOR_SHIP_MESH_COUNT === 21`; `ignitions.length === 2` (the two meshes named `ignition`, each
  inside its ignition slot group); `materialCount === CURSOR_SHIP_MATERIAL_COUNT === 19`;
  `triangleCount > 0` and `<= CURSOR_SHIP_MAX_TRIANGLES === 2500`. Every mesh has `castShadow ===
  false` and `receiveShadow === false`. The factory creates no `Light`, `Points`, `Sprite`,
  `Texture`, loader, DOM access or `random` draw. `dispose()` releases every unique geometry and
  material exactly once, clears the groups and is idempotent. Evidence: `cursor-ship.test.ts`.
- **AC-2 — Cursor model mesh list.** The 21 meshes are exactly: `cursor-hull` (1),
  `cursor-hull-underside` (1), `cursor-nose` (1), `cursor-cockpit` (1), `cursor-cockpit-frame` (1),
  `cursor-cockpit-highlight` (1), `cursor-wing-left` (1), `cursor-wing-left-tip` (1),
  `cursor-wing-right` (1), `cursor-wing-right-tip` (1), `cursor-engine-left` (1),
  `cursor-engine-left-nozzle` (1), `cursor-engine-right` (1), `cursor-engine-right-nozzle` (1),
  `ignition` (2), `cursor-tail-fin` (1), `cursor-hull-seam-1` (1), `cursor-hull-seam-2` (1),
  `cursor-vent-left` (1), `cursor-vent-right` (1). Every entry is a `Mesh`; no other mesh names
  exist. Evidence: `cursor-ship.test.ts`.
- **AC-3 — Dimensions, scale and rest pose.** `cursor-ship.ts` exports `CURSOR_SHIP_LENGTH === 1.4`,
  `CURSOR_SHIP_WIDTH === 0.9`, `CURSOR_SHIP_HEIGHT === 0.4`. With the model group transform reset
  to identity, `Box3.setFromObject(group)` reports `size.z` in `[1.3, 1.5]`, `size.x` in `[0.8,
  1.0]`, `size.y` in `[0.3, 0.5]`; the nose tip is at local `z >= 0.65` and the rearmost flame at
  local `z <= -0.6`; the nose points local `+z` and the exhausts local `-z`. `createSpaceship()`
  keeps `SPACESHIP_SCALE === 1.2`, `group.scale.toArray() === [1.2, 1.2, 1.2]`, rest position
  `(0, 0, 6)` and the `spaceship` group name. Evidence: `cursor-ship.test.ts`,
  `spaceship.test.ts`.
- **AC-4 — Realistic materials and composition.** The hull/underside/nose/wings/tail-fin use
  `MeshPhysicalMaterial` with the pinned metal values (hull `metalness 0.55`, `roughness 0.38`,
  `clearcoat 0.4`, `clearcoatRoughness 0.2`); the canopy uses `metalness 0.2`, `roughness 0.08`,
  `clearcoat 1`, `clearcoatRoughness 0.08`; the canopy highlight is a `MeshBasicMaterial`; the two
  ignitions use an emissive transparent material with `emissive` equal to the ignition part colour
  and `opacity 0.55`. The model contains exactly two hull seam strips, two side vents and two
  engine nozzles, each a thin `BoxGeometry`/`CylinderGeometry` (at least one local dimension
  `<= 0.04`). No texture, loader, URL or external asset is referenced. The final manual visual
  matrix records the ship length as 180–250 px at 1280×720 and 270–380 px at 1920×1080, with
  canopy, wings, twin engines, two flames and panel detail distinguishable and no z-fighting.
  Evidence: `cursor-ship.test.ts`, final build log screenshots.
- **AC-5 — Follow and target behaviour preserved.** `spaceshipFollowFactor(dtMs, reducedMotion)`
  keeps `SPACESHIP_FOLLOW_TAU_MS === 240` and the formula `1 - exp(-dtMs / tau)`; reduced motion
  returns `1` for every `dtMs >= 0`; no reduced motion and `dtMs === 0` returns `0`.
  `spaceshipTargetPosition` keeps `SPACESHIP_PLANE_DISTANCE === 6`,
  `SPACESHIP_CURSOR_NDC_OFFSET_X === -0.16`, `SPACESHIP_CURSOR_NDC_OFFSET_Y === -0.12` and the
  pinned default-camera vector `(-0.445721, -0.334291, 6.025924)` within `1e-6`. With no pointer
  the ship stays at `(0, 0, 6)` and does not smooth. Evidence: `spaceship.test.ts`,
  `scene-spaceship.test.ts`.
- **AC-6 — Shots and ignitions preserved.** `SHOT_TRAVEL_MS === 180`; a spawned shot keeps its
  start/target endpoints and linear travel; the shot is removed on arrival and the deferred
  explosion still fires at the scene layer. `SPACESHIP_IGNITION_COUNT === 2`,
  `SPACESHIP_IGNITION_FLICKER_PERIOD_MS === 100`,
  `SPACESHIP_IGNITION_MOVEMENT_THRESHOLD === 0.01`; ignitions are hidden at rest, become visible
  after a moving update, flicker in scale/opacity, and stay hidden under reduced motion. Evidence:
  `spaceship.test.ts`, `scene-spaceship.test.ts`.
- **AC-7 — Per-slot appearance application.** `Spaceship.applyAppearance(appearance)` maps a
  slot→part-id record through `appearanceToCursorShipParams` and updates only the addressed slot's
  materials and slot-group transform; equipping `wing-left-silver` changes the left wing's
  colour/shape and leaves the right wing at its previous part. Applying the same appearance twice
  is a no-op (no material/transform change, no equip pulse). The outer `spaceship` group identity
  is never replaced. `SceneView.applySnapshot` calls `applyAppearance` when
  `snapshot.customization.appearance` changes and retains a shallow `lastAppearance` copy.
  Evidence: `spaceship.test.ts`, `scene-spaceship.test.ts`.
- **AC-8 — Cursor performance and bundle.** With the local environment running, 10-second idle and
  10-clicks/second `requestAnimationFrame` traces at 1280×720 and 1920×1080 (three clean runs per
  measurement, fresh page load) report average ≤ 16.7 ms and p95 ≤ 33 ms for the median and at
  least two of three runs at both sizes. The `cursor-ship-model` subtree stays at 32 objects (model
  root + 10 slot groups + 21 meshes); the outer `spaceship` group additionally holds the trail
  `Points` (one draw), so the cursor draws at most 22 draw calls and the model stays ≤ 2500
  triangles. No per-frame `new` allocation is added to the follow/shot/ignition path.
  `npm run build` exits 0 and initial JS gzip is ≤ 350 KB. A reproducible miss blocks; no AC
  relaxation and no quality tier in v1 (Q-13). Evidence: final build log.
- **AC-9 — Cursor reduced motion.** Under `prefers-reduced-motion: reduce`, the ship snaps to the
  pointer, ignitions stay hidden, and banking/pitch, idle bob, trail, equip pulse and any new
  cursor motion are absent (bank/pitch exactly `0`, trail active count `0`, pulse scale exactly
  `1`). The model still renders and its materials still reflect the equipped appearance. Evidence:
  `spaceship.test.ts`, `scene-spaceship.test.ts`.

### Pillar B — granular loot parts

- **AC-10 — Slot model.** Both `src/backend/src/game/parts.ts` and
  `src/frontend/src/game/parts.ts` export the same `SlotId` union and `SLOT_CATALOG` with exactly
  10 slots in this order: `hull`, `nose`, `cockpit`, `wing-left`, `wing-right`, `engine-left`,
  `engine-right`, `ignition-left`, `ignition-right`, `tail-fin`; each has a non-empty display name
  (`Hull`, `Nose`, `Cockpit`, `Port Wing`, `Starboard Wing`, `Port Engine`, `Starboard Engine`,
  `Port Ignition`, `Starboard Ignition`, `Tail Fin`). `isValidSlotId` accepts all ten and rejects
  `wings`, `engine`, `body`, ``, and `Hull`. Evidence: `parts.test.ts` (both workspaces).
- **AC-11 — Part catalog.** Both catalogs contain exactly 30 parts (3 per slot: standard, rare,
  epic) with the exact ids, names, rarities, colours, accents and shapes in § Part catalog. The
  standard part of every slot is `rarity: 'standard'` and is not lootable; the other 20 are
  lootable. `isValidPartId` accepts exactly the 30 ids; `partDefinition`/`partSlot` throw
  `unknown part: <id>` for unknown ids; `partsForSlot(slot)` returns exactly 3 entries in
  standard→rare→epic order; `defaultPartForSlot(slot)` returns the standard id.
  `PART_CATALOG_VERSION === 2`. The backend and frontend literal tables are identical (the two
  tests assert the same 30-row table). Evidence: `parts.test.ts` (both workspaces).
- **AC-12 — Defaults are implicitly owned.** Every standard part is equippable without appearing
  in `parts`; the server and guest engine accept an equip request for a standard part even when
  `parts[partId]` is absent. Standard parts never appear in the loot table and are never granted
  by a lootbox. A missing `appearance[slot]` resolves to the slot's standard part. Evidence:
  `parts.test.ts`, `hub.test.ts`, `engine.test.ts`.
- **AC-13 — Loot odds.** `selectLootPart(rng)` performs exactly one weighted draw over the 20
  lootable parts: rare weight `3`, epic weight `1`, total weight `40`; aggregate odds are 75% rare
  and 25% epic; each rare part is 7.5% and each epic part is 2.5%. With `rng() === 0` the first
  lootable part (`hull-obsidian`) is selected; with `rng() === 0.999999` the last
  (`tail-fin-comet`) is selected; a draw of `1` is clamped to the last part. The function never
  returns a standard part and consumes exactly one `rng` draw. Evidence: `parts.test.ts` (both
  workspaces), `hub.test.ts`.
- **AC-14 — Schema and version column.** Migration `006_granular_spaceship_parts.sql` adds
  `user_economy.customization_version INT NOT NULL DEFAULT 1`, backfills it to `2`, then sets the
  column default to `2`; `src/backend/src/db/schema.sql` mirrors the column with `DEFAULT 2`. The
  existing `parts`/`appearance` JSONB columns remain the storage shape (no new tables). The
  migration is idempotent (`ADD COLUMN IF NOT EXISTS`, data rewrite safe to re-run) and the
  startup runner aborts on failure. Evidence: migration file, `schema.sql` diff,
  `migration-006.test.ts`, `migrate.test.ts`.
- **AC-15 — Legacy inventory backfill.** Migration 006 rewrites legacy keys exactly as follows:
  `body-default|obsidian|gold` → `hull-default|obsidian|gold`; `wings-default|silver` →
  `wing-left-default|silver` **and** `wing-right-default|silver` with the same count on each;
  `engine-default|blue` → `ignition-left-default|blue` **and** `ignition-right-default|blue` with
  the same count on each; `nose-*` and `cockpit-*` are retained. Legacy appearance keys map
  `body`→`hull`, `wings`→both `wing-left` and `wing-right`, `engine`→both `ignition-left` and
  `ignition-right`; `nose`/`cockpit` are retained. Non-numeric part counts are skipped, duplicate
  keys are summed, and `customization_version` becomes `2`. Re-running the rewrite changes nothing.
  Evidence: `migration-006.test.ts`, `economy-repository.test.ts`.
- **AC-16 — Repository load/normalization.** `EconomyRepository.findCustomizationByUserId` returns
  a defensive copy of `{ lootboxes, keys, parts, appearance }`; a missing row returns the zero
  state; a row with `customization_version < 2` is normalized through the pure
  `normalizeCustomizationState` before returning; unknown part ids, unknown slot keys, and
  slot/part mismatches are dropped; legacy ids are mapped as in AC-15; standard parts may be
  absent. The in-memory and Postgres implementations return the same shape and values. Evidence:
  `economy-repository.test.ts`.
- **AC-17 — Atomic lootbox open.** `applyLootboxOpen(userId, partId)` performs one conditional
  atomic update: only when `lootboxes >= 1` **and** `keys >= 1` it decrements both by exactly 1,
  increments `parts[partId]` by exactly 1, and returns `{ state, duplicate }` where `duplicate` is
  true iff `partId` was already present before the increment. With insufficient counts it returns
  `{ reason: 'no_lootbox' }` first or `{ reason: 'no_key' }` second, and no row changes. Counts can
  never go negative. The in-memory implementation follows the same contract and check order.
  Evidence: `economy-repository.test.ts`.
- **AC-18 — Open success, server authority.** An account `openLootbox` selects exactly one part
  with `selectLootPart(deps.random())`, calls `applyLootboxOpen`, updates `customization` on every
  member with that `accountId`, broadcasts `customizationUpdate` to every joined connection of the
  account (including the opener), and sends exactly one `lootboxOpened` message to the **opening
  connection only** carrying the granted `partId`, `slot`, `rarity`, `duplicate` and the absolute
  state. The granted part is always one of the 20 lootable catalog entries. Evidence:
  `hub.test.ts`, `protocol.test.ts`.
- **AC-19 — Open failure.** With `lootboxes === 0` or `keys === 0`, `openLootbox` yields
  `error { code: 'no_lootbox' }` or `error { code: 'no_key' }` in that check order; no DB write,
  no `customizationUpdate`, no `lootboxOpened`, no state change. Evidence: `hub.test.ts`.
- **AC-20 — In-flight open guard.** While one `openLootbox` for a member is awaiting the
  repository, a second `openLootbox` from the same member/connection is dropped silently (no
  second decrement, no second grant, no error). The guard is per member and is released on success,
  failure or exception. Independent tabs/connections may open concurrently, each consuming one
  lootbox/key. This is the pinned idempotency boundary; the transport performs no automatic retry.
  Evidence: `hub.test.ts`.
- **AC-21 — Equip validation.** `equipPart { partId }` validates: unknown/malformed id →
  `unknown_part`; a non-standard part with `parts[partId] <= 0` → `not_owned`; a standard part is
  always allowed. The target slot is derived from the catalog entry, never from the client. No
  state changes on error. Client-supplied counts, rarity or slot are ignored. `unknown_slot` is
  reserved for `unequipPart { slotId }` (AC-22). Evidence: `hub.test.ts`, `engine.test.ts`.
- **AC-22 — Equip and unequip state.** A valid `equipPart` sets exactly
  `appearance[part.slot] = partId` through the atomic `setSlotAppearance` repository method,
  updates every member with that `accountId`, and broadcasts one `customizationUpdate`. Re-equipping
  the already-equipped part is a no-op (no write, no broadcast). `unequipPart { slotId }` validates
  the slot (`unknown_slot` on failure), deletes `appearance[slotId]`, updates members and
  broadcasts; a slot already at its default is a no-op. Other slots are never modified. Evidence:
  `hub.test.ts`, `economy-repository.test.ts`.
- **AC-23 — Client protocol.** The client message union gains
  `{ type: 'openLootbox' }`, `{ type: 'equipPart'; partId: string }`,
  `{ type: 'unequipPart'; slotId: string }`. `partId`/`slotId` must be non-empty strings; missing
  or wrong-type fields decode to `bad_message`; `openLootbox` has no fields. Evidence:
  `protocol.test.ts` (both workspaces).
- **AC-24 — Server protocol.** The server message union gains
  `{ type: 'lootboxOpened'; partId: string; slot: string; rarity: 'rare' | 'epic'; duplicate:
  boolean; lootboxes: number; keys: number; parts: Record<string, number>; appearance:
  Record<string, string> }`. The codec requires a non-empty `partId`, a non-empty `slot`, a
  `duplicate` boolean, a `rarity` of `rare` or `epic`, non-negative integer counts, positive
  integer part counts and non-empty-string appearance keys/values. `customizationUpdate` keeps its
  shape and codec. Error codes gain `unknown_slot`; `no_lootbox`, `no_key`, `unknown_part`,
  `not_owned` remain. Builders copy nested maps defensively. Evidence: `protocol.test.ts` (both
  workspaces).
- **AC-25 — Protocol parity.** Backend and frontend mirrors round-trip the same valid/invalid
  fixture matrix (including `lootboxOpened`, `unequipPart`, legacy equip ids, bad rarity, missing
  slot, negative counts, float counts, empty strings). Both expose the same constants, unions,
  error codes and copies; no `any` escape is introduced. Evidence: `protocol.test.ts` (both
  workspaces).
- **AC-26 — Multi-client and reconnect.** Every joined connection whose `accountSession.userId`
  equals the owning account receives `customizationUpdate` after a grant/open/equip/unequip; only
  the opening connection receives `lootboxOpened`. A second tab therefore updates its inventory
  without replaying a reveal. On reconnect within grace, `welcome` carries the persisted
  customization and no reveal; outside grace, a new join loads it normally. Guest connections
  receive no account broadcasts. Evidence: `hub.test.ts`, `session.test.ts`.
- **AC-27 — Guest local flow.** A guest with sufficient counts opens locally: `lootboxes` and
  `keys` decrement by 1, exactly one weighted part is added, `lastLootboxGrant` carries
  `partId`/`slot`/`rarity`/`duplicate` with a monotonically increasing sequence, and a snapshot is
  published; no message is sent. Guest `equipPart`/`unequipPart` validate against the catalog,
  ownership and defaults, mutate `appearance`, and publish. Guest state remains ephemeral and is
  lost on reload/disconnect. Evidence: `engine.test.ts`, `session.test.ts`.
- **AC-28 — Backward compatibility.** The server accepts the legacy part ids (`body-*`,
  `wings-*`, `engine-*`, `nose-*`, `cockpit-*`) on `equipPart`: `body-X` equips `hull-X`; `wings-X`
  equips both `wing-left-X` and `wing-right-X`; `engine-X` equips both `ignition-left-X` and
  `ignition-right-X`; nose/cockpit ids equip normally. Legacy ids are never granted by a lootbox.
  The frontend normalizer maps legacy appearance records to the new slot keys before rendering, so
  an unmigrated or manually restored row still renders. Evidence: `hub.test.ts`, `parts.test.ts`,
  `engine.test.ts`.
- **AC-29 — Customization panel slots.** `SpaceshipCustomizationPanel` renders the lootbox/key
  counts, one `Open lootbox` button (disabled when `lootboxes === 0 || keys === 0 || pendingOpen`),
  and exactly 10 `<li class="customization-slot" data-slot="<slotId>">` rows in `SLOT_CATALOG`
  order. Each row shows the slot display name, the equipped part name, and exactly three
  `<li class="customization-variant" data-part="<partId>" data-owned="true|false"
  data-locked="true|false" data-equipped="true|false">` entries. Owned entries expose an
  `.customization-equip` button (`aria-pressed="true"` and the text `Equipped` when equipped;
  otherwise the accessible label `Equip <part name>`); locked entries expose the text `Locked` and
  no equip button. Each row exposes `.customization-unequip` (`aria-label="Unequip <slot name>"`),
  disabled when the slot resolves to its standard part. Evidence:
  `SpaceshipCustomizationPanel.test.tsx`.
- **AC-30 — Panel accessibility and targets.** Every interactive panel control (open, equip,
  unequip, reveal equip) has a minimum 44×44 px target, a visible `:focus-visible` outline using
  `var(--accent)` (or the panel accent token), native button semantics and an accessible name.
  The section keeps `aria-label="Spaceship customization"` and `data-mode`. Locked entries are not
  focusable buttons. The panel scrolls within `max-height: 60vh` at 1280×720 and fits or scrolls
  without horizontal overflow at 320×568 and 375×667. Evidence:
  `SpaceshipCustomizationPanel.test.tsx`, `app.css.test.ts`, `game-view.css.test.ts`, manual
  check.
- **AC-31 — Live preview.** `SpaceshipPreview` renders a real live preview of the cursor model with
  the current slot appearance: `render/preview.ts` exports `createPreviewScene(appearance)` returning
  `{ scene, camera, model, update(dtMs, reducedMotion), dispose }`; the preview model applies the
  same `appearanceToCursorShipParams` mapping as the cursor, rotates at `0.0004 rad/ms` only when
  not reduced, renders at a maximum of 30 fps, and disposes the renderer/model on unmount. The
  canvas keeps `aria-label="Spaceship preview"` and exposes `data-preview-slot-<slotId>="<partId>"`
  for all 10 slots. If WebGL construction throws, the canvas remains an empty labeled preview and
  the panel still works. Evidence: `preview.test.ts`, `SpaceshipPreview.test.tsx`,
  `SpaceshipCustomizationPanel.test.tsx`.
- **AC-32 — Reveal state.** The client carries `lastLootboxGrant` with
  `{ partId, slot, rarity, duplicate, sequence }`. A `lootboxOpened` message (account) or a guest
  open sets it and advances `sequence`; `customizationUpdate` never clears or replaces it.
  `dismissLootboxReveal()` clears it. The panel renders a `role="status" aria-live="polite"`
  reveal region when a grant exists, with `data-reveal-active="true"`, `data-part-id`,
  `data-slot`, `data-rarity`, `data-duplicate`, the part name, the slot name, `Rare`/`Epic`,
  `New`/`Duplicate`, and an `Equip` button. Reopening the same part with a new `sequence` restarts
  the reveal. Evidence: `engine.test.ts`, `session.test.ts`, `SpaceshipCustomizationPanel.test.tsx`,
  `App.test.tsx`.
- **AC-33 — Persistence and migration end-to-end.** An account that joins after the migration
  receives a normalized `customization` in `welcome`/`worldEntered`; opening/equipping persists and
  a rejoin within grace sees the new state; a pre-migration row with `wings-silver` +
  `appearance.wings='wings-silver'` loads as both `wing-left-silver` and `wing-right-silver` and
  `appearance['wing-left']='wing-left-silver'`, `appearance['wing-right']='wing-right-silver'`.
  Guest rejoin/new connection starts from the zero state. Evidence: `hub.test.ts`,
  `economy-repository.test.ts`, `migration-006.test.ts`, `session.test.ts`, final smoke.

### Pillar C — observed motion language

- **AC-34 — Motion tokens v2 (observed + extrapolated).** `src/frontend/src/game/motion.ts` is the
  single home for the new presentation-only tokens, with these exact values:
  **observed** `reticleDwellMs 250`, `reticleFadeMs 120`, `coinPopMs 1100`, `coinRisePx 45`,
  `coinRiseMs 220`, `coinMaxConcurrent 3`, `shockwaveGrowMs 330`, `shockwaveFadeMs 150`,
  `shockwaveVisibleMs 480`, `shockwaveMaxScale 5`, `orbOvershootMs 250`,
  `orbOvershootScale 1.25`, `bannerOvershootMs 450`, `bannerOvershootScale 1.08`,
  `bannerPeakMs 370`, `bannerHaloMs 250`, `bannerRotateDeg 8`, `bannerWobbleDeg 2`,
  `bannerHoldMs 1600`, `levelBurstMs 760`,
  `levelBurstAttackMs 250`, `levelBurstReleaseMs 510`, `levelRayGold 16`, `levelRayCyan 8`,
  `levelRingCount 3`, `levelStarCount 12`, `levelCoinCount 12`, `rayCount 12`, `rayGrowMs 80`,
  `rayHoldMs 100`, `rayFadeMs 270`, `rayTotalMs 450`, `debrisPerPop 14`, `debrisPoolCap 42`,
  `debrisLifetimeMs 900`, `debrisSpeedMin 1.8`, `debrisSpeedMax 3.6`, `debrisDragPerS 2`,
  `debrisGravity 6`, `debrisAngularMin 3`, `debrisAngularMax 8`, `coinsPerPop 6`,
  `coinPoolCap 18`, `coinLifetimeMs 1000`, `shipRollMs 700`, `shipOrbitRadius 1.2`,
  `fireTrailMs 700`, `fireTrailCount 16`, `plumeFlickerMs 100`;
  **extrapolated `[E]`** `lootboxChargeMs 420`, `lootboxFlashMs 120`, `lootboxRevealMs 360`,
  `lootboxSettleMs 140`, `lootboxTotalMs 1040`, `equipPulseMs 260`, `equipPulseScale 0.04`,
  `equipRowFlashMs 260`, `upgradePulseMs 260`, `trailLifetimeMs 220`, `trailCount 8`,
  `shipBankMaxRad 0.28`, `shipBankGain 2.4`, `shipPitchMaxRad 0.18`, `shipPitchGain 1.6`,
  `shipIdleAmplitude 0.015`, `shipIdlePeriodMs 2600`.
  It exports `easeOutCubic`, `easeOutBack(t, c1 = 1.5)` (standard formula; peak `1.08` at `t =
  0.6` for `c1 = 1.5`, peak `1.25` at `t = 0.5` for `c1 = 3.0`), `easeOutQuad`, `easeOutQuint`,
  `easeInOutCubic` and `clamp01`, with exact endpoints/midpoints. `game-view.css` mirrors the
  durations as `--motion-*` custom properties on the `main` element (not the pinned nine-token
  `:root` block); `game-view.css.test.ts` imports `MOTION` and asserts each value equals
  `${token}ms`. No second copy exists in `effects.ts`, `app.css` or components. Evidence:
  `motion.test.ts`, `game-view.css.test.ts`.
- **AC-35 — Target lock and reticle [O].** On pointer move the session resolves the front-face
  mini-cube at most once per animation frame (`pickMiniCube`; no allocation) and calls
  `SceneView.setHoverTarget(id | null)`. A hit shows a white outline around the hovered tile (one
  `LineSegments` edge box at `1.03` tile scale, `depthTest: false`, `renderOrder: 11`, one draw)
  and six 2×14 px-equivalent ticks at 60° around the pointer/ship, 20 px-equivalent from the tip
  (one `LineSegments`, 12 vertices). The reticle fades in over `reticleFadeMs = 120` and holds for
  `reticleDwellMs = 250`; the cube is **not** scaled or squashed; a miss hides the reticle. Under
  reduced motion the outline is static and the ticks are off. Evidence: `targeting.test.ts`,
  `session.test.ts`, `scene-spaceship.test.ts`.
- **AC-36 — Instant cube conceal [O].** `MINI_CUBE_POP_MS === 0`: a clicked mini-cube is
  zero-scaled on the same frame (the accepted 160 ms pop-then-shrink is superseded); there is no
  shrink/flash record and no per-frame pop write. `popScaleAt`/`popColorMultiplierAt` are removed
  (or, if kept as compatibility shims, return the settled end state for every `elapsedMs >= 0`).
  Remote `world` cubes conceal identically. The visible shatter is carried by AC-37/AC-38, not a
  shrinking tile. Evidence: `effects.test.ts`, `cube-view.test.ts`, `world.test.ts`,
  `scene.test.ts`.
- **AC-37 — Pop impact: rays, debris and coins [O].** New `src/frontend/src/render/impact-effects.ts`
  exports `createImpactEffects(random)` returning `{ group, spawnPop(origin, normal, nowMs),
  update(dtMs), activeCounts(), dispose() }`. One pop starts four pooled drawables: a 12-ray
  tapered gold fan (`RAY_POOL_CAP = 3`, one `InstancedMesh`, grow `80 ms` `easeOutQuint`, hold
  `100 ms`, fade `270 ms`, total `450 ms`; lengths alternate 90–160 px-equivalent), 14 green beveled
  cube shards (`DEBRIS_POOL_CAP = 42`, one `InstancedMesh`, speed `1.8–3.6` world units/s, drag
  `2 s⁻¹`, gravity `6` world units/s², angular `3–8 rad/s`, lifetime `900 ms`), 6 gold coin discs
  (`COIN_POOL_CAP = 18`, one `InstancedMesh`, speed `0.8–1.2`, spin, lifetime `1000 ms`), and one
  ring (AC-38). The existing 24-point gold burst (`0xffcc66`, 350 ms, cap 72) remains the needle-
  spark layer and is not duplicated. Each pool is one draw call, recycles oldest first, and has no
  per-spawn geometry/material. Reduced motion suppresses rays/debris/coins (AC-48). Evidence:
  `impact-effects.test.ts`, `scene-spaceship.test.ts`.
- **AC-38 — Ring shockwave [O].** The impact system's ring pool is exactly 3 instances of one
  prebuilt geometry (32-segment ring plus 8 baked radial spokes and 4 satellite rings; one
  additive material, one draw). `spawnShockwave(origin, normal, nowMs)` starts at `origin +
  normal * 0.02`, oriented so +z aligns with `normal`; growth runs `1 → 5` over
  `shockwaveGrowMs = 330` with `easeOutQuad`, then opacity fades over
  `shockwaveFadeMs = 150`; visible total `shockwaveVisibleMs = 480`. The oldest ring is recycled
  at the cap. Under reduced motion the ring is a 120 ms opacity flash at final scale (no
  expansion). Evidence: `impact-effects.test.ts`, `scene-spaceship.test.ts`.
- **AC-39 — Coin popup [O].** A coin increase renders one `+<delta>` popup per gain, up to
  `coinMaxConcurrent = 3` (oldest dropped), lifetime `coinPopMs = 1100`: scale `0.7 → 1.0` over
  `80 ms`, rise `45 px` over `220 ms` with `easeOutCubic`, then fade/drift. The numeric HUD value
  updates in the same frame; there is **no new HUD pulse/scale/colour flash** and no screen shake.
  Under reduced motion the popup is static for `600 ms` (no rise/scale) or the numeric update only.
  Evidence: `Hud.test.tsx`, `App.test.tsx`.
- **AC-40 — Level-complete burst, banner and ship fly-by [O].** On a `levelIndex` increase the
  client shows `LevelCompleteBanner` for `bannerHoldMs = 1600`: a full-screen DOM burst of 16 gold
  + 8 cyan rays, 3 concentric rings, 12 star glyphs and 12 coin glyphs over
  `levelBurstMs = 760` (attack `250`, release `510`, `easeOutCubic` brightness envelope); the
  banner enters at `scale 0.2`, `rotate(-8°)`, reaches `1.0` at `250 ms`, overshoots to `1.08` at
  `~370 ms`, settles by `450 ms` with a decaying ±2° wobble and a 250 ms halo ring. The cursor ship
  performs one 360° roll on a `1.2`-world-unit orbit over `700 ms` (`easeInOutCubic`) with a
  16-point, `700 ms` fire trail, then returns to pointer-follow. No camera/HUD shake. Reduced
  motion: 150 ms white overlay at ≤15 % opacity, banner fades at `scale 1`/`0°` over 120 ms, no
  ship roll/trail. Evidence: `LevelCompleteBanner.test.tsx`, `spaceship.test.ts`, `scene.test.ts`,
  `App.test.tsx`.

### Pillar C — extrapolated adaptation `[E]`

- **AC-41 — Lootbox reveal [E].** The panel reveals with a **charge orb**, not a shake: an inline
  SVG/CSS wireframe sphere with an orange core (the observed orb is a wireframe sphere; its four
  satellite rings belong to the ring shockwave, not the idle orb) charges for `420 ms`
  (`scale 1 → 1.06 → 1`, ±5 % pulse, no translation), overshoots to `1.25` over `250 ms`
  (`easeOutBack(3.0)`, the observed orb envelope), flashes for `120 ms`, reveals the card over
  `360 ms` with an 8 % overshoot (`easeOutBack(1.5)`), and settles for `140 ms`; total `1040 ms`.
  The grant attributes from AC-32 remain; the reveal `Equip` button is 44 px with a focus-visible
  ring. Reduced motion: instant result, static orb, no charge/flash/overshoot. This is an
  **extrapolation** from the observed orb + banner envelopes; the video has no lootbox panel.
  Evidence: `SpaceshipCustomizationPanel.test.tsx`, `game-view.css.test.ts`.
- **AC-42 — Cursor ship adaptation [E].** Non-reduced cursor motion keeps the banking/pitch
  formulas (`vx/vy` per ms; `rotation.z = clamp(-vx * 2.4, ±0.28)`, `rotation.x =
  clamp(-vy * 1.6, ±0.18)`), the 8-point/220 ms trail, the 0.015/2600 ms idle bob, the 260 ms/4 %
  equip pulse and the observed 100 ms plume flicker. It does **not** add a muzzle/recoil or press
  scale: the reference ship is stationary and does not react to pops. `dtMs === 0`, rest or reduced
  motion yields exact zero bank/pitch, 0 trail points and scale 1. Evidence: `ship-motion.test.ts`,
  `spaceship.test.ts`.
- **AC-43 — Equip and upgrade feedback [E].** A part equip adds a 260 ms row flash and the 4 % ship
  pulse; an upgrade-level increase adds `data-purchased="true"` for 260 ms with a single subtle
  pulse. No new coin HUD pulse is added (the observed HUD updates instantly). Reduced motion makes
  both instant. The video has no equipping or upgrade purchase; these inherit the observed banner
  overshoot/settle language at a smaller amplitude. Evidence: `UpgradesPanel.test.tsx`,
  `App.test.tsx`.

### Pillar C — invariants and evidence

- **AC-44 — No screen shake [O].** The camera position/quaternion and the HUD layout are identical
  before and after a pop, ring, level burst or banner (no translate/scale/rotation on `main`,
  `.hud-panel`, `.upgrades-panel` or `.customization-panel` for these events); no shake token or
  random camera offset exists. Evidence: `scene.test.ts`, `App.test.tsx`,
  `game-view.css.test.ts`.
- **AC-45 — Audio alignment metadata [O].** `video-analysis.md` records the audio onsets and their
  alignment: first pop visual 1.292 s / broadband transient ≈1.35–1.40 s (2–3 frames late); level
  visual 6.792 s / next onset ≈6.92 s and loudest peak 7.01 s (≈5 frames); banner overshoot 7.87 s
  exactly on the 7.87 s audio peak; loudest true peak −1.6 dBFS. No audio asset, dependency or
  playback code is added; this is evidence for a future audio feature (Q-10). Evidence:
  `video-analysis.md` § 4.11 + final build log grep.
- **AC-46 — Reference disposition and provenance [O+E].** `video-analysis.md` contains the
  metadata, 40 decoded reference frames, 3 contact sheets, observed timestamps and the `[O]`/`[E]`
  mapping table; `reference/` contains the frames/contact sheets. The final build log maps each
  observed beat (AC-35…AC-40, AC-44) to the shipped token and each extrapolated beat
  (AC-41…AC-43) to its nearest observed envelope. No unobserved value is presented as observed.
  Evidence: `video-analysis.md`, `reference/`, final build-log table.
- **AC-47 — Motion performance and bundle.** With the local environment running, 10-second idle
  and 10-clicks/second `requestAnimationFrame` traces at 1280×720 and 1920×1080 (three clean runs,
  fresh page load) report average ≤ 16.7 ms and p95 ≤ 33 ms for the median and at least two of
  three runs at both sizes. Worst-case live effect pools are 3 ray fans, 42 debris, 18 coins,
  3 shockwave rings and 72 spark points; each pool is one draw and recycles oldest first. No
  per-frame `new` allocation is added to the pop/impact/cursor paths. `npm run build` initial JS
  gzip ≤ 350 KB. A reproducible miss blocks; no quality tier in v1 (Q-13). Evidence: final build
  log.
- **AC-48 — Reduced-motion coverage.** Every new animation has a pinned reduced variant: target
  reticle static/no ticks; cube conceal instant with no rays/debris/coins; ring 120 ms opacity
  flash at final scale; coin popup static 600 ms or numeric-only; level burst 150 ms ≤15 % overlay
  with no rays/rings/debris; banner fade 120 ms at scale 1/0° with no breathing; lootbox instant;
  cursor bank/pitch/trail/idle/pulse/ignition zero; equip/upgrade instant. The CSS reduced-motion
  block disables every new animation/transition. Evidence: `motion.test.ts`,
  `impact-effects.test.ts`, `game-view.css.test.ts`, `spaceship.test.ts`,
  `SpaceshipCustomizationPanel.test.tsx`, `Hud.test.tsx`, `UpgradesPanel.test.tsx`,
  `LevelCompleteBanner.test.tsx`, manual A/B.

### Verification, docs, containers

- **AC-49 — Coverage.** `npm run coverage` exits 0 with ≥ 80% statements/branches/functions/lines
  in both workspaces; new modules are included; no new exclusion or threshold change. Evidence:
  final build log.
- **AC-50 — Documentation.** `README.md` contains the exact phrase `granular spaceship parts` and
  a sentence stating the pointer ship is procedural and no external assets are used;
  `docs/product/glossary.md` defines `part slot`, `lootbox reveal` and `motion token` and updates
  the customization entry from categories to slots; `docs/features/README.md` is **not edited** —
  the final build log records the proposed row diff for the orchestrator. Evidence: final build
  log greps/diffs.
- **AC-51 — Containerization impact.** The only deployment artifact change is migration 006, applied
  by the existing startup runner against the existing `db` service. No new service, image, port,
  environment variable, health signal, compose entry, Dockerfile or WebSocket endpoint change;
  `podman compose up` and `npm run smoke` remain the local/container paths. The final gate runs
  `npm run smoke` (the existing Mailpit/auth/multiplayer regression) and records the result.
  Evidence: final build log, `git diff` on container paths empty.

## Part catalog (pinned, v2)

Slots and display names: `hull` Hull · `nose` Nose · `cockpit` Cockpit · `wing-left` Port Wing ·
`wing-right` Starboard Wing · `engine-left` Port Engine · `engine-right` Starboard Engine ·
`ignition-left` Port Ignition · `ignition-right` Starboard Ignition · `tail-fin` Tail Fin.

Rarity weights: standard `0` (not lootable), rare `3`, epic `1`. Shape keys are applied by the
cursor model as the slot-group transform table in `plan.md`.

| id | slot | name | rarity | colour | accent | shape |
| --- | --- | --- | --- | --- | --- | --- |
| `hull-default` | hull | Steel Hull | standard | `#8f9bad` | `#2f6fd6` | `standard` |
| `hull-obsidian` | hull | Obsidian Hull | rare | `#1a2333` | `#3b82f6` | `armored` |
| `hull-gold` | hull | Gold Hull | epic | `#ccaa44` | `#fff3d6` | `solar` |
| `nose-default` | nose | Alloy Nose | standard | `#88aaff` | `#2f6fd6` | `standard` |
| `nose-crimson` | nose | Crimson Lance | rare | `#cc4444` | `#ff7a1a` | `lance` |
| `nose-emerald` | nose | Emerald Photon | epic | `#44cc88` | `#cffcff` | `photon` |
| `cockpit-default` | cockpit | Teal Canopy | standard | `#0b2f38` | `#cffcff` | `standard` |
| `cockpit-amber` | cockpit | Amber Razor | rare | `#3b1d0a` | `#ffaa44` | `razor` |
| `cockpit-oracle` | cockpit | Oracle Canopy | epic | `#2e1065` | `#c4b5fd` | `oracle` |
| `wing-left-default` | wing-left | Port Wing | standard | `#4466cc` | `#8f9bad` | `standard` |
| `wing-left-silver` | wing-left | Port Silver Wing | rare | `#aaaaaa` | `#d9dee7` | `razor` |
| `wing-left-gold` | wing-left | Port Gold Wing | epic | `#ccaa44` | `#fff3d6` | `solar` |
| `wing-right-default` | wing-right | Starboard Wing | standard | `#4466cc` | `#8f9bad` | `standard` |
| `wing-right-silver` | wing-right | Starboard Silver Wing | rare | `#aaaaaa` | `#d9dee7` | `razor` |
| `wing-right-gold` | wing-right | Starboard Gold Wing | epic | `#ccaa44` | `#fff3d6` | `solar` |
| `engine-left-default` | engine-left | Port Engine | standard | `#35507a` | `#1a2333` | `standard` |
| `engine-left-vector` | engine-left | Port Vector Engine | rare | `#1e3a8a` | `#60a5fa` | `boxed` |
| `engine-left-nova` | engine-left | Port Nova Engine | epic | `#f8fafc` | `#ffcc66` | `nova` |
| `engine-right-default` | engine-right | Starboard Engine | standard | `#35507a` | `#1a2333` | `standard` |
| `engine-right-vector` | engine-right | Starboard Vector Engine | rare | `#1e3a8a` | `#60a5fa` | `boxed` |
| `engine-right-nova` | engine-right | Starboard Nova Engine | epic | `#f8fafc` | `#ffcc66` | `nova` |
| `ignition-left-default` | ignition-left | Port Flame | standard | `#ff6600` | `#ffcc66` | `standard` |
| `ignition-left-blue` | ignition-left | Port Blue Flame | rare | `#4488ff` | `#cffcff` | `ion` |
| `ignition-left-plasma` | ignition-left | Port Plasma Flame | epic | `#a855f7` | `#f0abfc` | `plasma` |
| `ignition-right-default` | ignition-right | Starboard Flame | standard | `#ff6600` | `#ffcc66` | `standard` |
| `ignition-right-blue` | ignition-right | Starboard Blue Flame | rare | `#4488ff` | `#cffcff` | `ion` |
| `ignition-right-plasma` | ignition-right | Starboard Plasma Flame | epic | `#a855f7` | `#f0abfc` | `plasma` |
| `tail-fin-default` | tail-fin | Standard Fin | standard | `#14213d` | `#8f9bad` | `standard` |
| `tail-fin-split` | tail-fin | Split Fin | rare | `#64748b` | `#cbd5e1` | `split` |
| `tail-fin-comet` | tail-fin | Comet Fin | epic | `#ff7a1a` | `#ffcc66` | `comet` |

Legacy mapping (migration + compatibility): `body-*` → `hull-*`; `wings-*` → both `wing-*-*`;
`engine-*` → both `ignition-*-*`; `nose-*`/`cockpit-*` retained.

## Reference mapping (observed `[O]` / extrapolated `[E]`)

The video was decoded on 2026-11-08 (24 fps, 10.0 s, 1280×720); see `video-analysis.md` and
`reference/`. `[O]` rows are measured from the frames; `[E]` rows are absent from the video and
are explicit adaptations of the nearest observed envelope. No `[E]` value is claimed as observed.

| Game event | Observed language / timing `[O]` | Implementation mapping |
| --- | --- | --- |
| Click / hover | 2 px white tile outline + six 14 px ticks at 60°, ≈20 px from the pointer; ≈250 ms dwell; no cube squash; pop on the next frame | AC-35: `setHoverTarget`, 1.03 edge outline, six-line reticle, 120 ms fade / 250 ms dwell, no scale |
| Cube pop / shatter | Face vanishes in 1 frame; white core 20→45 px in ≈80 ms; 12 gold tapered rays (90–160 px); 10–14 green shards; 4–6 coins; burst ≈0.46 s; debris >1.2 s | AC-36 instant conceal + AC-37 12-ray/14-shard/6-coin pools; existing 24-point sparks as needles |
| Coin popup | `+0.50 Coins`, 24 px, scale 0.7→1 over 60–80 ms, rise 45 px over 220 ms, lifetime ≈1.1–1.2 s; 2–3 coexist; no HUD pulse | AC-39: 1100 ms popup, 45 px rise, max 3, numeric HUD same frame |
| Golden orb | Wireframe gold sphere + orange core; radius 45→75→60 px (25 % overshoot, 250 ms settle), hovers ≈2.25 s, ±5 % pulse; no satellites on the idle orb | AC-41 `[E]` lootbox charge orb; satellites belong to the ring (AC-38) |
| Ring shockwave | 70→350 px in 330 ms (`easeOutQuad`); 8 spokes + 4 satellite rings; ≈150 ms fade; total ≈490 ms; no shake | AC-38: 330 ms grow `1→5`, 150 ms fade, 480 ms visible, baked 8 spokes/4 satellites |
| Level complete | 0.76 s burst: white core 0→300 px / 380 ms; 16 gold + 8 cyan rays; 3 rings; 40+ cubes, 20+ coins, hundreds of sparks; attack 250 ms, release 510 ms | AC-40: DOM 16+8 rays, 3 rings, 12 stars/coins, 760 ms burst; 3D pools supply extra debris |
| Banner | ≈0.2 scale/−8° at 0; 1.0 at 250 ms; 1.08 at ≈370 ms; settle by ≈450 ms; ±2° wobble; halo 250 ms; audio impact at overshoot peak | AC-40: `easeOutBack(1.5)` 450 ms, exact keyframes, halo, hold 1600 ms |
| Ship fly-by | 360° roll on ≈120 px orbit over 0.55–0.70 s, `easeInOutCubic`; 30–50 px fire trail, ≈0.7 s; no normal-pop reaction | AC-40: cursor fly-by 700 ms, 1.2 world-unit orbit, 16-point/700 ms trail; idle plume flicker 100 ms |
| Lootbox open / reveal | **Absent `[E]`** — nearest: orb charge/overshoot + banner settle | AC-41 `[E]`: 420 ms charge, 250 ms 25 % orb overshoot, 120 ms flash, 360 ms 8 % reveal, 140 ms settle; no shake |
| Part equip | **Absent `[E]`** — nearest: banner overshoot | AC-43 `[E]`: 260 ms row flash + 4 % ship pulse |
| Upgrade purchase | **Absent `[E]`** — nearest: banner settle; HUD numbers are instant | AC-43 `[E]`: 260 ms subtle row pulse; no coin HUD pulse |
| Cursor idle / trail | **Absent** (OS arrow; companion ship is static with 100 ms plume flicker) | AC-42 `[E]`: bank/pitch, 8-point/220 ms trail, 0.015/2600 idle, 260 ms 4 % equip pulse |
| Audio | Continuous bed; pop transient 2–3 frames after visual; level onset ≈5 frames; banner peak at 7.87 s; true peak −1.6 dBFS | AC-45 metadata only; no audio shipped (Q-10) |

## Non-goals

- No GLTF/OBJ/asset pipeline, model loader, external model, image, texture, font, audio or new npm
  dependency. The cursor ship, preview and all effects are procedural.
- No exact pixel-perfect replication of the reference video; the observed beats are matched by the
  pinned tokens in AC-34…AC-48, while lootbox/equip/upgrade/cursor motions are documented
  extrapolations `[E]` with the nearest observed envelope.
- No screen shake, camera shake, HUD shake or zoom: the reference keeps the camera and HUD fixed.
- No cross-client visibility of the cursor ship, its trail or the player's equipped appearance;
  presentation stays local to one client (Q-6).
- No trading, selling, crafting, fusing, dismantling, pity or duplicate-to-currency conversion.
- No new slot beyond the ten pinned; decals, pilot figures, weapon hardpoints and animated decals
  are deferred (Q-11).
- No new accounts, identity model or guest persistence (Q-7).
- No change to gameplay rules, cube topology, click-to-state timing, coin values, upgrade effects,
  server cube sync, spectating, auth, rooms or rebalancing. The 160 ms pop-then-shrink visual is
  replaced by the observed one-frame conceal (AC-36), but the board removal, stats and server
  timing are unchanged.
- No change to the right-side detailed hero ship, its palette, position or animation.
- No change to the deferred-explosion game-state timing: only the visual response is animated.
- No new service, image, port, environment variable, health signal or compose service; the only
  deployment artifact is migration 006 (Q-12).
- No browser automation, pixel/perceptual snapshot tests or visual-regression tooling; visual,
  frame-time and reduced-motion evidence are manual and recorded.
- No sound design; if the reference video has audio cues, they are recorded in the analysis and
  deferred to a separately approved audio feature (Q-10).
- No quality tier/LOD switch in v1; a reproducible performance miss blocks (Q-13).
- No edit of any predecessor spec/plan/tasks/review; superseded criteria are listed below only.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; keep `render/**` three.js-only with named
  tree-shakeable imports; keep server authority over account inventory/appearance; use parameterized
  SQL only; validate every client-supplied part/slot id against the catalog; give every behavior
  change its test file and concrete assertions; run lint/typecheck/tests/coverage before reporting
  done; record raw evidence in build logs; update the exact counts/README/glossary in the same
  change; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency, asset, loader, texture, font, URL, video or audio; changing the
  pinned catalog ids/odds/slots, the cursor scale/follow/shot/ignition constants, the 350 KB bundle
  budget or the frame-time bar; touching `docs/product/vision.md`, `docs/architecture/**`, compose,
  Dockerfiles, `src/server.ts`, auth, economy coin values, upgrades or multiplayer cube sync; any
  coverage exclusion or threshold change; any cross-client visibility, quality tier or LOD.
- 🚫 Never: trust client-supplied counts/rarity/odds/ownership; persist guest data; weaken
  assertions (wildcard matchers, snapshot-only, assertion-free, useless tests); exclude production
  code from coverage; commit secrets or edit `.env*`; use `dangerouslySetInnerHTML`, `eval`,
  remote URLs or external asset fetches; ship the reference video/frames as application assets;
  push; rewrite predecessor specs/plans/tasks; add a second source of truth for the catalog, odds,
  motion tokens or appearance mapping.

## Security considerations

- **User-controlled data:** `equipPart.partId` and `unequipPart.slotId` are client-supplied.
  Validate format at the codec and value against the pinned catalog/slot list; validate ownership
  server-side; ignore client-supplied counts, rarity, odds, slot or part definition. `openLootbox`
  carries no fields. Legacy ids are accepted only through the pinned mapping and only for equip.
- **Persistence integrity:** migration 006 is transactional and idempotent, adds a version column
  with a safe default, rewrites only legacy keys, skips non-numeric counts and sums collisions.
  Parsing filters unknown/malformed JSONB entries; the repository is the only DB access path;
  all SQL is parameterized (migration SQL is static). `applyLootboxOpen` is one conditional atomic
  update; `setSlotAppearance` is atomic per slot; no lost updates from multi-tab play.
- **Abuse bounds:** `openLootbox` consumes one lootbox/key per accepted frame, guarded in-flight
  per member; inventory is a count map over a fixed 30-part catalog, so growth is bounded by opens;
  message size stays under the existing cap; no new rate-limit bypass.
- **Secrets:** no new secrets; `.env*` untouched; no DB credentials or tokens in the bundle.
- **Client safety:** all geometry/materials are procedural; no external URLs, loaders, textures or
  assets; no `eval`, `innerHTML` or dangerous HTML; the preview creates one local WebGL context and
  disposes it.
- **Test integrity:** concrete assertions, unchanged coverage thresholds, server-authority and
  migration tests protect the shared paths.

## Testing strategy

- **Backend unit (Vitest, node):**
  - `game/parts.test.ts` — 10-slot model; 30-row catalog exact table; standard/rare/epic counts;
    `isValidSlotId`/`isValidPartId`/`partDefinition`/`partSlot`/`partsForSlot`/
    `defaultPartForSlot`; `selectLootPart` weights, boundaries, one draw, no standards; legacy
    normalization (parts + appearance, split keys, collisions, invalid values); `PART_CATALOG_VERSION`.
  - `game/protocol.test.ts` — client `openLootbox`/`equipPart`/`unequipPart`; server
    `lootboxOpened` and `customizationUpdate`; `unknown_slot`; codec matrix; defensive copies;
    parity fixtures.
  - `auth/economy-repository.test.ts` — in-memory + fake `pg`: load/normalize, zero state,
    `applyLootboxOpen` success/reasons/duplicate/atomic values, `setSlotAppearance` set/delete,
    legacy row, no negatives.
  - `game/hub.test.ts` — weighted grant, success/failure, in-flight guard, equip/unequip
    validation, defaults, idempotence, member updates, account-scoped broadcast, opener-only
    `lootboxOpened`, reconnect, guest no-op, legacy equip.
  - `db/migration-006.test.ts` + `db/migrate.test.ts` — file loaded, schema/column/default, exact
    rewrite statements, idempotent re-run, legacy row mapping.
- **Backend integration:** `app.test.ts` — a verified account connects through the real app with
  an in-memory economy repository, joins, receives a normalized customization, opens a lootbox,
  receives `lootboxOpened` + `customizationUpdate`, equips/unequips, and a second connection sees
  the state update without a reveal.
- **Frontend unit (Vitest, node):**
  - `game/parts.test.ts` — mirror catalog/odds/normalizer/params.
  - `game/motion.test.ts` — all observed/extrapolated tokens, easings, exact endpoints/midpoints,
    `easeOutBack` peaks, `clamp01`.
  - `render/ship-motion.test.ts` — bank/pitch formulas/clamps, idle bob, trail ring buffer,
    equip pulse curve, reduced-motion zeros.
  - `render/cursor-ship.test.ts` — 21-mesh/10-slot/19-material contract, exact names, dimensions,
    palette/shape transforms, no lights/textures/random, triangle budget, disposal.
  - `render/spaceship.test.ts` — preserved follow/target/shot/ignition values, model integration,
    `applyAppearance` slot isolation/idempotence, bank/trail/pulse, fly-by roll/trail, reduced
    motion, disposal.
  - `game/effects.test.ts` / `render/cube-view.test.ts` / `render/world.test.ts` — instant conceal
    (`MINI_CUBE_POP_MS === 0`), same-frame zero scale, no pop records, remote-cube instant conceal.
  - `render/impact-effects.test.ts` — 12-ray/14-debris/6-coin/3-ring pools, counts, lifetimes,
    easing, recycle, orientation, no per-spawn geometry, reduced path, disposal.
  - `render/targeting.test.ts` — outline position/scale, six ticks/angles, 120 ms fade, 250 ms
    dwell, miss hide, reduced static/no ticks.
  - `render/scene-spaceship.test.ts` / `render/scene.test.ts` — appearance, hover/reticle, impact
    effects at deferred explosion, no camera shake, counts updated, reduced motion, disposal.
  - `render/preview.test.ts` — preview scene/model/appearance/rotation/dispose.
  - `game/engine.test.ts` — guest weighted open, grant sequence/duplicate, equip/unequip/defaults,
    adoption, ephemeral reset.
  - `game/session.test.ts` — account open/equip/unequip sends, `lootboxOpened` adoption, reveal
    dismissal, multi-tab state, guest branch, hover pick throttling, level fly-by trigger.
  - `multiplayer/protocol.test.ts` — mirror codecs/parity.
  - `ui/SpaceshipCustomizationPanel.test.tsx`, `ui/SpaceshipPreview.test.tsx`,
    `ui/LevelCompleteBanner.test.tsx`, `ui/Hud.test.tsx`, `ui/UpgradesPanel.test.tsx`,
    `ui/App.test.tsx`, `ui/app.css.test.ts`, `ui/game-view.css.test.ts` — slot rows,
    owned/locked/equipped, 44px/focus/ARIA, reveal orb, preview attrs, coin popup, upgrade pulse,
    level banner, no shake, reduced-motion CSS, exact motion token mirror.
- **E2E / container:** `npm run smoke` at the final gate. The backend will not become healthy if
  migration 006 fails; the existing Mailpit/auth/multiplayer flow remains the container regression.
  No new smoke assertions are required because reaching a lootbox in smoke requires a full cube
  clear; the account/protocol path is covered by `app.test.ts`.
- **Manual visual/performance evidence:** AC-3/AC-8/AC-35…AC-40 visual matrix,
  AC-9/AC-41/AC-42/AC-43/AC-48 reduced-motion A/B, AC-8/AC-47 frame traces, AC-46 reference frame
  table + observed/extrapolated mapping.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per
  workspace; workspace-scoped pre-gate per task. No exclusions.
- **Assertion quality:** concrete expected values, exact ids/colours/positions/counts, no wildcard
  matchers, no snapshot-only tests, no useless tests.

## Real-time impact

- **New shared/cross-client state:** none across players. Inventory/appearance remain per-account
  and are broadcast only to that account's joined connections (existing customization scope). The
  cursor ship, trail, motion and reveal are client-local presentation. Other clients never see a
  player's ship or equipped parts; Q-6 asks whether that should change (it would need protocol and
  server-authority work).
- **Connection lifecycle:** account customization is loaded on `join`, sent in
  `welcome`/`worldEntered`, and re-sent on reconnect within grace. `lootboxOpened` is sent only to
  the opening connection; `customizationUpdate` goes to every joined connection of the account.
  Guest state is in-memory and resets on disconnect/reload. Grace/heartbeat/capacity are unchanged.
- **Reconnection:** a reconnecting account adopts the persisted state from `welcome`; a pending
  reveal is not replayed (the grant message is one-shot). A dropped `lootboxOpened` leaves the
  inventory correct via `customizationUpdate`/`welcome` but loses the reveal animation; no error.
- **Multi-client:** multiple tabs of one account stay in sync through `customizationUpdate`; only
  the tab that opens sees the reveal. Equip/unequip is last-write-wins per slot via the atomic
  `setSlotAppearance`; different slots do not clobber each other.
- **Server authority:** all account counts, inventory, odds, duplicates and appearance are
  server-authoritative; client messages are requests validated against the catalog and ownership.
  The client never sends counts/rarity/odds.
- **Identity vs. "no accounts":** accounts remain optional. Guests play with the same catalog,
  odds, equip rules and animations locally, with no persistence. No identity conflict is
  introduced; migration only affects existing accounts.

## Containerization impact

Migration `006_granular_spaceship_parts.sql` is applied by the existing startup migration runner
against the existing `db` service. No new service, image, port, environment variable, health
signal, compose entry, Dockerfile or WebSocket endpoint is added; `podman compose up` and
`npm run smoke` remain the documented paths. The backend and frontend images absorb the source
diff through their existing builds, and `/ws` remains the WebSocket endpoint. The final gate runs
`npm run smoke` because the migration and protocol are cross-service changes; Mailpit remains the
existing auth capture. Container assets are untouched (AC-51).

## Superseded predecessor criteria

Predecessor specs are **not edited**; this ledger records only what this feature replaces.

From `spaceship-cursor`:

- **Q-3 / AC-1 shape clause** — the cone-nose + box-body + sphere-cockpit primitive shape is
  superseded by AC-1…AC-4 (21-mesh slot model). The `spaceship` group, follow/target, shots,
  ignitions, rest pose and reduced-motion contracts are retained.
- **AC-2/AC-3/AC-4/AC-5/AC-6/AC-7** — retained in full; AC-8 is extended by AC-9 (new cursor
  motion is also frozen under reduced motion).
- **Q-5 reduced motion** — retained (snap, no smoothing/shots); AC-9 adds no banking/trail/pulse.

From `spaceship-cursor-polish` and `spaceship-cursor-refinement`:

- `SPACESHIP_SCALE = 1.2`, `SPACESHIP_IGNITION_COUNT = 2`, flicker period/threshold, NDC offsets,
  plane distance and the shifted/smaller presentation are retained by AC-2/AC-5/AC-6.

From `spaceship-customization`:

- **AC-3** (“granted id is a member of the pinned 12-part catalog”) — superseded by AC-11/AC-13/
  AC-18 (one of 20 lootable v2 parts).
- **AC-6** (`appearance[part.category] = partId`) — superseded by AC-10/AC-22 (slot-keyed
  appearance).
- **AC-8** (guest equip validates against categories) — superseded by AC-27 (slot model).
- **AC-11** (12-part `PartId` union and 5-category codec) — superseded by AC-23/AC-24/AC-25.
- **AC-12** (owned-parts list with one `Equip` per part) — superseded by AC-29/AC-30 (10 slot
  rows, owned/locked/equipped, equip/unequip).
- **AC-13** (`appearanceToSpaceshipParams` returns five colours) — superseded by AC-7/AC-11
  (`appearanceToCursorShipParams` returns 10 slot visuals).
- **AC-14** (scene re-applies appearance by geometry-type traversal) — retained intent, superseded
  by AC-7 (`Spaceship.applyAppearance` slot seam).
- **§ Part catalog (12 rows)** and **Q-2** — superseded by § Part catalog v2 (30 rows).
- **Non-goal “No animation for the lootbox opening (instant result)”** — superseded by AC-32/
  AC-41 (reveal animation).
- **Q-5 duplicate handling** — extended: duplicates still increment the count, now with an
  explicit `duplicate` flag/reveal (AC-17/AC-32); no conversion.
- **Q-7 appearance scope** — retained local-only; Q-6 restates it.

From `detailed-hero-spaceship`:

- **AC-1 protected-path clause / Non-goals “cursor ship stays exactly as accepted” / Q-2** — the
  cursor-ship protection and “cursor out of scope” clauses are superseded by this feature's
  Pillar A. The hero ship, its position/palette/bob and its protected files are unchanged.

From `cube-visual-polish` and `cube-world-transition`:

- **`cube-visual-polish` AC-4 / `MINI_CUBE_POP_MS = 160`** — the pop-then-shrink + colour-flash
  timeline is superseded by AC-36's observed one-frame conceal (`MINI_CUBE_POP_MS = 0`). The
  board removal, click timing, burst-fronting, reduced-motion instant hide and the 400 ms face
  countdown are retained. `cube-world-transition`'s “400 ms is long enough for the last 160 ms pop”
  wording is retained only as the face-removal pacing; no tile shrink is required.

From `reference-image-game-view`, `modern-visual-overhaul`, `realistic-lighting-materials`,
`coin-economy`, `upgrades`, `multiplayer-*` and `user-authentication`:

- No behavior is superseded. The renderer/post-processing, coin values, upgrade effects, cube
  sync, auth/identity and container conventions remain authoritative. The existing 200 ms click
  HUD blink is retained as accepted behavior; no new coin HUD pulse is added.

## Open questions

- **Q-1 — Reference video inspection (RESOLVED 2026-11-08).** The video was decoded read-only
  (24 fps, 10.0 s, 1280×720; 40 frames + 3 contact sheets) and the observed beats are pinned in
  AC-35…AC-40/AC-44/AC-45; `video-analysis.md` records the metadata, frames and provenance.
  Extrapolated rows are marked `[E]`; AC-46 covers the disposition. No blocking question remains.
- **Q-2 — Feature split/phasing (build/performance only).** Default: one feature, built
  B→A→B→C→verification. A split is now only a delivery/performance decision (A+B first, C
  second), not a reference-fidelity blocker; the observed C scope is fully defined.
- **Q-3 — Odds, pity and rarity.** Default: rare weight 3 / epic weight 1 (75/25), uniform within
  rarity, no pity, no guaranteed-drop counter, no key purchasing. Alternatives: equal odds, a pity
  threshold, or rarity-weighted slot pools. Tuning is a constant edit plus AC-13/AC-18 updates.
- **Q-4 — Duplicates.** Default: a duplicate increments the owned count, is flagged in
  `lootboxOpened` and shown as `Duplicate`; no conversion. Alternatives: convert to coins/keys or
  a dismantle currency (would touch economy and UI). Deferred unless approved.
- **Q-5 — Left/right independence.** Default: left and right wings/engines/ignitions are separate
  slots with separate ownership and can be asymmetric (the user's “1 wing” ask). Alternative: a
  mirrored pair bought once; that would contradict the granular request and is not chosen.
- **Q-6 — Cross-client visibility.** Default: local-only cursor ship/appearance (existing behavior;
  `spaceship-customization` Q-7 retained). Broadcasting appearance would require protocol/server
  authority and a visibility/identity rule; deferred.
- **Q-7 — Guest persistence.** Default: ephemeral in-memory, reset on reload; no localStorage.
  Alternative: local guest save; deferred.
- **Q-8 — Preview scope.** Default: one real 30 fps WebGL preview while the panel is open, with a
  reduced-motion static frame and a blank labeled fallback if WebGL fails. Alternative: keep the
  current placeholder canvas; that does not meet the “preview” expectation and is not chosen.
- **Q-9 — Legacy compatibility window.** Default: accept legacy part ids on `equipPart` and
  normalize legacy rows indefinitely (cheap, map-only). Alternative: hard cutover after one
  release; requires a deprecation note and error telemetry. No telemetry exists, so the default is
  retained.
- **Q-10 — Audio.** Default: no audio, no audio dependency/asset. The video's audio onsets are
  recorded for alignment (AC-45), but sound design is a separate feature; the visual peaks (banner
  overshoot, level burst) are the hooks a future audio layer would use.
- **Q-11 — Catalog extensibility.** Default: 10 slots × 3 parts (30); decals/pilot/weapons are
  future slots with a catalog-version bump and migration. The UI is generated from the catalog, so
  adding a slot is data + model work, not a redesign.
- **Q-12 — Migration rollback.** The project has no down migrations. Default rollback: redeploy
  the previous images against a DB backup taken before migration 006; the old code ignores new
  slot keys (default appearance) but should not open lootboxes while rolled back because it would
  write legacy ids into a v2 inventory. The final build log records the backup/restore command.
- **Q-13 — Low-end performance tier.** Default: one fixed 21-mesh/≤2500-triangle model with no LOD
  or quality switch; a reproducible frame-time miss blocks (no AC relaxation). A merged-detail or
  lower-segment tier is a follow-up spec revision.
- **Q-14 — Asset pipeline.** Default: fully procedural; a GLTF/asset pipeline would improve
  realism but needs an asset, loader, licensing review and bundle budget. Not added silently; a
  user-approved spec revision is required.

## Assumptions

- The reference video was decoded read-only on 2026-11-08; `video-analysis.md` and `reference/`
  are the evidence. The observed beats are matched by AC-35…AC-40/AC-44/AC-45; the absent
  lootbox/equip/upgrade/cursor events are explicit `[E]` adaptations (AC-41…AC-43).
- Ten slots (hull, nose, cockpit, two wings, two engines, two ignitions, tail fin) cover the user's
  “one wing, cabin, ignitions” examples; decals are deferred (Q-11).
- Standard parts are implicit and always owned; only rare/epic parts enter the loot table.
- The existing `user_economy.parts`/`appearance` JSONB columns remain the storage shape; a
  `customization_version` column marks the backfill. This mirrors the accepted upgrades/economy
  pattern and avoids new tables.
- Accounts remain optional; guests mirror the opening/equip rules locally and persist nothing.
- `three@0.186.1` / `@types/three@0.186.0` provide every geometry/material used; no new dependency,
  texture, font, audio or video asset is added.
- The 350 KB initial-JS gzip budget and the average ≤ 16.7 ms / p95 ≤ 33 ms frame bar are retained;
  the current accepted build is 258.63 KB gzip, leaving headroom for the new catalog/UI/model.
- Manual screenshots, frame traces and reduced-motion A/B are acceptable evidence; the project has
  no browser-automation tier.
- The backend migration runner applies 006 at startup before listening; a failure aborts startup
  and the smoke health check catches it.
- `npm run smoke` remains the container regression even though it does not reach a lootbox; the
  account/protocol path is covered by `app.test.ts` and hub tests.
- Predecessor specs/plans/tasks/reviews remain authoritative for everything not listed under
  § Superseded predecessor criteria; they are never edited.

## Revision history

- r1 — 2026-11-08 — initial draft (planning). Pillar A cursor replacement, Pillar B 10-slot/30-part
  granular catalog with migration 006 and server-authoritative open/equip, Pillar C motion system
  with planner-pinned tokens and a blocked reference-fidelity gate (Q-1). No AC removed or
  weakened; the former reference gate was recorded as unmet.
- r2 — 2026-11-08 — **reference-video analysis disposition.** The video was decoded (24 fps,
  10.0 s, 1280×720; 40 frames + 3 contact sheets). Pillar C was rewritten around observed beats:
  target lock/reticle (AC-35), instant conceal (AC-36, superseding the 160 ms pop), 12-ray/14-shard/
  6-coin impact (AC-37), 330 ms ring (AC-38), 1100 ms coin popup (AC-39), 760 ms level burst +
  8 % banner overshoot + 700 ms ship roll/fire trail (AC-40), no screen shake (AC-44), audio
  alignment metadata (AC-45) and reference provenance (AC-46). Lootbox reveal, part equip, upgrade
  purchase and cursor ship/trail are explicitly `[E]` extrapolations (AC-41…AC-43). Q-1 resolved;
  Q-2 reduced to a build/performance option; AC-49…AC-51 renumber the verification/docs/container
  criteria. The 160 ms pop-then-shrink and its colour flash are the only accepted visual behavior
  superseded; all other A/B decisions are retained.
