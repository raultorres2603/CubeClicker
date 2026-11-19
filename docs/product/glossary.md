# CubeClicker — Glossary

The terms in this glossary are the canonical CubeClicker terminology.
Docs and agents should use these terms as defined here rather than informal synonyms, and new terms or changed meanings should be added to this file in the same change that introduces them.

## Terms

### account

**Definition:** An optional, persistent player identity created by registering a username, email and password. An account is activated only after email verification, and its username is also its display name. Accounts are additive: a player may always choose guest play instead, and no account is ever required to play. Account identity is resolved server-side from the session cookie; the client never supplies an account id or verified flag.
**Example:** A returning player logs in with username and password to resume the same account identity across sessions.

### activity feed

**Definition:** A compact, per-**game server** ticker of notable events the backend has already validated — cube cleared, fast clear, level milestone, epic loot, member joined and member left (an explicit leave or a grace expiry on a server that survives). The hub derives each event on the server that owns it, accepts at most one event per server per second, and keeps the newest 20 in memory (newest first); an event is **live for five seconds** (`ACTIVITY_EVENT_TTL_MS = 5000`). The hub's `welcome` and `worldEntered` snapshots carry only events younger than five seconds, so a joining or reconnecting member never sees stale activity, and the frontend expires each line 5000 ms after it first receives it, so a line disappears even when no newer event arrives. The frontend shows the five newest live entries in a non-interactive, non-live ticker below the connection banner; because the cadence is one event per second and the window is five seconds, at most five events are live at once. The feed is server-derived and per server: it carries no free text (only server-issued names and catalog identifiers) and no history across restarts — a backend restart clears every feed.
**Example:** `Player 2 joined` appears in the ticker of game server 1, stays for about five seconds and then disappears; a member reconnecting to that server sees only the events accepted in the last five seconds in the welcome snapshot.

### appearance

**Definition:** The equipped look of a player's spaceship, expressed as a map from **part slot** to a part id; a missing slot resolves to that slot's standard part. Slots are equipped and unequipped independently, so a loadout may be asymmetric (for example a silver port wing and a gold starboard wing). It is persisted per **account** in the `user_economy.appearance` column and is also the **public appearance projection**: every **server member**'s equipped map is carried on the wire (`MemberState.appearance` and the `memberAppearance` frame) and rendered as that member's **remote ship** while that member is being **spectated**, so other players see the real loadout. The projection carries only slot→part-id strings — inventory counts, coins, upgrades and account identity are never public. **Guests** keep an ephemeral copy for the session and report it to the server so their ship is visible to others. Changing appearance updates the live 3D preview and the in-game pointer ship.
**Example:** Equipping `wing-left-silver` sets the `wing-left` slot to that part and recolors the port wing, while the starboard wing keeps its previous part.

### chassis form

**Definition:** The hull-shape recipe of a generated **part** — one of the ten generated forms (`Dart`, `Lance`, `Needle`, `Manta`, `Hauler`, `Bulwark`, `Arrow`, `Orca`, `Talon`, `Kite`) or `Classic`. A form drives the per-slot scale, rotation and offset transforms and a chassis triple applied to the whole ship model, so choosing a form changes the silhouette at once on the hull, wings and tail. The form comes from the equipped hull part; `Classic` keeps the accepted v2 transforms and the identity chassis `[1, 1, 1]`. Equipping a hull of another form multiplies the chassis by the 260 ms equip pulse — it never overwrites it.
**Example:** Equipping `hull-dart-chrome` selects the `Dart` form, giving the model the chassis `[0.95, 0.9, 1.25]` and the hull slot the scale `[0.85, 0.9, 1.15]`.

### click

**Definition:** The player's primary action on the cube, and also the discrete event that action produces; each click earns points. This is the canonical word for the action, preferred over informal synonyms.
**Example:** One click on the cube adds a point to the total.

### coins

