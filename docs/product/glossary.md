# CubeClicker — Glossary

The terms in this glossary are the canonical CubeClicker terminology.
Docs and agents should use these terms as defined here rather than informal synonyms, and new terms or changed meanings should be added to this file in the same change that introduces them.

## Terms

### account

**Definition:** An optional, persistent player identity created by registering a username, email and password. An account is activated only after email verification, and its username is also its display name. Accounts are additive: a player may always choose guest play instead, and no account is ever required to play. Account identity is resolved server-side from the session cookie; the client never supplies an account id or verified flag.
**Example:** A returning player logs in with username and password to resume the same account identity across sessions.

### appearance

**Definition:** The equipped look of a player's spaceship, expressed as a map from **part slot** to a part id; a missing slot resolves to that slot's standard part. Slots are equipped and unequipped independently, so a loadout may be asymmetric (for example a silver port wing and a gold starboard wing). It is persisted per **account** in the `user_economy.appearance` column and broadcast to that account's joined connections; **guests** keep an ephemeral copy for the session. Changing appearance updates the live 3D preview and the in-game pointer ship.
**Example:** Equipping `wing-left-silver` sets the `wing-left` slot to that part and recolors the port wing, while the starboard wing keeps its previous part.

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

### game server

**Definition:** A logical room inside the single backend process that holds up to X **server members**' cubes in one world, where X is the configured capacity (default 10, valid 2–24). A game server is created lazily when its first member joins — no server exists at boot — and is destroyed immediately when its last member leaves. Servers are numbered with sequential integers from 1; ids are assigned at creation and never reused, so a gap in the sequence simply records a destroyed server. Every member of the server sees only that server's world, roster and play.
**Example:** The first user joins and the backend creates game server 1; when server 1 is full, the next join creates game server 2.

### guest

**Definition:** A player with no account, using the ephemeral identity (a server-issued id plus an in-memory token, no persistence) exactly as before. Guest play is first-class and remains available now that accounts exist; no game state is persisted for guests.
**Example:** Selecting `Play as guest` starts immediately with an ephemeral identity and no account.

### idle progress

**Definition:** Progress that accrues while the game is open and the player is present but not clicking; it is distinct from offline progress. Earning mechanics for this accrual remain to be defined by a future feature.
**Example:** Idle progress keeps earning points while the game is open and you stop clicking.

### key

**Definition:** A resource required to open a **lootbox**. Earned alongside a lootbox when a **cube** is completed (one key per completed cube). Keys are persisted per **account** in the `user_economy.keys` column; **guests** earn them for the session only. Spending a key together with a lootbox grants a random **part**.
**Example:** Completing a cube awards `+1` key; opening a lootbox consumes `1` key.

### lootbox

**Definition:** A closed container earned by completing (destroying) a **cube**. A lootbox requires a **key** to open; opening consumes one of each and grants exactly one random lootable **part** for one **part slot** (75% rare, 25% epic). Lootboxes are persisted per **account** in the `user_economy.lootboxes` column; **guests** earn them for the session only.
**Example:** Completing a cube awards `+1` lootbox.

### lootbox reveal

**Definition:** The client-local panel animation that presents a lootbox opening to the connection that opened it: a 1290 ms sequence of 420 ms wireframe charge, 250 ms orb pulse with overshoot, 120 ms flash, 360 ms card reveal and 140 ms settle, followed by the granted **part**'s name, **part slot**, rarity (rare or epic) and new/duplicate status. The server remains authoritative and sends the grant plus the absolute inventory; other connections of the account receive the inventory update without replaying the reveal. Under reduced motion the settled result appears instantly.
**Example:** Opening a lootbox charges the wireframe orb, flashes, and reveals `Port Silver Wing` for the `wing-left` slot marked `Rare · New`.

### mini-cube

**Definition:** A single clickable tile of a **face**: one of the N² cells of that face's N×N grid (N is the cube level's random grid size, 3 to 7), identified as `face:row:col` with 0-based rows and columns (for example `front:0:0`). The tiles sit with a thin uniform seam between them — the dark interior shows through as the tile lines — so the cube's surface reads as one giant cube built from mini-cubes; destroying a mini-cube removes it from its face for good and exposes the dark interior behind it. It is the unit of destruction for the cube.
**Example:** The mini-cube `front:0:0` is the top-left tile of the front face; on a 5×5 face destroying it leaves 24 mini-cubes on that face.

