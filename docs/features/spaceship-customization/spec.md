---
feature: spaceship-customization
revision: 3
status: draft
created: 2026-11-05
updated: 2026-11-05
---

# Spec — Spaceship Customization (Lootboxes, Keys, Parts, Appearance Editor)

## Summary

Introduce spaceship customization: players earn closed **lootboxes** by completing (destroying) cubes, and each lootbox requires a **key** to open. Opening grants a random **part** (a cosmetic spaceship component). A modern, HUD-consistent **appearance editor menu** lets the player view their spaceship in a live 3D preview and equip owned parts; the in-game spaceship cursor reflects the equipped appearance. Appearance and inventory are **server-authoritative and persisted per account** (new columns on `user_economy`); guests get an ephemeral, in-memory copy that resets on disconnect. The feature adds WebSocket messages for opening lootboxes and equipping parts, plus a `customizationUpdate` broadcast scoped to the owning account's joined connections. No new services, images, ports, or dependencies are added; the existing Postgres container and migration runner carry the schema change.

## User stories

- As a player, when I complete a cube, I earn a lootbox and a key, so I can later customize my ship.
- As a player, I can open a lootbox with a key to receive a random spaceship part.
- As a player, I can open an appearance editor menu and see my spaceship update live as I equip parts.
- As a player, my equipped appearance is saved to my account and restored on reconnect.
- As a guest, I can still earn and spend lootboxes/keys/parts during the session, with no persistence.

## Acceptance criteria

Verification notes: backend = `src/backend`, frontend = `src/frontend`. Evidence per AC: a test asserting concrete values, a command, or an observable step. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (thresholds ≥ 80% per workspace), `npm run build`.

### Acquisition

- **AC-1 — Lootbox + key grant on cube completion (server).** When an account member completes a cube (`cubeCompleted` accepted), the server credits `+1` lootbox and `+1` key to that account (via `grantCustomization`), updates every member with that `accountId`'s `customization` state, and sends a `customizationUpdate` carrying the new totals to every **joined** connection whose `accountSession.userId` equals the owning account. Evidence: `hub.test.ts`.
- **AC-2 — Guest grant.** When any player (guest or account) completes a cube, the engine increments the local `customization.lootboxes` and `.keys` by `1` each and publishes a new snapshot (mirroring the economy path); for accounts the server's `customizationUpdate` subsequently replaces the whole state via `adoptCustomization`. Evidence: `engine.test.ts`, `hub.test.ts`.

### Opening lootboxes