**Definition:** The in-game currency earned by destroying **mini-cubes** (`COINS_PER_MINI_CUBE`, default `0.1` per mini-cube) and completing **cubes** (`COINS_PER_CUBE`, default `5` per cube, doubled when the cube is completed within the size-dependent speed-bonus threshold). Coins are persisted per **account** in the `user_economy` table and reconcile across connected clients over WebSocket; **guests** earn coins locally for the session only and nothing is persisted. Coins are distinct from **points**, the core clicker currency earned by clicking.
**Example:** Destroying a mini-cube awards `0.1` coins; completing a cube awards `5` coins, or `10` when completed within the threshold.

### cube

**Definition:** The central interactive object of the game and the thing the player clicks; the namesake of CubeClicker. It is the focus of every click that earns points.
**Example:** Clicking the cube is the fastest way to earn your first points.

### cube level

**Definition:** A single cube in the run, made of six **faces** of N² **mini-cubes** each (6N² mini-cubes per cube level), where N is the level's random grid size — every cube level draws its own N in 3 to 7. Clearing every face completes the cube level: the game travels to the next cube level, which spawns at a random **cube world position** — left, right, above or below the finished cube, 24 world units away — as a fresh cube in a new style and with its own random grid size, while the player's stats carry over (in online play the next cube level's position is the server-assigned ring slot — see **cube world position**).
**Example:** Destroying the last mini-cube of the sixth face completes the cube level and travels to the next cube.

### cube world position

**Definition:** The fixed position of a **cube level** in the game's flat world plane. In the single-player mode, the first cube level sits at the origin and each new cube level spawns at the previous cube's world position plus the travel-direction offset of 24 world units (left, right, above or below), so the walk accumulates across levels. In online play, the **game server** assigns every **server member**'s cube a slot position on that server's ring layout — slot `s` of capacity X sits at angle `2π·(s−1)/X` and radius `X·24/(2π)` on the world plane — so occupancy is guaranteed by construction and no two members' cubes share a position; a member's position stays fixed while they remain on the server. The camera always rests above the current cube's world position, looking at it.
**Example:** In single-player, a cube level that travels to the right puts the next cube at 24 world units to the right of the finished one, and two consecutive rightward travels land at 48 world units. Online with X = 10, the member in slot 1 has their cube at approximately (38.2, 0, 0), and slot 2's cube sits 24 world units away along the ring's arc.

### face

**Definition:** One of the six flat sides of the cube — front, back, left, right, top and bottom — each an N×N grid of **mini-cubes**, where N is the cube level's random grid size (3 to 7), identical on all six faces. A face is cleared (and disappears from the cube) when its last mini-cube is destroyed.
**Example:** Destroying every mini-cube on the front face clears that face, and the remaining five faces stay playable.

### finish

**Definition:** The colour and rarity recipe of a generated **part** — one of twelve finishes, six rare (`Chrome`, `Azure`, `Ember`, `Jade`, `Steel`, `Ivory`) and six epic (`Abyss`, `Aurum`, `Violet`, `Crimson`, `Plasma`, `Solar`). A finish sets the part's `color`, `accent` and rarity; the hangar's **form and finish picker** chooses a form first and then one of its 12 finish cells (or one of the 3 classic cells, 1 on `shot`). A generated part id is `slot-form-finish` and its name is `<Finish> <Form> <noun>`.
**Example:** `hull-dart-chrome` is the rare `Chrome` finish on the `Dart` hull, rendering `#c9d4e2` with the `#ffffff` accent.

### game server

**Definition:** A logical room inside the single backend process that holds up to X **server members**' cubes in one world, where X is the configured capacity (default 10, valid 2–24). A game server is created lazily when its first member joins — no server exists at boot — and is destroyed immediately when its last member leaves. Servers are numbered with sequential integers from 1; ids are assigned at creation and never reused, so a gap in the sequence simply records a destroyed server. Every member of the server sees only that server's world, roster and play.
**Example:** The first user joins and the backend creates game server 1; when server 1 is full, the next join creates game server 2.

### guest

**Definition:** A player with no account, using the ephemeral identity (a server-issued id plus an in-memory token, no persistence) exactly as before. Guest play is first-class and remains available now that accounts exist; no game state is persisted for guests.
**Example:** Selecting `Play as guest` starts immediately with an ephemeral identity and no account.

### hangar tab

**Definition:** One of the six UI groups that split the eleven **part slots** in the **Spaceship Customization** menu: `Frame` (`hull`, `tail-fin`), `Front` (`nose`, `cockpit`), `Wings` (`wing-left`, `wing-right`), `Engines` (`engine-left`, `engine-right`), `Ignitions` (`ignition-left`, `ignition-right`) and `Shots` (`shot`), in that order — two slots each except `Shots`, which holds one. A hangar tab is a presentation grouping over the **part slot** catalog — not a domain term and not a second kind of slot — and it owns no game state: the selected tab is panel-local, resets to `Frame` on every open, is never persisted or sent over the wire, and after a lootbox reveal the panel lands on the tab containing the granted slot. Each tab shows an `<owned>/<total>` badge over its lootable (rare + epic) parts — **244** on each ship tab and **120** on `Shots` — and is announced as `<Label>, <owned> of <total> parts owned`.
**Example:** Equipping `wing-left-silver` happens under the `Wings` tab, whose badge reads `1/244` when that is the only looted part of the group.

### idle progress

**Definition:** Progress that accrues while the game is open and the player is present but not clicking; it is distinct from offline progress. Earning mechanics for this accrual remain to be defined by a future feature.
**Example:** Idle progress keeps earning points while the game is open and you stop clicking.

### key

**Definition:** A resource required to open a **lootbox**. Earned alongside a lootbox when a **cube** is completed (one key per completed cube). Keys are persisted per **account** in the `user_economy.keys` column; **guests** earn them for the session only. Spending a key together with a lootbox grants a random **part**.
**Example:** Completing a cube awards `+1` key; opening a lootbox consumes `1` key.

### live leaderboard

**Definition:** A compact, per-**game server** ranking of that server's current **server members** by their session progress: cubes completed, then accepted clicks, then server slot order. The hub counts each member's accepted clicks, faces cleared and cubes completed from transitions it has already validated — never from a client-reported value — and publishes the top five entries plus server-wide totals at most once per second, coalesced per server, so a busy server never receives a frame per click. Fresh joins, reconnects and cross-server moves receive the current snapshot in the `welcome`/`worldEntered` placement. Counters are session-scoped: they follow a member who moves servers, a member in reconnect grace stays ranked until final removal, and a backend restart clears everything. The leaderboard ranks no coins and reads no persisted account totals, so **guests** and accounts compete on exactly the same basis; the panel is non-interactive, not a live region and has a reduced-motion variant.
**Example:** A guest and an account that each completed one cube are ranked by their accepted clicks on the same game server, and the panel shows the five leaders plus `Server totals: 2 cubes · 40 clicks · 3 faces`.

### lootbox

**Definition:** A closed container earned by completing (destroying) a **cube**. A lootbox requires a **key** to open; opening consumes one of each and grants exactly one random lootable **part** for one **part slot** (75% rare, 25% epic). Lootboxes are persisted per **account** in the `user_economy.lootboxes` column; **guests** earn them for the session only.
**Example:** Completing a cube awards `+1` lootbox.

### lootbox reveal

**Definition:** The client-local, non-modal animation that presents a lootbox opening to the connection that opened it. It plays the accepted 1290 ms timeline (420 ms charge, 250 ms orb pulse with overshoot, 120 ms flash, 360 ms reveal and 140 ms settle) as a **reveal stage**: the granted **part** is staged in 3D on the player's own ship in the customization visualizer, with a rarity-coloured ring, a slot pulse and a key-light flash, alongside the card that names the part, **part slot**, rarity (rare or epic), new/duplicate status and owned count. The reveal is client-local presentation: the server remains authoritative and sends the opener-only grant plus the absolute inventory, and other connections of the account receive the inventory update without replaying the reveal. `Escape`, `Dismiss` and `Equip` close it (`Equip` also equips the part), closing the customization panel is a dismissal, and a `welcome` or a lost connection clears it. Under reduced motion the settled result appears instantly; without WebGL an inline ship fallback replaces the stage.
**Example:** Opening a lootbox plays the 3D reveal with `Port Silver Wing` staged on the port wing, the blue rarity ring and the `Rare · New` card; pressing `Equip` closes the stage and equips the part.

### mini-cube

**Definition:** A single clickable tile of a **face**: one of the N² cells of that face's N×N grid (N is the cube level's random grid size, 3 to 7), identified as `face:row:col` with 0-based rows and columns (for example `front:0:0`). The tiles sit with a thin uniform seam between them — the dark interior shows through as the tile lines — so the cube's surface reads as one giant cube built from mini-cubes; destroying a mini-cube removes it from its face for good and exposes the dark interior behind it. It is the unit of destruction for the cube.
**Example:** The mini-cube `front:0:0` is the top-left tile of the front face; on a 5×5 face destroying it leaves 24 mini-cubes on that face.