### motion token

**Definition:** A named, pinned presentation constant — a duration, count, distance, scale, speed or angle — in the `MOTION` table (`src/frontend/src/game/motion.ts`) that the 3D renderer, React UI and CSS animations share, so one motion language has a single source of truth. The 13 CSS-mapped durations are declared as `--motion-*` custom properties on `main` in `game-view.css` and asserted equal to their `MOTION` values by tests; all other tokens stay JS-only.
**Example:** `MOTION.coinPopMs` (1100 ms) drives the coin popup, and its CSS mirror is `--motion-coin-pop-ms: 1100ms`.

### offline progress

**Definition:** Progress credited for the time the player was away with the game not running, delivered on return; it is distinct from idle progress. This is the concept behind the idle-friendly principle.
**Example:** When you return after a break, offline progress grants the points you would have earned.

### part

**Definition:** A cosmetic spaceship component belonging to exactly one of the ten **part slots** (hull, nose, cockpit, wing-left, wing-right, engine-left, engine-right, ignition-left, ignition-right, tail-fin). The catalog has 30 parts — one standard, one rare and one epic part for every slot; the 10 standard parts are always owned and never looted, while the 20 rare/epic parts are granted one per **lootbox** opening. Parts can be equipped in the spaceship customization menu to change the ship's colours, accents and some shapes. Owned part counts are persisted per **account** in the `user_economy.parts` column.
**Example:** `wing-left-silver` is a rare port-wing part; a lootbox opening can grant it once, and equipping it changes only the port wing.

### part slot

**Definition:** One of the ten independently customizable positions on a player's spaceship: `hull`, `nose`, `cockpit`, `wing-left`, `wing-right`, `engine-left`, `engine-right`, `ignition-left`, `ignition-right` and `tail-fin` (displayed as Hull, Nose, Cockpit, Port Wing, Starboard Wing, Port Engine, Starboard Engine, Port Ignition, Starboard Ignition and Tail Fin). Each slot has its own appearance entry and its own three parts in the 30-part catalog (standard, rare and epic), so the left and right sides are independent. A slot with no equipped part resolves to its standard part, which is always owned.
**Example:** Equipping `tail-fin-comet` fills only the `tail-fin` slot; the hull, wings and engines keep their own parts.

### points

**Definition:** The core resource of CubeClicker, earned by clicking the cube and spent on upgrades. It is the canonical name for the game's currency.
**Example:** Each click adds points that you can save for your next upgrade.

### prestige

**Definition:** A voluntary reset of run progress in exchange for a lasting advancement, following the standard clicker genre concept. Reset and bonus mechanics remain to be defined by a future feature.
**Example:** A player may choose to prestige, trading the current run for a permanent bonus.

### save

**Definition:** The persisted game state, and also the act of persisting it. This term covers both senses and relates to the persistence principle.
**Example:** The game writes a save so your points survive a reload.

### server member

**Definition:** A connected user who has been assigned to a **game server** and owns exactly one **cube** on that server's ring layout at a server-assigned **cube world position**. A member's identity is either an account (a verified session resolved server-side from the cookie) or an ephemeral guest (a server-issued id plus an in-memory token, no account); accounts are optional and guest play remains first-class. One connection is one member — two browser tabs are two members. The member keeps their slot while they stay on the server; after a disconnect the slot is retained for the reconnect grace window, and the member moves to another server only when a completed cube executes a rebalance move. Other members see a server member's cube and live play; the member is listed in the `Users on Server` panel by display name.
**Example:** Player 2 joins while game server 1 is full, becoming the first server member of game server 2 with a cube at slot 1 of that server's ring.

### session

**Definition:** A server-side, opaque authentication session carried in an `HttpOnly` cookie with a 7-day sliding expiry. It is created on login or email verification, revoked on logout, and all prior sessions for an account are revoked when a new login succeeds (single active session). The backend resolves account identity from this cookie on the server; the client never reads it.
**Example:** Logging in sets the session cookie; `GET /auth/me` returns the authenticated user while it is valid.

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
