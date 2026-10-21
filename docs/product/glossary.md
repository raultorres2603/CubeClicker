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

**Definition:** A single cube in the run, made of six **faces** of N² **mini-cubes** each (6N² mini-cubes per cube level), where N is the level's random grid size — every cube level draws its own N in 3 to 7. Clearing every face completes the cube level: the game travels to the next cube level, which spawns at a random **cube world position** — left, right, above or below the finished cube, 24 world units away — as a fresh cube in a new style and with its own random grid size, while the player's stats carry over (online occupancy of those positions is a future feature).
**Example:** Destroying the last mini-cube of the sixth face completes the cube level and travels to the next cube.

### cube world position

**Definition:** The fixed position of a **cube level** in the game's flat world plane. The first cube level sits at the origin; each new cube level spawns at the previous cube's world position plus the travel-direction offset of 24 world units (left, right, above or below), so the walk accumulates across levels. The camera always rests above the current cube's world position, looking at it. Future online play will assign positions with occupancy checks, so that no two players' cubes share a position — that is out of scope for now.
**Example:** A cube level that travels to the right puts the next cube at 24 world units to the right of the finished one, and two consecutive rightward travels land at 48 world units.

### face

**Definition:** One of the six flat sides of the cube — front, back, left, right, top and bottom — each an N×N grid of **mini-cubes**, where N is the cube level's random grid size (3 to 7), identical on all six faces. A face is cleared (and disappears from the cube) when its last mini-cube is destroyed.
**Example:** Destroying every mini-cube on the front face clears that face, and the remaining five faces stay playable.

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

### upgrade

**Definition:** A purchasable improvement bought with points that increases the rate at which the player earns. Upgrades are the main way to spend points for faster progress.
**Example:** Buying an upgrade with points makes every future click more valuable.