### motion token

**Definition:** A named, pinned presentation constant — a duration, count, distance, scale, speed or angle — in the `MOTION` table (`src/frontend/src/game/motion.ts`) that the 3D renderer, React UI and CSS animations share, so one motion language has a single source of truth. The 21 CSS-mapped durations are declared as `--motion-*` custom properties on `main` in `game-view.css` and asserted equal to their `MOTION` values by tests; all other tokens stay JS-only. Four of them drive the hangar and menu presentation: `menuBootMs` (`320`, `--motion-menu-boot-ms`), `menuFlickerMs` (`120`, `--motion-menu-flicker-ms`), `menuChromaMs` (`90`, `--motion-menu-chroma-ms`) and `tabSwitchMs` (`140`, `--motion-tab-switch-ms`).
**Example:** `MOTION.coinPopMs` (1100 ms) drives the coin popup, and its CSS mirror is `--motion-coin-pop-ms: 1100ms`.

### offline progress

**Definition:** Progress credited for the time the player was away with the game not running, delivered on return; it is distinct from idle progress. This is the concept behind the idle-friendly principle.
**Example:** When you return after a break, offline progress grants the points you would have earned.

### part

**Definition:** A cosmetic spaceship component belonging to exactly one of the eleven **part slots** (hull, nose, cockpit, wing-left, wing-right, engine-left, engine-right, ignition-left, ignition-right, tail-fin and shot). The catalog has **1,351 parts**: each of the ten ship slots has three classic parts (standard, rare and epic) plus 120 generated parts (ten **chassis form**s × twelve **finishes**), and the `shot` slot has its standard bolt plus 120 generated **shot style**s. The 11 standard parts are always owned and never looted, while the 1,340 rare/epic parts are granted one per **lootbox** opening. Parts can be equipped in the spaceship customization menu to change the ship's colours, accents, chassis shape and shot style. Owned part counts are persisted per **account** in the `user_economy.parts` column.
**Example:** `hull-dart-chrome` is a generated rare hull part (`Chrome Dart Hull`); equipping it changes the hull shape and palette, and a lootbox opening can grant it once.

