# CubeClicker — Glossary

The terms in this glossary are the canonical CubeClicker terminology.
Docs and agents should use these terms as defined here rather than informal synonyms, and new terms or changed meanings should be added to this file in the same change that introduces them.

## Terms

### click

**Definition:** The player's primary action on the cube, and also the discrete event that action produces; each click earns points. This is the canonical word for the action, preferred over informal synonyms.
**Example:** One click on the cube adds a point to the total.

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

### idle progress

**Definition:** Progress that accrues while the game is open and the player is present but not clicking; it is distinct from offline progress. Earning mechanics for this accrual remain to be defined by a future feature.
**Example:** Idle progress keeps earning points while the game is open and you stop clicking.

### mini-cube

**Definition:** A single clickable tile of a **face**: one of the N² cells of that face's N×N grid (N is the cube level's random grid size, 3 to 7), identified as `face:row:col` with 0-based rows and columns (for example `front:0:0`). The tiles sit with a thin uniform seam between them — the dark interior shows through as the tile lines — so the cube's surface reads as one giant cube built from mini-cubes; destroying a mini-cube removes it from its face for good and exposes the dark interior behind it. It is the unit of destruction for the cube.
**Example:** The mini-cube `front:0:0` is the top-left tile of the front face; on a 5×5 face destroying it leaves 24 mini-cubes on that face.

### offline progress

**Definition:** Progress credited for the time the player was away with the game not running, delivered on return; it is distinct from idle progress. This is the concept behind the idle-friendly principle.
**Example:** When you return after a break, offline progress grants the points you would have earned.

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

**Definition:** A connected user who has been assigned to a **game server** and owns exactly one **cube** on that server's ring layout at a server-assigned **cube world position**. A member's identity is ephemeral (a server-issued id plus an in-memory token, no account), and one connection is one member — two browser tabs are two members. The member keeps their slot while they stay on the server; after a disconnect the slot is retained for the reconnect grace window, and the member moves to another server only when a completed cube executes a rebalance move. Other members see a server member's cube and live play; the member is listed in the `Users on Server` panel by display name.
**Example:** Player 2 joins while game server 1 is full, becoming the first server member of game server 2 with a cube at slot 1 of that server's ring.

### spectating

**Definition:** The view-only mode entered by travelling the camera to another **server member**'s cube; it is client-local and never changes shared game state. A spectate travel flies the accepted camera flight from the current cube to the target member's cube, and on arrival clicks, W/A/S/D and arrow keys are ignored while the target's live play stays visible. The spectator can return to their own cube at any time with the same flight, which restores normal play; the mode also ends automatically if the spectated member leaves the server.
**Example:** Choosing Player 2 in the `Users on Server` panel flies the camera to Player 2's cube; while spectating, clicking does nothing until `Return to my cube` brings the player back.

### upgrade

**Definition:** A purchasable improvement bought with points that increases the rate at which the player earns. Upgrades are the main way to spend points for faster progress.
**Example:** Buying an upgrade with points makes every future click more valuable.