- **AC-3 — Open lootbox success.** A client sending `openLootbox` with ≥ 1 lootbox and ≥ 1 key receives, after server processing, a `customizationUpdate` whose `lootboxes` decreased by 1, `keys` decreased by 1, and `parts[<grantedPartId>]` increased by 1; the granted id is a member of the pinned part catalog (§ Part catalog). The hub updates `customization` on every member whose `accountId` equals the owning account (mirroring AC-1 and upgrades `purchaseUpgrade`) before broadcasting `customizationUpdate`. Evidence: `hub.test.ts`, `protocol.test.ts`.
- **AC-4 — Open lootbox insufficient.** With `lootboxes === 0` or `keys === 0`, `openLootbox` yields `error { code: 'no_lootbox' }` or `error { code: 'no_key' }` respectively, checked in that order (lootboxes first), and no state changes; the repository's `applyLootboxOpen` returns a discriminated result reporting which condition failed. Evidence: `hub.test.ts`.
- **AC-5 — Guest open.** A guest with sufficient counts opens a lootbox locally: counts decrement and a random part from the catalog is added to `parts` (via the engine's RNG); no message is sent; invalid (insufficient) opens are a no-op. Evidence: `engine.test.ts`.

### Equipping parts

- **AC-6 — Equip part success (server).** `equipPart { partId }` for a part the account owns updates `appearance[part.category] = partId` and broadcasts `customizationUpdate` to the account's joined connections. The hub updates `customization` on every member whose `accountId` equals the owning account (mirroring AC-1 and upgrades `purchaseUpgrade`) before broadcasting `customizationUpdate`. Evidence: `hub.test.ts`.
- **AC-7 — Equip part validation.** `equipPart` with an unknown part id yields `error { code: 'unknown_part' }`; with a known but unowned part yields `error { code: 'not_owned' }`; no state changes. Evidence: `hub.test.ts`, `protocol.test.ts`.
- **AC-8 — Guest equip.** A guest equips an owned part locally; `appearance` updates and a new snapshot is published. `equipPart(partId)` validates against the catalog and owned inventory (count > 0), no-oping on unknown/unowned part ids, mirroring server AC-7. Evidence: `engine.test.ts`.

### Persistence

- **AC-9 — Schema.** `user_economy` gains `lootboxes INT NOT NULL DEFAULT 0`, `keys INT NOT NULL DEFAULT 0`, `parts JSONB NOT NULL DEFAULT '{}'::jsonb`, `appearance JSONB NOT NULL DEFAULT '{}'::jsonb`, via migration `005_spaceship_customization.sql` (idempotent, `ADD COLUMN IF NOT EXISTS`); `schema.sql` mirrors the columns. Evidence: migration file + `schema.sql` diff.
- **AC-10 — Account load.** On `join { mode: 'account' }`, the member's `customization` is loaded from the repository (default zero state for missing rows; idle accrual unaffected); `welcome`/`worldEntered` carry `customization` (accounts only) and the engine adopts it via `adoptCustomization`, which replaces the entire customization state. Evidence: `hub.test.ts`, `session.test.ts`.

### Protocol

- **AC-11 — Client messages.** The client message union gains `openLootbox` and `equipPart { partId: string }`; the server message union gains `customizationUpdate { lootboxes: number; keys: number; parts: Record<string, number>; appearance: Record<string, string> }`; `Placement` (accounts) gains `customization?: CustomizationState`; error codes gain `no_lootbox`, `no_key`, `unknown_part`, `not_owned`. Codec rules: `openLootbox` has no fields; `equipPart.partId` is a non-empty string; `customizationUpdate` requires integer non-negative `lootboxes`/`keys`, integer positive `parts` counts, and non-empty-string `appearance` keys/values; `Placement.customization` (when present) follows the same rules. A `customizationUpdateMessage` builder and a `copyCustomizationState` defensive copy helper are provided. Both backend and frontend mirrors agree (parity tests pass). Evidence: `protocol.test.ts` both workspaces.

### UI & live preview

- **AC-12 — Menu.** A `SpaceshipCustomizationPanel` renders lootbox/key counts, an "Open lootbox" button (disabled when `lootboxes === 0 || keys === 0`), the owned-parts list with an "Equip" button per part, and a `SpaceshipPreview`. It uses the existing `app.css` classes (modern styling consistent with `UpgradesPanel`). Evidence: `SpaceshipCustomizationPanel.test.tsx` (SSR).
- **AC-13 — Live preview reflects appearance.** `SpaceshipPreview` accepts an `appearance` prop and renders a spaceship whose visual parameters are derived via the pure `appearanceToSpaceshipParams(appearance)` helper returning `{ noseColor, bodyColor, wingColor, cockpitColor, engineColor }` (hex strings; defaults when a category is absent). Unit tests pin the mapping for the default and one equipped part. Evidence: `parts.test.ts` / `spaceship.test.ts`.
- **AC-14 — In-game ship.** The in-game spaceship cursor is built/rebuilt with the equipped appearance, so equipping a part changes the cursor ship's materials. The seam: `EngineSnapshot.customization` (optional on base, always populated by `createEngine`) carries `appearance`; `SceneView.applySnapshot` re-applies the appearance to the spaceship when `snapshot.customization.appearance` changes (rebuild or material update). Evidence: `scene-spaceship.test.ts`.

### Real-time & authority

- **AC-15 — Scoped broadcast.** `customizationUpdate` is delivered only to joined connections whose `accountSession.userId` equals the owning account; guest connections receive nothing. Evidence: `hub.test.ts`.
- **AC-16 — Server authority.** Client-supplied part ids/counts are ignored unless the server validates ownership; forged `equipPart` for an unowned part yields `not_owned`. Evidence: `hub.test.ts`.

### Coverage & containers

- **AC-17 — Coverage.** `npm run coverage` passes ≥ 80% statements/branches/functions/lines in both workspaces. Evidence: final build log.
- **AC-18 — No container change.** `compose.yaml`, `compose.smoke.yaml`, Dockerfiles, and `src/server.ts` are unchanged. Evidence: final build log (`git diff` empty for those paths).

## Non-goals

- No trading, selling, crafting, or fusing of parts.
- No multiplayer visibility of customized ships (the spaceship cursor stays client-local; other clients never see it).
- No key purchasing or key crafting.
- No guest persistence across reloads (ephemeral session only).
- No rarity-weighted or pity systems beyond uniform random selection from the catalog (tuning deferred).
- No animation for the lootbox opening (instant result).
- No new dependencies, services, images, ports, or environment variables.

## Boundaries

- ✅ Always: keep `game/**` and `multiplayer/**` pure where sensible; server authority over shared/account values; parameterized SQL only; concrete test assertions; run lint/typecheck/tests/coverage before reporting done; record evidence in build logs; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency; any pinned-constant deviation; touching files outside a task's `files_owned`; any coverage exclusion or threshold change; editing `docs/product/vision.md`.
- 🚫 Never: weaken assertions; commit secrets or `.env*` edits; trust client-supplied part ids/counts; edit predecessor feature specs/plans/tasks; push; change ACs unilaterally.

## Security considerations

- **User-controlled data:** `equipPart.partId` (client-supplied). Validated server-side against the pinned catalog and the account's owned inventory; unknown/unowned yields an error and no state change.
- **Persistence integrity:** new columns are `NOT NULL` with safe defaults; migration is idempotent (`ADD COLUMN IF NOT EXISTS`); a failed migration aborts startup. Repository is the only DB access path; parameterized SQL only.
- **Secrets:** no new secrets; `.env*` untouched.
- **Abuse bounds:** `openLootbox`/`equipPart` are per-connection messages flowing through the existing message-size cap (`MAX_MESSAGE_BYTES`); server validates ownership; no unbounded growth (parts inventory is a count map over a fixed catalog).
- **Client safety:** no secrets in bundle; no `dangerouslySetInnerHTML`.

## Testing strategy

- **Backend unit (Vitest, node):** `parts.test.ts` (catalog ids/categories/names/visual params, `isValidPartId`, `partCategory` (throws on unknown), `randomPartId` determinism with injected RNG); `economy-repository.test.ts` extended (new columns read/write, `grantCustomization`, `applyLootboxOpen` success/insufficient with reason + check order, `setAppearance`, `findCustomizationByUserId` default zero state); `protocol.test.ts` extended (new messages/error codes, `customizationUpdate` codec rules, `Placement.customization`, `customizationUpdateMessage`, `copyCustomizationState`); `hub.test.ts` extended (grant on completion, open/equip success & validation, member `customization` update on grant/open/equip, scoped broadcast, authority).
- **Backend integration:** `app.test.ts` (optional) real app smoke of the new messages; migration idempotency in `migrate.test.ts`.
- **Frontend unit (Vitest, node):** `parts.test.ts` (catalog mirror, `appearanceToSpaceshipParams`), `protocol.test.ts` (parity), `engine.test.ts` (guest grant/open/equip + adopt + validation), `spaceship.test.ts` (appearance params), `scene-spaceship.test.ts` (material update on appearance change), `SpaceshipCustomizationPanel.test.tsx` (SSR contract), `SpaceshipPreview.test.tsx` (SSR contract), `session.test.ts` (commands, incl. guest open/equip branch).
- **E2E / container:** no new smoke assertions required; existing smoke remains the regression check.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace; pre-gates per task workspace-scoped. No exclusions added.
- **Assertion bar:** concrete expected values everywhere; no banned wildcard matchers; no snapshot-only/assertion-free tests.

## Real-time impact

- **New shared/cross-client state:** none cross-client. Customization is per-account and is loaded/broadcast only to that account's own joined connections (AC-15); it does not affect other members' worlds, cubes, or rosters.
- **Connection lifecycle:** `customization` is loaded on `join` (account) and sent in `welcome`/`worldEntered`; on reconnect within grace, resume sends the current `customization` again in `welcome`. No change to grace/heartbeat/cap.
- **Reconnection:** a reconnecting account socket receives the persisted `customization` in `welcome`; in-memory guest customization is lost on disconnect (non-goal).
- **Multi-client:** multiple tabs of the same account each receive `customizationUpdate` when any tab opens/equips (account-scoped broadcast), matching the upgrades pattern.
- **Server authority:** all counts, inventory, and appearance are server-authoritative for accounts; client inputs are requests validated server-side (AC-16).
- **Identity vs. "no accounts":** accounts remain optional; guests play without persistence. No conflict introduced (consistent with user-authentication).

## Containerization impact

No new services, images, ports, environment variables, or health signals. The schema change ships as migration `005_spaceship_customization.sql` applied by the existing startup migration runner against the existing `db` service; `podman compose up` and `npm run smoke` are unchanged. Container assets (`compose.yaml`, Dockerfiles) and `src/server.ts` are not touched (AC-18).

## Part catalog (pinned default — Q-2)

Uniform random selection over all rows. `PartId` is the union of the ids below.

| id | category | name | color (hex) |
| --- | --- | --- | --- |
| `nose-default` | nose | Default Nose | `#88aaff` |
| `nose-crimson` | nose | Crimson Nose | `#cc4444` |
| `nose-emerald` | nose | Emerald Nose | `#44cc88` |
| `body-default` | body | Default Body | `#4466cc` |
| `body-obsidian` | body | Obsidian Body | `#222233` |
| `body-gold` | body | Gold Body | `#ccaa44` |
| `wings-default` | wings | Default Wings | `#4466cc` |
| `wings-silver` | wings | Silver Wings | `#aaaaaa` |
| `cockpit-default` | cockpit | Default Cockpit | `#ffffff` |
| `cockpit-amber` | cockpit | Amber Cockpit | `#ffaa44` |
| `engine-default` | engine | Engine Flame | `#ff6600` |
| `engine-blue` | engine | Blue Engine | `#4488ff` |

Default appearance (empty map) renders the `*-default` colors; equipping a part sets that category's color to the part's color.

## Open questions

- **Q-1 — Key acquisition ratio (default-with-notice).** Default: 1 key per completed cube (1:1 with lootboxes). Alternative: scarcer (e.g., 1 key per 3 cubes). Tuning affects only the grant constant. Default accepted unless user overrides.
- **Q-2 — Part catalog (pinned).** Default list pinned above (12 parts, 5 categories, uniform random). Visual tuning is a constant/geometry edit; deviations require spec revision. **No longer blocking** (default pinned per F1).
- **Q-3 — Guest persistence (default-with-notice).** Default: ephemeral in-memory (resets on reload). Alternative: persist to `localStorage`. Deferred unless approved.
- **Q-4 — Lootbox drop on mini-cube? (default-with-notice).** Default: grant on cube completion only. Alternative: occasional mini-cube drops. Deferred.
- **Q-5 — Duplicate part handling.** Default: duplicates increment the count (no conversion). Alternative: convert duplicates to keys/coins. Deferred.
- **Q-6 — Live preview rendering.** Default: a small dedicated WebGL canvas in the menu. If WebGL is unavailable, the preview is hidden and the menu still functions. (Implementation detail; flagged for builder.)
- **Q-7 — Appearance scope.** Default: affects only the owning client's spaceship cursor. Alternative: broadcast appearance to other clients. Deferred (would need protocol + server authority).
- **Q-8 — Migration numbering.** Assumes `005` is next free; verify at build time.

## Assumptions

- "Destroying cubes" maps to cube completion (clearing all six faces), consistent with the existing `COINS_PER_CUBE` credit path; mini-cubes grant coins only.
- Part catalog is shared (same ids) between backend (validation/RNG) and frontend (rendering), mirrored manually as in the upgrades feature.
- Accounts are optional; guests get ephemeral customization state in the engine, mirroring the guest coin path.
- The existing `user_economy.upgrades` JSONB pattern is reused for `parts`/`appearance`.
- No change to the explosion visual timing or server cube logic.

## Revision history

- r1 — 2026-11-05 — initial draft (planning phase).
- r2 — 2026-11-05 — spec review r1: pinned part catalog table (F1); extended AC-11/protocol contract (`customization?` on `Placement`, `customizationUpdate` codec rules, `customizationUpdateMessage` + `copyCustomizationState`) (F2); pinned reactive seam `EngineSnapshot.customization` + `SceneView` re-apply (F3); discriminated `applyLootboxOpen` result with check order (F4); clarified AC-2/AC-10 grant & adopt semantics (F5); fixed `isValidPartId` signature, T6 AC ownership, guest equip validation, `partCategory` contract, RNG injection, missing-row default, broadcast scoping wording, `appearanceToSpaceshipParams` output shape, interface placement + `CustomizationState` location, Q-2 blocking status (F6–F15); F16 folded as default-with-notice.
- r3 — 2026-11-05 — spec review r2: guest-vs-account branching in session contract (F17); member `customization` update on open/equip before broadcast (F18); `SpaceshipPreview.test.tsx` (SSR contract) named in testing strategy (F19).

## Review response (spec-r1)

| ID | Severity | Disposition | What changed |
| --- | --- | --- | --- |
| F1 | MAJOR | Fixed | Pinned part catalog table in § Part catalog (12 parts, 5 categories, ids/names/colors); Q-2 no longer blocking. |
| F2 | MAJOR | Fixed | AC-11 extended: `customization?` on `Placement` (accounts), codec rules, `customizationUpdateMessage` + `copyCustomizationState` named; plan § Interfaces updated. |
| F3 | MAJOR | Fixed | AC-14 pins seam: `EngineSnapshot.customization` + `SceneView` re-apply on appearance change; test path `scene-spaceship.test.ts`. |
| F4 | MAJOR | Fixed | AC-4 + plan: discriminated `applyLootboxOpen` result reporting `no_lootbox`/`no_key`; check order lootboxes first. |
| F5 | MAJOR | Fixed | AC-2/AC-10 + plan: engine grants on every completion (guest + account), `customization?` optional on base but always populated by `createEngine`, `adoptCustomization` replaces whole state. |
| F6 | MINOR | Fixed | Plan: `isValidPartId(id: string): id is PartId` (type predicate), mirroring upgrades. |
| F7 | MINOR | Fixed | tasks.md T6 acceptance: removed AC-8 (kept AC-13); T8 owns AC-8. |
| F8 | MINOR | Fixed | AC-8 + plan: guest `equipPart` validates catalog + owned inventory, no-op on invalid/unowned. |
| F9 | MINOR | Fixed | Plan: `partCategory` throws on unknown id. |
| F10 | MINOR | Fixed | Plan: openLootbox RNG from `deps.random` factory; tests inject deterministic factory. |
| F11 | MINOR | Fixed | Plan: `findCustomizationByUserId` returns default zero state for missing rows. |
| F12 | MINOR | Fixed | AC-1 wording: "joined connections authenticated as that account". |
| F13 | MINOR | Fixed | AC-13 + plan: `appearanceToSpaceshipParams` returns `{ noseColor, bodyColor, wingColor, cockpitColor, engineColor }` hex strings. |
| F14 | MINOR | Fixed | Plan: methods on `GameEngine`/`OnlineGameEngine`/`OnlineGameSession` (optional on base, implemented by createEngine/createGameSession); `CustomizationState` in backend `protocol.ts` and frontend `types.ts`. |
| F15 | INFO | Fixed | Q-2 marked pinned (no longer blocking); default list recorded. |
| F16 | INFO | Fixed (note) | Q-1/Q-3/Q-4/Q-5/Q-6/Q-7/Q-8 marked default-with-notice (consistent with upgrades). |

## Review response (spec-r2)

| ID | Severity | Disposition | What changed |
| --- | --- | --- | --- |
| F17 | MAJOR | Fixed | Plan § Session extended with guest-vs-account branching (track `joinedMode`; guest → `engine.openLootbox()`/`engine.equipPart(partId)` + publish; account → send `{type:'openLootbox'}`/`{type:'equipPart',partId}`; errors leave state unchanged); T11 acceptance extended; session-level guest-branch tests added (testing strategy). |
| F18 | MAJOR | Fixed | AC-3 and AC-6 (and plan § Hub) now require the hub to update `customization` on every member whose `accountId` equals the owning account on open/equip, before broadcasting `customizationUpdate` (mirroring AC-1 and upgrades `purchaseUpgrade`). |
| F19 | MINOR | Fixed | `SpaceshipPreview.test.tsx` (SSR contract) added to the frontend unit list in § Testing strategy; file remains in plan file inventory. |