### part slot

**Definition:** One of the eleven independently customizable positions on a player's spaceship: the ten ship positions — `hull`, `nose`, `cockpit`, `wing-left`, `wing-right`, `engine-left`, `engine-right`, `ignition-left`, `ignition-right` and `tail-fin` (displayed as Hull, Nose, Cockpit, Port Wing, Starboard Wing, Port Engine, Starboard Engine, Port Ignition, Starboard Ignition and Tail Fin) — plus `shot` (displayed as Shot), which carries the projectile and muzzle style and has no ship mesh. Each ship slot has 123 catalog rows (3 classic + 120 generated) and `shot` has 121 (its standard bolt + 120 generated), so the left and right sides are independent. A slot with no equipped part resolves to its standard part, which is always owned.
**Example:** Equipping `tail-fin-comet` fills only the `tail-fin` slot; the hull, wings, engines and shot keep their own parts.

### points

**Definition:** The core resource of CubeClicker, earned by clicking the cube and spent on upgrades. It is the canonical name for the game's currency.
**Example:** Each click adds points that you can save for your next upgrade.

### prestige

**Definition:** A voluntary reset of run progress in exchange for a lasting advancement, following the standard clicker genre concept. Reset and bonus mechanics remain to be defined by a future feature.
**Example:** A player may choose to prestige, trading the current run for a permanent bonus.

