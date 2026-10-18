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

**Definition:** A single cube in the run, made of six **faces** of 25 **mini-cubes** each (150 mini-cubes per cube level). Clearing every face completes the cube level: the game travels to the next cube level, which is a fresh cube in a new style while the player's stats carry over.
**Example:** Destroying the last mini-cube of the sixth face completes the cube level and travels to the next cube.

### face

**Definition:** One of the six flat sides of the cube — front, back, left, right, top and bottom — each a 5×5 grid of **mini-cubes**. A face is cleared (and disappears from the cube) when its last mini-cube is destroyed.
**Example:** Destroying every mini-cube on the front face clears that face, and the remaining five faces stay playable.

### idle progress

**Definition:** Progress that accrues while the game is open and the player is present but not clicking; it is distinct from offline progress. Earning mechanics for this accrual remain to be defined by a future feature.
**Example:** Idle progress keeps earning points while the game is open and you stop clicking.

### mini-cube

**Definition:** A single clickable tile of a **face**: one of the 25 cells of that face's 5×5 grid, identified as `face:row:col` with 0-based rows and columns (for example `front:0:0`). Destroying a mini-cube removes it from its face for good; it is the unit of destruction for the cube.
**Example:** The mini-cube `front:0:0` is the top-left tile of the front face, and destroying it leaves 24 mini-cubes on the front face.

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