### presence

**Definition:** Whether a user currently owns a slot on a **game server** as a **server member**, and therefore appears in that server's roster, `Users on Server` panel and live leaderboard. Presence has exactly two sub-states — **connected** (a joined socket is attached) and **in grace** (the socket closed abruptly and the 30-second reconnect grace has not expired) — and they are indistinguishable in the UI: no presence field is sent and there is no "reconnecting" marker. A deliberate close — closing the tab or reloading the page — sends the additive, self-only `leave` frame on a non-bfcache `pagehide`, and the server finalizes the member immediately: no grace, an immediate `memberLeft (left)` to the remaining members, the slot freed and the server destroyed when it was the last member. An **abrupt close** — a network drop, a crash, a killed tab or a `leave` that never arrived — keeps the member and slot for `RECONNECT_GRACE_MS` (30 000 ms) so a `rejoin` can resume the same member. Presence is per connection: two tabs are two members, and closing one tab removes only that tab. The deliberate-close path is best-effort during unload, so a lost or late `leave` falls back to grace and a reload can briefly show two members until expiry.
**Example:** Closing the game tab sends `leave`, so the player disappears from the other players' `Users on Server` panel at once and from the leaderboard at the next coalesced update instead of lingering for 30 seconds.

### remote ship

**Definition:** The client-local 3D ship rendered for the **server member** currently being **spectated**, above-front of their cube at the anchor offset `(1.6, 2.8, 4.4)` and scale `1.2`. It reuses the cursor-ship model and the same `appearanceToShipParamsV3` mapping as the player's own ship, so it shows that member's equipped parts, **chassis form** and **shot style**; it idles with a small bob/sway, fires when the owner's accepted removals arrive (one shot per 90 ms, at most two in flight) with the owner's projectile and muzzle, and re-skins live when the owner changes parts. Exactly one remote ship exists, and only while spectating — its cube is the only remote cube on screen in the accepted camera layouts. It never follows a pointer, travels, banks or affects shared state. Under reduced motion it is static and a removal renders one 120 ms flash at the target.
**Example:** Spectating `Player 2` shows their `Chrome Dart Hull` ship above their cube, bobbing gently and firing their violet wave shots as they clear mini-cubes.

### reveal stage

**Definition:** The 3D presentation inside a **lootbox reveal**: a second, small three.js scene built from the same cursor-ship model and appearance mapping as the pointer ship and the customization preview. It shows the player's ship with only the granted **part slot** staged with the won part (the stored **appearance** is not mutated), one rarity-coloured ring, the slot pulse and a key-light flash, driven by the pure 1290 ms pose timeline. The stage is built on demand in the deferred customization chunk, owns exactly one WebGL context in addition to the main scene's own context (the panel does not render its preview while the stage is shown) and one bounded 30 fps loop, and is disposed on dismissal, grant replacement or unmount; the main game scene's loop and quality tier are untouched. Under reduced motion it renders one static rest frame.
**Example:** The reveal stage yaws the ship to the port wing, pulses that slot by 10 % and fades the rarity ring out by the settle beat at 1150 ms.

### save

**Definition:** The persisted game state, and also the act of persisting it. This term covers both senses and relates to the persistence principle.
**Example:** The game writes a save so your points survive a reload.

### server member

**Definition:** A user who has been assigned to a **game server** and owns exactly one **cube** on that server's ring layout at a server-assigned **cube world position**. A member's identity is either an account (a verified session resolved server-side from the cookie) or an ephemeral guest (a server-issued id plus an in-memory token, no account); accounts are optional and guest play remains first-class. One connection is one member — two browser tabs are two members. The member keeps their slot while they stay on the server. A deliberate close (closing the tab or reloading the page) sends `leave`, which ends the member's **presence** immediately; after an **abrupt** disconnect (network drop, crash, killed tab or a `leave` that never reached the server) the slot is retained for the reconnect grace window so a `rejoin` inside it resumes the same member. The member moves to another server only when a completed cube executes a rebalance move. Other members see a server member's cube and live play; the member is listed in the `Users on Server` panel by display name.
**Example:** Player 2 joins while game server 1 is full, becoming the first server member of game server 2 with a cube at slot 1 of that server's ring.

### session

**Definition:** A server-side, opaque authentication session carried in an `HttpOnly` cookie with a 7-day sliding expiry. It is created on login or email verification, revoked on logout, and all prior sessions for an account are revoked when a new login succeeds (single active session). The backend resolves account identity from this cookie on the server; the client never reads it.
**Example:** Logging in sets the session cookie; `GET /auth/me` returns the authenticated user while it is valid.

### shot style

**Definition:** The equipped appearance of the `shot` **part slot**, resolved by `shotStyleForPart` into one of four projectile geometries (`bolt`, `orb`, `wave`, `shard`), a projectile scale, one of three muzzle forms (`spark`, `ring`, `petal`) and a pair of projectile/muzzle colours. The player's pointer ship and every **remote ship** fire with their owner's shot style; an in-flight shot keeps the geometry and muzzle it captured at spawn while a live style change updates the colours and the next shot's form. A missing, unknown or non-`shot` part resolves to `shot-default` — the accepted `bolt` projectile with the `spark` muzzle, `#fff1c8` projectile and `#ffd27a` accent.
**Example:** Equipping `shot-orca-violet` makes the next shot a violet `wave` torus with a `petal` muzzle, while a shot already in flight keeps its previous form.

### spectating

**Definition:** The view-only mode entered by travelling the camera to another **server member**'s cube; it is client-local and never changes shared game state. A spectate travel flies the accepted camera flight from the current cube to the target member's cube, and on arrival clicks, W/A/S/D and arrow keys are ignored while the target's live play stays visible. The spectator can return to their own cube at any time with the same flight, which restores normal play; the mode also ends automatically if the spectated member leaves the server.
**Example:** Choosing Player 2 in the `Users on Server` panel flies the camera to Player 2's cube; while spectating, clicking does nothing until `Return to my cube` brings the player back.

### upgrade

**Definition:** A purchasable improvement bought with points that increases the rate at which the player earns. Upgrades are the main way to spend points for faster progress.
**Example:** Buying an upgrade with points makes every future click more valuable.

### upgrades

**Definition:** Purchasable improvements bought with **coins** that increase the rate at which the player earns; upgrade levels and coin balances are persisted per **account** in the `user_economy` table and reconcile across connected clients. Upgrades are the main way to spend coins for faster progress.
**Example:** Buying upgrades with coins makes every future mini-cube and cube reward larger.

### verified account

**Definition:** An account whose email has been verified by consuming a valid, unexpired, single-use verification token (`verified = true`). Only a verified account may join the game as an account; an unverified account must verify (and may resend the verification email) before playing.
**Example:** After clicking the activation link, the account becomes verified and can join the game.
